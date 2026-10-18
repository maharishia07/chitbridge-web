/** app/cap-catalogue.js — THE CATALOGUE'S PRIMITIVES, ONE COPY, and the catalogue as a small app (T3-CATALOGUE, 2026-10-14)
 *
 * Brief T3-CATALOGUE named "the workshop catalogue module (cap-catalogue*.js)" — there was none: the catalogue screen was ~3,700 inline lines of
 * app.html drawing its own card rows. The critique (docs/critique/T3-CATALOGUE.md) says BUILD WITH CHANGES: this file is CREATED BY LIFTING, never
 * copying — every function below under "MOVED" left app.html in the same change (dup-functions.cjs / guard-static.cjs would fail a leftover), and
 * app.html loads this file eagerly (after catalogue-model.js) so the workshop keeps calling the same names. CLAUDE.md rule 1 · 4.
 *
 * ── MOVED FROM app.html (one copy; the workshop and catalogue.html both read them) ──────────────────────────────────────────────────────────────
 *   CB_CATALOGUE_EP                                        the product routes (was in app.html's EP; merged there with Object.assign as CB_SHOP_EP is)
 *   cbAmount · cbHasPrice                                  the loose read of a price (a bare number or {amount,currency}; engine/money.js CBMoney)
 *   pData · pName · pUnit · pPrice · pCode · pDesc · prodId  the item's slots
 *   ctField · CT_FIXED_KEYS · ctDeclaredList · ctDeclaredFields · ctDeclaredRows · ctDeclaredViewRows · catDeclared   the declared columns on the form
 *   prodDiff                                               the RFC 7386 diff a Save sends (merge:true)
 *   downloadCatalogueTemplate                              the blank sheet in this catalogue's format (GET /products/template)
 *   _cfPick · _cfRun · _cfImport · _cfImportRun            the import: a file or pasted rows → preflight → a decision per column → import (confirm:true)
 * ── WIDENED HERE (additively) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   _cfPick / _cfRun / _cfImportRun take a WORKBOOK (.xlsx, base64 as the route already accepts) as well as csv text (UI._cfXlsx, UI._cf.xlsx)
 *   downloadCatalogueTemplate paints the columns into #cat_tpl_out on a page with no modal() (catalogue.html)
 *   _cfImportRun tells CBCatalogueApp.changed() when it has landed (the small app's list re-reads), beside the workshop's loadProducts
 * ── NEW ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   canSeeCosts (EP)                                       GET /entities/me/can-see-costs — the server's field for "may this login see cost and price"; nothing in the web registered it
 *   CBCatalogueApp                                         the small app: items (CBList, server-paged) · the item sheet · categories (CBList over cap-categories' rows + its writers) · import
 * Host globals (as every cap-*.js): api · EP · UI · SESSION · esc · tx · txf · toast · val · cblog · CBMoney · CBLocale · CBList · CBAction · confirmAsk · fmtMoney · packHasHsn · catgIdsOf · cbCatgLive · cap-categories.js.
 * Flow step: O2C step 1 · enquiry — the catalogue the buyer is shown is shaped here (docs/process/flows.json).
 */
'use strict';
/* ── the product routes — ONE registration (e2e/ep-aliases.cjs); app.html and catalogue.html merge this into EP ── */
var CB_CATALOGUE_EP = {
  schemaFields:    {m:"GET",  p:"/api/schemas/fields",                     ok:"✓"},  // the columns this catalogue declares — what a variant can be keyed or grouped on
  prodList:        {m:"GET",   p:"/api/products",                ok:"✓"},
  prodAdd:         {m:"POST",  p:"/api/products",                ok:"✓"},  // {item_data:{name,price}}
  prodDel:         {m:"DELETE",p:"/api/products/:id",            ok:"✓"},
  prodEdit:        {m:"PATCH", p:"/api/products/:id",            ok:"✓"},  // {item_data} — full edit (already live)
  prodStatus:      {m:"PUT",   p:"/api/products/:id/status",     ok:"✓"},  // {status, until?, replaced_by?, note?}
  prodTemplate:    {m:"GET",   p:"/api/products/template",       ok:"✓"},  // the blank sheet in THIS catalogue's format
  prodPreflight:   {m:"POST",  p:"/api/products/import/preflight",ok:"✓"}, // read a file before it becomes data — WRITES NOTHING
  prodImport:      {m:"POST",  p:"/api/products/import",         ok:"✓"},  // the commit half — a decision per column, confirm:true required
  canSeeCosts:     {m:"GET",   p:"/api/entities/me/can-see-costs", ok:"y"},   // [OFFR-04] may this login see cost and price — a FIELD the client branches on, never a sentence
};

/* ══ MOVED FROM app.html — the item's slots and the loose price read ══ */
function cbAmount(v){ var n=CBMoney.amountOfLoose(v); return isFinite(n)?n:0; }
function cbHasPrice(v){ return v!=null&&v!==''&&(typeof v!=='object'||typeof v.amount==='number'); }
function pData(p){ return (p&&(p.item_data||p.data))||{}; }
function pName(d){ return d.name||d.product||'item'; }
function pUnit(d){ return d.unit||'unit'; }
function pPrice(d){ return cbAmount(d.price); }
function pCode(d){ return d.code||d.hsn||d.sku||''; }
function pDesc(d){ return d.desc||d.description||d.note||''; }
function prodId(p){ return p.item_id||p.id; }

/* ══ MOVED FROM app.html — the declared columns on the product form (FIX-1's other half; the comment is the original) ══ */
function ctField(k,label,v,extra){ return `<label class="fl">${label}</label><input class="inp" id="ct_${k}" data-testid="cat-field-${k}" value="${esc(v==null?'':v)}" ${extra||''}>`; }
/**
 * ── ⭐⭐ THE DECLARED COLUMNS, ON THE PRODUCT ──────────────────────────────────────────────────────────────────
 * Athi, 2026-09-03 (observation 4): *"I have added multiple columns from template, it reflects in catalogue
 * fields in the column panel here. But when I check the columns in catalogue, none of these are reflecting
 * here, what is the relation between actual column and the column defined."*
 *
 * There was none. FIX-1 bound every declaration to the STORE (nothing in item_data is undeclared, proven live
 * on 4,987 items), and nothing bound the declaration to the FORM: prodEditForm was eight hard-coded inputs, so
 * a column declared in Catalogue setup › Columns reached the template, the export and the import — every door
 * except the one a person actually uses. The Columns panel governed what a FILE may carry; the form governed
 * what a PERSON may type; and the two never met. This is the other half of FIX-1.
 *
 * ⚠️ RENDERED FROM THE DECLARATION, NOT FROM THE ITEM. The keys come from `catDeclared()` (schema_fields, in
 * display_order); the item only supplies values. So a freshly declared column appears on every product at once,
 * empty, which is what "declared" means — and a key that exists in one item's data but in no declaration cannot
 * appear here, because after FIX-1 there is no such key.
 *
 * ⚠️ THE FIXED EIGHT STAY FIXED. name · unit · price · code · description · highlight have their own controls
 * (a currency prefix, a textarea, the "not a discount" warning) and are excluded here by KEY, so a declaration
 * that also carries them does not render a second, dumber input for the same value.
 *
 * ⚠️ A VALUE THAT IS NOT A SCALAR IS SHOWN, NOT EDITED. An imported object under a declared key (rare, but
 * jsonb allows it) renders as read-only text; an <input> would turn it into the string "[object Object]" on the
 * next Save. The form must never be the thing that flattens a record it could not display.
 */
