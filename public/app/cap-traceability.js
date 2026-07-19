/* app/cap-traceability.js — TRACEABILITY capability (lazy via ensureCap('traceability')).
 * The recall DRAMA (not a network diagram): flag a batch → walk FORWARD → the recall set lights up with a
 * ₹-saved number in seconds; start from any node → walk BACKWARD → provenance to source in N hops.
 * Operator lens (TR-6): topology + product only — commercial terms stay per-party, so a rival's deal price is
 * never shown here. Backend: routes/chits.js  GET /api/chits/:id/trace?dir=forward|backward. Self-registers its EP. */
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    traceWalk: { m:'GET', p:'/api/chits/:id/trace', ok:'y' },
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
    + '<div style="flex:1;overflow:auto;min-height:0">' + body + '</div></div>';
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
  var nodes = r.nodes || [], edges = r.edges || [];
  var targeted = r.reachable_count || nodes.length;
  var cost = (UI.traceCost == null ? 5000 : UI.traceCost);
  var blanket = (UI.traceBlanket == null ? 200 : UI.traceBlanket);
  var saved = Math.max(0, blanket - targeted) * cost;
  var termIds = {}; (r.terminals || []).forEach(function(t){ termIds[t.chit_id] = 1; });

  var banner = '<div style="margin:16px 18px;padding:16px 18px;border:1px solid #e6a79f;background:linear-gradient(180deg,#fef6f5,#fdeceae0);border-radius:12px">'
    + '<div style="font-size:20px;font-weight:800;color:#a5382e">🚨 Recall set — ' + targeted + ' node' + (targeted === 1 ? '' : 's') + '</div>'
    + '<div style="font-size:12.5px;color:#7a4139;margin-top:3px">' + (r.depth_max || 0) + ' hop' + ((r.depth_max || 0) === 1 ? '' : 's') + ' deep · '
      + (r.terminals || []).length + ' exposure endpoint' + ((r.terminals || []).length === 1 ? '' : 's') + '</div>'
    + '<div style="margin-top:11px;font-size:14px;font-weight:800;color:#2c7a43">' + _traceRs(saved) + ' saved'
      + '<span style="font-weight:600;color:var(--grey);font-size:12px"> — recall ' + targeted + ' precise nodes, not a blanket ~' + blanket + '</span></div>'
    + '</div>';

  var terms = (r.terminals || []).length
    ? '<div style="margin:0 18px 8px"><div style="font-size:11px;font-weight:800;color:var(--grey);letter-spacing:.05em;margin-bottom:4px">EXPOSURE ENDPOINTS</div>'
      + (r.terminals || []).map(function(t){ return _traceChip({ chit_id:t.chit_id, product:t.product }, true); }).join('') + '</div>'
    : '';

  var maxD = r.depth_max || 0, tiers = '';
  for (var d = 0; d <= maxD; d++){
    var tn = nodes.filter(function(n){ return n.depth === d; });
    if (!tn.length) continue;
    tiers += '<div style="padding:8px 18px;border-top:1px solid #f2f4f6">'
      + '<div style="font-size:10.5px;font-weight:800;color:var(--grey);letter-spacing:.05em;margin-bottom:3px">' + (d === 0 ? 'FLAGGED' : 'HOP ' + d) + ' · ' + tn.length + '</div>'
      + tn.map(function(n){ return _traceChip(n, !!termIds[n.chit_id]); }).join('') + '</div>';
  }
  return banner + terms + tiers;
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
