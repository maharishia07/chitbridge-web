'use strict';
/**
 * FW-42 (walk 25 Nov): the avatar menu printed "Owner · [object Object]" on a practice seat, whose session entity is an object.
 * Lifts personOf + entityWord out of avatar.js and checks the three shapes by hand.   Run: node tests/fw42-avatar-entity-1130.test.cjs
 */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'avatar.js'), 'utf8');
function cut(name) { const a = src.indexOf('function ' + name + '('); let d = 0, i = src.indexOf('{', a); for (let j = i; j < src.length; j++) { if (src[j] === '{') d++; if (src[j] === '}' && --d === 0) return src.slice(a, j + 1); } }
const ctx = {}; vm.createContext(ctx);
vm.runInContext(cut('personOf') + '\n' + cut('entityWord') + '\nthis.p = personOf;', ctx);
assert.strictEqual(ctx.p({ role: 'entity', name: 'Asha', entity: 'Moonee Espresso' }).role, 'Owner · Moonee Espresso');
assert.strictEqual(ctx.p({ role: 'entity', name: 'Asha', entity: { id: 'e1', name: 'Bayside Bookkeeping' } }).role, 'Owner · Bayside Bookkeeping');
assert.strictEqual(ctx.p({ role: 'entity', name: 'Asha', entity: {} }).role, 'Owner');
assert(!/object Object/.test(ctx.p({ role: 'actor', entity: { x: 1 } }).role));
console.log('ok fw42');
