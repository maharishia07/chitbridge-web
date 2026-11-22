/* app/cap-network-storefront.js — the STOREFRONT panel of a network node: what the node's online shop shows and how it is set. Split out of cap-network.js (file-size ratchet, batch 1129; capability split), code moved verbatim.
 * OWNS      the storefront config panel: _storefrontConfig
 * CALLED BY cap-network.js (the node config dispatch calls _storefrontConfig for k === 'storefront'); loaded with it by ensureCap('network') through CAP_WITH in app.html
 * FLOW      the node view picks a panel by kind → _storefrontConfig(n) → the panel html (setters live in cap-network.js)
 * CARD      04-network/network-design-builder
 * OWNER     cb-network
 * RISK      plain
 */
'use strict';
function _storefrontConfig(n) {
  var e = n.exposure || 'private';
  var o = _ensureOrder(n);
  var opt = function (val, label, hint) {
    var on = e === val;
    return (
      '<div data-cbsid="BUS004-C29" onclick="netSetExposure(\'' +
      n.key +
      "','" +
      val +
      '\')" style="cursor:pointer;padding:8px 10px;border:1px solid ' +
      (on ? 'var(--ok-2)' : 'var(--line)') +
      ';border-radius:9px;background:' +
      (on ? 'var(--ok-tint)' : 'var(--card)') +
      ';color:' +
      (on ? 'var(--on-card)' : 'var(--on-card)') +
      ';margin-top:6px">' +
      '<b style="font-size:var(--fs-2);color:' +
      (on ? 'var(--ok-2)' : 'var(--ink-2)') +
      '">' +
      (on ? '● ' : '○ ') +
      label +
      '</b>' +
      '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">' +
      hint +
      '</div></div>'
    );
  };
  // Visibility MOVED to the node itself (_netVisibilityBlock). Two controls for one value is how a person sets it
  // in one place and finds it changed in the other; this panel now only REPORTS it and points at the real control.
  var curLabel =
    (
      NET_EXPOSURE.filter(function (x) {
        return x.k === (n.exposure || 'private');
      })[0] || {}
    ).label || '— Private';
  var view =
    '<div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em">' +
    tx('👁️ WHO SEES IT') +
    '</div>' +
    '<div style="font-size:var(--fs-2);color:var(--grey);margin-top:5px;line-height:1.55">Currently <b>' +
    esc(curLabel) +
    "</b> — set at the top of this node, under <b>Who can see this store's catalogue</b>.</div>";
  void opt;
  var methOpts = CAT_METHODS.map(function (item) {
    return '<option value="' + item.k + '"' + ((o.method || 'cart') === item.k ? ' selected' : '') + '>' + item.label + '</option>';
  }).join('');
  var mh =
    (
      CAT_METHODS.filter(function (item) {
        return item.k === (o.method || 'cart');
      })[0] || {}
    ).hint || '';
  var inletRows = (o.inlets || [])
    .map(function (item, index) {
      var chOpts = OFF_RAIL_CHANNELS.map(function (ch) {
        return '<option value="' + ch + '"' + (item.channel === ch ? ' selected' : '') + '>' + ch + '</option>';
      }).join('');
      return (
        '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><select data-cbsid="BUS004-S10" onchange="netSetInlet(\'' +
        n.key +
        "'," +
        index +
        ',\'channel\',this.value)" style="font-size:var(--fs-1);padding:4px;border:1px solid var(--line);border-radius:6px">' +
        chOpts +
        '</select><input data-cbsid="BUS004-I28" value="' +
        esc(item.handle || '') +
        '" oninput="netSetInlet(\'' +
        n.key +
        "'," +
        index +
        ',\'handle\',this.value)" placeholder="the number / address customers use" style="flex:1;min-width:0;font-size:var(--fs-1);padding:4px 7px;border:1px solid var(--line);border-radius:6px"><span data-cbsid="BUS004-C30" onclick="netDelInlet(\'' +
        n.key +
        "'," +
        index +
        ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'
      );
    })
    .join('');
  var cbRows =
    (o.collectBack || [])
      .map(function (cb, index) {
        var cadOpts = COLLECT_CADENCE.map(function (item) {
          return '<option value="' + item + '"' + (cb.cadence === item ? ' selected' : '') + '>' + item + '</option>';
        }).join('');
        return (
          '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><input data-cbsid="BUS004-I29" value="' +
          esc(cb.name || '') +
          '" oninput="netSetCollectBack(\'' +
          n.key +
          "'," +
          index +
          ',\'name\',this.value)" placeholder="what to collect (e.g. delivery location)" style="flex:1;min-width:0;font-size:var(--fs-1);padding:4px 7px;border:1px solid var(--line);border-radius:6px"><select data-cbsid="BUS004-S11" onchange="netSetCollectBack(\'' +
          n.key +
          "'," +
          index +
          ',\'cadence\',this.value)" style="font-size:var(--fs-1);padding:4px;border:1px solid var(--line);border-radius:6px">' +
          cadOpts +
          '</select><span data-cbsid="BUS004-C31" onclick="netDelCollectBack(\'' +
          n.key +
          "'," +
          index +
          ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'
        );
      })
      .join('') || '<div style="font-size:var(--fs-1);color:var(--grey);padding:2px 0">Nothing asked back.</div>';
  var order =
    '<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:9px"><div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em">' +
    tx('📝 ORDER FORM — what the customer fills in') +
    '</div>' +
    '<label style="font-size:var(--fs-1);color:var(--grey);display:block;margin-top:8px">' +
    tx('How they order (commercial method)') +
    '</label>' +
    '<select data-cbsid="BUS004-S12" onchange="netSetOrderMethod(\'' +
    n.key +
    '\',this.value)" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2)">' +
    methOpts +
    '</select>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);font-style:italic;margin-top:3px">' +
    esc(mh) +
    '</div>' +
    _methodPreview(o.method) +
    '<label style="font-size:var(--fs-1);color:var(--grey);display:block;margin-top:10px">Max items per order <span style="color:var(--faint,var(--grey-3))">(optional)</span></label>' +
    '<input data-cbsid="BUS004-I30" value="' +
    (o.maxItems != null ? esc(String(o.maxItems)) : '') +
    '" oninput="netSetOrderMax(\'' +
    n.key +
    '\',this.value)" type="number" min="1" placeholder="no limit" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2);width:130px">' +
    '<div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">' +
    tx('📥 COLLECT FROM CUSTOMER') +
    '</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">Info you ask the buyer to provide with the order (e.g. delivery address, a monthly forecast).</div>' +
    cbRows +
    '<div data-cbsid="BUS004-C32" onclick="netAddCollectBack(\'' +
    n.key +
    '\')" style="cursor:pointer;color:var(--blue);font-size:var(--fs-2);font-weight:600;padding:5px 0">＋ collect field</div>' +
    '<div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">' +
    tx('🛬 HOW ORDERS ARRIVE') +
    '</div>' +
    '<div style="font-size:var(--fs-1);color:var(--ok-2);margin-top:5px;padding:6px 9px;border:1px solid #cfe0d6;border-radius:6px;background:var(--card)">✓ <b>' +
    tx('On the rail') +
    '</b> — customers order at your storefront (they find you in ChitBridge).</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:8px">Off-rail inlets <span style="color:var(--faint,var(--grey-3))">(optional)</span> — a message to a channel <b>you own &amp; publish</b>, captured into a chit:</div>' +
    inletRows +
    '<div data-cbsid="BUS004-C33" onclick="netAddInlet(\'' +
    n.key +
    '\')" style="cursor:pointer;color:var(--blue);font-size:var(--fs-2);font-weight:600;padding:5px 0">＋ add off-rail inlet</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px;font-style:italic">De-duplicated automatically — the same scan or message won\'t create a second chit (matched by content).</div>' +
    '<div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">' +
    tx('🔄 LIFECYCLE — states the chit moves through') +
    '</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">Order the states (e.g. open <span class=arw>→</span> confirmed <span class=arw>→</span> fulfilled <span class=arw>→</span> closed). Each move is a sealed step; a dispute attaches to a state.</div>' +
    ((o.states || [])
      .map(function (item, index) {
        var last = index === o.states.length - 1;
        return (
          '<div style="display:flex;gap:5px;align-items:center;padding:2px 0"><span style="font-size:var(--fs-1);color:var(--faint,var(--grey-3));width:16px">' +
          (index + 1) +
          '</span><input data-cbsid="BUS004-I31" value="' +
          esc(item.name || '') +
          '" oninput="netSetState(\'' +
          n.key +
          "'," +
          index +
          ',this.value)" placeholder="state name" style="flex:1;min-width:0;font-size:var(--fs-1);padding:4px 7px;border:1px solid var(--line);border-radius:6px">' +
          (index > 0
            ? '<span data-cbsid="BUS004-C34" data-sk="' + esc(n.key) + '" onclick="netMoveState(this.dataset.sk,' + index + ',-1)" style="cursor:pointer;color:var(--grey);padding:0 3px">↑</span>'
            : '<span style="display:inline-block;width:14px"></span>') +
          (!last
            ? '<span data-cbsid="BUS004-C35" data-sk="' + esc(n.key) + '" onclick="netMoveState(this.dataset.sk,' + index + ',1)" style="cursor:pointer;color:var(--grey);padding:0 3px">↓</span>'
            : '<span style="display:inline-block;width:14px"></span>') +
          '<span data-cbsid="BUS004-C36" onclick="netDelState(\'' +
          n.key +
          "'," +
          index +
          ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'
        );
      })
      .join('') || '<div style="font-size:var(--fs-1);color:var(--grey);padding:2px 0">No states — a one-shot chit (created, done).</div>') +
    '<div data-cbsid="BUS004-C37" onclick="netAddState(\'' +
    n.key +
    '\')" style="cursor:pointer;color:var(--blue);font-size:var(--fs-2);font-weight:600;padding:5px 0">＋ state</div>' +
    '<div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">📎 ATTACHMENTS &amp; NOTES</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">Documents the chit carries, and any free-text note.</div>' +
    ((o.attachments || [])
      .map(function (item, index) {
        return (
          '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><input data-cbsid="BUS004-I32" value="' +
          esc(item.name || '') +
          '" oninput="netSetAttach(\'' +
          n.key +
          "'," +
          index +
          ',this.value)" placeholder="document name (e.g. assay_cert.pdf)" style="flex:1;min-width:0;font-size:var(--fs-1);padding:4px 7px;border:1px solid var(--line);border-radius:6px"><span data-cbsid="BUS004-C38" onclick="netDelAttach(\'' +
          n.key +
          "'," +
          index +
          ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'
        );
      })
      .join('') || '<div style="font-size:var(--fs-1);color:var(--grey);padding:2px 0">No attachments.</div>') +
    '<div data-cbsid="BUS004-C39" onclick="netAddAttach(\'' +
    n.key +
    '\')" style="cursor:pointer;color:var(--blue);font-size:var(--fs-2);font-weight:600;padding:5px 0">＋ add attachment</div>' +
    '<textarea data-cbsid="BUS004-T02" oninput="netSetOrderNotes(\'' +
    n.key +
    '\',this.value)" placeholder="notes…" style="width:100%;margin-top:6px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2);box-sizing:border-box;min-height:2.4rem;resize:vertical">' +
    esc(o.notes || '') +
    '</textarea>' +
    '</div>';
  return (
    '<div style="margin-top:10px;padding:12px 13px;border:1px solid var(--line);border-inline-start:3px solid var(--ok-2);border-radius:9px;background:var(--ok-tint);color:var(--on-card)">' +
    view +
    order +
    _chitPreview(n) +
    '</div>'
  );
}
