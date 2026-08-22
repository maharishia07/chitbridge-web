/**
 * e2e/legend-complete.cjs — every mark a row can show must be explained in the key.
 *
 * Athi, 2026-08-22: *"in the flag, we added resolved when dispute resolved. Can you check in code if we have
 * any other flag created and it has to be added in the legend."*
 *
 * ⚠️⚠️ THREE OF FIVE WERE MISSING BY THE TIME HE ASKED. `⚑ resolved`, `⚑ flagged` and the `?` beside an
 * unverified sender all rendered on rows and appeared nowhere in the key.
 *
 * ⭐ AN INCOMPLETE KEY IS WORSE THAN NO KEY, because it is read as complete. A reader who finds four of five
 * marks explained concludes the fifth is decorative — not that the key is out of date.
 *
 * ⚠️ AND THE GAP GROWS BY EXACTLY ONE EVERY TIME SOMEONE ADDS A CHIP, because nothing connected the two
 * places. That is what this file is: the connection. It reads the flags out of the ROW renderers and requires
 * each to appear in `listLegend()`.
 *
 * ⚠️ IT CANNOT CHECK THAT THE EXPLANATION IS GOOD — only that one exists. A box reading "⚑ resolved: resolved"
 * passes here and helps nobody. This catches the failure that actually happened (a flag with no entry at all),
 * not the one nobody has made yet.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.html'), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? '   ' + extra : '')); }
  else { fail++; console.error('  ✗ ' + name + (extra ? '   ' + extra : '')); }
};

/* ── the key itself ──────────────────────────────────────────────────────────────────────────────────── */
const li = src.indexOf('function listLegend()');
t('the legend is where it was', li > 0);
const legend = src.slice(li, li + 4000);

/**
 * ⚠️ EXCLUDE THE LEGEND FROM THE SEARCH FOR FLAGS, or it satisfies itself: the key renders every chip it
 * explains, so scanning the whole file would find each flag "in the row code" and each one "in the legend"
 * and report a clean sweep however many rows had gone undocumented.
 */
const rows = src.slice(0, li) + src.slice(li + 4000);

/* ── every rflag variant a ROW can render ────────────────────────────────────────────────────────────── */
const variants = new Set();
for (const m of rows.matchAll(/class="rflag ([a-z0-9]+)"/g)) variants.add(m[1]);
/* the builder picks its class from a variable — read the literals it chooses between */
const attn = rows.slice(rows.indexOf('function attnFlag('), rows.indexOf('function attnFlag(') + 700);
for (const m of attn.matchAll(/'([a-z]{3,4})'\s*:/g)) { /* cls=urgent?'urg':(high?'high':'cust') */ }
for (const m of attn.matchAll(/\?\s*'([a-z]{3,5})'|:\s*'([a-z]{3,5})'/g)) {
  const v = m[1] || m[2];
  if (['urg', 'high', 'cust', 'disp', 'ok'].includes(v)) variants.add(v);
}

console.log('\n── every flag a row can show is in the key ──');
t('the row code still renders flags', variants.size >= 4, [...variants].sort().join(' '));

/**
 * ⚠️ MATCHED ON THE CLASS, NOT THE LABEL. Labels are wrapped in tx() and will change with translation; the
 * class is the thing both sides actually share, and it is what a new chip is defined by.
 */
for (const v of [...variants].sort()) {
  t('  …' + ('rflag ' + v).padEnd(12) + ' is explained', legend.includes('rflag ' + v));
}

/**
 * ⚠️ A CHIP WITH INLINE COLOURS IS INVISIBLE TO A CLASS-BASED SCAN. `⚑ resolved` shipped as
 * `class="rflag disp"` with three inline overrides fighting it — so it read as the DISPUTE flag to any
 * checker, and to the cascade. Its own class is what makes it findable, here and by the next person.
 */
console.log('\n── no chip hides behind inline colour ──');
const inlineChips = [...rows.matchAll(/class="rflag[^"]*"\s+style="[^"]*(background|color)[^"]*"/g)];
t('every flag takes its colour from a class', inlineChips.length === 0,
  inlineChips.length ? inlineChips[0][0].slice(0, 80) : '');

/* ── the marks that are not rflags ───────────────────────────────────────────────────────────────────── */
console.log('\n── and the marks that are not flags ──');
/**
 * ⭐ `unver` ANSWERS A DIFFERENT QUESTION — "who is this", not "how urgent is this" — and it is the only row
 * mark reporting something we could NOT confirm. A `?` a reader cannot decode reads as a rendering glitch.
 */
t('the unread dot is explained', legend.includes('class="udot"'));
t('the unverified-sender mark is explained',
  !/class="unver"/.test(rows) || legend.includes('class="unver"'));

console.log('\n  ══ ' + pass + ' passed · ' + fail + ' failed ══\n');
process.exit(fail ? 1 : 0);
