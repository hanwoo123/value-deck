/* Shared trade storage. Anonymous Supabase identity controls ownership, not Roblox identity. */
window.ValueDeckTradeStore = (() => {
  const config = window.VALUE_DECK_SUPABASE;
  let client;
  let pendingIdentity;
  let supportsGames=null;
  const missingGame=e=>['42703','PGRST204'].includes(e?.code)&&String(e.message).includes('game_id');
  function getClient() {
    if (!config?.url || !config?.publishableKey || !window.supabase) throw new Error('거래 게시판 연결을 준비 중입니다.');
    return client ||= window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'value-deck-trade-session' },
    });
  }
  function failure(error) {
    if (error?.code==='PGRST202') return new Error('채팅 기능을 준비 중입니다. 잠시 후 다시 확인해 주세요.');
    if (['PGRST205','42P01','42883'].includes(error?.code)) return new Error('거래글 저장 공간을 준비 중입니다. 잠시 후 다시 확인해 주세요.');
    if (error?.code === 'anonymous_provider_disabled') return new Error('거래글 작성 연결을 준비 중입니다.');
    if (error?.code === '23503') return new Error('거래글 또는 대화의 보존 기간이 끝났습니다. 목록을 새로고침해 주세요.');
    if (error?.code === 'P0001') return new Error(error.message);
    return new Error('거래 게시판에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  async function identity() {
    if (pendingIdentity) return pendingIdentity;
    pendingIdentity = (async () => {
      const c = getClient();
      const {data, error} = await c.auth.getSession();
      if (error) throw failure(error);
      if (data.session) return data.session.user;
      const signed = await c.auth.signInAnonymously();
      if (signed.error) throw failure(signed.error);
      return signed.data.user;
    })();
    try { return await pendingIdentity; } finally { pendingIdentity = null; }
  }
  async function current() {
    const {data,error}=await getClient().auth.getSession();
    if (error) throw failure(error);
    return data.session?.user || null;
  }
  function map(row) {
    const deadline=Date.parse(row.created_at)+6*60*60*1000;
    const expired=(row.status==='open'&&deadline<=Date.now())||(row.status==='completed'&&Math.abs(Date.parse(row.completed_at)-deadline)<1000);
    return {id:row.id,expired,closedAt:row.completed_at,author:{id:row.owner_id,username:row.roblox_username},give:row.give_items,want:row.want_items,note:row.note,status:expired?'completed':row.status,created:row.created_at,gameId:row.game_id||'blox-fruits'};
  }
  async function list({gameId='blox-fruits',mine=false,before=null}={}) {
    const c=getClient();
    const user=mine?await identity():null;
    async function query(withGame){
      let q=c.from('trade_posts').select('id,owner_id,roblox_username,give_items,want_items,note,status,created_at,completed_at'+(withGame?',game_id':'')).order('id',{ascending:false}).limit(21);
      if(withGame)q=q.eq('game_id',gameId);
      if(mine)q=q.eq('owner_id',user.id);else q=q.eq('status','open').gt('created_at',new Date(Date.now()-6*60*60*1000).toISOString());
      if(before)q=q.lt('id',before);
      return await q;
    }
    if(supportsGames===false&&gameId!=='blox-fruits')throw new Error('이 게임의 거래 연결을 준비 중입니다. 잠시 후 새로고침해 주세요.');
    let result=await query(supportsGames!==false);
    if(missingGame(result.error)){
      supportsGames=false;
      if(gameId!=='blox-fruits')throw new Error('이 게임의 거래 연결을 준비 중입니다. 잠시 후 새로고침해 주세요.');
      result=await query(false);
    }else if(!result.error&&supportsGames!==false)supportsGames=true;
    if(result.error)throw failure(result.error);
    const rows=result.data.slice(0,20);
    return {trades:rows.map(map),next:result.data.length>20?rows.at(-1).id:null};
  }
  async function create(input) {
    await identity();const gameId=input.gameId||'blox-fruits';
    const body={roblox_username:input.username,give_items:input.give,want_items:input.want,note:input.note};
    if(supportsGames===false&&gameId!=='blox-fruits')throw new Error('이 게임의 거래 연결을 준비 중입니다. 잠시 후 새로고침해 주세요.');
    let result=await getClient().from('trade_posts').insert(supportsGames===false?body:{...body,game_id:gameId});
    if(missingGame(result.error)&&gameId==='blox-fruits'){supportsGames=false;result=await getClient().from('trade_posts').insert(body);}
    if(result.error)throw failure(result.error);
  }
  async function complete(id) {
    const user=await identity();
    const {data,error}=await getClient().from('trade_posts').update({status:'completed'}).eq('id',id).eq('owner_id',user.id).eq('status','open').select('id');
    if (error) throw failure(error);
    if (data.length!==1) throw new Error('완료할 수 있는 거래글을 찾지 못했습니다. 작성한 브라우저에서 다시 확인해 주세요.');
  }
  async function conversations({before=null}={}) {
    if (!(await current())) return {rooms:[],next:null};
    let q=getClient().from('trade_conversations').select('*').order('id',{ascending:false}).limit(31);
    if(before) q=q.lt('id',before);
    const {data,error}=await q;
    if(error) throw failure(error);
    return {rooms:data.slice(0,30),next:data.length>30?data[29].id:null};
  }
  async function startChat(tradeId,username) {
    await identity();
    const {data,error}=await getClient().rpc('start_trade_chat',{p_trade_id:Number(tradeId),p_username:username});
    if(error) throw failure(error);
    const room=await getClient().from('trade_conversations').select('*').eq('id',data).single();
    if(room.error) throw failure(room.error);
    return room.data;
  }
  async function messages(conversationId,{after=null,before=null}={}) {
    let q=getClient().from('trade_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id',conversationId).order('id',{ascending:Boolean(after)}).limit(50);
    if(after) q=q.gt('id',after);
    if(before) q=q.lt('id',before);
    const {data,error}=await q;
    if(error) throw failure(error);
    return after ? data : data.reverse();
  }
  async function send(conversationId,body) {
    await identity();
    const {error}=await getClient().from('trade_messages').insert({conversation_id:conversationId,body});
    if(error) throw failure(error);
  }
  return {current,identity,list,create,complete,conversations,startChat,messages,send};
})();
