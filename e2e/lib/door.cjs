/**
 * e2e/lib/door.cjs — THE FIRM SEAT'S WAY TO THE DAY BOOK, FOR A WALK (ONEP-2 PR7b).
 * OWNS      the steps every Day book walk shares now that the firm's own painter is gone: "Open books" lands on the OWNER's Day book (accounts.html?acting=<client>&role=<role>#/daybook), the list is the one list control (db-entry-<no> rows, filters pop-up cbl-filters-daybook, grid view view-grid-daybook)
 * CALLED BY e2e/walk-audrc4.cjs · walk-lead1-risk-explain.cjs · walk-marks.cjs · walk-books-grant.cjs · walk-books-adviser.cjs · books-since-checked.cjs · adviser-bank-live.cjs · practice-a3p.cjs
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 */
'use strict';
const T = (id) => '[data-testid="' + id + '"]';
const ROWS = '[data-testid^="db-entry-"]';
/** the stand-in answers the owner page asks in a firm seat and the walk's own handler does not (entities/me for the shell); null = not one of them */
function stubs(p, J) {
  if (p === '/api/entities/me') return J(200, { entity: { display_name: 'Fixture Shop', currency_code: 'INR' } });
  return null;
}
/** press "Open books" on the client's row; the landing replaces the page with the owner's Day book: wait for its list */
async function openDaybook(page, base, member, opts) {
  opts = opts || {};
  await page.goto(base + '/network.html');
  await page.waitForSelector(T('nw-store-' + member), { timeout: 20000 });
  await page.focus(T('nw-books-' + member));
  await page.keyboard.press('Enter');
  await page.waitForURL(/accounts\.html/, { timeout: 20000 });
  await page.waitForSelector(ROWS, { timeout: 20000 });
  if (opts.grid) await page.click(T('view-grid-daybook')).catch(() => {});
  await page.waitForTimeout(400);
}
/** the entry numbers on the list, in the order drawn */
const entryNos = (page) => page.$$eval(ROWS, (els) => els.map((e) => e.getAttribute('data-no') || ''));
/** choose a sort in the list's filters pop-up (key: rec · date · book · risk ...) */
async function sortBy(page, key) {
  await page.click(T('cbl-filters-daybook'));
  await page.selectOption(T('listctl-sort-daybook'), key);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
/** choose a filter in the same pop-up */
async function filterBy(page, key, value) {
  await page.click(T('cbl-filters-daybook'));
  await page.selectOption(T('listctl-filter-' + key), value);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}
module.exports = { T, ROWS, stubs, openDaybook, entryNos, sortBy, filterBy };
