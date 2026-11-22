// e2e/p2wave-sec-1130.cjs — the P2 security rows of the 1130 wave on the web side. Offline, node only, no browser.
// OWNS      EL-web-screens-24#L64 · L-sec-web-screens-24#L27 (offer-lab category and item ids go through escJs) · EL-web-screens-22#L45 · L-sec-web-screens-22#L28 (testing.html fold keys)
//           · GF-web-screens-15#L52 (cap-testing definition id) · EL-web-screens-21#L40 · L-sec-web-screens-21#L41 (shop.html photo link) · EL-web-screens-21#L60 · L-sec-web-screens-21#L64 (the cdnjs script carries its hash)
// CALLED BY CI (web offline step)
// FLOW      the real source text → the scan or the builder run with a hostile value → what a browser would read
// CARD      18-identity-sign-in-and-access/access-levels
// Run: node e2e/p2wave-sec-1130.cjs
'use strict';
const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' — ' + (why || ''))); if (!ok) fail++; };
const read = (rel) => fs.readFileSync(path.join(pub, rel), 'utf8').replace(/\r\n/g, '\n');
const { scanHandlerEsc } = require('./lib/handler-esc-scan.cjs');
const rawCount = (rel, expr) => scanHandlerEsc(read(rel), { raw: true }).filter((h) => h.expr.replace(/\s+/g, ' ') === expr).length;

/* the offer lab: a category id is catalogue data (a shop types it), so it never goes raw into a handler string; item ids went the same way */
t('offer-lab-next.html: no raw OVL.cat in a handler string (the category the page filters by)', rawCount('offer-lab-next.html', 'OVL.cat') === 0, 'raw OVL.cat sites: ' + rawCount('offer-lab-next.html', 'OVL.cat'));
t('offer-lab-next.html: the overlay category and pick handlers carry escJs(item.id) (at most 13 raw item.id left, all offer ids the server mints)', rawCount('offer-lab-next.html', 'item.id') <= 13, 'raw item.id sites: ' + rawCount('offer-lab-next.html', 'item.id'));
/* the testing page: the fold key is a menu or directory name */
t('testing.html: the tree fold key and the matrix row item go through escJs', rawCount('testing.html', 'key') <= 1 && rawCount('testing.html', 'item') <= 1, 'key ' + rawCount('testing.html', 'key') + ' item ' + rawCount('testing.html', 'item'));
t('cap-testing.js: the include-toggle definition id goes through escJs', rawCount('app/cap-testing.js', 'item.definition_id') <= 1, 'raw sites: ' + rawCount('app/cap-testing.js', 'item.definition_id'));

