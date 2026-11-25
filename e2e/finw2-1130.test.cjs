'use strict';
// @type: unit
/**
 * finw2-1130.test.cjs - WALK 25 Nov (sit-au, Moonee Espresso - demo), finance rows run on the page's own functions with hand figures.
 * OWNS      FW-30 Cash head: a late return is named with its own due date and "overdue" (BAS FY27 Q1 A$1,803.50 · due 28 Oct 2026 · overdue) and what no return holds
 *           is its own undated line (A$2,504.70); 1,803.50 + 2,504.70 = 4,308.20 (the old single "due date not recorded" line). Without `returns` the old line stays.
 * CALLED BY ci.yml (the unit checks): node e2e/finw2-1130.test.cjs
 * CARD      16-finance/cash-position-and-cash-flow
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-finance-cash.js'), 'utf8');
const grab = (name) => { const at = src.indexOf('function ' + name + '('); let depth = 0, i = src.indexOf('{', at); const start = at; for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; } return src.slice(start, i + 1); };
const sb = { tx: (s) => s, bkMoney: (m) => 'A$' + (m / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 }), bkDate: (d) => ({ '2026-10-28': '28 Oct 2026' })[d] || d, packWord: () => 'GST', shopDay: (d) => d, fcReturnChip: () => 'return chip' };
vm.createContext(sb);
['fcGstChips', 'fcLateReturnChip', 'fcOnNoReturnChip', 'fcEarlierChip'].forEach((n) => vm.runInContext(grab(n) + '\nthis.' + n + ' = ' + n + ';', sb));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  XX  ') + m); if (!c) fails++; };
const reply = { currency: 'AUD', gst: { payable_minor: 432072, short: 'BAS', earlier: { payable_minor: 430820, before: '2026-10-01', counted: false,
  returns: [{ period: '2026-Q1', label: 'FY27 Q1', due_date: '2026-10-28', payable_minor: 180350, overdue: true }], overdue_minor: 180350, other_minor: 250470 } } };
const chips = sb.fcGstChips(reply).map((c) => c.text);
ok(chips.includes('BAS FY27 Q1 A$1,803.50 · due 28 Oct 2026 · overdue'), 'late return named with its date: ' + chips.join(' | '));
ok(chips.includes('GST owing, on no return A$2,504.70'), 'the rest is its own line: ' + chips.join(' | '));
ok(!chips.some((t) => /due date not recorded/.test(t)), 'no "due date not recorded" when the return is named');
const old = sb.fcGstChips({ currency: 'AUD', gst: { payable_minor: 432072, short: 'BAS', earlier: { payable_minor: 430820, before: '2026-10-01', counted: false } } }).map((c) => c.text);
ok(old.some((t) => /owing from before 2026-10-01 · A\$4,308\.20 · due date not recorded/.test(t)), 'no returns list: the old lump line stays: ' + old.join(' | '));
/* FW-38: the waiting grid's BILL NO falls back to the books' own reference (S068-22, the one Dues prints) when the chit holds no number; typed refs are never one */
const cells = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-books-waiting-cells.js'), 'utf8');
const at = cells.indexOf('function bkWaitNo('); let d = 0, j = cells.indexOf('{', at); for (; j < cells.length; j++) { if (cells[j] === '{') d++; else if (cells[j] === '}' && --d === 0) break; }
const sb2 = { bkWaitModel: (w) => w.model || null }; vm.createContext(sb2); vm.runInContext(cells.slice(at, j + 1) + ';this.bkWaitNo = bkWaitNo;', sb2);
ok(sb2.bkWaitNo({ ref: 'S068-22', job: 'bill' }) === 'S068-22', 'FW-38: no number on the chit -> the books ref S068-22');
ok(sb2.bkWaitNo({ ref: 'S068-22', model: { no: 'INV-7' } }) === 'INV-7', 'FW-38: the chit own number wins');
ok(sb2.bkWaitNo({ ref: 'walkin:C1:2026-11-01', job: 'day' }) === '' && sb2.bkWaitNo({ ref: 'ev:expense:abc' }) === '' && sb2.bkWaitNo({ ref: '3f2b8c1e-1111-4222-8333-444455556666' }) === '', 'FW-38: day refs, typed refs and ids are never a bill number');
process.exit(fails ? 1 : 0);
