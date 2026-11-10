/**
 * ui.js — THE STANDARD ACTION SET AND ITS FACTORIES (UX-137, DISCIPLINES §3a). One component per everyday action
 * (Save, Done, Cancel, Close, Back, Add, Remove, Reload, Open); a screen never hand-writes the markup, it MOUNTS one.
 * Improve a component here and every mount on every screen improves.
 *
 * OWNS       ui.progress (CMP020 progress, CMP021 bar, CMP022 spinner: three levels, see PROGRESS) · ui.action(name, options) -> the button's HTML string · ui.dialog(options) -> opens through modal() ·
 *            ACTION_SET (the components: code, label key, verb, effect, tones) · the one delegated press listener.
 * CALLED BY  a page script that draws a button: settings.html (cap-settings.js policy Save/Cancel, cap-print.js Save).
 * WIDENS     CBAction.run (accounts-shell.js: busy, one press one write, confirm:) for the press, and modal()/closeModal()
 *            (app.html) for the dialog. It adds no second confirm dialog and no second dialog path.
 * KEYBOARD   a native <button>: Tab reaches it, Enter and Space press it, the focus ring is the theme's; Esc closes a dialog (modal()) and so
 *            leaves Cancel/Close/Not now unpressed; Enter on a form commits through its Save only; a disabled action stays focusable-visible with its reason.
 * REGISTER   each component is CMP### in SCREENS.json with its own element CMP###-B01; each use is a mount
 *            <screen>-U## written as data-cbmount; the element carries data-cbsid = the component element code.
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/ui-action-set
 * FLOW       none (a drawing library). Spec: PM/UX-137-ROLLOUT.md sections 3a, 8 and C (factories).
 *
 * THE RULES IT ENFORCES (it throws, because silence is the bug):
 *   - an unknown component, a property outside the schema, or an override of a fixed one is refused;
 *   - a SAVE must say what it is: effect 'preference' (a plain preference save or an autosave: no confirm) or
 *     'commit' (post, send, pay, approve, mint: confirms first, with its reach). REMOVE is always a commit;
 *   - a commit with a handler of its own (onPress) needs a confirm {title, body, yes}; a commit whose page handler
 *     already confirms says so with confirmedBy: 'page' (legacy handlers move to onPress, one at a time).
 */
