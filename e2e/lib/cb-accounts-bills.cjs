/* e2e/lib/cb-accounts-bills.cjs — CB ACCOUNTS walk, the BILLS step that follows the two tabs: a bill opens the chit sheet in place (no new tab), and BD-F-02 (a fresh visit opens the side that has something open, a tab the owner picks stays). Split out of e2e/cb-accounts.cjs, steps moved verbatim.
 * OWNS      billsInPlace({ S, p, ctx, ok, nav }) — the stand-in state S, the page p, the browser context, the walk's ok() and nav()
 * CALLED BY e2e/cb-accounts.cjs (section 3 · BILLS, right after the Issued tab shows its bill and chip)
 * FLOW      click a bill → openChitSheet in place → Escape → Dues owed on Issued only (S.sideFilter) → reload → Bills opens on Issued → a picked empty tab stays
 * CARD      14-accounting/README
 */
'use strict';
async function billsInPlace({ S, p, ctx, ok, nav }) {
  /* 2026-10-02 (web-reads-invoice): CB Accounts loads the chit sheet, so a bill opens it in place — no new tab */
  const tabs0 = ctx.pages().length;
  await p.click('[data-testid="bill-ib1"]');
  await p.waitForFunction(() => { const d = document.getElementById('chitsheet'); return !!(d && d.open); }, null, { timeout: 8000 }).catch(() => {});
  ok(await p.evaluate(() => typeof openChitSheet === 'function' && !!document.getElementById('chitsheet') && document.getElementById('chitsheet').open) && ctx.pages().length === tabs0, 'a bill opens the chit sheet in Accounts (openChitSheet is defined here), not a new tab');
  await p.keyboard.press('Escape');
  /* BD-F-02: nothing is open on the Received side, 300000 paise is owed on the Issued side (the books' Dues): a fresh visit opens the side that has something, never "Nothing open" over a Dues figure */
  S.sideFilter = true; S.suppliersSettled = true;   /* the premise: nothing owed to a supplier, so Received has nothing in the books either */
  S.bills['a0000000-0000-5000-8000-000000002100'] = [];
  S.bills['a0000000-0000-5000-8000-000000001300'] = [];
  S.folders[1].total = 2;
  await p.reload();
  await p.waitForSelector('[data-testid="acc-nav-bills"]');
  await nav(p, 'bills');
  await p.waitForSelector('[data-testid="bills-list"]');
  ok(await p.locator('[data-testid="bills-tab-B-1300"]').getAttribute('aria-pressed') === 'true', 'BD-F-02: Received is empty and Issued is owed, so Issued is the side the screen opens on');
  ok(await p.locator('[data-testid^="bill-books-"]').count() === 2 && !/Nothing open/.test(await p.textContent('[data-testid="bills-list"]')), 'BD-F-02: the two parties Dues lists as owing the shop are rows, not "Nothing open"');
  await p.click('[data-testid="bills-tab-B-2100"]');
  await p.waitForSelector('[data-testid="bills-list"]');
  ok(await p.locator('[data-testid="bills-tab-B-2100"]').getAttribute('aria-pressed') === 'true', 'BD-F-02: a tab the owner picks stays, even when empty');
  S.sideFilter = false; S.suppliersSettled = false;
}
module.exports = { billsInPlace };
