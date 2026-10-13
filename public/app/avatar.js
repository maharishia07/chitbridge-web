/**
 * ── ⭐⭐⭐ CBAvatar — THE AVATAR: ONE CONTROL ON EVERY CHITBRIDGE PAGE ──────────────────────────────────────────────
 *
 * Athi, 2026-10-02: *"Avatar should be a single control used across everywhere … no repeat … it is already that way only and
 * can be reused"* · *"this avatar is much simpler and no text, that is really good, i want to retain it that way"*
 * (DECISIONS.md › "The avatar is ONE control"). The app's avatar behaviour MOVED here from app.html (theme apply, reading font,
 * text size, motion, the person's appearance synced to the server — b166); the LOOK is the frozen simple one
 * (docs/design/list-standard/index.html: avPop / applyAppearance).
 *
 *   CBAvatar.mount(el, { person, items, onSignOut, … })   draw the button and its menu into `el`
 *   CBAvatar.apply()                                       put the saved look on <html> (runs at load, BEFORE first paint)
 *   CBAvatar.hydrate(prefs)                                the server's per-person appearance (true if something changed)
 *   CBAvatar.set(kind, value)                              kind: theme · font · fs · weight · motion — saves, applies, syncs
 *   CBAvatar.get() · .themeKey() · .close() · .signOut() · .THEMES · .FONTS · .TEXT_SIZES · .FS_BASE
 *
 * ⭐ ONE FILE, ONE GLOBAL, NO IMPORTS, NO BUILD STEP, NO NETWORK NEEDED — so the counter can load it as it loads /engine/screen.js.
 *    The look applies from local storage alone; the server sync is optional and silent when offline. `person` is an INPUT
 *    ({ name, role, entity, owner }) — the app session, or the counter's signed-in cashier — never read from a page global.
 *
 * ⭐ THEMES ARE NOT HERE. They are the engine's (screen v1.15.0 `CBScreen.APP_THEMES`, 16 with Terminal) — load /engine/screen.js
 *    first. This file only APPLIES one: it writes the theme's tokens on <html> (`removeProperty` first, so leaving a theme leaves
 *    nothing behind), stamps `data-theme`, and sets `color-scheme`. A theme with `font:'mono'` (Terminal) gives the page the
 *    monospace face unless the person chose a reading font.
 *
 * ⭐ THE KEYS NEVER CHANGE (a stored value is not free to rename): cb_theme · cb_font · cb_fs (s/m/l/xl) · cb_motion
 *    (auto/reduce/full) — and the new cb_weight (normal/bold). cb_theme may also hold `device` ("My device": the operating
 *    system's light/dark decides, once, at load — an explicit choice always wins over the OS).
 *
 * ⭐ TEXT SIZE MULTIPLIES THE EIGHT --fs TOKENS (FS_BASE), never `zoom` and never one flat size: a caption stays smaller than a
 *    heading. The base is the page's OWN value (read once from its stylesheet — CB Accounts keeps 12 / 13.5 / 15), falling back to
 *    FS_BASE. `--k` (the multiplier) is set too, for the list control, whose sizes are calc(Npx * var(--k,1)).
 *
 * ⭐ BOLD: regular text goes to 600 and what was already bold stays the strongest (like the phones' "Bold text"). Italic: no.
 *
 * ⚠️ THE SERVER KEEPS theme · fs · motion ONLY (routes/entities.js › ui.keys). Reading font and bold are on THIS machine until
 *    that list gains them — sending them now would be dropped silently, which is how a setting looks saved and is not.
 */
