'use strict';
/**
 * tests/paged-reads-web.test.cjs — the web half of the paged-read check (tools/paged-reads-web.cjs): a screen that reads a list route with no limit/page is counted, one that asks a page is not.
 * Run: node tests/paged-reads-web.test.cjs
 * MIN fail-closed: a screen not in the ratchet that reads a list whole FAILS the check; the ratchet cannot be raised.
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scan, countsOf, checkRatchet, pathOf } = require('../tools/paged-reads-web.cjs');

let pass = 0, fail = 0;
const check = (what, fn) => { try { fn(); pass++; console.log('  ok  ' + what); } catch (e) { fail++; console.log('  FAIL ' + what + '\n      ' + e.message); } };

/** a throwaway web root: two screens, one list route that answers every row when nothing is asked, one that bounds it */
function world(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-web-'));
  fs.mkdirSync(path.join(root, 'public', 'app'), { recursive: true });
  fs.mkdirSync(path.join(root, 'e2e', 'fixtures'), { recursive: true });
  fs.writeFileSync(path.join(root, 'e2e', 'fixtures', 'paged-read-routes.json'), JSON.stringify({ routes: [
    { key: 'GET /api/things', path: '/api/things', mode: 'offset', default: 50, max: 200, unasked: 'everything' },
    { key: 'GET /api/small', path: '/api/small', mode: 'offset', default: 20, max: 50, unasked: 'bounded' }
  ] }));
  Object.entries(files).forEach(([name, text]) => fs.writeFileSync(path.join(root, 'public', 'app', name), text));
  return root;
}
const classOf = (found, file) => (found.screens.find((screen) => screen.file === 'public/app/' + file) || {}).class;

check('a registry key asked with no page is a whole-range screen; with page and limit it is not', () => {
  const found = scan(world({
    'a.js': "var EP = { thingsList: { m: 'GET', p: '/api/things' } };\nasync function load() { return api('thingsList'); }",
    'b.js': "var EP = { thingsList: { m: 'GET', p: '/api/things' } };\nasync function load(p) { return api('thingsList', { query: { page: p, limit: 50 } }); }\nfunction more() { return '<button data-cbl-more>'; }"
  }));
  assert.strictEqual(classOf(found, 'a.js'), 'whole range');
  assert.strictEqual(classOf(found, 'b.js'), 'lazy');
});
check('a paged call with no "more" control is first page only; an unasked read of a bounded route is default page only', () => {
  const found = scan(world({
    'c.js': "async function load() { return fetch('/api/things?page=1&limit=50'); }",
    'd.js': "async function load() { return fetch('/api/small'); }"
  }));
  assert.strictEqual(classOf(found, 'c.js'), 'first page only');
  assert.strictEqual(classOf(found, 'd.js'), 'default page only');
});
check('a path in a comment, and a write to the same path, are not calls', () => {
  const found = scan(world({ 'e.js': "// GET /api/things lists everything\n/* fetch('/api/things') */\napi('POST', '/api/things', { body: 1 });" }));
  assert.strictEqual(found.screens.length, 0);
});
check('a path built from parts matches its route; a trailing slash is a parameter', () => {
  assert.strictEqual(pathOf('/api/things/' + '${id}' + '?x=1'), '/api/things/:p');
  assert.strictEqual(pathOf('/api/things/'), '/api/things/:p');
});
check('the ratchet: a screen not in it that reads a list whole fails; nothing fails at the committed count', () => {
  const counts = countsOf(scan());
  assert.deepStrictEqual(checkRatchet(counts), []);
  const worse = Object.assign({}, counts, { whole_range: counts.whole_range + 1, whole_range_files: counts.whole_range_files.concat('public/app/brand-new.js') });
  assert.ok(checkRatchet(worse).length >= 2);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
