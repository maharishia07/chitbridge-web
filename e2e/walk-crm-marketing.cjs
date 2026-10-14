#!/usr/bin/env node
/**
 * e2e/walk-crm-marketing.cjs - CB CRM › GROUPS & SEGMENTS · the REWARDS pane · the SHOP WINDOW, WALKED (T3-P2-CRM, 2026-10-14).
 * Black box: it presses what an owner presses - Groups (the four segments and the named groups with the SERVER's counts), ▸ a row's members,
 * + New group (tick two customers, Save → ONE POST), Send offer message (Who may be sent? = the server's dry answer by code, then Send = the one
 * sender's outcome per member), Delete (asks first, names the offers), a viewer (every action greyed WITH the server's sentence), the record's
 * Rewards fold (the engine's words: balance · worth · next · expiry · history), the Shop window (pick → PATCH policy, the preview is the shop's own
 * page, share with a party = the consent verdict decides whether Share is lit, share with a group = the Send sheet prefilled) - and reads what the
 * screen says. Then RULE 13: Groups, the record and the Shop window in Cream and Dark at 1366 and 390 px (e2e/lib/rule13.cjs).
 * A FIXTURE shop (the golden parties): the API is a stand-in answering inside the page the way chitbridge-api answers (lib/crm-groups.js: counts from
 * the list's rows, reach by lib/privacy's codes; the send refused in words without WHATSAPP_TOKEN); every /api/crm answer is held to the contract.
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-crm-marketing.cjs          headless (the stand-in)
 *   node e2e/walk-crm-marketing.cjs --show                                    watch it
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-crm-marketing.cjs --real   REAL: chitbridge-api as a child on the loader's Postgres (e2e/lib/real-api.cjs),
 *                                                                             sign-in through CBSignin; the paths that need a seed are NOTED, not asserted
 * One line per path: "ID · path · PASS/FAIL (what it saw)". Screenshots: e2e/shots/walk-crm-marketing-NN.png.
 */
'use strict';
const fs = require('fs'), path = require('path');
const W = require('./lib/walk.cjs');
const C = require('./lib/contract.cjs');
const crmApi = require('./lib/crm-api.cjs');
const { rule13 } = require('./lib/rule13.cjs');
const J = C.json;
const REAL = process.argv.includes('--real');
const FX = crmApi.resolve(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'golden-parties.json'), 'utf8')), Date.now());
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const claims = (c) => b64({ alg: 'none' }) + '.' + b64(Object.assign({ exp: Math.floor(Date.now() / 1000) + 3600 }, c)) + '.x';
const VIEWER = JSON.stringify({ token: claims({ identity_id: 'act-2', identity_type: 'actor', parent_entity_id: 'ent-walk', display_name: 'Vel', access_level: 'viewer' }), role: 'actor', name: 'Vel', entity: 'Fixture Shop', bridgeId: 'CBWALK0001' });
const NO_TOKEN = 'WHATSAPP_TOKEN is not set — outbound is not configured';

/* ── the stand-in: the api's own rules for this fixture (lib/crm-groups.js · lib/privacy.mayMessage · lib/whatsapp-out.notify without a token) ── */
const S = { calls: [], bodies: [], level: 'owner', consentOff: false, consent: { 'pid-0002': 'CONSENT', 'pid-0005': 'SAID_NO' }, offers: { 'group:Workshops': 1, regular: 2 }, flags: { showcase_template: 'showcase.food.menu@1.0' },
  list: JSON.parse(JSON.stringify(FX.list)), rewards: { 'pid-0002': { programme: 'Shop Rewards', points: 1260, worth: 630, negative: false, earns: '1 point for every ₹10 on the bill', says: 'worth ₹630 off the next bill', reach: [], next: { name: 'Free service wash', short: '240 points' }, money_known: true, expires_months: 12,
    recent: [{ at: '2026-10-10T09:00:00.000Z', points: 120, why: 'earned', ref: 'B-0412' }, { at: '2026-09-28T09:00:00.000Z', points: -200, why: 'spent', ref: 'B-0391' }, { at: '2026-09-20T09:00:00.000Z', points: 80, why: 'earned', ref: 'B-0377' }], expired_now: 0 } } };
