#!/usr/bin/env node
/**
 * e2e/chart-waterfall.cjs — THE WATERFALL, SEEN (chart engine step 3; REQ section 7 item 1; critic 16 Nov points 2, 5, 8).
 * The real engine file (public/engine/chart-draw.js) in a real browser, on a page that carries only the tokens a card gives it (no api, no session).
 *
 *   W1 profit bridge (Income, Expenses, Profit): three bars, fall hollow and dashed, rise/total solid; figures are the caller's words
 *   W2 a loss: the last bar is below the baseline and says Loss
 *   W3 a bridge that does not close, and a mixed currency: ONE sentence (role=status), no bar
 *   W4 no horizontal scroll and the chart inside its card at 1366 x 768 and 390 x 844; pictures saved
 *   W5 GROWTH: 7 years of months (84 steps) drawn at 1366 and 390: render time in ms, median of 20, and bars drawn (86)
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/chart-waterfall.cjs [shots-dir]
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');

const ENGINE = path.join(__dirname, '..', 'public', 'engine', 'chart-draw.js');
const SHOTS = process.argv[2] || path.join(__dirname, '..', 'shots-chart-step3');
let bad = 0;
const say = (ok, what, extra) => {
  if (!ok) bad++;
  console.log('  ' + (ok ? 'ok    ' : 'BAD   ') + what + (extra ? '  ' + extra : ''));
};
const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--card:#fffdf8;--muted:#6f6450;--line-3:#d8ccb0;--ch-act:#0072B2;--ch-prev:#8a5a00;--ch-acc:#1f6b46;color:#2a2418;background:#f4eddc}
body{margin:0;font:14px system-ui,sans-serif;padding:12px 16px}
.card{background:var(--card);border:1px solid var(--line-3);border-radius:8px;padding:10px;margin:0 0 12px}
h2{font-size:14px;margin:0 0 6px} table{border-collapse:collapse;font-size:12px} td{padding:2px 8px}
</style>
<div class="card" id="c1"><h2>Profit bridge</h2><div id="a" data-testid="a"></div></div>
<div class="card" id="c2"><h2>A loss</h2><div id="b" data-testid="b"></div></div>
<div class="card" id="c3"><h2>Refused</h2><div id="r1" data-testid="r1"></div><div id="r2" data-testid="r2"></div></div>
<div class="card" id="c4"><h2>Seven years of months</h2><div id="g" data-testid="g"></div></div>`;

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const sizes = [
    ['1366', { width: 1366, height: 768 }],
    ['390', { width: 390, height: 844 }]
  ];
  for (const [name, viewport] of sizes) {
    const page = await browser.newPage({ viewport });
    await page.setContent(PAGE);
    await page.addScriptTag({ path: ENGINE });
    const out = await page.evaluate(() => {
      const S = (key, kind, amount_minor, label) => ({ key, label: label || key, kind, amount_minor, currency: 'AUD' });
      const format = (step) => step.label + ' ' + (Math.abs(step.amount_minor) / 100).toFixed(2);
      const fit = (id) => Math.max(240, document.getElementById(id).clientWidth - 8);
      const draw = (id, steps, extra) => {
        const box = document.getElementById(id);
        box.innerHTML = CBDraw.waterfall(steps, Object.assign({ width: fit(id), height: 170, id, tid: id, currency: 'AUD', format, aria: id }, extra || {}));
      };
      draw('a', [S('income', 'total', 412000, 'Income'), S('costs', 'minus', 265000, 'Expenses'), S('profit', 'total', 147000, 'Profit')]);
      draw('b', [S('income', 'total', 40000, 'Income'), S('costs', 'minus', 140000, 'Expenses'), S('loss', 'total', -100000, 'Loss')]);
      draw('r1', [S('income', 'total', 4000), S('costs', 'minus', 2500), S('profit', 'total', 1501)]);
      draw('r2', [S('income', 'total', 4000), Object.assign(S('costs', 'minus', 2500), { currency: 'INR' }), S('profit', 'total', 1500)]);
      const steps = [S('open', 'total', 0, 'Open')];
      let level = 0;
      for (let i = 0; i < 84; i++) {
        const up = i % 3 !== 2,
          amount = 100000 + i * 700;
        steps.push(S('m' + i, up ? 'plus' : 'minus', amount, 'M' + (i + 1)));
        level += up ? amount : -amount;
      }
      steps.push(S('close', 'total', level, 'Close'));
      const times = [];
      for (let n = 0; n < 20; n++) {
        const t0 = performance.now();
        draw('g', steps);
        void document.getElementById('g').getBoundingClientRect(); /* layout is part of the render */
        times.push(performance.now() - t0);
      }
      times.sort((x, y) => x - y);
      const q = (id, sel) => document.getElementById(id).querySelectorAll(sel).length;
      const lastBottom = (id) => {
        const rects = [...document.getElementById(id).querySelectorAll('rect')];
        const zero = document.getElementById(id).querySelector('line').getBoundingClientRect().top;
        return rects[rects.length - 1].getBoundingClientRect().bottom - zero;
      };
      return {
        a: { bars: q('a', 'g[data-testid^="a-bar-"]'), minus: q('a', 'g[data-kind="minus"] rect[style*="dasharray"]'), text: document.getElementById('a').textContent },
        b: { bars: q('b', 'g[data-testid^="b-bar-"]'), below: lastBottom('b'), text: document.getElementById('b').textContent },
        r1: { sentence: q('r1', '[data-state="mismatch"][role="status"]'), rects: q('r1', 'rect') },
        r2: { sentence: q('r2', '[data-state="mismatch"][role="status"]'), rects: q('r2', 'rect') },
        g: { bars: q('g', 'g[data-testid^="g-bar-"]'), median: times[10], worst: times[19], svgWidth: document.querySelector('#g svg').getBoundingClientRect().width, cardWidth: document.getElementById('c4').clientWidth },
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    const tag = name + ' ';
    say(out.a.bars === 3 && out.a.minus === 1 && /Expenses 2650\.00/.test(out.a.text), tag + 'W1 profit bridge: three bars, the fall hollow and dashed, the figures the caller wrote');
    say(out.b.bars === 3 && out.b.below > 0 && /Loss 1000\.00/.test(out.b.text), tag + 'W2 a loss draws below the baseline and says Loss', 'below by ' + out.b.below.toFixed(1) + 'px');
    say(out.r1.sentence === 1 && out.r1.rects === 0 && out.r2.sentence === 1 && out.r2.rects === 0, tag + 'W3 a bridge that does not close and a mixed currency: one sentence each, no bar');
    say(out.scroll <= 0 && out.g.svgWidth <= out.g.cardWidth, tag + 'W4 no horizontal scroll, the chart inside its card', 'scroll ' + out.scroll + ', chart ' + out.g.svgWidth.toFixed(0) + ' of ' + out.g.cardWidth);
    say(out.g.bars === 86, tag + 'W5 7 years of months: all 86 bars drawn', 'render median ' + out.g.median.toFixed(1) + ' ms, worst of 20 ' + out.g.worst.toFixed(1) + ' ms');
    await page.screenshot({ path: path.join(SHOTS, 'waterfall-' + name + '.png'), fullPage: true });
    await page.close();
  }
  await browser.close();
  console.log('\n  ' + bad + ' problem' + (bad === 1 ? '' : 's') + '\n');
  process.exitCode = bad ? 1 : 0;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
