#!/usr/bin/env node
/**
 * e2e/walk-settings.cjs - CB SETTINGS, WALKED (SET1, 2026-10-13: settings.html + app/cap-shop.js + app/cap-country.js mounted in its pane).
 * Black box: it presses what an owner presses - Your shop (the Business fields + the business identity rows the till reads the state from),
 * Save, a refused Save, Country (CS1's rows) and Continue - and reads what the screen says. A FIXTURE shop; the API is a stand-in answering
 * inside the page, so nothing leaves the runner and nothing is written anywhere.
 * Then RULE 13 (owner, 13 Oct): both sections, in Cream (light) and Dark, at 1366 and 390 px - AA contrast of every text element
 * (lib/theme-measure.cjs, the same eyes as crm-themes / standards-page), no clipped text, no inner sideways scroll, no fixed control over
 * content, no link to app.html, and the copy within the text budget (no doc defines one yet: a hint or line of copy is at most 140
 * characters and two sentences - said here, so the number is visible).
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-settings.cjs      headless
 *   node e2e/walk-settings.cjs --show                                watch it
 * One line per path: "ID · path · PASS/FAIL (what it saw)". Screenshots: e2e/shots/walk-settings-NN.png.
 */
'use strict';
const W = require('./lib/walk.cjs');
const { measure } = require('./lib/theme-measure.cjs');
const R13 = require('./lib/rule13.cjs');
const J = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const walk = async (w) => {
  const { page, ctx, base } = w;
  const S = { calls: [], refuseSave: false, csDone: false };
  const ME = { display_name: 'Fixture Shop', gstn: '33AABCK1234F1Z6', address: '12 Bazaar Street, Madurai', business_status: 'active', currency_code: 'INR', country_code: 'IN' };
  const VAULT = { sections: [{ type: 'identity', label: '', rows: [
    { name: 'Legal name', tag: 'legal_name', value: 'Fixture Shop Pvt Ltd' }, { name: 'Address', tag: 'address', value: '12 Bazaar Street' },
    { name: 'City', tag: 'city', value: 'Madurai' }, { name: 'State', tag: 'state', value: 'Tamil Nadu' }, { name: 'PIN / ZIP', tag: 'pincode', value: '625001' }] }] };
  const CS = () => ({ migrated: true, done: S.csDone, required: !S.csDone, country: { code: 'IN', name: 'India' }, currency: 'INR', fy_start_month: 4,
    tax: { registered: true, number: '33AABCK1234F1Z6', scheme: 'gst' }, source: {}, pack: { id: 'IN', version: '1.0.0', books: true, code: null, why: null } });

  await ctx.route('**/api/**', async (r) => {
    const q = r.request(), p = new URL(q.url()).pathname, m = q.method();
    let body = null; try { body = q.postData() ? JSON.parse(q.postData()) : null; } catch (_) {}
    if (m !== 'GET') S.calls.push(m + ' ' + p + (body ? ' ' + JSON.stringify(body) : ''));
    if (p === '/api/entities/me') return J(r, 200, { entity: ME });
    if (p === '/api/entities/profile' && m === 'PATCH') {
      if (S.refuseSave) return J(r, 403, { message: 'Only the owner can change the shop details.' });
      Object.assign(ME, body); return J(r, 200, { ok: true });
    }
    if (p === '/api/governance/profile' && m === 'GET') return J(r, 200, { vault: VAULT, vault_encrypted: true });
    if (p === '/api/governance/profile/vault' && m === 'PUT') return J(r, 200, { ok: true });
    if (p === '/api/governance/country-setup') { if (m === 'PUT') S.csDone = true; return J(r, 200, CS()); }
    if (p === '/api/facts/rail') return J(r, 200, { suppliers: 0, customers: 0, in: 0, out: 0, stuck: 0 });
    return J(r, 200, {});
  });
  await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const wrote = (re) => S.calls.filter((c) => re.test(c)).length;
  const shop = async () => { await page.goto(base + '/settings.html#/shop'); await page.waitForSelector('[data-testid="shop-card"]', { timeout: 20000 }); await page.waitForSelector('[data-testid="vault-only-identity"]', { timeout: 10000 }); await page.waitForTimeout(300); };
  const country = async () => { await page.goto(base + '/settings.html#/country'); await page.waitForSelector('[data-testid="cs-rows"]', { timeout: 20000 }); await page.waitForTimeout(300); };

  await shop();
  await w.step('T1', 'CB Settings -> Your shop: the GSTIN and address the bill prints, and the business identity with its state and PIN', async () => {
    const card = await page.$eval('[data-testid="shop-card"]', (n) => [...n.querySelectorAll('input,textarea')].map((i) => i.value).join(' | ')).catch(() => '');
    const idv = await page.$eval('[data-testid="vault-only-identity"]', (n) => [...n.querySelectorAll('input,textarea,select')].map((i) => i.value).join(' | ')).catch(() => '');
    return { ok: /33AABCK1234F1Z6/.test(card) && /Bazaar/.test(card) && /Tamil Nadu/.test(idv) && /625001/.test(idv), saw: 'shop: ' + card.slice(0, 70) + ' · identity: ' + idv.slice(0, 70) };
  });
  await w.step('T2', 'Your shop -> change the address -> Save -> one PATCH, "Shop details saved."', async () => {
    const before = wrote(/PATCH \/api\/entities\/profile/);
    await page.fill('#pf_addr', '14 Bazaar Street, Madurai'); await page.click('[data-testid="shop-save"]'); await page.waitForTimeout(800);
    const n = wrote(/PATCH \/api\/entities\/profile/) - before, toast = await txt('#toast');
    return { ok: n === 1 && /14 Bazaar/.test(S.calls[S.calls.length - 1] || '') && /saved/i.test(toast), saw: n + ' PATCH; toast "' + toast + '"' };
  });
  await w.step('T3', 'Your shop -> Save refused by the server -> its sentence painted under the fields, never a raw error', async () => {
    S.refuseSave = true; await shop();
    await page.fill('#pf_addr', '15 Bazaar Street'); await page.click('[data-testid="shop-save"]'); await page.waitForTimeout(800);
    const e = await txt('[data-testid="shop-err"]'); S.refuseSave = false;
    return { ok: /Only the owner can change the shop details/.test(e) && !/403|undefined|Error/.test(e), saw: '"' + e + '"' };
  });
  await w.step('T4', 'Your shop -> the identity card -> Save -> one PUT of the vault with the state row', async () => {
    await shop(); await page.click('[data-testid="vault-save"]'); await page.waitForTimeout(600);
    const put = S.calls.filter((c) => /PUT \/api\/governance\/profile\/vault/.test(c)).pop() || '';
    return { ok: /Tamil Nadu/.test(put), saw: put.slice(0, 120) };
  });
  await w.step('T5', 'CB Settings -> Country: the rows (country · money · year · tax), each with where it came from; the sidebar marks Country', async () => {
    await page.click('text=Country >> nth=0').catch(() => {}); await page.waitForSelector('[data-testid="cs-rows"]', { timeout: 10000 });
    const c = await txt('[data-testid="cs-val-country"]'), t = await txt('[data-testid="cs-title"]');
    return { ok: /India/.test(c) && /Country setup/.test(t) && /#\/country$/.test(page.url()), saw: t + ' · ' + c + ' · ' + page.url().replace(base, '') };
  });
  await w.step('T6', 'Country -> Continue -> one PUT, "Country set." and back to Your shop (never to the workshop)', async () => {
    await page.click('[data-testid="cs-save"]'); await page.waitForSelector('[data-testid="shop-card"]', { timeout: 8000 });
    return { ok: wrote(/PUT \/api\/governance\/country-setup/) === 1 && /settings\.html#\/shop$/.test(page.url()), saw: wrote(/PUT \/api\/governance\/country-setup/) + ' PUT · now at ' + page.url().replace(base, '') };
  });
  /* FX-QA1 (QA-W1 finding 3): the field words come from the shop's country pack (helpers.js packWord), never a typed "GSTIN" / "PIN" */
  await w.step('T6A', 'Your shop in Australia · the UAE · India -> the pack\'s words: ABN · Postcode / TRN · P.O. Box · Emirate / GSTIN · PIN', async () => {
    const words = async (cc) => {
      ME.country = cc; ME.country_code = cc;
      await page.goto(base + '/settings.html?cc=' + cc + '#/shop'); await page.waitForSelector('[data-testid="vault-only-identity"]', { timeout: 20000 }); await page.waitForTimeout(300);   /* a fresh load: a same-hash goto keeps the page */
      return page.evaluate(() => ({ lic: (document.querySelector('label.fl') || {}).textContent || '', why: (document.querySelector('[data-testid="shop-why"]') || {}).textContent || '',
        sug: [...document.querySelectorAll('#vsug_identity option')].map((o) => o.value).join(',') }));
    };
    const au = await words('AU'), ae = await words('AE'), ind = await words('IN');
    const ok = /^ABN/.test(au.lic) && /ABN/.test(au.why) && !/GSTIN|PIN/.test(au.lic + au.why + au.sug) && /Postcode/.test(au.sug)
      && /^TRN/.test(ae.lic) && !/GSTIN|PIN/.test(ae.lic + ae.why + ae.sug) && /P\.O\. Box/.test(ae.sug) && /Emirate/.test(ae.sug)
      && /^GSTIN/.test(ind.lic) && /GSTIN/.test(ind.why) && /PIN/.test(ind.why) && /,PIN,/.test(ind.sug);
    return { ok, saw: 'AU "' + au.lic.split(' ')[0] + '" · "' + au.why.trim() + '" · ' + au.sug.split(',').slice(4, 6) + ' | AE "' + ae.lic.split(' ')[0] + '" · ' + ae.sug.split(',').slice(4, 6) + ' | IN "' + ind.lic.split(' ')[0] + '" · "' + ind.why.trim() + '"' };
  });

  /* ── RULE 13: two themes × two widths × two sections — e2e/lib/rule13.cjs, the ONE audit (lifted on 2026-10-14 when walk-settings-ops.cjs became its second caller) ── */
  const frameClip = await R13.sweep(w, page, measure, { host: 'set', sections: { shop: shop, country: country }, from: 7 });
  /* the shared frame (page-frame.js / shell.js) ellipsises the shop's name in its top bar on a phone — on every small app (employees.html the same); said, not hidden */
  if (frameClip.size) w.note('T15', 'the shared frame\'s top bar at 390 px (not this page\'s pane)', 'ellipsised: ' + [...frameClip].join(' · '));
  if (w.errs.length) w.note('T99', 'page errors seen during the walk', w.errs.slice(0, 3).join(' | '));
};
walk.opts = { viewport: { width: 1366, height: 900 } };
W.run('settings', walk);
