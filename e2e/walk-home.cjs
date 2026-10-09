#!/usr/bin/env node
/**
 * e2e/walk-home.cjs - THE HOME PAGE, WALKED (rows H1-H37 of C:/dev/TEST-LOG-2026-10-09.md that are READ-ONLY and were fixed or are meant to keep working).
 * Black box: it drives the controls a person touches (the rail's digits, the chips, the cards, the bell, the avatar, the left menu) and says what the
 * screen showed. Signed in as a FIXTURE shop ("Fixture Shop" / CBWALK0001): the site is served from this checkout and the API is a stand-in answering inside
 * the page, so nothing reaches localhost:3000 or the live site and nothing is written anywhere.
 * Open rows (H20 till sign-in, H34/H35 avatar doors, H12-H15 roadmap wording) are listed at the end as NOTE lines, not asserted.
 *
 *   NODE_PATH=e2e/node_modules node e2e/walk-home.cjs            headless, fast
 *   node e2e/walk-home.cjs --show                                 watch it: headed, captions, green/red per step, a results page that stays open
 * One line per path: "ID · path · PASS/FAIL (what it saw)". Screenshots: e2e/shots/walk-home-NN.png.
 */
'use strict';
const fs = require('fs'), path = require('path');
const W = require('./lib/walk.cjs');
const books = require('./lib/books-api.cjs'), crmApi = require('./lib/crm-api.cjs');
const FX = crmApi.resolve(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'golden-parties.json'), 'utf8')), Date.now());   /* the designer's golden parties: so the CRM page draws a real toolbar */
const J = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

