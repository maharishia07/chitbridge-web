/**
 * tests/chart-combos.test.cjs — THE COLOUR COMBINATIONS, AS DATA (chart engine step 2; REQ sections 4 and 6, critic points 5 and 10; Athi 16 Nov: "red is never a series colour").
 *
 *   · twelve combinations in ONE place (CBDraw.COMBOS) beside "Follow my avatar theme": IBCS grey and ten published sets (the sample's list; the one it left out is red-led)
 *   · every hex is one the sample page read (web branch l16/mis-sample-web, public/lab/chart-themes.html); skipped with a note where that branch is not in this clone
 *   · RED IS NEVER A SERIES COLOUR: no series colour of any combination has a red hue
 *   · a label written inside a fill is readable on it: onColour() gives 4.5:1 on every series colour of every combination
 *   · the vibrant default draws a published set exactly as published; the readable render draws a set that holds 3:1 as it is, else the theme tint, else IBCS grey
 *   · HOSTILE FIXTURE: a combination with a 1.4:1 mark — drawn as published with Readability off (the person's own pick, the guards treat it so), but the readable render
 *     clears 3:1; and a render that IGNORES the toggle (the 1.4:1 mark under data-read="on") is caught by the checker
 *   · the contrast helper is the one arithmetic: CBUiStandard.contrastRatio is a call to it (ui-standard.js holds no copy)
 *
 * Run: node tests/chart-combos.test.cjs
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const D = require('../public/engine/chart-draw.js');

let pass = 0,
  fail = 0;
const it = (what, fn) => {
  try {
    fn();
    pass++;
    console.log('  ok  ' + what);
  } catch (e) {
    fail++;
    console.log('  FAIL ' + what + '\n       ' + (e && e.message));
  }
};
const hueOf = (colour) => {
  const [r, g, b] = D.channelsOf(colour).map((x) => x / 255);
  const high = Math.max(r, g, b),
    low = Math.min(r, g, b),
    span = high - low;
  if (!span) return -1;
  let hue = high === r ? ((g - b) / span) % 6 : high === g ? (b - r) / span + 2 : (r - g) / span + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
};
const publishedColours = () => Object.values(D.COMBOS).flatMap((set) => (set.act ? [set.act, set.prev, set.acc].concat(set.ramp, set.more || [], set.pie || []) : []));
const TOKENS = { page: '#FAF8F4', ink: '#0F2E3D', acc: '#3F66A6', prog: '#7d6126' };
/** the guard's own check of one render: [every mark colour, the page] → the marks under 3:1 (what a chart marked data-read="on" may not have) */
const weakMarks = (palette, page) => palette.pie.concat([palette.act, palette.prev, palette.acc], palette.ramp).filter((colour) => D.contrast(colour, page) < D.MARK_NEED);

it('twelve combinations: IBCS grey and ten published sets (and "follow my avatar theme" is not in the list: it is the rule)', () => {
  assert.strictEqual(Object.keys(D.COMBOS).length, 11);
  assert.ok(D.COMBOS.ibcs && !D.COMBOS.follow);
});
it('every combination has a name', () => Object.values(D.COMBOS).forEach((set) => assert.ok(set.name)));
it('RED IS NEVER A SERIES COLOUR: no series colour has a red hue (330..360 or 0..15)', () => {
  const reds = publishedColours().filter((colour) => {
    const hue = hueOf(colour);
    return hue >= 330 || (hue >= 0 && hue <= 15);
  });
  assert.deepStrictEqual(reds, []);
});
it('a label inside a fill reads on it: 4.5:1 for every series colour (black or white, whichever is better)', () => {
  const weak = publishedColours().filter((colour) => D.contrast(colour, D.onColour(colour)) < D.TEXT_NEED);
  assert.deepStrictEqual(weak, []);
});
it('every published hex is one the sample page read', () => {
  let sample = '';
  try {
    sample = cp.execSync('git show origin/l16/mis-sample-web:public/lab/chart-themes.html', { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 25 });
  } catch (_) {
    console.log('       (the sample branch is not in this clone: hexes not compared)');
    return;
  }
  const known = new Set((sample.match(/#[0-9A-Fa-f]{6}/g) || []).map((hex) => hex.toLowerCase()));
  const strange = publishedColours().filter((hex) => !known.has(hex.toLowerCase()));
  assert.deepStrictEqual(strange, []);
});
it('VIBRANT (off): a published set draws exactly as published, whatever its contrast', () => {
  const palette = D.paletteOf('okabe', TOKENS, 'off');
  assert.strictEqual(palette.used, 'okabe');
  assert.strictEqual(palette.act, '#0072B2');
  assert.strictEqual(palette.prev, '#E69F00');
});
it('READABLE (on): a set that fails 3:1 draws as the theme tint where that clears, else IBCS grey; every mark then holds 3:1', () => {
  Object.keys(D.COMBOS).forEach((id) => {
    const palette = D.paletteOf(id, TOKENS, 'on');
    assert.deepStrictEqual(weakMarks(palette, TOKENS.page), [], id + ' on ' + TOKENS.page);
    assert.ok(palette.held, id);
  });
});
it('no combination chosen (or a removed one read back) is "follow my avatar theme": the tint, never an error', () => {
  assert.strictEqual(D.paletteOf('', TOKENS, 'off').used, 'follow');
  assert.strictEqual(D.paletteOf('no-such-set', TOKENS, 'off').used, 'follow');
});
it('HOSTILE: a 1.4:1 combination is drawn as chosen with Readability OFF, and made readable with it ON', () => {
  D.COMBOS.hostile = { name: 'Hostile', act: '#dcdcdc', prev: '#e2e2e2', acc: '#d8d8d8', ramp: ['#dcdcdc', '#e0e0e0', '#e4e4e4', '#e8e8e8', '#ececec'] };
  try {
    const off = D.paletteOf('hostile', { page: '#ffffff', ink: '#111111', acc: '#2468BD', prog: '#7d6126' }, 'off');
    assert.strictEqual(off.act, '#dcdcdc');
    assert.ok(D.contrast('#dcdcdc', '#ffffff') < 1.5, 'the fixture is 1.4:1 on white');
    assert.strictEqual(off.held, false);
    const on = D.paletteOf('hostile', { page: '#ffffff', ink: '#111111', acc: '#2468BD', prog: '#7d6126' }, 'on');
    assert.deepStrictEqual(weakMarks(on, '#ffffff'), []);
    /* a render that ignored the toggle: the palette of OFF under a chart that says data-read="on" — the checker must find weak marks */
    assert.ok(weakMarks(off, '#ffffff').length > 0, 'the guard fails a render that ignored Readability');
  } finally {
    delete D.COMBOS.hostile;
  }
});
it('CBUiStandard.contrastRatio calls CBDraw.contrast: one arithmetic, no second copy in ui-standard.js', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'ui-standard.js'), 'utf8');
  assert.ok(source.includes('return window.CBDraw.contrast(first, second);'), 'contrastRatio is a call to CBDraw.contrast');
  assert.ok(!source.includes('Math.pow('), 'ui-standard.js holds no luminance arithmetic of its own');
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'ui-standard.html'), 'utf8');
  assert.ok(html.indexOf('/engine/chart-draw.js') > 0 && html.indexOf('/engine/chart-draw.js') < html.indexOf('/app/ui-standard.js'), 'the page loads the engine before ui-standard.js');
  assert.ok(Math.abs(D.contrast('#000000', '#ffffff') - 21) < 1e-9);
});
console.log((fail ? 'FAIL' : 'PASS') + ' · chart combos · ' + pass + ' ok, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
