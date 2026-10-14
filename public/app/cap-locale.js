/* app/cap-locale.js — LOCALISATION: language · formats · numerals · calendar · hour cycle · first day · time zone · currency, with the live preview
 * and the staged save — ONE implementation painted in two places (T3-SETTINGS, 2026-10-14; the pattern of cap-shop.js, SET1).
 *
 * MOVED from cap-admin.js (never copied; the workshop's Settings › Localisation calls these same names):
 *   NUMERALS · HOURS · CALS · WEEK · _locSample · _locWithSamples · _locGoto · _locLink · _langsAreDefault · _locName · localeSetCurrency · _locPendingBar ·
 *   localeSettingsHTML · _localeSettingsBody · _locStage · _locReplay · _locPending · localeSaveLocale · localeDiscardLocale · localeSetTz · _locStaged ·
 *   localeSetRegion · localeSetFormat · localeSetNu · localeSetHc · localeSetCa · localeSetFw (and the helpers between them)
 * WIDENED (additively): locRepaint(whole) — the host when CB Settings mounted it, else the workshop's renderApp · _capShowDetail · loadSettings;
 *   _locGoto / _locLink reach the workshop's router only where it exists (no dead arrow on the small app).
 * NEW: CBLocaleSettings.mount(host) — CB Settings › Policy & Localisation, the Localisation half.
 * Host globals (as every cap-*.js): CBLocale · UI (UI._locStage · UI._me) · SESSION · esc · tx · txf · toast · _CARD · _misHead (workshop only) ·
 *   iamGovernedRows (workshop only, guarded where used).
 * Loaded by app.html through CAP_WITH.admin (before cap-admin.js) and by settings.html directly.
 * Flow step: Onboarding · locale (docs/process/flows.json).
 */
'use strict';
/**
 * ⭐ THE LOCALE LABEL TABLES, AT MODULE SCOPE — they were `var`s INSIDE localeSettingsHTML, which made them
 * invisible to the profile. Writing 'Devanagari' a second time over in iamGovernedRows is how the Settings
 * picker and the Profile note start disagreeing about what a code is called: two tables, one meaning, no force
 * keeping them equal. The pickers still read these; nothing else changed for them.
 */
var NUMERALS = [['', 'Follow the format'], ['latn', 'Western'], ['arab', 'Eastern Arabic'], ['deva', 'Devanagari']];
var HOURS    = [['', 'Follow the format'], ['h12', '12-hour'], ['h23', '24-hour']];
var CALS     = [['', 'Follow the format'], ['gregory', 'Gregorian'], ['islamic-umalqura', 'Hijri (Umm al-Qura)'], ['indian', 'Indian national'], ['buddhist', 'Buddhist']];
var WEEK     = [['', 'Follow the format'], ['mon', 'Monday'], ['sun', 'Sunday'], ['sat', 'Saturday']];

/**
 * The short name for a stored code — 'deva' → 'Devanagari'. The tables carry a sample after an em dash
 * ('Devanagari — १२३') because a PICKER should show one; a note beside the value should not repeat digits the
 * reader can already see, so the sample is trimmed here rather than kept in a second table.
 *
 * ⚠️ .find() ON AN ARRAY, not a bracket lookup on an object — no prototype chain to walk past, so an unknown
 * code returns the code itself instead of something truthy from Object.prototype.
 */
/**
 * ⭐⭐ WHAT THIS OPTION WOULD ACTUALLY DO, RENDERED. Athi, 2026-08-21: *"I changed to Indian calendar and the
 * result was Sravana, but I was not aware what Indian calendar means until I saw the result. If you change
 * this control, this is the effect — that has to be spelt then and there explicitly."*
 *
 * ⚠️ 'Indian national' NAMES A STANDARD AND DESCRIBES NOTHING. Nobody picks a calendar from its title; they
 * pick it from the date it produces. Numerals and hour cycle already carried a sample and the calendar list —
 * the one whose options are genuinely unguessable — was the single list without one.
 *
 * ⚠⚠ GENERATED, NOT TYPED, AND THAT IS THE REAL CHANGE. The samples that did exist were hand-written strings:
 * 'Devanagari — १२३' was a CLAIM about what Intl does, maintained by whoever last remembered. These are
 * produced by the same engine that will render the app, against today's date, in the reader's own base locale,
 * so a sample can never promise something the setting does not deliver.
 */
