/**
 * ui.js — THE STANDARD ACTION SET AND ITS FACTORIES (UX-137, DISCIPLINES §3a). One component per everyday action
 * (Save, Done, Cancel, Close, Back, Add, Remove, Reload, Open); a screen never hand-writes the markup, it MOUNTS one.
 * Improve a component here and every mount on every screen improves.
 *
 * OWNS       ui.action(name, options) -> the button's HTML string · ui.dialog(options) -> opens through modal() ·
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
     on a phone width every target is 44 px whatever the mount asked. One stylesheet, written here, so the size is changed in one place. */
  var SIZES = ['standard', 'compact'];
  var SIZE_CSS =
    '[data-cbname]{min-height:var(--act-h,44px);min-width:var(--act-h,44px)}' +
    '[data-cbname][data-size="compact"]{min-height:32px;min-width:32px}' +
    '@media(max-width:700px){[data-cbname][data-cbname]{min-height:44px;min-width:44px}}';
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
    if (!component || name === 'dialog') refuse('unknown action "' + name + '"');
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
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', onDocumentClick);
  var library = { action: action, dialog: dialog, components: ACTION_SET, textKey: textKey };
  /* screens write the short name: ui.action(...) */
  if (typeof window !== 'undefined') window.ui = library;
  return library;
})();
