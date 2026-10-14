# Everything from Home — no customer path lands in the workshop (app.html)

Owner, 2026-10-13: *"in the index still lot of function goes to backend app, we have to ensure that all works from here."*
Standing decision ("Utility apps, not app.html"): **app.html is the WORKSHOP** (internal). Customers go **Home (index.html) → the
small apps** the manifest draws (`public/app/manifest.json`): till · accounts · finance · crm · tasks · employees · network · shop ·
know-your-business · documents · standards · the labs. This page is the audit of every door that still opened the workshop (round IX0),
what was repointed, what is a gap, and the order the gaps are closed. The guard **`e2e/index-not-app.cjs`** reads Home, every page the
manifest routes to and the scripts each page loads; any door not in its ALLOW list fails, and an ALLOW row that stopped matching fails
too — **the list only shrinks**. Striking a row here means striking it there in the same change.

## 1 · The audit (IX0, 2026-10-13)

Where a door is: `file:line` at the time of the audit. "What the person wanted" is the job, not the screen.

| Entry on Home / in a small app | What the person wanted | Target before IX0 | Small app it belongs to | Move |
|---|---|---|---|---|
| Home · sign-in window · *Continue to register* (`index.html:112`; the same on Tasks · Employees · Network · KYB · Documents via `page-frame.js:54`) | start a new shop | ~~`app.html#/welcome`~~ → `settings.html#/new` | **settings** (the shop's own setup; a new shop is its first) | **done · FX-UX2** (the form moved to `app/register-form.js`; app.html #/register paints the same) |
| Home · avatar menu · *Settings* (`avatar.js:309`, a default href) | the shop's settings | `app.html#/app/settings` — dormant: only app.html asks for the item and it passes its own handler | settings | **fixed now**: no default door; Settings is drawn only with a page's own `onSettings` / `settingsHref` |
| CB Accounts · Day book · *"close the day on the counter"* (`cap-books.js:975` → `navTo('counter')`) | close the day | `app.html#/app/counter` | **till** (the counter IS `/till.html`) | **repointed now** — `CB_HOMES` (accounts-shell.js) |
| CB Accounts · CRM · Finance · `navTo(key)` for any other key | — (no other live caller) | `app.html#/app/<key>` | the map `CB_HOMES`: task/order → tasks · customers/suppliers → crm · ledger → accounts · network · coassists → employees · profile → kyb | **repointed now**; a key with no home says "Not built outside the workshop yet." — never a door |
| CB Accounts · *Country setup* when the books cannot open (`accounts.html:631`) | choose the shop's country (pack) | `app.html#/country` | **settings** | **built · SET1** — `/settings.html#/country` (`CBCountry.mount`, cap-country.js widened with a host · onDone) |
| Network · *Open the builder* (`network-app.js:144`) | make the network the design checked | `app.html#/network` | **network** | **build · NET2 (M)** — `cap-network.js` (the builder tree + apply), inside network.html's work pane |
| Standards · *Open in the app ›* (`standards.html` `HOME`) | see the rule's screen | till only; every other row no button | till · employees · tasks · network · kyb | **widened now**: `coassists` → employees · `task` → tasks · `network` → network · `identity` → kyb; `catalogue` · `catsetup` (CAT1) · `locale` · `appearance` · `integrations` (SET2) · `readiness` (TRD1) · `returns` (ACC) stay button-less until their app |
| Offer Lab · Combo Lab · *Open co-assists* ("who else sees cost") (`offer-lab-next.html:1944` · `combo-lab.html:2049`) | grant "Sees costs" to a person | `app.html` | **employees** (`cap-employees.js` `can_see_costs` is on the person's row) | **repointed now** → `/employees.html` |
| Country Lab · Conversion Lab · *← app* (`country-lab.html:113` · `conversion-lab.html:94`) | go back | `app.html` | Home | **repointed now** → `/` |
| Till · menu · *ChitBridge ↗* (`till.html:10512`, `cbHome()`) | the rest of ChitBridge | `app.html` | Home | **repointed now** → the web root (`cbRoot()`, master `chitbridge-api/tools/tally-connector/till.html`, vendored) |
| Till · *whoseShopFix* (`till.html:6528`) | pair this PC to the right counter | `app.html#/app` (Settings › Integrations › Counters) | **settings** (Counters & keys) | **build · SET2 (M)** — `counterGo` + the Counters card (cap-admin.js) |
| Till · *openGst* (`till.html:8360`) | set up GST for the shop | `app.html#/app` | **settings** (Your shop) | **built · SET1** — `cbRoot() + '/settings.html#/shop'` (the till master, vendored); e2e/till-open-gst pins the new door |
| Till · *billWarnFix* (`till.html:18074`) | fix the shop's state/GSTIN · give an item a tax rate | `#/app/profile` · `#/app/catalogue` | **settings** · **catalogue** | state/GSTIN **built · SET1** (`/settings.html#/shop`) · the rate **build · CAT1** (`#/app/catalogue` stays on the list) |
| Home · manifest chips with no page (Catalogue → via Product Lab · Stock · Suppliers · Disputes · Co-assist; Your shop since SET1, Counters & keys · Connectors · Governance · Plan & usage since T3-SETTINGS are cards with a page) | — (a dashed chip, no link: I12) | nowhere | catalogue · operations · crm · settings | not doors; Suppliers could become `crm.html#/parties?role=supplier` and Disputes `crm.html#/chits?tab=stuck` by a manifest row each — Athi's call, it adds cards to Home |

Checked and clean: the manifest's routes, the bell (→ crm), the kural, the sides (server hrefs: KYB), the facts' `act.href` (server words — the API sends
no app.html href: `grep app.html routes lib` is comments only), shop.html, tasks.html, employees.html, store.html, network-shop.html, intake.html.

## 2 · The gaps, per area — ONE small app per area, never one per screen

| Area | Small app | Exists? | Screens that move there (REUSE, never rewrite) |
|---|---|---|---|
| **settings** | `settings.html` — CB Settings | **yes (SET1)** — Your shop (`cap-shop.js`: the Business section + the vault's identity rows) · Country (`cap-country.js`) · New shop (`register-form.js`, FX-UX2) · **T3-SETTINGS (2026-10-14)**: Counters & keys (`cap-counters.js` — the register · the pairings · the keys), Connectors (`cap-connectors.js` — the catalogue with the server's may/why · running · who owns what), Policy & Localisation (`cap-policy.js` — each rule with the server's who-may-change · `cap-locale.js`), Plan & usage (`cap-plan.js` — the server's plan, its limits, the billed ledger); each MOVED out of `cap-admin.js`, the workshop paints the same modules | still to move: the workshop's Settings sections identity · appearance · governance layers · channels · work patterns; Integrations › In the books · The store · Network offers; the till's pairing door `whoseShopFix → app.html#/app` (the web copy is ahead of the api master — T2-NATDEF — so it is not re-vendored this round: one master edit + vendor + strike the two ALLOW rows) |
| **catalogue** | `catalogue.html` — Catalogue | **no** (chip `via` Product Lab) | the product list + detail (app.html `catalogue` nav: `prodPickAll`, the tabs product · pricing · variants · modifiers · barcode · media · storefront), Categories (`cap-categories.js`), Catalogue setup (`cap-catsetup.js`), `catalogue-model.js` · `catalogue-lines.js` · `price-resolve.js` |
| **crm** | `crm.html` | yes | **done · CRM2 (2026-10-13)**: the chit page `#/chit/<id>` is the chit sheet mounted full-page (`CBSheet.mount`, one painter, the frozen figures read once) + history + the CBPage note; `paintDetail` stays the workshop's pane until M53 is designed (it recomputes money — docs/critique/CRM2.md) |
| **network** | `network.html` | yes | the builder (`cap-network.js`) |
| **trade** | `know-your-business.html` | yes | Trade readiness (`cap-readiness.js`) — no door today, only the standards rows `go:'readiness'` |
| accounts · finance · tasks · people | `accounts.html` · `finance.html` · `tasks.html` · `employees.html` | yes | nothing left in the workshop that a door asks for (GST returns `go:'returns'` → accounts, when the Returns tab is a customer screen) |

## 3 · The build order (most-used first) — each round moves a screen into a small app with the CB constructs

Every round: the standard page skeleton (`page-frame.js` `CBFrame.mount({ skeleton })` + `page-skeleton.css`, as Employees · Network · Tasks), **CBList** for
every list (`list-ctl.js`), **CBSteps** (`step-flow.js`) for a flow, `CBAction` for writes (M64), the money unit (M36), theme tokens only, works at 390px.
A round STRIKES its rows from the ALLOW list in `e2e/index-not-app.cjs` and from §1 here.

| # | Round | Size | What lands | Doors it closes |
|---|---|---|---|---|
| 1 | **SET1** · `settings.html` born: Your shop (identity · GSTIN · state · address) + Country setup — **landed 2026-10-13** | M | the page on the skeleton; `cap-shop.js` (MOVED out of cap-admin.js: the Business section · the vault, `CAP_WITH.admin`) + `cap-country.js` mounted with a host; manifest `shop` → built, route `/settings.html#/shop`; `CB_HOMES.shop · country · settings`; the gov-panel rows in `/app/gov-panel.css` (one file, both pages) | `acc-country-setup` · till `openGst` · till `billWarnFix` (state) — struck; the ALLOW list is 9 rows |
| 2 | **CRM2** · the chit page inside CB CRM (`crm.html#/chit/<id>`) — **landed 2026-10-13** | M | `CBSheet.mount` (chit-sheet.js widened: the popup's painters full-page, + history + the page note) behind `#/chit/<id>` (cap-crm-chits.js `chitPage`); `pages.json` base script → `crm.html`; `openChitPage` in the three ledger pages → `chitPageHref` (`CB_HOMES.chit`) | the three `openChitPage` — struck |
| 3 | **CAT1** · `catalogue.html` born: the list (CBList) + the product detail tabs + Categories | L | manifest `catalogue` → built, route `/catalogue.html` (drop `via`); standards `HOME.catalogue` | till `billWarnFix` (rate) · standards 8 rows |
| 4 | **SET2** · Counters & keys + Connectors in `settings.html` | M | `counterGo` + Counters card; `cap-connector.js`; manifest `counters` · `connectors` → built | till `whoseShopFix` · the last till `#/app` caller → `cbHome()` retired, `cbRoot()` stays |
| 5 | **NET2** · the builder inside `network.html` | M | `cap-network.js` in the work pane, behind the design's Check | `nw-builder` |
| 6 | **SET3** (register door done FX-UX2; the welcome intro as CBSteps still open) · register a new shop from the sign-in window (`settings.html#/new` or the window's own step) | M | the `#/welcome` flow as CBSteps; `registerHref` in `index.html` and `page-frame.js` → the new page; M37's P0 allow-list closes | the two `registerHref` |
| 7 | **TRD1** · Trade readiness in Know your business | M | `cap-readiness.js`; standards `HOME.readiness` | none today (button-less rows) |

When the table in §1 has no **build** row left, `e2e/index-not-app.cjs`'s ALLOW list is empty, and the guard becomes the plain rule: no customer page names app.html.
