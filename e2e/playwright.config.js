// Playwright config — drives the LIVE app (Vercel web + Railway API). Trace ON (the reviewer wants the filmstrip).
// THREE projects: `setup` mints a shared session once → `authed` flows start signed-in (fast re-runs, no re-onboarding);
// `noauth` runs the flows that must start LOGGED OUT (onboarding/flow/redproof). Multi-party flows spin up their own
// fresh contexts, so they're unaffected by the saved session. Override the web host with CB_WEB_BASE.
const { defineConfig, devices } = require('@playwright/test');
const AUTH_FILE = '.auth/user.json';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,        // stateful flows — keep order deterministic
  retries: 0,                  // a real break must show RED, not be retried away
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.CB_WEB_BASE || 'https://chitbridge-web.vercel.app',
    trace: 'on',               // full trace = the filmstrip + a showcase artifact
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    // 1 · mint the shared logged-in session once
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    // 2 · flows that reuse the saved session (start signed-in; re-run any one instantly)
    {
      name: 'authed',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
      testMatch: /.*\.spec\.js/,
      testIgnore: [/onboarding\.spec\.js/, /flow\.spec\.js/, /redproof\.spec\.js/],
    },
    // 3 · flows that must start LOGGED OUT (they test onboarding itself / the welcome screen)
    {
      name: 'noauth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [/onboarding\.spec\.js/, /flow\.spec\.js/, /redproof\.spec\.js/],
    },
  ],
});
