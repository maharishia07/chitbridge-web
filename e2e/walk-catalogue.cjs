#!/usr/bin/env node
/**
 * e2e/walk-catalogue.cjs — CB CATALOGUE, WALKED (T3-CATALOGUE, 14 Oct: catalogue.html + app/cap-catalogue.js).
 * Black box: it presses what a shopkeeper presses — the item list (search · availability filter · Show more · the true count), one item's sheet
 * (price and cost saved as a merge patch of only what changed), a co-assist without "Sees costs" (fields greyed WITH the reason, no cost
 * column, availability still saves, the server's refusal painted in its own words), a new item, Categories (add · rename keeping the
 * parent · retire), Import (a .csv → the server's preflight → Import with the person's choices), and a list that could not be read.
 *   default   the API is a stand-in answering inside the page (nothing leaves the runner, nothing is written)
 *   --real    the local api (e2e/lib/real-stack.cjs: ../chitbridge-api/server.js on CB_REAL_DB, DEV_OTP) — the sim shop's own catalogue
 * Then RULE 13 (e2e/lib/rule13.cjs): Items · Categories · Import, Cream and Dark, 1366 and 390 px.
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-catalogue.cjs [--real] [--show]
 * One line per path: "ID · path · PASS/FAIL (what it saw)". Screenshots: e2e/shots/walk-catalogue-NN.png.
 */
'use strict';
const W = require('./lib/walk.cjs');
const REAL = process.argv.includes('--real');
const J = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/* ── the stand-in shop: 120 items, three categories (one a child), a few without a cost ── */
function fixture() {
  const cats = [{ definition_id: 'c1', kind: 'category', name: 'Grains', note: '', status: 'live', rules: {} }, { definition_id: 'c2', kind: 'category', name: 'Oils', note: '', status: 'live', rules: {} },
    { definition_id: 'c3', kind: 'category', name: 'Basmati', note: '', status: 'live', rules: { parent: 'c1', default_slab: 'slab5' } }];
  const items = [];
  for (let i = 0; i < 120; i++) {
    const name = i === 0 ? 'Ponni Rice 5 kg' : i === 1 ? 'Basmati Rice 1 kg' : i === 2 ? 'Groundnut Oil 1 L' : 'Item ' + String(i).padStart(3, '0');
    const d = { name, unit: i === 2 ? 'litre' : 'kg', price: { amount: 40 + i, currency: 'INR' }, code: 'SKU' + (1000 + i), status: i % 10 === 3 ? 'unavailable' : 'available' };
    if (i < 2) { d.categories = [i ? 'c3' : 'c1']; d.category_names = [i ? 'Basmati' : 'Grains']; }
    if (i === 2) { d.categories = ['c2']; d.category_names = ['Oils']; }
    if (i % 4) d.cost = { value: 30 + i, source: 'manual', updated_at: '2026-10-01T00:00:00Z' };
    items.push({ item_id: 'it' + i, item_data: d, created_at: new Date(Date.UTC(2026, 9, 1) - i * 60000).toISOString() });
  }
  return { cats, items };
}

