/* tests/acc-384-access-in-place.test.cjs — ACC-384 (walk sit-au W23): Accounts > "Who can see my books" shows the grants in place; it no longer jumps into Network.
 * Pure source reads: the page loads the ONE grants component (books-grant-member.js) and mounts it in the view's host div; the Network page still mounts the same component. No browser. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'accounts.html'), 'utf8');
const net = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'network-app.js'), 'utf8');
let ok = 0;
const pass = (w) => { ok++; console.log('  ok  ' + w); };
assert(/src="\/app\/books-grant-member\.js"/.test(page) && /src="\/app\/books-grant-words\.js"/.test(page) && /src="\/app\/books-actions-view\.js"/.test(page));
pass('accounts.html loads the grants component and its two helpers');
assert(/access: \(b\) => accessView\(b\)/.test(page) && /CBBooksGrantMember\.mount\(host,/.test(page));
pass('the access view mounts the component in its host div');
assert(!/CB_HOMES\.network \+ '#books'/.test(page));
pass('no jump into the Network module');
assert(/CBBooksGrantMember\.mount\(host,/.test(net));
pass('the Network page mounts the same component (one component, two hosts)');
assert(/grants: \(\) => CBBooksGrantApi\.run\(grantCall\(\), 'grantsList'\)/.test(page) && /openAccess: \(\) => show\('access'\)/.test(page));
pass('Delegate work reads the firms from the same grants list and points at this view');
console.log(ok + ' passed');
