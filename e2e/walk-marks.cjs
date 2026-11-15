#!/usr/bin/env node
/**
 * e2e/walk-marks.cjs — ACC-358 WALKED: the auditor's Checked / Query / On hold marks and the Query thread, on a STATEFUL STAND-IN of api feat/marks (docs/marks-contract.md).
 *
 * OWNS      the proof of the web half: the auditor marks an entry Checked in ONE press, raises a Query (its question is required), the OWNER sees the chip at once and replies in the thread (no second composer),
 *           the auditor clears it; "checked n of m" and "All queries" with ageing; "Changed after review" as a chip state; the owner never sees set buttons; 1366×768 and 390×844 with no page scroll; a keyboard path
 * CALLED BY e2e/run-shard.cjs (walk-*.cjs) · the PR's CI walk · toolset/sit-box-run.sh <box> e2e
 * CARD      14-accounting/ACC-358-AUDIT-MARKERS-REQUIREMENT
 * Which api: a STAND-IN of the contract. The real round (the SIT box, a real grant) is e2e/walk-marks-live.cjs.
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-marks.cjs
 */
'use strict';
const path = require('path');
const W = require('./lib/walk.cjs');
const C = require('./lib/contract.cjs');
const T = (id) => '[data-testid="' + id + '"]';
const WIDE = { width: 1366, height: 768 }, NARROW = { width: 390, height: 844 };
const MEMBER = 'a0000000-0000-4000-8000-000000000001', BRAND = 'b0000000-0000-4000-8000-000000000009';
const GRANT = 'c0000000-0000-4000-8000-000000000001';
const E = ['e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003'];
const THREAD = 'f0000000-0000-4000-8000-000000000001';
const DAY = (n) => new Date(W.nowMs() + n * 86400000).toISOString();
const SHOTS = process.env.MARKS_SHOTS || path.join(__dirname, 'shots');

