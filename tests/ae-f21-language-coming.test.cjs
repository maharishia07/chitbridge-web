'use strict';
/* AE-F-21 (Walk AE 21 Nov): sign-up lists the pack's languages, but the screens are English: a language the app does not offer yet reads greyed "coming", the offered one first.
   Runs public/app/register-form.js in a vm with stubs. Run: node tests/ae-f21-language-coming.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const sb = { console, tx: (s) => s, txf: (s) => s, esc: (s) => String(s == null ? '' : s), window: {}, document: { getElementById: () => null, addEventListener() {} }, Intl };
sb.window = sb; const cx = vm.createContext(sb);
vm.runInContext(fs.readFileSync(__dirname + '/../public/app/register-form.js', 'utf8'), cx);
assert.strictEqual(vm.runInContext("regLangsOrdered(['ar','en','hi']).join()", cx), 'en,ar,hi');
const ar = vm.runInContext("regLangHTML('ar')", cx), en = vm.runInContext("regLangHTML('en')", cx);
assert(/reg-lang-coming-ar/.test(ar) && /coming/.test(ar), 'Arabic is greyed "coming"');
assert(!/coming/.test(en), 'English is offered');
console.log('2 passed');
