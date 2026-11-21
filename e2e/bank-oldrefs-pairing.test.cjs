'use strict';
/**
 * bank-oldrefs-pairing.test.cjs — a statement line posted BEFORE the bank's own reference became the key (stored under the old narration-fingerprint ref)
 * is still paired with its entry: bkshPairing also tries engine.project.oldRefsOf (engines #153/#154; guarded by typeof until the engines adopt it).
 */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-bank-sheet.js'), 'utf8');
const at = src.indexOf('function bkshPairing('), body = src.slice(at, src.indexOf('\n}\n', at) + 3);
const pair = (project, posted) => {
  const sb = {
    bkshEngine: () => ({ project }),
    bkshBook: () => ({ postedLocal: {} }),
    bankStoreState: { posted: posted.map(([ref, no]) => ({ ref, entry_no: no })) },
    BKSH: {},
    bkshRefAccount: () => '1010'
  };
  vm.createContext(sb);
  vm.runInContext(body + '\nthis.out = bkshPairing([{}, {}]);', sb);
  return sb.out;
};
let ran = 0;
const ok = (what) => console.log('  ok  ' + what, ++ran && '');
const refsOf = () => ['bank:new1-1', 'bank:new2-1'];
const old = pair({ refsOf, oldRefsOf: () => ['bank:old1-1', null] }, [['bank:old1-1', 'J-7'], ['bank:new2-1', 'J-8']]);
assert.strictEqual(old.posted['bank:new1-1'], 'J-7');
assert.strictEqual(old.posted['bank:new2-1'], 'J-8');
ok('a line stored under the old ref pairs with its entry through the new ref; a new-ref line is as before');
const keep = pair({ refsOf, oldRefsOf: () => ['bank:old1-1', null] }, [['bank:old1-1', 'J-7'], ['bank:new1-1', 'J-9']]);
assert.strictEqual(keep.posted['bank:new1-1'], 'J-9');
ok('an entry stored under the new ref is never overwritten by the old one');
const none = pair({ refsOf }, [['bank:old1-1', 'J-7']]);
assert.deepStrictEqual(none.line_refs, refsOf());
assert.strictEqual(none.posted['bank:new1-1'], undefined);
ok('an engines copy without oldRefsOf (before the adopt) pairs exactly as before');
console.log(ran + ' checks passed');
