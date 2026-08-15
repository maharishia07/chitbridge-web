#!/usr/bin/env node
'use strict';
/**
 * guard-static.cjs — the checks a parser will never make for you.
 *
 * Athi, 2026-08-15: *"go one by one, check industry standard and provide a best outcome."*
 *
 * Every defect below cost real time today and EVERY ONE OF THEM PASSED `node -c`. That is the point of this file:
 * syntax checking proves a file parses, not that it means what it says.
 *
 *   1. DUPLICATE OBJECT KEYS — `EP` declared `restore` and `entitySearch` twice. An object literal silently keeps
 *      the last, so one definition never existed at runtime. Same class as the `MSG` collision that made a
 *      finished screen render as "on the build roadmap".
 *   2. GLOBAL COLLISIONS ACROSS FILES — a `var X` in a cap-*.js that app.html already declares as `const X`
 *      throws at load; the script tag still fires onload, CAP_LOADED says true, and the screen falls through to
 *      a stub with nothing anywhere saying why.
 *   3. A `.btn` INSIDE A FLEX ROW — global CSS sets `.btn { width:100% }`, which swallows the row and squeezes
 *      the field beside it to nothing. Found three times by eye before it was found by cause.
 *   4. TEXT BELOW 11px — the legibility floor.
 *
 * Run:  node e2e/guard-static.cjs        (exit 1 on any hard failure)
 */
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..', 'public');
const APP = path.join(WEB, 'app.html');
const CAPS = fs.readdirSync(path.join(WEB, 'app')).filter((f) => f.endsWith('.js'));

let hard = 0, soft = 0;
const fail = (m) => { hard++; console.log('  ✗ ' + m); };
const warn = (m) => { soft++; console.log('  ⚠ ' + m); };
const pass = (m) => console.log('  ✓ ' + m);

const app = fs.readFileSync(APP, 'utf8');

// ── 1 · duplicate keys in EP ─────────────────────────────────────────────────────────────────────────────────
console.log('\n1 · duplicate EP keys');
{
  const m = app.match(/const EP = \{[\s\S]*?\n\};/);
  const keys = m ? [...m[0].matchAll(/^\s{2}([A-Za-z_][\w]*)\s*:/gm)].map((x) => x[1]) : [];
  const seen = {}, dup = [];
  keys.forEach((k) => { if (seen[k]) dup.push(k); seen[k] = 1; });
  if (dup.length) fail('EP declares these twice — the later silently wins: ' + [...new Set(dup)].join(', '));
  else pass(keys.length + ' EP keys, all unique');
}

// ── 2 · global collisions between app.html and any cap-*.js ─────────────────────────────────────────────────
console.log('\n2 · global name collisions');
{
  const declOf = (src) => new Set([...src.matchAll(/^(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)/gm)].map((x) => x[1]));
  const appDecl = declOf(app);
  let clashes = 0;
  CAPS.forEach((f) => {
    const src = fs.readFileSync(path.join(WEB, 'app', f), 'utf8');
    [...declOf(src)].forEach((n) => {
      /* ⚠️ Only a TOP-LEVEL redeclaration throws, and only for const/let. A `function` or `var` reassignment is
         legal-but-suspicious, so it warns rather than fails. */
      const asConst = new RegExp('^(?:const|let)\\s+' + n + '\\b', 'm');
      if (appDecl.has(n)) {
        if (asConst.test(app) || asConst.test(src)) { fail(f + ' declares `' + n + '`, which app.html also declares — this throws at load'); clashes++; }
        else { warn(f + ' redeclares `' + n + '` from app.html (legal, but one of them is dead)'); clashes++; }
      }
    });
  });
  if (!clashes) pass('no cap-*.js global collides with app.html');
}

