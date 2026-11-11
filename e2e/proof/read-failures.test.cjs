'use strict';
// @type: unit
/* readFailures: a refused or failed GET on the api is named; a 200, a write and a non-api file are not. Red when the helper or the pack's use of it is removed.
   Run: node e2e/proof/read-failures.test.cjs */
const assert = require('assert'), fs = require('fs'), path = require('path');
const { readFailures } = require('./read-failures.cjs');
const B = 'https://staging.x.sslip.io';
const got = readFailures([
  { method: 'GET', status: 429, url: B + '/api/tasks?x=1' }, { method: 'GET', status: 200, url: B + '/api/me' },
  { method: 'POST', status: 500, url: B + '/api/x' }, { method: 'GET', status: 404, url: B + '/favicon.ico' }, { method: 'GET', status: 503, url: B + '/api/finance/collect' },
], B);
assert.deepStrictEqual(got, ['429 /api/tasks', '503 /api/finance/collect']);
assert.deepStrictEqual(readFailures([], B), []);
const kb = fs.readFileSync(path.join(__dirname, 'keyboard.cjs'), 'utf8'), run = fs.readFileSync(path.join(__dirname, 'run.cjs'), 'utf8');
assert.ok(/readFailures\(/.test(kb) && /dataNotLoaded/.test(kb), 'keyboard.cjs must record dataNotLoaded from readFailures');
assert.ok(/dataNotLoaded/.test(run), 'run.cjs must turn dataNotLoaded into an error row, not a pass');
console.log('read-failures ok');
