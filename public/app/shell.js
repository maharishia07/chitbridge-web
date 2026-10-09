/**
 * ── ⭐ CBShell — THE FRAME EVERY UTILITY APP LIVES IN: HEADER · SHEET · FIVE AREAS · KURAL ──────────────────────────────────────
 *
 * Plan row N17 (C:\dev\FIT-shell-enterprise-2026-10-07.md row 93, decisions §D Q1–Q10). The design is
 * C:\dev\designs-inbox\cb-shell-2026-10-07\cb-shell.html (the prototype wins over its spec); the manifest shape is
 * docs/DESIGN-NOTES-2026-10.md Part 2.4. public/shell-lab.html is this file on a bare page (the pass mark); e2e/shell.cjs proves it.
 *
 *   CBShell.mount(el, { manifest, area, host, person, apiBase, token, avatar, kural, homeHref }) → shell
 *     manifest  an object { entries:[…] } or its URL (default /app/manifest.json)
 *     area      home · selling · running · labs · setup — the area shown first (Home: also read from location.hash)
 *     host      null            → HOME: the five areas, a side rail (a phone: bottom tabs, one area at a time)
 *               { app: 'id' }   → INSIDE AN APP: the rail collapses to a switcher in the bar; the app draws in shell.slots.work
 *               { bar: true }   → THE BAR ONLY (the counter, the vendor page): mark · shop · licence · bell · avatar, nothing else
 *     person    { name, role, entity, owner } (default: CBAvatar.sessionPerson()); null = signed out
 *     apiBase · token   where /api lives, and the bearer (default: CBShell.apiBase() and the saved session's token)
 *     avatar    extra options passed straight to CBAvatar.mount (items, onSignOut, …)
 *     kural     the CBKural route (default 'planning'); false = no kural
 *     homeHref  where the switcher's areas point (default '/'; an area is homeHref + '#' + area)
 *   shell.slots { bell, alerts, home, work } · shell.open() · .close() · .isOpen() · .go(area) · .area() · .header() · .manifest() · .ready (Promise)
 *
 * WHAT IT READS: the manifest, GET /api/entities/header (N19: { business, licences[], trade_ready }) and each built entry's `facts`
 * URL. Nothing else. A 404 or a failure is an EMPTY STATE that says so — never a made-up number.
 * WHAT IT NEVER DOES: load an application's script (only the units CBAvatar · CBKural · CBSignin · CBBell, each IF the page loaded
 * it); link into the workshop (a card with no utility page is a dashed chip, I12); decide a licence band or a penalty (the server's
 * `band` and `note` say it — a scheme rule in data, Q8); add a packaging word the plan dropped (FIT Q5).
 *
 * ONE FILE, ONE GLOBAL, its own CSS (tokens with fallbacks, so it reads in all 16 themes), words and escaping — like CBList / CBAvatar.
 * THE AVATAR IS CBAvatar, mounted, never rebuilt (DECISIONS.md "The avatar is ONE control").
 */
