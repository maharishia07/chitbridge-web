'use strict';
// @type: unit
/**
 * ui-codes-tasks.test.cjs - the Tasks & Orders page wears ITS identity codes (UX-137, web-done "tagged" pass, screen OWN003).
 *
 * OWNS      the proof that cap-tasks.js, cap-dispute.js and cap-assist.js (scripts only tasks.html loads) tag every control with a data-cbsid
 *           code of screen OWN003, that each testid / id wears ITS code (a swap of two codes fails), that a code is never used by two
 *           element definitions, and that CBTasks.actRow (the one builder of the greyed-when-refused action) writes the code its caller passes
 *           and nothing else about the button changed (id, testid, title, disabled stay as before).
 * CALLED BY by hand and the QA gate: node e2e/ui-codes-tasks.test.cjs   (TASKS_ID_MUTATE=swap or remove must fail it)
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 * Register  codes are looked up in UIID_REG, else ../chitbridge-docs/SCREENS.json, else C:/dev/SCREENS.json: a code not there yet is printed
 *           as pending (the docs PR lands the rows), a code the register calls retired fails.
 */
const fs = require('fs'), path = require('path');
const mutate = process.env.TASKS_ID_MUTATE || '';
const FILES = ['cap-tasks.js', 'cap-dispute.js', 'cap-assist.js'];
const read = (f) => {
  let t = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8').split('\r\n').join('\n');
  if (mutate === 'remove') t = t.split('data-cbsid="OWN003-B36"').join('');
  if (mutate === 'swap') t = t.split('OWN003-B36').join('SWAPX').split('OWN003-B37').join('OWN003-B36').split('SWAPX').join('OWN003-B37');
  return t;
};
let failures = 0;
const check = (c, m) => { console.log((c ? '  ok ' : '  FAIL ') + m); if (!c) failures++; };
const src = {}; FILES.forEach((f) => (src[f] = read(f)));

/** marker (testid or id) -> the code the tag that carries it must wear */
const WANT = {
  'cap-tasks.js': { 'tk-retry': 'OWN003-B01', 'tk-view': 'OWN003-S01', 'tk-new"': 'OWN003-B02', 'id="tk_x"': 'OWN003-B03', 'id="tk_sheet_retry"': 'OWN003-B04',
    'tk-reason"': 'OWN003-I01', 'tk-reason-go': 'OWN003-B11', 'id="tk_who_sel"': 'OWN003-S02', 'id="tk_who_go"': 'OWN003-B12', 'tk-deliver-qty': 'OWN003-I02',
    'tk-deliver-go': 'OWN003-B13', 'tk-new-what': 'OWN003-I03', 'tk-new-go': 'OWN003-B14' },
  'cap-dispute.js': { 'id="adv_disp"': 'OWN003-I04', 'dispute-category': 'OWN003-S05', 'dispute-reason"': 'OWN003-T01', 'dispute-raise': 'OWN003-B24',
    'dispute-resolve-note': 'OWN003-T02', 'dispute-resolve-submit': 'OWN003-B26', 'dp-retry': 'OWN003-B27', 'dp-prev': 'OWN003-B28', 'dp-next': 'OWN003-B29',
    'id="dp_cat"': 'OWN003-S06', 'id="dp_reason"': 'OWN003-T03', 'dp-raise-go': 'OWN003-B32', 'id="dp_sheet_retry"': 'OWN003-B33', 'dp-rwho': 'OWN003-S07',
    'dp-rnote': 'OWN003-T04', 'dp-rgo': 'OWN003-B35' },
  'cap-assist.js': { 'ca-retry': 'OWN003-B36', 'id="ca_q"': 'OWN003-I07', 'ca-draft': 'OWN003-B37', 'id="ca_a"': 'OWN003-T05', 'id="ca_c"': 'OWN003-I08', 'ca-reject': 'OWN003-B39' }
};
/** the helper call sites pass their code as the last argument of actRow */
const CALLS = { 'cap-tasks.js': ['OWN003-B05', 'OWN003-B06', 'OWN003-B07', 'OWN003-B08', 'OWN003-B09', 'OWN003-B10'], 'cap-dispute.js': ['OWN003-B30', 'OWN003-B34'], 'cap-assist.js': ['OWN003-B38'] };

for (const f of FILES) {
  for (const [marker, code] of Object.entries(WANT[f])) {
    const tag = src[f].split('\n').filter((l) => l.indexOf(marker) >= 0 && l.indexOf('<') >= 0)[0] || '';
    check(tag.indexOf('data-cbsid="' + code + '"') >= 0, f + ' ' + marker.replace(/"/g, '') + ' wears ' + code);
  }
  for (const code of CALLS[f]) check(src[f].indexOf("'" + code + "'") >= 0, f + ' passes ' + code + ' to actRow');
}

/** every literal code of the three files is of screen OWN003, written once per element definition */
const all = {};
for (const f of FILES) {
  for (const m of src[f].matchAll(/data-cbsid="(OWN003-[A-Z][0-9]{2})"/g)) (all[m[1]] = all[m[1]] || []).push(f);
  for (const c of CALLS[f]) (all[c] = all[c] || []).push(f);
}
const dup = Object.keys(all).filter((c) => all[c].length > 1);
check(dup.length === 0, 'no code is used by two element definitions' + (dup.length ? ' (' + dup.join(',') + ')' : ''));
check(Object.keys(all).length === 60, 'the page has 60 tagged elements, counted by code: ' + Object.keys(all).length);
check(src['cap-tasks.js'].indexOf('function actRow(id, label, verdict, extra, className, stampCode)') >= 0, 'actRow takes the stamp code as its 6th parameter');
check(src['cap-dispute.js'].indexOf('root.CBTasks.actRow(id, label, verdict, extra, className, stampCode)') >= 0, 'the dispute wrapper hands the code on');

/** actRow itself: drawn with stubs, the code is on the button and the rest of the button is what it was */
const body = src['cap-tasks.js'].slice(src['cap-tasks.js'].indexOf('function actRow('), src['cap-tasks.js'].indexOf('/* ── the list (O2C step 3'));
const actRow = new Function('esc', 'sayOf', body + '; return actRow;')((s) => String(s), (v) => (v && v.say) || '');
const okRow = actRow('tk_x1', 'Assign', { ok: true }, '', '', 'OWN003-B06');
check(okRow.indexOf('<button data-cbsid="OWN003-B06" type="button" class="act quiet" id="tk_x1" data-testid="tk_x1"') > 0, 'an allowed action: code, class, id and testid as drawn before');
const noRow = actRow('tk_x2', 'Assign', { ok: false, say: 'Not yours' }, '', '', 'OWN003-B06');
check(/aria-disabled="true" disabled title="Not yours"/.test(noRow) && noRow.indexOf('data-testid="tk_x2-why"') > 0, 'a refused action: still greyed, the why still shown');

/** the register */
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
