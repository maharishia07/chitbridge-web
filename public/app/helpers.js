/* app/helpers.js — generic, dependency-free helpers (module 2 of the app split).
 * Classic script, shared global scope. Loaded by /app.html AFTER core.js and BEFORE the main inline
 * script, so every panel can call these. HARD RULE for this file: pure leaves only — nothing here may
 * reference app state (UI/SESSION/STORE/…) or DOM at load time. Panel-specific mappers/renderers stay
 * in their panel module. Extracted verbatim from app.html (behaviour unchanged). */

function deepClone(x){ return JSON.parse(JSON.stringify(x)); }

function esc(v){ return String(v==null?'':v).replace(/[<>"&]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c])); }
function opt(arr,sel){ return arr.map(o=>`<option ${o===sel?'selected':''}>${o}</option>`).join(""); }
/**
 * ⚠️ ONE SHAPE FOR "IT DID NOT LOAD", because there were four. Measured across the app: "Couldn't load",
 * "Couldn't load suppliers", "Couldn't load co-assists", "Could not load customers" — three spellings of the
 * same sentence, some with an ⚠ icon and some with none. Four ways of saying one thing reads as four different
 * failures to the person hitting them.
 *
 * ⚠️ AND IT OFFERS RETRY. A failure with no way out makes the reader reload the whole app, which costs them
 * every bit of unsaved state on the screen. `subject` names what failed; `retry` is a call expression.
 */
function scrErr(e, subject, retry){
  return '<div class="empty"><div class="big">⚠</div>'
    + '<div class="t">'+esc("Couldn't load"+(subject?' '+subject:''))+'</div>'
    + '<div>'+esc(e&&e.message)+'</div>'
    + (retry ? '<button class="btn" data-testid="err-retry" onclick="'+esc(retry)+'" style="margin-top:4px">' + tx('Try again') + '</button>' : '')
    + '</div>';
}

function cap(s){ return s[0].toUpperCase()+s.slice(1); }
/* ⭐ CX0 (2026-10-13): THE SHOP'S PACK, ON EVERY PAGE — the registered pack of the shop's country (CBRegulation, bundled in app/tax.js). One reader; a screen
   that needs the pack's word asks here, never a second `if (country === 'IN')`. `cc` (STD2): a screen that holds the shop's country itself passes it
   (CB Settings › Your shop, from /me) instead of writing the global SESSION.country. null = no registry on the page or no country known. */
function shopReg(cc){ try { var c = cc || (typeof SESSION !== 'undefined' && SESSION && SESSION.country) || ''; return (window.CBRegulation && c && CBRegulation.packFor(String(c).toUpperCase())) || null; } catch (_) { return null; } }
/* ⭐ FX-QA1 + STD2: THE PACK'S OWN WORDS for what a form asks — the tax id, the postal code, the region. ONE helper; a screen never types "GSTIN" or "PIN".
   The pack's `words` first (engines: `words: { taxId, postcode, region }` — not yet carried); then the words keyed by the pack's id here — the tax id is
   the api's profile.taxIdWordOf answer for the same pack (what GET /entities/constitutions sends as countries[].tax.id); NO pack known → NEUTRAL words,
   never India's (STD2: no India for an unstated country). English is the key: the caller passes the word through tx. */
var PACK_WORDS = {
  IN: { taxId: 'GSTIN', postcode: 'PIN', region: 'State' },
  AU: { taxId: 'ABN', postcode: 'Postcode', region: 'State' },
  AE: { taxId: 'TRN', postcode: 'P.O. Box', region: 'Emirate' },
};
var PACK_WORDS_NONE = { taxId: 'Tax number', postcode: 'Postcode', region: 'Region' };
function packWord(kind, cc){
  var p = shopReg(cc), own = p && p.words && p.words[kind];
  if (own) return own;
  var w = (p && PACK_WORDS[String(p.id || '').toUpperCase()]) || PACK_WORDS_NONE;
  return w[kind] || PACK_WORDS_NONE[kind] || '';
}
/** the pack's own word for a tax id: GSTIN · ABN · TRN — "Tax number" with no pack. The till reads the server's (snapshot shop.tax_id_word), never a copy */
function taxIdWord(cc){ return packWord('taxId', cc); }
/** does the shop's tax turn on the STATE (India's CGST/SGST · IGST, pack.tax.supply 'state')? false under a border pack (Australia, the UAE); true when no pack is known */
function packSplitsByState(cc){ var p = shopReg(cc); return !p || !p.tax || !p.tax.supply || p.tax.supply === 'state'; }
/** UPI is India's payment mode (reg-in chart.paymentModes.upi) — offered only where the shop's pack carries it; true when no pack is known */
function payHasUpi(){ var p = shopReg(); return !p || !!(p.chart && p.chart.paymentModes && p.chart.paymentModes.upi); }
/** does the shop's pack carry India's HSN rule (reg-in tax.hsn_digits)? CX4: the "HSN" words, the exposure switch and the Rule 46 note follow it; true when no pack is known */
function packHasHsn(){ var p = shopReg(); return !p || !p.tax || !!p.tax.hsn_digits; }
function payModeOpts(){ return payHasUpi() ? '<option value="upi">UPI</option>' : ''; }

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
function cbSumByCurrency(rows, amtKey, curKey){
  var by = {};
  (rows || []).forEach(function(r){
    var v = Number((r || {})[amtKey || 'amt'] || 0);
    if (!v) return;
    var c = ((r || {})[curKey || 'currency']) || (typeof myCur === 'function' ? myCur() : 'INR');
    by[c] = (by[c] || 0) + v;
  });
  /* ⚠️ ORDERED BIGGEST FIRST, so the figure a reader is most likely to want is the one they read first. */
  return Object.keys(by).map(function(c){ return { currency: c, total: by[c] }; })
    .sort(function(a, b){ return b.total - a.total; });
}

/**
 * Render what cbSumByCurrency returns. One currency prints as a plain amount; several print side by side with
 * the reason stated, because a reader seeing two figures will otherwise wonder which one is the answer.
 */
function cbMoneyList(list, opts){
  opts = opts || {};
  if (!list || !list.length) return opts.empty || '—';
  var body = list.map(function(x){ return fmtMoney(x.total, x.currency); })
    .join('<span style="color:var(--grey)"> + </span>');
  if (list.length < 2 || opts.quiet) return body;
  return body + '<span style="color:var(--grey);font-size:var(--fs-1)"> · '
    + (typeof tx === 'function' ? tx('not added together') : 'not added together') + '</span>';
}
function nm(v, fb){ return esc(v||fb||'—'); }   /* R3: one name-with-fallback — esc(display_name || fallback) */
/**
 * ⚠️ THE en-IN PIN IS GONE. It was deliberate and its reason was good — "so time is deterministic across
 * browsers" for the tests — but it showed 09:15 pm to a reader in Tokyo (21:15) and Dubai (09:15 م). Keeping
 * the test honest and the product wrong is the wrong trade: determinism belongs in the TEST, by setting a
 * locale, not in the product by denying every reader their own.
 * ⚠️ A reader who has chosen nothing still gets en-IN — see CBLocale's FALLBACK. Nothing changes today.
 */
function fmtAt(ts){ return CBLocale.time(ts); }
/* R5: connector/device health — ONE source (colour · dot · signal), was duplicated across cap-connector + cap-workforce. */
function healthColor(h){ return ({live:'var(--ok-3)',slow:'var(--warn-2)',offline:'var(--disp)'})[h]||'var(--grey-4)'; }
function healthDot(h){ return '<span title="'+esc(h||'')+'" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+healthColor(h)+'"></span>'; }
function sigLabel(s){ if(s==='no_signal')return '<span style="color:var(--disp);font-weight:700;font-size:var(--fs-1)">○ no signal</span>'; if(s==='live')return '<span style="color:var(--ok-3);font-weight:700;font-size:var(--fs-1)">● live</span>'; if(s==='slow')return '<span style="color:#c9962a;font-weight:700;font-size:var(--fs-1)">◐ slow</span>'; return '<span style="color:var(--grey-4);font-weight:700;font-size:var(--fs-1)">○ silent</span>'; }
/* R6: relative time ("2m ago") — was cap-workforce._ago; a generic leaf now (reusable in folders/inbox/etc). */
function timeAgo(ts){ if(!ts)return ''; var s=Math.floor((Date.now()-new Date(ts).getTime())/1000); if(s<0)s=0; if(s<60)return s+'s ago'; var m=Math.floor(s/60); if(m<60)return m+'m ago'; var h=Math.floor(m/60); if(h<24)return h+'h ago'; return Math.floor(h/24)+'d ago'; }
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
function emptyState(icon,title,sub,act){
  return '<div class="empty"><div class="big">'+(icon||'✨')+'</div><div class="t">'+esc(title)+'</div>'
    + (sub?'<div>'+sub+'</div>':'')
    + (act&&act.label ? '<button class="btn pri" data-testid="empty-act" onclick="'+esc(act.onclick||'')
        +'" style="margin-top:4px">'+esc(act.label)+'</button>' : '')
    + '</div>';
}
function loader(label){ return '<div style="padding:40px 16px;text-align:center;color:var(--grey)"><span class="spin" style="display:inline-block;margin-bottom:10px"></span><div>'+esc(label||'Loading…')+'</div></div>'; }

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
function fmtMoney(amount,code){ return CBLocale.money(amount, code); }

function jwtPayload(t){ try{ const p=String(t||"").split('.')[1]; if(!p) return null; return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/'))); }catch(_){ return null; } }
