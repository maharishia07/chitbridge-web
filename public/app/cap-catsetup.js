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
  return '<div class="catset-dlist">' + live.map(row).join('') + ret.map(row).join('') + '</div>';
}

function catsetSec(){ return CATSET.sec || 'columns'; }
function catsetSetSec(k){
  CATSET.sec = k;
  if (UI.vp === 'mob') { UI.mdetail = true; var p = document.getElementById('panel'); if (p) p.classList.add('showdetail'); }
  catsetPaint();
}
function catsetBack(){ UI.mdetail = false; var p = document.getElementById('panel'); if (p) p.classList.remove('showdetail'); }

/* ── the sections ────────────────────────────────────────────────────────────────────────────────────────────── */
function catsetCard(title, body, actions){
  return '<div class="catset-card"><div class="catset-ct">' + title + '</div>'
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
      '<button class="composebtn pri" data-testid="catset-columns" onclick="startFromStandardSet()">📐 Add a standard set</button>');
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
    + catsetCard('Your offers', catsetDefListHTML('offer', 'offer'), '');
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
    + catsetCard('Your order models', catsetDefListHTML('ordermodel', 'order model'), '');
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
      '<button class="composebtn pri" data-testid="catset-face" onclick="UI.nav=\'cataloguesetup\';renderApp()">⚙ Open catalogue setup</button>');
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
      +   '<span style="font-size:14px">' + s.icon + '</span>'
      +   '<b style="font-size:13.5px">' + esc(s.name) + '</b></div>'
      + '<div style="font-size:11.5px;color:var(--grey);margin-top:1px;padding-left:22px">' + esc(s.q) + '</div></div>'
      + '<div class="rowgo" aria-hidden="true">›</div></div>';
  }).join('');
}
function catalogueSetupHubScreen(){
  catsetCss();
  var list = '<div class="list"><div class="lh">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
    +   '<span style="font-family:\'Space Grotesk\';font-weight:700;font-size:14px">⚙️ Catalogue setup</span></div>'
    + '<div style="font-size:11.5px;color:var(--grey);line-height:1.5">How your catalogue is <b>shaped</b>. '
    + 'The products themselves live in <span onclick="navTo(\'catalogue\')" style="color:var(--blue);font-weight:600;cursor:pointer">Catalogue</span>, '
    + 'and how they are sorted in <span onclick="navTo(\'categories\')" style="color:var(--blue);font-weight:600;cursor:pointer">Categories</span>.</div>'
    + '</div><div class="rows" id="catset_rows">' + catsetRowsHTML() + '</div></div>';
  var detail = '<div class="detail" id="detailpane">' + catsetDetailHTML() + '</div>';
  var divider = '<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>';
  var showDetail = (UI.vp === 'mob') && UI.mdetail;
  return '<div class="panel ' + (showDetail ? 'showdetail' : '') + '" id="panel" style="--lw:' + UI.lw + 'px;--lh:' + UI.lh + 'px">' + list + divider + detail + '</div>';
}
function catsetCss(){
  if (document.getElementById('catset_css')) return;
  var s = document.createElement('style'); s.id = 'catset_css';
  s.textContent = [
    '.catset-card{border:1px solid var(--line);border-radius:11px;background:#fff;margin-bottom:12px;overflow:hidden}',
    '.catset-ct{font-size:13.5px;font-weight:700;padding:11px 14px 0}',
    '.catset-cb{font-size:13px;line-height:1.6;color:var(--ink);padding:6px 14px 12px}',
    /* The standards note is set apart because it explains the WHY, which a person reads once and then never
       again — it must be skippable without losing the instruction above it. */
    '.catset-std{font-size:12px;line-height:1.6;color:var(--grey);background:var(--paper);border:1px solid var(--line);',
    'border-radius:9px;padding:9px 11px;margin-top:10px}',
    '.catset-ca{display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 13px}',
    '.catset-ca .composebtn{width:auto;padding:8px 14px}',
    '.catset-load,.catset-none{font-size:12.5px;color:var(--grey);padding:2px 0 4px}',
    '.catset-dlist{border:1px solid var(--line);border-radius:9px;overflow:hidden}',
    '.catset-drow{display:flex;align-items:center;gap:9px;padding:8px 11px;font-size:13px;',
    'border-bottom:1px dashed var(--line);flex-wrap:wrap}',
    '.catset-drow:last-child{border-bottom:0}',
    '.catset-drow.ret{opacity:.72}',
    '.catset-drow.ret .dn{text-decoration:line-through;color:var(--grey)}',
    '.catset-drow .dn{font-weight:600;flex:1;min-width:0}',
    '.catset-drow .dk{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;',
    'background:var(--paper);border:1px solid var(--line);border-radius:5px;padding:1px 6px;color:var(--grey)}',
    '.catset-drow .dst{font-size:10.5px;font-weight:700;border-radius:6px;padding:1px 7px;text-transform:uppercase;letter-spacing:.04em}',
    '.catset-drow .dst.live{background:#e6f4ec;color:#2c7a43}',
    '.catset-drow .dst.draft{background:#f4f2ec;color:#8a6d1e}',
    '.catset-drow .dst.retired{background:#eceaea;color:#6f6a6a}',
    '.catset-drow .da{font-size:11.5px;color:var(--blue);cursor:pointer;font-weight:600}',
    '.catset-drow .da:hover{text-decoration:underline}'
  ].join('');
  (document.head || document.documentElement).appendChild(s);
}
