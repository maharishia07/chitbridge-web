/* one-figure-live.cjs — l16-one-figure · Cash, BAS, Month lock, P&L, Terms and Dues say the same thing for Harbour Plumbing (opening GST balance + October trades), against a REAL api
 * (a SIT box's throwaway api; r3-e2e.sh pattern). Expected numbers are hand-computed in C:/dev/shots/l16-one-figure/EXPECTED.md. Shots 1366x768 and 390x844 into $OUT. */
'use strict';
const { chromium } = require('@playwright/test'), fs = require('fs'), path = require('path');
const L = require('./lib/live-harbour.cjs');
const OUT = process.env.OUT || 'e2e/shots';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const SCREENS = [
  ['cash', '/finance.html#/cash', '[data-testid="fc-list"]'],
  ['terms', '/finance.html#/terms', 'body'],
  ['dues', '/finance.html#/collections', 'body'],
  ['bas', '/accounts.html#gstclose', 'body'],
  ['lock', '/accounts.html#lock', 'body'],
  ['pl', '/accounts.html#pl', 'body']
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { base } = await L.serve(), token = await L.signIn(process.env.HANDLE || 'harbour-plumbing-au');
  const b = await chromium.launch();
  const seen = {};
  for (const vp of [{ width: 1366, height: 768, tag: '1366' }, { width: 390, height: 844, tag: '390' }]) {
    const { ctx, page: p } = await L.open(b, base, token, vp);
    for (const [name, url, wait] of SCREENS) {
      await p.goto('about:blank');
      await p.goto(base + url);
      await p.waitForSelector(wait, { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(2500);
      if (name === 'bas') { /* the quarter that holds the October trades */
        const opts = await p.$$eval('#pr_p option', (o) => o.map((x) => ({ v: x.value, t: x.textContent })));
        const q2 = opts.find((o) => /Oct/.test(o.t));
        if (q2) { await p.selectOption('#pr_p', q2.v); await p.waitForTimeout(2500); }
      }
      if (name === 'pl') { await p.waitForTimeout(1500); }
      const text = flat(await p.evaluate(() => document.body.innerText));
      if (vp.tag === '1366') seen[name] = text;
      const scroll = await p.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
      console.log('   ' + name + ' ' + vp.tag + ' scrollH ' + scroll.sh + '/' + scroll.ih + ' scrollW ' + scroll.sw + '/' + scroll.iw);
      await p.screenshot({ path: path.join(OUT, 'of-' + name + '-' + vp.tag + '.png') });
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'texts.json'), JSON.stringify(seen, null, 1));
  const has = (n, re) => re.test(seen[n] || '');
  ok(has('pl', /Sales\s*A\$4,800\.00/), '1 P&L Oct sales A$4,800.00');
  ok(has('bas', /A\$228\.00/) && has('bas', /480\.00/) && has('bas', /252\.00/), '2/3 BAS Oct-Dec 1A 480.00 · 1B 252.00 · to pay A$228.00');
  ok(has('cash', /BAS\s*A\$228\.00\s*·\s*28 Feb 2027/), '6 Cash: BAS A$228.00 · 28 Feb 2027');
  ok(has('cash', /BAS\s*A\$1,462\.00\s*·\s*owing from before/) && has('cash', /no due date held/), '7 Cash: BAS A$1,462.00 owing from before, no due date held');
  ok(!has('cash', /A\$1,690\.00\s*·\s*28 Feb/), '8 Cash no longer lumps A$1,690.00 against 28 Feb');
  ok(has('lock', /Oct[^]{0,80}A\$4,800\.00 sales/) && !has('lock', /5,280\.00 sales/), '9 Month lock Oct: A$4,800.00 sales (not 5,280.00)');
  ok(has('terms', /a bill is due on its own date/) && !has('terms', /has no due date/), '10 Terms: a bill is due on its own date');
  ok(has('dues', /14 Nov 2026/), '11 Dues: oldest due 14 Nov 2026 (the bill\'s own date)');
  console.log('RESULT pass ' + pass + ' fail ' + fail);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e && e.stack || e); process.exit(2); });
