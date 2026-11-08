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
  var MOUNT_CODE = /^[A-Z]{3}\d{3}(?:-D\d{2})?-U\d{2}$/;
  var TONES = ['primary', 'quiet'];
  var EFFECTS = ['none', 'preference', 'commit'];
  var ALLOWED_OPTIONS = [
    'mount', 'object', 'tone', 'hidden', 'disabled', 'busy', 'role', 'key', 'effect', 'confirm',
    'confirmedBy', 'onPress', 'id', 'testid', 'data'
  ];
  /* CSS class per tone and surface: a page uses the small apps' .act family, a dialog footer uses the modal's own .pri / .danger */
  var TONE_CLASS = {
    page: { primary: 'act', quiet: 'act ghost' },
    dialog: { primary: 'pri', quiet: '', danger: 'danger' }
  };
  /**
   * The components. label is the English tx() key; shown is the visible text (icon or glyph where the width is tight);
   * verb is the fcode verb (closed list in docs toolset/ui-identity/ui-stamp.cjs VERBS); effect null = the mount must declare it.
   */
  var ACTION_SET = {
    save: { code: 'CMP001', element: 'CMP001-B01', label: 'Save', shown: 'Save', verb: 'SAVE', effect: null, effectFixed: false, tone: 'primary' },
    dialog: { code: 'CMP002', element: 'CMP002-D01', label: 'Dialog', verb: 'SHOW', effect: 'none', effectFixed: true, tone: 'primary' },
    cancel: { code: 'CMP003', element: 'CMP003-B01', label: 'Cancel', shown: 'Cancel', verb: 'CANCEL', effect: 'none', effectFixed: true, tone: 'quiet' },
    done: { code: 'CMP004', element: 'CMP004-B01', label: 'Done', shown: 'Done', verb: 'DONE', effect: 'none', effectFixed: true, tone: 'primary' },
    close: { code: 'CMP005', element: 'CMP005-B01', label: 'Close', shown: '✕', verb: 'CLOSE', effect: 'none', effectFixed: true, tone: 'quiet', nameOnly: true },
    back: { code: 'CMP006', element: 'CMP006-B01', label: 'Back', shown: '‹ Back', verb: 'BACK', effect: 'none', effectFixed: true, tone: 'quiet' },
    add: { code: 'CMP007', element: 'CMP007-B01', label: 'Add', shown: '+ Add', verb: 'ADD', effect: 'none', effectFixed: false, tone: 'quiet', nameOnly: false },
    remove: { code: 'CMP008', element: 'CMP008-B01', label: 'Remove', shown: 'Remove', verb: 'REMOVE', effect: 'commit', effectFixed: true, tone: 'quiet' },
    reload: { code: 'CMP009', element: 'CMP009-B01', label: 'Try again', shown: 'Try again', verb: 'RELOAD', effect: 'none', effectFixed: true, tone: 'quiet' },
    open: { code: 'CMP010', element: 'CMP010-B01', label: 'Open', shown: 'Open', verb: 'OPEN', effect: 'none', effectFixed: true, tone: 'quiet' }
  };
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
  /** a property outside the schema, or one that only the component fixes, is refused (never silently dropped) */
  function checkOptions(name, component, options) {
    Object.keys(options).forEach(function (property) {
      if (ALLOWED_OPTIONS.indexOf(property) < 0) refuse(name + ': "' + property + '" is not a property of the component');
    });
    if (!MOUNT_CODE.test(options.mount || '')) refuse(name + ': mount must be a screen mount code like ACC002-U01');
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
  function accessibleName(component, options) {
    if (options.object) return phrase(component.label + ' {object}', textKey(component, 'aria'), { object: words(options.object) });
    return component.nameOnly ? words(component.label, textKey(component, 'label')) : null;
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
      .concat(gateAttributes(options.role))
      .concat(dataAttributes(options.data));
  }
  /** the visible text: a glyph stays as written, a word goes through tx() */
  function shownText(component) {
    return escapeText(component.nameOnly ? component.shown : words(component.shown, textKey(component, 'shown')));
  }
  /** the button's HTML for a surface ('page' or 'dialog'); the one place the markup of an action is written */
  function render(name, options, surface) {
    var component = ACTION_SET[name];
    if (!component || name === 'dialog') refuse('unknown action "' + name + '"');
    options = options || {};
    checkOptions(name, component, options);
    var effect = effectOf(name, component, options);
    registerPress(options);
    return '<button ' + attributeList(buttonAttributes(component, options, surface, effect)) + '>' + shownText(component) + '</button>';
  }
  function action(name, options) {
    return render(name, options, 'page');
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
    return CBAction.run(button, pressHandler, effect === 'commit' ? { key: key, confirm: options.confirm } : { key: key });
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
