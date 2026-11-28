'use strict';
/* O4 (Athi 28 Nov): the employees screen shows the typed sign-in name (the api's `sign_in_as`, built by lib/handle.js typedForm), never the stored name@shop.br.
   Static guard, offline: no employees file shows `user_id`, and none strips a kind suffix itself (the rendered text is held by e2e/walk-employees.cjs).
   Run: node tests/o4-typed-signin.test.cjs */
const fs = require('fs'), assert = require('assert');
let n = 0;
const ok = (c, what) => { assert(c, what); n++; console.log('  ok  ' + what); };
const dir = __dirname + '/../public/app/';
const files = ['cap-employees.js', 'cap-employees-copy.js'].map((f) => [f, fs.readFileSync(dir + f, 'utf8')]);
for (const [f, src] of files) {
  const shows = src.split('\n').filter((l) => /(nameWithCopy|signInName)\(/.test(l) && !/function (nameWithCopy|signInName)/.test(l));
  ok(shows.length > 0 || f.endsWith('copy.js'), f + ': has sign-in name call sites or is the helper file');
  ok(shows.every((l) => !/\.user_id\b/.test(l)), f + ': every shown sign-in name reads sign_in_as / login_format, never user_id');
  ok(!/replace\([^)]*\?\.(br|cr)\b|\.\(br\|cr\)/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), f + ': the page never strips .br / .cr itself');
}
ok(!files.some(([, s]) => /\.user_id\b/.test((s.match(/cell: function \(p\) \{[^}]*\}/g) || []).join(''))), 'no list cell renders user_id');
console.log(n + ' checks passed');
