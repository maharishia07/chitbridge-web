/**
 * fail-words.test.cjs - reviews8: a screen paints a failed call as the problem's OWN shopkeeper words (failWords / bodyWords in app/cb-words.js),
 * never a raw e.message (a TypeError, a library string) and never markup. A vm test of the two helpers + a static guard over the four screens
 * that had ~27 raw sites (cap-flag, cap-folders, cap-intake, cap-iddocs) and the standalone intake.html.
 * Run: node e2e/fail-words.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const pub = path.join(__dirname, '..', 'public');
const words = fs.readFileSync(path.join(pub, 'app', 'cb-words.js'), 'utf8');
let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) bad++; };
const grab = (name) => { const i = words.indexOf('function ' + name + '('); let d = 0, j = words.indexOf('{', i); for (; j < words.length; j++) { if (words[j] === '{') d++; else if (words[j] === '}' && !--d) break; } return words.slice(i, j + 1); };
const w = {}; vm.createContext(w);
vm.runInContext(['rewordPlain', 'failWords', 'bodyWords'].map(grab).join('\n') + '\nthis.f = failWords; this.b = bodyWords;', w);
const mk = (message, extra) => Object.assign(new Error(message), extra || {});
ok(w.f(mk('Cannot read properties of undefined (reading x)'), 'Could not save.') === 'Could not save.', 'a raw TypeError message becomes the screen fallback');
ok(w.f(mk('The folder name is already used.', { status: 409, code: 'FOLDER_NAME_TAKEN' }), 'Could not save.') === 'The folder name is already used.', "the api's own words (code + status) are kept");
ok(w.f(mk("You're offline - this needs a connection.", { kind: 'network' }), 'x').indexOf('offline') > 0, 'our own offline words are kept');
ok(w.f(mk('Failed to fetch'), 'x') === 'network hiccup - check your connection and retry'.replace(' - ', ' — '), 'a browser network failure says the one network line');
ok(w.f(mk('<img src=x onerror=alert(1)>Nope', { status: 400 }), 'x') === 'Nope', 'markup from the server is stripped');
ok(w.f(null, 'Could not save.') === 'Could not save.', 'no error -> the fallback');
ok(w.b({ detail: 'Detail words', message: 'm' }, 'f') === 'Detail words', 'body: RFC 9457 detail first');
ok(w.b({ message: '<b>Legacy</b>' }, 'f') === 'Legacy', 'body: message, markup stripped');
ok(w.b({ detail: { a: 1 } }, 'f') === 'f' && w.b(null, 'f') === 'f', 'body: an object or nothing -> the fallback, never [object Object]');
/* static: the screens never paint a raw message */
const raw = /\b(?:e|err|failure|reply\.j|send\.j|j)\s*&&\s*(?:\w+\.)?\w*\.?message\)?\s*\|\||\bj\.message\b|reply\.j\.message|\(e && e\.message\)/;
for (const f of ['app/cap-flag.js', 'app/cap-folders.js', 'app/cap-intake.js', 'app/cap-iddocs.js', 'intake.html']) {
  const hits = fs.readFileSync(path.join(pub, f), 'utf8').split('\n').map((l, i) => (raw.test(l) && !/NET_WORDS|regReply\.status === 0/.test(l) ? i + 1 : 0)).filter(Boolean);
  ok(!hits.length, f + ' paints no raw .message' + (hits.length ? ' (lines ' + hits.join(',') + ')' : ''));
}
ok(/cb-words\.js/.test(fs.readFileSync(path.join(pub, 'intake.html'), 'utf8')), 'intake.html loads cb-words.js (it calls bodyWords)');
process.exit(bad ? 1 : 0);
