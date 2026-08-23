'use strict';
/* ── DESIGN 2 · ONE SERVICE JOB, CARRIED END TO END ────────────────────────────────────────────────────────────
 *
 * Athi, 2026-08-23: *"do this flow — a product item should be selected, fill data in each section you have
 * created in design 2, and see the values are populated correctly and the final cost is gathered. Create a
 * playwright script and complete the transaction, I am wasting my time here."*
 *
 * ⭐⭐ SO THIS PROVES THE ARITHMETIC, NOT THE PIXELS. A screen test that clicks every control and asserts
 * nothing about the numbers passes on a screen that adds up wrong — and the number is the entire point of a
 * service job: *"this many people worked, this many materials changed, these many hours spent, and the total
 * cost."* Every recording below is therefore made through the UI and then **read back off the screen and
 * added up independently**, so a wrong total fails here rather than in front of a customer.
 *
 * THE JOB — a car arrives with two complaints, which is a two-line chit:
 *
 *   Engine service   1 job   ₹3,500 quoted    → an oil filter fitted, 90 min of labour, then closed
 *   AC repair        1 job   ₹2,800 quoted    → a compressor gas kit fitted, then closed
 *
 * ⚠️ EVERY PART IS **PICKED FROM THE CATALOGUE**, never typed. That is the whole reason the picker exists:
 * a typed part cannot be reconciled against anything, so "6 materials changed" stays a claim. The catalogue
 * price is what lands on the line, and this spec asserts it did.
 *
 * ⚠️ AND A PART IS AN `add`, A JOB DONE IS A `deliver`. Fitting a filter must NOT move the line towards
 * complete — it accrues. Closing the complaint is the delivery. The two are asserted separately below,
 * because collapsing them is the one modelling mistake that would make every service job look half-finished.
 *
 * The walk itself lives in `../flows/design2` — this file supplies the job, the module supplies the hands.
 */
const { test, expect } = require('@playwright/test');
const { mintEntity, composeChit, addProduct, addCoassist, settle } = require('../fixtures');
const { design2 } = require('../flows/design2');

const stamp = () => Date.now().toString().slice(-6);

