#!/usr/bin/env node
/**
 * e2e/chart-bar.cjs — THE CHART OPTIONS BAR, WALKED (chart engine step 2; REQ pass test 1 to 5 and 8; Athi 16 Nov).
 * Reports › Trend with a stand-in API (as e2e/reports-trend.cjs; the prefs door PATCH /api/entities/me/prefs/ui is a real merge-patch store here).
 *
 *   B1 Trend carries the bar: Colours, Chart type (Columns · Line), the star, Readability; each wears its UI code; Readability is OFF (vibrant is the default); "Follow my avatar theme" is chosen
 *   B2 a combination recolours the chart AT ONCE (the bars' fill is the combination's own hex, vibrant) and saves chart_theme: ONE key in the body, nothing else
 *   B3 Chart type Line: the same points as a line (12 dots, one path), figures and the table unchanged
 *   B4 the star saves chart_fav_series = "<combination>-<type>"; the star is pressed
 *   B5 "another device" (a fresh browser, only the server's ui_prefs): the favourite is applied, no click
 *   B6 Readability ON: the chart says data-read="on", the marks hold 3:1 against the page; OFF returns the chosen colours; saved as chart_read
 *   B7 the Colour Vision theme switches Readability on by itself; the person can switch it off
 *   B8 a page with no chart (Home) has no bar
 *   B9 keyboard only: Tab to Colours, ArrowDown picks, Tab to Chart type, Tab to the star, Space presses it, Tab to Readability, Space switches it
 *   B10 1366 x 768 and 390 x 844: the bar fits, one line where it can, no horizontal scroll; pictures saved
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/chart-bar.cjs
 */
'use strict';
const path = require('path');
const W = require('./lib/walk.cjs');
const C = require('./lib/contract.cjs');
const R = require(path.join(__dirname, '..', 'public', 'engine', 'rollup.js'));
const J = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = new Date('2026-10-17T10:00:00+10:00');
const FY_START = 7, CURRENCY = 'AUD';
const monthBack = (k) => new Date(Date.UTC(2026, 9 - k, 1)).toISOString().slice(0, 7);
const summary = (period, key, gross) => ({ period, key, till: { id: 'C1' }, totals: { count: 20, returns: 0, gross, refunds: 0, expenseCount: 0, expenses: 0, total: gross - 50, by: {} } });
const SUMMARIES = [];
for (let k = 1; k <= 14; k++) SUMMARIES.push(summary('month', monthBack(k), k === 1 ? 1100 : 1000));
const answerFor = (period) => ({ period, n: 12, currency: CURRENCY, fy_start_month: FY_START,
  slots: R.series(period, 12, SUMMARIES, { fyStart: FY_START, currency: CURRENCY, now: NOW.getTime() }), sales_from: 'summaries', sales_note: '' });
const OKABE_ACT = '#0072B2';

