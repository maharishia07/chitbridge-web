/**
 * storefront-probe.cjs — does a shop's OWN catalogue reach its public storefront?
 *
 * Athi, observation-3: *"when I open the storefront, only the beta traders inherited catalogue only appears, but
 * not the rest. Need to understand the difference."*
 *
 * ⚠️ THE MECHANISM IS NOT OBVIOUS FROM THE SOURCE, and the obvious reading was wrong. Owned rows are read with
 * NO tenant context, so RLS admits them only when the owner's default schema is `visibility='public'`; adopted
 * rows are read WITH the owner's context and are admitted regardless. That asymmetry would explain the report
 * exactly — except that PATCH /profile already mirrors catalogue_visibility onto the schema, deliberately and
 * with a comment. So a guess would have named a cause the code already handles.
 *
 * This asks the live public endpoint instead: sign in as the shared session, read its own bridge_id and product
 * count, then fetch its storefront ANONYMOUSLY and compare what a shopper sees with what the owner has.
 *
 * Run: node e2e/storefront-probe.cjs
 */
'use strict';
const { chromium, request } = require('@playwright/test');
const path = require('path');

const BASE = process.env.CB_WEB_BASE || 'http://localhost:5173';
const API = process.env.CB_API || 'https://chitbridge-api-production.up.railway.app';
const STATE = path.join(__dirname, '.auth', 'user.json');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: STATE });
  const page = await ctx.newPage();
  const say = (s) => console.log('  ' + s);

  await page.goto(BASE + '/app.html');
  await page.waitForTimeout(4000);

  /* What the OWNER has — asked through the app's own authenticated fetch, so the token travels. */
  const owner = await page.evaluate(async (api) => {
    /* The session lives as one JSON blob under cb_sess — there is no bare token key, which is why the first
       run of this probe reported bridge=null and looked like a missing field. */
    let tok = '';
    try { tok = (JSON.parse(localStorage.getItem('cb_sess') || '{}') || {}).token || ''; } catch (_) {}
    const get = async (p) => {
      const r = await fetch(api + p, { headers: { Authorization: 'Bearer ' + tok } });
      return { status: r.status, body: await r.json().catch(() => null) };
    };
    const me = await get('/api/entities/me');
    const prods = await get('/api/products');
    const e = (me.body && (me.body.entity || me.body)) || {};
    const rows = (prods.body && (prods.body.products || prods.body.items || prods.body)) || [];
    return {
      bridge_id: e.bridge_id || null,
      user_id: e.user_id || null,
      catalogue_visibility: e.catalogue_visibility || '(absent)',
      storefront_access: e.storefront_access || '(absent)',
      owned_products: Array.isArray(rows) ? rows.length : '(shape?)',
    };
  }, API);
  say('OWNER  bridge=' + owner.bridge_id + '  visibility=' + owner.catalogue_visibility
    + '  access=' + owner.storefront_access + '  own products=' + owner.owned_products);

  if (!owner.bridge_id) { say('no bridge_id — cannot address the storefront'); await browser.close(); return; }

  /**
   * What a SHOPPER sees. ⚠️ Through Playwright's own request context, NOT a fetch() inside a blank page: that
   * fetch is cross-origin from about:blank and simply throws, which reads as 'the endpoint is down' when the
   * endpoint was never asked. No token, no cookies — an anonymous caller, which is the whole question.
   */
  const rq = await request.newContext();
  const r = await rq.get(API + '/api/catalogue/' + owner.bridge_id).catch(() => null);
  const shop = r ? { status: r.status(), body: await r.json().catch(() => null) } : { status: 'threw', body: null };
  say('SHOPPER  status=' + shop.status);
  const b = shop.body || {};
  const groups = b.groups || b.sections || [];
  say('  available: ' + b.available);
  say('  own items on the storefront:      ' + (Array.isArray(b.items) ? b.items.length : '(no items key)'));
  say('  adopted/referenced groups:        ' + (Array.isArray(groups) ? groups.length : '(none)'));
  if (Array.isArray(groups)) groups.forEach((g) => say('      · ' + (g.title || g.source || '?')
    + '  (' + ((g.items || []).length) + ' items)'));
  say('  unpriced_hidden:    ' + b.unpriced_hidden);
  say('  unavailable_hidden: ' + b.unavailable_hidden);
  say('  keys: ' + Object.keys(b).join(', ').slice(0, 260));

  await browser.close();
})();
