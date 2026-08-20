/**
 * e2e/session-keys.cjs — a SESSION property that is read but never written is silently always-undefined.
 *
 * ⚠️⚠️ WHY THIS EXISTS. cap-admin.js gated the entire employee profile on `SESSION.identity_type`, a property
 * NOTHING in this codebase assigns. It parsed, it ran, it threw nothing, and it returned false for every user
 * — so a screen that was built, reviewed, committed, deployed and served had never once rendered. Athi found
 * it by asking "is it reflecting in localhost? I am there as an employee." The honest answer was no.
 *
 * ⭐ THAT IS THE WHOLE CLASS: a helper written against a REMEMBERED name is not a crash, it is a silent
 * always-false. JavaScript will not tell you, a parse check will not tell you, and a code review will not
 * either — because the name reads perfectly plausibly. Only comparing readers against writers tells you.
 *
 * It immediately found a second, older one: cap-workforce.js read `SESSION.entity_id` (the real name is
 * `entityId`), so the AI-policy localStorage key silently collapsed to a shared 'cb_aipolicy_me' whenever
 * SESSION.name was absent — two businesses on one browser sharing one policy store.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const files = ['app.html', ...fs.readdirSync(path.join(ROOT, 'app')).filter(f => f.endsWith('.js')).map(f => 'app/' + f)];

/* ⚠️ COMMENTS ARE STRIPPED FIRST. The first run of this sweep flagged SESSION.identity_type again — from the
   comment I had just written explaining that SESSION.identity_type does not exist. A guard that reads prose as
   code reports the documentation of a bug as the bug. */
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/).map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

const reads = new Map(), writes = new Set();
for (const f of files) {
  const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  for (const m of src.matchAll(/SESSION\.([A-Za-z_][A-Za-z0-9_]*)\s*=[^=]/g)) writes.add(m[1]);
  for (const m of src.matchAll(/SESSION\.([A-Za-z_][A-Za-z0-9_]*)/g)) if (!reads.has(m[1])) reads.set(m[1], f);
}

/* setSession spreads its argument, so any key handed to it at sign-in is also a write. */
const app = stripComments(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8'));
for (const m of app.matchAll(/setSession\(\{([^}]*)\}/g))
  for (const k of m[1].matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) writes.add(k[1]);
/* …and whatever is restored from storage on reload. */
for (const m of app.matchAll(/PERSIST[^=]*=\s*\[([^\]]*)\]/g))
  for (const k of m[1].matchAll(/['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g)) writes.add(k[1]);

const orphan = [...reads.entries()].filter(([k]) => !writes.has(k));

if (orphan.length) {
  console.error('\n✗ SESSION property read but NEVER written — silently undefined at every call site:\n');
  orphan.forEach(([k, f]) => console.error(`   SESSION.${k}   first read in public/${f}`));
  console.error('\n  This is not a crash. It is a condition that is always false, or a fallback that never');
  console.error('  fires. Check the real name in app.html setSession().\n');
  process.exit(1);
}

console.log(`✓ SESSION keys — ${reads.size} read, every one of them written somewhere`);
