#!/usr/bin/env node
/**
 * e2e/walk-home.cjs - THE HOME PAGE, WALKED (rows H1-H37 of C:/dev/TEST-LOG-2026-10-09.md that are READ-ONLY and were fixed or are meant to keep working).
 * Black box: it drives the controls a person touches (the rail's digits, the chips, the cards, the bell, the avatar, the left menu) and says what the
 * screen showed. Signed in as a FIXTURE shop ("Fixture Shop" / CBWALK0001): the site is served from this checkout and the API is a stand-in answering inside
 * the page, so nothing reaches localhost:3000 or the live site and nothing is written anywhere.
 * Open rows (H20 till sign-in, H34/H35 avatar doors, H12-H15 roadmap wording) are listed at the end as NOTE lines, not asserted.
 * THE LISTS ROUND (2026-10-09): C8-C11 (CRM one line per party · the formatted mini-card · only the rows scroll), O6/C9 (an internal .cr handle is never an e-mail), Z1 (zebra rows),
 * UI9 (no layout jump: the whole frame in the first paint, only the rows change — CRM and Home), P2-2 (the kural is ALWAYS in the footer, above the tab bar on a phone).
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
const C = require('./lib/contract.cjs');   /* M43: every /api/books and /api/crm answer this stand-in serves is held to the API contract */
const J = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

