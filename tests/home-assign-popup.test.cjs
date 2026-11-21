'use strict';
/* 1128 One Home fold (da838fd7) dropped /app/ui.js and /app/modal-host.js from index.html; assign-bar.js opens its people list with ui.dialog + modal(),
   so a firm's "Assign to…" / "Hand over" said "The list of people cannot open on this page." (walk-assign-bulk, CI run 44938386756).
   The Home must load both, in front of assign-bar.js. Run: node tests/home-assign-popup.test.cjs */
const fs = require('fs'), assert = require('assert');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const at = (name) => html.indexOf('<script src="/app/' + name + '"></script>');
const [ui, host, bar] = [at('ui.js'), at('modal-host.js'), at('assign-bar.js')];
assert.ok(ui > 0 && host > 0 && bar > 0, 'index.html loads ui.js, modal-host.js and assign-bar.js');
assert.ok(ui < bar && host < bar, 'ui.js and modal-host.js come before assign-bar.js (ui.dialog and modal() exist when the popover opens)');
console.log('home-assign-popup: all ok');
