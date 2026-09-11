const { test } = require('@playwright/test');
const { mintEntity, addProduct } = require('../fixtures');
test('probe the lab load', async ({ page, context }) => {
  test.setTimeout(240000);
  const stamp = Date.now().toString().slice(-6);
  await mintEntity(page, { fresh: true, name: 'Probe ' + stamp });
  await addProduct(page, { name: 'Probe item ' + stamp, unit: 'piece', price: 10, code: 'PR' + stamp });
  await page.evaluate(() => { if (typeof setSession === 'function') setSession({}); });
  const lab = await context.newPage();
  lab.on('pageerror', (e) => console.log('LABERR ' + e.message.slice(0, 300)));
  await lab.goto('/offer-lab.html');
  await lab.waitForFunction(() => typeof PRODUCTS !== 'undefined', null, { timeout: 30000 });
  const out = await lab.evaluate(async () => {
    const res = {};
    res.src = (document.getElementById('src') || {}).textContent;
    let sess = null; try { sess = JSON.parse(localStorage.getItem('cb_sess') || 'null'); } catch (_) {}
    res.hasToken = !!(sess && sess.token);
    /* go the whole way by hand so every step reports */
    try {
      const r = await fetch(API + '/api/products?limit=500', { headers: { Authorization: 'Bearer ' + sess.token } });
      res.status = r.status;
      const j = await r.json();
      const list = (j.items || j.products || j.rows || (Array.isArray(j) ? j : []));
      res.returned = list.length;
      res.priced = list.filter((p) => p && p.item_data && Number(p.item_data.price) > 0).length;
      res.sample = list.slice(0, 2).map((p) => (p.item_data || {}).name + ' @' + (p.item_data || {}).price);
    } catch (e) { res.err = String(e && e.message); }
    return res;
  });
  console.log('PROBE ' + JSON.stringify(out, null, 2));
});