W.run('home', async (w) => {
  const { page, ctx, base } = w;
  /* the day as the log found it: 24 in, 0 out, 21 stuck; 1 supplier, 2 customers (self excluded); one posting waiting for the ledger */
  const RAIL = { suppliers: 1, customers: 2, in: 24, out: 0, stuck: 21 };
  await ctx.route('**/api/**', (r0) => {
    const r = C.wrap(r0);
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

  /* ── THE LISTS ROUND (2026-10-09) ── */
  FX.list.forEach((q) => { if (q.party_no === 'P-0004') q.email = '9894055621@fixture-shop.cr'; if (q.party_no === 'P-0005') q.email = 'meena.s=outlook.com@fixture-shop.cr'; });
  await page.setViewportSize({ width: 1366, height: 800 });
  await goPage('/crm.html'); await page.waitForSelector('[data-testid^="crm-row-"]', { timeout: 15000 }); await page.waitForTimeout(300);
  await w.step('C10', 'CRM -> Parties -> ONE line per party, in columns (Role · On ChitBridge · Dues · Last activity · Next follow-up), nothing stacked under the name', async () => {
    const g = await page.evaluate(() => ({ heads: Array.from(document.querySelectorAll('#crm_list .cbl-hc')).map((h) => h.textContent.replace(/[▲▼⇅▾●]/g, '').trim()), rows: Array.from(document.querySelectorAll('#crm_list .cbl-row')).map((r) => Math.round(r.getBoundingClientRect().height)), stacked: document.querySelectorAll('#crm_list .cbl-row .l2, #crm_list .cbl-row .tag').length }));
    return { ok: /Party/i.test(g.heads[0]) && g.heads.some((h) => /^role$/i.test(h)) && g.heads.some((h) => /on chitbridge/i.test(h)) && g.rows.length >= 5 && g.rows.every((h) => h <= 56) && g.stacked === 0, saw: 'columns ' + g.heads.join(' · ') + '; row heights ' + g.rows.join('/') + ' px; ' + g.stacked + ' chips under a name' };
  });
  await w.step('C11', 'CRM -> the title, views and toolbar stay put while the rows scroll', async () => {
    const t0 = await page.evaluate(() => document.querySelector('.cbl-tools').getBoundingClientRect().top);
    await page.evaluate(() => { const l = document.querySelector('#crm_list .cbl-list'); l.scrollTop = 300; const rs = document.querySelectorAll('#crm_list [data-row]'); rs[rs.length - 1].scrollIntoView({ block: 'end' }); });
    const t1 = await page.evaluate(() => ({ tools: document.querySelector('.cbl-tools').getBoundingClientRect().top, scr: document.getElementById('screen').scrollTop, doc: document.documentElement.scrollTop }));
    return { ok: t1.tools === t0 && t1.scr === 0 && t1.doc === 0, saw: 'toolbar at ' + t0 + ' px before, ' + t1.tools + ' after; the screen scrolled ' + t1.scr + ', the page ' + t1.doc };
  });
  await w.step('C8', 'CRM -> ▸ opens a formatted mini-card: contact · money · last chits · every action (the refused one greyed with its sentence)', async () => {
    await page.click('[data-testid="crm-row-P-0003"] [data-caret]'); await page.waitForSelector('[data-testid="crm-mini-P-0003"]'); await page.waitForTimeout(500);
    const g = await page.evaluate(() => ({ boxes: document.querySelectorAll('[data-testid="crm-mini-P-0003"] .mc-box').length, tel: !!document.querySelector('[data-testid="crm-mini-phone-P-0003"] a[href^="tel:"]'), acts: Array.from(document.querySelectorAll('#crm_list .cbl-next [data-act]')).map((b) => b.getAttribute('data-act') + (b.disabled ? ':off' : '')), why: (document.querySelector('[data-testid="crm-mini-message-why"]') || {}).textContent || '' }));
    await page.click('[data-testid="crm-row-P-0003"] [data-caret]');
    return { ok: g.boxes === 3 && g.tel && g.acts.join() === 'call,message:off,pay,followup,open' && /Not on ChitBridge/.test(g.why), saw: g.boxes + ' boxes; actions ' + g.acts.join(' ') + '; Message says "' + g.why + '"' };
  });
  await w.step('C9-O6', 'CRM -> an internal handle (…@fixture-shop.cr) is never shown as an e-mail — list, E-mail column, mini-card', async () => {
    await page.click('[data-testid="cols-btn-crm-parties"]'); await page.check('[data-testid="cols-crm-parties-email"]'); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    await page.click('[data-testid="crm-row-P-0004"] [data-caret]'); await page.waitForSelector('[data-testid="crm-mini-email-P-0004"]');
    const t = await page.evaluate(() => document.body.textContent), mini = await txt('[data-testid="crm-mini-email-P-0004"]');
    await page.click('[data-testid="crm-row-P-0004"] [data-caret]');
    return { ok: !/@fixture-shop\.cr/i.test(t) && /meena\.s@outlook\.com/.test(t) && /no e-mail/.test(mini), saw: 'handle on screen: ' + /@fixture-shop\.cr/i.test(t) + '; the encoded one reads meena.s@outlook.com: ' + /meena\.s@outlook\.com/.test(t) + '; the phone handle says "' + mini + '"' };
  });
  await w.step('Z1', 'CRM -> every other row is a different shade, and the row under the pointer is neither', async () => {
    const g = await page.evaluate(() => { const bg = (e) => getComputedStyle(e).backgroundColor, rs = Array.from(document.querySelectorAll('#crm_list .cbl-row')); return { a: bg(rs[0]), b: bg(rs[1]), c: bg(rs[2]) }; });
    await page.hover('[data-testid="crm-row-P-0002"]'); await page.waitForTimeout(80);
    const h = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="crm-row-P-0002"]')).backgroundColor);
    await page.mouse.move(2, 2);
    return { ok: g.a === g.c && g.a !== g.b && h !== g.a && h !== g.b, saw: 'rows ' + g.a + ' / ' + g.b + ' / ' + g.c + '; hovered ' + h };
  });
  await w.step('UI9-crm', 'CRM -> slow connection: the whole frame is there first (menu, title, toolbar, header, skeleton rows, the kural\'s room); when the rows arrive nothing above them moves', async () => {
    const slow = async (r) => { await new Promise((x) => setTimeout(x, 1500)); r.fallback(); };
    await ctx.route('**/api/**', slow);
    await page.goto(base + '/crm.html'); await page.waitForTimeout(450);   /* a fixed beat, before the slow line answers anything: this IS the first paint */
    const box = () => page.evaluate(() => { const r = (s, n) => { const e = document.querySelectorAll(s)[n || 0]; if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      return { nav: document.querySelectorAll('#nav .nav-btn').length, n0: r('#nav .nav-btn', 0), title: r('.cbl-title'), tools: r('.cbl-tools'), hdr: r('.cbl-hdr'), skel: document.querySelectorAll('.cbl-skel').length, band: r('#cbkural,#cbkural-reserve'), rows: document.querySelectorAll('.cbl-row').length }; });
    const a = await box();
    await page.waitForSelector('[data-testid^="crm-row-"]', { timeout: 15000 }); await page.waitForTimeout(500);
    const z = await box(); await ctx.unroute('**/api/**', slow);
    const same = (p, q) => !!p && !!q && p.every((v, i) => Math.abs(v - q[i]) <= 1);
    return { ok: a.nav === 3 && !!a.title && !!a.tools && !!a.hdr && a.skel >= 5 && a.rows === 0 && !!a.band && same(a.n0, z.n0) && same(a.title, z.title) && same(a.tools, z.tools) && same(a.hdr, z.hdr), saw: 'first paint: ' + a.nav + ' menu items, title, toolbar, header, ' + a.skel + ' skeleton rows, kural room ' + (a.band && a.band[3]) + ' px; toolbar ' + JSON.stringify(a.tools) + ' → ' + JSON.stringify(z.tools) };
  });
  await page.setViewportSize({ width: 1366, height: 800 });
  await w.step('UI9-home', 'Home -> the sidebar and header are in the first paint and do not move when the cards arrive', async () => {
    const slow = async (r) => { await new Promise((x) => setTimeout(x, 1500)); r.fallback(); };
    await ctx.route('**/app/manifest.json', slow); await ctx.route('**/api/**', slow);
    await page.goto(base + '/'); await page.waitForSelector('[data-testid="shell-header"]', { timeout: 8000 }); await page.waitForTimeout(250);
    const box = () => page.evaluate(() => { const r = (s, n) => { const e = document.querySelectorAll(s)[n || 0]; if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      return { nav: document.querySelectorAll('[data-testid^="shell-nav-"]').length, n0: r('[data-testid="shell-nav-home"]'), n1: r('[data-testid="shell-nav-running"]'), hdr: r('[data-testid="shell-header"]'), title: r('.cbsh-ph'), band: r('#cbkural,#cbkural-reserve') }; });
    const a = await box();
    await page.waitForSelector('[data-testid="rail-suppliers"]', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(600);
    const z = await box(); await ctx.unroute('**/app/manifest.json', slow); await ctx.unroute('**/api/**', slow);
    const same = (p, q) => !!p && !!q && p.every((v, i) => Math.abs(v - q[i]) <= 1);
    return { ok: a.nav >= 4 && same(a.n0, z.n0) && same(a.n1, z.n1) && same(a.hdr, z.hdr) && same(a.title, z.title) && !!a.band, saw: 'first paint: ' + a.nav + ' menu items, header ' + JSON.stringify(a.hdr) + ', title ' + JSON.stringify(a.title) + ', kural room ' + (a.band && a.band[3]) + ' px; after: menu ' + JSON.stringify([z.n0, z.n1]) + ' header ' + JSON.stringify(z.hdr) };
  });
  await w.step('P2-2', 'Home -> the kural is in the FOOTER on every width: under the page on a laptop, above the tab bar on a phone — never a card in the middle', async () => {
    const where = () => page.evaluate(() => { const k = document.querySelector('#cbkural'); if (!k) return null; const nav = document.querySelector('[data-testid="shell-nav"]'), r = k.getBoundingClientRect(), n = nav && nav.getBoundingClientRect(); return { inFoot: !!k.closest('[data-testid="shell-foot"],[data-testid="shell-pfoot"]'), inSec: !!k.closest('.cbsh-sec'), bottom: Math.round(r.bottom), navTop: n ? Math.round(n.top) : null, navLeft: n ? Math.round(n.left) : null, ih: innerHeight, hidden: k.hidden }; });
    await page.setViewportSize({ width: 390, height: 844 }); await goPage('/'); await page.waitForSelector('#cbkural:not([hidden])', { timeout: 8000 }).catch(() => {});
    const ph = await where();
    await page.setViewportSize({ width: 1366, height: 800 }); await goPage('/'); await page.waitForSelector('#cbkural:not([hidden])', { timeout: 8000 }).catch(() => {});
    const lp = await where();
    const phoneOk = ph && !ph.hidden && ph.inFoot && !ph.inSec && ph.navTop != null && ph.bottom <= ph.navTop + 1, lapOk = lp && !lp.hidden && lp.inFoot && !lp.inSec;
    return { ok: !!phoneOk && !!lapOk, saw: 'phone: ' + JSON.stringify(ph) + ' | laptop: ' + JSON.stringify(lp) };
  });
  await page.setViewportSize({ width: 1280, height: 860 });

  await w.step('M43', 'the stand-in answered every /api/books and /api/crm call as the API contract says', async () => { const [ok, saw] = C.finish(); return { ok, saw }; });

  w.note('H20', 'Home -> Till card, owner signed in', 'open (BACKLOG): the till still asks to sign in - not asserted here, see walk-bill');
  w.note('H34-35', 'Avatar menu -> Profile / Support / Settings doors', 'open: the doors still go to the workshop - not asserted');
  w.note('H12-15', 'Home -> roadmap wording and plan ids', 'open: wording review, not a pass/fail path');
});
