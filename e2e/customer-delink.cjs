/* customer-delink (21 Nov 2026): static, no browser. THE CUSTOMER APP NEVER OPENS THE BACK OFFICE.
 * OWNS      the proof that every customer page loads only neutral scripts, links to no back-office page, reads no staff session, installs no back-office worker; and that a customer token is no staff session
 * CALLED BY ci.yml (the Guards step)
 * CARD      10-online-shop-and-storefront-orders/functions/the-online-shop-public-page
 * Athi: "our customer app should not open backoffice app at all … completely delinked".
 *  A · each customer page (shop · store · network-shop · embed · promo) loads ONLY the scripts on ALLOW below (a new script must be named here, i.e. judged neutral);
 *  B · neither the page nor any script it loads names a back-office page (app · accounts · finance · crm · catalogue · settings · employees · operations · tasks · till · network · books …);
 *  C · none reads the staff session (cb_sess), no exception for the owner preview: that goes through the one-way hand-off key cb_preview@<shop> (app/preview-key.js writes it, shop.html reads only it);
 *      the key holds the api's PREVIEW-ONLY token (POST /api/entities/me/preview-token), never the staff token: C2 fails if anything stores the staff token under cb_preview;
 *      app/device-id.js (shared with staff pages) is proved by RUNNING it as a customer page (data-customer-page) over a storage that records every key read;
 *  D · the service worker the shop registers is the customer set, with its own cache and a shop fallback;
 *  E · the reverse door: CBOnePerson.who() treats a customer token (even stored in cb_sess) as no one, the sign-in window refuses to keep one, the api fails closed (auth.js).
 * Run: node e2e/customer-delink.cjs */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let fail = 0; const bad = (m) => { fail++; console.log('FAIL ' + m); }; const ok = (m) => console.log('  ok  ' + m);

const CUSTOMER_PAGES = ['public/shop.html', 'public/store.html', 'public/network-shop.html', 'public/embed.html', 'public/promo.html'];
/* neutral = no staff session, no staff endpoint map, no staff page name (avatar.js carries the staff menu; screen-id.js lists every staff page: neither is loaded) */
const ALLOW = new Set(['app/device-id.js', 'app/api-base.js' /* judged 22 Nov (ci1129): the ONE reader of the api address (fixApiBase); reads no session or token, only the dev-host override key, and production ignores it */, 'app/shop-time.js' /* judged 21 Nov: the one date formatter, no session, no api, no storage */, 'config.js', 'app/helpers.js', 'cb-offline.js', 'engine/offers.js', 'engine/pricing.js', 'app/catalogue-lines.js', 'engine/screen.js',
  'app/ui.js', 'app/ui-field.js', 'app/customer-bar.js', 'app/cb-words.js', 'engine/locale.js', 'engine/money.js', 'engine/tax.js',
  'app/shop-privacy.js', 'app/cart.js', 'app/kbd-press.js', 'app/step-flow.js', 'app/sheet-keys.js', 'app/workflow.js', 'app/showcase-templates.js', 'app/promo-keys.js' /* judged neutral 22 Nov (websplit D): promo's show keys only */]);
