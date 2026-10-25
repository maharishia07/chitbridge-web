/**
 * tests/network-panel-ui.test.cjs - THE NETWORK CONTROL PANEL PAGE, SLICE 1 (25 Oct 2026). Runs the real public/app/network-panel-app.js in a stub window: no browser, no server.
 *   the big answer ("4 installations · 3 members · 1 master") · ONE call to the one endpoint · statuses in the server's words · "not recorded" / "not seen since" painted, never invented ·
 *   suspend / reinstate / revoke disabled with the command as the reason · a refusal shown in the server's words, and the screen can still be walked: Try again repaints.
 *   The colours are theme tokens (var(--...)), so the light and dark themes and the AA contrast of the shell apply; the page text goes through tx() (the string layer).
 * Run: node tests/network-panel-ui.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const ANSWER = {
  counts: { total: 4, by_role: { master: 1, member: 3 }, by_status: { master: 1, active: 1, paused: 1, lapsed: 1 } },
  installations: [
    { key: 'sit-root', domain: 'root.example.com', country: null, role: 'master', status: 'master', status_label: 'Master', certificate: null, listed: null, listed_label: 'not recorded', entities_held: 0, entities_claimed: null, last_pull: null, version: '1.9.0', last_seen: new Date().toISOString(), seen_error: null, actions: {} },
    { key: 'sit-au', domain: 'au.example.com', country: 'AU', role: 'member', status: 'paused', status_label: 'Paused', certificate: { status: 'suspended', expires: '2026-11-20T00:00:00Z' }, listed: null, listed_label: 'not recorded', entities_held: 3, entities_claimed: 4, last_pull: { at: null, error: null }, version: '1.9.0+abc1234', last_seen: '2026-10-20T10:00:00Z', seen_error: 'AbortError', actions: { suspend: { may: false, why: 'node tools/network-cert.cjs suspend sit-au' }, reinstate: { may: false, why: 'node tools/network-cert.cjs reinstate sit-au' }, revoke: { may: false, why: 'node tools/network-cert.cjs revoke sit-au' } } }
  ]
};

const element = () => ({ innerHTML: '', onclick: null });
function run(fetchAnswer) {
  const calls = [];
  const nodes = {};
  let mounted = null;
  const win = {
    fetch: (url, options) => { calls.push({ url, options }); return Promise.resolve(fetchAnswer); },
    document: { getElementById: (id) => (nodes[id] = nodes[id] || element()) },
    CBList: { reset() {}, mount: (host, config) => { mounted = config; return { destroy() {} }; } },
    tx: (text) => text
  };
  win.window = win;
  vm.runInNewContext(read('public/app/network-panel-app.js'), win);
  const host = element();
  const app = win.CBNetworkPanel.mount(host, { token: 'tok', base: 'https://api.example.com' });
  return { win, host, nodes, calls, app, list: () => mounted };
}
const reply = (status, body) => ({ status, ok: status < 400, json: () => Promise.resolve(body) });
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

let pass = 0, fail = 0;
const t = (name, ok, extra) => { if (ok) { pass++; console.log('   ok   ' + name); } else { fail++; console.log('   FAIL ' + name + (extra ? '\n          ' + extra : '')); } };

(async () => {
  console.log('\n== NETWORK CONTROL PANEL page ==\n');
  const page = run(reply(200, ANSWER));
  await settle();
  t('ONE call, to the one endpoint, with the token', page.calls.length === 1 && page.calls[0].url === 'https://api.example.com/api/network/installations' && page.calls[0].options.headers.Authorization === 'Bearer tok');
  t('the big plain answer is "4 installations · 3 members · 1 master"', /<h1[^>]*>4 installations · 3 members · 1 master<\/h1>/.test(page.host.innerHTML), page.host.innerHTML.slice(0, 300));
  t('the statuses under it are the server\'s words, with counts', /1 Active · 1 Paused · 1 Lapsed/.test(page.host.innerHTML));
  const config = page.list();
  t('the list is a CBList (frozen header, adjustable columns) with both installations', config && config.rows().length === 2 && config.key === 'network-panel-installations');
  const au = ANSWER.installations[1];
  const cell = (key, row) => config.columns.find((column) => column.key === key).cell(row);
  t('"not recorded" is painted for listed null, never guessed', cell('listed', au) === 'not recorded');
  t('a member not seen lately says "not seen since", not a fresh time', /^not seen since /.test(cell('last_seen', au)));
  t('held and claimed businesses sit side by side', cell('entities_held', au) === '3 of 4 claimed');
  const buttons = cell('actions', au);
  t('suspend, reinstate and revoke are disabled and carry the command as the reason', (buttons.match(/ disabled /g) || []).length === 3 && buttons.includes('title="node tools/network-cert.cjs suspend sit-au"'));
  t('the master has no actions and no businesses count', cell('actions', ANSWER.installations[0]) === '' && cell('entities_held', ANSWER.installations[0]) === '—');
  page.app.go('certificates');
  const certs = page.list();
  t('Certificates reuses the same data (no second call) and leaves out the master', certs.key === 'network-panel-certificates' && certs.rows().length === 1 && page.calls.length === 1);

  const refused = run(reply(403, { detail: 'This installation is controlled by root.example.com.', code: 'NETWORK_MASTER_ONLY' }));
  await settle();
  t('a member root is shown the refusal in the server\'s words, with Try again', /controlled by root\.example\.com/.test(refused.host.innerHTML) && /np_retry/.test(refused.host.innerHTML) && refused.list() === null);
  const garbled = run({ status: 200, ok: true, json: () => Promise.reject(new Error('bad json')) });
  await settle();
  t('an answer that could not be read says so in words, and does not crash', /could not read it/.test(garbled.host.innerHTML));

  const html = read('public/network-panel.html') + read('public/app/network-panel-app.js');
  t('theme: every colour on the page is a token (light and dark follow the shell), no raw hex outside the fallbacks', !/(^|[^,(])#[0-9a-fA-F]{3,6}\b(?![^()]*\))/m.test(read('public/app/network-panel-app.js')));
  t('the page and the app say it in the string layer (tx) and the page names its own light/dark tokens', /root\.tx/.test(html) && /var\(--ink/.test(html));

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('   CRASH ' + ((e && e.stack) || e)); process.exit(1); });
