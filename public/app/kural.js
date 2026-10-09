/**
 * ── ⭐ CBKural — THE KURAL FOOTER, ONE UNIT EVERY CB PAGE MOUNTS ─────────────────────────────────────────────────────
 *
 * Athi, 2026-10-03 (docs/design/ledgers-page/CLOUD-TASK.md): the kural footer IS part of the frozen look, on every CB page, built as
 * ONE unit — like CBAvatar, one mount, so every page gets it the same way. Read docs/design/ledgers-page/README.md "The kural footer".
 *
 *   CBKural.mount({ route })   draw the band for a route of docs/design/kural-kit/kurals.json (public/app/kurals.json is its copy;
 *                              e2e/kural-footer.cjs proves they are the same file); no route, or no verse for it → nothing is drawn
 *   CBKural.set(route)         a page whose screens change (CB Accounts' views, the open ledger) says which kural now
 *   CBKural.lead('ta'|'en')    which line leads (the setting `kural.lang`); the Tamil couplet ALWAYS shows, only the lead moves
 *
 * THE RULES IT KEEPS (they are here, once, so no page can forget one):
 *  · ONE band at the foot of the page, OUTSIDE the three-row head — it takes `--cbk-h` off the window (pages size their shell with
 *    calc(100vh - var(--cbk-h,0px))), so only the rows scroll and the head's 20% / 30% is untouched.
 *  · The original couplet + the ENGLISH translation. NO Tamil prose meaning, no transcription: the `meaning.ta` slot stays empty and is
 *    never shown. Another language comes from `meaning.<lang>` when the kit has it, else English.
 *  · By space: wide (> 1100 px) side by side · 641–1100 the meaning below the verse · a phone (≤ 640) the two TAKE TURNS in one
 *    place every 7 s, a tap switches; with Less motion (the avatar's switch, or the device's) it changes only on a tap.
 *  · ✕ puts it away until tomorrow (`kural.hidden` = today's date); it comes back as one small `குறள் N ›` line.
 *  · NEVER beside a warning (an amber / red chip, an alert, a bad card), NEVER in a dialog — the band is not drawn while one is
 *    on screen — and NEVER inside an outgoing customer message: the footer is a sibling of the page, never a part of any composer,
 *    and nothing here writes a verse into a message (e2e/kural-footer.cjs checks the composer).
 *  · Tokens only (--panel, --hair, --line, --ink, --muted, --faint), so it reads in all 16 themes. Never amber, never blue, no italic.
 *  · The verse is Noto Serif Tamil (loaded once from Google Fonts); a line breaks only at its middle, the rest indented.
 *
 * ONE FILE, ONE GLOBAL. Nothing is read from the page except the document and (optionally) CBLocale.lang().
 */
