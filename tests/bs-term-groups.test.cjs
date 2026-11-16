/**
 * bs-term-groups.test.cjs — l16-country: the Balance sheet groups Current / Non-current with the SERVER's sub-totals, and leaves a ledger the pack gave no term under "Not classified".
 * OWNS      the proof on bkBsSide / bkBsFoot (cap-books.js), run in a vm with the page's few helpers stubbed; hand figures in cents.
 * CALLED BY node tests/bs-term-groups.test.cjs (pure node, no browser)
 * Hand figures: assets cash 30000 (current) + plant 100000 (non-current); liabilities overdraft 20000 (current) + loan 50000 (no term).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-books.js'), 'utf8');
const a = src.indexOf('var BK_TERM_WORDS'), b = src.indexOf('/* the Balance sheet tab:');
const c = src.indexOf('function bkBsFoot'), d = src.indexOf('/**\n * ⭐ ONE AGEING');
let bad = 0;
const ok = (cond, m) => { console.log((cond ? '  ok   ' : '  FAIL ') + m); if (!cond) bad++; };
if (a < 0 || b < 0 || c < 0 || d < 0) { console.log('  FAIL cannot find the functions'); process.exit(1); }
const ctx = {
  esc: (x) => String(x), tx: (x) => x, bkFig: (m) => (m == null ? '—' : String(m)),
  bkStRow: (cls, label, cells) => '[' + cls + '|' + label + '|' + cells.map((x) => x.v).join(',') + ']',
  bkDrillLink: (code, name) => name
};
vm.createContext(ctx);
vm.runInContext(src.slice(a, b) + '\n' + src.slice(c, d), ctx);
const money = (m) => String(m);
ctx.bkMoney = money;
const items = [
  { code: '1400', name: 'Cash', amount_minor: 30000, term: 'current' },
  { code: '1010', name: 'Plant', amount_minor: 100000, term: 'non_current' }
];
const termsA = [{ term: 'current', amount_minor: 30000, prior_month_minor: null, prior_year_minor: null }, { term: 'non_current', amount_minor: 100000, prior_month_minor: null, prior_year_minor: null }];
const html = ctx.bkBsSide('Assets', items, [], 'AUD', 130000, null, 'bs-total-assets', '2026-07-05', '2026-07-01', termsA, 'assets');
ok(html.indexOf('Current assets') > 0 && html.indexOf('Non-current assets') > html.indexOf('Current assets'), 'Current assets, then Non-current assets');
ok(/bk-sub\|Total Current assets\|30000/.test(html), 'the Current sub-total is the server\'s 30000');
ok(/bk-sub\|Total Non-current assets\|100000/.test(html), 'the Non-current sub-total is the server\'s 100000');
ok(html.indexOf('Cash') < html.indexOf('Plant'), 'cash sits under current, plant under non-current');
const liab = ctx.bkBsSide('Liabilities', [{ code: '2020', name: 'Overdraft', amount_minor: 20000, term: 'current' }, { code: '2000', name: 'Loan', amount_minor: 50000, term: null }], [], 'AUD', 70000, null, 'bs-total-liabilities', '2026-07-05', '2026-07-01', [{ term: 'current', amount_minor: 20000 }, { term: 'unclassified', amount_minor: 50000 }], 'liabilities');
ok(/Current liabilities/.test(liab) && /Not classified/.test(liab) && liab.indexOf('Loan') > liab.indexOf('Not classified'), 'a ledger with no term is under "Not classified", never guessed');
const plain = ctx.bkBsSide('Assets', [{ code: '1400', name: 'Cash', amount_minor: 30000, group: { code: 'g1' } }], [{ code: 'g1', name: 'Current Assets', amount_minor: 30000 }], 'AUD', 30000, null, 't', '2026-07-05', '2026-07-01', [{ term: 'unclassified', amount_minor: 30000 }], 'assets');
ok(/Current Assets/.test(plain) && !/Not classified/.test(plain), 'a pack with no term at all keeps its own chart heads (no "Not classified" noise)');
const foot = ctx.bkBsFoot({ term_cite: 'AASB 101 paras 60, 66 and 69', term_groups: { assets: termsA }, ageing_note: null }, 'AUD');
ok(/bs-term-cite/.test(foot) && /AASB 101/.test(foot) && !/bs-ageing/.test(foot), 'the standard is cited once; no ageing schedule without the pack\'s note');
const note = { cite: 'Schedule III', receivable: { title: 'Trade receivables ageing', rows: [{ label: 'Not due', undisputed_minor: 1000, disputed_minor: 200, total_minor: 1200 }], total_minor: 1200 }, payable: { title: 'Trade payables ageing', rows: [], total_minor: 0 } };
const foot2 = ctx.bkBsFoot({ term_groups: {}, ageing_note: note }, 'INR');
ok(/bs-ageing-receivable/.test(foot2) && /Not due\|1000,200,1200/.test(foot2) && /bs-ageing-payable/.test(foot2), 'India: the receivables and payables ageing tables, undisputed · disputed · total');
process.exitCode = bad ? 1 : 0;
