/**
 * e2e/leak-1128-samples.test.cjs — batch 1128 fixLeak: no India word, city or sample on a non-India shop.
 * @type regression
 * OWNS      the proof, on public/app/sample-set.js (the ONE place the web keeps made-up shop data), that the AU, AE and neutral sets hold no India word
 *           (Chennai · Tamil Nadu · Tiffin · Dosa · Idli · Coimbatore · Tally · ₹ · Kumar · Ravi · Lakshmi · Sharma …) in any string; that a shop with no country
 *           (or an unknown one) gets the NEUTRAL set; and that the pages which used to carry the Chennai sample inline (bill-print · screen-gallery · intake ·
 *           network-design · list-lab · cap-workforce) now hold none of those words in code or data.
 * CALLED BY .github/workflows/ci.yml (Offline guards). No browser, no network.
 * FLOW      CBSample.forCountry(cc) → every string leaf scanned → page sources scanned (comments stripped)
 *   node e2e/leak-1128-samples.test.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const CBSample = require(path.join(root, 'public', 'app', 'sample-set.js'));
let pass = 0, fail = 0;
const ok = (name, cond, info) => { if (cond) { pass++; console.log('   ok   ' + name); } else { fail++; console.log('   FAIL ' + name + (info ? '\n          ' + info : '')); } };

const INDIA = /Chennai|Tamil|Tiffin|Dosa|Idli|Coimbatore|Erode|Salem|Poonamallee|₹|\bTally\b|Kumar|\bRavi\b|Lakshmi|Meena|Sharma|Nandha|Senthil|Pongal|Parotta|Biryani|Curd Rice|Sambar|Gulab|Halwa|Kurma|Channa|Poori|Chapati/i;
const leaves = (v, out) => { if (typeof v === 'string') { if (!/^[a-z0-9]+$/.test(v)) out.push(v); } /* an internal id (lowercase, no space) is not shown */ else if (Array.isArray(v)) v.forEach((x) => leaves(x, out)); else if (v && typeof v === 'object') Object.keys(v).forEach((k) => leaves(v[k], out)); return out; };
const hits = (set) => leaves(set, []).filter((s) => INDIA.test(s));

['AU', 'AE', ''].forEach((cc) => {
  const set = CBSample.forCountry(cc);
  ok('the ' + (cc || 'no-country') + ' sample set holds no India word', hits(set).length === 0, hits(set).join(' | '));
});
ok('a shop with no country gets the neutral set', CBSample.forCountry(undefined) === CBSample.neutral && CBSample.forCountry('') === CBSample.neutral);
ok('a country with no set of its own (SG) gets the neutral set', CBSample.forCountry('sg') === CBSample.neutral);
ok('country codes are read in any case (au → AU)', CBSample.forCountry('au').cc === 'AU');
ok('the India set still has its own Chennai line (India shops keep their sample)', CBSample.forCountry('IN').place === 'Chennai 600 126 · Tamil Nadu');
ok('AU and AE offer-lab menus keep the ids the lab reads (masala · coffee · ravi)', ['AU', 'AE', ''].every((cc) => {
  const s = CBSample.forCountry(cc), ids = s.hotelProds.map((p) => p[0]);
  return ids.includes('masala') && ids.includes('coffee') && s.hotelCust.some((c) => c[0] === 'ravi') && s.hotelProds.every((p) => s.hotelCats.some((c) => c[0] === p[2]));
}));
ok('every AU/AE menu price is a plain number (the page writes the shop currency)', ['AU', 'AE', ''].every((cc) => CBSample.forCountry(cc).menu.every((m) => typeof m.price === 'number')));

const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\'"`])\/\/[^\n]*/g, '$1').replace(/<!--[\s\S]*?-->/g, ' ');
['public/bill-print.html', 'public/screen-gallery.html', 'public/intake.html', 'public/network-design.html', 'public/list-lab.html', 'public/app/cap-workforce.js'].forEach((f) => {
  const text = strip(fs.readFileSync(path.join(root, f), 'utf8')).replace(/₹[^\n]*/g, '').replace(/\bTally Prime\b|Tamil, as writ[^\n]*|"Tamil[^\n]*|Tamil supplier[^\n]*/g, '');
  const found = text.replace(/CB[A-Z]+[0-9]+/g, '').match(new RegExp(INDIA.source.replace('|₹', ''), 'gi')) || []; /* a bridge id is not shown as a word */
  ok(f + ' holds no India sample word in code or data', found.length === 0, [...new Set(found)].join(', '));
});

const std = strip(fs.readFileSync(path.join(root, 'public/app/cap-standards.js'), 'utf8'));
ok('the standards register names no Chennai · Madras · INMAA example (international examples use Rotterdam)', !/Chennai|Madras|INMAA/.test(std));

/* the offer lab's swap: the code that applies a country's sample exists and reads the ONE list */
const lab = fs.readFileSync(path.join(root, 'public', 'offer-lab-next.html'), 'utf8');
ok('offer lab loads CBSample and swaps its sample for a non-India shop', /src="\/app\/sample-set\.js"/.test(lab) && /function useCountrySample\(/.test(lab) && /CBSample\.forCountry\(cc\)/.test(lab) && /useCountrySample\(countryOfReply\(/.test(lab));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
