'use strict';
/** FW-46 (walk 25 Nov): "Guide" was live for connectors marked "Not built yet". Run: node tests/fw46-guide-grey-1130.test.cjs */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const win = { CFG: { API_BASE: 'https://x' }, esc: (x) => x }; win.window = win; vm.createContext(win); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-settings-guide.js'), 'utf8'), win);
const ctx = { T: (x) => x, grey: (may) => (may && may.allowed === false ? 'Not built yet' : '') };
const act = win.CBSettingsGuide.make(ctx).guideAction;
const a = typeof act === 'function' ? act(ctx) : act;
assert.strictEqual(a.why({ id: 'tally', guide: 'g', may: { allowed: false, code: 'NOT_YET' } }), 'Not built yet', 'not built: Guide greyed with the same sentence');
assert.notStrictEqual(a.why({ id: 'x', may: { allowed: false, code: 'OWNER_ONLY' } }), 'Not built yet', 'another refusal does not grey the guide');
console.log('ok fw46');
