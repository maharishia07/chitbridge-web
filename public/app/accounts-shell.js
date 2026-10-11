/* accounts-shell.js — the small shared floor under every page that shows the Ledger (app.html, accounts.html, and the
 * Ledger tile on index.html). Loaded by app.html right after core.js and BEFORE its inline script; by accounts.html
 * before cap-books.js. Nothing here was written for CB Accounts alone: each piece was already in app.html and is MOVED
 * here, so that the app and the CB Accounts page run ONE implementation, not two copies (2026-10-01, docs/design/
 * cb-accounts/CLOUD-TASK.md).
 *
 * What lives here, and why it is not in app.html any more:
 *   · tx / txf / cbLang / CBSTR — the English-is-the-key string door (cap-books.js speaks through it)
 *   · friendlyErr, toast         — a failure's words, and the one-line toast (host element: <div id="toast">)
 *   · CB_BOOKS_EP                — the Ledger's boot endpoints (health · status · enable · setting · dues · statement);
 *                                  app.html adds them to its EP, accounts.html to its own. cap-books.js adds the rest.
 *   · CBAction                   — the action-state helper: busy · confirm for irreversible writes · outcome (M64)
 *   · CBLedger                   — the Ledger's SWITCH: the words, the confirm, the call, in one place. The Settings
 *                                  card (bizLedgerSwitch, cap-admin.js), the CB Accounts page and the index tile each
 *                                  paint their own box and hand this their own dialog and transport.
 *
 * ⚠️ Declares only `var` / function names the app does not declare with let/const (EP, CFG, SESSION, UI are the host
 * page's own). ⚠️ NEVER the banned words on a screen — it is the Ledger / CB Accounts.
 */
'use strict';

/* ── the Ledger's boot endpoints ── */
var CB_BOOKS_EP = {
  booksHealth:     {m:"GET",  p:"/api/books/health",                      ok:"y"},   // 404 = the Ledger is off for this shop → the door stays hidden
  booksStatus:     {m:"GET",  p:"/api/books/status",                      ok:"y"},   // owner: { migrated, enabled, walkin_grain } — answers while off
  booksEnable:     {m:"POST", p:"/api/books/enable",                      ok:"y"},   // owner: the switch (Settings › Your business › Ledger)
  booksSetting:    {m:"POST", p:"/api/books/setting",                     ok:"y"},   // owner: { enabled:false } switches it off; nothing deleted
  booksDues:       {m:"GET",  p:"/api/books/dues",                        ok:"y"},   // every party's balance + oldest due in one read (the row chips)
  booksStatement:  {m:"GET",  p:"/api/books/party/:id/statement",         ok:"y"},
};

/* ── the party routes the app's Customers/Suppliers screens and CB CRM share (MOVED from app.html's EP, not copied: one name per endpoint,
   e2e/ep-aliases.cjs) — add a party, edit its fields, remove it, look someone up on ChitBridge ── */
var CB_PARTY_EP = {
  custGroup:       {m:"PATCH",p:"/api/relationships/customers/:id",       ok:"✓"},
  custAdd:         {m:"POST", p:"/api/relationships/customers",           ok:"✓"},   // { handle } on ChitBridge · { name, phone } a local party
  supAdd:          {m:"POST", p:"/api/relationships/suppliers", ok:"✓"},            // { supplier_bridge_id } · { name }
  supDel:          {m:"DELETE",p:"/api/relationships/suppliers/:id", ok:"✓"},
  supPatch:        {m:"PATCH", p:"/api/relationships/suppliers/:id", ok:"y"},       // Stage B — owner-side fields (nickname/preferred/notes/category)
  entitySearch:    {m:"GET",  p:"/api/entities/search",                    ok:"✓"},   // ?q= live recipient lookup (name/bridge_id)
  /* ⭐ read by BOTH CB CRM and CB Finance — one name, one place (the registry guard fails a second declaration) */
  crmParties:      {m:"GET",  p:"/api/crm/parties",                        ok:"y"},   // { parties:[…], alerts:{…} } — one read, no per-row fetch; terms.customer per party
  booksTerms:      {m:"GET",  p:"/api/books/terms",                        ok:"y"},   // ?party_id&side → { terms_migrated, may_set, why_not, default, party, events } — CB Finance sets, CRM reads
};

