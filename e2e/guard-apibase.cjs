// e2e/guard-apibase.cjs — SEC / fixApiBase (batch 1129): THE api base has ONE reader (public/app/api-base.js, CBApiBase); production ignores localStorage.cb_api_base.
// 1. behaviour: on a production host the override is ignored (and removed); on localhost the override still works; a *.sslip.io SIT page honours a SIT or local override only; a foreign target is refused everywhere.
// 2. static: no read of localStorage.cb_api_base anywhere under public/ except api-base.js (a second reader is a second rule).
// 3. every page that loads app/shell.js loads app/api-base.js first (else the page would lose its local default).
// Fails on the parent commit (the five direct readers honoured the override on production). Run: node e2e/guard-apibase.cjs
'use strict';
const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
const api = require(path.join(pub, 'app', 'api-base.js'));
const PROD = 'https://api.chitbridge.example';
const evil = 'https://evil.example';
const bad = [];
function eq(name, got, want) { if (got !== want) bad.push(name + ': got ' + got + ', want ' + want); }
const quiet = { warn() {}, error() {} };
const keep = global.console;
global.console = quiet;
try {
  let removed = 0;
  eq('production ignores an evil override', api.resolve({ host: 'app.chitbridge.example', stored: evil, cbApi: PROD, remove() { removed++; } }), PROD);
  eq('production removes the stored key', removed, 1);
  eq('production ignores even a localhost override', api.resolve({ host: 'app.chitbridge.example', stored: 'http://localhost:3000', cbApi: PROD, remove() {} }), PROD);
  eq('production ignores a SIT override', api.resolve({ host: 'app.chitbridge.example', stored: 'https://1-2-3-4.sslip.io', cbApi: PROD, remove() {} }), PROD);
  eq('production without override', api.resolve({ host: 'app.chitbridge.example', cbApi: PROD, stored: null }), PROD);
  eq('a lookalike host is production', api.resolve({ host: 'localhost.evil.example', stored: evil, cbApi: PROD, remove() {} }), PROD);
  eq('a lookalike sslip host is production', api.resolve({ host: 'x.sslip.io.evil.example', stored: evil, cbApi: PROD, remove() {} }), PROD);
  eq('localhost honours a local override', api.resolve({ host: 'localhost', stored: 'http://127.0.0.1:3998', cbApi: PROD }), 'http://127.0.0.1:3998');
  eq('localhost honours a SIT override', api.resolve({ host: '127.0.0.1', stored: 'https://8-231-91-112.sslip.io', cbApi: PROD }), 'https://8-231-91-112.sslip.io');
  eq('localhost refuses a foreign override', api.resolve({ host: 'localhost', stored: evil, cbApi: PROD }), 'http://localhost:3000');
  eq('localhost default', api.resolve({ host: 'localhost', stored: null, cbApi: PROD }), 'http://localhost:3000');
  eq('SIT page honours its own override', api.resolve({ host: '8-231-91-112.sslip.io', stored: 'https://8-231-91-112.sslip.io', cbApi: PROD }), 'https://8-231-91-112.sslip.io');
  eq('SIT page honours the origin override the walks set', api.resolve({ host: '8-231-91-112.sslip.io', stored: 'https://8-231-91-112.sslip.io', cbApi: 'https://8-231-91-112.sslip.io' }), 'https://8-231-91-112.sslip.io');
  eq('SIT page refuses a foreign override', api.resolve({ host: '8-231-91-112.sslip.io', stored: evil, cbApi: PROD }), PROD);
  eq('stage means the built-in base', api.resolve({ host: 'localhost', stored: 'stage', cbApi: PROD }), PROD);
} finally { global.console = keep; }
// the console says so loudly when an override is used
let said = '';
global.console = { warn(m) { said += m; }, error(m) { said += m; } };
api.resolve({ host: 'localhost', stored: 'http://127.0.0.1:3998', cbApi: PROD });
global.console = keep;
if (!/OVERRIDE IN USE/.test(said)) bad.push('an override in use is not said in the console');
// static: one reader
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(pub).filter((x) => /\.(js|html)$/.test(x))) {
  if (path.basename(f) === 'api-base.js') continue;
  fs.readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
    if (/getItem\(\s*['"]cb_api_base['"]/.test(ln)) bad.push(path.relative(pub, f) + ':' + (i + 1) + '  second reader of cb_api_base: use CBApiBase.get()');
  });
  if (/\.html$/.test(f)) {
    const t = fs.readFileSync(f, 'utf8');
    if (path.basename(f) !== 'bank-demo.html' /* no config.js and no api call, by design */ && /src="\/app\/shell\.js"/.test(t) && !/src="\/app\/api-base\.js"/.test(t)) bad.push(path.relative(pub, f) + ': loads shell.js without app/api-base.js');
  }
}
if (bad.length) { console.error('guard-apibase: ' + bad.length + ' problem(s)\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('guard-apibase: ok (production ignores the override; local and SIT hosts keep it; one reader)');
