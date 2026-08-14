/**
 * picker.spec.js — AMBIGUITY RESOLUTION, end to end.
 *
 * Athi, 2026-08-14, after three failed attempts by hand: *"can you do a playwright test for all the flow and
 * confirm all works … I am struggling to test now."*
 *
 * ⚠️ THIS IS THE FLOW THAT FAILED TWICE THIS MORNING, and both failures were invisible from the screen: the card
 * opened on a quantity stepper with no hint that the catalogue had two answers. The first was mine (the picker sat
 * one tap too deep); the second was also mine (the overlay was queried with the whole sentence rather than the item
 * phrase, so it returned nothing). Neither showed an error. That is exactly the class of bug a human tester cannot
 * distinguish from "the feature is not built yet", which is why it belongs in a spec.
 *
 * It mints its OWN entity rather than using a real one: the test writes chits, and a proving run must not leave
 * debris in an account someone is also testing by hand.
 *
 * Watch it:  npx playwright test picker --headed --project=authed
 * Time-travel it:  npx playwright test picker --project=authed --trace on   then  npx playwright show-trace
 */
const { test, expect } = require('@playwright/test');
const { mintEntity, composeChit, clickNav, settle } = require('../fixtures');

/* One synonym on TWO different catalogue names — the exact shape of Athi's veg catalogue, and the shape that makes
   the reader refuse: it knows both, so any price would be a coin toss. */
const SYN = 'thakkali';
const ITEMS = [
  { name: 'Tomato Native', unit: 'kg', price: 30, synonyms: [SYN, 'nattu thakkali'] },
  { name: 'Tomato Hybrid', unit: 'kg', price: 36, synonyms: [SYN, 'hybrid thakkali'] },
];

