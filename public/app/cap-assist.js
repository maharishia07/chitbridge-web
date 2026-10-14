/**
 * app/cap-assist.js — CB ASSIST: WHAT THE ASSISTANT ANSWERS (the help desk's knowledge base). MOVED here from cap-admin.js (T3-DISPUTES-ASSIST,
 * 2026-10-14) so the workshop's #/assistreview (ensureCap('admin') loads this with it, CAP_WITH) and CB Tasks & Orders › CB Assist
 * (tasks.html?view=assist) paint the SAME screen — one copy.
 *
 * Questions reach a help desk as CHITS in its Tasks (Send to help desk); it answers there and publishes the answer HERE, where the assistant
 * serves it at once (catalogue → projection, api routes/assist.js POST /publish). Everyone may read the answers; Publish and Edit are SHOWN
 * to everyone and greyed with the server's sentence (GET /api/assist/whoami → may.publish { ok, why, say }) — POST /publish refuses the same
 * caller the same way. Every write goes through CBAction (M64).
 *
 * ⚠️ NOT HERE: accept / reject of what the assistant DRAFTED. The server keeps no drafts (GET /assist/gaps answers [], POST /assist/resolve
 * answers 410) — a store for them is a spec decision, not a screen (docs/critique/T3-DISPUTES-ASSIST.md).
 *
 *   CBAssist.mount(el, { fill }) → { reload }
 * Depends on: api()/EP (core.js; CB_ASSIST_EP from accounts-shell.js) · CBList (list-ctl.js) · CBAction · esc · tx.
 * Flow step: docs/process/flows.json AST step 1.
 */