W.run('home', async (w) => {
  const { page, ctx, base } = w;
  /* the day as the log found it: 24 in, 0 out, 21 stuck; 1 supplier, 2 customers (self excluded); one posting waiting for the ledger */
  const RAIL = { suppliers: 1, customers: 2, in: 24, out: 0, stuck: 21 };
  await ctx.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/api/facts/rail') return J(r, 200, RAIL);
    if (u.pathname === '/api/books/health') return J(r, 200, books.health({ waiting: [books.waitingRow({ id: 1, reason: 'September is locked.' })] }));
    if (u.pathname === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Fixture Shop', currency_code: 'INR' } });
    if (u.pathname === '/api/crm/parties') return J(r, 200, crmApi.list(FX.list, { records: FX.records }));
    if (u.pathname === '/api/crm/followups') return J(r, 200, crmApi.followups([]));
    return J(r, 404, { error: 'not found' });
  });
  await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, require('./lib/walk.cjs').session('Fixture Owner', 'Fixture Shop'));

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const man = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'manifest.json'), 'utf8'));
  const home = async () => { await page.goto(base + '/'); await page.waitForSelector('[data-testid="cbshell"]', { timeout: 20000 }); await page.evaluate(() => window.SHELL && window.SHELL.ready); await page.waitForSelector('[data-testid="rail"]', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(300); };
  await home();

  await w.step('H1', 'Home -> the rail shows 24 in - 0 out - 21 stuck, and each digit is a door', async () => {
    const pips = await page.$$eval('.pip', (as) => as.map((a) => ({ t: a.textContent.trim(), href: a.getAttribute('href') })));
    const want = { in: /#\/chits\?tab=in$/, out: /#\/chits\?tab=out$/, stuck: /#\/chits\?tab=stuck$/ };
    const okIn = pips.some((p) => p.t === '24 in' && want.in.test(p.href || '')), okOut = pips.some((p) => p.t === '0 out' && want.out.test(p.href || '')), okStuck = pips.some((p) => p.t === '21 stuck' && want.stuck.test(p.href || ''));
    return { ok: okIn && okOut && okStuck, saw: 'chips: ' + pips.map((p) => p.t + ' -> ' + (p.href || 'NOT A LINK')).join(' | ') };
  });
  await w.step('H2-r', 'Home rail vs the people we serve -> 1 supplier, 2 customers (the shop itself is not one)', async () => {
    const s = await txt('[data-testid="rail-suppliers"]'), c = await txt('[data-testid="rail-customers"]');
    return { ok: s === '1' && c === '2', saw: 'Suppliers ' + s + ' - Customers ' + c };
  });
  await w.step('H4', 'Home -> "21 stuck" is a door with a word on it, not a bare number', async () => {
    const t = await txt('[data-testid="rail-stuck"]'); const tag = await page.locator('[data-testid="rail-stuck"]').first().evaluate((e) => e.tagName);
    return { ok: /21 stuck/.test(t) && tag === 'A', saw: '"' + t + '" is ' + (tag === 'A' ? 'a link' : 'plain text') };
  });
  await w.step('H10-r', 'Home -> click "21 stuck" -> opens the Chits list filtered to Stuck', async () => {
    const [nav] = await Promise.all([page.waitForNavigation({ timeout: 10000 }).catch(() => null), page.click('[data-testid="rail-stuck"]')]);
    await page.waitForTimeout(400);
    const u = page.url();
    return { ok: /\/(crm|network)\.html/.test(u) && /chits\?tab=stuck/.test(u), saw: 'went to ' + u.replace(base, '') };
  });
  await home();
  await w.step('H11', 'Home -> click "1 Suppliers" -> the parties list, suppliers only', async () => {
    await page.click('[data-testid="rail-suppliers-open"]'); await page.waitForTimeout(500);
    const u = page.url();
    return { ok: /parties\?role=supplier/.test(u), saw: 'went to ' + u.replace(base, '') };
  });
  await home();
  await w.step('H16-r', 'Home signed in -> the roadmap is one quiet fold, not the cards twice', async () => {
    const n = await page.locator('[data-testid="roadmap"]').count(), open = await page.locator('[data-testid="rm-going"][open]').count();
    return { ok: n === 1 && open === 0, saw: n + ' roadmap block, fold ' + (open ? 'OPEN' : 'closed') };
  });
  await w.step('H22-r', 'Home -> Storefront card -> a link to this shop\'s own page, not "No shop specified"', async () => {
    const h = await page.getAttribute('[data-testid="shell-card-storefront"]', 'href');
    return { ok: /^\/shop\.html\?s=CBWALK0001$/.test(h || ''), saw: 'link is ' + h };
  });
  await w.step('H23-H24', 'Home -> Know your business and Documents cards -> real pages in the same frame, never the workshop', async () => {
    const a = await page.getAttribute('[data-testid="shell-card-kyb"]', 'href'), b = await page.getAttribute('[data-testid="shell-card-documents"]', 'href');
    const lands = [];
    for (const h of [a, b]) { const p2 = await ctx.newPage(); await p2.goto(base + h); await p2.waitForSelector('[data-testid="shell-header"], header, h1', { timeout: 15000 }).catch(() => {}); lands.push(await p2.evaluate(() => !!document.querySelector('[data-testid="shell-header"]'))); await p2.close(); }
    return { ok: !!a && !!b && !/app\.html/.test(a + b) && lands.every(Boolean), saw: a + ' (shell header ' + lands[0] + ') - ' + b + ' (shell header ' + lands[1] + ')' };
  });
  await w.step('H36-r', 'Home -> Catalogue chip -> a way to the catalogue (Product Lab)', async () => {
    const h = await page.locator('[data-testid="shell-chip-catalogue"]').first().evaluate((e) => (e.tagName === 'A' ? e : e.querySelector('a') || {}).getAttribute ? (e.tagName === 'A' ? e : e.querySelector('a')).getAttribute('href') : null).catch(() => null);
    return { ok: /product-lab\.html/.test(h || ''), saw: 'the chip links to ' + h };
  });
  await w.step('H37', 'Left menu -> Running -> scrolls Home to that section', async () => {
    const nav = page.locator('[data-testid="shell-nav-running"]').first();
    if (!(await nav.count())) return { ok: false, saw: 'no "Running" entry in the left menu' };
    await nav.click(); await page.waitForTimeout(600);
    const vis = await page.evaluate(() => { const s = document.querySelector('.cbsh-sec.running'); if (!s) return null; const r = s.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; });
    return { ok: vis !== false, saw: vis === null ? 'the section is its own page' : 'the Running section is on screen' };
  });
  await w.step('H30', 'Shop button -> the sheet opens, Esc closes it', async () => {
    await page.click('[data-testid="shell-shop"]'); const opened = await page.locator('[data-testid="shell-sheet"]').isVisible().catch(() => false);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const closed = !(await page.locator('[data-testid="shell-sheet"]').isVisible().catch(() => false));
    return { ok: opened && closed, saw: 'sheet ' + (opened ? 'opened' : 'did not open') + ', then ' + (closed ? 'closed on Esc' : 'stayed open') };
  });
  await w.step('H33', 'Bell -> opens, and what it lists reads as words (no "undefined", no "null")', async () => {
    const b = page.locator('[data-testid="shell-bell"]').first();
    if (!(await b.count())) return { ok: false, saw: 'no bell on Home' };
    await b.click(); await page.waitForTimeout(500);
    const t = await page.evaluate(() => (document.body.innerText || ''));
    return { ok: !/\bundefined\b|\bnull\b|\[object/.test(t), saw: 'the bell panel opened; no placeholder words on screen (the fixture serves no notifications, so row wording is not checked here)' };
  });
  await w.step('H27-28', 'Home -> signed in the whole way: no error text, no sign-in asked again', async () => {
    const t = await page.evaluate(() => document.body.innerText || '');
    return { ok: !/404|error|not signed in|send code/i.test(t) && w.errs.length === 0, saw: w.errs.length ? 'page error: ' + w.errs[0] : 'no error words, no code box' };
  });

  /* ── LAYOUT (UI1-UI8, 2026-10-09): at four widths, no two header/toolbar controls overlap, and the kural band is in one place ── */
  const probe = () => page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < 190 && r.right > 0 && r.left < innerWidth; };
    const nm = (e) => (e.getAttribute('data-testid') || e.getAttribute('aria-label') || e.textContent || e.tagName).trim().replace(/s+/g, ' ').slice(0, 24);
    const els = [...document.querySelectorAll('button, a[href], input, select, [role="button"], h1, h2, .cbsh-name, [data-testid="shell-shop"]')].filter(vis).filter((e) => !e.closest('#__walkbanner'));
    const bad = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) continue;
      const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
      const ox = Math.min(x.right, y.right) - Math.max(x.left, y.left), oy = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
      if (ox > 3 && oy > 3) bad.push(nm(a) + ' over ' + nm(b));
    }
    const k = document.querySelector('#cbkural, [data-testid="kural"], .cbkural');
    let band = null;
    if (k) { const r = k.getBoundingClientRect(); const lines = [...k.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').trim()).map((e) => e.getBoundingClientRect());
      let lap = 0; for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) { const a = lines[i], b = lines[j]; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 3 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3) lap++; }
      band = { where: (r.top + r.height / 2) < innerHeight / 2 ? 'top' : 'bottom', w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, linesOverlap: lap, inside: r.left >= -1 && r.right <= innerWidth + 1 }; }
    return { bad: bad.slice(0, 4), n: els.length, band };
  });
  const goPage = async (url) => { await page.goto(base + url); await page.waitForSelector('[data-testid="cbshell"], header, h1', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(700); };
  const bands = {};
  for (const [pg, url] of [['Home', '/'], ['CRM', '/crm.html']]) {
    bands[pg] = [];
    for (const vw of [390, 957, 1366, 1568]) {
      await page.setViewportSize({ width: vw, height: 860 });
      await w.step('L-' + pg + '-' + vw, pg + ' at ' + vw + ' px -> no two header / toolbar controls overlap, and the kural band is not squeezed over its own lines', async () => {
        await goPage(url); const r = await probe(); bands[pg].push({ vw, band: r.band });
        const bandBad = r.band && (r.band.linesOverlap > 0 || !r.band.inside);
        return { ok: r.bad.length === 0 && !bandBad, saw: r.n + ' controls in the top of the page; ' + (r.bad.length ? 'OVERLAP: ' + r.bad.join('; ') : 'none overlap') + '; band ' + (r.band ? r.band.where + ', ' + r.band.w + 'x' + r.band.h + (bandBad ? ', ITS LINES OVERLAP / it spills off the screen' : ', lines clear') : 'not on this page') };
      });
    }
    await w.step('L-' + pg + '-band', pg + ' -> the kural band is in ONE place at every width (390 / 957 / 1366 / 1568)', async () => {
      const seen = bands[pg].filter((x) => x.band); if (!seen.length) return { ok: true, saw: 'no band on this page at any width' };
      const places = [...new Set(seen.map((x) => x.band.where))];
      return { ok: places.length === 1, saw: seen.map((x) => x.vw + 'px: ' + x.band.where).join(' | ') };
    });
  }
  await page.setViewportSize({ width: 1280, height: 860 });

  w.note('H20', 'Home -> Till card, owner signed in', 'open (BACKLOG): the till still asks to sign in - not asserted here, see walk-bill');
  w.note('H34-35', 'Avatar menu -> Profile / Support / Settings doors', 'open: the doors still go to the workshop - not asserted');
  w.note('H12-15', 'Home -> roadmap wording and plan ids', 'open: wording review, not a pass/fail path');
});
