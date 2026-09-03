/**
 * app/cap-catsetup.js — CATALOGUE SETUP: how the catalogue is SHAPED (lazy; ensureCap('catsetup')).
 *
 * Athi, 2026-08-16: *"i think we are clubbing product management and catalogue management in one roof, so it is
 * confusing… another tab called catalogue mgmt … so it is a clear segregation."* He was right, and the standard
 * agrees with him.
 *
 * ── WHAT THE STANDARD SEPARATES (Akeneo / PIM, the exemplar this catalogue already adopted) ────────────────────
 * A PIM keeps four jobs apart, and we had merged all four into one toolbar:
 *   · PRODUCTS      — the records you edit daily                       → stays on Catalogue
 *   · CATEGORIES    — classification. MANY per product                 → its own screen (cap-categories)
 *   · FAMILIES /
 *     ATTRIBUTES    — the template describing a product. ZERO OR ONE   → here, as "Columns"
 *   · PRODUCT MODEL — variant axes, common vs variant attributes       → here, as "Variants"
 *   · IMPORT/EXPORT — job profiles, not toolbar buttons                → here
 *
 * ⭐ THE DISTINCTION THAT MATTERS: **categories classify, families describe.** Many categories per product, one
 * family. Treating them as one undifferentiated notion of "catalogue structure" is exactly what made the screen
 * confusing — and it is why Categories is a sibling of Catalogue rather than a section of this screen.
 *
 * ⚠️ THIS SCREEN OWNS NO LOGIC. Every action here already existed on the Catalogue toolbar and is called
 * unchanged (declareVariants · startFromStandardSet · checkCatalogueFile · downloadCatalogueTemplate ·
 * exportCatalogueCSV · the face wizard). Moving a control must not become rewriting it — the point of the change
 * is WHERE things live, and a re-implementation would smuggle behaviour changes in under a re-organisation.
 */
/* ⭐ OPENS ON BLUEPRINT, not Columns — the fastest way in is the one a reader should meet first. Someone with
   no blueprint for their trade reads one card and moves down the rail; someone with one is already there. */
var CATSET = { sec: 'blueprint' };

var CATSET_SECS = [
  /* ⭐⭐ FIRST, because adopting a published catalogue sets the columns, the units and the shape in ONE act.
     Athi: 'if the user can use the prototype ie blueprint, that sets everything… if not then go step by step.'
     Everything below this line IS the step-by-step, and the order says so. */
  { key: 'blueprint', icon: '📋', name: 'Blueprint',        q: 'Copy a working catalogue' },
  { key: 'columns',  icon: '📐', name: 'Columns',          q: 'What every product records' },
  { key: 'variants', icon: '🔗', name: 'Variants',         q: 'One product, several sizes' },
  /**
   * ⭐ OFFERS LIVE HERE TOO (Athi, 2026-08-16: *"offers can also bring it here"*).
   *
   * ⚠️ AND THEY ARE NOT A PIM CONCEPT — worth saying so rather than quietly filing them under "catalogue". A PIM
   * describes what a product IS; an offer is a TERM OF TRADE about an order, evaluated at checkout, with a
   * validity window and a jurisdiction (see SPEC-offers-tax.md). Akeneo would not carry this at all.
   *
   * It belongs here anyway, for the reason that decides every one of these placements: this is the screen you
   * are on when you are setting up how you SELL, and an offer is authored once and then left alone — exactly the
   * rhythm of the other sections, and nothing like the rhythm of the product list.
   */
  { key: 'offers',   icon: '🏷️', name: 'Offers',           q: 'Discounts, tiers and deals' },
  /* ⭐ PRICING IS ITS OWN SECTION (Athi's call). Pricing models and price SOURCES belong together and are
     neither a column nor a storefront setting: one says how a price is arrived at, the other where it was read
     from and when. Price provenance is close to the traceability story, so it is named rather than buried. */
  { key: 'pricing',  icon: '💱', name: 'Pricing',          q: 'How a price is arrived at' },
  /* ⭐ ORDER MODELS BELONG HERE FOR THE SAME REASON VARIANTS DO — "Carton of 6" is a quantity RULE a product
     adopts, i.e. part of how the catalogue is shaped, not a product record. It was in Definitions only because
     everything definition-backed was. */
  { key: 'ordermodels', icon: '🔢', name: 'Order models',  q: 'Carton of 6, sold by the metre' },
  { key: 'data',     icon: '⇅',  name: 'Import & export',  q: 'Spreadsheets in and out' },
  /* ⭐ Beside Import & export, because all three answer the same question — how does this catalogue meet
     another system — and a reader who wants one usually wants the next. */
  { key: 'erp',      icon: '🔌', name: 'Other systems',   q: 'ERP · Tally · SAP field names' },
  { key: 'tax',      icon: '🧾', name: 'Tax',              q: 'The treatment you declare' },
  { key: 'face',     icon: '🛍️', name: 'Storefront',       q: 'How customers order from you' },
];
/**
 * ⚠️ ONE LOADER FOR EVERY DEFINITION KIND THIS SCREEN HOSTS, keyed by kind. Offers and order models are the same
 * shape of thing — a named, versioned rule a product or an order adopts — so they get one reader, not two that
 * drift. `all=1` because this is the MANAGEMENT view: retired ones must be visible, or someone re-creates
 * something they already withdrew. Compose asks for live only; that difference is the point of having a screen.
 */
var CATSET_DEFS = {}, _catsetDefReq = {};
function catsetDefsLoad(kind, force){
  if (!force && CATSET_DEFS[kind]) return Promise.resolve(CATSET_DEFS[kind]);
  if (!force && _catsetDefReq[kind]) return _catsetDefReq[kind];
  _catsetDefReq[kind] = api('defList', { query: { kind: kind, all: 1 } })
    .then(function(r){
      CATSET_DEFS[kind] = ((r && r.definitions) || []).map(function(d){
        return { id: d.definition_id, name: d.name, sub: d.sub_kind || '', status: d.status || 'draft',
                 note: d.note || '', rules: d.rules || {} };
      });
      _catsetDefReq[kind] = null; return CATSET_DEFS[kind];
    })
    .catch(function(){ _catsetDefReq[kind] = null; return (CATSET_DEFS[kind] = []); });
  return _catsetDefReq[kind];
}
/* ⚠️ REUSES THE DEFINITIONS FORM. cbDefNew/cbDefEdit already know every kind and its conditions, read straight
   from the registries (offers.js KINDS, cart-ui MODELS). A second form here would drift from the engine within a
   release — the same reason catalogue-ui delegates its category chips instead of copying them. */
