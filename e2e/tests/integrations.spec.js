// [INT-01] Integrations is the home of connectors: the catalogue lists Tally · Zoho · CSV with a download and instructions
// each; the download is a real zip of the kit with connector.json pre-filled (key empty); a running connector's heartbeat
// (with a connector key) appears under "Running connectors". Athi, 2026-09-05: "include the tally connector as a
// downloadable option in the system itself … all should reside as part of integrations".
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');
const API = process.env.CB_API_BASE || 'https://chitbridge-api-production.up.railway.app';

test('[INT-01] connectors: catalogue, download, instructions, heartbeat → the Integrations screen', async ({ page, request }) => {
  test.setTimeout(240000);
  await mintEntity(page, { fresh: true });

  await test.step('THE CATALOGUE — three connectors, each with a download and a document', async () => {
    const r = await request.get(API + '/api/integrations/catalogue'); expect(r.status()).toBe(200);
    const ids = (await r.json()).connectors.map((c) => c.id); for (const id of ['tally', 'zoho', 'csv']) expect(ids).toContain(id);
    const d = await request.get(API + '/api/integrations/download/tally?adapter=tally'); expect(d.status()).toBe(200);
    expect(d.headers()['content-type']).toContain('application/zip'); const buf = await d.body(); expect(buf.length).toBeGreaterThan(5000); expect(buf.slice(0, 2).toString()).toBe('PK');
    const text = buf.toString('latin1'); expect(text).toContain('chitbridge-connector/core.js'); expect(text).toContain('chitbridge-connector/connector.json'); expect(text).toContain('PASTE THE KEY');
    const doc = await request.get(API + '/api/integrations/docs/zoho'); expect(doc.status()).toBe(200); expect(await doc.text()).toContain('Zoho Books connector');
  });

  let key = '';
  await test.step('A CONNECTOR CHECKS IN — with a connector key; the screen lists it', async () => {
    const k = await page.evaluate(async () => { if (typeof ensureCap === 'function') await ensureCap('admin'); return api('keysMint', { body: { name: 'store pc', scopes: ['connector', 'services'], days: 1 } }); });
    key = k.key; expect(key).toBeTruthy();
    const hb = await request.post(API + '/api/integrations/heartbeat', { headers: { 'X-Api-Key': key }, data: { name: 'Tally connector', adapter: 'tally', host: 'STORE-PC', version: '1.0.0', counters: { products_ok: 3, orders_ok: 1, failed: 0 }, note: 'watching' } });
    expect(hb.status()).toBe(200);
    await page.evaluate(async () => { navTo('settings'); }); await page.waitForTimeout(600);
    await page.getByTestId('set-sec-integrations').click({ timeout: 30000 });
    await expect(page.getByTestId('int-connector-tally')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('int-connector-zoho')).toBeVisible();
    await expect(page.getByTestId('int-download-tally-tally')).toBeVisible();
    await expect(page.getByTestId('int-docs-tally')).toBeVisible();
    await expect(page.locator('[data-testid^="int-running-"]').first()).toContainText('STORE-PC', { timeout: 30000 });
    await expect(page.locator('[data-testid^="int-running-"]').first()).toContainText('orders 1');
  });
});