/* the shop window photo: cut the three statements out of shop.html and run them with hostile links */
const shop = read('shop.html');
const start = shop.indexOf('var photoLink = '), end = shop.indexOf("    : '';", start) + "    : '';".length;
t('shop.html: the photo statements are found', start > 0 && end > start);
const esc = new Function(fs.readFileSync(path.join(pub, 'app', 'helpers.js'), 'utf8').match(/function esc\(v\)[\s\S]*?\n\}/)[0] + '; return esc;')();
const photoOf = new Function('it', 'esc', shop.slice(start, end) + '; return photo;');
const hostile = ['x);background-image:url(//evil/steal', 'https://cdn.example/a.png"><img src=x onerror=__pwn=1>', "https://cdn.example/a.png');x:('", 'javascript:alert(1)', '//evil.example/a.png', 'https://cdn.example/a b.png', 'data:text/html;base64,PHNjcmlwdD4='];
t('shop.html: no hostile photo link yields a photo span', hostile.every((u) => photoOf({ photo: u }, esc) === ''), hostile.map((u) => photoOf({ photo: u }, esc)).join(' | '));
t('shop.html: an https link, a site path and an inline png still show', ['https://cdn.example/a/b.png?x=1', '/img/a.png', 'data:image/png;base64,iVBORw0KGgo='].every((u) => photoOf({ _photo: u }, esc).indexOf('url(' + u + ')') > 0));
/* the third-party script carries the registry's hash, the same one app.html pins */
const qr = (html) => (html.match(/<script[^>]*qrcode\.min\.js[^>]*>/) || [''])[0];
t('shop.html: the qrcode script has integrity + crossorigin, equal to app.html', /integrity="sha512-[^"]+"/.test(qr(shop)) && /crossorigin="anonymous"/.test(qr(shop)) && (qr(shop).match(/integrity="[^"]+"/) || [])[0] === (qr(read('app.html')).match(/integrity="[^"]+"/) || [])[0]);
/* the minted connection key is forgotten: after a minute, and when the page is left */
{
  const admin = read('app/cap-admin.js');
  const m = /^function intKeyForget\(\) \{[\s\S]*?\n\}\n/m.exec(admin);
  t('cap-admin.js: intKeyForget exists', !!m);
  const box = { innerHTML: '<b>KEY</b>' };
  const run = new Function('document', 'clearTimeout', 'var _KEY_SHOWN = "SECRET-KEY-HTML", _KEY_TIMER = 7;' + (m ? m[0] : '') + 'intKeyForget(); return { shown: _KEY_SHOWN };');
  const res = run({ getElementById: () => box }, () => {});
  t('cap-admin.js: intKeyForget empties the held key and the screen', res.shown === '' && box.innerHTML === '', JSON.stringify(res));
  t('cap-admin.js: minting arms the one-minute forget and the page leave clears it', /_KEY_TIMER = setTimeout\(intKeyForget, 60000\)/.test(admin) && /addEventListener\('pagehide', intKeyForget\)/.test(admin));
}
/* the public legend: a stranger reads no open security gap and no test code */
{
  const legend = read('app/cap-legend.js');
  const post = /const SEC_POSTURE = \[[\s\S]*?\n\];/.exec(legend);
  const fn = /function _secTabHtml\(\) \{[\s\S]*?\n\}\n/.exec(legend);
  t('cap-legend.js: the security tab and its posture list are found', !!post && !!fn);
  const make = (session) => new Function('esc', 'tx', 'SESSION', post[0] + fn[0] + '; return _secTabHtml();')(esc, (x) => x, session);
  const anon = make(null), signed = make({ token: 'x' });
  t('cap-legend.js: signed out, no "Raise it" gap line (the certificate gap is not printed)', !/Raise it/.test(anon) && !/cert NOT verified/.test(anon));
  t('cap-legend.js: signed in, the gap lines are there', /Raise it/.test(signed) && /cert NOT verified/.test(signed));
  t('cap-legend.js: no fixed test code in the sign-in capability text', !/123456/.test(legend));
}
/* offline drafts: the real cb-offline.js in a vm over one shared localStorage; a draft is read back only by who saved it */
{
  const vm = require('vm');
  const store = {};
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const page = (entity) => {
    const sb = { localStorage, navigator: { onLine: true }, setTimeout, clearTimeout, console, document: undefined, addEventListener() {}, Date, JSON, Math, Promise };
    sb.window = sb; vm.createContext(sb); vm.runInContext(read('cb-offline.js'), sb);
    sb.CBOffline.configure(entity === undefined ? {} : { entity: () => entity });
    return sb.CBOffline;
  };
  page('alice').saveDraft('af.form1', { name: 'Alice private' });
  t('cb-offline.js: the person who saved a draft reads it back', JSON.stringify(page('alice').loadDraft('af.form1')) === '{"name":"Alice private"}');
  t('cb-offline.js: another person signed in on the same browser does not', page('bob').loadDraft('af.form1') === null && page('bob').draftAge('af.form1') === null);
  t('cb-offline.js: a page that stamps nothing does not read a stamped draft either', page().loadDraft('af.form1') === null);
  store['cb.draft.old'] = JSON.stringify({ at: Date.now(), data: { legacy: 1 } });
  t('cb-offline.js: a draft saved before the stamp existed still reads (the one-person gate owns that case)', JSON.stringify(page('bob').loadDraft('old')) === '{"legacy":1}');
  const sources = ['intake.html', 'know-your-business.html', 'authority-forms.html'].map((f) => read(f));
  t('intake, know-your-business and authority-forms stamp their queued writes with the signed-in id', sources.every((x) => /CBOffline\.configure\(\{[\s\S]*?entity: function \(\) \{[\s\S]*?CBFrame\.session\(\)/.test(x)));
}
/* sign-out forgets the kept bank statement text (the avatar's one forget()), and keeps the marks and rules */
{
  const avatar = read('app/avatar.js');
  const m = /function forget\(\) \{[\s\S]*?\n  \}\n/.exec(avatar);
  t('avatar.js: forget() is found', !!m);
  const store = { cb_sess: '1', 'cb_bankrec:shop1:stmt:acct1': '{"text":"FULL STATEMENT"}', 'cb_bankrec:shop1:marks:acct1': '{}', 'cb_bankrec:shop1:rules': '[]', 'cb_nav@u': 'x' };
  Object.defineProperty(store, 'removeItem', { value: (k) => { delete store[k]; }, enumerable: false });
  const root = { localStorage: store };
  const run = new Function('root', 'PERSON_KEYS', 'console', m[0] + '; return forget();');
  const ok = run(root, ['cb_sess'], console);
  t('avatar.js: sign-out removes the statement text and the nav memory, keeps marks and rules', ok === true && !('cb_bankrec:shop1:stmt:acct1' in store) && !('cb_nav@u' in store) && 'cb_bankrec:shop1:marks:acct1' in store && 'cb_bankrec:shop1:rules' in store, JSON.stringify(Object.keys(store)));
}
/* sign-in: a host's thrown text is never the line the person reads */
{
  const ui = read('app/signin-ui.js');
  const m = /function hostFailed\(failure, words\) \{[\s\S]*?\n  \}\n/.exec(ui);
  t('signin-ui.js: hostFailed is found and the two PIN paths use it, none shows x.message', !!m && (ui.match(/why: hostFailed\(x,/g) || []).length === 2 && !/why: \(x && x\.message\)/.test(ui));
  const seen = [];
  const said = new Function('console', m[0] + '; return hostFailed(new Error("QuotaExceededError: idb cb-till-pins"), "The PIN could not be kept.");')({ error: (...a) => seen.push(a.join(' ')) });
  t('signin-ui.js: the person gets our sentence, the developer gets the log', said === 'The PIN could not be kept.' && seen.length === 1 && /QuotaExceededError/.test(seen[0]));
}
/* the public static mock carries no real-looking phone number */
t('storefront-design.html: no real-looking Indian mobile number in the mock', !/(^|[^0-9])(\+91[ -]?)?[6-9][0-9]{4}[ -]?[0-9]{5}([^0-9]|$)/.test(read('storefront-design.html').split('9876543210').join('')));
/* the offer lab: a queued write and the cached catalogue belong to the person who made them */
(async () => {
  const lab = read('offer-lab-next.html');
  const cut = (name, isAsync) => new RegExp('^' + (isAsync ? 'async ' : '') + 'function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n', 'm').exec(lab);
  const parts = [cut('labOwner'), cut('savedToken'), cut('labDrainOutbox', true), cut('labPaintQueue'), cut('labUseCache', true)];
  t('offer-lab-next.html: labOwner, savedToken, labDrainOutbox, labPaintQueue, labUseCache are found', parts.every(Boolean));
  const world = (who) => {
    const sent = [], deleted = [], applied = [];
    const rows = [{ id: 1, method: 'POST', url: '/api/a', body: {}, owner: 'alice' }, { id: 2, method: 'POST', url: '/api/b', body: {}, owner: 'bob' }, { id: 3, method: 'POST', url: '/api/legacy', body: {} }];
    const LabDB = { queueAll: async () => rows.slice(), queueDel: async (id) => { deleted.push(id); }, get: async () => ({ items: [{}], who: 'x', owner: 'alice' }) };
    const localStorage = { getItem: () => JSON.stringify({ token: 'T-' + who, entityId: who }) };
    const fetch = async (url) => { sent.push(url); return { ok: true, status: 200 }; };
    const fn = new Function('LabDB', 'localStorage', 'fetch', 'document', 'savedLive', 'S', 'loadSaved', 'toastSay', 'labApplyCatalogue', parts.map((p) => p[0]).join('\n') + '; return { labDrainOutbox, labUseCache };');
    const api = fn(LabDB, localStorage, fetch, { getElementById: () => null }, () => false, { step: 1 }, async () => {}, () => {}, () => applied.push(1));
    return { api, sent, deleted, applied };
  };
  const alice = world('alice'); await alice.api.labDrainOutbox();
  t('offer-lab-next.html: alice drains only her own queued write', JSON.stringify(alice.sent) === '["/api/a"]' && JSON.stringify(alice.deleted) === '[1]', JSON.stringify([alice.sent, alice.deleted]));
  const bob = world('bob'); await bob.api.labDrainOutbox();
  t('offer-lab-next.html: bob sends his own only, never alice\'s or an unstamped one', JSON.stringify(bob.sent) === '["/api/b"]', JSON.stringify(bob.sent));
  const bobCache = await bob.api.labUseCache('Bob', 'offline'); const aliceCache = await alice.api.labUseCache('Alice', 'offline');
  t('offer-lab-next.html: the cached catalogue shows for the person it was cached for, not the next one', bobCache === false && bob.applied.length === 0 && aliceCache === true && alice.applied.length === 1);
})();
/* the offer lab's spreadsheet import is bounded before and after the parse */
{
  const lab = read('offer-lab-next.html');
  const m = /^function importSpreadsheet\(input\) \{[\s\S]*?\n\}\n/m.exec(lab);
  t('offer-lab-next.html: importSpreadsheet is found', !!m);
  const said = [];
  let reads = 0;
  const FileReader = function () { this.readAsArrayBuffer = () => { reads++; }; };
  const run = new Function('FileReader', 'toastSay', 'XLSX', m[0] + '; return importSpreadsheet;')(FileReader, (x) => said.push(x), {});
  run({ files: [{ size: 6 * 1024 * 1024, name: 'big.xlsx' }] });
  t('offer-lab-next.html: a 6 MB workbook is refused in words and never read', said.length === 1 && /larger than 5 MB/.test(said[0]) && reads === 0, JSON.stringify(said));
  t('offer-lab-next.html: the row ceiling is in the parse path', /list\.length > 20000/.test(m[0]));
}
/* the service worker: run the real file in a vm with a fake self and caches; an api GET on the same origin is never answered through the cache, a no-store reply is never stored */
(async () => {
  const vm = require('vm');
  const listeners = {}, puts = [];
  const caches = { open: async () => ({ put: async (req, res) => { puts.push(new URL(req.url).pathname); }, addAll: async () => {} }), match: async () => undefined, keys: async () => [], delete: async () => true };
  const sandbox = { self: { location: { href: 'https://shop.example/cb-sw.js', origin: 'https://shop.example' }, addEventListener: (n, f) => { listeners[n] = f; }, skipWaiting() {}, clients: { claim() {} } }, caches, URL, Response: { error: () => 'err' }, Promise, console };
  sandbox.fetch = async (req) => ({ ok: true, type: 'basic', headers: { get: (h) => (/api/.test(req.url) ? 'private, no-store' : /secret-static/.test(req.url) ? 'no-store' : '') }, clone() { return this; } });
  vm.runInNewContext(fs.readFileSync(path.join(pub, 'cb-sw.js'), 'utf8'), sandbox);
  const ask = (u, headers) => { let answered = false; listeners.fetch({ request: { method: 'GET', url: 'https://shop.example' + u, mode: 'cors', headers: { has: (h) => !!(headers || {})[h] } }, respondWith: (p) => { answered = true; p.catch(() => {}); } }); return answered; };
  t('cb-sw.js: a same-origin /api/ GET is not answered through the cache', ask('/api/products') === false);
  t('cb-sw.js: a request carrying Authorization is not answered through the cache', ask('/data/x.json', { Authorization: 1 }) === false);
  t('cb-sw.js: a static file still is (the shell opens offline)', ask('/app/core.js') === true);
  await new Promise((r) => setTimeout(r, 20));
  ask('/secret-static.js'); await new Promise((r) => setTimeout(r, 20));
  t('cb-sw.js: a no-store reply is never put in the cache; a plain static one is', !puts.includes('/secret-static.js') && puts.includes('/app/core.js'), JSON.stringify(puts));
  process.exit(fail ? 1 : 0);
})();
