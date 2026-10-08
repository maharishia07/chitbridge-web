/* rail-thread.js — CBThread.mount: ONE composer + ONE list for a chit's messages, threaded by line (R02, 2026-10-09).
 *
 * DESIGN-rail-modules-2026-10-05 §2.1 (CBThread): *"one composer + one list, threaded by line; replaces the 4 composers."*
 * Before this file the web repo posted to POST /chits/:id/messages from FOUR places — app.html `doSendMessage`, cap-messages
 * `msgSend`, cap-dispute `sendDisputeMsg`, cap-worklist `wlMsgSave` — four places for the audience line, the line_id, the
 * dispute scoping and the busy state to drift. Now there is one: `e2e/rail-thread-guard.cjs` fails the build on a second.
 *
 * ⚠️ THE API IS CORRECT AND IS NOT REIMPLEMENTED HERE (routes/chits.js :3661 POST · :3821 GET):
 *   POST /api/chits/:id/messages { thread_type: external|internal, message_text, msg_type?, line_id?, is_dispute?, dispute_id? }
 *        → { message_id, thread_type, message_text, sender_display_name, created_at }
 *        refusals: 403 { error, message, why } — `why` is the rail engine's word (read_only · comment_only · not_participant)
 *   GET  /api/chits/:id/messages ?thread_type=all|external|internal &line_id= &dispute=1   → { messages[], count }
 *        the SERVER decides the audience (per-copy rows under RLS): this list paints what it was handed, never more.
 *
 * ⭐ WHO MAY POST is the engine's answer, not this file's: `chit.actions.message_external / message_internal` from
 *   GET /chits/:id (R01). A refused channel is shown greyed WITH its sentence (CBRail.WHY, /engine/rail.js); a viewer
 *   (auditor) reads the thread and sees the sentence instead of a box. The server refuses the same way, so a ✓ here is
 *   never a 403 there — and a 403 is still said in the server's words, never a thrown error's text.
 *
 *   CBThread.mount(el, {
 *     chit_id,                       // the subject (required)
 *     line_id?,                      // one line's thread: every send carries it, the list is that line's
 *     dispute_id?,                   // one dispute's room: sends carry is_dispute + dispute_id; external only; the list is that dispute's
 *     actions?,                      // chit.actions (the host has the chit) — absent: read GET /chits/:id when EP.chit exists
 *     channel?: 'both'|'external'|'internal',   // which channels the composer offers (default both); the list follows
 *     thread_type?,                  // the channel selected first (default external when allowed, else internal)
 *     text?,                         // prefilled composer text (M28 Remind mounts with one)
 *     kinds?: ['info','query',…],    // msg_type choices; one or none → no chooser, 'info'
 *     lines?: [{ line_id, label }],  // the chit's lines: an "About" chooser on the composer and a tag on each row
 *     party?, me?,                   // the other party's name (the audience line) · my display name (my rows read "You")
 *     signature?,                    // appended to a dispute message ("— name@shop", the acting co-assist's provenance)
 *     decorate?(row) → { by, body, kind },   // a host's byline/prefix reader (cap-dispute's disputeByline)
 *     readOnly?,                     // list only (a resolved dispute's room)
 *     ids?: { text, send },          // test ids for the box and the button when a host's spec drives them by other names
 *     context: { host, source? },    // who mounted it (rides on cb:rail)
 *     onList(rows, opts), onDone(result, opts), onCancel()
 *   }) → { refresh(), destroy(), send(text, extra), state(), el }
 *
 *   CBThread.send({ chit_id, text, thread_type, line_id?, dispute_id?, msg_type?, key? }) → Promise<result>   (no screen: a host's own
 *     button — Remind, Answer & publish). Goes through CBAction like every press. CBThread.last = the last send's result.
 *   CBThread.mountAll(scope, base) — every `[data-rt='{json}']` under scope not yet mounted → mount(el, Object.assign({}, base, json)).
 *
 *   Every send: CBAction.run (M64) — busy · one press one write · the outcome said under the button. Emits `cb:rail`
 *   { module:'thread', chit_id, result } on the host element (bubbles) so a row repaints locally.
 *
 * Reuse: CBAction (accounts-shell.js) · api/EP (core.js) · CBRail.WHY (/engine/rail.js, the sentences) · cbAttachList /
 * cbAttachButton (attach-ui.js: an attachment is pinned to a sent message, after the send, exactly as before) · CBLocale ·
 * CBOffline.saveDraft (the typed text survives a repaint). ZERO app.html globals: no UI, SESSION, paintDetail, modal, toast.
 */
