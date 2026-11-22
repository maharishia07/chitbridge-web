'use strict';
/* the one Home draws every manifest entry (Athi 18 Nov): each entry id sits in exactly one home2 group (six pillars + the foot's Labs · Standards · Setup),
   the six pillars are the decided six in order, and index2 is a layout over the SAME frame and facts (no second fetch path). Run: node tests/home-draws-manifest.test.cjs */
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const man = JSON.parse(fs.readFileSync(path.join(root, 'public/app/manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/app/home2.js'), 'utf8');
const h2 = man.home2, groups = h2.pillars.concat(h2.foundation);
assert.deepStrictEqual(h2.pillars.map((g) => g.id), ['sell', 'customers', 'buy', 'money', 'people', 'trade'], 'exactly the six pillars, in order');
assert.deepStrictEqual(h2.foundation.map((g) => g.id), ['labs', 'standards', 'setup'], 'the foot holds Labs, Standards, Setup');
const seen = {};
groups.forEach((g) => g.ids.forEach((id) => { assert(!seen[id], id + ' is in two groups'); seen[id] = g.id; }));
man.entries.forEach((e) => assert(seen[e.id], 'entry ' + e.id + ' is drawn by no group'));
Object.keys(seen).forEach((id) => assert(man.entries.some((e) => e.id === id), id + ' is not a manifest entry'));
console.log('ok  ' + man.entries.length + ' of ' + man.entries.length + ' manifest entries sit in one home2 group');
assert(/<script src="\/app\/shell\.js"><\/script>/.test(html) && /<script src="\/app\/home2\.js"><\/script>/.test(html), 'index2 loads the same shell.js and home2.js');
assert(/CBShell\.mount\(/.test(html) && /CBHome2\.mount\(/.test(html), 'index2 mounts the shell, then moves its cards');
assert(!/fetch\(/.test(js), 'home2.js reads nothing itself: the shell paints the facts it moves');
assert(/coming/.test(js), 'coming entries are not drawn');
console.log('ok  index2 is a layout over the same frame and facts');
