/* VALUE DECK — 정적 시세표 + 거래 계산기
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
  const RARITY_KO = { Mythic: '신화', Legendary: '전설', Epic: '영웅', Rare: '희귀', Common: '일반' };
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
    if (abs >= 1e3) return fmt(n / 1e3, 'K');
    return String(n);
  }
  const rarityLabel = (r) => RARITY_KO[r] ? `${RARITY_KO[r]}` : r;
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
    const gid = route.gameId || gameSelect.value || state.games[0]?.id;
    const links = [
      { href: '#/', label: '홈', key: 'home' },
      gid && { href: `#/g/${gid}`, label: '시세표', key: 'values' },
      gid && { href: `#/g/${gid}/calc`, label: '계산기', key: 'calc' },
      { href: '#/guide', label: '관리 방법', key: 'guide' },
    ].filter(Boolean);
    topnav.innerHTML = links.map((l) => `<a href="${l.href}"${l.key === route.view ? ' aria-current="page"' : ''}>${l.label}</a>`).join('');
    if (route.gameId) gameSelect.value = route.gameId;
  }

  gameSelect.addEventListener('change', () => {
    const r = parseRoute();
    const view = r.view === 'calc' ? '/calc' : '';
    location.hash = `#/g/${gameSelect.value}${view}`;
  });

  // ---------- router ----------
  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'g' && parts[1]) return { view: parts[2] === 'calc' ? 'calc' : 'values', gameId: decodeURIComponent(parts[1]) };
    if (parts[0] === 'guide') return { view: 'guide' };
    return { view: 'home' };
  }

  async function router() {
    const route = parseRoute();
    renderNav(route);
    window.scrollTo(0, 0);
    try {
      if (route.view === 'home') return renderHome();
      if (route.view === 'guide') return renderGuide();
      const meta = state.games.find((g) => g.id === route.gameId);
      if (!meta) return renderNotFound();
      main.innerHTML = '<div class="loading" role="status">불러오는 중…</div>';
      const data = await loadGame(route.gameId);
      if (route.view === 'calc') renderCalc(meta, data);
      else renderValues(meta, data);
    } catch (err) {
      main.innerHTML = `<div class="empty"><p><strong>데이터를 불러오지 못했어요.</strong></p><p class="muted">${esc(err.message)}</p></div>`;
    }
    document.title = `${route.view === 'calc' ? '계산기' : route.view === 'values' ? '시세표' : 'VALUE DECK'} — VALUE DECK`;
  }

  // ---------- home ----------
  async function renderHome() {
    main.innerHTML = '<div class="loading" role="status">불러오는 중…</div>';
    const datas = await Promise.all(state.games.map((g) => loadGame(g.id).catch(() => null)));
    const totalItems = datas.reduce((s, d) => s + (d?.items.length || 0), 0);
    const latest = datas.map((d) => d?.updated).filter(Boolean).sort().pop() || '-';

    main.innerHTML = `
      <section class="hero">
        <div class="eyebrow">Roblox Trading Hub</div>
        <h1>거래 전에 <em>시세</em>부터 확인하세요</h1>
        <p>여러 로블록스 게임의 아이템 시세표와 거래 계산기를 한곳에서. 내가 주는 것과 받는 것을 넣으면 거래가 이득인지 바로 보여줘요.</p>
        <div class="hero__stats">
          <div class="stat"><b>${state.games.length}</b><span>지원 게임</span></div>
          <div class="stat"><b>${full(totalItems)}</b><span>등록 아이템</span></div>
          <div class="stat"><b>${esc(latest)}</b><span>최근 업데이트</span></div>
        </div>
      </section>
      <h2 class="section-title">게임 선택</h2>
      ${state.games.length ? `<div class="games">${state.games.map((g, i) => gameCard(g, datas[i])).join('')}</div>`
        : '<div class="empty">아직 등록된 게임이 없어요. data/games.json에 게임을 추가하세요.</div>'}
    `;
  }

  function gameCard(g, d) {
    const cover = g.cover ? `<img src="${esc(g.cover)}" alt="" loading="lazy" onerror="this.remove()">` : '';
    return `
      <article class="gamecard" style="--g:${esc(g.accent || '#c8f04a')}">
        <a class="gamecard__cover" href="#/g/${encodeURIComponent(g.id)}" aria-label="${esc(g.name)} 시세표">
          <span class="gamecard__initial" aria-hidden="true">${initial(g.name)}</span>${cover}
        </a>
        <div class="gamecard__body">
          <h3>${esc(g.name)}</h3>
          <div class="gamecard__meta"><span>${d ? full(d.items.length) : '-'} items</span><span>${esc(d?.updated || '')}</span></div>
          ${g.description ? `<p class="muted" style="font-size:var(--text-xs)">${esc(g.description)}</p>` : ''}
          <div class="gamecard__actions">
            <a class="btn" href="#/g/${encodeURIComponent(g.id)}">시세표</a>
            <a class="btn btn--accent" href="#/g/${encodeURIComponent(g.id)}/calc">계산기</a>
          </div>
        </div>
      </article>`;
  }

  // ---------- values ----------
  function renderValues(meta, data) {
    const f = state.filters[meta.id] ||= { q: '', rarity: 'all', category: 'all', sort: 'value-desc' };
    main.innerHTML = `
      <div class="pagehead">
        <div>
          <div class="eyebrow">Value List</div>
          <h1>${esc(meta.name)} 시세표</h1>
          <p>${full(data.items.length)}개 아이템 · 업데이트 ${esc(data.updated || '-')}</p>
        </div>
        <a class="btn btn--accent" href="#/g/${encodeURIComponent(meta.id)}/calc">거래 계산기 열기</a>
      </div>
      <div class="toolbar">
        <input class="input" id="q" type="search" placeholder="아이템 이름 검색" value="${esc(f.q)}" aria-label="아이템 검색" />
        <select class="select" id="cat" aria-label="분류">
          <option value="all">전체 분류</option>
          ${data.categories.map((c) => `<option value="${esc(c)}"${f.category === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <select class="select" id="sort" aria-label="정렬">
          <option value="value-desc">가치 높은 순</option>
          <option value="value-asc">가치 낮은 순</option>
          <option value="demand-desc">수요 높은 순</option>
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
      list.sort(sorters[f.sort]);
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
  }

  function itemCard(i, data) {
    const d = Math.max(0, Math.min(5, Number(i.demand) || 0));
    const trend = { up: ['▲', '상승'], down: ['▼', '하락'], stable: ['–', '유지'] }[i.trend] || ['–', '유지'];
    return `
      <article class="item" data-rarity="${esc(i.rarity)}">
        <button class="iconbtn item__add" data-add="${esc(i.id)}" aria-label="${esc(i.name)} 계산기에 추가" title="계산기에 추가">+</button>
        <div class="item__img">${thumb(i)}</div>
        <div class="item__body">
          <div class="item__top"><span class="rarity">${esc(rarityLabel(i.rarity))}</span><span class="cat">${esc(i.category || '')}</span></div>
          <h3 class="item__name">${esc(i.name)}</h3>
          <div class="item__value" title="${full(i.value)}">${compact(i.value)}${data.valueUnit ? ' ' + esc(data.valueUnit) : ''}</div>
          <div class="item__foot">
            <span class="demand" title="수요 ${d}/5" aria-label="수요 ${d}/5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= d ? 'on' : ''}"></i>`).join('')}</span>
            <span class="trend trend--${esc(i.trend || 'stable')}" title="${trend[1]}">${trend[0]} ${trend[1]}</span>
          </div>
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
  const sideTotal = (list, data) => list.reduce((s, x) => s + (data.byId[x.id]?.value || 0) * x.qty, 0);

  function renderCalc(meta, data) {
    const c = calcOf(meta.id);
    c.give = c.give.filter((x) => data.byId[x.id]);
    c.get = c.get.filter((x) => data.byId[x.id]);

    main.innerHTML = `
      <div class="pagehead">
        <div>
          <div class="eyebrow">Trade Calculator</div>
          <h1>${esc(meta.name)} 거래 계산기</h1>
          <p>양쪽에 아이템을 넣으면 시세 기준으로 거래 결과를 계산해요. 업데이트 ${esc(data.updated || '-')}</p>
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
          <div class="side__total" title="${full(sideTotal(list, data))}">${compact(sideTotal(list, data))}</div>
        </div>
        <div class="slots">
          ${list.map((x) => {
            const it = data.byId[x.id];
            return `<div class="slot" data-rarity="${esc(it.rarity)}">
              <div class="slot__thumb">${thumb(it)}</div>
              <div><div class="slot__name">${esc(it.name)}</div><div class="slot__val">${compact(it.value)} × ${x.qty} = ${compact(it.value * x.qty)}</div></div>
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
      const diff = get - give;
      const base = Math.max(give, get);
      let cls = 'empty', label = '대기 중', note = '양쪽에 아이템을 추가하세요';
      if (give > 0 || get > 0) {
        const ratio = base ? Math.abs(diff) / base : 0;
        if (ratio <= FAIR_RANGE) { cls = 'fair'; label = '비슷함'; note = `차이 ±${Math.round(FAIR_RANGE * 100)}% 이내`; }
        else if (diff > 0) { cls = 'win'; label = '이득'; note = `받는 쪽이 ${Math.round(ratio * 100)}% 더 높아요`; }
        else { cls = 'lose'; label = '손해'; note = `주는 쪽이 ${Math.round(ratio * 100)}% 더 높아요`; }
      }
      const pct = give + get ? (get / (give + get)) * 100 : 50;
      main.querySelector('#calc').innerHTML = `
        ${sideHTML('give', '내가 주는 것', 'YOU GIVE')}
        <div class="verdict verdict--${cls}" aria-live="polite">
          <div class="verdict__badge">${label}</div>
          <div class="verdict__diff">${diff > 0 ? '+' : ''}${compact(diff)}</div>
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
        <span class="pick__val">${compact(i.value)}</span>
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

  // ---------- guide ----------
  function renderGuide() {
    main.innerHTML = `
      <div class="pagehead"><div><div class="eyebrow">Admin Guide</div><h1>사이트 관리 방법</h1>
      <p>코드를 건드리지 않고 JSON 파일과 이미지만 수정하면 돼요.</p></div></div>
      <div class="guide">
        <section>
          <h2>1. 새 게임 추가</h2>
          <ol>
            <li><code>data/</code> 폴더에 게임 파일을 만들어요. 예: <code>data/blox-fruits.json</code> (샘플 파일을 복사하면 편해요)</li>
            <li><code>data/games.json</code>의 <code>games</code> 배열에 한 줄을 추가해요.</li>
            <li>이미지는 <code>images/게임id/</code> 폴더에 넣어요.</li>
          </ol>
<pre>{
  "id": "blox-fruits",
  "name": "블록스 프루츠",
  "status": "active",
  "dataFile": "data/blox-fruits.json",
  "cover": "images/blox-fruits/cover.png",
  "accent": "#ff8a3d",
  "description": "열매·게임패스 시세"
}</pre>
        </section>
        <section>
          <h2>2. 게임 숨기기 / 삭제</h2>
          <ul>
            <li>잠깐 내리고 싶으면 <code>"status": "hidden"</code>으로 바꾸면 사이트에서 사라져요. 데이터는 그대로 남아요.</li>
            <li>완전히 지우려면 <code>games.json</code>에서 해당 항목을 지우고, 게임 JSON과 이미지 폴더도 삭제해요.</li>
          </ul>
        </section>
        <section>
          <h2>3. 아이템 추가 / 시세 업데이트</h2>
          <p>게임 JSON의 <code>items</code> 배열을 수정하고, <code>updated</code> 날짜를 바꿔요.</p>
<pre>{
  "id": "dragon",            // 고유 ID (영문, 겹치면 안 됨)
  "name": "용의 열매",
  "category": "열매",        // categories 목록 중 하나
  "rarity": "Mythic",        // Mythic / Legendary / Epic / Rare / Common
  "value": 4500000,          // 숫자만 (쉼표 X)
  "demand": 5,               // 수요 0~5
  "trend": "up",             // up / down / stable
  "image": "images/blox-fruits/dragon.png",
  "note": ""
}</pre>
        </section>
        <section>
          <h2>4. 이미지</h2>
          <ul>
            <li>아이템 이미지는 투명 배경 PNG, 정사각형(256×256 정도)을 추천해요.</li>
            <li>게임 커버는 16:9 비율(1280×720 정도)을 추천해요.</li>
            <li>이미지가 없거나 경로가 틀리면 아이템 이름 첫 글자가 대신 표시돼요.</li>
          </ul>
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
