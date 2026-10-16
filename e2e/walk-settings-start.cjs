#!/usr/bin/env node
/**
 * e2e/walk-settings-start.cjs — CB SETTINGS · START HERE and YOUR BUSINESS (BUILD-R1, 2026-10-16), the accepted design (docs/design/settings-setup/), WALKED on IN · AU · AE.
 * Black box: it presses what an owner presses and reads what the screen says. FIXTURE shops; the API is a stand-in answering inside the page (it applies the vault's
 * merge-patch, the profile PATCH and the country-setup PUT, so what a row saved can be read back after a reload).
 *   S  Start here is the sidebar's first item with how many questions are left; the six questions in the prototype's order; the one-row rule (unanswered = control inline ·
 *      answered = value + ✎); NO AUTOSAVE (SAVE-CARD 2026-10-16): each CARD keeps drafts and shows "n changes · Undo · Save"; Save writes through each row's existing writer and says "✓ Saved" on the card; a critical change goes through ONE inline Review first. Each row is written through ITS existing writer (country-setup PUT · PATCH /entities/profile · the vault's merge-patch);
 *      rows with no store yet (kind of business · nature) are disabled with ⓘ "Coming soon" and write nothing; "Set for you" shows where each default came from.
 *   B  Your business = seven cards with ✓ Done / Not needed yet; state · PAN · structure DERIVED from the tax number ("from GSTIN", no ✎); a wrong tax number STAYS on its
 *      row in red with the reason and writes nothing; Bank & payments is a summary whose ✎ opens the vault's bank section in a popup; Export is off until "Turn on".
 *   C  Per country: IN (derived rows, CIN for a company), AU (ABN check digits, ACN optional), AE (TRN, trade licence required); no India words on AU / AE.
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-settings-start.cjs [--show]
 */
'use strict';
const W = require('./lib/walk.cjs');
const C = require('./lib/contract.cjs');
const J = C.json;

const AU_ZONES = ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth', 'Australia/Adelaide', 'Australia/Darwin', 'Australia/Hobart'];
const COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR', fy_start_month: 4, zones: ['Asia/Kolkata'], locale: 'en-IN', books: true },
  { code: 'AU', name: 'Australia', currency: 'AUD', fy_start_month: 7, zones: AU_ZONES, locale: 'en-AU', books: true },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', fy_start_month: 1, zones: ['Asia/Dubai'], locale: 'ar-AE', books: true },
];
const ok = { ok: true, code: null, why: null };
const T = (s) => '[data-testid="' + s + '"]';

/** the stand-in: one shop per country, FIRST VISIT (nothing answered); `S.cc` picks it */
function fresh(cc) {
  const row = COUNTRIES.find((c) => c.code === cc);
  return {
    cc, calls: [], version: '1000',
    me: { user_id: cc.toLowerCase() + '-shop1-walk', display_name: cc.toLowerCase() + '-shop1-walk', country: cc, country_code: cc, currency_code: row.currency, gstn: null, address: '', supplies: 'unknown', business_status: 'open' },
    cs: { migrated: true, done: false, required: true, country: { code: cc, name: row.name }, currency: row.currency, fy_start_month: row.fy_start_month, timezone: row.zones[0], zones: row.zones,
      tax: { registered: false, number: null, scheme: null }, source: { country: 'your registration', currency: 'your registration' }, constituted: false, constituted_by: { products: false, chits: false, entries: false },
      countries: COUNTRIES, pack: { id: cc, version: '1.0.0', books: true, code: null, why: null } },
    vault: { sections: [] },
  };
}
/** RFC 7386 over the keyed view (the api's lib/vault-patch, as the page's vaultKeys sends it) — applied to the stand-in's vault */
function applyPatch(vault, patch) {
  const keyOf = (s) => String(s.type || 'other') + '|' + String(s.label || '');
  Object.keys(patch.sections || {}).forEach((key) => {
    const p = patch.sections[key];
    let sec = vault.sections.find((s) => keyOf(s) === key);
    if (p === null) { vault.sections = vault.sections.filter((s) => keyOf(s) !== key); return; }
    if (!sec) { sec = { type: p.type, label: p.label || '', rows: [] }; vault.sections.push(sec); }
    Object.keys(p.rows || {}).forEach((rk) => {
      const row = p.rows[rk], idx = sec.rows.findIndex((r) => (r.tag ? 't:' + r.tag.toLowerCase() : 'n:' + (r.name || '')) === rk);
      if (row === null) { if (idx >= 0) sec.rows.splice(idx, 1); return; }
      if (idx >= 0) sec.rows[idx] = row; else sec.rows.push(row);
    });
  });
}

