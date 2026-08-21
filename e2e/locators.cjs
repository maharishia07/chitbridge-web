/**
 * e2e/locators.cjs — every testid a spec reaches for must exist in the app, and be reachable unambiguously.
 *
 * ⚠️⚠️ THE FAILURE THIS CATCHES DOES NOT LOOK LIKE A LOCATOR BUG. A spec targeting a testid that no longer
 * exists reports a TIMEOUT — "waiting for getByTestId('x')" — which reads as the app being slow or the feature
 * being broken. CHIT-01 spent days looking like a compose failure because a copied walk waited for
 * `chit-add-self` on a wizard step that no longer showed it. CAT-01 spent days looking like a save-and-repaint
 * failure when saveProduct → loadCatalogue → paintProdDetail had been proven healthy end to end.
 *
 * ⭐ THE POINT IS THAT THIS RUNS WITHOUT A BROWSER. The Playwright suite needs a live app, an API and a working
 * OTP; this needs the two source trees. So the question "is the spec pointing at something real" gets answered
 * in a second, before anyone spends an afternoon on a timeout.
 *
 * ⚠️ IT CANNOT PROVE THE OPPOSITE. A testid that exists in the source may still not be RENDERED at the moment
 * the spec looks — behind a mode, a role, a capability. This guard says "the app has never heard of this name",
 * which is the cheap half of the question, and says nothing about the expensive half.
 */
const fs = require('fs');
const path = require('path');

const W = path.join(__dirname, '..', 'public');
const T = path.join(__dirname, 'tests');

/* ── what the app can emit ──────────────────────────────────────────────────────────────────────────────── */
/* ⚠️ EVERY page, not just the app shell. shop.html is its own document — the storefront specs target it, and a
   scan of app.html alone reported every shop-* locator as missing. */
const appFiles = [
  ...fs.readdirSync(W).filter((f) => f.endsWith('.html')),
  ...fs.readdirSync(path.join(W, 'app')).filter((f) => f.endsWith('.js')).map((f) => 'app/' + f),
];
const literal = new Set();
const prefixes = [];      /* testids built from a template: data-testid="cat-product-${id}" */

for (const rel of appFiles) {
  const src = fs.readFileSync(path.join(W, rel), 'utf8');
  /* double-quoted attribute, single-quoted attribute, and the string-concat form */
  const pats = [/data-testid="([^"]*)"/g, /data-testid='([^']*)'/g, /data-testid=\\"([^\\]*)\\"/g];
  for (const re of pats) {
    let m;
    while ((m = re.exec(src))) {
      const v = m[1];
      /* ⚠️ A TEMPLATE HOLE MAKES IT A PREFIX, NOT A NAME. 'cat-field-${k}' can be cat-field-price or
         cat-field-name; recording the raw string would make every real use look unknown. */
      const hole = v.search(/\$\{|'\s*\+|\+\s*'/);
      if (hole >= 0) { const p = v.slice(0, hole); if (p) prefixes.push(p); }
      else literal.add(v);
    }
  }
  /* the concatenated form: 'data-testid="cat-pick-' + id + '"' */
  let m2; const re2 = /data-testid="([a-z0-9-]*-)'\s*\+/g;
  while ((m2 = re2.exec(src))) prefixes.push(m2[1]);
}

/* ── what the specs ask for ─────────────────────────────────────────────────────────────────────────────── */
const specFiles = fs.readdirSync(T).filter((f) => /\.(spec|setup)\.js$/.test(f));
const asked = [];
for (const f of specFiles) {
  const src = fs.readFileSync(path.join(T, f), 'utf8');
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    /* getByTestId('x') and [data-testid="x"] — only the fully literal ones can be checked */
    const pats = [/getByTestId\(\s*'([^'${]+)'\s*\)/g, /getByTestId\(\s*"([^"${]+)"\s*\)/g, /\[data-testid="([^"${]+)"\]/g];
    for (const re of pats) { let m; while ((m = re.exec(line))) asked.push({ f, line: i + 1, id: m[1] }); }
  });
}

