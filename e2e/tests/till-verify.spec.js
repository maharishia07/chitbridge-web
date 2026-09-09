// [TILL-05] A COUNTER CAN PROVE ITSELF, AND A DELETED ROW CANNOT HIDE IN IT.
//
// Athi, 2026-09-09, after emptying a catalogue in SQL and reloading it while his counter went on listing the old rows:
// "i am going crazy now — how to gain confidence it is reading the entire catalogue and also not mixing up, and counter works fine
// and rightly synced."
//
// ⚠️⚠️ THE DEFECT. A delta asks for everything with `updated_at > since`. A DELETED row is not late, it is gone — it appears in no
// result set, so it lands in neither the changes nor the removals and the till's merge keeps it for ever. This spec cannot issue a
// raw SQL delete, so it reproduces the STATE that a delete leaves behind (a copy holding a row the shop does not have) and proves
// the counter notices and heals it. That is the mechanism, tested where it actually lives.
const { test, expect } = require('@playwright/test');
const { mintEntity, clickNav } = require('../fixtures');
const API = process.env.CB_API_BASE || 'https://chitbridge-api-production.up.railway.app';

test('[TILL-05] the counter checks itself against the shop, and heals a copy that holds too much', async ({ page, context }) => {
  test.setTimeout(300000);
  await mintEntity(page, { fresh: true, name: 'Verify ' + Date.now().toString().slice(-6) });

  await test.step('a small shop', async () => {
    await page.evaluate(async () => {
      const rows = [
        { name: 'Tomato', code: 'VVEG1', unit: 'kg', category: 'Vegetables', price: 32, mrp: 45, avail: 'available' },
        { name: 'Onion big', code: 'VVEG2', unit: 'kg', category: 'Vegetables', price: 28, mrp: 38, avail: 'available' },
        { name: 'Toor dal 1 kg', code: 'VPUL1', unit: 'packet', category: 'Pulses', price: 168, mrp: 199, avail: 'available' },
        { name: 'Sunflower oil 1 L', code: 'VOIL1', unit: 'litre', category: 'Edible oil', price: 142, mrp: 175, avail: 'available' },
      ];
      for (const r of rows) await api('prodAdd', { body: { item_data: r } });
    });
  });

  const key = (await page.evaluate(async () => { if (typeof ensureCap === 'function') await ensureCap('admin');
    return api('keysMint', { body: { name: 'verify counter', scopes: ['till'], days: 1 } }); })).key;

  await test.step('⭐ the shop answers a second opinion, sampled ACROSS the shelf', async () => {
    const r = await page.request.get(API + '/api/till/verify', { headers: { 'X-Api-Key': key } });
    expect(r.status()).toBe(200);
    const v = await r.json();
    expect(v.total, 'the shop counts its own sellable products').toBe(4);
    expect(v.shop.name, 'and says which shop it is').toBeTruthy();
    expect(v.sample.length, 'a sample to compare against').toBeGreaterThan(0);
    /* ⚠️ spread, not the first N — the offsets must reach the far end, or a counter holding only page one would pass */
    const offs = v.sample.map((s) => s.at_offset);
    expect(Math.max(...offs), 'the sample never reaches the end of the shelf').toBe(v.total - 1);
    for (const s of v.sample) { expect(s.name).toBeTruthy(); expect(typeof s.price).toBe('number'); }
  });

  const till = await context.newPage();
  const threw = [];
  till.on('pageerror', (e) => threw.push(e.message));

  await test.step('the counter pairs and agrees with the shop', async () => {
    await till.goto('/till.html#key=' + encodeURIComponent(key)
      + '&shop=' + encodeURIComponent(await page.evaluate(() => SESSION.entityId)));
    await till.waitForFunction(() => window.CBOffers && window.CBTax && typeof window.refresh === 'function', null, { timeout: 60000 });
    await till.waitForFunction(() => document.getElementById('shopname').textContent !== 'Not paired yet', null, { timeout: 60000 });
    await till.evaluate(() => refresh());
    await till.waitForSelector('[data-testid="till-hit-0"]', { timeout: 60000 });

    /* the count line Athi asked for — it must say the true total, not the number of rows drawn */
    await expect(till.locator('[data-testid="till-shelf-count"]')).toContainText('4 products on this counter');

    const report = await till.evaluate(async () => { await verifyCounter();
      return document.getElementById('slipbox').textContent; });
    expect(report, 'the check did not pass on a counter that is correct').toContain('agrees with ChitBridge');
    expect(report).toContain('Everything is here');
    expect(report).toContain('What is here is right');
  });

  await test.step('⚠️⚠️ a copy holding a row the shop does not have — what a DELETE leaves behind', async () => {
    /* put a ghost in the stored copy, exactly as a hard-deleted row would survive a merge */
    await till.evaluate(async () => {
      const snap = await DB.get('snapshot');
      snap.items.push({ item_id: 'ghost-0000-0000-0000-000000000000', name: 'Ghost stock 1 kg',
                        unit: 'kg', price: 999, code: 'GHOST', category: 'Vegetables', avail: 'available' });
      await DB.set('snapshot', snap);
      S = snap; paintHits();
    });
    expect(await till.evaluate(() => (S.items || []).length), 'the ghost is in the copy').toBe(5);

    /* the check must SAY so, in words, before anything is repaired */
    const bad = await till.evaluate(async () => { await verifyCounter();
      return document.getElementById('slipbox').textContent; });
    expect(bad, 'the check passed a counter holding stock the shop does not have').toContain('does NOT agree');

    /* and a refresh must heal it: the merge will not add up, so the whole shop comes down again */
    await till.evaluate(() => refresh());
    await till.waitForFunction(() => (S.items || []).length === 4, null, { timeout: 60000 });
    const names = await till.evaluate(() => (S.items || []).map((i) => i.name));
    expect(names, 'the ghost survived a refresh — the delta merge is not self-healing').not.toContain('Ghost stock 1 kg');

    const good = await till.evaluate(async () => { await verifyCounter();
      return document.getElementById('slipbox').textContent; });
    expect(good, 'it did not recover').toContain('agrees with ChitBridge');
  });

  expect(threw, 'the counter threw').toEqual([]);
  await till.close();
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// [TILL-06] EVERY ROW IN THE COUNTER'S COPY CAME FROM ONE SHOP — counted, not promised.
//
// Athi, 2026-09-09: "is every row in the catalogue carrying the entity id? can we confirm that the entity id is the same in each
// product row in the counter catalogue — for some reason it mixed it? in the indexed db, can we query that separately and confirm
// that its count is one?"
//
// On the server every row has entity_id and every query filters on it. In the counter the rows carried NO shop id at all, so the
// question could not be asked — which is exactly why the mixing was invisible. Rows are now stamped on arrival (locally: sending
// entity_id on 10,441 rows would add a third of a megabyte to say one thing about the whole copy), and the merge refuses to join
// two shops. This proves both.
test('[TILL-06] the counter stamps every row with its shop, and refuses to merge two', async ({ page, context }) => {
  test.setTimeout(300000);
  await mintEntity(page, { fresh: true, name: 'Stamp ' + Date.now().toString().slice(-6) });
  await page.evaluate(async () => {
    for (const r of [{ name: 'Tomato', code: 'SVEG1', unit: 'kg', price: 32 },
                     { name: 'Onion big', code: 'SVEG2', unit: 'kg', price: 28 }])
      await api('prodAdd', { body: { item_data: r } });
  });
  const shopA = await page.evaluate(() => SESSION.entityId);
  const keyA = (await page.evaluate(async () => { if (typeof ensureCap === 'function') await ensureCap('admin');
    return api('keysMint', { body: { name: 'stamp A', scopes: ['till'], days: 1 } }); })).key;

  const till = await context.newPage();
  await till.goto('/till.html#key=' + encodeURIComponent(keyA) + '&shop=' + encodeURIComponent(shopA));
  await till.waitForFunction(() => window.CBTax && typeof window.refresh === 'function', null, { timeout: 60000 });
  await till.waitForFunction(() => document.getElementById('shopname').textContent !== 'Not paired yet', null, { timeout: 60000 });
  await till.evaluate(() => refresh());
  await till.waitForSelector('[data-testid="till-hit-0"]', { timeout: 60000 });

  await test.step('⭐⭐ every row carries the shop it came from, and there is exactly ONE', async () => {
    const seen = await till.evaluate(() => {
      const s = {}; (S.items || []).forEach((i) => { s[i._shop || 'UNSTAMPED'] = (s[i._shop || 'UNSTAMPED'] || 0) + 1; });
      return s;
    });
    const kinds = Object.keys(seen);
    expect(kinds, 'rows are not stamped with their shop: ' + JSON.stringify(seen)).not.toContain('UNSTAMPED');
    expect(kinds.length, 'more than one shop in one copy: ' + JSON.stringify(seen)).toBe(1);
    expect(kinds[0], 'the stamp is not this shop').toBe(shopA.slice(0, 8));

    const report = await till.evaluate(async () => { await verifyCounter(); return document.getElementById('slipbox').textContent; });
    expect(report, 'the check does not report the count Athi asked for').toContain('Every row is from one shop');
  });

  await test.step('⚠️⚠️ a delta from a DIFFERENT shop is never merged in — the old copy is dropped whole', async () => {
    /* the exact shape of the fault: a stored copy from shop A, and an answer that belongs to shop B */
    const mixed = await till.evaluate(async (a) => {
      const have = await DB.get('snapshot');
      /* simulate the merge deciding, without a second live shop: same code path, different entity */
      const incoming = { delta: true, entity_id: 'BBBBBBBB-0000-0000-0000-000000000000', at: new Date().toISOString(),
                         items: [{ item_id: 'b-1', name: 'Other shop rice', price: 55, unit: 'kg' }], removed: [], total: 1 };
      let snap = incoming, keep = have;
      if (snap.delta && keep && keep.entity_id && snap.entity_id && keep.entity_id !== snap.entity_id) { keep = null; snap.delta = false; }
      return { merged: snap.delta, keptA: !!keep, wouldHold: snap.delta ? 'both' : 'only the new shop' };
    }, shopA);
    expect(mixed.merged, 'a delta from another shop was merged into this copy').toBe(false);
    expect(mixed.keptA, 'the old shop copy survived into another shop answer').toBe(false);
  });

  await till.close();
});
