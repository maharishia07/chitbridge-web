/* app/cap-register-impact.js — THE REGISTER, Impact view: the graph walked from one entry, split out of cap-register.js (web split 1129), code moved verbatim.
 * OWNS      IMPACT, what this breaks or what broke it: rgWalkPick · rgWalkLoad · rgWalkDir · rgWalkFrom · rgWalkLabel · rgGraph · rgDangling · rgImpact (the view and its origin box)
 * CALLED BY cap-register.js (rgPaint draws rgImpact for the Impact tab; the Impact button calls rgWalk*), loaded first through CAP_WITH.register (app.html); reads RG and the rg* helpers of cap-register.js when called
 * FLOW      Impact tab ──▶ rgImpact ──▶ rgWalkPick (the origin) ──▶ rgWalkLoad (the walk) ──▶ rgGraph (forwards or backwards) · rgDangling (a dependency with no target is listed, never dropped)
 * ID        SCR007
 * OWNER     cb-rail
 * CARD      03-disputes-service-and-register/raida-register-and-report
 * RISK      plain
 */
/* ── IMPACT — the graph ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * ⭐⭐ WHAT THIS BREAKS, OR WHAT BROKE IT. Every dependency that POINTS is an edge; the walk is the impact.
 *
 * ⚠️ BACKWARDS IS THE DEFAULT, deliberately. Forwards ("what waits on this") is the planning question and gets
 * asked occasionally. Backwards ("what is this waiting on") is the question asked after something has already
 * gone wrong, which is when anyone actually opens this.
 *
 * ⚠️ A DEPENDENCY THAT DOES NOT POINT IS A SENTENCE, NOT AN EDGE. "We need the crane" with no target cannot be
 * walked and must not be drawn as though it could — it is listed separately rather than silently dropped.
 */
function rgWalkPick() {
  var es = rgScoped().filter(function (e) {
    return e.edge;
  });
  if (es.length && !RG.walkFrom) {
    RG.walkFrom = es[0].line_id || es[0].subject_id;
    rgWalkLoad();
  }
}

async function rgWalkLoad() {
  if (!RG.walkFrom) return;
  try {
    RG.walk = await api('regWalk', { params: { from: RG.walkFrom }, query: { backwards: RG.walkBack ? '1' : '0' } });
  } catch (e) {
    RG.walk = { hops: [], err: rgWhy(e, 'failed') };
  }
  rgPaint();
}

function rgWalkDir() {
  RG.walkBack = !RG.walkBack;
  rgWalkLoad();
}
function rgWalkFrom(id) {
  RG.walkFrom = id;
  rgWalkLoad();
}

/**
 * ⭐⭐ TOP-TO-BOTTOM, NOT LEFT-TO-RIGHT — because of the pane it lives in. A wide flow reads left-to-right, and
 * that is what this drew first: at 240px per column inside a ~300px panel it put the ONE box that carries the
 * answer off the right edge, every time. A layered stack in a narrow column reads downward.
 *
 * ⚠️ DEPTH IS THE INDENT, so a chain still reads as a chain rather than a flat list.
 */
/* The origin box. Names the register when one is selected — with the room the wide frame gives, "this" is a
   wasted label on the only box the reader already understands. */
function rgWalkLabel() {
  var n = RG.sel ? rgSubjectName(RG.sel) : null;
  if (!n) return tx('this');
  return n.length > 26 ? n.slice(0, 26) + '…' : n;
}
function rgGraph(hops) {
  var W = 300,
    PAD = 10,
    BOXH = 44,
    GAP = 30,
    INDENT = 14;
  var H = PAD * 2 + BOXH + hops.length * (BOXH + GAP);
  var parts = [];

  parts.push(
    '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - PAD * 2) + '" height="' + BOXH + '" rx="8" fill="none" stroke="currentColor" stroke-width="2"/>'
  );
  parts.push('<text x="' + (PAD + 10) + '" y="' + (PAD + 27) + '" font-size="12" font-weight="700"' + ' fill="currentColor">' + esc(rgWalkLabel()) + '</text>');

  var y = PAD + BOXH;
  hops.forEach(function (item) {
    var x = PAD + Math.min(item.depth, 3) * INDENT;
    var sev = item.severity >= 4 ? 'var(--disp)' : 'currentColor';
    parts.push(
      '<line x1="' +
        (x + 14) +
        '" y1="' +
        y +
        '" x2="' +
        (x + 14) +
        '" y2="' +
        (y + GAP) +
        '" stroke="currentColor" stroke-width="1.5" opacity=".55" marker-end="url(#rgarrow)"/>'
    );
    parts.push(
      '<text x="' +
        (x + 24) +
        '" y="' +
        (y + GAP - 10) +
        '" font-size="10" fill="currentColor"' +
        ' opacity=".7">' +
        esc(String(item.rel_type || '').replace(/_/g, ' ')) +
        '</text>'
    );
    y += GAP;
    parts.push(
      '<rect x="' + x + '" y="' + y + '" width="' + (W - x - PAD) + '" height="' + BOXH + '" rx="8" fill="none" stroke="' + sev + '" stroke-width="1.5"/>'
    );
    var text = String(item.to_label || item.body || '');
    parts.push(
      '<text x="' + (x + 10) + '" y="' + (y + 19) + '" font-size="11" fill="currentColor">' + esc(text.length > 30 ? text.slice(0, 30) + '…' : text) + '</text>'
    );
    var sub = (item.owner || '') + (item.needed_by ? ' · ' + String(item.needed_by).slice(0, 10) : '');
    if (sub) {
      parts.push('<text x="' + (x + 10) + '" y="' + (y + 34) + '" font-size="10" fill="currentColor"' + ' opacity=".65">' + esc(sub) + '</text>');
    }
    y += BOXH;
  });

  return (
    '<svg viewBox="0 0 ' +
    W +
    ' ' +
    H +
    '" role="img" style="width:' +
    W +
    'px;max-width:100%;height:auto;' +
    'color:var(--on-card)" aria-label="' +
    esc(tx('Impact walk')) +
    '">' +
    '<defs><marker id="rgarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6"' +
    ' orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>' +
    parts.join('') +
    '</svg>'
  );
}

