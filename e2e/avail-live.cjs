/* Does bulk availability actually work end to end, and does categorise now take one request? */
const { chromium } = require('@playwright/test');
const { mintEntity } = require('./fixtures');
const N = 8;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: process.env.CB_WEB_BASE || 'http://localhost:5173' });
  const page = await ctx.newPage();
  try {
    await mintEntity(page);
    const out = await page.evaluate(async (n) => {
      const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SESSION.token };
      const mk = (i) => ({ name: 'Avail item ' + i, price: 50 + i, unit: 'piece' });
      const made = await (await fetch(CFG.API_BASE + '/api/products/bulk', { method: 'POST', headers: H,
        body: JSON.stringify({ items: Array.from({ length: n }, (_, i) => mk(i)) }) })).json();
      const ids = (made.items || []).map((x) => x.item_id);

      const t0 = performance.now();
      const r = await fetch(CFG.API_BASE + '/api/products/status/bulk', { method: 'POST', headers: H,
        body: JSON.stringify({ ids: ids, status: 'unavailable' }) });
      const st = await r.json();
      const ms = Math.round(performance.now() - t0);

      /* Did it actually take? Ask the list, filtered the way the customer view will. */
      const all = await (await fetch(CFG.API_BASE + '/api/products', { headers: H })).json();
      const rows = all.items || all.products || [];
      const mine = rows.filter((x) => ((x.item_data || {}).name || '').indexOf('Avail item') === 0);
      const unavail = mine.filter((x) => (x.item_data || {}).status === 'unavailable').length;

      /* And the server-side filter the storefront should use. */
      const av = await (await fetch(CFG.API_BASE + '/api/products?status=available', { headers: H })).json();
      const avRows = (av.items || av.products || []).filter((x) => ((x.item_data||{}).name||'').indexOf('Avail item') === 0);

      /* Refusals: a lifecycle status must not be settable in bulk. */
      const badR = await fetch(CFG.API_BASE + '/api/products/status/bulk', { method: 'POST', headers: H,
        body: JSON.stringify({ ids: ids, status: 'retired' }) });
      const bad = await badR.json();

      return { created: ids.length, bulkMs: ms, status: r.status, updated: st.updated,
               nowUnavailable: unavail + '/' + mine.length,
               availableFilterReturns: avRows.length,
               retiredRefused: badR.status + ' ' + (bad.message || '').slice(0, 60) };
    }, N);
    console.log(JSON.stringify(out, null, 1));
    console.log('\n  ' + out.created + ' products · bulk availability in ' + out.bulkMs + 'ms · now unavailable: '
      + out.nowUnavailable);
    console.log('  ?status=available returns ' + out.availableFilterReturns
      + (out.availableFilterReturns === 0 ? '  ✓ hidden from an available-only view' : '  ✗ still listed'));
    console.log('  bulk retired: ' + out.retiredRefused);
  } catch (e) { console.error('FAILED', e.message); process.exitCode = 1; }
  finally { await b.close(); }
})();
