import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('single-file dashboard bundle runs without imports and still verifies shared secret',async()=>{
 const code=readFileSync(new URL('../supabase/trade-discord-dashboard.js',import.meta.url),'utf8');
 const env={TRADE_WEBHOOK_SECRET:'fake-shared-secret-for-testing-123456789',DISCORD_BOT_TOKEN:'fake-bot-token-only-for-testing',DISCORD_CHANNEL_ID:'123456789012345678',SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-service-key'};
 let handler,calls=0;
 vm.runInNewContext(code,{Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},crypto:globalThis.crypto,Request,Response,TextEncoder,AbortSignal,URL,fetch:async url=>{calls++;assert(String(url).endsWith('rpc/claim_trade_discord'));return Response.json([]);}});
 assert.equal(typeof handler,'function');
 const request=secret=>new Request('https://test.supabase.co/functions/v1/trade-discord',{method:'POST',headers:{'x-trade-webhook-secret':secret}});
 assert.equal((await handler(request('wrong'))).status,401);assert.equal(calls,0);
 const result=await handler(request(env.TRADE_WEBHOOK_SECRET));assert.equal(result.status,200);assert.deepEqual(await result.json(),{sent:0,retry:0,skipped:0});assert.equal(calls,1);
});
