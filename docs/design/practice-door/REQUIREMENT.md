# REQUIREMENT — the PRACTICE DOOR: one door for a CA's 150 clients (round CA1 · 2026-10-12 · design, no code)

**Status:** requirement + design. Nothing here is built. Pass mark for the screens: `docs/design/list-standard/index.html` +
`docs/design/SYSTEM.md` §2–3b (FROZEN look). Literature baseline: `docs/research/COMPARE-AU-BOOKS-2026-10.md` §2 (how Xero HQ /
Partner Hub, QBOA → Intuit Accountant Suite and MYOB Practice do it), §3 (the UX patterns and the complaints behind them), §5.2
(the must-match list). Every figure on every screen names the code that computes it today, or says **MISSING**. Nothing is invented.

Shape already decided (owner, 2026-10-12): a PRACTICE (the CA firm) is an entity; each CLIENT GRANTS the practice access — consent,
revocable, by access level (role ≠ access: `api:lib/access.js` viewer · commenter · editor); a PRACTICE DASHBOARD across all
clients; open any client's books in one click with the practice's own staff; MOVE IN from Xero / QuickBooks (round IM1, later).

Reuse search done first (CLAUDE.md rule 1): `docs/SEAMS.md` + grep over `api:lib/` for `viewer|commenter|editor|access_level|
whole_entity|access_events|person-session|entity_kind|last_check|todo|periodAdvice|packs|basPeriods`. What exists is named in §4 and §6;
what does not is marked MISSING with the evidence. §11 lists every new path and why nothing existing served.

---

## 1 · Who (users) and what they come for (jobs)

| User | Who they are in the IAM | Jobs, in the order they do them |
|---|---|---|
| **Practice owner** (the CA, a registered tax/BAS agent) | the PRACTICE entity's owner (`identity_type = 'entity'`, a new `entity_kind = 'practice'` — MISSING, §11) | see all clients in one list ranked by trouble · open one client's books · verify ("Audit me") · ask the client · lock a month / adjust (editor) · prepare the BAS figures · accept or end a client · manage staff |
| **Practice staff** (bookkeeper, junior) | an actor of the practice entity (`identities.parent_entity_id = practice`, `access_level`, `whole_entity` as today, `api:migrations/b173_access_level.sql`) | the same list, only the clients they are put on · open · ask · do the month-end work the grant allows |
| **Client owner** (the shop) | the CLIENT entity's owner — the only one who may grant or revoke | invite / accept the practice · pick the level · see who opened the books and when · answer a query · revoke |
| **Client staff** | the client's actors, unchanged | see nothing new except a query addressed to the team (internal thread) |
| **The server** | — | decides every may / why; the practice page paints what it is handed (`CBRail.WHY`, `engines:src/rail.js`) |

