/* tests/ux218-refused-list-not-nobody.test.cjs — UX-218 GUARD: a refused list (403/503) is never drawn as "Nobody can see your books" / "Nobody has looked yet".
 * Pure source read of public/app/books-grant-member.js: on a refusal the lists are emptied AND both empty states say "Only the owner sees this" with the server's sentence (panel.why). */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'books-grant-member.js'), 'utf8');
const firms = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'books-grant-firms.js'), 'utf8'); /* UX-215's outside-firms block lives in its own module (split for the file-size ratchet) */
let ok = 0;
const pass = (w) => { ok++; console.log('  ok  ' + w); };
assert(/if \(!panel\.why\) throw failure;\s*\n\s*panel\.given = \[\]; panel\.parents = \[\]; panel\.looks = \[\];/.test(src));
pass('a refused read empties the lists it holds');
const empties = src.match(/empty: panel\.why\s*\n\s*\? \{ title: words\('Only the owner sees this'\), body: panel\.why \}/g) || [];
assert.strictEqual(empties.length, 1); /* web #820 (firm-connect) replaced the Who-looked empty state with the Visits list, which has its own refusal row: one empty state is left here */
pass('the empty state of Access I gave says it was refused when the server refused');
for (const m of src.matchAll(/title: words\('(Nobody[^']*)'\)/g)) {
  const at = src.lastIndexOf('empty:', m.index);
  assert(/panel\.why\s*\n\s*\?/.test(src.slice(at, m.index)), m[1] + ' is drawn without the refused branch');
}
pass('every "Nobody ..." title sits behind the refused branch');
console.log(ok + ' passed');
/* UX-215 (one source): the firm's way in uses the network's own connect routes, never a second grant path; Accept reloads the ONE list so the firm shows at once. */
assert(/'\/connections\/' \+ button\.getAttribute\('data-firm'\) \+ '\/' \+ verb/.test(firms) && /e\.type === 'agency' && e\.state === 'requested'/.test(firms));
pass('Accept and Decline call the network approve/decline routes for a pending agency edge the firm asked');
assert(/outcome: function \(\) \{\s*\n\s*ctx\.reload\(\)/.test(firms));
pass('after Accept the one grants list is read again (the firm is a parent at once)');
assert(!/books-grants'?,?\s*\{?\s*(method|m)/.test(src) && (firms.match(/'POST', *NETWORK/g) || []).length === 2);
pass('the only writes beside the grants api are the two network connect calls (no second grant writer)');
console.log('UX-215 ' + ok + ' total');
