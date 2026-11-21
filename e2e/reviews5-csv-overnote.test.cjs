/**
 * reviews5-csv-overnote.test.cjs — reviews5 (21 Nov 2026) GF-05 M1 / EL-05 M1 and GF-05 M12 / M15, on the real cap-books.js functions (vm sandbox).
 * OWNS      the proof that (1) the Day book CSV never strips a leading '#' off a free-text cell (the old in-band money marker): a party "#1 Traders, Pune"
 *           stays ONE quoted cell and a "#=HYPERLINK(...)" narration is still quoted as text; (2) a leading TAB or CR is guarded like = + - @; (3) the
 *           ledger CSV uses the same one cell writer; (4) the highlight note keeps ¥1,000 as ¥1,000 (no regex over thousands separators).
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 *   node e2e/reviews5-csv-overnote.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' — ' + why)); if (!ok) fail++; };

const cx = vm.createContext({
  bkDec: (c) => (c === 'jpy' ? 0 : 2),
  bkMoney: (minor, c) => (c === 'jpy' ? '¥' + Number(minor).toLocaleString('en-US') : '$' + (Number(minor) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })),
  esc: (s) => String(s), tx: (s) => s,
  dayBookKind: () => 'Sale', bkDvTenders: () => ['Cash'], bkDvTotal: () => 123456, bkDvGist: () => [],
  bkDvParty: (e) => e.party
});
vm.runInContext(liftFns('public/app/cap-books.js', ['bkCsvCell', 'bkDvCsv', 'bkLgCsv', 'bkOverNote']) + '\nthis.f = { bkCsvCell, bkDvCsv, bkLgCsv, bkOverNote };', cx);
const f = cx.f;
const entry = (party, ref) => ({ posting_date: '2026-11-20', entry_no: 7, party, source: { ref }, lines: [{ cr_minor: 123456 }], made_by: 'x' });

const csv = f.bkDvCsv([entry('#1 Traders, Pune', '#=HYPERLINK("http://x","pay")')], 'aud');
const row = csv.split('\r\n')[1];
t('a party "#1 Traders, Pune" stays one quoted cell', row.includes('"#1 Traders, Pune"'), row);
t('a "#=HYPERLINK" ref is quoted as text, not unmasked into a formula', !/,=HYPERLINK/.test(row) && /'#=HYPERLINK|"#=HYPERLINK/.test(row), row);
t('the money cells are plain numbers', /,1234\.56,1234\.56,/.test(row), row);
const cols = (line) => { let n = 1, q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) n++; } return n; };
t('the row has as many columns as the header (nothing shifted)', cols(row) === cols(csv.split('\r\n')[0]), cols(row) + ' vs ' + cols(csv.split('\r\n')[0]));
t('a leading TAB is guarded', f.bkCsvCell('\t=1+1').startsWith("'"), f.bkCsvCell('\t=1+1'));
t('a leading CR is guarded', f.bkCsvCell('\r=1').startsWith('"\''), JSON.stringify(f.bkCsvCell('\r=1')));
t('a negative number stays a number', f.bkCsvCell('-12.50') === '-12.50');
const lg = f.bkLgCsv([{ date: '2026-11-20', narration: '=cmd|x', party_name: 'A, B', entry_no: 1, dr_minor: 100, running_minor: 100 }], 'aud').split('\r\n')[1];
t('the ledger CSV quotes a formula and a comma (one writer)', lg.includes("'=cmd|x") && lg.includes('"A, B"'), lg);
const note = f.bkOverNote({ pct_bp: 2000, min_minor: 1000 }, 'jpy');
t('a zero-decimal threshold keeps its thousands (¥1,000, not ¥1)', note.includes('¥1,000') && !/¥1 /.test(note), note);
t('a two-decimal threshold still drops the trailing zeros', f.bkOverNote({ pct_bp: 2000, min_minor: 100000 }, 'aud').includes('$1,000 '), f.bkOverNote({ pct_bp: 2000, min_minor: 100000 }, 'aud'));
process.exit(fail ? 1 : 0);