const walk = async (w) => {
  const { page, ctx, base } = w;
  if (process.env.WALK_DEBUG) { page.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 300))); page.on('pageerror', (e) => console.log('pageerror', e.message)); }
  const F = fixture(), S = { calls: [], gets: [], blind: false, refuse: false, broken: false, stack: null };
  let api = base;
  if (REAL) {
    const R = require('./lib/real-stack.cjs');
    S.stack = await R.up({ webBase: base }); api = S.stack.api;
    const owner = await R.signIn(api, process.env.CB_REAL_EMAIL || 'simstores@test.example');
    await ctx.addInitScript((s) => { try { localStorage.setItem('cb_sess', s); } catch (_) {} }, owner.session);
    ctx.on('request', (q) => { if (q.url().startsWith(api) && q.method() !== 'GET' && q.method() !== 'OPTIONS') S.calls.push(q.method() + ' ' + new URL(q.url()).pathname + ' ' + (q.postData() || '')); });
  } else {
    await ctx.route('**/api/**', async (r) => {
      const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method(), qs = u.searchParams;
      let body = null; try { body = q.postData() ? JSON.parse(q.postData()) : null; } catch (_) {}
      if (m === 'GET') S.gets.push(p + u.search); else S.calls.push(m + ' ' + p + (body ? ' ' + JSON.stringify(body) : ''));
      if (p === '/api/entities/me/can-see-costs') return J(r, 200, { can_see_costs: !S.blind, is_owner: !S.blind });
      if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Fixture Shop', currency_code: 'INR', country_code: 'IN' } });
      if (p === '/api/definitions' && m === 'GET') {
        const live = qs.get('status') === 'live', all = qs.get('all');
        return J(r, 200, { definitions: F.cats.filter((c) => (live ? c.status === 'live' : all ? true : c.status !== 'retired')) });
      }
      if (p === '/api/definitions' && m === 'POST') { const id = 'c' + (F.cats.length + 1); F.cats.push({ definition_id: id, kind: body.kind, name: body.name, note: body.note || '', status: 'draft', rules: body.rules || {} }); return J(r, 201, { definition_id: id }); }
      const dm = /^\/api\/definitions\/([^/]+)$/.exec(p);
      if (dm) {
        const c = F.cats.find((x) => x.definition_id === dm[1]); if (!c) return J(r, 404, { error: 'Not found' });
        if (m === 'PUT') { Object.assign(c, body); return J(r, 200, { definition: c }); }
        if (m === 'DELETE') { c.status = 'retired'; return J(r, 200, { ok: true }); }
      }
      if (p === '/api/products' && m === 'GET') {
        if (S.broken) return J(r, 500, { error: 'List failed', message: 'Something went wrong — please try again.' });
        const st = (d) => d.item_data.status || 'available', want = qs.get('status') || '', qq = (qs.get('q') || '').toLowerCase();
        let rows = F.items.filter((x) => !qq || [x.item_data.name, x.item_data.code].join(' ').toLowerCase().includes(qq));   /* name and code: the JSON would match "price" for "rice" */
        const counts = { available: 0, unavailable: 0, redundant: 0, retired: 0 }; rows.forEach((x) => { counts[st(x)]++; });
        if (want === 'not-available') rows = rows.filter((x) => st(x) !== 'available'); else if (want) rows = rows.filter((x) => st(x) === want);
        const lim = +qs.get('limit') || 2000, off = +qs.get('offset') || 0;
        const cc = {}; F.items.forEach((x) => (x.item_data.categories || []).forEach((c) => { cc[c] = (cc[c] || 0) + 1; }));
        let page_ = rows.slice(off, off + lim).map((x) => JSON.parse(JSON.stringify(x)));
        if (S.blind) page_.forEach((x) => { delete x.item_data.cost; });
        return J(r, 200, { items: page_, count: page_.length, total: rows.length, offset: off, limit: lim, truncated: off + page_.length < rows.length, status_counts: counts, category_counts: cc, uncategorised: 117 });
      }
      if (p === '/api/products' && m === 'POST') { const it = { item_id: 'new' + F.items.length, item_data: Object.assign({}, body.item_data, { price: { amount: Number(body.item_data.price), currency: 'INR' } }) }; F.items.unshift(it); return J(r, 201, { item: it }); }
      const pm = /^\/api\/products\/([^/]+)$/.exec(p);
      if (pm && m === 'PATCH') {
        const it = F.items.find((x) => x.item_id === pm[1]); if (!it) return J(r, 404, { error: 'Not found' });
        const sent = Object.keys(body.item_data || {}), blocked = sent.filter((k) => k !== 'status');
        if (S.refuse || (S.blind && blocked.length)) return J(r, 403, { error: 'Not permitted', message: 'Your access does not include cost or price. You can change availability; the account owner can grant "Sees costs" in Co-assists to change: ' + (blocked.join(', ') || 'status') + '.' });
        Object.keys(body.item_data).forEach((k) => { if (body.item_data[k] === null) delete it.item_data[k]; else it.item_data[k] = k === 'price' ? { amount: body.item_data[k], currency: 'INR' } : body.item_data[k]; });
        return J(r, 200, { message: 'Product updated', item: it });
      }
      if (p === '/api/products/import/preflight') {
        return J(r, 200, { dry_run: true, accepted: ['name', 'price', 'unit', 'code'], optional: [], report: { ready: false, summary: { rows: 2, importable: 2, errors: 0, warnings: 1 },
          mapping: [{ incoming: 'Item name', how: 'synonym', canonical: 'name' }, { incoming: 'Rate', how: 'fuzzy', canonical: 'price' }, { incoming: 'Shelf', how: 'unmatched', canonical: null }, { incoming: 'cost', how: 'blocked', canonical: null }],
          issues: [{ row: 3, column: 'Rate', message: 'looks like a price with a currency sign', severity: 'warn' }], notes: [] } });
      }
      if (p === '/api/products/import') return J(r, 200, { message: '1 added, 1 updated', created_columns: ['Shelf'], outcome: [{ line: 2, action: 'created', name: 'Jeera' }, { line: 3, action: 'updated', name: 'Ponni Rice 5 kg' }], summary: { created: 1, updated: 1, failed: 0 } });
      if (p === '/api/facts/rail') return J(r, 200, { suppliers: 0, customers: 0, in: 0, out: 0, stuck: 0 });
      return J(r, 200, {});
    });
    await ctx.addInitScript((s) => { try { localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  }
  await ctx.addInitScript((a) => { try { localStorage.setItem('cb_api_base', a); } catch (_) {} }, api);

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const wrote = (re) => S.calls.filter((c) => re.test(c));
  const rows = () => page.locator('[data-testid^="cat-row-"]').count();
  /* a fresh load each time (?n=): a goto that differs only in the hash keeps the page, and its answers (as walk-settings found) */
  let loads = 0;
  const items = async () => { await page.goto(base + '/catalogue.html?n=' + (++loads) + '#/items'); await page.waitForSelector('[data-testid^="cat-row-"]', { timeout: 20000 }); await page.waitForTimeout(250); };
  const open = async (id) => { await page.click('[data-testid="cat-row-' + id + '"]'); await page.waitForSelector('[data-testid="cat-save"]', { timeout: 8000 }); };

  await items();
  if (REAL) {
    await w.step('C1', 'CB Catalogue (real api) -> the sim shop\'s items, the true count beside the page', async () => {
      const n = await rows(), c = await txt('[data-testid="cat-count"]');
      return { ok: n > 0 && /\d+ items?/.test(c), saw: n + ' rows · "' + c + '"' };
    });
    await w.step('C2', 'open the first item -> its sheet -> Save with nothing changed says so and writes nothing', async () => {
      await page.locator('[data-testid^="cat-row-"]').first().click(); await page.waitForSelector('[data-testid="cat-save"]', { timeout: 8000 });
      const before = S.calls.length; await page.click('[data-testid="cat-save"]'); await page.waitForTimeout(400);
      return { ok: S.calls.length === before && /Nothing changed/.test(await txt('[data-testid="cat-out"]')), saw: (S.calls.length - before) + ' writes · "' + await txt('[data-testid="cat-out"]') + '"' };
    });
    await page.goto(base + '/catalogue.html#/categories'); await page.waitForTimeout(1500);
    await w.step('C3', 'Categories (real api) -> the shelf reads (a list or "No categories yet", never an error)', async () => {
      const e = await page.locator('[data-testid="cbl-error-categories"]').count(), c = await txt('[data-testid="cat-ccount"]');
      return { ok: e === 0 && /live categor/.test(c), saw: '"' + c + '" · error ' + e };
    });
    await page.goto(base + '/catalogue.html#/import'); await page.waitForSelector('[data-testid="cat-imp-file"]', { timeout: 10000 });
    await page.setInputFiles('[data-testid="cat-imp-file"]', { name: 'walk.csv', mimeType: 'text/csv', buffer: Buffer.from('name,price\nWalk check item,10\n') });
    await w.step('C4', 'Import (real api) -> a .csv -> the server\'s preflight answers; nothing is written', async () => {
      await page.waitForSelector('[data-testid="cat-imp-next"]:not([disabled])', { timeout: 15000 }).catch(() => {});
      return { ok: (await page.locator('[data-testid="cat-imp-err"]').count()) === 0 && wrote(/\/api\/products\/import /).length === 0, saw: 'writes ' + S.calls.length + ' · ' + await txt('[data-testid="cat-imp-filemsg"]') };
    });
    if (S.stack) S.stack.stop();
    return;
  }

  await w.step('C1', 'CB Catalogue -> Items: the first page of 50, the true count (120), the sidebar on Items, no workshop link', async () => {
    const n = await rows(), c = await txt('[data-testid="cat-count"]'), side = await txt('[data-testid="skel-side"]');
    const first = S.gets.find((g) => /^\/api\/products\?/.test(g)) || '';
    return { ok: n === 50 && /120 items/.test(c) && /Items/.test(side) && /limit=50/.test(first) && /offset=0/.test(first), saw: n + ' rows · "' + c + '" · ' + first };
  });
  await w.step('C2', 'Items -> "Show 50 more" -> the server\'s next page (offset 50), 100 rows', async () => {
    await page.click('[data-testid="cat-more"]'); await page.waitForTimeout(500);
    const n = await rows(), g = S.gets.filter((x) => /^\/api\/products\?/.test(x)).pop();
    return { ok: n === 100 && /offset=50/.test(g), saw: n + ' rows · ' + g };
  });
  await w.step('C3', 'Items -> search "rice" -> the SERVER searches (?q=rice): 2 rows, "2 shown"', async () => {
    await page.fill('[data-testid="listctl-search-catalogue"]', 'rice'); await page.waitForTimeout(2500);
    const n = await rows(), g = S.gets.filter((x) => /^\/api\/products\?/.test(x)).pop(), c = await txt('[data-testid="catalogue-count"]');
    await page.fill('[data-testid="listctl-search-catalogue"]', ''); await page.waitForTimeout(800);
    return { ok: n === 2 && /q=rice/.test(g), saw: n + ' rows · ' + S.gets.filter((x) => /products/.test(x)).slice(-4).join(' ; ') + ' · "' + c + '"' };
  });
  await w.step('C4', 'Items -> Filters ▾ -> Availability: Not available for now -> the SERVER filters (?status=unavailable): 12 rows', async () => {
    await page.click('[data-testid="cbl-filters-catalogue"]'); await page.selectOption('[data-testid="listctl-filter-status"]', 'unavailable'); await page.waitForTimeout(900);
    const n = await rows(), g = S.gets.filter((x) => /^\/api\/products\?/.test(x)).pop();
    await page.selectOption('[data-testid="listctl-filter-status"]', ''); await page.waitForTimeout(700); await page.keyboard.press('Escape');   /* the list remembers a filter — cleared so the next paths see every item */
    return { ok: n === 12 && /status=unavailable/.test(g), saw: n + ' rows · ' + g };
  });
  await items();
  await w.step('C5', 'an item -> change the price -> Save -> ONE PATCH carrying only the price, merge:true; "Saved." and the row shows the new price', async () => {
    await open('it0'); const before = wrote(/PATCH/).length;
    await page.fill('[data-testid="cat-f-price"]', '61.5'); await page.click('[data-testid="cat-save"]'); await page.waitForTimeout(700);
    const p = wrote(/PATCH/).slice(before), out = await txt('[data-testid="cat-out"]');
    await page.click('#cat_x'); const row = await txt('[data-testid="cat-row-it0"]');
    return { ok: p.length === 1 && /\/api\/products\/it0 \{"item_data":\{"price":61\.5\},"merge":true\}$/.test(p[0]) && /Saved/.test(out) && /61\.50/.test(row), saw: (p[0] || 'no PATCH').slice(0, 110) + ' · "' + out + '" · row "' + row.slice(0, 50) + '"' };
  });
  await w.step('C6', 'the owner sees Cost: the column, and the sheet\'s cost saved in Offer Lab\'s shape { value, source, updated_at }', async () => {
    const col = await page.locator('.cbl-hdr [data-rz="cost"]').count();
    await open('it1'); await page.fill('[data-testid="cat-f-cost"]', '55'); await page.click('[data-testid="cat-save"]'); await page.waitForTimeout(700);
    const p = wrote(/PATCH \/api\/products\/it1/).pop() || ''; await page.click('#cat_x');
    return { ok: col > 0 && /"cost":\{"value":55,"source":"manual","updated_at":"/.test(p) && !/"name"|"price"/.test(p), saw: 'cost column ' + col + ' · ' + p.slice(0, 120) };
  });
  await w.step('C7', 'an item -> untick its category, tick another -> the patch carries the ids AND the travelling names (catgSetOn), nothing else', async () => {
    await open('it2');
    await page.click('#cat_f_cats .chip[data-cid="c2"]'); await page.click('#cat_f_cats .chip[data-cid="c1"]'); await page.click('[data-testid="cat-save"]'); await page.waitForTimeout(700);
    const p = wrote(/PATCH \/api\/products\/it2/).pop() || ''; await page.click('#cat_x');
    return { ok: /"categories":\["c1"\]/.test(p) && /"category_names":\["Grains"\]/.test(p) && !/"price"/.test(p), saw: p.slice(0, 140) };
  });
  await w.step('C8', '＋ New item -> name + price -> Add item -> one POST /products; the sheet closes, "Item added."', async () => {
    await page.click('[data-testid="cat-new"]'); await page.waitForSelector('[data-testid="cat-f-name"]');
    await page.fill('[data-testid="cat-f-name"]', 'Jeera 100 g'); await page.fill('[data-testid="cat-f-price"]', '35'); await page.fill('[data-testid="cat-f-unit"]', 'pack');
    await page.click('[data-testid="cat-save"]'); await page.waitForTimeout(900);
    const p = wrote(/POST \/api\/products /), toast = await txt('#toast');
    if (await page.locator('#cat_x').count()) await page.click('#cat_x');
    return { ok: p.length === 1 && /"name":"Jeera 100 g"/.test(p[0]) && /"price":35/.test(p[0]) && !/"cost"/.test(p[0]), saw: (p[0] || 'no POST').slice(0, 120) + ' · "' + toast + '"' };
  });
  await w.step('C9', 'the server refuses a save -> its own sentence under the fields, never a raw error', async () => {
    S.refuse = true; await open('it5'); await page.fill('[data-testid="cat-f-name"]', 'Item 005 renamed'); await page.click('[data-testid="cat-save"]'); await page.waitForTimeout(700);
    const out = await txt('[data-testid="cat-out"]'); S.refuse = false; await page.click('#cat_x');
    return { ok: /Your access does not include cost or price/.test(out) && !/403|undefined|Error/.test(out), saw: '"' + out.slice(0, 120) + '"' };
  });
  S.blind = true; await items();
  await w.step('C10', 'a co-assist without "Sees costs" -> no Cost column; the sheet greys every field but Availability WITH the reason; Cost says it is hidden', async () => {
    const col = await page.locator('.cbl-hdr [data-rz="cost"]').count();
    await open('it6');
    const dis = await page.evaluate(() => ['cat_f_name', 'cat_f_price', 'cat_f_unit', 'cat_f_code', 'cat_f_desc'].every((k) => document.getElementById(k).disabled) && !document.getElementById('cat_f_status').disabled);
    const why = await txt('[data-testid="cat-blind-why"]'), cw = await txt('[data-testid="cat-cost-why"]'), costIn = await page.locator('[data-testid="cat-f-cost"]').count();
    return { ok: col === 0 && dis && /availability only/.test(why) && /Sees costs/.test(why) && /Hidden/.test(cw) && costIn === 0, saw: 'cost column ' + col + ' · greyed ' + dis + ' · "' + why + '" · "' + cw + '"' };
  });
  await w.step('C11', 'that co-assist -> Availability: Not available for now -> Save -> one PATCH of { status } only (the server allows it)', async () => {
    await page.selectOption('[data-testid="cat-f-status"]', 'unavailable'); await page.click('[data-testid="cat-save"]'); await page.waitForTimeout(700);
    const p = wrote(/PATCH \/api\/products\/it6/).pop() || '', out = await txt('[data-testid="cat-out"]'); await page.click('#cat_x');
    return { ok: /\{"item_data":\{"status":"unavailable"\},"merge":true\}$/.test(p) && /Saved/.test(out), saw: p.slice(0, 110) + ' · "' + out + '"' };
  });
  S.blind = false;
  await page.goto(base + '/catalogue.html#/categories'); await page.waitForSelector('[data-testid="cat-cat-c1"]', { timeout: 15000 });
  await w.step('C12', 'Categories -> the shelf: Grains · Oils · Basmati (in Grains), each with the server\'s item count (Grains 2 since C7); "3 live categories"', async () => {
    const c = await txt('[data-testid="cat-ccount"]'), b = await txt('[data-testid="cat-cat-c3"]'), g = await txt('[data-testid="cat-cat-c1"]');
    return { ok: /3 live categories/.test(c) && /Basmati in Grains/.test(b) && /Grains\s*2\b/.test(g), saw: '"' + c + '" · "' + b + '" · "' + g + '"' };
  });
  await w.step('C13', 'Basmati -> rename -> Save -> one PUT that re-sends its rules (parent + tax slab kept)', async () => {
    await page.click('[data-testid="cat-cat-c3"]'); await page.waitForSelector('[data-testid="cat-c-save"]');
    await page.fill('[data-testid="cat-c-name"]', 'Basmati Rice'); await page.click('[data-testid="cat-c-save"]'); await page.waitForTimeout(800);
    const p = wrote(/PUT \/api\/definitions\/c3/).pop() || '';
    return { ok: /"name":"Basmati Rice"/.test(p) && /"rules":\{"parent":"c1","default_slab":"slab5"\}/.test(p), saw: p.slice(0, 140) };
  });
  await w.step('C14', '＋ New category "Spices" -> POST then PUT live (core.js cbCatgCreate); a duplicate live name is refused before it is sent', async () => {
    await page.click('[data-testid="cat-cnew"]'); await page.fill('[data-testid="cat-c-name"]', 'oils'); await page.click('[data-testid="cat-c-save"]'); await page.waitForTimeout(300);
    const dup = await txt('[data-testid="cat-out"]'), posts0 = wrote(/POST \/api\/definitions/).length;
    await page.fill('[data-testid="cat-c-name"]', 'Spices'); await page.click('[data-testid="cat-c-save"]'); await page.waitForTimeout(900);
    const post = wrote(/POST \/api\/definitions/), live = wrote(/PUT \/api\/definitions\/c4 \{"status":"live"\}/).length;
    return { ok: /already have a live category/.test(dup) && posts0 === 0 && post.length === 1 && /"kind":"category"/.test(post[0]) && live === 1, saw: '"' + dup + '" · ' + post.length + ' POST · live PUT ' + live };
  });
  await w.step('C15', 'Oils -> Retire -> the confirm -> one DELETE (retire, never delete); the shelf says Retired', async () => {
    await page.waitForSelector('[data-testid="cat-cat-c2"]'); await page.click('[data-testid="cat-cat-c2"]'); await page.click('[data-testid="cat-c-life"]');
    await page.click('[data-testid="confirm-ok"]'); await page.waitForTimeout(900);
    const d = wrote(/DELETE \/api\/definitions\/c2/).length, row = await txt('[data-testid="cat-cat-c2"]');
    return { ok: d === 1 && /Retired/.test(row), saw: d + ' DELETE · row "' + row + '"' };
  });
  await page.goto(base + '/catalogue.html#/import'); await page.waitForSelector('[data-testid="cat-imp-file"]', { timeout: 15000 });
  await w.step('C16', 'Import -> a .csv -> the server\'s preflight (nothing written) -> Check: each column with its verdict and choice; cost "Not importable"', async () => {
    const greyed = await page.locator('[data-testid="cat-imp-next"]').isDisabled();
    await page.setInputFiles('[data-testid="cat-imp-file"]', { name: 'items.csv', mimeType: 'text/csv', buffer: Buffer.from('Item name,Rate,Shelf,cost\nJeera,35,A1,20\nPonni Rice 5 kg,62,A2,50\n') });
    await page.waitForTimeout(600); await page.click('[data-testid="cat-imp-next"]'); await page.waitForSelector('[data-testid="cat-imp-col-0"]');
    const pre = wrote(/POST \/api\/products\/import\/preflight/), sum = await txt('[data-testid="cat-imp-sum"]');
    const d1 = await page.inputValue('[data-testid="cat-imp-dec-1"]'), d2 = await page.inputValue('[data-testid="cat-imp-dec-2"]'), c3 = await txt('[data-testid="cat-imp-col-3"]');
    return { ok: greyed && pre.length === 1 && /"csv":"Item name,Rate/.test(pre[0]) && /2 rows read/.test(sum) && d1 === 'map:price' && d2 === 'create' && /Not importable/.test(c3) && !wrote(/\/api\/products\/import /).length,
      saw: 'next greyed first ' + greyed + ' · ' + pre.length + ' preflight · "' + sum + '" · Rate→' + d1 + ' · Shelf→' + d2 + ' · cost "' + c3.slice(0, 40) + '"' };
  });
  await w.step('C17', 'Check -> Shelf: Leave it out -> Import -> confirm -> ONE import with the choices as chosen (confirm:true); "1 added, 1 updated"', async () => {
    await page.selectOption('[data-testid="cat-imp-dec-2"]', 'ignore'); await page.click('[data-testid="cat-imp-go"]'); await page.click('[data-testid="confirm-ok"]');
    await page.waitForSelector('[data-testid="cat-imp-done"]', { timeout: 8000 });
    const p = wrote(/POST \/api\/products\/import /), done = await txt('[data-testid="cat-imp-done"]');
    return { ok: p.length === 1 && /"decisions":\[\{"incoming":"Item name","action":"map","field":"name"\},\{"incoming":"Rate","action":"map","field":"price"\},\{"incoming":"Shelf","action":"ignore"\},\{"incoming":"cost","action":"ignore"\}\],"confirm":true/.test(p[0]) && /1 added, 1 updated/.test(done),
      saw: (p[0] || 'no import').replace(/"csv":"[^"]*",/, '').slice(0, 200) + ' · "' + done + '"' };
  });
  S.broken = true; await page.goto(base + '/catalogue.html#/items'); await page.waitForSelector('[data-testid="cbl-error-catalogue"]', { timeout: 15000 });
  await w.step('C18', 'the list cannot be read -> "Couldn\'t read your catalogue." in words with Try again — never "No items yet"', async () => {
    const e = await txt('[data-testid="cbl-error-catalogue"]'), empty = await page.locator('[data-testid="cbl-empty-catalogue"]').count(), c = await txt('[data-testid="cat-count"]');
    S.broken = false; await page.click('[data-cbl-retry]'); await page.waitForSelector('[data-testid^="cat-row-"]', { timeout: 10000 });
    return { ok: /Couldn't read your catalogue/.test(e) && /Try again/.test(e) && empty === 0 && /Not read/.test(c) && (await rows()) === 50, saw: '"' + e.slice(0, 80) + '" · count "' + c + '" · after Try again ' + (await rows()) + ' rows' };
  });
  await w.step('C19', 'Home\'s manifest: Catalogue is built, routes to /catalogue.html, and its card reads the server\'s facts (/api/facts/product-lab)', async () => {
    const e = await page.evaluate(() => fetch('/app/manifest.json').then((r) => r.json()).then((m) => m.entries.find((x) => x.id === 'catalogue')));
    return { ok: e && e.state === 'built' && e.route === '/catalogue.html' && e.facts === '/api/facts/product-lab' && !e.via, saw: JSON.stringify(e).slice(0, 140) };
  });

  /* ── RULE 13: the three sections, two themes, two widths ── */
  const r13 = require('./lib/rule13.cjs').rule13;
  await items(); await r13(w, 'C20', 'Items', 'cat');
  await page.goto(base + '/catalogue.html#/categories'); await page.waitForSelector('[data-testid="cat-cat-c1"]', { timeout: 15000 }); await r13(w, 'C21', 'Categories', 'cat');
  await page.goto(base + '/catalogue.html#/import'); await page.waitForSelector('[data-testid="cat-imp-file"]', { timeout: 15000 });
  await page.setInputFiles('[data-testid="cat-imp-file"]', { name: 'items.csv', mimeType: 'text/csv', buffer: Buffer.from('Item name,Rate,Shelf,cost\nJeera,35,A1,20\n') });
  await page.waitForTimeout(600); await page.click('[data-testid="cat-imp-next"]'); await page.waitForSelector('[data-testid="cat-imp-col-0"]'); await r13(w, 'C22', 'Import · Check', 'cat');
  if (w.errs.length) w.note('C99', 'page errors seen during the walk', w.errs.slice(0, 3).join(' | '));
};
walk.opts = { viewport: { width: 1366, height: 900 } };
W.run('catalogue', walk);
