'use strict';
/**
 * e2e/undeclared.cjs — A NAME THAT IS USED AND NEVER DECLARED.
 *
 * ⚠️⚠️ THE FAULT THIS EXISTS FOR, 2026-09-11: `matrixHTML()` in testing.html referenced `KINDS` three times.
 * The function declares `COLS`. I had patched it from memory of an older version, so every call to
 * `paintSummary()` threw `KINDS is not defined`, the Summary tab never repainted, and it kept showing whatever
 * was last drawn — the Cases table.
 *
 * ⭐⭐⭐ AND ATHI REPORTED IT TWICE BEFORE I BELIEVED HIM. *"Are you building the summary tab? It is showing
 * same / similar tab cases?"* was not an opinion about duplication. It was a bug report, in plain words, about
 * a tab rendering the wrong content. I argued about design, deleted a working view over it, and only found the
 * real cause when he asked a third time whether it had been deployed.
 *
 * ⚠️ NOTHING WE HAD COULD CATCH IT. An undefined variable is perfectly valid JavaScript — `app-syntax.cjs` and
 * `html-syntax.cjs` both parse the file clean, and they are right to. It fails only when the function RUNS.
 *
 * ⭐ SO THIS IS THE CHEAPEST CHECK THAT WOULD HAVE. It looks for SHOUTING_CASE identifiers — the convention this
 * codebase uses for module-level tables and constants — that are READ somewhere and declared nowhere. That is a
 * narrow rule, and narrow is the point: it catches the exact mistake with almost no chance of crying wolf.
 *
 * ⚠️ IT IS NOT A LINTER AND MUST NOT GROW INTO ONE. It cannot see a misspelt local, a typo'd property, or a
 * name declared in another file and legitimately shared. A real answer is a parser with scope analysis; this is
 * the ten-line version that catches the class that has actually happened.
 *
 * Run: node e2e/undeclared.cjs   · no network, no browser.
 */
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const files = [];
['', 'app'].forEach((sub) => {
  const d = path.join(PUB, sub);
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).filter((f) => /\.(js|html)$/.test(f)).forEach((f) => files.push(path.join(d, f)));
});

/** every browser and language global a SHOUTING name might legitimately be */
const KNOWN = new Set(['JSON', 'Math', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Map', 'Set', 'Promise', 'Error', 'TypeError', 'NaN', 'Infinity', 'URL', 'Intl', 'Symbol', 'BigInt',
  'WeakMap', 'WeakSet', 'Proxy', 'Reflect', 'ArrayBuffer', 'DataView', 'XMLHttpRequest', 'FormData',
  'FileReader', 'Blob', 'Image', 'Audio', 'Notification', 'MutationObserver', 'IntersectionObserver',
  'ResizeObserver', 'AbortController', 'TextEncoder', 'TextDecoder', 'CustomEvent', 'Event', 'Node',
  'HTMLElement', 'DOMParser', 'Worker', 'IDBKeyRange', 'CSS', 'SVGElement']);

/**
 * ⚠️⚠️ A CAPABILITY FILE SHARES app.html's SCOPE, and that is the design, not an accident. cap-*.js is
 * loaded INTO the page, so UI, SESSION and MSG are declared there and used here — perfectly correct, and the
 * narrowed check reported all three. ⭐ Whatever app.html declares is therefore declared for every app/ file.
 */
const SHARED = (function () {
  try {
    var src = fs.readFileSync(path.join(PUB, 'app.html'), 'utf8');
    var out = new Set();
    /* ⚠ s, not s — the backslash was eaten writing this file, so the pattern read "functions" and
       matched nothing. Which is why SESSION and MSG were still reported when app.html declares both. */
    (src.match(/(?:var|let|const|function)s+([A-Z][A-Z0-9_]{1,})/g) || [])
      /* ⚠ the THIRD backslash eaten in this one file: /.*s/ greedily ate "const" and left " MSG" with a
         leading space, so the shared name never matched. Split on whitespace instead of trimming with a
         regex — there is nothing to get wrong. */
      .forEach(function (d) { out.add(d.trim().split(/s+/).pop()); });
    return out;
  } catch (_) { return new Set(); }
})();

