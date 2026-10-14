#!/usr/bin/env node
/**
 * e2e/walk-register.cjs — NEW SHOP? REGISTER, WALKED FROM A SMALL APP (FX-UX2 F5, 2026-10-14).
 * Black box: Home's sign-in window (and a CBFrame page's) → "New shop? Register" → CB Settings › New shop (settings.html#/new) → User ID ·
 * e-mail → the code · the gov panel · the agree gate (reg-agree) → Verify → HOME, signed in. Never app.html. The form is the workshop's
 * own (app/register-form.js) — R6 proves app.html #/register still paints the same controls (e2e/fixtures.js mintEntity drives those).
 *   default   the API is a stand-in answering inside the page (nothing leaves the runner)
 *   --real    the local api (e2e/lib/real-stack.cjs: ../chitbridge-api/server.js on CB_REAL_DB, DEV_OTP 123456) — a real shop is minted
 * Then RULE 13: the form and the code step, Cream and Dark, 1366 and 390 px — AA contrast (lib/theme-measure.cjs), no clipped text, no
 * inner sideways scroll, nothing floating over a control, no link to app.html, copy within the text budget (≤140 chars, ≤2 sentences).
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-register.cjs [--real] [--show]
 * One line per path: "ID · path · PASS/FAIL (what it saw)". Screenshots: e2e/shots/walk-register-NN.png.
 */
'use strict';
const W = require('./lib/walk.cjs');
const { measure } = require('./lib/theme-measure.cjs');
const REAL = process.argv.includes('--real');
const J = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