/* ── the chit sheet's three calls (chit-sheet.js reads one chit, moves its step, says what a bill's goods are for) —
   MOVED from app.html's EP so the app and CB Accounts open the same sheet through the same endpoints ── */
var CB_SHEET_EP = {
  chit:            {m:"GET",  p:"/api/chits/:id",                ok:"✓"},
  status:          {m:"PUT",  p:"/api/chits/:id/status",         ok:"✓"},
  billUse:         {m:"PUT",  p:"/api/chits/:id/use",            ok:"✓"},  // a bill I received: resale · use · asset (lib/bill-use), until accepted
};

/* ── the chit-sheet helpers both pages share (MOVED from app.html, not copied) ── */
/** is this entity me? by id when the session knows it, else by the shop's name */
function chitIsSelf(e,n){ return (SESSION.entityId&&e===SESSION.entityId)||(SESSION.entity&&String(n||"")===String(SESSION.entity)); }
/**
 * ⭐ WHAT THE GOODS ARE FOR — one tap before Accept (Athi, 2026-10-01). Nothing tapped: the shop's own catalogue decides
 * line by line (resale if it sells the product, else for the shop). Shown only when every chosen row is a bill received.
 * `pick` names the global the chips call with the chosen use (app.html's pickBillUse; the chit sheet's CBSheet.use).
 */
var BILL_USES=[['resale','For resale'],['use','For the shop'],['asset','An asset']];
function billUseChoiceHTML(rows, pick){
  var bills = rows.length > 0 && rows.every(function(r){ return r && r.billRx; });
  if(!bills) return '';
  return '<div data-testid="bill-use-choice" style="margin-top:10px"><div class="s">' + tx('What is it for?') + '</div>'
    + BILL_USES.map(function(u){ return '<button type="button" class="optchip" data-testid="bill-use-' + u[0] + '" data-use="' + u[0] + '" onclick="' + (pick || 'pickBillUse') + '(this.dataset.use)">' + tx(u[1]) + '</button>'; }).join(' ')
    + '<div class="s">' + tx('Not tapped: your catalogue decides') + '</div></div>';
}
/** ⭐ ONE COUNTER, ONE NAME: the bill's series is the counter ("C2/26-27/0007" → C2), as the Day book says it. The popup and the Day book both read these two. */
function counterOfBill(no, till){ var m=/^([A-Za-z0-9]+)\//.exec(String(no||'')); return m ? m[1] : ((till && (till.name||till.id)) || ''); }
function counterWord(c){ c=String(c==null?'':c).trim(); return c ? (/^counter\b/i.test(c) ? c : tx('Counter')+' '+c) : ''; }
/** the one status a move sends: a bill's acceptance is `accepted` (the ledger posts the purchase on it), a task's Act stays in_progress */
function statusWordFor(to, row){
  return ({ open:'pending', act:(row && row.billRx) ? 'accepted' : 'in_progress', close:'completed' })[to] || to;
}

/* ── the string door ── */
function cbLang(){ try{ return localStorage.getItem('cb_lang') || 'en'; }catch(_){ return 'en'; } }

/**
 * The string catalogue, keyed by the English. Empty for now on purpose: wrapping the labels and TRANSLATING them
 * are two different jobs, and doing the first does not pretend to have done the second. A language with no
 * entries here renders English, which is honest — unlike a half-filled map, which renders a screen in two
 * languages at once and reads as a broken product rather than an untranslated one.
 */
var CBSTR = { en: {}, fr: {}, ta: {}, hi: {}, ar: {} };

/**
 * ⭐⭐ tx(english, context) — THE ENGLISH IS THE KEY. This is GNU gettext's model, adopted rather than invented.
 *
 * ⚠️ WHY NOT MORE NAMED KEYS LIKE t(). `t('nav.suppliers', 'Suppliers')` is right for the fourteen rail items,
 * because they are a closed set built in one place. It does not scale to the 449 labels this app actually has:
 * every one would need a key invented for it, every new label would need a naming decision, and the moment a
 * label's words change its key stops describing it — leaving names like `cat.hdr2` that nobody can match to
 * anything on screen. gettext solved this in 1995 by making the source string its own identifier.
 *
 * ⚠️ SO AN UNTRANSLATED LABEL IS ALWAYS CORRECT ENGLISH, never a key leaking onto the screen. That property is
 * why this is safe to apply broadly: wrapping a label can change nothing except when a translation exists.
 *
 * ⚠️ CONTEXT USES gettext's OWN SEPARATOR (\u0004, EOT). "Open" is a verb on a button and an adjective on a
 * status chip, and Tamil does not use one word for both; `tx('Open','status')` disambiguates them without
 * abandoning the English-as-key model. Same convention, so any gettext tooling reads our catalogue unchanged.
 *
 * The catalogue of every string reaching here is generated by e2e/strings-extract.cjs — that file, not this one,
 * is what a translator is handed.
 */
function tx(english, context){
  var m = CBSTR[cbLang()];
  if (!m) return english;
  if (context) { var c = m[context + '\u0004' + english]; if (c) return c; }
  return m[english] || english;
}

/**
 * ⭐⭐ bidiWrap(v) — isolate a substituted VALUE from the sentence it lands in.
 *
 * ⚠️ THE BUG IT PREVENTS IS INVISIBLE IN ENGLISH AND WRONG IN ARABIC. Drop a Latin value into an Arabic sentence
 * and the Unicode bidi algorithm resolves the neutral characters around it — the comma, the dash, the question
 * mark — against the SENTENCE's direction rather than the value's:
 *
 *     txf('Remove {name} from your supplier list?', { name: 'Alpha Timers, Pvt' })
 *     in Arabic renders   Pvt ,Alpha Timers   — the comma has jumped to the wrong side of the name.
 *
 * ⭐ THE FIX IS TWO INVISIBLE CHARACTERS, NOT A RULE PER STRING. U+2068 FIRST STRONG ISOLATE opens a run whose
 * direction is decided by its own first strong character; U+2069 POP DIRECTIONAL ISOLATE closes it. This is
 * exactly what ICU MessageFormat does around its arguments — adopted rather than reinvented — and it means no
 * translator and no caller ever has to know the hazard exists.
 *
 * ⚠️ ONLY WHEN THE PAGE IS RTL. In a left-to-right page these characters change nothing a reader can see, but
 * they would still land inside every interpolated string — including any that reaches an HTML attribute or a
 * string comparison. Costing nothing to look at is not the same as being free, so they are added only where they
 * do work.
 */
function bidiWrap(v){
  try { if (document.documentElement.getAttribute('dir') !== 'rtl') return String(v); }
  catch (_) { return String(v); }
  return '⁨' + String(v) + '⁩';
}

function txf(english, vars){
  var out = tx(english);
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, function(whole, k){
    return Object.prototype.hasOwnProperty.call(vars, k) ? bidiWrap(vars[k]) : whole;
  });
}

