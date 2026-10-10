/**
 * page-frame.js — CBFrame: the frame an older single-purpose page (Know your business, Documents) wears so it is part of the application.
 *
 * Athi's black-box, 2026-10-09 (H23/H24): those two pages asked for an e-mail and a code AGAIN while the owner was signed in, and had no header,
 * no Home, no avatar. This is NOT a new frame and NOT a second sign-in: it mounts CBShell (host { app }), whose header is the one every app has,
 * and whose signed-out slot holds CBSignin.mount - the one sign-in window - exactly as Home does. A signed-in person's session (cb_sess, checked
 * by CBOnePerson.who) is simply used: the page reads FRAME.token and never asks for a code.
 *
 *   CBFrame.mount({ app: 'kyb', surface: 'kyb', work: <element the page draws in> }) → { token, session, shell }
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
  function mount(o) {
    o = o || {};
    var sess = session(), doc = root.document, host = doc.createElement('div');
    host.id = 'shell'; doc.body.insertBefore(host, doc.body.firstChild);
    var shell = root.CBShell.mount(host, {
      host: { app: o.app }, kural: false, homeHref: '/',
      person: sess && root.CBAvatar ? root.CBAvatar.personOf(sess) : null, token: sess && sess.token,
      /* the one sign-in window, in the shell's own slot; signed in -> this page reads again with the session it now holds */
      signin: { surface: o.surface || o.app, need: 'person', registerHref: '/app.html#/welcome', onIn: function () { root.location.reload(); } },
      avatar: { onSignIn: function () { var s = host.querySelector('.cbsh-signin'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'center' }); } }
    });
    if (o.work && shell && shell.slots && shell.slots.work) shell.slots.work.appendChild(o.work);
    return { token: sess ? sess.token : null, session: sess, shell: shell };
  }
  /** a 401 from the API: the session is no longer good - drop it and show the sign-in window (it is the same window the apps show) */
  function ended() {
    try { root.localStorage.removeItem('cb_sess'); } catch (_) {}
    root.location.reload();
  }
  root.CBFrame = { mount: mount, session: session, ended: ended };
})(typeof window !== 'undefined' ? window : globalThis);
