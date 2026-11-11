'use strict';
/* OWNS: what every proof pack shares: the flags, the page list (pages.json), the local sign-in, the browser, the write guard, the axe source.
   CALLED BY: e2e/proof/a11y.cjs, keyboard.cjs, run.cjs · stack: .github/workflows/proof.yml (e2e/lib/stack-local.cjs up) or a local `node e2e/lib/stack-local.cjs up`.
   ⚠️ LOCAL STACK ONLY: sign-in uses the stack's DEV_OTP (lib/real-stack.cjs signIn); a base URL or api that is not localhost is refused. */
const fs = require('fs'), path = require('path');
const { guardDecision } = require('./guard.cjs');
const RS = require('../lib/real-stack.cjs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const BASE = String(arg('base', process.env.CB_PROOF_BASE || 'http://localhost:5173')).replace(/\/+$/, '');
const API = String(arg('api', process.env.CB_PROOF_API || 'http://localhost:3000')).replace(/\/+$/, '');
const SHOP = arg('shop', process.env.CB_PROOF_SHOP || 'simstores@test.example');
const HEIGHT = { 1366: 768, 390: 844 };
const WIDTHS = String(arg('widths', '1366,390')).split(',').map((s) => Number(s.trim())).filter((n) => n > 0);
const VPS = WIDTHS.map((w) => [w, HEIGHT[w] || 800]);
const PAGES = JSON.parse(fs.readFileSync(path.join(__dirname, 'pages.json'), 'utf8')).pages;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isLocal = (u) => ['localhost', '127.0.0.1', '::1'].includes(new URL(u).hostname);
if (!isLocal(BASE) || !isLocal(API)) { console.error('refused: the proof packs run against a LOCAL stack only (' + BASE + ' · ' + API + ')'); process.exit(2); }
const HOSTS = [new URL(BASE).host, new URL(API).host];

/** → { email, session } the cb_sess the pages store, from the local api's DEV_OTP door */
async function ownShop() { const s = await RS.signIn(API, SHOP); return { email: SHOP, session: s.session }; }
function playwright() { for (const m of ['playwright', '@playwright/test', 'playwright-core']) { try { return require(m); } catch (_) { /* next */ } } throw new Error('no playwright: run npm ci in e2e/ (or set NODE_PATH to e2e/node_modules)'); }
function axeSource() { return fs.readFileSync(path.join(__dirname, '..', 'vendor', 'axe-core', 'axe.min.js'), 'utf8'); }
/** the pack's browser rules: no fonts from the internet, every write to the app aborted (counted in counts.writes), off-host navigation aborted */
async function guardContext(ctx, counts) {
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(() => true, async (r) => {
    const q = r.request(), d = guardDecision(q.method(), q.url(), HOSTS, q.isNavigationRequest());
    if (d.act === 'abort') { if (d.why === 'write' && counts) counts.writes++; return r.abort('blockedbyclient'); }
    return r.fallback();
  });
}
module.exports = { arg, argv, BASE, API, HOSTS, VPS, WIDTHS, PAGES, sleep, ownShop, playwright, axeSource, guardContext };
