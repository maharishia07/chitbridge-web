# ChitBridge e2e — Playwright, one spec PER MODULE

> **This is a standalone, independent application.** It has its own `package.json`, its own dependency (`@playwright/test`),
> its own scripts, and it **drives ChitBridge from the OUTSIDE** (a real browser hitting the live URL) — it is not part of
> the product, doesn't ship to users, and can't affect the app. Point it at any environment with `CB_WEB_BASE`. Run it
> whenever, from anywhere: `cd e2e && npm run ui`. (It can move to its own git repo for full separation — optional; the
> folder is already independent.)

Structured so we **update per module** and **run them as a flow**. Each module owns a spec; `flow.spec.js` chains them into
the 2-day Definition of Done. Drives the **live** app (Vercel web + Railway API) in a real browser, capturing a **trace**
(the screen-by-screen filmstrip). Free & open-source (Apache-2.0). Per the reviewer's Step-3 handoff.

## Modules (one spec each)
| Spec | Module | Status |
|---|---|---|
| `tests/onboarding.spec.js` | Welcome → role → vertical → register → verify → **mint** | ✅ written (testids live) |
| `tests/flow.spec.js` | **DoD** — mint TWO distinct entities, screen by screen | ✅ written (mint half) |
| `tests/smoke.spec.js` | **every menu item + icon** renders after mint | ✅ written |
| `tests/chits.spec.js` | Compose → send a chit → appears in Order | ✅ written |
| `tests/catalogue.spec.js` | Add a product → appears in the catalogue | ✅ written |
| `tests/suppliers.spec.js` | Suppliers screen + add box | ✅ loads; real add needs a 2nd entity |
| `tests/coassists.spec.js` | Every co-assist type (human/IoT/ERP/AI) + create a human | ✅ written |
| `tests/capture.spec.js` | **WhatsApp/email → chit** (simulate transport) → inbox | ✅ simulate; AI structure = key-gated |
| `tests/connector.spec.js` | IoT/ERP device cockpit (add/ping/erp-test/delete) | ◐ skeleton; needs a connector-enabled entity |
| `tests/helpdesk.spec.js` | Assistant ask (deterministic); KB publish skeleton — **Step-3 first** | ◐ assistant works; KB needs a helpdesk entity |
| `tests/storefront.spec.js` | Customer order → chit | ✅ written; needs a seeded `CB_SHOP_BRIDGE` |
| `tests/multiparty.spec.js` | **MULTIPARTY** — A sends → B receives (2 contexts); USP dispute skeleton (3) | ✅ sender↔receiver |
| `tests/disputes.spec.js` | Raise → resolve (mechanics); USP 3-party skeleton | ✅ mechanics |
| `tests/messages.spec.js` | Internal note + external message; privacy skeleton | ✅ |
| `tests/redproof.spec.js` | **RED-proof** — the suite can fail on a broken screen | ✅ written |

### Multiparty — the real capability (watch it live)
The product is a **shared record between parties**, so the important flows use **multiple browser contexts** — one per
logged-in entity. `npm run test:multiparty` runs headed so you **watch 2–3 windows** (sender / receiver / third party) act
together. The `mintInContext(browser)` fixture mints an entity in its own isolated session; `addRecipientByName` lets A
address B. This is the enabler for the dispute-USP (A&B private, C excluded) and message-privacy proofs.

