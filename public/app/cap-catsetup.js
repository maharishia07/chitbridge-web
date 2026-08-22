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
var CATSET = { sec: 'columns' };

var CATSET_SECS = [
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

function catsetSec(){ return CATSET.sec || 'columns'; }
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
    + '<div class="catset-src">Unticking stops a unit being <b>offered</b>. Products already saved in it keep it — '
    + 'nothing is rewritten. Spellings under <i>also accepted</i> fold onto the unit when a message arrives.</div>');
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
function catsetFaceLoad(){
  return api('catFaceGet')
    .then(function(r){ CATSET_FACE = (r && r.face) || null; })
    .catch(function(){ CATSET_FACE = null; });
}
/* Called by _vSave so the card reflects a save without a round trip. */
function catsetFaceSet(f){ CATSET_FACE = f || null; }
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
  if (k === 'columns') {
    return catsetCard('What every product records',
      'A catalogue starts with three columns — <b>name</b>, <b>unit</b> and <b>price</b>. A trade usually expects '
      + 'more: a grade, an HSN code, a botanical name, a finish. Pick your trade and the columns it expects are '
      + 'added; you can still bring your own from a spreadsheet afterwards.'
      + '<div class="catset-std">In PIM terms this is the <b>family</b> — the template that describes a product. '
      + '⚠️ A product has <b>one</b> template but can sit in <b>many</b> categories. They are different '
      + 'mechanisms, which is why categories live on their own screen.</div>',
      '<button class="composebtn pri" data-testid="catset-columns" onclick="startFromStandardSet()">' + tx('📐 Add a standard set') + '</button>')
    /* Units and datatypes describe what a column can BE — so they sit under the control that adds columns. */
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
      + 'Publish one and it applies to orders in compose — the breakdown shows what came off and, when it does '
      + 'not fire, how far short the order is.'
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
  if (k === 'face') {
    return catsetCard('How customers order from you',
      'The order method (cart, quantity, enquiry, range), the units you trade in, the facets a buyer can filter '
      + 'by, and your tax treatment. This is what a customer meets on your storefront.'
      + '<div class="catset-std">In PIM terms this is the <b>channel</b> — the same products, presented for a '
      + 'particular audience. ⚠️ It changes what buyers see, so it is deliberately behind its own step-by-step '
      + 'setup rather than a row of switches.</div>',
      '<button class="composebtn pri" data-testid="catset-face" onclick="UI.nav=\'cataloguesetup\';renderApp()">' + tx('⚙ Open catalogue setup') + '</button>')
    /* Selling methods and facets describe what a buyer meets, so they read under the storefront control. */
    + catsetRegistry(['method', 'facet']);
  }
  return '';
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
