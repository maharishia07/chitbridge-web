/* bank-demo-check.js — the statement check of public/bank-demo.html: what the engine says about the FILE before any line is worked.
 * OWNS      calling CBBankStatementCheck.check (engines #146) on the parsed statement with the demo's own sample state (one demo bank account, no earlier statements, nothing posted), and painting its answer
 *           into the page's check slot: a refusal stops with the reason; each "confirm" item gets a tick the owner presses before line work; an "already done" file says so, line by line in the engine's words.
 * CALLED BY public/app/bank-demo.js (CBBankDemoCheck.create(host)); loaded before it by public/bank-demo.html.
 * FLOW      load → run(text, name, go) → check() → verdict refuse: show the reasons, stop · confirm: show the ticks, wait · go: go() reads the statement into the books page
 * ⭐ NO WORDS OF OUR OWN FOR A FINDING: items[].why is the engine's sentence, shown as given. With no CBBankStatementCheck on the page (the engines adopt has not landed) the check is skipped and go() runs at once.
 * ⭐ AN ACCOUNT NUMBER IS NEVER SHOWN: only the masked tail the engine returns. NO MONEY IS COMPUTED HERE.
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * CONTROLS  BKS017-N03 the slot · BKS017-B27 "I checked this" · BKS017-B28 "Use it anyway"
 */
(function (root) {
  'use strict';
  var host = null /* the page's own functions, given by create() */,
    pending = null /* { text, name, go, confirmed }: the file waiting for the owner's ticks */;

  /** the engine's call: the parsed statement and the demo's sample state (never summed from the lines) */
  function askEngine(parsed, confirmed) {
    return root.CBBankStatementCheck.check({
      currency: host.CURRENCY,
      today: new Date().toISOString().slice(0, 10),
      statement: parsed,
      lines: parsed.lines,
      accounts: [{ id: 'demo', name: host.ACCOUNT, number: '00000000' }],
      chosen_account_id: 'demo',
      saved_account_id: 'demo',
      books: { opening_minor: host.openingMinor(), start_date: parsed.from },
      log: { statements: [] },
      posted: {},
      confirmed: confirmed
    });
  }
  /** one finding as a paragraph, with the tick that answers it when it is a "confirm" (or an override the owner may use anyway) */
  function itemHtml(item) {
    var asks = item.level === 'confirm' && !item.confirmed,
      anyway = item.override && !item.confirmed,
      label = anyway ? 'Use it anyway' : 'I checked this',
      button = asks || anyway ? ' <button type="button" class="bd-btn" data-act="checkconfirm" data-code="' + esc(item.code) + '" data-cbsid="' + (anyway ? 'BKS017-B28' : 'BKS017-B27') + '">' + label + '</button>' : '';
    return '<p>' + esc(item.why) + button + '</p>';
  }
  /** "All N lines are already in your books. Nothing to do." and each line's reason, in the engine's words */
  function alreadyHtml(already) {
    if (!already || !already.all) return '';
    return '<p><b>' + esc(already.summary) + '</b></p>';
  }
  function paintSlot(result) {
    var slot = host.el('bd_check');
    slot.hidden = false;
    slot.innerHTML = (result.items || []).filter(function (item) { return item.level !== 'info' || item.why; }).map(itemHtml).join('') + alreadyHtml(result.already);
  }
  /** run the check for a file: go() is called with the result when the verdict allows line work, never before */
  function run(text, name, go) {
    var parsed = root.CBBankRecon && root.CBBankRecon.parse(text, host.parseOpts());
    if (!root.CBBankStatementCheck || !parsed || !parsed.ok) return go(null);
    pending = { text: text, name: name, go: go, confirmed: [], parsed: parsed };
    verdictOf(askEngine(parsed, []));
  }
  function verdictOf(result) {
    if (!result || result.ok === false) return pending.go(null);
    paintSlot(result);
    if (result.verdict === 'go') pending.go(result);
  }
  /** the owner ticked a finding: its code joins the confirmed list and the check runs again */
  function confirmCode(target) {
    pending.confirmed = pending.confirmed.concat(target.getAttribute('data-code'));
    verdictOf(askEngine(pending.parsed, pending.confirmed));
  }
  function create(pageHost) {
    host = pageHost;
    return { run: run, actions: { checkconfirm: function (target) { if (pending) confirmCode(target); return true; } } };
  }
  root.CBBankDemoCheck = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
