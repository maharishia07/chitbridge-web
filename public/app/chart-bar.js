/* app/chart-bar.js — CBChartBar: THE OPTIONS BAR AT THE TOP OF EVERY CHART PAGE (chart engine step 2, 16 Nov 2026 · REQ PM/REQ-CHART-ENGINE-2026-11-16.md section 4).
 * CARD 26-reporting-mis-and-bi/charts
 * OWNER    cb-reports (palette and UI codes: cb-ux-locale; the pref keys: cb-settings)
 * RISK     a chart page that fails to load the engine shows one sentence and its table; a lost pref write is held pending and sent again, never lost
 * ID       CHT-BAR
 *
 * OWNS      mount(scope, options) — one sticky bar of four choices, the same everywhere: Colours (a menu: "Follow my avatar theme", then the combinations of CBDraw.COMBOS) ·
 *           Chart (a menu, only where the data fits more than one type; else a plain word) · the favourite star · the Readability switch. It applies the palette to the
 *           scope as --ch-* tokens (CBDraw.applyPalette), keeps the person's choices (CBChartCap.set → chart_theme · chart_read · chart_fav_<kind>) and tells the page to redraw
 *           with { combo, type, read } — the page draws, the bar never touches a figure.
 * CALLED BY app/cap-mis-trend.js (Reports › Trend) · app/cap-finance-cash.js (Cash). Loaded with the engine by CBChartCap.ready(), never by a tag.
 * FLOW      open → read chart_fav_<kind> (a favourite applies at once), else chart_theme; chart_read, else ON for the Colour Vision and high-contrast themes (the person chose them
 *           for readability) and OFF everywhere else → palette → onChange. A pick is saved at once; the star saves "<combination>-<type>" for this kind; switching Readability off returns the
 *           chosen colours (they are kept, never replaced).
 * UI CODES  each control wears its code on the element (data-cbsid) from CODES below, the ONE table of this bar. PROPOSED codes: the register row and the CMDB entry are cb-ux-locale's and
 *           cb-capability's to mint (toolset/ui-identity/ui-stamp.cjs); the library has no select, switch or star component yet (ui-find.cjs, 16 Nov), so these are native elements.
 */
