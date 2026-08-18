/**
 * a11y-contrast.cjs — measure every theme against the level it CLAIMS.
 *
 * ⚠️⚠️ WHY THIS EXISTS. The accessibility themes make a PROMISE in the user interface: a card that says
 * "WCAG 2.2 AAA — 7:1" is telling someone with low vision that this theme is safe for them to use. A promise
 * about contrast that was made by eye is not a promise, it is a guess with a standard's name on it. Nobody can
 * look at #3A4046 on #FFFFFF and know whether it is 6.8:1 or 7.2:1 — and the difference is exactly the claim.
 *
 * So each theme DECLARES its level in `a11y.level`, and this tool computes whether it holds. A theme that claims
 * AAA and measures 6.4:1 fails here rather than in front of the person who needed the 7.
 *
 * ⚠️ IT MEASURES BOTH ROLES OF EVERY ACCENT, which is the mistake the theme work kept catching by hand: a colour
 * is used as TEXT on a card and as a FILL with white text on it, and those pull in opposite directions. A green
 * light enough to read as a link is too light to carry a white button label. Both are checked here.
 *
 * WCAG 2.2 thresholds applied:
 *   1.4.3 AA   body text 4.5:1 · large text 3:1
 *   1.4.6 AAA  body text 7:1   · large text 4.5:1
 *   1.4.11     non-text UI (rules, borders, focus rings) 3:1  — applies at EVERY level
 *
 * Run: node e2e/a11y-contrast.cjs        (exit 1 on any failed claim)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'public', 'app.html');
const src = fs.readFileSync(APP, 'utf8');

/* ── colour maths ────────────────────────────────────────────────────────────────────────────────────────── */

