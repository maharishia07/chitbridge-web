'use strict';
// @type: unit
/**
 * rw1fin-1130.test.cjs - RE-WALK 1 (25 Nov, sit-au), finance rows run on the page's own functions with hand figures.
 * OWNS      RW1-04/23/24 the To do's bank-difference row says "A$354.32 unexplained" (one sign, one wording with the Bank page);
 *           RW1-13 an account label that adds no word to the account name is not printed twice ("Business bank account Business account"); the Auditor view keeps the Bank entry; opening Kept files no longer hides the grid.
 * CALLED BY ci.yml (the unit checks): node e2e/rw1fin-1130.test.cjs
 * CARD      16-finance/bank-reconciliation
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', ...f.split('/')), 'utf8');
const grab = (src, name) => { const at = src.indexOf('function ' + name + '('); let d = 0, i = src.indexOf('{', at); for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; } return src.slice(at, i + 1); };
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  XX  ') + m); if (!c) fails++; };
const money = (m, c) => (c === 'AUD' ? 'A$' : '$') + (m / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 });
// RW1-04/23/24: hand: -35,432 minor is carried as 35,432 unexplained = A$354.32
const sb = { bkMoney: money, tx: (s) => s, txf: (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]) };
vm.createContext(sb); vm.runInContext(grab(read('app/accounts-start.js'), 'wordBankUnexplained') + ';this.w = wordBankUnexplained;', sb);
const list = [{ kind: 'bank_unexplained', count: 1, words: 'server', items: [{ currency: 'AUD', unexplained_minor: 35432 }] }, { kind: 'evidence_gaps', words: 'keep' }];
sb.w(list);
ok(/^A\$354\.32 unexplained/.test(list[0].words) && !/-/.test(list[0].words.split(' · ')[0]), 'To do row: ' + list[0].words);
ok(list[1].words === 'keep', 'other rows untouched');
const two = [{ kind: 'bank_unexplained', items: [{ currency: 'AUD', unexplained_minor: 100 }, { currency: 'USD', unexplained_minor: 200 }] }]; sb.w(two);
ok(/A\$1\.00 AUD · \$2\.00 USD unexplained/.test(two[0].words), 'two currencies each name theirs: ' + two[0].words);
// RW1-13: label only when it adds a word
const st = read('app/cap-bank-statements.js'), sb2 = { tx: (s) => s }; vm.createContext(sb2);
vm.runInContext(['const bkstWords = ' + st.match(/const bkstWords = (.*);\n/)[1] + ';', 'const bkstLabelAdds = ' + st.match(/const bkstLabelAdds = (.*);\n/)[1] + ';', 'const bkstAccountName = ' + st.match(/const bkstAccountName = (.*);\n/)[1] + ';this.n = bkstAccountName;'].join('\n'), sb2);
ok(sb2.n({ name: 'Business bank account', label: 'Business account' }) === 'Business bank account', 'label with no new word is dropped');
ok(sb2.n({ name: 'Business bank account', label: '..1234' }) === 'Business bank account ..1234', 'a label with a new word stays');
ok(sb2.n({ name: 'Card and EFTPOS settlements' }) === 'Card and EFTPOS settlements', 'no label');
// RW1-12/13 edition + css
const man = JSON.parse(read('app/manifest.json'));
ok(man.editions.auditor.entries.indexOf('bank') >= 0, 'Auditor view keeps the Bank card, so its Do first can name the difference');
const css = read('app/accounts-page.css');
ok(!/details\.bkh-files\[open\]\) :is\([^)]*bks-wrap\.bkh-gridwrap/.test(css), 'opening Kept files does not hide the month grid');
console.log(fails ? fails + ' FAILED' : 'rw1fin-1130: ok'); process.exit(fails ? 1 : 0);
