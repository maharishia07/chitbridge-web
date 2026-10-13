# IX0 — the PR bodies (gh pr create was refused: HTTP 403 'Resource not accessible by personal access token' on both repos, GraphQL and REST, GH_TOKEN and GITHUB_TOKEN). Open them from these branches:

- api FIRST: https://github.com/maharishia07/chitbridge-api/pull/new/round/IX0-38326681653
- web second: https://github.com/maharishia07/chitbridge-web/pull/new/round/IX0-38326681653

## chitbridge-web — IX0: everything from Home — no customer path lands in app.html (audit · repoints · guard)

VERDICT: BUILD WITH CHANGES — docs/critique/IX0.md (the avatar's dormant default door removed, not allow-listed; the chit "Open page" is a gap, not a repoint).
Audit: Home itself has ONE door (the sign-in window's register link, also on the CBFrame pages); the rest were in the small apps — full table in docs/design/INDEX-NOT-APP.md.
Repointed now (7): Day book "close the day on the counter" → /till.html via one map `CB_HOMES` (accounts-shell.js, reused by Accounts · CRM · Finance `navTo`, the pattern standards.html's `HOME` had) · Offer/Combo Lab "Open co-assists" → /employees.html (the Sees-costs grant is on the person's row, cap-employees.js) · Country/Conversion Lab "← app" → Home · Standards `HOME` widened (coassists · task · network · identity) · avatar default Settings href gone · till "ChitBridge ↗" → web root (vendored from the api twin, `cbRoot()` replaces three inline trims).
Gaps per area (11 doors, allow-listed with their round): settings 7 (register ×2, country setup, till GST · profile · pairing), crm 3 (chit Open page ×3), network 1 (builder), catalogue 1 (till item tax rate). No settings.html or catalogue.html exists.
Build order: SET1 settings.html born (Your shop + Country setup, S/M) → CRM2 chit page inside CRM (M) → CAT1 catalogue.html (L) → SET2 Counters & keys + Connectors (M) → NET2 builder in network.html (M) → SET3 register page (M) → TRD1 readiness in KYB (M). Each row names the app.html code to REUSE (CBList · CBFrame skeleton · CBSteps).
Guard: e2e/index-not-app.cjs — reads Home, every manifest route and the scripts each page loads, comments stripped; any door off the list fails; an allow-list row that stopped matching fails (the list only shrinks). New: `CB_HOMES` (a map, not a function), the guard, the doc — navigation, no process step added to flows.json.
Checks: index-not-app · guard-static · token-guard · dup-functions · contract · check-syntax · check-app-parses · skeleton-guard · missing-functions all exit 0; api till-vendor test + scripts/guards.cjs (5007 checks) exit 0.
Twin: chitbridge-api round/IX0-38326681653 (till master) lands FIRST, this second (its vendored copy). No migration, no route, no engines change, no new dependency.
🤖 Generated with [Claude Code](https://claude.com/claude-code)

## chitbridge-api — till (IX0): the counter's ChitBridge link goes Home, never the workshop — one cbRoot()

VERDICT: BUILD WITH CHANGES (the round's critique: chitbridge-web docs/critique/IX0.md) — this is the till half of IX0 "everything from Home".
The counter's menu link "ChitBridge ↗" opened the workshop (app.html); it now opens Home (the web root), the one place customers start from.
Reuse: `cbRoot()` is the ONE trim of `cbHome()`, replacing three identical inline `.replace(/\/app\.html.*$/, '')` copies (storefront link · promo screen · share link) — one function, four callers, no new path.
Left as is (gaps, allow-listed in the web guard with their round): `whoseShopFix` · `openGst` · `billWarnFix` still open app.html until settings.html (SET1/SET2) and catalogue.html (CAT1) exist; e2e/till-open-gst keeps pinning today's door.
Checks: tests/till-vendor.test.js (69 checks) and scripts/guards.cjs (5007 checks · 167 files) exit 0. No route, no migration, no budget line, no engines change, no new dependency.
Twin: this lands FIRST; chitbridge-web round/IX0-38326681653 carries the vendored copy (scripts/vendor-till.cjs) and the rest of the round.
🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Browser walks run on the runner (after the push)
- `e2e/standards-page.cjs`: 147 passed, 0 failed (the widened `HOME` map, the Open › button on a till row, Copy-only rows).
- `e2e/one-avatar.cjs`: all Settings assertions pass (owner's menu on app.html · none on a utility page · never for a co-assist); the walk then fails at "size · index: the page text grows" — the SAME failure on an export of main, not from this round.
- `e2e/index-page.cjs`: 109 passed, 7 failed on this branch AND on main (identical rows: the static check still allows `#/register` where index.html has `#/welcome`; budget lines; roadmap counts) — pre-existing, index.html and the manifest are untouched here.
