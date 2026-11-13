/* app/chit-price-moved.js - A DRAFT SENT LONG AFTER IT WAS PRICED: SAY WHICH LINES MOVED AND LET THE PERSON DECIDE (CTR-245, CTR-212 S4, web half).
 *
 * OWNS      isMoved(error) · usingNew(lines, data, currency) -> { lines, removed } · asDrafted(data) -> the ack to hand back · rowWords(fact, currency) · ask(data, onNew, onDrafted, onBack)
 *           · failed(error, v, fail, resend) -> null. The popup is ONE native <dialog> drawn here over the compose modal (ui.dialog would replace the modal host and lose the compose form).
 * CALLED BY public/app.html sendChit (its catch: every failed send goes through failed(); a 409 PRICE_MOVED opens the question, any other error says its words as before)
 * FLOW      POST /api/chits/send answers 409 PRICE_MOVED { lines, can_send_as_drafted, ack } -> the person picks:
 *             Use the new prices -> the lines are re-priced ONCE here (price and rate from the answer, total again from price x quantity - discount, a withdrawn line removed) -> sent again
 *             Send as drafted    -> sent again with price_ack (the stamps the 409 showed; void after 5 minutes or if a price moved again), only offered when every line is a price move
 *             Back to the draft  -> nothing sent, the draft is as it was
 * CARD      09-counter/README
 *
 * ⚠️ THE SERVER SENDS NO TOTAL. The figures here are the per-line price (minor units) the answer names; the total the bill ends with is the server's engine run on the lines it is sent.
 * ⚠️ A RATE THAT MOVED OR A WITHDRAWN LINE HAS NO "SEND AS DRAFTED": the rate in force is the law's, a withdrawn item is not sold. The button is not drawn, the sentence says why.
 * ⚠️ NOTHING IS DECIDED FOR THE PERSON: Escape, the backdrop and Back all leave the draft untouched.
 */
