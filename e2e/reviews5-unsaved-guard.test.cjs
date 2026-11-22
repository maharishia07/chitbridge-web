/**
 * reviews5-unsaved-guard.test.cjs — reviews5 GF-03 M1 (21 Nov 2026): the unsaved-changes guard ("Save and continue") on the real cap-admin.js function.
 * OWNS      the proof that a REFUSED save (the saver returns false) does not toast "Saved." and does not navigate away (the edit stays on screen with the
 *           refusal under it), while a good save still toasts and goes on. It used to toast "Saved." and run go() whatever the savers said.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 *   node e2e/reviews5-unsaved-guard.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' — ' + why)); if (!ok) fail++; };

async function run(saveResult) {
  const toasts = [];
  let went = 0;
  const cx = vm.createContext({
    UI: { _profGo: () => { went++; }, _guardMap: null },
    PROF_FIELDS: { a: [] }, closeModal() {}, tx: (s) => s, toast: (s) => toasts.push(s),
    profDirtySections: () => ['a'], profSnapshot() {}, saveProfile: async () => saveResult, saveSettings: async () => saveResult, saveAutoAssign: async () => saveResult
  });
  vm.runInContext(liftFns('public/app/cap-admin-guard.js', ['profSaveSections', 'profGuardDo']) + '\nthis.f = profGuardDo;', cx);
  await cx.f('save');
  return { toasts, went };
}
(async () => {
  const bad = await run(false);
  t('a refused save does not say Saved.', !bad.toasts.includes('Saved.'), bad.toasts.join('|'));
  t('a refused save does not navigate away', bad.went === 0, 'went ' + bad.went);
  t('a refused save says it was not saved', bad.toasts.some((s) => /^Not saved/.test(s)));
  const good = await run(true);
  t('a good save still says Saved. and goes on', good.toasts.includes('Saved.') && good.went === 1, good.toasts.join('|') + ' went ' + good.went);
  const undef = await run(undefined);
  t('a saver that returns nothing (older caller) still goes on', undef.went === 1);
  process.exit(fail ? 1 : 0);
})();
