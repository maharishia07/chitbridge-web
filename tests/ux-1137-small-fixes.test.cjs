/* UX-210/211/212 + ACC-412 (AE screen walk 27 Nov 2026): the shared controls carry the fixes. Source-level checks: the rules are in the shared files, not one page. */
const fs = require('fs'), assert = require('assert');
const read = (p) => fs.readFileSync(__dirname + '/../public/' + p, 'utf8');
const mark = read('app/cap-mark.js'), css = read('app/list-ctl-css.js'), needs = read('app/cap-books-needs.js'), books = read('app/cap-books.js'), acc = read('accounts.html');
const ok = (n) => console.log('  ok ' + n);
assert(/\.mk-many \.mk-ghost \.mk-w\{display:none\}/.test(mark) && /var MANY = 3/.test(mark)); ok('UX-210: past 3 unchecked rows the Check word is a symbol');
assert(/data-mk-all="1"/.test(mark) && /CBConfirm\(fill\(markKit\.MARK_WORDS\.checkAllAsk/.test(mark)); ok('UX-210: one bulk Check all shown, after a confirm');
assert(/cbDuesTwin/.test(acc) && /id === 'dues' && duesNavHid/.test(acc) && /window\.cbDuesNav\(\)/.test(books)); ok('UX-211: Dues folds into the one side that holds the same list');
assert(/\.cbl \.cbl-row\.cbl-total:last-child\{position:static\}/.test(css)); ok('UX-212: the Total card is in the flow in card mode');
assert(/kind === 'overdue' && Number\(needTotals\.no_terms\) >= Number\(needTotals\.bills\)/.test(needs) && /reason === 'overdue' && row\.no_terms/.test(books)); ok('ACC-412: no terms = never overdue');
// the chip function itself
const vm = require('vm'), ctx = { esc: (x) => x, tx: (x) => x, bkMountAttribute: () => '', escJs: (x) => x, console };
vm.createContext(ctx); vm.runInContext(needs, ctx);
const chips = (n) => ctx.bkNeedChips({ party_id: 'p', needs: n });
assert(!/overdue/.test(chips({ bills: 2, no_terms: 2, overdue: 2 }))); assert(/overdue/.test(chips({ bills: 2, no_terms: 1, overdue: 1 }))); ok('ACC-412: party chips');
console.log('ux-1137-small-fixes: all ok');