(function (root) {
  'use strict';
  if (root.CBShell) return;
  var doc = root.document;

  var W = {
    areas: { home: 'Home', selling: 'Selling', running: 'Running', labs: 'Labs', setup: 'Setup' },
    caption: { selling: 'CB Commerce', running: 'Running it', labs: 'Labs', setup: 'What it all stands on' },
    sub: { labs: 'Work the number out first. Nothing changes until you say so.', setup: 'Set once, rarely touched.' },
    tag: { coming: 'later', workshop: 'workshop' },
    yourShop: 'Your shop', business: 'The business', licences: 'Licences', trade: 'Trade ready', finish: 'Finish the checks',
    renew: 'Renew', again: 'Apply again', notAdded: 'not added', registered: 'registered', notRegistered: 'not registered',
    days: ' days', years: ' years', expired: function (d) { return 'expired ' + d + 'd ago'; }, lapsed: 'lapsed',
    notYet: 'Licences and trade checks are not available yet.', loading: '…', noApps: 'The list of apps could not be read.',
    factsFailed: 'Could not read', switcher: 'Go to', close: 'Close'
  };
  /* CB Commerce: one box per pillar. The main row sits in the Selling section, the supporting row in the Running section; a manifest entry's `pillar` decides its box (none: its area's default) */
  var PILLARS = { selling: ['marketing', 'sales', 'finance', 'accounting'], running: ['operations', 'people', 'trade'] };
  var PNAME = { marketing: 'Marketing', sales: 'Sales', finance: 'Finance', accounting: 'Accounting', operations: 'Operations', people: 'People', trade: 'Trade' };
  var PDEFAULT = { selling: 'sales', running: 'accounting', labs: 'labs', setup: 'setup' };
  var AREAS = ['home', 'selling', 'running', 'labs', 'setup'];
  var ICON = { home: '⌂', selling: '▤', running: '₹', labs: '◈', setup: '⚙' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (_) { return null; } }

  /** the API base, decided the way the pages decide it (CFG.API_BASE) — here once, so a page that mounts the shell need not copy it */
  function apiBase() {
    var f = lsGet('cb_api_base');
    if (f) return f === 'stage' ? 'https://chitbridge-api-production.up.railway.app' : f;
    var h = root.location && root.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
    return 'https://chitbridge-api-production.up.railway.app';
  }
  function session() { try { var s = JSON.parse(lsGet('cb_sess') || 'null'); return s && s.token ? s : null; } catch (_) { return null; } }

  /* ── CSS: the prototype's, prefixed, on private tokens that fall back list names → theme names → the design's values ── */
  var CSS = [
    '.cbsh{--sh-page:var(--page,var(--paper,#FCFAF5));--sh-card:var(--card,#FFFFFF);--sh-panel:var(--panel,var(--gold-soft,#F3EFE6));',
    '--sh-line:var(--line,#DDD6C6);--sh-soft:var(--line-soft,var(--line,#E6E0D2));--sh-hair:var(--hair,var(--gold-soft,#F0ECE2));',
    '--sh-ink:var(--ink,#1D1B16);--sh-muted:var(--muted,var(--grey,#5E594D));--sh-ghost:var(--ghost,var(--grey-4,#A8A295));',
    '--sh-green:var(--green,var(--ok,#16693F));--sh-green-d:var(--green-d,var(--ok-2,#0D4A2B));--sh-green-t:var(--green-t,var(--ok-tint,#E8F4ED));--sh-green-b:var(--green-b,var(--ok-3,#A9D3BC));',
    '--sh-amber-t:var(--amber-t,var(--warn-tint,#FDF3DC));--sh-amber-b:var(--amber-b,var(--warn-3,#EFD39A));--sh-amber-i:var(--amber-i,var(--warn-2,#7A5205));',
    '--sh-red-t:var(--red-t,var(--danger-tint,#FBEAE3));--sh-red-b:var(--red-b,var(--disp-2,#E7B9A8));--sh-red-i:var(--red-i,var(--disp-2,#8E3517));',
    '--sh-blue-t:var(--blue-t,var(--blue-tint-bg,#E4EEFA));--sh-blue-b:var(--blue-b,var(--blue-tint-line,#B9D2EF));--sh-blue-i:var(--blue-i,var(--blue-d,#174A87));',
    '--sh-on:var(--on-accent,#FFFFFF);--sh-scrim:rgba(29,27,22,.32);--sh-shadow:rgba(29,27,22,.18);--sh-hover:rgba(0,0,0,.04);',
    '--sh-bar:44px;--sh-navw:58px;',
    'box-sizing:border-box;color:var(--sh-ink);font-family:var(--f-ui,"IBM Plex Sans",system-ui,sans-serif);font-size:calc(14.5px * var(--k,1));line-height:1.42;text-align:start}',
    ':root[data-themed] .cbsh{--sh-green-d:color-mix(in srgb,var(--ok-2,#0D4A2B) 80%,var(--ink,#1D1B16))}',
    '.cbsh *,.cbsh *::before,.cbsh *::after{box-sizing:border-box}',
    ':where(.cbsh) :where(button,a){font:inherit;color:inherit}:where(.cbsh) :where(button){cursor:pointer}:where(.cbsh) :where(a){text-decoration:none}',
    '.cbsh.full{position:fixed;inset:0;display:flex;flex-direction:column;background:var(--sh-page);z-index:1}',
    /* header */
    '.cbsh-hdr{flex:0 0 auto;position:relative;z-index:20;background:var(--sh-card);border-bottom:1px solid var(--sh-line)}',
    '.cbsh-bar{height:var(--sh-bar);display:flex;align-items:center;gap:10px;padding:0 14px}',
    '.cbsh-mark{width:28px;height:28px;border-radius:8px;background:var(--sh-green);color:var(--sh-on);display:grid;place-items:center;font-size:13px;font-weight:700;flex:0 0 auto}',
    '.cbsh-who{display:flex;align-items:center;gap:8px;border:0;background:none;padding:4px 9px;border-radius:8px;min-width:0}',
    '.cbsh-who:hover,.cbsh-hdr.open .cbsh-who{background:var(--sh-panel)}',
    '.cbsh-who b{font-family:"Bricolage Grotesque",sans-serif;font-size:16px;font-weight:800;letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.cbsh-who .chev{color:var(--sh-muted);font-size:10px;transition:transform .14s}',
    '.cbsh-hdr.open .cbsh-who .chev{transform:rotate(180deg)}',
    '.cbsh-grow{flex:1}',
    '.cbsh-lic:empty,.cbsh-bell:empty{display:none}',
    '.cbsh-chip{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 11px;border-radius:8px;font-size:12.5px;font-weight:600;white-space:nowrap;border:1px solid}',
    '.cbsh-chip .d{font-family:var(--f-num,"IBM Plex Mono",monospace);font-weight:700}.cbsh-chip .sm{display:none}',
    '.cbsh-chip.due{background:var(--sh-blue-t);border-color:var(--sh-blue-b);color:var(--sh-blue-i)}',
    '.cbsh-chip.soon{background:var(--sh-amber-t);border-color:var(--sh-amber-b);color:var(--sh-amber-i)}',
    '.cbsh-chip.gone{background:var(--sh-red-t);border-color:var(--sh-red-b);color:var(--sh-red-i)}',
    '.cbsh-av{flex:0 0 auto;display:flex;align-items:center}',
    /* switcher (inside an app) */
    '.cbsh-sw{position:relative}',
    '.cbsh-swb{display:flex;align-items:center;gap:7px;height:30px;padding:0 10px;border:1px solid var(--sh-line);border-radius:8px;background:var(--sh-card);font-size:13px;font-weight:600}',
    '.cbsh-swb .chev{font-size:10px;color:var(--sh-muted)}',
    '.cbsh-swpop{position:absolute;top:36px;left:0;z-index:30;min-width:180px;background:var(--sh-card);border:1px solid var(--sh-line);border-radius:11px;padding:5px;box-shadow:0 14px 28px var(--sh-shadow);display:flex;flex-direction:column;gap:2px}',
    '.cbsh-swpop[hidden]{display:none}',
    '.cbsh-swpop a{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;font-size:13.5px;font-weight:600}',
    '.cbsh-swpop a:hover{background:var(--sh-panel)}.cbsh-swpop a[aria-current]{background:var(--sh-green-t);color:var(--sh-green-d)}',
    '.cbsh-swpop .i{width:18px;text-align:center}',
    /* sheet */
    '.cbsh-sheet{border-top:1px solid var(--sh-hair);background:var(--sh-page);max-height:max(136px,calc(20vh - var(--sh-bar)));overflow:auto}',
    '.cbsh-sheet[hidden]{display:none}',
    '.cbsh-sin{display:grid;grid-template-columns:1fr 1.55fr 1fr;gap:26px;padding:8px 18px 9px;max-width:1240px;margin:0 auto}',
    '.cbsh-col h5{margin:0 0 3px;display:flex;align-items:baseline;gap:10px;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--sh-muted);font-weight:700}',
    '.cbsh-col h5 .why{margin-left:auto;font-size:12px;letter-spacing:0;text-transform:none;font-weight:600}',
    '.cbsh-col h5 .why.soon{color:var(--sh-amber-i)}.cbsh-col h5 .why.gone{color:var(--sh-red-i)}.cbsh-col h5 .why.due{color:var(--sh-blue-i)}',
    '.cbsh-ln{font-size:13px;line-height:1.38;color:var(--sh-muted)}.cbsh-ln.nm{font-size:14px;font-weight:700;color:var(--sh-ink)}',
    '.cbsh-ln.mono{font-family:var(--f-num,"IBM Plex Mono",monospace);color:var(--sh-ink)}',
    '.cbsh-ln.none{grid-column:2 / -1;align-self:center}',
    /* a licence row: three columns (name with its number · time left · the one button) */
    '.cbsh-lrow{display:grid;grid-template-columns:1fr 108px 92px;gap:12px;align-items:center;min-height:23px;border-bottom:1px solid var(--sh-hair);font-size:13px}',
    '.cbsh-lrow:last-child{border-bottom:0}',
    '.cbsh-lrow .nm{font-weight:600}.cbsh-lrow .no{font-family:var(--f-num,"IBM Plex Mono",monospace);font-size:11.5px;color:var(--sh-muted);margin-left:8px;font-weight:400}',
    '.cbsh-lrow .st{font-family:var(--f-num,"IBM Plex Mono",monospace);font-weight:700;font-size:12.5px;text-align:right;color:var(--sh-muted)}',
    '.cbsh-lrow .st.soon{color:var(--sh-amber-i)}.cbsh-lrow .st.gone{color:var(--sh-red-i)}.cbsh-lrow .st.due{color:var(--sh-blue-i)}.cbsh-lrow .st.ok{color:var(--sh-green-d)}',
    '.cbsh-rn{display:inline-flex;align-items:center;justify-content:center;height:22px;padding:0 10px;border-radius:7px;border:1px solid var(--sh-line);background:var(--sh-card);font-size:12px;font-weight:700}',
    '.cbsh-rn.soon{background:var(--sh-amber-t);border-color:var(--sh-amber-b);color:var(--sh-amber-i)}',
    '.cbsh-rn.due{background:var(--sh-green);border-color:var(--sh-green);color:var(--sh-on)}',
    '.cbsh-rn.gone{background:var(--sh-red-t);border-color:var(--sh-red-b);color:var(--sh-red-i)}',
    '.cbsh-checks{display:grid;grid-template-columns:1fr 1fr;gap:3px 12px}',
    '.cbsh-chk{display:flex;align-items:center;gap:7px;font-size:13px;min-height:22px}',
    '.cbsh-chk .m{width:15px;height:15px;border-radius:5px;display:grid;place-items:center;font-size:10px;font-weight:800;flex:0 0 auto}',
    '.cbsh-chk.y .m{background:var(--sh-green);color:var(--sh-on)}.cbsh-chk.n .m{background:var(--sh-panel);border:1px solid var(--sh-line)}.cbsh-chk.n{color:var(--sh-muted)}',
    '.cbsh-btn{display:inline-flex;align-items:center;height:27px;padding:0 12px;border-radius:8px;border:1px solid var(--sh-green);background:var(--sh-green);color:var(--sh-on);font-size:12.5px;font-weight:700;margin-top:7px}',
    '.cbsh-scrim{display:none}',
    /* working area */
    '.cbsh-work{flex:1 1 auto;min-height:0;display:flex}',
    '.cbsh-nav{flex:0 0 var(--sh-navw);border-right:1px solid var(--sh-line);background:var(--sh-panel);display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 0}',
    '.cbsh-nv{width:46px;border:0;background:none;border-radius:10px;padding:7px 0 5px;display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--sh-muted)}',
    '.cbsh-nv .i{font-size:17px;line-height:1}.cbsh-nv .t{font-size:10px;font-weight:600;letter-spacing:.01em}',
    '.cbsh-nv:hover{background:var(--sh-hover)}',
    '.cbsh-nv[aria-current]{background:var(--sh-card);color:var(--sh-green-d);box-shadow:0 0 0 1px var(--sh-line)}.cbsh-nv[aria-current] .i{color:var(--sh-green)}',
    '.cbsh-main{flex:1 1 auto;min-width:0;overflow-y:auto;overflow-x:hidden;scroll-behavior:smooth;scrollbar-width:thin;scrollbar-color:var(--sh-line) transparent}',
    '.cbsh-inner{max-width:1240px;margin:0 auto;padding:16px 24px 28px}',
    '.cbsh-sec{margin-bottom:22px;scroll-margin-top:4px}',
    '.cbsh-cap{display:flex;align-items:center;gap:11px;margin:0 0 10px;position:sticky;top:-1px;z-index:3;background:var(--sh-page);padding:6px 0 5px}',
    '.cbsh-cap b{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--sh-muted);font-weight:700}',
    '.cbsh-cap i{flex:1;height:1px;background:var(--sh-soft);font-style:normal}.cbsh-cap span{font-size:12.5px;color:var(--sh-muted)}',
    '.cbsh-ph{display:none}',
    '.cbsh-note{font-size:13px;color:var(--sh-muted);padding:6px 0}',
    /* cards (max three columns, DECISIONS.md) */
    '.cbsh-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
    '.cbsh-box{display:block;width:100%;text-align:left;background:var(--sh-card);border:1px solid var(--sh-line);border-radius:13px;padding:14px 16px;position:relative;transition:border-color .12s}',
    '.cbsh-box:hover{border-color:var(--sh-green)}',
    '.cbsh-box .g{width:32px;height:32px;border-radius:9px;background:var(--sh-panel);display:grid;place-items:center;font-size:15px;color:var(--sh-muted);margin-bottom:9px}',
    '.cbsh-box h4{font-family:"Bricolage Grotesque",sans-serif;font-size:16.5px;font-weight:800;letter-spacing:-.015em;margin:0}',
    '.cbsh-box .what{font-size:12.5px;color:var(--sh-muted);margin:2px 0 0;line-height:1.35}',
    '.cbsh-box .facts{display:flex;flex-direction:column;gap:2px;margin-top:11px;padding-top:9px;border-top:1px solid var(--sh-hair)}',
    '.cbsh-box .facts:empty{display:none}',
    '.cbsh-box .f{font-size:12.5px;color:var(--sh-muted);font-family:var(--f-num,"IBM Plex Mono",monospace)}.cbsh-box .f.dn{color:var(--sh-amber-i)}',
    '.cbsh-box .arw{position:absolute;top:14px;right:15px;color:var(--sh-ghost);font-size:16px}.cbsh-box:hover .arw{color:var(--sh-green)}',
    '.cbsh-sec.labs .cbsh-box,.cbsh-sec.setup .cbsh-box{padding:12px 14px;border-radius:11px}',
    '.cbsh-sec.labs .cbsh-box h4,.cbsh-sec.setup .cbsh-box h4{font-family:inherit;font-size:14px;font-weight:700;letter-spacing:0}',
    '.cbsh-sec.labs .cbsh-box .g,.cbsh-sec.setup .cbsh-box .g{width:auto;height:auto;background:none;font-size:15px;margin-bottom:6px;display:block}',
    '.cbsh-labs{background:var(--sh-panel);border:1px solid var(--sh-soft);border-radius:14px;padding:4px 16px 15px}.cbsh-labs .cbsh-cap{background:var(--sh-panel)}',
    '.cbsh-base{border:1px dashed var(--sh-line);border-radius:14px;padding:4px 16px 15px}',
    /* CB Commerce pillar boxes: 4 across (the main row), 3 across (the supporting row), cards stacked inside */
    '.cbsh-pils{display:grid;gap:12px;align-items:start}.cbsh-pils.n4{grid-template-columns:repeat(4,minmax(0,1fr))}.cbsh-pils.n3{grid-template-columns:repeat(3,minmax(0,1fr))}',
    '.cbsh-pil{background:var(--sh-panel);border:1px solid var(--sh-soft);border-radius:14px;padding:10px 10px 12px;min-width:0}',
    '.cbsh-pil h3{margin:0 2px 8px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--sh-muted);font-weight:700}',
    '.cbsh-pil .cbsh-grid{grid-template-columns:1fr;gap:8px}.cbsh-pil .cbsh-chips{margin-top:8px}.cbsh-pil .cbsh-grid:empty{display:none}',
    '.cbsh-pil .cbsh-box{padding:12px 14px}',
    '@media(max-width:1000px){.cbsh-pils.n4{grid-template-columns:repeat(2,minmax(0,1fr))}.cbsh-pils.n3{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    /* dashed chips: coming · workshop (no link — I12) */
    '.cbsh-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.cbsh-chips:empty{display:none}',
    '.cbsh-sc{display:inline-flex;align-items:center;gap:9px;background:var(--sh-card);border:1px dashed var(--sh-line);border-radius:10px;padding:6px 12px;color:var(--sh-muted)}',
    '.cbsh-sc .g{font-size:13px;color:var(--sh-ghost)}.cbsh-sc b{font-size:13px;font-weight:600}',
    '.cbsh-sc .tag{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--sh-muted);background:var(--sh-panel);border-radius:5px;padding:1px 6px}',
    '.cbsh-alerts:empty,.cbsh-home:empty,.cbsh-signin:empty{display:none}.cbsh-alerts{display:flex;flex-direction:column;gap:7px;margin-bottom:16px}',
    '.cbsh-foot{flex:0 0 auto}.cbsh-foot:empty{display:none}.cbsh-pfoot{display:none}',
    '.cbsh-slotwork{min-height:100%}',
    /* CB SIDES (public/app/sides.js): two reference panels. From 1480 px they sit beside the work area and scroll on their own; below it they are two drawers behind the toolbar buttons, one open at a time; a phone drawer is full width */
    '.cbsh-work{position:relative}.cbsh-side,.cbsh-tools{display:none}',
    '@media(min-width:1480px){.cbsh.has-sides .cbsh-side{display:block;flex:0 0 300px;width:300px;align-self:flex-start;max-height:calc(100% - 24px);margin:12px 0;overflow:auto}.cbsh.has-sides .cbsh-side.l{margin-left:14px}.cbsh.has-sides .cbsh-side.r{margin-right:14px}}',
    '@media(max-width:1479px){.cbsh.has-sides .cbsh-tools{display:flex;gap:10px;position:sticky;top:0;z-index:5;background:var(--sh-page);padding:8px 0;border-bottom:1px solid var(--sh-soft);margin-bottom:10px}.cbsh.has-sides .cbsh-tools .cbsd-btn{display:inline-block}',
    '.cbsh.has-sides .cbsh-side.drawer{display:block;position:absolute;top:48px;bottom:0;width:min(330px,92vw);z-index:40;margin:0;border-radius:0;overflow:auto;box-shadow:0 0 30px var(--sh-shadow)}',
    '.cbsh.has-sides .cbsh-side.l.drawer{left:var(--sh-navw)}.cbsh.has-sides .cbsh-side.r.drawer{right:0}.cbsh .cbsd-x{display:inline-block}.cbsh.has-sides .cbsh-cap{top:43px}}',
    '@media(max-width:700px){.cbsh.has-sides .cbsh-side.drawer{left:0!important;right:0!important;width:100%}}',
    '@media(max-width:1100px){.cbsh-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cbsh-sin{grid-template-columns:1fr 1.4fr}.cbsh-sin .cbsh-col:nth-child(3){grid-column:1/-1}}',
    /* PHONE — a different layout: bottom tabs, one area at a time, rows, the sheet drops over the page, the kural once on Home */
    '@media(max-width:700px){',
    '.cbsh{--sh-bar:52px}.cbsh-bar{padding:0 13px;gap:9px}.cbsh-who{padding:4px 6px;margin-left:-6px}',
    '.cbsh-chip .lbl,.cbsh-chip .lg{display:none}.cbsh-chip .sm{display:inline}.cbsh-chip{padding:0 10px;gap:6px}',
    '.cbsh-sheet{position:absolute;left:0;right:0;top:var(--sh-bar);max-height:calc(100dvh - var(--sh-bar) - 70px);box-shadow:0 14px 28px var(--sh-shadow);border-bottom:1px solid var(--sh-line)}',
    '.cbsh-hdr.open .cbsh-scrim{display:block;position:fixed;inset:var(--sh-bar) 0 0 0;background:var(--sh-scrim);z-index:-1}',
    '.cbsh-sin{grid-template-columns:1fr;gap:16px;padding:14px 14px 16px}.cbsh-sin .cbsh-col:nth-child(3){grid-column:auto}.cbsh-ln.none{grid-column:auto}',
    '.cbsh-lrow{grid-template-columns:1fr auto auto;gap:8px;min-height:36px}.cbsh-lrow .no{display:none}.cbsh-rn{height:30px;padding:0 12px}',
    '.cbsh-work{flex-direction:column-reverse}',
    '.cbsh-nav{flex:0 0 auto;flex-direction:row;justify-content:space-around;gap:0;border-right:0;border-top:1px solid var(--sh-line);padding:5px 4px calc(5px + env(safe-area-inset-bottom,0px));background:var(--sh-card)}',
    '.cbsh-nv{flex:1;width:auto;padding:6px 0 4px;border-radius:9px}.cbsh-nv .i{font-size:19px}.cbsh-nv .t{font-size:10.5px}',
    '.cbsh-nv[aria-current]{background:var(--sh-green-t);box-shadow:none}',
    '.cbsh-inner{padding:12px 13px 20px}.cbsh-main{scroll-behavior:auto}',
    '.cbsh-sec{display:none;margin-bottom:0}',
    '.cbsh-main[data-tab=home] .cbsh-sec.home,.cbsh-main[data-tab=selling] .cbsh-sec.selling,.cbsh-main[data-tab=running] .cbsh-sec.running,',
    '.cbsh-main[data-tab=labs] .cbsh-sec.labs,.cbsh-main[data-tab=setup] .cbsh-sec.setup{display:block}',
    '.cbsh-cap{display:none}',
    '.cbsh-pils.n4,.cbsh-pils.n3{grid-template-columns:1fr;gap:10px}.cbsh-pil{padding:8px 0 0;background:none;border:0}.cbsh-pil h3{margin-left:2px}.cbsh-pil .cbsh-grid{gap:0}',
    '.cbsh-ph{display:block;font-family:"Bricolage Grotesque",sans-serif;font-size:21px;font-weight:800;letter-spacing:-.02em;margin:2px 2px 10px}',
    '.cbsh-grid{grid-template-columns:1fr;gap:0;border:1px solid var(--sh-line);border-radius:13px;background:var(--sh-card);overflow:hidden}',
    '.cbsh-box,.cbsh-sec.labs .cbsh-box,.cbsh-sec.setup .cbsh-box{border:0;border-radius:0;border-bottom:1px solid var(--sh-hair);padding:13px 38px 13px 14px}',
    '.cbsh-box:last-child{border-bottom:0}',
    '.cbsh-box .g,.cbsh-sec.labs .cbsh-box .g,.cbsh-sec.setup .cbsh-box .g{display:none}.cbsh-box .arw{top:50%;transform:translateY(-50%);right:14px}',
    '.cbsh-box .facts{flex-direction:row;flex-wrap:wrap;gap:2px 12px;margin-top:6px;padding-top:0;border-top:0}',
    '.cbsh-labs,.cbsh-base{padding:0;background:none;border:0}',
    '.cbsh-chips{gap:7px;margin-top:12px}.cbsh-sc{padding:6px 10px}',
    /* P2-2 (Athi: "kural should be in the footer"): on a phone Home the band sits in the footer ABOVE the tab bar (the work area is column-reverse, so the DOM order nav · pfoot · main reads main · pfoot · nav) */
    '.cbsh-pfoot{display:block;flex:0 0 auto;order:0}.cbsh-pfoot:empty{display:none}',
    '}'
  ].join('');

  function addCss() {
    if (!doc || doc.getElementById('cbsh-css')) return;
    var s = doc.createElement('style'); s.id = 'cbsh-css'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ── licences: the server says the band (ok · due · soon · gone) and any penalty words; the shell only words the days ── */
  function daysWord(l) {
    var d = l.days_left;
    if (d == null) return l.core ? W.notAdded : (l.registered ? W.registered : W.notRegistered);
    if (d < 0) return W.expired(-d);
    if (d < 400) return d + W.days;
    return (Math.round(d / 365 * 10) / 10) + W.years;
  }
  var WARN = { due: 1, soon: 1, gone: 1 };
  function worstOf(lics) {
    var c = (lics || []).filter(function (l) { return l && l.core && l.days_left != null && WARN[l.band]; });
    c.sort(function (a, b) { return a.days_left - b.days_left; });
    return c[0] || null;
  }

  function mount(el, o) {
    if (!el) return null;
    o = o || {};
    addCss();
    var host = o.host || null, mode = host && host.bar ? 'bar' : host ? 'app' : 'home';
    var sess = session();
    var person = o.person !== undefined ? o.person : (root.CBAvatar && root.CBAvatar.sessionPerson ? root.CBAvatar.sessionPerson() : null);
    var token = o.token || (sess && sess.token) || '';
    var base = o.apiBase != null ? o.apiBase : apiBase();
    var homeHref = o.homeHref || '/';
    var phone = root.matchMedia ? root.matchMedia('(max-width:700px)') : { matches: false };
    var S = { manifest: null, loadingApps: true, header: null, headerState: person ? 'loading' : 'out', area: 'home', open: false };
    var sheetId = 'cbsh-sheet-' + Math.random().toString(36).slice(2, 8);

    el.innerHTML = '';
    el.classList.add('cbsh');
    if (mode !== 'bar') el.classList.add('full');
    el.setAttribute('data-testid', 'cbshell');
    el.setAttribute('data-mode', mode);

    var shopName = function () {
      var b = S.header && S.header.business;
      return (b && b.name) || (person && person.entity) || (sess && sess.entity) || W.yourShop;
    };

    /* CB Sides: only on Home, only signed in, only if the page loaded sides.js (the same rule as the avatar, bell and kural) */
    var sides = mode === 'home' && !!person && !!(root.CBSides && root.CBSides.mount);
    if (sides) el.classList.add('has-sides');

    el.innerHTML =
      '<header class="cbsh-hdr" data-testid="shell-header">' +
        '<div class="cbsh-bar" data-testid="shell-bar">' +
          '<span class="cbsh-mark" aria-hidden="true" data-testid="shell-mark">▣</span>' +
          (person ? '<button type="button" class="cbsh-who" data-testid="shell-shop" aria-expanded="false" aria-controls="' + sheetId + '"><b></b><span class="chev" aria-hidden="true">▼</span></button>' : '') +
          (mode === 'app' ? '<div class="cbsh-sw"><button type="button" class="cbsh-swb" data-testid="shell-switcher" aria-haspopup="true" aria-expanded="false"></button><div class="cbsh-swpop" data-testid="shell-switcher-menu" hidden></div></div>' : '') +
          '<span class="cbsh-grow"></span>' +
          '<span class="cbsh-lic" data-testid="shell-licence"></span>' +
          '<span class="cbsh-bell" data-testid="shell-bell" data-slot="bell"></span>' +
          '<span class="cbsh-av" data-testid="shell-avatar"></span>' +
        '</div>' +
        (person ? '<div class="cbsh-sheet" id="' + sheetId + '" role="region" data-testid="shell-sheet" hidden></div><div class="cbsh-scrim" data-testid="shell-scrim"></div>' : '') +
      '</header>' +
      (mode === 'bar' ? '' :
        '<div class="cbsh-work">' +
          (mode === 'home' ? '<nav class="cbsh-nav" data-testid="shell-nav" aria-label="Areas">' + AREAS.map(function (a) {
            return '<button type="button" class="cbsh-nv" data-go="' + a + '" data-testid="shell-nav-' + a + '"><span class="i" aria-hidden="true">' + ICON[a] + '</span><span class="t">' + esc(W.areas[a]) + '</span></button>';
          }).join('') + '</nav>' : '') +
          (mode === 'home' ? '<div class="cbsh-pfoot" data-testid="shell-pfoot"></div>' : '') +
          (sides ? '<aside class="cbsh-side l" data-slot="sideL"></aside>' : '') +
          '<main class="cbsh-main" data-testid="shell-main" data-tab="home"><div class="cbsh-inner">' +
            (sides ? '<div class="cbsh-tools" data-testid="shell-sidetools"><button type="button" data-slot="btnL"></button><button type="button" data-slot="btnR"></button></div>' : '') +
            '<div class="cbsh-signin" data-testid="shell-signin"></div>' +
            (mode === 'home' ? '<div class="cbsh-areas" data-testid="shell-areas"></div>' : '<div class="cbsh-slotwork" data-slot="work"></div>') +
          '</div></main>' +
          (sides ? '<aside class="cbsh-side r" data-slot="sideR"></aside>' : '') +
        '</div>' +
        '<div class="cbsh-foot" data-testid="shell-foot"></div>');

    var $ = function (s) { return el.querySelector(s); };
    var hdr = $('.cbsh-hdr'), sheet = $('.cbsh-sheet'), who = $('.cbsh-who'), main = $('.cbsh-main');
    var slots = { bell: $('.cbsh-bell'), alerts: null, home: null, work: $('[data-slot="work"]') };

    /* ── the bar ── */
    function paintBar() {
      if (who) { who.querySelector('b').textContent = shopName(); who.setAttribute('aria-label', shopName()); }
      if (sheet) sheet.setAttribute('aria-label', shopName());
      var lic = $('.cbsh-lic'), w = S.header ? worstOf(S.header.licences) : null;
      lic.innerHTML = w ? '<button type="button" class="cbsh-chip ' + w.band + '" data-testid="shell-licence-chip" data-band="' + w.band + '">' + (w.band === 'due' ? '●' : '⚠') +
        ' <span class="lbl">' + esc(w.label) + '</span> <span class="d">' + (w.days_left < 0 ? '<span class="lg">' + esc(W.expired(-w.days_left)) + '</span><span class="sm">' + esc(W.lapsed) + '</span>' : esc(daysWord(w))) + '</span></button>' : '';
    }

    /* ── the sheet: the business · licences · trade ready — or the empty state that says they are not available yet ── */
    function paintSheet() {
      if (!sheet) return;
      var h = S.header, col = function (title, body, why) { return '<div class="cbsh-col"><h5>' + esc(title) + (why || '') + '</h5>' + body + '</div>'; };
      if (S.headerState === 'loading') { sheet.innerHTML = '<div class="cbsh-sin"><div class="cbsh-ln">' + W.loading + '</div></div>'; return; }
      if (!h) {
        sheet.innerHTML = '<div class="cbsh-sin" data-testid="shell-sheet-empty">' + col(W.business, '<div class="cbsh-ln nm">' + esc(shopName()) + '</div>') +
          '<div class="cbsh-ln none">' + esc(W.notYet) + '</div></div>';
        return;
      }
      var b = h.business || {}, lics = h.licences || [], w = worstOf(lics), tr = h.trade_ready || {}, checks = tr.checks || [];
      var biz = '<div class="cbsh-ln nm">' + esc(b.name || shopName()) + '</div>' + (b.legal_name ? '<div class="cbsh-ln">' + esc(b.legal_name) + '</div>' : '') +
        (b.address ? '<div class="cbsh-ln">' + esc(b.address) + '</div>' : '') + (b.phone ? '<div class="cbsh-ln mono">' + esc(b.phone) + '</div>' : '');
      var rows = lics.map(function (l) {
        var isW = w && l === w, btn = '';
        if (isW && l.renew_url) btn = '<a class="cbsh-rn ' + l.band + '" data-testid="shell-renew" href="' + esc(l.renew_url) + '">' + esc(l.band === 'gone' ? W.again : W.renew) + '</a>';
        var tone = l.days_left == null ? (l.registered ? 'ok' : '') : (WARN[l.band] ? l.band : '');
        return '<div class="cbsh-lrow" data-testid="shell-licence-row"><span class="nm">' + esc(l.label) + (l.number_masked ? '<span class="no">' + esc(l.number_masked) + '</span>' : '') + '</span>' +
          '<span class="st ' + tone + '">' + esc(daysWord(l)) + '</span><span>' + btn + '</span></div>';
      }).join('');
      var why = w && w.note ? '<span class="why ' + w.band + '">' + esc(w.note) + '</span>' : '';
      var got = checks.filter(function (c) { return c && c.done; }).length;
      var chk = '<div class="cbsh-checks">' + checks.map(function (c) {
        return '<div class="cbsh-chk ' + (c.done ? 'y' : 'n') + '" data-testid="shell-check"><span class="m" aria-hidden="true">' + (c.done ? '✓' : '') + '</span>' + esc(c.label) + '</div>';
      }).join('') + '</div>' + (checks.length && got < checks.length ? '<a class="cbsh-btn" data-testid="shell-finish" href="' + esc(tr.fix_url || '/know-your-business.html') + '">' + esc(W.finish) + '</a>' : '');
      sheet.innerHTML = '<div class="cbsh-sin" data-testid="shell-sheet-full">' + col(W.business, biz) + col(W.licences, rows, why) + col(W.trade, chk) + '</div>';
    }

    function setOpen(v) {
      if (!sheet) return;
      S.open = !!v; hdr.classList.toggle('open', S.open); sheet.hidden = !S.open;
      if (who) who.setAttribute('aria-expanded', S.open ? 'true' : 'false');
    }

    /* ── the five areas (Home) ── */
    function pillarOf(e) { return e.pillar || PDEFAULT[e.area] || e.area; }
    function sectionOf(e) { var p = pillarOf(e); return PILLARS.selling.indexOf(p) >= 0 ? 'selling' : PILLARS.running.indexOf(p) >= 0 ? 'running' : p; }
    function entriesOf(area) { return ((S.manifest && S.manifest.entries) || []).filter(function (e) { return e && sectionOf(e) === area; }); }
    /* a pillar box: its title, then the cards that have a page, then the dashed chips (coming · workshop) */
    function pillarBox(p, list) {
      var built = list.filter(function (e) { return e.state === 'built' && e.route; }), rest = list.filter(function (e) { return !(e.state === 'built' && e.route); });
      return '<div class="cbsh-pil" data-pillar="' + p + '" data-testid="shell-pillar-' + p + '"><h3>' + esc(PNAME[p]) + '</h3><div class="cbsh-grid">' + built.map(card).join('') + '</div><div class="cbsh-chips">' + rest.map(chip).join('') + '</div></div>';
    }
    /* H22/S1: a route may name the shop it opens for ({bridge_id}: the Storefront is THIS shop's page, /shop.html?s=<id>); unresolved, the bare page */
    function routeOf(e) {
      var r = String(e.route || ''); if (r.indexOf('{bridge_id}') < 0) return r;
      var bid = (person && person.bridgeId) || (sess && sess.bridgeId) || (S.header && S.header.business && S.header.business.bridge_id) || '';
      return bid ? r.replace('{bridge_id}', encodeURIComponent(bid)) : r.split('?')[0];
    }
    function card(e) {
      return '<a class="cbsh-box" href="' + esc(routeOf(e)) + '" data-testid="shell-card-' + esc(e.id) + '" data-id="' + esc(e.id) + '">' +
        '<span class="arw" aria-hidden="true">›</span><span class="g" aria-hidden="true">' + esc(e.icon) + '</span><h4>' + esc(e.name) + '</h4>' +
        (e.what ? '<p class="what">' + esc(e.what) + '</p>' : '') + '<span class="facts" data-testid="shell-facts-' + esc(e.id) + '"></span></a>';
    }
    function chip(e) {
      var st = e.state === 'workshop' ? 'workshop' : 'coming';
      /* H36: a workshop item with no page of its own may name the closest built page (`via`): the chip becomes a link there, still marked workshop */
      if (e.via) return '<a class="cbsh-sc" href="' + esc(e.via) + '" data-testid="shell-chip-' + esc(e.id) + '" data-state="' + st + '" data-via="1"' + (e.via_note ? ' title="' + esc(e.via_note) + '"' : '') + '><span class="g" aria-hidden="true">' + esc(e.icon) + '</span><b>' + esc(e.name) + '</b><span class="tag">' + esc(W.tag[st]) + '</span></a>';
      return '<span class="cbsh-sc" data-testid="shell-chip-' + esc(e.id) + '" data-state="' + st + '"><span class="g" aria-hidden="true">' + esc(e.icon) + '</span><b>' + esc(e.name) + '</b><span class="tag">' + esc(W.tag[st]) + '</span></span>';
    }
    function paintAreas() {
      var box = $('.cbsh-areas'); if (!box) return;
      /* Home is drawn ONCE (the page may already have put its alerts and content in the slots); the four areas are redrawn from the manifest */
      if (!$('.cbsh-sec.home')) {
        box.innerHTML = '<section class="cbsh-sec home" data-area="home" data-testid="shell-area-home"><h2 class="cbsh-ph">' + esc(W.areas.home) + '</h2>' +
          '<div class="cbsh-alerts" data-slot="alerts"></div><div class="cbsh-home" data-slot="home"></div><div class="cbsh-note" data-testid="shell-noapps" hidden>' + esc(W.noApps) + '</div>' +
          '</section><div class="cbsh-more"></div>';
        slots.alerts = $('[data-slot="alerts"]'); slots.home = $('[data-slot="home"]');
      }
      $('[data-testid="shell-noapps"]').hidden = !!S.manifest || S.loadingApps;
      $('.cbsh-more').innerHTML = AREAS.slice(1).map(function (a) {
          var list = entriesOf(a), built = list.filter(function (e) { return e.state === 'built' && e.route; }), rest = list.filter(function (e) { return !(e.state === 'built' && e.route); });
          var cap = '<div class="cbsh-cap"><b>' + esc(W.caption[a]) + '</b>' + (W.sub[a] ? '<span>' + esc(W.sub[a]) + '</span>' : '') + '<i></i></div>';
          if (PILLARS[a]) {
            var boxes = PILLARS[a].map(function (p) { var l = list.filter(function (e) { return pillarOf(e) === p; }); return l.length ? pillarBox(p, l) : ''; }).join('');
            return '<section class="cbsh-sec ' + a + '" data-area="' + a + '" data-testid="shell-area-' + a + '"><h2 class="cbsh-ph">' + esc(W.caption[a]) + '</h2>' + cap + '<div class="cbsh-pils n' + PILLARS[a].length + '">' + boxes + '</div></section>';
          }
          var inner = cap + '<div class="cbsh-grid">' + built.map(card).join('') + '</div><div class="cbsh-chips">' + rest.map(chip).join('') + '</div>';
          var wrap = a === 'labs' ? '<div class="cbsh-labs">' + inner + '</div>' : a === 'setup' ? '<div class="cbsh-base">' + inner + '</div>' : inner;
          return '<section class="cbsh-sec ' + a + '" data-area="' + a + '" data-testid="shell-area-' + a + '"><h2 class="cbsh-ph">' + esc(W.caption[a]) + '</h2>' + wrap + '</section>';
        }).join('');
      placeKural();
    }

    /* each built entry's facts: GET its URL → { lines:[ 'text' | { text, tone:'dn' } ] }, at most two lines */
    function readFacts() {
      if (!person || !S.manifest) return;
      (S.manifest.entries || []).forEach(function (e) {
        if (!e || e.state !== 'built' || !e.facts) return;
        var spot = $('[data-testid="shell-facts-' + e.id + '"]'); if (!spot) return;
        get(e.facts).then(function (r) {
          var lines = (r && r.lines) || [];
          spot.innerHTML = lines.slice(0, 2).map(function (l) { var t = typeof l === 'string' ? { text: l } : (l || {}); return '<span class="f' + (t.tone === 'dn' ? ' dn' : '') + '">' + esc(t.text) + '</span>'; }).join('');
        }).catch(function () { spot.innerHTML = '<span class="f" title="' + esc(W.factsFailed) + '">—</span>'; });
      });
    }

    function mark(id) {
      S.area = id;
      [].forEach.call(el.querySelectorAll('.cbsh-nv'), function (b) { if (b.getAttribute('data-go') === id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    }
    function go(id) {
      if (AREAS.indexOf(id) < 0) id = 'home';
      if (mode !== 'home') { root.location.href = homeHref + (id === 'home' ? '' : '#' + id); return; }
      if (phone.matches) { main.setAttribute('data-tab', id); main.scrollTop = 0; mark(id); placeKural(); return; }
      var sec = $('.cbsh-sec.' + id);
      /* the chosen area stays lit while the scroll it started runs, and at the end of the page (where Labs cannot reach the top) */
      S.pin = id; S.pinUntil = Date.now() + 1200;
      if (sec) main.scrollTo({ top: id === 'home' ? 0 : sec.offsetTop - 6 });
      mark(id);
    }
    function spy() {
      if (phone.matches || mode !== 'home') return;
      if (S.pin && Date.now() < S.pinUntil) return;
      var bottom = main.scrollTop > 0 && main.scrollTop + main.clientHeight >= main.scrollHeight - 4;
      if (S.pin && bottom && S.pin !== 'home') return;
      S.pin = null;
      var y = main.scrollTop + 40, cur = 'home';
      AREAS.forEach(function (id) { var s = $('.cbsh-sec.' + id); if (s && s.offsetTop <= y) cur = id; });
      if (bottom) cur = 'setup';
      mark(cur);
    }

    /* ── the switcher (inside an app): the five areas as links to Home, the app's own menu stays the app's ── */
    function paintSwitcher() {
      var b = $('.cbsh-swb'), pop = $('.cbsh-swpop'); if (!b) return;
      var me = ((S.manifest && S.manifest.entries) || []).filter(function (e) { return e && e.id === host.app; })[0];
      var cur = (me && me.area) || o.area || 'home';
      b.innerHTML = '<span aria-hidden="true">' + esc((me && me.icon) || ICON[cur]) + '</span><span>' + esc((me && me.name) || W.areas[cur]) + '</span><span class="chev" aria-hidden="true">▼</span>';
      b.setAttribute('aria-label', W.switcher);
      pop.innerHTML = AREAS.map(function (a) {
        return '<a href="' + esc(homeHref + (a === 'home' ? '' : '#' + a)) + '" data-testid="shell-switch-' + a + '"' + (a === cur ? ' aria-current="true"' : '') + '><span class="i" aria-hidden="true">' + ICON[a] + '</span>' + esc(W.areas[a]) + '</a>';
      }).join('');
    }
    function swOpen(v) { var b = $('.cbsh-swb'), pop = $('.cbsh-swpop'); if (!b) return; pop.hidden = !v; b.setAttribute('aria-expanded', v ? 'true' : 'false'); }

    /* ── the kural: the footer band on a laptop; once, at the foot of Home, on a phone ── */
    function placeKural() {
      var K = root.CBKural, k = K && K.el && K.el(); if (!k) return;
      var spot = phone.matches && mode === 'home' ? $('.cbsh-pfoot') : $('.cbsh-foot');   /* always the footer: above the tab bar on a phone, under the page elsewhere */
      if (spot && k.parentNode !== spot) { spot.appendChild(k); if (K.refresh) K.refresh(); }
    }

    function get(url) {
      var full = /^https?:/.test(url) ? url : base + url;
      return root.fetch(full, { headers: token ? { Authorization: 'Bearer ' + token } : {} }).then(function (r) {
        if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
        return r.json();
      });
    }
    function loadManifest() {
      var m = o.manifest || '/app/manifest.json';
      if (typeof m === 'object') return Promise.resolve(m);
      return root.fetch(m).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }

    /* ── events ── */
    if (who) who.addEventListener('click', function () { setOpen(!S.open); });
    var scrim = $('.cbsh-scrim'); if (scrim) scrim.addEventListener('click', function () { setOpen(false); });
    $('.cbsh-lic').addEventListener('click', function (e) { if (e.target.closest('.cbsh-chip')) setOpen(true); });
    var onKey = function (e) { if (e.key === 'Escape') { if (S.open) setOpen(false); swOpen(false); } };
    doc.addEventListener('keydown', onKey);
    var nav = $('.cbsh-nav'); if (nav) nav.addEventListener('click', function (e) { var b = e.target.closest('.cbsh-nv'); if (b) go(b.getAttribute('data-go')); });
    if (main && mode === 'home') {
      main.addEventListener('scroll', spy, { passive: true });
      ['wheel', 'touchstart'].forEach(function (t) { main.addEventListener(t, function () { S.pin = null; S.pinUntil = 0; }, { passive: true }); });
    }
    var swb = $('.cbsh-swb'); if (swb) swb.addEventListener('click', function () { swOpen($('.cbsh-swpop').hidden); });
    doc.addEventListener('click', function (e) { if (swb && !e.target.closest('.cbsh-sw')) swOpen(false); });
    var onMedia = function () { if (mode === 'home') { main.setAttribute('data-tab', S.area); if (!phone.matches) go(S.area); } placeKural(); setOpen(false); };
    if (phone.addEventListener) phone.addEventListener('change', onMedia);

    /* ── units the page loaded: the avatar (always), the bell, the sign-in window, the kural ── */
    if (root.CBAvatar && root.CBAvatar.mount) {
      var ao = { person: person, items: ['profile', 'support', 'signout'], apiBase: base, token: token };
      Object.keys(o.avatar || {}).forEach(function (k) { ao[k] = o.avatar[k]; });
      root.CBAvatar.mount($('.cbsh-av'), ao);
    } else if (root.console) root.console.error('CBShell: load /app/avatar.js before the shell — the avatar is CBAvatar, never drawn here');
    if (root.CBBell && root.CBBell.mount) root.CBBell.mount(slots.bell, { apiBase: base, token: token, person: person });   /* person null = signed out: no bell, even with a token still saved */
    /* ⭐ M14: signed out, the shell's own slot holds THE ONE SIGN-IN WINDOW (CBSignin.mount) — the page hands its contract through
       o.signin (surface · need · onIn · deviceId …); the avatar's Sign in door only brings the person to it. */
    if (!person && mode !== 'bar' && root.CBSignin && typeof root.CBSignin.mount === 'function') {
      var so = { apiBase: base, surface: 'index', need: 'person' };
      Object.keys(o.signin || {}).forEach(function (k) { so[k] = o.signin[k]; });
      root.CBSignin.mount($('.cbsh-signin'), so);
    }

    var sidesApi = sides ? root.CBSides.mount({ left: $('[data-slot="sideL"]'), right: $('[data-slot="sideR"]'), btnL: $('[data-slot="btnL"]'), btnR: $('[data-slot="btnR"]') }, { apiBase: base, token: token }) : null;

    paintBar(); paintSheet();
    if (mode === 'home') paintAreas();
    var hashArea = (root.location && (root.location.hash || '').replace('#', '')) || '';
    var first = o.area || (AREAS.indexOf(hashArea) >= 0 ? hashArea : 'home');
    if (mode === 'home') { main.setAttribute('data-tab', first); mark(first); }

    var kuralP = (mode !== 'bar' && o.kural !== false && root.CBKural && root.CBKural.mount)
      ? root.CBKural.mount({ route: o.kural || 'planning', host: phone.matches && mode === 'home' ? $('.cbsh-pfoot') : $('.cbsh-foot') }).then(placeKural).catch(function () {}) : Promise.resolve();

    var manP = loadManifest().then(function (m) { S.manifest = m && m.entries ? m : { entries: [] }; }, function () { S.manifest = null; })
      .then(function () { S.loadingApps = false; })
      .then(function () { if (mode === 'home') { paintAreas(); if (first !== 'home') go(first); readFacts(); } if (mode === 'app') paintSwitcher(); });

    var hdrP = person ? get('/api/entities/header').then(function (h) { S.header = h || null; S.headerState = h ? 'ok' : 'none'; }, function () { S.header = null; S.headerState = 'none'; })
      .then(function () { paintBar(); paintSheet(); }) : Promise.resolve();

    var api = {
      el: el, slots: slots, mode: mode,
      open: function () { setOpen(true); }, close: function () { setOpen(false); }, isOpen: function () { return S.open; },
      go: go, area: function () { return S.area; }, header: function () { return S.header; }, headerState: function () { return S.headerState; },
      manifest: function () { return S.manifest; },   /* N18: the Home page reads the manifest's top-level `rail` from the one copy the shell fetched — never a second fetch */
      sides: sidesApi,
      ready: Promise.all([manP, hdrP, kuralP, sidesApi ? sidesApi.ready : null]).then(function () { return api; })
    };
    return api;
  }

  root.CBShell = { mount: mount, apiBase: apiBase, WORDS: W, AREAS: AREAS.slice() };
})(typeof window !== 'undefined' ? window : this);
