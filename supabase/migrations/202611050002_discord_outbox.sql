-- Queues only NEW public trade posts. Never queues private chat or historical posts.
begin;
create table if not exists public.trade_discord_outbox (
  trade_id bigint primary key references public.trade_posts(id) on delete cascade,
  status text not null default 'pending' check(status in('pending','sending','sent','skipped','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  claim_token uuid,
  lease_until timestamptz,
  discord_message_id text,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.trade_discord_outbox enable row level security;
revoke all on public.trade_discord_outbox from public,anon,authenticated;
grant select on public.trade_discord_outbox to service_role;
grant select on public.trade_posts to service_role;

create or replace function public.queue_trade_discord()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='open' then
    insert into public.trade_discord_outbox(trade_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.queue_trade_discord() from public,anon,authenticated;
drop trigger if exists queue_trade_discord on public.trade_posts;
create trigger queue_trade_discord after insert on public.trade_posts
for each row execute function public.queue_trade_discord();

create or replace function public.claim_trade_discord(p_limit integer default 5)
returns table(trade_id bigint,claim_token uuid,attempts integer)
language sql security definer set search_path='' as $$
  with candidates as (
    select o.trade_id from public.trade_discord_outbox o
    where (o.status='pending' and o.available_at<=now()) or (o.status='sending' and o.lease_until<now())
    order by o.created_at for update skip locked limit greatest(1,least(p_limit,5))
  )
  update public.trade_discord_outbox o set status='sending',attempts=o.attempts+1,
    claim_token=gen_random_uuid(),lease_until=now()+interval '3 minutes'
  from candidates c where c.trade_id=o.trade_id
  returning o.trade_id,o.claim_token,o.attempts;
$$;
revoke all on function public.claim_trade_discord(integer) from public,anon,authenticated;
grant execute on function public.claim_trade_discord(integer) to service_role;

create or replace function public.finish_trade_discord(p_trade_id bigint,p_claim_token uuid,p_outcome text,p_message_id text default null,p_error text default null,p_retry_seconds integer default 60)
returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  if p_outcome not in('sent','retry','skipped') then raise exception 'Invalid outcome'; end if;
  update public.trade_discord_outbox set
    status=case when p_outcome='retry' then case when attempts>=8 then 'failed' else 'pending' end else p_outcome end,
    discord_message_id=case when p_outcome='sent' then left(p_message_id,100) else null end,
    last_error=case when p_outcome='retry' then left(p_error,100) else null end,
    available_at=now()+make_interval(secs=>greatest(1,least(p_retry_seconds,3600))),lease_until=null,claim_token=null
  where trade_id=p_trade_id and claim_token=p_claim_token and status='sending';
  get diagnostics affected=row_count;
  return affected=1;
end $$;
revoke all on function public.finish_trade_discord(bigint,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.finish_trade_discord(bigint,uuid,text,text,text,integer) to service_role;
commit;
