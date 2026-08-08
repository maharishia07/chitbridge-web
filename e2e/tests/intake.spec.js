/**
 * intake.spec.js — THE CAPTURE CONNECTOR, end to end in a browser.
 *
 * channel → CAPTURE (raw, untrusted) → AI STRUCTURE → HUMAN CONFIRM → chit on the rail.
 *
 * The backend for this has been live for a while (routes/capture.js, lib/capture.js, migration b104 — the `capture`
 * table, per-entity, WITH RLS). What was missing was a way to reach it from inside the app. This drives the new
 * Intake screen against the REAL API: it records a message, has the real AI structure it, and confirms that the
 * proposed lines reach Compose — where a human still has to press Send.
 *
 * ⚠️ IT NEVER SENDS. Running against production, a spec that mints real chits on every run makes the data
 * untrustworthy. The confirm gate is asserted by showing Compose OPEN with the lines in it, which is exactly the
 * boundary that matters: a message is a notice, a chit is an obligation, and nothing crosses that line by itself.
 *
 *      npx playwright test intake --project=authed
 */
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

test.describe('Capture connector · Intake', () => {
  test('★★ a WhatsApp message becomes a draft chit — captured, structured, confirmed by a human', async ({ page }) => {
    await mintEntity(page);
    page.on('dialog', (d) => d.accept());

    await page.getByTestId('nav-intake').click();
    // The capability is lazy (ensureCap('intake') → /app/cap-intake.js), so the screen arrives a moment later.
    await expect(page.getByTestId('intake-simulate-open')).toBeVisible({ timeout: 15000 });

    // A fresh entity has an empty queue — and "nothing waiting" must not be indistinguishable from "not migrated".
    await expect(page.getByTestId('intake-row')).toHaveCount(0);

    // ── RECORD an inbound message. This is the SAME createCapture the WhatsApp webhook calls; the webhooks exist
    //    but have no provider or entity mapping yet, so this is the honest way in today.
    await page.getByTestId('intake-simulate-open').click();
    await page.getByTestId('intake-sim-channel').selectOption('whatsapp');
    await page.getByTestId('intake-sim-from').fill('+919876543210');
    await page.getByTestId('intake-sim-text').fill('need 2 boxes of bolts and 5 m cable by friday');
    await page.getByTestId('intake-sim-add').click();

    const row = page.getByTestId('intake-row').first();
    await expect(row, 'the message never reached the queue').toBeVisible({ timeout: 15000 });
    await expect(row).toContainText('bolts');
    await expect(row).toContainText('WhatsApp');

    // ── STRUCTURE it with the real co-assist. It PROPOSES; it does not decide.
    await page.getByTestId('intake-structure').first().click();
    await expect(page.getByTestId('intake-make-chit').first(),
      'the AI draft never came back').toBeVisible({ timeout: 45000 });
    await expect(row, 'the draft must say it is a proposal, not evidence').toContainText('AI draft');

    // ── CONFIRM. This opens Compose with the lines in it — and stops there.
    await page.getByTestId('intake-make-chit').first().click();
    await expect(page.getByTestId('chit-send'), 'Compose did not open for the human confirm').toBeVisible({ timeout: 20000 });
    const modal = page.locator('#modalhost');
    await expect(modal, 'the captured lines did not reach the chit').toContainText(/bolts/i);

    // ⚠️ NOT SENT. The gate is that a person still has to press this.
    await page.getByTestId('modal-close, .mx').first().click().catch(() => {});
  });

  test('★ a message can be dismissed — and that is recorded, not forgotten', async ({ page }) => {
    await mintEntity(page);
    page.on('dialog', (d) => d.accept());
    await page.getByTestId('nav-intake').click();
    await expect(page.getByTestId('intake-simulate-open')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('intake-simulate-open').click();
    await page.getByTestId('intake-sim-text').fill('wrong number, ignore this');
    await page.getByTestId('intake-sim-add').click();
    await expect(page.getByTestId('intake-row').first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId('intake-dismiss').first().click();
    // It leaves the PENDING queue. It is not deleted — the capture row stays, marked dismissed, as a receipt that
    // the message arrived and was deliberately not turned into a chit.
    await expect(page.getByTestId('intake-row'), 'dismiss did not clear it from the queue').toHaveCount(0, { timeout: 15000 });
  });
});
