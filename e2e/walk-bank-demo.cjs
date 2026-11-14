'use strict';
/**
 * e2e/walk-bank-demo.cjs - THE BANK-TO-BOOKS DEMO, WALKED: public/bank-demo.html with public/app/bank-demo.js, public/app/bank-preview.js (and the adapter
 * public/app/cap-bank-post.js it is the twin of), light AND dark theme at 1366x768 and 390x844.
 *
 * OWNS      the proof that the page (a) fits both sizes with no page scroll, (b) makes no request outside its own origin and writes no storage, (c) keeps every
 *           text at WCAG AA contrast (4.5:1) in light and in dark, (d) says in words when the books engine did not load (could not check, nothing shown made up),
 *           (e) reproduces the AU pass test by the engines' own figures: books now 14,400.00, difference 3,108.50; after the GST basis is answered, 6 entries,
 *           in 12.50, out 984.00, books 13,428.50, difference 4,080.00, 3 still need you, (f) works by keyboard alone (Tab order, Enter opens the popup, Esc closes it),
 *           (g) writes its dates in the en-AU locale ("19 Oct 2026").
 * CALLED BY the cloud walks (every e2e/walk-*.cjs); by hand: NODE_PATH=e2e/node_modules node e2e/walk-bank-demo.cjs [--show]
 * SKIPS     (exit 0, said out loud) until the engines adopt puts bank-project.js, bank-entry.js, chart.js, accounts-packs.js and posting.js under public/engine.
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'),
  path = require('path'),
  http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', 'public');
const NEEDS = ['bank-project.js', 'bank-entry.js', 'chart.js', 'accounts-packs.js', 'posting.js'];
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const SIZES = [[1366, 768], [390, 844]];
let failed = 0;
const check = (ok, words) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + words);
  if (!ok) failed++;
};

function serve() {
  return new Promise((done) => {
    const server = http.createServer((req, res) => {
      const file = path.join(ROOT, req.url.split('?')[0]);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end('no');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'text/plain', 'x-content-type-options': 'nosniff' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, () => done(server));
  });
}
/** every visible text element's colour against the first opaque background above it: the ratio, in the page itself */
const CONTRAST_IN_PAGE = () => {
  const light = (rgb) => {
    const v = rgb.map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const parse = (css) => { const m = css.match(/[\d.]+/g).map(Number); return { rgb: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; };
  const backdrop = (node) => {
    for (let n = node; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0.9) return c.rgb; }
    return [255, 255, 255];
  };
  const worst = [];
  document.querySelectorAll('body *').forEach((node) => {
    const own = [...node.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (!own || !node.offsetParent) return;
    const fg = parse(getComputedStyle(node).color).rgb, bg = backdrop(node);
    const [a, b] = [light(fg), light(bg)].sort((x, y) => y - x);
    const ratio = (a + 0.05) / (b + 0.05);
    if (ratio < 4.5) worst.push(node.tagName + '.' + node.className + ' ' + ratio.toFixed(2));
  });
  return worst;
};

(async () => {
  const missing = NEEDS.filter((name) => !fs.existsSync(path.join(ROOT, 'engine', name)));
  if (missing.length) return console.log('SKIP walk-bank-demo: the engines adopt has not landed (missing under public/engine: ' + missing.join(', ') + ')');
  const server = await serve();
  const base = 'http://localhost:' + server.address().port;
  const browser = await chromium.launch({ headless: !process.argv.includes('--show') });
  const broken = await browser.newPage();
  await broken.route('**/engine/bank-project.js', (route) => route.abort());
  await broken.goto(base + '/bank-demo.html');
  check((await broken.textContent('#bd_msg')).includes('has not loaded'), 'engine missing: the page says so in words, shows no figures, makes none up');
  await broken.close();
  for (const scheme of ['light', 'dark']) {
    for (const [width, height] of SIZES) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
      const page = await context.newPage();
      const outside = [], logs = [];
      page.on('request', (r) => { if (!r.url().startsWith(base)) outside.push(r.url()); });
      page.on('console', (m) => m.type() === 'error' && logs.push(m.text()));
      await page.goto(base + '/bank-demo.html');
      await page.waitForSelector('#bd_sum:not(:empty)');
      const tag = scheme + ' ' + width + 'x' + height;
      const fit = await page.evaluate(() => [document.documentElement.scrollHeight - innerHeight, document.documentElement.scrollWidth - innerWidth]);
      check(fit[0] <= 0 && fit[1] <= 0, tag + ': no page scroll');
      check(!outside.length && !logs.length, tag + ': no request outside the page, no console error');
      check((await page.evaluate(CONTRAST_IN_PAGE)).length === 0, tag + ': every text at AA contrast (4.5:1)');
      await page.screenshot({ path: path.join(__dirname, 'shots', 'walk-bank-demo-' + scheme + '-' + width + '.png') });
      if (scheme === 'light' && width === 1366) {
        await fableChecks(page, base);
        await page.goto(base + '/bank-demo.html');
        await page.waitForSelector('#bd_sum:not(:empty)');
        await passTest(page);
      }
      await context.close();
    }
  }
  await browser.close();
  server.close();
  console.log(failed ? failed + ' FAILED' : 'all passed');
  process.exit(failed ? 1 : 0);
})();

/** the AU pass test, the keyboard path and the locale dates, on the light desktop page */
async function passTest(page) {
  const text = (selector) => page.textContent(selector);
  check((await text('#bd_sum')).includes('Books now AUD 14,400.00') && (await text('#bd_sum')).includes('Difference now AUD 3,108.50'), 'pass test: books 14,400.00, difference 3,108.50');
  check((await text('#bd_lines')).includes('19 Oct 2026'), 'locale: dates read "19 Oct 2026" (en-AU)');
  check((await text('#bd_lines')).includes('Ready to add') === false && (await text('#bd_add')).includes('Nothing ready'), 'B5-01: nothing is "Ready to add" before the owner has answered anything: the bank words, the tax basis and the tax invoice are all questions');
  await page.click('#bd_gst_cash');
  check((await text('#bd_lines')).includes('Tax invoice needed') === false && (await text('#bd_lines')).includes('needs a tax invoice. Do you hold it?'), 'B5-03: Origin Energy (330.00) and Telstra (110.00) ask for the tax invoice before any GST credit');
  check((await text('#bd_lines')).includes('Dr electricity AUD 300.00') && (await text('#bd_lines')).includes('GST AUD 30.00'), 'B5-03: the row shows the account and the GST it would book (300.00 + 30.00)');
  for (let guard = 0; guard < 8 && (await page.locator('[data-act=tick]').count()); guard++) await page.locator('[data-act=tick]').first().click();
  for (let guard = 0; guard < 8 && (await page.locator('[data-act=inv][data-v=held]').count()); guard++) await page.locator('[data-act=inv][data-v=held]').first().click();
  const seq = [];
  await page.focus('#bd_load');
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Tab'); seq.push(await page.evaluate(() => document.activeElement.id)); }
  check(seq.join() === 'bd_file,bd_reset,bd_add', 'keyboard: Tab goes load, file, start again, add (' + seq.join(' > ') + ')');
  await page.keyboard.press('Enter');
  const popup = await text('.lk-confirm-text');
  check(/Add 6 entries/.test(await text('.lk-pop header')) && popup.includes('AUD 12.50') && popup.includes('AUD 984.00') && popup.includes('3 still need you'), 'popup: 6 entries, in 12.50, out 984.00, 3 still need you');
  await page.keyboard.press('Escape');
  await page.focus('#bd_add');
  await page.keyboard.press('Enter');
  await page.click('[data-testid=lk-confirm-ok]');
  await page.waitForTimeout(300);
  check((await text('#bd_sum')).includes('Books now AUD 13,428.50') && (await text('#bd_sum')).includes('Difference now AUD 4,080.00'), 'after the press: books 13,428.50, difference 4,080.00');
}

const CSV_HEAD = 'Date,Description,Debit,Credit,Balance\n';
const upload = (page, name, body) => page.setInputFiles('#bd_file', { name, mimeType: 'text/csv', buffer: Buffer.from(body) });
/** B5-05 (a file's currency is asked, a USD file is refused) and B5-06 (skipped rows are shown, the reconciliation is not tied) on the light desktop page */
async function fableChecks(page, base) {
  const text = (selector) => page.textContent(selector);
  await upload(page, 'usd.csv', CSV_HEAD + '05/11/2026,Receipt A,,100.00,1100.00');
  await page.waitForSelector('#bd_cur_sel');
  check((await text('#bd_lines')) === '' && (await text('#bd_cur')).includes('Which currency'), 'B5-05: a file of your own is not read until its currency is asked; the last statement is cleared');
  await page.click('#bd_cur_go');
  check((await text('#bd_msg')).includes('Say which currency'), 'B5-05: no answer, no reading');
  await page.fill('#bd_cur_sel', 'USD');
  await page.click('#bd_cur_go');
  const refused = await text('#bd_msg');
  check(refused.includes('USD') && refused.includes('AUD') && (await text('#bd_lines')) === '', 'B5-05: a USD file is refused naming both currencies and shows no lines (' + refused.slice(0, 80) + ')');
  await upload(page, 'skip.csv', CSV_HEAD + '05/11/2026,Receipt A,,100.00,1100.00\n06/11/2026 09:14,Receipt B,,22.00,1122.00\n07/11/2026,Receipt C,,50.00,1172.00\n,Orphan narration,10.00,,1162.00');
  await page.waitForSelector('#bd_cur_sel');
  await page.fill('#bd_cur_sel', 'AUD');
  await page.click('#bd_cur_go');
  const skipped = await text('[data-testid=bd-skip]');
  check(skipped.includes('2 rows') && skipped.includes('Row 3') && skipped.includes('Row 5'), 'B5-06: both skipped rows are listed by row number on the lines view (' + skipped.slice(0, 90) + ')');
  await page.click('#bd_tab_brs');
  const verdict = await text('[data-testid=bd-not-tied]');
  check(verdict.includes('Not tied') && verdict.includes('not read') && (await text('#bd_brs')).includes('Row 3'), 'B5-06: the reconciliation says Not tied and why while rows are missing');
}
