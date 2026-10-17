/* engine/chart-draw.js — CBDraw: THE ONE SMALL CHART HELPER, inline SVG, no library (RPT2, 2026-10-17).
 * CARD 26-reporting-mis-and-bi/charts
 *
 * OWNS      bars(points, opts) — bars from zero, an optional dashed "same time last year" line with hollow dots, a hatched bar for part of a
 *           period, an empty tick for a period with no record · spark(values, opts) — a sparkline with its last point dotted.
 * CALLED BY app/cap-mis-trend.js (CB Finance › Reports › Trend) · app/shell.js (the Till card's teaser on Home).
 * FLOW      R2R · reports — the server's figures in → an SVG string out. It computes NO figure: heights are geometry, the words are the caller's.
 *
 * Lifted from the two private renderers SPEC-charts found (docs/26-reporting-mis-and-bi/SPEC-charts.md "no shared helper"): fcChart
 * (app/cap-finance-cash.js — bars, the zero line, a <title> per bar, the inline sizes that beat the page's svg icon rule) and _misSpark
 * (app/cap-admin.js — the sparkline and its last dot). Pointing those two here is their owners' follow-up (finance · the workshop MIS).
 * Rules (SPEC-charts): no invented shape (< 2 points → ''), tokens only as var(--x,#fallback), role="img" + aria-label from the caller,
 * bars always start at zero, labels never collide (every k-th), never colour alone (hatch · dash · hollow dot · an empty tick all differ in SHAPE).
 */