const OFFICE_PAGE = /(?:^|[^\w-])(?:app|accounts|finance|crm|catalogue|settings|employees|operations|tasks|till|network|know-your-business|authority-forms|intake|bill-print)\.html/;
const nl = (s) => s.replace(/[^\n]/g, '');
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, nl).replace(/\/\*[\s\S]*?\*\//g, nl).replace(/^[ \t]*\/\/.*$/gm, '').replace(/[ \t]\/\/[ \t].*$/gm, '');

function scriptsOf(html) {
  const out = []; const re = /<script[^>]*\ssrc="([^"]+)"/g; let m;
  while ((m = re.exec(html))) { if (/^https?:|^'|\$\{|\+/.test(m[1])) continue; out.push(m[1].replace(/^\//, '')); }
  return out;
}

CUSTOMER_PAGES.forEach((page) => {
  const html = strip(read(page)), srcs = scriptsOf(html);
  srcs.forEach((s) => { if (!ALLOW.has(s)) bad(page + ' loads ' + s + ' — not a neutral customer script (back-office code, or judge it and add it to ALLOW)'); });
  if (!srcs.includes('app/customer-bar.js')) bad(page + ' does not wear the customer bar');
  if (/CBFrame|CBShell\b/.test(html)) bad(page + ' draws the staff frame (CBFrame / CBShell)');
  [page].concat(srcs.map((s) => 'public/' + s).filter((f) => fs.existsSync(path.join(root, f)))).forEach((f) => {
    strip(read(f)).split('\n').forEach((line, i) => {
      if (OFFICE_PAGE.test(line)) bad(f + ':' + (i + 1) + ' (from ' + page + ') names a back-office page: ' + line.trim().slice(0, 110));
      if (/cb_sess/.test(line) && f !== 'public/app/device-id.js' /* run, not read, in C2: its staff half (SEC-85) is off on a customer page */) bad(f + ':' + (i + 1) + ' (from ' + page + ') reads the staff session: ' + line.trim().slice(0, 110));
    });
  });
  if (!fail) ok(page + ': ' + srcs.length + ' scripts, all neutral; no back-office page, no staff session');
});

/* C2 · the owner preview, through the hand-off key only: the key holds the api's preview-only token, never the staff token */
const STAFF = 'T-STAFF-BEARER', PREVIEW = 'T-PREVIEW-ONLY';
const mkStore = () => { const keys = {}; return { keys, getItem: (k) => (k in keys ? keys[k] : null), setItem: (k, v) => { keys[k] = String(v); }, removeItem: (k) => { delete keys[k]; } }; };
const c2 = async () => {
  const store = mkStore(), calls = [];
  const fetchStub = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ token: PREVIEW, bridge_id: 'BR-A', expires_in: 900 }) }; };
  const w = { localStorage: store, fetch: fetchStub, CB_API: 'https://api.test', console };
  vm.runInNewContext(read('public/app/preview-key.js'), w, { filename: 'preview-key.js' });
  (await w.CBPreviewKey.hand('shopA')) === false && !calls.length ? ok('no staff session: no key is written and nothing is asked of the api') : bad('a key was written, or the api was asked, with no staff session');
  store.setItem('cb_sess', JSON.stringify({ token: STAFF }));
  (await w.CBPreviewKey.hand('shopA')) === true ? ok('the staff side asks the api for a preview token and keeps it under cb_preview@<shop>') : bad('hand() did not write cb_preview@shopA');
  const call = calls[0] || { init: { headers: {} } };
  call.url === 'https://api.test/api/entities/me/preview-token' && call.init.method === 'POST' && call.init.headers.Authorization === 'Bearer ' + STAFF ? ok('the staff bearer is the Authorization of the one mint call') : bad('the mint call is wrong: ' + JSON.stringify(call));
  const kept = JSON.parse(store.keys['cb_preview@shopA'] || 'null') || {};
  kept.t === PREVIEW ? ok('cb_preview holds the preview-only token') : bad('cb_preview holds ' + kept.t);
  /* the guard: nothing may store the staff token under cb_preview, in any value or any key */
  const stored = Object.keys(store.keys).filter((k) => /^cb_preview/.test(k)).map((k) => store.keys[k]).join('|');
  stored.indexOf(STAFF) < 0 ? ok('the staff token is stored nowhere under cb_preview') : bad('THE STAFF TOKEN IS STORED UNDER cb_preview (token exposure to a customer page)');
  const exp = kept.exp - Date.now(); exp > 0 && exp <= 15 * 60 * 1000 ? ok('the key is short-lived (15 min)') : bad('the key lifetime is wrong: ' + exp);
  await w.CBPreviewKey.hand('shopA'); calls.length === 1 ? ok('a key with time left is reused, not minted again') : bad('a second mint went out for a live key');
  /* a refusing api: no key, never a fallback to the staff token */
  const store2 = mkStore(); store2.setItem('cb_sess', JSON.stringify({ token: STAFF }));
  const w2 = { localStorage: store2, fetch: async () => ({ ok: false, json: async () => ({}) }), CB_API: '', console: { warn() {} } };
  vm.runInNewContext(read('public/app/preview-key.js'), w2, { filename: 'preview-key.js' });
  (await w2.CBPreviewKey.hand('shopA')) === false && !('cb_preview@shopA' in store2.keys) ? ok('an api that refuses leaves no key (never the staff token as a fallback)') : bad('a key was written after a refused mint');
  /* every writer of cb_preview in the web copy stores only the mint answer: a line that stores a staff token fails */
  ['public/app/preview-key.js', 'public/till.html'].forEach((f) => {
    const writers = (read(f).match(/setItem\('cb_preview@'[^;]*;/g) || []);
    if (!writers.length) bad(f + ' has no cb_preview writer to check');
    writers.forEach((line) => { if (/\bks\.token\b|sessionToken\(\)|\bstaff\b/.test(line) || !/\b(?:minted|m)\.token\b/.test(line)) bad(f + ' stores something other than the mint answer under cb_preview: ' + line.slice(0, 140)); });
  });
  ok('every cb_preview writer stores only the mint answer');
  const fnSrc = (read('public/shop.html').match(/function _previewKey\(\) \{[\s\S]*?\n\}\n/) || [])[0];
  if (!fnSrc) bad('shop.html has no _previewKey()');
  else {
    const read1 = (bridge, st) => vm.runInNewContext(fnSrc + '_previewKey()', { BRIDGE: bridge, localStorage: st, Date });
    read1('shopA', store) === PREVIEW ? ok('shop.html reads the key for its own shop') : bad('shop.html did not read the preview key');
    read1('shopB', store) === null ? ok('a key for one shop opens no other shop') : bad('a key for shopA was read for shopB');
    store.keys['cb_preview@shopA'] = JSON.stringify({ t: PREVIEW, exp: Date.now() - 1 });
    read1('shopA', store) === null && !('cb_preview@shopA' in store.keys) ? ok('an expired key is no key and is dropped') : bad('an expired key was used');
    const onlyKey = { getItem: (k) => (k === 'cb_sess' ? '{"token":"T-STAFF"}' : null), removeItem() {} };
    read1('shopA', onlyKey) === null ? ok('the staff session alone opens no preview') : bad('shop.html fell back to the staff session');
  }
  /_ownerToken/.test(read('public/shop.html')) ? bad('shop.html still has _ownerToken') : ok('shop.html has no _ownerToken and no silent owner retry on a 404');
  /* device-id.js run as a CUSTOMER page over a storage that records every key read; as a staff page it still reads cb_sess (the SEC-85 guard is kept) */
  const run = (customer) => {
    const reads = [], ls = { getItem(k) { reads.push(k); return null; }, setItem() {}, removeItem() {} };
    const doc = { currentScript: { hasAttribute: (a) => customer && a === 'data-customer-page' }, addEventListener() {} };
    const win = { localStorage: ls, document: doc, location: { href: 'https://x.test/shop.html', origin: 'https://x.test' }, addEventListener() {}, atob: (x) => Buffer.from(x, 'base64').toString('binary'), console: { warn() {} } };
    vm.runInNewContext(read('public/app/device-id.js'), win, { filename: 'device-id.js' });
    return reads;
  };
  run(true).includes('cb_sess') ? bad('app/device-id.js READS cb_sess on a customer page (data-customer-page)') : ok('app/device-id.js reads no cb_sess on a customer page');
  run(false).includes('cb_sess') ? ok('app/device-id.js still reads the staff session on a staff page (shop-switch guard kept)') : bad('app/device-id.js lost the staff shop-switch guard');
  CUSTOMER_PAGES.filter((p) => fs.existsSync(path.join(root, p)) && /app\/device-id\.js/.test(read(p))).forEach((p) => {
    /<script src="\/app\/device-id\.js" data-customer-page><\/script>/.test(read(p)) ? ok(p + ' loads device-id.js as a customer page') : bad(p + ' loads device-id.js WITHOUT data-customer-page');
  });
};

