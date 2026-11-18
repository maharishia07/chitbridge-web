'use strict';
// @type: system
/**
 * e2e/walk-staff-books.cjs - STAFF-BOOKS (18 Nov 2026): a staff seat in the books after SEC-161 / BOOKS-GATE. MOCKED: the shared stand-in api (e2e/lib/standin.cjs) answers inside the page;
 * for the staff seat the money reads (trial balance, P&L, balance sheet, year status) answer the api's own refusal (403 OWNER_ONLY, the Problem body of routes/books.js moneyReader)
 * and GET /periods answers the months with NO figures (the api's periodsReader). Nothing reaches a live site.
 * OWNS      the proof that: a staff seat's Day book opens and the period list it reads answers (no refusal) · Trial balance, P&L, Balance sheet and Year close say the SERVER's sentence in the one
 *           empty/refused state (emptyState), never a raw error, never a blank pane · Month lock opens for staff with a dash where the owner sees sales · the owner's screens are unchanged (no refusal
 *           state, the figures draw) · both seats at 1366 and 390 px, light and dark: AA contrast, no clipping, no sideways scroll, nothing over a control (lib/rule13.cjs audit + lib/theme-measure.cjs).
 * RUN       on a SIT box in the Playwright image:  NODE_PATH=/pw/node_modules node e2e/walk-staff-books.cjs      (OUT=<dir> for the screenshots)
 * CARD      16-finance/cb-finance (books) · flow R2R step 1 (read the books)
 */
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const { standIn, route } = require('./lib/standin.cjs');
const books = require('./lib/books-api.cjs');
const { measure } = require('./lib/theme-measure.cjs');
const { audit } = require('./lib/rule13.cjs');
const C = require('./lib/contract.cjs'); /* every answer this walk serves for a contract route is held to docs/contracts/web-api.json (e2e/fixtures/web-api.contract.json) */

