# Messaging standard (task panel, compose, and every panel)

One consistent behaviour for feedback across all panels. Three pieces:

## 1. In-flight feedback + double-fire guard — automatic, in `app/core.js`
Every panel calls `api()`, so this is uniform with zero per-handler code:
- A slim top progress bar (`#netbusy`) shows whenever any request is in flight → the "action is being
  performed" cue, everywhere.
- A **double-fire lock**: a repeat of the SAME in-flight mutation (same endpoint+params) is rejected with
  "Already working on that — one moment." GETs are never locked (loaders/refreshes stay free).

## 2. The message catalogue — `MSG` in `app.html` (single source of copy)
**All user-facing action/feedback strings live in `const MSG` (just below `toast()`).** Edit copy there,
once. Handlers call `MSG.x(...)`. Contextual params: `code` = chit code (e.g. "PO #4471"), `who` = actor.
Failures go through `MSG.fail(verb, err)` → "Couldn't <verb> — <reason>" (reason cleaned by `friendlyErr`).

Convention by channel (kept as-is, only the text is standardised):
- **Row / icon actions → `toast(...)`** (success + `MSG.fail`).
- **Form actions → inline `err.textContent`** (validation + submit error).

## 3. Status (2026-06-28) — COMPLETE
**Every panel is routed to `MSG`** (0 generic `Failed:`/`failed:` toasts remain; 37 catalogue entries):
task panel (assign, bulk, push-back, status, advance, dispute, delete+Undo/trash, restore, priority),
compose (draft/bridged, schema-default banner, catalogue load-error vs empty), disputes (resolve),
suppliers, catalogue, co-assists (shift), profile/settings, all `net*`, connections, and messages
(send — external/internal/empty).

**Authored copy added:** `todo()` placeholders → `MSG.comingSoon(label)`; silent stops now nudge —
recipient/self caps (`MSG.capHit`, `MSG.alreadySelf`), no-pick line item (`MSG.pickItemFirst`),
empty message (`MSG.msgEmpty`).

To change any wording: edit the string in `const MSG` (app.html) — one place, every panel updates.

## Review me
Open `MSG` in `app.html` to read/adjust every string in one place. After copy is confirmed, finish
routing the "not yet routed" handlers above and add the authored-copy items.
