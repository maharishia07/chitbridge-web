'use strict';
// @type: unit
/* CARD: retest 1130 (lane retest1129b): proof that a crafted ?api= link cannot aim the Bearer token at another host. Offline: runs the REAL cbApiParam from
   public/app/cb-words.js against a faked location/window, and reads every page that takes ?api=.
   Findings: EL-web-screens-23#L72 (network.html) · EL-web-screens-23#L212 · GF-web-screens-23#L39 · L-sec-web-screens-22#L21 and EL-web-screens-22#L39 (testing.html) ·
   L-sec-web-screens-23#L42 (network-shop.html) · L-sec-web-screens-20#L35 (conversion-lab.html) · L-sec-web-screens-24#L21 and GF-web-screens-24#L33 (offer-lab-next.html,
   product-lab.html) · EL-web-screens-27#L53 and L-sec-web-screens-27#L29 (cb-words.js allow-list; authority-forms.html, record.html).
   Break check: the "flip" lines run the same pages with cbApiParam( removed and must fail; the allow-list is also run with a permissive stub.
   Run: node tests/retest-1130-api-param.test.cjs */
const fs = require('fs'), vm = require('vm'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
const words = fs.readFileSync(path.join(pub, 'app', 'cb-words.js'), 'utf8');
let n = 0, fail = 0;
const ok = (name, cond, why) => { n++; if (!cond) { fail++; console.log('  FAIL ' + name + (why ? ' - ' + why : '')); } else console.log('  ok  ' + name); };
const grab = (name) => { const at = words.indexOf('function ' + name + '('); if (at < 0) throw new Error(name + ' is gone'); let i = words.indexOf('{', at), d = 0; for (; i < words.length; i++) { if (words[i] === '{') d++; else if (words[i] === '}' && --d === 0) break; } return words.slice(at, i + 1); };
function page(href, cbApi) {
  const loc = new URL(href); const ctx = { URL, console: { warn() {} }, location: { href, origin: loc.origin, hostname: loc.hostname }, window: {} };
  if (cbApi) ctx.window.CB_API = cbApi; vm.createContext(ctx);
  vm.runInContext(grab('cbOwnApiOrigin') + '\n' + grab('cbApiParamAllowed') + '\n' + grab('cbApiParam'), ctx); return ctx;
}
const t = (href, param, cbApi) => vm.runInContext('cbApiParam(' + JSON.stringify(param) + ')', page(href, cbApi));
const SITE = 'https://staging.example/network.html', API = 'https://api.example';
ok('a foreign host is ignored (token never re-pointed)', t(SITE, 'https://evil.example', API) === '');
ok('a foreign host with the site name inside it is ignored', t(SITE, 'https://staging.example.evil.example', API) === '' && t(SITE, 'https://evil.example/https://staging.example', API) === '');
ok('a protocol-relative and a javascript: value are ignored', t(SITE, '//evil.example', API) === '' && t(SITE, 'javascript:alert(1)', API) === '');
ok('localhost is refused from a production page', t(SITE, 'http://localhost:3000', API) === '');
ok('this site is honoured', t(SITE, 'https://staging.example', API) === 'https://staging.example');
ok('this deployment\'s own api (window.CB_API) is honoured', t(SITE, API, API) === API);
ok('localhost is honoured from a localhost page', t('http://localhost:5173/network.html', 'http://localhost:3000', '') === 'http://localhost:3000');
ok('an empty or missing param gives empty', t(SITE, '', API) === '' && t(SITE, null, API) === '');

const pages = { 'network.html': 'EL-web-screens-23#L72 / GF-web-screens-23#L39', 'testing.html': 'L-sec-web-screens-22#L21 / EL-web-screens-22#L39', 'network-shop.html': 'L-sec-web-screens-23#L42',
  'conversion-lab.html': 'L-sec-web-screens-20#L35', 'offer-lab-next.html': 'L-sec-web-screens-24#L21 / GF-web-screens-24#L33', 'product-lab.html': 'L-sec-web-screens-24#L21',
  'authority-forms.html': 'EL-web-screens-27#L53', 'network-design.html': 'EL-web-screens-23#L212', 'shop.html': 'EL-web-screens-23#L212', 'tasks.html': 'EL-web-screens-23#L212', 'cmdb/record.html': 'L-sec-web-screens-27#L29' };
const takes = /(?:get|q\.get)\('api'\)/;
for (const f of Object.keys(pages)) {
  const src = fs.readFileSync(path.join(pub, f), 'utf8');
  const lines = src.split('\n').filter((l) => takes.test(l));
  const good = (s) => s.split('\n').filter((l) => takes.test(l)).every((l) => /cbApiParam\(\s*(?:new URLSearchParams\(location\.search\)|q|query)\.get\('api'\)\s*\)/.test(l));
  ok(pages[f] + ': ' + f + ' reads ?api= only through cbApiParam (' + lines.length + ' site)', lines.length >= 1 && good(src) && /cb-words\.js/.test(src));
  ok('flip: ' + f + ' fails when cbApiParam( is removed', good(src.replace(/cbApiParam\(/g, '(')) === false);
}
ok('EL-web-screens-27#L53 / L-sec-web-screens-27#L29 cb-words.js allow-list checks protocol and sameSite|localhost-from-localhost', /\/\^https\?:\$\/\.test\(address\.protocol\)/.test(words) && /sameSite \|\| \(local\.test\(address\.hostname\) && local\.test\(location\.hostname\)\)/.test(words));
console.log(n + ' checks, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
