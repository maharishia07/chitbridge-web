/**
 * e2e/cap-admin-guard-minimums.test.cjs — the unsaved-changes prompt of Profile and Settings (public/app/cap-admin-guard.js) on the real functions: its screen minimums.
 * OWNS      the proof that the prompt's markup is theme tokens only (dark and cream, 390 and 1366 px) with the text ink on the surface (AA contrast comes from the token pair),
 *           that a walk through the three outcomes (Stay here, Discard, Save and continue) says each one in words, and that a save that could not be written says so in words and stays.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 * CARD      28-platform-and-operations/settings
 *   node e2e/cap-admin-guard-minimums.test.cjs
 */
'use strict';
const vm = require('vm');
const { liftFns } = require('./lib/lift-fn.cjs');
let fail = 0;
const t = (name, ok, why) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (ok ? '' : ' - ' + why)); if (!ok) fail++; };

/** a page stand-in: the prompt's own functions run for real, the page's helpers are recorded */
function page(dirtyNames, saveResult) {
  const seen = { modal: '', toasts: [], went: 0 };
  const context = vm.createContext({
    UI: { _profGo: null, _guardMap: null }, PROF_FIELDS: { ident: [], profile: [] }, tx: (words) => words, esc: (text) => String(text),
    modal: (html) => { seen.modal = html; }, closeModal() {}, toast: (words) => seen.toasts.push(words),
    saveProfile: async () => saveResult, saveSettings: async () => saveResult, saveAutoAssign: async () => saveResult
  });
  vm.runInContext(liftFns('public/app/cap-admin-guard.js', ['profSnapshot', 'profDirtySections', 'profGuard', 'profSaveSections', 'profGuardDo']) + '\nthis.f = { profGuard, profGuardDo };', context);
  context.profDirtySections = () => dirtyNames;
  context.profSnapshot = () => {};
  return { context, seen, ask: () => context.f.profGuard(() => { seen.went++; }) };
}

(async () => {
  const shown = page(['ident'], true);
  shown.ask();
  const html = shown.seen.modal;
  t('the prompt names what is unsaved, in words', /You changed <b>Identity<\/b> and have not saved it\./.test(html), html.slice(0, 200));
  t('dark and cream theme, 390 and 1366 px: only theme tokens, no fixed colour and no fixed width', !/#[0-9a-fA-F]{3,6}\b|rgb\(|width:\s*\d+px/.test(html), html);
  t('AA contrast: the text is the ink token (var(--ink)) on the modal surface, never a literal colour', /color:var\(--ink\)/.test(html) && !/color:\s*(?!var\()/.test(html), html);
  t('the three outcomes are three buttons, each with its own test id', /prof-guard-stay/.test(html) && /prof-guard-discard/.test(html) && /prof-guard-save/.test(html), html);

  const clean = page([], true);
  clean.ask();
  t('nothing unsaved: no prompt, the screen goes on', clean.seen.modal === '' && clean.seen.went === 1, 'modal ' + clean.seen.modal.length + ' went ' + clean.seen.went);

  const stay = page(['ident'], true);
  stay.ask();
  await stay.context.f.profGuardDo('stay');
  t('walk, Stay here: says nothing was changed and does not navigate', stay.seen.toasts.includes('Staying — nothing was changed.') && stay.seen.went === 0, stay.seen.toasts.join('|'));

  const discard = page(['ident'], true);
  discard.ask();
  await discard.context.f.profGuardDo('discard');
  t('walk, Discard: says the changes are gone, in words, and goes on', discard.seen.toasts.includes('Changes discarded.') && discard.seen.went === 1, discard.seen.toasts.join('|'));

  const saved = page(['ident'], true);
  saved.ask();
  await saved.context.f.profGuardDo('save');
  t('walk, Save and continue: says Saved. and goes on', saved.seen.toasts.includes('Saved.') && saved.seen.went === 1, saved.seen.toasts.join('|'));

  const refused = page(['ident'], false);
  refused.ask();
  await refused.context.f.profGuardDo('save');
  t('could not save: says in words that it was not saved, keeps the person on the screen', refused.seen.toasts.some((words) => /^Not saved — the reason is on the screen/.test(words)) && refused.seen.went === 0, refused.seen.toasts.join('|'));
  process.exit(fail ? 1 : 0);
})();
