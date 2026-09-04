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
      /* ⭐ `parent` RIDES IN `rules` — free-form jsonb, so a tree costs NO MIGRATION (backlog 22, step 1).
         Same trick that let multi-category ship against live data this morning. */
      return { id: d.definition_id, name: d.name, note: d.note || '', status: d.status || 'draft',
               parent: (d.rules && d.rules.parent) || null,
               /* ⭐ The middle rung of the tax inheritance, riding in `rules` beside `parent` for the same
                  reason: free-form jsonb, so a second attribute on a category costs no migration. */
               default_slab: (d.rules && d.rules.default_slab) || null,
               version: d.current_version || 1, created_at: d.created_at };
    });
    cbcatOrder();
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

/**
 * ⭐⭐ THE TREE — depth-first order plus a `depth` on each row (backlog 22, step 2).
 *
 * Every standard classification is hierarchical: GS1 GPC is 4 fixed levels (Segment › Family › Class › Brick),
 * Google's taxonomy runs to 7. A flat list held `Grains` and `Flour`; it will not hold
 * `Food, Beverages & Tobacco › Food Items › Grains, Rice & Cereal › Rice`, which is both what a real catalogue
 * looks like and what a counterparty's system will send us.
 *
 * ⚠️ SORTING IS DONE ONCE, HERE, and the list stays flat with a `depth` — not nested arrays. Every consumer
 * (rows, the detail pane, the parent picker) then reads one shape, and indenting is a CSS concern rather than a
 * recursive renderer each caller has to get right.
 *
 * ⚠️ AN ORPHAN IS SHOWN AT THE ROOT, NEVER DROPPED. A category whose parent was retired or deleted still exists
 * and still classifies products; hiding it would make a shelf's contents unreachable from the screen that manages
 * shelves. ⚠️ AND A CYCLE CANNOT HANG THIS: `seen` guarantees every node is emitted exactly once, so a → b → a
 * renders as two roots rather than looping forever. Cycles should be impossible (see cbcatWouldCycle) — this is
 * the belt to that braces, because a UI that freezes teaches nothing about the data that froze it.
 */
function cbcatOrder(){
  var all = CBCAT_UI.list || [];
  var byParent = {}, seen = {};
  all.forEach(function(c){ var k = c.parent || '_root'; (byParent[k] = byParent[k] || []).push(c); });
  var ids = {}; all.forEach(function(c){ ids[c.id] = 1; });
  /* A parent that no longer exists is a root, so its children stay reachable. */
  all.forEach(function(c){ if (c.parent && !ids[c.parent]) { (byParent._root = byParent._root || []).push(c); } });
  var cmp = function(a,b){
    if ((a.status === 'retired') !== (b.status === 'retired')) return a.status === 'retired' ? 1 : -1;
    return a.name.localeCompare(b.name);
  };
  var out = [];
  (function walk(key, depth){
    (byParent[key] || []).sort(cmp).forEach(function(c){
      if (seen[c.id]) return;
      seen[c.id] = 1; c.depth = depth; out.push(c);
      walk(c.id, depth + 1);
    });
  })('_root', 0);
  /* Anything still unseen was in a cycle — emit it flat rather than lose it. */
  all.forEach(function(c){ if (!seen[c.id]) { c.depth = 0; out.push(c); } });
  CBCAT_UI.list = out;
}
/** Would making `id` a child of `parentId` create a loop? Walk up from the proposed parent looking for `id`. */
function cbcatWouldCycle(id, parentId){
  var by = {}; (CBCAT_UI.list || []).forEach(function(c){ by[c.id] = c; });
  var hops = 0, p = parentId;
  while (p && hops++ < 64) { if (p === id) return true; p = by[p] ? by[p].parent : null; }
  return false;
}
/** Every category except the one being edited and its own descendants — the legal parents. */
function cbcatParentOptions(id){
  return (CBCAT_UI.list || []).filter(function(c){
    return c.status !== 'retired' && c.id !== id && !cbcatWouldCycle(c.id, id) && !(id && cbcatWouldCycle(id, c.id));
  });
}

/**
 * ⭐⭐ THE MIDDLE RUNG OF THE TAX INHERITANCE — Athi, 2026-09-03: *"each product has different tax criteria, so it
 * has to be product specific, but there are slabs"*.
 *
 * Tally sets a GST rate on the stock item, the stock GROUP and the company, and takes the most specific that
 * answers. This is the group rung: rice does not need its own slab if everything in Grains is 5%.
 *
 * ⚠️ IT RIDES IN `rules`, like `parent` — free-form jsonb, so a second attribute on a category costs no migration.
 * ⚠️ LIVE SLABS ONLY, and read through `cbDefsLive` — core.js's one live-definition loader, cached per kind. A
 * fourth private fetch here is how four screens come to disagree about what is on the shelf.
 * ⚠️ A category in a product's list that names no slab is SKIPPED, not treated as "no tax" — see lib/tax-slab.js.
 */
function cbcatSlabPickHTML(f){
  var slabs = (typeof cbDefsCached === 'function') ? cbDefsCached('tax') : null;
  if (slabs === null) {
    if (typeof cbDefsLive === 'function') cbDefsLive('tax').then(function(){ if (CBCAT_UI.form) cbcatPaint(); });
    return '<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:8px">' + tx('reading your slabs…') + '</div>';
  }
  /* ⚠️ An empty picker says WHY and where to go. A lone blank option reads as "this category cannot have one". */
  if (!slabs.length) return '<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:8px">'
    + txf('No live slab yet — name one under {where}.', { where: '<b>' + tx('Catalogue setup') + ' › ' + tx('Tax') + '</b>' })
    + '</div>';
  var cur = f.default_slab || '';
  return '<select class="inp" data-testid="catg-slab" onchange="cbcatField(\'default_slab\',this.value)">'
    + '<option value="">— ' + esc(tx('inherit the catalogue default')) + ' —</option>'
    + cbSlabOptionsHTML(slabs, cur)   /* the jurisdiction's slabs first, then this entity's own — one builder, three pickers */
    + '</select>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin:-4px 0 8px">'
    + tx('Products here that name no slab of their own use this.') + '</div>';
}

