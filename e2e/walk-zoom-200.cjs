'use strict';
// @type: walk
/**
 * walk-zoom-200.cjs — WCAG 1.4.4 (resize text to 200%) on the shared screens: text at 200% loses no content and no function.
 * Browser zoom to 200% on a 1280x720 window is a 640x360 CSS-pixel viewport at 2x, so the page is rendered at 640x360 (the layout the browser
 * really builds) and the text size is also set to the largest of ours (--k 1.32). On each page: nothing scrolls sideways, no visible button/link/input is
 * clipped by its own box (scrollWidth > clientWidth with overflow hidden), and every visible control is still inside the window's width.
 * Pages: public/ui-standard.html (the action set + dialogs) and public/list-lab.html (the list control), served by this file, no api.
 * Needs playwright (NODE_PATH). Run on a SIT box in the Playwright container, never on the laptop.  Run: NODE_PATH=<dir> node e2e/walk-zoom-200.cjs [outDir]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const PUB = path.join(__dirname, '..', 'public');
const OUT = process.argv[2] || path.join(__dirname, '..', 'out', 'zoom-200'); fs.mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (ok, m) => { console.log((ok ? '  ok ' : '  FAIL ') + m); if (!ok) failures++; };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.css': 'text/css', '.json': 'application/json' };
const serve = () => new Promise((r) => { const s = http.createServer((q, p) => { const f = path.join(PUB, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { p.writeHead(404); p.end('no'); return; }
  p.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(p); }).listen(0, '127.0.0.1', () => r(s)); });
(async () => {
  const server = await serve(), base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  for (const pg of ['ui-standard.html', 'list-lab.html']) {
    for (const k of [1, 1.32]) {
      const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.addInitScript((kk) => { try { localStorage.setItem('cb_fs', kk >= 1.3 ? 'xl' : 'm'); } catch (e) { /* none */ } }, k);
      await page.goto(base + '/' + pg); await page.waitForTimeout(800);
      const r = await page.evaluate(() => {
        const de = document.documentElement, W = de.clientWidth;
        const sideways = Math.max(de.scrollWidth, document.body.scrollWidth) - W;
        const clipped = [], outside = [];
        document.querySelectorAll('button, a[href], input, select, textarea, [role=button]').forEach((el) => {
          const b = el.getBoundingClientRect(); if (!b.width || !b.height || getComputedStyle(el).visibility === 'hidden') return;
          let inScroller = false; for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) inScroller = true; }
          const cs = getComputedStyle(el), id = el.getAttribute('data-testid') || el.id || el.tagName;
          if (/hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && el.textContent.trim()) clipped.push(id);
          if (!inScroller && (b.right > W + 1 || b.left < -1)) outside.push(id);
        });
        return { sideways, clipped: clipped.slice(0, 5), outside: outside.slice(0, 5), nclip: clipped.length, nout: outside.length };
      });
      check(r.sideways <= 1, pg + ' @200% text k=' + k + ': no sideways scroll (' + r.sideways + ' px over)');
      check(r.nclip === 0, pg + ' @200% k=' + k + ': no control clips its own text (' + r.nclip + ' ' + r.clipped.join(',') + ')');
      check(r.nout === 0, pg + ' @200% k=' + k + ': every control inside the window width (' + r.nout + ' ' + r.outside.join(',') + ')');
      await page.screenshot({ path: path.join(OUT, pg.replace('.html', '') + '-k' + k + '.png') });
      await ctx.close();
    }
  }
  await browser.close(); server.close();
  console.log(failures ? 'FAIL ' + failures : 'PASS zoom-200'); process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
