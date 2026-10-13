# PR body for round/WX-L2C-38324484040 (neither runner token may create a pull request — the coordinator opens it with this body; delete this file then)

Title: WX-L2C: Lead to customer walked on a real stack — 13 findings, 7 fixed, the walk + fixture

**VERDICT: BUILD WITH CHANGES** (docs/critique/WX-L2C.md: L2C has no ledger step and one party — depth ends at "the first bill ends the lead"; no AU load; no engines).
Real stack on the runner: docker postgres:16 → `sim-load --schema --country IN` (3,256 bills, 11 proofs green) → api as a child of the walk (`e2e/lib/real-api.cjs`, new: nothing started the api for a walk) → CBSignin as simstores. Walk: `e2e/walk-x-l2c.cjs` (`--real` and fixture; fixture = `e2e/lib/standin.cjs` WIDENED with the L2C routes, held to the contract). L2C steps 1–5 · 15 screens at 1366 and 390 · 22 operations.
Findings (docs/testing/WX-L2C-2026-10-13.md): 13 — 🔴 3 / 🟠 4 / 🟡 6 · fixed here 7 (F1 Calls had no outcomes on first open · F4 a minted party read "Shopper account" · F5 a lead wore four chips · F6 a late record read painted over Leads · F8 "Tomorrow 12:00 am" · F9 Message's reason inline · F10 the sign-in heading) + the web half of F3 (hat/level claim read, 403 → "Your login can only view").
Open, for fix rounds (api): 🔴 F2 a counter bill naming the lead never counts (`routes/chits.js` auto-add counts recipients only — Ravi Stores has 0 trades after 3 years; step 5 of the flow is false today) · 🔴 F3 POST /actors drops `access_level` and the token carries no level (a "viewer" is an editor) · 🟠 F7 a stage move leaves no trail on the timeline · 🟡 F11 Log save outside CBAction · F12 two taps per outcome (design) · F13 flows.json step-5 note.
Re-run: real stack 17 of 22 paths (the 5 failing are F2 · F3 · F7, api-side) · fixture 22 of 23 (the one is F7, as the api sends it). Guards: guard-static · token-guard · dup-functions · contract · check-syntax · check-app-parses all exit 0; crm.cjs's 4 red rows are the same on main.
Reuse: walk.cjs · standin.cjs · crm-api.cjs · books-api.cjs · CBAction · CBList; flow step: L2C steps 1–5 (PM1). Better than Zoho/HubSpot CRM because the lead IS the party (one record, the chit both sides hold once they trade) and the server's may/why greys every refused action with its sentence — no second contact list, no hidden lead score.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
