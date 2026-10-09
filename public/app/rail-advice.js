/* rail-advice.js — CBAdvice.mount: the payment ADVICE, OUT — send it to a party on the rail, share it with one who is not (M30, 2026-10-09).
 *
 * SPEC-payments-2026-10-05 §3 · §4.3 · §5; DESIGN-rail-modules §2.1 (CBAdvice); FIT-shell Supplier line: *the payer settles its own books
 * and informs; the payer never sees the payee's books.* M31 (the payee's Accept / Dispute) is the next row — this unit only SENDS.
 *
 * ⚠️ THE API DECIDES, THIS FILE PAINTS (routes/books.js M30):
 *   GET   /api/books/payments/:id/advice → { party: { party_id, name, on_rail }, advice: { chit_id, state, shared_at },
 *                                             may: { send_advice, share_advice }, words, body, share: { text, wa, mailto } }
 *   POST  /api/chits/send   with `body`  → { chit_id }           (client_ref 'advice:pay:<id>' — a retry answers the first chit)
 *   PATCH /api/books/payments/:id { advice_chit_id } | { advice_shared_at: true } → { ok, advice: { chit_id, state, shared_at } }
 *   The same block rides on POST /api/books/payments as `advice`, so the outcome panel mounts without a second read.
 *
 * ⭐ SHOW EVERY ACTION, ENABLE BY ROLE (owner, 2026-10-09): "Send advice" and "Share" are ALWAYS painted; whether THIS login may press
 *   each is the server's `may.*` answer — a refused one is greyed WITH its sentence (`say`), never hidden, never decided here. The
 *   server refuses the same way (403 / 409 with `why`), and a refusal is said in the server's words, never a thrown error's text.
 * ⭐ Every press goes through CBAction (M64): busy · one press one write · the outcome said under the buttons. Amounts never appear
 *   here except inside the server's `words` (the M36 money unit composed them server-side: bill-privacy.money).
 * ⭐ One DOM event `cb:rail` { module: 'advice', payment_id, result: { chit_id, state, shared_at } } on the host, so the statement row
 *   repaints its chip locally (feedback-repaint-locally).
 *
 *   CBAdvice.mount(el, {
 *     payment_id,                    // the subject (required)
 *     advice?,                       // the block POST /payments answered (no read then); absent → GET /payments/:id/advice
 *     party?,                        // the other party's name for the outcome line (the block's party.name wins)
 *     context: { host, source? },    // who mounted it (rides on cb:rail)
 *     onDone(result, opts), onCancel()
 *   }) → { refresh(), destroy(), state(), el }
 *   CBAdvice.STATE_WORDS — the chip words per state (a host paints the same words on its row)
 *
 * Reuse: CBAction (accounts-shell.js) · api/EP (core.js) · tx (accounts-shell.js) · CBLocale (the shared-at moment). ZERO app.html globals.
 */
(function (root) {
'use strict';
var doc = root.document;

/* ── the routes, ONE name each (e2e/ep-aliases.cjs). The chit send keeps app.html's name `createChit`; a page without that row gets it
   at mount, by assignment (not a second registration) — the attach-ui.js / rail-thread.js pattern. ── */
var CB_ADVICE_EP = {
  booksPayAdvice: { m: 'GET',   p: '/api/books/payments/:id/advice' },   // the read: party · may · words · body · share
  booksPayPatch:  { m: 'PATCH', p: '/api/books/payments/:id' },          // the merge-patch: advice_chit_id | advice_shared_at
};
root.CB_ADVICE_EP = CB_ADVICE_EP;
function ensureEP() {
  if (typeof EP === 'undefined' || !EP) return false;
  for (var k in CB_ADVICE_EP) if (!EP[k]) EP[k] = CB_ADVICE_EP[k];
  if (!EP.createChit) EP.createChit = { m: 'POST', p: '/api/chits/send', ok: '✓' };
  return true;
}

/* ── the words, one place (copy budget: a label, a verb, a sentence) ── */
var W = {
  send: 'Send advice', again: 'Send again', sending: 'Sending…', share: 'Share', copy: 'Copy', wa: 'WhatsApp', mail: 'E-mail',
  sent: 'Advice sent to {party} ✓', notSent: 'Advice not sent — Send again', shared: 'Advice shared ✓', copied: 'Copied — paste it to {party}',
  reading: 'Reading…', readFail: 'Could not read the advice — try again',
};
var STATE_WORDS = { none: '', sent: '✉ advice sent', delivered: '✉ advice sent · delivered', shared: '↗ advice shared', disputed: '⚑ advice disputed' };
function T(s) { return typeof tx === 'function' ? tx(s) : s; }
function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fill(s, v) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return v[k] == null ? '' : v[k]; }); }
function when(ts) {
  if (!ts) return '';
  try { var L = root.CBLocale; if (L) { var d = L.date(ts, { day: '2-digit', month: 'short' }) || '', t = L.time(ts) || ''; return (d + ' ' + t).trim(); } } catch (_) {}
  return String(ts).replace('T', ' ').slice(0, 16);
}
/** the chip a row paints for a state: "✉ advice sent · delivered" · "↗ advice shared · 04 Oct 17:11" — '' when none */
function stateWords(a) {
  if (!a || !a.state || !STATE_WORDS[a.state]) return '';
  var w = T(STATE_WORDS[a.state]);
  return a.state === 'shared' && a.shared_at ? w + ' · ' + when(a.shared_at) : w;
}

