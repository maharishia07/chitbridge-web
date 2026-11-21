'use strict';
/* WALK I I-F-01 (21 Nov 2026): Designated Zones are not built. Where a zone choice would be (the Sell form's customer row) a pack that names Designated Zones shows ONE grey
   sentence (readiness state: not built) instead of silently taxing a zone buyer at the standard rate with no word. Zones are NOT built here. Run: node tests/walki-zone-grey.test.cjs */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };
const win = {}; const cx = vm.createContext(win); cx.window = cx; cx.self = cx;
for (const f of ['engine/money.js', 'engine/tax.js']) vm.runInContext(fs.readFileSync(__dirname + '/../public/' + f, 'utf8'), cx);
const C = cx.CBCountries;
ok(C.packFor('AE').designatedZones && C.packFor('AE').designatedZones.cite, 'the AE pack names Designated Zones with a citation (DL Art. 50)');
ok(!C.packFor('AU').designatedZones && !C.packFor('IN').designatedZones, 'AU and IN name none: no grey line there');
const app = fs.readFileSync(__dirname + '/../public/app.html', 'utf8');
ok(/function sbZoneGreyHTML\(\)/.test(app) && /sbZoneGreyHTML\(\) \+/.test(app), 'the Sell form draws the grey line from the pack, beside the customer fields');
ok(/Designated Zone buyer — not built yet/.test(app), 'the words say it is not built');
console.log(n + ' passed');