function _locSample(kind, code) {
  if (!code) return '';                       /* 'Follow the format' has no effect of its own to show */
  var base = String((CBLocale.tag ? CBLocale.tag() : 'en') || 'en').split('-u-')[0];
  var now  = new Date();
  try {
    if (kind === 'nu') return new Intl.NumberFormat(base + '-u-nu-' + code).format(12345678.9);
    if (kind === 'hc') return new Intl.DateTimeFormat(base + '-u-hc-' + code,
      { hour: '2-digit', minute: '2-digit' }).format(now);
    if (kind === 'ca') return new Intl.DateTimeFormat(base + '-u-ca-' + code,
      { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  } catch (_) { /* ⚠️ an engine that does not know this extension shows the NAME alone rather than a wrong
                    sample — silence is honest here, a guess is not. */ }
  return '';
}

/** [code, name] → [code, 'name — sample'], for the pickers. One place, so every list gets the same treatment. */
function _locWithSamples(table, kind) {
  return table.map(function (t) {
    var s = _locSample(kind, t[0]);
    return [t[0], s ? t[1] + ' — ' + s : t[1]];
  });
}

/**
 * ⭐⭐ TAKE ME TO THE CONTROL THAT DECIDES THIS. Athi, 2026-08-21: *"bringing the format together, that is
 * good — but if we can see the place where the control is changing, that would be great."*
 *
 * ⚠️ THE TWO LINKS AT THE FOOT OF THE SECTION WERE NOT ENOUGH. 'Language and formats →' lands you on a screen
 * with ten controls on it and leaves you to work out which one produced 30 Sravana. A link that gets you to
 * the right SCREEN has done half the job and taken credit for all of it.
 *
 * ⚠️ THE HIGHLIGHT IS THE POINT, NOT THE NAVIGATION. Scrolling to an element that looks like its nine
 * neighbours leaves the reader hunting anyway, so the control is outlined for a moment when it arrives — long
 * enough to find, short enough not to become part of the design.
 *
 * ⚠️ AFTER A PAINT, NOT BEFORE. setSetSec() re-renders; querying for the element in the same tick finds the
 * OLD screen, or nothing. requestAnimationFrame twice — one to let the render commit, one to let layout settle,
 * because scrollIntoView on an element the browser has not measured yet scrolls to the wrong place.
 */
function _locGoto(testid, sec) {
  if (typeof navTo === 'function') navTo('settings');          /* the workshop's router; CB Settings is already on the section */
  if (typeof setSetSec === 'function') setSetSec(sec || 'locale');
  var tries = 0;
  var find = function () {
    var el = document.querySelector('[data-testid="' + testid + '"]');
    /* ⚠️ A BOUNDED RETRY, NOT A LOOP. The settings body paints asynchronously; if the element never appears
       (a control removed, a testid renamed) this must give up quietly rather than spin — the reader is already
       on the right screen, which is the fallback the old links offered. */
    if (!el) { if (++tries < 20) requestAnimationFrame(find); return; }
    requestAnimationFrame(function () {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { el.scrollIntoView(); }
      var prev = el.style.outline, prevOff = el.style.outlineOffset;
      el.style.outline = '2px solid var(--blue)';
      el.style.outlineOffset = '3px';
      setTimeout(function () { el.style.outline = prev; el.style.outlineOffset = prevOff; }, 2200);
    });
  };
  requestAnimationFrame(find);
  return false;
}

/**
 * The little arrow beside a value: where this one is decided.
 *
 * ⚠️ AN ARROW, NOT A SENTENCE. 'You can change this in Settings › Localisation › Calendar' is eleven words
 * per row on a screen that already measured 56% explanation. The affordance carries the meaning; the title
 * attribute carries the name for anyone who wants it.
 */
function _locLink(label, testid, sec) {
  var Q = String.fromCharCode(39);
  if (typeof setSetSec !== 'function') return '';   /* T3-SETTINGS: the arrow opens another WORKSHOP section; on CB Settings there is none to open — no dead link */
  return ' <a href="#" title="' + esc(label) + '" onclick="return _locGoto(' + Q + testid + Q
    + (sec ? ', ' + Q + sec + Q : '') + ')" style="color:var(--blue);text-decoration:none;font-size:var(--fs-1)">→</a>';
}

/** Are the reader's languages simply what their region hands out, untouched? See the note at its call site. */
function _langsAreDefault() {
  try {
    var mine = (CBLocale.langs && CBLocale.langs()) || [];
    var ri   = CBLocale.regionInfo && CBLocale.regionInfo();
    if (!ri || !ri.langs || !ri.langs.length) return !mine.length;
    return mine.length === 1 && mine[0] === ri.langs[0];
  } catch (_) { return true; }   /* ⚠️ unknown → 'Default'. Claiming a choice nobody made is the worse error. */
}

function _locName(table, code) {
  var row = table.find(function (t) { return t[0] === code; });
  return row ? String(row[1]).split(' — ')[0] : code;
}

/**
 * ⭐⭐ SETTINGS STAGES, IT NO LONGER APPLIES. Athi, 2026-08-21: *"can we create a save button for each section
 * if they are going to change? So it is a deliberate change per item. This will not happen every day, but I
 * believe this will have a larger impact."*
 *
 * ⚠⚠ HE IS RIGHT AND MY FIRST ANSWER WAS TOO NARROW. I had reasoned that these are reader preferences in
 * this browser, instantly visible and instantly reversible, so a Save button would make you commit before you
 * could see the result. The part I left out: every one of them is PUSHED to the account through CBPrefs, so a
 * mis-click does not stay in this browser — it follows the person to every device they sign in on. That is the
 * larger impact, and it makes deliberateness worth more than immediacy.
 *
 * ⭐ SO BOTH, RATHER THAN A TRADE: the card previews the pending choice live, and nothing leaves until Save.
 * The preview works by REPLAYING the staged calls against real storage, rendering, and rolling back — the same
 * code path a save takes, so what you see is what you get rather than a second implementation's guess.
 *
 * ⚠️ AND THE REST OF THE APP KEEPS THE SAVED FORMAT while you are choosing. Only this card previews. A whole
 * screen lurching into Devanagari on the way past a dropdown is the mis-click Athi is describing, not the cure.
 */
/**
 * The pending bar — what is waiting, and the two ways out of it. Absent entirely when nothing is staged, so
 * the screen a reader normally sees is unchanged.
 */
/**
 * ⭐ THE CURRENCY MENU — the region's answer alone at the top, every ISO 4217 code below it.
 *
 * ⚠️ A SUGGESTION IS NOT A FILTER, and the difference is the bug this replaced. Athi, 2026-08-21: *"if the
 * region is selected the currency should be filtered for that region, but otherwise they should be able to set
 * for any currency — the entire table can be showcased."* Both halves matter: floating SGD to the top for a
 * Singapore business saves a scroll through 162 rows; REMOVING the other 161 would recreate the four-currency
 * cap in a nicer costume.
 *
 * ⚠️ THE CURRENT VALUE IS ALWAYS IN THE LIST even when it is neither suggested nor enumerable — an engine
 * without Intl.supportedValuesOf returns null, and a <select> that silently drops what is saved would show the
 * business a currency it does not use and write it on the next save.
 */
function _curPicker(cur) {
  var all  = (CBLocale.currencies && CBLocale.currencies()) || null;
  var mine = (CBLocale.regionCurrencies && CBLocale.regionCurrencies()) || [];
  var top  = mine.slice();
  if (cur && top.indexOf(cur) < 0) top.unshift(cur);        /* what you use is never buried */
  var rest = (all || []).filter(function (c) { return top.indexOf(c) < 0; });
  if (!all) rest = [];                                      /* cannot enumerate → offer what we know, say nothing false */

  var label = function (c) {
    var nm = (CBLocale.currencyName && CBLocale.currencyName(c)) || c;
    return esc(c) + (nm && nm !== c ? ' — ' + esc(nm) : '');
  };
  var optsOf = function (list) {
    return list.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === cur ? ' selected' : '') + '>' + label(c) + '</option>';
    }).join('');
  };

  /* ⚠️ regionInfo(), NOT a regionName() I remembered writing — it does not exist. locale.js exposes the
     whole record; the name is a field on it. */
  var _ri = CBLocale.regionInfo && CBLocale.regionInfo();
  var regionName = (_ri && _ri.name) || CBLocale.region();
  return '<select class="inp" id="loc-cur" style="margin:0;max-width:320px" onchange="localeSetCurrency(this.value)">'
    + (top.length ? '<optgroup label="' + esc(regionName ? tx('Used in') + ' ' + regionName : tx('In use')) + '">'
                    + optsOf(top) + '</optgroup>' : '')
    + (rest.length ? '<optgroup label="' + esc(tx('All currencies')) + '">' + optsOf(rest) + '</optgroup>' : '')
    + '</select>';
}

