/* bank-demo-sample.js — the sample of public/bank-demo.html: Harbour Plumbing Pty Ltd, October 2026, ten statement lines and the books they are checked against.
 * OWNS      SAMPLE_CSV (10 lines of an AU bank statement, running balance by hand), SAMPLE_BOOKS (the four lines the sample books already hold, opening 18,500.00), PARTIES (who the books know) and LEARNED (rules the books already learned). Demo seed data only: no rule is computed here.
 * CALLED BY public/app/bank-demo.js (reads CBBankDemoSample); loaded before it by public/bank-demo.html.
 * FLOW      read once at load → the page puts the statement through the engines against these books
 * HAND FIGURES (Harbour's October; the engines must agree): books 23,043.00 = 18,500.00 - 242.00 + 1,705.00 + 2,750.00 + 330.00; not yet in the books: in 664.35 (4.35 + 660.00), out 2,638.80 (880.00 + 1,650.00 + 12.00 + 96.80);
 *           statement closing 23,043.00 + 664.35 - 2,638.80 = 21,068.55; the difference the engine carries is statement less books = -1,974.45
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
(function (root) {
  'use strict';
  var SAMPLE_CSV = [
    'Date,Description,Debit,Credit,Balance',
    '02/10/2026,DIRECT DEBIT ORIGIN ENERGY 7721,242.00,,18258.00',
    '09/10/2026,EFT JONES PLUMBING SUPPLIES J1,880.00,,17378.00',
    '12/10/2026,EFT KENSINGTON STRATA INV 1,,1705.00,19083.00',
    '15/10/2026,EFT COOGEE BAY CAFE INV 2,,2750.00,21833.00',
    '16/10/2026,EFT JONES PLUMBING SUPPLIES J2,1650.00,,20183.00',
    '20/10/2026,EFT R AND J NGUYEN INV 3,,330.00,20513.00',
    '27/10/2026,EFTPOS BUNNINGS 0450 SYDNEY,96.80,,20416.20',
    '29/10/2026,DIRECT CREDIT PACIFIC RIM TRADERS,,660.00,21076.20',
    '31/10/2026,MONTHLY ACCOUNT FEE,12.00,,21064.20',
    '31/10/2026,CREDIT INTEREST,,4.35,21068.55'
  ].join('\n');
  /* the books before the load: the four lines already in the bank ledger (Dr = money in); each says what it was entered as */
  var SAMPLE_BOOKS = [
    ['2026-10-02', 0, 24200, 'Electricity: Origin Energy'],
    ['2026-10-12', 170500, 0, 'Invoice INV-1: Kensington Strata'],
    ['2026-10-15', 275000, 0, 'Invoice INV-2: Coogee Bay Cafe'],
    ['2026-10-20', 33000, 0, 'Invoice INV-3: R and J Nguyen']
  ];
  var OPENING_MINOR = 1850000;
  /* the suppliers and customers the books know: a line that names one is paid to or from them */
  var PARTIES = [
    { id: 'p-jones', name: 'Jones Plumbing Supplies', kind: 'supplier' },
    { id: 'p-kens', name: 'Kensington Strata', kind: 'customer' },
    { id: 'p-coogee', name: 'Coogee Bay Cafe', kind: 'customer' },
    { id: 'p-nguyen', name: 'R and J Nguyen', kind: 'customer' }
  ];
  /* rules the books already learned, so these lines have a proposal (never a guess: each says who taught it) */
  var TAUGHT = { date: '2026-09-01', narration: 'taught in the sample books', by: 'sample' };
  var LEARNED = [
    { id: 'out:origin_energy', has: 'ORIGIN ENERGY', side: 'out', party: null, party_name: 'Origin Energy', label: 'Electricity', event: { type: 'expense', class: 'electricity', paid_from: 'bank', tax_kind: 'taxable' }, source: TAUGHT },
    { id: 'out:bunnings', has: 'BUNNINGS', side: 'out', party: null, party_name: 'Bunnings', label: 'Repairs and maintenance', event: { type: 'expense', class: 'repairs', paid_from: 'bank', tax_kind: 'taxable' }, source: TAUGHT },
    { id: 'out:account_fee', has: 'ACCOUNT FEE', side: 'out', party: null, party_name: 'Bank', label: 'Bank fees', event: { type: 'expense', class: 'bank_charges', paid_from: 'bank' }, source: TAUGHT },
    { id: 'in:credit_interest', has: 'CREDIT INTEREST', side: 'in', party: null, party_name: 'Bank', label: 'Interest received', event: { type: 'other_income', class: 'interest_received', into: 'bank' }, source: TAUGHT }
  ];
  root.CBBankDemoSample = { SAMPLE_CSV: SAMPLE_CSV, SAMPLE_BOOKS: SAMPLE_BOOKS, OPENING_MINOR: OPENING_MINOR, PARTIES: PARTIES, LEARNED: LEARNED };
})(typeof globalThis !== 'undefined' ? globalThis : this);
