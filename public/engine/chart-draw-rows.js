/* engine/chart-draw-rows.js — CBDraw part: the row charts compare, hbars and cashLine (REP-66b, MISCH).
 * CARD 26-reporting-mis-and-bi/charts
 *
 * OWNS      CBDraw.compare(rows, opts) — this year over last year, the change at the right · CBDraw.hbars(rows, opts) — ranked or bucketed horizontal bars, the figure at the end ·
 *           CBDraw.cashLine(points, opts) — the days-ahead balance as one line · CBDraw.changeText(pct). Draws only: every figure and word arrives carried.
 * CALLED BY app/cap-mis-pictures.js · app/mis-charts.js · app/cap-books-overview.js · e2e/chart-draw.test.cjs — loaded AFTER engine/chart-draw.js (the core, which owns CBDraw.kit).
 * FLOW      the caller's rows in → an SVG string out; no figure is computed here.
 * Split out of chart-draw.js (shrink W2, 2026-11-17): behaviour unchanged, same names on the same CBDraw object.
 */
(function (root) {
  'use strict';
  var CBDraw = root.CBDraw;
  if (!CBDraw || !CBDraw.kit) return; /* chart-draw.js loads first */
  var kit = CBDraw.kit;
  var escape = kit.escape;
  var figure = kit.figure;
  var codeAttr = kit.codeAttr;
  var accessibleSvg = kit.accessibleSvg;
  var hatchDefs = kit.hatchDefs;

  /* REP-66b: compare(rows, opts) — this year (solid) over last year (outline), one row per client or per figure, the change printed at the right. Every number comes in
   * carried; the bars are geometry only. */
  var CMP = { row: 14, labelW: 88, textW: 58, gap: 4, cap: 100 };
  /** the change as the server carried it, printed: a sign for a rise or fall, no sign and no colour for zero (a fall that rounds to -0 reads 0.0%) */
  function changeText(pct) {
    var value = figure(pct);
    if (value === null) return '';
    if (value === 0) return '0.0%';
    return (value > 0 ? '+' : '−') + Math.abs(value).toFixed(1) + '%';
  }
  /** the end of a bar drawn past the cap: two slanted cuts in the card colour, so a +900% is seen to be longer than the line */
  function brokenEnd(x, y, h) {
    var cut = function (dx) {
      return '<line x1="' + (x + dx - 2).toFixed(1) + '" y1="' + (y + h).toFixed(1) + '" x2="' + (x + dx + 2).toFixed(1) + '" y2="' + y.toFixed(1) + '" style="stroke:var(--card,#fffdf8);stroke-width:1.5"/>';
    };
    return cut(-6) + cut(-2);
  }
  /** the two bars of one row: [outline of last year, solid this year] x/width; mode 'change' draws last year at half the room and this year at its carried change from there (capped at 0 and +100%), mode 'money' draws both on the one scale of the figures */
  function compareBars(row, area, high, mode) {
    var half = area / 2;
    if (mode === 'money') {
      var wOf = function (value) { return high > 0 ? Math.max(0, (figure(value) || 0) / high) * area : 0; };
      return { before: wOf(row.before), now: wOf(row.now), broken: false };
    }
    var pct = figure(row.changePct), ratio = pct === null ? 1 : 1 + pct / 100;
    return { before: half, now: Math.max(0, Math.min(2, ratio)) * half, broken: ratio > 2 };
  }
  /** the 13-character label: when names share a start ("Seed E Client A/B"), keep the end that tells them apart; the full name is in the text's title */
  function shortLabel(full, all) {
    if (full.length <= 13) return full;
    var head = full.slice(0, 12), clash = (all || []).some(function (o) { return o !== full && o.slice(0, 12) === head; });
    return clash ? '…' + full.slice(-12) : head + '…';
  }
  function compareRow(row, index, layout) {
    var y = index * layout.row, h = layout.row - 3, text = changeText(row.changePct), pct = figure(row.changePct);
    var has = layout.mode === 'money' ? figure(row.now) !== null && figure(row.before) !== null : pct !== null; /* a change is the server's word: without it a change bar is not drawn */
    var bars = compareBars(row, layout.area, layout.high, layout.mode), x0 = layout.labelW + CMP.gap;
    var hatched = row.state === 'stale';
    var full = String(row.label || ''), label = shortLabel(full, layout.labels);
    var glyph = pct === null || pct === 0 ? '' : pct > 0 ? '▲' : '▼';
    var inner =
      '<text x="0" y="' + (y + h - 2) + '"' + codeAttr(layout.codes, 'legend') + ' style="font:11px var(--sans,system-ui,sans-serif);fill:var(--ink,#2a2418)">' + escape(label) + (label !== full ? '<title>' + escape(full) + '</title>' : '') + '</text>';
    if (has) {
      inner +=
        '<rect x="' + x0 + '" y="' + (y + 1) + '" width="' + bars.before.toFixed(1) + '" height="' + (h - 2) + '" rx="1" data-testid="' + layout.tid + '-before-' + index + '" style="fill:none;stroke:var(--rp-previous);stroke-width:1.5"/>' +
        '<rect x="' + x0 + '" y="' + (y + 3.5) + '" width="' + bars.now.toFixed(1) + '" height="' + (h - 7) + '" data-testid="' + layout.tid + '-now-' + index + '" style="fill:' + (hatched ? 'url(#' + layout.id + '-hatch)' : 'var(--rp-actual)') + ';stroke:var(--rp-actual);stroke-width:' + (hatched ? 1 : 0) + '"/>' +
        (bars.broken ? brokenEnd(x0 + bars.now, y + 3.5, h - 7) : '');
    } else {
      inner += '<line x1="' + x0 + '" x2="' + (x0 + layout.area) + '" y1="' + (y + h / 2).toFixed(1) + '" y2="' + (y + h / 2).toFixed(1) + '" style="stroke:var(--rp-previous);stroke-width:1;stroke-dasharray:2 3"/>';
    }
    var shown = text || String(row.words || '');
    if (shown) {
      inner += '<text x="' + layout.width + '" y="' + (y + h - 2) + '" text-anchor="end" data-testid="' + layout.tid + '-change-' + index + '"' + codeAttr(layout.codes, 'legend') + ' style="font:11px var(--mono,monospace);fill:var(--ink,#2a2418)">' +
        (glyph ? '<tspan style="fill:' + (pct > 0 ? 'var(--rp-good)' : 'var(--rp-bad)') + '">' + glyph + '</tspan> ' : '') + escape(shown) + '</text>';
    }
    return '<g data-testid="' + layout.tid + '-row-' + index + '"' + codeAttr(layout.codes, 'part') + ' data-state="' + escape(row.state || '') + '"><title>' + escape(row.title || '') + '</title>' + inner + '</g>';
  }
  /**
   * compare(rows, opts) → '<svg …>' — rows [{ label, now, before, changePct, state, title, words }] (now/before the carried money, changePct the carried change or null, state the server's code
   * ok|stale|…, words what is printed in place of a change when there is none); opts { width 320, id, tid, title, desc, palette, mode 'change'|'money', row 14, labelW }.
   * A row with no change and no pair of figures draws a dashed empty line and its words. No rows → ''.
   */
  function compare(rows, opts) {
    var options = opts || {}, list = rows || [];
    if (!list.length) return '';
    var width = options.width || 320, id = escape(options.id || 'cd-cmp'), rowH = options.row || CMP.row, labelW = options.labelW || CMP.labelW;
    var area = Math.max(20, width - labelW - CMP.textW - CMP.gap * 2), high = 0;
    list.forEach(function (row) { high = Math.max(high, figure(row.now) || 0, figure(row.before) || 0); });
    var layout = { row: rowH, width: width, labelW: labelW, area: area, high: high, mode: options.mode || 'change', id: id, tid: escape(options.tid || 'cd-cmp'), labels: list.map(function (r) { return String(r.label || ''); }), codes: options.codes };
    var inner = hatchDefs(id, 'var(--rp-actual)') + list.map(function (row, index) { return compareRow(row, index, layout); }).join('');
    return accessibleSvg(width, list.length * rowH, { id: options.id || 'cd-cmp', tid: options.tid || 'cd-cmp', title: options.title, desc: options.desc, palette: options.palette, codes: options.codes }, inner);
  }

  /* MISCH: hbars(rows, opts) — a ranked or bucketed horizontal bar per row (top lines, dues by age), the figure printed at the end; and cashLine(points, opts) — the next days' balance as one line.
   * Both draw only: every figure and every word arrives carried (money already in the shop's currency, the lowest day the server's). */
  var HB = { row: 20, labelW: 96, textW: 92, gap: 6 };
  /** the longest bar sets the scale; a row with no figure draws a dashed empty line and its words, never a zero bar */
  function hbarRow(row, index, layout) {
    var y = index * layout.row,
      h = layout.row - 5,
      value = figure(row.value),
      x0 = layout.labelW + HB.gap,
      width = value === null || layout.high <= 0 ? 0 : Math.max(value > 0 ? 2 : 0, (Math.max(0, value) / layout.high) * layout.area);
    var full = String(row.label || ''),
      label = full.length > 14 ? full.slice(0, 13) + '…' : full;
    var shape =
      value === null
        ? '<line x1="' + x0 + '" x2="' + (x0 + layout.area) + '" y1="' + (y + h / 2).toFixed(1) + '" y2="' + (y + h / 2).toFixed(1) + '" style="stroke:var(--rp-previous);stroke-width:1;stroke-dasharray:2 3"/>'
        : '<rect x="' + x0 + '" y="' + (y + 1) + '" width="' + width.toFixed(1) + '" height="' + (h - 2) + '" rx="2" data-testid="' + layout.tid + '-bar-' + index + '" data-hatch="' + (row.hatch ? 1 : 0) + '" style="fill:' + (row.hatch ? 'url(#' + layout.id + '-hatch)' : 'var(--rp-actual)') + ';stroke:var(--rp-actual);stroke-width:' + (row.hatch ? 1 : 0) + '"/>';
    return (
      '<g data-testid="' + layout.tid + '-row-' + index + '"' + codeAttr(layout.codes, 'part') + '><title>' + escape(row.title || full) + '</title>' +
      '<text x="0" y="' + (y + h - 3) + '"' + codeAttr(layout.codes, 'legend') + ' style="font:11px var(--sans,system-ui,sans-serif);fill:var(--ink,#2a2418)">' + escape(label) + '</text>' +
      shape +
      '<text x="' + layout.width + '" y="' + (y + h - 3) + '" text-anchor="end" data-testid="' + layout.tid + '-fig-' + index + '" style="font:11px var(--mono,monospace);fill:var(--ink,#2a2418)">' + escape(row.words || '') + '</text></g>'
    );
  }
  /** hbars(rows, opts) → '<svg …>' — rows [{ label, value (a carried figure or null), words (printed), title, hatch (the late part: shape, not colour) }]; opts { width 320, id, tid, title, desc, palette, codes, row, labelW }. No rows → ''. */
  function hbars(rows, opts) {
    var options = opts || {},
      list = rows || [];
    if (!list.length) return '';
    var width = options.width || 320,
      id = escape(options.id || 'cd-hb'),
      rowH = options.row || HB.row,
      labelW = options.labelW || HB.labelW,
      high = 0;
    list.forEach(function (row) {
      high = Math.max(high, figure(row.value) || 0);
    });
    var layout = { row: rowH, width: width, labelW: labelW, area: Math.max(20, width - labelW - HB.textW - HB.gap * 2), high: high, id: id, tid: escape(options.tid || 'cd-hb'), codes: options.codes };
    var inner = hatchDefs(id, 'var(--rp-actual)') + list.map(function (row, index) { return hbarRow(row, index, layout); }).join('');
    return accessibleSvg(width, list.length * rowH, { id: options.id || 'cd-hb', tid: options.tid || 'cd-hb', title: options.title, desc: options.desc, palette: options.palette, codes: options.codes }, inner);
  }

  var CL = { padTop: 18, padBottom: 32, padX: 6 };
  /** the line's x/y per point on one scale: the range of the figures (a line need not start at zero, unlike a bar), widened to include zero when a balance goes below it, so a shortfall shows against the zero line */
  function cashGeometry(points, width, height) {
    var vals = points.map(function (p) { return figure(p.value); }),
      known = vals.filter(function (v) { return v !== null; }),
      high = Math.max.apply(null, known),
      low = Math.min.apply(null, known),
      span = high - low || Math.abs(high) || 1,
      inner = height - CL.padTop - CL.padBottom;
    var yOf = function (v) { return CL.padTop + ((high - v) / span) * inner; };
    var xOf = function (i) { return CL.padX + (points.length < 2 ? 0 : (i * (width - 2 * CL.padX)) / (points.length - 1)); };
    return { vals: vals, xOf: xOf, yOf: yOf, zero: yOf(0), crosses: low < 0, showZero: low <= 0 && high >= 0 };
  }
  /** one dot, a 2px card-coloured ring so it reads over the line */
  function cashDot(x, y, hollow, tid) {
    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" data-testid="' + tid + '" style="fill:' + (hollow ? 'var(--card,#fffdf8)' : 'var(--rp-actual)') + ';stroke:var(--rp-actual);stroke-width:2"/>';
  }
  /** a label that stays inside the viewBox: turned to end/start near the edges */
  function cashLabel(x, y, text, width, tid) {
    var anchor = x > width - 70 ? 'end' : x < 70 ? 'start' : 'middle';
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + anchor + '" data-testid="' + tid + '" style="font:11px var(--mono,monospace);fill:var(--ink,#2a2418)">' + escape(text) + '</text>';
  }
  /** the polyline as an SVG path, broken at a null */
  function cashPath(g) {
    var path = '',
      pen = false;
    g.vals.forEach(function (v, i) {
      if (v === null) {
        pen = false;
        return;
      }
      path += (pen ? 'L' : 'M') + g.xOf(i).toFixed(1) + ' ' + g.yOf(v).toFixed(1);
      pen = true;
    });
    return path;
  }
  /** the two ends and (when the server named one) the lowest day: a dot and its words each */
  function cashMarks(g, options, width, tid) {
    var last = g.vals.length - 1,
      at = options.lowestAt,
      out = '';
    if (g.vals[0] !== null) out += cashDot(g.xOf(0), g.yOf(g.vals[0]), false, tid + '-start') + (options.startWords ? cashLabel(g.xOf(0), g.yOf(g.vals[0]) + 17, options.startWords, width, tid + '-start-words') : '');
    if (g.vals[last] !== null) out += cashDot(g.xOf(last), g.yOf(g.vals[last]), false, tid + '-end') + (options.endWords ? cashLabel(g.xOf(last), g.yOf(g.vals[last]) - 8, options.endWords, width, tid + '-end-words') : '');
    if (at > 0 && at < last && g.vals[at] !== null) out += cashDot(g.xOf(at), g.yOf(g.vals[at]), true, tid + '-lowest') + (options.lowestWords ? cashLabel(g.xOf(at), g.yOf(g.vals[at]) + 17, options.lowestWords, width, tid + '-lowest-words') : '');
    return out;
  }
  /**
   * cashLine(points, opts) → '<svg …>' — points [{ label, value|null }] oldest first (the days ahead); opts { width 640, height 150, id, tid, title, desc, palette, codes,
   * startWords, endWords (printed at the two ends), lowestAt (the index the SERVER named lowest) + lowestWords }. Fewer than 2 points → ''. The line breaks at a null.
   */
  function cashLine(points, opts) {
    var options = opts || {},
      list = points || [];
    if (list.length < 2) return '';
    var width = options.width || 640,
      height = options.height || 150,
      g = cashGeometry(list, width, height),
      tid = escape(options.tid || 'cd-cash'),
      last = list.length - 1;
    var axis = !g.showZero ? '' : '<line x1="0" x2="' + width + '" y1="' + g.zero.toFixed(1) + '" y2="' + g.zero.toFixed(1) + '" style="stroke:var(--line-3,#d8ccb0);stroke-width:1' + (g.crosses ? ';stroke-dasharray:4 3' : '') + '"/>';
    var ends =
      '<text x="0" y="' + (height - 4) + '" style="font:10px var(--mono,monospace);fill:var(--muted,#6f6450)">' + escape(list[0].label || '') + '</text><text x="' + width + '" y="' + (height - 4) + '" text-anchor="end" style="font:10px var(--mono,monospace);fill:var(--muted,#6f6450)">' + escape(list[last].label || '') + '</text>';
    var inner = axis + '<path d="' + cashPath(g) + '" data-testid="' + tid + '-line" style="fill:none;stroke:var(--rp-actual);stroke-width:2;stroke-linejoin:round"/>' + cashMarks(g, options, width, tid) + ends;
    return accessibleSvg(width, height, { id: options.id || 'cd-cash', tid: options.tid || 'cd-cash', title: options.title, desc: options.desc, palette: options.palette, codes: options.codes }, inner);
  }

  CBDraw.compare = compare;
  CBDraw.changeText = changeText;
  CBDraw.hbars = hbars;
  CBDraw.cashLine = cashLine;
})(typeof window !== 'undefined' ? window : globalThis);
