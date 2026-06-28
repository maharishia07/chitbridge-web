# PANEL-FIXES — task-panel divergences (HELD, branch `feat/panel-fixes`)

**Status: SPEC only, no code yet** — held for review + backend deps. Web repo `chitbridge-react`,
file `public/app.html` (1881-line monolith; can't unit-test here — implement carefully, eyeball in browser).
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

## Build order (all HELD until reviewed; nothing pushed)
1. Backend first (api batch): restore endpoint (`baseline-11`) + `chit_reads` migration + inbox unread + mark-read.
2. Then frontend (this branch): badge, bulk-assign, actor-id, restore wire, row unread colour.
