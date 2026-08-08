/**
 * render-smoke.spec.js — DOES THE PAGE STILL RENDER? Run this BEFORE pushing anything that touches
 * app.html, shop.html or app/*.js.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────────────────────
 * Athi, 2026-08-09, after the cart integration: *"i should have fixed the cart first, then should have built all,
 * as it is the basic element."*
 *
 * Five defects came out of that integration, three of them introduced while fixing the previous one, two of which
 * took the PUBLIC STOREFRONT down:
 *
 *   1 · _shopSym deleted but still called            → ReferenceError, blank shop
 *   2 · prices silently regrouped 3400 → 3,400        → changed a public page's money format
 *   3 · a published data-testid renamed              → specs found nothing
 *   4 · the fix patched a call site nobody used      → grep said "fixed", the DOM said otherwise
 *   5 · the fix referenced init()'s local from the   → ReferenceError, blank shop AGAIN
 *       compat adapter
 *
 * Every one is legal JavaScript. `node -c` passed. The unit tests passed. check-app-parses passed. All five were
 * only observable when a browser actually ran the page — and each time I substituted a cheaper signal for that,
 * because the real check took four minutes and needed a deploy.
 *
 * THIS is the missing gate: seconds, no deploy, no login. It does not test features — variants.spec.js and the
 * module specs do that. It answers one question the cheap checks structurally cannot:
 *
 *      Did the page boot, and did it boot WITHOUT throwing?
 *
 * ── HOW TO RUN IT ────────────────────────────────────────────────────────────────────────────────────────────────
 *      npx playwright test render-smoke --project=noauth              (against the deployed site)
 *
 * ⚠️ It deliberately does NOT need the API. Every failure above happened while the page was assembling itself,
 * before or independent of any data arriving — so a page that cannot reach the API must still boot cleanly, and
 * "Could not reach the shop" caused by OUR OWN exception must be told apart from a genuine network problem. That
 * distinction is the heart of test 2 below: the storefront was reporting my ReferenceError as a network fault.
 */
const { test, expect } = require('@playwright/test');

const BRIDGE = process.env.CB_SMOKE_BRIDGE || 'CBVVGJCXHU';
const API = process.env.CB_API || 'https://chitbridge-api-production.up.railway.app';

/** Collects everything the browser complained about while the page came up. */
function watch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

/** Faults that are OURS. A failed fetch or a 4xx from the API is the environment, not the page. */
function ourFaults(errors) {
  return errors.filter((e) =>
    !/Failed to fetch|net::ERR|ERR_|status of 4\d\d|status of 5\d\d|Unauthorized|favicon/i.test(e));
}

test.describe('render smoke — the page boots without throwing', () => {
  test('★★ shop.html renders the storefront and throws nothing of ours', async ({ page }) => {
    const errors = watch(page);
    await page.goto(`/shop.html?bridge=${BRIDGE}&api=${encodeURIComponent(API)}`, { waitUntil: 'networkidle' });

    // ⚠️ THE EXACT SHAPE OF BOTH OUTAGES: a ReferenceError inside render(), caught and reported to the customer as
    // a network problem. The words below are what a blank storefront actually said, twice.
    const body = await page.locator('.wrap').innerText();
    expect(ourFaults(errors), 'the page threw while rendering:\n' + ourFaults(errors).join('\n')).toEqual([]);
    expect(body, 'the storefront is showing an error where the shop should be').not.toContain('Could not reach the shop');

    // Something of the shop is on screen — proof it got past assembling and actually painted.
    expect(body.length, 'the storefront rendered nothing at all').toBeGreaterThan(40);
  });

  test('★ shop.html still prints money the way it always has', async ({ page }) => {
    /**
     * Defect 2 was a cart refactor quietly regrouping every price on a public page. Nobody asked for it, no test
     * covered the FORMAT, and it only surfaced because a spec happened to assert a price as written.
     *
     * A four-digit price must appear ungrouped. If a deliberate decision is ever made to group digits, this test
     * should be CHANGED — deliberately, in that commit — rather than discovered broken by something else.
     */
    await page.goto(`/shop.html?bridge=${BRIDGE}&api=${encodeURIComponent(API)}`, { waitUntil: 'networkidle' });
    const body = await page.locator('.wrap').innerText();
    test.skip(!/\d{4}/.test(body), 'this shop has no four-digit price to check');
    expect(body, 'a price is being digit-grouped — that changes a public page and must be a deliberate choice')
      .not.toMatch(/₹\s?\d{1,3},\d{3}/);
  });

  test('★★ app.html boots to the login screen and throws nothing of ours', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/app.html#/login', { waitUntil: 'networkidle' });
    // Not "is the app correct" — only "did it come up". A module that fails to parse or a missing global shows here.
    await expect(page.locator('body')).not.toBeEmpty();
    expect(ourFaults(errors), 'app.html threw while booting:\n' + ourFaults(errors).join('\n')).toEqual([]);
  });

  test('★ the shared cart module actually loaded, and is the only one', async ({ page }) => {
    /**
     * Defect 3 and 4 both came from the cart moving between files. This asserts the module is REACHABLE under the
     * name the screens call it by — the check that would have caught a bad script path immediately — and that the
     * duplicate implementation really is gone rather than shadowing it.
     */
    await page.goto('/app.html#/login', { waitUntil: 'networkidle' });
    const state = await page.evaluate(() => ({
      cart: typeof window.CBCart,
      walk: typeof window.cbLineRows,
      adapter: typeof window.cbPickInit,
      // The picker used to live in catalogue-lines.js. If these ever come back, there are two carts again.
      strays: ['cbPickListHTML', 'cbPickToggle', 'cbPickUnits', 'cbPickTotal', 'cbPickView']
        .filter((n) => typeof window[n] === 'function'),
    }));
    expect(state.cart, 'CBCart did not load — check the script tag in app.html').toBe('object');
    expect(state.walk, 'cbLineRows did not load').toBe('function');
    expect(state.adapter, 'the cbPick* compat adapter is missing — live screens still call it').toBe('function');
    expect(state.strays, 'a removed shim is back — that is a second cart forming').toEqual([]);
  });
});
