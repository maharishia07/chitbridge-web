# Cloud task — the gate's courtesy: another shop's unsent bills are a notice, never a block

**Outcome (one):** signing in as shop B in a browser whose counter still holds shop A's unsent bills (or is still
paired to shop A) **opens shop B**. A's unsent bills, A's counter copy and A's counter key are **kept untouched**; a
one-line notice names A and the count; the bills are sent the next time A's counter is opened online (the counter's
own sign-in already sends unsent bills before it switches shop). Athi, live, 2026-10-01: *"something pending from
another store, why it affects the current login … the courtesy message is some unsent bills are there, but the new
sign in must go."* This **narrows** the 2026-10-01 rule in the header of `public/app/one-person.js` ("do not allow the
shop to open until the browser is clear") for the COUNTER only — quote Athi's new sentence in that header.

**Branch:** you are on `cloud/gate-courtesy` (cut from `main`, this file is its only commit). Open a PR against `main`;
never push to `main`. **Pass mark:** `docs/design/SYSTEM.md`. Short strings; never "accounting".

## Where it blocks today (read these first)
- `public/app/one-person.js` `startClean()` (~264): `if (u[0]) return { ok:false, unsent… }` — refuses when any
  `cb-till*` queue has rows, because the wipe that follows (`dropDb` on every database, `cbKeys` on every `cb*` key)
  would destroy them together with the key that sends them.
- `traces()` (~171–197): `clean` is false whenever `counter` (the browser counter paired to another shop) is set —
  so the app gate in `public/app.html` (~3986–4035) and `index.html` (~423–436) stop even with NOTHING unsent.
- Read-only, to understand what to keep: how `public/till.html` names its stores (`cb_till_lastslot`, the slot's
  IndexedDB `cb-till-<sfx>` with stores `queue`/`kv`, `<slot>-queue-*` and `<slot>-kv-snapshot` in localStorage,
  `cb_till_key`, `cb_till_shop@<sfx>`, `cb_till_shopname@<sfx>`, `cb_till_counter_name@<sfx>`, `cb_till_entity`,
  `cb_till_name`). ⚠️ Memory of a real fault: a counter's queue is tied to its KEY — re-pairing once stranded bills.
  So a slot with unsent rows keeps its database, its localStorage rows AND the counter key/pairing keys.

## Build
1. **`traces()`**: a counter paired to another shop no longer makes `clean` false by itself. Return it as
   `notice: { ent, name, counter, unsent }` (unsent = that counter's queue count). Sessions, other tabs, drafts and the
   app outbox keep blocking exactly as today (they are app data that would act as the wrong shop).
2. **`startClean()`**: never refuses for counter queues. It computes the set of counter slots with unsent rows and
   SPARES them: their IndexedDB databases are not deleted, and the localStorage keys of those slots plus the counter's
   pairing keys (`cb_till_key`, `cb_till_lastslot`, `cb_till_entity`, `cb_till_name`, the `@<sfx>` keys of a spared
   slot) are not removed. Everything else is cleared as today. Resolves `{ ok:true, counter, kept:{ name, unsent } }`.
   A counter slot with NO unsent rows is cleared as today (nothing to lose).
3. **The Labs outbox stays a refusal** (`labUnsent`): it carries no shop and `combo-lab.html` drains it with whatever
   session is current, so keeping it would send A's saves as B. Leave that branch and its sentence as they are.
4. **The words** (one copy, in one-person.js; pages paint them): a notice, not an error —
   `"1 unsent bill for Mayuri Bhavan stays on this browser. It is sent when that counter is next opened online."`
   (plural form; no shop name → "another shop"). Shown once on the sign-in / gate screen and on the index page, no
   button needed (nothing to fix here), dismissible. `counterSentence` stops telling the person to go elsewhere first.
5. `public/app.html` and `index.html` paint the notice and carry on opening the shop. Bump `CB_BUILD` in app.html.

## Proof (exit codes; commit outputs)
- `e2e/one-person.cjs` — add scenarios (stand-in API on a free OS port, never localhost:3000, port 7351 or the live
  site; pattern: its §10 and `e2e/phone-signin.cjs`): (a) A's counter slot seeded with 1 queued bill (IndexedDB) and
  1 in the localStorage fallback → sign in as B → B's shop opens; the notice names A and says 2; A's database, queue
  rows, `cb_till_key` and `@<sfx>` keys are byte-identical before/after; B's own session is in place. (b) A paired,
  0 unsent → B opens, A's pairing is cleared as today, no notice. (c) Labs outbox non-empty → still refused, same
  sentence as today. (d) another shop's live session / other tab → still blocks as today. (e) after B's sign-in, open
  `till.html` against a stand-in accepting `POST /api/chits/send` with A's key → A's queue drains to 0 (proves the
  kept bills are still sendable; use the existing till harness helpers, do not edit till.html).
- `e2e/one-person-breaks.cjs` — break each new guard once (restore from a COPY): the spare-list empty (A's queue
  wiped), `cb_till_key` removed, the notice missing, the Labs refusal dropped, a 0-unsent pairing kept. Every break
  must be caught. **Write break anchors without `\n`** (or normalise CRLF first) — on a Windows checkout an anchor
  spanning a line end silently fails to apply.
- `node scripts/check-syntax.js`, `node scripts/check-app-parses.cjs`, `node e2e/one-person.cjs`,
  `node e2e/one-person-breaks.cjs`, `node e2e/index-page.cjs`, `node e2e/phone-signin.cjs`, `node e2e/labs-flow.cjs` → 0.
- Screenshots `e2e/shots/gate-courtesy-{signin,index}.png` (laptop) and `-phone.png` (390 px, `scrollWidth === 390`).

## Do not touch
`public/till.html` (vendored — the master lives in the API repo), `e2e/till-*`, `public/engine/*`, the API repo, SQL,
`e2e/tests/*.spec.js`. If `@playwright/test` is missing, install it outside the repo (do not add it to package.json)
and say so in the PR. Commit messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
