'use strict';
/**
 * panel-reachable.cjs — A PANEL CAN ALWAYS BE CLOSED, WHATEVER SIZE IT WAS LEFT AT.
 *
 * ── ⚠️⚠️⚠️ THE TRAP ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12, with the Test lab filling more than his screen: *"current window is bigger than my screen,
 * i couldn't move left side as the movement is only on the right side, now i couldn't close the window or
 * reduce the size? what is this?"*
 *
 * `makeMovable` clamped the panel's POSITION into the viewport and never its SIZE. A panel sized on a wide
 * screen — or grown by `fit` — comes back wider than the window; `innerWidth - width` goes negative, the left
 * edge pins to 0, and every control in the header's right-hand group goes off-screen: close, size, refresh, all
 * of them. The panel is then unusable AND unclosable.
 *
 * ⭐⭐ THE SHAPE OF THE BUG IS WORTH MORE THAN THE FIX: the escape hatch was inside the thing that broke. Any
 * control that recovers a bad state must not itself depend on that state being good. The only way out was
 * clearing localStorage from a browser console, which is not a thing to ask of anybody.
 *
 * ⚠️ Static, because the real proof needs a browser at two window sizes — that belongs in a Playwright spec and
 * is worth writing. This guards the three lines whose absence brings the trap straight back.
 *
 * Run: node e2e/panel-reachable.cjs
 */
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'public', 'app.html');
const src = fs.readFileSync(APP, 'utf8');

let pass = 0;
const fails = [];
const ok = (what, cond) => { if (cond) { pass++; console.log('  ✓ ' + what); } else { fails.push(what); } };

console.log('\n══ a panel can always be closed ══');

/**
 * ⚠️ THE WINDOW HAS TO COVER THE WHOLE FUNCTION. It was 6000 characters, and minimise sits at 8585 and the
 * Escape handler at 9933 — so two checks read a slice that stopped before the code they were asserting and
 * reported it missing. ⭐ A reader that measures the wrong region fails the same way whether the code is there
 * or not, which is the least useful red there is: it is checked below rather than assumed.
 */
const mvStart = src.indexOf('function makeMovable');
const mv = src.slice(mvStart, mvStart + 14000);
if (mv.indexOf('function fitBody') < 0 || mv.indexOf("e.key !== 'Escape'") < 0) {
  console.error('  x the reader window no longer spans makeMovable — widen it before trusting any result below.');
  process.exit(1);
}
if (!mv || mv.length < 500) {
  console.error('  x makeMovable is gone or has moved — this guard is measuring nothing. Fix the reader first.');
  process.exit(1);
}

const clamp = mv.slice(mv.indexOf('function clampIntoView'), mv.indexOf('function fitBody'));

ok('the SIZE is clamped, not only the position — the whole of this bug',
   /panel\.style\.width\s*=\s*Math\.max\(minW/.test(clamp) && /Math\.min\(w,\s*window\.innerWidth|Math\.min\(w,\s*vw/.test(clamp));

ok('the height is clamped too — a panel taller than the screen hides its own footer',
   /panel\.style\.height\s*=\s*Math\.max\(minH/.test(clamp));

/* ⚠️ ORDER MATTERS AND IS EASY TO LOSE IN A TIDY-UP: clamping a position against a width that is still too big
   simply pins it to the corner again, which is the broken state, arrived at more slowly. */
ok('the size is clamped BEFORE the position',
   clamp.indexOf('panel.style.width') < clamp.indexOf('panel.style.left'));

/* The trap needs no dragging at all: open a laptop after working on a monitor and the saved geometry is already
   too big for the screen it is being restored onto. */
ok('it re-clamps when the WINDOW changes, not only when the panel is dragged',
   /addEventListener\('resize'[\s\S]{0,220}clampIntoView\(\)/.test(mv));

ok('…and that listener is debounced — a resize fires continuously while a window is dragged',
   /clearTimeout\(_mvT\)[\s\S]{0,120}setTimeout/.test(mv));

/* ⭐ The last-resort escape: minimise lives at the LEFT of the header, so it survives exactly the failure that
   takes the right-hand controls away. If it ever moves to the right, this trap has no exit again. */
const testing = path.join(__dirname, '..', 'public', 'app', 'cap-testing.js');
if (fs.existsSync(testing)) {
  const t = fs.readFileSync(testing, 'utf8');
  /**
   * ⚠️ THIS ASSERTED `minimise: true` — makeMovable's own button, pinned top-LEFT. Athi, 2026-09-12: *"the
   * minimise, close etc always on the right hand side"* and *"follow the industry standard, do not invent
   * anything."* So the panel draws its own beside its own close, and this moves with it rather than being
   * deleted: what must stay true is that a minimise EXISTS and is wired to the one collapse implementation.
   */
  ok('the panel draws its own minimise, beside its close, on the right',
     t.indexOf('onclick="testMinimise()"') >= 0
     && t.indexOf('function testMinimise') >= 0
     && t.indexOf('minimise: false') >= 0);
  ok('…and it calls the ONE collapse, rather than a second one that would disagree about the saved width',
     t.indexOf('_mv.toggleMin') >= 0);
  ok('the whole header drags — no grip to aim at, which is what every title bar does',
     t.indexOf("dragOn: '#cbtesthead'") >= 0);
  ok('and it can be opened in its own window, so it need not cover the app at all',
     /function testPopOut/.test(t) && /testing\.html/.test(t));
}

/* ⭐⭐ THE TWO THAT MATTER MOST, because both were reached for in the trap and neither worked. */
/* ⚠️ plain string checks: what is asserted is literal source text, and a regex only adds a way to be wrong
   about it — twice already today a backslash was eaten between here and the file. */
ok('minimise shrinks the WIDTH too — collapsing only the height leaves the controls off-screen',
   mv.indexOf('panel.style.width = Math.min(260') >= 0);
ok('Escape rescues the panel — an escape with no position cannot be pushed off the edge',
   mv.indexOf("e.key !== 'Escape'") >= 0 && mv.indexOf('clampIntoView(); save();') >= 0);

fails.forEach((f) => console.error('  ✗ ' + f));
if (!fails.length) console.log('\n  ' + pass + ' passed\n');
process.exit(fails.length ? 1 : 0);
