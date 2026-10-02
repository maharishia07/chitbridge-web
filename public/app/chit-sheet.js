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
 */
(function (root) {
  'use strict';

  var CS = { id: null, chit: null, view: null, busy: false };

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
      lines: live, bj: bj, money: moneyFor(bj, money_, cur), rec: rec
    };
  }
  /* ⭐ WHAT THE CHIT IS FROZEN WITH, in one shape (summary_json.money's names + by_rate · heads · lines): the invoice the
     counter determined, read out by CBTax.moneyOf — else the header's own summary_json.money — else null. A mapping, never a sum. */
  function moneyFor(bj, summaryMoney, cur) {
    if (bj && bj.invoice && root.CBTax && root.CBTax.moneyOf) return root.CBTax.moneyOf(bj.invoice, cur);
    return summaryMoney && Object.keys(summaryMoney).length ? summaryMoney : null;
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
          + '<td class="n">' + E(money(l.price, m.cur)) + '</td><td class="n">' + E(money(f ? f.total : (l.total != null ? l.total : l.net), m.cur)) + '</td></tr>';
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
    var rows = rates.map(function (rt) {
      var v = by[rt] || {}, b = v.taxable != null ? v.taxable : v.base;
      return '<tr data-testid="cs-gst-' + E(rt) + '"><td>' + E(rt) + '%</td><td class="n">' + E(money(b, m.cur)) + '</td><td class="n">' + E(money(inter ? v.igst : v.cgst, m.cur)) + '</td><td class="n">' + (inter ? '' : E(money(v.sgst, m.cur))) + '</td></tr>';
    }).join('');
    var foot = mo.taxable != null
      ? '<tr class="tot"><td></td><td class="n">' + E(money(mo.taxable, m.cur)) + '</td><td class="n">' + E(money(inter ? mo.igst : mo.cgst, m.cur)) + '</td><td class="n">' + (inter ? '' : E(money(mo.sgst, m.cur))) + '</td></tr>' : '';
    return '<div class="cs-sec">' + E(T(inter ? 'IGST summary' : 'GST summary')) + '</div><table class="cs-lines" data-testid="cs-gst"><thead><tr><th>' + E(T('Rate')) + '</th><th class="n">' + E(T('Taxable')) + '</th><th class="n">' + E(T(inter ? 'IGST' : 'CGST')) + '</th><th class="n">' + (inter ? '' : E(T('SGST'))) + '</th></tr></thead><tbody>' + rows + foot + '</tbody></table>';
  }
  function totalHTML(m) {
    var mo = m.money || {}, t = mo.total;
    return (mo.round_off ? '<div class="cs-row cs-mute" data-testid="cs-roundoff"><span>' + E(T('Round off')) + '</span><span>' + E(money(mo.round_off, m.cur)) + '</span></div>' : '')
      + '<div class="cs-row cs-total"><span>' + E(T('Total')) + '</span><b data-testid="cs-total">' + E(t == null ? T('not recorded') : money(t, m.cur)) + '</b></div>';
  }
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

  function paint() {
    var d = document.getElementById('chitsheet'); if (!d) return;
    var m = CS.view, ttl = d.querySelector('[data-testid="cs-title"]');
    if (ttl) ttl.textContent = T(m ? titleFor(m) : 'Bill');
    if (!m) { d.querySelector('.cs-body').innerHTML = CS.err ? '<div class="cs-mute" data-testid="cs-err">' + E(CS.err) + '</div>' : '<div class="cs-mute">' + E(T('Reading…')) + '</div>'; d.querySelector('.cs-acts').innerHTML = ''; return; }
    var head = [T(kindWord(m)), m.no, when(m.at), counterWord(m.counter), m.by].filter(Boolean).map(function (x, i) { return i === 1 ? '<b class="mono" data-testid="cs-no">' + E(x) + '</b>' : E(x); }).join(' · ');
    d.querySelector('.cs-body').innerHTML =
      '<div class="cs-head" data-testid="cs-head">' + head + '</div>'
      + '<div class="cs-who"><span data-testid="cs-who">' + E(m.who) + '</span> <span class="cs-step" data-testid="cs-step">' + E(T(STEP[m.status] || m.status)) + '</span></div>'
      + linesHTML(m) + gstHTML(m) + totalHTML(m) + tenderHTML(m)
      + (CS.note ? '<div class="cs-note" data-testid="cs-note">' + E(CS.note) + '</div>' : '')
      + (CS.useAsk ? '<div class="cs-use" data-testid="cs-use">' + billUseChoiceHTML([m], 'CBSheet.use')
        + '<button type="button" class="optchip" data-testid="cs-use-auto" onclick="CBSheet.use(\'\')">' + E(T('Let my catalogue decide')) + '</button></div>' : '');
    d.querySelector('.cs-acts').innerHTML = actionsFor(m).map(function (k) {
      return '<button type="button" class="cs-act" data-testid="cs-act-' + k + '" onclick="CBSheet.act(\'' + k + '\')"' + (CS.busy ? ' disabled' : '') + ' title="' + E(T(ACT[k][1])) + '"><span class="ic" aria-hidden="true">' + ACT[k][0] + '</span><span>' + E(T(ACT[k][1])) + '</span></button>';
    }).join('');
  }

  var CSS = '#chitsheet{border:0;padding:0;margin:auto;width:min(560px,100vw);max-width:100vw;max-height:92dvh;border-radius:14px;background:var(--card,#fff);color:var(--ink,#0F2E3D);box-shadow:var(--shadow,0 12px 34px rgba(15,46,61,.2));overflow:hidden}'
    + '#chitsheet[open]{display:flex;flex-direction:column}#chitsheet::backdrop{background:rgba(15,46,61,.45)}'
    + '#chitsheet .cs-top{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--line,#E7E2D8);font-size:var(--fs-3,14px);font-weight:700}'
    + '#chitsheet .cs-top button{cursor:pointer;min-width:44px;min-height:44px;border:0;background:none;font-size:var(--fs-4,16px);color:inherit}'
    + '#chitsheet .cs-body{padding:12px 14px;overflow:auto;flex:1;min-height:0;overscroll-behavior:contain;font-size:var(--fs-2,12.5px)}'
    + '#chitsheet .cs-head{font-size:var(--fs-2,12.5px);color:var(--grey,#494F56)}#chitsheet .cs-who{margin:4px 0 10px;font-size:var(--fs-3,14px);font-weight:700}'
    + '#chitsheet .cs-step{margin-inline-start:6px;border:1px solid var(--line,#E7E2D8);border-radius:99px;padding:1px 8px;font-size:var(--fs-1,11px);font-weight:600;color:var(--prog,#7d6126)}'
    + '#chitsheet .cs-lines{width:100%;border-collapse:collapse;margin:4px 0 8px}#chitsheet .cs-lines th{font-size:var(--fs-1,11px);color:var(--grey,#494F56);text-align:start;font-weight:600}'
    + '#chitsheet .cs-lines td,#chitsheet .cs-lines th{padding:4px 3px;border-bottom:1px solid var(--line,#E7E2D8);vertical-align:top}#chitsheet .n,#chitsheet th.n{text-align:end;white-space:nowrap}#chitsheet .tot td{font-weight:700}'
    + '#chitsheet .cs-off{font-size:var(--fs-1,11px);color:var(--ok,#27794c)}#chitsheet .cs-sec{margin:12px 0 4px;font-size:var(--fs-1,11px);font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--grey,#494F56)}'
    + '#chitsheet .cs-row{display:flex;justify-content:space-between;gap:10px;padding:3px 0}#chitsheet .cs-total{font-size:var(--fs-4,16px);border-top:2px solid var(--ink,#0F2E3D);margin-top:8px;padding-top:6px}'
    + '#chitsheet .cs-mute{color:var(--grey,#494F56);font-size:var(--fs-1,11px);margin:6px 0}#chitsheet .cs-note{margin-top:10px;padding:8px 10px;border:1px solid var(--gold-line,#E8D9BC);background:var(--gold-soft,#F7F1E4);border-radius:8px}'
    + '#chitsheet .cs-use .optchip{cursor:pointer;min-height:44px;padding:0 12px;margin:2px 2px 2px 0}'
    + '#chitsheet .cs-acts{display:flex;gap:4px;flex-wrap:wrap;justify-content:space-around;padding:8px 8px calc(8px + env(safe-area-inset-bottom));border-top:1px solid var(--line,#E7E2D8);background:var(--paper,#FAF8F4)}'
    + '#chitsheet .cs-act{cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:68px;min-height:52px;padding:4px 6px;border:0;border-radius:8px;background:none;color:inherit;font-size:var(--fs-1,11px)}'
    + '#chitsheet .cs-act .ic{font-size:20px;line-height:1}#chitsheet .cs-act:disabled{opacity:.5;cursor:default}#chitsheet .cs-act:hover{background:var(--gold-soft,#F7F1E4)}'
    + '@media print{body>*:not(#chitsheet){display:none!important}#chitsheet{position:static;max-height:none;box-shadow:none}#chitsheet .cs-acts,#chitsheet .cs-top button{display:none}}';

  function ensureDlg() {
    var d = document.getElementById('chitsheet'); if (d) return d;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    d = document.createElement('dialog'); d.id = 'chitsheet'; d.setAttribute('aria-label', T('Bill'));
    d.innerHTML = '<div class="cs-top"><span data-testid="cs-title">' + E(T('Bill')) + '</span><button type="button" data-testid="cs-close" aria-label="' + E(T('Close')) + '" onclick="CBSheet.close()">✕</button></div><div class="cs-body"></div><div class="cs-acts" data-testid="cs-acts"></div>';
    d.addEventListener('close', function () { lock(false); CS.id = null; });
    d.addEventListener('click', function (e) { if (e.target === d) CBSheet.close(); });
    document.body.appendChild(d);
    return d;
  }
  /* the page behind does not scroll while the sheet is open — and it is not touched, so closing returns to the same place */
  function lock(on) { try { document.documentElement.style.overflow = on ? 'hidden' : ''; } catch (_) {} }

  async function read(id) {
    var r = await api('chit', { params: { id: id } });
    if (CS.id !== id) return;
    CS.chit = r; CS.view = model(r); CS.err = null; paint();
  }
  async function open(id) {
    if (!id) return;
    var d = ensureDlg(); CS.id = id; CS.chit = null; CS.view = null; CS.err = null; CS.note = null; CS.useAsk = false; CS.busy = false;
    paint(); lock(true);
    if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    try { await read(id); }
    catch (e) { if (CS.id !== id) return; CS.err = (typeof MSG !== 'undefined' && MSG.fail) ? MSG.fail('read this chit', e) : T('Could not read this chit'); paint(); }
  }
  function close() { var d = document.getElementById('chitsheet'); if (d && d.open) d.close(); lock(false); CS.id = null; }

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
    if (k === 'page') { close(); if (typeof openChit === 'function') openChit(id); }
  }

  root.CBSheet = { open: open, close: close, act: act, use: function (u) { return move('act', u); }, actionsFor: actionsFor, model: model, titleFor: titleFor, stepWord: function (m) { return T(STEP[m.status] || m.status); } };
  root.openChitSheet = open;
})(typeof window !== 'undefined' ? window : globalThis);
