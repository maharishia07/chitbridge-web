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
const { design2, money } = require('../flows/design2');

const stamp = () => Date.now().toString().slice(-6);

test.describe('Design 2 · a service job end to end', () => {
  test('[D2-01] parts, hours, people and the cost they come to', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000);   // a full transaction: mint, seed, then ~10 writes through the UI

    const s = stamp();
    /* ⚠️ FIXED NAMES, deliberately not stamped. The parts are the SHOP's standing catalogue, not this run's
       data — stamping them made a new pair of products on every run and left the shared entity with a shelf
       nobody could read. The chit and its lines still carry the stamp, because those genuinely are this run. */
    const PART_A = { name: 'E2E oil filter', price: 450 };
    const PART_B = { name: 'E2E AC gas kit', price: 1650 };
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

      /* ⭐ Our side: what we quoted, and what has been booked against the job. Both are workflow facts. */
      expect(m.invoiced, 'invoiced must stay the quoted value of the two complaints').toBe(QUOTE[L1] + QUOTE[L2]);
      expect(m.byKind.labour, 'the labour total moved after the job closed').toBe(labour);
      expect(m.recorded, 'the recorded total must be every cost row on the job').toBe(labour);

      /**
       * ⚠️⚠️ MARGIN IS CALCULATED AND MUST NOT BE ON THE SCREEN. Athi, 2026-08-23: *"calculate it but do not
       * showcase anywhere, as we are not the P&L holder. If required we just pass it on to other systems."*
       *
       * ⭐ An absence nothing checks comes back. This is the only thing standing between that decision and the
       * next person who touches the cost pane, so it is asserted as loudly as any value.
       *
       * ⚠️ AND THE ARITHMETIC AGREED WITH HIM BEFORE THE POLICY DID. A part is recorded at the CATALOGUE price
       * — what we CHARGE — and what it COST us is nowhere in this product: an `add` EVENT (chit_line_delivery)
       * is not a cost ROW (chit_line_cost), and `lib/cost.js` sums only rows. So ₹2,550 of parts sat in
       * `accrued` and in neither half of what was being printed as "margin". The number was never margin.
       */
      expect(await d2.marginShown(), 'margin is back on the design-2 cost pane — it is calculated for other '
        + 'systems, never shown here, because this product does not hold the cost price or the P&L').toBe(false);

      /**
       * ⭐⭐ AND NOW THE SCREEN AN EMPLOYER ACTUALLY OPENS. Athi, 2026-08-23: *"as an employer when I go to the
       * main task window I am not able to see the cost spent on a particular service."* Design 2 knew the
       * number all along; design 1 dropped `line_delivery`/`delivery_summary` when it built its detail, so the
       * main task window rendered none of it. This asserts the money is on THAT screen, because that is where
       * he looked for it.
       */
      /* ⚠️ THE EMPLOYER'S PATH, NOT A SHORTCUT: back to the task list and in again, which is how he arrives —
         he did not watch the work being done, he opened the job afterwards. Returning from design 2 carries
         the numbers across too, but proving the carry would prove the easier of the two. */
      await page.getByTestId('nav-task').click();
      /* ⚠️ :visible — the subject is ALSO in the detail header that is currently hidden, and getByText matched
         that one first. A locator that resolves to something nobody can click is the least useful kind of pass. */
      await page.getByText(subject).locator('visible=true').first().click();
      const strip = page.getByTestId('chit-spend');
      await expect(strip, 'the main task window shows no spend at all').toBeVisible({ timeout: 20000 });
      const shown = money(await page.getByTestId('chit-spend-amt').textContent());
      expect(shown, 'the task window disagrees with the lines about what has been spent').toBe(parts);
      await expect(strip, 'the task window does not say how much of the work is done').toContainText('2');
      expect(await page.getByTestId('chit-spend-history').count(),
        'there is no way from the task window to the history of what was recorded').toBe(1);

      console.log(`\n  ── ${subject} ──`
        + `\n  quoted    ${QUOTE[L1] + QUOTE[L2]}`
        + `\n  parts     ${parts}   (2 × ${PART_A.name} @${PART_A.price}, 1 × ${PART_B.name} @${PART_B.price})`
        + `\n  labour    ${labour}   (${LABOUR.minutes} min @ ${LABOUR.rate}/hr)`
        + `\n  recorded  ${m.recorded}   (margin: calculated server-side, shown nowhere)`
        /* ⚠️ Report the screen we are ON. This printed `d2.progress()`, which reads design 2's header — and by
           this point the spec is back on the task window, so it printed an empty string every run. */
        + `\n  task window   ${(await strip.textContent()).replace(/\s+/g, ' ').trim()}\n`);
      await settle(page);
    });
  });
});
