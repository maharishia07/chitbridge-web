/* app/helpers.js — generic, dependency-free helpers (module 2 of the app split).
 * Classic script, shared global scope. Loaded by /app.html AFTER core.js and BEFORE the main inline
 * script, so every panel can call these. HARD RULE for this file: pure leaves only — nothing here may
 * reference app state (UI/SESSION/STORE/…) or DOM at load time. Panel-specific mappers/renderers stay
 * in their panel module. Extracted verbatim from app.html (behaviour unchanged).
 *
 * OWNS  the generic leaves: esc · opt · money and date formatters · month words
 * FLOW  loaded after core.js → every panel and small app calls these pure functions      CARD 29-qa-test-tooling-ux-locale-and-design-system/helpers
 */

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

/* ⭐ T2-WEBPRIMS: THE ONE esc — every page loads this file first and calls it; 43 private copies were deleted, and they disagreed on "'"
   (30 escaped it, this home did not). Text and attribute safe either quote: & < > " '. e2e/prim-homes.cjs fails a second definition. */
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function opt(arr, sel) {
  return arr.map((item) => `<option ${item === sel ? 'selected' : ''}>${item}</option>`).join('');
}
/**
 * ⚠️ ONE SHAPE FOR "IT DID NOT LOAD", because there were four. Measured across the app: "Couldn't load",
 * "Couldn't load suppliers", "Couldn't load co-assists", "Could not load customers" — three spellings of the
 * same sentence, some with an ⚠ icon and some with none. Four ways of saying one thing reads as four different
 * failures to the person hitting them.
 *
 * ⚠️ AND IT OFFERS RETRY. A failure with no way out makes the reader reload the whole app, which costs them
 * every bit of unsaved state on the screen. `subject` names what failed; `retry` is a call expression.
 */
function scrErr(e, subject, retry) {
  return (
    '<div class="empty"><div class="big">⚠</div>' +
    '<div class="t">' +
    esc("Couldn't load" + (subject ? ' ' + subject : '')) +
    '</div>' +
    '<div>' +
    esc(e && e.message) +
    '</div>' +
    (retry ? '<button class="btn" data-testid="err-retry" onclick="' + esc(retry) + '" style="margin-top:4px">' + tx('Try again') + '</button>' : '') +
    '</div>'
  );
}

function cap(s) {
  return s[0].toUpperCase() + s.slice(1);
}
/* ⭐ CX0 (2026-10-13): THE SHOP'S PACK, ON EVERY PAGE — the registered pack of the shop's country (CBRegulation, bundled in engine/tax.js). One reader; a screen
   that needs the pack's word asks here, never a second `if (country === 'IN')`. `cc` (STD2): a screen that holds the shop's country itself passes it
   (CB Settings › Your shop, from /me) instead of writing the global SESSION.country. null = no registry on the page or no country known. */
function shopReg(cc) {
  try {
    var c = cc || (typeof SESSION !== 'undefined' && SESSION && SESSION.country) || '';
    return (window.CBRegulation && c && CBRegulation.packFor(String(c).toUpperCase())) || null;
  } catch (_) {
    return null;
  }
}
/* ⭐ FX-QA1 + STD2: THE PACK'S OWN WORDS for what a form asks — the tax id, the postal code, the region. ONE helper; a screen never types "GSTIN" or "PIN".
   The pack's `words` first (engines: `words: { taxId, postcode, region }` — not yet carried); then the words keyed by the pack's id here — the tax id is
   the api's profile.taxIdWordOf answer for the same pack (what GET /entities/constitutions sends as countries[].tax.id); NO pack known → NEUTRAL words,
   never India's (STD2: no India for an unstated country). English is the key: the caller passes the word through tx.
   NAMES-1 (2026-10-17, Athi): `stock` = what the shop calls the goods it holds — Inventory for a US shop, Stock elsewhere and with no country.
   A row names only the words that differ; a missing word is the neutral one. A page without the registry (Home loads no engine/tax.js) keys the
   row by the country code the caller passes — each pack's id is its country's code. */
