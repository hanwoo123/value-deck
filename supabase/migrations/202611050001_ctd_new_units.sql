-- Adds the 3 new Cameraman TD units. Existing posts and chats are unchanged.
begin;
insert into public.trade_game_items(game_id,id) values
('cameraman-td','hacked-cameraman'),
('cameraman-td','pharaoh-cameraman'),
('cameraman-td','upgraded-titan-tv-man')
on conflict do nothing;
commit;