(function (root) {
  'use strict';
  var BAR = 'var(--green-d,#1f6b46)', LAST_YEAR = 'var(--muted,#6f6450)', BASELINE = 'var(--line-3,#d8ccb0)', DOT_FILL = 'var(--card,#fffdf8)', LABEL = 'var(--muted,#6f6450)';
  var LABEL_GAP = 44;               /* px between two axis labels, so they never collide */
  var PAD_TOP = 16, PAD_BOTTOM = 20; /* room for the scale words above and the labels below */

  var escape = root.esc;   /* app/helpers.js — the ONE esc; every page that loads this loads helpers.js first */
  function figure(value) { return value === null || value === undefined || !isFinite(Number(value)) ? null : Number(value); }

  /** the vertical scale over every figure drawn (bars and line), always including zero */
  function scaleOf(points) {
    var high = 0, lowest = 0;
    points.forEach(function (point) { [figure(point.value), figure(point.line)].forEach(function (value) { if (value !== null) { high = Math.max(high, value); lowest = Math.min(lowest, value); } }); });
    return { high: high, low: lowest, span: (high - lowest) || 1 };
  }

  /** one bar: a filled rect, a hatched outline (part of a period) or an empty tick (no record) — its <title> is the caller's words */
  function barOf(point, index, layout, testId) {
    var value = figure(point.value), left = index * layout.step + (layout.step - layout.width) / 2, barTestId = escape(testId + '-bar-' + point.key), title = '<title>' + escape(point.title || '') + '</title>';
    if (value === null) return '<g data-testid="' + barTestId + '" data-state="missing">' + title + '<rect x="' + left.toFixed(1) + '" y="' + (layout.zero - 4).toFixed(1) + '" width="' + layout.width + '" height="4" style="fill:none;stroke:' + BASELINE + ';stroke-width:1;stroke-dasharray:2 2"/></g>';
    var height = Math.max(1, Math.abs(layout.yOf(value) - layout.zero)), top = value >= 0 ? layout.zero - height : layout.zero;
    var look = point.hatch ? 'fill:url(#' + layout.id + '-hatch);stroke:' + BAR + ';stroke-width:1.5' : 'fill:' + BAR;
    return '<rect x="' + left.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + layout.width + '" height="' + height.toFixed(1) + '" rx="2" data-testid="' + barTestId + '" data-state="' + (point.hatch ? 'partial' : 'full') + '" style="' + look + '">' + title + '</rect>';
  }

  /** the dashed last-year line through every point that has one, broken where one is missing, with a hollow dot on each */
  function lineOf(points, layout) {
    var path = '', dots = '', penDown = false;
    points.forEach(function (point, index) {
      var value = figure(point.line); if (value === null) { penDown = false; return; }
      var across = (index * layout.step + layout.step / 2).toFixed(1), down = layout.yOf(value).toFixed(1);
      path += (penDown ? ' L' : ' M') + across + ' ' + down; penDown = true;
      dots += '<circle cx="' + across + '" cy="' + down + '" r="2.5" style="fill:' + DOT_FILL + ';stroke:' + LAST_YEAR + ';stroke-width:1.5"><title>' + escape(point.lineTitle || '') + '</title></circle>';
    });
    return path ? '<path d="' + path.trim() + '" data-testid="cd-lastyear" style="fill:none;stroke:' + LAST_YEAR + ';stroke-width:1.5;stroke-dasharray:4 3"/>' + dots : '';
  }

  /** the labels under the bars: every k-th, counted from the newest so the latest always has its label */
  function labelsOf(points, layout, chartHeight) {
    var every = Math.max(1, Math.ceil(LABEL_GAP / layout.step)), count = points.length;
    return points.map(function (point, index) {
      if ((count - 1 - index) % every) return '';
      return '<text x="' + (index * layout.step + layout.step / 2).toFixed(1) + '" y="' + (chartHeight - 5) + '" text-anchor="middle" style="font:10px var(--mono,monospace);fill:' + LABEL + '">' + escape(point.label || '') + '</text>';
    }).join('');
  }

  /** where everything sits: the bar step and width, the y of a figure, the zero line */
  function geometryOf(points, width, height, id) {
    var scale = scaleOf(points), plot = height - PAD_TOP - PAD_BOTTOM, step = width / points.length;
    var layout = { id: id, step: step, width: Math.max(2, Math.floor(step * 0.7)), yOf: function (value) { return PAD_TOP + (scale.high - value) / scale.span * plot; } };
    layout.zero = layout.yOf(0);
    return layout;
  }

  /**
   * bars(points, opts) → '<svg …>' — points [{ key, label, value|null, line|null, hatch, title, lineTitle }] oldest first;
   * opts { width, height, id (unique per page: the hatch pattern's id), aria (the sentence a screen reader hears), tid, top (words at the top-left: the scale) }.
   * No points → ''. Sizes are inline: the page's icon rule (svg{width:18px}) would otherwise shrink the chart to an icon.
   */
  function bars(points, opts) {
    var options = opts || {}, list = points || []; if (!list.length) return '';
    var width = options.width || 640, height = options.height || 170, id = escape(options.id || 'cd'), testId = options.tid || 'cd';
    var layout = geometryOf(list, width, height, id);
    var hatch = '<defs><pattern id="' + id + '-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" style="stroke:' + BAR + ';stroke-width:1.5"/></pattern></defs>';
    var scaleWords = options.top ? '<text x="0" y="10" style="font:10px var(--mono,monospace);fill:' + LABEL + '">' + escape(options.top) + '</text>' : '';
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escape(options.aria || '') + '" data-testid="' + escape(testId + '-chart') + '" style="display:block;width:100%;height:' + height + 'px;overflow:visible;stroke:none;fill:none">'
      + hatch + scaleWords + '<line x1="0" x2="' + width + '" y1="' + layout.zero.toFixed(1) + '" y2="' + layout.zero.toFixed(1) + '" style="stroke:' + BASELINE + ';stroke-width:1"/>'
      + list.map(function (point, index) { return barOf(point, index, layout, testId); }).join('') + lineOf(list, layout) + labelsOf(list, layout, height) + '</svg>';
  }

  /**
   * spark(values, opts) → '<svg …>' — values oldest first, null = no record (the line breaks there); opts { width 64, height 18, stroke (a var()), aria, tid }.
   * Fewer than 2 figures → '' (SPEC-charts rule 1: no invented shape). The scale starts at zero, as the bars do.
   */
  function spark(values, opts) {
    var options = opts || {}, list = (values || []).map(figure), have = list.filter(function (value) { return value !== null; });
    if (have.length < 2) return '';
    var width = options.width || 64, height = options.height || 18, high = Math.max.apply(null, have.concat([0])) || 1, stroke = options.stroke || BAR;
    var pointAt = function (index) { return [(2 + index * (width - 4) / Math.max(1, list.length - 1)).toFixed(1), (height - 2 - Math.max(0, list[index]) / high * (height - 4)).toFixed(1)]; };
    var path = '', penDown = false, last = null;
    list.forEach(function (value, index) { if (value === null) { penDown = false; return; } var at = pointAt(index); path += (penDown ? ' L' : ' M') + at[0] + ' ' + at[1]; penDown = true; last = at; });
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '" role="img" aria-label="' + escape(options.aria || '') + '" data-testid="' + escape(options.tid || 'cd-spark') + '" style="display:inline-block;vertical-align:middle;width:' + width + 'px;height:' + height + 'px;overflow:visible;fill:none;stroke:none">'
      + '<path d="' + path.trim() + '" style="fill:none;stroke:' + stroke + ';stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"/>'
      + '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.2" style="fill:' + stroke + '"/></svg>';
  }

  var CBDraw = { bars: bars, spark: spark };
  if (typeof module !== 'undefined' && module.exports) module.exports = CBDraw;
  if (root) root.CBDraw = CBDraw;
})(typeof window !== 'undefined' ? window : globalThis);
