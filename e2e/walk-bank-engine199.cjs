'use strict';
/**
 * e2e/walk-bank-engine199.cjs - the bank preview WALKED against engines v1.99.0 (BANK-new-11/14/15), light and dark at 1366x768 and 390x844, on public/bank-demo.html.
 *
 * OWNS      the proof that (a) a payment to the tax office no lodged return explains asks which tax it settles, with the ENGINE's options and sentence and no default; the engine's
 *           existing answer moves it on, another says it is added as an entry; (b) an over-payment the engine proposes says "A$X stays on the customer's account" BEFORE the tick;
 *           (c) a line whose balance breaks shows the engine's sentence and the tick clears it; (d) no horizontal page scroll and AA contrast (4.5:1) of the lines list in each state.
 *           The over-payment is MOCKED (the demo has no open invoices to over-pay): the page's bank-recon suggest is wrapped for ONE named line, nothing else is changed.
 * ENGINES   served from CB_ENGINES_DIR (the engines checkout, read only, never copied into web) for every /engine/<file> it has; the rest from public/engine.
 * SKIPS     (exit 0, said out loud) when CB_ENGINES_DIR is not set or has no receivables.js (the engines are older than v1.99.0).
 * CALLED BY by hand / the box: CB_ENGINES_DIR=/eng/src NODE_PATH=<playwright> node e2e/walk-bank-engine199.cjs
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', 'public'), ENG = process.env.CB_ENGINES_DIR || '';
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
const SHOTS = process.env.CB_SHOTS || path.join(__dirname, 'shots');
const OVERRIDE = (process.env.CB_ENGINE_FILES || 'bank-recon.js,bank-project.js,bank-entry.js,receivables.js').split(','); /* only the files this change is about come from the engines checkout; the rest stay the web's own vendored copies */
let failed = 0;
const check = (ok, words) => { console.log((ok ? 'ok   ' : 'FAIL ') + words); if (!ok) failed++; };
/* the over-payment mock: the real suggest, then ONE line named COOGEE says it paid A$500.00 more than the open invoice */
/* the web's vendored AU pack (inside tax.js) predates bank.tax_liabilities, so the ATO lines are handed the engines checkout's own list (read from its reg-au.js, never typed here) */
const LIABILITIES = (() => { try { const m = /tax_liabilities:\s*(\[[^\]]*\])/.exec(fs.readFileSync(path.join(ENG, 'reg-au.js'), 'utf8')); return m ? JSON.stringify(eval(m[1])) : '[]'; } catch (e) { return '[]'; } })();
const MOCK = ';(function(){var s=CBBankRecon.suggest,L=' + LIABILITIES + ';CBBankRecon.suggest=function(l,o){if(/ATO/.test(l.narration||"")&&window.CBRegulation){var pk=window.CBRegulation.resolve({country:"AU"});o=Object.assign({},o,{pack:Object.assign({},pk,{bank:Object.assign({},pk.bank,{tax_liabilities:L})})});}var r=s.call(this,l,o);if(/COOGEE/.test(l.narration||"")&&r&&r.event){r.against=[{against_ref:"inv-2",bill_no:"INV 2",amount_minor:225000}];r.on_account_minor=50000;r.basis="open_item";}return r;};})();';
const BREAK_CSV = 'Date,Description,Debit Amount,Credit Amount,Balance\n02/10/2026,DIRECT DEBIT ORIGIN ENERGY 7721,242.00,,18258.00\n09/10/2026,MONTHLY ACCOUNT FEE,12.00,,17000.00\n10/10/2026,TRANSFER TO J SMITH,2000.00,,15000.00\n';

