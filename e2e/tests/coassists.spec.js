// MODULE: Co-assists — the actors that act for an entity: PERSON, IoT device, ERP/API system, AI agent.
// FLOW A: prove EVERY type path is reachable (human / IoT / ERP / AI) — the "does it cover IoT/ERP" answer.
// FLOW B (CRUD·create): create a human co-assist end to end → an invite is issued.
// LOCATORS: nav-coassists · coassist-new · coassist-type-{human|iot|erp|ai} · coassist-wiz-next · coassist-wiz-back · aw_name · aw_key
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test.describe('Module · Co-assists', () => {
  test('every co-assist type is reachable (human · IoT · ERP · AI)', async ({ page }) => {
    await mintEntity(page);
    await page.getByTestId('nav-coassists').click();
    await page.getByTestId('coassist-new').click();
    for (const type of ['human', 'iot', 'erp', 'ai']) {
      await test.step(`type: ${type}`, async () => {
        await expect(page.getByTestId(`coassist-type-${type}`)).toBeVisible();
        await page.getByTestId(`coassist-type-${type}`).click();
        // left the type grid → its wizard step (ready types) or explore preview (both carry a Back)
        await expect(page.getByTestId('coassist-wiz-back').first()).toBeVisible();
        await page.getByTestId('coassist-wiz-back').first().click();   // back to the type grid for the next type
        await expect(page.getByTestId('coassist-type-human')).toBeVisible();
      });
    }
  });

  test('CRUD·create — add a human co-assist → invite issued', async ({ page }) => {
    await mintEntity(page);
    await page.getByTestId('nav-coassists').click();
    await page.getByTestId('coassist-new').click();
    await page.getByTestId('coassist-type-human').click();
    await page.getByTestId('aw_name').fill('Anitha E2E');
    await page.getByTestId('aw_key').fill('anitha' + Date.now().toString().slice(-5));
    await page.getByTestId('coassist-wiz-next').click();     // who → hat
    await page.getByTestId('coassist-wiz-next').click();     // hat → finish (addActor)
    await expect(page.getByText(/Invite ready|one-time code/i)).toBeVisible();
  });
});
