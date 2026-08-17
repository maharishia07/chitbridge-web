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
          : '<span class="da" onclick="catsetDefEdit(\'' + kind + '\',\'' + esc(d.id) + '\')">Edit</span>'
            + '<span class="da" onclick="catsetDefRetire(\'' + kind + '\',\'' + esc(d.id) + '\',\'' + esc(String(d.name).replace(/'/g, '')) + '\')">Retire</span>')
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
      orphanNote = '<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;font-size:11.5px;color:#6b5a36;margin-bottom:9px">'
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
    return '<div class="catset-reg">'
      + '<div class="catset-regh">' + s.icon + ' ' + esc(s.title)
      +   '<span class="catset-regn">' + rows.length + '</span></div>'
      + '<div class="catset-regb">' + esc(s.blurb) + '</div>'
      + (rows.length
          /* ⚠️ DO NOT PRINT THE CODE TWICE. Some registries have no separate code — `UNITS` maps to
             `{code:u, label:u}` because a unit IS its own name — so every row rendered "kg kg", "gram gram",
             "litre litre". Fifteen of those reads as a rendering fault, and it makes the reader look for a
             distinction that does not exist. Show the code only where it actually differs from the label. */
          /* Bare words → chips; anything with a code or a note keeps its rows. See the `.chips` rule. */
          ? '<div class="catset-regrows' + (rows.every(function(r){
              return !r.note && String(r.code || '') === String(r.label || '');
            }) ? ' chips' : '') + '">' + rows.map(function(r){
              var same = String(r.code || '') === String(r.label || '');
              return '<div class="catset-regrow' + (same ? ' nocode' : '') + '">'
                + (same ? '' : '<code>' + esc(r.code) + '</code>')
                + '<span class="rl">' + esc(r.label || r.code || '') + '</span>'
                + (r.note ? '<span class="rn">' + esc(r.note) + '</span>' : '') + '</div>';
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
      '<button class="composebtn pri" data-testid="catset-columns" onclick="startFromStandardSet()">📐 Add a standard set</button>')
    /* Units and datatypes describe what a column can BE — so they sit under the control that adds columns. */
    + catsetRegistry(['unit', 'datatype']);
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
      '<button class="composebtn pri" data-testid="catset-variants" onclick="declareVariants()">🔗 Declare variants</button>');
  }
  if (k === 'offers') {
    return catsetCard('Discounts, tiers and deals',
      'A percentage, a flat amount, a quantity break, buy-one-get-one, free shipping, or a spend threshold. '
      + 'Publish one and it applies to orders in compose — the breakdown shows what came off and, when it does '
      + 'not fire, how far short the order is.'
      + '<div class="catset-std">⚠️ An offer is a <b>term of trade</b>, not a product fact — it has an author, a '
      + 'validity window and a jurisdiction, and it has to survive into a dispute intact. That is why it is '
      + 'authored once here rather than edited on a product. <b>Live</b> offers apply; a draft is one you are '
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
      + '<div class="catset-std">⚠️ Change “Carton of 6” to 12 and <b>every product that adopted it moves</b> — '
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
      + '<button class="composebtn" data-testid="catset-template" onclick="downloadCatalogueTemplate(this)">📄 Blank template</button>')
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
      '<button class="composebtn pri" data-testid="catset-face" onclick="UI.nav=\'cataloguesetup\';renderApp()">⚙ Open catalogue setup</button>')
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
      +   '<b style="font-size:13.5px">' + esc(s.name) + '</b></div>'
      + '<div style="font-size:11.5px;color:var(--grey);margin-top:1px;padding-left:22px">' + esc(s.q) + '</div></div>'
      + '<div class="rowgo" aria-hidden="true">›</div></div>';
  }).join('');
}
function catalogueSetupHubScreen(){
  catsetCss();
  var list = '<div class="list"><div class="lh">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
    +   '<span style="font-family:\'Space Grotesk\';font-weight:700;font-size:var(--fs-3)">⚙️ Catalogue setup</span></div>'
    + '<div style="font-size:11.5px;color:var(--grey);line-height:1.5">How your catalogue is <b>shaped</b>. '
    + 'The products themselves live in <span onclick="navTo(\'catalogue\')" style="color:var(--blue);font-weight:600;cursor:pointer">Catalogue</span>, '
    + 'and how they are sorted in <span onclick="navTo(\'categories\')" style="color:var(--blue);font-weight:600;cursor:pointer">Categories</span>.</div>'
    + '</div><div class="rows" id="catset_rows">' + catsetRowsHTML() + '</div></div>';
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
    '.catset-card{border:1px solid var(--line);border-radius:12px;background:#fff;margin-bottom:12px;overflow:hidden}',
    '.catset-ct{font-size:13.5px;font-weight:700;padding:11px 14px 0}',
    '.catset-cb{font-size:13px;line-height:1.6;color:var(--ink);padding:6px 14px 12px}',
    /* The standards note is set apart because it explains the WHY, which a person reads once and then never
       again — it must be skippable without losing the instruction above it. */
    '.catset-std{font-size:12px;line-height:1.6;color:var(--grey);background:var(--paper);border:1px solid var(--line);',
    'border-radius:9px;padding:9px 11px;margin-top:10px}',
    '.catset-ca{display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 13px}',
    '.catset-ca .composebtn{width:auto;padding:8px 14px}',
    '.catset-load,.catset-none{font-size:var(--fs-2);color:var(--grey);padding:2px 0 4px}',
    '.catset-dlist{border:1px solid var(--line);border-radius:9px;overflow:hidden}',
    '.catset-drow{display:flex;align-items:center;gap:9px;padding:8px 11px;font-size:13px;',
    'border-bottom:1px dashed var(--line);flex-wrap:wrap}',
    '.catset-drow:last-child{border-bottom:0}',
    '.catset-drow.ret{opacity:.72}',
    '.catset-drow.ret .dn{text-decoration:line-through;color:var(--grey)}',
    '.catset-drow .dn{font-weight:600;flex:1;min-width:0}',
    '.catset-drow .dk{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1);',
    'background:var(--paper);border:1px solid var(--line);border-radius:5px;padding:1px 6px;color:var(--grey)}',
    '.catset-drow .dst{font-size:var(--fs-1);font-weight:700;border-radius:6px;padding:1px 7px;text-transform:uppercase;letter-spacing:.04em}',
    '.catset-drow .dst.live{background:#e6f4ec;color:#2c7a43}',
    '.catset-drow .dst.draft{background:#f4f2ec;color:#8a6d1e}',
    '.catset-drow .dst.retired{background:#eceaea;color:#6f6a6a}',
    '.catset-drow .da{font-size:11.5px;color:var(--blue);cursor:pointer;font-weight:600}',
    '.catset-drow .da:hover{text-decoration:underline}',
    /* The vocabulary blocks. Quieter than the controls above them — this is reference, not something to act on. */
    '.catset-reg{border:1px solid var(--line);border-radius:12px;background:var(--paper);margin-bottom:12px;overflow:hidden}',
    '.catset-regh{display:flex;align-items:center;gap:8px;padding:10px 13px 0;font-size:var(--fs-2);font-weight:700}',
    '.catset-regn{margin-left:auto;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1);',
    'color:var(--grey);background:#fff;border:1px solid var(--line);border-radius:20px;padding:1px 8px}',
    '.catset-regb{font-size:12px;line-height:1.55;color:var(--grey);padding:4px 13px 9px}',
    '.catset-regrows{display:flex;flex-direction:column;gap:1px;background:var(--line);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}',
    '.catset-regrow{display:flex;align-items:baseline;gap:9px;background:#fff;padding:6px 13px;font-size:var(--fs-2);flex-wrap:wrap}',
    '.catset-regrow code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;color:var(--ink);flex:0 0 auto}',
    '.catset-regrow .rl{color:var(--ink)}',
    '.catset-regrow .rn{color:var(--grey);font-size:11.5px;flex:1;min-width:0}',
    /* ⚠️ A LIST OF BARE WORDS IS NOT A TABLE. When a registry's rows carry no code and no note — units are the
       case: fifteen entries, one short word each — stacking them full-width spends fifteen rows and most of the
       pane's width on nothing, and the eye has to travel a screen to read what fits on two lines. Chips give the
       same information at a glance. ⚠️ Applied only when there IS nothing else to show: the moment a row has a
       note (datatypes: "expiry, harvest") the rows are right, because then the label needs something aligned
       beside it. */
    '.catset-regrows.chips{display:flex;flex-direction:row;flex-wrap:wrap;gap:6px;background:none;border:0;padding:2px 13px 4px}',
    '.catset-regrows.chips .catset-regrow{background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:3px 11px;font-size:11.5px}',
    '.catset-regsrc{font-size:var(--fs-1);color:var(--grey);padding:7px 13px}',
    '.catset-regsrc code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1)}'
  ].join('');
  (document.head || document.documentElement).appendChild(s);
}
