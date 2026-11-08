/**
 * ui-standard.js — THE UI STANDARD PAGE (UX-137): every component of the standard action set, drawn by the real ui.js factories,
 * with the popups, the icons, the tokens and the language switch. Nothing here is a picture of a component.
 *
 * OWNS       the page's model (what rows exist, the size presets, the census of old spellings, the translation coverage),
 *            the page chrome (tabs, switches) and the repaint when a switch changes. It owns no component: it calls ui.action / ui.dialog.
 * CALLED BY  public/ui-standard.html (screen APP002). Loaded AFTER helpers.js, accounts-shell.js (tx, CBAction, CBConfirm, toast),
 *            the string packs and ui.js.
 * READS      ui.components (CMP codes, labels, verbs), CBSTR (the packs), the CSS custom properties of the page (live), getComputedStyle.
 * WRITES     only this page's own DOM. It calls no api, reads no session or token, and stores nothing (no localStorage, no cookie).
 * CARD       29-qa-test-tooling-ux-locale-and-design-system/ui-action-set
 * FLOW       load -> paint() -> a switch sets state -> paint() again (the same strings run through tx() again: no reload).
 *
 * NOTE       ui.dialog needs modal() and closeModal(), which only app.html defines. This page defines the same small host (modal below);
 *            moving it to a shared file is a ui.js / accounts-shell change and is listed in the PR, not made here.
 */
