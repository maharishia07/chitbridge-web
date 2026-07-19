/* app/cap-traceability.js — TRACEABILITY capability (lazy via ensureCap('traceability')).
 * The recall DRAMA (not a network diagram): flag a batch → walk FORWARD → the recall set lights up with a
 * ₹-saved number in seconds; start from any node → walk BACKWARD → provenance to source in N hops.
 * Operator lens (TR-6): topology + product only — commercial terms stay per-party, so a rival's deal price is
 * never shown here. Backend: routes/chits.js  GET /api/chits/:id/trace?dir=forward|backward. Self-registers its EP. */
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    traceWalk:    { m:'GET', p:'/api/chits/:id/trace', ok:'y' },
    traceBatches: { m:'GET', p:'/api/chits/trace/batches', ok:'y' },
  });
}

function _traceNum(v, d){ v = parseInt(v, 10); return (isFinite(v) && v >= 0) ? v : d; }
function _traceRs(v){ try { return '₹' + Number(v||0).toLocaleString('en-IN'); } catch(e){ return '₹' + (v||0); } }
function _traceShort(id){ id = String(id||''); return id.length > 8 ? '…' + id.slice(-6) : id; }

function traceabilityScreen(){
  var id = UI.traceId || '';
  var cost = (UI.traceCost == null ? 5000 : UI.traceCost);
  var blanket = (UI.traceBlanket == null ? 200 : UI.traceBlanket);
  var res = UI.traceResult;

  var controls =
    '<div style="padding:14px 18px;border-bottom:1px solid var(--line)">'
    + '<div style="font-size:17px;font-weight:800">🧭 Traceability — recall &amp; provenance</div>'
    + '<div style="font-size:11.5px;color:var(--grey);margin-top:2px">Flag a batch to see exactly who it reached; trace any node back to its source. '
      + 'You see topology + product only — <b>commercial terms stay per-party</b>.</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px">'
      + '<input id="traceIdIn" value="' + esc(id) + '" placeholder="Paste a batch / chit id" '
        + 'oninput="UI.traceId=this.value" onkeydown="if(event.key===\'Enter\')runTrace(\'forward\')" '
        + 'style="flex:1;min-width:220px;padding:9px 11px;border:1px solid var(--line);border-radius:9px;font-size:13px;font-family:monospace">'
      + '<button class="pri" onclick="runTrace(\'forward\')" style="padding:9px 14px">🚨 Recall set ▸</button>'
      + '<button onclick="runTrace(\'backward\')" style="padding:9px 14px">◂ To source</button>'
    + '</div>'
    + '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-top:10px;font-size:11.5px;color:var(--grey)">'
      + '<label>₹ / node&nbsp;<input value="' + cost + '" oninput="UI.traceCost=_traceNum(this.value,5000)" '
        + 'style="width:80px;padding:4px 7px;border:1px solid var(--line);border-radius:7px;font-size:12px"></label>'
      + '<label>blanket-recall size&nbsp;<input value="' + blanket + '" oninput="UI.traceBlanket=_traceNum(this.value,200)" '
        + 'style="width:70px;padding:4px 7px;border:1px solid var(--line);border-radius:7px;font-size:12px"></label>'
      + '<span>— the ₹ saved is targeted recall vs a blanket recall of your whole network.</span>'
    + '</div>'
    + '</div>';

  var body;
  if (UI.traceLoading) body = loader('Walking the chain…');
  else if (res && res.error) body = '<div style="margin:22px 18px;padding:14px 16px;border:1px solid #f0c9c4;background:#fdf3f2;border-radius:10px;font-size:13px;color:#a5382e">' + esc(res.error) + '</div>';
  else if (res && res.dir === 'forward') body = _traceFwd(res);
  else if (res && res.dir === 'backward') body = _traceBwd(res);
  else body = emptyState('🧭', 'Flag a batch to trace it', 'Paste a batch or chit id above, then Recall set ▸ (who it reached) or ◂ To source (where it came from).');

  return '<div style="display:flex;flex-direction:column;height:100%;min-height:0">' + controls
    + '<div style="flex:1;overflow:auto;min-height:0">' + _traceBatchPicker() + body + '</div></div>';
}