const WHY = { NO_CONSENT: 'No consent for offers on whatsapp. Ask them first.', SAID_NO: 'They said no to offers on whatsapp.', CONSENT_WITHDRAWN: 'They withdrew consent for offers on whatsapp.', CONSENT: 'They agreed to offers on whatsapp.' };
const verdict = (id) => { const c = S.consentOff ? 'NO_CONSENT' : (S.consent[id] || 'NO_CONSENT'); return { may: c === 'CONSENT', code: c, why: WHY[c] }; };
const customers = () => S.list.filter((p) => p.kind !== 'walk-in' && !p.merged_into && (p.roles || []).indexOf('customer') >= 0);
const members = (k) => customers().filter((p) => (/^group:/.test(k) ? (p.groups || []).indexOf(k.slice(6)) >= 0 : p.segment === k));
const reach = (ps) => { const by = {}; let may = 0; ps.forEach((p) => { const v = verdict(p.party_id); if (v.may) may++; else by[v.code] = (by[v.code] || 0) + 1; }); return { may, not: ps.length - may, refused_by: Object.keys(by).sort().map((code) => ({ code, n: by[code] })) }; };
const mays = () => { const ok = { may: true, code: 'OK', why: '' }, vo = { may: false, code: 'VIEW_ONLY', why: 'Your login can only view.' }, oo = { may: false, code: 'OWNER_ONLY', why: 'Only the owner deletes a group.' };
  return S.level === 'owner' ? { group: ok, send: ok, delete: ok } : S.level === 'editor' ? { group: ok, send: ok, delete: oo } : { group: vo, send: vo, delete: oo }; };
