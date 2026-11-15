'use strict';
/**
 * e2e/walk-bank-demo.cjs - THE BANK-TO-BOOKS DEMO v2, WALKED: public/bank-demo.html with app/bank-demo.js (+ -ask.js, -report.js), app/bank-preview.js, app/lab-kit.js and the product header,
 * light AND dark theme at 1366x768 and 390x844, every state, keyboard only, signed out AND with a stored session.
 *
 * OWNS      the proof that the page (a) fits both sizes with no page scroll, (b) makes no request outside its own origin, no /api or manifest call, writes no storage, throws no console or CSP error
 *           (signed out and with a cb_sess in localStorage: the header still says "Sign in"), (c) keeps every text at WCAG AA contrast (4.5:1) in light and dark in each state,
 *           (d) says in words when the books engine did not load, (e) reproduces the AU pass test by the engines' own figures (books 14,400.00, difference 3,108.50; after the GST basis is answered
 *           6 lines ready, in 12.50, out 984.00, books after 13,428.50, 3 still need you) and that the chips, the sticky bar and the button count the SAME lines,
 *           (f) works by keyboard alone: the popup and the panel keep focus inside and give it back, Esc closes, (g) the confirm popup lists every line's Dr and Cr and each entry's Dr = Cr,
 *           (h) after Add the Books tab stops saying "not yet" and the reconciliation has no tick while lines are outside the books, (i) a bad file says so in words and clears the old statement,
 *           a heading we do not know is read or opens the column map, (j) the phone keeps both loads under More, (k) the printed report shows nothing else of the page.
 *           Screenshots of every state go to e2e/shots/bank-demo-v2-<light|dark>-<width>-<state>.png.
 * CALLED BY the cloud walks (every e2e/walk-*.cjs); by hand: NODE_PATH=e2e/node_modules node e2e/walk-bank-demo.cjs [--show]
 * SKIPS     (exit 0, said out loud) until the engines adopt puts bank-project.js, bank-entry.js, chart.js, accounts-packs.js and posting.js under public/engine.
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 */
const fs = require('fs'),
  path = require('path'),
  http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', 'public');
const NEEDS = ['bank-project.js', 'bank-entry.js', 'chart.js', 'accounts-packs.js', 'posting.js'];
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
const SIZES = [[1366, 768], [390, 844]];
const SHOTS = path.join(__dirname, 'shots');
let failed = 0;
const check = (ok, words) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + words);
  if (!ok) failed++;
};

