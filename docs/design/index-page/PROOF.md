# Index page — the proof run (2026-10-01, branch `cloud/index-page`, Windows 11, local)

Every check by exit code, on the tree this branch ships. Screenshots taken by the harness are committed under
`e2e/shots/` (`index-laptop` · `index-phone` · `index-alerts` · `index-all-well` · `ledgers-bands`).

| check | exit | tally |
|---|---|---|
| `node scripts/check-syntax.js` | 0 | every inline script parses |
| `node scripts/check-app-parses.cjs` | 0 | all parse |
| `node e2e/index-page.cjs` | 0 | 58 passed, 0 failed |
| `node e2e/index-page-breaks.cjs` | 0 | 15/15 breaks caught (restored from a copy, never `git checkout`) |
| `node e2e/books-web.cjs` | 0 | 83 passed, 0 failed — the Ledgers view changed; + the actor-switch check below |
| `node e2e/books-web-breaks.cjs` | — | every one of the 32 breaks caught on this machine (see the note) |
| `node e2e/a11y-contrast.cjs index.html` | 0 | 15 checks, WCAG AA — page mode (new) |
| `node e2e/a11y-contrast.cjs` | 0 | 575 checks — default mode unchanged |
| `node e2e/cb-build-guard.cjs` | 0 | CB_BUILD bumped for cap-books.js |
| `npm run build` | 0 | `dist/index.html` is the new page (19.19 kB); `public/*` (till, app, labs, design pages) sit beside it at their own paths |

**The books-web-breaks note.** The first full run tallied 30/32: `the results band vanishes` matched no anchor
(CRLF working copy — the anchor carried a bare `\n`; made ending-agnostic) and `M10 download not remembered`
crossed the runner's 300 s per-run timeout on this machine (raised to 600 s; caught 1/1 alone). The third finding
was real and PRE-DATES this branch: `switch shown to an actor` ran GREEN with the break applied, on this branch
AND on clean `origin/main` — the harness only ever opened as the entity, so the flipped role gate was never
looked at. `books-web.cjs` now asks `businessSettingsHTML` as an actor; the break is caught (1/1). The clean
confirming re-run caught 15/15 (index) and 20/20 of the books breaks it had reached when the host stopped it for
system memory pressure; the 12 it did not reach were all caught in the first full run. Every break has therefore
been caught on this machine on this tree, across those runs.

The harness pattern is `e2e/books-web.cjs`: Playwright with a stand-in API answering inside the page and a static
server on an OS-assigned free port. Nothing reaches `localhost:3000`, port 7351, or the live site.

One deliberate deviation from the mock, not from the spec: the mock's `--ghost`/`--faint` captions measure
2.44:1 / 3.61:1 — under the WCAG AA pass mark in SYSTEM.md §4 — so those usages carry `--muted` (6.68:1).
The tokens themselves are copied unchanged (§2); `--ghost`/`--faint` stay on the decorative glyphs.
