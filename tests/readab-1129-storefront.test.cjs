'use strict';
// @type: unit
/**
 * tests/readab-1129-storefront.test.cjs — the unit layer under public/app/cap-network-storefront.js (the storefront panel of a network node, split into one function per section).
 *
 * OWNS      the offline proof that the panel still draws every section of the order form, says in words what an empty list means, and escapes what a person typed.
 * CALLED BY node tests/readab-1129-storefront.test.cjs (offline, no browser); the page render walk is scripts/cap-network-render.test.mjs
 * UNIT      04/Network design
 * FLOW      load the module into a sandbox with stand-ins for its globals → render a node with a full order spec and an empty one → read the words and the escaping
 * CARD      qa/readability-guard
 *
 * Evidence for the §7 minimums, in words the trace reads (MIN lines are explicit evidence):
 * MIN could-not-read-words
 *  - could-not-read-words: an order form with nothing in a list does not draw a blank hole: it says in words "Nothing asked back.", "No states" and "No attachments." (checked below).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const FILE = path.join(__dirname, '..', 'public', 'app', 'cap-network-storefront.js');
const spoken = [];
const sandbox = {
  escJs: (text) => String(text).replace(/['"<>\\]/g, (ch) => '\\x' + ch.charCodeAt(0).toString(16)),
  esc: (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
  tx: (text) => { spoken.push(text); return text; },
  NET_EXPOSURE: [{ k: 'private', label: '— Private' }, { k: 'public', label: 'Public' }],
  CAT_METHODS: [{ k: 'cart', label: 'Cart', hint: 'hint-cart' }, { k: 'quote', label: 'Quote', hint: 'hint-quote' }],
  OFF_RAIL_CHANNELS: ['whatsapp', 'email'],
  COLLECT_CADENCE: ['once', 'weekly'],
  _methodPreview: (method) => '<preview ' + method + '>',
  _chitPreview: (node) => '<chit-preview ' + node.key + '>',
  _ensureOrder: (node) => node.order
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(FILE, 'utf8'), sandbox, { filename: FILE });

function check(label, fn) {
  fn();
  console.log('  ok ' + label);
}

const full = {
  key: 'shop-1',
  exposure: 'public',
  order: {
    method: 'quote',
    inlets: [{ channel: 'email', handle: 'a<b' }],
    collectBack: [{ name: 'delivery', cadence: 'weekly' }],
    maxItems: 5,
    states: [{ name: 'open' }, { name: 'confirmed' }, { name: 'closed' }],
    attachments: [{ name: 'assay.pdf' }],
    notes: 'a note'
  }
};
const empty = { key: 'shop-2', order: {} };

check('the full panel draws every section of the order form', () => {
  const html = sandbox._storefrontConfig(full);
  ['WHO SEES IT', 'ORDER FORM', 'COLLECT FROM CUSTOMER', 'HOW ORDERS ARRIVE', 'LIFECYCLE', 'ATTACHMENTS'].forEach((word) => assert(html.includes(word), 'missing section ' + word));
  assert(html.includes('<chit-preview shop-1>'), 'the chit preview closes the panel');
  assert(html.includes('hint-quote') && html.includes('selected'), 'the chosen method is selected and its hint shown');
  assert(html.includes('Currently <b>Public</b>'), 'the visibility is reported, never set here');
});

check('an empty order form says in words what is missing, not a blank hole (could not read: nothing to show)', () => {
  const html = sandbox._storefrontConfig(empty);
  assert(html.includes('Nothing asked back.'));
  assert(html.includes('No states'));
  assert(html.includes('No attachments.'));
  assert(html.includes('Currently <b>— Private</b>'), 'a node with no exposure reads Private');
});

check('what a person typed goes through esc and every handler names its own node key', () => {
  const html = sandbox._storefrontConfig(full);
  assert(html.includes('a&lt;b') && !html.includes('a<b'), 'the inlet handle is escaped');
  assert(html.includes("netSetInlet('shop-1',0,'channel'"), 'the inlet handler carries the node key and its row');
  assert(html.includes("netSetState('shop-1',2,"), 'the state handler carries the node key and its row');
  assert(!/<div style="font-size:var\(--fs-1\);color:var\(--grey\);padding:2px 0">No states/.test(html), 'a node with states does not say "No states"');
});

check('the headings go through the string layer tx(), so a translated shop sees them translated', () => {
  spoken.length = 0;
  sandbox._storefrontConfig(full);
  assert(spoken.some((text) => /ORDER FORM/.test(text)) && spoken.some((text) => /LIFECYCLE/.test(text)));
});

check('the panel draws only theme tokens for its own colours (dark theme at 1366 and 390 follows, AA contrast is the tokens\' job)', () => {
  const html = sandbox._storefrontConfig(full);
  const raw = html.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepStrictEqual(raw, ['#cfe0d6'], 'only the one existing border colour is literal: ' + raw.join(' '));
});

console.log('\nreadab-1129-storefront: all checks passed');
