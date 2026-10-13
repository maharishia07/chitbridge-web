**VERDICT: BUILD WITH CHANGES** (docs/critique/FX-L2C.md). Twin of api round/FX-L2C-38343045685. Landing: **api first**, then this.
F3 🔴: a viewer sees + Add lead, Add party, Move to…, Log, the record's bar and the Calls outcomes greyed, with the one sentence "Your login can only view". crmHat reads the new `access_level` claim, and the server still decides. F7: the timeline shows "Moved to Demo · from New lead" (CRM_KIND.stage). F2 needs no web change: the lead's chip turns Customer once the api counts the bill.
ai-eye: fixed E-1, E-3/13/18/21 (one count), E-5/6, E-8 (the who-line names the level: editor or view-only, not "CB Assist" — no doc names that product), E-10/11, E-14, E-16/20 ("outgoing"/"incoming"), E-17/23, E-19 (the phone bar wraps). Left: E-2 (M18), E-4/9 (contrast tokens), E-7, E-12, E-15 (M14), E-22/24 (kural band).
Walk e2e/walk-x-l2c.cjs, run on this runner: real stack (docker pg16 + sim-load) 22 of 22 · fixture 23 of 23. guard-static · token-guard · dup-functions · contract · check-syntax · check-app-parses: all exit 0.
Reuse: list-ctl prints the shared reason once; the M64 greying; the memberships store for the trail; the contract is a byte copy. Flow: L2C step 5 (flows.json).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