var PACK_WORDS = {
  IN: { taxId: 'GSTIN', postcode: 'PIN', region: 'State' },
  AU: { taxId: 'ABN', postcode: 'Postcode', region: 'State' },
  AE: { taxId: 'TRN', postcode: 'P.O. Box', region: 'Emirate' },
  US: { stock: 'Inventory' }
};
var PACK_WORDS_NONE = { taxId: 'Tax number', postcode: 'Postcode', region: 'Region', stock: 'Stock' };
function packWord(kind, cc) {
  var p = shopReg(cc),
    own = p && p.words && p.words[kind];
  if (own) return own;
  var w = PACK_WORDS[packRowKey(p, cc)] || PACK_WORDS_NONE;
  return w[kind] || PACK_WORDS_NONE[kind] || '';
}
/** which PACK_WORDS row: the registered pack's id, else (no registry on the page) the country code the caller passed */
function packRowKey(pack, countryCode) {
  return String((pack && pack.id) || countryCode || '').toUpperCase();
}
/** the shop's word for its goods (NAMES-1): Inventory · Stock. The page's country when it holds one; else the one /me read's (CBAvatar.shopCountry) */
function stockWord(countryCode) {
  var country = countryCode || (window.CBAvatar && CBAvatar.shopCountry && CBAvatar.shopCountry()) || '';
  return packWord('stock', country);
}
/** the pack's own word for a tax id: GSTIN · ABN · TRN — "Tax number" with no pack. The till reads the server's (snapshot shop.tax_id_word), never a copy */
function taxIdWord(cc) {
  return packWord('taxId', cc);
}
/** does the shop's tax turn on the STATE (India's CGST/SGST · IGST, pack.tax.supply 'state')? false under a border pack (Australia, the UAE); N2: false too when no pack is known (neutral, never India) */
function packSplitsByState(cc) {
  var p = shopReg(cc);
  return !!p && (!p.tax || !p.tax.supply || p.tax.supply === 'state');
}
/** UPI is India's payment mode (reg-in chart.paymentModes.upi) — offered only where the shop's pack carries it; N2: false when no pack is known */
function payHasUpi() {
  var p = shopReg();
  return !!(p && p.chart && p.chart.paymentModes && p.chart.paymentModes.upi);
}
/** does the shop's pack carry India's HSN rule (reg-in tax.hsn_digits)? CX4: the "HSN" words, the exposure switch and the Rule 46 note follow it; N2: false when no pack is known */
function packHasHsn() {
  var p = shopReg();
  return !!p && (!p.tax || !!p.tax.hsn_digits);
}
function payModeOpts() {
  return payHasUpi() ? '<option value="upi">UPI</option>' : '';
}

/**
 * ⭐⭐ ONE GROUP SUM — TOTALLED PER CURRENCY, NEVER ACROSS. Athi, 2026-08-21: *"we have a couple of places
 * sum is there; what I want is a single group sum, gold standard."*
 *
 * ⚠⚠ THE PLATFORM ALREADY HAD THIS RULE IN TWO PLACES AND BROKE IT IN A THIRD. `lib/money.js` THROWS on mixed
 * currencies rather than adding them; `_gsMoney` in cap-folders renders them side by side and says *"a figure
 * spanning two currencies means nothing, most convincingly when it looks tidy"*. The select bar did
 * `rows.reduce((a,c) => a + c.amt, 0)` and labelled the result with the READER's currency — so ticking a
 * ₹500 chit and a $2,000 chit read as one tidy total in a currency belonging to neither.
 *
 * ⚠️ IT IS THE TIDINESS THAT MAKES IT DANGEROUS. A wrong number that looks broken gets questioned; a wrong
 * number that looks like a total gets used.
 *
 * ⚠️ MISSING CURRENCY FALLS BACK TO THE READER'S, and that is a real decision rather than a shrug: a row
 * with no currency is almost always the reader's own, and grouping it under 'unknown' would split one honest
 * total into two for a field nobody filled in.
 */
