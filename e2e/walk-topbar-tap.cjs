/* walk-topbar-tap.cjs - THE MAIN APP'S TOP BAR MEETS THE ONE TAP RULE ON A PHONE (Athi 10 Nov, wave 2 step 1b, UX-137)
 *
 * Web #520 put the shared shell header on 44 px and its tests passed while the real app header (public/app.html .topbar) stayed at 34 px and 24 px:
 * they read the shell's CSS text. This walk renders app.html itself at 390 and measures the BOX of every control in the bar (getBoundingClientRect),
 * at the four text sizes (cb_fs S, M, L, XL = 1.32): each must be at least 44 x 44, the bar must not scroll sideways, and every control must be a
 * registered component (data-cbname) so the size comes from the one rule in ui.js. At 1366 the same controls are the compact 32 px size.
 * A FIXTURE shop: the site is served from this checkout, the API is a stand-in answering inside the page.
 * OWNS       the rendered-box proof of the main top bar's tap size. CALLED BY  the web workflows' e2e step, node e2e/walk-topbar-tap.cjs
 * Run: NODE_PATH=$PWD/e2e/node_modules node e2e/walk-topbar-tap.cjs
 */
'use strict';
const W = require('./lib/walk.cjs');
const C = require('./lib/contract.cjs');
const MIN = 44;
const BAR_CONTROLS = ['nav-drawer', 'nav-home', 'icon-legend', 'icon-notifications'];
/* the four text sizes, as cb_fs stores them (avatar.js): s m l xl; xl scales type by 1.32 */
const FONT_SCALES = [['S', 's'], ['M', 'm'], ['L', 'l'], ['XL', 'xl']];

const walk = async (w) => {
  const { ctx, base } = w;
  const sess = W.session('Fixture Owner', 'Fixture Shop');
  await ctx.route('**/api/**', async (r) => {
    const p = new URL(r.request().url()).pathname;
    if (p === '/api/entities/me') return C.json(r, 200, { entity: { display_name: 'Fixture Shop', currency_code: 'INR', country_code: 'IN' } });
    return C.json(r, 200, {});
  });
  await ctx.addInitScript((a) => { try { localStorage.setItem('cb_ids', '1'); localStorage.setItem('cb_sess', a.sess); } catch (_) { /* a blocked store: the page signs out and the step says so */ } }, { sess });

  /** every visible control of the bar and its box, found in the real page */
  const measure = (page) => page.evaluate((ids) => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10, l: b.left, r: b.right }; };
    const out = {};
    ids.forEach((id) => { const el = document.querySelector('.topbar [data-testid="' + id + '"]'); out[id] = el && el.offsetParent !== null ? Object.assign(box(el), { cb: el.getAttribute('data-cbname') }) : null; });
    const av = document.querySelector('.topbar .cbav-btn'); out.avatar = av ? box(av) : null;
    const shown = (el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
    const ch = Array.from(document.querySelectorAll('.topbar .cbui-choice-btn, .topbar .cbui-choice [role="radio"]')).filter(shown)[0]; out.presence = ch ? box(ch) : null;
    /* every other control the bar draws, whatever it is: a button, a link or a switch segment that is on screen */
    Array.from(document.querySelectorAll('.topbar button, .topbar a, .topbar [role="radio"]')).filter(shown).forEach((el, i) => { const b = box(el); if (b.w < 44 || b.h < 44) out['other' + i + ' ' + (el.getAttribute('data-testid') || el.className || el.tagName)] = b; });
    out.appwrap = (document.querySelector('.appwrap') || {}).className; out.iw = window.innerWidth;
    out.sideways = document.documentElement.scrollWidth - window.innerWidth;
    out.barRight = Math.max.apply(null, Array.from(document.querySelectorAll('.topbar *')).filter((e) => e.offsetParent !== null).map((e) => e.getBoundingClientRect().right));
    return out;
  }, BAR_CONTROLS);
  const small = (m) => Object.keys(m).filter((k) => m[k] && typeof m[k] === 'object' && (m[k].w < MIN || m[k].h < MIN)).map((k) => k + ' ' + m[k].w + 'x' + m[k].h);
  const open = async (width, scale) => {
    await w.page.setViewportSize({ width, height: 844 });
    await ctx.addInitScript((s) => { try { localStorage.setItem('cb_fs', s); } catch (_) { /* default size */ } }, scale);
    await w.page.evaluate(() => { try { localStorage.removeItem('cb_vp'); } catch (_) { /* none stored */ } }).catch(() => {});
    await w.page.goto(base + '/app.html?t=' + Date.now() + '#/', { waitUntil: 'load' });
    await w.page.waitForSelector('.topbar [data-testid="nav-home"]', { timeout: 15000 });
    await w.page.waitForTimeout(600);
    return measure(w.page);
  };

  /* the wide step runs first: the app remembers a phone layout (cb_vp) once it has drawn one */
  await w.step('T-wide', '1366 · the controls are the compact 32 px size, not 44, and the menu button is not drawn', async () => {
    const m = await open(1366, 'm'), tooSmall = ['nav-home', 'icon-legend', 'icon-notifications'].filter((id) => !m[id] || m[id].h < 32 || m[id].w < 32);
    return { ok: !tooSmall.length && m['nav-drawer'] === null && m.sideways <= 0, saw: JSON.stringify(m) };
  });
  for (const [label, scale] of FONT_SCALES) {
    await w.step('T-' + label, '390 · text size ' + label + ': every control of the main top bar is at least 44 x 44, nothing scrolls sideways', async () => {
      const m = await open(390, scale), bad = small(m);
      const components = BAR_CONTROLS.every((id) => m[id] && m[id].cb);
      return { ok: !bad.length && components && m.sideways <= 0 && m.barRight <= 390.5, saw: JSON.stringify({ small: bad, sideways: m.sideways, barRight: m.barRight, components, sizes: m }) };
    });
  }
};
walk.opts = { viewport: { width: 390, height: 844 } };
W.run('topbar-tap', walk);