function rgDangling(list) {
  if (!list.length) return '';
  return (
    rgBand(tx('Dependencies that name no target'), list.length) +
    '<div style="font-size:var(--fs-1);color:var(--grey);padding:2px 0">' +
    tx('These cannot be walked — they are sentences, not edges.') +
    '</div>' +
    list
      .map(function (e) {
        return '<div class="raidrow"><div style="font-size:var(--fs-2)">🔗 ' + esc(e.body) + '</div></div>';
      })
      .join('')
  );
}

function rgImpact() {
  if (!RG.report.full) {
    return '<div class="rg-body"><div class="msgempty">' + tx('The impact walk needs the full register (b185).') + '</div></div>';
  }
  var list = rgScoped();
  var edges = list.filter(function (e) {
    return e.edge;
  });
  var dangling = list.filter(function (e) {
    return e.kind === 'dependency' && !e.edge;
  });

  if (!edges.length) {
    return (
      '<div class="rg-body">' +
      rgRegisterRail() +
      '<div class="msgempty">' +
      tx('Nothing points anywhere yet, so there is no graph to walk.') +
      '<br>' +
      '<span style="font-size:var(--fs-1)">' +
      tx('A dependency becomes an edge when it names what it waits on.') +
      '</span></div>' +
      rgDangling(dangling) +
      '</div>'
    );
  }

  var starts = [];
  edges.forEach(function (e) {
    var id = e.line_id || e.subject_id;
    if (
      id &&
      !starts.some(function (item) {
        return item.id === id;
      })
    ) {
      starts.push({ id: id, label: e.particulars || e.subject || tx('this register') });
    }
  });
  var hops = (RG.walk && RG.walk.hops) || [];

  return (
    '<div class="rg-body">' +
    rgRegisterRail() +
    '<div class="raidtoggle" style="padding:6px 0">' +
    '<button data-cbsid="SCR007-B12" class="' +
    (RG.walkBack ? 'on' : '') +
    '" data-testid="walk-back" onclick="rgWalkDir()">' +
    tx('What this waits on') +
    '</button>' +
    '<button data-cbsid="SCR007-B13" class="' +
    (RG.walkBack ? '' : 'on') +
    '" onclick="rgWalkDir()">' +
    tx('What waits on this') +
    '</button></div>' +
    (starts.length > 1
      ? '<div class="raidtoggle" style="padding:6px 0">' +
        starts
          .map(function (item) {
            return (
              '<button data-cbsid="SCR007-B14" class="' +
              (RG.walkFrom === item.id ? 'on' : '') +
              '"' +
              ' onclick="rgWalkFrom(&quot;' +
              item.id +
              '&quot;)">' +
              esc(item.label) +
              '</button>'
            );
          })
          .join('') +
        '</div>'
      : '') +
    (hops.length
      ? '<div style="overflow-x:auto" data-testid="walk-graph">' +
        rgGraph(hops) +
        '</div>' +
        '<div style="font-size:var(--fs-1);color:var(--grey);padding:6px 0">' +
        txn('{count} hop', '{count} hops', hops.length) +
        ' · ' +
        txf('{d} deep', { d: (RG.walk && RG.walk.depth_reached) || 0 }) +
        (RG.walk && RG.walk.truncated ? ' ' + tx('Stopped at the depth limit — there is more.') : '') +
        '</div>'
      : '<div class="msgempty">' + tx('Nothing on this path.') + '</div>') +
    rgDangling(dangling) +
    '</div>'
  );
}
