# CL2 — the PR that could not be opened from the runner

Both tokens on the runner (GH_TOKEN fine-grained PAT, GITHUB_TOKEN) answered 403 `Resource not accessible by personal access token` to createPullRequest, via `gh pr create` and the REST API. The branch is pushed; open it here and paste the body below:

https://github.com/maharishia07/chitbridge-web/compare/main...round/CL2-38326873304?expand=1

**Title:** CL2: Country lab — the owner's eight findings (difference marked, registering not switching, Home, no cut cart, why-folds, gutter, India's line, SAME rows collapse)

**Body:**

**VERDICT: BUILD WITH CHANGES** (docs/critique/CL2.md): the "existing shop" choice is now "no product or transaction yet / has a product or a transaction" (the owner's 13 Oct rule, not posting/close); #6's button is not in our code, so its space is reserved and asserted; AA is measured with the shared `e2e/lib/theme-measure.cjs`, not a11y-contrast's index-page pairs.
All eight fixed in `public/country-lab.html`, each with a check in `e2e/walk-country-lab.cjs` (C1–C9; 17/17 pass on the runner; shots `e2e/shots/walk-country-lab-{02,08,16,17}.png` = Cream/Dark × 1366/390): #1 difference = a 3 px `--blue` rule on the TO cell + the chip, page-private colour names re-pointed under `:root[data-themed]` (0 texts below AA in Cream and Dark); #2 title/subtitle/section/sentences say REGISTERING, never a switch (walk forbids the old phrases); #3 `⌂ Home` → `/`, no link to app.html; #4 the cart stacks as cards under a container query, selects shrink to the line — nothing cut, no inner scroll; #5 one line ≤ 20 words per cell, legal detail + citation behind a closed `why` fold; #6 56 px right gutter on the outcome pane, no fixed element over the means column; #7 "India: each item's own GST rate decides."; #8 SAME rows collapse under "N rows are the same · show".
Reuse: `fold()`/`list()`, `CBTax.determine` + `moneyOf` untouched (one calculation), the avatar's `[data-themed]` re-pointing pattern, the Combo/Offer labs' Home door, the cmp table's own block stacking, `theme-measure.cjs` via `CBAvatar.applyTheme` as crm-themes does. New: `toggleSame()` · `cite()` (R2R step 1 · country; `flows.json` note reworded, R2R.md regenerated).
Found on the way: `app/avatar.js` `.cbav a{color:inherit}` out-specified `.cbav-signin{color:#fff}` — the signed-out Sign-in door was ink-on-green 2.02:1 on every lab page in Cream; selector made `.cbav .cbav-signin` (no new raw colour).
Checks: walk-country-lab 17/17 · guard-static 0 failures · token-guard clean · dup-functions · contract 24/0 · check-syntax · check-app-parses · process-map — all exit 0. No api/engines change, no migration, no new dependency.
Better than Xero/QuickBooks because they lock the organisation's region at creation and show nothing of what it decides; here both packs stand side by side, read from the same engine the till bills with, before anyone registers.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