test.describe('PICKER — two catalogue items answer to one name', () => {
  test.setTimeout(180_000);

  test('PICK-01 · an ambiguous line offers both items with prices, and picking one prices the line', async ({ page }) => {
    const timings = {};
    const mark = async (label, fn) => { const t = Date.now(); const r = await fn(); timings[label] = Date.now() - t; return r; };

    await mintEntity(page);

    /* DIAGNOSTIC: what the browser actually asks the catalogue, and what it gets back. Two failures this
       morning were invisible because nobody could see this exchange. */
    const overlayCalls = [];
    /* ⚠️ A THROWN ERROR INSIDE amendLine WOULD BE COMPLETELY SILENT from the outside — the modal simply never
       opens, which is indistinguishable from "the feature is not built". Catching pageerror is the difference
       between debugging and guessing. */
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
    page.on('console', (m) => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
    page.on("response", async (r) => { if (/catalogue-overlay/.test(r.url())) {
      let b = null; try { b = await r.json(); } catch (e) {}
      overlayCalls.push({ url: r.url(), status: r.status(),
        ambiguous: b && b.ambiguous, candidates: b && (b.candidates||[]).length, items: b && (b.items||[]).length });
    }});

    // ── setup · two products that share a synonym ───────────────────────────────────────────────────────────────
    // Through the app's own api() so the session and the entity context are the real ones, not a fabricated token.
    const made = await page.evaluate(async (items) => {
      const out = [];
      for (const it of items) out.push(await api('prodAdd', { body: { item_data: it } }));
      return out.length;
    }, ITEMS);
    expect(made).toBe(2);

    // ── the line · raised with the AMBIGUOUS word, exactly as a customer would write it ──────────────────────────
    const subject = 'Picker ' + Date.now();
    await mark('compose+send', () => composeChit(page, { subject, item: SYN, qty: 3, self: true }));

    await clickNav(page, 'task');
    await settle(page);
    await mark('open chit', async () => {
      await page.getByText(subject).first().click();
      await page.waitForResponse((r) => /\/api\/chits\//.test(r.url()) && r.request().method() === 'GET', { timeout: 30000 }).catch(() => null);
      await settle(page);
    });

    // ── ⭐ THE ASSERTION THAT FAILED BY HAND TWICE ──────────────────────────────────────────────────────────────
    const pencil = page.getByTestId('amend-line').first();
    await expect(pencil, 'the ✎ must exist on the line — it did not exist at all in Design 2 until 13 Aug').toBeVisible();
    await mark('open picker', async () => {
      await pencil.click();
      /* The card fetches the catalogue before it can know there is a choice, so the picker appears asynchronously.
         Waiting on the OVERLAY response rather than a timeout is what makes this stable on a cold API. */
      await page.waitForResponse((r) => /catalogue-overlay/.test(r.url()), { timeout: 30000 }).catch(() => null);
    });

    const state = await page.evaluate(() => ({
      hasAmendLine: typeof amendLine,
      hasAmdOpen: typeof amdOpen,
      detailItems: (typeof UI !== 'undefined' && UI.detail && UI.detail.items || []).length,
      sel: (typeof UI !== 'undefined') ? UI.sel : null,
      amd: (typeof AMD !== 'undefined') ? { idx: AMD.idx, view: AMD.view, chit: AMD.chit, cat: !!AMD.cat } : 'no AMD',
      modalOpen: !!document.querySelector('.mbody, .mhd, [data-testid="amd-save"]'),
    }));
    console.log('\n  OVERLAY CALLS: ' + JSON.stringify(overlayCalls));
    console.log('  PAGE ERRORS  : ' + JSON.stringify(pageErrors));
    console.log('  STATE        : ' + JSON.stringify(state) + '\n');
    const picker = page.getByTestId('amd-picker');
    await expect(picker,
      'the card must open ON the picker for an unresolved line — landing on the quantity stepper is the bug Athi hit'
    ).toBeVisible({ timeout: 15000 });

    const cands = page.getByTestId('amd-cand');
    await expect(cands, 'both catalogue items must be offered — a shortlist of one is not a choice').toHaveCount(2);

    /* ⚠️ THE PRICE MUST BE ON THE ROW. The only reason the reader refused was that the prices differ; a picker that
       hides them lets someone resolve the ambiguity wrongly and never notice. */
    await expect(cands.first()).toContainText('30');
    await expect(cands.nth(1)).toContainText('36');
    await expect(picker).toContainText('Tomato Native');
    await expect(picker).toContainText('Tomato Hybrid');

    // ── pick the SECOND one, so a pass cannot come from a default ───────────────────────────────────────────────
    await cands.nth(1).click();
    await settle(page);

    const save = page.getByTestId('amd-save');
    await expect(save, 'picking returns to the card so one save covers the item AND the quantity').toBeVisible();
    await mark('save', async () => {
      const amended = page.waitForResponse((r) => /\/amend/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
      await save.click();
      await amended;
      await settle(page);
    });

    // ── the line now carries the catalogue's name and price ────────────────────────────────────────────────────
    await expect(page.locator('body'), 'the chosen item name must replace the ambiguous word').toContainText('Tomato Hybrid');
    await expect(page.locator('body'), "the chosen item's price must land on the line").toContainText('36');

    console.log('\n  ⏱  timings (ms): ' + JSON.stringify(timings, null, 0) + '\n');
    /* Not an assertion — a report. Athi: "my click takes time and it is taking time to load each screen." A number
       in the run beats an impression, and a threshold guessed today would just fail on a cold Railway container. */
  });

  test('PICK-02 · a line the catalogue answers unambiguously does NOT open a picker', async ({ page }) => {
    /* ⚠️ THE NEGATIVE CASE, AND IT IS NOT PADDING. If the card opened on a picker for every line, PICK-01 would
       pass while the feature was wrong in the more common direction — asking a person to choose when there is
       nothing to choose between is worse than not asking, because it trains them to click through it. */
    await mintEntity(page);
    await page.evaluate(async () => {
      await api('prodAdd', { body: { item_data: { name: 'Carrot Ooty', unit: 'kg', price: 55, synonyms: ['ooty carrot'] } } });
    });

    const subject = 'Unambiguous ' + Date.now();
    await composeChit(page, { subject, item: 'ooty carrot', qty: 2, self: true });
    await clickNav(page, 'task');
    await settle(page);
    await page.getByText(subject).first().click();
    await settle(page);

    await page.getByTestId('amend-line').first().click();
    await page.waitForResponse((r) => /catalogue-overlay/.test(r.url()), { timeout: 30000 }).catch(() => null);
    await settle(page);

    await expect(page.getByTestId('amd-picker'),
      'one catalogue answer means no question — the card must open on the stepper').toHaveCount(0);
    await expect(page.getByTestId('amd-save'), 'the ordinary correction card is what should appear').toBeVisible();
  });
});