var CBUi = (function () {
  var MOUNT_CODE = /^[A-Z]{3}\d{3}(?:-D\d{2})?-U\d{2,3}$/; /* two digits at least: the UI standard page alone mounts more than 99 (19 components x 6 states) */
  var TONES = ['primary', 'quiet'];
  var EFFECTS = ['none', 'preference', 'commit'];
  var ALLOWED_OPTIONS = [
    'mount', 'object', 'tone', 'hidden', 'disabled', 'busy', 'role', 'key', 'effect', 'confirm',
    'confirmedBy', 'onPress', 'id', 'testid', 'data', 'surface', 'expanded', 'display', 'size'
  ];
  /* ICONS (Athi 10 Nov): one icon per component; the look of a mount is a property, 'icon' (icon alone) or 'icon+label'. Icon alone is allowed only for these seven
     (close, search, add, menu, back, edit, help) and never for a commit (money and data actions always say what they do); it always sits in a 44 px target
     with an aria-label and a tooltip. Everything else shows icon and label. */
  var ICON = {
    save: '✓', cancel: '✕', done: '✓', close: '✕', back: '‹', add: '+', remove: '−', reload: '↻', open: '↗', delete: '🗑', edit: '✎',
    search: '⌕', clear: '✕', notnow: '⏳', help: '?', info: 'ⓘ', more: '⋯', screenhelp: '?'
  };
  var ICON_ONLY = ['close', 'search', 'add', 'more', 'back', 'edit', 'help', 'screenhelp'];
  var DISPLAYS = ['icon', 'icon+label'];
  /* TAP SIZE (Athi 10 Nov): a target under 24 px is never drawn. Standard is 44 px and is the default; compact is 32 px, for dense lists on a wide screen only;
     on a phone width a compact mount is lifted to 44 px; the 44 is a MINIMUM (a page that sets --act-h larger keeps it, and the UI standard page's deliberately small preset is still drawn small). One stylesheet, written here, so the size is changed in one place. */
  var SIZES = ['standard', 'compact'];
  var SIZE_CSS =
    '[data-cbname]{min-height:var(--act-h,44px);min-width:var(--act-h,44px)}' +
    '[data-cbname][data-size="compact"]{min-height:32px;min-width:32px}' +
    '@media(max-width:700px){[data-cbname][data-size="compact"]{min-height:max(44px,var(--act-h,44px));min-width:max(44px,var(--act-h,44px))}}';
  function ensureStyle() {
    if (typeof document === 'undefined' || !document.head || !document.createElement || document.getElementById('cbui-css')) return;
    var node = document.createElement('style');
    node.id = 'cbui-css';
    node.textContent = SIZE_CSS;
    document.head.appendChild(node);
  }
  /* CSS class per tone and surface: a page uses the small apps' .act family, a dialog footer uses the modal's own .pri / .danger */
  var TONE_CLASS = {
    page: { primary: 'act', quiet: 'act ghost' },
    dialog: { primary: 'pri', quiet: '', danger: 'danger' },
    /* a host that already styles its own button family keeps that look: the surface names the family, the component stays one */
    chip: { primary: 'optchip', quiet: 'optchip' },
    list: { primary: 'cbl-btn', quiet: 'cbl-btn' },
    bar: { primary: 'cbsid-help', quiet: 'cbsid-help' }
  };
  /**
   * The components. label is the English tx() key; shown is the visible text (icon or glyph where the width is tight);
   * verb is the fcode verb (closed list in docs toolset/ui-identity/ui-stamp.cjs VERBS); effect null = the mount must declare it.
   */
  var ACTION_SET = {
    save: { code: 'CMP001', element: 'CMP001-B01', label: 'Save', shown: 'Save', verb: 'SAVE', effect: null, effectFixed: false, tone: 'primary' },
    dialog: { code: 'CMP002', element: 'CMP002-D01', label: 'Dialog', verb: 'OPEN', effect: 'none', effectFixed: true, tone: 'primary' },
    cancel: { code: 'CMP003', element: 'CMP003-B01', label: 'Cancel', shown: 'Cancel', verb: 'CANCEL', effect: 'none', effectFixed: true, tone: 'quiet' },
    done: { code: 'CMP004', element: 'CMP004-B01', label: 'Done', shown: 'Done', verb: 'CLOSE', effect: 'none', effectFixed: true, tone: 'primary' },
    close: { code: 'CMP005', element: 'CMP005-B01', label: 'Close', shown: '✕', verb: 'CLOSE', effect: 'none', effectFixed: true, tone: 'quiet', nameOnly: true },
    back: { code: 'CMP006', element: 'CMP006-B01', label: 'Back', shown: '‹ Back', verb: 'CLOSE', effect: 'none', effectFixed: true, tone: 'quiet' },
    add: { code: 'CMP007', element: 'CMP007-B01', label: 'Add', shown: '+ Add', verb: 'ADD', effect: 'none', effectFixed: false, tone: 'quiet', nameOnly: false },
    remove: { code: 'CMP008', element: 'CMP008-B01', label: 'Remove', shown: 'Remove', verb: 'REMOVE', effect: 'commit', effectFixed: true, tone: 'quiet' },
    reload: { code: 'CMP009', element: 'CMP009-B01', label: 'Try again', shown: 'Try again', verb: 'RELOAD', effect: 'none', effectFixed: true, tone: 'quiet' },
    open: { code: 'CMP010', element: 'CMP010-B01', label: 'Open', shown: 'Open', verb: 'OPEN', effect: 'none', effectFixed: true, tone: 'quiet' },
    /* the eight of section 3a that CMP001..CMP018 did not yet carry. Delete destroys the record (always a commit, always asks, in the danger style);
       Change is Edit unless it picks a value from a list (Athi 10 Nov); Not now DEFERS and is not Close (Athi 10 Nov); Search/Clear are the list toolbar's two plain actions. */
    delete: { code: 'CMP011', element: 'CMP011-B01', label: 'Delete', shown: 'Delete', verb: 'REMOVE', effect: 'commit', effectFixed: true, tone: 'quiet', danger: true },
    edit: { code: 'CMP012', element: 'CMP012-B01', label: 'Edit', shown: '✎ Edit', verb: 'CHANGE', effect: 'none', effectFixed: true, tone: 'quiet' },
    search: { code: 'CMP013', element: 'CMP013-B01', label: 'Search', shown: '⌕ Search', verb: 'ENTER', effect: 'none', effectFixed: true, tone: 'quiet' },
    clear: { code: 'CMP014', element: 'CMP014-B01', label: 'Clear', shown: '✕ Clear', verb: 'REMOVE', effect: 'none', effectFixed: true, tone: 'quiet' },
    notnow: { code: 'CMP015', element: 'CMP015-B01', label: 'Not now', shown: 'Not now', verb: 'CLOSE', effect: 'none', effectFixed: true, tone: 'quiet' },
    help: { code: 'CMP016', element: 'CMP016-B01', label: 'Help', shown: '?', verb: 'OPEN', effect: 'none', effectFixed: true, tone: 'quiet', nameOnly: true },
    info: { code: 'CMP017', element: 'CMP017-B01', label: 'Info', shown: 'ⓘ Info', verb: 'OPEN', effect: 'none', effectFixed: true, tone: 'quiet' },
    /* Athi 10 Nov: ONE "?" at a FIXED place on every screen (WCAG 2.2 3.2.6 Consistent Help), 44 px target, shown only when HELP_TEXT holds a note for the screen */
    screenhelp: { code: 'CMP019', element: 'CMP019-B01', label: 'Help for this screen', shown: '?', verb: 'OPEN', effect: 'none', effectFixed: true, tone: 'quiet', nameOnly: true, tooltip: true },
    /* Athi 10 Nov: ONE progress component, three levels (see PROGRESS below). Its two parts are components too: the bar (CMP021) and the spinner (CMP022). None is a button. */
    progress: { code: 'CMP020', element: 'CMP020-D01', label: 'Progress', verb: 'OPEN', effect: 'none', effectFixed: true, tone: 'primary', nonButton: true },
    progressbar: { code: 'CMP021', element: 'CMP021-D01', label: 'Progress bar', verb: 'OPEN', effect: 'none', effectFixed: true, tone: 'primary', nonButton: true },
    spinner: { code: 'CMP022', element: 'CMP022-D01', label: 'Spinner', verb: 'OPEN', effect: 'none', effectFixed: true, tone: 'quiet', nonButton: true },
    more: { code: 'CMP018', element: 'CMP018-B01', label: 'More', shown: '⋯', verb: 'OPEN', effect: 'none', effectFixed: true, tone: 'quiet', nameOnly: true, popup: 'menu' }
  };
  Object.keys(ACTION_SET).forEach(function (key) {
    ACTION_SET[key].name = key;
  });
  var HANDLERS = {};

  /** English through the catalogue; with a key (CMP001.label) the translation is found by the key and English is only the default */
  function words(text, key) {
    if (typeof tx !== 'function') return text;
    return key ? tx(text, { key: key }) : tx(text);
  }
  /** a sentence with {placeholders} (ICU style): translated by its key, the values put in after */
  function phrase(english, key, values) {
    if (typeof txf === 'function') return txf(english, values, { key: key });
    return english.replace(/\{(\w+)\}/g, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : whole;
    });
  }
  /** the stable key of one text of a component: CMP001.label, CMP001.shown, CMP001.aria (the register's code, never the English words) */
  function textKey(component, part) {
    return component.code + '.' + part;
  }
  function escapeText(text) {
    if (typeof esc === 'function') return esc(text);
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }
  function refuse(reason) {
    throw new Error('ui.action: ' + reason);
  }
  /** the look properties: surface, size and display (icon alone only where the rule allows it) */
  function checkLook(name, component, options) {
    if (options.surface && !TONE_CLASS[options.surface]) refuse(name + ': surface must be page, dialog, chip, list or bar');
    if (options.size && SIZES.indexOf(options.size) < 0) refuse(name + ': size must be standard or compact');
    if (options.display && DISPLAYS.indexOf(options.display) < 0) refuse(name + ': display must be icon or icon+label');
    var iconAlone = options.display === 'icon';
    if (iconAlone && (ICON_ONLY.indexOf(name) < 0 || component.effect === 'commit')) {
      refuse(name + ': icon alone is for close, search, add, menu, back, edit and help only; this action shows icon and label');
    }
  }
  /** a property outside the schema, or one that only the component fixes, is refused (never silently dropped) */
  function checkOptions(name, component, options) {
    Object.keys(options).forEach(function (property) {
      if (ALLOWED_OPTIONS.indexOf(property) < 0) refuse(name + ': "' + property + '" is not a property of the component');
    });
    if (!MOUNT_CODE.test(options.mount || '')) refuse(name + ': mount must be a screen mount code like ACC002-U01');
    checkLook(name, component, options);
    if (options.tone && TONES.indexOf(options.tone) < 0) refuse(name + ': tone must be primary or quiet');
    if (options.effect && EFFECTS.indexOf(options.effect) < 0) refuse(name + ': effect must be none, preference or commit');
    if (options.effect && component.effectFixed && options.effect !== component.effect) refuse(name + ': effect is fixed at ' + component.effect);
  }
  /** what the press does for the person: none, a plain preference save, or a commit that asks first */
  function effectOf(name, component, options) {
    var effect = options.effect || component.effect;
    if (!effect) refuse(name + ': say effect "preference" or "commit" (a Save is one or the other)');
    if (effect === 'commit' && !options.confirm && options.confirmedBy !== 'page') {
      refuse(name + ': a commit confirms first: give confirm {title, body, yes} (the reach), or confirmedBy "page" while its handler asks');
    }
    return effect;
  }
  function attributeList(pairs) {
    return pairs
      .filter(function (pair) {
        return pair[1] !== null && pair[1] !== undefined && pair[1] !== false;
      })
      .map(function (pair) {
        return pair[1] === true ? pair[0] : pair[0] + '="' + escapeText(pair[1]) + '"';
      })
      .join(' ');
  }
  /** the data-* bag of one mount, e.g. { 'pol-act': 'save' } -> data-pol-act="save" */
  function dataAttributes(values) {
    return Object.keys(values || {}).map(function (suffix) {
      return ['data-' + suffix, String(values[suffix])];
    });
  }
  /** the role gate { ok, why }: a refused action stays visible, greyed WITH its sentence (show-action rule) */
  function gateAttributes(role) {
    if (!role || role.ok !== false) return [];
    return [['disabled', true], ['aria-disabled', 'true'], ['title', role.why || '']];
  }
  function toneClass(options, component, surface) {
    var tone = options.tone || component.tone;
    var classes = TONE_CLASS[surface];
    return classes[tone] !== undefined ? classes[tone] : classes.primary;
  }
  /** the accessible name: the label plus the object when one is given ("Save" + "policy" -> "Save policy"); an icon-only action always has one */
  function displayOf(component, options) {
    return options.display || (component.nameOnly ? 'icon' : null);
  }
  function accessibleName(component, options) {
    if (options.object) return phrase(component.label + ' {object}', textKey(component, 'aria'), { object: words(options.object) });
    return displayOf(component, options) === 'icon' ? words(component.label, textKey(component, 'label')) : null;
  }
  /** one press handler per mount (+ key), found again by the single delegated listener below */
  function registerPress(options) {
    if (typeof options.onPress !== 'function') return;
    HANDLERS[options.mount + '|' + (options.key || '')] = options;
  }
  /** the attributes of one button, in reading order; a null value is left out by attributeList */
  function buttonAttributes(component, options, surface, effect) {
    return [
      ['data-cbsid', component.element],
      ['data-cbname', component.name],
      ['data-cbmount', options.mount],
      ['data-effect', effect === 'none' ? null : effect],
      ['type', 'button'],
      ['class', toneClass(options, component, surface) || null],
      ['style', options.hidden ? 'display:none' : null],
      ['id', options.id || null],
      ['data-testid', options.testid || null],
      ['aria-label', accessibleName(component, options)],
      ['data-key', options.key || null],
      ['aria-busy', options.busy ? 'true' : null]
    ]
      .concat(lookAttributes(component, options))
      .concat(gateAttributes(options.role))
      .concat(dataAttributes(options.data));
  }
  /** the tooltip of an icon alone, the compact size, and the menu a More opens */
  function lookAttributes(component, options) {
    var tooltip = component.tooltip || displayOf(component, options) === 'icon';
    return [
      ['title', tooltip ? accessibleName(component, options) : null],
      ['data-size', options.size === 'compact' ? 'compact' : null],
      ['aria-haspopup', component.popup || null],
      ['aria-expanded', component.popup ? String(!!options.expanded) : null]
    ];
  }
  /** the visible text: a glyph stays as written, a word goes through tx() */
  function shownText(component, options) {
    var look = displayOf(component, options || {});
    if (look === 'icon') return escapeText(options && options.display === 'icon' ? ICON[component.name] : component.shown);
    if (look === 'icon+label') return escapeText(withIcon(component, labelText(component)));
    return escapeText(component.nameOnly ? component.shown : labelText(component));
  }
  /** the words of a component: a glyph-only one says its label, the others their visible text, both through their keys */
  function labelText(component) {
    return component.nameOnly ? words(component.label, textKey(component, 'label')) : words(component.shown, textKey(component, 'shown'));
  }
  /** icon and label: the one icon in front, unless the text already carries it */
  function withIcon(component, text) {
    var icon = ICON[component.name];
    return text.indexOf(icon) < 0 ? icon + ' ' + text : text;
  }
  /** the button's HTML for a surface ('page' or 'dialog'); the one place the markup of an action is written */
  function render(name, options, surface) {
    var component = ACTION_SET[name];
    if (!component || name === 'dialog' || component.nonButton) refuse('unknown action "' + name + '"');
    options = options || {};
    checkOptions(name, component, options);
    var effect = effectOf(name, component, options);
    registerPress(options);
    ensureStyle();
    var html = '<button ' + attributeList(buttonAttributes(component, options, surface, effect)) + '>' + shownText(component, options) + '</button>';
    /* born accessible: a visible text and an accessible name, always (the axe rules label-title-only and button-name cannot return through a component) */
    if (!shownText(component, options).trim()) refuse(name + ': no visible text');
    return html;
  }
  function action(name, options) {
    return render(name, options, (options && options.surface) || 'page');
  }
  /** a footer button: the same component, drawn in the modal's own button classes */
  function dialogAction(name, options) {
    return render(name, options, 'dialog');
  }
  /** runs the registered press through CBAction (busy, one press one write, and the confirm for a commit) */
  function press(button, options) {
    var pressHandler = function () {
      return options.onPress(button);
    };
    var key = options.mount + (options.key ? '-' + options.key : '');
    var effect = button.getAttribute('data-effect');
    /* a plain press (Cancel, Back, Open) has no busy state and no outcome sentence: only a write goes through CBAction */
    if (!effect || typeof CBAction === 'undefined' || !CBAction || typeof CBAction.run !== 'function') return pressHandler();
    return CBAction.run(button, pressHandler, effect === 'commit' ? { key: key, confirm: confirmOf(button, options) } : { key: key });
  }
  /** a Delete always asks in the danger style, whatever the mount wrote */
  function confirmOf(button, options) {
    var confirmation = options.confirm;
    var component = ACTION_SET[button.getAttribute('data-cbname')];
    return confirmation && component && component.danger ? Object.assign({}, confirmation, { danger: true }) : confirmation;
  }
  function onDocumentClick(event) {
    var button = event.target && event.target.closest && event.target.closest('[data-cbmount]');
    if (!button || button.disabled) return;
    var options = HANDLERS[button.getAttribute('data-cbmount') + '|' + (button.getAttribute('data-key') || '')];
    if (options) press(button, options);
  }
  /** a footer entry { name, options }: Cancel and Close close the dialog unless the mount gave its own press */
  function footerAction(item) {
    var options = Object.assign({}, item.options);
    var closes = item.name === 'cancel' || item.name === 'close';
    if (closes && typeof options.onPress !== 'function' && typeof closeModal === 'function') options.onPress = closeModal;
    return dialogAction(item.name, options);
  }
  /**
   * ui.dialog({ mount, title, body, actions: [{ name, ...action options }], wide, onClose }) — opens through the app's
   * modal(); the corner X is modal()'s own .mx. Actions are standard components only, Cancel/Close first, the primary last.
   */
  function dialog(options) {
    options = options || {};
    if (typeof modal !== 'function') refuse('dialog: no modal() on this page');
    if (!MOUNT_CODE.test(options.mount || '')) refuse('dialog: mount must be a screen mount code like ACC002-U01');
    var list = options.actions || [];
    if (list.length > 4) refuse('dialog: at most 4 actions');
    var footer = list.map(footerAction).join('');
    modal(
      '<div class="mhd" data-cbsid="' + ACTION_SET.dialog.element + '" data-cbmount="' + escapeText(options.mount) + '"><div class="t">' +
        escapeText(words(options.title)) +
        '</div></div><div class="mbody">' +
        (options.body || '') +
        '</div><div class="mfoot">' +
        footer +
        '</div>',
      !!options.wide,
      options.opt
    );
  }
  /* ── CMP020 PROGRESS (Athi 10 Nov): one component, three levels (Nielsen response-time limits, Apple HIG, Material).
     1  under about 1 s  nothing shows: the indicator waits PROGRESS_DELAY_MS, so a quick reply never flashes
     2  1 to 10 s        inline: the pressed button goes busy (spinner CMP022 + words), disabled, no second press; a list uses CBList's own skeleton rows
     3  over 10 s        a panel through ui.dialog: a bar (CMP021) or "Step n of m", one plain line, Cancel only when the caller gives a safe cancel
     The words sit in a role=status aria-live=polite region (WCAG 4.1.3); the panel takes focus and gives it back. Colours are theme tokens only. */
  var PROGRESS_DELAY_MS = 400;
  var PROGRESS_CSS =
    '.cbp-spin{display:inline-block;width:1em;height:1em;margin-inline-end:.5em;vertical-align:-.15em;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:cbp-turn .8s linear infinite}' +
    '@keyframes cbp-turn{to{transform:rotate(360deg)}}' +
    '.cbp-bar{height:10px;border-radius:5px;background:var(--line);overflow:hidden;margin:12px 0}' +
    '.cbp-fill{display:block;height:100%;background:var(--accent);transition:width .2s}' +
    '.cbp-bar[data-indeterminate] .cbp-fill{width:40%;animation:cbp-slide 1.2s ease-in-out infinite alternate}' +
    '@keyframes cbp-slide{to{transform:translateX(150%)}}' +
    '.cbp-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
    '@media (prefers-reduced-motion:reduce){.cbp-spin,.cbp-fill{animation:none;transition:none}}';
  var panelCount = 0;
  function ensureProgressStyle() {
    if (typeof document === 'undefined' || !document.head || !document.createElement || document.getElementById('cbp-css')) return;
    var node = document.createElement('style');
    node.id = 'cbp-css';
    node.textContent = PROGRESS_CSS;
    document.head.appendChild(node);
  }
  /** CMP022: the spinner, decorative (the words beside it carry the meaning) */
  function spinnerHtml() {
    ensureProgressStyle();
    return '<span class="cbp-spin" data-cbsid="' + ACTION_SET.spinner.element + '" aria-hidden="true"></span>';
  }
  /** CMP021: the bar; a number of steps or a total makes it determinate (aria-valuenow/min/max), otherwise it slides */
  function barHtml(model) {
    ensureProgressStyle();
    var known = model.max > 0;
    var percent = known ? Math.round((100 * model.now) / model.max) : 0;
    var values = known ? ' aria-valuemin="0" aria-valuemax="' + model.max + '" aria-valuenow="' + model.now + '"' : ' data-indeterminate="true"';
    return '<div class="cbp-bar" role="progressbar" data-cbsid="' + ACTION_SET.progressbar.element + '" aria-label="' + escapeText(model.label) + '"' + values + '><span class="cbp-fill" style="width:' + percent + '%"></span></div>';
  }
  /** the one polite live region of the page: what a screen reader hears when a button goes busy or a panel ends */
  function announce(text) {
    if (typeof document === 'undefined' || !document.body || !document.createElement) return;
    var region = document.getElementById('cbp-live');
    if (!region) {
      region = document.createElement('div');
      region.id = 'cbp-live';
      region.className = 'cbp-live';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    region.textContent = text;
  }
  /** LEVEL 2: the button goes busy after the delay (spinner and words), and comes back on stop(). One press: it is disabled at once. */
  function inline(button, label, delay) {
    var saved = null;
    var ownedBusy = button.getAttribute('aria-busy') !== 'true';
    if (ownedBusy) {
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
    }
    var timer = setTimeout(function () {
      saved = button.innerHTML;
      button.innerHTML = spinnerHtml() + escapeText(label);
      announce(label);
    }, delayOf(delay));
    return {
      stop: function () {
        clearTimeout(timer);
        if (saved !== null) button.innerHTML = saved;
        if (ownedBusy) {
          button.removeAttribute('aria-busy');
          button.disabled = false;
        }
      }
    };
  }
  /** LEVEL 1 + 2 through CBAction.run: the write runs once, the busy look starts after the delay, a confirm (if any) is asked first */
  function runInline(button, work, options) {
    options = options || {};
    var label = words(options.label || 'Working…', textKey(ACTION_SET.progress, 'working'));
    var wrapped = function () {
      var busy = inline(button, label, options.delay);
      return Promise.resolve().then(work).then(
        function (value) { busy.stop(); return value; },
        function (error) { busy.stop(); throw error; }
      );
    };
    if (typeof CBAction === 'undefined' || !CBAction || typeof CBAction.run !== 'function') return wrapped();
    return CBAction.run(button, wrapped, Object.assign({}, options.run));
  }
  /** the words under the bar: "Step 2 of 4" for steps, "30 of 120" for a total, nothing when the length is unknown */
  function countText(model) {
    if (!(model.max > 0)) return '';
    if (model.steps) return phrase('Step {n} of {m}', textKey(ACTION_SET.progress, 'step'), { n: model.now, m: model.max });
    return phrase('{n} of {total}', textKey(ACTION_SET.progress, 'count'), { n: model.now, total: model.max });
  }
  function panelBody(model) {
    return '<div data-cbprogress="' + model.id + '" tabindex="-1"><div role="status" aria-live="polite"><p class="cbp-line">' + escapeText(model.line) + '</p><p class="cbp-count">' + escapeText(countText(model)) + '</p></div>' + barHtml(model) + '</div>';
  }
  function panelRoot(model) {
    return typeof document === 'undefined' ? null : document.querySelector('[data-cbprogress="' + model.id + '"]');
  }
  /** repaint the open panel in place (focus stays); a panel the person closed is simply not there */
  function paintPanel(model) {
    var root = panelRoot(model);
    if (!root) return;
    root.querySelector('.cbp-line').textContent = model.line;
    root.querySelector('.cbp-count').textContent = countText(model);
    var bar = root.querySelector('[role="progressbar"]');
    if (bar && model.max > 0) {
      bar.setAttribute('aria-valuenow', String(model.now));
      bar.firstChild.style.width = Math.round((100 * model.now) / model.max) + '%';
    }
  }
  function openPanel(model, options) {
    ensureProgressStyle();
    model.opener = typeof document !== 'undefined' ? document.activeElement : null;
    var cancelAction = typeof options.cancel === 'function' ? [{ name: 'cancel', options: { mount: options.mount, key: 'cancel', onPress: function () { model.finished = true; closeModal(); options.cancel(); } } }] : [];
    dialog({ mount: options.mount, title: model.label, body: panelBody(model), actions: cancelAction });
    var root = panelRoot(model);
    if (root && root.focus) root.focus();
    model.opened = true;
  }
  function closePanel(model) {
    if (model.opened && typeof closeModal === 'function') closeModal();
    if (model.opener && model.opener.isConnected && model.opener.focus) model.opener.focus();
  }
  /** a failure stays on the panel in words, with Done to close it (opened first if the delay had not passed) */
  function failPanel(model, options, message) {
    if (!model.opened) openPanel(model, options);
    model.line = message || words('That did not finish', textKey(ACTION_SET.progress, 'failed'));
    paintPanel(model);
    var root = panelRoot(model);
    if (!root) return;
    root.querySelector('[role="progressbar"]').hidden = true;
    var foot = root.closest('.modal').querySelector('.mfoot');
    if (foot) foot.innerHTML = dialogAction('done', { mount: options.mount, key: 'fail', onPress: function () { closePanel(model); } });
  }
  /** the state of one panel: its words, its length (steps or total, 0 = unknown) and where it is */
  function progressModel(options) {
    var label = words(options.label || 'Working…', textKey(ACTION_SET.progress, 'working'));
    return { id: 'p' + panelCount, label: label, line: options.line || '', max: options.steps || options.total || 0, now: 0, steps: !!options.steps, opened: false, finished: false };
  }
  /** the wait before anything shows: the default unless the caller (a test, a demo) says 0 */
  function delayOf(delay) {
    return delay == null ? PROGRESS_DELAY_MS : delay;
  }
  /**
   * LEVEL 3: ui.progress.start({ mount, label, steps | total, line, cancel, delay }) -> { step(line), set(n, line), done(), fail(message) }.
   * Nothing shows for the first delay (400 ms); then a panel with the bar or "Step n of m". Cancel appears only when the caller passes a safe cancel().
   */
  function startProgress(options) {
    options = options || {};
    if (!MOUNT_CODE.test(options.mount || '')) refuse('progress: mount must be a screen mount code like ACC002-U01');
    if (options.steps && options.total) refuse('progress: give steps or total, not both');
    panelCount += 1;
    var model = progressModel(options);
    var timer = setTimeout(function () { if (!model.finished) openPanel(model, options); }, delayOf(options.delay));
    function move(now, line) {
      model.now = model.max > 0 ? Math.min(model.max, now) : now;
      if (line) model.line = line;
      paintPanel(model);
    }
    return {
      set: function (now, line) { move(now, line); },
      step: function (line) { move(model.now + 1, line); },
      done: function () {
        clearTimeout(timer);
        model.finished = true;
        if (model.opened) announce(words('Finished', textKey(ACTION_SET.progress, 'finished')));
        closePanel(model);
      },
      fail: function (message) {
        clearTimeout(timer);
        model.finished = true;
        failPanel(model, options, message);
      }
    };
  }
  var progress = { start: startProgress, run: runInline, inline: inline, spinner: spinnerHtml, bar: barHtml, delay: PROGRESS_DELAY_MS };
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', onDocumentClick);
  var library = { action: action, dialog: dialog, progress: progress, components: ACTION_SET, textKey: textKey };
  /* screens write the short name: ui.action(...) */
  if (typeof window !== 'undefined') window.ui = library;
  return library;
})();
