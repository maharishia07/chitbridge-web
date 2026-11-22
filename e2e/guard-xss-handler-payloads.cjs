// e2e/guard-xss-handler-payloads.cjs — p1new-1130: PAYLOAD TESTS for the three P1 XSS sites (offline, node only, no browser).
// Each site's REAL builder function is cut out of its source file and run with a hostile value; the markup it returns is read the way a browser reads it
// (start tags, double-quoted attributes, HTML entities decoded) and then every on*= handler is EXECUTED in a vm with recording stand-ins. It passes only when
//   - no element and no attribute appears that the builder did not write (no injected <img onerror>, no injected onmouseover),
//   - the handler calls its one target function exactly once, with the hostile value as ONE argument, byte for byte,
//   - and a canary global that every payload tries to set stays unset.
// Sites: GF-app-html-r3#L30 (supplier Passport button, app.html) · L-sec-web-screens-11#L24 (netAvailToggle key, cap-network-member.js, a product name
// from ANOTHER tenant) · L-sec-web-screens-07#L31 (the roll-up unit, cap-chit2.js: text, not a handler) · L-ux-web-screens-27#L41 (the form cards have a keyboard
// path, checked on source here; the Tab and Enter walk is in e2e/page-frame.cjs). Run: node e2e/guard-xss-handler-payloads.cjs
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const pub = path.join(__dirname, '..', 'public');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' — ' + (why || ''))); if (!ok) fail++; };
const read = (rel) => fs.readFileSync(path.join(pub, rel), 'utf8').replace(/\r\n/g, '\n');

/** the source text of one top-level function (declared at the start of a line, ended by a "}" at the start of a line) */
function fnSource(src, name) {
  const m = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(src);
  if (!m) throw new Error('function ' + name + ' not found');
  const end = src.indexOf('\n}\n', m.index);
  return src.slice(m.index, end + 2);
}
const helpers = read('app/helpers.js');
const esc = new Function(fnSource(helpers, 'esc') + '; return esc;')();
const escJs = new Function(fnSource(helpers, 'esc') + fnSource(helpers, 'escJs') + '; return escJs;')();

