/**
 * chit-sheet.js — THE CHIT SHEET: any chit as a popup over the screen you are on.
 *
 * Athi, 2026-10-01: *"the details has to be in a popup, otherwise I couldn't go back at all … cart will not have
 * dispute icon, but the task will have it, so how do we bring those information here."*
 *
 * ── WHAT IT PAINTS ── the bill as the counter prints it: header · lines (qty · price · offer · line total) · the GST
 * summary rate-wise · total · tender · who · the step word. EVERY figure is what the chit was frozen with — and there is
 * NO arithmetic on money in this file (Athi, 2026-10-02: "the final computed values stored and the same has to be seen in
 * every other place, no further computation as the chit is frozen once it become chit"). moneyFor() is the one reader:
 * the frozen `business_json.invoice` read through CBTax.moneyOf; else `summary_json.money`; else nothing — and a figure the
 * chit does not hold is said so ("not recorded on this bill"), never invented.
 *
 * ── WHAT IT OFFERS ── an icon row of ONLY the actions this chit allows in its current step. The rule lives in ONE
 * place — actionsFor() below — never per screen: the Day book, Dues, the Statement and the to-do all call
 * openChitSheet(id) and get the same row. Each icon calls the function the full page already calls for it
 * (the `status` route through statusWordFor, quickDispute, billUse, openChit) and then repaints the sheet.
 * "Open page" is the only way out: it goes where the link went before (openChit).
 *
 * Phone first. The sheet scrolls; the page behind does not move, so closing returns to the same place.
 *
 * ── TWO HOSTS, ONE PAINTER (CRM2, 2026-10-13) ── the same sections also paint FULL-PAGE: CBSheet.mount(el, id) draws them into a
 * page's own element (CB CRM › Chits › crm.html#/chit/<id> — where "Open page" lands, never the workshop). The page form is the popup
 * plus what a popup leaves out: the chit's history (state_log, read as held) and the page note (CBPage, app/page.js); it drops the
 * "Open page" icon (you are on it). M53 (docs/design/chit-detail) asks for exactly this: one module, opened as a popup or a full page.
 */
