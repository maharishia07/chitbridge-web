/**
 * CALLED BY index.html (Home: CBShell.mount) and app/page-frame.js (every other page's header, SHELL-ONE); the avatar, the bell and the screen chip mount into its slots.
 * CARD 29-qa-test-tooling-ux-locale-and-design-system/shell
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
 *     person    { name, role, entity, owner, level? } (default: CBAvatar.sessionPerson()); null = signed out; level = the server's word for a
 *               login that is not the owner (editor · view-only, lib/access) — said after the shop's name (CB CRM, SHELL-ONE)
 *     apiBase · token   where /api lives, and the bearer (default: CBShell.apiBase() and the saved session's token)
 *     avatar    extra options passed straight to CBAvatar.mount (items, onSignOut, …)
 *     kural     the CBKural route (default 'planning'); false = no kural
 *     homeHref  where the switcher's areas and the ⌂ Home control point (default '/'; an area is homeHref + '#' + area).
 *               SHELL-ONE: a storefront passes the SHOP's front — "Home" there is the shop, never ChitBridge's index
 *     title     { icon, name } — the app's name in the bar for a page with no manifest entry (a lab; the storefront: the shop's name);
 *               with a manifest entry the switcher names the app itself (SHELL-ONE)
 *     fit       'pane' — the shell is a block INSIDE a page's own pane (an app with its own sidebar), not the full-window frame (SHELL-ONE)
 *   THE ONE HEADER (SHELL-ONE, 2026-10-15 — Athi: "lot of in-consistencies in each page before sign-in itself"): mark · the app's name ·
 *   the screen chip · ⌂ Home · the bell · the avatar (or "Sign in") — on EVERY page, in every mode. Nothing of it is drawn by a page.
 *   shell.slots { bell, alerts, home, work } · shell.open() · .close() · .isOpen() · .go(area) · .area() · .header() · .manifest() · .ready (Promise)
 *
 * EDITIONS (AX1): if the page loaded /app/edition.js, CBEdition decides which entries this showing draws — only those cards, their pillar boxes and
 * their areas (an area with none is not in the menu), a header chip naming the view and one line on Home saying what it is for. Without it: every entry.
 * WHAT IT READS: the manifest, GET /api/entities/header (N19: { business, licences[], trade_ready }) and each built entry's `facts`
 * URL. Nothing else. A 404 or a failure is an EMPTY STATE that says so — never a made-up number.
 * WHAT IT NEVER DOES: load an application's script (only the units CBAvatar · CBKural · CBSignin · CBBell · CBScreenId, each IF the page loaded
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
    areas: { home: 'Home', selling: 'Selling', money: 'Money', running: 'Running', trade: 'Trade', labs: 'Labs', setup: 'Setup', more: 'More' },
    caption: { selling: 'Selling', money: 'Money', running: 'Running it', trade: 'Trade', labs: 'Labs', setup: 'What it all stands on' },
    sub: { selling: 'Sell at the counter and online, and bring customers back.', money: 'Who owes you, who you owe, and what the shop made.', running: 'Stock, suppliers, tasks and the people who do them.', trade: 'Check a business, file a form, grow your network.', labs: 'Work the number out first. Nothing changes until you say so.', setup: 'Set once, rarely touched.' },
    tag: { coming: 'later', workshop: 'workshop', works: 'works today' },
    yourShop: 'Your business', business: 'The business', licences: 'Licences', trade: 'Trade ready', finish: 'Finish the checks',
    renew: 'Renew', again: 'Apply again', notAdded: 'not added', registered: 'registered', notRegistered: 'not registered',
    days: ' days', years: ' years', expired: function (d) { return 'expired ' + d + 'd ago'; }, lapsed: 'lapsed',
    notYet: 'Licences and trade checks are not available yet.', loading: '…', noApps: 'The list of apps could not be read.',
    needsHand: 'need you', moreWord: 'more', noShop: 'No shop yet. Add your business first.', signInShop: 'Sign in to open your shop.',
    factsFailed: 'Could not read', state: { needs_you: 'Needs you', in_use: 'In use', not_started: 'Not started' }, setUp: 'Set up', needsYou: 'Needs you', today: 'today', switcher: 'Go to', close: 'Close',
    vsLastYear: 'vs last year', salesWeeks: 'Sales, last 8 weeks'   /* RPT2: the Till card's teaser */
  };
  /* one box per pillar inside a section; a manifest entry's `pillar` decides its box and so its section (none: its area's default). Walk 17 Oct (Athi): money is not
     selling — Selling · Money · Running it are pillar sections; Trade, Labs and Setup are a pillar of their own, drawn as one grid. Daily first, set-up last. */
  var PILLARS = { selling: ['marketing', 'sales'], money: ['finance', 'accounting'] };
  /* NAMES-1 (Athi, 17 Oct): "Running it" is ONE flat group of tiles, like Trade — its pillars stay on the manifest rows (so People can stand apart
     again) but draw no sub-panels. A pillar here names its section and nothing else. */
  var FLAT_PILLARS = { running: ['operations', 'people'] };
  var PNAME = { marketing: 'Marketing', sales: 'Sales', finance: 'Finance', accounting: 'Accounts', operations: 'Operations', people: 'People', trade: 'Trade' };
  var PDEFAULT = { selling: 'sales', running: 'operations', labs: 'labs', setup: 'setup' };
  var AREAS = ['home', 'selling', 'money', 'running', 'trade', 'labs', 'setup'];
  /* HOME-PHONE-BAR (19 Oct): a phone shows FIVE tabs - Home, Selling, Money, Running, More. More is a page of three rows (these areas); a laptop keeps the seven-button rail. */
  var PHONE_MORE = ['trade', 'labs', 'setup'];
  var PHONE_TABS = AREAS.filter(function (area) { return PHONE_MORE.indexOf(area) < 0; }).concat(['more']);   /* the five, in order */
  function tabOf(area, onPhone) { return onPhone && PHONE_MORE.indexOf(area) >= 0 ? 'more' : area; }
  /* AU-WORDS (15 Oct): a MONEY icon is the SHOP's currency symbol — CBLocale.symbol of the header's business.currency (the pack's money) — never ₹
     for every shop (Athi on live austore1: "CB Accounts ₹"). The manifest and ICON write the neutral currency sign ¤; glyph() swaps it on paint and
     paintMoneyGlyphs() re-swaps what was painted before the header arrived. No currency known → ¤ stays. */
  var MONEY_GLYPH = '¤';
  var ICON = { home: '⌂', selling: '▤', money: MONEY_GLYPH, running: '▣', trade: '⇆', labs: '◈', setup: '⚙', more: '⋯' };

  /* a manifest entry's name and line go through the catalogue (tx, accounts-shell.js — English is the key); a page without it shows the English */
  function T(s) { return typeof root.tx === 'function' ? root.tx(s) : s; }
  /* ⭐ the frame's words are said AGAIN when a language pack lands: every pack calls renderApp() on its way out (strings-*.js), and a page
     defines its own renderApp AFTER the frame is drawn — so the global is held behind a setter: the page's function runs, then the frame's
     resay (⌂ Home · the title · the switcher · the areas). One place; no page copies it (walk-locale: "Home" was plain English on every page). */
  var pageRender = typeof root.renderApp === 'function' ? root.renderApp : null, frameResay = null;
  try {
    Object.defineProperty(root, 'renderApp', { configurable: true,
      get: function () { return function () { if (pageRender) pageRender(); if (frameResay) frameResay(); }; },
      set: function (fn) { pageRender = typeof fn === 'function' ? fn : null; } });
  } catch (e) { if (root.cbQuiet) root.cbQuiet('shell:renderApp', e); }
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (_) { return null; } }

  /** the API base, decided the way the pages decide it (CFG.API_BASE) — here once, so a page that mounts the shell need not copy it.
      HX1: the deploy's address is window.CB_API (/config.js, loaded first by every page) — never a host in code */
  function apiBase() {
    var f = lsGet('cb_api_base');
    if (f) return f === 'stage' ? (root.CB_API || '') : f;
    var h = root.location && root.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
    return root.CB_API || '';
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
    '--sh-on:var(--on-ok,var(--on-accent,#FFFFFF));--sh-scrim:rgba(29,27,22,.32);--sh-shadow:rgba(29,27,22,.18);--sh-hover:rgba(0,0,0,.04);',
    '--sh-bar:44px;--sh-navw:58px;',
    'box-sizing:border-box;color:var(--sh-ink);font-family:var(--f-ui,"IBM Plex Sans",system-ui,sans-serif);font-size:calc(14.5px * var(--k,1));line-height:1.42;text-align:start}',
    ':root[data-themed] .cbsh{--sh-green-d:color-mix(in srgb,var(--ok-2,#0D4A2B) 80%,var(--ink,#1D1B16))}',
    '.cbsh *,.cbsh *::before,.cbsh *::after{box-sizing:border-box}',
    ':where(.cbsh) :where(button,a){font:inherit;color:inherit}:where(.cbsh) :where(button){cursor:pointer}:where(.cbsh) :where(a){text-decoration:none}',
    '.cbsh.full{position:fixed;inset:0;display:flex;flex-direction:column;background:var(--sh-page);z-index:1}',
    /* SHELL-ONE fit:"pane": the shell sits in a page's own main pane (an app with its own sidebar, a CBFrame skeleton) — a block, not the window */
    '.cbsh.pane{position:static;display:block;background:transparent;--sh-bar:55px;overflow:visible}',   /* overflow: a host page's own .pane rule (Country Lab: overflow:auto) clipped the Labs menu at the header's edge (17 Oct) */   /* + its 1px line = 56: the sidebar brand row's height (page-skeleton.css .brand), so the two header lines meet (Round U rule f) */
    '.cbsh.pane .cbsh-work:not(:has(.cbsh-signin:not(:empty))):not(:has(.cbsh-slotwork:not(:empty))){display:none}',
    /* ⌂ Home — the one way home on every page (app + bar modes); the switcher's look, so the bar has one kind of button */
    '.cbsh-tohome{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:1px solid var(--sh-line);border-radius:8px;background:var(--sh-card);font-size:13px;font-weight:600;white-space:nowrap}',
    '.cbsh-tohome:hover{background:var(--sh-panel)}',
    '.cbsh-title{display:inline-flex;align-items:center;gap:7px;min-width:0;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
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
    '.cbsh-lic:empty,.cbsh-bell:empty,.cbsh-ed:empty,.cbsh-sid:empty{display:none}.cbsh-sid{display:flex;--ink:var(--sh-ink,#14201a);--line:var(--sh-line,#d8ccb0)}',
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
    '.cbsh-nv:hover{background:var(--sh-hover)}.cbsh-nv[hidden]{display:none}',
    '.cbsh-nv[aria-current]{background:var(--sh-card);color:var(--sh-green-d);box-shadow:0 0 0 1px var(--sh-line)}.cbsh-nv[aria-current] .i{color:var(--sh-green)}',
    '.cbsh-main{flex:1 1 auto;min-width:0;overflow-y:auto;overflow-x:hidden;scroll-behavior:smooth;scrollbar-width:thin;scrollbar-color:var(--sh-line) transparent}',
    '.cbsh-inner{max-width:1240px;margin:0 auto;padding:16px 24px 28px}',
    '.cbsh-sec{margin-bottom:22px;scroll-margin-top:4px}',
    '.cbsh-cap{display:flex;align-items:center;gap:11px;margin:0 0 10px;position:sticky;top:-1px;z-index:3;background:var(--sh-page);padding:6px 0 5px}',
    '.cbsh-cap b{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--sh-muted);font-weight:700}',
    '.cbsh-cap i{flex:1;height:1px;background:var(--sh-soft);font-style:normal}.cbsh-cap span{font-size:12.5px;color:var(--sh-muted)}',
    '.cbsh-ph{display:none}',
    /* the phone bar's fifth tab (More) exists only on a phone; a tab's badge counts the tiles that Need you */
    '.cbsh-nv{position:relative}.cbsh-nv[data-go=more]{display:none}',
    '.cbsh-nv .bd{position:absolute;top:1px;left:calc(50% + 6px);min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:8px;background:var(--sh-amber-t);border:1px solid var(--sh-amber-b);color:var(--sh-amber-i);font-size:10px;font-weight:700;line-height:14px;text-align:center}',
    '.cbsh-nv .bd.dot{min-width:10px;width:10px;height:10px;padding:0;top:3px}',
    '.cbsh-box.off{border-style:dashed;background:var(--sh-panel);color:var(--sh-muted);cursor:default}.cbsh-box.off:hover{border-color:var(--sh-line)}.cbsh-box.off .no{display:block;clear:left;font-size:13px;margin-top:9px;padding-top:7px;border-top:1px solid var(--sh-hair)}',
    '.cbsh-note{font-size:13px;color:var(--sh-muted);padding:6px 0}',
    /* cards (max three columns, DECISIONS.md) */
    '.cbsh-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
    '.cbsh-box{display:block;width:100%;text-align:left;background:var(--sh-card);border:1px solid var(--sh-line);border-radius:13px;padding:14px 16px;position:relative;transition:border-color .12s}',
    '.cbsh-box:hover{border-color:var(--sh-green)}',
    '.cbsh-box .g{width:32px;height:32px;border-radius:9px;background:var(--sh-panel);display:grid;place-items:center;font-size:15px;color:var(--sh-muted);margin-bottom:9px}',
    '.cbsh-box h4{font-family:"Bricolage Grotesque",sans-serif;font-size:16.5px;font-weight:800;letter-spacing:-.015em;margin:0}',
    '.cbsh-box .what{font-size:12.5px;color:var(--sh-muted);margin:2px 0 0;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:14px}',
    '.cbsh-box .facts{display:flex;flex-direction:column;gap:2px;margin-top:11px;padding-top:9px;border-top:1px solid var(--sh-hair)}',
    /* walk 17 Oct (Athi: "too much information, the screen will expand"): EVERY TILE IS ONE HEIGHT — one line of purpose, two fact lines reserved
       whether or not they arrive, each line cut with … and said in full on hover (title). A tile never grows; more to say is the app's job. */
    '.cbsh-box{height:148px;overflow:visible}.cbsh-sec.labs .cbsh-box,.cbsh-sec.setup .cbsh-box{height:148px}',
    /* walk 17 Oct (Athi: "text bigger, the name next to the icon"): the icon floats beside the name; purpose and facts read one size up */
    '.cbsh-box .g,.cbsh-sec.labs .cbsh-box .g,.cbsh-sec.setup .cbsh-box .g{float:left;width:32px;height:32px;display:grid;margin:0 10px 6px 0;background:var(--sh-panel);font-size:16px}',
    '.cbsh-box h4,.cbsh-sec.labs .cbsh-box h4,.cbsh-sec.setup .cbsh-box h4{font-size:18px;line-height:32px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:16px}',
    '.cbsh-box .what{clear:left;font-size:14px;white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}.cbsh-box .f{font-size:13.5px}.cbsh-box .facts{margin-top:9px;padding-top:7px}',
    '.cbsh-box .facts{flex-direction:row;align-items:center;gap:6px;height:calc(1.35em + 10px)}.cbsh-box .facts:empty{border-top-color:transparent}',
    '.cbsh-box .f{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.35;min-width:0}.cbsh-box .facts>.f{flex:1}',
    /* the rest DROPS DOWN over the page on hover or keyboard focus — the tile keeps its size and nothing below it moves (Athi: "show as a dropdown") */
    /* walk 17 Oct (Athi: "represent the status, active / not active"): THE SERVER SAYS which of three a card is (facts `state`) — the dot is never colour alone */
    '.cbsh-box .st{flex:none;font-size:11.5px;font-weight:700;white-space:nowrap}.cbsh-box .st.needs_you{color:var(--sh-amber-i)}.cbsh-box .st.in_use{color:var(--sh-green-d)}.cbsh-box .st.not_started{color:var(--sh-muted)}',
    '.cbsh-needs{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:0 0 12px;font-size:13.5px}.cbsh-needs[hidden]{display:none}.cbsh-needs b{color:var(--sh-amber-i)}',
    '.cbsh-needs a{border:1px solid var(--sh-line);border-radius:999px;padding:3px 10px;background:var(--sh-card);text-decoration:none;color:inherit}.cbsh-needs a:hover{border-color:var(--sh-green)}',
    '.cbsh-box .more-n{flex:none;font-size:11px;font-weight:700;color:var(--sh-green-d);background:var(--sh-green-t);border-radius:8px;padding:1px 6px}',
    '.cbsh-box .more{display:none;position:absolute;z-index:6;left:-1px;right:-1px;top:calc(100% - 8px);flex-direction:column;gap:3px;padding:9px 16px 11px;background:var(--sh-card);border:1px solid var(--sh-green);border-top:0;border-radius:0 0 13px 13px;box-shadow:0 10px 22px var(--sh-shadow)}',
    '.cbsh-box .more .f{white-space:normal}.cbsh-box:hover .more,.cbsh-box:focus-visible .more{display:flex}',
    '.cbsh-box .f{font-size:12.5px;color:var(--sh-muted);font-family:var(--f-num,"IBM Plex Mono",monospace)}.cbsh-box .f.dn{color:var(--sh-amber-i)}',
    '.cbsh-box .f .act{text-decoration:underline;cursor:pointer;font-weight:600}',
    /* RPT2: the teaser (a sparkline + "↑ +12% vs last year") is a door to Reports › Trend, drawn as a figure, not a link word; it keeps its width beside the line */
    '.cbsh-box .f .act.trend{text-decoration:none;font-weight:500;display:inline-flex;align-items:center;gap:6px}.cbsh-box .facts>.f.trendf{flex:none}',
    '.cbsh-box .arw{position:absolute;top:14px;right:15px;color:var(--sh-ghost);font-size:16px}.cbsh-box:hover .arw{color:var(--sh-green)}',
    '.cbsh-sec.labs .cbsh-box,.cbsh-sec.setup .cbsh-box{padding:12px 14px;border-radius:11px}',
    '.cbsh-sec.labs .cbsh-box h4,.cbsh-sec.setup .cbsh-box h4{font-family:inherit;font-size:14px;font-weight:700;letter-spacing:0}',
    '.cbsh-sec.labs .cbsh-box .g,.cbsh-sec.setup .cbsh-box .g{width:auto;height:auto;background:none;font-size:15px;margin-bottom:6px;display:block}',
    '.cbsh-labs{background:var(--sh-panel);border:1px solid var(--sh-soft);border-radius:14px;padding:4px 16px 15px}.cbsh-labs .cbsh-cap{background:var(--sh-panel)}',
    '.cbsh-base{border:1px dashed var(--sh-line);border-radius:14px;padding:4px 16px 15px}',
    /* CB Commerce pillar boxes: 4 across (the main row), 3 across (the supporting row), cards stacked inside */
    '.cbsh-pils{display:grid;gap:12px;align-items:start}.cbsh-pils.n4{grid-template-columns:repeat(4,minmax(0,1fr))}.cbsh-pils.n3{grid-template-columns:repeat(3,minmax(0,1fr))}.cbsh-pils.n2{grid-template-columns:repeat(2,minmax(0,1fr))}',
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
    /* TOUR-FIX1: the drawer buttons sit at the top of the work and scroll WITH it — a sticky row covered the cards scrolled under it (shell-card-documents) */
    /* CB SIDES (public/app/sides.js): two reference panels, closed until asked for — two drawers behind two small icon buttons at EVERY width, one open at a time; a phone drawer is full width (walk 2026-10-17, Athi: "can be just an icon … if someone clicks we can show") */
    '.cbsh-work{position:relative}.cbsh-side,.cbsh-tools{display:none}',
    '.cbsh.has-sides .cbsh-tools{display:flex;justify-content:flex-end;gap:6px;padding:4px 0;margin-bottom:4px}.cbsh.has-sides .cbsh-tools .cbsd-btn{display:inline-block}',
    '.cbsh.has-sides .cbsh-side.drawer{display:block;position:absolute;top:48px;bottom:0;width:min(330px,92vw);z-index:40;margin:0;border-radius:0;overflow:auto;box-shadow:0 0 30px var(--sh-shadow)}',
    '.cbsh.has-sides .cbsh-side.l.drawer{left:var(--sh-navw)}.cbsh.has-sides .cbsh-side.r.drawer{right:0}.cbsh .cbsd-x{display:inline-block}',
    '@media(max-width:700px){.cbsh.has-sides .cbsh-side.drawer{left:0!important;right:0!important;width:100%}}',
    '@media(max-width:1100px){.cbsh-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cbsh-sin{grid-template-columns:1fr 1.4fr}.cbsh-sin .cbsh-col:nth-child(3){grid-column:1/-1}}',
    /* PHONE — a different layout: bottom tabs, one area at a time, rows, the sheet drops over the page, the kural once on Home */
    '@media(max-width:700px){',
    /* 390: the app switcher opens inside the screen (e2e/shell.cjs: its right edge was at 440 of 390) */
    '.cbsh-swpop{position:fixed;left:16px;right:16px;top:52px;min-width:0}',
    /* the tile's own line is hidden where .more lists every line: the status badge is the first child now, so :has(+.more-n) finds it */
    '.cbsh-box,.cbsh-sec.labs .cbsh-box,.cbsh-sec.setup .cbsh-box{height:auto}.cbsh-box .facts{height:auto}.cbsh-box .more{position:static;display:flex;border:0;box-shadow:none;padding:0;background:none}.cbsh-box .more-n,.cbsh-box .facts>.f:first-child:not(:only-child),.cbsh-box .facts>.f:has(+.more-n){display:none}',
    '.cbsh{--sh-bar:52px}.cbsh-bar{padding:0 13px;gap:6px;container-type:inline-size}.cbsh-who{padding:4px 4px;margin-left:-4px;flex:1 1 auto}.cbsh-who b{font-size:14px}',   /* a pane keeps its 55px on a phone too: its line meets the sidebar's brand row (frame-every-width rule f) */
    /* INT7b-GREEN: a 390 px bar held 405 px (mark · shop · switcher · chip · bell · ⌂ · avatar, 9 px gaps) and cut the shop's name to 55 px. The name takes the slack
       (the spacer gives way to it) at 14 px; a bar narrower than its need (a pane beside the sidebar, ~326 px) shows the whole name or none — never "F…" (the button's aria-label still says it) */
    '.cbsh-bar:has(.cbsh-who) .cbsh-grow{display:none}',
    '@container (max-width:359px){.cbsh-who b{display:none}}',
    '.cbsh-tohome .hw{display:none}.cbsh-tohome{padding:0 8px}.cbsh-title{font-size:13px}',   /* a phone: ⌂ alone (aria-label keeps the word) */
    '.cbsh-swb .sn{display:none}',   /* a phone: the switcher is its icon — the screen chip names the screen; with ⌂ Home beside it the app's name no longer fits a 390 px pane (INT7b, walk-returns R6) */
    /* a phone, signed in: the shop's name is the bar's name — the page's title would cut it (area pitfall: "the shared top bar cuts the shop name at 390 px"); signed out the title shows */
    '.cbsh-bar:has(.cbsh-who) .cbsh-title{display:none}',
    '.cbsh-chip .lbl,.cbsh-chip .lg{display:none}.cbsh-chip .sm{display:inline}.cbsh-chip{padding:0 10px;gap:6px}',
    '.cbsh-sheet{position:absolute;left:0;right:0;top:var(--sh-bar);max-height:calc(100dvh - var(--sh-bar) - 70px);box-shadow:0 14px 28px var(--sh-shadow);border-bottom:1px solid var(--sh-line)}',
    '.cbsh-hdr.open .cbsh-scrim{display:block;position:fixed;inset:var(--sh-bar) 0 0 0;background:var(--sh-scrim);z-index:-1}',
    '.cbsh-sin{grid-template-columns:1fr;gap:16px;padding:14px 14px 16px}.cbsh-sin .cbsh-col:nth-child(3){grid-column:auto}.cbsh-ln.none{grid-column:auto}',
    '.cbsh-lrow{grid-template-columns:1fr auto auto;gap:8px;min-height:36px}.cbsh-lrow .no{display:none}.cbsh-rn{height:30px;padding:0 12px}',
    '.cbsh-work{flex-direction:column-reverse}',
    '.cbsh-nav{flex:0 0 auto;flex-direction:row;justify-content:space-around;gap:0;border-right:0;border-top:1px solid var(--sh-line);padding:5px 4px calc(5px + env(safe-area-inset-bottom,0px));background:var(--sh-card)}',
    '.cbsh-nv{flex:1;width:auto;padding:6px 0 4px;border-radius:9px}.cbsh-nv .i{font-size:19px}.cbsh-nv .t{font-size:10.5px}',
    '.cbsh-nv[aria-current]{background:var(--sh-green-t);box-shadow:inset 0 3px 0 var(--sh-green)}',
    /* five tabs: Trade, Labs and Setup live behind More; 44 px to hit, 11 px words */
    '.cbsh-nv[data-go=trade],.cbsh-nv[data-go=labs],.cbsh-nv[data-go=setup]{display:none}.cbsh-nv[data-go=more]{display:flex}.cbsh-nv[data-go=more][hidden]{display:none}',
    '.cbsh-nv{min-height:44px;justify-content:center}.cbsh-nv .t{font-size:11px}.cbsh-nv .bd{left:calc(50% + 4px)}',
    '.cbsh-main[data-tab=more] .cbsh-sec.trade,.cbsh-main[data-tab=more] .cbsh-sec.labs,.cbsh-main[data-tab=more] .cbsh-sec.setup{display:block;margin-bottom:10px}',
    '.cbsh-sec.trade .cbsh-ph,.cbsh-sec.labs .cbsh-ph,.cbsh-sec.setup .cbsh-ph{margin:0 0 8px}',
    '.cbsh-row{display:flex;align-items:center;gap:10px;width:100%;min-height:56px;padding:8px 14px;border:1px solid var(--sh-line);border-radius:13px;background:var(--sh-card);color:inherit;font:inherit;text-align:left}',
    '.cbsh-row .rt{flex:1;min-width:0;display:flex;flex-direction:column}.cbsh-row .rn{font-size:17px;font-weight:800}.cbsh-row .rs{font-size:12.5px;font-weight:400;color:var(--sh-muted)}',
    '.cbsh-row .chev{transition:transform .12s}.cbsh-row[aria-expanded=true] .chev{transform:rotate(90deg)}',
    '.cbsh-sec.trade:not(.open)>*:not(.cbsh-ph),.cbsh-sec.labs:not(.open)>*:not(.cbsh-ph),.cbsh-sec.setup:not(.open)>*:not(.cbsh-ph){display:none}',
    '.cbsh-inner{padding:12px 13px 20px}.cbsh-main{scroll-behavior:auto}',
    '.cbsh-sec{display:none;margin-bottom:0}',
    '.cbsh-main[data-tab=home] .cbsh-sec.home,.cbsh-main[data-tab=selling] .cbsh-sec.selling,.cbsh-main[data-tab=money] .cbsh-sec.money,.cbsh-main[data-tab=running] .cbsh-sec.running,.cbsh-main[data-tab=trade] .cbsh-sec.trade,',
    '.cbsh-main[data-tab=labs] .cbsh-sec.labs,.cbsh-main[data-tab=setup] .cbsh-sec.setup{display:block}',
    '.cbsh-cap{display:none}',
    '.cbsh-pils.n4,.cbsh-pils.n3,.cbsh-pils.n2{grid-template-columns:1fr;gap:10px}.cbsh-pil{padding:8px 0 0;background:none;border:0}.cbsh-pil h3{margin-left:2px}.cbsh-pil .cbsh-grid{gap:0}',
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
  /* SHELL-ONE: the type SYSTEM.md §2 names (Bricolage Grotesque · IBM Plex Sans · IBM Plex Mono) comes WITH the frame, once — a page never links its own face */
  var FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=IBM+Plex+Mono:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap';
  function addFonts() {
    if (!doc || !doc.head) return;
    var hasPlexLink = [].some.call(doc.querySelectorAll('link[rel="stylesheet"]'), function (link) { return /IBM\+Plex\+Sans/.test(link.getAttribute('href') || ''); });
    if (hasPlexLink) return;
    var link = doc.createElement('link'); link.id = 'cbsh-fonts'; link.rel = 'stylesheet'; link.href = FONTS_HREF; doc.head.appendChild(link);
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

  /* THE FRAME's markup, one template (SHELL-ONE): the header (mark · shop · switcher or title · chip · edition · licence · bell · ⌂ Home · avatar),
     then — not in bar mode — the work area (Home: the rail and the areas; an app: the sign-in slot and the work slot) and the foot.
     frame = { mode, person, sheetId, title, appId, homeHref, sides } */
  /* a money icon before the header names the currency: the marked neutral sign; paintMoneyGlyphs() swaps it for the shop's symbol */
  function neutralGlyph(icon) { return icon === MONEY_GLYPH ? '<span data-glyph="money">' + MONEY_GLYPH + '</span>' : esc(icon); }
  function frameHTML(frame) { return headerHTML(frame) + workHTML(frame); }
  /** SHELL-ONE: in bar mode the bar names its page (the shop, the lab) — { icon, name }; nothing otherwise */
  function titleHTML(frame) {
    if (frame.mode !== 'bar' || !frame.title) return '';
    return '<span class="cbsh-title" data-testid="shell-title"><span aria-hidden="true">' + esc(frame.title.icon || '') + '</span><span class="tw">' + esc(T(frame.title.name || '')) + '</span></span>';
  }
  /** the header: the bar (mark · shop · switcher or title · chip · edition · licence · bell · ⌂ Home · avatar) and the shop's sheet */
  function headerHTML(frame) {
    return '<header class="cbsh-hdr" data-testid="shell-header">' +
      '<div class="cbsh-bar" data-testid="shell-bar">' +
      '<span class="cbsh-mark" aria-hidden="true" data-testid="shell-mark">▣</span>' +
      (frame.person ? '<button type="button" class="cbsh-who" data-testid="shell-shop" aria-expanded="false" aria-controls="' + frame.sheetId + '"><b data-testid="shop-name"></b><span class="chev" aria-hidden="true">▼</span></button>' : '') +
      (frame.mode === 'app' ? '<div class="cbsh-sw"><button type="button" class="cbsh-swb" data-testid="shell-switcher" aria-haspopup="true" aria-expanded="false"></button><div class="cbsh-swpop" data-testid="shell-switcher-menu" hidden></div></div>' : '') +
      titleHTML(frame) +
      '<span class="cbsh-grow"></span>' +
      (frame.mode !== 'bar' || frame.appId ? '<span class="cbsh-sid" data-testid="shell-screen-id"></span>' : '') +   /* SCREEN-ID: this screen's name · code (app/screen-id.js, if the page loaded it) */
      '<span class="cbsh-ed" data-testid="shell-edition"></span>' +
      '<span class="cbsh-lic" data-testid="shell-licence"></span>' +
      '<span class="cbsh-bell" data-testid="shell-bell" data-slot="bell"></span>' +
      /* SHELL-ONE: ⌂ Home on every page but Home itself — the storefront's frame.homeHref is the shop's front */
      (frame.mode !== 'home' ? '<a class="cbsh-tohome" href="' + esc(frame.homeHref) + '" data-testid="shell-home" aria-label="' + esc(T(W.areas.home)) + '"><span aria-hidden="true">' + ICON.home + '</span><span class="hw">' + esc(T(W.areas.home)) + '</span></a>' : '') +   /* .cbsh-tohome, never .cbsh-home: that is Home's own slot (INT7b: the link's rule had laid Home's sections in a row) */
      '<span class="cbsh-av" data-testid="shell-avatar"></span>' +
      '</div>' +
      (frame.person ? '<div class="cbsh-sheet" id="' + frame.sheetId + '" role="region" data-testid="shell-sheet" hidden></div><div class="cbsh-scrim" data-testid="shell-scrim"></div>' : '') +
    '</header>';
  }
  /** the work area under the header — nothing in bar mode; Home: the rail and the areas; an app: the sign-in slot and the work slot; then the foot */
  function workHTML(frame) {
    if (frame.mode === 'bar') return '';
    return '<div class="cbsh-work">' +
      (frame.mode === 'home' ? '<nav class="cbsh-nav" data-testid="shell-nav" aria-label="Areas">' + AREAS.map(function (a) {
        return '<button type="button" class="cbsh-nv" data-go="' + a + '" data-testid="shell-nav-' + a + '"><span class="i" aria-hidden="true">' + neutralGlyph(ICON[a]) + '</span><span class="t">' + esc(W.areas[a]) + '</span></button>';
      }).join('') + '<button type="button" class="cbsh-nv" data-go="more" data-testid="shell-nav-more"><span class="i" aria-hidden="true">' + ICON.more + '</span><span class="t">' + esc(W.areas.more) + '</span></button></nav>' : '') +
      (frame.mode === 'home' ? '<div class="cbsh-pfoot" data-testid="shell-pfoot"></div>' : '') +
      (frame.sides ? '<aside class="cbsh-side l" data-slot="sideL"></aside>' : '') +
      '<main class="cbsh-main" data-testid="shell-main" data-tab="home"><div class="cbsh-inner">' +
        (frame.sides ? '<div class="cbsh-tools" data-testid="shell-sidetools"><button type="button" data-slot="btnL"></button><button type="button" data-slot="btnR"></button></div>' : '') +
        '<div class="cbsh-signin" data-testid="shell-signin"></div>' +
        (frame.mode === 'home' ? '<div class="cbsh-areas" data-testid="shell-areas"></div>' : '<div class="cbsh-slotwork" data-slot="work"></div>') +
      '</div></main>' +
      (frame.sides ? '<aside class="cbsh-side r" data-slot="sideR"></aside>' : '') +
      '</div>' +
      '<div class="cbsh-foot" data-testid="shell-foot"></div>';
  }

  /* SET-WALK1 · W8: the edition chip looked like a button and was a label. It IS a button now: a press opens the avatar menu on its Edition group
     (the one switch, CBAvatar.set('edition')); the ✕ beside it goes straight back to Everything (the full showing). */
  function editionChipsHTML(edition) {
    if (!edition) return '';
    return '<button type="button" class="cbsh-chip due" data-testid="shell-edition-chip" data-edition="' + esc(edition.key) + '" title="' + esc(W.editionOpen || 'Change what this shows') + '">' + esc(edition.chip) + '</button>'
      + '<button type="button" class="cbsh-chip due" data-testid="shell-edition-off" aria-label="' + esc(W.editionOff || 'Show everything') + '" title="' + esc(W.editionOff || 'Show everything') + '" style="padding:0 8px;margin-inline-start:4px">✕</button>';
  }
  /** wire the two chips editionChipsHTML drew: the chip opens the choice, the ✕ returns to the full showing */
  function wireEditionChips(spot) {
    var openChip = spot.querySelector('[data-testid="shell-edition-chip"]'), offChip = spot.querySelector('[data-testid="shell-edition-off"]');
    if (openChip) openChip.onclick = function () { openEditionChoice(); };
    if (offChip) offChip.onclick = function () { if (root.CBAvatar && root.CBAvatar.set) root.CBAvatar.set('edition', 'full'); };
  }
  /** W8: open the avatar menu and put the Edition group in view — the choice lives in ONE place (avatar.js editionsHtml), the chip is its door */
  function openEditionChoice() {
    var avatarButton = root.document.querySelector('[data-testid="avatar"]');
    if (!avatarButton) return;
    if (!(root.CBAvatar && root.CBAvatar.isOpen && root.CBAvatar.isOpen())) avatarButton.click();
    var group = root.document.querySelector('[data-testid="edition-group"]');
    if (!group) return;
    try { group.scrollIntoView({ block: 'nearest' }); } catch (err) { if (root.cbQuiet) root.cbQuiet('shell:openEditionChoice', err); }
    var first = group.querySelector('button'); if (first) first.focus();
  }
  /* ── the money glyph: the shop's own currency symbol once the header names its currency; ¤ before that or with none ── */
  function moneySymbol(header) {
    var currency = header && header.business && header.business.currency, locale = root.CBLocale;
    if (!currency || !locale || typeof locale.symbol !== 'function') return MONEY_GLYPH;
    try { return locale.symbol(currency) || MONEY_GLYPH; } catch (err) { if (root.console) root.console.warn('shell moneySymbol: the locale could not name ' + currency, err); return MONEY_GLYPH; }
  }
  /** an entry's icon as painted: a money icon becomes the shop's symbol and is marked, so a later header read can re-swap it */
  function moneyGlyph(icon, header) { return icon === MONEY_GLYPH ? '<span data-glyph="money">' + esc(moneySymbol(header)) + '</span>' : esc(icon); }
  function paintMoneyGlyphs(pageDoc, header) {
    var symbol = moneySymbol(header);
    Array.prototype.forEach.call(pageDoc.querySelectorAll('[data-glyph="money"]'), function (node) { node.textContent = symbol; });
  }
  /* ── NAMES-1: a name that is the shop's COUNTRY word (manifest `word`: Stock · Inventory) — the one per-country words reader, helpers.js packWord,
     with the country of the one /me read (CBAvatar.shopCountry); '' = no such word on this page, so the manifest's own name stands ── */
  function countryWord(kind) {
    if (!kind || typeof root.packWord !== 'function') return '';
    var avatar = root.CBAvatar, countryCode = (avatar && typeof avatar.shopCountry === 'function' && avatar.shopCountry()) || '';
    return root.packWord(kind, countryCode) || '';
  }
  /* an entry's pillar (a missing one falls back to its area) and the Home section it stands in: a boxed area, a flat one, or its own */
  function pillarOf(entry) { return entry.pillar || PDEFAULT[entry.area] || entry.area; }
  function sectionOf(entry) {
    var pillar = pillarOf(entry), area;
    for (area in PILLARS) if (PILLARS[area].indexOf(pillar) >= 0) return area;
    for (area in FLAT_PILLARS) if (FLAT_PILLARS[area].indexOf(pillar) >= 0) return area;
    return pillar;
  }
  /** an entry's name as painted: a country word is marked, so the /me answer (cb:me) can re-say it */
  function entryName(e) {
    var word = countryWord(e.word);
    return word ? '<span data-word="' + esc(e.word) + '">' + esc(T(word)) + '</span>' : esc(T(e.name));
  }
  /* Home's tiles and chips, said again IN PLACE when a pack lands after the manifest painted them (walk-locale L-home: 26 vs 100 by who won
     the race). In place, not a repaint: that would wipe the facts and states readFacts already wrote. */
  function resayTiles(pageEl, manifest) {
    if (!manifest) return;
    var entryById = {}; (manifest.entries || []).forEach(function (entry) { if (entry && entry.id) entryById[entry.id] = entry; });
    [].forEach.call(pageEl.querySelectorAll('.cbsh-box[data-id]'), function (tile) {
      var entry = entryById[tile.getAttribute('data-id')]; if (!entry) return;
      var title = tile.querySelector('h4'); if (title) title.innerHTML = entryName(entry);
      var purpose = tile.querySelector('.what'); if (purpose && entry.what) { purpose.textContent = T(entry.what); purpose.setAttribute('title', T(entry.what)); }
    });
    [].forEach.call(pageEl.querySelectorAll('.cbsh-sc[data-testid^="shell-chip-"]'), function (chip) {
      var entry = entryById[chip.getAttribute('data-testid').slice('shell-chip-'.length)]; if (!entry) return;
      var label = chip.querySelector('b'); if (label) label.innerHTML = entryName(entry);
      var tag = chip.querySelector('.tag'), chipState = chip.getAttribute('data-state'); if (tag && W.tag[chipState]) tag.textContent = T(W.tag[chipState]);
    });
  }
  function paintCountryWords(pageDoc) {
    Array.prototype.forEach.call(pageDoc.querySelectorAll('[data-word]'), function (node) {
      var word = countryWord(node.getAttribute('data-word')); if (word) node.textContent = T(word);
    });
  }

  /* ── a Home card's STATE (walk 17 Oct, Athi: "represent the status, active / not active") ── the server's facts `state` when it says;
     until every card does, a line marked tone 'dn' is needs_you and any other line in_use; no lines, no state */
  function cardState(answer, lines) {
    if (answer && W.state[answer.state]) return answer.state;
    if (!lines.length) return '';
    return lines.some(function (line) { return line && line.tone === 'dn'; }) ? 'needs_you' : 'in_use';
  }
  function stateHTML(state) { return '<span class="st ' + state + '" data-testid="shell-state" data-state="' + state + '">' + (state === 'not_started' ? '○ ' : '● ') + esc(T(W.state[state])) + '</span>'; }
  /* a card's facts on its tile: NOT STARTED says so and invites (never "No X yet" — the tile is already the link); otherwise ONE line, and
     two or more → a +n badge with every line in the drop-down (.more) */
  function factsHTML(card, lines, state, lineHTML) {
    var badge = state ? stateHTML(state) : '';
    if (state === 'not_started') return badge + '<span class="f">' + esc(T(W.setUp)) + ' ›</span>';
    if (lines.length < 2) return badge + lines.map(lineHTML).join('');
    return badge + lineHTML(lines[0]) + '<span class="more-n" aria-hidden="true">+' + (lines.length - 1) + ' ' + esc(T(W.moreWord)) + '</span><span class="more" data-testid="shell-more-' + esc(card.id) + '">' + lines.map(lineHTML).join('') + '</span>';
  }
  /* Home's "Needs you" strip: only the cards whose state is needs_you, each a door; hidden when none (every tile stays below it). Returns the state. */
  var needsByCard = {};
  function noteNeeds(card, state, routeOf) {
    if (state === 'needs_you') needsByCard[card.id] = card; else delete needsByCard[card.id];
    var strip = doc.querySelector('[data-testid="shell-needs"]'); if (!strip) return state;
    var list = Object.keys(needsByCard).map(function (id) { return needsByCard[id]; });
    strip.hidden = !list.length;
    strip.innerHTML = '<b>● ' + esc(T(W.needsYou)) + '</b>' + list.map(function (entry) { return '<a href="' + esc(routeOf(entry)) + '" data-testid="shell-needs-' + esc(entry.id) + '">' + esc(T(entry.name)) + '</a>'; }).join('');
    return state;
  }
  /**
   * RPT2: the Till card's teaser — the server's figures.trend (8 weeks' sales, the engine's change vs last year) as a sparkline + words, a door
   * into Reports › Trend. Nothing from the server → nothing drawn (omit, never 0); CBDraw absent (a page without it) → nothing.
   */
  function trendHTML(trend) {
    if (!trend || !root.CBDraw) return '';
    var change = trend.vs_last_year_pct, locale = root.CBLocale;
    var amount = change == null ? '' : (locale && locale.number ? locale.number(Math.abs(change), { maximumFractionDigits: 1 }) : String(Math.abs(change)));
    var words = change == null ? '' : (change > 0 ? '↑ +' : change < 0 ? '↓ −' : '= ') + amount + '% ' + T(W.vsLastYear);
    var spark = root.CBDraw.spark(trend.spark, { width: 64, height: 16, stroke: 'var(--sh-green-d,#2d6a4f)', aria: T(W.salesWeeks) + (words ? ', ' + words : ''), tid: 'shell-fact-spark' });
    if (!spark) return '';
    return '<span class="f trendf"><span class="act trend" role="link" tabindex="0" data-href="/finance.html#/reports/trend/week" data-testid="shell-fact-trend">' + spark + esc(words) + '</span></span>';
  }
  /* a fact line's words: the server names an amount or a moment ({money} {time} {date} {when}) and sends it as data (money:{amount,currency}, at: ISO);
     the reader's locale words it — "₹420", "09:33", "today 09:40" — never "INR 420.00" or an ISO date */
  function lineWords(t) {
    var L = root.CBLocale, at = t.at, m = t.money, text = String(t.text == null ? '' : t.text);
    var time = function () { try { return (L && L.time && L.time(at)) || ''; } catch (_) { return ''; } };
    var date = function () { try { return (L && L.date && L.date(at)) || String(at || '').slice(0, 10); } catch (_) { return String(at || '').slice(0, 10); } };
    var sameDay = function () { var d = new Date(at), n = new Date(); return !isNaN(d) && d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); };
    return text.replace(/{(money|time|date|when)}/g, function (_, k) {
      if (k === 'money') return m ? ((L && L.money && L.money(m.amount, m.currency)) || (m.currency + ' ' + m.amount)) : '';
      if (k === 'time') return time();
      if (k === 'date') return date();
      return (sameDay() ? W.today : date()) + ' ' + time();
    }).trim();
  }
  /* each built entry's facts: GET its URL → { lines:[ 'text' | { text, tone:'dn', money?, at?, act?:{ label, href } } ] }, at most two lines; act = the button that clears the line */
  function lineHTML(l) {
    var t = typeof l === 'string' ? { text: l } : (l || {});
    var act = t.act && t.act.label && t.act.href ? ' <span class="act" role="link" tabindex="0" data-href="' + esc(t.act.href) + '" data-testid="shell-fact-act">' + esc(t.act.label) + ' ›</span>' : '';
    return '<span class="f' + (t.tone === 'dn' ? ' dn' : '') + '">' + esc(lineWords(t)) + act + '</span>';
  }
  /* each tab's badge = how many of its tiles Need you; More shows a dot when any tile behind it does (tabOf maps a tile's section to the phone's tab) */
  function paintBadges(shellEl) {
    var countByTab = {};
    Object.keys(needsByCard).forEach(function (cardId) {
      var section = sectionOf(needsByCard[cardId]);
      countByTab[section] = (countByTab[section] || 0) + 1;
      if (tabOf(section, true) === 'more') countByTab.more = (countByTab.more || 0) + 1;
    });
    [].forEach.call(shellEl.querySelectorAll('.cbsh-nv'), function (button) {
      var oldBadge = button.querySelector('.bd'); if (oldBadge) button.removeChild(oldBadge);
      var tabId = button.getAttribute('data-go'), count = countByTab[tabId]; if (!count) return;
      var isDot = tabId === 'more';
      button.insertAdjacentHTML('beforeend', '<b class="bd' + (isDot ? ' dot' : '') + '" role="img" aria-label="' + count + ' ' + esc(T(W.needsHand)) + '">' + (isDot ? '' : count) + '</b>');
    });
  }
  /* More's rows: one open at a time; force = open it (a tap on an open row closes it) */
  function openRow(shellEl, area, force) {
    [].forEach.call(shellEl.querySelectorAll('.cbsh-sec.trade,.cbsh-sec.labs,.cbsh-sec.setup'), function (section) {
      var isOpen = section.getAttribute('data-area') === area && (force || !section.classList.contains('open'));
      section.classList.toggle('open', isOpen);
      var rowButton = section.querySelector('.cbsh-row'); if (rowButton) rowButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }
  /* a section's phone heading: Selling and Money are a title; Trade, Labs and Setup are the three ROWS of the More page (a tap opens the row's tiles) */
  function sectionHeadingHTML(area) {
    var name = esc(T(W.caption[area]));
    if (PHONE_MORE.indexOf(area) < 0) return '<h2 class="cbsh-ph">' + name + '</h2>';
    return '<h2 class="cbsh-ph"><button type="button" class="cbsh-row" data-row="' + area + '" aria-expanded="false" data-testid="shell-row-' + area + '"><span class="rt"><span class="rn">' + name + '</span><span class="rs">' + esc(T(W.sub[area] || '')) + '</span></span><span class="chev" aria-hidden="true">›</span></button></h2>';
  }
  /* NAV-MAP 8: a tile that needs THIS shop's id and has none is greyed with its sentence (show the action, say why) - never a link to a blank page */
  function greyedTileHTML(entry, iconHTML, signedIn) {
    return '<div class="cbsh-box off" aria-disabled="true" data-testid="shell-card-' + esc(entry.id) + '" data-id="' + esc(entry.id) + '"><span class="g" aria-hidden="true">' + iconHTML + '</span><h4>' + entryName(entry) + '</h4>' +
      (entry.what ? '<p class="what">' + esc(T(entry.what)) + '</p>' : '') + '<span class="no" data-testid="shell-off-' + esc(entry.id) + '">' + esc(T(signedIn ? W.noShop : W.signInShop)) + '</span></div>';
  }
  /* the area a go() asks for, made real: More is the phone's tab (a laptop shows the three areas themselves); an area this showing does not draw is Home */
  function resolveArea(areaId, onPhone, drawn) {
    if (areaId === 'more') return onPhone ? 'more' : 'trade';
    return drawn.indexOf(areaId) < 0 ? 'home' : areaId;
  }
  /* the area Home opens on: the page's choice, else the address's #area (More only on a phone), else Home */
  function startArea(wanted, hashArea, onPhone) {
    var area = wanted || (AREAS.indexOf(hashArea) >= 0 || hashArea === 'more' ? hashArea : 'home');
    return area === 'more' && !onPhone ? 'trade' : area;
  }
  /* the greyed shop tiles whose entry the manifest can now open */
  function greyedEntries(shellEl, manifest) {
    var wanted = [].map.call(shellEl.querySelectorAll('.cbsh-box.off[data-id]'), function (tile) { return tile.getAttribute('data-id'); });
    return ((manifest && manifest.entries) || []).filter(function (entry) { return entry && wanted.indexOf(entry.id) >= 0; });
  }
  /* the nav buttons an edition leaves out: an area it does not draw; More only when none of its three areas is drawn */
  function navHidden(navId, drawn) {
    return navId === 'more' ? !PHONE_MORE.some(function (area) { return drawn.indexOf(area) >= 0; }) : drawn.indexOf(navId) < 0;
  }
  function mount(el, o) {
    if (!el) return null;
    o = o || {};
    addCss(); addFonts();
    var host = o.host || null, mode = host && host.bar ? 'bar' : host ? 'app' : 'home';
    var appId = host && host.app ? String(host.app) : '';   /* bar mode too (SHELL-ONE): the storefront and the labs name their app for the chip */
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
    el.classList.remove('full', 'pane');
    if (mode !== 'bar') el.classList.add(o.fit === 'pane' ? 'pane' : 'full');
    el.setAttribute('data-testid', 'cbshell');
    el.setAttribute('data-mode', mode);

    var shopName = function () {
      var b = S.header && S.header.business;
      return (b && b.name) || (person && person.entity) || (sess && sess.entity) || W.yourShop;
    };

    /* CB Sides: only on Home, only signed in, only if the page loaded sides.js (the same rule as the avatar, bell and kural) */
    var sides = mode === 'home' && !!person && !!(root.CBSides && root.CBSides.mount);
    if (sides) el.classList.add('has-sides');

    el.innerHTML = frameHTML({ mode: mode, person: person, sheetId: sheetId, title: o.title, appId: appId, homeHref: homeHref, sides: sides });

    var $ = function (s) { return el.querySelector(s); };
    var hdr = $('.cbsh-hdr'), sheet = $('.cbsh-sheet'), who = $('.cbsh-who'), main = $('.cbsh-main');
    var slots = { bell: $('.cbsh-bell'), alerts: null, home: null, work: $('[data-slot="work"]') };
    /* SCREEN-ID: the app's screen code in the bar — the one chip (CBScreenId); a frame with sections names the section (page-frame.js setActive) */
    if ((mode !== 'bar' || appId) && root.CBScreenId) { root.CBScreenId.here(appId || 'home'); $('.cbsh-sid').appendChild(root.CBScreenId.chip()); }

    /* ── the bar ── */
    function paintBar() {
      if (who) { var levelWord = person && person.level ? ' · ' + person.level : ''; who.querySelector('b').textContent = shopName() + levelWord; who.setAttribute('aria-label', shopName() + levelWord); }
      if (sheet) sheet.setAttribute('aria-label', shopName());
      var lic = $('.cbsh-lic'), w = S.header ? worstOf(S.header.licences) : null;
      lic.innerHTML = w ? '<button type="button" class="cbsh-chip ' + w.band + '" data-testid="shell-licence-chip" data-band="' + w.band + '">' + (w.band === 'due' ? '●' : '⚠') +
        ' <span class="lbl">' + esc(w.label) + '</span> <span class="d">' + (w.days_left < 0 ? '<span class="lg">' + esc(W.expired(-w.days_left)) + '</span><span class="sm">' + esc(W.lapsed) + '</span>' : esc(daysWord(w))) + '</span></button>' : '';
    }

    /* ── the edition: a chip in the bar naming the view (absent on the full app) — the chip look the licence uses, never a new one ── */
    function edition() { return root.CBEdition && S.manifest ? root.CBEdition.info(S.manifest) : null; }
    function paintEdition() {
      var ed = edition(), spot = $('.cbsh-ed'); spot.innerHTML = editionChipsHTML(ed); wireEditionChips(spot);
      var line = $('[data-testid="shell-edition-line"]');
      if (line) { line.textContent = ed ? ed.line : ''; line.hidden = !(ed && ed.line); }
    }

    function glyph(icon) { return moneyGlyph(icon, S.header); }   /* the module-level moneyGlyph, with this shell's header */
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
    function shown() { var m = root.CBEdition && S.manifest ? root.CBEdition.view(S.manifest) : S.manifest; return (m && m.entries) || []; }
    function entriesOf(area) { return shown().filter(function (e) { return e && sectionOf(e) === area; }); }
    /* the areas this showing has: Home always; another area only if the edition draws something in it (the full app: all five) */
    function areasShown() { return !S.manifest || !edition() ? AREAS : AREAS.filter(function (a) { return a === 'home' || entriesOf(a).length; }); }
    /* a pillar box: its title, then the cards that have a page, then the dashed chips (coming · workshop) */
    function pillarBox(p, list) {
      var built = list.filter(function (e) { return e.state === 'built' && e.route; }), rest = list.filter(function (e) { return !(e.state === 'built' && e.route); });
      return '<div class="cbsh-pil" data-pillar="' + p + '" data-testid="shell-pillar-' + p + '"><h3>' + esc(PNAME[p]) + '</h3><div class="cbsh-grid">' + built.map(card).join('') + '</div><div class="cbsh-chips">' + rest.map(chip).join('') + '</div></div>';
    }
    /* H22/S1: a route may name the shop it opens for ({bridge_id}: the Storefront is THIS shop's page, /shop.html?s=<id>); unresolved, the bare page */
    function shopIdOf() { return (person && person.bridgeId) || (sess && sess.bridgeId) || (S.header && S.header.business && S.header.business.bridge_id) || ''; }
    function routeOf(e) {
      var r = String(e.route || ''); if (r.indexOf('{bridge_id}') < 0) return r;
      var bid = shopIdOf();
      return bid ? r.replace('{bridge_id}', encodeURIComponent(bid)) : r.split('?')[0];
    }
    function card(e) {
      if (String(e.route || '').indexOf('{bridge_id}') >= 0 && !shopIdOf()) return greyedTileHTML(e, glyph(e.icon), !!person);
      return '<a class="cbsh-box" href="' + esc(routeOf(e)) + '" data-testid="shell-card-' + esc(e.id) + '" data-id="' + esc(e.id) + '">' +
        '<span class="arw" aria-hidden="true">›</span><span class="g" aria-hidden="true">' + glyph(e.icon) + '</span><h4>' + entryName(e) + '</h4>' +
        (e.what ? '<p class="what" title="' + esc(T(e.what)) + '">' + esc(T(e.what)) + '</p>' : '') + '<span class="facts" data-testid="shell-facts-' + esc(e.id) + '"></span></a>';
    }
    function chip(e) {
      /* H14/P2-5: a workshop row whose function WORKS today (manifest `works`, the roadmap's rule) says so - never the word workshop */
      var st = e.state === 'workshop' ? (e.works ? 'works' : 'workshop') : 'coming';
      /* H36: a workshop item with no page of its own may name the closest built page (`via`): the chip becomes a link there, still marked workshop */
      if (e.via) return '<a class="cbsh-sc" href="' + esc(e.via) + '" data-testid="shell-chip-' + esc(e.id) + '" data-state="' + st + '" data-via="1"' + (e.via_note ? ' title="' + esc(e.via_note) + '"' : '') + '><span class="g" aria-hidden="true">' + glyph(e.icon) + '</span><b>' + entryName(e) + '</b><span class="tag">' + esc(T(W.tag[st])) + '</span></a>';
      return '<span class="cbsh-sc" data-testid="shell-chip-' + esc(e.id) + '" data-state="' + st + '"><span class="g" aria-hidden="true">' + glyph(e.icon) + '</span><b>' + entryName(e) + '</b><span class="tag">' + esc(T(W.tag[st])) + '</span></span>';
    }
    function paintAreas() {
      var box = $('.cbsh-areas'); if (!box) return;
      /* Home is drawn ONCE (the page may already have put its alerts and content in the slots); the four areas are redrawn from the manifest */
      if (!$('.cbsh-sec.home')) {
        box.innerHTML = '<section class="cbsh-sec home" data-area="home" data-testid="shell-area-home"><h2 class="cbsh-ph">' + esc(W.areas.home) + '</h2>' +
          '<div class="cbsh-needs" data-testid="shell-needs" hidden></div><div class="cbsh-note" data-testid="shell-edition-line" hidden></div><div class="cbsh-alerts" data-slot="alerts"></div><div class="cbsh-home" data-slot="home"></div><div class="cbsh-note" data-testid="shell-noapps" hidden>' + esc(W.noApps) + '</div>' +
          '</section><div class="cbsh-more"></div>';
        slots.alerts = $('[data-slot="alerts"]'); slots.home = $('[data-slot="home"]');
      }
      $('[data-testid="shell-noapps"]').hidden = !!S.manifest || S.loadingApps;
      var has = areasShown();
      [].forEach.call(el.querySelectorAll('.cbsh-nv'), function (b) { b.hidden = navHidden(b.getAttribute('data-go'), has); });
      $('.cbsh-more').innerHTML = has.slice(1).map(function (a) {
          var list = entriesOf(a), built = list.filter(function (e) { return e.state === 'built' && e.route; }), rest = list.filter(function (e) { return !(e.state === 'built' && e.route); });
          var cap = '<div class="cbsh-cap"><b>' + esc(T(W.caption[a])) + '</b>' + (W.sub[a] ? '<span>' + esc(T(W.sub[a])) + '</span>' : '') + '<i></i></div>';
          if (PILLARS[a]) {
            var boxes = PILLARS[a].map(function (p) { var l = list.filter(function (e) { return pillarOf(e) === p; }); return l.length ? pillarBox(p, l) : ''; }).join('');
            return '<section class="cbsh-sec ' + a + '" data-area="' + a + '" data-testid="shell-area-' + a + '">' + sectionHeadingHTML(a) + cap + '<div class="cbsh-pils n' + PILLARS[a].length + '">' + boxes + '</div></section>';
          }
          var inner = cap + '<div class="cbsh-grid">' + built.map(card).join('') + '</div><div class="cbsh-chips">' + rest.map(chip).join('') + '</div>';
          var wrap = a === 'labs' ? '<div class="cbsh-labs">' + inner + '</div>' : a === 'setup' ? '<div class="cbsh-base">' + inner + '</div>' : inner;
          return '<section class="cbsh-sec ' + a + '" data-area="' + a + '" data-testid="shell-area-' + a + '">' + sectionHeadingHTML(a) + wrap + '</section>';
        }).join('');
      placeKural();
    }

    /* the header lands after the tiles: a shop tile that was greyed for want of an id opens now */
    function reopenShopTile() {
      if (mode !== 'home' || !S.manifest || !shopIdOf()) return;
      greyedEntries(el, S.manifest).forEach(function (entry) { el.querySelector('.cbsh-box.off[data-id="' + entry.id + '"]').outerHTML = card(entry); readFacts(entry.id); });
    }
    function readFacts(onlyId) {
      if (!person || !S.manifest) return;
      (S.manifest.entries || []).forEach(function (e) {
        if (!e || e.state !== 'built' || !e.facts || (onlyId && e.id !== onlyId)) return;
        var spot = $('[data-testid="shell-facts-' + e.id + '"]'); if (!spot) return;
        get(e.facts).then(function (r) {
          var lines = (r && r.lines) || [], state = noteNeeds(e, cardState(r, lines), routeOf);
          paintBadges(el);
          spot.innerHTML = factsHTML(e, lines, state, lineHTML) + trendHTML(r && r.figures && r.figures.trend);
        }).catch(function () { spot.innerHTML = '<span class="f" title="' + esc(W.factsFailed) + '">—</span>'; });
      });
    }

    function mark(id) {
      S.area = id;
      [].forEach.call(el.querySelectorAll('.cbsh-nv'), function (b) { if (b.getAttribute('data-go') === id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    }
    function go(id) {
      id = resolveArea(id, phone.matches, areasShown());
      if (mode !== 'home') { root.location.href = homeHref + (id === 'home' ? '' : '#' + id); return; }
      if (phone.matches) {
        var phoneTab = tabOf(id, true);
        if (phoneTab === 'more' && id !== 'more') openRow(el, id, true);
        main.setAttribute('data-tab', phoneTab); main.scrollTop = 0; mark(phoneTab); placeKural(); return;
      }
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
      areasShown().forEach(function (id) { var s = $('.cbsh-sec.' + id); if (s && s.offsetTop <= y) cur = id; });
      if (bottom) cur = areasShown().slice(-1)[0];
      mark(cur);
    }

    /* ── the switcher (inside an app): the five areas as links to Home, the app's own menu stays the app's ── */
    function paintSwitcher() {
      var b = $('.cbsh-swb'), pop = $('.cbsh-swpop'); if (!b) return;
      var me = ((S.manifest && S.manifest.entries) || []).filter(function (e) { return e && e.id === host.app; })[0];
      var cur = (me && me.area) || o.area || 'home';
      /* the app's name: its manifest entry; else the page's own title (SHELL-ONE: a lab, a page with no card); else the area */
      var icon = (me && me.icon) || (o.title && o.title.icon) || ICON[cur], name = (me && me.name) || (o.title && o.title.name) || W.areas[cur];
      b.innerHTML = '<span aria-hidden="true">' + glyph(icon) + '</span><span class="sn">' + esc(T(name)) + '</span><span class="chev" aria-hidden="true">▼</span>';   /* through the catalogue: an area is a word (walk-locale) */
      b.setAttribute('title', T(name));
      b.setAttribute('aria-label', W.switcher);
      pop.innerHTML = areasShown().map(function (a) {
        return '<a href="' + esc(homeHref + (a === 'home' ? '' : '#' + a)) + '" data-testid="shell-switch-' + a + '"' + (a === cur ? ' aria-current="true"' : '') + '><span class="i" aria-hidden="true">' + glyph(ICON[a]) + '</span>' + esc(W.areas[a]) + '</a>';
      }).join('');
    }
    function swOpen(v) { var b = $('.cbsh-swb'), pop = $('.cbsh-swpop'); if (!b) return; pop.hidden = !v; b.setAttribute('aria-expanded', v ? 'true' : 'false'); }
    /* the frame's words through the catalogue again (a pack landed after the first paint): ⌂ Home, the bar's title, the switcher, the areas */
    frameResay = function () {
      var homeWord = $('.cbsh-tohome .hw'), homeLink = $('.cbsh-tohome'), titleWord = $('.cbsh-title .tw');
      if (homeWord) homeWord.textContent = T(W.areas.home); if (homeLink) homeLink.setAttribute('aria-label', T(W.areas.home));
      if (titleWord && o.title) titleWord.textContent = T(o.title.name || '');
      paintSwitcher();
      AREAS.concat(['more']).forEach(function (area) { var label = $('.cbsh-nv[data-go="' + area + '"] .t'); if (label) label.textContent = T(W.areas[area]); });
      if (mode === 'home') resayTiles(el, S.manifest);
    };

    /* ── the kural: the footer band on a laptop; once, at the foot of Home, on a phone ── */
    function placeKural() {
      /* CL3: kural:false = the PAGE owns the band (CBFrame's skeleton pages put it at the body's foot) — a resize must never pull it up into the header */
      if (o.kural === false) return;
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
    /* a fact line's own button sits inside the card's link: it goes where it says, the card does not */
    el.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('.cbsh-box .f .act'); if (!a) return; e.preventDefault(); e.stopPropagation(); root.location.href = a.getAttribute('data-href'); });
    var scrim = $('.cbsh-scrim'); if (scrim) scrim.addEventListener('click', function () { setOpen(false); });
    $('.cbsh-lic').addEventListener('click', function (e) { if (e.target.closest('.cbsh-chip')) setOpen(true); });
    var onKey = function (e) { if (e.key === 'Escape') { if (S.open) setOpen(false); swOpen(false); } };
    doc.addEventListener('keydown', onKey);
    var nav = $('.cbsh-nav'); if (nav) nav.addEventListener('click', function (e) { var b = e.target.closest('.cbsh-nv'); if (b) go(b.getAttribute('data-go')); });
    el.addEventListener('click', function (e) { var rowButton = e.target.closest && e.target.closest('.cbsh-row'); if (rowButton) openRow(el, rowButton.getAttribute('data-row')); });
    if (main && mode === 'home') {
      main.addEventListener('scroll', spy, { passive: true });
      ['wheel', 'touchstart'].forEach(function (t) { main.addEventListener(t, function () { S.pin = null; S.pinUntil = 0; }, { passive: true }); });
    }
    var swb = $('.cbsh-swb'); if (swb) swb.addEventListener('click', function () { swOpen($('.cbsh-swpop').hidden); });
    doc.addEventListener('click', function (e) { if (swb && !e.target.closest('.cbsh-sw')) swOpen(false); });
    var onMedia = function () { if (mode === 'home') { var shownTab = tabOf(S.area, phone.matches); main.setAttribute('data-tab', shownTab); mark(shownTab); if (!phone.matches) go(S.area); } placeKural(); setOpen(false); };
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
    /* signin:false (FX-UX2) — a public section that loads the sign-in unit for its own use (CB Settings › New shop reads CBSignin.sessionOf): no window over it */
    if (!person && mode !== 'bar' && o.signin !== false && root.CBSignin && typeof root.CBSignin.mount === 'function') {
      var so = { apiBase: base, surface: 'index', need: 'person' };
      Object.keys(o.signin || {}).forEach(function (k) { so[k] = o.signin[k]; });
      root.CBSignin.mount($('.cbsh-signin'), so);
    }

    var sidesApi = sides ? root.CBSides.mount({ left: $('[data-slot="sideL"]'), right: $('[data-slot="sideR"]'), btnL: $('[data-slot="btnL"]'), btnR: $('[data-slot="btnR"]') }, { apiBase: base, token: token }) : null;

    paintBar(); paintSheet();
    if (mode === 'home') paintAreas();
    var hashArea = (root.location && (root.location.hash || '').replace('#', '')) || '';
    var first = startArea(o.area, hashArea, phone.matches);
    if (mode === 'home') { var firstTab = tabOf(first, phone.matches); main.setAttribute('data-tab', firstTab); mark(firstTab); }

    var kuralP = (mode !== 'bar' && o.kural !== false && root.CBKural && root.CBKural.mount)
      ? root.CBKural.mount({ route: o.kural || 'planning', host: phone.matches && mode === 'home' ? $('.cbsh-pfoot') : $('.cbsh-foot') }).then(placeKural).catch(function () {}) : Promise.resolve();

    var manP = loadManifest().then(function (m) { S.manifest = m && m.entries ? m : { entries: [] }; if (root.CBEdition) root.CBEdition.use(S.manifest); }, function () { S.manifest = null; })
      .then(function () { S.loadingApps = false; })
      .then(function () { paintEdition(); if (mode === 'home') { paintAreas(); if (first !== 'home') go(first); readFacts(); } if (mode === 'app') paintSwitcher(); });

    var hdrP = person ? get('/api/entities/header').then(function (h) { S.header = h || null; S.headerState = h ? 'ok' : 'none'; }, function () { S.header = null; S.headerState = 'none'; })
      .then(function () { paintBar(); paintSheet(); paintMoneyGlyphs(doc, S.header); reopenShopTile(); }) : Promise.resolve();
    doc.addEventListener('cb:me', function () { paintCountryWords(doc); });   /* NAMES-1: the shop's country landed — Stock becomes Inventory for a US shop */

    var api = {
      el: el, slots: slots, mode: mode,
      open: function () { setOpen(true); }, close: function () { setOpen(false); }, isOpen: function () { return S.open; },
      go: go, area: function () { return S.area; }, header: function () { return S.header; }, headerState: function () { return S.headerState; },
      manifest: function () { return root.CBEdition && S.manifest ? root.CBEdition.view(S.manifest) : S.manifest; },   /* N18: the Home page reads the manifest's top-level `rail` from the one copy the shell fetched — never a second fetch; AX1: the edition's entries only */
      edition: edition,
      sides: sidesApi,
      ready: Promise.all([manP, hdrP, kuralP, sidesApi ? sidesApi.ready : null]).then(function () { return api; })
    };
    return api;
  }

  root.CBShell = { mount: mount, apiBase: apiBase, WORDS: W, AREAS: AREAS.slice(), PHONE_TABS: PHONE_TABS.slice(), PHONE_MORE: PHONE_MORE.slice(), sectionOf: sectionOf };
})(typeof window !== 'undefined' ? window : this);
