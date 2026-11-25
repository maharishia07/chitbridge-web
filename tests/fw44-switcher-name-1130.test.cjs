'use strict';
/** FW-44 (walk 25 Nov): Settings showed "⌂ Home ▼" (area switcher) beside "⌂ Home" (link): the switcher fell to the AREA word. A page inside an area names itself by its <title>. Run: node tests/fw44-switcher-name-1130.test.cjs */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'shell.js'), 'utf8');
const a = src.indexOf('function pageTitleFor('); let d = 0, i = src.indexOf('{', a), end;
for (let j = i; j < src.length; j++) { if (src[j] === '{') d++; if (src[j] === '}' && --d === 0) { end = j + 1; break; } }
function run(title, app) { const c = { host: { app }, doc: { title }, W: { areas: { home: 'Home' } } }; vm.createContext(c); vm.runInContext(src.slice(a, end) + '\nthis.f = pageTitleFor;', c); return c.f('home'); }
assert.strictEqual(run('Accounts', 'accounts'), 'Accounts');
assert.strictEqual(run('Settings · ChitBridge', 'accounts'), 'Settings');
assert.strictEqual(run('Home', 'accounts'), '', 'a page titled Home keeps the area word');
assert.strictEqual(run('Accounts', 'home'), '', 'the Home app keeps the area word');
console.log('ok fw44');
