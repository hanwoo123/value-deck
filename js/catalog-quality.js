/* Shared eligibility rules for cards, calculators and trade pickers. */
window.ValueDeckCatalog = (() => {
  const hasPrice = (item, now=Date.now()) => typeof item?.value==='number' && Number.isFinite(item.value) && item.value>0 &&
    (item.priceValidUntil===undefined || (typeof item.priceValidUntil==='string' && Number.isFinite(Date.parse(item.priceValidUntil)) && Date.parse(item.priceValidUntil)>=now));
  const status = (item, now=Date.now()) => item?.priceValidUntil && (!Number.isFinite(Date.parse(item.priceValidUntil)) || Date.parse(item.priceValidUntil)<now) ? 'stale' :
    hasPrice(item,now) ? 'priced' : item?.priceQuotes?.some(q=>Number.isFinite(q.low)&&Number.isFinite(q.high)) ? 'range' : 'unpriced';
  const labels = {priced:'단일 목록 참고값',range:'범위 참고 · 합산 보류',unpriced:'가격 미확인 · 합산 보류',stale:'자료 기한 경과 · 합산 보류'};
  const label = item => labels[status(item)];
  const matches = (item,query) => [item.name,item.id,...(item.aliases||[])].some(s=>String(s||'').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const canRegister = (data,item) => Boolean(item) && data.tradeRegistration!=='pending' && item?.tradeReady!==false;
  const total = (slots,data,now=Date.now()) => slots.some(x=>!hasPrice(data.byId[x.id],now)) ? null : slots.reduce((n,x)=>n+data.byId[x.id].value*x.qty,0);
  function display(item,format,unit='') {
    const suffix=unit?' '+unit:'';
    if(hasPrice(item))return format(item.value)+suffix;
    const quote=item.priceQuotes?.find(q=>Number.isFinite(q.low)&&Number.isFinite(q.high));
    if(quote)return format(quote.low)+'–'+format(quote.high)+suffix+' · 합산 보류';
    return status(item)==='stale'?'자료 기한 경과':'가격 미확인';
  }
  return {hasPrice,status,label,matches,canRegister,total,display};
})();