const RULE = { new: 'fewer than 3 bills', regular: '3 or more bills', high_value: 'top 10% by bills in 12 months, at least 3 bills', inactive: 'no bill in 90 days' };
const WORD = { new: 'New', regular: 'Regular', high_value: 'High value', inactive: 'Inactive' };
function segments() {
  const segs = ['new', 'regular', 'high_value', 'inactive'].map((key) => { const ms = members(key); return { key, name: WORD[key], rule: RULE[key], count: ms.length, overrides: 0, offers: S.offers[key] || 0, reach: reach(ms) }; });
  const names = new Set(); customers().forEach((p) => (p.groups || []).forEach((g) => names.add(g)));
  const groups = [...names].sort().map((name) => { const ms = members('group:' + name); return { key: 'group:' + name, name, count: ms.length, offers: S.offers['group:' + name] || 0, reach: reach(ms) }; });
  return { segments: segs, groups, groups_migrated: true, consent_migrated: !S.consentOff, channel: 'whatsapp', purpose: 'marketing', customers: customers().length, may: mays() };
}
function send(key, body) {
  const ms = members(key), may = [], refused = [], by = {};
  ms.forEach((p) => { const v = verdict(p.party_id); if (v.may) may.push(p); else { refused.push({ party_id: p.party_id, name: p.display_name, code: v.code, why: v.why }); by[v.code] = (by[v.code] || 0) + 1; } });
  const out = { key, dry: !!body.dry, channel: 'whatsapp', purpose: 'marketing', members: ms.length, may: may.length, refused, refused_by: Object.keys(by).sort().map((code) => ({ code, n: by[code] })), sent: [], sent_n: 0, failed_n: 0, refused_n: refused.length };
  if (body.dry) return out;
  may.forEach((p) => { out.sent.push({ party_id: p.party_id, name: p.display_name, status: 'refused', reason: NO_TOKEN }); out.refused_n++; });
  return out;
}
async function route(r0) {
  const r = C.wrap(r0), q = r.request(), u = new URL(q.url()), p = u.pathname, m = q.method();
  S.calls.push(m + ' ' + p + u.search);
  let body = null; try { body = q.postDataJSON(); } catch (_) {}
  if (m !== 'GET') S.bodies.push({ m, p, body });
  let x;
  if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Fixture Shop', currency_code: 'INR' } });
  if (p === '/api/books/health') return J(r, 404, { error: 'Not found' });
  if (p === '/api/facts/rail') return J(r, 200, { suppliers: 2, customers: 4, in: 0, out: 0, stuck: 0 });
  if (p === '/api/crm/followups') return J(r, 200, crmApi.followups([]));
  if (p === '/api/crm/parties' && m === 'GET') return J(r, 200, crmApi.list(S.list, { records: FX.records }));
  if (p === '/api/crm/segments') return J(r, 200, segments());
  if (p === '/api/crm/groups' && m === 'POST') {
    if (S.level === 'viewer') return J(r, 403, { code: 'VIEW_ONLY', error: 'Your login can only view.', message: 'Your login can only view.' });
    const name = String(body.name || '').trim(); if (!/^[\p{L}\p{N} &\/-]+$/u.test(name)) return J(r, 400, { code: 'BAD_NAME', error: 'Name the group: up to 40 letters, digits, spaces, - & /.', message: 'Name the group: up to 40 letters, digits, spaces, - & /.' });
    let added = 0, removed = 0;
    S.list.forEach((pp) => { pp.groups = pp.groups || []; if ((body.add || []).indexOf(pp.party_id) >= 0 && pp.groups.indexOf(name) < 0) { pp.groups.push(name); added++; } if ((body.remove || []).indexOf(pp.party_id) >= 0 && pp.groups.indexOf(name) >= 0) { pp.groups = pp.groups.filter((g) => g !== name); removed++; } });
    return J(r, 201, { name, added, removed, count: members('group:' + name).length });
  }
  if ((x = p.match(/^\/api\/crm\/groups\/([^/]+)$/)) && m === 'DELETE') {
    if (S.level !== 'owner') return J(r, 403, { code: 'OWNER_ONLY', error: 'Only the owner deletes a group.', message: 'Only the owner deletes a group.' });
    const name = decodeURIComponent(x[1]); let n = 0; S.list.forEach((pp) => { if ((pp.groups || []).indexOf(name) >= 0) { pp.groups = pp.groups.filter((g) => g !== name); n++; } });
    return n ? J(r, 200, { name, removed: n }) : J(r, 404, { code: 'NOT_FOUND', error: 'No group by that name.', message: 'No group by that name.' });
  }
  if ((x = p.match(/^\/api\/crm\/segments\/([^/]+)\/send$/)) && m === 'POST') {
    if (S.level === 'viewer') return J(r, 403, { code: 'VIEW_ONLY', error: 'Your login can only view.', message: 'Your login can only view.' });
    if (!String(body.text || '').trim()) return J(r, 400, { code: 'NO_TEXT', error: 'Write the message.', message: 'Write the message.' });
    return J(r, 200, send(decodeURIComponent(x[1]), body));
  }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)\/timeline$/))) { const id = decodeURIComponent(x[1]); return J(r, 200, crmApi.timeline(FX.timelines[id] || { entries: [] }, id, { limit: u.searchParams.get('limit') })); }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)\/interactions$/)) && m === 'POST') {
    if (body.direction === 'out' && body.kind === 'message') { const v = verdict(decodeURIComponent(x[1])); if (!v.may) return J(r, 403, { code: v.code, error: v.why, message: v.why, why: v.why }); }
    return J(r, 201, crmApi.interaction(body));
  }
  if ((x = p.match(/^\/api\/crm\/parties\/([^/]+)$/)) && m === 'GET') {
    const id = decodeURIComponent(x[1]), row = S.list.find((pp) => pp.party_id === id); if (!row) return J(r, 404, { code: 'NOT_FOUND', error: 'Not found', message: 'Not your party.' });
    const rec = crmApi.record(S.list, id, FX.records[id], []), v = verdict(id);
    rec.contact_prefs.migrated = !S.consentOff; rec.contact_prefs.may.whatsapp.marketing = v;
    return J(r, 200, rec);
  }
  if ((x = p.match(/^\/api\/relationships\/customers\/([^/]+)\/rewards$/))) { const id = decodeURIComponent(x[1]); return J(r, 200, S.rewards[id] || { programme: null, points: 0, says: 'This shop does not run a points programme.' }); }
  if (p === '/api/entities/policy' && m === 'GET') return J(r, 200, { flags: S.flags });
  if (p === '/api/entities/policy' && m === 'PATCH') { if (S.level === 'viewer') return J(r, 403, { error: 'Forbidden', message: 'Only the owner changes the shop window.' }); Object.assign(S.flags, body); return J(r, 200, { ok: true, flags: S.flags }); }
  return J(r, 200, {});
}

