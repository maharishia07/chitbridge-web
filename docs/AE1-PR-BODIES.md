# Round AE1 + PK0 — the two PR bodies (the runner's token cannot open pull requests; both branches and the tag are pushed)

Open in this order. Delete this file once the PRs exist (as CS1b's notes file was).

## 1. chitbridge-engines — branch `feat/ae1-uae` (tag `v1.37.0` pushed) → https://github.com/maharishia07/chitbridge-engines/pull/new/feat/ae1-uae

**Title:** AE1 + PK0 · v1.37.0: the UAE regulation pack (reg-ae) and the add-a-country kit

**AE1 + PK0 · v1.37.0 (tag pushed).** `src/reg-ae.js` — the UAE pack from the AE0 facts file ONLY, every rule cited: AED 2dp · calendar year default (entity month on `ctx.pack`) · VAT 5% / zero-rated / exempt as `supplyKinds` with line reasons and their VAT201 box · TRN 15-digit format (no checksum published — said) · full vs simplified tax invoice (ER 59(1)/(2), AED 10,000, never under reverse charge) · credit note, no debit note · language exactly TPL Art. 5 · four FTA staggers, due the 28th · `returns.vat201` boxes read from ledger movements by role (FTA-populated boxes null, said) · chart with Output VAT · Input VAT · VAT due under reverse charge · Corporate tax payable/expense present-unused · IAS 1 words · `verified: false`.
**The kit:** `packs/TEMPLATE.md` (every member, IN + AU examples) · `tools/new-pack.cjs <ID>` (whole scaffold + test + engines.json rows; prints the one `BUILT_IN_` line) · `tests/every-pack.test.js` (every registered pack: validate · status books · FY/currency · REQUIRED_ROLES · a cart billed · a day posted · manifest · no TODO) · `tests/new-pack.test.js`. `docs/design/core-vs-packs/REGION-GCC.md`.
**Reuse:** `tax.determine` supplyKinds path (AU1), `tax.moneyOf` single head → `by_rate[rate].vat`, `chart.fiscalYearOf`, `posting`/`ledger` under `ctx.pack`, `regulation.status`. New paths: `reg-ae` (the pack), `tax.js` +2 lines (a kind row carries its return `box` when the pack names one — AU rows unchanged), `jurisdiction.REGISTRATION.AE` (the till loads no packs).
**Tests:** reg-ae 17 · every-pack 16 · new-pack 4 · reg-au 16 · tax-packs 9 · regulation all green; run.cjs: 1 pre-existing failure (`in-snapshot` receivables export count 28→29 since v1.31.0, untouched). in-snapshot: the two v1.20.0 probes for 'ae'/'VAT' may now find the pack (the one anticipated arrival).
**Left out (not in an official source, AE0 §14):** TRN check digit · Emirate sub-box letters 1a–1g · the 4 unnamed Designated Zones · e-invoice reporting window · Art. 48(8) categories · VAT penalty amounts · Arabic terms (no `label_ar`; no bidi marks, tested). Out of scope: UAE reverse charge in `determine`, margin scheme, tourist refunds, apportionment, CT computation, PINT-AE generation.
Landing order: this PR (tag v1.37.0 already pushed) → api adoption PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## 2. chitbridge-api — branch `round/AE1-38280121174` → https://github.com/maharishia07/chitbridge-api/pull/new/round/AE1-38280121174

**Title:** AE1: adopt engines v1.37.0 — the UAE regulation pack (reg-ae)

**AE1 · adopt chitbridge-engines v1.37.0** (tag pushed; lands AFTER the engines PR).
`engines.lock.json`: regulation · reg-in · reg-au → 1.37.0; **reg-ae 1.37.0 → `lib/reg-ae.js`** (new adopted file, written by `tools/adopt.cjs`; `--check` passes). `lib/regulation.js` registers the UAE by its one `BUILT_IN_` line, so `regulation.status('AE')` says books may open: AED, the calendar year, one `vat` head, `verified: false` until a UAE accountant reads it.
Tests: `engine-manifest` lists reg-ae.js; `country-setup` proves the UAE opens books and the registry order IN · AU · AE. `node scripts/guards.cjs`: **4900 checks · 163 files · all passed**.
No route changed (round-trips budget untouched); no migration; no new dependency. `tax` / `tax-packs` stay on 1.20.0 (the AU1 follow-up owns that adoption — until then the server's `tax.determine` does not read AU/AE supply kinds).
Web: `scripts/vendor-till.cjs --check` with `CB_WEB_DIR` says the counter copies are current — no web code change this round.
What the pack leaves out (said in its header): TRN check digit · Emirate sub-boxes 1a–1g · 4 unnamed Designated Zones · e-invoice reporting window · Art. 48(8) categories · VAT penalty amounts · Arabic terms; UAE reverse charge in `determine`, margin scheme, tourist refunds, CT computation and PINT-AE generation are later rounds.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
