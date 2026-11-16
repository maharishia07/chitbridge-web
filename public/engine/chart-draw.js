/* engine/chart-draw.js — CBDraw: THE ONE SMALL CHART HELPER, inline SVG, no library (RPT2, 2026-10-17).
 * CARD 26-reporting-mis-and-bi/charts
 *
 * OWNS      bars(points, opts) — bars from zero, an optional dashed "same time last year" line with hollow dots, a hatched bar for part of a
 *           period, an empty tick for a period with no record; per bar its own tone, and one marked point (the lowest day) · spark(values, opts) — a
 *           sparkline with its last point dotted · stackBar(parts, opts) — one 100% bar in HTML with its key · stackRows(rows, opts) — a stacked
 *           bar per row with its count · stackColumns(columns, opts) — stacked columns, oldest left · KINDS and TYPES — the ONE vocabulary of chart
 *           kinds and drawings (the person's favourites are chart_fav_<kind> in ui_prefs; the api's lib/chart-prefs.js pins the same two lists) ·
 *           COMBOS and paletteOf(id, tokens, read) — the colour combinations as DATA, ONE place, and what a combination draws in the vibrant default and in
 *           the readable render · applyPalette(host, palette, read) — writes the palette as --ch-* tokens on a host and marks it data-read="on|off".
 *           waterfall(steps, opts) — a bridge from one carried total to another (the server's integer figures; refuses a mismatch, a mixed currency, a non-whole figure)
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
  var BAR = 'var(--ch-act,var(--green-d,#1f6b46))',
    LAST_YEAR = 'var(--ch-prev,var(--muted,#6f6450))',
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

  /** the same points as ONE line (type "line"): a path through every figure, a dot on each carrying the same test id and words as its bar would */
  function valueLineOf(points, layout, testId) {
    var path = '',
      dots = '',
      penDown = false;
    points.forEach(function (point, index) {
      var value = figure(point.value);
      if (value === null) {
        penDown = false;
        return;
      }
      var across = (index * layout.step + layout.step / 2).toFixed(1),
        down = layout.yOf(value).toFixed(1);
      path += (penDown ? ' L' : ' M') + across + ' ' + down;
      penDown = true;
      dots += '<circle cx="' + across + '" cy="' + down + '" r="3" data-testid="' + escape(testId + '-bar-' + point.key) + '" data-state="' + (point.hatch ? 'partial' : 'full') +
        '" style="fill:' + (point.fill || BAR) + '"><title>' + escape(point.title || '') + '</title></circle>';
    });
    return path ? '<path d="' + path.trim() + '" data-testid="cd-valueline" style="fill:none;stroke:' + BAR + ';stroke-width:2;stroke-linejoin:round"/>' + dots : '';
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
      (options.type === 'line' ? valueLineOf(list, layout, testId) : list
        .map(function (point, index) {
          return barOf(point, index, layout, testId);
        })
        .join('')) +
      lineOf(list, layout) +
      labelsOf(list, layout, height, options.labelOn) +
      markOf(options.mark, list, layout, width, height) +
      '</svg>'
    );
  }
  /** the mode a chart was drawn in, on the chart element itself: the a11y guard reads it from here, the chart does not guess (read "on" = the readable render) */
  function readOf(options) {
    return options.read ? ' data-read="' + (options.read === 'on' ? 'on' : 'off') + '"' : '';
  }
  /** the bars' svg tag: inline sizes, because the page's icon rule (svg{width:18px}) would otherwise shrink the chart to an icon */
  function barsOpen(width, height, options) {
    return (
      '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escape(options.aria || '') +
      '" data-testid="' + escape(options.svgTid || (options.tid || 'cd') + '-chart') + '"' + readOf(options) +
      ' style="display:block;width:100%;height:' + height + 'px;overflow:visible;stroke:none;fill:none">'
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
      '" data-testid="' + escape(options.tid || 'cd-spark') + '"' + readOf(options) +
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

  /* ── waterfall (chart engine step 3, 16 Nov 2026) ───────────────────────────────────────────────────────────────────────────────────────────
   * A bridge from one carried total to another: [{ key, label, kind: 'total'|'plus'|'minus', amount_minor, currency, title }]. Every amount is the SERVER's integer
   * minor-unit figure (a total is signed; a plus or minus is the server's own positive figure, the kind says the direction: no page negates anything).
   * ONE CALCULATION: nothing printed here is computed. The ONLY sum is the closing check: the running level (integers, never pixels) is compared with EVERY total
   *   the server carried; one that differs refuses the chart (the sum is the compare, never a figure shown or reused, as the Balance sheet compares its two totals).
   * A refusal never drops a step or draws a wrong bridge: it returns one sentence (role=status, data-state="mismatch") and the caller's table stays. */
  var WATERFALL_MAX = 120; /* a bridge is not sliced to the newest: slicing would drop its opening total, so more than this is refused */
  var REFUSED_WORDS = {
    few: 'A bridge needs at least two figures.',
    many: 'Too many figures for one bridge.',
    figure: 'A figure is not a whole amount, so the bridge is not drawn.',
    currency: 'The figures are in different currencies, so the bridge is not drawn.',
    key: 'Two steps share a name, so the bridge is not drawn.',
    kind: 'A step is not a total, a rise or a fall, so the bridge is not drawn.',
    close: 'The totals do not agree with the steps between them, so the bridge is not drawn.'
  };
  /** the one sentence that stands where a refused bridge would be; its words go through the page's tx() when it has one */
  function refusedOf(code, step) {
    var said = REFUSED_WORDS[code];
    if (typeof root.tx === 'function') said = root.tx(said);
    return '<p role="status" aria-live="polite" data-testid="cd-waterfall-refused" data-state="mismatch" data-why="' + code + '">' + escape(said) + (step ? ' (' + escape(step) + ')' : '') + '</p>';
  }
  /** why a list of steps may not be drawn, as [code, step label], or null. Integers in minor units; the compare of carried totals is the only sum. */
  function waterfallFault(steps, currency) {
    var level = 0,
      seen = {};
    if (steps.length < 2) return ['few'];
    if (steps.length > WATERFALL_MAX) return ['many'];
    for (var at = 0; at < steps.length; at++) {
      var step = steps[at] || {};
      if (step.kind !== 'total' && step.kind !== 'plus' && step.kind !== 'minus') return ['kind', step.label];
      if (typeof step.amount_minor !== 'number' || !Number.isSafeInteger(step.amount_minor) || (step.kind !== 'total' && step.amount_minor < 0)) return ['figure', step.label];
      if (!step.currency || step.currency !== (currency || steps[0].currency)) return ['currency', step.label];
      if (seen[step.key]) return ['key', step.label];
      seen[step.key] = 1;
      if (step.kind === 'total') {
        if (at > 0 && step.amount_minor !== level) return ['close', step.label];
        level = step.amount_minor;
      } else level += step.kind === 'plus' ? step.amount_minor : -step.amount_minor;
    }
    return steps[steps.length - 1].kind === 'total' ? null : ['close', steps[steps.length - 1].label];
  }
  /** each step's span on the scale: a total stands from zero, a rise or fall floats from the level before (integers; geometry only) */
  function waterfallSpans(steps) {
    var level = 0;
    return steps.map(function (step) {
      var from = step.kind === 'total' ? 0 : level,
        to = step.kind === 'total' ? step.amount_minor : level + (step.kind === 'plus' ? step.amount_minor : -step.amount_minor);
      level = to;
      return { from: from, to: to };
    });
  }
  /** one step's bar: total solid (--ch-act), rise solid (--ch-acc) with a triangle up, fall hollow and dashed (--ch-prev) with a triangle down: never colour alone, never a red series colour */
  function waterfallBar(step, span, at, layout, testId, label) {
    var top = Math.min(layout.yOf(span.from), layout.yOf(span.to)),
      tall = Math.max(1, Math.abs(layout.yOf(span.from) - layout.yOf(span.to))),
      left = at * layout.step + (layout.step - layout.width) / 2,
      tone = step.kind === 'total' ? BAR : step.kind === 'plus' ? 'var(--ch-acc,var(--green-d,#1f6b46))' : LAST_YEAR,
      look = step.kind === 'minus' ? 'fill:none;stroke:' + tone + ';stroke-width:1.5;stroke-dasharray:3 2' : 'fill:' + tone,
      glyph = step.kind === 'plus' ? '▲ ' : step.kind === 'minus' ? '▼ ' : '';
    return (
      '<g data-testid="' + escape(testId + '-bar-' + step.key) + '" data-kind="' + step.kind + '"><title>' + escape(step.title || step.label || '') + '</title>' +
      '<rect x="' + left.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + layout.width + '" height="' + tall.toFixed(1) + '" rx="2" style="' + look + '"/>' +
      (label ? '<text x="' + (left + layout.width / 2).toFixed(1) + '" y="' + (top - 3).toFixed(1) + '" text-anchor="middle" style="font:10px var(--mono,monospace);fill:' + LABEL + '">' + glyph + escape(label) + '</text>' : '') +
      '</g>'
    );
  }
  /** the thin line from one bar's end level across to the next bar */
  function waterfallJoin(span, at, layout) {
    var y = layout.yOf(span.to).toFixed(1),
      right = at * layout.step + (layout.step + layout.width) / 2;
    return '<line x1="' + right.toFixed(1) + '" x2="' + ((at + 1) * layout.step + (layout.step - layout.width) / 2).toFixed(1) + '" y1="' + y + '" y2="' + y + '" style="stroke:' + BASELINE + ';stroke-width:1"/>';
  }
  /**
   * waterfall(steps, opts) → '<svg …>' or the refusal sentence. steps as above, first to last; opts { width (the card's own width, 640), height (190), id, tid, aria, currency (the shop's; every
   * step must carry it), format(step) → the words for a step's figure (the caller's money in the shop's currency; it gets the whole step), read }. The scale includes zero and the lowest
   * level, so a loss draws below the baseline. Fewer than two steps or more than WATERFALL_MAX is refused, never sliced.
   */
  function waterfall(steps, opts) {
    var options = opts || {},
      list = steps || [],
      fault = waterfallFault(list, options.currency);
    if (fault) return refusedOf(fault[0], fault[1]);
    var width = options.width || 640,
      height = options.height || 190,
      testId = options.tid || 'cd',
      spans = waterfallSpans(list),
      layout = geometryOf(
        spans.map(function (span) {
          return { value: span.to, line: span.from };
        }),
        width,
        height,
        escape(options.id || 'cd'),
        { padTop: 24 }
      ),
      labelled = list.length <= 12,
      every = Math.max(1, Math.ceil(LABEL_GAP / layout.step));
    layout.width = Math.max(4, Math.min(layout.width, 72));
    var body = list
      .map(function (step, at) {
        var label = labelled && options.format ? options.format(step) : '';
        return waterfallBar(step, spans[at], at, layout, testId, label) + (at < list.length - 1 ? waterfallJoin(spans[at], at, layout) : '');
      })
      .join('');
    return (
      barsOpen(width, height, { aria: options.aria, svgTid: testId + '-waterfall', read: options.read }) +
      zeroLineOf(width, layout) +
      body +
      labelsOf(list, layout, height, function (at, count) {
        return labelled || at === 0 || at === count - 1 || at % every === 0;
      }) +
      '</svg>'
    );
  }

  /**
   * THE COLOUR COMBINATIONS, AS DATA, in ONE place. A combination is { name, act (this period), prev (the one before), acc (a third mark), ramp (five, calm to warm), pie? (six slice
   * colours), more? }. "Follow my avatar theme" is not here: it is the 'tint' rule below, resolved on the person's own theme, and it is what a person who chose nothing sees.
   * PUBLISHED HEXES, each as the sample page read it (web branch l16/mis-sample-web, public/lab/chart-themes.html; nothing else is used, which colour does which job is ours):
   *   okabe      Okabe-Ito, https://siegal.bio.nyu.edu/color-palette/ (8 hexes, unnamed there)
   *   tableau    Tableau colour-blind, matplotlib stylelib/tableau-colorblind10.mplstyle
   *   classic    Tableau classic, d3-scale-chromatic src/categorical/Tableau10.js
   *   carbon     IBM Carbon, https://carbondesignsystem.com/data-visualization/color-palettes/ (14 hexes)
   *   set2 · dark2 · paired   ColorBrewer, axismaps/colorbrewer export/colorbrewer.js
   *   viridis    BIDS/colormap colormaps.py, entries 0, 64, 128, 192, 255
   *   tealpink · coolblue   the theme files ColorblindSafe-Longer.json and Waveform.json that Microsoft Learn's report-themes page links
   * NOT USED: the built-in Power BI report themes (their hexes were pictures only). RED IS NEVER A SERIES COLOUR: a red-led hex (Carbon's #9f1853) is left out, and
   * tests/chart-combos.test.cjs fails on any series colour whose hue is red. The order is the sample's; the ranked order is the generated test's (its readability count over the 16 themes).
   * The colour-blind scores are NOT shown: the sample's simulation matrices were typed from memory.
   */
  var COMBOS = {
    ibcs: { name: 'IBCS grey' },
    okabe: { name: 'Okabe-Ito', act: '#0072B2', prev: '#E69F00', acc: '#009E73', ramp: ['#0072B2', '#56B4E9', '#009E73', '#F0E442', '#E69F00'], more: ['#CC79A7'] },
    tableau: { name: 'Tableau colour-blind', act: '#006BA4', prev: '#FF800E', acc: '#C85200', ramp: ['#006BA4', '#5F9ED1', '#FFBC79', '#FF800E', '#C85200'], more: ['#A2C8EC'] },
    classic: { name: 'Tableau classic', act: '#4e79a7', prev: '#f28e2c', acc: '#59a14f', ramp: ['#4e79a7', '#76b7b2', '#59a14f', '#edc949', '#f28e2c'], more: ['#af7aa1'] },
    carbon: { name: 'IBM Carbon', act: '#6929c4', prev: '#1192e8', acc: '#005d5d', ramp: ['#005d5d', '#1192e8', '#6929c4', '#b28600', '#8a3800'] },
    tealpink: { name: 'Teal and pink, colour-blind safe', act: '#074650', prev: '#009292', acc: '#480091', ramp: ['#074650', '#009292', '#6db6ff', '#fe6db6', '#914800'] },
    coolblue: { name: 'Cool blues to lime', act: '#4584D3', prev: '#31B6FD', acc: '#4C45D3', ramp: ['#4584D3', '#5BD0B0', '#5BD078', '#A5D028', '#F5C040'] },
    set2: { name: 'Brewer Set2 pastel', act: '#66c2a5', prev: '#fc8d62', acc: '#8da0cb', ramp: ['#8da0cb', '#66c2a5', '#a6d854', '#ffd92f', '#fc8d62'], more: ['#e78ac3'] },
    dark2: { name: 'Brewer Dark2', act: '#1b9e77', prev: '#d95f02', acc: '#7570b3', ramp: ['#7570b3', '#1b9e77', '#66a61e', '#e6ab02', '#d95f02'], more: ['#e7298a'] },
    paired: { name: 'Brewer Paired', act: '#1f78b4', prev: '#a6cee3', acc: '#6a3d9a', ramp: ['#1f78b4', '#a6cee3', '#33a02c', '#fdbf6f', '#ff7f00'] },
    viridis: { name: 'Viridis', act: '#3b518b', prev: '#5cc863', acc: '#21908d', ramp: ['#440154', '#3b518b', '#21908d', '#5cc863', '#fde725'], pie: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'] }
  };
  var MARK_NEED = 3; /* WCAG 1.4.11: a series mark against the page */
  var TEXT_NEED = 4.5; /* WCAG 1.4.3: text */

  /** a css colour (#hex, #hex3 or rgb()) as [r, g, b] */
  function channelsOf(colour) {
    var text = String(colour).trim();
    if (text.charAt(0) === '#') {
      var digits = text.slice(1);
      if (digits.length === 3) digits = digits.replace(/./g, '$&$&');
      return [0, 2, 4].map(function (at) {
        return parseInt(digits.substr(at, 2), 16);
      });
    }
    return (text.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  }
  /** WCAG contrast of two colours: THE one arithmetic. CBUiStandard.contrastRatio (the UI standard page) calls this; there is no second copy. */
  function contrast(first, second) {
    var light = function (colour) {
      var part = channelsOf(colour).map(function (value) {
        var unit = value / 255;
        return unit <= 0.03928 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * part[0] + 0.7152 * part[1] + 0.0722 * part[2];
    };
    var lighter = Math.max(light(first), light(second)),
      darker = Math.min(light(first), light(second));
    return (lighter + 0.05) / (darker + 0.05);
  }
  /** a mix of two colours, the first at share (0..1): the same as css color-mix(in srgb) */
  function mixOf(first, second, share) {
    var near = channelsOf(first),
      other = channelsOf(second);
    return (
      'rgb(' +
      [0, 1, 2]
        .map(function (at) {
          return Math.round(near[at] * share + other[at] * (1 - share));
        })
        .join(',') +
      ')'
    );
  }
  /** the black or the white that reads better on a colour: the text colour for a label written inside a fill */
  function onColour(fill) {
    return contrast(fill, '#ffffff') >= contrast(fill, '#000000') ? '#ffffff' : '#000000';
  }
  /** the share (30..100, in 5s) of a colour that, mixed toward the page, is the lightest that still clears 3:1 against the page */
  function lightestShare(colour, page) {
    var share = 30;
    while (share < 100 && contrast(mixOf(colour, page, share / 100), page) < MARK_NEED) share += 5;
    return share;
  }
  /** the colour of this person's own theme, as marks: this period the accent, the one before a lighter tint of it, a ramp from the theme's amber to its accent (rule "tint") */
  function tintOf(tokens) {
    return {
      act: tokens.acc,
      prev: mixOf(tokens.acc, tokens.page, lightestShare(tokens.acc, tokens.page) / 100),
      acc: tokens.ink,
      ramp: [0, 0.2, 0.4, 0.6, 0.8].map(function (share) {
        return mixOf(tokens.prog, tokens.acc, share);
      })
    };
  }
  /** IBCS: this period the ink, the one before the lightest ink mix that clears 3:1, a grey ramp from there to the ink */
  function greyOf(tokens) {
    var share = lightestShare(tokens.ink, tokens.page);
    return {
      act: tokens.ink,
      prev: mixOf(tokens.ink, tokens.page, share / 100),
      acc: tokens.acc,
      ramp: [0, 1, 2, 3, 4].map(function (at) {
        return mixOf(tokens.ink, tokens.page, (share + ((100 - share) * at) / 4) / 100);
      })
    };
  }
  /** the six slice colours of a set: its own, distinct (a published list as published) */
  function sliceColours(set) {
    if (set.pie) return set.pie;
    var seen = {},
      out = [];
    [set.act, set.prev, set.acc].concat(set.ramp, set.more || []).forEach(function (colour) {
      var key = channelsOf(colour).join();
      if (!seen[key]) {
        seen[key] = 1;
        out.push(colour);
      }
    });
    return out.slice(0, 6);
  }
  /** the lowest contrast of any mark of a palette against the page */
  function lowestMark(palette, page) {
    return Math.min.apply(
      null,
      palette.pie.concat([palette.act, palette.prev, palette.acc], palette.ramp).map(function (colour) {
        return contrast(colour, page);
      })
    );
  }
  /**
   * paletteOf(id, tokens, read) → { act, prev, acc, ramp, pie, on, used, held } — tokens { page, ink, acc, prog } are the person's theme as css colours; read is "on" or "off".
   * VIBRANT (off, the default): a published combination draws exactly as published, whatever its contrast: it is the person's own pick, and the guards treat it so.
   * READABLE (on): a combination that holds 3:1 on every mark against the page draws as it is; one that does not draws as IBCS grey for this theme. No id (or an unknown
   * one, a removed combination read back) is "follow my avatar theme". `used` names what was drawn; `held` says whether every mark clears 3:1.
   */
  function paletteOf(id, tokens, read) {
    var set = COMBOS[id] && COMBOS[id].act ? JSON.parse(JSON.stringify(COMBOS[id])) : id === 'ibcs' ? greyOf(tokens) : tintOf(tokens),
      used = COMBOS[id] ? id : 'follow';
    set.pie = sliceColours(set);
    var held = lowestMark(set, tokens.page) >= MARK_NEED;
    if (read === 'on' && !held) {
      /* the readable render: the person's theme tint where it clears 3:1, else the IBCS grey (REQ section 6) */
      set = tintOf(tokens);
      set.pie = sliceColours(set);
      used = 'follow';
      if (lowestMark(set, tokens.page) < MARK_NEED) {
        set = greyOf(tokens);
        set.pie = sliceColours(set);
        used = 'ibcs';
      }
      held = lowestMark(set, tokens.page) >= MARK_NEED;
    }
    set.on = onColour(set.act);
    set.used = used;
    set.held = held;
    return set;
  }
  /** write a palette as --ch-* tokens on a host, and say which mode it is in (data-read) on the host: every chart under it inherits the colours */
  function applyPalette(host, palette, read) {
    var names = { '--ch-act': palette.act, '--ch-prev': palette.prev, '--ch-acc': palette.acc };
    palette.ramp.forEach(function (colour, at) {
      names['--ch-r' + at] = colour;
    });
    Object.keys(names).forEach(function (name) {
      host.style.setProperty(name, names[name]);
    });
    host.setAttribute('data-read', read === 'on' ? 'on' : 'off');
  }

  var CBDraw = { bars: bars, spark: spark, stackBar: stackBar, stackRows: stackRows, stackColumns: stackColumns, waterfall: waterfall, KINDS: KINDS, TYPES: TYPES, MAX_POINTS: MAX_POINTS, COMBOS: COMBOS, paletteOf: paletteOf, applyPalette: applyPalette, contrast: contrast, onColour: onColour, channelsOf: channelsOf, MARK_NEED: MARK_NEED, TEXT_NEED: TEXT_NEED };
  if (typeof module !== 'undefined' && module.exports) module.exports = CBDraw;
  if (root) root.CBDraw = CBDraw;
})(typeof window !== 'undefined' ? window : globalThis);
