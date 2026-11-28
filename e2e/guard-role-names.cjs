'use strict';
// @type: static
/**
 * e2e/guard-role-names.cjs — UX-224: a screen never spells an outside role or the "your seat cannot" refusal its own way (the ONE map is public/app/role-names.js).
 *
 * Reads every customer page script (no browser) and fails on a quoted string that carries a retired spelling: the adviser firm called "adviser firm" or "Your firm",
 * a staff login called "Co-assist · sees costs", the auditor form headed "network parent read your books", and the old refusal wordings.
 * The allow-list holds files still to move (it only shrinks; a file that no longer needs it fails until it leaves the list).
 * The guard proves itself: it plants each spelling in a copy and must fail on all of them, every run.
 *
 * Run: node e2e/guard-role-names.cjs        exit 1 on a finding
 */
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'public', 'app');
const OWNER_FILE = 'role-names.js';
/** files still to move onto CBRoles: books-grant-member.js (the drift lane owns it) says "Accountant: acts for you" and "network parent" itself */
const ALLOW = new Set(['books-grant-member.js']);
const BAD = [
  [/\badviser firm\b/i, 'the outside accountant called "adviser firm": say Accountant'],
  [/Your firm\b(?! holds| has| is not| is no|'s)/, 'the outside accountant called "Your firm": the firm\'s name, or CBRoles.firm'],
  [/Accountant: acts for you|Auditor: reads only/, 'a role line spelled by the screen: CBRoles.line'],
  [/Co-assist ·/, 'a staff login called Co-assist: say Staff'],
  [/network parent read your books/i, 'the auditor form headed by the builder word "network parent"'],
  [/This sign-in cannot open/, 'a second refusal: CBRoles.refusal'],
  [/Only the owner may do this/, 'a second refusal: CBRoles.refusal'],
  [/Your access does not include cost/, 'a refusal that names the wrong reason: CBRoles.refusal'],
  [/may read these figures/, 'a second refusal: CBRoles.refusal'],
  [/grants .Sees costs. in Employees/, 'a pointer to a control Employees does not have']
];
function scan(src) {
  const out = [];
  src.split(/\r?\n/).forEach((ln, i) => {
    if (/^\s*(\/\/|\*|\/\*|<!--)/.test(ln)) return;
    const quoted = ln.match(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g) || [];
    for (const piece of quoted) for (const [re, why] of BAD) if (re.test(piece)) out.push({ line: i + 1, why, text: piece.slice(0, 80) });
  });
  return out;
}
function run() {
  const bad = [], used = new Set();
  for (const f of fs.readdirSync(APP).filter((n) => /\.js$/.test(n) && !/^strings-/.test(n) && !/^(screens|cap-legend|cap-standards)\.js$/.test(n) && n !== OWNER_FILE)) {
    const found = scan(fs.readFileSync(path.join(APP, f), 'utf8'));
    if (found.length && ALLOW.has(f)) used.add(f);
    else if (found.length) found.forEach((x) => bad.push(f + ':' + x.line + ' ' + x.why + '  ' + x.text));
  }
  for (const f of ALLOW) if (!used.has(f)) bad.push(f + ' is on the allow-list but is clean: take it off');
  return bad;
}
// the guard proves itself
const plants = ["x = 'Open to an adviser firm';", "n = 'Your firm';", "m = 'Co-assist · sees costs';", "h = 'Let your network parent read your books';", "w = 'This sign-in cannot open this';", "w = 'Only the owner may do this.';", "r = 'Accountant: acts for you';", "w = 'Your access does not include costs, so x';", "w = 'The owner grants “Sees costs” in Employees.'; /* grants 'Sees costs' in Employees */ q = \"grants 'Sees costs' in Employees\";"];
const missed = plants.filter((p) => !scan(p).length);
if (missed.length) { console.error('guard-role-names: self-test missed', missed); process.exit(1); }
if (scan("n = 'Your firm holds two kinds of access';").length) { console.error('guard-role-names: self-test false positive'); process.exit(1); }
const bad = run();
if (bad.length) { console.error('guard-role-names: ' + bad.length + ' finding(s)\n' + bad.join('\n')); process.exit(1); }
console.log('guard-role-names: ok (' + ALLOW.size + ' file on the allow-list)');
