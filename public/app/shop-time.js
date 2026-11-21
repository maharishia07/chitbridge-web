/* ID     CBShopTime
 * OWNER  ux-locale
 * OWNS   THE ONE WAY a screen writes a day or a moment: the person's UI language (English until a language choice exists), the shop country's
 *        order and Latin digits (AU 21/11/2026, AE 21/11/2026, IN 21/11/2026), and the SHOP's own zone (an IANA name, window.CB_SHOP_TZ <- /me
 *        entity.timezone), never the browser's. Also the shop's ISO day (today) and the ISO parts of a moment.
 * FLOW   engine/locale.js (CBLocale, adopted, read only) -> this file replaces CBLocale.date / .datetime / .time with the shop's tag + zone ->
 *        every CBLocale.date caller and CBShopTime.* caller gets the same answer. e2e/guard-static.cjs fails on any toLocale*String /
 *        Intl.DateTimeFormat date call outside this file, engine/ and vendor/ (AE-F-05/10/20, WALK-AE 2026-11-21).
 * CARD   29-qa-test-tooling-ux-locale-and-design-system / locale
 * RISK   stored text never holds a formatted date: store the ISO day (today()) and format at display (dayText / date).
 */
(function (root) {
  'use strict';
  function loc() {
    return root.CBLocale || null;
  }
  /** is this a zone Intl knows (an unknown one must never blank a date) */
  function zoneOk(zone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: zone });
      return true;
    } catch (_) {
      return false;
    }
  }
  /** the SHOP's zone: the entity's own, else the person's (CBLocale), else '' (the browser's) */
  function zone() {
    var own = root.CB_SHOP_TZ ? String(root.CB_SHOP_TZ) : '';
    if (own && zoneOk(own)) return own;
    try {
      var person = loc() && loc().timezone ? loc().timezone() : '';
      if (person && zoneOk(person)) return person;
    } catch (_) {}
    return '';
  }
  /** the tag a date is written in: the UI language's words (English) + the country's region for the order, Latin digits; an explicit nu/ca/hc choice stays */
  function tag() {
    var l = loc(),
      base = 'en';
    try {
      base = (l && l.tag && l.tag()) || 'en';
      var lang = (l && l.lang && l.lang()) || 'en';
      if (String(lang).split('-')[0] === 'en') {
        var parts = base.split('-u-'),
          region = /^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?-([A-Z]{2})(?:-|$)/.exec(parts[0]);
        base = 'en' + (region ? '-' + region[1] : '') + (parts[1] ? '-u-' + parts[1] : '');
      }
      new Intl.DateTimeFormat(base);
    } catch (_) {
      base = 'en';
    }
    return base;
  }
  function moment(ts) {
    var l = loc();
    if (l && l._d) return l._d(ts);
    if (ts === null || ts === undefined || ts === '') return null;
    var d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  function withZone(opts) {
    var o = {};
    for (var k in opts || {}) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    if (!o.timeZone) {
      var z = zone();
      if (z) o.timeZone = z;
    }
    return o;
  }
  /** a moment through one of Date's formatters in the shop's tag and zone; '' when absent or unreadable */
  function through(method, ts, opts) {
    var d = moment(ts);
    if (!d) return '';
    try {
      var out = d[method](tag(), withZone(opts));
      return loc() && loc().ltr ? loc().ltr(out) : out;
    } catch (_) {
      return '';
    }
  }
  var node = {
    tag: tag,
    /** the zone this device's clock sits in (M196's reading); '' when it cannot be read */
    deviceZone: function () {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      } catch (_) {
        return '';
      }
    },
    zone: zone,
    zoneOk: zoneOk,
    date: function (ts, opts) {
      return through('toLocaleDateString', ts, opts || { day: '2-digit', month: 'short', year: 'numeric' });
    },
    datetime: function (ts, opts) {
      return through('toLocaleString', ts, opts || { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    },
    time: function (ts, opts) {
      return through('toLocaleTimeString', ts, opts || { hour: '2-digit', minute: '2-digit' });
    },
    /** a bare calendar day ('YYYY-MM-DD', or a 'YYYY-MM' month) is not a moment: read in UTC so no zone moves it */
    day: function (iso, opts) {
      var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(iso == null ? '' : iso));
      if (!m) return '';
      var o = Object.assign({ day: 'numeric', month: 'short', year: 'numeric' }, opts || {});
      if (!m[3]) delete o.day;
      o.timeZone = 'UTC';
      return through('toLocaleDateString', Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1, 12), o);
    },
    /** the month word of 0-11 (UI language), short or long */
    month: function (index, form) {
      return node.day(String(2000) + '-' + ('0' + (index + 1)).slice(-2) + '-15', { month: form === 'long' ? 'long' : 'short', day: undefined, year: undefined });
    },
    /** the shop's ISO day (YYYY-MM-DD) for a moment (default now): the one place a stored day is made */
    today: function (ts) {
      var p = node.parts(ts === undefined ? new Date() : ts);
      return p ? p.day : '';
    },
    /** { day: 'YYYY-MM-DD', year, month, dd, hour (0-23), minute, weekday (short) } of a moment in the shop's zone; null when unreadable */
    parts: function (ts) {
      var d = moment(ts);
      if (!d) return null;
      var o = withZone({ year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
        p = {};
      function read() {
        new Intl.DateTimeFormat('en-CA', o).formatToParts(d).forEach(function (x) {
          p[x.type] = x.value;
        });
      }
      try {
        read();
      } catch (_) {
        delete o.timeZone;
        read();
      }
      return { day: p.year + '-' + p.month + '-' + p.day, year: p.year, month: p.month, dd: p.day, hour: Number(p.hour) % 24, minute: Number(p.minute), weekday: p.weekday };
    },
    /** a SAMPLE of how a given tag writes a moment (the format pickers show each choice in its own tag): never for a real record */
    sample: function (aTag, ts, opts, aZone) {
      try {
        var o = Object.assign({}, opts || {});
        if (aZone) o.timeZone = aZone;
        return new Intl.DateTimeFormat(aTag, o).format(moment(ts) || new Date());
      } catch (_) {
        return '';
      }
    },
    /** how two zones read the same instant (true when the clocks differ): Settings shows the zone hint only then */
    zonesDiffer: function (a, b) {
      if (!a || !b || a === b) return false;
      try {
        var t = Date.now();
        return node.sample('en-GB', t, { dateStyle: 'short', timeStyle: 'short' }, a) !== node.sample('en-GB', t, { dateStyle: 'short', timeStyle: 'short' }, b);
      } catch (_) {
        return false;
      }
    }
  };
  root.CBShopTime = node;
  /* the engine's own date methods now answer through this file (one formatter; the adopted engine is read-only here) */
  var l = loc();
  if (l) {
    l.date = node.date;
    l.datetime = node.datetime;
    l.time = node.time;
  }
})(typeof window !== 'undefined' ? window : globalThis);