function catsetDefNew(kind){ ensureCap('definitions').then(function(){ cbDefNew(kind); }); }
function catsetDefEdit(kind, id){ ensureCap('definitions').then(function(){ cbDefEdit(id); }); }
function catsetDefRetire(kind, id, name){
  ensureCap('definitions').then(function(){
    cbDefRetire(id, name);
    /* The list here is a second reader of the same shelf, so it has to be told. */
    setTimeout(function(){ catsetDefsLoad(kind, true).then(catsetPaintDetail); }, 900);
  });
}
/** The shared list body for a definition-backed section. */
function catsetDefListHTML(kind, one){
  var rows = CATSET_DEFS[kind];
  if (rows === undefined) { catsetDefsLoad(kind).then(catsetPaintDetail); return '<div class="catset-load">reading…</div>'; }
  if (!rows.length) return '<div class="catset-none">None yet.</div>';
  var live = rows.filter(function(d){ return d.status !== 'retired'; });
  var ret  = rows.filter(function(d){ return d.status === 'retired'; });
  var row = function(d){
    return '<div class="catset-drow' + (d.status === 'retired' ? ' ret' : '') + '" data-testid="catset-' + kind + '-' + esc(d.id) + '">'
      + '<span class="dn">' + esc(d.name) + '</span>'
      + (d.sub ? '<code class="dk">' + esc(d.sub) + '</code>' : '')
      + '<span class="dst ' + esc(d.status) + '">' + esc(d.status) + '</span>'
      + (d.status === 'retired' ? ''
          : '<span class="da" onclick="catsetDefEdit(\'' + kind + '\',\'' + esc(d.id) + '\')">' + tx('Edit') + '</span>'
            + '<span class="da" onclick="catsetDefRetire(\'' + kind + '\',\'' + esc(d.id) + '\',\'' + esc(String(d.name).replace(/'/g, '')) + '\')">' + tx('Retire') + '</span>')
      + '</div>';
  };
  /**
   * ⚠️⚠️ ORPHANS ARE SURFACED, NEVER SILENTLY BROKEN (backlog 18). Narrowing a catalogue's selling method
   * strands any order model already using a kind the new method cannot sell. Those definitions still exist and
   * still work on lines that reference them — so the honest move is to SAY SO, not to hide them from the list
   * (which would read as "deleted") and not to rewrite them (which would change what a product means without
   * anyone asking).
   * ⚠️ This REPORTS. It does not enforce, and deciding what should happen to an orphan is a product call that
   * has deliberately not been made here.
   */
  var orphanNote = '';
  if (kind === 'ordermodel' && typeof CBCatalogue !== 'undefined' && CBCatalogue.orphanModels) {
    var meth = (typeof UI !== 'undefined' && UI.catf && UI.catf.method) || null;
    var used = live.map(function(d){ return d.sub; }).filter(Boolean);
    var orph = meth ? CBCatalogue.orphanModels(meth, used) : [];
    if (orph.length) {
      var uniq = orph.filter(function(v, i){ return orph.indexOf(v) === i; });
      orphanNote = '<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;font-size:var(--fs-1);color:var(--warn-3);margin-bottom:9px">'
        + '⚠️ <b>' + uniq.length + ' order model' + (uniq.length === 1 ? '' : 's') + ' this catalogue can no longer sell</b> — '
        + uniq.map(function(x){ return '<code>' + esc(x) + '</code>'; }).join(' · ')
        + '. A <b>' + esc(meth) + '</b> catalogue does not support ' + (uniq.length === 1 ? 'it' : 'them') + '. '
        + 'They still work on products that already use them; nothing has been changed or removed. '
        + 'Either change the selling method back, or move those products onto a supported model.</div>';
    }
  }
  return orphanNote + '<div class="catset-dlist">' + live.map(row).join('') + ret.map(row).join('') + '</div>';
}

function catsetSec(){ return CATSET.sec || 'blueprint'; }
function catsetSetSec(k){
  CATSET.sec = k;
  if (UI.vp === 'mob') { UI.mdetail = true; var p = document.getElementById('panel'); if (p) p.classList.add('showdetail'); }
  catsetPaint();
}
function catsetBack(){ UI.mdetail = false; var p = document.getElementById('panel'); if (p) p.classList.remove('showdetail'); }

/**
 * ⭐ THE VOCABULARY BLOCKS — rehomed from Definitions, NOT copied out of it.
 *
 * Athi, 2026-08-16: *"before dropping find home for all the items we have got it here, once it gets the home,
 * then we can drop it."* So each of the nine read-only registry sections now renders under the control it
 * describes, and Definitions can go.
 *
 * ⚠️ THE ROWS STILL COME FROM `cbDefRegistries()`, which still reads the live registries (cart-ui MODELS,
 * offers.js KINDS, catalogue-model UNITS/DATATYPES/METHODS/FACETS/PRICING_MODELS/PRICE_ORIGIN). Re-listing any of
 * them here would create a second statement of what the system supports, and the second one is always the one
 * that goes stale. Add a unit to catalogue-model tomorrow and it appears here with no edit to this file — the
 * same discipline Definitions itself was built on.
 *
 * ⚠️ VISIBLE, NOT FOLDED — Athi asked for that explicitly. Someone meeting "tiered pricing" for the first time
 * should not have to know to expand something to find out what the options are.
 */
function catsetRegistry(keys){
  if (typeof cbDefRegistries !== 'function') {
    ensureCap('definitions').then(function(){ catsetPaintDetail(); });
    return '<div class="catset-load">reading the registry…</div>';
  }
  var all = cbDefRegistries(), want = {};
  keys.forEach(function(k){ want[k] = 1; });
  var secs = all.filter(function(s){ return want[s.key]; });
  if (!secs.length) return '';
  return secs.map(function(s){
    var rows = s.rows || [];
    /**
     * ⭐ TICK WHAT THIS ENTITY ACTUALLY USES (Athi, 2026-08-17: *"also the check box wherever required, so those
     * only can be used in the catalogue"*). The registry in code is the MAXIMUM; the ticks are this entity's
     * slice, and every picker downstream offers only the slice.
     *
     * ⚠️ ONLY WHERE A CHOICE CAN MEAN SOMETHING — see CATSET_SELECTABLE. `method` is ONE per catalogue, so a set
     * would imply you can have several; `ordermodel` is already narrowed by the selling method (backlog 18) and a
     * second, independent narrowing could disagree with the first with nothing on screen to say which won. A
     * checkbox that cannot mean anything is worse than no checkbox.
     */
    var flag = CATSET_SELECTABLE[s.key];
    var sel = flag ? _CATSEL[flag] : null;
    if (flag && sel === undefined) { catsetSelLoad(); }
    var picked = Array.isArray(sel) ? sel : null;
    var n = picked ? picked.length : rows.length;
    return '<div class="catset-reg">'
      + '<div class="catset-regh">' + s.icon + ' ' + esc(s.title)
      +   '<span class="catset-regn">' + (picked ? n + ' / ' + rows.length : rows.length) + '</span></div>'
      + '<div class="catset-regb">' + esc(s.blurb)
      +   (flag ? ' <b>' + tx('Tick the ones you use') + '</b> — only those are offered when you build a catalogue.' : '')
      + '</div>'
      + (rows.length
          /* ⚠️ DO NOT PRINT THE CODE TWICE. Some registries have no separate code — `UNITS` maps to
             `{code:u, label:u}` because a unit IS its own name — so every row rendered "kg kg", "gram gram",
             "litre litre". Fifteen of those reads as a rendering fault, and it makes the reader look for a
             distinction that does not exist. Show the code only where it actually differs from the label. */
          /* Bare words → chips; anything with a code or a note keeps its rows. See the `.chips` rule. */
          /**
           * ⭐ TWO LINES, NOT THREE COLUMNS (Athi, 2026-08-17: *"align properly and any information regarding the
           * particular field can be mentioned below, so it is easier to read"*).
           *
           * ⚠️ The note was a third column competing for the same row, so a long one squeezed the label and a
           * short one left a gap — nothing lined up down the page. Line 1 is the identity (code + name) on a
           * fixed grid so every code and every name align; line 2 is the explanation, indented under the name
           * and in its own colour so the eye can skip it or read it, but never confuse it with a name.
           */
          ? '<div class="catset-regrows' + (rows.every(function(r){
              return !r.note && String(r.code || '') === String(r.label || '');
            }) ? ' chips' : '') + '">' + rows.map(function(r){
              var same = String(r.code || '') === String(r.label || '');
              var on = picked ? picked.indexOf(String(r.code)) >= 0 : true;
              var tag = flag ? 'label' : 'div';
              return '<' + tag + ' class="catset-regrow' + (same ? ' nocode' : '') + (flag ? ' pick' : '') + (on ? '' : ' off') + '">'
                + '<div class="rr1">'
                +   (flag ? '<input type="checkbox" ' + (on ? 'checked' : '')
                          + ' onchange="catsetSelToggle(\'' + esc(flag) + '\',\'' + esc(r.code) + '\',this.checked)">' : '')
                +   (same ? '' : '<code>' + esc(r.code) + '</code>')
                +   '<span class="rl">' + esc(r.label || r.code || '') + '</span>'
                + '</div>'
                + (r.note ? '<div class="rn">' + esc(r.note) + '</div>' : '') + '</' + tag + '>';
            }).join('') + '</div>'
          : '<div class="catset-none">not loaded</div>')
      /* Naming the source file is the honest half: it says this list is READ, not authored here, so nobody goes
         looking for an edit button that should not exist. */
      + '<div class="catset-regsrc">read from <code>' + esc(s.source) + '</code></div>'
      + '</div>';
  }).join('');
}

/* ── the sections ────────────────────────────────────────────────────────────────────────────────────────────── */
/**
 * ⚠️ NEVER PRINT THE SECTION'S OWN SUBTITLE TWICE. The detail header already shows the section's `q`, and three
 * cards opened by repeating it verbatim one line below — "One product, several sizes" under "One product,
 * several sizes" (variants, offers, storefront). Two identical sentences a line apart read as a rendering fault,
 * and they cost the reader a beat working out whether the second one says something new.
 *
 * ⚠️ Suppressed rather than rewritten: the card titles that DO differ (pricing, order models, import) are
 * carrying real information and are left exactly as they are. Inventing new copy for the other three would be a
 * content change wearing a layout change's clothes.
 */
/* ═══ UNITS OF MEASURE — grouped, aligned, and SELECTABLE ═══════════════════════════════════════════════════
 * Athi, 2026-08-17: *"what left kg is and what right kg is, your just repeated, i am not sure of the meaning.
 * so declaration and presentation?"* → *"can be segregated based on weight, liquid, count"* → *"here we have to
 * give selection as well, so what has been selected will be used in the catalogue."*
 *
 * ⚠️ HE WAS RIGHT THAT IT MEANT NOTHING. A unit was a bare string and this rendered `{code:u, label:u}` — the
 * SAME value in two columns. There was no declaration/presentation split to explain; there was one value shown
 * twice. Now the columns are genuinely different things:
 *     CODE   `kg`         stored on the line, travels on the chit, never shown to a customer
 *     UNIT   `Kilogram`   what a person reads
 *     ALSO   `கிலோ · kilo` spellings that fold onto this unit when a message arrives (lib/units.js)
 *
 * ⚠️ GROUPED BY WHAT THEY MEASURE, and the last group is the point: within Weight or Volume the ratios are
 * universal, within Pack they are not — a box is only so many kg because THIS seller says so. That is the same
 * line consolidate.js draws when it refuses to invent a conversion.
 */
/**
 * ⚠️ WHICH REGISTRIES CAN BE NARROWED, and why the two absentees are absent.
 *   `method`     — ONE selling method per catalogue. A set implies several; you cannot have several.
 *   `ordermodel` — already narrowed by the selling method (METHOD_MODELS, backlog 18). A second, independent
 *                  narrowing could disagree with the first, and nothing on screen would say which one won.
 * registry key → the policy flag that holds this entity's slice.
 */
var CATSET_SELECTABLE = {
  datatype:    'datatypes',
  pricing:     'pricing_models',
  priceorigin: 'price_origins',
  offer:       'offer_kinds',
  facet:       'facets',
};
var _CATSEL = {};      // flag → chosen codes, as last read (undefined = not read yet)
var _catselReq = null;
/* ⚠️ ONE READ FOR EVERY REGISTRY ON THE SCREEN. Five registries asking for the same policy document five times
   would be five round trips for one answer, and they would arrive out of order. */
async function catsetSelLoad(force){
  if (_catselReq && !force) return _catselReq;
  _catselReq = api('policyGet').then(function(f){
    var flags = (f && f.flags) || {};
    Object.keys(CATSET_SELECTABLE).forEach(function(k){
      var fl = CATSET_SELECTABLE[k]; _CATSEL[fl] = Array.isArray(flags[fl]) ? flags[fl] : [];
    });
    _catselReq = null; catsetPaintDetail();
  }).catch(function(){ _catselReq = null; });
  return _catselReq;
}
async function catsetSelToggle(flag, code, on){
  var cur = _CATSEL[flag] || [];
  var next = cur.filter(function(x){ return x !== code; });
  if (on) next.push(code);
  /* ⚠️ Same refusal as units, and for the same reason: an empty set is what an accidental clear-all looks like,
     and honouring it would empty a picker in the product form with nothing on screen to explain why. */
  if (!next.length) { if (typeof toast === 'function') toast('Keep at least one — the catalogue needs something to offer.'); catsetPaintDetail(); return; }
  _CATSEL[flag] = next;
  catsetPaintDetail();
  var body = {}; body[flag] = next;
  try { await api('policySet', { body: body }); }
  catch (e) { if (typeof toast === 'function') toast('Could not save that — ' + ((e && e.message) || 'try again')); catsetSelLoad(true); }
}

var _UNITSEL = null;   // the entity's chosen units, as last read
var _LANGSEL = ['en'];  // the entity's languages — a READING preference, never a parsing rule

/**
 * ⭐ THE LANGUAGE BAR (Athi, 2026-08-17: *"language picker comes from the entity settings, the same can be shown
 * here and modify as well"*). Reads the entity's `languages` policy flag and lets it be changed in place, so the
 * setting has one home and two doors.
 *
 * ⚠️⚠️ IT CHANGES WHAT IS LISTED, NOT WHAT IS UNDERSTOOD — said on screen, because the opposite is exactly what
 * a reasonable person would assume. Every spelling in every language still folds; a Tamil message resolves
 * whether or not Tamil is ticked here.
 * ⚠️ English is not removable. It is the fallback every list falls back to, and a units screen with no readable
 * column at all is not a state worth being able to reach.
 */
function catsetLangBar(){
  var M = (typeof CBCatalogue !== 'undefined') ? CBCatalogue : null;
  var langs = (M && M.UNIT_LANGS) || [];
  if (!langs.length) return '';
  var have = {};
  /* Mark the languages we actually hold spellings for, so an empty pick is explained rather than puzzling. */
  Object.keys((M && M.UNIT_ALIASES) || {}).forEach(function(u){
    Object.keys(M.UNIT_ALIASES[u] || {}).forEach(function(lg){ if ((M.UNIT_ALIASES[u][lg] || []).length) have[lg] = 1; });
  });
  var chip = function(l){
    var on = _LANGSEL.indexOf(l.code) >= 0, fixed = l.code === 'en';
    return '<span class="lang-chip' + (on ? ' on' : '') + (fixed ? ' fixed' : '') + '"'
      + (fixed ? ' title="English always shows — it is what every list falls back to"'
               : ' onclick="catsetLangToggle(\'' + esc(l.code) + '\')"')
      + '>' + (on ? '✓ ' : '') + esc(l.label) + (have[l.code] ? '' : '<span class="lang-none">no words yet</span>') + '</span>';
  };
  var groups = ['Common', 'Indian', 'Foreign'].map(function(g){
    var ls = langs.filter(function(l){ return l.group === g; });
    if (!ls.length) return '';
    return '<div class="lang-g"><span class="lang-gh">' + esc(g) + '</span>' + ls.map(chip).join('') + '</div>';
  }).join('');
  return '<div class="lang-bar">' + groups
    + '<div class="lang-note">⚠️ This changes what is <b>listed</b>, not what is <b>understood</b> — every '
    + 'spelling in every language still folds onto its unit when a message arrives. '
    + '<b>no words yet</b> means nobody has sent one in that language; the list grows from real messages, '
    + 'not from a dictionary.</div></div>';
}
async function catsetLangToggle(code){
  if (code === 'en') return;                        // the fallback is not removable — see above
  var next = _LANGSEL.filter(function(x){ return x !== code; });
  if (next.length === _LANGSEL.length) next.push(code);
  if (next.indexOf('en') < 0) next.unshift('en');
  _LANGSEL = next;
  catsetPaintDetail();
  try { await api('policySet', { body: { languages: next } }); }
  catch (e) { if (typeof toast === 'function') toast('Could not save the language choice — ' + ((e && e.message) || 'try again')); }
}

function catsetUnitsHTML(){
  var M = (typeof CBCatalogue !== 'undefined') ? CBCatalogue : null;
  if (!M || !M.UNIT_KINDS) return catsetCard('⚖️ Units of measure', '<div class="catset-none">not loaded</div>');
  if (_UNITSEL === null) { catsetUnitsLoad(); return catsetCard('⚖️ Units of measure', '<div class="catset-load">reading…</div>'); }

  var sel = _UNITSEL, aliases = M.UNIT_ALIASES || {}, names = M.UNIT_NAMES || {};
  var groups = M.UNIT_KINDS.map(function(g){
    var rows = g.units.map(function(u){
      var on = sel.indexOf(u) >= 0;
      /* ⭐ THE SPELLINGS GO ON THEIR OWN LINE (Athi: *"each line item below show what the enumerations are"*).
         Squeezed into a right-hand column they were truncated at four and ellipsed — which hid the very thing
         worth seeing, that கிலோ and kilo and kgs all mean this row. On its own line the whole set fits. */
      /* ⚠️ ONLY THE LANGUAGES THIS ENTITY WORKS IN ARE LISTED — but every language is still UNDERSTOOD. The
         picker is a reading aid; lib/units.js folds all of them regardless. A screen set to Hindi that stopped
         `கிலோ` resolving would be a parsing rule wearing a preference's clothes. */
      var by = aliases[u] || {};
      var shown = _LANGSEL.reduce(function(a, lg){ return a.concat((by[lg] || []).map(function(w){ return { w: w, lg: lg }; })); }, []);
      return '<label class="uom-row' + (on ? '' : ' off') + '">'
        + '<div class="ur1">'
        +   '<input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="catsetUnitToggle(\'' + esc(u) + '\',this.checked)">'
        +   '<code>' + esc(u) + '</code>'
        +   '<span class="un">' + esc(names[u] || u) + '</span>'
        + '</div>'
        /* ⚠️ THE SEPARATOR IS DECORATION, AND MUST SAY SO. It is a faint `·` between spellings — deliberately
           low-contrast, because it divides rather than informs. Unmarked it is counted as unreadable TEXT by any
           contrast audit (63 false positives on this screen alone) and, worse, a screen reader announces
           "middle dot" between every word. aria-hidden states what it already is. */
        + (shown.length ? '<div class="ua">' + shown.map(function(x){ return esc(x.w); }).join('<span class="sep" aria-hidden="true">·</span>') + '</div>' : '')
        + '</label>';
    }).join('');
    return '<div class="uom-g"><div class="uom-gh">' + esc(g.label) + '</div>' + rows + '</div>';
  }).join('');

  var n = sel.length, total = M.UNIT_KINDS.reduce(function(a, g){ return a + g.units.length; }, 0);
  return catsetCard('⚖️ Units of measure',
    '<div class="catset-regb">What a quantity is counted in. <b>' + tx('Tick the ones you trade in') + '</b> — the product form '
    + 'and the catalogue wizard offer only those. <b>' + n + ' of ' + total + '</b> selected.</div>'
    + catsetLangBar()
    + '<div class="uom-hd"><span></span><code>code</code><span class="un">unit</span></div>'
    + groups
    /* ⚠️ Say what deselecting does NOT do. Someone reasonably fears that unticking `barrel` breaks the products
       already priced in barrels; saying so up front is cheaper than them not daring to touch it. */
    + '<div class="catset-src">'
    + txf('Unticking stops a unit being {offered}. Products already saved in it keep it — nothing is rewritten. Spellings under {also} fold onto the unit when a message arrives.', {
        offered: '<b>' + tx('offered') + '</b>', also: '<i>' + tx('also accepted') + '</i>' })
    + '</div>');
}
async function catsetUnitsLoad(){
  try { var f = await api('policyGet'); var fl = (f && f.flags) || {};
        _UNITSEL = fl.units || [];
        /* ⚠️ English is forced in even if the stored set somehow lacks it — see catsetLangBar(). */
        var lg = Array.isArray(fl.languages) && fl.languages.length ? fl.languages.slice() : ['en'];
        if (lg.indexOf('en') < 0) lg.unshift('en');
        _LANGSEL = lg; }
  catch (e) { _UNITSEL = []; }
  catsetPaintDetail();
}
async function catsetUnitToggle(u, on){
  var next = (_UNITSEL || []).filter(function(x){ return x !== u; });
  if (on) next.push(u);
  /* ⚠️ REFUSE THE EMPTY SET HERE TOO, not only on the server. The server already rejects it, but a silent
     server-side rejection would leave the box unticked on screen and the value unchanged underneath — the two
     would disagree and only one of them is real. */
  if (!next.length) { if (typeof toast === 'function') toast('Keep at least one unit — the product form needs something to offer.'); catsetPaintDetail(); return; }
  _UNITSEL = next;
  catsetPaintDetail();
  try { await api('policySet', { body: { units: next } }); }
  catch (e) { if (typeof toast === 'function') toast('Could not save that — ' + ((e && e.message) || 'try again')); catsetUnitsLoad(); }
}
/**
 * ⚠️ THIS SCREEN NEVER SHOWED WHAT IT HAD DONE. Its two siblings — offers and order models — each list what you
 * created underneath the button. Variants declared a grouping into thin air: no list, no current state, nothing
 * to look at afterwards. Athi opened it and could not tell what the screen was for, which is a fair reading of
 * a page that takes a decision and then shows you nothing.
 *
 * ⚠️ SAME LAZY-LOAD IDIOM as catsetDefListHTML — cache, kick off the read, repaint when it lands. Deliberately
 * not a second pattern: `undefined` means not read yet, `null` means the read failed.
 */
var CATSET_FACE;
/**
 * ⚠️⚠️ A STALE READ MUST NOT CLOBBER A NEWER WRITE — and this one did, visibly.
 *
 * Found 2026-09-03 driving the new Storefront panel: tick `kg`, tick `litre`, and the server ended up holding
 * only `litre`. The read fired when the section opened was still in flight; it landed AFTER both saves and
 * overwrote CATSET_FACE with the face as it had been before either of them. The next save then merged onto
 * that stale object and posted it — so a unit the user had ticked was silently dropped, by the network, with
 * no error anywhere.
 *
 * ⭐ THE GUARD IS A GENERATION, NOT A BUSY FLAG. A flag would only stop a SECOND read starting; the damage is
 * done by a read that started legitimately and finished late. Every local write bumps the generation, and a
 * response from an older generation is discarded — it cannot be newer than what we already hold.
 */
var _catsetFaceGen = 0;
function catsetFaceLoad(){
  var gen = _catsetFaceGen;
  return api('catFaceGet')
    .then(function(r){ if (gen === _catsetFaceGen) CATSET_FACE = (r && r.face) || null; })
    .catch(function(){ if (gen === _catsetFaceGen) CATSET_FACE = null; });
}
/**
 * Called by _vSave so the card reflects a save without a round trip.
 * ⚠️ It also INVALIDATES any read in flight — see above. Setting the face locally is a statement that what we
 * hold is newer than anything the server was asked for before now.
 */
function catsetFaceSet(f){ _catsetFaceGen++; CATSET_FACE = f || null; }
function catsetVariantStateHTML(){
  if (CATSET_FACE === undefined) { catsetFaceLoad().then(catsetPaintDetail); return '<div class="catset-load">reading…</div>'; }
  var id = (CATSET_FACE && CATSET_FACE.identity) || {};
  var opts = id.options || [];
  if (!id.group) return '<div class="catset-none">Not grouped yet — every line stands as its own product.</div>';
  return '<div class="catset-drow" data-testid="catset-variant-state">'
    + '<span class="dn">Grouped by <b>' + esc(id.group) + '</b></span>'
    + (opts.length ? '<code class="dk">told apart by ' + esc(opts.join(', ')) + '</code>'
                   : '<code class="dk">no distinguishing column yet</code>')
    + '<span class="da" onclick="declareVariants()">' + tx('Change') + '</span></div>';
}
function catsetCard(title, body, actions){
  var sec = CATSET_SECS.filter(function(x){ return x.key === catsetSec(); })[0];
  var dupe = sec && String(sec.q || '').trim() === String(title || '').trim();
  return '<div class="catset-card">' + (dupe ? '' : '<div class="catset-ct">' + title + '</div>')
    + '<div class="catset-cb">' + body + '</div>'
    + (actions ? '<div class="catset-ca">' + actions + '</div>' : '') + '</div>';
}
function catsetBody(k){
  if (k === 'blueprint') {
    /**
     * ⭐⭐ THE FASTEST WAY IN, SO IT IS THE FIRST THING OFFERED — Athi, 2026-09-02: *"if the user can use the
     * prototype ie blueprint, that sets everything, so possibly we have to showcase prototype to copy if not then
     * go step by step."*
     *
     * ⚠️ COLUMNS USED TO BE THE FIRST PANEL, and that is the wrong order for the commonest case. Adopting a
     * published catalogue sets the columns, the units and the shape in one act — so a merchant who has one
     * available should never be walked through declaring them by hand first. The step-by-step panels below are
     * the FALLBACK, and saying so is the whole point of putting this at the top.
     *
     * ⚠️ IT OPENS THE ADOPTION SCREEN RATHER THAN REBUILDING IT. Adopting takes a source AND a commercials
     * overlay — your own prices over their shared design — and that is a real piece of working UI. Copying it
     * into this panel would be a second implementation of the one thing on this screen that must not disagree
     * with itself. The hub is the entry point; the screen it opens is the detail.
     */
    return catsetCard('Start from a working catalogue',
      'Someone in your trade has published theirs as a <b>blueprint</b>. Adopt it and your columns, units and '
      + 'shape are set in one act — you put your own prices over their design, and a correction they publish '
      + 'reaches you.'
      + '<div class="catset-std">In PIM terms a blueprint is a <b>reference catalogue</b>: you cite it rather '
      + 'than copy it, so it stays THEIRS to correct. ⚠️ Adopting <b>by reference</b> shares the design and keeps '
      + 'your prices your own; adopting <b>by value</b> takes a copy that stops following them. The screen below '
      + 'asks which.</div>'
      + '<div class="catset-std">⭐ <b>No blueprint for your trade?</b> Then the panels below are the step-by-step '
      + 'way — columns first, then how a price is arrived at, then how customers order from you.</div>',
      '<button class="composebtn pri" data-testid="catset-blueprint" onclick="catsetBlueprint()">'
      + tx('📋 See the blueprints available') + '</button>')
    + catsetCard('What you have adopted', catsetAdoptedHTML(), '');
  }
  if (k === 'columns') {
    return catsetCard('What every product records',
      'A catalogue starts with three columns — <b>name</b>, <b>unit</b> and <b>price</b>. A trade usually expects '
      + 'more: a grade, an HSN code, a botanical name, a finish. Pick your trade and the columns it expects are '
      + 'added; you can still bring your own from a spreadsheet afterwards.'
      + '<div class="catset-std">In PIM terms this is the <b>family</b> — the template that describes a product. '
      + '⚠️ A product has <b>one</b> template but can sit in <b>many</b> categories. They are different '
      + 'mechanisms, which is why categories live on their own screen.</div>',
      '<button class="composebtn pri" data-testid="catset-columns" onclick="catcolPick()">' + tx('📐 See the columns your trade expects') + '</button>')
    /* Units and datatypes describe what a column can BE — so they sit under the control that adds columns. */
    /* ⭐ WHAT IT RECORDS TODAY, before what it could record — the question a reader arrives with. */
    + catsetCard('What your catalogue records today', catsetColsHTML(), '')
    + catsetUnitsHTML()
    + catsetRegistry(['datatype']);
  }
  if (k === 'pricing') {
    return catsetCard('How a price is arrived at, and where it came from',
      'A catalogue can declare more than one — a list price, a bulk tier, a regional price, a negotiated one. '
      + 'And a price that was read from somewhere carries <b>where</b> and <b>when</b>.'
      + '<div class="catset-std">⚠️ A price with no source is not wrong, it is just unattributable — and a '
      + 'market-referenced price without a reading date is a rumour. That is the same rule the availability '
      + 'engine applies to a stock figure: a number without a timestamp is not an answer.</div>', '')
    + catsetRegistry(['pricing', 'priceorigin']);
  }
  if (k === 'variants') {
    return catsetCard('One product, several sizes',
      'Say which lines belong together — a 1L, 4L and 10L of the same paint, or a saree in three borders. The '
      + 'shop then shows one product with its options instead of three unrelated rows.'
      + '<div class="catset-std">In PIM terms this is the <b>product model</b> and its <b>variant axis</b>: which '
      + 'attribute varies, and which stay common across the group.</div>',
      '<button class="composebtn pri" data-testid="catset-variants" onclick="declareVariants()">' + tx('🔗 Declare variants') + '</button>')
    + catsetCard('What you have declared', catsetVariantStateHTML(), '');
  }
  if (k === 'offers') {
    return catsetCard('Discounts, tiers and deals',
      'A percentage, a flat amount, a quantity break, buy-one-get-one, free shipping, or a spend threshold. '
      + 'Publish one and it becomes VISIBLE — on the product row, on your storefront, to a B2B buyer browsing '
      + 'you, and in the basket, where the breakdown shows what came off and, when it does not fire, how far '
      + 'short the order is.'
      + '<div class="catset-std">⚠️ A row states the CONDITION, never a bare discount — <b>"₹170 each from 10"</b>, '
      + 'not "₹170 each" beside a product priced ₹180. A badge is a promise, and one the basket then declines is '
      + 'worse than no badge at all, so an offer that cannot fire today shows nothing anywhere.</div>'
      + '<div class="catset-std">⚠️ An offer is a <b>term of trade</b>, not a product fact — it has an author, a '
      + 'validity window and a jurisdiction, and it has to survive into a dispute intact. That is why it is '
      + 'authored once here rather than edited on a product. <b>' + tx('Live') + '</b> offers apply; a draft is one you are '
      + 'still writing.</div>',
      '<button class="composebtn pri" data-testid="catset-offer-new" onclick="catsetDefNew(\'offer\')">+ New offer</button>')
    + catsetCard('Your offers', catsetDefListHTML('offer', 'offer'), '')
    + catsetRegistry(['offer']);
  }
  if (k === 'ordermodels') {
    return catsetCard('How a quantity is counted',
      'Give a quantity rule a name, and a product adopts “Carton of 6” instead of repeating pack/step 6. The '
      + 'kinds come from the cart itself — whole units, a decimal amount, a pack multiple, a range, a metre, or '
      + 'an offer line where the buyer names their price.'
      + '<div class="catset-std">⚠️ Change “Carton of 6” to 12 and <b>every product using it moves</b> — '
      + 'which is either exactly what you want or a catastrophe. Chits already stamped keep the version they '
      + 'froze, which is why adoption freezes at the mint.</div>',
      '<button class="composebtn pri" data-testid="catset-om-new" onclick="catsetDefNew(\'ordermodel\')">+ New order model</button>')
    + catsetCard('Your order models', catsetDefListHTML('ordermodel', 'order model'), '')
    + catsetRegistry(['ordermodel']);
  }
  if (k === 'data') {
    return catsetCard('Bring a spreadsheet in',
      'Read a file, see what each column would become, and decide before anything is written. Products are added '
      + 'or updated by their code — re-importing the same sheet updates rather than duplicates.'
      + '<div class="catset-std">⚠️ Nothing is imported until you confirm the column mapping. The check step is '
      + 'not a formality: it is the only place a wrong column is cheap to fix.</div>',
      '<button class="composebtn pri" data-testid="catset-import" onclick="checkCatalogueFile()">🔍 Check &amp; import</button>'
      + '<button class="composebtn" data-testid="catset-template" onclick="downloadCatalogueTemplate(this)">' + tx('📄 Blank template') + '</button>')
    + catsetCard('Take it back out',
      'Every product as a spreadsheet, in your catalogue’s own columns — for a backup, an accountant, or another '
      + 'system.',
      '<button class="composebtn" data-testid="catset-export" onclick="exportCatalogueCSV(this)">⬇ Export CSV</button>');
  }
  if (k === 'erp') {
    /**
     * ⭐⭐ THE FIELD MAP, AGAINST THE REAL COLUMNS — Athi, 2026-09-02: *"can we get their system catalogue to
     * adjust ours to make it same as theirs so the data can be mapped"* and *"tally compatible, SAP compatible"*.
     *
     * ⚠️ THE WIZARD'S VERSION MAPPED WIZARD STATE — the fields ticked in step 1, which is a list that only exists
     * while the walk is open. This maps what the catalogue ACTUALLY DECLARES, so the map keeps meaning after the
     * setup is over, which is the point of putting it on a panel you return to.
     *
     * ⭐ AND ONE MAP READS BOTH WAYS. Outbound it says "our `code` is their `ITEM_CODE`" so an export lands in
     * their shape; inbound it is the same statement, which is what `csv-preflight.matchHeader` proposes when
     * their spreadsheet arrives. Two mechanisms for one relationship was the finding in the research note above;
     * this is the half that declares it.
     */
    return catsetCard('Where each column lives in your other system',
      'If an ERP, Tally or SAP already holds this, say what it is called there. A connector then knows which of '
      + 'their fields fills which of yours — and an export can leave in their shape rather than ours.'
      + '<div class="catset-std">⭐ <b>One map, read both ways.</b> Outbound it shapes an export for them; '
      + 'inbound it is the same statement a spreadsheet import needs. ⚠️ Declaring a mapping does not move any '
      + 'data — a connector does that, and it is told what to do by this.</div>'
      + '<div class="catset-std">⚠️ <b>Tally and SAP are not the same kind of connection.</b> Tally exchanges '
      + 'masters as a file somebody exports; SAP is a live service an IT department connects. This declares the '
      + 'field names either way; what carries them differs.</div>', '')
    + catsetCard('Your columns', catsetErpHTML(), '');
  }
  if (k === 'tax') {
    return catsetCard('How tax is treated',
      'The treatment that applies to what you sell. It rides with the catalogue rather than being retyped per '
      + 'order, and travels into a chit so both sides read the same basis.'
      + '<div class="catset-std">⚠️ <b>A rate is not a decision.</b> Which treatment applies is a jurisdiction '
      + 'question, and CB records what you declare — it does not compute liability. That distinction is the same '
      + 'one the price provenance draws: we carry what was said and who said it.</div>', '')
    + catsetCard('Declared', catsetTaxHTML(), '');
  }
  /* ⭐ The storefront controls are REAL here now — see catsetSfHTML. This used to be a paragraph and a button
     that opened the six-step wizard, so the hub owned nine of its ten sections and handed the tenth back. */
  if (k === 'face') return catsetSfHTML();
  return '';
}

/**
 * ── ⭐⭐ THE COLUMNS PICKER — see the set, take part of it, add your own ───────────────────────────────────────
 *
 * Athi, 2026-09-02: *"how we showcased category, similarly is there any chance of showcasing the current standard
 * catalogue here and explain what datatype it is? and add more column if you want."*
 *
 * ⚠️ WHAT WAS HERE WAS A DROPDOWN READING "Trade — 11 columns" AND AN ADD-ALL BUTTON. You could not see which
 * eleven, or what type any of them was, and adopting to get eight left the other three on the template for ever
 * — because a column with data in it must never be removed. A blind all-or-nothing choice is worse for a column
 * than for a category, and the categories screen had already stopped making it.
 *
 * ⭐ SAME SHAPE AS `cbcatSeedPick`, DELIBERATELY. Athi: *"the current catalogue setup panel is good, it is as per
 * our standard design principle."* Two pickers that answer the same question — *what is in this set and which of
 * it do I want* — should be operated the same way, so learning one teaches the other.
 *
 * ⚠️ AND THE DATATYPE IS SHOWN, NOT GUESSED. Nothing infers a type from a field NAME anywhere in this codebase:
 * the starter sets declare it, and a CSV import reads it from the VALUES (`csv-preflight.inferType`) and asks for
 * confirmation. So the type beside each column is a fact being reported, not a suggestion being made.
 */
var CATCOL = { v: null, sel: null, starter: null };

async function catcolPick(){
  var r;
  try { r = await api('prodStarters'); }
  catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not load the standard sets.'); return; }
  var verts = (r && r.verticals) || [];
  if (!verts.length) { if (typeof toast === 'function') toast('No standard sets are available.'); return; }
  CATCOL = { v: verts[0].key, sel: null, starter: null };
  modal('<div class="mhd"><div class="t">' + tx('📐 Columns your trade expects') + '</div>'
    + '<div class="s">' + tx('pick the ones you want — you can add more later, but a column with data cannot be removed') + '</div></div>'
    + '<div class="mbody">'
    + '<label class="fl">' + tx('Trade') + '</label>'
    + '<select class="inp" id="catcol_v" data-testid="catcol-trade" onchange="catcolLoad(this.value)">'
    + verts.map(function(v){ return '<option value="' + esc(v.key) + '">' + esc(v.title) + ' — '
        + v.field_count + ' ' + tx('columns') + '</option>'; }).join('')
    + '</select>'
    + '<div id="catcol_body" style="margin-top:10px">' + tx('loading…') + '</div>'
    + '<div style="margin-top:11px"><label class="fl">' + tx('Add your own as well') + '</label>'
    + '<div style="display:flex;gap:6px"><input class="inp" id="catcol_own" data-testid="catcol-own" style="flex:1"'
    + ' placeholder="' + esc(tx('column name')) + '">'
    + '<select class="inp" id="catcol_owntype" data-testid="catcol-own-type" style="width:120px">'
    + ['text','number','boolean','date','choice'].map(function(t){ return '<option>' + t + '</option>'; }).join('')
    + '</select></div>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px">'
    + tx('One per line or separated by commas — they all take the type on the right. Nothing guesses it from the name.')
    + '</div></div>'
    + '</div>'
    + '<div class="mfoot"><button onclick="closeModal()">' + tx('Cancel') + '</button>'
    + '<button class="pri" id="catcol_go" data-testid="catcol-go" onclick="catcolGo()">' + tx('Add columns') + '</button></div>', true);
  catcolLoad(CATCOL.v);
}

/** One trade's columns, with what this catalogue already has marked — so nothing looks like a fresh choice twice. */
async function catcolLoad(v){
  CATCOL.v = v; CATCOL.sel = null;
  var body = document.getElementById('catcol_body');
  if (body) body.innerHTML = tx('loading…');
  var r;
  try { r = await api('prodStarters', { query: { vertical: v } }); }
  catch (e) { if (body) body.innerHTML = '<div style="color:var(--disp)">' + esc((e && e.message) || 'Could not read that set.') + '</div>'; return; }
  var set = (r && r.starter) || {};
  var fields = set.fields || [];
  CATCOL.starter = fields;
  /* Everything ticked, which is what "Add these columns" always did — the old behaviour is one press away. */
  CATCOL.sel = {};
  fields.forEach(function(f){ CATCOL.sel[f.field_key] = 1; });

  var have = {};
  ((CATSET && CATSET.fields) || []).forEach(function(f){ have[f.field_key] = 1; });

  if (body) {
    body.innerHTML = '<div style="display:flex;gap:7px;align-items:center;margin-bottom:7px">'
      + '<button type="button" data-testid="catcol-all" onclick="catcolAll(true)" style="border:1px solid var(--line);background:var(--card);color:var(--on-card);border-radius:20px;padding:3px 12px;font-size:var(--fs-1);cursor:pointer">' + tx('All') + '</button>'
      + '<button type="button" data-testid="catcol-none" onclick="catcolAll(false)" style="border:1px solid var(--line);background:var(--card);color:var(--on-card);border-radius:20px;padding:3px 12px;font-size:var(--fs-1);cursor:pointer">' + tx('None') + '</button>'
      + '<span id="catcol_n" style="margin-inline-start:auto;font-size:var(--fs-1);color:var(--grey);white-space:nowrap"></span></div>'
      + '<div class="bulklist">' + fields.map(function(f){
          var already = !!have[f.field_key];
          return '<label class="bulkrow" style="cursor:' + (already ? 'default' : 'pointer') + (already ? ';opacity:.6' : '') + '">'
            + '<input type="checkbox" ' + (already ? 'checked disabled' : 'checked')
            + ' data-colkey="' + esc(f.field_key) + '" data-testid="catcol-f-' + esc(f.field_key) + '"'
            + ' onchange="catcolTick(\'' + esc(f.field_key) + '\', this.checked)">'
            + '<span class="bn">' + esc(f.field_name || f.field_key) + '</span>'
            /* ⭐ The datatype, named — the question Athi asked of this screen. */
            + '<span class="bh">' + esc(f.field_type || 'text') + (already ? ' · ' + tx('already there') : '') + '</span>'
            + '</label>';
        }).join('') + '</div>';
    catcolCount();
  }
}

function catcolCount(){
  var n = Object.keys(CATCOL.sel || {}).length, tot = (CATCOL.starter || []).length;
  var el = document.getElementById('catcol_n');
  if (el) el.textContent = txf('{n} of {tot} selected', { n: n, tot: tot });
}
function catcolTick(k, on){
  if (on) CATCOL.sel[k] = 1; else delete CATCOL.sel[k];
  catcolCount();
}
function catcolAll(on){
  CATCOL.sel = {};
  (CATCOL.starter || []).forEach(function(f){ if (on) CATCOL.sel[f.field_key] = 1; });
  document.querySelectorAll('[data-colkey]').forEach(function(b){ if (!b.disabled) b.checked = !!on; });
  catcolCount();
}

async function catcolGo(){
  var ownEl = document.getElementById('catcol_own');
  var typeEl = document.getElementById('catcol_owntype');
  var type = (typeEl && typeEl.value) || 'text';
  var own = ((ownEl && ownEl.value) || '').split(/[\n,]/).map(function(s){ return s.trim(); }).filter(Boolean)
    .map(function(nm){ return { field_name: nm, field_type: type }; });
  var fields = Object.keys(CATCOL.sel || {});
  if (!fields.length && !own.length) { if (typeof toast === 'function') toast(tx('Nothing selected.'), true); return; }
  var btn = document.getElementById('catcol_go');
  if (btn) { btn.disabled = true; btn.textContent = tx('Adding…'); }
  try {
    var r = await api('prodStarterAdopt', { body: { vertical: CATCOL.v, fields: fields, custom: own } });
    closeModal();
    if (typeof toast === 'function') {
      toast((r && r.message) || 'Columns added'
        + ((r && r.rejected && r.rejected.length) ? ' · ' + r.rejected.length + ' refused' : ''));
    }
    if (typeof catsetLoad === 'function') await catsetLoad(true); else renderApp();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = tx('Add columns'); }
    if (typeof toast === 'function') toast((e && e.message) || 'Could not add the columns.', true);
  }
}

/**
 * ⭐ WHAT THIS CATALOGUE HAS ALREADY ADOPTED. A panel offering blueprints that cannot say which one you already
 * took is a panel that invites adopting the same thing twice.
 */
function catsetAdoptedHTML(){
  var a = (CATSET && CATSET.adopted) || null;
  if (a === null) { catsetAdoptedLoad(); return '<div style="font-size:var(--fs-2);color:var(--grey)">' + tx('reading…') + '</div>'; }
  if (!a.length) {
    return '<div style="font-size:var(--fs-2);color:var(--grey)">'
      + tx('Nothing adopted yet — your catalogue is entirely your own.') + '</div>';
  }
  return '<div class="bulklist">' + a.map(function(s){
    return '<div class="bulkrow"><span class="bn">' + esc(s.title || s.source_key || '—') + '</span>'
      + '<span class="bh">' + ((s.items && s.items.length) || s.item_count || 0) + ' ' + tx('items') + ' · '
      + esc(s.visible === false ? tx('hidden') : tx('showing')) + '</span></div>';
  }).join('') + '</div>';
}
async function catsetAdoptedLoad(){
  if (CATSET._adoptedBusy) return;
  CATSET._adoptedBusy = true;
  try {
    var r = await api('catalogueSources');
    /* ⚠️ Only what THIS catalogue has taken — the endpoint also answers with what is available to take, and
       showing those here would read as "you have adopted nine things" on a fresh account. */
    CATSET.adopted = ((r && (r.adopted || r.mine)) || []);
  } catch (e) { CATSET.adopted = []; }
  CATSET._adoptedBusy = false;
  catsetPaintDetail();
}

/**
 * ⚠️ IT HANDS OFF, IT DOES NOT REBUILD. Adoption takes a source AND a commercials overlay — your prices over
 * their shared design — and that screen exists and works. A second implementation here would be the one thing on
 * this hub that could disagree with itself about what "adopted" means.
 */
function catsetBlueprint(){
  navTo('catsetup');
  /* Land on the blueprint step rather than the top of the walk: the reader pressed a button that named it. */
  try { UI.cw = UI.cw || {}; UI.cw.step = 1; } catch(_) {}
  renderApp();
}

/**
 * ── ⭐⭐ THE COLUMNS THIS CATALOGUE ACTUALLY HAS ───────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-02: *"can they move the column up or down, depends on their own catalogue"* and *"if the data
 * already there, then we should not allow to remove but column can be added."*
 *
 * ⚠️ THE PANEL COULD ONLY ADD. It offered a standard set and said nothing about what was already declared — so
 * the one question a reader arrives with, *what does my catalogue record today*, had no answer on the screen
 * whose title is exactly that.
 *
 * ⭐ REMOVABILITY IS THE SERVER'S ANSWER, NOT THIS SCREEN'S. Each row carries `removable` and `locked_because`
 * computed by `lib/column-rules.js`, and the DELETE enforces the same function. A screen that decided for itself
 * would eventually enable a control the server refuses, which is worse than not offering it.
 *
 * ⚠️ AND THE REASON IS ON THE ROW, not behind a failed press. "12 products record a value in Grade" is what
 * tells someone what to do next; discovering it only by pressing Remove and being refused teaches the same fact
 * at a worse moment.
 */
function catsetColsHTML(){
  var f = (CATSET && CATSET.fields) || null;
  if (f === null) { catsetFieldsLoad(); return '<div style="font-size:var(--fs-2);color:var(--grey)">' + tx('reading…') + '</div>'; }
  if (!f.length) return '<div style="font-size:var(--fs-2);color:var(--grey)">' + tx('No columns declared yet.') + '</div>';

  var rows = f.map(function(c, i){
    var used = Number(c.used_by || 0);
    var can = !!c.removable;
    return '<div class="bulkrow" data-testid="catset-col-' + esc(c.field_key) + '">'
      + '<span class="bn">' + esc(c.field_name || c.field_key)
      + (c.required ? ' <span style="color:var(--disp);font-weight:400">· ' + tx('required') + '</span>' : '')
      + '</span>'
      + '<span class="bh">' + esc(c.field_type || 'text')
      + (used ? ' · ' + txn('used by {count} product', 'used by {count} products', used) : ' · ' + tx('unused'))
      + '</span>'
      /* ⭐ Up and down are always live: order is presentation, so the tighten-once-loaded rule does not touch it. */
      + '<button type="button" title="' + esc(tx('Move up')) + '" data-testid="catset-up-' + esc(c.field_key) + '"'
      + (i === 0 ? ' disabled' : '') + ' onclick="catsetMove(\'' + esc(c.field_key) + '\',-1)">↑</button>'
      + '<button type="button" title="' + esc(tx('Move down')) + '" data-testid="catset-dn-' + esc(c.field_key) + '"'
      + (i === f.length - 1 ? ' disabled' : '') + ' onclick="catsetMove(\'' + esc(c.field_key) + '\',1)">↓</button>'
      + '<button type="button" class="badd" data-testid="catset-rm-' + esc(c.field_key) + '"'
      + (can ? '' : ' disabled')
      + ' title="' + esc(can ? tx('Remove this column') : (c.locked_because || tx('This column cannot be removed.'))) + '"'
      + ' onclick="catsetDrop(\'' + esc(c.field_key) + '\')">' + (can ? '✕' : '🔒') + '</button>'
      + '</div>';
  }).join('');

  /* ⭐ AND THE ONES THE SYSTEM KEEPS, beside them — a product records these too, so a list headed "what every
     product records" that omits them is short by three. Locked, and each says where it IS set. */
  var sys = ((CATSET && CATSET.system) || []).map(function(c){
    return '<div class="bulkrow" style="opacity:.72" data-testid="catset-sys-' + esc(c.field_key) + '">'
      + '<span class="bn">' + esc(c.field_name) + ' <span style="font-weight:400;color:var(--grey)">· '
      + esc(tx('kept by the system')) + '</span></span>'
      + '<span class="bh">' + esc(c.field_type) + '</span>'
      + '<button type="button" class="badd" disabled title="' + esc(tx('Set in ') + (c.managed_by || '')) + '">🔒</button>'
      + '</div>';
  }).join('');

  /**
   * ⚠️⚠️ COLUMNS THAT ARE IN THE DATA AND IN NO DECLARATION — and this panel used to be silent about them.
   *
   * They are real: they appear in the export and in the template. A merchant reading a panel headed "what every
   * product records" was shown a SHORTER list than their own spreadsheet, with nothing to explain the
   * difference. That silence is what let three surfaces disagree without anyone being able to see it.
   *
   * ⭐ THIS BLOCK SHOULD BE EMPTY, ALWAYS. Every write path now declares what it stores, so the only way to get
   * one is data written before that. If it appears, the backfill (migration b198) has not been run — and saying
   * so is far better than a panel that quietly disagrees with the download.
   */
  var undec = ((CATSET && CATSET.undeclared) || []).map(function(c){
    return '<div class="bulkrow" style="opacity:.8" data-testid="catset-undeclared-' + esc(c.field_key) + '">'
      + '<span class="bn">' + esc(c.field_key) + '</span>'
      + '<span class="bh">' + esc(String(c.used_by || 0)) + ' ' + esc(tx('product(s)')) + '</span>'
      + '</div>';
  }).join('');

  return '<div class="bulklist">' + rows + '</div>'
    + (sys ? '<div style="font-size:var(--fs-1);font-weight:700;color:var(--grey-2);text-transform:uppercase;'
      + 'letter-spacing:.04em;margin:12px 0 5px">' + tx('Kept by the system') + '</div>'
      + '<div class="bulklist">' + sys + '</div>' : '')
    + (undec ? '<div style="font-size:var(--fs-1);font-weight:700;color:var(--warn-3);text-transform:uppercase;'
      + 'letter-spacing:.04em;margin:12px 0 5px">' + tx('In your data, not yet declared') + '</div>'
      + '<div class="bulklist">' + undec + '</div>'
      + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:5px">'
      + esc(tx('These are in your export and your template but are not columns yet, so they cannot be renamed, reordered or removed.')) + '</div>' : '');
}

async function catsetFieldsLoad(force){
  if (CATSET._fieldsBusy) return;
  if (CATSET.fields && !force) return;
  CATSET._fieldsBusy = true;
  try {
    var r = await api('schemaFields');
    CATSET.fields = (r && r.fields) || [];
    CATSET.system = (r && r.system) || [];
    /* Empty on any catalogue written since the declare-first writer; non-empty means b198 has not been run. */
    CATSET.undeclared = (r && r.undeclared) || [];
  } catch (e) { CATSET.fields = []; CATSET.system = []; CATSET.undeclared = []; }
  CATSET._fieldsBusy = false;
  catsetPaintDetail();
}

/**
 * ⚠️ THE WHOLE ORDER IS SENT, not "move this one". The endpoint takes a list and writes positions from it, so a
 * screen that sent a single move would be asking the server to reconstruct an order it can already see. Sending
 * the list means what is on screen and what is stored cannot drift apart by one press.
 */
async function catsetMove(key, dir){
  var f = (CATSET.fields || []).slice();
  var i = f.findIndex(function(x){ return x.field_key === key; });
  var j = i + dir;
  if (i < 0 || j < 0 || j >= f.length) return;
  var t = f[i]; f[i] = f[j]; f[j] = t;
  CATSET.fields = f;
  catsetPaintDetail();                                    // move first, so the screen answers the press at once
  try { await api('schemaFieldOrder', { body: { order: f.map(function(x){ return x.field_key; }) } }); }
  catch (e) {
    if (typeof toast === 'function') toast((e && e.message) || 'Could not save the order.', true);
    await catsetFieldsLoad(true);                         // and put it back if the server disagreed
  }
}

function catsetDrop(key){
  var c = (CATSET.fields || []).find(function(x){ return x.field_key === key; }) || {};
  confirmAsk(txf('Remove the {name} column?', { name: '"' + esc(c.field_name || key) + '"' }),
    tx('Nothing recorded in it is deleted — the column stops being part of your catalogue, and re-adding it '
     + 'brings back anything products still hold.'),
    tx('Remove'), function(){ _catsetDrop(key); }, true);
}
async function _catsetDrop(key){
  try {
    var r = await api('schemaFieldDrop', { params: { key: key } });
    if (typeof toast === 'function') toast((r && r.message) || 'Column removed');
    await catsetFieldsLoad(true);
  } catch (e) {
    /* ⚠️ The server's refusal carries the COUNT — pass it through rather than replacing it with a generic
       failure, because the number is the whole usefulness of the message. */
    if (typeof toast === 'function') toast((e && e.message) || 'Could not remove the column.', true);
    await catsetFieldsLoad(true);
  }
}

/**
 * ── ⭐ THE FIELD MAP AND THE TAX TREATMENT — both live on the catalogue FACE (b112) ────────────────────────────
 *
 * ⚠️ THE FACE IS READ ONCE AND WRITTEN WHOLE. `PUT /api/catalogue-face` upserts the config, so a panel that
 * saved only its own key would drop everything else the face holds. Every write here merges onto what was read.
 */
var CATSET_SYS = ['—', 'ERP', 'Tally', 'SAP', 'Other'];

/**
 * ⚠️⚠️ THERE IS ONE FACE, ONE LOADER AND ONE VARIABLE — AND FOR A FEW HOURS THERE WERE TWO OF EACH.
 *
 * The ERP and Tax panels arrived with their own `catsetFaceLoad` storing the face on `CATSET.face`, while the
 * Variants panel had used `CATSET_FACE` since long before. Function declarations HOIST, so the second definition
 * won silently: `CATSET_FACE` was never assigned, stayed `undefined` for ever, and `catsetVariantStateHTML`'s
 * `if (CATSET_FACE === undefined) { catsetFaceLoad().then(catsetPaintDetail); … }` re-entered on every paint —
 * load → repaint → still undefined → load. **An infinite repaint loop, which is a frozen tab.**
 *
 * ⚠️ NOTHING THREW AND NOTHING LOGGED. A duplicate top-level function is legal JavaScript; the loser simply
 * disappears. `node --check` passes, every guard passes, and the only symptom is a screen that stops answering —
 * which is why `e2e/dup-functions.cjs` now fails the build on the CLASS rather than trusting anyone to notice.
 *
 * ⭐ Collapsed onto the OLDER pair (`CATSET_FACE` / `catsetFaceSet`) because they had the callers — `_vSave`
 * calls `catsetFaceSet` from the catalogue screen, which knows nothing about this file's newer state object.
 */

/** ⚠️ Merged, never replaced — see the note above. */
/** ⚠️ Merged, never replaced: the face is upserted WHOLE, so a panel saving only its own key would drop
    everything else it holds. */
async function catsetFaceSave(patch){
  var face = Object.assign({}, CATSET_FACE || {}, patch || {});
  catsetFaceSet(face);
  try { await api('catFacePut', { body: { face: face } }); }
  catch (e) { if (typeof toast === 'function') toast((e && e.message) || 'Could not save that.', true); }
}

function catsetErpHTML(){
  if (CATSET_FACE === undefined) { catsetFaceLoad().then(catsetPaintDetail); return '<div style="font-size:var(--fs-2);color:var(--grey)">' + tx('reading…') + '</div>'; }
  var cols = (CATSET && CATSET.fields) || null;
  if (cols === null) { catsetFieldsLoad(); return '<div style="font-size:var(--fs-2);color:var(--grey)">' + tx('reading…') + '</div>'; }
  if (!cols.length) return '<div style="font-size:var(--fs-2);color:var(--grey)">' + tx('Declare some columns first.') + '</div>';

  var map = (CATSET_FACE && CATSET_FACE.erpMap) || {};
  var mapped = Object.keys(map).filter(function(k){ var m = map[k]; return m && m.system && m.system !== '—'; }).length;

  return '<div class="bulklist">' + cols.map(function(c){
    var m = map[c.field_key] || {};
    var sys = m.system || '—';
    return '<div class="bulkrow" data-testid="catset-erp-' + esc(c.field_key) + '">'
      + '<span class="bn">' + esc(c.field_name || c.field_key) + '</span>'
      + '<select data-testid="catset-erpsys-' + esc(c.field_key) + '"'
      + ' onchange="catsetErpSet(\'' + esc(c.field_key) + '\',\'system\',this.value)"'
      + ' style="font-size:var(--fs-1);padding:3px 6px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--on-card)">'
      + CATSET_SYS.map(function(s){ return '<option' + (s === sys ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('')
      + '</select>'
      /* ⚠️ The name box only appears once a system is named: asking "what is it called there" before "where" is
         a question with no context, and an answer typed against "—" would be stored against nothing. */
      + (sys !== '—'
          ? '<input class="inp" data-testid="catset-erpref-' + esc(c.field_key) + '" style="width:170px;padding:3px 7px"'
            + ' value="' + esc(m.ref || '') + '" placeholder="' + esc(tx('their field name')) + '"'
            + ' onchange="catsetErpSet(\'' + esc(c.field_key) + '\',\'ref\',this.value)">'
          : '<span class="bh">' + tx('not mapped') + '</span>')
      + '</div>';
  }).join('') + '</div>'
  + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px">'
  + (mapped ? txn('{count} column mapped', '{count} columns mapped', mapped)
            : tx('Nothing mapped — this catalogue stands on its own.'))
  + '</div>';
}

function catsetErpSet(key, prop, val){
  var face = CATSET_FACE || {};
  var map = Object.assign({}, face.erpMap || {});
  var m = Object.assign({}, map[key] || {});
  m[prop] = val;
  /* A column set back to "—" is UNMAPPED, not mapped to a dash — otherwise the count and any exporter reading
     this would treat the placeholder as a destination. */
  if (prop === 'system' && val === '—') delete map[key]; else map[key] = m;
  catsetFaceSave({ erpMap: map });
  catsetPaintDetail();
}

/** The tax treatment the catalogue declares. Free text by design — see the panel note on what CB does not do. */
function catsetTaxHTML(){
  if (CATSET_FACE === undefined) { catsetFaceLoad().then(catsetPaintDetail); return '<div style="font-size:var(--fs-2);color:var(--grey)">' + tx('reading…') + '</div>'; }
  var t = (CATSET_FACE && CATSET_FACE.tax) || {};
  var v = typeof t === 'string' ? t : (t.treatment || '');
  return '<label class="fl">' + tx('Treatment') + '</label>'
    + '<input class="inp" data-testid="catset-tax" value="' + esc(v) + '"'
    + ' placeholder="' + esc(tx('e.g. GST 18% · zero-rated export · exempt')) + '"'
    + ' onchange="catsetTaxSet(this.value)">'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px">'
    + tx('Carried with the catalogue and into a chit, so both sides read the same basis.') + '</div>';
}
function catsetTaxSet(v){
  catsetFaceSave({ tax: { treatment: String(v || '').slice(0, 200) } });
  if (typeof toast === 'function') toast(tx('Tax treatment saved'));
}

/* ── render ──────────────────────────────────────────────────────────────────────────────────────────────────── */
function catsetDetailHTML(){
  var k = catsetSec();
  var s = CATSET_SECS.filter(function(x){ return x.key === k; })[0] || CATSET_SECS[0];
  return '<div class="dh"><button class="dback" onclick="catsetBack()">‹ Catalogue setup</button>'
    + '<div class="dt">' + s.icon + ' ' + esc(s.name) + '</div><div class="ds">' + esc(s.q) + '</div></div>'
    + '<div class="db" id="catsetbody">' + catsetBody(k) + '</div>';
}
function catsetPaintDetail(){ var d = document.getElementById('detailpane'); if (d) { d.className = 'detail'; d.innerHTML = catsetDetailHTML(); } }
function catsetPaintList(){ var b = document.getElementById('catset_rows'); if (b) b.innerHTML = catsetRowsHTML(); }
function catsetPaint(){ catsetPaintList(); catsetPaintDetail(); }
function catsetRowsHTML(){
  var cur = catsetSec();
  return CATSET_SECS.map(function(s){
    return '<div class="row' + (s.key === cur ? ' sel' : '') + '" data-testid="catset-sec-' + s.key + '"'
      + ' onclick="catsetSetSec(\'' + s.key + '\')">'
      + '<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px">'
      +   '<span style="font-size:var(--fs-3)">' + s.icon + '</span>'
      +   '<b style="font-size:var(--fs-3)">' + esc(s.name) + '</b></div>'
      + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:1px;padding-inline-start:22px">' + esc(s.q) + '</div></div>'
      + '<div class="rowgo" aria-hidden="true">›</div></div>';
  }).join('');
}
function catalogueSetupHubScreen(){
  catsetCss();
  var list = '<div class="list"><div class="lh">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
    +   '<span style="font-family:\'Space Grotesk\';font-weight:700;font-size:var(--fs-3)">' + tx('⚙️ Catalogue setup') + '</span></div>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5">How your catalogue is <b>shaped</b>. '
    + 'The products themselves live in <span onclick="navTo(\'catalogue\')" style="color:var(--blue);font-weight:600;cursor:pointer">' + tx('Catalogue') + '</span>, '
    + 'and how they are sorted in <span onclick="navTo(\'categories\')" style="color:var(--blue);font-weight:600;cursor:pointer">' + tx('Categories') + '</span>.</div>'
    /* ⭐ WHERE AND HOW THE CATALOGUE STANDARDS ARE IMPLEMENTED — read from the STANDARDS register, so this
       screen states nothing of its own and cannot fall out of step with Settings › Standards. Renders only in
       🧾 Spec, so an ordinary setup screen is unchanged. */
    + '</div>' + specStandards('catalogue')
    + '<div class="rows" id="catset_rows">' + catsetRowsHTML() + '</div></div>';
  var detail = '<div class="detail" id="detailpane">' + catsetDetailHTML() + '</div>';
  var divider = '<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>';
  var showDetail = (UI.vp === 'mob') && UI.mdetail;
  /**
   * ⚠️ ITS OWN WIDTH, NOT THE CHIT LIST'S. This read `UI.lw` — the width of the Task/Order chit list, persisted
   * as `cb_lw`. Drag that list wider to read long subjects and this menu grows with it: measured at **1031px**
   * for seven fixed rows, while the detail pane — which holds everything you actually came to read — was left
   * 439px and wrapped the units into a narrow column.
   *
   * ⚠️ The two panes are not the same kind of thing. A chit list is DATA and earns width; this is a fixed menu
   * of seven and never needs more. MIS and Profile already keep their own `misLw` for exactly this reason —
   * this is that established pattern, not a new one.
   *
   * Still draggable, and still clamped to 42% of the window so it can never swallow the detail again.
   */
  if (UI.catsetLw == null) UI.catsetLw = 320;
  var lw = Math.min(UI.catsetLw, Math.max(260, Math.round((window.innerWidth || 1200) * 0.42)));
  return '<div class="panel ' + (showDetail ? 'showdetail' : '') + '" id="panel" style="--lw:' + lw + 'px;--lh:' + UI.lh + 'px">' + list + divider + detail + '</div>';
}
function catsetCss(){
  if (document.getElementById('catset_css')) return;
  var s = document.createElement('style'); s.id = 'catset_css';
  s.textContent = [
    '.catset-card{border:1px solid var(--line);border-radius:12px;background:var(--card);margin-bottom:12px;overflow:hidden}',
    '.catset-ct{font-size:var(--fs-3);font-weight:700;padding:11px 14px 0}',
    '.catset-cb{font-size:var(--fs-2);line-height:1.6;color:var(--ink);padding:6px 14px 12px}',
    /* The standards note is set apart because it explains the WHY, which a person reads once and then never
       again — it must be skippable without losing the instruction above it. */
    '.catset-std{font-size:var(--fs-2);line-height:1.6;color:var(--grey);background:var(--paper);border:1px solid var(--line);',
    'border-radius:9px;padding:9px 11px;margin-top:10px}',
    '.catset-ca{display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 13px}',
    '.catset-ca .composebtn{width:auto;padding:8px 14px}',
    '.catset-load,.catset-none{font-size:var(--fs-2);color:var(--grey);padding:2px 0 4px}',
    '.catset-dlist{border:1px solid var(--line);border-radius:9px;overflow:hidden}',
    '.catset-drow{display:flex;align-items:center;gap:9px;padding:8px 11px;font-size:var(--fs-2);',
    'border-bottom:1px dashed var(--line);flex-wrap:wrap}',
    '.catset-drow:last-child{border-bottom:0}',
    '.catset-drow.ret{opacity:.72}',
    '.catset-drow.ret .dn{text-decoration:line-through;color:var(--grey)}',
    '.catset-drow .dn{font-weight:600;flex:1;min-width:0}',
    '.catset-drow .dk{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1);',
    'background:var(--paper);border:1px solid var(--line);border-radius:5px;padding:1px 6px;color:var(--grey)}',
    '.catset-drow .dst{font-size:var(--fs-1);font-weight:700;border-radius:6px;padding:1px 7px;text-transform:uppercase;letter-spacing:.04em}',
    '.catset-drow .dst.live{background:var(--ok-tint);color:var(--ok-2)}',
    '.catset-drow .dst.draft{background:var(--warn-tint);color:var(--warn-2)}',
    '.catset-drow .dst.retired{background:var(--neutral-tint);color:var(--ink-2)}',
    '.catset-drow .da{font-size:var(--fs-1);color:var(--blue);cursor:pointer;font-weight:600}',
    '.catset-drow .da:hover{text-decoration:underline}',
    /* The vocabulary blocks. Quieter than the controls above them — this is reference, not something to act on. */
    '.catset-reg{border:1px solid var(--line);border-radius:12px;background:var(--paper);margin-bottom:12px;overflow:hidden}',
    '.catset-regh{display:flex;align-items:center;gap:8px;padding:10px 13px 0;font-size:var(--fs-2);font-weight:700}',
    '.catset-regn{margin-inline-start:auto;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1);',
    'color:var(--grey);background:var(--card);border:1px solid var(--line);border-radius:20px;padding:1px 8px}',
    '.catset-regb{font-size:var(--fs-2);line-height:1.55;color:var(--grey);padding:4px 13px 9px}',
    '.catset-regrows{display:flex;flex-direction:column;gap:1px;background:var(--line);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}',
    /* Two lines: identity, then explanation. See the note where the markup is built. */
    '.catset-regrow{display:block;background:var(--card);padding:7px 13px;font-size:var(--fs-2)}',
    '.catset-regrow .rr1{display:grid;grid-template-columns:112px minmax(0,1fr);align-items:baseline;gap:10px}',
    '.catset-regrow.nocode .rr1{grid-template-columns:minmax(0,1fr)}',
    /* A tickable registry gains a checkbox column; the note indents past it so both lines share one left edge. */
    '.catset-regrow.pick{display:block;cursor:pointer}',
    '.catset-regrow.pick .rr1{grid-template-columns:22px 112px minmax(0,1fr);align-items:center}',
    '.catset-regrow.pick.nocode .rr1{grid-template-columns:22px minmax(0,1fr)}',
    /* ⚠️ The note no longer indents — see the .rn rule. These two overrides existed only to keep the indent
       lined up with the checkbox column, and there is no indent left to line up. */
    '.catset-regrow.pick:hover{background:var(--paper)}',
    /* ⚠️ Unticked stays READABLE — you have to be able to read a thing to decide you want it back. */
    '.catset-regrow.off code,.catset-regrow.off .rl{color:var(--grey)}',
    '.catset-regrow code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1);color:var(--ink)}',
    '.catset-regrow .rl{color:var(--ink)}',
    /**
     * ⭐⭐ THE NOTE TAKES THE FULL STRETCH, IN A BOX (Athi, 2026-08-17: *"under pricing, fixed, range underneath
     * lot of space but the notes in the right hand occupies lot of space, so if the notes can be placed in the
     * entire stretch within a box… it will look good and also reduce space"*).
     *
     * ⚠️ THE INDENT WAS COSTING HEIGHT, NOT BUYING ALIGNMENT. `padding-inline-start:122px` pushed every note into a
     * narrow right-hand column so it could line up under the name. In this pane — which defaults to 320px — that
     * left the note about 172px of the 294px available, so a two-line explanation wrapped to four or five, the
     * row grew tall, and the space beside the short label ("fixed", "range") sat empty. The alignment it bought
     * was real and it was worth far less than the height it cost.
     *
     * Full width gives the note ~70% more room per line, which is roughly 40% fewer lines. The BOX is what
     * keeps it from reading as a second name now that it no longer sits in its own column: a tinted ground and
     * a rule down the left say "this belongs to the row above" without spending any horizontal space to say it.
     */
    '.catset-regrow .rn{margin-top:5px;padding:5px 9px;background:var(--neutral-tint);color:var(--note);'
      + 'border-inline-start:2px solid var(--line);border-radius:0 6px 6px 0;font-size:var(--fs-1);line-height:1.45}',
    '.catset-regrow.nocode .rn{padding-inline-start:0}',
    /* ⚠️ A LIST OF BARE WORDS IS NOT A TABLE. When a registry's rows carry no code and no note — units are the
       case: fifteen entries, one short word each — stacking them full-width spends fifteen rows and most of the
       pane's width on nothing, and the eye has to travel a screen to read what fits on two lines. Chips give the
       same information at a glance. ⚠️ Applied only when there IS nothing else to show: the moment a row has a
       note (datatypes: "expiry, harvest") the rows are right, because then the label needs something aligned
       beside it. */
    /* ⚠️ ONE GRID TEMPLATE FOR THE HEADER AND EVERY ROW — that is what makes the columns actually line up.
       Aligning them by padding inside separate flex rows is what produced the ragged "kg   KG" look. */
    /* ⚠️ ONE COLOUR FOR EVERY SECOND LINE, defined once. The second line is always the same KIND of thing — an
       explanation or a set of spellings — so it must look the same everywhere it appears, or the reader has to
       re-learn the page in each section. Slate-blue rather than plain grey: visibly a different hue from the
       near-black name, so the two never blur, while still clearly secondary. */
    ':root{--note:#5a7290}',
    '.uom-hd{display:grid;grid-template-columns:22px 76px minmax(0,1fr);align-items:center;gap:10px;padding:5px 13px;font-size:11px;color:var(--grey);text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--line)}',
    '.uom-hd code,.uom-hd .un{font-size:var(--fs-1);color:var(--grey)}',
    '.uom-row{display:block;border-bottom:1px solid var(--line);cursor:pointer;font-size:var(--fs-2);padding:6px 13px}',
    '.uom-row .ur1{display:grid;grid-template-columns:22px 76px minmax(0,1fr);align-items:center;gap:10px}',
    '.uom-row:hover{background:var(--paper)}',
    '.uom-row code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1);color:var(--ink)}',
    '.uom-row .un{color:var(--ink)}',
    /* The spellings, indented to sit under the NAME so the eye reads down one edge. */
    '.uom-row .ua{margin-top:3px;padding-inline-start:108px;color:var(--note);font-size:var(--fs-1);line-height:1.5}',
    '.uom-row .ua .sep{color:var(--line);padding:0 5px}',
    '.lang-bar{border:1px solid var(--line);border-radius:9px;padding:8px 10px;margin:2px 0 10px;background:var(--paper)}',
    '.lang-g{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:5px}',
    '.lang-gh{font-size:10.5px;font-weight:800;color:var(--grey);text-transform:uppercase;letter-spacing:.05em;min-width:62px}',
    '.lang-chip{font-size:var(--fs-1);border:1px solid var(--line);border-radius:999px;padding:2px 10px;background:var(--card);cursor:pointer;white-space:nowrap}',
    '.lang-chip:hover{border-color:var(--blue)}',
    '.lang-chip.on{background:var(--blue-tint-bg);border-color:var(--blue);color:var(--blue);font-weight:700}',
    /* ⚠️ English reads as fixed, not disabled — a greyed chip invites clicking to find out why. */
    '.lang-chip.fixed{cursor:default;opacity:.9}',
    '.lang-chip .lang-none{color:var(--grey);font-size:10px;margin-inline-start:5px;font-weight:400}',
    '.lang-note{font-size:var(--fs-1);color:var(--note);line-height:1.5;margin-top:4px}',
    /* ⚠️ Unticked stays READABLE, not greyed to the floor — you have to be able to read a unit to decide you
       want it back, and a list where half the rows are illegible is a list you cannot choose from. */
    '.uom-row.off code,.uom-row.off .un{color:var(--grey)}',
    '.uom-g{margin-top:9px}',
    '.uom-gh{font-size:var(--fs-1);font-weight:800;color:var(--grey);text-transform:uppercase;letter-spacing:.05em;padding:4px 13px 3px;background:var(--paper);border-bottom:1px solid var(--line)}',
    '.catset-regrows.chips{display:flex;flex-direction:row;flex-wrap:wrap;gap:6px;background:none;border:0;padding:2px 13px 4px}',
    '.catset-regrows.chips .catset-regrow{background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:3px 11px;font-size:var(--fs-1)}',
    '.catset-regsrc{font-size:var(--fs-1);color:var(--grey);padding:7px 13px}',
    '.catset-regsrc code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1)}'
  ].join('');
  (document.head || document.documentElement).appendChild(s);
}

/**
 * ── ⭐⭐ THE STOREFRONT CONTROLS, IN THE HUB ────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-03: *"delete the old wizard."*
 *
 * ⚠️ IT COULD NOT SIMPLY BE DELETED. This section used to be a paragraph and a button that opened the six-step
 * wizard — so the hub owned nine of its ten sections and handed the tenth back to the screen it replaced. Deleting
 * the wizard first would have left storefront setup with no editor at all, which is not a migration, it is a
 * removal. The controls had to exist here before the other screen could go.
 *
 * ⭐ EVERY OPTION IS READ FROM THE REGISTRY THE CODE ALREADY PUBLISHES — CBCatalogue.METHODS · UNITS · FACETS.
 * Re-listing them here is how two lists of "the methods we support" drift apart, and this screen has already made
 * that argument twice (offers.js KINDS, cart-ui MODELS).
 */
function catsetSfHTML(){
  /**
   * ⚠️ THE CARD SURVIVES THE LOADING STATE. My first version returned a bare "reading…" while the face was in
   * flight, so the whole section — heading, explanation, everything — vanished for a beat and came back. The
   * catsetup-panels guard caught it as a THIN panel, which is exactly the shape it was built to catch: a screen
   * that shows nothing is indistinguishable from a screen that is broken. Every sibling section here keeps its
   * explanatory text outside the loading branch; this one now does too.
   */
  var _loading = (CATSET_FACE === undefined);
  if (_loading) catsetFaceLoad().then(catsetPaintDetail);
  var f = CATSET_FACE || {};
  var P = (typeof CBCatalogue !== 'undefined') ? CBCatalogue : null;
  if (!P) return '<div class="catset-none">' + tx('The catalogue model is not loaded.') + '</div>';

  var method = f.method || (f.order_input && f.order_input.preset) || '';
  var units = Array.isArray(f.units) ? f.units : [];
  var facets = (f.facets && typeof f.facets === 'object') ? f.facets : {};
  var defUnit = (f.defaults && f.defaults.unit) || '';

  var methods = (P.METHODS || []).map(function(m){
    return '<div class="bulkrow' + (method === m.k ? ' on' : '') + '" data-testid="catset-sf-method-' + esc(m.k) + '"'
      + ' onclick="catsetSfMethod(\'' + esc(m.k) + '\')" style="cursor:pointer">'
      + '<span class="bn">' + esc(m.label) + '</span>'
      + '<span class="bh">' + (method === m.k ? esc(tx('in use')) : '') + '</span></div>';
  }).join('');

  /* The catalogue's ALLOWED SET. An item picks from it; with exactly one, nobody is asked per product. */
  var known = (P.UNITS || []).slice();
  units.forEach(function(u){ if (known.indexOf(u) < 0) known.push(u); });
  var unitChips = known.map(function(u){
    var on = units.indexOf(u) >= 0;
    return '<button type="button" class="cbpick-chip' + (on ? ' on' : '') + '"'
      + ' data-testid="catset-sf-unit-' + esc(u) + '" onclick="catsetSfUnit(\'' + esc(u) + '\')">' + esc(u) + '</button>';
  }).join(' ');

  /**
   * ⭐ THE DEFAULT UNIT LIVES HERE, and only appears once there is a choice to make. One allowed unit IS the
   * default — asking then would be a question with one answer. See lib/defaults.js: a row that says nothing
   * inherits this, and changing it moves every row that never overrode.
   */
  var defRow = '';
  if (units.length > 1) {
    defRow = '<div class="catset-drow" style="margin-top:9px"><span class="dn">' + esc(tx('Default unit'))
      + '</span><span class="bh">' + units.map(function(u){
          return '<button type="button" class="cbpick-chip' + (defUnit === u ? ' on' : '') + '"'
            + ' data-testid="catset-sf-def-' + esc(u) + '" onclick="catsetSfDefUnit(\'' + esc(u) + '\')">' + esc(u) + '</button>';
        }).join(' ') + '</span></div>'
      + '<div class="catset-std">' + esc(tx('A product that names no unit uses this one. Change it and every '
      + 'product that never set its own follows.')) + '</div>';
  } else if (units.length === 1) {
    defRow = '<div class="catset-std">' + esc(tx('One unit, so every product uses it — nothing to choose.')) + '</div>';
  }

  var facetRows = (P.FACETS || []).map(function(k){
    var on = !!facets[k];
    return '<button type="button" class="cbpick-chip' + (on ? ' on' : '') + '"'
      + ' data-testid="catset-sf-facet-' + esc(k) + '" onclick="catsetSfFacet(\'' + esc(k) + '\')">' + esc(k) + '</button>';
  }).join(' ');

  return catsetCard(tx('How customers order from you'),
      '<div class="catset-std">' + esc(tx('In PIM terms this is the channel — the same products, presented for a '
      + 'particular audience. It changes what buyers see.')) + '</div>'
    + (_loading ? '<div class="catset-load">' + tx('reading…') + '</div>' : '')
    + '<div class="catset-sub">' + esc(tx('Order method')) + '</div>'
    + '<div class="bulklist" data-testid="catset-sf-methods">' + methods + '</div>'
    + '<div class="catset-sub" style="margin-top:12px">' + esc(tx('Units you trade in')) + '</div>'
    + '<div data-testid="catset-sf-units">' + unitChips + '</div>'
    + defRow
    + '<div class="catset-sub" style="margin-top:12px">' + esc(tx('What a buyer can filter by')) + '</div>'
    + '<div data-testid="catset-sf-facets">' + facetRows + '</div>', '')
    + catsetRegistry(['method', 'facet']);
}

/** ⚠️ order_input is written BESIDE method, because the server resolves the contract from it — see order-input.js. */
function catsetSfMethod(k){
  var f = CATSET_FACE || {};
  var oi = Object.assign({}, f.order_input || {}, { preset: k });
  catsetFaceSave({ method: k, order_input: oi }).then(catsetPaintDetail);
}

function catsetSfUnit(u){
  var f = CATSET_FACE || {};
  var units = (Array.isArray(f.units) ? f.units : []).slice();
  var i = units.indexOf(u);
  if (i >= 0) units.splice(i, 1); else units.push(u);
  /**
   * ⚠️ A DEFAULT THAT IS NO LONGER ALLOWED IS NOT A DEFAULT. Removing the unit that products inherit would leave
   * every silent row pointing at something this catalogue no longer trades in — so it is cleared here rather than
   * left dangling, and with one unit remaining that unit becomes the answer on its own.
   */
  var d = Object.assign({}, f.defaults || {});
  if (d.unit && units.indexOf(d.unit) < 0) delete d.unit;
  catsetFaceSave({ units: units, defaults: d }).then(catsetPaintDetail);
}

function catsetSfDefUnit(u){
  var f = CATSET_FACE || {};
  var d = Object.assign({}, f.defaults || {});
  d.unit = (d.unit === u) ? '' : u;      /* pressing the current one clears it — a default is optional */
  if (!d.unit) delete d.unit;
  catsetFaceSave({ defaults: d }).then(catsetPaintDetail);
}

function catsetSfFacet(k){
  var f = CATSET_FACE || {};
  var fa = Object.assign({}, f.facets || {});
  fa[k] = !fa[k];
  catsetFaceSave({ facets: fa }).then(catsetPaintDetail);
}
