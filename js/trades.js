/* Game-specific trades with self-set Roblox names and anonymous Supabase ownership. */
window.ValueDeckTrades = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store=window.ValueDeckTradeStore;
  const nicknameKey='value-deck-roblox-username';
  let identity;
  let renderVersion=0;
  let expiryTimer=null;
  const cleanup=()=>{clearTimeout(expiryTimer);expiryTimer=null;};
  async function render(main,catalogs,requestedGame='blox-fruits') {
    cleanup();
    const version=++renderVersion,hash=location.hash;
    const active=()=>version===renderVersion&&hash===location.hash;
    const gameId=catalogs[requestedGame]?requestedGame:'blox-fruits';
    const data=catalogs[gameId];
    main.innerHTML='<div class="loading" role="status">거래 게시판을 불러오는 중…</div>';
    let username='';
    try { username=localStorage.getItem(nicknameKey)||''; } catch {}
    try { identity=await store.current(); } catch { identity=null; }
    if (!active()||!location.hash.startsWith('#/trades')) return;
    const row=()=>`<div class="trade-slot" data-item-id=""><button type="button" class="btn trade-slot-choice" data-pick-slot>+ 아이템 선택</button><input class="input" type="number" min="1" max="99" value="1" aria-label="수량" required><button class="iconbtn" type="button" data-remove aria-label="아이템 삭제">×</button></div>`;
    main.innerHTML=`<div class="pagehead"><div><div class="eyebrow">TRADE BOARD</div><h1>${esc(data.name)} 거래 게시판</h1><p>거래 상대를 찾고, 실제 아이템 교환은 게임 안에서 진행하세요.</p></div><div id="trade-account"><form id="trade-nickname"><label for="trade-username">내 Roblox 사용자 이름</label><div class="trade-nickname-input"><span aria-hidden="true">@</span><input class="input" id="trade-username" name="username" value="${esc(username)}" placeholder="표시 이름 대신 @사용자 이름" pattern="[A-Za-z0-9_]{3,20}" minlength="3" maxlength="20" required autocomplete="off"><button class="btn" type="submit">닉네임 저장</button></div></form></div></div>
      <p class="muted">닉네임은 사용자가 직접 입력하며 계정 소유 인증은 하지 않습니다. 실제 아이템 교환은 게임 안에서 진행하세요.</p>
      <p class="muted">내 거래글 관리는 이 브라우저에 연결됩니다. 브라우저 데이터를 지우거나 다른 기기로 접속하면 작성 권한을 되찾기 어려울 수 있습니다.</p>
      <p class="muted">거래글은 등록 6시간 후 자동 마감되며, 마감 후 7일이 지나면 거래글과 연결된 채팅이 삭제됩니다.</p>
      <label class="trade-game-label" for="trade-game">거래할 게임</label><select id="trade-game" class="select">${Object.entries(catalogs).map(([id,game])=>`<option value="${esc(id)}" ${id===gameId?'selected':''}>${esc(game.name)}</option>`).join('')}</select>
      <p id="trade-message" role="status" aria-live="polite"></p>
      <details class="trade-compose"><summary class="btn">+ 거래글 작성</summary><form id="trade-form"><div class="trade-sides">${[['give','내가 주는 아이템'],['want','받고 싶은 아이템']].map(([key,label])=>`<section><h2>${label}</h2><div data-slots="${key}">${row()}</div><button class="btn" type="button" data-add-slot="${key}">아이템 추가</button></section>`).join('')}</div><label>메모 (선택, 200자 이내)<textarea class="input" name="note" maxlength="200" rows="2" placeholder="거래 조건을 적어 주세요"></textarea></label><button class="btn btn--accent" type="submit">거래글 등록</button></form></details>
      <div class="toolbar"><button class="btn" data-list="all" aria-pressed="true">진행 중인 거래</button><button class="btn" data-list="mine" aria-pressed="false">내 거래글</button><button class="btn" id="trade-refresh">새로고침</button><button class="btn btn--accent" id="trade-inbox">내 채팅</button></div><div id="trade-list" class="trade-list"></div><button class="btn" id="trade-more" hidden>더 보기</button>`;
    const message=main.querySelector('#trade-message');
    main.querySelector('#trade-game').onchange=e=>{location.hash='#/trades/'+e.target.value;};
    const picker=window.ValueDeckTradePicker.mount(main,data);
    let mine=false, next=null, loading=false, visibleDeadlines=[];
    const compact=n=>new Intl.NumberFormat('ko-KR',{notation:n>=1e6?'compact':'standard',maximumFractionDigits:1}).format(n);
    const hasPrice=item=>typeof item?.value==='number'&&Number.isFinite(item.value)&&item.value>0;
    const total=slots=>slots.some(x=>!hasPrice(data.byId[x.id]))?'점수 미정':compact(slots.reduce((sum,x)=>sum+data.byId[x.id].value*x.qty,0));
    const slotsHTML=slots=>slots.map(x=>{
      const item=data.byId[x.id];
      return `<li class="trade-item"><div class="trade-item-image"><span aria-hidden="true">${esc((item?.name||x.id).slice(0,1))}</span>${item?.image?`<img src="${esc(item.image)}" alt="" loading="lazy" onerror="this.hidden=true">`:''}<strong class="trade-item-qty">×${x.qty}</strong></div><div class="trade-item-info"><strong>${esc(item?.name||x.id)}</strong><span>${esc(item?.category||'아이템')}</span><span class="trade-item-value">${hasPrice(item)?compact(item.value*x.qty):'점수 미정'}</span></div></li>`;
    }).join('');
    const chat=window.ValueDeckTradeChat.mount(main,data,()=>username);
    main.querySelector('#trade-inbox').onclick=()=>chat.open();
    async function list(append=false) {
      if (loading) return;
      loading=true;message.textContent='불러오는 중…';
      try {
        const result=await store.list({gameId,mine,before:append?next:null});
        identity=await store.current();
        if(!active())return false;
        const html=result.trades.map(t=>`<article class="trade-card"><div class="trade-heading"><a href="https://www.roblox.com/users/profile?username=${encodeURIComponent(t.author.username)}" target="_blank" rel="noopener noreferrer"><strong>@${esc(t.author.username)}</strong></a><span><span class="trade-status ${t.status==='completed'?'trade-status--done':''}">${t.status==='completed'?(t.expired?'자동 마감':'거래 완료'):'거래 중'}</span> · ${esc(new Date(t.created).toLocaleDateString('ko-KR'))}</span></div><div class="trade-sides"><section><h3>주는 아이템</h3><ul class="trade-item-grid">${slotsHTML(t.give)}</ul><div class="trade-total">임시 점수 합계 <strong>${total(t.give)}</strong></div></section><section><h3>받고 싶은 아이템</h3><ul class="trade-item-grid">${slotsHTML(t.want)}</ul><div class="trade-total">임시 점수 합계 <strong>${total(t.want)}</strong></div></section></div>${t.note?`<p class="trade-note">${esc(t.note)}</p>`:''}<div class="trade-actions">${identity?.id===t.author.id?`<button class="btn" data-inquiries="${t.id}">받은 문의</button>`:t.status==='open'?`<button class="btn btn--accent" data-chat="${t.id}">1:1 채팅</button>`:''}${identity?.id===t.author.id&&t.status==='open'?`<button class="btn" data-complete="${t.id}">거래 완료로 표시</button>`:''}</div></article>`).join('');
        const target=main.querySelector('#trade-list');
        if (append) target.insertAdjacentHTML('beforeend',html);else target.innerHTML=html||'<div class="empty">아직 거래글이 없습니다.</div>';
        next=result.next;main.querySelector('#trade-more').hidden=!next;message.textContent='';
        cleanup();
        const deadlines=result.trades.filter(t=>t.status==='open').map(t=>Date.parse(t.created)+6*60*60*1000).filter(Number.isFinite);
        visibleDeadlines=append?visibleDeadlines.concat(deadlines):deadlines;
        if(visibleDeadlines.length)expiryTimer=setTimeout(()=>{if(active())list();},Math.min(6*60*60*1000,Math.max(100,Math.min(...visibleDeadlines)-Date.now()+100)));
        return true;
      } catch(e){ message.textContent=e.message;return false; } finally { loading=false; }
    }
    main.querySelector('#trade-refresh').onclick=()=>list();
    main.querySelector('#trade-more').onclick=()=>list(true);
    main.querySelectorAll('[data-list]').forEach(b=>b.onclick=()=>{if(loading)return;mine=b.dataset.list==='mine';main.querySelectorAll('[data-list]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));list();});
    main.querySelector('#trade-nickname').addEventListener('submit',e=>{
      e.preventDefault();
      const value=e.target.elements.username.value.trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(value)) { message.textContent='Roblox @사용자 이름을 영문·숫자·밑줄 3~20자로 입력해 주세요.'; return; }
      try { localStorage.setItem(nicknameKey,value);username=value;message.textContent='닉네임을 저장했습니다.'; }
      catch { message.textContent='브라우저 저장 공간을 사용할 수 없습니다. 저장 허용 후 다시 시도해 주세요.'; }
    });
    main.querySelectorAll('[data-add-slot]').forEach(b=>b.onclick=()=>{const parent=main.querySelector(`[data-slots="${b.dataset.addSlot}"]`);if(parent.children.length<8)parent.insertAdjacentHTML('beforeend',row());});
    main.querySelector('#trade-form').addEventListener('click',e=>{
      const remove=e.target.closest('[data-remove]');if(remove&&remove.parentElement.parentElement.children.length>1){remove.parentElement.remove();return;}
      const button=e.target.closest('[data-pick-slot]');if(!button)return;
      const slot=button.closest('.trade-slot');
      const selected=[...slot.parentElement.children].filter(r=>r!==slot).map(r=>r.dataset.itemId).filter(Boolean);
      picker.open({title:slot.parentElement.dataset.slots==='give'?'내가 주는 아이템 선택':'받고 싶은 아이템 선택',selected,onChoose:item=>{
        slot.dataset.itemId=item.id;
        button.innerHTML=`${item.image?`<img src="${esc(item.image)}" alt="" onerror="this.hidden=true">`:''}<span><strong>${esc(item.name)}</strong><small>${esc(item.category)}</small></span>`;
        button.setAttribute('aria-label',item.name+' 아이템 변경');
      }});
    });
    main.querySelector('#trade-form')?.addEventListener('submit',async e=>{
      e.preventDefault();const button=e.target.querySelector('[type="submit"]');button.disabled=true;
      const slots=side=>[...main.querySelector(`[data-slots="${side}"]`).children].map(r=>({id:r.dataset.itemId,qty:Number(r.querySelector('input').value)}));
      try{if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error('위에서 내 Roblox 사용자 이름을 먼저 저장해 주세요.');if([...main.querySelectorAll('.trade-slot')].some(r=>!r.dataset.itemId))throw new Error('양쪽의 아이템을 선택해 주세요.');await store.create({gameId,username,give:slots('give'),want:slots('want'),note:e.target.elements.note.value});if(!active())return;const refreshed=await list();e.target.reset();main.querySelectorAll('[data-slots]').forEach(p=>p.innerHTML=row());main.querySelector('details').open=false;message.textContent=refreshed?'거래글을 등록했습니다.':'거래글은 등록됐지만 목록을 불러오지 못했습니다. 새로고침해 주세요.';}catch(error){message.textContent=error.message;}finally{button.disabled=false;}
    });
    main.querySelector('#trade-list').onclick=async e=>{
      const complete=e.target.closest('[data-complete]'),start=e.target.closest('[data-chat]'),inquiries=e.target.closest('[data-inquiries]');
      const button=complete||start||inquiries;if(!button)return;button.disabled=true;
      try{if(complete){await store.complete(complete.dataset.complete);await list();}else if(start){await chat.start(start.dataset.chat);}else{await chat.open({tradeId:inquiries.dataset.inquiries});}}
      catch(error){message.textContent=error.message;}finally{button.disabled=false;}
    };
    await list();
  }
  return {render,cleanup};
})();
