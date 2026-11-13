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
 *   8. a 5xx (500 502 503 504) keeps the key: a gateway or deadline 5xx can follow a committed payment, and a new key would post twice
 *   9. every answer under 500 ends it (200 400 404 422 409 CONFLICT); a 5xx then a 200 ends it; a changed body after a 5xx is a new key
 *  10. the two copies of the rule (cap-attach.js callDoor, shop.html attemptKey/attemptAnswered) follow the same line
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
vm.runInContext(src.slice(i, j) + '\nthis.cbIdemKey = cbIdemKey; this.attemptOf = attemptOf; this.settleAttempt = settleAttempt; this.serverErrorWords = serverErrorWords;', sandbox);
const { cbIdemKey, attemptOf, settleAttempt, serverErrorWords } = sandbox;

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

  /* 8 · a 5xx keeps the key (FIN-63 follow-up) */
  for (const st of [500, 502, 503, 504]) {
    const kk = keyFor({ ...pay, amount: 900 + st });
    await settleAttempt(PAY, attemptOf('booksPayRecord', {}, { ...pay, amount: 900 + st }), answer(st, { code: 'X' }));
    ok(keyFor({ ...pay, amount: 900 + st }) === kk, `8 · a ${st} keeps the key: the retry is the same attempt`);
  }
  /* 9 · anything under 500 ends it */
  for (const [st, b] of [[200, {}], [400, {}], [404, {}], [422, {}], [409, { code: 'CONFLICT' }]]) {
    const kk = keyFor({ ...pay, amount: 700 + st });
    await settleAttempt(PAY, attemptOf('booksPayRecord', {}, { ...pay, amount: 700 + st }), answer(st, b));
    ok(keyFor({ ...pay, amount: 700 + st }) !== kk, `9 · a ${st}${b.code ? ' ' + b.code : ''} ends the attempt`);
  }
  {
    const body5 = { ...pay, amount: 555 };
    const a5 = attemptOf('booksPayRecord', {}, body5);
    const k5 = keyFor(body5);
    await settleAttempt(PAY, a5, answer(503, {}));
    ok(keyFor({ ...body5, amount: 556 }) !== k5, '9 · after a 503 a changed body is a new key');
    ok(keyFor(body5) === k5, '9 · after a 503 the same body still holds the key');
    await settleAttempt(PAY, a5, answer(200, { ok: true }));
    ok(keyFor(body5) !== k5, '9 · a 503 then a 200 ends the attempt');
  }

  ok(/may already be recorded/.test(serverErrorWords(PAY)) && !/may already/.test(serverErrorWords({ m: 'POST', idem: true })), '8 · a 5xx on a money write says the payment may already be recorded; other writes keep the plain words');

  /* 10a · cap-attach.js callDoor */
  {
    const sent = [];
    let status = 200;
    const ctx = { console, JSON, Object, Promise, Error, encodeURIComponent, crypto: { randomUUID: (() => { let c = 0; return () => 'u' + ++c; })() }, document: { currentScript: { dataset: { cap: 'testing', token: 'T' } }, createElement: () => ({}), head: { appendChild() {} }, body: { appendChild() {} } } };
    ctx.window = ctx;
    ctx.fetch = (url, o) => { sent.push(JSON.parse(o.body).client_ref); return Promise.resolve({ status, ok: status < 400, json: async () => (status === 409 ? { code: 'CONFLICT' } : {}) }); };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'cap-attach.js'), 'utf8'), ctx);
    const send = (code) => { status = code; return ctx.api('testRecord', { body: { v: 1 } }).catch(() => {}); };
    for (const code of [500, 502, 503, 504]) { await send(code); await send(code); ok(sent[sent.length - 1] === sent[sent.length - 2], `10a · cap-attach: a ${code} keeps the client_ref`); }
    for (const code of [200, 400, 404, 422, 409]) { await send(code); await send(code); ok(sent[sent.length - 1] !== sent[sent.length - 2], `10a · cap-attach: a ${code} ends the attempt`); }
    await send(503); await send(200); await send(200);
    ok(sent[sent.length - 3] === sent[sent.length - 2] && sent[sent.length - 1] !== sent[sent.length - 2], '10a · cap-attach: 503 then 200 ends the attempt');
  }

  /* 10b · shop.html attemptKey + attemptAnswered + moneyPost */
  {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'shop.html'), 'utf8');
    const a = html.indexOf('var _ATTEMPTS = {};');
    const b = html.indexOf('function sfLoginStart');
    if (a < 0 || b < 0) throw new Error('shop.html attempt block not found');
    const keys = [];
    let status = 200;
    let m = 0;
    const ctx = { console, JSON, Object, Promise, Date, Math, encodeURIComponent, API: '', BRIDGE: 'b', window: {} };
    ctx.fetch = (url, o) => { keys.push(o.headers['Idempotency-Key']); return Promise.resolve({ status, json: async () => (status === 409 ? { code: 'CONFLICT' } : {}) }); };
    ctx.window.CBOffline = ctx.CBOffline = { _uuid: () => 'k' + ++m };
    vm.createContext(ctx);
    vm.runInContext(html.slice(a, b), ctx);
    const send = (code) => { status = code; return ctx.moneyPost('d', '/order/confirm', { v: 1 }); };
    for (const code of [500, 502, 503, 504]) { await send(code); await send(code); ok(keys[keys.length - 1] === keys[keys.length - 2], `10b · shop: a ${code} keeps the key`); }
    for (const code of [200, 400, 404, 422, 409]) { await send(code); await send(code); ok(keys[keys.length - 1] !== keys[keys.length - 2], `10b · shop: a ${code} ends the attempt`); }
  }

  console.log(bad ? `\n  ✗ ${bad} failed\n` : '\n  ✓ all passed\n');
  process.exit(bad ? 1 : 0);
})();