/**
 * ⭐⭐ txn(one, other, n, vars) — a sentence whose wording depends on a COUNT.
 *
 * ⚠️ ENGLISH HAS TWO PLURAL FORMS AND THAT IS NOT UNIVERSAL. Arabic has SIX (zero, one, two, few, many,
 * other), Russian has three, Tamil and Chinese have one. So "1 product / 2 products" is an English fact rather
 * than a general one, and `n === 1 ? 'product' : 'products'` hard-codes English grammar into every screen that
 * counts anything.
 *
 * `Intl.PluralRules` knows the real answer per language, and the catalogue keys off the CATEGORY it returns —
 * which is why the stored key is `msgid\u0005category`, gettext's own plural convention. Until a translation
 * exists this falls back to the two English forms, which is exactly today's behaviour and no worse.
 *
 * ⚠️ `{count}` IS SUPPLIED AUTOMATICALLY, and formatted through the localisation layer — because a count is a
 * number, and a number is written differently in different places. Writing `n` into the string directly would
 * give an Arabic reader Western digits inside an Arabic sentence.
 */
function txn(one, other, n, vars){
  var count = Number(n) || 0;
  var cat = 'other';
  try { cat = new Intl.PluralRules(CBLocale.locale()).select(count); }
  catch (_) { cat = count === 1 ? 'one' : 'other'; }
  var m = CBSTR[cbLang()] || {};
  /* the exact category, then the catch-all, then English — never a key on screen */
  var s = m[one + '\u0005' + cat] || m[one + '\u0005other'] || (count === 1 ? one : other);
  var all = { count: CBLocale.number(count) };
  for (var k in (vars || {})) if (Object.prototype.hasOwnProperty.call(vars, k)) all[k] = vars[k];
  return s.replace(/\{(\w+)\}/g, function(whole, key){
    return Object.prototype.hasOwnProperty.call(all, key) ? bidiWrap(all[key]) : whole;
  });
}

