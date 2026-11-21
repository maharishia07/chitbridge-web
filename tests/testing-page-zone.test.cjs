/* E-F-06: the testing page shows every time in the shop's zone (shopDateTime), never the device's toLocale*. */
'use strict';
const fs = require('fs'), assert = require('assert');
const h = fs.readFileSync(__dirname + '/../public/testing.html', 'utf8');
assert.strictEqual((h.match(/\.toLocale(Date|Time)?String\(/g) || []).length, 0, 'testing.html formats a time itself: use shopDateTime(ts, opts)');
assert.ok(/<script src="\/app\/helpers\.js">/.test(h), 'helpers.js (shopDateTime) is loaded');
console.log('testing-page-zone ok · 2 checks');
