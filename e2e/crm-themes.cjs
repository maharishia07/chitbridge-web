/* crm-themes.cjs — EVERY THEME READABLE, MEASURED (CB CRM + CB Accounts). Athi, 2026-10-03: in Dark the CRM's title, the selected row's name and the
 * group label were invisible. A look at a screenshot is a guess; this measures.
 *
 * For each page/screen below, in EVERY theme of CBScreen.APP_THEMES (all 16) + Cream, the theme is applied THE WAY THE AVATAR DOES (CBAvatar.applyTheme:
 * the theme's tokens inline on <html>, data-theme + data-themed stamped), then EVERY visible text element on the screen is measured — its colour (alpha
 * included) against the colour actually painted behind it (the ancestors' backgrounds composited) — and sorted into the categories Athi named:
 *   title · row · SELECTED row (the class CBList's keyboard cursor sets) · group label · toolbar button · chip · column head · sidebar · bar · other
 * ≥ 4.5:1 for text, ≥ 3:1 for large text (≥ 24 px, or ≥ 18.66 px bold). Every failing pair is printed; exit 1 on any.
 *
 * Screens: crm.html Parties · a party record · Follow-ups · (+ the Follow-ups nav opens a DIFFERENT view: title, list, no parties list);
 *          accounts.html Day book · Ledgers.
 * Nothing leaves the browser: every /api/** call is fulfilled by a stand-in inside the page (crm.cjs / cb-accounts.cjs pattern).
 * Screenshots: e2e/shots/crm-{parties,record,followups}-{dark,terminal}.png
 * Playwright is not in the cloud image: `npm i @playwright/test` in a temp dir and NODE_PATH at it. */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PUB = process.env.CRMT_PUB || path.join(ROOT, 'public');
const SHOTS = path.join(__dirname, 'shots');
const FIX = path.join(__dirname, 'fixtures', 'golden-parties.json');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const J = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
function resolve(x, now) {
  if (typeof x === 'string') { const m = /^@([+-])(\d+)(h|d)$/.exec(x); return m ? new Date(now + (m[1] === '-' ? -1 : 1) * Number(m[2]) * (m[3] === 'h' ? 3600e3 : 86400e3)).toISOString() : x; }
  if (Array.isArray(x)) return x.map((v) => resolve(v, now));
  if (x && typeof x === 'object') { const o = {}; Object.keys(x).forEach((k) => { o[k] = resolve(x[k], now); }); return o; }
  return x;
}
const FX = resolve(JSON.parse(fs.readFileSync(FIX, 'utf8')), Date.now());
const claims = (c) => { const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return b64({ alg: 'none' }) + '.' + b64(Object.assign({ exp: Math.floor(Date.now() / 1000) + 3600 }, c)) + '.x'; };
const OWNER = { token: claims({ identity_id: 'ent-M', identity_type: 'entity' }), role: 'entity', name: 'Athi', entity: 'Mayur Bhavan' };
const TODAY = new Date().toISOString().slice(0, 10);

