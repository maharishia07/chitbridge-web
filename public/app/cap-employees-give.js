/* public/app/cap-employees-give.js — Accounts > Setup > Delegate work: a person-or-firm picker over the People access panel, mounted in place
   ID        BKS027
   OWNER     cb-ux-locale
   OWNS      the Delegate work view (the picker); the panel, its levels and its write stay cap-employees.js (DECISIONS 19 Nov: settings follow the work, same panel, no redirect, no second copy)
   FLOW      accounts.html VIEWS.delegate -> CBEmployees.mountAccess -> GET /api/people (inPlace.load) + the grants list (o.grants: the firms with a live books grant, ACC-383) -> picker (people · firms; no one yet = "Add a person" through inPlace.openAdd) -> inPlace.accessPanel -> PATCH /api/actors/:id -> onChanged repaints
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
  /** the firms that hold a live books grant, read from the SAME list "Who can see my books" shows (the page's `grants()`, GET /api/books-grants): [{ id, name, role, until }] */
  function firmsOf(answer) {
    var seen = {};
    return ((answer && answer.given) || []).filter(function (g) { return g.state === 'live' && !g.revoked_at && !g.ended_at; }).filter(function (g) {
      var key = String(g.grantee_entity);
      return seen[key] ? false : (seen[key] = true);
    }).map(function (g) {
      var member = root.CBBooksGrantMember;
      return { id: String(g.grantee_entity), name: g.grantee_name || words('Your firm'), role: member && member.roleWords ? member.roleWords(g.preset) : '', until: g.expires_at && typeof root.shopDay === 'function' ? root.shopDay(g.expires_at) : '' };
    });
  }
  /** the firm chosen: who it is, what it may do and until when, and the one door to change or end it (the grants screen, not a second panel) */
  function firmPanel(firm) {
    el('emp_more').innerHTML = '<div class="emp-firm" data-testid="emp-give-firm"><b>' + root.esc(firm.name) + '</b> · ' + root.esc(firm.role) + (firm.until ? ' · ' + root.esc(words('Until')) + ' ' + root.esc(firm.until) : '') + '</div>' +
      (state.o.openAccess ? '<p><button data-cbsid="BKS027-B01" type="button" class="act quiet" id="emp_give_firm_go" data-testid="emp-give-firm-go">' + root.esc(words('Change or end this access')) + '</button></p>' : '');
    if (el('emp_give_firm_go')) el('emp_give_firm_go').onclick = state.o.openAccess;
  }
  /** the picker, then (for the chosen person) the panel; `keep` carries the "Saved." line across the repaint after a write */
  function paint(id, keep) {
    var people = state.people.filter(function (p) { return p.state !== 'off'; });
    var opts = people
      .map(function (p) { return '<option value="' + root.esc(p.id) + '"' + (p.id === id ? ' selected' : '') + '>' + root.esc(p.name) + ' · ' + root.esc(p.access.label) + '</option>'; })
      .join('');
    var firms = state.firms || [];
    var firmOpts = firms.map(function (f) { return '<option value="firm:' + root.esc(f.id) + '">' + root.esc(f.name) + ' · ' + root.esc(f.role) + '</option>'; }).join('');
    var mayAdd = !(state.may && state.may.add && state.may.add.ok === false);
    state.body.innerHTML =
      '<div class="emp-give" data-testid="emp-give" style="max-width:560px"><label class="sub" for="emp_give_who">' + root.esc(words('Who gets the work?')) + '</label>' +
      '<select data-cbsid="BKS027-S01" id="emp_give_who" class="inp" data-testid="emp-give-who"><option value="">' + root.esc(words('Choose a person or a firm')) + '</option>' +
      (opts ? '<optgroup label="' + root.esc(words('Your people')) + '">' + opts + '</optgroup>' : '') + (firmOpts ? '<optgroup label="' + root.esc(words('Firms with access to your books')) + '">' + firmOpts + '</optgroup>' : '') + '</select>' +
      (opts ? '' : '<p class="sub" data-testid="emp-give-none">' + root.esc(words('No one is on your team yet.')) + '</p>') +
      (state.firmsFailed ? '<p class="sub" data-testid="emp-give-firms-failed">' + root.esc(words("Couldn't read the firms with access to your books.")) + '</p>' : '') +
      (mayAdd ? '<p><button data-cbsid="EMP001-B02" type="button" class="act quiet" id="emp_give_add" data-testid="emp-give-add">＋ ' + root.esc(words('Add a person')) + '</button></p>'
        : '<p class="sub" data-testid="emp-give-add-why">' + root.esc((state.may.add && state.may.add.why) || '') + '</p>') +
      '<div id="emp_out" class="emp-out" role="status" data-testid="emp-out"></div><div id="emp_more"></div></div>';
    if (keep) el('emp_out').textContent = keep;
    if (el('emp_give_add')) el('emp_give_add').onclick = function () { inPlace.openAdd(); };
    el('emp_give_who').onchange = function () {
      var value = this.value, node = inPlace.byId(value);
      el('emp_out').textContent = '';
      if (node) inPlace.accessPanel(node);
      else if (value.indexOf('firm:') === 0) firmPanel(firms.filter(function (f) { return 'firm:' + f.id === value; })[0]);
      else el('emp_more').innerHTML = '';
    };
    if (id && inPlace.byId(id)) inPlace.accessPanel(inPlace.byId(id));
  }
  /** the people (the People list's own read) and the firms (the grants list's own read), together; a grants read that fails is said, never shown as "no firms" */
  function readAll() {
    var grants = state.o.grants ? Promise.resolve().then(state.o.grants).then(firmsOf, function () { state.firmsFailed = true; return []; }) : Promise.resolve([]);
    state.firmsFailed = false;
    return Promise.all([inPlace.load(), grants]).then(function (done) { state.firms = done[1]; });
  }
  function open() {
    state.el.innerHTML = '<dialog class="sheet" id="emp_sheet" data-pop="POP129" data-testid="emp-sheet"></dialog><div id="emp_give_body"><div class="loadwrap"><span class="spin"></span> ' + root.esc(words('Loading')) + '</div></div>';
    state.body = el('emp_give_body');
    return readAll().then(
      function () { paint(''); },
      function (e) {
        state.body.innerHTML = root.scrErr(e, words("your people"), "CBEmployees.giveRetry()"); /* the one failure card, with its Try again */
      }
    );
  }
  root.CBEmployees.giveRetry = function () { return open(); };
  root.CBEmployees.mountAccess = function (host, o) {
    state.el = host;
    state.o = o || {};
    state.onChanged = function (id) { paint(id, el('emp_out') ? el('emp_out').textContent : ''); };
    state.onAdded = function () { paint(''); }; /* a person added from here: the picker behind the sheet lists them */
    return open();
  };
})(typeof window !== 'undefined' ? window : globalThis);
