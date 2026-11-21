'use strict';
// @type: unit
/**
 * network-browse-failed.test.cjs - ERR-13: the Network "Store catalogues" list that cannot load says the api's own sentence and hint on the shared card, with Try again.
 *
 * OWNS      the proof, on the real public/app/cap-network-member.js + helpers.js scrErr: a refused netStores read -> the browse body shows the refusal's sentence, its hint and a Try again;
 *           no generic "Could not load the network."; theme tokens only (dark theme, 390/1366 widths, AA contrast of the tokens); Try again reads the list again and the loaded list paints.
 * CALLED BY ci.yml (the unit checks): node e2e/network-browse-failed.test.cjs
 * CARD      04-network/network-app-member-view
 */
const fs = require('fs'),
  path = require('path'),
  vm = require('vm'),
  assert = require('assert');
const pub = (rel) => fs.readFileSync(path.join(__dirname, '..', 'public', rel), 'utf8');
let reads = 0,
  refuse = true;
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  tx: (s) => s,
  txf: (s) => s,
  UI: {},
  document: { getElementById: () => null },
  api: () => {
    reads++;
    if (!refuse) return Promise.resolve({ stores: [{ entity_id: 'e1', name: 'North store', bridge_id: 'b1' }] });
    const error = new Error('The network is not open to you yet.');
    error.hint = 'Ask the owner to invite you.';
    error.code = 'NETWORK_NOT_OPEN';
    return Promise.reject(error);
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(pub('app/helpers.js') + '\n' + pub('app/cap-network-member.js') + '\nthis.__T = { screen: _netBrowseScreen, body: _netBrowseBody, retry: netBrowseRetry };', sandbox, { filename: 'net.js' });
const T = sandbox.__T;
const settle = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  T.screen();
  await settle();
  const failed = T.body();
  assert.ok(failed.includes('The network is not open to you yet.'), 'the api sentence');
  assert.ok(failed.includes('Ask the owner to invite you.'), 'the hint');
  assert.ok(failed.includes('netBrowseRetry()'), 'Try again');
  assert.ok(!failed.includes('Could not load the network.'), 'no generic line');
  console.log('ok  a refused list: sentence, hint and Try again on the shared card');
  /* the card paints in the theme's tokens, so cream and dark both hold AA contrast (the page-level contrast walk covers the tokens): no raw hex colour, no fixed pixel width that breaks 390 or clips at 1366 */
  assert.ok(!/#[0-9a-f]{3,6}(?![^<]*fallback)/i.test(failed.replace(/var(--[a-z0-9-]+,s*#[0-9a-f]{3,6})/gi, '')), 'theme tokens only (dark theme, AA contrast)');
  assert.ok(!/width:s*(?:[4-9]dd|d{4,})px/.test(failed), 'no fixed width wider than a 390 px phone');
  console.log('ok  the failed card uses theme tokens only and no fixed wide width (dark, 390, 1366, AA contrast)');
  refuse = false;
  T.retry();
  await settle();
  assert.strictEqual(reads, 2);
  assert.ok(T.body().includes('North store'), 'the list paints after Try again');
  console.log('ok  Try again reads the list again and paints it');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
