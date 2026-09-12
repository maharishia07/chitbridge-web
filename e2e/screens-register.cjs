'use strict';
/**
 * screens-register.cjs — THE REGISTER THE BROWSER GETS IS THE REGISTER ON DISK.
 *
 * ── ⭐⭐ WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"maybe a table that remembers the codes and the system should use it to refer. It is like a
 * CMDB kind of."* — so `C:\dev\SCREENS.json` is the register, and `public/app/screens.js` is a GENERATED copy of
 * it for the browser.
 *
 * ⚠️⚠️ A GENERATED FILE THAT NOBODY REGENERATES IS THE SAME BUG AS A HAND-MAINTAINED ONE, and it is quieter: the
 * app keeps working, showing codes that were true last week. The whole value of a code is that it means exactly
 * one thing, so the two copies disagreeing is the one failure this system cannot absorb.
 *
 * ⚠️ Same shape as the cache-buster and the CORS header list before it: two places, one fact, nothing joining
 * them. This is the join.
 *
 * Run: node e2e/screens-register.cjs
 */
const fs = require('fs');
const path = require('path');

const DEV = path.join(__dirname, '..', '..');
const REG = path.join(DEV, 'SCREENS.json');
const JS = path.join(__dirname, '..', 'public', 'app', 'screens.js');

let pass = 0;
const fails = [];
const ok = (what, cond) => { if (cond) { pass++; console.log('  ✓ ' + what); } else { fails.push(what); } };

if (!fs.existsSync(REG)) {
  console.log('\n── screen register ──\n  skipped: SCREENS.json not present (docs repo not checked out)\n');
  process.exit(0);
}

console.log('\n══ the screen register ══');

const reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
const live = Object.entries(reg.screens).filter(([, s]) => !s.retired);

ok('the browser copy exists at all — it is generated and committed, not built at runtime', fs.existsSync(JS));
if (!fs.existsSync(JS)) { fails.forEach((f) => console.error('  ✗ ' + f)); process.exit(1); }

const sandbox = { window: {} };
try { new Function('window', fs.readFileSync(JS, 'utf8'))(sandbox.window); }
catch (e) { console.error('  ✗ the generated copy does not evaluate: ' + e.message); process.exit(1); }
const CB = sandbox.window.CBSCREENS || {};
const rows = CB.rows || [];

ok('every live screen reaches the browser (' + live.length + ')', rows.length === live.length);

const codes = new Set(rows.map((r) => r.code));
const missing = live.filter(([, s]) => !codes.has(s.code)).map(([k, s]) => s.code + ' ' + k);
ok('none is missing' + (missing.length ? ': ' + missing.slice(0, 4).join(' · ') : ''), missing.length === 0);

/* ⚠️ A RETIRED SCREEN MUST NOT BE OFFERED. Its code stays reserved forever, but showing it would say the screen
   still exists — the opposite of what retiring it recorded. */
const retired = Object.entries(reg.screens).filter(([, s]) => s.retired).map(([, s]) => s.code);
const leaked = retired.filter((c) => codes.has(c));
ok('no retired screen is offered' + (leaked.length ? ': ' + leaked.join(' · ') : ''), leaked.length === 0);

/* ⚠️ THE SHAPE IS THE STANDARD: three letters, three digits, six characters. A code that does not fit is a code
   somebody typed by hand into a register that is supposed to be generated. */
const wrong = rows.filter((r) => !/^[A-Z]{3}[0-9]{3}$/.test(r.code)).map((r) => r.code);
ok('every code is AAA### — three letters, three digits' + (wrong.length ? ': ' + wrong.join(' · ') : ''),
   wrong.length === 0);

/* ⚠️⚠️ THE RULE THE WHOLE DESIGN RESTS ON: one code, one screen, for ever. */
const seen = {}, dup = [];
rows.forEach((r) => { if (seen[r.code]) dup.push(r.code); seen[r.code] = r.path; });
ok('no code is claimed by two screens' + (dup.length ? ': ' + dup.join(' · ') : ''), dup.length === 0);

/* the panel and the app both read this — if the lookup by nav key is empty, the code never appears on a screen */
ok('screens are reachable by nav key, or the code can never be shown on the screen it names',
   Object.keys(CB.byNav || {}).length > 10);

