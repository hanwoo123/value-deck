import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { createHash } from 'node:crypto';

async function fixture(t, configured = true) {
  let claims={sub:'12345',preferred_username:'RealRobloxName',name:'Real Display'};
  const provider=[];
  const {server,db}=createApp({clientId:configured?'client':'',clientSecret:configured?'secret':'',fetchImpl:async(url,options)=>{
    provider.push({url,options});
    return {ok:true,json:async()=>url.endsWith('/token')?{access_token:'test-token'}:claims};
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
  const request=(p,options={})=>fetch(base+p,{redirect:'manual',...options});
  async function login(id='12345') {
    claims={...claims,sub:id,preferred_username:'user'+id};
    const start=await request('/auth/roblox');assert.equal(start.status,302);
    const target=new URL(start.headers.get('location'));
    assert.equal(target.origin,'https://apis.roblox.com');assert.equal(target.searchParams.get('code_challenge_method'),'S256');
    const oauthCookie=start.headers.getSetCookie()[0].split(';')[0];
    const callback='/auth/roblox/callback?code=code&state='+target.searchParams.get('state');
    assert.equal((await request(callback)).status,400);
    const done=await request(callback,{headers:{cookie:oauthCookie}});assert.equal(done.status,302);
    assert.equal((await request(callback,{headers:{cookie:oauthCookie}})).status,400);
    const cookie=done.headers.getSetCookie()[0].split(';')[0];
    const me=await(await request('/api/me',{headers:{cookie}})).json();
    return {cookie,me,post:(p,body={},extra={})=>request(p,{method:'POST',headers:{cookie,origin:'http://localhost:3000','content-type':'application/json','x-csrf-token':me.csrf,...extra},body:JSON.stringify(body)})};
  }
  return {request,login,provider,db};
}
const trade={give:[{id:'kitsune',qty:1}],want:[{id:'dough',qty:2}],note:'조건 협의'};

test('official OAuth state, PKCE, account identity; no passwords or tokens returned',async t=>{
 const f=await fixture(t);const a=await f.login();assert.equal(a.me.user.id,'12345');assert.equal(a.me.user.username,'user12345');assert(!JSON.stringify(a.me).includes('test-token'));
 const tokenRequest=new URLSearchParams(f.provider[0].options.body);assert(tokenRequest.get('code_verifier'));assert.equal(f.provider[1].options.headers.Authorization,'Bearer test-token');
});
test('authentication, CSRF, input validation, ownership, completion and logout',async t=>{
 const f=await fixture(t);assert.equal((await f.request('/api/trades',{method:'POST'})).status,401);
 const a=await f.login();assert.equal((await a.post('/api/trades',trade,{origin:'https://attacker.example'})).status,403);
 assert.equal((await a.post('/api/trades',trade,{'x-csrf-token':'wrong'})).status,403);
 for(const bad of [{...trade,give:[{id:'fake',qty:1}]},{...trade,give:[{id:'kitsune',qty:-1}]},{...trade,give:[{id:'kitsune',qty:1},{id:'kitsune',qty:2}]},{...trade,note:'x'.repeat(201)}])assert.equal((await a.post('/api/trades',bad)).status,400);
 const created=await a.post('/api/trades',{...trade,author:{id:'999',username:'Imposter'}});assert.equal(created.status,201);const {id}=await created.json();
 const list=await(await f.request('/api/trades')).json();assert.equal(list.trades[0].author.id,'12345');assert.equal(list.trades[0].author.username,'user12345');
 assert.equal((await a.post('/api/trades',trade)).status,429);
 const b=await f.login('67890');assert.equal((await b.post(`/api/trades/${id}/complete`)).status,404);
 assert.equal((await a.post(`/api/trades/${id}/complete`)).status,200);
 assert.equal((await(await f.request('/api/trades')).json()).trades.length,0);
 const mine=await(await f.request('/api/trades?mine=1',{headers:{cookie:a.cookie}})).json();assert.equal(mine.trades[0].status,'completed');
 assert.equal((await a.post('/api/logout')).status,200);assert.equal((await a.post('/api/trades',trade)).status,401);
});
test('unconfigured login and private filesystem are not exposed',async t=>{
 const f=await fixture(t,false);assert.equal((await f.request('/auth/roblox')).status,503);
 for(const p of ['/server/app.mjs','/.git/config','/.env','/var/trades.sqlite'])assert.equal((await f.request(p)).status,404);
 assert.equal((await f.request('/')).status,200);assert.equal((await f.request('/js/trades.js')).status,200);
});
