/**
 * e2e/terms-page.test.cjs — the Terms and privacy page and the register link to it (SEC-70 · CMP-4), checked without a browser.
 * CALLED BY npm run check:terms · the readability guard's test minimums for public/terms.html.
 * FLOW  read public/terms.html and public/app/register-form.js → one ok() per promise → exit 1 on the first failure.
 * CARD 18-identity-sign-in-and-access/terms
 * The page is static (no network read, so nothing can fail to load); the real-browser walk of the register form (walk-register.cjs) ticks the same box.
 */
const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const page = read('public/terms.html');
const form = read('public/app/register-form.js');
let failed = 0;
function ok(label, pass) {
  console.log((pass ? '  ok  ' : '  FAIL ') + label);
  if (!pass) failed++;
}

ok('walk: the register line links to /terms.html in a new tab, never leaving the form', /href="\/terms\.html"[^>]*target="_blank"[^>]*rel="noopener"/.test(form));
ok('string layer: the register sentence goes through txf with a {terms} placeholder, never a joined fragment', /txf\('These are right, and I accept the \{terms\}\.'/.test(form));
ok('the page opens signed out: CBFrame.mount with signin:false and the one shell bar', /CBFrame\.mount\(\{[^}]*bar: true[^}]*signin: false/s.test(page));
ok('both tabs exist and #privacy opens the second', /id="tab-terms"/.test(page) && /id="tab-privacy"/.test(page) && /#privacy/.test(page));
ok('theme: colours are var(--token, fallback) only, so Cream and Dark both read at 390 and 1366 (AA contrast is the shared a11y check)', !/(^|[^-\w(])#[0-9a-fA-F]{3,6}\b(?![^{]*\))/m.test(page.replace(/var\([^)]*\)/g, '')));
ok('no page scroll: the body is fixed and only the reading panel scrolls', /body\{[^}]*overflow:hidden/.test(page) && /\.panel\{[^}]*overflow:auto/.test(page));
ok('no invented law: no Act, section or Article is cited', !/\b(Act|Art\.|Article|s\.\d|section \d|GDPR|DPDP|PDPL|APP \d)\b/.test(page.replace(/<!--[\s\S]*?-->/g, '')));
ok('the draft is marked until Athi approves the wording', /data-testid="terms-draft"/.test(page));
ok('could not read: nothing is fetched, so there is no load failure to word', !/fetch\(|XMLHttpRequest/.test(page));
if (failed) process.exit(1);
console.log('terms page: all ok');
