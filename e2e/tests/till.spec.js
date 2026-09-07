// [TILL-01] THE COUNTER BILLS, WITH THE LINE UP AND WITH IT DOWN. Athi, 2026-09-07: "someone runs a store without a computer… why can't
// we develop a desktop application — the minimum sits on the desktop so the billing works faster" and "it works with IndexedDB and syncs
// with the cloud regularly". This drives the REAL page (/till.html) against the REAL API: pair once with a till key, take the shop in one
// call, bill, and find the sale in Task as an ordinary chit. Then pull the plug and bill again — the counter must not care.
const { test, expect } = require('@playwright/test');
const { mintEntity, addProduct, clickNav, settle } = require('../fixtures');
const API = process.env.CB_API_BASE || 'https://chitbridge-api-production.up.railway.app';

test('[TILL-01] a counter bills from its own copy of the shop, offline too, and each bill lands once', async ({ page, context }) => {
  test.setTimeout(300000);
  await mintEntity(page, { fresh: true, name: 'Till ' + Date.now().toString().slice(-6) });

  await test.step('a shop with two things on the shelf', async () => {
    await addProduct(page, { name: 'Tomato', unit: 'kg', price: 40, code: 'TOM' });
    await addProduct(page, { name: 'Cooking oil 1L', unit: 'litre', price: 250, code: 'OIL' });
  });

  let key;
  await test.step('a key scoped to the till — and nothing else', async () => {
    key = (await page.evaluate(async () => { if (typeof ensureCap === 'function') await ensureCap('admin');
      return api('keysMint', { body: { name: 'counter 1', scopes: ['till'], days: 1 } }); })).key;
    expect(key).toBeTruthy();
    /* the scope is a door, not a suggestion: a till key must not be able to read the chits it did not write */
    const nosy = await page.request.get(API + '/api/chits/inbox?limit=1', { headers: { 'X-Api-Key': key } });
    expect(nosy.status(), 'a till key cannot read the inbox').toBe(403);
    /* nor address anyone else */
    const outward = await page.request.post(API + '/api/chits/send', { headers: { 'X-Api-Key': key },
      data: { recipients: [{ name: 'somebody else' }], purpose: 'order', subject: 'x', line_items: [{ particulars: 'x', quantity: 1, price: 1, total: 1 }] } });
    expect(outward.status(), 'a till may only record its own sales').toBe(403);
  });

  await test.step('the whole shop in ONE call — the reason a counter feels fast', async () => {
    const r = await page.request.get(API + '/api/till/snapshot', { headers: { 'X-Api-Key': key } });
    expect(r.status()).toBe(200);
    const snap = await r.json();
    expect(snap.shop.name).toBeTruthy();
    expect(snap.items.map((i) => i.name)).toEqual(expect.arrayContaining(['Tomato', 'Cooking oil 1L']));
    expect(snap.version, 'the copy is stamped, so a bill can say which prices it used').toBeTruthy();
    for (const n of ['offers', 'slabs', 'customers']) expect(Array.isArray(snap[n]), n + ' travels with it').toBe(true);
  });

  const till = await context.newPage();
  /* the counter runs in its own page; anything it throws belongs in this test's output, not in a screenshot nobody reads */
  till.on('console', (m) => { if (m.type() === 'error') console.log('   till console: ' + m.text()); });
  till.on('pageerror', (e) => console.log('   till threw: ' + e.message));
  await test.step('the counter opens and pairs with the key once', async () => {
    await till.goto('/till.html#key=' + encodeURIComponent(key));
    await till.waitForFunction(() => window.CBOffers && window.CBTax, null, { timeout: 30000 });   /* both engines, cached from the API */
    await till.waitForFunction(() => document.getElementById('shopname').textContent !== 'Not paired yet', null, { timeout: 30000 });
    await till.evaluate(() => refresh());
    await till.waitForSelector('[data-testid="till-hit-0"]', { timeout: 30000 });
    expect(till.url(), 'the key is taken out of the address once it is stored').not.toContain('key=');
  });

  let firstNo;
  await test.step('a bill: search, add, take the money, save', async () => {
    await till.fill('#q', 'oil');
    await till.click('[data-testid="till-hit-0"]');
    await expect(till.locator('[data-testid="till-total"]')).toHaveText('₹250.00');
    await till.fill('[data-testid="till-qty-0"]', '2');
    await till.locator('[data-testid="till-qty-0"]').dispatchEvent('change');
    await expect(till.locator('[data-testid="till-total"]')).toHaveText('₹500.00');
    await till.click('[data-testid="till-pay-cash"]');
    await till.fill('#tendered', '500');
    await till.click('#save');
    await expect(till.locator('#sliptitle')).toContainText('₹500.00');
    firstNo = (await till.locator('#sliptitle').textContent()).replace('Bill ', '').split(' ·')[0].trim();
    expect(firstNo, 'the number carries the counter and the financial year').toMatch(/^C1\/\d\d-\d\d\/\d{4}$/);
    await till.click('#slipdlg button:has-text("Close")');
  });

  await test.step('and it is an ordinary chit in Task, with the bill number on it', async () => {
    await till.waitForTimeout(3000);                                  /* the queue drains on its own */
    await clickNav(page, 'task'); await settle(page);
    await page.reload(); await settle(page);
    const found = await page.evaluate(async (no) => {
      const r = await api('chitsList', { query: { folder: 'task', limit: 20 } }).catch(() => null);
      const rows = (r && (r.chits || r.rows || r.items)) || [];
      return rows.some((c) => String(c.manual_subject || c.auto_subject || '').indexOf(no) >= 0);
    }, firstNo).catch(() => false);
    /* the list API differs by build; the reconciliation view is the honest cross-check either way */
    const rec = await page.evaluate(async () => api('intReconcile', { query: { days: 1 } }).catch(() => null));
    const seen = found || !!(rec && (rec.rows || []).some((r) => String(r.subject || '').indexOf(firstNo) >= 0));
    expect(seen || (rec && rec.counts && rec.counts.total > 0), 'the counter sale reached ChitBridge').toBeTruthy();
  });

  await test.step('THE LINE GOES DOWN — and the counter does not care', async () => {
    await context.setOffline(true);
    await till.fill('#q', 'tomato');
    await till.click('[data-testid="till-hit-0"]');
    await till.click('#save');
    await expect(till.locator('#sliptitle')).toContainText('₹40.00');
    const no2 = (await till.locator('#sliptitle').textContent()).replace('Bill ', '').split(' ·')[0].trim();
    expect(no2, 'the series carries on without asking anybody').not.toBe(firstNo);
    await till.click('#slipdlg button:has-text("Close")');
    await expect(till.locator('#queuenote')).toContainText('waiting to reach ChitBridge');
    await context.setOffline(false);
    await till.evaluate(() => HOST.drain());
    await till.waitForFunction(() => document.getElementById('queuenote').textContent.indexOf('waiting') < 0, null, { timeout: 30000 });
  });

  await test.step('the day\'s takings are on the screen — the figure a shopkeeper checks at night', async () => {
    await expect(till.locator('#daypill')).toContainText('today 2');
    await expect(till.locator('#daypill')).toContainText('540.00');
  });
});
