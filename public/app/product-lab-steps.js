/* app/product-lab-steps.js - PRODUCT LAB'S STEP STRIP: Choose, then Price & shelf.
 *
 * OWNS      paintSteps() - draws the two step buttons into #steps (on, done, and step 2 disabled until something is chosen); the buttons carry data-cbsid PLB001-B01.
 * CALLED BY public/product-lab.html paint() and the step moves; it reads the page's STEP, LIST, nPicked() and calls goStep(n).
 * FLOW      paint() -> paintSteps() -> #steps innerHTML; a click calls goStep(n).
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/product-lab
 * ID        PLB001
 * OWNER     cb-ux-locale
 * RISK      plain
 */
function paintSteps() {
  var n = nPicked();
  var names = [
    ['Choose', n ? n + ' chosen from ' + LIST.label : 'what this shop sells'],
    ['Price & shelf', n ? 'set what you charge' : 'after you have chosen']
  ];
  /* ⚠️ step 2 is not reachable by clicking it with nothing chosen — a step that opens empty is a dead end */
  document.getElementById('steps').innerHTML = names
    .map(function (x, index) {
      var at = index + 1,
        on = STEP === at,
        done = STEP > at;
      return (
        '<button data-cbsid="PLB001-B01" class="stp ' +
        (on ? 'on' : done ? 'done' : '') +
        '" data-testid="pl-step-' +
        at +
        '"' +
        (at === 2 && !n ? ' disabled' : '') +
        ' onclick="goStep(' +
        at +
        ')">' +
        '<span class="n">' +
        at +
        '</span><span><span class="t">' +
        esc(x[0]) +
        '</span>' +
        '<span class="v">' +
        esc(x[1]) +
        '</span></span></button>'
      );
    })
    .join('');
}
