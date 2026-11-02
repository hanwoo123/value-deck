-- Run after 202611020001_trade_board.sql. Adds private chat without changing existing trades.
begin;
create table if not exists public.trade_conversations (
  id bigint generated always as identity primary key,
  trade_id bigint not null references public.trade_posts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null,
  requester_name text not null check(requester_name ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now(),
  check(owner_id<>requester_id),
  unique(trade_id,requester_id)
);
create index if not exists trade_conversations_owner on public.trade_conversations(owner_id,id desc);
create index if not exists trade_conversations_requester on public.trade_conversations(requester_id,id desc);
alter table public.trade_conversations enable row level security;
revoke all on public.trade_conversations from anon,authenticated;
grant select on public.trade_conversations to authenticated;
drop policy if exists chat_members_read on public.trade_conversations;
create policy chat_members_read on public.trade_conversations for select to authenticated
using ((select auth.uid()) in (owner_id,requester_id));

create table if not exists public.trade_messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.trade_conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check(char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists trade_messages_conversation on public.trade_messages(conversation_id,id);
create index if not exists trade_messages_sender_time on public.trade_messages(sender_id,created_at);
alter table public.trade_messages enable row level security;
revoke all on public.trade_messages from anon,authenticated;
grant select on public.trade_messages to authenticated;
grant insert(conversation_id,body) on public.trade_messages to authenticated;
grant usage on sequence public.trade_messages_id_seq to authenticated;
drop policy if exists chat_message_read on public.trade_messages;
create policy chat_message_read on public.trade_messages for select to authenticated
using (exists(select 1 from public.trade_conversations c where c.id=conversation_id and (select auth.uid()) in(c.owner_id,c.requester_id)));
drop policy if exists chat_message_send on public.trade_messages;
create policy chat_message_send on public.trade_messages for insert to authenticated
with check(sender_id=(select auth.uid()) and exists(select 1 from public.trade_conversations c where c.id=conversation_id and (select auth.uid()) in(c.owner_id,c.requester_id)));

create or replace function public.start_trade_chat(p_trade_id bigint,p_username text)
returns bigint language plpgsql security definer set search_path='' as $$
declare post public.trade_posts; existing bigint; result bigint;
begin
  if auth.uid() is null then raise exception '닉네임을 저장하고 다시 시도해 주세요.'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then raise exception '올바른 Roblox 사용자 이름을 저장해 주세요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select id into existing from public.trade_conversations where trade_id=p_trade_id and requester_id=auth.uid();
  if existing is not null then return existing; end if;
  select * into post from public.trade_posts where id=p_trade_id and status='open' for share;
  if not found then raise exception '진행 중인 거래글을 찾을 수 없습니다.'; end if;
  if post.owner_id=auth.uid() then raise exception '본인 거래글의 문의는 내 채팅에서 확인해 주세요.'; end if;
  if (select count(*) from public.trade_conversations where requester_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then
    raise exception '새 대화는 1시간에 최대 10개까지 열 수 있습니다.';
  end if;
  insert into public.trade_conversations(trade_id,owner_id,requester_id,owner_name,requester_name)
  values(post.id,post.owner_id,auth.uid(),post.roblox_username,p_username) returning id into result;
  return result;
end $$;
revoke all on function public.start_trade_chat(bigint,text) from public,anon;
grant execute on function public.start_trade_chat(bigint,text) to authenticated;

create or replace function public.guard_trade_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.trade_conversations c where c.id=new.conversation_id and auth.uid() in(c.owner_id,c.requester_id)) then
    raise exception '이 대화에 참여할 수 없습니다.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
  if exists(select 1 from public.trade_messages where sender_id=auth.uid() and created_at>clock_timestamp()-interval '1 second') then
    raise exception '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 보내 주세요.';
  end if;
  if (select count(*) from public.trade_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then
    raise exception '메시지는 1분에 최대 30개까지 보낼 수 있습니다.';
  end if;
  new.sender_id:=auth.uid();new.created_at:=clock_timestamp();
  return new;
end $$;
revoke all on function public.guard_trade_message() from public,anon,authenticated;
drop trigger if exists trade_messages_guard on public.trade_messages;
create trigger trade_messages_guard before insert on public.trade_messages
for each row execute function public.guard_trade_message();
commit;