test.describe('Design 2 · a service job end to end', () => {
  test('[D2-01] parts, hours, people and the cost they come to', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000);   // a full transaction: mint, seed, then ~10 writes through the UI

    const s = stamp();
    const PART_A = { name: 'Oil filter ' + s, price: 450 };
    const PART_B = { name: 'AC gas kit ' + s, price: 1650 };
    const L1 = 'Engine service ' + s;
    const L2 = 'AC repair ' + s;
    const QUOTE = { [L1]: 3500, [L2]: 2800 };
    const LABOUR = { minutes: 90, rate: 400 };            // → ₹600
    const subject = 'Complaint ' + s;

    const d2 = design2(page);

    await test.step('ARRANGE · a shop with two parts on the shelf and a mechanic', async () => {
      await mintEntity(page);
      await addProduct(page, PART_A);
      await addProduct(page, PART_B);
      await addCoassist(page, { name: 'Arun ' + s });
    });

    await test.step('ARRANGE · the complaint arrives as a two-line chit', async () => {
      await composeChit(page, {
        subject,
        self: true,
        items: [
          { item: L1, qty: 1, price: QUOTE[L1] },
          { item: L2, qty: 1, price: QUOTE[L2] },
        ],
      });
    });

    await test.step('OPEN · design 1 → ⧉ Lines → design 2', async () => {
      await d2.open(subject);
      const p = await d2.progress();
      expect(p.lines, 'design 2 opened on a chit that is not the two-line complaint').toBe(2);
      expect(p.complete, 'a brand-new complaint cannot have anything delivered').toBe(0);
    });

    await test.step('THEM · ORDER — both complaints are on the shared record', async () => {
      await d2.tab('ord');
      await expect(page.getByText(L1).first(), 'the engine complaint is missing from the order').toBeVisible();
      await expect(page.getByText(L2).first(), 'the AC complaint is missing from the order').toBeVisible();
    });

    await test.step('THEM · MESSAGE and US · NOTES — both panes render (read-only today)', async () => {
      /**
       * ⚠️ THESE TWO SECTIONS CANNOT BE FILLED FROM DESIGN 2 — asserted here so the gap is recorded rather
       * than quietly skipped. `c2PaneMsg` and `c2PaneNotes` render the threads and contain no composer: no
       * input, no textarea, no send. The messaging layer itself is live (internal/external, line-threaded),
       * so what is missing is the way in from this screen, not the capability.
       */
      await d2.tab('msg');
      await expect(page.getByTestId('c2-tab-msg'), 'the message pane did not open').toBeVisible();
      expect(await page.locator('[data-testid="c2-tab-msg"] ~ * textarea').count(),
        'a composer appeared in design 2 — this spec should stop calling the pane read-only').toBe(0);
      await d2.tab('notes');
      await expect(page.getByText(/never shared with the other party/i),
        'the internal-notes pane did not open').toBeVisible();
    });

    await test.step('US · WORK — the engine line is given to Arun, with a task and a date', async () => {
      const a = await d2.assign({ line: L1, who: 'Arun ' + s, task: 'diagnose', due: '2026-08-30' });
      expect(a.who, 'the roster offered nobody by that name').toContain('Arun');
      /* The assignment must survive on the row itself, not just in a toast that fades. */
      await expect(d2.workRow(L1), 'the line does not show who has it').toContainText('Arun');
      await expect(d2.workRow(L1), 'the task typed into the overlay never reached the line').toContainText('diagnose');
    });

    await test.step('THEM · MATERIAL — the catalogue is reachable, and the part is PICKED', async () => {
      const offered = await d2.materialsOffered(L1);
      expect(offered.join(' | '), 'our own shelf is not reachable from the line')
        .toContain(PART_A.name);

      const taken = await d2.takeMaterial({ line: L1, item: PART_A.name, qty: 2 });
      expect(taken.item, 'the option chosen was not the part asked for').toContain(PART_A.name);
      /* ⚠️ The PRICE must come from the catalogue, not from anyone's typing: 2 × ₹450. */
      const l1 = await d2.line(L1);
      expect(l1.added.map((a) => a.text).join(' | '), 'the fitted part is not on the line').toContain(PART_A.name);
      expect(l1.charged, 'the line did not charge the catalogue price for the part').toBe(2 * PART_A.price);
      /* ⚠️⚠️ AND FITTING A PART MUST NOT ADVANCE THE JOB. */
      expect(l1.delivered, 'fitting a part moved the line towards complete — `add` was written as `deliver`').toBe(0);
      expect(l1.state.toLowerCase(), 'a line with a part fitted but no work claimed is not started').toContain('not started');
    });

    await test.step('US · COST — 90 minutes at ₹400/hr lands as ₹600 of labour', async () => {
      await d2.addCost({ kind: 'labour', ...LABOUR, note: 'engine diagnosis' });
      const m = await d2.money();
      expect(m.byKind.labour, '90 min × ₹400/hr is ₹600, and the screen says otherwise').toBe(600);
      expect(m.invoiced, 'the invoiced figure is not the two quoted lines').toBe(QUOTE[L1] + QUOTE[L2]);
      expect(m.rows.length, 'the recorded cost is not in the list').toBeGreaterThan(0);
    });

    await test.step('THEM · the second complaint — its own part', async () => {
      await d2.takeMaterial({ line: L2, item: PART_B.name, qty: 1 });
      const l2 = await d2.line(L2);
      expect(l2.charged, 'the AC line did not take the catalogue price of the gas kit').toBe(PART_B.price);
    });

    await test.step('COMPLETE THE TRANSACTION — both complaints closed', async () => {
      await d2.deliver({ line: L1, qty: 1, reference: 'job card ' + s });
      await d2.deliver({ line: L2, qty: 1 });

      const l1 = await d2.line(L1);
      const l2 = await d2.line(L2);
      expect(l1.delivered, 'the engine complaint did not close').toBe(1);
      expect(l2.delivered, 'the AC complaint did not close').toBe(1);
      expect(l1.state.toLowerCase(), 'a fully delivered line must read complete').toContain('complete');
      expect(l2.state.toLowerCase(), 'a fully delivered line must read complete').toContain('complete');

      const p = await d2.progress();
      expect(p, 'the header must agree with the lines').toMatchObject({ complete: 2, lines: 2 });
    });

    await test.step('THE FINAL COST — gathered, and it adds up', async () => {
      const m = await d2.money();
      const parts = 2 * PART_A.price + PART_B.price;         // ₹900 + ₹1,650 = ₹2,550
      const labour = LABOUR.minutes / 60 * LABOUR.rate;      // ₹600

      /* ⭐ The running charge on the SHARED side is the parts and hours accrued against the lines. */
      expect(m.accrued, `the running charge is not the sum of what was fitted (${parts})`).toBe(parts);

      /* ⭐ Our side: what we quoted, what it cost us, and the difference. This is the number the whole
         design-2 "US" side exists to produce, and nothing else in the product computes it. */
      expect(m.invoiced, 'invoiced must stay the quoted value of the two complaints').toBe(QUOTE[L1] + QUOTE[L2]);
      expect(m.byKind.labour, 'the labour total moved after the job closed').toBe(labour);

      /**
       * ⚠️ THE INVARIANT, NOT A FROZEN NUMBER: margin is invoiced − everything recorded as a cost. Asserting
       * "5,700" instead would pass forever on whatever the screen happens to print today.
       *
       * ⚠️⚠️ AND IT DOES NOT INCLUDE THE PARTS — deliberately asserted here so the gap is visible rather than
       * assumed. A part fitted is an `add` EVENT (chit_line_delivery); a cost is a ROW (chit_line_cost). They
       * are different tables, and `lib/cost.js` sums only the second. So ₹2,550 of parts sits in `accrued` on
       * the shared side and in NEITHER half of the margin — the catalogue price is what we charge for the
       * part, and what the part cost US is nowhere recorded. Whether parts should raise invoiced, lower
       * margin, or both, is a modelling decision, not something to patch quietly under a test.
       */
      const spent = Object.values(m.byKind).reduce((t, v) => t + (v || 0), 0);
      expect(m.margin, 'margin must be invoiced less every recorded cost').toBe(m.invoiced - spent);
      expect(spent, 'parts reached the cost ledger — the model changed, and this test should say so')
        .toBe(labour);

      console.log(`\n  ── ${subject} ──`
        + `\n  quoted    ${QUOTE[L1] + QUOTE[L2]}`
        + `\n  parts     ${parts}   (2 × ${PART_A.name} @${PART_A.price}, 1 × ${PART_B.name} @${PART_B.price})`
        + `\n  labour    ${labour}   (${LABOUR.minutes} min @ ${LABOUR.rate}/hr)`
        + `\n  margin    ${m.margin}`
        + `\n  lines     ${(await d2.progress()).text}\n`);
      await settle(page);
    });
  });
});
