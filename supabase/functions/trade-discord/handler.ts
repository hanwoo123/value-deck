import {discordDestination,sendTrade,sendTradeBot,botDestination} from './format.mjs';

const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function equalSecret(a:string,b:string){
  const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [x,y]=await Promise.all([digest(a),digest(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
export function createHandler(config:{secret:string;webhook:string;project:string;key:string;botToken?:string;channelId?:string},fetcher:typeof fetch=fetch){
return async(req:Request)=>{
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  const secret=config.secret;
  if(secret.length<32)return reply(503,{error:'notification_not_configured'});
  if(!await equalSecret(req.headers.get('x-trade-webhook-secret')||'',secret))return reply(401,{error:'unauthorized'});
  const webhook=config.webhook;
  const project=config.project;
  const key=config.key;
  const botMode=Boolean(config.botToken||config.channelId);
  try{if(botMode){botDestination(config.channelId);if(!config.botToken||config.botToken.length<20||/[\r\n]/.test(config.botToken))throw new Error();}else discordDestination(webhook);if(!project.startsWith('https://')||!key)throw new Error();}catch{return reply(503,{error:'notification_not_configured'});}
  const headers={'apikey':key,'Authorization':`Bearer ${key}`,'Content-Type':'application/json'};
  async function db(path:string,body?:unknown){
    const r=await fetcher(project+'/rest/v1/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error('database_request_failed');return r.json();
  }
  try{
    const jobs=await db('rpc/claim_trade_discord',{p_limit:5});
    let sent=0,retry=0,skipped=0;
    for(const job of jobs){
      const rows=await db('trade_posts?select=id,game_id,roblox_username,give_items,want_items,note,status,created_at&id=eq.'+encodeURIComponent(job.trade_id));
      const post=rows[0];
      let result: {outcome:string;messageId?:string;error?:string;retrySeconds?:number};
      if(!post||post.status!=='open'){result={outcome:'skipped'};skipped++;}
      else{try{result=botMode?await sendTradeBot(post,config.botToken,config.channelId,fetcher):await sendTrade(post,webhook,fetcher);}catch{result={outcome:'retry',error:'invalid_trade_data',retrySeconds:3600};}if(result.outcome==='sent')sent++;else retry++;}
      const acknowledged=await db('rpc/finish_trade_discord',{p_trade_id:job.trade_id,p_claim_token:job.claim_token,p_outcome:result.outcome,p_message_id:result.messageId||null,p_error:result.error||null,p_retry_seconds:Math.max(result.retrySeconds||60,Math.min(3600,30*2**Math.min(job.attempts,6)))});
      if(!acknowledged)throw new Error('delivery_ack_failed');
    }
    return reply(200,{sent,retry,skipped});
  }catch{return reply(503,{error:'notification_processing_failed'});}
};
}
