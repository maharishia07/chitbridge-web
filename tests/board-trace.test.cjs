'use strict';
/* K-BOARD / QUAL-1: the traceability line (QA-24, CAT-50), the not-evidence mark (QA-72) and the kept verdict (ACC-97).
 * Run: node tests/board-trace.test.cjs */
const assert = require('assert'), fs = require('fs'), path = require('path');
const { testIsEvidence, testCiteLine } = require('../public/app/test-verdict.js');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };

ok(testCiteLine({ cites: { standard: 'ASVS', clause: '8.2.2', level: 1 } }).text === 'ASVS · §8.2.2 · level 1', 'a cited clause prints standard, clause, level');
ok(testCiteLine({ covers: 'FR-12' }).source === 'covers', 'a case with no clause but a @covers prints the covers');
const none = testCiteLine({ case_key: 'chitbridge-web/e2e/tests/price.spec.js', note: 'price' });
ok(none.cited === false && none.text === 'Not cited', 'no cite and no covers prints "Not cited"');
ok(testCiteLine({ case_key: 'price-requirement.spec.js' }).cited === false, 'a requirement is never inferred from a file name');
ok(!testIsEvidence('chitbridge-web/e2e/fixtures/walkthrough.js') && !testIsEvidence('x/engine-manifest.js'), 'walkthrough.js and engine-manifest.js are not evidence');
ok(!testIsEvidence('api/scripts/seed-demo-shop.cjs') && !testIsEvidence('web\\e2e\\narrated-proof.cjs'), 'seeds, demos and narrated proofs (either slash) are not evidence');
ok(testIsEvidence('chitbridge-web/e2e/tests/one-board.spec.js') && testIsEvidence(''), 'a real spec stays evidence');

/* ACC-97: the failure branch of testMark keeps the verdict in the notice; the toast alone is the old fault */
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-testing.js'), 'utf8');
const mark = src.slice(src.indexOf('async function testMark('), src.indexOf('async function testRetryUnsent'));
const lost = src.slice(src.indexOf('function testMarkLost('), src.indexOf('async function testMark('));
ok(/testMarkLost\(key, status, e\)/.test(mark) && /CBTEST\.unsent\[key\]/.test(lost) && /CBTEST\.notice = \{ tone: 'bad'/.test(lost), 'a failed testMark keeps the verdict and raises a sticky notice');
ok(/async function testRetryUnsent/.test(src) && /testRetryUnsent\(\)/.test(lost), 'the notice has a Send again that calls testRetryUnsent');
console.log(n + ' passed');