/**
 * ⚠⚠ THIS ONE WRITES TO THE SERVER, unlike every other setter on this screen — so it must survive a refusal.
 * The API bounds the value by the constitution and answers CURRENCY_NOT_ALLOWED with the permitted set named;
 * showing that message beats a silent revert, which is what a fire-and-forget save would have produced.
 */
async function localeSetCurrency(code) {
  var want = String(code || '').toUpperCase();
  if (!want) return;
  try {
    /* ⚠️ api() TAKES A REGISTERED KEY, NOT A PATH — api('saveProfile', {body}) is the house call; a raw path
       with {method} is a shape this codebase does not have. */
    await api('saveProfile', { body: { currency_code: want } });
    if (typeof SESSION !== 'undefined' && SESSION) SESSION.currency = want;
    UI._me = null; loadProfile();                       /* re-read, exactly as saveProfile does */
    toast(txf('Prices are now written in {cur}', { cur: want }));
  } catch (err) {
    /* ⚠️ PUT THE OLD VALUE BACK ON THE SCREEN. A <select> that keeps showing the refused choice tells the
       reader it was accepted. */
    toast((err && err.message) || tx('That currency could not be set.'), 'err');
    UI._me = null; loadProfile();
  }
}

function _locPendingBar() {
  var st = UI._locStage || [];
  if (!st.length) return '';
  var Q = String.fromCharCode(39);
  var rowOf = function (o) {
    /* ⚠️ THE VALUE AS THE PICKER SHOWS IT, not the raw code. 'ca=indian' is the thing Athi could not read;
       repeating it in the confirmation would repeat the problem at the moment it matters most. */
    var v = o.args[o.args.length - 1];
    var shown = Array.isArray(v) ? (v.length ? v.join(', ') : tx('follow the region'))
      : (o.fn === 'setExt'
          ? (_locName(o.args[0] === 'nu' ? NUMERALS : o.args[0] === 'hc' ? HOURS : o.args[0] === 'ca' ? CALS : WEEK, v)
             + (_locSample(o.args[0], v) ? ' — ' + _locSample(o.args[0], v) : ''))
          : (v || tx('follow the region')));
    return '<div style="display:flex;gap:8px;padding:2px 0">'
      + '<b style="min-width:132px;font-size:var(--fs-1);color:var(--grey);text-transform:uppercase;letter-spacing:.04em">'
      + esc(o.what) + '</b><div style="flex:1;min-width:0">' + esc(shown) + '</div></div>';
  };
  /* ⚠️ A SURFACE MUST NAME ITS TEXT COLOUR. guard-static flagged this: painting a background and letting
     the text inherit means the two themes can disagree — warn-tint is light in both, so dark-mode inherited
     ink would be pale text on a pale panel.

     ⚠️⚠️ AND THIS COMMENT USED TO SIT BETWEEN `return` AND ITS VALUE. A block comment containing a newline
     counts as a line terminator, so AUTOMATIC SEMICOLON INSERTION turned the statement into a bare `return;`
     — the bar below became unreachable, the function returned undefined, and `_locPendingBar() + body`
     rendered the literal word "undefined" at the top of the pane. Nothing threw and nothing logged.

     ⭐ THE UNSAVED-CHANGES BAR WAS THE ONE THING THAT COULD NOT AFFORD TO FAIL SILENTLY: staging still
     worked, so a change was held and never announced. You would edit a setting, see no confirmation, and
     reasonably conclude it had saved. A comment moved one line up is the whole fix. */
  return '<div data-testid="loc-pending" style="position:sticky;top:0;z-index:3;background:var(--warn-tint);color:var(--on-card);'
    + 'border:1px solid var(--warn-2);border-radius:9px;padding:10px 12px;margin-bottom:10px">'
    + '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;'
    + 'color:var(--on-card);margin-bottom:6px">' + tx('Not saved yet') + '</div>'
    + st.map(rowOf).join('')
    + '<div style="display:flex;gap:8px;margin-top:9px">'
    +   '<button class="btn pri" style="flex:1" onclick="localeSaveLocale()">' + tx('Save') + '</button>'
    +   '<button class="btn" style="flex:1" onclick="localeDiscardLocale()">' + tx('Discard') + '</button>'
    + '</div></div>';
}

