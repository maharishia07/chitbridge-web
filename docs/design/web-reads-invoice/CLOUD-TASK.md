# Cloud task — the web READS the frozen invoice; Accept asks what it is for; the old Ledger door closes

**Outcome (one):** every web screen that shows a bill's money shows the figures the chit was frozen with — never a sum of its
own — and accepting a received bill always says what it is for. Read **CLAUDE.md rules 1–5 first**. Branch
`cloud/web-reads-invoice` (this file is its only commit); PR against `main`; never push to `main`.

Athi, 2026-10-02: *"the final computed values stored and the same has to be seen in every other place, no further computation
as the chit is frozen once it become chit"*; *"the accept is not showing the classification"*; *"ledger menu gone from the
menu, but still opening in the backend app … if there is a path that needs to be hidden."*
Context: api PR #3 (merged) makes the counter compute ONCE with `CBTax.determine()` and carry the result as
`header.business_json.invoice` (INV-01, frozen); the server fills `summary_json.money` by mapping it. The tax engine v1.11.0
(adopted: `public/app/tax.js`, `public/engine/tax.js`) has **`CBTax.moneyOf(invoice)`** — the frozen invoice read out in
summary_json.money's names (gross · savings · net · taxable · tax · total · round_off) + by_rate · heads · lines.

## Build — reuse, nothing new
1. **The popup reads the frozen invoice** — `public/app/chit-sheet.js` `linesHTML` (93) · `gstHTML` (105) · `totalHTML` (125):
   when the chit carries `business_json.invoice`, every figure comes from `CBTax.moneyOf(invoice)` (lines from `.lines`, the
   GST block from `.heads`/`.by_rate`, the total from `.total`, round-off from `.round_off`); else from `summary_json.money`;
   else "not recorded" as today. DELETE the hand-halving at chit-sheet.js ~117 (`Math.round(tx_ * 50) / 100` — the one
   failure of api tests/money-round). No arithmetic on money in chit-sheet.js after this. Load order: accounts.html and
   app.html must load `/app/tax.js` before chit-sheet.js (check both).
2. **Accept asks what it is for** — the SAME choice Goods in shows: `billUseChoiceHTML(rows)` (app.html 16284) and the
   `billUse` endpoint (app.html 1889, `PUT /api/chits/:id/use`; the call pattern at app.html 15970). In the popup, Accept on a
   bill received shows that choice (bill-wide, with per-line override if the existing function offers it) and only then moves
   the step to accepted. accounts.html does not load app.html: MOVE `billUseChoiceHTML` (and only what it needs) into a file
   both pages load (accounts-shell.js or chit-sheet.js) — moved, not copied; app.html calls the moved one.
3. **Accept repaints** — after Accept, the popup must show the new step. Since api "bills-private", a bill's step per shop
   is a `bill_step` row in the chit's `state_log` (code B-2100, step 'accepted', mine:true), NOT the shared status — read the
   step from there (see how the API's bills folder reads it) so the sheet, the Day book to-do count and Waiting stop showing
   "To accept" for an accepted bill.
4. **The old Ledger door** — app.html `route()` (3383): a nav to 'ledger' (remembered in `cb_nav@<id>`, bookmarked, typed
   `#/app/ledger`) → `location.replace('/accounts.html#' + <the same view>)`. cap-books.js stays (accounts.html uses it).
   Update the comment at app.html ~6145. Move e2e/books-web.cjs's in-app ledger driving to accounts.html where needed.

## Proof (exit codes; commit outputs)
- `e2e/chit-sheet.cjs`: a fixture chit carrying a real `business_json.invoice` from `CBTax.determine()` (the C2/26-27/0007
  shape: inclusive prices, 12% + 18%, offers, intra, place of supply 33) → the popup's lines, GST rows and total EQUAL
  `CBTax.moneyOf(invoice)` to the paisa; a chit with only summary_json.money; a chit with neither → "not recorded".
- Accept on a received bill → the use choice appears → `PUT /use` then `PUT /status accepted`, once each; the sheet then
  shows Accepted (a state_log bill_step row in the stand-in).
- `#/app/ledger` and a remembered `cb_nav` of 'ledger' → land on /accounts.html at the same view.
- breaks (CRLF-safe, restore from a copy): hand arithmetic back in chit-sheet.js · Accept without the choice · the step read
  from the shared status · the ledger route not redirected — each caught.
- `node scripts/check-syntax.js`, `node scripts/check-app-parses.cjs`, `npm run check`, `node e2e/cb-build-guard.cjs` (bump
  CB_BUILD), `node e2e/books-web.cjs`, `node e2e/cb-accounts.cjs`, `node e2e/index-page.cjs` → 0. Run api's
  `tests/money-round.test.js` from a sibling clone if available; say so either way.
- Screenshots: `e2e/shots/chit-sheet-invoice-{laptop,phone}.png`, `chit-sheet-accept-use.png`.
- Playwright is not in the repo — install @playwright/test@1.61.0 outside it and use NODE_PATH; say so in the PR.

## Do not touch
`public/till.html`, `public/engine/*` (vendored/adopted), the API repo, SQL, `e2e/tests/*.spec.js`. Never the live site,
localhost:3000 or port 7351. Commit messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
