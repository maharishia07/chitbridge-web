// Playwright config — drives the LIVE app (Vercel web + Railway API). One project, trace ON (the reviewer wants the
// screen-by-screen filmstrip). Override the web host with CB_WEB_BASE; app.html points at the Railway API by default.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,        // the mint flow is stateful; keep module order deterministic
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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
