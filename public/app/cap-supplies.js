/* app/cap-supplies.js — SUPPLIES: what the shop buys to USE, never to sell.
 *
 * Athi, 2026-09-10: *"i would purchase what I intend to sell, rest i may use it, so all cannot go into
 * catalogue"* and *"we may have to have a screen to add sundry items in case if it is not coming through the
 * channel."*
 *
 * ⭐⭐⭐ DELIBERATELY THIN, and that is a decision rather than an unfinished screen. Asked whether this work was
 * crossing into ERP territory, the honest answer was: partly, and this is the most ERP-shaped and least
 * differentiating part of it. So it does the four things a shopkeeper actually needs — see the list, add one,
 * record a purchase that came from outside ChitBridge, say some was used — and stops. No reorder points, no
 * consumption forecasting, no supplier price history. Those belong to whatever keeps the books.
 *
 * ⚠️ NOTHING HERE HAS A SELLING PRICE, and there is no field for one. Supplies live in their own table (b217) so
 * a storefront query cannot include one by forgetting a WHERE clause. A price box would be an invitation.
 *
 * Injected by ensureCap('supplies'). Classic script, shared global scope — uses api, esc, scr, modal/closeModal,
 * toast, money, UI, tx/txf, scrErr.
 */

var SUP = { rows: null, busy: false, err: null };

function suppliesScreen(){
  return scr('🧴 ' + tx('Supplies'), 'sup_body', 'supplies');
}

async function supLoad(){
  if (SUP.busy) return;
  SUP.busy = true;
  try {
    var r = await api('supplyList');
    SUP.rows = (r && r.supplies) || [];
    SUP.notReady = r && r.not_ready ? r.not_ready : null;
    SUP.err = null;
  } catch (e) { SUP.err = e; }
  SUP.busy = false;
  supPaint();
}

/** ⚠️ ONE PAINTER, and it repaints the BODY only — the rail and the header do not move for a list change */
function supPaint(){
  var el = document.getElementById('sup_body'); if (!el) return;
  if (SUP.err) { el.innerHTML = scrErr(SUP.err, 'supplies', 'supLoad()'); return; }
  if (SUP.notReady) {
    el.innerHTML = supEmpty('⚙️', tx('Supplies are not switched on yet'), esc(SUP.notReady));
    return;
  }
  var rows = SUP.rows || [];

  var head = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'
    + '<button class="composebtn pri" data-testid="sup-add" onclick="supAddModal()">+ ' + tx('Add a supply') + '</button>'
    + '<button class="composebtn" data-testid="sup-buy" onclick="supBuyModal()">🧾 ' + tx('Record a purchase') + '</button>'
    + '</div>'
    /* ⭐ THE SENTENCE THAT STOPS SOMEBODY PUTTING PRODUCTS HERE. Without it this screen looks like a second
       catalogue, and the first person to misread it will put something sellable in it. */
    + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.6;margin-bottom:14px">'
    + tx('Things the shop buys and uses — packing, cleaning, stationery. These never appear on your storefront and '
       + 'they have no selling price. What you buy to SELL lives in the Catalogue.') + '</div>';

  if (!rows.length) {
    el.innerHTML = head + supEmpty('🧴', tx('Nothing here yet'),
      tx('Add what the shop buys for itself, or record a purchase from a shop that is not on ChitBridge.'));
    return;
  }

  var counted = rows.filter(function(x){ return x.keep_stock; }).length;
  el.innerHTML = head
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:8px" data-testid="sup-count">'
    + txf('{n} supplies · {c} counted', { n: rows.length, c: counted }) + '</div>'
    + '<div class="itab" style="border:1px solid var(--line);border-radius:12px;overflow:hidden">'
    + rows.map(supRow).join('') + '</div>';
}

function supEmpty(icon, title, note){
  return '<div style="text-align:center;padding:38px 16px;color:var(--grey)">'
    + '<div style="font-size:var(--fs-6)">' + icon + '</div>'
    + '<div style="font-weight:700;color:var(--ink);margin-top:6px">' + esc(title) + '</div>'
    + '<div style="font-size:var(--fs-1);margin-top:6px;max-width:42ch;margin-inline:auto;line-height:1.6">' + note + '</div></div>';
}

