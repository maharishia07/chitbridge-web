/* app/cap-setup-in.js — THE INDIA PACK'S PART OF START HERE AND YOUR BUSINESS (BUILD-R1, 2026-10-16). An INDIA-PACK PATH (e2e/india-words-guard.cjs ALLOW).
 *
 * app/cap-setup.js paints the rows for every country; what only India has is declared here and handed over as CBSetupPack.IN — the same shape AU and AE use there:
 *   · the licences an Indian shop is asked for (by kind of business) and the export rows,
 *   · the rows DERIVED from the tax number: state · PAN · holder type — by the engine (engine/profilemap.js: stateOfGstin · panOfGstin · STATE_NAMES), never a second parser;
 *     the only thing written here is the words for the PAN's holder letter (a display table: the engine decides whether a letter is valid at all),
 *   · the PAN row of a shop that is not registered, and the company number (CIN) of a company.
 * Nothing here reads or writes: a row carries a `loc` (where in the vault it lives) and cap-setup.js does the reading and the one merge-patch write.
 *
 * OWNS the India pack's rows for Start here and Your business (CBSetupPack.IN) · CALLED BY app/cap-setup.js · LOADED BY settings.html
 * FLOW  cap-setup.js asks taxRows(words) → this file answers with row descriptors → cap-setup.js paints and saves them                      CARD 28-platform-and-operations/know-your-business
 */
(function (root) {
  'use strict';
  var HOLDER_WORDS = { C: 'Company', P: 'Proprietor', H: 'Hindu undivided family', F: 'Partnership firm or LLP', A: 'Association of persons', T: 'Trust', B: 'Body of individuals', L: 'Local authority', J: 'Artificial juridical person', G: 'Government' };
  /** where in the vault a registration id lives: the licence section with no label, one row by tag */
  function registrationPlace(tag, name) { return { type: 'licence', label: '', tag: tag, name: name }; }
  /** the second-id row of a shop that is not registered */
  function unregisteredRows(words) {
    return [{ k: 'pan', label: 'PAN', req: true, ph: words.tx('10 letters and digits'), mono: true, loc: registrationPlace('pan', 'PAN') }];
  }
  /** the rows shown beside a valid tax number: state, PAN and holder type — all read from the number, never typed */
  function derivedRows(words, number) {
    var map = root.CBProfileMap, stateCode = map.stateOfGstin(number), stateName = map.STATE_NAMES && map.STATE_NAMES[stateCode];
    var source = words.txf('from {id}', { id: words.idWord }), holder = number.charAt(5);
    return [
      { k: '_state', label: words.tx('State'), derived: true, text: stateName ? words.tx(stateName) + ' (' + stateCode + ')' : words.txf('State code {c}', { c: stateCode }), from: source },
      { k: '_pan', label: 'PAN', derived: true, text: map.panOfGstin(number) || '', mono: true, from: source },
      { k: '_str', label: words.tx('Business structure'), derived: true, text: HOLDER_WORDS[holder] ? words.tx(HOLDER_WORDS[holder]) : '', from: words.txf('{l} in the PAN', { l: holder }) },
    ];
  }
  /** a company also gives its company number */
  function companyRows(words) {
    return [{ k: 'cin', label: words.tx('Company no. (CIN)'), req: true, ph: words.tx('21 letters and digits'), mono: true, loc: registrationPlace('cin', 'CIN') }];
  }
  /** the rows after the tax number. words: { tx, txf, number, valid, registered, idWord } → row descriptors (cap-setup.js paints them) */
  function taxRows(words) {
    if (!words.registered) return unregisteredRows(words);
    var number = String(words.number || '').trim().toUpperCase();
    if (!words.valid || !root.CBProfileMap || !number) return [];
    return derivedRows(words, number).concat(number.charAt(5) === 'C' ? companyRows(words) : []);
  }
  root.CBSetupPack = root.CBSetupPack || {};
  root.CBSetupPack.IN = {
    regd: 'Registered name', schemes: true,
    licences: [{ k: 'fssai', n: 'Food licence (FSSAI)', kinds: ['tea', 'grocery', 'restaurant', 'bakery'] }, { k: 'drug', n: 'Drug licence', kinds: ['pharmacy'] },
      { k: 'trade', n: 'Trade licence', opt: true }, { k: 'udyam', n: 'Udyam (MSME)', opt: true }],
    exportRows: [{ k: 'iec', n: 'Import-export code (IEC)', req: true, loc: registrationPlace('iec', 'IEC') }],
    taxRows: taxRows,
  };
})(window);