const walk = async (w) => {
  const { page, ctx, base } = w;
  let api = null;
  if (REAL) {
    /* the real stack: chitbridge-api as a child on the loader's Postgres; the walk signs in through the one sign-in window (e2e/lib/real-api.cjs) */
    api = await require('./lib/real-api.cjs').start({ origin: base });
    await ctx.addInitScript((b) => { try { localStorage.setItem('cb_api_base', b); } catch (_) {} }, api.base);
  } else {
    await ctx.route('**/api/**', route);
    /* the preview frame is the shop's OWN page: here a stub that echoes its address, so the walk asserts the src and loads no catalogue */
    await ctx.route('**/shop.html*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body style="font:15px system-ui;padding:12px;background:#fffdf8;color:#2a2418"><b>Shop window preview</b><div id="u"></div><script>document.getElementById("u").textContent=location.search</script>' }));
    await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  }
  await ctx.addInitScript(() => { window.open = function (u) { window.__opened = (window.__opened || []).concat([String(u)]); return {}; }; });

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const has = (sel) => page.locator(sel).first().count().then((n) => n > 0);
  const posts = (re) => S.bodies.filter((b) => re.test(b.m + ' ' + b.p));
  const groups = async () => { await page.goto(base + '/crm.html#/groups'); await page.waitForSelector('[data-testid="crm-grp-count-regular"]', { timeout: 20000 }); await page.waitForTimeout(300); };
  const openRow = async (tid) => { const row = page.locator('[data-testid="' + tid + '"]').first(); await row.locator('[data-cbl-next],button[aria-label*="Open"],.cbl-exp,.cbl-next').first().click({ timeout: 5000 }).catch(async () => { await row.click(); }); await page.waitForTimeout(250); };
  if (REAL) {
    await page.goto(base + '/crm.html#/groups'); await page.waitForTimeout(800);
    await api.signIn(page, { surface: 'crm' }).catch(() => {});
  }

  /* ── 1 · GROUPS & SEGMENTS ── */
  await groups();
  await w.step('G1', 'CB CRM -> Groups: the four segments and the named groups, each with the SERVER\'s member count and its rule in words; the menu marks Groups', async () => {
    const want = segments(), got = {};
    for (const s of want.segments.concat(want.groups)) got[s.key] = await txt('[data-testid="crm-grp-count-' + s.key.replace(/[^A-Za-z0-9_-]/g, '_') + '"]');
    const okCounts = want.segments.concat(want.groups).every((s) => got[s.key] === String(s.count));
    const kinds = await txt('[data-testid="crm-grp-name-regular"]'), active = await page.locator('[data-testid="crm-nav-groups"][aria-current="page"]').count();
    const reads = S.calls.filter((c) => /GET \/api\/crm\/segments/.test(c)).length;
    return { ok: okCounts && /Regular/.test(kinds) && /Segment/.test(kinds) && active === 1 && reads >= 1, saw: Object.keys(got).map((k) => k + '=' + got[k]).join(' ') + ' · reads ' + reads };
  });
  await w.step('G2', 'Groups -> ▸ Workshops: the mini-card names its member (a link to the record), says who may be sent offers, and the offers only for them', async () => {
    await openRow('crm-grp-group_Workshops');
    const mini = await txt('[data-testid="crm-grp-mini-group_Workshops"]'), link = await has('[data-testid="crm-grp-member-pid-0002"]'), may = await txt('[data-testid="crm-grp-may-group_Workshops"]');
    return { ok: link && /Chola Auto Care/.test(mini) && /1 may be sent offers/.test(may) && /Offers only for them\s*1/.test(mini), saw: mini.slice(0, 160) };
  });
  await w.step('G3', 'Groups -> + New group "VIP" -> tick two customers -> Save: ONE POST { name, add[2] }, the toast says the members, the row appears with the server\'s count', async () => {
    await page.click('[data-testid="crm-grp-new"]'); await page.waitForSelector('[data-testid="crm-grp-sheet"]', { timeout: 5000 });
    await page.fill('#crm_grp_name', 'VIP');
    await page.click('[data-testid="crm-grp-cand-pid-0002"] input'); await page.click('[data-testid="crm-grp-cand-pid-0006"] input');
    const n = await txt('[data-testid="crm-grp-n"]');
    await page.click('[data-testid="crm-grp-save"]'); await page.waitForSelector('[data-testid="crm-grp-count-group_VIP"]', { timeout: 10000 }); await page.waitForTimeout(300);
    const b = posts(/POST \/api\/crm\/groups$/), body = b.length ? b[b.length - 1].body : {}, count = await txt('[data-testid="crm-grp-count-group_VIP"]'), toast = await txt('#toast');
    return { ok: b.length === 1 && body.name === 'VIP' && (body.add || []).length === 2 && count === '2' && /VIP: 2 members/.test(toast) && /2 members/.test(n), saw: b.length + ' POST ' + JSON.stringify(body) + ' · row count ' + count + ' · toast "' + toast + '"' };
  });
  await w.step('G4', 'VIP -> Send offer message -> Who may be sent?: the SERVER\'s dry answer by code (1 may · 1 not — no consent yet); Send -> the one sender\'s outcome per member, in words', async () => {
    await openRow('crm-grp-group_VIP');
    await page.locator('[data-testid="crm-grp-send"]').first().click(); await page.waitForSelector('[data-testid="crm-send-sheet"]', { timeout: 5000 });
    await page.fill('#crm_send_text', 'Diwali offer: 10% off this week');
    const goBefore = await page.locator('[data-testid="crm-send-go"]').isDisabled();
    await page.click('[data-testid="crm-send-check"]'); await page.waitForSelector('[data-testid="crm-send-may"]', { timeout: 8000 });
    const who = await txt('[data-testid="crm-send-who"]'), dry = posts(/\/send$/).filter((b) => b.body && b.body.dry).length, goLabel = await txt('[data-testid="crm-send-go"]');
    await page.click('[data-testid="crm-send-go"]'); await page.waitForSelector('[data-testid="crm-send-done"]', { timeout: 8000 });
    const done = await txt('[data-testid="crm-send-done"]'), lines = await txt('[data-testid="crm-send-lines"]'), real = posts(/\/send$/).filter((b) => b.body && !b.body.dry);
    const ok = goBefore && dry === 1 && /1 may be sent offers/.test(who) && /1 not — 1 no consent yet/.test(who) && /Big Buyer/.test(who) && goLabel === 'Send to 1' && real.length === 1 && real[0].body.text === 'Diwali offer: 10% off this week' && /0 sent · 1 refused/.test(done) && /WHATSAPP_TOKEN/.test(lines);
    return { ok, saw: 'check: "' + who.slice(0, 90) + '" · button "' + goLabel + '" · outcome "' + done + '" · ' + lines.slice(0, 80) };
  });
  await w.step('G5', 'VIP -> Delete group: asks first, then ONE DELETE; the row is gone and the Parties list no longer carries the name', async () => {
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.locator('[data-testid="crm-grp-delete"]').first().click(); await page.waitForSelector('[data-testid="confirm"]', { timeout: 5000 });
    const ask = await txt('[data-testid="confirm"]');
    await page.locator('[data-testid="confirm"] button').filter({ hasText: /^Delete/ }).first().click(); await page.waitForTimeout(800);
    const gone = !(await has('[data-testid="crm-grp-count-group_VIP"]')), dels = S.calls.filter((c) => /DELETE \/api\/crm\/groups\/VIP/.test(c)).length;
    return { ok: /Delete group VIP\?/.test(ask) && /name goes/.test(ask) && gone && dels === 1, saw: '"' + ask.slice(0, 80) + '" · DELETE ×' + dels + ' · row gone ' + gone };
  });
  await w.step('G6', 'Workshops -> Delete group: the confirm names the offer that is only for it ("will reach no one") — Keep', async () => {
    await openRow('crm-grp-group_Workshops');
    await page.locator('[data-testid="crm-grp-delete"]').first().click(); await page.waitForSelector('[data-testid="confirm"]', { timeout: 5000 });
    const ask = await txt('[data-testid="confirm"]');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200); const dels = S.calls.filter((c) => /DELETE \/api\/crm\/groups\/Workshops/.test(c)).length;
    return { ok: /1 offer is only for this group/.test(ask) && /reach no one/.test(ask) && /Delete anyway/.test(ask) && dels === 0, saw: '"' + ask.slice(0, 120) + '" · DELETE ×' + dels };
  });
  await w.step('G7', 'Groups -> See all in Parties: the Parties list opens filtered to the group (its rows are the members)', async () => {
    await page.locator('[data-testid="crm-grp-open"]').first().click(); await page.waitForTimeout(700);
    const rows = await page.locator('[data-testid^="crm-row-"]').count(), url = page.url();
    return { ok: /#\/parties\?group=Workshops/.test(url) && rows === 1, saw: url.replace(base, '') + ' · ' + rows + ' row(s)' };
  });
  await w.step('G8', 'Consent records not set up (b306 not run): the notice says so in words; nobody may be sent offers', async () => {
    S.consentOff = true; await groups();
    const notice = await txt('[data-testid="crm-grp-noconsent"]'), may = await txt('[data-testid="crm-grp-reach-regular"]'); S.consentOff = false;
    return { ok: /Consent records are not set up yet/.test(notice) && may === '0', saw: '"' + notice + '" · regular may=' + may };
  });
  await w.step('G9', 'A view-only login -> Groups: + New group, Send and Delete are SHOWN, greyed, each with the server\'s sentence; never hidden', async () => {
    S.level = 'viewer'; await ctx.addInitScript((s) => { try { localStorage.setItem('cb_sess', s); } catch (_) {} }, VIEWER); await page.evaluate((s) => localStorage.setItem('cb_sess', s), VIEWER);
    await groups();
    const newBtn = page.locator('[data-testid="crm-grp-new"]'), newOff = await newBtn.isDisabled(), newWhy = await txt('[data-testid="crm-grp-new-why"]');
    await openRow('crm-grp-group_Workshops');
    const sendOff = await page.locator('[data-testid="crm-grp-send"]').first().isDisabled(), delOff = await page.locator('[data-testid="crm-grp-delete"]').first().isDisabled();
    const sendWhy = await page.locator('[data-testid="crm-grp-send"]').first().getAttribute('title'), delWhy = await page.locator('[data-testid="crm-grp-delete"]').first().getAttribute('title');
    return { ok: newOff && /only view/.test(newWhy) && sendOff && /only view/.test(sendWhy || '') && delOff && /Only the owner deletes/.test(delWhy || ''), saw: 'New group: "' + newWhy + '" · Send: "' + sendWhy + '" · Delete: "' + delWhy + '"' };
  });
  S.level = 'owner'; await ctx.addInitScript((s) => { try { localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop')); await page.evaluate((s) => localStorage.setItem('cb_sess', s), W.session('Fixture Owner', 'Fixture Shop'));

  /* ── 2 · THE RECORD'S REWARDS PANE ── */
  await w.step('R1', 'Record (Chola) -> Rewards: the fact is the record\'s own points; open -> the ENGINE\'s words: balance, worth, next, expiry, the last movements', async () => {
    await page.goto(base + '/crm.html#/party/pid-0002'); await page.waitForSelector('[data-testid="crm-sec-rewards"]', { timeout: 20000 });
    const fact = await txt('[data-testid="crm-sec-fact-rewards"]'), before = S.calls.filter((c) => /\/rewards$/.test(c)).length;
    await page.click('[data-testid="crm-sec-rewards"] summary'); await page.waitForSelector('[data-testid="rw-points"]', { timeout: 8000 });
    const pts = await txt('[data-testid="rw-points"]'), says = await txt('[data-testid="rw-says"]'), next = await txt('[data-testid="rw-next"]'), exp = await txt('[data-testid="rw-expires"]'), hist = await page.locator('[data-testid="rw-history"] .rw-e').count();
    const after = S.calls.filter((c) => /\/rewards$/.test(c)).length, pane = await txt('[data-testid="crm-rewards"]');
    return { ok: /1260 points/.test(fact) && before === 0 && after === 1 && pts === '1260' && /worth ₹630 off/.test(says) && /Free service wash/.test(next) && /240 points more/.test(next) && /12 months after/.test(exp) && hist === 3 && /the shop owes/.test(pane), saw: 'fact "' + fact + '" · ' + pts + ' · "' + says + '" · next "' + next + '" · ' + exp + ' · ' + hist + ' movements · read ×' + after };
  });
  await w.step('R2', 'Record (Big Buyer) -> Rewards: no programme -> the server\'s one plain line, never an empty box', async () => {
    await page.goto(base + '/crm.html#/party/pid-0006'); await page.waitForSelector('[data-testid="crm-sec-rewards"]', { timeout: 20000 });
    await page.click('[data-testid="crm-sec-rewards"] summary'); await page.waitForSelector('[data-testid="rw-none"]', { timeout: 8000 });
    const t = await txt('[data-testid="rw-none"]');
    return { ok: /does not run a points programme/.test(t), saw: '"' + t + '"' };
  });

  /* ── 3 · THE SHOP WINDOW ── */
  const showcase = async () => { await page.goto(base + '/crm.html#/showcase'); await page.waitForSelector('[data-testid="sc-picks"]', { timeout: 20000 }); await page.waitForTimeout(300); };
  await showcase();
  await w.step('S1', 'CB CRM -> Shop window: the templates as buttons, the current one lit; the preview is the shop\'s OWN page with ?showcase=<current>; pick another -> ONE PATCH, the lit one and the preview follow', async () => {
    const cur = await page.locator('[data-testid="sc-picks"]').getAttribute('data-current'), src0 = await page.locator('[data-testid="sc-preview"]').getAttribute('src');
    const lit0 = await page.locator('[data-sc-pick][aria-pressed="true"]').getAttribute('data-sc-pick');
    await page.click('[data-sc-pick="showcase.paint.specs@1.0"]'); await page.waitForTimeout(600);
    const b = posts(/PATCH \/api\/entities\/policy/), lit1 = await page.locator('[data-sc-pick][aria-pressed="true"]').getAttribute('data-sc-pick'), src1 = await page.locator('[data-testid="sc-preview"]').getAttribute('src'), toast = await txt('#toast');
    const ok = cur === 'showcase.food.menu@1.0' && lit0 === cur && /\/shop\.html\?s=CBWALK0001&preview=1&showcase=showcase\.food\.menu%401\.0/.test(src0 || '') && b.length === 1 && b[0].body.showcase_template === 'showcase.paint.specs@1.0' && lit1 === 'showcase.paint.specs@1.0' && /showcase\.paint\.specs/.test(src1 || '') && /saved/i.test(toast);
    return { ok, saw: 'current ' + cur + ' · src ' + (src0 || '').replace(base, '') + ' -> ' + (src1 || '').replace(base, '') + ' · PATCH ×' + b.length + ' · "' + toast + '"' };
  });
  await w.step('S2', 'Share with a party who has NOT agreed (Big Buyer): the verdict says Not now, Share on WhatsApp is greyed WITH the server\'s sentence', async () => {
    await page.fill('#crm_sc_q', 'Big'); await page.waitForSelector('[data-testid="crm-sc-pick-pid-0006"]', { timeout: 5000 }); await page.click('[data-testid="crm-sc-pick-pid-0006"]');
    await page.waitForSelector('[data-testid="crm-sc-verdict"]', { timeout: 8000 });
    const code = await page.locator('[data-testid="crm-sc-verdict"]').getAttribute('data-code'), chip = await txt('[data-testid="crm-sc-may"]'), off = await page.locator('[data-testid="crm-sc-share"]').isDisabled(), why = await txt('[data-testid="crm-sc-share-why"]');
    return { ok: code === 'NO_CONSENT' && /Not now/.test(chip) && off && /No consent for offers on whatsapp/.test(why), saw: code + ' · "' + chip + '" · greyed ' + off + ' · "' + why + '"' };
  });
  await w.step('S3', 'Share with a party who agreed (Chola): Share is lit -> the out message is LOGGED through the gated route (channel whatsapp · purpose marketing) and WhatsApp opens with the link', async () => {
    await page.fill('#crm_sc_q', 'Chola'); await page.waitForSelector('[data-testid="crm-sc-pick-pid-0002"]', { timeout: 5000 }); await page.click('[data-testid="crm-sc-pick-pid-0002"]');
    await page.waitForSelector('[data-testid="crm-sc-verdict"][data-code="CONSENT"]', { timeout: 8000 });
    const chip = await txt('[data-testid="crm-sc-may"]'), lit = !(await page.locator('[data-testid="crm-sc-share"]').isDisabled());
    await page.click('[data-testid="crm-sc-share"]'); await page.waitForTimeout(700);
    const logs = posts(/\/interactions$/), body = logs.length ? logs[logs.length - 1].body : {}, opened = await page.evaluate(() => window.__opened || []), toast = await txt('#toast');
    const ok = /agreed/.test(chip) && lit && logs.length === 1 && body.kind === 'message' && body.direction === 'out' && body.channel === 'whatsapp' && body.purpose === 'marketing' && /shop\.html%3Fs%3DCBWALK0001/.test(body.body || '') === false && /shop\.html\?s=CBWALK0001/.test(body.body || '') && opened.length === 1 && /wa\.me\/919443320877\?text=/.test(opened[0]) && /timeline/.test(toast);
    return { ok, saw: '"' + chip + '" · log ' + JSON.stringify(body).slice(0, 110) + ' · opened ' + (opened[0] || 'nothing').slice(0, 60) + ' · "' + toast + '"' };
  });
  await w.step('S4', 'Share with a group: the groups with their reach -> Workshops -> the Send sheet opens with the link already written', async () => {
    await page.click('[data-testid="crm-sc-group"]'); await page.waitForSelector('[data-testid="crm-sc-groups"]', { timeout: 8000 });
    const row = await txt('[data-testid="crm-sc-grp-group_Workshops"]');
    await page.click('[data-testid="crm-sc-grp-group_Workshops"]'); await page.waitForSelector('[data-testid="crm-send-sheet"]', { timeout: 5000 });
    const text = await page.inputValue('#crm_send_text');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    return { ok: /Workshops/.test(row) && /1 member · 1 may be sent offers/.test(row) && /shop\.html\?s=CBWALK0001/.test(text), saw: '"' + row + '" · text "' + text.slice(0, 70) + '"' };
  });

  /* ── 4 · RULE 13: Groups · the record · the Shop window, Cream and Dark, 1366 and 390 ── */
  await groups(); await openRow('crm-grp-group_Workshops');
  await rule13(w, 'T13G', 'Groups & segments (a row open)', 'crm_groups');
  await page.goto(base + '/crm.html#/party/pid-0002'); await page.waitForSelector('[data-testid="crm-sec-rewards"]', { timeout: 20000 }); await page.click('[data-testid="crm-sec-rewards"] summary'); await page.waitForSelector('[data-testid="rw-points"]', { timeout: 8000 });
  await rule13(w, 'T13R', 'the record with Rewards open', 'screen');
  await showcase();
  await rule13(w, 'T13S', 'the Shop window', 'screen');
  if (api) await api.stop().catch(() => {});
  if (w.errs.length) w.note('T99', 'page errors seen during the walk', w.errs.slice(0, 3).join(' | '));
  const [cOk, cMsg] = C.finish(); if (!cOk) w.results.push({ id: 'M43', path: 'every /api/crm answer the stand-in served matches the API contract', ok: false, saw: cMsg }); else w.note('M43', 'every /api/crm answer the stand-in served matches the API contract', cMsg);
};
walk.opts = { viewport: { width: 1366, height: 900 } };
W.run(REAL ? 'crm-marketing-real' : 'crm-marketing', walk);
