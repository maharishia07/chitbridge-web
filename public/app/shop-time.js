/* public/app/shop-time.js — CBShopTime: the one way a screen writes a day or a moment, in the shop's tag and zone
 * ID        LIB001
 * OWNER     cb-ux-locale
 * OWNS      THE ONE WAY a screen writes a day or a moment: the person's UI language (English until a language choice exists), the shop country's
 *           order and Latin digits (AU 21/11/2026, AE 21/11/2026, IN 21/11/2026), and the SHOP's own zone (an IANA name, window.CB_SHOP_TZ <- /me
 *           entity.timezone), never the browser's. Also the shop's ISO day (today) and the ISO parts of a moment.
 * FLOW      engine/locale.js (CBLocale, adopted, read only) -> this file replaces CBLocale.date / .datetime / .time with the shop's tag + zone ->
 *           every CBLocale.date caller and CBShopTime.* caller gets the same answer. e2e/guard-static.cjs fails on any toLocale*String /
 *           Intl.DateTimeFormat date call outside this file, engine/ and vendor/ (AE-F-05/10/20, WALK-AE 2026-11-21).
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/locale
 * RISK      stored text never holds a formatted date: store the ISO day (today()) and format at display (dayText / date).
 */
(function (root) {
  'use strict';
  function localeEngine() {
    return root.CBLocale || null;
  }
  /** a failed read is logged (when the page has cbQuiet) and the caller keeps its safe answer: a date is never blanked by a logging problem */
  function quiet(what, failure) {
    if (typeof root.cbQuiet === 'function') root.cbQuiet('shop-time: ' + what, failure);
  }
  /** is this a zone Intl knows (an unknown one must never blank a date) */
  function zoneOk(zone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: zone });
      return true;
    } catch (failure) {
      quiet('a zone name Intl does not know: ' + zone, failure);
      return false;
    }
  }
  /** the SHOP's zone: the entity's own, else the person's (CBLocale), else '' (the browser's) */
  function zone() {
    var shopZone = root.CB_SHOP_TZ ? String(root.CB_SHOP_TZ) : '';
    if (shopZone && zoneOk(shopZone)) return shopZone;
    try {
      var person = localeEngine() && localeEngine().timezone ? localeEngine().timezone() : '';
      if (person && zoneOk(person)) return person;
    } catch (failure) {
      quiet('the person zone could not be read, the browser zone is used', failure);
    }
    return '';
  }
  /** an English tag with the country's region and any explicit nu/ca/hc choice kept: "ar-AE-u-nu-latn" becomes "en-AE-u-nu-latn" */
  function englishTagOf(base) {
    var parts = base.split('-u-'),
      region = /^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?-([A-Z]{2})(?:-|$)/.exec(parts[0]);
    return 'en' + (region ? '-' + region[1] : '') + (parts[1] ? '-u-' + parts[1] : '');
  }
  /** the tag a date is written in: the UI language's words (English) + the country's region for the order, Latin digits; an explicit nu/ca/hc choice stays */
  function tag() {
    var engine = localeEngine(),
      base = 'en';
    try {
      base = (engine && engine.tag && engine.tag()) || 'en';
      var lang = (engine && engine.lang && engine.lang()) || 'en';
      if (String(lang).split('-')[0] === 'en') base = englishTagOf(base);
      new Intl.DateTimeFormat(base);
    } catch (failure) {
      quiet('the format tag was not readable, English is used', failure);
      base = 'en';
    }
    return base;
  }
  function moment(ts) {
    var l = localeEngine();
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
    var when = moment(ts);
    if (!when) return '';
    try {
      var out = when[method](tag(), withZone(opts));
      return localeEngine() && localeEngine().ltr ? localeEngine().ltr(out) : out;
    } catch (failure) {
      quiet('a moment could not be written (' + method + ')', failure);
      return '';
    }
  }
  var node = {
    tag: tag,
    /** the zone this device's clock sits in (M196's reading); '' when it cannot be read */
    deviceZone: function () {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      } catch (failure) {
        quiet('the device zone could not be read', failure);
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
      var when = moment(ts);
      if (!when) return null;
      var options = withZone({ year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
        pieces = {};
      function read() {
        new Intl.DateTimeFormat('en-CA', options).formatToParts(when).forEach(function (x) {
          pieces[x.type] = x.value;
        });
      }
      try {
        read();
      } catch (failure) {
        quiet('the shop zone failed in formatToParts, the browser zone is used', failure);
        delete options.timeZone;
        read();
      }
      return { day: pieces.year + '-' + pieces.month + '-' + pieces.day, year: pieces.year, month: pieces.month, dd: pieces.day, hour: Number(pieces.hour) % 24, minute: Number(pieces.minute), weekday: pieces.weekday };
    },
    /** a SAMPLE of how a given tag writes a moment (the format pickers show each choice in its own tag): never for a real record */
    sample: function (aTag, ts, opts, aZone) {
      try {
        var o = Object.assign({}, opts || {});
        if (aZone) o.timeZone = aZone;
        return new Intl.DateTimeFormat(aTag, o).format(moment(ts) || new Date());
      } catch (failure) {
        quiet('a sample for ' + aTag + ' could not be written', failure);
        return '';
      }
    },
    /** how two zones read the same instant (true when the clocks differ): Settings shows the zone hint only then */
    zonesDiffer: function (a, b) {
      if (!a || !b || a === b) return false;
      try {
        var t = Date.now();
        return node.sample('en-GB', t, { dateStyle: 'short', timeStyle: 'short' }, a) !== node.sample('en-GB', t, { dateStyle: 'short', timeStyle: 'short' }, b);
      } catch (failure) {
        quiet('two zones could not be compared', failure);
        return false;
      }
    }
  };
  root.CBShopTime = node;
  /* the engine's own date methods now answer through this file (one formatter; the adopted engine is read-only here) */
  var engine = localeEngine();
  if (engine) {
    engine.date = node.date;
    engine.datetime = node.datetime;
    engine.time = node.time;
  }
})(typeof window !== 'undefined' ? window : globalThis);
