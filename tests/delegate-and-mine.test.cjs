/* tests/delegate-and-mine.test.cjs — UNIT 17-people-employees-hr-and-payroll/pin-otp-first-sign-in
 * Delegate work (cap-employees-give.js) paints the picker over the People panel and books-practice-mine.js names the held clients. Pure: a fake window, no browser. */
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
