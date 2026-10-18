/**
 * CALLED BY accounts · crm · finance · know-your-business · settings · the labs and the storefront pages (CBFrame.mount, SHELL-ONE: every page wears the one frame).
 * CARD 29-qa-test-tooling-ux-locale-and-design-system/page-frame
 * page-frame.js — CBFrame: the frame an older single-purpose page (Know your business, Documents) wears so it is part of the application.
 *
 * Athi's black-box, 2026-10-09 (H23/H24): those two pages asked for an e-mail and a code AGAIN while the owner was signed in, and had no header,
 * no Home, no avatar. This is NOT a new frame and NOT a second sign-in: it mounts CBShell (host { app }), whose header is the one every app has,
 * and whose signed-out slot holds CBSignin.mount - the one sign-in window - exactly as Home does. A signed-in person's session (cb_sess, checked
 * by CBOnePerson.who) is simply used: the page reads FRAME.token and never asks for a code.
 *
 *   CBFrame.mount({ app: 'kyb', surface: 'kyb', work: <element the page draws in> }) → { token, session, shell }
 *   skeleton: { name, icon, sections, active, onSection } draws the standard sidebar + main pane around the page (link /app/page-skeleton.css).
 *   kural: a route of app/kurals.json draws the foldable footer band (load /app/kural.js); left out, no band.
 *   screen code: load /app/screen-id.js and the header carries this screen's name · code (CBScreenId; the section on show, SCREEN-ID).
 *   Load first: /engine/screen.js · (/app/edition.js: the person's edition, AX1) · /app/avatar.js · /engine/signin.js · /app/signin-ui.js · /app/one-person.js · /app/accounts-shell.js · /app/rail-bell.js · /app/shell.js
 *   signin: false — a public page (works signed out): no sign-in window in the page, the avatar's "Sign in" goes to Home's. area: the switcher's area.
 *   SHELL-ONE (2026-10-15, every page wears the same frame — Athi: "lot of in-consistencies in each page before sign-in itself"):
 *   host: <element>  the page's own place for the header (an app with its own sidebar: CB Accounts · CRM · Finance put it at the top of their main pane)
 *   bar: true        the HEADER ONLY (the storefront, a lab, the shop screen): mark · name · chip · ⌂ Home · avatar, the page's own body under it
 *   homeHref         where ⌂ Home goes (default '/'); the storefront passes the shop's own front
 *   title            { icon, name } the bar's name for a page with no manifest entry (a lab) or whose name is data (the shop's)
 *   avatar           extra CBAvatar options (onSignIn: a page that hosts the one sign-in window in its own card scrolls to it)
 *   level            the server's word for a login that is not the owner (editor · view-only), said after the shop's name in the bar
 *   FLOW  mount → session() → skeleton()? → CBShell.mount(host, { host:{app|bar}, person, signin, avatar, title, homeHref, fit }) → work into the slot
 */
