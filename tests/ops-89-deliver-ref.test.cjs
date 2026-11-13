/**
 * tests/ops-89-deliver-ref.test.cjs - OPS-89: the deliver-lines write carries ONE client_ref per user action.
 *
 * OWNS      the proof that public/app/cap-chit2.js c2Deliver and the take-materials write send a client_ref on every row
 *           (the api replays only when one is named: lib/deliverline.js), that a retry of the same action after a failed
 *           send re-sends the SAME ref, that a delivered action drops it so the next press is a new delivery, and that a
 *           different quantity or line is a different action.
 * CALLED BY package.json check script · .github/workflows/ci.yml (web job). The real cap-chit2.js c2PostDelivery in node, the api stubbed.
 * FLOW      c2Deliver / c2TakeMaterial -> c2PostDelivery -> api('c2DeliverLines') -> POST /api/chits/:id/deliver-lines
 * CARD      01-rail-core-the-chit/chit-design-2
 * UNIT      01/Chit design 2 (deliver lines)
 * MUTATION  checked: in cap-chit2.js make c2PostDelivery drop its stamped rows (send rows) -> the body check goes red;
 *           mint the ref inside the send instead of holding it -> the retry check goes red.
 * Run: node tests/ops-89-deliver-ref.test.cjs        (C2_FILE=<path> aims it at another copy: the mutation check)
 */
'use strict';
const path = require('path'),
  fs = require('fs'),
  assert = require('assert');
const FILE = process.env.C2_FILE || path.join(__dirname, '..', 'public', 'app', 'cap-chit2.js');
const src = fs.readFileSync(FILE, 'utf8');
const pick = (re, what) => {
  const m = src.match(re);
  assert(m, what + ' is in cap-chit2.js');
  return m[0];
};

globalThis.window = globalThis;
globalThis.C2 = { id: 'chit-1' };
const sent = [];
let failNext = false;
globalThis.api = async (name, req) => {
  sent.push({ name, params: req.params, body: req.body });
  if (failNext) {
    failNext = false;
    throw new Error('connection lost');
  }
  return { progress: {} };
};
(0, eval)(
  pick(/var C2_REFS = \{\};/, 'C2_REFS') + pick(/function c2NewRef\(\) \{[\s\S]*?\n\}\n/, 'c2NewRef') + pick(/async function c2PostDelivery\([\s\S]*?\n\}\n/, 'c2PostDelivery') +
    ';globalThis.c2PostDelivery = c2PostDelivery;'
);

(async () => {
  const one = () => [{ line_id: 'l1', quantity: 2, unit: 'kg', reference: null }];
  await c2PostDelivery(one());
  const first = sent[0];
  assert.strictEqual(first.name, 'c2DeliverLines');
  assert(first.body.rows.every((r) => typeof r.client_ref === 'string' && r.client_ref.length > 8), 'every row carries a client_ref');

  /* a send that fails keeps the ref: the retry of the SAME action re-sends it, so the api replays instead of recording twice */
  failNext = true;
  await c2PostDelivery(one()).then(() => assert.fail('the first send should fail'), () => {});
  await c2PostDelivery(one());
  const [lost, retry] = sent.slice(1);
  assert.strictEqual(retry.body.rows[0].client_ref, lost.body.rows[0].client_ref, 'a retry reuses the ref of the failed send');
  assert.notStrictEqual(lost.body.rows[0].client_ref, first.body.rows[0].client_ref, 'a delivered action drops its ref: the next press is a new delivery');

  /* a different quantity is a different action; several rows get ref:n */
  await c2PostDelivery([{ line_id: 'l1', quantity: 3, unit: 'kg', reference: null }]);
  assert.notStrictEqual(sent[3].body.rows[0].client_ref, retry.body.rows[0].client_ref, 'another quantity is another action');
  await c2PostDelivery([{ line_id: 'a', quantity: 1 }, { line_id: 'b', quantity: 1 }]);
  const [ra, rb] = sent[4].body.rows.map((r) => r.client_ref);
  assert(ra.endsWith(':0') && rb.endsWith(':1') && ra.slice(0, -2) === rb.slice(0, -2), 'rows of one action share the ref, suffixed by position');

  /* both callers go through it, none posts the write itself */
  assert(!/api\('c2DeliverLines'/.test(src.replace(/async function c2PostDelivery[\s\S]*?\n\}\n/, '')), 'only c2PostDelivery posts c2DeliverLines');
  console.log('ops-89-deliver-ref: ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
