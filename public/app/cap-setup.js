/* app/cap-setup.js — START HERE and YOUR BUSINESS: the accepted Settings design, round 1 (BUILD-R1, 2026-10-16).
 *
 * Athi, 16 Oct, on the prototype (docs/design/settings-setup/): "this is cool, nice, easy to see all at once". Six questions set the shop up; seven small cards hold the rest,
 * "filled now or later". ONE RULE FOR EVERY ROW (R10c): not answered → the control inline · answered → the value and ✎ at the right end · each row saves itself and says "✓ Saved".
 * Required = the label and `*`. Details sit behind ⓘ. A wrong tax number stays on its row, in red, with the reason.
 *
 * ── NOTHING HERE IS A NEW STORE OR A SECOND WRITER (CLAUDE.md rule 1 · docs/SEAMS.md) ───────────────────────────────────────────────────────────────────────
 *   country · money · year · time zone · tax registration → the Country setup's ONE write (cap-country.js: CBCountry.data / csuSet / CBCountry.save — its checker csuTaxIdWhy too)
 *   business name · logo · address · what you supply     → PATCH /entities/profile (api('saveProfile'), the writer cap-shop.js uses)
 *   phone · e-mail · registered name · licences · ids · signatory · bank · export → the trade documents vault, by cap-shop.js's merge-patch (vaultSaveQuiet; version kept)
 *   state · holder type · the second id (India)          → DERIVED from the tax number by the engine (CBProfileMap, via CBSetupPack.IN in cap-setup-in.js); shown, never typed
 * A row for a fact that has NO store yet is drawn as the prototype draws it but DISABLED, with ⓘ "Coming soon": kind of business · nature of business · tagline ·
 * business structure (AU, AE) · signature. No key was invented for them (FIELDS.md rule). The logo is a web address today (logo_url) — an upload comes with the file store.
 * Bank & payments is a summary; its ✎ opens today's bank section of the vault in a popup (the Finance owner move is a later round).
 *
 * OWNS Start here (#/start, SET010) and Your business (#/shop, SET001) · CALLED BY settings.html (CBSetup.mountStart / mountBusiness / watch)
 * FLOW  mount → CBCountry.data (country-setup · policy · /me) + the vault → rows → one change → ONE writer → "✓ Saved" on that row            CARD 28-platform-and-operations/know-your-business
 */
