/* engine/chart-draw.js — CBDraw: THE ONE SMALL CHART HELPER, inline SVG, no library (RPT2, 2026-10-17).
 * CARD 26-reporting-mis-and-bi/charts
 *
 * OWNS      bars(points, opts) — bars from zero, an optional dashed "same time last year" line with hollow dots, a hatched bar for part of a
 *           period, an empty tick for a period with no record; per bar its own tone, and one marked point (the lowest day) · spark(values, opts) — a
 *           sparkline with its last point dotted · stackBar(parts, opts) — one 100% bar in HTML with its key · stackRows(rows, opts) — a stacked
 *           bar per row with its count · stackColumns(columns, opts) — stacked columns, oldest left · KINDS and TYPES — the ONE vocabulary of chart
 *           kinds and drawings (the person's favourites are chart_fav_<kind> in ui_prefs; the api's lib/chart-prefs.js pins the same two lists).
 * CALLED BY app/cap-mis-trend.js (CB Finance › Reports › Trend) · app/cap-finance-cash.js (the running balance) · app/cap-admin.js (the MIS flow
 *           bar and sparkline) · app/shell.js (the Till card's teaser on Home) · public/testing.html (its four charts; internal, loads this by tag).
 * LOADED BY CBChartCap.ready() (app/avatar.js) — a page that draws no chart never fetches this file.
 * FLOW      R2R · reports — the server's figures in → an SVG string out. It computes NO figure: heights are geometry, the words are the caller's.
 *           Growth: a series draws at most MAX_POINTS (120) points, the newest; the server pages the rest (5 years of weeks is 260).
 *
 * Lifted from the private renderers SPEC-charts found (docs/26-reporting-mis-and-bi/SPEC-charts.md "no shared helper"): fcChart, _misSpark,
 * _misStack and testing.html's chartStack · chartTrend now call this file (chart engine step 1, 16 Nov 2026); look and test ids unchanged.
 * Rules (SPEC-charts): no invented shape (< 2 points → ''), tokens only as var(--x,#fallback), role="img" + aria-label from the caller,
 * bars always start at zero, labels never collide (every k-th), never colour alone (hatch · dash · hollow dot · an empty tick all differ in SHAPE).
 */
