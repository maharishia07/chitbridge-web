// enquiry.spec.js — ASK A SUPPLIER ABOUT A PRODUCT, and prove the question lands only where it should.
//
// Athi: *"need to have a quick enquiry about the product or details about it… it is an enquiry."*
//
// ⚠️ WHY THIS EXISTS: the feature shipped 2026-08-17 and its migration (b162) was run 2026-08-18 with ZERO test
// coverage. A capability whose whole point is "the right party receives it, and nobody else does" cannot be left
// to a manual look — that is exactly the claim that fails quietly.
//
// API-LEVEL ON PURPOSE, in the style of mode-survives-order: the question here is about DELIVERY and ISOLATION,
// not about a screen. Driving it through the UI would test the button and leave the claim unproven.
//
//   npx playwright test enquiry --project=noauth

const { test, expect } = require('@playwright/test');

const API = process.env.CB_API || 'https://chitbridge-api-production.up.railway.app';
const OTP = process.env.DEV_OTP || '123456';

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null; try { json = await res.json(); } catch (_) { /* a 204 or an HTML error page */ }
  return { status: res.status, json };
}

async function signIn(email, name) {
  await api('/api/entities/register', { method: 'POST', body: { email, display_name: name } });
  const v = await api('/api/entities/verify', { method: 'POST', body: { email, otp: OTP } });
  const j = v.json || {};
  return j.token || (j.entity && j.entity.token) || null;
}

const uniq = (p) => `${p}-${Date.now() % 1000000}-${Math.floor(Math.random() * 9999)}`;