(function (root) {
  'use strict';
  function session() {
    try {
      var parsed = JSON.parse(root.localStorage.getItem('cb_sess') || 'null');
      return parsed && root.CBOnePerson && root.CBOnePerson.who(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }
  /* the STANDARD PAGE SKELETON (decision 2026-10-09, "one frame style on every app page"): sidebar + main pane, styled by /app/page-skeleton.css.
     skeleton: { name, icon: <svg path d>, sections: [{ k, label, icon: <svg path d> }], active: k, onSection: fn(k) } */
  function skeleton(doc, sk, appId) {
    var svg = function (d, cls) {
      return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 24 24" aria-hidden="true"><path d="' + esc(d) + '"/></svg>';
    };
    var app = doc.createElement('div');
    app.className = 'app';
    app.setAttribute('data-testid', 'skel-app');
    app.innerHTML =
      '<aside class="side" id="side" data-testid="skel-side"><div class="brand"><div class="logo">' +
      svg(sk.icon) +
      '</div><div class="brand-name label">' +
      esc(sk.name) +
      '</div></div>' +
      '<nav class="nav" id="nav" aria-label="' +
      esc(sk.name) +
      '">' +
      (sk.sections || [])
        .map(function (item) {
          return (
            '<button type="button" class="nav-btn' +
            (item.k === sk.active ? ' active' : '') +
            '" data-sec="' +
            esc(item.k) +
            '" data-testid="skel-nav-' +
            esc(item.k) +
            '" aria-label="' +
            esc(item.label) +
            '">' +
            svg(item.icon) +
            '<span class="label">' +
            esc(item.label) +
            '</span></button>'
          );
        })
        .join('') +
      '</nav><div class="side-foot"><button type="button" class="nav-btn" id="toggleNav" aria-label="Collapse sidebar" aria-expanded="true">' +
      svg('M15 6l-6 6 6 6', 'nav-chev') +
      '<span class="label">Collapse</span></button></div></aside>' +
      '<main class="main" data-testid="skel-main"><div id="shell"></div><div class="screen flush" id="screen" data-testid="skel-screen"></div></main>';
    doc.documentElement.classList.add('cbsk');
    doc.body.insertBefore(app, doc.body.firstChild);
    var side = app.querySelector('#side'),
      node = app.querySelector('#toggleNav');
    function fit(collapsed) {
      side.classList.toggle('collapsed', collapsed);
      node.setAttribute('aria-expanded', String(!collapsed));
      node.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    }
    node.onclick = function () {
      fit(!side.classList.contains('collapsed'));
    };
    var mq = root.matchMedia && root.matchMedia('(min-width:761px) and (max-width:1100px)');
    if (mq) {
      fit(mq.matches);
      if (mq.addEventListener)
        mq.addEventListener('change', function () {
          fit(mq.matches);
        });
    }
    /* SCREEN-ID: the section on show is the screen the header chip names (app/screen-id.js, if the page loaded it) */
    function setActive(k) {
      Array.prototype.forEach.call(app.querySelectorAll('.nav-btn[data-sec]'), function (node) {
        node.classList.toggle('active', node.getAttribute('data-sec') === k);
      });
      if (root.CBScreenId) root.CBScreenId.here(appId, k);
    }
    Array.prototype.forEach.call(app.querySelectorAll('.nav-btn[data-sec]'), function (node) {
      node.onclick = function () {
        var k = node.getAttribute('data-sec');
        setActive(k);
        if (sk.onSection) sk.onSection(k);
      };
    });
    return { host: app.querySelector('#shell'), screen: app.querySelector('#screen'), setActive: setActive };
  }
  /** where the header is drawn: the skeleton's slot, the page's own element (host), else a div put first in the body */
  function headerHost(doc, opts, skel) {
    if (skel) return skel.host;
    if (opts.host) return opts.host;
    var host = doc.createElement('div');
    host.id = 'shell';
    doc.body.insertBefore(host, doc.body.firstChild);
    return host;
  }
  /** the avatar's door: a page with the sign-in window scrolls to it; a public page links to Home's; a page's own extras ride along */
  function avatarOptions(opts, host, open) {
    var base = open
      ? {
          onSignIn: function () {
            var node = host.querySelector('.cbsh-signin');
            if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center' });
          }
        }
      : { signInHref: opts.homeHref || '/' };
    Object.keys(opts.avatar || {}).forEach(function (key) {
      base[key] = opts.avatar[key];
    });
    return base;
  }
  /** the bar's person: the session's, with the page's level word (editor · view-only) when it has one */
  function personOf(sess, level) {
    var person = sess && root.CBAvatar ? root.CBAvatar.personOf(sess) : null;
    if (person && level) person.level = String(level);
    return person;
  }
  /* what CBShell.mount is told for this page. CL3: signin:false = a PUBLIC page (the Country lab) — it works signed out, so no sign-in window
     sits over it; the avatar's door is "Sign in", a link to Home's one sign-in window. area names the switcher's area when the page has no manifest entry (labs). */
  function shellOptions(opts, sess, skel, host, open) {
    return {
      host: opts.bar ? { bar: true, app: opts.app } : { app: opts.app },
      kural: skel ? false : opts.kural || false,
      homeHref: opts.homeHref || '/',
      area: opts.area,
      title: opts.title || null,
      fit: skel || opts.host ? 'pane' : undefined /* in a page's own pane the header is a block, never the full-window frame */,
      person: personOf(sess, opts.level),
      token: sess && sess.token,
      /* the one sign-in window, in the shell's own slot; signed in -> this page reads again with the session it now holds */
      signin: open
        ? {
            surface: opts.surface || opts.app,
            need: 'person',
            registerHref: '/settings.html#/new',
            onIn: function () {
              root.location.reload();
            }
          }
        : false /* false: no window at all, even where signin-ui.js is loaded */,
      avatar: avatarOptions(opts, host, open)
    };
  }
  /* mounts THE ONE HEADER (CBShell) for this page and hands it the page's work; every page goes through here (SHELL-ONE) */
  function mount(opts) {
    opts = opts || {};
    var sess = session(),
      doc = root.document,
      skel = opts.skeleton ? skeleton(doc, opts.skeleton, opts.app) : null,
      host = headerHost(doc, opts, skel);
    var open = opts.signin !== false;
    var shell = root.CBShell.mount(host, shellOptions(opts, sess, skel, host, open));
    if (skel && root.CBScreenId)
      root.CBScreenId.here(opts.app, opts.skeleton.active); /* the shell named the app; the skeleton names the section it opened on */
    if (skel && opts.kural && root.CBKural) {
      root.CBKural.mount();
      root.CBKural.set(opts.kural);
    } /* the one kural band at the FOOT, outside the head - as CB Finance / CRM / Accounts */
    if (opts.work && skel) skel.screen.appendChild(opts.work);
    else if (opts.work && shell && shell.slots && shell.slots.work) shell.slots.work.appendChild(opts.work);
    return { token: sess ? sess.token : null, session: sess, shell: shell, skeleton: skel };
  }
  /** a 401 from the API: the session is no longer good - drop it and show the sign-in window (it is the same window the apps show) */
  function ended() {
    try {
      root.localStorage.removeItem('cb_sess');
    } catch (_) {}
    root.location.reload();
  }
  root.CBFrame = { mount: mount, session: session, ended: ended };
})(typeof window !== 'undefined' ? window : globalThis);