/** run source with a scope that answers any name it does not know with a function returning '' (the builders touch many app globals) */
function load(sources, scope) {
  const known = Object.assign({ esc, escJs, tx: (x) => x, txf: (x) => x, String, Number, Math, Object, Array, JSON, Date, Boolean, parseInt, parseFloat, isNaN, encodeURIComponent }, scope);
  const own = new Set(); sources.forEach((x) => x.replace(/function (\w+)\(/g, (_, n) => own.add(n)));
  const proxy = new Proxy(known, {
    has: (o, k) => typeof k === 'string' && !own.has(k) && !(k in o ? false : k in globalThis) && k !== 'undefined' && k !== 'NaN' && k !== 'Infinity',
    get: (o, k) => (k === Symbol.unscopables ? undefined : k in o ? o[k] : () => '')
  });
  return new Function('__s', 'with (__s) { ' + sources.join('\n') + '\n return { ' + Object.keys(scope.__export || {}).join(',') + ' } }')(proxy);
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi, (_, h, d, n) => (n ? ENT[n.toLowerCase()] : String.fromCodePoint(h ? parseInt(h, 16) : +d)));
/** start tags of an HTML string, attributes read as a browser reads them: name=value with "double", 'single' or bare values */
function tags(html) {
  const out = [], re = /<([a-zA-Z][\w-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = {}, are = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let a;
    while ((a = are.exec(m[2]))) attrs[a[1].toLowerCase()] = decode(a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4] || '');
    out.push({ tag: m[1].toLowerCase(), attrs });
  }
  return out;
}

const PAYLOADS = [
  '"><img src=x onerror=__pwn=1>',
  'a"b',
  'a\\b',
  "x');__pwn=1;//",
  "x\\');__pwn=1;//",
  'a’b“c＂d＇e',
  'line1\nline2 line3',
  '</script><svg onload=__pwn=1>',
  "a&#39;);__pwn=1;//&quot;"
];
const WANTED_ATTRS = /^(?:class|style|data-[\w-]+|onclick|role|tabindex|id|title|type|value|aria-[\w-]+|for|name|href|colspan)$/;

/** every on*= handler in the markup runs in a vm: ok only when the recorded calls are exactly `expected` and the canary stays unset */
function runHandlers(html, expected, label) {
  const problems = [];
  const all = tags(html);
  all.forEach((tg) => {
    if (!/^(?:div|span|b|i|button|input|select|option|label|a|p|small|strong|em|td|tr|th|table|tbody|thead|ul|li|br|h\d|section|svg|path)$/.test(tg.tag)) problems.push('unexpected element <' + tg.tag + '>');
    Object.keys(tg.attrs).forEach((n) => { if (!WANTED_ATTRS.test(n)) problems.push('unexpected attribute ' + n + ' on <' + tg.tag + '>'); });
  });
  const calls = [];
  all.filter((tg) => tg.attrs.onclick !== undefined).forEach((tg) => {
    const ctx = vm.createContext({ __pwn: 0, event: { stopPropagation() {} } });
    /* every function the handler calls is a recording stand-in; only the calls to the TARGETS are compared (the card's other buttons call their own) */
    (tg.attrs.onclick.match(/[A-Za-z_]\w*(?=\()/g) || []).forEach((fn) => { ctx[fn] = (...args) => calls.push({ fn, args }); });
    ctx.__self = { dataset: Object.fromEntries(Object.keys(tg.attrs).filter((n) => /^data-/.test(n)).map((n) => [n.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase()), tg.attrs[n]])) };
    try { vm.runInContext('(function(){' + tg.attrs.onclick + '}).call(__self)', ctx, { timeout: 500 }); } catch (e) { problems.push('handler threw: ' + e.message); }
    if (ctx.__pwn) problems.push('the canary was set: a payload ran');
  });
  const want = JSON.stringify(expected.map((e) => ({ fn: e.fn, args: e.args })));
  const targets = new Set(expected.map((e) => e.fn));
  const got = JSON.stringify(calls.filter((c) => targets.has(c.fn)));
  if (got !== want) problems.push('calls ' + got + ' != ' + want);
  return problems.length ? label + ': ' + problems.join('; ') : '';
}

/* ── site 1: the supplier card's Passport button (app.html supInfoCardHTML) ───────────────────────────────────────────────────────────────────────── */
{
  const appSrc = read('app.html'), supSrc = read('app/cap-suppliers.js');
  const env = load([fnSource(supSrc, 'supName'), fnSource(appSrc, 'supInfoCardHTML')], { UI: {}, __export: { supName: 1, supInfoCardHTML: 1 } });
  const bad = [];
  PAYLOADS.forEach((p) => {
    const html = env.supInfoCardHTML({ supplier_list_id: 'sl-1', bridge_id: 'br-9', display_name: p, nickname: '' });
    const e = runHandlers(html, [{ fn: 'viewSupplierPassport', args: ['br-9', p] }], JSON.stringify(p));
    /* the second target on the card (supEdit) is called with the list id only; filter its calls out of the comparison by building the expectation from both buttons */
    if (e) bad.push(e);
  });
  t('app.html supplier Passport button: ' + PAYLOADS.length + ' hostile names reach viewSupplierPassport as ONE argument, no handler injected', bad.length === 0, bad.slice(0, 2).join(' | '));
  const html = env.supInfoCardHTML({ supplier_list_id: 'sl-1', bridge_id: 'br"9', display_name: 'Acme', nickname: '' });
  const btn = tags(html).find((x) => x.attrs['data-testid'] === 'sup-passport');
  t('app.html Passport button carries the data-testid and reads data-bid and data-nm', !!btn && btn.attrs.onclick.indexOf('this.dataset.bid') > 0 && btn.attrs['data-bid'] === 'br"9' && btn.attrs['data-nm'] === 'Acme');
}

/* ── site 2: netAvailToggle (cap-network-member.js _netAvailBody), the key is built from ANOTHER tenant's product name ─────────────────────────────── */
{
  const src = read('app/cap-network-member.js');
  const bad = [];
  PAYLOADS.forEach((p) => {
    const env = load([fnSource(src, '_netAvailBody')], { UI: { _avQ: 'abc', _avRes: { rows: [{ name: p, code: '', qty: 3, store_name: 'S', entity_id: 'e1' }] }, _avOpen: null }, __export: { _netAvailBody: 1 } });
    const html = env._netAvailBody();
    const e = runHandlers(html, [{ fn: 'netAvailToggle', args: ['n:' + p.toLowerCase()] }], JSON.stringify(p));
    if (e) bad.push(e);
  });
  t('cap-network-member.js netAvailToggle: ' + PAYLOADS.length + ' hostile product names reach netAvailToggle as ONE argument, no handler injected', bad.length === 0, bad.slice(0, 2).join(' | '));
}

/* ── site 3: the roll-up writes the line unit as text (cap-chit2.js c2RollupText) ──────────────────────────────────────────────────────────────────── */
{
  const src = read('app/cap-chit2.js');
  const c2nStart = src.indexOf('var c2n = function');
  const c2nSrc = src.slice(c2nStart, src.indexOf('\n};\n', c2nStart) + 4);
  const env = load([c2nSrc].concat(['c2Rollup', 'c2RollupText'].map((n) => fnSource(src, n))), { __export: { c2RollupText: 1 } });
  const bad = [];
  PAYLOADS.forEach((p) => {
    const html = env.c2RollupText([{ line_id: 'l1', live: { unit: p, quantity: 5 } }], {}, {});
    const e = runHandlers(html, [], JSON.stringify(p));
    if (e || /<(?:img|svg|script)/i.test(html)) bad.push(e || 'raw element in ' + html);
  });
  t('cap-chit2.js roll-up: ' + PAYLOADS.length + ' hostile units are written as text, no element or attribute appears', bad.length === 0, bad.slice(0, 2).join(' | '));
  const html = env.c2RollupText([{ line_id: 'l1', live: { unit: 'kg', quantity: 5 } }], {}, {});
  t('cap-chit2.js roll-up: an ordinary unit reads as before', /5 kg left/.test(html), html);
}

/* ── site 5 (source layer): the form cards have a keyboard path (the Tab and Enter walk: e2e/page-frame.cjs) ───────────────────────────────────── */
{
  const af = read('authority-forms.html');
  const card = /<div data-cbsid="DOC001-C01" class="formcard'[\s\S]*?'"><div class="t">/.exec(af);
  t('authority-forms.html form card: role=button, tabindex 0, aria-pressed, data-key, and no inline onclick', !!card && /role="button" tabindex="0"/.test(card[0]) && /aria-pressed/.test(card[0]) && /data-key="/.test(card[0]) && !/onclick/.test(card[0]));
  t('authority-forms.html: one delegated click listener and one keydown listener (Enter and Space) pick a card', /addEventListener\('click'[\s\S]*?pick\(card\.getAttribute\('data-key'\)\)/.test(af) && /addEventListener\('keydown'[\s\S]*?ev\.key !== 'Enter' && ev\.key !== ' '/.test(af));
  t('authority-forms.html: a focused card shows a focus ring', /\.formcard:focus-visible\{/.test(af));
}
process.exit(fail ? 1 : 0);
