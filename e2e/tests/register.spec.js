// MODULE: The Register (RAID) — b185. A register attached to anything; entries that END with a disposition.
// FLOW A: the three views exist and are reachable — Live · Closure · Impact.
// FLOW B: ⭐ THE OUTCOME LOOP. Open a standalone register → record a risk → the gate refuses to close it →
//         end it as an ACTION → it comes out under "Work came out of it" → the register can then be closed.
// LOCATORS: nav-raida · register-panel · register-tab-{live|closure|impact} · register-new · register-new-type
//           register-new-name · register-new-save · register-subject · raida-add-open · raida-kind · raida-body
//           raida-save · raida-item · raida-close · raida-disposition · raida-close-note · raida-close-save
//           closure-item · register-close
const { test, expect } = require('@playwright/test');
const { mintEntity, composeSelfChit, clickNav } = require('../fixtures');

/**
 * ⚠️⚠️ FORCED LOGGED-OUT, so this file ALWAYS mints its own entity. The authed project carries a saved
 * session, and mintEntity returns that existing entity untouched when one is present — which would write a
 * test register into whoever is signed in. A spec that creates data must own the account it creates it in.
 */
test.use({ storageState: { cookies: [], origins: [] } });

/* ⚠️ The Register is a LAZY capability (app/cap-register.js) opened as an overlay, not a nav screen — so the
   rail button opens a panel and leaves UI.nav where it was. Every wait below is on the panel, never on a URL. */
async function openRegister(page) {
  await page.getByTestId('nav-raida').click();
  await expect(page.getByTestId('register-panel')).toBeVisible({ timeout: 15000 });
}

