// theme-contrast.spec.js — EVERY THEME, EVERY SCREEN, CHECKED BY MACHINE.
//
// Athi, 2026-08-17: *"interms of maintenance, is it kind of tabled and easily done or everytime we have to test
// for all colors? it has to be done in a way easy to maintain."*
//
// Adding a theme IS a table entry — eight lines in THEMES. What was NOT maintainable is that ~1,500 colours are
// still hardcoded where no theme can reach them, so a new theme could look right on the two screens someone
// happened to open and be unreadable on the ninth. That is not a thing a person can hold in their head, and
// "test all the colours by hand" is not a plan.
//
// ⭐ SO THE MACHINE DOES IT. This walks every theme across every main screen, computes the real contrast ratio of
// every piece of text against the background actually behind it, and fails with a list. Adding a theme now costs
// one table entry and one test run — and the test, not a person, decides whether it is finished.
//
// ⚠️ THE THRESHOLD IS DELIBERATELY LENIENT (3:1). WCAG AA wants 4.5:1 for body text, and this app does not clear
// that everywhere even in its default theme — so failing at 4.5 would report the EXISTING design rather than the
// theme, and a test that always fails teaches people to ignore it. 3:1 catches "cannot read this", which is the
// thing a broken theme actually does. The gap between 3 and 4.5 is a separate, deliberate piece of work.
//
// ⚠️ IT COMPARES EACH THEME TO THE DEFAULT, not to an absolute bar. A theme is judged on whether IT introduced a
// failure — that is the question when adding one — so the baseline is whatever Cream already scores.

const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');

const SCREENS = ['task', 'order', 'suppliers', 'catalogue', 'catsetup', 'mis'];

/* Contrast maths, run inside the page. Walks up for the real background, because a transparent element sits on
   whatever is behind it — comparing against `transparent` is how these checks quietly pass on everything. */
const AUDIT = `(() => {
  const lum = (c) => { const m = /rgba?\\((\\d+), (\\d+), (\\d+)/.exec(c); if (!m) return null;
    const v = [+m[1],+m[2],+m[3]].map(x => { x/=255; return x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4); });
    return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2]; };
  /* ⚠️ ALPHA MUST BE COMPOSITED, not treated as its own colour. A translucent white pill over the dark navy
     topbar resolves to a MID tone that white text sits on happily — but read literally, rgba(255,255,255,.24)
     looks like near-white and every label on it is reported unreadable. Blend it over what is behind it. */
  const parse = (c) => { const m = /rgba?((d+),s*(d+),s*(d+)(?:,s*([d.]+))?/.exec(c);
    return m ? { r:+m[1], g:+m[2], b:+m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
  const over = (fg, bg) => ({ r: fg.r*fg.a + bg.r*(1-fg.a), g: fg.g*fg.a + bg.g*(1-fg.a), b: fg.b*fg.a + bg.b*(1-fg.a), a: 1 });
  const bgOf = (el) => {
    const stack = []; let n = el, g = 0;
    while (n && n !== document.documentElement && g++ < 40) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; }
      n = n.parentElement;
    }
    let base = parse(getComputedStyle(document.body).backgroundColor) || { r:255,g:255,b:255,a:1 };
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return 'rgb(' + Math.round(base.r) + ', ' + Math.round(base.g) + ', ' + Math.round(base.b) + ')';
  };
  const out = [];
  /* ⚠️⚠️ TEXT NODES, NOT LEAF ELEMENTS — and this is the bug that made an earlier version of this test USELESS.
     Skipping any element with children means a row whose text sits inside nested spans is never checked at all.
     It reported 40 of 42 combinations clean while the catalogue screen had category chips at 1.63:1 — dark text
     on a dark chip, plainly invisible to anyone looking at it. A test that returns green on a broken screen is
     worse than no test, because it stops you looking. */
  const w = document.createTreeWalker(document.querySelector('.shell'), NodeFilter.SHOW_TEXT);
  let node;
  while ((node = w.nextNode())) {
    const s = (node.nodeValue || '').trim();
    if (!s) continue;
    const el = node.parentElement;
    if (!el || el.closest('.moderibbon')) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const f = lum(cs.color), b = lum(bgOf(el));
    if (f === null || b === null) continue;
    const r = (Math.max(f,b) + 0.05) / (Math.min(f,b) + 0.05);
    if (r < 3) out.push({ sel: (el.className || el.tagName).toString().slice(0, 40), fg: cs.color, bg: bgOf(el), r: +r.toFixed(2) });
  }
  return out;
})()`;

test.describe('Theme contrast · every theme, every screen', () => {
  test.describe.configure({ timeout: 180_000 });

  test('[THEME-01] no theme makes text unreadable that the default theme does not', async ({ page }) => {
    await mintEntity(page);
    const themes = await page.evaluate(() => Object.keys(window.THEMES || {}));
    expect(themes.length, 'THEMES must be readable from the page').toBeGreaterThan(1);

    // Baseline: whatever the DEFAULT theme already scores, per screen. A theme is judged against this.
    const base = {};
    await page.evaluate(() => window.themeApply('cream'));
    for (const s of SCREENS) {
      await page.evaluate((n) => window.navTo(n), s);
      await page.waitForTimeout(500);
      base[s] = (await page.evaluate(AUDIT)).length;
    }

    const regressions = [];
    for (const th of themes) {
      if (th === 'cream') continue;
      await page.evaluate((t) => window.themeApply(t), th);
      for (const s of SCREENS) {
        await page.evaluate((n) => window.navTo(n), s);
        await page.waitForTimeout(500);
        const bad = await page.evaluate(AUDIT);
        if (bad.length > base[s]) {
          regressions.push(`${th} / ${s}: ${bad.length} unreadable vs ${base[s]} in the default` +
            ` — e.g. ${bad.slice(0, 3).map((b) => `${b.sel} ${b.fg} on ${b.bg} = ${b.r}:1`).join(' ; ')}`);
        }
      }
    }
    await page.evaluate(() => window.themeApply('cream'));

    expect(regressions, 'a theme must not introduce unreadable text:\n' + regressions.join('\n')).toEqual([]);
  });
});