(function (root) {
'use strict';
var doc = root.document;

/* ── the two routes, ONE name each (e2e/ep-aliases.cjs). app.html adds this to its EP beside CB_BOOKS_EP; a page without that
   line gets them at mount (ensureEP) — the attach-ui.js pattern. ── */
var CB_THREAD_EP = {
  messages: { m: 'GET',  p: '/api/chits/:id/messages', ok: 'y' },   // ?thread_type= &line_id= &dispute=1
  sendMsg:  { m: 'POST', p: '/api/chits/:id/messages', ok: 'y' },   // the ONE composer's route
};
root.CB_THREAD_EP = CB_THREAD_EP;
function ensureEP() {
  if (typeof EP === 'undefined' || !EP) return false;
  for (var k in CB_THREAD_EP) if (!EP[k]) EP[k] = CB_THREAD_EP[k];
  return true;
}

/* ── the words, one place (copy budget: a label, a verb, a sentence) ── */
var W = {
  internal: '🔒 Internal', external: '↔ External',
  audInternal: '🔒 Team only — the other party never sees this',
  audExternal: '↔ {party} sees this. It cannot be unsent',
  audDispute: '⚑ Dispute — only its members see this',
  send: 'Send', sending: 'Sending…', sentInt: '🔒 Note added — team only', sentExt: '↔ Sent — {party} notified', sentDisp: '⚑ Sent to the dispute',
  empty: 'Type a message first', none: 'No messages yet', noneLine: 'Nothing on this line yet', reading: 'Reading…', readFail: 'Could not read the messages — this does not mean there are none',
  failed: 'Not sent — try again', you: 'You', whole: 'Whole order', about: 'About', attach: '📎 Attach', line: 'Line',
  viewOnly: 'View only — you can read, not reply',
};
function T(s) { return typeof tx === 'function' ? tx(s) : s; }
function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fill(s, v) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return v[k] == null ? '' : v[k]; }); }
function when(ts) {
  if (!ts) return '';
  try { var L = root.CBLocale; if (L) { var d = L.date(ts, { day: '2-digit', month: 'short' }) || '', t = L.time(ts) || ''; return (d + ' ' + t).trim(); } } catch (_) {}
  return String(ts).replace('T', ' ').slice(0, 16);
}
/** the sentence for an engine refusal word — the engine's own (CBRail.WHY) when the page loads /engine/rail.js, else the server's words */
function why(word, fallback) {
  try { var R = root.CBRail; if (R && R.WHY && Object.prototype.hasOwnProperty.call(R.WHY, word)) return R.WHY[word]; } catch (_) {}
  return fallback || T(W.viewOnly);
}

