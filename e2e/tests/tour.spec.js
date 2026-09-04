// THE TOUR (TOUR=1): every implementation from 2026-09-03 → 05, one after the other, with a caption on screen.
// Run headed to watch: TOUR=1 npx playwright test tests/tour.spec.js --headed --project=authed   (see e2e/TOUR.md)
const { test, expect } = require('@playwright/test');
const { mintEntity, addProduct, clickNav, settle, dismissModal } = require('../fixtures');

const PAUSE = Number(process.env.TOUR_PAUSE || 5000);

async function caption(page, n, title, look) {
  await page.evaluate(([n, title, look]) => {
    let el = document.getElementById('cb_tour');
    if (!el) { el = document.createElement('div'); el.id = 'cb_tour'; document.body.appendChild(el); }
    el.setAttribute('style', 'position:fixed;left:16px;bottom:16px;z-index:99999;max-width:520px;background:#111;color:#fff;padding:12px 16px;border-radius:12px;font:14px/1.45 system-ui;box-shadow:0 8px 30px rgba(0,0,0,.35)');
    el.innerHTML = '<div style="font-size:11px;letter-spacing:.08em;opacity:.7">STEP ' + n + ' OF 12</div><div style="font-weight:700;font-size:16px;margin:2px 0 4px">' + title + '</div><div style="opacity:.9">' + look + '</div>';
  }, [n, title, look]);
  await page.waitForTimeout(PAUSE);
}
const rmCaption = (page) => page.evaluate(() => { const el = document.getElementById('cb_tour'); if (el) el.remove(); }).catch(() => {});

