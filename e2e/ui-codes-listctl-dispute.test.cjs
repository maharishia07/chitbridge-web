'use strict';
// @type: unit
/**
 * ui-codes-listctl-dispute.test.cjs - every control drawn by list-ctl.js and cap-dispute.js wears a data-cbsid code (UX-137, queue 359).
 *
 * OWNS      the proof that no button, input, select, textarea or role=button/tab/menuitem tag in public/app/list-ctl.js or public/app/cap-dispute.js
 *           is written without a data-cbsid (a literal code, or the held name `sid` of the pager pair), and that CBList.pager draws the same
 *           markup as before: Previous CMP037-B06, Next CMP037-B07.
 * CALLED BY by hand and the QA gate: node e2e/ui-codes-listctl-dispute.test.cjs   (LCD_MUTATE=remove must fail it)
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/list-control
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const FILES = ['list-ctl.js', 'cap-dispute.js'];
const mutate = process.env.LCD_MUTATE || '';
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok ' : '  FAIL ') + msg); if (!ok) failures++; };
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8').split('\r\n').join('\n');
const TAG = /<(button|input|select|textarea|[a-z]+)\b([^>]*)>/g;

function untagged(src) {
  const lines = src.split('\n').map((L) => { const t = L.trim(); return t.slice(0, 2) === '//' || t.slice(0, 2) === '/*' || t.charAt(0) === '*' ? '' : L; });
  const text = lines.join('\n'), out = [];
  let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(text))) {
    const tag = m[1], a = m[2] || '';
    const control = tag === 'button' || tag === 'select' || tag === 'textarea' || (tag === 'input' && !/type=["']hidden["']/.test(a)) || /role=["'](button|tab|menuitem|menuitemradio|switch|option)["']/.test(a);
    if (control && !/data-cbsid=/.test(a)) out.push(text.slice(0, m.index).split('\n').length);
  }
  return out;
}

FILES.forEach((f) => {
  let src = read(f);
  if (mutate === 'remove' && f === 'list-ctl.js') src = src.split('data-cbsid="CMP037-B01"').join('').split("data-cbsid=\"' + sid + '\"").join('');
  const bad = untagged(src);
  check(bad.length === 0, f + ': 0 controls without data-cbsid' + (bad.length ? ' (lines ' + bad.join(',') + ')' : ''));
});

/* the pager pair draws the same markup as before the code moved into a name */
const win = { document: undefined };
vm.runInNewContext(read('list-ctl.js'), { window: win, self: win, globalThis: win, console });
const L = win.CBList;
check(!!(L && L.pager), 'CBList.pager is exported');
if (L && L.pager) {
  const h = L.pager({ prev: { label: 'Previous', tid: 'pg-prev', act: 'go(-1)', off: true }, next: { label: 'Next', tid: 'pg-next', act: 'go(1)', off: false } });
  check(h.indexOf('data-cbsid="CMP037-B06"') >= 0 && h.indexOf('data-testid="pg-prev"') > h.indexOf('CMP037-B06'), 'Previous wears CMP037-B06');
  check(h.indexOf('data-cbsid="CMP037-B07"') >= 0 && h.indexOf('data-testid="pg-next"') > h.indexOf('CMP037-B07'), 'Next wears CMP037-B07');
  check(h.indexOf('disabled') < h.indexOf('CMP037-B07') && h.split('disabled').length === 2, 'only Previous is disabled');
}
console.log(failures ? failures + ' FAILED' : 'all passed');
process.exit(failures ? 1 : 0);
