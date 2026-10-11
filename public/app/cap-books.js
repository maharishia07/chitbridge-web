/* cap-books.js — THE LEDGER: parties, statements, payments, day book, trial balance, P&L, balance sheet, dues, month
 * lock, handover packs. Loaded on demand (ensureCap('books')). Contract: C:\dev\SPEC-books-v2.md §4–§5.
 *
 * ⚠️⚠️ STANDING RULE (Athi, 2026-09-28): this is NEVER called "accounting" or "books of account" on a screen. The door
 * says Ledger; the tabs say Day book, Ledgers, Trial balance, P&L, Balance sheet, Dues, Month lock, Packs.
 * ⭐ Every figure is the SERVER's (routes/books.js reads stored balances); this file never adds up entries itself —
 * a second opinion about what somebody owes is exactly what must not exist. Money arrives in integer MINOR units
 * and is shown through CBMoney.decimals + CBLocale.money, never rounded here.
 * ⭐ The two panels Athi named are the way in for parties (Customers / Suppliers): partyBooksHTML and
 * partyDueChipHTML are called from app.html's own row and detail painters, only once this file has loaded.
 */
'use strict';
if (typeof EP !== 'undefined') { Object.assign(EP, {
  booksAccounts:   { m: 'GET',  p: '/api/books/accounts' },
  booksAccountAdd: { m: 'POST', p: '/api/books/accounts' },
  booksDaybook:    { m: 'GET',  p: '/api/books/daybook' },
  booksLedger:     { m: 'GET',  p: '/api/books/ledger/:account' },
  booksTB:         { m: 'GET',  p: '/api/books/trial-balance' },
  booksPL:         { m: 'GET',  p: '/api/books/pl' },
  booksBS:         { m: 'GET',  p: '/api/books/bs' },
  booksPayRecord:  { m: 'POST', p: '/api/books/payments' },
  booksPayPreview: { m: 'POST', p: '/api/books/payments/preview' },   /* M26: the bills table + the duplicate warnings; writes nothing */
  booksLock:       { m: 'POST', p: '/api/books/periods/:fy/:p/lock' },
  booksUnlock:     { m: 'POST', p: '/api/books/periods/:fy/:p/unlock' },
  booksPeriods:    { m: 'GET',  p: '/api/books/periods' },   /* every month of every year, with its status — the twelve rows of Month lock */
  booksOpening:    { m: 'POST', p: '/api/books/opening' },
  booksPacks:      { m: 'GET',  p: '/api/books/packs' },
  booksPackBuild:  { m: 'POST', p: '/api/books/packs' },
  booksPackGet:    { m: 'GET',  p: '/api/books/packs/:id' },
  booksPackFile:   { m: 'GET',  p: '/api/books/packs/:id/file' },   /* the zip itself — fetched as bytes (bkPackGet), never through api() */
  booksPackAck:    { m: 'POST', p: '/api/books/packs/:id/ack' },
  booksCheques:    { m: 'GET',  p: '/api/books/cheques' },           /* the cheques still held, each with the steps it may take next */
  booksChequeStep: { m: 'POST', p: '/api/books/cheques/:id/status' },
  booksRetry:      { m: 'POST', p: '/api/books/outbox/retry' },
  booksTodo:       { m: 'GET',  p: '/api/books/todo' },              /* what the owner has to do next — the API lists the checks; the To-do page only draws them */
}); }

/**
 * ⚠️⚠️ ONE TAP, ONE RECORD (2026-09-30, review M11). Two taps on Next recorded two payments; opening balances pressed
 * twice doubled every balance. Two halves, both needed:
 *   · bkOnce — the button is dead while its call is out, and a second call with the same key is dropped
 *   · bkRef  — every form that records money carries ONE client_ref from the moment it opens: sent again on a retry
 *              (so the server answers with what it already kept), replaced only after the server said yes
 */
/* ⭐ M64: WIDENED into CBAction (app/accounts-shell.js) — the guard every page shares; bkOnce keeps its name for its callers */
function bkOnce(key, btn, fn) { return CBAction.once(key, btn, fn); }
function bkRef() {
  var r = '';
  try { var a = new Uint8Array(8); crypto.getRandomValues(a); r = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  catch (_) { r = Math.floor(Math.random() * 1e12).toString(16); }
  return 'web-' + Date.now().toString(36) + '-' + r;
}

/* the tables' look, once, the way cap-categories does it (cbcatCss) */
function bkCss() {
  if (typeof document === 'undefined' || document.getElementById('bk_css')) return;
  var s = document.createElement('style'); s.id = 'bk_css';
  s.textContent = [
    '.bktab th{font-size:var(--fs-1);color:var(--grey);font-weight:600;text-transform:uppercase;text-align:start;padding:5px 7px;border-bottom:1px solid var(--line)}',
    '.bktab td{padding:5px 7px;border-bottom:1px dashed var(--line);vertical-align:top}',
    '.bktab .num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.bktab tfoot td{border-top:1px solid var(--ink);border-bottom:0}',
    /* ZEBRA (Athi, 2026-10-09) — the ledger and statement tables, the same one rule as CBList's rows: every other body row, from the theme's --zebra (else the ink mixed 4% into the card) */
    '.bktab tbody tr:nth-child(even){background:var(--zebra,color-mix(in srgb,var(--ink) 9%,var(--card)))}',
    '.bktab tr.bkentry td{border-top:1px solid var(--line);font-weight:600}',
    '#bk_body input[type=date].inp,#bk_body select.inp,#bk_body .supacts .inp{width:auto}',
    /* the primary button of a pane's action row (Pay · Receive · Edit · Lock …) — once here, so accounts.html, crm.html and the app read the same */
    '.supacts button.supact-pri,#bk_body .supacts button.supact-pri{background:var(--accent);border-color:var(--accent);color:var(--accent-ink,var(--on-accent))}',
    /* ⭐ THE MONEY INPUT (bkMoneyInput): the symbol sits inside the field, the figure runs to the end; the box is the field's, so the symbol never wraps off */
    '.mi{display:flex;align-items:center;gap:6px;box-sizing:border-box;width:100%;max-width:100%;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink)}',
    '.mi:focus-within{border-color:var(--blue)}',
    '.mi .mi-sym{color:var(--grey);flex:0 0 auto}',
    '.mi input.mi-in,#entrysheet .mi input.mi-in{flex:1 1 auto;min-width:0;width:100%;min-height:0;height:auto;padding:8px 0;border:0;border-radius:0;outline:0;background:none;color:inherit;font:inherit;text-align:end;font-variant-numeric:tabular-nums;box-shadow:none}',
    /* the strip's chips: .optchip is inline-flex, which swallows the whitespace between its text and the figure */
    '.bkchip{gap:4px}',
    /* the day's to-do: one card per line on a narrow pane (flex-basis folds them at ~620px), tappable, phone first */
    '.bktodo{flex:1 1 240px;min-width:0;display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--card);border-radius:12px;padding:10px 12px;font-size:var(--fs-2);font-weight:600;cursor:pointer;text-align:start;color:inherit}',
    '.bktodo b{font-variant-numeric:tabular-nums;font-size:var(--fs-3);color:var(--warn-2)}',
    '.bktodo .bkgo{margin-inline-start:auto;color:var(--grey)}',
    /* the Day book's toolbar: the Day / Week / Month switch beside list-ctl's search · filters · sort. The ROWS are the Task table (list-ctl.js tbl*) — nothing here draws a row. */
    '.bkdv-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0}',
    '.bkdv-segs{display:inline-flex;gap:0}',
    '.bkdv-seg[aria-pressed=true]{background:var(--blue-tint);color:var(--blue-d);border-color:var(--blue-d);font-weight:700}',
    '.bkdv-count{color:var(--grey);font-size:var(--fs-1);margin:6px 0}',
    /* ⭐ THE LEDGERS PAGE (docs/design/ledgers-page, 2026-10-03): two panes — the ledger tree and the list (CBList) — inside one container, so the PANE decides phone or laptop, not the window.
       Tokens only; the tree is its own pane (more panes, not denser), the list is the Task table. */
    '#bk_lt{container:lt/inline-size;display:flex;height:100%;min-height:min(50vh,480px)}',
    '#bk_lt .lt-tree{width:min(var(--lt-w,320px),30%);flex:0 0 auto;display:flex;flex-direction:column;min-height:0;background:var(--page,var(--paper,#FCFAF5));border-top:1px solid var(--line)}',
    '#bk_lt.folded .lt-tree,#bk_lt.folded .lt-rz{display:none}',
    '#bk_lt .lt-tools{display:flex;gap:6px;align-items:center;padding:8px 10px 8px 16px}',
    '#bk_lt .lt-search{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--card);border-radius:9px;padding:0 10px;height:34px;font-size:var(--fs-2)}',
    '#bk_lt .lt-search input{border:0;outline:0;background:none;flex:1;min-width:0;font:inherit;color:var(--ink);padding:0;margin:0;height:auto;box-shadow:none}',
    '#bk_lt .lt-search:focus-within{border-color:var(--blue)}',
    '#bk_lt .lt-btn{height:34px;min-height:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:9px;padding:0 10px;font:inherit;font-size:var(--fs-2)}',
    '#bk_lt .lt-ico{width:34px;padding:0}',
    '#bk_lt .lt-list{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:2px 6px 24px 8px}',
    '#bk_lt .lt-rz{flex:0 0 9px;margin-inline:-4px;position:relative;z-index:6;cursor:col-resize;border:0;background:none;padding:0;min-height:0}',
    '#bk_lt .lt-rz::after{content:"";position:absolute;inset-inline-start:4px;top:0;bottom:0;width:1px;background:var(--line)}',
    '@container lt (max-width:1100px) and (min-width:621px){#bk_lt{position:relative}#bk_lt:not(.folded) .lt-tree{position:absolute;inset:0 auto 0 0;z-index:30;width:min(var(--lt-w,320px),70%);box-shadow:var(--shadow,0 10px 28px rgba(0,0,0,.16));border-inline-end:1px solid var(--line)}#bk_lt:not(.folded) .lt-rz{display:none}#bk_lt.has-sel:not(.folded) .lt-pane{pointer-events:none}}',
    '#bk_lt .lt-rz:hover::after,#bk_lt .lt-rz:focus-visible::after,#bk_lt .lt-rz.drag::after{width:3px;inset-inline-start:3px;background:var(--blue)}',
    '#bk_lt .lt-pane{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}',
    '#bk_lt #lg_out{flex:1 1 auto;min-height:0}',
    '#bk_lt .lt-pane > .empty,#bk_lt .lt-pane > div:not(#lg_out){margin:24px auto}',
    '#bk_lt .lt-empty{padding:24px 12px;color:var(--grey);text-align:center;font-size:var(--fs-2)}',
    /* a node: ONE line — a name that cannot fit WRAPS (never clipped); the figure is one fixed column so every figure lines up; the chosen one a 3 px bar and a light tint */
    '#bk_lt .tn{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:start;gap:0 6px;width:100%;border:0;background:none;text-align:start;border-radius:8px;padding:6px 8px 6px calc(6px + var(--lvl,0) * 14px);position:relative;color:var(--ink);min-height:34px;font:inherit;font-size:var(--fs-2);cursor:pointer}',
    '#bk_lt .tn:hover{background:var(--panel)}',
    '#bk_lt .tn .tw{width:16px;text-align:center;line-height:1.45}',
    '#bk_lt .tn .nm{min-width:0;overflow-wrap:normal;word-break:normal;hyphens:manual;line-height:1.35;padding-top:1px}',
    '#bk_lt .tn .am{font-family:var(--f-num,"IBM Plex Mono",ui-monospace,monospace);font-variant-numeric:tabular-nums;font-size:calc(var(--fs-2) * .95);color:var(--grey);white-space:nowrap;text-align:end;min-width:var(--am-w,12ch);padding-top:2px}',
    '#bk_lt .tn .am.nil{color:var(--faint,var(--grey));opacity:.8}',
    '#bk_lt .tn .ck{color:var(--green);font-weight:700;margin-inline-end:4px}',
    '#bk_lt .tn.band{font-size:var(--fs-1);font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--grey);margin-top:10px}',
    '#bk_lt .tn.band:first-child{margin-top:2px}',
    '#bk_lt .tn.band .am,#bk_lt .tn.grp .am{font-family:var(--f-num,"IBM Plex Mono",monospace);letter-spacing:0;text-transform:none;font-weight:400;min-width:0}',
    '#bk_lt .tn.grp{font-weight:600;color:var(--grey)}',
    '#bk_lt .tn.party .nm{color:var(--grey)}',
    '#bk_lt .tn.on{background:color-mix(in srgb,var(--blue-tint-bg,var(--blue-t,#E4EEFA)) 60%,transparent);color:var(--blue-2,var(--blue-i,#174A87));font-weight:600}',
    '#bk_lt .tn.on::before{content:"";position:absolute;inset-inline-start:0;top:6px;bottom:6px;width:3px;border-radius:3px;background:var(--blue-2,var(--blue-i,#174A87))}',
    '#bk_lt .tn.on .nm,#bk_lt .tn.on .am{color:inherit}',
    '#bk_lt .tn mark{background:var(--amber-t,var(--warn-tint,#FDF3DC));color:inherit;border-radius:3px;box-shadow:0 0 0 1px var(--amber-b,#EFD39A)}',
    '#bk_lt .tn:focus-visible,#bk_lt .lt-btn:focus-visible,#bk_lt .lt-rz:focus-visible{outline:2px solid var(--blue);outline-offset:-2px}',
    /* the opened entry: its journal never scrolls sideways (a long ledger name wraps) and its quiet facts line */
    '#bk_lt .cbl-nrow > span:first-child{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere}#bk_lt .cbl-next{overflow-x:hidden}',
    '#bk_lt .lg-facts{display:flex;flex-wrap:wrap;gap:2px 0;color:var(--grey);font-size:var(--fs-1);margin:8px 0 0}',
    '#bk_lt .lg-facts > span:not(:last-child)::after{content:"·";margin:0 7px;opacity:.7}',
    /* phone: the tree is page one, the ledger page two (list → detail → back); no squeezed side panel */
    '@container lt (max-width:620px){#bk_lt .lt-tree{width:100%;border-top:0}#bk_lt .lt-rz,#bk_lt [data-lt="fold"]{display:none}#bk_lt.has-sel .lt-tree{display:none}#bk_lt:not(.has-sel) .lt-pane{display:none}#bk_lt .tn{min-height:44px;padding-block:10px}#bk_lt .tn.band{min-height:40px}#bk_lt .lt-tools{padding:8px 16px}#bk_lt .cbl-nrow > span:not(:first-child){width:auto!important;min-width:76px;padding-inline-start:10px;white-space:nowrap}',
    /* the ledger page's title row on a phone: ‹ title … bell · home · avatar on line one (R06: the bell takes ~36 px of it); the period, the figures and the notice on line two (the slot dissolves so each of its buttons takes its own place) */
    '#bk_lt .cbl-title .cbl-slot{display:contents!important}#bk_lt .cbl-title h1{flex:1 1 calc(100% - 186px);min-width:0;order:0}#bk_lt .cbl-title .cbb-btn{min-width:0;height:34px;padding:0 6px;font-size:15px;line-height:1}#bk_lt .cbl-title [data-lt="back"]{order:-1}#bk_lt .cbl-title .who{order:1}#bk_lt .cbl-title [data-lt="statement"],#bk_lt .cbl-title > .cbl-anchor,#bk_lt .cbl-title > .cbl-chip{order:2}}',
    /* on a phone the tapped view covers the rail — the way back must be visible (cb-design: .dback is desktop-hidden) */
    '#bk_back{display:none}',
    '.appwrap.m .panel.showdetail #bk_back{display:block;padding:10px 13px 0}',
  ].join('\n');
  document.head.appendChild(s);
}
bkCss();

/* ── money and dates: through the engines, never by hand ── */
function bkCur(c) { return c || (typeof SESSION !== 'undefined' && SESSION.currency) || 'INR'; }
function bkDec(c) { try { return CBMoney.decimals(bkCur(c)); } catch (_) { return 2; } }
function bkMoney(minor, c) {
  var n = Number(minor || 0) / Math.pow(10, bkDec(c));
  try { return CBLocale.money(n, bkCur(c)); } catch (_) { return n.toFixed(bkDec(c)); }
}
/** a balance the way a ledger writes it: the amount, then Dr or Cr — never a minus sign (the server's figure is Dr − Cr) */
function bkDrCr(v, c) { v = Number(v || 0); return bkMoney(Math.abs(v), c) + (v ? ' ' + tx(v > 0 ? 'Dr' : 'Cr') : ''); }
/** ⭐ A BALANCE IN WORDS, never a minus (spec T59; R30): the server's dues figure is signed, + they owe you. Chips and sentences say it; a ledger table says Dr/Cr (bkDrCr above). */
function bkOwes(v, c) { v = Number(v || 0); return v ? tx(v > 0 ? 'they owe you' : 'you owe') + ' ' + bkMoney(Math.abs(v), c) : tx('settled'); }
function bkToMinor(v, c) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? Math.round(n * Math.pow(10, bkDec(c))) : NaN; }
/**
 * ⭐⭐ THE ONE MONEY INPUT (M36 · R16 · T16): every amount a person TYPES goes through bkMoneyInput, and every amount SHOWN goes through bkMoney / bkDrCr / bkOwes.
 * The unit owns three things and does no money arithmetic: the SYMBOL (CBLocale.symbol), the DECIMALS (CBMoney.decimals via bkDec — 2 for INR, 0 for JPY, 3 for OMR) and
 * MINOR UNITS out (bkMoneyRead — digits are joined as text, never multiplied). The field holds plain decimal text, so a screen's own reader (bkToMinor) still agrees with it.
 * A bare <input inputmode="decimal"> anywhere in CB Accounts or CB CRM fails the build (e2e/money-input-guard.cjs).
 *   o: { id, tid?, minor? | text?, cur?, ph?, on? (inline js run on input), extra? (raw attrs on the input), w? (css width of the whole field) }
 */
function bkMinorText(minor, c) {
  var d = bkDec(c), n = Math.trunc(Number(minor || 0)), s = String(Math.abs(n));
  if (!d) return (n < 0 ? '-' : '') + s;
  s = s.padStart(d + 1, '0');
  return (n < 0 ? '-' : '') + s.slice(0, -d) + '.' + s.slice(-d);
}
function bkMoneyClamp(el) {
  var d = bkDec(el.getAttribute('data-cur')), t = String(el.value || '').replace(/[^0-9.]/g, ''), i = t.indexOf('.');
  if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '').slice(0, d);
  if (d === 0) t = t.replace(/\./g, '');
  if (t !== el.value) el.value = t;
}
function bkMoneyInput(o) {
  var c = bkCur(o.cur), tid = o.tid || o.id, v = o.text != null ? o.text : (o.minor != null && o.minor !== '' ? bkMinorText(o.minor, c) : '');
  var sym = ''; try { sym = CBLocale.symbol(c); } catch (_) { sym = c; }
  return '<span class="mi"' + (o.w ? ' style="width:' + o.w + '"' : '') + '><span class="mi-sym" aria-hidden="true">' + esc(sym) + '</span>'
    + '<input class="mi-in" id="' + o.id + '" data-testid="' + esc(tid) + '" data-money="1" data-cur="' + esc(c) + '" inputmode="decimal" autocomplete="off" placeholder="' + esc(o.ph != null ? o.ph : bkMinorText(0, c)) + '"'
    + ' value="' + esc(v) + '" oninput="bkMoneyClamp(this);' + (o.on || '') + '"' + (o.extra ? ' ' + o.extra : '') + '></span>';
}
/** the text a money field holds → minor units: an integer, or NaN when it is empty, not a number, or has more decimals than the currency */
function bkMoneyMinor(text, c) {
  var d = bkDec(c), m = /^(\d*)(?:\.(\d*))?$/.exec(String(text == null ? '' : text).replace(/[,\s]/g, ''));
  if (!m || (!m[1] && !m[2]) || (m[2] || '').length > d) return NaN;
  return Number((m[1] || '0') + (m[2] || '').padEnd(d, '0'));
}
/** the minor units a money field (by id or element) holds — its own currency, read from the field */
function bkMoneyRead(idOrEl) {
  var el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  return el ? bkMoneyMinor(el.value, el.getAttribute('data-cur')) : NaN;
}
function bkDate(d) { if (!d) return '—'; try { return CBLocale.date(d); } catch (_) { return String(d).slice(0, 10); } }
function bkToday() { return new Date().toISOString().slice(0, 10); }
/* ── CB Finance · Terms (F2): the words for a term and for a change to one — read by the Finance Terms tab AND the CRM record (one wording, two screens) ── */
var BK_TERM_FIELD = { credit_days: 'Credit days', credit_limit_minor: 'Credit limit', interest: 'Interest', early: 'Early pay', allowed: 'Over limit allowed' };
function bkTermVal(f, v, c) {
  if (v == null || v === '') return tx('not set');
  if (f === 'credit_limit_minor' || f === 'allowed') return bkMoney(Number(v), c);
  if (f === 'interest' || f === 'early') {
    try { var o = typeof v === 'string' ? JSON.parse(v) : v;
      return f === 'interest' ? (o.on ? o.rate_pct + '%' : tx('off')) + (o.grace_days ? ' · ' + txf('{n} days grace', { n: o.grace_days }) : '')
        : o.pct + '% ' + txf('within {n} days', { n: o.within_days }); } catch (_) { return String(v); }
  }
  return String(v);
}
/** the change events the server lists (newest first): date · what · from → to */
function bkTermEvents(list, c, tid) {
  if (!list || !list.length) return '<div class="hint" data-testid="' + tid + '-none">' + esc(tx('No changes yet')) + '</div>';
  return list.map(function (x, i) {
    var f = String(x.field || '').replace(/^(customer|supplier)./, '');
    return '<div class="kv" data-testid="' + tid + '-' + i + '"><b style="flex:0 0 96px">' + esc(bkDate(x.at)) + '</b><span>' + esc(tx(BK_TERM_FIELD[f] || f)) + ': ' + esc(bkTermVal(f, x.old, c)) + ' → ' + esc(bkTermVal(f, x.new, c)) + '</span></div>';
  }).join('');
}
/** ⭐ ONE door for a failure's words: the app's verdict table (friendlyErr, app.html) first, the screen's own fallback
 *  when the server said nothing — never a second table here, never a raw message pasted into a pane. */
function bkWhy(e, fallback) {
  var m = (e && e.message) || '';
  if (!m) return fallback || tx('Could not be read');
  return typeof friendlyErr === 'function' ? friendlyErr(e) : m;
}
function bkErr(e) { return esc(bkWhy(e, tx('Could not be read'))); }

/* ══ 1 · THE PANELS' HALF — a chip on each row, a block in each detail pane ═══════════════════════════════════ */
var BK = { dues: null, duesAt: 0, stmt: {}, tab: 'daybook' };
/** the /dues answer becomes the party map (party_id → no · name · balance) every screen reads — one place stores it */
function bkDuesStore(r) {
  BK.dues = {}; BK.duesCur = (r && r.currency) || null; BK.duesAt = Date.now();
  ((r && r.parties) || []).forEach(function (p) { BK.dues[p.party_id] = p; });
  return BK.dues;
}
/** ⭐ A ROW NAMES ITS PARTY (Athi, 2026-10-02): "P-0007 · Chola Auto Care" from the dues map; the name alone if there is no number; never the bare id */
function bkPartyLabel(partyId, fallbackName) {
  var d = partyId && BK.dues && BK.dues[partyId];
  var name = (d && d.name) || fallbackName || '', no = d && d.party_no;
  return no && name ? no + ' · ' + name : (name || no || '');
}
/** ⭐ ONE READ for every row's chip: /dues answers all parties at once (stored balances, not a scan) */
async function booksDuesLoad(force) {
  if (!force && BK.dues && Date.now() - BK.duesAt < 30000) return BK.dues;
  try {
    bkDuesStore(await api('booksDues', { query: { asOf: bkToday() } }));
  } catch (_) { BK.dues = BK.dues || {}; }
  try { if (typeof paintCustList === 'function' && document.getElementById('cu_rows')) paintCustList(); } catch (_) {}
  try { if (typeof paintSupList === 'function' && document.getElementById('sup_rows')) paintSupList(); } catch (_) {}
  /* the open party block was painted before the balances arrived — repaint that pane (never a modal) */
  try {
    if (document.querySelector('#detailpane [data-testid^="party-books-"]') && typeof paintCustDetail === 'function' && UI.nav === 'customers') paintCustDetail();
    if (document.querySelector('#supslide [data-testid^="party-books-"]') && typeof paintSupSlide === 'function') paintSupSlide();
  } catch (_) {}
  return BK.dues;
}
/** the row chip: what this party owes you (or you them), and the oldest due date */
function partyDueChipHTML(partyId, opts) {
  var d = BK.dues && BK.dues[partyId]; if (!d) return '';
  var no = opts && opts.noNo ? '' : esc(d.party_no || '') + ' · ';   /* CB CRM names the party in the same row: its number is not said twice */
  var b = Number(d.balance_minor || 0); if (!b) return '<span class="optchip" data-testid="party-due-' + esc(partyId) + '" style="color:var(--grey)">' + no + tx('settled') + '</span>';
  var owes = b > 0;
  return '<span class="optchip" data-testid="party-due-' + esc(partyId) + '" title="' + esc(owes ? tx('They owe you') : tx('You owe them')) + (d.oldest_due ? ' · ' + esc(tx('oldest due')) + ' ' + esc(bkDate(d.oldest_due)) : '') + '"'
    + ' style="' + (owes ? 'background:var(--warn-tint);color:var(--warn-2);border-color:var(--warn-2)' : 'background:var(--blue-tint);color:var(--blue-d);border-color:var(--blue-d)') + '">'
    + no + esc(bkOwes(b, BK.duesCur)) + '</span>';
}
/**
 * ⭐ THE PARTY BLOCK in the Customer detail and the Supplier record: who they are for the ledger (party no, legal
 * name, nickname, tax ids, credit terms), what stands between you (balance, oldest due), their statement, and the
 * one action — Receive (a customer) / Pay (a supplier).
 */