/* ── CSS, once, prefixed rt- ── */
var CSS = '.rt{display:flex;flex-direction:column;gap:8px;font-size:var(--fs-2,14px);color:var(--on-card,inherit)}'
  + '.rt-comp{border:1px solid var(--line,#DDD6C6);border-radius:12px;padding:10px;background:var(--card,#fff)}'
  + '.rt-comp.ext{background:var(--blue-tint-bg,#eef4fb)}.rt-comp.disp{border-color:var(--disp,#8E3517)}'
  + '.rt-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:7px}'
  + '.rt-ch{display:inline-flex;border:1px solid var(--line,#DDD6C6);border-radius:9px;overflow:hidden}'
  + '.rt-ch button{border:0;background:var(--card,#fff);font:inherit;font-size:var(--fs-1,12px);font-weight:700;padding:6px 11px;color:var(--grey,#5E594D);cursor:pointer;min-height:32px}'
  + '.rt-ch button.on.int{background:#5f7682;color:#fff}.rt-ch button.on.ext{background:var(--blue,#1f5fa8);color:var(--on-accent,#fff)}'
  + '.rt-ch button.off{opacity:.45;cursor:not-allowed;text-decoration:line-through}'
  + '.rt-k{border:1px solid var(--line,#DDD6C6);background:var(--card,#fff);border-radius:9px;font:inherit;font-size:var(--fs-1,12px);padding:4px 9px;cursor:pointer;color:var(--grey,#5E594D)}.rt-k.on{border-color:var(--blue,#1f5fa8);color:var(--blue,#1f5fa8);font-weight:700}'
  + '.rt-sel{font:inherit;font-size:var(--fs-1,12px);border:1px solid var(--line,#DDD6C6);border-radius:9px;padding:5px 8px;background:var(--card,#fff);color:inherit;max-width:100%}'
  + '.rt textarea{width:100%;box-sizing:border-box;border:1px solid var(--line,#DDD6C6);border-radius:9px;padding:9px;font:inherit;font-size:var(--fs-2,14px);min-height:56px;resize:vertical;background:var(--card,#fff);color:inherit}'
  + '.rt-aud{font-size:var(--fs-1,12px);margin:6px 0;color:var(--grey,#5E594D)}.rt-aud.ext{color:var(--blue,#1f5fa8);font-weight:700}.rt-aud.disp{color:var(--disp,#8E3517);font-weight:700}'
  + '.rt-foot{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'
  + '.rt-send{border:0;color:#fff;border-radius:9px;font:inherit;font-size:var(--fs-2,14px);font-weight:700;padding:9px 16px;cursor:pointer;min-height:40px;background:#5f7682}'
  + '.rt-send.ext{background:var(--blue,#1f5fa8)}.rt-send.disp{background:var(--disp,#8E3517)}.rt-send[disabled]{opacity:.55;cursor:not-allowed}'
  + '.rt-out{font-size:var(--fs-1,12px);min-height:1em}.rt-out[data-tone=error]{color:var(--disp,#8E3517);font-weight:700}.rt-out[data-tone=ok]{color:var(--ok-2,#16693F);font-weight:700}'
  + '.rt-no{border:1px dashed var(--line,#DDD6C6);border-radius:9px;padding:9px 11px;color:var(--grey,#5E594D);font-size:var(--fs-2,14px)}'
  + '.rt-why{font-size:var(--fs-1,12px);color:var(--grey,#5E594D)}'
  + '.rt-list{display:flex;flex-direction:column;gap:7px}.rt-n{font-size:var(--fs-1,12px);color:var(--grey,#5E594D);font-weight:700}'
  + '.rt-m{border:1px solid var(--line,#DDD6C6);border-radius:0 10px 10px 0;padding:8px 11px;background:var(--card,#fff);border-inline-start:3px solid #8aa0ad}'
  + '.rt-m.ext{background:var(--blue-tint-bg,#eef4fb);border-inline-start-color:var(--blue,#1f5fa8)}.rt-m.disp{background:var(--danger-tint,#fbeeec);border-inline-start-color:var(--disp,#8E3517)}'
  + '.rt-m.mine{margin-inline-start:18px}'
  + '.rt-h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:var(--fs-1,12px);margin-bottom:3px}.rt-h b{color:var(--ink,#1D1B16)}.rt-h .rt-t{margin-inline-start:auto;color:var(--grey,#5E594D)}'
  + '.rt-tag{border-radius:6px;padding:1px 7px;font-weight:700;font-size:var(--fs-1,12px)}.rt-tag.int{background:var(--blue-tint-bg,#eef4fb);color:#5f7682}.rt-tag.ext{background:var(--blue-tint-bg,#eef4fb);color:var(--blue,#1f5fa8)}.rt-tag.disp{background:var(--danger-tint,#fbeeec);color:var(--disp,#8E3517)}.rt-tag.ln{background:var(--paper,#f4f1ea);color:var(--grey,#5E594D)}'
  + '.rt-b{white-space:pre-wrap;line-height:1.45}.rt-att{margin-top:6px}.rt-empty{color:var(--grey,#5E594D);padding:8px 2px}';
