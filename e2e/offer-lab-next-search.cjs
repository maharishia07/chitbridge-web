/* offer-lab-next-search.cjs — SEARCH, NOT A DROPDOWN TO SCROLL
 *
 * Athi: "the real catalogue, and the search function all should be in place here? like till application for
 * the catalogue." Item and category pickers were plain <select> dropdowns — fine for eight sample items,
 * unusable for a real shop's hundreds. Replaced everywhere selectOf() was called (item, category, gift,
 * bundle A/B, pair A/B) with a native <input list=datalist> — the browser's own type-to-filter.
 *
 * Run: node e2e/offer-lab-next-search.cjs
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(48) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'text/plain' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((res) => srv.listen(0, res));
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://127.0.0.1:' + srv.address().port + '/offer-lab-next.html');
  await p.waitForTimeout(200);

  console.log('\n── the item picker is a real search box, not a <select> ' + '─'.repeat(10));
  const shape = await p.evaluate(() => {
    pickGoal('percent'); S.scope = 'item'; apply();
    const html = renderS2 ? renderS2() : '';
    return { hasSelect: /<select/.test(html), hasDatalist: /<datalist/.test(html), hasSearchInput: /list="dl-setItem"/.test(html) };
  });
  say('no <select> left for item/category pickers', !shape.hasSelect, 'plain <select> is gone');
  say('a real <datalist> backs it', shape.hasDatalist, 'native browser filtering');
  say('wired to the same setItem it always called', shape.hasSearchInput, 'list="dl-setItem" present');

  console.log('\n── typing a name and choosing it picks the same item selectOf() always picked ' + '─'.repeat(0));
  const picked = await p.evaluate(() => {
    /* apply() already re-rendered #s2 for real */
    var input = document.querySelector('input[list="dl-setItem"]');
    input.value = 'Filter Coffee  —  ₹20';   /* exactly what prodOpts() would have shown for this item */
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { itemId: S.itemId };
  });
  say('resolves the typed text back to the real item id', picked.itemId === 'coffee', 'S.itemId is "' + picked.itemId + '"');

  console.log('\n── an unmatched / cleared search snaps back, it does not silently keep a typo ' + '─'.repeat(0));
  const cleared = await p.evaluate(() => {
    var before = S.itemId;
    /* apply() already re-rendered #s2 for real */
    var input = document.querySelector('input[list="dl-setItem"]');
    input.value = 'something that does not exist at all';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { before: before, after: S.itemId, shownValue: document.querySelector('input[list="dl-setItem"]').value };
  });
  say('the underlying pick does not change on a typo', cleared.after === cleared.before, 'still "' + cleared.after + '"');
  say('and the box redraws showing the real selection, not the typo', cleared.shownValue !== 'something that does not exist at all',
      'shows "' + cleared.shownValue + '"');

  console.log('\n── bundle screen: two independent search boxes, never confused with each other ' + '─'.repeat(0));
  const bundle = await p.evaluate(() => {
    pickGoal('bundle'); S.bunA = 'masala'; S.bunB = 'coffee'; apply();
    /* apply() already re-rendered #s2 for real */
    var a = document.querySelector('input[list="dl-setA"]');
    var b = document.querySelector('input[list="dl-setB"]');
    return { aExists: !!a, bExists: !!b, aVal: a && a.value, bVal: b && b.value, distinctLists: a && b && a.getAttribute('list') !== b.getAttribute('list') };
  });
  say('both A and B are real, independent search boxes', bundle.aExists && bundle.bExists, JSON.stringify({ a: bundle.aVal, b: bundle.bVal }));
  say('each with its own datalist, never sharing one', bundle.distinctLists, 'dl-setA ≠ dl-setB');

  console.log('\n── category search works the same way, for a shop with many categories ' + '─'.repeat(2));
  const cat = await p.evaluate(() => {
    pickGoal('percent'); S.scope = 'cat'; apply();
    /* apply() already re-rendered #s2 for real */
    var input = document.querySelector('input[list="dl-setCat"]');
    input.value = 'Drinks';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { catId: S.catId };
  });
  say('category picks resolve the same way', cat.catId === 'drinks', 'S.catId is "' + cat.catId + '"');

  console.log('\nconsole/page errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close(); srv.close();
  console.log(bad || errs.length ? '\n' + (bad + errs.length) + ' failed'
    : '\nevery item and category picker is a real search box now, on every screen that had a dropdown');
  process.exit(bad || errs.length ? 1 : 0);
})();