function partyBooksHTML(kind, partyId, row, moneyOnly) {   /* moneyOnly (the CRM record, C5/C19): the section already has its title, the head has Edit and Pay/Receive - this block is the money and the statement */
  if (!partyId) return '';
  var d = (BK.dues && BK.dues[partyId]) || {};
  var r = row || {};
  var kv = function (l, v) { return '<div class="kv" style="display:flex;gap:8px;padding:9px 13px;border-bottom:1px dashed var(--line);font-size:var(--fs-2)"><b style="min-width:112px;color:var(--grey);font-weight:600;font-size:var(--fs-1);text-transform:uppercase">' + l + '</b><span style="font-weight:600;flex:1">' + (v == null || v === '' ? '—' : v) + '</span></div>'; };
  var tax = (r.tax_ids || []).map(function (t) { return esc(t.scheme) + ' <span class="mono">' + esc(t.value) + '</span>'; }).join(' · ');
  var b = Number(d.balance_minor || 0);
  var act = kind === 'supplier' ? tx('Pay') : tx('Receive');
  setTimeout(function () { partyStatementLoad(partyId); }, 0);
  return (moneyOnly ? '' : '<div class="sec">' + tx('Ledger') + '</div>')
    + '<div class="itab" data-testid="party-books-' + esc(partyId) + '" style="border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:12px">'
    + (moneyOnly ? '' : kv(tx('Party no'), '<span class="mono" data-testid="party-no">' + esc(d.party_no || r.party_no || '—') + '</span>')
    + kv(tx('Legal name'), esc(r.legal_name || ''))
    + kv(tx('Nickname'), esc(r.nickname || ''))
    + kv(tx('Tax ids'), tax))
    + kv(tx('Credit'), (r.credit_days != null ? txf('{n} days', { n: r.credit_days }) : '—') + (r.credit_limit_minor != null ? ' · ' + tx('limit') + ' ' + esc(bkMoney(r.credit_limit_minor)) : ''))
    + kv(tx('Balance'), '<b data-testid="party-balance"' + (b ? '' : ' style="color:var(--grey);font-weight:400"') + '>' + esc(bkOwes(b, BK.duesCur)) + '</b>')
    + kv(tx('Oldest due'), d.oldest_due ? esc(bkDate(d.oldest_due)) : '—')
    + (moneyOnly ? '' : '<div class="supacts" style="display:flex;gap:7px;padding:9px 13px;flex-wrap:wrap">'
    + '<button data-testid="party-edit" onclick="partyEditOpen(\'' + kind + '\',\'' + esc(partyId) + '\')">' + tx('Edit') + '</button>'
    + '<button class="supact-pri" data-testid="party-pay" onclick="payOpen(\'' + kind + '\',\'' + esc(partyId) + '\')">' + act + '</button></div>')
    + '<div id="bk_stmt_' + esc(partyId) + '" data-testid="party-statement" style="padding:9px 13px;font-size:var(--fs-1);color:var(--grey)">' + tx('Reading…') + '</div>'
    + '</div>';
}
async function partyStatementLoad(partyId) {
  var box = document.getElementById('bk_stmt_' + partyId); if (!box || box.getAttribute('data-done') === '1') return;
  box.setAttribute('data-done', '1');
  if (BK.stmt[partyId]) { box.style.color = ''; box.innerHTML = statementHTML(BK.stmt[partyId]); return; }
  try {
    var r = await api('booksStatement', { params: { id: partyId } });
    BK.stmt[partyId] = r;
    box = document.getElementById('bk_stmt_' + partyId); if (!box) return;
    box.style.color = ''; box.innerHTML = statementHTML(r);
  } catch (e) { box = document.getElementById('bk_stmt_' + partyId); if (box) box.innerHTML = bkErr(e); }
}
/**
 * ⭐ WHERE AN ENTRY CAME FROM (Athi, 2026-10-01, the first real entry: "where is it referenced to the sale record, how do I
 * connect to the sale record, who has done it?"). The server's `source` (routes/books.js sourceOf) becomes the parts after
 * the entry's word: "Bill C2/26-27/0002 · Counter C2 · Athi" — the number is a link that opens the chit; a walk-in day
 * reads "12 bills · Counter C2". A part the server did not know is left out, never guessed. No source → ''.
 */
/** a walk-in day's "N bills": opens the bills it covers, each one a link to its chit (the server names them in source.bills; without them it is only the count) */
function bkDayBillsLink(s, tid) {
  var word = esc(txn('{count} bill', '{count} bills', s.count));
  if (!s.bills || !s.bills.length) return word;
  var BKD = (BK.dayBills = BK.dayBills || {}); BKD[tid] = s.bills;
  return '<a href="#" data-testid="' + esc(tid) + '-bills" onclick="event.stopPropagation();bkDayBillsOpen(\'' + esc(tid) + '\');return false">' + word + '</a>';
}
function bkDayBillsOpen(tid) {
  var bills = (BK.dayBills || {})[tid] || [];
  /* M132b: the shared popover look (the cb-design tokens: card ground, line, radius, readable size) - the sheet host (accounts.html) carries no .mhd/.mbody/.mfoot of its own */
  var pad = 'padding:14px 18px;font-size:var(--fs-3,15px);color:var(--ink,#2a2418)';
  modal('<div style="min-width:min(300px,86vw);background:var(--card,#fffdf8);border-radius:12px">'
    + '<div data-testid="daybills_title" style="' + pad + ';font-weight:700;border-bottom:1px solid var(--line,#e3dccb)">' + esc(txn('{count} bill', '{count} bills', bills.length)) + '</div>'
    + '<div data-testid="daybills_list" style="' + pad + ';max-height:54vh;overflow-y:auto">'
    + bills.map(function (b, i) { return '<div style="padding:6px 0">' + bkBillPart({ ref: b.ref, chit_id: b.chit_id }, 'daybills-' + i) + '</div>'; }).join('') + '</div>'
    + '<div style="padding:12px 18px;border-top:1px solid var(--line,#e3dccb);display:flex;justify-content:flex-end"><button data-testid="daybills_close" onclick="closeModal()" style="min-height:44px;padding:8px 18px;border:1px solid var(--line,#e3dccb);border-radius:9px;background:var(--card,#fffdf8);color:var(--ink,#2a2418);font-size:var(--fs-3,15px);font-weight:600;cursor:pointer">' + esc(tx('Close')) + '</button></div></div>');
}
/** a long payment reference, readable: its first and last four (4421…9931) — the full one is on the chit */
function bkShortRef(r) { var t = String(r == null ? '' : r).trim(); return t.length > 10 ? t.slice(0, 4) + '…' + t.slice(-4) : t; }
var BK_SRC_WORD = { bill: 'Bill', purchase: 'Bill', receipt: 'Receipt', payment: 'Payment', credit_note: 'Credit note', expense: 'Expense', income: 'Income' };
/** the person who serviced it IS the shop itself (an owner, not a counter hand) — the shop's own name, as the session knows it */
function bkIsShopName(n) {
  if (typeof SESSION === 'undefined') return false;
  var shop = SESSION.entity || (SESSION.role === 'entity' ? SESSION.name : '');
  return !!shop && String(n || '').trim() === String(shop).trim();
}
/** the bill's number as a link that opens the chit sheet, with its time — "Bill C2/26-27/0002 12:30" (the word is the caller's) */
function bkBillPart(s, tid) {
  if (!s || !(s.ref || s.chit_id)) return '';
  var no = s.ref ? '<span class="mono">' + esc(s.ref) + '</span>' : esc(tx('Open'));
  var link = s.chit_id ? '<a href="#" data-testid="' + esc(tid) + '" onclick="event.stopPropagation();openChitSheet(\'' + esc(s.chit_id) + '\');return false">' + no + '</a>' : no;
  return link + (s.doc_at ? ' <span data-testid="' + esc(tid) + '-at">' + esc(bkTime(s.doc_at)) + '</span>' : '');
}
/* ⭐ HOW IT WAS PAID (Athi, 2026-10-01: "clearly segregate credit, cash, UPI") — a day: each tender with its amount */
function bkHowPart(s, tid, cur) {
  if (!s) return '';
  if (s.kind === 'day' && s.split && s.split.length) return s.split.map(function (x) { return esc(tx(x.how)) + ' ' + esc(bkMoney(x.amount_minor, cur)); }).join(' · ');
  if (s.how) return '<span data-testid="' + esc(tid) + '-how">' + esc(tx(s.how)) + (s.how_ref ? ' <span class="mono">' + esc(bkShortRef(s.how_ref)) + '</span>' : '') + '</span>';
  return '';
}
/* ⭐ the person who rang it up is NOT the party (2026-10-02: a 1300 row read as if the shop owed itself) — "rung by", and last */
function bkRungPart(s) { return s && s.by ? esc(tx('rung by')) + ' ' + esc(s.by) + (bkIsShopName(s.by) ? ' ' + esc(tx('(owner)')) : '') : ''; }
function bkSourceParts(s, tid, cur, lead) {
  if (!s) return [];
  var out = [];
  /* ⭐ the kind word ONCE (2026-10-03: "Expense · Expense C2/…"): when the entry's own word already says it, only the number follows */
  var kw = BK_SRC_WORD[s.kind] ? tx(BK_SRC_WORD[s.kind]) : '', said = !!kw && String(lead || '').trim().toLowerCase() === kw.toLowerCase();
  if (s.kind === 'day') { if (s.count != null) out.push(bkDayBillsLink(s, tid)); }
  else if (s.ref || s.chit_id) out.push((kw && !said ? esc(kw) + ' ' : '') + bkBillPart(s, tid));
  var how = bkHowPart(s, tid, cur); if (how) out.push(how);
  if (s.counter) out.push(esc(counterWord(s.counter)));
  var rung = bkRungPart(s); if (rung) out.push(rung);
  return out;
}
/** the entry's own word, then its source: "Sale · Bill … · Counter C2 · Athi" — a walk-in day says "Walk-in day" */
function bkEntryHead(e, tid, cur, party) {
  var s = e && e.source;
  var head = s && s.kind === 'day' ? esc(tx('Walk-in day')) : s && s.kind === 'receipt' ? esc(tx('Received')) : esc((e && (e.narration || e.what || e.event_type)) || '');
  return [head].concat(party ? [esc(party)] : [], bkSourceParts(s, tid, cur, head)).join(' · ') + bkRecordedHTML(e, tid);
}
/** the bill's own time of day, in the shop's zone (CBLocale.time) — "beside the bill number" */
function bkTime(ts) { try { return CBLocale.time(ts) || ''; } catch (_) { return ''; } }
/**
 * ⭐ BOTH TIMES (Athi, 2026-10-01: "the time the bill was made or the time the entry was accepted? both should be there").
 * The row is the bill's (its date, its time beside the number); when the ledger took it on ANOTHER day — a late bill, a
 * buyer's acceptance days after the invoice — "recorded 01 Oct" follows, muted. Same day → nothing more to say.
 */
function bkRecordedHTML(e, tid) {
  if (!e) return '';
  var s = e.source || {}, doc = e.doc_date || null, post = e.posting_date || e.date || null, rec = s.recorded_at || null;
  var day = function (v, o) { try { return CBLocale.date(v, o); } catch (_) { return String(v).slice(0, 10); } };
  var late = (doc && post && doc !== post) || (doc && rec && day(rec) !== day(doc));
  if (!late) return '';
  return ' <span data-testid="' + esc(tid) + '-rec" style="color:var(--grey);font-weight:400">' + esc(txf('recorded {date}', { date: day(rec || post, { day: '2-digit', month: 'short' }) })) + '</span>';
}
/** opening · each movement with its running balance · closing — the shape every statement has */
/* ── M29 · Reverse from the row ──
 * A statement line names its entry (entry_id, M29 api), so the ONE confirm (cap-entry.js enReverse) runs from the row without a Day book read; the
 * answer repaints THIS row — "reversed by MJ/… — reason" — and the toast says the bills reopened (the API's words). Both statement painters
 * (the CRM record's table, the ledger's CBList) read the same line object, so the row that was pressed is the row that changes. */
/** may this line be reversed from its row: it names its entry, is not already reversed, and is not itself a reversal */
function bkCanReverse(l) { return !!(l && l.entry_id && !l.reversed_by && !l.reverses_entry_id && l.event_type !== 'reversal'); }
function bkReverseLine(l, partyId) {
  if (!bkCanReverse(l) || typeof enReverse !== 'function') return;
  enReverse(l.entry_id, l.entry_no || l.ref, false, function (r, why) {
    l.reversed_by = (r && r.entry_no) || '—'; l.reversed_why = why || null; if (l.payment_id) l.unapplied_minor = 0;
    var st = partyId ? BK.stmt[partyId] : null, box = partyId ? document.getElementById('bk_stmt_' + partyId) : null;
    if (st && box && (st.lines || []).indexOf(l) >= 0) box.innerHTML = statementHTML(st, partyId);
    if (BK.lt && BK.lt.r && (BK.lt.r.lines || []).indexOf(l) >= 0 && BK.lt.api) BK.lt.api.refresh();
  });
}
function bkStmtReverse(partyId, i) { var st = BK.stmt[partyId]; bkReverseLine(st && st.lines && st.lines[i], partyId); }
/** the chips a line carries after M29: "reversed by MJ/… — reason" · the advice state (M30: CBAdvice's words — none → nothing) · the Advice button on a payment line */
function bkLineChips(l, tid) {
  var out = '';
  if (l && l.reversed_by) out += ' <span class="cbl-chip" data-testid="' + esc(tid) + '-rev">' + esc(tx('reversed by') + ' ' + l.reversed_by + (l.reversed_why ? ' — ' + l.reversed_why : '')) + '</span>';
  if (l && l.advice && l.advice.state && l.advice.state !== 'none') out += ' <span class="cbl-chip" data-testid="' + esc(tid) + '-adv">' + esc(bkAdviceWords(l.advice)) + '</span>';
  /* M30: every recorded payment line offers the advice (send on rail · share off rail); whether THIS login may is the server's answer, painted by the unit */
  if (l && l.payment_id && !l.reversed_by && !l.reverses_entry_id && typeof CBAdvice !== 'undefined')
    out += ' <button type="button" class="cbl-btn" data-testid="' + esc(tid) + '-advbtn" data-adv="' + esc(l.payment_id) + '" onclick="event.stopPropagation();bkAdviceToggle(this)">✉ ' + esc(tx('Advice')) + '</button>';
  return out;
}
/** the chip words for an advice state — the unit's own (one vocabulary on the row and under the outcome) */
function bkAdviceWords(a) { return typeof CBAdvice !== 'undefined' ? CBAdvice.stateWords(a) : (a && a.state ? tx('advice') + ' ' + tx(a.state) : ''); }
/**
 * M30 · the Advice button on a statement row: mounts CBAdvice (app/rail-advice.js) right under the row's details, once; a second press folds it.
 * The unit reads GET /payments/:id/advice itself and paints Send / Share with the server's may; its cb:rail / onDone flips THIS row's chip
 * locally (every line object that is this payment, on the CRM table and the ledger list alike), never the screen.
 */
function bkAdviceToggle(btn) {
  var pid = btn && btn.getAttribute('data-adv'); if (!pid) return;
  var cell = btn.closest('td,div') || btn.parentNode, host = cell.querySelector('[data-adv-host="' + pid + '"]');
  if (host) { host.remove(); return; }
  host = document.createElement('div'); host.setAttribute('data-adv-host', pid); host.setAttribute('data-testid', 'adv-host'); host.style.marginTop = '6px';
  btn.insertAdjacentElement('afterend', host);
  var party = BK.lt && BK.lt.sel && BK.lt.sel.party ? bkPartyLabel(BK.lt.sel.party) : '';
  CBAdvice.mount(host, { payment_id: pid, party: party || undefined, context: { host: typeof ACC !== 'undefined' ? 'accounts' : (typeof CRM !== 'undefined' ? 'crm' : 'app') },
    onDone: function (res) { bkAdviceFlip(pid, res, cell); } });
}
/** the row after an advice went: the line objects remember the state, the chip beside the button repaints — no re-read */
function bkAdviceFlip(pid, res, cell) {
  var lines = [];
  Object.keys(BK.stmt || {}).forEach(function (k) { ((BK.stmt[k] && BK.stmt[k].lines) || []).forEach(function (l) { if (l.payment_id === pid) lines.push(l); }); });
  ((BK.lt && BK.lt.r && BK.lt.r.lines) || []).forEach(function (l) { if (l.payment_id === pid) lines.push(l); });
  lines.forEach(function (l) { l.advice = Object.assign({}, l.advice || {}, res); });
  var chip = cell && cell.querySelector('[data-testid$="-adv"]'), b = cell && cell.querySelector('[data-adv="' + pid + '"]');
  var words = bkAdviceWords(res);
  if (chip) chip.textContent = words;
  else if (b && words) { chip = document.createElement('span'); chip.className = 'cbl-chip'; chip.setAttribute('data-testid', (b.getAttribute('data-testid') || '').replace(/-advbtn$/, '-adv')); chip.textContent = words; b.insertAdjacentElement('beforebegin', chip); b.insertAdjacentText('beforebegin', ' '); }
}
function statementHTML(r, partyId) {
  var c = r && r.currency, pid = partyId || (r && r.party_id) || '';
  var rows = ((r && r.lines) || []).map(function (l, i) {
    var rev = pid && l.payment_id && bkCanReverse(l) && typeof enReverse === 'function'
      ? ' <button type="button" class="cbl-btn" data-testid="stmt-reverse-' + i + '" onclick="event.stopPropagation();bkStmtReverse(\'' + esc(pid) + '\',' + i + ')">↩ ' + esc(tx('Reverse')) + '</button>' : '';
    return '<tr' + (l.source_chit_id ? ' style="cursor:pointer" onclick="openChitSheet(\'' + esc(l.source_chit_id) + '\')"' : '') + '><td>' + esc(bkDate(l.date)) + '</td><td data-testid="stmt-what-' + i + '">' + bkEntryHead(l, 'stmt-src-' + i, c, bkPartyLabel(l.party_id || partyId || (r && r.party_id), l.party_name)) + (l.ref ? ' <span class="mono">' + esc(l.ref) + '</span>' : '') + bkLineChips(l, 'stmt-' + i) + rev + '</td>'
      + '<td class="num">' + (l.dr_minor ? esc(bkMoney(l.dr_minor, c)) : '') + '</td><td class="num">' + (l.cr_minor ? esc(bkMoney(l.cr_minor, c)) : '') + '</td><td class="num"><b>' + esc(bkDrCr(l.running_minor, c)) + '</b></td></tr>';
  }).join('');
  return '<table class="bktab" style="width:100%;border-collapse:collapse;font-size:var(--fs-1)"><thead><tr><th>' + tx('Date') + '</th><th>' + tx('What') + '</th><th class="num">' + tx('Debit') + '</th><th class="num">' + tx('Credit') + '</th><th class="num">' + tx('Balance') + '</th></tr></thead><tbody>'
    + '<tr><td></td><td><i>' + tx('Opening') + '</i></td><td></td><td></td><td class="num" data-testid="stmt-opening">' + esc(bkDrCr(r && r.opening_minor, c)) + '</td></tr>'
    + rows
    + '<tr><td></td><td><b>' + tx('Closing') + '</b></td><td></td><td></td><td class="num" data-testid="stmt-closing"><b>' + esc(bkDrCr(r && r.closing_minor, c)) + '</b></td></tr></tbody></table>';
}

