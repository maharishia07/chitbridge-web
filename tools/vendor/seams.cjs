'use strict';
/**
 * tools/seams.cjs (chitbridge-web; C:/dev/seams.cjs is a one-line shim to this file, DOC-68) — WHAT ALREADY DOES THIS? THE INDEX I SHOULD HAVE READ BEFORE BUILDING.
 *
 * Athi, 2026-08-24, after catching the second reinvention in two days: *"I am tired of explaining each time.
 * I would assume you know what you have built and know to reuse. Does it mean you do not have a catalogue of
 * what the inventories are? Will you not check which API, which screen has what you need already?"*
 *
 * ⚠️⚠️ THERE IS AN INVENTORY AND IT ANSWERS A DIFFERENT QUESTION. `inventory.cjs` classifies 561 files by
 * NATURE — test.guard, capability, shared, ops.tool — which is the right answer to "is this estate
 * manageable" and no answer at all to "does something already open a catalogue picker?". So the picker was
 * assembled four times and the line card twice, and each time the previous one was three greps away.
 *
 * ⭐⭐ A SEAM IS COMPUTABLE, NOT A MATTER OF MEMORY: a function DEFINED in one file and CALLED FROM ANOTHER is,
 * by demonstration, a reuse point. Nobody has to declare it, keep a list current, or remember it exists — the
 * calls are the evidence. That is the whole idea here.
 *
 *     node C:/dev/seams.cjs                 the index, most-reused first
 *     node C:/dev/seams.cjs catalogue       everything whose name or purpose mentions it
 *     node C:/dev/seams.cjs --write         refresh C:/dev/SEAMS.md AND docs/SEAMS.md in web, api, engines
 *     node tools/seams.cjs --check --repo web|api|engines   drift check (DOC-68, CI job seams-drift in all three repos): exit 1 + the stale
 *                                          lines of the docs/SEAMS.md of the checkout you run it in. api and engines run it from a web checkout.
 *
 * ⚠️ It reports what IS reused, and separately what is defined-but-used-once — the second list is where the
 * next duplicate is most likely to be born, because a thing used once looks private and gets rebuilt.
 */
const fs = require('fs');
const path = require('path');

/* Roots default to the main checkouts; SEAMS_ROOT_<WEB|API|ENGINES> point at another checkout (a worktree). */
/* --check --repo <side> reads the checkout it is run in (CI has exactly one) */
const CHECKING = process.argv.includes('--check') ? process.argv[process.argv.indexOf('--repo') + 1] : '';
const REPO = (k) => process.env['SEAMS_ROOT_' + k.toUpperCase()] || (k === CHECKING ? process.cwd() : 'C:/dev/chitbridge-' + k);
const WEB = REPO('web') + '/public';
const API = REPO('api');

