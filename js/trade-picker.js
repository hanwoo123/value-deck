/* Searchable, category-grouped item picker shared by both trade games. */
window.ValueDeckTradePicker=(()=>{
  let dispose=()=>{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(main,data){
    dispose();const dialog=document.createElement('dialog');dialog.className='trade-picker';dialog.setAttribute('aria-labelledby','trade-picker-title');
    const categories=[...new Set(data.items.map(i=>i.category||'기타'))];
    dialog.innerHTML=`<div class="chat-header"><h2 id="trade-picker-title">아이템 선택</h2><button type="button" class="iconbtn" data-close aria-label="아이템 선택 닫기">×</button></div><input id="trade-picker-search" class="input" type="search" placeholder="아이템 이름 검색" aria-label="아이템 이름 검색" autocomplete="off"><div class="trade-picker-categories" role="group" aria-label="아이템 카테고리">${['전체',...categories].map(c=>`<button type="button" class="chip" data-category="${esc(c)}" aria-pressed="${c==='전체'}">${esc(c)}</button>`).join('')}</div><p id="trade-picker-count" class="muted" role="status"></p><div id="trade-picker-results"></div>`;
    main.appendChild(dialog);let category='전체',choose,blocked=new Set();
    const search=dialog.querySelector('#trade-picker-search'),results=dialog.querySelector('#trade-picker-results');
    function draw(){
      const q=search.value.trim().toLocaleLowerCase();const items=data.items.filter(i=>(category==='전체'||(i.category||'기타')===category)&&(!q||(i.name+' '+i.id).toLocaleLowerCase().includes(q)));
      dialog.querySelector('#trade-picker-count').textContent=items.length+'개 아이템';
      results.innerHTML=items.length?categories.map(c=>{const group=items.filter(i=>(i.category||'기타')===c);return !group.length?'':`<section><h3>${esc(c)}</h3><div class="trade-picker-grid">${group.map(i=>`<button type="button" class="trade-pick" data-item="${esc(i.id)}" ${blocked.has(i.id)?'disabled':''}><span class="trade-pick-image">${i.image?`<img src="${esc(i.image)}" alt="" loading="lazy" onerror="this.hidden=true">`:esc(i.name.slice(0,1))}</span><strong>${esc(i.name)}</strong><span>${blocked.has(i.id)?'이미 선택됨':i.value===null?(['comparison','reference'].includes(data.pricingMode)?'비교 자료 부족':'점수 미정'):Number(i.value).toLocaleString('ko-KR')}</span></button>`).join('')}</div></section>`;}).join(''):'<div class="empty">검색 결과가 없습니다.</div>';
    }
    search.oninput=draw;
    dialog.querySelector('.trade-picker-categories').onclick=e=>{const b=e.target.closest('[data-category]');if(!b)return;category=b.dataset.category;dialog.querySelectorAll('[data-category]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw();};
    results.onclick=e=>{const b=e.target.closest('[data-item]');if(!b||b.disabled)return;choose(data.byId[b.dataset.item]);dialog.close();};
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dispose=()=>dialog.remove();
    return {open({onChoose,selected=[],title='아이템 선택'}){choose=onChoose;blocked=new Set(selected);category='전체';search.value='';dialog.querySelector('#trade-picker-title').textContent=title;dialog.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category==='전체')));draw();dialog.showModal();search.focus();}};
  }
  return {mount,destroy:()=>dispose()};
})();
