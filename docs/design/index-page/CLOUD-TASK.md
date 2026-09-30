# Cloud task — the index page at `/`

**Outcome (one):** the ChitBridge index page, exactly as designed in `docs/design/index-page/cb-index.md` (the HTML is
in that file; screenshots beside it), served at `/`, with every tile a real link, live facts, and a harness proving the
six checks in the design plus the pass mark in `docs/design/SYSTEM.md`.

**Branch:** work on `cloud/index-page` (cut from `main`). Open a pull request; do not merge; do not push to `main`.

## What to build
1. **Retire the frozen app at `/`** (Athi, 2026-09-30). `index.html` at the repo root is the old Vite app; `vercel.json`
   rewrites everything to it. Replace it with the new page so `/` serves the index. Keep `public/*.html` reachable at
   their own paths (the counter `/till.html`, the app `/app.html`, the labs, the design pages). If the Vite build must
   stay for `/app` chunks, keep the build and put the page at `index.html` in the build's root — prove with
   `npm run build` and a look at `dist/`.
2. **Naming:** the third box is **Ledger** (not "Accounts") and the opening sentence reads "the ledger records it".
   The words "accounting" and "books of account" appear nowhere.
3. **Links:** Till → `/till.html` in its own tab (`target="_blank"`, it is the offline counter); Catalogue →
   `app.html` at the catalogue; Ledger → `app.html` at the ledger; Product Lab → `product-lab.html`; Offer Lab →
   `offer-lab.html`; Combo Lab → `combo-lab.html`; Tax Lab → `tax-lab.html` **which does not exist yet** — the tile
   shows the status text "coming" and is not a link. Footer: Your shop → app settings; Counters & keys, Co-assists,
   Suppliers, Connectors → the app's sections. `app.html` routes by `UI.nav` (see `public/app.html` around the
   `["Business",[...]]` menu and `function go(hash)`), not by hash: add the smallest deep link, `app.html#/app/<nav>`
   (e.g. `#/app/ledger`, `#/app/catalogue`, `#/app/settings`), that sets `UI.nav` on arrival — and nothing else in
   the app changes. Add a **Home** link (to `/`) in the app's top bar and on each Lab page's header.
4. **Sign-in:** the index reads the app's session (`localStorage.cb_sess`, see `restoreSession()` in `app.html`, token
   is a JWT; the API base is what `app.html` uses). Signed out: no facts, the three boxes still shown, and one
   sign-in door to `app.html#/login`. Signed in: the facts below, each one call, all failures silent (a box with no
   fact is fine; never an error string).
5. **Live facts (one source each, read through the existing API, no new routes):**
   Till — counter open? · bills and takings today (the counter summary the app already reads); Catalogue — products ·
   shelves (categories) · **items with no cost** (this figure is ONE function shared with the Product Lab tile's
   "without a cost" — they must never disagree); Ledger — if the shop's ledger is on (`GET /api/books/health`, 404
   means off): "Ledger up to <last posted day>" and "<n> waiting"; if off: "Not switched on" and the box opens the
   app's Ledger section which explains; Offer Lab — drafts waiting; Combo Lab — combos · modifiers; Tax Lab — GSTIN
   present → "GST invoices", absent → "no GSTIN — cash memos".
6. **Alerts:** only a failing thing earns a row; when nothing is wrong the block renders nothing at all. Each alert has
   its fix button (rule 2). Sources today: counter prices older than 24 h; bills not sent up; ledger items waiting.
7. **The Ledgers view regrouped** (`public/app/cap-books.js`, `bkLedgers`): four bands with the plain word first and the
   classical word after — **People** (personal: customers, suppliers; Debtors and Creditors as the control lines) ·
   **Things you hold** (real: cash, bank, UPI, stock, assets; then GST payable, loans) · **Income and expenses**
   (nominal) · **Results** (links to Trial balance, P&L, Balance sheet). Codes decide the band: 1300/2100 and their
   parties → People; other 1xxx/2xxx/3xxx → Things; 4xxx/5xxx/6xxx → Income and expenses. Nothing computed in the page
   — it only groups what `GET /api/books/accounts` returns.

## How it proves itself (all by exit code; commit the outputs)
- `node scripts/check-syntax.js`, `node scripts/check-app-parses.cjs` → 0.
- New harness `e2e/index-page.cjs` (pattern: `e2e/books-web.cjs` — Playwright, a stand-in API on a free port from the
  OS, never `localhost:3000`, never the live site, never port 7351): the six checks from the design (three boxes, four
  labs in a tinted band; empty alert block renders nothing; the two "no cost" figures come from one function and
  agree; every alert has a fix button; `document.scrollWidth === 390` at phone width; under 250 words), plus: every
  tile's link target; signed-out shows the sign-in door and no facts; Ledger off → "Not switched on"; the strings
  "accounting"/"books of account" absent; the four bands on the Ledgers view. Screenshots to
  `e2e/shots/index-{laptop,phone,alerts,all-well}.png` and `e2e/shots/ledgers-bands.png`.
- `node e2e/books-web.cjs` and `node e2e/books-web-breaks.cjs` still exit 0 (the Ledgers view changed).
- `node e2e/a11y-contrast.cjs` on the new page → 0.
- Break each new guard once and restore FROM A COPY (never `git checkout`): add the breaks to a small
  `e2e/index-page-breaks.cjs` like `books-web-breaks.cjs`.

## Do not touch
`public/till.html` (a vendored copy; its master is in the API repo), `e2e/till-*`, `public/engine/*`, `public/app/*`
other than `cap-books.js`, anything under `e2e/tests/` (those run against the live site), the API repo, any SQL.
No new npm dependency. No `alert()`. Commit messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