/* ── the party's own fields, edited where the party is shown ── */
/* the schemes the server accepts (lib/party-fields.js): a party can carry several tax ids, so the sheet edits a LIST of them */
var TAX_SCHEMES = ['GSTIN', 'PAN', 'TAN', 'TRN', 'VAT', 'TIN', 'CIN', 'UDYAM'];
function partyRowOf(kind, partyId) {
  if (kind === 'supplier') return (UI.sups || []).find(function (s) { return s.supplier_entity_id === partyId; });
  return (UI.custs || []).find(function (c) { return c.customer_identity_id === partyId; });
}
/** one tax-id row of the edit sheet; the first keeps the ids the Ledger's own tests read (pe_scheme / pe_taxid) */
function partyTaxRowHTML(kind, partyId, t, i) {
  var sid = i === 0 ? 'pe_scheme' : 'pe_scheme' + i, vid = i === 0 ? 'pe_taxid' : 'pe_taxid' + i;
  return '<div class="supacts pe_taxrow" style="display:flex;gap:6px"><select class="inp" id="' + sid + '" data-testid="' + sid + '" style="width:auto" aria-label="' + esc(tx('Scheme')) + '">' + TAX_SCHEMES.map(function (s) { return '<option' + (t.scheme === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>'
    + '<input class="inp" id="' + vid + '" data-testid="' + vid + '" value="' + esc(t.value == null ? '' : t.value) + '" aria-label="' + esc(tx('Tax id')) + '" style="width:100%" oninput="partyDupCheck(\'' + kind + '\',\'' + esc(partyId) + '\')"></div>';
}
function partyTaxAdd(kind, partyId) {
  var box = document.getElementById('pe_taxes'); if (!box) return;
  var n = box.querySelectorAll('.pe_taxrow').length, d = document.createElement('div'); d.innerHTML = partyTaxRowHTML(kind, partyId, {}, n);
  box.appendChild(d.firstChild);
}
function partyEditOpen(kind, partyId) {
  var r = partyRowOf(kind, partyId) || {};
  var taxes = (r.tax_ids && r.tax_ids.length) ? r.tax_ids : [{}];
  var inp = function (id, v, ph, extra) { return '<input class="inp" id="' + id + '" data-testid="' + id + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || '') + '" style="width:100%" ' + (extra || '') + '>'; };
  /* a minted (local) party has no profile of its own: the shop holds its phone and e-mail, so the sheet edits them (a party on ChitBridge keeps its own) */
  var contact = r.contacts ? '<div style="display:flex;gap:8px"><label style="flex:1">' + tx('Phone') + inp('pe_phone', r.contacts.phone, '', 'inputmode="tel"') + '</label><label style="flex:1">' + tx('E-mail') + inp('pe_email', r.contacts.email, '', 'inputmode="email"') + '</label></div>' : '';
  modal('<div class="mhd"><div class="t">' + esc(tx('Party')) + ' · ' + esc(r.display_name || r.nickname || '') + '</div></div><div class="mbody" style="display:flex;flex-direction:column;gap:8px">'
    + '<label>' + tx('Legal name') + inp('pe_legal', r.legal_name, tx('as on their tax registration')) + '</label>'
    + '<label>' + tx('Nickname') + inp('pe_nick', r.nickname, tx('what you call them')) + '</label>'
    + contact
    + '<div><div style="font-weight:600;margin-bottom:4px">' + tx('Tax ids') + '</div><div id="pe_taxes" style="display:flex;flex-direction:column;gap:6px">' + taxes.map(function (t, i) { return partyTaxRowHTML(kind, partyId, t, i); }).join('') + '</div>'
    + '<button type="button" data-testid="pe_taxadd" style="margin-top:6px" onclick="partyTaxAdd(\'' + kind + '\',\'' + esc(partyId) + '\')">+ ' + tx('Add a tax id') + '</button></div>'
    + '<div id="pe_dup" data-testid="pe_dup" style="font-size:var(--fs-1);color:var(--warn-2)"></div>'
    + '<div style="display:flex;gap:8px"><label style="flex:1">' + tx('Credit days') + inp('pe_days', r.credit_days, '30', 'inputmode="numeric"') + '</label>'
    + '<label style="flex:1">' + tx('Credit limit') + bkMoneyInput({ id: 'pe_limit', minor: r.credit_limit_minor != null ? r.credit_limit_minor : null, ph: '' }) + '</label></div>'
    + '<label>' + tx('State code') + inp('pe_state', r.state_code, '33') + '</label>'
    + '</div><div class="mfoot"><button onclick="closeModal()">' + tx('Cancel') + '</button><button class="pri" data-testid="pe_save" onclick="partyEditSave(\'' + kind + '\',\'' + esc(partyId) + '\')">' + tx('Save') + '</button></div>');
  partyDupCheck(kind, partyId);
}
/** the sheet's tax-id rows → [{scheme, value}], blanks dropped */
function partyTaxRows() {
  return Array.prototype.slice.call(document.querySelectorAll('#pe_taxes .pe_taxrow')).map(function (row) {
    return { scheme: (row.querySelector('select') || {}).value, value: String((row.querySelector('input') || {}).value || '').trim().toUpperCase() };
  }).filter(function (t) { return t.value; });
}
/** ⚠️ duplicate parties come from free text with no tax-id check — warn before saving (the research's failure 5) */
function partyDupCheck(kind, partyId) {
  var box = document.getElementById('pe_dup'); if (!box) return;
  var mine = partyTaxRows();
  if (!mine.length) { box.textContent = ''; return; }
  var all = (UI.custs || []).map(function (c) { return { id: c.customer_identity_id, name: c.display_name, tax: c.tax_ids }; })
    .concat((UI.sups || []).map(function (s) { return { id: s.supplier_entity_id, name: s.display_name || s.nickname, tax: s.tax_ids }; }));
  var hit = null, hs = null;
  mine.forEach(function (m) { if (hit) return; hit = all.filter(function (p) { return p.id !== partyId && (p.tax || []).some(function (t) { return t.scheme === m.scheme && String(t.value).toUpperCase() === m.value; }); })[0] || null; hs = hit ? m.scheme : hs; });
  box.textContent = hit ? txf('{name} already has this {scheme}', { name: hit.name || '', scheme: hs }) : '';
}
async function partyEditSave(kind, partyId) {
  var g = function (id) { return String((document.getElementById(id) || {}).value || '').trim(); };
  var r = partyRowOf(kind, partyId) || {};
  var listId = kind === 'supplier' ? r.supplier_list_id : r.customer_list_id;
  var lim = g('pe_limit'), days = g('pe_days');
  var body = { legal_name: g('pe_legal') || null, nickname: g('pe_nick') || null, state_code: g('pe_state') || null,
    credit_days: days === '' ? null : parseInt(days, 10), credit_limit_minor: lim === '' ? null : bkMoneyMinor(lim),
    tax_ids: partyTaxRows() };
  if (document.getElementById('pe_phone')) { body.phone = g('pe_phone') || null; body.email = g('pe_email') || null; }
  if (body.credit_days != null && !(body.credit_days >= 0)) { toast(tx('Credit days: a whole number')); return; }
  if (body.credit_limit_minor != null && !(body.credit_limit_minor >= 0)) { toast(tx('Credit limit: an amount')); return; }
  try {
    await api(kind === 'supplier' ? 'supPatch' : 'custGroup', { params: { id: listId }, body: body });
    /* a party on both lists is one party: the words and tax ids it carries are written to the other list too (its credit terms are its own) */
    if (r.also && r.also.id) await api(r.also.kind === 'supplier' ? 'supPatch' : 'custGroup', { params: { id: r.also.id }, body: { legal_name: body.legal_name, nickname: body.nickname, state_code: body.state_code, tax_ids: body.tax_ids } });
    Object.assign(r, body);
    closeModal(); toast(tx('Saved'));
    if (kind === 'supplier') { if (typeof paintSupSlide === 'function') paintSupSlide(); } else if (typeof paintCustDetail === 'function') paintCustDetail();
    if (typeof crmAfterEdit === 'function') crmAfterEdit(kind, partyId);   /* CB CRM re-reads its list and the record */
  } catch (e) {
    /* the server's own duplicate check (409 DUPLICATE_PARTY) says the same as the warning, with authority */
    var box = document.getElementById('pe_dup'); if (box) box.textContent = bkWhy(e, tx('Could not save'));
  }
}

/* ══ 2 · RECEIVE / PAY — ONE unit (M27, SPEC-payments §1.1 · §5): the amount, how, the bills table, the band, Record, the outcome ══
   One call (booksPayRecord, M26) posts the payment and settles the bills together; /payments/preview paints the bills table and the
   duplicate band. There is no "Later": "Keep it as an advance" is a switch that says what it does. The words of every warning and of
   the outcome come from the server; this unit paints them. */
var PAY = null;
function payOpen(kind, partyId) {
  var r = partyRowOf(kind, partyId) || {};
  PAY = { kind: kind, partyId: partyId, name: r.nickname || r.display_name || '', ref: bkRef(), seq: 0, ack: [], advice: false, preview: null };   /* one ref per opened form */
  modal('<div class="mhd"><div class="t" id="pay_title" data-testid="pay_title">' + esc(kind === 'supplier' ? tx('Pay') : tx('Receive')) + ' · ' + esc(PAY.name) + '</div></div><div class="mbody" id="pay_body" style="display:flex;flex-direction:column;gap:8px">'
    + '<label>' + tx('Amount') + '' + bkMoneyInput({ id: 'pay_amt', on: 'payPreviewSoon()' }) + '</label>'
    + '<label>' + tx('How') + '<select class="inp" id="pay_mode" data-testid="pay_mode" onchange="payModePaint()"><option value="cash">' + tx('Cash') + '</option><option value="upi">UPI</option><option value="bank">' + tx('Bank') + '</option><option value="card">' + tx('Card') + '</option><option value="cheque">' + tx('Cheque') + '</option></select></label>'
    + '<label>' + tx('Reference') + '<input class="inp" id="pay_ref" data-testid="pay_ref" style="width:100%"></label>'
    + '<div id="pay_chq" hidden style="gap:6px"><input class="inp" id="pay_chqno" data-testid="pay_chqno" placeholder="' + esc(tx('Cheque no')) + '"><input class="inp" id="pay_bank" placeholder="' + esc(tx('Bank')) + '"><input class="inp" id="pay_chqdate" type="date"></div>'
    + '<div style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="pay_adv" data-testid="pay_adv" onchange="payAdvToggle()"><label for="pay_adv" style="display:inline;margin:0">' + tx('Keep as advance') + '</label></div>'
    + '<div id="pay_band" data-testid="pay_band" role="alert" hidden class="payband" style="border:1px solid var(--warn-2);border-radius:6px;padding:8px;font-size:var(--fs-1)"></div>'
    + '<div data-testid="pay_left" id="pay_left" style="font-size:var(--fs-1)"></div>'
    + '<div id="pay_bills" data-testid="pay_bills"></div>'
    + '<div id="pay_why" data-testid="pay_why" style="color:var(--warn-2);font-size:var(--fs-1)"></div>'
    + '</div><div class="mfoot" id="pay_foot"><button onclick="closeModal()">' + tx('Cancel') + '</button><button class="pri" data-testid="pay_record" onclick="payRecord()">' + tx('Record') + '</button>'
    + (kind === 'supplier' ? '' : '<button data-testid="pay_remind" onclick="payRemind()">' + tx('Not paid yet — remind me') + '</button>') + '</div>');
  payPaint();
}
/** "Not paid yet — remind me" (SPEC-payments D3): nothing posts; it is the Remind of the Dues row — a message on the oldest open bill */
function payRemind() { if (!PAY) return; var id = PAY.partyId; closeModal(); return bkRemind(id, null); }
function payDirection() { return PAY.kind === 'supplier' ? 'out' : 'in'; }
function payMode() { return (document.getElementById('pay_mode') || {}).value; }
function payModePaint() { var c = document.getElementById('pay_chq'), on = payMode() === 'cheque'; if (c) { c.hidden = !on; c.style.display = on ? 'flex' : ''; } payPaint(); }
function payAdvToggle() { PAY.advice = !!(document.getElementById('pay_adv') || {}).checked; PAY.ack = []; payPreviewSoon(0); }
/**
 * ⭐⭐ THE ONE PLACE W1's TRIGGER LIVES (owner, 2026-10-08: W1 "nothing owed" fires ONLY when the payment carries an allocation — bills
 * chosen). The server asks the same question of the same body (lib/books.js duplicateWarnings: `allocating`), so what this returns
 * is what makes W1 fire or stay silent. Change it here, and only here.
 *   · "Keep it as an advance" on, or a cheque (it settles nothing until it clears) → allocate: 'none'   — no bills meant, no W1
 *   · bills on screen and every one set to 0                                        → allocate: 'none'   — an advance on purpose
 *   · otherwise                                                                      → allocate: 'oldest_first' (+ the ticked list, once recorded)
 */
function payIntent(forRecord) {
  if (PAY.advice || payMode() === 'cheque') return { allocate: 'none' };
  var shown = PAY.preview && PAY.preview.proposal && PAY.preview.proposal.length, rows = forRecord ? payAllocs().filter(function (x) { return x.amount_minor > 0; }) : [];
  if (forRecord && shown && !rows.length) return { allocate: 'none' };
  var o = { allocate: 'oldest_first' };
  if (rows.length) o.allocations = rows.map(function (x) { return { against_ref: x.against_ref, amount_minor: x.amount_minor }; });
  return o;
}
var payTimer = null;
function payPreviewSoon(ms) { clearTimeout(payTimer); payTimer = setTimeout(payPreview, ms == null ? 300 : ms); }
/** the bills table, the line under it and the band all come from ONE read: /payments/preview (no write) */
async function payPreview() {
  if (!PAY || PAY.done) return;
  var amt = bkMoneyRead('pay_amt');
  if (!(amt > 0)) { PAY.preview = null; PAY.ack = []; payPaint(); return; }
  if (PAY.reading) { PAY.again = true; return; }
  PAY.reading = true; var n = ++PAY.seq, p = PAY;
  try {
    var q = payIntent(false), r = await api('booksPayPreview', { body: { party_id: PAY.partyId, direction: payDirection(), amount_minor: amt, currency: bkCur(), allocate: q.allocate } });
    if (PAY === p && n === PAY.seq) {
      PAY.preview = r; PAY.ack = []; PAY.amount = amt;
      /* a door that does not hold the party's list (the CRM record) learns the name from the server's own answer */
      if (!PAY.name && r.party && r.party.name) { PAY.name = r.party.name; var ti = document.getElementById('pay_title'); if (ti) ti.textContent = (PAY.kind === 'supplier' ? tx('Pay') : tx('Receive')) + ' · ' + PAY.name; } var w = document.getElementById('pay_why'); if (w) w.textContent = ''; payPaint(); }
  } catch (e) {
    if (PAY === p) { var w2 = document.getElementById('pay_why'); if (w2) w2.textContent = bkWhy(e, tx('Could not read the bills')); }
  }
  if (PAY === p) { PAY.reading = false; if (PAY.again) { PAY.again = false; payPreview(); } }
}
function payOpenWarnings() { return ((PAY.preview && PAY.preview.warnings) || []).filter(function (w) { return PAY.ack.indexOf(w.code) < 0; }); }
/** paints the three things the preview decides: the bills table, the where-the-money-goes line, the band (and whether Record may be pressed) */
function payPaint() {
  var pv = PAY.preview, rows = (pv && pv.proposal) || [], bills = document.getElementById('pay_bills'), band = document.getElementById('pay_band'), rec = document.querySelector('[data-testid="pay_record"]');
  var cheque = payMode() === 'cheque', hide = PAY.advice || cheque || !rows.length;
  if (bills) bills.innerHTML = hide ? '' : '<div style="font-size:var(--fs-1);color:var(--grey)">' + tx('Oldest bill first. Edit any amount') + '</div>'
    + '<table class="bktab" style="width:100%;font-size:var(--fs-1)"><thead><tr><th>' + tx('Bill') + '</th><th>' + tx('Due') + '</th><th class="num">' + tx('Open') + '</th><th class="num">' + tx('Apply') + '</th></tr></thead><tbody>'
    + rows.map(function (it, i) {
        return '<tr data-testid="alloc-row-' + i + '"><td class="mono">' + esc(it.bill_no || it.against_ref) + (it.disputed ? ' <span class="optchip" style="color:var(--warn-2)">' + tx('In dispute') + '</span>' : '') + '</td><td>' + esc(bkDate(it.due_date)) + '</td><td class="num">' + esc(bkMoney(it.open_minor)) + '</td>'
          + '<td class="num">' + bkMoneyInput({ id: 'alloc_' + i, tid: 'alloc-' + i, minor: it.apply_minor || null, ph: '', w: '150px', on: 'payLeftPaint()', extra: it.disputed ? 'disabled title="' + esc(tx('In dispute · settle it first')) + '"' : '' }) + '</td></tr>';
      }).join('') + '</tbody></table>';
  payLeftPaint();
  var ws = payOpenWarnings();
  if (band) {
    band.hidden = !ws.length;
    band.innerHTML = !ws.length ? '' : '<div data-testid="pay_band_words">' + ws.map(function (w) { return esc(w.words); }).join(' ') + (ws.some(function (w) { return w.code === 'nothing_owed' || w.code === 'excess'; })
        ? ' ' + esc(txf(PAY.kind === 'supplier' ? 'Pay {amt} again as an advance?' : 'Receive {amt} again as an advance?', { amt: bkMoney(PAY.amount) })) : '')
      + '</div><div style="display:flex;gap:8px;margin-top:6px"><button class="pri" data-testid="pay_ack" onclick="payRecord(true)">' + esc(PAY.kind === 'supplier' ? tx('Pay as advance') : tx('Receive as advance')) + '</button>'
      + '<button data-testid="pay_band_cancel" onclick="closeModal()">' + tx('Cancel') + '</button></div>';
  }
  /* nothing records until a button IN the band is pressed */
  if (rec && !PAY.done) rec.disabled = !!ws.length;
}
function payAllocs() {
  if (PAY.advice || payMode() === 'cheque') return [];
  return ((PAY.preview && PAY.preview.proposal) || []).map(function (it, i) {
    var v = (document.getElementById('alloc_' + i) || {}).value; var m = v === '' || v == null ? 0 : bkMoneyMinor(v);
    return { against_ref: it.against_ref, amount_minor: m, disputed: !!it.disputed, open_minor: it.open_minor };
  });
}
/** the line under the table — says where the money goes, and follows every edit */
function payLeftPaint() {
  var box = document.getElementById('pay_left'); if (!box) return;
  var amt = bkMoneyRead('pay_amt'), pv = PAY.preview;
  if (!(amt > 0)) { box.textContent = tx('Type the amount'); box.style.color = 'var(--grey)'; return; }
  if (payMode() === 'cheque') { box.textContent = tx('Counts against bills when the cheque clears'); box.style.color = 'var(--grey)'; return; }
  var a = payAllocs(), used = a.reduce(function (s, x) { return s + (x.amount_minor > 0 ? x.amount_minor : 0); }, 0), n = a.filter(function (x) { return x.amount_minor > 0; }).length, left = amt - used, parts = [];
  if (n) parts.push(txn('{amt} settles {count} bill', '{amt} settles {count} bills', n, { amt: bkMoney(used) }));
  if (left > 0) parts.push(txf(PAY.kind === 'supplier' ? '{amt} stays with {name} as an advance' : '{amt} is kept as an advance from {name}', { amt: bkMoney(left), name: PAY.name }));
  if (left < 0) parts.push(txf('{amt} too much', { amt: bkMoney(Math.abs(left)) }));
  box.textContent = parts.length ? parts.join(' · ') : (pv && pv.words) || '';
  box.style.color = left < 0 ? 'var(--warn-2)' : 'var(--grey)';
}
/** Record (viaBand = true: the band's "Pay as advance", which is what acknowledges the warnings). One call; the outcome replaces the form. */
function payRecord(viaBand) {
  /* ⚠️ M11/M64: through CBAction — one press one call; every attempt from this form carries the SAME client_ref; the outcome is said
     in the form (pay_why), never a thrown error's text */
  if (!PAY || PAY.done) return;
  var why = document.getElementById('pay_why'), amt = bkMoneyRead('pay_amt');
  if (!(amt > 0)) { if (why) why.textContent = tx('Type the amount'); return; }
  var open = payOpenWarnings();
  if (open.length && viaBand !== true) return;   /* the band is up: only its own buttons record */
  var a = payAllocs();
  /* the same refusals the engine makes (check), said before the round trip — the server still decides */
  var bad = a.filter(function (x) { return x.amount_minor < 0 || !isFinite(x.amount_minor) || x.amount_minor > x.open_minor || (x.disputed && x.amount_minor > 0); })[0];
  var used = a.reduce(function (s, x) { return s + (x.amount_minor > 0 ? x.amount_minor : 0); }, 0);
  if (bad) { if (why) why.textContent = bad.disputed ? tx('A disputed bill takes nothing') : tx('More than that bill has open'); return; }
  if (used > amt) { if (why) why.textContent = tx('More applied than paid'); return; }
  var ack = viaBand === true ? open.map(function (w) { return w.code; }) : PAY.ack;
  return CBAction.run(document.querySelector('[data-testid="' + (viaBand === true ? 'pay_ack' : 'pay_record') + '"]'), async function () {
      var mode = payMode(), q = payIntent(true);
      var body = { party_id: PAY.partyId, direction: payDirection(), amount_minor: amt, currency: bkCur(), mode: mode, reference: (document.getElementById('pay_ref') || {}).value || null,
        received_at: new Date().toISOString(), allocate: q.allocate, client_ref: PAY.ref,
        cheque: mode === 'cheque' ? { number: (document.getElementById('pay_chqno') || {}).value || null, bank: (document.getElementById('pay_bank') || {}).value || null, date: (document.getElementById('pay_chqdate') || {}).value || null } : null };
      if (q.allocations) body.allocations = q.allocations;
      if (ack.length) body.acknowledge = ack;
      var r = await api('booksPayRecord', { body: body });
      PAY.amount = amt;
      return r;
  }, { key: 'pay', out: 'pay_why', failed: tx('Could not record it'),
    /* the server asked "Already paid?" (a warning the preview did not have): nothing was written — the band takes its words */
    onFail: function (w, e) {
      if (e && e.status === 409 && e.data && e.data.warnings && e.data.warnings.length) { PAY.preview = Object.assign({}, PAY.preview || {}, { warnings: e.data.warnings }); PAY.ack = []; payPaint(); return; }
      var el = document.getElementById('pay_why'); if (el) el.textContent = w;
    },
    outcome: payOutcomePaint });
}
/** the outcome IS the form's next state: what happened · what it means (the bills named, the balance) · Done */
function payOutcomePaint(r) {
  var pb = document.getElementById('pay_body'), pf = document.getElementById('pay_foot'); if (!pb || !pf || !r || !r.payment) return;
  PAY.done = true; PAY.id = r.payment.payment_id;
  var o = r.outcome || {}, bills = (o.settled || []).map(function (s) { return s.bill_no || s.against_ref; }), cheque = r.payment.status === 'cheque_received', html = '';
  if (cheque) {
    /* ⭐ C3: a cheque counts on CLEARING — nothing to match yet; its steps are offered right here */
    bkChequeKeep({ payment_id: PAY.id, party_id: PAY.partyId, name: PAY.name, amount_minor: PAY.amount, cheque_no: (document.getElementById('pay_chqno') || {}).value || null, cheque_bank: (document.getElementById('pay_bank') || {}).value || null, cheque_date: (document.getElementById('pay_chqdate') || {}).value || null, status: 'received' });
  }
  html += '<p data-testid="pay_outcome" style="margin:0;font-weight:600">' + esc(o.words || (r.payment.duplicate ? tx('Already recorded') : tx('Recorded'))) + '</p>';
  if (bills.length) html += '<p data-testid="pay_settled" style="margin:0">' + esc(txf('Settled: {bills}', { bills: bills.join(', ') })) + '</p>';
  if (o.balance_minor != null) html += '<p data-testid="pay_balance" style="margin:0;color:var(--grey)">' + esc(txf('Balance: {bal}', { bal: bkOwes(o.balance_minor) })) + (r.posted && r.posted.entry_no ? ' · <span class="mono">' + esc(r.posted.entry_no) + '</span>' : '') + '</p>';
  if (cheque) html += '<div id="pay_chq_steps" data-testid="pay_chq_steps">' + bkChequeStepsHTML(BK.cheques[PAY.id]) + '</div><div id="chq_out" data-testid="chq_out" style="color:var(--warn-2);font-size:var(--fs-1)"></div>';
  /* M30: the advice line — "Advice sent to Tally Test ✓" / "Ravi Stores is not on ChitBridge — share the advice" — the unit, from the block the record answered (no second read) */
  if (r.advice) html += '<div id="pay_advice" data-testid="pay_advice"></div>';
  pb.innerHTML = html;
  if (r.advice && typeof CBAdvice !== 'undefined') CBAdvice.mount(document.getElementById('pay_advice'), { payment_id: PAY.id, advice: r.advice, party: PAY.name, context: { host: typeof ACC !== 'undefined' ? 'accounts' : 'crm' },
    onDone: function (res) { bkAdviceFlip(PAY.id, res, null); } });
  pf.innerHTML = '<button class="pri" data-testid="pay_done" onclick="closeModal()">' + tx('Done') + '</button>';
  booksAfterPay(r);   /* the statement, the dues chip and the record's header repaint now, behind the outcome */
}
function booksAfterPay(r) {
  var pid = PAY && PAY.partyId;
  if (PAY) { delete BK.stmt[PAY.partyId]; }
  /* M30-1c: repaint LOCALLY from the answer - the balance the record just returned is the party's balance now (same sign as the dues read: + they owe you) */
  try { var o = r && r.outcome; if (pid && o && o.balance_minor != null) { BK.dues = BK.dues || {}; BK.dues[pid] = Object.assign({}, BK.dues[pid], { balance_minor: o.balance_minor }); } } catch (_) {}
  try { if (pid && typeof crmLedgerRepaint === 'function') crmLedgerRepaint(pid); } catch (_) {}
  booksDuesLoad(true).then(function () {
    try { if (PAY && PAY.kind === 'supplier') { if (typeof paintSupSlide === 'function') paintSupSlide(); } else if (typeof paintCustDetail === 'function') paintCustDetail(); } catch (_) {}
  });
}

/* ══ 3 · THE LEDGER SCREEN — the house layout: a list of views on the left, the view on the right ═════════════ */
var BK_TABS = [
  ['daybook', '📖', 'Day book'], ['ledgers', '📒', 'Ledgers'], ['tb', '⚖️', 'Trial balance'], ['pl', '📈', 'P&L'],
  ['bs', '🏛️', 'Balance sheet'], ['dues', '⏳', 'Dues'], ['cheques', '🧾', 'Cheques'], ['waiting', '🕗', 'Waiting'],
  ['lock', '🔒', 'Month lock'], ['packs', '📦', 'Packs'],
  ['opening', '📥', 'Opening balances'], ['accounts', '🗂️', 'Shop ledgers'],
];
function ledgerScreen() {
  var list = '<div class="list"><div class="lh"><div style="font-family:\'Space Grotesk\';font-weight:700;font-size:var(--fs-3)">📒 ' + tx('Ledger') + '</div></div><div class="rows" id="bk_tabs">'
    + BK_TABS.map(function (t) { return '<div class="row ' + (BK.tab === t[0] ? 'sel' : '') + '" data-testid="bk-tab-' + t[0] + '" onclick="bkTab(\'' + t[0] + '\')"><div class="main2"><div class="l1"><span class="code">' + t[1] + ' ' + tx(t[2]) + '</span></div></div><div class="rowgo" aria-hidden="true">›</div></div>'; }).join('')
    + '</div></div>';
  var divider = '<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>';
  setTimeout(function () { bkTab(BK.tab, true); if (BK.tab !== 'waiting' && BK.tab !== 'cheques') bkHealthLoad().catch(function () {}); }, 0);   /* the Waiting count, on the list itself */
  return '<div class="panel" id="panel" style="--lw:' + UI.lw + 'px">' + list + divider + '<div class="detail" id="detailpane"><div id="bk_back"><button class="supback" data-testid="bk-back" onclick="bkBack()">‹ ' + tx('Ledger') + '</button></div><div class="db" id="bk_body" data-testid="bk-body">' + tx('Reading…') + '</div></div></div>';
}
function bkBack() { UI.mdetail = false; var p = document.getElementById('panel'); if (p) p.classList.remove('showdetail'); }
function bkTab(t, silent) {
  BK.tab = t;
  /* ⭐ a host page that is not the app's Ledger screen (accounts.html — CB Accounts) paints its own chrome and may own a view:
     BK.onTab(t) is told which tab opened, BK.views[t] replaces a view's painter. Both are absent in the app, so it is unchanged. */
  if (BK.onTab) BK.onTab(t);
  /* on a phone the tapped view replaces the rail (the way selectCust does it — cap-admin's helper may not be loaded) */
  if (!silent && UI.vp === 'mob') { UI.mdetail = true; var pn = document.getElementById('panel'); if (pn) pn.classList.add('showdetail'); }
  var tabs = document.getElementById('bk_tabs');
  if (tabs) Array.prototype.forEach.call(tabs.children, function (el) { el.classList.toggle('sel', el.getAttribute('data-testid') === 'bk-tab-' + t); });
  var body = document.getElementById('bk_body'); if (!body) return;
  body.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + tx('Reading…') + '</div>';
  var f = (BK.views && BK.views[t]) || { daybook: bkDaybook, ledgers: bkLedgers, tb: bkTB, pl: bkPL, bs: bkBS, dues: bkDues, cheques: bkChequesView, waiting: bkWaitingView, lock: bkLockView, packs: bkPacks, opening: bkOpeningView, accounts: bkAccounts }[t];
  if (f) f(body);
}
function bkRange(id) {
  if (id === 'db' && BK.dbp) return { from: BK.dbp.from, to: BK.dbp.to };
  if (id === 'lg' && BK.lgp) return { from: BK.lgp.from, to: BK.lgp.to };   /* the Ledgers' period chip (bkLgHead) */   /* the Day book's period chip (bkDbPeriod) */
  var from = (document.getElementById(id + '_from') || {}).value, to = (document.getElementById(id + '_to') || {}).value;
  var d = new Date(); var fyStart = (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1) + '-04-01';
  return { from: from || fyStart, to: to || bkToday() };
}
function bkRangeHTML(id, again) {
  var r = bkRange(id);
  return '<div class="supacts" style="display:flex;gap:6px;align-items:center;margin-bottom:9px;flex-wrap:wrap"><input type="date" class="inp" id="' + id + '_from" value="' + r.from + '"><span>→</span><input type="date" class="inp" id="' + id + '_to" value="' + r.to + '"><button onclick="' + again + '">' + tx('Show') + '</button></div>';
}
function bkTable(head, rows, foot) {
  return '<table class="bktab" style="width:100%;border-collapse:collapse;font-size:var(--fs-1)"><thead><tr>' + head.map(function (h) { return '<th' + (h.num ? ' class="num"' : '') + '>' + h.t + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table>';
}
/** a money figure the server holds in MAJOR units (a chit's frozen total) — through the same formatter the chit sheet uses */
function bkMajor(n, cur) {
  if (n == null || n === '' || isNaN(Number(n))) return '';
  try { return fmtMoney(Number(n), cur || bkCur()); } catch (_) { return bkMoney(Math.round(Number(n) * Math.pow(10, bkDec(cur))), cur); }
}

/**
 * ⭐ THE DAY'S STRIP (Athi, 2026-10-01: "in the daybook, you should be able to see the total sale in different
 * counters, sellers' pending invoices and so on, so you can act one by one"). ONE function adds up the day's sales;
 * the per-counter row and the by-tender row both read ITS answer — never the entries a second way. A walk-in day
 * entry counts `source.count` bills with its `split`; a per-bill entry counts 1 with its `how` and the entry's own
 * total (the server's lines, summed once — not a second opinion, the same figure the entry already shows).
 */
function bkDaySales(entries, day) {
  var counters = {}, tenders = {}, corder = [], torder = [], hasDay = false;
  (entries || []).forEach(function (e) {
    if (day && String(e.posting_date || '').slice(0, 10) !== day) return;
    var s = e.source; if (!s) return;
    if (s.kind === 'day') hasDay = true;                      /* the counter closed its day — walk-ins are in */
    if (s.kind !== 'day' && s.kind !== 'bill') return;        /* sales only: a bill, or a walk-in day */
    var total = s.kind === 'day'
      ? (s.split || []).reduce(function (a, x) { return a + Number(x.amount_minor || 0); }, 0)
      : (e.lines || []).reduce(function (a, l) { return a + Number(l.dr_minor || 0); }, 0);
    var bills = s.kind === 'day' ? Number(s.count || 0) : 1;
    var c = s.counter || '—';
    if (!counters[c]) { counters[c] = { counter: c, amount_minor: 0, bills: 0 }; corder.push(c); }
    counters[c].amount_minor += total; counters[c].bills += bills;
    var add = function (how, amt) { if (!tenders[how]) { tenders[how] = { how: how, amount_minor: 0 }; torder.push(how); } tenders[how].amount_minor += amt; };
    if (s.kind === 'day') (s.split || []).forEach(function (x) { add(x.how, Number(x.amount_minor || 0)); });
    else if (s.how) add(s.how, total);
  });
  corder.sort();
  return { counters: corder.map(function (k) { return counters[k]; }), tenders: torder.map(function (k) { return tenders[k]; }), day_closed: hasDay };
}
/**
 * ⭐ THE TO-DO — what waits on you, one line each, a tap away. Only a count above zero earns a row (SYSTEM rule 1);
 * all quiet collapses into one line. Every count is the server's: /health waiting[] (a received supplier bill waits
 * as "Waiting for you to confirm …" — one opens its sheet, several open Waiting; the rest are the ledger's to record), /dues (a
 * customer with any bucket past "Not due"), /cheques (a held cheque with a step still open).
 */
function bkTodoCounts(dues, cheques, health) {
  var waiting = (health && health.waiting) || [];
  var confirm = waiting.filter(function (w) { return /^Waiting for you to confirm/.test(String(w.reason || w.why || '')); });
  var overdue = ((dues && dues.parties) || []).filter(function (p) {
    if (bkDuesSide(p) !== 'rcv') return false;
    var b = p.buckets || {};
    return Object.keys(b).some(function (k) { return k !== 'not_due' && Number(b[k] || 0); });
  });
  var chq = ((cheques && cheques.cheques) || []).filter(function (x) { return bkChequeNext({ status: bkChequeStatus(x.status), next: Array.isArray(x.next) ? x.next : null }).length > 0; });
  return { accept: confirm.length, acceptIds: confirm.map(function (w) { return w.chit_id; }).filter(Boolean), overdue: overdue.length, cheques: chq.length, waiting: waiting.length - confirm.length };
}
/**
 * ⭐ THE DAY BOOK, THE WAY A DAY BOOK READS (Athi, 2026-10-01: "expand all, collapse all, search, filter, daily view,
 * weekly view … do we need these many lines per sale? … the gist can be showcased as a summary."). ONE row per entry,
 * its GIST under it — the entry's own lines merged by ledger (GST = 2200–2212 together), each figure a sum of those
 * lines, never recomputed — and the rate-wise lines on a tap. Search, chips, Day / Week / Month heads and the CSV all
 * read the SAME shown list (the unit's); nothing here adds to a figure the server did not send.
 */
var BK_KINDS = ['Sales', 'Receipts', 'Purchases', 'Payments', 'Expenses', 'Returns', 'Other'];
function bkDvKind(e) {
  var t = String((e && e.event_type) || ''), k = String((e && e.source && e.source.kind) || '');
  if (/return|credit_note|debit_note/.test(t) || k === 'credit_note') return 'Returns';
  if (/purchase/.test(t)) return 'Purchases';
  if (/expense/.test(t) || k === 'expense') return 'Expenses';
  if (k === 'day' || /sale|walkin/.test(t)) return 'Sales';
  if (/received|receipt/.test(t) || k === 'receipt') return 'Receipts';
  if (/payment/.test(t) || k === 'payment') return 'Payments';
  return k === 'bill' ? 'Sales' : 'Other';
}
/** the same-ledger lines merged, credit side first (Sales · GST · Debtors); GST = the 2200–2212 lines together */
function bkDvGist(e) {
  var m = {}, order = [];
  ((e && e.lines) || []).forEach(function (l) {
    var gst = /^22(0\d|1[0-2])$/.test(String(l.code)), key = gst ? 'GST' : String(l.code);
    if (!m[key]) { m[key] = { name: gst ? 'GST' : l.name, amt: 0, cr: 0 }; order.push(key); }
    m[key].amt += Number(l.dr_minor || 0) + Number(l.cr_minor || 0);
    m[key].cr += Number(l.cr_minor || 0) - Number(l.dr_minor || 0);
  });
  var all = order.map(function (k) { return m[k]; });
  return all.filter(function (x) { return x.cr > 0; }).concat(all.filter(function (x) { return x.cr <= 0; }));
}
function bkDvTotal(e) { return ((e && e.lines) || []).reduce(function (a, l) { return a + Number(l.dr_minor || 0); }, 0); }
function bkDvParty(e) { var l = ((e && e.lines) || []).filter(function (x) { return x.party_name || x.party_id; })[0]; return l ? bkPartyLabel(l.party_id, l.party_name) : ''; }
function bkDvTenders(e) {
  var s = e && e.source; if (!s) return [];
  if (s.kind === 'day' && s.split && s.split.length) return s.split.map(function (x) { return x.how; });
  return s.how ? [s.how] : [];
}
/** the chips' four questions, and what each entry answers to them */
var BK_DV_DIMS = [['kind', 'Kind'], ['how', 'Tender'], ['counter', 'Counter'], ['by', 'Person']];
function bkDvVals(e, dim) {
  var s = (e && e.source) || {};
  if (dim === 'kind') return [bkDvKind(e)];
  if (dim === 'how') return bkDvTenders(e);
  return s[dim] ? [s[dim]] : [];
}
function bkDvFmt(day, o) { try { return CBLocale.date(day, o); } catch (_) { return String(day).slice(0, 10); } }
/** Day = the date · Week = Mon–Sun with the ISO week number · Month = its name */
function bkDvGroupOf(date, mode) {
  var day = String(date || '').slice(0, 10), t = new Date(day + 'T00:00:00Z');
  if (mode === 'month') return { key: day.slice(0, 7), label: bkDvFmt(day, { month: 'long', year: 'numeric' }) };
  if (mode === 'week') {
    var mon = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 864e5), thu = new Date(mon.getTime() + 3 * 864e5), sun = new Date(mon.getTime() + 6 * 864e5);
    var wk = Math.ceil(((thu - Date.UTC(thu.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7), iso = function (x) { return x.toISOString().slice(0, 10); }, o = { day: '2-digit', month: 'short' };
    return { key: iso(mon), label: txf('Week {n}', { n: wk }) + ' · ' + bkDvFmt(iso(mon), o) + ' – ' + bkDvFmt(iso(sun), o) };
  }
  return { key: day, label: bkDvFmt(day, { weekday: 'short', day: '2-digit', month: 'short' }) };
}
/** the shown rows as a CSV — client-side, one line per row; a cell that starts like a formula is quoted as text */
function bkDvCsv(list, c) {
  var pow = Math.pow(10, bkDec(c)), amt = function (m) { return (Number(m || 0) / pow).toFixed(bkDec(c)); };
  var cell = function (v) { var s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  var rows = [['date', 'no', 'kind', 'party', 'ref', 'how', 'counter', 'by', 'dr', 'cr', 'gist']];
  list.forEach(function (e) {
    var s = e.source || {}, cr = (e.lines || []).reduce(function (a, l) { return a + Number(l.cr_minor || 0); }, 0);
    rows.push([String(e.posting_date).slice(0, 10), e.entry_no, bkDvKind(e), bkDvParty(e), s.ref || '', bkDvTenders(e).join(' · '), s.counter || '', s.by || '',
      '#' + amt(bkDvTotal(e)), '#' + amt(cr), bkDvGist(e).map(function (x) { return x.name + ' ' + amt(x.amt); }).join('; ')]);
  });
  return rows.map(function (r, i) { return r.map(function (v) { return i && typeof v === 'string' && v.charAt(0) === '#' ? v.slice(1) : cell(v); }).join(','); }).join('\r\n') + '\r\n';
}
/** the rows the Day book is showing, in the order shown — what the CSV downloads (the unit hands them over: it holds the filters) */
function bkDvDownload(rows) {
  var d = BK.dv; if (!d) return;
  var blob = new Blob(['﻿' + bkDvCsv(rows, d.r.currency)], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'day-book-' + d.range.from + '-' + d.range.to + '.csv';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}
/** what the search looks in: the entry, its bill, its party (by name AND by number — "P0007"), its lines, and its amounts the way they are read */
function bkDvText(e, c) {
  var tot = bkDvTotal(e), pow = Math.pow(10, bkDec(c));
  return [e.entry_no, e.source && e.source.ref, e.narration, bkDvParty(e), bkDvKind(e)].concat((e.lines || []).map(function (l) { return [l.name, l.party_name, bkPartyLabel(l.party_id, l.party_name)].join(' '); }),
    [(tot / pow).toFixed(bkDec(c)), String(Math.floor(tot / pow)), bkMoney(tot, c)], bkDvGist(e).map(function (x) { return (x.amt / pow).toFixed(bkDec(c)); })).join(' ');
}
/** the group head's words: how many entries, Dr, Cr, Sales and each tender — every figure a sum of the server's own lines (plain text: the unit escapes it) */
function bkDvGroupSummary(entries, c) {
  var dr = 0, cr = 0, sales = 0;
  entries.forEach(function (e) {
    (e.lines || []).forEach(function (l) { dr += Number(l.dr_minor || 0); cr += Number(l.cr_minor || 0); });
    if (bkDvKind(e) === 'Sales') (e.lines || []).forEach(function (l) { if (/^4/.test(String(l.code))) sales += Number(l.cr_minor || 0) - Number(l.dr_minor || 0); });
  });
  var tn = bkDaySales(entries, null).tenders;
  var parts = [txn('{count} entry', '{count} entries', entries.length), tx('Dr') + ' ' + bkMoney(dr, c), tx('Cr') + ' ' + bkMoney(cr, c)];
  if (sales) parts.push(tx('Sales') + ' ' + bkMoney(sales, c));
  tn.forEach(function (x) { parts.push(tx(x.how) + ' ' + bkMoney(x.amount_minor, c)); });
  return parts.join(' · ');
}
/** what the Day book says about an entry — one fact a column (Athi, 2026-10-02: date · entry no · kind · party · bill · tender · counter · amount); the unit draws the caret, the header and the widths */
function bkDvCols(c) {
  var dash = '<span style="color:var(--grey)">—</span>';
  var no = function (e) { return esc(e.entry_no); };
  return [
    { key: 'date', label: tx('Date'), prio: 1, sort: 'date', w: 96, html: true, cell: function (e) { return '<span class="bkdv-dt">' + esc(bkDvFmt(String(e.posting_date).slice(0, 10), { day: '2-digit', month: 'short' })) + '</span>'; } },
    { key: 'no', label: tx('Entry'), prio: 6, sort: 'no', w: 150, html: true, cell: function (e) { return '<span class="mono">' + no(e) + '</span>' + bkDvRevChip(e); } },
    { key: 'kind', label: tx('Kind'), prio: 5, sort: 'kind', w: 100, html: true, cell: function (e) { return esc(tx(bkDvKind(e))); } },
    { key: 'party', label: tx('Party'), prio: 3, sort: 'party', w: 190, html: true, cell: function (e) { return esc(bkDvParty(e)) || dash; } },
    { key: 'bill', label: tx('Bill'), prio: 4, w: 230, html: true, tid: function (e) { return 'db-head-' + e.entry_no; }, cell: function (e) {
        var s = e.source || {}, t = 'db-src-' + e.entry_no;
        if (s.kind === 'day') return esc(tx('Walk-in day')) + (s.count != null ? ' · ' + bkDayBillsLink(s, t) : '');   /* M132: the count opens the bills list, as the statement rows do */
        if (s.ref || s.chit_id) return bkBillPart(s, t) + bkRecordedHTML(e, t);
        return esc(s.kind === 'receipt' ? tx('Received') : (e.narration || e.what || e.event_type || '')) + bkRecordedHTML(e, t) || dash;
      } },
    { key: 'how', label: tx('Tender'), prio: 7, w: 160, html: true, cell: function (e) { return bkHowPart(e.source, 'db-src-' + e.entry_no, c) || dash; } },
    { key: 'counter', label: tx('Counter'), prio: 8, w: 220, html: true, cell: function (e) {
        var s = e.source || {}, cw = s.counter ? esc(counterWord(s.counter)) : '', by = bkRungPart(s);
        /* the cashier and the counter are NOT the party: secondary text, never in the Party column */
        return (cw + (cw && by ? ' · ' : '') + (by ? '<span style="color:var(--grey)">' + by + '</span>' : '')) || dash; } },
    { key: 'amount', label: tx('Amount'), prio: 2, pin: 'end', sort: 'amount', w: 130, html: true, cell: function (e) { return '<b data-testid="db-total-' + no(e) + '">' + esc(bkMoney(bkDvTotal(e), c)) + '</b>'; } },
  ];
}
/** M174: a reversed entry says "Reversed by <its reversal's number>" - a link to that row - and offers no Reverse button (the action's `when`); the reversal says what it undoes */
function bkDvRevChip(e) {
  if (e.reversed_by) return '<div style="font-size:var(--fs-1);color:var(--grey)" data-testid="db-rev-' + esc(e.entry_no) + '">' + esc(tx('Reversed by')) + ' <a href="#" class="mono" data-testid="db-rev-link-' + esc(e.entry_no) + '" onclick="event.stopPropagation();bkDvGoto(\'' + esc(e.reversed_by) + '\');return false">' + esc(e.reversed_by) + '</a></div>';
  return '';
}
/** bring a row of the Day book into view (its reversal, from the chip) - or say it is outside these dates */
function bkDvGoto(no) {
  var n = document.querySelector('#bk_dvlist [data-no="' + String(no).replace(/"/g, '') + '"]');
  if (!n) { toast(tx('Not in these dates')); return; }
  n.scrollIntoView({ block: 'center' }); if (n.focus) n.focus();
}
/** M175: a reversal repaints the Day book from what the server answered - the original says who reversed it, the mirror row is added - no read of the whole book. true = handled */
function bkDvReversed(id, r) {
  var d = BK.dv; if (!d || !d.r || !d.api || BK.tab !== 'daybook') return false;
  var ents = d.r.entries || [], o = null; ents.forEach(function (e) { if (e.entry_id === id) o = e; });
  if (!o || !r || !r.entry_no) return false;
  o.reversed_by = r.entry_no; o.reversed_by_id = r.entry_id || null;
  var day = String(r.posting_date || '').slice(0, 10);
  if (day && day >= d.range.from && day <= d.range.to) ents.push({ entry_id: r.entry_id, entry_no: r.entry_no, posting_date: day, doc_date: day, event_type: 'reversal', narration: 'Reversal',
    source_chit_id: null, reverses_entry_id: id, reversed_by: null, reversed_by_id: null, source: null,
    lines: (o.lines || []).map(function (l) { return Object.assign({}, l, { dr_minor: l.cr_minor, cr_minor: l.dr_minor }); }) });
  d.r.count = ents.length; d.api.refresh(); return true;
}
/** its next level: the gist (the lines merged by ledger), then the Dr/Cr lines — each tax and sales line with its rate, as the line carries it */
function bkDvGistHTML(e, c) { return bkDvGist(e).map(function (x) { return esc(x.name) + ' ' + esc(bkMoney(x.amt, c)); }).join(' · '); }
function bkDvGistText(e, c) { return bkDvGist(e).map(function (x) { return x.name + ' ' + bkMoney(x.amt, c); }).join(' · '); }
function bkDvNext(e, c, lines, noParty, mine) {
  var no = esc(e.entry_no);
  var gist = bkDvGistHTML(e, c);
  /* ⭐ THE RATE (Athi, 2026-10-02): "Output CGST 6%", "Sales @12%" — as the line (the frozen invoice's) carries it, never worked out here */
  var rate = function (l) { var r = l.rate != null ? l.rate : l.rate_pct; return r != null && r !== '' && !/%/.test(String(l.name)) ? (/^4/.test(String(l.code)) ? ' @' : ' ') + esc(String(r)) + '%' : ''; };
  var grey = 'color:var(--grey);font-size:var(--fs-1);text-transform:uppercase';
  return '<div data-testid="db-lines-' + no + '">' + (lines ? '' : '<div data-testid="db-gist-' + no + '" style="color:var(--grey);font-size:var(--fs-1);padding:2px 0 4px">' + gist + '</div>')
    + '<div style="' + grey + '">' + CBList.nextRow([esc(tx('Code')) + ' · ' + esc(tx('Ledger')), esc(tx('Debit')), esc(tx('Credit'))], [110, 110]) + '</div>'
    + (e.lines || []).map(function (l) {
        var row = CBList.nextRow(['<span class="mono">' + esc(l.code) + '</span> ' + esc(l.name) + rate(l) + (l.party_name && !noParty ? ' · ' + esc(bkPartyLabel(l.party_id, l.party_name)) : ''),
          l.dr_minor ? esc(bkMoney(l.dr_minor, c)) : '', l.cr_minor ? esc(bkMoney(l.cr_minor, c)) : ''], [110, 110]);
        /* the ledger you are in is bold (the Ledgers page passes its code; the Day book passes none) */
        return mine && String(l.code) === String(mine) ? '<div class="lg-me" style="font-weight:700">' + row + '</div>' : row;
      }).join('') + '</div>';
}
/** the Day book's period: Today · This month · This FY · Custom — applies on pick (no Show button); bkRange('db') reads it */
function bkDbPeriod(preset, custom) {
  var today = bkToday(), d = new Date(), fy = (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1) + '-04-01';
  if (preset === 'today') return { preset: 'today', from: today, to: today };
  if (preset === 'month') return { preset: 'month', from: today.slice(0, 7) + '-01', to: today };
  if (preset === 'custom' && custom && custom.from && custom.to) return { preset: 'custom', from: custom.from, to: custom.to };
  return { preset: 'fy', from: fy, to: today };
}
function bkDbPeriodLabel(q, preset) {
  var o = { day: 'numeric', month: 'short' }, oy = { day: 'numeric', month: 'short', year: 'numeric' };
  return preset === 'today' ? bkDvFmt(q.to, oy) : bkDvFmt(q.from, o) + ' – ' + bkDvFmt(q.to, oy);
}
/** the head the Day book declares: its period, today's strip (sales per counter and by tender) as chips, and what waits on you as notices that open their fix */
function bkDvHead() {
  var d = BK.dv, r = d.r, c = r && r.currency, q = d.range, n = d.todo, p = BK.dbp || bkDbPeriod('fy');
  var t = bkDaySales((r && r.entries) || [], q.to), chips = [], notices = [];
  t.counters.forEach(function (x) { chips.push({ tid: 'strip-counter-' + x.counter, text: x.counter + ' ' + bkMoney(x.amount_minor, c) + ' · ' + txn('{count} bill', '{count} bills', x.bills) }); });
  t.tenders.forEach(function (x) { chips.push({ tid: 'strip-tender-' + x.how, text: tx(x.how) + ' ' + bkMoney(x.amount_minor, c) }); });
  /* ⚠️ walk-in cash/UPI/card reach the Day book only at day close — no walk-in day entry for this day means the strip is not the whole day yet, and says so (the counter holds the fix) */
  if (!t.day_closed) notices.push({ cls: 'warn', tid: 'strip-noclose', text: tx('Walk-ins not closed yet — close the day on the counter'), onOpen: function () { if (typeof navTo === 'function') navTo('counter'); } });
  if (n.accept) notices.push({ cls: 'warn', tid: 'todo-accept', text: n.accept + ' ' + tx(n.accept === 1 ? 'supplier bill to accept' : 'supplier bills to accept'),
    /* one bill → its sheet over the Day book; several → the Waiting list, whose rows open the sheet. Never Intake. */
    onOpen: function () { if (n.accept === 1 && (n.acceptIds || []).length === 1) openChitSheet(n.acceptIds[0]); else bkTab('waiting'); } });
  if (n.overdue) notices.push({ cls: 'warn', tid: 'todo-overdue', text: n.overdue + ' ' + tx(n.overdue === 1 ? 'customer overdue' : 'customers overdue'), onOpen: function () { bkTab('dues'); } });
  if (n.cheques) notices.push({ cls: 'warn', tid: 'todo-cheques', text: n.cheques + ' ' + tx(n.cheques === 1 ? 'cheque to deposit / clear' : 'cheques to deposit / clear'), onOpen: function () { bkTab('cheques'); } });
  if (n.waiting) notices.push({ cls: 'warn', tid: 'todo-waiting', text: n.waiting + ' ' + tx('waiting to be recorded'), onOpen: function () { bkTab('waiting'); } });
  if (!n.accept && !n.overdue && !n.cheques && !n.waiting) chips.push({ tid: 'todo-none', text: tx('Nothing waiting on you') });
  return { period: { label: bkDbPeriodLabel(q, p.preset), value: p.preset, custom: { from: q.from, to: q.to },
      presets: [['today', tx('Today')], ['month', tx('This month')], ['fy', tx('This FY (Apr–Mar)')], ['custom', tx('Custom')]],
      onPick: function (v, range) { if (v === 'custom' && !range) return; BK.dbp = bkDbPeriod(v, range); bkTab('daybook', true); } },
    chips: chips, notices: notices,
    /* ＋ Entry (cap-entry.js, loaded by CB Accounts): the one door to a manual entry, in the slot CBList gives the head — the page that loads cap-entry offers it, nobody else */
    slot: typeof enOpen === 'function' && !(typeof SESSION !== 'undefined' && SESSION && SESSION.role === 'customer') ? function (el) {
      el.innerHTML = '<button type="button" class="cbl-chip" data-testid="db-add" aria-label="' + esc(tx('New entry')) + '" style="cursor:pointer;min-height:44px;font-weight:700">＋ ' + esc(tx('Entry')) + '</button>';
      el.firstChild.onclick = function () { enOpen(); };
    } : undefined };
}
/** declare the Day book's list once per read: its columns, grouping, four filters (Kind · Tender · Counter · Person), sorts, search, next level, CSV — the page paints nothing else */
function bkDvMount(el) {
  var d = BK.dv, c = d.r.currency, ents = d.r.entries || [];
  var filters = BK_DV_DIMS.map(function (x) {
    var seen = [];
    ents.forEach(function (e) { bkDvVals(e, x[0]).forEach(function (v) { if (seen.indexOf(v) < 0) seen.push(v); }); });
    if (x[0] === 'kind') seen.sort(function (a, b) { return BK_KINDS.indexOf(a) - BK_KINDS.indexOf(b); }); else seen.sort();
    return { key: x[0], label: tx(x[1]), all: tx(x[1]), match: function (e, v) { return bkDvVals(e, x[0]).indexOf(v) >= 0; },
      options: seen.map(function (v) { return { v: v, label: x[0] === 'counter' ? tx('Counter') + ' ' + v : x[0] === 'by' ? v + (bkIsShopName(v) ? ' ' + tx('(owner)') : '') : tx(v) }; }) };
  });
  var by = function (f, num) { return function (a, b) { var x = f(a), y = f(b); return num ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }); }; };
  var cols = bkDvCols(c);
  return CBList.mount(el, {
    key: 'daybook', t: tx, view: 'lines',   /* the Day book reads as a line a record (Athi, 2026-10-02: "one after the other, so it is more readable") */
    rows: function () { return d.r.entries || []; }, id: function (e) { return e.entry_no; },
    head: bkDvHead, columns: cols, defaultCols: cols.filter(function (x) { return x.pin !== 'end'; }).map(function (x) { return x.key; }),
    rowTid: function (e) { return 'db-entry-' + e.entry_no; }, rowAttrs: function (e) { return { 'data-no': e.entry_no }; },
    gist: function (e) { return bkDvGistText(e, c); }, gistTid: function (e) { return 'db-gist-' + e.entry_no; },
    next: function (e, ctx) { return bkDvNext(e, c, ctx.view === 'lines'); },
    group: { default: 'day', tid: 'db', options: [['day', 'Day'], ['week', 'Week'], ['month', 'Month']],
      by: function (e, mode) { var g = bkDvGroupOf(e.posting_date, mode); return [g.label, g.key]; }, fig: function (rows) { return bkDvGroupSummary(rows, c); } },
    filters: filters, search: function (e) { return bkDvText(e, c); }, searchHint: tx('Search party, bill, amount'),
    sorts: [
      { key: 'rec', label: tx('As recorded'), cmp: function () { return 0; } },
      { key: 'date', label: tx('Date'), cmp: function (a, b) { return String(a.posting_date).localeCompare(String(b.posting_date)) || String(a.entry_no).localeCompare(String(b.entry_no), undefined, { numeric: true }); } },
      { key: 'no', label: tx('Entry'), cmp: by(function (e) { return e.entry_no; }) },
      { key: 'kind', label: tx('Kind'), cmp: by(function (e) { return BK_KINDS.indexOf(bkDvKind(e)); }, true) },
      { key: 'party', label: tx('Party'), cmp: by(function (e) { return bkDvParty(e); }) },
      { key: 'amount', label: tx('Amount'), cmp: by(bkDvTotal, true) },
    ],
    csv: function (rows) { bkDvDownload(rows); },
    /* Reverse this entry: insert-only — adds the mirror entry, never edits (cap-entry.js enReverse asks first) */
    actions: typeof enReverse === 'function' ? [{ id: 'reverse', icon: '↩', label: 'Reverse this entry', tid: 'db-reverse', when: function (e) { return !!e.entry_id && !e.reversed_by && !e.reverses_entry_id && e.event_type !== 'reversal'; }, run: function (e) { enReverse(e.entry_id, e.entry_no); } }] : undefined,
    tids: { expand: 'db-expand-all', collapse: 'db-collapse-all', csv: 'db-csv', count: 'db-count' },
    empty: { title: tx('Nothing in these dates') },
  });
}
async function bkDaybook(body) {
  var q = bkRange('db');
  try {
    /* the strip and the to-do read routes that already exist — the day book's own, dues, cheques, health — together */
    var rr = await Promise.all([api('booksDaybook', { query: q }), api('booksDues', { query: { asOf: bkToday() } }), bkChequesLoad(), bkHealthLoad()]);
    var r = rr[0]; bkDuesStore(rr[1]);   /* the same read names each entry's party (bkPartyLabel) */
    BK.dv = { r: r, range: q, todo: bkTodoCounts(rr[1], rr[2], rr[3]) };
    body.innerHTML = '<div id="bk_dvlist" data-testid="db-list"></div>';
    BK.dv.api = bkDvMount(document.getElementById('bk_dvlist'));
  } catch (e) { body.innerHTML = bkErr(e); }
}

/**
 * ══ THE LEDGERS ARE A FOLDER TREE AND THE TASK TABLE ═══════════════════════════════════════════════════════════════
 * Athi, 2026-10-02 (live): *"i couldn't see the folder for each of the ledger, how do i open the folders, no folder symbol or
 * something to see it as a folder, or a tree structure"*. So: on the left the tree Folders already draws (cap-folders.js
 * `_folderNode` / `_folderPanes` — the same node, the same two panes) — four bands (People · Things you hold · Income and
 * expenses · Your capital) as top folders, their groups (Cash & bank, Duties & taxes …), each ledger a leaf with its balance;
 * Customers (Sundry Debtors) and Suppliers (Sundry Creditors) are FOLDERS whose leaves are the PARTIES — "P0007 · Chola Auto
 * Care", ordered by party no, one balance each from the one /dues read. On the right, the chosen ledger's entries in the
 * Task table (list-ctl.js tbl*): one row an entry, its journal's Dr/Cr lines the next level, a bill number opens the sheet.
 * The classification is by CODE and decided HERE once (accounts.html no longer keeps a second copy); every figure is the server's.
 */
var BK_LT_BANDS = [
  { id: 'people', title: 'People', blurb: 'personal — customers and suppliers' },
  { id: 'things', title: 'Things you hold', blurb: 'real — cash, bank, stock, and what you owe on them' },
  { id: 'income', title: 'Income and expenses', blurb: 'nominal' },
  { id: 'capital', title: 'Your capital', blurb: 'what the owner has put in' },
];
/* [band, group, the codes it takes] — a code none of them claims lands in "Other" of its band, never nowhere */
var BK_LT_GROUPS = [
  ['things', 'Cash & bank', /^1[45]\d\d/], ['things', 'Stock & advances', /^(12|17|24)\d\d/], ['things', 'Duties & taxes', /^22[01]\d/], ['things', 'Taxes & suspense', /^(222|29)\d/],
  ['capital', "Owner's equity", /^3\d\d\d/],
  ['income', 'Income', /^4\d\d\d/], ['income', 'Direct costs', /^5\d\d\d/], ['income', 'Operating expenses', /^6[01]\d\d/], ['income', 'Adjustments', /^6[89]\d\d/],
];
/** the two control accounts open into one ledger per party: which side of /dues each takes, and its words */
var BK_CTRL = { '1300': { side: 'rcv', by: 'By customer', all: 'All customers' }, '2100': { side: 'pay', by: 'By supplier', all: 'All suppliers' } };
BK.lt = { open: {}, sel: null, model: null, bal: null, r: null, day: null, tq: '', w: 320, folded: null, api: null, prefs: false, noParty: false };
function bkLtBand(code) {
  var c = String(code == null ? '' : code);
  if (/^(1300|2100)/.test(c)) return 'people';
  if (/^3/.test(c)) return 'capital';
  if (/^[456]/.test(c)) return 'income';
  return 'things';
}
/** the accounts become bands → groups → ledgers. The per-party sub-accounts (1300-P…, 2100-P…) are NOT leaves: a party is read from /dues */
function bkLtModel(accounts) {
  var bands = BK_LT_BANDS.map(function (b) { return { id: b.id, title: b.title, blurb: b.blurb, groups: [], ctrl: [] }; });
  var order = BK_LT_GROUPS.map(function (g) { return g[1]; });
  (accounts || []).filter(function (a) { return !a.is_group && !/^(1300|2100)-/.test(String(a.code)); }).forEach(function (a) {
    var code = String(a.code), bid = bkLtBand(code), band = bands.filter(function (b) { return b.id === bid; })[0];
    if (BK_CTRL[code]) { band.ctrl.push({ code: code, name: String(a.name || ''), short: a.short_name || a.short || '' }); return; }
    var g = BK_LT_GROUPS.filter(function (x) { return x[2].test(code); })[0], title = g ? g[1] : 'Other';
    var grp = band.groups.filter(function (x) { return x.title === title; })[0];
    if (!grp) { grp = { title: title, accts: [] }; band.groups.push(grp); }
    grp.accts.push({ code: code, name: String(a.name || ''), short: a.short_name || a.short || '' });
  });
  bands.forEach(function (b) {
    b.groups.sort(function (x, y) { return (order.indexOf(x.title) + 100 * (x.title === 'Other')) - (order.indexOf(y.title) + 100 * (y.title === 'Other')); });
    b.groups.forEach(function (g) { g.accts.sort(function (x, y) { return String(x.code).localeCompare(String(y.code), 'en', { numeric: true }); }); });
    b.ctrl.sort(function (x, y) { return String(x.code).localeCompare(String(y.code)); });
  });
  return bands;
}
/** ⭐ ONE read of the trial balance gives every ledger's balance — never one read per row */
async function bkBalances() {
  var r = await api('booksTB', { query: { asOf: bkToday() } }), map = {};
  ((r && r.rows) || []).forEach(function (x) { map[String(x.code)] = Number(x.dr_minor || 0) - Number(x.cr_minor || 0); });
  return { map: map, cur: r && r.currency };
}
/**
 * ⭐ THE SHORT NAME (docs/design/ledgers-page README, "Anything else I'd change" #2): what a name is called where a long one would wrap.
 * The API's own `short_name` when it sends one; else the official name WITHOUT its trailing bracket ("Customers (Sundry Debtors)" → "Customers")
 * and with its legal form shortened ("Private Limited" → "Pvt Ltd"). DISPLAY ONLY — never stored, never sent; the full name is the
 * tooltip, and stays on bills and in CB CRM.
 */
function bkShort(o, name) {
  var s = o && (o.short_name || o.short); if (s) return String(s);
  var n = String(name == null ? '' : name).trim();
  var t = n.replace(/\s*\([^)]*\)\s*$/, '').replace(/\bPrivate Limited\b/i, 'Pvt Ltd').replace(/\bLimited\b/i, 'Ltd').replace(/\s{2,}/g, ' ').trim();
  return t || n;
}
/** a ledger's figure in the tree: "₹12,400.00 Dr" — from the ONE trial-balance read; "—" when the trial balance does not list it, never a made-up nil */
function bkLtBal(code) {
  var b = BK.lt.bal; if (!b) return '';
  var v = b.map[code];
  if (v === undefined) return '<span class="am nil" data-testid="bal-' + esc(code) + '" title="' + esc(tx('Not on the trial balance')) + '">—</span>';
  return '<span class="am' + (v ? '' : ' nil') + '" data-testid="bal-' + esc(code) + '">' + (v ? esc(bkDrCr(v, b.cur)) : '—') + '</span>';
}
/** the parties of a control account, from the one /dues read, ordered by party no (the ledger's key on screen) */
function bkLtParties(ctrl) {
  return Object.keys(BK.dues || {}).map(function (k) { return BK.dues[k]; }).filter(function (p) { return bkDuesSide(p) === BK_CTRL[ctrl].side; })
    .sort(function (a, b) { return String(a.party_no || '').localeCompare(String(b.party_no || ''), undefined, { numeric: true }); });
}
function bkPartyShort(id, fallback) { var d = id && BK.dues && BK.dues[id]; return bkShort(d, (d && d.name) || fallback || ''); }
/** the last month end both sides agreed (the API sends it per party when the monthly agreement runs); nothing is drawn without it */
function bkAgreedTo(o) { var v = o && (o.agreed_to || o.agreedTo); return v ? String(v).slice(0, 10) : ''; }

/* ── what a person chose here is remembered on this device, per person: the tree's width, what is folded, the last ledger ──
   (the API has no `ledgers` preference kind yet — CBPrefs would carry it across devices; listed in the PR) */
function bkLtPrefKey() { var s = (typeof SESSION !== 'undefined' && SESSION) || {}; return 'cb_lt.' + (s.entityId || s.entity || '') + '.' + (s.bridgeId || s.name || ''); }
function bkLtPrefsRead() {
  if (BK.lt.prefs) return; BK.lt.prefs = true;
  var v = null; try { v = JSON.parse(localStorage.getItem(bkLtPrefKey()) || 'null'); } catch (_) {}
  v = v || {};
  if (v.open && typeof v.open === 'object') BK.lt.open = v.open;
  if (typeof v.w === 'number') BK.lt.w = Math.max(240, Math.min(520, v.w));
  if (typeof v.folded === 'boolean') BK.lt.folded = v.folded;
  if (v.last && v.last.code) BK.lt.last = v.last;
}
function bkLtPrefsSave() {
  var s = BK.lt.sel;
  try { localStorage.setItem(bkLtPrefKey(), JSON.stringify({ open: BK.lt.open, w: BK.lt.w, folded: BK.lt.folded, last: s ? { code: s.code, party: s.party || null } : (BK.lt.last || null) })); } catch (_) {}
}
function bkLtFolded() { if (BK.lt.over) return false; return BK.lt.folded == null ? (typeof window !== 'undefined' && window.innerWidth <= 1200) : !!BK.lt.folded; }
/** on a narrow laptop (pane ≤ 1100 px) the tree comes back OVER the list for one pick, never beside it: the list keeps the width its tools row needs, so the head stays within 20% */
function bkLtOverlay() { var e = document.getElementById('bk_lt'); return !!e && e.clientWidth > 620 && e.clientWidth <= 1100; }
function bkLtNarrow() { var e = document.getElementById('bk_lt'); return !!e && e.clientWidth > 0 && e.clientWidth <= 620; }

/* ── the tree: bands → groups → ledgers → parties, ONE line per node, the figure in one aligned column ── */
function bkLtOpenNow(id, def) { if (String(BK.lt.tq || '').trim()) return true; var v = BK.lt.open[id]; return v === undefined ? def : !!v; }
function bkLtSet(id, v) { BK.lt.open[id] = !!v; bkLtPrefsSave(); }
function bkLtLedgerNode(a, parties) {
  var d = !!BK_CTRL[a.code];
  return { t: 'ledger', id: 'L:' + a.code, code: a.code, name: a.short || bkShort(null, a.name), full: a.name, ctrl: d, parties: parties || [] };
}
/** the nodes the person sees — the find box filters them as they type (a code finds its ledger: "6010" finds Rent; a name finds a ledger or a party) */
function bkLtNodes() {
  var q = String(BK.lt.tq || '').trim().toLowerCase(), out = [];
  var hit = function () { return !q || Array.prototype.slice.call(arguments).join(' ').toLowerCase().indexOf(q) >= 0; };
  (BK.lt.model || []).forEach(function (b) {
    var kids = [], n = 0;
    b.ctrl.forEach(function (c) {
      var all = bkLtParties(c.code), self = !q || String(c.code).indexOf(q) === 0 || hit(c.name, bkShort(c, c.name));
      var ps = all.filter(function (p) { return hit(p.party_no, p.name, bkShort(p, p.name)); });
      if (q && !self && !ps.length) return;
      n++;
      kids.push(bkLtLedgerNode(c, (self && !ps.length ? all : ps).map(function (p) { return { t: 'party', id: 'P:' + p.party_id, party: p.party_id, ctrl: c.code, name: bkShort(p, p.name), full: bkPartyLabel(p.party_id, p.name), fig: Number(p.balance_minor || 0), ok: !!bkAgreedTo(p) }; })));
    });
    b.groups.forEach(function (g, gi) {
      var as = g.accts.filter(function (a) { return !q || String(a.code).indexOf(q) === 0 || hit(a.name, bkShort(a, a.name)); });
      if (!as.length) return;
      n += as.length;
      kids.push({ t: 'grp', id: 'G:' + b.id + '/' + gi, name: tx(g.title), tid: 'lt-group-' + g.title, count: as.length, kids: as.map(function (a) { return bkLtLedgerNode(a); }) });
    });
    if (kids.length) out.push({ t: 'band', id: 'B:' + b.id, name: tx(b.title), tid: 'lt-band-' + b.id, count: n, kids: kids });
  });
  return out;
}
function bkLtMark(s) {
  var q = String(BK.lt.tq || '').trim(); if (!q) return esc(s);
  var i = String(s).toLowerCase().indexOf(q.toLowerCase()); if (i < 0) return esc(s);
  return esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length));
}
function bkLtTreeHTML() {
  var sel = BK.lt.sel, narrow = bkLtNarrow(), h = '', c = BK.lt.bal && BK.lt.bal.cur, widest = 6;
  var selId = sel ? (sel.party ? 'P:' + sel.party : 'L:' + sel.code) : '';
  function amt(n) {
    if (n.t === 'band' || n.t === 'grp') return '<span class="am">' + n.count + '</span>';
    /* the open ledger shows no figure here: the title row beside it already does (on a phone's first page there is no title row, so it does) */
    if (n.id === selId && !narrow) return '<span class="am"></span>';
    if (n.t === 'party') { var t = n.fig ? bkDrCr(n.fig, BK.duesCur) : '—'; widest = Math.max(widest, t.length); return '<span class="am' + (n.fig ? '' : ' nil') + '">' + (n.ok ? '<span class="ck" aria-label="' + esc(tx('agreed')) + '" title="' + esc(tx('Agreed at the last month end')) + '">✓</span>' : '') + esc(t) + '</span>'; }
    var b = bkLtBal(n.code); var m = /<span[^>]*>([^<]*)<\/span>/.exec(b); if (m) widest = Math.max(widest, m[1].length); return b;
  }
  function walk(n, lvl) {
    var kids = n.t === 'ledger' ? n.parties.length : (n.kids || []).length, open = kids ? bkLtOpenNow(n.id, n.t === 'ledger' ? false : true) : false;
    var tid = n.tid || (n.t === 'ledger' ? 'lg-acc-' + n.code : n.t === 'party' ? 'lg-party-' + n.party : '');
    h += '<button type="button" class="tn ltn ' + n.t + (n.id === selId ? ' on' : '') + '" role="treeitem" data-tn="' + esc(n.id) + '"' + (n.t === 'party' ? ' data-ctrl="' + esc(n.ctrl) + '"' : '')
      + ' aria-level="' + (lvl + 1) + '"' + (kids ? ' aria-expanded="' + open + '"' : '') + (n.t === 'ledger' || n.t === 'party' ? ' aria-selected="' + (n.id === selId) + '"' : '') + ' tabindex="-1" data-testid="' + esc(tid) + '"'
      + (n.full && n.full !== n.name ? ' title="' + esc(n.full) + '"' : '') + ' style="--lvl:' + lvl + '"><span class="tw" aria-hidden="true">' + (kids ? (open ? '▾' : '▸') : '') + '</span><span class="nm">' + bkLtMark(n.name) + '</span>' + amt(n) + '</button>';
    if (kids && open) (n.t === 'ledger' ? n.parties : n.kids).forEach(function (k) { walk(k, lvl + 1); });
  }
  bkLtNodes().forEach(function (n) { walk(n, 0); });
  BK.lt.amW = widest + 1;
  return h || '<div class="lt-empty">' + esc(String(BK.lt.tq || '').trim() ? txf('No ledger or party called “{q}”.', { q: String(BK.lt.tq).trim() }) : tx('No ledgers yet')) + (String(BK.lt.tq || '').trim() ? '<br><button type="button" class="lt-btn" data-lt="clear" data-testid="lt-clear">' + esc(tx('Clear')) + '</button>' : '') + '</div>';
}
function bkLtTreePaint(focusId) {
  var t = document.getElementById('lt_tree'); if (!t) return;
  var ae = document.activeElement, keep = focusId || (ae && t.contains(ae) && ae.getAttribute && ae.getAttribute('data-tn'));
  t.innerHTML = bkLtTreeHTML(); t.style.setProperty('--am-w', (BK.lt.amW || 12) + 'ch');
  var all = t.querySelectorAll('.tn'), f = (keep && t.querySelector('[data-tn="' + keep.replace(/"/g, '') + '"]')) || t.querySelector('.tn[aria-selected="true"]') || all[0];
  if (f) f.tabIndex = 0;
  if (focusId && f) f.focus();
}
function bkLtFocus(id) { var t = document.getElementById('lt_tree'); if (!t) return; var all = t.querySelectorAll('.tn'); Array.prototype.forEach.call(all, function (x) { x.tabIndex = -1; }); var b = t.querySelector('[data-tn="' + id + '"]'); if (b) { b.tabIndex = 0; b.focus(); } }
function bkLtTitle() {
  var s = BK.lt.sel; if (!s) return '';
  if (s.party) return bkPartyShort(s.party, ((BK.lt.r && BK.lt.r.party) || {}).name);
  var a = bkLtAcct(s.code); return a ? (a.short || bkShort(null, a.name)) : s.code;
}
function bkLtPaneHTML() {
  var sel = BK.lt.sel;
  if (!sel) return emptyState('📒', tx('Pick a ledger'), esc(tx('Open a group on the left, then a ledger, to see its entries.')));
  return '<div id="lg_out" data-testid="lg_out"></div>';
}
function bkLtBack() {
  var s = BK.lt.sel; if (s) BK.lt.last = { code: s.code, party: s.party || null };
  if (typeof BK.onLedger === 'function') BK.onLedger(null);
  if (BK.lt.api) { BK.lt.api.destroy(); BK.lt.api = null; }
  BK.lt.sel = null; var el = document.getElementById('bk_lt'); if (el) el.classList.remove('has-sel', 'folded');
  var p = document.getElementById('lt_pane'); if (p) p.innerHTML = bkLtPaneHTML();
  bkLtTreePaint(s ? (s.party ? 'P:' + s.party : 'L:' + s.code) : null);
}
function bkLtOpen(sel) {
  if (typeof BK.onLedger === 'function') BK.onLedger(sel);   /* a host page takes its own header away (accounts.html) BEFORE the title row takes the shop · Home · avatar */
  if (BK.lt.api) { BK.lt.api.destroy(); BK.lt.api = null; }
  BK.lt.over = false; BK.lt.sel = sel; BK.lt.r = null; BK.lt.err = null; BK.lt.day = null; BK.lt.dayP = null; BK.lt.noParty = false; BK.lt.last = { code: sel.code, party: sel.party || null };
  ['ledger-control', 'ledger-plain', 'ledger-party'].forEach(function (k) { CBList.reset(k); });   /* an open row, a search and a filter belong to the ledger they were made in */
  var el = document.getElementById('bk_lt'); if (el) { el.classList.add('has-sel'); el.classList.toggle('folded', bkLtFolded()); }   /* the tree folds away once a ledger is open on a narrow laptop (the person's own choice wins); with none open it is always shown */
  bkLtPrefsSave();
  var p = document.getElementById('lt_pane'); if (p) p.innerHTML = bkLtPaneHTML();
  bkLtTreePaint();
  var out = document.getElementById('lg_out'); if (out) BK.lt.api = bkLgMount(out);
  bkKuralFor();
  bkLtLoad();
}
function bkLtAcct(code) { var f = null; (BK.lt.model || []).forEach(function (b) { b.ctrl.concat(b.groups.reduce(function (a, g) { return a.concat(g.accts); }, [])).forEach(function (a) { if (a.code === code) f = a; }); }); return f; }
function bkLtPick(code) { BK.lgAcc = code; bkLtOpen({ code: code }); }
/** a control account: its folder opens (its parties appear) and its own ledger shows — total of the parties beside its closing */
function bkLtPickCtrl(code) { BK.lt.open['L:' + code] = true; BK.lt.open['B:people'] = true; bkLtPick(code); }
function bkLtPickParty(id, ctrl) { BK.lgAcc = ctrl; delete BK.stmt[id]; BK.lt.open['L:' + ctrl] = true; bkLtOpen({ code: ctrl, party: id }); }
/** which kural the open ledger carries (docs/design/ledgers-page README "Which kural"): the API sends no `ledger.kural` yet, so the page names the route of kurals.json; People and a first page read the page's own */
function bkKuralFor() {
  if (typeof CBKural === 'undefined') return;
  var s = BK.lt.sel, code = s ? String(s.code) : '', route = 'accounts';
  if (/^1[45]/.test(code)) route = 'daybook';                  /* Cash & bank → 520 · check every day */
  else if (/^22[01]/.test(code)) route = 'gst';                 /* GST, TDS → 733 */
  else if (/^29/.test(code)) route = 'suspense';                /* Suspense → 436 */
  else if (/^[456]/.test(code)) route = 'reports';              /* Income and expenses → 754 */
  else if (/^3/.test(code)) route = 'period-close';             /* Your capital → 385 */
  CBKural.set(route);
}
async function bkLtLoad() {
  var sel = BK.lt.sel; if (!sel) return;
  try {
    var r, ctrl = BK_CTRL[sel.code];
    if (sel.party) { r = await api('booksStatement', { params: { id: sel.party } }); BK.stmt[sel.party] = r; }
    else { var rr = await Promise.all([api('booksLedger', { params: { account: sel.code }, query: bkRange('lg') }), ctrl ? booksDuesLoad(true) : null]); r = rr[0]; if (ctrl) bkLtTreePaint(); }
    if (BK.lt.sel !== sel) return;
    BK.lt.r = r; BK.lt.err = null; BK.lt.day = null; BK.lt.dayP = null; BK.lgR = r;
    (r.lines || []).forEach(function (l, i) { l._ix = i; });   /* a line's place in the statement is its row id */
    if (BK.lt.api) BK.lt.api.refresh({ filters: bkLgFilters() });
  } catch (e) { if (BK.lt.sel !== sel) return; BK.lt.err = e; if (BK.lt.api) BK.lt.api.refresh(); }
}

/* ── the list: a CBList declaration for the chosen ledger ── */
var BK_NO_PARTY = 'No party';
function bkLgKind() { var s = BK.lt.sel || {}; return s.party ? 'party' : (BK_CTRL[s.code] ? 'control' : 'plain'); }
function bkLgDash() { return '<span style="color:var(--grey)">—</span>'; }
function bkEntryWord(e) {
  var s = e && e.source;
  return s && s.kind === 'day' ? esc(tx('Walk-in day')) : s && s.kind === 'receipt' ? esc(tx('Received')) : esc((e && (e.narration || e.what || e.event_type)) || '');
}
/** the Details cell: the kind and the bill, ONCE ("Expense C2/26-27/0007 11:44") — the entry number, the tender, the counter and who rang it live in ⚙ and in the opened entry */
function bkLgDetails(l) {
  var s = l.source || {}, tid = 'stmt-src-' + l._ix, word = bkEntryWord(l), kw = BK_SRC_WORD[s.kind] ? tx(BK_SRC_WORD[s.kind]) : '';
  var said = !!kw && String(word).trim().toLowerCase() === kw.toLowerCase(), out = word;
  if (s.kind === 'day') { if (s.count != null) out += ' · ' + esc(txn('{count} bill', '{count} bills', s.count)); }
  else if (s.ref || s.chit_id) out += (said ? ' ' : ' · ' + (kw ? esc(kw) + ' ' : '')) + bkBillPart(s, tid);
  return out + bkRecordedHTML(l, tid) + (l.ref && !s.ref ? ' <span class="mono">' + esc(l.ref) + '</span>' : '') + bkLineChips(l, 'stmt-' + l._ix);
}
function bkLgCols(c, kind) {
  var dash = bkLgDash(), ctrl = kind === 'control';
  /* ONE flexible column (the designer's): Details takes what the others leave, so the default columns fill the pane and never spill sideways — a bill number is not broken across two lines. A width the person dragged wins (CBList remembers it). */
  var box = document.getElementById('lg_out'), avail = box ? box.clientWidth : 0, whatW = Math.max(240, Math.min(560, avail - (112 + (ctrl ? 250 : 160) + 160) - 12));
  var cols = [{ key: 'date', label: tx('Date'), prio: 1, sort: 'date', w: 112, html: true, cell: function (l) { return esc(bkDvFmt(String(l.date).slice(0, 10), { day: '2-digit', month: 'short' })); } }];
  if (ctrl) cols.push({ key: 'party', label: tx('Party'), prio: 2, sort: 'party', w: 250, html: true, cell: function (l) {
    var n = l.party_id ? bkPartyLabel(l.party_id, l.party_name) : (l.party_name || '');
    return n ? '<b class="lg-party">' + esc(n) + '</b>' : '<span class="lg-noparty" style="color:var(--grey)">' + esc(tx(BK_NO_PARTY)) + '</span>'; } });
  cols.push(
    { key: 'what', label: tx('Details'), prio: ctrl ? 3 : 2, sort: 'what', w: whatW, html: true, tid: function (l) { return 'stmt-what-' + l._ix; }, cell: bkLgDetails },
    { key: 'bal', label: tx('Balance'), prio: ctrl ? 9 : 3, sort: 'bal', num: true, w: 160, html: true, cell: function (l) { return esc(bkDrCr(l.running_minor, c)); } },
    { key: 'entry', label: tx('Entry no.'), prio: 5, sort: 'entry', w: 170, html: true, cell: function (l) { return l.entry_no || l.ref ? '<span class="mono">' + esc(l.entry_no || l.ref) + '</span>' : dash; } },
    { key: 'tender', label: tx('Tender'), prio: 6, w: 120, html: true, cell: function (l) { return bkHowPart(l.source, 'stmt-how-' + l._ix, c) || dash; } },
    { key: 'counter', label: tx('Counter'), prio: 7, w: 120, html: true, cell: function (l) { var s = l.source || {}; return s.counter ? esc(counterWord(s.counter)) : dash; } },
    { key: 'person', label: tx('Rung by'), prio: 8, w: 130, html: true, cell: function (l) { var s = l.source || {}; return s.by ? esc(s.by) + (bkIsShopName(s.by) ? ' <span style="color:var(--grey)">' + esc(tx('(owner)')) + '</span>' : '') : dash; } });
  /* the amount is ONE column, pinned at the end, written Dr / Cr — never a minus (the Debit / Credit pair became this) */
  cols.push({ key: 'amount', label: tx('Amount'), prio: 4, pin: 'end', sort: 'amount', num: true, w: 160, html: true, cell: function (l) {
    return l.dr_minor ? '<b data-testid="stmt-amt-' + l._ix + '">' + esc(bkMoney(l.dr_minor, c) + ' ' + tx('Dr')) + '</b>' : l.cr_minor ? '<b data-testid="stmt-amt-' + l._ix + '">' + esc(bkMoney(l.cr_minor, c) + ' ' + tx('Cr')) + '</b>' : dash; } });
  return cols;
}
/** a ledger's head is the CBList title row: the ledger's name, the period chip (the Day book's presets), ONE figures line, the notice when something needs a hand */
function bkLgPeriodHead() {
  var p = BK.lgp || (BK.lgp = bkDbPeriod('fy')), q = bkRange('lg');
  var pane = document.getElementById('lt_pane'), word = { today: 'Today', month: 'This month', fy: 'This FY' }[p.preset];
  /* the chip says the preset's name ("This FY") where the pane is too narrow for the dates — they are the chip's popover and the figures' own period */
  return { label: word && pane && pane.clientWidth < 1100 ? tx(word) : bkDbPeriodLabel(q, p.preset), value: p.preset, custom: { from: q.from, to: q.to },
    presets: [['today', tx('Today')], ['month', tx('This month')], ['fy', tx('This FY (Apr–Mar)')], ['custom', tx('Custom')]],
    onPick: function (v, range) { if (v === 'custom' && !range) return; BK.lgp = bkDbPeriod(v, range); BK.lt.r = null; BK.lt.noParty = false; if (BK.lt.api) BK.lt.api.refresh(); bkLtLoad(); } };
}
/**
 * ⭐ THE ONE FIGURES LINE (2026-10-03: the closing was shown three times with changing signs): "Opening ₹x Cr · Closing ₹y Cr", or "Balance ₹x Cr" once when they are the same,
 * and for a control account "✓ parties agree". Every figure is the server's. The parties check reads the API's `parties_check` when it sends one; until it does the page makes the
 * one comparison it always made — the parties' balances (the one /dues read) against the ledger's closing (listed in the PR as an API field).
 */
function bkLgFigs(r, c, sel) {
  var op = Number(r.opening_minor || 0), cl = Number(r.closing_minor || 0), same = op === cl, parts = same ? [tx('Balance') + ' ' + bkDrCr(cl, c)] : [tx('Opening') + ' ' + bkDrCr(op, c), tx('Closing') + ' ' + bkDrCr(cl, c)], check = null;
  if (!sel.party && BK_CTRL[sel.code]) {
    var pc = r.parties_check, none = (r.lines || []).filter(function (l) { return !l.party_id && !l.party_name; }).length;
    if (pc && typeof pc.agree === 'boolean') check = pc.agree ? { agree: true } : { agree: false, amount: Number(pc.amount_minor || 0), n: pc.entries != null ? Number(pc.entries) : none };
    else { var total = bkLtParties(sel.code).reduce(function (a, p) { return a + Number(p.balance_minor || 0); }, 0); check = total === cl ? { agree: true } : { agree: false, amount: cl - total, n: none }; }
  }
  return { text: parts.join(' · ') + (check && check.agree ? ' · ' + tx('✓ parties agree') : ''), same: same, check: check };
}
function bkLgHead() {
  var sel = BK.lt.sel; if (!sel) return null;
  var r = BK.lt.r, own = !!sel.party, c = (r && r.currency) || BK.duesCur, h = { title: bkLtTitle(), chips: [], notices: [] };
  if (!own) h.period = bkLgPeriodHead();
  if (r) {
    var f = bkLgFigs(r, c, sel);
    h.chips.push({ tid: 'lg-sum', text: f.text });
    var ag = own ? bkAgreedTo(r) || bkAgreedTo(BK.dues && BK.dues[sel.party]) : '';
    if (ag) h.chips.push({ tid: 'lg-agreed', text: tx('✓ Agreed up to') + ' ' + bkDate(ag) });
    if (f.check && !f.check.agree) {
      h.notices.push({ cls: 'warn', tid: 'lg-parties-diff', text: BK.lt.noParty ? txf(f.check.n === 1 ? 'Showing the {n} entry with no party · Show all' : 'Showing the {n} entries with no party · Show all', { n: f.check.n })
          : bkDrCr(f.check.amount, c) + ' ' + tx('with no party'),
        onOpen: function () { BK.lt.noParty = !BK.lt.noParty; if (BK.lt.api) BK.lt.api.refresh(); if (BK.lt.noParty && typeof toast === 'function') toast(txf(f.check.n === 1 ? 'Showing the {n} entry with no party. Open it and pick the party.' : 'Showing the {n} entries with no party.', { n: f.check.n })); } });
    }
  }
  h.slot = function (el) {
    var x = '';
    if (bkLtNarrow()) x += '<button type="button" class="cbl-tbtn cbl-ico" data-lt="back" data-testid="lt-back" aria-label="' + esc(tx('Back to all ledgers')) + '">‹</button>';
    if (bkLtFolded() && !bkLtNarrow()) x += '<button type="button" class="cbl-tbtn" data-lt="unfold" data-testid="lt-unfold" aria-label="' + esc(tx('Show the ledger list')) + '">☰ ' + esc(tx('Ledgers')) + '</button>';
    if (own) {
      x += '<span style="display:inline-flex;gap:6px;flex-wrap:nowrap">';
      x += '<button type="button" class="cbl-tbtn" data-lt="statement" data-testid="lg-statement">' + esc(tx('Statement')) + '</button>';
      x += '<button type="button" class="cbl-tbtn" data-lt="pay" data-testid="lg-pay">' + esc(tx(bkPartyKind(BK.lt.sel.party, BK.lt.sel.code) === 'supplier' ? 'Pay' : 'Receive')) + '</button>';
      x += '</span>';
    }
    el.innerHTML = x;
    if (typeof BK.slotWho === 'function') BK.slotWho(el);
  };
  return h;
}
function bkLgCsv(rows, c) {
  var pow = Math.pow(10, bkDec(c)), amt = function (m) { return (Number(m || 0) / pow).toFixed(bkDec(c)); };
  var cell = function (v) { var s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  var out = [['date', 'details', 'party', 'entry_no', 'dr', 'cr', 'balance', 'balance_side']];
  rows.forEach(function (l) { var s = l.source || {}, b = Number(l.running_minor || 0);
    out.push([String(l.date).slice(0, 10), String(l.narration || l.what || s.kind || '') + (s.ref ? ' ' + s.ref : ''), l.party_name || '', l.entry_no || l.ref || '', l.dr_minor ? amt(l.dr_minor) : '', l.cr_minor ? amt(l.cr_minor) : '', amt(Math.abs(b)), b ? (b > 0 ? 'Dr' : 'Cr') : '']); });
  return out.map(function (r) { return r.map(cell).join(','); }).join('\r\n') + '\r\n';
}
function bkLgDownload(rows) {
  var r = BK.lt.r, sel = BK.lt.sel; if (!r || !sel) return;
  var blob = new Blob(['﻿' + bkLgCsv(rows, r.currency)], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ledger-' + (sel.party || sel.code) + '.csv';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}
function bkLgMount(el) {
  var by = function (g, num) { return function (a, b) { var x = g(a), y = g(b); return num ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }); }; };
  var kind = bkLgKind(), c0 = BK.duesCur;
  var cur = function () { return (BK.lt.r && BK.lt.r.currency) || c0; };
  var dflt = kind === 'control' ? ['date', 'party', 'what'] : kind === 'party' ? ['date', 'what', 'bal'] : ['date', 'what', 'bal'];
  return CBList.mount(el, {
    key: 'ledger-' + kind, t: tx, view: 'grid', fill: false,   /* the pane's own layout (flex) sizes the list — it leaves room for the kural footer, which fit() (window height minus the top) would not */
    state: function () { return BK.lt.err ? 'error' : (BK.lt.r ? undefined : 'loading'); }, error: function () { return { title: tx('This ledger could not be read.'), sub: bkWhy(BK.lt.err, tx('Nothing was lost. Try again in a moment.')) }; }, onRetry: function () { BK.lt.err = null; if (BK.lt.api) BK.lt.api.refresh(); bkLtLoad(); },
    rows: function () { var ls = (BK.lt.r && BK.lt.r.lines) || []; return BK.lt.noParty ? ls.filter(function (l) { return !l.party_id && !l.party_name; }) : ls; },
    id: function (l) { return String(l._ix); }, rowTid: function (l) { return 'stmt-row-' + l._ix; },
    columns: function () { return bkLgCols(cur(), kind); }, defaultCols: dflt,
    head: bkLgHead,
    search: function (l) { var s = l.source || {}, c = cur(); return [l.date, l.what, l.narration, l.ref, l.entry_no, l.party_name, bkPartyLabel(l.party_id, l.party_name), s.ref, s.how, s.counter, s.by, (Number(l.dr_minor || l.cr_minor || 0) / Math.pow(10, bkDec(c))).toFixed(bkDec(c))].join(' '); },
    searchHint: tx('Search bill, party, amount'),
    /* newest first, like a passbook app; the ▲▼ on Date reverses it */
    sorts: [{ key: 'date', label: tx('Newest first'), cmp: function (a, b) { return String(b.date).localeCompare(String(a.date)) || b._ix - a._ix; } },
      { key: 'what', label: tx('Details'), cmp: by(function (l) { return l.what || l.narration || ''; }) }, { key: 'party', label: tx('Party'), cmp: by(function (l) { return bkPartyLabel(l.party_id, l.party_name); }) },
      { key: 'entry', label: tx('Entry no.'), cmp: by(function (l) { return l.entry_no || l.ref || ''; }) }, { key: 'bal', label: tx('Balance'), cmp: by(function (l) { return Number(l.running_minor || 0); }, true) },
      { key: 'amount', label: tx('Amount'), cmp: by(function (l) { return Number(l.dr_minor || 0) - Number(l.cr_minor || 0); }, true) }],
    filters: bkLgFilters(),
    /* Month · Day · None, newest first. A group head says only "n shown": the API sends no month / day totals yet, and the page adds up no money (listed in the PR) */
    group: { default: 'month', tid: 'lg', options: [['month', 'Month'], ['day', 'Day'], ['none', 'None']],
      by: function (l, mode) { if (mode === 'none') return null; var g = bkDvGroupOf(l.date, mode); return [g.label, g.key]; } },
    csv: function (rows) { bkLgDownload(rows); },
    /* its journal is read once, on the first open, and the row shows it when it arrives */
    next: function (l) { return bkLgJournal().then(function () { return bkLgNext(l, cur()); }); },
    /* Reverse this entry (insert-only: cap-entry.js asks first). The line names its entry only through the journal, so the journal is read first and a line that cannot be reversed (already reversed, or itself a reversal) says so. */
    /* M29: a line that names its entry (a party statement) reverses FROM THE ROW — no Day book read, and the row repaints itself (bkReverseLine); an account ledger's line still goes through its journal */
    actions: typeof enReverse === 'function' ? [{ id: 'reverse', icon: '↩', label: 'Reverse this entry', tid: 'lg-reverse', when: function (l) { return l.entry_id ? bkCanReverse(l) : !!(l.entry_no || l.ref || l.source_chit_id || (l.source && l.source.chit_id)); },
      run: function (l) { if (l.entry_id) return bkReverseLine(l, BK.lt.sel && BK.lt.sel.party); bkLgJournal().then(function () { var e = bkLgEntry(l); if (!e || !e.entry_id || e.reversed_by || e.reverses_entry_id || e.event_type === 'reversal') { if (typeof toast === 'function') toast(tx('This entry cannot be reversed here.')); return; } enReverse(e.entry_id, e.entry_no); }); } }] : undefined,
    tids: { expand: 'lg-expand-all', collapse: 'lg-collapse-all', csv: 'lg-csv', count: 'lg-count' },
    empty: { title: tx('No entries in these dates') },
  });
}
/** a ledger line's journal: the day-book entry it belongs to (by its entry number, else its chit and date) — read once, on the first open */
function bkLgEntry(l) {
  var es = (BK.lt.day && BK.lt.day.entries) || [], d = String(l.date || '').slice(0, 10);
  return es.filter(function (e) { return (l.entry_no && e.entry_no === l.entry_no) || (l.entry_id && e.entry_id === l.entry_id) || (!l.entry_no && !l.entry_id && (l.source_chit_id || (l.source && l.source.chit_id)) && (e.source_chit_id || (e.source && e.source.chit_id)) === (l.source_chit_id || (l.source && l.source.chit_id)) && String(e.posting_date).slice(0, 10) === d); })[0];
}
function bkLgJournal() {
  if (BK.lt.day) return Promise.resolve();
  if (BK.lt.dayP) return BK.lt.dayP;
  var ls = (BK.lt.r && BK.lt.r.lines) || [], ds = ls.map(function (l) { return String(l.date || '').slice(0, 10); }).filter(Boolean).sort(), me = BK.lt.r;
  return (BK.lt.dayP = api('booksDaybook', { query: { from: ds[0] || bkRange('lg').from, to: ds[ds.length - 1] || bkToday() } }).then(function (d) { return d; }, function () { return { entries: [], failed: true }; })
    .then(function (d) { if (BK.lt.r === me) BK.lt.day = d; BK.lt.dayP = null; }));
}
/** the opened entry, in place: its journal's Dr / Cr lines (the ledger you are in is bold) and ONE quiet line of the facts no visible column already shows */
function bkLgNext(l, c) {
  var e = bkLgEntry(l), own = !!(BK.lt.sel && BK.lt.sel.party);
  if (!e) return '<div data-testid="stmt-lines-' + l._ix + '" style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('The journal lines of this entry are not on this page.')) + '</div>';
  var shown = []; try { shown = (BK.lt.api && BK.lt.api.state().cols) || []; } catch (_) { shown = []; }
  var def = bkLgKind() === 'control' ? ['date', 'party', 'what'] : ['date', 'what', 'bal'], on = function (k) { return (shown.length ? shown : def).indexOf(k) >= 0; }, s = l.source || {}, facts = [];
  if (!on('entry') && (l.entry_no || l.ref)) facts.push(esc(tx('Entry')) + ' <span class="mono">' + esc(l.entry_no || l.ref) + '</span>');
  if (!on('tender') && s.how) facts.push(esc(tx(s.how)));
  if (!on('counter') && s.counter) facts.push(esc(counterWord(s.counter)));
  if (!on('person') && s.by) facts.push(bkRungPart(s));
  return bkDvNext(e, c, true, own, BK.lt.sel && BK.lt.sel.code) + (facts.length ? '<div class="lg-facts" data-testid="lg-facts-' + l._ix + '">' + facts.map(function (f) { return '<span>' + f + '</span>'; }).join('') + '</div>' : '');
}
/** the tree's three behaviours — click · keyboard · find box · fold · resize — bound ONCE on the pane that holds them */
function bkLtBind(root) {
  root.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-tn]'), a = ev.target.closest('[data-lt]');
    if (t && root.contains(t)) {
      var id = t.getAttribute('data-tn'), k = id.charAt(0), v = id.slice(2), exp = t.getAttribute('aria-expanded');
      if (k === 'B' || k === 'G') { bkLtSet(id, !bkLtOpenNow(id, true)); bkLtTreePaint(id); return; }
      if (k === 'L') {
        if (exp != null && ev.target.closest('.tw')) { bkLtSet(id, exp !== 'true'); bkLtTreePaint(id); return; }
        if (BK_CTRL[v]) bkLtPickCtrl(v); else bkLtPick(v);
        bkLtFocus(id); return;
      }
      if (k === 'P') { bkLtPickParty(v, t.getAttribute('data-ctrl')); bkLtFocus(id); return; }
    }
    if (!a) return;
    var d = a.getAttribute('data-lt');
    if (d === 'clear') { BK.lt.tq = ''; var q = document.getElementById('lt_q'); if (q) { q.value = ''; q.focus(); } bkLtTreePaint(); return; }
    if (d === 'fold') { if (bkLtOverlay()) BK.lt.over = false; else { BK.lt.folded = true; bkLtPrefsSave(); } bkLtFoldPaint(); var u = document.querySelector('[data-lt="unfold"]'); if (u) u.focus(); return; }
    if (d === 'unfold') { if (bkLtOverlay()) BK.lt.over = true; else { BK.lt.folded = false; bkLtPrefsSave(); } bkLtFoldPaint(); var q2 = document.getElementById('lt_q'); if (q2) q2.focus(); return; }
    if (d === 'back') { bkLtBack(); return; }
    if (d === 'statement') { bkLgStatement(); return; }
    if (d === 'pay') { var sp = BK.lt.sel && BK.lt.sel.party; if (sp) payOpen(bkPartyKind(sp, BK.lt.sel.code), sp); return; }
  });
  root.addEventListener('input', function (ev) { if (ev.target.id === 'lt_q') { BK.lt.tq = ev.target.value; bkLtTreePaint(); } });
  root.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if (t.id === 'lt_q') {
      if (ev.key === 'Escape' && BK.lt.tq) { ev.preventDefault(); BK.lt.tq = ''; t.value = ''; bkLtTreePaint(); return; }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); var f = document.querySelector('#lt_tree .tn'); if (f) bkLtFocus(f.getAttribute('data-tn')); return; }
    }
    if (t.getAttribute && t.getAttribute('data-tn')) {                       /* ↑ ↓ move · → open / step in · ← close / step out · Enter opens · Home / End jump */
      var all = Array.prototype.slice.call(document.querySelectorAll('#lt_tree .tn')), i = all.indexOf(t), exp = t.getAttribute('aria-expanded'), lvl = +t.getAttribute('aria-level'), id = t.getAttribute('data-tn');
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); var nx = all[i + (ev.key === 'ArrowDown' ? 1 : -1)]; if (nx) bkLtFocus(nx.getAttribute('data-tn')); return; }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); if (exp === 'false') { bkLtSet(id, true); bkLtTreePaint(id); } else if (exp === 'true' && all[i + 1]) bkLtFocus(all[i + 1].getAttribute('data-tn')); return; }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); if (exp === 'true') { bkLtSet(id, false); bkLtTreePaint(id); } else { for (var j = i - 1; j >= 0; j--) { if (+all[j].getAttribute('aria-level') < lvl) { bkLtFocus(all[j].getAttribute('data-tn')); break; } } } return; }
      if (ev.key === 'Home') { ev.preventDefault(); bkLtFocus(all[0].getAttribute('data-tn')); return; }
      if (ev.key === 'End') { ev.preventDefault(); bkLtFocus(all[all.length - 1].getAttribute('data-tn')); return; }
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); t.click(); return; }
    }
    if (ev.key === 'Escape' && BK.lt.over) { BK.lt.over = false; bkLtFoldPaint(); var u = document.querySelector('[data-lt="unfold"]'); if (u) u.focus(); return; }
    if (t.id === 'lt_rz' && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) { ev.preventDefault(); bkLtWidth(BK.lt.w + (ev.key === 'ArrowRight' ? 16 : -16)); }
  });
  var rz = root.querySelector('#lt_rz'), drag = null;
  if (rz) {
    rz.addEventListener('pointerdown', function (ev) { ev.preventDefault(); drag = { x: ev.clientX, w: BK.lt.w }; rz.classList.add('drag'); try { rz.setPointerCapture(ev.pointerId); } catch (_) {} });
    rz.addEventListener('pointermove', function (ev) { if (drag) bkLtWidth(drag.w + (ev.clientX - drag.x), true); });
    var end = function () { if (!drag) return; drag = null; rz.classList.remove('drag'); bkLtPrefsSave(); };
    rz.addEventListener('pointerup', end); rz.addEventListener('pointercancel', end);
  }
}
function bkLtWidth(w, quiet) {
  BK.lt.w = Math.max(240, Math.min(520, Math.round(w)));
  var el = document.getElementById('bk_lt'); if (el) el.style.setProperty('--lt-w', BK.lt.w + 'px');
  var rz = document.getElementById('lt_rz'); if (rz) rz.setAttribute('aria-valuenow', String(BK.lt.w));
  if (!quiet) bkLtPrefsSave();
}
function bkLtFoldPaint() {
  var el = document.getElementById('bk_lt'); if (!el) return;
  el.classList.toggle('folded', bkLtFolded() && !!BK.lt.sel);
  if (BK.lt.api) BK.lt.api.refresh();   /* the title row's ☰ Ledgers appears / goes with the fold */
}
/** Statement, from a party's ledger (designer extra #5): the API has no "send the statement" route yet, so this opens the party's own statement view — CB CRM's party record, whose Ledger section already carries it */
function bkLgStatement() {
  var s = BK.lt.sel; if (!s || !s.party) return;
  var d = BK.dues && BK.dues[s.party], key = (d && d.party_no) || s.party;
  try { window.open('/crm.html#/party/' + encodeURIComponent(key), '_blank', 'noopener'); } catch (_) {}
}
/** the filters' options are the values the rows really carry — read when the ledger arrives, never a list the page invents */
function bkLgFilters() {
  var kind = bkLgKind(), parties = kind === 'control' && BK.lt.sel ? bkLtParties(BK.lt.sel.code) : [], fl = [];
  var seen = function (f) { var s = []; ((BK.lt.r && BK.lt.r.lines) || []).forEach(function (l) { var v = f(l); if (v && s.indexOf(v) < 0) s.push(v); }); return s.sort(); };
  if (kind === 'control') fl.push({ key: 'party', label: tx('Party'), all: tx('Party'), match: function (l, v) { return v === BK_NO_PARTY ? (!l.party_id && !l.party_name) : bkPartyLabel(l.party_id, l.party_name) === v; },
    options: parties.map(function (p) { return bkPartyLabel(p.party_id, p.name); }).concat([BK_NO_PARTY]).map(function (v) { return { v: v, label: v === BK_NO_PARTY ? tx(BK_NO_PARTY) : v }; }) });
  fl.push({ key: 'tender', label: tx('Tender'), all: tx('Tender'), match: function (l, v) { return (l.source || {}).how === v; }, options: seen(function (l) { return (l.source || {}).how; }).map(function (v) { return { v: v, label: tx(v) }; }) },
    { key: 'counter', label: tx('Counter'), all: tx('Counter'), match: function (l, v) { return (l.source || {}).counter === v; }, options: seen(function (l) { return (l.source || {}).counter; }).map(function (v) { return { v: v, label: tx('Counter') + ' ' + v }; }) },
    { key: 'person', label: tx('Rung by'), all: tx('Rung by'), match: function (l, v) { return (l.source || {}).by === v; }, options: seen(function (l) { return (l.source || {}).by; }).map(function (v) { return { v: v, label: v }; }) });
  return fl;
}
/** the last ledger this person had open comes back (on a wide page; a phone opens on the tree) — only if it is still on the chart */
function bkLtRestore() {
  var l = BK.lt.last; if (!l || BK.lt.sel || bkLtNarrow()) return;
  if (!bkLtAcct(l.code)) return;
  if (l.party && !(BK.dues && BK.dues[l.party])) return;
  BK.lt.open['B:' + bkLtBand(l.code)] = true;
  var a = bkLtAcct(l.code), band = (BK.lt.model || []).filter(function (b) { return b.id === bkLtBand(l.code); })[0];
  if (band && !BK_CTRL[l.code]) band.groups.forEach(function (g, gi) { if (g.accts.indexOf(a) >= 0) BK.lt.open['G:' + band.id + '/' + gi] = true; });
  if (l.party) { BK.lt.open['L:' + l.code] = true; bkLtOpen({ code: l.code, party: l.party }); } else bkLtOpen({ code: l.code });
}
async function bkLedgers(body) {
  try {
    var rr = await Promise.all([api('booksAccounts'), bkBalances().catch(function () { return null; }), booksDuesLoad(true)]);
    bkLtPrefsRead();
    BK.lt.model = bkLtModel((rr[0] && rr[0].accounts) || []); BK.lt.bal = rr[1]; BK.lt.api = null;
    body.innerHTML = '<div id="bk_lt" class="lt' + (BK.lt.sel ? ' has-sel' : '') + '" data-testid="bk-lt" style="--lt-w:' + BK.lt.w + 'px">'
      + '<nav class="lt-tree" aria-label="' + esc(tx('All ledgers')) + '"><div class="lt-tools" data-testid="lt-search"><div class="lt-search"><span aria-hidden="true">🔍</span><input id="lt_q" data-testid="lt-find" type="search" autocomplete="off" placeholder="' + esc(tx('Find a ledger or party')) + '" aria-label="' + esc(tx('Find a ledger or party')) + '" value="' + esc(BK.lt.tq || '') + '"></div>'
      + '<button type="button" class="lt-btn lt-ico" data-lt="fold" data-testid="lt-fold" title="' + esc(tx('Hide this list')) + '" aria-label="' + esc(tx('Hide the ledger list')) + '">⟨</button></div>'
      + '<div id="lt_tree" class="lt-list" data-testid="lt-tree" role="tree" aria-label="' + esc(tx('Ledgers by band')) + '"></div></nav>'
      + '<button type="button" class="lt-rz" id="lt_rz" role="separator" aria-orientation="vertical" aria-valuemin="240" aria-valuemax="520" aria-valuenow="' + BK.lt.w + '" aria-label="' + esc(tx('Resize the ledger list (arrow keys)')) + '" title="' + esc(tx('Drag to resize')) + '"></button>'
      + '<main class="lt-pane" id="lt_pane">' + bkLtPaneHTML() + '</main></div>';
    var root = document.getElementById('bk_lt');
    bkLtBind(root); bkLtTreePaint();
    if (typeof ResizeObserver !== 'undefined') { var last = bkLtNarrow(); try { new ResizeObserver(function () { var n = bkLtNarrow(); if (n !== last) { last = n; bkLtTreePaint(); if (BK.lt.api) BK.lt.api.refresh(); } }).observe(root); } catch (_) {} }
    var s0 = BK.lt.sel; BK.lt.sel = null;
    if (s0 && !bkLtNarrow()) bkLtOpen(s0.party ? { code: s0.code, party: s0.party } : { code: s0.code }); else if (!s0) bkLtRestore();
    if (typeof CBKural !== 'undefined' && !BK.lt.sel) CBKural.set('accounts');
  } catch (e) { body.innerHTML = bkErr(e); }
}
async function bkTB(body) {
  var asOf = (document.getElementById('tb_asof') || {}).value || bkToday();
  try {
    var r = await api('booksTB', { query: { asOf: asOf } }); var c = r && r.currency;
    var rows = ((r && r.rows) || []).map(function (x) { return '<tr><td class="mono">' + esc(x.code) + '</td><td>' + esc(x.name) + '</td><td class="num">' + (x.dr_minor ? esc(bkMoney(x.dr_minor, c)) : '') + '</td><td class="num">' + (x.cr_minor ? esc(bkMoney(x.cr_minor, c)) : '') + '</td></tr>'; }).join('');
    var ok = Number(r.total_dr_minor) === Number(r.total_cr_minor);
    body.innerHTML = '<div class="supacts" style="display:flex;gap:6px;align-items:center;margin-bottom:9px"><input type="date" class="inp" id="tb_asof" value="' + asOf + '"><button onclick="bkTab(\'tb\')">' + tx('Show') + '</button>'
      + '<span class="optchip" data-testid="tb-balanced" style="margin-inline-start:auto;' + (ok ? 'color:var(--ok-2);border-color:var(--ok-2)' : 'color:var(--warn-2);border-color:var(--warn-2)') + '">' + (ok ? tx('✓ balances') : tx('⚠ does not balance')) + '</span></div>'
      + bkTable([{ t: tx('Code') }, { t: tx('Ledger') }, { t: tx('Debit'), num: 1 }, { t: tx('Credit'), num: 1 }], rows,
          '<tr><td></td><td><b>' + tx('Total') + '</b></td><td class="num" data-testid="tb-dr"><b>' + esc(bkMoney(r.total_dr_minor, c)) + '</b></td><td class="num" data-testid="tb-cr"><b>' + esc(bkMoney(r.total_cr_minor, c)) + '</b></td></tr>');
  } catch (e) { body.innerHTML = bkErr(e); }
}
function bkSideHTML(title, rows, c, total) {
  return '<div class="sec">' + title + '</div>' + bkTable([{ t: tx('Ledger') }, { t: tx('Amount'), num: 1 }],
    (rows || []).map(function (x) { return '<tr><td>' + esc(x.code ? x.code + ' · ' : '') + esc(x.name) + '</td><td class="num">' + esc(bkMoney(x.amount_minor, c)) + '</td></tr>'; }).join(''),
    total != null ? '<tr><td><b>' + tx('Total') + '</b></td><td class="num"><b>' + esc(bkMoney(total, c)) + '</b></td></tr>' : '');
}
async function bkPL(body) {
  var q = bkRange('pl');
  try {
    var r = await api('booksPL', { query: q }); var c = r && r.currency;
    body.innerHTML = bkRangeHTML('pl', "bkTab('pl')") + bkSideHTML(tx('Income'), r.income, c) + bkSideHTML(tx('Expenses'), r.expense, c)
      + '<div style="padding:9px 0;font-size:var(--fs-3)" data-testid="pl-profit"><b>' + (Number(r.profit_minor) >= 0 ? tx('Profit') : tx('Loss')) + ' ' + esc(bkMoney(Math.abs(r.profit_minor || 0), c)) + '</b></div>';
  } catch (e) { body.innerHTML = bkErr(e); }
}
async function bkBS(body) {
  var asOf = (document.getElementById('bs_asof') || {}).value || bkToday();
  try {
    var r = await api('booksBS', { query: { asOf: asOf } }); var c = r && r.currency;
    var ok = Number(r.total_assets_minor) === Number(r.total_liab_equity_minor);
    body.innerHTML = '<div class="supacts" style="display:flex;gap:6px;align-items:center;margin-bottom:9px"><input type="date" class="inp" id="bs_asof" value="' + asOf + '"><button onclick="bkTab(\'bs\')">' + tx('Show') + '</button>'
      + '<span class="optchip" data-testid="bs-balanced" style="margin-inline-start:auto;' + (ok ? 'color:var(--ok-2)' : 'color:var(--warn-2)') + '">' + (ok ? tx('✓ balances') : tx('⚠ does not balance')) + '</span></div>'
      + bkSideHTML(tx('Assets'), r.assets, c, r.total_assets_minor) + bkSideHTML(tx('Liabilities'), r.liabilities, c) + bkSideHTML(tx('Owner'), r.equity, c, r.total_liab_equity_minor);
  } catch (e) { body.innerHTML = bkErr(e); }
}
/** ⭐ Schedule III: not due, then less than 6 months, 6–12 months, 1–2 years, 2–3 years, more than 3 years — disputed apart */
var BK_BUCKETS = [['not_due', 'Not due'], ['lt_6m', '< 6 months'], ['m6_1y', '6–12 months'], ['y1_2', '1–2 years'], ['y2_3', '2–3 years'], ['gt_3y', '> 3 years']];
/** ⚠️ what the shop OWES is aged differently (Schedule III, payables): not due · under a year · 1–2 · 2–3 · over 3 years */
var BK_BUCKETS_PAY = [['not_due', 'Not due'], ['lt_1y', '< 1 year'], ['y1_2', '1–2 years'], ['y2_3', '2–3 years'], ['gt_3y', '> 3 years']];
/**
 * ⚠️⚠️ THE SERVER'S BUCKETS DECIDE THE COLUMNS (2026-09-30, review F11). One table with the six receivable columns
 * showed a supplier's `lt_1y` amount nowhere but under Balance. So: two tables — what customers owe you, what you owe
 * suppliers — each with the columns of its own side, and any bucket the server sends that has no column here lands in
 * "Other" rather than vanishing (a named list of columns must never be a silent filter).
 */
