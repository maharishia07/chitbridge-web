/**
 * e2e/prefetch.cjs — the /me request starts at sign-in, and the first screen consumes it.
 *
 * Athi, 2026-08-21: *"go ahead with prefetch on sign-in."*
 *
 * ⭐ THE FIRST SCREEN SHOULD NOT BE THE FIRST REQUEST. The session is established, the shell paints, and then
 * whichever screen you landed on asks for /me and waits 200–400ms. Nothing about /me depends on which screen
 * you chose, so it can be in flight while the shell is still painting.
 *
 * ⚠️⚠️ A WARM START, NOT A CACHE, AND THIS GUARD EXISTS TO KEEP IT THAT WAY. A cache of /me would need
 * invalidating on every profile save, every currency change, every capability grant — and a MISSED invalidation
 * shows someone stale facts about their own business, which is far worse than a slow screen. The promise is
 * consumed ONCE and discarded; every later read fetches as it always did. If someone later makes it persist,
 * the second-call assertion below fails.
 *
 * ⚠️ RUN AGAINST THE SOURCE, NOT A BROWSER — the Playwright suite needs a live app, an API and a working OTP,
 * none of which is available here. This drives the two functions directly, which is where the contract lives.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const shell = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.html'), 'utf8');

/* pull the two functions out of the shell and run them against a stub api() */
const grab = (name) => {
  const i = shell.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let j = shell.indexOf('{', i), d = 0, k = j;
  for (; k < shell.length; k++) { const c = shell[k]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) break; } }
  return shell.slice(i, k + 1);
};

let calls = [];
const ctx = vm.createContext({
  console,
  SESSION: { token: 't', role: 'entity' },
  api: (key, opts) => { calls.push(key + ':' + JSON.stringify((opts || {}).query || {})); return Promise.resolve({ marker: calls.length }); },
});
vm.runInContext('var _mePrefetch = null;\n' + grab('mePrefetchStart') + '\n' + grab('meTake'), ctx);

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? '   ' + extra : '')); }
  else { fail++; console.error('  ✗ ' + name + (extra ? '   ' + extra : '')); }
};

(async () => {
  console.log('\n── the warm start ──');
  calls = [];
  ctx.mePrefetchStart();
  t('sign-in starts the request', calls.length === 1, calls[0]);
  t('  …with the include list, so one call covers the screen',
    /include/.test(calls[0]) && /readiness/.test(calls[0]) && /channels/.test(calls[0]) && /vault/.test(calls[0]));

  const first = await ctx.meTake();
  t('the first screen consumes it — no second request', calls.length === 1, calls.length + ' call(s)');
  t('  …and gets the prefetched result', first && first.marker === 1);

  /**
   * ⭐⭐ THE ASSERTION THAT KEEPS IT A WARM START. Consumed once, then gone. If this ever passes with
   * calls.length === 1, someone has turned it into a cache and every profile save now needs an invalidation
   * nobody wrote.
   */
  console.log('\n── and it is NOT a cache ──');
  const second = await ctx.meTake();
  t('a later read fetches again', calls.length === 2, calls.length + ' call(s)');
  t('  …and is a fresh result', second && second.marker === 2);

  console.log('\n── it does not fire when there is nothing to fetch ──');
  calls = [];
  ctx._mePrefetch = null;
  ctx.SESSION = { token: 't', role: 'customer' };
  ctx.mePrefetchStart();
  t('a storefront customer has no /me — nothing started', calls.length === 0);

  calls = [];
  ctx.SESSION = { token: null, role: null };
  ctx.mePrefetchStart();
  t('no token, nothing started', calls.length === 0);

  /**
   * ⚠️ STARTED WITHOUT AN AWAITER, A FAILED PREFETCH WOULD SURFACE AS AN UNHANDLED REJECTION in the console of
   * an app that is working perfectly — the consumer simply re-fetches. The .catch() in mePrefetchStart is not
   * decoration.
   */
  console.log('\n── a failed prefetch is absorbed, and the consumer still works ──');
  calls = [];
  ctx._mePrefetch = null;
  ctx.SESSION = { token: 't', role: 'entity' };
  let unhandled = null;
  process.once('unhandledRejection', (e) => { unhandled = e; });
  ctx.api = (key) => { calls.push(key); return Promise.reject(new Error('offline')); };
  ctx.mePrefetchStart();
  await new Promise((r) => setTimeout(r, 30));
  t('no unhandled rejection', unhandled === null, unhandled ? String(unhandled.message) : '');
  ctx.api = (key) => { calls.push(key); return Promise.resolve({ marker: 'recovered' }); };
  const after = await ctx.meTake();
  t('the consumer fetches for itself and succeeds', after && after.marker === 'recovered');

  console.log('\n  ══ ' + pass + ' passed · ' + fail + ' failed ══\n');
  process.exit(fail ? 1 : 0);
})();
