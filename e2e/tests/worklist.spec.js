/**
 * worklist.spec.js — EVERY LINE ASSIGNED, ACROSS EVERY CHIT.
 *
 * Athi, 2026-08-14: *"if we go to the actor id, can we able to see their own rows irrespective of the chit? if that
 * is not successful, then division of labour is not useful."*
 *
 * ⚠️ THE ASSERTION THAT MATTERS IS THE COUNT. The API for this existed for weeks with nothing calling it, and when
 * something finally did, every person showed FOUR lines where two were assigned — a join through chit_header
 * multiplying rows, because a self-chit holds two header copies for one entity. Nothing looked wrong: the names
 * were right, the items were right, the dates were right, and every figure was double. So this spec counts.
 *
 * Watch it:  npx playwright test worklist --headed --project=authed
 */
const { test, expect } = require('@playwright/test');
const { mintEntity, composeChit, clickNav, settle } = require('../fixtures');

test.describe('WORKLIST — one person, every chit', () => {
  test.setTimeout(180_000);

  test('WL-01 · lines from two chits, grouped by person, by date and by order', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));

    await mintEntity(page);

    /* Two co-assists and two chits of two lines — the smallest set that can expose a multiplying join. With one
       chit or one person, doubled rows still look plausible. */
    const setup = await page.evaluate(async () => {
      await ensureCap('chit2');   // registers c2AssignLines — a lazy module owns that endpoint
      const s = String(Date.now()).slice(-6);
      const mk = async (name, key) => {
        const r = await api('addActor', { body: { display_name: name, actor_key: key } })
          .catch(async () => api('actors', { body: { display_name: name, actor_key: key } }));
        const a = (r && (r.actor || r)) || {};
        return a.actor_id || a.identity_id || null;
      };
      const A = await mk('Murugan', 'mur' + s);
      const B = await mk('Selvam', 'sel' + s);
      const me = await api('me').catch(() => null);
      const myId = (me && (me.identity_id || (me.entity || {}).identity_id)) || null;
      const subjects = [];
      for (const n of ['A', 'B']) {
        const subject = 'WL ' + n + ' ' + s;
        const sent = await api('createChit', { body: {
          purpose: 'order', manual_subject: subject,
          line_items: [{ particulars: 'Onion ' + n, quantity: 10, unit: 'kg', price: 40 },
                       { particulars: 'Potato ' + n, quantity: 5, unit: 'kg', price: 30 }],
          recipients: myId ? [{ entity_id: myId, role: 'to' }] : [], send_to_self: true } });
        const det = await api('chit', { params: { id: sent.chit_id } });
        const ls = det.live_set || [];
        await api('c2AssignLines', { params: { id: sent.chit_id }, body: { edits: [
          { line_id: ls[0].line_id, assignee_actor_id: A, assignee_name: 'Murugan', due_date: '2026-08-17' },
          { line_id: ls[1].line_id, assignee_actor_id: B, assignee_name: 'Selvam', due_date: '2026-08-19' } ] } });
        subjects.push(subject);
      }
      return { A: A, B: B, subjects: subjects, lines: 4 };
    });
    expect(setup.A, 'two co-assists must exist for the grouping to mean anything').toBeTruthy();

    // ── the screen ──────────────────────────────────────────────────────────────────────────────────────────────
    await page.evaluate(() => { UI.nav = 'worklist'; renderApp(); });
    await page.waitForResponse((r) => /folders\/worklist/.test(r.url()), { timeout: 30000 }).catch(() => null);
    await settle(page);

    await page.getByTestId('wl-expand-all').click();
    await settle(page);
    const rows = page.getByTestId('wl-row');
    /* ⭐ FOUR. Not eight. This is the whole point of the spec. */
    await expect(rows, 'four assigned lines across two chits — eight means a join is multiplying').toHaveCount(4);

    const heads = page.getByTestId('wl-head');
    await expect(heads, 'the owner view groups by person: Murugan and Selvam').toHaveCount(2);
    await expect(page.locator('body')).toContainText('Murugan');
    await expect(page.locator('body')).toContainText('Selvam');

    /* ⚠️ EACH LINE MUST NAME ITS CHIT. A line without its order is an instruction with no context — you cannot ring
       the customer or see who else is waiting on the same delivery. */
    await expect(page.locator('body'), 'each row names the order it came from').toContainText(setup.subjects[0]);
    await expect(page.locator('body')).toContainText(setup.subjects[1]);

    // ── the same rows, a different key order ────────────────────────────────────────────────────────────────────
    await page.getByTestId('wl-view-date').click(); await page.getByTestId('wl-expand-all').click();
    await settle(page);
    await expect(rows, 'by date shows the SAME four lines — a view is a regrouping, not a filter').toHaveCount(4);
    await expect(heads, 'two distinct due dates → two headings').toHaveCount(2);
    var headText = await page.getByTestId('wl-head').first().innerText();
    console.log('\n  DATE HEADING: ' + JSON.stringify(headText) + '\n');
    /* The label is toLocaleDateString('en-IN', {weekday,day,month}) — assert on the DAY and MONTH rather than an
       exact punctuation the runtime's locale data decides. */
    expect(headText, 'the real date must be visible, not just a relative word').toMatch(/17.*Aug|Aug.*17/);

    await page.getByTestId('wl-view-chit').click(); await page.getByTestId('wl-expand-all').click();
    await settle(page);
    await expect(rows, 'by order — still four').toHaveCount(4);
    await expect(heads, 'two chits → two headings').toHaveCount(2);

    // ── ⭐ THE WORK-BREAKDOWN ROLL-UP ─────────────────────────────────────────────────────────────────────
    await page.getByTestId('wl-view-who').click(); await page.getByTestId('wl-expand-all').click();
    await settle(page);
    var roll = await page.getByTestId('wl-head').first().innerText();
    console.log('\n  ROLL-UP: ' + JSON.stringify(roll) + '\n');
    /* ⚠️ Each person here holds two lines in DIFFERENT units (kg and kg here, but the rule is what matters):
       a quantity may only appear when the group is single-unit, never summed across units. */
    expect(roll, 'the heading carries a breakdown, not just a line count').toMatch(/line/);
    expect(roll, 'a count of lines is always present').toMatch(/2 lines/);

    expect(pageErrors, 'a swallowed exception is how the picker looked unbuilt for a day').toEqual([]);
  });

  test('WL-02 · the date filter narrows to one day', async ({ page }) => {
    /* The filter runs server-side, and it looked broken for an hour while it was working perfectly on a doubled
       row set. Asserting the COUNT after filtering is what tells the two apart. */
    await mintEntity(page);
    const s = await page.evaluate(async () => {
      await ensureCap('chit2');   // registers c2AssignLines — a lazy module owns that endpoint
      const s = String(Date.now()).slice(-6);
      const r = await api('addActor', { body: { display_name: 'Kumar', actor_key: 'kum' + s } })
        ;
      const a = (r && (r.actor || r)) || {};
      const who = a.actor_id || a.identity_id;
      const me = await api('me').catch(() => null);
      const myId = (me && (me.identity_id || (me.entity || {}).identity_id)) || null;
      const sent = await api('createChit', { body: { purpose: 'order', manual_subject: 'WL filter ' + s,
        line_items: [{ particulars: 'Beans', quantity: 4, unit: 'kg', price: 20 },
                     { particulars: 'Carrot', quantity: 6, unit: 'kg', price: 25 }],
        recipients: myId ? [{ entity_id: myId, role: 'to' }] : [], send_to_self: true } });
      const ls = (await api('chit', { params: { id: sent.chit_id } })).live_set || [];
      await api('c2AssignLines', { params: { id: sent.chit_id }, body: { edits: [
        { line_id: ls[0].line_id, assignee_actor_id: who, assignee_name: 'Kumar', due_date: '2026-09-01' },
        { line_id: ls[1].line_id, assignee_actor_id: who, assignee_name: 'Kumar', due_date: '2026-09-02' } ] } });
      return s;
    });

    await page.evaluate(() => { UI.nav = 'worklist'; renderApp(); });
    await page.waitForResponse((r) => /folders\/worklist/.test(r.url()), { timeout: 30000 }).catch(() => null);
    await settle(page);
    /* ⚠️ RELATIVE, NOT ABSOLUTE. The authed project reuses ONE minted session, so this entity already holds the
       lines WL-01 assigned. An absolute count here asserts test ORDER, which is how a suite starts failing only
       when run together. */
    await page.getByTestId('wl-expand-all').click();
    await settle(page);
    var n0 = await page.getByTestId('wl-row').count();
    console.log('\n  ROWS BEFORE FILTER: ' + n0 + '\n');
    expect(n0, 'at least the two lines this test assigned').toBeGreaterThanOrEqual(2);

    await page.evaluate(() => wlDue('2026-09-01'));
    await page.waitForResponse((r) => /due_on=2026-09-01/.test(r.url()), { timeout: 30000 }).catch(() => null);
    await settle(page);
    await page.getByTestId('wl-expand-all').click();
    await settle(page);
    var n1 = await page.getByTestId('wl-row').count();
    console.log('  ROWS AFTER FILTER : ' + n1);
    expect(n1, 'only the 1 Sep line survives the filter').toBe(1);
    await expect(page.locator('body')).toContainText('Beans');
  });

  test('WL-03 · groups collapse, open one at a time, and the second key can be switched OFF', async ({ page }) => {
    /* Athi, 2026-08-14: *"can we make it expandable, like name and date can be expandable so we can see all at
       once and can be expanded for the required people or for the date; also under date, if i want to see all
       without who is doing it, any chance of removing the name from the filter — just a checkbox option so the
       filter can omit parameters."*

       Three separate claims, and each is asserted here because each can break alone. */
    await mintEntity(page);
    await page.evaluate(async () => {
      await ensureCap('chit2');
      const s = String(Date.now()).slice(-6);
      const mk = async (n, k) => { const r = await api('addActor', { body: { display_name: n, actor_key: k } });
        const a = (r && (r.actor || r)) || {}; return a.actor_id || a.identity_id; };
      const A = await mk('Devi', 'dev' + s), B = await mk('Arun', 'aru' + s);
      const me = await api('me').catch(() => null);
      const myId = (me && (me.identity_id || (me.entity || {}).identity_id)) || null;
      /* ⚠️ TWO PEOPLE SHARING ONE DAY. That is the case the path-keyed open state exists for: if the id were the
         label alone, opening Devi under 20 Aug would also open Devi under 21 Aug. */
      const sent = await api('createChit', { body: { purpose: 'order', manual_subject: 'WL expand ' + s,
        line_items: [{ particulars: 'Ragi', quantity: 3, unit: 'kg', price: 30 },
                     { particulars: 'Millet', quantity: 7, unit: 'kg', price: 50 }],
        recipients: myId ? [{ entity_id: myId, role: 'to' }] : [], send_to_self: true } });
      const ls = (await api('chit', { params: { id: sent.chit_id } })).live_set || [];
      await api('c2AssignLines', { params: { id: sent.chit_id }, body: { edits: [
        { line_id: ls[0].line_id, assignee_actor_id: A, assignee_name: 'Devi', due_date: '2026-10-20' },
        { line_id: ls[1].line_id, assignee_actor_id: B, assignee_name: 'Arun', due_date: '2026-10-20' } ] } });
    });

    await page.evaluate(() => { UI.nav = 'worklist'; renderApp(); });
    await page.waitForResponse((r) => /folders\/worklist/.test(r.url()), { timeout: 30000 }).catch(() => null);
    await settle(page);

    /* ── ① COLLAPSED IS THE DEFAULT ─────────────────────────────────────────────────────────────────────────── */
    await page.getByTestId('wl-view-date').click();
    await settle(page);
    await expect(page.getByTestId('wl-row'), 'nothing is open until it is opened').toHaveCount(0);
    const heads = page.getByTestId('wl-head');
    const nHeads = await heads.count();
    expect(nHeads, 'every date is a heading you can see at once').toBeGreaterThanOrEqual(1);

    /* ── ② OPENING ONE OPENS ONLY THAT ONE ──────────────────────────────────────────────────────────────────── */
    await page.getByTestId('wl-head').filter({ hasText: '20 Oct' }).click();
    await settle(page);
    const openOnly = await page.getByTestId('wl-row').count();
    console.log('\n  ROWS WITH ONE DATE OPEN: ' + openOnly + ' (heads: ' + nHeads + ')\n');
    expect(openOnly, 'the two lines due 20 Oct, and nothing from any other date').toBe(2);
    await expect(page.locator('body')).toContainText('Ragi');

    /* ── ③ ⭐ THE CHECKBOX OMITS THE SECOND KEY ─────────────────────────────────────────────────────────────── */
    const box = page.getByTestId('wl-then-who');
    await expect(box, 'grouped by date, the person is the split you can drop').toBeChecked();
    await box.uncheck();
    await settle(page);
    await page.getByTestId('wl-expand-all').click();
    await settle(page);
    await expect(page.locator('body'), 'the screen says plainly that it is no longer split').toContainText('not split');
    /* With the name dropped, each row must CARRY the name it no longer inherits from a heading — otherwise
       "show me the day without who is doing it" quietly loses who is doing it. */
    await expect(page.locator('body')).toContainText('Devi');
    await expect(page.locator('body')).toContainText('Arun');
    const flat = await page.getByTestId('wl-row').count();
    const heads2 = await page.getByTestId('wl-head').count();
    console.log('  UNSPLIT: ' + flat + ' rows under ' + heads2 + ' date headings\n');
    expect(heads2, 'dropping a key removes sub-headings, never rows').toBe(nHeads);
    expect(flat, 'every line still present, just not divided by person').toBeGreaterThanOrEqual(2);

    /* ── ④ COLLAPSE ALL puts it back ────────────────────────────────────────────────────────────────────────── */
    await page.getByTestId('wl-collapse-all').click();
    await settle(page);
    await expect(page.getByTestId('wl-row'), 'collapse all closes every level, not just the top').toHaveCount(0);
  });

  test('WL-04 · ⭐ dropping a dimension SUMS over it — the same product totals', async ({ page }) => {
    /* Athi, 2026-08-14, looking at the screen: *"should be the pivot view — when i remove the date, all the same
       item should group together … if i remove the date, what my demand for that particular product?"*

       ⚠️ THE DEFECT THIS PINS DOWN: removing a key only removed a HEADING. The rows stayed loose, so Rice Ponni
       Boiled sat there twice — 120 kg and 50 kg — and the reader added them up by eye. In a pivot, a dimension
       you drop is a dimension you sum over. */
    await mintEntity(page);
    const s = await page.evaluate(async () => {
      await ensureCap('chit2');
      const s = String(Date.now()).slice(-6);
      const r = await api('addActor', { body: { display_name: 'Pandi', actor_key: 'pan' + s } });
      const a = (r && (r.actor || r)) || {}; const who = a.actor_id || a.identity_id;
      const me = await api('me').catch(() => null);
      const myId = (me && (me.identity_id || (me.entity || {}).identity_id)) || null;
      /* ⭐ THE SAME PRODUCT, TWO ORDERS, TWO DIFFERENT DAYS. That is the only shape where "sum over the dropped
         dimension" and "just hide the heading" give different answers. */
      const mk = async (subject, lines, dueDate) => {
        const sent = await api('createChit', { body: { purpose: 'order', manual_subject: subject,
          line_items: lines, recipients: myId ? [{ entity_id: myId, role: 'to' }] : [], send_to_self: true } });
        const ls = (await api('chit', { params: { id: sent.chit_id } })).live_set || [];
        await api('c2AssignLines', { params: { id: sent.chit_id }, body: { edits: ls.map((e) => (
          { line_id: e.line_id, assignee_actor_id: who, assignee_name: 'Pandi', due_date: dueDate })) } });
      };
      /* ⚠️ A SECOND PRODUCT IS NOT PADDING — IT IS WHAT MAKES THE TEST ABLE TO FAIL. With one product the
         person's total and the product's total are the same number, so asserting "170 kg" proves nothing about
         which heading produced it. With Dal in the mix the person totals 200 kg and rice totals 170, and only a
         real per-product roll-up can put 170 on the screen. */
      await mk('Pivot A ' + s, [{ particulars: 'Pivot Rice', quantity: 120, unit: 'kg', price: 60 },
                                { particulars: 'Pivot Dal', quantity: 30, unit: 'kg', price: 140 }], '2026-11-10');
      await mk('Pivot B ' + s, [{ particulars: 'Pivot Rice', quantity: 50, unit: 'kg', price: 60 }], '2026-11-11');
      return s;
    });

    await page.evaluate(() => { UI.nav = 'worklist'; renderApp(); });
    await page.waitForResponse((r) => /folders\/worklist/.test(r.url()), { timeout: 30000 }).catch(() => null);
    await settle(page);

    /* Group by person, no date split — the exact state in his screenshot. */
    await page.getByTestId('wl-view-who').click();
    await settle(page);
    const dateBox = page.getByTestId('wl-then-date');
    if (await dateBox.isChecked()) { await dateBox.uncheck(); await settle(page); }
    await expect(page.getByTestId('wl-byitem'), 'the pivot is on by default').toBeChecked();

    await page.getByTestId('wl-head').filter({ hasText: 'Pandi' }).click();
    await settle(page);

    /* ⭐ ONE heading per product, carrying THAT product's total — not loose rows to add up. */
    const body = await page.locator('body').innerText();
    console.log('\n  PIVOT (person, no date):\n' + body.split('\n').filter((l) => /Pivot|kg/.test(l)).join('\n') + '\n');
    expect(body, '⭐ 120 + 50 = 170 kg — the demand for THAT product, summed for you').toMatch(/170 kg/);
    expect(body, 'and the other product totals on its own — 30, not folded into the rice').toMatch(/30 kg/);
    /* ⚠️ The person above still totals everything they hold: 170 + 30. If this read 170 the roll-up would be
       leaking the last product's figure upward instead of summing the group. */
    expect(body, 'the person heading totals all their work, 200 kg').toMatch(/200 kg/);

    /* ⚠️ AND THE CONSTITUENTS SURVIVE. A total that hides where it came from is worse than no total — you cannot
       ring "170 kg", you ring Pivot A. They sit one level below, which is what makes it a pivot and not a report. */
    await page.getByTestId('wl-expand-all').click();
    await settle(page);
    const opened = await page.locator('body').innerText();
    expect(opened, 'the orders behind the total are one click down').toContain('Pivot A ' + s);
    expect(opened, 'both of them').toContain('Pivot B ' + s);

    /* ── switching the pivot OFF returns the raw lines ───────────────────────────────────────────────────────── */
    await page.getByTestId('wl-byitem').uncheck();
    await settle(page);
    await page.getByTestId('wl-expand-all').click();
    await settle(page);
    const raw = await page.locator('body').innerText();
    console.log('  PIVOT OFF:\n' + raw.split('\n').filter((l) => /Pivot/.test(l)).join('\n') + '\n');
    /* ⚠️ NOT `not.toMatch(/170 kg/)` — the PERSON heading legitimately totals 170 kg of rice + 30 of dal either
       way, so that assertion failed against correct behaviour. What actually changes is the ROW: rolled up it
       leads with the order it came from, unrolled it leads with the product and its own quantity. */
    expect(raw, 'unrolled, each line leads with its own product and quantity').toMatch(/Pivot Rice · 120 kg/);
    expect(raw, 'and the other one stands apart rather than merging').toMatch(/Pivot Rice · 50 kg/);
  });
});
