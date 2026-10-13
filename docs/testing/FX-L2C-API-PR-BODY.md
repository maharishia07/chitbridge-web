**VERDICT: BUILD WITH CHANGES** (web docs/critique/FX-L2C.md): the lead ends by the trade count, not a new `customer` group · the stage trail is a read of memberships, not a new log.
F3 🔴 security, before the fix: EVERY mutating route accepted a "view-only" co-assist. `POST /api/actors` never stored `access_level`, so b173's default made them an editor. That covers CRM leads, stage moves, follow-ups, interactions, outcomes and chits/send. Fix: the INSERT stores the level (body → FROM_HAT → editor). The one hat gate stays as it is. The token and personShape carry `access_level`. `tests/crm-viewer.test.cjs` sends each CRM write through the real gate.
F2 🔴 `lib/crm.traded`: one UPDATE (txn_count / last_txn_at) for the party a counter bill names, inside the bill's withEntity transaction (savepoint, D-065). The stage stays derived as customer, and a later move gets 409 IS_CUSTOMER (`tests/crm-traded.test.cjs`).
F7 🟠 the timeline reads memberships as kind `stage` { stage, from, by }. No second log. Also: POST /leads `/s+/` → `/\s+/` ("Esai" was saved as "E ai").
Trips: the timeline gains +1 statement in its existing trip (budget unchanged, passes). chits/send gains +1 statement in the delivery transaction. POST /actors is unchanged. No migration, no new route. The contract was rewritten and byte-copied to web.
Checks: guards 5009/5009 · crm-viewer 25 · crm-traded 5 · crm-read 28 · contract 98 · round-trips 478. Landing: **api first**, then web (same branch).
Better than Zoho/HubSpot because the first bill itself ends the lead (one fact, one place) instead of a separate "convert" step.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
