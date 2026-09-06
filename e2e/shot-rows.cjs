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
  /* SEED — the shared session is re-minted empty by every spec run; four priced products, a rate, a live 10% offer, a GSTIN */
  const seeded = await page.evaluate(async () => { const out = []; const process_force = true;
    try { out.push(['profile', JSON.stringify(await api('saveProfile', { body: { gstn: '33AABCK1234F1Z6', catalogue_visibility: 'public' } })).slice(0, 80)]); } catch (e) { out.push(['profile', String(e && e.message)]); }
    const list = await api('prodList', { query: { limit: 50 } }); const items = list.items || list.products || list.rows || (Array.isArray(list) ? list : []);
    out.push(['list', Object.keys(list || {}).join(',') + ' n=' + items.length]);
    if (!items.length || process_force) {
      for (const p of [['Test Tax Product','bag',101,'Tax-Product-Test'],['Grapes','kg',200,'Thiratchai',5],['OIL','litre',250,'OIL'],['VEGETABLES','bag',100,'VEGETABLES']]) {
        const body = { name: p[0], unit: p[1], price: p[2], code: p[3], status: 'available', avail: { qty: 91, as_of: new Date().toISOString(), source: 'tally' } }; if (p[4]) { body.gst_rate = p[4]; body.hsn = '0806'; }
        try { out.push([p[0], JSON.stringify(await api('prodAdd', { body: { item_data: body } })).slice(0, 100)]); } catch (e) { out.push([p[0], 'ERR ' + String(e && e.message)]); }
      }
      const today = new Date().toISOString().slice(0, 10), later = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      await fetch(CFG.API_BASE + '/api/definitions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SESSION.token }, body: JSON.stringify({ kind: 'offer', sub_kind: 'percent_off', name: 'Flat 10%', status: 'live', rules: { kind: 'percent_off', label: 'Flat 10%', percent: 10, scope: 'line', valid_from: today, valid_to: later } }) });
    }
    return out;
  });
  console.log('seed:', JSON.stringify(seeded));
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(2500);
  await page.getByTestId('nav-catalogue').click().catch(() => {});
  await page.locator('[data-testid^="cat-product-"]').first().waitFor({ timeout: 40000 }).catch(() => {}); await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'catalogue.png') });
  const list = page.locator('[data-testid^="cat-product-"]').first();
  if (await list.isVisible().catch(() => false)) await list.locator('..').screenshot({ path: path.join(OUT, 'catalogue-list.png') }).catch(() => {});
  await page.getByTestId('nav-suppliers').click().catch(() => {});
  await page.waitForTimeout(2500);
  const own = page.getByTestId('sup-row-own');
  if (await own.isVisible().catch(() => false)) { await own.click(); await page.locator('#sup_body [data-testid="cart-add"]').first().waitFor({ timeout: 40000 }).catch(() => {}); await page.waitForTimeout(1500); await page.locator('#sup_body [data-testid="cart-add"]').first().click().catch(() => {}); await page.waitForTimeout(800); }
  await page.screenshot({ path: path.join(OUT, 'suppliers.png') });
  await page.setViewportSize({ width: 400, height: 860 }); await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'suppliers-mobile.png') });
  await browser.close();
  console.log('shots in', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