/** a supplier the shop has paid ahead (Dr balance: paid with no bill) is an advance — they owe you; the balance sheet reclassifies it the same way (1700). It is never under To pay. */
function bkDuesAdvance(p) { return bkDuesSide(p) === 'pay' && Number(p.balance_minor) > 0; }
function bkDuesSide(p) {
  if (p.side === 'supplier') return 'pay';
  if (p.side === 'customer') return 'rcv';
  var b = p.buckets || {};
  if (p.side !== 'both' && ('lt_1y' in b) && !('lt_6m' in b) && !('m6_1y' in b)) return 'pay';
  return Number(p.balance_minor) < 0 ? 'pay' : 'rcv';
}
/** the bills a party's statement holds — read once, on the first time its row opens (the party's own statement route) */
async function bkStmtRead(pid, list) {
  if (BK.stmt[pid] || (BK.stmtBusy || {})[pid]) return;
  BK.stmtBusy = BK.stmtBusy || {}; BK.stmtBusy[pid] = true;
  try { BK.stmt[pid] = await api('booksStatement', { params: { id: pid } }); } catch (_) { BK.stmt[pid] = { lines: [], failed: true }; }
  delete BK.stmtBusy[pid]; var lst = CBList.get(list); if (lst) lst.refresh();
}
function bkDuesCols(c) {
  var dash = '<span style="color:var(--grey)">—</span>', amt = function (p, v) { return esc(bkMoney(Math.abs(Number(v || 0)), c)); };   /* the group head says whose it is (You owe / They owe you) — an amount here is never signed */
  return [
    { key: 'party', label: tx('Party'), prio: 1, sort: 'party', w: 230, html: true, cell: function (p) { return esc(bkPartyLabel(p.party_id, p.name)); } },
    { key: 'due', label: tx('Total due'), prio: 2, sort: 'due', num: true, w: 130, html: true, cell: function (p) { return '<b data-b="balance">' + amt(p, p.balance_minor) + '</b>' + (bkDuesAdvance(p) ? ' <span data-b="advance" style="color:var(--grey)">· ' + esc(tx('advance paid — they owe you')) + '</span>' : ''); } },
    { key: 'oldest', label: tx('Oldest due'), prio: 3, sort: 'oldest', w: 220, html: true, cell: function (p) { var ag = bkDuesAge(p); return p.oldest_due ? '<span data-b="due">' + esc(bkDate(p.oldest_due)) + '</span>' + (ag ? ' <span data-b="age" style="color:var(--grey)">· ' + esc(tx(ag)) + '</span>' : '') : dash; } },
    { key: 'act', label: ' ', prio: 1, pin: 'end', w: 170, html: true, cell: function (p) { return bkDuesActs(p); } },
  ];
}
/** the oldest age bucket the party has money in — the server's own buckets (Schedule III), in the words of BK_BUCKETS */
function bkDuesAge(p) {
  var cols = bkDuesSide(p) === 'pay' ? BK_BUCKETS_PAY : BK_BUCKETS, b = p.buckets || {}, w = '';
  cols.forEach(function (k) { if (Number(b[k[0]])) w = k[1]; });
  return w;
}
/** the buttons on a Dues row: Receive (or Pay) opens the ONE unit — an ADVANCE row says what it does: "Get back" (paid ahead to a supplier) or "Adjust" (a customer's advance), never "Pay" (M167); Remind (only on what is owed to you) messages the oldest open bill */
function bkDuesActs(p) {
  var kind = bkPartyKind(p.party_id), id = esc(p.party_id), rcv = kind === 'customer';
  return '<span style="display:inline-flex;gap:6px" onclick="event.stopPropagation()">'
    + '<button type="button" class="cbl-tbtn" data-testid="dues-pay-' + id + '" onclick="event.stopPropagation();payOpen(\'' + kind + '\',\'' + id + '\')">' + esc(tx(bkDuesAdvance(p) ? 'Get back' : (rcv && Number(p.balance_minor) < 0 ? 'Adjust' : (rcv ? 'Receive' : 'Pay')))) + '</button>'
    + (rcv ? '<button type="button" class="cbl-tbtn" data-testid="dues-remind-' + id + '" onclick="event.stopPropagation();bkRemind(\'' + id + '\',this)">' + esc(tx('Remind')) + '</button>' : '') + '</span>';
}
/** 'customer' (you receive) or 'supplier' (you pay): the party's side from the one /dues read, else the control account that is open */
function bkPartyKind(pid, ctrl) {
  var d = BK.dues && BK.dues[pid], side = d ? bkDuesSide(d) : ((BK_CTRL[ctrl] || {}).side || 'rcv');
  return side === 'pay' ? 'supplier' : 'customer';
}
/**
 * ⭐ REMIND (M28) — a MESSAGE on the oldest open bill's line, through CBThread (R02). Never a new chit kind, never a new route: the oldest open bill is
 * the engine's own (/payments/preview lists the party's open bills oldest-due first — the list the Pay unit shows), its line is the first live line of
 * that chit, and the words are the shopkeeper's to edit before they send. The send, the busy state and the outcome are CBThread's.
 */