'use strict';
var CBSetup = (function () {
  var STATE = { host: null, mode: '', shop: null, errors: {}, drafts: {}, editing: null, review: '', cardSaved: '', saving: {}, queue: Promise.resolve(), openCards: {}, exportOn: null,
    popup: '', loaded: false, implicit: false, policyCount: 0, focusKey: '' };
  var NATURE_CHOICES = ['Retailer', 'Wholesaler', 'Distributor', 'Manufacturer', 'Service provider'];
  var KIND_CHOICES = ['Tea shop / café', 'Grocery', 'Pharmacy', 'Restaurant', 'Bakery & sweets', 'Clothing', 'Hardware', 'Wholesale', 'Services (salon, repair…)', 'Something else'];
  var SIGNER_ROLES = ['Owner', 'Proprietor', 'Partner', 'Director', 'Manager'];
  var PEN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  var SAVED_FADE_MS = 2200;
  /** SAVE-CARD (Athi, 2026-10-16, decided): settings have NO autosave. A card collects drafts; Save writes them; a change to any key below goes through ONE inline Review first.
   *  Critical = country · tax registration, number, scheme/type · registered/legal name · PAN · anything bank/UPI · signatory. The ONE list; nothing else decides. */
  var CRITICAL = { keys: ['country', 'taxReg', 'taxNo', 'taxType', 'regd', 'pan', 'signer', 'signerAs'], vaultTypes: ['bank', 'signatory'], keyPattern: /bank|upi/i };
  /** where in the vault: a registration id (second id, company number, export code) — the licence section with no label */
  function registrationPlace(tag, name) { return { type: 'licence', label: '', tag: tag, name: name }; }
  /** where in the vault: one named licence — its own licence section, the number is the row tagged licence_no */
  function licencePlace(name) { return { type: 'licence', label: name, tag: 'licence_no', name: 'Licence number', starter: [['licence_name', 'Licence name', name]] }; }
  /** where in the vault: a row of the business identity (phone · e-mail · legal name · address) */
  function identityPlace(tag, name) { return { type: 'identity', label: '', tag: tag, name: name }; }
  /** Australia and the UAE as the prototype's packs have them; India's part is cap-setup-in.js (CBSetupPack.IN). A country with no entry here gets PLAIN_PACK. */
  var PACKS = {
    AU: { regd: 'Registered name', licences: [{ k: 'food', n: 'Food business licence', kinds: ['tea', 'grocery', 'restaurant', 'bakery'] }, { k: 'council', n: 'Council permit', opt: true }],
      exportRows: [], taxRows: function (words) { return [{ k: 'structure', label: words.tx('Business structure'), req: true, soon: true, type: 'select', opts: ['Sole trader', 'Partnership', 'Company', 'Trust'] },
        { k: 'acn', label: words.tx('ACN') + ' ' + words.tx('(optional)'), ph: words.tx('9 digits'), mono: true, loc: registrationPlace('acn', 'ACN') }]; } },
    AE: { regd: 'Registered name', licences: [{ k: 'food', n: 'Food permit', kinds: ['tea', 'grocery', 'restaurant', 'bakery'] }],
      exportRows: [{ k: 'iec', n: 'Customs code', req: true, loc: registrationPlace('iec', 'Customs code') }],
      taxRows: function (words) { return [{ k: 'structure', label: words.tx('Legal form'), req: true, soon: true, type: 'select', opts: ['Sole establishment', 'LLC', 'Free-zone company', 'Branch'] },
        { k: 'tl', label: words.tx('Trade licence no.'), req: true, mono: true, loc: licencePlace('Trade licence') }]; } },
  };
  var PLAIN_PACK = { regd: 'Registered name', licences: [], exportRows: [], taxRows: function () { return []; } };
  var PORT_ROW = { k: 'port', n: 'Port you ship from', loc: { type: 'logistics', label: '', tag: 'port_loading', name: 'Port of loading' } };

  /** the word for a row that has no store yet */
  function soonWord() { return tx('Coming soon'); }

  /* ── what the shop is: the country-setup's own record (CSU) and /me, read once, shared with the Country screen ── */
  /** the Country setup's working record (country · money · year · tax · supplies) */
  function setupRecord() { return (typeof CSU !== 'undefined' && CSU.edit) || {}; }
  /** the shop's country code, upper case */
  function shopCountry() { return String(setupRecord().country || (STATE.shop && (STATE.shop.country || STATE.shop.country_code)) || '').toUpperCase(); }
  /** the pack for this country: India's from cap-setup-in.js, AU and AE above, else the plain one */
  function countryPack() { var code = shopCountry(); return Object.assign({}, PLAIN_PACK, (window.CBSetupPack && CBSetupPack[code]) || PACKS[code] || {}); }
  /** the pack's own word for the tax id (helpers.js, the one reader) */
  function taxWord() { return taxIdWord(shopCountry()); }
  /** is there a value (an array counts when it has items; blanks do not count) */
  function isFilled(value) { return Array.isArray(value) ? value.length > 0 : (value != null && String(value).trim() !== ''); }
  /** what a failure says to a person */
  function failureWords(failure, fallback) { return (window.CBAction && CBAction.words) ? CBAction.words(failure, fallback) : ((failure && failure.message) || fallback); }
  /** the tax question is answered when a number is held, or "not registered" was said (here, or earlier — the server's own source for it) */
  function taxAnswered() {
    var record = setupRecord();
    if (record.registered) return !!record.number;
    var said = !!(CSU.answered && CSU.answered.tax);
    var storedBefore = !!(CSU.p && CSU.p.done && CSU.src && CSU.src.tax && CSU.src.tax !== tx('not set yet'));
    return said || storedBefore;
  }

  /* ── the vault, by place: type · label · tag (the key the merge-patch uses) — read and written through cap-shop.js's own model ── */
  /** the vault section at a place (made when `make`, with its starter rows) */
  function vaultSection(place, make) {
    var sections = _vaultSecs(), found = sections.filter(function (section) { return section.type === place.type && String(section.label || '') === String(place.label || ''); })[0];
    if (!found && make) {
      found = { type: place.type, label: place.label || '', rows: [] };
      (place.starter || []).forEach(function (starter) { found.rows.push({ name: starter[1], tag: starter[0], value: starter[2] }); });
      sections.push(found);
    }
    return found || null;
  }
  /** the value of the vault row at a place ('' when none) */
  function vaultRead(place) {
    var section = vaultSection(place, false), row = section && (section.rows || []).filter(function (candidate) { return (candidate.tag || '') === place.tag; })[0];
    return row ? String(row.value || '') : '';
  }
  /** put a value into the vault row at a place (the row and its section are made when missing); nothing is sent yet */
  function vaultPut(place, value) {
    var section = vaultSection(place, true), row = (section.rows || []).filter(function (candidate) { return (candidate.tag || '') === place.tag; })[0];
    if (row) row.value = value; else (section.rows = section.rows || []).push({ name: place.name, tag: place.tag, value: value });
  }

  /* ── the writers: one at a time, in the order asked (the vault's version moves with every save) ── */
  /** run one write after the one before it */
  function enqueue(writeJob) { var started = STATE.queue.then(writeJob); STATE.queue = started.then(function () {}, function () {}); return started; }
  /** the failed vault write: say it in words and re-read, so the row shows what the server holds */
  function vaultWriteFailed(failure) {
    return readVault().then(function () {
      var stale = failure && failure.status === 409;
      throw new Error(stale ? tx('Changed since you opened it — type it again, please.') : failureWords(failure, tx('Could not save')));
    });
  }
  /** write rows into the vault: [[place, value] …] → one merge-patch (cap-shop.js vaultSaveQuiet) */
  function writeVault(puts) {
    return enqueue(function () {
      puts.forEach(function (entry) { vaultPut(entry[0], entry[1]); });
      return vaultSaveQuiet().then(function () {}, vaultWriteFailed);
    });
  }
  /** PATCH /entities/profile (the shop's own row), then keep the page's copies of it in step */
  function writeProfile(body) {
    return enqueue(function () {
      return api('saveProfile', { body: body }).then(function () {
        Object.assign(STATE.shop, body); CSU.me = Object.assign({}, CSU.me, body); UI._me = null; UI._party = undefined;
      });
    }).then(function () {}, function (failure) { throw new Error(failureWords(failure, tx('Could not save'))); });
  }
  /** keep "what you supply" as stored for the length of the Country write (it saves what it SHOWS; an unanswered question must stay unanswered) */
  function holdSupplies() { var record = setupRecord(); record.supplies = csuStoredSupplies(); }
  /** after the Country write, show Goods again in the Country screen's own picker when nothing was ever answered */
  function showDefaultSupplies() { if (!csuStoredSupplies()) setupRecord().supplies = 'goods'; }
  /** the Country setup's one write */
  function writeCountry() {
    return enqueue(function () { holdSupplies(); return CBCountry.save(); }).then(showDefaultSupplies, function (failure) {
      showDefaultSupplies(); throw new Error(failureWords(failure, tx('Could not save')));
    });
  }

  /* ── the fields: key → { label, req, get, set, … } built fresh for each paint (the country decides the words) ── */
  /** a field that lives in the vault at a place */
  function vaultField(definition, place, extra) {
    return Object.assign({ k: definition.k, label: definition.label, req: definition.req, ph: definition.ph, mono: definition.mono,
      place: place, get: function () { return vaultRead(place); }, set: function (value) { return writeVault([[place, value]]); } }, extra || {});
  }
  /** a field with no store yet: drawn, disabled, writes nothing */
  function soonField(key, label, req, type, opts) { return { k: key, label: label, req: req, soon: true, type: type, opts: opts, get: function () { return ''; } }; }
  /** Country and Time zone: the Country setup's two pickers */
  function countryFields(all) {
    var record = setupRecord();
    all.country = { k: 'country', label: tx('Country'), req: true, lock: true, type: 'select', fixed: typeof csuConstituted === 'function' && csuConstituted(),
      opts: csuCountries().map(function (code) { return { v: code, n: csuCountryName(code) }; }), current: record.country,
      get: function () { return csuAnswered('country') ? record.country : ''; }, show: function () { return esc(csuCountryName(record.country)); },
      set: function (value) { csuSet('country', value); return writeCountry(); } };
    all.timezone = { k: 'timezone', label: tx('Time zone'), req: true, type: 'select', opts: csuZones(record.country).map(function (zone) { return { v: zone, n: csuZoneName(zone) }; }),
      get: function () { return record.timezone || ''; }, show: function (value) { return esc(csuZoneName(value)); },
      set: function (value) { csuSet('timezone', value); return writeCountry(); } };
  }
  /** what the business is: kind and nature (no store yet), what it supplies, its name, logo and tagline */
  function identityFields(all) {
    var shop = STATE.shop || {};
    all.kind = soonField('kind', tx('Kind of business'), true, 'select', KIND_CHOICES);
    all.nature = soonField('nature', tx('Nature of business'), true, 'chips', NATURE_CHOICES);
    all.supply = { k: 'supply', label: tx('What you supply'), req: true, type: 'seg', opts: SHOP_SUPPLIES.map(function (choice) { return { v: choice[0], n: tx(choice[1]) }; }),
      info: tx('Goods are billed with product codes, services with service codes.'), get: function () { return csuStoredSupplies(); },
      show: function (value) { return esc(tx((SHOP_SUPPLIES.filter(function (choice) { return choice[0] === value; })[0] || [0, value])[1])); },
      set: function (value) { return writeProfile({ supplies: value }).then(function () { setupRecord().supplies = value; }); } };
    all.name = { k: 'name', label: tx('Business name'), req: true, ph: tx('Signboard name'), get: function () { return shop.display_name && shop.display_name !== shop.user_id ? shop.display_name : ''; },
      set: function (value) { return writeProfile({ display_name: value }); } };
    all.logo = { k: 'logo', label: tx('Logo'), ph: 'https://…', info: tx('Paste the address of your logo picture. Uploading a file is coming soon.'), get: function () { return shop.logo_url || ''; },
      show: function (value) { return '<span class="thumb"><img src="' + esc(value) + '" alt="" onerror="this.remove()"></span>'; }, set: function (value) { return writeProfile({ logo_url: value }); } };
    all.tagline = soonField('tagline', tx('Tagline') + ' ' + tx('(optional)'));
  }
  /** how to reach the business: address (the shop's row, mirrored into the vault identity), phone, e-mail, registered name */
  function contactFields(all) {
    var shop = STATE.shop || {}, pack = countryPack();
    all.addr = { k: 'addr', label: tx('Address'), req: true, get: function () { return shop.address || ''; },
      set: function (value) { return writeProfile({ address: value }).then(function () { return writeVault([[identityPlace('address', 'Address'), value]]); }); } };
    all.phone = vaultField({ k: 'phone', label: tx('Phone'), req: true, mono: true }, identityPlace('phone', 'Phone'));
    all.email = vaultField({ k: 'email', label: tx('E-mail') + ' ' + tx('(optional)') }, identityPlace('email', 'Email'));
    all.regd = vaultField({ k: 'regd', label: tx(pack.regd || 'Registered name'), req: true, ph: tx('As on your registration') }, identityPlace('legal_name', 'Legal name'));
  }
  /** the tax number's own row: checked when the person leaves the box, saved through the Country write */
  function taxNumberField() {
    var record = setupRecord();
    return { k: 'taxNo', label: taxWord(), req: true, ph: csuTaxIdHint(record.country), mono: true, get: function () { return record.registered ? (record.number || '') : ''; },
      check: function (value) { return csuTaxIdWhy(record.country, value); },
      set: function (value) { csuSet('registered', 'yes'); csuSet('number', value); return writeCountry(); } };
  }
  /** registered or not, the number, and India's regular / composition choice */
  function taxFields(all) {
    var record = setupRecord();
    all.taxReg = { k: 'taxReg', label: txf('Registered for {s}', { s: csuScheme(record.country) }), req: true, type: 'select', opts: [{ v: 'yes', n: tx('Yes') }, { v: 'no', n: tx('Not registered') }],
      get: function () { return record.registered ? 'yes' : (taxAnswered() ? 'no' : ''); }, show: function (value) { return esc(value === 'yes' ? tx('Yes') : tx('Not registered')); },
      set: function (value) {
        if (value === 'yes') { csuSet('registered', 'yes'); return Promise.resolve(); }
        STATE.errors.taxNo = ''; csuSet('registered', 'no'); return writeCountry();
      } };
    all.taxNo = taxNumberField();
    all.taxType = { k: 'taxType', label: tx('GST type'), req: true, type: 'select', opts: [{ v: 'regular', n: tx('Regular') }, { v: 'composition', n: tx('Composition') }],
      info: tx('Regular: tax on every bill, you claim input credit. Composition: a flat % of sales, no tax on the bill (bill of supply), no input credit, no sales to other states.'),
      get: function () { return record.registered && record.number ? record.scheme : ''; }, show: function (value) { return esc(value === 'composition' ? tx('Composition') : tx('Regular')); },
      set: function (value) { csuSet('scheme', value); return writeCountry(); } };
  }
  /** licences, export rows, and who signs */
  function recordFields(all) {
    var pack = countryPack();
    (pack.licences || []).forEach(function (licence) {
      all['lic_' + licence.k] = vaultField({ k: 'lic_' + licence.k, label: tx(licence.n) + (licence.opt ? ' ' + tx('(optional)') : ''), req: !licence.opt, mono: true }, licencePlace(licence.n));
    });
    (pack.exportRows || []).concat([PORT_ROW]).forEach(function (exportRow) { all['exp_' + exportRow.k] = vaultField({ k: 'exp_' + exportRow.k, label: tx(exportRow.n), req: exportRow.req }, exportRow.loc); });
    all.signer = vaultField({ k: 'signer', label: tx('Name'), req: true }, { type: 'signatory', label: '', tag: 'name', name: 'Name', starter: [] });
    all.signerAs = vaultField({ k: 'signerAs', label: tx('As'), type: 'select', opts: SIGNER_ROLES.map(function (role) { return { v: role, n: tx(role) }; }) },
      { type: 'signatory', label: '', tag: 'designation', name: 'Designation' });
    all.signature = soonField('signature', tx('Signature'), true);
  }
  /** every field of both screens, by key */
  function buildFields() {
    var all = {};
    countryFields(all); identityFields(all); contactFields(all); taxFields(all); recordFields(all);
    return all;
  }
  /** the rows the pack hands over (derived from the tax number, ids, structure) become fields like the rest */
  function packRows() {
    var record = setupRecord(), pack = countryPack(), registered = !!record.registered;
    var valid = registered && !!record.number && !csuTaxIdWhy(record.country, record.number);
    var rows = pack.taxRows ? pack.taxRows({ tx: tx, txf: txf, number: record.number, valid: valid, registered: registered, idWord: taxWord() }) : [];
    return rows.map(function (row) {
      if (row.derived) return { k: row.k, label: row.label, derived: true, from: row.from, get: function () { return row.text; }, show: function () { return row.mono ? '<span class="mono">' + esc(row.text) + '</span>' : esc(row.text); } };
      if (row.soon) return soonField(row.k, row.label, row.req, row.type, row.opts);
      return vaultField(row, row.loc);
    });
  }
  /** a field by key (the pack's rows too) */
  function fieldFor(key) {
    var all = buildFields();
    return all[key] || packRows().filter(function (row) { return row.k === key; })[0] || null;
  }

  /* ── the one row ── */
  /** the ⓘ button: its text opens beside it */
  function infoButton(text) { return '<button class="info" type="button" data-info="' + esc(text) + '" aria-label="' + esc(tx('More about this')) + '">i</button>'; }
  /** the ✎ at a row's right end */
  function penButton(key, label) {
    return '<button class="pen" type="button" data-edit="' + esc(key) + '" data-testid="edit-' + esc(key) + '" aria-label="' + esc(tx('Change') + ' ' + label) + '" title="' + esc(tx('Change')) + '">' + PEN_ICON + '</button>';
  }
  /** the 🔒 on a label (Country only): why it is fixed */
  function lockMark(field) {
    if (!field.lock) return '';
    var reason = field.fixed ? txf('Fixed — the shop has {w}. Another country needs a new business.', { w: csuFixedBy() }) : tx('Fixed after your first sale');
    return '<span class="lock" data-testid="lock-' + esc(field.k) + '" title="' + esc(reason) + '" aria-label="' + esc(reason) + '">🔒</span>';
  }
  /** the disabled control of a row that has no store yet */
  function soonControl(field) {
    if (field.type === 'chips') return '<div class="chips">' + field.opts.map(function (choice) { return '<button type="button" disabled aria-pressed="false">' + esc(tx(choice)) + '</button>'; }).join('') + '</div>';
    if (field.type === 'select') return '<select class="inp" disabled aria-label="' + esc(field.label) + '"><option>' + esc(tx('Choose…')) + '</option></select>';
    return '<input class="inp" disabled aria-label="' + esc(field.label) + '" placeholder="' + esc(soonWord()) + '">';
  }
  /** one <option> of a select */
  function optionHTML(choice, current) {
    var value = typeof choice === 'object' ? choice.v : choice, name = typeof choice === 'object' ? choice.n : choice;
    return '<option value="' + esc(value) + '"' + (String(current) === String(value) ? ' selected' : '') + '>' + esc(name) + '</option>';
  }
  /** a select; the country's also offers "Use <the guessed country>" while nothing is answered */
  function selectControl(field, current) {
    var held = field.k === 'country' && !current ? field.current : current;
    var html = '<select class="inp" data-k="' + esc(field.k) + '" data-testid="in-' + esc(field.k) + '" aria-label="' + esc(field.label) + '">' + (held ? '' : '<option value="" selected disabled>' + esc(tx('Choose…')) + '</option>')
      + field.opts.map(function (choice) { return optionHTML(choice, held); }).join('') + '</select>';
    if (field.k === 'country' && !csuAnswered('country')) html += '<button class="act xs" type="button" data-use="country" data-testid="use-country">' + esc(txf('Use {c}', { c: csuCountryName(field.current) })) + '</button>';
    return html;
  }
  /** a row of buttons, one pressed */
  function segmentControl(field, current) {
    return '<div class="seg" role="group" aria-label="' + esc(field.label) + '">' + field.opts.map(function (choice) {
      return '<button type="button" data-seg="' + esc(field.k) + '" data-val="' + esc(choice.v) + '" data-testid="seg-' + esc(field.k) + '-' + esc(choice.v) + '" aria-pressed="' + (current === choice.v) + '">' + esc(choice.n) + '</button>';
    }).join('') + '</div>';
  }
  /** a text box (typing keeps a draft; Enter and leaving write nothing); the tax question also offers "Not registered" */
  function textControl(field, current) {
    var failed = !!STATE.errors[field.k];
    return '<input class="inp' + (failed ? ' bad' : '') + '" data-k="' + esc(field.k) + '" data-testid="in-' + esc(field.k) + '" value="' + esc(current || '') + '" placeholder="' + esc(field.ph || '') + '" aria-label="' + esc(field.label) + '"' + (failed ? ' aria-invalid="true"' : '') + '>'
      + (field.k === 'taxNo' ? '<button class="act quiet xs" type="button" data-notreg="1" data-testid="notreg" aria-pressed="' + (STATE.drafts.taxReg === 'no') + '">' + esc(tx('Not registered')) + '</button>' : '');
  }
  /** the control a row shows while it is open */
  function controlHTML(field) {
    if (field.soon) return soonControl(field);
    var current = STATE.drafts[field.k] != null ? STATE.drafts[field.k] : field.get();
    if (field.type === 'select') return selectControl(field, current);
    if (field.type === 'seg') return segmentControl(field, current);
    return textControl(field, current);
  }
  /** a row's label: the words, `*` when required, 🔒, and ⓘ (coming soon, or the field's own) */
  function labelHTML(field) {
    var note = field.soon ? infoButton(soonWord()) : (field.info ? infoButton(field.info) : '');
    return '<div class="lb">' + esc(field.label) + (field.req ? '<span class="req" aria-label="' + esc(tx('required')) + '">*</span>' : '') + lockMark(field) + note + '<i class="chg-dot" role="img" aria-label="' + esc(tx('changed')) + '" title="' + esc(tx('changed')) + '"></i></div>';
  }
  /** the row of a field that has no store yet: its control drawn, disabled */
  function soonRowHTML(field, lead) {
    return '<div class="row soon" data-row="' + esc(field.k) + '" data-testid="row-' + esc(field.k) + '">' + (lead || '') + labelHTML(field) + '<div class="v"><div class="ctl">' + controlHTML(field) + '</div></div><div class="end"></div></div>';
  }
  /** an optional row with nothing in it: "— + Add" */
  function addRowHTML(field, lead) {
    return '<div class="row" data-row="' + esc(field.k) + '" data-testid="row-' + esc(field.k) + '">' + (lead || '') + labelHTML(field) + '<div class="v"><span class="dim">—</span></div><div class="end"><button class="act ghost xs" type="button" data-edit="' + esc(field.k) + '" data-testid="add-' + esc(field.k) + '">+ ' + esc(tx('Add')) + '</button></div></div>';
  }
  /** the value of an answered row */
  function valueHTML(field, held) {
    var shown = field.show ? field.show(held) : (field.mono ? '<span class="mono">' + esc(held) + '</span>' : esc(held));
    return '<div class="v" data-testid="val-' + esc(field.k) + '">' + shown + (field.from ? ' <span class="tag src">' + esc(field.from) + '</span>' : '') + '</div>';
  }
  /** the right end of an answered row: the ✎ (none on a derived or fixed row) */
  function endHTML(field) {
    return field.derived || field.fixed ? '' : penButton(field.k, field.label);
  }
  /** is the row open (its control showing)? not for a derived row; yes when forced, unanswered, being changed, or wrong */
  function rowIsOpen(field, hasValue, failed) { return !field.derived && (!!field.forceOpen || !hasValue || STATE.editing === field.k || failed || rowChanged(field.k)); }
  /** an optional row with nothing in it shows "— + Add" until it is asked for */
  function wantsAddButton(field, hasValue, failed) { return !hasValue && !field.req && !field.forceOpen && STATE.editing !== field.k && !failed && !rowChanged(field.k); }
  /** the value part of an open row: its control */
  function openValueHTML(field) { return '<div class="v" data-testid="val-' + esc(field.k) + '"><div class="ctl">' + controlHTML(field) + '</div></div>'; }
  /** the ✕ at the right end of an answered row that is being changed ("keep it as it was") */
  function cancelButtonHTML(field, hasValue, failed) {
    if (STATE.editing !== field.k || !hasValue || failed) return '';
    return '<button class="pen" type="button" data-cancel="' + esc(field.k) + '" aria-label="' + esc(tx('Keep as it was')) + '" title="' + esc(tx('Keep as it was')) + '">✕</button>';
  }
  /** the row's frame: lead · label · value · right end · the reason a value was refused */
  function rowFrameHTML(field, lead, failed, valuePart, endPart) {
    var reason = failed ? '<div class="why" data-testid="why-' + esc(field.k) + '" role="alert">✕ ' + esc(STATE.errors[field.k]) + '</div>' : '';
    return '<div class="row' + (failed ? ' bad' : '') + (rowChanged(field.k) ? ' chg' : '') + '" data-row="' + esc(field.k) + '" data-testid="row-' + esc(field.k) + '">' + (lead || '') + labelHTML(field) + valuePart + '<div class="end">' + endPart + '</div>' + reason + '</div>';
  }
  /** a row: soon → drawn disabled · optional and empty → "+ Add" · unanswered, being changed or wrong → the control · answered → the value and ✎ */
  function rowHTML(field, lead) {
    if (field.soon) return soonRowHTML(field, lead);
    var held = field.get(), hasValue = field.derived ? true : isFilled(held), failed = !!STATE.errors[field.k];
    var isOpen = rowIsOpen(field, hasValue, failed);
    if (isOpen && wantsAddButton(field, hasValue, failed)) return addRowHTML(field, lead);
    var valuePart = isOpen ? openValueHTML(field) : valueHTML(field, held);
    return rowFrameHTML(field, lead, failed, valuePart, isOpen ? cancelButtonHTML(field, hasValue, failed) : endHTML(field));
  }

  /* ── START HERE: the six questions ── */
  /** question 4: the tax number, or "not registered" */
  function taxQuestion(all) {
    var record = setupRecord(), answered = taxAnswered() && !STATE.errors.taxNo;
    return { k: 'taxNo', label: taxWord() + ' ' + tx('(or not registered)'), ph: csuTaxIdHint(record.country), mono: true, check: all.taxNo.check, set: all.taxNo.set,
      get: function () { return record.registered ? (record.number || '') : (answered ? 'no' : ''); },
      show: function (value) {
        if (value === 'no') return esc(tx('Not registered'));
        var scheme = countryPack().schemes && record.scheme ? ' <span class="dim">· ' + esc(record.scheme === 'composition' ? tx('Composition') : tx('Regular')) + '</span>' : '';
        return '<span class="mono">' + esc(value) + '</span>' + scheme;
      } };
  }
  /** question 3 and 5: the supply choice, and the name with its logo */
  function supplyQuestion(all) { return { k: 'supply', label: tx('Nature · what you supply'), req: true, type: 'seg', opts: all.supply.opts, info: all.supply.info, get: all.supply.get, set: all.supply.set, show: all.supply.show }; }
  function nameQuestion(all) {
    return Object.assign({}, all.name, { label: tx('Business name · logo'), show: function (value) { return (isFilled(STATE.shop.logo_url) ? all.logo.show(STATE.shop.logo_url) : '') + '<span>' + esc(value) + '</span>'; } });
  }
  /** the six questions in the prototype's order, each with whether it is answered; `soon` ones are not counted */
  function questions(all) {
    var kind = Object.assign({}, all.kind);
    return [
      { field: all.country, done: csuAnswered('country') },
      { field: kind, done: false, soon: true },
      { field: supplyQuestion(all), done: isFilled(all.supply.get()) },
      { field: taxQuestion(all), done: taxAnswered() && !STATE.errors.taxNo },
      { field: nameQuestion(all), done: isFilled(all.name.get()) },
      { field: all.addr, done: isFilled(all.addr.get()) },
    ];
  }
  /** the questions that can be answered today */
  function countable(list) { return list.filter(function (question) { return !question.soon; }); }
  /** how many of those are still open */
  function questionsLeft() { return countable(questions(buildFields())).filter(function (question) { return !question.done; }).length; }
  /** the "Set for you" rows: what the answers set, and where each came from */
  function defaultsRows() {
    var record = setupRecord(), sources = (typeof CSU !== 'undefined' && CSU.src) || {}, example = csuMoneyExamples(record.currency, record.words), rows = [];
    rows.push([tx('Money'), (example.symbol || '') + ' ' + record.currency, sources.currency]);
    rows.push([tx('Year starts'), csuMonthNames('long')[(record.fy || 1) - 1] || '', sources.fy_start_month]);
    if (record.timezone) rows.push([tx('Time zone'), csuZoneName(record.timezone), sources.timezone]);
    rows.push([tx('Tax'), csuScheme(record.country) + ' · ' + taxWord(), sources.tax]);
    rows.push([tx('Dates and numbers'), [example.number, example.date].filter(Boolean).join(' · '), sources.currency]);
    if (STATE.policyCount) rows.push([tx('Business rules'), txf('{n} rules set', { n: STATE.policyCount }), tx('the usual set-up')]);
    return rows.filter(function (row) { return row[1]; });
  }
  /** the page title, with an optional right end */
  function titleHTML(text, endHtml) { return '<div class="ptitle"><h1>' + esc(text) + '</h1>' + (endHtml ? '<div class="end">' + endHtml + '</div>' : '') + '</div>'; }
  /** the "Set for you" fold: Setting · Now · From */
  function defaultsHTML(open) {
    var rows = defaultsRows(), label = function (text) { return esc(tx(text)); };
    var body = rows.map(function (row) {
      return '<div class="tr"><div class="c strong">' + esc(row[0]) + '</div><div class="c" data-l="' + label('Now') + '">' + esc(row[1]) + '</div><div class="c" data-l="' + label('From') + '"><span class="tag src">' + esc(row[2] || tx('the usual set-up')) + '</span></div></div>';
    }).join('');
    return '<details class="fold" data-testid="set-for-you"' + (open ? ' open' : '') + '><summary><span class="tw">▸</span>' + label('Set for you') + ' <span class="tag">' + rows.length + '</span>' + infoButton(tx('Your answers set these. Change any of them later; nothing here is needed to start.')) + '</summary><div class="body">'
      + '<div class="tbl" style="border:0"><div class="tg" style="--cols:minmax(120px,1fr) minmax(140px,1.6fr) minmax(110px,1fr)"><div class="hc">' + label('Setting') + '</div><div class="hc">' + label('Now') + '</div><div class="hc">' + label('From') + '</div>' + body + '</div></div></div></details>';
  }
  /** one question's lines: the row, then (after Country) the time zone when the pack names several, (after supply) the nature of business */
  function questionHTML(question, index, all) {
    var field = question.field, lead = '<span class="qn' + (question.done ? ' ok' : '') + '" aria-hidden="true">' + (question.done ? '✓' : index + 1) + '</span>';
    if (!question.done && !question.soon) field = Object.assign({}, field, { forceOpen: true });   /* unanswered → the control inline, even for a question not marked required */
    var html = rowHTML(field, lead);
    if (field.k === 'supply') html += rowHTML(all.nature, '<span></span>');
    if (field.k === 'country' && csuZones(setupRecord().country).length > 1 && !setupRecord().timezone) html += rowHTML(all.timezone, '<span></span>');
    return html;
  }
  /** the whole Start here screen */
  function startHTML() {
    var all = buildFields(), list = questions(all), counted = countable(list), done = counted.filter(function (question) { return question.done; }).length, everyOneDone = done === counted.length;
    var dots = '<span class="dots" aria-hidden="true">' + counted.map(function (question) { return '<i class="' + (question.done ? 'on' : '') + '"></i>'; }).join('') + '</span>';
    var html = titleHTML(tx('Set up your business'), dots + '<span class="prog" data-testid="start-progress">' + esc(txf('{n} of {t}', { n: done, t: counted.length })) + '</span>');
    html += '<div class="q6" data-testid="start-questions">' + list.map(function (question, index) { return questionHTML(question, index, all); }).join('') + barHTML('start') + '</div>';
    if (everyOneDone) html += '<div class="done-bar" data-testid="start-ready"><span class="tag green" style="height:30px;font-size:13.5px">✓ ' + esc(tx('Ready to bill')) + '</span><a class="act" href="/till.html">' + esc(tx('Open the counter')) + ' ›</a><a class="act quiet" href="#/shop">' + esc(tx('Your business')) + ' ›</a></div>';
    return html + defaultsHTML(everyOneDone);
  }

  /* ── YOUR BUSINESS: the seven cards ── */
  /** the bank section of the vault as one line */
  function bankSummary() {
    var section = _vaultSecs().filter(function (candidate) { return candidate.type === 'bank'; })[0], rows = (section && section.rows) || [];
    var valueOf = function (tag) { var row = rows.filter(function (candidate) { return candidate.tag === tag; })[0]; return row ? String(row.value || '') : ''; };
    var bankName = valueOf('bank_name'), accountNo = valueOf('account_no');
    return { has: !!(bankName || accountNo), line: (bankName || tx('Bank')) + (accountNo ? ' ••' + accountNo.slice(-4) : '') };
  }
  /** is export turned on: asked once from what the vault holds, then by the person's press */
  function exportIsOn(all) {
    if (STATE.exportOn == null) STATE.exportOn = ['exp_iec', 'exp_port'].some(function (key) { return all[key] && isFilled(all[key].get()); });
    return STATE.exportOn;
  }
  /** the Tax & registration card's rows: registered? · the number · India's type · what the pack derives · the registered name */
  function taxCardRows(all) {
    var rows = [all.taxReg];
    if (effRegistered()) { rows.push(all.taxNo); if (countryPack().schemes) rows.push(all.taxType); }
    return rows.concat(packRows(), [all.regd]);
  }
  /** the Export card's rows: the switch, and (when on) the pack's export rows */
  function exportCardRows(all) {
    var rows = [{ k: 'exportOn', label: tx('Export'), type: 'seg', opts: [{ v: 'off', n: tx('Off') }, { v: 'on', n: tx('On') }], get: function () { return STATE.exportOn ? 'on' : 'off'; } }];
    if (exportIsOn(all)) (countryPack().exportRows || []).concat([PORT_ROW]).forEach(function (exportRow) { rows.push(all['exp_' + exportRow.k]); });
    return rows;
  }
  /** the seven cards, in the prototype's order */
  function cardList(all) {
    var pack = countryPack(), licences = (pack.licences || []).map(function (licence) { return all['lic_' + licence.k]; });
    return [
      { id: 'biz', icon: 'M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5M10 20v-5h4v5', title: tx('Name & kind'), rows: [all.name, all.logo, all.kind, all.nature, all.supply, all.tagline] },
      { id: 'contact', icon: 'M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5', title: tx('Contact & address'), rows: [all.addr, all.phone, all.email] },
      { id: 'tax', icon: 'M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21zM10 8h4M10 12h4', title: tx('Tax & registration'), rows: taxCardRows(all) },
      { id: 'lic', icon: 'M4 3h16v18H4zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6M9 17h6', title: tx('Licences'), later: tx('Asked at your first bill'), rows: licences },
      { id: 'bank', icon: 'M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18', title: tx('Bank & payments'), later: tx('Asked at your first invoice'), owner: 'bank', rows: [] },
      { id: 'sign', icon: 'M3 17c3-6 5-6 6-3s2 3 4-1 3-3 4 0 2 2 4 1M3 21h18', title: tx('Who signs'), later: tx('Asked when a bill needs a signature'), rows: [all.signer, all.signerAs, all.signature] },
      { id: 'export', icon: 'M2 16l2-6h16l2 6M4 16c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0M8 10V6h8v4', title: tx('Export'), later: tx('Only if you sell abroad'), rows: exportCardRows(all), exportCard: true },
    ];
  }
  /** the Export card's chip: Off, to fill, or On */
  function exportStatus(card) {
    if (!STATE.exportOn) return { cls: 'quiet', text: tx('Off') };
    var missing = card.rows.filter(function (row) { return row.req && !isFilled(row.get()); }).length;
    return missing ? { cls: 'amber', text: txf('{n} to fill', { n: missing }) } : { cls: 'green', text: '✓ ' + tx('On') };
  }
  /** a card's chip: ✕ Wrong · ✓ Done · Not needed yet · n to fill · Off */
  function cardStatus(card) {
    if (card.rows.some(function (row) { return STATE.errors[row.k]; })) return { cls: 'red', text: '✕ ' + tx('Wrong') };
    if (card.owner === 'bank') return bankSummary().has ? { cls: 'green', text: '✓ ' + tx('Done') } : { cls: 'quiet', text: tx('Not needed yet') };
    if (card.exportCard) return exportStatus(card);
    var counted = card.rows.filter(function (row) { return !row.derived && !row.soon; });
    var needed = counted.filter(function (row) { return row.req && !isFilled(row.get()); }).length, anyFilled = counted.some(function (row) { return isFilled(row.get()); });
    if (!needed) return { cls: 'green', text: '✓ ' + tx('Done') };
    if (card.later && !anyFilled) return { cls: 'quiet', text: tx('Not needed yet') };
    return { cls: 'amber', text: txf('{n} to fill', { n: needed }) };
  }
  /** the Export card's On/Off switch */
  function exportSwitchHTML(row) {
    var buttons = row.opts.map(function (choice) { return '<button type="button" data-export="' + choice.v + '" aria-pressed="' + (row.get() === choice.v) + '">' + esc(choice.n) + '</button>'; }).join('');
    return '<div class="row" data-row="exportOn" data-testid="row-exportOn"><div class="lb">' + esc(row.label) + '</div><div class="v"><div class="seg" role="group" aria-label="' + esc(row.label) + '">' + buttons + '</div></div><div class="end"></div></div>';
  }
  /** a card that is "later": one line and the button that opens it */
  function laterHTML(text, button) { return '<div class="later"><span>' + esc(text) + '</span>' + button + '</div>'; }
  /** the bank card's body: the summary line, or "asked at your first invoice · Add now" */
  function bankBodyHTML(card) {
    var bank = bankSummary();
    if (!bank.has) return laterHTML(card.later, '<button class="act quiet xs" type="button" data-pop="bank" data-testid="bank-add">' + esc(tx('Add now')) + '</button>');
    return '<div class="rows"><div class="row" data-testid="row-bank"><div class="lb">' + esc(tx('Bank')) + '</div><div class="v">' + esc(bank.line) + '</div><div class="end"></div></div></div>';
  }
  /** a card's body: its rows, or its one "later" line */
  function cardBodyHTML(card, status) {
    if (card.owner === 'bank') return bankBodyHTML(card);
    if (card.exportCard && !STATE.exportOn) return laterHTML(card.later, '<button class="act quiet xs" type="button" data-export="on" data-testid="export-on">' + esc(tx('Turn on')) + '</button>');
    if (card.later && status.cls === 'quiet' && !card.exportCard && !STATE.openCards[card.id]) return laterHTML(card.later, '<button class="act quiet xs" type="button" data-open="' + card.id + '" data-testid="open-' + card.id + '">' + esc(tx('Fill now')) + '</button>');
    var rows = card.rows.map(function (row) { return row.k === 'exportOn' ? exportSwitchHTML(row) : rowHTML(row); }).join('');
    var more = card.exportCard ? '<div class="row"><div class="lb">' + esc(tx('All export details')) + '</div><div class="v"><button class="act ghost xs" type="button" data-pop="export" data-testid="export-more">' + esc(tx('Open')) + '</button></div><div class="end"></div></div>' : '';
    return '<div class="rows">' + rows + more + '</div>';
  }
  /** a card's head: its icon, title, chip, and (the bank card) the ⓘ and ✎ */
  function cardHeadHTML(card, status) {
    var bankExtras = '';
    if (card.owner === 'bank') bankExtras = infoButton(tx('Today the bank details live in your trade documents. They move to CB Finance › Bank accounts in a later step.')) + (bankSummary().has ? penButton('bank', card.title).replace('data-edit="bank"', 'data-pop="bank"') : '');
    return '<div class="ch"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + card.icon + '"/></svg></span><h2>' + esc(card.title) + '</h2><span class="st tag ' + status.cls + '" data-testid="status-' + card.id + '">' + esc(status.text) + '</span>' + bankExtras + '</div>';
  }
  /** the line above the cards: the wrong tax number (red), or the questions still open (amber) */
  function alertHTML() {
    if (STATE.errors.taxNo) return '<div class="alert" role="alert" data-testid="biz-wrong">✕ ' + esc(txf('{id} is wrong', { id: taxWord() })) + '<button class="act sm" type="button" data-goto="taxNo">' + esc(tx('Fix')) + '</button></div>';
    var open = questionsLeft();
    if (open === 0) return '';
    return '<div class="alert amber" data-testid="biz-left">' + esc(open === 1 ? tx('1 setup question left') : txf('{n} setup questions left', { n: open })) + '<a class="act sm" href="#/start">' + esc(tx('Answer')) + ' ›</a></div>';
  }
  /** the whole Your business screen */
  function businessHTML() {
    var cards = cardList(buildFields()), statuses = cards.map(cardStatus), doneCount = statuses.filter(function (status) { return status.cls === 'green'; }).length;
    var html = titleHTML(tx('Your business'), '<span class="prog" data-testid="biz-progress">' + esc(txf('{n} of 7 done', { n: doneCount })) + '</span>') + alertHTML();
    return html + '<div class="cards" data-testid="biz-cards">' + cards.map(function (card, index) {
      return '<section class="card' + (statuses[index].cls === 'red' ? ' bad' : '') + '" data-testid="card-' + card.id + '" aria-label="' + esc(card.title) + '">' + cardHeadHTML(card, statuses[index]) + cardBodyHTML(card, statuses[index]) + barHTML(card.id) + '</section>';
    }).join('') + '</div>';
  }

  /* ── the popup: today's bank section (or the export sections) of the vault, drawn by cap-shop.js's own painter ── */
  /** the dialog's frame; the vault paints into #vaulthost inside it */
  function popupHTML() {
    var isBank = STATE.popup === 'bank', heading = isBank ? tx('Bank & payments') : tx('Export details');
    var from = esc(tx('Today in your trade documents')) + (isBank ? infoButton(tx('This moves to CB Finance › Bank accounts in a later step. What you save here comes with it.')) : '');
    return '<div class="scrim" data-close="1" data-testid="pop-' + STATE.popup + '"><div class="dlg" role="dialog" aria-modal="true" aria-label="' + esc(heading) + '" style="width:min(620px,100%)"><div class="dh"><div><div class="from">' + from + '</div><h2>' + esc(heading) + '</h2></div>'
      + '<button class="x" type="button" data-close="1" aria-label="' + esc(tx('Close')) + '">✕</button></div><div class="db"><div id="vaulthost" data-testid="pop-vault"></div></div><div class="df"><button class="act" type="button" data-close="1">' + esc(tx('Done')) + '</button></div></div></div>';
  }
  /** open the popup: the vault card limited to the bank (or logistics) section */
  function openPopup(kind) {
    STATE.popup = kind; UI._vaultOnly = kind === 'bank' ? 'bank' : 'logistics';
    var layer = document.getElementById('su-layer'); if (!layer) return;
    layer.innerHTML = popupHTML(); _vaultPaint();
  }
  /** close the popup and repaint (the bank summary may have changed) */
  function closePopup() { STATE.popup = ''; UI._vaultOnly = ''; var layer = document.getElementById('su-layer'); if (layer) layer.innerHTML = ''; paint(); }

  /* ── painting and events ── */
  /** put the cursor back in the box it was in (or the one just asked for) */
  function restoreFocus(host, focusedKey, caret) {
    var target = focusedKey ? host.querySelector('[data-k="' + focusedKey + '"]') : (STATE.focusKey ? host.querySelector('[data-k="' + STATE.focusKey + '"]') : null);
    if (!target) return;
    target.focus();
    try { if (caret != null && target.setSelectionRange && !STATE.focusKey) target.setSelectionRange(caret, caret); } catch (failure) { if (window.cbQuiet) window.cbQuiet('setup:caret', failure); }
  }
  /** paint the screen; keep the scroll place and the cursor */
  function paint() {
    var host = STATE.host; if (!host || !STATE.loaded) return;
    var active = document.activeElement, focusedKey = active && active.getAttribute && active.getAttribute('data-k'), caret = active && active.selectionStart, scrollTop = host.scrollTop;
    host.innerHTML = '<div class="su" data-testid="' + (STATE.mode === 'start' ? 'start-screen' : 'biz-screen') + '">' + (STATE.mode === 'start' ? startHTML() : businessHTML()) + '</div><div id="su-layer"></div>';
    if (STATE.popup) { document.getElementById('su-layer').innerHTML = popupHTML(); _vaultPaint(); }
    host.scrollTop = scrollTop;
    restoreFocus(host, focusedKey, caret); STATE.focusKey = '';
    updateBadge();
  }
  /* ── SAVE-CARD 2026-10-16: drafts per card · the bar "n changes · Undo · Save" · the inline Review for critical keys ── */
  /** has the row an unsaved change (the tax question in Start here also counts its "Not registered" press) */
  function rowChanged(key) { return STATE.drafts[key] != null || (key === 'taxNo' && STATE.mode === 'start' && STATE.drafts.taxReg != null); }
  /** is the tax question answered "registered" as the card now stands (a draft counts) */
  function effRegistered() { return STATE.drafts.taxReg != null ? STATE.drafts.taxReg === 'yes' : !!setupRecord().registered; }
  /** the row keys of each card, in the order they are written: Start here is ONE card */
  function cardKeys() {
    if (STATE.mode === 'start') return { start: ['country', 'timezone', 'supply', 'taxReg', 'taxNo', 'name', 'addr'] };
    var map = {};
    cardList(buildFields()).forEach(function (card) { map[card.id] = card.rows.map(function (row) { return row.k; }); });
    return map;
  }
  /** the card a row key belongs to ('' when none shows it) */
  function cardOf(key) { var map = cardKeys(); return Object.keys(map).filter(function (id) { return map[id].indexOf(key) >= 0; })[0] || ''; }
  /** the card's unsaved changes, in write order: [{ key, field, value }] (a tax number is dropped when the card now says "not registered") */
  function changesOf(cardId) {
    var order = cardKeys()[cardId] || [];
    return Object.keys(STATE.drafts).filter(function (key) { return order.indexOf(key) >= 0 && !(key === 'taxNo' && STATE.drafts.taxReg === 'no'); })
      .sort(function (first, second) { return order.indexOf(first) - order.indexOf(second); })
      .map(function (key) { return { key: key, field: fieldFor(key), value: cleanText(STATE.drafts[key]) }; })
      .filter(function (change) { return change.field; });
  }
  /** is this change critical (CRITICAL, the one list) */
  function isCritical(change) {
    var place = change.field.place;
    return CRITICAL.keys.indexOf(change.key) >= 0 || CRITICAL.keyPattern.test(change.key) || !!(place && CRITICAL.vaultTypes.indexOf(place.type) >= 0);
  }
  /** "1 change" · "n changes" */
  function changesWord(count) { return count === 1 ? tx('1 change') : txf('{n} changes', { n: count }); }
  /** the words a value is shown in: a choice's name, else the value itself ('—' when nothing) */
  function shownValue(field, value) {
    if (value == null || value === '') return '—';
    var choice = (field.opts || []).filter(function (choice) { return String(choice.v) === String(value); })[0];
    return choice ? choice.n : String(value);
  }
  /** the Review: every change of the card, "Label  old → new", and the two buttons */
  function reviewHTML(cardId, changes) {
    var lines = changes.map(function (change) {
      return '<div class="rl" data-testid="rv-' + esc(change.key) + '"><span class="rk">' + esc(change.field.label) + '</span> <span class="dim" data-testid="was-' + esc(change.key) + '">' + esc(shownValue(change.field, change.field.get()))
        + '</span> → <b data-testid="now-' + esc(change.key) + '">' + esc(shownValue(change.field, change.value)) + '</b></div>';
    }).join('');
    var confirmWords = changes.length === 1 ? tx('Confirm 1 change') : txf('Confirm {n} changes', { n: changes.length });
    return '<div class="review" role="group" data-testid="review-' + cardId + '">' + lines + '<div class="rb"><button class="act quiet xs" type="button" data-keep="' + cardId + '" data-testid="keep-' + cardId + '">' + esc(tx('Keep as it was')) + '</button>'
      + '<button class="act xs" type="button" data-confirm="' + cardId + '" data-testid="confirm-' + cardId + '">' + esc(confirmWords) + '</button></div></div>';
  }
  /** the card's foot: "n changes · Undo · Save" (hidden at 0), ✓ Saved for a moment, or the Review */
  function barHTML(cardId) {
    var changes = changesOf(cardId), shut = !changes.length && STATE.cardSaved !== cardId, inner = '';
    if (STATE.review === cardId && changes.length) return '<div class="cbar" data-bar="' + cardId + '">' + reviewHTML(cardId, changes) + '</div>';
    if (changes.length) {
      inner = '<span class="n" data-testid="count-' + cardId + '">' + esc(changesWord(changes.length)) + '</span><button class="act quiet xs" type="button" data-undo="' + cardId + '" data-testid="undo-' + cardId + '">' + esc(tx('Undo')) + '</button>'
        + '<button class="act xs" type="button" data-save="' + cardId + '" data-testid="save-' + cardId + '">' + esc(tx('Save')) + '</button>';
    } else if (!shut) inner = '<span class="saved" role="status" data-testid="saved-' + cardId + '">✓ ' + esc(tx('Saved')) + '</span>';
    return '<div class="cbar" data-bar="' + cardId + '" data-testid="bar-' + cardId + '"' + (shut ? ' hidden' : '') + '>' + inner + '</div>';
  }
  /** redraw the cards' bars and the changed marks without touching the boxes (a box being typed in keeps its cursor) */
  function refreshBars() {
    if (!STATE.host) return;
    Array.prototype.forEach.call(STATE.host.querySelectorAll('.su [data-bar]'), function (bar) { bar.outerHTML = barHTML(bar.getAttribute('data-bar')); });
    Array.prototype.forEach.call(STATE.host.querySelectorAll('.su .row[data-row]'), function (row) { row.classList.toggle('chg', rowChanged(row.getAttribute('data-row'))); });
  }
  /** keep (or drop, when it equals what is stored) one row's draft; the card's Review closes because the list changed */
  function setDraft(key, value) {
    var field = fieldFor(key); if (!field || field.soon) return;
    if (cleanText(value) === cleanText(field.get())) delete STATE.drafts[key]; else STATE.drafts[key] = value;
    if (key === 'taxNo' && cleanText(value) !== '' && STATE.drafts.taxReg === 'no') delete STATE.drafts.taxReg;
    delete STATE.errors[key]; if (STATE.review === cardOf(key)) STATE.review = '';
  }
  /** a refused value goes on its row: field.check, an empty required box, a "Registered" with no number; true when any was refused */
  function refuseAny(changes) {
    var refused = false;
    changes.forEach(function (change) {
      var problem = change.field.check ? change.field.check(change.value) : '';
      if (!problem && change.field.req && change.value === '') problem = tx('Cannot be empty');
      if (problem) { STATE.errors[change.key] = problem; refused = true; }
    });
    var needsNumber = STATE.drafts.taxReg === 'yes' && !isFilled(STATE.drafts.taxNo) && !isFilled(fieldFor('taxNo').get());
    if (needsNumber) { STATE.errors.taxNo = txf('Enter your {id}', { id: taxWord() }); refused = true; }
    return refused;
  }
  /** Save pressed: check every change (a refusal stays on its row, nothing is written) → Review when any is critical → else write */
  function saveCard(cardId) {
    var changes = changesOf(cardId); if (!changes.length || STATE.saving[cardId]) return;
    changes.forEach(function (change) { delete STATE.errors[change.key]; });
    delete STATE.errors.taxNo;
    if (refuseAny(changes)) { STATE.review = ''; STATE.editing = Object.keys(STATE.errors)[0]; STATE.focusKey = STATE.editing; paint(); return; }
    if (changes.some(isCritical)) { STATE.review = cardId; paint(); return; }
    writeChanges(cardId, changes);
  }
  /** one change written through its row's own writer, then its draft is gone */
  function writeOne(change) {
    return Promise.resolve(change.field.set(change.value)).then(function () { delete STATE.drafts[change.key]; if (change.key === 'taxNo') delete STATE.drafts.taxReg; });
  }
  /** write the changes one after the other; the first refusal stays on its row and the ones after it stay as drafts */
  function writeChanges(cardId, changes) {
    STATE.review = ''; STATE.saving[cardId] = true;
    changes.reduce(function (chain, change) { return chain.then(function () { return writeOne(change); }); }, Promise.resolve()).then(function () {
      delete STATE.saving[cardId]; delete STATE.drafts.taxReg; STATE.editing = null; flashSaved(cardId); paint();
    }, function (failure) {
      delete STATE.saving[cardId];
      var failed = changes.filter(function (change) { return STATE.drafts[change.key] != null; })[0];
      if (failed) { STATE.errors[failed.key] = (failure && failure.message) || tx('Could not save'); STATE.editing = failed.key; STATE.focusKey = failed.key; }
      paint();
    });
  }
  /** "Confirm n changes" pressed: write what the Review listed */
  function confirmCard(cardId) { if (STATE.review === cardId) writeChanges(cardId, changesOf(cardId)); }
  /** Undo (bar) and "Keep as it was" (Review): every draft of the card is dropped, nothing is written */
  function dropDrafts(cardId) {
    changesOf(cardId).forEach(function (change) { delete STATE.drafts[change.key]; delete STATE.errors[change.key]; });
    delete STATE.drafts.taxReg; delete STATE.errors.taxNo; STATE.review = ''; STATE.editing = null; paint();
  }
  /** show "✓ Saved" on the card's bar for a moment */
  function flashSaved(cardId) {
    STATE.cardSaved = cardId; clearTimeout(flashSaved.timer);
    flashSaved.timer = setTimeout(function () { STATE.cardSaved = ''; refreshBars(); }, SAVED_FADE_MS);
  }
  /** the text a person typed, trimmed ('' when nothing) */
  function cleanText(typedText) { return String(typedText == null ? '' : typedText).trim(); }
  /** the ✕ at a row: keep this one row as it was */
  function stopEditing(key) { delete STATE.drafts[key]; if (key === 'taxNo') delete STATE.drafts.taxReg; delete STATE.errors[key]; STATE.editing = null; paint(); }
  /** the ⓘ text, in a small popover beside its button */
  function showInfo(button) {
    closeInfo();
    var bubble = document.createElement('div'); bubble.className = 'su-pop'; bubble.setAttribute('role', 'tooltip'); bubble.setAttribute('data-testid', 'info-pop'); bubble.textContent = button.getAttribute('data-info'); document.body.appendChild(bubble);
    var place = button.getBoundingClientRect();
    bubble.style.top = Math.min(place.bottom + 6, innerHeight - bubble.offsetHeight - 8) + 'px'; bubble.style.left = Math.max(8, Math.min(place.left - 10, innerWidth - bubble.offsetWidth - 8)) + 'px';
  }
  /** take the ⓘ popover away */
  function closeInfo() { var bubble = document.querySelector('.su-pop'); if (bubble) bubble.remove(); }
  /** ✎ pressed: open the row's control */
  function startEditing(key) { STATE.editing = key; STATE.focusKey = key; paint(); }
  /** a segment button pressed: a draft, nothing is written */
  function pressChoice(key, button) { setDraft(key, button.getAttribute('data-val')); STATE.editing = key; paint(); }
  /** "Use <country>" pressed: the guessed country becomes the draft */
  function useGuess() { var picker = STATE.host.querySelector('select[data-k="country"]'); setDraft('country', picker && picker.value); STATE.editing = 'country'; paint(); }
  /** "Not registered" pressed: the draft answer of the tax question (and the typed number goes) */
  function pressNotRegistered() { delete STATE.drafts.taxNo; delete STATE.errors.taxNo; STATE.drafts.taxReg = 'no'; STATE.review = ''; STATE.editing = 'taxNo'; paint(); }
  /** "Fill now" pressed: open a "later" card */
  function openCard(cardId) { STATE.openCards[cardId] = true; paint(); }
  /** Export Off / On pressed */
  function switchExport(state) { STATE.exportOn = state === 'on'; paint(); }
  /** "Fix" pressed: take the person to the wrong row */
  function gotoRow(key) {
    STATE.editing = key; STATE.focusKey = key; paint();
    var row = STATE.host.querySelector('[data-row="' + key + '"]'); if (row && row.scrollIntoView) row.scrollIntoView({ block: 'center' });
  }
  var CLICK_ACTIONS = { 'data-edit': startEditing, 'data-cancel': stopEditing, 'data-save': saveCard, 'data-undo': dropDrafts, 'data-confirm': confirmCard, 'data-keep': dropDrafts, 'data-seg': pressChoice, 'data-use': useGuess, 'data-notreg': pressNotRegistered,
    'data-open': openCard, 'data-export': switchExport, 'data-goto': gotoRow, 'data-pop': openPopup };
  /** run the action named by the pressed element's attribute; true when one ran */
  function runClickAction(button) {
    return Object.keys(CLICK_ACTIONS).some(function (attribute) {
      var value = button.getAttribute(attribute);
      if (!value) return false;
      CLICK_ACTIONS[attribute](value, button); return true;
    });
  }
  /** every press inside the screen: ⓘ, the row's buttons, the popup's close */
  function onClick(e) {
    var host = STATE.host; if (!host || !host.contains(e.target)) return;
    var button = e.target.closest('button,a,[data-close]'); if (!button) { closeInfo(); return; }
    if (button.getAttribute('data-info') != null) { e.preventDefault(); e.stopPropagation(); showInfo(button); return; }
    closeInfo();
    if (runClickAction(button)) return;
    if (button.getAttribute('data-close') && (button === e.target || button.tagName === 'BUTTON')) closePopup();
  }
  /** a change inside the popup: the vault's own merge-patch, quietly, "✓ Saved" beside the box (the pattern of cap-shop.js's autosave) */
  function vaultChanged(target) {
    var errorBox = document.getElementById('vault_err'); if (errorBox) errorBox.textContent = '';
    enqueue(function () { return vaultSaveQuiet(); }).then(function (didSave) {
      if (!didSave) return;
      var old = target.nextElementSibling; if (old && old.getAttribute('data-saved')) old.remove();
      var badge = document.createElement('span'); badge.setAttribute('data-saved', '1'); badge.setAttribute('data-testid', 'saved-vault'); badge.setAttribute('role', 'status'); badge.className = 'saved'; badge.textContent = '✓ ' + tx('Saved');
      target.parentNode.insertBefore(badge, target.nextSibling);
    }, function (failure) { vaultSaveFailed(failure, errorBox); });
  }
  /** a select was changed: a draft, nothing is written (a text box keeps its draft as it is typed — see onType) */
  function onChange(e) {
    var target = e.target; if (!STATE.host || !STATE.host.contains(target)) return;
    if (target.closest('#vaulthost')) { vaultChanged(target); return; }
    if (target.matches('select[data-k]')) { var key = target.getAttribute('data-k'); setDraft(key, target.value); STATE.editing = key; paint(); }
  }
  /** a text box is being typed in: the draft follows, only the bar and the changed mark are redrawn (the cursor stays) */
  function onType(e) {
    var target = e.target; if (!STATE.host || !STATE.host.contains(target) || !target.matches('input[data-k]')) return;
    var key = target.getAttribute('data-k'), hadReason = !!STATE.errors[key];
    setDraft(key, target.value);
    if (hadReason) { STATE.focusKey = ''; paint(); } else refreshBars();   /* the red goes as soon as the person types */
  }
  /** Enter in a box does nothing but keep the draft; Escape closes the popup, or a row that has no change */
  function onKey(e) {
    if (!STATE.host || !STATE.host.contains(e.target)) return;
    if (e.key === 'Enter' && e.target.matches('input[data-k]')) { e.preventDefault(); return; }
    if (e.key !== 'Escape') return;
    if (STATE.popup) closePopup(); else if (STATE.editing && !rowChanged(STATE.editing) && !STATE.errors[STATE.editing]) { STATE.editing = null; paint(); }
    closeInfo();
  }
  var listening = false;
  /** the three page-wide listeners, once */
  function listen() {
    if (listening) return; listening = true;
    document.addEventListener('click', onClick); document.addEventListener('change', onChange); document.addEventListener('input', onType); document.addEventListener('keydown', onKey);
  }

  /* ── the sidebar: "Start here" with how many questions are left, gone once all are answered ── */
  /** badge the "Start here" item with the questions left (hide it when none, unless it is the screen on show) */
  function updateBadge() {
    var item = document.querySelector('.nav-btn[data-sec="start"]'); if (!item) return;
    var left = questionsLeft(), old = item.querySelector('.n'); if (old) old.remove();
    if (left > 0) { var badge = document.createElement('span'); badge.className = 'n'; badge.setAttribute('data-testid', 'start-left'); badge.textContent = String(left); item.appendChild(badge); }
    item.style.display = (left > 0 || item.classList.contains('active')) ? '' : 'none';
  }

  /* ── loading: the country-setup's three reads (shared with the Country screen), the shop's own row, the vault ── */
  /** the shop's own row from /me ({} when it cannot be read) */
  function readShop() { return api('me').then(function (reply) { return (reply && (reply.entity || reply)) || {}; }, function () { return {}; }); }
  /** a tax number the shop already holds that does not check out is shown wrong from the start */
  function flagStoredTaxNumber() {
    var record = setupRecord(), reason = record.registered && record.number ? csuTaxIdWhy(record.country, record.number) : '';
    if (reason) { STATE.errors.taxNo = reason; STATE.editing = 'taxNo'; }
  }
  /** read everything the screens need, then call back */
  function load(done) {
    CBCountry.data(function () {
      readShop().then(function (shop) {
        STATE.shop = shop; CSU.me = Object.assign({}, CSU.me, shop);
        if (typeof CBShop !== 'undefined' && CBShop.setCountry) CBShop.setCountry(shopCountry());
        flagStoredTaxNumber();
        var countPolicy = api('policyGet').then(function (reply) { STATE.policyCount = reply && reply.flags ? Object.keys(reply.flags).length : 0; }, function () { STATE.policyCount = 0; });
        Promise.all([readVault(), countPolicy]).then(function () { STATE.loaded = true; done(); });
      });
    });
  }
  /** a fresh screen: nothing typed, nothing open */
  function begin(host, mode) {
    listen(); STATE.host = host; STATE.mode = mode; STATE.errors = {}; STATE.drafts = {}; STATE.editing = null; STATE.review = ''; STATE.cardSaved = ''; STATE.saving = {}; STATE.openCards = {}; STATE.popup = ''; STATE.exportOn = null; STATE.loaded = false;
    /* W24: leaving with a draft asks first (CBUnsaved, accounts-shell.js — the same hook every settings screen uses; it also arms beforeunload) */
    if (window.CBUnsaved) CBUnsaved.form({ dirty: function () { return Object.keys(STATE.drafts).length > 0; } });
    host.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + esc(tx('Loading')) + '</div>';
  }
  /** Start here; a bare /settings.html with every question answered goes on to Your business */
  function mountStart(host, options) {
    begin(host, 'start'); STATE.implicit = !!(options && options.implicit);
    load(function () { if (STATE.implicit && questionsLeft() === 0) { location.replace('#/shop'); return; } paint(); });
  }
  /** Your business, the seven cards */
  function mountBusiness(host) { begin(host, 'business'); load(function () { paint(); }); }
  /** settings.html, once signed in: the sidebar's Start here knows how many questions are left */
  function watch() { CBCountry.data(function () { readShop().then(function (shop) { STATE.shop = shop; CSU.me = Object.assign({}, CSU.me, shop); updateBadge(); }); }); }
  return { mountStart: mountStart, mountBusiness: mountBusiness, watch: watch, left: questionsLeft };
})();