const walk = async (w) => {
  const { page, ctx, base } = w;
  const S = { calls: [], stack: null };
  const handle = 'walkreg' + String(Date.now()).slice(-6), email = handle + '@test.example';
  let api = base;
  if (REAL) {
    S.stack = await require('./lib/real-stack.cjs').up({ webBase: base });
    api = S.stack.api;
    ctx.on('request', (q) => { if (q.url().startsWith(api) && q.method() !== 'GET' && q.method() !== 'OPTIONS') S.calls.push(q.method() + ' ' + new URL(q.url()).pathname + ' ' + (q.postData() || '')); });
  } else {
    await ctx.route('**/api/**', async (r) => {
      const q = r.request(), p = new URL(q.url()).pathname, m = q.method();
      if (m !== 'GET') S.calls.push(m + ' ' + p + ' ' + (q.postData() || ''));
      if (p === '/api/entities/register') return J(r, 200, { email });
      if (p === '/api/entities/constitutions') return J(r, 200, { constitutions: [{ key: 'base', label: 'Base', is_default: true, capabilities: [] }] });
      if (p === '/api/entities/verify') {
        const token = b64({ alg: 'none' }) + '.' + b64({ identity_id: 'ent-new', identity_type: 'entity', display_name: handle, exp: Math.floor(Date.now() / 1000) + 3600 }) + '.x';
        return J(r, 200, { token, entity: { identity_id: 'ent-new', identity_type: 'entity', display_name: handle, bridge_id: 'CBNEW0001' } });
      }
      if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: handle, ui_prefs: {} } });
      return J(r, 200, {});
    });
  }
  await ctx.addInitScript((a) => { try { localStorage.setItem('cb_api_base', a); } catch (_) {} }, api);

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const wrote = (re) => S.calls.filter((c) => re.test(c));
  const signedOut = async () => { await page.evaluate(() => { try { localStorage.removeItem('cb_sess'); } catch (_) {} }).catch(() => {}); };

  await page.goto(base + '/'); await signedOut(); await page.goto(base + '/');
  await w.step('R1', 'Home, signed out -> the sign-in window\'s "New shop? Register" points at CB Settings › New shop, never the workshop', async () => {
    await page.waitForSelector('[data-testid="signin-register"]', { timeout: 20000 });
    const href = await page.getAttribute('[data-testid="signin-register"]', 'href');
    return { ok: href === '/settings.html#/new', saw: 'href ' + href };
  });
  await w.step('R2', 'a CBFrame page (Tasks), signed out -> the same register door', async () => {
    await page.goto(base + '/tasks.html'); await page.waitForSelector('[data-testid="signin-register"]', { timeout: 20000 });
    const href = await page.getAttribute('[data-testid="signin-register"]', 'href');
    return { ok: href === '/settings.html#/new', saw: 'href ' + href };
  });
  await w.step('R3', 'Home -> press "New shop? Register" -> CB Settings › New shop: the User ID and e-mail fields, no sign-in window over it', async () => {
    await page.goto(base + '/'); await page.click('[data-testid="signin-register"]');
    await page.waitForSelector('[data-testid="reg-name"]', { timeout: 20000 });
    const url = page.url().replace(base, ''), side = await txt('[data-testid="skel-side"]'), win = await page.locator('.cbsh-signin [data-testid="signin-id"]').count();
    return { ok: /settings\.html#\/new$/.test(url) && /New shop/.test(side) && !/Your shop|Country/.test(side) && win === 0, saw: url + ' · sidebar "' + side + '" · sign-in fields ' + win };
  });
  await w.step('R4', 'New shop -> User ID + e-mail -> Create -> one register call; the code step with the gov panel; Verify greyed until "These are right" is ticked', async () => {
    await page.fill('[data-testid="reg-name"]', handle); await page.fill('[data-testid="reg-email"]', email);
    await page.click('[data-testid="reg-submit"]');
    await page.waitForSelector('[data-testid="reg-otp"]', { timeout: 15000 });
    const reg = wrote(/POST \/api\/entities\/register/), gov = await page.locator('[data-testid="reg-gov"]').count();
    const greyed = await page.locator('[data-testid="reg-submit"]').isDisabled();
    return { ok: reg.length === 1 && /"context"/.test(reg[0]) && gov === 1 && greyed, saw: reg.length + ' register · gov panel ' + gov + ' · Verify greyed ' + greyed };
  });
  /* rule 13 on the code step BEFORE it is used (verify moves on) — and on the first step after */
  const audit = () => page.evaluate(() => {
    const host = document.getElementById('set'), out = { clip: [], scroll: [], cover: [], app: [], budget: [] };
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    document.querySelectorAll('body *').forEach((el) => {
      if (!vis(el) || el.closest('#cb-avatar,#toast,script,style')) return;
      const cs = getComputedStyle(el), hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (/auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.scroll.push(el.tagName + '.' + el.className + ' ' + el.scrollWidth + '>' + el.clientWidth);
      if (host.contains(el) && hasText && (cs.textOverflow === 'ellipsis' || /hidden|clip/.test(cs.overflowX)) && el.scrollWidth > el.clientWidth + 1) out.clip.push(el.textContent.trim().slice(0, 40));
      const href = (el.getAttribute('href') || '') + ' ' + (el.getAttribute('onclick') || '');
      if (/app\.html/.test(href)) out.app.push(el.outerHTML.slice(0, 80));
    });
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.scroll.push('page ' + document.documentElement.scrollWidth + '>' + window.innerWidth);
    host.querySelectorAll('button,input,select,textarea,a').forEach((c) => {
      if (!vis(c)) return; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && hit !== c && !c.contains(hit) && !hit.contains(c) && !hit.closest('#toast') && !(c.tagName === 'INPUT' && hit.closest('label') && hit.closest('label').contains(c))) out.cover.push((c.dataset.testid || c.id || c.tagName) + ' under ' + (hit.id || hit.className || hit.tagName));
    });
    host.querySelectorAll('p,.hint,.sub,.err').forEach((n) => {
      const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t) return;
      const sentences = t.split(/[.!?](\s|$)/).filter((s) => s && s.trim()).length;
      if (t.length > 140 || sentences > 2) out.budget.push(t.length + ' chars / ' + sentences + ' sentences: "' + t.slice(0, 50) + '…"');
    });
    window.scrollTo(0, 0);
    return out;
  });
  const rule13 = async (id, label) => {
    for (const theme of ['cream', 'dark']) {
      for (const width of [1366, 390]) {
        await page.setViewportSize({ width, height: width > 500 ? 900 : 844 });
        await w.step(id + '·' + theme + '·' + width, label + ' · ' + theme + ' · ' + width + ' px -> AA contrast, no clipping, no inner sideways scroll, nothing over a control, no app.html link, copy in budget', async () => {
          await page.evaluate((t) => { CBAvatar.applyTheme(t); }, theme); await page.waitForTimeout(150);
          const pairs = await page.evaluate(measure), bad = pairs.filter((x) => !x.grad && x.ratio < x.need), a = await audit();
          const fails = [].concat(bad.map((x) => 'contrast ' + x.ratio + ' "' + x.text + '"'), a.clip.map((x) => 'clipped "' + x + '"'), a.scroll.map((x) => 'scroll ' + x),
            a.cover.map((x) => 'covered ' + x), a.app.map((x) => 'app.html ' + x), a.budget.map((x) => 'budget ' + x));
          return { ok: !fails.length && pairs.length > 5, saw: pairs.length + ' texts measured, lowest ' + Math.min.apply(null, pairs.map((x) => x.ratio)) + (fails.length ? ' · ' + fails.slice(0, 4).join(' · ') : ' · clean') };
        });
      }
    }
    await page.evaluate(() => { CBAvatar.applyTheme(CBAvatar.themeKey()); }).catch(() => {});
    await page.setViewportSize({ width: 1366, height: 900 });
  };
  await rule13('R5', 'the code step');
  await w.step('R6', 'tick "These are right" + the code -> Verify -> one verify call carrying agreed_at -> HOME, signed in as the new shop (never app.html)', async () => {
    await page.check('[data-testid="reg-agree"]');
    await page.fill('[data-testid="reg-otp"]', '123456'); await page.click('[data-testid="reg-submit"]');
    await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 });
    await page.waitForSelector('[data-testid="cbavatar"]', { timeout: 20000 });
    const v = wrote(/POST \/api\/entities\/verify/), sess = await page.evaluate(() => JSON.parse(localStorage.getItem('cb_sess') || 'null'));
    const visited = S.calls.concat([page.url()]).some((c) => /app\.html/.test(c));
    return { ok: v.length === 1 && /"agreed_at"/.test(v[0]) && sess && sess.token && sess.role === 'entity' && !visited,
      saw: v.length + ' verify · now at ' + page.url().replace(base, '') + ' · cb_sess ' + (sess ? sess.role + ' ' + sess.name : 'none') };
  });
  await signedOut();
  await page.goto(base + '/settings.html#/new'); await page.waitForSelector('[data-testid="reg-name"]', { timeout: 20000 });
  await rule13('R7', 'the User ID step');
  await w.step('R8', 'the workshop keeps its door: app.html #/register paints the SAME form (reg-name · reg-email · reg-submit), mintEntity\'s controls', async () => {
    await page.goto(base + '/app.html#/register'); await page.waitForSelector('[data-testid="reg-name"]', { timeout: 20000 });
    const n = await page.locator('[data-testid="reg-name"],[data-testid="reg-email"],[data-testid="reg-submit"]').count();
    return { ok: n === 3, saw: n + ' of 3 controls' };
  });
  if (w.errs.length) w.note('R99', 'page errors seen during the walk', w.errs.slice(0, 3).join(' | '));
  if (S.stack) S.stack.stop();
};
walk.opts = { viewport: { width: 1366, height: 900 } };
W.run('register', walk);
