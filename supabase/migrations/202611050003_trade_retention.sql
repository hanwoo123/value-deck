-- Six-hour public lifetime; seven-day retention after closing.
-- Existing older posts are also expired/purged under the same policy when run.
-- Run after the trade/chat/game/Discord outbox migrations.
begin;
create extension if not exists pg_cron;
create or replace function public.guard_trade_post()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- A narrowly scoped expiration transition also permits the scheduled owner job.
  -- RLS/column grants still prevent visitors from changing another author's post.
  if tg_op='UPDATE' and old.status='open' and new.status='completed'
     and old.created_at<=statement_timestamp()-interval '6 hours'
     and (to_jsonb(new)-'status'-'completed_at')=(to_jsonb(old)-'status'-'completed_at') then
    new.completed_at:=old.created_at+interval '6 hours';
    return new;
  end if;
  if auth.uid() is null then raise exception '거래글 작성 연결을 확인해 주세요.'; end if;
  if tg_op = 'INSERT' then
    -- Lock per author so concurrent requests cannot bypass the posting limits.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
    if (select count(*) from public.trade_posts where owner_id=auth.uid() and status='open' and created_at>statement_timestamp()-interval '6 hours') >= 5 then
      raise exception '진행 중인 거래는 최대 5개입니다.';
    end if;
    if exists(select 1 from public.trade_posts where owner_id=auth.uid() and created_at>now()-interval '1 minute') then
      raise exception '새 거래글은 1분 간격으로 등록할 수 있습니다.';
    end if;
    new.owner_id := auth.uid();
    new.status := 'open';
    new.created_at := now();
    new.completed_at := null;
  else
    if old.owner_id <> auth.uid() or old.status <> 'open' or new.status <> 'completed' then
      raise exception '작성한 거래글만 완료할 수 있습니다.';
    end if;
    new.completed_at := now();
  end if;
  return new;
end $$;