/* ── a failure's words, and the toast ── */

function friendlyErr(e){ const m=(e&&e.message)||String(e||"");
  if(/Already working/i.test(m))            return "still finishing the last one — one moment";
  if(/session expired|sign in/i.test(m))    return "your session expired — please sign in again";
  if(/Failed to fetch|network/i.test(m))    return "network hiccup — check your connection and retry";
  return m || "something went wrong";
}

function toast(msg, undo){
  if(typeof cblog==='function') cblog(toastLevel(msg), msg);
  const t=document.getElementById("toast");
  const _lvl=toastLevel(msg); t.innerHTML=`<div class="toast ${_lvl==='error'?'err':_lvl==='warn'?'warn':''}">${esc(msg)}${undo?'<button id="undoBtn">' + tx('Undo') + '</button>':''}</div>`;
  if(undo){document.getElementById("undoBtn").onclick=()=>{undo();t.innerHTML="";};}
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.innerHTML="",4500);
}
function toastLevel(m){ const s=String(m);
  if(/couldn't|failed|server error|session expired|not allowed|something went wrong|⚠|🚫/i.test(s)) return 'error';
  if(/already|only |capped|required|first\.|coming soon|⏳|not yet|pick a|type a/i.test(s)) return 'warn';
  return 'info';
}

/**
 * ⭐ THE LEDGER'S SWITCH (Athi, 2026-10-01: "add the switch-on control in settings"; "bring the subscribe button there
 * itself" — CB Accounts). ONE definition of what the owner is asked, what is sent, and what happens after; the three
 * places that offer the switch differ only in the box they paint and the dialog they own, so each hands those in:
 *   io.ask(title, bodyHtml, okLabel, onOk, danger)   the page's own confirm (app: confirmAsk; the others: a <dialog>)
 *   io.working()                                      paint "Working…" where the switch was
 *   io.call(on)                                       the transport: POST /api/books/enable, or /setting {enabled:false}
 *   io.done(on) / io.failed(e)                        what the page does next
 * The server refuses anyone but the owner; the pages only offer the button to the owner.
 */
var CBLedger = (function () {
  var e = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function words(on) {
    return {
      title: on ? tx('Switch the Ledger on?') : tx('Switch the Ledger off?'),
      body: e(on ? tx('From today every bill, payment and expense is recorded. Nothing before today is.')
                 : tx('Nothing is deleted. Recording stops until it is switched on again.')),
      ok: on ? tx('Switch on') : tx('Switch off'),
    };
  }
  /** the one call, over the host's api() ({ api: api }): on → POST enable · off → POST setting { enabled:false } */
  function ledgerCall(host, on) { return on ? host.api('booksEnable', { body: {} }) : host.api('booksSetting', { body: { enabled: false } }); }
  function run(on, io) {
    var w = words(on), busy = false;
    io.ask(w.title, w.body, w.ok, async function () {
      if (busy) return; busy = true;     /* one tap, one call — a second confirm while the first is out is dropped */
      try { io.working(); await io.call(on); await io.done(on); }
      catch (err) { io.failed(err); }
      finally { busy = false; }
    }, !on);
  }
  return { words: words, call: ledgerCall, run: run };   /* a distinct inner name: e2e/screen-reads matches functions by NAME, and a bare call() matched "call(s)" in another screen's text */
})();

/**
 * ⭐⭐ CBAction — THE ACTION-STATE HELPER (M64, 2026-10-07). Every control that WRITES goes through this, so that three
 * promises hold everywhere instead of wherever somebody remembered them:
 *   1  ONE PRESS, ONE WRITE. While the action is out (or its confirm is open) the button is disabled + aria-busy, and a
 *      second press of the same action — the same `key`, even on a button a repaint replaced — is dropped.
 *   2  AN IRREVERSIBLE WRITE ASKS FIRST, in the page's own dialog (confirmAsk in the app; CBConfirm on CB Accounts / CRM /
 *      the index tile). Cancel, Escape or the backdrop sends nothing. Never the browser's confirm(): it blocks automation.
 *   3  THE OUTCOME IS SAID WHERE THE ACTION HAPPENED — `out` (an element or its id beside the control) or the toast.
 *      No silent success, no silent failure. A JavaScript error's text never reaches the person: only a server's own
 *      reason for refusing (a 4xx with words) is shown; everything else gets the caller's `failed` sentence.
 *
 *   CBAction.run(button, fn, {
 *     key,                       // the action's identity; default the button's data-testid or id
 *     confirm: { title, body, yes, danger },   // irreversible → ask first (body is HTML; escape what you put in it)
 *     busy,                      // optional words on the button while it works ("Recording…")
 *     out,                       // where to say the outcome (element or id); default the toast
 *     done,                      // the success sentence (when there is no outcome painter)
 *     outcome(value),            // paints the result where it happened — flip the ROW, never the screen
 *     failed,                    // the failure sentence when the server gave no reason
 *     onFail(words, err)         // the caller shows the failure itself (e.g. into the form)
 *   }) → Promise<{ ok, value, cancelled, skipped, error }>   — never throws
 *
 *   CBAction.once(key, button, fn) — the busy half alone, for a write whose caller already says its outcome
 *   (bkOnce in cap-books.js IS this, widened from there — one guard, not two).
 *   CBAction.words(err, fallback) — what a failure says to a person.
 *
 * The button carries data-action-state = busy · done · failed · idle, so a test (and a stylesheet) can read it.
 * Every writing control and whether it uses this: docs/ACTION-STATE-SWEEP.md (node scripts/action-state-sweep.cjs).
 */
var CBAction = (function () {
  var RUNNING = {};
  function actKey(btn, o) { return (o && o.key) || (btn && (btn.getAttribute('data-testid') || btn.id)) || null; }
  function actMark(btn, st) {
    if (!btn || !btn.setAttribute) return;
    btn.setAttribute('data-action-state', st);
    if (st === 'busy') { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); return; }
    btn.removeAttribute('aria-busy');
    if (btn.isConnected) btn.disabled = false;
  }
  function actTake(key, btn) {
    if (key && RUNNING[key]) return false;
    if (btn && btn.getAttribute && btn.getAttribute('aria-busy') === 'true') return false;
    if (key) RUNNING[key] = true;
    actMark(btn, 'busy');
    return true;
  }
  function actFree(key, btn, st) { if (key) delete RUNNING[key]; actMark(btn, st); }
  /** the page's own dialog → true (yes) / false (cancel). No dialog on the page = no irreversible write (never confirm()). */
  function actAsk(c) {
    return new Promise(function (res) {
      var f = (typeof confirmAsk === 'function') ? confirmAsk : (typeof CBConfirm === 'function' ? CBConfirm : null);
      if (!f) { if (typeof cblog === 'function') cblog('error', 'CBAction: no confirm dialog on this page — nothing sent'); res(false); return; }
      f(c.title, c.body || '', c.yes || tx('Confirm'), function () { res(true); }, c.danger !== false, function () { res(false); });
    });
  }
  /** what a failure SAYS. A server's own refusal (4xx with words) is meant for people; a thrown error's text is not. */
  function actWords(e, fallback) {
    var m = String((e && e.message) || '');
    if (/Already working/i.test(m)) return tx('Still finishing the last one — one moment');
    if (/session expired|sign in again/i.test(m)) return tx('Your session expired — please sign in again');
    if (/offline|Failed to fetch|network|No answer from the server/i.test(m)) return tx('No connection — nothing was sent. Try again');
    var st = e && e.status;
    if (st >= 400 && st < 500 && st !== 404 && m && !/^API \d/.test(m)) return m;
    return fallback || tx('That did not go through — try again');
  }
  function actSay(o, msg, lvl) {
    var el = o.out && (typeof o.out === 'string' ? document.getElementById(o.out) : o.out);
    if (el) { el.textContent = msg; el.setAttribute('data-tone', lvl || 'ok'); if (typeof cblog === 'function') cblog(lvl === 'error' ? 'error' : 'info', msg); return; }
    if (typeof toast === 'function') toast(msg);
  }
  async function actOnce(key, btn, fn) {
    var k = key || actKey(btn);
    if (!actTake(k, btn)) return;
    var st = 'failed';
    try { var v = await fn(); st = 'done'; return v; }
    finally { actFree(k, btn, st); }
  }
  async function actRun(btn, fn, o) {
    o = o || {};
    var k = actKey(btn, o), res = { ok: false };
    if (!actTake(k, btn)) { res.skipped = true; return res; }
    var label = null;
    try {
      if (o.confirm && !(await actAsk(o.confirm))) { res.cancelled = true; return res; }
      if (o.busy && btn && btn.isConnected) { label = btn.innerHTML; btn.textContent = o.busy; }
      var v = await fn();
      res.ok = true; res.value = v;
      if (v && v.queued) actSay(o, tx('Saved offline — it is sent when the connection is back'), 'warn');
      else if (typeof o.outcome === 'function') {
        /* the write HAS landed: a painter that throws must not turn it into a reported failure */
        try { o.outcome(v); } catch (pe) { if (typeof cblog === 'function') cblog('error', 'action ' + (k || '?') + ' outcome painter: ' + ((pe && pe.message) || pe)); actSay(o, o.done || tx('Done'), 'ok'); }
      }
      else actSay(o, o.done || tx('Done'), 'ok');
    } catch (e) {
      res.error = e;
      if (typeof cblog === 'function') cblog('error', 'action ' + (k || '?') + ' failed: ' + ((e && e.message) || e));
      var w = actWords(e, o.failed);
      if (typeof o.onFail === 'function') o.onFail(w, e); else actSay(o, w, 'error');
    } finally {
      if (label != null && btn && btn.isConnected) btn.innerHTML = label;
      actFree(k, btn, res.ok ? 'done' : res.error ? 'failed' : 'idle');
    }
    return res;
  }
  return { run: actRun, once: actOnce, words: actWords, ask: actAsk };
})();

