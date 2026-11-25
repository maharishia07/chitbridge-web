/**
 * e2e/cap-traceability-minimums.test.cjs — the Traceability screen (public/app/cap-traceability.js) on the real functions: its screen minimums.
 * OWNS      the proof of a walk of the screen (asking for no id says what to paste, a trace shows the loader then the result, a failed trace says so in words),
 *           that the controls use theme tokens only (dark and cream) and fit 390 px (wrapping rows, no minimum width above 220 px, no fixed width above 80 px, one scroll area),
 *           and that the error text pairs the danger tint with the disputed ink token (AA contrast follows the theme).
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 * CARD      10-operations/traceability
 *   node e2e/cap-traceability-minimums.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' - ' + why)); if (!ok) fail++; };

function page(apiAnswer) {
  const seen = { toasts: [], renders: 0, snapshots: [] };
  const context = vm.createContext({
    UI: {}, esc: (text) => String(text), tx: (words) => words, loader: (words) => '<div class="loader">' + words + '</div>', emptyState: (icon, title) => '<div class="empty">' + title + '</div>',
    curSym: () => '₹', toast: (words) => seen.toasts.push(words), renderApp: () => { seen.renders++; seen.snapshots.push(context.UI.traceLoading ? 'loading' : context.UI.traceResult ? 'result' : 'none'); },
    api: apiAnswer, _traceBatchPicker: () => '', _traceFwd: () => '<div class="fwd">forward</div>', _traceBwd: () => '<div class="bwd">backward</div>'
  });
  vm.runInContext(liftFns('public/app/cap-traceability.js', ['_traceSym', 'traceabilityScreen', 'runTrace', 'runTraceByBatch']) + '\nthis.f = { traceabilityScreen, runTrace, runTraceByBatch };', context);
  return { context, seen };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

(async () => {
  const screen = page(async () => ({}));
  const html = screen.context.f.traceabilityScreen();
  const withoutHandlers = html.replace(/ on[a-z]+="[^"]*"/g, '');
  t('dark and cream theme: the controls hold no literal colour, only var(--token)', !/#[0-9a-fA-F]{3,6}\b|rgb\(/.test(withoutHandlers), (withoutHandlers.match(/#[0-9a-fA-F]{3,6}\b/) || [''])[0]);
  const minWidths = [...html.matchAll(/min-width:(\d+)px/g)].map((match) => Number(match[1]));
  const fixedWidths = [...html.matchAll(/[^-]width:(\d+)px/g)].map((match) => Number(match[1]));
  t('390 and 1366 px: rows wrap, no minimum width above 220 px and no fixed width above 80 px, one scroll area', /flex-wrap:wrap/.test(html) && Math.max(...minWidths) <= 220 && Math.max(...fixedWidths) <= 80 && (html.match(/overflow:auto/g) || []).length === 1, JSON.stringify({ minWidths, fixedWidths }));
  t('AA contrast: the helper lines use the grey token, the inputs and buttons the line token on the page surface', /color:var\(--grey\)/.test(html) && /border:1px solid var\(--line\)/.test(html), html.slice(0, 200));

  const empty = page(async () => ({}));
  empty.context.UI.traceId = '   ';
  empty.context.f.runTrace('forward');
  t('walk: asking for no id says what to paste and asks nothing', empty.seen.toasts.includes('Paste a batch / chit id to trace.') && empty.seen.renders === 0, empty.seen.toasts.join('|'));
  const noBatch = page(async () => ({}));
  noBatch.context.f.runTraceByBatch();
  t('walk: asking for no batch number says what to type', noBatch.seen.toasts.includes('Type a batch number to reconstruct.'), noBatch.seen.toasts.join('|'));

  const walked = page(async () => ({ nodes: [] }));
  walked.context.UI.traceId = 'B-1';
  walked.context.f.runTrace('forward');
  const loading = walked.context.f.traceabilityScreen();
  await settle();
  t('walk: the screen shows the loader while the chain is walked, then the recall set', /Walking the chain/.test(loading) && walked.seen.snapshots.join() === 'loading,result' && /class="fwd"/.test(walked.context.f.traceabilityScreen()), walked.seen.snapshots.join());

  const refused = page(async () => { throw new Error('This batch is not one you oversee.'); });
  refused.context.UI.traceId = 'B-2';
  refused.context.f.runTrace('backward');
  await settle();
  const said = refused.context.f.traceabilityScreen();
  t('could not trace: the screen says why in words', /This batch is not one you oversee\./.test(said), said.slice(-300));
  t('AA contrast: the error pairs var(--danger-tint) with var(--disp-2)', /background:var\(--danger-tint\)[^>]*color:var\(--disp-2\)/.test(said), said.slice(-300));
  const unnamed = page(async () => { throw {}; });
  unnamed.context.UI.traceBatchQ = 'FG-1';
  unnamed.context.f.runTraceByBatch();
  await settle();
  t('could not trace by batch and no reason given: says Batch trace failed', unnamed.context.UI.traceResult && unnamed.context.UI.traceResult.error === 'Batch trace failed', JSON.stringify(unnamed.context.UI.traceResult));
  process.exit(fail ? 1 : 0);
})();
