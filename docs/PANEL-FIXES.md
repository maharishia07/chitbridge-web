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

## Disputes panel — audit 2026-06-28
Traced raise (`quickDispute`/`confirmDispute` → POST `/chits/:id/disputes`), queue (`loadDisputes` → `/disputes/queue`),
resolve (`resolveDispute`/`submitResolve` → PUT `/:id/disputes/:disputeId/resolve`).

**Healthy / reflects baseline-8/9:** queue shows one-row-per-dispute (the cartesian fix) scoped to participants;
raise + resolve are messaged (`MSG.disputeRaised`/`disputeResolved`) and escaped; **resolve is raiser-only**
(`chits.js:1081`) and the panel correctly shows the Resolve button ONLY on "Raised by you"; resolution surfaces to
both sides via the notifications feed (state_log `dispute_resolved` → bell). Raise is transactional.

**FIXED now (api 34ffd5d):** dispute-resolve writes (update + state_log) wrapped in `withTransaction` (were separate).

**QUEUED (gaps):**
- **Targeted disputes not exposed in the UI** — the raise modal only does **chit-wide** (category + reason); the
  backend supports `target_entity_id` (scope `targeted`). On multi-party chits (CC/For) you can't dispute a specific
  party from the UI. Add a target picker.
- **No path for the TARGET to act** — resolve is raiser-only; "Against you" disputes have **no action** (view only).
  An abandoned dispute stays open forever and **blocks delete**. Design decision: add a target respond/acknowledge
  path, an admin/platform force-resolve, or an auto-expire — otherwise a deadlock is possible.
- Minor: the diagnosis/parity probe (`answerable`, one-sided vs two-sided) isn't surfaced in the panel.

## Catalogue panel — audit 2026-06-28
Traced backend `products.js` (CRUD) + web `loadCatalogue`/`addProduct`/`delProduct`; feeds Compose line items.

**Healthy (notably clean):** backend is **tenant-scoped** (`ctx(req)` from token; every CRUD filters `entity_id`;
UPDATE/DELETE check `WHERE item_id AND entity_id` → no IDOR), **schema-driven validation** (`validateItem`:
required + number/min), **soft-delete** (`is_active=false`), parameterized search, `safeErr`. Web is escaped,
messaged (`MSG.productAdded/Deleted`), with loading/empty/error states + name validation.

**QUEUED (minor / feature):**
- **No EDIT in the UI** — backend has `PATCH /:id`, but the panel only Adds + Deletes; can't edit a product
  (delete + re-add). Wire an edit.
- **Add form is minimal** — captures only `name` + `price` (no `unit`/other schema fields); if the entity's product
  schema requires more, create fails validation. (Also `unit` defaults to "unit" in Compose.)
- **Unbounded list read** (`GET /` has no LIMIT) — covered by the max-`?limit=` cap backlog item.
- **No catalogue-items quota** — products are unlimited (not in the subscription quota set); decide if they should be.
- Schema dependency: with no default `entity_schema`, validation is skipped (products added unvalidated) — same
  fresh-entity schema gap flagged in the Compose audit.

## Suppliers panel — audit 2026-06-28
Traced backend `relationships.js` (supplier list) + web `loadSuppliers`/`addSupplier`/`delSupplier`.

**FIXED now (api 522b400):** add-supplier resolved by **bridge_id only**, but the panel prompts "User ID or email"
→ adding by user_id/email 404'd. Now resolves by **bridge_id OR user_id OR email** (matches ATH-114) + clearer message.

**Healthy:** tenant-scoped (`owner` from token; all queries filter `owner_entity_id`); good validation (self-add 400,
duplicate 409, not-found 404); **IDOR-safe delete** (`WHERE supplier_list_id AND owner_entity_id`); `safeErr`; web
escaped + messaged + loading/empty/error. The supplier list is a **private bookmark** (no-consent, D-056) — adding X
does NOT grant access to X's data (that needs connections/chits), so no privacy issue.

**QUEUED (minor):**
- **No suppliers quota enforced** — `lib/plans.js` has a `suppliers` quota but it isn't checked on add (subscription
  enforcement is the broader backlog).
- `has_catalogue` is surfaced (nice) — could drive a "browse their catalogue" action later.

## Settings panel — audit 2026-06-28
Exposes exactly the 4 `entity_actor_settings` (`assignment_model`, `default_max_tasks`, `all_task_visible`,
`auto_return_on_short_break`). Structurally clean (escaped, scrErr, `MSG.settingsSaved`, backend `entity_id`-scoped + validated).

**Headline:** **all 4 are dead settings** — stored/saved but NOT enforced (see `ACTOR-SETTINGS-BEHAVIOUR.md`). The
panel lets a user toggle controls with **zero effect** — will read as bugs in testing. Decide: **wire them**, or
**label them "not yet active."**

**Also missing:** the settings that DO work have **no UI** — `self_copy_pref` (baseline-7) and
`dispute_handler_actor_id` (baseline-9) are backend-only. Add them to this panel.

**QUEUED:** wire the 4 settings (or label) · add self_copy_pref + dispute_handler UI · (future) subscription/plan + entitlement controls.

## Build order (all HELD until reviewed; nothing pushed)
1. Backend first (api batch): restore endpoint (`baseline-11`) + `chit_reads` migration + inbox unread + mark-read.
2. Then frontend (this branch): badge, bulk-assign, actor-id, restore wire, row unread colour.