// ── 3 · .btn inside a flex row without the width override ───────────────────────────────────────────────────
/**
 * ⚠️ THIS CHECK WAS FLAGGING THE CURE AS THE DISEASE, and produced 24 warnings that were mostly noise.
 *
 * The old rule was "a line with `class="btn"` that also mentions flex". That matched `<button class="btn"
 * style="flex:1">` — which is CORRECT — and 2-button rows, which are harmless. A warning list that is mostly
 * false positives is a list nobody reads, so it was hiding whatever real instances it contained.
 *
 * Measured in a live page on 2026-08-15, row 400px wide, with the global `.btn{width:100%}`:
 *
 *   <input style="flex:1"> + <button class="btn">              INPUT 27px · BUTTON 367px   ← THE BUG
 *   <input style="flex:1"> + <button class="btn" width:auto>   INPUT 349px · BUTTON 45px   ← correct
 *   <input>                + <button class="btn">              INPUT 197px · BUTTON 197px  ← harmless
 *   <button class="btn" flex:1> ×2                             197px · 197px               ← harmless
 *
 * So the fault is NARROW: a `.btn` that overrides neither `width` nor `flex` on ITSELF, standing beside a
 * sibling that grows. As a flex item its `width:100%` becomes a 100% flex-basis and it takes the whole row,
 * crushing the field next to it to nothing. That — not "flex was mentioned nearby" — is what to warn about.
 */
console.log('\n3 · .btn in a flex row');
{
  let found = 0;
  /* The button's OWN style attribute, not the whole line — the line contains its siblings' styles too, which is
     exactly how `<input style="flex:1">` next door made a bare button look guarded. */
  const BTN = /<button[^>]*class=\\?"btn[^"\\]*\\?"[^>]*>/g;
  [['app.html', app]].concat(CAPS.map((f) => [f, fs.readFileSync(path.join(WEB, 'app', f), 'utf8')]))
    .forEach(([name, src]) => {
      src.split('\n').forEach((line, i) => {
        /**
         * ⚠️ THE TRIGGER IS A GROWING SIBLING, NOT `display:flex`. Two bare `.btn`s in a flex row measure
         * 197/197 in a 400px row — they split it evenly and nothing is crushed. It is only when something
         * ELSE on the row wants to grow that an unguarded 100%-wide button starves it. Stripping the buttons
         * out first is what makes "a sibling grows" answerable: `<input style="flex:1">` next door was
         * previously making a bare button look guarded, because the flex was on the same LINE.
         */
        const siblings = line.replace(BTN, '');
        if (!/flex:\s*1/.test(siblings)) return;
        (line.match(BTN) || []).forEach((tag) => {
          const own = (tag.match(/style=\\?"([^"\\]*)/) || [])[1] || '';
          if (/width:\s*auto/.test(own) || /flex:/.test(own)) return;   // guarded on itself — fine
          found++;
          warn(name + ':' + (i + 1) + ' — .btn beside a growing sibling with no width:auto or flex: of its own'
            + ' (it takes the row and crushes the field)');
        });
      });
    });
  if (!found) pass('no unguarded .btn beside a growing sibling');
}

// ── 6 · TWO FILES MUST NOT CLAIM THE SAME GLOBAL ────────────────────────────────────────────────────────────
/**
 * ⭐⭐ THIS CHECK EXISTS BECAUSE I SHIPPED EXACTLY THIS BUG, FOUR TIMES, ON 2026-08-15.
 *
 * `catalogue-ui.js` assigned `root.CBCatalogue` — the same global `catalogue-model.js` has always exported. Both
 * are loaded by app.html, mine loads second, so it OVERWROTE the other. `CBCatalogue.STANDARDS`, `.PALETTE`,
 * `.ensure`, `.toJSONSchema`, `.upsertItem` all became undefined, which silently broke the catalogue setup screen
 * (cap-catalogue.js calls four of those). Nothing threw at load. It rode through four pushes.
 *
 * ⚠️ CHECK 2 DID NOT CATCH IT and could not: it compares each cap file against app.html's own declarations, not
 * cap files against each other. A collision between two lazily-loaded modules is invisible to it.
 *
 * ⚠️ AND IT IS INVISIBLE TO EVERY OTHER GATE TOO. `node --check` passes — the code is valid. The e2e suite
 * passed 25/25 — nothing it drives touches the catalogue setup screen. A screen nobody's spec opens is a screen
 * that can be dead for a week.
 *
 * The rule: exactly one file may assign any given `root.X` / `window.X`.
 */
console.log('\n6 · one global, one owner');
{
  const files = [['app.html', app]].concat(CAPS.map((f) => [f, fs.readFileSync(path.join(WEB, 'app', f), 'utf8')]));
  const owners = {};
  files.forEach(([name, src]) => {
    /* `root.X = `, `window.X = `, `globalThis.X = ` at an assignment, not a read. */
    [...src.matchAll(/\b(?:root|window|globalThis)\.([A-Z][A-Za-z0-9_$]*)\s*=(?!=)/g)].forEach((m) => {
      (owners[m[1]] = owners[m[1]] || new Set()).add(name);
    });
  });
  const clashes = Object.keys(owners).filter((k) => owners[k].size > 1);
  if (clashes.length) {
    clashes.forEach((k) => fail('`' + k + '` is assigned by ' + [...owners[k]].join(' AND ')
      + ' — whichever loads last wins and the other file\'s API silently disappears'));
  } else {
    pass(Object.keys(owners).length + ' globals, each with exactly one owner');
  }
}