// The batches the signed-in operator can trace — each row prints its id (the "traceability string") and is
// clickable, so a demo works on any machine without pasting a key. RLS-scoped server-side (you see only yours).
async function loadTraceBatches(){
  try { var r = await api('traceBatches'); UI.traceBatches = (r && r.batches) || []; }
  catch(e){ UI.traceBatches = []; }
  if (typeof renderApp === 'function') renderApp();
}
function _traceBatchPicker(){
  if (UI.traceBatches === undefined){ loadTraceBatches(); return '<div style="padding:12px 20px;color:var(--grey);font-size:12px">Loading your batches…</div>'; }
  if (!UI.traceBatches.length) return '<div style="padding:12px 20px;color:var(--grey);font-size:12px">No traceable batches yet — seed a chain, then reload.</div>';
  var rows = UI.traceBatches.map(function(b){
    var name = esc(b.product || b.to_name || 'batch');
    var meta = [ (b.qty != null ? (esc(String(b.qty)) + esc(b.unit ? (' ' + b.unit) : '')) : ''), (b.sender_name ? ('from ' + esc(b.sender_name)) : '') ].filter(Boolean).join(' · ');
    return '<div onclick="UI.traceId=\'' + b.chit_id + '\';runTrace(\'forward\')" title="Click to trace this batch" '
      + 'style="cursor:pointer;padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:#fff;display:flex;flex-direction:column;gap:2px">'
      + '<div style="display:flex;align-items:center;gap:7px"><b style="font-size:13px">' + name + '</b>'
        + (b.is_origin ? '<span style="font-size:9px;font-weight:800;color:#2c5aa0;background:#eaf1fb;border-radius:5px;padding:1px 5px">ORIGIN</span>' : '') + '</div>'
      + (meta ? '<div style="font-size:11px;color:var(--grey)">' + meta + '</div>' : '')
      + '<div style="font-family:monospace;font-size:10px;color:#8a94a3;word-break:break-all">' + esc(b.chit_id) + '</div>'
      + '</div>';
  }).join('');
  return '<div style="padding:10px 18px 4px">'
    + '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;margin-bottom:7px">YOUR BATCHES — click one to trace</div>'
    + '<div style="display:grid;gap:7px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">' + rows + '</div></div>';
}

function _traceChip(n, isTerm){
  var label = esc(n.product || '(no product)');
  var qty = (n.qty != null) ? (' · ' + esc(String(n.qty)) + esc(n.unit ? (' ' + n.unit) : '')) : '';
  var badge = n.is_origin ? '<span style="font-size:9.5px;font-weight:800;color:#2c5aa0;background:#eaf1fb;border-radius:6px;padding:1px 5px;margin-left:6px">ORIGIN</span>'
            : (isTerm ? '<span style="font-size:9.5px;font-weight:800;color:#a5382e;background:#fdecea;border-radius:6px;padding:1px 5px;margin-left:6px">EXPOSED</span>' : '');
  var bd = isTerm ? '#e6a79f' : (n.is_origin ? '#a9c6ef' : 'var(--line)');
  var bg = isTerm ? '#fef6f5' : (n.is_origin ? '#f4f8fe' : '#fff');
  return '<span style="display:inline-flex;align-items:center;border:1px solid ' + bd + ';background:' + bg + ';border-radius:9px;padding:5px 9px;font-size:12px;margin:3px 5px 3px 0">'
    + '<b style="font-weight:700">' + label + '</b>' + qty
    + '<span style="color:var(--grey);font-family:monospace;font-size:10.5px;margin-left:7px">' + _traceShort(n.chit_id) + '</span>' + badge + '</span>';
}

