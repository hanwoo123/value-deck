-- Adds Cameraman TD and game-aware item validation. Existing posts remain Blox Fruits.
-- Run after both previous migrations. Does not delete posts or chat messages.
begin;
create table if not exists public.trade_game_items(game_id text not null,id text not null,primary key(game_id,id));
alter table public.trade_game_items enable row level security;
drop policy if exists trade_game_items_read on public.trade_game_items;
create policy trade_game_items_read on public.trade_game_items for select to anon,authenticated using(true);
revoke all on public.trade_game_items from anon,authenticated;
grant select on public.trade_game_items to anon,authenticated;
insert into public.trade_game_items(game_id,id) values
('blox-fruits','eclipse'),
('blox-fruits','rabid-dogblade'),
('blox-fruits','doghouse-frame-break'),
('blox-fruits','vibe-frame-break'),
('blox-fruits','galaxy-empyrean-kitsune'),
('blox-fruits','crimson-kitsune'),
('blox-fruits','parrot'),
('blox-fruits','ember-west-dragon'),
('blox-fruits','permanent-dragon-token'),
('blox-fruits','meme-meme'),
('blox-fruits','east-dragon-perm'),
('blox-fruits','west-dragon-perm'),
('blox-fruits','kitsune-perm'),
('blox-fruits','control-perm'),
('blox-fruits','purple-lightning'),
('blox-fruits','magnet-perm'),
('blox-fruits','tiger-perm'),
('blox-fruits','yeti-perm'),
('blox-fruits','fruit-notifier'),
('blox-fruits','west-dragon'),
('blox-fruits','spirit-perm'),
('blox-fruits','super-spirit-pain'),
('blox-fruits','gas-perm'),
('blox-fruits','dragon-token'),
('blox-fruits','venom-perm'),
('blox-fruits','east-dragon'),
('blox-fruits','shadow-perm'),
('blox-fruits','dough-perm'),
('blox-fruits','t-rex-perm'),
('blox-fruits','mammoth-perm'),
('blox-fruits','divine-portal'),
('blox-fruits','arcsteel-magnet'),
('blox-fruits','gravity-perm'),
('blox-fruits','blizzard-perm'),
('blox-fruits','pain-perm'),
('blox-fruits','lightning-perm'),
('blox-fruits','red-lightning'),
('blox-fruits','portal-perm'),
('blox-fruits','phoenix-perm'),
('blox-fruits','sound-perm'),
('blox-fruits','dog-blade'),
('blox-fruits','spider-perm'),
('blox-fruits','creation-perm'),
('blox-fruits','runic-fiend'),
('blox-fruits','buddha-perm'),
('blox-fruits','love-perm'),
('blox-fruits','mythical-scrolls'),
('blox-fruits','quake-perm'),
('blox-fruits','werewolf'),
('blox-fruits','fiend-yeti'),
('blox-fruits','magma-perm'),
('blox-fruits','dark-blade'),
('blox-fruits','ghost-perm'),
('blox-fruits','rubber-perm'),
('blox-fruits','light-perm'),
('blox-fruits','diamond-perm'),
('blox-fruits','celestial-pain'),
('blox-fruits','eagle-perm'),
('blox-fruits','dark-perm'),
('blox-fruits','sadness-pain'),
('blox-fruits','sand-perm'),
('blox-fruits','legendary-scrolls'),
('blox-fruits','ice-perm'),
('blox-fruits','kitsune'),
('blox-fruits','azura-bomb'),
('blox-fruits','frustration-pain'),
('blox-fruits','nuclear-bomb'),
('blox-fruits','thermite-bomb'),
('blox-fruits','magnet'),
('blox-fruits','flame-perm'),
('blox-fruits','starlight-gravity'),
('blox-fruits','2x-money'),
('blox-fruits','2x-mastery'),
('blox-fruits','eagle-matrix'),
('blox-fruits','1-fruit-storage'),
('blox-fruits','green-lightning'),
('blox-fruits','rose-quartz-diamond'),
('blox-fruits','2x-boss-drops'),
('blox-fruits','fast-boats'),
('blox-fruits','eagle-requiem'),
('blox-fruits','emerald-diamond'),
('blox-fruits','yellow-lightning'),
('blox-fruits','spike-perm'),
('blox-fruits','ruby-diamond'),
('blox-fruits','control'),
('blox-fruits','torment-pain'),
('blox-fruits','smoke-perm'),
('blox-fruits','tiger'),
('blox-fruits','yeti'),
('blox-fruits','bomb-perm'),
('blox-fruits','gas'),
('blox-fruits','spring-perm'),
('blox-fruits','dough'),
('blox-fruits','venom'),
('blox-fruits','lightning'),
('blox-fruits','scarlet-ghost'),
('blox-fruits','t-rex'),
('blox-fruits','eagle-glacier'),
('blox-fruits','blade-perm'),
('blox-fruits','spin-perm'),
('blox-fruits','topaz-diamond'),
('blox-fruits','pain'),
('blox-fruits','gravity'),
('blox-fruits','mammoth'),
('blox-fruits','spirit'),
('blox-fruits','portal'),
('blox-fruits','buddha'),
('blox-fruits','celebration-bomb'),
('blox-fruits','lime-blade'),
('blox-fruits','rocket-perm'),
('blox-fruits','shadow'),
('blox-fruits','blizzard'),
('blox-fruits','phoenix'),
('blox-fruits','creation'),
('blox-fruits','sound'),
('blox-fruits','spider'),
('blox-fruits','love'),
('blox-fruits','magma'),
('blox-fruits','quake'),
('blox-fruits','diamond'),
('blox-fruits','light'),
('blox-fruits','ghost'),
('blox-fruits','eagle'),
('blox-fruits','rubber'),
('blox-fruits','ice'),
('blox-fruits','sand'),
('blox-fruits','dark'),
('blox-fruits','flame'),
('blox-fruits','spike'),
('blox-fruits','smoke'),
('blox-fruits','bomb'),
('blox-fruits','spring'),
('blox-fruits','blade'),
('blox-fruits','spin'),
('blox-fruits','rocket'),
('cameraman-td','spider-tv'),
('cameraman-td','engineer-cameraman'),
('cameraman-td','chaos-cameraman'),
('cameraman-td','upgraded-titan-cameraman'),
('cameraman-td','premium-pass'),
('cameraman-td','executioner-tv-man'),
('cameraman-td','x2-candy'),
('cameraman-td','2x-lucky'),
('cameraman-td','2x-money'),
('cameraman-td','headless-tv-man'),
('cameraman-td','large-scientist-cameraman'),
('cameraman-td','tv-woman'),
('cameraman-td','cinemaman-titan'),
('cameraman-td','2x-speed'),
('cameraman-td','jetpack-cameraman'),
('cameraman-td','large-prototype-titan'),
('cameraman-td','glitch-plungerman'),
('cameraman-td','videotaper-titan'),
('cameraman-td','upgraded-titan-speakerman'),
('cameraman-td','scientist-crate'),
('cameraman-td','spider-crate'),
('cameraman-td','pumpkin-farmer'),
('cameraman-td','scientist-cameraman'),
('cameraman-td','camera-repair-drone'),
('cameraman-td','woman-crate'),
('cameraman-td','camera-spider'),
('cameraman-td','dragon-cameraman'),
('cameraman-td','halloween-crate'),
('cameraman-td','speakerwoman'),
('cameraman-td','ninja-cameraman'),
('cameraman-td','titan-cameraman'),
('cameraman-td','laser-cameraman-car'),
('cameraman-td','titan-tv-man'),
('cameraman-td','titan-speakerman')
on conflict do nothing;
create or replace function public.valid_game_trade_slots(p_game_id text,slots jsonb)
returns boolean language plpgsql stable set search_path = '' as $$
declare item jsonb; seen text[] := '{}'; n integer;
begin
  if jsonb_typeof(slots) is distinct from 'array' then return false; end if;
  if jsonb_array_length(slots) not between 1 and 8 then return false; end if;
  for item in select value from jsonb_array_elements(slots) loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'qty') is distinct from 'number' then return false; end if;
    if (item->>'qty') !~ '^[0-9]{1,2}$' then return false; end if;
    n := (item->>'qty')::integer;
    if n not between 1 and 99 or (item->>'id') = any(seen) then return false; end if;
    if not exists(select 1 from public.trade_game_items where game_id=p_game_id and id = item->>'id') then return false; end if;
    if (select count(*) from jsonb_object_keys(item)) <> 2 then return false; end if;
    seen := array_append(seen,item->>'id');
  end loop;
  return true;
