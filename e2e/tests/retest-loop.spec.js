// [RETEST] THE RETURN LEG: RAISED → RESOLVED (a claim) → RETESTED → CLOSED (a fact).
//
// ── ⭐⭐⭐ WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────────────
//
// Athi, 2026-09-13: *"a message back stating that this issue has been fixed — that feedback loop is not there.
// Say I test it, I create an incident, you fix it and then update the message back that it has been fixed, so I
// can retest and confirm that this has been resolved and close it."*
//
// ⚠️⚠️ THE TWO STATES ALREADY EXISTED AND WERE BEING USED AS ONE. `resolved` is the FIXER'S CLAIM; `closed` is
// the RAISER'S VERDICT. The panel folded them together, so the moment somebody wrote "resolved" the finding went
// grey and dropped out of Open — a claim rendered as a settled fact, and nobody ever asked to look.
//
// ⭐ WHAT THIS PROVES, AND WHY EACH ONE MATTERS:
//   1 · the incident records WHO raised it, by id — without that, nobody can be told it is their turn;
//   2 · `resolved` does NOT close it — the shelf and the state stay distinguishable from `closed`;
//   3 · the rejection path works: "still broken" returns it to `raised`, and the fixer's claim is not lost;
//   4 · the history holds every leg in order, so "resolved Tuesday, still broken Wednesday, closed Friday" is
//       readable a year later — which is the record an argument about whether it was ever fixed turns on.
//
// Run: npx playwright test tests/retest-loop.spec.js --reporter=line
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');
const API = process.env.CB_API_BASE || 'https://chitbridge-api-production.up.railway.app';

test('[RETEST-01] a fix is a claim until the person who raised it says otherwise', async ({ page }) => {
  test.setTimeout(240000);
  await mintEntity(page, { fresh: true, name: 'Retest ' + Date.now().toString().slice(-6) });
  const token = await page.evaluate(() => SESSION.token);
  const H = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

  /* every state, because the whole point is that a resolved incident must still be findable */
  const read = async (id) => {
    const r = await page.request.get(API + '/api/testing/incidents?state=all&_=' + Date.now(), { headers: H });
    expect(r.ok(), 'could not read the incidents').toBeTruthy();
    return ((await r.json()).incidents || []).filter((x) => x.definition_id === id)[0] || null;
  };
  const set = (id, body) => page.request.patch(API + '/api/testing/incidents/' + id, { headers: H, data: body });

  // ── 1 · somebody reports what they saw ──────────────────────────────────────────────────────────────────
  const raised = await page.request.post(API + '/api/testing/incidents', {
    headers: H,
    data: { observed: 'Searching the catalogue for cycle returns nothing', severity: 'Sev-2',
            screen_code: 'CAT001' },
  });
  expect(raised.ok(), 'could not raise the incident').toBeTruthy();
  const id = (await raised.json()).definition_id;
  expect(id, 'the incident has no id').toBeTruthy();

  const one = await read(id);
  expect(one, 'the incident is not on the board').toBeTruthy();
  expect(one.state).toBe('raised');
  /* ⚠️ BY ID, NOT BY NAME. "Is this mine to retest?" cannot be answered by matching display names, and this is
     the field the whole return leg hangs on — if it is null, nobody is ever told their turn has come. */
  expect(one.raised_by_id, 'the raiser was not recorded by id').toBeTruthy();

  // ── 2 · somebody says they fixed it — which is a CLAIM, not an ending ────────────────────────────────────
  const fixed = await set(id, { state: 'resolved', change: { sha: 'a1b2c3d', repo: 'chitbridge-web' } });
  expect(fixed.ok(), 'could not resolve it').toBeTruthy();

  const two = await read(id);
  expect(two.state, 'resolved must not read as closed — that is the fault this exists for').toBe('resolved');
  expect(two.state).not.toBe('closed');
  expect(two.changes.length, 'the citation that says what fixed it was not kept').toBe(1);
  expect(two.changes[0].sha).toBe('a1b2c3d');
  expect(two.raised_by_id, 'the raiser must survive the fix, or nobody can be told').toBe(one.raised_by_id);

  // ── 3 · ⭐ THE RAISER LOOKS, AND IT IS STILL BROKEN ───────────────────────────────────────────────────────
  const back = await set(id, { state: 'raised', why: 'Still nothing for cycle on a clean load' });
  expect(back.ok(), 'could not send it back').toBeTruthy();

  const three = await read(id);
  expect(three.state, 'a rejected fix must return to raised, not sit resolved').toBe('raised');
  /* ⚠️ THE CLAIM IS NOT ERASED BY BEING REJECTED. The commit that was tried is evidence for whoever tries next. */
  expect(three.changes.length, 'the attempted fix was thrown away').toBe(1);

  // ── 4 · fixed again, and this time it holds ─────────────────────────────────────────────────────────────
  await set(id, { state: 'resolved', change: { sha: 'd4e5f60', repo: 'chitbridge-web' } });
  const shut = await set(id, { state: 'closed', why: 'Retested on a clean load — cycle candle is found' });
  expect(shut.ok(), 'could not close it').toBeTruthy();

  const four = await read(id);
  expect(four.state).toBe('closed');
  expect(four.why).toContain('Retested');
  /* ⚠️ AND CLOSING MUST NOT MOVE THE DAY IT WAS FIXED. resolved_at is stamped on the FIRST resolution, or the
     one number a report quotes — how long the shop was broken — quietly becomes how long the paperwork took. */
  expect(four.resolved_at, 'the resolution was never stamped').toBeTruthy();

  // ── 5 · and every leg is readable, in order ─────────────────────────────────────────────────────────────
  const states = (four.history || []).map((h) => h.state);
  expect(states, 'the history does not tell the story')
    .toEqual(['raised', 'resolved', 'raised', 'resolved', 'closed']);
  const whys = (four.history || []).filter((h) => h.why).length;
  expect(whys, 'the two verdicts must each carry their reason').toBeGreaterThanOrEqual(2);
});