(function (root) {
  'use strict';
  var DIALOG_ID = 'cb_pricemoved';
  /* the codes of the popup's own buttons (docs SCREENS.json rows follow with the docs batch) */
  var CODE_NEW = 'RAL001-D01-B01';
  var CODE_DRAFTED = 'RAL001-D01-B02';
  var CODE_BACK = 'CMP003';
  var STATUS_CONFLICT = 409;
  var CODE_MOVED = 'PRICE_MOVED';
  var KIND_WORDS = { price_moved: 'price changed', rate_moved: 'tax rate changed', withdrawn: 'no longer sold' };

  function say(text) {
    return typeof root.tx === 'function' ? root.tx(text) : text;
  }
  /** is this failed call the server's "prices have moved" answer? (by its status and its code, never by its words) */
  function isMoved(error) {
    return !!error && error.status === STATUS_CONFLICT && !!error.data && error.data.code === CODE_MOVED && Array.isArray(error.data.lines);
  }
  /** a price in minor units as the number the line carries (the currency's own decimals) */
  function majorOf(minor, currency) {
    return root.CBMoney.round(Number(minor) / Math.pow(10, root.CBMoney.decimals(currency)), currency);
  }
  /** the catalogue product a minted line names (the web cart writes ref.item_id) */
  function itemOf(line) {
    return String((line && ((line.ref && line.ref.item_id) || line.item_id)) || '');
  }
  /** one line re-priced from the fact the server named: price and rate as the catalogue holds them now, the total again from price x quantity - discount */
  function repriced(line, fact, currency) {
    var next = Object.assign({}, line);
    if (fact.now_minor != null) next.price = majorOf(fact.now_minor, currency);
    if (fact.now_rate != null) next.gst_rate = Number(fact.now_rate);
    if (fact.now_minor != null && !line.freebie) next.total = root.CBMoney.round(next.price * (Number(next.quantity) || 0) - (Number(next.discount) || 0), currency);
    return next;
  }
  /** "Use the new prices": the lines as they should be sent, and how many withdrawn lines were left out. Pure: the answer and the lines in, new lines out. */
  function usingNew(lines, data, currency) {
    var facts = {};
    (data.lines || []).forEach(function (fact) { facts[String(fact.item_id)] = fact; });
    var removed = 0;
    var out = [];
    (lines || []).forEach(function (line) {
      var fact = facts[itemOf(line)];
      if (fact && fact.kind === 'withdrawn') removed += 1;
      else out.push(fact ? repriced(line, fact, currency) : line);
    });
    return { lines: out, removed: removed };
  }
  /** "Send as drafted": the ack exactly as the server handed it out, or null when the answer does not allow it */
  function asDrafted(data) {
    return data && data.can_send_as_drafted === true && data.ack ? data.ack : null;
  }
  /** one moved line in words: the name, then what changed with both figures */
  function rowWords(fact, currency) {
    var name = fact.name || say('An item');
    if (fact.kind === 'withdrawn') return name + ' - ' + say(KIND_WORDS.withdrawn) + ' ' + say('(it will be removed)');
    if (fact.kind === 'rate_moved') return name + ' - ' + say(KIND_WORDS.rate_moved) + ': ' + fact.was_rate + '% > ' + fact.now_rate + '%';
    return name + ' - ' + say(KIND_WORDS.price_moved) + ': ' + root.fmtMoney(majorOf(fact.was_minor, currency), currency) + ' > ' + root.fmtMoney(majorOf(fact.now_minor, currency), currency);
  }
  /** the list of moved lines, one row each */
  function listHtml(data, currency) {
    return '<ul data-testid="price-moved-lines" style="margin:0;padding-inline-start:18px">' + data.lines.map(function (fact) { return '<li>' + esc(rowWords(fact, currency)) + '</li>'; }).join('') + '</ul>';
  }
  var BUTTON_CSS = 'min-height:44px;padding:0 16px;border-radius:9px;font:inherit;font-weight:600;cursor:pointer;';
  function quietButton(code, testid, label) {
    return '<button type="button" data-testid="' + testid + '" style="' + BUTTON_CSS + 'border:1px solid var(--line,#DDD6C6);background:transparent;color:inherit" data-cbsid="' + code + '">' + esc(say(label)) + '</button>';
  }
  function primaryButton(code, testid, label) {
    return '<button type="button" data-testid="' + testid + '" style="' + BUTTON_CSS + 'border:1px solid var(--green,#16693F);background:var(--green,#16693F);color:var(--card,#fff)" data-cbsid="' + code + '">' + esc(say(label)) + '</button>';
  }
  /** the whole popup's markup: what moved, then the choices (Send as drafted only when the server allows it) */
  function dialogHtml(data, currency) {
    var drafted = asDrafted(data);
    var note = drafted ? '' : '<p style="margin:0" data-testid="price-moved-note">' + esc(say('A tax rate or a withdrawn item cannot be sent as drafted.')) + '</p>';
    return '<form method="dialog" style="margin:0;padding:20px 20px 16px;display:flex;flex-direction:column;gap:12px">' +
      '<div style="font-weight:700;font-size:18px">' + esc(say('Prices have moved')) + '</div>' +
      '<div style="color:var(--muted,#5E594D);display:flex;flex-direction:column;gap:8px">' +
      '<p style="margin:0">' + esc(say('These items changed in your catalogue after this draft was made. Nothing has been sent.')) + '</p>' +
      listHtml(data, currency) + note + '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">' +
      quietButton(CODE_BACK, 'price-moved-back', 'Back to the draft') +
      (drafted ? quietButton(CODE_DRAFTED, 'price-moved-drafted', 'Send as drafted') : '') +
      primaryButton(CODE_NEW, 'price-moved-new', 'Use the new prices') +
      '</div></form>';
  }
  /** one answer is taken once: the dialog closes and exactly one of the three callbacks runs */
  function wire(node, choices) {
    var done = false;
    function close(which) {
      if (done) return;
      done = true;
      try { node.close(); } catch (_) { /* a dialog that was never open has nothing to close */ }
      node.remove();
      if (choices[which]) choices[which]();
    }
    [['price-moved-new', 'onNew'], ['price-moved-drafted', 'onDrafted'], ['price-moved-back', 'onBack']].forEach(function (pair) {
      var button = node.querySelector('[data-testid="' + pair[0] + '"]');
      if (button) button.onclick = function () { close(pair[1]); };
    });
    node.addEventListener('cancel', function (event) { event.preventDefault(); close('onBack'); });
  }
  /** opens the question over whatever is on screen; the person's answer runs exactly one of onNew, onDrafted, onBack */
  function ask(data, choices, currency) {
    var old = root.document.getElementById(DIALOG_ID);
    if (old) old.remove();
    var node = root.document.createElement('dialog');
    node.id = DIALOG_ID;
    node.setAttribute('data-testid', 'price-moved');
    node.style.cssText = 'border:1px solid var(--line,#DDD6C6);border-radius:14px;padding:0;max-width:min(460px,92vw);width:100%;background:var(--card,#fff);color:var(--ink,#1D1B16);font:15px/1.45 "IBM Plex Sans",system-ui,sans-serif';
    node.innerHTML = dialogHtml(data, currency);
    root.document.body.appendChild(node);
    wire(node, choices);
    node.showModal();
    var first = node.querySelector('[data-testid="price-moved-new"]');
    if (first && first.focus) first.focus();
  }
  /** the send again, after the person chose: the lines and the ack ride on a copy of what was sent */
  function resendWith(v, lines, ack, resend) {
    return resend(Object.assign({}, v, { line_items: lines, price_ack: ack }));
  }
  /** every failed send ends here: the server's "prices have moved" opens the question; any other error says its own words as before. Always null (nothing was sent). */
  function failed(error, v, fail, resend) {
    if (!isMoved(error)) {
      fail((error && error.message) || 'Something went wrong — please try again.');
      return null;
    }
    var data = error.data;
    var currency = typeof root.myCur === 'function' ? root.myCur() : null;
    root.CBPriceMoved.ask(data, {
      onNew: function () {
        var next = usingNew(v.line_items, data, currency);
        if (!next.lines.length) fail(say('Nothing is left to send once the withdrawn items are removed.'));
        else resendWith(v, next.lines, null, resend);
      },
      onDrafted: function () { resendWith(v, v.line_items, asDrafted(data), resend); },
      onBack: function () { /* the draft is as it was; nothing was sent */ }
    }, currency);
    return null;
  }
  root.CBPriceMoved = { isMoved: isMoved, usingNew: usingNew, asDrafted: asDrafted, rowWords: rowWords, ask: ask, failed: failed };
})(typeof window !== 'undefined' ? window : this);
