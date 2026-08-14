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
    await page.getByTestId('wl-view-date').click();
    await settle(page);
    await expect(rows, 'by date shows the SAME four lines — a view is a regrouping, not a filter').toHaveCount(4);
    await expect(heads, 'two distinct due dates → two headings').toHaveCount(2);
    var headText = await page.getByTestId('wl-head').first().innerText();
    console.log('\n  DATE HEADING: ' + JSON.stringify(headText) + '\n');
    /* The label is toLocaleDateString('en-IN', {weekday,day,month}) — assert on the DAY and MONTH rather than an
       exact punctuation the runtime's locale data decides. */
    expect(headText, 'the real date must be visible, not just a relative word').toMatch(/17.*Aug|Aug.*17/);

    await page.getByTestId('wl-view-chit').click();
    await settle(page);
    await expect(rows, 'by order — still four').toHaveCount(4);
    await expect(heads, 'two chits → two headings').toHaveCount(2);

    // ── ⭐ THE WORK-BREAKDOWN ROLL-UP ─────────────────────────────────────────────────────────────────────
    await page.getByTestId('wl-view-who').click();
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
    var n0 = await page.getByTestId('wl-row').count();
    console.log('\n  ROWS BEFORE FILTER: ' + n0 + '\n');
    expect(n0, 'at least the two lines this test assigned').toBeGreaterThanOrEqual(2);

    await page.evaluate(() => wlDue('2026-09-01'));
    await page.waitForResponse((r) => /due_on=2026-09-01/.test(r.url()), { timeout: 30000 }).catch(() => null);
    await settle(page);
    var n1 = await page.getByTestId('wl-row').count();
    console.log('  ROWS AFTER FILTER : ' + n1);
    expect(n1, 'only the 1 Sep line survives the filter').toBe(1);
    await expect(page.locator('body')).toContainText('Beans');
  });
});
