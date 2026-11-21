'use strict';
/* L-F-16 (21 Nov, UAE walk L): the owner (not the help desk) opens Assist and sees the answers with ONE line saying who publishes — not a whole editor
   (question, draft, answer, where it shows, Accept, Reject) with one greyed button. The help desk still gets the editor; a failed check keeps the editor (unknown is not a refusal).
   Run: node tests/assist-owner-readonly.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const node = () => new Proxy({ style: {} }, { get: (t, k) => (k in t ? t[k] : () => node()), set: (t, k, v) => { t[k] = v; return true; } });
function run(whoami) {
  const cx = vm.createContext({ console, esc: (s) => String(s == null ? '' : s), tx: (s) => s, document: { getElementById: () => node() }, EP: {}, CBList: { mount: () => ({}) },
    CBTasks: { actRow: (id) => '<button id="' + id + '"></button>' }, CBAction: {},
    api: (key) => (key === 'assistWhoami' ? whoami() : Promise.resolve([{ id: 'q1', q: 'Q', a: 'A', context: ['*'] }])) });
  cx.window = cx; cx.globalThis = cx;
  vm.runInContext(fs.readFileSync(__dirname + '/../public/app/cap-assist.js', 'utf8'), cx);
  return cx.CBAssistReview.mount(node()).then(() => cx.CBAssistReview.reviewHTML());
}
(async () => {
  const owner = await run(() => Promise.resolve({ actions: { publish: { ok: false, why: 'not_helpdesk', say: 'Only a help desk can publish.' } } }));
  assert.ok(owner.includes('ca-readonly') && owner.includes('Only a help desk can publish.') && !/ca_accept|ca-draft|<textarea/.test(owner), 'owner: one line, no editor: ' + owner);
  const desk = await run(() => Promise.resolve({ actions: { publish: { ok: true } } }));
  assert.ok(desk.includes('ca_accept') && desk.includes('<textarea') && !desk.includes('ca-readonly'), 'help desk: the editor');
  const down = await run(() => Promise.reject(new Error('net')));
  assert.ok(down.includes('ca_accept') && !down.includes('ca-readonly'), 'a failed check is not a refusal: the editor stays (greyed with the try-again sentence)');
  console.log('assist-owner-readonly: all ok');
})().catch((e) => { console.error(e); process.exit(1); });
