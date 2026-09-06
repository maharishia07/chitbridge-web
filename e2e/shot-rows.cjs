/**
 * shot-rows.cjs — LOOK AT THE ROWS. Signs in with the saved e2e session and screenshots the seller's Catalogue list and a
 * buyer's Suppliers picker, so a layout change can be judged by eye before anyone is asked to.  node e2e/shot-rows.cjs [outdir]
 */
const { chromium } = require('@playwright/test');
const path = require('path'), fs = require('fs');
const OUT = process.argv[2] || path.join(__dirname, 'test-results', 'rows');
const BASE = process.env.CB_WEB_BASE || 'https://chitbridge-web.vercel.app';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: path.join(__dirname, '.auth', 'user.json'), viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.getByTestId('nav-catalogue').click().catch(() => {});
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, 'catalogue.png') });
  const list = page.locator('[data-testid^="cat-product-"]').first();
  if (await list.isVisible().catch(() => false)) await list.locator('..').screenshot({ path: path.join(OUT, 'catalogue-list.png') }).catch(() => {});
  await page.getByTestId('nav-suppliers').click().catch(() => {});
  await page.waitForTimeout(2500);
  const beta = page.locator('[data-testid^="sup-row-"]').filter({ hasText: 'Beta' }).first();
  if (await beta.isVisible().catch(() => false)) { await beta.click(); await page.waitForTimeout(4000); }
  await page.screenshot({ path: path.join(OUT, 'suppliers.png') });
  await page.setViewportSize({ width: 400, height: 860 }); await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'suppliers-mobile.png') });
  await browser.close();
  console.log('shots in', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
