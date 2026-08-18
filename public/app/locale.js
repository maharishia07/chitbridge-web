/**
 * locale.js — THE LOCALISATION LAYER. One roof for every decision that changes across a border.
 *
 * Athi, 2026-08-18: *"this system has to be truly language independent… we have a layer called localisation for
 * that purpose. Bring all those under that layer… bring all under one roof, so we can make it truly universal."*
 *
 * ── WHY A LAYER AND NOT A HELPER ────────────────────────────────────────────────────────────────────────────
 * Localisation is not translation. Translation is one of EIGHT things that change when a reader changes, and
 * before this file each of them was decided somewhere different — or not decided at all:
 *
 *   language      the words                    was: cbLang() in localStorage
 *   direction     which way the page runs      was: nowhere; RTL was impossible until the 378-property sweep
 *   numerals      1234 vs ١٢٣٤                  was: nowhere; every locale silently got Western digits
 *   numbers       grouping and decimal mark    was: taken from the CURRENCY (see below)
 *   money         symbol, placement, grouping  was: CCY_LOCALE — currency mistaken for locale
 *   dates         order, month names, calendar was: pinned 'en-IN' in three separate functions
 *   times         12h/24h, am/pm wording       was: pinned 'en-IN' in fmtAt
 *   sort          how a list orders            was: default JS sort — wrong in every non-English script
 *
 * ⚠️⚠️ THE BUG THIS FILE EXISTS TO FIX: CURRENCY IS NOT LOCALE. `CCY_LOCALE` mapped INR→en-IN, USD→en-US, and
 * formatted money with the locale of the MONEY rather than of the READER. Measured:
 *     every viewer of a USD price saw   $123,456.50      (US grouping)
 *     every viewer of an INR price saw  ₹1,23,456.50     (Indian lakh grouping)
 * …whoever they were. A French reader got lakh grouping; an Indian reader got US grouping. The currency decides
 * the SYMBOL. The reader decides the FORMAT. They are independent, and conflating them is wrong for everyone
 * who is not the one person the mapping happened to suit.
 *
 * ⚠️ AND TIME WAS PINNED TO en-IN FOR EVERYONE — `09:15 pm` to a reader in Tokyo (21:15) or Dubai (09:15 م).
 * That pin was deliberate, for a good reason: "so time is deterministic across browsers" in tests. Keeping the
 * test honest and the product wrong is the wrong trade; determinism belongs in the TEST, by setting a locale.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────────────────────────────────────
 * ⭐ EVERY locale decision goes through here. If a screen calls `toLocaleString` directly it has made a private
 * localisation decision that nobody can see, change, or test — which is exactly the state this replaces.
 *
 * ⚠️ AND THE BOUNDARY THAT MATTERS MORE THAN ANY OF IT: this layer localises CHROME AND FORMAT. It never
 * touches user DATA. A product name, a chit subject, a dispute reason are the author's own words; a chit is a
 * SHARED record, and one that reads differently to each party is not a record. Formatting a number is
 * presentation. Rewriting what someone wrote is not.
 */
