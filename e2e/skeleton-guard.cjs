/* Skeleton guard (P1d): static — no browser. Every small-app page wears the ONE standard page skeleton: a left sidebar (app name + icon · sections · Collapse)
   and a full-width main pane. Finance / CRM / Accounts write that markup themselves; the CBFrame pages (Employees, Network) ask CBFrame.mount for it
   (skeleton: {...}) and link /app/page-skeleton.css. A NEW app page (one that loads the shell frame or the list control) that is in neither list FAILS —
   so "employees and network are not in the standard layout" cannot come back a third time. Run: node e2e/skeleton-guard.cjs */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), pub = path.join(root, 'public');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let fail = 0; const bad = (m) => { fail++; console.log('FAIL ' + m); }; const ok = (m) => console.log('  ok  ' + m);

/* the small apps — add a new one HERE, and give it the skeleton */
const OWN = ['finance.html', 'crm.html', 'accounts.html'];      /* the page draws <aside class="side"> + <main class="main"> itself */
const FRAMED = ['employees.html', 'network.html', 'tasks.html', 'country-lab.html', 'settings.html', 'operations.html'];   /* CBFrame.mount({ skeleton }) draws it (the Country lab: CL3, public — signin:false · CB Settings: SET1 · CB Operations: T3-OPS) */
/* pages that load the frame or the list control but are not small apps: the app itself, the labs and the standards page, and two older single-purpose pages (their own round) */
const NOT_APPS = ['app.html', 'list-lab.html', 'standards.html', 'authority-forms.html', 'know-your-business.html'];

OWN.forEach((f) => {
  const h = read('public/' + f);
  if (!/<aside[^>]*class="side"/.test(h)) bad(f + ': no sidebar (<aside class="side">)');
  else if (!/<main[^>]*class="main[" ]/.test(h)) bad(f + ': no main pane (<main class="main">)');
  else if (!/id="toggleNav"/.test(h)) bad(f + ': the sidebar has no Collapse button');
  else ok(f + ': sidebar + main pane + Collapse');
});
const frame = read('public/app/page-frame.js'), css = read('public/app/page-skeleton.css');
if (!/class="side"/.test(frame) || !/class="main"/.test(frame) || !/toggleNav/.test(frame) || !/Collapse/.test(frame)) bad('page-frame.js: skeleton() must draw the sidebar, main pane and Collapse');
else ok('page-frame.js draws the skeleton');
if (!/\.cbsk \.side\b/.test(css) || !/\.cbsk \.main\b/.test(css)) bad('page-skeleton.css lacks the .side / .main rules');
FRAMED.forEach((f) => {
  const h = read('public/' + f);
  const m = /CBFrame\.mount\(\{[\s\S]*?skeleton:\s*\{[\s\S]*?sections:\s*(\[|[A-Z_]+\b)/.exec(h);   /* a literal list, or the page's own constant (settings.html SECTIONS) */
  if (!m) bad(f + ': CBFrame.mount must be given skeleton: { name, icon, sections }');
  else if (h.indexOf('href="/app/page-skeleton.css"') < 0) bad(f + ': must link /app/page-skeleton.css');
  else if (!/\.\.\/|<aside/.test('') && /<aside[^>]*class="side"/.test(h)) bad(f + ': draws its own sidebar — use the shared skeleton, never a copy');
  else ok(f + ': the shared skeleton (embed stays frameless)');
});
/* discovery: any other page that loads the frame or the list control must be listed above */
fs.readdirSync(pub).filter((f) => /\.html$/.test(f)).forEach((f) => {
  if (OWN.includes(f) || FRAMED.includes(f) || NOT_APPS.includes(f)) return;
  const h = read('public/' + f);
  if (/src="\/app\/(page-frame|list-ctl)\.js"/.test(h) || /<aside[^>]*class="side"/.test(h)) {
    if (f === 'till.html') return;   /* the till has its own sidebar; it is a counter, not a small app page */
    bad(f + ': an app page that is not in the skeleton guard — wear the standard skeleton and add it to OWN/FRAMED in e2e/skeleton-guard.cjs');
  }
});
/* ── ONE SHELL ON EVERY PAGE, EVEN WITHOUT A LOGIN (CL3, owner 13 Oct: "if login not required, still avatar, and font, and other things should be
   intact"). Every public/*.html loads the standard shell (/app/shell.js — CBShell: header, avatar with Sign in, fonts, tokens, text size, kural), or
   is on the list below of pages that do not YET. The list only SHRINKS: a new page that skips the shell fails, and a listed page that now loads
   the shell fails until it is struck from the list. CB Accounts · CRM · Finance draw the skeleton themselves (OWN) and their header is their own
   until they move to CBShell; the till is the counter (host { bar } is its round); the rest are labs, design pages and the shop's public pages. ── */
const SHELL_NOT_YET = ['accounts.html', 'app.html', 'bill-print.html', 'cart-design.html', 'combo-lab.html', 'conversion-lab.html', 'crm.html',
  'design-mock.html', 'embed.html', 'finance.html', 'intake.html', 'iot-howitworks.html', 'lifecycle-test.html', 'list-lab.html', 'network-design.html',
  'network-shop.html', 'offer-lab-next.html', 'offer-lab.html', 'product-lab.html', 'promo.html', 'screen-gallery.html', 'shop.html', 'signin-lab.html',
  'standards.html', 'store.html', 'storefront-design.html', 'supplier-design.html', 'testing.html', 'till.html'];
const shellPages = [];
fs.readdirSync(pub).filter((f) => /\.html$/.test(f)).sort().forEach((f) => {
  const loads = read('public/' + f).indexOf('src="/app/shell.js"') >= 0;
  if (loads && SHELL_NOT_YET.includes(f)) bad(f + ': now loads the standard shell — strike it from SHELL_NOT_YET in e2e/skeleton-guard.cjs (the list only shrinks)');
  else if (!loads && !SHELL_NOT_YET.includes(f)) bad(f + ': does not load the standard shell (/app/shell.js via CBFrame.mount) — every page wears it, even without a login');
  else if (loads) shellPages.push(f);
});
SHELL_NOT_YET.forEach((f) => { if (!fs.existsSync(path.join(pub, f))) bad(f + ': listed in SHELL_NOT_YET but gone — strike it'); });
ok('the standard shell: ' + shellPages.join(' · ') + ' (' + SHELL_NOT_YET.length + ' not yet, a list that only shrinks)');
/* the Country lab is public: CBFrame with signin:false (no sign-in window over it; the avatar's door says Sign in) */
if (!/CBFrame\.mount\(\{[^]*?signin:\s*false/.test(read('public/country-lab.html'))) bad('country-lab.html: a public page mounts CBFrame with signin:false');
else ok('country-lab.html: public (signin:false), the avatar still drawn');
if (fail) { console.log('\nskeleton-guard: ' + fail + ' failure(s)'); process.exit(1); }
console.log('\nskeleton-guard: ok');