create or replace function public.start_trade_chat(p_trade_id bigint,p_username text)
returns bigint language plpgsql security definer set search_path='' as $$
declare post public.trade_posts; existing bigint; result bigint;
begin
  if auth.uid() is null then raise exception '닉네임을 저장하고 다시 시도해 주세요.'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then raise exception '올바른 Roblox 사용자 이름을 저장해 주세요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select id into existing from public.trade_conversations where trade_id=p_trade_id and requester_id=auth.uid();
  if existing is not null then return existing; end if;
  select * into post from public.trade_posts where id=p_trade_id and status='open' and created_at>statement_timestamp()-interval '6 hours' for share;
  if not found then raise exception '진행 중인 거래글을 찾을 수 없습니다.'; end if;
  if post.owner_id=auth.uid() then raise exception '본인 거래글의 문의는 내 채팅에서 확인해 주세요.'; end if;
  if (select count(*) from public.trade_conversations where requester_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then
    raise exception '새 대화는 1시간에 최대 10개까지 열 수 있습니다.';
  end if;
  insert into public.trade_conversations(trade_id,owner_id,requester_id,owner_name,requester_name,game_id)
  values(post.id,post.owner_id,auth.uid(),post.roblox_username,p_username,post.game_id) returning id into result;
  return result;
end $$;
revoke all on function public.start_trade_chat(bigint,text) from public,anon;
grant execute on function public.start_trade_chat(bigint,text) to authenticated;


-- Expired posts disappear from public reads even if the scheduler is delayed.
drop policy if exists trade_posts_read on public.trade_posts;
create policy trade_posts_read on public.trade_posts for select to anon,authenticated
using ((status='open' and created_at>statement_timestamp()-interval '6 hours') or owner_id=(select auth.uid()));

alter table public.trade_discord_outbox add column if not exists finished_at timestamptz;
-- Preserve old delivery logs for at least seven days after installing this migration.
update public.trade_discord_outbox set finished_at=statement_timestamp()
where status in('sent','skipped') and finished_at is null;
create or replace function public.stamp_discord_finished()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status in('sent','skipped') then
    new.finished_at:=case when old.status=new.status and old.finished_at is not null then old.finished_at else statement_timestamp() end;
  else new.finished_at:=null;
  end if;
  return new;
end $$;
revoke all on function public.stamp_discord_finished() from public,anon,authenticated;
drop trigger if exists stamp_discord_finished on public.trade_discord_outbox;
create trigger stamp_discord_finished before update of status on public.trade_discord_outbox
for each row execute function public.stamp_discord_finished();
-- Do not forward completed/expired posts, including when the cleanup job is delayed.
create or replace function public.claim_trade_discord(p_limit integer default 5)
returns table(trade_id bigint,claim_token uuid,attempts integer)
language plpgsql security definer set search_path='' as $$
begin
  update public.trade_discord_outbox o set status='skipped',lease_until=null,claim_token=null,last_error=null,discord_message_id=null
  from public.trade_posts p where p.id=o.trade_id
    and (p.status<>'open' or p.created_at<=statement_timestamp()-interval '6 hours')
    and (o.status='pending' or (o.status='sending' and o.lease_until<statement_timestamp()));
  return query
  with candidates as (
    select o.trade_id from public.trade_discord_outbox o
    where (o.status='pending' and o.available_at<=now()) or (o.status='sending' and o.lease_until<now())
    order by o.created_at for update skip locked limit greatest(1,least(p_limit,5))
  )
  update public.trade_discord_outbox o set status='sending',attempts=o.attempts+1,
    claim_token=gen_random_uuid(),lease_until=now()+interval '3 minutes'
  from candidates c where c.trade_id=o.trade_id
  returning o.trade_id,o.claim_token,o.attempts;
end $$;
revoke all on function public.claim_trade_discord(integer) from public,anon,authenticated;
grant execute on function public.claim_trade_discord(integer) to service_role;

create index if not exists trade_posts_retention on public.trade_posts(completed_at) where status='completed';
create index if not exists trade_discord_retention on public.trade_discord_outbox(finished_at) where status in('sent','skipped');

create or replace function public.cleanup_trade_data()
returns jsonb language plpgsql security definer set search_path='' as $$
declare expired_count integer;deleted_count integer;notification_count integer;runlog_count integer;
begin
  -- Batches keep maintenance short and avoid posts currently locked by other work.
  with due as (
    select id from public.trade_posts where status='open'
      and created_at<=statement_timestamp()-interval '6 hours'
    order by created_at for update skip locked limit 500
  )
  update public.trade_posts p set status='completed' from due where p.id=due.id;
  get diagnostics expired_count=row_count;

  with due as (
    select p.id from public.trade_posts p
    where p.status='completed' and p.completed_at<=statement_timestamp()-interval '7 days'
      and not exists(select 1 from public.trade_discord_outbox o where o.trade_id=p.id and o.status='sending' and o.lease_until>statement_timestamp())
    order by p.completed_at for update of p skip locked limit 500
  )
  delete from public.trade_posts p using due where p.id=due.id;
  get diagnostics deleted_count=row_count;

  with due as (
    select trade_id from public.trade_discord_outbox
    where status in('sent','skipped') and finished_at<=statement_timestamp()-interval '7 days'
    order by finished_at for update skip locked limit 1000
  )
  delete from public.trade_discord_outbox o using due where o.trade_id=due.trade_id;
  get diagnostics notification_count=row_count;

  -- Only this app's finished cron records; never other projects' jobs or active runs.
  with due as (
    select r.runid from cron.job_run_details r join cron.job j on j.jobid=r.jobid
    where j.jobname in('value-deck-trade-discord','value-deck-trade-retention')
      and r.end_time<statement_timestamp()-interval '7 days'
    order by r.end_time limit 5000
  )
  delete from cron.job_run_details r using due where r.runid=due.runid;
  get diagnostics runlog_count=row_count;

  return jsonb_build_object('expired_posts',expired_count,'deleted_posts',deleted_count,
    'deleted_notification_logs',notification_count,'deleted_run_logs',runlog_count);
end $$;
revoke all on function public.cleanup_trade_data() from public,anon,authenticated;
grant execute on function public.cleanup_trade_data() to service_role;

select cron.schedule('value-deck-trade-retention','*/5 * * * *','select public.cleanup_trade_data();');
select public.cleanup_trade_data() as cleanup_result;
commit;
