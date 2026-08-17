// TEMPORARY probe — seed a catalogue, select the THIRD row, and measure what is actually on screen in dark.
const { test, expect } = require('@playwright/test');
const { mintEntity, settle } = require('../fixtures');

test('probe · third product row + category chips, dark', async ({ page }) => {
  test.setTimeout(180_000);
  await mintEntity(page);

  await page.getByTestId('nav-catalogue').click();
  for (const n of ['Sona Masoori rice', 'Ikkat Silk Saree', 'Jute Bag 50kg']) {
    await page.getByTestId('cat-new-product').click();
    await page.getByTestId('cat-field-name').fill(n);
    await page.getByTestId('cat-field-price').fill('250');
    await page.getByTestId('cat-add').click();
    await settle(page);
    /* ⚠️ CREATING LEAVES THE SCREEN IN DETAIL VIEW. Without going back, the next `cat-new-product` click lands on
       a screen that does not have that button and the loop silently seeds ONE product, not three — which is how
       the probe reported an empty catalogue while claiming to have filled it. */
    await page.evaluate(() => window.backToList && window.backToList());
    await page.waitForTimeout(700);
  }
  // ⚠️ RELOAD. Creating leaves the screen in DETAIL view; the list is what we came to measure.
  await page.reload();
  await page.waitForTimeout(3000);
  await page.getByTestId('nav-catalogue').click();
  await page.waitForTimeout(2500);

  const rows = await page.locator('[data-testid^="cat-product-"]').count();
  const chips = await page.locator('[data-testid="cat-catgfilter"]').count();
  console.log('PROBE rows=' + rows + ' chips=' + chips);
  const ids = await page.evaluate(`Array.from(document.querySelectorAll('[data-testid]'))
    .map(e => e.getAttribute('data-testid')).filter(t => /cat|prod/i.test(t)).slice(0, 30).join(' | ')`);
  console.log('PROBE testids: ' + ids);
  const chipTxt = await page.evaluate(`Array.from(document.querySelectorAll('[data-testid="cat-catgfilter"]'))
    .map(e => e.textContent.trim()).join(' / ')`);
  console.log('PROBE chips say: ' + chipTxt);

  if (rows >= 3) await page.locator('[data-testid^="cat-product-"]').nth(2).click().catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => window.themeApply('dark'));
  await page.waitForTimeout(800);

  const bad = await page.evaluate(`(() => {
    const parse = (c) => { const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/.exec(c);
      return m ? { r:+m[1], g:+m[2], b:+m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
    const over = (f,b) => ({ r:f.r*f.a+b.r*(1-f.a), g:f.g*f.a+b.g*(1-f.a), b:f.b*f.a+b.b*(1-f.a), a:1 });
    const L = (c) => { const v=[c.r,c.g,c.b].map(x=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4);});
      return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2]; };
    const bgOf = (el) => { const st=[]; let n=el,g=0;
      while(n && n!==document.documentElement && g++<40){ const c=parse(getComputedStyle(n).backgroundColor);
        if(c&&c.a>0){ st.push(c); if(c.a===1) break; } n=n.parentElement; }
      let base=parse(getComputedStyle(document.body).backgroundColor)||{r:255,g:255,b:255,a:1};
      for(let i=st.length-1;i>=0;i--) base=over(st[i],base); return base; };
    const out=[]; const w=document.createTreeWalker(document.querySelector('.shell'), NodeFilter.SHOW_TEXT); let node;
    while((node=w.nextNode())){ const s=(node.nodeValue||'').trim(); if(!s) continue;
      const el=node.parentElement; if(!el||el.closest('.moderibbon')||el.closest('[aria-hidden="true"]')) continue;
      const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0) continue;
      const f=parse(cs.color); if(!f) continue; const b=bgOf(el);
      const lf=L(over(f,b)), lb=L(b); const r=(Math.max(lf,lb)+0.05)/(Math.min(lf,lb)+0.05);
      if(r<4.5) out.push({t:s.slice(0,26), sel:(el.className||el.tagName).toString().slice(0,26),
        fg:cs.color, bg:'rgb('+Math.round(b.r)+','+Math.round(b.g)+','+Math.round(b.b)+')', r:+r.toFixed(2),
        style:(el.getAttribute('style')||'').slice(0,72)}); }
    return out;
  })()`);
  console.log('PROBE under-4.5 count=' + bad.length);
  bad.slice(0, 30).forEach((b) => console.log(`  "${b.t}" .${b.sel} ${b.fg} on ${b.bg} = ${b.r}:1  [${b.style}]`));
  await page.screenshot({ path: 'probe-dark-catalogue.png', fullPage: false });
  expect(true).toBe(true);
});