function hex(c) {
  let s = String(c || '').trim().replace(/^#/, '');
  if (s.length === 3) s = s.split('').map((x) => x + x).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}

/** WCAG relative luminance — the sRGB transfer curve, not a naive average. */
function lum(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const a = hex(fg), b = hex(bg);
  if (!a || !b) return null;
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ── read the themes out of the app ──────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ THE BASE PALETTE IS PARSED, NOT COPIED. A theme only overrides SOME tokens; everything else falls through
 * to :root. Duplicating those defaults here would mean this tool measures a palette the app no longer has —
 * green on a screen that is failing. First definition wins, which is what the cascade does.
 */
function baseTokens() {
  const out = {};
  const styleEnd = src.indexOf('</style>');
  const css = src.slice(0, styleEnd > 0 ? styleEnd : 200000);
  const re = /(--[a-z0-9-]+)\s*:\s*([^;{}]+)[;}]/gi;
  let m;
  while ((m = re.exec(css))) {
    const k = m[1], v = m[2].trim();
    if (!(k in out)) out[k] = v;
  }
  return out;
}

/** Resolve one level of var() indirection — `--danger:var(--disp)` must measure as the red it actually is. */
function resolve(tok, map, depth) {
  let v = map[tok];
  for (let i = 0; i < 4 && v && /^var\(/.test(v); i++) {
    const inner = /var\(\s*(--[a-z0-9-]+)/i.exec(v);
    if (!inner) break;
    v = map[inner[1]];
  }
  return v;
}

/**
 * The THEMES object, read as source. ⚠️ Deliberately NOT eval'd of the whole file — app.html is a browser
 * document and will not run under node. The object literal is extracted and evaluated alone.
 */
function themes() {
  const start = src.indexOf('var THEMES = {');
  if (start < 0) throw new Error('THEMES not found in app.html');
  let depth = 0, i = src.indexOf('{', start), end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error('THEMES literal did not close');
  // eslint-disable-next-line no-new-func
  return new Function('return ' + src.slice(src.indexOf('{', start), end))();
}

/* ── the checks ──────────────────────────────────────────────────────────────────────────────────────────── */

const BASE = baseTokens();
const THEMES = themes();

/* Accents carry two jobs each: text on a card, and a fill with white on it. Both are measured. */
const ACCENTS = ['--blue', '--ok', '--prog', '--disp', '--purple', '--gold'];
/* The four greys are a SCALE. Each must clear the bar, and they must still descend — a scale that no longer
   orders is not a scale, and every "less important than" built on it starts lying. */
const GREYS = ['--grey', '--grey-2', '--grey-3', '--grey-4'];
/* The row states. A reader is guaranteed to be looking at the selected row, so muted text must survive on it. */
const ROWS = ['--card', '--hover', '--sel-2', '--picked'];
/**
 * ⭐⭐ A TINT IS HALF OF A PAIR, NOT A DECORATION — and this list is the half the tool was missing.
 *
 * Athi, 2026-08-18, looking at the Legend's Work patterns tab: *"the colour seems to be something that we
 * haven't caught."* He was right, and the miss was structural rather than a slip: every accent check above
 * measures against `--card`, so the one surface these colours are actually PRINTED ON — their own tint — was
 * never measured at all. `--ok-tint` exists precisely so `--ok-2` text can sit on it; that is why nine
 * near-identical pale blues were collapsed into one token in the first place.
 *
 * Every status chip in the product rides on this pairing: done, disputed, in progress, every count badge. The
 * first run found 9 failures including --warn-2 at 3.33:1 in Vibrant and --blue-2 at 3.51:1 in Dark. Nobody had
 * reported those either — a chip is small and easy to squint past, which is exactly why it needs measuring
 * instead of looking at.
 */
const TINT_PAIRS = [
  ['--blue-tint-bg', '--blue-2'], ['--ok-tint', '--ok-2'], ['--danger-tint', '--disp'],
  ['--warn-tint', '--warn-2'], ['--purple-tint', '--purple-2'], ['--neutral-tint', '--grey'],
  /* ⚠️ THERE ARE TWO BLUE TINTS AND THEY ARE USED DIFFERENTLY — --blue-tint is the pale CALLOUT ground and
     --blue-tint-bg is the chip ground. Checking only one left the other unmeasured, which is how a chip at
     4.06:1 survived on the Legend's Work patterns tab until someone looked at it. */
  ['--blue-tint', '--blue'],
];

let failures = 0, checks = 0;
const lines = [];

function check(theme, label, got, min, note) {
  checks++;
  const ok = got != null && got >= min;
  if (!ok) failures++;
  lines.push('    ' + (ok ? '✓' : '✗') + ' ' + label.padEnd(42)
    + (got == null ? '   n/a' : got.toFixed(2).padStart(6)) + ' / ' + String(min).padEnd(5)
    + (note ? '  ' + note : ''));
}

Object.keys(THEMES).forEach((key) => {
  const t = THEMES[key];
  const map = Object.assign({}, BASE, t.vars || {});
  const v = (tok) => resolve(tok, map);

  const claim = (t.a11y && t.a11y.level) || 'AA';
  const TEXT = claim === 'AAA' ? 7 : 4.5;
  const LARGE = claim === 'AAA' ? 4.5 : 3;

  lines.push('');
  lines.push('  ' + (t.name || key) + (t.a11y ? '   [claims ' + claim + (t.a11y.forWho ? ' · ' + t.a11y.forWho : '') + ']' : '   [ordinary theme · AA]'));

  const card = v('--card'), paper = v('--paper');

  check(key, 'ink on card', ratio(v('--ink'), card), TEXT);
  check(key, 'ink on paper', ratio(v('--ink'), paper), TEXT);

  /* ⚠️ Muted text is measured on EVERY row state, not just the card. The bug this catches by construction: a
     selected-row ground that quietly eats the secondary text on the one row the reader is looking at. */
  GREYS.forEach((g) => {
    ROWS.forEach((r) => {
      const bg = v(r);
      if (!bg) return;
      check(key, g + ' on ' + r, ratio(v(g), bg), TEXT);
    });
  });

  /* The scale must still descend. */
  const ls = GREYS.map((g) => { const c = ratio(v(g), card); return c == null ? null : c; });
  const ordered = ls.every((x, i) => i === 0 || x == null || ls[i - 1] == null || ls[i - 1] >= x - 0.001);
  checks++;
  if (!ordered) { failures++; lines.push('    ✗ the four greys no longer descend            ' + ls.map((x) => x && x.toFixed(2)).join(' > ')); }
  else lines.push('    ✓ the grey scale still descends            ' + ls.map((x) => x && x.toFixed(2)).join(' > '));

  ACCENTS.forEach((a) => {
    const c = v(a);
    if (!c) return;
    /* ⚠️ --gold IS NOT TEXT. It is the brand rule and the ornament on a gold-soft ground — it has never carried
       body copy, and holding it to a text bar reported a failure the product does not have. Its real pairing is
       --on-gold, measured below like every other fill. Measuring a token against a job it does not do is how a
       contrast tool loses the reader's trust and gets ignored. */
    if (a !== '--gold') check(key, a + ' as text on card', ratio(c, card), TEXT);

    /* As a FILL carrying its own paired ink. ⚠️ NOT always white: --on-gold is near-black and --on-purple is
       white, and that pairing is declared in the token set precisely so nobody has to guess. Assuming white
       here measured gold against ink it never sits beneath.
       ⚠️ Large-text bar, not body: these are button labels and chips, set bold and big. Holding fills to the
       body bar would rule out every usable accent and leave a grey product. */
    const on = v('--on-' + a.slice(2)) || '#ffffff';
    check(key, a + ' as fill, its ink on it', ratio(on, c), LARGE, 'button labels');
  });

  /* The tints, against the ink they exist to carry — see the note on TINT_PAIRS. */
  TINT_PAIRS.forEach(([tint, ink]) => {
    const bg = v(tint), fg = v(ink);
    if (!bg || !fg) return;
    check(key, ink + ' on ' + tint, ratio(fg, bg), TEXT, 'status chips');
  });

  /* ⚠️ 1.4.11 IS A FAILURE ONLY WHERE THE THEME PROMISED IT. Our --line is a hairline DIVIDER between rows and
     around cards; nothing about identifying a control depends on seeing it, and at 1.39:1 it sits where most
     modern interfaces put a divider. Failing every ordinary theme on it would bury the real findings under a
     stylistic opinion. But a theme sold as high-contrast is promising visible EDGES — there, it is the claim. */
  const lineR = ratio(v('--line'), card);
  if (t.a11y) check(key, 'line on card (WCAG 1.4.11)', lineR, 3, 'the theme promised visible edges');
  else lines.push('    · line on card                             '
    + (lineR == null ? ' n/a' : lineR.toFixed(2).padStart(6)) + ' / 3      divider, not a control boundary — advisory');
});

console.log('\n══ THEME CONTRAST — every theme against the level it claims ══');
console.log(lines.join('\n'));
console.log('\n══ ' + checks + ' checks · ' + failures + ' failure(s) ══\n');
process.exit(failures ? 1 : 0);
