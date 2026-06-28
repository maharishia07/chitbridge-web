# PANEL-FIXES — task-panel divergences (HELD, branch `feat/panel-fixes`)

**Status (2026-06-28): #1–#5 BUILT + Order-endpoint fix. All HELD, syntax-checked (`node --check`), demo untouched.**
- #1 bell badge → real `/api/notifications` count — DONE (web `7a8223a`)
- #2 bulk-assign → real `/api/chits/assign-bulk` picker — DONE (web `4a2ebf2`)
- #3 "Pull to me" → logged-in actor id from JWT — DONE (web `7a8223a`)
- Order panel → repointed to `/api/chits/sent` (+ stale EP markers) — DONE (web `89808d8`)
- #4 restore → backend `POST /:id/restore` (api `dcdecaa`) + delete **Undo** wired (web `1bdc94e`); Trash *browse* view QUEUED
- #5 per-actor unread → `chit_reads` + mark-read + `GET /unread` (api `31c6b48`) + row colour/dot (web `452f75b`)
- STILL QUEUED: Trash browse view; `mapApiChit` live-mapper enrichment (`proof:'ok'`/folder hardcodes, CC/For/att/msg/area, `/sent` dispute count). Needs `migration_chit_reads.sql` run.

Web repo `chitbridge-react`, file `public/app.html` (1881-line monolith; can't unit-test here — eyeball in browser).
Audited 2026-06-28. Full icon inventory lives in the api repo `docs/CB-SYNC.md`.

Four divergences found in the icon audit + one new model (per-actor unread, chosen by Athi).

## Fix 1 — 🔔 notifications badge is hardcoded `3`
- Where: `app.html:918` → `<span class="bdot">3</span>`.
- Intended: real count from `GET /api/notifications` (built, baseline-8/9). Show count; hide when 0.
- Approach: fetch notifications on load + the 20s auto-refresh, store count, render badge like the 💬
  `msgcdot` pattern (`app.html:917`, `unreadCount()`). Add `notifUnreadCount()`.
- Dep: none once baseline-8/9 deploys.

## Fix 2 — 👤 bulk-assign is a toast stub
- Where: `app.html:1525` (quickAssign multi-branch toasts instead of calling).
- Intended: `POST /api/chits/assign-bulk {chit_ids, target_actor_id}` (built, baseline-4).
- Approach: bulk actor-pick modal (reuse pickAssign's actor list) → call `EP.assignBulk` with selected
  ids + chosen actor; update the stale `EP.assignBulk` ok-marker; refresh rows.
- Dep: none (endpoint live).

## Fix 3 — ⤵ "Pull to me" hardcodes actor `'a1'`
- Where: `app.html:1631` `assignChit(id,'a1')`; demo also filters `c.assignTo==='a1'` (`:535`).
- Cause: `SESSION` (`app.html:596`) has NO actor-id field; `'a1'` is the DEMO actor id.
- Intended: pull to the LOGGED-IN actor.
- Approach: capture actor `identity_id` at actor login into `SESSION.actorId`; use it in `assignChit` and
  the `assigned_to==='me'` filter. Confirm `/api/actors/login` response shape first.
- Dep: actor login must return `identity_id`.

## Fix 4 — "Restore from Trash" is a stub
- Where: `app.html:1544` toast stub.
- Cause: `delChit` = `DELETE /api/chits/:id` (soft delete → sets `deleted_at`). NO restore endpoint exists
  (only `/unarchive` for `archived_at`, `chits.js:1307`).
- Dep: **NEEDS a new backend endpoint** `POST /api/chits/:id/restore` (clear `deleted_at` on caller's copy,
  mirror `/unarchive`). Add to the api batch (baseline-11), then wire the panel.

## NEW — per-actor unread + active row colour  (model chosen: PER-ACTOR, 2026-06-28)
Athi: when a chit moves to a different actor it must read as NEW/unread for that actor (active colour),
and new activity should re-flag unread. Read state is currently per-ENTITY and the row shows NO chit-unread.

- **Backend (api, next slice + migration):**
  - migration `chit_reads(chit_id UUID, actor_id UUID, direction VARCHAR(10), read_at TIMESTAMP,
    PRIMARY KEY(chit_id, actor_id, direction))`.
  - mark-read: when an actor opens a chit, upsert `chit_reads.read_at = NOW()` for (chit, actor, direction).
  - reset on movement: a chit is unread for actor X when there's activity AFTER X's `read_at` by someone
    else — on (re)assignment / status change / new message / dispute not done by X. Simplest: on assign to
    X, clear X's read row so it surfaces as new. **Confirm exact event set with Athi.**
  - inbox query: `LEFT JOIN chit_reads ON actor_id = caller`; unread = `read_at IS NULL OR activity_after`.
- **Frontend (this branch):** surface chit-level unread as a row colour/dot in `rowHTML` (`app.html:1628`)
  from the per-actor flag; reuse `.unreaddot` (`:206-207`).

## Order (sent) panel — investigation 2026-06-28
Traced the whole Order flow (`navTo('order')` → `loadList()` → `api("sent")` → `mapApiChit` → `rowHTML`).

**FIXED now (commit 89808d8):**
- **`EP.sent` pointed at `/api/chits/inbox`** (stale, pre-two-copy). Since inbox now returns only
  `direction='received'` (Task) copies, the live Order panel was fetching the WRONG copies. Repointed to
  the real `GET /api/chits/sent` (`direction='sent'`, baseline-4). Also corrected `rollup` (GET, not POST)
  and refreshed stale `ok:"○"` "not built/not mounted" markers (void/rollup/archive/assignBulk/notifications/
  priority are all built) so the test team isn't misled.

**QUEUED (live mapper gaps — `mapApiChit`, app.html ~1609; affects BOTH panels):**
- `proof:'ok'` is **hardcoded** → every live row shows "✓ both-signed" even when awaiting. Needs a real
  proof/both-signed signal from the API (or derive from `all_recipients` roles). **Misleading in testing.**
- `folder:'task'` is **hardcoded** → no visible effect today (no folder filter + `selfChit` unmapped), but
  latent: self-chit chip would mislabel an Order copy. Set folder from context when `selfChit` is mapped.
- Not mapped from the API: `selfChit`, `rcc`/`rfor` (CC/For chips), `att` (attachment count), `msg`
  (message count), `area`. So live rows are sparser than demo rows. Enrich the mapper + backend fields.
- **`/api/chits/sent` does not return `open_dispute_count`** (inbox does) → Order rows can't show the
  dispute badge. Small backend add to the `/sent` SELECT.

## Co-assists / Actors panel — audit 2026-06-28
Traced create (`addActorModal`/`submitActor`), roster (`loadCoassists`/`coActorCard`), shifts (`actorShift`),
login/PIN (`doLogin`), engagement.

**FIXED now (web 19f2bc2):**
- **Central toast XSS** — `toast()` rendered its message via `innerHTML` unescaped; many toasts interpolate
  API/user data (`MSG.assigned(code,who)`, party names, co-assist name). Now `esc()`-wrapped once inside
  `toast()` → closes XSS across **every** toast/MSG at the source. (The earlier esc audit missed toasts.)
- Co-assist create routed to `MSG.coassistAdded`.

**OK:** create modal + roster card escaped; loader has loading/empty/error (scr/scrErr); shift→MSG; login flow
messaged (actor-not-found, sign-in-failed); "Set engagement" is a documented placeholder (ATH-118) → comingSoon.

**QUEUED:**
- **No remove/offboard a co-assist in the panel** — the card only has Toggle-shift + Set-engagement, but the
  **backend already supports deactivate/remove/reactivate WITH task reassignment** (`actors.js` status-change,
  `task_action: pool|actor`). Wire a remove/deactivate action (with the pool-vs-reassign choice). Essential for real use.
- **Engagement / scoped grants** (view-only/act/audit/MIS, ATH-118) — whole model is a placeholder; ties to the
  permissions/"view-hat" + entitlements work. Big feature.
- Minor: `doLogin` inline error uses raw `e.message` (already api()-friendly); esc `L.err` in renderLogin opportunistically.

## Build order (all HELD until reviewed; nothing pushed)
1. Backend first (api batch): restore endpoint (`baseline-11`) + `chit_reads` migration + inbox unread + mark-read.
2. Then frontend (this branch): badge, bulk-assign, actor-id, restore wire, row unread colour.
