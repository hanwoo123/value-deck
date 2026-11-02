/* Shared trade storage. Anonymous Supabase identity controls ownership, not Roblox identity. */
window.ValueDeckTradeStore = (() => {
  const config = window.VALUE_DECK_SUPABASE;
  let client;
  let pendingIdentity;
  function getClient() {
    if (!config?.url || !config?.publishableKey || !window.supabase) throw new Error('거래 게시판 연결을 준비 중입니다.');
    return client ||= window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'value-deck-trade-session' },
    });
  }
  function failure(error) {
    if (['PGRST205','42P01','42883'].includes(error?.code)) return new Error('거래글 저장 공간을 준비 중입니다. 잠시 후 다시 확인해 주세요.');
    if (error?.code === 'anonymous_provider_disabled') return new Error('거래글 작성 연결을 준비 중입니다.');
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
    return {id:row.id,author:{id:row.owner_id,username:row.roblox_username},give:row.give_items,want:row.want_items,note:row.note,status:row.status,created:row.created_at};
  }
  async function list({mine=false,before=null}={}) {
    const c=getClient();
    let query=c.from('trade_posts').select('id,owner_id,roblox_username,give_items,want_items,note,status,created_at').order('id',{ascending:false}).limit(21);
    if (mine) query=query.eq('owner_id',(await identity()).id); else query=query.eq('status','open');
    if (before) query=query.lt('id',before);
    const {data,error}=await query;
    if (error) throw failure(error);
    const rows=data.slice(0,20);
    return {trades:rows.map(map),next:data.length>20 ? rows.at(-1).id : null};
  }
  async function create(input) {
    await identity();
    const {error}=await getClient().from('trade_posts').insert({roblox_username:input.username,give_items:input.give,want_items:input.want,note:input.note});
    if (error) throw failure(error);
  }
  async function complete(id) {
    const user=await identity();
    const {data,error}=await getClient().from('trade_posts').update({status:'completed'}).eq('id',id).eq('owner_id',user.id).eq('status','open').select('id');
    if (error) throw failure(error);
    if (data.length!==1) throw new Error('완료할 수 있는 거래글을 찾지 못했습니다. 작성한 브라우저에서 다시 확인해 주세요.');
  }
  return {current,identity,list,create,complete};
})();