/* fixtures walk the DOM too, and their locators break the same way */
for (const f of ['fixtures.js']) {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const pats = [/getByTestId\(\s*'([^'${]+)'\s*\)/g, /getByTestId\(\s*"([^"${]+)"\s*\)/g];
    for (const re of pats) { let m; while ((m = re.exec(line))) asked.push({ f, line: i + 1, id: m[1] }); }
  });
}

/**
 * ⚠️⚠️ A THIRD SOURCE, AND WITHOUT IT THIS GUARD IS MOSTLY FALSE POSITIVES. My first version scanned only
 * `data-testid=` attributes and reported 41 broken locators — of which the great majority were fine: this
 * codebase PASSES testids into builders. `sel('loc-nu', …)`, `pill('ap-fs-' + key, …)`, `ctField('price', …)`
 * all end in one helper that writes the attribute, so the name never appears beside `data-testid` anywhere.
 *
 * ⭐ Exactly the lesson locale-map.cjs taught an hour earlier: a guard whose scope is an assumption about WHERE
 * code lives breaks precisely where the code is well factored. Scanning for the name as a bare string literal
 * anywhere in the app has no such assumption.
 *
 * ⚠️ IT IS DELIBERATELY LOOSE, and the looseness is the right trade. The question this guard answers is "has
 * the app ever heard of this name" — a name found nowhere in either tree is unambiguously broken, and that is
 * the case worth failing a build over. Narrowing it further would reintroduce the false positives that make a
 * guard get ignored, which costs more than the cases it would newly catch.
 */
const appText = appFiles.map((rel) => fs.readFileSync(path.join(W, rel), 'utf8')).join('\n');
const asString = new Set();
/* ⚠️ UNDERSCORES COUNT TOO, and leaving them out cost two more false positives. The co-assist wizard builds
   `data-testid="'+id+'"` — a FULLY dynamic testid, where the literal part is empty and no prefix exists to
   record. The only trace of `aw_name` in the app is the quoted string handed to that builder. A kebab-only
   pattern declared two live locators broken. */
for (const re of [/'([a-z][a-z0-9]*(?:[-_][a-z0-9]+)+)'/g, /"([a-z][a-z0-9]*(?:[-_][a-z0-9]+)+)"/g]) {
  let m; while ((m = re.exec(appText))) asString.add(m[1]);
}
/* ⚠️ AND THE CONCATENATED PREFIX FORM — pill('ap-fs-' + x[0], …), 'theme-' + k. The literal ends in a hyphen
   and the variable supplies the rest, so the whole name exists in no single place. */
for (const re of [/'([a-z][a-z0-9-]*-)'\s*\+/g, /"([a-z][a-z0-9-]*-)"\s*\+/g]) {
  let m; while ((m = re.exec(appText))) prefixes.push(m[1]);
}

const known = (id) => literal.has(id) || asString.has(id) || prefixes.some((p) => id.indexOf(p) === 0);

const seen = new Set();
const missing = [];
for (const a of asked) {
  const key = a.f + ':' + a.id;
  if (seen.has(key)) continue;
  seen.add(key);
  if (!known(a.id)) missing.push(a);
}

const uniq = new Set(asked.map((a) => a.id));
console.log('\n  ' + uniq.size + ' distinct testids targeted by ' + specFiles.length + ' spec file(s)'
  + '  ·  ' + literal.size + ' literal + ' + new Set(prefixes).size + ' templated emitted by the app\n');

let fail = 0;
if (missing.length) {
  fail++;
  console.error('  ✗ ' + missing.length + ' locator(s) the app never emits — these fail as TIMEOUTS, not as errors:\n');
  missing.forEach((m) => console.error('      ' + (m.f + ':' + m.line).padEnd(34) + m.id));
  console.error('\n    Either the testid was renamed in the app, or the spec is walking a screen that changed.');
}

console.log('  ══ ' + (fail ? 'BROKEN LOCATORS' : 'every literal locator exists in the app') + ' ══\n');
process.exit(fail ? 1 : 0);