/**
 * ⭐ THE CONFIRM FOR A PAGE THAT IS NOT THE APP — one native <dialog>, used by accounts.html (it is that page's confirmAsk)
 * and by the index tile's Switch on. Same signature as the app's confirmAsk(title, bodyHtml, okLabel, onOk, danger, onCancel);
 * bodyHtml is raw HTML (escape dynamic parts in the caller). The app keeps its own modal host — confirmAsk there is bound to
 * the app's modal system — so this is the page-level twin, not a second copy of the app's.
 * Cancel, Escape and a click on the backdrop all dismiss, and all call onCancel.
 */
function CBConfirm(title, bodyHtml, okLabel, onOk, danger, onCancel) {
  var e = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var old = document.getElementById('cb_confirm'); if (old) old.remove();
  var d = document.createElement('dialog'); d.id = 'cb_confirm'; d.setAttribute('data-testid', 'confirm');
  d.style.cssText = 'border:1px solid var(--line,#DDD6C6);border-radius:14px;padding:0;max-width:min(420px,92vw);width:100%;background:var(--card,#fff);color:var(--ink,#1D1B16);font:15px/1.45 "IBM Plex Sans",system-ui,sans-serif';
  d.innerHTML = '<form method="dialog" style="margin:0;padding:20px 20px 16px;display:flex;flex-direction:column;gap:12px">'
    + '<div style="font-weight:700;font-size:18px">' + e(title) + '</div>'
    + '<div style="color:var(--muted,#5E594D)">' + bodyHtml + '</div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">'
    + '<button type="button" data-testid="confirm-cancel" style="min-height:44px;padding:0 16px;border:1px solid var(--line,#DDD6C6);border-radius:9px;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer">' + e(tx('Cancel')) + '</button>'
    + '<button type="button" data-testid="confirm-ok" style="min-height:44px;padding:0 18px;border:1px solid ' + (danger ? 'var(--red-i,#8E3517)' : 'var(--green,#16693F)') + ';border-radius:9px;background:' + (danger ? 'var(--red-i,#8E3517)' : 'var(--green,#16693F)') + ';color:#fff;font:inherit;font-weight:700;cursor:pointer">' + e(okLabel || tx('Confirm')) + '</button>'
    + '</div></form>';
  document.body.appendChild(d);
  var done = false;
  var close = function (yes) {
    if (done) return; done = true;
    try { d.close(); } catch (_) {}
    d.remove();
    if (yes) onOk(); else if (onCancel) onCancel();
  };
  d.querySelector('[data-testid="confirm-ok"]').onclick = function () { close(true); };
  d.querySelector('[data-testid="confirm-cancel"]').onclick = function () { close(false); };
  d.addEventListener('cancel', function (ev) { ev.preventDefault(); close(false); });
  d.addEventListener('click', function (ev) { if (ev.target === d) close(false); });
  d.showModal();
}