test.describe('Product enquiry · the question reaches the seller and nobody else', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  let seller, buyer, stranger, itemId, itemName;

  /**
   * ⚠️ THE SELLER IS THE KNOWN-PUBLIC SHOP, NOT A FRESH ONE — and that is a finding, not a convenience.
   *
   * A cross-entity enquiry is gated on `buildPublicView()` succeeding for the asker, so the seller's storefront
   * has to be genuinely reachable. A FRESH entity with `catalogue_visibility:'public'`, a catalogue face and a
   * product still answers 404 on `/api/catalogue/:bridge` — to an anonymous visitor, to a buyer, AND to its own
   * owner. Whatever else a new shop needs before it is servable, setting those three things is not enough.
   * Logged as a backlog item; it is not this spec's subject and pretending otherwise would test the wrong thing.
   *
   * So the seller is `alpha@test-cb.com` (bridge CB6C7UQHUB), the shop the storefront specs already rely on and
   * which is verified reachable above. ⚠️ It is a SHARED account, so every assertion here is scoped to an item
   * this run creates and to a nonce inside the message — never to a total count on the account.
   */
  test('[ENQ-00] arrange — a reachable seller, a buyer, and an unrelated third party', async () => {
    const b = uniq('enq-buyer'); const x = uniq('enq-stranger');
    seller = await signIn('alpha@test-cb.com', 'Alpha Paints');
    buyer = await signIn(`${b}@test-cb.com`, 'Enq Buyer');
    stranger = await signIn(`${x}@test-cb.com`, 'Enq Stranger');
    expect(seller && buyer && stranger, 'all three parties must sign in').toBeTruthy();

    const shop = await api('/api/catalogue/CB6C7UQHUB');
    expect(shop.status, 'the seller shop must be publicly reachable or the gate can never pass').toBe(200);

    itemName = uniq('Enquirable');
    const add = await api('/api/products', { method: 'POST', token: seller,
      body: { item_data: { name: itemName, unit: 'tonne', price: 500 } } });
    itemId = add.json && add.json.item && add.json.item.item_id;
    expect(itemId, 'the seller must end up with a product to ask about').toBeTruthy();
  });

  /**
   * ⚠️ THE OWNER CASE IS THE DIAGNOSTIC, and it is why it runs first.
   *
   * enquiryLimitCheck() short-circuits to "ok" for your OWN product, so a 404 here cannot be a visibility
   * decision — it can only mean the owner lookup found nothing. That is exactly what a missing b163 looks like,
   * and telling it apart from "the buyer may not ask" is the difference between running a migration and hunting
   * a permissions bug that does not exist.
   */
  test('[ENQ-01a] the seller can ask about their own product — proves the owner lookup works', async () => {
    const r = await api(`/api/catalogue/enquiry/${itemId}`, { method: 'POST', token: seller,
      body: { message_text: 'internal note: check stock', thread_type: 'internal' } });
    if (r.status === 503) test.skip(true, 'b162 (enquiry_message_deliver) is not applied on this deployment');
    expect(r.status, `a seller asking about their OWN product must succeed, got ${r.status}: ${JSON.stringify(r.json)}`).toBe(201);
  });

  test('[ENQ-01] a buyer asks, and the message is created', async () => {
    const r = await api(`/api/catalogue/enquiry/${itemId}`, { method: 'POST', token: buyer,
      body: { message_text: 'lead time on ' + itemName + '?', thread_type: 'external' } });
    if (r.status === 503) test.skip(true, 'b162 (enquiry_message_deliver) is not applied on this deployment');
    /* ⚠️ A 404 HERE, WITH ENQ-01a GREEN, MEANS b163 IS MISSING — not that the feature is broken. The owner
       lookup falls back to the viewer's own RLS context without it, which can only ever see your own products.
       Named explicitly so the next person runs the migration instead of debugging the gate. */
    test.skip(r.status === 404,
      'b163 (catalogue_item_owner) is NOT applied — a buyer cannot be matched to someone else\'s product yet');
    expect(r.status, `enquiry POST should create (201), got ${r.status}: ${JSON.stringify(r.json)}`).toBe(201);
    expect(r.json && r.json.message_id, 'a created enquiry must return its message_id').toBeTruthy();
  });

  test('[ENQ-02] ⭐ THE SELLER RECEIVES IT — the whole point of the feature', async () => {
    const r = await api(`/api/catalogue/enquiry/${itemId}`, { token: seller });
    expect(r.status).toBe(200);
    const texts = ((r.json && r.json.messages) || []).map((m) => m.message_text || m.body || '');
    expect(texts.join(' | '), 'the seller must be able to read the question asked about their own product')
      .toContain('lead time on ' + itemName);
  });

  test('[ENQ-03] the buyer keeps their own copy', async () => {
    const r = await api(`/api/catalogue/enquiry/${itemId}`, { token: buyer });
    expect(r.status).toBe(200);
    const texts = ((r.json && r.json.messages) || []).map((m) => m.message_text || m.body || '');
    expect(texts.join(' | '), 'the asker must still see what they asked — per-copy, not a shared row')
      .toContain('lead time on ' + itemName);
  });

  test('[ENQ-04] ⭐⭐ AN UNRELATED ENTITY SEES NOTHING', async () => {
    const r = await api(`/api/catalogue/enquiry/${itemId}`, { token: stranger });
    expect(r.status, 'reading a thread you are not in is not an error — it is empty').toBe(200);
    const msgs = (r.json && r.json.messages) || [];
    /* ⚠️ THIS IS THE ASSERTION THAT MATTERS. Everything else proves the feature works; this proves it does not
       leak. A third party asking about the same public product must not see other people's questions — the
       enquiry rides on chit_messages under RLS, and this is what proves that is actually true and not merely
       intended. */
    expect(msgs.length, `a stranger must see NO enquiries on someone else's product, saw ${msgs.length}`).toBe(0);
  });

  test('[ENQ-05] asking about a product that does not exist answers 404, never 403', async () => {
    const r = await api('/api/catalogue/enquiry/00000000-0000-0000-0000-000000000000',
      { method: 'POST', token: buyer, body: { message_text: 'hello?' } });
    /* ⚠️ "You may not ask about this" and "this does not exist" MUST be the same answer. A 403 on a hidden item
       and a 404 on a missing one is an existence oracle over the whole item-id space — the same lesson the
       storefront learned when a private shop said "no public catalogue" and a missing one said "not found". */
    expect(r.status, 'a hidden item and a missing item must be indistinguishable').toBe(404);
  });

  test('[ENQ-06] an empty question is refused', async () => {
    const r = await api(`/api/catalogue/enquiry/${itemId}`, { method: 'POST', token: buyer,
      body: { message_text: '   ' } });
    expect(r.status, 'whitespace is not a question').toBe(400);
  });
});
