/**
 * attempt-key.test.cjs: FIN-63. A money write (EP row idem:'attempt') sends ONE Idempotency-Key per attempt.
 * CARD 16-finance/payments · owns: the proof of core.js cbIdemKey / attemptOf / settleAttempt · called by: npm run check
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────────────────────────────────
 * POST /api/books/payments with no key, retried after a lost answer, recorded the payment twice (FIN-63).
 * The server's middleware/idempotency.js answers a repeated key with the FIRST answer, but only if the client
 * sends the SAME key on the retry. A fresh key per send (idem:true) protects nothing against a lost answer.
 *
 * Asserted below, each with the failure it prevents:
 *   1. the same door + target + body twice → the same key (a second tap / a retry is ONE payment)
 *   2. a settled answer (2xx) ends the attempt → the next press is a NEW payment, not a silent replay
 *   3. 409 IDEMPOTENCY_IN_PROGRESS keeps the key (the first send is still running)
 *   4. any other refusal (409 ALREADY_PAID, 400) ends the attempt
 *   5. a different body is a different attempt (a corrected amount is not a replay)
 *   6. no answer at all (network failure, timeout: settleAttempt never runs) keeps the key
 *   7. idem:true stays a fresh key per send; a GET has no key
 *
 * Run: node e2e/attempt-key.test.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'core.js'), 'utf8');
const i = src.indexOf('/* the Idempotency-Key of a write');
const j = src.indexOf('async function apiOnce(');
if (i < 0 || j < 0) throw new Error('idempotency block not found in core.js');

let n = 0;
const sandbox = { console, JSON, Date, cblog: () => {}, CB: { _uuid: () => 'k' + ++n } };
vm.createContext(sandbox);
vm.runInContext(src.slice(i, j) + '\nthis.cbIdemKey = cbIdemKey; this.attemptOf = attemptOf; this.settleAttempt = settleAttempt;', sandbox);
const { cbIdemKey, attemptOf, settleAttempt } = sandbox;

const PAY = { m: 'POST', p: '/api/books/payments', idem: 'attempt' };
const answer = (status, body) => ({ status, clone: () => ({ json: async () => body }) });
const keyFor = (body) => cbIdemKey(PAY, false, sandbox.CB, 'rid', attemptOf('booksPayRecord', {}, body));

let bad = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) bad++; };

(async () => {
  console.log('\n══ FIN-63 · one key per payment attempt ══\n');
  const pay = { party_id: 'p1', amount: 400, direction: 'in' };

  const k1 = keyFor(pay);
  ok(k1 && keyFor(pay) === k1, '1 · a second send of the same payment carries the same key');

  await settleAttempt(PAY, attemptOf('booksPayRecord', {}, pay), answer(201, { ok: true }));
  const k2 = keyFor(pay);
  ok(k2 !== k1, '2 · after a 201 the next press is a new attempt (new key)');

  await settleAttempt(PAY, attemptOf('booksPayRecord', {}, pay), answer(409, { code: 'IDEMPOTENCY_IN_PROGRESS' }));
  ok(keyFor(pay) === k2, '3 · 409 IDEMPOTENCY_IN_PROGRESS keeps the key while the first send runs');

  await settleAttempt(PAY, attemptOf('booksPayRecord', {}, pay), answer(409, { code: 'ALREADY_PAID' }));
  const k3 = keyFor(pay);
  ok(k3 !== k2, '4a · 409 ALREADY_PAID is a settled answer: the attempt ends');
  await settleAttempt(PAY, attemptOf('booksPayRecord', {}, pay), answer(400, { code: 'BAD' }));
  ok(keyFor(pay) !== k3, '4b · a 400 is a settled answer: the attempt ends');

  const kA = keyFor({ ...pay, amount: 400 });
  const kB = keyFor({ ...pay, amount: 450 });
  ok(kA !== kB, '5 · a corrected amount is a different attempt');

  ok(keyFor({ ...pay, amount: 450 }) === kB, '6 · no answer (nothing settled) keeps the key for the retry');

  const Q = { m: 'POST', p: '/api/chits/:id/proposals', idem: true };
  const q1 = cbIdemKey(Q, false, sandbox.CB, 'rid', null);
  ok(q1 && cbIdemKey(Q, false, sandbox.CB, 'rid', null) !== q1, '7a · idem:true stays a fresh key per send');
  ok(cbIdemKey({ m: 'GET', p: '/api/books/payments', idem: 'attempt' }, false, sandbox.CB, 'rid', 'x') === null, '7b · a GET has no key');

  console.log(bad ? `\n  ✗ ${bad} failed\n` : '\n  ✓ all passed\n');
  process.exit(bad ? 1 : 0);
})();
