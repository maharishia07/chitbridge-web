/**
 * role-names.js — UX-224: ONE name for each outside role, ONE sentence for "your seat cannot open this".
 *
 * OWNS      CBRoles: the role-name map (an outside accountant is "Accountant", the reader "Auditor", the shop's own books seat "Bookkeeper", a staff login "Staff") and the one refusal
 *           sentence "Your seat cannot <what>. Ask the owner." The api's role words are lib/seat-abilities ROLE_NAMES (the one home, with whyOf/canOf); this map is the first paint and adopt() swaps in the server's copy once Home reads /entities/sides.
 * CALLED BY cap-employees-give.js (Delegate work) · cap-catalogue.js · cap-bank-store.js · cap-books.js · cap-books-lock.js · cap-employees.js · cap-settings.js · cap-tasks.js · network-app.js
 * FLOW      a screen asks CBRoles.name(role) / .line(role) / .firm(role, given) / .refusal(what); nothing here reads the server or decides who may do anything
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/locale
 * ID        CMP073
 * OWNER     cb-ux-locale
 * RISK      plain
 *
 * e2e/guard-role-names.cjs fails when a screen spells a role name or a refusal outside this file (its allow-list only shrinks).
 */
(function (root) {
  'use strict';
  /** role key → { name: the one word, does: what it does, firm: said when a firm of that role has no name yet } */
  var ROLES = {
    adviser: { name: 'Accountant', line: 'Accountant: acts for you', firm: 'Accountant firm' },
    auditor: { name: 'Auditor', line: 'Auditor: reads only', firm: 'Audit firm' },
    bookkeeper: { name: 'Bookkeeper', line: 'Bookkeeper: keeps your books', firm: 'Bookkeeper' },
    staff: { name: 'Staff', line: 'Staff: works for you', firm: 'Staff' }
  };
  /** what a seat is kept from: whole sentences, one shape, so the catalogue translates each (never a sentence built from parts) */
  var CANNOT = {
    any: 'Your seat cannot open this. Ask the owner.',
    owner: 'Your seat cannot do this. Ask the owner.',
    books: 'Your seat cannot read the books. Ask the owner.',
    costs: 'Your seat cannot see costs. Ask the owner.',
    bank: 'Your seat cannot open the bank statements. Ask the owner.',
    reports: 'Your seat cannot open the reports. Ask the owner.'
  };
  function translated(text) {
    return typeof root.tx === 'function' ? root.tx(text) : text;
  }
  function role(key) {
    return ROLES[key] || ROLES.staff;
  }
  /** the one word for the role */
  function name(key) {
    return translated(role(key).name);
  }
  /** "Accountant: acts for you" */
  function line(key) {
    return translated(role(key).line);
  }
  /** a firm's name, or the role's word for a firm the server sent no name for */
  function firm(key, given) {
    return given || translated(role(key).firm);
  }
  /** "Your seat cannot read the books. Ask the owner." — the one refusal; `what` is a key of CANNOT */
  function refusal(what) {
    return translated(CANNOT[what] || CANNOT.any);
  }
  /** UX-226b: the api's role words (lib/seat-abilities ROLE_NAMES, carried on GET /entities/sides as `roles`) replace the first-paint copy above: ONE home, the server */
  function adopt(map) {
    if (map && typeof map === 'object') Object.keys(map).forEach(function (key) { if (map[key] && map[key].name) ROLES[key] = map[key]; });
  }
  root.CBRoles = { ROLES: ROLES, name: name, line: line, firm: firm, refusal: refusal, adopt: adopt };
})(typeof window !== 'undefined' ? window : this);
