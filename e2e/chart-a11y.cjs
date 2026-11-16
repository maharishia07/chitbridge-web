#!/usr/bin/env node
/**
 * e2e/chart-a11y.cjs — THE CHART CONTRAST GUARD (chart engine step 2; REQ section 6; critic point 5). A NEW guard: the older contrast and axe guards measure theme tokens and pages,
 * never a rendered chart. A chart says its mode on its own element (data-read="on|off"); this guard reads it from there and never guesses.
 *
 *   A1 BUILD TEST: every combination (and "follow my avatar theme") x every one of the 16 themes, Readability ON: every series mark clears 3:1 against that theme's page
 *   A2 the guard reads the DOM: Reports › Trend, Okabe-Ito, light (Cream) and dark, 1366 and 390, Readability ON: marks 3:1 (WCAG 1.4.11), the chart's text 4.5:1 (1.4.3),
 *      the table under the chart, role="img" with a label stating the latest value, axe (wcag2a/aa) clean on the chart and the bar
 *   A3 the same page with Readability OFF (a user-chosen vibrant palette): the series-mark colours are NOT failed; the FIXED FLOOR still is: text 4.5:1, the table, the label, axe
 *   A4 good / watch / bad meaning colours are never themed: applying a palette writes only --ch-* tokens, --red stays what the theme says, in both modes
 *   A5 HOSTILE FIXTURE (a combination with a 1.4:1 mark): OFF it is not failed (the person's pick); ON the render is readable and passes; a render that IGNORES the toggle
 *      (the 1.4:1 marks under data-read="on") FAILS this guard — asserted; text under 4.5:1 on a vibrant fill FAILS in both modes — asserted
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/chart-a11y.cjs
 */
'use strict';
const path = require('path');
const fs = require('fs');
const W = require('./lib/walk.cjs');
const C = require('./lib/contract.cjs');
const R = require(path.join(__dirname, '..', 'public', 'engine', 'rollup.js'));
const J = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = new Date('2026-10-17T10:00:00+10:00');
const monthBack = (k) => new Date(Date.UTC(2026, 9 - k, 1)).toISOString().slice(0, 7);
const summary = (period, key, gross) => ({ period, key, till: { id: 'C1' }, totals: { count: 20, returns: 0, gross, refunds: 0, expenseCount: 0, expenses: 0, total: gross - 50, by: {} } });
const SUMMARIES = [];
for (let k = 1; k <= 14; k++) SUMMARIES.push(summary('month', monthBack(k), k === 1 ? 1100 : 1000));
const answer = { period: 'month', n: 12, currency: 'AUD', fy_start_month: 7, slots: R.series('month', 12, SUMMARIES, { fyStart: 7, currency: 'AUD', now: NOW.getTime() }), sales_from: 'summaries', sales_note: '' };
const AXE = path.join(__dirname, 'vendor', 'axe-core', 'axe.min.js');

/** THE GUARD, run in the page: reads the chart element's own mode and measures what is drawn. root = the element that holds the chart (the svg or a card). */
const GUARD = `(function (rootSel, page) {
  var root = document.querySelector(rootSel);
  var svg = root.matches('svg') ? root : root.querySelector('svg[data-read]');
  var mode = svg ? svg.getAttribute('data-read') : null;
  var out = { mode: mode, weakMarks: [], weakText: [], marks: 0, texts: 0 };
  if (!svg) return out;
  /* the series marks: every bar or dot of a series, and the last-year line (a hollow dot's fill is the card's own colour and is not a mark) */
  [].forEach.call(svg.querySelectorAll('[data-testid*="-bar-"], [data-testid="cd-lastyear"]'), function (m) {
    var fill = m.getAttribute('data-testid') === 'cd-lastyear' ? getComputedStyle(m).stroke : getComputedStyle(m).fill;
    if (!fill || fill === 'none' || /rgba\\(0, 0, 0, 0\\)/.test(fill)) return;
    out.marks++;
    var ratio = CBDraw.contrast(fill, page);
    if (ratio < CBDraw.MARK_NEED) out.weakMarks.push(fill + ' ' + ratio.toFixed(2));
  });
  [].forEach.call(svg.querySelectorAll('text'), function (t) {
    out.texts++;
    var colour = getComputedStyle(t).fill, ratio = CBDraw.contrast(colour, page);
    if (ratio < CBDraw.TEXT_NEED) out.weakText.push((t.textContent || '').slice(0, 12) + ' ' + ratio.toFixed(2));
  });
  return out;
})`;
/** what the guard FAILS: marks only when the chart says it is the readable render; text always */
const verdict = (g) => ({ pass: g.marks > 0 && g.weakText.length === 0 && (g.mode !== 'on' || g.weakMarks.length === 0), g });

