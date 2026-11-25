/* app/accounts-start.js — CB Accounts: small first-paint helpers split out of accounts.html's inline script (file-size ratchet, batch 1128), code moved verbatim.
 * OWNS      addBankTodo (the bank row of To do) · wordBankUnexplained (the bank-difference row's words) · startTodoEarly (the To do read that leaves with the health call) · otherShopTraces · knownLedgerOn
 * CALLED BY accounts.html (script tag, after accounts-shell.js); accTodo and start() in the page's inline script call them when they run, so load order is free
 * FLOW      start() → otherShopTraces / knownLedgerOn → startTodoEarly → ACC.todoEarly; accTodo → addBankTodo
 * CARD      14-accounting/books-ledger
 * ID        SCR045
 * OWNER     cb-accounting
 * RISK      plain
 */
'use strict';
/** addBankTodo(list) → adds the bank row to the To do list once (kept out of accTodo so that stays short) */
function addBankTodo(list) {
  const bank = typeof bankTodoItem === 'function' && !CBBooksActing.hides('bank') ? bankTodoItem() : null;
  if (bank && !list.some((x) => x.kind === 'bank')) list.push(bank);
}
/** wordBankUnexplained(list) → RW1-04/23/24: the To do's bank-difference row says what the Bank page says, "A$354.32 unexplained" (one wording, one sign; the api row carries minor units + currency, the amount is drawn in the money unit, two currencies each name theirs) */
function wordBankUnexplained(list) {
  list.forEach((row) => {
    if (row.kind !== 'bank_unexplained' || !Array.isArray(row.items) || !row.items.length || typeof bkMoney !== 'function') return;
    const several = row.items.length > 1, said = row.items.map((line) => bkMoney(line.unexplained_minor, line.currency) + (several ? ' ' + line.currency : '')).join(' · ');
    row.words = (typeof txf === 'function' ? txf('{a} unexplained', { a: said }) : said + ' unexplained') + ' · ' + tx('Open Bank and answer the lines, or sign off with the reason.');
  });
}
/** startTodoEarly(known) → SPEED (batch 1128, speed2): when the Ledger is known on and To do is the first view, the To do read leaves with the health read */
function startTodoEarly(known) {
  if (known === true && (hashPageOf() === 'todo' || (!NAV.some((item) => item[0] === hashPageOf()) && CBBooksActing.firstTab() === 'todo'))) {
    ACC.todoEarly = api('booksTodo').then((r) => ({ r }), (e) => ({ e }));
  }
}
/** otherShopTraces() → the other shops' fingerprints this browser holds; none when the read fails */
async function otherShopTraces() {
  try {
    return await CBOnePerson.traces(MINE);
  } catch (failure) {
    if (typeof cbQuiet === 'function') cbQuiet('accounts: the other shops on this browser could not be read, none are shown', failure);
    return { others: [] };
  }
}
/** knownLedgerOn() → whether the avatar already read the Ledger switch for this page (true · false), or null when it has not */
function knownLedgerOn() {
  return window.CBAvatar && CBAvatar.ledgerOn ? CBAvatar.ledgerOn() : null;
}
