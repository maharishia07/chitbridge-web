'use strict';
/* LENS2 (1129) web P1s, no browser: (1) intake sign-in: a bad e-mail is said in words, a 429/500 says the problem body's sentence and never opens the code box, a 2xx opens it;
   (2) cap-tasks: a delivered-quantity field has one id PER LINE (two open panels never share tk_dq); (3) cap-shop: a non-owner's Business inputs are disabled with the sentence.
   (2) and (3) are source checks of the built markup: their functions live inside page closures. Each fails on the parent. */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..', 'public');
let pass = 0;
const ok = (name) => { pass++; console.log('  ok   ' + name); };

(async () => {
  const html = fs.readFileSync(path.join(root, 'intake.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const code = scripts.find((s) => /function doLogin/.test(s));
  assert.ok(code, 'intake.html holds doLogin');
  const run = async (email, replies) => {
    const els = {};
    ['app', 'lg_email', 'lg_otp', 'lg_btn', 'lg_err', 'otpwrap', 'netpill'].forEach((id) => { els[id] = { value: '', textContent: '', innerHTML: '', style: { display: id === 'otpwrap' ? 'none' : '' }, querySelector: () => null }; });
    els.lg_email.value = email;
    const calls = [];
    const sb = {
      console, window: {}, location: { search: '' }, URLSearchParams, esc: (s) => String(s),
      document: { getElementById: (id) => els[id] || null },
      fetch: async (url) => { calls.push(url); const r = replies.shift(); return { status: r.status, json: async () => r.body }; }
    };
    sb.window = sb; vm.createContext(sb);  vm.runInContext(require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'app', 'cb-words.js'), 'utf8'), sb); /* the page loads cb-words.js first (failWords · bodyWords · cbApiParam) */ vm.runInContext(code, sb);
    await sb.doLogin();
    return { els, calls, stage: vm.runInContext('_stage', sb) };
  };
  let r = await run('not-an-email', []);
  assert.ok(/e-mail/.test(r.els.lg_err.textContent) && r.calls.length === 0 && r.stage === 'email', 'a bad e-mail says so and sends nothing');
  ok('a bad e-mail is said in words');
  r = await run('a@b.com', [{ status: 429, body: { title: 'Too many requests', detail: 'Wait a minute before asking for another code.' } }]);
  assert.strictEqual(r.els.lg_err.textContent, 'Wait a minute before asking for another code.');
  assert.strictEqual(r.els.otpwrap.style.display, 'none', 'no OTP box on a 429'); assert.strictEqual(r.stage, 'email');
  r = await run('a@b.com', [{ status: 500, body: null }]);
  assert.ok(r.els.lg_err.textContent.length > 10 && r.els.otpwrap.style.display === 'none' && r.stage === 'email', 'a 500 with no body still says something and opens no OTP box');
  ok('429 / 500 show the sentence and no OTP box');
  r = await run('a@b.com', [{ status: 200, body: {} }]);
  assert.strictEqual(r.els.otpwrap.style.display, ''); assert.strictEqual(r.stage, 'otp');
  ok('a 2xx opens the code box');

  const tasks = fs.readFileSync(path.join(root, 'app', 'cap-tasks.js'), 'utf8');
  assert.ok(!/id="tk_dq"/.test(tasks) && !/\$\('tk_dq'\)/.test(tasks), 'no literal tk_dq id');
  assert.ok(/'tk_dq_' \+ line\.line_id/.test(tasks), 'the id carries the line');
  ok('delivered-quantity field id is per line');

  const shop = fs.readFileSync(path.join(root, 'app', 'cap-shop.js'), 'utf8');
  const g = shop.match(/function greyForActor\(node\) \{([\s\S]*?)\n  \}/);
  assert.ok(g && /isActorSeat()/.test(g[1]) && /\.disabled = true/.test(g[1]) && /Only the owner can change these/.test(g[1]), 'greyForActor disables with the sentence');
  assert.ok(/greyForActor\(node\);/.test(shop) && /greyForActor\(document\.getElementById\('vaulthost'\)\)/.test(shop), 'the Business card and the identity box are both greyed');
  ok('a non-owner sees the Business fields greyed with the sentence');
  console.log('lens2-1129-web: ' + pass + ' passed, 0 failed');
})().catch((e) => { console.error('  FAIL ' + (e && e.stack || e)); process.exit(1); });