var cssDone = false;
function addCss() { if (cssDone || !doc) return; cssDone = true; var s = doc.createElement('style'); s.setAttribute('data-cbrt', '1'); s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s); }

/* ── drafts: the typed text survives a repaint (and a reload when CBOffline is on the page) ── */
var DRAFTS = {};
function dkey(o) { return 'rt.' + o.chit_id + '.' + (o.line_id || '') + '.' + (o.dispute_id || ''); }
function draftGet(o) { var k = dkey(o); if (DRAFTS[k] != null) return DRAFTS[k]; try { var C = root.CBOffline; if (C && C.loadDraft) return C.loadDraft(k) || ''; } catch (_) {} return ''; }
function draftSet(o, v) { var k = dkey(o); DRAFTS[k] = v; try { var C = root.CBOffline; if (C && C.saveDraft) C.saveDraft(k, v); } catch (_) {} }
function draftClear(o) { var k = dkey(o); delete DRAFTS[k]; try { var C = root.CBOffline; if (C && C.clearDraft) C.clearDraft(k); } catch (_) {} }

/* ── eligibility: the engine's verdict per channel ── */
function verdict(m, ch) {
  var a = m.actions || null, k = ch === 'external' ? 'message_external' : 'message_internal';
  if (!a || !a[k]) return { ok: true, unknown: !a };          /* no answer yet: offer it; the server is the backstop */
  return a[k];
}
function allowed(m, ch) { return verdict(m, ch).ok !== false; }
function channels(m) {
  var c = m.o.channel || 'both';
  return c === 'both' ? ['internal', 'external'] : [c];
}

/* ── the list: what the server handed this copy, filtered to the subject (line · dispute) ── */
async function load(m) {
  if (!ensureEP()) { m.err = 'no EP'; paint(m); return; }
  var o = m.o, q = {};
  var ch = o.channel || 'both';
  q.thread_type = (ch === 'both' || o.dispute_id) ? 'all' : ch;
  if (o.line_id) q.line_id = o.line_id;
  if (o.dispute_id) q.dispute = '1';
  m.err = null;
  try {
    var r = await api('messages', { params: { id: o.chit_id }, query: q });
    var list = (r && (r.messages || r.items || (Array.isArray(r) ? r : []))) || [];
    /* ⚠️ FILTERED AGAIN CLIENT-SIDE, the subject's rows only: a line's thread never absorbs the chit's (pre-b155 servers ignore
       line_id); a dispute room shows ITS dispute's rows; the general thread shows NO dispute row — those live in the room, for
       the roster, and a row a non-member was never handed cannot appear here because this list is only what came back. */
    list = list.filter(function (x) {
      if (o.dispute_id) return x.is_dispute && String(x.dispute_id) === String(o.dispute_id);
      if (x.is_dispute) return false;
      if (o.line_id && x.line_id && String(x.line_id) !== String(o.line_id)) return false;
      if (ch !== 'both' && x.thread_type !== ch) return false;
      return true;
    });
    list.sort(function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); });   /* newest first (Athi, 2026-08-15) */
    m.rows = list;
  } catch (e) { m.err = (e && e.message) || 'fail'; }
  paint(m);
  if (typeof o.onList === 'function' && m.rows) { try { o.onList(m.rows.slice(), o); } catch (_) {} }
}
/** the chit's actions when the host did not hand them over — one GET through the page's `chit` row, deduped by core */
async function readActions(m) {
  if (m.actions || typeof EP === 'undefined' || !EP || !EP.chit) return;
  try { var r = await api('chit', { params: { id: m.o.chit_id } }); if (r && r.actions) { m.actions = r.actions; paint(m); } } catch (_) {}
}

