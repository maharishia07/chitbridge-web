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
  var TABS = ['components', 'popups', 'icons', 'tokens', 'themes', 'before'];
  var TAB_LABEL = { components: 'Components', popups: 'Popups', icons: 'Icons', tokens: 'Tokens', themes: 'Across themes', before: 'Before and after' };
  /** the plain line each section opens with: what the standard is and why, in shopkeeper words */
  var TAB_LINE = {
    components: 'Every Save, Cancel or Done in the product is one and the same button, so it looks and works the same on every screen. The code beside it (like CMP001) is its name on a register, the way a bank screen has a code.',
    popups: 'Before anything is posted, sent or paid, the screen asks first and shows how far it reaches: how much, to whom, how many. Cancel sends nothing.',
    icons: 'One sign for one meaning. Today there is no icon font: the signs on buttons are typed characters, and the drawings are a separate set with no codes yet.',
    tokens: 'Colours, corners and sizes live in one place. Change a value and every button follows. The values below are read from this page as it is drawn, not typed in.',
    themes: 'The avatar offers 16 colour themes. Each row is a real theme applied through the avatar code, measured on the real buttons: a red figure is a pair below the accessibility minimum.',
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
  var state = { lang: 'en', screen: 'this', size: 'standard', overlay: false, tab: 'components' };
  /** the page's switches that simply set one state key; the 24 px overlay is the only one with its own rule */
  var STATE_KEYS = ['screen', 'size', 'tab'];
  var avatarOptions = null, avatarHandle = null;
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
    if (/^#/.test(String(colourText).trim())) colourText = hexToRgb(String(colourText).trim());
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
  /** what the toast says for each press: the result in words, in the chosen language; a remove also offers Undo in the same bar */
  var RESULTS = { post: 'Bill posted', remove: 'Supplier removed', save: 'Settings saved' };
  /**
   * CBAction.run says a bare "Done" when the press returns (ui.js passes it no sentence), so the result is said one tick later and replaces it.
   * ui.js should pass done / outcome through to CBAction.run; until then this is the page's own way to show the standard.
   */
  function resultToast(kind) {
    setTimeout(function () {
      var undo = kind === 'remove' ? function () { toast(words('Supplier restored')); } : null;
      toast(words(RESULTS[kind]), undo);
    }, 0);
  }
  function pressFor(kind) {
    return function () {
      resultToast(kind);
    };
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
    if (which === 'default' && (row.confirmKind || row.opts.effect)) base.onPress = pressFor(row.confirmKind || 'save');
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
    return popupRow('Example dialog', 'ui.dialog() · CMP002 · modal shell, X, Cancel and Done',
      ui.action('open', { mount: mountCode(), object: 'dialog', onPress: openExampleDialog, testid: 'gal-open-dialog-2' })) +
      popupRow('Post this bill?', 'CMP001 commit · CBConfirm · amount + currency, recipients, count',
        ui.action('save', { mount: mountCode(), object: 'bill', effect: 'commit', confirm: reachConfirm('post'), onPress: pressFor('post'), testid: 'gal-open-commit' })) +
      popupRow('Remove this supplier?', 'CMP008 commit · CBConfirm · always asks',
        ui.action('remove', { mount: mountCode(), object: 'supplier', confirm: reachConfirm('remove'), onPress: pressFor('remove'), testid: 'gal-open-remove' })) +
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
    return '<p class="note" data-testid="gal-icon-rule">Rule for the icon set (UX-140): draw every icon in currentColor, so it follows each theme, the quiet and busy states and Dark. The typed signs below do (they are text); the drawings keep their own fixed palette and do not.</p><h3>' + esc(words('Icons')) + ' · typed signs (ui.js ACTION_SET)</h3><div class="icgrid">' + glyphs + '</div>' +
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
      '<h3>' + esc(words('Type')) + '</h3><div id="typebox" data-testid="gal-type"></div>' +
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

  /* ── type: what is actually drawn, measured on real buttons (never declared) ── */
  var SCRIPT_FACES = {
    en: ['Inter', 'Segoe UI', 'Arial'],
    fr: ['Inter', 'Segoe UI', 'Arial'],
    ta: ['Inter', 'Nirmala UI', 'Latha', 'Vijaya', 'Noto Sans Tamil', 'Segoe UI', 'Arial Unicode MS'],
    hi: ['Inter', 'Nirmala UI', 'Mangal', 'Kokila', 'Noto Sans Devanagari', 'Segoe UI', 'Arial Unicode MS'],
    ar: ['Inter', 'Segoe UI', 'Tahoma', 'Arial', 'Noto Naskh Arabic', 'Noto Sans Arabic', 'Times New Roman']
  };
  var MIN_LABEL_PX = 14;
  function probeBox() {
    return document.getElementById('probe');
  }
  function widthOf(sample, stack) {
    var node = document.createElement('span');
    node.style.cssText = 'font:48px/1 ' + stack + ';white-space:nowrap';
    node.textContent = sample;
    probeBox().appendChild(node);
    var width = node.getBoundingClientRect().width;
    node.remove();
    return width;
  }
  /** a face draws the sample only if naming it changes the width against both generic fallbacks (a width probe: document.fonts.check cannot see system faces) */
  function drawsSample(sample, face) {
    var named = '"' + face + '"';
    return widthOf(sample, named + ',monospace') !== widthOf(sample, 'monospace') && widthOf(sample, named + ',serif') !== widthOf(sample, 'serif');
  }
  /** the first face of this page's own stack, then the usual system faces of the script, that has glyphs for the sample */
  function faceThatDraws(lang) {
    var sample = (lang === 'en' ? 'SaveCancelDone' : (CBSTR[lang].Save || '') + (CBSTR[lang].Cancel || '')).replace(/\s/g, ''); /* no space: a space exists in every face and would pass the probe */
    var ownFaces = getComputedStyle(document.body).fontFamily.split(',').map(function (name) { return name.trim().replace(/^["']|["']$/g, ''); });
    var names = ownFaces.filter(function (name) { return !/^(system-ui|-apple-system|sans-serif|serif|monospace)$/.test(name); }).concat(SCRIPT_FACES[lang]);
    var found = names.filter(function (name, index) { return names.indexOf(name) === index && drawsSample(sample, name); })[0];
    return { sample: sample, face: found || 'a system fallback the page does not name' };
  }
  function faceRowHTML(lang) {
    var drawn = faceThatDraws(lang);
    return '<tr data-testid="gal-face-' + lang + '"><th scope="row">' + lang + '</th><td lang="' + lang + '">' + esc(drawn.sample) + '</td><td class="mono">' + esc(drawn.face) +
      (drawn.face === 'Inter' || /Grotesk|Mono/.test(drawn.face) ? '' : ' ◂ ' + esc(words('not the product face'))) + '</td></tr>';
  }
  /** the real size, weight, line height and face of a rendered button's text (the line box from a Range, so 'normal' is a number) */
  function typeOf(button) {
    var style = getComputedStyle(button), range = document.createRange();
    range.selectNodeContents(button);
    return { face: style.fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: parseFloat(style.fontSize), weight: style.fontWeight, line: range.getBoundingClientRect().height };
  }
  function typeRowHTML(entry) {
    var measured = typeOf(entry.node), small = measured.size < MIN_LABEL_PX;
    return '<tr data-testid="gal-type-row"><th scope="row">' + esc(entry.label) + '</th><td class="mono">' + esc(measured.face) + '</td><td class="' + (small ? 'fail' : '') + '" data-testid="' +
      (small ? 'gal-type-small' : 'gal-type-ok') + '">' + measured.size.toFixed(1) + ' px' + (small ? ' ✗ under ' + MIN_LABEL_PX : '') + '</td><td>' + measured.weight + '</td><td>' + measured.line.toFixed(1) + ' px</td></tr>';
  }
  /** every component's button, then this page's own switches (12 px: a finding, they are not components) */
  function typeEntries() {
    var entries = [];
    document.querySelectorAll('#probe [data-testid^="gal-type-probe-"]').forEach(function (node) {
      var component = ui.components[node.getAttribute('data-testid').split('-')[3]];
      entries.push({ label: component.code + ' ' + words(component.label), node: node });
    });
    var chrome = document.querySelector('#hdr .seg button');
    if (chrome) entries.push({ label: 'APP002 page switches (not a component)', node: chrome });
    return entries;
  }
  function typeProbesHTML() {
    return ROWS.map(function (row, index) {
      var options = Object.assign({ mount: SCREEN + '-U' + (80 + index), testid: 'gal-type-probe-' + row.name + '-' + index, object: row.object || undefined }, row.opts);
      if (row.confirmKind) options.confirm = reachConfirm(row.confirmKind);
      return ui.action(row.name, options);
    }).join('');
  }
  function paintType() {
    var host = document.getElementById('typebox');
    if (!host) return;
    var probes = document.createElement('div');
    probes.innerHTML = typeProbesHTML();
    probeBox().appendChild(probes);
    var rows = typeEntries().map(typeRowHTML).join('');
    probes.remove();
    var faces = LANGS.map(function (lang) { return faceRowHTML(lang[0]); }).join('');
    host.innerHTML = '<table class="tok"><thead><tr><th>' + esc(words('Code')) + '</th><th>Face</th><th>Size</th><th>' + esc(words('Weight')) + '</th><th>Line</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<h4>Which face drew each language</h4><table class="tok"><tbody>' + faces + '</tbody></table>';
  }
  /** the product's faces come from Google Fonts like app.html loads them; repaint once they have arrived */
  function whenFacesLoad() {
    if (!document.fonts || !document.fonts.load) return;
    Promise.all(['14px Inter', '14px "Space Grotesk"', '14px "Space Mono"'].map(function (face) { return document.fonts.load(face); }))
      .then(paint)
      .catch(function (error) {
        console.warn('ui-standard: the product faces did not load, the page shows its fallback', (error && error.message) || error);
      });
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
    var screens = Object.keys(SCREENS).map(function (key) { return [key, words(SCREENS[key].label) + (SCREENS[key].w ? ' ' + SCREENS[key].w + '×' + SCREENS[key].h : '')]; });
    var sizes = Object.keys(PRESETS).map(function (key) { return [key, words(PRESETS[key].label) + ' ' + PRESETS[key].h]; });
    var overlay = [['on', '24 px'], ['off', '—']];
    var tabs = TABS.map(function (tabName) {
      return '<button type="button" role="tab" data-cbsid="' + controlCode() + '" data-g="tab" data-v="' + tabName + '" aria-selected="' + (tabName === state.tab) + '" data-testid="gal-tab-' + tabName + '">' + esc(words(TAB_LABEL[tabName])) + '</button>';
    }).join('');
    return '<div class="hrow"><h1>' + esc(words('UI standard')) + '</h1><span class="chip" data-cbsid="' + SCREEN + '" data-testid="gal-screen-code" title="Screen code">' + SCREEN + '</span><span class="hint" data-testid="gal-hint">' + esc([words('Theme'), words('Font'), words('Text size'), words('Weight'), words('Language')].join(' · ')) + ' ▸</span></div>' +
      '<div class="hrow ctl">' + segment('screen', screens, state.screen, { label: 'Screen' }) +
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

  /* ── the themes: each one applied through the avatar's own code and measured on the real buttons ── */
  function probeHTML() {
    return ui.action('done', { mount: SCREEN + '-U90', object: 'step', testid: 'gal-probe-primary' }) + ui.action('cancel', { mount: SCREEN + '-U91', object: 'edit', testid: 'gal-probe-quiet' });
  }
  function probeNode(name) {
    return document.querySelector('[data-testid="gal-probe-' + name + '"]');
  }
  /** the pairs of the standard in the theme now on the page: [name, foreground, background, minimum ratio, criterion] */
  function pairsNow() {
    var page = getComputedStyle(document.body).backgroundColor, done = getComputedStyle(probeNode('primary')), quiet = getComputedStyle(probeNode('quiet'));
    var focus = getComputedStyle(document.documentElement).getPropertyValue('--focus').trim();
    return [
      ['Done text', done.color, done.backgroundColor, 4.5, '1.4.3'],
      ['Quiet text', quiet.color, page, 4.5, '1.4.3'],
      ['Page text', getComputedStyle(document.body).color, page, 4.5, '1.4.3'],
      ['Done fill', done.backgroundColor, page, 3, '1.4.11'],
      ['Quiet border', quiet.borderTopColor, page, 3, '1.4.11'],
      ['Focus ring', focus, page, 3, '1.4.11']
    ];
  }
  function swatchesNow() {
    var style = getComputedStyle(document.documentElement);
    return ['--page', '--card', '--ink', '--accent'].map(function (token) { return style.getPropertyValue(token).trim(); });
  }
  /** every theme, one after the other: the figures per pair, then the page's own theme is put back */
  function auditAll() {
    var table = window.CBScreen.APP_THEMES, rows = [], saved = window.CBAvatar.get().theme;
    document.getElementById('probe').innerHTML = probeHTML();
    Object.keys(table).forEach(function (key) {
      window.CBAvatar.applyWith({ theme: key });
      rows.push({
        key: key,
        name: table[key].name,
        swatches: swatchesNow(),
        pairs: pairsNow().map(function (pair) {
          var ratio = contrastRatio(pair[1], pair[2]);
          return { name: pair[0], ratio: ratio, min: pair[3], rule: pair[4], ok: ratio >= pair[3] };
        })
      });
    });
    window.CBAvatar.applyWith({ theme: saved });
    return rows;
  }
  function themeRowHTML(row) {
    var swatches = row.swatches.map(function (colour) { return '<span class="sw" style="background:' + esc(colour) + '"></span>'; }).join('');
    var cells = row.pairs.map(function (pair) {
      return '<td class="' + (pair.ok ? 'pass' : 'fail') + '" data-testid="gal-pair-' + (pair.ok ? 'ok' : 'fail') + '" title="' + pair.rule + ' ≥ ' + pair.min + ':1">' + pair.ratio.toFixed(1) + (pair.ok ? '' : ' ✗') + '</td>';
    }).join('');
    return '<tr data-testid="gal-theme-row"><th scope="row">' + swatches + esc(row.name) + '</th>' + cells + '</tr>';
  }
  function themesPanel() {
    var rows = auditAll();
    var heads = rows[0].pairs.map(function (pair) { return '<th title="' + pair.rule + '">' + esc(pair.name) + '<br><small>' + pair.rule + ' · ' + pair.min + ':1</small></th>'; }).join('');
    return '<table class="tok themes"><thead><tr><th>' + esc(words('Theme')) + '</th>' + heads + '</tr></thead><tbody>' + rows.map(themeRowHTML).join('') + '</tbody></table>';
  }

  /* ── paint: the whole page again, from state ── */
  function applyState() {
    var root = document.documentElement, preset = PRESETS[state.size];
    window.cbLang = function () { return state.lang; };
    root.setAttribute('lang', state.lang);
    root.setAttribute('dir', LANGS.filter(function (lang) { return lang[0] === state.lang; })[0][2]);
    root.style.setProperty('--act-h', preset.h + 'px');
    root.style.setProperty('--act-pad', preset.pad + 'px');
    root.style.setProperty('--act-radius', preset.radius + 'px');
    root.style.setProperty('--act-font', preset.font + 'px');
  }
  function panelHTML() {
    var panels = { components: componentsPanel, popups: popupsPanel, icons: iconsPanel, tokens: tokensPanel, themes: themesPanel, before: beforePanel };
    return '<p class="line" data-testid="gal-line">' + esc(words(TAB_LINE[state.tab])) + '</p>' + panels[state.tab]();
  }
  function paint() {
    counters.mount = 0;
    applyState();
    document.getElementById('probe').innerHTML = probeHTML();
    document.getElementById('hdr').innerHTML = headerHTML();
    document.getElementById('content').innerHTML = panelHTML();
    fitFrame();
    paintMeasure();
    paintType();
    paintOverlay();
    if (document.querySelector('#modalhost .mover')) openExampleDialog();
  }
  function onSwitch(event) {
    var button = event.target.closest && event.target.closest('[data-g]');
    if (!button || button.tagName === 'SELECT' || button.tagName === 'OPTION') return;
    chooseValue(button.getAttribute('data-g'), button.getAttribute('data-v'));
  }
  function onChange(event) {
    if (event.target.tagName === 'SELECT' && event.target.getAttribute('data-g')) chooseValue(event.target.getAttribute('data-g'), event.target.value);
  }
  function chooseValue(group, value) {
    if (STATE_KEYS.indexOf(group) >= 0) state[group] = value;
    else if (group === 'overlay') state.overlay = value === 'on';
    paint();
  }
  /** the REAL avatar panel (CBAvatar.mount), on a fixed-look page: every pick is applied and reported here, none is saved; it also owns the language here */
  function mountAvatar() {
    var list = {};
    LANGS.forEach(function (lang) { list[lang[0]] = lang[1]; });
    avatarOptions = {
      person: { name: 'Preview', role: 'nothing is saved', owner: false },
      items: [],
      sync: false,
      pull: false,
      testid: 'avatar',
      languages: { list: list, current: state.lang, onPick: pickLanguage },
      onLook: paint
    };
    avatarHandle = window.CBAvatar.mount(document.getElementById('avatarhost'), avatarOptions);
  }
  function pickLanguage(code) {
    state.lang = code;
    avatarOptions.languages.current = code;
    paint();
    avatarHandle.update(avatarOptions.person);
  }
  function start() {
    document.addEventListener('click', onSwitch);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeModal();
    });
    window.addEventListener('resize', function () {
      fitFrame();
      paintOverlay();
    });
    mountAvatar();
    window.modal = modal;
    window.closeModal = closeModal;
    paint();
    whenFacesLoad();
  }
  return { start: start, state: state, ROWS: ROWS, CENSUS: CENSUS, PRESETS: PRESETS, TOKENS: TOKENS, LANGS: LANGS, coverageOf: coverageOf, translatedIn: translatedIn, contrastRatio: contrastRatio, paint: paint, audit: auditAll };
})();
if (typeof document !== 'undefined' && document.getElementById && document.getElementById('frame')) CBUiStandard.start();
