// mode-survives-order.spec.js — does the DECLARED MODE survive the transaction?
//
// Athi, 2026-08-06: "you only looked at visibility. Make a chit and send it to the supplier and see the result as a
// chit as well. What is selected should reach the supplier — if it is a cart it should reach as a cart, if it is a
// range it should reach as a range."
//
// He is right that the matrix tested the easy half. Rendering a price proves the catalogue READS correctly. It
// says nothing about whether the declaration SURVIVES an order — and the whole product claim is that a business
// receives what it declared it would receive.
//
// So this places real orders through the real endpoints and inspects the resulting CHIT.
//
//   npx playwright test mode-survives-order --project=noauth

const { test, expect } = require('@playwright/test');

const API = process.env.CB_API || 'https://chitbridge-api-production.up.railway.app';
const OTP = process.env.DEV_OTP || '123456';

const SHOPS = {
  INR: { email: 'alpha@test-cb.com', name: 'Alpha Paints',  bridge: 'CB6C7UQHUB' },
  USD: { email: 'gamma@test-cb.com', name: 'Gamma Exports', bridge: 'CBQVKXNTF6' },
};

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null; try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

async function signIn(email, name) {
  await api('/api/entities/register', { method: 'POST', body: { email, display_name: name } });
  const v = await api('/api/entities/verify', { method: 'POST', body: { email, otp: OTP } });
  const j = v.json || {};
  return j.token || (j.entity && j.entity.token) || null;
}

/** Set a shop's declared input mode, add one product, and return what a customer would order. */
async function arrange(shop, preset, pipeline) {
  const token = await signIn(shop.email, shop.name);
  await api('/api/catalogue-face', { method: 'PUT', token,
    body: { face: { method: preset, order_input: { preset, pipeline }, units: ['tonne'] } } });
  const name = `mode-${preset}-${Date.now() % 100000}`;
  const add = await api('/api/products', { method: 'POST', token, body: { item_data: { name, unit: 'tonne', price: 500 } } });
  return { token, name, itemId: add.json && add.json.item && add.json.item.item_id };
}

/** Place an order as an anonymous customer: start (OTP issued) then confirm. */
async function order(bridge, line_items) {
  const email = `buyer-${Date.now()}@test-cb.com`;
  const start = await api(`/api/catalogue/${bridge}/order/start`, { method: 'POST', body: { email } });
  const otp = (start.json && start.json.dev_otp) || OTP;
  const conf = await api(`/api/catalogue/${bridge}/order/confirm`, { method: 'POST', body: { email, otp, line_items } });
  return { email, start, conf };
}

test.describe('the declared mode must survive into the chit', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('CART — the chit records a cart order with a settled total', async () => {
    const shop = SHOPS.INR;
    const { token, name, itemId } = await arrange(shop, 'cart', 'commerce');

    const { conf } = await order(shop.bridge, [{ item_id: itemId, name, quantity: 2 }]);
    expect(conf.status, `order/confirm: ${JSON.stringify(conf.json).slice(0, 260)}`).toBeLessThan(400);

    // Read the chit back from the SHOP's side — what the business actually received.
    const chits = await api('/api/chits/inbox?limit=5', { token });
    const rows = (chits.json && (chits.json.chits || chits.json)) || [];
    const chit = (Array.isArray(rows) ? rows : [])[0];
    expect(chit, 'the shop received no chit at all').toBeTruthy();

    const s = chit.summary_json || {};
    expect(s.order_preset, 'the chit does not record WHICH mode produced it').toBe('cart');
    expect(s.pipeline).toBe('commerce');
    expect(chit.purpose, 'a cart order is an order').toBe('order');
    expect(s.total_value, 'a cart order carries a settled total').not.toBeNull();
    expect(s.currency_code, 'a monetary chit carries its currency').toBe('INR');
  });

  test('RANGE — the chit records an OFFER, with no settled total', async () => {
    const shop = SHOPS.USD;
    const { token, name, itemId } = await arrange(shop, 'range', 'commerce');

    // The buyer NAMES a price. This is the thing a cart cannot express.
    const { conf } = await order(shop.bridge, [{ item_id: itemId, name, quantity: 3, proposal: { price: 420 } }]);
    expect(conf.status, `order/confirm: ${JSON.stringify(conf.json).slice(0, 260)}`).toBeLessThan(400);

    const chits = await api('/api/chits/inbox?limit=5', { token });
    const rows = (chits.json && (chits.json.chits || chits.json)) || [];
    const chit = (Array.isArray(rows) ? rows : [])[0];
    expect(chit, 'the shop received no chit at all').toBeTruthy();

    const s = chit.summary_json || {};
    expect(s.order_preset, 'a range order must arrive AS a range').toBe('range');

    // THE ASSERTION THAT MATTERS. A buyer-proposed price is not an agreed price. If this chit said
    // purpose:'order' with a total_value, it would be a two-party sealed record asserting a figure NEITHER PARTY
    // AGREED — and lib/kyb.js sums total_value into trade-history trust signals.
    expect(chit.purpose, 'a proposed price is an OFFER, not an order').toBe('offer');
    expect(s.total_value, 'an offer must carry NO settled total').toBeNull();
    expect(s.indicative_total, 'the seller figure is kept, under a name nobody can mistake for a total').toBeDefined();
    expect(s.currency_code, 'an offer is still monetary — it carries a currency').toBe('USD');
  });

  test('ENQUIRY — a non-monetary chit carries no currency and no total', async () => {
    const shop = SHOPS.INR;
    const { token, name, itemId } = await arrange(shop, 'enquiry', 'payload');

    // The declared fields go in `payload`, not at the top level — the server refused my first attempt with
    // '"message" is required', which is the declaration doing its job: an enquiry catalogue declares `message`,
    // and a submission without it is not an enquiry.
    const { conf } = await order(shop.bridge, [{ item_id: itemId, name, payload: { message: 'how soon can you deliver?' } }]);
    expect(conf.status, `order/confirm: ${JSON.stringify(conf.json).slice(0, 260)}`).toBeLessThan(400);

    const chits = await api('/api/chits/inbox?limit=5', { token });
    const rows = (chits.json && (chits.json.chits || chits.json)) || [];
    const chit = (Array.isArray(rows) ? rows : [])[0];
    expect(chit).toBeTruthy();

    const s = chit.summary_json || {};
    expect(s.pipeline, 'an enquiry is a payload, not commerce').toBe('payload');
    // The rule settled on 2026-07-31: no currency means this is information, not money.
    expect(s.currency_code, 'a non-monetary chit must carry NO currency').toBeNull();
    expect(s.total_value, 'a non-monetary chit must carry NO total').toBeNull();
  });
});