/* ── the stand-in: the CRM's reads, and the Ledger's (Day book + Ledgers) ── */
async function route(r) {
  const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method(); let x;
  if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Mayur Bhavan', currency_code: 'INR' } });
  if (p === '/api/books/health') return J(r, 200, { enabled: true, waiting: [] });
  if (p === '/api/books/accounts') return J(r, 200, { accounts: [
    { code: '1300', name: 'Customers (Sundry Debtors)', is_group: false }, { code: '1300-P00001', name: 'Ravi Stores', is_group: false }, { code: '2100', name: 'Suppliers (Sundry Creditors)', is_group: false },
    { code: '1400', name: 'Cash', is_group: false }, { code: '4000', name: 'Sales', is_group: false }, { code: '6010', name: 'Rent', is_group: false }] });
  if (p === '/api/books/trial-balance') return J(r, 200, { currency: 'INR', rows: [{ code: '1300', name: 'Customers (Sundry Debtors)', dr_minor: 600000, cr_minor: 0 }, { code: '1400', name: 'Cash', dr_minor: 1240000, cr_minor: 0 }, { code: '4000', name: 'Sales', dr_minor: 0, cr_minor: 1590000 }, { code: '6010', name: 'Rent', dr_minor: 100000, cr_minor: 0 }], total_dr_minor: 1940000, total_cr_minor: 1840000 });
  if (p === '/api/books/daybook') return J(r, 200, { currency: 'INR', entries: [['k1', 'C2/26-27/0016', 'c1', 'Ravi Stores', 11], ['k2', 'C2/26-27/0017', 'c2', 'Chola Auto Care', 12]].map(([id, no, pid, pname, n]) => ({ entry_id: 'je' + n, entry_no: 'JV/2026-27/0000' + n, posting_date: TODAY, doc_date: TODAY, event_type: 'sale_bill', source_chit_id: id, narration: 'Sale',
    source: { kind: 'bill', ref: no, chit_id: id, how: 'On credit', counter: 'C2', by: 'Mayur Bhavan' },
    lines: [{ code: '1300', name: 'Customers (Sundry Debtors)', party_id: pid, party_name: pname, dr_minor: 300000, cr_minor: 0 }, { code: '4000', name: 'Sales', rate: 12, dr_minor: 0, cr_minor: 267857 }, { code: '2200', name: 'Output CGST', rate: 6, dr_minor: 0, cr_minor: 32143 }] })) });
  if (p.startsWith('/api/books/')) return J(r, 200, {});
  if (p === '/api/folders') return J(r, 200, { folders: [] });
  if (p === '/api/crm/parties' && m === 'GET') {
    const asApi = (pp) => Array.isArray(pp.roles) ? Object.assign({}, pp, { roles: { customer: pp.roles.indexOf('customer') >= 0, supplier: pp.roles.indexOf('supplier') >= 0 } }) : pp;
    return J(r, 200, { parties: FX.list.map(asApi), alerts: FX.alerts });
  }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)\/timeline$/))) { const tl = FX.timelines[x[1]] || { counts: { all: 0 }, entries: [] }; return J(r, 200, { entries: (tl.many || tl.entries).slice(0, 50), next_before: null, counts: tl.counts }); }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)$/)) && m === 'GET') {
    const key = decodeURIComponent(x[1]); const row = FX.list.find((q2) => q2.party_id === key || q2.party_no === key);
    if (!row) return J(r, 404, { error: 'Not found' });
    const tl = FX.timelines[row.party_id] || { counts: { all: 0 }, entries: [] };
    return J(r, 200, Object.assign({}, row, FX.records[row.party_id] || {}, { timeline_head: (tl.many || tl.entries).slice(0, 5), counts: tl.counts }));
  }
  if (p === '/api/crm/followups' && m === 'GET') {
    const done = u.searchParams.get('done') === '1';
    return J(r, 200, { followups: FX.followups.filter((f) => (done ? !!f.done_at : !f.done_at)), co_assists: FX.co_assists });
  }
  if (m === 'GET') return J(r, 200, {});
  return J(r, 200, { ok: true });
}

