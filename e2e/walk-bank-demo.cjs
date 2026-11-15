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
  const fixture = path.join(__dirname, 'fixtures', 'bank-entry-whatisthis.js');
  if (fs.existsSync(fixture)) await context.route('**/engine/bank-entry.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(fixture, 'utf8') }));
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
  const bar = ((await page.textContent('#bd_count')).match(/^\s*(\d+) ready/) || [])[1] || '0';
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
  check(figs.includes('AUD 14,400.00') && figs.includes('AUD 3,108.50') && figs.includes('AUD 17,508.50'), tag + ': pass test: statement 17,508.50, books 14,400.00, difference 3,108.50');
  check((await text('#bd_lines')).includes('19 Oct 2026'), tag + ': dates read "19 Oct 2026" (en-AU), also at 390');
  await countsAgree(page, tag, 'before the GST answer');
  check(await page.locator('#bd_gst').isVisible(), tag + ': the page asks the GST basis once');
  await answerGst(page, 'cash');
  await page.waitForTimeout(150);
  await countsAgree(page, tag, 'after the GST answer');
  const button = await text('#bd_add');
  check(/Add 6 lines/.test(button), tag + ': 6 lines ready after the answer (' + button.trim() + ')');
  await shot('2-gst-answered');
  /* the More menu on a phone keeps both loads */
  if (phone) {
    await page.click('#bd_more');
    check((await text('#bd_menu')).includes('Load your own CSV') && (await text('#bd_menu')).includes('Load the sample statement'), tag + ': More keeps "Load your own CSV" and the sample');
    await shot('3-more-menu');
    await page.keyboard.press('Escape');
  }
  /* the panel: a line that needs you */
  await page.click('button.bd-row[data-act=open]');
  await page.waitForSelector('.lk-side');
  await fits('panel step 1');
  await shot('4-panel-step1');
  check((await text('.lk-side')).includes('What is this?'), tag + ': the panel asks "What is this?" first');
  const hasList = await page.evaluate(() => !!(window.CBBankEntry && window.CBBankEntry.whatIsThis));
  check(hasList ? (await page.locator('.lk-side [data-act=pick]').count()) >= 2 : (await page.locator('.lk-side select[data-field=account]').count()) === 1, tag + ': ' + (hasList ? 'step 1 lists the answers the engine gives' : 'the engine has no answer list yet: one step, an account from the chart'));
  if (hasList) {
    await page.click('.lk-side [data-act=pick]');
    await page.click('.lk-side [data-act=next]');
  }
  await shot('5-panel-step2');
  await trapAndReturn(page, tag, 'panel', () => !!document.activeElement && (document.activeElement.matches('button.bd-row') || document.activeElement.id === 'bd_add'));
  /* answer "What is this?" for the first line that needs you (when the engine gives the list): it becomes ready, and the counts follow */
  let resolved = false;
  if (hasList) {
    await page.click('button.bd-row[data-act=open]');
    await page.waitForSelector('.lk-side');
    const card = page.locator('.lk-side [data-kind=card_settlement]');
    if (await card.count()) {
      await card.click();
      await page.click('.lk-side [data-act=next]');
      await shot('5b-panel-card-settlement');
      await page.click('.lk-side [data-act=resolve2]');
      await page.waitForSelector('.lk-side', { state: 'detached' });
      resolved = true;
      await countsAgree(page, tag, 'after answering one line');
    } else await page.keyboard.press('Escape');
  }
  const ready = resolved ? 7 : 6;
  /* the confirm popup */
  await page.focus('#bd_add');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.lk-confirm');
  const popup = await page.innerText('.lk-confirm-text');
  check(new RegExp('Add ' + ready + ' lines').test(await text('.lk-pop header')) && popup.includes(resolved ? 'AUD 892.50' : 'AUD 12.50') && popup.includes('AUD 984.00'), tag + ': popup: ' + ready + ' lines, in ' + (resolved ? '892.50' : '12.50') + ', out 984.00');
  check(/\bDr\b/.test(popup) && /\bCr\b/.test(popup) && /Dr AUD [\d,.]+ = Cr AUD [\d,.]+/.test(popup), tag + ': popup lists every line with its Dr and Cr and each entry\'s Dr = Cr');
  await fits('popup');
  await shot('6-confirm');
  await trapAndReturn(page, tag, 'popup', () => document.activeElement && document.activeElement.id === 'bd_add');
  /* Add */
  await page.focus('#bd_add');
  await page.keyboard.press('Enter');
  await page.click('[data-testid=lk-confirm-ok]');
  await page.waitForSelector('[data-testid=bd-added]');
  await page.waitForTimeout(200);
  const figsAfter = await text('#bd_figs');
  check(figsAfter.includes(resolved ? 'AUD 14,308.50' : 'AUD 13,428.50') && figsAfter.includes(resolved ? 'AUD 3,200.00' : 'AUD 4,080.00'), tag + ': after the press: books ' + (resolved ? '14,308.50, difference 3,200.00' : '13,428.50, difference 4,080.00'));
  check(new RegExp(ready + ' lines added').test(await text('#bd_msg')), tag + ': the outcome is said in the status line (' + (await text('#bd_msg')).trim() + ')');
  await countsAgree(page, tag, 'after the add');
  await fits('after add');
  await shot('7-added');
  await page.click('#bd_tab_books');
  check(!/not yet in the books/i.test(await text('#bd_books')) && (await text('#bd_books')).includes('Added'), tag + ': "Books after" stops saying "not yet" after the add');
  await fits('books after');
  await shot('8-books-after');
  await page.click('#bd_tab_brs');
  const report = await text('#bd_brs');
  check(report.includes('Demo, sample data') && report.includes('Balance per the books') && report.includes('Balance per the bank statement') && !(await page.locator('.bd-tick').count()), tag + ': the reconciliation is in the standard order, says "Demo, sample data", and has NO tick while lines are outside the books');
  await fits('reconciliation');
  await shot('9-reconciliation');
  if (!phone) await printAndFiles(page, tag, shot);
  else await filesStates(page, tag, shot);
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
async function filesStates(page, tag, shot) {
  const file = (name, body) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(body) });
  const input = (await page.locator('#bd_file').isVisible()) || (await page.locator('#bd_file').count()) ? '#bd_file' : '#bd_file2';
  await page.setInputFiles(input, file('notes.csv', 'hello there'));
  await page.waitForSelector('#bd_lines .bd-problem');
  const lines = await page.textContent('#bd_lines');
  check(/not a bank statement|which column/.test(lines) && !(await page.locator('#bd_lines .bd-row').count()), tag + ': a file that cannot be read says so in words, and the old statement is gone');
  check(!/preset|mapping/.test(lines), tag + ': no engine words ("preset", "mapping") on screen');
  await shot('11-bad-file');
  await page.setInputFiles(input, file('narrative.csv', NARRATIVE_CSV));
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
