// THE TWO-PARTY TOUR — one trade carried across two parties, two windows.
//   LEFT: the SELLER's app (a fresh entity: a product with a price, a tax slab, an offer, a public storefront).
//   RIGHT: the BUYER's storefront (shop.html, no app login — a customer identified by a phone/email OTP).
// The buyer orders; the seller's window RINGS (the mailbox bell, no timer); the seller opens the order chit, whose
// invoice carries the tax and the offer the buyer already saw. Narrated like tour.spec.js (captions on both windows).
//
// Run (on screen):  NODE_OPTIONS=--max-old-space-size=4096 TOUR=1 TOUR_HEADED=1 TOUR_PAUSE=8000 npx playwright test tests/tour-two.spec.js --headed --project=authed
// Headless proof:   TOUR=1 npx playwright test tests/tour-two.spec.js --project=authed
const { test, expect } = require('@playwright/test');
const { mintEntity, addProduct, clickNav, settle, openTab } = require('../fixtures');

const PAUSE = Number(process.env.TOUR_PAUSE || 8000);
const HEADED = !!process.env.TOUR_HEADED || process.argv.includes('--headed');
const DEV_OTP = process.env.CB_DEV_OTP || '123456';
const API = process.env.CB_API_BASE || 'https://chitbridge-api-production.up.railway.app';
let N = 0;