const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public'), OUT = process.env.OUT || path.join(__dirname, 'shots');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const SEATS = {
  owner: { token: b64({ alg: 'none' }) + '.' + b64({ identity_id: 'ent-M', identity_type: 'entity' }), role: 'entity', name: 'Mayur', entity: 'Mayur Bhavan' },
  staff: { token: b64({ alg: 'none' }) + '.' + b64({ identity_id: 'act-S', identity_type: 'actor', parent_entity_id: 'ent-M' }), role: 'actor', name: 'Sita', entity: 'Mayur Bhavan' }
};
/** the api's sentence (routes/books.js READ_MONEY_WORDS) and its Problem body (code OWNER_ONLY, the legacy keys beside it) */
const WORDS = "Only the owner or the shop's auditor may read these figures.";
const refusal = { type: 'about:blank', title: 'Forbidden', status: 403, code: 'OWNER_ONLY', detail: WORDS, error: WORDS, message: WORDS, may: false, why: WORDS };
const monthRows = (withFigures) => [4, 5, 6].map((m) => {
  const row = books.periodRow('2026-27', m - 3, m === 4 ? 'soft_locked' : 'open');
  row.start_date = '2026-0' + m + '-01'; row.end_date = '2026-0' + m + '-28'; row.entries = m * 3; row.sales_minor = withFigures ? m * 100000 : undefined;
  if (!withFigures) delete row.sales_minor;
  return row;
});
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  XX  ' + m); } };
/** the views: nav id, what the owner draws (a figure), what the staff seat says */
const VIEWS = [['tb', 'Trial balance'], ['pl', 'P&L'], ['bs', 'Balance sheet'], ['yearclose', 'Year close']];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const f = rel === 'index.html' ? path.join(ROOT, 'index.html') : path.join(PUB, rel);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port, browser = await chromium.launch();
  for (const seat of ['staff', 'owner']) {
    for (const [width, height] of [[1366, 768], [390, 844]]) {
      for (const theme of ['cream', 'dark']) {
        const tag = seat + ' @' + width + ' ' + theme;
        console.log('— ' + tag);
        const ctx = await browser.newContext({ viewport: { width, height }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
        await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
        const S = standIn();
        await ctx.route('**/api/**', (r) => route(S, r));
        const periodCalls = [];
        await ctx.route(/\/api\/books\/(periods|trial-balance|pl|bs|year\/[^/]+\/status)(\?|$)/, (r) => {
          const url = new URL(r.request().url());
          if (url.pathname === '/api/books/periods') {
            periodCalls.push(seat);
            return C.json(r, 200, books.periods(monthRows(seat === 'owner')));
          }
          if (seat === 'staff') return r.fulfill({ status: 403, contentType: 'application/problem+json', body: JSON.stringify(refusal) });
          return r.fallback();
        });
        await ctx.addInitScript((s, th) => { try { localStorage.setItem('cb_sess', JSON.stringify(s)); localStorage.setItem('cb_theme', th); } catch (_) {} }, SEATS[seat], theme);
        const page = await ctx.newPage(), threw = [];
        page.on('pageerror', (e) => threw.push(e.message));
        await page.goto(base + '/accounts.html#daybook').catch(() => {});
        await page.waitForSelector('#nav .nav-btn', { timeout: 8000 }).catch(() => {});
        await page.evaluate((t) => { if (window.CBAvatar && CBAvatar.applyTheme) CBAvatar.applyTheme(t); }, theme).catch(() => {});
        await page.waitForTimeout(900);
        /* the Day book, then each money view */
        const dayText = await page.evaluate(() => (document.getElementById('screen') || document.body).innerText);
        ok(!/Could not be read|API 403|Forbidden|OWNER_ONLY/.test(dayText), tag + ': the Day book opens with no refusal or raw error');
        await shot(page, 'daybook', tag);
        for (const [id, name] of VIEWS) {
          const button = page.locator('[data-testid="acc-nav-' + id + '"]');
          if (!(await button.count())) { ok(false, tag + ': ' + name + ' is in the menu'); continue; }
          await button.first().click().catch(() => {});
          await page.waitForTimeout(900);
          const state = await page.evaluate(() => { const host = document.getElementById('screen') || document.body; const e = host.querySelector('.empty'); return { empty: e ? e.innerText : '', text: host.innerText, blank: host.innerText.trim().length < 20 }; });
          if (seat === 'staff') {
            ok(state.empty.indexOf(WORDS) >= 0, tag + ': ' + name + ' says the server\'s sentence in the one refused state');
            ok(!/API 403|Forbidden|OWNER_ONLY|\bundefined\b|\bnull\b|TypeError/.test(state.text) && !state.blank, tag + ': ' + name + ' shows no raw error and is not blank');
          } else {
            ok(state.empty.indexOf(WORDS) < 0 && !state.blank, tag + ': ' + name + ' draws for the owner, no refusal state');
          }
          await shot(page, id, tag);
        }
        /* Month lock: open for both; the staff seat has no figures */
        await page.locator('[data-testid="acc-nav-lock"]').first().click().catch(() => {});
        await page.waitForTimeout(900);
        const lock = await page.evaluate(() => { const host = document.getElementById('screen') || document.body; return { rows: host.querySelectorAll('[data-testid="lk_rows"] tr').length, sales: Array.from(host.querySelectorAll('.lk-sales')).map((e) => e.innerText.trim()), text: host.innerText }; });
        ok(lock.rows > 0 && !/Could not be read|OWNER_ONLY/.test(lock.text), tag + ': Month lock lists the months (' + lock.rows + ' rows)');
        ok(periodCalls.length > 0, tag + ': the period list is asked (' + periodCalls.length + ' read(s)) and answered 200 for this seat');
        const mocked = lock.sales.slice(0, 3); /* the three months the mock holds */
        if (seat === 'staff') ok(mocked.length === 3 && mocked.every((x) => x === '—'), tag + ': Month lock shows a dash for sales, never "No sales" (' + mocked.join(',') + ')');
        else ok(mocked.length === 3 && mocked.every((x) => x !== '—' && x !== 'No sales'), tag + ': Month lock shows the owner\'s sales (' + lock.sales.join(',') + ')');
        /* rule 13: contrast, clipping, sideways scroll, nothing over a control */
        const pairs = await page.evaluate(measure), bad = pairs.filter((x) => !x.grad && x.ratio < x.need), a = await audit(page, 'screen');
        ok(!bad.length, tag + ': AA contrast of every text (' + pairs.length + ' measured)' + (bad.length ? ' - ' + bad.slice(0, 3).map((x) => x.ratio + ' "' + x.text + '"').join(' | ') : ''));
        ok(!a.clip.length && !a.scroll.length && !a.cover.length && !a.app.length, tag + ': no clipped text, no sideways scroll, nothing over a control, no app.html link');
        ok(!threw.length, tag + ': no page error' + (threw.length ? ' - ' + threw[0] : ''));
        await ctx.close();
      }
    }
  }
  /* the months answer this walk serves (the owner's and the staff seat's) is held to the contract; the stand-in's own baseline answers are held by e2e/contract.cjs */
  const badMonths = C.STATE.bad.filter((b) => /periods/.test(b.where));
  ok(badMonths.length === 0, 'the months answer of both seats has the keys, nesting and types the API sends' + (badMonths.length ? ' - ' + badMonths[0].problems.slice(0, 3).join('; ') : ''));
  await browser.close(); srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
async function shot(page, name, tag) { await page.screenshot({ path: path.join(OUT, 'staffbooks-' + tag.replace(/[^a-z0-9]+/gi, '-') + '-' + name + '.png') }).catch(() => {}); }