function cbSumByCurrency(rows, amtKey, curKey) {
  var by = {};
  (rows || []).forEach(function (item) {
    var v = Number((item || {})[amtKey || 'amt'] || 0);
    if (!v) return;
    var c = (item || {})[curKey || 'currency'] || moneyCode() || '';
    by[c] = (by[c] || 0) + v;
  });
  /* ⚠️ ORDERED BIGGEST FIRST, so the figure a reader is most likely to want is the one they read first. */
  return Object.keys(by)
    .map(function (item) {
      return { currency: item, total: by[item] };
    })
    .sort(function (first, second) {
      return second.total - first.total;
    });
}

/**
 * Render what cbSumByCurrency returns. One currency prints as a plain amount; several print side by side with
 * the reason stated, because a reader seeing two figures will otherwise wonder which one is the answer.
 */
function cbMoneyList(list, opts) {
  opts = opts || {};
  if (!list || !list.length) return opts.empty || '—';
  var body = list
    .map(function (x) {
      return fmtMoney(x.total, x.currency);
    })
    .join('<span style="color:var(--grey)"> + </span>');
  if (list.length < 2 || opts.quiet) return body;
  return (
    body +
    '<span style="color:var(--grey);font-size:var(--fs-1)"> · ' +
    (typeof tx === 'function' ? tx('not added together') : 'not added together') +
    '</span>'
  );
}
function nm(v, fb) {
  return esc(v || fb || '—');
} /* R3: one name-with-fallback — esc(display_name || fallback) */
/**
 * ⚠️ THE en-IN PIN IS GONE. It was deliberate and its reason was good — "so time is deterministic across
 * browsers" for the tests — but it showed 09:15 pm to a reader in Tokyo (21:15) and Dubai (09:15 م). Keeping
 * the test honest and the product wrong is the wrong trade: determinism belongs in the TEST, by setting a
 * locale, not in the product by denying every reader their own.
 * ⚠️ A reader who has chosen nothing still gets en-IN — see CBLocale's FALLBACK. Nothing changes today.
 */
function fmtAt(ts) {
  return CBLocale.time(ts);
}
/* R5: connector/device health — ONE source (colour · dot · signal), was duplicated across cap-connector + cap-workforce. */
function healthColor(h) {
  return { live: 'var(--ok-3)', slow: 'var(--warn-2)', offline: 'var(--disp)' }[h] || 'var(--grey-4)';
}
function healthDot(h) {
  return '<span title="' + esc(h || '') + '" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + healthColor(h) + '"></span>';
}
function sigLabel(s) {
  if (s === 'no_signal') return '<span style="color:var(--disp);font-weight:700;font-size:var(--fs-1)">○ no signal</span>';
  if (s === 'live') return '<span style="color:var(--ok-3);font-weight:700;font-size:var(--fs-1)">● live</span>';
  if (s === 'slow') return '<span style="color:#c9962a;font-weight:700;font-size:var(--fs-1)">◐ slow</span>';
  return '<span style="color:var(--grey-4);font-weight:700;font-size:var(--fs-1)">○ silent</span>';
}
/* R6: relative time ("2m ago") — was cap-workforce._ago; a generic leaf now (reusable in folders/inbox/etc). */
function timeAgo(ts) {
  if (!ts) return '';
  var s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 0) s = 0;
  if (s < 60) return s + 's ago';
  var m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  var h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}
/**
 * R7: one empty-state + one loader — every list re-hand-rolled these. (sub may contain HTML; title is escaped.)
 *
 * ⭐ `act` — THE EMPTY STATE OFFERS THE NEXT STEP. An empty screen is the FIRST screen: it is what a new user
 * and every prospect sees before there is any data to look at, and ours described the next step in prose
 * ("Add one with + New product") while making them go find the button. Naming the action and not offering it is
 * the one thing an empty state must never do — it is the only moment where the app knows exactly what the
 * person should do next.
 *
 *   act = { label:'+ New product', onclick:"newProduct()" }
 */
