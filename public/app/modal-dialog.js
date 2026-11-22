/* app/modal-dialog.js - THE DIALOG PATTERN for every shop popup: a name, focus in, Tab kept inside.
 *
 * OWNS      modalFocusables(box) · modalDialogOpen(host) · modalTrapKey(e) and the one keydown listener that runs it.
 * CALLED BY public/app.html modal() (calls modalDialogOpen after painting the dialog); the Tab trap is registered here on load.
 * FLOW      modal() paints role=dialog -> modalDialogOpen names it and moves focus in -> modalTrapKey wraps Tab and Shift-Tab inside until closeModal.
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 */
/**
 * THE DIALOG PATTERN (WAI-ARIA APG, Dialog (Modal); WCAG 4.1.2, 2.4.3): modal() paints role=dialog + aria-modal; this gives the dialog its NAME (the
 * title in .mhd .t, else the first heading, else the word "Dialog"), moves the keyboard in (the first control other than the corner X, else the dialog
 * itself) unless the caller already put focus inside, and modalTrapKey keeps Tab and Shift-Tab inside. Esc and the return of focus are closeModal's.
 * Every shop dialog opens through modal(), so this is the one place; there is no second dialog.
 */
const MODAL_FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex]';
function modalFocusables(box) {
  return [].slice.call(box.querySelectorAll(MODAL_FOCUSABLE)).filter(function (el) {
    return !el.disabled && !el.hidden && el.getAttribute('tabindex') !== '-1' && el.type !== 'hidden';
  });
}
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
/* Tab and Shift-Tab wrap inside the open dialog; a minimised compose (host hidden) is not a dialog on screen */
function modalTrapKey(e) {
  if (e.key !== 'Tab') return;
  const host = document.getElementById('modalhost');
  const box = host && host.style.display !== 'none' ? host.querySelector('.modal') : null;
  if (!box) return;
  const list = modalFocusables(box);
  const active = document.activeElement;
  if (!list.length) {
    e.preventDefault();
    box.focus();
    return;
  }
  const first = list[0];
  const last = list[list.length - 1];
  if (!box.contains(active) || active === box) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}
document.addEventListener('keydown', modalTrapKey);