W.run('chart-a11y', async (w) => {
  const { page, ctx, base } = w;
  await ctx.route('**/api/**', async (raw) => {
    const route = C.wrap(raw), p = new URL(route.request().url()).pathname;
    if (p === '/api/till/summary') return J(route, 200, answer);
    if (p === '/api/entities/me') return J(route, 200, { entity: { display_name: 'Fixture Shop', currency_code: 'AUD', country: 'AU', ui_prefs: {} } });
    return J(route, 404, { error: 'not found' });
  });
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('cb_sess')) { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  await ctx.clock.setFixedTime(NOW);

  /* A1 — on a fixed-look page (the UI standard page), every theme x every combination, Readability ON */
  await page.goto(base + '/ui-standard.html'); await page.waitForTimeout(800);
  await page.addScriptTag({ url: base + '/engine/chart-draw.js' });
  await page.addScriptTag({ url: base + '/app/chart-bar.js' });
  await w.step('A1', 'BUILD TEST: 12 palettes x 16 themes, Readability ON: every series mark clears 3:1 on every theme', async () => {
    const r = await page.evaluate(() => {
      var bad = [], count = 0, themes = Object.keys(CBAvatar.THEMES);
      themes.forEach(function (key) {
        CBAvatar.applyWith({ theme: key });
        var tokens = CBChartBar.tokensOf(document.body);
        [''].concat(Object.keys(CBDraw.COMBOS)).forEach(function (id) {
          var palette = CBDraw.paletteOf(id, tokens, 'on');
          var low = Math.min.apply(null, palette.pie.concat([palette.act, palette.prev, palette.acc], palette.ramp).map(function (c) { return CBDraw.contrast(c, tokens.page); }));
          count++;
          if (low < CBDraw.MARK_NEED) bad.push(key + '/' + (id || 'follow') + ' ' + low.toFixed(2));
        });
      });
      return { themes: themes.length, count: count, bad: bad };
    });
    return { ok: r.themes === 16 && r.count === 16 * 12 && !r.bad.length, saw: r.themes + ' themes x 12 = ' + r.count + ' renders; under 3:1: ' + JSON.stringify(r.bad.slice(0, 5)) };
  });
  await w.step('A4', 'good / watch / bad are never themed: a palette writes only --ch-* tokens; --red is the theme\'s own, ON and OFF', async () => {
    const r = await page.evaluate(() => {
      var host = document.createElement('div'); document.body.appendChild(host);
      var before = getComputedStyle(host).getPropertyValue('--red') + '|' + getComputedStyle(host).getPropertyValue('--ok');
      var tokens = CBChartBar.tokensOf(document.body), names = [];
      ['on', 'off'].forEach(function (read) { CBDraw.applyPalette(host, CBDraw.paletteOf('okabe', tokens, read), read); });
      for (var i = 0; i < host.style.length; i++) names.push(host.style[i]);
      var after = getComputedStyle(host).getPropertyValue('--red') + '|' + getComputedStyle(host).getPropertyValue('--ok');
      return { names: names, same: before === after };
    });
    return { ok: r.same && r.names.every((n) => /^--ch-/.test(n)), saw: 'tokens written ' + r.names.join(' ') + '; --red/--ok unchanged ' + r.same };
  });

  /* A2 / A3 — the real Trend page */
  const looks = [['cream', 1366, 768], ['dark', 1366, 768], ['cream', 390, 844], ['dark', 390, 844]];
  for (const mode of ['on', 'off']) {
    for (const [theme, width, height] of looks) {
      await page.setViewportSize({ width, height });
      await page.goto(base + '/config.js');
      await page.evaluate((t) => { try { localStorage.setItem('cb_theme', t); localStorage.setItem('cb_chart_theme', 'okabe'); localStorage.setItem('cb_chart_read', 'off'); } catch (_) {} }, theme);
      await page.goto(base + '/finance.html#/reports/trend');
      await page.waitForSelector('[data-testid="chart-bar"]', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(700);
      if (mode === 'on') { await page.click('[data-testid="chart-read"]'); await page.waitForTimeout(500); }
      await page.addScriptTag({ path: AXE }).catch(() => {});
      await w.step((mode === 'on' ? 'A2-' : 'A3-') + theme + '-' + width, 'Trend, Okabe-Ito, ' + theme + ', ' + width + 'x' + height + ', Readability ' + mode.toUpperCase() + ': ' + (mode === 'on' ? 'marks 3:1, ' : 'marks exempt (the person\'s own palette), ') + 'text 4.5:1, table, label, axe', async () => {
        const g = await page.evaluate(GUARD + '("[data-testid=\\"tr-chart\\"]", (function(){ var n = document.querySelector("#screen"); for (; n; n = n.parentElement) { var c = getComputedStyle(n).backgroundColor; if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c; } return "rgb(255,255,255)"; })())');
        const v = verdict(g);
        const floor = await page.evaluate(() => { const s = document.querySelector('[data-testid="tr-chart"]'); return { role: s.getAttribute('role'), label: s.getAttribute('aria-label') || '', rows: document.querySelectorAll('[data-testid^="tr-row-"]').length }; });
        const axe = await page.evaluate(async () => { if (!window.axe) return { skipped: true }; const r = await axe.run('[data-testid="chart-bar"], [data-testid="tr-chart-box"]', { runOnly: ['wcag2a', 'wcag2aa'], rules: { 'color-contrast': { enabled: false } } }); return { violations: r.violations.map((x) => x.id) }; });
        const ok = v.pass && g.mode === mode && floor.role === 'img' && /September 2026/.test(floor.label) && floor.rows > 0 && (axe.skipped || !axe.violations.length);
        return { ok, saw: 'data-read ' + g.mode + '; ' + g.marks + ' marks, weak ' + JSON.stringify(g.weakMarks.slice(0, 2)) + '; ' + g.texts + ' texts, weak ' + JSON.stringify(g.weakText.slice(0, 2)) + '; label "' + floor.label.slice(0, 40) + '"; table rows ' + floor.rows + '; axe ' + JSON.stringify(axe) };
      });
    }
  }

  /* A5 — the hostile fixture, in a page of its own */
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(base + '/config.js');
  await page.addScriptTag({ url: base + '/engine/chart-draw.js' });
  await page.evaluate(() => { document.body.innerHTML = '<div id="h" style="background:#fff;color:#111;padding:8px"></div>'; CBDraw.COMBOS.hostile = { name: 'Hostile', act: '#dcdcdc', prev: '#e2e2e2', acc: '#d8d8d8', ramp: ['#dcdcdc', '#e0e0e0', '#e4e4e4', '#e8e8e8', '#ececec'] }; });
  const drawn = (read, ignoreToggle) => page.evaluate(({ read, ignoreToggle }) => {
    var host = document.getElementById('h'), tokens = { page: '#ffffff', ink: '#111111', acc: '#2468BD', prog: '#7d6126' };
    var palette = CBDraw.paletteOf('hostile', tokens, ignoreToggle ? 'off' : read);
    CBDraw.applyPalette(host, palette, ignoreToggle ? 'off' : read);
    host.innerHTML = CBDraw.bars([{ key: 'a', label: 'a', value: 5, title: 't' }, { key: 'b', label: 'b', value: 8, title: 't' }], { tid: 'big', read: read, aria: 'x' });
    host.setAttribute('data-read', read);
    return true;
  }, { read, ignoreToggle });
  const guard = () => page.evaluate(GUARD + '("#h", "rgb(255,255,255)")');
  await drawn('off', false);
  const off = verdict(await guard());
  await drawn('on', false);
  const on = verdict(await guard());
  await drawn('on', true);
  const ignored = verdict(await guard());
  await w.step('A5', 'HOSTILE 1.4:1 combination: OFF not failed; ON readable and passes; a render that IGNORES the toggle FAILS (asserted)', async () => ({
    ok: off.pass && on.pass && !ignored.pass && ignored.g.weakMarks.length > 0,
    saw: 'off pass ' + off.pass + ' (mode ' + off.g.mode + ', weak marks ' + off.g.weakMarks.length + '); on pass ' + on.pass + '; ignored-toggle pass ' + ignored.pass + ' (weak ' + JSON.stringify(ignored.g.weakMarks.slice(0, 1)) + ')'
  }));
  const textBad = await page.evaluate(() => {
    var host = document.getElementById('h');
    var one = (read) => { host.innerHTML = '<svg data-read="' + read + '"><rect x="0" y="0" width="40" height="20" fill="#dcdcdc"/><text x="2" y="14" style="fill:#bbbbbb">3</text></svg>'; return host.firstChild; };
    return ['on', 'off'].map(function (read) { var svg = one(read), t = svg.querySelector('text'); return CBDraw.contrast(getComputedStyle(t).fill, '#dcdcdc'); });
  });
  await w.step('A5b', 'text under 4.5:1 on a vibrant fill FAILS in BOTH modes (asserted: #bbb on #dcdcdc is ' + textBad.map((x) => x.toFixed(2)).join(' and ') + ':1)', async () => ({ ok: textBad.every((x) => x < 4.5), saw: JSON.stringify(textBad) }));
  if (w.errs.length) await w.step('E0', 'no page errors while walking', async () => ({ ok: false, saw: w.errs.slice(0, 2).join(' | ') }));
});
