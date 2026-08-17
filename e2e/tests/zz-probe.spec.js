const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test('probe · does compose survive being left open', async ({ page }) => {
  test.setTimeout(180_000);
  await mintEntity(page);
  await page.getByTestId('nav-compose').click();
  await page.getByTestId('chit-item-name').waitFor({ timeout: 20000 });
  await page.evaluate(() => {
    window.__log = [];
    const orig = window.closeModal;
    window.closeModal = function () { window.__log.push('closeModal @' + Date.now()); return orig.apply(this, arguments); };
    const oa = window.renderApp;
    if (typeof oa === 'function') window.renderApp = function () { window.__log.push('renderApp @' + Date.now()); return oa.apply(this, arguments); };
  });
  for (let i = 1; i <= 6; i++) {
    await page.waitForTimeout(5000);
    const alive = await page.evaluate(() => document.querySelectorAll('.mover').length);
    console.log(`T+${i * 5}s  movers=${alive}`);
    if (!alive) break;
  }
  const log = await page.evaluate(() => (window.__log || []).slice(0, 8));
  console.log('LOG ' + JSON.stringify(log));
  expect(true).toBe(true);
});
