/* Private trade chat: Supabase RLS enforces the two participants on every request. */
window.ValueDeckTradeChat=(()=>{
  let dispose=()=>{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(main,data,getUsername){
    dispose();
    const store=window.ValueDeckTradeStore;
    const dialog=document.createElement('dialog');dialog.className='trade-chat';dialog.setAttribute('aria-labelledby','chat-title');
    dialog.innerHTML=`<div class="chat-header"><div><div class="eyebrow">PRIVATE TRADE CHAT</div><h2 id="chat-title">내 거래 채팅</h2></div><button class="iconbtn" data-close aria-label="채팅 닫기">×</button></div><p class="chat-notice">대화 참여자 두 명만 볼 수 있습니다. 닉네임은 계정 소유 인증이 아닙니다.</p><div class="chat-layout"><aside aria-label="대화 목록"><div id="chat-rooms"></div><button class="btn" id="chat-more-rooms" hidden>대화 더 보기</button></aside><section class="chat-conversation"><h3 id="chat-person">대화를 선택해 주세요</h3><p id="chat-offer" class="muted"></p><button class="linkbtn" id="chat-older" hidden>이전 메시지 보기</button><div id="chat-messages" role="log" aria-label="대화 메시지" aria-live="polite"></div><p id="chat-status" role="status" aria-live="polite"></p><form id="chat-send"><label class="sr-only" for="chat-body">메시지</label><textarea id="chat-body" class="input" maxlength="1000" rows="2" placeholder="거래 시간과 조건을 이야기해 보세요" required disabled></textarea><button class="btn btn--accent" type="submit" disabled>보내기</button></form></section></div>`;
    main.appendChild(dialog);
    const el=id=>dialog.querySelector('#'+id);
    let room=null,rooms=[],next=null,user=null,timer=null,version=0,destroyed=false,polling=false,loadingRooms=false,loadingMessages=false,turn=0,oldest=null,latest=null,hasOlder=false,tradeFilter=null;
    const status=s=>{el('chat-status').textContent=s;};
    const partner=r=>r.owner_id===user?.id?r.requester_name:r.owner_name;
    function drawRooms(){
      const visible=rooms.filter(r=>!tradeFilter||String(r.trade_id)===String(tradeFilter));
      el('chat-rooms').innerHTML=visible.length?visible.map(r=>`<button type="button" class="chat-room" data-room="${r.id}" ${room?.id===r.id?'aria-current="true"':''}><strong>@${esc(partner(r))}</strong><span>거래글 #${r.trade_id}</span></button>`).join(''):'<p class="muted">아직 대화가 없습니다.</p>';
      el('chat-more-rooms').hidden=!next;
    }
    async function refreshRooms(append=false){
      if(loadingRooms)return;loadingRooms=true;
      const v=version;
      try{const result=await store.conversations({before:append?next:null});if(destroyed||v!==version)return;
        const map=new Map((append?rooms:[]).map(r=>[r.id,r]));result.rooms.forEach(r=>map.set(r.id,r));rooms=[...map.values()];next=result.next;drawRooms();
      }finally{loadingRooms=false;}
    }
    function messageHTML(m){const own=m.sender_id===user?.id;return `<div class="chat-bubble ${own?'chat-bubble--own':''}" data-message="${m.id}"><span class="chat-sender">${own?'나':'@'+esc(partner(room))}</span><p>${esc(m.body)}</p><time datetime="${esc(m.created_at)}">${esc(new Date(m.created_at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))}</time></div>`;}
    function addMessages(messages,mode){
      const box=el('chat-messages');
      if(mode==='initial')box.innerHTML='';
      const fresh=messages.filter(m=>!box.querySelector(`[data-message="${m.id}"]`));
      const stick=box.scrollHeight-box.scrollTop-box.clientHeight<70;
      const height=box.scrollHeight;
      if(mode==='older')box.insertAdjacentHTML('afterbegin',fresh.map(messageHTML).join(''));else box.insertAdjacentHTML('beforeend',fresh.map(messageHTML).join(''));
      const ids=[...box.querySelectorAll('[data-message]')].map(e=>Number(e.dataset.message));oldest=ids[0]||null;latest=ids.at(-1)||null;
      if(mode==='older')box.scrollTop+=box.scrollHeight-height;else if(mode==='initial'||stick)box.scrollTop=box.scrollHeight;
    }
    async function loadMessages(mode='new'){
      if(!room||loadingMessages)return;loadingMessages=true;const v=version,id=room.id;
      try{const messages=await store.messages(id,mode==='older'?{before:oldest}:mode==='new'&&latest?{after:latest}:{});
        if(destroyed||v!==version||room?.id!==id)return;
        addMessages(messages,mode);
        if(mode!=='new'){hasOlder=messages.length===50;el('chat-older').hidden=!hasOlder;}
      }finally{if(v===version)loadingMessages=false;}
    }
    async function select(r){
      version++;room=r;latest=null;oldest=null;loadingMessages=false;
      el('chat-person').textContent='@'+partner(r)+' 님과의 대화';
      el('chat-offer').textContent='거래글 #'+r.trade_id;
      el('chat-messages').innerHTML='';el('chat-body').value='';el('chat-body').disabled=false;el('chat-send').querySelector('button').disabled=false;status('');drawRooms();
      try{await loadMessages('initial');}catch(e){status(e.message);}
    }
    function schedule(){clearTimeout(timer);if(destroyed||!dialog.open)return;timer=setTimeout(poll,5000);}
    async function poll(){
      if(polling||destroyed||!dialog.open)return;polling=true;
      try{if(!document.hidden){if(room)await loadMessages();if(++turn%2===0&&rooms.length<=30)await refreshRooms();}}catch(e){status('새 메시지를 불러오지 못했습니다. 잠시 후 다시 확인합니다.');}finally{polling=false;schedule();}
    }
    async function open({tradeId=null}={}){
      if(destroyed)return;tradeFilter=tradeId;
      if(!dialog.open)dialog.showModal();
      version++;room=null;latest=null;oldest=null;loadingMessages=false;
      el('chat-person').textContent='대화를 선택해 주세요';el('chat-offer').textContent='';el('chat-messages').innerHTML='';el('chat-older').hidden=true;el('chat-body').value='';el('chat-body').disabled=true;el('chat-send').querySelector('button').disabled=true;
      status('대화를 불러오는 중…');
      try{user=await store.current();if(!user){rooms=[];drawRooms();status('채팅을 시작하려면 닉네임을 저장하고 거래글의 1:1 채팅을 눌러 주세요.');return;}await refreshRooms();status('');schedule();}catch(e){status(e.message);}
    }
    async function start(tradeId){
      const username=getUsername();if(!/^[A-Za-z0-9_]{3,20}$/.test(username))throw new Error('내 Roblox 사용자 이름을 먼저 저장해 주세요.');
      const r=await store.startChat(tradeId,username);await open();if(!destroyed){user=await store.current();await select(r);schedule();}
    }
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{clearTimeout(timer);version++;});
    el('chat-rooms').onclick=e=>{const b=e.target.closest('[data-room]');if(b){const r=rooms.find(r=>String(r.id)===b.dataset.room);if(r)select(r);}};
    el('chat-more-rooms').onclick=()=>refreshRooms(true).catch(e=>status(e.message));
    el('chat-older').onclick=()=>loadMessages('older').catch(e=>status(e.message));
    el('chat-send').onsubmit=async e=>{
      e.preventDefault();if(!room)return;const text=el('chat-body').value.trim();if(!text)return;
      const id=room.id,v=version,button=e.target.querySelector('button');button.disabled=true;status('');
      try{await store.send(id,text);if(!destroyed&&v===version){el('chat-body').value='';await loadMessages();}}
      catch(error){if(!destroyed&&v===version)status(error.message);}finally{if(!destroyed&&v===version)button.disabled=false;}
    };
    dispose=()=>{destroyed=true;version++;clearTimeout(timer);dialog.remove();};
    return {open,start};
  }
  return {mount,destroy:()=>dispose()};
})();
