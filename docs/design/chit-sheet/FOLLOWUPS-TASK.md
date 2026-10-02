# Cloud task — chit sheet follow-ups (review of PR #6)

**Outcome (one):** the chit sheet from PR #6 is reachable from the to-do lines that still go to Intake, speaks the
shopkeeper's word for what it shows, prints tender the way the counter does, and its breaks run on a Windows checkout.
Found reviewing PR #6 (2026-10-02) and live by Athi (2026-10-01): *"it goes in to intake page, not the one i expect to
see"* — tapping **"1 supplier bill to accept"** in the Day book opened Intake.

**Branch:** you are on `cloud/chit-sheet-followups`, cut from `cloud/chit-sheet` (PR #6, not yet merged). Open the
PR **against `cloud/chit-sheet`** (stacked); never push to `main` or to `cloud/chit-sheet`. Pass mark:
`docs/design/SYSTEM.md`. Short strings; never "accounting". Read `docs/design/chit-sheet/CLOUD-TASK.md` and
`docs/design/chit-sheet/BACKLOG.md` first — this task answers BACKLOG items 5 and the to-do half of 4.

## Build
1. **The Day book to-do "N supplier bill(s) to accept"** (`public/app/cap-books.js` ~491, `navTo('intake')`): with
   ONE such bill, tap → `openChitSheet(<that chit id>)` over the Day book; with several, tap → the Ledger's **Waiting**
   view (its rows already open the sheet since PR #6). Find where the to-do counts come from; if the count arrives
   without ids, read the ids from the same Waiting data the view uses (one read, not one per row). No Intake.
   The same for the cart/index "accept" card if it is in this repo (BACKLOG item 5).
2. **The sheet's title is the document, not "Chit"**: "Bill" for a counter bill, "Supplier bill" for a bill received,
   the purpose word otherwise (one map, in chit-sheet.js). "Chit" never appears as a title a shop sees.
3. **Tender as the counter prints it**: read how `public/till.html` renders tender and change on its printed slip
   (read only — do not edit till.html) and make the sheet's PAID BY block say the same thing the same way (e.g. cash
   given and change, or cash kept — whichever the slip does). Fix the e2e fixture so its numbers add up
   (today: paid 700, change 17.99, parts 500 + 182.01) and assert the sum.
4. **Breaks on Windows**: `e2e/chit-sheet-breaks.cjs` has two anchors containing `\n` ("accepted bill still offers
   Accept", "sheet not repainted after Accept") — on a CRLF checkout they never apply ("anchor x0"). Make the breaks
   runner normalise line endings when reading and restore the file byte-for-byte, or rewrite those anchors on one line.

## Proof (exit codes; commit outputs)
- `e2e/chit-sheet.cjs` gains: the one-bill to-do opens the sheet (a `<dialog>`) for that chit and never navigates;
  the several-bills to-do opens Waiting; the title words per kind; the tender block's numbers add up.
- `e2e/chit-sheet-breaks.cjs`: add a break per new guard (to-do back to Intake, title back to "Chit", tender sum
  wrong) → every break caught, and the run prints N/N with no "anchor x0" line.
- `node scripts/check-syntax.js`, `node scripts/check-app-parses.cjs`, `node e2e/chit-sheet.cjs`,
  `node e2e/chit-sheet-breaks.cjs`, `node e2e/books-web.cjs`, `node e2e/index-page.cjs` → 0. Stand-in API on a free
  OS port; never localhost:3000, port 7351 or the live site. Bump `CB_BUILD` in app.html if a cap file changed.
- Screenshots: `e2e/shots/chit-sheet-todo.png` (the sheet over the Day book from the to-do) and refresh the three
  existing `chit-sheet-*.png`.

## Do not touch
`public/till.html`, `e2e/till-*`, `public/engine/*`, the API repo, SQL, `e2e/tests/*.spec.js`. If `@playwright/test`
is missing, install it outside the repo and say so in the PR. Commit messages end with
`Co-Authored-By: Claude <noreply@anthropic.com>`.
