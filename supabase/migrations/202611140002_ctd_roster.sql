-- Add CTD roster IDs; existing trades and conversations are preserved.
begin;
insert into public.trade_game_items(game_id,id) values
('cameraman-td','reinforced-titan-cameraman'),
('cameraman-td','large-laser-cameraman'),
('cameraman-td','reinforced-titan-speakerman'),
('cameraman-td','prototype-duo'),
('cameraman-td','camera-attack-helicopter'),
('cameraman-td','mummy-cameraman'),
('cameraman-td','speaker-helicopter'),
('cameraman-td','vampire-camera-man'),
('cameraman-td','werewolf-speakerman'),
('cameraman-td','dark-speakerman'),
('cameraman-td','rocket-cameraman'),
('cameraman-td','clown-speakerman'),
('cameraman-td','large-tv-man'),
('cameraman-td','speaker-spider'),
('cameraman-td','large-cameraman'),
('cameraman-td','dark-camerawoman'),
('cameraman-td','large-speakerman'),
('cameraman-td','tv-man'),
('cameraman-td','brown-cameraman'),
('cameraman-td','car-speakerman'),
('cameraman-td','cameraman'),
('cameraman-td','speakerman'),
('cameraman-td','camera-helicopter'),
('cameraman-td','popcorn-cameraman')
on conflict do nothing;
commit;