async function bkRemindTarget(pid) {
  var r = await api('booksPayPreview', { body: { party_id: pid, direction: 'in', amount_minor: 1, currency: bkCur(), allocate: 'oldest_first' } });
  var bill = ((r && r.proposal) || []).filter(function (b) { return Number(b.open_minor) > 0 && !b.disputed; })[0];
  if (!bill) throw new Error('nothing open');
  var line = null, acts = null;
  try {
    var ch = await api('chit', { params: { id: bill.against_ref } }); acts = ch && ch.actions;
    var ls = ((ch && ch.live_set) || []).filter(function (e) { return e && !e.removed && e.line_id; });
    line = ls.length ? ls[0].line_id : null;
  } catch (_) {}
  return { chit_id: bill.against_ref, line_id: line, actions: acts, bill: bill, currency: r.currency, party: (r.party && r.party.name) || '' };
}
function bkRemind(pid, btn) {
  if (typeof CBThread === 'undefined' || !CBThread) { toast(tx('Could not open the reminder')); return; }
  return CBAction.run(btn || null, function () { return bkRemindTarget(pid); }, { key: 'remind:' + pid, failed: tx('No open bill to remind about'), outcome: bkRemindOpen });
}
function bkRemindOpen(t) {
  var name = t.party || '';
  var text = txf('Hello {name}, a reminder: bill {no} for {amt} was due on {date}. Please pay when you can.', { name: name, no: t.bill.bill_no || '', amt: bkMoney(t.bill.open_minor, t.currency), date: bkDate(t.bill.due_date) });
  modal('<div class="mhd"><div class="t" data-testid="remind_title">' + esc(tx('Remind')) + ' · ' + esc(name) + '</div></div><div class="mbody">'
    + '<div data-testid="remind_for" style="font-size:var(--fs-1);margin-bottom:8px">' + esc((t.bill.bill_no || '') + ' · ' + bkMoney(t.bill.open_minor, t.currency) + ' · ' + bkDate(t.bill.due_date)) + '</div>'
    + '<div id="remind_thread" data-testid="remind_thread"></div></div><div class="mfoot"><button onclick="closeModal()">' + tx('Close') + '</button></div>');
  CBThread.mount('remind_thread', { chit_id: t.chit_id, line_id: t.line_id || undefined, actions: t.actions || undefined, text: text, party: name, channel: 'external', thread_type: 'external', context: { host: 'dues', source: 'remind' } });
}
/**
 * the bills on a party's statement, as a next level's rows — read once, on the first time its row opens (the party's own
 * statement route). `list` is the table that asked (it paints again when the read lands); a bill's amount is the line's own.
 * Shared by Dues and the CRM's Customers and Suppliers (app.html), so a party's bills read the same wherever its row opens.
 */