A practice is NOT a network root and NOT a branch: `whole_entity` stays entity-scoped (b173 §"IAM-SPEC §28 parked"); the grant is
a new, separate, consented edge between two entities (§5), never a path re-root. A practice may also be a client of another practice
(a bookkeeper's firm reviewed by a CA) — the same edge, the other way; nothing special.

---

## 2 · The screens (practice side: `public/practice.html` — the CB Accounts skeleton, sidebar + full-width main)

The page is `accounts.html`'s skeleton (sidebar · pinned header · CBAvatar · CBKural) with its own four sidebar items. Every list is a
`CBList` mount (`public/app/list-ctl.js`); a row's next level opens the way Task's Group sum does (expand); a record opens the existing
sheet. No new rows, cards or expanders drawn by the page (CLAUDE.md rule 5). Icons: words for now (ICON-MAP: "CB Accounts and CRM
screens: a later round").

| # | Screen | What it is | Reuse |
|---|---|---|---|
| S1 | **Clients** (home) | the dashboard: one CBList row per granted client, three shown columns + the rest in ⚙ (§6), notice chips in the title row for the count of clients in trouble, expand a row for that client's alerts ("Audit me", §7) | `CBList` · title-row chips (`cbl-chip warn/bad`) · expand (`next`) · ⬇ CSV · search · Filters ▾ (state · due · staff) · sort |
| S2 | **A client's books** | the client's own CB Accounts (`public/accounts.html`, `public/finance.html`) opened AS the practice person, with a strip at the top "You are in ‹client› as ‹practice› · ‹level›" and a way back | the pages as they are; the strip is the `top` bar's `.shop` slot; level sentences are `CBRail.WHY` |
| S3 | **Queries** | every open question to any client, one CBList: client · what · due · answered? ; a row opens the thread | `CBThread` (`public/app/rail-thread.js`) — the ONE composer, never a second messaging path |
| S4 | **Staff** | who is in the practice and which clients each may open | `public/employees.html` as it is for people + level; the per-client assignment is the ONE new field (§11, later phase) |
| S5 | **Settings › Practice** | the practice's name, ABN, agent number, the invite handle, the plan | the Profile / Settings sections pattern (left set · right selected) |

### The client side (inside the client's CB Accounts, no new page)

| # | Screen | What it is | Reuse |
|---|---|---|---|
| C1 | **Setup › Your accountant** | one card: the practice (name · ABN), the level in one sentence, since when, who accepted, who from the practice opened the books in the last 30 days, two buttons: *Change level* · *Remove access*. Nobody yet: "Invite your accountant" with a handle box (the empty state `api:lib/sides.js:143` already names) | the Settings card (`accounts.html .card`), the access level words `api:lib/people.js accessWords`, the audit list `GET /api/actors/access-events` pattern |
| C2 | **An invitation** | a row on the To-do home: "‹practice› asks to see your books › Accept / Decline" with the level they ask for and what it means | `GET /api/books/todo` rows (`api:lib/books-todo.js`) — one new kind `practice_invite` (§11) |
| C3 | **A query** | a To-do row "‹practice› asked about ‹bill› › Answer" opening the chit's internal thread | the Replies screen (`public/app/cap-messages.js`) + `CBThread` |

Phone (390 px): S1 rows become one card per row (CBList's container query); the strip in S2 is one line; C1 is the card as is.

---

## 3 · The grant — consent lifecycle as states

The grant is the ONLY thing that lets a practice person into a client's books. It is an edge between two entities, carries ONE access
level, and is moved only by the acts below. Every move writes one event row (the `api:lib/access-events.js` pattern: before · after ·
who · why). All states are per (practice, client) pair; one pair holds at most one live grant.

```
            practice invites  ─────────────┐            client invites (by handle)
                                            ▼                      │
   (none) ──────────────────────────► INVITED ◄────────────────────┘
                                        │ │ │
             client owner accepts       │ │ └── 14 days pass ──────────────► EXPIRED  (same as none; may re-invite)
             (picks the level)          │ └──── client declines ───────────► DECLINED (same as none; the practice sees "declined")
                                        ▼
                                     ACTIVE ◄──── client changes the level (stays ACTIVE; an event row says from → to)
                                        │ │
             client revokes ────────────┘ └───── practice ends the engagement
                                        ▼                       ▼
                                     REVOKED                  ENDED
```

| State | Who moves it | What the server does | What the client sees | What the practice sees |
|---|---|---|---|---|
| **INVITED** | the practice (by the client's handle or e-mail) OR the client (Setup › Your accountant, by the practice's handle) | writes the grant row `status = invited`, `level_asked`, `invited_by` (the PERSON, not the node — DESIGN-NOTES 2026-10 §1.1 Q5 names that loss); an OTP-less notice through the channels that exist (`api:lib/notify.js sendEmail`; WhatsApp when `whatsapp-out.canSend()`) | To-do row C2 with the level in words | the client row in S1 greyed "Invited · waiting", no figures |
| **ACTIVE** | the client OWNER accepts (an actor cannot: consent is the owner's act — COMPARE §2.4 point 1) and picks the level | `status = active`, `level`, `accepted_by`, `accepted_at`; from now `ops.f_practice_clients(practice)` lists the client (§8) | C1 card filled; every open of the books by a practice person is listed there | the row fills with figures on the next nightly check (or at once through *Check now*, `POST /api/books/check`) |
| **REVOKED** | the client owner, any time, one button, no reason needed | `status = revoked`, `revoked_by`, `revoked_at`; every practice session into this client is refused within 60 s (`api:lib/person-session.js` CACHE_MS rule, §8) | the card says "Removed on ‹date›"; *Invite again* | the row says "Access removed ‹date›", figures frozen at the last check, greyed |
| **ENDED** | the practice (owner or an editor) | as REVOKED, `ended_by` | "‹practice› ended the engagement ‹date›" | the row leaves the list (Filters ▾ Ended shows it) |
| **DECLINED / EXPIRED** | the client / 14 days (Xero's invite life, COMPARE §2.1) | `status`, the date | nothing further | greyed row with the word |

Rules that hold in every state:
- **Consent is the client's act, revocable, role-scoped** (the standard all three incumbents share — COMPARE §2.4). The practice never
  self-serves a level; it may only ASK for one (`level_asked`), the client sets it.
- **Revocation is immediate and total.** No "pending removal". What the practice already posted stays — the ledger is insert-only
  (`api:migrations/b273_books_journal.sql`), every entry carries who (`app.current_actor`), so nothing is lost by removing access.
- **A level, not a role.** Viewer reads · commenter reads and asks the client (the client's INTERNAL thread) · editor also changes
  records. The exact ladder of `engines:src/rail.js byLevel` — no new word. On screen the sentence is the model's own
  (`api:lib/access.js PRESETS[].why` style): "Reads everything. Says nothing." · "Reads everything and can ask you questions."
  · "Can post entries, lock months and ask you questions."
- **Costs:** the practice sees cost and margin only when the grant says so (`can_see_costs` on the grant, the `api:lib/cost.js` gate),
  default **yes** for a practice (a CA must see margin) — the client may switch it off on C1.
- **The effective level of a practice PERSON in a client = min(grant.level, person.access_level)**: a viewer-level junior stays a viewer
  in an editor-granted client. One rule, in `access.js` (widened, with a test) — never in a route.

---

## 4 · What a client sees and can revoke (the client's rights, in one place)

| The client sees | Where it comes from | Can revoke / change |
|---|---|---|
| who the practice is (name · ABN · agent number) | the practice entity's header (`GET /api/entities/header`, `api:lib/entity-header.js`); ABN checked by `engines:src/reg-au.js abnCheck()` | — |
| the level, as one sentence, and whether costs are shown | the grant row | **yes**: change level, costs on/off (an event row each time) |
| since when, who accepted | `accepted_at`, `accepted_by` (a person's display name) | — |
| every open of their books by a practice person: who · when · from which device | the grant's open log (§11: `practice_open` rows, the `signin_events` idea of M06) | — (a record, not a switch) |
| every entry the practice posted | the Day book as today: `by` is the person (`app.current_actor`), the audit trail (`books_change_log`) | — (insert-only; a wrong entry is reversed, never deleted) |
| every query the practice asked | the chit's internal thread (`CBThread`) | — |
| the grant's history | the grant event rows | — |
| **Remove access** | one button on C1 | **yes**, immediate |

What the client does NOT see: the practice's other clients, the practice's staff list, the practice's notes about them (a practice
"internal" note is the PRACTICE entity's own internal thread, never written into the client's books — §9).

---

## 5 · The dashboard (S1) — every column, every number's source, every alert's rule

Shown columns (SYSTEM §3 rule 7: three; the rest in ⚙): **Client · Books · Next due**. Every figure is READ from the client's stored
check; the practice page computes nothing. Money in minor units (AUD cents), painted by the M36 money unit; balances in Dr/Cr words.

| Column | What it shows | Where the number comes from TODAY (file:function) | Gap |
|---|---|---|---|
| **Client** | name · ABN (⚙) · entity type (⚙) | `identities.display_name`; ABN: MISSING — identity is GSTIN-shaped (`api:lib/tax-lines.js`), the AU pack adds the ABN slot (AU1); entity type: `ENTITY_BASES_AU` keys (`engines:src/reg-au.js`) | ABN field = AU1 |
| **Books** | one word + a count: **Up to date** · **n to do** · **Off** · **Can't tell** | the client's To-do feed `api:lib/books-todo.js todo()` (`GET /api/books/todo` — bills_to_accept · months_not_locked · closing_stock_missing · gst_due · recurring_due · accrual_reversals_due · year_close_possible); `Off` = `books_setting.enabled = false` (`GET /api/books/health` → 404); `Can't tell` = no check stored yet (`last_check` null) | the feed exists per shop; the CROSS-client read is MISSING (§8) |
| **Next due** | the nearest statutory date and its label: "BAS Q1 · 28 Oct" · "Lock Sep" | AU: `engines:src/reg-au.js basPeriods({ frequency, fy })[].due` (statutory; a weekend/holiday or an agent's lodgment-program date needs a calendar the pure file does not have — say "statutory" on hover); months: `api:lib/books.js periodAdvice()` via `GET /api/books/periods` | `books-todo.js gst_due` reads the IN engine's `gst-returns.dueDate` — needs the pack's own due (AU1 widening, not a copy) |
| Bank (⚙) | **Reconciled to ‹date›** · **n bank lines not in the books** · **Can't tell** | MISSING on the server: reconciliation runs IN THE BROWSER and the statement is never uploaded (`web:public/app/cap-bank.js` header; the match is `engines:src/bank-recon.js match()` → `unmatched_stmt[] · unmatched_ledger[] · ambiguous[]`). Nothing stores the result. | §11 new key: the client's device posts the SUMMARY only (counts + statement end date), never the lines |
| TB (⚙) | **Balances** · **Off by A$x.xx Dr/Cr** | `api:lib/books.js trialBalance()` → `engines:src/ledger.js trialBalance()`; the nightly check already recomputes balances and names mismatches: `api:lib/books-nightly.js check()` → `books_setting.last_check.problems[]` | stored per shop already; cross-client read MISSING (§8) |
| Anomalies (⚙) | a count; the row expands to the list (§7) | `last_check.problems[]` (nightly) + `health.waiting[]` (posts that could not post, `api:lib/books-hooks.js waitingRow`) + manual entries this period (series MJ, `api:lib/books-manual.js` — SA 240 "manual journals tested first") + suspense not nil (`LINES_AU.suspense` "must be nil at close") | the four reads exist; the COUNT as one stored number is MISSING (§8 widens the nightly) |
| Months (⚙) | **n not locked** · the oldest | `periodAdvice()` rows with status open and end < today (`books-todo.js months_not_locked` counts exactly this) | — |
| Packs (⚙) | last pack · acknowledged? | `GET /api/books/packs` → `acknowledged_at`, `sha256`; the chain is verified by `engines:src/bookpack.js verify()` | — |
| Queries (⚙) | open · overdue | messages with `msg_type = 'query'` and no answer, by `due` | MISSING: no query kind, no due date, no answered flag (§9) |
| Access (⚙) | the level word · since | the grant row | new table (§11) |
| Last activity (⚙) | the last entry's date | MISSING as a stored figure: the Day book has it (`books_entry` max date); the nightly can store it (§8) | §8 |
| Staff (⚙) | who at the practice is on this client | §11, later phase | — |

### The alerts (title-row chips, and the amber/red on a row) — each with its rule

Only a failing thing earns a chip (SYSTEM §3 rule 1); all fine = one line "✓ 150 clients, all up to date". Every chip is a filter.

| Chip | Rule (read, not computed on the page) | Colour | The button it carries |
|---|---|---|---|
| **n BAS overdue** | `basPeriods().due < today` and the period's GST close not posted (`api:lib/books-period.js settledAsOf` / the `gst_due` to-do kind) | red | *Open* (the client's GST close & pay screen, `web:public/app/cap-period.js peGstClose()`) |
| **n BAS due in 7 days** | `due − today ≤ 7` | amber | *Ask client to lock the quarter* (a bulk query, §10) |
| **n not reconciled** | bank summary older than 35 days OR unmatched bank lines > 0; "Can't tell" clients are NOT counted here (three answers, never collapsed) | amber | *Ask for the statement* (bulk query) |
| **n TB off** | `last_check.problems[]` has a balance mismatch | red | *Open* the client's Trial balance |
| **n months not locked** | `months_not_locked.count > 0` for months ended ≥ 14 days ago | amber | *Ask client to lock* |
| **n waiting** | `health.waiting.length > 0` (posts parked with a reason) | amber | *Retry* (`POST /api/books/outbox/retry`, owner-only today → the grant's editor may call it, §11) |
| **n queries overdue** | query `due < today` and unanswered | amber | *Open Queries* (S3) |
| **n invitations waiting** | grants in INVITED older than 3 days | grey | *Remind* |
| **n ledgers off** | `books_setting.enabled = false` | grey | *Ask client to switch the Ledger on* |

Row colour = the worst chip that applies to it. A row with nothing applying is plain.

---

## 6 · "Audit me" — the per-client list the row expands to (S1 next level)

The client's own To-do feed (`GET /api/books/todo`: each row already carries `{ kind, count, words, action }` — the page paints the
same rows) **plus** the checks a CA wants that a shopkeeper is not shown, each a read of what the nightly already keeps:

| Line | Source | Fix button |
|---|---|---|
| every To-do row of the client | `api:lib/books-todo.js todo()` | the row's own `action` (opens that screen in S2) |
| "Balances recomputed from the lines differ: ‹account› by A$x.xx" | `last_check.problems[]` (`books-nightly.js check()` — named, never auto-fixed) | *Open the ledger* |
| "n entries could not post: ‹reason›" | `health.waiting[]` | *Retry* |
| "n manual entries this quarter (MJ)" | `books-manual.js` series MJ, filterable | *List them* |
| "Suspense A$x.xx — must be nil at close" | TB line for role `suspense` (`LINES_AU`) | *Open* |
| "Last pack ‹month› not acknowledged" / "No pack since ‹month›" | `GET /api/books/packs` | *Build pack* (`POST /api/books/packs`, owner-only today → editor grant, §11) |
| "Pack chain broken at ‹month›" | `engines:src/bookpack.js verify()` over the stored manifests | *Open* |
| "Bank: reconciled to ‹date›; n lines not in the books" | the stored bank summary (§11) or "Can't tell — the client reconciles on their device" | *Ask for the statement* |
| "GST: Q1 figures — G1 A$… · 1A A$… · 1B A$… · net A$… (statutory due 28 Oct)" | `engines:src/reg-au.js bas({ period, simpler }, rows)` — read from the POSTED ledgers, nothing recomputed from invoices | *Open GST close & pay* |

"Audit me" is a READ of what we keep (COMPARE §5.1 point 3): hash-chained packs, rule version on every posting, nightly recompute
that reports. No new calculation anywhere in this list.

---

## 7 · Opening a client's books in one click (S2) — how the server lets a practice person in

Today one token = one shop (`api:middleware/auth.js entityOf = parent_entity_id || identity_id`); a co-assist's RLS runs AS the shop with
the person stamped as `app.current_actor` (`runWithActor`). The practice door reuses exactly that: a practice person opening a client
gets a **client-scoped person session** — entity = the client, actor = the practice person, level = min(grant, person) — minted from the
grant, bound to the device and listed under it (`api:lib/person-session.js`: jti · device_id · surface · life), so it is revocable and
dies within 60 s of a revoke. One new route does it (`POST /api/practice/clients/:client_id/open`, §11); after that every existing
books route answers as it does for any co-assist, RLS unchanged (no cross-entity branch — the thing DESIGN-NOTES §1.2 item 2 feared is
avoided by NOT widening RLS: the session simply IS the client, as a co-assist's is).

Each open writes one `practice_open` row (who · client · when · device) — the "who opened my books" list on C1.

---

## 8 · The cross-client read (what makes 150 rows one query)

RLS is per entity; the dashboard must not run 150 × 5 reads (BRIEF-RULES 4: no per-row queries). What exists: the nightly
(`api:lib/books-nightly.js runAll()`) already visits every ledger-on shop through ONE cross-shop id read (`ops.f_books_enabled()`,
SECURITY DEFINER, b272) and stores `books_setting.last_check` per shop. So:

1. **Widen the nightly's stored result** (additively, with a test): `last_check.summary = { todo: n, todo_kinds: {…}, months_not_locked,
   tb_ok, waiting, manual_entries_period, last_entry_date, packs: { last, acknowledged }, bank: { to, unmatched } | null }` — every
   value a read the nightly already makes or a count of it. Dictionary entry in `api:docs/FIELDS.md` in the same change.
2. **One SECURITY DEFINER read for the practice**: `ops.f_practice_clients(practice_entity_id)` → one row per ACTIVE grant with
   `display_name`, the grant's level, and that shop's `last_check.summary` + `periods` status. The route `GET /api/practice/clients`
   is one trip. The `basPeriods` due is pure (no read).
3. *Check now* on one row = `POST /api/books/check` through the client session (exists; owner-only today → editor grant).

Nothing recomputed on the practice side. A number on the dashboard is the SAME number the client sees on their own To-do home
(SYSTEM §3 rule 11).

---

## 9 · Queries to the client — reuse CBThread, never a second messaging path

A query is **a message on the client's chit, in the INTERNAL thread, `msg_type = 'query'`**, posted by the practice person through the one
composer (`CBThread.mount` / `CBThread.send`, `POST /api/chits/:chit_id/messages`). The client's team answers in the same thread from
their own login (the Replies screen). The access ladder already fits: a commenter may post internally (`engines:src/rail.js byLevel`,
`api:lib/access.js canMessage`), a viewer may not — so a viewer-level practice person sees the thread and the sentence
`CBRail.WHY.read_only`, exactly as an auditor does today.

What is missing (small, additive): `msg_type = 'query'` as a known kind with **`due`** (a date) and **answered** (the first reply by a
client person closes it) — a dictionary entry on the message row, and the S3 / C3 lists read it. No new table.

**The open decision (COMPARE §5.3 Q4):** a chit anchors the thread, but a bank line, a manual MJ entry or "the September close" is not
a chit. Two ways, one must be chosen BEFORE CA2: (a) widen the messages route to accept a ledger entry as the subject (`entry_id` beside
`chit_id`; the thread list and RLS as today) — one shape, more subjects; (b) mint ONE "practice" chit per client per period (a message-
type chit, kind `review`) that every non-chit query hangs on, with `line_id` = the entry reference. (b) needs no route change and keeps
"a query is on a chit" literally true; (a) is cleaner for the audit trail. Recommendation: (b) for phase 1, (a) when disputes need it too.

---

## 10 · Bulk work (phase 1 = one thing)

| Bulk action | What it does | Reuse | Phase |
|---|---|---|---|
| **Ask n clients** (select rows → one template → one query each) | the same text posted as a query to each selected client's review chit (§9b), each its own thread with its own due date | CBList `bulk` + `CBThread.send` in a loop, one `CBAction.run` per client (busy · one press one write · the outcome said per row) | 1 |
| **Build packs** for selected clients for a period | `POST /api/books/packs` per client through the client session | the pack route; editor grant | 2 |
| **Check now** for selected | `POST /api/books/check` per client | exists | 2 |
| **BAS figures for the quarter, all clients** | one CSV: client · G1 · 1A · 1B · net · due (read from `reg-au.js bas()` over each client's posted ledgers; the nightly stores the quarter's labels in `summary`) | CBList ⬇ | 2 |
| **Lodge** | **never in this scope** — no SBR, no DSP registration (COMPARE §5.2 row 3). The honest button is *Copy BAS figures* for the agent portal | — | not planned |

Every bulk run reports per row (done · refused with the server's sentence · failed), never one toast for 150.

---

## 11 · New paths (each with why nothing existing served) and the dictionary entries they need

| New | Kind | Why nothing existing served |
|---|---|---|
| `entity_kind = 'practice'` | a value on `identities.entity_kind` (b157) | the kinds today are supplier · network · actor · shopper · internal · test (`api:lib/entitykind.js`); a practice is none of them and must never be a `network` branch (re-rooting the path would make `sameNetwork` true — DESIGN-NOTES §1.1 Q2) |
| `practice_grant` (table) + `practice_grant_event` (log) | migration `b299_practice_grant.sql` (api) | "No cross-business permission model": a connection is a status with no scope (`api:db/schema.sql:56-75`, `net01_network.sql`); one actor row = one shop (b173). Nothing holds a level between two entities. The event log copies the `access_events` shape (before · after · changed_by · reason) rather than adding a column to it, because its subject is an entity pair, not an identity |
| `practice_open` (table) | same migration | nothing records an open of the books by name (DESIGN-NOTES §1.1 Q5: `access_events` records access CHANGES only; `signin_events` is M06) |
| `GET /api/practice/clients` · `POST /api/practice/invite` · `POST /api/practice/clients/:id/open` · `POST /api/practice/clients/:id/end` · client side `POST /api/books/practice/accept` · `/decline` · `/revoke` · `PATCH /api/books/practice/level` | routes | no route today is called by an entity about ANOTHER entity's books; each says who may call it (the server decides): practice owner/editor for invite · end · open; the CLIENT OWNER only for accept · decline · revoke · level |
| `last_check.summary` | a new key under an existing stored object | the dashboard needs one stored number per fact per shop; `last_check` is where the nightly already stores per-shop results. Entry in `api:docs/FIELDS.md`: number — derived (counts of reads the nightly makes); written by `books-nightly.js check()`; read by `ops.f_practice_clients` / `GET /api/practice/clients` and the client's own health |
| `ops.f_practice_clients(uuid)` | SECURITY DEFINER function | the one cross-shop read, the `ops.f_books_enabled()` pattern (b272) |
| `books_setting.bank_summary` `{ to, unmatched_stmt, unmatched_ledger, at }` | a new key, written by the client's device after a reconcile (`cap-bank.js` posts counts only — the statement never leaves the device, as its header promises) | nothing stores a reconciliation; the practice cannot see it any other way without uploading the statement, which the design refuses |
| message `msg_type = 'query'` + `due` + `answered_at` | message row keys | messages exist; a query's due date and its answered state do not (COMPARE §4 row "Query-to-client thread") |
| To-do kind `practice_invite` | one more kind in `books-todo.js KINDS` | the client's invitation must appear where every other "needs you" row appears, with its button |
| `access.js effectiveLevel(grant, person)` | one function, widened in place | min(grant, person) must live in the ONE place that answers "what may this identity do" (the file's own header: eighteen places became one) |
| `practice_client_staff` (who at the practice is on which client) | table, **later phase** | `whole_entity` is entity-scoped by design (b173); a per-client reach is a new fact |

NOT new: the levels, the sentences, the sessions, the nightly, the To-do feed, the packs, the periods, the BAS labels, the list, the thread.

---

## 12 · Phase 1 vs later

| Phase 1 (CA2 → CA4) | Later |
|---|---|
| practice entity kind · grant table + routes + migration FILE · client-side accept / revoke card (C1, C2) | staff-per-client assignment (S4 column) |
| S1 with Client · Books · Next due · TB · Months · Packs · Anomalies (all from the nightly summary) · "Audit me" expand | Bank column (needs the device-posted summary) |
| open a client (client-scoped person session) · the strip · the open log | bulk Build packs · Check now · BAS CSV |
| queries on chits (§9b review chit) + S3 + C3 | query on any ledger entry (§9a) |
| Ask n clients (bulk query) | BAS prep view per client (figures + the agent-portal copy) · import from Xero / QBO (IM1) · pricing (`api:lib/plans.js` has no practice tier; COMPARE §5.3 Q5) |
| AU dates from `reg-au.js basPeriods` (statutory) | holiday / agent-program calendar for due dates |

Out of scope, said plainly on the screen when a CA looks for it: bank feeds, STP payroll, ATO lodgement (COMPARE §5.2 rows 1–3).

---

## 13 · Copy (shopkeeper words; what happened · what it means · what to do)

- Client: "Harbourline Accounting asks to see your books. They would read everything and could ask you questions. › Accept · Decline"
- Client, after: "Harbourline Accounting can read your books and ask questions · since 3 Oct · accepted by you" · *Change* · *Remove access*
- Practice, a row: "Bondi Surf Supplies · 3 to do · BAS Q1 28 Oct" ; expanded: "September not locked › Ask to lock" · "2 bank lines not in the books › Ask for the statement"
- A refused action, greyed, with the sentence: "Your access is view-only. You can read this chit but not change it." (`CBRail.WHY.read_only`)
- Never: "accounting", "books of account", a raw error, a number without its date.
