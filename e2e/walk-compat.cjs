#!/usr/bin/env node
/**
 * e2e/walk-compat.cjs — WORKS WITH, WALKED (T3-COMPAT, 2026-10-14): Home's Compatibility door → the Standards page's Works with.
 * Works with is not a second list: it is the register's own Kind filter at Compatibility (public/standards.html), its rows the ONE file
 * public/data/compat.json mapped by stdCompatRows (app/cap-standards.js). The page reads no API; Home does (its facts).
 *   default   Home's API is a stand-in answering inside the page (nothing leaves the runner)
 *   --real    the local api (e2e/lib/real-stack.cjs: ../chitbridge-api/server.js on CB_REAL_DB, DEV_OTP) — a real owner signs in for Home
 *   C1  Home → the Compatibility card is BUILT (a card, not a coming chip) and opens /standards.html#works-with — never app.html
 *   C2  Works with: exactly the compat.json rows, the title says Works with, the Kind chip says Compatibility, the address keeps #works-with
 *   C3  each row: its direction symbol (in · out · both · side by side) as compat.json says; Tally · Zoho · Xero · CSV · Beckn are there;
 *       In force · Partly · Planned all honest (a row that is not In force says what is missing)
 *   C4  a row opened (Xero move-in): Moves · Code · Fit · Proof (the test) · and Copy carries them
 *   C5  every code file and test a row names exists in the api checkout beside this one
 *   C6  clearing Kind (the matrix's All) leaves Works with (title Standards, no #works-with); the matrix's Works with button brings it back
 *   C7  compat.json unreadable with Works with open → the list SAYS it could not be read, with Try again (never "Nothing matches"); Try again reads it
 *   C8  phone 390: the Home card lands on the list (not the matrix), no sideways scroll
 *   R   rule 13, Works with with a row opened, Cream and Dark at 1366 and 390 (e2e/lib/rule13.cjs)
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-compat.cjs [--real] [--show]
 */
'use strict';
const fs = require('fs'), path = require('path');
const W = require('./lib/walk.cjs');
const REAL = process.argv.includes('--real');
const J = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const CJ = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'compat.json'), 'utf8')).rows;
const API_DIR = process.env.CB_API_DIR || path.join(__dirname, '..', '..', 'chitbridge-api');

