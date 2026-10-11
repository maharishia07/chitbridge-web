/* Finance guard (F1): static — no browser. CB Finance · Collections agrees with itself and with the pieces it reuses:
   · finance.html wears the ONE frame (CBAvatar · the header with Home · the kural band · the one sign-in) and loads what cap-finance.js reaches for;
   · the Home door points at /finance.html (state built);
   · the only call is the existing booksDues row, asked with finance=1; Receive is payOpen (the one payment path), Remind is bkRemind (M28);
   · cap-finance.js computes no money (no arithmetic on *_minor), never paints a server message raw, and shows the owner-only sentence greyed. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let fail = 0; const bad = (m) => { fail++; console.log('FAIL ' + m); }; const ok = (m) => console.log('  ok  ' + m);

const page = read('public/finance.html'), cap = read('public/app/cap-finance.js'), man = JSON.parse(read('public/app/manifest.json'));

['/app/avatar.js', '/app/core.js', '/app/accounts-shell.js', '/app/list-ctl.js', '/app/cap-books.js', '/app/rail-thread.js', '/app/signin-ui.js', '/app/cap-finance.js', '/app/kural.js'].forEach((s) => { if (page.indexOf('src="' + s + '"') < 0) bad('finance.html does not load ' + s); });
['CBAvatar.mount', 'CBKural.mount', 'CBSignin.mount', 'data-testid="fin-home"', 'CBBell.mount'].forEach((s) => { if (page.indexOf(s) < 0) bad('finance.html lacks the frame piece ' + s); });
if (!fail) ok('one frame: avatar · Home · bell · kural band · the one sign-in');

const door = man.entries.filter((e) => e.id === 'finance')[0];
if (!door || door.route !== '/finance.html' || door.state !== 'built') bad('the Finance door must open /finance.html as built'); else ok('Home door → /finance.html');

const noCom = cap.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const calls = [...noCom.matchAll(/\bapi\('(\w+)'/g)].map((m) => m[1]);
if (calls.length !== 1 || calls[0] !== 'booksDues') bad('the only call must be booksDues, found ' + JSON.stringify(calls)); else ok('one call: booksDues');
if (!/finance:\s*'1'/.test(cap)) bad('booksDues must be asked with finance=1');
if (!/payOpen\(\\'customer\\'/.test(cap)) bad('Receive must open payOpen (the one payment path)');
if (!/bkRemind\(/.test(cap)) bad('Remind must be bkRemind (M28)');
else ok('Receive = payOpen · Remind = bkRemind');

/* no arithmetic on the server's figures: a sum for a group head is the list's own "fig" (bkOwes of the rows), the rest is painted as given */
const stripped = cap.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
if (/_minor\s*[*\/]/.test(stripped) || /[*\/]\s*\w+\.\w*_minor/.test(stripped)) bad('cap-finance.js must not compute with *_minor'); else ok('no money computed here');
if (/e(rr)?\.message|error\.message/.test(stripped)) bad('a server message must not be painted raw'); else ok('no raw server message');
if (!/fin-denied/.test(cap) || !/Only the owner may see collections\./.test(cap) || !/status === 403/.test(cap)) bad('the owner-only refusal must be drawn as its sentence'); else ok('owner-only: the sentence, greyed');
if (/\bconfirm\(|\balert\(/.test(cap)) bad('no browser confirm/alert');
if (/#[0-9a-fA-F]{3,6}\b/.test(stripped)) bad('no raw colours');

/* ── F2 · Terms (cap-finance-terms.js + the CRM record's read-only block): static, no browser ── */
const ft = read('public/app/cap-finance-terms.js'), crmRec = read('public/app/cap-crm-record.js'), crmJs = read('public/app/cap-crm.js');
const ftc = ft.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
if (page.indexOf('/app/cap-finance-terms.js') < 0 || page.indexOf('data-testid="fin-nav-terms"') < 0 || page.indexOf('href="#/terms"') < 0) bad('finance.html must load cap-finance-terms.js and carry the Terms nav'); else ok('Terms tab: script + nav');
const ftCalls = [...ftc.matchAll(/\bapi\('(\w+)'/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i).sort().join();
if (ftCalls !== 'booksTerms,booksTermsSet,crmParties') bad('the Terms tab calls booksTerms · booksTermsSet · crmParties, found ' + ftCalls); else ok('Terms calls: booksTerms · booksTermsSet · crmParties');
if (!/CBAction\.run\(btn/.test(ftc) || (ftc.match(/CBAction\.run\(/g) || []).length < 2) bad('both Saves (shop, party) go through CBAction.run (M64)'); else ok('Saves are M64 actions');
if (!/bkMoneyInput\(/.test(ftc) || !/bkMoneyRead\(/.test(ftc)) bad('the limit is the M36 money unit (bkMoneyInput / bkMoneyRead)'); else ok('the limit is the money unit');
if (/_minor\s*[*\/+\-]|[*\/]\s*\w+\.\w*_minor|\*\s*100\b/.test(ftc)) bad('the Terms tab must not compute money'); else ok('Terms: no money computed');
if (/e(rr)?\.message|error\.message/.test(ftc) || /\bconfirm\(|\balert\(/.test(ftc) || /#[0-9a-fA-F]{3,6}\b/.test(ftc)) bad('Terms: no raw server message, no browser dialog, no raw colour'); else ok('Terms: no raw message / dialog / colour');
if (!/Terms arrive after the next update\./.test(ftc) || !/may_set/.test(ftc) || !/why_not/.test(ftc)) bad('Terms: the not-yet-migrated sentence and the server\'s may/why must be shown'); else ok('Terms: unmigrated and not-allowed said in words, greyed');
if (/coming/.test(crmRec.replace(/\/\*[\s\S]*?\*\//g, '')) && /CB Finance[^'"]*coming/.test(crmRec)) bad('the CRM record still says CB Finance is coming'); else ok('CRM record: the "coming" text is gone');
if (!/booksTerms/.test(crmRec) || !/booksTerms/.test(crmJs) || !/crm-terms/.test(crmRec)) bad('the CRM record must read booksTerms (read-only) and show the changes'); else ok('CRM record reads terms, read-only');
if (/booksTermsSet/.test(crmRec)) bad('the CRM record must not SET terms — Finance is the one place'); else ok('CRM record never sets terms');

console.log(fail ? fail + ' FAILED' : 'finance-guard: all ok');
process.exit(fail ? 1 : 0);
