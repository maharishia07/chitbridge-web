/* engine/chart-draw.js — CBDraw: THE ONE SMALL CHART HELPER, inline SVG, no library (RPT2, 2026-10-17).
 * CARD 26-reporting-mis-and-bi/charts
 *
 * OWNS      bars(points, opts) — bars from zero, an optional dashed "same time last year" line with hollow dots, a hatched bar for part of a
 *           period, an empty tick for a period with no record (opts.actual / opts.previous = the measured colours of the bars and of the previous line) · spark(values, opts) — a sparkline with its last
 *           point dotted (REP-36: opts.title + opts.desc add a <title>/<desc>) · statusBar(parts, opts) — stacked good/watch/help with figures · monthStrip(months, opts) —
 *           12 small squares locked/open/running · palette(vars, contrast) — actual/previous/accent/good/watch/bad measured per theme.
 * CALLED BY app/cap-mis-trend.js (CB Finance › Reports › Trend) · app/shell.js (the Till card's teaser on Home) · e2e/chart-draw.test.cjs · public/chart-sample.html (REP-36 theme sample).
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
  var BAR = 'var(--green-d,#1f6b46)',
    LAST_YEAR = 'var(--muted,#6f6450)',
    BASELINE = 'var(--line-3,#d8ccb0)',
    DOT_FILL = 'var(--card,#fffdf8)',
    LABEL = 'var(--muted,#6f6450)';
  var LABEL_GAP = 44; /* px between two axis labels, so they never collide */
  var PAD_TOP = 16,
    PAD_BOTTOM = 20; /* room for the scale words above and the labels below */

  var escape = root.esc; /* app/helpers.js — the ONE esc; every page that loads this loads helpers.js first */
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
    var look = point.hatch ? 'fill:url(#' + layout.id + '-hatch);stroke:' + layout.actual + ';stroke-width:1.5' : 'fill:' + layout.actual;
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
      '" style="' +
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
        layout.previous +
        ';stroke-width:1.5"><title>' +
        escape(point.lineTitle || '') +
        '</title></circle>';
    });
    return path
      ? '<path d="' + path.trim() + '" data-testid="cd-lastyear" style="fill:none;stroke:' + layout.previous + ';stroke-width:1.5;stroke-dasharray:4 3"/>' + dots
      : '';
  }

  /** the labels under the bars: every k-th, counted from the newest so the latest always has its label */
  function labelsOf(points, layout, chartHeight) {
    var every = Math.max(1, Math.ceil(LABEL_GAP / layout.step)),
      count = points.length;
    return points
      .map(function (point, index) {
        if ((count - 1 - index) % every) return '';
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
  function geometryOf(points, width, height, id) {
    var scale = scaleOf(points),
      plot = height - PAD_TOP - PAD_BOTTOM,
      step = width / points.length;
    var layout = {
      id: id,
      step: step,
      width: Math.max(2, Math.floor(step * 0.7)),
      yOf: function (value) {
        return PAD_TOP + ((scale.high - value) / scale.span) * plot;
      }
    };
    layout.zero = layout.yOf(0);
    return layout;
  }

  /** the diagonal-hatch pattern that fills a part-period bar (its id is unique per chart) */
  function hatchDefs(id, colour) {
    return (
      '<defs><pattern id="' +
      id +
      '-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" style="stroke:' +
      colour +
      ';stroke-width:1.5"/></pattern></defs>'
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
   * opts { width, height, id (unique per page: the hatch pattern's id), aria (the sentence a screen reader hears), tid, top (words at the top-left: the scale) }.
   * No points → ''. Sizes are inline: the page's icon rule (svg{width:18px}) would otherwise shrink the chart to an icon.
   */
  function bars(points, opts) {
    var options = opts || {},
      list = points || [];
    if (!list.length) return '';
    var width = options.width || 640,
      height = options.height || 170,
      id = escape(options.id || 'cd'),
      testId = options.tid || 'cd';
    var layout = geometryOf(list, width, height, id);
    layout.actual = options.actual || BAR;
    layout.previous = options.previous || LAST_YEAR; /* REP-36: a caller that measured the previous colour (palette) passes it; the Trend page does not */
    var hatch = hatchDefs(id, layout.actual);
    var scaleWords = options.top ? '<text x="0" y="10" style="font:10px var(--mono,monospace);fill:' + LABEL + '">' + escape(options.top) + '</text>' : '';
    return (
      '<svg viewBox="0 0 ' +
      width +
      ' ' +
      height +
      '" role="img" aria-label="' +
      escape(options.aria || '') +
      '" data-testid="' +
      escape(testId + '-chart') +
      '" style="display:block;width:100%;height:' +
      height +
      'px;overflow:visible;stroke:none;fill:none">' +
      hatch +
      scaleWords +
      zeroLineOf(width, layout) +
      list
        .map(function (point, index) {
          return barOf(point, index, layout, testId);
        })
        .join('') +
      lineOf(list, layout) +
      labelsOf(list, layout, height) +
      '</svg>'
    );
  }

  /**
   * spark(values, opts) → '<svg …>' — values oldest first, null = no record (the line breaks there); opts { width 64, height 18, stroke (a var()), aria, tid }.
   * Fewer than 2 figures → '' (SPEC-charts rule 1: no invented shape). The scale starts at zero, as the bars do.
   */
  function spark(values, opts) {
    var options = opts || {},
      list = (values || []).map(figure),
      have = list.filter(function (value) {
        return value !== null;
      });
    if (have.length < 2) return '';
    var width = options.width || 64,
      height = options.height || 18,
      high = Math.max.apply(null, have.concat([0])) || 1,
      stroke = options.stroke || BAR;
    var pointAt = function (index) {
      return [
        (2 + (index * (width - 4)) / Math.max(1, list.length - 1)).toFixed(1),
        (height - 2 - (Math.max(0, list[index]) / high) * (height - 4)).toFixed(1)
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

  /** REP-36: a sparkline that is given opts.title / opts.desc also carries them as <title> and <desc> (the text equivalent of its figures); without them nothing changes */
  function sparkWords(options) {
    if (!options.title && !options.desc) return '';
    return '<title>' + escape(options.title || '') + '</title><desc>' + escape(options.desc || '') + '</desc>';
  }

  /** the sparkline's svg wrapper: its path and the dot on the last point */
  function sparkSvg(width, height, options, path, last, stroke) {
    return (
      '<svg viewBox="0 0 ' +
      width +
      ' ' +
      height +
      '" width="' +
      width +
      '" height="' +
      height +
      '" role="img" aria-label="' +
      escape(options.aria || '') +
      '" data-testid="' +
      escape(options.tid || 'cd-spark') +
      '" style="display:inline-block;vertical-align:middle;width:' +
      width +
      'px;height:' +
      height +
      'px;overflow:visible;fill:none;stroke:none">' +
      sparkWords(options) +
      '<path d="' +
      path.trim() +
      '" style="fill:none;stroke:' +
      stroke +
      ';stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"/>' +
      '<circle cx="' +
      last[0] +
      '" cy="' +
      last[1] +
      '" r="2.2" style="fill:' +
      stroke +
      '"/></svg>'
    );
  }

  /* ── REP-36 (16 Nov): the palette, the status bar and the month strip, beside bars and spark. The caller passes numbers and WORDS (money already
   *    through the M36 unit by the caller); nothing here formats money or fetches. Each svg carries role="img", a <title>, a <desc> that is the
   *    text equivalent of every figure, and a <title> on each part. Colours: ink for actual, a mix of ink and page for previous (cleared to 3:1),
   *    the accent-text for the ONE accent, and good / watch / bad as fixed meanings (light and dark variant), never a theme's blue or red. ── */
  var FIXED = {
    light: { good: '#1F6B46', watch: '#8A5A00', bad: '#B3402A' },
    dark: { good: '#5CC08A', watch: '#E0A838', bad: '#F08068' }
  };
  var PREV_FROM = 55,
    PREV_STEP = 5,
    NEED_PREVIOUS = 3;

  function rgbOf(text) {
    var value = String(text).trim();
    if (/^#/.test(value)) {
      value = value.slice(1);
      if (value.length === 3) value = value.replace(/./g, '$&$&');
      return [0, 2, 4].map(function (at) {
        return parseInt(value.substr(at, 2), 16);
      });
    }
    return (value.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  }
  /** WCAG contrast of two resolved colours: the fallback paletteNow uses on a page that does not load ui-standard.js (the Home); the same formula, and a theme sweep proves both agree */
  function contrastRatio(first, second) {
    var lum = function (text) {
      var c = rgbOf(text).map(function (v) {
        var u = v / 255;
        return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    return (Math.max(lum(first), lum(second)) + 0.05) / (Math.min(lum(first), lum(second)) + 0.05);
  }
  /** `percent` of the first colour over the rest of the second: what CSS color-mix(in srgb, a percent, b) paints */
  function mix(first, second, percent) {
    var one = rgbOf(first),
      two = rgbOf(second);
    return (
      'rgb(' +
      one
        .map(function (value, at) {
          return Math.round((value * percent) / 100 + (two[at] * (100 - percent)) / 100);
        })
        .join(',') +
      ')'
    );
  }
  function isDark(page, contrast) {
    return contrast(page, 'rgb(0,0,0)') < contrast(page, 'rgb(255,255,255)');
  }
  /**
   * palette(vars, contrast) → { actual, previous, previousMix, accent, good, watch, bad, dark, fellBack: [names] } — vars { ink, page, card, accent } are resolved
   * colours; `contrast` is ui-standard's contrastRatio (the one measure, passed in so this file stays loadable alone). previous starts at 55% ink over page
   * and rises in steps of 5 until it clears 3:1 on BOTH the page and the card (a 45% mix failed on 11 of 16 themes); the accent drops to ink when it
   * cannot clear 3:1; good / watch / bad are fixed per light or dark and are listed in fellBack if a theme's page still defeats them.
   */
  function palette(vars, contrast) {
    var clears = function (colour) {
      return [vars.page, vars.card].every(function (ground) {
        return contrast(colour, ground) >= NEED_PREVIOUS;
      });
    };
    var percent = PREV_FROM;
    while (percent < 100 && !clears(mix(vars.ink, vars.page, percent))) percent += PREV_STEP;
    var dark = isDark(vars.page, contrast),
      kinds = dark ? FIXED.dark : FIXED.light,
      fellBack = [];
    if (percent > PREV_FROM) fellBack.push('previous');
    var accent = vars.accent && clears(vars.accent) ? vars.accent : vars.ink;
    if (accent !== vars.accent) fellBack.push('accent');
    var out = { actual: vars.ink, previous: mix(vars.ink, vars.page, percent), previousMix: percent, accent: accent, dark: dark, fellBack: fellBack };
    ['good', 'watch', 'bad'].forEach(function (name) {
      out[name] = kinds[name];
      if (!clears(kinds[name])) fellBack.push(name);
    });
    return out;
  }
  /** the palette of the theme on the page now, or on `element` (the avatar's tokens, resolved; an unset token falls to Cream's own value). Needs a browser and a contrast function. */
  function paletteNow(contrast, element) {
    var style = getComputedStyle(element || document.documentElement),
      read = function (name, fallback) {
        return style.getPropertyValue(name).trim() || fallback;
      };
    return palette(
      { ink: read('--ink', '#2a2418'), page: read('--paper', read('--page', '#FCFAF5')), card: read('--card', '#fffdf8'), accent: read('--accent-text', read('--accent', '#1f5f5b')) },
      contrast || (root.CBUiStandard && root.CBUiStandard.contrastRatio) || contrastRatio
    );
  }

  /** the custom properties a palette sets on its svg, so shapes read var(--rp-…); with no palette the tokens themselves drive it (55% previous mix) */
  function paletteStyle(colours) {
    var chosen = colours || {
      actual: 'var(--ink,#2a2418)',
      previous: 'color-mix(in srgb,var(--ink,#2a2418) 55%,var(--page,#FCFAF5))',
      accent: 'var(--accent-text,#1f5f5b)',
      good: FIXED.light.good,
      watch: FIXED.light.watch,
      bad: FIXED.light.bad
    };
    return '--rp-actual:' + chosen.actual + ';--rp-previous:' + chosen.previous + ';--rp-accent:' + chosen.accent + ';--rp-good:' + chosen.good + ';--rp-watch:' + chosen.watch + ';--rp-bad:' + chosen.bad;
  }

  /** E17 (Athi 2 Nov: every UI element has a code, on the element): the CALLER passes opts.codes { chart, part, legend } (register codes, written as data-cbsid); CBDraw knows none, so it stays generic. A role not passed writes nothing. */
  function codeAttr(codes, role) {
    return codes && codes[role] ? ' data-cbsid="' + escape(codes[role]) + '"' : '';
  }

  /** the accessible head every new svg shares: role, a <title>, a <desc> (the text equivalent), and the inline size the page's svg icon rule would otherwise crush */
  function accessibleSvg(width, height, options, inner) {
    var id = escape(options.id);
    return (
      '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-labelledby="' + id + '-t ' + id + '-d" data-testid="' + escape(options.tid) + '"' + codeAttr(options.codes, 'chart') +
      ' style="display:block;width:100%;max-width:' + width + 'px;height:auto;aspect-ratio:' + width + '/' + height + ';overflow:visible;stroke:none;fill:none;' + paletteStyle(options.palette) +
      '"><title id="' + id + '-t">' + escape(options.title || '') + '</title><desc id="' + id + '-d">' + escape(options.desc || '') + '</desc>' + inner + '</svg>'
    );
  }

  var KIND_VAR = { good: 'var(--rp-good)', watch: 'var(--rp-watch)', help: 'var(--rp-bad)' };
  var STATUS_GAP = 2,
    STATUS_BAR = 14,
    STATUS_TEXT_AT = 28,
    STATUS_MIN_LABEL = 30,
    STATUS_MIN_W = 16;

  /** statusGeometry(parts, width) → [{ kind, x, w, mid, part }] — a part with no count is left out; widths share `width` less the gaps in proportion to the counts. */
  function statusGeometry(parts, width) {
    var shown = (parts || []).filter(function (part) {
      return figure(part.value) !== null && Number(part.value) > 0;
    });
    var total = shown.reduce(function (sum, part) {
      return sum + Number(part.value);
    }, 0);
    var room = width - STATUS_GAP * Math.max(0, shown.length - 1),
      at = 0;
    /* a small part keeps a floor wide enough to see and to carry its figure (E17); the others share what is left in proportion */
    var floor = {}, left = room, rest = total;
    for (var again = true; again && rest > 0; ) {
      again = false;
      shown.forEach(function (part, i) {
        if (floor[i] || (Number(part.value) / rest) * left >= STATUS_MIN_W) return;
        floor[i] = true; left -= STATUS_MIN_W; rest -= Number(part.value); again = true;
      });
    }
    return shown.map(function (part, i) {
      var w = floor[i] ? STATUS_MIN_W : rest > 0 ? (Number(part.value) / rest) * left : room / shown.length,
        box = { kind: part.kind, x: at, w: w, mid: at + w / 2, part: part };
      at += w + STATUS_GAP;
      return box;
    });
  }
  /** one part's shape: solid = good, diagonal hatch = watch, dots = help, so a colour-blind reader still tells them apart */
  function statusShape(box, id, codes) {
    var common = ' x="' + box.x.toFixed(1) + '" y="0" width="' + box.w.toFixed(1) + '" height="' + STATUS_BAR + '" rx="2"';
    var title = '<title>' + escape(box.part.label || '') + '</title>';
    var base = '<rect' + common + ' style="fill:' + (KIND_VAR[box.kind] || KIND_VAR.help) + '" data-kind="' + escape(box.kind) + '"' + codeAttr(codes, 'part') + '>' + title + '</rect>';
    if (box.kind === 'good') return base;
    return base + '<rect' + common + ' style="fill:url(#' + id + (box.kind === 'watch' ? '-w' : '-h') + ')"/>';
  }
  function statusDefs(id) {
    return (
      '<defs><pattern id="' + id + '-w" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" style="fill:var(--card,#fffdf8)"/></pattern>' +
      '<pattern id="' + id + '-h" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1" style="fill:var(--card,#fffdf8)"/></pattern></defs>'
    );
  }
  /** the figures under the bar: each part's figure (and its short words when the part is wide enough), skipped where it would touch the last one drawn */
  function statusTexts(boxes, width, codes) {
    var lastEnd = -1;
    return boxes
      .map(function (box) {
        var text = box.part.figure !== undefined ? String(box.part.figure) : String(box.part.value),
          words = box.w >= STATUS_MIN_LABEL && box.part.short ? ' ' + box.part.short : '',
          size = (text.length + words.length) * 6.5,
          mid = Math.min(Math.max(box.mid, size / 2), width - size / 2), /* never past either edge of the viewBox */
          left = mid - size / 2;
        if (left < lastEnd + 4) return '';
        lastEnd = left + size;
        return '<text x="' + mid.toFixed(1) + '" y="' + STATUS_TEXT_AT + '" text-anchor="middle"' + codeAttr(codes, 'legend') + ' style="font:11px var(--mono,monospace);fill:var(--rp-actual)">' + escape(text + words) + '</text>';
      })
      .join('');
  }
  /**
   * statusBar(parts, opts) → '<svg …>' — parts [{ kind: 'good'|'watch'|'help', value (a count), label (the full words, for the part's title and the <desc>),
   * figure (what is printed under it; default the count), short (words printed beside it when it is wide) }]; opts { width 320, id, tid, title, desc, palette }.
   * The <desc> is built from the labels: "label, label, …". No part with a count → '' (no invented shape).
   */
  function statusBar(parts, opts) {
    var options = opts || {},
      width = options.width || 320,
      id = options.id || 'cd-status',
      boxes = statusGeometry(parts, width);
    if (!boxes.length) return '';
    var desc =
      options.desc ||
      boxes
        .map(function (box) {
          return box.part.label || String(box.part.value);
        })
        .join(', ');
    var inner =
      statusDefs(escape(id)) +
      boxes
        .map(function (box) {
          return statusShape(box, escape(id), options.codes);
        })
        .join('') +
      statusTexts(boxes, width, options.codes);
    return accessibleSvg(width, STATUS_TEXT_AT + 6, { id: id, tid: options.tid || 'cd-status', title: options.title, desc: desc, palette: options.palette, codes: options.codes }, inner);
  }

  var STRIP = { size: 18, gap: 4, labelAt: 30 };
  var STRIP_WORDS = { locked: 'locked', open: 'open', running: 'running' };
  /** stripGeometry(months, size, gap) → [{ x, y, size, month }] */
  function stripGeometry(months, size, gap) {
    return (months || []).map(function (month, index) {
      return { x: index * (size + gap), y: 1, size: size, month: month };
    });
  }
  function stateOf(month) {
    return STRIP_WORDS[month.state] ? month.state : 'open';
  }
  /** one square: locked = filled ink, open = hollow muted outline, running = hollow accent outline with a dot, so the three differ in shape as well as colour */
  function stripSquare(cell, words, codes) {
    var state = stateOf(cell.month),
      half = cell.size / 2,
      title = '<title>' + escape((cell.month.label || '') + ': ' + ((words || STRIP_WORDS)[state] || STRIP_WORDS[state])) + '</title>',
      common = ' x="' + (cell.x + 1) + '" y="' + cell.y + '" width="' + (cell.size - 2) + '" height="' + (cell.size - 2) + '" rx="2" data-state="' + state + '"' + codeAttr(codes, 'part');
    if (state === 'locked') return '<rect' + common + ' style="fill:var(--rp-actual)">' + title + '</rect>';
    if (state === 'open') return '<rect' + common + ' style="fill:none;stroke:var(--rp-previous);stroke-width:1.5">' + title + '</rect>';
    return (
      '<rect' + common + ' style="fill:none;stroke:var(--rp-accent);stroke-width:2">' + title + '</rect>' +
      '<circle cx="' + (cell.x + half) + '" cy="' + (cell.y + half - 1) + '" r="2.5" style="fill:var(--rp-accent)"/>'
    );
  }
  /**
   * monthStrip(months, opts) → '<svg …>' — months [{ label (short: "Nov"), state: 'locked'|'open'|'running' }] oldest first (the caller passes 12);
   * opts { size 18, gap 4, id, tid, title, desc, words { locked, open, running } (the caller's translated words), labels (true draws each label), palette }.
   * The <desc> reads "Jan: locked, Feb: open, …". No months → ''.
   */
  function monthStrip(months, opts) {
    var options = opts || {},
      words = options.words || STRIP_WORDS,
      cells = stripGeometry(months, options.size || STRIP.size, options.gap || STRIP.gap);
    if (!cells.length) return '';
    var width = cells[cells.length - 1].x + cells[cells.length - 1].size;
    var desc =
      options.desc ||
      cells
        .map(function (cell) {
          return (cell.month.label || '') + ': ' + (words[stateOf(cell.month)] || STRIP_WORDS[stateOf(cell.month)]);
        })
        .join(', ');
    var labels = options.labels
      ? cells
          .map(function (cell) {
            return '<text x="' + (cell.x + cell.size / 2) + '" y="' + STRIP.labelAt + '" text-anchor="middle"' + codeAttr(options.codes, 'legend') + ' style="font:9px var(--mono,monospace);fill:var(--rp-actual)">' + escape(cell.month.label || '') + '</text>';
          })
          .join('')
      : '';
    var inner =
      cells
        .map(function (cell) {
          return stripSquare(cell, options.words, options.codes);
        })
        .join('') + labels;
    var height = options.labels ? STRIP.labelAt + 4 : cells[0].size + 2;
    return accessibleSvg(width, height, { id: options.id || 'cd-strip', tid: options.tid || 'cd-strip', title: options.title, desc: desc, palette: options.palette, codes: options.codes }, inner);
  }

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

  var CBDraw = {
    bars: bars,
    spark: spark,
    statusBar: statusBar,
    monthStrip: monthStrip,
    compare: compare,
    changeText: changeText,
    palette: palette,
    paletteNow: paletteNow,
    contrastRatio: contrastRatio,
    paletteStyle: paletteStyle,
    geometry: { status: statusGeometry, strip: stripGeometry },
    mix: mix
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CBDraw;
  if (root) root.CBDraw = CBDraw;
})(typeof window !== 'undefined' ? window : globalThis);
