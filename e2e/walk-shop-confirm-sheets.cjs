#!/usr/bin/env node
/**
 * e2e/walk-shop-confirm-sheets.cjs - THE SHOP ASKS BEFORE IT SENDS, AND ITS SHEETS WORK BY KEYBOARD (UX-6, 2026-11-12).
 * Black box: the real shop.html and know-your-business.html with a stand-in api; every action on the shop is a key (Enter, Tab, Shift+Tab, Escape).
 *   P1  Place order (Enter) opens the page-level confirm: the shop, the lines, the total, the contact; NO order has been posted yet
 *   P2  Escape on that confirm posts nothing; Cancel posts nothing; Place order in it posts exactly one order
 *   K1  a sheet opens with the focus INSIDE it, and Tab (and Shift+Tab) never leaves it
 *   K2  Escape closes the sheet and the focus goes back to the control that opened it (Report a problem, My orders)
 *   K3  the order sheet is a dialog for a screen reader (role, modal, a name) and its x has a name
 *   B1  Know your business at 390x844: the credential-name placeholder is shown whole (not cut), no sideways scroll
 * It must FAIL on main: there Place order posts at once, Escape does nothing on a sheet, Tab walks out behind it, the placeholder is cut.
 *   NODE_PATH=<dir with playwright> node e2e/walk-shop-confirm-sheets.cjs
 */
'use strict';
const W = require('./lib/walk.cjs');
const J = (o, status) => ({ status: status || 200, contentType: 'application/json', body: JSON.stringify(o) });
const SHOP = 'CBSIMCFM';
const view = { available: true, visibility: 'public', categories: [],
  shop: { bridge_id: SHOP, display_name: 'Sim Confirm Store', currency_code: 'INR', gstn: null, country: 'IN', is_verified: true, business_status: 'open',
    storefront_access: 'browse', unit_rules: {}, showcase: { template: null, sections: [] }, viewer_groups: [], connector: null,
    order_input: { preset: 'cart', pipeline: 'commerce', showsPrice: true, negotiable: false, schema: null, documents: [] }, order_method: 'cart' },
  schema: null, fields: [], offers: [],
  items: [{ item_id: 'i1', item_data: { name: 'Basmati rice 5 kg', unit: 'bag', price: 640 } }] };
const SHOTS = process.env.WALK_SHOTS || 'e2e/shots';

/** the keys: Tab count until the focus is back where it started proves a trap; returns where each press landed */
async function tabLoop(page, presses, key) {
  const where = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press(key);
    where.push(await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.contains(document.activeElement); }));
  }
  return where;
}

