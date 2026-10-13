#!/usr/bin/env node
/**
 * e2e/cx4-pack-words.cjs — CX4 (2026-10-13): the app's pack gates, proven on the REAL files (no browser, no API):
 *   P1  helpers.packHasHsn — true for India's pack and for no pack (as before), false for Australia's and the UAE's (reg-au / reg-ae carry no hsn_digits)
 *   P2  myCur's fallback — the pack's money (AUD · AED) when the session has none, INR for India
 *   P3  cap-iddocs draws only what the server lists (GET's catalogue): an AU shop's employee record has no PAN / Aadhaar, no Aadhaar note or consent;
 *       before any GET answered the full list is drawn, as before
 *   node e2e/cx4-pack-words.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const PUB = path.join(__dirname, '..', 'public');
let pass = 0, fail = 0;
const ok = (n, c, why) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (why ? ' — ' + why : '')); } };

function page(country, currency) {
  const ctx = { console, SESSION: { token: 't', country, currency }, CFG: { API_BASE: '' }, document: { getElementById: () => null } };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['app/tax.js', 'app/locale.js', 'app/helpers.js', 'app/cap-iddocs.js']) vm.runInContext(fs.readFileSync(path.join(PUB, f), 'utf8'), ctx, { filename: f });
  /* myCur as app.html defines it (the one line, read from the page so this proves the shipped text) */
  const line = fs.readFileSync(path.join(PUB, 'app.html'), 'utf8').split('\n').find((l) => l.startsWith('function myCur(){'));
  vm.runInContext(line, ctx);
  return ctx;
}

(async () => {
  const IN = page('IN', undefined), AU = page('AU', undefined), AE = page('AE', undefined), NONE = page('', undefined);
  ok('P1 packHasHsn: IN true · AU false · AE false · no pack true', IN.packHasHsn() === true && AU.packHasHsn() === false && AE.packHasHsn() === false && NONE.packHasHsn() === true);
  ok('P2 myCur with no session money: IN INR · AU AUD · AE AED', IN.myCur() === 'INR' && AU.myCur() === 'AUD' && AE.myCur() === 'AED', [IN.myCur(), AU.myCur(), AE.myCur()].join(' '));
  ok('P2 myCur: the session\'s money still wins', page('AU', 'INR').myCur() === 'INR');

  const ID = AU.CBIdDocs;
  const before = ID.html([], 'owner', { noButton: true });
  ok('P3 before a GET answered: the full list, as before (PAN · Aadhaar)', /PAN/.test(before) && /Aadhaar/.test(before));
  AU.fetch = async () => ({ ok: true, json: async () => ({ documents: [], catalogue: [{ scheme: 'PHONE' }, { scheme: 'EMAIL' }] }) });
  await ID.load();
  const owner = ID.html([], 'owner', { noButton: true }), self = ID.html([], 'self', { noButton: true });
  ok('P3 an AU shop (the server lists phone · email): no PAN, no Aadhaar, no consent box', !/PAN|Aadhaar|idoc_consent/.test(owner) && /Mobile/.test(owner) && /Email/.test(owner), owner.slice(0, 200));
  ok('P3 the employee\'s own record: no PAN / Aadhaar either', !/PAN|Aadhaar/.test(self));
  IN.fetch = async () => ({ ok: true, json: async () => ({ documents: [], catalogue: ['PHONE', 'EMAIL', 'PAN', 'VOTER_ID', 'DL', 'AADHAAR'].map((s) => ({ scheme: s })) }) });
  await IN.CBIdDocs.load();
  const inOwner = IN.CBIdDocs.html([], 'owner', { noButton: true });
  ok('P3 an Indian shop: PAN · Aadhaar · the Aadhaar note and consent, as before', /PAN/.test(inOwner) && /never stored/.test(inOwner) && /idoc_consent/.test(inOwner));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
