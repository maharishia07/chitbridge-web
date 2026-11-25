/* app/modal-dialog.js - THE DIALOG PATTERN for every shop popup: a name, focus in, Tab kept inside.
 *
 * OWNS      modalFocusables(box) · modalDialogOpen(host) · modalTrapKey(e) and the one keydown listener that runs it.
 * CALLED BY public/app.html modal() (calls modalDialogOpen after painting the dialog); the Tab trap is registered here on load.
 * FLOW      modal() paints role=dialog -> modalDialogOpen names it and moves focus in -> modalTrapKey wraps Tab and Shift-Tab inside until closeModal.
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 * ID        CMP068
 * OWNER     cb-ux-locale
 * RISK      plain
 */
/**
 * THE DIALOG PATTERN (WAI-ARIA APG, Dialog (Modal); WCAG 4.1.2, 2.4.3): modal() paints role=dialog + aria-modal; this gives the dialog its NAME (the
 * title in .mhd .t, else the first heading, else the word "Dialog"), moves the keyboard in (the first control other than the corner X, else the dialog
 * itself) unless the caller already put focus inside, and modalTrapKey keeps Tab and Shift-Tab inside. Esc and the return of focus are closeModal's.
 * Every shop dialog opens through modal(), so this is the one place; there is no second dialog.
 */
const MODAL_FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex]';
/** the controls inside a dialog that can take focus now (not disabled, hidden or taken out of the Tab order) */
function modalFocusables(box) {
  return [].slice.call(box.querySelectorAll(MODAL_FOCUSABLE)).filter(function (el) {
    return !el.disabled && !el.hidden && el.getAttribute('tabindex') !== '-1' && el.type !== 'hidden';
  });
}
/** name the open dialog (its title, else the word Dialog) and move the keyboard in unless focus is already inside */
function modalDialogOpen(host) {
  const box = host.querySelector('.modal');
  if (!box) return;
  const title = host.querySelector('.mhd .t') || host.querySelector('h1,h2,h3');
  if (title) {
    if (!title.id) title.id = 'modal-title';
    box.setAttribute('aria-labelledby', title.id);
  } else box.setAttribute('aria-label', tx('Dialog'));
  if (box.contains(document.activeElement)) return;
  const first = modalFocusables(box).filter(function (el) { return !el.classList.contains('mx'); })[0];
  (first || box).focus();
}
/** where Tab (or Shift-Tab) must be sent to stay inside the dialog: the control to focus, or null when the browser's own move stays inside */
function modalTabTarget(box, list, active, backwards) {
  if (!list.length) return box;
  const first = list[0];
  const last = list[list.length - 1];
  if (!box.contains(active) || active === box) return backwards ? last : first;
  if (backwards && active === first) return last;
  if (!backwards && active === last) return first;
  return null;
}
/* Tab and Shift-Tab wrap inside the open dialog; a minimised compose (host hidden) is not a dialog on screen */
function modalTrapKey(e) {
  if (e.key !== 'Tab') return;
  const host = document.getElementById('modalhost');
  const box = host && host.style.display !== 'none' ? host.querySelector('.modal') : null;
  if (!box) return;
  const target = modalTabTarget(box, modalFocusables(box), document.activeElement, e.shiftKey);
  if (!target) return;
  e.preventDefault();
  target.focus();
}
document.addEventListener('keydown', modalTrapKey);
