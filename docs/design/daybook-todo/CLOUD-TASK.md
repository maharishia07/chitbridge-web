# Cloud task — the Day book opens with the day, then the to-do

**Outcome (one):** the Ledger's Day book view (`public/app/cap-books.js`, `bkDaybook`) opens with a strip showing today's
sales per counter and by tender, followed by a to-do list of things to act on one by one, each a tap away — then the
journal entries as today. Proven by harness checks and breaks. Athi (2026-10-01): *"in the daybook, you should be able to
see the total sale in different counters, sellers' pending invoices and so on, so you can act one by one."*

**Branch:** `cloud/daybook-todo` from `main`. Open a pull request; do not merge; never push to `main`.
**Pass mark:** `docs/design/SYSTEM.md`. Never the words "accounting" / "books of account". Short strings: what happened ·
what it means · what to do.

## What to build (web only — every figure comes from routes that already exist; add NO API route)
1. **The strip** (top of the Day book, for the chosen date range's LAST day = "today" by default):
   - Per counter: `C1 ₹4,280 · 12 bills` `C2 ₹6,909 · 5 bills` — from the day's entries: `GET /api/books/daybook` entries
     carry `source: { counter, kind, how, split, count, ... }` (see `bkDaybook` and the stand-in in `e2e/books-web.cjs`);
     a walk-in day entry counts `source.count` bills with its `split`, a per-bill entry counts 1 with its `how`.
   - By tender: `Cash ₹… · UPI ₹… · Card ₹… · On credit ₹…` from the same entries (day entries' `split`, bill entries'
     `how` + the entry total). Never recomputed from lines in a second way; one function, used for both rows.
   - ⚠️ Walk-in cash/UPI/card bills reach the Day book only at day close. Until then the strip says, in muted text,
     `Walk-ins not closed yet — close the day on the counter` when the counter summary for today is absent (the app
     already reads the counter's day summary chits elsewhere — reuse that read if it is cheap; otherwise the sentence
     alone, driven by "no walk-in day entry for today").
2. **The to-do list**, one line each, with a count and a verb, tap → the screen that does it:
   - `3 supplier bills to accept` → Intake (the rail folder) filtered to received supplier bills. Source: the chits the
     app already lists in Intake (`cap-intake.js` / the chits list route) with status received and purpose invoice or
     a counter bill from another shop; if no cheap read exists, read `GET /api/books/health` `waiting[]` rows whose
     reason starts "Waiting for you to confirm" and count those.
   - `2 customers overdue` → Ledger → Dues (customers with any bucket past "Not due"). Source: `GET /api/books/dues`.
   - `1 cheque to deposit / clear` → Ledger → Cheques. Source: `GET /api/books/cheques` (held cheques, `next` non-empty).
   - `2 waiting to be recorded` → Ledger → Waiting. Source: `GET /api/books/health` `waiting[]`.
   - A line appears ONLY when its count is above zero (rule 1: only a failing thing earns a row). All zero → one quiet
     line `Nothing waiting on you`.
3. Layout: the strip and the list sit above the entries; phone first (`scrollWidth === 390`), the strip wraps, the list
   is one card per line below 620 px. Tokens and type per SYSTEM.md. No new dependency, no `alert()`.

## How it proves itself (all by exit code; commit the outputs)
- Extend `e2e/books-web.cjs` (the stand-in already serves daybook/dues/cheques/health — add fixture rows so each line has
  a non-zero count, and one scenario where everything is zero): the per-counter figures, the tender figures (one
  function), each to-do line's count and that its tap opens the named view, the zero case, the "not closed yet"
  sentence, `scrollWidth === 390` at phone width, no "accounting".
- Extend `e2e/books-web-breaks.cjs` with one break per guard (restore FROM A COPY, never `git checkout`); run only your
  group with `BREAK_ONLY=TODO` and report its tally (the full run takes ~40 min; run it once at the end if the machine
  allows, with a long timeout).
- `node scripts/check-syntax.js`, `node scripts/check-app-parses.cjs`, `node e2e/books-web.cjs` → 0.
- Screenshots `e2e/shots/daybook-todo-{laptop,phone,empty}.png`.

## Do not touch
`public/till.html`, `e2e/till-*`, `public/engine/*`, anything in the API repo, any SQL, `public/app/*` other than
`cap-books.js`. Commit messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
