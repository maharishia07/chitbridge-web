'use strict';
/* I-F-09 (21 Nov, UAE walk I): ONE CLOCK ON THE TILL. "Left open at 2:37 PM" (the device's zone) beside "read at 13:03" (the shop's, 24-hour) were two clocks
 * on one screen. Now the park line, the hub head and the stock line all read the SHOP's zone (shopTz: the pack's one zone) in the 12-hour clock.
 * No browser: the helpers are lifted from public/till.html by name. Run: node tests/till-one-clock.test.cjs */
process.env.TZ = 'Pacific/Honolulu'; /* the device is 11 hours behind Dubai on purpose */
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'till.html'), 'utf8');
function liftFn(name) {
  const at = html.indexOf('\nfunction ' + name + '(');
  assert(at >= 0, 'the page has function ' + name);
  const rest = html.slice(at + 1), one = rest.split('\n')[0];
  if (/\}\s*$/.test(one) && !/\{\s*$/.test(one)) return one;
  return rest.slice(0, rest.indexOf('\n}\n') + 2);
}
const cx = vm.createContext({ console, Intl, Date, shopPack: () => ({ timeZones: ['Asia/Dubai'] }), docCountry: () => 'AE', cbQuiet() {}, esc: (s) => s, S: { at: 0 } });
vm.runInContext(['shopOwnTz', 'shopTz', 'tzOpt', 'shopFmt', 'dayInZone', 'shopDayOf', 'clock12', 'draftWhen'].map(liftFn).join('\n'), cx);
const now = Date.now();
const dubai = new Date(now).toLocaleTimeString('en-US', { timeZone: 'Asia/Dubai', hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
const device = new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
assert.notStrictEqual(dubai, device, 'the test device differs from the shop');
assert.strictEqual(cx.clock12(now), dubai, 'clock12 is the shop zone');
assert.strictEqual(cx.draftWhen(now), 'at ' + dubai, 'a bill left open now: the shop clock, 12-hour: ' + cx.draftWhen(now));
const yesterday = cx.draftWhen(now - 86400000);
assert.ok(/^yesterday at /.test(yesterday) && yesterday.endsWith(new Date(now - 86400000).toLocaleTimeString('en-US', { timeZone: 'Asia/Dubai', hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()), yesterday);
assert.ok(!/hhmm\(S\.at\)/.test(html), 'the stock line no longer reads the 24-hour hhmm beside the 12-hour clocks');
assert.ok(/var when = S\.at \? clock12\(S\.at\)/.test(html), 'the stock line reads clock12');
console.log('till-one-clock: all ok');
