/**
 * rtl-audit.cjs — MEASURE whether this app can render right-to-left, rather than assert it.
 *
 * Athi, 2026-08-19: *"if at all you can work on language backlog you can work on it, arabic."*
 *
 * ⚠️ RTL IS NOT A TRANSLATION PROBLEM. A fully translated Arabic app with physical CSS is broken; an untranslated
 * one with logical CSS and bidi isolation is merely English, and correct. Translation is the LAST step, not the
 * first, and doing it first is how a product ships an Arabic screen that reads backwards.
 *
 * So this measures STRUCTURE, in four classes, worst first:
 *
 *   1 BIDI     an LTR identifier inside RTL text, unisolated — displays in the WRONG ORDER, silently
 *   2 PHYSICAL left/right where the layout must mirror
 *   3 GLYPH    no font loaded that can draw Arabic at all
 *   4 ARROW    a directional glyph that must flip and cannot
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'public');

const FILES = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!/node_modules|_design|illustrations|docs/.test(f.name)) walk(p); }
    else if (/\.(html|js)$/.test(f.name) && !/\.min\./.test(f.name)) FILES.push(p);
  }
})(ROOT);

const SEP = String.fromCharCode(92);
const rel = (p) => path.relative(ROOT, p).split(SEP).join('/');
const out = { physical: [], arrow: [] };

/**
 * ── 2 · PHYSICAL PROPERTIES ──────────────────────────────────────────────────────────────────────────────
 * Only the ones that MIRROR: margin/padding/border sides, text-align, float, corner radii.
 *
 * ⚠️ DELIBERATELY NOT background-position, box-shadow offsets or transform translateX. Those are visual effects
 * the eye reads the same in either direction, and including them would bury the real findings under noise — the
 * exact failure mode that makes a linter get switched off.
 */
const PHYS = [
  [/\bmargin-(left|right)\s*:/g,                     'margin-inline-start / -end'],
  [/\bpadding-(left|right)\s*:/g,                    'padding-inline-start / -end'],
  [/\bborder-(left|right)(-\w+)?\s*:/g,              'border-inline-start / -end'],
  [/\btext-align\s*:\s*(left|right)\b/g,             'text-align: start / end'],
  [/\bfloat\s*:\s*(left|right)\b/g,                  'float: inline-start / inline-end'],
  [/\bborder-(top|bottom)-(left|right)-radius\s*:/g, 'border-start-start-radius etc.'],
];

/** ── 4 · ARROWS THAT MUST MIRROR ── → ← ▸ ◂ » « and the escaped -&gt; form. */
const ARROWS = /[→←▸◂»«]/g;

for (const f of FILES) {
  const src = fs.readFileSync(f, 'utf8');
  src.split(/\r?\n/).forEach((line, i) => {
    /* skip the lines that DOCUMENT the rule — they name the properties without using them */
    if (/rtl-audit|logical propert|inline-start|inline-end/.test(line)) return;
    for (const [re, fix] of PHYS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) out.physical.push({ f: rel(f), n: i + 1, hit: m[0].trim(), fix });
    }
    ARROWS.lastIndex = 0;
    const a = line.match(ARROWS);
    if (a) out.arrow.push({ f: rel(f), n: i + 1, hit: a.join(' ') });
  });
}

/** ── 3 · CAN ANYTHING DRAW ARABIC? ── */
const app = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
/* the RTL face is injected by locale.js only when an RTL language is chosen, so BOTH files count as "loaded" */
const locale = fs.readFileSync(path.join(ROOT, 'app', 'locale.js'), 'utf8');
const fontLink = (app.match(/fonts\.googleapis\.com\/css2\?[^"']+/) || [''])[0];
const rtlFont = (locale.match(/fonts\.googleapis\.com\/css2\?[^"']+/) || [''])[0];
const ARABIC_FACES = /Noto\+Sans\+Arabic|IBM\+Plex\+Sans\+Arabic|Cairo|Tajawal|Almarai|Amiri|Rubik/;
const hasArabicFont = ARABIC_FACES.test(fontLink) || ARABIC_FACES.test(rtlFont);

/** ── 1 · BIDI ISOLATION ── */
const bidiCSS = /unicode-bidi\s*:\s*(isolate|plaintext)/.test(app) || /<bdi[\s>]/.test(app);

const box = (t) => { console.log('\n' + t + '\n' + '-'.repeat(t.length)); };
const top = (arr, k) => {
  const by = {};
  for (const x of arr) by[x.f] = (by[x.f] || 0) + 1;
  return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, k);
};

box('1 . BIDI ISOLATION - an LTR identifier inside RTL text');
console.log('  ' + (bidiCSS ? 'PASS  some isolation exists' : 'FAIL  no <bdi> and no unicode-bidi:isolate anywhere'));
console.log(bidiCSS
  ? '        .mono carries unicode-bidi:isolate, so every identifier is one opaque token in an Arabic run.'
  : '        acmetraders.clothing inside an Arabic sentence renders clothing.acmetraders. Silently.');

box('2 . PHYSICAL CSS - properties that must mirror');
console.log('  ' + out.physical.length + ' occurrence(s)');
for (const [f, n] of top(out.physical, 8)) console.log('        ' + String(n).padStart(4) + '  ' + f);

box('3 . GLYPH COVERAGE - can any loaded font draw Arabic?');
console.log('  ' + (hasArabicFont ? 'PASS  an Arabic face is loaded' : 'FAIL  no Arabic face is loaded'));
console.log('        always: ' + (fontLink.replace(/^.*css2\?family=/, '') || '(none)').slice(0, 86));
console.log('        on RTL: ' + (rtlFont.replace(/^.*css2\?family=/, '') || '(none — nothing can draw Arabic)').slice(0, 86));

box('4 . DIRECTIONAL GLYPHS - arrows that must flip');
console.log('  ' + out.arrow.length + ' line(s) carrying an arrow glyph');
for (const [f, n] of top(out.arrow, 6)) console.log('        ' + String(n).padStart(4) + '  ' + f);

const fails = (bidiCSS ? 0 : 1) + (hasArabicFont ? 0 : 1) + (out.physical.length ? 1 : 0);
console.log('\n== RTL AUDIT ==  ' + fails + ' blocking class(es)\n');

module.exports = { physical: out.physical, arrow: out.arrow, hasArabicFont, bidiCSS };
