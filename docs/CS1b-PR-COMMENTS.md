# Round CS1b — the three PR comments (2026-10-12)

The runner's token could not post PR comments (403 on `issues/:n/comments` and `addComment`), so the text is here for the
coordinator to paste. Land order: **engines #18 → api #104 → web #137**.

## chitbridge-engines #18 (commit 40bda47, tag v1.36.0)
CS1b: merged origin/main (AU1, v1.34.0) into this branch; conflicts were package.json and CHANGELOG.md only.
- This is **v1.36.0** — package.json, the CS1 CHANGELOG heading (above v1.34.0) with "do not adopt v1.35.0" (that tag was cut before AU1 and lacks `reg-au`; it is left in place, never moved). Tag `v1.36.0` is pushed on the merge commit.
- regulation tests: Japan is the pack-less country now (Australia has its pack); one new check that Australia opens books with AUD and FY July. `v1.35.0` mentions in src/tests re-headed v1.36.0; docs/CONTRACTS.md regenerated.
- Tests: regulation · tax · tax-packs · reg-au all pass. One PRE-EXISTING red on main, untouched: `in-snapshot.test.js` receivables exports (28→29 since v1.31.0 `reopenedBy`) — fails on a clean origin/main too; not this PR's.

## chitbridge-api #104 (commit ef1d0bf)
CS1b: re-adopted engines **v1.36.0** with tools/adopt.cjs — `regulation` and `reg-in` → 1.36.0, NEW `reg-au` 1.36.0 → lib/reg-au.js (AU1 arrives on the server). `adopt --check` passes; engines-pinned green.
- round-trips-all red: the **budget side** was wrong. `governanceRouter` is mounted by variable, which tools/endpoint-usage.cjs cannot map (same as entitiesRouter), so the scanner never saw a route the client DOES call (`api('countrySetup')`). Both country-setup lines are now `extra: true` by hand, like `/api/entities/header` — no `--write`, the "why" notes kept.
- tests: engine-manifest lists reg-au.js as adopted; country-setup.test uses Japan as the pack-less country and proves Australia opens books (pack AU, AUD, FY July).
- `node scripts/guards.cjs`: 4838 checks · 162 files · all passed. No SQL run, no new dependency.
- Land after engines #18 (needs tag v1.36.0, already pushed); web #137 after this.

## chitbridge-web #137 (commit e6b2a25a)
CS1b: the web vendors none of regulation / reg-in / reg-au (tax stays 1.20.0) — `adopt --check` passes, nothing to re-vendor.
- **C3 `{}`** was a stand-in bug, not a product one: Playwright tries the LAST registered route first, so the `**/api/**` catch-all registered after the country-setup stub answered every call with `{ ok: true }` (C4's empty profile was the same cause). The catch-all is now registered first. cap-country's `api('countrySetupSave', { body })` was always right.
- **C4** uses a Japanese browser (no pack ships for Japan); new **C7**: an Australian browser prefills Australia · AUD · July from the AU pack, no sentence, and PUTs `{ AU, AUD, 7 }`.
- Playwright on the runner: walk-country **7 of 7** pass (shots committed). guard-static · token-guard · dup-functions · contract · check-syntax · check-app-parses all green.
- Land last. origin/main merges into this branch cleanly (not merged here — not asked).
