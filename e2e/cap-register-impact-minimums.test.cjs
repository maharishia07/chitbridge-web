/**
 * e2e/cap-register-impact-minimums.test.cjs — the Impact view of the register (public/app/cap-register-impact.js) on the real functions: its screen minimums.
 * OWNS      the proof that the impact graph draws with theme tokens and currentColor only (dark and cream, 390 and 1366 px: it is max-width:100% inside its own scroll),
 *           that its text takes the card's ink token so AA contrast follows the theme, and that a walk that could not be read says so in words.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 * CARD      03-disputes-service-and-register/raida-register-and-report
 *   node e2e/cap-register-impact-minimums.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' - ' + why)); if (!ok) fail++; };

function page(apiAnswer) {
  const painted = [];
  const context = vm.createContext({
    RG: { sel: null, walkFrom: null, walkBack: true, walk: null, report: { full: true } },
    tx: (words) => words, txn: (one, many, count) => (count === 1 ? one : many).replace('{count}', count), txf: (words, values) => words.replace('{d}', values.d),
    esc: (text) => String(text), rgSubjectName: () => null, rgBand: () => '', rgRegisterRail: () => '', rgScoped: () => [], rgPaint: () => painted.push(1),
    rgWhy: (failure, verb) => 'Could not read it (' + verb + ').', api: apiAnswer
  });
  vm.runInContext(liftFns('public/app/cap-register-impact.js', ['rgWalkLoad', 'rgWalkLabel', 'rgGraph', 'rgDangling', 'rgImpact']) + '\nthis.f = { rgWalkLoad, rgGraph, rgDangling, rgImpact };', context);
  return { context, painted };
}

(async () => {
  const drawn = page(async () => ({ hops: [] }));
  const svg = drawn.context.f.rgGraph([{ depth: 1, rel_type: 'finish_to_start', severity: 5, to_label: 'The crane', owner: 'Asha', needed_by: '2026-12-01T00:00' }, { depth: 2, rel_type: 'blocks', severity: 1, body: 'Permit' }]);
  t('dark and cream theme, 390 and 1366 px: the graph holds no literal colour and no width beyond its container', !/#[0-9a-fA-F]{3,6}\b|rgb\(/.test(svg) && /max-width:100%/.test(svg), svg.slice(0, 160));
  t('AA contrast: the text takes the card ink token and currentColor, the severe box takes the disputed token', /color:var\(--on-card\)/.test(svg) && /stroke="var\(--disp\)"/.test(svg), svg.slice(0, 160));
  t('the graph is named for a screen reader in words (role img, aria-label)', /role="img"[^>]*aria-label="Impact walk"/.test(svg), svg.slice(0, 200));

  const empty = drawn.context.f.rgImpact();
  t('nothing points anywhere: says so in words, with the way to make an edge', /Nothing points anywhere yet/.test(empty) && /names what it waits on/.test(empty), empty);

  const refused = page(async () => { throw new Error('API 500'); });
  refused.context.RG.walkFrom = 'line-1';
  await refused.context.f.rgWalkLoad();
  t('could not read the walk: the view keeps no hops, says why in words and repaints', refused.context.RG.walk.hops.length === 0 && /^Could not read it/.test(refused.context.RG.walk.err) && refused.painted.length === 1, JSON.stringify(refused.context.RG.walk));
  process.exit(fail ? 1 : 0);
})();
