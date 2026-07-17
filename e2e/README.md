# ChitBridge e2e — Playwright, one spec PER MODULE

Structured so we **update per module** and **run them as a flow**. Each module owns a spec; `flow.spec.js` chains them into
the 2-day Definition of Done. Drives the **live** app (Vercel web + Railway API) in a real browser, capturing a **trace**
(the screen-by-screen filmstrip). Free & open-source (Apache-2.0). Per the reviewer's Step-3 handoff.

## Modules (one spec each)
| Spec | Module | Status |
|---|---|---|
| `tests/onboarding.spec.js` | Welcome → role → vertical → register → verify → **mint** | ✅ written (testids live) |
| `tests/flow.spec.js` | **DoD** — mint TWO distinct entities, screen by screen | ✅ written (mint half) |
| `tests/chits.spec.js` | Compose → send a chit | ◐ mint works; compose steps need Compose testids |
| `tests/helpdesk.spec.js` | KB publish → assistant answers (deterministic) — **Step-3 first** | ◐ skeleton; needs helpdesk login + KB testids |
| `tests/storefront.spec.js` | Customer order → chit | ◐ skeleton; needs a seeded `CB_SHOP_BRIDGE` |
| `tests/redproof.spec.js` | **RED-proof** — the suite can fail on a broken screen | ✅ written |

## How each module is specified (the reviewer's 3 things)
1. **The flow** — the screen sequence (top comment of each spec).
2. **The data** — a fresh email per run + `DEV_OTP=123456` (see `fixtures.js`).
3. **Stable locators** — `data-testid` on every interactive element. Live now (onboarding): `onb-getstarted`,
   `onb-role-*`, `onb-bp-*`, `onb-continue`, `nav-signin`, `reg-name`, `reg-email`, `reg-submit`, `reg-vertical-*`,
   `reg-otp`. To extend a module, add its testids (Compose / KB / catalogue) then fill the spec's TODO block.

## Run (Saturday — the app must be UP)
```bash
cd e2e
npm install
npm run install-browsers          # chromium only
npm test                          # all modules
npm run test:onboarding           # one module
npm run test:flow                 # the DoD
npm run report                    # open the HTML report + traces (the filmstrip)
```
Target a different host with `CB_WEB_BASE=https://…` (default = the Vercel app; app.html points at the Railway API).
`app.html` must be reachable and `DEV_OTP=123456` set on the API.

## RED-proof (do this before counting a module done)
```bash
npm test tests/redproof.spec.js               # GREEN — the real screen is there
CB_REDPROOF=1 npm test tests/redproof.spec.js  # RED — asserts a broken locator, proving the suite catches breaks
```
General technique for any module: break the screen (rename/remove a `data-testid`), rerun the module spec → it must go
RED. A spec that stays green on a real break is decorative.

## Authoring aid
`npm run codegen -- https://chitbridge-web.vercel.app/app.html` records a clickthrough into a draft spec (lowers the
locator-authoring effort). Prefer the `data-testid` locators over recorded CSS.

## Definition of done (2-day window)
`flow.spec.js` green: two different entities minted through the real front door, each landing in a working app (default
schema, no catalogue-404), with a saved trace. The **verify(stub) → gated** steps slot into the onboarding/flow specs once
Q3's gate + Q2's governed-mint land — the specs are written to grow into that (see the TODO/`test.skip` markers).