var _kbItems = [], _kbEditId = '';
/** the workshop's screen shell (app.html scr) — the body is CBAssist's */
function assistReviewScreen(){ return scr("🧠 Assistant — knowledge base","kbbody","assistreview"); }
/** the workshop's renderApp calls this name after painting #/assistreview (loadGaps kept: the dispatch reads it) */
function loadGaps(){ var h = document.getElementById("kbbody"); if (h) CBAssist.mount(h, { fill: false }); }
/** an answer → the form, to refine it (Edit) */
function kbEdit(id){ var it = _kbItems.filter(function (x) { return x.id === id; })[0]; if (!it) return; _kbEditId = id;
  var q = document.getElementById("kb_q"), a = document.getElementById("kb_a"), c = document.getElementById("kb_c"), hd = document.getElementById("kb_formhd"), pb = document.getElementById("kb_pub");
  if (q) q.value = it.q || ''; if (a) a.value = it.a || ''; if (c) c.value = (Array.isArray(it.context) ? it.context.join(', ') : '*');
  if (hd) hd.textContent = tx('Edit answer'); if (pb) pb.textContent = tx('💾 Update');
  if (q && q.scrollIntoView) q.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
function kbNew(){ if (window.CBOffline) CBOffline.clearDraft('kb.form'); _kbEditId = '';
  var q = document.getElementById("kb_q"), a = document.getElementById("kb_a"), c = document.getElementById("kb_c"), hd = document.getElementById("kb_formhd"), pb = document.getElementById("kb_pub"), x = document.getElementById("kb_err");
  if (q) q.value = ''; if (a) a.value = ''; if (c) c.value = '*'; if (hd) hd.textContent = tx('Publish an answer'); if (pb) pb.textContent = tx('📣 Publish'); if (x) x.textContent = ''; }
function kbVal(id){ var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
/** Publish (or Update) — POST /api/assist/publish, through CBAction; the outcome is said under the form */
function publishAnswer(btn){
  var x = document.getElementById("kb_err"); if (x) { x.textContent = ''; x.removeAttribute('data-tone'); }
  var q = kbVal("kb_q"), a = kbVal("kb_a"), c = (kbVal("kb_c") || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!q || !a) { if (x) { x.textContent = tx('Type the question and the answer first.'); x.setAttribute('data-tone', 'error'); } return; }
  var edit = _kbEditId;
  return CBAction.run(btn || document.getElementById('kb_pub'), function () { return api("assistPublish", { body: { question: q, answer: a, context: c, qa_id: edit || undefined } }); },
    { key: 'kb-publish', out: 'kb_err', failed: tx('Could not publish'),
      outcome: function () { kbNew(); CBAssist.said(edit ? tx('Updated — the assistant says it now.') : tx('Published — the assistant says it now.')); CBAssist.reload(); } });
}

var CBAssist = (function () {
  var K = { el: null, o: {}, may: null, state: 'loading', err: null, list: null, said: '' };   /* said: the last outcome, kept over the form's repaint */
  function T(s) { return typeof tx === 'function' ? tx(s) : s; }
  /** the server's answer for Publish / Edit — a sentence when refused, '' when allowed (still reading: refused until it answers) */
  function refused() { var m = K.may && K.may.publish; return !m ? T('Checking whether you can publish…') : m.ok === false ? (m.say || T('Only a help desk publishes answers.')) : ''; }
  function ctxWord(e) { return Array.isArray(e.context) && e.context.length ? e.context.join(', ') : '*'; }
  function formHTML() {
    var no = refused(), dis = no ? ' disabled aria-disabled="true"' : '';
    return '<div class="kb-form" data-testid="kb-form"><div class="tk-h" id="kb_formhd">' + esc(T('Publish an answer')) + '</div>'
      + '<label class="sub" for="kb_q">' + esc(T('Question')) + '</label><input class="inp" id="kb_q" data-testid="kb-question" placeholder="' + esc(T('e.g. How do I export to Excel?')) + '"' + dis + '>'
      + '<label class="sub" for="kb_a">' + esc(T('Answer')) + '</label><textarea class="inp" id="kb_a" data-testid="kb-answer" rows="3" placeholder="' + esc(T('The answer the assistant gives')) + '"' + dis + '></textarea>'
      + '<label class="sub" for="kb_c">' + esc(T('Where it shows (screens, or * for everywhere)')) + '</label><input class="inp" id="kb_c" data-testid="kb-context" value="*"' + dis + '>'
      + '<div class="tk-act' + (no ? ' no' : '') + '"><button type="button" class="act composebtn" id="kb_pub" data-testid="kb-publish"' + dis + ' title="' + esc(no || T('Publish')) + '">' + esc(T('📣 Publish')) + '</button>'
      + '<button type="button" class="act quiet composebtn ghost" id="kb_new" data-testid="kb-new"' + dis + '>' + esc(T('＋ New')) + '</button>'
      + (no ? '<span class="why" data-testid="kb-publish-why">' + esc(no) + '</span>' : '') + '</div>'
      + '<div class="tk-out" id="kb_err" role="status" data-testid="kb-out" data-tone="ok">' + esc(K.said) + '</div></div>';
  }
  function paintForm() {
    var f = K.el && K.el.querySelector('#kb_formbox'); if (!f) return;
    f.innerHTML = formHTML();
    var pb = document.getElementById('kb_pub'), nb = document.getElementById('kb_new');
    if (pb && !pb.disabled) pb.onclick = function () { publishAnswer(pb); };
    if (nb && !nb.disabled) nb.onclick = kbNew;
    if (!refused() && window.CBOffline && CBOffline.autodraft) CBOffline.autodraft(f, 'kb.form');   /* draft the question / answer being written */
  }
  function errWords() { return K.err && K.err.status === 403 ? T('This sign-in cannot read the answers.') : T("Couldn't read the answers. Check the connection and try again."); }
  function paintList() {
    if (K.list) { K.list.refresh(); return; }
    var host = K.el && K.el.querySelector('#kb_list'); if (!host) return;
    K.list = CBList.mount(host, {
      key: 'assist-kb', t: T, rows: function () { return _kbItems; }, id: function (e) { return e.id; }, rowTid: function (e) { return 'kb-row-' + e.id; },
      columns: [
        { key: 'q', label: T('Question'), prio: 1, w: 260, value: function (e) { return e.q || ''; }, cell: function (e) { return e.q || ''; } },
        { key: 'a', label: T('Answer'), prio: 2, w: 360, value: function (e) { return e.a || ''; }, cell: function (e) { return e.a || ''; } },
        { key: 'ctx', label: T('Where it shows'), prio: 3, w: 160, hfilter: 'ctx', value: ctxWord, cell: ctxWord }
      ],
      defaultCols: ['q', 'a'], cardMax: 2, fill: K.o.fill !== false,
      state: function () { return K.state; }, error: errWords, onRetry: function () { load(); },
      empty: { title: T('No answers yet'), sub: T('A help desk publishes them here; the assistant says them at once.') },
      search: function (e) { return [e.q, e.a, ctxWord(e)].join(' '); }, searchHint: T('Question or answer'),
      filters: [{ key: 'ctx', label: T('Where it shows'), all: T('Every screen'), options: [{ v: 'all', label: T('Everywhere (*)') }, { v: 'some', label: T('Named screens') }],
        match: function (e, v) { var all = !Array.isArray(e.context) || !e.context.length || e.context.indexOf('*') >= 0; return v === 'all' ? all : !all; } }],
      sorts: [{ key: 'q', label: T('By question'), cmp: function (a, b) { return String(a.q || '').localeCompare(String(b.q || '')); } }],
      next: function (e) { return '<div class="sub"><b>' + esc(e.q || '') + '</b><div>' + esc(e.a || '') + '</div></div>'; },
      actions: [{ id: 'edit', label: T('Edit'), icon: '✎', tid: 'kb-edit', why: refused, run: function (e) { if (!refused()) kbEdit(e.id); } }]
    });
  }
  function load() {
    K.state = 'loading'; K.err = null; if (K.list) K.list.refresh();
    var who = api('assistWhoami').then(function (r) { K.may = (r && r.may) || { publish: { ok: !!(r && r.is_helpdesk) } }; },
      function (e) { if (typeof cblog === 'function') cblog('warn', 'assist: whoami could not be read — ' + ((e && e.message) || e)); K.may = { publish: { ok: false, say: T("Couldn't check whether you can publish. Try again.") } }; });
    var qs = api('assistQuestions').then(function (r) { _kbItems = Array.isArray(r) ? r : ((r && r.items) || []); K.state = 'ready'; },
      function (e) { if (typeof cblog === 'function') cblog('error', 'assist: the answers could not be read — ' + ((e && e.message) || e)); K.state = 'error'; K.err = e; });
    return Promise.all([who, qs]).then(function () { paintForm(); paintList(); });
  }
  function mount(el, o) {
    K.el = el; K.o = o || {}; K.list = null; K.may = null; K.said = ''; _kbEditId = '';
    el.innerHTML = '<div class="kb-top sub" data-testid="kb-how">' + esc(T('Questions reach a help desk as chits in its Tasks. The answers published here are what the assistant says.')) + '</div>'
      + '<div id="kb_formbox"></div><div class="tk-list" id="kb_list" data-testid="kb-list"></div>';
    paintForm(); paintList(); load();
    return { reload: load };
  }
  return { mount: mount, said: function (w) { K.said = String(w || ''); var x = document.getElementById('kb_err'); if (x) x.textContent = K.said; },
    reload: function () { if (K.el && document.body.contains(K.el)) return load(); } };
})();
