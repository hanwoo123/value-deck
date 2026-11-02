/* Roblox-authenticated Blox Fruits trade board. Identity is supplied by the server. */
window.ValueDeckTrades = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let identity;
  async function api(url, options = {}) {
    const res = await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.method ? {'X-CSRF-Token':identity?.csrf || ''} : {})},cache:'no-store'});
    const data = await res.json().catch(()=>({error:'거래 게시판에 연결하지 못했습니다.'}));
    if (!res.ok) throw new Error(data.error || '요청에 실패했습니다.');
    return data;
  }
  async function render(main, data) {
    main.innerHTML='<div class="loading" role="status">거래 게시판을 불러오는 중…</div>';
    try { identity=await api('/api/me'); } catch {
      main.innerHTML='<div class="pagehead"><h1>블록스 프루츠 거래 게시판</h1></div><div class="empty"><p>거래 게시판을 준비 중입니다.</p><p class="muted">로그인 연결이 완료되면 이곳에서 거래글을 올릴 수 있어요.</p></div>'; return;
    }
    if (location.hash !== '#/trades') return;
    const options=data.items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)} · ${esc(i.category)}</option>`).join('');
    const row=()=>`<div class="trade-slot"><select class="select" aria-label="아이템 선택">${options}</select><input class="input" type="number" min="1" max="99" value="1" aria-label="수량" required><button class="iconbtn" type="button" data-remove aria-label="아이템 삭제">×</button></div>`;
    main.innerHTML=`<div class="pagehead"><div><div class="eyebrow">Blox Fruits Trading</div><h1>블록스 프루츠 거래 게시판</h1><p>거래 상대를 찾고, 실제 아이템 교환은 게임 안에서 진행하세요.</p></div><div id="trade-account">${identity.user ? `<span>${esc(identity.user.displayName)} <strong>@${esc(identity.user.username)}</strong></span> <button class="btn" id="trade-logout">로그아웃</button>` : identity.loginAvailable ? '<a class="btn btn--accent" href="/auth/roblox">Roblox로 로그인</a>' : '<span class="muted">Roblox 로그인 연결을 준비 중입니다.</span>'}</div></div>
      <p class="muted">인증된 Roblox 계정으로 글을 작성합니다. 외부 결제나 비밀번호 요청에 응하지 마세요.</p>
      <p id="trade-message" role="status" aria-live="polite"></p>
      ${identity.user ? `<details class="trade-compose"><summary class="btn">+ 거래글 작성</summary><form id="trade-form"><div class="trade-sides">${[['give','내가 주는 아이템'],['want','받고 싶은 아이템']].map(([key,label])=>`<section><h2>${label}</h2><div data-slots="${key}">${row()}</div><button class="btn" type="button" data-add-slot="${key}">아이템 추가</button></section>`).join('')}</div><label>메모 (선택, 200자 이내)<textarea class="input" name="note" maxlength="200" rows="2" placeholder="거래 조건을 적어 주세요"></textarea></label><button class="btn btn--accent" type="submit">거래글 등록</button></form></details>` : ''}
      <div class="toolbar"><button class="btn" data-list="all" aria-pressed="true">진행 중인 거래</button>${identity.user ? '<button class="btn" data-list="mine" aria-pressed="false">내 거래글</button>' : ''}<button class="btn" id="trade-refresh">새로고침</button></div><div id="trade-list" class="trade-list"></div><button class="btn" id="trade-more" hidden>더 보기</button>`;
    const message=main.querySelector('#trade-message');
    let mine=false, next=null, loading=false;
    const slotsHTML=slots=>slots.map(x=>`<li>${esc(data.byId[x.id]?.name || x.id)} <strong>× ${x.qty}</strong></li>`).join('');
    async function list(append=false) {
      if (loading) return;
      loading=true;message.textContent='불러오는 중…';
      try {
        const result=await api('/api/trades?mine='+(mine?'1':'0')+(append&&next?'&before='+next:''));
        const html=result.trades.map(t=>`<article class="trade-card"><div class="trade-heading"><a href="https://www.roblox.com/users/${encodeURIComponent(t.author.id)}/profile" target="_blank" rel="noopener noreferrer">${esc(t.author.displayName)} <strong>@${esc(t.author.username)}</strong></a><span>${t.status==='completed'?'거래 완료':'거래 중'} · ${esc(new Date(t.created*1000).toLocaleDateString('ko-KR'))}</span></div><div class="trade-sides"><section><h3>주는 아이템</h3><ul>${slotsHTML(t.give)}</ul></section><section><h3>받고 싶은 아이템</h3><ul>${slotsHTML(t.want)}</ul></section></div>${t.note?`<p class="trade-note">${esc(t.note)}</p>`:''}${identity.user?.id===t.author.id&&t.status==='open'?`<button class="btn" data-complete="${t.id}">거래 완료로 표시</button>`:''}</article>`).join('');
        const target=main.querySelector('#trade-list');
        if (append) target.insertAdjacentHTML('beforeend',html);else target.innerHTML=html||'<div class="empty">아직 거래글이 없습니다.</div>';
        next=result.next;main.querySelector('#trade-more').hidden=!next;message.textContent='';
      } catch(e){ message.textContent=e.message; } finally { loading=false; }
    }
    main.querySelector('#trade-refresh').onclick=()=>list();
    main.querySelector('#trade-more').onclick=()=>list(true);
    main.querySelectorAll('[data-list]').forEach(b=>b.onclick=()=>{if(loading)return;mine=b.dataset.list==='mine';main.querySelectorAll('[data-list]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));list();});
    main.querySelector('#trade-logout')?.addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST',body:'{}'});await render(main,data);}catch(e){message.textContent=e.message;}});
    main.querySelectorAll('[data-add-slot]').forEach(b=>b.onclick=()=>{const parent=main.querySelector(`[data-slots="${b.dataset.addSlot}"]`);if(parent.children.length<8)parent.insertAdjacentHTML('beforeend',row());});
    main.querySelector('#trade-form')?.addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(b&&b.parentElement.parentElement.children.length>1)b.parentElement.remove();});
    main.querySelector('#trade-form')?.addEventListener('submit',async e=>{
      e.preventDefault();const button=e.target.querySelector('[type="submit"]');button.disabled=true;
      const slots=side=>[...main.querySelector(`[data-slots="${side}"]`).children].map(r=>({id:r.querySelector('select').value,qty:Number(r.querySelector('input').value)}));
      try{await api('/api/trades',{method:'POST',body:JSON.stringify({give:slots('give'),want:slots('want'),note:e.target.elements.note.value})});await list();e.target.reset();main.querySelector('details').open=false;message.textContent='거래글을 등록했습니다.';}catch(error){message.textContent=error.message;}finally{button.disabled=false;}
    });
    main.querySelector('#trade-list').onclick=async e=>{const b=e.target.closest('[data-complete]');if(!b)return;b.disabled=true;try{await api(`/api/trades/${b.dataset.complete}/complete`,{method:'POST',body:'{}'});await list();}catch(error){message.textContent=error.message;b.disabled=false;}};
    await list();
  }
  return {render};
})();
