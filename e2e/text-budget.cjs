/**
 * text-budget.cjs — how much of this product is a LABEL, and how much is an EXPLANATION?
 *
 * Athi, 2026-08-19: *"this product is not supposed to have a lot of text inside. It should be simple like a
 * mailbox, no explanation whatsoever… without giving explanation how should people be able to understand how to
 * operate. That is where the challenge is going to be."*
 *
 * ⭐⭐ THE TRANSLATION BACKLOG IS MOSTLY AN EXPLANATION BACKLOG. Every sentence of explanation is a sentence that
 * has to be wrapped, translated into every language, reviewed by a native speaker, and kept in step forever. A
 * sentence deleted costs nothing in any language. So the cheapest way to finish localisation is to find the copy
 * that should not exist, and the second cheapest is to translate what is left.
 *
 * ⚠️ THIS COUNTS, IT DOES NOT DELETE. Which explanations earn their place is a product judgement and Athi's call
 * — a mailbox has no manual, but it does have an empty state. The tool's job is to make the size of the problem
 * visible, not to decide it.
 */
const fs = require('fs');
const path = require('path');

/**
 * ⚠️⚠️ THE CATALOGUE IS THE WRONG INPUT AND THE FIRST RUN OF THIS TOOL PROVED IT. strings.catalogue.json holds
 * only the LABEL bucket — 468 entries — because strings-extract deliberately sets prose and fragments aside as
 * "needs reassembling first". Measuring explanations against it reported 4%, which is not a small number, it is
 * a wrong one: it excluded the very bucket the explanations live in.
 *
 * So this reads the SOURCE. Every run of text between tags, in every HTML string, whatever bucket it would fall
 * into. That is what a reader actually sees.
 */
const ROOT = path.join(__dirname, '..', 'public');
const FILES = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!/node_modules|illustrations|docs|vendor|_design/.test(f.name)) walk(p); }
    else if (/^(app\.html|cap-.*\.js|shop\.html|store\.html)$/.test(f.name) || /\/app\//.test(p.replace(/\\/g, '/'))) {
      if (/\.(html|js)$/.test(f.name) && !/\.min\./.test(f.name)) FILES.push(p);
    }
  }
})(ROOT);

const entries = [];
const seen = new Set();
for (const f of FILES) {
  const relf = path.relative(ROOT, f).replace(/\\/g, '/');
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;              // comments are not the product
    const RE = />([^<>{}`'"]{3,200})</g;
    let m;
    while ((m = RE.exec(line))) {
      const t = m[1].trim();
      if (!/[A-Za-z]/.test(t) || t.length < 3) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      entries.push({ msgid: t, source: relf + ':' + (i + 1) });
    }
  });
}

/**
 * A LABEL names a thing you can act on. An EXPLANATION is a sentence about it.
 *
 * The tell is grammatical, not length: an explanation has a finite verb and terminal punctuation. "Assignment
 * model" is a label; "Grouping is not a separate switch" is a claim about the world.
 */
const VERB = /\b(is|are|was|were|be|been|has|have|had|does|do|did|can|cannot|will|would|should|must|may|might|means|shows|keeps|stays|belongs|lives|counts|follows|changes|converts|translates|picks|needs)\b/i;

function classify(s) {
  const words = s.trim().split(/\s+/).length;
  const sentence = /[.!?](\s|$)/.test(s.trim()) || (VERB.test(s) && words >= 4);
  if (sentence) return 'EXPLANATION';
  if (words <= 4) return 'LABEL';
  return 'LONG LABEL';
}

const bucket = { LABEL: [], 'LONG LABEL': [], EXPLANATION: [] };
for (const e of entries) bucket[classify(e.msgid)].push(e);

const words = (arr) => arr.reduce((a, e) => a + e.msgid.trim().split(/\s+/).length, 0);
const total = entries.length;
const pct = (n) => String(Math.round((n / total) * 100)).padStart(3) + '%';

console.log('\n  WHAT THE ON-SCREEN TEXT ACTUALLY IS\n  ' + '-'.repeat(62));
for (const k of ['LABEL', 'LONG LABEL', 'EXPLANATION']) {
  console.log('  ' + k.padEnd(13) + String(bucket[k].length).padStart(4) + '  ' + pct(bucket[k].length)
    + '   ' + String(words(bucket[k])).padStart(5) + ' words');
}
console.log('  ' + '-'.repeat(62));
console.log('  TOTAL        ' + String(total).padStart(4) + '   100%   ' + String(words(entries)).padStart(5) + ' words');

/* the worst offenders — longest explanations, which cost the most in every language */
const worst = bucket.EXPLANATION
  .slice()
  .sort((a, b) => b.msgid.length - a.msgid.length)
  .slice(0, 15);
console.log('\n  THE LONGEST EXPLANATIONS — each of these is a sentence per language, forever\n');
worst.forEach((e) => console.log('   ' + e.source.padEnd(30) + e.msgid.slice(0, 88)));

const byFile = {};
for (const e of bucket.EXPLANATION) {
  const f = e.source.split(':')[0];
  byFile[f] = (byFile[f] || 0) + 1;
}
console.log('\n  WHERE THE EXPLANATIONS LIVE\n');
Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([f, n]) => console.log('   ' + String(n).padStart(4) + '  ' + f));
console.log('');
