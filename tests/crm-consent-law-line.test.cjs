'use strict';
/* A-F-52 (Walk A, 21 Nov 2026): the Consent block's law line speaks to the shopkeeper, not in the customer's voice ("You may opt out").
   public/app/cap-crm-privacy.js crmConsentLawLine run in node. Run: node tests/crm-consent-law-line.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const cx = vm.createContext({ console, window: {}, tx: (s) => s, esc: (s) => String(s) }); cx.window = cx;
vm.runInContext(fs.readFileSync(__dirname + '/../public/app/cap-crm-privacy.js', 'utf8'), cx);
const line = cx.crmConsentLawLine({ known: true, short: 'Privacy Act', consent: 'Offers need your consent. You may opt out at any time.' });
assert(/^<b>Privacy Act<\/b> · Send offers only to people who agreed/.test(line) && !/You may opt out/.test(line), 'a known law is named, in the shopkeeper\'s voice: ' + line);
assert(cx.crmConsentLawLine({ known: false, note: 'No privacy pack for ZZ yet.' }) === 'No privacy pack for ZZ yet.', 'an unknown country says so');
assert(cx.crmConsentLawLine(null) === '', 'no law, no words');
console.log('  ok  A-F-52: 3 checks');