function bkPartyBillsHTML(pid, list, c) {
  var st = BK.stmt[pid], amt = function (v) { return esc(bkMoney(Number(v), c)); };
  if (!st) { bkStmtRead(pid, list); return '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('Reading the bills…')) + '</div>'; }
  /* a bill is a line that points at a chit and is not a receipt or a payment */
  var chitOf = function (l) { return l.source_chit_id || (l.source && l.source.chit_id); };
  var ls = (st.lines || []).filter(function (l) { return chitOf(l) && !(l.source && /receipt|payment/.test(String(l.source.kind))); });
  return ls.length ? ls.map(function (l, i) { return CBList.nextRow([esc(bkDate(l.date)) + ' ' + bkBillPart(l.source || { ref: l.ref, chit_id: chitOf(l) }, 'bills-' + pid + '-' + i), amt(l.dr_minor || l.cr_minor || 0)], [120]); }).join('')
    : '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('No bills on the statement')) + '</div>';
}
/** its next level: the age buckets (the server's, Schedule III) and the bills on the party's statement */
function bkDuesNext(p, c) {
  var side = bkDuesSide(p), cols = side === 'pay' ? BK_BUCKETS_PAY : BK_BUCKETS, known = cols.map(function (k) { return k[0]; }), b = p.buckets || {};
  var amt = function (v) { return esc(bkMoney(side === 'pay' ? -Number(v) : Number(v), c)); };
  var other = Object.keys(b).filter(function (k) { return known.indexOf(k) < 0; }).reduce(function (s, k) { return s + Number(b[k] || 0); }, 0);
  var rows = cols.filter(function (k) { return b[k[0]]; }).map(function (k) { return CBList.nextRow(['<span data-b="' + k[0] + '">' + esc(tx(k[1])) + '</span>', amt(b[k[0]])], [120]); }).join('')
    + (other ? CBList.nextRow(['<span data-b="other">' + esc(tx('Other')) + '</span>', amt(other)], [120]) : '')
    + (p.disputed_minor ? CBList.nextRow(['<span data-b="disputed">' + esc(tx('Disputed')) + '</span>', amt(p.disputed_minor)], [120]) : '');
  return '<div data-testid="dues-next-' + esc(p.party_id) + '">' + '<div style="color:var(--grey);font-size:var(--fs-1);text-transform:uppercase;padding:2px 0">' + esc(tx('Age')) + '</div>' + (rows || '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('Nothing is overdue')) + '</div>')
    + '<div style="color:var(--grey);font-size:var(--fs-1);text-transform:uppercase;padding:6px 0 2px">' + esc(tx('Bills')) + '</div>' + bkPartyBillsHTML(p.party_id, 'dues', c) + '</div>';
}
async function bkDues(body, onlySide) {   /* onlySide 'rcv' | 'pay' (CB Accounts: Receivables / Payables) opens the same list on that side */
  try {
    var r = await api('booksDues', { query: { asOf: bkToday() } }); var c = r && r.currency; bkDuesStore(r);
    var open = ((r && r.parties) || []).filter(function (p) { return Number(p.balance_minor); });
    /* the page's own side is the page, not a filter the person set: Receivables also holds the advances paid; Payables holds no one who owes you */
    if (onlySide) open = open.filter(function (p) { return onlySide === 'rcv' ? (bkDuesSide(p) === 'rcv' || bkDuesAdvance(p)) : (bkDuesSide(p) === 'pay' && !bkDuesAdvance(p)); });
    var num = function (g) { return function (a, b) { return Number(g(a)) - Number(g(b)); }; };
    body.innerHTML = '<div id="bkl_dues" data-testid="dues-list"></div>';
    CBList.mount(document.getElementById('bkl_dues'), {
      key: 'dues', t: tx, rows: function () { return open; }, id: function (p) { return p.party_id; }, columns: bkDuesCols(c),
      rowTid: function (p) { return 'dues-' + p.party_id; },
      /* They owe you / You owe: one head each, the customers first */
      group: { default: 'side', order: ['rcv', 'adv', 'pay'], by: function (p) { if (bkDuesAdvance(p)) return [tx('Advance paid'), 'adv']; var s = bkDuesSide(p); return [tx(s === 'rcv' ? 'To collect' : 'To pay'), s]; },
        fig: function (rows) { return txn('{count} party', '{count} parties', rows.length) + ' · ' + bkOwes(rows.reduce(function (t, p) { return t + Number(p.balance_minor || 0); }, 0), c); }, headTid: function (k) { return 'dues-side-' + k; } },
      search: function (p) { return [p.party_no, p.name, bkPartyLabel(p.party_id, p.name), p.balance_minor ? (Math.abs(p.balance_minor) / Math.pow(10, bkDec(c))).toFixed(bkDec(c)) : ''].join(' '); },
      sorts: [
        { key: 'party', label: tx('Party no'), cmp: function (a, b) { return String(a.party_no || '').localeCompare(String(b.party_no || ''), undefined, { numeric: true }); } },
        { key: 'name', label: tx('Name'), cmp: function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); } },
        { key: 'due', label: tx('Total due'), cmp: num(function (p) { return Math.abs(p.balance_minor || 0); }) },
        { key: 'oldest', label: tx('Oldest due'), cmp: function (a, b) { return String(a.oldest_due || '9999').localeCompare(String(b.oldest_due || '9999')); } },
      ],
      filters: onlySide ? [] : [{ key: 'side', label: tx('Side'), all: tx('Both sides'), options: [{ v: 'rcv', label: tx('To collect') }, { v: 'pay', label: tx('To pay') }], match: function (p, v) { return v === 'pay' ? bkDuesSide(p) === 'pay' && !bkDuesAdvance(p) : bkDuesSide(p) === 'rcv' || bkDuesAdvance(p); } }],
      next: function (p) { return bkDuesNext(p, c); },
      empty: { title: tx(onlySide === 'rcv' ? 'Nobody owes you money' : onlySide === 'pay' ? 'You owe nobody' : 'Nothing is due') },
    });
  } catch (e) { body.innerHTML = bkErr(e); }
}
function bkFyNow() { var d = new Date(); var y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return y + '-' + String((y + 1) % 100).padStart(2, '0'); }
var BK_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
/** the period's status is a server enum — it becomes a word here, never shown raw */
var BK_PERIOD_WORD = { open: 'Open', soft_locked: 'Locked', hard_locked: 'Closed for good' };
function bkIsOwner() { return typeof SESSION !== 'undefined' && !!SESSION && SESSION.role === 'entity'; }   /* the server enforces it; this only decides who is offered the buttons */
var BK_PERIOD_SYM = { open: '○', soft_locked: '🔒', hard_locked: '⛔' };
/**
 * ⭐ ONE READ of the twelve months: GET /api/books/periods (no fy) answers every month of every year the data holds, with its
 * status. BK.lk = { rows: { 'fy|p': status }, years: [newest first], fy: the year on screen }. A month with no row is open (the
 * server makes a year's months the first time an entry lands in it). Month lock and Packs both read it; the year they show is one.
 */