function _traceFwd(r){
  var nodes = r.nodes || [];
  var targeted = r.reachable_count || nodes.length;
  var cost = (UI.traceCost == null ? 5000 : UI.traceCost);
  var blanket = (UI.traceBlanket == null ? 200 : UI.traceBlanket);
  var saved = Math.max(0, blanket - targeted) * cost;

  var banner = '<div style="margin:16px 18px;padding:16px 18px;border:1px solid #e6a79f;background:linear-gradient(180deg,#fef6f5,#fdeceae0);border-radius:12px">'
    + '<div style="font-size:20px;font-weight:800;color:#a5382e">🚨 Recall set — ' + targeted + ' place' + (targeted === 1 ? '' : 's') + ' hold this batch</div>'
    + '<div style="font-size:12.5px;color:#7a4139;margin-top:3px">' + (r.depth_max || 0) + ' hop' + ((r.depth_max || 0) === 1 ? '' : 's') + ' deep · '
      + (r.terminals || []).length + ' exposed endpoint' + ((r.terminals || []).length === 1 ? '' : 's') + '</div>'
    + '<div style="margin-top:11px;font-size:14px;font-weight:800;color:#2c7a43">' + _traceRs(saved) + ' saved'
      + '<span style="font-weight:600;color:var(--grey);font-size:12px"> — recall these ' + targeted + ', not a blanket ~' + blanket + '</span></div>'
    + ((r.flagged || 0) > 0 ? '<div style="margin-top:11px;font-size:13px;font-weight:800;color:#fff;background:#c0453b;border-radius:8px;padding:7px 12px;display:inline-block">⚠ ' + r.flagged + ' node' + (r.flagged === 1 ? '' : 's') + ' fail mass-balance — more went OUT than came IN</div>' : '')
    + '</div>';

  return banner
    + '<div style="padding:4px 20px 22px">'
    + '<div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;margin:6px 0 6px">WHO HOLDS IT — recall tree</div>'
    + _traceTree(r) + '</div>';
}

// Each node = a handoff, labelled by the PARTY THAT HOLDS IT (to_name) with from-whom + how much. Rendered as a
// parent→child tree from the walk's edges; the visited-set keeps a diamond from rendering twice.
function _traceQ(v){ try { return Number(v || 0).toLocaleString('en-IN'); } catch(e){ return String(v); } }
function _traceNode(n, isTerm){
  var who = esc(n.to_name || n.product || _traceShort(n.chit_id));
  var bal = n.balance, isRed = !!(bal && bal.status === 'red');
  var bits = [];
  if (n.sender_name) bits.push('from ' + esc(n.sender_name));
  if (n.qty != null) bits.push('<b style="color:#3a4048">' + esc(String(n.qty)) + esc(n.unit ? (' ' + n.unit) : '') + '</b>');
  if (n.product) bits.push(esc(n.product));
  bits.push('<span style="font-family:monospace;font-size:10px;opacity:.6">' + _traceShort(n.chit_id) + '</span>');
  var badge = n.is_origin ? '<span style="font-size:9.5px;font-weight:800;color:#2c5aa0;background:#eaf1fb;border-radius:6px;padding:1px 6px;margin-left:7px">ORIGIN</span>'
            : (isTerm ? '<span style="font-size:9.5px;font-weight:800;color:#a5382e;background:#fdecea;border-radius:6px;padding:1px 6px;margin-left:7px">EXPOSED</span>' : '');
  if (isRed) badge += '<span style="font-size:9.5px;font-weight:800;color:#fff;background:#c0453b;border-radius:6px;padding:1px 6px;margin-left:7px">⚠ OUT &gt; IN</span>';
  var dot = (isRed || isTerm) ? '#c0453b' : (n.is_origin ? '#2c5aa0' : '#8a94a3');
  var balLine = isRed
    ? '<div style="font-size:11px;color:#a5382e;font-weight:700;margin-left:17px;margin-top:2px">claimed ' + _traceQ(bal.out) + ' out, received ' + _traceQ(bal.in) + ' in — <u>' + _traceQ(bal.delta) + ' ' + esc(bal.base_unit || '') + ' unaccounted</u></div>'
    : '';
  return '<div style="padding:6px 0' + (isRed ? ';background:#fdf3f2;border-radius:8px' : '') + '">'
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap' + (isRed ? ';padding-left:6px' : '') + '">'
      + '<span style="width:9px;height:9px;border-radius:50%;background:' + dot + ';flex:0 0 auto"></span>'
      + '<span style="font-weight:700;font-size:13.5px' + (isRed ? ';color:#a5382e' : '') + '">' + who + '</span>' + badge + '</div>'
    + '<div style="font-size:11.5px;color:var(--grey);margin-left:17px;margin-top:1px' + (isRed ? ';padding-left:6px' : '') + '">' + bits.join(' · ') + '</div>'
    + balLine
    + '</div>';
}
function _traceTree(r){
  var byId = {}; (r.nodes || []).forEach(function(n){ byId[n.chit_id] = n; });
  var kids = {}; (r.edges || []).forEach(function(e){ (kids[e.from] = kids[e.from] || []).push(e.to); });
  var term = {}; (r.terminals || []).forEach(function(t){ term[t.chit_id] = 1; });
  var seen = {};
  function render(id){
    if (seen[id]) return '';
    seen[id] = 1;
    var n = byId[id] || { chit_id:id };
    var kidHtml = (kids[id] || []).map(render).join('');
    return '<div>' + _traceNode(n, !!term[id])
      + (kidHtml ? ('<div style="margin-left:8px;border-left:1.5px solid var(--line);padding-left:15px">' + kidHtml + '</div>') : '')
      + '</div>';
  }
  return render(r.start);
}

