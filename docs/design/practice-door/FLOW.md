# FLOW — C2V · Client to verified (the practice door) — the PM1-style rows (round CA1 · 2026-10-12)

The machine form is in `docs/process/flows.json` (flow `C2V`; the guard `e2e/process-map.cjs` allows a MISSING row that names no file
and carries its evidence, so the rows are in). `docs/process/C2V.md` is the generated page; this file says WHY each row is as it is and
what each step will cite once built (the CA2/CA3 rows to fill in, so the map does not rot).

SAP picture: none — SAP has no "many clients, one accountant console"; the baseline is Xero HQ / Partner Hub, QBOA → Intuit Accountant
Suite and MYOB Practice (`docs/research/COMPARE-AU-BOOKS-2026-10.md` §2.4: consent is the client's act · a cross-client list with three live
signals · query threads anchored to a transaction · lodgement is a per-client queue · the tool is free).

Module: every step sits on **Accounts** for now — the thing seen and acted on is the client's Ledger. The module row **Practice**
(page `web:public/practice.html`) joins `modules[]` when the page exists (CA3); the guard checks a module's page exists, so it cannot
be added before.

```mermaid
flowchart LR
  S1["1. practice"] --> S2["2. invite"] --> S3["3. grant"] --> S4["4. dashboard"] --> S5["5. open client"] --> S6["6. query"] --> S7["7. revoke"]
```

| # | step | who | screen (file · function) | engine function | API route | chit kind | ledger entry | test | status today | evidence / what fills the row |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | practice | the CA firm (registers as an entity of kind practice) | — | — | — | none | none | — | **MISSING** | `api:lib/entitykind.js` declares supplier · network · actor · shopper · internal · test; `POST /api/entities/register` mints a shop. CA2: `entity_kind = 'practice'` (b299), `PATCH /api/entities/profile` carries ABN + agent number once AU1's identity slot exists. CA3: `web:public/practice.html` S5. |
| 2 | invite | the practice (by the client's handle) or the client owner (by the practice's handle) | — | — | — | none | none | — | **MISSING** | a connection is a status with no scope (`api:db/schema.sql` connections · `net01_network.sql` cb_edge); the only trace is the words "Invite an accountant" (`api:lib/sides.js`). CA2: `POST /api/practice/invite` → `practice_grant` status invited; the client's To-do kind `practice_invite` (`api:lib/books-todo.js`). CA3: C1's handle box; S1's greyed "Invited" row. |
| 3 | grant | the client OWNER accepts and picks the level | — | — | — | none | none | — | **MISSING** | no cross-business permission model (`web:docs/DESIGN-NOTES-2026-10.md` §1.2 item 2); one actor row = one shop (`b173`). The LEVELS exist and are reused unchanged: `api:lib/access.js levelOf`, `engines:src/rail.js byLevel`, the sentences `CBRail.WHY`. CA2: `POST /api/books/practice/accept` · `/decline` · `PATCH /api/books/practice/level`, `practice_grant_event` rows (the `access-events.js` shape), `access.js effectiveLevel()` = min(grant, person). Test: `api:tests/practice-grant.test.cjs`. |
| 4 | dashboard | the practice owner and staff (read) | — | — | — | none | none | — | **MISSING** | the per-shop facts exist and are stored: `api:lib/books-nightly.js check()` → `books_setting.last_check`; `api:lib/books-todo.js todo()`; `api:lib/books.js periodAdvice()`; `GET /api/books/packs`; `engines:src/reg-au.js basPeriods()` (statutory BAS due). No cross-client read (RLS per entity; `ops.f_books_enabled` is ids only). CA2: `last_check.summary` (FIELDS entry) + `ops.f_practice_clients(uuid)` + `GET /api/practice/clients` (one trip, budget line by hand). CA3: `practice.html` S1 = one `CBList` mount, `e2e/walk-practice.cjs`. |
| 5 | open client | a practice person, one click into the client's CB Accounts | — | — | — | none | none | — | **MISSING** | one token = one shop (`api:middleware/auth.js entityOf`); a person session is minted for the person's own shop only (`api:lib/person-session.js`). CA2: `POST /api/practice/clients/:id/open` mints a client-scoped person session (entity = client, actor = practice person, level = effectiveLevel), writes a `practice_open` row. CA3: the strip on `accounts.html` / `finance.html` ("You are in ‹client› as ‹practice› · ‹level›"), C1's "who opened" list. |
| 6 | query | a practice person (commenter or editor) asks; the client's team answers in its own login | `web:public/app/rail-thread.js` `mount()` · `send()` · `web:public/app/cap-messages.js` | `api:lib/access.js` `canMessage()` · `engines:src/rail.js` `byLevel()` | `POST /api/chits/:chit_id/messages` · `GET /api/chits/:chit_id/messages` (`api:routes/chits.js`) | a message on the client's chit, internal thread, msg_type query | none | `web:e2e/rail-thread-guard.cjs` · `api:tests/iam-access.test.cjs` · `engines:tests/rail.test.js` | ⚠️ built, gap named | the ONE composer and the ladder are reused as they are. Missing: `msg_type = 'query'` with `due` and `answered_at` (FIELDS entry); an anchor for a non-chit entry (REQUIREMENT §9 — owner decides a or b before CA2). CA3: S3 Queries list, C3 To-do row, bulk "Ask n clients". |
| 7 | revoke | the client owner (any time) or the practice (ends the engagement) | — | — | — | none | none | — | **MISSING** | nothing to revoke yet (step 3). The mechanism exists: a session is as alive as its listing, a revoke is refused everywhere within 60 s (`person-session.js` CACHE_MS); the ledger is insert-only, so what the practice posted stays, stamped by the person. CA2: `POST /api/books/practice/revoke` · `POST /api/practice/clients/:id/end` → every session minted from the grant delisted. CA3: C1's *Remove access* button, S1's "Access removed" row. |

## Where the flow touches the existing maps

- **R2R step 3 · month lock** and **step 4 · GST**: the practice's editor does these INSIDE the client's session — the same functions
  (`api:lib/books.js setPeriod`, `api:lib/books-period.js gstClose`), the same screens (`cap-books.js bkLockDo`, `cap-period.js peGstClose`).
  No new path. The owner-only gate (`owner` middleware on those routes) becomes "owner, or an editor-level practice session" — CA2 names
  each route it widens.
- **R2R step 6 · statements**: "a CA (the handover pack)" is already the `who`; the practice door reads the same pack
  (`GET /api/books/packs`, `engines:src/bookpack.js verify`).
- **H2P step 2 · access**: the practice's own staff get their level exactly there (`PATCH /api/actors/:id`, `access-events`).
- **O2C / P2P**: untouched — a query hangs on the chit those flows made.

## How the rows are kept true

A function built in CA2/CA3 replaces the "—" in its row in `flows.json` in the same PR (`node tools/gen-process-docs.cjs`, then
`node e2e/process-map.cjs` must pass with the api and engines checkouts beside this repo). A MISSING row that gains a file flips to
`ok` or `warn`; it never keeps a file AND the word MISSING (the guard refuses that).
