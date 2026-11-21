/**
 * tests/walkn-1129-web.test.cjs - WALK N (21 Nov): N-F-07 the owner's rail has Messages; N-F-01 an EMPTY catalogue in Compose is "No items yet" + the add action, the error words only after a FAILED read;
 * N-F-02 a view-only login's Compose is greyed with the reason (nav) and never opens (compose()); N-F-16 the co-assist's hat word comes from the stored access_level (viewer), not the hat default (editor).
 * Hand figures: 1 viewer + 1 editor co-assist -> labels Viewer, Editor (the walk read Editor, Editor). No browser. Run: node tests/walkn-1129-web.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const app = read('public/app.html');

/* N-F-07: the owner group 'Work' lists Messages, before Intake */
assert(/\['worklist', '🧰', "Everyone's work"\],\s*\/\*[^\n]*\*\/\s*\['messages', '💬', 'Messages'\],\s*\['intake'/.test(app), "the owner's Work group has the Messages entry before Intake");

/* N-F-01 */
assert(/_catFailed = true;/.test(app) && /UI\._catState = \(STORE\.catalogue \|\| \[\]\)\.length \|\| !_catFailed \? 'ready' : 'error';/.test(app), 'empty is ready; error only when the read failed');
assert(app.includes("'No items yet — a chit needs at least one line item. <a") && app.includes('Add a product in Catalogue &rarr;'), 'the empty words carry the add action');

/* N-F-02 */
assert(/key === 'compose' && typeof viewOnlyLogin === 'function' && viewOnlyLogin\(\)/.test(app) && /aria-disabled="true" data-ready="no" title="\$\{esc\(reason\)\}"/.test(app), 'nav Compose is greyed with the reason for a view-only login');
assert(/async function compose\(prefill\) \{\s*\/\*[^\n]*\*\/\s*if \(typeof viewOnlyLogin === 'function' && viewOnlyLogin\(\)\) return toast\(composeViewOnlyWhy\(\)\);/.test(app), 'compose() does not open for a view-only login');

/* N-F-16: run the real actor-hat.js with the real accessLevelOf */
const grab = (re) => { const m = re.exec(app); assert(m, 'found ' + re); return m[0]; };
const ctx = { tx: (s) => s };
vm.createContext(ctx);
vm.runInContext(grab(/const ACCESS_LABEL = [^\n]*\n/) + grab(/const LEVEL_FROM_HAT = [^\n]*\n/) + grab(/function accessLevelOf\(x\) \{[\s\S]*?\n\}\n/) + grab(/function hatLabel\(x\) \{[\s\S]*?\n\}\n/) + read('public/app/actor-hat.js'), ctx);
const viewer = ctx.actorHatFields({ access_level: 'viewer' }), editor = ctx.actorHatFields({ hat: 'act', access_level: 'editor' });
assert.strictEqual(ctx.hatLabel(viewer), 'Viewer', 'a viewer co-assist reads Viewer');
assert.strictEqual(ctx.hatLabel(editor), 'Editor', 'an editor reads Editor');
assert.strictEqual(ctx.hatLabel(ctx.actorHatFields({ hat: 'audit' })), 'Commenter', 'an old row with only a hat still maps (audit -> commenter)');
assert.strictEqual(ctx.hatAssignable(viewer), false, 'a viewer holds no work');
assert(!/hatLabel\(x\.hat\)/.test(read('public/app/cap-workforce.js')), 'the list and the detail pass the actor, not the bare hat');
console.log('walkn-1129-web: ok');