function _traceBwd(r){
  var path = r.path || [], nodes = r.nodes || [];
  var byId = {}; nodes.forEach(function(n){ byId[n.chit_id] = n; });
  var head = '<div style="margin:16px 18px;padding:14px 18px;border:1px solid #a9c6ef;background:#f4f8fe;border-radius:12px">'
    + '<div style="font-size:18px;font-weight:800;color:#2c5aa0">◂ Provenance — to source</div>'
    + '<div style="font-size:12.5px;color:#3a4d6b;margin-top:2px">' + r.hops + ' hop' + (r.hops === 1 ? '' : 's') + ' from the flagged node back to origin</div></div>';
  var steps = path.map(function(cid, i){
    var n = byId[cid] || { chit_id: cid };
    var arrow = i < path.length - 1 ? '<div style="color:var(--grey);font-size:14px;padding:2px 0 2px 22px">↓</div>' : '';
    var tag = (i === 0) ? 'SOURCE' : (i === path.length - 1 ? 'FLAGGED' : 'HOP ' + i);
    return '<div style="padding:2px 18px"><span style="font-size:10px;font-weight:800;color:var(--grey);margin-right:8px">' + tag + '</span>' + _traceChip(n, false) + '</div>' + arrow;
  }).join('');
  return head + '<div style="padding:6px 0 18px">' + steps + '</div>';
}

function runTrace(dir){
  var id = (UI.traceId || '').trim();
  if (!id){ if (typeof toast === 'function') toast('Paste a batch / chit id to trace.'); return; }
  UI.traceLoading = true; UI.traceResult = undefined; if (typeof renderApp === 'function') renderApp();
  api('traceWalk', { params:{ id:id }, query:{ dir:dir } })
    .then(function(r){ UI.traceLoading = false; r = r || {}; r.dir = dir; UI.traceResult = r; if (typeof renderApp === 'function') renderApp(); })
    .catch(function(e){ UI.traceLoading = false; UI.traceResult = { error: (e && e.message) || 'Trace failed — is this a batch you oversee?' }; if (typeof renderApp === 'function') renderApp(); });
}
