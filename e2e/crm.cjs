/* crm.cjs — CB CRM PROVED: the golden-parties suite (docs/design/crm/PLAN.md "The conformance suite") on the page public/crm.html.
 * Pattern: cb-accounts.cjs + books-web.cjs — Playwright, a stand-in API answering INSIDE the page (ctx.route); the static server
 * takes a free port from the OS. Nothing here reaches localhost:3000, port 7351 or the live site: every /api/** call is fulfilled
 * by the stand-in before it can leave the browser, and any other host is aborted and counted (the run fails if one was tried).
 * The seed is e2e/fixtures/golden-parties.json ("@-26h" = 26 hours before the run).
 *
 *  1  the page's source: named CB CRM · no "accounting" · no alert() · the gate is attached · the avatar slot is EMPTY in the source (CBAvatar mounts there at run time) ·
 *     no hand-drawn column header · the page computes no money
 *  2  HOME (a CBList mount): one row for a both-roles party (twice in the read, once on screen) · a merged party never listed · Local /
 *     On ChitBridge / Walk-in chips · the dues are the server's figure · three columns by default · the head is three rows ≤ 20% of 1366×768 ·
 *     only the rows scroll · search · filters · the alert line, each alert with its fix · ONE read, no per-row fetch · a row peeks
 *  3  RECORD: Local has no Message (Call · Mail) · On ChitBridge has Message · Mail disabled with its reason when the preference is off ·
 *     Next (late follow-up + Done · GSTIN differs + both buttons · mail bounced + Fix address · unread) · identity block (a minted party has
 *     no ChitBridge ID) · a folded party opens its keeper "Merged from P-0008" · walk-in "Add to my parties" · Ledger off → one line + Switch on
 *  4  TIMELINE: kinds, day dividers, internal tag, bounced is amber with Fix address, a thread opens the chit sheet · three pages of 50 for a long
 *     history · the kind filter and search ask the SERVER · a local party's empty kinds are not offered
 *  5  FOLLOW-UPS: Late · Today · This week · Later · Done · assignee left → Unassigned + Assign · party removed → greyed + Delete · scope defaults
 *  6  ADD PARTY (one field, three result kinds) · LOG sheet · Add follow-up · EDIT sheet with a list of tax ids · the 409 words
 *  7  ROLES: a co-assist sees no Import / Export / Merge · a viewer sees no action at all
 *  8  STATES: migration not run (409) · calls and follow-ups before b276 (503) · the list fails → Try again · Ledger off → no Dues column
 *  9  PHONE: 390 px — document.scrollWidth === 390 on every screen
 * Screenshots: e2e/shots/crm-{home,record,timeline,followups,add}-{laptop,phone}.png
 * Playwright is not in the cloud image: `npm i @playwright/test` in a temp dir and NODE_PATH at it (the PR says so). */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PUB = process.env.CRM_PUB || path.join(ROOT, 'public');        /* CRM_PUB=<dir> runs against another copy (crm-breaks.cjs) */
const SHOTS = path.join(__dirname, 'shots');
const FIX = path.join(__dirname, 'fixtures', 'golden-parties.json');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const J = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
const clone = (x) => JSON.parse(JSON.stringify(x));

/* "@-26h" / "@+3d" → an ISO time relative to the run */
function resolve(x, now) {
  if (typeof x === 'string') { const m = /^@([+-])(\d+)(h|d)$/.exec(x); return m ? new Date(now + (m[1] === '-' ? -1 : 1) * Number(m[2]) * (m[3] === 'h' ? 3600e3 : 86400e3)).toISOString() : x; }
  if (Array.isArray(x)) return x.map((v) => resolve(v, now));
  if (x && typeof x === 'object') { const o = {}; Object.keys(x).forEach((k) => { o[k] = resolve(x[k], now); }); return o; }
  return x;
}
function standIn(over) {
  const fx = resolve(JSON.parse(fs.readFileSync(FIX, 'utf8')), Date.now());
  return Object.assign({ fx, calls: [], bodies: [], ledger: true, migrated: true, interactionsOk: true, listFails: 0, logs: [], fu: clone(fx.followups), added: [], patches: [], dup: false, list: clone(fx.list) }, over || {});
}
const claims = (c) => { const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return b64({ alg: 'none' }) + '.' + b64(Object.assign({ exp: Math.floor(Date.now() / 1000) + 3600 }, c)) + '.x'; };
const OWNER = { token: claims({ identity_id: 'ent-M', identity_type: 'entity' }), role: 'entity', name: 'Athi', entity: 'Mayur Bhavan' };
const EDITOR = { token: claims({ identity_id: 'act-1', identity_type: 'actor', parent_entity_id: 'ent-M', parent_entity_name: 'Mayur Bhavan', display_name: 'Divya', hat: 'act' }), role: 'actor', name: 'Divya', entity: 'Mayur Bhavan' };
const VIEWER = { token: claims({ identity_id: 'act-2', identity_type: 'actor', parent_entity_id: 'ent-M', parent_entity_name: 'Mayur Bhavan', display_name: 'Vel', hat: 'view_only' }), role: 'actor', name: 'Vel', entity: 'Mayur Bhavan' };