const walk = async (w) => {
  const { page, ctx, base } = w;
  let stack = null, api = base;
  if (REAL) {
    const R = require('./lib/real-stack.cjs');
    stack = await R.up({ webBase: base }); api = stack.api;
    const owner = await R.signIn(api, 'simstores@test.example');
    await ctx.addInitScript((s) => { try { localStorage.setItem('cb_sess', s); } catch (_) {} }, owner.session);
  } else {
    await ctx.route('**/api/**', (r) => {
      const p = new URL(r.request().url()).pathname;
      if (p === '/api/facts/rail') return J(r, 200, { suppliers: 1, customers: 2, in: 3, out: 1, stuck: 0 });
      if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Fixture Shop', currency_code: 'INR' } });
      return J(r, 404, { error: 'not found' });
    });
    await ctx.addInitScript((s) => { try { localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));
  }
  await ctx.addInitScript((a) => { try { localStorage.setItem('cb_api_base', a); } catch (_) {} }, api);

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const home = async () => { await page.goto(base + '/'); await page.waitForSelector('[data-testid="shell-card-compatibility"]', { state: 'attached', timeout: 20000 }); };
  const ready = () => page.waitForFunction(() => document.querySelector('[data-testid="std-open-works"]') && document.querySelector('.cbl-count'), null, { timeout: 20000 });
  const shown = () => page.$$eval('[data-testid^="std-row-"]', (rs) => rs.map((r) => ({ t: r.innerText.replace(/\s+/g, ' ').trim(), dir: (r.querySelector('[data-testid="std-dir"]') || {}).dataset ? r.querySelector('[data-testid="std-dir"]') && r.querySelector('[data-testid="std-dir"]').dataset.dir : null })));

  await home();
  await w.step('C1', 'Home -> the Compatibility card is built and opens the Standards page at Works with, never the workshop', async () => {
    const href = await page.getAttribute('[data-testid="shell-card-compatibility"]', 'href'), chip = await page.locator('[data-testid="shell-chip-compatibility"]').count();
    await page.click('[data-testid="shell-card-compatibility"]'); await page.waitForURL(/standards\.html#works-with/, { timeout: 15000 }); await ready();
    return { ok: href === '/standards.html#works-with' && chip === 0 && !/app\.html/.test(href), saw: 'card ' + href + ' · coming chip ' + chip + ' · now at ' + page.url().replace(base, '') };
  });
  await page.waitForTimeout(300);
  await w.step('C2', 'Works with -> exactly the ' + CJ.length + ' rows of compat.json, titled Works with, the Kind chip Compatibility, #works-with kept', async () => {
    const rows = await shown(), title = await txt('.cbl-title'), chips = await txt('.cbl-fchips'), cnt = await txt('.cbl-count');
    const pressed = await page.getAttribute('[data-testid="std-open-works"]', 'aria-pressed');
    return { ok: rows.length === CJ.length && /Works with/.test(title) && /Compatibility/.test(chips) && /#works-with$/.test(page.url()) && pressed === 'true',
      saw: rows.length + ' rows · title "' + title.slice(0, 30) + '" · chips "' + chips + '" · ' + cnt + ' · button pressed ' + pressed };
  });
  await w.step('C3', 'each row shows which way it moves (as compat.json says); Tally · Zoho · Xero · CSV · Beckn listed; In force · Partly · Planned honest', async () => {
    const rows = await shown(), all = rows.map((r) => r.t).join(' | ');
    const dirs = rows.map((r) => r.dir).sort().join(), want = CJ.map((x) => x.dir).sort().join();
    const names = ['Tally', 'Zoho', 'Xero', 'spreadsheet', 'open-network'].filter((n) => all.indexOf(n) < 0);
    const st = ['In force', 'Partly', 'Planned'].filter((s) => all.indexOf(s) < 0);
    const honest = rows.every((r) => /In force/.test(r.t) || / — \S/.test(r.t));
    return { ok: dirs === want && !names.length && !st.length && honest, saw: 'directions ' + (dirs === want ? 'match the file' : dirs + ' vs ' + want) + ' · missing names ' + (names.join() || 'none') + ' · missing statuses ' + (st.join() || 'none') + ' · every not-in-force row says what is missing ' + honest };
  });
  await w.step('C4', 'open the Xero move-in row -> Moves (In, from Xero) · Code · Fit · Proof naming its test; Copy carries Moves and Code', async () => {
    await page.locator('[data-testid^="std-row-"]', { hasText: 'Xero chart' }).first().click(); await page.waitForTimeout(250);
    const d = await txt('[data-testid^="std-detail-"]');
    await page.evaluate(() => { window.__copied = ''; navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
    await page.locator('[data-testid="std-copy"]').first().click(); await page.waitForTimeout(200);
    const copied = await page.evaluate(() => window.__copied || '');
    return { ok: /MOVES.*⇣ In: From Xero into ChitBridge/i.test(d) && /CODE.*lib\/move-in\.js/i.test(d) && /FIT/i.test(d) && /PROOF.*move-in\.test\.cjs/i.test(d) && /Moves: In/.test(copied) && /Code: chitbridge-api lib\/move-in\.js/.test(copied),
      saw: d.slice(0, 200) + ' · copy ' + (copied ? copied.split('\n').filter((l) => /^(Moves|Code)/.test(l)).join(' / ') : 'nothing') };
  });
  await w.step('C5', 'every code file and test a compat.json row names exists in the api checkout (' + path.basename(API_DIR) + ')', async () => {
    if (!fs.existsSync(API_DIR)) return { ok: true, saw: 'no api checkout beside this one — not checked' };
    /* a file named in `code` or `proof_ref` is found at its path, or under tests/ · lib/ · tools/tally-connector/ (the folder the sentence named first) */
    const missing = [], AT = ['', 'tests', 'lib', 'tools/tally-connector'];
    CJ.forEach((x) => ((x.code || '') + ' ' + (x.proof_ref || '')).replace(/\btools\/tally-connector\b/g, '').match(/[\w./-]+\.c?js\b/g)?.forEach((f) => {
      if (!AT.some((d) => fs.existsSync(path.join(API_DIR, d, f)))) missing.push(x.id + ': ' + f);
    }));
    return { ok: !missing.length, saw: missing.length ? 'missing ' + missing.join(' · ') : 'every named file is there' };
  });
  await w.step('C6', 'the matrix\'s All clears Kind -> Works with ends (title Standards, no #works-with); the Works with button brings it back', async () => {
    await page.click('[data-testid="std-mx-row-*"]'); await page.waitForTimeout(300);
    const t1 = await txt('.cbl-title'), u1 = page.url(), n1 = (await shown()).length;
    await page.click('[data-testid="std-open-works"]'); await page.waitForTimeout(300);
    const t2 = await txt('.cbl-title'), u2 = page.url(), n2 = (await shown()).length;
    return { ok: /^Standards/.test(t1) && !/#works-with/.test(u1) && n1 > CJ.length && /^Works with/.test(t2) && /#works-with$/.test(u2) && n2 === CJ.length,
      saw: 'All -> "' + t1.slice(0, 20) + '" ' + n1 + ' rows ' + u1.replace(base, '') + ' · button -> "' + t2.slice(0, 20) + '" ' + n2 + ' rows ' + u2.replace(base, '') };
  });
  await w.step('C7', 'compat.json unreadable at #works-with -> "could not be read" with Try again, never "Nothing matches"; Try again reads it', async () => {
    const fail = (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'no' });
    await page.route('**/data/compat.json', fail);
    await page.goto('about:blank'); await page.goto(base + '/standards.html#works-with'); await ready(); await page.waitForTimeout(300);   /* a hash-only goto would not reload */
    const err = await txt('[data-testid="cbl-error-standards"]'), nomatch = await page.locator('[data-testid="cbl-nomatch-standards"]').count();
    await page.unroute('**/data/compat.json', fail);
    await page.click('[data-testid="cbl-error-standards"] [data-cbl-retry]'); await page.waitForTimeout(600);
    const after = (await shown()).length;
    return { ok: /could not be read/.test(err) && /Try again/.test(err) && nomatch === 0 && after === CJ.length, saw: '"' + err + '" · nothing-matches ' + nomatch + ' · after Try again ' + after + ' rows' };
  });
  await w.step('C8', 'phone 390: Home card -> the Works with list (not the matrix), no sideways scroll', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await home();
    await page.$eval('[data-testid="shell-card-compatibility"]', (a) => a.click());   /* on a phone the Setup area is its own page; the card is the same link */ await page.waitForURL(/standards\.html#works-with/, { timeout: 15000 }); await ready(); await page.waitForTimeout(300);
    const view = await page.getAttribute('#app', 'data-view'), h = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), n = (await shown()).length;
    await page.setViewportSize({ width: 1366, height: 900 });
    return { ok: view === 'list' && !h && n === CJ.length, saw: 'view ' + view + ' · ' + n + ' rows · sideways scroll ' + h };
  });
  await page.goto(base + '/standards.html#works-with'); await ready(); await page.waitForTimeout(300);
  await page.locator('[data-testid^="std-row-"]', { hasText: 'Xero chart' }).first().click(); await page.waitForTimeout(250);
  await require('./lib/rule13.cjs').rule13(w, 'R', 'Works with, a row opened', 'std_list');
  if (w.errs.length) w.note('C99', 'page errors seen during the walk', w.errs.slice(0, 3).join(' | '));
  if (stack) stack.stop();
};
walk.opts = { viewport: { width: 1366, height: 900 } };
W.run('compat', walk);