function serve() {
  return new Promise((done) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const fromEng = rel.startsWith('/engine/') && ENG && OVERRIDE.indexOf(path.basename(rel)) >= 0 && fs.existsSync(path.join(ENG, path.basename(rel))) ? path.join(ENG, path.basename(rel)) : null;
      const file = fromEng || path.join(ROOT, rel);
      if ((!fromEng && !file.startsWith(ROOT)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end('no');
      let body = fs.readFileSync(file);
      if (rel === '/engine/bank-recon.js') body = Buffer.concat([body, Buffer.from(MOCK)]);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'text/plain' });
      res.end(body);
    });
    server.listen(0, () => done(server));
  });
}
const CONTRAST = () => {
  const lum = (rgb) => { const v = rgb.map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const parse = (css) => { const wide = /^color\(/.test(css), m = css.replace(/^color\([a-z-]+/, '').match(/[0-9.]+/g).map(Number); return { rgb: wide ? m.slice(0, 3).map((c) => c * 255) : m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; };
  const back = (node) => { for (let n = node; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0.9) return c.rgb; } return [255, 255, 255]; };
  const bad = [];
  document.querySelectorAll('#bd_list *').forEach((node) => {
    if (![...node.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) || !node.offsetParent || node.disabled) return;
    const [a, b] = [lum(parse(getComputedStyle(node).color).rgb), lum(back(node))].sort((x, y) => y - x);
    if ((a + 0.05) / (b + 0.05) < 4.5) bad.push(node.tagName + '.' + node.className);
  });
  return bad;
};
async function open(page, word) {
  const row = page.locator('#bd_list [data-row]', { hasText: word }).first();
  await row.waitFor();
  if (!(await row.evaluate((node) => node.classList.contains('cbl-open')))) await row.click();
  await page.waitForSelector('#bd_list .bd-openrow');
}
const text = (page) => page.textContent('#bd_list');
async function shape(page, tag, shot, name) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, tag + ' ' + name + ': no sideways page scroll');
  const bad = await page.evaluate(CONTRAST);
  check(!bad.length, tag + ' ' + name + ': AA contrast of every text in the list' + (bad.length ? ' ' + bad.slice(0, 4) : ''));
  await shot(name);
}
async function walkOne(browser, base, scheme, width, height) {
  const tag = scheme + ' ' + width;
  const errors = [];
  const shotOf = (page) => (name) => page.screenshot({ path: path.join(SHOTS, 'bank199-' + scheme + '-' + width + '-' + name + '.png') });
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/bank-demo.html');
  await page.waitForSelector('#bd_list [data-row]');
  /* (a) which liability */
  await open(page, 'ATO PAYMENT');
  let said = await text(page);
  const engineWords = await page.evaluate(() => CBBankProject.BLOCKER_WORDS.which_liability);
  check(said.includes(engineWords), tag + ': the ATO line asks in the engine\'s own sentence: ' + engineWords);
  const buttons = await page.locator('#bd_list [data-act=liability]').allTextContents();
  check(buttons.join('|') === 'GST|PAYG withholding|PAYG instalment', tag + ': the three liabilities from the engine, none chosen (' + buttons.join('|') + ')');
  check(!(await page.locator('#bd_list .bd-btn[data-act=kind]').count()), tag + ': no second "What is this?" beside the question');
  await shape(page, tag, shotOf(page), '1-which-liability');
  await page.locator('#bd_list [data-act=liability][data-id=payg_instalment]').click();
  said = await text(page);
  check(/PAYG instalment is not added from a bank line yet/.test(said), tag + ': another liability says it is added as an entry, nothing is booked on the wrong head');
  await page.locator('#bd_list [data-act=liability][data-id=gst]').click();
  check(!(await page.locator('#bd_list [data-act=liability]').count()), tag + ': the engine\'s own answer (GST) clears the question');
  await shape(page, tag, shotOf(page), '2-liability-answered');
  /* (b) over-payment says it before the tick */
  await open(page, 'COOGEE');
  const stay = page.locator('#bd_list [data-testid=bd-stays-on-account]');
  check((await stay.count()) === 1 && /500\.00 stays on the customer's account/.test(await stay.textContent()), tag + ': "500.00 stays on the customer\'s account" is on the line');
  const before = await page.evaluate(() => {
    const s = document.querySelector('[data-testid=bd-stays-on-account]');
    const b = [...s.parentNode.querySelectorAll('[data-act=tick]')][0];
    return !!b && !!(s.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  check(before, tag + ': the sentence comes before the tick button');
  await shape(page, tag, shotOf(page), '3-stays-on-account');
  await context.close();
  /* (c) balance break */
  const c2 = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  const p2 = await c2.newPage();
  p2.on('pageerror', (e) => errors.push(String(e)));
  await p2.goto(base + '/bank-demo.html');
  await p2.waitForSelector('#bd_list [data-row]');
  const input = (await p2.locator('#bd_file').isVisible()) || (await p2.locator('#bd_file').count()) ? '#bd_file' : '#bd_file2';
  await p2.setInputFiles(input, { name: 'break.csv', mimeType: 'text/csv', buffer: Buffer.from(BREAK_CSV) });
  await p2.waitForSelector('#bd_cur_sel');
  await p2.fill('#bd_cur_sel', 'AUD');
  await p2.click('[data-act=curuse]');
  await p2.waitForSelector('#bd_list [data-row]');
  await open(p2, 'ACCOUNT FEE');
  const sentence = await p2.evaluate(() => CBBankProject.BLOCKER_WORDS.balance_break);
  check((await text(p2)).includes(sentence), tag + ': a line whose balance breaks shows the engine\'s sentence');
  await shape(p2, tag, shotOf(p2), '4-balance-break');
  await open(p2, 'J SMITH');
  const drawNote = await p2.evaluate(() => CBBankEntry.whatIsThis({ country: 'AU' }).items.filter((i) => i.id === 'owner_drawings').map((i) => i.note)[0]);
  check(!!drawNote && (await p2.locator('#bd_list [data-testid=bd-choice-note]').allTextContents()).some((t) => t === drawNote), tag + ': the drawings answer carries the engine\'s company note');
  await shape(p2, tag, shotOf(p2), '5-drawings-note');
  await open(p2, 'ACCOUNT FEE');
  const tick = p2.locator('#bd_list [data-act=tick]').first();
  check((await tick.count()) === 1, tag + ': the existing confirm tick is offered');
  await tick.click();
  check(!(await text(p2)).includes(sentence), tag + ': the tick clears the balance warning');
  check(!errors.length, tag + ': no page error' + (errors.length ? ' ' + errors[0] : ''));
  await c2.close();
}
(async () => {
  if (process.env.CB_SERVE_ONLY) { const s = await serve(); console.log("PORT " + s.address().port); return; }
  if (!ENG || !fs.existsSync(path.join(ENG, 'receivables.js'))) return console.log('SKIP walk-bank-engine199: set CB_ENGINES_DIR to an engines v1.99.0 src (needs receivables.js)');
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve(), base = 'http://localhost:' + server.address().port;
  const browser = await chromium.launch({ headless: true });
  for (const scheme of ['light', 'dark']) for (const [w, h] of [[1366, 768], [390, 844]]) await walkOne(browser, base, scheme, w, h);
  await browser.close(); server.close();
  console.log(failed ? failed + ' FAILED' : 'all passed');
  process.exit(failed ? 1 : 0);
})();
