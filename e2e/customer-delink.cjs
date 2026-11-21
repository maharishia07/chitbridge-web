/* customer-delink (21 Nov 2026): static, no browser. THE CUSTOMER APP NEVER OPENS THE BACK OFFICE.
 * OWNS      the proof that every customer page loads only neutral scripts, links to no back-office page, reads no staff session, installs no back-office worker; and that a customer token is no staff session
 * CALLED BY ci.yml (the Guards step)
 * CARD      10-online-shop-and-storefront-orders/functions/the-online-shop-public-page
 * Athi: "our customer app should not open backoffice app at all … completely delinked".
 *  A · each customer page (shop · store · network-shop · embed) loads ONLY the scripts on ALLOW below (a new script must be named here, i.e. judged neutral);
 *  B · neither the page nor any script it loads names a back-office page (app · accounts · finance · crm · catalogue · settings · employees · operations · tasks · till · network · books …);
 *  C · none reads the staff session (cb_sess) — except the one documented owner preview (shop.html _ownerToken, an explicit ?preview=1);
 *  D · the service worker the shop registers is the customer set, with its own cache and a shop fallback;
 *  E · the reverse door: CBOnePerson.who() treats a customer token (even stored in cb_sess) as no one, the sign-in window refuses to keep one, the api fails closed (auth.js).
 * Run: node e2e/customer-delink.cjs */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let fail = 0; const bad = (m) => { fail++; console.log('FAIL ' + m); }; const ok = (m) => console.log('  ok  ' + m);

const CUSTOMER_PAGES = ['public/shop.html', 'public/store.html', 'public/network-shop.html', 'public/embed.html'];
/* neutral = no staff session, no staff endpoint map, no staff page name (avatar.js carries the staff menu; screen-id.js lists every staff page: neither is loaded) */
const ALLOW = new Set(['app/device-id.js', 'config.js', 'app/helpers.js', 'cb-offline.js', 'engine/offers.js', 'engine/pricing.js', 'app/catalogue-lines.js', 'engine/screen.js',
  'app/ui.js', 'app/ui-field.js', 'app/customer-bar.js', 'app/cb-words.js', 'engine/locale.js', 'engine/money.js', 'engine/tax.js',
  'app/shop-privacy.js', 'app/cart.js', 'app/kbd-press.js', 'app/step-flow.js', 'app/sheet-keys.js', 'app/workflow.js', 'app/showcase-templates.js']);
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
      if (/cb_sess/.test(line) && f !== 'public/app/device-id.js' /* SEC-85: compares shop ids across tabs, grants nothing */ && !(f === 'public/shop.html' && /_ownerToken|parsed = JSON\.parse\(localStorage\.getItem\('cb_sess'\)/.test(line))) bad(f + ':' + (i + 1) + ' (from ' + page + ') reads the staff session: ' + line.trim().slice(0, 110));
    });
  });
  if (!fail) ok(page + ': ' + srcs.length + ' scripts, all neutral; no back-office page, no staff session');
});

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

reverse().then(() => {
  if (fail) { console.log('customer-delink: ' + fail + ' FAILED'); process.exit(1); }
  console.log('customer-delink: all passed');
});
