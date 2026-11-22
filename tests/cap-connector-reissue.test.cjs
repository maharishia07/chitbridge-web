/**
 * tests/cap-connector-reissue.test.cjs — public/app/cap-connector-reissue.js: the destructive step-up of a connector key (re-type the name + a one-time code), run as the page runs it (the file evaluated with stubbed host globals).
 * CARD 28-platform-and-operations/connector-cockpit
 * Run: node tests/cap-connector-reissue.test.cjs
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const FILE = path.join(__dirname, '..', 'public', 'app', 'cap-connector-reissue.js');
const source = fs.readFileSync(FILE, 'utf8');
let steps = 0;
const step = async (label, fn) => { await fn(); steps++; console.log('ok - ' + label); };

/** a fresh page: `typed` = { rg_name, rg_otp }, `answers` = what the api says per call key (an Error = the call failed) */
function page(typed, answers) {
  const message = { textContent: '', innerHTML: '' }, downloads = [], toasts = [], calls = [], sheets = [];
  const fields = { rg_msg: message };
  Object.keys(typed).forEach((id) => { fields[id] = { value: typed[id] }; });
  const context = {
    UI: { acReissue: { id: 'act-1', mode: 'package' } }, CFG: { API_BASE: 'https://api.test' }, esc: (value) => String(value), tx: (words) => words,
    txf: (words) => words, closeModal() {}, toast: (words) => toasts.push(words), paintAcDetail() {}, modal: (html) => sheets.push(html),
    document: { getElementById: (id) => fields[id] || null },
    _download: (name, body) => downloads.push({ name, body }), _buildInstaller: (spec) => JSON.stringify(spec),
    api: async (key, request) => { calls.push({ key, request }); const answer = answers[key]; if (answer instanceof Error) throw answer; return answer; }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: FILE });
  return { context, message, downloads, toasts, calls, sheets };
}

(async () => {
  await step('refused in words before anything is sent: no gateway name, then a code that is not 6 digits', async () => {
    const noName = page({ rg_name: '  ', rg_otp: '123456' }, {});
    await noName.context.acReissueSubmit();
    assert.strictEqual(noName.message.textContent, 'Type the gateway name.');
    const badCode = page({ rg_name: 'Shop gateway', rg_otp: '12ab' }, {});
    await badCode.context.acReissueSubmit();
    assert.strictEqual(badCode.message.textContent, 'Enter the 6-digit code.');
    assert.strictEqual(noName.calls.length + badCode.calls.length, 0, 'the api is never asked');
  });
  await step('package mode: the fresh key goes inside a downloaded installer, never shown raw', async () => {
    const view = page({ rg_name: 'Shop gateway', rg_otp: '123456' }, { connectorRegen: { provision_key: 'KEY-1' }, connectorConns: [{ bridge_id: 'b1', ref: 'r1', conn_config: { folder: 'f' } }] });
    await view.context.acReissueSubmit();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(view.calls[0])), { key: 'connectorRegen', request: { params: { actorId: 'act-1' }, body: { name: 'Shop gateway', otp: '123456' } } });
    assert.strictEqual(view.downloads.length, 1);
    assert.match(view.downloads[0].body, /KEY-1/);
    assert.strictEqual(view.context.UI.acFreshKey, null);
  });
  await step('could not read the devices: the old key is dead, so the new one is shown once for copying (fell back from the installer, said in words)', async () => {
    const view = page({ rg_name: 'Shop gateway', rg_otp: '123456' }, { connectorRegen: { provision_key: 'KEY-2' }, connectorConns: new Error('offline') });
    await view.context.acReissueSubmit();
    assert.strictEqual(view.context.UI.acFreshKey, 'KEY-2');
    assert.match(view.toasts[0], /installer could not be built/);
  });
  await step('an api refusal is shown in the dialog in words, and no key is claimed', async () => {
    const view = page({ rg_name: 'Shop gateway', rg_otp: '123456' }, { connectorRegen: Object.assign(new Error('Code expired'), {}) });
    await view.context.acReissueSubmit();
    assert.strictEqual(view.message.textContent, 'Code expired');
    const none = page({ rg_name: 'Shop gateway', rg_otp: '123456' }, { connectorRegen: {} });
    await none.context.acReissueSubmit();
    assert.strictEqual(none.message.textContent, 'No key issued.');
  });
  await step('walk: the dialog opened from the cockpit carries the name field, the code field, Send code, Cancel and Reissue', async () => {
    const view = page({}, {});
    view.context.acReissueGate('act-9', 'key');
    assert.strictEqual(view.context.UI.acReissue.mode, 'key');
    ['SCR002-I09', 'SCR002-I10', 'SCR002-B09', 'SCR002-B10', 'CMP003'].forEach((code) => assert.ok(view.sheets[0].includes(code), code));
  });
  await step('theme: the dialog uses theme tokens only, so dark and light at 1366 and 390 follow the theme (AA contrast by token, no fixed colour)', async () => {
    const body = source.split('\n').filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line)).join('\n');
    assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(body), 'no hex colour');
    assert.ok(/var\(--grey-2\)/.test(body) && /var\(--blue-2\)/.test(body), 'text colours are tokens');
  });
  console.log('cap-connector-reissue: ' + steps + ' steps passed');
})().catch((failure) => { console.error(failure); process.exit(1); });
