/* OWNS: the ONE place the web keeps SAMPLE data (names, places, a small menu) per country: CBSample.forCountry(cc).
   CALLED BY: offer-lab-next.html, bill-print.html, list-lab.html, screen-gallery.html (labs and previews that show a made-up shop).
   WHY (batch 1128 fixLeak, Athi 21 Nov): no India word, sample, city or price on a non-India shop; a shop with no country gets the NEUTRAL set.
   The api's own starter lists (catalogue-blueprint.js) stay the api's; this file is only what a web page shows before real data exists.
   The data itself lives in sample-set.data.json (country data is data, not code; red1128): this file only reads it and derives each country's set from the neutral one.
   Prices are plain numbers: the page formats them in the SHOP's currency, never with a sign typed here. */
(function (root) {
  'use strict';
  /* the data: Node reads the file; a page reads it once, synchronously, from beside this script (same origin, 8 KB, so forCountry stays a plain call) */
  function readData() {
    if (typeof module !== 'undefined' && module.exports) return require('./sample-set.data.json');
    var here = (document.currentScript && document.currentScript.src) || '/app/sample-set.js';
    var req = new XMLHttpRequest();
    req.open('GET', here.replace(/sample-set\.js(\?.*)?$/, 'sample-set.data.json'), false);
    req.send(null);
    return JSON.parse(req.responseText);
  }
  var DATA = readData();
  var NEUTRAL = DATA.neutral;
  function derive(over) {
    var out = {};
    Object.keys(NEUTRAL).forEach(function (k) { out[k] = NEUTRAL[k]; });
    Object.keys(over).forEach(function (k) { out[k] = over[k]; });
    return out;
  }
  var SETS = {};
  Object.keys(DATA.sets).forEach(function (cc) {
    var over = {};
    Object.keys(DATA.sets[cc]).forEach(function (k) { if (k !== 'hotelNames') over[k] = DATA.sets[cc][k]; });
    var names = DATA.sets[cc].hotelNames;
    if (names) {
      over.hotelProds = NEUTRAL.hotelProds.map(function (p) { return [p[0], names[p[0]] || p[1], p[2], p[3], p[4]]; });
    }
    SETS[cc] = derive(over);
  });
  /** the sample set for a shop's country; no country, or one with no set of its own, gets the neutral one */
  function forCountry(cc) {
    var key = String(cc || '').toUpperCase();
    return Object.prototype.hasOwnProperty.call(SETS, key) ? SETS[key] : NEUTRAL;
  }
  /** the country whose sample set uses this currency code, or '' */
  function countryOfCurrency(code) {
    var want = String(code || '').toUpperCase();
    var hit = Object.keys(SETS).filter(function (cc) { return SETS[cc].ccy === want; })[0];
    return hit || '';
  }
  /** true when this set is the one the built-in (home) lab data already belongs to */
  function isHome(set) {
    return !!set && set.cc === DATA.home;
  }
  var api = { forCountry: forCountry, neutral: NEUTRAL, sets: SETS, countryOfCurrency: countryOfCurrency, isHome: isHome };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CBSample = api;
})(typeof window !== 'undefined' ? window : globalThis);
