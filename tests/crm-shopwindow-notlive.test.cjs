'use strict';
/* A-F-60 (Walk A, 21 Nov 2026): the Shop window screen tells the owner to share a link that opens "Shop not found" while the shop is private/closed.
   Now it says why in words before the link is shared, and shows the id Your online shop shows. public/app/cap-crm-groups-window.js run in node with a stub page.
   Run: node tests/crm-shopwindow-notlive.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
function page(me) {
  const note = { textContent: '' }, url = { textContent: '' };
  const cx = vm.createContext({ console, location: { origin: 'https://x.test' }, SESSION: { bridgeId: 'CBTZ43X5M9' }, tx: (s) => s, esc: (s) => String(s),
    document: { getElementById: (id) => (id === 'crm_sc_notlive' ? note : null), addEventListener() {}, querySelector: (q) => (/crm-sc-url/.test(q) ? url : null) },
    meNow: async () => { if (me instanceof Error) throw me; return me; } });
  cx.window = cx;
  vm.runInContext(fs.readFileSync(__dirname + '/../public/app/cap-crm-groups-window.js', 'utf8'), cx);
  return { cx, note, url };
}
(async () => {
  const priv = page({ catalogue_visibility: 'private', user_id: 'walka', bridge_id: 'CBTZ43X5M9' });
  await priv.cx.crmShopLiveRead();
  ok(/is private, so customers see "Shop not found"/.test(priv.note.textContent), 'a private shop is told, in words, why the link shows Shop not found');
  ok(priv.url.textContent === 'https://x.test/shop.html?s=walka', 'the link shows the id Your online shop shows (user id first)');
  const closed = page({ catalogue_visibility: 'public', business_status: 'closed' });
  await closed.cx.crmShopLiveRead();
  ok(/closed/.test(closed.note.textContent), 'a closed shop is told it is closed');
  const live = page({ catalogue_visibility: 'public', business_status: 'open', bridge_id: 'CBX' });
  await live.cx.crmShopLiveRead();
  ok(live.note.textContent === '' && live.url.textContent.endsWith('?s=CBX'), 'a public open shop shows no warning, and the bridge id when there is no user id');
  const bad = page(new Error('net'));
  await bad.cx.crmShopLiveRead();
  ok(bad.note.textContent === '', 'an unreadable shop says nothing false');
  console.log(n + ' passed');
})().catch((e) => { console.error('FAIL ' + e.message); process.exit(1); });
