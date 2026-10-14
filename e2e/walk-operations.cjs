#!/usr/bin/env node
/**
 * e2e/walk-operations.cjs - CB OPERATIONS, WALKED (T3-OPS, 2026-10-14: operations.html + app/cap-stock.js + app/cap-suppliers.js on CBFrame).
 * Black box: it presses what an owner presses and reads what the screen says, one job per path:
 *   Stock     - the shelf fewest first, below zero on top with the server's count; a row opens to its batches and their expiry;
 *               the ledger not switched on -> words (the server's code STOCK_NOT_READY), never "nothing here"; a failed read -> could not read + Try again
 *   Suppliers - the list grouped Trade · Other with each one's readiness (the server's on_rail + has_catalogue); Add by name -> one POST { name };
 *               Link by ID refused -> the server's sentence painted; Remove -> the confirm -> one DELETE; Open record -> CB CRM, never the workshop
 * Then RULE 13 (owner, 13 Oct): both sections in Cream and Dark at 1366 and 390 px - AA contrast of every text (lib/theme-measure.cjs), no clipped
 * text, no inner sideways scroll, nothing floating over a control, no link to app.html, copy within the text budget (140 chars · 2 sentences).
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-operations.cjs            stand-in api answering inside the page (nothing leaves the runner)
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-operations.cjs --real     the local api (e2e/lib/real-stack.cjs, CB_REAL_DB, DEV_OTP): sim shop's real
 *                                                                           stock + supplier list, read-only (no write is pressed)
 * One line per path: "ID · path · PASS/FAIL (what it saw)". Screenshots: e2e/shots/walk-operations-NN.png.
 */