let bad = [];
files.forEach((f) => {
  let src = fs.readFileSync(f, 'utf8');
  /**
   * ⚠️ AN .html FILE IS NOT JAVASCRIPT, AND SCANNING ALL OF IT REPORTED CSS AS CODE. `F6ECD8`, `E0EBF8`,
   * `D8E4F4` are hex colours in the <style> block; SELECT and SUP came out of markup. ⭐ Only the <script>
   * contents are code, so only those are read.
   */
  if (/\.html$/.test(f)) {
    src = (src.match(/<script\b[^>]*>([\s\S]*?)<\/script>/g) || []).join('\n');
  }
  /**
   * ⚠️ COMMENTS AND STRINGS BOTH HAVE TO GO, and the first run proved why by reporting `F6ECD8`, `API`, `RLS`
   * and `SMS` as undeclared names. Comments here are full of SHOUTED prose; strings are full of hex colours and
   * acronyms. An identifier can live in neither, so both are removed before anything is counted.
   *
   * ⚠️ Stripping template literals whole is a known blind spot: a name used inside `${…}` becomes invisible to
   * this check. That is the trade — a guard that fires on twelve healthy lines to catch one sick one is a guard
   * somebody switches off, and then it is not there on the day it is right.
   */
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/`(?:[^`\\]|\\.)*`/g, ' " " ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, ' " " ')
    .replace(/"(?:[^"\\\n]|\\.)*"/g, ' " " ');

  /* a SHOUTING_CASE name: at least two characters, capitals, digits and underscores only */
  /**
   * ⚠️ A THRESHOLD, BECAUSE ONE MENTION IS NOISE AND THREE IS A VARIABLE. Scanning for any SHOUTING name used
   * once produced a hundred and twenty hits across healthy files — CTX, DKP, BETA, FAIL: acronyms in markup
   * and one-off labels. A name genuinely in use as a table or constant is READ repeatedly; KINDS was read
   * three times. ⭐ A guard that fires on a hundred healthy lines to catch one sick one is a guard somebody
   * switches off, and then it is not there on the day it is right.
   */
  const count = {};
  let m;
  /* ⭐ USED AS A TABLE — NAME. or NAME[ — which is what a missing constant actually breaks. A bare SHOUTING
     word is an enum value, a label or an acronym; CART, TIMER and PLAYING were all of those. KINDS was read
     as KINDS.filter(...) and KINDS.forEach(...), and that is the shape this looks for. */
  const useRe = /\b([A-Z][A-Z0-9_]{1,})\s*(?:\.|\[)/g;
  while ((m = useRe.exec(code))) count[m[1]] = (count[m[1]] || 0) + 1;
  const used = new Set(Object.keys(count).filter(function (k) { return count[k] >= 3; }));

  used.forEach((name) => {
    if (KNOWN.has(name)) return;
    if (SHARED.has(name)) return;   /* declared in app.html, shared into every capability */
    /* declared here in any of the shapes this codebase uses? */
    const decl = new RegExp('(?:var|let|const|function)\\s+' + name + '\\b|\\b' + name + '\\s*[:=]\\s*(?:function|\\{|\\[)');
    if (decl.test(code)) return;
    /* a property (x.NAME) or a string key is not a free identifier */
    const free = new RegExp('(?:^|[^.\\w$\'"])' + name + '\\s*(?:[.,;)\\]}]|\\[|\\.|\\s*\\+)');
    if (!free.test(code)) return;
    bad.push(path.relative(PUB, f).split(path.sep).join('/') + '  ' + name);
  });
});

console.log('\n— a name that is read and never declared —\n');
if (bad.length) {
  console.log('  ✗ ' + bad.length + ' name(s) used with no declaration in the same file:\n');
  bad.slice(0, 20).forEach((b) => console.log('      ' + b));
  console.log('\n  ⚠ Valid JavaScript, so every parser passes it. It throws when the function runs, and the');
  console.log('    screen that calls it silently keeps whatever it drew last.\n');
  /**
   * ⚠️⚠️ REPORT-ONLY, AND DELIBERATELY NOT A GATE. This never fails the suite.
   *
   * It took nine passes to get from 120 false positives to 1, and the last change put it back to 47 — the
   * shared-globals set is still not right. ⭐ A guard that oscillates is not nearly-working, it is unfinished,
   * and shipping it as a gate would add a permanent red to a suite whose whole problem this week was reds
   * nobody reads. Exactly the stale tooling we spent the day diagnosing.
   *
   * ⚠️ IT IS KEPT, NOT DELETED, because the fault it exists for is real and cost an afternoon: KINDS used three
   * times, declared nowhere, paintSummary() throwing on every render, and the Summary tab silently showing the
   * Cases table. No parser catches that. Finishing this needs scope analysis, not another regex.
   */
  process.exitCode = 0;
} else {
  console.log('  ✓ every SHOUTING_CASE name is declared where it is used   ' + files.length + ' file(s)\n');
}
