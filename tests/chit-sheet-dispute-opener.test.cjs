/**
 * tests/chit-sheet-dispute-opener.test.cjs — RAIL-next: every page that mounts the chit sheet resolves a dispute opener (never a dead button).
 * accounts · finance · crm load accounts-shell.js (disputePageHref); app.html has ensureCap + quickDispute; tasks.html loads cap-dispute.js (CBDispute.sheet).
 * Run: node tests/chit-sheet-dispute-opener.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const pub = path.join(__dirname, '..', 'public');
const pages = fs.readdirSync(pub).filter((f) => f.endsWith('.html') && /src="\/app\/chit-sheet\.js"/.test(fs.readFileSync(path.join(pub, f), 'utf8')));
assert.deepStrictEqual(pages.sort(), ['accounts.html', 'app.html', 'crm.html', 'finance.html', 'tasks.html'], 'the pages that mount the chit sheet (update this test when one is added)');
const shell = fs.readFileSync(path.join(pub, 'app', 'accounts-shell.js'), 'utf8');
assert(/function disputePageHref\(/.test(shell), 'accounts-shell defines disputePageHref');
for (const f of pages) {
  const h = fs.readFileSync(path.join(pub, f), 'utf8');
  const ok = /src="\/app\/cap-dispute\.js"/.test(h) || /src="\/app\/accounts-shell\.js"/.test(h);
  assert(ok, f + ': no dispute opener (neither cap-dispute.js nor accounts-shell.js disputePageHref)');
}
assert(/function ensureCap\(/.test(fs.readFileSync(path.join(pub, 'app.html'), 'utf8')), 'app.html lazy loader exists');
const cs = fs.readFileSync(path.join(pub, 'app', 'chit-sheet.js'), 'utf8');
assert(/ensureCap\('dispute'\)/.test(cs), 'chit-sheet loads the dispute capability on demand');
assert(/disputePageHref\(id\)/.test(cs), 'chit-sheet falls back to Tasks > Disputes');
console.log('chit-sheet-dispute-opener: all ok');