async function bkPeriodsLoad() {
  var r = await api('booksPeriods'), rows = {}, info = {}, yrs = {};
  ((r && r.periods) || []).forEach(function (x) { var p = Number(x.period); if (p >= 1 && p <= 12) { rows[x.fiscal_year + '|' + p] = x.status; info[x.fiscal_year + '|' + p] = x; yrs[x.fiscal_year] = 1; } });
  yrs[bkFyNow()] = 1;
  var L = BK.lk = BK.lk || {}; L.rows = rows; L.info = info; L.years = Object.keys(yrs).sort().reverse();
  if (!L.fy || !yrs[L.fy]) L.fy = bkFyNow();
  return L;
}
function bkFyPicker(id, tid, sty) {
  return '<select class="inp" id="' + id + '" data-testid="' + tid + '" onchange="bkFyPick(this.value)" style="' + (sty || 'flex:1 1 110px;min-width:0') + '">'
    + BK.lk.years.map(function (y) { return '<option value="' + esc(y) + '"' + (y === BK.lk.fy ? ' selected' : '') + '>' + esc(y) + '</option>'; }).join('') + '</select>';
}
function bkFyPick(v) { BK.lk.fy = v; if (BK.tab === 'lock') bkLockRowsPaint(); else bkPackCtlPaint(); }
async function bkLockView(body) {
  try { await bkPeriodsLoad(); } catch (e) { body.innerHTML = bkErr(e); return; }
  var own = bkIsOwner();
  body.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;max-width:420px">'
    + '<label>' + tx('Financial year') + bkFyPicker('lk_fy', 'lk_fy', 'width:100%') + '</label>'
    + '<div id="lk_rows" data-testid="lk_rows"></div>'
    + '<div id="lk_foot" data-testid="lk_note" style="color:var(--grey);font-size:var(--fs-1)"></div>'
    + '<div id="lk_out" data-testid="lk_out" style="font-size:var(--fs-1)"></div></div>';
  bkLockRowsPaint();
}
/**
 * the twelve months, April to March: state as a word and a symbol, its entries and sales, and the actions the SERVER says it may do (owner only).
 * M157: ONE rule, read from GET /periods - Lock for a finished month, oldest first (else greyed with the server's sentence); the Reason box and the foot
 * follow reopen.may, so the page never promises what the server will refuse.
 */
