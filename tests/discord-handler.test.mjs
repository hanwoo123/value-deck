import {test} from 'node:test';import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/trade-discord/handler.ts';
const config={secret:'a'.repeat(40),webhook:'https://discord.com/api/webhooks/123/test-token',project:'https://test.supabase.co',key:'test-service-key'};
const request=secret=>new Request('https://test.supabase.co/functions/v1/trade-discord',{method:'POST',headers:{'x-trade-webhook-secret':secret},body:'{}'});
test('worker denies missing/incorrect credentials before DB or Discord access',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw new Error('no call expected')};const handler=createHandler(config,fetcher);
 assert.equal((await handler(request(''))).status,401);assert.equal((await handler(request('wrong'))).status,401);assert.equal(calls,0);
 assert.equal((await createHandler({...config,secret:''},fetcher)(request(''))).status,503);assert.equal(calls,0);
});
test('worker rereads authoritative public post, sends confirmed embed and acknowledges lease',async()=>{
 const seen=[];const handler=createHandler(config,async(url,options)=>{
  seen.push(String(url));const body=options.body&&JSON.parse(options.body);
  if(String(url).endsWith('rpc/claim_trade_discord'))return Response.json([{trade_id:1,claim_token:'lease',attempts:1}]);
  if(String(url).includes('trade_posts?'))return Response.json([{id:1,game_id:'blox-fruits',roblox_username:'Owner',give_items:[{id:'kitsune',qty:1}],want_items:[{id:'dough',qty:1}],note:'hello',status:'open'}]);
  if(String(url).startsWith('https://discord.com/')){assert.equal(body.allowed_mentions.parse.length,0);return Response.json({id:'789'});}
  assert(String(url).endsWith('rpc/finish_trade_discord'));assert.equal(body.p_claim_token,'lease');assert.equal(body.p_outcome,'sent');assert.equal(body.p_message_id,'789');return Response.json(true);
 });
 const r=await handler(request(config.secret));assert.equal(r.status,200);assert.deepEqual(await r.json(),{sent:1,retry:0,skipped:0});assert.equal(seen.length,4);
});
test('completed posts do not send and Discord failure becomes a persisted retry',async()=>{
 for(const status of ['completed','open']){let sent=0;let ack;const handler=createHandler(config,async(url,options)=>{
  if(String(url).endsWith('rpc/claim_trade_discord'))return Response.json([{trade_id:1,claim_token:'lease',attempts:1}]);
  if(String(url).includes('trade_posts?'))return Response.json([{id:1,game_id:'cameraman-td',roblox_username:'Owner',give_items:[{id:'spider-tv',qty:1}],want_items:[{id:'engineer-cameraman',qty:1}],status}]);
  if(String(url).startsWith('https://discord.com/')){sent++;return new Response('{}',{status:429});}
  ack=JSON.parse(options.body);return Response.json(true);
 });assert.equal((await handler(request(config.secret))).status,200);assert.equal(sent,status==='open'?1:0);assert.equal(ack.p_outcome,status==='open'?'retry':'skipped');}
});

test('bot configuration is validated before DB access and takes precedence over webhook',async()=>{
 let called=false;
 const invalid=createHandler({...config,botToken:'fake-test-token-never-a-real-credential'},async()=>{called=true;throw new Error()});assert.equal((await invalid(request(config.secret))).status,503);assert.equal(called,false);
 const token='fake-test-token-never-a-real-credential';const channel='123456789012345678';let botCalls=0;
 const handler=createHandler({...config,botToken:token,channelId:channel},async(url,options)=>{
  if(String(url).endsWith('rpc/claim_trade_discord'))return Response.json([{trade_id:1,claim_token:'lease',attempts:1}]);
  if(String(url).includes('trade_posts?'))return Response.json([{id:1,game_id:'blox-fruits',roblox_username:'Owner',give_items:[{id:'kitsune',qty:1}],want_items:[{id:'dough',qty:1}],status:'open'}]);
  if(String(url).startsWith('https://discord.com/')){botCalls++;assert(String(url).includes('/channels/'+channel+'/messages'));assert.equal(options.headers.Authorization,'Bot '+token);return Response.json({id:'12345'});}
  return Response.json(true);
 });
 assert.equal((await handler(request(config.secret))).status,200);assert.equal(botCalls,1);
});
