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

## 3. Status (2026-06-28)
**Wired to `MSG`:** task panel — assign, bulk-assign, push-back, status, advance, dispute, delete (+Undo/
trash), restore, priority (internal + customer); compose — draft/bridged, schema-default banner,
catalogue load-error vs empty.

**MSG entries ready, handlers not yet routed (do after copy review):** suppliers (`addSupplier`/`delSupplier`),
catalogue (`addProduct`/`delProduct`), co-assists (`actorShift`), profile/settings save, all `net*`,
connections. These still show their current working toasts; switching them to `MSG` is mechanical.

**Authored copy still to add** (needs words, not just wiring): placeholder actions calling `todo()`
(e.g. co-assist "Set engagement") → `MSG.comingSoon('Set engagement')`; silent returns (role caps,
`ccAddItem` no-pick) → brief toast.

## Review me
Open `MSG` in `app.html` to read/adjust every string in one place. After copy is confirmed, finish
routing the "not yet routed" handlers above and add the authored-copy items.
