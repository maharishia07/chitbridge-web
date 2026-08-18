/**
 * l3-verify.cjs — prove an L3 rewrite changed NOTHING that a reader sees.
 *
 * ⚠️⚠️ THIS IS THE GATE THE WHOLE PROSE PASS DEPENDS ON. Reshaping
 *
 *     'Remove ' + n + ' from your supplier list?'
 *   → txf('Remove {name} from your supplier list?', { name: n })
 *
 * must produce a byte-identical English string. If it does not, the rewrite is wrong — not the copy. And the
 * failure mode is nasty: a dropped space, a lost `<b>`, a placeholder that never substitutes. Each is invisible
 * in a diff of a 9,000-line file and obvious to a user.
 *
 * So this evaluates the BEFORE and AFTER expressions with the same inputs and compares the output. English is
 * untranslated, so `tx` is identity and the two must match exactly.
 *
 * ⚠️ IT CANNOT BE A UNIT TEST OF txf ALONE. txf is already tested; what needs proving is that THIS rewrite of
 * THIS sentence is faithful. So the checker takes the actual before/after pair from a proposal file.
 *
 * Usage:
 *   node e2e/l3-verify.cjs e2e/l3-proposals/cap-folders.md
 *   node e2e/l3-verify.cjs --all
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* The real primitives, lifted from app.html so this tests what ships rather than a copy. */
const APP = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.html'), 'utf8');
global.CBSTR = { en: {} };
global.cbLang = () => 'en';
global.CBLocale = {
  locale: () => 'en-IN',
  number: (n) => new Intl.NumberFormat('en-IN').format(n),
};
/* ⚠️ Built with `new Function`, not `eval` in a block — a function declared by eval inside `{}` is scoped to
   that block and vanishes, which is exactly how the first version of this file failed. */
const { tx, txf, txn } = (function () {
  const ti = APP.indexOf('function tx(english, context){');
  const src = APP.slice(ti, APP.indexOf('\n}', ti) + 2)
    + APP.slice(APP.indexOf('function txf(english, vars){'), APP.indexOf('\nfunction menuBtn', APP.indexOf('function txf(english, vars){')));
  // eslint-disable-next-line no-new-func
  return new Function('CBSTR', 'cbLang', 'CBLocale', src + '; return { tx: tx, txf: txf, txn: txn };')(
    global.CBSTR, global.cbLang, global.CBLocale);
})();
global.tx = tx; global.txf = txf; global.txn = txn;

/** Stand-ins for whatever the surrounding code supplies. Deliberately WEIRD, so a dropped one is obvious. */
const esc = (v) => String(v == null ? '' : v).replace(/[<>"&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c]));
global.esc = esc;

function parse(md) {
  const out = [];
  const blocks = md.split(/^### /m).slice(1);
  blocks.forEach((b) => {
    const site = b.split('\n')[0].trim();
    const before = /^BEFORE\s+(.+)$/m.exec(b);
    const after = /^AFTER\s+(.+)$/m.exec(b);
    if (!before || !after) return;                       // SKIP / NEEDS-HUMAN entries have no pair
    if (/^\s*(SKIP|NEEDS-HUMAN)/i.test(after[1])) return;
    out.push({ site, before: before[1].trim(), after: after[1].trim() });
  });
  return out;
}

/** Every bare identifier the expression needs, so we can feed both sides the same values. */
function freeNames(expr) {
  const names = new Set();
  /* ⚠️ STRIP THE STRING LITERALS FIRST. Scanning the raw expression treats the ENGLISH COPY as code, so
     "Asked for, not agreed" yielded a variable called `for` and the generated function refused to parse.
     Blanked in place so offsets stay usable. */
  expr = expr.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, (m) => ' '.repeat(m.length));
  const re = /\b([A-Za-z_$][\w$]*)\s*(?![\w$]*\s*:)/g;
  let m;
  const KNOWN = new Set(['txf', 'txn', 'tx', 'esc', 'true', 'false', 'null', 'undefined', 'String', 'Number', 'Math', 'JSON']);
  while ((m = re.exec(expr))) {
    const n = m[1];
    if (KNOWN.has(n)) continue;
    /* skip object KEYS inside a { … } literal — `{ name: x }` needs x, not name */
    const after = expr.slice(m.index + n.length).match(/^\s*:/);
    if (after) continue;
    /* skip property access — `r.match_count` needs r, not match_count */
    const before = expr.slice(0, m.index).match(/\.\s*$/);
    if (before) continue;
    names.add(n);
  }
  return [...names];
}

let checked = 0, ok = 0, bad = 0, skipped = 0;
const failures = [];

function verify(file) {
  const md = fs.readFileSync(file, 'utf8');
  parse(md).forEach((p) => {
    checked++;
    /* Feed both sides identical values. Objects answer any property with a marker so a lost `.name` shows. */
    const names = [...new Set(freeNames(p.before).concat(freeNames(p.after)))];
    const scope = {};
    names.forEach((n, i) => {
      scope[n] = new Proxy(function () {}, {
        get: (t, k) => (k === Symbol.toPrimitive || k === 'toString' || k === 'valueOf')
          ? () => '«' + n + '»'
          : '«' + n + '.' + String(k) + '»',
        apply: () => '«' + n + '()»',
      });
    });
    /* A count has to be a real number for txn to pick a category. */
    names.forEach((n) => { if (/count|len|n$|num|days|rows|ids/i.test(n)) scope[n] = 3; });

    const run = (expr) => {
      try {
        // eslint-disable-next-line no-new-func
        return String(new Function(...names, 'txf', 'txn', 'tx', 'esc', 'return (' + expr + ')')
          .apply(null, names.map((n) => scope[n]).concat([txf, txn, tx, esc])));
      } catch (e) { return 'ERROR: ' + e.message; }
    };

    const a = run(p.before), b = run(p.after);
    if (a.startsWith('ERROR') || b.startsWith('ERROR')) {
      skipped++;
      failures.push({ site: p.site, kind: 'could not evaluate', a, b, note: 'needs real context — verify by hand' });
      return;
    }
    if (a === b) { ok++; return; }
    bad++;
    failures.push({ site: p.site, kind: 'OUTPUT CHANGED', a, b });
  });
}

const args = process.argv.slice(2);
const dir = path.join(__dirname, 'l3-proposals');
const files = args.includes('--all')
  ? (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f)) : [])
  : args.filter((a) => !a.startsWith('--'));

if (!files.length) { console.log('\n  no proposal files found — run the agents first, or pass a path\n'); process.exit(0); }
files.forEach(verify);

console.log('\n══ L3 REWRITE VERIFICATION ══');
console.log('  ' + checked + ' pairs · ' + ok + ' identical · ' + bad + ' CHANGED · ' + skipped + ' need a human\n');
failures.forEach((f) => {
  console.log('  ' + (f.kind === 'OUTPUT CHANGED' ? '✗' : '·') + ' ' + f.site + '   ' + f.kind);
  console.log('      before  ' + f.a.slice(0, 150));
  console.log('      after   ' + f.b.slice(0, 150));
  if (f.note) console.log('      ' + f.note);
});
if (!failures.length) console.log('  ✓ every rewrite renders exactly what it replaced\n');
else console.log('');
process.exit(bad ? 1 : 0);