test.describe('Module · Register', () => {
  test('[REG-01] three views, each reachable', async ({ page }) => {
    await mintEntity(page);
    await openRegister(page);
    for (const v of ['live', 'closure', 'impact']) {
      await test.step(`view: ${v}`, async () => {
        await page.getByTestId(`register-tab-${v}`).click();
        await expect(page.getByTestId(`register-tab-${v}`)).toHaveClass(/on/);
      });
    }
  });

  test('[REG-02] a finding becomes an action, and only then does the register close', async ({ page }) => {
    await mintEntity(page);
    await openRegister(page);

    /* A register on something that is NOT an order — the whole point of register_subject. */
    await page.getByTestId('register-new').click();
    await page.getByTestId('register-new-type').selectOption('campaign');
    await page.getByTestId('register-new-name').fill('E2E qualification');
    await page.getByTestId('register-new-save').click();
    await expect(page.getByTestId('register-subject').filter({ hasText: 'E2E qualification' }))
      .toBeVisible({ timeout: 15000 });

    await page.getByTestId('raida-add-open').click();
    await page.getByTestId('raida-kind').selectOption('risk');
    await page.getByTestId('raida-body').fill('Rig availability may slip past week 3');
    await page.getByTestId('raida-save').click();
    await expect(page.getByTestId('raida-item').filter({ hasText: 'Rig availability' }))
      .toBeVisible({ timeout: 15000 });

    /* ⭐⭐ THE GATE, stated before the button rather than discovered by pressing it. While anything is open the
       close control must not be offered at all — an affordance that will refuse is worse than none. */
    await page.getByTestId('register-tab-closure').click();
    await expect(page.getByText('1 still open')).toBeVisible();
    await expect(page.getByTestId('register-close')).toHaveCount(0);

    /* End it as work, not as "done" — the distinction the six dispositions exist for. */
    await page.getByTestId('register-tab-live').click();
    await page.getByTestId('raida-close').first().click();
    await page.getByTestId('raida-disposition').selectOption('action');
    await page.getByTestId('raida-close-note').fill('Booked the rig for week 2');
    await page.getByTestId('raida-close-save').click();

    /* ⭐ THE OUTCOME. Athi: "at the end of the test, it has to clearly come out as actions?" — it does, and it
       is grouped by what it LANDS ON someone, not by the fact that it stopped being open. */
    await page.getByTestId('register-tab-closure').click();
    await expect(page.getByText('Work came out of it')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('closure-item').filter({ hasText: 'Rig availability' })).toBeVisible();
    await expect(page.getByTestId('register-close')).toBeVisible();
  });

  /**
   * ⚠️⚠️ BOTH HALVES OF THIS WERE MISSING AND NEITHER FAILED LOUDLY — found by the showcase driver once it was
   * made to verify its own writes:
   *
   *   1. the add form had NO target field, so `to_id` was never set, every dependency stayed a sentence, and
   *      the Impact view could not be populated through the product no matter what anyone typed;
   *   2. `carried_forward` was offered in the endings list while the server refuses it without a destination,
   *      so choosing it ALWAYS failed — an affordance that will refuse, which reads as the user's mistake.
   */
  test('[REG-03] a dependency that names a target becomes a walkable edge', async ({ page }) => {
    await mintEntity(page);
    await openRegister(page);

    const newRegister = async (type, name) => {
      await page.getByTestId('register-new').click();
      await page.getByTestId('register-new-type').selectOption(type);
      await page.getByTestId('register-new-name').fill(name);
      await page.getByTestId('register-new-save').click();
      await expect(page.getByTestId('register-subject').filter({ hasText: name.split(' ')[0] }))
        .toBeVisible({ timeout: 20000 });
    };
    await newRegister('release', 'Pad refurbishment');
    await newRegister('campaign', 'Engine E-7 qualification');

    await page.getByTestId('raida-add-open').click();
    await page.getByTestId('raida-kind').selectOption('dependency');
    /* The target fields appear ONLY for a dependency — the other five kinds do not point. */
    await expect(page.getByTestId('raida-to')).toBeVisible();
    await page.getByTestId('raida-body').fill('Cannot start hot-fire until the pad is signed off');
    await page.getByTestId('raida-to').selectOption({ label: 'Pad refurbishment' });
    await page.getByTestId('raida-save').click();
    await expect(page.getByTestId('raida-item').filter({ hasText: 'hot-fire' }))
      .toBeVisible({ timeout: 20000 });

    /* ⭐ THE GRAPH. Before the target field existed this pane could only ever say "nothing points anywhere". */
    await page.getByTestId('register-tab-impact').click();
    await expect(page.getByTestId('walk-graph')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('walk-graph')).toContainText('Pad refurbishment');

    /* And carrying it forward names where it went, rather than failing silently. */
    await page.getByTestId('register-tab-live').click();
    await page.getByTestId('raida-close').first().click();
    await page.getByTestId('raida-disposition').selectOption('carried_forward');
    await expect(page.getByTestId('raida-carry')).toBeVisible();
    await page.getByTestId('raida-carry').selectOption({ label: 'Pad refurbishment' });
    await page.getByTestId('raida-close-note').fill('Moves to the pad register');
    await page.getByTestId('raida-close-save').click();
    await page.getByTestId('register-tab-closure').click();
    await expect(page.getByText('Work came out of it')).toBeVisible({ timeout: 20000 });
  });


  /**
   * ⭐⭐ Athi, 2026-08-30: *"how can the RAID capability be attached to the task or the line item — the risk
   * created for any task should be reflected here."*
   *
   * The path already exists: the worklist line card posts `line_id` to `/api/chits/:id/raida`, `add()` opens a
   * register for the chit on first use, and `report()` returns the entry with `particulars` and `chit_id`. That
   * half is covered by tests/raida.test.cjs.
   *
   * ⚠️⚠️ THIS TEST COVERS THE OTHER HALF ONLY — that such an entry RENDERS naming its line and linking to its
   * order. It injects the report row rather than composing a real chit, and that is a deliberate, stated limit:
   * `composeSelfChit` produces nothing for a freshly minted entity (no catalogue to pick an item from), so an
   * end-to-end version of this fails in the fixture, three steps before it reaches the register. Writing it that
   * way would have made a compose problem look like a register problem every time it broke.
   *
   * The gap that leaves: nothing here proves the two halves meet on a live order. That needs a chit fixture
   * that works, and it is on the backlog rather than pretended away.
   */
  test('[REG-04] a line-scoped entry names its line and links to its order', async ({ page }) => {
    await mintEntity(page);
    await openRegister(page);

    await page.evaluate(() => {
      /* One row shaped exactly as report() returns a line-scoped entry. */
      RG.report = { migrated: true, full: true, open: 1, closed: 0, closed_by_order: 0,
        by_kind: [], by_disposition: {},
        entries: [{
          raida_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          chit_id: '11111111-2222-3333-4444-555555555555',
          line_id: '99999999-8888-7777-6666-555555555555',
          kind: 'risk', body: 'Pads may not clear inspection',
          particulars: 'Brake pads 40mm', subject: 'Brake pads for the E-7 rig',
          owner: 'Rao', by: 'Rao', at: '2026-08-30T00:00:00Z',
          likelihood: 3, severity: 4, score: 12,
          treatment: 'Second source identified', verification_method: 'inspection',
          visibility: 'internal', open: true, ending: null, disposition: null,
        }] };
      RG.subjects = []; RG.sel = null;
      rgPaint();
    });

    const row = page.getByTestId('raida-item').filter({ hasText: 'Pads may not clear inspection' });
    await expect(row).toBeVisible();
    /* ⭐ THE LINE is what "Where" says — not the order, and not a blank. */
    await expect(row).toContainText('Brake pads 40mm');
    /* ⭐ And it is a LINK, so the risk navigates to the order it belongs to. */
    await expect(row.getByTestId('raida-chit-link')).toBeVisible();
    /* The register it hangs off is named after the order. */
    await expect(row).toContainText('Brake pads for the E-7 rig');
    /* And the columns a register is judged on actually carry their values. */
    await expect(row).toContainText('Second source identified');
    await expect(row).toContainText('inspection');
    await expect(row).toContainText('12');
  });

  /**
   * ⭐⭐ Athi, 2026-08-31: *"add the 4 T's response category."*
   *
   * `treatment` is free text and says what we are doing; the CATEGORY says what the decision IS, and it is the
   * column a risk report pivots on.
   *
   * ⚠️ THIS TEST IS ALSO THE GRID GUARD. The header comes from RG_COLS and the cells are written out by hand in
   * rgTr — add a column to one and not the other and every cell after it lands under the wrong heading, with no
   * error anywhere. That is a silent wrong answer of exactly the kind this capability keeps producing.
   */
  test('[REG-05] the response category is offered for a risk, and only for a risk', async ({ page }) => {
    await mintEntity(page);
    await openRegister(page);

    /* The header and the cells must agree, migration or not. */
    const aligned = await page.evaluate(() => {
      RG.report = { migrated: true, full: true, resp: true, open: 1, closed: 0, closed_by_order: 0,
        by_kind: [], by_disposition: {},
        entries: [{ raida_id: 'r-1', chit_id: null, line_id: null, kind: 'risk',
                    body: 'Rig availability', subject: 'Campaign', owner: 'Rao',
                    likelihood: 3, severity: 4, score: 12, treatment: 'Book earlier',
                    response: 'treat', verification_method: 'test',
                    at: '2026-08-31T00:00:00Z', open: true, ending: null }] };
      RG.subjects = []; RG.sel = null;
      rgPaint();
      const head = document.querySelector('.rg-wrap .lhead');
      const row = document.querySelector('.rg-wrap .lrow');
      const keys = (el) => el ? Array.prototype.map.call(el.children, function (c) { return c.getAttribute('data-col'); }) : [];
      return { headKeys: keys(head), rowKeys: keys(row),
               declared: (typeof RG_COLS !== 'undefined') ? RG_COLS.map(function (c) { return c.k; }) : [] };
    });
    /* ⭐⭐ ORDER, not just count. The header and the cells are two renderings of RG_COLS, and a reorder that
       misaligns every column leaves the COUNT correct — so a count check passes while every value sits under
       the wrong heading. Both are now compared against the declaration itself. */
    expect(aligned.headKeys.join(','), 'header order vs RG_COLS').toBe(aligned.declared.join(','));
    expect(aligned.rowKeys.join(','), 'cell order vs RG_COLS').toBe(aligned.declared.join(','));
    expect(aligned.declared.length, 'columns declared').toBeGreaterThan(10);

    const row = page.getByTestId('raida-item').filter({ hasText: 'Rig availability' });
    await expect(row).toContainText('Treat');
    /* ⚠️ Beside the treatment it categorises — apart, a tolerated risk with no treatment reads as a gap. */
    await expect(row).toContainText('Book earlier');

    /* ⭐ Asserted against the INJECTED report, which carries resp:true — so this holds whether or not b192
       has been run on the database behind it. What it proves is the UI contract: the picker exists exactly
       when the column does.
       The picker itself only exists once the column does — a field that silently drops what you type is worse
       than no field, and an all-null column cannot tell you which state you are in. */
    await page.getByTestId('register-tab-live').click();
    await page.getByTestId('raida-add-open').click();
    await page.getByTestId('raida-kind').selectOption('risk');
    await expect(page.getByTestId('raida-response')).toBeVisible();
    /* ⚠️ Not on an assumption. It is not tolerated or transferred, and an action is the work itself. */
    await page.getByTestId('raida-kind').selectOption('assumption');
    await expect(page.getByTestId('raida-response')).toBeHidden();
  });
});