var CBUiStandard = (function () {
  var SCREEN = 'APP002';
  var LANGS = [['en', 'English', 'ltr'], ['ta', 'தமிழ்', 'ltr'], ['hi', 'हिन्दी', 'ltr'], ['ar', 'العربية', 'rtl'], ['fr', 'Français', 'ltr']];
  var PACK_LANGS = ['ta', 'hi', 'ar', 'fr'];
  /** the size presets: the four tokens the action set draws from (px). 'small' is below the 24 px floor on purpose. */
  var PRESETS = {
    standard: { h: 44, pad: 20, radius: 9, font: 14, label: 'Standard' },
    compact: { h: 32, pad: 12, radius: 6, font: 13, label: 'Compact' },
    large: { h: 56, pad: 28, radius: 16, font: 17, label: 'Large' },
    small: { h: 20, pad: 6, radius: 3, font: 11, label: 'Too small' }
  };
  var SCREENS = { this: { label: 'This screen' }, desktop: { label: 'Desktop', w: 1366, h: 768 }, mobile: { label: 'Mobile', w: 390, h: 844 } };
  var TABS = ['components', 'popups', 'icons', 'tokens', 'before'];
  var TAB_LABEL = { components: 'Components', popups: 'Popups', icons: 'Icons', tokens: 'Tokens', before: 'Before and after' };
  /** the plain line each section opens with: what the standard is and why, in shopkeeper words */
  var TAB_LINE = {
    components: 'Every Save, Cancel or Done in the product is one and the same button, so it looks and works the same on every screen. The code beside it (like CMP001) is its name on a register, the way a bank screen has a code.',
    popups: 'Before anything is posted, sent or paid, the screen asks first and shows how far it reaches: how much, to whom, how many. Cancel sends nothing.',
    icons: 'One sign for one meaning. Today there is no icon font: the signs on buttons are typed characters, and the drawings are a separate set with no codes yet.',
    tokens: 'Colours, corners and sizes live in one place. Change a value and every button follows. The values below are read from this page as it is drawn, not typed in.',
    before: 'Counted in our own screens: the same action was written many different ways. Now each one is a single component. Numbers are the count of places that spelled it that way.'
  };
  /** old hand-made spellings found in the census (PM/UX-137-ROLLOUT.md section 3a): [label, sites] */
  var CENSUS = [
    { name: 'close', before: [['Close', 72], ['x', 16], ['X', 14], ['Not now', 6], ['Dismiss', 2], ['close', 2]] },
    { name: 'cancel', before: [['Cancel', 89]] },
    { name: 'save', before: [['Save', 31], ['Save and continue', 1], ['Save & continue', 1]] },
    { name: 'done', before: [['Done', 15], ['Got it', 6], ['OK', 5]] },
    { name: 'back', before: [['‹ Back', 8], ['Back', 7], ['‹', 1], ['arrow', 1], ['arrow back', 1]] },
    { name: 'reload', before: [['Try again', 18], ['Retry', 3], ['Reload', 1]] },
    { name: 'add', before: [['Add', 12], ['+ New', 2], ['+ Add', 2], ['New', 1], ['+ Add a rule', 1], ['+ add section', 1], ['+ add detail', 1], ['add', 1]] }
  ];
  /** the component rows: which factory, the object the accessible name carries, and the options a real mount would give it */
  var MOCK = { amount: 1180, currency: 'INR', recipients: ['Asha Traders', 'Mohan Stores', 'Kavya Foods'], lines: 2 };
  var ROWS = [
    { name: 'save', variant: 'preference', object: 'settings', opts: { effect: 'preference' } },
    { name: 'save', variant: 'commit', object: 'bill', opts: { effect: 'commit' }, confirmKind: 'post' },
    { name: 'cancel', object: 'edit', opts: {} },
    { name: 'done', object: 'step', opts: {} },
    { name: 'close', object: '', opts: {} },
    { name: 'back', object: '', opts: {} },
    { name: 'add', object: 'row', opts: {} },
    { name: 'remove', object: 'row', opts: {}, confirmKind: 'remove' },
    { name: 'reload', object: 'list', opts: {} },
    { name: 'open', object: 'guide', opts: {} }
  ];
  var TOKENS = [
    ['--act-h', 'Button height'], ['--act-pad', 'Side padding'], ['--act-radius', 'Corner radius'], ['--act-font', 'Text size'],
    ['--act-weight', 'Text weight'], ['--accent', 'Fill of the main button'], ['--accent-ink', 'Text on that fill'],
    ['--accent-text', 'Text of the quiet button'], ['--line', 'Border of the quiet button'], ['--focus', 'Focus ring'], ['--card', 'Surface']
  ];
  var ILLUSTRATIONS = [
    ['compose-author.svg', 'Compose / author'], ['draft.svg', 'Draft'], ['chit-bridged.svg', 'Chit bridged'], ['status-update.svg', 'Status update'],
    ['archive-sunset.svg', 'Archive (sunset)'], ['message-update.svg', 'Message update'], ['forward.svg', 'Forward'], ['attachment.svg', 'Attachment'],
    ['priority-sla.svg', 'Priority / SLA'], ['dispute-flag.svg', 'Dispute flag'], ['empty-inbox.svg', 'Empty list'], ['no-results.svg', 'No results']
  ];
  var state = { lang: 'en', theme: 'light', screen: 'this', size: 'standard', overlay: false, tab: 'components' };
  var counters = { mount: 0, control: 0 };

  /* ── words: the page's own strings through tx(), the language held in the page (never in storage) ── */
  function words(text) {
    return tx(text);
  }
  function formatWords(text, values) {
    return txf(text, values);
  }
  function mountCode() {
    counters.mount += 1;
    return SCREEN + '-U' + String(counters.mount).padStart(2, '0');
  }
  /** the page's own controls (switches, tabs): native buttons with a stable code, APP002-B01.. in reading order */
  function controlCode() {
    counters.control += 1;
    return SCREEN + '-B' + String(counters.control).padStart(2, '0');
  }
  /** which of the four packs hold this exact text (the English is the key); a glyph-only name needs none */
  function translatedIn(text) {
    return PACK_LANGS.filter(function (lang) {
      return !!(CBSTR[lang] && CBSTR[lang][text]);
    });
  }
  /** one component's translation coverage: its label (the accessible name) and its visible text, per pack */
  function coverageOf(component) {
    var label = translatedIn(component.label);
    var shown = component.nameOnly ? PACK_LANGS : translatedIn(component.shown);
    return { label: label, shown: shown, missing: PACK_LANGS.filter(function (lang) { return label.indexOf(lang) < 0 || shown.indexOf(lang) < 0; }) };
  }
  /** WCAG contrast ratio of two css rgb() strings */
  function channels(colourText) {
    var found = String(colourText).match(/[\d.]+/g) || [0, 0, 0];
    return found.slice(0, 3).map(Number);
  }
  function luminance(colourText) {
    var parts = channels(colourText).map(function (value) {
      var unit = value / 255;
      return unit <= 0.03928 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
  }
  function contrastRatio(first, second) {
    var lighter = Math.max(luminance(first), luminance(second)), darker = Math.min(luminance(first), luminance(second));
    return (lighter + 0.05) / (darker + 0.05);
  }

  /* ── the dialog host ui.dialog needs (same classes as app.html's modal) ── */
  function closeModal() {
    var host = document.getElementById('modalhost');
    if (host) host.innerHTML = '';
  }
  function modal(html, wide) {
    var host = document.getElementById('modalhost');
    host.innerHTML =
      '<div class="mover" data-testid="gal-mover"><div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="mxrow">' + ui.action('close', { mount: SCREEN + '-D01-U01', onPress: closeModal, testid: 'gal-dialog-x' }) + '</div>' + html + '</div></div>';
    host.querySelector('.mover').addEventListener('click', function (event) {
      if (event.target.classList.contains('mover')) closeModal();
    });
  }
  function openExampleDialog() {
    ui.dialog({
      mount: SCREEN + '-D01-U02',
      title: 'Example dialog',
      body: '<p>' + esc(words('This is the one dialog shell. Its buttons are the standard set.')) + '</p>',
      actions: [
        { name: 'cancel', options: { mount: SCREEN + '-D01-U03', testid: 'gal-dialog-cancel' } },
        { name: 'done', options: { mount: SCREEN + '-D01-U04', onPress: closeModal, testid: 'gal-dialog-done' } }
      ]
    });
  }
  /** the reach of a commit: amount with its currency, who, and how many; shown before anything is sent */
  function reachConfirm(kind) {
    if (kind === 'remove') {
      return { title: words('Remove this supplier?'), body: '<p>' + esc(formatWords('Remove {name} from this list?', { name: MOCK.recipients[0] })) + '</p>', yes: words('Remove') };
    }
    var amount = fmtMoney(MOCK.amount, MOCK.currency) + ' (' + MOCK.currency + ')';
    return {
      title: words('Post this bill?'),
      body: '<p>' + esc(formatWords('Post this bill for {amount} to {count} recipients?', { amount: amount, count: MOCK.recipients.length })) +
        '</p><p>' + esc(MOCK.recipients.join(' · ')) + '</p>',
      yes: words('Post bill'),
      danger: false
    };
  }
  function mockPress() {
    toast(words('Done'));
  }

  /* ── the component rows ── */
  /** what each non-default state adds to the options: a role gate, busy, or the static hover / focus / pressed look */
  function stateExtras(which) {
    var extras = {
      disabled: { role: { ok: false, why: words('Disabled') } },
      busy: { busy: true },
      hover: { data: { demo: 'hover' } },
      focus: { data: { demo: 'focus' } },
      pressed: { data: { demo: 'pressed' } }
    };
    return extras[which] || {};
  }
  function stateOptions(row, which) {
    var base = Object.assign({ mount: mountCode(), testid: 'gal-' + ui.components[row.name].code + '-' + (row.variant || 'std') + '-' + which }, row.opts, stateExtras(which));
    if (row.object) base.object = row.object;
    if (row.confirmKind) base.confirm = reachConfirm(row.confirmKind);
    if (which === 'default' && (row.confirmKind || row.opts.effect)) base.onPress = mockPress;
    return base;
  }
  var STATES = ['default', 'hover', 'focus', 'pressed', 'disabled', 'busy'];
  function stateCell(row, which) {
    return '<figure class="st"><div class="slot">' + ui.action(row.name, stateOptions(row, which)) + '</div><figcaption>' + esc(words(which.charAt(0).toUpperCase() + which.slice(1))) + '</figcaption></figure>';
  }
  function coverageHTML(component) {
    var coverage = coverageOf(component);
    var ok = coverage.missing.length === 0;
    var bits = PACK_LANGS.map(function (lang) {
      return '<span class="' + (coverage.missing.indexOf(lang) < 0 ? 'yes' : 'no') + '">' + lang + (coverage.missing.indexOf(lang) < 0 ? ' ✓' : ' ✗') + '</span>';
    }).join(' ');
    return '<span class="cov' + (ok ? '' : ' gap') + '" data-testid="gal-cov-' + component.code + '" title="keyed: no (tx English text today; CMPnnn.label keys wait for ux137-i18n-keys)">' + bits + '</span>';
  }
  function componentRow(row) {
    var component = ui.components[row.name];
    var fcode = component.verb + ' ' + (row.object || 'dialog');
    return '<section class="crow" data-testid="gal-row-' + component.code + (row.variant ? '-' + row.variant : '') + '">' +
      '<div class="cid"><span class="chip" data-cbsid="' + SCREEN + '" data-testid="gal-code">' + component.code + '</span>' +
      '<b>' + esc(words(component.label)) + (row.variant ? ' · ' + esc(row.variant) : '') + '</b>' +
      '<span class="meta" data-testid="gal-fcode"><span class="mono">' + component.element + '</span> · fcode <span class="mono">' + esc(fcode) + '</span> · ' + esc(component.tone) + '</span>' +
      coverageHTML(component) + '</div><div class="states">' + STATES.map(function (which) { return stateCell(row, which); }).join('') + '</div></section>';
  }
  function dialogRow() {
    var component = ui.components.dialog;
    return '<section class="crow" data-testid="gal-row-CMP002"><div class="cid"><span class="chip" data-testid="gal-code">CMP002</span><b>' + esc(words('Example dialog')) + '</b>' +
      '<span class="meta" data-testid="gal-fcode"><span class="mono">' + component.element + '</span> · fcode <span class="mono">SHOW dialog</span></span></div>' +
      '<div class="states"><figure class="st"><div class="slot">' + ui.action('open', { mount: mountCode(), object: 'dialog', onPress: openExampleDialog, testid: 'gal-open-dialog' }) +
      '</div><figcaption>ui.dialog()</figcaption></figure></div></section>';
  }
  function componentsPanel() {
    var rows = ROWS.map(componentRow);
    rows.splice(1, 0, dialogRow());
    return rows.join('');
  }

  /* ── popups ── */
  function popupRow(title, note, button) {
    return '<section class="crow"><div class="cid"><b>' + esc(words(title)) + '</b><span class="meta">' + esc(note) + '</span></div><div class="states"><figure class="st"><div class="slot">' + button + '</div></figure></div></section>';
  }
  function popupsPanel() {
    var press = function () {
      mockPress();
    };
    return popupRow('Example dialog', 'ui.dialog() · CMP002 · modal shell, X, Cancel and Done',
      ui.action('open', { mount: mountCode(), object: 'dialog', onPress: openExampleDialog, testid: 'gal-open-dialog-2' })) +
      popupRow('Post this bill?', 'CMP001 commit · CBConfirm · amount + currency, recipients, count',
        ui.action('save', { mount: mountCode(), object: 'bill', effect: 'commit', confirm: reachConfirm('post'), onPress: press, testid: 'gal-open-commit' })) +
      popupRow('Remove this supplier?', 'CMP008 commit · CBConfirm · always asks',
        ui.action('remove', { mount: mountCode(), object: 'supplier', confirm: reachConfirm('remove'), onPress: press, testid: 'gal-open-remove' })) +
      '<p class="note">CBConfirm still draws its own Cancel and OK buttons (accounts-shell.js), not CMP003 and CMP004: found, listed for its owner.</p>';
  }

  /* ── icons ── */
  function iconsPanel() {
    var glyphs = Object.keys(ui.components).filter(function (name) {
      var component = ui.components[name];
      return component.shown && /^[^A-Za-z]/.test(component.shown);
    }).map(function (name) {
      var component = ui.components[name];
      return '<figure class="ic" data-testid="gal-icon-' + component.code + '"><div class="glyph" aria-hidden="true">' + esc(component.shown) + '</div><figcaption><b>' + esc(words(component.label)) +
        '</b><span class="mono">' + component.element + '</span></figcaption></figure>';
    }).join('');
    var drawings = ILLUSTRATIONS.map(function (item) {
      return '<figure class="ic" data-testid="gal-art"><img src="/illustrations/' + item[0] + '" alt="" loading="lazy" width="96" height="64"><figcaption><b>' + esc(item[1]) +
        '</b><span class="mono">' + item[0] + '</span></figcaption></figure>';
    }).join('');
    return '<h3>' + esc(words('Icons')) + ' · typed signs (ui.js ACTION_SET)</h3><div class="icgrid">' + glyphs + '</div>' +
      '<h3>Drawings · public/illustrations (no code yet)</h3><div class="icgrid">' + drawings + '</div>';
  }

  /* ── tokens: read live ── */
  function tokenRow(token) {
    var value = getComputedStyle(document.documentElement).getPropertyValue(token[0]).trim();
    var isColour = /^#|^rgb/.test(value);
    return '<tr data-testid="gal-token"><td class="mono">' + token[0] + '</td><td>' + esc(words(token[1])) + '</td><td class="mono">' +
      (isColour ? '<span class="sw" style="background:' + esc(value) + '"></span>' : '') + esc(value) + '</td></tr>';
  }
  function tokensPanel() {
    return '<table class="tok"><thead><tr><th>Token</th><th>' + esc(words('What it sets')) + '</th><th>' + esc(words('Value')) + '</th></tr></thead><tbody>' + TOKENS.map(tokenRow).join('') + '</tbody></table>' +
      '<h3>' + esc(words('Measured')) + '</h3><div class="meas">' +
      ui.action('done', { mount: mountCode(), object: 'step', testid: 'gal-measure-primary' }) + ' ' +
      ui.action('cancel', { mount: mountCode(), object: 'edit', testid: 'gal-measure-quiet' }) + '</div><div id="measure" data-testid="gal-measure"></div>';
  }
  function paintMeasure() {
    var host = document.getElementById('measure');
    if (!host) return;
    var scale = currentScale();
    var lines = [['gal-measure-primary', 'Done'], ['gal-measure-quiet', 'Cancel']].map(function (pair) {
      var button = document.querySelector('[data-testid="' + pair[0] + '"]');
      var style = getComputedStyle(button), box = button.getBoundingClientRect();
      var fill = style.backgroundColor.slice(-4) === ', 0)' ? getComputedStyle(document.documentElement).getPropertyValue('--card') : style.backgroundColor;
      var ratio = contrastRatio(style.color, /^#/.test(fill.trim()) ? hexToRgb(fill.trim()) : fill);
      return '<div class="mline"><b>' + esc(words(pair[1])) + '</b> ' + Math.round(box.width / scale) + '×' + Math.round(box.height / scale) + ' px · radius ' + style.borderRadius + ' · padding ' + style.paddingLeft +
        ' · font ' + style.fontSize + ' · ' + esc(words('Contrast')) + ' ' + ratio.toFixed(1) + ':1 ' + (ratio >= 4.5 ? 'AA ✓' : 'AA ✗') + '</div>';
    });
    host.innerHTML = lines.join('');
  }
  function hexToRgb(hexText) {
    var value = hexText.replace('#', '');
    if (value.length === 3) value = value.split('').map(function (digit) { return digit + digit; }).join('');
    return 'rgb(' + [0, 2, 4].map(function (start) { return parseInt(value.substr(start, 2), 16); }).join(',') + ')';
  }

  /* ── before and after ── */
  function beforePanel() {
    return CENSUS.map(function (entry) {
      var component = ui.components[entry.name];
      var old = entry.before.map(function (pair) {
        return '<span class="old" data-testid="gal-old">' + esc(pair[0]) + ' <small>×' + pair[1] + '</small></span>';
      }).join('');
      return '<section class="crow" data-testid="gal-before-' + entry.name + '"><div class="cid"><span class="chip">' + component.code + '</span><b>' + esc(words(component.label)) + '</b><span class="meta">' +
        entry.before.length + ' → 1</span></div><div class="ba"><div class="bcol"><h4>' + esc(words('Before')) + '</h4>' + old + '</div><div class="bcol"><h4>' + esc(words('After')) + '</h4>' +
        ui.action(entry.name, { mount: mountCode(), object: entry.name === 'save' ? 'settings' : '', effect: entry.name === 'save' ? 'preference' : undefined }) + '</div></div></section>';
    }).join('');
  }

  /* ── chrome: header controls ── */
  function segment(group, items, current, extra) {
    return '<div class="seg" role="group" aria-label="' + esc(words(extra.label)) + '"><span class="seglabel">' + esc(words(extra.label)) + '</span>' + items.map(function (item) {
      return '<button type="button" data-cbsid="' + controlCode() + '" data-g="' + group + '" data-v="' + item[0] + '" aria-pressed="' + (item[0] === current) + '" data-testid="gal-' + group + '-' + item[0] + '"' +
        (item[2] ? ' lang="' + item[2] + '"' : '') + '>' + esc(item[1]) + '</button>';
    }).join('') + '</div>';
  }
  function headerHTML() {
    counters.control = 0;
    var langs = LANGS.map(function (lang) { return [lang[0], lang[1], lang[0]]; });
    var themes = [['light', words('Light')], ['dark', words('Dark')]];
    var screens = Object.keys(SCREENS).map(function (key) { return [key, words(SCREENS[key].label) + (SCREENS[key].w ? ' ' + SCREENS[key].w + '×' + SCREENS[key].h : '')]; });
    var sizes = Object.keys(PRESETS).map(function (key) { return [key, words(PRESETS[key].label) + ' ' + PRESETS[key].h]; });
    var overlay = [['on', '24 px'], ['off', '—']];
    var tabs = TABS.map(function (tabName) {
      return '<button type="button" role="tab" data-cbsid="' + controlCode() + '" data-g="tab" data-v="' + tabName + '" aria-selected="' + (tabName === state.tab) + '" data-testid="gal-tab-' + tabName + '">' + esc(words(TAB_LABEL[tabName])) + '</button>';
    }).join('');
    return '<div class="hrow"><h1>' + esc(words('UI standard')) + '</h1><span class="chip" data-cbsid="' + SCREEN + '" data-testid="gal-screen-code" title="Screen code">' + SCREEN + '</span></div>' +
      '<div class="hrow ctl">' + segment('lang', langs, state.lang, { label: 'Language' }) + segment('theme', themes, state.theme, { label: 'Theme' }) + segment('screen', screens, state.screen, { label: 'Screen' }) +
      segment('size', sizes, state.size, { label: 'Size' }) + segment('overlay', overlay, state.overlay ? 'on' : 'off', { label: '24 px target' }) + '</div>' +
      '<div class="hrow tabs" role="tablist">' + tabs + '</div>';
  }

  /* ── the 24 px target overlay: a dashed 24 by 24 box centred on every control, red when the control is smaller ── */
  function currentScale() {
    var frame = document.getElementById('frame');
    return frame && frame.offsetWidth ? frame.getBoundingClientRect().width / frame.offsetWidth : 1;
  }
  function paintOverlay() {
    var content = document.getElementById('content');
    var old = content.querySelector('.ovl');
    if (old) old.remove();
    if (!state.overlay) return;
    var layer = document.createElement('div');
    layer.className = 'ovl';
    layer.setAttribute('aria-hidden', 'true');
    var scale = currentScale(), origin = content.getBoundingClientRect();
    content.querySelectorAll('button').forEach(function (button) {
      var box = button.getBoundingClientRect();
      if (!box.width) return;
      var width = box.width / scale, height = box.height / scale;
      var tag = document.createElement('i');
      tag.className = width >= 24 && height >= 24 ? 'ok' : 'bad';
      tag.setAttribute('data-testid', 'gal-target-' + tag.className);
      tag.style.cssText = 'left:' + ((box.left - origin.left) / scale + (width - 24) / 2) + 'px;top:' + ((box.top - origin.top) / scale + (height - 24) / 2) + 'px';
      tag.title = Math.round(width) + '×' + Math.round(height) + ' px';
      layer.appendChild(tag);
    });
    content.appendChild(layer);
  }

  /* ── fit: the frame for the chosen screen, scaled to the room there is; no page scroll ── */
  function fitFrame() {
    var stage = document.getElementById('stage'), frame = document.getElementById('frame'), box = SCREENS[state.screen];
    var header = document.getElementById('hdr');
    document.documentElement.style.setProperty('--hdr-h', header.offsetHeight + 'px');
    stage.classList.toggle('framed', !!box.w);
    if (!box.w) {
      frame.style.cssText = '';
      stage.style.cssText = '';
      return;
    }
    stage.classList.toggle('framed', true);
    var room = stage.getBoundingClientRect();
    var scale = Math.min((room.width - 16) / box.w, (room.height - 16) / box.h, 1);
    frame.style.cssText = 'width:' + box.w + 'px;height:' + box.h + 'px;transform:scale(' + scale + ');transform-origin:top left;flex:none';
    stage.style.cssText = 'display:block;padding:8px;overflow:hidden';
    frame.parentNode.style.cssText = '';
    frame.style.marginRight = -(box.w * (1 - scale)) + 'px';
    frame.style.marginBottom = -(box.h * (1 - scale)) + 'px';
  }

  /* ── paint: the whole page again, from state ── */
  function applyState() {
    var root = document.documentElement, preset = PRESETS[state.size];
    window.cbLang = function () { return state.lang; };
    root.setAttribute('lang', state.lang);
    root.setAttribute('dir', LANGS.filter(function (lang) { return lang[0] === state.lang; })[0][2]);
    root.setAttribute('data-theme', state.theme);
    root.style.setProperty('--act-h', preset.h + 'px');
    root.style.setProperty('--act-pad', preset.pad + 'px');
    root.style.setProperty('--act-radius', preset.radius + 'px');
    root.style.setProperty('--act-font', preset.font + 'px');
  }
  function panelHTML() {
    var panels = { components: componentsPanel, popups: popupsPanel, icons: iconsPanel, tokens: tokensPanel, before: beforePanel };
    return '<p class="line" data-testid="gal-line">' + esc(words(TAB_LINE[state.tab])) + '</p>' + panels[state.tab]();
  }
  function paint() {
    counters.mount = 0;
    applyState();
    document.getElementById('hdr').innerHTML = headerHTML();
    document.getElementById('content').innerHTML = panelHTML();
    fitFrame();
    paintMeasure();
    paintOverlay();
    if (document.querySelector('#modalhost .mover')) openExampleDialog();
  }
  function onSwitch(event) {
    var button = event.target.closest && event.target.closest('[data-g]');
    if (!button) return;
    var group = button.getAttribute('data-g'), value = button.getAttribute('data-v');
    if (group === 'lang') state.lang = value;
    else if (group === 'theme') state.theme = value;
    else if (group === 'screen') state.screen = value;
    else if (group === 'size') state.size = value;
    else if (group === 'overlay') state.overlay = value === 'on';
    else if (group === 'tab') state.tab = value;
    paint();
  }
  function start() {
    document.addEventListener('click', onSwitch);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeModal();
    });
    window.addEventListener('resize', function () {
      fitFrame();
      paintOverlay();
    });
    window.modal = modal;
    window.closeModal = closeModal;
    paint();
  }
  return { start: start, state: state, ROWS: ROWS, CENSUS: CENSUS, PRESETS: PRESETS, TOKENS: TOKENS, LANGS: LANGS, coverageOf: coverageOf, translatedIn: translatedIn, contrastRatio: contrastRatio, paint: paint };
})();
if (typeof document !== 'undefined' && document.getElementById && document.getElementById('frame')) CBUiStandard.start();