function supRow(s){
  /**
   * ⭐ THE TWO FACTS A SHOPKEEPER WANTS, and no more: what it last cost and who from. That is what makes a repeat
   * purchase recognisable at the counter of the hardware shop — "what did we pay last time" — and it is the whole
   * reason to keep this list rather than just an expense line.
   */
  var last = s.last_cost != null
    ? (typeof money === 'function' ? money(s.last_cost) : s.last_cost) + (s.last_from ? ' · ' + esc(s.last_from) : '')
    : '<span style="color:var(--grey)">' + tx('not bought yet') + '</span>';
  /* ⚠️ COUNTED vs EXPENSED said in words, because "keep_stock" is our word and a shopkeeper reads neither */
  var kept = s.keep_stock
    ? '<span class="pillx" style="background:var(--ok-tint);color:var(--ok-2)">' + tx('counted') + '</span>'
    : '<span class="pillx" style="background:var(--card);color:var(--grey);border:1px solid var(--line)">' + tx('expensed') + '</span>';
  return '<div class="kv" data-testid="sup-row" style="display:flex;gap:10px;align-items:center;padding:10px 13px;'
    + 'border-bottom:1px dashed var(--line)">'
    + '<div style="flex:1;min-width:0">'
    +   '<div style="font-weight:650">' + esc(s.name) + (s.unit ? ' <span style="color:var(--grey);font-weight:400">· ' + esc(s.unit) + '</span>' : '') + '</div>'
    +   '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">' + last + '</div>'
    + '</div>'
    + kept
    + (s.keep_stock ? '<button class="btn2" data-testid="sup-use" onclick="supUseModal(\'' + esc(s.supply_item_id) + '\',\'' + esc(s.name) + '\')">' + tx('Used some') + '</button>' : '')
    + '</div>';
}

/* ── add one by hand ───────────────────────────────────────────────────────────────────────────────────────── */
function supAddModal(){
  modal('<div style="padding:2px"><div style="font-weight:800;font-size:var(--fs-4)">' + tx('Add a supply') + '</div>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin:6px 0 12px;line-height:1.6">'
    + tx('Something the shop uses. It will never appear on your storefront.') + '</div>'
    + '<input class="inp" id="sup_name" data-testid="sup-name" placeholder="' + tx('What is it?') + '" style="width:100%;margin-bottom:8px">'
    + '<input class="inp" id="sup_unit" data-testid="sup-unit" placeholder="' + tx('Unit (piece, can, box)') + '" style="width:100%;margin-bottom:10px">'
    /* ⭐ THE MATERIALITY CHOICE, in a shopkeeper's words and defaulting to the cheaper answer */
    + '<label style="display:flex;gap:8px;align-items:flex-start;font-size:var(--fs-2);cursor:pointer">'
    +   '<input type="checkbox" id="sup_keep" data-testid="sup-keep" style="margin-top:3px">'
    +   '<span>' + tx('Count how many are left') + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.5">'
    +   tx('Leave this off for small things — they are recorded and costed, just not counted. Turn it on for '
       + 'something bought in bulk, where how many are left is a real question.') + '</div></span></label>'
    + '<div style="display:flex;gap:8px;margin-top:16px">'
    +   '<button class="composebtn" style="flex:1" onclick="closeModal()">' + tx('Cancel') + '</button>'
    +   '<button class="composebtn pri" style="flex:1" data-testid="sup-save" onclick="supAdd()">' + tx('Add') + '</button>'
    + '</div></div>', false);
}

async function supAdd(){
  var name = (document.getElementById('sup_name') || {}).value || '';
  if (!name.trim()) { toast(tx('It needs a name')); return; }
  try {
    await api('supplyAdd', { body: { name: name.trim(),
      unit: ((document.getElementById('sup_unit') || {}).value || '').trim() || null,
      keep_stock: !!(document.getElementById('sup_keep') || {}).checked } });
    closeModal(); toast(tx('Added')); supLoad();
  } catch (e) { toast((e && e.message) || tx('Could not add it')); }
}

/* ── record a purchase that never came through a channel ───────────────────────────────────────────────────── */
function supBuyModal(){
  /**
   * ⭐⭐ THE COMMON CASE, NOT THE EXCEPTION. Most sundry buying is cash from the shop down the road with a paper
   * bill and no ChitBridge relationship — so "who from" is free text and always will be. Requiring a relationship
   * would make this useless for exactly the purchases it exists for.
   */
  var opts = (SUP.rows || []).map(function(s){ return '<option value="' + esc(s.name) + '">'; }).join('');
  modal('<div style="padding:2px"><div style="font-weight:800;font-size:var(--fs-4)">' + tx('Record a purchase') + '</div>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin:6px 0 12px;line-height:1.6">'
    + tx('Something you bought for the shop from outside ChitBridge — a cash bill from the shop down the road.') + '</div>'
    + '<div style="display:flex;gap:8px;margin-bottom:8px">'
    +   '<input class="inp" id="sup_from" data-testid="sup-from" placeholder="' + tx('Who from') + '" style="flex:1">'
    +   '<input class="inp" id="sup_ref" data-testid="sup-ref" placeholder="' + tx('Bill number') + '" style="width:140px">'
    + '</div>'
    + '<datalist id="sup_known">' + opts + '</datalist>'
    + '<div id="sup_lines"></div>'
    + '<button class="btn2" data-testid="sup-addline" onclick="supAddLine()" style="margin-top:6px">+ ' + tx('another line') + '</button>'
    + '<div style="display:flex;gap:8px;margin-top:16px">'
    +   '<button class="composebtn" style="flex:1" onclick="closeModal()">' + tx('Cancel') + '</button>'
    +   '<button class="composebtn pri" style="flex:1" data-testid="sup-record" onclick="supBuy()">' + tx('Record it') + '</button>'
    + '</div></div>', false);
  supAddLine();
}