function emptyState(icon, title, sub, node) {
  return (
    '<div class="empty"><div class="big">' +
    (icon || '✨') +
    '</div><div class="t">' +
    esc(title) +
    '</div>' +
    (sub ? '<div>' + sub + '</div>' : '') +
    (node && node.label
      ? '<button class="btn pri" data-testid="empty-act" onclick="' + esc(node.onclick || '') + '" style="margin-top:4px">' + esc(node.label) + '</button>'
      : '') +
    '</div>'
  );
}
function loader(label) {
  return (
    '<div style="padding:40px 16px;text-align:center;color:var(--grey)"><span class="spin" style="display:inline-block;margin-bottom:10px"></span><div>' +
    esc(label || 'Loading…') +
    '</div></div>'
  );
}

/**
 * ⚠️⚠️ CCY_LOCALE IS GONE, AND ITS REMOVAL IS THE POINT. It mapped a CURRENCY to a LOCALE — INR→en-IN,
 * USD→en-US — and then formatted money with the locale of the MONEY instead of the locale of the READER.
 * Measured: every viewer of a USD price saw $123,456.50 (US grouping) and every viewer of an INR price saw
 * ₹1,23,456.50 (Indian lakh grouping), whoever they were. A French reader got lakh grouping. An Indian reader
 * got US grouping. Both wrong, and wrong for everyone except the one reader the mapping happened to suit.
 *
 * The currency decides the SYMBOL. The reader decides the FORMAT. They are independent.
 */
/* ONE money formatter, and it now asks the localisation layer. See the note above CCY_LOCALE's removal. */
/* T2-WEBPRIMS (widened, additive): `empty` — what a MISSING amount reads as ('' · '—'); left out, a missing amount formats as zero, as before.
   A page without the locale engine (a lab, a kit page) still gets the currency's own format from Intl — never a hard-coded ₹. */
/** N1 (NEUTRAL-CORE, 2026-10-17): THE ONE "WHICH MONEY" READER - a row's own 3-letter code, else the shop's (myCur), else null. Never a currency by name; null prints the bare amount (fmtMoney) */
function moneyCode(code) {
  var ownCode = String(code == null ? '' : code)
    .trim()
    .toUpperCase();
  if (/^[A-Z]{3}$/.test(ownCode)) return ownCode;
  var shop = typeof myCur === 'function' ? myCur() : null;
  return shop ? String(shop).toUpperCase() : null;
}
/** an amount with no currency: two decimals, plain grouping, no symbol (N1: an unstated shop is not India's) */
function bareAmount(amount) {
  var figure = typeof CBMoney !== 'undefined' && CBMoney.amountOfLoose ? CBMoney.amountOfLoose(amount) : Number(amount);
  return (isFinite(figure) ? figure : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/**
 * UX-123 (walk 2026-10-25 W20): a time the way the SHOP reads it. A Sydney shop opened on a laptop in India showed its messages in India's hours.
 * The shop's zone is the entity's own (/me timezone -> window.CB_SHOP_TZ); with none stated the person's own zone stays (CBLocale), so nothing is guessed.
 */
/**
 * UX-122 (walk 2026-10-25 W15): ONE mapping from a status CODE to the words a person reads. The timeline printed "Status → In_progress" and "changed from pending to
 * in_progress"; the code is for the machine. statusWord('in_progress') -> "In progress"; plainStatuses('changed from pending to in_progress') -> "changed from Pending to In progress".
 * An unknown code is spaced and capitalised, never shown with its underscore.
 */
var STATUS_WORDS = {
  pending: 'Pending',
  delivered: 'Delivered',
  read: 'Read',
  accepted: 'Accepted',
  in_progress: 'In progress',
  partial: 'Part done',
  completed: 'Done',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  on_hold: 'On hold',
  disputed: 'Disputed',
  draft: 'Draft'
};
function statusWord(code) {
  var c = String(code == null ? '' : code).trim();
  if (!c) return '';
  var key = c.toLowerCase();
  var w = STATUS_WORDS[key] || key.replace(/_/g, ' ');
  w = w.charAt(0).toUpperCase() + w.slice(1);
  return typeof tx === 'function' ? tx(w) : w;
}
function plainStatuses(text) {
  /* only a code that follows "from", "to" or an arrow is a status — ordinary prose ("already read") is left alone */
  return String(text == null ? '' : text).replace(/(\bfrom|\bto|→)\s+(pending|delivered|read|accepted|in_progress|partial|completed|cancelled|rejected|on_hold|disputed|draft)\b/gi, function (all, lead, code) {
    return lead + ' ' + statusWord(code);
  });
}
function shopDateTime(ts, opts) {
  var base = opts || { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  var zone = typeof window !== 'undefined' && window.CB_SHOP_TZ ? String(window.CB_SHOP_TZ) : ''; /* set by the app from /me (SESSION.timezone) */
  if (zone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: zone });
      base = Object.assign({}, base, { timeZone: zone });
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('shopDateTime: unknown shop time zone', zone);
    }
  }
  return typeof CBLocale !== 'undefined' ? CBLocale.datetime(ts, base) : String(ts || '').replace('T', ' ').slice(0, 16);
}
function fmtMoney(amount, code, empty) {
  if (empty !== undefined && (amount == null || amount === '' || (typeof amount !== 'object' && !isFinite(Number(amount))))) return empty;
  var given = String(code == null ? '' : code).trim(),
    shown = given ? code : moneyCode();
  if (!shown) return bareAmount(amount); /* N1: no money stated anywhere -> the amount alone, no symbol, no lakh grouping */
  if (typeof CBLocale !== 'undefined' && CBLocale.money) return CBLocale.money(amount, shown);
  var n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: shown }).format(n);
  } catch (e) {
    return shown + ' ' + n.toFixed(2);
  } /* a code Intl does not know: the code and the figure, never a guessed symbol */
}
/* ⭐ T2-WEBPRIMS: THE TWELVE MONTH WORDS in the reader's language (CBLocale's own date words) — 'short' Jan… · 'long' January…. Three files typed
   their own English Jan…Dec; a list built here follows the reader. Index 0 = January; a fiscal year rotates it at the caller. */
