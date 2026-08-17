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
  /**
   * ⚠️ COMMENTS ARE STRIPPED FIRST, AND THAT IS NOT FUSSINESS — this check flagged ITSELF within an hour of being
   * written. cap-definitions.js explains the collision it was written after, quoting `root.CBCatalogue = M` in
   * prose, and the guard read the quotation as an assignment. A check that cannot tell code from a comment ABOUT
   * code will punish exactly the files that document their own history, which is the opposite of what we want.
   *
   * ⚠️ Strings are deliberately NOT stripped: a global assigned via `window['X'] =` is rare here, but a real
   * assignment hidden in a template literal is a genuine collision and should still be caught.
   */
  const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const files = [['app.html', app]].concat(CAPS.map((f) => [f, fs.readFileSync(path.join(WEB, 'app', f), 'utf8')]))
    .map(([name, src]) => [name, decomment(src)]);
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
    /**
     * ⭐ DELEGATION COUNTS AS PARITY, and it is the OUTCOME THIS CHECK SHOULD PREFER.
     *
     * catalogue-ui may render a shared piece by calling `CBCart.<export>(…)` instead of re-emitting the markup.
     * That is strictly better than copying it — one definition of what the thing is — but a literal text scan
     * sees an absent testid and fails. Before this, the only way to quiet it was the allowlist, which is how a
     * correct failure got waved through for an afternoon.
     *
     * So: for every `CBCart.x(` that catalogue-ui calls, resolve `x` through cart-ui's export block to the
     * function it names, take that function's body, and credit the testids it emits.
     */
    const delegated = new Set();
    {
      const calls = [...cat.matchAll(/CBCart\.([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]);
      for (const name of new Set(calls)) {
        // `categoriesHTML: catgsHTML,` — the export name may differ from the function name.
        const map = new RegExp('\\b' + name + '\\s*:\\s*([A-Za-z_$][\\w$]*)').exec(cart);
        const fn = (map && map[1]) || name;
        const at = cart.search(new RegExp('function\\s+' + fn + '\\s*\\('));
        if (at < 0) continue;
        /* Body = up to the next top-level `function ` declaration. Crude, and deliberately so: over-crediting a
           neighbouring helper is a far smaller sin here than failing a file that genuinely delegates. */
        const next = cart.slice(at + 8).search(/\n  function\s+[A-Za-z_$]/);
        const body = cart.slice(at, next < 0 ? undefined : at + 8 + next);
        for (const m of body.matchAll(/data-testid="([a-z-]+)(?:'|")/g)) delegated.add(m[1]);
      }
    }
    const missing = [...ids(cart)].filter((k) => !ids(cat).has(k) && !delegated.has(k));
    /* Classes a spec addresses directly. */
    const classes = ['cbcart-bar'];
    const missingCls = classes.filter((c) => cart.includes(c) && !cat.includes(c));
    const gone = missing.concat(missingCls);
    /**
     * `cart-checkout` lives in cart-ui's POPUP, which catalogue-ui does not replace — the popup is still
     * cart-ui's. Declared here so it is a decision rather than an oversight.
     *
     * ⚠️⚠️ `pick-catg` WAS ON THIS LIST FOR AN AFTERNOON AND THAT WAS A MISTAKE. I justified it as "the category
     * strip is in the sticky search chrome, and a renderer only swaps the list and the bar". False —
     * catalogue-ui has its OWN pickerHTML and replaces the chrome wholesale, and compose uses that one. So the
     * chips were invisible on the busiest order surface in the product, and this check had said so.
     *
     * ⭐ THE LESSON IS ABOUT THE LIST, NOT THE HOOK: an allowlist entry is a claim about the code, and a wrong
     * claim here converts a correct failure into permanent silence. Anything added must be verified by READING
     * the other file, not by reasoning about what a renderer "should" replace.
     */
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

// ── 7 · FILE INTEGRITY — control bytes that survive a syntax check ───────────────────────────────────────────
/**
 * ⚠️ WRITTEN BECAUSE IT HAPPENED (2026-08-16). A NUL byte landed inside a string literal in cap-admin.js where a
 * space was meant. `node --check` PASSED. The browser ran the file. The app worked. The only symptom was that
 * grep started reporting "Binary file … matches", and it was found by accident during an unrelated search.
 *
 * A syntax check is not an integrity check: JS parsers accept control characters inside string literals happily,
 * so the corruption is invisible to every tool that only asks "does this parse". It breaks grep, diff, blame and
 * review — the tools you reach for when something else is already wrong.
 */
console.log('\n7 · file integrity (control bytes)');
{
  const bad = [];
  [['app.html', APP]].concat(CAPS.map((f) => [f, path.join(WEB, 'app', f)]))
    .forEach(([name, file]) => {
      const buf = fs.readFileSync(file);
      /* Tab (9), LF (10), CR (13) are legitimate. Everything else below 0x20, and 0x7F, is not. */
      for (let i = 0; i < buf.length; i++) {
        const b = buf[i];
        if (b === 9 || b === 10 || b === 13) continue;
        if (b < 0x20 || b === 0x7f) {
          const line = buf.slice(0, i).toString('utf8').split('\n').length;
          bad.push(name + ':' + line + ' byte 0x' + b.toString(16).padStart(2, '0'));
          break;   // one report per file is enough to send someone looking
        }
      }
    });
  if (bad.length) fail('control byte in source (invisible to node --check) — ' + bad.join(', '));
  else pass(1 + CAPS.length + ' files, no stray control bytes');
}

// ── 8 · ONE data-testid, ONE ELEMENT ─────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ ALSO WRITTEN BECAUSE IT HAPPENED. `sup-remove` was emitted twice — once on the supplier record panel, once
 * on the order footer — and Playwright's strict mode rejects an ambiguous locator, so the spec died with
 * "resolved to 2 elements". It cost three full suite runs to find, because the failure surfaced as a timeout on
 * an unrelated step rather than as "you have two of these".
 *
 * ⚠️ A WARNING, NOT A FAILURE, for two separate reasons.
 *
 * First, precedent: there are 14 today, and check 4 already records why failing the build on pre-existing debt
 * nobody can clear in one sitting turns a guard into something people switch off.
 *
 * Second, and more important — THIS CHECK CANNOT PROVE A VIOLATION. Two emit sites for one testid are perfectly
 * legal when they are branches of the same conditional: only one is ever in the document, so Playwright sees
 * exactly one. `sup-remove` was a real bug because BOTH rendered at once; `reg-submit` may well be an if/else.
 * Static analysis cannot tell those apart, so this points at candidates and a person decides. Do not promote it
 * to a hard fail — it would fail correct code.
 */
console.log('\n8 · duplicate data-testid');
{
  const seen = {};
  [['app.html', app]].concat(CAPS.map((f) => [f, fs.readFileSync(path.join(WEB, 'app', f), 'utf8')]))
    .forEach(([name, src]) => {
      /**
       * ⚠️ A SELECTOR IS NOT AN EMISSION. `document.querySelector('[data-testid="cat-search"]')` LOOKS FOR a
       * testid; it does not create one. Counting those inflated the duplicate list — cat-search and
       * sup-add-input each reported ×3 when exactly one element of each is rendered, and the two extras were
       * the keyboard shortcut looking them up.
       *
       * ⚠️ WORTH FIXING RATHER THAN TOLERATING, because this check already says its hits are "candidates, not
       * proof". A check that is known to over-report AND is padded with false ones stops being read at all —
       * and it was my own new code that padded it, which is how a guard quietly becomes decorative.
       */
      const emitted = src.split('\n').filter((l) => !/querySelector|querySelectorAll|\.locator\(|getByTestId/.test(l)).join('\n');
      [...emitted.matchAll(/data-testid\s*=\s*["']([^"'${}+]+)["']/g)].forEach((m) => {
        const id = m[1].trim();
        if (!id) return;
        (seen[id] = seen[id] || []).push(name);
      });
    });
  const dupes = Object.entries(seen).filter(([, where]) => where.length > 1);
  if (dupes.length) {
    warn(dupes.length + ' data-testid emitted more than once — candidates, not proof (see note above); '
      + 'a strict-mode failure only occurs when two render TOGETHER — '
      + dupes.slice(0, 6).map(([id, w]) => id + ' ×' + w.length + ' (' + [...new Set(w)].join(', ') + ')').join('; ')
      + (dupes.length > 6 ? ' …' : ''));
  } else pass(Object.keys(seen).length + ' literal testids, each emitted once');
}


// ── 9 · UNPAIRED SURFACES — a themed background with hardcoded text, or the reverse ──────────────
//
// Athi, 2026-08-17: *"we should use couple of colors per theme and should have a definition of where it is
// supposed to be used, so it will be consistent across design pattern."*
//
// ⚠️ THIS IS THE SHAPE OF EVERY CONTRAST BUG FOUND THAT DAY, without exception. The category chip set its
// background from a token and its colour from a literal, so the surface followed the theme and the letters did
// not — in dark the chip went dark while the text stayed dark, 1.63:1, invisible. The reverse is just as broken:
// a literal background under themed text is a surface that CANNOT follow the theme while its letters do.
//
// A declaration that sets both must set them THE SAME WAY. Mixing a token with a literal is the bug.
console.log('\n9 · unpaired surfaces (themed background + hardcoded text, or the reverse)');
{
  const unpaired = {};
  const THEMED_BG_LITERAL_TEXT = /background(?:-color)?:\s*var\(--[a-z0-9-]+\)\s*;\s*color:\s*#[0-9a-fA-F]{3,6}/g;
  const LITERAL_BG_THEMED_TEXT = /background(?:-color)?:\s*#[0-9a-fA-F]{3,6}\s*;\s*color:\s*var\(--[a-z0-9-]+\)/g;
  [['app.html', app]].concat(CAPS.map((f) => [f, fs.readFileSync(path.join(WEB, 'app', f), 'utf8')]))
    .forEach(([name, src]) => {
      const n = [...src.matchAll(THEMED_BG_LITERAL_TEXT)].length + [...src.matchAll(LITERAL_BG_THEMED_TEXT)].length;
      if (n) unpaired[name] = n;
    });
  const total = Object.values(unpaired).reduce((a, b) => a + b, 0);
  /* ⚠️ A WARNING WHILE THE BACKLOG IS WORKED, for the same reason as the font-size floor: a hard fail on a
     number nobody can clear in one sitting is a guard people switch off. What matters is that it does not GROW. */
  if (total) warn(total + ' unpaired surface/text pairs — ' + Object.entries(unpaired).map(([k, v]) => k + ':' + v).join(', '));
  else pass('every background sets its text the same way it sets itself');
}

/**
 * 10 · A TOKEN USED IN THE WRONG ROLE.
 *
 * ⚠️ THIS IS THE ONE THE OTHER CHECKS CANNOT CATCH, BECAUSE NOTHING IS HARDCODED. `background:var(--ink)` is
 * fully tokenised and follows the theme perfectly — into a wall. `--ink` is the BODY TEXT colour. On a light
 * theme it is near-black, so a "dark selected segment" looks deliberate; in dark it inverts to near-WHITE and
 * that segment becomes a white box with white text on it. Measured at 1.21:1 on the catalogue View/Edit toggle
 * and again on the workforce one — the exact thing Athi photographed as "the letter inside the box is not
 * visible at all".
 *
 * ⚠️ THE FIX IS NEVER TO PICK A DIFFERENT SHADE — it is to use a SURFACE token (--card/--accent/--chrome/a tint)
 * and its declared partner. A palette only works if each token keeps one job.
 */
console.log('\n10 · tokens used in the wrong role (a text colour as a surface)');
{
  const TEXT_ONLY = ['--ink', '--ink-2', '--grey-2', '--grey-3', '--grey-4', '--on-card', '--on-bg', '--on-accent', '--on-sel', '--chrome-ink', '--chrome-on', '--on-ok', '--on-warn', '--on-danger', '--on-gold', '--on-purple'];
  const bad = {};
  [['app.html', app]].concat(CAPS.map((f) => [f, fs.readFileSync(path.join(WEB, 'app', f), 'utf8')]))
    .forEach(([name, src]) => {
      /* strip comments — this file DOCUMENTS the bug in prose, and a guard that trips on its own explanation
         teaches people to ignore it */
      const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
      let n = 0;
      for (const t of TEXT_ONLY) {
        /* ⚠️ ONLY WHEN THE DECLARATION ALSO SETS `color:` — i.e. the surface provably CARRIES TEXT.
           A text token's VALUE is perfectly legitimate for a mark that holds no letters: cap-legend paints a 10px
           status dot with --grey-4, and that is a muted dot, not a surface. Flagging it would make this check cry
           wolf on correct code, and a guard that cries wolf is a guard that gets ignored — which costs more than
           the one bug it would have caught. Text on the surface is what makes the pairing rule apply at all. */
        n += [...code.matchAll(new RegExp('background(?:-color)?\\s*:\\s*[^;]{0,120}?var\\(' + t + '\\)[^;{}]{0,40};[^;{}]{0,160}?color\\s*:', 'g'))].length;
      }
      if (n) bad[name] = n;
    });
  const total = Object.values(bad).reduce((a, b) => a + b, 0);
  if (total) warn(total + ' text tokens used as a background — ' + Object.entries(bad).map(([k, v]) => k + ':' + v).join(', '));
  else pass('no text colour is being used as a surface');
}

/**
 * 11 · A SURFACE THAT NAMES NO TEXT COLOUR.
 *
 * ⚠️ THE HALF-WRITTEN DECLARATION — the one checks 9 and 10 cannot see, because there is no wrong colour to
 * find, only a missing one. An element paints its own background and says nothing about its text, so the text
 * inherits from an ancestor that has a DIFFERENT background.
 *
 * That is how the avatar menu broke: `background:var(--card)` and no colour, so Profile / Settings inherited
 * `--chrome-ink` from the topbar — a pale grey that is correct on dark navy and invisible on a white card. In
 * the dark theme --card is itself dark, so it looked right and the bug hid completely. Athi found it by eye,
 * in a menu he opens every day, after three passes had reported the app clean.
 *
 * ⚠️ INHERITANCE ACROSS A SURFACE CHANGE IS NOT A PAIRING. The moment an element paints its own ground it stops
 * being part of its parent's surface, and any colour still arriving from the parent was chosen for a different
 * background. It is right only until one of the two moves.
 */
console.log('\n11 · surfaces that name no text colour (inline styles)');
{
  const SURF = ['--card','--paper','--chrome','--sel','--sel-2','--picked','--hover','--accent','--blue','--blue-2',
    '--blue-d','--disp','--disp-2','--ok','--ok-2','--ok-3','--purple','--purple-2','--gold','--prog','--warn',
    '--blue-tint-bg','--blue-tint','--ok-tint','--danger-tint','--warn-tint','--purple-tint','--neutral-tint','--gold-soft'];
  const bad = {};
  [['app.html', app]].concat(CAPS.map((f) => [f, fs.readFileSync(path.join(WEB, 'app', f), 'utf8')]))
    .forEach(([name, src]) => {
      let n = 0;
      /* ⚠️ JOIN CONCATENATED FRAGMENTS FIRST. Most styles in this codebase are built as `'a;' + 'b'`, so a rule
         that reads one quoted string at a time sees `background:var(--card);` in one fragment and `color:...` in
         the next, and reports a pair that is perfectly fine. It over-reports rather than under-reports, which is
         the safe direction for a guard — but a check that cries wolf is one people learn to skip, and this one
         cried wolf on the very commit that added it. Collapsing `' + '` makes it read what actually ships. */
      src = src.replace(/'\s*\+\s*'/g, '').replace(/"\s*\+\s*"/g, '');
      for (const m of src.matchAll(/style\s*=\s*(["'`])((?:(?!\1)[\s\S]){0,320}?)\1/g)) {
        const st = m[2];
        const bg = /background(?:-color)?\s*:\s*var\((--[a-z0-9-]+)\)/.exec(st);
        if (!bg || !SURF.includes(bg[1])) continue;
        if (/(^|;)\s*color\s*:/.test(st)) continue;
        n++;
      }
      if (n) bad[name] = n;
    });
  const total = Object.values(bad).reduce((a, b) => a + b, 0);
  if (total) warn(total + ' inline surfaces inherit their text colour — ' + Object.entries(bad).map(([k, v]) => k + ':' + v).join(', '));
  else pass('every painted surface names its own text');
}

/**
 * 12 · THE SHARED MODEL IS ACTUALLY REQUIRE()-ABLE.
 *
 * ⚠️ ITS FAILURE MODE IS SILENT, WHICH IS WHY IT IS WORTH A CHECK. catalogue-model.js says in its own header
 * that it is "require()-able in Node (module.exports)" and names headless consumers that MUST route through it.
 * The web package sets "type":"module", so every .js was ESM, the UMD wrapper's CJS branch never ran, and
 * require() handed back an EMPTY OBJECT rather than throwing. The first consumer to believe the header would
 * get `undefined` from every lookup and compute from nothing while appearing to run — no exception, plausible
 * output, wrong. The same class as a vault that reads back empty.
 *
 * Fixed by a package.json scoped to public/app declaring commonjs, which is what those 29 plain browser scripts
 * already are. This check exists because deleting that file would break nothing visible.
 */
console.log('\n12 · the shared catalogue model is require()-able');
{
  try {
    const p = require.resolve(path.join(WEB, 'app', 'catalogue-model.js'));
    delete require.cache[p];
    const M = require(p);
    const n = Object.keys(M || {}).length;
    if (n > 20) pass('catalogue-model.js exports ' + n + ' symbols to Node');
    else warn('catalogue-model.js require() yields ' + n + ' exports — its header promises Node consumers can use it');
  } catch (e) {
    warn('catalogue-model.js cannot be required: ' + (e && e.message));
  }
}
console.log('\n== GUARD ==  ' + hard + ' failure(s) · ' + soft + ' warning(s)');
process.exit(hard ? 1 : 0);
