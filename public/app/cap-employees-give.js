/* public/app/cap-employees-give.js — Accounts > Setup > Delegate work: a person picker over the People access panel, mounted in place
   ID        BKS027
   OWNER     cb-ux-locale
   OWNS      the Delegate work view (the picker); the panel, its levels and its write stay cap-employees.js (DECISIONS 19 Nov: settings follow the work, same panel, no redirect, no second copy)
   FLOW      accounts.html VIEWS.delegate -> CBEmployees.mountAccess -> GET /api/people (inPlace.load) -> picker -> inPlace.accessPanel -> PATCH /api/actors/:id -> onChanged repaints
   CARD      17-people-employees-hr-and-payroll/pin-otp-first-sign-in
   RISK      security (who may do what; the server decides and refuses)
   CALLED BY public/accounts.html (script tag, after cap-employees.js)
*/
(function (root) {
  'use strict';
  var inPlace = root.CBEmployees.inPlace, state = inPlace.E;
  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function el(id) {
    return root.document.getElementById(id);
  }
  /** the picker, then (for the chosen person) the panel; `keep` carries the "Saved." line across the repaint after a write */
  function paint(id, keep) {
    var opts = state.people
      .filter(function (p) { return p.state !== 'off'; })
      .map(function (p) { return '<option value="' + root.esc(p.id) + '"' + (p.id === id ? ' selected' : '') + '>' + root.esc(p.name) + ' · ' + root.esc(p.access.label) + '</option>'; })
      .join('');
    state.el.innerHTML =
      '<div class="emp-give" data-testid="emp-give" style="max-width:560px"><label class="sub" for="emp_give_who">' + root.esc(words('Who gets the work?')) + '</label>' +
      '<select data-cbsid="BKS027-S01" id="emp_give_who" class="inp" data-testid="emp-give-who"><option value="">' + root.esc(words('Choose a person')) + '</option>' + opts + '</select>' +
      '<div id="emp_out" class="emp-out" role="status" data-testid="emp-out"></div><div id="emp_more"></div></div>';
    if (keep) el('emp_out').textContent = keep;
    el('emp_give_who').onchange = function () {
      var node = inPlace.byId(this.value);
      el('emp_out').textContent = '';
      if (node) inPlace.accessPanel(node);
      else el('emp_more').innerHTML = '';
    };
    if (id && inPlace.byId(id)) inPlace.accessPanel(inPlace.byId(id));
  }
  function open() {
    state.el.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + root.esc(words('Loading')) + '</div>';
    return inPlace.load().then(
      function () { paint(''); },
      function (e) {
        state.el.innerHTML = root.scrErr(e, words("your people"), "CBEmployees.giveRetry()"); /* the one failure card, with its Try again */
      }
    );
  }
  root.CBEmployees.giveRetry = function () { return open(); };
  root.CBEmployees.mountAccess = function (host, o) {
    state.el = host;
    state.o = o || {};
    state.onChanged = function (id) { paint(id, el('emp_out') ? el('emp_out').textContent : ''); };
    return open();
  };
})(typeof window !== 'undefined' ? window : globalThis);