/* ── write ───────────────────────────────────────────────────────────────────────────────────────────────────── */
async function cbcatSave(){
  var f = CBCAT_UI.form; if (!f) return;
  var name = (f.name || '').trim();
  var err = document.getElementById('cbcat_err');
  if (name.length < 2) { if (err) err.textContent = 'Give it a name of at least 2 characters.'; return; }
  /**
   * ⚠️ A duplicate NAME is refused here rather than merged. Two shelves reading "Grains" is indistinguishable on
   * every screen that shows only the word, and the products under each would look like one set that lost half.
   *
   * ⚠️⚠️ THE CHECK IS GLOBAL PER ENTITY, NOT PER PARENT — AND THAT IS A REAL LIMIT ON THE TREE, not a UI choice.
   * `definition` carries `UNIQUE (entity_id, kind, name)` (b160), so the DATABASE forbids two categories of one
   * name however deep they sit. In a real taxonomy siblings-unique is the normal rule and repeated leaf names are
   * everywhere — Google's has "Accessories" under a dozen branches. So a full-scale seed WILL collide.
   * ⭐ Recorded in backlog 22: seeding beyond a small set needs that constraint relaxed to
   * `(entity_id, kind, parent, name)`, which is a MIGRATION. Keeping this check global means the client refuses
   * exactly what the server would refuse, instead of offering something that fails on save.
   */
  var clash = (CBCAT_UI.list || []).filter(function(c){
    return c.id !== f.id && c.status !== 'retired' && c.name.toLowerCase() === name.toLowerCase(); })[0];
  if (clash) { if (err) err.textContent = 'You already have a live category called “' + clash.name + '”.'; return; }
  try {
    if (f.id) {
      /* ⚠️⚠️ EVERY RULE KEY IS RE-SENT, ALWAYS. PUT /definitions/:id replaces `rules` wholesale (it writes a new
         version row from exactly what it is given), so sending `{parent}` alone would silently DROP the default
         slab the moment anyone renamed a category — data loss with no error and nothing on screen to show it. */
      await api('defSave', { params: { id: f.id }, body: { name: name, note: f.note || '', rules: cbcatRules(f) } });
      toast('Renamed — every product that cites it follows.');
    } else {
      var r = await api('defAdd', { body: { kind: 'category', sub_kind: null, name: name, note: f.note || '', rules: cbcatRules(f) } });
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

/**
 * ⭐⭐ SEED A SMALL STANDARD SET — real Google Product Taxonomy nodes, per trade (backlog 22 step 3).
 *
 * ⚠️ OPT-IN AND CONFIRMED, NEVER AUTOMATIC. A shelf that arrives pre-filled is worse than an empty one: you
 * cannot tell what you chose from what arrived, and the first thing anyone does is delete rows they did not ask
 * for. Akeneo ships its demo tree the same way, for the same reason.
 *
 * ⚠️ IT ADDS, IT NEVER REPLACES. Anything you already made stays. A name that already exists is SKIPPED rather
 * than duplicated or overwritten — `definition` carries UNIQUE (entity_id, kind, name), so a collision would
 * fail the whole run otherwise, and silently renaming someone's category to make room would be worse.
 *
 * ⚠️ PARENTS FIRST, THEN CHILDREN. A child's `parent` is a definition_id that does not exist until its parent is
 * created, so the run is ordered and maps taxonomy ids → our ids as it goes. Getting this backwards produces a
 * flat list of orphans that LOOKS like a successful seed.
 */
function cbcatSeedAsk(){
  if (typeof CB_STARTER_CATEGORIES === 'undefined') { toast('Starter sets are not loaded.', true); return; }
  var opts = Object.keys(CB_STARTER_CATEGORIES).map(function(v){
    var s = CB_STARTER_CATEGORIES[v];
    return '<div class="bulkrow"><span class="bn">' + esc(s.title) + '</span>'
      + '<span class="bh">' + s.nodes.length + ' categories</span>'
      /* ⭐ "See these" — Athi, 2026-09-02: *"there is no way of knowing what they are."* The button used to add
         all 26 sight unseen; it now opens the list, which is where the choosing happens. Same testid, because
         the specs address the SET, and which press it takes to finish is not what they are asserting. */
      + '<button type="button" class="badd" data-testid="catg-seed-' + esc(v) + '"'
      + ' onclick="cbcatSeedPick(\'' + esc(v) + '\')">' + tx('See these →') + '</button></div>';
  }).join('');
  modal('<div class="mhd"><div class="t">' + tx('Start from a standard set') + '</div>'
    + '<div class="s">real categories from the Google Product Taxonomy</div></div>'
    + '<div class="mbody"><div style="font-size:var(--fs-2);line-height:1.6;color:var(--ink);margin-bottom:10px">'
    + 'Pick the trade you are in and its usual categories are added, nested as the standard nests them. '
    + '<b>Nothing you already have is changed</b> — names that already exist are skipped.'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:6px">⚠️ These are a starting point, not a '
    + 'ceiling. Rename, retire or add your own afterwards — they are ordinary categories from the moment they '
    + 'land.</div></div>'
    + '<div class="bulklist">' + opts + '</div></div>'
    + '<div class="mfoot"><button onclick="closeModal()">' + tx('Cancel') + '</button></div>');
}
/**
 * ── ⭐⭐ SEE WHAT IS IN A SET, AND TAKE THE PART YOU WANT ──────────────────────────────────────────────────────
 *
 * Athi, 2026-09-02: *"we are providing option to opt from standard set, but there is no way of knowing what they
 * are… say out of 26 they may be interested in 20 plus few more of their own, so if we can provide facility to
 * add it, that would be good."*
 *
 * ⚠️ "26 categories · Add these" IS A BLIND ALL-OR-NOTHING BUTTON, and both halves of that are the problem. The
 * count is not a description — nobody can tell whether those 26 are the right 26 — and even a reader who knew
 * would have to accept every one and then delete six, which is exactly the "you cannot tell what you chose from
 * what arrived" failure the seed was designed to avoid in the first place. So the list opens, everything starts
 * ticked (the old behaviour is one press away, unchanged), and what is unticked is simply never created.
 *
 * ⭐ THE TREE HAS TO STAY A TREE, so the ticks cascade BOTH ways:
 *     untick a parent → its children go too   (a child whose parent was never created is an orphan)
 *     tick a child    → its parent comes back (the standard nests them; half a branch is not the standard)
 * Said once on screen rather than discovered by a reader wondering why a box moved on its own.
 *
 * ⚠️ THE SELECTION IS HELD IN `CBCAT_SEED`, NOT READ OFF THE DOM AT THE END. A checkbox list read at submit time
 * loses everything the moment anything repaints, and this modal repaints its own counter on every tick.
 */
var CBCAT_SEED = { v: null, sel: null };

/** Children of a node, and their children — used by both cascade directions. */
function cbcatSeedKids(nodes, gid){
  var out = [], q = [gid];
  while (q.length) {
    var g = q.shift();
    nodes.forEach(function(n){ if (n.parent === g) { out.push(n.gid); q.push(n.gid); } });
  }
  return out;
}

function cbcatSeedPick(v){
  var set = CB_STARTER_CATEGORIES[v]; if (!set) return;
  CBCAT_SEED = { v: v, sel: {} };
  set.nodes.forEach(function(n){ CBCAT_SEED.sel[n.gid] = 1; });   // everything, as "Add these" always did

  var rows = set.nodes.map(function(n){
    var kid = !!n.parent;
    return '<label class="bulkrow" style="cursor:pointer' + (kid ? ';padding-inline-start:30px' : '') + '">'
      + '<input type="checkbox" checked data-seedgid="' + esc(n.gid) + '"'
      + ' data-testid="catg-seed-node-' + esc(n.gid) + '"'
      + ' onchange="cbcatSeedTick(\'' + esc(n.gid) + '\', this.checked)">'
      + '<span class="bn" style="font-weight:' + (kid ? '400' : '700') + '">' + esc(n.name) + '</span>'
      /**
       * ⚠️⚠️ THE TAXONOMY ID IS BEHIND 🧾 Spec — Athi, 2026-09-02: *"codes are there, what are those, are we
       * using it inside… if it is something not useful to the person choosing we may not be required to
       * showcase."*
       *
       * ⭐ MEASURED BEFORE ANSWERING: `gpc` appears in exactly ONE place in the whole codebase — the write, four
       * lines from here. Nothing reads it, in the web or the API. It is stored so a category can one day carry
       * its standard code to a feed or a counterparty's system (backlog 22 step 4), and it costs nothing to keep
       * writing — but today it does nothing, and a category the person adds themselves never gets one at all.
       *
       * So on the row it was a bare number, meaning nothing to the reader, on the one screen whose entire job is
       * choosing which NAMES to adopt. Kept for the reader who wants to verify the seed really is the published
       * taxonomy — the same reader, and the same decision, as the STD_SCHEMES file path earlier today.
       */
      + ((typeof specOn === 'function' && specOn())
          ? '<span class="bh" title="' + esc(tx('Google Product Taxonomy id — stored with the category, not yet read by anything'))
            + '">' + esc(n.gid) + '</span>' : '')
      + '</label>';
  }).join('');

  modal('<div class="mhd"><div class="t">' + esc(set.title) + '</div>'
    + '<div class="s">' + tx('real categories from the Google Product Taxonomy') + '</div></div>'
    + '<div class="mbody">'
    + '<div style="font-size:var(--fs-2);line-height:1.6;margin-bottom:8px">'
    + tx('Untick anything you do not want. A child needs its parent, so those two travel together.')
    + '</div>'
    /* ⚠️ SMALL PILLS, NOT `.btn ghost` — which is a full-width primary inside a modal footer and rendered these
       two as the loudest things on a screen whose subject is the list below them. The same pill the set rows
       already use (`.bulkrow button`), so the modal has one button vocabulary rather than two. */
    + '<div style="display:flex;gap:7px;align-items:center;margin-bottom:8px">'
    + '<button type="button" data-testid="catg-seed-all" onclick="cbcatSeedAll(true)"'
    + ' style="border:1px solid var(--line);background:var(--card);color:var(--on-card);border-radius:20px;'
    + 'padding:3px 12px;font-size:var(--fs-1);cursor:pointer">' + tx('All') + '</button>'
    + '<button type="button" data-testid="catg-seed-none" onclick="cbcatSeedAll(false)"'
    + ' style="border:1px solid var(--line);background:var(--card);color:var(--on-card);border-radius:20px;'
    + 'padding:3px 12px;font-size:var(--fs-1);cursor:pointer">' + tx('None') + '</button>'
    + '<span id="cbcat_seed_n" style="margin-inline-start:auto;font-size:var(--fs-1);color:var(--grey);'
    + 'white-space:nowrap"></span>'
    + '</div>'
    + '<div class="bulklist">' + rows + '</div>'
    /* ⭐ "plus few more of their own" — created alongside, as ordinary top-level categories. They are NOT part of
       the standard, so they carry no `gpc` id: claiming a taxonomy code for a name somebody typed would put a
       false citation on the record, and the whole point of the seed is that the codes are real. */
    + '<div style="margin-top:11px">'
    + '<label class="fl">' + tx('Add your own as well') + '</label>'
    + '<input class="inp" id="cbcat_seed_own" data-testid="catg-seed-own"'
    + ' placeholder="' + esc(tx('one per line, or separated by commas')) + '">'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px">'
    + tx('Yours are created at the top level, with no standard code — they are not part of this taxonomy.')
    + '</div></div>'
    + '</div>'
    + '<div class="mfoot"><button onclick="closeModal()">' + tx('Cancel') + '</button>'
    + '<button class="pri" id="cbcat_seed_go" data-testid="catg-seed-go" onclick="cbcatSeedGo()"></button></div>', true);
  cbcatSeedCount();
}

/** The counter and the primary's label — the only two things a tick changes. */
function cbcatSeedCount(){
  var set = CB_STARTER_CATEGORIES[CBCAT_SEED.v] || { nodes: [] };
  var n = Object.keys(CBCAT_SEED.sel || {}).length, tot = set.nodes.length;
  var el = document.getElementById('cbcat_seed_n');
  if (el) el.textContent = txf('{n} of {tot} selected', { n: n, tot: tot });
  var go = document.getElementById('cbcat_seed_go');
  if (go) {
    go.textContent = n ? txn('Add {count} category', 'Add {count} categories', n) : tx('Add your own only');
    go.disabled = false;
  }
}

/**
 * ⚠️ THE DOM IS UPDATED DIRECTLY, NOT BY REPAINTING THE LIST. Re-rendering would throw away whatever has been
 * typed into "add your own" and drop the reader back at the top of a 26-row list mid-decision.
 */
function cbcatSeedTick(gid, on){
  var set = CB_STARTER_CATEGORIES[CBCAT_SEED.v]; if (!set) return;
  var touch = [gid].concat(on
    ? cbcatSeedAncestors(set.nodes, gid)      // a child needs its parent
    : cbcatSeedKids(set.nodes, gid));         // a parent's children cannot outlive it
  touch.forEach(function(g){
    if (on) CBCAT_SEED.sel[g] = 1; else delete CBCAT_SEED.sel[g];
    var box = document.querySelector('[data-seedgid="' + g + '"]');
    if (box) box.checked = !!on;
  });
  cbcatSeedCount();
}

function cbcatSeedAncestors(nodes, gid){
  var out = [], by = {};
  nodes.forEach(function(n){ by[n.gid] = n; });
  var cur = by[gid];
  while (cur && cur.parent) { out.push(cur.parent); cur = by[cur.parent]; }
  return out;
}

function cbcatSeedAll(on){
  var set = CB_STARTER_CATEGORIES[CBCAT_SEED.v]; if (!set) return;
  CBCAT_SEED.sel = {};
  set.nodes.forEach(function(n){ if (on) CBCAT_SEED.sel[n.gid] = 1; });
  document.querySelectorAll('[data-seedgid]').forEach(function(b){ b.checked = !!on; });
  cbcatSeedCount();
}

function cbcatSeedGo(){
  var el = document.getElementById('cbcat_seed_own');
  var own = (el ? el.value : '').split(/[\n,]/).map(function(s){ return s.trim(); }).filter(Boolean);
  var sel = Object.assign({}, CBCAT_SEED.sel || {});
  if (!Object.keys(sel).length && !own.length) { toast(tx('Nothing selected.'), true); return; }
  cbcatSeedRun(CBCAT_SEED.v, sel, own);
}

/**
 * @param only  {gid:1} of the nodes to create. ABSENT means every node — the pre-picker behaviour, kept so any
 *              caller that has not learned about the picker still works exactly as it did.
 * @param own   names the reader typed, created at the top level with no standard code.
 */
async function cbcatSeedRun(vertical, only, own){
  var set = CB_STARTER_CATEGORIES[vertical]; if (!set) return;
  closeModal();
  /* ⚠️ Filtered BEFORE the count, or the progress line promises rows that were never going to be created. */
  var picked = only ? set.nodes.filter(function(n){ return !!only[n.gid]; }) : set.nodes.slice();
  var ownNames = (own || []).slice();
  showBusy(txn('Adding {count} category…', 'Adding {count} categories…', picked.length + ownNames.length));
  var made = {}, added = 0, skipped = 0, failed = 0;
  try {
    var have = {};
    (CBCAT_UI.list || []).forEach(function(c){ have[c.name.toLowerCase()] = c.id; });
    /* Ordered so a parent always exists before its child asks for it. */
    var ordered = picked.slice().sort(function(a,b){ return (a.parent ? 1 : 0) - (b.parent ? 1 : 0); });
    for (var i = 0; i < ordered.length; i++) {
      var n = ordered[i];
      if (have[n.name.toLowerCase()]) { made[n.gid] = have[n.name.toLowerCase()]; skipped++; continue; }
      var parentId = n.parent ? (made[n.parent] || null) : null;
      try {
        var r = await api('defAdd', { body: { kind: 'category', sub_kind: null, name: n.name, note: '',
          /* ⚠️ `gpc` keeps the taxonomy id beside the parent, so a category can later carry its standard code
             instead of being re-matched by name. Costs nothing now and is the hook backlog 22 step 4 needs. */
          rules: { parent: parentId, gpc: n.gid } } });
        var id = r && (r.definition_id || (r.definition && r.definition.definition_id));
        if (!id) { failed++; continue; }
        await api('defSave', { params: { id: id }, body: { status: 'live' } });
        made[n.gid] = id; have[n.name.toLowerCase()] = id; added++;
      } catch (e) { failed++; }
    }
    /**
     * ⭐ "plus few more of their own" — created in the SAME run so one press does the whole job.
     *
     * ⚠️ NO `gpc`. These are names somebody typed; stamping a taxonomy code on one would put a false citation on
     * the record, and the codes being real is the entire reason the standard set is worth offering.
     * ⚠️ Skipped if the name already exists, exactly like a standard node — the UNIQUE (entity_id, kind, name)
     * constraint would otherwise fail the row, and silently renaming somebody's category to make room is worse.
     */
    for (var j = 0; j < ownNames.length; j++) {
      var nm = ownNames[j];
      if (have[nm.toLowerCase()]) { skipped++; continue; }
      try {
        var ro = await api('defAdd', { body: { kind: 'category', sub_kind: null, name: nm, note: '',
          rules: { parent: null } } });
        var oid = ro && (ro.definition_id || (ro.definition && ro.definition.definition_id));
        if (!oid) { failed++; continue; }
        await api('defSave', { params: { id: oid }, body: { status: 'live' } });
        have[nm.toLowerCase()] = oid; added++;
      } catch (e) { failed++; }
    }
  } finally { hideBusy(); }
  if (typeof cbCatgLive === 'function') await cbCatgLive(true);
  await cbcatLoad(true);
  /* ⚠️ Report skips and failures. A seed that says "done" while a third of it silently did not land is how
     someone spends an afternoon wondering where their tree went. */
  toast(added + ' added'
    + (skipped ? ' · ' + skipped + ' already there' : '')
    + (failed ? ' · ' + failed + ' could not be created' : ''), failed ? true : false);
}

/* ── interaction ─────────────────────────────────────────────────────────────────────────────────────────────── */
function cbcatSelect(id){ CBCAT_UI.sel = id; CBCAT_UI.mode = 'view'; CBCAT_UI.form = null;
  if (UI.vp === 'mob') { UI.mdetail = true; var p = document.getElementById('panel'); if (p) p.classList.add('showdetail'); }
  cbcatPaint(); }
/** The whole `rules` object a category writes. ⚠️ ONE builder, both call sites — see the note in cbcatSave. */
function cbcatRules(f){
  return { parent: f.parent || null, default_slab: f.default_slab || null };
}
function cbcatNew(){ CBCAT_UI.mode = 'edit'; CBCAT_UI.sel = null; CBCAT_UI.form = { id: null, name: '', note: '', parent: CBCAT_UI.sel || null, default_slab: null };
  if (UI.vp === 'mob') { UI.mdetail = true; var p = document.getElementById('panel'); if (p) p.classList.add('showdetail'); }
  cbcatPaint(); }
function cbcatEdit(id){
  var c = (CBCAT_UI.list || []).filter(function(x){ return x.id === id; })[0]; if (!c) return;
  CBCAT_UI.mode = 'edit'; CBCAT_UI.form = { id: c.id, name: c.name, note: c.note, parent: c.parent || null,
                                            default_slab: c.default_slab || null }; cbcatPaint();
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
    /* ⚠️ A SEARCH THAT FOUND NOTHING IS NOT AN EMPTY SHELF, so no action is offered in that branch —
       'make a category' is the wrong next step when the real one is 'type a different word'. */
    return CBCAT_UI.q
      ? emptyState('🏷️', tx('Nothing matches that'), tx('Try a different word.'))
      : emptyState('🏷️', tx('No categories yet'),
          tx('A category is how a shelf gets sorted. Attach products to it from the Catalogue.'),
          { label: tx('+ New category'), onclick: 'cbcatNew()' });
  }
  return rows.map(function(c){
    var n = (CBCAT_UI.counts && CBCAT_UI.counts.by[c.id]) || 0;
    var ret = c.status === 'retired';
    return '<div class="row' + (c.id === CBCAT_UI.sel ? ' sel' : '') + '" data-testid="catg-row-' + esc(c.id) + '"'
      + ' onclick="cbcatSelect(\'' + esc(c.id) + '\')"' + (ret ? ' style="opacity:.72"' : '') + '>'
      + '<div style="flex:1;min-width:0;padding-inline-start:' + ((c.depth||0)*16) + 'px">'
      +   '<div style="display:flex;align-items:center;gap:7px">'
      +     '<b style="font-size:var(--fs-3)' + (ret ? ';text-decoration:line-through' : '') + '">' + esc(c.name) + '</b>'
      +     (ret ? '<span class="cbcat-badge ret">retired</span>' : '')
      +   '</div>'
      +   (c.note ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:1px">' + esc(c.note) + '</div>' : '')
      + '</div>'
      /* The count is the reason to look at this list at all — which shelves are actually carrying anything. */
      + cbcatTaxChipHTML(c.id)
      + '<span class="cbcat-n" title="products in this category">' + n + '</span>'
      + '</div>';
  }).join('');
}
function cbcatDetailHTML(){
  if (CBCAT_UI.mode === 'edit') {
    var f = CBCAT_UI.form || { name: '', note: '' };
    var editing = !!f.id;
    return '<div class="dh"><button class="dback" onclick="cbcatBack()">‹ Categories</button>'
      /* ⭐ "EDIT", NOT "RENAME". Athi, 2026-09-03: *"You are bringing category organization (sits under) under
         rename … Is it renaming? so do we have a proper name for that?"* The form edits three facts — name, PARENT,
         note — and only one of them is a rename. Moving a category is a different act: every product under it
         travels, so the parent field says how many. */
      + '<div class="dt">' + (editing ? tx('Edit category') : tx('New category')) + '</div>'
      + '<div class="ds">' + (editing ? tx('name · parent · note — products follow') : tx('goes on the shelf live')) + '</div></div>'
      + '<div class="db">'
      + (editing
          ? '<div class="cbcat-note">'
            + txf('Renaming is safe — every product follows. ⚠️ A copy of the old name travels with items already in a {other} catalogue, and that copy deliberately does not change.', {
                other: tx('counterparty’s') })
            /* ⭐ WHY it is safe is the mechanism: products cite the category by id, not by the word. */
            + specNote('categories.rename', 'Products cite a category by <b>id</b>, never by its word, so a rename propagates without touching any item.')
            + '</div>'
          : '')
      + '<label class="fl">' + tx('Name') + '</label>'
      + '<input class="inp" id="cbcat_name" data-testid="catg-name" value="' + esc(f.name || '') + '"'
      + ' placeholder="Grains" oninput="cbcatField(\'name\',this.value)">'
      + '<label class="fl">' + tx('Parent category') + '</label>'
      + cbcatParentPickHTML(f)
      + (editing
          ? '<div style="font-size:var(--fs-1);color:var(--grey);margin:-4px 0 8px">'
            + txf('Changing the parent MOVES this category — {n} product(s) travel with it, and every product under it inherits the new branch.',
                  { n: String((CBCAT_UI.counts && CBCAT_UI.counts.by && CBCAT_UI.counts.by[f.id]) || 0) })
            + '</div>'
          : '')
      + '<label class="fl">' + tx('Default tax slab') + '</label>'
      + cbcatSlabPickHTML(f)
      + '<label class="fl">' + tx('Note') + '</label>'
      + '<input class="inp" value="' + esc(f.note || '') + '" placeholder="optional — what belongs here"'
      + ' oninput="cbcatField(\'note\',this.value)">'
      + '<div class="err" id="cbcat_err" style="margin-top:8px"></div>'
      + '</div>'
      + '<div class="actbar"><button class="pri" data-testid="catg-save" onclick="cbcatSave()">'
      + (editing ? 'Save' : 'Create') + '</button><button onclick="cbcatCancel()">' + tx('Cancel') + '</button></div>';
  }

  var c = (CBCAT_UI.list || []).filter(function(x){ return x.id === CBCAT_UI.sel; })[0];
  if (!c) {
    /* ⚠️ THE SCHEMES SHOW HERE TOO. They describe classification in general, not one category — so hanging them
       only off a selected row meant they were invisible on the screen someone lands on. */
    /* ⭐ 'Or make a new one' was prose pointing at a button elsewhere. It is the button now. */
    return '<div class="db">' + emptyState('🏷️', tx('Pick a category'),
        tx('Categories sort your catalogue and give buyers a way to narrow it.'),
        { label: tx('+ New category'), onclick: 'cbcatNew()' })
      + cbcatSchemesHTML() + '</div>';
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
    + (function(){ var t = cbcatTaxOf(c.id); return '<div class="sec">' + tx('Applied here') + '</div>'
        + '<div class="cbcat-stat" data-testid="catg-tax-applied"><span class="v">' + (t === null ? '…' : t ? (t.dead ? '⚠️' : (t.rate === null || t.rate === undefined ? '?' : t.rate + '%')) : '—') + '</span>'
        + '<span class="k">' + (t === null ? tx('reading the slabs…') : t ? (t.dead ? tx('cites a slab that is not active') : esc(t.name || '') + (t.inherited_from ? ' · ' + esc(tx('inherited from') + ' ' + t.inherited_from) : ' · ' + tx('set on this category'))) : tx('no slab here or above — products fall to the catalogue default')) + '</span></div>'; })()
    + '<div class="cbcat-stat"><span class="v">' + n + '</span><span class="k">product' + (n === 1 ? '' : 's') + ' in this category</span></div>'
    /* ⭐ THE REVERSE VIEW. An offer can target a category ("10% off Paints") and until now only the offer knew.
       Athi, 2026-09-03: *"if we want to manage products at category level, can we add here, like this category is
       under offer."* Same live-offers read the product page uses — one loader, one cache. */
    + cbcatOffersHereHTML(c.id)
    + '<div class="sec">' + tx('Products') + '</div>'
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
        : '<div class="cbcat-none">Nothing here yet. Attach products from <span onclick="navTo(\'catalogue\')" style="color:var(--blue);font-weight:600;cursor:pointer">' + tx('Catalogue') + '</span> — tick them and press <b>' + tx('Categorise') + '</b>.</div>')
    + '<details style="margin-top:8px"><summary style="cursor:pointer;color:var(--grey);font-size:var(--fs-1)">ⓘ ' + tx('About standard sets and codes') + '</summary>' + cbcatSchemesHTML() + '</details>'
    + '</div>'
    + '<div class="actbar">'
    +   (ret ? '<button class="pri" data-testid="catg-relive" onclick="cbcatRelive(\'' + esc(c.id) + '\')">' + tx('Put back on the shelf') + '</button>'
            : '<button class="pri" data-testid="catg-edit" onclick="cbcatEdit(\'' + esc(c.id) + '\')">' + tx('Edit') + '</button>'
              + '<button data-testid="catg-retire" onclick="cbcatRetire(\'' + esc(c.id) + '\')">' + tx('Retire') + '</button>')
    + '</div>';
}
/**
 * ⭐ WHAT APPLIES TO A CATEGORY — Athi, 2026-09-05: "I applied 5% for the top category — it should reflect the categories
 * underneath; the left panel should show what tax is applied for this category; the view panel should show what is
 * currently applied and the products". The tax: the category's own slab, else the nearest ancestor's (rules.parent),
 * resolved against the same live slab list the product page uses. The offers: scoped to this category or to an ancestor.
 */
function cbcatById(id){ return (CBCAT_UI.list || []).filter(function (x) { return x.id === id; })[0] || null; }
function cbcatTaxOf(cid){
  var slabs = (typeof cbDefsCached === 'function' && cbDefsCached('tax')) || null;
  if (slabs === null && typeof cbDefsLive === 'function') { cbDefsLive('tax').then(cbcatPaint).catch(function(){}); return null; }
  var by = {}; (slabs || []).forEach(function (d) { by[String(d.definition_id || d.id)] = d; });
  var c = cbcatById(cid), hops = 0, from = null;
  while (c && hops++ < 16) {
    var sid = c.default_slab || c.slab || (c.rules && c.rules.default_slab);
    if (sid && by[String(sid)]) { var d = by[String(sid)]; return { slab_id: String(sid), name: d.name, rate: (d.rules && d.rules.rate), inherited_from: from }; }
    if (sid && !by[String(sid)]) return { slab_id: String(sid), name: null, rate: null, dead: true, inherited_from: from };
    from = c.name; c = c.parent ? cbcatById(c.parent) : null;
  }
  return null;
}
function cbcatAncestorIds(cid){ var out = [], c = cbcatById(cid), hops = 0; while (c && c.parent && hops++ < 16) { out.push(c.parent); c = cbcatById(c.parent); } return out; }
function cbcatTaxChipHTML(cid){
  var t = cbcatTaxOf(cid);
  if (t === null) return '';
  if (t.dead) return '<span class="cbcat-badge" data-testid="catg-tax-' + esc(cid) + '" style="color:var(--warn-3)">⚠️ ' + tx('slab not active') + '</span>';
  return '<span class="cbcat-badge" data-testid="catg-tax-' + esc(cid) + '" title="' + esc(t.name || '') + (t.inherited_from ? ' · ' + tx('inherits') + ' ' + esc(t.inherited_from) : '') + '">'
    + esc((t.rate === null || t.rate === undefined) ? (t.name || '?') : ('GST ' + t.rate + '%')) + (t.inherited_from ? ' <span style="opacity:.7">↑</span>' : '') + '</span>';
}
function cbcatOffersHereHTML(cid){
  var list = (typeof ctOffersEnsure === 'function') ? ctOffersEnsure(function(){ cbcatPaintDetail(); }) : null;
  if (!list) return '';
  var anc = cbcatAncestorIds(cid);
  var here = list.filter(function(o){ var at = (o.rules && o.rules.applies_to) || {}; return at.category === cid || (at.category && anc.indexOf(at.category) >= 0); });
  if (!here.length) return '';
  return '<div class="cbcat-stat" data-testid="catg-offers-here"><span class="v">' + here.length + '</span><span class="k">offer' + (here.length === 1 ? '' : 's')
    + ' appl' + (here.length === 1 ? 'ies' : 'y') + ' here — ' + here.map(function(o){ var at = (o.rules && o.rules.applies_to) || {}; var viaP = at.category !== cid ? (cbcatById(at.category) || {}).name : null; return esc(o.name) + (viaP ? ' <span style="color:var(--grey)">(' + esc(tx('via') + ' ' + viaP) + ')</span>' : ''); }).join(' · ') + '</span></div>';
}
function cbcatStatsHTML(){
  var n = cbcatVisible().length;
  return '<span style="font-size:var(--fs-1);color:var(--grey)">' + n + ' categor' + (n === 1 ? 'y' : 'ies') + '</span>'
    /* ⭐ The uncategorised count is a to-do list, so it is a BUTTON — it takes you to the products it is
       counting rather than merely reporting a number you then have to go and find by hand. */
    + ((CBCAT_UI.counts && CBCAT_UI.counts.none)
        ? '<button data-testid="catg-uncat" onclick="cbcatGoUncategorised()" style="margin-inline-start:auto;border:1px solid var(--gold-line);background:var(--gold-soft);border-radius:9px;padding:4px 9px;font-size:var(--fs-1);color:var(--warn-3);cursor:pointer">'
          + CBCAT_UI.counts.none + ' uncategorised <span class=arw>→</span></button>'
        : '');
}
/**
 * ⭐ THE CLASSIFICATION SCHEMES — rehomed here from Definitions (Athi's call, 2026-08-16).
 *
 * HS · GS1 GPC · Schema.org · UNSPSC · custom. These belong beside Categories because **they do the same job**:
 * they classify a product. Your categories are YOUR names for your shelf; a scheme is the world's name for the
 * same thing, and a product can carry both.
 *
 * ⭐ AND GS1 GPC IS THE ONE THE CATEGORY-TREE BACKLOG POINTS AT — the standard whose brick code each category is
 * meant to carry eventually (backlog 22). Putting the scheme list beside the category list means the standard
 * sits next to the thing it standardises, rather than in a screen about definitions in general.
 *
 * ⚠️ ALWAYS BY REFERENCE — you cite the code, you never copy the scheme. The blurb says so because it is the
 * whole difference between citing HS 1006 and inventing a private meaning for it.
 * ⚠️ Rows come from `cbDefRegistries()`, so this is a second READER of one list, never a second copy.
 */
function cbcatSchemesHTML(){
  if (typeof cbDefRegistries !== 'function') {
    ensureCap('definitions').then(function(){ cbcatPaintDetail(); });
    return '';
  }
  var s = cbDefRegistries().filter(function(x){ return x.key === 'standard'; })[0];
  if (!s || !(s.rows || []).length) return '';
  return '<div class="sec" style="margin-top:14px">' + tx('Classification schemes') + '</div>'
    + '<div class="cbcat-note" style="margin-bottom:8px">' + esc(s.blurb) + '</div>'
    + '<div class="cbcat-plist">'
    + s.rows.map(function(r){
        /**
         * ⭐ THE NAME ON ONE LINE, THE EXPLANATION UNDER IT — Athi, 2026-09-01: *"bring the explanation below the
         * HS-, this will give a better look. Ie: customer your own scheme in one line and the explanation can be
         * given below."* The note used to sit on the same line as the name, so the line people scan to find a
         * scheme was the longest line in the block.
         *
         * ⚠️ And the name is printed ONCE — `cbDefLabelOnce` drops the `HS — ` the label carries for use
         * elsewhere. That is the *"do we need two HS?"* he asked about.
         */
        var lab = (typeof cbDefLabelOnce === 'function') ? cbDefLabelOnce(r) : (r.label || '');
        return '<div class="cbcat-prow" style="display:block">'
          + '<div><code style="font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1)">'
          + esc(r.code) + '</code>'
          + (lab ? '<span style="margin-inline-start:8px;font-weight:600">' + esc(lab) + '</span>' : '')
          + '</div>'
          /**
           * ⚠️ `white-space:normal` AND `margin-inline-start:0` OVERRIDE THE SHARED CLASS ON PURPOSE.
           * `.cbcat-also` was built for the product list above, where it is a SHORT trailing hint pushed to the
           * right of one line and must not wrap. A scheme's note is three sentences, so under that class it ran
           * off the edge and gave the box a sideways scrollbar — visible in e2e/schemes.png before this, and
           * exactly the *"can we redesign the details in the boxes"* Athi asked about.
           *
           * ⭐ Overridden HERE rather than in the class, because the product list still wants the old behaviour.
           * Changing the shared rule would have fixed this box and broken that one.
           */
          + (r.note ? '<div class="cbcat-also" style="margin-inline-start:0;margin-top:2px;display:block;'
                    + 'white-space:normal;line-height:1.5;max-width:78ch">' + esc(r.note) + '</div>' : '') + '</div>';
      }).join('')
    + '</div>'
    /**
     * ⭐ THE SOURCE LINE MOVED BEHIND 🧾 Spec — Athi: *"read from app/catalogue-model.js · STD_SCHEMES, is it
     * necessary?"* For someone choosing a scheme, no: a file path cannot help anyone decide anything.
     *
     * ⚠️ Not deleted, though. Naming where the list comes from is what makes "we keep no list of our own"
     * checkable instead of a promise in a comment. Spec mode exists for exactly that reader, so the claim stays
     * verifiable and stops being a footnote on everybody else's screen.
     */
    + ((typeof specOn === 'function' && specOn())
        ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:5px">read from <code>'
          + esc(s.source) + '</code></div>' : '');
}
/**
 * The parent picker. ⚠️ Options are indented with the same depth the list uses, so "sits under" is answered by
 * the shape of the dropdown rather than by remembering what the tree looked like a moment ago.
 */
function cbcatParentPickHTML(f){
  var opts = cbcatParentOptions(f.id);
  if (!opts.length) return '<div style="font-size:var(--fs-2);color:var(--grey);margin:2px 0 4px">Nothing to sit under yet — this will be a top-level category.</div>';
  return '<select class="inp" data-testid="catg-parent" onchange="cbcatField(\'parent\', this.value || null)">'
    + '<option value="">— top level —</option>'
    + opts.map(function(c){
        var pad = new Array((c.depth || 0) + 1).join('  ');
        return '<option value="' + esc(c.id) + '"' + ((f.parent === c.id) ? ' selected' : '') + '>'
          + pad + esc(c.name) + '</option>';
      }).join('')
    + '</select>';
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
    +   '<span style="font-family:\'Space Grotesk\';font-weight:700;font-size:var(--fs-3)">' + tx('🏷️ Categories') + '</span>'
    + '</div>'
    + '<button class="composebtn" style="width:100%;justify-content:center" data-testid="catg-new" onclick="cbcatNew()">+ New category</button>'
    + '<button class="composebtn" style="width:100%;justify-content:center;margin-top:7px;background:var(--card);color:var(--blue);border:1px solid var(--line)" data-testid="catg-seed" onclick="cbcatSeedAsk()">' + tx('📐 Start from a standard set') + '</button>'
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
    '.cbcat-n{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1);color:var(--grey);',
    'background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:1px 9px;flex:0 0 auto}',
    '.cbcat-badge{font-size:var(--fs-1);font-weight:700;border-radius:6px;padding:1px 7px;text-transform:uppercase;letter-spacing:.04em}',
    '.cbcat-badge.ret{background:var(--neutral-tint);color:var(--ink-2)}',
    '.cbcat-err{font-size:var(--fs-2);color:var(--disp);background:var(--danger-tint);border:1px solid #f0c9c6;border-radius:9px;padding:8px 11px;margin:8px 0}',
    '.cbcat-note{font-size:var(--fs-2);line-height:1.55;color:var(--warn-3);background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:9px 11px;margin-bottom:11px}',
    '.cbcat-note.warn{color:var(--warn-2)}',
    '.cbcat-stat{display:flex;align-items:baseline;gap:9px;margin-bottom:4px}',
    '.cbcat-stat .v{font-size:var(--fs-6);font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
    '.cbcat-stat .k{font-size:var(--fs-2);color:var(--grey)}',
    '.cbcat-plist{border:1px solid var(--line);border-radius:9px;overflow:hidden}',
    '.cbcat-prow{display:flex;gap:9px;align-items:baseline;padding:7px 11px;font-size:var(--fs-2);border-bottom:1px dashed var(--line)}',
    '.cbcat-prow:last-child{border-bottom:0}',
    '.cbcat-also{margin-inline-start:auto;font-size:var(--fs-1);color:var(--grey);white-space:nowrap}',
    '.cbcat-none{font-size:var(--fs-2);color:var(--grey);line-height:1.6}'
  ].join('');
  (document.head || document.documentElement).appendChild(s);
}
