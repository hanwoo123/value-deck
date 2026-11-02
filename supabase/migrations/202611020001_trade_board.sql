-- VALUE DECK: run this whole file in Supabase SQL Editor as the project owner.
-- Public keys cannot run migrations. No Roblox or database secret is needed in the browser.
begin;
create table if not exists public.blox_trade_items (id text primary key);
alter table public.blox_trade_items enable row level security;
drop policy if exists trade_items_read on public.blox_trade_items;
create policy trade_items_read on public.blox_trade_items for select to anon, authenticated using (true);
grant select on public.blox_trade_items to anon, authenticated;
revoke insert, update, delete on public.blox_trade_items from anon, authenticated;
insert into public.blox_trade_items(id) values
('eclipse'),
('rabid-dogblade'),
('doghouse-frame-break'),
('vibe-frame-break'),
('galaxy-empyrean-kitsune'),
('crimson-kitsune'),
('parrot'),
('ember-west-dragon'),
('permanent-dragon-token'),
('meme-meme'),
('east-dragon-perm'),
('west-dragon-perm'),
('kitsune-perm'),
('control-perm'),
('purple-lightning'),
('magnet-perm'),
('tiger-perm'),
('yeti-perm'),
('fruit-notifier'),
('west-dragon'),
('spirit-perm'),
('super-spirit-pain'),
('gas-perm'),
('dragon-token'),
('venom-perm'),
('east-dragon'),
('shadow-perm'),
('dough-perm'),
('t-rex-perm'),
('mammoth-perm'),
('divine-portal'),
('arcsteel-magnet'),
('gravity-perm'),
('blizzard-perm'),
('pain-perm'),
('lightning-perm'),
('red-lightning'),
('portal-perm'),
('phoenix-perm'),
('sound-perm'),
('dog-blade'),
('spider-perm'),
('creation-perm'),
('runic-fiend'),
('buddha-perm'),
('love-perm'),
('mythical-scrolls'),
('quake-perm'),
('werewolf'),
('fiend-yeti'),
('magma-perm'),
('dark-blade'),
('ghost-perm'),
('rubber-perm'),
('light-perm'),
('diamond-perm'),
('celestial-pain'),
('eagle-perm'),
('dark-perm'),
('sadness-pain'),
('sand-perm'),
('legendary-scrolls'),
('ice-perm'),
('kitsune'),
('azura-bomb'),
('frustration-pain'),
('nuclear-bomb'),
('thermite-bomb'),
('magnet'),
('flame-perm'),
('starlight-gravity'),
('2x-money'),
('2x-mastery'),
('eagle-matrix'),
('1-fruit-storage'),
('green-lightning'),
('rose-quartz-diamond'),
('2x-boss-drops'),
('fast-boats'),
('eagle-requiem'),
('emerald-diamond'),
('yellow-lightning'),
('spike-perm'),
('ruby-diamond'),
('control'),
('torment-pain'),
('smoke-perm'),
('tiger'),
('yeti'),
('bomb-perm'),
('gas'),
('spring-perm'),
('dough'),
('venom'),
('lightning'),
('scarlet-ghost'),
('t-rex'),
('eagle-glacier'),
('blade-perm'),
('spin-perm'),
('topaz-diamond'),
('pain'),
('gravity'),
('mammoth'),
('spirit'),
('portal'),
('buddha'),
('celebration-bomb'),
('lime-blade'),
('rocket-perm'),
('shadow'),
('blizzard'),
('phoenix'),
('creation'),
('sound'),
('spider'),
('love'),
('magma'),
('quake'),
('diamond'),
('light'),
('ghost'),
('eagle'),
('rubber'),
('ice'),
('sand'),
('dark'),
('flame'),
('spike'),
('smoke'),
('bomb'),
('spring'),
('blade'),
('spin'),
('rocket')
on conflict do nothing;

create or replace function public.valid_trade_slots(slots jsonb)
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
    if not exists(select 1 from public.blox_trade_items where id = item->>'id') then return false; end if;
    if (select count(*) from jsonb_object_keys(item)) <> 2 then return false; end if;
    seen := array_append(seen,item->>'id');
  end loop;
  return true;
end $$;
revoke all on function public.valid_trade_slots(jsonb) from public;
grant execute on function public.valid_trade_slots(jsonb) to authenticated;

create table if not exists public.trade_posts (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  roblox_username text not null check(roblox_username ~ '^[A-Za-z0-9_]{3,20}$'),
  give_items jsonb not null check(public.valid_trade_slots(give_items)),
  want_items jsonb not null check(public.valid_trade_slots(want_items)),
  note text not null default '' check(char_length(note) <= 200),
  status text not null default 'open' check(status in ('open','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists trade_posts_open_id on public.trade_posts(id desc) where status='open';
create index if not exists trade_posts_owner_id on public.trade_posts(owner_id,id desc);
alter table public.trade_posts enable row level security;
revoke all on public.trade_posts from anon, authenticated;
grant select on public.trade_posts to anon, authenticated;
grant insert (roblox_username,give_items,want_items,note) on public.trade_posts to authenticated;
grant update (status) on public.trade_posts to authenticated;
grant usage on sequence public.trade_posts_id_seq to authenticated;

drop policy if exists trade_posts_read on public.trade_posts;
create policy trade_posts_read on public.trade_posts for select to anon, authenticated
using (status='open' or owner_id=(select auth.uid()));
drop policy if exists trade_posts_create on public.trade_posts;
create policy trade_posts_create on public.trade_posts for insert to authenticated
with check (owner_id=(select auth.uid()) and status='open');
drop policy if exists trade_posts_complete on public.trade_posts;
create policy trade_posts_complete on public.trade_posts for update to authenticated
using (owner_id=(select auth.uid()) and status='open')
with check (owner_id=(select auth.uid()) and status='completed');

create or replace function public.guard_trade_post()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception '거래글 작성 연결을 확인해 주세요.'; end if;
  if tg_op = 'INSERT' then
    -- Lock per author so concurrent requests cannot bypass the posting limits.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
    if (select count(*) from public.trade_posts where owner_id=auth.uid() and status='open') >= 5 then
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
revoke all on function public.guard_trade_post() from public, anon, authenticated;
drop trigger if exists trade_posts_guard on public.trade_posts;
create trigger trade_posts_guard before insert or update on public.trade_posts
for each row execute function public.guard_trade_post();
commit;
