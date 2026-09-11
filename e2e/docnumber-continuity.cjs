/**
 * docnumber-continuity.cjs — Run the counter's nextNumber() outside the browser, against a fresh series and a LEGACY one, because the whole
 * promise made to Athi was "as long as it is not an issue for the continuity" — and continuity is precisely the
 * thing a fresh-install test cannot see.
 */
const fs = require('fs');
const src = fs.readFileSync('C:/dev/chitbridge-api/tools/tally-connector/till.html', 'utf8');

/* the engine, as the page loads it */
global.window = {};
require('C:/dev/chitbridge-web/public/engine/docnumber.js');

/* pull just nextNumber + its two helpers */
const grab = (name) => {
  const i = src.indexOf('function ' + name + '(');
  const j = src.indexOf('\n}', i);
  return src.slice(i, j + 2);
};
const fn = [
  'var S = { shop: { country: COUNTRY } };',
  'var ls = { get: (k, d) => (STORE[k] === undefined ? d : STORE[k]), set: (k, v) => { STORE[k] = v; } };',
  'var DB = { get: async (k) => BOXES[k], set: async (k, v) => { BOXES[k] = v; } };',
  'function fyOf(d){ var y=d.getFullYear(), apr=d.getMonth()>=3, a=apr?y:y-1; return String(a).slice(2)+"-"+String(a+1).slice(2); }',
  grab('docCountry'), grab('tillId'),
  src.slice(src.indexOf('async function nextNumber(kind){'), src.indexOf('\n}', src.indexOf('async function nextNumber(kind){')) + 2),
  'return nextNumber;',
].join('\n');

const make = (country, store, boxes) =>
  new Function('COUNTRY', 'STORE', 'BOXES', 'window', fn)(country, store, boxes, global.window);

(async () => {
  const D = global.window.CBDoc;
  let bad = 0;
  const show = (what, no, country) => {
    const c = D.check(no, country);
    if (!c.ok) bad++;
    console.log('    ' + what.padEnd(30) + no.padEnd(20) + String(no.length).padStart(2)
      + '  ' + (c.ok ? 'ok' : 'OVER — ' + c.reason));
  };

  console.log('\n  A FRESH COUNTER in India\n');
  {
    const store = { cb_till_id: 'C2' }, boxes = {};
    const next = make('IN', store, boxes);
    show('sale', await next(), 'IN');
    show('sale (2nd)', await next(), 'IN');
    show('goods receipt', await next('GRN'), 'IN');
    show('despatch', await next('DC'), 'IN');
  }

  console.log('\n  ⚠ A COUNTER ALREADY BILLING — the continuity case\n');
  {
    /* a series record written before this change: no tagStyle, mid-sequence */
    const store = { cb_till_id: 'C1' };
    const boxes = { 'series': { prefix: 'C1', fy: '26-27', next: 412 },
                    'series-GRN': { prefix: 'C1', fy: '26-27', next: 7 } };
    const next = make('IN', store, boxes);
    const sale = await next();
    const grn = await next('GRN');
    show('sale continues at 412', sale, 'IN');
    console.log('      ' + (sale === 'C1/26-27/0412' ? 'ok    the sequence is unbroken' : 'BROKEN — expected C1/26-27/0412'));
    if (sale !== 'C1/26-27/0412') bad++;
    /**
     * ⚠⚠ A LEGACY GRN SERIES STAYS OVER THE LIMIT UNTIL THE YEAR TURNS, AND THAT IS THE DELIBERATE TRADE.
     * Changing a live series mid-year destroys the one property numbering exists to prove, which is worse. And
     * the number that must never be over is the SALE — the tax invoice — which is 13. A GRN is our own inward
     * record, not a document we issue. It self-heals at the next financial year, proved just below.
     */
    console.log('    ' + 'GRN keeps its long tag'.padEnd(30) + grn.padEnd(20) + String(grn.length).padStart(2)
      + '  17 by design until the year turns');
    console.log('      ' + (grn === 'GRN/C1/26-27/0007'
      ? 'ok    an existing series did NOT change shape mid-year'
      : 'BROKEN — an existing series changed shape: ' + grn));
    if (grn !== 'GRN/C1/26-27/0007') bad++;
  }

  console.log('\n  ⚠ THE SAME COUNTER, NEXT FINANCIAL YEAR — it should roll to the short tag\n');
  {
    const store = { cb_till_id: 'C1' };
    const boxes = { 'series-GRN': { prefix: 'C1', fy: '25-26', next: 88 } };
    const next = make('IN', store, boxes);
    const grn = await next('GRN');
    show('GRN, new year', grn, 'IN');
    console.log('      ' + (grn === 'G/C1/26-27/0001'
      ? 'ok    restarted at 1 AND took the short tag' : 'BROKEN — ' + grn));
    if (grn !== 'G/C1/26-27/0001') bad++;
  }

  console.log('\n  A SHOP WE HAVE NOT STUDIED (AE) — no Indian rule may reach it\n');
  {
    const store = { cb_till_id: 'C1' }, boxes = {};
    const next = make('AE', store, boxes);
    const sale = await next();
    show('sale', sale, 'AE');
    console.log('      ' + (!/26-27/.test(sale)
      ? 'ok    no Indian financial year' : 'BROKEN — inherited India\'s FY: ' + sale));
    if (/26-27/.test(sale)) bad++;
  }

  console.log('\n  ' + bad + ' problems\n');
  process.exitCode = bad ? 1 : 0;
})();
