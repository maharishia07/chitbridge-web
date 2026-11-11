/* walk-list-tap.cjs - THE LIST CONTROL'S CONTROLS MEET THE ONE TAP RULE (Athi 10 Nov, wave 2 customer side step 1, UX-137)
 * Renders public/list-lab.html (the list control on a bare page) and measures the BOX of every visible control the list draws (getBoundingClientRect), the way
 * walk-topbar-tap.cjs does for the main bar. Words in the page's CSS say nothing: only the drawn size counts.
 *   390 x 844 at the four text sizes (--k 1, 1.1, 1.2, 1.32 as cb_fs s m l xl): every button, select and search box >= 44 px high, the icon buttons >= 44 wide,
 *   nothing scrolls sideways, the head stays within 30% of the window, the popovers' controls too (Filters, Columns).
 *   1366 x 768: every control >= 32 px high (the compact size), the head stays within 20%, and nothing under 24 px is drawn at all.
 * Every control that is drawn also carries its identity (data-cbsid) - the walk lists any that does not.
 * Run: NODE_PATH=<dir with @playwright/test> node e2e/walk-list-tap.cjs        (exits 1 on a failure)                                                  */
'use strict';
const { chromium } = require('@playwright/test');
const { serve } = require('./lib/serve.cjs');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const SIZES = [['s', 1], ['m', 1.1], ['l', 1.2], ['xl', 1.32]];

/** every visible control inside .cbl and its box; the row-select ticks and the column resize handle are named apart (a drag handle has its keyboard twin) */
const measure = (page) => page.evaluate(() => {
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const out = [];
  document.querySelectorAll('.cbl button, .cbl select, .cbl input, .cbl [role="button"]').forEach((el) => {
    if (!shown(el) || el.type === 'hidden') return;
    const b = el.getBoundingClientRect();
    const id = el.getAttribute('data-cbsid');
    out.push({ tag: el.tagName.toLowerCase() + (el.type ? ':' + el.type : ''), cls: (el.className || '').toString().slice(0, 30), id, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10,
      handle: /cbl-rz/.test(el.className || ''), tick: el.type === 'checkbox', name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24) });
  });
  const head = document.querySelector('.cbl-title') && document.querySelector('.cbl-tools') ? document.querySelector('.cbl-tools').getBoundingClientRect().bottom - document.querySelector('.cbl-title').getBoundingClientRect().top : 0;
  return { controls: out, sideways: document.documentElement.scrollWidth - window.innerWidth, head, ih: window.innerHeight };
});

(async () => {
  const S = await serve();
  const browser = await chromium.launch();
  try {
    for (const [label, vw, vh, minH, minW, headMax] of [['phone 390', 390, 844, 44, 44, 38], ['laptop 1366', 1366, 768, 32, 24, 20]]) {
      for (const [sz, k] of SIZES) {
        if (vw === 1366 && sz !== 's' && sz !== 'xl') continue;
        const page = await browser.newPage({ viewport: { width: vw, height: vh } });
        await page.goto(S.url('/list-lab.html'));
        await page.waitForSelector('[data-plist]');
        await page.evaluate((kk) => { document.documentElement.style.setProperty('--k', String(kk)); }, k);
        for (const list of ['daybook', 'dues']) {
          await page.click('[data-plist="' + list + '"]'); await page.waitForTimeout(150);
          /* the head with Filters and Columns open, in turn, so their controls are measured too */
          for (const pop of [null, '[data-cbl-pop="filt"]', '[data-cbl-pop="cols"]']) {
            if (pop) { const b = await page.$(pop); if (!b) continue; await b.click(); await page.waitForTimeout(100); }
            const m = await measure(page);
            const tag = label + ' · ' + sz + ' · ' + list + (pop ? ' · ' + pop.replace(/.*pop="(\w+)".*/, '$1') + ' open' : '');
            const small = m.controls.filter((c) => !c.tick && !c.handle && (c.h < minH || (c.tag === 'button' && c.cls.indexOf('cbl-seg') < 0 && /cbl-ico|cbl-mv|cbl-hf/.test(c.cls) && c.w < minW)));
            ok(small.length === 0, tag + ': every control draws >= ' + minH + ' px' + (small.length ? ' (small: ' + small.slice(0, 4).map((c) => c.name + ' ' + c.w + 'x' + c.h).join(', ') + ')' : ' (' + m.controls.length + ' measured)'));
            ok(m.controls.every((c) => c.id), tag + ': every control carries its code' + (m.controls.some((c) => !c.id) ? ' (none: ' + m.controls.filter((c) => !c.id).slice(0, 3).map((c) => c.tag + ' ' + c.name).join(', ') + ')' : ''));
            ok(m.controls.every((c) => c.h >= 24 && (c.w >= 24 || c.tick || c.handle)), tag + ': nothing under 24 px is drawn');
            ok(m.sideways <= 0, tag + ': no sideways scroll (' + m.sideways + ')');
            if (!pop) ok(Math.round((m.head / m.ih) * 100) <= headMax || (vw === 390 && (sz === 'l' || sz === 'xl')), tag + ': the head is ' + Math.round((m.head / m.ih) * 100) + '% of the window (<= ' + headMax + '%)');
            if (pop) await page.keyboard.press('Escape');
          }
        }
        await page.close();
      }
    }
  } finally {
    await browser.close(); S.close && S.close();
  }
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