const CT_FIXED_KEYS = ['name','unit','price','code','hsn','sku','desc','description','note','highlight'];
function ctDeclaredList(){
  return (UI._catFields||[]).filter(function(item){ return item && item.field_key && CT_FIXED_KEYS.indexOf(item.field_key) < 0; });
}
/**
 * ⚠️⚠️ THE HOST ALWAYS EXISTS. With no columns declared this returned '' — no #ct_declared in the form — and the
 * "fill the block when the declaration lands" path fell back to repainting the WHOLE form, wiping the name being
 * typed (the tour's fresh entity has no columns; the specs declare one first, so they never saw it — 2026-09-05).
 * Now the block is always in the form (hidden when empty) and the late fill only ever touches it.
 */
function ctDeclaredFields(d){
  const rows = ctDeclaredRows(d);
  return `<div id="ct_declared_wrap"${rows?'':' hidden'}><div class="sec" style="margin-top:14px">${tx('More about this product')}</div>`
    + `<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:6px">${tx('The columns your catalogue declares — shaped in Catalogue setup › Columns.')}</div>`
    + `<div id="ct_declared" data-testid="cat-declared">${rows}</div></div>`;
}
function ctDeclaredRows(d){
  const list = ctDeclaredList(); if(!list.length) return '';
  const rows = list.map(function(item){
    const k = item.field_key, v = d ? d[k] : undefined, isNum = item.field_type === 'number';
    const label = esc(item.field_name || k) + (item.required ? ' <span style="color:var(--disp)">*</span>' : '');
    if (v != null && typeof v === 'object') {
      return `<label class="fl">${label}</label><div class="inp" style="color:var(--grey)" data-testid="cat-field-${esc(k)}" title="${esc(tx('imported as structured data — edit it through the spreadsheet'))}">${esc(JSON.stringify(v))}</div>`;
    }
    return `<label class="fl">${label}</label><input class="inp" id="ct_f_${esc(k)}" data-testid="cat-field-${esc(k)}" data-key="${esc(k)}" data-type="${esc(item.field_type||'text')}"${isNum ? ' inputmode="decimal"' : ''} value="${esc(v==null?'':v)}">`;
  }).join('');
  return rows;
}
/** The declared columns that carry a value, as view rows. Only scalars: an object is a record, not a value. */
function ctDeclaredViewRows(d, kv){
  return ctDeclaredList().filter(function(item){ const v = d[item.field_key]; return v != null && v !== '' && typeof v !== 'object'; })
    .map(function(item){ return kv(esc(item.field_name || item.field_key), d[item.field_key]); }).join('');
}
const catDeclared = async function(){
  if (UI._catFields) return UI._catFields;                 // once per session — this is a definition, not data
  try { const reply = await api('schemaFields'); UI._catFields = (reply && reply.fields) || []; }
  catch (_) { UI._catFields = []; }                        // no definition is not an error; it just means no hints
  return UI._catFields;
};
/** the RFC 7386 diff a Save sends: only the keys whose value changed (merge:true on PATCH /products/:id) */
function prodDiff(cur, next){ const out={}; Object.keys(next||{}).forEach(item=>{ if(JSON.stringify((cur||{})[item])!==JSON.stringify(next[item])) out[item]=next[item]; }); return out; }

