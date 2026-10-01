# Cloud task — build the designer's Ledgers page into the app

**Outcome (one):** the Ledger's **Ledgers** view (`public/app/cap-books.js`, `bkLedgers`) looks and behaves exactly like the
designer's handoff in this folder (`index.html`, `styles.css`, `app.js`, `data.js`, `README.md`), wired to the real data,
with a Dr/Cr balance per account. **Branch:** `cloud/ledgers-page` from `main`; open a PR; never push to `main`.
Pass mark: this design for the look, `docs/design/SYSTEM.md` for the rules. Never "accounting" on screen.

## Build
1. Port the design INTO the existing Ledger screen's right pane (the app keeps its own left menu — the design's sidebar is
   NOT built; use the app's). Keep the design's sections (Personal / Real / Nominal with their rule line), groups, Expand
   all / Collapse all, search with highlight (opens all sections), class filter chips with counts, pinned header. Scope
   the CSS under one root class so nothing else in the app changes; the design's tokens map onto the app's where they
   overlap, otherwise kept local.
2. Data: replace `data.js` with the real accounts from `GET /api/books/accounts` (each has code, name, class/role — read
   `bkLedgers` for the current fields). Grouping into Personal / Real / Nominal and the groups: one function, by code
   ranges exactly as `data.js` groups them (1300/2100 personal; 1xxx/2xxx/3xxx real with the GST/Taxes/Equity groups;
   4xxx/5xxx/6xxx nominal). Shop-added ledgers fall into their parent group by code.
3. Balance column (the design left it out): Dr/Cr balance per account as at the selected date from
   `GET /api/books/trial-balance?asOf=` (one read for all rows; never per row). Zero → "—".
4. Clicking an account opens the existing ledger view for that account (`ledger:open` → the function `bkLedgers` uses
   today to open one ledger).
5. Phone: the design's behaviour below 760px; `scrollWidth === 390` at 390px.

## Proof (exit codes; commit outputs)
- extend `e2e/books-web.cjs`: sections and groups render from the stand-in accounts; expand/collapse all; search by code
  and by name highlights and opens sections; a chip filters; balances equal the stand-in trial balance; click opens the
  ledger; phone width; no "accounting".
- `e2e/books-web-breaks.cjs` group `BREAK_ONLY=LEDGERS` (grouping by a second rule, balance per-row fetch, chip ignored);
  restore from a COPY.
- `node scripts/check-syntax.js`, `node scripts/check-app-parses.cjs`, `node e2e/books-web.cjs` → 0.
- Screenshots `e2e/shots/ledgers-page-{laptop,phone,search}.png`, compared by eye with the design.

## Do not touch
`public/till.html`, `e2e/till-*`, `public/engine/*`, the API, SQL. Commits end `Co-Authored-By: Claude <noreply@anthropic.com>`.