## How each module is specified (the reviewer's 3 things)
1. **The flow** — the screen sequence (top comment of each spec).
2. **The data** — a fresh email per run + `DEV_OTP=123456` (see `fixtures.js`).
3. **Stable locators** — `data-testid` on every interactive element. Live now:
   - **Onboarding/mint:** `onb-getstarted`, `onb-role-*`, `onb-bp-*`, `onb-continue`, `nav-signin`, `reg-name`,
     `reg-email`, `reg-submit`, `reg-vertical-*`, `reg-otp`.
   - **Panel nav (EVERY menu item):** `nav-<key>` — compose, task, order, folders, drafts, trash, archive, network,
     suppliers, customers, catalogue, readiness, coassists, mis, disputes, profile, settings, assistreview, shops
     (auto-derived in `menuBtn`, so new menu items get a testid for free). Plus `nav-drawer`.
   - **Toolbar icons:** `icon-legend` (🔑), `icon-messages` (💬), `icon-notifications` (🔔), `icon-logout`, `icon-help-*` (per-screen ?).
   - **Assistant:** `assistant-open`, `assist-input`, `assist-ask`, `assist-suggest-*`, `assist-helpdesk`, `assist-compliance`, `assist-close`.
   - **Helpdesk KB:** `kb-question`, `kb-answer`, `kb-context`, `kb-publish`, `kb-new`.
   - **Compose / chit:** `chit-recipient`, `chit-recipient-add`, `chit-add-self`, `chit-field-*` (subject etc.),
     `chit-catalogue-pick`, `chit-catalogue-add`, `chit-item-name/qty/price`, `chit-item-add`, `chit-ai-desc`,
     `chit-ai-fill`, `chit-save-draft`, `chit-send`.
   - **Catalogue:** `cat-new-product`, `cat-search`, `cat-product-*`, `cat-field-*` (name/unit/price/code/desc),
     `cat-add`, `cat-save`, `cat-edit`, `cat-delete`.
   - **Suppliers:** `sup-add-input`, `sup-add`, `sup-row-*`, `sup-nick`, `sup-category`, `sup-notes`, `sup-save`,
     `sup-remove`, `sup-compose-order`.
   - **Storefront (shop.html):** `shop-order-*`, `shop-viz-*`, `shop-combo`, `shop-qty`, `shop-name`, `shop-area`,
     `shop-contact`, `shop-send-code`, `shop-otp`, `shop-place-order`.
   - **Co-assists (wizard):** `coassist-new`, `coassist-type-{human|iot|erp|ai}` (the IoT/ERP/AI proof), `coassist-wiz-next`,
     `coassist-wiz-back`, `aw_name`, `aw_key` (+ aw_site/baseurl/authref/role per type). `coassists.spec` proves every type
     path is reachable + creates a human.
   Still to add (deeper CRUD levels): the connector COCKPIT for a created IoT gateway / ERP system (add-device, ping,
   erp-test, regen-key, delete — in cap-connector.js; a gateway must exist first), roster edit/delete, and the R/U/D steps
   in catalogue/suppliers/chits (testids exist; specs currently assert Create).
   This lets a smoke spec click into **every menu item + every icon** to confirm each part loads (see below).

## The control panel — `npm run ui` (start / stop / results, per flow)
Playwright **UI Mode** is the menu to run each flow independently and fine-tune it:
```bash
cd e2e && npm run ui
```
- **Left sidebar = every flow**, grouped by file (Disputes, Chits, Catalogue, Multiparty, …). Tick or click any one.
- **▶ Run** a single flow (or all); **■ Stop** a run; a **watch** toggle auto-re-runs a flow when you edit it.
- **Watch it live** — the browser actions play in the panel as they happen.
- **Results inline** — green/red per test *and per step*, with the **trace/timeline + a DOM snapshot at each step** (click a
  step to see exactly what the screen looked like). This is where you fine-tune a section: run it → watch → tweak → it
  re-runs → green.
- Nothing runs from the beginning — you pick a flow and only it executes.

(For a shareable results page instead of the interactive panel, use `npm run report` after a `npm test` run.)

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

## Cleaning up test data
Every run creates real rows (test entities, chits, …). All test identities share a **`@test.example`** email, so cleanup
is a single, safe, pattern-scoped script: **`chitbridge-api/scripts/cleanup-test-entities.sql`**. Run it in the **Supabase
SQL Editor** (postgres role, dev/test DB only) — **PART 1 is a dry-run count** to review; **PART 2 deletes**. It's
schema-adaptive (sweeps every table with an `entity_id`, incl. the FORCE-RLS ones). Never run it against production.

## Definition of done (2-day window)
`flow.spec.js` green: two different entities minted through the real front door, each landing in a working app (default
schema, no catalogue-404), with a saved trace. The **verify(stub) → gated** steps slot into the onboarding/flow specs once
Q3's gate + Q2's governed-mint land — the specs are written to grow into that (see the TODO/`test.skip` markers).
