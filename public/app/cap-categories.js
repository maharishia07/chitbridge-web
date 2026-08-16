/**
 * app/cap-categories.js — CATEGORIES, the shelf you shape (lazy; ensureCap('categories')).
 *
 * Athi, 2026-08-16: *"bring the category as a panel next to catalogue. keep creation and updation in that panel
 * like normal two sided panel."*
 *
 * ── WHY IT IS ITS OWN SCREEN AND NOT A SECTION OF DEFINITIONS ────────────────────────────────────────────────
 * A category is authored like a definition (it IS one — `kind:'category'`) but it is USED like a part of the
 * catalogue: you reach for it while looking at products, not while reading the governance model. Definitions
 * still lists categories, and now POINTS HERE rather than offering a second Create button — one home for
 * authoring, referred to from elsewhere. That is Model A applied to a screen instead of a value.
 *
 * ── WHAT A CATEGORY IS, IN ONE LINE ───────────────────────────────────────────────────────────────────────────
 * A live `definition` row of kind `category`. Products cite it by `definition_id` and carry a copy of its NAME
 * for counterparties who cannot resolve that id. Rename here → every product of yours follows, because none of
 * them stored the word. See catgIdsOf/catgSetOn in core.js.
 *
 * ⚠️ RETIRE, NEVER DELETE. The API has no delete for a definition and should not: a chit that cited a category
 * stays explainable. Retiring takes it off the shelf; products that cite it keep the citation and say so.
 */
var CBCAT_UI = { list: null, sel: null, busy: false, err: '', q: '', mode: 'view', form: null, counts: null };

/* ── data ────────────────────────────────────────────────────────────────────────────────────────────────────── */
/**
 * ⚠️ `all=1`, NOT the live-only read. This screen is where you MANAGE the shelf, so it must show retired ones —
 * a shelf that silently omits what you retired is how you re-create something you already withdrew. The pickers
 * elsewhere ask for live only; that difference is the point of having a screen.
 */