/* ── paint ── */
function rowHTML(m, x) {
  var o = m.o, dec = null;
  if (x.is_dispute && typeof o.decorate === 'function') { try { dec = o.decorate(x.message_text || ''); } catch (_) {} }
  var body = dec && dec.body != null ? dec.body : (x.message_text || '');
  var mine = !!(o.me && x.sender_display_name && String(x.sender_display_name) === String(o.me)) || (m.sent && String(m.sent.message_id) === String(x.message_id));
  var cls = x.is_dispute ? 'disp' : (x.thread_type === 'external' ? 'ext' : 'int');
  var tag = x.is_dispute ? '<span class="rt-tag disp">' + T('⚑ Dispute') + '</span>'
    : (channels(m).length > 1 || o.dispute_id ? '<span class="rt-tag ' + cls + '">' + T(x.thread_type === 'external' ? W.external : W.internal) + '</span>' : '');
  var ln = '';
  if (!o.line_id && x.line_id) { var L = (o.lines || []).filter(function (l) { return String(l.line_id) === String(x.line_id); })[0]; ln = '<span class="rt-tag ln">' + esc(L ? L.label : T(W.line)) + '</span>'; }
  var atts = (x.attachments && x.attachments.length && typeof cbAttachList === 'function') ? '<div class="rt-att">' + cbAttachList(x.attachments) + '</div>' : '';
  var attBtn = (m.sent && String(m.sent.message_id) === String(x.message_id) && typeof cbAttachButton === 'function' && !o.readOnly)
    ? '<div class="rt-att">' + cbAttachButton({ chit_id: o.chit_id, message_id: x.message_id }) + '</div>' : '';
  return '<div class="rt-m ' + cls + (mine ? ' mine' : '') + '" data-testid="rt-row" data-id="' + esc(x.message_id) + '" data-thread="' + esc(x.thread_type) + '"' + (x.is_dispute ? ' data-dispute="' + esc(x.dispute_id) + '"' : '') + '>'
    + '<div class="rt-h">' + tag + ln + '<b>' + esc(mine ? T(W.you) : (x.sender_display_name || '—')) + '</b>' + (dec && dec.by ? '<span class="rt-why">· ' + esc(dec.by) + '</span>' : '') + '<span class="rt-t">' + esc(when(x.created_at)) + '</span></div>'
    + '<div class="rt-b">' + esc(body) + '</div>' + atts + attBtn + '</div>';
}
function composerHTML(m) {
  var o = m.o, ids = o.ids || {};
  var chs = channels(m), can = chs.filter(function (c) { return allowed(m, c); });
  if (!can.length) {
    var v = verdict(m, chs[0]);
    return '<div class="rt-no" data-testid="rt-no">' + esc(why(v.why, T(W.viewOnly))) + '</div>';
  }
  if (can.indexOf(m.channel) < 0) m.channel = can[0];
  var disp = !!o.dispute_id, ext = m.channel === 'external';
  var toggle = chs.length > 1 ? '<div class="rt-ch">' + chs.map(function (c) {
    var ok = allowed(m, c), v = verdict(m, c), on = m.channel === c;
    return '<button type="button" class="' + (c === 'external' ? 'ext' : 'int') + (on ? ' on' : '') + (ok ? '' : ' off') + '" data-rt-act="ch" data-ch="' + c + '" data-testid="msg-channel-' + c + '"'
      + (ok ? '' : ' aria-disabled="true" title="' + esc(why(v.why)) + '"') + '>' + esc(T(c === 'external' ? W.external : W.internal)) + '</button>';
  }).join('') + '</div>' : '';
  var offWhy = chs.filter(function (c) { return !allowed(m, c); }).map(function (c) { return '<span class="rt-why" data-testid="rt-why-' + c + '">' + esc(why(verdict(m, c).why)) + '</span>'; }).join('');
  var kinds = (o.kinds && o.kinds.length > 1) ? '<span class="rt-row" data-testid="rt-kinds">' + o.kinds.map(function (k) {
    return '<button type="button" class="rt-k' + (m.kind === k ? ' on' : '') + '" data-rt-act="kind" data-k="' + esc(k) + '">' + esc(T(k.charAt(0).toUpperCase() + k.slice(1))) + '</button>'; }).join('') + '</span>' : '';
  var lines = (!o.line_id && !disp && o.lines && o.lines.length) ? '<label class="rt-row">' + esc(T(W.about)) + ' <select class="rt-sel" data-rt-act="line" data-testid="rt-line"><option value="">' + esc(T(W.whole)) + '</option>'
    + o.lines.map(function (l) { return '<option value="' + esc(l.line_id) + '"' + (m.line === String(l.line_id) ? ' selected' : '') + '>' + esc(l.label) + '</option>'; }).join('') + '</select></label>' : '';
  var aud = disp ? T(W.audDispute) : ext ? fill(T(W.audExternal), { party: o.party || T('the other party') }) : T(W.audInternal);
  var tone = disp ? 'disp' : ext ? 'ext' : 'int';
  return '<div class="rt-comp ' + tone + '" data-testid="rt-composer">'
    + (toggle || kinds ? '<div class="rt-row">' + toggle + kinds + '</div>' : '') + offWhy + lines
    + '<textarea data-rt-act="text" data-testid="' + esc(ids.text || 'msg-body') + '" placeholder="' + esc(aud) + '">' + esc(m.text) + '</textarea>'
    + '<div class="rt-aud ' + tone + '" data-testid="rt-aud">' + esc(aud) + '</div>'
    + '<div class="rt-foot"><button type="button" class="rt-send ' + tone + '" data-rt-act="send" data-testid="' + esc(ids.send || 'msg-send') + '">' + esc(T(W.send)) + '</button>'
    + '<span class="rt-out" data-testid="rt-out" data-tone=""></span></div></div>';
}
function listHTML(m) {
  var o = m.o;
  if (m.err) return '<div class="rt-empty" data-testid="rt-err">' + esc(T(W.readFail)) + '</div>';
  if (!m.rows) return '<div class="rt-empty">' + esc(T(W.reading)) + '</div>';
  if (!m.rows.length) return '<div class="rt-empty" data-testid="rt-empty">' + esc(T(o.line_id ? W.noneLine : W.none)) + '</div>';
  return '<div class="rt-n" data-testid="rt-count">' + m.rows.length + '</div>' + m.rows.map(function (x) { return rowHTML(m, x); }).join('');
}
function paint(m) {
  if (!m.el || !m.el.isConnected) return;
  var keep = m.el.querySelector('[data-rt-act="text"]'); if (keep) m.text = keep.value;
  m.el.innerHTML = '<div class="rt" data-testid="rt" data-chit="' + esc(m.o.chit_id) + '">' + (m.o.readOnly ? '' : composerHTML(m)) + '<div class="rt-list" data-testid="rt-list">' + listHTML(m) + '</div></div>';
}

