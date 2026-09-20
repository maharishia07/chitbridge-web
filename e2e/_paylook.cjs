/* a look at what the pay area really offers, on the counter as it stands */
'use strict';
const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await p.goto('http://127.0.0.1:7351');
  await p.waitForFunction(() => typeof window.shopReady === 'function', null, { timeout: 30000 });
  await p.waitForTimeout(1500);

  /* ⚠️ sign in first — add() is gated on it now, and the prompt covers the pay area */
  await p.evaluate(() => window.openWho());
  await p.waitForTimeout(700);
  await p.locator('[data-testid="till-who-entity"]').click();
  await p.waitForTimeout(700);
  if (await p.locator('#askdlg[open]').count()) { await p.locator('[data-testid="till-ask-input"]').fill('0').catch(()=>{}); await p.locator('[data-testid="till-ask-ok"]').click(); }
  await p.waitForTimeout(900);
  console.log('WHO              : ' + JSON.stringify(await p.evaluate(() => window.WHO && window.WHO.name)));
  /* ⭐ the one online read a NEW counter needs, so ChitBridge gives it a number no other counter uses */
  await p.keyboard.press('F4');
  await p.waitForTimeout(6000);
  console.log('series after F4  : ' + JSON.stringify(await p.evaluate(() => { try { return (window.S && window.S.till) || null; } catch(e){ return String(e); } })));
  console.log('cart before      : ' + await p.evaluate(() => (window.CART || []).length));
  await p.locator('#q').fill('Idli');
  await p.waitForTimeout(700);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(900);
  console.log('cart after Enter : ' + await p.evaluate(() => (window.CART || []).length));

  console.log('\nevery till-pay-* on screen:');
  console.log('  ' + JSON.stringify(await p.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="till-pay"]')).map((e) => e.getAttribute('data-testid')))));
  console.log('#save present    : ' + await p.locator('#save').count()
    + '   visible: ' + await p.locator('#save').isVisible().catch(() => false));
  console.log('PICKED           : ' + JSON.stringify(await p.evaluate(() => window.PICKED)));
  console.log('payAsCard()      : ' + await p.evaluate(() => { try { return payAsCard(); } catch (e) { return 'threw ' + e.message; } }));

  /* press F9 and see what the counter says about it */
  const msgs = [];
  p.on('console', (m) => msgs.push(m.text().slice(0, 140)));
  await p.locator('#save').click({ timeout: 4000 }).catch((e) => console.log('save click: ' + e.message.slice(0, 60)));
  await p.waitForTimeout(2500);
  console.log('\ncart after save  : ' + await p.evaluate(() => (window.CART || []).length));
  console.log('LAST             : ' + JSON.stringify(await p.evaluate(() => window.LAST && window.LAST.no)));
  console.log('ask box open     : ' + await p.locator('#askdlg[open]').count());
  if (await p.locator('#askdlg[open]').count()) {
    console.log('  it says        : ' + (await p.locator('[data-testid="till-ask-body"]').innerText()).slice(0, 220));
  }
  console.log('last note        : ' + await p.evaluate(() => { const n = document.getElementById('lastnote'); return n ? n.textContent : ''; }));
  if (msgs.length) console.log('console          : ' + msgs.slice(-4).join(' | '));
  await p.screenshot({ path: 'C:/dev/chitbridge-web/png/sim-pay.png' });
  await b.close();
})();
