import catalog from './catalog.json' with {type:'json'};
const names={'blox-fruits':'블록스 프루츠','cameraman-td':'카메라맨 타워 디펜스','king-legacy':'킹피스 (King Legacy)'};
const escape=s=>String(s).replace(/[\\`*_{}\[\]()<>|~]/g,'\\$&');
export function formatTrade(post){
  if(!names[post.game_id]||!Number.isSafeInteger(Number(post.id))||Number(post.id)<1||!/^[A-Za-z0-9_]{3,20}$/.test(post.roblox_username))throw new Error('invalid_trade');
  const game=catalog[post.game_id];
  function slots(list){
    if(!Array.isArray(list)||!list.length||list.length>8)throw new Error('invalid_slots');
    return list.map(x=>{if(!game[x.id]||!Number.isInteger(x.qty)||x.qty<1||x.qty>99)throw new Error('invalid_item');return `${escape(game[x.id].name)} × ${x.qty}`;}).join('\n');
  }
  const url=`https://bloxdecks.com/#/trades/${post.game_id}`;
  const embed={title:`새 거래글 #${post.id} · ${names[post.game_id]}`,url,color:post.game_id==='blox-fruits'?0x3da5ff:post.game_id==='king-legacy'?0xf5be55:0xff4d6d,
    description:`작성자 **@${escape(post.roblox_username)}**`,fields:[{name:'주는 아이템',value:slots(post.give_items),inline:true},{name:'받고 싶은 아이템',value:slots(post.want_items),inline:true}],
    footer:{text:'닉네임은 사용자가 직접 입력합니다. 실제 교환은 게임 안에서 진행하세요.'}};
  if(typeof post.note==='string'&&post.note.trim())embed.fields.push({name:'메모',value:escape(post.note.slice(0,200)),inline:false});
  const image=game[post.give_items[0].id]?.image;
  if(image&&/^images\/[\w/-]+\.\w+$/.test(image))embed.thumbnail={url:'https://bloxdecks.com/'+image};
  if(Number.isFinite(Date.parse(post.created_at)))embed.timestamp=new Date(post.created_at).toISOString();
  return {allowed_mentions:{parse:[]},embeds:[embed]};
}
export function discordDestination(value){
  const url=new URL(value);
  if(url.origin!=='https://discord.com'||url.username||url.password||!/^\/api\/webhooks\/\d+\/[\w-]+$/.test(url.pathname))throw new Error('invalid_discord_webhook');
  url.search='?wait=true';url.hash='';return url.href;
}
async function deliver(post,url,headers,fetchImpl){
  const payload=formatTrade(post);
  try{
    const r=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
    if(!r.ok){
      let delay=60;
      if(r.status===429){const body=await r.json().catch(()=>({}));delay=Math.ceil(Number(body.retry_after)||Number(r.headers.get('retry-after'))||60);}
      return {outcome:'retry',error:'discord_http_'+r.status,retrySeconds:Math.max(1,Math.min(delay,3600))};
    }
    const body=await r.json().catch(()=>null);
    if(!/^\d+$/.test(body?.id||''))return {outcome:'retry',error:'discord_unconfirmed',retrySeconds:60};
    return {outcome:'sent',messageId:body.id};
  }catch{return {outcome:'retry',error:'discord_network_error',retrySeconds:60};}
}

export async function sendTrade(post,webhook,fetchImpl=fetch){
  return deliver(post,discordDestination(webhook),{},fetchImpl);
}
export function botDestination(channelId){
  if(typeof channelId!=='string'||!/^\d{17,22}$/.test(channelId))throw new Error('invalid_discord_channel');
  return 'https://discord.com/api/v10/channels/'+channelId+'/messages';
}
export async function sendTradeBot(post,token,channelId,fetchImpl=fetch){
  if(typeof token!=='string'||token.length<20||/[\r\n]/.test(token))throw new Error('invalid_bot_config');
  return deliver(post,botDestination(channelId),{Authorization:'Bot '+token},fetchImpl);
}