'use strict';
const W = require('./lib/walk.cjs');
const { measure } = require('./lib/theme-measure.cjs');
const REAL = process.argv.includes('--real');
const J = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const walk = async (w) => {
  const { page, ctx, base } = w;
  const S = { calls: [], stock: 'ok', refuseLink: false, stack: null };
  const SUPS = [
    { supplier_list_id: 'sl1', supplier_entity_id: 'e-s1', display_name: 'Lakshmi Traders', nickname: null, preferred: true, supply_kind: 'resale', category: 'Rice', on_rail: true, has_catalogue: true, user_id: 'lakshmi-traders', bridge_id: 'CBLT0001', party_no: 'S-001' },
    { supplier_list_id: 'sl2', supplier_entity_id: 'e-s2', display_name: 'Corner Hardware', nickname: null, preferred: false, supply_kind: 'own_use', category: null, on_rail: false, has_catalogue: false, user_id: '~fixture.corner-hardware', bridge_id: 'CBCH0002', party_no: 'S-002' },
    { supplier_list_id: 'sl3', supplier_entity_id: 'e-s3', display_name: 'Madurai Oils', nickname: 'Oil man', preferred: false, supply_kind: 'resale', category: 'Oil', on_rail: true, has_catalogue: false, user_id: 'madurai-oils', bridge_id: 'CBMO0003', party_no: 'S-003' },
  ];
  const SHELF = { balances: {}, below_zero: 1, at: "2026-10-14T06:00:00.000Z", shelf: [
    { item_id: 'i-dal', name: 'Toor Dal', unit: 'kg', qty: -1, below_zero: true, lots: [] },
    { item_id: 'i-oil', name: 'Groundnut Oil', unit: 'l', qty: 3, below_zero: false, lots: [] },
    { item_id: 'i-rice', name: 'Ponni Rice', unit: 'kg', qty: 6.5, below_zero: false, lots: [{ lot: 'B1', expires_at: '2026-11-01', qty: 4 }, { lot: 'B2', expires_at: '2026-12-01', qty: 2.5 }] },
  ] };

  if (REAL) {
    const R = require('./lib/real-stack.cjs');
    S.stack = await R.up({ webBase: base });
    const owner = await R.signIn(S.stack.api, process.env.CB_REAL_OWNER || 'simstores@test.example');
    await ctx.addInitScript((o) => { try { localStorage.setItem('cb_api_base', o.api); localStorage.setItem('cb_sess', o.s); } catch (_) {} }, { api: S.stack.api, s: owner.session });
  } else {
    await ctx.route('**/api/**', async (r) => {
      const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method();
      let body = null; try { body = q.postData() ? JSON.parse(q.postData()) : null; } catch (_) {}
      if (m !== 'GET') S.calls.push(m + ' ' + p + (body ? ' ' + JSON.stringify(body) : ''));
      if (p === '/api/till/stock') {
        if (S.stock === 'notready') return J(r, 503, { error: 'not ready', code: 'STOCK_NOT_READY', message: 'Stock is not switched on for this server yet.' });
        if (S.stock === 'fail') return J(r, 500, { error: 'Failed', message: 'boom' });
        return J(r, 200, u.searchParams.get('lots') === '1' ? SHELF : { balances: {}, at: SHELF.at });
      }
      if (p === '/api/relationships/suppliers' && m === 'GET') return J(r, 200, { suppliers: SUPS, count: SUPS.length });
      if (p === '/api/relationships/suppliers' && m === 'POST') {
        if (body && body.supplier_bridge_id && S.refuseLink) return J(r, 404, { error: 'Not found', message: 'No business with that User ID, bridge ID, or email' });
        SUPS.push({ supplier_list_id: 'sl' + (SUPS.length + 1), supplier_entity_id: 'e-new', display_name: body.name || body.supplier_bridge_id, supply_kind: 'resale', on_rail: !body.name, has_catalogue: false, preferred: false });
        return J(r, 200, { supplier: SUPS[SUPS.length - 1] });
      }
      if (/^\/api\/relationships\/suppliers\/[^/]+$/.test(p) && m === 'DELETE') { const id = p.split('/').pop(); const i = SUPS.findIndex((x) => x.supplier_list_id === id); if (i >= 0) SUPS.splice(i, 1); return J(r, 200, { message: 'Removed' }); }
      if (p === '/api/facts/rail') return J(r, 200, { suppliers: SUPS.length, customers: 0, in: 0, out: 0, stuck: 0 });
      return J(r, 200, {});
    });
    await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  }

  const T = (id) => '[data-testid="' + id + '"]';
  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const wrote = (re) => S.calls.filter((c) => re.test(c));
  const ready = (k) => T('cbl-error-ops-' + k) + ',' + T('cbl-empty-ops-' + k) + ',[data-testid^="ops-' + (k === 'stock' ? 'stock' : 'sup') + '-row-"]';
  let nav = 0;   /* a goto to the same URL + hash only moves the hash: a fresh query makes it a fresh load */
  const stock = async () => { await page.goto(base + '/operations.html?n=' + (++nav) + '#/stock'); await page.waitForSelector(ready('stock'), { timeout: 20000 }); await page.waitForTimeout(300); };
  const sups = async () => { await page.goto(base + '/operations.html?n=' + (++nav) + '#/suppliers'); await page.waitForSelector(ready('suppliers'), { timeout: 20000 }); await page.waitForTimeout(300); };

  try {
    if (REAL) {
      await w.step('R1', 'the real api -> Stock: the shelf (or the "no stock moved yet" words), never a could-not-read', async () => {
        await stock(); const err = await page.locator(T('cbl-error-ops-stock')).count(), rows = await page.locator('[data-testid^="ops-stock-row-"]').count();
        return { ok: !err, saw: rows + ' rows' + (err ? ' · ERROR "' + await txt(T('cbl-error-ops-stock')) + '"' : '') };
      });
      await w.step('R2', 'the real api -> Suppliers: the supplier list with readiness, never a could-not-read', async () => {
        await sups(); const err = await page.locator(T('cbl-error-ops-suppliers')).count(), rows = await page.locator('[data-testid^="ops-sup-row-"]').count();
        return { ok: !err, saw: rows + ' rows · ' + (await page.locator('[data-testid^="ops-sup-ready-"]').count()) + ' readiness chips' + (err ? ' · ERROR' : '') };
      });
    } else {
      await stock();
      await w.step('O1', 'CB Operations -> Stock: fewest first, below zero on top in red, the server\'s "1 below zero"', async () => {
        const ids = await page.$$eval('[data-testid^="ops-stock-row-"]', (n) => n.map((x) => x.getAttribute('data-testid').replace('ops-stock-row-', '')));
        const note = await txt(T('ops-stock-below') + ',' + T('cbl-notes-ops-stock')), red = await page.locator(T('ops-stock-below-i-dal')).count();
        return { ok: ids.join(',') === 'i-dal,i-oil,i-rice' && /1 (below zero|notice)/.test(note) && red === 1, saw: ids.join(',') + ' · "' + note + '" · red ' + red };
      });
      await w.step('O2', 'Stock -> open Ponni Rice -> its two batches, earliest expiry first, each with its date', async () => {
        await page.click(T('ops-stock-row-i-rice')); await page.waitForSelector(T('ops-stock-lots-i-rice'), { timeout: 8000 });
        const t = await txt(T('ops-stock-lots-i-rice'));
        return { ok: /B1.*4 kg.*expires.*B2.*2\.5 kg/.test(t) && /Nov/.test(t), saw: '"' + t + '"' };
      });
      await w.step('O3', 'Stock with the ledger not switched on (503 STOCK_NOT_READY) -> it says so in words, not "nothing here"', async () => {
        S.stock = 'notready'; await stock(); const t = await txt(T('cbl-error-ops-stock')); S.stock = 'ok';
        return { ok: /not switched on/i.test(t) && !/503|undefined|Nothing recorded/.test(t), saw: '"' + t + '"' };
      });
      await w.step('O4', 'Stock read fails -> "Could not read your stock" + Try again -> the shelf comes back', async () => {
        S.stock = 'fail'; await stock(); const t = await txt(T('cbl-error-ops-stock')); S.stock = 'ok';
        await page.locator(T('cbl-error-ops-stock') + ' button').first().click(); await page.waitForSelector(T('ops-stock-row-i-dal'), { timeout: 8000 }).catch(() => {});
        return { ok: /Could not read your stock/.test(t) && (await page.locator(T('ops-stock-row-i-dal')).count()) === 1, saw: '"' + t + '" · after retry ' + (await page.locator('[data-testid^="ops-stock-row-"]').count()) + ' rows' };
      });
      await sups();
      await w.step('O5', 'CB Operations -> Suppliers: grouped Trade · Other, readiness per row from the server, "2 not ready to order"', async () => {
        const groups = await page.$$eval('.cbl-group b', (n) => n.map((x) => x.textContent.trim()));
        const r1 = await txt(T('ops-sup-ready-sl1')), r2 = await txt(T('ops-sup-ready-sl2')), r3 = await txt(T('ops-sup-ready-sl3'));
        const note = await txt(T('ops-sup-notready') + ',' + T('cbl-notes-ops-suppliers'));
        return { ok: groups.join('|') === 'Trade|Other' && r1 === 'Ready to order' && r2 === 'Not on ChitBridge' && r3 === 'No catalogue yet' && /2 not ready|notice/.test(note),
          saw: groups.join('|') + ' · ' + [r1, r2, r3].join(' / ') + ' · "' + note + '"' };
      });
      await w.step('O6', 'Suppliers -> type "Sri Murugan Stores" -> Add by name -> one POST { name } and the row appears', async () => {
        const before = wrote(/POST \/api\/relationships\/suppliers/).length;
        await page.fill(T('ops-sup-new'), 'Sri Murugan Stores'); await page.click(T('ops-sup-add')); await page.waitForTimeout(900);
        const posts = wrote(/POST \/api\/relationships\/suppliers/), t = await txt(T('ops-sup-list'));
        return { ok: posts.length - before === 1 && /"name":"Sri Murugan Stores"/.test(posts[posts.length - 1]) && /Sri Murugan Stores/.test(t), saw: (posts[posts.length - 1] || '').slice(0, 90) };
      });
      await w.step('O7', 'Suppliers -> Link by ID refused by the server -> its sentence under the field, never a raw error', async () => {
        S.refuseLink = true; await page.fill(T('ops-sup-new'), 'nobody-here'); await page.click(T('ops-sup-link')); await page.waitForTimeout(900); S.refuseLink = false;
        const e = await txt(T('ops-sup-err'));
        return { ok: /No business with that User ID/.test(e) && !/404|undefined|Error/.test(e), saw: '"' + e + '"' };
      });
      await w.step('O8', 'Suppliers -> open Corner Hardware -> Remove -> the confirm -> one DELETE and the row is gone', async () => {
        await sups(); await page.click(T('ops-sup-row-sl2')); await page.waitForSelector(T('ops-sup-remove'), { timeout: 8000 });
        await page.click(T('ops-sup-remove')); await page.waitForSelector(T('confirm-ok'), { timeout: 8000 }); await page.click(T('confirm-ok')); await page.waitForTimeout(900);
        const del = wrote(/DELETE \/api\/relationships\/suppliers\/sl2/).length;
        return { ok: del === 1 && (await page.locator(T('ops-sup-row-sl2')).count()) === 0, saw: del + ' DELETE · rows ' + (await page.locator('[data-testid^="ops-sup-row-"]').count()) };
      });
      await w.step('O9', 'Suppliers -> open Lakshmi Traders -> Open record goes to CB CRM, never the workshop', async () => {
        await page.click(T('ops-sup-row-sl1')); await page.waitForSelector(T('ops-sup-record'), { timeout: 8000 });
        await Promise.all([page.waitForURL(/crm\.html/, { timeout: 8000 }).catch(() => {}), page.click(T('ops-sup-record'))]);
        return { ok: /\/crm\.html#\/party\/S-001$/.test(page.url()), saw: page.url().replace(base, '') };
      });
      await w.step('O10', 'Home\'s manifest: CB Operations built at /operations.html with its facts card; Stock and Suppliers point into it', async () => {
        const m = require('../public/app/manifest.json'), by = (id) => m.entries.find((e) => e.id === id) || {};
        const o = by('operations'), s = by('stock'), u = by('suppliers');
        return { ok: o.state === 'built' && o.route === '/operations.html' && o.facts === '/api/facts/operations' && s.route === '/operations.html#/stock' && u.route === '/operations.html#/suppliers' && s.state === 'built' && u.state === 'built',
          saw: [o.state, o.route, o.facts, s.route, u.route].join(' · ') };
      });
    }

    /* ── RULE 13: two themes × two widths × two sections ── */
    const audit = () => page.evaluate(() => {
      const host = document.getElementById('ops'), out = { clip: [], frameClip: [], scroll: [], cover: [], app: [], budget: [] };
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      document.querySelectorAll('body *').forEach((el) => {
        if (!vis(el) || el.closest('#cb-avatar,#toast,script,style')) return;
        const cs = getComputedStyle(el), hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
        /* CBList's one row scroller is the list standard's own (only the rows scroll; columns are adjustable) — it is not an inner sideways scroll of this page */
        if (/auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && el !== document.documentElement && el !== document.body && !el.classList.contains('cbl-scroll')) out.scroll.push(el.tagName + '.' + el.className + ' ' + el.scrollWidth + '>' + el.clientWidth);
        if (hasText && (cs.textOverflow === 'ellipsis' || /hidden|clip/.test(cs.overflowX)) && el.scrollWidth > el.clientWidth + 1) (host.contains(el) && !el.closest('.cbl') ? out.clip : out.frameClip).push(el.textContent.trim().slice(0, 40));
        const href = (el.getAttribute('href') || '') + ' ' + (el.getAttribute('onclick') || '');
        if (/app\.html/.test(href)) out.app.push(el.outerHTML.slice(0, 80));
      });
      if (document.documentElement.scrollWidth > window.innerWidth + 1) out.scroll.push('page ' + document.documentElement.scrollWidth + '>' + window.innerWidth);
      host.querySelectorAll('.ops-bar button,.ops-bar input').forEach((c) => {
        if (!vis(c)) return; const r = c.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (hit && hit !== c && !c.contains(hit) && !hit.contains(c) && !hit.closest('#toast')) out.cover.push((c.dataset.testid || c.id || c.tagName) + ' under ' + (hit.id || hit.className || hit.tagName));
      });
      host.querySelectorAll('.cbl-state,.err,.ops-next').forEach((n) => {
        const t = n.textContent.replace(/\s+/g, ' ').replace(/Try again$/, '').trim(); if (!t) return;
        const sentences = t.split(/[.!?](\s|$)/).filter((s) => s && s.trim()).length;
        if (t.length > 140 || sentences > 2) out.budget.push(t.length + ' chars / ' + sentences + ' sentences: "' + t.slice(0, 50) + '…"');
      });
      return out;
    });
    let k = 0; const frameClip = new Set();
    for (const theme of ['cream', 'dark']) {
      for (const width of [1366, 390]) {
        await page.setViewportSize({ width, height: width > 500 ? 900 : 844 });
        for (const sec of ['stock', 'suppliers']) {
          k++;
          await w.step('T' + k, sec + ' · ' + theme + ' · ' + width + ' px -> AA contrast, no clipping, no inner sideways scroll, nothing over a control, no app.html link, copy in budget', async () => {
            if (sec === 'stock') await stock(); else await sups();
            await page.evaluate((t) => { CBAvatar.applyTheme(t); }, theme); await page.waitForTimeout(200);
            const pairs = await page.evaluate(measure), bad = pairs.filter((x) => !x.grad && x.ratio < x.need);
            const a = await audit();
            const fails = [].concat(bad.map((x) => 'contrast ' + x.ratio + ' "' + x.text + '"'), a.clip.map((x) => 'clipped "' + x + '"'), a.scroll.map((x) => 'scroll ' + x),
              a.cover.map((x) => 'covered ' + x), a.app.map((x) => 'app.html ' + x), a.budget.map((x) => 'budget ' + x));
            a.frameClip.forEach((x) => frameClip.add(x));
            return { ok: !fails.length && pairs.length > 10, saw: pairs.length + ' texts measured, lowest ' + Math.min.apply(null, pairs.map((x) => x.ratio)) + (fails.length ? ' · ' + fails.slice(0, 4).join(' · ') : ' · clean') };
          });
        }
      }
    }
    await page.evaluate(() => { CBAvatar.applyTheme('cream'); }).catch(() => {});
    if (frameClip.size) w.note('T9', 'the shared frame / CBList cells ellipsised at 390 px (the list standard folds long cells; not this page\'s copy)', [...frameClip].slice(0, 6).join(' · '));
    if (w.errs.length) w.note('T99', 'page errors seen during the walk', w.errs.slice(0, 3).join(' | '));
  } finally {
    if (S.stack && S.stack.stop) await S.stack.stop();
  }
};
walk.opts = { viewport: { width: 1366, height: 900 } };
W.run('operations', walk);
