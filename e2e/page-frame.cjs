#!/usr/bin/env node
/* page-frame.cjs — H23/H24: Know your business and Authority forms wear the app's frame and use the ONE sign-in.
 * Proves (exit 1 on any failure): signed in → the shell header (shop, Home, avatar) is there, NO e-mail/code card is asked, the API is called
 * with the session's bearer; signed out → the one sign-in window is in the shell's slot (not the old "Business email · Send code" card), and
 * the old card's controls are gone from the page source; a 401 drops the session and shows the window.
 * Stand-in API inside the page (ctx.route); nothing reaches a live server. Run one at a time: sh C:/dev/toolset/e2e.sh <checkout> e2e/page-frame.cjs */
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const J = (r, status, o) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
const PAGES = [
  { id: 'kyb', file: '/know-your-business.html', api: '/api/kyb/yourself', body: { credentials: [], summary: {} } },
  { id: 'documents', file: '/authority-forms.html', api: '/api/forms', body: { forms: [] } },
];
(async () => {
  const out = { pass: 0, fail: 0 };
  const ok = (c, m) => { if (c) out.pass++; else out.fail++; console.log((c ? '  ok  ' : '  XX  ') + m); };
  for (const pg of PAGES) {
    const src = fs.readFileSync(path.join(ROOT, 'public', pg.file), 'utf8');
    ok(!/lg_email|Send code|doLogin/.test(src), pg.id + ' · static · the page has no sign-in form of its own');
    ok(/app\/page-frame\.js/.test(src) && /app\/shell\.js/.test(src) && /app\/signin-ui\.js/.test(src), pg.id + ' · static · it loads the shell and the one sign-in window');
  }
  const { chromium } = require('@playwright/test');
  const { serve } = require('./lib/serve.cjs');
  const web = await serve(), b = await chromium.launch();
  const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const TOKEN = b64({ alg: 'none' }) + '.' + b64({ identity_id: 'ent-pf', identity_type: 'entity', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.x';
  const SESSION = JSON.stringify({ token: TOKEN, role: 'entity', name: 'Mayur', entity: 'Mayur Bhavan', bridgeId: 'CBTEST1234' });
  try {
    for (const pg of PAGES) {
      for (const mode of ['in', 'out', '401']) {
        const seen = [], auth = [];
        const ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: 'block' });
        await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
        await ctx.route('**/api/**', (r) => {
          const u = new URL(r.request().url()); seen.push(u.pathname); auth.push(r.request().headers().authorization || '');
          if (u.pathname === pg.api) return mode === '401' ? J(r, 401, { error: 'expired' }) : J(r, 200, pg.body);
          return J(r, 404, { error: 'not found' });
        });
        await ctx.addInitScript(([s, m]) => { try { localStorage.setItem('cb_api_base', location.origin); if (m === 'out') localStorage.removeItem('cb_sess'); else if (!sessionStorage.getItem('__s')) { sessionStorage.setItem('__s', '1'); localStorage.setItem('cb_sess', s); } } catch (_) {} }, [SESSION, mode]);
        const p = await ctx.newPage(), errs = [];
        p.on('pageerror', (e) => errs.push(String(e.message)));
        await p.goto(web.url(pg.file + '?api=' + encodeURIComponent(web.url('')))); await p.waitForTimeout(1500);
        const has = async (sel) => (await p.locator(sel).count()) > 0;
        if (mode === 'in') {
          ok(await has('[data-testid="shell-header"]') && await has('[data-testid="shell-avatar"] [data-testid="cbavatar"]'), pg.id + ' · signed in · the shell header and the one avatar are there');
          ok(!(await has('#lg_email')) && !(await has('[data-testid="shell-signin"] input')), pg.id + ' · signed in · no e-mail / code asked');
          ok(seen.includes(pg.api) && auth[seen.indexOf(pg.api)] === 'Bearer ' + TOKEN, pg.id + ' · signed in · the page reads with the session the apps hold (' + pg.api + ')');
        } else if (mode === 'out') {
          ok(await has('[data-testid="shell-signin"] input') || await has('[data-testid="shell-signin"] [data-testid^="signin"]') || (await p.locator('.cbsh-signin').innerHTML()).length > 50, pg.id + ' · signed out · the one sign-in window is in the shell slot');
          ok(!(await has('#lg_email')), pg.id + ' · signed out · the old "Business email · Send code" card is gone');
          ok(!seen.includes(pg.api), pg.id + ' · signed out · nothing is read');
        } else {
          ok(!(await p.evaluate(() => localStorage.getItem('cb_sess'))) || (await p.locator('.cbsh-signin').innerHTML()).length > 50, pg.id + ' · a 401 drops the session and shows the sign-in window');
        }
        ok(errs.length === 0, pg.id + ' · ' + mode + ' · no script errors' + (errs.length ? ' — ' + errs[0] : ''));
        await ctx.close();
      }
    }
  } finally { await b.close(); web.srv.close(); }
  console.log('\n  page-frame: ' + out.pass + ' passed, ' + out.fail + ' failed');
  process.exit(out.fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
