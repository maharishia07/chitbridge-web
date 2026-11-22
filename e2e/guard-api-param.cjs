// e2e/guard-api-param.cjs — SEC-FIX (batch 1129): no page reads the ?api= override except through cbApiParam (public/app/cb-words.js), which
// allows only this origin, this deployment's own api (window.CB_API) and localhost on a localhost page. A foreign ?api= would aim the
// signed-in user's Bearer token at another host. Static scan of public/ + a vm test of the helper. Offline.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', 'public');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' — ' + (why || ''))); if (!ok) fail++; };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const skip = /^(till\.html|app[\/]cb-words\.js)$/; /* the till copy is vendored (api master owns it) */
const files = walk(root).filter((f) => /\.(html|js)$/.test(f) && !skip.test(path.relative(root, f)));
const bare = [], users = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8'), rel = path.relative(root, f);
  src.split('\n').forEach((l, i) => { if (/\.get\(\s*['"]api['"]\s*\)/.test(l) && !/cbApiParam\(\s*[\w.]*(?:new URLSearchParams\(location\.search\)|\w+)\.get\(\s*['"]api['"]\s*\)\s*\)/.test(l)) bare.push(rel + ':' + (i + 1)); });
  if (/cbApiParam\(/.test(src)) users.push([rel, src]);
}
t('no ?api= read outside cbApiParam (' + files.length + ' files scanned)', bare.length === 0, bare.join(', '));
const noLoad = users.filter(([rel, src]) => !/cb-words\.js/.test(src) && !/^app[\/]/.test(rel)).map(([r]) => r);
t('every page that calls cbApiParam loads cb-words.js', noLoad.length === 0, noLoad.join(', '));
t('cbApiParam is used by ' + users.length + ' files', users.length >= 15, String(users.length));

const words = fs.readFileSync(path.join(root, 'app', 'cb-words.js'), 'utf8');
/* cbApiParam is split into named steps (cbOwnApiOrigin, cbApiParamAllowed): the test takes all three top-level functions */
const parts = ['cbOwnApiOrigin', 'cbApiParamAllowed', 'cbApiParam'].map((name) => words.match(new RegExp('function ' + name + '\\(\\w*\\) \\{[\\s\\S]*?\\n\\}')));
const fn = parts.every(Boolean) ? [parts.map((p) => p[0]).join('\n')] : null;
t('cbApiParam found in cb-words.js', !!fn);
if (fn) {
  const mk = (host, api) => { const c = vm.createContext({ URL, console: { warn() {} }, window: { CB_API: api }, location: { href: 'https://' + host + '/p.html', origin: 'https://' + host, hostname: host } }); vm.runInContext(fn[0] + '\nthis.P = cbApiParam;', c); return c.P; };
  const P = mk('web.chitbridge.example', 'https://api.chitbridge.example');
  t('evil origin refused', P('https://evil.example') === '' && P('https://web.chitbridge.example.evil.example') === '' && P('https://api.chitbridge.example@evil.example') === '' && P('//evil.example') === '' && P('javascript:alert(1)') === '');
  t('look-alike and sibling hosts refused', P('https://evil-chitbridge.example') === '' && P('https://other.chitbridge.example') === '');
  t('the known api origin allowed', P('https://api.chitbridge.example') === 'https://api.chitbridge.example' && P('https://web.chitbridge.example/x') !== '');
  t('localhost refused on a real page', P('http://localhost:4000') === '' && P('http://127.0.0.1:4000') === '');
  const L = mk('localhost', 'http://localhost:4000');
  t('localhost allowed on a localhost page; evil still refused', L('http://localhost:4100') === 'http://localhost:4100' && L('https://evil.example') === '');
  t('empty gives empty', P('') === '' && P(null) === '');
}
console.log(fail ? '\nFAIL ' + fail : '\nall ok');
process.exit(fail ? 1 : 0);