/* ── CSS, once, prefixed ra- (tokens with the page's fallbacks — e2e/token-guard) ── */
var CSS = '.ra{display:flex;flex-direction:column;gap:6px;font-size:var(--fs-1,12px);color:var(--on-card,inherit)}'
  + '.ra-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}'
  + '.ra-b{border:1px solid var(--line,#DDD6C6);background:var(--card,#fff);border-radius:9px;font:inherit;font-size:var(--fs-1,12px);font-weight:700;padding:5px 10px;cursor:pointer;color:var(--blue,#1f5fa8);min-height:32px;text-decoration:none;display:inline-flex;align-items:center;gap:4px}'
  + '.ra-b.pri{background:var(--blue,#1f5fa8);color:var(--on-accent,#fff);border-color:var(--blue,#1f5fa8)}'
  + '.ra-b.off{opacity:.45;cursor:not-allowed;text-decoration:line-through}.ra-b[disabled]{opacity:.55;cursor:not-allowed}'
  + '.ra-why{color:var(--grey,#5E594D)}.ra-st{color:var(--grey,#5E594D);font-weight:700}'
  + '.ra-out{min-height:1em}.ra-out[data-tone=error]{color:var(--disp,#8E3517);font-weight:700}.ra-out[data-tone=ok]{color:var(--ok-2,#16693F);font-weight:700}';
var cssDone = false;
function addCss() { if (cssDone || !doc) return; cssDone = true; var s = doc.createElement('style'); s.setAttribute('data-cbra', '1'); s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s); }

/* ── eligibility: the server's verdict, as handed ── */
function may(m, k) { var a = m.a && m.a.may; return (a && a[k]) || { ok: false, why: 'unknown', say: T(W.reading) }; }

/* ── the read ── */
async function load(m) {
  if (!ensureEP()) { m.err = 'no EP'; paint(m); return; }
  m.err = null;
  try { m.a = await api('booksPayAdvice', { params: { id: m.o.payment_id } }); }
  catch (e) { m.err = (e && e.message) || 'fail'; }
  paint(m);
}

