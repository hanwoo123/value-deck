import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
const sql=file=>readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
await db.exec(sql('202611020001_trade_board.sql'));await db.exec(sql('202611020002_trade_chat.sql'));
const [a,b,c]=['11111111','22222222','33333333'].map(x=>`${x}-1111-4111-8111-111111111111`);await db.query('insert into auth.users values($1),($2),($3)',[a,b,c]);
async function role(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
async function deny(sql,args=[]){let failed=false;try{await db.query(sql,args);}catch{failed=true;}assert(failed,'Expected denial: '+sql);}
await role(a);const legacy=(await db.query(`insert into public.trade_posts(roblox_username,give_items,want_items) values('Legacy','[{"id":"kitsune","qty":1}]','[{"id":"dough","qty":1}]') returning id`)).rows[0].id;
await role(b);const room=(await db.query('select public.start_trade_chat($1,$2) as id',[legacy,'Buyer'])).rows[0].id;await db.query('insert into public.trade_messages(conversation_id,body) values($1,$2)',[room,'Keep this message']);
await db.exec('reset role');await db.exec(sql('202611030001_trade_games.sql'));await db.exec(sql('202611030001_trade_games.sql'));
assert.equal((await db.query('select game_id from public.trade_posts where id=$1',[legacy])).rows[0].game_id,'blox-fruits');assert.equal((await db.query('select count(*) as n from public.trade_messages')).rows[0].n,1);
await role(c);
const insert=`insert into public.trade_posts(game_id,roblox_username,give_items,want_items) values($1,'Cameraman',$2::jsonb,$3::jsonb) returning id,game_id`;
const bf='[{"id":"kitsune","qty":1}]',ctd='[{"id":"spider-tv","qty":1}]';
await deny(insert,['cameraman-td',bf,ctd]);await deny(insert,['blox-fruits',ctd,bf]);await deny(insert,['unknown',bf,bf]);
const post=(await db.query(insert,['cameraman-td',ctd,'[{"id":"engineer-cameraman","qty":2}]'])).rows[0];assert.equal(post.game_id,'cameraman-td');
await deny("update public.trade_posts set game_id='blox-fruits' where id=$1",[post.id]);await deny("insert into public.trade_game_items values('cameraman-td','fake')");
await role(b);const newRoom=(await db.query('select public.start_trade_chat($1,$2) as id',[post.id,'Buyer'])).rows[0].id;assert.equal((await db.query('select game_id from public.trade_conversations where id=$1',[newRoom])).rows[0].game_id,'cameraman-td');
assert.equal((await db.query('select * from public.trade_posts where game_id=$1',['blox-fruits'])).rows.length,1);assert.equal((await db.query('select * from public.trade_posts where game_id=$1',['cameraman-td'])).rows.length,1);
await db.exec('reset role');
await db.exec(sql('202611050001_ctd_new_units.sql'));await db.exec(sql('202611050001_ctd_new_units.sql'));
assert.equal((await db.query('select count(*) as n from public.trade_posts')).rows[0].n,2);
assert.equal((await db.query('select count(*) as n from public.trade_messages')).rows[0].n,1);
await role(b);
for(const id of ['hacked-cameraman','pharaoh-cameraman','upgraded-titan-tv-man']){
 assert.equal((await db.query('select public.valid_game_trade_slots($1,$2::jsonb) as valid',['cameraman-td',JSON.stringify([{id,qty:1}])])).rows[0].valid,true);
 assert.equal((await db.query('select public.valid_game_trade_slots($1,$2::jsonb) as valid',['blox-fruits',JSON.stringify([{id,qty:1}])])).rows[0].valid,false);
}
console.log('PASS new CTD allowlist, repeatability and post/message preservation');
console.log('PASS both game catalogs, cross-game rejection, immutable game/author, legacy posts/chats preserved, game-aware conversations, migration repeatability');await db.close();