(function (root) {
  'use strict';
  var BAR = 'var(--green-d,#1f6b46)',
    LAST_YEAR = 'var(--muted,#6f6450)',
    BASELINE = 'var(--line-3,#d8ccb0)',
    DOT_FILL = 'var(--card,#fffdf8)',
    LABEL = 'var(--muted,#6f6450)';
  var LABEL_GAP = 44; /* px between two axis labels, so they never collide */
  var PAD_TOP = 16,
    PAD_BOTTOM = 20; /* room for the scale words above and the labels below */

  var MAX_POINTS = 120; /* 5-year growth: no series draws more than this, whatever the server sends */
  var KINDS = ['series', 'rank', 'split', 'bridge']; /* the shapes of figures a chart can have */
  var TYPES = ['column', 'line', 'bar', 'stack', 'pie', 'donut', 'area', 'waterfall']; /* the drawings; a favourite is "<combination>-<type>" */
  /** the page's one esc (app/helpers.js) when it has one, else the same five characters — looked up at call time, so load order never matters */
  function escape(value) {
    if (typeof root.esc === 'function') return root.esc(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return '&#' + char.charCodeAt(0) + ';';
    });
  }
  /** the newest MAX_POINTS of a list (a list already short enough is returned as it is) */
  function newest(list) {
    return list.length > MAX_POINTS ? list.slice(list.length - MAX_POINTS) : list;
  }
  function figure(value) {
    return value === null || value === undefined || !isFinite(Number(value)) ? null : Number(value);
  }

  /** the vertical scale over every figure drawn (bars and line), always including zero */
  function scaleOf(points) {
    var high = 0,
      lowest = 0;
    points.forEach(function (point) {
      [figure(point.value), figure(point.line)].forEach(function (value) {
        if (value !== null) {
          high = Math.max(high, value);
          lowest = Math.min(lowest, value);
        }
      });
    });
    return { high: high, low: lowest, span: high - lowest || 1 };
  }

  /** the empty tick drawn where a period has no record: a dashed stub on the baseline */
  function missingBarOf(left, barTestId, title, layout) {
    return (
      '<g data-testid="' +
      barTestId +
      '" data-state="missing">' +
      title +
      '<rect x="' +
      left.toFixed(1) +
      '" y="' +
      (layout.zero - 4).toFixed(1) +
      '" width="' +
      layout.width +
      '" height="4" style="fill:none;stroke:' +
      BASELINE +
      ';stroke-width:1;stroke-dasharray:2 2"/></g>'
    );
  }

  /** one bar: a filled rect, a hatched outline (part of a period) or an empty tick (no record) — its <title> is the caller's words */
  function barOf(point, index, layout, testId) {
    var value = figure(point.value),
      left = index * layout.step + (layout.step - layout.width) / 2,
      barTestId = escape(testId + '-bar-' + point.key),
      title = '<title>' + escape(point.title || '') + '</title>';
    if (value === null) return missingBarOf(left, barTestId, title, layout);
    var height = Math.max(1, Math.abs(layout.yOf(value) - layout.zero)),
      top = value >= 0 ? layout.zero - height : layout.zero;
    var look = point.hatch ? 'fill:url(#' + layout.id + '-hatch);stroke:' + BAR + ';stroke-width:1.5' : 'fill:' + (point.fill || BAR) + (point.opacity ? ';opacity:' + point.opacity : '');
    return (
      '<rect x="' +
      left.toFixed(1) +
      '" y="' +
      top.toFixed(1) +
      '" width="' +
      layout.width +
      '" height="' +
      height.toFixed(1) +
      '" rx="2" data-testid="' +
      barTestId +
      '" data-state="' +
      (point.hatch ? 'partial' : 'full') +
      '"' +
      (point.neg === undefined ? '' : ' data-neg="' + !!point.neg + '"') +
      ' style="' +
      look +
      '">' +
      title +
      '</rect>'
    );
  }

  /** the dashed last-year line through every point that has one, broken where one is missing, with a hollow dot on each */
  function lineOf(points, layout) {
    var path = '',
      dots = '',
      penDown = false;
    points.forEach(function (point, index) {
      var value = figure(point.line);
      if (value === null) {
        penDown = false;
        return;
      }
      var across = (index * layout.step + layout.step / 2).toFixed(1),
        down = layout.yOf(value).toFixed(1);
      path += (penDown ? ' L' : ' M') + across + ' ' + down;
      penDown = true;
      dots +=
        '<circle cx="' +
        across +
        '" cy="' +
        down +
        '" r="2.5" style="fill:' +
        DOT_FILL +
        ';stroke:' +
        LAST_YEAR +
        ';stroke-width:1.5"><title>' +
        escape(point.lineTitle || '') +
        '</title></circle>';
    });
    return path
      ? '<path d="' + path.trim() + '" data-testid="cd-lastyear" style="fill:none;stroke:' + LAST_YEAR + ';stroke-width:1.5;stroke-dasharray:4 3"/>' + dots
      : '';
  }

  /** the labels under the bars: every k-th, counted from the newest so the latest always has its label */
  function labelsOf(points, layout, chartHeight, labelOn) {
    var every = Math.max(1, Math.ceil(LABEL_GAP / layout.step)),
      count = points.length;
    return points
      .map(function (point, index) {
        if (labelOn ? !labelOn(index, count) : (count - 1 - index) % every) return '';
        return (
          '<text x="' +
          (index * layout.step + layout.step / 2).toFixed(1) +
          '" y="' +
          (chartHeight - 5) +
          '" text-anchor="middle" style="font:10px var(--mono,monospace);fill:' +
          LABEL +
          '">' +
          escape(point.label || '') +
          '</text>'
        );
      })
      .join('');
  }

  /** where everything sits: the bar step and width, the y of a figure, the zero line */
  function geometryOf(points, width, height, id, options) {
    var scale = scaleOf(points),
      top = options.padTop === undefined ? PAD_TOP : options.padTop,
      bottom = options.padBottom === undefined ? PAD_BOTTOM : options.padBottom,
      plot = height - top - bottom,
      step = width / points.length;
    var layout = {
      id: id,
      step: step,
      bottom: bottom,
      width: options.gap === undefined ? Math.max(2, Math.floor(step * 0.7)) : Math.max(2, Math.floor(step) - options.gap),
      yOf: function (value) {
        return top + ((scale.high - value) / scale.span) * plot;
      }
    };
    layout.zero = layout.yOf(0);
    return layout;
  }

  /** the diagonal-hatch pattern that fills a part-period bar (its id is unique per chart) */
  function hatchDefs(id) {
    return (
      '<defs><pattern id="' +
      id +
      '-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" style="stroke:' +
      BAR +
      ';stroke-width:1.5"/></pattern></defs>'
    );
  }

  /** the one marked point's words (the lowest day): above a bar, below a negative one, anchored away from the edge it is near */
  function markOf(mark, points, layout, width, height) {
    var point = mark && points[mark.index];
    var value = point ? figure(point.value) : null;
    if (value === null) return '';
    var across = mark.index * layout.step + layout.step / 2,
      down = value < 0 ? Math.min(height - layout.bottom - 2, layout.yOf(value) + 11) : Math.max(10, layout.yOf(value) - 4);
    return (
      '<text x="' +
      across.toFixed(1) +
      '" y="' +
      down.toFixed(1) +
      '" text-anchor="' +
      (across > width * 0.8 ? 'end' : across < width * 0.2 ? 'start' : 'middle') +
      '" data-testid="' +
      escape(mark.tid || 'cd-mark') +
      '" style="font:600 11px var(--mono,monospace);fill:var(--ink,#2a2418)">' +
      escape(mark.text || '') +
      '</text>'
    );
  }

  /** the horizontal rule at zero that every bar stands on */
  function zeroLineOf(width, layout) {
    return (
      '<line x1="0" x2="' +
      width +
      '" y1="' +
      layout.zero.toFixed(1) +
      '" y2="' +
      layout.zero.toFixed(1) +
      '" style="stroke:' +
      BASELINE +
      ';stroke-width:1"/>'
    );
  }

  /**
   * bars(points, opts) → '<svg …>' — points [{ key, label, value|null, line|null, hatch, title, lineTitle }] oldest first;
   * a point may also carry fill (a var() tone), opacity and neg (a data-neg flag for the page's tests).
   * opts { width, height, id (unique per page: the hatch pattern's id), aria (the sentence a screen reader hears), tid, svgTid (the svg's own test id,
   * default tid-chart), top (words at the top-left: the scale), padTop · padBottom · gap (px between bars), labelOn(index, count) (which points are
   * labelled), mark { index, text, tid } (one point's words) }. No points → ''. At most MAX_POINTS points are drawn, the newest. Sizes are inline: the page's icon rule (svg{width:18px}) would otherwise shrink the chart to an icon.
   */
  function bars(points, opts) {
    var options = opts || {},
      list = newest(points || []);
    if (!list.length) return '';
    var width = options.width || 640,
      height = options.height || 170,
      id = escape(options.id || 'cd'),
      testId = options.tid || 'cd';
    var layout = geometryOf(list, width, height, id, options);
    var hatch = list.some(function (point) {
      return point.hatch;
    })
      ? hatchDefs(id)
      : '';
    return (
      barsOpen(width, height, options) +
      hatch +
      scaleWordsOf(options.top) +
      zeroLineOf(width, layout) +
      list
        .map(function (point, index) {
          return barOf(point, index, layout, testId);
        })
        .join('') +
      lineOf(list, layout) +
      labelsOf(list, layout, height, options.labelOn) +
      markOf(options.mark, list, layout, width, height) +
      '</svg>'
    );
  }
  /** the bars' svg tag: inline sizes, because the page's icon rule (svg{width:18px}) would otherwise shrink the chart to an icon */
  function barsOpen(width, height, options) {
    return (
      '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escape(options.aria || '') +
      '" data-testid="' + escape(options.svgTid || (options.tid || 'cd') + '-chart') +
      '" style="display:block;width:100%;height:' + height + 'px;overflow:visible;stroke:none;fill:none">'
    );
  }
  /** the words at the top-left (the scale), or nothing */
  function scaleWordsOf(words) {
    return words ? '<text x="0" y="10" style="font:10px var(--mono,monospace);fill:' + LABEL + '">' + escape(words) + '</text>' : '';
  }

  /**
   * spark(values, opts) → '<svg …>' — values oldest first, null = no record (the line breaks there); opts { width 64, height 18, stroke (a var()), aria, tid,
   * inset { left, right, top, bottom } (default 2 each), lineWidth (1.5), dot (2.2), ring (a var(): a ring round the last dot), cls, fluid (true: the svg fills its
   * box's width at the height given and stretches, as the MIS card's does) }. At most MAX_POINTS figures are drawn, the newest.
   * Fewer than 2 figures → '' (SPEC-charts rule 1: no invented shape). The scale starts at zero, as the bars do.
   */
  function spark(values, opts) {
    var options = opts || {},
      list = newest(values || []).map(figure),
      have = list.filter(function (value) {
        return value !== null;
      });
    if (have.length < 2) return '';
    var width = options.width || 64,
      height = options.height || 18,
      high = Math.max.apply(null, have.concat([0])) || 1,
      stroke = options.stroke || BAR,
      inset = Object.assign({ left: 2, right: 2, top: 2, bottom: 2 }, options.inset);
    var pointAt = function (index) {
      return [
        (inset.left + (index * (width - inset.left - inset.right)) / Math.max(1, list.length - 1)).toFixed(1),
        (height - inset.bottom - (Math.max(0, list[index]) / high) * (height - inset.top - inset.bottom)).toFixed(1)
      ];
    };
    var path = '',
      penDown = false,
      last = null;
    list.forEach(function (value, index) {
      if (value === null) {
        penDown = false;
        return;
      }
      var at = pointAt(index);
      path += (penDown ? ' L' : ' M') + at[0] + ' ' + at[1];
      penDown = true;
      last = at;
    });
    return sparkSvg(width, height, options, path, last, stroke);
  }

  /** the sparkline's svg tag: a fixed box, or (fluid) the width of its container, stretched, as the MIS card's is */
  function sparkOpen(width, height, options) {
    var box = options.fluid
      ? 'display:block;width:100%;height:' + height + 'px;margin-top:6px'
      : 'display:inline-block;vertical-align:middle;width:' + width + 'px;height:' + height + 'px';
    return (
      '<svg viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '" role="img" aria-label="' + escape(options.aria || '') +
      '" data-testid="' + escape(options.tid || 'cd-spark') + '"' +
      (options.cls ? ' class="' + escape(options.cls) + '"' : '') +
      (options.fluid ? ' preserveAspectRatio="none"' : '') +
      ' style="' + box + ';overflow:visible;fill:none;stroke:none">'
    );
  }

  /** the sparkline's svg wrapper: its path and the dot on the last point (a ring round the dot when the caller names one) */
  function sparkSvg(width, height, options, path, last, stroke) {
    var ring = options.ring ? ';stroke:' + options.ring + ';stroke-width:2' : '';
    return (
      sparkOpen(width, height, options) +
      '<path d="' + path.trim() + '" style="fill:none;stroke:' + stroke + ';stroke-width:' + (options.lineWidth || 1.5) + ';stroke-linecap:round;stroke-linejoin:round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="' + (options.dot || 2.2) + '" style="fill:' + stroke + ring + '"/></svg>'
    );
  }

  /**
   * stackBar(parts, opts) → HTML — ONE bar of parts that fill the whole (each part { n, label, fill, on }: a var() background and the var() text colour
   * that belongs on it, because a token is readable in one direction only), the count written inside each part, and a key under it.
   * opts { total } — the whole the parts are measured against (the server's, default the parts' own sum). A part with no count draws no segment.
   * The classes (misstack · miskey · sw) are the page's own, app.html.
   */
  function stackBar(parts, opts) {
    var list = parts || [],
      total =
        (opts && opts.total) ||
        list.reduce(function (sum, part) {
          return sum + (Number(part.n) || 0);
        }, 0) ||
        1;
    var segments = list
      .map(function (part) {
        return part.n
          ? '<span style="background:' + part.fill + ';color:' + part.on + ';width:' + (part.n / total) * 100 + '%">' + escape(part.n) + '</span>'
          : '';
      })
      .join('');
    var key = list
      .map(function (part) {
        return '<span class="k"><i class="sw" style="background:' + part.fill + ';color:' + part.on + '"></i> ' + escape(part.label) + '</span>';
      })
      .join('');
    return '<div class="misstack">' + segments + '</div><div class="miskey">' + key + '</div>';
  }

  /**
   * stackRows(rows, opts) → '<svg …>' — a stacked bar per row, each row's own whole: rows [{ name, total, note, parts: [{ value, fill, title }] }]; opts { aria,
   * labelW (else measured from the longest name) }. The note ("3/10") is written beside the bar, because a bar to be measured by eye is decoration.
   * Empty → ''. Sizes are inline: the page's icon rule would shrink a bare svg.
   */
  function stackRows(rows, opts) {
    var options = opts || {},
      list = newest(rows || []);
    if (!list.length) return '';
    var rowHeight = 26,
      margin = 4,
      longest = list.reduce(function (most, row) {
        return Math.max(most, String(row.name || '').length);
      }, 0);
    var labelWidth = options.labelW || Math.max(84, Math.ceil((longest + 1) * 7.2)),
      width = labelWidth + 226;
    var rowsSvg = list
      .map(function (row, index) {
        return rowOf(row, index * rowHeight + margin, labelWidth, width);
      })
      .join('');
    return '<svg viewBox="0 0 ' + width + ' ' + (list.length * rowHeight + margin) + '" role="img" aria-label="' + escape(options.aria || '') + '">' + rowsSvg + '</svg>';
  }
  /** one row of stackRows: its name, its parts left to right within the row's own whole, and its count beside the bar */
  function rowOf(row, top, labelWidth, width) {
    var trackWidth = width - labelWidth - 44,
      left = labelWidth,
      out = '<text x="0" y="' + (top + 12) + '" font-size="12" font-family="ui-monospace,Menlo,monospace" fill="var(--ink-2)" font-weight="700">' + escape(row.name) + '</text>';
    (row.parts || []).forEach(function (part) {
      var value = Number(part.value) || 0;
      if (!value) return;
      var segment = (value / (row.total || 1)) * trackWidth;
      out += '<rect x="' + left.toFixed(1) + '" y="' + top + '" width="' + segment.toFixed(1) + '" height="15" fill="' + part.fill + '"><title>' + escape(part.title || '') + '</title></rect>';
      left += segment;
    });
    return out + '<text x="' + (width - 40) + '" y="' + (top + 12) + '" font-size="12" fill="var(--grey-2)">' + escape(row.note || '') + '</text>';
  }

  /**
   * stackColumns(columns, opts) → '<svg …>' — stacked columns, oldest on the left, one scale for all: columns [{ label ('' = none under this one), parts: [{ value, fill,
   * title }] }] (parts stack bottom to top in the order given); opts { aria, labelEvery (3) }. Fewer than 2 columns → '' (no invented shape).
   */
  function stackColumns(columns, opts) {
    var options = opts || {},
      list = newest(columns || []);
    if (list.length < 2) return '';
    var width = 340,
      height = 120,
      edge = 18,
      columnWidth = (width - edge * 2) / list.length,
      high =
        Math.max.apply(
          null,
          list.map(function (column) {
            return (column.parts || []).reduce(function (sum, part) {
              return sum + (Number(part.value) || 0);
            }, 0);
          })
        ) || 1;
    var out = '<svg viewBox="0 0 ' + width + ' ' + (height + 16) + '" role="img" aria-label="' + escape(options.aria || '') + '">';
    out += '<line x1="' + edge + '" y1="' + height + '" x2="' + (width - edge) + '" y2="' + height + '" stroke="var(--line)"/>';
    list.forEach(function (column, index) {
      var left = edge + index * columnWidth + columnWidth * 0.18;
      out += columnOf(column, left, columnWidth * 0.64, height, high);
      if (column.label && (index === 0 || index === list.length - 1 || index % (options.labelEvery || 3) === 0)) {
        out += '<text x="' + (left + columnWidth * 0.32) + '" y="' + (height + 12) + '" font-size="9" fill="var(--grey-2)" text-anchor="middle">' + escape(column.label) + '</text>';
      }
    });
    return out + '</svg>';
  }
  /** one column of stackColumns: its parts stacked from the baseline up, on the one scale */
  function columnOf(column, left, barWidth, height, high) {
    var down = height,
      out = '';
    (column.parts || []).forEach(function (part) {
      var value = Number(part.value) || 0;
      if (!value) return;
      var barHeight = (value / high) * (height - 10);
      down -= barHeight;
      out += '<rect x="' + left.toFixed(1) + '" y="' + down.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + barHeight.toFixed(1) + '" fill="' + part.fill + '"><title>' + escape(part.title || '') + '</title></rect>';
    });
    return out;
  }

  var CBDraw = { bars: bars, spark: spark, stackBar: stackBar, stackRows: stackRows, stackColumns: stackColumns, KINDS: KINDS, TYPES: TYPES, MAX_POINTS: MAX_POINTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = CBDraw;
  if (root) root.CBDraw = CBDraw;
})(typeof window !== 'undefined' ? window : globalThis);