test('the tour', async ({ page }) => {
  test.skip(!process.env.TOUR, 'set TOUR=1 to run the tour');
  test.setTimeout(900000);
  await mintEntity(page);
  await page.evaluate(async () => api('saveProfile', { body: { gstn: '29ABCDE1234F1Z5' } }).catch(() => null));
  const basmati = 'Basmati 25kg', ponni = 'Ponni Boiled 10kg';
  await addProduct(page, { name: basmati, price: 1000 });
  await addProduct(page, { name: ponni, price: 600 });

  const ids = await page.evaluate(async ([a, b]) => {
    const rows = await api('prodList');
    const f = (n) => { const p = rows.find((x) => ((x.item_data || x).name || '') === n); return p ? { id: p.item_id || p.id, d: p.item_data || p } : null; };
    const A = f(a), B = f(b);
    await api('prodEdit', { params: { id: A.id }, body: { item_data: Object.assign({}, A.d, { sku: 'BAS-25', hsn: '1006', tax_slab: 'IN-GST-18', tax_slab_name: 'GST 18%', gst_rate: 18, bom: [{ item: 'Basmati paddy 40kg', qty: 1 }, { item: 'PP bag', qty: 1 }] }) } });
    await api('prodEdit', { params: { id: B.id }, body: { item_data: Object.assign({}, B.d, { sku: 'PON-10', tax_slab: 'IN-GST-5', tax_slab_name: 'GST 5%', gst_rate: 5 }) } });
    return { a: A.id, b: B.id };
  }, [basmati, ponni]);

  /* the offers, every kind, in two combinations */
  const own = await page.evaluate(async (ids) => {
    const mk = async (sub, name, rules) => (await api('defAdd', { body: { kind: 'offer', sub_kind: sub, name, rules, status: 'live' } })).definition.definition_id;
    await mk('percent_off', 'Basmati 10% off', { percent: 10, scope: 'line', priority: 1, applies_to: { item_ids: [ids.a] } });
    await mk('tier_price', 'Basmati bulk price', { tiers: [{ qty: 10, price: 950 }, { qty: 20, price: 900 }], scope: 'line', priority: 2, applies_to: { item_ids: [ids.a] } });
    await mk('amount_off', 'Ponni ₹50 off a bag', { amount: 50, scope: 'line', priority: 1, applies_to: { item_ids: [ids.b] } });
    await mk('buy_x_get_y', 'Ponni buy 5 get 1', { buy: 5, get: 1, scope: 'line', priority: 2, applies_to: { item_ids: [ids.b] } });
    await mk('threshold', 'Spend ₹5,000 → 5% off the order', { min_amount: 5000, percent: 5, scope: 'cart', priority: 9 });
    await mk('shipping', 'Free shipping over ₹3,000', { free: true, min_amount: 3000, priority: 10 });
    const slab = (await api('defAdd', { body: { kind: 'tax', sub_kind: 'gst_slab', name: 'My own 12%', rules: { rate: 12 }, status: 'live' } })).definition.definition_id;
    UI._ctOffers = undefined; UI._ctOffersThen = [];
    return { slab };
  }, ids);

  const openProduct = async (name) => {
    await clickNav(page, 'catalogue'); await settle(page); await dismissModal(page);
    await page.locator('[data-testid^="cat-product-"]', { hasText: name }).first().click();
    await settle(page);
  };

  /* 1 */
  await openProduct(basmati);
  await caption(page, 1, 'The product page is tabs', 'Product · Categories · Offers · Stock · Variants · Pricing & tax · Consists of · Barcode. Header and tabs stay pinned while you scroll.');
  /* 2 */
  await page.getByTestId('prod-tab-pricing').click();
  await expect(page.getByTestId('prod-tax-preview')).toBeVisible({ timeout: 25000 });
  await caption(page, 2, 'Tax from the governance layer', 'Basmati cites GST 18% (IN GST · governance, b201). Same state → CGST+SGST, other state → IGST. Before tax · GST · After tax on one line.');
  /* 3 */
  await page.getByTestId('prod-tab-offers').click();
  await expect.poll(async () => { await page.getByTestId('prod-tab-offers').click().catch(() => {}); return page.getByTestId('prod-offer-preview').count(); }, { timeout: 30000, intervals: [1000] }).toBeGreaterThan(0);
  await caption(page, 3, 'Offers attached, and the cart breakdown', 'Two offers on Basmati: 10% off and a bulk price. The preview is the real cart engine at qty 1 and at the sample qty, then tax after offers, then You save.');
  /* 4 */
  await clickNav(page, 'catalogue'); await settle(page); await dismissModal(page);
  await expect(page.getByTestId('cat-row-deals').first()).toBeVisible({ timeout: 25000 });
  await caption(page, 4, 'The list shows what is in effect', '🏷️ the active offer\'s promise and the GST rate on every row.');
  await page.getByTestId('cat-search').fill('10% off'); await page.waitForTimeout(600);
  await caption(page, 4, 'Search by offer or tax', 'Typing "10% off" narrows to Basmati. "gst 5" would find Ponni.');
  await page.getByTestId('cat-search').fill('');
  /* 5 */
  await page.evaluate(() => goCatsetSec('tax')); await settle(page);
  await expect(page.getByTestId('catset-tax-register')).toBeVisible({ timeout: 25000 });
  await caption(page, 5, 'Setup › Tax is a register', 'What every product carries: tax as RESOLVED and from where, offers, HSN, categories, price. Slab counts above the list. The explanations fold away.');
  /* 6 */
  await page.evaluate(() => goCatsetSec('offers')); await settle(page);
  await expect(page.getByTestId('catset-offer-plan')).toBeVisible({ timeout: 25000 });
  await caption(page, 6, 'Setup › Offers: terms, window, where applied', 'Each row: the engine\'s own sentence, Active / Scheduled / Expired, and the product it targets or "every product" for cart-wide ones. The next six months on top.');
  await page.getByTestId('catset-offer-plan-new').click();
  await expect(page.getByTestId('plan-go')).toBeVisible({ timeout: 15000 });
  await caption(page, 6, 'Plan several', 'This month one offer, next month another — set names, values, dates; created live in one pass; each applies only in its own dates.');
  await page.evaluate(() => closeModal());
  /* 7 */
  await page.evaluate(async ([pid, slab]) => { const rows = await api('prodList'); const p = rows.find((x) => (x.item_id || x.id) === pid); await api('prodEdit', { params: { id: pid }, body: { item_data: Object.assign({}, p.item_data, { tax_slab: slab, tax_slab_name: 'My own 12%', gst_rate: 12 }) } }); }, [ids.b, own.slab]);
  await page.evaluate(() => goCatsetSec('tax')); await settle(page);
  await page.evaluate(() => { if (typeof cbDefAfterChange === 'function') cbDefAfterChange('tax'); });
  await page.waitForTimeout(1500);
  await page.evaluate((slab) => catsetDefRetire('tax', slab, 'My own 12%'), own.slab);
  await page.waitForTimeout(1200);
  await page.getByText('Retire', { exact: true }).last().click().catch(() => {});
  await expect(page.getByTestId('cbdef-takeover')).toBeVisible({ timeout: 25000 });
  await caption(page, 7, 'A slab does not go dark under its products', 'Ponni cites "My own 12%". Retiring it is refused until a takeover slab is named; the takeover re-points the product with the new rate. Retired rows get Reinstate.');
  await page.evaluate(() => closeModal());
  /* 8 */
  await openProduct(basmati);
  await page.getByTestId('cat-edit').click();
  await page.getByTestId('cat-field-price').fill('1200');
  const at = new Date(Date.now() + 3 * 3600 * 1000); const local = new Date(at.getTime() - at.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await page.getByTestId('cat-field-effective').fill(local);
  await caption(page, 8, 'Publish on a date', 'Price 1,200 with Effective from three hours ahead. Save parks only what changed; the product stays as it is until then.');
  const parked = page.waitForResponse((r) => /\/schedule$/.test(r.url()) && r.request().method() === 'POST' && r.status() < 400, { timeout: 30000 });
  await page.getByTestId('cat-save').click(); await parked;
  await expect(page.getByTestId('prod-scheduled')).toBeVisible({ timeout: 25000 });
  await caption(page, 8, 'Parked, shown beside the live value', '📅 Scheduled: price → ₹1,200 at the moment you chose; the header still says ₹1,000. Cancel removes it.');
  /* 9 */
  await page.getByTestId('prod-tab-barcode').click();
  await expect(page.getByTestId('prod-barcode')).toBeVisible({ timeout: 15000 });
  await caption(page, 9, 'Barcode', 'Code 128 of the SKU, drawn in the page, printable. A GS1 barcode needs an assigned prefix — a standards step, not a rendering one.');
  await page.getByTestId('prod-tab-bom').click();
  await expect(page.getByTestId('prod-bom')).toBeVisible({ timeout: 15000 });
  await caption(page, 9, 'Consists of', 'The bill of materials the Network tool authors: per unit, and for the quantity you type. On a chit it rides on the line as detail.');
  /* 10 */
  await clickNav(page, 'compose'); await settle(page);
  for (const ln of [{ item: basmati, qty: 12, price: 1000 }, { item: ponni, qty: 6, price: 600 }]) {
    await page.getByTestId('chit-item-name').fill(ln.item); await page.getByTestId('chit-item-qty').fill(String(ln.qty)); await page.getByTestId('chit-item-price').fill(String(ln.price));
    await page.getByTestId('chit-item-add').click(); await page.waitForTimeout(900);
  }
  await page.waitForTimeout(1200);
  await caption(page, 10, 'Compose: a typed line that names your product IS that product', 'Basmati ×12 → the bulk price and 10% off; Ponni ×6 → ₹50 off and buy 5 get 1 (a free bag added, stated as such); the order crosses ₹5,000 → 5% off the order; shipping free. One engine, the same as the storefront.');
  /* 11 */
  await clickNav(page, 'mis'); await settle(page);
  await page.getByTestId('mis-band-tax').click();
  await expect(page.getByTestId('mis-tax-output')).toBeVisible({ timeout: 25000 });
  await caption(page, 11, 'MIS › Tax — what do I owe this month?', 'Every sent line is rated at send; the invoice freezes at completed; output by head, input credit from received copies, net; GSTR-1/3B JSON. Empty here because this entity has not traded yet — [TAX-03] proves the full two-party flow.');
  /* 12 */
  await clickNav(page, 'catalogue'); await settle(page); await dismissModal(page);
  await page.evaluate(() => goCatsetSec('columns')); await settle(page);
  await caption(page, 12, 'Columns — Columns · Types · Usage', 'The declared columns, their types, and which products use each (observation 2).');
  await rmCaption(page);
});
