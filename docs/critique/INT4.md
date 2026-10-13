# INT4 critique — `integrate/1013d` (api + web): CS2 · CL2 · LOC0 · SET1 · CRM2 · WX-P2P · CO3 · CO1 · CO2 · CU4 · K2 onto main, written before any merge

**(a) What the brief assumes, checked**
- origin/main holds integrate/1013c in both repos — TRUE (web 2a93cd9b = #201, api e42a37a = #153; both mains have since added CX1/fmtCount).
- Every branch exists — TRUE: web all 11; api SET1 · CRM2 · WX-P2P · CO3 · CO1 · CO2 (CS2 api #128 already on main; CL2 · LOC0 · CU4 · K2 are web-only).
- Against main alone (`git merge-tree`): web CS2 → cap-country · tax.js · engine/tax.js · till.html; CL2 → country-lab.html; LOC0 · CO3 · CO1 · CO2 → cap-standards · standards-page.cjs (CO1 · CO2 also standards.html); SET1 → MODULES.md; CRM2 → chit-sheet.js; WX-P2P → e2e/lib/walk.cjs; CU4 → helpers.js; K2 clean. Api: WX-P2P → routes/actors · books; CO3 → guards.cjs; CO1 → server.js; others clean. More appear between branches (guards.cjs lines, OWNER-ACTIONS, flows.json, test-cases.json).
- Migrations b305 (CO3) · b306 · b307 (CO1) · b315 (CO2); api main tops at b304 — TRUE, unique, none renumbered. This round writes none (b352–b354 unused).
- CS2's web tax bundle pins reg-* 1.42 + tax 1.37, main pins reg-* 1.37 + tax 1.43 → lock = the higher pin per engine, written by engines `tools/adopt.cjs` (never hand-merged), `--check` after.
- Till: api SET1 changes the master; web CS2 · SET1 change the copy → re-vendored from the api integrate/1013d master after the last merge, `--check` current.

**(b) Rule conflicts** — the Standards register: four rounds append rows to the one list. Union, in merge order after the designer's rows: LOC0's 1 (also in the design data, so it joins the "designed" block), then CO3's 4, CO1's 7 (+ its edit of the DPDP row), CO2's 7 = 80 rows. Two spellings of a country (CO3 "United Arab Emirates", CO1 · CO2 "UAE") → one: `UAE`. Two country-group functions (CO1 `countryGroup` · CO2 inline) → one: CO1's (it names the mixed IN·AU·AE rows CO2's cannot). The walk's register checks are rewritten once to hold all four rounds' claims, not four copies.

**(c) Simpler way** — none; the order is the brief's and each conflict is re-resolved once.

**(d) Risks** — the Standards walk's counts are the evidence a reviewer reads: the union must recount (in force 34 · partly 32 · planned 14), never paper over. LOC0 baseline may only go DOWN after CL2 · SET1 · CRM2 · WX-P2P add copy — the locale walk decides. Engines: the reg-* 1.42 + tax 1.43 bundle is new together — till-vendor + country walk. Twin landing api → web (contract master first; if the api PR's till master moves, web lands first — stated in the PRs). Never merged, never force-pushed.

**(e) VERDICT: BUILD AS BRIEFED** — with the one-country-name and one-group-function choices above.
