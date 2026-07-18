// SAVED SESSION setup — runs ONCE before the `authed` project, mints one entity, and saves its logged-in session to
// .auth/user.json. Every `authed` flow then starts already-signed-in (mintEntity short-circuits) — so re-running a single
// flow doesn't re-do onboarding. The `noauth` project (onboarding/flow/redproof) and the multi-party contexts start fresh.
// NOTE: lives under tests/ so the `setup` project (testDir './tests') actually discovers it.
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

const AUTH_FILE = '.auth/user.json';

test('authenticate — mint the shared session', async ({ page }) => {
  await mintEntity(page);
  await expect(page).toHaveURL(/#\/app/);
  await page.context().storageState({ path: AUTH_FILE });
});
