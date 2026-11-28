'use strict';
// @type: live
/**
 * staff-seat-menu-no-refused-calls.cjs - walk 28 Nov: EVERY page a Counter-staff seat reaches from Home makes no refused call and ends in data, an empty state or a worded refusal.
 *
 * OWNS      the live guard of the principle "a page asks only what the seat may ask" (the one seat rule is CBAvatar.staffSeat, avatar.js): headless Chrome on a SIT box, signed in as a plain staff seat, opens Home,
 *           takes the page links from Home itself (never a typed list), visits each, and fails on any 4xx/5xx call, any uncaught exception, any visible stuck spinner or blank main area after the dwell.
 * CALLED BY by hand, ON A SIT BOX or one browser on the laptop (one at a time): CB_BASE=https://<sit web> CB_TOKEN=<the staff seat's session token> [CB_OVERRIDE=<the local public/ dir: files served in place of the box's, to prove a fix before deploy>] [CB_ONLY=<comma list of paths under public/ to serve, e.g. app/avatar.js,accounts.html: only the files the fix changed, else an older tree masks the box's build>] [CB_PAGES=/a.html,/b.html to visit only those] [CB_DEVICE=<the device id the token signed in with>] [CB_DWELL=9000] node e2e/staff-seat-menu-no-refused-calls.cjs
 * CARD      04-network/ACC-176B-ADVISER-REQUIREMENT
 * The offline twin is e2e/cashier-home-no-refused-call.test.cjs (the gates, with a mutation). Exit 1 lists every finding as `page · status · call`.
 */
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const BASE = (process.env.CB_BASE || '').replace(/\/$/, ''), TOKEN = process.env.CB_TOKEN || '', OVERRIDE = process.env.CB_OVERRIDE || '', DWELL = Number(process.env.CB_DWELL || 9000), ONLY = (process.env.CB_ONLY || '').split(',').filter(Boolean), DEVICE = process.env.CB_DEVICE || 'staffwalk-0001'; /* a session token is bound to the device id it signed in with */
if (!BASE || !TOKEN) { console.log('usage: CB_BASE=https://<sit web> CB_TOKEN=<staff session token> node e2e/staff-seat-menu-no-refused-calls.cjs'); process.exit(2); }
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];
(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'staffwalk-')), port = 9400 + Math.floor(Math.random() * 90);
  const chrome = cp.spawn(CHROME, ['--headless=new', '--user-data-dir=' + prof, '--remote-debugging-port=' + port, '--window-size=1366,768', '--no-first-run', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let target;
  for (let i = 0; i < 40 && !target; i++) { try { target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find((x) => x.type === 'page'); } catch (_) {} if (!target) await sleep(400); }
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); let events = [];
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else events.push(m); });
  const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (x) => (((await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result || {}).result || {}).value;
  for (const d of ['Page', 'Runtime', 'Network']) await send(d + '.enable');
  await send('Network.setBypassServiceWorker', { bypass: true }); /* a service worker would serve its cached copy past the override */
  await send('Network.setCacheDisabled', { cacheDisabled: true }); /* every script is fetched (and so served from the override) on every page */
  if (OVERRIDE) {
    await send('Fetch.enable', { patterns: [{ urlPattern: '*/app/*.js', requestStage: 'Request' }, { urlPattern: '*.html*', requestStage: 'Request' }] });
    ws.addEventListener('message', async (e) => {
      const m = JSON.parse(e.data); if (m.method !== 'Fetch.requestPaused') return;
      const rel = new URL(m.params.request.url).pathname.slice(1), file = path.join(OVERRIDE, rel);
      let r = null;
      if (fs.existsSync(file) && (!ONLY.length || ONLY.includes(rel))) r = await send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: rel.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/javascript' }, { name: 'cache-control', value: 'no-store' }], body: fs.readFileSync(file).toString('base64') });
      else r = await send('Fetch.continueRequest', { requestId: m.params.requestId });
      if (r && r.error) findings.push('harness · override ' + rel + ' · ' + r.error.message);
    });
  }
  await send('Page.navigate', { url: BASE + '/web-commit.txt' }); await sleep(1500);
  await run("localStorage.setItem('cb_device_id'," + JSON.stringify(DEVICE) + ");localStorage.setItem('cb_sess',JSON.stringify({token:" + JSON.stringify(TOKEN) + ",role:'actor',name:'staff',entity:'staff'}))");
  const visit = async (p) => {
    events = []; await send('Page.navigate', { url: BASE + p }); await sleep(DWELL);
    const reqs = new Map();
    for (const m of events) if (m.method === 'Network.requestWillBeSent') reqs.set(m.params.requestId, m.params.request.method + ' ' + m.params.request.url.replace(BASE, '') + ' <- ' + (((m.params.initiator.stack || {}).callFrames || []).slice(1, 4).map((f) => f.url.replace(BASE, '').split('/').pop() + ':' + f.lineNumber).join(' ')));
    for (const m of events) {
      if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) findings.push(p + ' · ' + m.params.response.status + ' · ' + (reqs.get(m.params.requestId) || m.params.response.url));
      if (m.method === 'Runtime.exceptionThrown') findings.push(p + ' · exception · ' + String((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text).slice(0, 160));
    }
    const seatNow = await run("(()=>{try{return location.href + ' ' + JSON.stringify(CBAvatar.lastMe())}catch(e){return location.href + ' ' + e.message + ' typeof=' + typeof CBAvatar}})()");
    if (findings.some((f) => f.startsWith(p + ' ·'))) findings.push(p + ' · seat answer then: ' + seatNow);
    const state = await run("(()=>{const vis=(e)=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};const spin=[...document.querySelectorAll('[aria-busy=\"true\"],[role=\"progressbar\"],.spin,.spinner,[class*=\"skeleton\"]')].filter(vis).length;const main=document.querySelector('#content, main')||document.body;return {spin,len:(main.innerText||'').trim().length,href:location.href}})()");
    if (!state) { findings.push(p + " · no page state (the page did not load)"); return {}; }
    if (state.spin) findings.push(p + ' · stuck spinner · ' + state.spin + ' visible');
    if (state.len < 40) findings.push(p + ' · blank · main has ' + state.len + ' characters');
    return state;
  };
  await visit('/');
  const links = process.env.CB_PAGES ? process.env.CB_PAGES.split(',') : await run("[...new Set([...document.querySelectorAll('a[href]')].map((a)=>a.getAttribute('href')).filter((h)=>h&&h[0]==='/'&&h.indexOf('.html')>0))]");
  console.log('pages from Home: ' + links.length + ' ' + links.join(' '));
  for (const l of links) await visit(l);
  if (!process.env.CB_PAGES) await visit('/accounts.html'); /* every Accounts tab by a typed # (the menu is not offered to this seat, an address still can name one) */
  const tabs = process.env.CB_PAGES ? [] : await run("typeof NAV_GROUPS !== 'undefined' ? NAV_GROUPS.reduce((all, g) => all.concat(g[1]), []) : []") || [];
  for (const t of tabs) await visit('/accounts.html#' + t);
  console.log('accounts tabs tried: ' + tabs.length);
  chrome.kill(); await sleep(400); try { fs.rmSync(prof, { recursive: true, force: true }); } catch (_) {}
  console.log(findings.length ? findings.length + ' finding(s):\n  ' + findings.join('\n  ') : 'all ' + (links.length + 1) + ' pages clean: no refused call, no stuck spinner, no blank');
  process.exit(findings.length ? 1 : 0);
})().catch((e) => { console.log('ERR', e.stack); process.exit(1); });
