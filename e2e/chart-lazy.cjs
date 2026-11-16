#!/usr/bin/env node
/**
 * e2e/chart-lazy.cjs — THE CHART ENGINE LOADS ONLY WHEN A CHART IS ABOUT TO BE DRAWN (chart engine step 1; REQ pass test 6; critic point 4),
 * with its draw time on a large seed (critic point 7), a keyboard pass, and the pictures at 1366 and 390.
 * Planted like e2e/reports-trend.cjs: the site is served from this checkout, the API is a stand-in answering inside the page; every request the page
 * makes is counted, so "the network log shows the chart capability was NOT fetched" is a number.
 *
 *   L1 Home with NO trend from the server: no request for /engine/chart-*.js (the Till teaser has nothing to draw)
 *   L2 CB Finance › Collections (a page of tables, no chart): no request for chart code
 *   L3 Home WITH a trend: the engine is fetched once, and the teaser draws
 *   L4 Reports › Trend: the engine is fetched once and 12 bars draw
 *   L5 the engine cannot load (the request is refused): ONE sentence and the table under it, never a blank card
 *   L6 large seed: 5 years of daily figures (1,826 points) drawn by CBDraw.bars: at most 120 bars, and the draw takes under 100 ms
 *   L7 keyboard only: Tab reaches the period tabs, Enter on Weeks redraws 52 bars; focus stays visible on the tab
 *   L8 the pictures: Trend at 1366x768 and 390x844 (no horizontal scroll; the chart fits its card)
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/chart-lazy.cjs
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
for (let i = 1; i <= 60; i++) SUMMARIES.push(summary('week', R.weekKey(new Date(NOW.getTime() - i * 7 * 86400000)), 300));
const N = { week: 52, month: 12, quarter: 8, year: 7 };
const answerFor = (period) => ({ period, n: N[period], currency: CURRENCY, fy_start_month: FY_START,
  slots: R.series(period, N[period], SUMMARIES, { fyStart: FY_START, currency: CURRENCY, now: NOW.getTime() }), sales_from: 'summaries', sales_note: '' });

W.run('chart-lazy', async (w) => {
  const { page, ctx, base } = w;
  const S = { trend: false, refuseEngine: false, chartFiles: [] };
  page.on('request', (request) => { if (/\/engine\/chart-/.test(request.url())) S.chartFiles.push(request.url().replace(base, '')); });
  await ctx.route('**/engine/chart-draw.js*', (route) => (S.refuseEngine ? route.abort() : route.continue()));
  await ctx.route('**/api/**', async (raw) => {
    const route = C.wrap(raw), u = new URL(route.request().url()), p = u.pathname;
    if (p === '/api/till/summary' && u.searchParams.get('compare') === '1') return J(route, 200, answerFor(u.searchParams.get('period')));
    if (p === '/api/facts/till') return J(route, 200, { lines: [{ text: '12 bills · {money}', value: 12, money: { amount: 4280, currency: CURRENCY } }],
      figures: S.trend ? { counters_open: 1, trend: { spark: [30000, 28000, null, 31000, 30000, 29000, 30000, null], vs_last_year_pct: 12 } } : { counters_open: 1 } });
    if (p === '/api/entities/me') return J(route, 200, { entity: { display_name: 'Fixture Shop', currency_code: CURRENCY, country: 'AU' } });
    return J(route, 404, { error: 'not found' });
  });
  await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); localStorage.setItem('cb_locale', 'en-AU'); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  await ctx.clock.setFixedTime(NOW);
  const open = async (url, wait) => { S.chartFiles.length = 0; await page.goto('about:blank'); await page.goto(base + url); if (wait) await page.waitForSelector(wait, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(900); };

  await open('/', '[data-testid="shell-facts-till"]');
  await w.step('L1', 'Home with no trend from the server: the network log holds NO chart code', async () => ({ ok: S.chartFiles.length === 0, saw: 'chart requests: ' + JSON.stringify(S.chartFiles) }));
  await open('/finance.html#/collections', '[data-testid="fin-nav-collections"]');
  await w.step('L2', 'CB Finance › Collections (tables only): NO chart code fetched', async () => ({ ok: S.chartFiles.length === 0 && (await page.evaluate(() => typeof window.CBDraw)) === 'undefined', saw: 'chart requests: ' + JSON.stringify(S.chartFiles) }));
  S.trend = true;
  await open('/', '[data-testid="shell-fact-trend"]');
  await w.step('L3', 'Home with a trend: the engine is fetched ONCE and the Till teaser draws its sparkline', async () => {
    const svg = await page.locator('[data-testid="shell-fact-spark"]').count();
    return { ok: S.chartFiles.length === 1 && svg === 1, saw: 'chart requests: ' + JSON.stringify(S.chartFiles) + '; sparkline ' + svg };
  });
  await open('/finance.html#/reports/trend', '[data-testid="tr-chart"]');
  await w.step('L4', 'Reports › Trend: the engine is fetched ONCE and 12 bars draw', async () => {
    const bars = await page.locator('[data-testid^="tr-bar-"]').count();
    return { ok: S.chartFiles.length === 1 && bars === 12, saw: 'chart requests: ' + JSON.stringify(S.chartFiles) + '; bars ' + bars };
  });
  S.refuseEngine = true;
  await open('/finance.html#/reports/trend', '[data-testid="tr-list"], .hint');
  await w.step('L5', 'the engine cannot load: one sentence and the table, never a blank card', async () => {
    const words = await page.locator('#tr_chart').innerText().catch(() => '');
    const rows = await page.locator('[data-testid^="tr-row-"]').count();
    return { ok: /could not load/i.test(words) && rows > 0 && (await page.locator('[data-testid^="tr-bar-"]').count()) === 0, saw: '"' + words.replace(/\s+/g, ' ').trim() + '"; table rows ' + rows };
  });
  S.refuseEngine = false;
  await open('/finance.html#/reports/trend', '[data-testid="tr-chart"]');
  await w.step('L6', 'large seed: 5 years of days (1,826 points) draw at most 120 bars, under 100 ms', async () => {
    /* a page of its own in a context WITHOUT the walk's fixed clock (a fixed clock freezes performance.now and every draw would "take" 0 ms) */
    const timed = await page.context().browser().newContext();
    const probe = await timed.newPage();
    await probe.goto(base + '/config.js');
    await probe.addScriptTag({ url: base + '/engine/chart-draw.js' });
    const out = await probe.evaluate(() => {
      const points = Array.from({ length: 1826 }, (_, i) => ({ key: 'd' + i, label: String(i), value: 1000 + ((i * 37) % 500), title: 'day ' + i }));
      const t0 = performance.now(); let svg = '';
      for (let run = 0; run < 20; run++) svg = CBDraw.bars(points, { tid: 'big', width: 640 });
      return { ms: (performance.now() - t0) / 20, bars: (svg.match(/data-testid="big-bar-/g) || []).length, bytes: svg.length };
    });
    await timed.close();
    return { ok: out.bars === 120 && out.ms > 0 && out.ms < 100, saw: out.bars + ' bars, ' + out.ms.toFixed(2) + ' ms per draw (mean of 20), ' + out.bytes + ' bytes of svg' };
  });
  await w.step('L7', 'keyboard only: Tab reaches the period tabs; Enter on Weeks redraws 52 bars; focus is visible', async () => {
    await page.locator('body').click({ position: { x: 2, y: 2 } }).catch(() => {});
    let focused = '';
    for (let i = 0; i < 60 && focused !== 'tr-tab-week'; i++) { await page.keyboard.press('Tab'); focused = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute('data-testid')) || ''); }
    const outline = await page.evaluate(() => { const e = document.activeElement, s = e && getComputedStyle(e); return s ? (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' : false; });
    await page.keyboard.press('Enter'); await page.waitForTimeout(700);
    const bars = await page.locator('[data-testid^="tr-bar-"]').count();
    return { ok: focused === 'tr-tab-week' && outline && bars === 52, saw: 'focused ' + focused + '; focus ring ' + outline + '; bars after Enter ' + bars };
  });
  for (const [name, width, height] of [['1366', 1366, 768], ['390', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await open('/finance.html#/reports/trend', '[data-testid="tr-chart"]');
    await w.step('L8-' + name, 'Reports › Trend at ' + width + 'x' + height + ': the chart fits its card, no horizontal scroll', async () => {
      const m = await page.evaluate(() => { const svg = document.querySelector('[data-testid="tr-chart"]'), card = document.querySelector('#tr_chart'); const a = svg.getBoundingClientRect(), b = card.getBoundingClientRect(); return { svg: Math.round(a.width), card: Math.round(b.width), scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      await page.screenshot({ path: path.join(process.env.CB_SHOTS || __dirname, 'chart-step1-trend-' + name + '.png') }).catch(() => {});
      return { ok: m.svg <= m.card + 1 && m.scroll <= 0, saw: JSON.stringify(m) };
    });
  }
  if (w.errs.length) await w.step('E0', 'no page errors while walking', async () => ({ ok: false, saw: w.errs.slice(0, 2).join(' | ') }));
});
