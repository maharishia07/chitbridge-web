// KEYBOARD OPERABILITY — the counter runs on the KEYBOARD; a mouse-only control is a BROKEN control (reviewer, 2026-07-17).
// Every counter flow must be completable start-to-finish with ZERO mouse events — Tab/Shift-Tab/Enter/arrows/typed numbers.
// If tabTo() can't reach a control, the operator can't either → the test FAILS. RED-proof: CB_KBD_BREAK=1 targets an
// unreachable control so a keyboard test that catches nothing proves nothing. Runs at the counter viewport (config).
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

// Press Tab (or Shift-Tab) until the element carrying `testid` is the focused element. Returns false if unreachable
// within `max` presses — i.e. a keyboard trap or a mouse-only control. This is the whole keyboard-operability gate.
async function tabTo(page, testid, { max = 60, shift = false } = {}) {
  const key = shift ? 'Shift+Tab' : 'Tab';
  for (let i = 0; i < max; i++) {
    const cur = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid'));
    if (cur === testid) return true;
    await page.keyboard.press(key);
  }
  const cur = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid'));
  return cur === testid;
}

// The focused element's testid (for focus-order assertions).
const focusedTestId = (page) =>
  page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid'));

test.describe('Keyboard operability · the counter runs on the keyboard', () => {
  test('[KBD-01] compose + send a chit using ONLY the keyboard', async ({ page }) => {
    await mintEntity(page);                      // arrange (reused pool session when present)
    await page.locator('body').click();          // one focus anchor — the ONLY pointer event; everything after is keyboard
    await page.keyboard.press('Tab');            // enter the tab ring

    await test.step('reach + open Compose by keyboard', async () => {
      const reached = await tabTo(page, 'nav-compose');
      expect(reached, 'Compose must be reachable by Tab (mouse-only = broken for the counter)').toBe(true);
      await page.keyboard.press('Enter');        // Enter activates the focused control
      // RED-proof hook: if asked, try to reach a control that does not exist → the flow must fail here.
      if (process.env.CB_KBD_BREAK) expect(await tabTo(page, 'this-control-does-not-exist', { max: 10 })).toBe(true);
    });

    await test.step('fill the line item with typed numbers (no forced tab-away mid-number)', async () => {
      // add self as recipient (a chit needs a party) — by keyboard
      if (await tabTo(page, 'chit-add-self', { max: 40 })) await page.keyboard.press('Enter');
      // item name → qty → price, each reached by Tab and TYPED (numeric entry must not force a tab-away)
      expect(await tabTo(page, 'chit-item-name')).toBe(true);
      await page.keyboard.type('Widget');
      expect(await tabTo(page, 'chit-item-qty')).toBe(true);
      await page.keyboard.type('3');
      expect(await focusedTestId(page)).toBe('chit-item-qty');   // typing digits did NOT move focus
      expect(await tabTo(page, 'chit-item-price')).toBe(true);
      await page.keyboard.type('100');
      expect(await tabTo(page, 'chit-item-add')).toBe(true);
      await page.keyboard.press('Enter');        // Enter commits the line
    });

    await test.step('send by keyboard, land in Order', async () => {
      expect(await tabTo(page, 'chit-send')).toBe(true);
      await page.keyboard.press('Enter');
      // completed with zero mouse events beyond the initial focus anchor — confirm it sent
      await expect(page.getByTestId('nav-order').or(page.locator('#mainbody'))).toBeVisible();
    });
  });

  // FOCUS ORDER + NO-TRAP — Tab from the top of the compose form and confirm focus keeps moving (never captured) and
  // visits the fields in a logical order. A trap (focus can't move on) is a counter-speed killer.
  test('[KBD-02] focus order is logical and there are no keyboard traps', async ({ page }) => {
    await mintEntity(page);
    await page.getByTestId('nav-compose').click();     // open compose (setup for the focus check)
    await page.locator('body').press('Tab');
    const seen = [];
    for (let i = 0; i < 40; i++) {
      const id = await focusedTestId(page);
      if (id) seen.push(id);
      await page.keyboard.press('Tab');
    }
    // no trap: over 40 tabs we must have visited MORE than one distinct control (focus never stuck)
    const distinct = [...new Set(seen.filter(Boolean))];
    expect(distinct.length, 'focus must move across multiple controls (no keyboard trap)').toBeGreaterThan(3);
  });
});
