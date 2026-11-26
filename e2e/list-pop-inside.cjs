#!/usr/bin/env node
/* list-pop-inside.cjs — AT-05 (Athi, sit-au, 25 Nov): a list's popup (Filters, Columns, View, Period, Notes) is ALWAYS fully inside the window.
 * public/list-lab.html, every list, 1366×768 and 390×844, each popup opened with its button at the left, in the middle and pushed to the right edge
 * (the page is narrowed or shifted so the anchor sits near an edge, the way a toolbar does on a practice home). Assert: popup rect inside the viewport.
 * Run one at a time:  NODE_PATH=e2e/node_modules node e2e/list-pop-inside.cjs   (a headless browser, nothing leaves the laptop) */
'use strict';
const { chromium } = require('@playwright/test');
const { serve, PUBLIC } = require('./lib/serve.cjs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
(async () => {
  const web = await serve(PUBLIC), b = await chromium.launch({ channel: process.env.CBL_CHANNEL || 'chrome' });
  for (const [vw, vh] of [[1366, 768], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, serviceWorkers: 'block' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const p = await ctx.newPage();
    await p.goto(web.url('/list-lab.html'));
    await p.waitForSelector('.cbl .cbl-tbtn', { timeout: 15000 });
    const lists = await p.$$eval('[data-plist]', (n) => n.map((x) => x.getAttribute('data-plist')));
    for (const list of lists) {
      await p.click('[data-plist="' + list + '"]');
      await p.waitForSelector('.cbl .cbl-tbtn');
      for (const shift of ['none', 'right', 'left']) {
        for (const pop of ['filt', 'cols', 'view', 'period', 'notes']) {
          const sel = '.cbl [data-cbl-pop="' + pop + '"]';
          if (!(await p.$(sel)) || !(await p.isVisible(sel))) continue;
          /* push the toolbar's anchor to an edge: the host column is moved so the button sits near the left or right of the window */
          await p.evaluate((s) => { const a = document.querySelector('.cbl'); a.style.position = 'relative'; a.style.left = s === 'right' ? '40vw' : s === 'left' ? '-30vw' : '0'; }, shift);
          await p.click(sel, { force: true });
          await p.waitForTimeout(120);
          const r = await p.evaluate(() => {
            const n = document.querySelector('.cbl .cbl-pop'); if (!n) return null;
            const q = n.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, bt: q.bottom, w: innerWidth, h: innerHeight };
          });
          if (r) ok(r.l >= -0.5 && r.t >= -0.5 && r.r <= r.w + 0.5 && r.bt <= r.h + 0.5, vw + ' ' + list + ' ' + pop + ' shift:' + shift + ' ' + JSON.stringify(r));
          await p.keyboard.press('Escape'); await p.waitForTimeout(60);
        }
      }
    }
    await ctx.close();
  }
  await b.close(); web.close && web.close();
  console.log('\n' + pass + ' ok, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
