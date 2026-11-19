/**
 * books-held-ok.js — SHOPBK slice B: the owner's OK for entries the shop's Bookkeeper saved while "Owner OKs first" is on.
 *
 * OWNS      the rows under the To do line "entries waiting for your OK": per entry its words, its amount WITH its currency, who sent it, and two buttons, Accept and Return (a note is asked for a return).
 * CALLED BY accounts.html (accTodo, the row of kind entries_to_ok; the owner only: the api sends the row to anyone who reads /todo, the page draws the buttons for the owner)
 * FLOW      GET /api/books/todo row items → paint(host, item, deps) → Accept: confirm (CBAction) → POST /api/books-actions/:id/accept { store_id, body_hash, total_minor, currency } → the one writer posts → deps.reload()
 *           · Return: a sheet asks the note → POST /api/books-actions/:id/return { store_id, body_hash, reason } → nothing posts → deps.reload()
 * ID        BKS001
 * OWNER     cb-accounting
 * RISK      money
 * CARD      14-accounting/ledger-accounts-day-book-entries-reverse
 *
 * Decides nothing: whether the owner may, and why not, are the server's answers (a refusal is said in its own words). The amount shown, confirmed and posted is the server's total_minor in its own currency; nothing is added or converted here.
 * REUSE (named in the PR): CBAction.run (confirm, busy, outcome) · the page's modal sheet · CBMoney via the page's money text · the existing /api/books-actions accept and return doors (no new queue)
 */
(function (root) {
  'use strict';
  /** text made safe for the page, through the page's own escaper */
  function safe(text, deps) {
    return deps.esc(text);
  }
  /** what a person would call the entry: its narration, else the kind of entry */
  function nameOf(item, deps) {
    return item.narration || (item.kind === 'journal' ? deps.tx('Journal') : deps.tx('Day book entry'));
  }
  /** one held entry: its words, amount with currency, who sent it, and the two buttons */
  function rowHTML(item, deps) {
    var figure = item.total_minor == null ? '' : deps.money(item.total_minor, item.currency);
    return (
      '<div class="held-row" data-testid="held-row-' + safe(item.action_id, deps) + '">' +
      '<span class="held-words">' + safe(nameOf(item, deps), deps) + ' · <b class="mono">' + safe(figure, deps) + '</b> · ' + safe(deps.tx('from'), deps) + ' ' + safe(item.by || '—', deps) + '</span>' +
      '<button data-cbsid="BKS001-B08" type="button" class="act" data-testid="held-accept-' + safe(item.action_id, deps) + '" data-id="' + safe(item.action_id, deps) + '">' + safe(deps.tx('Accept'), deps) + '</button>' +
      '<button data-cbsid="BKS001-B09" type="button" class="act quiet" data-testid="held-return-' + safe(item.action_id, deps) + '" data-id="' + safe(item.action_id, deps) + '">' + safe(deps.tx('Return'), deps) + '</button>' +
      '</div>'
    );
  }
  /** Accept: confirm with the amount and currency, then the one api accept posts it; the list is read again */
  function accept(item, button, deps) {
    root.CBAction.run(
      button,
      function () {
        return deps.api('booksActionAccept', { params: { id: item.action_id }, body: { store_id: item.store_id, body_hash: item.body_hash, total_minor: item.total_minor, currency: item.currency } });
      },
      {
        key: 'held-accept-' + item.action_id,
        confirm: { title: deps.tx('Post this entry?'), body: safe(nameOf(item, deps), deps) + ' · <b>' + safe(deps.money(item.total_minor, item.currency), deps) + '</b>. ' + safe(deps.tx('It goes into the books now.'), deps), yes: deps.tx('Accept and post'), danger: false },
        failed: deps.tx("Not posted. Nothing changed."),
        outcome: deps.reload
      }
    );
  }
  /** Return asks for a note (3 to 300 characters): the Bookkeeper reads it, nothing is posted */
  function askReturn(item, deps) {
    deps.modal(
      '<h2>' + safe(deps.tx('Return this entry?'), deps) + '</h2><div class="bg-form" data-testid="held-return-form"><div class="sub">' + safe(nameOf(item, deps), deps) + ' · ' + safe(deps.money(item.total_minor, item.currency), deps) + '</div>' +
        '<label class="sub" for="held_reason">' + safe(deps.tx('Say why (3 to 300 characters)'), deps) + '</label><textarea data-cbsid="BKS001-I01" id="held_reason" class="inp" rows="3" maxlength="300" data-testid="held-reason"></textarea>' +
        '<div class="nw-out" id="held_out" data-testid="held-out" role="status"></div>' +
        '<div class="nw-acts"><button data-cbsid="BKS001-B10" type="button" class="act" id="held_send" data-testid="held-send">' + safe(deps.tx('Return'), deps) + '</button>' +
        '<button data-cbsid="BKS001-B11" type="button" class="act quiet" id="held_cancel" data-testid="held-cancel">' + safe(deps.tx('Cancel'), deps) + '</button></div></div>'
    );
    var doc = root.document;
    doc.getElementById('held_cancel').onclick = deps.closeModal;
    /** Return pressed: the note as typed goes with the entry's body hash; nothing is posted, the list is read again */
    doc.getElementById('held_send').onclick = function sendReturn() {
      var reason = doc.getElementById('held_reason').value.trim();
      root.CBAction.run(
        doc.getElementById('held_send'),
        function () {
          return deps.api('booksActionReturn', { params: { id: item.action_id }, body: { store_id: item.store_id, body_hash: item.body_hash, reason: reason } });
        },
        {
          key: 'held-return-' + item.action_id,
          failed: deps.tx("Not returned. Nothing changed."),
          out: 'held_out',
          outcome: function () {
            deps.closeModal();
            deps.reload();
          }
        }
      );
    };
    doc.getElementById('held_reason').focus();
  }
  /** paint the entries under the To do row and wire their buttons; `deps` = { api, tx, esc, money, modal, closeModal, reload } from the page */
  function paint(host, items, deps) {
    host.innerHTML = (items || []).map(function (item) { return rowHTML(item, deps); }).join('');
    (items || []).forEach(function (item) {
      var yes = host.querySelector('[data-testid="held-accept-' + item.action_id + '"]');
      var back = host.querySelector('[data-testid="held-return-' + item.action_id + '"]');
      if (yes) yes.onclick = () => accept(item, yes, deps);
      if (back) back.onclick = () => askReturn(item, deps);
    });
  }
  root.CBBooksHeldOk = { paint: paint };
})(window);