/* ── the one send ── */
function bodyFor(o, text, ch, extra) {
  extra = extra || {};
  var b = { thread_type: o.dispute_id ? 'external' : ch, message_text: text, msg_type: extra.msg_type || 'info' };
  var line = extra.line_id !== undefined ? extra.line_id : o.line_id;
  if (line) b.line_id = line;
  if (o.dispute_id) { b.is_dispute = true; b.dispute_id = o.dispute_id; if (o.signature) b.message_text = text + '  ' + o.signature; }
  return b;
}
function emit(el, chit_id, result) {
  try { (el || doc).dispatchEvent(new CustomEvent('cb:rail', { bubbles: true, detail: { module: 'thread', chit_id: chit_id, result: result } })); } catch (_) {}
}
/** post ONE message through CBAction (busy · one press one write · outcome). btn may be null (a host's own control, or none). */
function post(btn, o, body, say) {
  if (typeof CBAction === 'undefined' || !CBAction || typeof CBAction.run !== 'function') {
    throw new Error('CBThread needs CBAction (app/accounts-shell.js) on the page — every send goes through the action-state helper');
  }
  ensureEP();
  return CBAction.run(btn, function () { return api('sendMsg', { params: { id: o.chit_id }, body: body }); },
    { key: 'rt:' + o.chit_id + ':' + (o.line_id || '') + ':' + (o.dispute_id || ''), busy: T(W.sending), out: say.out, failed: T(W.failed),
      outcome: say.outcome, onFail: say.onFail })
    .then(function (res) {
      if (res.ok) { var v = Object.assign({}, res.value || {}, { chit_id: o.chit_id, thread_type: body.thread_type, line_id: body.line_id || null, dispute_id: body.dispute_id || null }); CBThread.last = v; emit(btn, o.chit_id, v); return v; }
      /* a refusal is the server's own sentence, already said by CBAction; the caller reads res.error.data.why */
      CBThread.last = { ok: false, error: res.error || null, cancelled: !!res.cancelled, skipped: !!res.skipped };
      return CBThread.last;
    });
}

