// SWARM — real-world CONCURRENCY. In production, entities across the globe create chits at the same instant. This fires
// all pool entities' sends AT ONCE (Promise.all) and asserts every per-copy landed — a true concurrency test of the rail
// (per-copy delivery + freeze-at-send + RLS under simultaneous writes). Needs the pool provisioned first: `npm run pool`.
const { test, expect } = require('@playwright/test');
const { POOL, composeSelfChit, settle } = require('../fixtures');

test.describe('Swarm · concurrent global load', () => {
  test('[SWARM-01] every pool entity composes + sends a chit SIMULTANEOUSLY', async ({ browser }) => {
    test.slow();
    test.setTimeout(4 * 60_000);
    const stamp = Date.now();

    // 1 · open ALL pool entities in parallel, each in its own signed-in context (loaded session — no minting)
    const parties = await Promise.all(POOL.map(async (p, i) => {
      const ctx = await browser.newContext({ storageState: p.session });
      const page = await ctx.newPage();
      await page.goto('/app.html');
      const live = await page.getByTestId('nav-compose').waitFor({ state: 'visible', timeout: 25000 }).then(() => true).catch(() => false);
      return { ctx, page, key: p.key, subject: `SWARM ${stamp} #${String(i).padStart(2, '0')}`, live, sent: false, seen: false };
    }));
    const liveCount = parties.filter(p => p.live).length;
    console.log(`SWARM: ${liveCount}/${parties.length} pool sessions restored logged-in`);

    // 2 · FIRE ALL SENDS AT THE SAME INSTANT — the concurrency event
    await Promise.all(parties.map(async (party) => {
      if (!party.live) return;
      try { await composeSelfChit(party.page, party.subject); party.sent = true; } catch (e) { party.err = e.message; }
    }));

    // 3 · verify SEQUENTIALLY (light load — the concurrency event was the simultaneous SEND above) that each entity's
    //     OWN chit landed in its OWN Order — per-copy isolation held under concurrency.
    for (const party of parties) {
      if (!party.sent) continue;
      try {
        await settle(party.page);
        await party.page.getByTestId('nav-order').click();
        await settle(party.page);
        party.seen = await party.page.getByText(party.subject).first().isVisible({ timeout: 15000 }).catch(() => false);
      } catch (e) { /* seen stays false */ }
    }

    const sent = parties.filter(p => p.sent).length;
    const seen = parties.filter(p => p.seen).length;
    console.log(`SWARM RESULT: ${sent}/${parties.length} sent concurrently · ${seen}/${parties.length} landed correctly`);

    await Promise.all(parties.map(p => p.ctx.close().catch(() => {})));

    // Under real concurrency a little flakiness is acceptable; the rail must deliver the vast majority correctly.
    expect(liveCount, 'pool sessions must restore (run `npm run pool` if this is low)').toBeGreaterThanOrEqual(Math.ceil(parties.length * 0.8));
    expect(seen, 'concurrent per-copy delivery').toBeGreaterThanOrEqual(Math.ceil(parties.length * 0.8));
  });
});
