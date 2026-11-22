/* app/cap-network-storefront.js — the STOREFRONT panel of a network node: what the node's online shop shows and how it is set. Split out of cap-network.js (file-size ratchet, batch 1129; capability split), code moved verbatim.
 * OWNS      the storefront config panel: _storefrontConfig
 * CALLED BY cap-network.js (the node config dispatch calls _storefrontConfig for k === 'storefront'); loaded with it by ensureCap('network') through CAP_WITH in app.html
 * FLOW      the node view picks a panel by kind → _storefrontConfig(n) → the panel html (setters live in cap-network.js)
 * CARD      04-network/network-design-builder
 * ID        NET001
 * OWNER     cb-network
 * RISK      plain
 */
'use strict';
/** one visibility choice as a pressable row (kept for the visibility control that moved to the node: this panel only reports it, see _storefrontView) */
function _storefrontExposureOption(node, choice, label, hint) {
  var on = (node.exposure || 'private') === choice;
  return (
    '<div data-cbsid="BUS004-C29" onclick="netSetExposure(\'' +
    escJs(node.key) +
    "','" +
    escJs(choice) +
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
}
/** the "who sees it" note: this panel only REPORTS the visibility; the one control sits at the top of the node (_netVisibilityBlock) */
function _storefrontView(node) {
  // Visibility MOVED to the node itself (_netVisibilityBlock). Two controls for one value is how a person sets it
  // in one place and finds it changed in the other; this panel now only REPORTS it and points at the real control.
  var curLabel =
    (
      NET_EXPOSURE.filter(function (x) {
        return x.k === (node.exposure || 'private');
      })[0] || {}
    ).label || '— Private';
  var view =
    '<div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em">' +
    tx('👁️ WHO SEES IT') +
    '</div>' +
    '<div style="font-size:var(--fs-2);color:var(--grey);margin-top:5px;line-height:1.55">Currently <b>' +
    esc(curLabel) +
    "</b> — set at the top of this node, under <b>Who can see this store's catalogue</b>.</div>";
  return view;
}
/** the commercial-method <option>s of the order form, the chosen one selected */
function _storefrontMethodOptions(orderSpec) {
  var methOpts = CAT_METHODS.map(function (item) {
    return '<option value="' + item.k + '"' + ((orderSpec.method || 'cart') === item.k ? ' selected' : '') + '>' + item.label + '</option>';
  }).join('');
  return methOpts;
}
/** the one-line hint of the chosen commercial method */
function _storefrontMethodHint(orderSpec) {
  var mh =
    (
      CAT_METHODS.filter(function (item) {
        return item.k === (orderSpec.method || 'cart');
      })[0] || {}
    ).hint || '';
  return mh;
}
/** the off-rail inlet rows: channel, handle, remove */
function _storefrontInletRows(node, orderSpec) {
  var inletRows = (orderSpec.inlets || [])
    .map(function (item, index) {
      var chOpts = OFF_RAIL_CHANNELS.map(function (ch) {
        return '<option value="' + ch + '"' + (item.channel === ch ? ' selected' : '') + '>' + ch + '</option>';
      }).join('');
      return (
        '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><select data-cbsid="BUS004-S10" onchange="netSetInlet(\'' +
        escJs(node.key) +
        "'," +
        index +
        ',\'channel\',this.value)" style="font-size:var(--fs-1);padding:4px;border:1px solid var(--line);border-radius:6px">' +
        chOpts +
        '</select><input data-cbsid="BUS004-I28" value="' +
        esc(item.handle || '') +
        '" oninput="netSetInlet(\'' +
        escJs(node.key) +
        "'," +
        index +
        ',\'handle\',this.value)" placeholder="the number / address customers use" style="flex:1;min-width:0;font-size:var(--fs-1);padding:4px 7px;border:1px solid var(--line);border-radius:6px"><span data-cbsid="BUS004-C30" onclick="netDelInlet(\'' +
        escJs(node.key) +
        "'," +
        index +
        ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'
      );
    })
    .join('');
  return inletRows;
}
/** the collect-from-customer rows: what to ask, how often, remove (or "Nothing asked back.") */
function _storefrontCollectRows(node, orderSpec) {
  var cbRows =
    (orderSpec.collectBack || [])
      .map(function (cb, index) {
        var cadOpts = COLLECT_CADENCE.map(function (item) {
          return '<option value="' + item + '"' + (cb.cadence === item ? ' selected' : '') + '>' + item + '</option>';
        }).join('');
        return (
          '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><input data-cbsid="BUS004-I29" value="' +
          esc(cb.name || '') +
          '" oninput="netSetCollectBack(\'' +
          escJs(node.key) +
          "'," +
          index +
          ',\'name\',this.value)" placeholder="what to collect (e.g. delivery location)" style="flex:1;min-width:0;font-size:var(--fs-1);padding:4px 7px;border:1px solid var(--line);border-radius:6px"><select data-cbsid="BUS004-S11" onchange="netSetCollectBack(\'' +
          escJs(node.key) +
          "'," +
          index +
          ',\'cadence\',this.value)" style="font-size:var(--fs-1);padding:4px;border:1px solid var(--line);border-radius:6px">' +
          cadOpts +
          '</select><span data-cbsid="BUS004-C31" onclick="netDelCollectBack(\'' +
          escJs(node.key) +
          "'," +
          index +
          ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'
        );
      })
      .join('') || '<div style="font-size:var(--fs-1);color:var(--grey);padding:2px 0">Nothing asked back.</div>';
  return cbRows;
}
/** the lifecycle state rows: name, move up, move down, remove (or "No states") */
function _storefrontStateRows(node, orderSpec) {
  return (orderSpec.states || [])
      .map(function (item, index) {
        var last = index === orderSpec.states.length - 1;
        return (
          '<div style="display:flex;gap:5px;align-items:center;padding:2px 0"><span style="font-size:var(--fs-1);color:var(--faint,var(--grey-3));width:16px">' +
          (index + 1) +
          '</span><input data-cbsid="BUS004-I31" value="' +
          esc(item.name || '') +
          '" oninput="netSetState(\'' +
          escJs(node.key) +
          "'," +
          index +
          ',this.value)" placeholder="state name" style="flex:1;min-width:0;font-size:var(--fs-1);padding:4px 7px;border:1px solid var(--line);border-radius:6px">' +
          (index > 0
            ? '<span data-cbsid="BUS004-C34" data-sk="' + esc(node.key) + '" onclick="netMoveState(this.dataset.sk,' + index + ',-1)" style="cursor:pointer;color:var(--grey);padding:0 3px">↑</span>'
            : '<span style="display:inline-block;width:14px"></span>') +
          (!last
            ? '<span data-cbsid="BUS004-C35" data-sk="' + esc(node.key) + '" onclick="netMoveState(this.dataset.sk,' + index + ',1)" style="cursor:pointer;color:var(--grey);padding:0 3px">↓</span>'
            : '<span style="display:inline-block;width:14px"></span>') +
          '<span data-cbsid="BUS004-C36" onclick="netDelState(\'' +
          escJs(node.key) +
          "'," +
          index +
          ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'
        );
      })
      .join('') || '<div style="font-size:var(--fs-1);color:var(--grey);padding:2px 0">No states — a one-shot chit (created, done).</div>';
}
/** the attachment rows: document name, remove (or "No attachments.") */
function _storefrontAttachRows(node, orderSpec) {
  return (orderSpec.attachments || [])
      .map(function (item, index) {
        return (
          '<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><input data-cbsid="BUS004-I32" value="' +
          esc(item.name || '') +
          '" oninput="netSetAttach(\'' +
          escJs(node.key) +
          "'," +
          index +
          ',this.value)" placeholder="document name (e.g. assay_cert.pdf)" style="flex:1;min-width:0;font-size:var(--fs-1);padding:4px 7px;border:1px solid var(--line);border-radius:6px"><span data-cbsid="BUS004-C38" onclick="netDelAttach(\'' +
          escJs(node.key) +
          "'," +
          index +
          ')" style="cursor:pointer;color:var(--grey);font-weight:700;padding:0 3px">×</span></div>'
        );
      })
      .join('') || '<div style="font-size:var(--fs-1);color:var(--grey);padding:2px 0">No attachments.</div>';
}
/** the order form head: how they order (method) and the maximum items per order; opens the section div the later parts fill */
function _storefrontOrderHead(node, orderSpec) {
  return (
    '<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:9px"><div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em">' +
    tx('📝 ORDER FORM — what the customer fills in') +
    '</div>' +
    '<label style="font-size:var(--fs-1);color:var(--grey);display:block;margin-top:8px">' +
    tx('How they order (commercial method)') +
    '</label>' +
    '<select data-cbsid="BUS004-S12" onchange="netSetOrderMethod(\'' +
    escJs(node.key) +
    '\',this.value)" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2)">' +
    _storefrontMethodOptions(orderSpec) +
    '</select>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);font-style:italic;margin-top:3px">' +
    esc(_storefrontMethodHint(orderSpec)) +
    '</div>' +
    _methodPreview(orderSpec.method) +
    '<label style="font-size:var(--fs-1);color:var(--grey);display:block;margin-top:10px">Max items per order <span style="color:var(--faint,var(--grey-3))">(optional)</span></label>' +
    '<input data-cbsid="BUS004-I30" value="' +
    (orderSpec.maxItems != null ? esc(String(orderSpec.maxItems)) : '') +
    '" oninput="netSetOrderMax(\'' +
    escJs(node.key) +
    '\',this.value)" type="number" min="1" placeholder="no limit" style="margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2);width:130px">'
  );
}
/** COLLECT FROM CUSTOMER: the info the buyer provides with the order */
function _storefrontCollect(node, orderSpec) {
  return (
    '<div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">' +
    tx('📥 COLLECT FROM CUSTOMER') +
    '</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">Info you ask the buyer to provide with the order (e.g. delivery address, a monthly forecast).</div>' +
    _storefrontCollectRows(node, orderSpec) +
    '<div data-cbsid="BUS004-C32" onclick="netAddCollectBack(\'' +
    escJs(node.key) +
    '\')" style="cursor:pointer;color:var(--blue);font-size:var(--fs-2);font-weight:600;padding:5px 0">＋ collect field</div>'
  );
}
/** HOW ORDERS ARRIVE: on the rail, and the optional off-rail inlets */
function _storefrontArrival(node, orderSpec) {
  return (
    '<div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">' +
    tx('🛬 HOW ORDERS ARRIVE') +
    '</div>' +
    '<div style="font-size:var(--fs-1);color:var(--ok-2);margin-top:5px;padding:6px 9px;border:1px solid #cfe0d6;border-radius:6px;background:var(--card)">✓ <b>' +
    tx('On the rail') +
    '</b> — customers order at your storefront (they find you in ChitBridge).</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:8px">Off-rail inlets <span style="color:var(--faint,var(--grey-3))">(optional)</span> — a message to a channel <b>you own &amp; publish</b>, captured into a chit:</div>' +
    _storefrontInletRows(node, orderSpec) +
    '<div data-cbsid="BUS004-C33" onclick="netAddInlet(\'' +
    escJs(node.key) +
    '\')" style="cursor:pointer;color:var(--blue);font-size:var(--fs-2);font-weight:600;padding:5px 0">＋ add off-rail inlet</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px;font-style:italic">De-duplicated automatically — the same scan or message won\'t create a second chit (matched by content).</div>'
  );
}
/** LIFECYCLE: the states the chit moves through */
function _storefrontLifecycle(node, orderSpec) {
  return (
    '<div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">' +
    tx('🔄 LIFECYCLE — states the chit moves through') +
    '</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">Order the states (e.g. open <span class=arw>→</span> confirmed <span class=arw>→</span> fulfilled <span class=arw>→</span> closed). Each move is a sealed step; a dispute attaches to a state.</div>' +
    _storefrontStateRows(node, orderSpec) +
    '<div data-cbsid="BUS004-C37" onclick="netAddState(\'' +
    escJs(node.key) +
    '\')" style="cursor:pointer;color:var(--blue);font-size:var(--fs-2);font-weight:600;padding:5px 0">＋ state</div>'
  );
}
/** ATTACHMENTS and NOTES: documents the chit carries and a free-text note */
function _storefrontAttachments(node, orderSpec) {
  return (
    '<div style="font-size:var(--fs-1);font-weight:800;color:var(--ok-2);letter-spacing:.05em;margin-top:12px;border-top:1px solid var(--line);padding-top:9px">📎 ATTACHMENTS &amp; NOTES</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">Documents the chit carries, and any free-text note.</div>' +
    _storefrontAttachRows(node, orderSpec) +
    '<div data-cbsid="BUS004-C39" onclick="netAddAttach(\'' +
    escJs(node.key) +
    '\')" style="cursor:pointer;color:var(--blue);font-size:var(--fs-2);font-weight:600;padding:5px 0">＋ add attachment</div>' +
    '<textarea data-cbsid="BUS004-T02" oninput="netSetOrderNotes(\'' +
    escJs(node.key) +
    '\',this.value)" placeholder="notes…" style="width:100%;margin-top:6px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2);box-sizing:border-box;min-height:2.4rem;resize:vertical">' +
    esc(orderSpec.notes || '') +
    '</textarea>'
  );
}
/** the order form: its head, collect, arrival, lifecycle and attachment sections in one box */
function _storefrontOrder(node, orderSpec) {
  return (
    _storefrontOrderHead(node, orderSpec) +
    _storefrontCollect(node, orderSpec) +
    _storefrontArrival(node, orderSpec) +
    _storefrontLifecycle(node, orderSpec) +
    _storefrontAttachments(node, orderSpec) +
    '</div>'
  );
}
/** the STOREFRONT panel of a network node: who sees it, the order form, and the chit preview */
function _storefrontConfig(node) {
  var orderSpec = _ensureOrder(node);
  return (
    '<div style="margin-top:10px;padding:12px 13px;border:1px solid var(--line);border-inline-start:3px solid var(--ok-2);border-radius:9px;background:var(--ok-tint);color:var(--on-card)">' +
    _storefrontView(node) +
    _storefrontOrder(node, orderSpec) +
    _chitPreview(node) +
    '</div>'
  );
}
