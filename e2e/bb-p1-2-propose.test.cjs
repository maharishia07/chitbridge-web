'use strict';
// @type: unit
/**
 * bb-p1-2-propose.test.cjs - BB-P1-2 web half, no browser, no api: an acting adviser under owner_approves SENDS bank lines to the owner to approve.
 *
 * OWNS      (1) CBBooksActing.proposes() is true only for the adviser seat on an owner_approves grant (posts() unchanged) · (2) the post adapter: a proposing adviser is not refused up front, a plain entry goes to POST /events and a 202 held reply
 *           is ok + held (never an entry), a batch row with held is held, a payment/loan line is said up front and sends nothing, a grant that neither posts nor proposes is still refused with the server's sentence ·
 *           (3) bank-preview.postReady counts held lines apart from added ones · (4) the Add press opens for a proposing seat (cap-bank.js bkbAddRefusal) and stays refused for one that does neither.
 * CALLED BY CI (offline guards) · by hand: node e2e/bb-p1-2-propose.test.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const pub = (f) => path.join(__dirname, '..', 'public', 'app', f);
const read = (f) => fs.readFileSync(pub(f), 'utf8');
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok ' : '  FAIL ') + msg); if (!ok) failures++; };
const fill = (s, h) => Object.keys(h || {}).reduce((t, k) => t.split('{' + k + '}').join(h[k]), s);
const box = { tx: (s) => s, txf: fill, esc: (s) => String(s), console };
box.window = box; box.globalThis = box; vm.createContext(box);
for (const f of ['books-grant-api.js', 'books-acting.js', 'cap-bank-post.js']) vm.runInContext(read(f), box, { filename: f });
const A = box.CBBooksActing, P = box.CBBankPost;
(async () => {
  A.enter({ id: 'c1', name: 'Client' }, 'adviser', 'owner_approves');
  check(A.proposes() && !A.posts(), 'owner_approves: the adviser seat proposes and does not post');
  A.enter({ id: 'c1', name: 'Client' }, 'adviser', 'adviser_posts');
  check(!A.proposes() && A.posts(), 'adviser_posts: posts, does not propose');
  A.enter({ id: 'c1', name: 'Client' }, 'auditor', 'owner_approves');
  check(!A.proposes(), 'an auditor never proposes');
  A.enter({ id: 'c1', name: 'Client' }, 'adviser');
  check(!A.proposes() && !A.posts(), 'no posting named: neither');

  const calls = [];
  let reply = { action_id: 'a1', state: 'waiting_review', total_minor: 1200, currency: 'AUD' };
  const api = async (key) => { calls.push(key); return reply; };
  const item = (type, party) => ({ ref: 'bank:abc-1', event: { type, date: '2026-11-01', amount: 12, narration: 'fee' }, line: { debit_minor: 1200 }, party });
  const run = (who, it) => P.adapter({ api, who })(it);
  let r = await run({ role: 'adviser', posts: false, proposes: true }, item('expense'));
  check(r.ok && r.held === true && r.action_id === 'a1' && calls.join() === 'booksEventPost', 'a proposing adviser sends an expense to POST /events; the 202 reply is held, not an entry');
  check(r.entry_no === undefined, 'a held reply carries no entry number');
  calls.length = 0;
  r = await run({ role: 'adviser', posts: false, proposes: true }, item('payment_made', { status: 'existing', id: 'p1', name: 'Rao' }));
  check(!r.ok && /owner records payments/.test(r.why) && !calls.length, 'a payment with a named party is said up front, nothing is sent');
  r = await run({ role: 'adviser', posts: false, proposes: false }, item('expense'));
  check(!r.ok && /owner has not let you post straight into these books/.test(r.why) && !calls.length, 'a grant that neither posts nor proposes is still refused up front');
  reply = { ok: true, entry_no: 'E9' };
  r = await run({ role: 'adviser', posts: true }, item('expense'));
  check(r.ok && !r.held && r.entry_no === 'E9', 'a posting adviser still gets an entry, never held');
  const many = P.adapter({ api: async () => ({ results: [{ ok: true, held: true, action_id: 'a2' }, { ok: true, duplicate: true }, { ok: false, detail: 'Month locked' }] }), who: { role: 'adviser', posts: false, proposes: true } });
  const rows = await many.many([item('expense'), item('expense'), item('expense')]);
  check(rows[0].held === true && rows[1].ok && !rows[1].held && !rows[2].ok && rows[2].why === 'Month locked', 'a batch: held, duplicate and refused rows each read right');

  const PV = require(pub('bank-preview.js'));
  check(typeof PV.postReady === 'function' || typeof PV === 'object', 'bank-preview loads');
  const src = read('bank-preview.js');
  check(/if \(held\) sum\.held = held/.test(src) && /added: todo\.length - failed\.length - held/.test(src), 'postReady counts held apart from added');
  const bank = read('cap-bank.js');
  check(/function bkbAddRefusal\(\)[\s\S]{0,200}!CBBooksActing\.proposes\(\)/.test(bank) && /if \(bkbAddRefusal\(\)\) return toast\(bkbAddRefusal\(\)\);\n  bankSheetOpen\(row\)/.test(bank), 'the Add press opens for a proposing seat; only a seat that neither posts nor proposes is refused');
  check(/bkbActRefusal\(\)\) \{\n    toast\(bkbActRefusal\(\)\);/.test(bank), 'marks and matches stay refused under owner_approves (the server refuses them)');
  console.log(failures ? failures + ' failed' : 'bb-p1-2 web: all ok');
  process.exit(failures ? 1 : 0);
})();
