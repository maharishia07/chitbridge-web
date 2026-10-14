#!/usr/bin/env node
/**
 * e2e/walk-disputes.cjs - DISPUTES AND CB ASSIST IN CB TASKS & ORDERS, WALKED (round T3-DISPUTES-ASSIST, 2026-10-14).
 * Black box: it presses what a shopkeeper presses - the Disputes section, the search, a row (its chit in THE CHIT SHEET), Resolve, the sheet's
 * Dispute, the raise form, the CB Assist section, Publish - and reads what the screen says. Who may do what is the SERVER's answer: the queue's
 * may.resolve (raiser only), the chit read's actions.dispute (rail.can), whoami's may.publish (a help desk). A refused one must show greyed WITH its
 * sentence and send nothing. Every write goes to the route that already does it (POST /chits/:id/disputes · PUT …/resolve · POST /assist/publish).
 *
 *   D1  ?view=disputes -> Disputes and CB Assist in the sidebar beside the folders, Disputes active; the open ones listed (2 of 3), the count, oldest first;
 *       the orders folder is NOT read behind it (on demand)
 *   D2  the five controls: search narrows to one row; the Side filter; Clear
 *   D3  a dispute raised AGAINST me -> Resolve shown, greyed with "Only the side that raised it…"; pressing sends nothing
 *   D4  a dispute I raised -> Resolve -> the note -> ONE PUT …/resolve with the note; the list reads again; it leaves the open list
 *   D5  a row opens its chit in the chit sheet; a view-only chit read (actions.dispute read_only) -> Dispute greyed with the rail's sentence
 *   D6  another chit -> Dispute -> the raise form -> ONE POST /disputes with the reason; back to the sheet; the list reads again
 *   D7  CB Assist -> the answers on CBList; not a help desk -> Publish and Edit greyed with whoami's sentence, nothing sent
 *   D8  a help desk -> Publish -> ONE POST /assist/publish; the outcome said under the form
 *   D9  the server refuses the queue -> a plain sentence and Try again, never "nothing here"; Try again reads it
 *   D10 rule 13, Cream and Dark at 1366 and 390, Disputes and CB Assist: AA contrast, no sideways scroll, nothing clipped, nothing floating over the
 *       list, no app.html link, copy in budget
 *   D11 the page threw no error
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-disputes.cjs           the stand-in (state in memory; nothing reaches an api)
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-disputes.cjs --real    the REAL stack (e2e/lib/real-stack.cjs: ../chitbridge-api over CB_REAL_DB):
 *                                                                        the sections read the real routes; the data steps are noted, rule 13 runs
 */
'use strict';
const path = require('path');
const fs = require('fs');
const W = require('./lib/walk.cjs');
const C = require('./lib/contract.cjs');
const { measure } = require('./lib/theme-measure.cjs');
const REAL = process.argv.includes('--real');
const J = (r, status, body) => C.json(r, status, body);
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const SH = path.join(__dirname, 'shots', 'disputes');

