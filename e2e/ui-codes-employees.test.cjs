'use strict';
// @type: unit
/**
 * ui-codes-employees.test.cjs - the Employees page wears ITS identity codes (UX-137, web-done "tagged" pass, screen OWN004).
 *
 * OWNS      the proof that cap-employees.js (the script only employees.html loads) tags every control with a data-cbsid code of screen OWN004,
 *           that each testid / id wears ITS code (a swap of two codes fails), that a code is never used by two element definitions, and that
 *           actRow (the one builder of the greyed-when-refused action) writes the code its caller passes and nothing else about the button changed.
 * CALLED BY by hand and the QA gate: node e2e/ui-codes-employees.test.cjs   (EMP_ID_MUTATE=swap or remove must fail it)
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 * Register  codes are looked up in UIID_REG, else ../chitbridge-docs/SCREENS.json, else C:/dev/SCREENS.json: a code not there yet is printed
 *           as pending (the docs PR lands the rows), a code the register calls retired fails.
 */
const fs = require('fs'), path = require('path');
const mutate = process.env.EMP_ID_MUTATE || '';
let src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-employees.js'), 'utf8').split('\r\n').join('\n');
if (mutate === 'remove') src = src.split('data-cbsid="OWN004-B01"').join('');
if (mutate === 'swap') src = src.split('OWN004-B01').join('SWAPX').split('OWN004-B03').join('OWN004-B01').split('SWAPX').join('OWN004-B03');
let failures = 0;
const check = (c, m) => { console.log((c ? '  ok ' : '  FAIL ') + m); if (!c) failures++; };

/** marker (testid or id) -> the code the tag that carries it must wear */
const WANT = { 'emp-retry': 'OWN004-B01', 'id="emp_x"': 'OWN004-B03', 'name="emp_lvl"': 'OWN004-I01', 'emp-access-go': 'OWN004-B09', 'emp-email-in': 'OWN004-I02',
  'emp-email-go': 'OWN004-B10', 'emp-cover-sel': 'OWN004-S01', 'emp-cover-go': 'OWN004-B11', 'emp-add-name': 'OWN004-I03', 'emp-add-key"': 'OWN004-I04',
  'emp-add-level': 'OWN004-S02', 'emp-add-role': 'OWN004-I05', 'emp-add-phone': 'OWN004-I06', 'emp-add-email': 'OWN004-I07', 'emp-add-go': 'OWN004-B12', 'emp-done': 'OWN004-B13' };
/** the actRow call sites pass their code as the last argument */
const CALLS = ['OWN004-B02', 'OWN004-B04', 'OWN004-B05', 'OWN004-B06', 'OWN004-B07', 'OWN004-B08'];

for (const [marker, code] of Object.entries(WANT)) {
  const tag = src.split('\n').filter((l) => l.indexOf(marker) >= 0 && l.indexOf('<') >= 0)[0] || '';
  check(tag.indexOf('data-cbsid="' + code + '"') >= 0, marker.replace(/"/g, '') + ' wears ' + code);
}
for (const code of CALLS) check(src.indexOf("'" + code + "'") >= 0, 'an actRow call passes ' + code);

const all = {};
for (const m of src.matchAll(/data-cbsid="(OWN004-[A-Z][0-9]{2})"/g)) all[m[1]] = (all[m[1]] || 0) + 1;
for (const c of CALLS) all[c] = (all[c] || 0) + 1;
const dup = Object.keys(all).filter((c) => all[c] > 1);
check(dup.length === 0, 'no code is used by two element definitions' + (dup.length ? ' (' + dup.join(',') + ')' : ''));
check(Object.keys(all).length === 22, 'the page has 22 tagged elements, counted by code: ' + Object.keys(all).length);
check(src.indexOf('function actRow(id, icon, label, may, extra, stampCode)') >= 0, 'actRow takes the stamp code as its 6th parameter');

/** actRow itself: drawn with stubs, the code is on the button and the rest of the button is what it was */
const body = src.slice(src.indexOf('function actRow('), src.indexOf('/* ── the list ── */'));
const actRow = new Function('esc', body + '; return actRow;')((s) => String(s));
const okRow = actRow('emp_add', '+', 'Add a person', { ok: true }, '', 'OWN004-B02');
check(okRow.indexOf('<button data-cbsid="OWN004-B02" type="button" class="act quiet" id="emp_add" data-testid="emp_add"') > 0, 'an allowed action: code, class, id and testid as drawn before');
const noRow = actRow('emp_add', '+', 'Add a person', { ok: false, why: 'Owner only' }, '', 'OWN004-B02');
check(/aria-disabled="true" disabled title="Owner only"/.test(noRow) && noRow.indexOf('data-testid="emp_add-why"') > 0, 'a refused action: still greyed, the why still shown');

let reg = null;
for (const p of [process.env.UIID_REG, path.join(__dirname, '..', '..', 'chitbridge-docs', 'SCREENS.json'), 'C:/dev/SCREENS.json']) {
  if (p && fs.existsSync(p)) { try { reg = JSON.parse(fs.readFileSync(p, 'utf8')); break; } catch (e) { /* next */ } }
}
if (reg) {
  const rows = {}; Object.values(reg.screens || {}).forEach((r) => { if (r.code) rows[r.code] = r; });
  const missing = Object.keys(all).filter((c) => !rows[c]), retired = Object.keys(all).filter((c) => rows[c] && rows[c].retired);
  console.log('  register: ' + (Object.keys(all).length - missing.length) + ' of ' + Object.keys(all).length + ' codes found' + (missing.length ? ' (pending until the docs PR lands: ' + missing.length + ')' : ''));
  check(retired.length === 0, 'no code is retired in the register');
}
console.log(failures ? failures + ' FAILED' : 'ALL PASS');
process.exit(failures ? 1 : 0);
