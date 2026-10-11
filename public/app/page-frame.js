/**
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
 *   Load first: /engine/screen.js · /app/avatar.js · /engine/signin.js · /app/signin-ui.js · /app/one-person.js · /app/accounts-shell.js · /app/rail-bell.js · /app/shell.js
 */
(function (root) {
  'use strict';
  function session() {
    try {
      var s = JSON.parse(root.localStorage.getItem('cb_sess') || 'null');
      return s && root.CBOnePerson && root.CBOnePerson.who(s) ? s : null;
    } catch (_) { return null; }
  }
  /* the STANDARD PAGE SKELETON (decision 2026-10-09, "one frame style on every app page"): sidebar + main pane, styled by /app/page-skeleton.css.
     skeleton: { name, icon: <svg path d>, sections: [{ k, label, icon: <svg path d> }], active: k, onSection: fn(k) } */
  function skeleton(doc, sk) {
    var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var svg = function (d, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 24 24" aria-hidden="true"><path d="' + esc(d) + '"/></svg>'; };
    var app = doc.createElement('div'); app.className = 'app'; app.setAttribute('data-testid', 'skel-app');
    app.innerHTML = '<aside class="side" id="side" data-testid="skel-side"><div class="brand"><div class="logo">' + svg(sk.icon) + '</div><div class="brand-name label">' + esc(sk.name) + '</div></div>'
      + '<nav class="nav" id="nav" aria-label="' + esc(sk.name) + '">' + (sk.sections || []).map(function (s) {
        return '<button type="button" class="nav-btn' + (s.k === sk.active ? ' active' : '') + '" data-sec="' + esc(s.k) + '" data-testid="skel-nav-' + esc(s.k) + '" aria-label="' + esc(s.label) + '">' + svg(s.icon) + '<span class="label">' + esc(s.label) + '</span></button>';
      }).join('') + '</nav><div class="side-foot"><button type="button" class="nav-btn" id="toggleNav" aria-label="Collapse sidebar" aria-expanded="true">' + svg('M15 6l-6 6 6 6', 'nav-chev') + '<span class="label">Collapse</span></button></div></aside>'
      + '<main class="main" data-testid="skel-main"><div id="shell"></div><div class="screen flush" id="screen" data-testid="skel-screen"></div></main>';
    doc.documentElement.classList.add('cbsk');
    doc.body.insertBefore(app, doc.body.firstChild);
    var side = app.querySelector('#side'), tg = app.querySelector('#toggleNav');
    function fit(collapsed) { side.classList.toggle('collapsed', collapsed); tg.setAttribute('aria-expanded', String(!collapsed)); tg.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar'); }
    tg.onclick = function () { fit(!side.classList.contains('collapsed')); };
    var mq = root.matchMedia && root.matchMedia('(min-width:761px) and (max-width:1100px)');
    if (mq) { fit(mq.matches); if (mq.addEventListener) mq.addEventListener('change', function () { fit(mq.matches); }); }
    function setActive(k) { Array.prototype.forEach.call(app.querySelectorAll('.nav-btn[data-sec]'), function (b) { b.classList.toggle('active', b.getAttribute('data-sec') === k); }); }
    Array.prototype.forEach.call(app.querySelectorAll('.nav-btn[data-sec]'), function (b) {
      b.onclick = function () { var k = b.getAttribute('data-sec'); setActive(k); if (sk.onSection) sk.onSection(k); };
    });
    return { host: app.querySelector('#shell'), screen: app.querySelector('#screen'), setActive: setActive };
  }
  function mount(o) {
    o = o || {};
    var sess = session(), doc = root.document, sk = o.skeleton ? skeleton(doc, o.skeleton) : null, host;
    if (sk) host = sk.host; else { host = doc.createElement('div'); host.id = 'shell'; doc.body.insertBefore(host, doc.body.firstChild); }
    var shell = root.CBShell.mount(host, {
      host: { app: o.app }, kural: sk ? false : (o.kural || false), homeHref: '/',
      person: sess && root.CBAvatar ? root.CBAvatar.personOf(sess) : null, token: sess && sess.token,
      /* the one sign-in window, in the shell's own slot; signed in -> this page reads again with the session it now holds */
      signin: { surface: o.surface || o.app, need: 'person', registerHref: '/app.html#/welcome', onIn: function () { root.location.reload(); } },
      avatar: { onSignIn: function () { var s = host.querySelector('.cbsh-signin'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'center' }); } }
    });
    if (sk && o.kural && root.CBKural) { root.CBKural.mount(); root.CBKural.set(o.kural); }   /* the one kural band at the FOOT, outside the head - as CB Finance / CRM / Accounts */
    if (o.work && sk) sk.screen.appendChild(o.work);
    else if (o.work && shell && shell.slots && shell.slots.work) shell.slots.work.appendChild(o.work);
    return { token: sess ? sess.token : null, session: sess, shell: shell, skeleton: sk };
  }
  /** a 401 from the API: the session is no longer good - drop it and show the sign-in window (it is the same window the apps show) */
  function ended() {
    try { root.localStorage.removeItem('cb_sess'); } catch (_) {}
    root.location.reload();
  }
  root.CBFrame = { mount: mount, session: session, ended: ended };
})(typeof window !== 'undefined' ? window : globalThis);