/* month WORDS in the screen's language (WALK-REG R49, 16 Oct: a UAE shop read Arabic months on an English screen) — the ORDER of a date is the
   country's; the WORD is the reader's. One helper: Country setup, Books, Returns, Register all read it. */
function monthNames(form) {
  var out = [],
    tag = 'en';
  try {
    tag = (window.CBLocale && CBLocale.lang && CBLocale.lang()) || 'en';
  } catch (failure) {
    if (window.cbQuiet) window.cbQuiet('helpers:monthNames', failure); /* the language reader is missing: English words, still correct */
  }
  for (var index = 0; index < 12; index++) {
    try {
      out.push(new Intl.DateTimeFormat(tag, { month: form === 'long' ? 'long' : 'short', timeZone: 'UTC' }).format(Date.UTC(2000, index, 15, 12)));
    } catch (failure) {
      if (window.cbQuiet) window.cbQuiet('helpers:monthNames', failure);
      out.push(CBLocale.date(Date.UTC(2000, index, 15, 12), { month: form === 'long' ? 'long' : 'short', timeZone: 'UTC' }));
    }
  }
  return out;
}

/* ⭐ T3-P1-MONEY: THE ONE GSTR DOWNLOAD — the offline-tool JSON GET /api/tax/gstr builds (tax-lines gstr1 · gstr3b, the one builder), saved as a file
   named gstr1-YYYY-MM.json / gstr3b-YYYY-MM.json. The workshop's Tax band (cap-admin.js misTaxExport) and CB Finance › Returns (cap-finance-returns.js)
   both call this; neither builds a second. → Promise<filename>; a failure rejects with api()'s error — the caller says its own sentence. */
function gstrDownload(month, form) {
  return api('taxGstr', { query: { month: month, form: form } }).then(function (reply) {
    var name = form + '-' + month + '.json',
      url = URL.createObjectURL(new Blob([JSON.stringify(reply, null, 2)], { type: 'application/json' }));
    var node = document.createElement('a');
    node.href = url;
    node.download = name;
    document.body.appendChild(node);
    node.click();
    node.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 60000);
    return name;
  });
}

function jwtPayload(t) {
  try {
    const text = String(t || '').split('.')[1];
    if (!text) return null;
    return JSON.parse(atob(text.replace(/-/g, '+').replace(/_/g, '/')));
  } catch (_) {
    return null;
  }
}
