/* app/promo-keys.js - THE SHOP SCREEN'S KEYBOARD: the shortcuts of the promo show.
 *
 * OWNS      promoShowKeys(e) - Space plays or pauses, Right and Left arrows step, F full screen, D saves the picture, Esc leaves the show; typing in a box (caption, pairing code) is never a shortcut (EL-20 M1).
 * CALLED BY public/promo.html (one keydown listener on document); it calls the page's setPlaying, step, save and PLAYING.
 * FLOW      keydown -> a text box is the target? ignore -> the key picks one action of the show.
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/product-lab
 */
function promoShowKeys(e){
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '') || (e.target && e.target.isContentEditable)) return; /* EL-20 M1: typing in a box (caption, pairing code) is never a show shortcut */
  if (e.key === ' ') { setPlaying(!PLAYING); e.preventDefault(); }
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'f' || e.key === 'F') document.getElementById('full').click();
  if (e.key === 'd' || e.key === 'D') save();
  if (e.key === 'Escape' && document.body.classList.contains('show')) document.body.classList.remove('show');
}