/* the caption: same look as the single tour, tagged with the window it is on */
async function caption(page, who, title, testing, steps, expected) {
  N += 1; const n = N;
  await page.evaluate(({ n, who, title, testing, steps, expected }) => {
    let el = document.getElementById('cb_tour'); if (!el) { el = document.createElement('div'); el.id = 'cb_tour'; document.body.appendChild(el); }
    el.setAttribute('style', 'position:fixed;right:16px;bottom:72px;z-index:99999;max-width:560px;pointer-events:none;background:#111;color:#fff;padding:14px 18px;border-radius:12px;font:14px/1.45 system-ui;box-shadow:0 8px 30px rgba(0,0,0,.35)');
    const esc = (s) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    el.innerHTML = '<div style="font-size:11px;letter-spacing:.08em;opacity:.7">' + esc(who) + ' · CASE ' + n + '</div><div style="font-size:17px;font-weight:700;margin:2px 0 6px">' + esc(title) + '</div>'
      + '<div><b>Testing</b> ' + esc(testing) + '</div><div><b>Steps</b> ' + esc(steps) + '</div><div><b>Expected</b> ' + esc(expected) + '</div>';
  }, { n, who, title, testing, steps, expected }).catch(() => {});
  console.log('[tour-two] ' + new Date().toISOString().slice(11, 19) + ' case ' + n + ' (' + who + '): ' + title);
  if (HEADED) await page.waitForTimeout(PAUSE);
}
async function ok(page, observed) {
  await page.evaluate((o) => { const el = document.getElementById('cb_tour'); if (el) el.insertAdjacentHTML('beforeend', '<div style="margin-top:8px;color:#8ef0a1"><b>Observed</b> ' + String(o).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</div>'); }, observed).catch(() => {});
  console.log('[tour-two] ok: ' + observed);
  if (HEADED) await page.waitForTimeout(Math.min(PAUSE, 4000));
}

test('the two-party tour: a buyer orders, the seller rings, the invoice carries the tax and the offer', async ({ browser, page: seller }) => {
  test.setTimeout(600000);
  const buyerCtx = await browser.newContext({ viewport: { width: 480, height: 900 } });
  const buyer = await buyerCtx.newPage();
  const PRODUCT = 'Basmati 25kg', PRICE = 1000, QTY = 6;

  /* ── SELLER: the shelf ── */
  await mintEntity(seller);
  await caption(seller, 'SELLER', 'A fresh business, one product', 'the product page: price, unit, code — the contract the storefront and the invoice will both read',
    'Catalogue › + New product › Basmati 25kg · ₹1,000 / bag · BAS-25', 'the product is on the shelf with its price');
  await clickNav(seller, 'catalogue');
  await addProduct(seller, { name: PRODUCT, unit: 'bag', price: PRICE, code: 'BAS-25' });
  const pid = await seller.evaluate(() => UI.prodSel); expect(pid).toBeTruthy();
  await ok(seller, 'Basmati 25kg · ₹1,000 / bag');

  await caption(seller, 'SELLER', 'Tax and an offer, attached once', 'a GST 5% slab and a 10% offer attached to the product — the storefront basket and the invoice both compute from these, same engine',
    'API: slab GST 5% → attach; offer 10% off → attach', 'the product page reads GST 5% · 10% off');
  /* the same calls OM-01 makes: a live tax definition cited by the product, a live percent-off offer aimed at it */
  await seller.evaluate(async ({ pid }) => {
    const slab = (await api('defAdd', { body: { kind: 'tax', name: 'GST 5', rules: { rate: 5 }, status: 'live' } })).definition.definition_id;
    await api('defAdd', { body: { kind: 'offer', name: 'Basmati 10% off', sub_kind: 'percent_off', rules: { kind: 'percent_off', percent: 10, applies_to: { item_ids: [pid] } }, status: 'live' } });
    const r = await api('prodList', { query: { limit: 50 } }); const p = (r.items || r || []).find((x) => (x.item_id || x.id) === pid);
    await api('prodEdit', { params: { id: pid }, body: { item_data: Object.assign({}, p.item_data, { tax_slab: slab }) } });
    await cbDefsLive('tax', true); UI._ctOffers = undefined; await new Promise((ok) => ctOffersEnsure(ok));
    await loadCatalogue('fresh');
  }, { pid });
  await ok(seller, 'attached; the product page will show both');

  await caption(seller, 'SELLER', 'The storefront goes public', 'catalogue visibility public → a handle any customer can open; the storefront row shows the product as the customer sees it',
    'Storefront row › Shown', 'a link localhost/shop.html?s=<handle> and the phone-width preview');
  const handle = await seller.evaluate(async () => {
    await api('saveProfile', { body: { catalogue_visibility: 'public', gstn: '29ABCDE1234F1Z5', address: '12 Market Road, Bengaluru' } });
    const me = await api('me'); const e = (me && me.entity) || me || {};
    return e.user_id || e.bridge_id || null;   /* the storefront handle, as prodShopHandle reads it */
  });
  expect(handle).toBeTruthy();
  await ok(seller, 'storefront handle: ' + handle);

  /* ── BUYER: the storefront ── */
  await caption(buyer, 'BUYER', 'A customer opens the shop', 'shop.html — the public catalogue payload carries price, offers, categories and the resolved tax per item',
    'open shop.html?s=' + handle, 'the product with its price; the offer badge under it');
  await buyer.goto('/shop.html?s=' + encodeURIComponent(handle), { waitUntil: 'load' });
  await expect(buyer.getByText(PRODUCT).first()).toBeVisible({ timeout: 40000 });
  await ok(buyer, 'Basmati 25kg is on the storefront');

  await caption(buyer, 'BUYER', 'Six bags in the basket', 'the basket: listed price → the offer comes off → GST 5% on the after-offers figure → total incl. tax — the same numbers the seller\'s invoice will show',
    '+ six times', 'Goods/After offers · GST 5% · Total incl. tax');
  const plus = buyer.locator('button:has-text("+")').first(); await plus.waitFor({ timeout: 30000 });
  for (let i = 0; i < QTY; i++) { await plus.click(); await buyer.waitForTimeout(150); }
  await expect(buyer.getByTestId('shop-total')).toBeVisible({ timeout: 20000 });
  const basket = await buyer.evaluate(() => ({ tax: [...document.querySelectorAll('[data-testid=shop-tax]')].map((x) => x.textContent.trim()), total: (document.querySelector('[data-testid=shop-total]') || {}).textContent }));
  await ok(buyer, 'basket: ' + basket.tax.join(' · ') + ' · total ' + basket.total);

  await caption(buyer, 'BUYER', 'Order with a phone number and a code', 'the customer rail: /order/start (OTP to the contact) → /order/confirm — the order becomes a CHIT delivered to the seller, priced by the server with the live offers',
    'Checkout › contact › Send code › 123456 › Place order', 'Order placed');
  /* the seller's window listens at the one seam the client owns — the arrival is asserted, not assumed */
  await seller.evaluate(() => { window.__cbArrived = []; const orig = window.cbPushArrived; window.cbPushArrived = function (d) { window.__cbArrived.push(d); return orig(d); }; });
  /* the compact bar ("🛒 6 ✕") opens into the cart, where Checkout lives */
  if (!(await buyer.getByTestId('cart-checkout').isVisible().catch(() => false))) { await buyer.locator('[data-testid^="cart-cbcart"]').first().click(); }
  await buyer.getByTestId('cart-checkout').click({ timeout: 20000 });
  /* the checkout is a four-step sheet — Items → Delivery → Review → Who you are; "Next" carries it to the contact step */
  for (let i = 0; i < 5 && !(await buyer.getByTestId('shop-contact').isVisible().catch(() => false)); i++) {
    /* Delivery asks where and when before it lets you on */
    if (await buyer.getByTestId('shop-area').isVisible().catch(() => false)) {
      await buyer.getByTestId('shop-area').fill('Perumbakkam, Chennai 600126');
      const d = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const dt = buyer.getByTestId('shop-date'); if (await dt.isVisible().catch(() => false)) { await dt.fill(d).catch(async () => { await dt.type(d); }); }
      const tm = buyer.getByTestId('shop-time'); if (await tm.isVisible().catch(() => false)) {
        const tag = await tm.evaluate((el) => el.tagName + ':' + (el.type || ''));
        if (/SELECT/.test(tag)) await tm.selectOption({ index: 1 }).catch(() => {}); else await tm.fill(/time/.test(tag) ? '10:00' : 'morning').catch(() => {});
      }
    }
    const next = buyer.getByRole('button', { name: /Next|Continue/i }).first();   /* Review says "Continue →" */
    if (await next.isVisible().catch(() => false)) { await next.click({ timeout: 10000 }); await buyer.waitForTimeout(400); } else break;
  }
  /* Who you are: a name and a contact; ONE button carries both halves — "Send me a code", then "Place order" */
  const nameBox = buyer.getByTestId('shop-name'); if (await nameBox.isVisible().catch(() => false)) await nameBox.fill('Priya (buyer)');
  await buyer.getByTestId('shop-contact').fill('buyer' + Date.now().toString().slice(-6) + '@example.com');
  const submit = buyer.locator('[data-testid="shop-cart-submit"], [data-testid="shop-send-code"]').first();
  const started = buyer.waitForResponse((r) => /\/order\/start$/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 });
  await submit.click({ timeout: 20000 }); const sr = await started;
  const sj = await sr.json().catch(() => ({})); const otp = sj.dev_otp || DEV_OTP;
  const otpBox = buyer.locator('[data-testid="shop-otp"], #o_otp, input[inputmode="numeric"]').first();
  await otpBox.waitFor({ timeout: 20000 }); await otpBox.fill(otp);
  const confirmed = buyer.waitForResponse((r) => /\/order\/confirm$/.test(r.url()) && r.request().method() === 'POST', { timeout: 45000 });
  await buyer.locator('[data-testid="shop-cart-submit"], [data-testid="shop-place-order"]').first().click({ timeout: 20000 }); const cr = await confirmed;
  const cj = await cr.json().catch(() => ({}));
  expect(cr.status(), JSON.stringify(cj).slice(0, 200)).toBeLessThan(400);
  await ok(buyer, (cj.message || 'placed') + ' · chit ' + String(cj.chit_id || '').slice(0, 8));

  /* ── SELLER: the bell ── */
  await caption(seller, 'SELLER', 'The bell rings — no timer', 'the mailbox bell: the seller\'s tab held one push stream since sign-in; the order\'s commit rang it; only the badge and the list refresh',
    'nothing — watch', 'a toast "New chit · <buyer>", the Task list shows the order');
  await seller.waitForFunction(() => Array.isArray(window.__cbArrived) && window.__cbArrived.length > 0, null, { timeout: 30000 });
  const bell = await seller.evaluate(() => window.__cbArrived[0]);
  expect(bell.kind).toBe('chit');
  await clickNav(seller, 'task');
  await expect(seller.getByText(PRODUCT).first()).toBeVisible({ timeout: 40000 });
  await ok(seller, 'the bell rang (' + (bell.who ? bell.who + ' · ' : '') + bell.note + ') · the order is on the Task list');

  await caption(seller, 'SELLER', 'The order chit: the same numbers', 'the chit the buyer\'s order became: 6 × Basmati 25kg, the offer applied, GST 5% — priced by the server, not by the browser',
    'open the chit', 'lines, offer, tax, total match the basket');
  await seller.getByText(PRODUCT).first().click();
  await settle(seller);
  const detailText = await seller.evaluate(() => (document.getElementById('detailpane') || document.body).innerText.slice(0, 2000));
  expect(detailText).toContain(PRODUCT);
  const money = (detailText.match(/₹\s?[\d,]+(?:\.\d+)?/g) || []).slice(0, 6).join(' · ');
  await ok(seller, 'chit open: ' + PRODUCT + ' × ' + QTY + (money ? ' · ' + money : ''));
  const chitId = await seller.evaluate(() => UI.sel || (UI.detail && (UI.detail.id || UI.detail.chit_id)) || null);
  expect(chitId).toBeTruthy();

  /* ── SELLER: the rest of the cycle ── */
  await caption(seller, 'SELLER', 'The invoice, before anything is frozen', 'GET /tax/invoice/:id — the order line resolves its rate from the seller\'s catalogue (item id → slab); provisional until completed',
    'API: taxInvoice', 'AssAmt 5,400 · GST 5% → 270 · TotItemVal 5,670 — the buyer\'s basket, to the rupee');
  const inv0 = await seller.evaluate(async (id) => api('taxInvoice', { params: { id } }), chitId);
  const v0 = (inv0 && inv0.invoice && inv0.invoice.ValDtls) || {};
  const tax0 = Math.round(((v0.IgstVal || 0) + (v0.CgstVal || 0) + (v0.SgstVal || 0)) * 100) / 100;
  const diag = await seller.evaluate(async (id) => { const c = await api('chit', { params: { id } }); const ch = c.chit || c; const ls = c.line_items || ch.line_items || ch.lines || []; return { n: ls.length, first: ls[0] ? Object.keys(ls[0]).filter((k) => /item_id|name|particulars|gst|tax|rate|hsn|unit_price|quantity|qty/.test(k)).reduce((o, k) => (o[k] = ls[0][k], o), {}) : null }; }, chitId);
  expect(inv0.frozen).toBeFalsy();
  expect(tax0, 'rated ' + inv0.rated + ' · unrated ' + inv0.unrated + ' · item ' + JSON.stringify(((inv0.invoice || {}).ItemList || [])[0] || null) + ' · val ' + JSON.stringify(v0) + ' · cb ' + JSON.stringify((inv0.invoice || {})._cb || null) + ' · seller ' + JSON.stringify((inv0.invoice || {}).SellerDtls || null) + ' · buyer ' + JSON.stringify((inv0.invoice || {}).BuyerDtls || null)).toBe(270);
  await ok(seller, 'provisional · taxable ' + v0.AssVal + ' · tax ' + tax0 + ' · total ' + v0.TotInvVal);

  await caption(seller, 'SELLER', 'Status: Act, then Close — through the control', 'the status picker on the chit; Close completes the copy and FREEZES the invoice on it (rate at send → freeze at completed)',
    'Change status › Act › OK · Change status › Close › OK', 'the chit reads completed; the invoice is frozen');
  for (const v of ['act', 'close']) {
    await seller.getByTestId('chit-status-btn').click();
    await seller.locator('.optrow[data-v="' + v + '"]').first().click();
    const put = seller.waitForResponse((r) => /\/status$/.test(r.url()) && r.request().method() === 'PUT', { timeout: 30000 }).catch(() => null);
    await seller.locator('#mok').click();
    await put; await settle(seller);
  }
  const after = await seller.evaluate(async (id) => { const c = await api('chit', { params: { id } }); const inv = await api('taxInvoice', { params: { id } }); return { status: (c.chit || c).status, frozen: !!inv.frozen, tax: Math.round((((inv.invoice || {}).ValDtls || {}).IgstVal + ((inv.invoice || {}).ValDtls || {}).CgstVal + ((inv.invoice || {}).ValDtls || {}).SgstVal) * 100) / 100 }; }, chitId);
  expect(after.frozen).toBe(true);
  expect(after.tax).toBe(270);
  await ok(seller, 'status ' + after.status + ' · invoice frozen · tax ' + after.tax);

  await caption(seller, 'SELLER', 'MIS › Tax: what I owe this month', 'the ledger: every sent line rated at send, frozen at completed; output by head; this order is the month\'s output tax',
    'MIS › Tax', 'output tax includes 270');
  await clickNav(seller, 'mis'); await settle(seller);
  await seller.getByTestId('mis-band-tax').click();
  await expect(seller.getByTestId('mis-tax-output')).toContainText('270', { timeout: 30000 });
  await ok(seller, 'output tax for the month shows 270 — the trade is on the books');

  await buyerCtx.close();
});
