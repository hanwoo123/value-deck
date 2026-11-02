import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
for(const file of ['202611020001_trade_board.sql','202611020002_trade_chat.sql','202611020002_trade_chat.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
const [a,b,c,d]=['11111111','22222222','33333333','44444444'].map(x=>`${x}-1111-4111-8111-111111111111`);
await db.query('insert into auth.users values ($1),($2),($3),($4)',[a,b,c,d]);
async function role(name,id=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+name);}
async function deny(sql,args=[]){let failed=false;try{await db.query(sql,args);}catch{failed=true;}assert(failed,'Expected denial: '+sql);}
await role('authenticated',a);
const post=(await db.query(`insert into public.trade_posts(roblox_username,give_items,want_items) values('Owner','[{"id":"kitsune","qty":1}]','[{"id":"dough","qty":1}]') returning id`)).rows[0].id;
await deny('select public.start_trade_chat($1,$2)',[post,'Owner']);
await role('anon');await deny('select public.start_trade_chat($1,$2)',[post,'Guest']);await deny('select * from public.trade_messages');
await role('authenticated',b);
const start=()=>db.query('select public.start_trade_chat($1,$2) as id',[post,'Buyer']);const room=(await start()).rows[0].id;assert.equal((await start()).rows[0].id,room);
await deny('insert into public.trade_conversations(trade_id,owner_id,requester_id,owner_name,requester_name) values($1,$2,$3,$4,$5)',[post,a,c,'Owner','Fake']);
const send='insert into public.trade_messages(conversation_id,body) values($1,$2) returning sender_id';
await deny(send,[room,'   ']);await deny(send,[room,'x'.repeat(1001)]);
assert.equal((await db.query(send,[room,'Can we trade?'])).rows[0].sender_id,b);
await deny(send,[room,'spam']);
await deny('insert into public.trade_messages(conversation_id,sender_id,body) values($1,$2,$3)',[room,a,'fake sender']);
await deny('update public.trade_messages set body=$1 where conversation_id=$2',['edited',room]);await deny('delete from public.trade_messages where conversation_id=$1',[room]);
await role('authenticated',c);assert.equal((await db.query('select * from public.trade_conversations where id=$1',[room])).rows.length,0);assert.equal((await db.query('select * from public.trade_messages where conversation_id=$1',[room])).rows.length,0);await deny(send,[room,'intrusion']);
await role('authenticated',d);const other=(await db.query('select public.start_trade_chat($1,$2) as id',[post,'OtherBuyer'])).rows[0].id;assert.notEqual(room,other);assert.equal((await db.query('select * from public.trade_messages where conversation_id=$1',[room])).rows.length,0);
await role('authenticated',a);assert.equal((await db.query('select * from public.trade_conversations')).rows.length,2);assert.equal((await db.query(send,[room,'Yes, meet in game.'])).rows[0].sender_id,a);await db.query("update public.trade_posts set status='completed' where id=$1",[post]);
await role('authenticated',b);assert.equal((await start()).rows[0].id,room);assert.equal((await db.query('select * from public.trade_messages where conversation_id=$1',[room])).rows.length,2);
await role('authenticated',c);await deny('select public.start_trade_chat($1,$2)',[post,'LateBuyer']);await deny('select public.start_trade_chat($1,$2)',[post,'<script>']);
console.log('PASS private chat migration: repeatability, participants-only visibility, isolated buyers, authenticated RPC, author/sender spoof prevention, rate/length limits, existing chats after completion');await db.close();
