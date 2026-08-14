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
    const amendCalls = [];
    page.on('response', async (r) => { if (/\/amend/.test(r.url())) {
      let b = null; try { b = await r.json(); } catch (e) {}
      amendCalls.push({ status: r.status(), body: JSON.stringify(b).slice(0, 300) });
    }});
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
      lineId: (typeof AMD !== 'undefined') ? AMD.lineId : 'n/a',
      codeHasLineIdFix: (typeof amdOpen === 'function') && /AMD.lineId/.test(amdOpen.toString()),
      modalOpen: !!document.querySelector('.mbody, .mhd, [data-testid="amd-save"]'),
    }));
    console.log('\n  OVERLAY CALLS: ' + JSON.stringify(overlayCalls));
    console.log('  PAGE ERRORS  : ' + JSON.stringify(pageErrors));
    console.log('  STATE        : ' + JSON.stringify(state) + '\n');
    /* ⭐ ONE OVERLAY: the choices, the quantity, the price and Remove are all on the SAME card now. */
    const picker = page.getByTestId('amd-cand').first();
    await expect(picker, 'the choices must be ON the card, not behind a tap').toBeVisible({ timeout: 15000 });

    const cands = page.getByTestId('amd-cand');
    await expect(cands, 'both catalogue items must be offered — a shortlist of one is not a choice').toHaveCount(2);

    /* ⚠️ THE PRICE MUST BE ON THE ROW. The only reason the reader refused was that the prices differ; a picker that
       hides them lets someone resolve the ambiguity wrongly and never notice. */
    await expect(cands.first()).toContainText('30');
    await expect(cands.nth(1)).toContainText('36');
    /* ⚠️ ASSERT ON THE CARD, NOT ON ONE ROW.  is the FIRST candidate now, so asking it to contain both
       names could never pass — the names live in different rows of the same overlay. */
    await expect(page.locator('body')).toContainText('Tomato Native');
    await expect(page.locator('body')).toContainText('Tomato Hybrid');

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
    /* ⚠️ DIAGNOSTICS BEFORE ASSERTIONS. They were after, so the first failing assertion aborted the test before
       anything printed — three runs produced a red with no evidence in it. A log that only appears when the test
       passes is not a diagnostic. */
    const sel = await page.evaluate(() => (typeof UI !== 'undefined') ? UI.sel : null);
    const after = await page.evaluate(() => ({
      nav: (typeof UI !== 'undefined') ? UI.nav : null,
      sel: (typeof UI !== 'undefined') ? UI.sel : null,
      modalOpen: !!document.querySelector('[data-testid="amd-save"]'),
      bodyHas: /Tomato Hybrid/.test(document.body.innerText || ''),
      snippet: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 240),
    }));
    console.log('\n  AMEND CALLS : ' + JSON.stringify(amendCalls));
    console.log('  AFTER SAVE  : ' + JSON.stringify(after));
    console.log('  PAGE ERRORS : ' + JSON.stringify(pageErrors) + '\n');

    /**
     * ⚠️ SAVING RETURNS YOU TO THE LIST, NOT THE CHIT. `UI.nav` comes back as 'task' with the detail closed, so the
     * corrected line is not on screen at all — which is why this assertion failed three times while the amendment
     * itself was landing perfectly (200, price 36, total 108, ref stamped).
     *
     * Recorded as a product observation, not fixed here: after correcting one line of a twelve-line order you are
     * put back at the top of the list and have to find the chit again. Athi has not raised it, so it stays his
     * call — but it is the kind of thing that makes a person stop correcting lines.
     */
    /**
     * ⭐ ASSERT ON WHAT WAS STORED, NOT ON WHAT THE PAGE HAPPENS TO SHOW. Three runs failed here while the
     * amendment was landing perfectly — because after saving the app returns to the list and the corrected line is
     * simply not on screen. Chasing that with re-open clicks tests the navigation, not the correction.
     */
    const live = await page.evaluate(async (id) => {
      const d = await api('chit', { params: { id } });
      const e = (d.live_set || [])[0] || {};
      const l = e.live || e.original || {};
      return { particulars: l.particulars, price: l.price, quantity: l.quantity, ref: l.ref || null };
    }, sel);
    console.log('  STORED LINE : ' + JSON.stringify(live) + '\n');

    expect(String(live.particulars), 'the chosen item name must replace the ambiguous word').toContain('Tomato Hybrid');
    expect(Number(live.price), "the chosen item's price must land on the line").toBe(36);
    expect(Number(live.quantity), 'the quantity the customer asked for must survive the correction').toBe(3);
    /* ⭐ b146 through the UI: the line knows WHICH catalogue row it came from and WHAT that row said at the time. */
    expect(live.ref, 'a human pick must leave a catalogue reference').toBeTruthy();
    expect(live.ref.how, 'a person chose this — not a machine guess').toBe('human');
    expect(live.ref.item_id, 'the reference must name the catalogue row').toBeTruthy();
    expect(live.ref.hash, 'and what that row said at the moment it was chosen').toBeTruthy();

    console.log('\n  ⏱  timings (ms): ' + JSON.stringify(timings, null, 0) + '\n');
    /* Not an assertion — a report. Athi: "my click takes time and it is taking time to load each screen." A number
       in the run beats an impression, and a threshold guessed today would just fail on a cold Railway container. */
  });

  /**
   * ⭐ PICK-03 · THE WHOLE LIFECYCLE IN ONE RUN — resolve, correct, remove.
   *
   * Athi, 2026-08-14: *"extend the spec to cover amend quantity and remove … cover all the screen please."*
   *
   * Each step asserts on what was STORED, not on what the page happens to render — after a save the app returns to
   * the list, so screen assertions test the navigation rather than the correction. That distinction cost three
   * red runs this morning.
   */
  test('PICK-03 · resolve the item, correct the quantity, then remove the line', async ({ page }) => {
    const stored = async (id) => page.evaluate(async (cid) => {
      const d = await api('chit', { params: { id: cid } });
      const e = (d.live_set || [])[0] || {};
      const l = e.live || e.original || {};
      return { particulars: l.particulars, price: l.price, quantity: l.quantity,
               removed: !!e.removed, reason: e.reason_code || null, versions: e.versions || 0 };
    }, id);

    await mintEntity(page);
    await page.evaluate(async (items) => {
      for (const it of items) await api('prodAdd', { body: { item_data: it } });
    }, ITEMS);

    const subject = 'Lifecycle ' + Date.now();
    await composeChit(page, { subject, item: SYN, qty: 3, self: true });
    await clickNav(page, 'task');
    await settle(page);
    await page.getByText(subject).first().click();
    await settle(page);
    const sel = await page.evaluate(() => UI.sel);

    // ── 1 · RESOLVE the ambiguity ───────────────────────────────────────────────────────────────────────────────
    await page.getByTestId('amend-line').first().click();
    await page.waitForResponse((r) => /catalogue-overlay/.test(r.url()), { timeout: 30000 }).catch(() => null);
    await expect(page.getByTestId('amd-cand').first(), 'the choices render INSIDE the one card now').toBeVisible({ timeout: 15000 });
    await page.getByTestId('amd-cand').nth(1).click();
    await settle(page);
    await page.getByTestId('amd-save').click();
    await page.waitForResponse((r) => /\/amend/.test(r.url()) && r.request().method() === 'POST').catch(() => null);
    await settle(page);

    let s = await stored(sel);
    expect(s.particulars, 'the ambiguity is resolved to the chosen item').toContain('Tomato Hybrid');
    expect(Number(s.price), 'and priced from the catalogue').toBe(36);
    console.log('  1 · resolved  -> ' + JSON.stringify(s));

    // ── 2 · CORRECT THE QUANTITY — the commonest correction of all ───────────────────────────────────────────────
    await page.getByText(subject).first().click();
    await settle(page);
    await page.getByTestId('amend-line').first().click();
    await page.waitForResponse((r) => /catalogue-overlay/.test(r.url()), { timeout: 30000 }).catch(() => null);
    await settle(page);
    /* ⚠️ THE CARD MUST NOT OPEN ON THE PICKER NOW. The line is resolved, so re-opening ✎ to fix a number must not
       drag someone back through a choice they already made — the exact regression the `!AMD.picked` guard exists
       to prevent, and the only way to catch it is to amend the same line twice. */
    await expect(page.getByTestId('amd-cand'), 'a resolved line shows no choices — the question is answered').toHaveCount(0);
    const qty = page.locator('input[inputmode="decimal"]').first();
    await qty.fill('5');
    await page.getByTestId('amd-save').click();
    await page.waitForResponse((r) => /\/amend/.test(r.url()) && r.request().method() === 'POST').catch(() => null);
    await settle(page);

    s = await stored(sel);
    expect(Number(s.quantity), 'the corrected quantity is stored').toBe(5);
    expect(s.particulars, 'and the resolved item survives a second correction').toContain('Tomato Hybrid');
    console.log('  2 · qty 3→5   -> ' + JSON.stringify(s));

    // ── 3 · REMOVE the line, with a reason ──────────────────────────────────────────────────────────────────────
    await page.getByText(subject).first().click();
    await settle(page);
    await page.getByTestId('amend-line').first().click();
    await page.waitForResponse((r) => /catalogue-overlay/.test(r.url()), { timeout: 30000 }).catch(() => null);
    await settle(page);
    await page.getByTestId('amd-remove').click();          // 🗑 → the reason sheet
    await settle(page);
    /* ⚠️ REMOVING ASKS WHY, and it is not bookkeeping: "they never asked for this" and "not available" produce an
       identical empty line and mean opposite things — the second leaves a customer expecting a delivery. */
    await page.getByText(/not available/i).first().click();
    await page.waitForResponse((r) => /\/amend/.test(r.url()) && r.request().method() === 'POST').catch(() => null);
    await settle(page);

    s = await stored(sel);
    expect(s.removed, 'the line is removed').toBe(true);
    expect(s.reason, 'and the reason is on the record — not just the fact of removal').toBe('stock_unavailable');
    console.log('  3 · removed   -> ' + JSON.stringify(s));

    /* ⚠️ REMOVED IS NOT DELETED. It must still be ON the chit, struck through, counting in nothing — deleting it
       would make the chit disagree with the message it came from. */
    await page.getByText(subject).first().click();
    await settle(page);
    /* ⚠️ IT SHOWS THE ORIGINAL WORDS, NOT THE RESOLVED NAME — and that is right, though it caught me out. Once a
       line is removed there is no live version, so the row falls back to what the customer actually wrote. The
       point of keeping it on screen is evidence of the request, and "thakkali" is the evidence; "Tomato Hybrid"
       was our interpretation of it. */
    await expect(page.locator('body'), 'a removed line stays visible as evidence it was asked for')
      .toContainText('thakkali');
    await expect(page.locator('body'), 'and says WHY — "not available" and "never asked for" mean opposite things')
      .toContainText(/not available/i);
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

    await expect(page.getByTestId('amd-cand'),
      'one catalogue answer means no question — no choices on the card').toHaveCount(0);
    await expect(page.getByTestId('amd-save'), 'the ordinary correction card is what should appear').toBeVisible();
  });
});