/* ══ MOVED FROM app.html — the template and the import (preflight → decisions → import) ══ */
async function downloadCatalogueTemplate(btn){
  const was = btn ? btn.textContent : null;
  if(btn){ btn.disabled = true; btn.textContent = '📄 …'; }
  try{
    const reply = await api('prodTemplate');
    const blob = new Blob(['﻿' + reply.csv], { type: 'text/csv;charset=utf-8' });   // BOM: Excel mangles ₹ without it
    const url = URL.createObjectURL(blob);
    const node = document.createElement('a');
    node.href = url; node.download = reply.filename || 'catalogue-template.csv';
    document.body.appendChild(node); node.click(); node.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);

    const cols = (reply.columns||[]).map(function(item){
      const opt = (reply.optional||[]).indexOf(item) >= 0;
      return '<span style="display:inline-block;border:1px solid var(--line);border-radius:6px;padding:2px 7px;margin:0 4px 4px 0;font-size:var(--fs-1);font-family:ui-monospace,monospace;'
        + (opt ? 'color:var(--grey);border-style:dashed' : 'font-weight:600') + '">' + esc(item) + '</span>';
    }).join('');
    var body = '<div style="font-size:var(--fs-2);color:var(--grey);margin-bottom:9px">Downloaded as <b>' + esc(reply.filename||'') + '</b> — these are the columns your catalogue accepts. Dashed ones are optional.</div>'
      + '<div style="margin-bottom:10px">' + cols + '</div>'
      + '<ul style="font-size:var(--fs-2);line-height:1.65;padding-inline-start:18px;margin:0">'
      + (reply.notes||[]).map(function(item){ return '<li>' + esc(item) + '</li>'; }).join('')
      + '</ul>';
    /* the workshop shows the columns in its modal; a page with no modal() (catalogue.html) has a slot for them under the button */
    var slot = document.getElementById('cat_tpl_out');
    if (typeof modal === 'function') modal('<div class="mhd">' + tx('📄 Catalogue template') + '</div><div class="mbody">' + body + '</div><div class="mfoot"><button class="pri" onclick="closeModal()">' + tx('Got it') + '</button></div>');
    else if (slot) slot.innerHTML = '<div data-testid="cat-template-cols" style="margin-top:10px">' + body + '</div>';
    else if (typeof toast === 'function') toast(tx('Template downloaded'));
  }catch(e){
    if(typeof toast === 'function') toast((e && e.message) || 'Could not build the template.');
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = was; }
  }
}
/** a file is picked: csv → its text into #cf_text (as before); a WORKBOOK (.xlsx/.xls) → base64 on UI._cfXlsx, the route's own `xlsx` field (T3-CATALOGUE) */
function _cfPick(input){
  var f = input && input.files && input.files[0]; if(!f) return;
  var rd = new FileReader(), name = document.getElementById('cf_file_name'), isBook = /\.xlsx?$/i.test(f.name || '');
  UI._cfXlsx = null;
  if (isBook) {
    rd.onload = function(){ var s = String(rd.result || ''); UI._cfXlsx = s.slice(s.indexOf(',') + 1); var el = document.getElementById('cf_text'); if (el) el.value = ''; if (name) name.textContent = tx('Workbook') + ': ' + f.name; };
    rd.readAsDataURL(f);
    return;
  }
  rd.onload = function(){ var el = document.getElementById('cf_text'); if(el) el.value = String(rd.result||'').replace(/^﻿/,''); if (name) name.textContent = f.name; };
  rd.readAsText(f);
}
/** what the preflight and the import send: the workbook when one was picked, else the csv text — ONE place, so both halves read the same file */
function _cfBody(text){ return UI._cfXlsx ? { xlsx: UI._cfXlsx } : { csv: text }; }
async function _cfRun(btn){
  var text = (document.getElementById('cf_text')||{}).value || '';
  var out = document.getElementById('cf_out'); if(!out) return;
  if(!text.trim() && !UI._cfXlsx){ out.innerHTML = '<div style="font-size:var(--fs-2);color:var(--disp)">Choose a file or paste some rows first.</div>'; return; }
  var was = btn ? btn.textContent : null; if(btn){ btn.disabled = true; btn.textContent = 'Reading…'; }
  try{
    var res = await api('prodPreflight', { body: _cfBody(text) });
    var r = res.report;
    UI._cf = { csv: text, xlsx: UI._cfXlsx || null, accepted: res.accepted||[], optional: res.optional||[], report: r };

    // How each verdict reads, and what it DEFAULTS the decision to. A blocked column has no choice at all — the
    // control is removed rather than merely pre-set, because a disabled dropdown still looks like a decision
    // someone could change.
    var HOW = {
      exact:         ['✓','var(--ok-2)','matches your catalogue'],
      synonym:       ['✓','var(--ok-2)','recognised under another name'],
      contains:      ['?','var(--warn-2)','probably this — confirm'],
      fuzzy:         ['?','var(--warn-2)','guessed — confirm this'],
      ambiguous:     ['?','var(--warn-2)','could be more than one thing'],
      'not-accepted':['—','var(--grey-2)','your catalogue does not use this'],
      unmatched:     ['—','var(--grey-2)','not recognised'],
      conflict:      ['!','var(--warn-2)','another column matched this better'],
      blocked:       ['⨯','var(--disp)','a file may not set this'],
      empty:         ['—','var(--grey-2)','this column has no heading']
    };
    var accepted = res.accepted || [];
    var rowsHtml = (r.mapping||[]).map(function(item, index){
      var h = HOW[item.how] || ['?','var(--grey-2)',item.how];
      var control;
      if(item.how === 'blocked' || item.how === 'empty'){
        control = '<span style="font-size:var(--fs-1);color:'+h[1]+'">not importable</span>';
      } else {
        var opts = ['<option value="ignore">' + tx('Leave it out') + '</option>'];
        accepted.forEach(function(f){
          var sel = (item.canonical === f) ? ' selected' : '';
          opts.push('<option value="map:'+esc(f)+'"'+sel+'>Use as '+esc(f)+'</option>');
        });
        // Only offer to CREATE where nothing in the catalogue claimed it — otherwise the obvious click is the one
        // that grows a second column meaning the same thing.
        if(!item.canonical) opts.push('<option value="create" selected>' + tx('Add as a new column') + '</option>');
        control = '<select data-cfcol="'+esc(item.incoming||'')+'" data-testid="cf-decide-'+index+'" class="inp" style="font-size:var(--fs-2);padding:3px 6px;width:100%">'+opts.join('')+'</select>';
      }
      return '<tr>'
        + '<td style="padding:5px 8px;border-bottom:1px dashed var(--line);font-family:ui-monospace,monospace;font-size:var(--fs-2)">'+esc(item.incoming||'(blank)')+'</td>'
        + '<td style="padding:5px 8px;border-bottom:1px dashed var(--line);color:'+h[1]+';font-weight:700;text-align:center">'+h[0]+'</td>'
        + '<td style="padding:5px 8px;border-bottom:1px dashed var(--line);min-width:150px">'+control+'</td>'
        + '<td style="padding:5px 8px;border-bottom:1px dashed var(--line);font-size:var(--fs-1);color:var(--grey)">'+esc(item.conflict||item.why||h[2])+'</td>'
        + '</tr>';
    }).join('');

    var s = r.summary || {};
    var blocking = (s.errors || 0) > 0;
    var badge = blocking
      ? '<span style="background:var(--danger-tint);color:var(--disp);border-radius:6px;padding:3px 9px;font-size:var(--fs-1);font-weight:700">'+s.errors+' row problem(s) — fix the file first</span>'
      : (r.ready
        ? '<span style="background:var(--ok-tint);color:var(--disp);border-radius:6px;padding:3px 9px;font-size:var(--fs-1);font-weight:700">' + tx('Every column is placed') + '</span>'
        : '<span style="background:var(--warn-tint);color:var(--warn-3);border-radius:6px;padding:3px 9px;font-size:var(--fs-1);font-weight:700">' + tx('Check the choices below, then import') + '</span>');
    var issues = (r.issues||[]).slice(0,25).map(function(item){
      var c = item.severity==='error' ? 'var(--disp)' : (item.severity==='info' ? 'var(--grey-2)' : 'var(--warn-2)');
      return '<li style="color:'+c+'">line '+item.row+' · <b>'+esc(item.column)+'</b> — '+esc(item.message)+'</li>';
    }).join('');

    out.innerHTML = badge
      + '<div style="font-size:var(--fs-2);margin:9px 0 6px">'+s.rows+' row(s) read · <b>'+s.importable+'</b> would import · '+s.errors+' error(s) · '+s.warnings+' warning(s)</div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>'
      + ['In your file','','What to do with it','Why'].map(function(item){ return '<th style="text-align:start;padding:5px 8px;font-size:var(--fs-1);text-transform:uppercase;color:var(--grey);border-bottom:1px solid var(--line)">'+item+'</th>'; }).join('')
      + '</tr></thead><tbody>'+rowsHtml+'</tbody></table></div>'
      + ((r.notes||[]).length ? '<ul style="font-size:var(--fs-2);line-height:1.6;padding-inline-start:18px;margin:10px 0 0">'+r.notes.map(function(item){ return '<li>'+esc(item)+'</li>'; }).join('')+'</ul>' : '')
      + (issues ? '<div style="font-size:var(--fs-1);text-transform:uppercase;color:var(--grey);margin:10px 0 4px">' + tx('Rows') + '</div><ul style="font-size:var(--fs-2);line-height:1.6;padding-inline-start:18px;margin:0">'+issues+'</ul>'
          + ((r.issues||[]).length>25 ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:5px">…and '+((r.issues||[]).length-25)+' more.</div>' : '') : '')
      + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:11px;border-top:1px solid var(--line);padding-top:8px">' + txf('Reading the file changed nothing. {import} applies the choices above — it adds and updates products, and never deletes one.', {
      import: '<b>' + tx('Import') + '</b>' }) + '</div>';

    // The Import button is enabled only when the file itself is sound. Row errors are not a warning to click past:
    // the server refuses them too, and offering the button anyway teaches people to ignore it.
    var node = document.getElementById('cf_import');
    if(node){ node.disabled = blocking; node.style.opacity = blocking ? '.5' : '1';
      node.title = blocking ? 'Fix the row problems first' : 'Apply these choices to your catalogue'; }
  }catch(e){
    out.innerHTML = '<div style="font-size:var(--fs-2);color:var(--disp)">'+esc((e&&e.message)||'Could not read the file.')+'</div>';
  }finally{ if(btn){ btn.disabled = false; btn.textContent = was; } }
}
/**
 * _cfImport — apply the per-column choices.
 *
 * The decisions come from the dropdowns, NOT from the preflight's suggestions: what the person sees on screen is
 * exactly what is sent. The server re-reads the file and re-checks every decision, so nothing here is trusted.
 */
