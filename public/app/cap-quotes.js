/* app/cap-quotes.js — QUOTES: the rounds of a chit that is a quotation (RAIL-117). ONE painter, mounted wherever a chit is shown.
 * OWNS      CBQuotes.mount(host, chitId) · refresh(chitId) · steps(host, ...) · askCross(party, onYes) · crossOf(chit) · CB_QUOTE_EP
 * CALLED BY app.html (the chit pane's Rounds section, the first-send confirm, the compose switch) · tasks.html?view=quotes (a follow-up round mounts the same painter)
 * CARD      01-rail-core-the-chit/chit-proposal
 *
 * Athi, 2026-10-25 (DECISIONS 13:10 · 13:50 · 14:10): a price from another installation or in another currency is a QUOTATION until the seller
 * confirms it; the buyer sees the steps, not a spinner; RFQ ("Ask for a quote") is a deal type, the cart stays the default.
 *
 * ⭐ THE SELLER COMPUTES, EVERYONE ELSE SHOWS. This file never works a price, a tax or a total out: the buyer sends a quantity and an asked price
 *   (text, never a computation), the seller sends a price per line and the SERVER works the round out (lib/chit-proposal). Every figure painted
 *   here is the round's own `money`, in the seller's currency.
 * ⭐ WORDS FROM THE DATA. "Quotation only — <seller country> rules apply; duties and taxes in <buyer country> not included" is filled from
 *   business_json.jurisdiction and the round's jurisdiction; nothing is hard-coded to a country.
 * ⭐ A SEND IS CONFIRMED (money promise): accept, reject, a seller's price and a counter all ask first (CBAction.run), naming who and what.
 * ⭐ NEVER REPAINT A FORM BEING TYPED IN: refresh() leaves an open counter form alone (feedback: loader never repaints open form).
 */
