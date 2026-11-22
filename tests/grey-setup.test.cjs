'use strict';
/* GREY-VERT (Athi, 21 Nov): at sign-up a business setup the api marks ready:false is drawn grey (class "cbsh-box off", the Home tile's sentence
   "Being finished · not ready yet"), cannot be chosen, and is never the default; a ready one stays choosable. regVerticalChooser and the default
   pick from public/app/register-form.js run in a vm with stand-in globals. Run: node tests/grey-setup.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const SRC = fs.readFileSync(__dirname + '/../public/app/register-form.js', 'utf8');
const grab = (name) => {
  const at = SRC.search(new RegExp('^(async )?function ' + name + '[(]', 'm'));
  if (at < 0) throw new Error('no ' + name);
  let depth = 0, i = SRC.indexOf('{', at);
  for (; i < SRC.length; i++) { if (SRC[i] === '{') depth++; else if (SRC[i] === '}' && --depth === 0) break; }
  return SRC.slice(at, i + 1);
};
const list = [
  { key: 'base', label: 'Base', vertical: null, capabilities: ['core'], is_default: true, ready: true },
  { key: 'service-desk', label: 'Service Desk vertical', vertical: 'service-desk', capabilities: ['core'], is_default: false, ready: false }
];
const cx = { REG: { verticals: list, constitution: 'base' }, tx: (s) => s, txf: (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => (o || {})[k] || ''),
  esc: (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';') };
vm.createContext(cx);
vm.runInContext([grab('regSetupLabel'), grab('regVerticalChooser'), 'this.chooser = regVerticalChooser;'].join('\n'), cx);
const html = cx.chooser();
const tiles = html.split(/(?=<div (?:class="cbsh-box off"|data-cbsid="SCR053-C03"))/);
const tile = (key) => tiles.find((t) => t.indexOf('data-testid="reg-vertical-' + key + '"') >= 0) || '';
const desk = tile('service-desk').split('</span></div>')[0], base = tile('base');
ok(/class="cbsh-box off"/.test(desk) && /aria-disabled="true"/.test(desk), 'a ready:false setup is the grey tile (cbsh-box off, aria-disabled)');
ok(desk.includes('Being finished · not ready yet'), 'the grey setup carries the Home tile sentence');
ok(!/onclick=/.test(desk), 'the grey setup has no click: it cannot be chosen');
ok(/onclick="REG\.constitution='base'/.test(base) && !/cbsh-box off/.test(base), 'a ready setup stays choosable');
ok(/const dv =[\s\S]*x\.is_default && x\.ready !== false[\s\S]*x\.ready !== false/.test(SRC), 'the default pick never lands on a setup that is not ready');
console.log(n + ' passed');