(function (root) {
  'use strict';

  /* RTL scripts. ⚠️ Kept as a LIST rather than guessed from the language: there is no rule that derives
     direction from a language tag, and a guess that is right four times out of five is a layout that breaks for
     the fifth without saying why. */
  var RTL = { ar: 1, he: 1, fa: 1, ur: 1, ps: 1, sd: 1, ug: 1, yi: 1, dv: 1 };

  /* ⚠️ THE OLD DEFAULT, PRESERVED EXACTLY. Nothing about a reader who has chosen nothing may change today —
     this layer adds a capability, it does not silently re-format every existing user's screens. */
  var FALLBACK = 'en-IN';

  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (_) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  var L = {
    /** The UI language — which strings to show. */
    lang: function () { return get('cb_lang', 'en'); },

    /**
     * The FORMATTING locale — how numbers, money, dates and times are written.
     *
     * ⚠️ SEPARATE FROM THE LANGUAGE ON PURPOSE. An Indian trader may want the interface in English and money
     * grouped Indian-style; a Gulf buyer may want Arabic words with Western digits. Language is what you read;
     * locale is how figures are written. Tying them forces a choice nobody asked to make.
     */
    locale: function () {
      var explicit = get('cb_locale', '');
      if (explicit) return explicit;
      var lang = L.lang();
      return lang && lang !== 'en' ? lang : FALLBACK;
    },

    /**
     * ⭐⭐ THE STANDARD ALREADY HAS EVERY KNOB — WE ADOPT IT RATHER THAN INVENT A SETTINGS MODEL.
     *
     * Athi, 2026-08-18: *"let the number format 000,000,000.00 or 00,00,000.00, million or lakhs… similarly if
     * different format exists, currency format, same, and date format in different lines. What other parameters
     * to be brought here, do we have any international standard exists which we can adopt straight away here?"*
     *
     * Yes: **BCP 47** (RFC 5646) plus the **Unicode locale extension** (`-u-`, UTS #35 / CLDR). Every parameter
     * below is a documented subtag, and `Intl` already implements all of them — so a preference is not a bespoke
     * flag we then have to teach every formatter about, it is one more subtag on the tag we already pass.
     *
     *   nu  numbering system   latn 123 · arab ١٢٣ · deva १२३
     *   hc  hour cycle         h12 09:15 pm · h23 21:15
     *   ca  calendar           gregory · islamic-umalqura (Rabiʻ I 5, 1448 AH) · indian · buddhist
     *   fw  first day of week  mon … sun
     *   co  collation          how a list sorts
     *   cu  currency           the default one
     *
     * ⚠️ GROUPING IS NOT A SUBTAG, AND THAT IS THE RIGHT ANSWER. "000,000,000.00 vs 00,00,000.00" — millions vs
     * lakhs — is a property of the LOCALE, not a separate switch: `en-US` gives 123,456,789.5 and `en-IN` gives
     * 12,34,56,789.5 because CLDR knows India groups in lakhs. Offering it as its own control would let someone
     * pick a combination no locale on earth uses, and then read a number that means nothing to anybody.
     * ⭐ So the format picker IS the grouping picker. One choice, no contradictions possible.
     */
    tag: function () {
      var base = L.locale(), u = [];
      var nu = get('cb_nu', ''), hc = get('cb_hc', ''), ca = get('cb_ca', ''), fw = get('cb_fw', '');
      if (nu) u.push('nu-' + nu);
      if (hc) u.push('hc-' + hc);
      if (ca) u.push('ca-' + ca);
      if (fw) u.push('fw-' + fw);
      /**
       * ⚠️ TWO DIFFERENT FAILURES, AND ONLY ONE OF THEM THROWS — measured, because I first wrote this comment
       * claiming the check caught both.
       *   · malformed SYNTAX (`-u-nu-`)      → Intl throws, and this try/catch drops back to the bare locale
       *   · an unknown VALUE (`-u-nu-wibble`) → Intl does NOT throw; it ignores the subtag and uses the default
       * Both end safe, but for different reasons, and it is worth saying so: the try/catch is not what makes the
       * second case safe — Intl's own tolerance is.
       */
      if (!u.length) return base;
      var t = base + '-u-' + u.join('-');
      try { new Intl.NumberFormat(t); return t; } catch (_) { return base; }
    },
    setExt: function (k, v) { set('cb_' + k, v || ''); L.apply(); L.push(); },
    getExt: function (k) { return get('cb_' + k, ''); },

    /* ══ THE CHOICE BELONGS TO THE PERSON, NOT THE BROWSER (b165) ═════════════════════════════════════════════
     *
     * ⚠️ Everything above stores to localStorage, which is keyed by BROWSER PROFILE. On its own that means the
     * same person sees two different products on their phone and their laptop, and clearing site data reverts an
     * Arabic reader to English left-to-right — the product becoming unreadable on a device they have not yet
     * visited. So the same six values also live on the identity row, and these two functions keep them in step.
     *
     * ⚠️ LOCAL STAYS THE FAST PATH, DELIBERATELY. The cache is read synchronously at boot, before any network
     * call, so the first paint is already in the reader's language — there is no flash of English. The server
     * value arrives later and only matters when it DIFFERS, which is exactly the new-device case.
     */
    KEYS: ['lang', 'locale', 'nu', 'hc', 'ca', 'fw'],

    /** Read the local answer as the object the API stores. Absent values stay absent — '' means "use default". */
    prefs: function () {
      var out = {};
      L.KEYS.forEach(function (k) { var v = get('cb_' + k, ''); if (v) out[k] = v; });
      return out;
    },

    /**
     * Seed from the server. Returns true if anything actually changed, so the caller can re-render ONLY then —
     * an unconditional re-render on every boot would undo work in progress for no reason.
     *
     * ⚠️ THE SERVER WINS, AND THAT IS THE WHOLE FEATURE. This is the moment a new device learns who is reading.
     * Preferring the local cache here would mean a fresh browser keeps its blank default and the person's real
     * choice never arrives — which is the defect, not the fix.
     *
     * ⚠️ EXCEPT WHEN THE SERVER HAS NOTHING. An empty object is "never chosen", not "chose the default", so a
     * reader who set their language before b165 ran keeps it instead of having it wiped by an empty row.
     */
    hydrate: function (prefs) {
      if (!prefs || typeof prefs !== 'object') return false;
      var incoming = 0;
      L.KEYS.forEach(function (k) { if (prefs[k]) incoming++; });
      if (!incoming) return false;

      var changed = false;
      L.KEYS.forEach(function (k) {
        var was = get('cb_' + k, ''), now = String(prefs[k] || '');
        if (was !== now) { set('cb_' + k, now); changed = true; }
      });
      if (changed) L.apply();
      return changed;
    },

    /**
     * Send the local answer up. Debounced, because the picker fires on every `change` and someone trying three
     * formats to see which they like should cost one write, not three.
     *
     * ⚠️ FIRE AND FORGET, ON PURPOSE. The setting has ALREADY applied locally and the screen has already
     * re-rendered; the person can see it worked. Surfacing a failure here would contradict what is on screen. It
     * is registered in OUTBOX_KEYS, so offline it queues and replays on reconnect rather than being lost — and
     * before b165 runs the API replies {pending:true}, which is equally nothing to report.
     */
    push: function () {
      if (L._t) { try { clearTimeout(L._t); } catch (_) {} }
      L._t = setTimeout(function () {
        try {
          if (typeof root.api !== 'function' || !(root.SESSION && root.SESSION.token)) return;
          root.api('savePrefs', { body: L.prefs() }).catch(function () {});
        } catch (_) {}
      }, 400);
    },

    /**
     * ⚠️⚠️ THE WEEKEND IS NOT SATURDAY AND SUNDAY, and for a TRADE platform that is load-bearing rather than
     * trivia. CLDR: `ar-AE` weekend is [6,7] — Friday and Saturday. `en-IN` is [7] — Sunday only. So "due in
     * three working days" lands on a different date in Dubai, Mumbai and Berlin, and any SLA, due date or
     * ageing calculation that assumes Sat/Sun is quietly wrong for most of the market this product is aimed at.
     * Exposed here so the answer comes from CLDR rather than from whoever writes the next date helper.
     */
    /**
     * ⚠️ TWO SHAPES, AND THE ONE I WROTE FIRST WORKED ONLY IN NODE. The proposal moved from a GETTER
     * (`locale.weekInfo`) to a METHOD (`locale.getWeekInfo()`) — Node still exposes the property, Chromium
     * exposes only the method. My spec passed against Node and failed in the browser, which is the right way
     * round to find it, and the reason the assertion ran in a real browser rather than a harness.
     * ⚠️ Returns null where neither exists rather than guessing Sat/Sun — a wrong weekend is worse than no
     * weekend, because a caller can test for null and cannot test for "confidently wrong".
     */
    weekInfo: function () {
      try {
        var l = new Intl.Locale(L.locale());
        if (typeof l.getWeekInfo === 'function') return l.getWeekInfo() || null;
        return l.weekInfo || null;
      } catch (_) { return null; }
    },
    isWeekend: function (d) {
      var w = L.weekInfo(); if (!w || !w.weekend) return false;
      var iso = ((new Date(d).getDay() + 6) % 7) + 1;    /* JS Sun=0 → ISO Mon=1…Sun=7 */
      return w.weekend.indexOf(iso) >= 0;
    },

    /** 'rtl' or 'ltr' — derived from the language, never from the locale. */
    dir: function () { return RTL[String(L.lang()).slice(0, 2)] ? 'rtl' : 'ltr'; },

    setLang: function (v) { set('cb_lang', v); L.apply(); L.push(); },
    setLocale: function (v) { set('cb_locale', v); L.apply(); L.push(); },

    /** Stamp the document so CSS and screen readers both know. The 378 logical properties do the rest. */
    apply: function () {
      try {
        var d = document.documentElement;
        d.setAttribute('lang', L.lang());
        d.setAttribute('dir', L.dir());
      } catch (_) {}
    },

    /* ── formatters ─────────────────────────────────────────────────────────────────────────────────────── */

    /**
     * ⚠️ CURRENCY FROM THE MONEY, LOCALE FROM THE READER. The whole point of the file.
     * `narrowSymbol` keeps "$1,234" rather than "US$1,234" where the locale allows it.
     */
    money: function (amount, code) {
      var n = Number(amount || 0), c = code || 'INR', loc = L.tag();
      try { return new Intl.NumberFormat(loc, { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' }).format(n); }
      catch (e) {
        try { return new Intl.NumberFormat(loc, { style: 'currency', currency: c }).format(n); }
        catch (_) { return c + ' ' + n.toLocaleString(); }   /* an unknown currency code must still print */
      }
    },

    number: function (n, opts) {
      try { return new Intl.NumberFormat(L.tag(), opts || undefined).format(Number(n || 0)); }
      catch (_) { return String(n); }
    },

    time: function (ts) {
      try { return new Date(ts).toLocaleTimeString(L.tag(), { hour: '2-digit', minute: '2-digit' }); }
      catch (_) { return ''; }
    },

    date: function (ts, opts) {
      try { return new Date(ts).toLocaleDateString(L.tag(), opts || { day: '2-digit', month: 'short', year: 'numeric' }); }
      catch (_) { return ''; }
    },

    /** Date AND time together — the shape `toLocaleString` gives, so call sites convert one-for-one. */
    datetime: function (ts, opts) {
      try {
        return new Date(ts).toLocaleString(L.tag(),
          opts || { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      } catch (_) { return ''; }
    },

    /**
     * ⚠️ SORTING IS LOCALISATION TOO, and it is the one everybody forgets. Plain `Array.sort()` compares UTF-16
     * code units: in Tamil, Arabic or German that is not alphabetical order, it is byte order wearing its
     * clothes. A supplier list that will not sort correctly is unusable long before it is untranslated.
     */
    compare: function (a, b) {
      try { return new Intl.Collator(L.tag(), { numeric: true, sensitivity: 'base' }).compare(String(a), String(b)); }
      catch (_) { return String(a).localeCompare(String(b)); }
    },
    sort: function (arr, keyFn) {
      var k = keyFn || function (x) { return x; };
      return (arr || []).slice().sort(function (x, y) { return L.compare(k(x), k(y)); });
    },

    /** Everything a screen might want to show about the current setting, for the picker. */
    describe: function () {
      var loc = L.locale();
      return { lang: L.lang(), locale: loc, dir: L.dir(),
        sampleMoney: L.money(123456.5, 'USD'), sampleDate: L.date(Date.now()), sampleTime: L.time(Date.now()) };
    },
  };

  root.CBLocale = L;
  try { L.apply(); } catch (_) {}
})(typeof globalThis !== 'undefined' ? globalThis : this);
