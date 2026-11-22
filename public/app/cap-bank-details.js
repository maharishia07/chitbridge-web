/* app/cap-bank-details.js — the BANK DETAILS capability of a bank account: bank, branch code and the last four digits of the account number, asked once, kept on this device. Split out of cap-bank.js, code moved verbatim; no money is touched.
 * OWNS      bkbBranchRule · bkbBranchWords · bkbDetails · bkbHeldNumber · bankDetailsOpen (the dialog) · bankDetailsSave
 * CALLED BY public/accounts.html (script tag, before cap-bank.js); cap-bank.js (the band's details button) and cap-bank-sheet.js (bkbHeldNumber) call it at run time; its functions are global
 * FLOW      the band's Bank details button → bankDetailsOpen → bankDetailsSave → bkbSave (cap-bank.js) → bkshPrime (the statement is checked again with the number)
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * ID        BKS014
 * OWNER     cb-finance
 * RISK      personal-data
 */
'use strict';
/**
 * W15-24 · the BANK DETAILS of a bank account: bank, branch code and the LAST FOUR of the account number. Asked once, optional ("not given" stays unknown, never defaulted), and matched against a file that carries a number.
 * Only the last four are kept, never the full number: that is all the match needs, and it is the form Australian banks themselves show (the Consumer Data Right banking standard's maskedNumber).
 * The branch code is the country's own: AU a 6-digit BSB (allocated by AusPayNet), IN an IFSC, else a free branch code. Kept on THIS device for this shop and account (the books have no field for it yet: a server home needs
 * an api field and a migration, which is the owner's decision), so another device or the adviser's seat does not see it until then.
 * Figures cited from the walker's knowledge, not looked up in this round: cb-country to cite-check before a requirement is written.
 */
/** the country's branch-code rule: helpers.js bankBranchRule (the pack's own first, else the one table); null = a free, neutral 'Branch code' */
const bkbBranchRule = () => bankBranchRule(bkbCountry());
const bkbBranchWords = () => {
  const rule = bkbBranchRule();
  return rule ? [rule.word, rule.hint] : ['Branch code', 'the branch code, if your bank has one'];
};
const bkbDetails = () => bkbLoad('acctdetails:' + (BKB.stmtAcct || BKB.acct), {}) || {};
/** the account number the books hold for this bank account, masked ('****1234'), or '' when none is held */
function bkbHeldNumber() {
  const held = bkbDetails();
  return held.last4 ? '****' + held.last4 : '';
}
/** the dialog that holds this account's bank, branch and last four digits */
function bankDetailsOpen() {
  const held = bkbDetails(),
    words = bkbBranchWords();
  ui.dialog({
    mount: 'BKS014-U04', pop: 'POP092',
    titleText: tx('Bank details of this account'),
    bodyStyle: 'display:flex;flex-direction:column;gap:8px',
    body: peField('bk_dbank', 'Bank', peInput('bk_dbank', held.bank, '', 'text', ' maxlength="60" autocomplete="off"')) +
      peField('bk_dbranch', words[0], peInput('bk_dbranch', held.branch, tx('For example') + ' ' + ((bkbBranchRule() || {}).example || ''), 'text', ' maxlength="20" autocomplete="off"')) +
      peField('bk_dlast4', 'Last 4 digits of the account number', peInput('bk_dlast4', held.last4, '', 'text', ' maxlength="4" inputmode="numeric" autocomplete="off"')) +
      '<div class="pe-note">' + bkbE(tx('Only the last four digits are kept, so a statement that carries the account number can be checked against this account. Nothing here is sent anywhere.')) + '</div><div id="bk_dout" class="pe-slot"></div>',
    footerHtml: '<button data-cbsid="BKS014-B29" type="button" onclick="closeModal()">' + bkbE(tx('Cancel')) + '</button><button data-cbsid="BKS014-B28" type="button" class="pri" data-testid="bank-details-save" onclick="bankDetailsSave()">' + bkbE(tx('Save')) + '</button>'
  });
}
/** the details dialog's Save: each field trimmed, a refusal in words, else stored for the account */
function bankDetailsSave() {
  const bank = String(peVal('bk_dbank') || '').trim(),
    branch = String(peVal('bk_dbranch') || '').trim(),
    last4 = String(peVal('bk_dlast4') || '').trim(),
    out = bkbEl('bk_dout');
  const refuse = (words) => out && (out.innerHTML = '<div class="pe-bad" role="alert" data-testid="bank-details-bad">' + bkbE(tx(words)) + '</div>');
  if (last4 && !/^[0-9]{4}$/.test(last4)) return refuse('The last four digits of the account number are four digits.');
  const rule = bkbBranchRule();
  if (branch && rule && rule.pattern && !new RegExp(rule.pattern).test(branch)) return refuse(rule.hint ? 'The ' + rule.word + ' is ' + rule.hint + '.' : 'That branch code is not in the right form.');
  bkbSave('acctdetails:' + (BKB.stmtAcct || BKB.acct), { bank, branch, last4 });
  if (typeof BKSH !== 'undefined') BKSH.ctl = null; /* the statement is checked again with the number */
  closeModal();
  if (typeof bkshPrime === 'function') bkshPrime().then(() => bankPaint()).catch((failure) => bkQuiet('bank-details', failure));
  bankPaint();
  toast(tx('Bank details kept.'));
}