/* D · the worker */
const shop = read('public/shop.html'), sw = read('public/cb-sw.js');
/registerSW\('\/cb-sw\.js\?set=customer', '\/shop\.html'\)/.test(shop) ? ok('shop.html registers the customer worker, scoped to /shop.html') : bad('shop.html must register /cb-sw.js?set=customer with scope /shop.html');
const cp = (sw.match(/const CUSTOMER_PRECACHE = \[([^\]]*)\]/) || [])[1] || '';
cp && !OFFICE_PAGE.test(cp) ? ok('the customer worker pre-caches customer pages only') : bad('CUSTOMER_PRECACHE missing or names a back-office page');
/NAV_FALLBACK = CUSTOMER_SET \? '\/shop\.html' : '\/app\.html'/.test(sw) ? ok('a customer navigation falls back to the shop, never app.html') : bad('cb-sw.js NAV_FALLBACK must be /shop.html for the customer set');

/* E · the reverse door */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const tok = (claims) => 'h.' + b64(Object.assign({ identity_id: 'i1', parent_entity_id: 'e1', exp: Math.floor(Date.now() / 1000) + 3600 }, claims)) + '.s';
const win = { atob: (s) => Buffer.from(s, 'base64').toString('binary'), localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; }, length: 0 }, document: undefined };
vm.runInNewContext(read('public/app/one-person.js'), win, { filename: 'one-person.js' });
const who = win.CBOnePerson && win.CBOnePerson.who;
if (typeof who !== 'function') bad('CBOnePerson.who not loaded');
else {
  who({ token: tok({ identity_type: 'customer' }), role: 'customer' }) === null ? ok('a customer session in cb_sess is no one on a back-office page (who → null)') : bad('CBOnePerson.who accepts a customer session');
  who({ token: tok({ identity_type: 'customer' }), role: 'entity' }) === null ? ok('a customer-typed token is no one even under another role label') : bad('CBOnePerson.who accepts a customer-typed token');
  who({ token: tok({ identity_type: 'entity' }), role: 'entity', entity: 'Shop' }) ? ok('a shop owner session still reads') : bad('an owner session no longer reads');
}
/* the apps' sign-in window, driven for real: a customer's verify answer is refused and kept nowhere; an owner's is kept in cb_sess; the shop page's own (need 'customer') in cb_cust@<shop> */
globalThis.CBSignin = require(path.join(root, 'public/engine/signin.js'));
require(path.join(root, 'public/app/signin-more-ways.js'));
require(path.join(root, 'public/app/signin-session.js'));
const SIGNIN = require(path.join(root, 'public/app/signin-ui.js'));
const answerOf = (type) => ({ status: 200, body: { token: tok({ identity_type: type }), identity: { identity_type: type, display_name: 'N' } } });
async function signInAs(need, type) {
  const kept = {}, machine = SIGNIN.machine({ surface: 'index', need }, { store: { setItem(k) { kept[k] = 1; } }, post: async () => answerOf(type) });
  Object.assign(machine.state(), { resolved: '9876543210', need: 'either' });
  const after = await machine.verify('123456');
  return { at: after.at, kept: Object.keys(kept).join(',') };
}
const reverse = async () => {
  const asCustomer = await signInAs('person', 'customer'), asOwner = await signInAs('person', 'entity'), onShop = await signInAs('customer', 'customer');
  asCustomer.at === 'out' && asCustomer.kept === '' ? ok('a customer signing in at the apps is refused and nothing is kept') : bad('a customer sign-in at the apps was kept: ' + JSON.stringify(asCustomer));
  asOwner.kept === 'cb_sess' ? ok('an owner sign-in is kept in cb_sess') : bad('an owner sign-in is not kept: ' + JSON.stringify(asOwner));
  /^cb_cust@/.test(onShop.kept) ? ok('the shop page sign-in keeps the customer under cb_cust@<shop>, never cb_sess') : bad('a customer sign-in on the shop page is not kept apart: ' + JSON.stringify(onShop));
};

/root\.CBOnePerson\.who\(parsed\)/.test(read('public/app/shell.js')) && /CBOnePerson\.who\(parsed\)/.test(read('public/app/page-frame.js')) ? ok('the staff frame reads its session through CBOnePerson.who') : bad('shell.js / page-frame.js must read the session through CBOnePerson.who');

c2().then(reverse).then(() => {
  if (fail) { console.log('customer-delink: ' + fail + ' FAILED'); process.exit(1); }
  console.log('customer-delink: all passed');
});
