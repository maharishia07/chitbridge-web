// Playwright config — drives the LIVE app (Vercel web + Railway API). Trace ON (the reviewer wants the filmstrip).
// THREE projects: `setup` mints a shared session once → `authed` flows start signed-in (fast re-runs, no re-onboarding);
// `noauth` runs the flows that must start LOGGED OUT (onboarding/flow/redproof). Multi-party flows spin up their own
// fresh contexts, so they're unaffected by the saved session. Override the web host with CB_WEB_BASE.
const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');
const AUTH_FILE = '.auth/user.json';
// Reuse the saved session if `setup` has run; otherwise leave it unset so each authed flow mints its OWN entity
// (mintEntity self-detects). This is what lets ANY single flow run standalone — e.g. `npx playwright test -g CAT-01`.
const SAVED_SESSION = fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined;
// The shop COUNTER runs at 1366×768 (Athi, 2026-07-18) — test at the operator's real screen, not a generic desktop.
const COUNTER = { width: 1366, height: 768 };
const LAPTOP  = { width: 1920, height: 1080 };   // a normal 14" laptop (FHD) — Athi wants it to hold up here too
// Counter-critical flows that get the cross-browser + size sweep — where a browser/size break actually hurts the operator.
const COUNTER_FLOWS = [/keyboard\.spec\.js/, /storefront\.spec\.js/, /chits\.spec\.js/];

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,        // stateful flows — keep order deterministic
  retries: 0,                  // a real break must show RED, not be retried away
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.CB_WEB_BASE || 'https://chitbridge-web.vercel.app',
    viewport: COUNTER,         // the counter's real screen size
    trace: 'on',               // full trace = the filmstrip + a showcase artifact
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    // 1 · mint the shared logged-in session once
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    // 1b · provision the STABLE ENTITY POOL (run on demand: `npm run pool`) — reusable entities for parallel/swarm runs
    { name: 'pool', testMatch: /pool\.setup\.js/, use: { ...devices['Desktop Chrome'] } },
    // 2 · flows that reuse the saved session (start signed-in; re-run any one instantly)
    {
      name: 'authed',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: SAVED_SESSION },
      testMatch: /.*\.spec\.js/,
      testIgnore: [/onboarding\.spec\.js/, /flow\.spec\.js/, /redproof\.spec\.js/],
    },
    // 3 · flows that must start LOGGED OUT (they test onboarding itself / the welcome screen)
    {
      name: 'noauth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [/onboarding\.spec\.js/, /flow\.spec\.js/, /redproof\.spec\.js/],
    },
    // 4 · CROSS-BROWSER + SIZE sweep of the COUNTER flows (keyboard/storefront/chits). Opt-in — run e.g.
    //     `npx playwright test --project=counter-firefox`. The default run stays Chromium@counter for speed.
    { name: 'counter-firefox', dependencies: ['setup'], testMatch: COUNTER_FLOWS,
      use: { ...devices['Desktop Firefox'], viewport: COUNTER, storageState: SAVED_SESSION } },
    { name: 'counter-webkit',  dependencies: ['setup'], testMatch: COUNTER_FLOWS,
      use: { ...devices['Desktop Safari'],  viewport: COUNTER, storageState: SAVED_SESSION } },
    { name: 'laptop',          dependencies: ['setup'], testMatch: COUNTER_FLOWS,
      use: { ...devices['Desktop Chrome'],  viewport: LAPTOP,  storageState: SAVED_SESSION } },
    { name: 'mobile',          dependencies: ['setup'], testMatch: COUNTER_FLOWS,
      use: { ...devices['Pixel 5'],         storageState: SAVED_SESSION } },
  ],
});
