# Chit sheet — open questions (backlog, to decide later)

Raised by the cloud build of PR #6 (`cloud/chit-sheet`). Nothing here blocks the merge. Each item says what the sheet does today.

1. **Return.** The web app has no return flow (it lives only in `public/till.html`, which is off-limits). Today the icon is shown for a counter bill and tapping it says "Returns are made at the counter, against the bill." Decide: build a web return flow, or keep the message.
2. **Receive payment and Cheque steps.** Not in the icon row: the chit read carries no open balance, so offering them would be a guess. Decide: should the API send the chit's open balance and cheque state? (API repo, not touched here.) The party view already has both actions.
3. **Goods in.** There is no separate goods-in route; accepting a bill is already "Goods received · bill accepted". Today Goods in asks "What is it for?" (resale · for the shop · an asset, via `billUse`) and then accepts. Decide: keep this, or something else.
4. **Callers not switched.** Dues rows open a party, not a chit, and the index page has counts only, not per-chit to-do lines. Decide whether either should get a chit-level list that opens the sheet.
5. **Cart to-do "accept" card** still opens Intake. Decide whether it should open the sheet.
6. **Playwright in CI.** `@playwright/test` is not installed in the cloud environment; the harnesses ran through a shim outside the repo. Check they run normally in your CI.