(function (root) {
  'use strict';
  if (root.CBAvatar) return;

  var doc = root.document;
  var K = root.CBScreen || {};
  var THEMES = K.APP_THEMES || {};
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  /* H34 (Athi's black-box, 2026-10-09): a utility page never sends a customer into the workshop (app.html). There is no customer Profile or Support page yet
     (BACKLOG), so the items point at the closest customer pages: Profile -> Know your business (its "Yourself" tab is the business's own facts),
     Support -> Home. A page with its own handler (onProfile / onSupport) or href still wins; the workshop itself passes its own. */
  var PROFILE_HREF = '/know-your-business.html', SUPPORT_HREF = '/';
  /* ── the facts (moved from app.html: FS_BASE · TEXT_SIZES · FONTS) ── */
  var FS_BASE = { '--fs-1': 11, '--fs-2': 12.5, '--fs-3': 14, '--fs-4': 16, '--fs-5': 20, '--fs-6': 28, '--fs-7': 36, '--fs-8': 46 };
  var TEXT_SIZES = [['s', 'Small', 0.92], ['m', 'Medium', 1], ['l', 'Large', 1.15], ['xl', 'Extra large', 1.32]];
  var FONTS = [
    ['default', 'Default',   'Inter,system-ui,sans-serif',            'the product’s own face'],
    ['grotesk', 'Grotesk',   "'Space Grotesk',Inter,sans-serif",    'larger apertures'],
    ['serif',   'Serif',     "Georgia,'Times New Roman',serif",     'serifs guide the line'],
    ['wide',    'Wide',      'Verdana,Tahoma,sans-serif',             'wide letterforms · low vision'],
    ['mono',    'Monospace', "'Space Mono',ui-monospace,monospace", 'every character the same width']
  ];
  var MONO = FONTS[4][2];
  var KEY = { theme: 'cb_theme', font: 'cb_font', fs: 'cb_fs', weight: 'cb_weight', motion: 'cb_motion', stripes: 'cb_stripes' };
  var DEFAULTS = { theme: 'device', font: 'default', fs: 'm', weight: 'normal', motion: 'auto', stripes: 'strong' };
  var STRIPES = [['off', 'Off'], ['light', 'Light'], ['strong', 'Strong']];   /* row stripes (Excel's banded rows): Strong is the default and the list unit's own 9%; Light 5%; Off none */

  function lsGet(k, d) { try { return root.localStorage.getItem(k) || d; } catch (_) { return d; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (_) {} }

  /* ── what is saved ── */
  function pref(kind) { return lsGet(KEY[kind], DEFAULTS[kind]); }
  function get() { return { theme: pref('theme'), font: pref('font'), fs: pref('fs'), weight: pref('weight'), motion: pref('motion'), stripes: pref('stripes') }; }

  /** The theme that is actually on the page. `device` (or nothing saved) asks the operating system ONCE, at load, and is not live. */
  function themeKey() {
    var p = pref('theme');
    if (p !== 'device' && has(THEMES, p) && THEMES[p]) return p;
    if (p !== 'device') return 'cream';                     /* a stale or unknown saved name never stamps itself on <html> */
    try { if (root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches && has(THEMES, 'dark')) return 'dark'; } catch (_) {}
    return 'cream';
  }

  /* ── applying ── */
  /** Apply a theme to the page. With a key it is a PREVIEW (nothing saved) — what Settings' contrast check and the palette cards use. */
  function themeApply(forKey) {
    var r = doc.documentElement, key = (forKey && has(THEMES, forKey) && THEMES[forKey]) ? forKey : themeKey(), t = THEMES[key] || { vars: {} };
    var all = {};
    Object.keys(THEMES).forEach(function (k) { Object.keys(THEMES[k].vars || {}).forEach(function (v) { all[v] = 1; }); });
    Object.keys(all).forEach(function (v) { r.style.removeProperty(v); });
    Object.keys(t.vars || {}).forEach(function (v) { r.style.setProperty(v, t.vars[v]); });
    r.style.colorScheme = t.scheme || 'light';              /* the caret, scrollbars, autofill and date picker are drawn by the browser */
    r.setAttribute('data-theme', key);
    if (Object.keys(t.vars || {}).length) r.setAttribute('data-themed', key); else r.removeAttribute('data-themed');   /* a page's own names key off THIS: Cream overrides nothing */
  }
  function fontStack(k) { var row = FONTS.filter(function (f) { return f[0] === k; })[0] || FONTS[0]; return row[2]; }
  function fontApply() {
    var r = doc.documentElement, fk = pref('font'), t = THEMES[themeKey()] || {}, stack = null;
    if (fk !== 'default') stack = fontStack(fk);
    else if (t.font === 'mono') stack = MONO;               /* Terminal's own face, unless the person chose one */
    /* two names, because the pages use two: the app's --font-ui and the list standard's --f-ui */
    ['--font-ui', '--f-ui'].forEach(function (v) { if (stack) r.style.setProperty(v, stack); else r.style.removeProperty(v); });
  }
  var BASE = null;
  function fsBase() {
    if (BASE && BASE.ready) return BASE;
    var b = { ready: false }, r = doc.documentElement, cs = null, got = 0, saved = {};
    try { cs = root.getComputedStyle(r); } catch (_) {}
    Object.keys(FS_BASE).forEach(function (tok) {
      saved[tok] = r.style.getPropertyValue(tok); if (saved[tok]) r.style.removeProperty(tok);
    });
    /* ⚠️ a page may declare its tokens in rem/em (testing.html: --fs-1:0.8125rem). parseFloat alone read that as 0.8 px, so
       any text size but Medium drew the whole page at ~1 px (Athi, 2026-10-07). Convert to px against the root's own size. */
    var remPx = 16;
    try { remPx = parseFloat(root.getComputedStyle(r).fontSize) || 16; } catch (_) {}
    Object.keys(FS_BASE).forEach(function (tok) {
      var raw = cs ? String(cs.getPropertyValue(tok)).trim() : '', v = parseFloat(raw);
      if (/r?em$/i.test(raw)) v = v * remPx; else if (raw && !/px$/i.test(raw)) v = NaN;   /* %, calc(), vw …: fall back to FS_BASE */
      if (v > 0) { b[tok] = v; got++; } else b[tok] = FS_BASE[tok];
    });
    Object.keys(saved).forEach(function (tok) { if (saved[tok]) r.style.setProperty(tok, saved[tok]); });
    b.ready = got === Object.keys(FS_BASE).length;           /* the stylesheet was not parsed yet: ask again next time */
    BASE = b; return b;
  }
  function sizeApply() {
    var r = doc.documentElement, row = TEXT_SIZES.filter(function (x) { return x[0] === pref('fs'); })[0] || TEXT_SIZES[1], b = fsBase();
    Object.keys(FS_BASE).forEach(function (tok) {
      if (row[2] === 1) r.style.removeProperty(tok); else r.style.setProperty(tok, (Math.round(b[tok] * row[2] * 10) / 10) + 'px');
    });
    if (row[2] === 1) r.style.removeProperty('--k'); else r.style.setProperty('--k', String(row[2]));
  }
  function weightApply() {
    var r = doc.documentElement;
    if (pref('weight') === 'bold') r.setAttribute('data-weight', 'bold'); else r.removeAttribute('data-weight');
  }
  function motionApply() {
    var r = doc.documentElement, m = pref('motion');
    /* ⚠️ an unrecognised saved value means "follow the device", never a stamp no rule matches (the health setting must not fail open) */
    if (m === 'reduce' || m === 'full') r.setAttribute('data-motion', m); else r.removeAttribute('data-motion');
  }
  /** the ONE zebra token: the stamp picks --zebra (CSS below); Strong is no stamp, the unit's own fallback */
  function stripesApply() {
    var r = doc.documentElement, s = pref('stripes');
    if (s === 'off' || s === 'light') r.setAttribute('data-stripes', s); else r.removeAttribute('data-stripes');
  }
  function apply() {
    if (!doc || !doc.documentElement) return;
    try { themeApply(); fontApply(); sizeApply(); weightApply(); motionApply(); stripesApply(); } catch (_) {}
  }

  /* ── the person's appearance follows them (b166) — silent when there is nothing to reach ── */
  var pushTimer = null;
  function apiBaseOf(o) {
    if (o && o.apiBase) return o.apiBase;
    try { if (typeof CFG !== 'undefined' && CFG && CFG.API_BASE) return CFG.API_BASE; } catch (_) {}
    return '';
  }
  function tokenOf(o) {
    if (o && o.token) return o.token;
    try { var s = JSON.parse(root.localStorage.getItem('cb_sess') || 'null'); return (s && s.token) || ''; } catch (_) { return ''; }
  }
  var HOST = {};                                            /* what the mounted page told us (apiBase · token · sync) */
  function push() {
    if (HOST.sync === false) return;
    var body = { theme: pref('theme'), fs: pref('fs'), motion: pref('motion'), stripes: pref('stripes') };
    /* the app's (and CB Accounts') own door: CBPrefs debounces, queues offline and stays silent before the migration */
    try { if (typeof CBPrefs !== 'undefined' && typeof SESSION !== 'undefined' && SESSION && SESSION.token) { CBPrefs.push('ui', body); return; } } catch (_) {}
    var base = apiBaseOf(HOST), tok = tokenOf(HOST);
    if (!base || !tok || !root.fetch) return;
    if (pushTimer) { try { root.clearTimeout(pushTimer); } catch (_) {} }
    pushTimer = root.setTimeout(function () {
      try {
        root.fetch(base + '/api/entities/me/prefs/ui', { method: 'PATCH', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) }).catch(function () {});
      } catch (_) {}
    }, 400);
  }
  /** The server wins — that is the feature — EXCEPT when it has nothing (an empty object means "never chosen"). */
  function hydrate(prefs) {
    if (!prefs || typeof prefs !== 'object') return false;
    if (!prefs.theme && !prefs.fs && !prefs.motion && !prefs.stripes) return false;
    var changed = false;
    try {
      if (prefs.theme && (prefs.theme === 'device' || (has(THEMES, prefs.theme) && THEMES[prefs.theme])) && prefs.theme !== pref('theme')) { lsSet(KEY.theme, prefs.theme); changed = true; }
      if (prefs.fs && TEXT_SIZES.some(function (x) { return x[0] === prefs.fs; }) && prefs.fs !== pref('fs')) { lsSet(KEY.fs, prefs.fs); changed = true; }
      if (prefs.motion && ['auto', 'reduce', 'full'].indexOf(prefs.motion) >= 0 && prefs.motion !== pref('motion')) { lsSet(KEY.motion, prefs.motion); changed = true; }
      if (prefs.stripes && STRIPES.some(function (x) { return x[0] === prefs.stripes; }) && prefs.stripes !== pref('stripes')) { lsSet(KEY.stripes, prefs.stripes); changed = true; }
      if (changed) { apply(); repaint(); }
    } catch (_) {}
    return changed;
  }
  function pull(o) {
    var base = apiBaseOf(o), tok = tokenOf(o);
    if (!base || !tok || !root.fetch) return;
    try {
      root.fetch(base + '/api/entities/me', { cache: 'no-store', headers: { Authorization: 'Bearer ' + tok } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j) return;
          var d = (j && j.data) || j, e = (d && d.entity) || d || {};
          hydrate(e.ui_prefs);
        }).catch(function () {});
    } catch (_) {}
  }

  function set(kind, value) {
    if (!has(KEY, kind)) return;
    if (kind === 'theme' && value !== 'device' && !(has(THEMES, value) && THEMES[value])) return;
    if (kind === 'fs' && !TEXT_SIZES.some(function (x) { return x[0] === value; })) return;
    if (kind === 'font' && !FONTS.some(function (x) { return x[0] === value; })) return;
    if (kind === 'weight' && value !== 'normal' && value !== 'bold') return;
    if (kind === 'motion' && ['auto', 'reduce', 'full'].indexOf(value) < 0) return;
    if (kind === 'stripes' && !STRIPES.some(function (x) { return x[0] === value; })) return;
    lsSet(KEY[kind], value);
    apply();
    if (kind === 'theme' || kind === 'fs' || kind === 'motion' || kind === 'stripes') push();
    repaint();
  }

  /* ── the menu ── */
  var CSS =
    '.cbav{position:relative;display:inline-block;font-family:var(--f-ui,var(--font-ui,inherit));' +
    '--av-card:var(--card,#fff);--av-ink:var(--on-card,var(--ink,#1D1B16));--av-muted:var(--muted,var(--grey,#5E594D));' +
    '--av-faint:var(--faint,var(--grey,#5E594D));--av-line:var(--line,#DDD6C6);--av-soft:var(--line-soft,var(--line,#E6E0D2));' +
    '--av-page:var(--page,var(--paper,#FCFAF5));--av-panel:var(--panel,#F3EFE6);--av-blue:var(--blue,#2F74C9);' +
    '--av-blue-t:var(--blue-t,var(--blue-tint-bg,#E4EEFA));--av-blue-i:var(--blue-i,var(--blue-d,#174A87));' +
    '--av-shadow:var(--shadow,0 10px 28px rgba(0,0,0,.16));color:var(--av-ink);text-align:start}' +
    '.cbav *{box-sizing:border-box}' +
    '.cbav button,.cbav a{font:inherit;color:inherit;cursor:pointer}' +
    '.cbav-btn{width:34px;height:34px;border-radius:50%;border:1px solid var(--av-line);background:var(--av-card);color:var(--av-ink);font-weight:700;display:grid;place-items:center;padding:0;font-size:calc(14px * var(--k,1))}' +
    '.cbav-btn[aria-expanded="true"]{outline:2px solid var(--av-blue);outline-offset:1px}' +
    '.cbav-signin{display:inline-flex;align-items:center;height:34px;padding:0 15px;border-radius:9px;background:var(--green,#16693F);color:#fff;font-size:calc(13.5px * var(--k,1));font-weight:700;text-decoration:none}' +
    'button.cbav-signin{border:0;cursor:pointer;font-family:inherit}' +
    '.cbav-pop{position:absolute;inset-inline-end:0;top:calc(100% + 6px);z-index:1000;width:min(344px,calc(100vw - 32px));max-height:calc(100vh - 64px);overflow-y:auto;overscroll-behavior:contain;' +
    'padding:12px 14px;background:var(--av-card);color:var(--av-ink);border:1px solid var(--av-line);border-radius:12px;box-shadow:var(--av-shadow);font-size:calc(14px * var(--k,1));line-height:1.35}' +
    '.cbav-who{display:flex;gap:10px;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--av-soft)}' +
    '.cbav-who .l{width:40px;height:40px;border-radius:50%;border:1px solid var(--av-line);background:var(--av-panel);display:grid;place-items:center;font-weight:700;font-size:calc(16px * var(--k,1));flex:0 0 auto}' +
    '.cbav-who b{display:block;font-size:calc(14.5px * var(--k,1));overflow-wrap:anywhere}.cbav-who span{display:block;font-size:calc(12.5px * var(--k,1));color:var(--av-faint)}' +
    '.cbav-items{display:grid;gap:1px;padding:6px 0;border-bottom:1px solid var(--av-soft)}' +
    '.cbav-items.last{border-bottom:0;border-top:1px solid var(--av-soft);margin-top:8px}' +
    '.cbav-items button,.cbav-items a{display:flex;justify-content:space-between;align-items:center;text-align:start;border:0;background:none;border-radius:7px;padding:7px 8px;text-decoration:none;font-size:calc(14px * var(--k,1))}' +
    '.cbav-items button:hover,.cbav-items a:hover{background:var(--av-panel)}' +
    '.cbav h4{margin:10px 0 6px;font-size:calc(11px * var(--k,1));letter-spacing:.07em;text-transform:uppercase;color:var(--av-faint);font-weight:700}' +
    '.cbav-sw{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:4px 0 8px}' +
    '.cbav-sw button{display:grid;gap:3px;justify-items:center;border:1px solid transparent;background:none;border-radius:9px;padding:4px 2px;font-size:calc(10.5px * var(--k,1));color:var(--av-muted);line-height:1.15;text-align:center}' +
    '.cbav-sw .dot{width:28px;height:28px;border-radius:50%;border:1px solid var(--av-line);display:grid;grid-template-rows:1fr 1fr;overflow:hidden}' +
    '.cbav-sw button[aria-pressed="true"]{border-color:var(--av-blue);background:var(--av-blue-t);color:var(--av-blue-i);font-weight:600}' +
    '.cbav-sizes{display:flex;gap:4px;align-items:flex-end;margin:2px 0 6px}' +
    '.cbav-sizes button,.cbav-weights button{flex:1;border:1px solid var(--av-line);background:var(--av-card);border-radius:9px;display:grid;place-items:center;color:var(--av-ink);padding:0;font-family:inherit}' +
    '.cbav-sizes button{height:42px}.cbav-weights{display:flex;gap:4px;margin:0 0 8px}.cbav-weights button{height:36px;font-size:17px}' +
    '.cbav-sizes button[aria-pressed="true"],.cbav-weights button[aria-pressed="true"]{border-color:var(--av-blue);background:var(--av-blue-t);color:var(--av-blue-i)}' +
    '.cbav-motion{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 8px}' +
    '.cbav-toggle{width:40px;height:22px;border-radius:999px;border:1px solid var(--av-line);background:var(--av-panel);position:relative;padding:0}' +
    '.cbav-toggle::after{content:"";position:absolute;top:2px;inset-inline-start:2px;width:16px;height:16px;border-radius:50%;background:var(--av-faint);transition:inset-inline-start .15s}' +
    '.cbav-toggle[aria-checked="true"]{background:var(--av-blue-t);border-color:var(--av-blue)}' +
    '.cbav-toggle[aria-checked="true"]::after{inset-inline-start:20px;background:var(--av-blue)}' +
    '.cbav-fonts{display:grid;gap:2px}' +
    /* the menu NEVER cuts content: on a window wide enough it sets Appearance and Reading font side by side, so it is short; on a window still shorter than the menu it scrolls ITSELF (max-height above), never clipped */
    '.cbav-cols{display:block}.cbav-c>h4:first-child{margin-top:10px}' +
    '@media (min-width:600px){.cbav-pop{width:min(600px,calc(100vw - 32px))}.cbav-cols{display:grid;grid-template-columns:1fr 1fr;column-gap:18px}.cbav-c>h4:first-child{margin-top:8px}.cbav-items.last{margin-top:4px}.cbav-items{grid-template-columns:1fr 1fr;padding:4px 0}.cbav-items.last{padding:4px 0 0}.cbav-fonts button,.cbav-langs button{padding:3px 8px}.cbav-sizes button{height:36px}.cbav-weights button{height:32px}}' +
    '.cbav-fonts button,.cbav-langs button{display:flex;align-items:baseline;border:0;background:none;border-radius:7px;padding:5px 8px;text-align:start}' +
    '.cbav-fonts button[aria-pressed="true"],.cbav-langs button[aria-pressed="true"]{background:var(--av-blue-t);color:var(--av-blue-i);font-weight:600}' +
    '.cbav-langs{display:flex;flex-wrap:wrap;gap:2px}' +
    /* ⭐ A PAGE IN THE LIST STANDARD'S TOKEN NAMES (--page · --panel · --muted · --blue-t …; index, CB Accounts' lists, the Lab) says so with
       <html data-tokens="list">, and a chosen theme re-points those names at the theme's own tokens. The fallbacks ARE the page's original
       values, and Cream (no overrides, so no data-themed) is left alone, so a page that never chooses a theme is byte-for-byte what it was. */
    ':root[data-tokens="list"][data-themed]{--page:var(--paper,#FCFAF5);--panel:var(--gold-soft,#F3EFE6);--line-soft:var(--line,#E6E0D2);--hair:var(--gold-soft,#F0ECE2);' +
    '--muted:var(--grey,#5E594D);--faint:var(--grey-3,#8A8374);--ghost:var(--grey-4,#A8A295);--green:var(--ok,#16693F);--green-t:var(--ok-tint,#E8F4ED);--green-b:var(--ok-3,#A9D3BC);' +
    '--red:var(--disp,#C4562F);--red-t:var(--danger-tint,#FBEAE3);--red-b:var(--disp-2,#E7B9A8);--red-i:var(--disp-2,#8E3517);--amber-t:var(--warn-tint,#FDF3DC);--amber-i:var(--warn-2,#7A5205);' +
    '--blue-t:var(--blue-tint-bg,var(--blue-tint,#E4EEFA));--blue-b:var(--blue-tint-line,#B9D2EF);--blue-i:var(--blue-d,#174A87)}' +
    /* the two preferences every page honours, written once here so no page re-declares them */
    ':root[data-motion="reduce"] *,:root[data-motion="reduce"] *::before,:root[data-motion="reduce"] *::after{animation:none!important;transition:none!important}' +
    ':root[data-stripes="off"]{--zebra:transparent}' +
    ':root[data-stripes="light"]{--zebra:color-mix(in srgb,var(--ink,#1D1B16) 5%,var(--card,#FFFFFF))}' +
    '.cbav-stripes{display:flex;gap:4px;margin:0 0 8px}.cbav-stripes button{flex:1;height:34px;border:1px solid var(--av-line);background:var(--av-card);border-radius:9px;color:var(--av-ink);font-family:inherit;font-size:calc(12.5px * var(--k,1))}' +
    '.cbav-stripes button[aria-pressed="true"]{border-color:var(--av-blue);background:var(--av-blue-t);color:var(--av-blue-i);font-weight:600}' +
    ':root[data-weight="bold"] body{font-weight:600}' +
    ':root[data-weight="bold"] :where(button,input,select,textarea){font-weight:inherit}' +
    ':root[data-weight="bold"] body :is([style*="font-weight:400"],[style*="font-weight: 400"],[style*="font-weight:500"],[style*="font-weight: 500"]){font-weight:600}';

  function addCss() {
    if (!doc || doc.getElementById('cbav-css')) return;
    var s = doc.createElement('style'); s.id = 'cbav-css'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var M = null;                                             /* the mounted avatar: { el, o } — one per page */
  var openNow = false;

  function swatches() {
    var p = pref('theme');
    var dev = '<button type="button" data-testid="theme-device" data-av-theme="device" aria-pressed="' + (p === 'device') + '"><span class="dot"><i style="background:#FCFAF5"></i><i style="background:#15140F"></i></span>My device</button>';
    return dev + Object.keys(THEMES).map(function (k) {
      var t = THEMES[k], v = t.vars || {};
      return '<button type="button" data-testid="theme-' + esc(k) + '" data-av-theme="' + esc(k) + '" aria-pressed="' + (p === k) + '" title="' + esc(t.name) + '">' +
        '<span class="dot"><i style="background:' + esc(v['--paper'] || '#FAF8F4') + '"></i><i style="background:' + esc(v['--blue'] || '#3F66A6') + '"></i></span>' + esc(t.name) + '</button>';
    }).join('');
  }

  function menuHtml(o) {
    var P = o.person || {}, items = o.items || ['profile', 'settings', 'support', 'signout'];
    var showSettings = items.indexOf('settings') >= 0 && !!P.owner;
    var has_ = function (k) { return items.indexOf(k) >= 0; };
    var up = [], down = [];
    if (has_('profile')) up.push(o.onProfile
      ? '<button type="button" data-testid="nav-profile" data-av="profile">Profile</button>'
      : '<a data-testid="nav-profile" data-av="profile" href="' + esc(o.profileHref || PROFILE_HREF) + '">Profile<span aria-hidden="true">↗</span></a>');
    if (showSettings) up.push(o.onSettings
      ? '<button type="button" data-testid="nav-settings" data-av="settings">Settings</button>'
      : '<a data-testid="nav-settings" data-av="settings" href="' + esc(o.settingsHref || '/app.html#/app/settings') + '">Settings<span aria-hidden="true">↗</span></a>');
    if (has_('support')) down.push(o.onSupport
      ? '<button type="button" data-testid="av-support" data-av="support">Support</button>'
      : '<a data-testid="av-support" data-av="support" href="' + esc(o.supportHref || SUPPORT_HREF) + '">Support<span aria-hidden="true">↗</span></a>');
    if (has_('signout')) down.push('<button type="button" data-testid="nav-signout" data-av="signout">Sign out</button>');

    var fsNow = pref('fs'), w = pref('weight'), f = pref('font');
    var langs = '';
    if (o.languages && o.languages.list) {
      langs = '<h4>Language</h4><div class="cbav-langs" role="group" aria-label="Language" data-testid="lang-picker">' + Object.keys(o.languages.list).map(function (c) {
        return '<button type="button" data-testid="lang-' + esc(c) + '" data-av-lang="' + esc(c) + '" aria-pressed="' + (o.languages.current === c) + '">' + esc(o.languages.list[c]) + '</button>';
      }).join('') + '</div>';
    }
    return '<div class="cbav-pop" role="dialog" aria-label="Your menu" data-testid="avatar-menu">' +
      '<div class="cbav-who"><span class="l">' + esc(letter(P)) + '</span><div><b>' + esc(P.name || P.entity || '') + '</b><span>' + esc(P.role || '') + '</span></div></div>' +
      (up.length ? '<div class="cbav-items">' + up.join('') + '</div>' : '') +
      '<div class="cbav-cols"><div class="cbav-c"><h4>Appearance</h4><div class="cbav-sw" role="group" aria-label="Theme">' + swatches() + '</div>' +
      '<h4>Row stripes</h4><div class="cbav-stripes" role="group" aria-label="Row stripes" data-testid="stripes-group">' + STRIPES.map(function (x) {
        return '<button type="button" data-testid="stripes-' + x[0] + '" data-av-stripes="' + x[0] + '" aria-pressed="' + (pref('stripes') === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="cbav-c"><h4>Text size</h4><div class="cbav-sizes" role="group" aria-label="Text size">' + TEXT_SIZES.map(function (x, i) {
        return '<button type="button" data-testid="fs-' + x[0] + '" data-av-fs="' + x[0] + '" aria-pressed="' + (fsNow === x[0]) + '" title="' + x[1] + ' (' + Math.round(x[2] * 100) + '%)" aria-label="' + x[1] + '" style="font-size:' + [13, 16, 20, 25][i] + 'px">A</button>';
      }).join('') + '</div>' +
      '<div class="cbav-weights" role="group" aria-label="Text weight">' +
        '<button type="button" data-testid="weight-normal" data-av-weight="normal" aria-pressed="' + (w === 'normal') + '" title="Normal" aria-label="Normal text" style="font-weight:400">A</button>' +
        '<button type="button" data-testid="weight-bold" data-av-weight="bold" aria-pressed="' + (w === 'bold') + '" title="Bold" aria-label="Bold text" style="font-weight:800">A</button></div>' +
      '<div class="cbav-motion"><span>Less motion</span><button type="button" class="cbav-toggle" role="switch" data-testid="motion-switch" data-av-motion="1" aria-checked="' + (pref('motion') === 'reduce') + '" aria-label="Less motion"></button></div>' +
      '<h4>Reading font</h4><div class="cbav-fonts" role="group" aria-label="Font">' + FONTS.map(function (x) {
        return '<button type="button" data-testid="font-' + x[0] + '" data-av-font="' + x[0] + '" aria-pressed="' + (f === x[0]) + '" style="font-family:' + esc(x[2]) + '">' + x[1] + '</button>';
      }).join('') + '</div>' + langs + '</div></div>' +
      (down.length ? '<div class="cbav-items last">' + down.join('') + '</div>' : '') +
      '</div>';
  }
  function letter(P) { return String(P.name || P.entity || '?').trim().slice(0, 1).toUpperCase() || '?'; }

  function paint() {
    if (!M || !M.el) return;
    var o = M.o, P = o.person, el = M.el, keepTop = 0, pop = el.querySelector('.cbav-pop'), focusKey = null;
    if (pop) keepTop = pop.scrollTop;
    try { var ae = doc.activeElement; if (ae && el.contains(ae)) focusKey = ae.getAttribute('data-testid'); } catch (_) {}
    if (!P) {
      /* ⭐ M14: a page that mounts CBSignin (index · CB Accounts · CB CRM) gives onSignIn — the door opens the one sign-in window IN PLACE.
         Without it the door is a link to the INDEX, the front door (Athi 2026-10-09: a customer never lands in the workshop's #/login). */
      el.innerHTML = typeof o.onSignIn === 'function'
        ? '<span class="cbav"><button type="button" class="cbav-signin" data-testid="signin-door" data-av="signin">Sign in</button></span>'
        : '<span class="cbav"><a class="cbav-signin" data-testid="signin-door" href="' + esc(o.signInHref || '/') + '">Sign in</a></span>';
      return;
    }
    var label = (P.entity || P.name || 'You') + ': your menu';
    el.innerHTML = '<span class="cbav" data-testid="cbavatar"><button type="button" class="cbav-btn" data-testid="' + esc(o.testid || 'avatar') + '" aria-haspopup="dialog" aria-expanded="' + openNow + '" aria-label="' + esc(label) + '" title="' + esc(P.entity || P.name || '') + '">' + esc(letter(P)) + '</button>' + (openNow ? menuHtml(o) : '') + '</span>';
    var np = el.querySelector('.cbav-pop'); if (np) { fit(np); np.scrollTop = keepTop; }
    if (focusKey) { var f2 = el.querySelector('[data-testid="' + focusKey + '"]'); if (f2) { try { f2.focus({ preventScroll: true }); } catch (_) {} } }
  }
  /** the menu may be as tall as the room BELOW the button, never more: it scrolls itself only when the window is shorter than the menu, and nothing is cut */
  function fit(pop) {
    try { pop = pop || (M && M.el && M.el.querySelector('.cbav-pop')); if (!pop) return; pop.style.maxHeight = ''; var r = pop.getBoundingClientRect(), h = root.innerHeight || doc.documentElement.clientHeight; pop.style.maxHeight = Math.max(160, Math.floor(h - r.top - 8)) + 'px'; } catch (_) {}
  }
  function repaint() { if (M) paint(); }
  function close() { if (!openNow) return; openNow = false; paint(); }

  function signOut() {
    var o = (M && M.o) || {};
    openNow = false;
    if (typeof o.onSignOut === 'function') return o.onSignOut();
    /* the app's sign-out (logoutNow) for a page that has no app behind it: the session and the per-person nav memory go; every other tab hears cb_sess go */
    try {
      root.localStorage.removeItem('cb_sess');
      Object.keys(root.localStorage).filter(function (k) { return /^cb_nav(@|$)/.test(k); }).forEach(function (k) { root.localStorage.removeItem(k); });
    } catch (_) {}
    root.location.href = o.signInHref || '/';
  }

  var wired = false;
  function wire() {
    if (wired || !doc) return; wired = true;
    if (root.addEventListener) root.addEventListener('resize', function () { if (openNow) fit(); });
    doc.addEventListener('click', function (e) {
      if (!M || !M.el) return;
      var t = e.target; if (!t || !t.closest) return;
      if (!M.el.contains(t)) { if (openNow) close(); return; }
      var o = M.o, b;
      if ((b = t.closest('.cbav-btn'))) { openNow = !openNow; paint(); return; }
      if ((b = t.closest('[data-av-theme]'))) return set('theme', b.getAttribute('data-av-theme'));
      if ((b = t.closest('[data-av-fs]'))) return set('fs', b.getAttribute('data-av-fs'));
      if ((b = t.closest('[data-av-weight]'))) return set('weight', b.getAttribute('data-av-weight'));
      if ((b = t.closest('[data-av-stripes]'))) return set('stripes', b.getAttribute('data-av-stripes'));
      if ((b = t.closest('[data-av-font]'))) return set('font', b.getAttribute('data-av-font'));
      if ((b = t.closest('[data-av-motion]'))) return set('motion', pref('motion') === 'reduce' ? 'auto' : 'reduce');
      if ((b = t.closest('[data-av-lang]'))) { var c = b.getAttribute('data-av-lang'); if (o.languages && o.languages.onPick) o.languages.onPick(c); return; }
      if ((b = t.closest('[data-av]'))) {
        var k = b.getAttribute('data-av');
        if (k === 'signout') { e.preventDefault(); return signOut(); }
        if (k === 'signin' && typeof o.onSignIn === 'function') { e.preventDefault(); return o.onSignIn(); }
        if (k === 'profile' && o.onProfile) { e.preventDefault(); openNow = false; paint(); return o.onProfile(); }
        if (k === 'settings' && o.onSettings) { e.preventDefault(); openNow = false; paint(); return o.onSettings(); }
        if (k === 'support' && o.onSupport) { e.preventDefault(); openNow = false; paint(); return o.onSupport(); }
      }
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openNow) {
        close(); var btn = M && M.el && M.el.querySelector('.cbav-btn'); if (btn) { try { btn.focus(); } catch (_) {} }
      }
    });
    /* another tab changed the look: follow it (the storage event never fires in the tab that wrote) */
    root.addEventListener('storage', function (e) {
      if (e.key === null || /^cb_(theme|font|fs|weight|motion|stripes)$/.test(e.key)) { apply(); repaint(); }
    });
  }

  /**
   * mount(el, o)
   *   person   { name, role, entity, owner } | null     null draws "Sign in"
   *   items    ['profile','settings','support','signout']   the page's choice; Settings also needs person.owner
   *   onProfile · onSettings · onSupport · onSignOut     a page that has the screen in place; otherwise a link into the app
   *   languages { list:{code:name}, current, onPick }    the app only: it has no other door to its language
   *   testid   the button's data-testid (default `avatar`)      signInHref · apiBase · token
   *   sync:false  no server at all (the counter offline)      pull:false  the host reads /me itself and calls hydrate()
   */
  function mount(el, o) {
    if (!el) return null;
    o = o || {};
    addCss();
    HOST = { apiBase: o.apiBase, token: o.token, sync: o.sync, viaPrefs: o.viaPrefs };
    var first = !M || M.el !== el;
    M = { el: el, o: o };
    apply();                                                 /* the base may only now be readable (the page's stylesheet is parsed) */
    wire(); paint();
    if (first && o.person && o.sync !== false && o.pull !== false) pull(o);
    return { update: function (p) { M.o.person = p; paint(); }, close: close, el: el };
  }

  /** Every themed token's UNTHEMED value — taken with the saved theme lifted off, so a preview card can draw theme X while Y is active. */
  function themeBase() {
    var out = {}, r = doc.documentElement, all = {}, saved = {}, cs = null;
    Object.keys(THEMES).forEach(function (k) { Object.keys(THEMES[k].vars || {}).forEach(function (v) { all[v] = 1; }); });
    try { cs = root.getComputedStyle(r); } catch (_) {}
    Object.keys(all).forEach(function (v) { saved[v] = r.style.getPropertyValue(v); if (saved[v]) r.style.removeProperty(v); });
    Object.keys(all).forEach(function (v) { out[v] = cs ? (cs.getPropertyValue(v) || '').trim() : ''; });
    Object.keys(saved).forEach(function (v) { if (saved[v]) r.style.setProperty(v, saved[v]); });
    return out;
  }

  /** A saved session (cb_sess) or the app's SESSION → the `person` the menu wants. Owner = the shop's own session (routes/books.js isOwner). */
  function personOf(s) {
    if (!s || typeof s !== 'object') return null;
    var r = s.role, label = r === 'entity' ? 'Owner' : r === 'actor' ? 'Co-assist' : r === 'customer' ? 'Customer' : (r || '');
    return { name: s.name || '', role: label + (s.entity ? ' · ' + s.entity : ''), entity: s.entity || '', owner: r === 'entity', token: s.token || '' };
  }
  function sessionPerson() { try { var s = JSON.parse(root.localStorage.getItem('cb_sess') || 'null'); return s && s.token ? personOf(s) : null; } catch (_) { return null; } }

  /* before first paint, from local storage alone — no network, no mount needed (a page with no menu still wears the look) */
  apply();
  if (doc && doc.addEventListener) doc.addEventListener('DOMContentLoaded', function () { BASE = null; apply(); });

  root.CBAvatar = { mount: mount, apply: apply, hydrate: hydrate, set: set, get: get, personOf: personOf, sessionPerson: sessionPerson, themeKey: themeKey, applyTheme: themeApply, push: push, themeBase: themeBase, isOpen: function () { return openNow; }, close: close, signOut: signOut,
    THEMES: THEMES, FONTS: FONTS, TEXT_SIZES: TEXT_SIZES, FS_BASE: FS_BASE, fontStack: fontStack };
})(typeof window !== 'undefined' ? window : this);