W.run('chart-bar', async (w) => {
  const { page, ctx, base } = w;
  const S = { prefs: {}, patches: [] };
  await ctx.route('**/api/**', async (raw) => {
    const route = C.wrap(raw), q = route.request(), u = new URL(q.url()), p = u.pathname;
    if (p === '/api/till/summary' && u.searchParams.get('compare') === '1') return J(route, 200, answerFor('month'));
    if (p === '/api/entities/me/prefs/ui' && q.method() === 'PATCH') {
      const body = q.postDataJSON(); S.patches.push(body);
      Object.keys(body).forEach((k) => { if (body[k] === '' || body[k] == null) delete S.prefs[k]; else S.prefs[k] = body[k]; });
      return J(route, 200, { ok: true, kind: 'ui', prefs: S.prefs, ui_prefs: S.prefs });
    }
    if (p === '/api/facts/till') return J(route, 200, { lines: [{ text: '12 bills', value: 12 }], figures: { counters_open: 1 } });
    if (p === '/api/entities/me') return J(route, 200, { entity: { display_name: 'Fixture Shop', currency_code: CURRENCY, country: 'AU', ui_prefs: S.prefs } });
    return J(route, 404, { error: 'not found' });
  });
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_sess')) { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); localStorage.setItem('cb_locale', 'en-AU'); } } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  await ctx.clock.setFixedTime(NOW);
  const open = async (url, wait) => { await page.goto('about:blank'); await page.goto(base + url); if (wait) await page.waitForSelector(wait, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(900); };
  const fills = () => page.evaluate(() => [...document.querySelectorAll('[data-testid^="tr-bar-"]')].map((e) => getComputedStyle(e).fill));
  const rgbOf = (hex) => { const h = hex.slice(1); return 'rgb(' + [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)).join(', ') + ')'; };
  const pick = async (testid, value) => { await page.selectOption('[data-testid="' + testid + '"]', value); await page.waitForTimeout(400); };

  await open('/finance.html#/reports/trend', '[data-testid="chart-bar"]');
  await w.step('B1', 'Reports › Trend carries the bar: Colours, Chart type, the star, Readability; each wears its UI code; Readability OFF, Follow my avatar theme chosen', async () => {
    const m = await page.evaluate(() => ({
      codes: ['chart-bar', 'chart-colours', 'chart-type', 'chart-fav', 'chart-read'].map((t) => (document.querySelector('[data-testid="' + t + '"]') || {}).getAttribute ? document.querySelector('[data-testid="' + t + '"]').getAttribute('data-cbsid') : null),
      colours: document.querySelector('[data-testid="chart-colours"]').value, read: document.querySelector('[data-testid="chart-read"]').checked,
      options: [...document.querySelectorAll('[data-testid="chart-colours"] option')].map((o) => o.textContent), mode: document.querySelector('[data-testid="tr-chart"]').getAttribute('data-read') }));
    return { ok: m.codes.every(Boolean) && new Set(m.codes).size === 5 && m.colours === 'follow' && m.read === false && m.mode === 'off' && m.options.length === 12 && /Follow my avatar theme/.test(m.options[0]),
      saw: JSON.stringify(m.codes) + '; colours ' + m.colours + '; Readability ' + m.read + '; mode ' + m.mode + '; ' + m.options.length + ' options, first "' + m.options[0] + '"' };
  });
  await pick('chart-colours', 'okabe');
  await w.step('B2', 'Okabe-Ito: the bars take the combination\'s own hex AT ONCE (vibrant), and ONE key is saved: chart_theme', async () => {
    const f = await fills(), last = S.patches[S.patches.length - 1];
    return { ok: f.filter((x) => x === rgbOf(OKABE_ACT)).length >= 11 && JSON.stringify(last) === '{"chart_theme":"okabe"}', saw: f.length + ' marks, first ' + f[0] + '; last PATCH ' + JSON.stringify(last) };
  });
  await pick('chart-type', 'line');
  await w.step('B3', 'Chart type Line: the same 12 points as a line (a dot each, one path), the table unchanged', async () => {
    const m = await page.evaluate(() => ({ dots: document.querySelectorAll('circle[data-testid^="tr-bar-"]').length, rects: document.querySelectorAll('rect[data-testid^="tr-bar-"]').length, path: document.querySelectorAll('[data-testid="cd-valueline"]').length, rows: document.querySelectorAll('[data-testid^="tr-row-"]').length }));
    return { ok: m.dots >= 11 && m.rects === 0 && m.path === 1 && m.rows === 12, saw: JSON.stringify(m) };
  });
  await page.click('[data-testid="chart-fav"]'); await page.waitForTimeout(400);
  await w.step('B4', 'the star saves chart_fav_series = "okabe-line" and is pressed', async () => {
    const pressed = await page.getAttribute('[data-testid="chart-fav"]', 'aria-pressed');
    return { ok: pressed === 'true' && S.prefs.chart_fav_series === 'okabe-line', saw: 'pressed ' + pressed + '; server holds ' + JSON.stringify(S.prefs) };
  });

  /* another device: a fresh browser context whose storage is empty; only the server's ui_prefs */
  const other = await page.context().browser().newContext({ viewport: { width: 1366, height: 768 } });
  const page2 = await other.newPage();
  await other.route('**/api/**', async (raw) => {
    const route = C.wrap(raw), u = new URL(route.request().url()), p = u.pathname;
    if (p === '/api/till/summary') return J(route, 200, answerFor('month'));
    if (p === '/api/entities/me') return J(route, 200, { entity: { display_name: 'Fixture Shop', currency_code: CURRENCY, country: 'AU', ui_prefs: S.prefs } });
    return J(route, 404, { error: 'not found' });
  });
  await other.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  await page2.goto(base + '/finance.html#/reports/trend'); await page2.waitForSelector('[data-testid="chart-bar"]', { timeout: 20000 }).catch(() => {}); await page2.waitForTimeout(1500);
  await w.step('B5', 'ANOTHER DEVICE (empty storage): the favourite is applied with no click: Okabe-Ito, Line, the star pressed', async () => {
    const m = await page2.evaluate(() => ({ colours: (document.querySelector('[data-testid="chart-colours"]') || {}).value, type: (document.querySelector('[data-testid="chart-type"]') || {}).value, star: (document.querySelector('[data-testid="chart-fav"]') || { getAttribute: () => '' }).getAttribute('aria-pressed') }));
    return { ok: m.colours === 'okabe' && m.type === 'line' && m.star === 'true', saw: JSON.stringify(m) };
  });
  await other.close();

  await pick('chart-type', 'column');
  await page.check('[data-testid="chart-read"]'); await page.waitForTimeout(500);
  await w.step('B6', 'Readability ON: data-read="on", every mark holds 3:1 against the page, saved as chart_read=on; OFF returns Okabe-Ito', async () => {
    const on = await page.evaluate(() => {
      const card = document.querySelector('#screen'); let bg = 'rgb(255,255,255)';
      for (let n = card; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; } }
      const marks = [...document.querySelectorAll('[data-testid^="tr-bar-"][data-state="full"]')].map((e) => getComputedStyle(e).fill);
      return { mode: document.querySelector('[data-testid="tr-chart"]').getAttribute('data-read'), bg, marks, low: Math.min(...marks.map((m) => CBDraw.contrast(m, bg))) };
    });
    const saved = S.prefs.chart_read;
    await page.uncheck('[data-testid="chart-read"]'); await page.waitForTimeout(500);
    const off = await fills();
    return { ok: on.mode === 'on' && on.low >= 3 && saved === 'on' && off.some((x) => x === rgbOf(OKABE_ACT)) && S.prefs.chart_read === 'off', saw: 'mode ' + on.mode + '; lowest mark ' + on.low.toFixed(2) + ':1; saved ' + saved + '; after OFF ' + off[0] + '; server ' + S.prefs.chart_read };
  });

  /* the Colour Vision theme, nothing chosen about Readability */
  S.prefs = { theme: 'cvd' };   /* the person's saved theme: the server holds it, so hydrate keeps it */
  await page.evaluate(() => { localStorage.setItem('cb_theme', 'cvd'); ['cb_chart_read', 'cb_chart_theme', 'cb_chart_fav_series', 'cb_chart_pending'].forEach((k) => localStorage.removeItem(k)); });
  await open('/finance.html#/reports/trend', '[data-testid="chart-bar"]');
  await w.step('B7', 'the Colour Vision theme switches Readability ON by itself; the person can switch it OFF', async () => {
    const auto = await page.evaluate(() => ({ on: document.querySelector('[data-testid="chart-read"]').checked, mode: document.querySelector('[data-testid="tr-chart"]').getAttribute('data-read'), theme: document.documentElement.getAttribute('data-theme') }));
    await page.uncheck('[data-testid="chart-read"]'); await page.waitForTimeout(400);
    const off = await page.getAttribute('[data-testid="tr-chart"]', 'data-read');
    return { ok: auto.on && auto.mode === 'on' && off === 'off', saw: JSON.stringify(auto) + '; after OFF ' + off };
  });
  await page.evaluate(() => { localStorage.removeItem('cb_theme'); ['cb_chart_read', 'cb_chart_pending'].forEach((k) => localStorage.removeItem(k)); });
  S.prefs = {};

  await open('/', '[data-testid="shell-facts-till"]');
  await w.step('B8', 'Home carries no bar (a teaser is not a chart page)', async () => ({ ok: (await page.locator('[data-testid="chart-bar"]').count()) === 0, saw: 'bars ' + (await page.locator('[data-testid="chart-bar"]').count()) }));

  await open('/finance.html#/reports/trend', '[data-testid="chart-bar"]');
  await w.step('B9', 'keyboard only: Tab to Colours, ArrowDown picks; Tab to Chart type, Tab to the star, Space presses it; Tab to Readability, Space switches it', async () => {
    const seen = [];
    const focusTestid = () => page.evaluate(() => (document.activeElement && document.activeElement.getAttribute('data-testid')) || '');
    await page.locator('[data-testid="chart-colours"]').focus();
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
    const colours = await page.inputValue('[data-testid="chart-colours"]'); seen.push(await focusTestid());
    await page.keyboard.press('Tab'); seen.push(await focusTestid());
    await page.keyboard.press('Tab'); seen.push(await focusTestid());
    await page.keyboard.press('Space'); await page.waitForTimeout(300);
    const star = await page.getAttribute('[data-testid="chart-fav"]', 'aria-pressed');
    await page.keyboard.press('Tab'); seen.push(await focusTestid());
    await page.keyboard.press('Space'); await page.waitForTimeout(300);
    const read = await page.isChecked('[data-testid="chart-read"]');
    const ring = await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'; });
    return { ok: colours !== 'follow' && star === 'true' && read === true && ring && seen.join() === 'chart-colours,chart-type,chart-fav,chart-read', saw: 'colours ' + colours + '; order ' + seen.join('>') + '; star ' + star + '; Readability ' + read + '; focus ring ' + ring };
  });

  for (const [name, width, height] of [['1366', 1366, 768], ['390', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await open('/finance.html#/reports/trend', '[data-testid="chart-bar"]');
    await w.step('B10-' + name, 'the bar and the chart fit at ' + width + 'x' + height + ': no horizontal scroll' + (width < 400 ? ', the bar on one line' : ''), async () => {
      const m = await page.evaluate(() => { const bar = document.querySelector('[data-testid="chart-bar"]'), r = bar.getBoundingClientRect(); return { barH: Math.round(r.height), barW: Math.round(r.width), scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, sticky: getComputedStyle(bar).position }; });
      await page.screenshot({ path: path.join(process.env.CB_SHOTS || __dirname, 'chart-step2-bar-' + name + '.png') }).catch(() => {});
      return { ok: m.scroll <= 0 && m.sticky === 'sticky' && (width > 400 || m.barH <= 90), saw: JSON.stringify(m) };
    });
  }
  if (w.errs.length) await w.step('E0', 'no page errors while walking', async () => ({ ok: false, saw: w.errs.slice(0, 2).join(' | ') }));
});
