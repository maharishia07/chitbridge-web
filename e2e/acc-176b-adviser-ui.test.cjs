'use strict';
// @type: unit
/**
 * acc-176b-adviser-ui.test.cjs - proof of the web half of ACC-176b (adviser access, maker-checker): no browser, no api.
 *
 * OWNS      the rules the adviser screens must keep so data never mixes between clients: (1) the acting context builds headers and store_id from ONE place, the owner sends no header, an auditor only X-Books-For, an adviser both;
 *           (2) a different store clears every registered draft and cache first; the same store keeps them; (3) every write of the queues carries store_id and the body_hash it was shown, accept also total_minor and currency;
 *           (4) a late answer of the previous store is dropped; (5) the firm is offered review, the owner accept, both send back; (6) every refusal code of api PR #1313 has a plain sentence; (7) every control wears a code and an id, each code once; (8) no literal header name outside books-grant-api.js
 * CALLED BY CI (ci.yml, offline guards) · by hand: node e2e/acc-176b-adviser-ui.test.cjs   (ADV_MUTATE=store | clear | late | accept must fail it)
 * CARD      04-network/ACC-176B-ADVISER-REQUIREMENT
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mutate = process.env.ADV_MUTATE || '';
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8');
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok ' : '  FAIL ') + msg); if (!ok) failures++; };

let acting = read('books-acting.js'), actions = read('books-actions-view.js'), api = read('books-grant-api.js'), member = read('books-grant-member.js'), view = read('books-grant-view.js');
if (mutate === 'store') acting = acting.replace('{ store_id: context && context.store.id }', '{}');
if (mutate === 'clear') acting = acting.replace('if (context && String(context.store.id) !== String(store.id)) clearAll();', '');
if (mutate === 'late') actions = actions.replace('if (root.CBBooksActing.current().store.id !== asked) return false;', '');
if (mutate === 'accept') actions = actions.replace('total_minor: row.total_minor, currency: row.currency', '');

/* (1) + (2) the context itself, run as the page runs it */
const sandbox = { tx: (s) => s, esc: (s) => String(s), CBBooksGrantApi: { HEADER: 'X-Books-For', ROLE_HEADER: 'X-Books-Role' } };
sandbox.window = sandbox; vm.createContext(sandbox); vm.runInContext(acting, sandbox);
const A = sandbox.CBBooksActing;
A.enter({ id: 's1', name: 'One' }, 'owner');
check(JSON.stringify(A.headers()) === '{}', 'the owner sends no header');
A.enter({ id: 's1', name: 'One' }, 'auditor');
check(A.headers()['X-Books-For'] === 's1' && !A.headers()['X-Books-Role'], 'an auditor names the store and no role');
A.enter({ id: 's1', name: 'One' }, 'adviser');
check(A.headers()['X-Books-For'] === 's1' && A.headers()['X-Books-Role'] === 'adviser', 'an adviser names the store and the role');
check(A.body({ body_hash: 'h' }).store_id === 's1' && A.body({ body_hash: 'h' }).body_hash === 'h', 'every write body carries the open store_id');
let cleared = 0;
A.onClear(() => { cleared++; });
A.enter({ id: 's1', name: 'One' }, 'adviser');
check(cleared === 0, 'the same store keeps its drafts');
A.enter({ id: 's2', name: 'Two' }, 'adviser');
check(cleared === 1 && A.headers()['X-Books-For'] === 's2' && A.body({}).store_id === 's2', 'another store clears drafts and caches first, then every request names the new store');
A.setCurrency('AUD');
check(/Acting for Two, AUD/.test(A.banner([{ id: 's1', name: 'One' }, { id: 's2', name: 'Two' }]).replace(/<[^>]+>/g, '')), 'the banner says Acting for <store>, <currency>');
check(/ba_switch/.test(A.banner([{ id: 's1', name: 'One' }, { id: 's2', name: 'Two' }])) && !/ba_switch/.test(A.banner([{ id: 's2', name: 'Two' }])), 'the switch is drawn only when the firm holds more than one store');
A.leave();
check(A.current() === null, 'leaving forgets the store');

