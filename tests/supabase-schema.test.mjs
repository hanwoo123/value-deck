import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
const migration=readFileSync(new URL('../supabase/migrations/202611020001_trade_board.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';await db.query('insert into auth.users values ($1),($2)',[a,b]);
async function role(name,id=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+name);}
async function denied(sql,params=[]){let failed=false;try{await db.query(sql,params);}catch{failed=true;}assert(failed,'Expected permission or constraint denial: '+sql);}
const insert=`insert into public.trade_posts(roblox_username,give_items,want_items,note) values ('Player_Name',$1::jsonb,$2::jsonb,'hello') returning id,owner_id,status`;
const slots=[JSON.stringify([{id:'kitsune',qty:1}]),JSON.stringify([{id:'dough',qty:2}])];
await role('anon');assert.equal((await db.query('select * from public.trade_posts')).rows.length,0);await denied(insert,slots);
await role('authenticated',a);const created=(await db.query(insert,slots)).rows[0];assert.equal(created.owner_id,a);assert.equal(created.status,'open');await denied(insert,slots);
await denied('update public.trade_posts set roblox_username=\'Fake\' where id=$1',[created.id]);await denied('update public.trade_posts set owner_id=$1 where id=$2',[b,created.id]);await denied('delete from public.trade_posts where id=$1',[created.id]);
await role('authenticated',b);assert.equal((await db.query("update public.trade_posts set status='completed' where id=$1 returning id",[created.id])).rows.length,0);
for(const give of [[{id:'fake',qty:1}],[{id:'kitsune',qty:0}],[{id:'kitsune',qty:1.2}],[{id:'kitsune',qty:1},{id:'kitsune',qty:2}]])await denied(insert,[JSON.stringify(give),slots[1]]);
await role('authenticated',a);assert.equal((await db.query("update public.trade_posts set status='completed' where id=$1 returning completed_at",[created.id])).rows[0].completed_at!==null,true);
await role('anon');assert.equal((await db.query('select * from public.trade_posts')).rows.length,0);
await role('authenticated',b);assert.equal((await db.query('select * from public.trade_posts')).rows.length,0);
await role('authenticated',a);assert.equal((await db.query('select * from public.trade_posts')).rows.length,1);
console.log('PASS migration repeatability, anonymous reads, authenticated insert, owner-only completion, immutable author/content, no delete, invalid slots, rate limit, completed-row visibility');await db.close();