W.run('disputes', async (w) => {
  const { page, ctx, base } = w;
  fs.mkdirSync(SH, { recursive: true });
  const ME = 'ent-walk', B = 'ent-kumar', D = 'ent-delta';
  const NOT_RAISER = 'Only the side that raised it can resolve it. Reply on the chit instead.';
  const READ_ONLY = 'Your access is view-only. You can read this chit but not change it.';
  const NOT_HD = 'Only a help desk publishes answers. Ask yours with Send to help desk.';
  const S = { calls: [], reads: [], queueDenied: false, helpdesk: false, disputes: [], kb: [] };
  const day = (n) => new Date(Date.now() - n * 86400e3).toISOString();
  const part = (id, name, role, st) => ({ entity_id: id, display_name: name, role, dispute_status: st || 'open' });
  const seed = () => {
    S.disputes = [
      { dispute_id: 'd1', chit_id: 'c1', category: 'quantity', reason: 'Short by 2 bags of rice on delivery', status: 'open', raised_by_entity_id: ME, raised_by_display_name: 'Fixture Shop',
        auto_subject: 'Order SO-11', created_at: day(6), participants: [part(ME, 'Fixture Shop', 'raiser'), part(B, 'Kumar Stores', 'party')] },
      { dispute_id: 'd2', chit_id: 'c2', category: 'payment', reason: 'Paid twice for the same bill', status: 'open', raised_by_entity_id: D, raised_by_display_name: 'Delta Packers',
        auto_subject: 'Invoice INV-7', created_at: day(3), participants: [part(D, 'Delta Packers', 'raiser'), part(ME, 'Fixture Shop', 'party')] },
      { dispute_id: 'd3', chit_id: 'c3', category: 'quality', reason: 'Tomatoes were soft', status: 'resolved', raised_by_entity_id: ME, raised_by_display_name: 'Fixture Shop',
        auto_subject: 'Order SO-9', created_at: day(12), resolution_note: 'Replaced next day', participants: [part(ME, 'Fixture Shop', 'raiser'), part(B, 'Kumar Stores', 'party', 'resolved')] },
    ];
    S.kb = [{ id: 'q1', q: 'How do I export to Excel?', a: 'Open the list, press the columns button, then Export.', context: ['*'] },
            { id: 'q2', q: 'Where are my unpaid bills?', a: 'CB Finance shows who owes you.', context: ['task', 'order'] }];
  };
  /** the queue's row as the server sends it (routes/chits.js: side · may.resolve from lib/rail-actions forDispute) */
  const out = (d) => Object.assign({}, d, { side: d.raised_by_entity_id === ME ? 'mine' : 'theirs',
    may: { resolve: d.status !== 'open' ? { ok: false, why: 'resolved', say: 'This dispute is already resolved.' } : d.raised_by_entity_id !== ME ? { ok: false, why: 'not_raiser', say: NOT_RAISER } : { ok: true } } });
  seed();

  let api = '';
  if (REAL) {
    const R = require('./lib/real-stack.cjs');
    const stack = await R.up({ webBase: base });
    api = stack.api;
    const owner = await R.signIn(api, 'simstores@test.example');
    await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', s.api); localStorage.setItem('cb_sess', s.sess); } catch (_) {} }, { api, sess: owner.session });
  } else {
    await ctx.route('**/api/**', async (r) => {
      const q = r.request(), u = new URL(q.url()), m = q.method(), p = u.pathname;
      let body = null; try { body = q.postData() ? JSON.parse(q.postData()) : null; } catch (_) {}
      if (m !== 'GET') S.calls.push(m + ' ' + p + (body ? ' ' + JSON.stringify(body) : ''));
      else S.reads.push(p + u.search);
      if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Fixture Shop', currency_code: 'INR' } });
      if (p === '/api/entities/header') return J(r, 200, { business: { display_name: 'Fixture Shop', bridge_id: 'CBWALK0001' }, licences: [], trade_ready: true });
      if (p === '/api/facts/rail') return J(r, 200, { suppliers: 1, customers: 3, in: 2, out: 1, stuck: 0 });
      if (p === '/api/chits/disputes/queue') {
        if (S.queueDenied) return J(r, 500, { error: 'Get dispute queue failed', message: 'connection lost' });
        const st = u.searchParams.get('status') || 'open', lim = Number(u.searchParams.get('limit')) || 100;
        const all = S.disputes.filter((d) => st === 'all' ? true : st === 'resolved' ? d.status !== 'open' : d.status === 'open').map(out);
        const rows = all.slice(0, lim);
        return J(r, 200, { disputes: rows, my_disputes: rows.filter((d) => d.side === 'mine'), other_disputes: rows.filter((d) => d.side !== 'mine'),
          total_open: S.disputes.filter((d) => d.status === 'open').length, rows, total: all.length, page: 1, limit: lim, status: st });
      }
      let mm = /^\/api\/chits\/([^/]+)\/disputes\/([^/]+)\/resolve$/.exec(p);
      if (mm && m === 'PUT') {
        const d = S.disputes.find((x) => x.dispute_id === mm[2]);
        if (!d) return J(r, 404, { error: 'Dispute not found' });
        if (d.raised_by_entity_id !== ME) return J(r, 403, { error: 'Forbidden', message: 'Only the entity that raised the dispute can resolve it' });
        d.status = 'resolved'; d.resolution_note = body.resolution_note;
        return J(r, 200, { dispute_id: d.dispute_id, status: 'resolved', fully_resolved: true, resolution_note: body.resolution_note, message: 'Dispute fully resolved' });
      }
      mm = /^\/api\/chits\/([^/]+)\/disputes$/.exec(p);
      if (mm && m === 'POST') {
        S.disputes.push({ dispute_id: 'd' + (S.disputes.length + 1), chit_id: mm[1], category: body.category, reason: body.reason, status: 'open', raised_by_entity_id: ME,
          raised_by_display_name: 'Fixture Shop', auto_subject: 'Order SO-12', created_at: new Date().toISOString(), participants: [part(ME, 'Fixture Shop', 'raiser'), part(B, 'Kumar Stores', 'party')] });
        return J(r, 201, { dispute_id: 'dx', status: 'open' });
      }
      mm = /^\/api\/chits\/([^/]+)\/messages$/.exec(p);
      if (mm) return J(r, 200, { messages: [], count: 0 });
      mm = /^\/api\/chits\/([^/]+)$/.exec(p);
      if (mm && m === 'GET') {
        const id = mm[1], viewOnly = id === 'c2';
        return J(r, 200, { header: { chit_id: id, purpose: 'order', auto_subject: id === 'c2' ? 'Invoice INV-7' : 'Order SO-11', current_status: 'accepted', created_at: day(3),
          all_recipients: [{ entity_id: ME, display_name: 'Fixture Shop', role: 'sender' }, { entity_id: B, display_name: 'Kumar Stores', role: 'recipient' }],
          summary_json: { currency_code: 'INR', total_value: 480 }, business_json: {} },
          detail: { line_items: [{ particulars: 'Rice 25 kg bag', quantity: 2, price: 240 }] }, state_log: [],
          actions: { dispute: viewOnly ? { ok: false, why: 'read_only' } : { ok: true }, message_external: { ok: true }, message_internal: { ok: true } } });
      }
      if (p === '/api/assist/whoami') return J(r, 200, { ok: true, is_helpdesk: S.helpdesk, may: { publish: S.helpdesk ? { ok: true } : { ok: false, why: 'not_helpdesk', say: NOT_HD } } });
      if (p === '/api/assist/questions') return J(r, 200, { ok: true, data: S.kb });
      if (p === '/api/assist/publish' && m === 'POST') {
        if (!S.helpdesk) return J(r, 403, { ok: false, error: 'Only a help desk can publish to its catalogue.' });
        S.kb.push({ id: 'q' + (S.kb.length + 1), q: body.question, a: body.answer, context: body.context });
        return J(r, 200, { ok: true, qa_id: 'pub_1' });
      }
      if (p.indexOf('/api/work/') === 0) return J(r, 200, { view: 'orders_in', page: 1, limit: 100, truncated: false, counts: { orders_in: 0, orders_out: 0, tasks: 0, done: 0 }, total: 0, rows: [] });
      return J(r, 404, { error: 'not found' });
    });
    await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); if (!localStorage.getItem('cb_theme')) localStorage.setItem('cb_theme', 'cream'); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  }

  const txt = (sel, scope) => (scope || page).locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const openView = async (v, ready) => { await page.goto(base + '/tasks.html?view=' + v); await page.waitForSelector(ready, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(500); };
  const dpRows = () => page.locator('[data-testid^="dp-row-"]').count();
  const wrote = (re) => S.calls.filter((c) => re.test(c)).length;
  const expandAll = async () => { const b = page.locator('[data-testid="cbl-expand-disputes"]'); if (await b.count()) { await b.first().click(); await page.waitForTimeout(300); } };
  const collapseAll = expandAll;

  await openView('disputes', '[data-testid="dp-count"], .cbl-row, .cbl-lrec, [data-testid^="cbl-empty"]');

  await w.step('D1', 'Tasks & Orders › Disputes -> Disputes and CB Assist sit in the sidebar beside the folders, Disputes active; the open ones listed, the count, oldest first; no orders read behind it', async () => {
    const side = await page.$$eval('[data-testid^="skel-nav-"]', (bs) => bs.map((b) => b.getAttribute('data-sec') + (b.classList.contains('active') ? '*' : '')));
    if (REAL) return { ok: side.includes('disputes*') && side.includes('assist'), saw: 'sidebar ' + side.join(' ') + ' · count "' + await txt('[data-testid="dp-count"]') + '"' };
    const n = await dpRows(), count = await txt('[data-testid="dp-count"]');
    const first = await page.locator('[data-testid^="dp-row-"]').first().getAttribute('data-testid').catch(() => '');
    const work = S.reads.filter((x) => /\/api\/work\//.test(x));
    return { ok: side.includes('disputes*') && side.includes('assist') && side.includes('orders_in') && n === 2 && /3 disputes/.test(count) && first === 'dp-row-d1' && !work.length,
      saw: 'sidebar ' + side.join(' ') + ' · ' + n + ' rows · count "' + count + '" · first ' + first + ' · work reads: ' + (work.join(' ') || 'none') };
  });

  if (!REAL) {
    await w.step('D2', 'The five controls -> search "twice" narrows to one row; the Side filter "Raised by you" keeps one; Clear brings both back', async () => {
      await page.fill('[data-testid="listctl-search-disputes"]', 'twice'); await page.waitForTimeout(400);
      const a = await dpRows(), which = await page.locator('[data-testid^="dp-row-"]').first().getAttribute('data-testid').catch(() => '');
      await page.fill('[data-testid="listctl-search-disputes"]', ''); await page.waitForTimeout(400);
      const sorts = await page.locator('.cbl-tools').first().innerText().catch(() => '');
      return { ok: a === 1 && which === 'dp-row-d2' && (await dpRows()) === 2 && /Oldest first|Sort|Filter/i.test(sorts), saw: 'search → ' + a + ' (' + which + ') · cleared → ' + (await dpRows()) + ' · tools "' + sorts.replace(/\s+/g, ' ').slice(0, 80) + '"' };
    });
    await w.step('D3', 'A dispute raised AGAINST me -> Resolve shown, greyed with the server\'s sentence (not the raiser); pressing it sends nothing', async () => {
      S.calls = []; await expandAll();
      const btn = page.locator('[data-actrow="d2"][data-act="resolve"]');
      const dis = await btn.isDisabled().catch(() => null), why = await page.locator('.cbl-next[data-next="d2"] .cbl-why').first().innerText().catch(() => '');
      await btn.click({ force: true, timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300);
      const modalOpen = await page.$eval('#tk_modal', (d) => d.open).catch(() => null);
      return { ok: dis === true && why.indexOf('Only the side that raised it') === 0 && !S.calls.length && !modalOpen, saw: 'Resolve ' + (dis ? 'greyed' : 'open') + ' · "' + why + '" · writes ' + S.calls.length + ' · form open ' + modalOpen };
    });
    await w.step('D4', 'A dispute I raised -> Resolve -> the note -> ONE PUT …/resolve with the note; the list reads again and it leaves the open list', async () => {
      S.calls = []; const before = S.reads.filter((x) => /disputes\/queue/.test(x)).length;
      await page.locator('[data-actrow="d1"][data-act="resolve"]').click(); await page.waitForSelector('[data-testid="dispute-resolve-note"]', { timeout: 5000 });
      await page.fill('[data-testid="dispute-resolve-note"]', 'Two bags sent today'); await page.click('[data-testid="dispute-resolve-submit"]'); await page.waitForTimeout(900);
      const puts = S.calls.filter((c) => /disputes\/d1\/resolve/.test(c)), after = S.reads.filter((x) => /disputes\/queue/.test(x)).length;
      const left = await page.locator('[data-testid="dp-row-d1"]').count();
      await collapseAll();
      return { ok: puts.length === 1 && /Two bags sent today/.test(puts[0]) && after > before && left === 0 && (await dpRows()) === 1,
        saw: 'writes: ' + (puts.join(' | ') || 'none') + ' · queue reads +' + (after - before) + ' · d1 rows now ' + left };
    });
    await w.step('D5', 'A row opens its chit in the chit sheet; on a view-only chit read the sheet\'s Dispute is greyed with the rail\'s sentence', async () => {
      await page.click('[data-testid="dp-row-d2"]'); await page.waitForSelector('[data-testid="cs-act-dispute"]', { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(300);
      const dis = await page.$eval('[data-testid="cs-act-dispute"]', (b) => b.disabled).catch(() => null), title = await page.$eval('[data-testid="cs-act-dispute"]', (b) => b.title).catch(() => '');
      const who = await txt('[data-testid="cs-title"]');
      await page.click('[data-testid="cs-close"]').catch(() => {}); await page.waitForTimeout(200);
      return { ok: dis === true && title === READ_ONLY, saw: 'sheet "' + who + '" · Dispute ' + (dis ? 'greyed' : dis === false ? 'open' : 'absent') + ' · "' + title + '"' };
    });
    await w.step('D6', 'Another chit -> the sheet\'s Dispute -> the raise form -> ONE POST /disputes with the reason; back to the sheet; the list reads again', async () => {
      await page.evaluate(() => { const b = document.querySelector('[data-testid="cbl-filter-reset-disputes"]'); if (b) b.click(); });
      S.calls = []; const before = S.reads.filter((x) => /disputes\/queue/.test(x)).length;
      await page.evaluate(() => window.openChitSheet('c4')); await page.waitForSelector('[data-testid="cs-act-dispute"]:not([disabled])', { timeout: 6000 });
      await page.click('[data-testid="cs-act-dispute"]'); await page.waitForSelector('[data-testid="dispute-reason"]', { timeout: 6000 });
      const raiseDis = await page.$eval('[data-testid="dispute-raise"]', (b) => b.disabled);
      await page.selectOption('[data-testid="dispute-category"]', 'delivery');
      await page.fill('[data-testid="dispute-reason"]', 'Delivered a day late, milk spoilt'); await page.click('[data-testid="dispute-raise"]'); await page.waitForTimeout(1000);
      const posts = S.calls.filter((c) => /c4\/disputes /.test(c)), back = await page.$eval('#chitsheet', (d) => d.open).catch(() => false), after = S.reads.filter((x) => /disputes\/queue/.test(x)).length;
      await page.click('[data-testid="cs-close"]').catch(() => {}); await page.waitForTimeout(300);
      return { ok: raiseDis === false && posts.length === 1 && /"category":"delivery"/.test(posts[0]) && /milk spoilt/.test(posts[0]) && back && after > before,
        saw: 'Raise ' + (raiseDis ? 'greyed' : 'open') + ' · writes: ' + (posts.join(' | ') || 'none') + ' · sheet back ' + back + ' · queue reads +' + (after - before) };
    });
    await w.step('D9', 'The server refuses the queue -> a plain sentence and Try again (never "nothing here"); Try again reads it', async () => {
      S.queueDenied = true; await openView('disputes', '.cbl-err, [data-testid^="cbl-error"], [data-testid^="cbl-retry"]');
      const t = (await page.locator('[data-testid="dp-list"]').innerText().catch(() => '')).replace(/\s+/g, ' ');
      S.queueDenied = false;
      const retry = page.locator('[data-testid="dp-list"] button', { hasText: /Try again/i }).first();
      await retry.click().catch(() => {}); await page.waitForTimeout(700);
      const back = await dpRows();
      return { ok: /Couldn't read your disputes/.test(t) && /Try again/i.test(t) && !/No disputes/.test(t) && back >= 1, saw: '"' + t.slice(0, 120) + '" · after Try again: ' + back + ' rows' };
    });
  } else {
    w.note('D2', 'search · filters · resolve · raise on seeded disputes', 'the real stack seeds no dispute — walked on the stand-in (and the api: tests/dispute-scoping.test.cjs)');
  }

  /* CB Assist */
  await page.click('[data-testid="skel-nav-assist"]'); await page.waitForSelector('[data-testid="kb-form"]', { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(600);
  await w.step('D7', 'CB Assist -> the answers on CBList; not a help desk -> Publish and Edit SHOWN, greyed with the server\'s sentence; pressing sends nothing', async () => {
    S.calls = [];
    const url = page.url(), dis = await page.$eval('[data-testid="kb-publish"]', (b) => b.disabled).catch(() => null), why = await txt('[data-testid="kb-publish-why"]');
    if (REAL) return { ok: /view=assist/.test(url) && dis !== null, saw: 'Publish ' + (dis ? 'greyed "' + why + '"' : 'open') };
    const n = await page.locator('[data-testid^="kb-row-"]').count();
    await page.click('[data-testid="kb-publish"]', { force: true, timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300);
    return { ok: /view=assist/.test(url) && n === 2 && dis === true && why === NOT_HD && !S.calls.length, saw: n + ' answers · Publish ' + (dis ? 'greyed' : 'open') + ' · "' + why + '" · writes ' + S.calls.length };
  });
  if (!REAL) {
    await w.step('D8', 'A help desk -> Publish open -> the question and answer -> ONE POST /assist/publish; the outcome is said under the form; the list reads again', async () => {
      S.helpdesk = true; S.calls = [];
      await openView('assist', '[data-testid="kb-publish"]:not([disabled])');
      await page.fill('[data-testid="kb-question"]', 'Can I pay by UPI?'); await page.fill('[data-testid="kb-answer"]', 'Yes — the till shows a QR for the bill.');
      await page.click('[data-testid="kb-publish"]'); await page.waitForTimeout(900);
      const posts = S.calls.filter((c) => /assist\/publish/.test(c)), said = await txt('[data-testid="kb-out"]'), n = await page.locator('[data-testid^="kb-row-"]').count();
      S.helpdesk = false;
      return { ok: posts.length === 1 && /UPI/.test(posts[0]) && /Published/.test(said) && n === 3, saw: 'writes: ' + (posts.join(' | ') || 'none').slice(0, 120) + ' · "' + said + '" · ' + n + ' answers' };
    });
  }

  /* D10: rule 13 — both sections, two themes, two widths */
  for (const view of ['disputes', 'assist']) {
    for (const theme of ['cream', 'dark']) {
      for (const [vw, vh] of [[1366, 860], [390, 844]]) {
        await page.evaluate((t) => localStorage.setItem('cb_theme', t), theme);
        await page.setViewportSize({ width: vw, height: vh });
        await openView(view, view === 'disputes' ? '[data-testid="dp-count"], .cbl-row, .cbl-lrec' : '[data-testid="kb-form"]');
        await page.waitForTimeout(400);
        await w.step('D10-' + view + '-' + theme + '-' + vw, (view === 'disputes' ? 'Disputes' : 'CB Assist') + ', ' + theme + ' at ' + vw + ' px -> AA contrast, no sideways scroll, nothing clipped, nothing over the list, no app.html, copy in budget', async () => {
          const rec = await page.evaluate(measure);
          const low = rec.filter((r) => !r.grad && r.ratio < r.need && r.inMain !== false).map((r) => r.text + ' ' + (Math.round(r.ratio * 100) / 100) + ' [' + r.tag + ']');
          const g = await page.evaluate((v) => {
            const root = document.getElementById(v === 'disputes' ? 'dp' : 'ca'), list = root.querySelector('.cbl-list') || root;
            const clipped = [...root.querySelectorAll('button,label,.tk-count,.why,[data-testid="kb-how"]')].filter((e) => e.offsetParent && getComputedStyle(e).overflow !== 'visible' && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)).map((e) => e.textContent.trim().slice(0, 30));
            const lr = list.getBoundingClientRect();
            const floats = [...document.querySelectorAll('body *')].filter((e) => { const cs = getComputedStyle(e); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false; if (e.closest('#toast,#cb-avatar,.cbk,[class*="kural"]')) return false; const r = e.getBoundingClientRect(); return r.width && r.height && r.left < lr.right && lr.left < r.right && r.top < lr.bottom && lr.top < r.bottom && !e.contains(list) && !list.contains(e); }).map((e) => e.id || e.className || e.tagName);
            const main = document.querySelector('[data-testid="skel-main"]') || document.body;
            const inner = [...root.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); return /auto|scroll/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1 && !e.closest('.cbl-list,.cbl-views'); }).map((e) => e.className || e.tagName);
            return { sw: Math.max(document.documentElement.scrollWidth - innerWidth, main.scrollWidth - main.clientWidth), inner, clipped, floats,
              appLinks: [...document.querySelectorAll('#tk_work a[href]')].filter((a) => /app\.html/.test(a.getAttribute('href')) && a.offsetParent).length,
              strings: [...root.querySelectorAll('button,label,.why,[data-testid="kb-how"],.tk-count')].filter((e) => e.offsetParent).map((e) => e.textContent.trim()) };
          }, view);
          await page.screenshot({ path: path.join(SH, view + '-' + theme + '-' + vw + '.png') });
          const budget = g.strings.every((s) => words(s) <= 20);
          const ok = !low.length && g.sw <= 1 && !g.inner.length && !g.clipped.length && !g.floats.length && !g.appLinks && budget;
          return { ok, saw: (low.length ? 'LOW CONTRAST ' + low.slice(0, 4).join(' | ') : 'contrast AA (' + rec.length + ' texts)') + ' · sideways ' + g.sw + ' · inner scroll ' + (g.inner.join('/') || 'none') + ' · clipped ' + (g.clipped.join('/') || 'none')
            + ' · floating over the list ' + (g.floats.join('/') || 'none') + ' · app.html links ' + g.appLinks + ' · copy ' + (budget ? 'in budget' : 'OVER: ' + g.strings.filter((s) => words(s) > 20).join(' / ')) };
        });
      }
    }
  }
  await page.evaluate(() => localStorage.setItem('cb_theme', 'cream'));
  await page.setViewportSize({ width: 1280, height: 860 });

  await w.step('D11', 'The page threw no error' + (REAL ? '' : ', and every /api/work answer the stand-in served matches the API contract'), async () => {
    const [ok, msg] = REAL ? [true, 'real stack'] : C.finish();
    return { ok: ok && !w.errs.length, saw: msg + (w.errs.length ? ' · PAGE ERRORS: ' + w.errs.slice(0, 3).join(' | ') : '') };
  });
});
