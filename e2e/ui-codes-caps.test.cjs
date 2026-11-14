'use strict';
// @type: unit
/**
 * ui-codes-caps.test.cjs - the customer-reached cap files of the standards lane wear ONE identity each (14 Nov, std-caps lane).
 *
 * OWNS      the proof that the two library swaps of the lane stay swaps: the Disputes Try again (cap-dispute.js) and the CRM record Try again
 *           (cap-crm-record.js) are drawn by ui.action('reload') at a mount code, keep their testid / id / data-crm, and no hand-written tag
 *           with the old code is left; and that every data-cbsid code of both files sits INSIDE the tag that carries its control marker.
 * CALLED BY by hand and the QA gate: node e2e/ui-codes-caps.test.cjs   (CAPS_MUTATE=remove or swap must fail it)
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 */
const fs = require('fs'), path = require('path');
const mutate = process.env.CAPS_MUTATE || '';
const read = (f) => {
  let t = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8').split('\r\n').join('\n');
  if (mutate === 'remove') t = t.split("mount: 'TSK006-U01'").join('').split("mount: 'CRM006-U01'").join('');
  if (mutate === 'swap') t = t.split('TSK006-B14').join('SWAPX').split('TSK006-B15').join('TSK006-B14').split('SWAPX').join('TSK006-B15');
  return t;
};
let failures = 0;
const check = (c, m) => { console.log((c ? '  ok ' : '  FAIL ') + m); if (!c) failures++; };
const dispute = read('cap-dispute.js'), record = read('cap-crm-record.js');

check(/ui\.action\('reload', \{ mount: 'TSK006-U01', surface: 'page', tone: 'primary', id: 'dp_retry', testid: 'dp-retry' \}\)/.test(dispute), 'disputes Try again: ui.action reload at TSK006-U01, id and testid kept');
check(dispute.indexOf('data-cbsid="TSK006-B13"') < 0, 'disputes: the hand-written B13 tag is gone');
check(/ui\.action\('reload', \{ mount: 'CRM006-U01', surface: 'page', testid: 'crm-rec-retry', data: \{ crm: 'recretry' \} \}\)/.test(record), 'CRM record Try again: ui.action reload at CRM006-U01, testid and data-crm kept');
check(record.indexOf('data-cbsid="CMP009" type="button" class="act ghost" data-crm="recretry"') < 0, 'CRM record: the hand-written CMP009 tag is gone');

/** a control marker must sit in the SAME tag as its code (from the tag's '<' to the marker, no '<' or '>' between) */
const WANT = [
  [dispute, 'dp-prev', 'TSK006-B14'], [dispute, 'dp-next', 'TSK006-B15'], [dispute, 'dp-raise-go', 'TSK006-B18'], [dispute, 'dp-rgo', 'TSK006-B21'],
  [record, 'crm-act-log"', 'CRM006-B16'], [record, 'crm-act-walkin', 'CRM006-B05'], [record, 'crm-ledger-on', 'CRM006-B18']
];
for (const [text, marker, code] of WANT) {
  const at = text.indexOf('data-cbsid="' + code + '"');
  const from = at < 0 ? -1 : text.lastIndexOf('<', at);
  const hit = at < 0 ? -1 : text.indexOf(marker, at);
  const between = hit < 0 ? '<' : text.slice(from + 1, hit);
  check(hit >= 0 && between.indexOf('<') < 0 && between.indexOf('>') < 0, marker.replace(/"/g, '') + ' sits inside the tag of ' + code);
}
if (failures) { console.log(failures + ' failed'); process.exit(1); }
console.log('all ok');
