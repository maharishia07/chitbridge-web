# Cloud task — the Day book reads like a day book: one line per entry, detail on demand

**Outcome (one):** the Ledger's Day book (`public/app/cap-books.js`, `bkDaybook`) shows ONE row per entry by default
(Tally's Day Book shape) with a gist, expands to the rate-wise lines on tap, and gains Expand all / Collapse all, search,
filter chips, and daily / weekly / monthly grouping with subtotals. Athi (2026-10-01): *"expand all, collapse all,
search, filter, daily view, weekly view … do we need these many lines per sale? … the gist can be showcased as a summary."*

**Branch:** `cloud/daybook-views` from `main`, AFTER `cloud/daybook-todo` and `cloud/chit-sheet` are merged (same file).
PR; never push to `main`. **Pass mark:** `docs/design/SYSTEM.md`. Never "accounting". Short strings.

## What to build (web only; no new API route — `GET /api/books/daybook` already returns entries with `lines` and `source`)
1. **One row per entry, collapsed:** `01 Oct · JV/2026-27/000001 · Sale · Chola Auto Care · Bill C2/26-27/0002 01:46 pm ·
   On credit · Counter C2 · Tally Test (owner)` and on the right the entry total; underneath in muted text the GIST —
   the same-ledger lines merged: `Sales ₹451.40 · GST ₹30.25 · Debtors ₹481.65` (merge by ledger code; GST = the
   2200–2212 lines together, named "GST"; never recomputed — sums of the entry's own lines). The bill number opens the
   chit sheet (if `chit-sheet.js` exists) else the existing link. Tap the row (or ▸) → the rate-wise lines as today;
   tap again → collapsed. **Expand all / Collapse all** buttons at the top; the state is per view, in memory only.
2. **Search box** (top, debounced): matches party name, bill/receipt number, entry number, ledger name, amount
   (typed as `481.65` or `481`). Filters rows; the group subtotals follow the filter.
3. **Filter chips**: kind (Sales · Receipts · Purchases · Payments · Expenses · Returns · Other — from `source.kind` /
   `event_type`), tender (from `source.how`), counter (`source.counter`), person (`source.by`). Chips appear only for
   values present in the range; tap to toggle; several may be on; a lit chip reads like the counter's Today chips.
4. **Group by: Day · Week · Month** (a three-way control beside the dates; Day default). Each group has a head row:
   `Wed 01 Oct · 5 entries · Dr ₹6,909.34 · Cr ₹6,909.34 · Sales ₹6,423.52 · Cash ₹1,433.07 · On credit ₹5,476.27`
   (from the entries' own lines/`source`); groups collapse too. Week = Mon–Sun with the ISO week number; Month = the
   fiscal month name.
5. **Keyboard**: ↑ ↓ move the highlighted row, Enter expands/collapses, Esc closes an open sheet. **Export**: a
   `Download CSV` button for the shown rows (date, no, kind, party, ref, how, counter, by, dr, cr, gist) — client-side.
6. Phone: rows become cards; the gist wraps; chips scroll horizontally in one row; `scrollWidth === 390`.

## Proof (exit codes; commit outputs)
- `e2e/books-web.cjs` extended (stand-in has 5 entries across 3 days incl. a walk-in day and a receipt): collapsed by
  default with the gist figures equal to the lines' sums; expand one / all / collapse all; search by amount and by
  party; a kind chip and a tender chip filter and the group head subtotals change; Week and Month grouping heads;
  keyboard ↑↓ Enter; CSV has one line per shown row; phone width.
- `e2e/books-web-breaks.cjs`: `BREAK_ONLY=VIEW` group — gist recomputed from a second formula (must be caught),
  filter ignored, collapse-all leaving one open; restore from a COPY.
- `node scripts/check-syntax.js`, `node scripts/check-app-parses.cjs`, `node e2e/books-web.cjs` → 0.
- Screenshots `e2e/shots/daybook-{collapsed,expanded,week,phone}.png`.

## Do not touch
`public/till.html`, `e2e/till-*`, `public/engine/*`, the API, SQL, `public/app/*` other than `cap-books.js` (and
`chit-sheet.js` only to call it). Commit messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
