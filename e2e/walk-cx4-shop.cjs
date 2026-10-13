#!/usr/bin/env node
/**
 * e2e/walk-cx4-shop.cjs — THE STOREFRONT FOR AN INDIAN, AN AUSTRALIAN AND A UAE SHOP (CX4, 2026-10-13).
 * Black box: the real shop.html; the API is a stand-in answering the catalogue the way lib/catalogue-view now does
 * (shop.country · shop.tax_id_word, no upi_id under a pack without UPI). For each shop, at 1366 and 390 px, light and dark:
 *   X1  the shop's head names its tax id with the pack's word — GSTIN · ABN · TRN — and never "GSTIN" for AU / AE
 *   X2  the price is in the shop's money (₹ · A$ / AUD · AED), never ₹ for AU / AE
 *   X3  every text element reads at AA (4.5:1, large 3:1) against what it sits on; no inner horizontal scroll; no link to app.html
 *   NODE_PATH=e2e/node_modules node e2e/walk-cx4-shop.cjs
 */
'use strict';
const W = require('./lib/walk.cjs');
const C = require('./lib/contrast.cjs');
const J = (o) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });

const SHOPS = {
  IN: { display_name: 'Sim Stores', currency_code: 'INR', gstn: '33AAPFU0939F1ZV', country: 'IN', tax_id_word: 'GSTIN', upi_id: 'simstores@upi', address: 'Anna Salai, Chennai' },
  AU: { display_name: 'Sim Sydney', currency_code: 'AUD', gstn: '51824753556', country: 'AU', tax_id_word: 'ABN', upi_id: null, address: '1 George St, Sydney NSW' },
  AE: { display_name: 'Sim Dubai', currency_code: 'AED', gstn: '100123456700003', country: 'AE', tax_id_word: 'TRN', upi_id: null, address: 'Deira, Dubai' },
};
const SYM = { IN: /₹/, AU: /A\$|AUD/, AE: /AED|د\.إ/ };
const view = (s) => ({ available: true, visibility: 'public', categories: [],
  shop: Object.assign({ bridge_id: 'CBSIM' + s.country, is_verified: true, business_status: 'open', storefront_access: 'browse', unit_rules: {},
    showcase: { template: null, sections: [] }, viewer_groups: [], connector: null,
    order_input: { preset: 'cart', pipeline: 'commerce', showsPrice: true, negotiable: false, schema: null, documents: [] }, order_method: 'cart' }, s),
  schema: null, fields: [], offers: [],
  items: [{ item_id: 'i1', item_data: { name: 'Basmati rice 5 kg', unit: 'bag', price: 640, currency: s.currency_code } }] });

W.run('cx4-shop', async (w) => {
  const { page } = w;
  for (const cc of Object.keys(SHOPS)) {
    for (const vp of [{ width: 1366, height: 860 }, { width: 390, height: 844 }]) {
      for (const scheme of ['light', 'dark']) {
        const tag = cc + ' · ' + vp.width + ' · ' + scheme;
        await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
        await page.route('**/api/**', (r) => r.fulfill(J({ ok: true })));
        await page.route('**/api/catalogue/CBSIM' + cc + '*', (r) => r.fulfill(J(view(SHOPS[cc]))));
        await page.setViewportSize(vp);
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(w.base + '/shop.html?s=CBSIM' + cc + '&api=' + encodeURIComponent(w.base));
        await page.waitForSelector('[data-testid="shop-head"]', { timeout: 15000 });
        await page.waitForTimeout(400);

        await w.step('X1', tag + ' · the head names the tax id ' + SHOPS[cc].tax_id_word, async () => {
          const t = await page.evaluate(() => { const d = document.querySelector('[data-testid="shop-about"]'); if (d) d.open = true; return document.body.innerText || ''; });
          const want = SHOPS[cc].tax_id_word;
          const ok = t.indexOf(want + ' ' + SHOPS[cc].gstn) >= 0 && (cc === 'IN' || t.indexOf('GSTIN') < 0);
          return { ok, saw: ok ? want + ' ' + SHOPS[cc].gstn : 'head: ' + t.replace(/\s+/g, ' ').slice(0, 160) };
        });
        await w.step('X2', tag + ' · prices in the shop\'s money', async () => {
          const t = await page.evaluate(() => document.body.innerText || '');
          const ok = SYM[cc].test(t) && (cc === 'IN' || !/₹/.test(t));
          return { ok, saw: (t.match(/(₹|A\$|AUD|AED|د\.إ)\s?[\d,.]+/) || ['no price'])[0] };
        });
        await w.step('X3', tag + ' · AA contrast · no inner scroll · no app.html link', async () => {
          const r = await page.evaluate(() => {
            const rgb = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
            const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const b = rgb(getComputedStyle(e).backgroundColor); if (b && b.a > 0.5) return b.c; if (getComputedStyle(e).backgroundImage !== 'none') return null; } return [255, 255, 255]; };
            const out = []; const els = document.querySelectorAll('body *');
            for (const el of els) {
              if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
              const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
              if (!own) continue;
              const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
              const bg = bgOf(el); const fg = rgb(cs.color); if (!bg || !fg) continue;
              const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
              out.push({ t: el.textContent.trim().slice(0, 30), fg: fg.c, bg, large: size >= 24 || (bold && size >= 18.66) });
            }
            const scrollers = Array.from(document.querySelectorAll('body *')).filter((e) => { const cs = getComputedStyle(e); return /auto|scroll/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0; }).map((e) => e.className || e.tagName);
            return { out, wide: document.documentElement.scrollWidth > window.innerWidth + 1, scrollers, appLinks: document.querySelectorAll('a[href*="app.html"]').length };
          });
          const hex = (a) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
          const low = r.out.filter((x) => C.ratio(hex(x.fg), hex(x.bg)) < (x.large ? 3 : 4.5));
          const ok = !low.length && !r.wide && !r.scrollers.length && !r.appLinks;
          return { ok, saw: r.out.length + ' texts' + (low.length ? ' · LOW: ' + low.slice(0, 3).map((x) => '"' + x.t + '" ' + C.ratio(hex(x.fg), hex(x.bg)).toFixed(2)).join(', ') : ' · all AA')
            + (r.wide ? ' · page wider than the window' : '') + (r.scrollers.length ? ' · inner scroll: ' + r.scrollers.slice(0, 2).join(',') : '') + (r.appLinks ? ' · app.html link' : '') };
        });
      }
    }
  }
});