/* ── mount ── */
function mount(el, o) {
  el = typeof el === 'string' ? doc.getElementById(el) : el;
  if (!el || !o || !o.chit_id) return null;
  addCss(); ensureEP();
  if (el.__cbthread) el.__cbthread.api.destroy();
  var m = { el: el, o: o, rows: null, err: null, actions: o.actions || (o.chit && o.chit.actions) || null, sent: null,
    kind: (o.kinds && o.kinds[0]) || 'info', line: '', text: o.text != null ? String(o.text) : draftGet(o) };
  /* first channel: the one asked for when allowed, else external when allowed, else internal */
  var want = o.dispute_id ? 'external' : (o.thread_type || (o.channel && o.channel !== 'both' ? o.channel : 'external'));
  m.channel = allowed(m, want) ? want : channels(m).filter(function (c) { return allowed(m, c); })[0] || want;

  function onClick(ev) {
    var t = ev.target.closest ? ev.target.closest('[data-rt-act]') : null; if (!t || !el.contains(t)) return;
    var act = t.getAttribute('data-rt-act');
    if (act === 'ch') { if (t.classList.contains('off')) return; m.channel = t.getAttribute('data-ch'); paint(m); return; }
    if (act === 'kind') { m.kind = t.getAttribute('data-k'); paint(m); return; }
    if (act === 'send') { ev.preventDefault(); sendPress(t); }
  }
  function onInput(ev) {
    var t = ev.target;
    if (t.getAttribute('data-rt-act') === 'text') { m.text = t.value; draftSet(o, t.value); }
    if (t.getAttribute('data-rt-act') === 'line') m.line = t.value;
  }
  function out() { return el.querySelector('[data-testid="rt-out"]'); }
  function sendPress(btn) {
    var box = el.querySelector('[data-rt-act="text"]'); var text = String((box ? box.value : m.text) || '').trim();
    var o2 = out();
    if (!text) { if (o2) { o2.textContent = T(W.empty); o2.setAttribute('data-tone', 'error'); } return; }
    if (!allowed(m, m.channel)) { if (o2) { o2.textContent = why(verdict(m, m.channel).why); o2.setAttribute('data-tone', 'error'); } return; }
    var body = bodyFor(o, text, m.channel, { msg_type: m.kind, line_id: m.line || undefined });
    return post(btn, o, body, {
      out: o2,
      outcome: function (v) {
        m.sent = Object.assign({}, v || {}, { message_id: (v && v.message_id) || null });
        draftClear(o); m.text = '';
        var bx = el.querySelector('[data-rt-act="text"]'); if (bx) bx.value = '';   /* paint re-reads the box, so it is emptied in the DOM too */
        var s = o.dispute_id ? T(W.sentDisp) : body.thread_type === 'external' ? fill(T(W.sentExt), { party: o.party || T('the other party') }) : T(W.sentInt);
        var ob = out(); if (ob) { ob.textContent = s; ob.setAttribute('data-tone', 'ok'); }
        if (typeof o.onDone === 'function') { try { o.onDone(m.sent, o); } catch (_) {} }
        load(m).then(function () { var ob2 = out(); if (ob2) { ob2.textContent = s; ob2.setAttribute('data-tone', 'ok'); } });
      },
      onFail: function (words, e) {
        /* the server's refusal in the server's words (a 403 carries `why`: the engine's word, its sentence preferred) */
        var w = words, d = e && e.data; if (d && d.why) w = why(d.why, (d.message || words));
        var ob = out(); if (ob) { ob.textContent = w; ob.setAttribute('data-tone', 'error'); }
        if (d && d.why && m.actions) { var k = body.thread_type === 'external' ? 'message_external' : 'message_internal'; m.actions[k] = { ok: false, why: d.why }; }
      },
    });
  }
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  el.addEventListener('change', onInput);
  var api_ = {
    el: el,
    refresh: function () { return load(m); },
    destroy: function () { el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); el.removeEventListener('change', onInput); el.__cbthread = null; },
    state: function () { return { channel: m.channel, rows: m.rows ? m.rows.slice() : null, actions: m.actions, sent: m.sent, text: m.text }; },
    /** a host's own send on this mount: text → the mounted subject's thread (M28 Remind mounts with a prefilled text and may press this) */
    send: function (text, extra) {
      extra = extra || {};
      var ch = extra.thread_type || m.channel;
      return post(el.querySelector('[data-rt-act="send"]'), o, bodyFor(o, String(text || m.text || '').trim(), ch, extra),
        { out: out(), outcome: function (v) { m.sent = v; draftClear(o); m.text = ''; var bx = el.querySelector('[data-rt-act="text"]'); if (bx) bx.value = ''; load(m); if (typeof o.onDone === 'function') { try { o.onDone(v, o); } catch (_) {} } },
          onFail: function (words, e) { var d = e && e.data, ob = out(); if (ob) { ob.textContent = d && d.why ? why(d.why, d.message || words) : words; ob.setAttribute('data-tone', 'error'); } } });
    },
  };
  m.api = api_; el.__cbthread = m;
  paint(m); load(m); readActions(m);
  return api_;
}

