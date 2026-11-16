/**
 * stmts-pl-bs.test.cjs — W15-92 / W15-93: the P&L reads by the pack's report lines with Total income, Total expenses and Profit; the Balance sheet has Total liabilities, Total equity
 * and Total liabilities and equity; every figure is the SERVER's carried one, and the "✓ balances" chip compares the two carried totals.
 * OWNS      the proof on the real cap-books.js bkStmtRow / bkStmtTotal / bkStmtGroups / bkSideHTML / bkPL / bkBS (lifted into a vm sandbox) with the shape the api answers (docs/contracts/web-api.json).
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network, no sibling repo.
 *   node e2e/stmts-pl-bs.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');

let reply = null;
const cx = vm.createContext({
  tx: (s) => s,
  esc: (s) => String(s),
  bkMoney: (n) => 'M' + n,
  bkLedgerLink: (code, name) => '<a>' + name + '</a>',
  bkTable: (head, rows, foot) => '<table>' + rows + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table>',
  bkRange: () => ({}),
  bkRangeHTML: () => '',
  bkErr: (e) => 'ERR ' + e,
  bkToday: () => '2026-11-16',
  bkMountAttribute: () => '',
  document: { getElementById: () => null },
  api: async () => reply
});
vm.runInContext(liftFns('public/app/cap-books.js', ['bkStmtRow', 'bkStmtTotal', 'bkStmtGroups', 'bkSideHTML', 'bkPL', 'bkBS']) +
  '\nthis.bkPL=bkPL;this.bkBS=bkBS;', cx);

let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) bad++; };
const body = () => ({ innerHTML: '' });
const at = (h, a, b) => h.indexOf(a) >= 0 && h.indexOf(b) >= 0 && h.indexOf(a) < h.indexOf(b);
const A = (code, name, m) => ({ code, name, amount_minor: m });

(async () => {
  /* ── W15-92 P&L: the live walk's figures, in the pack's line order (not code order) ── */
  reply = {
    currency: 'AUD',
    income: [A('4000', 'Sales', 19500000)],
    expense: [A('5100', 'Wages', 4348060), A('6090', 'Bank and merchant fees', 5860), A('6010', 'Rent', 1423163), A('6060', 'Repairs and maintenance', 5730419), A('6190', 'Sundry expenses', 64000)],
    total_income_minor: 19500000, total_expense_minor: 11571502, profit_minor: 7928498,
    by_line: {
      income: [{ line: 'revenue', label: 'Revenue', amount_minor: 19500000, accounts: [A('4000', 'Sales', 19500000)] }],
      expense: [
        { line: 'employee', label: 'Employee benefits expense', amount_minor: 4348060, accounts: [A('5100', 'Wages', 4348060)] },
        { line: 'finance', label: 'Finance costs', amount_minor: 5860, accounts: [A('6090', 'Bank and merchant fees', 5860)] },
        { line: 'other', label: 'Other expenses', amount_minor: 7217582, accounts: [A('6010', 'Rent', 1423163), A('6060', 'Repairs and maintenance', 5730419), A('6190', 'Sundry expenses', 64000)] }
      ]
    }
  };
  let b = body(); await cx.bkPL(b); let h = b.innerHTML;
  ok(at(h, 'Employee benefits expense', 'Finance costs') && at(h, 'Finance costs', 'Other expenses'), 'expense report-line headings show, in the pack order');
  ok(at(h, 'Other expenses', '6010') && at(h, '6010', '6190') && at(h, '6190', 'Total Other expenses'), 'a group lists its ledgers, then its carried total (two or more ledgers)');
  ok(h.includes('<b>Total Other expenses</b></td><td class="num"><b>M7217582</b>'), 'the group total is the server line amount (72,175.82), not a page sum');
  ok(!h.includes('Total Finance costs') && !h.includes('Total Employee benefits expense'), 'a one-ledger group repeats no subtotal');
  ok(at(h, 'Total income', 'Expenses') && h.includes('<b>Total income</b></td><td class="num"><b>M19500000</b>'), 'Total income = the carried total_income_minor 195,000.00');
  ok(h.includes('<b>Total expenses</b></td><td class="num"><b>M11571502</b>'), 'Total expenses = the carried total_expense_minor 115,715.02');
  ok(at(h, 'Total expenses', 'data-testid="pl-profit"') && /Profit M7928498/.test(h), 'then the Profit 79,284.98, the carried one');
  reply = Object.assign({}, reply, { by_line: undefined });
  b = body(); await cx.bkPL(b);
  ok(b.innerHTML.includes('6010') && b.innerHTML.includes('Total expenses') && !b.innerHTML.includes('st-group'), 'an api with no by_line: the flat ledgers still list, with the carried totals');
  reply = Object.assign({}, reply, { total_income_minor: undefined, total_expense_minor: undefined });
  b = body(); await cx.bkPL(b);
  ok(!/Total income|Total expenses/.test(b.innerHTML), 'a total the server did not carry is not shown (the page never sums)');

  /* ── W15-93 Balance sheet ── */
  reply = {
    currency: 'AUD',
    assets: [A('1000', 'Bank', 14061005)], total_assets_minor: 14061005,
    liabilities: [A('2100', 'Suppliers', 2125730), Object.assign(A('2200', 'GST payable to the ATO', 1400972), { net_of: [{ code: '2200', name: 'GST collected' }, { code: '2210', name: 'GST paid' }] })],
    equity: [A('3000', "Owner's capital", 2605805), { code: null, name: 'Net profit', amount_minor: 7928498 }],
    total_liabilities_minor: 3526702, total_equity_minor: 10534303, total_liab_equity_minor: 14061005
  };
  b = body(); await cx.bkBS(b); h = b.innerHTML;
  ok(h.includes('<b>Total liabilities</b></td><td class="num"><b>M3526702</b>'), 'Total liabilities 35,267.02 (carried)');
  ok(h.includes('<b>Total equity</b></td><td class="num"><b>M10534303</b>'), 'Total equity 105,343.03 (carried)');
  ok(h.includes('data-testid="bs-total-le"') && h.includes('<b>Total liabilities and equity</b></td><td class="num"><b>M14061005</b>'), 'Total liabilities and equity 140,610.05 (carried)');
  ok(at(h, 'Total assets', 'Liabilities') && at(h, '<b>Total liabilities</b>', 'Equity') && at(h, '<b>Total equity</b>', 'Total liabilities and equity'), 'order: assets, liabilities + total, equity + total, the grand total');
  ok(h.includes('Net of GST collected 2200 less GST paid 2210'), 'the netted GST line says it is net of 2200 GST collected less 2210 GST paid');
  ok(/data-testid="bs-balanced"[^>]*>✓ balances/.test(h), 'the chip compares the two carried totals: balances');
  reply = Object.assign({}, reply, { total_liab_equity_minor: 14061000 });
  b = body(); await cx.bkBS(b);
  ok(/⚠ does not balance/.test(b.innerHTML), 'two carried totals that differ: does not balance');
  reply = Object.assign({}, reply, { total_liabilities_minor: undefined, total_equity_minor: undefined });
  b = body(); await cx.bkBS(b);
  ok(!b.innerHTML.includes('<b>Total liabilities</b>') && !b.innerHTML.includes('<b>Total equity</b>'), 'an api without the two sub-totals: none are made up');
  process.exitCode = bad ? 1 : 0;
})();
