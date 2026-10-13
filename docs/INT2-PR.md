**VERDICT: BUILD WITH CHANGES** (`docs/critique/INT2.md`, first commit) — `integrate/1013b` = main + #156 (IM1) + #155 (RI1), both `--no-ff`, in that order. **Lands AFTER api `integrate/1013b`** (twin, same branch name; the contract fixture is a byte copy of that branch's master).
- Resolved by meaning: `flows.json` = union — new flow `MVI` beside `C2V`; O2C keeps F3's **cash position as step 8**, RI1's **repeat supply becomes step 9** (its note now says table b303 — see the api PR's renumber). Pages + INDEX regenerated (`tools/gen-process-docs.cjs`), `MODULES.md` regenerated (43 capabilities) — docs-guard passes.
- CB Finance: `finTab` / `ftNav` / the nav keep BOTH new tabs — Collections · Cash (F3) · Terms · Repeat supply (RI1); `finance.html` loads `cap-finance-cash.js`, `step-flow.js`, `cap-repeat.js`.
- `e2e/contract.cjs` + `e2e/lib/contract.cjs` route regex = `books|crm|work|repeat` with `(\/|$)` (`/api/repeat` has no tail).
- Checks (foreground, exit codes): guard-static · token-guard · dup-functions · contract.cjs · check-syntax · check-app-parses · docs-guard · gen-process-docs --check → all 0; `walk-move-in.cjs` 7/7 · `walk-repeat-supply.cjs` 14/14 (shots refreshed on the integrated pages).
- Nothing new built; no new dependency; till untouched by both rounds.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
