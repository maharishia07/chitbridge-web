/**
 * public/app/customer-bar.js — CBCustomerBar: the header of every customer-facing page (shop · store · network shop · embed · shop screen)
 * ID        CMP054
 * RISK      plain
 * OWNER     cb-ux-locale
 * OWNS      the customer's header: mark · the page's name · ⌂ the shop's front; a skip link. Nothing else — no avatar, no bell, no licence, no staff menu.
 * CALLED BY public/shop.html · store.html · network-shop.html · embed.html · promo.html (grep -ln 'CBCustomerBar.mount' public/*.html)
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/shell
 * FLOW      mount({ host, screen, title, homeHref }) → one <header> in `host`
 * CUSTOMER-DELINK (Athi, 21 Nov 2026: "our customer app should not open backoffice app at all"): the staff frame (shell.js + page-frame.js + avatar menu)
 * reads the staff session (cb_sess), loads the staff app list and draws staff chips; a customer page never loads it. This bar reads NO session and NO
 * manifest, and its only link is the page's own front (homeHref). e2e/customer-delink.cjs keeps it so.
 * Same test ids as the staff bar for what the two share (shell-header · shell-bar · shell-mark · shell-title · shell-home), so a walk reads both alike.
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var BAR_STYLES =
    '.cbcb-hdr{background:var(--card,#fff);border-bottom:1px solid var(--line,#DDD6C6);position:relative;z-index:20}' +
    '.cbcb-bar{height:52px;display:flex;align-items:center;gap:10px;padding:0 14px}' +
    '.cbcb-mark{width:28px;height:28px;border-radius:8px;background:var(--green,#16693F);color:var(--on-ok,white);display:grid;place-items:center;font-size:13px;font-weight:700;flex:0 0 auto}' +
    '.cbcb-title{display:inline-flex;align-items:center;gap:7px;min-width:0;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.cbcb-grow{flex:1}' +
    '.cbcb-hdr .cbsh-tohome{display:inline-flex;align-items:center;gap:5px;min-height:44px;min-width:44px;padding:0 10px;border:1px solid var(--line,#DDD6C6);border-radius:8px;background:var(--card,#fff);color:var(--ink,#1D1B16);font-size:13px;font-weight:600;text-decoration:none;justify-content:center}' +
    '.cbcb-skip{position:absolute;inset-inline-start:8px;top:-60px;z-index:2000;padding:10px 16px;border-radius:8px;background:var(--ink,#1D1B16);color:var(--card,#fff);font-weight:700;text-decoration:none}.cbcb-skip:focus{top:8px}' +
    '@media(max-width:700px){.cbcb-bar{height:52px;padding:0 13px}.cbcb-title{font-size:13px}}';
  /** the words go through the string door when the page loaded it (cb-words.js), English otherwise */
  function sayWords(words) {
    return typeof root.tx === 'function' ? root.tx(words) : words;
  }
  /* the one escaper is helpers.js esc (every customer page loads it first): called as root.esc, never redefined here */
  function addCss() {
    if (doc.getElementById('cbcb-css')) return;
    var style = doc.createElement('style');
    style.id = 'cbcb-css';
    style.textContent = BAR_STYLES;
    doc.head.appendChild(style);
  }
  function skipLink() {
    var link = doc.createElement('a');
    link.className = 'cbcb-skip';
    link.href = '#cb-main';
    link.setAttribute('data-testid', 'skip-link');
    link.textContent = sayWords('Skip to content');
    link.addEventListener('click', function (event) {
      var target = doc.querySelector('main') || doc.querySelector('[role="main"]');
      if (!target) return;
      event.preventDefault();
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus();
    });
    return link;
  }
  /** ⌂ the page's own front, the standard Home component (CMP023) — a real link to opts.homeHref, never to ChitBridge's index */
  function homeLink(opts) {
    return root.ui && root.ui.action
      ? root.ui.action('home', { mount: opts.screen + '-U90', href: opts.homeHref, display: 'icon+label', size: 'compact', surface: 'shell', testid: 'shell-home' })
      : '';
  }
  function titleHTML(title) {
    if (!title) return '';
    return '<span class="cbcb-title" data-testid="shell-title"><span aria-hidden="true">' + root.esc(title.icon || '') + '</span><span class="tw">' + root.esc(sayWords(title.name || '')) + '</span></span>';
  }
  var drawn = null; /* the last mount's options: a language pack lands after the first paint and the bar says its words again */
  function sayAgain() {
    if (drawn) mount(drawn);
  }
  /** mount({ host, screen: 'SHP001', title: { icon, name }, homeHref }) → the header element */
  function mount(opts) {
    if (!doc || !opts || !opts.host) return null;
    drawn = opts;
    addCss();
    opts.host.innerHTML =
      '<header class="cbcb-hdr" data-testid="shell-header"><div class="cbcb-bar" data-testid="shell-bar">' +
      '<span class="cbcb-mark" aria-hidden="true" data-testid="shell-mark">▣</span>' +
      titleHTML(opts.title) +
      '<span class="cbcb-grow"></span>' +
      homeLink(opts) +
      '</div></header>';
    opts.host.insertBefore(skipLink(), opts.host.firstChild);
    return opts.host.querySelector('header');
  }
  /** a host site's ?theme=light|dark (embed.html): the engine's own theme (CBScreen.APP_THEMES) painted on <html> for this visit only — nothing saved, no person's look read.
   *  The ink on the accent comes from the engine's one calculation (CBScreen.onColour). */
  function theme(key) {
    var themes = (root.CBScreen && root.CBScreen.APP_THEMES) || {},
      chosen = themes[key];
    if (!chosen) return false;
    var node = doc.documentElement,
      vars = chosen.vars || {};
    Object.keys(vars).forEach(function (token) {
      node.style.setProperty(token, vars[token]);
    });
    var base = vars['--accent'] || vars['--blue'];
    if (base && !vars['--on-accent'] && root.CBScreen.onColour) node.style.setProperty('--on-accent', root.CBScreen.onColour(base));
    node.style.colorScheme = chosen.scheme || 'light';
    node.setAttribute('data-theme', key);
    return true;
  }
  /* a pack calls renderApp() on the way out (locale.js pack): a page with its own renderApp keeps it, the bar redraws beside it */
  var own = root.renderApp;
  root.renderApp = function () {
    if (typeof own === 'function') own.apply(this, arguments);
    sayAgain();
  };
  root.CBCustomerBar = { mount: mount, theme: theme };
})(window);
