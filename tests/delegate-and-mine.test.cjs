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
// 2. the picker (ACC-383): people, the firms that hold a books grant, and the empty state with "Add a person"
const GIVE_SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-employees-give.js'), 'utf8').replace(/\}\)\(typeof window[^\n]*$/, '})(window);');
const mountGive = (people, o, may) => {
  const els = {}, host = { innerHTML: '' };
  const node = (id) => els[id] || (els[id] = { textContent: '', innerHTML: '' });
  const added = [];
  const E = { people, may };
  const win = { esc, tx: (s) => s, shopDay: (v) => 'day ' + v, document: { getElementById: node },
    CBBooksGrantMember: { roleWords: (p) => (p === 'adviser' ? 'Accountant: acts for you' : 'Auditor: reads only') },
    CBEmployees: { inPlace: { E, load: () => Promise.resolve(), byId: (id) => people.filter((p) => p.id === id)[0] || null, accessPanel: () => {}, openAdd: () => added.push('add') } } };
  new Function('window', GIVE_SRC)(win);
  return win.CBEmployees.mountAccess(host, o).then(() => ({ body: node('emp_give_body').innerHTML, node, added, E }));
};
{
  const person = { id: 'p1', name: 'Priya', state: 'on', access: { label: 'Can view' } };
  const off = { id: 'p2', name: 'Off', state: 'off', access: { label: 'x' } };
  const given = { given: [
    { state: 'live', grantee_entity: 'f1', grantee_name: 'Bayside', preset: 'adviser', expires_at: '2027-01-01' },
    { state: 'live', grantee_entity: 'f1', grantee_name: 'Bayside', preset: 'adviser', expires_at: '2027-01-01' },
    { state: 'live', grantee_entity: 'f2', grantee_name: 'Coastal', preset: 'auditor' },
    { state: 'revoked', grantee_entity: 'f3', grantee_name: 'Gone', preset: 'auditor' }] };
  Promise.all([
    mountGive([person, off], { token: 't', grants: () => Promise.resolve(given), openAccess: () => {} }, { add: { ok: true } }),
    mountGive([], { token: 't', grants: () => Promise.resolve(given) }, { add: { ok: true } }),
    mountGive([], { token: 't', grants: () => Promise.reject(new Error('x')) }, { add: { ok: false, why: 'Only the owner adds people.' } }),
    mountGive([person], { token: 't' }, { add: { ok: true } })
  ]).then(([withBoth, noStaff, failed, noGrants]) => {
    assert(/Who gets the work\?/.test(withBoth.body) && /Priya/.test(withBoth.body) && !/>Off ·/.test(withBoth.body), withBoth.body);
    assert(/data-cbsid="BKS027-S01"/.test(withBoth.body));
    pass('the picker lists the people who are on, with their register code');
    assert((withBoth.body.match(/value="firm:/g) || []).length === 2 && /Bayside · Accountant: acts for you/.test(withBoth.body) && /Coastal · Auditor: reads only/.test(withBoth.body) && !/Gone/.test(withBoth.body), withBoth.body);
    pass('the firms with a LIVE books grant are choices, once each, ended ones are not');
    assert(/emp-give-none/.test(noStaff.body) && /No one is on your team yet\./.test(noStaff.body) && /data-testid="emp-give-add"/.test(noStaff.body) && /data-cbsid="EMP001-B02"/.test(noStaff.body), noStaff.body);
    noStaff.node('emp_give_add').onclick();
    assert.deepStrictEqual(noStaff.added, ['add']);
    assert(/value="firm:f1"/.test(noStaff.body), 'a shop with no staff still offers its firms');
    pass('no staff: the empty state says so, "Add a person" opens the one Add form, the firms stay choices');
    assert(/emp-give-firms-failed/.test(failed.body) && !/value="firm:/.test(failed.body) && /Only the owner adds people\./.test(failed.body) && !/emp-give-add"/.test(failed.body), failed.body);
    pass('a grants list that cannot be read is said, and a seat that may not add is told why');
    assert(!/emp-give-firms-failed|optgroup label="Firms/.test(noGrants.body));
    pass('a page with no grants list asks for none');
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
