/**
 * e2e/prose-worklist.cjs — the L3 reassembly worklist: which SENTENCES are broken into fragments, and where.
 *
 * `strings-extract.cjs` reports 154 prose + 964 fragments and stops there, correctly: it refuses to wrap a
 * fragment, because "A chit is a" translated alone comes back as confident nonsense.
 *
 * ⚠️⚠️ BUT A COUNT IS NOT A WORKLIST. 964 fragments reads as 964 jobs; it is not. Fragments are only ever
 * fragments OF something, and the something is a single line of HTML — `The <b>quantity</b> is fixed.` is one
 * sentence that the scanner sees as two or three strings. **Grouped by their line, the real job is the number
 * of SENTENCES, which is far smaller and is the unit a person actually rewrites.**
 *
 * ⭐ AND THE FIX PER SENTENCE IS ALREADY DEFINED: `txf(english, vars)` — one string with `{placeholders}`, so a
 * translator receives the whole sentence and may reorder it freely, which is the entire point in languages
 * where the verb does not sit where English puts it.
 *
 *     before   'The <b>quantity</b> is fixed.'                       ← 2 fragments, untranslatable
 *     after    txf('The {q} is fixed.', { q: '<b>' + qty + '</b>' }) ← 1 sentence, reorderable
 *
 * ⚠️ MAILBOX FIRST, exactly as with the trim. The Legend, readiness, network and help exist to explain; their
 * prose is the product working. This ranks the screens people use daily and leaves the manual until last.
 *
 * Read-only. It writes nothing and decides nothing — reassembly is editorial work on the source.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const MANUAL = ['cap-legend.js', 'cap-readiness.js', 'cap-network.js', 'cap-help.js', 'cap-assist.js'];

const FILES = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!/node_modules|illustrations|docs|vendor|_design/.test(f.name)) walk(p); }
    else if (/\.(html|js)$/.test(f.name) && !/\.min\./.test(f.name)) FILES.push(p);
  }
})(ROOT);

/** A line that renders more than one run of words between tags is a sentence cut by markup. */
const lines = [];
for (const f of FILES) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
    const runs = [];
    const RE = />([^<>{}`'"]{2,200})</g;
    let m;
    while ((m = RE.exec(line))) {
      const t = m[1].trim();
      if (!/[A-Za-z]{2}/.test(t)) continue;
      runs.push(t);
    }
    if (runs.length < 2) return;                      /* one run = already a whole string */
    /* ⚠️ AND IT MUST LOOK LIKE PROSE, not a row of buttons. A sentence has terminal punctuation somewhere in
       it, or a run that is clearly mid-sentence (starts lowercase). Three <button> labels on one line are
       three labels, not a broken sentence — counting those would inflate the job with work that does not
       exist. */
    const joined = runs.join(' ');
    const looksProse = /[.!?]/.test(joined) || runs.some((r) => /^[a-z]/.test(r));
    if (!looksProse) return;
    lines.push({ rel, n: i + 1, runs, words: joined.split(/\s+/).length });
  });
}

/**
 * ⚠️ THE DEMO PAGES ARE NOT THE PRODUCT. `design-mock`, `iot-howitworks`, `know-your-business`, `cart-design`
 * and friends are standalone showcase HTML — pitch surfaces, opened deliberately, never part of anyone's
 * working day. Counting their 40-odd sentences as translation debt inflates the job by a sixth with work
 * that would never be worth doing: nobody needs the IoT explainer in Tamil before the chit list.
 */
const DEMO = /^(?!app\.html$)(?!app\/).*\.html$/;
const isDemo = (rel) => DEMO.test(rel);
const isManual = (rel) => MANUAL.some((m) => rel.indexOf(m) >= 0);
const demo = lines.filter((l) => isDemo(l.rel));
const mailbox = lines.filter((l) => !isDemo(l.rel) && !isManual(l.rel));
const manual = lines.filter((l) => !isDemo(l.rel) && isManual(l.rel));
const frags = (arr) => arr.reduce((a, l) => a + l.runs.length, 0);

console.log('\n  THE REASSEMBLY JOB, AS SENTENCES RATHER THAN FRAGMENTS\n  ' + '-'.repeat(64));
console.log('  MAILBOX   ' + String(mailbox.length).padStart(4) + ' sentences   ' + String(frags(mailbox)).padStart(4)
  + ' fragments   ' + String(mailbox.reduce((a, l) => a + l.words, 0)).padStart(5) + ' words');
console.log('  MANUAL    ' + String(manual.length).padStart(4) + ' sentences   ' + String(frags(manual)).padStart(4)
  + ' fragments   ' + String(manual.reduce((a, l) => a + l.words, 0)).padStart(5) + ' words');
console.log('  DEMO      ' + String(demo.length).padStart(4) + ' sentences   ' + String(frags(demo)).padStart(4) + ' fragments   ' + String(demo.reduce((a, l) => a + l.words, 0)).padStart(5) + ' words   ← showcase pages, not the product');
console.log('  ' + '-'.repeat(64));
console.log('  TOTAL     ' + String(lines.length).padStart(4) + ' sentences   ' + String(frags(lines)).padStart(4) + ' fragments\n');

const byFile = {};
mailbox.forEach((l) => { byFile[l.rel] = (byFile[l.rel] || 0) + 1; });
console.log('  WHERE THE MAILBOX SENTENCES ARE\n');
Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([f, n]) => console.log('   ' + String(n).padStart(4) + '  ' + f));

console.log('\n  WORST FIRST — most fragments in one sentence\n');
mailbox.slice().sort((a, b) => b.runs.length - a.runs.length).slice(0, 12).forEach((l) => {
  console.log('   ' + (l.rel + ':' + l.n).padEnd(26) + l.runs.length + ' parts   ' + l.runs.join(' ¦ ').slice(0, 84));
});
console.log('');
