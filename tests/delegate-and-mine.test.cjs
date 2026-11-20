/* tests/delegate-and-mine.test.cjs — UNIT 17-people-employees-hr-and-payroll/pin-otp-first-sign-in
 * Delegate work (cap-employees-give.js) paints the picker over the People panel and books-practice-mine.js names the held clients. Pure: a fake window, no browser.
 * MIN walk (section 1 drives mineLine on a fake window: held clients named, none held = nothing; the browser walk is e2e/walk-assign-bulk.cjs)
 * MIN cream-and-dark-1366-390 (section 4: the line states no colour of its own and no fixed width, so both themes and both widths follow the page)
 * MIN aa-contrast (section 4: no colour typed in the line, so contrast is the page's token pair)
 * MIN could-not-read-words (section 4: the line has no catch that could swallow a failure; with no data it says nothing rather than a wrong thing)
 * MIN string-layer (section 4: its words go through tx) */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8');
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
let ok = 0;
const pass = (what) => { ok++; console.log('  ok  ' + what); };

// 1. the mine line
{
  const win = { esc, tx: (s) => s, CBPracticeKit: { practiceState: { data: { clients: [
    { name: 'Moonee Cafe', country: 'AU', holders: [{ actor_id: 'a1' }] },
    { name: 'Other Shop', country: 'AU', holders: [{ actor_id: 'a2' }] }] } } }, CBAssign: { meId: () => 'a1', heldFilter: (rows) => ({ match: (r) => (r.holders || []).some((h) => h.actor_id === rows[0].holders[0].actor_id && h.actor_id === 'a1') }) } };
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'books-practice-mine.js'), 'utf8').replace(/\}\)\(typeof window[^\n]*$/, '})(window);'))(win);
  const line = win.CBPracticeKit.mineLine();
  assert(/Your books today/.test(line) && /Moonee Cafe · AU/.test(line) && !/Other Shop/.test(line), line);
  pass('the line names the held client and its country, and not the others');
  win.CBAssign.meId = () => '';
  assert.strictEqual(win.CBPracticeKit.mineLine(), '');
  pass('a seat that does not know who it is gets no line');
}
// 2. the picker
{
  const person = { id: 'p1', name: 'Priya', state: 'on', access: { label: 'Can view' } };
  const host = { innerHTML: '' }, els = {};
  const win = { esc, tx: (s) => s, document: { getElementById: (id) => els[id] || (els[id] = { textContent: '' }) }, CBEmployees: { inPlace: { E: { people: [person, { id: 'p2', name: 'Off', state: 'off', access: { label: 'x' } }] }, load: () => Promise.resolve(), byId: (id) => (id === 'p1' ? person : null), accessPanel: () => {} } } };
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-employees-give.js'), 'utf8').replace(/\}\)\(typeof window[^\n]*$/, '})(window);'))(win);
  win.CBEmployees.mountAccess(host, { token: 't' }).then(() => {
    assert(/Who gets the work\?/.test(host.innerHTML) && /Priya/.test(host.innerHTML) && !/>Off ·/.test(host.innerHTML), host.innerHTML);
    assert(/data-cbsid="BKS027-S01"/.test(host.innerHTML));
    pass('the picker lists the people who are on, with their register code');
    console.log(ok + ' passed');
  }).catch((e) => { console.error('FAIL ' + e.message); process.exit(1); });
}

// 4. the §7 source walk of books-practice-mine.js: tokens only, no fixed width, no swallowed failure, words through tx
{
  const code = read('books-practice-mine.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(code), 'no colour typed in the line (both themes and AA contrast are the page tokens)');
  assert.ok(!/(?:^|[^-\w])(?:width|min-width)\s*:\s*\d{3,}px/.test(code), 'no fixed width (1366 and 390 wide both fit)');
  assert.ok(!/catch\s*\(/.test(code), 'no catch: nothing is swallowed');
  assert.ok(/words\('Your books today'\)/.test(code) && /root\.tx/.test(code), 'its words go through tx');
  pass('books-practice-mine.js: tokens only, no fixed width, no swallowed failure, words through tx');
}
