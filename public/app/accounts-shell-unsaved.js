/* app/accounts-shell-unsaved.js — the UNSAVED-CHANGES GUARD capability: a screen registers how it knows it moved and how it saves, and the page's router asks before it paints the next screen (Save · Discard · Stay); the browser's own leave while something moved. Split out of accounts-shell.js, code moved verbatim; no money, no calls to the server of its own.
 * OWNS      CBUnsaved (form · reset · leave · isDirty · domDirty)
 * CALLED BY every page that loads accounts-shell.js (script tag, right before it); cap-country.js, cap-print.js, sheet-dialog.js and the Settings screens call it at run time; it asks through CBConfirm and tx / esc, which are there by then
 * FLOW      a screen: CBUnsaved.form({ dirty, save }) → the router: CBUnsaved.leave(go) → nothing moved → go() · moved → CBConfirm Save then go / Discard / Stay · beforeunload while dirty
 * CARD      12-ux-locale
 */
'use strict';
/**
 * ⭐ SET-WALK1 · W24 (2026-10-15) — NEVER LOSE IN-PROGRESS WORK: leaving a screen with unsaved edits asks "Save or discard?" — ONE helper
 * for every form of every small app (the legal-name edit vanished when the tab moved to Account; DISCIPLINES §3 "never lose in-progress work").
 *   CBUnsaved.form({ dirty: fn → bool, save: fn → Promise })   a screen registers how it knows it moved and how it saves (a screen that keeps a
 *                                                           model: its own test; a plain form: CBUnsaved.domDirty(host) — any input whose value
 *                                                           left its defaultValue). mount() of the next screen calls CBUnsaved.reset().
 *   CBUnsaved.leave(go)                                     the page's router calls it BEFORE painting the next screen: nothing moved → go();
 *                                                           moved → CBConfirm "Unsaved changes" · Save → save() then go() · Discard → go()
 *                                                           (✕ / Escape = Discard, as the standard modal's Cancel). With no save fn: Discard · Stay.
 * Also the browser's own leave (beforeunload) while something moved — the browser's sentence, since ours cannot be shown there.
 */
var CBUnsaved = (function () {
  var pending = { forms: [] };
  var IGNORED_TYPES = ['hidden', 'button', 'submit'];
  function reset() {
    pending.forms = [];
  }
  function form(registration) {
    if (registration && typeof registration.dirty === 'function') pending.forms.push(registration);
    return registration;
  }
  /** what a select is measured against: the choice recorded AFTER the page's own script had set it (selectRemember, on first idle or on the person's first touch), else the option the screen painted. A select set by script after paint is therefore not "unsaved". */
  function selectBase(select) {
    if (select._cbUnsavedBase != null) return select._cbUnsavedBase;
    var painted = 0; /* the option marked selected, else the first (what a browser shows for a select with none marked) */
    Array.prototype.some.call(select.options, function (option, index) { if (option.defaultSelected) { painted = index; return true; } return false; });
    return painted;
  }
  /** record a select's choice once, as it stands now */
  function selectRemember(select) {
    if (select && select.tagName === 'SELECT' && !select.multiple && select._cbUnsavedBase == null) select._cbUnsavedBase = select.selectedIndex;
  }
  /** every select under a node that has no record yet */
  function selectsRemember(node) {
    Array.prototype.forEach.call((node || document).querySelectorAll('select'), selectRemember);
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    /* first idle after a paint: the page's own script has run; and the person's first touch (before any change of theirs) */
    var idle = null;
    var later = function () { if (!idle) idle = setTimeout(function () { idle = null; selectsRemember(document); }, 300); };
    ['focusin', 'pointerdown', 'keydown'].forEach(function (name) { document.addEventListener(name, function (event) { selectRemember(event.target); }, true); });
    if (typeof MutationObserver === 'function') new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
    later();
  }
  /** has this one input, select or textarea moved from what the screen painted? */
  function inputMoved(input) {
    if (input.disabled || IGNORED_TYPES.indexOf(input.type) >= 0 || input.hasAttribute('data-unsaved-ignore')) return false;
    if (input.tagName === 'SELECT') {
      if (input.multiple) return Array.prototype.some.call(input.options, function (option) { return option.selected !== option.defaultSelected; });
      return input.selectedIndex !== selectBase(input);
    }
    if (input.type === 'checkbox' || input.type === 'radio') return input.checked !== input.defaultChecked;
    return input.value !== input.defaultValue;
  }
  /** any input, select or textarea under host whose value left what the screen painted (a repaint after Save paints the saved values) */
  function domDirty(host) {
    var container = typeof host === 'string' ? document.getElementById(host) : host;
    return !!container && Array.prototype.some.call(container.querySelectorAll('input,textarea,select'), inputMoved);
  }
  /** does this registered form say it moved? a dirty test that throws counts as "did not move" and is logged, never silent */
  function formMoved(registration) {
    try {
      return !!registration.dirty();
    } catch (err) {
      if (typeof cblog === 'function') cblog('error', 'unsaved: a dirty test threw: ' + ((err && err.message) || err));
      return false;
    }
  }
  function dirtyForms() {
    return pending.forms.filter(formMoved);
  }
  function isDirty() {
    return dirtyForms().length > 0;
  }
  /** Save or discard: Save runs every form's save() then goes on; the dialog's Cancel button is relabelled Discard */
  function askSaveOrDiscard(savers, body, goOn, stay) {
    CBConfirm(
      tx('Unsaved changes'),
      body,
      tx('Save'),
      function () {
        Promise.all(
          savers.map(function (registration) {
            return Promise.resolve().then(registration.save);
          })
        ).then(
          function () {
            reset();
            goOn();
          },
          function (err) {
            if (typeof toast === 'function') toast(CBAction.words(err, tx('Could not save')));
            if (stay) stay();
          }
        );
      },
      false,
      function () {
        reset();
        goOn();
      }
    );
    var cancel = document.querySelector('#cb_confirm [data-testid="confirm-cancel"]');
    if (cancel) {
      cancel.textContent = tx('Discard');
      cancel.setAttribute('data-testid', 'confirm-discard');
    }
  }
  /** nothing can save it: Discard or Stay (the dialog's Cancel button reads Stay) */
  function askDiscardOrStay(body, goOn, stay) {
    CBConfirm(
      tx('Unsaved changes'),
      body,
      tx('Discard'),
      function () {
        reset();
        goOn();
      },
      true,
      function () {
        if (stay) stay();
      }
    );
    var stayButton = document.querySelector('#cb_confirm [data-testid="confirm-cancel"]');
    if (stayButton) stayButton.textContent = tx('Stay');
  }
  /** nothing moved → goOn(); something moved → ask (Save or Discard when a form can save, Discard or Stay when none can) */
  function leave(goOn, stay) {
    var moved = dirtyForms();
    if (!moved.length) return goOn();
    var savers = moved.filter(function (registration) {
      return typeof registration.save === 'function';
    });
    var body = esc(tx(savers.length ? 'Save or discard what you typed?' : 'What you typed here is not saved. Discard it?'));
    if (savers.length) askSaveOrDiscard(savers, body, goOn, stay);
    else askDiscardOrStay(body, goOn, stay);
  }
  if (typeof window !== 'undefined')
    window.addEventListener('beforeunload', function (event) {
      if (isDirty()) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  return { form: form, reset: reset, leave: leave, isDirty: isDirty, domDirty: domDirty };
})();
