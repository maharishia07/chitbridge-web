// [NET-SF-01] A MEMBER STORE'S STOREFRONT SHOWS THE OFFER ITS BRAND RELEASED — AND THE ORDER CHARGES IT.
//
// Athi, 2026-09-17: "make network offers work on the member storefronts too." The counter already honoured a released
// network offer; the storefront showed the same product at full price, and its checkout had no way to apply one. One key
// per adopted line (lib/network-offers.lineKey) now ties the row's promise to the order's arithmetic.
const { test, expect } = require('@playwright/test');
const { mintEntity, mintInContext } = require('../fixtures');
const API = process.env.CB_API_BASE || 'https://chitbridge-api-production.up.railway.app';

const app = (page, name, opts) => page.evaluate(async ({ name, opts }) => {
  try { return { ok: true, body: await api(name, opts || {}) }; }
  catch (e) { return { ok: false, message: (e && e.message) || String(e) }; }
}, { name, opts });

test('[NET-SF-01] a released network offer is on the member storefront and on its order; a declined one is on neither', async ({ page, browser, request }) => {
  test.setTimeout(420000);
  const stamp = Date.now().toString().slice(-6);

  /* ── the BRAND: a catalogue, an offer by category, opt-out, released now ── */
  await mintEntity(page, { fresh: true, name: 'SfBrand ' + stamp });
  await page.evaluate(async () => { if (typeof ensureCap === 'function') await ensureCap('admin'); });
  const sourceKey = 'sfbrand-' + stamp + '@v1';
  const pub = await app(page, 'catSourcePut', { body: { source_key: sourceKey, title: 'SfBrand ' + stamp,
    items: [{ name: 'Smart kettle', sku: 'SK-1', category: 'Kitchen' }, { name: 'Desk lamp', sku: 'DL-1', category: 'Lighting' }] } });
  expect(pub.ok, pub.message).toBe(true);
  const made = await app(page, 'defAdd', { body: { kind: 'offer', sub_kind: 'percent_off', name: 'Kitchen week', status: 'live',
    rules: { kind: 'percent_off', label: 'Kitchen week 10%', percent: 10, scope: 'line', applies_to: { category: 'Kitchen' } } } });
  expect(made.ok, made.message).toBe(true);
  const offerId = made.body.definition_id || (made.body.definition && made.body.definition.definition_id) || made.body.id;
  expect((await app(page, 'netOfferPolicy', { body: { policy: 'opt_out' } })).ok).toBe(true);

  /* ── the STORE: adopts, prices both, opens its storefront to the public ── */
  const store = await mintInContext(browser, { fresh: true, name: 'SfStore ' + stamp });
  await store.page.evaluate(async () => { if (typeof ensureCap === 'function') await ensureCap('admin'); });
  const ad = await app(store.page, 'catalogueAdopt', { body: { source: sourceKey,
    commercials: { 'Smart kettle': { price: 2000, unit: 'piece' }, 'Desk lamp': { price: 1000, unit: 'piece' } } } });
  expect(ad.ok, ad.message).toBe(true);
  const handle = await store.page.evaluate(async () => {
    await api('saveProfile', { body: { catalogue_visibility: 'public' } });
    const me = await api('me'); const e = (me && me.entity) || me || {}; return e.user_id || e.bridge_id;
  });
  expect(handle).toBeTruthy();

  const rel = await app(page, 'netOfferRelease', { params: { id: offerId }, body: { at: 'now' } });
  expect(rel.ok, rel.message).toBe(true);

  const view = async () => (await request.get(API + '/api/catalogue/' + encodeURIComponent(handle))).json();
  const order = async (name, quantity) => {
    const ident = 'nsf' + Date.now().toString().slice(-7) + '@example.com';
    const st = await (await request.post(API + '/api/catalogue/' + encodeURIComponent(handle) + '/order/start', { data: { identifier: ident, name: 'Net Buyer' } })).json();
    const cf = await request.post(API + '/api/catalogue/' + encodeURIComponent(handle) + '/order/confirm', { data: { identifier: ident, name: 'Net Buyer',
      otp: st.dev_otp || '123123', location: 'Chennai', line_items: [{ kind: 'finish', source: sourceKey, finish: name, quantity }] } });
    return { status: cf.status(), j: await cf.json() };
  };

  await test.step('⭐⭐ the storefront read carries the brand\'s offer, aimed at the adopted line', async () => {
    const v = await view();
    const net = (v.offers || []).filter((o) => o.network && String(o.id) === String(offerId));
    expect(net.length, 'the member storefront does not carry the released offer').toBe(1);
    expect(net[0].network.brand_name).toContain('SfBrand ' + stamp);
    const kettle = [].concat(...(v.finishes || []).map((f) => f.items || [])).find((i) => i.name === 'Smart kettle');
    expect(kettle && kettle.line_id, 'the adopted product has no key for an offer to aim at').toBe('src:' + sourceKey + ':SK-1');
  });

  await test.step('⭐⭐ the storefront card shows the offer price on the kettle — and not on the lamp', async () => {
    const shop = await browser.newPage();
    await shop.goto('/shop.html?bridge=' + encodeURIComponent(handle));
    const offered = shop.locator('[data-testid^="shop-fin-offer-"]');
    await expect(offered).toHaveCount(1, { timeout: 30000 });
    await expect(offered).toContainText('Kitchen week 10%');
    await expect(offered).toContainText('1,800');
    await shop.close();
  });

  await test.step('⭐⭐⭐ the order charges what the card promised — 10% off the kettle, nothing off the lamp', async () => {
    const k = await order('Smart kettle', 2);
    expect(k.status, JSON.stringify(k.j)).toBe(200);
    expect(Number(k.j.summary.total_value), 'the order ignored the offer the storefront showed').toBe(3600);
    const l = await order('Desk lamp', 1);
    expect(l.status, JSON.stringify(l.j)).toBe(200);
    expect(Number(l.j.summary.total_value), 'the offer reached a product outside its category').toBe(1000);
  });

  await test.step('⚠️ the store declines — the storefront drops it, and the order is at full price', async () => {
    expect((await app(store.page, 'netOfferChoice', { params: { id: offerId }, body: { choice: 'out' } })).ok).toBe(true);
    const v = await view();
    expect((v.offers || []).filter((o) => o.network).length, 'a declined offer is still on the storefront').toBe(0);
    const k = await order('Smart kettle', 1);
    expect(k.status, JSON.stringify(k.j)).toBe(200);
    expect(Number(k.j.summary.total_value), 'a declined offer was still charged').toBe(2000);
  });
});