fails.forEach((f) => console.error('  ✗ ' + f));
/**
 * ── ⚠️⚠️ THE DECLARED SUB-VIEWS MUST STILL BE WHAT THE APP CALLS THEM ────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"the detail page should be having the screen name?"* — it was showing the code of the LIST
 * he had left, because opening a chit does not change the nav key. The fix reads `_fineScreen()`, which has
 * always distinguished `chit-detail`, `chit-messages` and the three cockpits.
 *
 * ⭐ Those five rows are the only DECLARED ones in the register — every other screen is derived from the live
 * rail. ⚠️ So they are the only ones that can quietly stop matching the product: rename a branch inside
 * `_fineScreen()` and the register keeps describing a screen the app no longer has, with nothing to say so.
 */
{
  /* ⚠️ read here rather than assumed: this file guards two registers and had no app.html to hand */
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.html'), 'utf8');
  const reg2 = JSON.parse(fs.readFileSync(REG, 'utf8'));
  const subs = Object.entries(reg2.screens)
    .filter(([k, v]) => k.indexOf('Detail ') === 0 && !v.retired && v.nav);
  ok('the register declares the sub-views (' + subs.length + ')', subs.length >= 4);
  const orphan = subs.filter(([, v]) => app.indexOf("'" + v.nav + "'") < 0).map(([k, v]) => v.nav + ' (' + v.code + ')');
  ok('every declared sub-view is a name _fineScreen() still returns'
     + (orphan.length ? ': ' + orphan.join(' · ') : ''), orphan.length === 0);
  /* ⚠️ and the reverse: a sub-view the app returns and the register has never heard of shows NO code at all */
  const fine = app.slice(app.indexOf('function _fineScreen'), app.indexOf('function _screenChain'));
  const returned = [...fine.matchAll(/return\s*\(?[^;]*?'([a-z][a-z-]{3,})'/g)].map((m) => m[1]);
  const known = new Set(subs.map(([, v]) => v.nav).concat(['task']));
  const missing2 = [...new Set(returned)].filter((n) => !known.has(n) && n.indexOf('-') > 0);
  ok('no sub-view the app can report is missing from the register'
     + (missing2.length ? ': ' + missing2.join(' · ') : ''), missing2.length === 0);
}

/**
 * ── ⭐ THE ASSET REGISTER, UNDER THE SAME RULES ───────────────────────────────────────────────────────────────
 *
 * ASSETS.json is the software half (ITIL 4 SACM · ISO/IEC 19770) and public/app/assets.js is its generated copy.
 * ⚠️ The same rot applies as to the screens: a generated file nobody regenerates keeps the app working while it
 * shows last week's truth — and a register is exactly the thing people stop double-checking.
 */
const AREG = path.join(DEV, 'ASSETS.json');
const AJS = path.join(__dirname, '..', 'public', 'app', 'assets.js');
if (fs.existsSync(AREG)) {
  ok('the asset register has a browser copy', fs.existsSync(AJS));
  if (fs.existsSync(AJS)) {
    const w = {};
    try { new Function('window', fs.readFileSync(AJS, 'utf8'))(w); }
    catch (e) { fails.push('assets.js does not evaluate: ' + e.message); }
    const A = (w.CBASSETS && w.CBASSETS.rows) || [];
    const areg = JSON.parse(fs.readFileSync(AREG, 'utf8'));
    const aliveA = Object.values(areg.assets || {}).filter((x) => !x.retired);
    ok('every live asset reaches the browser (' + aliveA.length + ')', A.length === aliveA.length);
    ok('every asset code is AAA### too', A.every((x) => /^[A-Z]{3}[0-9]{3}$/.test(x.code)));
    /**
     * ⚠️⚠️ THE LINK IS THE WHOLE POINT OF THE REGISTER. If it ever reads zero the chain is broken — and broken
     * silently, because every row still renders and only the last column goes quiet.
     */
    ok('screens are linked to the capability that draws them',
       Object.keys((w.CBASSETS && w.CBASSETS.drawnBy) || {}).length > 10);
    /* ⭐ the lifecycle is REPORTED, never assumed: a register where everything said "tested" without any file
       declaring it would mean the reader had started guessing on our behalf. */
    ok('the lifecycle stage is only ever what a file declared',
       A.every((x) => x.stage === null || /^[a-z][a-z-]*$/.test(x.stage)));
  }
}

if (fails.length) {
  console.error('\n  Run `node C:\\dev\\screens.cjs` and `node C:\\dev\\assets.cjs`, then commit — the copies have parted.\n');
}
if (!fails.length) console.log('\n  ' + pass + ' passed\n');
process.exit(fails.length ? 1 : 0);
