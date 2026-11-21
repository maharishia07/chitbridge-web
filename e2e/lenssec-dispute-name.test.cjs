/**
 * lenssec-dispute-name.test.cjs — lens-sec 1129 (L-sec-web-screens-09 F1): the party name in the Resolve button of a dispute.
 * OWNS      the proof that a counterparty's display name  x'-alert(1)-'  cannot leave the JS string of the inline onclick: encodeURIComponent keeps ' ( ) -,
 *           so the name is also stripped of ' (%27, which decodeURIComponent reads back). Runs the real disputeResolveBtns from cap-dispute.js.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 *   node e2e/lenssec-dispute-name.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' — ' + why)); if (!ok) fail++; };
const cx = vm.createContext({ nm: (s, d) => String(s || d).replace(/[<>&"']/g, ''), tx: (s) => s });
vm.runInContext(liftFns('public/app/cap-dispute.js', ['disputeResolveBtns']) + '\nthis.f = disputeResolveBtns;', cx);
const evil = "x'-alert(1)-'";
const html = cx.f([{ entity_id: 'E1', display_name: evil, dispute_status: 'open' }], 'c1', 'd1', true, '');
const m = /onclick="resolveDispute\(([^"]*)\)"/.exec(html);
t('the button renders an onclick', !!m, html);
if (m) {
  const args = m[1];
  // exactly four quoted args: no quote of the name may close its string early
  t('the onclick holds exactly 4 string arguments (8 quotes)', (args.match(/'/g) || []).length === 8, args);
  const parts = args.split("','").map((p) => p.replace(/^'|'$/g, ''));
  t('the name decodes back to what was typed', decodeURIComponent(parts[3]) === evil, parts[3]);
}
process.exit(fail ? 1 : 0);
