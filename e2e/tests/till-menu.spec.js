// [TILL-31] THE COUNTER MENU, PHONE FIRST — Athi's own menu style (quick-keys-design-handoff_2 /
// mobile-first-instructions.md §4), checked at the two widths that decide its shape.
//
// Athi, 2026-09-18: *"i gave a different menu style, so it can fit into mobile also"* — so the thing worth
// testing is not that the menu exists but that it CHANGES SHAPE and still carries everything: a full-height
// sheet with folded sections on a phone, a centred card on a terminal, the same five groups in the same order
// at both, and no horizontal scroll at 390px (§7's first acceptance line for every screen).
const { test, expect } = require('@playwright/test');
const { mintEntity, addProduct } = require('../fixtures');
const TILL = process.env.CB_TILL_BASE || '';

/** §4: "Groups, in this order, always" — the order is the design, so the test states it literally. */
const ORDER = ['Bills', 'Shop & prices', 'This counter', 'How it looks', 'Careful'];

test('[TILL-31] the counter menu folds on a phone, opens out on a terminal, and drops nothing either way', async ({ page, context }) => {
  test.setTimeout(240000);
  await mintEntity(page, { fresh: true, name: 'menu' + Date.now().toString(36) });
  await addProduct(page, { name: 'Filter Coffee', unit: 'cup', price: 25, code: 'FC31' });
  const key = await page.evaluate(async () => {
    if (typeof ensureCap === 'function') await ensureCap('admin');
    const r = await api('keysMint', { body: { name: 'menu counter', scopes: ['till'], days: 1 } });
    return (r && (r.key || r.api_key)) || null;
  });

  const till = await context.newPage();
  await till.setViewportSize({ width: 390, height: 844 });          // a phone, the base range
  await till.goto(TILL + '/till.html#key=' + encodeURIComponent(key));
  await till.waitForFunction(() => typeof paintMenu === 'function', null, { timeout: 40000 });

  await test.step('base (390) — a sheet, five sections in order, folded, with Bills open', async () => {
    await till.evaluate(() => toggleMenu());
    const m = till.locator('#tillmenu');
    await expect(m).toBeVisible();

    const titles = await till.evaluate(() => [...document.querySelectorAll('.msec .mrow .mt b')].map((b) => b.textContent.trim()));
    expect(titles, 'the five groups, in the order the design fixes them').toEqual(ORDER);

    /* §4: accordion — Bills open by default, only one at a time */
    const open = await till.evaluate(() => [...document.querySelectorAll('.msec .mbody')].map((b) => !b.hidden));
    expect(open, 'exactly one section open, and it is Bills').toEqual([true, false, false, false, false]);

    /* it is a SHEET here: it fills the screen rather than floating as a card */
    const box = await m.boundingBox();
    expect(box.width, 'a sheet spans the phone').toBeGreaterThan(380);

    /* §7: no horizontal scroll at any width, menu open or not */
    const scrolls = await till.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(scrolls, 'the page scrolls sideways on a phone').toBe(false);
  });

  await test.step('⭐ opening another section closes the first — one at a time, as the design says', async () => {
    await till.evaluate(() => menuSection('look'));
    const open = await till.evaluate(() => [...document.querySelectorAll('.msec .mbody')].map((b) => !b.hidden));
    expect(open).toEqual([false, false, false, true, false]);
    /* "How it looks" holds the three selects — folded away, never dropped (§2 rule 1) */
    await expect(till.locator('[data-testid="till-mq-fs"]')).toBeVisible();
    await expect(till.locator('[data-testid="till-mq-theme"]')).toBeVisible();
    await expect(till.locator('[data-testid="till-mq-layout"]')).toBeVisible();
  });

  await test.step('⚠️ Careful is last, says what it costs, and holds both stopping actions', async () => {
    await till.evaluate(() => menuSection('care'));
    const care = till.locator('[data-testid="till-msec-care"]');
    await expect(care).toContainText('These two stop billing for a moment. Everything is sent and checked first.');
    await expect(care.locator('[data-testid="till-close"]')).toBeVisible();
    await expect(care.locator('[data-testid="till-coldstart-menu"]')).toBeVisible();
  });

  await test.step('⭐ Escape closes it, and the caret goes back to the search box so the next scan lands', async () => {
    await till.keyboard.press('Escape');
    await expect(till.locator('#tillmenu')).toBeHidden();
    await expect(till.locator('#q')).toBeFocused();
  });

  await test.step('md/lg (1366) — the same five, now a centred card, still nothing dropped', async () => {
    await till.setViewportSize({ width: 1366, height: 768 });
    await till.evaluate(() => toggleMenu());
    const titles = await till.evaluate(() => [...document.querySelectorAll('.msec .mrow .mt b')].map((b) => b.textContent.trim()));
    expect(titles, 'the order never changes between a phone and a terminal (§2 rule 2)').toEqual(ORDER);

    const box = await till.locator('#tillmenu').boundingBox();
    expect(box.width, 'a card, not a full-width sheet, on a terminal').toBeLessThan(1000);
    expect(box.x, 'and it is centred').toBeGreaterThan(100);

    const scrolls = await till.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(scrolls).toBe(false);
    await till.keyboard.press('Escape');
  });

  await test.step('⭐ every operation the rail offers is one the menu offers too — one list, two doors', async () => {
    const same = await till.evaluate(() => {
      const railIds = [...document.querySelectorAll('#tillrail [data-testid^="till-rail-"]')]
        .map((b) => b.dataset.testid.replace('till-rail-', ''))
        .filter((x) => x !== 'pin' && x !== 'cb');
      const menuIds = TILL_MENU.reduce((a, s) => a.concat(s.ops || []), []);
      return { railIds, menuIds };
    });
    for (const id of same.railIds) {
      expect(same.menuIds, 'the rail offers ' + id + ' and the menu does not — the two doors have drifted').toContain(id);
    }
  });
});