async function cbcatLoad(force){
  if (CBCAT_UI.busy) return;
  if (CBCAT_UI.list && !force) return;
  CBCAT_UI.busy = true; CBCAT_UI.err = ''; cbcatPaint();
  try {
    var r = await api('defList', { query: { kind: 'category', all: 1 } });
    CBCAT_UI.list = ((r && r.definitions) || []).map(function(d){
      return { id: d.definition_id, name: d.name, note: d.note || '', status: d.status || 'draft',
               version: d.current_version || 1, created_at: d.created_at };
    });
    CBCAT_UI.list.sort(function(a,b){
      /* Live first, then retired — you are almost always looking for a live one, and a retired row in the middle
         of the list is a row you read twice. */
      if ((a.status === 'retired') !== (b.status === 'retired')) return a.status === 'retired' ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    await cbcatCounts();
  } catch (e) {
    CBCAT_UI.err = (e && e.message) || 'Could not read your categories.';
  }
  CBCAT_UI.busy = false;
  if (!CBCAT_UI.sel && (CBCAT_UI.list || []).length && UI.vp !== 'mob') CBCAT_UI.sel = CBCAT_UI.list[0].id;
  cbcatPaint();
}
/**
 * How many products sit in each category — the number that makes this screen worth opening.
 * ⚠️ Counted through `catgIdsOf`, so a product in three categories is counted in three, and the legacy
 * single-`category` shape is understood without this file knowing about it.
 */
async function cbcatCounts(){
  try {
    if (!UI.prods || !UI.prods.length) { var l = await api('prodList'); UI.prods = l || UI.prods || []; }
    var n = {}, none = 0;
    (UI.prods || []).forEach(function(p){
      var ids = catgIdsOf((p && (p.item_data || p)) || {});
      if (!ids.length) { none++; return; }
      ids.forEach(function(id){ n[id] = (n[id] || 0) + 1; });
    });
    CBCAT_UI.counts = { by: n, none: none, total: (UI.prods || []).length };
  } catch (e) { CBCAT_UI.counts = null; }
}

/* ── write ───────────────────────────────────────────────────────────────────────────────────────────────────── */
async function cbcatSave(){
  var f = CBCAT_UI.form; if (!f) return;
  var name = (f.name || '').trim();
  var err = document.getElementById('cbcat_err');
  if (name.length < 2) { if (err) err.textContent = 'Give it a name of at least 2 characters.'; return; }
  /* ⚠️ A duplicate NAME is refused here rather than merged. Two shelves reading "Grains" is indistinguishable on
     every screen that shows only the word, and the products under each would look like one set that lost half. */
  var clash = (CBCAT_UI.list || []).filter(function(c){
    return c.id !== f.id && c.status !== 'retired' && c.name.toLowerCase() === name.toLowerCase(); })[0];
  if (clash) { if (err) err.textContent = 'You already have a live category called “' + clash.name + '”.'; return; }
  try {
    if (f.id) {
      await api('defSave', { params: { id: f.id }, body: { name: name, note: f.note || '' } });
      toast('Renamed — every product that cites it follows.');
    } else {
      var r = await api('defAdd', { body: { kind: 'category', sub_kind: null, name: name, note: f.note || '', rules: {} } });
      var id = r && (r.definition_id || (r.definition && r.definition.definition_id));
      /* Live immediately: a draft category cannot be attached to anything, so it would be a shelf you cannot use. */
      if (id) await api('defSave', { params: { id: id }, body: { status: 'live' } });
      CBCAT_UI.sel = id || CBCAT_UI.sel;
      toast('“' + name + '” added ✓');
    }
    CBCAT_UI.mode = 'view'; CBCAT_UI.form = null;
    if (typeof cbCatgLive === 'function') await cbCatgLive(true);     // the shared shelf every picker reads
    await cbcatLoad(true);
  } catch (e) {
    if (err) err.textContent = (e && e.message) || 'Could not save that.';
  }
}
function cbcatRetire(id){
  var c = (CBCAT_UI.list || []).filter(function(x){ return x.id === id; })[0]; if (!c) return;
  var n = (CBCAT_UI.counts && CBCAT_UI.counts.by[id]) || 0;
  confirmAsk('Retire “' + esc(c.name) + '”?',
    'It leaves the shelf and cannot be attached to anything new.'
    + (n ? '<div style="margin-top:7px"><b>' + n + ' product' + (n === 1 ? '' : 's') + '</b> currently cite it. '
         + 'They keep the citation and will say the category is no longer live — nothing is unlinked and nothing '
         + 'is deleted.</div>'
        : '<div style="margin-top:7px">Nothing cites it, so nothing changes elsewhere.</div>'),
    'Retire', function(){ _cbcatRetire(id); }, true);
}
async function _cbcatRetire(id){
  try {
    await api('defRetire', { params: { id: id } });
    toast('Retired.');
    if (typeof cbCatgLive === 'function') await cbCatgLive(true);
    await cbcatLoad(true);
  } catch (e) { toast((e && e.message) || 'Could not retire that.', true); }
}
async function cbcatRelive(id){
  try {
    await api('defSave', { params: { id: id }, body: { status: 'live' } });
    toast('Back on the shelf.');
    if (typeof cbCatgLive === 'function') await cbCatgLive(true);
    await cbcatLoad(true);
  } catch (e) { toast((e && e.message) || 'Could not change that.', true); }
}

/* ── interaction ─────────────────────────────────────────────────────────────────────────────────────────────── */
function cbcatSelect(id){ CBCAT_UI.sel = id; CBCAT_UI.mode = 'view'; CBCAT_UI.form = null;
  if (UI.vp === 'mob') { UI.mdetail = true; var p = document.getElementById('panel'); if (p) p.classList.add('showdetail'); }
  cbcatPaint(); }
function cbcatNew(){ CBCAT_UI.mode = 'edit'; CBCAT_UI.sel = null; CBCAT_UI.form = { id: null, name: '', note: '' };
  if (UI.vp === 'mob') { UI.mdetail = true; var p = document.getElementById('panel'); if (p) p.classList.add('showdetail'); }
  cbcatPaint(); }
function cbcatEdit(id){
  var c = (CBCAT_UI.list || []).filter(function(x){ return x.id === id; })[0]; if (!c) return;
  CBCAT_UI.mode = 'edit'; CBCAT_UI.form = { id: c.id, name: c.name, note: c.note }; cbcatPaint();
}
function cbcatCancel(){ CBCAT_UI.mode = 'view'; CBCAT_UI.form = null; cbcatPaint(); }
function cbcatField(k, v){ if (CBCAT_UI.form) CBCAT_UI.form[k] = v; }
function cbcatSearch(v){ CBCAT_UI.q = v; cbcatPaintList(); }
function cbcatBack(){ UI.mdetail = false; var p = document.getElementById('panel'); if (p) p.classList.remove('showdetail'); }

/* ── render ──────────────────────────────────────────────────────────────────────────────────────────────────── */
function cbcatVisible(){
  var q = (CBCAT_UI.q || '').trim().toLowerCase();
  var a = CBCAT_UI.list || [];
  return q ? a.filter(function(c){ return (c.name + ' ' + c.note).toLowerCase().indexOf(q) >= 0; }) : a;
}
function cbcatRowsHTML(){
  if (CBCAT_UI.busy && !CBCAT_UI.list) return '<div class="loadwrap"><span class="spin"></span> loading…</div>';
  if (CBCAT_UI.err) return '<div class="cbcat-err">' + esc(CBCAT_UI.err) + '</div>';
  var rows = cbcatVisible();
  if (!rows.length) {
    return '<div class="empty"><div class="big">🏷️</div><div class="t">'
      + (CBCAT_UI.q ? 'Nothing matches that' : 'No categories yet')
      + '</div><div>' + (CBCAT_UI.q ? 'Try a different word.'
          : 'A category is how a shelf gets sorted. Make one, then attach products to it from the Catalogue.')
      + '</div></div>';
  }
  return rows.map(function(c){
    var n = (CBCAT_UI.counts && CBCAT_UI.counts.by[c.id]) || 0;
    var ret = c.status === 'retired';
    return '<div class="row' + (c.id === CBCAT_UI.sel ? ' sel' : '') + '" data-testid="catg-row-' + esc(c.id) + '"'
      + ' onclick="cbcatSelect(\'' + esc(c.id) + '\')"' + (ret ? ' style="opacity:.72"' : '') + '>'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="display:flex;align-items:center;gap:7px">'
      +     '<b style="font-size:13.5px' + (ret ? ';text-decoration:line-through' : '') + '">' + esc(c.name) + '</b>'
      +     (ret ? '<span class="cbcat-badge ret">retired</span>' : '')
      +   '</div>'
      +   (c.note ? '<div style="font-size:11.5px;color:var(--grey);margin-top:1px">' + esc(c.note) + '</div>' : '')
      + '</div>'
      /* The count is the reason to look at this list at all — which shelves are actually carrying anything. */
      + '<span class="cbcat-n" title="products in this category">' + n + '</span>'
      + '</div>';
  }).join('');
}
function cbcatDetailHTML(){
  if (CBCAT_UI.mode === 'edit') {
    var f = CBCAT_UI.form || { name: '', note: '' };
    var editing = !!f.id;
    return '<div class="dh"><button class="dback" onclick="cbcatBack()">‹ Categories</button>'
      + '<div class="dt">' + (editing ? 'Rename category' : 'New category') + '</div>'
      + '<div class="ds">' + (editing ? 'products follow the new name' : 'goes on the shelf live') + '</div></div>'
      + '<div class="db">'
      + (editing
          ? '<div class="cbcat-note">Renaming is safe. Every product cites this category by <b>id</b>, never by '
            + 'the word — so they all follow. ⚠️ A copy of the old name travels with items already in a '
            + 'counterparty’s catalogue, and that copy deliberately does not change.</div>'
          : '')
      + '<label class="fl">Name</label>'
      + '<input class="inp" id="cbcat_name" data-testid="catg-name" value="' + esc(f.name || '') + '"'
      + ' placeholder="Grains" oninput="cbcatField(\'name\',this.value)">'
      + '<label class="fl">Note</label>'
      + '<input class="inp" value="' + esc(f.note || '') + '" placeholder="optional — what belongs here"'
      + ' oninput="cbcatField(\'note\',this.value)">'
      + '<div class="err" id="cbcat_err" style="margin-top:8px"></div>'
      + '</div>'
      + '<div class="actbar"><button class="pri" data-testid="catg-save" onclick="cbcatSave()">'
      + (editing ? 'Save' : 'Create') + '</button><button onclick="cbcatCancel()">Cancel</button></div>';
  }

  var c = (CBCAT_UI.list || []).filter(function(x){ return x.id === CBCAT_UI.sel; })[0];
  if (!c) {
    return '<div class="db"><div class="empty"><div class="big">🏷️</div><div class="t">Pick a category</div>'
      + '<div>Or make a new one. Categories sort your catalogue and give buyers a way to narrow it.</div></div></div>';
  }
  var n = (CBCAT_UI.counts && CBCAT_UI.counts.by[c.id]) || 0;
  var ret = c.status === 'retired';
  var mine = (UI.prods || []).filter(function(p){ return catgIdsOf((p && (p.item_data || p)) || {}).indexOf(c.id) >= 0; });
  return '<div class="dh"><button class="dback" onclick="cbcatBack()">‹ Categories</button>'
    + '<div class="dt">' + esc(c.name) + (ret ? ' <span class="cbcat-badge ret">retired</span>' : '') + '</div>'
    + '<div class="ds">' + (c.note ? esc(c.note) : (n + ' product' + (n === 1 ? '' : 's'))) + '</div></div>'
    + '<div class="db">'
    + (ret ? '<div class="cbcat-note warn">This category is <b>retired</b>. It cannot be attached to anything new. '
           + 'Products that already cite it keep the citation.</div>' : '')
    + '<div class="cbcat-stat"><span class="v">' + n + '</span><span class="k">product' + (n === 1 ? '' : 's') + ' in this category</span></div>'
    + '<div class="sec">Products</div>'
    + (mine.length
        ? '<div class="cbcat-plist">' + mine.slice(0, 60).map(function(p){
            var d = (p.item_data || p), also = catgIdsOf(d).length - 1;
            return '<div class="cbcat-prow"><span>' + esc(d.name || d.product || 'item') + '</span>'
              /* ⚠️ Say when a product is ALSO elsewhere. Without it this list reads as a partition, and someone
                 retiring a category would think they were emptying a shelf rather than removing one label. */
              + (also > 0 ? '<span class="cbcat-also">+' + also + ' other categor' + (also === 1 ? 'y' : 'ies') + '</span>' : '')
              + '</div>'; }).join('')
          + (mine.length > 60 ? '<div class="cbcat-prow" style="color:var(--grey)">+' + (mine.length - 60) + ' more</div>' : '')
          + '</div>'
        : '<div class="cbcat-none">Nothing here yet. Attach products from <span onclick="navTo(\'catalogue\')" style="color:var(--blue);font-weight:600;cursor:pointer">Catalogue</span> — tick them and press <b>Categorise</b>.</div>')
    + '</div>'
    + '<div class="actbar">'
    +   (ret ? '<button class="pri" data-testid="catg-relive" onclick="cbcatRelive(\'' + esc(c.id) + '\')">Put back on the shelf</button>'
            : '<button class="pri" data-testid="catg-edit" onclick="cbcatEdit(\'' + esc(c.id) + '\')">Rename</button>'
              + '<button data-testid="catg-retire" onclick="cbcatRetire(\'' + esc(c.id) + '\')">Retire</button>')
    + '</div>';
}
function cbcatStatsHTML(){
  var n = cbcatVisible().length;
  return '<span style="font-size:11px;color:var(--grey)">' + n + ' categor' + (n === 1 ? 'y' : 'ies') + '</span>'
    /* ⭐ The uncategorised count is a to-do list, so it is a BUTTON — it takes you to the products it is
       counting rather than merely reporting a number you then have to go and find by hand. */
    + ((CBCAT_UI.counts && CBCAT_UI.counts.none)
        ? '<button data-testid="catg-uncat" onclick="cbcatGoUncategorised()" style="margin-left:auto;border:1px solid var(--gold-line);background:var(--gold-soft);border-radius:8px;padding:4px 9px;font-size:11.5px;color:#6b5a36;cursor:pointer">'
          + CBCAT_UI.counts.none + ' uncategorised →</button>'
        : '');
}
function cbcatPaintList(){
  var b = document.getElementById('cbcat_rows'); if (b) b.innerHTML = cbcatRowsHTML();
  var s = document.getElementById('cbcat_stats'); if (s) s.innerHTML = cbcatStatsHTML();
}
function cbcatPaintDetail(){ var d = document.getElementById('detailpane'); if (d) { d.className = 'detail'; d.innerHTML = cbcatDetailHTML(); } }
function cbcatPaint(){ cbcatPaintList(); cbcatPaintDetail(); }

function categoriesScreen(){
  cbcatCss();
  var list = '<div class="list"><div class="lh">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">'
    +   '<span style="font-family:\'Space Grotesk\';font-weight:700;font-size:14px">🏷️ Categories</span>'
    + '</div>'
    + '<button class="composebtn" style="width:100%;justify-content:center" data-testid="catg-new" onclick="cbcatNew()">+ New category</button>'
    + '<div class="srch" style="margin-top:8px">🔍 <input data-testid="catg-search" placeholder="Search categories" value="' + esc(CBCAT_UI.q || '') + '" oninput="cbcatSearch(this.value)"></div>'
    /* ⚠️ ITS OWN ELEMENT, REPAINTED WITH THE ROWS. The counts arrive AFTER the screen is built, and the header is
       rendered once by categoriesScreen() — so anything derived from counts that lives up here is stale forever.
       The uncategorised button was invisible on the first look for exactly that reason. */
    + '<div id="cbcat_stats" style="margin-top:8px;display:flex;align-items:center;gap:8px">' + cbcatStatsHTML() + '</div>'
    + '</div><div class="rows" id="cbcat_rows">' + cbcatRowsHTML() + '</div></div>';
  var detail = '<div class="detail" id="detailpane">' + cbcatDetailHTML() + '</div>';
  var divider = '<div class="divider" id="divider" onmousedown="startDrag(event)" ontouchstart="startDrag(event)" role="separator" aria-label="Resize panes"><span class="grip"></span></div>';
  var showDetail = (UI.vp === 'mob') && UI.mdetail;
  return '<div class="panel ' + (showDetail ? 'showdetail' : '') + '" id="panel" style="--lw:' + UI.lw + 'px;--lh:' + UI.lh + 'px">' + list + divider + detail + '</div>';
}
/* Hand off to the Catalogue with its filter already set — the count and the fix live on different screens. */
function cbcatGoUncategorised(){ UI._prodCatg = '__none'; navTo('catalogue'); }

function cbcatCss(){
  if (document.getElementById('cbcat_css')) return;
  var s = document.createElement('style'); s.id = 'cbcat_css';
  s.textContent = [
    '.cbcat-n{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;color:var(--grey);',
    'background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:1px 9px;flex:0 0 auto}',
    '.cbcat-badge{font-size:10.5px;font-weight:700;border-radius:6px;padding:1px 7px;text-transform:uppercase;letter-spacing:.04em}',
    '.cbcat-badge.ret{background:#eceaea;color:#6f6a6a}',
    '.cbcat-err{font-size:12.5px;color:#b4453f;background:#fbeceb;border:1px solid #f0c9c6;border-radius:9px;padding:8px 11px;margin:8px 0}',
    '.cbcat-note{font-size:12px;line-height:1.55;color:#6b5a36;background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;margin-bottom:11px}',
    '.cbcat-note.warn{color:#8a5a1e}',
    '.cbcat-stat{display:flex;align-items:baseline;gap:9px;margin-bottom:4px}',
    '.cbcat-stat .v{font-size:26px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
    '.cbcat-stat .k{font-size:12.5px;color:var(--grey)}',
    '.cbcat-plist{border:1px solid var(--line);border-radius:9px;overflow:hidden}',
    '.cbcat-prow{display:flex;gap:9px;align-items:baseline;padding:7px 11px;font-size:13px;border-bottom:1px dashed var(--line)}',
    '.cbcat-prow:last-child{border-bottom:0}',
    '.cbcat-also{margin-left:auto;font-size:11px;color:var(--grey);white-space:nowrap}',
    '.cbcat-none{font-size:12.5px;color:var(--grey);line-height:1.6}'
  ].join('');
  (document.head || document.documentElement).appendChild(s);
}
