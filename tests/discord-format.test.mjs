import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatTrade,sendTrade,discordDestination} from '../supabase/functions/trade-discord/format.mjs';
const post={id:123,game_id:'cameraman-td',roblox_username:'my_name',give_items:[{id:'hacked-cameraman',qty:1}],want_items:[{id:'spider-tv',qty:2}],note:'@everyone **offer**',created_at:'2026-11-05T00:00:00Z'};
const webhook='https://discord.com/api/webhooks/123/test-token';
test('new public trade embed has names, quantities, board link, safe mentions and image',()=>{
 const payload=formatTrade(post);assert.deepEqual(payload.allowed_mentions,{parse:[]});const e=payload.embeds[0];assert(e.title.includes('카메라맨'));assert.equal(e.fields[0].value,'Hacked Cameraman × 1');assert.equal(e.fields[1].value,'TV Spider × 2');assert(e.description.includes('my\\_name'));assert(e.url.endsWith('/cameraman-td'));assert(e.thumbnail.url.startsWith('https://bloxdecks.com/images/'));assert(!JSON.stringify(payload).includes('owner_id'));
 assert.throws(()=>formatTrade({...post,give_items:[{id:'kitsune',qty:1}]}));assert.throws(()=>formatTrade({...post,game_id:'unknown'}));
});
test('only Discord webhook destinations; no network call for unknown items',async()=>{
 for(const url of ['http://discord.com/api/webhooks/123/test','https://evil.example/api/webhooks/123/test','https://discord.com.evil.example/api/webhooks/123/test','https://user:pass@discord.com/api/webhooks/123/test'])assert.throws(()=>discordDestination(url));
 assert.equal(new URL(discordDestination(webhook)).search,'?wait=true');let called=false;await assert.rejects(()=>sendTrade({...post,want_items:[]},webhook,()=>{called=true}));assert.equal(called,false);
});
test('waits for confirmed message ID; 429 and network failure are retryable without leaking URLs',async()=>{
 let payload;const ok=await sendTrade(post,webhook,async(url,options)=>{assert.equal(url,webhook+'?wait=true');payload=JSON.parse(options.body);return new Response(JSON.stringify({id:'456'}),{status:200});});assert.equal(ok.outcome,'sent');assert.equal(ok.messageId,'456');assert(payload.embeds.length);
 const rate=await sendTrade(post,webhook,async()=>new Response(JSON.stringify({retry_after:12.2}),{status:429}));assert.equal(rate.outcome,'retry');assert.equal(rate.retrySeconds,13);
 const failed=await sendTrade(post,webhook,async()=>{throw new Error(webhook)});assert.equal(failed.error,'discord_network_error');assert(!JSON.stringify(failed).includes('test-token'));
 const unconfirmed=await sendTrade(post,webhook,async()=>new Response('{}'));assert.equal(unconfirmed.outcome,'retry');
});
test('notification catalog matches all live item catalogs',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../supabase/functions/trade-discord/catalog.json',import.meta.url)));
 for(const game of ['blox-fruits','cameraman-td','king-legacy']){const data=JSON.parse(readFileSync(new URL('../data/'+game+'.json',import.meta.url)));assert.deepEqual(catalog[game],Object.fromEntries(data.items.map(i=>[i.id,{name:i.name,image:i.image||''}])));}
});

test('existing bot uses only Discord channel API and sends token in Authorization header',async()=>{
 const {sendTradeBot,botDestination}=await import('../supabase/functions/trade-discord/format.mjs');
 assert.throws(()=>botDestination('https://evil.example'));assert.throws(()=>botDestination('123\n456'));
 const token='fake-test-token-never-a-real-credential';const channel='123456789012345678';
 const result=await sendTradeBot(post,token,channel,async(url,options)=>{assert.equal(url,'https://discord.com/api/v10/channels/'+channel+'/messages');assert.equal(options.headers.Authorization,'Bot '+token);assert(!options.body.includes(token));assert.deepEqual(JSON.parse(options.body).allowed_mentions,{parse:[]});return Response.json({id:'98765'});});
 assert.equal(result.outcome,'sent');assert.equal(result.messageId,'98765');assert(!JSON.stringify(result).includes(token));
});

test('King Legacy notification uses its own catalog and board',()=>{const result=formatTrade({...post,game_id:'king-legacy',give_items:[{id:'dragon-fruit',qty:1}],want_items:[{id:'perm-dragon',qty:1}]});assert(result.embeds[0].title.includes('킹피스'));assert(result.embeds[0].url.endsWith('/king-legacy'));assert.equal(result.embeds[0].fields[0].value,'Dragon Fruit × 1');});
