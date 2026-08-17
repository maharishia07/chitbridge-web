const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test('probe · avatar menu error', async ({ page }) => {
  test.setTimeout(120_000);
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e.message).slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 240)); });
  await mintEntity(page);
  errs.length = 0;
  await page.getByTestId('icon-avatar').click().catch((e) => errs.push('CLICK: ' + e.message.slice(0, 120)));
  await page.waitForTimeout(1200);
  const open = await page.evaluate(() => ({
    avMenu: !!(window.UI && window.UI.avMenu),
    inDom: !!document.querySelector('[data-testid="avatar-menu"]'),
  }));
  console.log('PROBE ' + JSON.stringify(open));
  errs.slice(0, 4).forEach((e) => console.log('  ' + e));
  expect(true).toBe(true);
});