(function (root) {
  'use strict';

  var CB_QUOTE_EP = {
    quoteList: { m: 'GET', p: '/api/chits/:id/proposals', ok: 'y' }, // { proposals[], migrated } — my copy's rounds, newest last
    quotePropose: { m: 'POST', p: '/api/chits/:id/proposals', ok: 'y', idem: true }, // the seller prices · anyone else asks
    quoteAccept: { m: 'POST', p: '/api/chits/:id/proposals/:pid/accept', ok: 'y', idem: true },
    quoteReject: { m: 'POST', p: '/api/chits/:id/proposals/:pid/reject', ok: 'y', idem: true },
    quoteCounter: { m: 'POST', p: '/api/chits/:id/proposals/:pid/counter', ok: 'y', idem: true }
  };
  root.CB_QUOTE_EP = CB_QUOTE_EP;

  var STATE = {}; /* chit id -> { host, chit, rounds, form, steps } */

  function T(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function E(s) {
    return typeof root.esc === 'function'
      ? root.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
  }
  function fill(s, v) {
    return String(s).replace(/\{(\w+)\}/g, function (_, k) {
      return v[k] == null ? '' : v[k];
    });
  }
  function call(key, o) {
    if (typeof root.EP !== 'undefined') for (var k in CB_QUOTE_EP) if (!root.EP[k]) root.EP[k] = CB_QUOTE_EP[k];
    return root.api(key, o);
  }
  function money(n, code) {
    if (n == null || n === '') return '—';
    return typeof root.fmtMoney === 'function' ? root.fmtMoney(n, code) : (code ? code + ' ' : '') + n;
  }
  /** a country (code or name) as a person reads it: "AU" -> Australia; a name stays */
  function countryName(c) {
    var v = String(c || '').trim();
    if (!v) return '';
    if (/^[A-Za-z]{2}$/.test(v)) {
      try {
        return new Intl.DisplayNames(['en'], { type: 'region' }).of(v.toUpperCase()) || v;
      } catch (e) {
        return v;
      }
    }
    return v;
  }

  /* ── what the chit is: who sells, who buys, where ─────────────────────────────────────────────── */
  /** { seller: bool (I price), other: name, jurisdiction, rfq, currency } from the chit read (GET /api/chits/:id) */
  function readChit(r) {
    var h = (r && r.header) || {},
      bj = h.business_json || {},
      me = String(h.entity_id || ''),
      sender = String(h.sender_entity_id || ''),
      orderLike = /^(order|offer)$/.test(String(h.purpose || '')),
      iSent = sender === me,
      seller = orderLike ? !iSent : iSent,
      recips = (h.all_recipients || []).filter(function (x) {
        return x && String(x.entity_id) !== sender;
      }),
      senderName = h.sender_entity_display_name || '',
      other = iSent ? (recips[0] && recips[0].display_name) || '' : senderName;
    var det = (r && r.detail) || {};
    var set = Array.isArray(r && r.live_set) ? r.live_set : (det.line_items || []).map(function (li) { return { live: li }; });
    return {
      id: h.chit_id,
      seller: seller,
      other: other || T('the other business'),
      jurisdiction: bj.jurisdiction || null,
      rfq: bj.deal_type === 'rfq',
      currency: det.currency_code || h.currency_code || (h.summary_json && h.summary_json.currency_code) || '',
      unconfirmed: (r && r.ctp_unconfirmed) || null,
      lines: set.map(function (e, i) {
        var li = (e && (e.live || e.original)) || {};
        return { index: i, line_id: li.line_id || null, name: li.particulars || T('Item'), quantity: li.quantity, price: li.price, removed: !!(e && e.removed) };
      })
    };
  }
  /** does this chit need the rounds at all? A cross-installation or RFQ chit says so on its header; anything else is exactly as before (DECISIONS 14:10) */
  function crossOf(chit) {
    var bj = (chit && (chit.business_json || (chit.header && chit.header.business_json))) || {};
    return !!(bj.jurisdiction || bj.deal_type === 'rfq');
  }

  /* ── the words ────────────────────────────────────────────────────────────────────────────────── */
  /** the jurisdiction line, filled from the data: Quotation only … / Pro-forma */
  function wordsOf(chit, rounds) {
    var j = Object.assign({}, chit.jurisdiction || {});
    var withJ = rounds.filter(function (r) { return r.jurisdiction; });
    if (withJ.length) Object.assign(j, withJ[withJ.length - 1].jurisdiction);
    var agreed = rounds.some(function (r) { return r.status === 'accepted' && r.kind === 'pro_forma'; });
    if (agreed) return { tone: 'ok', text: T('Pro-forma — agreed by both sides') };
    if (j.document !== 'quotation') return { tone: 'plain', text: '' };
    var seller = countryName(j.seller_country) || j.seller_installation || T('the seller’s');
    var buyer = countryName(j.buyer_country);
    var tail = buyer ? fill(T('duties and taxes in {country} not included'), { country: buyer }) : T('your duties and taxes are not included');
    return { tone: 'warn', text: fill(T('Quotation only — {seller} rules apply; {tail}'), { seller: seller, tail: tail }) };
  }
  var KIND = { request: 'Request', pro_forma: 'Quotation', change: 'Change', terms: 'Terms' };
  var STATUS = { proposed: 'Waiting', accepted: 'Agreed', rejected: 'Rejected', countered: 'Answered with a request', superseded: 'Replaced' };

  /* ── the step tracker (a sequence, not a spinner) ─────────────────────────────────────────────── */
  function stepLi(label, st, tid) {
    var mark = st === 'done' ? '✓' : st === 'now' ? '…' : '○';
    return '<li data-testid="' + tid + '" data-step="' + st + '"><span aria-hidden="true">' + mark + '</span> ' + E(label) + '</li>';
  }
  /** the tracker ON the chit, read from the rounds and the unconfirmed mark: Request sent · Reached · Priced · Accepted */
  function trackerHTML(chit, rounds) {
    var priced = rounds.some(function (r) { return r.kind === 'pro_forma' || r.kind === 'change'; });
    var agreed = rounds.some(function (r) { return r.status === 'accepted'; });
    var waiting = chit.unconfirmed;
    var where = (chit.jurisdiction && (chit.chit_installation || chit.jurisdiction.seller_installation || chit.jurisdiction.buyer_installation)) || chit.other;
    var reached = waiting
      ? stepLi(fill(T('Waiting for {where} — not delivered yet'), { where: where }), 'now', 'quote-step-reached')
      : stepLi(fill(T('Reached {name}'), { name: chit.other }), 'done', 'quote-step-reached');
    var out = [stepLi(chit.seller ? T('Request received') : T('Request sent'), 'done', 'quote-step-sent'), reached];
    out.push(stepLi(chit.seller ? T('You price it') : fill(T('{name} prices it (a quotation)'), { name: chit.other }), priced ? 'done' : waiting ? 'todo' : 'now', 'quote-step-priced'));
    out.push(stepLi(chit.seller ? T('They accept — it becomes the pro-forma') : T('You accept — it becomes the pro-forma'), agreed ? 'done' : priced ? 'now' : 'todo', 'quote-step-accepted'));
    return '<ol class="cq-steps" data-testid="quote-tracker" aria-label="' + E(T('Where this quotation stands')) + '" style="list-style:none;margin:6px 0;padding:0;font-size:var(--fs-2)">' + out.join('') + '</ol>';
  }
  /**
   * steps(host, { name, where }) — the live steps of ONE action that crosses to another installation (DECISIONS 13:50): Contacting … · Sent · Waiting for … · Answered.
   * Returns { sent(), waiting(), answered(), failed(words) }; each paints into host (an element) and says the stage to a screen reader.
   */
  function steps(host, who) {
    var el = typeof host === 'string' ? document.getElementById(host) : host;
    var names = [
      fill(T('Contacting {name} on {where}'), { name: who.name, where: who.where || T('their ChitBridge') }),
      T('Sent'),
      fill(T('Waiting for {name}’s answer'), { name: who.name }),
      T('Answered')
    ];
    var at = 0;
    function paint(failedWords) {
      if (!el) return;
      el.setAttribute('role', 'status');
      el.setAttribute('data-testid', 'quote-steps');
      el.innerHTML =
        '<ol style="list-style:none;margin:6px 0;padding:0;font-size:var(--fs-2)">' +
        names.map(function (n, i) { return stepLi(n, failedWords && i === at ? 'now' : i < at ? 'done' : i === at ? 'now' : 'todo', 'quote-steps-' + i); }).join('') +
        '</ol>' + (failedWords ? '<div data-tone="error" data-testid="quote-steps-failed">' + E(failedWords) + '</div>' : '');
    }
    paint();
    return {
      sent: function () { at = 1; paint(); },
      waiting: function () { at = 2; paint(); },
      answered: function () { at = 3; paint(); },
      failed: function (words) { paint(words || T('That did not go through — try again')); }
    };
  }

  /* ── the confirm before the FIRST send to a business on another installation (money promise) ── */
  function askCross(party, onYes, onNo) {
    var ask = typeof root.confirmAsk === 'function' ? root.confirmAsk : typeof root.CBConfirm === 'function' ? root.CBConfirm : null;
    if (!ask) return; /* no dialog on the page = nothing sent (never confirm()) */
    var seller = countryName(party.country);
    var body =
      '<div data-testid="quote-cross-confirm"><b>' + E(party.name) + '</b> ' +
      E(fill(T('is on another ChitBridge{where}.'), { where: party.where ? ' (' + party.where + (seller ? ', ' + seller : '') + ')' : seller ? ' (' + seller + ')' : '' })) +
      '<ul style="margin:8px 0 0;padding-inline-start:18px">' +
      (party.currency ? '<li>' + E(fill(T('Their prices are in {cur}.'), { cur: party.currency })) + '</li>' : '') +
      (seller ? '<li>' + E(fill(T('{country} law and tax apply.'), { country: seller })) + '</li>' : '') +
      (party.buyerCountry ? '<li>' + E(fill(T('{country}’s import duty and taxes are not included.'), { country: countryName(party.buyerCountry) })) + '</li>' : '') +
      '<li>' + E(T('This is a quotation, not a sale: nothing binds until you accept their price.')) + '</li></ul></div>';
    ask(fill(T('Ask {name} for a quote?'), { name: party.name }), body, T('Send'), onYes, false, onNo);
  }

  /* ── reading ──────────────────────────────────────────────────────────────────────────────────── */
  function load(id) {
    var S = STATE[id];
    return Promise.all([call('chit', { params: { id: id } }), call('quoteList', { params: { id: id } })]).then(function (res) {
      if (!STATE[id]) return null;
      S.chit = readChit(res[0]);
      S.rounds = (res[1] && res[1].proposals) || [];
      S.migrated = !res[1] || res[1].migrated !== false;
      S.err = null;
      return S;
    });
  }
  function paint(id) {
    var S = STATE[id];
    if (!S || !S.host || !S.host.isConnected) return;
    S.host.innerHTML = html(S);
  }

  /** has the person got a form open here? A refresh then leaves the screen alone */
  function formOpen(S) {
    return !!(S.host && S.host.querySelector('[data-quote-form]'));
  }
  /** refresh(chitId) — a return-path event arrived: read again and repaint, unless a form is being typed in */
  function refresh(id) {
    var S = STATE[String(id)];
    if (!S || !S.host || !S.host.isConnected || formOpen(S) || S.busy) return Promise.resolve(false);
    return load(String(id))
      .then(function () {
        if (!formOpen(S)) paint(String(id));
        return true;
      })
      .catch(function (e) {
        if (root.console) console.warn('quotes: refresh failed', e && e.message);
        return false;
      });
  }
  function mount(host, id) {
    id = String(id);
    var el = typeof host === 'string' ? document.getElementById(host) : host;
    if (!el) return Promise.resolve(null);
    STATE[id] = { host: el, chit: null, rounds: [], form: null, busy: false };
    el.setAttribute('data-testid', 'quotes');
    el.innerHTML = '<div class="sec">' + E(T('Rounds')) + '</div><div style="color:var(--grey);font-size:var(--fs-2)">' + E(T('Reading…')) + '</div>';
    return load(id)
      .then(function () {
        paint(id);
        return STATE[id];
      })
      .catch(function (e) {
        if (root.console) console.warn('quotes: could not read the rounds', e && e.message);
        if (STATE[id] && el.isConnected)
          el.innerHTML = '<div class="sec">' + E(T('Rounds')) + '</div><div data-tone="error" data-testid="quotes-error">' + E(T('Could not read the rounds — this does not mean there are none.')) + ' <button type="button" data-testid="quotes-retry" onclick="CBQuotes.mount(this.parentNode.parentNode,\'' + E(id) + '\')">' + E(T('Try again')) + '</button></div>';
        return null;
      });
  }

  /* ── painting ─────────────────────────────────────────────────────────────────────────────────── */
  function roundMoney(r, cur) {
    var m = r.money;
    if (!m) return '';
    var total = m.total != null ? m.total : m.net;
    return '<div data-testid="quote-money-' + r.round + '"><b>' + E(money(total, r.currency_code || cur)) + '</b>' +
      (m.tax != null ? ' <span style="color:var(--grey)">' + E(fill(T('incl. tax {tax}'), { tax: money(m.tax, r.currency_code || cur) })) + '</span>' : '') + '</div>' +
      (r.tax_note ? '<div style="color:var(--grey);font-size:var(--fs-1)">' + E(r.tax_note) + '</div>' : '');
  }
  function lineName(S, idx) {
    var l = (S.chit.lines || [])[idx];
    return l ? l.name : T('Item');
  }
  function roundBody(S, r) {
    var cur = S.chit.currency;
    var out = '';
    if (r.kind === 'request' && r.request && r.request.lines && r.request.lines.length) {
      out += '<ul style="margin:4px 0;padding-inline-start:18px">' + r.request.lines.map(function (l) {
        return '<li>' + E(lineName(S, l.line_index) + (l.quantity != null ? ' × ' + l.quantity : '') + (l.requested_price ? ' · ' + fill(T('asked {price}'), { price: l.requested_price }) : '') + (l.remove ? ' · ' + T('remove') : '')) + '</li>';
      }).join('') + '</ul>';
    } else if (r.kind === 'terms' && r.terms) {
      out += '<div>' + E(Object.keys(r.terms).map(function (k) { return k.replace(/_/g, ' ') + ': ' + r.terms[k]; }).join(' · ')) + '</div>';
    } else {
      out += roundMoney(r, cur);
    }
    if (r.note) out += '<div style="font-style:italic">“' + E(r.note) + '”</div>';
    return out;
  }
  function roundHTML(S, r) {
    var who = r.mine ? T('You') : r.from_name || S.chit.other;
    var label = r.label || KIND[r.kind] || '';
    var st = T(STATUS[r.status] || r.status || '');
    var acts = '';
    if (r.awaiting_me) {
      acts =
        '<div class="cq-acts" style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">' +
        (r.kind !== 'request' ? '<button type="button" class="pri" data-testid="quote-accept-' + r.round + '" data-action-state="idle" onclick="CBQuotes.accept(\'' + E(S.chit.id) + '\',\'' + E(r.proposal_id) + '\',this)">' + E(T('Accept')) + '</button>' : '') +
        '<button type="button" data-testid="quote-counter-' + r.round + '" onclick="CBQuotes.openForm(\'' + E(S.chit.id) + '\',\'' + E(r.proposal_id) + '\')">' + E(S.chit.seller ? T('Price it') : T('Counter')) + '</button>' +
        '<button type="button" class="warn" data-testid="quote-reject-' + r.round + '" onclick="CBQuotes.reject(\'' + E(S.chit.id) + '\',\'' + E(r.proposal_id) + '\',this)">' + E(T('Reject')) + '</button></div>';
    }
    return '<div class="itab" data-testid="quote-round-' + r.round + '" data-status="' + E(r.status) + '" style="padding:9px;margin-top:7px">' +
      '<div style="display:flex;justify-content:space-between;gap:8px"><span><b>' + E(fill(T('Round {n}'), { n: r.round })) + '</b> · ' + E(who) + ' · ' + E(label) + '</span>' +
      '<span data-testid="quote-status-' + r.round + '" style="color:var(--grey)">' + E(st) + '</span></div>' + roundBody(S, r) + acts + '</div>';
  }
  /** the form: the buyer's request (quantity + asked price per line, text) or the seller's price (a price per line) */
  function formHTML(S) {
    var seller = S.chit.seller;
    var rows = (S.chit.lines || []).filter(function (l) { return !l.removed; }).map(function (l) {
      return '<div class="cq-line" style="display:grid;grid-template-columns:minmax(0,1fr) 84px 110px;gap:6px;align-items:center;margin-top:5px">' +
        '<span>' + E(l.name) + '</span>' +
        '<input class="inp" type="text" inputmode="numeric" data-testid="quote-qty-' + l.index + '" data-line="' + l.index + '" data-f="quantity" value="' + E(l.quantity != null ? l.quantity : '') + '" aria-label="' + E(fill(T('Quantity of {name}'), { name: l.name })) + '">' +
        '<input class="inp" type="text" inputmode="text" data-testid="quote-price-' + l.index + '" data-line="' + l.index + '" data-f="' + (seller ? 'price' : 'requested_price') + '" value="' + (seller ? E(l.price != null ? l.price : '') : '') + '" placeholder="' + E(seller ? S.chit.currency || '' : T('price you want')) + '" aria-label="' + E(seller ? fill(T('Price of {name}'), { name: l.name }) : fill(T('Price you want for {name}'), { name: l.name })) + '"></div>';
    }).join('');
    return '<div data-quote-form="1" data-testid="quote-form" class="itab" style="padding:9px;margin-top:8px"><div class="sec" style="margin:0">' + E(seller ? T('Your price') : T('Your counter')) + '</div>' +
      '<div style="color:var(--grey);font-size:var(--fs-1)">' + E(seller ? fill(T('Prices are in {cur}. Tax is worked out for you when you send.'), { cur: S.chit.currency || '' }) : T('Say how many you want and the price you would like. {name} sets the price.').replace('{name}', S.chit.other)) + '</div>' +
      rows +
      '<textarea class="inp" data-testid="quote-note" rows="2" style="width:100%;margin-top:7px" placeholder="' + E(T('A note (optional)')) + '"></textarea>' +
      '<div style="margin-top:7px;display:flex;gap:8px"><button type="button" class="pri" data-testid="quote-send" data-action-state="idle" onclick="CBQuotes.send(\'' + E(S.chit.id) + '\',this)">' + E(seller ? T('Send price') : T('Send counter')) + '</button>' +
      '<button type="button" data-testid="quote-cancel" onclick="CBQuotes.closeForm(\'' + E(S.chit.id) + '\')">' + E(T('Cancel')) + '</button></div>' +
      '<div data-testid="quote-out" role="status" style="margin-top:5px"></div>' + '</div>';
  }
  function html(S) {
    var c = S.chit;
    var words = wordsOf(c, S.rounds);
    var head = '<div class="sec">' + E(T('Rounds')) + '</div>';
    var banner = words.text
      ? '<div data-testid="quote-jurisdiction" data-tone="' + words.tone + '" style="margin:4px 0;padding:7px 9px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2)">' + E(words.text) + '</div>'
      : '';
    var unconf = c.unconfirmed
      ? '<div data-testid="quote-unconfirmed" data-tone="warn" style="margin:4px 0;font-size:var(--fs-2)">⏳ ' + E(c.unconfirmed.words || fill(T('Waiting for {where} — not delivered yet'), { where: (c.jurisdiction && (c.jurisdiction.seller_installation || c.jurisdiction.buyer_installation)) || c.other })) + '</div>'
      : '';
    var list = S.rounds.length
      ? S.rounds.map(function (r) { return roundHTML(S, r); }).join('')
      : '<div data-testid="quote-none" style="color:var(--grey);font-size:var(--fs-2);margin-top:6px">' + E(c.seller ? fill(T('{name} has not priced anything yet — nothing has been asked of you either way.'), { name: c.other }) : fill(T('Waiting for {name} to price your request.'), { name: c.other })) + '</div>';
    var openNew = !S.rounds.length && c.seller
      ? '<button type="button" class="pri" data-testid="quote-price-new" onclick="CBQuotes.openForm(\'' + E(c.id) + '\',\'\')">' + E(T('Price this request')) + '</button>'
      : '';
    var live = S.rounds.some(function (r) { return r.status === 'proposed'; });
    var again = S.rounds.length && !live && !c.seller && S.rounds.some(function (r) { return r.status !== 'accepted'; })
      ? '<button type="button" data-testid="quote-ask-again" onclick="CBQuotes.openForm(\'' + E(c.id) + '\',\'\')">' + E(T('Ask again')) + '</button>' : '';
    return head + banner + unconf + trackerHTML(c, S.rounds) + list + '<div style="margin-top:7px">' + openNew + again + '</div>' + (S.form ? formHTML(S) : '') + '<div data-testid="quote-steps-host" id="quote-steps-' + E(c.id) + '"></div>';
  }

  /* ── doing ────────────────────────────────────────────────────────────────────────────────────── */
  function whereOf(S) {
    var j = S.chit.jurisdiction || {};
    return S.chit.seller ? j.buyer_installation : j.seller_installation;
  }
  function stepsFor(S) {
    return steps(document.getElementById('quote-steps-' + S.chit.id), { name: S.chit.other, where: whereOf(S) });
  }
  /** one write: confirm, the steps, the answer, then the rounds read again */
  function act(id, btn, cfg) {
    var S = STATE[String(id)];
    if (!S) return;
    var ctl = null;
    return root.CBAction.run(
      btn,
      function () {
        S.busy = true;
        ctl = stepsFor(S);
        return call(cfg.key, { params: cfg.params, body: cfg.body }).then(function (v) {
          ctl.sent();
          var held = v && v.ctp && (v.ctp.queued || v.ctp.why);
          if (held) {
            /* the other side did not confirm: say it, never "sent" (silence is the bug) */
            ctl.waiting();
            S.notice = (v.ctp.why) || fill(T('Waiting for {where} — not delivered yet'), { where: whereOf(S) || S.chit.other });
          } else {
            ctl.answered();
            S.notice = null;
          }
          return v;
        });
      },
      {
        key: cfg.tid + ':' + id,
        confirm: cfg.confirm,
        out: S.host.querySelector('[data-testid="quote-out"]') || null,
        done: cfg.done,
        failed: cfg.failed,
        onFail: function (words) {
          if (ctl) ctl.failed(words);
          else if (root.toast) root.toast(words);
        }
      }
    ).then(function (res) {
      S.busy = false;
      if (res && res.ok) {
        S.form = null;
        return load(String(id)).then(function () {
          paint(String(id));
          var host = S.host.querySelector('[data-testid="quote-steps-host"]');
          if (host && S.notice) host.insertAdjacentHTML('beforeend', '<div data-tone="warn" data-testid="quote-notice">⏳ ' + E(S.notice) + '</div>');
          if (typeof root.CBQuotes.onChange === 'function') root.CBQuotes.onChange(id);
        });
      }
    });
  }
  function roundOf(S, pid) {
    return S.rounds.filter(function (r) { return r.proposal_id === pid; })[0] || null;
  }
  function accept(id, pid, btn) {
    var S = STATE[String(id)],
      r = S && roundOf(S, pid);
    if (!r) return;
    var total = r.money ? (r.money.total != null ? r.money.total : r.money.net) : null;
    return act(id, btn, {
      key: 'quoteAccept', tid: 'quote-accept', params: { id: id, pid: pid }, body: {},
      confirm: { title: fill(T('Accept {name}’s price?'), { name: S.chit.other }), body: '<div>' + E(total != null ? fill(T('{amount}, in {cur}. It becomes the pro-forma on both copies.'), { amount: money(total, r.currency_code || S.chit.currency), cur: r.currency_code || S.chit.currency }) : T('It becomes the agreed version on both copies.')) + '</div>', yes: T('Accept'), danger: false },
      done: T('Accepted — this is now the pro-forma')
    });
  }
  function reject(id, pid, btn) {
    var S = STATE[String(id)];
    if (!S) return;
    return act(id, btn, {
      key: 'quoteReject', tid: 'quote-reject', params: { id: id, pid: pid }, body: {},
      confirm: { title: T('Reject this round?'), body: '<div>' + E(fill(T('It ends here and {name} sees it.'), { name: S.chit.other })) + '</div>', yes: T('Reject'), danger: true },
      done: T('Rejected')
    });
  }
  function openForm(id, pid) {
    var S = STATE[String(id)];
    if (!S) return;
    S.form = { pid: pid || '' };
    paint(String(id));
    var first = S.host.querySelector('[data-testid^="quote-price-"], [data-testid^="quote-qty-"]');
    if (first && first.focus) first.focus();
  }
  function closeForm(id) {
    var S = STATE[String(id)];
    if (!S) return;
    S.form = null;
    paint(String(id));
  }
  /** the form's lines, as typed: a text price is kept as typed (the buyer's is never computed on) */
  function readForm(S) {
    var by = {};
    S.host.querySelectorAll('[data-quote-form] input[data-line]').forEach(function (inp) {
      var i = inp.getAttribute('data-line'),
        f = inp.getAttribute('data-f'),
        v = String(inp.value || '').trim();
      by[i] = by[i] || { line_index: Number(i) };
      if (f === 'quantity' && v !== '') by[i].quantity = Number(v);
      else if (f === 'price' && v !== '') by[i].price = Number(v);
      else if (f === 'requested_price' && v !== '') by[i].requested_price = v;
    });
    var note = S.host.querySelector('[data-testid="quote-note"]');
    return { lines: Object.keys(by).map(function (k) { return by[k]; }), note: note ? String(note.value || '').trim() : '' };
  }
  function send(id, btn) {
    var S = STATE[String(id)];
    if (!S || !S.form) return;
    var body = readForm(S),
      out = S.host.querySelector('[data-testid="quote-out"]');
    var bad = body.lines.some(function (l) { return (l.quantity != null && !isFinite(l.quantity)) || (l.price != null && !isFinite(l.price)); });
    if (bad) {
      if (out) { out.textContent = T('A price and a quantity must be numbers.'); out.setAttribute('data-tone', 'error'); }
      return;
    }
    var pid = S.form.pid;
    var seller = S.chit.seller;
    return act(id, btn, {
      key: pid ? 'quoteCounter' : 'quotePropose', tid: 'quote-send', params: pid ? { id: id, pid: pid } : { id: id }, body: body,
      confirm: {
        title: seller ? fill(T('Send your price to {name}?'), { name: S.chit.other }) : fill(T('Send this counter to {name}?'), { name: S.chit.other }),
        body: '<div>' + E(seller ? fill(T('It is a quotation in {cur}. Nothing binds until {name} accepts it.'), { cur: S.chit.currency || '', name: S.chit.other }) : fill(T('{name} sets the price. Nothing binds until you accept it.'), { name: S.chit.other })) + '</div>',
        yes: T('Send'), danger: false
      },
      done: seller ? T('Price sent') : T('Counter sent')
    });
  }

  root.CBQuotes = {
    mount: mount, refresh: refresh, steps: steps, askCross: askCross, crossOf: crossOf, wordsOf: wordsOf,
    accept: accept, reject: reject, openForm: openForm, closeForm: closeForm, send: send, onChange: null, EP: CB_QUOTE_EP
  };
})(typeof window !== 'undefined' ? window : globalThis);
