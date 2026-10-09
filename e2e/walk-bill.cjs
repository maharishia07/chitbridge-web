#!/usr/bin/env node
/**
 * e2e/walk-bill.cjs - THE TILL, WALKED: making a bill the way a cashier does (rows TB1-TB10 / BF1-BF8 of C:/dev/TEST-LOG-2026-10-09.md, round 4).
 * Black box: it types in the search box, presses the real buttons (Park, the parked chip, Day report, Close the day) and reads what the counter says.
 * A FIXTURE shop ("Walk Cafe", GSTIN set so it charges GST): till.html is served from this checkout, the API is a stand-in answering inside the page,
 * the bill is never saved, window.print is silenced (a count says it was never reached). Nothing leaves the machine - Athi's working shops are never touched.
 *
 *   NODE_PATH=e2e/node_modules node e2e/walk-bill.cjs         headless, fast
 *   node e2e/walk-bill.cjs --show                              watch it: headed, a caption per step, green/red per step, a results page that stays open
 * One line per path: "ID · path · PASS/FAIL (what it saw)". Screenshots: e2e/shots/walk-bill-NN.png.
 */
'use strict';
const W = require('./lib/walk.cjs');

W.run('bill', async (w) => {
  const { page, ctx, base } = w;
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.goto(base + '/till.html');
  await page.waitForFunction(() => typeof window.modOpen === 'function' && typeof window.parkBill === 'function' && typeof window.dayClose === 'function' && window.CBTax, null, { timeout: 30000 });
  /* the fixture shop and its shelf */
  await page.evaluate((api) => {
    CloudHost.key = 'demo-key'; CloudHost.api = api; HOST = CloudHost;
    window.ageAllow = async () => true;
    window.tillStopped = async () => false;                 /* the fixture counter counts as signed in and paired: the gate is walked by hand (H20), not here */
    try { WHO = { name: 'Walk Cashier' }; } catch (_) {}
    var spice = [{ name: 'Spice', required: true, max: 1, options: [{ name: 'Medium', price: 0 }, { name: 'Hot', price: 10 }] }];
    window.S = { shop: { name: 'Walk Cafe', currency: 'INR', gstin: '29ABCPE1234F1Z7', state_code: '29', reg_type: 'regular', address: 'Bengaluru, Karnataka 560001' },
      at: new Date().toISOString(), offers: [], slabs: [],
      items: [{ item_id: 'dosa', name: 'Masala Dosa', price: 70, unit: 'plate', _rate: 5 },
              { item_id: 'poori', name: 'Poori', price: 50, unit: 'plate' },
              { item_id: 'paneer', name: 'Chilli Paneer', price: 185, unit: 'plate', _rate: 5, item_data: { modifiers: spice } },
              { item_id: 'tea', name: 'Tea', price: 10, unit: 'cup', _rate: 5 }] };
    CART = []; MODE = 'sell'; PARKED = []; try { ls.set(shopLs('cb_till_dayclosed'), 'null'); } catch (_) {}
  }, base);
  /* a sign-in or pairing sheet over the till would hide the controls - close any dialog that opened by itself */
  await page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (_) {} }); });

  const type = async (name) => { await page.fill('#q', name); await page.waitForTimeout(250); await page.press('#q', 'Enter'); await page.waitForTimeout(500); };
  const cart = () => page.evaluate(() => CART.map((l) => ({ name: l.name, qty: l.qty, price: l.price, mods: (l.mods || []).map((m) => m.option) })));
  const note = () => page.evaluate(() => (document.getElementById('lastnote') || {}).textContent || '');
  const screenText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

  await w.step('TB1', 'Till -> type "Masala Dosa", Enter -> the bill has one Masala Dosa at the shelf price', async () => {
    await type('Masala Dosa'); const c = await cart();
    const total = await page.locator('[data-testid="till-total"]').first().innerText().catch(() => '');
    return { ok: c.length === 1 && c[0].name === 'Masala Dosa' && c[0].price === 70, saw: JSON.stringify(c) + ' - total on screen: ' + (total || 'not drawn') };
  });
  await w.step('BF1', 'Add Poori (the shelf has no tax rate for it) -> the till says so, naming Poori', async () => {
    await type('Poori'); const c = await cart(); const n = await note(); const t = await screenText();
    const said = /Poori has no tax rate/.test(n) || /Poori has no tax rate/.test(t);
    return { ok: c.length === 2 && said, saw: 'bill has ' + c.length + ' lines; the till said: "' + (/no tax rate/.test(n) ? n : (t.match(/[^.]{0,40}has no tax rate[^.]{0,60}/) || ['nothing about a missing rate'])[0]).trim() + '"' };
  });
  await w.step('BF3', 'Add Chilli Paneer -> the choice sheet opens -> pick Hot, Add -> the bill line carries "Hot" and its price', async () => {
    await page.fill('#q', 'Chilli Paneer'); await page.waitForTimeout(250); await page.press('#q', 'Enter');
    await page.waitForSelector('#moddlg[open]', { timeout: 6000 });
    await page.click('#moddlg button:has-text("Hot")'); await page.waitForTimeout(250);
    await page.click('[data-testid="till-mod-add"]'); await page.waitForTimeout(500);
    const c = await cart(); const l = c.find((x) => x.name === 'Chilli Paneer');
    return { ok: !!l && l.mods.indexOf('Hot') >= 0 && l.price === 195, saw: l ? 'line: ' + l.name + ' with ' + l.mods.join(', ') + ' at ' + l.price : 'no Chilli Paneer on the bill' };
  });
  await w.step('TB4', 'Pay by Cash, press Park -> start another bill and choose Card -> press the parked bill -> it comes back with Cash, its own', async () => {
    await page.evaluate(() => { pickPay('Cash'); });
    await page.click('[data-testid="till-park"]'); await page.waitForTimeout(400);
    const parked = await page.evaluate(() => PARKED.length), emptied = (await cart()).length === 0;
    await type('Tea'); await page.evaluate(() => { pickPay('Card'); }); await page.waitForTimeout(200);
    await page.click('[data-testid="till-parked-0"]'); await page.waitForTimeout(500);
    const got = await page.evaluate(() => ({ picked: PICKED, lines: CART.map((l) => l.name), parkedNow: PARKED.length }));
    return { ok: parked === 1 && emptied && got.picked === 'Cash' && got.lines.indexOf('Chilli Paneer') >= 0, saw: 'parked ' + parked + ', screen cleared ' + emptied + '; recalled bill shows ' + got.lines.join(' + ') + ' paid by ' + got.picked + ' (the bill after it was Card); ' + got.parkedNow + ' left on the rail (the Tea bill, kept)' };
  });
  await w.step('TB9a', 'Day report -> says "not closed yet" and does NOT close the day', async () => {
    await page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (_) {} }); });
    await page.evaluate(() => dayClose()); await page.waitForSelector('#slipdlg[open]', { timeout: 5000 });
    const title = await page.locator('#sliptitle').innerText(); const closeBtn = await page.locator('[data-testid="till-day-close-do"]').isVisible();
    const marked = await page.evaluate(() => !!dayClosedMark());
    return { ok: /not closed yet/.test(title) && closeBtn && !marked, saw: '"' + title + '"; the "Close the day" button is ' + (closeBtn ? 'there' : 'MISSING') + '; day marked closed: ' + marked };
  });
  await w.step('TB9b', 'Press "Close the day" -> the sheet says "Day closed", the button goes away, the day is marked', async () => {
    await page.click('[data-testid="till-day-close-do"]'); await page.waitForTimeout(400);
    const title = await page.locator('#sliptitle').innerText(); const hidden = !(await page.locator('[data-testid="till-day-close-do"]').isVisible());
    const marked = await page.evaluate(() => !!dayClosedMark());
    return { ok: /^Day closed/.test(title) && hidden && marked, saw: '"' + title + '"; button ' + (hidden ? 'gone' : 'still there') + '; day marked closed: ' + marked };
  });
  await w.step('PRINT', 'Nothing opened a print dialog during the walk', async () => {
    const printed = await page.evaluate(() => window.__printed || 0);
    return { ok: printed === 0, saw: 'window.print was silenced; called ' + printed + ' time(s) by the screens walked' };
  });
  w.note('TB2', 'Till signed in as the owner (no "Not signed in yet" on an open shop)', 'open (H20): needs the real sign-in path - walked by hand, not scripted yet');
});