/* ── what to read ───────────────────────────────────────────────────────────────────────────────────────── */
function webFiles() {
  const out = [path.join(WEB, 'app.html')];
  for (const f of fs.readdirSync(path.join(WEB, 'app'))) {
    if (f.endsWith('.js')) out.push(path.join(WEB, 'app', f));
  }
  return out;
}
function apiFiles() {
  const out = [];
  for (const dir of ['lib', 'routes', 'middleware']) {
    const d = path.join(API, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.js')) out.push(path.join(d, f));
  }
  return out;
}

/* ── definitions ────────────────────────────────────────────────────────────────────────────────────────── */
const DEF_FN = /^[ \t]*(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(/gm;
const DEF_MOD = /^[ \t]*(?:var|const|let)[ \t]+([A-Z][\w$]*)[ \t]*=[ \t]*\(?[ \t]*(?:function|\(\)[ \t]*=>)/gm;

/**
 * The purpose line: the nearest preceding comment's first real sentence. Falls back to the name, which is
 * honest — a seam with no comment tells you only what it is called.
 */
function purposeAbove(src, at) {
  const before = src.slice(Math.max(0, at - 1600), at).split(/\r?\n/);
  for (let i = before.length - 2; i >= 0 && i > before.length - 30; i--) {
    const raw = before[i];
    if (/^\s*(\}|\)|;)/.test(raw)) break;                       // walked out of the comment into code
    const t = raw.replace(/^\s*(\/\*+|\*+\/?|\/\/)\s?/, '').replace(/\s*\*\/\s*$/, '').trim();
    if (!t || /^[─—=*\-·]{3,}$/.test(t)) continue;              // rule lines
    if (/^[A-Za-z⭐⚠️`]/.test(t) && t.length > 12) {
      return t.replace(/^[⭐⚠️\s]+/, '').replace(/\*\*/g, '').split(/(?<=[.:—])\s/)[0].slice(0, 110);
    }
  }
  return '';
}

function scan(files, label) {
  const defs = new Map();                     // name → { file, purpose }
  const texts = new Map();                    // file → source
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    texts.set(f, src);
    for (const re of [DEF_FN, DEF_MOD]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        if (!defs.has(m[1])) defs.set(m[1], { file: f, purpose: purposeAbove(src, m.index) });
      }
    }
  }
  /* ⚠️ Count files that USE it, not call sites: ten calls inside one screen is not reuse, it is a local
     helper. Two files is the whole signal. */
  const rows = [];
  for (const [name, d] of defs) {
    if (name.length < 4) continue;
    const users = [];
    for (const [f, src] of texts) {
      if (f === d.file) continue;
      const re = new RegExp('(?:^|[^\\w$.])' + name.replace(/\$/g, '\\$') + '\\s*[(.]');
      if (re.test(src)) users.push(path.basename(f));
    }
    rows.push({ name, from: path.basename(d.file), users, purpose: d.purpose, label });
  }
  return rows;
}

/* ── report ─────────────────────────────────────────────────────────────────────────────────────────────── */
const REPO_AT = process.argv.indexOf('--repo');
const CHECK_SIDE = REPO_AT > -1 ? process.argv[REPO_AT + 1] : '';
const arg = process.argv.slice(2).filter((a, i, all) => !['--write', '--check', '--repo'].includes(a) && all[i - 1] !== '--repo');
const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');
/* All the words, not just the first — "node seams.cjs line card" is how a person asks. */
const needle = arg.join(' ').toLowerCase().trim();

/* --check reads ONLY the side of the repo it runs in (CI has one checkout): the rows of web and api are independent, so a change in the
   other repo can never make this one stale. Engines owns no rows, so only its header is judged. */
const all = CHECK
  ? (CHECK_SIDE === 'web' ? scan(webFiles(), 'web') : CHECK_SIDE === 'api' ? scan(apiFiles(), 'api') : [])
  : scan(webFiles(), 'web').concat(scan(apiFiles(), 'api'));
const shared = all.filter((r) => r.users.length >= 1).sort((a, b) => b.users.length - a.users.length);
const once = all.filter((r) => r.users.length === 0);

/* ⚠️ EVERY WORD MUST APPEAR, anywhere in the name, the purpose or the filename. Matching any single
   word made 'line card' return the whole estate; matching the phrase made it return nothing, because the
   thing is called wlPaintCard and lives in cap-worklist. Words, not phrases, is what a person actually types. */
const words = needle ? needle.split(/\s+/).filter(Boolean) : [];
const match = (r) => !words.length || words.every((w) =>
  r.name.toLowerCase().includes(w) || (r.purpose || '').toLowerCase().includes(w) || r.from.toLowerCase().includes(w));

/* file names that exist on BOTH sides: a table row naming one cannot be told apart by the name alone */
function ambiguous() {
  const sides = new Map();
  for (const r of all) sides.set(r.from, (sides.get(r.from) || new Set()).add(r.label));
  return [...sides].filter(([, v]) => v.size > 1).map(([k]) => k).sort();
}

/* the table row as --write prints it (one place, so --check compares exactly what --write would have written) */
const rowText = (r) => '| ' + r.users.length + ' | `' + r.name + '` | `' + r.from + '` | ' + (r.purpose || '').replace(/\|/g, '·') + ' |';
const HEADER = '<!-- GENERATED by C:/dev/seams.cjs --write.';

const lines = [];
const say = (s) => { lines.push(s); if (!CHECK) console.log(s); };

if (CHECK) {
  process.exit(runCheck());
}

if (needle) {
  say('\n══ WHAT ALREADY DOES "' + needle + '" ══\n');
  const hits = shared.filter(match).concat(once.filter(match));
  if (!hits.length) say('  nothing — this may genuinely be new\n');
  for (const r of hits.slice(0, 40)) {
    say('  ' + r.name.padEnd(26) + r.from.padEnd(22)
      + (r.users.length ? 'used by ' + r.users.length + ': ' + r.users.slice(0, 4).join(', ') : 'used only where it is defined'));
    if (r.purpose) say('      ' + r.purpose);
  }
  say('');
} else {
  say('\n══ SHARED SEAMS — defined in one file, called from another ══\n');
  for (const r of shared.slice(0, 60)) {
    say('  ' + String(r.users.length).padStart(3) + '  ' + r.name.padEnd(26) + r.from.padEnd(22)
      + r.users.slice(0, 5).join(', '));
    if (r.purpose) say('       ' + r.purpose);
  }
  say('\n  ' + shared.length + ' seam(s) · ' + once.length + ' defined-and-used-once');
  say('  ⚠️ The second number is where the next duplicate is born: a thing used once looks private.\n');
}

if (WRITE) {
  const md = ['# Seams — what is already reusable',
    '',
    '<!-- GENERATED by C:/dev/seams.cjs --write. A seam is a function DEFINED in one file and CALLED from',
    '     another: the calls are the evidence, so nothing here has to be kept current by hand. -->',
    '<!-- same-name files in web and api (--check cannot tell whose row it is, so it skips them): ' + ambiguous().join(' ') + ' -->',
    '',
    '⭐ **Read this before building anything that sounds like it might exist.** `inventory.cjs` says what kind',
    'of file each thing is; this says what already does the job.',
    '',
    '| used by | name | defined in | what it is for |',
    '|---|---|---|---|'].concat(
    shared.slice(0, 200).map(rowText));
  const text = md.join('\n') + '\n';
  /* Each repo carries the same estate-wide index (CLAUDE.md: cloud sessions read docs/SEAMS.md in their own clone). */
  const targets = ['C:/dev/SEAMS.md'].concat(['web', 'api', 'engines'].map((k) => REPO(k) + '/docs/SEAMS.md'));
  for (const t of targets) {
    if (!fs.existsSync(path.dirname(t))) { console.log('  skipped (no folder): ' + t); continue; }
    fs.writeFileSync(t, text);
    console.log('  → ' + t + ' (' + shared.length + ' seams)');
  }
  console.log('');
}

/**
 * --check: judge docs/SEAMS.md of the repo this runs in (cwd) against the code, for the rows of that repo's own side.
 * Stale = a row whose count or purpose no longer matches, a row whose function is gone or no longer shared, or a seam used more widely than
 * the table's weakest row (it would be in the table). A new seam used less than that is not drift: the next --write picks it up.
 */
function runCheck() {
  const doc = path.join(process.cwd(), 'docs', 'SEAMS.md');
  if (!fs.existsSync(doc)) { console.log('seams --check: missing ' + doc); return 1; }
  const text = fs.readFileSync(doc, 'utf8').split('\r\n').join('\n');
  if (!text.includes(HEADER)) { console.log('seams --check: ' + doc + ' has lost its GENERATED header - regenerate: node C:/dev/seams.cjs --write'); return 1; }
  if (CHECK_SIDE === 'engines') { console.log('seams --check (engines): owns no rows; header ok'); return 0; }
  if (CHECK_SIDE !== 'web' && CHECK_SIDE !== 'api') { console.log('seams --check: pass --repo web|api|engines'); return 1; }
  const docRows = text.split('\n').map((l) => /^\| (\d+) \| `([^`]+)` \| `([^`]+)` \| (.*) \|$/.exec(l)).filter(Boolean)
    .map((m) => ({ users: Number(m[1]), name: m[2], from: m[3], line: m[0] }));
  const skip = new Set(((/same-name files[^:]*: ?(.*) -->/.exec(text) || [])[1] || '').split(' ').filter(Boolean));
  const ownFiles = new Set(all.map((r) => r.from).filter((f) => !skip.has(f)));
  const byKey = new Map(all.map((r) => [r.name + '|' + r.from, r]));
  const stale = [];
  for (const d of docRows) {
    if (!ownFiles.has(d.from)) continue;                          // the other side's row: judged in the other repo
    const r = byKey.get(d.name + '|' + d.from);
    if (!r || !r.users.length) stale.push('- gone or no longer shared: ' + d.line);
    else if (rowText(r) !== d.line) stale.push('- changed: ' + d.line + '\n    now: ' + rowText(r));
  }
  const weakest = Math.min.apply(null, docRows.map((d) => d.users));
  const inDoc = new Set(docRows.map((d) => d.name + '|' + d.from));
  for (const r of shared) if (r.users.length > weakest && !inDoc.has(r.name + '|' + r.from)) stale.push('- missing: ' + rowText(r));
  if (!stale.length) { console.log('seams --check (' + CHECK_SIDE + '): docs/SEAMS.md matches the code'); return 0; }
  console.log('seams --check (' + CHECK_SIDE + '): ' + stale.length + ' stale line(s) in ' + doc + ' - run: node C:/dev/seams.cjs --write (from an LF checkout)');
  stale.slice(0, 40).forEach((l) => console.log(l));
  return 1;
}
