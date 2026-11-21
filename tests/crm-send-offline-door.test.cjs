'use strict';
/* A-F-57 (Walk A, 21 Nov 2026): a shop with no WhatsApp connected is told in the send sheet, with the door to connect, before it confirms.
   public/app/cap-crm-groups-send.js crmSendDryShown run in node. Run: node tests/crm-send-offline-door.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const cx = vm.createContext({ console, window: {}, tx: (s) => s, txf: (s, o) => s.replace('{n}', o.n), esc: (s) => String(s), crmReachWords: () => ({ may: '1 may be sent', not: '' }), crmSendRefusedHtml: () => '',
  outsideReason: () => 'WhatsApp is not connected.', outsideLoad: async () => ({}) });
cx.window = cx;
vm.runInContext(fs.readFileSync(__dirname + '/../public/app/cap-crm-groups-send.js', 'utf8'), cx);
const node = { innerHTML: '' }, btn = { disabled: false, title: '', textContent: '' };
cx.crmSendDryShown({ may: 1, refused_n: 0 }, node, btn);
assert(btn.disabled, 'Send stays greyed');
assert(/WhatsApp is not connected\./.test(node.innerHTML) && /<a href="\/settings\.html#\/connectors">Open Channels<\/a>/.test(node.innerHTML), 'the sheet says why and offers the door: ' + node.innerHTML);
const src = fs.readFileSync(__dirname + '/../public/app/cap-crm-groups-send.js', 'utf8');
assert(/await outsideLoad\(\);[^\n]*\n\s*crmSendDryShown/.test(src), 'the outside read is awaited before the Send button is judged');
console.log('  ok  A-F-57: 3 checks');
