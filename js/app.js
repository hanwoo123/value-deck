/* VALUE DECK — 정적 참고자료 + 거래 계산기
 * 데이터: data/games.json (게임 목록) + 게임별 JSON (아이템)
 */
(() => {
  'use strict';

  const main = document.getElementById('main');
  const topnav = document.getElementById('topnav');
  const gameSelect = document.getElementById('gameSelect');
  const picker = document.getElementById('picker');
  const pickerSearch = document.getElementById('pickerSearch');
  const pickerList = document.getElementById('pickerList');

  const state = {
    games: [],            // status가 active인 게임만
    cache: {},            // id -> 게임 데이터
    calc: {},             // id -> { give: [{id, qty}], get: [...] }
    filters: {},          // id -> { q, rarity, category, sort }
    pickerSide: null,
    pickerGame: null,
  };

  const RARITY_ORDER_DEFAULT = ['Mythic', 'Legendary', 'Epic', 'Rare', 'Common'];
  const RARITY_KO = { Limited: '한정', Exclusive: '한정', Godly: '갓', Mythic: '신화', Legendary: '전설', Epic: '영웅', Rare: '희귀', Uncommon: '고급', Common: '일반' };
  const FAIR_RANGE = 0.05; // ±5% 이내면 "비슷함"

  // ---------- utils ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const full = (n) => Number(n || 0).toLocaleString('ko-KR');
  function compact(n) {
    n = Number(n || 0);
    const abs = Math.abs(n);
    const fmt = (v, s) => (Math.round(v * 100) / 100).toString().replace(/\.0+$/, '') + s;
    if (abs >= 1e12) return fmt(n / 1e12, 'T');
    if (abs >= 1e9) return fmt(n / 1e9, 'B');
    if (abs >= 1e6) return fmt(n / 1e6, 'M');
    if (abs >= 1e5) return fmt(n / 1e3, 'K');
    if (abs >= 1e3) return full(n);
    return String(n);
  }
  function changeOf(i) {
    const prev = Number(i.prevValue);
    if (!prev || prev <= 0 || !Number.isFinite(prev)) return null;
    const pct = ((Number(i.value) - prev) / prev) * 100;
    if (!Number.isFinite(pct) || Math.abs(pct) < 0.05) return null;
    return pct;
  }
  function changeBadge(pct) {
    if (pct == null) return '';
    const up = pct > 0;
    return `<span class="delta delta--${up ? 'up' : 'down'}" title="이전 점수 대비">${up ? '+' : ''}${(Math.round(pct * 10) / 10).toFixed(1)}%</span>`;
  }
  const externalPrices = data => ['comparison','reference'].includes(data.pricingMode);
  const quoteText = (q,format=compact) => q.low!==undefined?format(q.low)+'–'+format(q.high):format(q.value);
  const missingPrice = data => externalPrices(data)?'비교 자료 부족':'점수 미정';
  const hasPrice = item => typeof item?.value === 'number' && Number.isFinite(item.value) && item.value > 0;
  const rarityLabel = (r) => r === 'Unknown' ? '등급 확인 중' : RARITY_KO[r] ? `${RARITY_KO[r]}` : r;
  const initial = (name) => esc(String(name || '?').trim().slice(0, 1));

  function thumb(item) {
    const fb = `<span class="thumb-fallback" aria-hidden="true">${initial(item.name)}</span>`;
    if (!item.image) return fb;
    return `<img src="${esc(item.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'thumb-fallback',textContent:${esc(JSON.stringify(String(item.name || '?').trim().slice(0, 1)))}}))">`;
  }

  function toast(msg) {
    document.querySelectorAll('.toast').forEach((x) => x.remove());
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1900);
  }

  async function getJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path} 불러오기 실패 (${res.status})`);
    return res.json();
  }

  async function loadGame(id) {
    if (state.cache[id]) return state.cache[id];
    const meta = state.games.find((g) => g.id === id);
    if (!meta) return null;
    const data = await getJSON(meta.dataFile);
    data.items = (data.items || []).filter((i) => i && i.id && i.name);
    data.rarities = data.rarities?.length ? data.rarities : RARITY_ORDER_DEFAULT;
    data.categories = data.categories?.length ? data.categories : [...new Set(data.items.map((i) => i.category).filter(Boolean))];
    data.byId = Object.fromEntries(data.items.map((i) => [i.id, i]));
    state.cache[id] = data;
    return data;
  }

  // ---------- nav ----------
  function renderNav(route) {
    const known = state.games.some((g) => g.id === route.gameId);
    const gid = encodeURIComponent((known && route.gameId) || gameSelect.value || state.games[0]?.id || '');
    const links = [
      { href: '#/', label: '홈', key: 'home' },
      gid && { href: `#/g/${gid}`, label: '참고자료', key: 'values' },
      gid && { href: `#/g/${gid}/calc`, label: '계산기', key: 'calc' },
      { href: `#/trades/${gid || 'blox-fruits'}`, label: '거래 게시판', key: 'trades' },
      { href: '#/safety', label: '거래 안전', key: 'safety' },
    ].filter(Boolean);
    topnav.innerHTML = links.map((l) => `<a href="${l.href}"${l.key === route.view ? ' aria-current="page"' : ''}>${l.label}</a>`).join('');
    if (known) gameSelect.value = route.gameId;
  }

  gameSelect.addEventListener('change', () => {
    const r = parseRoute();
    if(r.view==='trades'){location.hash='#/trades/'+gameSelect.value;return;}
    const view = r.view === 'calc' ? '/calc' : '';
    location.hash = `#/g/${gameSelect.value}${view}`;
  });

  // ---------- router ----------
  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'g' && parts[1]) return { view: parts[2] === 'calc' ? 'calc' : 'values', gameId: decodeURIComponent(parts[1]), itemId: parts[2] === 'item' && parts[3] ? decodeURIComponent(parts[3]) : null };
    if (parts[0] === 'trades') return { view: 'trades', gameId: parts[1] || 'blox-fruits' };
    if (parts[0] === 'safety') return { view: 'safety' };
    return { view: 'home' };
  }

  async function router() {
    window.ValueDeckTrades?.cleanup();
    window.ValueDeckTradeChat?.destroy();
    window.ValueDeckTradePicker?.destroy();
    const route = parseRoute();
    renderNav(route);
    window.scrollTo(0, 0);
    try {
      if (route.view === 'trades') {
        document.title = '거래 게시판 — VALUE DECK';
        const tradeHash=location.hash;
        const games=state.games.filter(g=>['blox-fruits','cameraman-td'].includes(g.id));
        const catalogs=Object.fromEntries(await Promise.all(games.map(async g=>[g.id,{...await loadGame(g.id),name:g.name}])));
        if(tradeHash!==location.hash)return;
        return window.ValueDeckTrades.render(main,catalogs,route.gameId);
      }
      if (route.view === 'home') return renderHome();
      if (route.view === 'safety') return renderSafety();
      const meta = state.games.find((g) => g.id === route.gameId);
      if (!meta) return renderNotFound();
      main.innerHTML = '<div class="loading" role="status">불러오는 중…</div>';
      const data = await loadGame(route.gameId);
      if (route.view === 'calc') renderCalc(meta, data);
      else renderValues(meta, data, route.itemId);
    } catch (err) {
      main.innerHTML = `<div class="empty"><p><strong>데이터를 불러오지 못했어요.</strong></p><p class="muted">${esc(err.message)}</p></div>`;
    }
    document.title = `${route.view === 'calc' ? '계산기' : route.view === 'values' ? '참고자료' : route.view === 'safety' ? '거래 안전' : 'VALUE DECK'} — VALUE DECK`;
  }

  async function renderPriceCheck(node,gameId=null) {
    try {
      const report=await getJSON('data/value-update-status.json');
      if(['paused','provisional'].includes(report.state)){if(node?.isConnected)node.textContent=report.message;return;}
      if(report.state==='comparison'){
        const info=gameId?report.games?.[gameId]:null;
        const time=new Date(info?.checkedAt||report.checkedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
        if(node?.isConnected)node.textContent=(info?.message||'블록스 프루츠: 공개 가격 비교 · 카타디: 단일 출처 범위')+(info?.mode==='provisional'?'':' · 최근 가격 확인 '+time+' (한국 시간) · 6시간마다 확인')+(report.comparisonErrors?.length?' · 최근 수집 일부 실패: 기존 관측 날짜를 확인하세요':'')+(report.ctdReferenceError&&(!gameId||gameId==='cameraman-td')?' · 카타디 자료 갱신 실패: 기존 관측일을 확인하세요':'');
        return;
      }
      const checks=gameId?[report.checks?.[gameId]].filter(Boolean):Object.values(report.checks||{});
      const blocked=checks.some(c=>c.state==='blocked');
      const changes=checks.reduce((sum,c)=>sum+c.changedItems,0);
      const time=new Date(report.checkedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
      if(node?.isConnected)node.textContent=`최근 시세 확인 ${time} (한국 시간) · ${blocked?'일부 시세 확인 중단':changes?changes+'개 시세 반영':'확인된 시세 기준 3% 이상 변동 없음'}${report.errors?.some(e=>!gameId||e.game===gameId)?' · 일부 출처 확인 실패':''} · 매시간 자동 확인`;
    } catch {
      if(node?.isConnected)node.textContent='기준 안내를 불러오지 못했습니다.';
    }
  }

  // ---------- home ----------
  async function renderHome() {
    main.innerHTML = '<div class="loading" role="status">불러오는 중…</div>';
    const datas = await Promise.all(state.games.map((g) => loadGame(g.id).catch(() => null)));
    const totalItems = datas.reduce((s, d) => s + (d?.items.length || 0), 0);
    const latest = datas.map((d) => d?.updated).filter(Boolean).sort().pop() || '-';
    const moves = [];
    state.games.forEach((g, gi) => (datas[gi]?.items || []).forEach((it) => {
      const pct = changeOf(it); if (pct != null) moves.push({ g, it, pct, changedAt:it.valueUpdatedAt||'' });
    }));
    moves.sort((a,b)=>b.changedAt.localeCompare(a.changedAt)||Math.abs(b.pct)-Math.abs(a.pct));
    const movesHTML = moves.length ? `
      <section class="moves" aria-labelledby="movesTitle">
        <h2 class="section-title" id="movesTitle">최근 기준 수정</h2>
        <div class="moves__list">
          ${moves.slice(0, 6).map(({ g, it, pct }) => `
            <a class="move" href="#/g/${encodeURIComponent(g.id)}/item/${encodeURIComponent(it.id)}" data-rarity="${esc(it.rarity)}">
              <span class="slot__thumb">${thumb(it)}</span>
              <span class="move__text"><span class="slot__name">${esc(it.name)}</span><span class="cat">${esc(g.name)}</span></span>
              <span class="move__val"><span class="slot__val">${compact(it.prevValue)} → ${compact(it.value)}</span>${changeBadge(pct)}</span>
            </a>`).join('')}
        </div>
      </section>` : '';

    main.innerHTML = `
      <section class="hero">
        <div class="eyebrow">Roblox Trading Hub</div>
        <h1>거래 전에 <em>참고 기준</em>부터 확인하세요</h1>
        <p>여러 로블록스 게임의 아이템 참고자료와 거래 계산기를 한곳에서. 내가 주는 것과 받는 것을 넣으면 임시 기준에 따른 점수 차이를 비교해요.</p>
        <div class="hero__stats">
          <div class="stat"><b>${state.games.length}</b><span>지원 게임</span></div>
          <div class="stat"><b>${full(totalItems)}</b><span>등록 아이템</span></div>
          <div class="stat"><b>${esc(latest)}</b><span>최근 업데이트</span></div>
        </div>
      </section>
      <p class="muted price-check" id="priceCheckStatus" role="status">기준 안내를 불러오는 중…</p>
      ${movesHTML}
      <h2 class="section-title">게임 선택</h2>
      ${state.games.length ? `<div class="games">${state.games.map((g, i) => gameCard(g, datas[i])).join('')}</div>`
        : '<div class="empty">아직 등록된 게임이 없어요. data/games.json에 게임을 추가하세요.</div>'}
    `;
    renderPriceCheck(main.querySelector('#priceCheckStatus'));
  }

  function gameCard(g, d) {
    const cover = g.cover ? `<img src="${esc(g.cover)}" alt="" loading="lazy" onerror="this.remove()">` : '';
    return `
      <article class="gamecard" style="--g:${esc(g.accent || '#c8f04a')}">
        <a class="gamecard__cover" href="#/g/${encodeURIComponent(g.id)}" aria-label="${esc(g.name)} 참고자료">
          <span class="gamecard__initial" aria-hidden="true">${initial(g.name)}</span>${cover}
        </a>
        <div class="gamecard__body">
          <h3>${esc(g.name)}</h3>
          <div class="gamecard__meta"><span>${d ? full(d.items.length) : '-'} items</span><span>${esc(d?.updated || '')}</span></div>
          ${g.description ? `<p class="muted" style="font-size:var(--text-xs)">${esc(g.description)}</p>` : ''}
          <div class="gamecard__actions">
            <a class="btn" href="#/g/${encodeURIComponent(g.id)}">참고자료</a>
            <a class="btn btn--accent" href="#/g/${encodeURIComponent(g.id)}/calc">계산기</a>
          </div>
        </div>
      </article>`;
  }

  // ---------- values ----------
  function renderValues(meta, data, itemId = null) {
    const f = state.filters[meta.id] ||= { q: '', rarity: 'all', category: 'all', sort: 'value-desc' };
    // A direct item link must remain visible even after previous filtering.
    const target = itemId && data.byId[itemId];
    if (target) Object.assign(f, { q: '', rarity: 'all', category: 'all' });
    main.innerHTML = `
      <div class="pagehead">
        <div>
          <div class="eyebrow">Value List</div>
          <h1>${esc(meta.name)} 참고자료</h1>
          <p>${full(data.items.length)}개 아이템 · 업데이트 ${esc(data.updated || '-')}${data.source ? ' · ' + esc(data.source) : ''}</p>
        </div>
        <a class="btn btn--accent" href="#/g/${encodeURIComponent(meta.id)}/calc">거래 계산기 열기</a>
      </div>
      <p class="muted price-check" id="gamePriceCheckStatus" role="status">기준 안내를 불러오는 중…</p>
      <div class="toolbar">
        <input class="input" id="q" type="search" placeholder="아이템 이름 검색" value="${esc(f.q)}" aria-label="아이템 검색" />
        <select class="select" id="cat" aria-label="분류">
          <option value="all">전체 분류</option>
          ${data.categories.map((c) => `<option value="${esc(c)}"${f.category === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <select class="select" id="sort" aria-label="정렬">
          <option value="value-desc">가치 높은 순</option>
          <option value="value-asc">가치 낮은 순</option>

          <option value="name">이름순</option>
        </select>
      </div>
      <div class="chips" role="group" aria-label="등급 필터">
        <button class="chip" data-r="all" aria-pressed="${f.rarity === 'all'}">전체</button>
        ${data.rarities.map((r) => `<button class="chip" data-r="${esc(r)}" data-rarity="${esc(r)}" aria-pressed="${f.rarity === r}"><span class="dot"></span>${esc(rarityLabel(r))}</button>`).join('')}
      </div>
      <div class="count" id="count"></div>
      <div class="items" id="items"></div>
    `;
    main.querySelector('#sort').value = f.sort;
    renderPriceCheck(main.querySelector('#gamePriceCheckStatus'),meta.id);

    const draw = () => {
      const q = f.q.trim().toLowerCase();
      const rIdx = (r) => { const i = data.rarities.indexOf(r); return i < 0 ? 99 : i; };
      let list = data.items.filter((i) =>
        (!q || i.name.toLowerCase().includes(q)) &&
        (f.rarity === 'all' || i.rarity === f.rarity) &&
        (f.category === 'all' || i.category === f.category));
      const sorters = {
        'value-desc': (a, b) => b.value - a.value,
        'value-asc': (a, b) => a.value - b.value,
        'demand-desc': (a, b) => (b.demand || 0) - (a.demand || 0) || b.value - a.value,
        name: (a, b) => a.name.localeCompare(b.name, 'ko') || rIdx(a.rarity) - rIdx(b.rarity),
      };
      list.sort((a,b)=>(f.sort.startsWith('value-')?Number(hasPrice(b))-Number(hasPrice(a)):0)||sorters[f.sort](a,b));
      main.querySelector('#count').textContent = `${list.length}개 표시 중`;
      main.querySelector('#items').innerHTML = list.length ? list.map((i) => itemCard(i, data)).join('')
        : '<div class="empty" style="grid-column:1/-1">조건에 맞는 아이템이 없어요.</div>';
    };

    main.querySelector('#q').addEventListener('input', (e) => { f.q = e.target.value; draw(); });
    main.querySelector('#cat').addEventListener('change', (e) => { f.category = e.target.value; draw(); });
    main.querySelector('#sort').addEventListener('change', (e) => { f.sort = e.target.value; draw(); });
    main.querySelector('.chips').addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      f.rarity = b.dataset.r;
      main.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      draw();
    });
    main.querySelector('#items').addEventListener('click', (e) => {
      const b = e.target.closest('[data-add]'); if (!b) return;
      addToCalc(meta.id, 'give', b.dataset.add);
      toast(`'${data.byId[b.dataset.add].name}' 계산기에 추가됨 (내가 주는 것)`);
    });
    draw();
    if (target) {
      const card = document.getElementById(`item-${target.id}`);
      if (card) {
        card.classList.add('item--target');
        card.style.scrollMarginTop = `${document.querySelector('.topbar').getBoundingClientRect().height + 16}px`;
        card.scrollIntoView({ block: 'center' });
        card.focus({ preventScroll: true });
      }
    }
  }

  function itemCard(i, data) {
    const singleQuote=i.valueStatus==='insufficient'&&i.priceQuotes?.length===1?i.priceQuotes[0]:null;
    const display=hasPrice(i)?compact(i.value):singleQuote?quoteText(singleQuote)+(singleQuote.unit?' '+singleQuote.unit:'')+' · 단일 출처':missingPrice(data);
    const dmax = Number(data.demandMax) || 5;
    const dval = Math.max(0, Math.min(dmax, Number(i.demand) || 0));
    const d = Math.round((dval / dmax) * 5);
    const dLabel = `${dval}/${dmax}`;
    const trend = { up: ['▲', '상승'], down: ['▼', '하락'], stable: ['–', '유지'] }[i.trend] || ['–', '유지'];
    return `
      <article class="item" id="item-${esc(i.id)}" tabindex="-1" data-rarity="${esc(i.rarity)}">
        <button class="iconbtn item__add" data-add="${esc(i.id)}" aria-label="${esc(i.name)} 계산기에 추가" title="계산기에 추가">+</button>
        <div class="item__img">${thumb(i)}</div>
        <div class="item__body">
          <div class="item__top"><span class="rarity">${esc(rarityLabel(i.rarity))}</span><span class="cat">${esc(i.category || '')}</span></div>
          <h3 class="item__name">${esc(i.name)}</h3>
          <div class="item__value" title="${hasPrice(i)?full(i.value):singleQuote?quoteText(singleQuote,full)+' · 단일 출처 참고값':missingPrice(data)}">${display}${hasPrice(i)&&data.valueUnit ? ' ' + esc(data.valueUnit) : ''}${changeBadge(changeOf(i))}</div>
          ${!hasPrice(i)&&i.referenceValue?`<p class="item__note"><a href="${esc(i.referenceUrl)}" target="_blank" rel="noopener noreferrer">${esc(i.referenceSource)} 참고 ${full(i.referenceValue)}</a> · 비교 시세 미확정</p>`:''}
          ${i.note ? `<p class="item__note">${esc(i.note)}</p>` : ''}
          ${i.priceQuotes?.length?`<details class="item__sources"><summary>출처별 숫자 보기 (${i.priceQuotes.length}곳)</summary><ul>${i.priceQuotes.map(q=>`<li><a href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">${esc(q.name)}</a>: ${quoteText(q,full)}${q.unit?' '+esc(q.unit):''}<br><small>${q.publishedAt?'자료 수정 '+esc(new Date(q.publishedAt).toLocaleDateString('ko-KR')):'자료 수정일 미표기'} · 관측 ${esc(new Date(q.observedAt).toLocaleDateString('ko-KR'))}</small></li>`).join('')}</ul></details>`:''}
          <div class="item__foot"><span class="muted">${externalPrices(data)?(hasPrice(i)?'공개값 비교 평균':singleQuote?'단일 출처 참고 · 합산 보류':'가격 비교 보류'):(hasPrice(i)?'임시 비교점수':'점수 미정')}</span></div>
        </div>
      </article>`;
  }

  // ---------- calculator ----------
  const calcOf = (gid) => (state.calc[gid] ||= { give: [], get: [] });
  function addToCalc(gid, side, itemId) {
    const c = calcOf(gid);
    const ex = c[side].find((s) => s.id === itemId);
    if (ex) ex.qty = Math.min(999, ex.qty + 1); else c[side].push({ id: itemId, qty: 1 });
  }
  const sideTotal = (list, data) => list.some(x=>!hasPrice(data.byId[x.id]))?null:list.reduce((s,x)=>s+data.byId[x.id].value*x.qty,0);

  function renderCalc(meta, data) {
    const c = calcOf(meta.id);
    c.give = c.give.filter((x) => data.byId[x.id]);
    c.get = c.get.filter((x) => data.byId[x.id]);

    main.innerHTML = `
      <div class="pagehead">
        <div>
          <div class="eyebrow">Trade Calculator</div>
          <h1>${esc(meta.name)} 거래 계산기</h1>
          <p>${data.pricingMode==='reference'?'현재 카타디 자료는 단일 출처의 범위입니다. 평균과 합산은 보류합니다.':externalPrices(data)?'출처별 공개값의 비교 평균으로 합산합니다. 실제 거래 체결가를 의미하지 않습니다.':'등급·분류별 임시 점수를 합산합니다. 실제 거래가격이 아닙니다.'} 업데이트 ${esc(data.updated || '-')}</p>
        </div>
        <button class="btn" id="swap" type="button">⇄ 양쪽 바꾸기</button>
      </div>
      <div class="calc" id="calc"></div>
    `;

    const sideHTML = (key, title, label) => {
      const list = c[key];
      return `
      <section class="side side--${key}" aria-label="${title}">
        <div class="side__head">
          <div><div class="side__label">${label}</div><h2>${title}</h2></div>
          <div class="side__total" title="${sideTotal(list,data)===null?missingPrice(data):full(sideTotal(list,data))}">${sideTotal(list,data)===null?missingPrice(data):compact(sideTotal(list,data))}</div>
        </div>
        <div class="slots">
          ${list.map((x) => {
            const it = data.byId[x.id];
            return `<div class="slot" data-rarity="${esc(it.rarity)}">
              <div class="slot__thumb">${thumb(it)}</div>
              <div><div class="slot__name">${esc(it.name)}</div><div class="slot__val">${hasPrice(it)?compact(it.value)+' × '+x.qty+' = '+compact(it.value*x.qty):missingPrice(data)+' × '+x.qty}</div></div>
              <div class="qty">
                <button type="button" data-act="dec" data-side="${key}" data-id="${esc(x.id)}" aria-label="${esc(it.name)} 수량 줄이기">−</button>
                <span>${x.qty}</span>
                <button type="button" data-act="inc" data-side="${key}" data-id="${esc(x.id)}" aria-label="${esc(it.name)} 수량 늘리기">+</button>
              </div>
            </div>`;
          }).join('')}
          <button class="addslot" type="button" data-open="${key}">+ 아이템 추가</button>
        </div>
        ${list.length ? `<div class="side__foot"><button class="linkbtn" type="button" data-clear="${key}">모두 비우기</button></div>` : ''}
      </section>`;
    };

    const draw = () => {
      const give = sideTotal(c.give, data), get = sideTotal(c.get, data);
      const pending = give===null||get===null;
      const diff = pending?null:get-give;
      const base = Math.max(give, get);
      let cls = 'empty', label = '대기 중', note = '양쪽에 아이템을 추가하세요';
      if (pending) { cls='empty';label='비교 보류';note=missingPrice(data)+'인 아이템이 포함되어 있습니다'; }
      else if (give > 0 || get > 0) {
        const ratio = base ? Math.abs(diff) / base : 0;
        if (ratio <= FAIR_RANGE) { cls = 'fair'; label = '기준값 비슷함'; note = `차이 ±${Math.round(FAIR_RANGE * 100)}% 이내`; }
        else if (diff > 0) { cls = 'win'; label = '받는 쪽 기준값 높음'; note = `받는 쪽이 ${Math.round(ratio * 100)}% 더 높아요`; }
        else { cls = 'lose'; label = '주는 쪽 기준값 높음'; note = `주는 쪽이 ${Math.round(ratio * 100)}% 더 높아요`; }
      }
      const pct = pending?50:give + get ? (get / (give + get)) * 100 : 50;
      main.querySelector('#calc').innerHTML = `
        ${sideHTML('give', '내가 주는 것', 'YOU GIVE')}
        <div class="verdict verdict--${cls}" aria-live="polite">
          <div class="verdict__badge">${label}</div>
          <div class="verdict__diff">${pending?'—':(diff>0?'+':'')+compact(diff)}</div>
          <div class="verdict__bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
          <small>${note}</small>
        </div>
        ${sideHTML('get', '내가 받는 것', 'YOU GET')}
      `;
    };

    main.querySelector('#calc').addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.open) return openPicker(meta.id, t.dataset.open);
      if (t.dataset.clear) { c[t.dataset.clear] = []; return draw(); }
      if (t.dataset.act) {
        const list = c[t.dataset.side];
        const x = list.find((s) => s.id === t.dataset.id); if (!x) return;
        x.qty += t.dataset.act === 'inc' ? 1 : -1;
        if (x.qty > 999) x.qty = 999;
        if (x.qty <= 0) list.splice(list.indexOf(x), 1);
        draw();
      }
    });
    main.querySelector('#swap').addEventListener('click', () => { [c.give, c.get] = [c.get, c.give]; draw(); });
    state.redrawCalc = draw;
    draw();
  }

  // ---------- picker ----------
  let lastFocus = null;
  function openPicker(gid, side) {
    state.pickerGame = gid; state.pickerSide = side;
    document.getElementById('pickerTitle').textContent = side === 'give' ? '내가 주는 아이템 추가' : '내가 받는 아이템 추가';
    pickerSearch.value = '';
    drawPicker();
    lastFocus = document.activeElement;
    picker.hidden = false;
    document.body.style.overflow = 'hidden';
    pickerSearch.focus();
  }
  function closePicker() {
    picker.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus?.();
  }
  function drawPicker() {
    const data = state.cache[state.pickerGame]; if (!data) return;
    const q = pickerSearch.value.trim().toLowerCase();
    const list = data.items.filter((i) => !q || i.name.toLowerCase().includes(q)).sort((a, b) => b.value - a.value);
    pickerList.innerHTML = list.length ? list.map((i) => `
      <button class="pick" type="button" data-pick="${esc(i.id)}" data-rarity="${esc(i.rarity)}">
        <span class="slot__thumb">${thumb(i)}</span>
        <span><span class="slot__name" style="display:block">${esc(i.name)}</span><span class="rarity">${esc(rarityLabel(i.rarity))}</span> <span class="cat">${esc(i.category || '')}</span></span>
        <span class="pick__val">${hasPrice(i)?compact(i.value):missingPrice(data)}</span>
      </button>`).join('') : '<div class="empty">검색 결과가 없어요.</div>';
  }
  pickerSearch.addEventListener('input', drawPicker);
  pickerSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const first = pickerList.querySelector('[data-pick]'); if (first) first.click(); }
  });
  pickerList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]'); if (!b) return;
    addToCalc(state.pickerGame, state.pickerSide, b.dataset.pick);
    state.redrawCalc?.();
    toast(`'${state.cache[state.pickerGame].byId[b.dataset.pick].name}' 추가됨`);
  });
  picker.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closePicker(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !picker.hidden) closePicker(); });

  function renderSafety() {
    main.innerHTML = `
      <div class="pagehead"><div><div class="eyebrow">Trade Safety</div><h1>거래 안전 가이드</h1>
      <p>거래 전에 한 번만 읽어도 사기 대부분을 피할 수 있어요.</p></div></div>
      <div class="guide">
        <section class="warnbox">
          <h2>절대 하지 말 것</h2>
          <ul>
            <li>로블록스 비밀번호, 인증 코드, 쿠키(.ROBLOSECURITY)를 누구에게도 알려주지 마세요. 운영진도 절대 요구하지 않아요.</li>
            <li>"먼저 주면 바로 보내줄게"라는 말만 믿고 아이템을 먼저 넘기지 마세요.</li>
            <li>DM으로 온 링크나 파일, "무료 아이템·로벅스" 사이트는 열지 마세요.</li>
          </ul>
        </section>
        <section>
          <h2>거래 전 확인하기</h2>
          <ol>
            <li>참고자료와 계산기로 거래가 크게 손해인지 먼저 확인해요.</li>
            <li>상대가 서버에서 로블록스 인증을 마친 사람인지 확인해요.</li>
            <li>조건(아이템, 수량, 순서)은 서버 채널에 남겨 기록을 만들어요.</li>
            <li>가능하면 게임 안의 거래 창이나 로블록스 공식 거래 기능을 사용해요. 양쪽이 확인해야 완료되는 방식이 가장 안전해요.</li>
          </ol>
        </section>
        <section>
          <h2>자주 보이는 사기 수법</h2>
          <ul>
            <li><strong>사칭</strong>: 운영진이나 유명 유저인 척 DM을 보내요. 닉네임이 비슷해도 프로필과 역할을 꼭 확인하세요.</li>
            <li><strong>중개 사기</strong>: "중개해줄게"라며 가짜 중개인을 끌어들여요. 서버가 지정한 중개인 외에는 믿지 마세요.</li>
            <li><strong>바꿔치기</strong>: 거래 창에서 마지막 순간에 아이템을 바꾸거나 빼요. 수락 전에 목록을 다시 확인하세요.</li>
            <li><strong>시세 부풀리기</strong>: "이거 요즘 엄청 올랐어"라며 가치를 속여요. 참고자료로 직접 확인하세요.</li>
          </ul>
        </section>
        <section>
          <h2>사기를 당했다면</h2>
          <ol>
            <li>상대 디스코드·로블록스 닉네임과 ID, 대화 캡처, 거래 화면을 저장해요.</li>
            <li>서버의 신고 티켓으로 증거와 함께 접수해요.</li>
            <li>로블록스 안의 신고 기능으로도 함께 신고해요.</li>
          </ol>
          <p style="margin-top:var(--space-3)">공식 거래 기능 밖에서 한 약속이나 현금 거래는 되돌리기 어려워요. 서버도 손해를 대신 책임지지 않아요.</p>
        </section>
      </div>`;
  }

  function renderNotFound() {
    main.innerHTML = `<div class="empty"><p><strong>게임을 찾을 수 없어요.</strong></p><p class="muted">삭제되었거나 숨김 처리된 게임일 수 있어요.</p><p style="margin-top:var(--space-4)"><a class="btn" href="#/">홈으로</a></p></div>`;
  }

  // ---------- boot ----------
  async function boot() {
    try {
      const cfg = await getJSON('data/games.json');
      const inv = String(cfg.discordInvite || '').trim();
      if (/^https:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+\/?$/.test(inv)) {
        const b = document.getElementById('discordBtn'); b.href = inv; b.hidden = false;
      }
      state.games = (cfg.games || []).filter((g) => g && g.id && (g.status || 'active') === 'active');
    } catch (err) {
      main.innerHTML = `<div class="empty"><p><strong>data/games.json을 불러오지 못했어요.</strong></p><p class="muted">${esc(err.message)}</p></div>`;
      return;
    }
    gameSelect.innerHTML = state.games.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
    window.addEventListener('hashchange', router);
    router();
  }
  boot();
})();