(function (root) {
  'use strict';

  var CS = { id: null, chit: null, view: null, busy: false, mode: 'dialog', el: null, page: null };

  function E(v) { return typeof esc === 'function' ? esc(v) : String(v == null ? '' : v).replace(/[<>"&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c]; }); }
  function T(s) { return typeof tx === 'function' ? tx(s) : s; }
  function money(n, cur) {
    if (n == null || n === '' || isNaN(Number(n))) return '—';
    try { return fmtMoney(Number(n), cur || 'INR'); } catch (_) { return String(n); }
  }
  function when(ts) {
    if (!ts) return '';
    try { var d = (CBLocale.date(ts, { day: '2-digit', month: 'short' }) || ''), t = (CBLocale.time(ts) || ''); return (d + ' ' + t).trim(); } catch (_) { return String(ts).slice(0, 16); }
  }
  function isSelf(en, name) {
    try { return typeof chitIsSelf === 'function' && chitIsSelf(en, name); } catch (_) { return false; }
  }

  /* ── what the chit read says, in one shape ─────────────────────────────────────────────────────── */
  function model(r) {
    var h = (r && r.header) || r || {}, det = (r && r.detail) || {};
    var bj = h.business_json || {}, sum = h.summary_json || {}, money_ = sum.money || {};
    var rec = h.all_recipients || [];
    var sender = rec.filter(function (x) { return x.role === 'sender'; })[0] || {};
    var senderName = sender.display_name || h.sender_entity_display_name || '';
    var iSent = isSelf(sender.entity_id, senderName);
    var others = rec.filter(function (x) { return x.role !== 'sender' && !isSelf(x.entity_id, x.display_name) && String(x.display_name || '').toLowerCase() !== 'self'; });
    var live = Array.isArray(r && r.live_set) ? r.live_set.filter(function (e) { return e && !e.removed && e.live; }).map(function (e) { return e.live; })
      : (det.line_items || []);
    var purpose = String(h.purpose || '');
    var cur = sum.currency_code || h.currency || 'INR';
    var bill = bj.bill_no || bj.printed_as || null;
    var log = (r && r.state_log) || [];
    var counterBill = !!(bj.till && iSent && !others.length);   /* rung up at a counter and sent to nobody else */
    var billRx = purpose === 'invoice' && !iSent;
    return {
      id: h.chit_id || (r && r.id) || null, status: billRx ? billStepStatus(log) : String(h.current_status || h.status || 'pending'), purpose: purpose, cur: cur,
      iSent: iSent, counterBill: counterBill, billRx: billRx, hasOther: (!iSent) || others.length > 0, hasLines: live.length > 0,
      isTask: !counterBill && !billRx,
      no: bill || h.manual_subject || h.auto_subject || '', at: bj.billed_at || h.created_at,
      counter: counterOfBill(bill, bj.till), by: bj.till && bj.till.by && bj.till.by.name || '',
      who: counterBill ? ((bj.customer && bj.customer.name) || T('Walk-in')) : (billRx ? ((sum.bill_received && sum.bill_received.from) || senderName) : (others.map(function (x) { return x.display_name; }).join(', ') || senderName)),
      lines: live, bj: bj, money: moneyFor(bj, money_, cur, sum), rec: rec, order: orderDetails(sum, purpose)
    };
  }
  /* ⭐ WHAT THE CHIT IS FROZEN WITH, in one shape (summary_json.money's names + by_rate · heads · lines): the invoice the
     counter determined, read out by CBTax.moneyOf — else the header's own summary_json.money — else null. A mapping, never a sum. */
  function moneyFor(bj, summaryMoney, cur, sum) {
    if (bj && bj.invoice && root.CBTax && root.CBTax.moneyOf) return root.CBTax.moneyOf(bj.invoice, cur);
    if (summaryMoney && Object.keys(summaryMoney).length) return summaryMoney;
    /* O7: an ORDER is not billed yet - the figure it was placed with is the header's own total_value (the same one the Chits list shows), read, never worked out */
    var tv = sum && sum.total_value != null ? sum.total_value : (sum && sum.indicative_total != null ? sum.indicative_total : null);
    return tv != null && !isNaN(Number(tv)) ? { total: Number(tv) } : null;
  }
  /* O8: what the customer typed at the online shop - the delivery address, the time asked for, the remark - read from summary_json.order_details (older orders keep only the coarse area) */
  function orderDetails(sum, purpose) {
    if (purpose !== 'order') return null;
    var d = sum && sum.order_details || null, rd = d && d.requested_delivery || null;
    var o = { online: !!(d && d.channel === 'online'), fulfilment: d && d.fulfilment || '', address: (d && d.address) || (sum && sum.customer_locality) || '',
      when: rd ? [rd.date, rd.time].filter(Boolean).join(' ') : '', remark: (d && d.remark) || '' };
    return (o.online || o.address || o.when || o.remark) ? o : null;
  }
  function orderHTML(m) {
    var o = m.order; if (!o) return '';
    var rows = [];
    if (o.address) rows.push([o.fulfilment === 'pickup' ? 'Pick up' : 'Deliver to', o.address, 'cs-order-address']);
    if (o.when) rows.push(['Asked for', o.when, 'cs-order-when']);
    if (o.remark) rows.push(['Remark', o.remark, 'cs-order-remark']);
    return '<div class="cs-order" data-testid="cs-order">' + (o.online ? '<div class="cs-online" data-testid="cs-order-online">🌐 ' + E(T('Online order')) + (o.fulfilment === 'delivery' ? ' · ' + E(T('Delivery')) : '') + '</div>' : '')
      + rows.map(function (r) { return '<div class="cs-row"><span>' + E(T(r[0])) + '</span><b data-testid="' + r[2] + '">' + E(r[1]) + '</b></div>'; }).join('') + '</div>';
  }
  /* ⭐ A BILL I RECEIVED has its own step per shop: since the API's "bills-private" it is a `bill_step` row in the chit's
     state_log (code B-2100, step 'accepted', mine:true) — NOT the shared status, which is the seller's. The latest of mine wins. */
  function billStepStatus(log) {
    var mine = (log || []).filter(function (x) { return x && x.action === 'bill_step' && x.mine && (!x.code || x.code === 'B-2100'); });
    var step = mine.length ? mine[mine.length - 1].step : '';
    return step === 'accepted' ? 'accepted' : step === 'closed' ? 'completed' : 'pending';
  }

  /* ── THE ONE RULE for which icons a chit gets in its step. Not hard-coded per screen. ───────────────
     counter bill (mine, done)     Print · Return · Open page
     bill I received, not accepted Accept · Dispute · Goods in · Open page
     bill I received, accepted     Dispute · Open page
     task / order, not started     Accept · Dispute · Open page
     task / order, in hand         Dispute · Done · Open page
     closed (cancelled/rejected/completed) → only what still makes sense: Print (counter) · Open page */
  function actionsFor(m) {
    var s = m.status, open = /^(pending|delivered|read)$/.test(s), live = /^(accepted|in_progress|partial)$/.test(s), dead = /^(cancelled|rejected)$/.test(s);
    var a = [];
    if (m.counterBill) { a.push('print'); if (!dead) a.push('return'); }
    else if (m.billRx) {
      if (open) { a.push('accept'); a.push('dispute'); a.push('goodsin'); }
      else if (!dead) a.push('dispute');
    } else {
      if (open) a.push('accept');
      if (!dead && m.hasOther) a.push('dispute');
      if (live) a.push('done');
    }
    a.push('page');
    return a;
  }
  var ACT = {
    accept: ['✓', 'Accept'], dispute: ['⚑', 'Dispute'], goodsin: ['📥', 'Goods in'], done: ['✔', 'Done'],
    print: ['🖨', 'Print'], 'return': ['↩', 'Return'], page: ['↗', 'Open page']
  };

  /* ── the paint ───────────────────────────────────────────────────────────────────────────────────── */
  /* a line's own frozen total; an unbilled ORDER line that carries only price and quantity is shown as placed (price x quantity, rounded to the paisa) */
  function lineTotal(l, m) {
    var t = l.total != null ? l.total : (l.net != null ? l.net : (l.line_total != null ? l.line_total : l.amount));
    if (t == null && m.purpose === 'order' && l.price != null && !isNaN(Number(l.price))) { var q = Number(l.quantity != null ? l.quantity : (l.qty != null ? l.qty : 1)); if (!isNaN(q) && root.CBMoney && root.CBMoney.round) t = root.CBMoney.round(Number(l.price) * q); }   /* the one money engine rounds; without it, no figure rather than a hand-rounded one */
    return t;
  }
  function linesHTML(m) {
    if (!m.lines.length) return '<div class="cs-mute">' + E(T('No lines on this chit')) + '</div>';
    var ml = (m.money && m.money.lines) || [];
    return '<table class="cs-lines"><thead><tr><th>' + E(T('Item')) + '</th><th class="n">' + E(T('Qty')) + '</th><th class="n">' + E(T('Price')) + '</th><th class="n">' + E(T('Total')) + '</th></tr></thead><tbody>'
      + m.lines.map(function (l, i) {
        var f = ml[i], offs = (l.offers && l.offers.length) ? l.offers : (l.offer ? [{ label: l.offer.label, off: l.offer.off }] : []);
        /* a frozen invoice line says what it took off; one offer on the line wears that figure, several keep their own recorded amounts */
        if (f && offs.length === 1) offs = f.discount > 0 ? [{ label: offs[0].label, off: f.discount }] : [];
        return '<tr data-testid="cs-line-' + i + '"><td>' + E(l.particulars || l.name || '') + offs.map(function (o) {
          return '<div class="cs-off" data-testid="cs-offer-' + i + '">' + E(o.label || T('Offer')) + ' −' + E(money(o.off, m.cur)) + '</div>'; }).join('') + '</td>'
          + '<td class="n">' + E(l.quantity != null ? l.quantity : (l.qty != null ? l.qty : '')) + (l.unit && l.unit !== 'piece' ? ' ' + E(l.unit) : '') + '</td>'
          + '<td class="n">' + E(money(l.price, m.cur)) + '</td><td class="n">' + E(money(f ? f.total : lineTotal(l, m), m.cur)) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  /* the GST summary as the counter prints it (till.html taxSummaryHTML is the reference shape): the frozen by_rate, as it is held.
     A head the chit does not hold is "—", never worked out; the footing row is the chit's own totals, never a column sum. */
  function gstHTML(m) {
    var mo = m.money || {}, by = mo.by_rate || null;
    var rates = by ? Object.keys(by).sort(function (a, b) { return Number(a) - Number(b); }) : [];
    if (!rates.length) {
      return '<div class="cs-sec">' + E(T('GST')) + '</div>' + (mo.tax != null
        ? '<div class="cs-row"><span>' + E(T('GST total')) + '</span><b data-testid="cs-gst-total">' + E(money(mo.tax, m.cur)) + '</b></div>'
        : '<div class="cs-mute" data-testid="cs-gst-none">' + E(T('Rate-wise GST is not recorded on this bill')) + '</div>');
    }
    var inter = (mo.supply || m.bj.supply) === 'inter';
    /* ⭐ CX0: a ONE-HEAD scheme (supply 'domestic' — the border decided: GST in Australia, VAT in the UAE) has one tax column named by its head
       (by_rate[rate].gst · .vat — the pack's taxHeads), never a CGST/SGST grid of 0.00 with the tax nowhere. Same shape as the counter's slip. */
    if ((mo.supply || m.bj.supply) === 'domestic') {
      var head = Object.keys(by[rates[0]] || {}).filter(function (k) { return ['taxable', 'base', 'rate', 'tax', 'cess', 'cgst', 'sgst', 'igst'].indexOf(k) < 0; })[0];
      var hw = head ? head.toUpperCase() : T('Tax');
      var rows1 = rates.map(function (rt) { var v = by[rt] || {}, b = v.taxable != null ? v.taxable : v.base, tv = head && v[head] != null ? v[head] : v.tax;
        return '<tr data-testid="cs-gst-' + E(rt) + '"><td>' + E(rt) + '%</td><td class="n">' + E(money(b, m.cur)) + '</td><td class="n">' + E(money(tv, m.cur)) + '</td></tr>'; }).join('');
      var foot1 = mo.taxable != null ? '<tr class="tot"><td></td><td class="n">' + E(money(mo.taxable, m.cur)) + '</td><td class="n">' + E(money(mo.tax, m.cur)) + '</td></tr>' : '';
      return '<div class="cs-sec">' + E(hw + ' ' + T('summary')) + '</div><table class="cs-lines" data-testid="cs-gst"><thead><tr><th>' + E(T('Rate')) + '</th><th class="n">' + E(T('Taxable')) + '</th><th class="n">' + E(hw) + '</th></tr></thead><tbody>' + rows1 + foot1 + '</tbody></table>';
    }
    var rows = rates.map(function (rt) {
      var v = by[rt] || {}, b = v.taxable != null ? v.taxable : v.base;
      return '<tr data-testid="cs-gst-' + E(rt) + '"><td>' + E(rt) + '%</td><td class="n">' + E(money(b, m.cur)) + '</td><td class="n">' + E(money(inter ? v.igst : v.cgst, m.cur)) + '</td><td class="n">' + (inter ? '' : E(money(v.sgst, m.cur))) + '</td></tr>';
    }).join('');
    var foot = mo.taxable != null
      ? '<tr class="tot"><td></td><td class="n">' + E(money(mo.taxable, m.cur)) + '</td><td class="n">' + E(money(inter ? mo.igst : mo.cgst, m.cur)) + '</td><td class="n">' + (inter ? '' : E(money(mo.sgst, m.cur))) + '</td></tr>' : '';
    return '<div class="cs-sec">' + E(T(inter ? 'IGST summary' : 'GST summary')) + '</div><table class="cs-lines" data-testid="cs-gst"><thead><tr><th>' + E(T('Rate')) + '</th><th class="n">' + E(T('Taxable')) + '</th><th class="n">' + E(T(inter ? 'IGST' : 'CGST')) + '</th><th class="n">' + (inter ? '' : E(T('SGST'))) + '</th></tr></thead><tbody>' + rows + foot + '</tbody></table>';
  }
  function totalHTML(m, tid) {
    var mo = m.money || {}, t = mo.total;
    return (mo.round_off ? '<div class="cs-row cs-mute" data-testid="cs-roundoff"><span>' + E(T('Round off')) + '</span><span>' + E(money(mo.round_off, m.cur)) + '</span></div>' : '')
      + '<div class="cs-row cs-total"><span>' + E(T('Total')) + '</span><b data-testid="' + E(tid || 'cs-total') + '">' + E(t == null ? T('not recorded') : money(t, m.cur)) + '</b></div>';
  }
  /* the frozen money as the sheet prints it, for any other screen that shows an issued chit (the Task detail): GST rate-wise, round-off, total.
     m = { money: moneyFor(...), cur, bj } — the same painters the popup uses, never a second one. */
  function moneyBlockHTML(m, totalTestid) { return gstHTML(m) + totalHTML(m, totalTestid); }
  var HOW = { cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'On credit', cheque: 'Cheque', points: 'Points' };
  function tenderHTML(m) {
    var p = m.bj.payment; if (!p) return '';
    var parts = (p.parts && p.parts.length) ? p.parts : (p.mode ? [{ how: p.mode, amount: p.paid }] : []);
    if (!parts.length) return '';
    return '<div class="cs-sec">' + E(T('Paid by')) + '</div>' + parts.map(function (x, i) {
      var k = String(x.how || '').toLowerCase();
      return '<div class="cs-row" data-testid="cs-tender-' + i + '"><span>' + E(T(HOW[k] || x.how || '')) + '</span><b>' + E(money(x.amount, m.cur)) + '</b></div>';
    }).join('') + (p.change > 0 ? '<div class="cs-row cs-mute" data-testid="cs-change"><span>' + E(T('Change')) + '</span><span>' + E(money(p.change, m.cur)) + '</span></div>' : '');
  }
  var STEP = { pending: 'To accept', delivered: 'To accept', read: 'To accept', accepted: 'Accepted', in_progress: 'In hand', partial: 'Part done', completed: 'Done', cancelled: 'Cancelled', rejected: 'Rejected' };
  /* the sheet's title is the document: a counter bill is "Bill", a bill received "Supplier bill", the rest the purpose word — never "Chit" */
  var TITLE = { order: 'Order', invoice: 'Invoice', general: 'Task', task: 'Task', quote: 'Quote', payment: 'Payment', receipt: 'Receipt', dispute: 'Dispute', request: 'Request', delivery: 'Delivery' };
  function titleFor(m) {
    if (m.counterBill) return 'Bill';
    if (m.billRx) return 'Supplier bill';
    return TITLE[m.purpose] || (m.purpose ? m.purpose.charAt(0).toUpperCase() + m.purpose.slice(1).replace(/_/g, ' ') : 'Task');
  }
  function kindWord(m) { return m.counterBill ? 'Counter bill' : (m.billRx ? 'Supplier bill' : 'Task'); }

  /* R10 - the rail units where the person already is. "Messages and files" is the chit's thread (CBThread, R02) and the picker (CBAttach, R07),
     each mounted with ITS OWN api: the units decide who may post (the engine's `chit.actions`, a refusal with its `why`); this file decides nothing.
     The host is built once per chit and moved into each repaint, so a busy repaint does not remount the unit or lose what was typed. */
  function railMount(d, m) {
    var body = d.querySelector('.cs-body'), id = m.id || CS.id;
    if (!body || !id || (typeof CBThread === 'undefined' && typeof CBAttach === 'undefined')) return;
    if (!CS.rail || CS.rail.id !== id) {
      var el = document.createElement('div'); el.setAttribute('data-testid', 'cs-rail');
      el.innerHTML = '<div class="cs-sec">' + E(T('Messages and files')) + '</div><div data-testid="cs-rail-attach"></div><div data-testid="cs-rail-thread"></div>';
      CS.rail = { id: id, el: el };
      var ch = CS.chit || {}, who = (typeof SESS !== 'undefined' && SESS) || (typeof SESSION !== 'undefined' && SESSION) || {};
      if (typeof CBAttach !== 'undefined') CBAttach.mount(el.querySelector('[data-testid="cs-rail-attach"]'), { chit_id: id, label: T('Attach a file') });
      if (typeof CBThread !== 'undefined') CBThread.mount(el.querySelector('[data-testid="cs-rail-thread"]'), {
        chit_id: id, actions: ch.actions || undefined, party: m.who || '', me: who.entity || who.name || '',
        channel: 'both', thread_type: 'external', context: { host: 'chit-sheet' } });
    }
    body.appendChild(CS.rail.el);
  }

  /* the page form only: the chit's history as the state_log holds it — when · what · who. Read, never worked out; the step words are the sheet's own. */
  var LOGWORD = { created: 'Created', delivered: 'Delivered', message_sent: 'Message sent', amended: 'Amended', bill_step: 'Step', assigned: 'Assigned', dispute_opened: 'Disputed', dispute_resolved: 'Dispute closed' };
  function historyHTML() {
    var log = (CS.chit && CS.chit.state_log) || [];
    if (!log.length) return '';
    return '<div class="cs-sec">' + E(T('History')) + '</div>' + log.map(function (e, i) {
      var a = String(e.action || ''), w = LOGWORD[a] || (a.indexOf('status_') === 0 ? (STEP[a.slice(7)] || a.slice(7)) : (e.new_status ? (STEP[e.new_status] || e.new_status) : (a || 'Event')));
      return '<div class="cs-row cs-hist" data-testid="cs-hist-' + i + '"><span>' + E(when(e.created_at || e.at)) + ' · ' + E(T(w)) + '</span><b>' + E(e.action_by_display_name || e.by_name || '') + '</b></div>';
    }).join('');
  }
  function pageNoteHTML() {
    try { return (CS.mode === 'page' && root.CBPage && CS.chit) ? root.CBPage.noteHTML((CS.chit.header || {}).business_json) : ''; } catch (_) { return ''; }
  }
  function host() { return CS.el && document.body.contains(CS.el) ? CS.el : null; }

  function paint() {
    var d = host(); if (!d) return;
    var m = CS.view, ttl = d.querySelector('[data-testid="cs-title"]');
    if (ttl) ttl.textContent = T(m ? titleFor(m) : 'Bill');
    if (!m) { d.querySelector('.cs-body').innerHTML = CS.err ? '<div class="cs-mute" data-testid="cs-err">' + E(CS.err) + '</div>' : '<div class="cs-mute">' + E(T('Reading…')) + '</div>'; d.querySelector('.cs-acts').innerHTML = ''; return; }
    var head = [T(kindWord(m)), m.no, when(m.at), counterWord(m.counter), m.by].filter(Boolean).map(function (x, i) { return i === 1 ? '<b class="mono" data-testid="cs-no">' + E(x) + '</b>' : E(x); }).join(' · ');
    d.querySelector('.cs-body').innerHTML =
      '<div class="cs-head" data-testid="cs-head">' + head + '</div>'
      + '<div class="cs-who"><span data-testid="cs-who">' + E(m.who) + '</span> <span class="cs-step" data-testid="cs-step">' + E(T(STEP[m.status] || m.status)) + '</span></div>'
      + pageNoteHTML()
      + orderHTML(m) + linesHTML(m) + (m.purpose === 'order' && !(m.money && m.money.by_rate) ? '' : gstHTML(m)) + totalHTML(m) + tenderHTML(m)
      + (CS.note ? '<div class="cs-note" data-testid="cs-note">' + E(CS.note) + '</div>' : '')
      + (CS.useAsk ? '<div class="cs-use" data-testid="cs-use">' + billUseChoiceHTML([m], 'CBSheet.use')
        + '<button type="button" class="optchip" data-testid="cs-use-auto" onclick="CBSheet.use(\'\')">' + E(T('Let my catalogue decide')) + '</button></div>' : '')
      + (CS.mode === 'page' ? historyHTML() : '');
    railMount(d, m);
    /* the page form has no "Open page": the person is on it */
    d.querySelector('.cs-acts').innerHTML = actionsFor(m).filter(function (k) { return !(CS.mode === 'page' && k === 'page'); }).map(function (k) {
      return '<button type="button" class="cs-act" data-testid="cs-act-' + k + '" onclick="CBSheet.act(\'' + k + '\')"' + (CS.busy ? ' disabled' : '') + ' title="' + E(T(ACT[k][1])) + '"><span class="ic" aria-hidden="true">' + ACT[k][0] + '</span><span>' + E(T(ACT[k][1])) + '</span></button>';
    }).join('');
  }

  var CSS = '#chitsheet{border:0;padding:0;margin:auto;width:min(560px,100vw);max-width:100vw;max-height:92dvh;border-radius:14px;background:var(--card,#fff);color:var(--ink,#0F2E3D);box-shadow:var(--shadow,0 12px 34px rgba(15,46,61,.2));overflow:hidden}'
    + '#chitsheet[open]{display:flex;flex-direction:column}#chitsheet::backdrop{background:rgba(15,46,61,.45)}'
    + '.cs .cs-top{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--line,#E7E2D8);font-size:var(--fs-3,14px);font-weight:700}'
    + '.cs .cs-top button{cursor:pointer;min-width:44px;min-height:44px;border:0;background:none;font-size:var(--fs-4,16px);color:inherit}'
    + '.cs .cs-body{padding:12px 14px;overflow:auto;flex:1;min-height:0;overscroll-behavior:contain;font-size:var(--fs-2,12.5px)}'
    + '.cs .cs-head{font-size:var(--fs-2,12.5px);color:var(--grey,#494F56)}.cs .cs-who{margin:4px 0 10px;font-size:var(--fs-3,14px);font-weight:700}'
    + '.cs .cs-step{margin-inline-start:6px;border:1px solid var(--line,#E7E2D8);border-radius:99px;padding:1px 8px;font-size:var(--fs-1,11px);font-weight:600;color:var(--prog,#7d6126)}'
    + '.cs .cs-lines{width:100%;border-collapse:collapse;margin:4px 0 8px}.cs .cs-lines th{font-size:var(--fs-1,11px);color:var(--grey,#494F56);text-align:start;font-weight:600}'
    + '.cs .cs-lines td,.cs .cs-lines th{padding:4px 3px;border-bottom:1px solid var(--line,#E7E2D8);vertical-align:top}.cs .n,.cs th.n{text-align:end;white-space:nowrap}.cs .tot td{font-weight:700}'
    + '.cs .cs-off{font-size:var(--fs-1,11px);color:var(--ok,#27794c)}.cs .cs-sec{margin:12px 0 4px;font-size:var(--fs-1,11px);font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--grey,#494F56)}'
    + '.cs .cs-row{display:flex;justify-content:space-between;gap:10px;padding:3px 0}.cs .cs-total{font-size:var(--fs-4,16px);border-top:2px solid var(--ink,#0F2E3D);margin-top:8px;padding-top:6px}'
    + '.cs .cs-order{margin:0 0 10px;padding:8px 10px;border:1px solid var(--gold-line,#E8D9BC);background:var(--gold-soft,#F7F1E4);border-radius:8px}.cs .cs-online{font-weight:700;margin-bottom:4px}.cs .cs-mute{color:var(--grey,#494F56);font-size:var(--fs-1,11px);margin:6px 0}.cs .cs-note{margin-top:10px;padding:8px 10px;border:1px solid var(--gold-line,#E8D9BC);background:var(--gold-soft,#F7F1E4);border-radius:8px}'
    + '.cs .cs-use .optchip{cursor:pointer;min-height:44px;padding:0 12px;margin:2px 2px 2px 0}'
    + '.cs .cs-acts{display:flex;gap:4px;flex-wrap:wrap;justify-content:space-around;padding:8px 8px calc(8px + env(safe-area-inset-bottom));border-top:1px solid var(--line,#E7E2D8);background:var(--paper,#FAF8F4)}'
    + '.cs .cs-act{cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:68px;min-height:52px;padding:4px 6px;border:0;border-radius:8px;background:none;color:inherit;font-size:var(--fs-1,11px)}'
    + '.cs .cs-act .ic{font-size:20px;line-height:1}.cs .cs-act:disabled{opacity:.5;cursor:default}.cs .cs-act:hover{background:var(--gold-soft,#F7F1E4)}'
    /* print: while the POPUP is open the rest of the page hides; the page form prints as its page, the action row hidden either way */
    + '@media print{body.cs-open>*:not(#chitsheet){display:none!important}#chitsheet{position:static;max-height:none;box-shadow:none}.cs .cs-acts,.cs .cs-top button{display:none}}'
    /* the page form (CBSheet.mount): the same sections full-width in a page's own element; the title row and the action row are the popup's, without a close button */
    + '.cs-page{display:flex;flex-direction:column;border:1px solid var(--line,#E7E2D8);border-radius:14px;background:var(--card,var(--surface,#fff));color:var(--ink,#0F2E3D);max-width:100%;overflow:hidden}'
    + '.cs-page .cs-body{overflow:visible}.cs-page .cs-lines{table-layout:fixed}.cs-page .cs-lines td{overflow-wrap:anywhere}.cs-page .cs-hist span{color:var(--grey,#494F56)}.cs-page .cs-hist b{text-align:end;overflow-wrap:anywhere}';

  function ensureCSS() { if (document.getElementById('cs-css')) return; var st = document.createElement('style'); st.id = 'cs-css'; st.textContent = CSS; document.head.appendChild(st); }
  function ensureDlg() {
    var d = document.getElementById('chitsheet'); if (d) return d;
    ensureCSS();
    d = document.createElement('dialog'); d.id = 'chitsheet'; d.className = 'cs'; d.setAttribute('aria-label', T('Bill'));
    d.innerHTML = '<div class="cs-top"><span data-testid="cs-title">' + E(T('Bill')) + '</span><button type="button" data-testid="cs-close" aria-label="' + E(T('Close')) + '" onclick="CBSheet.close()">✕</button></div><div class="cs-body"></div><div class="cs-acts" data-testid="cs-acts"></div>';
    /* R10-4: a close event is queued; if a new chit was opened meanwhile the sheet is open again and that late event must not wipe it (the read would be dropped and the sheet stay on Reading) */
    d.addEventListener('close', function () { if (d.open) return; lock(false); if (CS.mode === 'dialog') CS.id = null; });
    d.addEventListener('click', function (e) { if (e.target === d) CBSheet.close(); });
    document.body.appendChild(d);
    return d;
  }
  /* the page behind does not scroll while the sheet is open — and it is not touched, so closing returns to the same place */
  function lock(on) { try { document.documentElement.style.overflow = on ? 'hidden' : ''; document.body.classList.toggle('cs-open', !!on); } catch (_) {} }
  function reset(id) { CS.id = id; CS.rail = null; CS.chit = null; CS.view = null; CS.err = null; CS.note = null; CS.useAsk = false; CS.busy = false; }
  function readSaid(e) { return (typeof MSG !== 'undefined' && MSG.fail) ? MSG.fail('read this chit', e) : T('Could not read this chit'); }

  /* ── THE PAGE FORM: the same sections, full-width, in a page's own element (CB CRM › crm.html#/chit/<id>) ─────────────────── */
  async function mount(el, id) {
    if (!el || !id) return;
    ensureCSS();
    el.classList.add('cs', 'cs-page'); el.setAttribute('data-testid', 'cs-page');
    el.innerHTML = '<div class="cs-top"><span data-testid="cs-title">' + E(T('Bill')) + '</span></div><div class="cs-body"></div><div class="cs-acts" data-testid="cs-acts"></div>';
    CS.mode = 'page'; CS.el = el; CS.page = { el: el, id: id }; reset(id);
    paint();
    try { await read(id); }
    catch (e) { if (CS.id !== id || CS.el !== el) return; CS.err = readSaid(e); paint(); }
  }

  async function read(id) {
    var r = await api('chit', { params: { id: id } });
    if (CS.id !== id) return;
    CS.chit = r; CS.view = model(r); CS.err = null; paint();
  }
  async function open(id) {
    if (!id) return;
    var d = ensureDlg(); CS.mode = 'dialog'; CS.el = d; reset(id);
    paint(); lock(true);
    if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    try { await read(id); }
    catch (e) { if (CS.id !== id) return; CS.err = readSaid(e); paint(); }
  }
  /* closing the popup hands the painter back to a page form still on screen (it re-reads: the popup may have moved the chit) */
  function close() {
    var d = document.getElementById('chitsheet'); if (d && d.open) d.close(); lock(false); CS.id = null;
    var pg = CS.page; CS.page = null;
    if (pg && document.body.contains(pg.el)) mount(pg.el, pg.id);
  }

  /* the same move the full page makes: `status` through statusWordFor — then the sheet re-reads and repaints */
  async function move(to, use) {
    var m = CS.view, id = CS.id; if (!m || CS.busy) return;
    CS.busy = true; CS.note = null; CS.useAsk = false; paint();
    try {
      if (use && to === 'act' && m.billRx) await api('billUse', { params: { id: id }, body: { use: use } });
      var word = typeof statusWordFor === 'function' ? statusWordFor(to, { billRx: m.billRx }) : ({ open: 'pending', act: m.billRx ? 'accepted' : 'in_progress', close: 'completed' })[to];
      var sr = await api('status', { params: { id: id }, body: { status: word } });
      if (sr && sr.warning && typeof toast === 'function') toast(sr.warning);
      try { var i = (UI.rows || []).findIndex(function (x) { return x.id === id; }); if (i >= 0) UI.rows[i].state = to; } catch (_) {}
      await read(id);
      /* the Day book's to-do and Waiting count are the server's: read them again, and repaint the tab that is showing them */
      try { if (typeof bkHealthLoad === 'function') bkHealthLoad().then(function () { if (typeof BK !== 'undefined' && BK.tab && typeof bkTab === 'function') bkTab(BK.tab, true); }).catch(function () {}); } catch (_) {}
    } catch (e) { CS.note = (typeof MSG !== 'undefined' && MSG.fail) ? MSG.fail('change status', e) : T('Could not change it'); }
    CS.busy = false; paint();
  }

  function act(k) {
    var m = CS.view, id = CS.id; if (!m) return;
    if (actionsFor(m).indexOf(k) < 0) return;   /* a stale tap on an action this step no longer allows */
    /* a bill received asks what the goods are for BEFORE the acceptance it decides (the same choice Goods in shows) — a task just moves */
    if (k === 'accept') { if (m.billRx) { CS.useAsk = true; CS.note = null; return paint(); } return move('act'); }
    if (k === 'done') return move('close');
    if (k === 'goodsin') { CS.useAsk = true; CS.note = null; return paint(); }
    if (k === 'print') { try { window.print(); } catch (_) {} return; }
    if (k === 'return') { CS.note = T('Returns are made at the counter, against the bill.'); return paint(); }
    if (k === 'dispute') {
      /* the full page's own dispute form; it opens over the app (not over the sheet), and puts the sheet back when it is raised */
      close();
      if (typeof quickDispute === 'function') quickDispute(id, { back: true });
      return;
    }
    if (k === 'page') { close(); var pg = typeof openChitPage === 'function' ? openChitPage : openChit; if (typeof pg === 'function') pg(id); }
  }

  root.CBSheet = { orderHTML: orderHTML, moneyFor: moneyFor, moneyBlockHTML: moneyBlockHTML, open: open, close: close, mount: mount, act: act, use: function (u) { return move('act', u); }, actionsFor: actionsFor, model: model, titleFor: titleFor, stepWord: function (m) { return T(STEP[m.status] || m.status); } };
  root.openChitSheet = open;
})(typeof window !== 'undefined' ? window : globalThis);
