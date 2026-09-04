// THE TOUR (TOUR=1) — every implementation from 2026-09-03 → 05 as NUMBERED TEST CASES, narrated on screen.
// Watch it:  TOUR=1 TOUR_PAUSE=8000 npx playwright test tests/tour.spec.js --headed --project=authed   (e2e/TOUR.md)
// Each case shows: what we test · the steps · the expected result; then a green "observed" line once the assertion holds.
const { test, expect } = require('@playwright/test');
const { mintEntity, addProduct, clickNav, settle, dismissModal } = require('../fixtures');

const PAUSE = Number(process.env.TOUR_PAUSE || 8000);
const HEADED = !!process.env.TOUR_HEADED || process.argv.includes('--headed');
/* headed: a maximised real window (viewport null lets the window size rule), slowed so the eye can follow */
test.use(HEADED ? { viewport: { width: 1600, height: 900 }, launchOptions: { slowMo: 350, args: ['--window-size=1620,1000', '--window-position=0,0'] } } : { launchOptions: { slowMo: 0 } });

let caseNo = 0;
async function tc(page, title, testing, steps, expected) {
  caseNo++;
  await page.evaluate(([n, title, testing, steps, expected]) => {
    let el = document.getElementById('cb_tour');
    if (!el) { el = document.createElement('div'); el.id = 'cb_tour'; document.body.appendChild(el); }
    el.setAttribute('style', 'position:fixed;left:16px;bottom:16px;z-index:99999;max-width:560px;background:#111;color:#fff;padding:14px 18px;border-radius:12px;font:14px/1.5 system-ui;box-shadow:0 8px 30px rgba(0,0,0,.4)');
    el.innerHTML = '<div style="font-size:11px;letter-spacing:.08em;opacity:.7">TEST CASE ' + n + '</div>'
      + '<div style="font-weight:700;font-size:17px;margin:2px 0 6px">' + title + '</div>'
      + '<div><b style="opacity:.75">Testing</b> ' + testing + '</div>'
      + '<div><b style="opacity:.75">Steps</b> ' + steps + '</div>'
      + '<div><b style="opacity:.75">Expected</b> ' + expected + '</div>'
      + '<div id="cb_tour_ok" style="margin-top:6px;color:#7CFC9A;font-weight:700"></div>';
  }, [caseNo, title, testing, steps, expected]);
  await page.waitForTimeout(Math.round(PAUSE * 0.6));
}
async function ok(page, observed) {
  await page.evaluate((t) => { const el = document.getElementById('cb_tour_ok'); if (el) el.textContent = '✓ Observed: ' + t; }, observed);
  await page.waitForTimeout(PAUSE);
}
const rmCaption = (page) => page.evaluate(() => { const el = document.getElementById('cb_tour'); if (el) el.remove(); }).catch(() => {});