// ── 5 · a REPLACEMENT RENDERER MUST EMIT EVERY HOOK THE ONE IT REPLACES DOES ────────────────────────────────
/**
 * ⭐⭐ THIS CHECK EXISTS BECAUSE I DROPPED THREE HOOKS IN ONE AFTERNOON, ONE SPEC AT A TIME.
 *
 * catalogue-ui.js renders the same rows cart-ui.js does, into the same elements, for the same specs. On
 * 2026-08-15 it shipped without `cbcart-bar` (render-smoke clicks the class), without `cart-count-<ns>`
 * (order-steps asserts the badge), and without `cart-add` (order-steps clicks it — and that one timed out for
 * 15 seconds waiting for a button that was on screen the whole time under a different name).
 *
 * Each was found by a different failing test, twenty minutes apart. None of them fails loudly: a renamed hook
 * looks exactly like a feature that is missing, and a spec that cannot find a control cannot tell you whether
 * the control is broken or merely renamed.
 *
 * So the sets are compared mechanically. If cart-ui emits a testid, catalogue-ui must too — or the omission has
 * to be stated here, deliberately, with a reason.
 */
console.log('\n5 · renderer hook parity (cart-ui → catalogue-ui)');
{
  const rd = (p) => { try { return fs.readFileSync(path.join(WEB, 'app', p), 'utf8'); } catch (e) { return ''; } };
  const cart = rd('cart-ui.js'), cat = rd('catalogue-ui.js');
  if (!cat) { pass('catalogue-ui.js not present — nothing to compare'); }
  else {
    /* Literal testids only. The interpolated ones (`cart-' + ns`) are compared by their stable prefix. */
    const ids = (src) => new Set([...src.matchAll(/data-testid="([a-z-]+)(?:'|")/g)].map((m) => m[1]));
    const missing = [...ids(cart)].filter((k) => !ids(cat).has(k));
    /* Classes a spec addresses directly. */
    const classes = ['cbcart-bar'];
    const missingCls = classes.filter((c) => cart.includes(c) && !cat.includes(c));
    const gone = missing.concat(missingCls);
    /* `cart-checkout` lives in cart-ui's POPUP, which catalogue-ui does not replace — the popup is still
       cart-ui's. Declared here so it is a decision rather than an oversight. */
    const OK_TO_OMIT = ['cart-checkout'];
    const real = gone.filter((k) => OK_TO_OMIT.indexOf(k) < 0);
    if (real.length) {
      fail('catalogue-ui.js does not emit hooks cart-ui.js does: ' + real.join(', ')
        + '  — a renamed hook is indistinguishable from a missing feature');
    } else {
      pass('catalogue-ui emits every hook cart-ui does (omitting only: ' + OK_TO_OMIT.join(', ') + ')');
    }
  }
}

// ── 4 · text below the legibility floor ─────────────────────────────────────────────────────────────────────
console.log('\n4 · font-size floor (11px)');
{
  const tiny = {};
  [['app.html', app]].concat(CAPS.map((f) => [f, fs.readFileSync(path.join(WEB, 'app', f), 'utf8')]))
    .forEach(([name, src]) => {
      const hits = [...src.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].filter((m) => parseFloat(m[1]) < 11);
      if (hits.length) tiny[name] = hits.length;
    });
  const total = Object.values(tiny).reduce((a, b) => a + b, 0);
  /* ⚠️ A WARNING, NOT A FAILURE, and deliberately so: there are hundreds today. Failing the build on a number
     nobody can fix in one sitting turns the guard into something people disable. It reports and it does not
     grow — tighten this to a hard fail once the count is down. */
  if (total) warn(total + ' inline font-sizes below 11px — ' + Object.entries(tiny).map(([k, v]) => k + ':' + v).join(', '));
  else pass('nothing below 11px');
}

console.log('\n== GUARD ==  ' + hard + ' failure(s) · ' + soft + ' warning(s)');
process.exit(hard ? 1 : 0);
