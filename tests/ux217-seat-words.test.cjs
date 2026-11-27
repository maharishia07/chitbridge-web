'use strict';
/* UX-217 / UX-223 (Fable AU walk 2): (1) a staff seat's Your business card shows the SHOP the api sends beside its own row (/me shop), never the person's name;
   (2) a firm that holds an ADVISER grant opens the client's Bank on the adviser seat (an auditor address answered "You do not have access"); (3) a client whose books started this month
   has no month over yet: the Months list and the year line say so instead of "Nothing to show here" / "0 of 0 months locked".
   Run: node tests/ux217-seat-words.test.cjs */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok  ' + m); };

const shop = read('public/app/cap-shop.js');
const a = shop.indexOf('function shopCardHTML(');
const fn = 'function shopFactsOf(whoseRow, actorId) { var e = ' + /var actorId = isActorSeat\(\), e = ([^;]*);/.exec(shop.slice(a))[1] + '; return e; }';
const ctx = {}; vm.runInNewContext(fn.replace('function shopFactsOf', 'this.f = function'), ctx);
const casey = { display_name: 'Casey Nguyen', gstn: null, shop: { display_name: 'Yarra Bike Works', gstn: '51992702030', address: '1 Main St' } };
ok(ctx.f(casey, true).display_name === 'Yarra Bike Works' && ctx.f(casey, true).gstn === '51992702030', 'a seat reads the shop name and ABN, not its own name');
ok(ctx.f({ display_name: 'Casey Nguyen' }, true).display_name === undefined, 'a seat with no shop sent shows blank, never its own name as the business');
ok(ctx.f({ display_name: 'Yarra Bike Works', gstn: '5' }, false).display_name === 'Yarra Bike Works', 'the owner row is the shop');

const win = { URLSearchParams, encodeURIComponent, document: {}, location: { search: '' } }; win.window = win;
vm.runInNewContext(read('public/app/books-acting.js'), win);
const A = win.CBBooksActing;
ok(/&role=adviser#\/bank$/.test(A.auditAddressOf({ id: 's1' }, 'bank', '', 'adviser')), 'an adviser firm opens Bank on the adviser seat');
ok(/&role=auditor#\/bank$/.test(A.auditAddressOf({ id: 's1' }, 'bank', '')), 'no role given: the auditor seat, as before');
ok([read('public/app/books-grant-marks.js'), read('public/app/books-grant-view.js')].every((src) => src.indexOf("'bank', carry, grantKit.viewState.o.member.role)") > 0), 'both Bank doors pass the own role of the firm');
ok(/phrase\('no month has ended yet'\)/.test(read('public/app/period-pick.js')), 'the year line never says 0 of 0 months locked');
console.log(n + ' checks passed');