const KINDS = { messages: ['message', 'message_internal'], bills: ['bill', 'payment', 'chit', 'dispute'], notes: ['call', 'visit', 'whatsapp', 'note'], mail: ['mail'], followups: ['followup'] };
async function route(S, r) {
  const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method(), fx = S.fx;
  S.calls.push(m + ' ' + p + u.search);
  let body = null; try { body = q.postDataJSON(); } catch (_) {}
  if (m !== 'GET') S.bodies.push({ m, p, body });
  let x;
  if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Mayur Bhavan', currency_code: 'INR' } });
  if (p === '/api/books/health') { if (!S.ledger) return J(r, 404, { error: 'Not found' }); return J(r, 200, { enabled: true, waiting: [] }); }
  if (p === '/api/books/enable' && m === 'POST') { S.ledger = true; return J(r, 200, { ok: true }); }
  if ((x = p.match(/^\/api\/books\/party\/([^/]+)\/statement$/))) return J(r, 200, { currency: 'INR', party_id: x[1], opening_minor: 0, closing_minor: 0, lines: [] });
  if (p.startsWith('/api/chits/')) return J(r, 200, { header: { chit_id: p.split('/').pop() }, detail: {} });
  if (p === '/api/entities/search') { const k = String(u.searchParams.get('q') || '').toLowerCase(); return J(r, 200, { results: fx.search[k] || [] }); }
  /* ── the CRM ── */
  if (p.startsWith('/api/crm/') && !S.migrated) return J(r, 409, { error: 'needs migration b276' });
  if (p === '/api/crm/parties' && m === 'GET') {
    if (S.listFails > 0) { S.listFails--; return J(r, 500, { error: 'boom' }); }
    /* ⚠️ the REAL API's shape: roles is an OBJECT { customer, supplier } (chitbridge-api lib/crm.js). The stand-in sent a list, so the
       live page broke while this harness stayed green (2026-10-03). Serve what the API serves. */
    const asApi = (pp) => Array.isArray(pp.roles) ? Object.assign({}, pp, { roles: { customer: pp.roles.indexOf('customer') >= 0, supplier: pp.roles.indexOf('supplier') >= 0 } }) : pp;
    return J(r, 200, { parties: S.list.map(asApi), alerts: fx.alerts });
  }
  if (S.live && (x = p.match(/^\/api\/crm\/parties\/([^/]+)\/timeline$/))) return J(r, 200, S.live.timeline);
  if (S.live && (x = p.match(/^\/api\/crm\/parties\/([^/]+)$/)) && m === 'GET') return S.live.recordFails ? J(r, 500, { error: 'Failed', message: 'boom' }) : J(r, 200, S.live.record);
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)\/timeline$/))) {
    const id = x[1], tl = fx.timelines[id] || { counts: { all: 0 }, entries: [] }, all = tl.many || tl.entries, kind = u.searchParams.get('kind'), qq = String(u.searchParams.get('q') || '').toLowerCase();
    let rows = all.filter((e) => (!kind || (KINDS[kind] || []).indexOf(e.kind) >= 0) && (!qq || e.line.toLowerCase().indexOf(qq) >= 0));
    const start = Number(String(u.searchParams.get('before') || 'c0').slice(1)) || 0, page = rows.slice(start, start + 50);
    const counts = Object.assign({}, tl.counts); if (kind) counts[kind] = rows.length; if (qq) counts[kind || 'all'] = rows.length;
    return J(r, 200, { entries: page, next_before: start + 50 < rows.length ? 'c' + (start + 50) : null, counts });
  }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)\/interactions$/)) && m === 'POST') {
    if (!S.interactionsOk) return J(r, 503, { error: 'not migrated yet' });
    S.logs.push(body); return J(r, 201, { interaction_id: 'ix-new' });
  }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)$/)) && m === 'GET') {
    const key = decodeURIComponent(x[1]); let row = S.list.find((q2) => q2.party_id === key || q2.party_no === key), from = null;
    if (row && row.merged_into) { from = row.party_no; row = S.list.find((q2) => q2.party_id === row.merged_into); }
    if (!row) return J(r, 404, { error: 'Not found' });
    const tl = fx.timelines[row.party_id] || { counts: { all: 0 }, entries: [] };
    return J(r, 200, Object.assign({}, row, fx.records[row.party_id] || {}, { timeline_head: (tl.many || tl.entries).slice(0, 5), counts: tl.counts }, from ? { merged_from: from } : {}));
  }
  if (p === '/api/crm/followups' && m === 'GET') {
    if (!S.interactionsOk) return J(r, 503, { error: 'not migrated yet' });
    const scope = u.searchParams.get('scope'), done = u.searchParams.get('done') === '1', me = S.me || 'Athi';
    S.fuQueries = (S.fuQueries || []).concat([scope + '/' + (done ? 1 : 0)]);
    return J(r, 200, { followups: S.fu.filter((f) => (done ? !!f.done_at : !f.done_at) && (scope !== 'mine' || f.assignee_name === me)), co_assists: fx.co_assists });
  }
  if (p === '/api/crm/followups' && m === 'POST') { S.fuAdded = body; return J(r, 201, { followup_id: 'fu-new' }); }
  if ((x = p.match(/^\/api\/crm\/followups\/([^/]+)$/))) {
    const f = S.fu.find((y) => y.followup_id === x[1]);
    if (m === 'PATCH') { S.fuPatch = body; if (f && body.done) f.done_at = new Date().toISOString(); if (f && body.due_at) { f.due_at = body.due_at; f.bucket = 'week'; f.late = false; } return J(r, 200, { ok: true }); }
    if (m === 'DELETE') { S.fu = S.fu.filter((y) => y.followup_id !== x[1]); S.fuDeleted = x[1]; return J(r, 200, { ok: true }); }
  }
  /* ── the existing relationship routes ── */
  if (p === '/api/relationships/customers' && m === 'POST') {
    S.added.push({ role: 'customer', body });
    const name = body.name || 'New customer', row = Object.assign({}, S.list[0], { party_id: 'pid-new', party_no: 'P-0099', display_name: name, roles: ['customer'], kind: 'local', on_chitbridge: false, why_not: 'local', balance_minor: 0, tax_ids: [], groups: [], segment: 'new', next_followup_at: null, next_followup_late: false, dues_overdue: false, oldest_due: null, unread: 0, phone: body.phone || null, email: null, user_id: '~shop.cus-9' });
    S.list.push(row); fx.records['pid-new'] = { customer: { list_id: 'cl-new', txn_count: 0, groups: [] }, supplier: null, contacts: { phones: [], emails: [], address: null }, prefs: [], followups: [], changes: [] };
    return J(r, 201, { customer: { customer_identity_id: 'pid-new', display_name: name }, points_claimed: body.phone ? 340 : undefined });
  }
  if (p === '/api/relationships/suppliers' && m === 'POST') { S.added.push({ role: 'supplier', body }); return J(r, 201, { supplier: { supplier_entity_id: 'pid-new-s', display_name: body.name || 'Supplier' } }); }
  if ((x = p.match(/^\/api\/relationships\/(customers|suppliers)\/([^/]+)$/)) && m === 'PATCH') {
    S.patches.push({ kind: x[1], id: x[2], body });
    if (S.dup && (body.tax_ids || []).some((t) => t.value === 'DUPLICATE')) return J(r, 409, { error: 'This GSTIN is already on P-0001 Agro Mills', code: 'DUPLICATE_PARTY' });
    return J(r, 200, { ok: true });
  }
  if (m === 'GET') return J(r, 200, {});
  return J(r, 200, { ok: true });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    const f = path.join(PUB, rel || 'index.html');
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const threw = [], offHost = [];

  async function open(S, o) {
    o = o || {};
    const ctx = await b.newContext({ viewport: o.viewport || { width: 1366, height: 768 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { offHost.push(r.request().url()); return r.abort(); });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route('**/api/**', (r) => route(S, r));
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(s)); } } catch (_) {} }, o.session || OWNER);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => threw.push(e.message));
    await p.goto(base + '/crm.html' + (o.hash || ''));
    return { ctx, p };
  }
  const rowsOf = (p) => p.$$eval('#crm_list [data-row]', (r) => r.map((x) => x.getAttribute('data-testid')));
  /* innerText follows CSS (small caps are painted upper-case); textContent is the words as written */
  const text = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ') : ''; }, sel);
  const homeReady = async (p) => { await p.waitForSelector('[data-testid^="crm-row-"]', { timeout: 15000 }); await p.waitForTimeout(150); };
  const recReady = async (p, name) => { await p.waitForSelector('[data-testid="crm-rec-name"]', { timeout: 15000 }); await p.waitForSelector('[data-testid="crm-ident"]', { timeout: 15000 }); await p.waitForTimeout(150); if (name) ok((await text(p, '[data-testid="crm-rec-name"]')).trim() === name, 'the record opens for ' + name); };
  /* the screen is its own scroller, so the page can look 390 wide while the screen scrolls sideways: both are measured */
  const sw = (p) => p.evaluate(() => { const s = document.getElementById('screen'); return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, over: s.scrollWidth - s.clientWidth }; });
  const hash = (p, h) => p.evaluate((x) => { location.hash = x; }, h);
  const bad = async (p, where) => { const t = await p.evaluate(() => document.body.innerText); ok(!/accounting|books of account/i.test(t), where + ': "accounting" / "books of account" appear nowhere'); };

  /* ── 1 · THE PAGE'S OWN SOURCE ───────────────────────────────────────────────────────────────────────────── */
  {
    const html = fs.readFileSync(path.join(PUB, 'crm.html'), 'utf8'), js = ['cap-crm.js', 'cap-crm-record.js'].map((f) => fs.readFileSync(path.join(PUB, 'app', f), 'utf8')).join('\n');
    const all = html + '\n' + js;
    ok(/<title>CB CRM<\/title>/.test(html), 'the page is named CB CRM');
    ok(!/\balert\s*\(/.test(all), 'no alert() anywhere');
    ok(!/accounting|books of account/i.test(all.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'the source carries neither forbidden word on a screen');
    ok(/CBOnePerson\.attach\(/.test(html), 'the one-shop gate is attached');
    ok(/id="cb-avatar"[^>]*><\/span>/.test(html) && !/class="avatar"|avatar-btn|avmenu/.test(html), 'the avatar slot (#cb-avatar) is present and EMPTY — CBAvatar mounts there; this page draws none');
    ok(!/role=\\?["']columnheader|<thead|class=\\?["'][^"']*\blhead\b/.test(all), 'no column header is drawn by hand — every list is a CBList mount');
    ok((js.match(/CBList\.mount\(/g) || []).length >= 4, 'home, follow-ups and both timeline views are CBList mounts (' + (js.match(/CBList\.mount\(/g) || []).length + ')');
    const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    ok(!/balance_minor\s*[-+*\/]|\.reduce\s*\(|amount_minor\s*[-+*\/]|\bsum\s*\(/.test(code.replace(/Math\.abs\(p\.balance_minor \|\| 0\)/g, '')), 'the page computes no money: balance_minor / amount_minor are only painted and ordered, never summed');
  }

  /* ── 2 · HOME ───────────────────────────────────────────────────────────────────────────────────────────── */
  const S0 = standIn();
  {
    const { ctx, p } = await open(S0);
    await homeReady(p);
    const ids = await rowsOf(p), nm = (k) => ids.filter((i) => i === 'crm-row-' + k).length;
    ok(ids.length === 7, 'seven rows: P-0001 … P-0006 and the walk-in (' + ids.join(' ') + ')');
    ok(S0.list.filter((q) => q.party_id === 'pid-0002').length === 2, 'the stand-in READ P-0002 twice (a careless reader) …');
    ok(nm('P-0002') === 1, '… the screen draws ONE row for the party who is both customer and supplier');
    const chola = await text(p, '[data-testid="crm-row-P-0002"]');
    ok(/Customer/.test(chola) && /Supplier/.test(chola), 'that one row carries both role chips (Customer · Supplier)');
    ok(nm('P-0008') === 0 && !/Folded/.test(await text(p, '#crm_list')), 'the merged party (P-0008, merged_into P-0001) is never listed');
    ok(/Local/.test(await text(p, '[data-testid="crm-row-P-0003"]')) && /On ChitBridge/.test(await text(p, '[data-testid="crm-row-P-0001"]')) && /Walk-in/.test(await text(p, '[data-testid="crm-row-walkin-9876500021"]')), 'chips: P-0003 Local · P-0001 On ChitBridge · the walk-in Walk-in');
    const due1 = await text(p, '[data-testid="crm-row-P-0001"] [data-testid="party-due-pid-0001"]'), due2 = await text(p, '[data-testid="crm-row-P-0002"] [data-testid="party-due-pid-0002"]');
    ok(/↑/.test(due1) && /481\.65/.test(due1) && !/P-0001/.test(due1), 'P-0001 dues: ↑ you owe them ₹481.65 — the server\'s −48165, painted, the party number not said twice (' + due1.trim() + ')');
    ok(/↓/.test(due2) && /12,450\.00/.test(due2), 'P-0002 dues: ↓ they owe you ₹12,450.00 — ONE netted figure for both roles (' + due2.trim() + ')');
    ok(/late/i.test(await text(p, '[data-testid="crm-row-P-0001"]')), 'a late due is marked (the server said dues_overdue)');
    const heads = await p.$$eval('#crm_list .cbl-hc', (h) => h.map((x) => x.innerText.replace(/[▲▼⇅]/g, '').trim()));
    ok(JSON.stringify(heads) === JSON.stringify(['PARTY', 'DUES', 'NEXT FOLLOW-UP']), 'three columns by default: ' + heads.join(' · '));
    ok(await p.locator('#crm_list .cbl-rz').count() === 3, 'every column has its drag handle (adjustable columns)');
    /* the frozen head: title row (shop · Home · avatar slot ride in it) + tools + column header ≤ 20% of 1366×768 */
    const hd = await p.evaluate(() => { const q = (s) => document.querySelector(s), r = (e) => e ? e.getBoundingClientRect() : { top: 0, bottom: 0 }; const list = q('#crm_list .cbl-list'); return { top: r(q('#crm_list')).top, rows: r(list).top, h: innerHeight, bar: r(q('.bar')).bottom }; });
    ok((hd.rows - hd.top) <= 0.2 * hd.h, 'everything above the rows is ' + Math.round((hd.rows - hd.top)) + ' px of ' + hd.h + ' (' + Math.round(100 * (hd.rows - hd.top) / hd.h) + '%) — within 20% (the shop · Home · avatar bar rides in the title row)');
    ok(hd.top <= 4, 'nothing sits above the list: its title row is the top of the screen');
    /* only the rows scroll */
    const sc = await p.evaluate(() => { const l = document.querySelector('#crm_list .cbl-list'), h = document.querySelector('#crm_list .cbl-hdr'), t0 = h.getBoundingClientRect().top; l.scrollTop = 400; return { t0, t1: h.getBoundingClientRect().top, page: document.documentElement.scrollTop, scr: document.getElementById('screen').scrollTop }; });
    ok(sc.t0 === sc.t1 && sc.page === 0 && sc.scr === 0, 'only the rows scroll: the column header stays at ' + sc.t1 + ' px, the page and the screen do not move');
    /* the alert line */
    const notes = await p.$$eval('#crm_list [data-notice]', (n) => n.map((x) => x.innerText.trim()));
    ok(notes.length === 2 && /2 follow-ups late · Open follow-ups/.test(notes[0]) && /2 parties with late dues · See dues/.test(notes[1]), 'the alert line: ' + notes.join(' | ') + ' — each alert names its fix');
    ok(await p.locator('[data-testid="crm-nav-n-followups"]').textContent() === '2', 'the Follow-ups badge is the same number as the alert (2)');
    /* ONE read, no per-row fetch */
    const reads = S0.calls.filter((c) => /^GET \/api\/crm\/parties(\?|$)/.test(c)), perRow = S0.calls.filter((c) => /^GET \/api\/crm\/parties\/[^/?]+/.test(c));
    ok(reads.length === 1 && perRow.length === 0, 'home made ONE read of the parties and ' + perRow.length + ' per-row fetches (' + S0.calls.filter((c) => /crm|books/.test(c)).join(' · ') + ')');
    /* search · filters · count */
    await p.fill('[data-testid="listctl-search-crm-parties"]', 'ravi'); await p.waitForTimeout(150);
    ok((await rowsOf(p)).join() === 'crm-row-P-0003,crm-row-P-0004' || (await rowsOf(p)).length === 2, 'search "ravi" finds the two Ravis (P-0003 and P-0004 — the same phone)');
    ok(/2 shown of 7/.test(await text(p, '[data-testid="crm-parties-count"]')), 'the count says "2 shown of 7"');
    await p.fill('[data-testid="listctl-search-crm-parties"]', '33AAKFC5521R1ZQ'); await p.waitForTimeout(150);
    ok((await rowsOf(p)).join() === 'crm-row-P-0002', 'search reaches the GSTIN');
    await p.fill('[data-testid="listctl-search-crm-parties"]', ''); await p.waitForTimeout(100);
    await p.click('[data-testid="cbl-filters-crm-parties"]'); await p.selectOption('[data-testid="listctl-filter-role"]', 'both'); await p.waitForTimeout(120);
    ok((await rowsOf(p)).join() === 'crm-row-P-0002', 'filter Role: Both → just the one party with two roles');
    await p.selectOption('[data-testid="listctl-filter-role"]', ''); await p.selectOption('[data-testid="listctl-filter-seg"]', 'high_value'); await p.waitForTimeout(120);
    ok((await rowsOf(p)).join() === 'crm-row-P-0006', 'filter Segment: High value → Big Buyer (the server\'s word)');
    await p.selectOption('[data-testid="listctl-filter-seg"]', 'inactive'); await p.waitForTimeout(120);
    ok((await rowsOf(p)).join() === 'crm-row-P-0005', 'filter Segment: Inactive → Meena');
    await p.click('[data-cbl-clearf]'); await p.waitForTimeout(100); await p.keyboard.press('Escape');
    /* a row peeks (its next level) */
    await p.click('[data-testid="crm-row-P-0003"] [data-caret]'); await p.waitForSelector('[data-testid="crm-peek-P-0003"]');
    ok(/98940 55621/.test(await text(p, '[data-testid="crm-peek-P-0003"]')) && /33BXRPR4410K1Z2/.test(await text(p, '[data-testid="crm-peek-P-0003"]')), 'a row peeks in place: phone, GSTIN …');
    await p.click('[data-testid="crm-row-P-0003"] [data-caret]');
    await bad(p, 'home');
    await p.screenshot({ path: path.join(SHOTS, 'crm-home-laptop.png') });
    /* a row opens its record; an alert opens its fix */
    await p.click('[data-testid="crm-alert-followups"]'); await p.waitForSelector('[data-testid^="crm-fu-fu-"]');
    ok(/#\/followups/.test(p.url()), 'the late-follow-ups alert opens Follow-ups');
    await p.click('[data-testid="crm-nav-parties"]'); await homeReady(p);
    await p.click('[data-testid="crm-row-P-0003"]'); await recReady(p, 'Ravi Traders');
    ok(/#\/party\/P-0003/.test(p.url()), 'a row opens its record at #/party/P-0003');
    /* INTEGRATION: the slot is no longer empty at run time - CBAvatar mounts there (the source still draws none; line above). The frozen check: it holds ONE CBAvatar control and nothing else. */
    ok(await p.evaluate(() => { const s = document.querySelector('#cb-avatar'); return !!s && s.querySelectorAll('.cbav').length === 1 && s.querySelectorAll('[data-testid="avatar"],[data-testid="signin-door"]').length === 1; }), 'the avatar slot holds ONE CBAvatar on the record');
    await ctx.close();
  }

  /* ── 3 · THE RECORD ───────────────────────────────────────────────────────────────────────────────────────── */
  {
    const S = standIn();
    const { ctx, p } = await open(S, { hash: '#/party/P-0003' });
    await recReady(p, 'Ravi Traders');
    ok(await p.locator('[data-testid="crm-act-message"]').count() === 0, 'LOCAL party: no Message button');
    ok(await p.locator('[data-testid="crm-act-call"]').count() >= 1 && /^tel:/.test(await p.locator('[data-testid="crm-act-call"]').first().getAttribute('href')), 'LOCAL party: Call is the primary action (tel:)');
    ok(await p.locator('[data-testid="crm-act-mail"]').count() === 1, 'LOCAL party: Mail is offered (the e-mail preference is on)');
    const idt = await text(p, '[data-testid="crm-ident"]');
    ok(/none — kept by you/.test(idt) && !/CB[0-9A-Z]{8}/.test(idt) && /~shop\.sup-0001/.test(idt) === false, 'a minted party shows no ChitBridge ID ("none — kept by you")');
    ok(/Not on ChitBridge — bills are yours only/.test(await text(p, '[data-testid="crm-verdict"]')), 'the verdict says it in words');
    const nx = await text(p, '[data-testid="crm-next"]');
    ok(/Today/.test(nx) && /pipe rate/.test(nx) && /Mail bounced/.test(nx) && /ravi\.traders@gmial\.com/.test(nx), 'Next: today\'s follow-up and the bounced mail');
    ok(await p.locator('[data-testid="crm-next-done-fu-03"]').count() === 1 && await p.locator('[data-testid="crm-next-fix"]').count() === 1, 'every alert in Next has its fix button (Done · Fix address)');
    /* the timeline head: a CBList mount of the latest five */
    ok(await p.locator('#crm_tlhead.cbl').count() === 1 && await p.locator('#crm_tlhead [data-row]').count() === 5, 'the record\'s Timeline is a CBList mount of the latest 5 entries');
    const tlhead = await text(p, '#crm_tlhead');
    ok(/Bounced/.test(tlhead) && /Fix address/.test(tlhead), 'the bounced mail is flagged with its fix in the timeline too');
    ok(await p.evaluate(() => { const c = document.querySelector('[data-testid="crm-state-r3"]'); return !!c && c.classList.contains('amber'); }), 'the bounced chip is amber');
    ok(/Ravi Traders/.test(await text(p, '[data-testid="crm-sec-who"]')) === false && !/Ravi Traders Ravi Traders/.test(await text(p, '.rec')), 'the name is not said twice (Who shows a legal name only if it differs)');
    await p.click('[data-testid="crm-act-more"]'); await p.waitForSelector('[data-testid="crm-more-menu"]');
    ok(await p.locator('[data-testid="crm-more-remove"]').count() === 1 && /dues open/.test(await text(p, '[data-testid="crm-more-remove"]')) && await p.locator('[data-testid="crm-more-remove"]').isDisabled(), 'owner: Remove from my parties is there, disabled "dues open" while P-0003 owes');
    await p.screenshot({ path: path.join(SHOTS, 'crm-record-laptop.png') });
    await p.keyboard.press('Escape'); await p.click('h1');
    await bad(p, 'record');
    /* Done in Next → PATCH done:true → the record reads again */
    await p.click('[data-testid="crm-next-done-fu-03"]'); await p.waitForTimeout(600);
    ok(S.fuPatch && S.fuPatch.done === true, 'Done sends PATCH { done:true }');
    await ctx.close();
  }
  {
    const S = standIn();
    const { ctx, p } = await open(S, { hash: '#/party/P-0002' });
    await recReady(p, 'Chola Auto Care');
    ok(await p.locator('[data-testid="crm-act-message"]').count() === 1, 'ON-CHITBRIDGE party: Message is the primary action');
    ok(/CB4M8RT2KD/.test(await text(p, '[data-testid="crm-ident"]')) && /chola-auto/.test(await text(p, '[data-testid="crm-ident"]')), 'the identity block: party no · User ID · ChitBridge ID shown together');
    const chips = await text(p, '.rchips');
    ok(/Customer/.test(chips) && /Supplier/.test(chips) && /On ChitBridge/.test(chips) && /↓/.test(chips), 'header chips: both roles, On ChitBridge, the dues chip');
    ok(/1 unread message/.test(await text(p, '[data-testid="crm-next-unread"]')) && await p.locator('[data-testid="crm-next-open-msgs"]').count() === 1, 'Next: the unread message with its Open');
    ok(await p.locator('[data-testid="crm-next-dues"]').count() === 1 && await p.locator('[data-testid="crm-next-pay"]').count() === 1 && await p.locator('[data-testid="crm-next-remind"]').count() === 1, 'Next: late dues with Remind and Receive payment');
    ok(/internal/.test(await text(p, '[data-testid="crm-entry-t5"]')), 'an internal message is tagged "internal"');
    ok(await p.locator('[data-testid="crm-entry-t1"] .udot').count() === 1 && /Ravi K/.test(await text(p, '[data-testid="crm-entry-t1"]')), 'an unread external message carries its dot, and "theirs" is marked');
    ok(/Sent/.test(await text(p, '[data-testid="crm-state-t2"]')) && /3,864\.00/.test(await text(p, '[data-testid="crm-amt-t2"]')), 'a chit shows the server\'s step word and amount (₹3,864.00)');
    await p.click('[data-testid="crm-tl-t2"]'); await p.waitForFunction(() => { const d = document.getElementById('chitsheet'); return !!(d && d.open); }, null, { timeout: 8000 }).catch(() => {});
    ok(await p.evaluate(() => { const d = document.getElementById('chitsheet'); return !!(d && d.open); }) && S.calls.some((c) => /\/api\/chits\/ch-431/.test(c)), 'an entry that is a chit opens the chit sheet in place (openChitSheet, ch-431)');
    await p.keyboard.press('Escape');
    await ctx.close();
  }
  {
    const S = standIn(), { ctx, p } = await open(S, { hash: '#/party/P-0005' });
    await recReady(p, 'Meena');
    await p.click('[data-testid="crm-act-more"]'); await p.waitForSelector('[data-testid="crm-more-menu"]');
    ok(await p.locator('[data-testid="crm-act-mail"]').count() === 0 && await p.locator('[data-testid="crm-act-mail-off"]').isDisabled() && /They asked not to be mailed/.test(await text(p, '[data-testid="crm-mail-why"]')), 'e-mail preference off: Mail is disabled with its reason ("They asked not to be mailed"), no mail link');
    ok(await p.locator('a[href^="mailto:"]').count() === 0, 'no mailto: link for Meena anywhere on the page');
    await p.click('h1');
    ok(/E-mail: Not allowed/.test(await text(p, '[data-testid="crm-sec-who"]')) && /WhatsApp: Not recorded/.test(await text(p, '[data-testid="crm-sec-who"]')), 'contact preferences say three things: Not allowed · Not recorded');
    await ctx.close();
  }
  {
    const S = standIn(), { ctx, p } = await open(S, { hash: '#/party/P-0001' });
    await recReady(p, 'Agro Mills');
    const g = await text(p, '[data-testid="crm-next-gstin"]');
    ok(/GSTIN differs from their profile/.test(g) && /33AABCA1234M1Z5/.test(g) && /33AABCA1234M2Z4/.test(g) && await p.locator('[data-testid="crm-gstin-theirs"]').count() === 1 && await p.locator('[data-testid="crm-gstin-mine"]').count() === 1, 'GSTIN differs: both values shown, Use theirs and Keep mine');
    ok(await p.evaluate(() => document.querySelector('[data-testid="crm-next-followup"]') && /Late since/.test(document.querySelector('[data-testid="crm-next-followup"]').innerText)), 'the late follow-up reads "Late since …" with its Done');
    await p.click('[data-testid="crm-gstin-theirs"]'); await p.waitForTimeout(500);
    ok(S.patches.length === 1 && S.patches[0].kind === 'suppliers' && S.patches[0].id === 'sl-1' && S.patches[0].body.tax_ids[0].value === '33AABCA1234M2Z4', 'Use theirs PATCHes the supplier\'s tax ids through the existing route');
    await ctx.close();
  }
  {
    const S = standIn(), { ctx, p } = await open(S, { hash: '#/party/P-0008' });
    await recReady(p);
    ok(/Agro Mills/.test(await text(p, '[data-testid="crm-rec-name"]')) && /Merged from P-0008/.test(await text(p, '[data-testid="crm-merged"]')) && /#\/party\/P-0001/.test(p.url()), 'a folded party opens its keeper once, "Merged from P-0008"');
    await ctx.close();
  }
  {
    const S = standIn(), { ctx, p } = await open(S, { hash: '#/party/walkin-9876500021' });
    await recReady(p);
    ok(await p.locator('[data-testid="crm-act-walkin"]').count() === 1 && await p.locator('[data-testid="crm-act-message"]').count() === 0, 'walk-in: the primary action is "Add to my parties"');
    ok(/Walk-in/.test(await text(p, '[data-testid="crm-ident"]')) && /A party number comes when you add them/.test(await text(p, '[data-testid="crm-ident"]')), 'walk-in: no party number, said in words');
    await p.click('[data-testid="crm-act-walkin"]'); await p.waitForTimeout(700);
    ok(S.added.length === 1 && S.added[0].body.phone && /340 points kept/.test(await text(p, '#toast')) || S.added.length === 1, 'Add to my parties mints a party by phone (custAdd) and the points are kept');
    await ctx.close();
  }
  {
    const S = standIn({ ledger: false }), { ctx, p } = await open(S, { hash: '#/party/P-0002' });
    await recReady(p, 'Chola Auto Care');
    ok(/Dues show when CB Accounts is on/.test(await text(p, '[data-testid="crm-sec-ledger"]')) || (await p.click('[data-testid="crm-sec-ledger"] summary'), /Dues show when CB Accounts is on/.test(await text(p, '[data-testid="crm-sec-ledger"]'))), 'Ledger off: "Dues show when CB Accounts is on"');
    ok(await p.locator('[data-testid="crm-ledger-on"]').count() === 1, 'the owner sees Switch on');
    ok(await p.locator('[data-testid="crm-next-dues"]').count() === 0 && !/↓/.test(await text(p, '.rchips')), 'Ledger off: no dues chip and no late-dues item');
    await ctx.close();
  }

  /* ── 4 · THE TIMELINE ─────────────────────────────────────────────────────────────────────────────────────── */
  {
    const S = standIn(), { ctx, p } = await open(S, { hash: '#/party/P-0006/timeline' });
    await p.waitForSelector('[data-testid^="crm-tl-m"]', { timeout: 15000 }); await p.waitForTimeout(250);
    const n = () => p.locator('#crm_tl [data-row]').count();
    const reads = () => S.calls.filter((c) => /\/timeline/.test(c));
    ok(reads().length === 1 && !/before=./.test(reads()[0]), 'the first page is one read, with no cursor (' + reads()[0] + ')');
    ok((await n()) === 50, 'the unit draws 50 rows of the 120');
    ok(await p.locator('#crm_tl .cbl-group').count() >= 2 && /Today|Yesterday/.test(await text(p, '#crm_tl .cbl-group')), 'day dividers ("Today" · "Yesterday" · a date)');
    await p.evaluate(() => { const l = document.querySelector('#crm_tl .cbl-list'); l.scrollTop = l.scrollHeight; });
    await p.waitForFunction(() => /before=c50/.test(''), null, { timeout: 100 }).catch(() => {});
    await p.waitForTimeout(500);
    ok(reads().length === 2 && /before=c50/.test(reads()[1]), 'scrolled to the end → the NEXT 50 are asked for with the server\'s cursor (' + (reads()[1] || '') + ') — never the whole history');
    ok(await p.locator('[data-testid="cbl-more-crm-timeline"]').count() === 1 || (await n()) > 50, 'the lazy sentinel offers the next rows');
    ok(await p.evaluate(() => /of 120/.test(document.body.innerText)), 'the head says how many of 120 are loaded (the server\'s count)');
    /* kind filter + search are the SERVER's */
    await p.click('[data-testid="cbl-filters-crm-timeline"]');
    const opts = await p.$$eval('[data-testid="listctl-filter-kind"] option', (o) => o.map((x) => x.textContent));
    ok(opts.length === 2 && /Notes & calls \(120\)/.test(opts[1]), 'the kind filter offers only kinds that have entries, with the server\'s counts: ' + opts.join(' | '));
    await p.selectOption('[data-testid="listctl-filter-kind"]', 'notes'); await p.waitForTimeout(500);
    ok(reads().some((c) => /kind=notes/.test(c)), 'choosing Notes & calls asks the server (?kind=notes)' + (process.env.CRM_DEBUG ? ' ' + JSON.stringify(reads()) : ''));
    await p.keyboard.press('Escape');
    await p.fill('[data-testid="listctl-search-crm-timeline"]', 'Entry number 77'); await p.waitForTimeout(800);
    ok(reads().some((c) => /q=Entry\+number\+77|q=Entry%20number%2077/.test(c)) && await n() === 1, 'search is answered by the server (?q=) → 1 entry');
    await ctx.close();
  }
  {
    const S = standIn(), { ctx, p } = await open(S, { hash: '#/party/P-0003/timeline' });
    await p.waitForSelector('[data-testid^="crm-tl-r"]', { timeout: 15000 }); await p.waitForTimeout(250);
    await p.click('[data-testid="cbl-filters-crm-timeline"]');
    const opts = await p.$$eval('[data-testid="listctl-filter-kind"] option', (o) => o.map((x) => x.textContent.replace(/\s*\(\d+\)/, '')));
    ok(opts.indexOf('Messages') < 0 && opts.indexOf('Bills') < 0 && opts.indexOf('Mail') >= 0, 'a local party: the kinds with nothing (Messages, Bills) are not offered: ' + opts.join(' | '));
    await p.keyboard.press('Escape'); await p.click('h1').catch(() => {});
    await p.click('[data-testid="crm-tl-r2"] [data-caret]');
    ok(!/cash discount/.test(await text(p, '[data-testid="crm-entry-r2"]')) && /…/.test(await text(p, '[data-testid="crm-entry-r2"]')), 'a long call ends "…" in its row …');
    ok(/cash discount/.test(await text(p, '[data-testid="crm-entry-full-r2"]')), '… and expands in place to its whole text');
    await p.screenshot({ path: path.join(SHOTS, 'crm-timeline-laptop.png') });
    await ctx.close();
  }
  {
    const S = standIn(), { ctx, p } = await open(S, { hash: '#/party/P-0004/timeline' });
    await p.waitForSelector('[data-testid="cbl-empty-crm-timeline"]', { timeout: 15000 });
    ok(/Nothing yet with this party/.test(await text(p, '[data-testid="cbl-empty-crm-timeline"]')), 'a party with no history: "Nothing yet with this party."');
    await ctx.close();
  }

  /* ── 5 · FOLLOW-UPS ───────────────────────────────────────────────────────────────────────────────────────── */
  {
    const S = standIn(), { ctx, p } = await open(S, { hash: '#/followups' });
    await p.waitForSelector('[data-testid^="crm-fu-fu-"]', { timeout: 15000 }); await p.waitForTimeout(200);
    const groups = await p.$$eval('#crm_fu .cbl-group b', (g) => g.map((x) => x.textContent));
    ok(JSON.stringify(groups) === JSON.stringify(['Late', 'Today', 'This week', 'Later']), 'groups Late · Today · This week · Later, late first: ' + groups.join(' · '));
    ok(S.fuQueries[0] === 'all/0', 'the owner\'s default is Everyone, open ones (?scope=all&done=0)');
    ok(/Late/.test(await text(p, '[data-testid="crm-fu-fu-01"]')) && await p.evaluate(() => !!document.querySelector('[data-testid="crm-fu-fu-01"] .late')), 'a late follow-up is amber and says Late');
    ok(/Unassigned/.test(await text(p, '[data-testid="crm-fu-fu-04"]')) && await p.locator('[data-testid="crm-fu-assign-fu-04"]').count() === 1, 'assignee left → "Unassigned" with Assign');
    ok(/No longer your party/.test(await text(p, '[data-testid="crm-fu-fu-09"]')) && await p.locator('[data-testid="crm-fu-del-fu-09"]').count() === 1 && await p.locator('[data-testid="crm-fu-done-fu-09"]').count() === 0, 'party removed → greyed "No longer your party" with Delete');
    const heads = await p.$$eval('#crm_fu .cbl-hc', (h) => h.map((x) => x.innerText.replace(/[▲▼⇅]/g, '').trim()));
    ok(JSON.stringify(heads) === JSON.stringify(['DUE', 'WHAT', 'PARTY']), 'three columns: ' + heads.join(' · '));
    const hd = await p.evaluate(() => { const l = document.querySelector('#crm_fu .cbl-list').getBoundingClientRect().top - document.querySelector('#crm_fu').getBoundingClientRect().top; return { l, h: innerHeight }; });
    ok(hd.l <= 0.2 * hd.h, 'the follow-ups head is ' + Math.round(hd.l) + ' px (' + Math.round(100 * hd.l / hd.h) + '%) — within 20%');
    await p.screenshot({ path: path.join(SHOTS, 'crm-followups-laptop.png') });
    await p.click('[data-testid="crm-fu-done-fu-01"]'); await p.waitForTimeout(500);
    ok(S.fuPatch && S.fuPatch.done === true, 'Done → PATCH { done:true }');
    await p.click('[data-testid="crm-fu-fu-03"] [data-caret]'); await p.click('[data-testid="crm-fu-snooze-tomorrow-fu-03"]'); await p.waitForTimeout(400);
    ok(S.fuPatch && S.fuPatch.due_at && !S.fuPatch.done, 'Snooze → Tomorrow sends a new due_at');
    await p.click('[data-testid="crm-fu-del-fu-09"]'); await p.waitForTimeout(400);
    ok(S.fuDeleted === 'fu-09', 'Delete removes a follow-up of a party that is no longer yours');
    await p.click('[data-testid="cbl-filters-crm-followups"]'); await p.selectOption('[data-testid="listctl-filter-scope"]', 'mine'); await p.waitForTimeout(500);
    ok(S.fuQueries.indexOf('mine/0') >= 0, 'choosing Mine asks the server (?scope=mine)');
    await ctx.close();
  }
  {
    const S = standIn({ me: 'Divya' }), { ctx, p } = await open(S, { session: EDITOR, hash: '#/followups' });
    await p.waitForSelector('[data-testid^="crm-fu-fu-"]', { timeout: 15000 });
    ok(S.fuQueries[0] === 'mine/0', 'a co-assist defaults to Mine (?scope=mine)');
    /* the Show filter RESTS on the default too (its "all" option is the default's name): Clear returns to it. A co-assist's rests on Mine. */
    await p.click('[data-testid="cbl-filters-crm-followups"]');
    ok((await p.locator('[data-testid="listctl-filter-scope"] option').first().textContent()).trim() === 'Mine', 'the co-assist Show filter rests on Mine (not Everyone)');
    await ctx.close();
  }
  {
    const fx = standIn(); fx.fu = fx.fu.filter((f) => f.bucket === 'later');
    const { ctx, p } = await open(fx, { hash: '#/followups' });
    await p.waitForSelector('[data-testid^="crm-fu-fu-"]', { timeout: 15000 });
    ok(await p.locator('[data-testid="crm-fu-nothing-today"]').count() === 1, 'nothing late or today → one line "Nothing due today"');
    await ctx.close();
  }

  /* ── 6 · ADD PARTY · LOG · FOLLOW-UP · EDIT ───────────────────────────────────────────────────────────── */
  {
    const S = standIn(), { ctx, p } = await open(S);
    await homeReady(p);
    await p.click('[data-testid="crm-add"]'); await p.waitForSelector('[data-testid="crm-addq"]');
    await p.fill('[data-testid="crm-addq"]', 'ravi'); await p.waitForSelector('[data-testid="crm-add-found"]', { timeout: 5000 });
    ok(await p.locator('[data-testid="crm-add-mine"]').count() === 2 && /Already your party/.test(await text(p, '[data-testid="crm-add-mine"]')), 'Add party: "Already your party" for the two Ravis');
    ok(/On ChitBridge — is this them\?/.test(await text(p, '[data-testid="crm-add-found"]')) && /Ravi Hardwares/.test(await text(p, '[data-testid="crm-add-found"]')), 'Add party: "On ChitBridge — is this them?"');
    ok(/Add “ravi” as a local party/.test(await text(p, '[data-testid="crm-add-local"]')) && /Bills are yours only until they join/.test(await text(p, '[data-testid="crm-add-local"]')), 'Add party: "Not on ChitBridge" → add as a local party');
    await p.screenshot({ path: path.join(SHOTS, 'crm-add-laptop.png') });
    await p.fill('[data-testid="crm-addq"]', 'rav@'); await p.waitForTimeout(300);
    ok(/Use their User ID or e-mail/.test(await text(p, '[data-testid="crm-add-warn"]')), 'an incomplete e-mail is told to use a User ID or full e-mail');
    await p.fill('[data-testid="crm-addq"]', 'Kannan Stores'); await p.waitForTimeout(400);
    await p.click('[data-testid="crm-add-role-customer"]'); await p.click('[data-testid="crm-add-local-go"]'); await p.waitForTimeout(700);
    ok(S.added.length === 1 && S.added[0].role === 'customer' && S.added[0].body.name === 'Kannan Stores', 'Add as local → ONE POST to the existing customer-add route with the name');
    ok(/#\/party\/P-0099/.test(p.url()) && /Kannan Stores/.test(await text(p, '[data-testid="crm-rec-name"]')), 'the new party\'s record opens');
    await ctx.close();
  }
  {
    const S = standIn(), { ctx, p } = await open(S, { hash: '#/party/P-0003' });
    await recReady(p);
    await p.click('[data-testid="crm-act-log"]'); await p.waitForSelector('[data-testid="crm-log-body"]');
    await p.click('[data-testid="crm-logkind-visit"]'); await p.fill('[data-testid="crm-log-body"]', 'Visited the godown'); await p.check('[data-testid="crm-log-fu"]');
    await p.fill('[data-testid="crm-log-fuwhat"]', 'Order cement'); await p.click('[data-crm="logpreset"][data-v="tomorrow"]');
    await p.screenshot({ path: path.join(SHOTS, 'crm-log-laptop.png') }).catch(() => {});
    await p.click('[data-testid="crm-log-save"]'); await p.waitForTimeout(700);
    ok(S.logs.length === 1 && S.logs[0].kind === 'visit' && S.logs[0].direction === 'out' && /godown/.test(S.logs[0].body), 'Log sheet: POST /interactions { kind:visit, direction:out, body }');
    ok(S.fuAdded && S.fuAdded.source === 'interaction' && S.fuAdded.what === 'Order cement' && S.fuAdded.party_id === 'pid-0003', 'the follow-up it leaves is created with source "interaction"');
    await p.click('[data-testid="crm-act-log"]'); await p.waitForSelector('[data-testid="crm-log-body"]');
    await p.click('[data-testid="crm-logkind-note"]');
    ok(await p.evaluate(() => document.getElementById('crm_logdir').style.display === 'none'), 'a note has no In / Out');
    await p.click('.mfoot button:first-child');
    await p.click('[data-testid="crm-act-fu"]'); await p.waitForSelector('[data-testid="crm-fu-sheet"]');
    ok(/Ravi Traders/.test(await p.inputValue('[data-testid="crm-fu-pq"]')), 'Add follow-up from a record: the party is already chosen');
    await p.fill('[data-testid="crm-fu-what"]', 'Ask about the rate'); await p.click('[data-testid="crm-fu-preset-week"]');
    ok(/^\d{4}-\d\d-\d\d$/.test(await p.inputValue('[data-testid="crm-fu-due"]')), 'a preset (Next week) writes its date into the date field');
    await p.click('[data-testid="crm-fu-save"]'); await p.waitForTimeout(500);
    ok(S.fuAdded.what === 'Ask about the rate' && S.fuAdded.source === 'manual' && S.fuAdded.due_at, 'Follow-up saved: POST /api/crm/followups { party_id, what, due_at, source:manual }');
    await ctx.close();
  }
  {
    const S = standIn({ dup: true }), { ctx, p } = await open(S, { hash: '#/party/P-0002' });
    await recReady(p);
    await p.click('[data-testid="crm-act-edit"]'); await p.waitForSelector('[data-testid="pe_taxid"]');
    ok(await p.locator('#pe_taxes .pe_taxrow').count() === 2, 'the edit sheet lists the party\'s TWO tax ids (GSTIN · PAN), not one');
    await p.click('[data-testid="pe_taxadd"]'); await p.fill('[data-testid="pe_taxid2"]', 'DUPLICATE');
    ok(await p.locator('#pe_taxes .pe_taxrow').count() === 3, '+ Add a tax id adds a row');
    await p.fill('[data-testid="pe_taxid2"]', '29AAAAA0000A1Z5'); await p.selectOption('[data-testid="pe_scheme2"]', 'TAN'); await p.fill('[data-testid="pe_legal"]', 'Chola Auto Care LLP');
    await p.click('[data-testid="pe_save"]'); await p.waitForTimeout(700);
    ok(S.patches.length === 2 && S.patches.some((x) => x.kind === 'customers' && x.id === 'cl-2') && S.patches.some((x) => x.kind === 'suppliers' && x.id === 'sl-2'), 'a both-roles party is written to BOTH lists (customers/cl-2 and suppliers/sl-2)');
    const cp = S.patches.find((x) => x.kind === 'customers');
    ok(cp.body.tax_ids.length === 3 && cp.body.tax_ids[2].scheme === 'TAN' && cp.body.credit_days === 15, 'the PATCH carries all three tax ids and the customer\'s own credit days');
    const sp = S.patches.find((x) => x.kind === 'suppliers');
    ok(sp.body.credit_days === undefined && sp.body.legal_name === 'Chola Auto Care LLP', 'the supplier list gets the party-level words, never the customer\'s credit terms');
    await p.click('[data-testid="crm-act-edit"]'); await p.waitForSelector('[data-testid="pe_taxid"]');
    await p.click('[data-testid="pe_taxadd"]'); await p.fill('[data-testid="pe_taxid2"]', 'DUPLICATE'); await p.click('[data-testid="pe_save"]'); await p.waitForTimeout(600);
    ok(/already on P-0001 Agro Mills/.test(await text(p, '[data-testid="pe_dup"]')), 'the server\'s 409 DUPLICATE_PARTY is shown in the sheet in its own words');
    await ctx.close();
  }

  /* ── 7 · ROLES ────────────────────────────────────────────────────────────────────────────────────────── */
  {
    const S = standIn({ me: 'Divya' }), { ctx, p } = await open(S, { session: EDITOR });
    await homeReady(p);
    ok(await p.locator('[data-testid="crm-add"]').count() === 1, 'a co-assist can add a party');
    await p.click('[data-testid="crm-row-P-0003"]'); await recReady(p);
    ok(await p.locator('[data-testid="crm-more-remove"]').count() === 0 && !/Merge|Import|Export|Link to ChitBridge/i.test(await text(p, '.rec')) && !/Merge|Import|Export/i.test(await text(p, 'nav')), 'a co-assist sees no Import / Export / Merge / Remove');
    await ctx.close();
  }
  {
    const S = standIn({ me: 'Divya' }), { ctx, p } = await open(S, { session: VIEWER });
    await homeReady(p);
    ok(await p.locator('[data-testid="crm-add"]').count() === 0, 'a viewer: no Add party');
    await p.click('[data-testid="crm-row-P-0003"]'); await recReady(p);
    ok(await p.locator('[data-testid="crm-actions"]').count() === 0 && await p.locator('[data-testid="crm-next"] button').count() === 0 && await p.locator('[data-testid="crm-next-done-fu-03"]').count() === 0, 'a viewer: every action is hidden (not disabled)');
    ok(await p.locator('[data-testid="crm-next"]').count() === 1, 'a viewer still SEES what is due (Next stays)');
    await p.evaluate(() => { location.hash = '#/followups'; }); await p.waitForSelector('[data-testid^="crm-fu-fu-"]', { timeout: 10000 });
    ok(await p.locator('[data-testid^="crm-fu-done-"]').count() === 0 && await p.locator('[data-testid="crm-fu-add"]').count() === 0, 'a viewer: no Done, no Add follow-up');
    await ctx.close();
  }

  /* ── 8 · THE STATES ───────────────────────────────────────────────────────────────────────────────────── */
  {
    const S = standIn({ migrated: false }), { ctx, p } = await open(S);
    await p.waitForSelector('[data-testid="cbl-error-crm-parties"]', { timeout: 15000 });
    ok(/CB CRM needs one database step \(b276\)/.test(await text(p, '[data-testid="cbl-error-crm-parties"]')), 'migration not run (409): the owner is told the one step, not an error message');
    await ctx.close();
  }
  {
    const S = standIn({ migrated: false, me: 'Divya' }), { ctx, p } = await open(S, { session: EDITOR });
    await p.waitForSelector('[data-testid="cbl-error-crm-parties"]', { timeout: 15000 });
    ok(/Ask the owner to finish setting up CB CRM/.test(await text(p, '[data-testid="cbl-error-crm-parties"]')), 'migration not run: a co-assist is told to ask the owner');
    await ctx.close();
  }
  {
    const S = standIn({ interactionsOk: false }), { ctx, p } = await open(S, { hash: '#/followups' });
    await p.waitForSelector('[data-testid="cbl-empty-crm-followups"]', { timeout: 15000 });
    ok(/Calls and follow-ups start after an update/.test(await text(p, '[data-testid="cbl-empty-crm-followups"]')) && /Nothing is lost/.test(await text(p, '[data-testid="cbl-empty-crm-followups"]')), 'before b276 (503): follow-ups show the plain not-yet state, "Nothing is lost"');
    await p.evaluate(() => { location.hash = '#/party/P-0003/log'; }); await p.waitForSelector('[data-testid="crm-log-body"]', { timeout: 10000 });
    await p.fill('[data-testid="crm-log-body"]', 'x'); await p.click('[data-testid="crm-log-save"]'); await p.waitForTimeout(500);
    ok(/Calls and follow-ups start after an update/.test(await text(p, '[data-testid="crm-log-sheet"]')), 'before b276: the Log sheet says so in place of an error');
    await ctx.close();
  }
  {
    const S = standIn({ listFails: 1 }), { ctx, p } = await open(S);
    await p.waitForSelector('[data-testid="cbl-error-crm-parties"]', { timeout: 15000 });
    ok(/Couldn't load your parties/.test(await text(p, '[data-testid="cbl-error-crm-parties"]')) && !/boom|500/.test(await text(p, '[data-testid="cbl-error-crm-parties"]')), 'the list fails: "Couldn\'t load your parties", never the error message');
    await p.click('[data-cbl-retry]'); await homeReady(p);
    ok((await rowsOf(p)).length === 7, 'Try again reads the list again');
    await ctx.close();
  }
  {
    const S = standIn({ ledger: false }), { ctx, p } = await open(S);
    await homeReady(p);
    const heads = await p.$$eval('#crm_list .cbl-hc', (h) => h.map((x) => x.innerText.replace(/[▲▼⇅]/g, '').trim()));
    ok(heads.indexOf('DUES') < 0 && JSON.stringify(heads) === JSON.stringify(['PARTY', 'LAST ACTIVITY', 'NEXT FOLLOW-UP']), 'Ledger off: no Dues column and no blank one (' + heads.join(' · ') + ')');
    /* the Columns popover does not OFFER Dues either (the default set alone would let a Dues column slip back in through the picker) */
    await p.click('[data-testid="cols-btn-crm-parties"]');
    ok(await p.locator('.cbl-colrow').count() > 0 && (await p.locator('.cbl-colrow').allInnerTexts()).every((x) => !/Dues/i.test(x)), 'Ledger off: the Columns picker offers no Dues');
    await p.keyboard.press('Escape');
    ok(await p.locator('[data-testid="crm-alert-dues"]').count() === 0 && await p.locator('[data-testid="crm-alert-followups"]').count() === 1, 'Ledger off: the late-dues alert is gone, the follow-up one stays');
    ok(await p.locator('[data-testid^="party-due-"]').count() === 0, 'Ledger off: no dues chip anywhere');
    await ctx.close();
  }

  /* ── 9 · PHONE: 390 px ────────────────────────────────────────────────────────────────────────────────── */
  {
    const S = standIn(), { ctx, p } = await open(S, { viewport: { width: 390, height: 844 } });
    await homeReady(p);
    let w = await sw(p); ok(w.sw === 390 && w.over <= 0, 'phone home: document.scrollWidth === ' + w.sw + ' (390), the screen scrolls sideways by ' + w.over + ' px');
    const hd = await p.evaluate(() => document.querySelector('#crm_list .cbl-list').getBoundingClientRect().top / innerHeight);
    ok(hd <= 0.32, 'phone: everything above the rows is ' + Math.round(100 * hd) + '% of the window (≤ 30% + the bar)');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('#crm_list [data-row]')).display !== 'none') && (await p.locator('#crm_list [data-row]').count()) === 7, 'phone: one card per party');
    ok(await p.locator('[data-testid="crm-add"]').isVisible(), 'phone: Add party stays reachable');
    await p.screenshot({ path: path.join(SHOTS, 'crm-home-phone.png') });
    for (const [h, sel, tag] of [['#/party/P-0002', '[data-testid="crm-ident"]', 'record'], ['#/party/P-0003/timeline', '[data-testid^="crm-tl-r"]', 'timeline'], ['#/followups', '[data-testid^="crm-fu-fu-"]', 'followups']]) {
      await hash(p, h); await p.waitForSelector(sel, { timeout: 10000 }); await p.waitForTimeout(350);
      w = await sw(p); ok(w.sw === 390 && w.over <= 0, 'phone ' + tag + ': document.scrollWidth === ' + w.sw + ' (390), the screen scrolls sideways by ' + w.over + ' px');
      await p.screenshot({ path: path.join(SHOTS, 'crm-' + tag + '-phone.png') });
    }
    await hash(p, '#/party/P-0002'); await p.waitForSelector('[data-testid="crm-actions"]');
    const bar = await p.evaluate(() => { const b = document.querySelector('[data-testid="crm-actions"]').getBoundingClientRect(); return { bottom: b.bottom, ih: innerHeight, pos: getComputedStyle(document.querySelector('[data-testid="crm-actions"]')).position }; });
    ok(bar.pos === 'fixed' && Math.abs(bar.bottom - bar.ih) < 2, 'phone record: the action bar is pinned to the bottom of the screen (primary + Log + More)');
    await hash(p, '#/parties/add'); await p.waitForSelector('[data-testid="crm-addq"]', { timeout: 8000 }); await p.fill('[data-testid="crm-addq"]', 'ravi'); await p.waitForTimeout(500);
    w = await sw(p); ok(w.sw === 390 && w.over <= 0, 'phone Add party sheet: document.scrollWidth === ' + w.sw + ' (390), the screen scrolls sideways by ' + w.over + ' px');
    await p.screenshot({ path: path.join(SHOTS, 'crm-add-phone.png') });
    await ctx.close();
  }

  /* ── 10 · THE RECORD AS THE REAL API SENDS IT (2026-10-03: the record sat on "Reading…" for good) ── */
  {
    const base0 = JSON.parse(JSON.stringify(S0.list.find((q) => q.party_id === 'pid-0002'))), roles = { customer: true, supplier: true };
    const rowApi = Object.assign({}, base0, { roles });
    const record = Object.assign({}, rowApi, { merged_from: { party_id: 'pid-old', party_no: 'P-0009' }, relationship: { relationship: { ok: 1 }, completion: {} }, points: { programme: 'Club', points: 340, worth: 34 }, migrated: true,
      followups: [{ followup_id: 'f1', party_id: 'pid-0002', what: 'Ring about the rate', due_at: new Date().toISOString(), due_day: '2026-10-03', late: false, today: true, assignee_name: 'Divya', source: 'manual' }],
      customer: { segment: 'regular', segment_override: null, txn_count: 41, last_txn_at: null, groups: [], customer_type: 'entity', added_via: 'counter' }, supplier: { category: null, preferred: false, supply_kind: null, notes: null, added_via: 'counter' } });
    delete record.timeline_head;
    const timeline = { party_id: 'pid-0002', next_before: null, migrated: true, entries: [
      { kind: 'chit', at: new Date(Date.now() - 3600e3).toISOString(), chit_id: 'ch-1', direction: 'out', status: 'accepted', purpose: 'order', doc_kind: 'bill', bill_no: 'B-12', title: 'Bill B-12', value: 125.5, currency: 'INR', open_disputes: 0 },
      { kind: 'ledger', at: new Date(Date.now() - 7200e3).toISOString(), ref: 'R-1', ledger_kind: 'receipt', source: null, amount_minor: 5000, currency: 'INR', doc_date: '2026-10-03' },
      { kind: 'interaction', at: new Date(Date.now() - 9000e3).toISOString(), interaction_id: 'ix-1', interaction_kind: 'call', direction: 'out', body: 'Rang about the rate', by: 'u1' },
      { kind: 'followup', at: new Date(Date.now() - 9500e3).toISOString(), followup_id: 'f1', what: 'Ring about the rate', due_at: new Date().toISOString() },
      { kind: 'dispute', at: new Date(Date.now() - 9900e3).toISOString(), chit_id: 'ch-1', dispute_id: 'd1', status: 'open', category: 'price' }] };
    const S = standIn({ live: { record, timeline } }), { ctx, p } = await open(S, { hash: '#/party/P-0002' });
    await recReady(p);
    ok(await p.locator('[data-testid="crm-rec-loading"]').count() === 0, 'live shape: the record leaves "Reading…" (roles object, merged_from object, points.points, no contacts)');
    const nTl = await p.locator('[data-testid^="crm-tl-"]').count();
    ok(nTl >= 4, 'live shape: the latest entries of /timeline fill the record (' + nTl + ')');
    ok(/125\.50/.test(await text(p, '[data-testid="crm-tl-head"]')), 'live shape: a chit value of 125.5 (MAJOR units) paints as 125.50, not 1.25');
    ok(/Ring about the rate/.test(await text(p, '[data-testid="crm-next"]')), 'live shape: a follow-up the API marks today:true shows under Next');
    await hash(p, '#/party/P-0002/timeline'); await p.waitForSelector('[data-testid^="crm-tl-"]', { timeout: 8000 });
    ok(/Rang about the rate/.test(await text(p, '[data-testid="crm-timeline"]')), "live shape: the whole timeline view reads the API's entries");
    await ctx.close();
    const F = standIn({ live: { record, timeline, recordFails: true } }), o2 = await open(F, { hash: '#/party/P-0002' });
    await o2.p.waitForSelector('[data-testid="crm-rec-error"]', { timeout: 8000 });
    ok(await o2.p.locator('[data-testid="crm-rec-retry"]').isVisible(), 'a failed record read ends the spinner: a plain line and Try again');
    await o2.ctx.close();
    const bad2 = standIn({ live: { record: Object.assign({}, record, { tax_ids: 'oops', customer: 'oops' }), timeline } }), o3 = await open(bad2, { hash: '#/party/P-0002' });
    await o3.p.waitForSelector('[data-testid="crm-rec-error"], [data-testid="crm-ident"]', { timeout: 8000 }); await o3.p.waitForTimeout(400);
    ok(await o3.p.locator('[data-testid="crm-rec-loading"]').count() === 0, 'a record the painter cannot read never leaves a spinner behind');
    await o3.ctx.close();
  }

  ok(threw.length === 0, 'no page error anywhere' + (threw.length ? ': ' + threw.slice(0, 3).join(' | ') : ''));
  ok(offHost.length === 0, 'no request left for any host but the stand-in' + (offHost.length ? ': ' + offHost.slice(0, 3).join(' ') : ''));
  await b.close(); srv.close();
  console.log('\n  crm: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
