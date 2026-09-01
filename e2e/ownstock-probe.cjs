/**
 * ownstock-probe.cjs — WATCH the own-stock cycle instead of reading it.
 *
 * Athi, observation-3: *"When I call our own stock, the entire cycle not completing. It has to create a self
 * chit, but hangs."* Two claims in one sentence — it does not finish, AND it hangs — and they want different
 * fixes. So this drives the real screen and reports what is on it at each step.
 *
 * ⚠️⚠️ IT DRIVES THE DOM, NEVER `window.UI`. The first version of this probe read window.UI and reported
 * "no cart · no flow · items 0" while the screen plainly held four products and a live footer. Top-level `let`
 * and `const` live in the global LEXICAL environment and are NOT properties of window, so every one of those
 * reads was `undefined` dressed up as a finding. A probe that reports a false negative is worse than no probe:
 * it argues for a bug that is not there.
 *
 * Run: node e2e/ownstock-probe.cjs
 */
'use strict';
const { chromium } = require('@playwright/test');
const path = require('path');

const BASE = process.env.CB_WEB_BASE || 'http://localhost:5173';
const STATE = path.join(__dirname, '.auth', 'user.json');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  const calls = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  page.on('request', (r) => { if (r.method() !== 'GET') calls.push(r.method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '')); });

  const say = (s) => console.log('  ' + s);
  const txt = async (sel) => (await page.locator(sel).first().innerText().catch(() => '(absent)')).replace(/\s+/g, ' ').slice(0, 200);

  await page.goto(BASE + '/app.html');
  await page.waitForTimeout(4000);
  await page.evaluate(() => navTo('suppliers'));
  await page.waitForTimeout(2500);

  say('-> our own stock');
  await page.evaluate(() => selectSupplier('own'));
  await page.waitForTimeout(4000);
  say('body: ' + await txt('#sup_body'));
  say('foot: ' + await txt('#sup_foot'));

  /* Add the first line the way a person does - the + on the row. */
  const plus = page.locator('#sup_body button', { hasText: /^\+$/ }).first();
  say('-> add the first line  (' + (await page.locator('#sup_body button').count()) + ' buttons in the list)');
  const onclicks = await page.evaluate(() => Array.from(document.querySelectorAll('#sup_body button'))
    .map((b) => (b.getAttribute('onclick') || '(no onclick)') + '   [' + b.textContent.trim().slice(0,3) + ']'));
  onclicks.slice(0, 4).forEach((o) => say('   btn: ' + o));
  const diag = await page.evaluate(() => {
    const r = { defs: null, first: null, decl: null };
    try { const d = cbDefsCached('ordermodel'); r.defs = d ? d.length + ' cached' : 'NOT CACHED'; } catch (e) { r.defs = 'threw ' + e.message; }
    try { const c = STORE.catalogue || []; r.first = c[0] ? JSON.stringify(c[0].order || '(no order field)') : '(empty catalogue)'; } catch (e) { r.first = 'threw ' + e.message; }
    try { r.decl = JSON.stringify(cbOrderDecl((STORE.catalogue[0] || {}).order || {})); } catch (e) { r.decl = 'threw ' + e.message; }
    return r; });
  say('   defs:  ' + diag.defs);
  say('   order: ' + diag.first);
  say('   decl:  ' + diag.decl);
  await plus.click().catch((e) => say('click failed: ' + e.message.slice(0, 80)));
  await page.waitForTimeout(1200);
  say('foot: ' + await txt('#sup_foot'));
  say('body: ' + await txt('#sup_body'));
  say('bar:  ' + await txt('#cbcartbar_sup'));
  const direct = await page.evaluate(() => { try { CBCart.add('cbcart-1','own0'); return 'called'; } catch (e) { return 'threw: ' + e.message; } });
  say('direct add: ' + direct);
  await page.waitForTimeout(900);
  say('foot after direct: ' + await txt('#sup_foot'));

  const ns = await page.evaluate(() => { const el = document.querySelector('[data-testid^="stepfoot-"]');
    return el ? el.getAttribute('data-testid').replace('stepfoot-','') : '(no footer ns)'; });
  say('flow ns: ' + ns);
  say('-> Use these lines');
  const send = page.locator('#sup_foot button', { hasText: /Use these lines/ }).first();
  if (!(await send.count())) say('the terminal button is not on the footer');
  else { await send.click(); await page.waitForTimeout(4000); }

  const after = await page.evaluate(() => ({
    modal: !!document.querySelector('.mbody'),
    modalTitle: (document.querySelector('.mhd .t') || {}).innerText || '(none)',
    rail: (document.getElementById('cc_rail') || {}).innerText || '(no compose rail)',
    supBodyStill: !!document.getElementById('sup_body'),
  }));
  say('after: ' + JSON.stringify(after).replace(/\s+/g, ' ').slice(0, 320));
  /* The supplier review is where the missing symbol was reported - drive to it and read the amounts. */
  await page.evaluate(() => { const m = document.querySelector('.mbody'); if (m) { const x = document.querySelector('[data-testid^="modal-close"], .mhd .x'); if (x) x.click(); } });
  await page.waitForTimeout(800);
  say('writes: ' + (calls.length ? calls.join(' | ') : 'NONE - nothing was recorded'));
  if (errs.length) { console.log('\n  ERRORS'); errs.slice(0, 8).forEach((e) => console.log('    ' + e)); }
  else say('no page errors');

  await page.screenshot({ path: path.join(__dirname, 'ownstock-after.png') });
  say('shot: e2e/ownstock-after.png');
  await browser.close();
})();