W.run('shop-confirm-sheets', async (w) => {
  const { page } = w;
  const posts = [];
  await page.route('**/api/**', (r) => r.fulfill(J({ ok: true })));
  await page.route('**/api/catalogue/' + SHOP, (r) => r.fulfill(J(view)));
  await page.route('**/api/catalogue/' + SHOP + '?*', (r) => r.fulfill(J(view)));
  await page.route('**/api/catalogue/' + SHOP + '/order/start', (r) => r.fulfill(J({ message: 'Code sent', channel: 'phone' })));
  await page.route('**/api/catalogue/' + SHOP + '/order/confirm', (r) => { posts.push(r.request().postDataJSON()); return r.fulfill(J({ message: 'Placed', chit_id: 'abcdef12-0000-4000-8000-000000000000', token: 'tok', summary: { total_value: 640 } })); });
  await page.route('**/api/catalogue/' + SHOP + '/support/preview', (r) => r.fulfill(J({ to: 'the shop', can_send: true })));
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(w.base + '/shop.html?s=' + SHOP + '&api=' + encodeURIComponent(w.base));
  await page.waitForSelector('[data-testid="shop-head"]', { timeout: 15000 });

  /* the basket: add one product, open Check out, Delivery -> Continue ... -> Who you are -> Send me a code -> the code (all by keys) */
  await page.locator('[data-testid="cart-add"]').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  if (!(await page.locator('[data-testid="cart-checkout"]').isVisible().catch(() => false))) await page.locator('[data-testid="shop-dock"] .cbcart-bar').first().click();
  await page.locator('[data-testid="cart-checkout"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="shop-mode-delivery"]', { timeout: 8000 });
  await page.locator('[data-testid="shop-mode-delivery"]').focus();
  await page.keyboard.press('Enter');
  await page.fill('[data-testid="shop-area"]', '600001');
  for (let i = 0; i < 4 && !(await page.locator('[data-testid="shop-contact"]').count()); i++) {
    await page.locator('[data-testid^="step-next-"]').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  }
  await page.fill('[data-testid="shop-contact"]', '9876543210');
  await page.locator('[data-testid="shop-cart-submit"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="shop-otp"]', { timeout: 8000 });
  await page.fill('[data-testid="shop-otp"]', '123456');

  await w.step('K3', 'the order sheet is a dialog with a name, and its x button has a name', async () => {
    const m = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); const x = d && d.querySelector('[data-cbsid="SHP001-B15"]');
      return { role: !!d, modal: d && d.getAttribute('aria-modal'), name: d && d.getAttribute('aria-label'), x: x && x.getAttribute('aria-label') }; });
    return { ok: m.role && m.modal === 'true' && /Sim Confirm Store/.test(m.name || '') && m.x === 'Close', saw: JSON.stringify(m) };
  });
  await w.step('K1', 'the order sheet holds the focus: ten Tab and ten Shift+Tab never leave it', async () => {
    const fwd = await tabLoop(page, 10, 'Tab'), back = await tabLoop(page, 10, 'Shift+Tab');
    return { ok: fwd.every(Boolean) && back.every(Boolean), saw: 'Tab inside ' + fwd.filter(Boolean).length + '/10 · Shift+Tab inside ' + back.filter(Boolean).length + '/10' };
  });
  await w.step('P1', 'Place order (Enter) asks first: shop, lines, total, contact; nothing is posted yet', async () => {
    await page.locator('[data-testid="shop-cart-submit"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const t = await page.evaluate(() => { const d = document.querySelector('[data-testid="confirm"]'); return d && d.open ? d.innerText : ''; });
    const ok = /Place this order/.test(t) && /Sim Confirm Store/.test(t) && /Basmati rice 5 kg/.test(t) && /640/.test(t) && /9876543210/.test(t) && posts.length === 0;
    await page.screenshot({ path: SHOTS + '/shop-confirm-1366.png' }).catch(() => null);
    return { ok, saw: 'confirm: "' + t.replace(/\s+/g, ' ').slice(0, 170) + '" · orders posted ' + posts.length };
  });
  await w.step('P2', 'Escape posts nothing, Cancel posts nothing, Place order in the confirm posts exactly one', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const goneA = await page.evaluate(() => !document.querySelector('[data-testid="confirm"]'));
    const sheetStays = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    await page.locator('[data-testid="shop-cart-submit"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="confirm"]');
    await page.locator('[data-testid="confirm-cancel"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const afterNo = posts.length;
    await page.locator('[data-testid="shop-cart-submit"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="confirm"]');
    await page.locator('[data-testid="confirm-ok"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    return { ok: goneA && sheetStays && afterNo === 0 && posts.length === 1, saw: 'Escape closed only the question: ' + goneA + ' (sheet stays ' + sheetStays + ') · after Escape and Cancel ' + afterNo + ' orders · after the yes ' + posts.length };
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await w.step('K2', 'a sheet opened by key: focus goes in, Tab stays in, Escape closes it and focus returns to the opener (Report a problem, My orders)', async () => {
    const out = [];
    for (const id of ['shop-support', 'shop-my-orders-link']) {
      await page.locator('[data-testid="' + id + '"]').focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const inside = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.contains(document.activeElement); });
      const trapped = (await tabLoop(page, 8, 'Tab')).every(Boolean);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const closed = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
      const back = await page.evaluate((i) => (document.activeElement && document.activeElement.getAttribute('data-testid')) === i, id);
      out.push(id + ': in ' + inside + ' trapped ' + trapped + ' closed ' + closed + ' back ' + back);
      if (!(inside && trapped && closed && back)) return { ok: false, saw: out.join(' · ') };
    }
    return { ok: true, saw: out.join(' · ') };
  });

  /* B1 · Know your business at 390 */
  await page.route('**/api/kyb/yourself', (r) => r.fulfill(J({ facts: { credentials: [], summary: {} } })));
  await page.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) { /* no storage: the page shows its own sign-in */ } }, W.session('Fixture Owner', 'Fixture Shop'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(w.base + '/know-your-business.html');
  await page.waitForSelector('#nc_title', { timeout: 15000 });
  await page.screenshot({ path: SHOTS + '/kyb-390.png' }).catch(() => null);
  await w.step('B1', 'Know your business at 390x844: the credential-name placeholder is shown whole, nothing scrolls sideways', async () => {
    const m = await page.evaluate(() => {
      const i = document.getElementById('nc_title'), cs = getComputedStyle(i), c = document.createElement('canvas').getContext('2d');
      c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      const room = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return { need: Math.ceil(c.measureText(i.placeholder).width), room: Math.floor(room), side: document.documentElement.scrollWidth - innerWidth, text: i.placeholder };
    });
    return { ok: m.need <= m.room && m.side <= 0, saw: '"' + m.text + '" needs ' + m.need + ' px, the box has ' + m.room + ' px · sideways overflow ' + m.side + ' px' };
  });
});
