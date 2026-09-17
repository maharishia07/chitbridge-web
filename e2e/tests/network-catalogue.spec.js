// [NET-CAT-01] A BRAND PUBLISHES ITS PRODUCT CHANGES — A STORE AT THE BRAND'S PRICE MOVES WITH IT; A STORE WITH ITS OWN IS ASKED.
//
// Athi, 2026-09-17: "if the price changed it has to reflect to the store" → "suggest only, build publish changes as you
// recommended." A brand, two stores: FOLLOWS sells the kettle at the brand's price, OWN at its own. The brand changes the
// kettle's price, adds a product, and publishes — first for a moment a few seconds ahead (applied by the next read, no
// worker), then from the screen with "Publish now". OWN is shown the new price and answers Keep, then Use.
const { test, expect } = require('@playwright/test');
const { mintEntity, mintInContext } = require('../fixtures');
const API = process.env.CB_API_BASE || 'https://chitbridge-api-production.up.railway.app';

const app = (page, name, opts) => page.evaluate(async ({ name, opts }) => {
  try { return { ok: true, body: await api(name, opts || {}) }; }
  catch (e) { return { ok: false, message: (e && e.message) || String(e) }; }
}, { name, opts });

test('[NET-CAT-01] publish changes: followers move, own prices are asked, nothing lands before its moment', async ({ page, browser, request }) => {
  test.setTimeout(480000);
  const stamp = Date.now().toString().slice(-6);

  /* ── the BRAND: two products, published as its network catalogue ── */
  await mintEntity(page, { fresh: true, name: 'CatBrand ' + stamp });
  await page.evaluate(async () => { if (typeof ensureCap === 'function') await ensureCap('admin'); });
  const idOf = async (name) => page.evaluate(async (nm) => {
    const r = await api('prodList', { query: { limit: 200 } });
    const list = Array.isArray(r) ? r : ((r && (r.items || r.products)) || []);
    const hit = list.find((x) => String(((x.item_data || x).name) || '') === nm);
    return hit ? { id: hit.item_id || hit.id, d: hit.item_data || hit } : null;
  }, name);
  for (const p of [{ name: 'Smart kettle', code: 'CK-1', price: 2000 }, { name: 'Desk lamp', code: 'CL-1', price: 1000 }]) {
    const r = await app(page, 'prodAdd', { body: { item_data: { name: p.name, code: p.code, price: p.price, mrp: p.price, unit: 'piece', category: 'Home' } } });
    expect(r.ok, r.message).toBe(true);
  }
  const sourceKey = 'catbrand-' + stamp + '@v1';
  const pub = await app(page, 'catSourcePut', { body: { source_key: sourceKey, title: 'CatBrand ' + stamp, items: [
    { name: 'Smart kettle', sku: 'CK-1', code: 'CK-1', price: 2000, mrp: 2000, unit: 'piece', category: 'Home' },
    { name: 'Desk lamp', sku: 'CL-1', code: 'CL-1', price: 1000, mrp: 1000, unit: 'piece', category: 'Home' }] } });
  expect(pub.ok, pub.message).toBe(true);

  /* ── two STORES ── */
  const mkStore = async (label, kettle) => {
    const st = await mintInContext(browser, { fresh: true, name: label + ' ' + stamp });
    await st.page.evaluate(async () => { if (typeof ensureCap === 'function') await ensureCap('admin'); });
    const ad = await app(st.page, 'catalogueAdopt', { body: { source: sourceKey,
      commercials: { 'Smart kettle': { price: kettle, unit: 'piece' }, 'Desk lamp': { price: 950, unit: 'piece' } } } });
    expect(ad.ok, ad.message).toBe(true);
    st.handle = await st.page.evaluate(async () => {
      await api('saveProfile', { body: { catalogue_visibility: 'public' } });
      const me = await api('me'); const e = (me && me.entity) || me || {}; return e.user_id || e.bridge_id;
    });
    return st;
  };
  const follows = await mkStore('Follows', 2000);
  const own = await mkStore('Own', 2200);
  const kettleAt = async (st) => {
    const v = await (await request.get(API + '/api/catalogue/' + encodeURIComponent(st.handle))).json();
    const it = [].concat(...(v.finishes || []).map((f) => f.items || [])).find((i) => i.name === 'Smart kettle');
    const p = it && it.commercials && it.commercials.price;
    return p && typeof p === 'object' ? Number(p.amount) : Number(p);
  };

  /* ── the brand changes its product ── */
  const kettle = await idOf('Smart kettle');
  expect((await app(page, 'prodEdit', { params: { id: kettle.id }, body: { item_data: Object.assign({}, kettle.d, { price: 1800 }) } })).ok).toBe(true);
  expect((await app(page, 'prodAdd', { body: { item_data: { name: 'Toaster', code: 'CT-1', price: 2500, mrp: 2500, unit: 'piece', category: 'Home' } } })).ok).toBe(true);

  await test.step('⭐ the brand sees what its stores do not have yet — and nothing has reached them', async () => {
    const v = (await app(page, 'netOffers')).body;
    const c = (v.brand.catalogue || []).find((x) => x.source_key === sourceKey);
    expect(c, 'the brand is not shown its catalogue').toBeTruthy();
    const ch = c.changes.find((x) => x.name === 'Smart kettle');
    expect(ch && ch.fields, 'the price change is not listed').toContainEqual({ field: 'price', from: 2000, to: 1800 });
    expect(c.candidates.map((x) => x.name)).toContain('Toaster');
    expect(await kettleAt(follows), 'an unpublished change reached a store').toBe(2000);
  });

  await test.step('⏳ a publish for a moment ahead waits — then the first read after it applies it', async () => {
    const soon = new Date(Date.now() + 8000).toISOString();
    const r = await app(page, 'netCatPublish', { body: { source_key: sourceKey, at: soon } });
    expect(r.ok, r.message).toBe(true);
    expect(r.body.applied).toBe(false);
    expect(r.body.followed, 'the store at the brand\'s price was not marked as following').toBe(1);
    expect(await kettleAt(follows), 'a waiting publish reached a store early').toBe(2000);
    await page.waitForTimeout(9000);
    expect(await kettleAt(follows), 'the store at the brand\'s price did not move').toBe(1800);
    expect(await kettleAt(own), '⚠️ a store\'s OWN price was overwritten').toBe(2200);
  });

  await test.step('⭐⭐ the store with its own price is asked — Keep leaves it alone and the question goes', async () => {
    const n = ((await app(own.page, 'netOffers')).body.store.price_notices || []).find((x) => x.name === 'Smart kettle');
    expect(n, 'the store was not shown the brand\'s new price').toBeTruthy();
    expect([n.suggested, n.yours]).toEqual([1800, 2200]);
    await own.page.evaluate(async () => { await goIntTab('netoffers'); });
    await expect(own.page.getByTestId('netc-notices')).toContainText('Smart kettle', { timeout: 30000 });
    await own.page.getByTestId('netc-keep-0').click();
    await expect(own.page.getByTestId('netc-notices')).toHaveCount(0, { timeout: 30000 });
    expect(await kettleAt(own)).toBe(2200);
    const again = ((await app(follows.page, 'netOffers')).body.store.price_notices || []);
    expect(again.length, 'a following store was asked about a price it already follows').toBe(0);
  });

  await test.step('⭐⭐ from the screen: publish at next opening shows it waiting; cancel; publish now (twice) adds the toaster', async () => {
    const k2 = await idOf('Smart kettle');
    expect((await app(page, 'prodEdit', { params: { id: k2.id }, body: { item_data: Object.assign({}, k2.d, { price: 1700 }) } })).ok).toBe(true);
    await page.evaluate(async () => { await goIntTab('netoffers'); });
    const card = page.getByTestId('netc-' + sourceKey);
    await expect(card).toContainText('Smart kettle', { timeout: 30000 });
    await page.getByTestId('netc-publish').click();
    await expect(page.getByTestId('netc-pending')).toBeVisible({ timeout: 30000 });
    expect(await kettleAt(follows), 'next opening means not now').toBe(1800);
    await page.getByTestId('netc-cancel').click();
    await expect(page.getByTestId('netc-pending')).toHaveCount(0, { timeout: 30000 });
    const toaster = await idOf('Toaster');
    await page.getByTestId('netc-add-' + toaster.id).locator('input').check();
    await page.getByTestId('netc-publish-now').click();
    await expect(page.getByTestId('netc-publish-now')).toContainText('NOW');
    await page.getByTestId('netc-publish-now').click();
    await expect(page.getByTestId('netc-uptodate')).toBeVisible({ timeout: 30000 });
    expect(await kettleAt(follows)).toBe(1700);
    const v = await (await request.get(API + '/api/catalogue/' + encodeURIComponent(follows.handle))).json();
    const names = [].concat(...(v.finishes || []).map((f) => f.items || [])).map((i) => i.name);
    expect(names, 'the toaster is shared but unpriced at the store — so it is held back, not sold at nothing').not.toContain('Toaster');
  });

  await test.step('⭐ Use takes the brand\'s price — and the store follows it from then on', async () => {
    const list = (await app(own.page, 'netOffers')).body.store.price_notices || [];
    const i = list.findIndex((x) => x.name === 'Smart kettle');
    expect(i, 'the second price change was not suggested').toBeGreaterThanOrEqual(0);
    expect(list[i].suggested).toBe(1700);
    await own.page.evaluate(async () => { if (typeof netoReload === 'function') netoReload(); });
    await own.page.getByTestId('netc-use-' + i).click();
    await expect(own.page.getByTestId('netc-notices')).toHaveCount(0, { timeout: 30000 });
    expect(await kettleAt(own)).toBe(1700);
  });
});
