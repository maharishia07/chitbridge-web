/* OWNS: the ONE place the web keeps SAMPLE data (names, places, a small menu) per country: CBSample.forCountry(cc).
   CALLED BY: offer-lab-next.html, bill-print.html, list-lab.html, screen-gallery.html (labs and previews that show a made-up shop).
   WHY (batch 1128 fixLeak, Athi 21 Nov): no India word, sample, city or price on a non-India shop; a shop with no country gets the NEUTRAL set.
   The api's own starter lists (catalogue-blueprint.js) stay the api's; this file is only what a web page shows before real data exists.
   Prices are plain numbers: the page formats them in the SHOP's currency, never with a sign typed here. */
(function (root) {
  'use strict';
  var NEUTRAL = {
    cc: '',
    comboName: 'Combo deal',   /* the Combo Lab's worked example (lab/combo-mode.js) */
    shopName: 'Sample shop',
    city: 'Your city',
    place: 'Your address · Your city',
    parties: ['Sample customer A', 'Sample customer B', 'Sample customer C', 'Sample customer D'],
    menu: [
      { name: 'Main dish', price: 14, unit: 'plate', group: 'Day' },
      { name: 'Hot drink', price: 4, unit: 'cup', group: 'Day' },
      { name: 'Side dish', price: 6, unit: 'plate', group: 'Day' },
      { name: 'Dessert', price: 7, unit: 'pc', group: 'Evening' },
      { name: 'Cold drink', price: 5, unit: 'cup', group: 'Evening' },
      { name: 'Bread', price: 3, unit: 'pc', group: 'Evening' }
    ],
    hotelName: 'Sample counter',
    hotelCats: [['mains', 'Mains'], ['drinks', 'Drinks'], ['sides', 'Sides'], ['sweets', 'Sweets'], ['combos', 'Combos']],
    /* [id, name, category, price, cost] — the ids are internal; the offer lab keeps its ids across sets */
    hotelProds: [
      ['idli', 'Main dish A', 'mains', 12, 5],
      ['plain', 'Main dish B', 'mains', 14, 6],
      ['masala', 'Main dish C', 'mains', 18, 9],
      ['upma', 'Main dish D', 'mains', 10, 4],
      ['coffee', 'Hot drink', 'drinks', 4, 1.5],
      ['tea', 'Tea', 'drinks', 3, 1],
      ['juice', 'Fresh juice', 'drinks', 6, null],
      ['sambarc', 'Side dish A', 'sides', 6, 3],
      ['chana', 'Side dish B', 'sides', 8, 4],
      ['gulab', 'Dessert A', 'sweets', 7, 3],
      ['halwa', 'Dessert B', 'sweets', 6, 3],
      ['lunch', 'Meal deal', 'combos', 24, 18],
      ['tiffinc', 'Breakfast deal', 'combos', 16, 12]
    ],
    hotelCust: [['ravi', 'Sample catering client', 'trade', 3], ['lakshmi', 'Sample events client', 'trade', 5], ['velcan', 'Sample office canteen', 'trade', 0]],
    pharmaName: 'Sample distributor',
    pharmaCust: [['sharma', 'Sample reseller A', 'reseller', 8], ['nandha', 'Sample reseller chain', 'reseller', 6], ['citysub', 'Sample sub-stockist', 'reseller', 7], ['gh', 'Sample hospital pharmacy', 'trade', 4]]
  };
  function derive(over) {
    var out = {};
    Object.keys(NEUTRAL).forEach(function (k) { out[k] = NEUTRAL[k]; });
    Object.keys(over).forEach(function (k) { out[k] = over[k]; });
    return out;
  }
  var AU = derive({
    cc: 'AU',
    shopName: 'Sample Cafe',
    city: 'Sydney',
    place: '1 Sample Street · Sydney NSW 2000',
    parties: ['Sample Catering Pty Ltd', 'Sample Office Supplies', 'Sample Events Co', 'Sample Hospital Pharmacy'],
    menu: [
      { name: 'Flat white', price: 4.5, unit: 'cup', group: 'Morning' },
      { name: 'Avocado toast', price: 16, unit: 'plate', group: 'Morning' },
      { name: 'Chicken parmigiana', price: 26, unit: 'plate', group: 'Afternoon' },
      { name: 'Meat pie', price: 7.5, unit: 'pc', group: 'Afternoon' },
      { name: 'Lamington', price: 4, unit: 'pc', group: 'Morning' },
      { name: 'Fish and chips', price: 18, unit: 'plate', group: 'Night' }
    ],
    hotelName: 'Sample Cafe counter',
    hotelProds: NEUTRAL.hotelProds.map(function (p) {
      var nm = { idli: 'Avocado toast', plain: 'Eggs on toast', masala: 'Chicken parmigiana', upma: 'Porridge', coffee: 'Flat white', tea: 'Tea', juice: 'Fresh juice', sambarc: 'Chips', chana: 'Garden salad', gulab: 'Lamington', halwa: 'Pavlova slice', lunch: 'Lunch special', tiffinc: 'Breakfast special' };
      return [p[0], nm[p[0]] || p[1], p[2], p[3], p[4]];
    }),
    hotelCust: [['ravi', 'Sample Catering Pty Ltd', 'trade', 3], ['lakshmi', 'Sample Events Co', 'trade', 5], ['velcan', 'Sample Office canteen', 'trade', 0]],
    pharmaName: 'Sample Pharma Wholesale',
    pharmaCust: [['sharma', 'Sample Pharmacy', 'reseller', 8], ['nandha', 'Sample Chemist group', 'reseller', 6], ['citysub', 'Sample Sub-wholesaler', 'reseller', 7], ['gh', 'Sample Hospital pharmacy', 'trade', 4]]
  });
  var AE = derive({
    cc: 'AE',
    shopName: 'Sample Cafeteria',
    city: 'Dubai',
    place: 'Sample Street · Dubai · UAE',
    parties: ['Sample Catering LLC', 'Sample Trading LLC', 'Sample Events FZ-LLC', 'Sample Hospital Pharmacy'],
    menu: [
      { name: 'Karak tea', price: 3, unit: 'cup', group: 'Morning' },
      { name: 'Shawarma plate', price: 18, unit: 'plate', group: 'Afternoon' },
      { name: 'Hummus and bread', price: 14, unit: 'plate', group: 'Afternoon' },
      { name: 'Falafel', price: 8, unit: 'plate', group: 'Morning' },
      { name: 'Luqaimat', price: 12, unit: 'plate', group: 'Night' },
      { name: 'Fresh juice', price: 10, unit: 'cup', group: 'Night' }
    ],
    hotelName: 'Sample Cafeteria counter',
    hotelProds: NEUTRAL.hotelProds.map(function (p) {
      var nm = { idli: 'Falafel wrap', plain: 'Hummus plate', masala: 'Shawarma plate', upma: 'Labneh and bread', coffee: 'Arabic coffee', tea: 'Karak tea', juice: 'Fresh juice', sambarc: 'Fattoush', chana: 'Tabbouleh', gulab: 'Luqaimat', halwa: 'Umm Ali', lunch: 'Lunch special', tiffinc: 'Breakfast special' };
      return [p[0], nm[p[0]] || p[1], p[2], p[3], p[4]];
    }),
    hotelCust: [['ravi', 'Sample Catering LLC', 'trade', 3], ['lakshmi', 'Sample Events FZ-LLC', 'trade', 5], ['velcan', 'Sample Office canteen', 'trade', 0]],
    pharmaName: 'Sample Pharma Trading LLC',
    pharmaCust: [['sharma', 'Sample Pharmacy', 'reseller', 8], ['nandha', 'Sample Pharmacy group', 'reseller', 6], ['citysub', 'Sample Sub-distributor', 'reseller', 7], ['gh', 'Sample Hospital pharmacy', 'trade', 4]]
  });
  var IN = derive({
    cc: 'IN',
    comboName: 'Tiffin Combo',
    shopName: 'Sample Tiffin Corner',
    city: 'Chennai',
    place: 'Chennai 600 126 · Tamil Nadu',
    parties: ['Tally Test Shop', 'Kumar Spares', 'Ravi Stores', 'Meena Traders'],
    menu: [
      { name: 'Masala Dosa', price: 70, unit: 'plate', group: 'Morning' },
      { name: 'Filter Coffee', price: 25, unit: 'cup', group: 'Morning' },
      { name: 'Veg Biryani', price: 140, unit: 'plate', group: 'Afternoon' },
      { name: 'Curd Rice', price: 70, unit: 'plate', group: 'Afternoon' },
      { name: 'Ven Pongal', price: 55, unit: 'plate', group: 'Morning' },
      { name: 'Parotta', price: 30, unit: 'pc', group: 'Night' }
    ]
  });
  var SETS = { IN: IN, AU: AU, AE: AE };
  /** the sample set for a shop's country; no country, or one with no set of its own, gets the neutral one */
  function forCountry(cc) {
    var key = String(cc || '').toUpperCase();
    return Object.prototype.hasOwnProperty.call(SETS, key) ? SETS[key] : NEUTRAL;
  }
  var api = { forCountry: forCountry, neutral: NEUTRAL, sets: SETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CBSample = api;
})(typeof window !== 'undefined' ? window : globalThis);
