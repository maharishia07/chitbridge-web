/* cap-bank-map.js — the column map on the Bank screen (FIN-115).
 * ID        BKS017
 * OWNER     cb-finance
 * RISK      money
 * OWNS      what the Bank screen does when the one reader (CBBankRecon.parse) cannot tell which column is which: it shows the SAME column-map card bank-demo uses (CBBankDemoAsk.mapCard), and reads the file again with the person's mapping.
 * CALLED BY public/app/cap-bank.js bankTake (a refused parse → bankRefused), the card's button (bankMapRead)
 * FLOW      refusal about the header / columns → card in #bk_out → Read the file → bankMapRead → BKB.mapping → bankTake (parse takes it once) → lines. Any other refusal is said in words, as before.
 * ⭐ NO SECOND PARSER AND NO GUESS: the reader and the card are the engine's and the demo's; this file only joins them. The mapping lives for one read.
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
let bkMapKept = null; /* { text, name } of the refused file, for the Read press */
/** a refused statement: the columns case offers the map; every other refusal is said as it always was (and a remembered file that no longer reads is forgotten) */
function bankRefused(parsed, text, name, remembered) {
  BKB.parsed = null;
  BKB.rows = [];
  bkbEl('bk_res').innerHTML = '';
  bankLayout(false, false);
  if (remembered) bkbSave('stmt:' + BKB.acct, null);
  const reason = (parsed && parsed.why) || tx('That file could not be read as a bank statement.');
  if (!remembered && !BKB.mapping && /header|column|mapping|preset/i.test(reason) && typeof CBBankDemoAsk !== 'undefined') {
    const card = CBBankDemoAsk.mapCard(text, 'bankMapRead()');
    if (card) {
      bkMapKept = { text, name };
      bkbEl('bk_out').innerHTML = '<div class="pe-note" data-testid="bank-map">' + bkbE(tx('We could not tell which column is which in that file.')) + '</div>' + card;
      return;
    }
  }
  return peBad('bk_out', reason);
}
/** Read the file with the columns the person named */
async function bankMapRead() {
  const named = CBBankDemoAsk.mapping();
  if (!bkMapKept || !Object.keys(named).length) return toast(tx('Say which column is which first.'));
  BKB.mapping = named;
  try {
    await bankTake(bkMapKept.text, bkMapKept.name, false);
  } finally {
    BKB.mapping = undefined;
  }
}