/* ── the measurement, run INSIDE the page ── */
function measure() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (s) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, under) => { const a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  /* the colour painted behind an element: walk up, collecting backgrounds, composite from the page down. A gradient/image ground is skipped (flagged). */
  function ground(el) {
    const layers = []; let grad = false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') grad = true;
      const bg = rgba(cs.backgroundColor); if (bg[3] > 0) layers.push(bg);
      if (bg[3] >= 1) break;
    }
    let base = [255, 255, 255, 1]; for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return { c: base, grad };
  }
  const CATS = [['selected row', '.cbl-row.sel,.cbl-lrec.sel'], ['title', '.cbl-title h1'], ['group label', '.cbl-group'], ['column head', '.cbl-hc'], ['row', '.cbl-row,.cbl-lrec,.cbl-next'],
    ['toolbar button', '.cbl-tools button,.cbl-tools select,.cbl-tools input,.cbl-seg button,.cbl-count,.cbl-btn'], ['chip', '.tag,.cbl-chip,.cbl-fchip,.optchip,.n'], ['sidebar', '.side'], ['bar', '.bar'], ['heading', 'h1,h2,h3']];
  const out = [], seen = new Set();
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t; (t = walker.nextNode());) {
    const txt = t.nodeValue.replace(/\s+/g, ' ').trim(); if (!txt || !/[A-Za-z0-9]/.test(txt)) continue;
    const el = t.parentElement; if (!el || seen.has(el) || /^(SCRIPT|STYLE|TITLE|OPTION)$/.test(el.tagName)) continue;
    if (el.closest('#cb-avatar,[hidden],.sr-only,.cbl-live,dialog:not([open]),#toast')) continue;
    if (!vis(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el); let a = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) a *= Number(getComputedStyle(n).opacity);
    const g = ground(el); let fg = rgba(cs.color); fg[3] *= a; fg = over(fg, g.c);
    const size = parseFloat(cs.fontSize), w = Number(cs.fontWeight) >= 700 || cs.fontWeight === 'bold', large = size >= 24 || (size >= 18.66 && w);
    let cat = 'other'; for (const [name, sel] of CATS) { if (el.closest(sel)) { cat = name; break; } }
    out.push({ cat, text: txt.slice(0, 28), ratio: Math.round(ratio(fg, g.c) * 100) / 100, need: large ? 3 : 4.5, grad: g.grad, tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') });
  }
  return out;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    const f = (!rel || rel === 'index.html') ? path.join(ROOT, 'index.html') : path.join(PUB, rel);
    if (((!f.startsWith(PUB)) && f !== path.join(ROOT, 'index.html')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const threw = [], offHost = [];

  async function open(urlPath) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { offHost.push(r.request().url()); return r.abort(); });
    await ctx.route(/fonts.(googleapis|gstatic).com/, (r) => r.abort());
    await ctx.route('**/api/**', route);
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_seeded')) { localStorage.setItem('cb_seeded', '1'); localStorage.setItem('cb_sess', JSON.stringify(s)); } } catch (_) {} }, OWNER);
    const p = await ctx.newPage(); p.on('pageerror', (e) => threw.push(e.message));
    await p.goto(base + urlPath);
    return { ctx, p };
  }

  /* the screens: [name, page, how to reach it, a selector that proves it is up] */
  const crmSteps = (hash, ready) => async (p) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForSelector(ready, { timeout: 15000 }); await p.waitForTimeout(300); };
  const accSteps = (tab, ready) => async (p) => { await p.waitForSelector('[data-testid="acc-nav-daybook"]', { timeout: 15000 }); await p.click('[data-testid="acc-nav-' + tab + '"]'); await p.waitForSelector(ready, { timeout: 15000 }); await p.waitForTimeout(300); };
  const SCREENS = [
    { name: 'crm Parties', url: '/crm.html', go: crmSteps('#/parties', '[data-testid^="crm-row-"]'), shot: 'crm-parties' },
    { name: 'crm Party record', url: '/crm.html', go: crmSteps('#/party/P-0001', '[data-testid="crm-ident"]'), shot: 'crm-record' },
    { name: 'crm Follow-ups', url: '/crm.html', go: crmSteps('#/followups', '[data-testid^="crm-fu-"]'), shot: 'crm-followups' },
    { name: 'accounts Day book', url: '/accounts.html', go: accSteps('daybook', '[data-testid^="db-entry-"]') },
    { name: 'accounts Ledgers', url: '/accounts.html', go: accSteps('ledgers', '[data-testid="lt-band-people"]') },
  ];

  const keys = await (async () => { const { p, ctx } = await open('/crm.html'); await p.waitForFunction(() => window.CBScreen && window.CBAvatar); const k = await p.evaluate(() => Object.keys(CBScreen.APP_THEMES)); await ctx.close(); return k; })();
  ok(keys.length === 16 && keys.indexOf('cream') >= 0 && keys.indexOf('dark') >= 0 && keys.indexOf('terminal') >= 0, 'APP_THEMES has all 16 themes (' + keys.join(' ') + ')');

  const table = {};   /* screen → theme → [pairs measured, failures] */
  const fails = [];
  for (const sc of SCREENS) {
    const { ctx, p } = await open(sc.url);
    await p.waitForFunction(() => window.CBScreen && window.CBAvatar);
    await sc.go(p);
    table[sc.name] = {};
    for (const k of keys) {
      await p.evaluate((key) => { CBAvatar.applyTheme(key); }, k);
      await p.waitForTimeout(60);
      /* the selected row: the class CBList's cursor sets on the row the person is on */
      await p.evaluate(() => { document.querySelectorAll('.cbl-row.sel,.cbl-lrec.sel').forEach((n) => n.classList.remove('sel')); const r = document.querySelector('.cbl-row[data-row],.cbl-lrec[data-row]'); if (r) r.classList.add('sel'); });
      const pairs = await p.evaluate(measure);
      const bad = pairs.filter((x) => x.ratio < x.need);
      table[sc.name][k] = [pairs.length, bad.length, pairs.reduce((m, x) => Math.min(m, x.ratio), 99)];
      bad.forEach((x) => fails.push(Object.assign({ screen: sc.name, theme: k }, x)));
      if (sc.shot && (k === 'dark' || k === 'terminal')) { await p.evaluate(() => { document.querySelectorAll('.cbl-row.sel').forEach((n) => n.classList.remove('sel')); }); await p.screenshot({ path: path.join(SHOTS, sc.shot + '-' + k + '.png') }); }
    }
    await ctx.close();
  }

  /* the cases Athi named must have been MEASURED on the screens that carry them (a measurement of nothing proves nothing) */
  {
    const { ctx, p } = await open('/crm.html'); await p.waitForFunction(() => window.CBScreen && window.CBAvatar);
    await SCREENS[0].go(p); await p.evaluate(() => CBAvatar.applyTheme('dark'));
    await p.evaluate(() => { const r = document.querySelector('.cbl-row[data-row]'); if (r) r.classList.add('sel'); });
    const cats = new Set((await p.evaluate(measure)).map((x) => x.cat));
    ['title', 'row', 'selected row', 'column head', 'toolbar button', 'chip'].forEach((c) => ok(cats.has(c), 'Parties measured the category "' + c + '"'));
    /* the Segment toggle and its group label: turn grouping on if the list has the switch */
    const seg = p.locator('[data-testid="crm-seg-toggle"],[data-cbl-group],button:has-text("Segment")').first();
    if (await seg.count()) { await seg.click().catch(() => {}); await p.waitForTimeout(200); }
    const after = await p.evaluate(measure);
    ok(after.some((x) => x.cat === 'group label') || (await p.locator('.cbl-group').count()) === 0, 'grouped Parties: the group label is measured when it is drawn');
    await ctx.close();
  }

  /* ── the numbers ── */
  const th = ['cream'].concat(keys.filter((k) => k !== 'cream'));
  console.log('\n  min contrast per screen × theme (pairs measured / failing / lowest ratio):');
  Object.keys(table).forEach((s) => {
    const tot = th.reduce((a, k) => [a[0] + table[s][k][0], a[1] + table[s][k][1]], [0, 0]);
    const worst = th.reduce((w, k) => table[s][k][2] < w[1] ? [k, table[s][k][2]] : w, ['', 99]);
    console.log('   ' + s.padEnd(20) + ' pairs ' + String(tot[0]).padStart(5) + '  failing ' + String(tot[1]).padStart(4) + '  lowest ' + worst[1] + ' (' + worst[0] + ')');
  });
  if (fails.length) {
    console.log('\n  FAILING PAIRS (' + fails.length + '):');
    const grouped = {};
    fails.forEach((f) => { const g = f.screen + ' | ' + f.theme + ' | ' + f.cat; (grouped[g] = grouped[g] || []).push(f); });
    Object.keys(grouped).slice(0, 120).forEach((g) => { const a = grouped[g]; console.log('   ' + g + ' | ' + a.length + 'x | worst ' + Math.min.apply(null, a.map((f) => f.ratio)) + ' (need ' + a[0].need + ') e.g. "' + a[0].text + '" <' + a[0].tag + '>'); });
  }
  ok(fails.length === 0, 'every text pair on every screen in all 16 themes clears AA (' + fails.length + ' failing of ' + Object.keys(table).reduce((a, s) => a + th.reduce((b, k) => b + table[s][k][0], 0), 0) + ' measured)');

  /* ── the Follow-ups nav opens a DIFFERENT view ── */
  {
    const { ctx, p } = await open('/crm.html'); await p.waitForFunction(() => window.CBScreen && window.CBAvatar);
    await p.waitForSelector('[data-testid^="crm-row-"]', { timeout: 15000 });
    const title = () => p.evaluate(() => { const h = document.querySelector('#screen .cbl-title h1'); return h ? h.textContent.trim() : ''; });
    ok(/Parties/.test(await title()) && await p.locator('#crm_list').count() === 1 && await p.locator('#crm_fu').count() === 0, 'Parties: title "Parties", the parties list present, no follow-ups list');
    await p.click('[data-testid="crm-nav-followups"]');
    await p.waitForSelector('#crm_fu [data-row]', { timeout: 15000 });
    ok(/^Follow-ups$/.test(await title()), 'after Follow-ups in the sidebar the title is "Follow-ups" (' + (await title()) + ')');
    ok(await p.locator('#crm_fu').count() === 1 && await p.locator('#crm_list').count() === 0, 'the follow-ups list is present and the parties list is gone');
    ok(await p.locator('[data-testid^="crm-row-"]').count() === 0, 'no party row is on the screen');
    ok(await p.locator('[data-testid="crm-nav-followups"][aria-current="page"]').count() === 1 && await p.locator('[data-testid="crm-nav-parties"][aria-current="page"]').count() === 0, 'the sidebar marks Follow-ups as the current page');
    const groups = await p.$$eval('#crm_fu .cbl-group', (g) => g.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    ok(groups.length >= 2 && /Late/.test(groups.join('|')) && /Today|This week|Later/.test(groups.join('|')), 'the follow-ups are grouped by when they are due (' + groups.join(' | ') + ')');
    const heads = await p.$$eval('#crm_fu .cbl-hc', (h) => h.map((x) => x.innerText.replace(/[▲▼⇅]/g, '').trim()));
    ok(heads[0] === 'DUE' && heads.indexOf('WHAT') > 0, 'its columns are the follow-ups\' own: ' + heads.join(' · '));
    await p.click('[data-testid="crm-nav-parties"]');
    await p.waitForSelector('#crm_list [data-row]', { timeout: 15000 });
    ok(/Parties/.test(await title()) && await p.locator('#crm_fu').count() === 0, 'and Parties brings the parties list back');
    await ctx.close();
  }

  ok(threw.length === 0, 'no page error' + (threw.length ? ': ' + threw[0] : ''));
  ok(offHost.length === 0, 'nothing tried to leave the browser' + (offHost.length ? ': ' + offHost[0] : ''));
  await b.close(); srv.close();
  console.log('\ncrm-themes: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