function bkLockRowsPaint() {
  var el = document.getElementById('lk_rows'), L = BK.lk, own = bkIsOwner(); if (!el) return;
  var reopens = BK_MONTHS.some(function (m, i) { var q = (L.info || {})[L.fy + '|' + (i + 1)]; return q && q.reopen && q.reopen.may; });
  var foot = document.getElementById('lk_foot'), whyBox = document.getElementById('lk_whybox');
  if (own && reopens && !whyBox && foot) foot.insertAdjacentHTML('beforebegin', '<label id="lk_whybox">' + tx('Reason') + '<input class="inp" id="lk_why" data-testid="lk_why" placeholder="' + esc(tx('Needed to open a month again')) + '"></label>');
  if (own && !reopens && whyBox) whyBox.remove();
  if (foot) foot.textContent = !own ? '' : reopens ? tx('A locked month opens again with a reason. Close for good never opens.') : tx('Close for good: the month never opens again. Corrections go into an open month as an adjusting entry.');
  el.innerHTML = BK_MONTHS.map(function (m, i) {
    var p = i + 1, st = L.rows[L.fy + '|' + p] || 'open', b = '', x = (L.info || {})[L.fy + '|' + p] || null;
    var may = !x || !x.lock || x.lock.may, why = x && x.lock && x.lock.why ? x.lock.why : '';
    if (own && st === 'open') b = '<button class="supact-pri" data-testid="lk-lock-' + p + '"' + (may ? ' onclick="bkLockDo(\'lock\',' + p + ')" title="' + esc(tx('Stops entries · reopens with a reason')) + '"' : ' disabled title="' + esc(tx(why)) + '"') + '>🔒 ' + tx('Lock') + '</button>'
      + (!may && why ? '<span data-testid="lk-why-' + p + '" style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx(why)) + '</span>' : '');
    if (own && st === 'soft_locked') b = '<button data-testid="lk-unlock-' + p + '" onclick="bkLockDo(\'unlock\',' + p + ')">🔓 ' + tx('Open again') + '</button>'
      + '<button data-testid="lk-hard-' + p + '" onclick="bkLockDo(\'hard\',' + p + ')">⛔ ' + tx('Close for good') + '</button>';
    return '<div data-testid="lk-row-' + p + '" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:6px 0;border-bottom:1px solid var(--line)">'
      + '<b style="flex:1 1 52px">' + tx(m) + '</b>'
      + '<span data-testid="lk-state-' + p + '" data-state="' + esc(st) + '">' + (BK_PERIOD_SYM[st] || '') + ' ' + esc(tx(BK_PERIOD_WORD[st] || st)) + '</span>'
      + (x && (x.entries || x.sales_minor) ? '<span data-testid="lk-figs-' + p + '" style="color:var(--grey);font-size:var(--fs-1)">' + txf('{n} entries', { n: x.entries }) + (x.sales_minor ? ' · ' + bkMoney(x.sales_minor) + ' ' + tx('sales') : '') + '</span>' : '')
      + (b ? '<span class="supacts" style="display:flex;gap:6px;flex-wrap:wrap;margin:0">' + b + '</span>' : '') + '</div>';
  }).join('');
}
async function bkLockDo(what, p) {
  var L = BK.lk, fy = L.fy, why = (document.getElementById('lk_why') || {}).value || '', out = document.getElementById('lk_out');
  var m = tx(BK_MONTHS[p - 1] || String(p));
  if (what === 'unlock' && !why.trim()) { if (out) out.textContent = tx('Say why — the reason is kept'); var w = document.getElementById('lk_why'); if (w) w.focus(); return; }
  /* ⭐ M64: through CBAction — ONE write per month at a time (whichever of its buttons), Close for good asks first in the
     page's own dialog (Cancel sends nothing), and the outcome is said in lk_out beside the months */
  var btn = document.querySelector('[data-testid="lk-' + what + '-' + p + '"]');
  return CBAction.run(btn, function () {
    return api(what === 'unlock' ? 'booksUnlock' : 'booksLock', { params: { fy: fy, p: p }, body: { reason: why, hard: what === 'hard' } });
  }, {
    key: 'lk-' + fy + '-' + p, out: 'lk_out', failed: tx('Could not change it'),
    confirm: what === 'hard' ? { title: tx('Close for good?'), body: esc(txf('{m} {fy} will never open again.', { m: m, fy: fy })), yes: tx('Close for good') } : null,
    outcome: function (r) {
      var st = r && r.period && r.period.status;
      if (st) L.rows[fy + '|' + p] = st;   /* flip the ROW, never the whole list */
      if (L.fy === fy) bkLockRowsPaint();
      bkPeriodsLoad().then(function () { if (BK.lk.fy === fy) bkLockRowsPaint(); }).catch(function () {});   /* M157: the server's may/why moves with the lock (the next month opens up, the reason box follows) */
      var o = document.getElementById('lk_out'); if (o) o.textContent = txf('{m} {fy} · {s}', { m: m, fy: fy, s: tx(BK_PERIOD_WORD[st] || 'Done') });
    },
  });
}
/**
 * ⚠️⚠️ A PACK IS ITS FILE (2026-09-30, review M10). Download saved the manifest — a list of names and fingerprints —
 * and "We have it" then told the server the shop holds its ledger files, which is the fact that later allows old
 * detail to be summarised away. So: Download fetches the real zip; "We have it" exists only for a pack that HAS a
 * file, and unless that file came down in this session the owner is asked first; a pack with no file says so and
 * offers neither.
 * ⭐ ONE reader of "has it a file": has_file when the server says it (on the row, or on GET /packs/:id beside `file`),
 * else the older `stored` / `download`. null = the row does not say — GET /packs/:id is asked before anything is offered.
 */
function bkPackHasFile(k, r) {
  var pick = function (o) { return !o ? null : typeof o.has_file === 'boolean' ? o.has_file : typeof o.stored === 'boolean' ? o.stored : null; };
  var v = pick(r); if (v == null && r) v = pick(r.pack);
  if (v == null && r && ('file' in r || 'download' in r)) v = !!(r.file || r.download);
  if (v == null) v = pick(k);
  return v;
}
async function bkPacks(body) {
  try {
    var rr = await Promise.all([api('booksPacks'), bkPeriodsLoad()]), r = rr[0];
    BK.packRows = {}; BK.packGot = BK.packGot || {};
    var rows = ((r && r.packs) || []).map(function (k) {
      BK.packRows[k.pack_id] = k;
      var has = bkPackHasFile(k, null), id = esc(k.pack_id);
      var ack = k.acknowledged_at ? '✓ ' + esc(bkDate(k.acknowledged_at))
        : has === false ? '<span data-testid="pack-nofile-' + id + '" style="color:var(--warn-2)">' + tx('No file · make it again') + '</span>'
        : '<div class="supacts" style="margin:0"><button data-testid="pack-ack-' + id + '" onclick="bkPackAck(\'' + id + '\')">' + tx('We have it') + '</button></div>';
      var get = has === false ? '' : '<div class="supacts" style="margin:0"><button data-testid="pack-get-' + id + '" onclick="bkPackGet(\'' + id + '\')">' + tx('Download') + '</button></div>';
      return '<tr data-testid="pack-' + id + '"><td>' + esc(tx({ month: 'Month', year: 'Year', exit: 'Exit' }[k.kind] || k.kind || '')) + '</td><td>' + esc(k.fiscal_year || '') + (k.period ? ' · ' + esc(k.period) : '') + '</td><td>' + esc(bkDate(k.created_at)) + '</td>'
        + '<td class="mono" title="' + esc(k.sha256 || '') + '">' + esc(String(k.sha256 || '').slice(0, 10)) + '</td>'
        + '<td>' + ack + '</td><td>' + get + '</td></tr>';
    }).join('');
    body.innerHTML = '<div id="pk_ctl" data-testid="pk_ctl"></div>'
      + '<div id="pk_out" data-testid="pk_out" style="font-size:var(--fs-1)"></div>'
      + (rows ? bkTable([{ t: tx('Kind') }, { t: tx('Period') }, { t: tx('Made') }, { t: tx('Fingerprint') }, { t: tx('Handed over') }, { t: '' }], rows) : emptyState('📦', tx('No packs yet'), ''));
    bkPackCtlPaint();
  } catch (e) { body.innerHTML = bkErr(e); }
}
/** the pack controls: the year, then a month that IS locked (a pack is made from a locked month). No locked month → the sentence is the button to Month lock */
function bkPackCtlPaint() {
  var el = document.getElementById('pk_ctl'), L = BK.lk; if (!el) return;
  var locked = BK_MONTHS.map(function (m, i) { return [i + 1, m, L.rows[L.fy + '|' + (i + 1)]]; }).filter(function (x) { return x[2] === 'soft_locked' || x[2] === 'hard_locked'; });
  el.innerHTML = '<div class="supacts" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px">' + bkFyPicker('pk_fy', 'pk_fy')
    + '<select class="inp" id="pk_p" data-testid="pk_p" onchange="bkPackPick()" style="flex:1 1 110px;min-width:0"' + '><option value="">' + esc(tx('Month')) + '</option><option value="year">' + esc(tx('Whole year (Apr–Mar)')) + '</option>'
    + locked.map(function (x) { return '<option value="' + x[0] + '">' + esc(tx(x[1])) + '</option>'; }).join('') + '</select>'
    + '<button class="supact-pri" data-testid="pk_build" id="pk_build" onclick="bkPackBuild()" disabled>' + tx('Make a pack') + '</button></div>'
    + (locked.length ? '' : '<div class="supacts" style="margin-bottom:9px"><button data-testid="pk_lockfirst" onclick="bkTab(\'lock\')">🔒 ' + tx('Lock a month first') + '</button></div>');
}
function bkPackPick() { var b = document.getElementById('pk_build'); if (b) b.disabled = !(document.getElementById('pk_p') || {}).value; }
async function bkPackBuild() {
  var out = document.getElementById('pk_out');
  var fy = (document.getElementById('pk_fy') || {}).value, v = (document.getElementById('pk_p') || {}).value, p = parseInt(v, 10);
  if (!p && v !== 'year') return;   /* the button is off until a month or the whole year is chosen; this is the same fence for a key press */
  try { await api('booksPackBuild', { body: p ? { kind: 'month', fiscal_year: fy, period: p } : { kind: 'year', fiscal_year: fy, period: null } }); bkTab('packs'); }
  catch (e) { if (out) out.textContent = bkWhy(e, tx('Could not make it')); }
}
/** the one sentence for a pack with nothing to download — said, and the row stops offering Download / We have it */
function bkPackNoFile(id) {
  if (BK.packRows && BK.packRows[id]) BK.packRows[id].has_file = false;
  var out = document.getElementById('pk_out');
  if (out) out.innerHTML = '<span data-testid="pack-nofile-said" style="color:var(--warn-2)">' + esc(tx('No file for this pack · make it again')) + '</span>';
  var tr = document.querySelector('[data-testid="pack-' + id + '"]');
  if (tr && !tr.querySelector('[data-testid^="pack-nofile-"]')) {   /* flip the ROW, never the whole list */
    tr.children[4].innerHTML = '<span data-testid="pack-nofile-' + esc(id) + '" style="color:var(--warn-2)">' + tx('No file · make it again') + '</span>';
    tr.children[5].innerHTML = '';
  }
}
/**
 * ⭐ THE PACK ITSELF comes down — the zip at /packs/:id/file, as bytes, with the session (api() speaks JSON only). The
 * manifest is still shown beside it: the file list and fingerprints are what make the zip checkable.
 */
async function bkPackGet(id) {
  var out = document.getElementById('pk_out');
  await bkOnce('packget:' + id, document.querySelector('[data-testid="pack-get-' + id + '"]'), async function () {
    try {
      var r = await api('booksPackGet', { params: { id: id } });
      if (bkPackHasFile(BK.packRows && BK.packRows[id], r) === false) { bkPackNoFile(id); return; }
      var base = (typeof CFG !== 'undefined' && CFG.API_BASE) || '';
      var res = await fetch(base + EP.booksPackFile.p.replace(':id', encodeURIComponent(id)), { cache: 'no-store', headers: SESSION.token ? { Authorization: 'Bearer ' + SESSION.token } : {} });
      if (res.status === 409 || res.status === 404) { bkPackNoFile(id); return; }   /* made while storage was not connected */
      if (!res.ok) throw new Error('');
      var blob = await res.blob();
      if (!blob || !blob.size) { bkPackNoFile(id); return; }
      var cd = ''; try { cd = res.headers.get('Content-Disposition') || ''; } catch (_) {}
      var m = /filename="?([^";]+)"?/.exec(cd);
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (m && m[1]) || ('ledger-pack-' + id + '.zip'); a.setAttribute('data-testid', 'pack-download-link'); document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      BK.packGot = BK.packGot || {}; BK.packGot[id] = true;   /* this session holds the file — "We have it" is now a plain yes */
      var files = (r && r.manifest && r.manifest.files) || [];
      if (out) out.innerHTML = '<div data-testid="pack-manifest"><b>' + esc(tx('Manifest')) + '</b> · ' + files.length + ' ' + tx('files') + '<br>' + files.map(function (f) { return '<span class="mono">' + esc(f.name) + ' · ' + esc(String(f.sha256 || '').slice(0, 12)) + '</span>'; }).join('<br>') + '</div>';
    } catch (e) { if (out) out.textContent = bkWhy(e, tx('Could not download it')); }
  });
}
async function bkPackAck(id) {
  await bkOnce('packack:' + id, document.querySelector('[data-testid="pack-ack-' + id + '"]'), async function () {
    try {
      if (!(BK.packGot && BK.packGot[id])) {
        /* not downloaded in this session: is there a file at all? then the owner says so themselves */
        var r = await api('booksPackGet', { params: { id: id } });
        if (bkPackHasFile(BK.packRows && BK.packRows[id], r) !== true) { bkPackNoFile(id); return; }
        var yes = await new Promise(function (res) { confirmAsk(tx('Saved this pack?'), esc(tx('Download it first if you have not')), tx('We have it'), function () { res(true); }, false, function () { res(false); }); });
        if (!yes) return;
      }
      await api('booksPackAck', { params: { id: id }, body: {} }); bkTab('packs');
    } catch (e) { toast(bkWhy(e, tx('Could not record it'))); }
  });
}
function bkOpeningView(body) {
  BK.openingRef = BK.openingRef || bkRef();   /* one ref for this form until the server has said yes (M11) */
  body.innerHTML ='<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:6px">' + tx('Per line: code, party no, debit, credit, bill, due date') + '</div>'
    + '<textarea class="inp" id="op_csv" data-testid="op_csv" rows="8" style="width:100%;font-family:var(--mono)" placeholder="1300,P-00001,5000,,INV-12,2026-10-15"></textarea>'
    + '<div class="supacts" style="display:flex;gap:7px;margin-top:7px"><button class="supact-pri" data-testid="op_go" onclick="bkOpeningGo()">' + tx('Enter opening balances') + '</button></div><div id="op_out" data-testid="op_out" style="font-size:var(--fs-1);margin-top:6px"></div>';
}
async function bkOpeningGo() {
  var out = document.getElementById('op_out');
  var lines = String((document.getElementById('op_csv') || {}).value || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  var rows = [], bad = [];
  lines.forEach(function (l, i) {
    var c = l.split(',').map(function (x) { return x.trim(); });
    var dr = c[2] ? bkToMinor(c[2]) : 0, cr = c[3] ? bkToMinor(c[3]) : 0;
    if (!c[0] || !isFinite(dr) || !isFinite(cr) || (dr && cr) || (!dr && !cr)) bad.push(i + 1);
    else rows.push({ code: c[0], party_no: c[1] || null, dr_minor: dr, cr_minor: cr, bill_ref: c[4] || null, due_date: c[5] || null });
  });
  if (bad.length) { if (out) out.textContent = txf('Line {n}: one amount, debit or credit.', { n: bad.join(', ') }); return; }
  if (!rows.length) { if (out) out.textContent = tx('Type at least one line'); return; }
  /* ⚠️ M11: pressed twice, every balance doubled. The button is dead while the call is out; a retry carries the SAME
     client_ref; and once the server has said yes the box is emptied and the ref replaced — the next press is a new entry */
  await bkOnce('opening', document.querySelector('[data-testid="op_go"]'), async function () {
    try {
      BK.openingRef = BK.openingRef || bkRef();
      var r = await api('booksOpening', { body: { rows: rows, client_ref: BK.openingRef } });
      BK.openingRef = bkRef();
      var box = document.getElementById('op_csv'); if (box) box.value = '';
      if (out) out.textContent = txf('Entered as {no}.', { no: (r && r.entry_no) || '' }) + (r && r.suspense_minor ? ' ' + txf('{amt} did not balance — held in Suspense', { amt: bkMoney(r.suspense_minor) }) : '');
    } catch (e) { if (out) out.textContent = bkWhy(e, tx('Could not enter them')); }
  });
}

/* ══ 4 · CHEQUES AND WHAT IS WAITING — the two things that were on no screen (2026-09-30, review M12) ═════════ */
/**
 * ⚠️⚠️ A CHEQUE COULD NEVER CLEAR. Both screens record one, the server holds it correctly until it clears — and no
 * screen ever called the step, so the customer's balance never moved. The steps are offered wherever a held cheque
 * is listed: in the Receive form the moment it is recorded, and on the Ledger's Cheques view.
 * ⭐ The server decides every step (a refusal is shown in its own words); this only remembers what it was told.
 * ⚠️ WHAT IS LISTED: GET /api/books/cheques (the cheques still held, from any session or the counter), plus the ones
 * recorded in this session. Each server row carries `next` — the steps the engine accepts NOW; BK_CHQ_NEXT is only
 * the fallback for a row that came without it, and says what the engine says: received → deposited → cleared or
 * bounced; a cleared cheque later dishonoured is an owner reversal, not a step (engines v1.8.1).
 */
BK.cheques = BK.cheques || {};
var BK_CHQ_WORD = { received: 'Received', deposited: 'Deposited', cleared: 'Cleared', bounced: 'Bounced' };
var BK_CHQ_NEXT = { received: ['deposited'], deposited: ['cleared', 'bounced'], cleared: [], bounced: [] };
function bkChequeStatus(s) { s = String(s || '').replace(/^cheque_/, ''); return BK_CHQ_WORD[s] ? s : 'received'; }
function bkChequeNext(c) { return c && Array.isArray(c.next) ? c.next : (BK_CHQ_NEXT[c && c.status] || []); }
function bkChequeKeep(c) {
  var id = c && (c.payment_id || c.id); if (!id) return null;
  var was = BK.cheques[id] || {};
  BK.cheques[id] = { payment_id: id, party_id: c.party_id || was.party_id || null, name: c.name || c.party_name || was.name || '',
    amount_minor: c.amount_minor != null ? c.amount_minor : was.amount_minor, currency: c.currency || was.currency || null,
    cheque_no: c.cheque_no || c.number || was.cheque_no || '', cheque_bank: c.cheque_bank || c.bank || was.cheque_bank || '',
    cheque_date: c.cheque_date || c.date || was.cheque_date || null, status: bkChequeStatus(c.status || was.status),
    next: Array.isArray(c.next) ? c.next : (c.status ? null : (was.next || null)) };
  return BK.cheques[id];
}
function bkChequeStepsHTML(c) {
  if (!c) return '';
  var id = esc(c.payment_id), next = bkChequeNext(c);
  return '<span data-testid="chq-status-' + id + '" style="font-weight:600">' + tx(BK_CHQ_WORD[c.status]) + '</span>'
    + (next.length ? ' <span class="supacts" style="display:inline-flex;gap:6px;margin:0 0 0 8px">' + next.map(function (s) {
        return '<button data-testid="chq-' + s + '-' + id + '" onclick="bkChequeStep(\'' + id + '\',\'' + s + '\')">' + tx(BK_CHQ_WORD[s]) + '</button>'; }).join('') + '</span>' : '');
}
async function bkChequeStep(id, to) {
  var c = BK.cheques[id]; if (!c || bkChequeNext(c).indexOf(to) < 0) return;
  /* a bounce puts the debt back (and reverses a cleared one) — asked first */
  var inForm = !!document.getElementById('pay_chq_steps');
  if (to === 'bounced') {
    var yes = await new Promise(function (res) { confirmAsk(tx('Cheque bounced?'), esc(tx('They owe this amount again')), tx('Bounced'), function () { res(true); }, true, function () { res(false); }); });
    if (inForm) booksAfterPay();   /* the question took the Receive form's place — repaint the party behind it */
    if (!yes) return;
  }
  await bkOnce('chq:' + id, null, async function () {
    var say = function (t) { var o = document.getElementById('chq_out'); if (o) o.textContent = t; else if (t) toast(t); };
    document.querySelectorAll('[data-testid^="chq-"][data-testid$="-' + id + '"]').forEach(function (b) { if (b.tagName === 'BUTTON') b.disabled = true; });
    try {
      await api('booksChequeStep', { params: { id: id }, body: { status: to } });
      c.status = to; c.next = null; say('');   /* the next steps are the engine's to say — the fallback table until the list is read again */
      if (to === 'cleared' || to === 'bounced') { delete BK.stmt[c.party_id]; booksDuesLoad(true); }
    } catch (e) { say(bkWhy(e, tx('Could not change it'))); }
    bkChequeRepaint(id);
  });
}
/** flip the ROW (and the Receive form's line) — never the whole view */
function bkChequeRepaint(id) {
  var c = BK.cheques[id]; if (!c) return;
  var cell = document.querySelector('[data-testid="chq-steps-' + id + '"]'); if (cell) cell.innerHTML = bkChequeStepsHTML(c);
  var inForm = document.getElementById('pay_chq_steps'); if (inForm && PAY && PAY.id === id) inForm.innerHTML = bkChequeStepsHTML(c);
}
/** ONE read of /health: what is waiting (each row's `reason` is the server's sentence) */
async function bkHealthLoad() {
  var r = await api('booksHealth');
  BK.waiting = (r && r.waiting) || [];
  bkWaitingCount();
  return r;
}
/** the cheques still held, from any session or the counter — the server's row wins over what this session remembers */
async function bkChequesLoad() {
  var r = await api('booksCheques');
  ((r && r.cheques) || []).forEach(bkChequeKeep);
  return r;
}
function bkWaitingCount() {
  var el = document.querySelector('[data-testid="bk-tab-waiting"] .code'); if (!el) return;
  var n = (BK.waiting || []).length;
  el.textContent = '🕗 ' + tx('Waiting') + (n ? ' · ' + n : '');
}
/**
 * the cheques held — the Task table too (Athi, 2026-10-02): Party · Cheque (number · bank) · Dated · Amount · Status, whose cell carries
 * the steps the SERVER offers next (Deposited · Cleared · Bounced) as buttons; bkChequeRepaint flips that cell, never the view.
 * Its next level is the party's bills (the statement route, read once on the first open).
 */
function bkChequeList() { return Object.keys(BK.cheques).map(function (k) { return BK.cheques[k]; }); }
function bkChequeCols() {
  var dash = '<span style="color:var(--grey)">—</span>';
  return [
    { key: 'party', label: tx('Party'), prio: 1, sort: 'party', w: 220, html: true, cell: function (c) { return esc(c.name || '') || dash; } },
    { key: 'cheque', label: tx('Cheque'), prio: 4, sort: 'cheque', w: 200, html: true, cell: function (c) { return '<span class="mono">' + esc(c.cheque_no || '') + '</span>' + (c.cheque_bank ? ' · ' + esc(c.cheque_bank) : ''); } },
    { key: 'dated', label: tx('Dated'), prio: 5, sort: 'dated', w: 120, html: true, cell: function (c) { return c.cheque_date ? esc(bkDate(c.cheque_date)) : dash; } },
    { key: 'amount', label: tx('Amount'), prio: 3, sort: 'amount', num: true, w: 130, html: true, cell: function (c) { return esc(bkMoney(c.amount_minor, c.currency)); } },
    { key: 'status', label: tx('Status'), prio: 2, sort: 'status', w: 320, html: true, tid: function (c) { return 'chq-steps-' + c.payment_id; }, cell: function (c) { return bkChequeStepsHTML(c); } },
  ];
}
async function bkChequesView(body) {
  try {
    await bkChequesLoad();
    var list = bkChequeList(), by = function (g) { return function (a, b) { return String(g(a)).localeCompare(String(g(b)), undefined, { numeric: true }); }; };
    body.innerHTML = '<div id="chq_out" data-testid="chq_out" style="color:var(--warn-2);font-size:var(--fs-1);margin-bottom:6px"></div><div id="bkl_cheques" data-testid="cheques-list"></div>';
    CBList.mount(document.getElementById('bkl_cheques'), {
      key: 'cheques', t: tx, rows: bkChequeList, id: function (c) { return c.payment_id; }, columns: bkChequeCols(), rowTid: function (c) { return 'chq-' + c.payment_id; },
      search: function (c) { return [c.name, c.cheque_no, c.cheque_bank, c.status, (Number(c.amount_minor || 0) / Math.pow(10, bkDec(c.currency))).toFixed(bkDec(c.currency))].join(' '); },
      sorts: [{ key: 'dated', label: tx('Dated'), cmp: by(function (c) { return c.cheque_date || ''; }) }, { key: 'party', label: tx('Party'), cmp: by(function (c) { return c.name; }) },
        { key: 'cheque', label: tx('Cheque'), cmp: by(function (c) { return c.cheque_no; }) }, { key: 'amount', label: tx('Amount'), cmp: function (a, b) { return Number(a.amount_minor || 0) - Number(b.amount_minor || 0); } },
        { key: 'status', label: tx('Status'), cmp: by(function (c) { return c.status; }) }],
      filters: [{ key: 'status', label: tx('Status'), all: tx('Every status'), options: Object.keys(BK_CHQ_WORD).map(function (k) { return { v: k, label: tx(BK_CHQ_WORD[k]) }; }), match: function (c, v) { return c.status === v; } }],
      /* its next level is the party's bills (the statement route, read once on the first open) */
      next: function (c) { return '<div data-testid="chq-next-' + esc(c.payment_id) + '"><div style="color:var(--grey);font-size:var(--fs-1);text-transform:uppercase;padding:2px 0">' + esc(tx('Bills')) + '</div>' + (c.party_id ? bkPartyBillsHTML(c.party_id, 'cheques', c.currency || BK.duesCur) : '') + '</div>'; },
      empty: { title: tx('No cheques held') },
    });
  } catch (e) { body.innerHTML = bkErr(e); }
}
/**
 * ⚠️⚠️ A SALE THE LEDGER COULD NOT RECORD WAS VISIBLE ONLY TO SOMEONE CALLING THE API BY HAND. /health has always
 * named them (`waiting[]`, each with the reason). Athi, 2026-10-02: the list is the Task table — Supplier · Bill no · Amount ·
 * Date · Step — no chit id, no "tries". A supplier bill waits on a person: its row opens the bill in the popup, where Accept asks
 * what the goods are for (resale · own use · asset). A posting that genuinely FAILED shows its reason in the Step column, and
 * the one control that helps — Try again. Supplier, bill number and step are the chit's own (CBSheet.model); the amount is
 * `summary_json.money.total`, READ from the chit, never summed here.
 */
function bkWaitId(w) { return String(w.chit_id || w.id || w.ref || ''); }
function bkWaitFailed(w) { return !/^Waiting for you to confirm/.test(String(w.reason || w.why || '')); }
function bkWaitModel(w) { var r = w && w.chit_id && BK.wchit && BK.wchit[w.chit_id]; try { return r && window.CBSheet ? CBSheet.model(r) : null; } catch (_) { return null; } }
function bkWaitCols() {
  var dash = '<span style="color:var(--grey)">—</span>';
  return [
    { key: 'who', label: tx('Supplier'), prio: 1, sort: 'who', w: 240, html: true, cell: function (w) { var m = bkWaitModel(w); return m && m.who ? esc(m.who) : dash; } },
    { key: 'no', label: tx('Bill no'), prio: 4, sort: 'no', w: 170, html: true, cell: function (w) { var m = bkWaitModel(w); return m && m.no ? '<span class="mono">' + esc(m.no) + '</span>' : dash; } },
    { key: 'amount', label: tx('Amount'), prio: 2, sort: 'amount', num: true, w: 140, html: true, cell: function (w) { var m = bkWaitModel(w), t = m && m.money && m.money.total; return t != null ? esc(bkMajor(t, m.cur)) : dash; } },
    { key: 'date', label: tx('Date'), prio: 5, sort: 'date', w: 120, html: true, cell: function (w) { var m = bkWaitModel(w); return esc(bkDate((m && m.at) || w.since)); } },
    { key: 'step', label: tx('Step'), prio: 3, sort: 'step', w: 300, html: true, cell: function (w) {
        var i = (BK.waiting || []).indexOf(w), m = bkWaitModel(w);
        /* a posting that failed says why, in the server's words; a bill waiting on a person says which step it is at */
        if (bkWaitFailed(w)) return '<span data-testid="wait-why-' + i + '" style="color:var(--warn-2)">' + esc(w.reason || w.why || tx('No reason given')) + '</span>';
        return m ? esc(CBSheet.stepWord(m)) : dash;
      } },
  ];
}
function bkWaitDate(w) { var m = bkWaitModel(w); return String((m && m.at) || w.since || ''); }
function bkWaitNext(w) {
  var m = bkWaitModel(w), tid = 'wait-lines-' + (BK.waiting || []).indexOf(w);
  if (!m) return '<div data-testid="' + tid + '" style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx(w.chit_id ? 'Reading the bill…' : 'No bill attached')) + '</div>';
  var ml = (m.money && m.money.lines) || [];
  var lines = (m.lines || []).map(function (l, i) {
    var f = ml[i], tot = f ? f.total : (l.total != null ? l.total : l.net), q = l.quantity != null ? l.quantity : (l.qty != null ? l.qty : '');
    return CBList.nextRow([esc(l.particulars || l.name || ''), esc(String(q) + (l.unit && l.unit !== 'piece' ? ' ' + l.unit : '')), esc(bkMajor(tot, m.cur))], [90, 110]);
  }).join('');
  return '<div data-testid="' + tid + '">' + (lines || '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('No lines on this bill')) + '</div>') + '</div>';
}
/** one chit read per waiting row (four at a time); each row paints again when its bill arrives — the list never waits for them */
async function bkWaitReads() {
  BK.wchit = BK.wchit || {};
  var todo = (BK.waiting || []).filter(function (w) { return w.chit_id && !(w.chit_id in BK.wchit); });
  todo.forEach(function (w) { BK.wchit[w.chit_id] = null; });
  var next = 0;
  async function worker() {
    while (next < todo.length) {
      var w = todo[next++];
      try { BK.wchit[w.chit_id] = await api('chit', { params: { id: w.chit_id } }); } catch (_) { BK.wchit[w.chit_id] = false; }
      if (BK.tab === 'waiting') { var wl = CBList.get('waiting'); if (wl) wl.refresh(); }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
}
async function bkWaitingView(body) {
  try {
    await bkHealthLoad();
    var list = BK.waiting || [], failed = list.some(bkWaitFailed);
    body.innerHTML = '<div class="sec">' + tx('Waiting to be recorded') + '</div>'
      + (list.length && failed ? '<div class="supacts" style="display:flex;gap:7px;margin-bottom:9px"><button class="supact-pri" data-testid="wait-retry" onclick="bkWaitingRetry()">' + tx('Try again') + '</button></div>' : '')
      + '<div id="wait_out" data-testid="wait_out" style="font-size:var(--fs-1);margin-bottom:6px"></div>'
      + (list.length ? '<div id="bkl_waiting" data-testid="waiting-list"></div>' : emptyState('✓', tx('Nothing is waiting'), ''));
    if (!list.length) return;
    CBList.mount(document.getElementById('bkl_waiting'), {
      key: 'waiting', t: tx, rows: function () { return BK.waiting || []; }, id: bkWaitId, columns: bkWaitCols(),
      rowTid: function (w) { return 'wait-' + (BK.waiting || []).indexOf(w); },
      /* a row opens the bill's sheet; its caret opens the lines */
      onOpen: function (w) { if (w.chit_id) openChitSheet(w.chit_id); },
      search: function (w) { var m = bkWaitModel(w); return [m && m.who, m && m.no, m && m.money && m.money.total, w.reason, w.why].join(' '); },
      sorts: [
        { key: 'date', label: tx('Oldest first'), cmp: function (a, b) { return bkWaitDate(a) < bkWaitDate(b) ? -1 : bkWaitDate(a) > bkWaitDate(b) ? 1 : 0; } },
        { key: 'who', label: tx('Supplier'), cmp: function (a, b) { return String((bkWaitModel(a) || {}).who || '').localeCompare(String((bkWaitModel(b) || {}).who || '')); } },
        { key: 'no', label: tx('Bill no'), cmp: function (a, b) { return String((bkWaitModel(a) || {}).no || '').localeCompare(String((bkWaitModel(b) || {}).no || ''), undefined, { numeric: true }); } },
        { key: 'amount', label: tx('Amount'), cmp: function (a, b) { var g = function (w) { var m = bkWaitModel(w); return Number(m && m.money && m.money.total) || 0; }; return g(a) - g(b); } },
        { key: 'step', label: tx('Step'), cmp: function (a, b) { return Number(bkWaitFailed(b)) - Number(bkWaitFailed(a)); } },
      ],
      filters: [{ key: 'what', label: tx('Step'), all: tx('Every step'), options: [{ v: 'confirm', label: tx('To accept') }, { v: 'failed', label: tx('Could not be recorded') }],
        match: function (w, v) { return v === 'failed' ? bkWaitFailed(w) : !bkWaitFailed(w); } }],
      next: bkWaitNext,
      empty: { title: tx('Nothing is waiting') },
    });
    bkWaitReads();
  } catch (e) { body.innerHTML = bkErr(e); }
}
async function bkWaitingRetry() {
  await bkOnce('retry', document.querySelector('[data-testid="wait-retry"]'), async function () {
    var before = (BK.waiting || []).length;
    try {
      await api('booksRetry', { body: {} });
      var body = document.getElementById('bk_body'); if (body && BK.tab === 'waiting') await bkWaitingView(body);
      var left = (BK.waiting || []).length, out = document.getElementById('wait_out');
      if (out) out.textContent = left ? txf('{n} recorded · {m} still waiting', { n: Math.max(0, before - left), m: left }) : tx('All recorded');
    } catch (e) { var o = document.getElementById('wait_out'); if (o) o.textContent = bkWhy(e, tx('Could not try again')); }
  });
}
async function bkAccounts(body) {
  try {
    var r = await api('booksAccounts'); var acc = (r && r.accounts) || [];
    var groups = acc.filter(function (a) { return a.is_group; });
    body.innerHTML = '<div class="supacts" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px"><input class="inp" id="ac_name" data-testid="ac_name" placeholder="' + esc(tx('New ledger name')) + '"><select class="inp" id="ac_parent" data-testid="ac_parent">' + groups.map(function (g) { return '<option value="' + esc(g.code) + '">' + esc(g.code + ' · ' + g.name) + '</option>'; }).join('') + '</select><button class="supact-pri" data-testid="ac_add" onclick="bkAccountAdd()">' + tx('Add') + '</button></div><div id="ac_out" style="font-size:var(--fs-1)"></div>'
      + bkTable([{ t: tx('Code') }, { t: tx('Ledger') }, { t: tx('Group') }], acc.map(function (a) { return '<tr' + (a.is_group ? ' style="font-weight:700"' : '') + '><td class="mono">' + esc(a.code) + '</td><td>' + esc(a.name) + '</td><td>' + esc(a.tally_group || '') + '</td></tr>'; }).join(''));
  } catch (e) { body.innerHTML = bkErr(e); }
}
async function bkAccountAdd() {
  var n = String((document.getElementById('ac_name') || {}).value || '').trim(), p = (document.getElementById('ac_parent') || {}).value;
  var out = document.getElementById('ac_out');
  if (!n) { if (out) out.textContent = tx('Type a name'); return; }
  try { var r = await api('booksAccountAdd', { body: { name: n, parent_code: p } }); toast(txf('Added as {code}', { code: (r && r.account && r.account.code) || '' })); bkTab('accounts'); }
  catch (e) { if (out) out.textContent = bkWhy(e, tx('Could not add it')); }
}
