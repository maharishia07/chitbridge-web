/**
 * e2e/pay-day.test.cjs — F19 (21 Nov 2026): a payment carries the SHOP's day (YYYY-MM-DD), never an ISO timestamp.
 * The api (lib/books-period.js, GOR-12) refuses received_at with a time or zone: DATE_INVALID. Runs the REAL bkToday + payWrite body, and the stand-in's refusal.
 */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { liftFns } = require('./lib/lift-fn.cjs');
const books = require('./lib/books-api.cjs');
let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) bad++; };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** bkToday as the page runs it, with the clock fixed at `iso` and the shop's zone `zone` */
function todayAt(iso, zone) {
  const RealDate = Date, at = new RealDate(iso).getTime();
  function FakeDate(...a) { return a.length ? new RealDate(...a) : new RealDate(at); }
  FakeDate.prototype = RealDate.prototype; FakeDate.now = () => at; FakeDate.UTC = RealDate.UTC;
  const cx = vm.createContext({ Date: FakeDate, Intl, window: zone ? { CB_SHOP_TZ: zone } : {} });
  vm.runInContext(liftFns('public/app/cap-books.js', ['bkToday']) + '\nthis.out = bkToday();', cx);
  return cx.out;
}
/* 20:00Z on 21 Nov = 06:00 on 22 Nov in Brisbane (UTC+10); 22:00Z = 03:30 on 22 Nov in Kolkata (UTC+5:30) */
ok(todayAt('2026-11-21T20:00:00Z', 'Australia/Brisbane') === '2026-11-22', 'UTC+10 before 10:00 UTC: the shop day is the 22nd, not the UTC 21st');
ok(todayAt('2026-11-21T22:00:00Z', 'Asia/Kolkata') === '2026-11-22', 'UTC+5:30 before 05:30 UTC: the shop day is the 22nd');
ok(DAY.test(todayAt('2026-11-21T22:00:00Z', 'Asia/Kolkata')) && DAY.test(todayAt('2026-11-21T20:00:00Z', 'Australia/Brisbane')), 'both are a bare day');
ok(DAY.test(todayAt('2026-11-21T20:00:00Z', 'Not/AZone')), 'an unknown zone falls back to the browser day, still a bare day');

/* the pay body: received_at is bkToday(), never toISOString */
const src = fs.readFileSync(path.join(__dirname, '..', 'public/app/cap-books.js'), 'utf8');
const pay = src.slice(src.indexOf('function payWrite('), src.indexOf('function payWrite(') + 1800);
ok(/received_at: bkToday\(\)/.test(pay) && !/received_at: new Date/.test(pay), 'payWrite sends received_at: bkToday()');

/* the stand-in refuses a timestamp like the real api */
const iso = books.dayRefusal('received_at', new Date().toISOString());
ok(iso && iso.code === 'DATE_INVALID' && iso.field === 'received_at', 'stand-in refuses an ISO timestamp (DATE_INVALID)');
ok(books.dayRefusal('received_at', '2026-11-22') === null, 'stand-in takes a day');
const bk = fs.readFileSync(path.join(__dirname, 'books-web.cjs'), 'utf8');
ok(/dayRefusal\('received_at'/.test(bk), 'books-web.cjs POST /payments uses it');

process.exit(bad ? 1 : 0);
