'use strict';
/* Shop Bookkeeper, slice A (walk 19 Nov W22 / W25 / W26): the screens follow what the SERVER says this seat may do.
   - the Bank draws Add statement / Match / Sign off for a Bookkeeper (bkIsBookkeeper, from GET /bank/statement-files may), never for a plain staff seat;
   - the owner-only acts (lock, year close) still read bkIsOwner, which a Bookkeeper is not;
   - a bank line may be added (post) by a Bookkeeper whose may.post is true, refused with the owner's sentence for any other seat;
   - the entry form is told on its FIRST read (GET /events may.post) and says the server's sentence;
   - Add a person / Delegate work send the picked preset's own hat (Bookkeeper = manager).
   Run: node tests/shop-bookkeeper.test.cjs */
const fs = require('fs'), assert = require('assert'), vm = require('vm');
const read = (file) => fs.readFileSync(__dirname + '/../public/app/' + file, 'utf8');
const fn = (source, name) => {
  const at = source.indexOf('function ' + name + '(');
  assert(at >= 0, name + ' found');
  let depth = 0, i = source.indexOf('{', at);
  for (let j = i; j < source.length; j++) {
    if (source[j] === '{') depth++;
    if (source[j] === '}' && --depth === 0) return source.slice(at, j + 1);
  }
  throw new Error('unbalanced ' + name);
};
const books = read('cap-books.js');
const sandbox = { SESSION: { role: 'actor' }, CBBooksActing: { current: () => null, isAdviser: () => false } };
vm.createContext(sandbox);
vm.runInContext('var BK_SEAT = { write: false, post: false };' + fn(books, 'bkSeatRead') + fn(books, 'bkReadOnlySeat') + fn(books, 'bkIsOwner') + fn(books, 'bkIsBookkeeper'), sandbox);
const seat = (may) => { sandbox.bkSeatRead({ may }); return { book: sandbox.bkIsBookkeeper(), owner: sandbox.bkIsOwner() }; };

let n = 0;
const ok = (name) => console.log('  ok  ' + name, ++n);

assert.deepStrictEqual(seat({ write: { may: true }, post: { ok: true } }), { book: true, owner: false });
ok('a Bookkeeper (server: may.write and may.post) is offered the bank acts and is never the owner');
assert.deepStrictEqual(seat({ write: { may: false }, post: { ok: false } }), { book: false, owner: false });
ok('a view-only seat (may.write false) is offered nothing');
assert.deepStrictEqual(seat(undefined), { book: false, owner: false });
ok('an old api with no may answers: nothing is drawn (no guessing from the role)');
sandbox.SESSION = { role: 'entity' };
assert.strictEqual(seat({ write: { may: true }, post: { ok: true } }).book, false);
ok('the owner is not a Bookkeeper seat (the owner keeps bkIsOwner)');
sandbox.SESSION = { role: 'actor' };
sandbox.CBBooksActing = { current: () => ({ role: 'auditor' }), isAdviser: () => false };
assert.strictEqual(seat({ write: { may: true }, post: { ok: true } }).book, false);
ok('an auditor under a grant reads only, whatever the answer says');

const bank = read('cap-bank.js');
assert(/const bkbMayAct = \(\) => peOwner\(\) \|\| bkbActing\(\) \|\| \(typeof bkIsBookkeeper === 'function' && bkIsBookkeeper\(\)\)/.test(bank), 'the Bank acts follow the Bookkeeper seat');
ok('the Bank offers add / match / sign-off to owner, acting adviser or Bookkeeper');
assert(!/peOwner\(\) \|\| .*bkIsBookkeeper/.test(read('cap-period.js')), 'month lock and year close do not follow the Bookkeeper');
assert(!/bkIsBookkeeper/.test(read('cap-period.js')) && !/bkIsBookkeeper/.test(read('cap-period-accruals.js')), 'cap-period*.js never reads the Bookkeeper');
ok('Month lock, accruals and Year close stay on the owner test');

const post = read('cap-bank-post.js');
const refusal = new Function('catalogueText', 'root', post.slice(post.indexOf('function ownerRefusal'), post.indexOf('}\n', post.indexOf('function ownerRefusal') + 40) + 2) + ';return ownerRefusal;')((s) => s, {});
assert.strictEqual(refusal({ role: 'bookkeeper' }), null);
assert.strictEqual(refusal({ role: 'owner' }), null);
assert(/owner/i.test(refusal({ role: 'other' })), 'a seat that may not post is told, in the owner\'s name');
ok('a bank line: the Bookkeeper may add it, another seat is told to ask the owner');

const sheet = read('cap-bank-sheet.js');
assert(/role === 'bookkeeper'/.test(sheet) && !/reopen = .*bookkeeper/.test(sheet), 'reopen stays the owner\'s');
ok('Reopen a locked month is drawn for the owner only');

const entry = read('cap-entry.js');
assert(/post.ok === false && !enActingAdviser()/.test(entry) && /first.may/.test(entry), 'the first read decides');
assert(/EN\.deniedWhy \? tx\(EN\.deniedWhy\)/.test(entry), 'the server sentence is shown');
const open = entry.indexOf('async function enOpen'), saveAt = entry.indexOf('function enSaveWrite');
assert(/EN.deniedWhy = post/.test(entry) && entry.indexOf('enReadDenial(rr[0])') > open && entry.indexOf('enReadDenial(rr[0])') < saveAt, 'told while the sheet opens, not at Save');
ok('the entry form says a seat that cannot post on its first step, with the server\'s sentence, not at Save');

const emp = read('cap-employees.js');
assert.strictEqual((emp.match(/hat: c\.hat \|\| HAT_OF\[c\.level\] \|\| 'act'/g) || []).length, 2, 'Add a person and the access panel both send the preset\'s hat');
assert(/var on = item\.label === cur\.label/.test(emp), 'the ticked preset is the one the server named');
ok('Add a person and Delegate work send the Bookkeeper\'s hat (manager) and tick the preset the server named');
console.log('shop Bookkeeper (web): ' + n + ' passed');