/* (3) the writes */
for (const key of ['actionsReview', 'actionsReturn', 'actionsAccept']) {
  check(new RegExp("api\\('" + key + "', \\{ params: \\{ id: [a-z._]+ \\}, body: root\\.CBBooksActing\\.body\\(\\{ body_hash: row\\.body_hash").test(actions), key + ' carries store_id (the context) and the body_hash it was shown');
}
check(/total_minor: row\.total_minor, currency: row\.currency/.test(actions), 'accept carries the total and currency of its own row, per action');
check(/CBAction\.run\(/.test(actions) && (actions.match(/confirm: \{/g) || []).length >= 2 && /Accept and post\?/.test(actions) && /reachWords\(rows\)/.test(actions), 'accept asks first and the confirm names the store, count and total');
check(/reason: reason/.test(actions) && /Send this back\?/.test(actions), 'send back carries a reason');
/* (4) the late answer */
check(/if \(root\.CBBooksActing\.current\(\)\.store\.id !== asked\) return false;/.test(actions), 'an answer that arrives after the store changed is dropped');
/* (5) who is offered what */
check(/when: function \(r\) \{ return !owner && r\.state === 'waiting_review'; \}/.test(actions) && /when: function \(r\) \{ return owner && r\.state === 'waiting_accept'; \}/.test(actions), 'the firm is offered review, the owner accept');
check(/bulk: view\.o\.mode === 'owner' && view\.queue === 'accept'/.test(actions), 'bulk accept is the owner\'s, in the accept queue');
/* (6) refusal words */
const codes = ['ACTION_SELF_REVIEW', 'ACTION_NOT_REVIEWED', 'ACTION_BODY_CHANGED', 'ACTION_ACCESS_ENDED', 'ACTION_REF_OPEN', 'ACTION_REF_POSTED', 'ACTION_DUPLICATE', 'ACTION_CLOSED', 'STORE_MISMATCH', 'PREVIEW_TOTAL_DIFFERS', 'BOOKS_ACTION_NOT_SWITCHED_ON'];
check(codes.every((c) => new RegExp('\\b' + c + ': \'').test(api)), 'all ' + codes.length + ' refusal codes have a plain sentence');
/* (7) codes and ids */
const tags = (src) => [...src.matchAll(/<(button|input|select|textarea)\b[^<]*?data-cbsid="([A-Z]{3}\d{3}-[A-Z]\d{2})"[^<]*?>/g)].map((m) => ({ tag: m[0], code: m[2] }));
const mine = [].concat(tags(acting), tags(actions), tags(member).filter((t) => /NET004-(B10|S02)/.test(t.code)));
check(mine.length >= 8 && mine.every((t) => /\sid="/.test(t.tag)), mine.length + ' new controls each wear a code and an id');
const codeList = mine.map((t) => t.code);
check(new Set(codeList).size === codeList.length - 0 || codeList.filter((c, i) => codeList.indexOf(c) !== i).every((c) => c === 'NET007-B01'), 'no code written twice (NET007-B01 is the one generated queue tab)');
/* (9) prepare: the entry sheet PREPARES under an adviser, from the owner's books page opened for the store */
const pub = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const entry = pub('app/cap-entry.js'), core = pub('app/core.js'), accounts = pub('accounts.html');
check(entry.includes("enActingAdviser() ? await enPrepare(body) : await api('booksEventPost'"), 'Save under an adviser grant prepares; any other login posts as before');
check(entry.includes("CBBooksActing.body({ kind: 'journal', body: journal, client_ref: body.client_ref, working_month:") && entry.includes('if (!body.date) throw'), 'prepare sends store_id, kind journal, the body, client_ref and working_month, and needs the date');
check(core.includes("typeof CBBooksActing !== 'undefined' ? CBBooksActing.headers() : {}") && core.includes('...actingHeaders()'), 'every request of a page acting for a store carries its headers; other pages send none');
check(accounts.includes('CBBooksActing.fromAddress(location.search)') && accounts.includes('id="acting-band"') && view.includes("'Prepare a journal'"), 'the books page reads the store from its address and shows the banner; the workspace offers Prepare a journal');
/* (8) the header names live in one file */
check(![acting, actions, member, view].some((src) => /X-Books-(For|Role)/.test(src.replace(/\/\*[^]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/^ \*.*$/gm, ''))), 'no literal header name outside books-grant-api.js');

console.log(failures ? '\nacc-176b-adviser-ui: ' + failures + ' FAILED' : '\nacc-176b-adviser-ui: all passed');
process.exit(failures ? 1 : 0);
