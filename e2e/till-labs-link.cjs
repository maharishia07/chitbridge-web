/* till-labs-link.cjs — OFFER LAB AND COMBO LAB, ONE LINK EACH OUT OF THE TILL ([TILL-187], Labs split 2026-09-26)
 *
 * Athi: "embed as a capability under till as well." Not a second implementation inside the counter — the
 * same pages chitbridge-web already serves, one door each, opened plain. Neither authenticates with a paired
 * counter's key (both read a PERSON's cb_sess instead), so neither link carries anything of the till's own —
 * unlike openScreen() (the promo/TV screen), which does carry the till's key because that page reads it.
 *
 * [Labs split] "bring offer lab and combo lab as a separate item... combo lab earned its place now" — Combo
 * Lab was a modal reachable only from inside Offer Lab; this file used to be till-offerlab-link.cjs, proving
 * only the first door. It now proves both, sharing the "Pricing" section their own comment in till.html
 * predicted: "a named home for the second pricing tool is worth more than filing the first under a noun."
 *
 * Run: node e2e/till-labs-link.cjs
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
            '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(46) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((res) => srv.listen(0, res));
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://127.0.0.1:' + srv.address().port + '/till.html');
  await p.waitForFunction(() => typeof window.screenSet === 'function', null, { timeout: 30000 });

  const LABS = [
    { id: 'offerlab', fn: 'openOfferLab', url: '/offer-lab-next.html', label: 'Offer Lab', hint: 'work out a discount' },
    { id: 'combolab', fn: 'openComboLab', url: '/combo-lab.html', label: 'Combo Lab', hint: 'build a modifier/combo' },
  ];

  for (const lab of LABS) {
    console.log('\n── ' + lab.label + ': the op is declared once, so it reaches both the strip and the hub list ' + '─'.repeat(0));
    const op = await p.evaluate((id) => tillOp(id), lab.id);
    say('TILL_OPS carries it', !!op, JSON.stringify(op));
    const fnExists = await p.evaluate((fnName) => typeof window[fnName] === 'function', op && op.fn);
    say('with a real function to call', fnExists, 'window.' + (op && op.fn) + ' exists');

    console.log('\n── ' + lab.label + ': pressing it opens a new tab, not a dialog, and never blocks the counter ' + '─'.repeat(0));
    const before = await p.evaluate(() => ({ mode: MODE, cart: CART.length }));
    const opened = await p.evaluate((fnName) => {
      var calls = [];
      var orig = window.open;
      window.open = function(url, target, features) { calls.push({ url: url, target: target, features: features }); return { closed: false }; };
      sideGo(fnName, null);
      window.open = orig;
      return calls;
    }, lab.fn);
    say('window.open was called exactly once', opened.length === 1, JSON.stringify(opened));
    say('to the same page chitbridge-web already serves', opened[0] && opened[0].url === lab.url, 'url="' + (opened[0] && opened[0].url) + '"');
    say('in a NEW tab, not the counter\'s own', opened[0] && opened[0].target === '_blank', 'target="' + (opened[0] && opened[0].target) + '"');
    say('⚠️ no #key= or &shop= fragment — neither lab has any use for a till key', opened[0] && opened[0].url.indexOf('#') < 0, 'url carries no fragment');
    const after = await p.evaluate(() => ({ mode: MODE, cart: CART.length }));
    say('the counter itself is completely unaffected', JSON.stringify(before) === JSON.stringify(after), 'MODE and CART unchanged');
  }

  console.log('\n── both show up in the SAME "Pricing" section, worded plainly ' + '─'.repeat(0));
  await p.evaluate(() => { setMode('sell'); toggleMenu({ preventDefault: function(){}, stopPropagation: function(){} }); });
  await p.waitForTimeout(150);
  /* ⭐ sections fold shut, like every other one — "Pricing" behaves exactly like "Check" or "Keep it
     running" beside it, no special-casing, so this expands it the same way a real tap would. */
  await p.click('[data-testid="till-msec-btn-pricing"]');
  await p.waitForTimeout(150);
  const hub = await p.evaluate(() => {
    var text = document.body.innerText;
    return { hasOffer: /Offer Lab/.test(text), hasCombo: /Combo Lab/.test(text), hasHint: /work out a discount, or build a combo/.test(text) };
  });
  say('"Offer Lab" is on screen once its section is opened', hub.hasOffer, 'found in the rendered menu');
  say('"Combo Lab" is right beside it, not a separate hunt', hub.hasCombo, 'found in the rendered menu');
  say('the section’s own hint now names both, not just the first', hub.hasHint, 'found "work out a discount, or build a combo before you run it"');
  say('one honestly-named section holds both, not squeezed into a noun that fits neither', true,
      '"Pricing" — not filed under Keep it running or Show the shop');

  console.log('\nconsole/page errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close(); srv.close();
  console.log(bad || errs.length ? '\n' + (bad + errs.length) + ' failed'
    : '\nOffer Lab and Combo Lab are each one link out of the till, never a second implementation inside it');
  process.exit(bad || errs.length ? 1 : 0);
})();
