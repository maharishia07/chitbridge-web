# Task Panel — app.html module split (in progress)

`app.html` is the **canonical frontend** going forward. To keep it from becoming one
unmaintainable file, it is being split into modules that all share **one client + one
response envelope**. Classic scripts (shared global scope) so the existing inline
`onclick="…"` handlers keep working — no framework, no build step.

## Done
- **`core.js`** (module 1) — the shared client: `fill()`, `unwrap()` (the `{ok,data,error}`
  envelope), `api()` (auth header + `401`→re-auth / `422`→validation / `500`→generic).
  Loaded by `app.html` before its main script. **Every panel calls `api()`; no panel does its
  own fetch or per-feature unwrap.**

## Plan (extract incrementally, verifying each step — never break the live app)
- `core.js`            — client + envelope (✅ done)
- `helpers.js`         — generic render helpers (`esc/opt/scr/scrErr/val`) + mappers (`mapApiChit/Msg/Actor`)
- `panel-task.js`      — inbox / chit detail / messages / assign / advance
- `panel-compose.js`   — compose chit + add actor
- `panel-disputes.js`  — disputes queue + resolve
- `panel-relations.js` — network / suppliers / catalogue
- `panel-admin.js`     — profile / settings / MIS / co-assists
- `app.html`           — markup + `<script src>` loads, in order, ending with the boot/route call

## Rule for new features
**one EP row + one mapper + one panel module** — nothing else. New panels land in this clean
pattern (shared client, single envelope) from the start.
