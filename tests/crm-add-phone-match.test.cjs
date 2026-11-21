'use strict';
/* A-F-33 (Walk A, 21 Nov 2026): typing a party's phone in Add party finds that party however it is spaced, so a duplicate is not made.
   public/app/cap-crm.js crmAddMatches run in node (the function alone is cut from the file). Run: node tests/crm-add-phone-match.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../public/app/cap-crm.js', 'utf8');
const at = src.indexOf('function crmAddMatches'); assert(at > 0, 'crmAddMatches exists');
const body = src.slice(at, src.indexOf('function crmAddResults', at));
const cx = vm.createContext({}); vm.runInContext(body, cx);
const p = { display_name: 'Harbour Cafe', phone: '+61412345678', email: 'h@x.com.au' };
assert(cx.crmAddMatches(p, '+61 412 345 678'), 'spaced phone finds it');
assert(cx.crmAddMatches(p, '412-345-678'), 'dashed national part finds it');
assert(cx.crmAddMatches(p, 'harbour'), 'a name still matches');
assert(!cx.crmAddMatches(p, '+61 499 999 999'), 'another phone does not');
assert(!cx.crmAddMatches(p, '99999'), 'a short digit run is not a phone');
console.log('  ok  A-F-33: 5 checks');