(function (root) {
  'use strict';
  var CODES = { bar: 'CHB001-P01', colours: 'CHB001-S01', type: 'CHB001-S02', star: 'CHB001-B01', read: 'CHB001-I01' };
  var AUTO_READ_THEMES = ['contrast', 'hc', 'hcdark', 'cvd']; /* Contrast · High Contrast · High Contrast Dark · Colour Vision: chosen for readability */
  var TYPE_WORDS = { column: 'Columns', line: 'Line', bar: 'Ranked bars', stack: 'Stacked bar', pie: 'Pie', donut: 'Donut', area: 'Area', waterfall: 'Waterfall' };
  var FOLLOW = 'follow';

  function words(text) {
    return typeof root.tx === 'function' ? root.tx(text) : text;
  }
  function escapeText(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (char) {
      return '&#' + char.charCodeAt(0) + ';';
    });
  }
  /** a css colour (a var(), a color-mix()) as the rgb() the browser resolves it to, read off a probe under the scope */
  function resolved(scope, value) {
    var probe = root.document.createElement('span');
    probe.style.color = value;
    probe.style.display = 'none';
    scope.appendChild(probe);
    var colour = root.getComputedStyle(probe).color;
    scope.removeChild(probe);
    return colour;
  }
  /** the colour a chart sits on: the first non-transparent background at or above the scope */
  function pageOf(scope) {
    for (var node = scope; node && node.nodeType === 1; node = node.parentNode) {
      var colour = root.getComputedStyle(node).backgroundColor;
      if (colour && !/rgba?\(\s*0,\s*0,\s*0,\s*0\)|transparent/.test(colour)) return colour;
    }
    return 'rgb(255,255,255)';
  }
  /** the person's theme as the four colours the palette rules need */
  function tokensOf(scope) {
    var style = root.getComputedStyle(scope);
    return {
      page: pageOf(scope),
      ink: style.color,
      acc: resolved(scope, 'var(--accent,var(--blue,#1f5f5b))'),
      prog: resolved(scope, 'var(--prog,var(--muted,#6f6450))')
    };
  }
  /** the person's theme key (the avatar's own answer; the page's data-theme where the avatar is not loaded) */
  function themeKey() {
    var chosen = root.CBAvatar && root.CBAvatar.get ? root.CBAvatar.get().theme : '';
    return String(chosen || root.document.documentElement.getAttribute('data-theme') || '').toLowerCase();
  }
  /** Readability: the person's own setting; when they never set it, ON for the readability themes and OFF elsewhere (the larger crowd gets the vibrant default) */
  function readOf() {
    var own = root.CBChartCap.chosen('chart_read');
    if (own === 'on' || own === 'off') return own;
    return AUTO_READ_THEMES.indexOf(themeKey()) >= 0 ? 'on' : 'off';
  }
  /** the favourite of a kind as { combo, type }, or null: stored as "<combination>-<type>" */
  function favouriteOf(kind) {
    var text = root.CBChartCap.chosen('chart_fav_' + kind),
      at = text.lastIndexOf('-');
    return at > 0 ? { combo: text.slice(0, at), type: text.slice(at + 1) } : null;
  }
  function comboNames() {
    var names = [[FOLLOW, words('Follow my avatar theme')]];
    Object.keys(root.CBDraw.COMBOS).forEach(function (id) {
      names.push([id, root.CBDraw.COMBOS[id].name]);
    });
    return names;
  }
  function selectHtml(code, testid, label, options, current) {
    return (
      '<select data-cbsid="' + code + '" data-testid="' + testid + '" aria-label="' + escapeText(label) + '" title="' + escapeText(label) + '">' +
      options
        .map(function (option) {
          return '<option value="' + escapeText(option[0]) + '"' + (option[0] === current ? ' selected' : '') + '>' + escapeText(option[1]) + '</option>';
        })
        .join('') +
      '</select>'
    );
  }
  function barHtml(kind, types, state) {
    var typeOptions = types.map(function (type) {
      return [type, words(TYPE_WORDS[type] || type)];
    });
    return (
      '<div class="chart-bar" data-cbsid="' + CODES.bar + '" data-testid="chart-bar" data-kind="' + escapeText(kind) + '" role="group" aria-label="' + escapeText(words('Chart options')) + '">' +
      selectHtml(CODES.colours, 'chart-colours', words('Colours'), comboNames(), state.combo) +
      (types.length > 1
        ? selectHtml(CODES.type, 'chart-type', words('Chart type'), typeOptions, state.type)
        : '<span class="chart-bar-one" data-testid="chart-type-one">' + escapeText(typeOptions[0][1]) + '</span>') +
      '<button type="button" class="chart-bar-star" data-cbsid="' + CODES.star + '" data-testid="chart-fav" aria-pressed="false" aria-label="' + escapeText(words('Favourite')) + '" title="' + escapeText(words('Favourite: use this chart and these colours next time')) + '">☆</button>' +
      '<label class="chart-bar-read" title="' + escapeText(words('Readability: every mark clearly visible against the page')) + '"><input type="checkbox" data-cbsid="' + CODES.read + '" data-testid="chart-read"> ' + escapeText(words('Readability')) + '</label>' +
      '</div>'
    );
  }
  var STYLE =
    '.chart-bar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:6px 20px;background:var(--card,#fff);border-bottom:1px solid var(--line,#ddd);font-size:13px}' +
    '.chart-bar select{font:inherit;min-height:32px;max-width:46%;padding:2px 6px;border:1px solid var(--line,#ccc);border-radius:6px;background:var(--card,#fff);color:var(--ink,#222)}' +
    '.chart-bar-star{min-width:32px;min-height:32px;border:1px solid var(--line,#ccc);border-radius:6px;background:var(--card,#fff);color:var(--ink,#222);font-size:16px;line-height:1;cursor:pointer}' +
    '.chart-bar-star[aria-pressed="true"]{border-color:var(--ink,#222);font-weight:700}' +
    '.chart-bar-read{display:inline-flex;align-items:center;gap:4px;font-weight:600;color:var(--ink,#222);white-space:nowrap;min-height:32px}' +
    '.chart-bar-one{color:var(--muted,#555)}';
  function styleOnce() {
    var doc = root.document;
    if (doc.getElementById('chart-bar-style')) return;
    var node = doc.createElement('style');
    node.id = 'chart-bar-style';
    node.textContent = STYLE;
    (doc.head || doc.documentElement).appendChild(node);
  }

  /** what this person last chose for a kind: a favourite applies at once, else their colours; Readability as saved or by theme; a removed combination is "follow my avatar theme" */
  function savedChoice(kind, types) {
    var fav = favouriteOf(kind),
      choice = {
        combo: (fav && fav.combo) || root.CBChartCap.chosen('chart_theme') || FOLLOW,
        type: fav && types.indexOf(fav.type) >= 0 ? fav.type : types[0],
        read: readOf()
      };
    if (!root.CBDraw.COMBOS[choice.combo]) choice.combo = FOLLOW;
    return choice;
  }

  /** is this combination and type the person's favourite for the kind */
  function isFavourite(kind, state) {
    var current = favouriteOf(kind);
    return !!current && current.combo === state.combo && current.type === state.type;
  }

  /** the four controls' events: a pick is saved at once (CBChartCap.set), the state changes, the page is told to redraw */
  function bindBar(bar, state, kind, redraw) {
    var star = bar.querySelector('[data-testid="chart-fav"]'),
      read = bar.querySelector('[data-testid="chart-read"]'),
      typeMenu = bar.querySelector('[data-testid="chart-type"]');
    bar.querySelector('[data-testid="chart-colours"]').addEventListener('change', function (event) {
      state.combo = event.target.value;
      root.CBChartCap.set('chart_theme', state.combo === FOLLOW ? '' : state.combo);
      redraw();
    });
    if (typeMenu)
      typeMenu.addEventListener('change', function (event) {
        state.type = event.target.value;
        redraw();
      });
    star.addEventListener('click', function () {
      root.CBChartCap.set('chart_fav_' + kind, isFavourite(kind, state) ? '' : state.combo + '-' + state.type);
      redraw();
    });
    read.addEventListener('change', function () {
      state.read = read.checked ? 'on' : 'off';
      root.CBChartCap.set('chart_read', state.read);
      redraw();
    });
  }

  /**
   * mount(scope, options) → { state(), redraw() } — scope: the element that holds the bar and the chart (the palette is written on it); options { kind (one of CBDraw.KINDS), types
   * (the types the data fits, the first is the default), onChange({ combo, type, read, palette }) (the page redraws) }. The bar is put at the top of the scope.
   */
  function mount(scope, options) {
    styleOnce();
    var kind = options.kind,
      types = options.types && options.types.length ? options.types : ['column'],
      state = savedChoice(kind, types);
    var old = scope.querySelector('[data-testid="chart-bar"]');
    if (old) old.parentNode.removeChild(old);
    scope.insertAdjacentHTML('afterbegin', barHtml(kind, types, state));
    var bar = scope.querySelector('[data-testid="chart-bar"]'),
      read = bar.querySelector('[data-testid="chart-read"]'),
      typeMenu = bar.querySelector('[data-testid="chart-type"]'),
      star = bar.querySelector('[data-testid="chart-fav"]');
    read.checked = state.read === 'on';

    function redraw() {
      var palette = root.CBDraw.paletteOf(state.combo === FOLLOW ? '' : state.combo, tokensOf(scope), state.read);
      root.CBDraw.applyPalette(scope, palette, state.read);
      star.setAttribute('aria-pressed', isFavourite(kind, state) ? 'true' : 'false');
      star.textContent = isFavourite(kind, state) ? '★' : '☆';
      options.onChange({ combo: state.combo, type: state.type, read: state.read, palette: palette });
    }
    bindBar(bar, state, kind, redraw);
    /* the server's answer can land after the page drew: take the person's saved choices again, once */
    root.document.addEventListener('cb:chartprefs', function again() {
      root.document.removeEventListener('cb:chartprefs', again);
      if (!scope.contains(bar)) return;
      Object.assign(state, savedChoice(kind, types));
      bar.querySelector('[data-testid="chart-colours"]').value = state.combo;
      if (typeMenu) typeMenu.value = state.type;
      read.checked = state.read === 'on';
      redraw();
    });
    redraw();
    return { state: function () { return { combo: state.combo, type: state.type, read: state.read }; }, redraw: redraw };
  }

  root.CBChartBar = { mount: mount, CODES: CODES, AUTO_READ_THEMES: AUTO_READ_THEMES, readOf: readOf, tokensOf: tokensOf };
})(typeof window !== 'undefined' ? window : this);
