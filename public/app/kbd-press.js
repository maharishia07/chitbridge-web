/* app/kbd-press.js - ONE keyboard rule for a control that is not a native button: Enter or Space presses it.
 *
 * OWNS      the delegated keydown that turns Enter and Space on an element marked role="button" tabindex="0" into the click its page already handles.
 *           It draws nothing and owns no state; the page marks the element (role, tabindex, an aria-label when the text is not a name).
 * CALLED BY the four step-flow design labs (cart-design, network-design, supplier-design, storefront-design) for the step rail, the Change links,
 *           the remove marks and the store rows; any page may load it. step-flow.js (the real rail) carries the same rule inline, so it needs no load.
 * FLOW      load -> one listener on document -> keydown Enter or Space on a role=button tabindex element -> preventDefault (Space must not scroll) -> el.click()
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 */
(function (root) {
  'use strict';
  var PRESS_KEYS = { Enter: true, ' ': true };
  /* a native button, link or field already answers these keys itself; only a marked span or div needs help */
  function pressable(el) {
    return !!el && el.getAttribute && el.getAttribute('role') === 'button' && el.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
  }
  function onKey(event) {
    if (!PRESS_KEYS[event.key] || !pressable(event.target)) return;
    event.preventDefault();
    event.target.click();
  }
  if (root.document) root.document.addEventListener('keydown', onKey);
  root.CBKbdPress = { pressable: pressable, onKey: onKey };
})(typeof window !== 'undefined' ? window : this);
