'use strict';
/* A-F-18 / A-F-66 (Walk A 21 Nov): CB Settings › Your business has a Business name box (the shop's one name, display_name) that Save sends.
   Runs public/app/cap-shop.js in a vm with stubs (no browser). Run: node tests/startfix-shop-name-box.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const nodes = {};
const sb = {
  console, setTimeout, SESSION: {}, tx: (s) => s, txf: (s) => s, esc: (s) => String(s == null ? '' : s).replace(/"/g, '&quot;'),
  val: (id) => (nodes[id] ? nodes[id].value : ''), toast() {}, UI: {}, CBAction: { run() {} }, api() { return Promise.resolve({}); },
  document: { getElementById: (id) => nodes[id] || null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({ style: {} }) },
};
sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(__dirname + '/../public/app/cap-shop.js', 'utf8'), sb);
const html = vm.runInContext("shopNameHTML({ display_name: 'Walk A \"Coffee\"' })", sb);
ok(/id="pf_shopname"/.test(html) && /for="pf_shopname"/.test(html) && /Business name/.test(html) && /value="Walk A &quot;Coffee&quot;"/.test(html), 'the Business name box is drawn with the shop name, escaped');
const pair = vm.runInContext("SHOP_FIELDS.filter(function (p) { return p[0] === 'pf_shopname'; })[0]", sb);
ok(pair && pair[1] === 'display_name', 'Save sends the box as display_name (the same field Print setup writes)');
nodes.pf_shopname = { value: 'Walk A Coffee Supplies' }; nodes.pf_gstn = { value: '51824753556' };
const body = vm.runInContext('profFieldsBody(SHOP_FIELDS)', sb);
ok(body.display_name === 'Walk A Coffee Supplies' && body.gstn === '51824753556', 'the body carries the name and the ABN together');
console.log(n + ' passed');
