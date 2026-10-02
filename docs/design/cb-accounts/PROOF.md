# CB Accounts — proof (exit codes, 2026-10-01)

Run with Playwright 1.56 against the pre-installed Chromium. Every harness answers `/api/**` from a stand-in inside the page; nothing reached localhost:3000, port 7351 or the live site.

| command | exit | result |
|---|---|---|
| `node scripts/check-syntax.js` | 0 | PASS |
| `node scripts/check-app-parses.cjs` | 0 | all parse |
| `node e2e/books-web.cjs` | 0 | 119 passed |
| `node e2e/index-page.cjs` | 0 | 74 passed |
| `node e2e/one-person.cjs` | 0 | 68 passed |
| `node e2e/cb-accounts.cjs` | 0 | 162 passed |
| `node e2e/cb-accounts-breaks.cjs` | 0 | 24/24 breaks caught |
| `node e2e/index-page-breaks.cjs` | 0 | 15/15 caught |
| `node e2e/a11y-contrast.cjs public/accounts.html` / `index.html` | 0 / 0 | 16 checks each, 0 failures |
| `node e2e/dup-functions.cjs`, `ep-aliases.cjs`, `missing-functions.cjs`, `lazy-screen-guard.cjs`, `modal-safe-repaint.cjs`, `markup-balance.cjs`, `guard-static.cjs` | 0 | clean |
| `node e2e/labs-flow.cjs` | **1** | 225 passed, **1 failed**: "Product Lab: no horizontal scroll at 390px". Identical on untouched `origin/main` (5e06fb0); product-lab.html is not touched here. |

Not runnable here: `e2e/api-envelope.cjs` (needs the API repo at ../chitbridge-api). `e2e/cb-build-guard.cjs` "bumped after last change" fails on `origin/main` too (it compares clone timestamps); its working-tree check passes with CB_BUILD 2026-10-01b.

Screenshots: `e2e/shots/cb-accounts-{laptop,phone,ledgers,off}.png`, `index-cb-accounts-{off,active}.png`.