/** a send with no screen of its own (Answer & publish · Remind): the same route, the same helper, the same event */
function send(a) {
  a = a || {};
  var o = { chit_id: a.chit_id, line_id: a.line_id || null, dispute_id: a.dispute_id || null, signature: a.signature || '' };
  if (!o.chit_id || !a.text) return Promise.reject(new Error('CBThread.send: chit_id and text are needed'));
  var body = bodyFor(o, String(a.text).trim(), a.thread_type || 'external', { msg_type: a.msg_type, line_id: a.line_id });
  return post(a.button || null, o, body, { out: a.out || null, outcome: a.outcome || function () {}, onFail: a.onFail || null });
}
function mountAll(scope, base) {
  scope = scope || doc; if (!scope || !scope.querySelectorAll) return [];
  var out = [];
  Array.prototype.forEach.call(scope.querySelectorAll('[data-rt]'), function (el) {
    if (el.__cbthread) return;
    var j = {}; try { j = JSON.parse(el.getAttribute('data-rt') || '{}'); } catch (_) { return; }
    var r = mount(el, Object.assign({}, base || {}, j)); if (r) out.push(r);
  });
  return out;
}

var CBThread = { mount: mount, mountAll: mountAll, send: send, last: null, EP: CB_THREAD_EP, WORDS: W };
root.CBThread = CBThread;
})(typeof globalThis !== 'undefined' ? globalThis : this);
