# MAINT-1 result 2 (15 Oct 2026): the 20% challenge re-measured on integrated `main`

**Status:** MEASURED, read-only. No code changed. Code measured: web `main` `f5e973c6` (15 Oct 07:04 IST, INT6a–d + STD-CATCH + EFF-TRIPS merged) and the api checkout beside it (the runner's copy has no `.git`, so no SHA; its `lib/screen-kit.js`, `round-trips.budget.json` and `till.html` match what the web vendors).
**Compared with:** the baseline (14 Oct, `MAINT-1-BASELINE`) and MAINT-1-RESULT (14 Oct, branch `round/MAINT-1-MEASURE`, on `integrate/1014c`).
**Tools:** the baseline's own: `jscpd@4.3.0 --min-tokens 50 --max-size 20mb` (same three commands, vendored pairs in their own column), `eslint@8` + `eslint-plugin-html@7` (`complexity:[1,15]`), KG1 (`tools/graph`, built on main), api `tests/round-trips-all.test.cjs` (1207 checks, 0 failed, budget file left unchanged), `e2e/screen-reads.cjs`, `tools/endpoint-usage.cjs`. Scratch scripts (`jnet`, `prims`, `kg`, `lists`) rebuilt from the baseline appendix, not committed.

## Read this first: two limits

1. **chitbridge-engines is still unreachable** (`gh repo clone maharishia07/chitbridge-engines` → "Could not resolve to a Repository"). Engines figures are the **baseline values carried over**, marked ⁽ᵉ⁾ (D1c 267 L · 28 clones, gross 239, C1 77, S2 10, X1 16). Not a measurement. KG1 was built without engines.
2. The route set for E1/E2/E3 **more than doubled** (186 → 403 rows) because EFF-TRIPS now fires routes that were placeholders. Sums are therefore not comparable with the baseline's; I give per-route figures next to them. My scratch scripts reproduce the previous round's numbers closely (P = 108 both times, E5 49.8 → 50.5 by the same method, D1b 2,592 → 2,618), so the *calibration* holds.

## 1 · Headline table

| # | Metric | Baseline | Now | Target | Δ% | MET? |
|---|---|---|---|---|---|---|
| D1 | Net duplicated lines (vendored pairs removed) | 9,205 L · 285 clones | **3,455 L · 222 clones** (api 570 + web 2,618 + eng 267⁽ᵉ⁾) | ≤ 7,364 | **−62.5%** | **MET** |
| D1a | … api | 698 L · 81 | 570 L · 70 (0.38%) | ≤ 558 | −18.3% | not met (12 L short) |
| D1b | … web | 8,240 L · 176 | **2,618 L · 125** (1.48%); labs 424 | ≤ 6,592 | **−68.2%** | **MET** |
| D1c | … engines | 267 L · 28 | 267⁽ᵉ⁾ | ≤ 214 | not measured | n/a |
| D2 | Gross jscpd lines | 18,514 · 350 | 6,880 (api 3,938 · web 2,703 · eng 239⁽ᵉ⁾) | ≤ 14,811 | −62.8% | **MET** |
| D3 | Same engine adopted twice inside web | 8 engines · 6,191 L | **0 by the header test** (one leftover: `app/units.js`, 36 L, "vendored VERBATIM from api lib/units.js" with no ADOPTED header, next to `engine/units.js`) | 0 | −99.4% | MET by the baseline rule; 1 stray |
| D4 | Vendored copies behind their master | 3 | **1**: web `till.html` byte-identical to the api master (`cmp`); web tax 1.43.0 = api pin; **`screen` api 1.5.0 vs web 1.15.0** | 0 | −2 of 3 | not met |
| P | Primitive copies (api+web, jscpd scope) | 117 on this scope (published 215, wider) | **108** (date 31 · INR 38 · IN 10 · tax-ID 16 · months 3 · status 10) — identical to last round | −20% (≤ 94) | −7.7% | not met |
| E1 | DB trips, fired rows | 183 / 186 routes · mean 0.98 · max 9 (`GET /api/network-offers`) | **385 / 401 fired of 403 rows** · mean **0.96** · p90 2 · max **15** (`GET /api/entities/sides`, a newly fired row; the next worst is 8, `governance/readiness`) | sum ≤ 146 · max ≤ 7 | per route −2%; sum not comparable | **not met** (max) |
| E1w | the baseline's worst route | `GET /api/network-offers` = 9 trips | **1 trip** | ≤ 7 | −89% | **MET** for that route |
| E2 | SQL statements on the wire | 781 · mean 4.2 · max 136 (`POST /api/books/enable`) | 1,195 over 403 rows · mean **2.96** · max **31** (`entities/sides`); `books/enable` = **3** | ≤ 625 (sum) | per route **−29%**; max −77% | per-route met, sum not comparable |
| E3 | Unmeasured routes (`fired:false`) | 24 (7 at the 50 ceiling) | **2** (`POST /api/keys` answers 500 on the stub, ceiling 50; `PUT /api/governance/profile/vault` 503) | ≤ 19 | −92% | **MET** |
| E4 | app.html screen reads | 135 · 76 screens · max 9 | 135 · 76 · max 9 budgeted (+3 new unbudgeted: `bkPartyBillsHTML`, `ledgerScreen`, `partyBooksHTML`, 1 read each) | ≤ 108 · max ≤ 7 | 0% | not met |
| E5 | Route execution path (KG1 `calls`, seeds = route file + its functions) | mean reach 72.8 (re-run basis 46.9) · depth 4.9 · max 8 | **50.5** · depth 3.67 · max 8 (`chits.js` 564 fns, `books.js` 412) | −20% (≤ 37.5 on re-run basis) | **+7.7%** vs 46.9 (+1.4% vs last round) | not met |
| S1 | Files over 2,000 lines | 21 | **20** (till counted twice, `tax.js`/`tax-engine.browser.js` twin, `qr.js` third-party; 19 with the till once) | ≤ 16 | −5% | not met |
| S2 | Named functions over 80 lines (own, api+web) | 191 (re-run 181) | **187** (api 51 · web 136) + eng 10⁽ᵉ⁾ = 197; over 200 lines: 33 | ≤ 153 | +3.3% vs re-run | not met |
| S3 | Mean named-function length | 8.5 (re-run 8.3) | 8.15 (multi-line 14.9) | hold | −2% | held |
| C1 | Functions with complexity > 15 | 945 | **969** (api 354 · web 414 · till 124 · eng 77⁽ᵉ⁾); over 30: 197, over 50: 63 | ≤ 756 | **+2.5%** | not met |
| X1 | Empty `catch {}` (own, once) | 1,201 | **594** (api 4 · web 574 · eng 16⁽ᵉ⁾). The till master went 479 → 4 (STD-CATCH, `cbQuiet`) | ≤ 960 | **−50.5%** | **MET** |
| X2 | Empty `.catch(()=>{})` | 90 | **53** (api 1 · web 52) | ≤ 72 | −41% | **MET** |
| X3 | Client regex over server sentences (`.test(` on message/msg/why) | 8 (re-run grep 4) | 2 (`cap-period.js`, `cap-definitions.js`); the literal Who-is/Waiting-for set stays 0 | 0 | −50% | not met |
| X4 | List GETs without `total`+`limit` (my `lists.cjs`) | 62/72 (re-run 83/107) | **75 / 97** | −20% | −9.6% (83 → 75 on the re-run basis) | not met |
| — | **Standards score** X1+X2+X3+X4+P (api+web, last round's basis) | 1,468 (published 1,576) | **816** (578 + 53 + 2 + 75 + 108) | ≤ 1,174 | **−44.4%** | **MET** |
| T1 | Files with functions and no tested-by edge | api 160/258 · web 36/122 | api 163/267 (**61.0%**) · web 62/139 (44.6%; scope grew) | api ≤ 50% | ~0 | not met |
| T2 | Screens reached by no web test (labs excluded) | 39/66 (re-run 77/121) | 94/139 (67.6%; last round 66%) | −20% | worse | not met |
| K1 | Dead code, strong signal | 30 | **33** (24 are i18n message keys in `app.html`) | 0 | +10% | not met |
| K2 | Registry entries never invoked | 27 of 419 | **40 of 433** (601 server endpoints) | 0 | +48% | not met |
| R1 | Comment : code ratio | — | not re-measured (baseline: not the lever) | — | — | — |

## 2 · The five challenge lines

| Challenge | Baseline → now | Verdict |
|---|---|---|
| **−20% duplicates** | 9,205 → **3,455** net lines (−62.5%); gross 18,514 → 6,880 (−62.8%); engine-twice-in-web 8 → 0 (+1 stray, 36 L). api alone −18.3%, 12 L short of its sub-target | **MET** (same caveat as last round: see §3) |
| **−20% execution path** | E5 +7.7% like-for-like (50.5 vs 46.9); C1 945 → 969; E4 flat. The one bright spot: E1 on the baseline's worst route 9 → 1, `books/enable` 136 → 3 statements | **NOT MET** |
| **+20% efficiency** | Per-route statements −29% (4.2 → 2.96), unmeasured routes 24 → 2, worst baseline route 9 → 1 trip; but fired trips per route only −2%, max trips 15 on a new route, reads per screen (E4) unchanged, and the absolute sums cannot be compared (route set ×2.2) | **PARTLY MET**: E2 (per route) and E3 met; E1 max and E4 not. Not enough to claim +20% |
| **+20% standards** | Score 1,468 → **816** (−44.4%); X1 −50.5%, X2 −41% both met on their own; X3, X4, P not met | **MET** (driven by STD-CATCH on the till master) |
| **More human-readable** | Proxies flat: functions > 80 lines 181 → 187, mean length 8.3 → 8.15, files > 2,000 lines 21 → 20, complexity +2.5%. One real gain: 475 empty catches gone from the till master (now logged through `cbQuiet`) | **NOT SHOWN** (no regression, no proof) |

## 3 · What moved most, and what did not

**Moved most:**
1. **Empty catches: 1,065 → 594.** STD-CATCH took the till master from 479 to 4; web `till.html` is byte-identical to it. This alone carries the standards line from half way (−10.8%) to −44%.
2. **Round-trip honesty.** Unfired placeholder rows 66 → 2; `network-offers` 9 → 1 trip; `books/enable` 136 → 3 statements; mean statements per route 4.2 → 2.96. EFF-TRIPS did what its critique said.
3. **Vendoring clean-up kept:** `till.html` equals its master; web tax = api tax pin; duplication stays −62% (mostly the lab pages and the twin adoptions, from last round).

**Did not move:**
- **Non-lab web duplication is flat** (2,168 → 2,194 L) and api own duplication is −18% only after last round's step; no new reduction this round. The `routes/catalogue.js` self-clones (66 L), the till (59 L), `testing.js` (50) lead the api list.
- **Execution path and complexity:** E5 50.5, C1 969, S2 187, files > 2,000 lines 20. Tier 2/3 work added routes and screens; none of the long functions were split. `routes/chits.js` (5,565 lines) reaches 564 functions.
- **Primitives P = 108, exactly as last round.** `|| 'INR'` ×37 in web.
- **Tests and dead code got worse:** T2 94/139 untested screens, K1 33, K2 40 (was 26). New screens arrive untested and un-budgeted (E4: three new).

## 4 · The 5 cheapest next moves toward the targets still unmet

1. **Lock EFF-TRIPS in and finish E1/E3:** fix the two unfired rows (`POST /api/keys` answers 500 on the stub, `PUT governance/profile/vault` 503; E3 → 0) and cut `GET /api/entities/sides` (15 trips, 31 statements, the only route above 8) to ≤ 7 by batching its per-side reads; then `round-trips-all --write` so the gains cannot slip back. Takes E1's max target and E2's worst route in one change.
2. **Two one-command bookkeeping fixes:** re-adopt `screen` v1.15 into the api (`tools/adopt.cjs`; D4 → 0) and `node e2e/screen-reads.cjs --update` for the 3 new screens (E4 stays honest). Also delete or adopt-header `app/units.js` (D3 stray).
3. **Three one-reader helpers for primitives (P 108 → ≤ 86):** a currency default (web `|| 'INR'` ×37), a date reader (×31), a tax-ID word table (×16). Widen `CBMoney`/locale, do not copy. Same suggestion as last round, still untaken.
4. **12 lines to meet D1a, plus a dead-code sweep:** fold the `routes/catalogue.js` self-clone (66 L) into one helper (api 570 → ≤ 558 with room to spare); remove the 33 K1 names (24 are i18n keys in `app.html`, one sweep) and the 40 never-invoked registry entries (K2).
5. **List GETs through one paging helper (X4 75 → ≤ 60) and the two `e.message` regexes (X3 → 0):** `limit`/`total` on the ~25 plain `SELECT … ORDER BY` list routes, and replace the two `.test(msg)` sites with a server error code. That clears X3 and X4, the last unmet parts of the standards line.

Not on the list because they are not cheap: E5, C1, S2, S1 need real splitting rounds (`chits.js`, `books.js`, the 33 functions over 200 lines), and T1/T2 need tests written.

**Also needed:** re-run the engines column from a checkout that has chitbridge-engines (⁽ᵉ⁾ values are carried over).
