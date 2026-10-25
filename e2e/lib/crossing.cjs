'use strict';
/**
 * e2e/lib/crossing.cjs — the browser side of the CTP crossing pack (api tests/crossing/): signed-in browser contexts on SIT installations.
 * OWNS      reading the api pack's topology + tester-code + sign-in modules (never copying them) · one browser CONTEXT per shop, on that shop's installation origin · the on/off switch
 * CALLED BY e2e/tests/crossing.spec.js
 * FLOW      enabled() -> signedIn(shopKey) (the api's own sign-in door, tester code read over ssh into memory) -> openAs(browser, shopKey) (a clean context with cb_sess + cb_api_base set) -> page on /app.html
 * ⭐ ONE CONFIG: the topology file lives in the API repo (tests/crossing/topology.json) beside the headless runner and is read from CB_API_DIR (default ../chitbridge-api, like lib/real-api.cjs). Nothing here names a host.
 * ⚠️ The tester code is in no file: lib/secret.cjs of the api pack reads it over ssh at run time. The HARD GUARD (hosts must start with "staging." and be in the topology) is the api pack's and runs before any sign-in.
 * Off by default: a normal `npx playwright test` never reaches SIT. Set CB_CROSSING=1 and run the `crossing` project: `npx playwright test --project=crossing`.
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const API_DIR = process.env.CB_API_DIR || path.join(ROOT, '..', 'chitbridge-api');
const PACK = path.join(API_DIR, 'tests', 'crossing');

const packFile = (rel) => path.join(PACK, rel);
const available = () => fs.existsSync(packFile('topology.json'));

/** why the crossing specs cannot run here, or null */
function skipReason() {
  if (process.env.CB_CROSSING !== '1') return 'set CB_CROSSING=1 to run the crossing specs against the SIT installations (they sign in as the qa-* test shops)';
  if (!available()) return 'the api pack was not found at ' + PACK + ' (set CB_API_DIR to a checkout that has tests/crossing/)';
  return null;
}

let loaded = null;
/** the api pack's modules, loaded once */
function pack() {
  if (!loaded) {
    loaded = {
      topology: require(packFile('lib/topology.cjs')),
      secret: require(packFile('lib/secret.cjs')),
      client: require(packFile('lib/client.cjs')),
      flow: require(packFile('lib/flow.cjs'))
    };
    loaded.topo = loaded.topology.load();
  }
  return loaded;
}

const secrets = new Map();
const sessions = new Map();

/** a shop signed in through the app's own door (API); cached for the run. → the api pack's client (token, call, get, post...) */
async function signedIn(shopKey) {
  if (sessions.has(shopKey)) return sessions.get(shopKey);
  const { topo, secret, client } = pack();
  const shop = Object.assign({ key: shopKey }, topo.shops[shopKey]);
  if (!topo.shops[shopKey]) throw new Error('no shop ' + shopKey + ' in the crossing topology');
  if (!secrets.has(shop.installation)) secrets.set(shop.installation, await secret.read(topo, shop.installation));
  const who = await client.signIn(topo, shop, secrets.get(shop.installation));
  sessions.set(shopKey, who);
  return who;
}

/**
 * A CLEAN browser context for one shop on its installation's origin, already signed in (the session the sign-in screen would have stored).
 * Separate contexts per installation origin = separate browsers per party, so two shops never share storage.
 * → { context, page, who } ; the caller closes the context.
 */
async function openAs(browser, shopKey, opts) {
  const o = opts || {};
  const who = await signedIn(shopKey);
  const context = await browser.newContext({ storageState: undefined, baseURL: who.base, viewport: o.viewport || { width: 1366, height: 768 } });
  await context.addInitScript(
    (s) => {
      try {
        localStorage.setItem('cb_api_base', s.base);
        localStorage.setItem('cb_sess', JSON.stringify({ token: s.token, role: 'entity', name: s.user_id, entity: s.user_id, bridgeId: s.bridge_id }));
        localStorage.removeItem('cb_vp');
      } catch (e) {
        console.warn('crossing: browser storage is blocked, so the page will show the sign-in screen', e && e.message); // the spec then fails in words at its first locator
      }
    },
    { base: who.base, token: who.token, user_id: who.user_id, bridge_id: who.bridge_id }
  );
  const page = await context.newPage();
  await page.goto('/app.html');
  return { context, page, who };
}

module.exports = { skipReason, pack, signedIn, openAs, API_DIR };
