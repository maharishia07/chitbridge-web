#!/usr/bin/env node
/* pathreds-sheet.cjs — RW3-13 (auditor path O18b, sit-au wave 6): the Add a person sheet's Add button sits INSIDE the sheet and the window at 1366x768 and 390x844.
 * Why it was red on the live box although rw3ux's sheet grammar was in the served CSS: that rule gave every child of dialog.sheet that is not h2/.mx flex:1 + overflow:auto,
 * so the empty status line (div#emp_out) took half the sheet's height and the form scrolled inside what was left. Stand-in markup = what cap-employees.js openAdd() draws
 * (button.mx, h2, div.emp-out, form.emp-form with six fields and the submit), with the REAL accounts-page.css and cap-employees.css; the Give access sheet (h2 + one block + .nw-acts) stays covered.
 * Run (a headless browser): NODE_PATH=e2e/node_modules node e2e/pathreds-sheet.cjs */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('@playwright/test');
const css = ['accounts-page.css', 'cap-employees.css'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8')).join('\n');
let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) bad++; };
const field = (id, label) => '<label for="' + id + '">' + label + '</label><input class="inp" id="' + id + '">';
const addForm = '<button type="button" class="mx" id="emp_x" aria-label="Close">✕</button><h2>Add a person</h2><div id="emp_out" class="emp-out" role="status"></div><form class="emp-form" novalidate>' +
  field('n', 'Name') + field('k', 'Sign-in name') + '<div class="sub">4 to 12 letters or numbers</div><div class="sub" id="emp_kn"></div>' + '<label for="l">What they can do</label><select class="inp" id="l"><option>Counter staff</option></select><div class="sub" id="emp_lw">Does the work at their own node. Messages anyone.</div>' +
  field('r', 'Job title (a name only, grants nothing)') + field('p', 'Phone') + field('e', 'E-mail') + '<button type="submit" class="act" id="add" data-sheet-save>Add</button></form>';
const giveBody = '<button type="button" class="mx" id="gx" aria-label="Close">✕</button><h2>Give access</h2><div id="gb"><p>' + 'A paragraph of words about who reads the books. '.repeat(14) + '</p><div class="nw-acts"><button class="act" id="give">Give access</button><button class="act quiet" id="cancel">Cancel</button></div></div>';
(async () => {
  const browser = await chromium.launch({ channel: process.env.CBL_CHANNEL || undefined });
  for (const [w, h] of [[1366, 768], [390, 844]]) {
    for (const [name, html, btn] of [['Add a person', addForm, '#add'], ['Give access', giveBody, '#give']]) {
      const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
      await page.setContent('<!doctype html><meta name="viewport" content="width=device-width"><style>:root{--surface:#fffdf8;--ink:#241f14;--line-2:#e6dcc4;--muted:#6b6250}body{margin:0;font:14px system-ui}.inp{height:36px;box-sizing:border-box}.act{min-height:40px}' + css + '</style><dialog class="sheet" id="s">' + html + '</dialog>');
      await page.evaluate(() => document.getElementById('s').showModal());
      const r = await page.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(), d = document.getElementById('s').getBoundingClientRect(); return { bottom: b.bottom, top: b.top, right: b.right, dtop: d.top, dbottom: d.bottom, vh: innerHeight, vw: innerWidth }; }, btn);
      ok(r.top >= r.dtop - 1 && r.bottom <= r.dbottom + 1 && r.bottom <= r.vh + 1 && r.right <= r.vw + 1, name + ' at ' + w + 'x' + h + ': the button is in the sheet and the window (bottom ' + Math.round(r.bottom) + ' of sheet ' + Math.round(r.dbottom) + ', window ' + r.vh + ')');
      await page.context().close();
    }
  }
  await browser.close();
  console.log('\n  ' + (bad ? bad + ' failed' : 'all ok')); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