function localeSettingsHTML(){
  if (!UI._locStage || !UI._locStage.length) return _localeSettingsBody();
  var snap = CBLocale.snapshot();
  /* ⚠️ QUIETLY — a preview that pushed would sync a value nobody chose, and the rollback would be the only
     part that stayed local. See CBLocale.quietly. */
  return CBLocale.quietly(function(){
    /* ⚠️ THE BAR IS BUILT INSIDE THE PREVIEW, so its sample renders in the pending calendar too — a
       confirmation showing today's date in the OLD calendar would be describing what you are leaving. */
    try { _locReplay(); return _locPendingBar() + _localeSettingsBody(); }
    finally { CBLocale.restore(snap); }
  });
}

function _localeSettingsBody(){
  /* ⚠️ THE QUOTE IS BUILT HERE, NOT IN THE SCRIPT THAT WROTE THIS FILE. Third time: BT, then Q in the palette,
     now Q again. A generator-only constant emitted into shipped code PARSES fine and dies at render. The only
     check that catches it is running the function — which is what caught this one, before it shipped. */
  var Q = String.fromCharCode(39);
  var d = CBLocale.describe();

  /* The option lists and the two builders every card below uses. ⚠️ These were lost when the language/format
     blocks were replaced — the render harness caught it immediately, which is the whole reason it exists. */
  var FORMATS = [
    ['', 'Same as region'],
    ['en-IN', 'India — 12,34,56,789.50 (lakh · crore)'],
    ['en-US', 'United States — 123,456,789.50 (million)'],
    ['en-GB', 'United Kingdom — 123,456,789.50'],
    ['de-DE', 'Germany — 123.456.789,50'],
    ['fr-FR', 'France — 123 456 789,50'],
    ['ar-AE', 'UAE — Arabic, Western digits'],
    ['ar-EG', 'Egypt — Arabic, Eastern digits ١٢٣'],
    ['ja-JP', 'Japan — 123,456,789.50']
  ];

  var cur = CBLocale.getExt('locale');   /* CU3: the layer's own read, not a second one of its storage */
  var sel = function(id, list, val, fn){
    return '<select class="inp" data-testid="' + id + '" onchange="' + fn + '(this.value)">'
      /* ⚠️ ESCAPE THE VALUE TOO, not only the label. `o[0]` lands inside `value="…"` — an unescaped quote
         there closes the attribute and everything after it becomes markup. Every list passed here today is
         ours or the engine's, so nothing is exploitable right now; that is precisely why it would survive
         until the day someone passes a list built from stored data, which is one edit away on this screen. */
      + list.map(function(o){ return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('')
      + '</select>';
  };
  var card = function(inner){ return '<div style="' + _CARD + '">' + inner + '</div>'; };
  var line = function(k, v){
    return '<div style="display:flex;gap:10px;padding:4px 0;font-size:var(--fs-2)">'
      + '<span style="min-width:108px;color:var(--grey)">' + k + '</span>'
      + '<b style="color:var(--on-card);min-width:0;word-break:break-word">' + v + '</b></div>';
  };
  /* Working-day chips. ⚠️ ISO numbering (1 = Monday … 7 = Sunday) throughout, because that is what
     Intl.Locale.weekInfo returns — mixing it with Date.getDay()'s 0 = Sunday moves every due date by one. */
  var DAYFULL = { 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thu', 5:'Fri', 6:'Sat', 7:'Sun' };
  var work = CBLocale.workdays();
  var dayChips = [1,2,3,4,5,6,7].map(function(n){
    var on = work.indexOf(n) >= 0;
    return '<button type="button" data-testid="loc-day-' + n + '" onclick="localeToggleWorkday(' + n + ')"'
      + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
      + ' style="cursor:pointer;font:inherit;border-radius:8px;padding:5px 10px;font-size:var(--fs-2);'
      + 'border:1px solid ' + (on ? 'var(--ok)' : 'var(--line)') + ';'
      + 'background:' + (on ? 'var(--ok-tint)' : 'var(--card)') + ';'
      + 'color:' + (on ? 'var(--ok-2)' : 'var(--grey)') + ';font-weight:' + (on ? 700 : 500) + '">'
      + DAYFULL[n] + '</button>';
  }).join('');

  /* ⚠️ The zone list comes from the ENGINE (Intl.supportedValuesOf), not a table we would have to edit twice a
     year. Where the engine will not supply one, a short list beats an empty select. */
  var tzCur = CBLocale.getExt('tz');     /* the override only ('' = the device's zone) — CBLocale.timezone() would fill the default */
  var tzAll = CBLocale.zones();
  /* ⚠️ esc() — the zone comes from localStorage (and, via b165, from a row another device wrote), so it is not
     ours to trust. Every OTHER render of it on this screen was escaped; this one label was not, which is exactly
     how one gets missed: the value LOOKS like a constant because it usually reads "Asia/Kolkata". */
  var tzOpts = [['', 'Follow this device — ' + esc(CBLocale.timezone())]].concat(
    (tzAll.length ? tzAll : ['Asia/Kolkata','Asia/Dubai','Asia/Riyadh','Europe/London','Europe/Berlin','America/New_York','UTC'])
      .map(function(z){ return [z, z.split('/').join(' / ')]; }));

  var myCurCode = (typeof SESSION !== 'undefined' && SESSION && SESSION.currency) || 'INR';
  var wi = CBLocale.weekInfo() || {};
  var DAY = { 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thu', 5:'Fri', 6:'Sat', 7:'Sun' };
  var weekend = (wi.weekend || []).map(function(x){ return DAY[x] || x; }).join(' + ') || '—';

  /**
   * ⭐⭐ PRESENTATION AND LANGUAGE ARE NOW TWO SEPARATE CHOICES, AND THE FIRST BOUNDS THE SECOND.
   *
   * Athi, 2026-08-18: *"under locale, we have to split presentation style and languages separately… if the
   * language and the style contradicts then it will be a problem, so we have to specify, for this style, these
   * are the languages compatible out of which you can choose say two or three max."*
   *
   * ⚠️ Before this the screen offered four language buttons and nine formats as independent lists — 36
   * combinations, most of which no reader on earth wants. Arabic words with lakh grouping and a Buddhist
   * calendar was two clicks away and nothing said it was wrong.
   */
  var d = CBLocale.describe();
  var region = CBLocale.region();
  var chosen = CBLocale.langs();
  var allowed = CBLocale.allowedLangs();

  var regionOpts = [['', 'Not set — show me everything']].concat(
    Object.keys(CBLocale.REGIONS).map(function (k) {
      var r = CBLocale.REGIONS[k];
      return [k, r.name + ' — ' + r.format + ' · ' + r.langs.slice(0, 4).map(function (x) { return CBLocale.langName(x); }).join(', ')
        + (r.langs.length > 4 ? ' …' : '')];
    }));

  /**
   * ⚠️ A LANGUAGE IS A TOGGLE IN AN ORDERED LIST, NOT A RADIO. RFC 4647 calls this a language priority list —
   * "I read Tamil, then English, then Hindi" — and the ORDER is what decides which version of a catalogue a
   * reader is shown when several exist. So each chosen language carries its rank, visibly.
   */
  var langChips = allowed.map(function (code) {
    var at = chosen.indexOf(code);
    var on = at >= 0;
    var full = !on && chosen.length >= CBLocale.MAX_LANGS;
    return '<button type="button" data-testid="loc-lang-' + code + '"'
      + ' onclick="localeToggleLang(' + Q + code + Q + ')"'
      + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
      + (full ? ' disabled' : '')
      + ' style="border:1px solid ' + (on ? 'var(--blue)' : 'var(--line)') + ';'
      + 'background:' + (on ? 'var(--blue-tint-bg)' : 'var(--card)') + ';'
      + 'color:' + (on ? 'var(--blue)' : (full ? 'var(--grey-4)' : 'var(--on-card)')) + ';'
      + 'opacity:' + (full ? '.5' : '1') + ';cursor:' + (full ? 'not-allowed' : 'pointer') + ';'
      + 'border-radius:9px;padding:5px 11px;font-size:var(--fs-2);font-weight:' + (on ? 700 : 500) + ';margin:0 6px 6px 0">'
      + (on ? '<b style="font-family:\'Space Mono\',monospace">' + (at + 1) + '</b> ' : '')
      + esc(CBLocale.langName(code)) + '</button>';
  }).join('');

  return (typeof _misHead === 'function' ? _misHead('Localisation', '') : '')   /* the workshop's pane head; CB Settings draws its own (CBLocaleSettings) */

    /* ── 1 · PRESENTATION ───────────────────────────────────────────────────────────────────────────────── */
    + card('<label class="fl">Presentation <span style="font-weight:400;color:var(--grey)">— how figures are written</span></label>'
        + sel('loc-region', regionOpts, region, 'localeSetRegion')
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px;line-height:1.55">'
        + 'A region sets the number, money, date and time conventions <b>and the languages it makes sense to read '
        + 'in</b>. Choosing one prunes any language it does not admit, rather than leaving a combination that '
        + 'contradicts itself.<br>'
        + '⚠️ <b>' + tx('Grouping is not a separate switch, and that is deliberate.') + '</b> Millions or lakhs is a property of '
        + 'the region itself — CLDR knows India groups 12,34,56,789 and the US groups 123,456,789. Offering it '
        + 'apart would let you pick a combination no locale on earth uses.'
        + '</div>')

    + card('<label class="fl">Or a format directly <span style="font-weight:400;color:var(--grey)">— if no region fits</span></label>'
        + sel('loc-format', FORMATS, cur, 'localeSetFormat'))

    /* ── 2 · LANGUAGES ──────────────────────────────────────────────────────────────────────────────────── */
    + card('<label class="fl">Languages you read <span style="font-weight:400;color:var(--grey)">— up to ' + CBLocale.MAX_LANGS + ', in order</span></label>'
        + '<div style="margin:4px 0 6px">' + langChips + '</div>'
        + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.55">'
        + 'The <b>order matters</b>. When a catalogue exists in more than one language you are shown the highest '
        + 'one on this list that its author actually wrote. This is a <b>language priority list</b> (RFC 4647) — '
        + 'the same thing your browser sends every website as <code>' + tx('Accept-Language') + '</code>.'
        + (region ? '' : '<br>⚠️ No region set, so every language we name is offered. Pick a region above to see only the ones that fit.')
        + '</div>')

    /* ⚠️⚠️ THE RULE THAT MATTERS MOST ON THIS SCREEN, RAISED FROM A FOOTNOTE TO ITS OWN CARD. Athi, twice:
       *"the panel and content in the panel, catalogue should stay in the language the origin is, no direct
       conversion at all."* Everything above chooses BETWEEN versions a human wrote. Nothing here produces text
       no human wrote, and that boundary is the reason a chit can be a shared record at all. */
    + '<div style="' + _CARD + ';border-color:var(--warn-tint);background:var(--warn-tint);color:var(--on-card)">'
    +   '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--warn-2);margin-bottom:5px">' + tx('Content is never converted') + '</div>'
    +   '<div style="font-size:var(--fs-2);line-height:1.6">'
    +   'These settings change the <b>chrome</b> — labels, buttons, and how figures are written. They never touch '
    +   'what people wrote. A product name, a catalogue entry, a chit subject, a message and a dispute reason stay '
    +   'in the language their author used.<br>'
    +   '<b>' + tx('Choosing a language picks between versions a human wrote — it does not translate anything.') + '</b> '
    +   'A chit is a shared record, and one that read differently to each party would not be a record.'
    +   '</div>'
    + '</div>'

    + card('<label class="fl">Numbering system <span style="font-weight:400;color:var(--grey)">— <code>-u-nu-</code></span></label>'
        + sel('loc-nu', _locWithSamples(NUMERALS, 'nu'), CBLocale.getExt('nu'), 'localeSetNu'))

    + card('<label class="fl">Hour cycle <span style="font-weight:400;color:var(--grey)">— <code>-u-hc-</code></span></label>'
        + sel('loc-hc', _locWithSamples(HOURS, 'hc'), CBLocale.getExt('hc'), 'localeSetHc'))

    + card('<label class="fl">Calendar <span style="font-weight:400;color:var(--grey)">— <code>-u-ca-</code></span></label>'
        + sel('loc-ca', _locWithSamples(CALS, 'ca'), CBLocale.getExt('ca'), 'localeSetCa'))

    + card('<label class="fl">First day of week <span style="font-weight:400;color:var(--grey)">— <code>-u-fw-</code></span></label>'
        + sel('loc-fw', WEEK, CBLocale.getExt('fw'), 'localeSetFw')
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:7px;line-height:1.55">'
        + 'Which column a calendar starts on. Separate from which days you actually <i>work</i> — that is below.'
        + '</div>')

    /* ══ WORKING DAYS ═══════════════════════════════════════════════════════════════════════════════════════
     * ⚠️⚠️ LOAD-BEARING, NOT A PREFERENCE. "Due in three working days" lands on a different DATE depending on
     * this, and until now the app had no idea. CLDR supplies the region's answer; a business overrides it
     * because a shop that opens on Sunday is a fact, not an error to be corrected. */
    + card('<label class="fl">Working days <span style="font-weight:400;color:var(--grey)">— what a due date counts</span></label>'
        + '<div data-testid="loc-workdays" style="display:flex;gap:5px;flex-wrap:wrap;margin:5px 0 7px">' + dayChips + '</div>'
        + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.55">'
        + (CBLocale.hasWorkdayOverride()
            ? 'You have set these yourself. <a href="#" onclick="localeResetWorkdays();return false" data-testid="loc-workdays-reset" style="color:var(--blue)">' + tx('Use the regional default') + '</a> instead.'
            : 'These come from <b>' + tx('CLDR') + '</b> for your region — ' + esc(weekend) + ' is the weekend here. Tap a day to override.')
        + '<br>⚠️ <b>' + tx('The weekend is not Saturday and Sunday everywhere.') + '</b> Saudi Arabia\'s is Friday + Saturday; '
        + 'India\'s is Sunday alone; the UAE moved to Saturday + Sunday in 2022. Any due date counted in '
        + '<i>working</i> days lands on a different day in Riyadh, Mumbai and Berlin.'
        + '</div>')

    /* ══ TIME ZONE ══════════════════════════════════════════════════════════════════════════════════════════
     * ⚠️ One immutable event, three different answers to "when did this happen", because every date was rendered
     * in whatever zone the browser happened to be in. */
    + card('<label class="fl">' + tx('Time zone') + '</label>'
        + sel('loc-tz', tzOpts, tzCur, 'localeSetTz')
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px;line-height:1.55">'
        + 'Now showing times in <b>' + esc(CBLocale.timezone()) + '</b>. '
        + 'A chit stamped 19:00 in Dubai reads 20:30 in Mumbai and 16:00 in London — the same instant, three '
        + 'answers. Leave this on your device unless you want your <i>business\'s</i> clock wherever you are.'
        + '</div>')

    /* ══ CURRENCY ═══════════════════════════════════════════════════════════════════════════
     * ⭐⭐ THE CONTROL LIVES HERE NOW — IT USED TO POINT AT THE PROFILE, AND THE PROFILE POINTED BACK. Athi,
     * 2026-08-21: *"why have we brought the currency to choose in profile? Let it be in settings only."* His
     * rule from the day before decides it: Settings changes, Profile shows.
     *
     * ⚠️ THIS IS THE ONE CONTROL ON THIS SCREEN THAT IS NOT YOURS. Everything else in Localisation is a reader
     * preference in this browser's storage; currency is a column on the business and changes what every
     * colleague and every counterparty sees. So it is gated to the entity and says whose it is — an employee
     * reads it, and reading is the correct amount of power over a company's trading currency.
     *
     * ⚠️ THE LIST IS GROUPED, NOT DUMPED. Athi, 2026-08-21: *"a small list is always good, human brain
     * cannot take multiple things in one go."* 162 codes in one flat menu is the failure he is describing, so
     * the region's own currency sits alone at the top and the rest are one <optgroup> below it — a list of one
     * for the answer that is almost always right, with everything still reachable.
     */
    + card('<label class="fl">' + tx('Currency') + '</label>'
        + '<div data-testid="loc-currency" style="font-size:var(--fs-2);line-height:1.6;color:var(--on-card)">'
        + (profCanEdit() ? _curPicker(myCurCode)
           : '<b>' + esc(myCurCode) + ' ' + esc(CBLocale.symbol(myCurCode)) + '</b> · '
             + '<span style="color:var(--grey)">' + tx('set by the business') + '</span>')
        + '<div style="margin-top:7px;color:var(--grey)">' + tx('Your prices are written in this.') + ' '
        + esc(CBLocale.money(123456.5, myCurCode)) + '</div>'
        + '<div style="margin-top:7px;color:var(--warn-2)">⚠️ ' + tx('Amounts are never converted.') + ' '
        + '<span style="color:var(--grey)">' + tx('A supplier quoting in USD stays') + ' '
        + esc(CBLocale.money(123456.5, 'USD')) + '.</span></div>'
        + '</div>')

    /* THE PREVIEW — see the note on this function. Every control above is an abstraction; this is the only place
       the choice becomes visible before it is made. */
    + '<div style="' + _CARD + ';background:var(--neutral-tint);color:var(--on-card)" data-testid="loc-preview">'
    +   '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:6px">' + tx('How this looks') + '</div>'
    +   line('Number', esc(CBLocale.number(123456789.5)))
    +   line('Money', esc(CBLocale.money(123456.5, 'INR')) + ' &nbsp;·&nbsp; ' + esc(CBLocale.money(123456.5, 'USD')))
    +   line('Date', esc(CBLocale.date(Date.now())))
    +   line('Time', esc(CBLocale.time(Date.now())))
    +   line('Sorting', esc(CBLocale.sort(['Zebra','Ähnlich','apple','Ökonom','banana']).join(' · ')))
    +   line('Direction', d.dir === 'rtl' ? 'right to left ←' : 'left to right →')
    +   line('Locale tag', '<code>' + esc(CBLocale.tag()) + '</code>')
    + '</div>'

    + card('<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:5px">' + tx('What is never translated') + '</div>'
        + '<div style="font-size:var(--fs-2);line-height:1.55;color:var(--on-card)">'
        + 'Product names, chit subjects, message text and dispute reasons stay in the words their author wrote. '
        + '<b>' + tx('A chit is a shared record') + '</b> — one that read differently to each party would not be a record.</div>');
}
/** Choosing a region sets the format AND prunes languages it does not admit — see the note in locale.js. */
/**
 * ⭐⭐ NOTHING APPLIES UNTIL SAVE. Athi, 2026-08-21: *"can we create a save button for each section if they
 * are going to change? So it is a deliberate change per item. This will not happen every day, but I believe
 * this will have a larger impact."*
 *
 * ⚠⚠ I FIRST ARGUED AGAINST THIS AND THE ARGUMENT HAD A HOLE. My reasoning was that these are reader
 * preferences in this browser — instantly visible, instantly reversible — so a Save button would make you
 * commit before you could see the result. What I left out is that every one of them is PUSHED to the account
 * through CBPrefs. A mis-click does not stay in this browser; it follows the person to every device they sign
 * in on. That is the larger impact, and it outweighs immediacy.
 *
 * ⭐ SO BOTH, RATHER THAN A TRADE. The card previews the pending choice live — you still see the date before
 * you keep it — and nothing leaves until Save.
 *
 * ⚠️ ONE BAR NAMING EVERY PENDING ITEM, NOT ONE BUTTON PER CARD. These controls are not independent:
 * choosing a region PRUNES languages it does not admit. A Save button on the Region card that committed only
 * the region would be claiming a separation the data does not have — and one that committed the language loss
 * too would be doing something its label did not say. The bar lists each pending change by name, which is the
 * per-item deliberateness Athi asked for, without inventing an independence these settings do not have.
 */
/**
 * ⭐ ONE STAGED CHANGE. The control does not apply — it records what it WOULD do, and the card repaints
 * showing that. Nothing reaches storage or the account until Save.
 *
 * ⚠️ OPERATIONS, NOT VALUES. setRegion() prunes languages the region does not admit; setWorkdays() refuses
 * to empty the week. Staging the VALUE and writing it at Save would skip those rules, so the preview would
 * show one outcome and the save produce another. Replaying the CALL is the only way the two agree.
 *
 * ⚠️ LAST WRITE PER CONTROL WINS. Picking three regions in a row must stage one change, not three — and a
 * replay of all three would be slower and, for setRegion, would prune against the intermediate ones.
 */
function _locStage(what, fn, args) {
  UI._locStage = (UI._locStage || []).filter(function (o) {
    /* setExt is four controls sharing one function — they are the same control only if the subtag matches. */
    return o.fn !== fn || (fn === 'setExt' && o.args[0] !== args[0]);
  });
  UI._locStage.push({ what: what, fn: fn, args: args });
  locRepaint();          /* ⚠️ the CARD repaints; renderApp() deliberately does not run — see the wrapper. */
}

function _locReplay() {
  (UI._locStage || []).forEach(function (o) { CBLocale[o.fn].apply(CBLocale, o.args); });
}

/** What is waiting, named — so the Save button can say what it is about to do. */
function _locPending() {
  var seen = [];
  (UI._locStage || []).forEach(function (o) { if (seen.indexOf(o.what) < 0) seen.push(o.what); });
  return seen;
}

/**
 * ⚠️ UNDO SURVIVES THE SAVE, and it is not redundant with staging. Staging stops the ACCIDENT — a stray
 * click on a dropdown. Undo covers the DELIBERATE change that turned out wrong once you saw the whole app in
 * it. Different mistakes, different moments.
 */
function localeSaveLocale() {
  var pending = _locPending();
  if (!pending.length) return;
  var before = CBLocale.snapshot();
  _locReplay();
  UI._locStage = [];
  locRepaint(true);
  toast(txf('{what} saved', { what: pending.join(', ') }), function () {
    CBLocale.restore(before);
    locRepaint(true);
    toast(txf('{what} put back', { what: pending.join(', ') }));
  });
}

function localeDiscardLocale() {
  if (!(UI._locStage || []).length) return;
  UI._locStage = [];
  locRepaint();
  toast(tx('Nothing was changed.'));
}

function localeSetTz(v){ _locStage(tx('Time zone'), 'setTimezone', [v]); }
/**
 * ⚠️ THE LAST WORKING DAY CANNOT BE REMOVED. A business with no working days has no due dates at all, and every
 * SLA calculation would divide by an empty week — a state the UI should refuse rather than the maths discover.
 */
/**
 * ⚠⚠ A TOGGLE READS BEFORE IT WRITES, SO IT MUST READ THE STAGED LIST. CBLocale.workdays() and .langs()
 * return what is SAVED. Untick Saturday, then untick Friday: the second call would still see Saturday and
 * hand it back, so the first click would silently undo itself. The single-value pickers escape this because
 * they overwrite; a toggle accumulates, and accumulating onto a stale base loses every click but the last.
 */
function _locStaged(fn, live) {
  var last = null;
  (UI._locStage || []).forEach(function (o) { if (o.fn === fn) last = o; });
  return last ? last.args[0].slice() : live();
}

function localeToggleWorkday(n){
  var cur = _locStaged('setWorkdays', function(){ return CBLocale.workdays(); }), at = cur.indexOf(n);
  if (at >= 0) { if (cur.length > 1) cur.splice(at, 1); } else cur.push(n);
  _locStage(tx('Working days'), 'setWorkdays', [cur]);
}
/** Clearing the override returns to CLDR's answer for the region — not to a hardcoded Mon–Fri. */
function localeResetWorkdays(){ _locStage(tx('Working days'), 'setWorkdays', [[]]); }
function localeSetRegion(v){ _locStage(tx('Region'), 'setRegion', [v]); }
/**
 * ⚠️ APPEND, DO NOT REPLACE — the list is ORDERED and the order is the feature. Toggling a language on puts it
 * last (lowest priority); toggling it off closes the gap. Reordering by re-selecting is a smaller, separate
 * design problem, and pretending a toggle could express rank would have made the order silently arbitrary.
 * ⚠️ The last remaining language cannot be removed: a reader with no languages matches nothing at all.
 */
function localeToggleLang(code){
  var cur = _locStaged('setLangs', function(){ return CBLocale.langs(); }), at = cur.indexOf(code);
  if (at >= 0) { if (cur.length > 1) cur.splice(at, 1); }
  else if (cur.length < CBLocale.MAX_LANGS) cur.push(code);
  _locStage(tx('Languages'), 'setLangs', [cur]);
}
function localeSetFormat(v){ _locStage(tx('Format'), 'setLocale', [v]); }
/* One handler shape per subtag — each re-renders so the preview above moves with the choice. */
function localeSetNu(v){ _locStage(tx('Numbering system'), 'setExt', ['nu', v]); }
function localeSetHc(v){ _locStage(tx('Hour cycle'), 'setExt', ['hc', v]); }
function localeSetCa(v){ _locStage(tx('Calendar'), 'setExt', ['ca', v]); }
function localeSetFw(v){ _locStage(tx('First day of week'), 'setExt', ['fw', v]); }

/* ── CB SETTINGS › POLICY & LOCALISATION — the Localisation half, mounted by the page under the policy card (T3-SETTINGS) ────────────────── */
var CBLocaleSettings = (function () {
  var H = { el: null };
  function active(){ return !!(H.el && H.el.isConnected); }
  function paint(){
    if (!active()) return;
    H.el.innerHTML = '<div class="sec" data-testid="loc-title" style="margin-top:18px">' + esc(tx('Localisation')) + '</div>' + localeSettingsHTML();
  }
  function mount(host){ H.el = document.createElement('div'); H.el.setAttribute('data-testid', 'loc-screen'); host.appendChild(H.el); paint(); }
  return { mount: mount, paint: paint, active: active };
})();
/** the pane this module paints: CB Settings' host when mounted; else the workshop — the card (loadSettings), or the whole app when `whole` */
function locRepaint(whole){
  if (CBLocaleSettings.active()) return CBLocaleSettings.paint();
  if (whole && typeof renderApp === 'function') { renderApp(); if (typeof _capShowDetail === 'function') _capShowDetail(); }
  if (typeof loadSettings === 'function') loadSettings();
}
