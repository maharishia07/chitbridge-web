// [TILL-18] TWO COUNTERS BOTH CALLED C1. Athi, 2026-09-17: *"from this PC the bills are pushed, but still not
// happening from the other PC."* The screen said "sent", and nothing reached Task.
//
// ⚠️⚠️⚠️ THE ROOT CAUSE. Only three counter bills had reached ChitBridge in five days, and his two PCs — on
// 152.233.15.121 and .123 — were BOTH counter `C1`, because the till id defaults to C1 and nobody renamed either.
// Both numbered C1/26-27/0001, 0002, … independently. The server is idempotent on the bill number, and its
// collision guard compared TILL IDS — equal for two unrenamed counters — so every clash read as a same-device
// retry: the second PC's real sale was absorbed, the server answered 200 with the FIRST PC's chit id, and the
// counter stamped that as its receipt and showed "✓ sent". No failure anywhere; no log; no queue row; no panel.
//
// ⚠️ THE GUARD HAD NEVER BEEN TESTED. Its own comment described this exact case, and the code missed it.
//
// Driven straight at the API: a counter is only a client of POST /api/chits/send, and this is a server rule.
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

/* the bill a counter sends — the same shape tools/tally-connector/till.html chitOf() builds */
const bill = (no, till, at) => ({
  recipients: [{ self: true, name: 'self' }],
  purpose: 'order', subject: 'Counter sale ' + no, manual_subject: 'Counter sale ' + no,
  client_ref: no,
  business_json: {
    customer: { name: 'Walk-in' },
    till: { id: till, name: 'Counter 1', host: 'browser', by: null },
    bill_no: no, billed_at: at,
    payment: { mode: 'cash', paid: 10, change: 0, parts: [] },
    slip: 'cash',
  },
  line_items: [{ particulars: 'Tea', quantity: 1, unit: 'cup', price: 10, total: 10 }],
});

test('[TILL-18] a second counter with the same name and number is refused, not absorbed', async ({ page }) => {
  test.setTimeout(300000);
  await mintEntity(page, { fresh: true, name: 'Clash ' + Date.now().toString().slice(-6) });

  /* two counters, two keys — exactly two PCs paired to one shop */
  const keys = await page.evaluate(async () => {
    if (typeof ensureCap === 'function') await ensureCap('admin');
    const out = [];
    for (const n of ['pc one', 'pc two']) {
      const r = await api('keysMint', { body: { name: n, scopes: ['till'], days: 1 } });
      out.push(r && (r.key || r.api_key));
    }
    return out;
  });
  const base = await page.evaluate(() => (typeof CFG !== 'undefined' && CFG.API_BASE) || '');
  const send = (key, body) => page.evaluate(async ({ base, key, body }) => {
    const r = await fetch(base + '/api/chits/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch (_) {}
    return { status: r.status, body: j };
  }, { base, key, body });

  const NO = 'C1/26-27/' + String(Date.now()).slice(-4);
  const firstAt = new Date(Date.now() - 60000).toISOString();

  let first;
  await test.step('the first PC records its bill', async () => {
    first = await send(keys[0], bill(NO, 'C1', firstAt));
    expect(first.status, 'the first bill did not land: ' + JSON.stringify(first.body)).toBeLessThan(300);
    expect(first.body && first.body.chit_id, 'no chit came back for the first bill').toBeTruthy();
  });

  await test.step('⭐ a genuine RETRY of that same bill is still answered with the same chit — unchanged', async () => {
    const again = await send(keys[0], bill(NO, 'C1', firstAt));
    expect(again.status).toBe(200);
    expect(again.body.duplicate, 'a retry should be recognised as one').toBe(true);
    expect(again.body.chit_id, 'a retry must get back ITS OWN chit').toBe(first.body.chit_id);
  });

  await test.step('⚠️⚠️⚠️ the OTHER PC, also called C1, same number, different sale — REFUSED and named', async () => {
    const other = await send(keys[1], bill(NO, 'C1', new Date().toISOString()));
    /* before the fix this was 200, duplicate:true, and the FIRST PC's chit id — a lost sale reported as sent */
    expect(other.status, 'the second PC\'s sale was absorbed as a retry: ' + JSON.stringify(other.body)).toBe(409);
    expect(other.body.code).toBe('TILL_SERIES_COLLISION');
    expect(other.body.chit_id, 'a refusal must never hand back somebody else\'s chit id').toBeFalsy();
    /* ⚠️ and the words must make sense when both counters carry the same name */
    expect(other.body.message, 'the refusal does not tell them how to fix it').toMatch(/ALSO called C1/);
  });

  await test.step('⭐ a re-paired counter re-sending ITS OWN bill (new key, same moment) is still a retry', async () => {
    /* the stranded-sales rescue sends old bills under a new key — that must not read as a collision */
    const rescued = await send(keys[1], bill(NO, 'C1', firstAt));
    expect(rescued.status, 'a re-sent bill from a re-paired counter was refused').toBe(200);
    expect(rescued.body.chit_id).toBe(first.body.chit_id);
  });
});