const walk = async (w) => {
  const { page, ctx, base } = w;
  let S = fresh('IN');
  await ctx.route('**/api/**', async (r) => {
    const q = r.request(), p = new URL(q.url()).pathname, m = q.method();
    let body = null; try { body = q.postData() ? JSON.parse(q.postData()) : null; } catch (_) {}
    if (m !== 'GET' && p !== '/api/events/ticket') S.calls.push({ m, p, body });
    if (p === '/api/entities/me') return J(r, 200, { entity: S.me });
    if (p === '/api/entities/profile' && m === 'PATCH') {
      if (body.display_name !== undefined && String(body.display_name).length < 2) return J(r, 400, { error: 'Validation failed', message: 'A business name is 2 characters or more.' });
      Object.assign(S.me, body); return J(r, 200, { ok: true });
    }
    if (p === '/api/governance/profile' && m === 'GET') return J(r, 200, { vault: S.vault, vault_version: S.version, vault_encrypted: true });
    if (p === '/api/governance/profile/vault' && m === 'PUT') { applyPatch(S.vault, body.patch); S.version = String(Number(S.version) + 1); return J(r, 200, { vault: S.vault, version: S.version }); }
    if (p === '/api/governance/country-setup' && m === 'PUT') {
      const row = COUNTRIES.find((c) => c.code === body.country) || {};
      S.cs = Object.assign({}, S.cs, { done: true, required: false, country: { code: body.country, name: row.name }, currency: body.currency, fy_start_month: body.fy_start_month,
        timezone: body.timezone || S.cs.timezone, zones: row.zones || S.cs.zones, tax: body.tax, source: Object.assign({}, S.cs.source, body.source || {}) });
      S.me.country = body.country; S.me.gstn = body.tax && body.tax.number || S.me.gstn;
      return J(r, 200, S.cs);
    }
    if (p === '/api/governance/country-setup') return J(r, 200, S.cs);
    if (p === '/api/entities/policy' && m === 'GET') return J(r, 200, { flags: { trade_side: 'sell', number_words: 'pack' }, schema: {}, bound: {}, bound_schema: {}, may: { trade_side: ok, number_words: ok } });
    if (p === '/api/facts/rail') return J(r, 200, { suppliers: 0, customers: 0 });
    return J(r, 200, {});
  });
  await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const has = (sel) => page.locator(sel).first().count().then((n) => n > 0);
  const go = async (sec, ready, cc, reset) => {
    if (cc && (S.cc !== cc || reset)) S = fresh(cc);
    await page.goto(base + '/settings.html?t=' + Date.now() + '#/' + sec); await page.waitForSelector(ready, { timeout: 20000 }); await page.waitForTimeout(400); // clock-ok: cache-buster
  };
  const START = T('start-screen'), BIZ = T('biz-screen');
  // SAVE-CARD 2026-10-16: a box only keeps a draft; the card's Save writes (a critical change asks the inline Review first, and the walk presses Confirm)
  const cardOfBox = (k) => page.$eval(T('in-' + k), (n) => { const c = n.closest('[data-testid^="card-"]'); return c ? c.getAttribute('data-testid').slice(5) : 'start'; });
  const press = async (card) => { await page.click(T('save-' + card), { timeout: 4000 }).catch((e) => { throw new Error('save-' + card + ' not clickable: ' + e.message.split(String.fromCharCode(10))[0]); }); await page.waitForTimeout(300); if (await page.locator(T('review-' + card)).count()) await page.click(T('confirm-' + card)); await page.waitForTimeout(1200); };   // clock-ok: the writes settle
  const fill = async (k, v) => { await page.fill(T('in-' + k), v); };
  const write = async (k, v) => { await fill(k, v); await press(await cardOfBox(k)); };
  const calls = (re) => S.calls.filter((c) => re.test(c.m + ' ' + c.p));
  const vaultPuts = () => calls(/^PUT \/api\/governance\/profile\/vault/);
  const vget = (type, tag) => { const s = S.vault.sections.find((x) => x.type === type), r = s && s.rows.find((x) => x.tag === tag); return r ? r.value : ''; };
  const noIndia = async () => !/GSTIN|\bPAN\b|₹/.test(await page.locator('#set').innerText());

  /* ───────── S · START HERE (India, first visit) ───────── */
  await go('start', START, 'IN');
  await w.step('S1', 'IN first visit: Start here is the sidebar\'s first item with 5 questions left; the six questions are in the prototype\'s order', async () => {
    const nav = await page.$$eval('.nav-btn[data-sec]', (b) => b.map((x) => x.getAttribute('data-sec')));
    const badge = await txt(T('start-left')), prog = await txt(T('start-progress'));
    const order = await page.$$eval(T('start-questions') + ' [data-row]', (r) => r.map((x) => x.getAttribute('data-row')));
    const okOrder = order.join(',') === 'country,kind,supply,nature,taxNo,name,addr';
    return { ok: nav[0] === 'start' && badge === '5' && /0 of 5/.test(prog) && okOrder, saw: 'nav ' + nav.slice(0, 3).join('›') + ' · badge ' + badge + ' · ' + prog + ' · rows ' + order.join(' ') };
  });
  await w.step('S2', 'Country is unanswered: its picker is INLINE with "Use India", 🔒 on the label; kind and nature are DISABLED with ⓘ "Coming soon" and write nothing', async () => {
    const sel = await has(T('in-country')), use = await txt(T('use-country')), lock = await has(T('lock-country'));
    const kindDisabled = await page.locator(T('row-kind') + ' select').isDisabled(), natureDisabled = await page.locator(T('row-nature') + ' .chips button').first().isDisabled();
    await page.click(T('row-kind') + ' .info'); const tip = await txt(T('info-pop')); await page.mouse.click(5, 400);
    return { ok: sel && /Use India/.test(use) && lock && kindDisabled && natureDisabled && /Coming soon/.test(tip) && S.calls.length === 0, saw: 'picker ' + sel + ' · "' + use + '" · lock ' + lock + ' · kind/nature disabled ' + kindDisabled + '/' + natureDisabled + ' · ⓘ "' + tip + '" · writes ' + S.calls.length };
  });
  await w.step('S3', 'Use India (SAVE-CARD 2026-10-16) → a draft only; Save → the Review lists the country; Confirm → ONE country-setup PUT (country · money · year · tax), "✓ Saved" on the card, the row becomes value + ✎; the badge drops to 4', async () => {
    await page.click(T('use-country')); await page.waitForTimeout(300);
    const early = calls(/^PUT \/api\/governance\/country-setup/).length; await page.click(T('save-start')); await page.waitForTimeout(300);
    const rv = await txt(T('review-start')); await page.click(T('confirm-start')); await page.waitForTimeout(1200);
    const put = calls(/^PUT \/api\/governance\/country-setup/), val = await txt(T('val-country')), saved = await has(T('saved-start')), pen = await has(T('edit-country')), badge = await txt(T('start-left'));
    const b = put[0] && put[0].body;
    return { ok: early === 0 && /Country/.test(rv) && /India/.test(rv) && put.length === 1 && b.country === 'IN' && b.currency === 'INR' && b.fy_start_month === 4 && /India/.test(val) && (saved || pen) && badge === '4', saw: 'PUTs ' + put.length + ' · ' + (b ? b.country + '/' + b.currency + '/FY' + b.fy_start_month : '') + ' · "' + val + '" · ✓Saved ' + saved + ' · badge ' + badge };
  });
  await w.step('S4', 'What you supply (SAVE-CARD 2026-10-16): pressing Goods keeps a draft; Save (no Review: not critical) writes ONLY PATCH /entities/profile { supplies } (answering Country did not answer it)', async () => {
    const before = calls(/^PATCH \/api\/entities\/profile/).length;
    await page.click(T('seg-supply-goods')); await page.waitForTimeout(300);
    const early = calls(/^PATCH \/api\/entities\/profile/).length; await press('start');
    const patch = calls(/^PATCH \/api\/entities\/profile/);
    return { ok: before === 0 && early === 0 && patch.length === 1 && patch[0].body.supplies === 'goods' && S.me.supplies === 'goods' && /Goods/.test(await txt(T('val-supply'))), saw: 'before ' + before + ' · PATCH ' + JSON.stringify(patch.map((c) => c.body)) + ' · "' + (await txt(T('val-supply'))) + '"' };
  });
  await w.step('S5', 'A wrong tax number (SAVE-CARD 2026-10-16: Save is refused) STAYS on its row in red with the reason and writes nothing; the right one saves and the row closes', async () => {
    const puts = calls(/^PUT \/api\/governance\/country-setup/).length;
    await write('taxNo', '27AAPXU0939F1ZV');
    const why = await txt(T('why-taxNo')), still = await has(T('in-taxNo')), bad = await page.$eval(T('row-taxNo'), (n) => n.classList.contains('bad')), same = calls(/^PUT \/api\/governance\/country-setup/).length === puts;
    await write('taxNo', '27AAPFU0939F1ZV');
    const after = calls(/^PUT \/api\/governance\/country-setup/), last = after[after.length - 1].body, val = await txt(T('val-taxNo')), gone = !(await has(T('why-taxNo')));
    return { ok: /holder type/.test(why) && still && bad && same && last.tax.registered === true && last.tax.number === '27AAPFU0939F1ZV' && /27AAPFU0939F1ZV/.test(val) && gone, saw: '"' + why.slice(0, 60) + '…" · stayed ' + still + ' · wrote nothing ' + same + ' · then PUT ' + JSON.stringify(last.tax) + ' · "' + val + '"' };
  });
  await w.step('S6', 'Business name (SAVE-CARD 2026-10-16: Save on the card) → PATCH display_name; a 1-letter name is refused in the server\'s words ON the row', async () => {
    await write('name', 'M');
    const why = await txt(T('why-name')), still = await has(T('in-name'));
    await write('name', 'Murugan Tea Shop');
    const patch = calls(/^PATCH \/api\/entities\/profile/).filter((c) => c.body.display_name === 'Murugan Tea Shop');
    return { ok: /2 characters/.test(why) && still && patch.length === 1 && /Murugan Tea Shop/.test(await txt(T('val-name'))), saw: '"' + why + '" · then ' + patch.length + ' PATCH · "' + (await txt(T('val-name'))) + '"' };
  });
  await w.step('S7', 'Address: PATCH address, and the vault\'s identity address row follows (one merge-patch); all five answered → "Ready to bill", the badge is gone', async () => {
    await write('addr', '12 MG Road, Fort, Mumbai 400001');
    const patch = calls(/^PATCH \/api\/entities\/profile/).filter((c) => c.body.address), ready = await has(T('start-ready')), badge = await has(T('start-left'));
    return { ok: patch.length === 1 && vget('identity', 'address') === '12 MG Road, Fort, Mumbai 400001' && ready && !badge && /5 of 5/.test(await txt(T('start-progress'))), saw: 'PATCH ' + patch.length + ' · vault address "' + vget('identity', 'address') + '" · ready ' + ready + ' · badge ' + badge };
  });
  await w.step('S8', '"Set for you": a table of Setting · Now · From — money, year, tax, dates and numbers, each with where it came from (nothing made up)', async () => {
    await page.click(T('set-for-you') + ' summary'); const rows = await page.$$eval(T('set-for-you') + ' .tr', (r) => r.map((x) => [...x.children].map((c) => c.textContent.trim()).join(' ')));
    const money = rows.find((x) => /^Money/.test(x)) || '', year = rows.find((x) => /^Year starts/.test(x)) || '';
    return { ok: rows.length >= 4 && /INR/.test(money) && /April/.test(year) && rows.every((x) => x.split(' ').length > 2), saw: rows.join(' | ') };
  });

  /* ───────── B · YOUR BUSINESS (India) ───────── */
  await go('shop', BIZ, 'IN');
  await w.step('B1', 'IN: the seven cards, in order, each with a status chip; Start-here questions answered → no "questions left" bar', async () => {
    const heads = await page.$$eval(T('biz-cards') + ' .card h2', (h) => h.map((x) => x.textContent.trim()));
    const st = await page.$$eval(T('biz-cards') + ' .card .st', (h) => h.map((x) => x.textContent.trim()));
    return { ok: heads.join('|') === 'Name & kind|Contact & address|Tax & registration|Licences|Bank & payments|Who signs|Export' && st[3] === 'Not needed yet' && st[4] === 'Not needed yet' && st[6] === 'Off' && !(await has(T('biz-left'))), saw: heads.join(' · ') + ' · ' + st.join(' · ') };
  });
  await w.step('B2', 'Tax & registration: State · PAN · Business structure are DERIVED from the number ("from GSTIN", no ✎); GST type has its ⓘ', async () => {
    const st = await txt(T('row-_state')), pan = await txt(T('row-_pan')), str = await txt(T('row-_str')), pens = await page.locator(T('edit-_state') + ',' + T('edit-_pan') + ',' + T('edit-_str')).count();
    const tip = await has(T('row-taxType') + ' .info');
    return { ok: /Maharashtra \(27\)/.test(st) && /from GSTIN/.test(st) && /AAPFU0939F/.test(pan) && /Partnership firm/.test(str) && /F in the PAN/.test(str) && pens === 0 && tip, saw: st + ' · ' + pan + ' · ' + str + ' · ✎ ' + pens + ' · ⓘ ' + tip };
  });
  await w.step('B3', 'Phone and Registered name save into the vault (identity rows, one merge-patch each, "✓ Saved"); the card turns "✓ Done"', async () => {
    const before = vaultPuts().length;
    await write('phone', '+91 98200 12345'); await write('regd', 'Murugan & Sons');
    const n = vaultPuts().length - before, st = await txt(T('status-contact')), tax = await txt(T('status-tax'));
    return { ok: n === 2 && vget('identity', 'phone') === '+91 98200 12345' && vget('identity', 'legal_name') === 'Murugan & Sons' && /Done/.test(st) && /Done/.test(tax), saw: 'vault PUTs ' + n + ' · phone "' + vget('identity', 'phone') + '" · legal "' + vget('identity', 'legal_name') + '" · contact ' + st + ' · tax ' + tax };
  });
  await w.step('B4', 'A wrong tax number on the card: the red line at the top "GSTIN is wrong · Fix", the card red with "✕ Wrong", nothing written; Fix focuses the row', async () => {
    await page.click(T('edit-taxNo')); const before = calls(/country-setup/).length;
    await write('taxNo', '27AAPXU0939F1ZV');
    const alert = await txt(T('biz-wrong')), chip = await txt(T('status-tax')), red = await page.$eval(T('card-tax'), (n) => n.classList.contains('bad')), same = calls(/country-setup/).length === before;
    await fill('taxNo', '27AAPFU0939F1ZV');   // SAVE-CARD 2026-10-16: typing the number it already holds is no change — the red goes, no Save needed
    await page.waitForTimeout(300);
    return { ok: /GSTIN is wrong/.test(alert) && /Wrong/.test(chip) && red && same && !(await has(T('biz-wrong'))), saw: '"' + alert + '" · chip ' + chip + ' · card red ' + red + ' · wrote nothing ' + same + ' · fixed → alert gone ' + !(await has(T('biz-wrong'))) };
  });
  await w.step('B5', 'Bank & payments is a summary: "Add now" opens today\'s bank section of the vault in a popup, a change saves itself, the card shows the summary and ✓ Done', async () => {
    await page.click(T('bank-add')); await page.waitForSelector(T('pop-vault'), { timeout: 5000 });
    await page.click(T('pop-bank') + ' ' + T('vault-add-section')); await page.waitForTimeout(300);
    const inputs = page.locator(T('pop-vault') + ' input.inp');
    await inputs.nth(2).fill('HDFC Bank'); await inputs.nth(2).press('Tab'); await page.waitForTimeout(900);
    await inputs.nth(4).fill('50100123454521'); await inputs.nth(4).press('Tab'); await page.waitForTimeout(900);
    const saved = await has(T('saved-vault')); await page.click(T('pop-bank') + ' .df .act'); await page.waitForTimeout(400);
    const line = await txt(T('row-bank')), chip = await txt(T('status-bank'));
    return { ok: saved && /HDFC Bank ••4521/.test(line) && /Done/.test(chip) && vget('bank', 'bank_name') === 'HDFC Bank', saw: 'saved ' + saved + ' · "' + line + '" · ' + chip };
  });
  await w.step('B6', 'Export is OFF by default ("Only if you sell abroad · Turn on"); Turn on reveals the export rows (IEC required) and a door to the vault\'s logistics section', async () => {
    const off = await txt(T('card-export')), hasIec0 = await has(T('in-exp_iec'));
    await page.click(T('export-on')); await page.waitForTimeout(300);
    const iec = await has(T('in-exp_iec')) || await has(T('row-exp_iec')), more = await has(T('export-more'));
    await write('exp_iec', 'ABCDE12345'); const put = vget('licence', 'iec');
    return { ok: /Only if you sell abroad/.test(off) && !hasIec0 && iec && more && put === 'ABCDE12345', saw: '"' + off.slice(0, 60) + '" · iec before ' + hasIec0 + ' → after ' + iec + ' · vault iec "' + put + '"' };
  });
  await w.step('B7', 'Not registered (IN): the number row goes, a PAN row asks instead; the store is the country-setup PUT { registered: false }', async () => {
    await page.click(T('edit-taxReg')); await page.selectOption(T('in-taxReg'), 'no'); await press('tax');   // SAVE-CARD 2026-10-16
    const last = calls(/^PUT \/api\/governance\/country-setup/).pop().body, pan = await has(T('row-pan')), num = await has(T('row-taxNo')), derived = await has(T('row-_state'));
    return { ok: last.tax.registered === false && pan && !num && !derived, saw: 'PUT tax ' + JSON.stringify(last.tax) + ' · PAN row ' + pan + ' · number row ' + num + ' · derived ' + derived };
  });
  await w.step('B8', 'Rows with no store yet (kind · nature · tagline · signature) are disabled with ⓘ "Coming soon"; the page wrote no key for them', async () => {
    await page.click(T('open-sign')); await page.waitForTimeout(200);
    const dis = [];
    for (const k of ['kind', 'nature', 'tagline', 'signature']) { dis.push(k + ':' + await page.locator(T('row-' + k) + ' select, ' + T('row-' + k) + ' input, ' + T('row-' + k) + ' .chips button').first().isDisabled().catch(() => 'n/a')); }
    const bodies = JSON.stringify(S.calls.map((c) => c.body)); const stray = /"(kind|nature|tagline|vertical|signature|structure)"/i.test(bodies);
    return { ok: dis.every((x) => /true/.test(x)) && !stray, saw: dis.join(' ') + ' · any such key written ' + stray };
  });
  await w.step('B9', 'A phone: the cards are one column at 390 px, no sideways scroll, no India word on a non-India page later', async () => {
    await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(300);
    const dim = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, cols: getComputedStyle(document.querySelector('[data-testid="biz-cards"]')).gridTemplateColumns.split(' ').length }));
    await page.setViewportSize({ width: 1366, height: 900 });
    return { ok: dim.sw <= dim.cw && dim.cols === 1, saw: 'scrollWidth ' + dim.sw + ' vs ' + dim.cw + ' · columns ' + dim.cols };
  });
  await w.step('B10', 'Reload: everything the rows saved is read back from the stores (name · address · phone · registered name · bank · supplies)', async () => {
    S.cs.tax = { registered: true, number: '27AAPFU0939F1ZV', scheme: 'regular' };
    await go('shop', BIZ);
    const name = await txt(T('val-name')), addr = await txt(T('val-addr')), phone = await txt(T('val-phone')), regd = await txt(T('val-regd')), bank = await txt(T('row-bank')), sup = await txt(T('val-supply'));
    return { ok: /Murugan Tea Shop/.test(name) && /12 MG Road/.test(addr) && /98200/.test(phone) && /Murugan & Sons/.test(regd) && /HDFC/.test(bank) && /Goods/.test(sup), saw: [name, addr, phone, regd, bank, sup].join(' · ') };
  });
  await w.step('B11', 'Start here is gone from the sidebar once all questions are answered; a bare /settings.html lands on Your business', async () => {
    await page.goto(base + '/settings.html?t=' + Date.now()); await page.waitForSelector(BIZ, { timeout: 20000 }); await page.waitForTimeout(600); // clock-ok: cache-buster
    const hidden = await page.$eval('.nav-btn[data-sec="start"]', (b) => getComputedStyle(b).display === 'none'), hash = await page.evaluate(() => location.hash);
    return { ok: hidden && hash === '#/shop', saw: 'Start here hidden ' + hidden + ' · landed ' + hash };
  });


  /* ───────── D · SAVE-CARD 2026-10-16: drafts, the card bar, the inline Review (IN, Your business, everything answered) ───────── */
  const nputs = () => vaultPuts().length, npatch = () => calls(/^PATCH \/api\/entities\/profile/).length, nput = () => calls(/^PUT \/api\/governance\/country-setup/).length;
  await w.step('D1', 'SAVE-CARD 2026-10-16: leaving a box writes nothing — type, Tab out, press Enter: the draft stays ("1 change", the row marked), no request', async () => {
    const n0 = S.calls.length; await page.click(T('edit-name')); await page.fill(T('in-name'), 'Murugan Tea House'); await page.press(T('in-name'), 'Enter'); await page.press(T('in-name'), 'Tab'); await page.waitForTimeout(800);
    const count = await txt(T('count-biz')), marked = await page.$eval(T('row-name'), (n) => n.classList.contains('chg')), still = await page.inputValue(T('in-name'));
    return { ok: S.calls.length === n0 && /^1 change$/.test(count) && marked && still === 'Murugan Tea House', saw: 'requests ' + (S.calls.length - n0) + ' · bar "' + count + '" · row marked ' + marked + ' · box "' + still + '"' };
  });
  await w.step('D5', 'SAVE-CARD 2026-10-16: Undo drops the card\'s drafts — the bar goes, the value is as it was, nothing written', async () => {
    const n0 = S.calls.length; await page.click(T('undo-biz')); await page.waitForTimeout(300);
    const bar = await page.locator(T('bar-biz')).isVisible(), val = await txt(T('val-name')), pen = await has(T('edit-name'));
    return { ok: S.calls.length === n0 && !bar && /Murugan Tea Shop/.test(val) && pen, saw: 'requests ' + (S.calls.length - n0) + ' · bar visible ' + bar + ' · "' + val + '" · ✎ ' + pen };
  });
  await w.step('D2', 'SAVE-CARD 2026-10-16: two non-critical changes in one card → "2 changes", ONE Save, NO Review, both written (PATCH address + vault phone), "✓ Saved" on the card', async () => {
    const p0 = npatch(), v0 = nputs();
    await page.click(T('edit-addr')); await page.fill(T('in-addr'), '99 Church Street, Bengaluru'); await page.click(T('edit-phone')); await page.fill(T('in-phone'), '+91 80000 11111');
    const count = await txt(T('count-contact')); await page.click(T('save-contact')); await page.waitForTimeout(1500);
    const review = await page.locator(T('review-contact')).count(), saved = await has(T('saved-contact'));
    return { ok: /^2 changes$/.test(count) && review === 0 && npatch() - p0 === 1 && S.me.address === '99 Church Street, Bengaluru' && vget('identity', 'phone') === '+91 80000 11111' && nputs() > v0 && saved, saw: 'bar "' + count + '" · Review ' + review + ' · PATCH ' + (npatch() - p0) + ' · phone "' + vget('identity', 'phone') + '" · ✓ Saved ' + saved };
  });
  await w.step('D3', 'SAVE-CARD 2026-10-16: a critical change (Registered name) → Save opens ONE Review "label old → new"; Keep as it was writes nothing and restores; Confirm writes', async () => {
    const v0 = nputs();
    await page.click(T('edit-regd')); await page.fill(T('in-regd'), 'Murugan Brothers'); await page.click(T('save-tax')); await page.waitForTimeout(400);
    if (process.env.CB_SHOT_DIR) await page.locator(T('card-tax')).screenshot({ path: process.env.CB_SHOT_DIR + '/review-open-tax-IN-cream-1366.png' });   // SAVE-CARD 2026-10-16: the Review open (opt-in)
    const rv = await txt(T('review-tax')), was = await txt(T('was-regd')), now = await txt(T('now-regd')), early = nputs() === v0;
    await page.click(T('keep-tax')); await page.waitForTimeout(400);
    const kept = await txt(T('val-regd')), none = nputs() === v0 && !(await page.locator(T('review-tax')).count());
    await page.click(T('edit-regd')); await page.fill(T('in-regd'), 'Murugan Brothers'); await page.click(T('save-tax')); await page.waitForTimeout(300);
    const btn = await txt(T('confirm-tax')); await page.click(T('confirm-tax')); await page.waitForTimeout(1500);
    return { ok: /Registered name/.test(rv) && /Murugan & Sons/.test(was) && /Murugan Brothers/.test(now) && /→/.test(rv) && early && /Murugan & Sons/.test(kept) && none && /Confirm 1 change/.test(btn) && vget('identity', 'legal_name') === 'Murugan Brothers', saw: '"' + rv.slice(0, 70) + '" · Keep → "' + kept + '", wrote nothing ' + none + ' · "' + btn + '" → vault "' + vget('identity', 'legal_name') + '"' };
  });
  await w.step('D4', 'SAVE-CARD 2026-10-16: a wrong tax number blocks the card\'s Save — the reason on its row, NO Review, and nothing in the card (the registered name too) is written', async () => {
    const v0 = nputs(), c0 = nput();
    await page.click(T('edit-regd')); await page.fill(T('in-regd'), 'Murugan Group'); await page.click(T('edit-taxNo')); await page.fill(T('in-taxNo'), '27AAPXU0939F1ZV');
    await page.click(T('save-tax')); await page.waitForTimeout(500);
    const why = await txt(T('why-taxNo')), review = await page.locator(T('review-tax')).count();
    await page.click(T('undo-tax')); await page.waitForTimeout(300);
    return { ok: /holder type/.test(why) && review === 0 && nputs() === v0 && nput() === c0, saw: '"' + why.slice(0, 50) + '" · Review ' + review + ' · vault PUTs +' + (nputs() - v0) + ' · country PUTs +' + (nput() - c0) };
  });

  /* ───────── C · AUSTRALIA ───────── */
  await go('start', START, 'AU');
  await w.step('C1', 'AU first visit: Start here asks for the ABN (the pack\'s word), AU zones are asked by city; no India word on the page', async () => {
    const label = await txt(T('row-taxNo') + ' .lb'), tz = await has(T('in-timezone')), words = await noIndia();
    return { ok: /^ABN/.test(label) && words, saw: label + ' · time zone row ' + tz + ' · no India words ' + words };
  });
  await go('shop', BIZ);
  await w.step('C2', 'AU Your business: ABN, structure DISABLED (coming soon), ACN optional; a wrong ABN stays on its row with the check-digit reason; a right one saves', async () => {
    const hasTaxReg = await has(T('row-taxReg'));
    await page.selectOption(T('in-taxReg'), 'yes'); await page.waitForTimeout(400);   // SAVE-CARD 2026-10-16: a draft
    await write('taxNo', '11111111111'); const why = await txt(T('why-taxNo')), nothing = calls(/^PUT \/api\/governance\/country-setup/).length === 0;
    await write('taxNo', '51824753556'); const put = calls(/^PUT \/api\/governance\/country-setup/).pop();
    const structDisabled = await page.locator(T('row-structure') + ' select').isDisabled(), acn = /optional/.test(await txt(T('row-acn') + ' .lb'));
    return { ok: hasTaxReg && /check digits|digits/.test(why) && nothing && put && put.body.tax.number === '51824753556' && structDisabled && acn && await noIndia(), saw: '"' + why + '" · nothing written ' + nothing + ' · PUT ' + (put ? JSON.stringify(put.body.tax) : 'none') + ' · structure disabled ' + structDisabled + ' · ACN optional ' + acn };
  });
  await w.step('C3', 'AU: ACN saves as a licence-section row (tag acn) in the vault; the licences are the AU ones (Food business licence, Council permit); no derived State/PAN rows', async () => {
    await page.click(T('add-acn')); await write('acn', '824753556');
    await page.click(T('open-lic')); const labels = await page.$$eval(T('card-lic') + ' .row .lb', (l) => l.map((x) => x.textContent.replace('*', '').trim()));
    return { ok: vget('licence', 'acn') === '824753556' && labels.some((x) => /Food business licence/.test(x)) && labels.some((x) => /Council permit/.test(x)) && !(await has(T('row-_state'))) && await noIndia(), saw: 'acn "' + vget('licence', 'acn') + '" · ' + labels.join(' · ') };
  });

  /* ───────── C · UAE ───────── */
  await go('shop', BIZ, 'AE');
  await w.step('C4', 'AE Your business: TRN (15 digits) — a short one stays on its row in red; the right one saves; Legal form disabled; Trade licence no. is required', async () => {
    await page.selectOption(T('in-taxReg'), 'yes'); await page.waitForTimeout(400);
    await write('taxNo', '1001234'); const why = await txt(T('why-taxNo')), nothing = calls(/^PUT \/api\/governance\/country-setup/).length === 0;
    await write('taxNo', '100123456700003'); const put = calls(/^PUT \/api\/governance\/country-setup/).pop();
    const legal = await page.locator(T('row-structure') + ' select').isDisabled(), tl = /\*/.test(await txt(T('row-tl') + ' .lb'));
    return { ok: /15/.test(why) && nothing && put && put.body.tax.number === '100123456700003' && legal && tl && await noIndia(), saw: '"' + why + '" · nothing written ' + nothing + ' · PUT ' + (put ? JSON.stringify(put.body.tax) : 'none') + ' · legal form disabled ' + legal + ' · trade licence required ' + tl };
  });
  await w.step('C5', 'AE: Trade licence no. saves as a licence row in the vault; the UAE has no IFSC-style India rows; Export asks for a Customs code', async () => {
    await write('tl', '1234567'); const sec = S.vault.sections.find((s) => s.type === 'licence' && s.label === 'Trade licence'), row = sec && sec.rows.find((r) => r.tag === 'licence_no');
    await page.click(T('export-on')); const label = await txt(T('row-exp_iec') + ' .lb');
    return { ok: row && row.value === '1234567' && /Customs code/.test(label) && await noIndia(), saw: 'trade licence "' + (row && row.value) + '" · export row "' + label + '"' };
  });
  await go('start', START, 'AE', true);
  await w.step('C6', 'AE Start here: the tax question reads TRN; typing a short TRN stays red on the row; "Not registered" is one press and one PUT', async () => {
    await write('taxNo', '123'); const why = await txt(T('why-taxNo')), puts = calls(/^PUT \/api\/governance\/country-setup/).length;
    await page.click(T('notreg')); await press('start');   // SAVE-CARD 2026-10-16: a draft, then Save + the Review's Confirm
    const last = calls(/^PUT \/api\/governance\/country-setup/).pop().body;
    return { ok: /TRN/.test(await txt(T('row-taxNo') + ' .lb')) && /15 digits/.test(why) && last.tax.registered === false, saw: '"' + why + '" · then PUT ' + JSON.stringify(last.tax) };
  });
  if (w.errs.length) w.note('T99', 'page errors seen during the walk', w.errs.slice(0, 3).join(' | '));
};
walk.opts = { viewport: { width: 1366, height: 900 } };
W.run('settings-start', walk);
