const { test } = require('@playwright/test');
const { mintEntity, clickNav, clickInModal, HAS_TOTAL } = require('../fixtures');
test('who closes the compose modal', async ({ page }) => {
  page.on('console', m => { const t=m.text(); if(t.startsWith('CLOSE')||t.startsWith('WIPE')) console.log(t); });
  await mintEntity(page);
  await clickNav(page, 'compose');
  await page.evaluate(() => {
    const orig = window.closeModal;
    window.closeModal = function(){ console.log('CLOSE closeModal called\n' + new Error().stack); return orig.apply(this, arguments); };
    const ra = window.renderApp;
    if (ra) window.renderApp = function(){ console.log('WIPE renderApp called\n' + new Error().stack); return ra.apply(this, arguments); };
  });
  await page.getByTestId('chit-item-name').fill('Widget');
  await clickInModal(page, 'chit-item-add', HAS_TOTAL);
  await page.waitForTimeout(22000);
  console.log('modalhost len after 22s idle:', (await page.locator('#modalhost').innerHTML().catch(()=>'')).length);
});
