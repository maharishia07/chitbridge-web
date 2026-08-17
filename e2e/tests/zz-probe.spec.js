const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test('probe · who repaints while a modal is open', async ({ page }) => {
  test.setTimeout(180_000);
  await mintEntity(page);
  await page.getByTestId('nav-compose').click();
  await page.getByTestId('chit-item-name').waitFor({ timeout: 20000 });

  await page.evaluate(() => {
    window.__hits = [];
    const wrap = (name) => {
      const orig = window[name];
      if (typeof orig !== 'function') return;
      window[name] = function () {
        const modalUp = !!(document.getElementById('modalhost') || {}).innerHTML;
        const st = String(new Error().stack || '').split('\n').slice(1, 5).join(' <- ')
          .replace(/https?:\/\/[^ )]*app(\.html|\/[a-z0-9-]+\.js)/g, '');
        window.__hits.push(name + ' modalUp=' + modalUp + ' :: ' + st.slice(0, 300));
        return orig.apply(this, arguments);
      };
    };
    ['renderApp', 'bgRenderApp', 'closeModal'].forEach(wrap);
  });

  for (let i = 1; i <= 4; i++) {
    await page.waitForTimeout(3000);
    const m = await page.evaluate(() => document.querySelectorAll('.mover').length);
    console.log('T+' + i * 3 + 's movers=' + m);
    if (!m) break;
  }
  const hits = await page.evaluate(() => window.__hits || []);
  hits.slice(0, 8).forEach((h) => console.log('HIT ' + h));
  expect(true).toBe(true);
});