var SUP_LINE = 0;
function supAddLine(){
  var box = document.getElementById('sup_lines'); if (!box) return;
  var i = SUP_LINE++;
  var d = document.createElement('div');
  d.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
  d.innerHTML = '<input class="inp" list="sup_known" data-l="' + i + '" data-f="name" data-testid="sup-l-name" placeholder="' + tx('What') + '" style="flex:1">'
    + '<input class="inp" type="number" data-l="' + i + '" data-f="qty" data-testid="sup-l-qty" placeholder="' + tx('Qty') + '" style="width:70px">'
    + '<input class="inp" data-l="' + i + '" data-f="unit" placeholder="' + tx('Unit') + '" style="width:70px">'
    + '<input class="inp" type="number" data-l="' + i + '" data-f="cost" data-testid="sup-l-cost" placeholder="' + tx('Cost each') + '" style="width:90px">';
  box.appendChild(d);
}

async function supBuy(){
  var lines = {}, box = document.getElementById('sup_lines');
  (box ? box.querySelectorAll('input[data-l]') : []).forEach(function(inp){
    var i = inp.getAttribute('data-l'); lines[i] = lines[i] || {};
    lines[i][inp.getAttribute('data-f')] = inp.value;
  });
  var body = { from: ((document.getElementById('sup_from') || {}).value || '').trim() || null,
               ref: ((document.getElementById('sup_ref') || {}).value || '').trim(),
               lines: Object.keys(lines).map(function(k){ return lines[k]; })
                 .filter(function(l){ return (l.name || '').trim() && Number(l.qty) > 0; })
                 .map(function(l){ return { name: l.name.trim(), qty: Number(l.qty),
                                            unit: (l.unit || '').trim() || null,
                                            cost: l.cost === '' ? null : Number(l.cost) }; }) };
  /* ⚠️ A REFERENCE IS REQUIRED. Without one a repeated entry cannot be told from a second purchase, and the same
     cash bill typed twice would double the spend. The message says what to put, not that a field is missing. */
  if (!body.ref) { toast(tx('Give it a reference — the bill number, or the date and the shop')); return; }
  if (!body.lines.length) { toast(tx('Add at least one line with a quantity')); return; }
  try {
    var r = await api('supplyBuy', { body: body });
    closeModal(); toast(r && r.says ? r.says : tx('Recorded')); supLoad();
  } catch (e) { toast((e && e.message) || tx('Could not record it')); }
}

/* ── used some ─────────────────────────────────────────────────────────────────────────────────────────────── */
function supUseModal(id, name){
  modal('<div style="padding:2px"><div style="font-weight:800;font-size:var(--fs-4)">' + esc(name) + '</div>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin:6px 0 12px;line-height:1.6">'
    + tx('How many did the shop use? This is what turns a purchase into something you can read later.') + '</div>'
    + '<input class="inp" type="number" id="sup_use_qty" data-testid="sup-use-qty" placeholder="' + tx('How many') + '" style="width:100%">'
    + '<div style="display:flex;gap:8px;margin-top:16px">'
    +   '<button class="composebtn" style="flex:1" onclick="closeModal()">' + tx('Cancel') + '</button>'
    +   '<button class="composebtn pri" style="flex:1" data-testid="sup-use-save" onclick="supUse(\'' + esc(id) + '\')">' + tx('Record') + '</button>'
    + '</div></div>', false);
}

async function supUse(id){
  var q = Number((document.getElementById('sup_use_qty') || {}).value || 0);
  if (!(q > 0)) { toast(tx('How many?')); return; }
  try {
    await api('supplyUse', { params: { id: id }, body: { qty: q } });
    closeModal(); toast(tx('Recorded')); supLoad();
  } catch (e) { toast((e && e.message) || tx('Could not record it')); }
}
