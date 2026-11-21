'use strict';
/* F-73 (21 Nov audit walk): a client's BAS / tax return is open to its AUDITOR on the acting books page, read only.
   The server already lists GET /returns for a grant (api middleware/books-grant GRANT_READS); the web menu (books-acting tabOpen) was the closed door.
   Held here: the auditor's menu keeps Bank, Month lock and the tax close tab, nothing that writes; the adviser keeps its tabs; the owner is never cut.
   Run: node tests/aud-f73-auditor-tax-return.test.cjs */
const fs = require('fs'), assert = require('assert'), vm = require('vm');
const sandbox = { document: null, sessionStorage: { setItem() {} }, CBBooksGrantApi: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/../public/app/books-acting.js', 'utf8'), sandbox);
const A = sandbox.CBBooksActing;
const menuFor = (role) => {
  A.leave();
  if (role !== 'owner') A.enter({ id: '7', name: 'Moonee Espresso' }, role);
  const menu = [['daybook'], ['gstclose'], ['bank'], ['lock'], ['yearclose'], ['assets'], ['todo']];
  A.keepTabs(menu, [['g', menu.slice()]]);
  return menu.map((item) => item[0]);
};
const auditor = menuFor('auditor');
assert(auditor.includes('gstclose'), 'the auditor can open the tax return tab');
assert(auditor.includes('bank') && auditor.includes('lock'), 'the auditor keeps Bank and Month lock');
['yearclose', 'assets', 'todo', 'daybook'].forEach((tab) => assert(!auditor.includes(tab), 'the auditor is not given ' + tab));
assert(menuFor('adviser').includes('gstclose') === false, 'the adviser menu is unchanged (no tax close tab)');
assert.strictEqual(menuFor('owner').length, 7, 'the owner is never cut');
console.log('ok aud-f73-auditor-tax-return');