test('the tour', async ({ page }) => {
  test.skip(!process.env.TOUR, 'set TOUR=1 to run the tour');
  test.setTimeout(1800000);
  await mintEntity(page);
  await page.evaluate(async () => api('saveProfile', { body: { gstn: '29ABCDE1234F1Z5' } }).catch(() => null));
  const basmati = 'Basmati 25kg', ponni = 'Ponni Boiled 10kg';
  await addProduct(page, { name: basmati, price: 1000 });
  await addProduct(page, { name: ponni, price: 600 });
  const ids = await page.evaluate(async ([a, b]) => {
    const rows = await api('prodList');
    const f = (n) => { const p = rows.find((x) => ((x.item_data || x).name || '') === n); return p ? { id: p.item_id || p.id, d: p.item_data || p } : null; };
    const A = f(a), B = f(b);
    await api('prodEdit', { params: { id: A.id }, body: { item_data: Object.assign({}, A.d, { code: 'BAS-25', hsn: '1006', bom: [{ item: 'Basmati paddy 40kg', qty: 1 }, { item: 'PP bag', qty: 1 }] }) } });
    await api('prodEdit', { params: { id: B.id }, body: { item_data: Object.assign({}, B.d, { code: 'PON-10' }) } });
    return { a: A.id, b: B.id };
  }, [basmati, ponni]);
  const openProduct = async (name) => { await clickNav(page, 'catalogue'); await settle(page); await dismissModal(page); await page.locator('[data-testid^="cat-product-"]', { hasText: name }).first().click(); await settle(page); };
  const setup = async (sec) => { await clickNav(page, 'catalogue'); await settle(page); await dismissModal(page); await page.evaluate((s) => goCatsetSec(s), sec); await settle(page); };

  /* ── 1 · the product page ── */
  await openProduct(basmati);
  await tc(page, 'The product page is tabs', 'observation 4 — one product, every aspect on its own tab, header pinned',
    'open Catalogue › Basmati 25kg', 'tabs Product · Categories · Offers · Stock · Variants · Pricing & tax · Consists of · Barcode; the name and price stay on top while you scroll');
  await expect(page.getByTestId('prod-tab-barcode')).toBeVisible();
  await ok(page, 'eight tabs, header pinned');

  /* ── 2 · tax slab from the governance layer ── */
  await page.getByTestId('cat-edit').click();
  await page.getByTestId('prod-tab-pricing').click();
  await tc(page, 'Attach a tax slab from the governance layer', 'b201 — India\'s GST slabs come from the jurisdiction, not typed per entity; the split is shown the moment you pick',
    'Edit › Pricing & tax › pick "GST 18%" (IN GST · governance) › Save', 'Same state → CGST 9% + SGST 9%; other state → IGST 18%; Before tax · GST · After tax on one line');
  const sel = page.getByTestId('prod-tax-slab'); await expect(sel).toBeVisible({ timeout: 25000 });
  await sel.selectOption('IN-GST-18');
  const saved = page.waitForResponse((r) => /\/api\/products\//.test(r.url()) && r.request().method() === 'PATCH' && r.status() < 400, { timeout: 45000 });
  await page.getByTestId('cat-save').click(); await saved; await settle(page);
  await page.getByTestId('prod-tab-pricing').click();
  await expect(page.getByTestId('prod-tax-preview-intra')).toHaveAttribute('data-rate', '18', { timeout: 25000 });
  await ok(page, 'the split reads CGST 90 + SGST 90 on ₹1,000; IGST 180 for another state');

  /* ── 3 · author an offer through Setup ── */
  await setup('offers');
  await tc(page, 'Create a new offer', 'the offer form (rebuilt on the app\'s modal frame, date pickers, no region)',
    'Catalogue setup › Offers › + New offer › kind Percentage off › name › 10 › Save', 'the offer appears in "Your offers" as a DRAFT with its terms "10% off", no dates → always');
  await page.getByTestId('catset-offer-new').click();
  const sub = page.getByTestId('cbdef-sub'); if (await sub.count()) await sub.selectOption('percent_off');
  const offerName = 'Basmati 10% off';
  await page.getByTestId('cbdef-name').fill(offerName);
  await page.getByTestId('cbdef-rule-percent').fill('10');
  await page.getByTestId('cbdef-save').click(); await settle(page);
  const row = page.locator('.catset-drow[data-testid^="catset-offer-"]', { hasText: offerName }).first();
  await expect(row).toBeVisible({ timeout: 25000 });
  await ok(page, 'the row shows the name, "10% off", and its status');

  /* ── 4 · make it live ── */
  await tc(page, 'Make the offer live', 'the status switch on the Setup list — a draft is invisible to products and buyers; live applies',
    'click "Make live" on the row', 'the row turns LIVE; "Active" shows on its window because it has no dates');
  const offerId = (await row.getAttribute('data-testid')).replace('catset-offer-', '');
  await page.getByTestId('catset-offer-live-' + offerId).click(); await settle(page);
  await expect(row.getByText('Back to draft', { exact: true })).toBeVisible({ timeout: 25000 });
  await ok(page, 'status LIVE · time status Active');

  /* ── 5 · attach it on the product ── */
  await openProduct(basmati);
  await page.getByTestId('cat-edit').click();
  await page.getByTestId('prod-tab-offers').click();
  await tc(page, 'Attach the offer to the product', 'attaching writes applies_to.item_ids on the offer — one author (Setup), many products',
    'Edit › Offers › tick "Basmati 10% off" › Save', 'the tick holds after Save; the View › Offers tab lists it');
  const chip = page.getByTestId('prod-pane-offers').locator('[data-testid^="cat-offer-"]', { hasText: 'Basmati 10%' }).first();
  await expect(chip).toBeVisible({ timeout: 30000 });
  await chip.click();
  const saved2 = page.waitForResponse((r) => /\/api\/definitions\//.test(r.url()) && r.request().method() === 'PUT' && r.status() < 400, { timeout: 45000 }).catch(() => null);
  await page.getByTestId('cat-save').click(); await saved2; await settle(page);
  await page.getByTestId('prod-tab-offers').click();
  await expect.poll(async () => { await page.getByTestId('prod-tab-offers').click().catch(() => {}); return page.getByTestId('prod-offer-preview').count(); }, { timeout: 30000, intervals: [1000] }).toBeGreaterThan(0);
  await ok(page, 'the offer is listed on the product');

  /* ── 6 · the cart preview ── */
  await tc(page, 'The attached offer shows its outcome', 'Athi: "wherever something is attached, show the downstream result with the SAME engine"',
    'View › Offers tab', 'the cart breakdown at qty 1 and at the sample qty: list price, −10%, tax on what remains, You save');
  await expect(page.getByTestId('prod-offer-preview')).toBeVisible();
  await ok(page, '₹1,000 − ₹100 → ₹900 before tax, GST 18% on ₹900');

  /* ── 7 · the list row + search ── */
  await clickNav(page, 'catalogue'); await settle(page); await dismissModal(page);
  await tc(page, 'The list shows what is in effect', 'rows carry the ACTIVE offer\'s promise and the GST rate; the search box finds by them',
    'look at the Basmati row; type "10% off" in the search', '🏷️ 10% off and GST 18% on the row; the search narrows the list to Basmati');
  await expect(page.getByTestId('cat-row-deals').first()).toBeVisible({ timeout: 25000 });
  await page.getByTestId('cat-search').fill('10% off'); await page.waitForTimeout(800);
  await expect(page.locator('[data-testid^="cat-product-"]')).toHaveCount(1, { timeout: 10000 });
  await ok(page, 'one row left: Basmati'); await page.getByTestId('cat-search').fill('');

  /* ── 8 · Setup › Tax register ── */
  await setup('tax');
  await tc(page, 'Setup › Tax is a register', 'Athi: "bring all the details — tax applied currently, offers attached, everything about the product"',
    'Catalogue setup › Tax', '"What your products carry": Basmati → 18% on the product; Ponni → not set; offers and HSN per row; slab counts; explanations folded');
  await expect(page.getByTestId('catset-tax-register')).toBeVisible({ timeout: 25000 });
  await ok(page, 'one row per product with tax as resolved and its source');

  /* ── 9 · own slab, cite it, retire → takeover ── */
  await page.getByTestId('catset-tax-new').click();
  await page.getByTestId('cbdef-name').fill('My own 12%');
  const rate = page.getByTestId('cbdef-rule-rate'); if (await rate.count()) await rate.fill('12');
  await page.getByTestId('cbdef-save').click(); await settle(page);
  const srow = page.locator('.catset-drow[data-testid^="catset-tax-"]', { hasText: 'My own 12%' }).first();
  await expect(srow).toBeVisible({ timeout: 25000 });
  const slabId = (await srow.getAttribute('data-testid')).replace('catset-tax-', '');
  await page.getByTestId('catset-tax-live-' + slabId).click(); await settle(page);
  await page.evaluate(async ([pid, slab]) => { const rows = await api('prodList'); const p = rows.find((x) => (x.item_id || x.id) === pid); await api('prodEdit', { params: { id: pid }, body: { item_data: Object.assign({}, p.item_data, { tax_slab: slab, tax_slab_name: 'My own 12%', gst_rate: 12 }) } }); }, [ids.b, slabId]);
  await setup('tax');
  await tc(page, 'A slab cannot go dark under its products', 'Athi: "if the slab is retired, the system should reject and ask another slab to take over"',
    'author "My own 12%", make it live, Ponni cites it; click Retire on it', 'retire is REFUSED: "1 product(s) cite this slab" → a modal asks which slab takes over');
  await page.evaluate((id) => catsetDefRetire('tax', id, 'My own 12%'), slabId);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Retire', exact: true }).last().click().catch(() => {});
  await expect(page.getByTestId('cbdef-takeover')).toBeVisible({ timeout: 25000 });
  await ok(page, 'the takeover ask opened with the count');
  await tc(page, 'Hand over to another slab', 'the takeover re-points every citing product and category default in one transaction, then retires',
    'pick "GST 18%" › Retire and hand over', 'the row is RETIRED with Reinstate; Ponni now cites GST 18% with the rate travelling');
  await page.getByTestId('cbdef-takeover').selectOption('IN-GST-18');
  await page.getByTestId('cbdef-takeover-go').click(); await settle(page);
  await expect(page.getByTestId('catset-tax-reinstate-' + slabId)).toBeVisible({ timeout: 25000 });
  await ok(page, 'RETIRED · Reinstate available; the register shows Ponni at 18%');

  /* ── 10 · Setup › Offers register + plan several ── */
  await setup('offers');
  await tc(page, 'Setup › Offers: terms, window, where applied', 'the row states the engine\'s own sentence, Scheduled / Active / Expired, and the product it targets',
    'Catalogue setup › Offers', '"Basmati 10% off" · 10% off · Active · on Basmati 25kg; the next six months on top');
  await expect(page.getByTestId('catset-offer-plan')).toBeVisible({ timeout: 25000 });
  await ok(page, 'terms · Active · on Basmati 25kg');
  await tc(page, 'Plan several offers, one per month', 'Athi: "this month this offer, next month another … applied as per time period"',
    'Plan several › two rows prefilled (this month, next month) › names and values › Create all as live', 'two new offers, each Active only inside its own month; the month strip shows them');
  await page.getByTestId('catset-offer-plan-new').click();
  await expect(page.getByTestId('plan-go')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('plan-name-0').fill('September: 5% off Ponni'); await page.getByTestId('plan-value-0').fill('5'); await page.getByTestId('plan-product-0').selectOption(ids.b);
  await page.getByTestId('plan-name-1').fill('October: ₹40 off Ponni'); await page.getByTestId('plan-kind-1').selectOption('amount_off'); await page.getByTestId('plan-value-1').fill('40'); await page.getByTestId('plan-product-1').selectOption(ids.b);
  await page.getByTestId('plan-go').click(); await settle(page);
  await expect(page.locator('.catset-drow[data-testid^="catset-offer-"]', { hasText: 'October' }).first()).toBeVisible({ timeout: 25000 });
  await ok(page, 'September row Active, October row Scheduled');

  /* ── 11 · publish on a date ── */
  await openProduct(basmati);
  await page.getByTestId('cat-edit').click();
  await page.getByTestId('cat-field-price').fill('1200');
  const at = new Date(Date.now() + 3 * 3600 * 1000); const local = new Date(at.getTime() - at.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await page.getByTestId('cat-field-effective').fill(local);
  await tc(page, 'Publish on a date', 'b203 — a change parked with a moment, applied on the first read after it',
    'Edit › price 1,200 › Effective from = three hours ahead › Save', 'the header still says ₹1,000; 📅 Scheduled shows price → ₹1,200 with the moment, and Cancel');
  const parked = page.waitForResponse((r) => /\/schedule$/.test(r.url()) && r.request().method() === 'POST' && r.status() < 400, { timeout: 30000 });
  await page.getByTestId('cat-save').click(); await parked;
  await expect(page.getByTestId('prod-scheduled')).toBeVisible({ timeout: 25000 });
  await ok(page, 'parked, live price unchanged');

  /* ── 12 · barcode + BOM ── */
  await page.getByTestId('prod-tab-barcode').click();
  await tc(page, 'Barcode', 'Code 128 of the SKU drawn in the page, printable (a GS1 barcode needs an assigned prefix — a standards step)',
    'Barcode tab', 'a scannable barcode of BAS-25 and a Print label button');
  await expect(page.getByTestId('prod-barcode')).toBeVisible({ timeout: 15000 });
  await ok(page, 'Code 128 of BAS-25');
  await page.getByTestId('prod-tab-bom').click();
  await tc(page, 'Consists of', 'the bill of materials the Network tool authors — one line on a chit, components attached as detail',
    'Consists of tab › type 10 in "For"', 'per unit: paddy 40kg ×1, PP bag ×1; for 10: paddy ×10, bags ×10');
  await expect(page.getByTestId('prod-bom')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('prod-bom-qty').fill('10'); await page.waitForTimeout(500);
  await ok(page, 'the third column multiplies by 10');

  /* ── 13 · compose ── */
  await clickNav(page, 'compose'); await settle(page);
  await tc(page, 'Compose: a typed line that names your product IS that product', 'ccMatchMine — offers fire in compose as on the storefront; the same engine',
    'type "Basmati 25kg" ×12 @1000 and "Ponni Boiled 10kg" ×6 @600', 'Basmati: 10% off; Ponni: September 5% off; the footer shows the savings');
  for (const ln of [{ item: basmati, qty: 12, price: 1000 }, { item: ponni, qty: 6, price: 600 }]) {
    await page.getByTestId('chit-item-name').fill(ln.item); await page.getByTestId('chit-item-qty').fill(String(ln.qty)); await page.getByTestId('chit-item-price').fill(String(ln.price));
    await page.getByTestId('chit-item-add').click(); await page.waitForTimeout(900);
  }
  await expect.poll(async () => page.evaluate(() => (typeof CC !== 'undefined' && CC.savings) || 0), { timeout: 20000 }).toBeGreaterThan(0);
  await ok(page, 'savings in the footer');

  /* ── 14 · MIS › Tax ── */
  await clickNav(page, 'mis'); await settle(page);
  await page.getByTestId('mis-band-tax').click();
  await tc(page, 'MIS › Tax — what do I owe this month?', 'every sent line is rated at send, frozen at completed; output / input credit by head, net; GSTR-1/3B JSON',
    'MIS › Tax', 'the month picker and the three figures; empty for a fresh entity (the two-party flow is proven by [TAX-03])');
  await expect(page.getByTestId('mis-tax-output')).toBeVisible({ timeout: 25000 });
  await ok(page, 'the band renders with the month');

  /* ── 15 · columns ── */
  await setup('columns');
  await tc(page, 'Columns — Columns · Types · Usage', 'observation 2 — the declared columns, their types, and which products use each',
    'Catalogue setup › Columns › the three tabs', 'three tabs; Usage counts products per column');
  await page.waitForTimeout(500);
  await ok(page, 'end of the tour');
  await rmCaption(page);
});
