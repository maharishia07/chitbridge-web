'use strict';
// @type: walk
/**
 * walk-ui-standard.cjs — the UI standard page (public/ui-standard.html, APP002) in a real browser.
 *
 * Proves: the page loads with no sign-in and makes NO request except its own static files (no api, no third party); every component
 * (CMP001..CMP010) renders with its code chip and fcode; the six states draw; a language switch (ta, ar) changes the labels, the
 * accessible names and an OPEN dialog in place, and Arabic turns the page right-to-left; the commit confirm shows its reach (amount +
 * currency, recipients, count) before anything is sent; the 24 px overlay marks the too-small preset red; and, in light AND dark at
 * 1366x768 and 390x844, nothing scrolls the page and nothing scrolls sideways.
 * Needs playwright (NODE_PATH). Run on an Oracle box in the Playwright container, never on the laptop (load rule).
 * Run: NODE_PATH=<dir with playwright> node e2e/walk-ui-standard.cjs [outDir]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const PUB = path.join(__dirname, '..', 'public');
const OUT = process.argv[2] || path.join(__dirname, '..', 'out', 'ui-standard');
fs.mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (ok, message) => { console.log((ok ? '  ok ' : '  FAIL ') + message); if (!ok) failures++; };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.css': 'text/css', '.json': 'application/json' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(PUB, decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('no'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(server));
  });
}
const press = (page, group, value) => page.click('[data-testid="gal-' + group + '-' + value + '"]');
const noScroll = (page) => page.evaluate(() => {
  const panel = document.getElementById('panel');
  return { page: document.documentElement.scrollHeight - innerHeight, pageX: document.documentElement.scrollWidth - innerWidth, panelX: panel.scrollWidth - panel.clientWidth };
});

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  const stray = [], errors = [];
  for (const [label, size] of [['1366', { width: 1366, height: 650 }], ['390', { width: 390, height: 740 }]]) {
    const context = await browser.newContext({ viewport: size, locale: 'en-US' });
    /* a session that happens to exist must be ignored: plant one */
    await context.addInitScript(() => { try { localStorage.setItem('cb_sess', JSON.stringify({ token: 'SHOULD-NOT-BE-READ' })); localStorage.setItem('cb_lang', 'fr'); } catch (_) {} });
    const page = await context.newPage();
    page.on('request', (request) => { if (!request.url().startsWith(base) || /\/api\//.test(request.url())) stray.push(request.url()); });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(base + '/ui-standard.html');
    await page.waitForSelector('[data-testid="gal-row-CMP001-preference"]');
    console.log('viewport ' + label);

    const codes = await page.$$eval('[data-testid="gal-code"]', (nodes) => nodes.map((node) => node.textContent));
    for (let n = 1; n <= 10; n++) check(codes.indexOf('CMP' + String(n).padStart(3, '0')) >= 0, 'CMP' + String(n).padStart(3, '0') + ' renders with its code chip');
    check((await page.$$eval('[data-testid="gal-fcode"]', (nodes) => nodes.length)) >= 10, 'every row shows its fcode');
    check(await page.evaluate(() => document.documentElement.lang === 'en'), 'the planted cb_lang=fr is ignored: the page starts in English');
    const states = await page.$$eval('[data-testid="gal-row-CMP001-preference"] button', (nodes) => nodes.map((node) => [node.getAttribute('data-demo'), node.disabled, node.getAttribute('aria-busy')]));
    check(states.length === 6 && states.some((s) => s[1]) && states.some((s) => s[2] === 'true') && states.filter((s) => s[0]).length === 3, 'six states: default, hover, focus, pressed (static), disabled, busy');
    const idsOk = await page.$$eval('#content button', (nodes) => nodes.every((node) => node.getAttribute('data-cbsid') && node.getAttribute('data-cbmount')));
    check(idsOk, 'every component button carries its element code and its mount');
    const headIds = await page.$$eval('#hdr button', (nodes) => nodes.every((node) => /^APP002-B\d\d$/.test(node.getAttribute('data-cbsid'))));
    check(headIds, 'every page control carries APP002-Bnn');

    for (const theme of ['light', 'dark']) {
      await press(page, 'theme', theme);
      for (const tab of ['components', 'popups', 'icons', 'tokens', 'before']) {
        await page.click('[data-testid="gal-tab-' + tab + '"]');
        const scroll = await noScroll(page);
        check(scroll.page <= 0 && scroll.pageX <= 0 && scroll.panelX <= 0, label + ' ' + theme + ' ' + tab + ': page does not scroll, nothing scrolls sideways ' + JSON.stringify(scroll));
        await page.screenshot({ path: path.join(OUT, label + '-' + theme + '-en-' + tab + '.png') });
      }
    }
    await press(page, 'theme', 'light');
    await page.click('[data-testid="gal-tab-tokens"]');
    check((await page.$$eval('[data-testid="gal-token"]', (nodes) => nodes.length)) >= 8, 'tokens are read live: a row per custom property');
    const measure = await page.textContent('[data-testid="gal-measure"]');
    check(/×44 px/.test(measure) && /AA/.test(measure), 'measured on the real button: ' + measure.replace(/\s+/g, ' ').slice(0, 90));

    /* the size toggle moves the token and the real button follows */
    await press(page, 'size', 'large');
    const largeHeight = await page.$eval('[data-testid="gal-measure-primary"]', (node) => Math.round(node.getBoundingClientRect().height));
    check(largeHeight === 56, 'Size: large sets --act-h and the real Done button is 56 px high (' + largeHeight + ')');
    await press(page, 'size', 'small');
    await press(page, 'overlay', 'on');
    await page.click('[data-testid="gal-tab-components"]');
    check((await page.$$eval('[data-testid="gal-target-bad"]', (nodes) => nodes.length)) > 0, '24 px overlay marks the too-small preset red');
    await page.screenshot({ path: path.join(OUT, label + '-light-en-overlay-small.png') });
    await press(page, 'size', 'standard');
    check((await page.$$eval('[data-testid="gal-target-bad"]', (nodes) => nodes.length)) === 0, '24 px overlay: no control below 24 px at the standard size');
    await press(page, 'overlay', 'off');

    /* the language switch repaints in place */
    const before = await page.textContent('[data-testid="gal-row-CMP003"] .st .slot button');
    const nameBefore = await page.getAttribute('[data-testid="gal-CMP003-std-default"]', 'aria-label');
    await press(page, 'lang', 'ta');
    const afterTa = await page.textContent('[data-testid="gal-row-CMP003"] .st .slot button');
    check(before === 'Cancel' && afterTa !== before && /[஀-௿]/.test(afterTa), 'Tamil: Cancel repaints in place (' + afterTa + ')');
    check((await page.getAttribute('[data-testid="gal-CMP003-std-default"]', 'aria-label')) !== nameBefore, 'Tamil: the accessible name (aria-label) repaints too');
    await page.screenshot({ path: path.join(OUT, label + '-light-ta-components.png') });
    await press(page, 'lang', 'ar');
    check(await page.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'ar'), 'Arabic: the page turns right-to-left');
    await page.screenshot({ path: path.join(OUT, label + '-light-ar-components.png') });
    check((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, 'Arabic: no sideways page scroll');
    await press(page, 'lang', 'fr');
    check(/Annuler/.test(await page.textContent('[data-testid="gal-row-CMP003"] .st .slot button')), 'French: Annuler');
    await press(page, 'lang', 'en');

    /* an OPEN dialog repaints in place when the language changes */
    await page.click('[data-testid="gal-open-dialog"]');
    await page.waitForSelector('[data-testid="gal-mover"]');
    const dialogEn = await page.textContent('.mhd .t');
    await page.screenshot({ path: path.join(OUT, label + '-light-en-dialog.png') });
    await press(page, 'lang', 'ta');
    const dialogTa = await page.textContent('.mhd .t');
    check(dialogEn === 'Example dialog' && dialogTa !== dialogEn, 'the open dialog repaints in Tamil without a reload (' + dialogTa + ')');
    await page.screenshot({ path: path.join(OUT, label + '-light-ta-dialog.png') });
    await press(page, 'lang', 'ar');
    await page.screenshot({ path: path.join(OUT, label + '-light-ar-dialog.png') });
    await page.keyboard.press('Escape');
    check((await page.$$('[data-testid="gal-mover"]')).length === 0, 'Escape closes the dialog');
    await press(page, 'lang', 'en');

    /* the commit confirm shows its reach BEFORE anything is sent, and Cancel sends nothing */
    await page.click('[data-testid="gal-tab-popups"]');
    await page.click('[data-testid="gal-open-commit"]');
    await page.waitForSelector('#cb_confirm');
    const ask = await page.textContent('#cb_confirm');
    check(/1,180\.00/.test(ask) && /INR/.test(ask) && /3 recipients/.test(ask) && /Asha Traders/.test(ask), 'commit confirm shows amount + currency, recipients and count: ' + ask.replace(/\s+/g, ' ').slice(0, 120));
    await page.screenshot({ path: path.join(OUT, label + '-light-en-commit-confirm.png') });
    await page.click('[data-testid="confirm-cancel"]');
    check((await page.$$('#toast .toast')).length === 0, 'Cancel sends nothing (no Done toast)');
    await page.click('[data-testid="gal-open-commit"]');
    await page.waitForSelector('#cb_confirm');
    await page.click('[data-testid="confirm-ok"]');
    await page.waitForSelector('#toast .toast');
    check(true, 'Confirm runs the mock press (toast Done): no request left the page');

    check(await page.evaluate(() => !JSON.stringify(localStorage).includes('cb_lang":"en') && localStorage.getItem('cb_lang') === 'fr' && localStorage.getItem('cb_sess').includes('SHOULD-NOT')), 'the page wrote nothing to storage and left the visitor\'s own keys alone');
    await context.close();
  }
  /* the Mobile frame on a desktop viewport */
  const context = await browser.newContext({ viewport: { width: 1366, height: 650 } });
  const page = await context.newPage();
  await page.goto(base + '/ui-standard.html');
  await press(page, 'screen', 'mobile');
  const frame = await page.$eval('#frame', (node) => [node.offsetWidth, node.offsetHeight]);
  check(frame[0] === 390 && frame[1] === 844, 'Screen: Mobile draws a 390x844 frame (' + frame.join('x') + ')');
  await page.screenshot({ path: path.join(OUT, '1366-light-en-mobile-frame.png') });
  await press(page, 'screen', 'desktop');
  await page.screenshot({ path: path.join(OUT, '1366-light-en-desktop-frame.png') });
  await context.close();
  await browser.close();
  server.close();
  check(stray.length === 0, 'no request left the page except its own static files ' + JSON.stringify(stray.slice(0, 3)));
  check(errors.length === 0, 'no page error or console error ' + JSON.stringify(errors.slice(0, 3)));
  console.log(failures ? failures + ' FAILED' : 'all ok');
  process.exit(failures ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(2); });
