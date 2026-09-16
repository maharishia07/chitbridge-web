// [TILL-22] [TILL-23] A COUNTER IS A STANDING IDENTITY — created once, opened and closed again and again, one PC at a time.
//
// Athi, 2026-09-17: *"it has to be like a co-assist, so I know the counter number, and I should be able to open and close the
// counter again and again — but in only one PC."* And, before that: *"as it is an offline capability, the system should be
// updated with the next seq number whenever the sync completes"*, and *"it has to be online to create a counter."*
//
// ⚠️ THE FAULT THIS REPLACES: a PC "opened a counter" by minting a fresh unnamed key, so one test shop held nine, and two PCs
// numbered as the same C1 — the second PC's sales absorbed as the first's.
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');
const TILL = process.env.CB_TILL_BASE || '';

const helpers = (page) => ({
  app: (name, opts) => page.evaluate(async ({ name, opts }) => {
    try { return { ok: true, body: await api(name, opts || {}) }; }
    catch (e) { return { ok: false, message: (e && e.message) || String(e), status: e && e.status }; }
  }, { name, opts }),
  raw: (method, path, key, body) => page.evaluate(async ({ method, path, key, body }) => {
    const r = await fetch(CFG.API_BASE + path, { method,
      headers: Object.assign({ 'X-Api-Key': key }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch (_) {}
    return { status: r.status, body: j };
  }, { method, path, key, body }),
});

test('[TILL-22] create, open, refuse a second PC, close, reopen and continue, release', async ({ page }) => {
  test.setTimeout(300000);
  await mintEntity(page, { fresh: true, name: 'Ctr ' + Date.now().toString().slice(-6) });
  await page.evaluate(async () => { if (typeof ensureCap === 'function') await ensureCap('admin'); });
  const h = helpers(page);

  let id;
  await test.step('⭐ the shop creates a counter — it gets a number of its own', async () => {
    const r = await h.app('counterAdd', { body: { name: 'Front desk' } });
    expect(r.ok, r.message).toBe(true);
    id = r.body.counter.id;
    expect(id).toMatch(/^[A-Z][1-9]$/);
    expect(r.body.counter.name).toBe('Front desk');
    expect(r.body.counter.state).toBe('closed');
  });

  let keyA;
  await test.step('⭐ a PC opens it', async () => {
    const r = await h.app('counterOpen', { params: { id } });
    expect(r.ok, r.message).toBe(true);
    keyA = r.body.key;
    expect(keyA).toBeTruthy();
    const snap = await h.raw('GET', '/api/till/snapshot?till=C1&issued=0', keyA);
    expect(snap.body.till.assigned_id, 'the PC was not given the COUNTER\'s number').toBe(id);
    expect(snap.body.till.counter).toBe(id);
  });

  await test.step('⛔ ONE PC AT A TIME — a second open is refused and names the holder', async () => {
    const r = await h.app('counterOpen', { params: { id } });
    expect(r.ok, 'two PCs were allowed to hold one counter').toBe(false);
    expect(r.message).toMatch(/already open/i);
  });

  const period = 'P-' + Date.now().toString().slice(-5);
  await test.step('⭐⭐ a bill that reaches ChitBridge moves the counter\'s place in its series', async () => {
    const no = id + '/26-27/0005';
    const r = await h.raw('POST', '/api/chits/send', keyA, {
      recipients: [{ self: true, name: 'self' }], purpose: 'order', subject: 'Counter sale ' + no, client_ref: no,
      business_json: { till: { id }, bill_no: no, billed_at: new Date().toISOString(),
                       series: { prefix: id, period, seq: 5 } },
      line_items: [{ particulars: 'Tea', quantity: 1, unit: 'cup', price: 10, total: 10 }] });
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    let c = null;
    for (let i = 0; i < 10; i++) {     /* the high-water update runs after the answer */
      const l = await h.app('counters');
      c = (l.body.counters || []).find((x) => x.id === id);
      if (c && c.next === 6) break;
      await page.waitForTimeout(800);
    }
    expect(c.next, 'the cloud did not learn where the series stands').toBe(6);
    expect(c.period).toBe(period);
    expect(c.state).toBe('open');
  });

  await test.step('🔒 the PC closes the counter — its key stops, the counter is free and keeps its place', async () => {
    const r = await h.raw('POST', '/api/till/close', keyA, { last_no: id + '/26-27/0005', bills: 1, next: 6, period });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const after = await h.raw('GET', '/api/till/snapshot', keyA);
    expect(after.status, 'a closed counter\'s key still works').toBe(401);
    expect(after.body.code).toBe('COUNTER_CLOSED');
    const l = await h.app('counters');
    const c = l.body.counters.find((x) => x.id === id);
    expect(c.state).toBe('closed');
    expect(c.next, 'closing lost the counter\'s place').toBe(6);
  });

  let keyB;
  await test.step('⭐⭐⭐ OPEN AGAIN — on another PC — and it carries on from its last bill', async () => {
    const r = await h.app('counterOpen', { params: { id } });
    expect(r.ok, 'a closed counter could not be opened again: ' + r.message).toBe(true);
    keyB = r.body.key;
    expect(keyB).not.toBe(keyA);
    const snap = await h.raw('GET', '/api/till/snapshot?till=C1&issued=0', keyB);
    expect(snap.body.till.assigned_id, 'reopening gave a different number').toBe(id);
    expect(snap.body.till.resume_next, 'the new PC was not told where to carry on').toBe(6);
    expect(snap.body.till.resume_period).toBe(period);
  });

  await test.step('⚠️ release — for a PC that cannot close itself — frees the counter and stops that key', async () => {
    const r = await h.app('counterRelease', { params: { id } });
    expect(r.ok, r.message).toBe(true);
    const after = await h.raw('GET', '/api/till/snapshot', keyB);
    expect(after.status).toBe(401);
    const l = await h.app('counters');
    expect(l.body.counters.find((x) => x.id === id).state).toBe('closed');
  });

  await test.step('⚠️ a new counter never takes a number that already has bills in the books', async () => {
    const r = await h.app('counterAdd', { body: { name: 'Billing 2' } });
    expect(r.ok, r.message).toBe(true);
    expect(r.body.counter.id).not.toBe(id);
  });
});

// [TILL-23] ON THE COUNTER ITSELF: a PC that has never held the counter continues its series, and a counter with no number
// yet issues nothing.
test('[TILL-23] a reopened counter continues its run on a PC that never held it', async ({ page, context }) => {
  test.setTimeout(420000);
  await mintEntity(page, { fresh: true, name: 'Ctr2 ' + Date.now().toString().slice(-6) });
  await page.evaluate(async () => { if (typeof ensureCap === 'function') await ensureCap('admin'); });
  const h = helpers(page);
  const id = (await h.app('counterAdd', { body: { name: 'Front desk' } })).body.counter.id;

  /* PC A takes five numbers, then closes */
  const keyA = (await h.app('counterOpen', { params: { id } })).body.key;
  const a = await context.newPage();
  await a.goto(TILL + '/till.html#key=' + encodeURIComponent(keyA));
  await a.waitForFunction(() => window.CBOffers && window.CBTax, null, { timeout: 40000 });
  await a.evaluate(() => refresh());
  const taken = await a.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 5; i++) { LAST_SERIES = null; out.push(await nextNumber()); }
    return { nums: out, series: LAST_SERIES, id: tillId() };
  });
  expect(taken.id, 'PC A did not take the counter\'s number').toBe(id);
  expect(taken.nums[4]).toMatch(new RegExp('^' + id + '/.*/0005$'));
  const close = await h.raw('POST', '/api/till/close', keyA, { next: 6, period: taken.series.period, bills: 0 });
  expect(close.status, JSON.stringify(close.body)).toBe(200);

  await test.step('⭐⭐⭐ PC B — its own browser storage — opens the same counter and issues 0006, not 0001', async () => {
    const keyB = (await h.app('counterOpen', { params: { id } })).body.key;
    const pcB = await page.context().browser().newContext();     /* a different PC: nothing shared with PC A */
    const b = await pcB.newPage();
    await b.goto((TILL || page.url().split('/').slice(0, 3).join('/')) + '/till.html#key=' + encodeURIComponent(keyB));
    await b.waitForFunction(() => window.CBOffers && window.CBTax, null, { timeout: 40000 });
    await b.evaluate(() => refresh());
    const got = await b.evaluate(async () => { LAST_SERIES = null; const no = await nextNumber(); return { no, id: tillId() }; });
    expect(got.id).toBe(id);
    expect(got.no, 'the counter started its series again on the new PC').toMatch(new RegExp('^' + id + '/.*/0006$'));
    await pcB.close();
  });

  await test.step('⚠️ a counter that has never been given a number issues NOTHING', async () => {
    const pcC = await page.context().browser().newContext();
    const c = await pcC.newPage();
    /* ⚠️ the line drops before the counter ever reads the shop — every snapshot is refused */
    await c.route('**/api/till/snapshot**', (r) => r.abort());
    const loose = await page.evaluate(async () => (await api('keysMint', { body: { name: 'loose', scopes: ['till'], days: 1 } })).key);
    await c.goto((TILL || page.url().split('/').slice(0, 3).join('/')) + '/till.html#key=' + encodeURIComponent(loose));
    await c.waitForFunction(() => window.CBOffers && window.CBTax, null, { timeout: 40000 });
    const stopped = await c.evaluate(async () => { window.say = () => {}; return await tillStopped(); });
    expect(stopped, 'a counter with no number from the shop was allowed to bill').toBe(true);
    await pcC.close();
  });
});
