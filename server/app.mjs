import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, createReadStream, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const random = () => randomBytes(32).toString('base64url');
const hash = s => createHash('sha256').update(s).digest('hex');
const endpoints = {
  authorize: 'https://apis.roblox.com/oauth/v1/authorize',
  token: 'https://apis.roblox.com/oauth/v1/token',
  userinfo: 'https://apis.roblox.com/oauth/v1/userinfo',
};

export function createApp({ database = ':memory:', siteUrl = 'http://localhost:3000', clientId = '', clientSecret = '', fetchImpl = fetch } = {}) {
  const site = new URL(siteUrl);
  if (site.origin !== siteUrl || (site.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(site.hostname))) throw new Error('SITE_URL must be an HTTPS origin (HTTP is allowed only on localhost)');
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL, display_name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_states (token TEXT PRIMARY KEY, browser TEXT NOT NULL, verifier TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS trades (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id), give_json TEXT NOT NULL, want_json TEXT NOT NULL, note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed')), created INTEGER NOT NULL, completed INTEGER);
    CREATE INDEX IF NOT EXISTS trades_status_id ON trades(status,id DESC);
    CREATE INDEX IF NOT EXISTS trades_user ON trades(user_id,created);
  `);
  const items = new Set(JSON.parse(readFileSync(path.join(ROOT, 'data/blox-fruits.json'))).items.map(i => i.id));
  const ready = Boolean(clientId && clientSecret);
  const secure = site.protocol === 'https:';
  const cookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const now = () => Math.floor(Date.now() / 1000);
  function send(res, status, body, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(JSON.stringify(body));
  }
  function redirect(res, location, cookies = []) { res.writeHead(302, { Location: location, 'Set-Cookie': cookies, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end(); }
  function session(req) {
    const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('vd_session='))?.slice(11);
    if (!token || token.length > 100) return null;
    return db.prepare('SELECT sessions.*, users.username, users.display_name FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?').get(hash(token), now());
  }
  function user(s) { return s ? { id: s.user_id, username: s.username, displayName: s.display_name } : null; }
  async function body(req) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) throw Object.assign(new Error('JSON 요청이 필요합니다.'), { status: 415 });
    let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 12000) throw Object.assign(new Error('요청이 너무 큽니다.'), { status: 413 }); }
    try { return JSON.parse(data); } catch { throw Object.assign(new Error('요청 형식이 올바르지 않습니다.'), { status: 400 }); }
  }
  function validateSlots(slots) {
    if (!Array.isArray(slots) || slots.length < 1 || slots.length > 8) return false;
    const ids = new Set();
    return slots.every(x => { if (!x || !items.has(x.id) || !Number.isInteger(x.qty) || x.qty < 1 || x.qty > 99 || ids.has(x.id)) return false; ids.add(x.id); return Object.keys(x).every(k => k === 'id' || k === 'qty'); });
  }
  async function oauthJSON(url, options) {
    const r = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('OAuth provider request failed');
    return r.json();
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, site);
      const p = url.pathname;
      if (p.startsWith('/api/') || p.startsWith('/auth/')) {
        const s = session(req);
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
          if (!s) return send(res, 401, { error: 'Roblox 로그인이 필요합니다.' });
          if (req.headers.origin !== site.origin || req.headers['x-csrf-token'] !== s.csrf) return send(res, 403, { error: '요청을 확인할 수 없습니다. 새로고침 후 다시 시도해 주세요.' });
        }
        if (p === '/api/me' && req.method === 'GET') return send(res, 200, { user: user(s), csrf: s?.csrf || null, loginAvailable: ready });
        if (p === '/auth/roblox' && req.method === 'GET') {
          if (!ready) return send(res, 503, { error: '로그인 연결을 준비 중입니다.' });
          db.prepare('DELETE FROM oauth_states WHERE expires<?').run(now());
          db.prepare('DELETE FROM sessions WHERE expires<?').run(now());
          const state = random(), browser = random(), verifier = random();
          db.prepare('INSERT INTO oauth_states VALUES(?,?,?,?)').run(hash(state), hash(browser), verifier, now() + 600);
          const target = new URL(endpoints.authorize);
          target.search = new URLSearchParams({ client_id: clientId, redirect_uri: site.origin + '/auth/roblox/callback', response_type: 'code', scope: 'openid profile', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
          return redirect(res, target.href, [cookie('vd_oauth', browser, 600)]);
        }
        if (p === '/auth/roblox/callback' && req.method === 'GET') {
          const state = url.searchParams.get('state');
          const browser = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('vd_oauth='))?.slice(9);
          const saved = state && db.prepare('SELECT * FROM oauth_states WHERE token=?').get(hash(state));
          if (!saved || !browser || saved.browser !== hash(browser) || saved.expires < now()) return send(res, 400, { error: '로그인 요청이 만료됐습니다. 다시 로그인해 주세요.' });
          db.prepare('DELETE FROM oauth_states WHERE token=?').run(hash(state));
          if (url.searchParams.has('error')) return redirect(res, '/#/trades', [cookie('vd_oauth', '', 0)]);
          const code = url.searchParams.get('code');
          if (!code || code.length > 4096) return send(res, 400, { error: '로그인 응답이 올바르지 않습니다.' });
          const tokens = await oauthJSON(endpoints.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code, code_verifier: saved.verifier, redirect_uri: site.origin + '/auth/roblox/callback' }) });
          if (typeof tokens.access_token !== 'string') throw new Error('Missing OAuth access token');
          const profile = await oauthJSON(endpoints.userinfo, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
          // Identity comes ONLY from the authenticated official userinfo response.
          if (!/^[1-9]\d*$/.test(profile.sub) || typeof profile.preferred_username !== 'string' || !profile.preferred_username || typeof profile.name !== 'string') throw new Error('Invalid Roblox profile');
          db.prepare('INSERT INTO users VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,display_name=excluded.display_name').run(profile.sub, profile.preferred_username.slice(0,100), profile.name.slice(0,100));
          if (s) db.prepare('DELETE FROM sessions WHERE token=?').run(s.token);
          const token = random();
          db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token), profile.sub, random(), now() + 7 * 86400);
          return redirect(res, '/#/trades', [cookie('vd_session', token, 7 * 86400), cookie('vd_oauth', '', 0)]);
        }
        if (p === '/api/logout' && req.method === 'POST') { db.prepare('DELETE FROM sessions WHERE token=?').run(s.token); return send(res, 200, { ok: true }, { 'Set-Cookie': cookie('vd_session', '', 0) }); }
        if (p === '/api/trades' && req.method === 'GET') {
          const mine = url.searchParams.get('mine') === '1';
          if (mine && !s) return send(res, 401, { error: '로그인이 필요합니다.' });
          const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
          if (!Number.isSafeInteger(before) || before < 1) return send(res,400,{error:'잘못된 페이지입니다.'});
          const rows = db.prepare(`SELECT trades.*, users.username, users.display_name FROM trades JOIN users ON users.id=trades.user_id WHERE trades.id < ? AND ${mine ? 'user_id = ?' : "status='open'"} ORDER BY trades.id DESC LIMIT 21`).all(...(mine ? [before, s.user_id] : [before]));
          const hasMore = rows.length > 20;
          const trades = rows.slice(0,20).map(r => ({ id:r.id, author:{ id:r.user_id, username:r.username, displayName:r.display_name }, give:JSON.parse(r.give_json), want:JSON.parse(r.want_json), note:r.note, status:r.status, created:r.created, completed:r.completed }));
          return send(res,200,{trades,next:hasMore ? trades.at(-1).id : null});
        }
        if (p === '/api/trades' && req.method === 'POST') {
          const input = await body(req);
          if (!validateSlots(input.give) || !validateSlots(input.want) || typeof input.note !== 'string' || input.note.length > 200 || /[\x00-\x08]/.test(input.note)) return send(res,400,{error:'양쪽 아이템과 수량을 확인해 주세요. 메모는 200자 이내입니다.'});
          const count = db.prepare("SELECT count(*) AS n FROM trades WHERE user_id=? AND status='open'").get(s.user_id).n;
          const recent = db.prepare('SELECT count(*) AS n FROM trades WHERE user_id=? AND created>?').get(s.user_id,now()-60).n;
          if (count >= 5 || recent) return send(res,429,{error:'진행 중인 거래는 최대 5개이며 새 글은 1분 간격으로 등록할 수 있습니다.'});
          const r = db.prepare('INSERT INTO trades(user_id,give_json,want_json,note,created) VALUES(?,?,?,?,?)').run(s.user_id,JSON.stringify(input.give),JSON.stringify(input.want),input.note.trim(),now());
          return send(res,201,{id:Number(r.lastInsertRowid)});
        }
        const completion = /^\/api\/trades\/(\d+)\/complete$/.exec(p);
        if (completion && req.method === 'POST') {
          const r = db.prepare("UPDATE trades SET status='completed',completed=? WHERE id=? AND user_id=? AND status='open'").run(now(),Number(completion[1]),s.user_id);
          return send(res,r.changes ? 200 : 404,r.changes ? {ok:true} : {error:'완료할 거래글을 찾을 수 없습니다.'});
        }
        return send(res,404,{error:'요청을 찾을 수 없습니다.'});
      }
      if (!['GET','HEAD'].includes(req.method)) return send(res,405,{error:'지원하지 않는 요청입니다.'});
      // Explicit public paths: never serve the DB, env files, Git metadata or server code.
      if (!(p === '/' || p === '/index.html' || /^\/(css|js|images|data)\/[\w./-]+$/.test(p))) return send(res,404,{error:'페이지를 찾을 수 없습니다.'});
      const filename = path.resolve(ROOT, '.' + (p === '/' ? '/index.html' : p));
      if (!filename.startsWith(ROOT + path.sep) || p.includes('..')) return send(res,404,{});
      let stat; try { stat=statSync(filename); } catch { return send(res,404,{}); }
      if (!stat.isFile()) return send(res,404,{});
      const type = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(filename)] || 'application/octet-stream';
      res.writeHead(200,{'Content-Type':type,'Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"frame-ancestors 'none'"});
      if (req.method === 'HEAD') res.end(); else createReadStream(filename).pipe(res);
    } catch (error) {
      // Do not log tokens, authorization codes or provider response bodies.
      if (!res.headersSent) send(res,error.status || 502,{error:error.status ? error.message : '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'}); else res.end();
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 15000;
  server.on('close', () => db.close());
  return { server, db };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const database=process.env.DATABASE_PATH || path.join(ROOT,'var','trades.sqlite');
  mkdirSync(path.dirname(database),{recursive:true});
  const { server } = createApp({database,siteUrl:process.env.SITE_URL || 'http://localhost:3000',clientId:process.env.ROBLOX_CLIENT_ID,clientSecret:process.env.ROBLOX_CLIENT_SECRET});
  server.listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log('VALUE DECK server started'));
}