W.run('marks', async (w) => {
  const { page, ctx, base } = w;
  const S = { calls: [], marks: {}, msgs: [], sets: [], replies: [] };
  const J = (r, status, body) => C.json(r, status, body);
  const example = (key) => { const hit = C.load().routes.filter((e) => e.key === key)[0]; return hit ? JSON.parse(JSON.stringify(hit.example)) : {}; };
  const VOC = [{ kind: 'checked', label: 'Checked', class: 'clear', note: 'none' }, { kind: 'query', label: 'Query', class: 'open', note: 'required' }, { kind: 'on_hold', label: 'On hold', class: 'hold', note: 'optional' }];
  const KIND = { checked: ['clear', 'Checked'], query: ['open', 'Query'], on_hold: ['hold', 'On hold'] };
  const NOT_AUDITOR = 'Only the auditor can mark a record. You can read the marks and answer a query.';
  const auditor = (h) => !!h['x-books-for'] && h['x-books-role'] !== 'adviser';
  const acts = (h, open) => ({ set: auditor(h) ? { ok: true, why: null } : { ok: false, why: NOT_AUDITOR }, reply: open === false ? { ok: false, why: 'This question is closed.' } : { ok: true, why: null } }); /* the auditor raised it: auditor, owner and adviser reply; only the auditor sets */
  const mark = (id, h) => {
    const m = S.marks[id]; if (!m) return null;
    const open = m.class === 'open' || m.class === 'hold';
    return Object.assign({}, m, { open, age_days: open ? 3 : null, message_count: S.msgs.length, actions: acts(h, open) });
  };
  const entry = (n) => ({ entry_id: E[n], entry_no: 'JV-000' + (n + 1), posting_date: '2026-11-0' + (n + 3), doc_date: '2026-11-03', event_type: 'sale', narration: ['Cash sale', 'Rent paid', 'Stock bought'][n], source_chit_id: null, reverses_entry_id: null, reversed_by: null, source: { chit_id: null, ref: 'B-' + n, kind: 'bill', counter: null, by: 'Asha', count: null, how: 'Cash', how_ref: null, split: null, bills: null, doc_at: '2026-11-03T09:00:00.000Z', recorded_at: '2026-11-03T09:05:00.000Z' }, lines: [{ code: '1000', name: 'Cash', party_id: null, party_name: 'Walk-in buyer', dr_minor: 123400 + n, cr_minor: 0, counter: null, rate: null }, { code: '4000', name: 'Sales', party_id: null, party_name: null, dr_minor: 0, cr_minor: 123400 + n, counter: null, rate: null }] });

  await ctx.route(base + '/api/**', async (r) => {
    const q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method(), h = q.headers();
    S.calls.push({ m, p, q: u.search, h });
    if (p === '/api/network-offers') { const ex = example('GET /api/network-offers'); ex.store.networks = [Object.assign({}, ex.store.networks[0], { brand_id: BRAND, brand_name: 'Acme Brand', membership: Object.assign({}, ex.store.networks[0].membership, { state: 'active' }), offers: [] })]; ex.may_design = { ok: false, why: 'Only the owner designs a network.' }; return J(r, 200, ex); }
    if (p === '/api/network-design/stores') return J(r, 200, { stores: [{ entity_id: MEMBER, name: 'Store One', city: 'Pune', km: 4, purpose: 'Tea' }] });
    if (p === '/api/books-grants' && m === 'GET') return J(r, 200, { given: [], received: [{ grant_id: GRANT, grantor_entity: MEMBER, grantee_entity: BRAND, state: 'live', expires_at: DAY(200) }] });
    if (p === '/api/marks' && m === 'GET' && u.searchParams.get('open')) {
      const open = Object.keys(S.marks).map((id) => mark(id, h)).filter((x) => x.open).map((x) => Object.assign(x, { subject_label: 'JV-000' + (E.indexOf(x.subject_id) + 1), posting_date: '2026-11-04' }));
      const checked = Object.keys(S.marks).filter((id) => S.marks[id].class === 'clear' && !S.marks[id].altered).length;
      return J(r, 200, { adopter: 'acc.audit', from: '2026-11-01', to: '2026-11-15', open, total_open: open.length, checked, of: 3, oldest_age_days: open.length ? 3 : null, vocabulary: VOC, actions: acts(h) });
    }
    if (p === '/api/marks' && m === 'POST') {
      const b = JSON.parse(q.postData() || '{}'); S.sets.push({ b, h });
      if (!auditor(h)) return J(r, 403, { code: 'MARK_NOT_ALLOWED', message: NOT_AUDITOR });
      if (b.kind === 'query' && !b.note) return J(r, 422, { code: 'MARK_WORDS_REQUIRED', message: 'Write the question first. The owner will read it.' });
      S.marks[b.subject_id] = { mark_id: String(1200 + S.sets.length), adopter: 'acc.audit', subject_id: b.subject_id, thread_id: THREAD, kind: b.kind, class: KIND[b.kind][0], label: KIND[b.kind][1], note: b.note || null, at: DAY(0), by_name: 'A. Auditor', by_firm: 'Harbour Audit', open_since: DAY(-3), altered: false, altered_by: null, recheck_needed: false };
      return J(r, 201, { mark: mark(b.subject_id, h), vocabulary: VOC });
    }
    if (/^\/api\/marks\/[^/]+\/messages$/.test(p)) {
      const id = Object.keys(S.marks).filter((k) => S.marks[k].thread_id === p.split('/')[3])[0], mk = id && mark(id, h);
      if (m === 'GET') return J(r, 200, { thread_id: THREAD, adopter: 'acc.audit', subject_id: id, subject_label: 'JV-0002', mark: mk, history: [], messages: S.msgs, actions: acts(h) });
      const b = JSON.parse(q.postData() || '{}'); S.replies.push({ b, h });
      if (auditor(h)) return J(r, 403, { code: 'MARK_REPLY_NOT_ALLOWED', message: 'Only the owner and the adviser answer a question.' });
      const msg = { message_id: 'm' + S.msgs.length, sender_display_name: 'Fixture Owner', message_text: b.message_text, msg_type: 'info', created_at: DAY(0), mine: true };
      S.msgs.push(msg); return J(r, 201, { message: msg, mark: mk });
    }
    if (p === '/api/books/daybook') {
      const ex = example('GET /api/books/daybook');
      return J(r, 200, Object.assign(ex, { currency: 'INR', entries: [0, 1, 2].map((n) => Object.assign({}, ex.entries[0], entry(n), { mark: mark(E[n], h) })), count: 3, mark_actions: acts(h), mark_vocabulary: VOC }));
    }
    if (/^\/api\/books\/(trial-balance|pl|bs|dues|periods)$/.test(p) && h['x-books-for']) { const ex = example('GET ' + p); return J(r, 200, Object.assign(ex, { entries: [], parties: [], periods: [] })); }
    return J(r, 200, {});
  });
  await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const noScroll = () => page.evaluate(() => ({ y: document.documentElement.scrollHeight <= window.innerHeight + 1, x: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + '.png') }).catch(() => {});
  const chip = (n) => '[data-mark*="' + E[n] + '"]';
  const sets = () => S.sets.filter((x) => auditor(x.h));
  const openDaybook = async () => {
    await page.goto(base + '/network.html'); await page.waitForSelector(T('nw-books-' + MEMBER), { timeout: 20000 });
    await page.click(T('nw-books-' + MEMBER)); await page.waitForSelector(T('bv-band'), { timeout: 10000 });
    await page.click(T('bv-tab-daybook')); await page.waitForSelector(T('bv-row-0'), { timeout: 10000 }); await page.waitForSelector(T('mk-bar'), { timeout: 10000 });
  };

  /* ═══ the auditor ═══ */
  await page.setViewportSize(WIDE);
  await openDaybook();
  await w.step('A1', 'the auditor · Day book: a chip on each entry and "Checked 0 of 3 entries this period"', async () => {
    const chips = await page.locator('[data-mark] button[data-mk="check"]').count(), bar = await txt(T('mk-count'));
    await shot('01-auditor-daybook-unmarked');
    return { ok: chips === 3 && /Checked 0 of 3/.test(bar), saw: chips + ' check chips · ' + bar };
  });
  await w.step('A2', 'the auditor · ONE press on a row\'s Check: one write (checked), the chip says Checked, the bar says 1 of 3', async () => {
    await page.click(chip(0) + ' button[data-mk="check"]'); await page.waitForSelector(chip(0) + ' [data-class="clear"]', { timeout: 8000 });
    await page.waitForTimeout(400);
    const s = sets(), bar = await txt(T('mk-count')), c = await txt(chip(0));
    await shot('02-auditor-checked');
    return { ok: s.length === 1 && s[0].b.kind === 'checked' && s[0].b.subject_id === E[0] && !!s[0].h['idempotency-key'] && /Checked/.test(c) && /1 of 3/.test(bar), saw: JSON.stringify(s[0] && s[0].b) + ' · ' + c + ' · ' + bar };
  });
  await w.step('A3', 'the auditor · "?" on a row opens the sheet; Ask a question with no words is refused in plain words and sends nothing', async () => {
    await page.click(chip(1) + ' button[data-mk="ask"]'); await page.waitForSelector(T('mk-sheet'), { timeout: 5000 });
    const before = sets().length;
    /* the Ask button is aria-disabled while the box is empty (Playwright will not click it); a press still answers in plain words, so press it by force */
    await page.click(T('mk-set-open'), { force: true }); await page.waitForTimeout(300);
    const out = await txt(T('mk-out')), hint = await txt(T('mk-sheet'));
    return { ok: /Write your question first/.test(out) && sets().length === before && /The owner sees this/.test(hint), saw: out + ' · owner-sees-this hint ' + /The owner sees this/.test(hint) };
  });
  await w.step('A4', 'the auditor · type the question, Ask: ONE write (query + note), the sheet closes, the row says Query', async () => {
    await page.fill(T('mk-note'), 'Why was rent posted to 4100?'); await shot('03-auditor-query-sheet');
    await page.click(T('mk-set-open')); await page.waitForSelector(T('mk-sheet'), { state: 'detached', timeout: 8000 });
    await page.waitForTimeout(400);
    const s = sets(), c = await txt(chip(1)), bar = await txt(T('mk-filter'));
    await shot('04-auditor-query-raised');
    return { ok: s.length === 2 && s[1].b.kind === 'query' && s[1].b.note === 'Why was rent posted to 4100?' && /Query/.test(c) && /All queries · 1/.test(bar), saw: JSON.stringify(s[1] && s[1].b) + ' · ' + c + ' · ' + bar };
  });
  await w.step('A5', 'the auditor · All queries: the open list with its age and the question; pressed again it returns to the day book', async () => {
    await page.click(T('mk-filter')); await page.waitForSelector(T('mk-queries'), { timeout: 5000 });
    const list = await txt(T('mk-queries')); await shot('05-auditor-all-queries');
    await page.click(T('mk-filter')); await page.waitForSelector(T('bv-row-0'), { timeout: 5000 });
    return { ok: /JV-0002/.test(list) && /Why was rent posted/.test(list) && /3 days/.test(list), saw: list };
  });

  /* ═══ the owner ═══ */
  await w.step('O1', 'the owner · accounts.html Day book: the same chips at once; the Query is there; he cannot set (no Check chip)', async () => {
    await page.goto(base + '/accounts.html#daybook'); await page.waitForSelector(T('acc-nav-daybook'), { timeout: 20000 });
    await page.waitForSelector('[data-mark] button[data-mk]', { timeout: 15000 });
    const checked = await txt(chip(0)), query = await txt(chip(1)), ghosts = await page.locator('[data-mark] button[data-mk="check"]').count();
    await shot('06-owner-daybook-chips');
    return { ok: /Checked/.test(checked) && /Query/.test(query) && ghosts === 0, saw: checked + ' · ' + query + ' · check chips ' + ghosts };
  });
  await w.step('O2', 'the owner · the Query chip opens the sheet: the question, no set buttons; he replies in the thread (the one composer) and it posts ONCE', async () => {
    await page.click(chip(1) + ' button[data-mk="open"]'); await page.waitForSelector(T('mk-sheet'), { timeout: 5000 }); await page.waitForSelector(T('msg-body'), { timeout: 8000 });
    const q = await txt(T('mk-question')), setBtns = await page.locator(T('mk-set-clear')).count(), composers = await page.locator('dialog.mk-sheet [data-rt-act="text"]').count();
    await page.fill(T('msg-body'), 'Posted to 4100 because it is a lease.'); await shot('07-owner-sheet-reply');
    await page.click(T('msg-send')); await page.waitForTimeout(800);
    return { ok: /Why was rent posted/.test(q) && setBtns === 0 && composers === 1 && S.replies.length === 1 && S.replies[0].b.message_text === 'Posted to 4100 because it is a lease.' && !S.replies[0].b.thread_type, saw: q + ' · set buttons ' + setBtns + ' · composers ' + composers + ' · replies ' + S.replies.length };
  });
  await page.keyboard.press('Escape');

  /* ═══ the auditor clears it ═══ */
  await w.step('A6', 'the auditor · opens the Query: the owner\'s reply is in the thread; Mark checked clears it (one write), the bar says 2 of 3, no open queries', async () => {
    await openDaybook();
    await page.click(chip(1) + ' button[data-mk="open"]'); await page.waitForSelector(T('mk-sheet'), { timeout: 5000 }); await page.waitForSelector('[data-testid="rt-row"]', { timeout: 8000 });
    const thread = await txt(T('mk-thread')), composer = await page.locator(T('msg-body')).count(); await shot('08-auditor-sees-reply');
    await page.click(T('mk-set-clear')); await page.waitForSelector(T('mk-sheet'), { state: 'detached', timeout: 8000 }); await page.waitForTimeout(500);
    const bar = await txt(T('mk-count')), f = await txt(T('mk-filter')), c = await txt(chip(1));
    await shot('09-auditor-cleared');
    return { ok: composer === 1 && !/View only/.test(thread) && /lease/.test(thread) && /Checked/.test(c) && /2 of 3/.test(bar) && /All queries · 0/.test(f) && sets().slice(-1)[0].b.kind === 'checked', saw: thread.slice(0, 80) + ' · ' + c + ' · ' + bar + ' · ' + f };
  });
  await w.step('A7', 'the auditor · On hold takes an optional reason; a changed entry reads "Changed after review"', async () => {
    await page.click(chip(2) + ' button[data-mk="ask"]'); await page.waitForSelector(T('mk-sheet'), { timeout: 5000 }); await page.click(T('mk-set-hold')); await page.waitForSelector(T('mk-sheet'), { state: 'detached', timeout: 8000 }); await page.waitForTimeout(300);
    const hold = await txt(chip(2));
    S.marks[E[0]].altered = true; await openDaybook();
    const alt = await txt(chip(0)); await shot('10-changed-after-review');
    return { ok: /On hold/.test(hold) && /Changed after review/.test(alt) && sets().slice(-1)[0].b.kind === 'on_hold', saw: hold + ' · ' + alt };
  });

  /* ═══ the fit and the keyboard ═══ */
  await w.step('F1', '1366×768 · no page scroll, no sideways scroll', async () => { const a = await noScroll(); return { ok: a.y && a.x, saw: 'vertical ' + a.y + ' · sideways ' + a.x }; });
  await w.step('F2', '390×844 · the Day book with chips and the bar, and the sheet, fit: no page scroll, no sideways scroll, the sheet inside the screen', async () => {
    await page.setViewportSize(NARROW); await page.waitForTimeout(400);
    const a = await noScroll(); await shot('11-phone-daybook');
    await page.click(chip(1) + ' button[data-mk="open"]'); await page.waitForSelector(T('mk-sheet'), { timeout: 5000 }); await page.waitForTimeout(400);
    const b = await noScroll(), box = await page.evaluate(() => { const r = document.querySelector('dialog.mk-sheet').getBoundingClientRect(); return { w: r.width <= window.innerWidth + 1, h: r.height <= window.innerHeight + 1 }; });
    await shot('12-phone-sheet'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    return { ok: a.y && a.x && b.y && b.x && box.w && box.h, saw: 'list ' + a.y + '/' + a.x + ' · with sheet ' + b.y + '/' + b.x + ' · sheet inside ' + box.w + '/' + box.h };
  });
  await w.step('K1', 'keyboard only · focus a chip, Enter opens the sheet, Escape closes it and focus returns to the chip', async () => {
    await page.setViewportSize(WIDE); await page.waitForTimeout(300);
    await page.focus(chip(1) + ' button[data-mk="open"]'); await page.keyboard.press('Enter'); await page.waitForSelector(T('mk-sheet'), { timeout: 5000 });
    const inSheet = await page.evaluate(() => !!document.activeElement.closest('dialog.mk-sheet'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const back = await page.evaluate((id) => !!document.activeElement.closest('[data-mark*="' + id + '"]'), E[1]);
    return { ok: inSheet && back, saw: 'focus in the sheet ' + inSheet + ' · back on the chip ' + back };
  });
  await w.step('X1', 'a write by the owner is refused in the server\'s words (he cannot set a mark)', async () => {
    const r = await page.evaluate(async (a) => { const res = await fetch('/api/marks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adopter: 'acc.audit', subject_id: a, kind: 'checked' }) }); return res.status; }, E[2]);
    return { ok: r === 403, saw: 'status ' + r };
  });
});