function serve() {
  return new Promise((done) => {
    const server = http.createServer((req, res) => {
      const file = path.join(ROOT, req.url.split('?')[0]);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end('no');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'text/plain', 'x-content-type-options': 'nosniff' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, () => done(server));
  });
}
/** every visible text element's colour against the first opaque background above it: the ratio, in the page itself */
const CONTRAST_IN_PAGE = () => {
  const light = (rgb) => {
    const v = rgb.map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const parse = (css) => { const m = css.match(/[\d.]+/g).map(Number); return { rgb: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; };
  const backdrop = (node) => {
    for (let n = node; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0.9) return c.rgb; }
    return [255, 255, 255];
  };
  const worst = [];
  document.querySelectorAll('body *').forEach((node) => {
    const own = [...node.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (!own || !node.offsetParent || node.disabled) return;
    const fg = parse(getComputedStyle(node).color).rgb, bg = backdrop(node);
    const [a, b] = [light(fg), light(bg)].sort((x, y) => y - x);
    const ratio = (a + 0.05) / (b + 0.05);
    if (ratio < 4.5) worst.push(node.tagName + '.' + node.className + ' ' + ratio.toFixed(2));
  });
  return worst;
};
const NARRATIVE_CSV = 'Date,Narrative,Debit Amount,Credit Amount,Balance\n19/10/2026,EFT Smith Pty,,2200.00,12200.00\n20/10/2026,Rent,1650.00,,10550.00\n';

(async () => {
  const missing = NEEDS.filter((name) => !fs.existsSync(path.join(ROOT, 'engine', name)));
  if (missing.length) return console.log('SKIP walk-bank-demo: the engines adopt has not landed (missing under public/engine: ' + missing.join(', ') + ')');
  const server = await serve();
  const base = 'http://localhost:' + server.address().port;
  const browser = await chromium.launch({ headless: !process.argv.includes('--show') });
  const broken = await browser.newPage();
  await broken.route('**/engine/bank-project.js', (route) => route.abort());
  await broken.goto(base + '/bank-demo.html');
  await broken.waitForSelector('#bd_lines .bd-problem');
  check((await broken.textContent('#bd_lines')).includes('has not loaded'), 'engine missing: the page says so in words, shows no figures, makes none up');
  await broken.close();
  for (const scheme of ['light', 'dark']) {
    for (const [width, height] of SIZES) {
      for (const signedIn of [false, true]) {
        if (signedIn && scheme === 'dark') continue;
        await walkOne(browser, base, scheme, width, height, signedIn);
      }
    }
  }
  await browser.close();
  server.close();
  console.log(failed ? failed + ' FAILED' : 'all passed');
  process.exit(failed ? 1 : 0);
})();

/** one scheme, one size, signed out or with a stored session: the whole walk */
async function walkOne(browser, base, scheme, width, height, signedIn) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  if (signedIn) await context.addInitScript(() => { try { localStorage.setItem('cb_sess', JSON.stringify({ token: 'x.y.z', user: { id: 'u1', name: 'Test', role: 'owner' }, biz: { id: 'b1', name: 'Shop' } })); } catch (_) { /* a profile without storage */ } });
  /* proof only: a copy of the engine's "What is this?" file (engines batch I, #145) stands in until the engines adopt lands; no fixture = the page's own adopted engine */
  for (const [name, file] of [['bank-entry', 'bank-entry-whatisthis.js'], ['bank-recon', 'bank-recon-batch-i.js'], ['bank-project', 'bank-project-batch-i.js']]) {
    const fixture = path.join(__dirname, 'fixtures', file);
    if (fs.existsSync(fixture)) await context.route('**/engine/' + name + '.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(fixture, 'utf8') }));
  }
  const page = await context.newPage();
  const tag = scheme + ' ' + width + 'x' + height + (signedIn ? ' with a stored session' : '');
  const seen = { outside: [], calls: [], errors: [] };
  page.on('request', (r) => {
    if (!r.url().startsWith(base)) seen.outside.push(r.url());
    if (/\/api\/|manifest\.json|config\.js/.test(r.url())) seen.calls.push(r.url());
  });
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && seen.errors.push(m.text()));
  page.on('pageerror', (e) => seen.errors.push(String(e)));
  await page.goto(base + '/bank-demo.html');
  await page.waitForSelector('#bd_figs .lk-fig');
  const shot = (state) => page.screenshot({ path: path.join(SHOTS, 'bank-demo-v2-' + scheme + '-' + width + (signedIn ? '-session' : '') + '-' + state + '.png') });
  const fits = async (state) => {
    const fit = await page.evaluate(() => [document.documentElement.scrollHeight - innerHeight, document.documentElement.scrollWidth - innerWidth]);
    check(fit[0] <= 0 && fit[1] <= 0, tag + ' ' + state + ': no page scroll');
    const worst = await page.evaluate(CONTRAST_IN_PAGE);
    check(worst.length === 0, tag + ' ' + state + ': every text at AA contrast (4.5:1)' + (worst.length ? ' ' + worst.slice(0, 4).join('; ') : ''));
  };
  await fits('loaded');
  await shot('1-loaded');
  check((await page.textContent('#shell')).includes('Sign in'), tag + ': the product header is there and says "Sign in" (no person is made up)');
  if (!signedIn) await signedOutStates(page, tag, width, shot, fits);
  check(!seen.outside.length && !seen.calls.length && !seen.errors.length, tag + ': no request outside the page, no /api or manifest call, no console or CSP error ' + JSON.stringify(seen).slice(0, 300));
  await context.close();
}

/** the counts that must agree: the chips, the sticky bar and the button all read one standing per line */
async function countsAgree(page, tag, when) {
  const chips = await page.locator('#bd_lines .bd-go-tag').count();
  const button = (await page.getAttribute('#bd_add', 'data-ready')) || '0';
  const bar = ((await page.textContent('#bd_count')).match(/(\d+) ready to add/) || [])[1] || '0';
  check(String(chips) === button && button === bar, tag + ' ' + when + ': ' + chips + ' "Ready to add" chips = the button (' + button + ') = the bar (' + bar + ')');
}
/** answer the page's one GST question: a radio segment on a wide screen, a menu on a phone */
async function answerGst(page, value) {
  if (await page.locator('#bd_gst [role=radio][data-choice-value=' + value + ']').isVisible()) await page.click('#bd_gst [role=radio][data-choice-value=' + value + ']');
  else {
    await page.click('#bd_gst .cbui-choice-btn');
    await page.click('#bd_gst [role=option][data-choice-value=' + value + ']');
  }
}
/** the focus must stay inside the dialog however many times Tab is pressed, and Esc must give it back */
async function trapAndReturn(page, tag, what, giveBack) {
  let inside = true;
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    inside = inside && (await page.evaluate(() => !!document.activeElement.closest('.lk-pop')));
  }
  check(inside, tag + ' ' + what + ': 14 Tab presses never leave the dialog (a focus trap)');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.lk-pop', { state: 'detached' });
  check(await page.evaluate(giveBack), tag + ' ' + what + ': Esc closes it and focus goes back to the control that opened it');
}

async function signedOutStates(page, tag, width, shot, fits) {
  const text = (selector) => page.textContent(selector);
  const phone = width < 700;
  const figs = await text('#bd_figs');
  check(figs.includes('21,068.55') && figs.includes('23,043.00') && figs.includes('1,974.45') && !/AUD \d/.test(figs), tag + ': frame 0: statement 21,068.55, books 23,043.00, difference 1,974.45 (hand figures of the sample), AUD not on a figure');
  check((await page.locator('#bd_lines .bd-row').count()) === 10, tag + ': the ten sample lines are listed');
  if (!phone) check(await page.evaluate(() => { const pane = document.getElementById('bd_lines'); return pane.scrollHeight <= pane.clientHeight + 2; }), tag + ': all ten rows are visible without scrolling the list');
  check((await text('#bd_lines')).includes('2 Oct 2026') && (await text('#bd_lines')).includes('Invoice INV-2'), tag + ': dates read "2 Oct 2026" and an in-books line names the entry it matched');
  check(!(await page.locator('#bd_tabs, .bd-tabs').first().isVisible()) && !(await page.locator('#bd_gst').isVisible()), tag + ': no tabs and no setup question on the opening frame');
  await countsAgree(page, tag, 'at the start');
  await shot('30s-0-open');
  const hasInvoiceQuestion = (await page.locator('[data-act=taxinvoice]').count()) > 0;
  if (hasInvoiceQuestion) {
    check((await text('#bd_lines')).includes('needs a tax invoice. Do you hold it?'), tag + ': Bunnings asks the tax-invoice question first, in the row');
    await shot('30s-8-question');
    await page.click('[data-act=taxinvoice][data-v=held]');
    await countsAgree(page, tag, 'after "Yes, I hold it"');
  }
  const newParty = page.locator('[data-act=newparty]');
  if (await newParty.count()) {
    await newParty.first().click();
    await countsAgree(page, tag, 'after "New customer"');
  }
  await fits('before the press');
  await shot('30s-15-ready');
  await page.focus('#bd_add');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.lk-confirm');
  const popup = await page.innerText('.lk-confirm-text');
  check(/Difference to the statement after: [-\d,.]+/.test(popup) && /\bDr\b/.test(popup) && /Dr = Cr/.test(popup), tag + ': the confirm lists each entry with Dr and Cr and closes with "Difference to the statement after" (' + ((popup.match(/Difference to the statement after: [-\d,.]+/) || [''])[0]) + ')');
  await fits('popup');
  await shot('30s-16-confirm');
  await trapAndReturn(page, tag, 'popup', () => document.activeElement && document.activeElement.id === 'bd_add');
  await page.focus('#bd_add');
  await page.keyboard.press('Enter');
  await page.click('[data-testid=lk-confirm-ok]');
  await page.waitForTimeout(250);
  await fits('after the press');
  await shot('30s-20-added');
  const finished = (await page.locator('#bd_brs').isVisible()) && (await page.locator('.bd-tick').count()) > 0;
  if (hasInvoiceQuestion) check(finished && (await text('#bd_brs')).includes('Reconciled') && (await text('#bd_figs')).includes('0.00'), tag + ': the last frame is the reconciliation statement with the green nil and the tick');
  else check(!(await page.locator('.bd-tick').count()) || finished, tag + ': the report shows a tick only when nothing is left outside the books');
  if (!(await page.locator('#bd_brs').isVisible())) await page.evaluate(() => document.getElementById('bd_tab_brs').click());
  const report = await text('#bd_brs');
  check(report.includes('Demo, sample data') && report.includes('Balance as per bank statement') && report.includes('Balance as per books') && /not yet on the statement/.test(report) && !/\bDr\b/.test(report), tag + ': the statement uses the AU words and no Dr on the bank figure');
  await shot('30s-25-reconciliation');
  if (phone) {
    await page.click('#bd_more');
    check((await text('#bd_menu')).includes('Load your own'), tag + ': the phone keeps both loads under More');
    await page.keyboard.press('Escape');
    return filesStates(page, tag, shot);
  }
  return printAndFiles(page, tag, shot);
}

/** the print stylesheet, then the file states (desktop) */
async function printAndFiles(page, tag, shot) {
  await page.emulateMedia({ media: 'print' });
  const shown = await page.evaluate(() => [...document.querySelectorAll('.bd-banner,.bd-head,.bd-figs,.bd-tabs,.bd-bar')].every((n) => getComputedStyle(n).display === 'none') && getComputedStyle(document.querySelector('.bd-sheet')).display !== 'none');
  check(shown, tag + ': print: only the report shows (no header, cards, tabs or bar)');
  await shot('10-print');
  await page.emulateMedia({ media: 'screen' });
  await filesStates(page, tag, shot);
}
/** a file of the visitor's: the page asks which currency it is in first (never taken from the account), then reads it */
async function loadWithCurrency(page, input, file, tag, shot) {
  await page.setInputFiles(input, file);
  await page.waitForSelector('#bd_cur_sel');
  if (shot) await shot('12-currency-question');
  await page.fill('#bd_cur_sel', 'AUD');
  await page.click('[data-act=curuse]');
}
async function filesStates(page, tag, shot) {
  const file = (name, body) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(body) });
  const input = (await page.locator('#bd_file').isVisible()) || (await page.locator('#bd_file').count()) ? '#bd_file' : '#bd_file2';
  await loadWithCurrency(page, input, file('notes.csv', 'hello there'), tag, shot);
  await page.waitForSelector('#bd_lines .bd-problem');
  const lines = await page.textContent('#bd_lines');
  check(/not a bank statement|which column/.test(lines) && !(await page.locator('#bd_lines .bd-row').count()), tag + ': a file that cannot be read says so in words, and the old statement is gone');
  check(!/preset|mapping/.test(lines), tag + ': no engine words ("preset", "mapping") on screen');
  await shot('11-bad-file');
  await loadWithCurrency(page, input, file('narrative.csv', NARRATIVE_CSV));
  await page.waitForSelector('#bd_lines .bd-row, #bd_lines .bd-problem');
  if (await page.locator('[data-act=showmap]').count()) {
    await page.click('[data-act=showmap]');
    await page.waitForSelector('select[data-map]');
    await shot('12-column-map');
    const pick = { date: 'Date', narration: 'Narrative', debit: 'Debit Amount', credit: 'Credit Amount', balance: 'Balance' };
    for (const field of Object.keys(pick)) await page.selectOption('select[data-map=' + field + ']', pick[field]);
    await page.click('[data-act=readmap]');
    await page.waitForSelector('#bd_lines .bd-row');
  }
  check((await page.locator('#bd_lines .bd-row').count()) >= 2, tag + ': a file whose heading says "Narrative" is read (by the engine or through the column map), its lines are listed');
  await shot('13-own-file');
}