(function (root) {
  'use strict';
  if (root.CBKural) return;
  var doc = root.document;

  var DATA = null, LOADING = null, ROUTE = '', LEAD = 'ta', LANG = 'en', HOST = null, EL = null, TIMER = null, SECOND = false, PAUSED = false, OBS = null, BLOCKED = false;
  var SRC = '/app/kurals.json';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (_) {} }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function hiddenToday() { return lsGet('kural.hidden') === today(); }

  var CSS = [
    '.cbk{--k-panel:var(--panel,#F3EFE6);--k-hair:var(--hair,#F0ECE2);--k-line:var(--line,#DDD6C6);--k-ink:var(--ink,#1D1B16);--k-muted:var(--muted,#5E594D);--k-faint:var(--faint,#8A8374);--k-page:var(--page,#FCFAF5);',
    'container-type:inline-size;container-name:cbk;flex:0 0 auto;display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:4px 14px;box-sizing:border-box;width:100%;',
    'padding:10px 16px 10px 20px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--k-line);color:var(--k-ink);',
    'background:repeating-linear-gradient(0deg,var(--k-hair) 0 1px,transparent 1px 6px),var(--k-panel);font-family:var(--f-ui,"IBM Plex Sans","Segoe UI",system-ui,sans-serif);line-height:1.45;text-align:start}',
    '.cbk[hidden]{display:none}',
    '.cbk *,.cbk *::before,.cbk *::after{box-sizing:border-box}',
    '.cbk button{font:inherit;color:inherit;cursor:pointer}',
    '.cbk .cbk-seal{width:34px;height:34px;color:var(--k-muted);fill:currentColor;stroke:none}',
    '.cbk .cbk-seal circle:first-child{fill:none;stroke:currentColor}',
    '.cbk .cbk-body{background:none;border:0;padding:0;text-align:start;color:inherit;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 22px;min-width:0;cursor:default}',
    '.cbk .cbk-v{font:600 calc(16px * var(--k,1))/1.55 "Noto Serif Tamil","Noto Sans Tamil",var(--f-ui,system-ui),sans-serif;color:var(--k-ink)}',
    '.cbk .cbk-v .cbk-ln{display:block;padding-inline-start:1.2em;text-indent:-1.2em}',
    '.cbk .cbk-v .cbk-h{white-space:nowrap}',
    '.cbk .cbk-m{font-size:calc(15px * var(--k,1));line-height:1.45;color:var(--k-muted);max-width:48ch;min-width:0}',
    '.cbk.k-ta .cbk-m{padding-inline-start:22px;border-inline-start:1px solid var(--k-line)}',
    '.cbk.k-en .cbk-m{color:var(--k-ink);font-weight:600;padding-inline-end:22px;border-inline-end:1px solid var(--k-line)}',
    '.cbk.k-en .cbk-v{font-weight:500;font-size:calc(14.5px * var(--k,1));color:var(--k-muted)}',
    '.cbk .cbk-no{font:calc(12.5px * var(--k,1)) var(--f-num,"IBM Plex Mono",ui-monospace,monospace);color:var(--k-muted);white-space:nowrap}',
    '.cbk .cbk-x{width:34px;height:34px;border:0;background:none;border-radius:9px;color:var(--k-muted);padding:0}',
    '.cbk .cbk-x:hover{background:var(--k-page);color:var(--k-ink)}',
    '.cbk:focus-within,.cbk .cbk-x:focus-visible,.cbk .cbk-show:focus-visible,.cbk .cbk-body:focus-visible{outline:2px solid var(--blue,#2F74C9);outline-offset:-2px}',
    '.cbk.off{display:flex;justify-content:flex-end;padding-block:6px;background:var(--k-page)}',
    '.cbk .cbk-show{border:1px dashed var(--k-line);background:none;border-radius:999px;padding:3px 12px;color:var(--k-muted);font:calc(12.5px * var(--k,1)) var(--f-num,"IBM Plex Mono",ui-monospace,monospace);min-height:34px}',
    /* not enough width for side by side: the meaning goes below the verse */
    '@container cbk (max-width:1100px){.cbk .cbk-body{flex-direction:column;align-items:center;text-align:center;gap:4px}.cbk .cbk-v .cbk-ln{padding:0;text-indent:0}.cbk.k-ta .cbk-m,.cbk.k-en .cbk-m{padding:0;border:0}}',
    /* a phone: verse and meaning take turns in one place (both in one grid cell, so the band never jumps); a tap switches */
    '@container cbk (max-width:640px){',
    '.cbk{grid-template-columns:auto minmax(0,1fr) auto;gap:2px 10px;padding:8px 6px 8px 16px;padding-bottom:calc(8px + env(safe-area-inset-bottom,0px))}',
    '.cbk .cbk-seal{width:30px;height:30px}',
    '.cbk .cbk-body{display:grid;cursor:pointer;min-height:44px;justify-content:start;text-align:start}',
    '.cbk .cbk-v .cbk-ln{padding-inline-start:1.2em;text-indent:-1.2em}',
    '.cbk .cbk-body > *{grid-area:1/1;transition:opacity .5s ease;align-self:center}',
    '.cbk .cbk-v{font-size:calc(15px * var(--k,1))}',
    '.cbk .cbk-m{font-size:calc(14.5px * var(--k,1));color:var(--k-ink);max-width:none;padding:0;border:0}',
    '.cbk.k-en .cbk-v{font-size:calc(15px * var(--k,1));font-weight:600;color:var(--k-ink)}',
    '.cbk.k-ta .cbk-m,.cbk.k-en .cbk-v{opacity:0}',
    '.cbk.k-ta.second .cbk-v,.cbk.k-en.second .cbk-m{opacity:0}',
    '.cbk.k-ta.second .cbk-m,.cbk.k-en.second .cbk-v{opacity:1}',
    '.cbk .cbk-no{grid-column:2;grid-row:2;font-size:calc(11.5px * var(--k,1))}',
    '.cbk .cbk-x{grid-column:3;grid-row:1/3;width:44px;height:44px}',
    '.cbk .cbk-show{min-height:44px}',
    '}',
    '@media (prefers-reduced-motion:reduce){.cbk .cbk-body > *{transition:none}}',
    'html[data-motion="reduce"] .cbk .cbk-body > *{transition:none}',
  ].join('\n');

  function css() {
    if (!doc || doc.getElementById('cbk_css')) return;
    var s = doc.createElement('style'); s.id = 'cbk_css'; s.textContent = CSS; doc.head.appendChild(s);
    /* Noto Serif Tamil — the verse's face (a font the standard adds); a page that cannot reach it falls back to Noto Sans Tamil / the system's */
    if (!doc.getElementById('cbk_font')) {
      var l = doc.createElement('link'); l.id = 'cbk_font'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+Tamil:wght@500;600;700&display=swap'; doc.head.appendChild(l);
    }
  }

  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (LOADING) return LOADING;
    LOADING = root.fetch(SRC, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { DATA = j && j.kurals ? j : { kurals: [], excluded: [] }; return DATA; }, function () { DATA = { kurals: [], excluded: [] }; return DATA; });
    return LOADING;
  }
  /** a route's kural; the kit's `excluded` list (552) can never be returned */
  function find(route) {
    if (!DATA || !route) return null;
    var bad = (DATA.excluded || []).map(function (x) { return x.no; }), k = null;
    (DATA.kurals || []).forEach(function (x) { if (!k && x.route === route && bad.indexOf(x.no) < 0) k = x; });
    return k;
  }
  /** the app's language, when the page has one; Tamil and everything unlisted read the English line (the `meaning.ta` slot stays empty by decision) */
  function lang() {
    var l = ''; try { l = String((root.CBLocale && root.CBLocale.lang && root.CBLocale.lang()) || doc.documentElement.lang || 'en').toLowerCase().slice(0, 2); } catch (_) { l = 'en'; }
    return l;
  }
  function meaning(k) {
    var l = lang(), m = k.meaning || {};
    if (l && l !== 'ta' && l !== 'en' && m[l]) return { text: m[l], lang: l };
    return { text: m.en || '', lang: 'en' };
  }
  /** a line breaks only at its middle, the rest indented — the browser never breaks a couplet at random */
  function kline(s) { var w = String(s).split(' '), m = Math.ceil(w.length / 2); return '<span class="cbk-ln"><span class="cbk-h">' + esc(w.slice(0, m).join(' ')) + '</span> <span class="cbk-h">' + esc(w.slice(m).join(' ')) + '</span></span>'; }
  var SEAL = '<svg class="cbk-seal" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" stroke-width="2.5"/><ellipse cx="32" cy="13" rx="4.4" ry="3.6"/><circle cx="32" cy="22" r="6.4"/><path d="M25.8 23.5Q26 33 32 38.5Q38 33 38.2 23.5Q32 27 25.8 23.5Z"/><path d="M15.5 54Q16.5 41 26 36.8L32 40L38 36.8Q47.5 41 48.5 54Z"/></svg>';

  /** what is on screen that the band must not sit beside: a warning, an alert, a bad card, a dialog */
  var HEAD_SEL = "header,.bar,.topbar,.titlerow,.cbl-title,.cbsh-hdr,[role=banner]";
  var BLOCK_SEL = '.cbl-chip.warn,.cbl-chip.bad,[role="alert"],.card.bad,.pe-bad,.pe-warn,dialog[open],.modalback,#modal.on';
  function blockedNow() {
    var list = doc.querySelectorAll(BLOCK_SEL);
    for (var i = 0; i < list.length; i++) { var e = list[i]; if (EL && EL.contains(e)) continue; if (e.offsetWidth || e.offsetHeight || e.getClientRects().length) return true; }
    return false;
  }
  function touch() {
    if (!EL) return;
    var h = EL.hidden ? 0 : EL.offsetHeight;
    doc.documentElement.style.setProperty('--cbk-h', h + 'px');
  }

  function paint() {
    if (!doc) return;
    css();
    if (!EL) {
      EL = doc.createElement('footer'); EL.id = 'cbkural'; EL.className = 'cbk'; EL.setAttribute('data-testid', 'kural-footer'); EL.setAttribute('aria-label', 'Thirukkural');
      (HOST || doc.body).appendChild(EL);
      EL.addEventListener('click', onClick); EL.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-kswap]')) { e.preventDefault(); swap(); } });
    }
    clearInterval(TIMER); TIMER = null;
    /* ONE place: the band is never a part of a header, a bar or a title row, whoever mounted it or moved it there (Round U, 2026-10-09) */
    if (EL.closest(HEAD_SEL)) (HOST && !HOST.closest(HEAD_SEL) ? HOST : doc.body).appendChild(EL);
    var k = find(ROUTE);
    BLOCKED = blockedNow();
    if (!k || BLOCKED) { EL.hidden = true; EL.innerHTML = ''; EL.removeAttribute('data-kural'); touch(); return; }
    EL.hidden = false; EL.setAttribute('data-kural', String(k.no));
    if (hiddenToday()) {
      EL.className = 'cbk off'; EL.innerHTML = '<button type="button" class="cbk-show" data-kshow="1" data-testid="kural-show" aria-label="Show the kural">குறள் ' + k.no + ' ›</button>'; touch(); return;
    }
    var m = meaning(k), verse = '<span class="cbk-v" lang="ta" data-testid="kural-verse">' + kline(k.verse[0]) + kline(k.verse[1]) + '</span>',
      mean = '<span class="cbk-m" lang="' + esc(m.lang) + '" data-testid="kural-meaning">' + esc(m.text) + '</span>';
    EL.className = 'cbk k-' + LEAD + (SECOND ? ' second' : '');
    EL.innerHTML = SEAL + '<div class="cbk-body" data-kswap="1" data-testid="kural-body">' + (LEAD === 'ta' ? verse + mean : mean + verse) + '</div>'
      + '<span class="cbk-no" data-testid="kural-no">குறள் ' + k.no + '</span>'
      + '<button type="button" class="cbk-x" data-khide="1" data-testid="kural-hide" aria-label="Hide the kural for today" title="Hide for today">✕</button>';
    var phone = EL.clientWidth > 0 && EL.clientWidth <= 640, body = EL.querySelector('.cbk-body');
    if (phone) { body.setAttribute('role', 'button'); body.setAttribute('tabindex', '0'); body.setAttribute('aria-label', 'Thirukkural ' + k.no + '. Tap to switch the verse and its meaning'); }
    if (phone && !still() && !PAUSED) TIMER = setInterval(function () { SECOND = !SECOND; EL && EL.classList.toggle('second', SECOND); }, 7000);
    touch();
  }
  function still() {
    try { return doc.documentElement.getAttribute('data-motion') === 'reduce' || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
  }
  function swap() { if (!EL || !EL.clientWidth || EL.clientWidth > 640) return; PAUSED = true; clearInterval(TIMER); TIMER = null; SECOND = !SECOND; EL.classList.toggle('second', SECOND); }
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-kswap],[data-khide],[data-kshow]') : null; if (!t) return;
    if (t.hasAttribute('data-khide')) { lsSet('kural.hidden', today()); paint(); var s = EL.querySelector('[data-kshow]'); if (s) s.focus(); return; }
    if (t.hasAttribute('data-kshow')) { lsSet('kural.hidden', ''); paint(); return; }
    swap();
  }

  /* the band re-asks whether it may be drawn when the page changes (a warning appears, a dialog opens); it never watches itself */
  var QUEUED = false;
  function watch() {
    if (OBS || !root.MutationObserver) return;
    OBS = new root.MutationObserver(function (list) {
      if (QUEUED) return;
      var mine = list.every(function (m) { return EL && EL.contains(m.target); }); if (mine) return;
      QUEUED = true; (root.requestAnimationFrame || root.setTimeout)(function () { QUEUED = false; var b = blockedNow(); if (b !== BLOCKED) paint(); else touch(); });
    });
    OBS.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'open', 'style'] });
    root.addEventListener('resize', function () { if (EL && !EL.hidden) { var was = EL.clientWidth <= 640; (root.requestAnimationFrame || root.setTimeout)(function () { if (EL && (EL.clientWidth <= 640) !== was) paint(); else touch(); }); } });
  }

  root.CBKural = {
    mount: function (o) {
      o = o || {}; HOST = o.host || null; if (o.lead) LEAD = o.lead; else { var s = lsGet('kural.lang'); if (s === 'en' || s === 'ta') LEAD = s; }
      ROUTE = o.route || ROUTE; LANG = lang(); watch();
      return load().then(function () { paint(); return root.CBKural; });
    },
    set: function (route) { ROUTE = route || ''; SECOND = false; PAUSED = false; return load().then(function () { paint(); }); },
    lead: function (l) { if (l !== 'ta' && l !== 'en') return; LEAD = l; lsSet('kural.lang', l); paint(); },
    route: function () { return ROUTE; },
    refresh: function () { paint(); },
    el: function () { return EL; },
  };
})(typeof window !== 'undefined' ? window : this);
