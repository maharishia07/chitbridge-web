/**
 * cap-employees-give.js — DELEGATE WORK, IN PLACE (rr1121ui2 W1; DECISIONS 19 Nov: "settings follow the work" — where a person is given work, what they can do is set right there,
 * with the SAME access panel People uses, mounted in place; no redirect, no second copy of the logic).
 *
 * REUSE: CBEmployees.inPlace (cap-employees.js) = GET /api/people (who, what they can do now, the server's level choices) + accessPanel (the radio list and Save → PATCH /api/actors/:id).
 * NEW, and why: only the picker ("Who gets the work?") — Accounts had nowhere to choose the person; nothing else is drawn or decided here.
 *
 *   CBEmployees.mountAccess(el, { token, base, onEnded }) → paints the picker; choosing a person opens the panel under it.
 *
 * OWNS       the Accounts › Setup › Delegate work view (picker + the mount of the People access panel)
 * CALLED BY  public/accounts.html (VIEWS.delegate) · loaded after cap-employees.js
 * CARD       17-people-employees-hr-and-payroll/pin-otp-first-sign-in
 */
(function (root) {
  'use strict';
  var P = root.CBEmployees.inPlace, E = P.E;
  function T(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function el(id) {
    return root.document.getElementById(id);
  }
  /** the picker, then (for the chosen person) the panel; `keep` carries the "Saved." line across the repaint after a write */
  function paint(id, keep) {
    var opts = E.people
      .filter(function (p) { return p.state !== 'off'; })
      .map(function (p) { return '<option value="' + root.esc(p.id) + '"' + (p.id === id ? ' selected' : '') + '>' + root.esc(p.name) + ' · ' + root.esc(p.access.label) + '</option>'; })
      .join('');
    E.el.innerHTML =
      '<div class="emp-give" data-testid="emp-give" style="max-width:560px"><label class="sub" for="emp_give_who">' + root.esc(T('Who gets the work?')) + '</label>' +
      '<select data-cbsid="BKS027-S01" id="emp_give_who" class="inp" data-testid="emp-give-who"><option value="">' + root.esc(T('Choose a person')) + '</option>' + opts + '</select>' +
      '<div id="emp_out" class="emp-out" role="status" data-testid="emp-out"></div><div id="emp_more"></div></div>';
    if (keep) el('emp_out').textContent = keep;
    el('emp_give_who').onchange = function () {
      var node = P.byId(this.value);
      el('emp_out').textContent = '';
      if (node) P.accessPanel(node);
      else el('emp_more').innerHTML = '';
    };
    if (id && P.byId(id)) P.accessPanel(P.byId(id));
  }
  function open() {
    E.el.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + root.esc(T('Loading')) + '</div>';
    return P.load().then(
      function () { paint(''); },
      function (e) {
        E.el.innerHTML = '<div class="empty" data-testid="emp-fail"><div class="t">' + root.esc(T(e && e.status === 403 ? 'This sign-in cannot open this' : "Couldn't read your people")) + '</div></div>';
      }
    );
  }
  root.CBEmployees.mountAccess = function (host, o) {
    E.el = host;
    E.o = o || {};
    E.onChanged = function (id) { paint(id, el('emp_out') ? el('emp_out').textContent : ''); };
    return open();
  };
})(typeof window !== 'undefined' ? window : globalThis);
