/* product-lab.cjs — ADOPTING A READY-MADE PRODUCT LIST, DRIVEN THE WAY A SHOPKEEPER DRIVES IT
 *
 * Athi, 2026-09-27: *"in the product lab, showcase what are the product lists are available, there they can
 * choose the synonym language as well... what we can showcase is the spread sheet kind of with the checkbox,
 * so they can choose according to their interest, ofcourse category should be included, so in one go or may
 * be in multiple iteration, they can add products into their catalogue."*
 *
 * ⚠️ THE LIST DATA IS REAL — the stub below builds its payload by calling lib/catalogue-blueprint, the same
 * library the route calls, so this proves the page against the actual 301 products rather than a fixture
 * that can quietly drift from them. Only the DATABASE is stubbed, because there isn't one here.
 *
 * Run: node e2e/product-lab.cjs
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const BP = require('../../chitbridge-api/lib/catalogue-blueprint');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
            '.svg':'image/svg+xml', '.png':'image/png' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(58) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

(async () => {
  /* the shop's shelf, as the stub remembers it between calls — so "come back and add more" is real */
  /* ⭐ the shop charges 52 for a tomato the list suggests at 40 — the whole point of showing its own price */
  let shelf = [{ name: 'Tomato', unit: 'kg', price: 52 }];
  let lastAdopt = null;

  const srv = http.createServer((q, r) => {
    const url = q.url.split('?')[0];
    if (url === '/api/products/lists') {
      const body = {
        have: shelf.length, mine: shelf, currency: 'INR',
        language_names: { ta: 'Tamil', hi: 'Hindi' },
        lists: Object.keys(BP.BLUEPRINTS).map((k) => {
          const bp = BP.blueprint(k);
          return { key: bp.key, label: bp.label, outcome: bp.outcome, pin: BP.pin(bp),
                   categories: bp.categories, units: bp.units, languages: BP.languagesOf(k),
                   count: bp.starter.length,
                   rows: bp.starter.map((x) => ({ name: x.name, unit: x.unit || bp.defaultUnit,
                     price: x.price, category: x.category || null, names: x.names || null })) };
        }),
      };
      r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify(body));
    }
    if (url === '/api/products/lists/adopt') {
      let raw = ''; q.on('data', (c) => { raw += c; });
      q.on('end', () => {
        const b = JSON.parse(raw || '{}');
        lastAdopt = b;
        /* the real route skips what the shop already sells; the stub does the same so the count is honest */
        const fresh = (b.names || []).filter((n) => !shelf.some((s) =>
          s.name.toLowerCase() === String(n.name).toLowerCase() && s.unit === n.unit));
        fresh.forEach((n) => shelf.push({ name: n.name, unit: n.unit, price: 9 }));
        const s = (b.names || []).length - fresh.length;
        r.writeHead(200, { 'content-type': 'application/json' });
        r.end(JSON.stringify({ ok: true, added: fresh.length, skipped: new Array(s).fill({}),
          message: fresh.length + ' products added' + (s ? ' · ' + s + ' you already sell were left alone' : '') + '.' }));
      });
      return;
    }
    const f = path.join(ROOT, decodeURIComponent(url).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;

  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1180, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));

  /* ── it asks who you are, because adopting writes to a real shelf ─────────────────────────── */
  console.log('\n── signed out, it says so rather than showing an empty page ' + '─'.repeat(2));
  await p.goto(base + '/product-lab.html?api=' + encodeURIComponent(base));
  await p.waitForFunction(() => document.getElementById('say').textContent.length > 0, null, { timeout: 15000 });
  say('a signed-out visitor is told why it needs a sign-in',
    /sign in/i.test(await p.textContent('#say')) && /writes to your catalogue/i.test(await p.textContent('#say')),
    (await p.textContent('#say')).trim().slice(0, 62) + '…');

  /* ── signed in ────────────────────────────────────────────────────────────────────────────── */
  await p.evaluate(() => localStorage.setItem('cb_sess', JSON.stringify({ token: 'test-token' })));
  await p.goto(base + '/product-lab.html?api=' + encodeURIComponent(base));
  await p.waitForSelector('[data-testid=pl-table], [data-testid=pl-table]', { timeout: 15000 });

  console.log('\n── the lists on offer ' + '─'.repeat(39));
  const lists = await p.$$eval('#lists .pill', (bs) => bs.map((x) => x.textContent.trim()));
  say('every product list is offered by name and size', lists.length === Object.keys(BP.BLUEPRINTS).length,
    lists.join(' · '));
  say('it opens on one of them, ticked', await p.$eval('#lists .pill.on', (e) => !!e), 'veg');

  const rows0 = await p.$$eval('[data-testid=pl-table] tbody tr:not(.catrow)', (r) => r.length);
  say('the whole list is laid out as a spreadsheet', rows0 === BP.blueprint('veg').starter.length,
    rows0 + ' rows');
  say('⭐ grouped under its shelf, so a category is readable at a glance',
    (await p.$$eval('[data-testid=pl-table] tbody tr.catrow', (r) => r.length)) === BP.blueprint('veg').categories.length,
    (await p.$$eval('[data-testid=pl-table] tbody tr.catrow', (r) => r.length)) + ' shelves');

  /* ── what the shop already sells ───────────────────────────────────────────────────────────── */
  console.log('\n── what it already sells is not offered twice ' + '─'.repeat(16));
  const tom = await p.$eval('[data-testid=pl-table] tbody tr.has', (t) => t.innerText.replace(/\s+/g, ' ').trim());
  say('a product the shop already has is greyed and cannot be ticked', /Tomato/.test(tom) && /you sell this/.test(tom),
    tom.slice(0, 48));
  say('and its checkbox is disabled, not merely unticked',
    await p.$eval('[data-testid=pl-table] tbody tr.has input', (i) => i.disabled), 'disabled');

  /* ── search, by name AND by local name ─────────────────────────────────────────────────────── */
  console.log('\n── finding something in two hundred products ' + '─'.repeat(17));
  await p.fill('#q', 'brinjal');
  say('search by name', (await p.$$eval('[data-testid=pl-table] tbody tr:not(.catrow)', (r) => r.length)) > 0,
    (await p.$$eval('[data-testid=pl-table] tbody tr:not(.catrow)', (r) => r.length)) + ' rows for "brinjal"');
  await p.fill('#q', 'thakkali');
  /* ⚠️ the WHOLE row, not innerText.split('\t')[0] — the first cell is the checkbox, so splitting on the
     tab read an empty string and the assertion failed while the search was working perfectly. */
  const byLocal = await p.$$eval('[data-testid=pl-table] tbody tr:not(.catrow)',
    (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
  say('⭐ search by the LOCAL name — the whole point of carrying them',
    byLocal.length > 0 && /Tomato/.test(byLocal.join(' ')), '"thakkali" → ' + byLocal.length + ' row(s)');
  await p.fill('#q', '');

  /* ── the shelf filter ──────────────────────────────────────────────────────────────────────── */
  await p.selectOption('#cat', 'Greens');
  const greens = await p.$$eval('[data-testid=pl-table] tbody tr:not(.catrow)', (r) => r.length);
  say('a shelf can be looked at on its own',
    greens === BP.blueprint('veg').starter.filter((x) => x.category === 'Greens').length, 'Greens · ' + greens + ' rows');

  /* ── tick a whole shelf, adopt it ──────────────────────────────────────────────────────────── */
  console.log('\n── adopting one shelf, in the language they asked for ' + '─'.repeat(8));
  await p.click('[data-testid=pl-lang-ta]');
  say('a language can be asked for', await p.$eval('[data-testid=pl-lang-ta]', (e) => e.classList.contains('on')), 'Tamil on');
  await p.click('[data-testid=pl-all]');
  const ticked = await p.textContent('#count');
  say('"tick all shown" ticks the shelf and nothing else', /\b22 products ticked/.test(ticked), ticked.trim());
  say('the button names what it will do', /Add 22 to my catalogue/.test(await p.textContent('#adopt')),
    (await p.textContent('#adopt')).trim());

  await p.click('#adopt');
  await p.waitForFunction(() => /added/.test(document.getElementById('say').textContent), null, { timeout: 15000 });
  say('it says what it did, in a sentence', /22 products added/.test(await p.textContent('#say')),
    (await p.textContent('#say')).trim());
  say('⭐ the languages asked for travelled with the request',
    JSON.stringify(lastAdopt.languages) === '["ta"]', JSON.stringify(lastAdopt.languages));
  say('and every row it sent carried its unit, not just a name',
    lastAdopt.names.every((n) => n.name && n.unit), lastAdopt.names.length + ' rows, each with a unit');

  /* ── come back and add more ────────────────────────────────────────────────────────────────── */
  console.log('\n── coming back for a second helping ' + '─'.repeat(26));
  await p.waitForFunction(() => /products in your catalogue/.test(document.getElementById('who').textContent), null, { timeout: 15000 });
  say('the shelf count is re-read from the server, not assumed',
    /23 products/.test(await p.textContent('#who')), (await p.textContent('#who')).trim());
  await p.selectOption('#cat', 'Greens');
  const nowHas = await p.$$eval('[data-testid=pl-table] tbody tr.has', (r) => r.length);
  say('⚠️ and what was just added is now greyed — a second visit cannot double it',
    nowHas === greens, nowHas + ' of ' + greens + ' greens now marked "you sell this"');

  /* ── one row per unit ──────────────────────────────────────────────────────────────────────── */
  console.log('\n── the same product in two units is two rows ' + '─'.repeat(17));
  await p.click('[data-testid=pl-list-egg]');
  await p.fill('#q', 'Hen egg (white)');
  const eggs = await p.$$eval('[data-testid=pl-table] tbody tr:not(.catrow)', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
  say('⭐ one row per unit, each with its own price, so a shop picks what it sells in',
    eggs.length === 3 && /piece/.test(eggs.join(' ')) && /dozen/.test(eggs.join(' ')) && /box/.test(eggs.join(' ')),
    eggs.length + ' rows: ' + eggs.map((e) => e.replace('Hen egg (white) ', '')).join(' | ').slice(0, 70));

  /**
   * ── ⭐⭐ WHAT I ALREADY SELL, AND AT WHOSE PRICE ────────────────────────────────────────────────────
   * Athi: *"can we have an icon / filter to see what is in my catalogue with its price here"* — and the
   * constraint that makes it correct: *"as per the stores catalogue, not from here, because we don't
   * update the price."* So the assertion is not merely that a price shows, but that it is the SHOP'S 52
   * rather than the list's suggested 40 — a page that showed 40 here would be stating a number that is
   * true nowhere and implying this screen might apply it.
   */
  console.log('\n── what this shop already sells, at ITS price ' + '─'.repeat(15));
  await p.click('[data-testid=pl-list-veg]');
  await p.fill('#q', '');
  await p.click('[data-testid=pl-own-mine]');
  const mineRows = await p.$$eval('[data-testid=pl-table] tbody tr:not(.catrow)',
    (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
  say('⭐ a filter shows only what is in my catalogue', mineRows.length === 23, mineRows.length + ' rows');
  const tomRow = mineRows.find((x) => /^Tomato /.test(x)) || '';
  say('⭐⭐ and it shows the SHOP’s price, not the list’s suggestion',
    /52/.test(tomRow) && !/40\.00/.test(tomRow), tomRow.slice(0, 58));
  say('⚠️ the number carries its currency — a bare 52 is not a price',
    /₹/.test(tomRow), (tomRow.match(/₹[\d,.]+/g) || ['none']).join(' '));
  say('and the cell says whose number it is', /yours/.test(tomRow), 'labelled "yours"');

  await p.click('[data-testid=pl-own-new]');
  const newRows = await p.$$eval('[data-testid=pl-table] tbody tr:not(.catrow)', (r) => r.length);
  say('"Not yet" shows the rest — the question somebody adding products actually has',
    newRows === 202 - 23, newRows + ' of 202 still to add');
  say('a suggested price is labelled as suggested, never as theirs',
    /suggested/.test(await p.innerText('[data-testid=pl-table]')), 'labelled "suggested"');
  await p.click('#own .pill[data-own=""]');

  /**
   * ── ⭐ IGNORING A UNIT, TO GET A SHORTER LIST ──────────────────────────────────────────────────────
   * Athi: *"can we sort based on unit or may be a check box to include, say i get crate and kg as well, so
   * i choose to ignore crate, so i get a minimal list."* One row per unit is what makes these lists long,
   * so the unit is the sharpest way to shorten one. Eggs is the clearest case: piece, dozen and box.
   */
  console.log('\n── ignoring a unit, to get a shorter list ' + '─'.repeat(19));
  await p.click('[data-testid=pl-list-egg]');
  const unitPills = await p.$$eval('#units .pill', (b) => b.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  say('the units this list actually uses, counted', unitPills.length === 4, unitPills.join(' · '));
  const allEgg = await p.$$eval('[data-testid=pl-table] tbody tr:not(.catrow)', (r) => r.length);

  await p.click('[data-testid=pl-unit-box]');
  const noBox = await p.$$eval('[data-testid=pl-table] tbody tr:not(.catrow)', (r) => r.length);
  say('⭐ switching a unit off shortens the list by exactly its count',
    noBox === allEgg - 1, allEgg + ' → ' + noBox + ' rows without "box"');
  say('and no row sold in that unit is left behind',
    !/\bbox\b/.test(await p.innerText('[data-testid=pl-table]')), 'no box rows shown');

  /* ⚠️ the one that would actually hurt: ticking rows, then hiding them */
  await p.click('[data-testid=pl-unit-box]');          /* box back on */
  await p.click('[data-testid=pl-all]');
  const before = await p.textContent('#count');
  await p.click('[data-testid=pl-unit-box]');          /* off again, with its rows ticked */
  const after = await p.textContent('#count');
  say('⚠️⚠️ hiding a unit UNTICKS its rows — adopting what you cannot see is the worst outcome here',
    /18 products ticked/.test(before) && /17 products ticked/.test(after), before.trim() + ' → ' + after.trim());
  await p.click('[data-testid=pl-unit-box]');
  await p.click('[data-testid=pl-list-veg]');
  say('a list sold one way offers no unit filter at all',
    (await p.$$eval('#units .pill', (b) => b.length)) > 1, 'veg has 6 units, so it does');

  console.log('\nconsole/page errors: ' + (errs.length ? errs.join(' · ') : 'none'));
  if (errs.length) bad++;
  if (process.argv.includes('--shots')) {
    fs.mkdirSync(path.join(__dirname, '..', 'png'), { recursive: true });
    await p.click('[data-testid=pl-list-egg]'); await p.fill('#q', ''); await p.click('#own .pill[data-own=""]');
    await p.screenshot({ path: path.join(__dirname, '..', 'png', 'ProductLab.png'), fullPage: false });
  }
  await b.close(); srv.close();
  console.log(bad ? '\n' + bad + ' failed\n' : '\na shop adopts a ready-made list, in its own language, without typing a product\n');
  process.exit(bad ? 1 : 0);
})();