function _cfImport(btn){
  if(!UI._cf){ if(typeof toast==='function') toast('Check a file first.'); return; }
  var out = document.getElementById('cf_out');
  var sels = Array.prototype.slice.call(document.querySelectorAll('[data-cfcol]'));
  var decisions = sels.map(function(el){
    var v = el.value || 'ignore';
    if(v === 'create') return { incoming: el.getAttribute('data-cfcol'), action: 'create' };
    if(v.indexOf('map:') === 0) return { incoming: el.getAttribute('data-cfcol'), action: 'map', field: v.slice(4) };
    return { incoming: el.getAttribute('data-cfcol'), action: 'ignore' };
  });
  var creating = decisions.filter(function(item){ return item.action === 'create'; }).length;
  var using = decisions.filter(function(item){ return item.action !== 'ignore'; }).length;
  if(!using){ if(typeof toast==='function') toast('Every column is set to be left out.'); return; }
  confirmAsk('Import using ' + using + ' column' + (using===1?'':'s') + '?',
    (creating ? 'It also adds <b>' + creating + ' new column' + (creating===1?'':'s') + '</b> to your catalogue.<div style="margin-top:7px">' : '<div>')
    + txf('Products are {au}. Nothing is deleted.', { au: '<b>' + tx('added or updated') + '</b>' }) + '</div>',
    'Import', function(){ _cfImportRun(btn, decisions, out); });
}
async function _cfImportRun(btn, decisions, out){
  var was = btn.textContent; btn.disabled = true; btn.textContent = 'Importing…';
  try{
    var reply = await api('prodImport', { body: Object.assign(UI._cf.xlsx ? { xlsx: UI._cf.xlsx } : { csv: UI._cf.csv }, { decisions: decisions, confirm: true }) });   /* the SAME file the preflight read */
    var sum = reply.summary || {};
    out.innerHTML = '<div style="background:var(--ok-tint);color:var(--ok-2);border-radius:6px;padding:8px 10px;font-size:var(--fs-2);font-weight:700">'+esc(reply.message||'Imported')+'</div>'
      + ((reply.created_columns||[]).length ? '<div style="font-size:var(--fs-2);color:var(--grey);margin-top:8px">Your catalogue now also has: '+reply.created_columns.map(esc).join(', ')+'. The next template you download will include them.</div>' : '')
      + '<ul style="font-size:var(--fs-2);line-height:1.6;padding-inline-start:18px;margin:10px 0 0">'
      + (reply.outcome||[]).slice(0,40).map(function(item){
          var c = item.action==='failed' ? 'var(--disp)' : 'var(--ink)';
          return '<li style="color:'+c+'">line '+item.line+' · '+esc(item.name||'')+' — '+esc(item.action)+(item.message?': '+esc(item.message):'')+'</li>';
        }).join('')
      + '</ul>'
      + ((reply.outcome||[]).length>40 ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:5px">…and '+((reply.outcome||[]).length-40)+' more.</div>' : '');
    btn.disabled = true; btn.style.opacity = '.5';
    if(typeof loadProducts === 'function') loadProducts();                                        /* the workshop's list */
    if(typeof CBCatalogueApp !== 'undefined' && CBCatalogueApp.changed) CBCatalogueApp.changed();   /* the small app's list and the live shelf */
  }catch(e){
    out.innerHTML = '<div style="font-size:var(--fs-2);color:var(--disp)">'+esc((e&&e.message)||'Could not import.')+' Nothing was changed.</div>';
    btn.disabled = false;
  }finally{ btn.textContent = was; }
}

/* ═══ CBCatalogueApp — the catalogue as a small app (T3-CATALOGUE, 2026-10-14; catalogue.html mounts it in CBFrame's pane) ═══
 * Three sections, each the standard construct, nothing drawn twice:
 *   items       the shop's items on CBList in `remote` mode — the SERVER searches, filters by status and pages (GET /products ?q ?status ?limit ?offset,
 *               the true total beside the page); a row opens the item sheet (<dialog>, as Tasks and Employees open theirs): the facts, Edit, Set status.
 *               Edit sends ONLY the diff as an RFC 7386 merge-patch (`merge:true`, prodDiff) through PATCH /products/:id — the one product writer.
 *   categories  CBList over the rows cap-categories.js already builds (cbcatLoad → CBCAT_UI.list, the server's category_counts); New · Rename ·
 *               Retire / Back on shelf call the SAME writers (cbcatSave · cbcatRetire · cbcatRelive) headless — no second panel, no second validation.
 *   import      one pane: the template (downloadCatalogueTemplate) · a file (.csv or .xlsx) or pasted rows → _cfRun (preflight, writes nothing) →
 *               a decision per column → _cfImport (confirm) → _cfImportRun (POST /products/import, confirm:true). The same painters the workshop uses.
 * WHO MAY: the server. Cost and price are painted only when GET /entities/me/can-see-costs says so (a FIELD, never a sentence parsed); a login that may
 * not see them gets the field greyed WITH the sentence, never hidden. A refused write (403) paints the server's own sentence under the control (CBAction).
 * Host globals (as every cap-*.js): api · EP · UI · SESSION · esc · tx · txf · toast · val · CBAction · CBList · CBLocale · confirmAsk (CBConfirm) · cap-categories.js.
 * Flow step: O2C step 1 · enquiry — the catalogue the buyer is shown is shaped here (docs/process/flows.json).
 */
var CBCatalogueApp = (function () {
  'use strict';
  var S = { host: null, sec: 'items', q: '', status: '', offset: 0, limit: 100, total: null, items: [], counts: null, catCounts: null, uncat: 0,
            truncated: false, state: 'loading', err: '', cost: null, me: null, list: null, catList: null, sel: null, mode: 'view', onSection: null };
  var PAGE = 100;   /* the page the server is asked for: Athi, 2026-09-08 — "just the data, max 50 or 100 rows in one iteration" */
  var STATUS_WORDS = { available: 'Available', unavailable: 'Not available', redundant: 'Redundant', retired: 'Retired' };   /* lib/itemstatus.js STATUSES, in words */
  function T(s, v) { return v ? txf(s, v) : tx(s); }
  function cur() { return (S.me && (S.me.currency_code || S.me.currency)) || (typeof SESSION !== 'undefined' && SESSION && SESSION.currency) || ''; }
  function sym() { try { return CBLocale.symbol(cur()); } catch (_) { return cur(); } }
  function priceText(v) { return cbHasPrice(v) ? fmtMoney(cbAmount(v), cur()) : '—'; }
  function statusOf(d) { var s = String((d && d.status) || '').toLowerCase().trim(); return STATUS_WORDS[s] ? s : 'available'; }
  function catNames(d) { var ids = catgIdsOf(d), live = (typeof _CATG !== 'undefined' && _CATG) || []; return ids.map(function (id) { var c = live.filter(function (x) { return String(x.id) === String(id); })[0]; return c ? c.name : null; }).filter(Boolean); }
  function el(id) { return document.getElementById(id); }
  /** the outcome line beside a control (what CBAction paints when it runs; this is the same box for a check that never reached the server) */
  function say(id, msg, tone) { var node = el(id); if (!node) { toast(msg); return; } node.textContent = msg; node.setAttribute('data-tone', tone || 'ok'); }
  function seesCosts() { return !!(S.cost && S.cost.can_see_costs); }
  /** the one sentence for a cost-blind login — the server's field decides; the words are the gate's own (routes/products.js) */
  function costWhy() { return S.cost === null ? T('Checking who may see prices…') : T('Your access does not include cost or price. The owner grants “Sees costs” in Employees.'); }

  /* ── the server's answers ── */
  async function readCosts() {
    try { S.cost = await api('canSeeCosts'); }
    catch (e) { S.cost = { can_see_costs: false, is_owner: false, unknown: true }; cblog('warn', 'catalogue: can-see-costs could not be read — prices stay hidden: ' + ((e && e.message) || e)); }
  }
  async function readItems() {
    S.state = 'loading'; S.err = '';
    if (S.list) S.list.refresh();
    try {
      var q = { limit: S.limit, offset: S.offset };
      if (S.q) q.q = S.q;
      if (S.status) q.status = S.status === 'unavailable' ? 'not-available' : S.status;   /* the api's negation word for the chip's status (the workshop's note) */
      var reply = await api('prodList', { query: q });
      /* core.js unwrap() collapses {items:[…]} into the array and carries total · truncated · status_counts · category_counts · uncategorised on it (SIBS) — the workshop reads both shapes, so does this */
      S.items = Array.isArray(reply) ? reply : ((reply && reply.items) || []);
      S.total = reply && reply.total != null ? Number(reply.total) : S.items.length;
      S.truncated = !!(reply && reply.truncated);
      S.counts = (reply && reply.status_counts) || null; S.catCounts = (reply && reply.category_counts) || null; S.uncat = Number(reply && reply.uncategorised) || 0;
      S.state = 'ready';
    } catch (e) {
      S.state = 'error'; S.err = (e && e.status >= 400 && e.status < 500 && e.message) ? e.message : T('Your items could not be read. Nothing was lost — try again.');
      cblog('error', 'catalogue: items could not be read: ' + ((e && e.message) || e));
    }
    paintCount();
    if (S.list) S.list.refresh();
  }
  function page(by) { var n = S.offset + by * S.limit; if (n < 0) n = 0; if (S.total != null && n >= S.total) return; S.offset = n; readItems(); }

  /* ── ITEMS ── */
  function itemsHTML() {
    return '<div class="cat-top" data-testid="cat-items-top"><div class="cat-count" id="cat_count" data-testid="cat-count"></div>'
      + '<div class="cat-acts"><button type="button" class="act" data-testid="cat-new" id="cat_new">＋ ' + esc(T('New item')) + '</button><div class="cat-out" id="cat_new_out" data-testid="cat-new-out"></div></div></div>'
      + '<div class="cat-list" id="cat_items" data-testid="cat-items"></div>'
      + '<dialog class="sheet" id="cat_sheet" data-testid="cat-sheet"></dialog>';
  }
  function paintCount() {
    var node = el('cat_count'); if (!node) return;
    if (S.state === 'error') { node.innerHTML = '<span class="err" data-testid="cat-read-err">' + esc(S.err) + '</span>'; return; }
    if (S.total == null) { node.innerHTML = '<span class="sub">' + esc(T('Reading your items…')) + '</span>'; return; }
    var n = S.total, word = n === 1 ? T('item') : T('items');
    var na = S.counts ? (Number(S.counts.unavailable) || 0) + (Number(S.counts.redundant) || 0) + (Number(S.counts.retired) || 0) : 0;
    node.innerHTML = '<b>' + esc(String(n)) + '</b> ' + esc(word)
      + (S.q || S.status ? ' <span class="sub">' + esc(T('matching')) + '</span>' : '')
      + (na && !S.q && !S.status ? ' <span class="tag amber" data-testid="cat-count-na">' + esc(String(na)) + ' ' + esc(T('not available')) + '</span>' : '')
      + (S.uncat && !S.q && !S.status ? ' <span class="tag" data-testid="cat-count-uncat">' + esc(String(S.uncat)) + ' ' + esc(T('without a category')) + '</span>' : '');
  }
  function footHTML() {
    if (S.total == null || S.total <= S.limit) return '';
    var from = S.offset + 1, to = Math.min(S.offset + S.items.length, S.total);
    return '<div class="cat-pager" data-testid="cat-pager"><span>' + esc(T('{from}–{to} of {n}', { from: String(from), to: String(to), n: String(S.total) })) + '</span>'
      + '<button type="button" class="act quiet" data-testid="cat-prev" onclick="CBCatalogueApp.page(-1)"' + (S.offset === 0 ? ' disabled' : '') + '>‹ ' + esc(T('Previous')) + '</button>'
      + '<button type="button" class="act quiet" data-testid="cat-next" onclick="CBCatalogueApp.page(1)"' + (to >= S.total ? ' disabled' : '') + '>' + esc(T('Next')) + ' ›</button></div>';
  }
  function cols() {
    var dash = '<span class="sub">—</span>';
    var out = [
      { key: 'name', label: T('Item'), prio: 1, w: 220, html: true, cell: function (p) { var d = pData(p); return '<b>' + esc(pName(d)) + '</b>' + (pDesc(d) ? '<div class="sub cat-desc">' + esc(pDesc(d)) + '</div>' : ''); } },
      { key: 'price', label: T('Price'), prio: 2, w: 120, num: true, html: true, cell: function (p) { var d = pData(p); return seesCosts() ? '<span class="cbl-num" data-testid="cat-price-' + esc(prodId(p)) + '">' + esc(priceText(d.price)) + '</span>' : '<span class="sub" title="' + esc(costWhy()) + '" data-testid="cat-price-hidden">' + esc(T('not shown')) + '</span>'; } },
      { key: 'unit', label: T('Unit'), prio: 4, w: 90, html: true, cell: function (p) { return esc(pUnit(pData(p))); } },
      { key: 'code', label: packHasHsn() ? T('Code / HSN') : T('Code'), prio: 5, w: 120, html: true, cell: function (p) { var c = pCode(pData(p)); return c ? '<span class="mono">' + esc(c) + '</span>' : dash; } },
      { key: 'categories', label: T('Categories'), prio: 6, w: 180, html: true, cell: function (p) { var n = catNames(pData(p)); return n.length ? esc(n.join(' · ')) : dash; } },
      { key: 'status', label: T('Status'), prio: 3, w: 120, html: true, cell: function (p) { var s = statusOf(pData(p)); return '<span class="tag ' + (s === 'available' ? 'green' : 'amber') + '">' + esc(T(STATUS_WORDS[s])) + '</span>'; } }
    ];
    return out;
  }
  function mountItems() {
    var host = el('cat_items'); if (!host) return;
    S.list = CBList.mount(host, {
      key: 'catalogue-items', t: tx, hl: false,
      rows: function () { return S.items; }, id: function (p) { return prodId(p); }, rowTid: function (p) { return 'cat-row-' + prodId(p); },
      columns: cols(), defaultCols: ['name', 'price', 'status'],
      state: function () { return S.state === 'ready' ? null : S.state; },
      error: function () { return { title: T('Your items could not be read.'), sub: S.err }; },
      empty: function () { return { title: S.q || S.status ? T('Nothing matches.') : T('No items yet.'), sub: S.q || S.status ? T('Clear the search or the status filter.') : T('Add one with ＋ New item, or import a sheet.') }; },
      /* the SERVER filters by status: this filter's only job is to say which status, and to be a chip a person can clear */
      filters: [{ key: 'status', label: T('Status'), all: T('Any status'), options: Object.keys(STATUS_WORDS).map(function (item) { return { v: item, label: T(STATUS_WORDS[item]) }; }), match: function () { return true; } }],
      search: function (p) { return pName(pData(p)); }, searchHint: T('Search name or code'),
      remote: { total: function () { return S.total; }, foot: footHTML,
        onQuery: function (q) { var st = (q.filt && q.filt.status) || ''; if (Array.isArray(st)) st = st[0] || ''; var nq = String(q.q || '').trim(); if (nq === S.q && st === S.status) return; S.q = nq; S.status = st; S.offset = 0; readItems(); } },
      onOpen: function (p) { openItem(prodId(p)); }
    });
    var node = el('cat_new'); if (node) node.onclick = function () { openItem(null); };
  }

  /* ── the item sheet ── */
  function itemOf(id) { return S.items.filter(function (item) { return String(prodId(item)) === String(id); })[0] || null; }
  function openItem(id) { S.sel = id; S.mode = id ? 'view' : 'new'; paintSheet(); var node = el('cat_sheet'); if (node && !node.open) { try { node.showModal(); } catch (_) { node.setAttribute('open', ''); } } if (S.mode === 'new') catDeclared().then(function () { var h = el('ct_declared'); if (h && S.mode === 'new') { h.innerHTML = ctDeclaredRows({}); var w = el('ct_declared_wrap'); if (w) w.hidden = !h.innerHTML; } }); }
  function closeSheet() { var node = el('cat_sheet'); if (!node) return; try { node.close(); } catch (_) { node.removeAttribute('open'); } node.innerHTML = ''; S.sel = null; S.mode = 'view'; }
  function kv(l, v) { return '<div class="cat-kv"><b>' + l + '</b><span>' + (v === '' || v == null ? '—' : esc(v)) + '</span></div>'; }
  function priceField(d) {
    var may = seesCosts();
    return '<label class="fl" for="ct_price">' + esc(T('Price')) + '</label><div class="cat-money' + (may ? '' : ' no') + '">'
      + '<span class="cat-sym" aria-hidden="true" title="' + esc(cur()) + '">' + esc(sym()) + '</span>'
      + '<input class="inp" id="ct_price" data-testid="cat-field-price" inputmode="decimal" autocomplete="off" value="' + esc(may && cbHasPrice(d.price) ? String(cbAmount(d.price)) : '') + '"' + (may ? '' : ' disabled aria-disabled="true"') + '></div>'
      + (may ? '' : '<div class="why" data-testid="cat-price-why">' + esc(costWhy()) + '</div>');
  }
  function formHTML(d) {
    return ctField('name', esc(T('Name')), d.name || '') + '<div class="cat-two"><div>' + ctField('unit', esc(T('Unit')), d.unit || '', 'placeholder="' + esc(T('piece / kg / litre')) + '"') + '</div><div>' + priceField(d) + '</div></div>'
      + ctField('code', esc(packHasHsn() ? T('Code / HSN') : T('Code')), pCode(d))
      + '<label class="fl" for="ct_desc">' + esc(T('Description')) + '</label><textarea class="inp" id="ct_desc" data-testid="cat-field-desc" rows="3">' + esc(pDesc(d)) + '</textarea>'
      + ctDeclaredFields(d);
  }
  /** the form → the item's next shape. Only what is on screen is read; a disabled price is never read (the server would refuse it, and it is not a change) */
  function readForm(orig) {
    var next = Object.assign({}, orig || {}, { name: (val('ct_name') || '').trim(), unit: (val('ct_unit') || '').trim() || 'unit', code: (val('ct_code') || '').trim(), desc: (val('ct_desc') || '').trim() });
    var node = el('ct_price');
    if (node && !node.disabled) {
      var t = String(node.value || '').replace(/[,\s]/g, ''), had = cbHasPrice(orig && orig.price) ? cbAmount(orig.price) : null;
      if (t === '') delete next.price;
      else if (had !== null && Number(t) === had) next.price = orig.price;   /* the same amount: the stored {amount,currency} is kept, so the diff carries no price */
      else next.price = Number(t);                                            /* a bare number, as the workshop sends it — the server stamps the shop's currency (money.stampPrice) */
    }
    var decl = el('ct_declared');
    if (decl) Array.prototype.forEach.call(decl.querySelectorAll('input[data-key]'), function (x) { var k = x.getAttribute('data-key'), raw = (x.value || '').trim(); if (raw === '') { delete next[k]; return; } next[k] = (x.getAttribute('data-type') === 'number' && isFinite(+raw)) ? +raw : raw; });
    return next;
  }
  function sheetHTML() {
    var p = S.sel ? itemOf(S.sel) : null, d = p ? pData(p) : {};
    if (S.sel && !p) return '<button type="button" class="mx" data-testid="cat-sheet-close" aria-label="' + esc(T('Close')) + '">✕</button><h2>' + esc(T('Item')) + '</h2><p class="sub">' + esc(T('This item is no longer on the page. Close and search for it.')) + '</p>';
    var head = '<button type="button" class="mx" data-testid="cat-sheet-close" aria-label="' + esc(T('Close')) + '">✕</button>'
      + '<h2 data-testid="cat-sheet-title">' + esc(S.mode === 'new' ? T('New item') : pName(d)) + '</h2>'
      + (p ? '<div class="cat-chips">' + (pCode(d) ? '<span class="tag mono">' + esc(pCode(d)) + '</span>' : '') + '<span class="tag ' + (statusOf(d) === 'available' ? 'green' : 'amber') + '" data-testid="cat-sheet-status">' + esc(T(STATUS_WORDS[statusOf(d)])) + '</span></div>' : '');
    if (S.mode === 'view') {
      return head + '<div class="cat-facts" data-testid="cat-facts">'
        + kv(esc(T('Price')), seesCosts() ? priceText(d.price) : T('not shown') + ' · ' + costWhy())
        + (seesCosts() && d.cost != null ? kv(esc(T('Cost')), priceText(d.cost)) : '')
        + kv(esc(T('Unit')), pUnit(d)) + kv(esc(T('Categories')), catNames(d).join(' · ')) + kv(esc(T('Description')), pDesc(d))
        + ctDeclaredViewRows(d, kv) + '</div>'
        + '<div class="cat-sheet-acts"><button type="button" class="act" data-testid="cat-edit" id="cat_edit">' + esc(T('Edit')) + '</button>'
        + '<button type="button" class="act quiet" data-testid="cat-status" id="cat_status">' + esc(statusOf(d) === 'available' ? T('Mark not available') : T('Mark available')) + '</button></div>'
        + '<div class="cat-out" id="cat_sheet_out" data-testid="cat-sheet-out"></div>';
    }
    return head + '<form id="cat_form" onsubmit="return false">' + formHTML(S.mode === 'new' ? {} : d)
      + '<div class="cat-sheet-acts"><button type="button" class="act" data-testid="cat-save" id="cat_save">' + esc(S.mode === 'new' ? T('Add item') : T('Save')) + '</button>'
      + '<button type="button" class="act quiet" data-testid="cat-cancel" id="cat_cancel">' + esc(T('Cancel')) + '</button></div>'
      + '<div class="cat-out" id="cat_sheet_out" data-testid="cat-sheet-out"></div></form>';
  }
  function paintSheet() {
    var node = el('cat_sheet'); if (!node) return;
    node.innerHTML = sheetHTML();
    var x = node.querySelector('[data-testid="cat-sheet-close"]'); if (x) x.onclick = closeSheet;
    var e = el('cat_edit'); if (e) e.onclick = function () { S.mode = 'edit'; paintSheet(); catDeclared().then(function () { if (S.mode !== 'edit') return; var h = el('ct_declared'); var p = itemOf(S.sel); if (h) { h.innerHTML = ctDeclaredRows(p ? pData(p) : {}); var w = el('ct_declared_wrap'); if (w) w.hidden = !h.innerHTML; } }); };
    var c = el('cat_cancel'); if (c) c.onclick = function () { if (S.mode === 'new') return closeSheet(); S.mode = 'view'; paintSheet(); };
    var s = el('cat_save'); if (s) s.onclick = function () { save(s); };
    var st = el('cat_status'); if (st) st.onclick = function () { setStatus(st); };
  }
  /** ONE write, only the diff, as a merge-patch — the thing the workshop's whole-record Save could not promise ([EXP-01]) */
  function save(btn) {
    var p = S.sel ? itemOf(S.sel) : null, cur = p ? pData(p) : {}, next = readForm(cur);
    var out = 'cat_sheet_out';
    if (!next.name) { say(out, T('A name is needed.'), 'error'); return; }
    if (S.mode === 'new') {
      return CBAction.run(btn, function () { return api('prodAdd', { body: { item_data: next } }); },
        { out: out, busy: T('Adding…'), outcome: function () { toast(T('“{n}” added', { n: next.name })); closeSheet(); S.offset = 0; readItems(); if (typeof cbcatCounts === 'function') cbcatCounts(); } });
    }
    var patch = prodDiff(cur, next);
    Object.keys(cur).forEach(function (item) { if (!(item in next) && CT_FIXED_KEYS.indexOf(item) >= 0) patch[item] = null; });   /* a fixed field emptied on screen → null removes it (RFC 7386) */
    if (!Object.keys(patch).length) { say(out, T('Nothing changed.'), 'ok'); return; }
    return CBAction.run(btn, function () { return api('prodEdit', { params: { id: S.sel }, body: { item_data: patch, merge: true } }); },
      { out: out, busy: T('Saving…'), outcome: function (r) { if (r && r.item) { var i = S.items.indexOf(p); if (i >= 0) S.items[i] = r.item; } S.mode = 'view'; paintSheet(); if (S.list) S.list.refresh(); toast(T('Saved')); } });
  }
  /** a status change is its own route (PUT /products/:id/status merges a flag; never a PATCH of the record) */
  function setStatus(btn) {
    var p = itemOf(S.sel); if (!p) return;
    var to = statusOf(pData(p)) === 'available' ? 'unavailable' : 'available';
    return CBAction.run(btn, function () { return api('prodStatus', { params: { id: S.sel }, body: { status: to } }); },
      { out: 'cat_sheet_out', busy: T('Saving…'), outcome: function (r) { var d = pData(p); d.status = to; if (r && r.item) { var i = S.items.indexOf(p); if (i >= 0) S.items[i] = r.item; } readItems().then(paintSheet); } });
  }

  /* ── CATEGORIES ── */
  function categoriesHTML() {
    return '<div class="cat-top" data-testid="cat-catg-top"><div class="cat-count" id="catg_count" data-testid="catg-count"></div>'
      + '<div class="cat-acts"><button type="button" class="act" data-testid="catg-new" id="catg_new">＋ ' + esc(T('New category')) + '</button></div></div>'
      + '<div class="cat-list" id="cat_catgs" data-testid="cat-categories"></div>'
      + '<dialog class="sheet" id="catg_sheet" data-testid="catg-sheet"></dialog>';
  }
  function catgRows() { return CBCAT_UI.list || []; }
  function catgParentName(c) { var p = c.parent ? cbcatById(c.parent) : null; return p ? p.name : ''; }
  function paintCatgCount() {
    var node = el('catg_count'); if (!node) return;
    if (CBCAT_UI.err) { node.innerHTML = '<span class="err" data-testid="catg-read-err">' + esc(CBCAT_UI.err) + '</span>'; return; }
    var live = catgRows().filter(function (x) { return x.status !== 'retired'; }).length;
    node.innerHTML = '<b>' + esc(String(live)) + '</b> ' + esc(live === 1 ? T('category') : T('categories'))
      + (CBCAT_UI.counts && CBCAT_UI.counts.none ? ' <span class="tag" data-testid="catg-count-none">' + esc(String(CBCAT_UI.counts.none)) + ' ' + esc(T('items without a category')) + '</span>' : '');
  }
  async function readCatgs() {
    await cbcatLoad(true);   /* cap-categories.js: the rows + the server's counts; its own painters find no #cbcat_rows here and paint nothing */
    paintCatgCount();
    if (S.catList) S.catList.refresh();
  }
  function mountCatgs() {
    var host = el('cat_catgs'); if (!host) return;
    S.catList = CBList.mount(host, {
      key: 'catalogue-categories', t: tx, hl: false,
      rows: catgRows, id: function (c) { return c.id; }, rowTid: function (c) { return 'catg-row-' + c.id; },
      columns: [
        { key: 'name', label: T('Category'), prio: 1, w: 240, html: true, cell: function (c) { return '<span style="padding-inline-start:' + (12 * (c.depth || 0)) + 'px">' + (c.depth ? '<span class="sub">└ </span>' : '') + '<b>' + esc(c.name) + '</b></span>' + (c.note ? '<div class="sub cat-desc">' + esc(c.note) + '</div>' : ''); } },
        { key: 'n', label: T('Items'), prio: 2, w: 90, num: true, html: true, cell: function (c) { return '<span class="cbl-num">' + esc(String(cbcatCount(c.id))) + '</span>'; } },
        { key: 'parent', label: T('Under'), prio: 4, w: 160, html: true, cell: function (c) { return esc(catgParentName(c)) || '<span class="sub">—</span>'; } },
        { key: 'status', label: T('Status'), prio: 3, w: 110, html: true, cell: function (c) { return '<span class="tag ' + (c.status === 'retired' ? 'amber' : 'green') + '">' + esc(c.status === 'retired' ? T('Retired') : T('On the shelf')) + '</span>'; } }
      ],
      state: function () { return CBCAT_UI.busy && !catgRows().length ? 'loading' : CBCAT_UI.err ? 'error' : null; },
      error: function () { return { title: T('Your categories could not be read.'), sub: CBCAT_UI.err }; },
      empty: { title: T('No categories yet.'), sub: T('Add one with ＋ New category.') },
      search: function (c) { return c.name + ' ' + (c.note || ''); }, searchHint: T('Search categories'),
      filters: [{ key: 'status', label: T('Status'), all: T('Any'), options: [{ v: 'live', label: T('On the shelf') }, { v: 'retired', label: T('Retired') }], match: function (c, v) { return v === 'retired' ? c.status === 'retired' : c.status !== 'retired'; } }],
      sorts: [{ key: 'tree', label: T('As shelved'), cmp: function () { return 0; } }, { key: 'most', label: T('Most items'), cmp: function (a, b) { return cbcatCount(b.id) - cbcatCount(a.id); } }],
      actions: [
        { id: 'rename', label: T('Rename'), tid: 'catg-rename', run: function (c) { openCatg(c.id); } },
        { id: 'retire', label: T('Retire'), tid: 'catg-retire', when: function (c) { return c.status !== 'retired'; }, run: function (c) { cbcatRetire(c.id); afterCatgWrite(); } },
        { id: 'relive', label: T('Back on the shelf'), tid: 'catg-relive', when: function (c) { return c.status === 'retired'; }, run: function (c) { cbcatRelive(c.id).then(readCatgs); } }
      ],
      onOpen: function (c) { openCatg(c.id); }
    });
    var node = el('catg_new'); if (node) node.onclick = function () { openCatg(null); };
  }
  /** cbcatRetire asks first and writes on yes — the list re-reads once its own re-read has run (cbcatLoad sets busy false) */
  function afterCatgWrite() { var tries = 0; var t = setInterval(function () { if (++tries > 40 || !CBCAT_UI.busy) { clearInterval(t); readCatgs(); } }, 250); }
  function openCatg(id) {
    var c = id ? cbcatById(id) : null;
    CBCAT_UI.form = { id: id, name: c ? c.name : '', note: c ? c.note : '', parent: c ? c.parent : null, default_slab: c ? c.default_slab : null };
    var node = el('catg_sheet'); if (!node) return;
    var opts = cbcatParentOptions(id).map(function (item) { return '<option value="' + esc(item.id) + '"' + (c && c.parent === item.id ? ' selected' : '') + '>' + esc(item.name) + '</option>'; }).join('');
    node.innerHTML = '<button type="button" class="mx" data-testid="catg-sheet-close" aria-label="' + esc(T('Close')) + '">✕</button><h2 data-testid="catg-sheet-title">' + esc(c ? T('Rename “{n}”', { n: c.name }) : T('New category')) + '</h2>'
      + '<label class="fl" for="catg_name">' + esc(T('Name')) + '</label><input class="inp" id="catg_name" data-testid="catg-name" value="' + esc(CBCAT_UI.form.name) + '" oninput="cbcatField(\'name\', this.value)">'
      + '<label class="fl" for="catg_parent">' + esc(T('Under')) + '</label><select class="inp" id="catg_parent" data-testid="catg-parent" onchange="cbcatField(\'parent\', this.value || null)"><option value="">' + esc(T('— top level —')) + '</option>' + opts + '</select>'
      + '<label class="fl" for="catg_note">' + esc(T('Note')) + '</label><input class="inp" id="catg_note" data-testid="catg-note" value="' + esc(CBCAT_UI.form.note || '') + '" oninput="cbcatField(\'note\', this.value)">'
      + '<div class="cat-sheet-acts"><button type="button" class="act" data-testid="catg-save" id="catg_save">' + esc(c ? T('Save') : T('Add category')) + '</button><button type="button" class="act quiet" data-testid="catg-cancel" id="catg_cancel">' + esc(T('Cancel')) + '</button></div>'
      + '<div class="cat-out" id="cbcat_err" data-tone="error" data-testid="catg-err"></div>';   /* cbcatSave writes its refusal here, by this id */
    var close = function () { try { node.close(); } catch (_) { node.removeAttribute('open'); } node.innerHTML = ''; CBCAT_UI.form = null; CBCAT_UI.mode = 'view'; };
    node.querySelector('[data-testid="catg-sheet-close"]').onclick = close; el('catg_cancel').onclick = close;
    el('catg_save').onclick = function (event) { CBAction.once('catg-save', event.currentTarget, async function () { await cbcatSave(); if (CBCAT_UI.form) return; /* a refusal keeps the form open with its sentence */ close(); await readCatgs(); }); };
    if (!node.open) { try { node.showModal(); } catch (_) { node.setAttribute('open', ''); } }
  }

  /* ── IMPORT ── */
  function importHTML() {
    return '<div class="cat-import" data-testid="cat-import">'
      + '<h2 class="cat-h">' + esc(T('Import a sheet')) + '</h2>'
      + '<p class="sub">' + esc(T('Choose a spreadsheet or paste its rows. We check the headings first; nothing is imported until you say so.')) + '</p>'
      + '<div class="cat-sheet-acts"><button type="button" class="act quiet" data-testid="cat-template" onclick="downloadCatalogueTemplate(this)">📄 ' + esc(T('Download the template')) + '</button></div><div id="cat_tpl_out" data-testid="cat-template-out"></div>'
      + '<label class="fl" for="cf_file">' + esc(T('File (.csv or .xlsx)')) + '</label><input type="file" id="cf_file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-testid="cat-check-file" onchange="_cfPick(this)">'
      + '<div class="sub" id="cf_file_name" data-testid="cat-check-filename"></div>'
      + '<label class="fl" for="cf_text">' + esc(T('…or paste the rows here, heading row first')) + '</label><textarea class="inp mono" id="cf_text" data-testid="cat-check-text" rows="6"></textarea>'
      + '<div class="cat-sheet-acts"><button type="button" class="act" data-testid="cat-check-run" onclick="_cfRun(this)">' + esc(T('Check')) + '</button>'
      + '<button type="button" class="act quiet" id="cf_import" data-testid="cat-import-run" onclick="_cfImport(this)" disabled title="' + esc(T('Check a file first')) + '">' + esc(T('Import')) + '</button></div>'
      + '<div id="cf_out" data-testid="cat-check-out"></div></div>';
  }

  /* ── the frame's sections ── */
  function show(k) {
    S.sec = k === 'categories' || k === 'import' ? k : 'items';
    var node = S.host; if (!node) return;
    if (S.list) { S.list.destroy(); S.list = null; }
    if (S.catList) { S.catList.destroy(); S.catList = null; }
    if (S.sec === 'items') { node.innerHTML = itemsHTML(); mountItems(); paintCount(); readItems(); }
    else if (S.sec === 'categories') { node.innerHTML = categoriesHTML(); mountCatgs(); paintCatgCount(); readCatgs(); }
    else { UI._cf = null; UI._cfXlsx = null; node.innerHTML = importHTML(); }
    if (S.onSection) S.onSection(S.sec);
  }
  /** an import landed (the _cfImportRun painter calls this) — the list and the counts re-read */
  function changed() { if (S.sec === 'items') readItems(); if (typeof cbCatgLive === 'function') cbCatgLive(true); }
  function mount(host, o) {
    o = o || {}; S.host = host; S.me = o.me || null; S.onSection = o.onSection || null; S.limit = PAGE;
    /* before the first paint: who may see prices (the server's field), the live shelf (category names on the rows), the declared columns (the sheet's extra facts) */
    var first = readCosts().then(function () { if (typeof cbCatgLive === 'function') return cbCatgLive(); }).then(function () { return catDeclared(); }).then(function () { show(o.section || 'items'); });
    return { show: show, refresh: function () { if (S.sec === 'items') readItems(); else if (S.sec === 'categories') readCatgs(); }, ready: first };
  }
  return { mount: mount, show: show, page: page, changed: changed, state: function () { return S; } };
})();