end $$;
revoke all on function public.valid_game_trade_slots(text,jsonb) from public;
grant execute on function public.valid_game_trade_slots(text,jsonb) to authenticated;


alter table public.trade_posts add column if not exists game_id text not null default 'blox-fruits';
alter table public.trade_posts drop constraint if exists trade_posts_game_id_check;
alter table public.trade_posts add constraint trade_posts_game_id_check check(game_id in ('blox-fruits','cameraman-td'));
alter table public.trade_posts drop constraint if exists trade_posts_give_items_check;
alter table public.trade_posts drop constraint if exists trade_posts_want_items_check;
alter table public.trade_posts drop constraint if exists trade_posts_game_give_check;
alter table public.trade_posts drop constraint if exists trade_posts_game_want_check;
alter table public.trade_posts add constraint trade_posts_game_give_check check(public.valid_game_trade_slots(game_id,give_items));
alter table public.trade_posts add constraint trade_posts_game_want_check check(public.valid_game_trade_slots(game_id,want_items));
grant insert(game_id) on public.trade_posts to authenticated;
create index if not exists trade_posts_game_open on public.trade_posts(game_id,id desc) where status='open';
alter table public.trade_conversations add column if not exists game_id text not null default 'blox-fruits';
update public.trade_conversations c set game_id=p.game_id from public.trade_posts p where p.id=c.trade_id and c.game_id<>p.game_id;
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
  insert into public.trade_conversations(trade_id,owner_id,requester_id,owner_name,requester_name,game_id)
  values(post.id,post.owner_id,auth.uid(),post.roblox_username,p_username,post.game_id) returning id into result;
  return result;
end $$;
revoke all on function public.start_trade_chat(bigint,text) from public,anon;
grant execute on function public.start_trade_chat(bigint,text) to authenticated;

commit;