/* ── paint ── */
function paint(m) {
  if (!m.el || !m.el.isConnected) return;
  var a = m.a, o = m.o, id = esc(o.payment_id);
  if (!a) {
    m.el.innerHTML = '<div class="ra" data-testid="adv" data-payment="' + id + '"><span class="ra-why" data-testid="adv-' + (m.err ? 'err' : 'reading') + '">' + esc(T(m.err ? W.readFail : W.reading)) + '</span></div>';
    return;
  }
  var party = (a.party && a.party.name) || o.party || T('the other party');
  var send = may(m, 'send_advice'), share = may(m, 'share_advice'), st = stateWords(a.advice);
  var sendBtn = '<button type="button" class="ra-b pri' + (send.ok ? '' : ' off') + '" data-ra-act="send" data-testid="adv-send"' + (m.failed ? ' data-action-state="failed"' : '') + (send.ok ? '' : ' aria-disabled="true" title="' + esc(send.say || '') + '"') + '>'
    + '✉ ' + esc(T(m.failed ? W.again : W.send)) + '</button>';
  var links = share.ok && a.share
    ? '<button type="button" class="ra-b" data-ra-act="copy" data-testid="adv-copy">' + esc(T(W.copy)) + '</button>'
      + '<a class="ra-b" href="' + esc(a.share.wa) + '" target="_blank" rel="noopener" data-ra-act="shared" data-testid="adv-wa">' + esc(T(W.wa)) + '</a>'
      + '<a class="ra-b" href="' + esc(a.share.mailto) + '" data-ra-act="shared" data-testid="adv-mail">' + esc(T(W.mail)) + '</a>'
    : '<button type="button" class="ra-b off" aria-disabled="true" data-testid="adv-share" title="' + esc(share.say || '') + '">↗ ' + esc(T(W.share)) + '</button>';
  /* ONE sentence on screen: the send refusal (off rail says "share the advice instead"; sent already; view-only…). A greyed Share carries its own sentence as its title. */
  var whys = !send.ok ? '<span class="ra-why" data-testid="adv-why-send">' + esc(send.say || '') + '</span>' : '';
  m.el.innerHTML = '<div class="ra" data-testid="adv" data-payment="' + id + '" data-state="' + esc((a.advice && a.advice.state) || 'none') + '">'
    + (st ? '<span class="ra-st" data-testid="adv-state">' + esc(st) + '</span>' : '')
    + '<div class="ra-row">' + sendBtn + '<span class="ra-row" data-testid="adv-share-row">' + links + '</span></div>'
    + whys
    + '<span class="ra-out" data-testid="adv-out" data-tone="' + esc(m.tone || '') + '">' + esc(m.outWords || '') + '</span></div>';
}

