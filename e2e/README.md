# e2e — walks and guards

Every walk is `NODE_PATH=$PWD/e2e/node_modules node e2e/<walk>.cjs [--real] [--show]` from the repo root (first time:
`cd e2e && npm ci && npx playwright install --with-deps chromium`). `--real` runs the local api (`e2e/lib/real-stack.cjs`:
`../chitbridge-api/server.js` on `CB_REAL_DB`, DEV_OTP `123456`); default is a stand-in answering inside the page.

**Signing in against a DEPLOYED api (SEC1, 2026-10-14):** the fixed codes work on a local stack only. Specs and scripts that sign in
to a deployed api type env `E2E_TESTER_CODE` (the api's `TESTER_CODE`; in CI the GitHub secret of that name) through
`e2e/lib/signin-code.cjs` — unset, they SKIP with a `::warning` naming the secret. Never write the code into a file.

## Testing another country from one PC (GOV-SPIN, 2026-10-14)

A country reaches registration from TWO sides; a walk can set both.

- **The installation side** — which ChitBridge this is. The api reads `INSTALLATION_KEY` (default `platform-0`, which states no
  country). `real-stack.cjs` passes the walk's environment through, so `INSTALLATION_KEY=au-test node e2e/<walk>.cjs --real`
  makes this PC an Australian spin. The test rows `au-test` (AU · AUD · Australia/Sydney · en-AU), `ae-test` (AE · AED · Asia/Dubai ·
  en-AE, ar-AE) and `in-test` (IN · INR · Asia/Kolkata · en-IN) come from the api's `scripts/seed-local-installations.sql` — local
  databases only, never production: `psql -X -v ON_ERROR_STOP=1 -d "$CB_REAL_DB" -f ../chitbridge-api/scripts/seed-local-installations.sql`
  (needs migration b382). A cloud spin sets it with `CB_SPIN_COUNTRY=AU` (api `deploy/spin-lib.sh`).
- **The browser side** — where the browser says it is. Playwright's `timezoneId` + `locale` (+ `geolocation`) per browser context:
  `W.run(name, walk)` with `walk.opts = { timezoneId, locale, geolocation }` for the whole walk (default Asia/Kolkata · en-IN), or
  `await w.contextAt({ timezoneId: 'Australia/Sydney', locale: 'en-AU', geolocation: { latitude: -33.87, longitude: 151.21 } })` for one
  more browser in the same walk (`e2e/lib/walk.cjs`). The register panel reads the time zone first (app/govcontext.js `countryOf`).

`e2e/walk-spin-country.cjs` runs the matrix — installation {au, ae, in, none} × browser {Sydney, Dubai, Kolkata} → the panel's line,
the ticked country, and (`--real`) the stored country + its source; one api per installation in turn. Screenshots go to `e2e/out/`
(never committed).

## The visual tour (VTOUR, 2026-10-14)

`e2e/visual-tour.cjs` walks the whole product on the LOCAL stack: Part A signed out (every page top → bottom, every box that does not
write/pay/send clicked, Sign in and New shop with the local code), Part B signed in as the simulated shop (each tab, random safe
operations). Codes come from `public/app/screens.js`; a page with none is UNNUMBERED. `--report` merges `e2e/out/tour/run-*.json` into
`tour.json` + `TOUR-FINDINGS.md` (ranked broken · inconsistent · cosmetic + the inventory). On GitHub: Actions → visual-tour (on demand,
artifact `visual-tour`). The last run's findings: `docs/testing/TOUR-FINDINGS.md`.

## Crossing — trading across installations (CTP pack, 25 Oct 2026)

`e2e/tests/crossing.spec.js` is the SCREEN side of the crossing pack; the headless side (rails, rounds, both databases compared) is chitbridge-api
`tests/crossing/` (its README says where each runs). Scenario ids are the 25 Oct walk's (`docs/walks/WALK-2026-10-25-IN-AU.md`): R13–R16, G2, G4b/c here;
the rounds screen, step tracker, first-send confirm, the "Ask for a quote" switch, the unconfirmed-message mark (W18) and the repaint (W14) are `test.fixme`
with their finding ids — a screen that does not exist is never faked.

- ONE config: the topology (installations, shops, which pair each scenario drives) is the api repo's `tests/crossing/topology.json`, read through
  `e2e/lib/crossing.cjs` from `CB_API_DIR` (default `../chitbridge-api`). One browser CONTEXT per shop, on that shop's installation origin (single or several).
- Off by default and in neither default project: `CB_CROSSING=1 CB_API_DIR=<api checkout with tests/crossing> npx playwright test --project=crossing`
  (add `--headed` to watch). One playwright invocation at a time.
- Secrets: the tester code is read from the VM over ssh into memory (the api pack's `lib/secret.cjs`); the hard guard refuses any host that does not start with
  `staging.` or is not in the topology. The specs create only tagged chits (`[CTPX <run>]`), delete nothing, and change no shop setting (R13 cancels its confirm).

## Shared pieces

- `lib/walk.cjs` — the walk skeleton (steps, shots, show mode, `contextAt`).
- `lib/rule13.cjs` — brief rule 13 on a screen: Cream + Dark × 1366 + 390 px, AA contrast, no clipping, no inner sideways scroll,
  nothing over a control, no app.html link, copy within budget.
- `lib/real-stack.cjs` — the local api under a walk.