/* ── the writes ── */
function emit(el, payment_id, result) {
  try { (el || doc).dispatchEvent(new CustomEvent('cb:rail', { bubbles: true, detail: { module: 'advice', payment_id: payment_id, result: result } })); } catch (_) {}
}
function needAction() {
  if (typeof CBAction === 'undefined' || !CBAction || typeof CBAction.run !== 'function') throw new Error('CBAdvice needs CBAction (app/accounts-shell.js) on the page — every press goes through the action-state helper');
}
function out(m) { return m.el.querySelector('[data-testid="adv-out"]'); }
function say(m, words, tone) { m.outWords = words; m.tone = tone; var o = out(m); if (o) { o.textContent = words; o.setAttribute('data-tone', tone); } }
function settle(m, result, words, tone) {
  m.a = Object.assign({}, m.a, { advice: Object.assign({}, m.a && m.a.advice, result), body: null,
    may: Object.assign({}, m.a && m.a.may, { send_advice: { ok: false, why: 'already_sent', say: T('An advice is already sent for this payment.') } }) });
  if (result.state === 'shared') m.a.may = Object.assign({}, m.a.may, { send_advice: (m.a.may && m.a.may.send_advice) || { ok: false } });
  m.outWords = words; m.tone = tone; paint(m);
  emit(m.el, m.o.payment_id, result);
  if (typeof m.o.onDone === 'function') { try { m.o.onDone(result, m.o); } catch (_) {} }
}
/** Send: the chit (the server's ready body) then the merge-patch — one press, one outcome; a failed send keeps the button as "Send again" */
function sendPress(m, btn) {
  needAction(); ensureEP();
  var a = m.a, v = may(m, 'send_advice');
  if (!v.ok) { say(m, v.say || '', 'error'); return Promise.resolve({ ok: false }); }
  var party = (a.party && a.party.name) || m.o.party || T('the other party');
  return CBAction.run(btn, async function () {
    var sent = await api('createChit', { body: a.body });
    var chit_id = sent && (sent.chit_id || (sent.chit && sent.chit.chit_id));
    if (!chit_id) throw new Error('no chit id');
    var r = await api('booksPayPatch', { params: { id: m.o.payment_id }, body: { advice_chit_id: chit_id } });
    return Object.assign({ chit_id: chit_id }, (r && r.advice) || { state: 'sent', shared_at: null });
  }, { key: 'adv:' + m.o.payment_id, busy: T(W.sending), out: out(m), failed: T(W.notSent),
    outcome: function (res) { m.failed = false; settle(m, { chit_id: res.chit_id, state: res.state || 'sent', shared_at: res.shared_at || null }, fill(T(W.sent), { party: party }), 'ok'); },
    onFail: function (words, e) {
      m.failed = true;
      /* a 4xx carries the server's own refusal (its words are for people); a 5xx / a network fault keeps the unit's sentence — never a server message */
      var d = e && e.data, w = e && e.status >= 400 && e.status < 500 && d && d.message ? d.message : words;
      if (d && d.why && m.a && m.a.may) m.a.may.send_advice = { ok: false, why: d.why, say: w };
      m.outWords = w; m.tone = 'error'; paint(m);
    } });
}
/** Share: the words left this page (copy · WhatsApp · e-mail) → the payment remembers when */
function sharePress(m, btn, how) {
  needAction(); ensureEP();
  var a = m.a, v = may(m, 'share_advice');
  if (!v.ok) { say(m, v.say || '', 'error'); return Promise.resolve({ ok: false }); }
  var party = (a.party && a.party.name) || m.o.party || T('the other party');
  if (how === 'copy') { try { if (root.navigator && root.navigator.clipboard) root.navigator.clipboard.writeText(a.share.text).catch(function () {}); } catch (_) {} }
  return CBAction.run(how === 'copy' ? btn : null, async function () {
    var r = await api('booksPayPatch', { params: { id: m.o.payment_id }, body: { advice_shared_at: true } });
    return (r && r.advice) || { chit_id: null, state: 'shared', shared_at: new Date().toISOString() };
  }, { key: 'adv-share:' + m.o.payment_id, out: out(m), failed: T(W.notSent),
    outcome: function (res) { settle(m, { chit_id: res.chit_id || null, state: res.state || 'shared', shared_at: res.shared_at || null }, how === 'copy' ? fill(T(W.copied), { party: party }) : T(W.shared), 'ok'); },
    onFail: function (words, e) { var d = e && e.data; say(m, e && e.status >= 400 && e.status < 500 && d && d.message ? d.message : words, 'error'); } });
}

/* ── mount ── */
function mount(el, o) {
  el = typeof el === 'string' ? doc.getElementById(el) : el;
  if (!el || !o || !o.payment_id) return null;
  addCss(); ensureEP();
  if (el.__cbadvice) el.__cbadvice.api.destroy();
  var m = { el: el, o: o, a: o.advice || null, err: null, failed: false, outWords: '', tone: '' };
  function onClick(ev) {
    var t = ev.target.closest ? ev.target.closest('[data-ra-act]') : null; if (!t || !el.contains(t)) return;
    var act = t.getAttribute('data-ra-act');
    if (act === 'send') { ev.preventDefault(); if (t.classList.contains('off')) { say(m, may(m, 'send_advice').say || '', 'error'); return; } sendPress(m, t); return; }
    if (act === 'copy') { ev.preventDefault(); sharePress(m, t, 'copy'); return; }
    if (act === 'shared') { sharePress(m, t, t.getAttribute('data-testid') === 'adv-wa' ? 'wa' : 'mail'); return; }   /* the link opens; the patch rides beside it */
  }
  el.addEventListener('click', onClick);
  var api_ = {
    el: el,
    refresh: function () { return load(m); },
    destroy: function () { el.removeEventListener('click', onClick); el.__cbadvice = null; },
    state: function () { return { advice: m.a && m.a.advice, may: m.a && m.a.may, words: m.a && m.a.words, failed: m.failed }; },
  };
  m.api = api_; el.__cbadvice = m;
  if (m.a) paint(m); else { paint(m); load(m); }
  return api_;
}

var CBAdvice = { mount: mount, stateWords: stateWords, STATE_WORDS: STATE_WORDS, EP: CB_ADVICE_EP, WORDS: W };
root.CBAdvice = CBAdvice;
})(typeof globalThis !== 'undefined' ? globalThis : this);
