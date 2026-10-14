# MAINT-1 result (14 Oct 2026): the 20% challenge re-measured on `integrate/1014c`

**Status:** MEASURED, read-only. No code changed. The code measured is api `integrate/1014c` (`cf5b3f67`) and web `integrate/1014c` (`80211419`), both holding INT6a + INT6b + INT6c.
**Tools:** the baseline's own: `jscpd@4 --min-tokens 50 --max-size 20mb`, `eslint@8` (`complexity:[1,15]`, `eslint-plugin-html@7` for inline scripts), KG1 (`tools/graph`, built on the branch), the api `round-trips-all` test, `e2e/screen-reads.cjs`, `tools/endpoint-usage.cjs`. Vendored (ADOPTED) pairs are in their own column and not counted, as in the baseline.

## Read this first: two limits of this run

1. **chitbridge-engines was not reachable from this runner** (not cloned beside the other two, and `gh` cannot resolve it). Every engines figure below is the **baseline value carried over** (D1c 267 L · 28 clones, 239 gross, C1 77, X1 16) and marked ⁽ᵉ⁾. The brief says engines is on `main`, so this is a fair assumption, but it is not a measurement. The KG1 graph was also built without engines (no pack nodes).
2. **Several baseline numbers could not be reproduced exactly from the appendix text alone** (`prims.cjs` scope, `lists.cjs`, the KG1 reach seed). So for those I **re-ran the same script on the merge-base commits** (web `315b8938`, api `e7b06163`, i.e. the code just before the integration) and judged the change like-for-like. Calibration: the re-run baseline matched the published one closely where the commands are fully specified: web net duplication 8,305 L (published 8,240), api 628 L (698), labs 6,176 (6,085), X2 90 (90), S2 api+web 181 (181), K1 30 (30), C1 956 (945). Rows marked ⚑ use the re-run baseline in the Δ%.

## 1 · Headline table

| # | Metric | Baseline | Now | Target | Δ% | MET? |
|---|---|---|---|---|---|---|
| D1 | Net duplicated lines (vendored pairs removed) | 9,205 L · 285 clones | **3,441 L · 219 clones** (api 582 + web 2,592 + engines 267⁽ᵉ⁾) | ≤ 7,364 | **−62.6%** | **MET** |
| D1a | … api | 698 L · 81 | 582 L · 71 (0.39%) | ≤ 558 | −16.6% | not met (24 L short; −7.3% vs re-run 628) |
| D1b | … web | 8,240 L · 176 | **2,592 L · 120** (1.48%); labs 424 | ≤ 6,592 | **−68.5%** | **MET** |
| D1c | … engines | 267 L · 28 | 267⁽ᵉ⁾ | ≤ 214 | not measured | n/a |
| D2 | Gross jscpd lines | 18,514 · 350 | 6,870 (api 3,949 · web 2,682 · eng 239⁽ᵉ⁾) | ≤ 14,811 | −62.9% | **MET** |
| D3 | Engine adopted twice inside web | 8 engines · 6,191 L | **0** (`app/X.js` vs `engine/X.js`: no pair left; web vendored-pair lines 3,583 → 232) | 0 | −100% | **MET** |
| D4 | Vendored copies behind their master | 3 (till 3 hunks · tax bundle · screen) | **1**: web `till.html` is byte-identical to the api master; web tax = v1.43.0 = api tax pin; **`screen` still api v1.5.0 vs web v1.15.0** | 0 | −2 of 3 | not met |
| P ⚑ | Primitive copies (api+web, jscpd scope: date · INR · IN · tax-ID · months · status) | 117 (published 215 on a wider scope) | **108** (date 31 · INR 38 · IN 10 · tax-ID 16 · months 3 · status 10) | −20% | −7.7% | not met |
| E1 | DB trips (fired rows) | 183 / 186 routes · max 9 | **196 / 189 routes** · mean 1.04 · p90 2 · max **9** (`GET /api/network-offers`) | ≤ 146 · max ≤ 7 | **+7.1%** | **not met (worse)** |
| E2 | SQL statements on the wire | 781 · max 136 | **802** · max 136 (`POST /api/books/enable`) | ≤ 625 | +2.7% | not met |
| E3 | Unmeasured routes (`fired:false`) | 24 (7 at the 50 ceiling) | **66** rows (22 at the 50 ceiling); 55 of the 66 are hand-counted `extra` rows added by the SEC/SRV rounds, 11 are plain | ≤ 19 | worse | not met |
| E4 | app.html screen reads | 135 · 76 screens · max 9 | 135 · 76 · max 9 budgeted, **+3 new unbudgeted screens** (138 · 79) | ≤ 108 · max ≤ 7 | 0% | not met |
| E5 ⚑ | Route execution path (KG1 `calls`, unlimited depth) | mean reach 72.8 (re-run on this scan: 46.9) · depth 4.9 (3.3) · max 8 | **49.8** · 3.6 · max 8 (`chits.js` 559 fns, `books.js` 410) | −20% | **+6.2%** | not met |
| S1 | Files over 2,000 lines | 21 (re-run 20) | **19** (till counted twice; 18 once) | ≤ 16 | −5% | not met |
| S2 ⚑ | Named functions over 80 lines (own, api+web) | 191 (re-run 181) | **185** (api 51 · web 134 · eng 10⁽ᵉ⁾ = 195); over 200 lines: 30 → 32 | ≤ 153 | +2.2% | not met |
| S3 ⚑ | Mean named-function length | 8.5 (re-run 8.3) | 8.2 (multi-line 15.0) | hold | −1% | held |
| C1 | Functions with complexity > 15 | 945 | **955** (api 352 · web 404 · till 122 · eng 77⁽ᵉ⁾) | ≤ 756 | +1% | not met |
| X1 | Empty `catch {}` (own, once) | 1,201 | **1,065** (api 479 = the till master · web 570 · eng 16⁽ᵉ⁾) | ≤ 960 | −11.3% | not met (105 short) |
| X2 | Empty `.catch(()=>{})` | 90 | **69** (api 17 · web 52) | ≤ 72 | −23.3% | **MET** |
| X3 ⚑ | Client regex over server sentences (`.test(` on message/msg/why) | 8 (re-run grep 4) | 2 | 0 | −50% | not met |
| X4 ⚑ | List GETs without `total`+`limit` (my `lists.cjs`) | 62/72 (re-run 83/107) | **81/106** | ≤ −20% | −2.4% | not met |
| — | **Standards score** X1+X2+X3+X4+P (api+web, re-run basis) | 1,468 (published 1,576) | **1,309** | ≤ 1,174 | **−10.8%** | **not met** |
| T1 | Files with functions and no tested-by edge | api 160/258 · web 36/122 · eng 8/46 | api 162/265 (61.1%; re-run base 161/263 = 61.2%) · web 38/94 (40%; base 34/89 = 38%) | api ≤ 50% | ~0 | not met |
| T2 ⚑ | Screens reached by no web test | 39/66 (re-run 77/121) | 84/128 (66%; base 64%) | ≤ −20% | worse | not met |
| K1 | Dead code, strong signal | 30 | **32** (24 are i18n message keys in `app.html`) | 0 | +7% | not met |
| K2 | Registry entries never invoked | 27 | **26** (of 420; 594 endpoints) | 0 | −1 | not met |
| R1 | Comment : code ratio | see baseline | not re-measured (baseline says it is not the lever) | — | — | — |

## 2 · The five challenge lines

| Challenge | Baseline → now | Verdict |
|---|---|---|
| **−20% duplicates** | 9,205 → **3,441** net lines (−62.6%); gross 18,514 → 6,870 (−62.9%); engine-twice-in-web 8 → 0 | **MET**, with a caveat: see §3 |
| **−20% execution path** | E5 +6% (49.8 vs 46.9 like-for-like); E1 183 → 196 trips; E2 781 → 802; E4 flat; C1 945 → 955 | **NOT MET** (slightly worse) |
| **+20% efficiency** | The same E1–E4: none moved down. E3 grew 24 → 66 placeholder/hand-counted rows | **NOT MET** |
| **+20% standards** | Score 1,468 → 1,309 = **−10.8%** (needs −20%). Only X2 (−23%) is met on its own. X1 −11% | **NOT MET** (half way) |
| **More human-readable** | No direct metric. Proxies: functions > 80 lines 181 → 185, mean length 8.3 → 8.2, files > 2,000 lines 20 → 19, complexity flat. The biggest readability change is the lab pages (`combo-lab.html` −3,135 lines) | **NOT SHOWN**: proxies flat, no proof either way |

## 3 · What moved most, and what did not

**Moved:** (1) **Web duplication, −5.7k lines, almost all in two places.** The lab pages: `combo-lab.html` lost 5,752 clone lines (the file shrank by 3,135 lines) and `offer-lab-next.html` lost 5,691. (2) **The double adoption inside web is gone:** `app/offers.js`, `app/locale.js`, `app/variant.js` and the other `app/X.js` twins of `engine/X.js` no longer exist (D3 8 → 0), and `till.html` now equals the api master. (3) **Empty `.catch(()=>{})` −23%** and empty `catch {}` in api non-till code (api 598 → 479: only the till master remains).

**Did not move:** **Non-lab web duplication is flat** (2,129 → 2,168 L). The −62.6% headline is mostly the labs plus the vendoring clean-up, not own code getting less repeated. Own api duplication fell only 7% (628 → 582). **Everything on the server side: round trips, statements, route reach, long functions, complexity, tests, dead code** is flat or a little worse, because Tier 2/3 added routes (189 vs 186 measured, 66 rows unmeasured) and screens (7 new screens, all untested) faster than it removed work. **Primitives** fell 8% only; `|| 'INR'` is 37 in web.

## 4 · The 5 cheapest next moves to reach the targets not met

1. **Empty catches in the `till.html` master (479 = 45% of X1).** One logged-and-swallowed helper (`cbQuiet`) applied by codemod in the api master, then re-copy to web. X1 → ~590, which clears X1 (≤ 960) **and alone takes the standards score to ~830 (target 1,174)**. Cheapest single step to "+20% standards".
2. **`GET /api/network-offers` (9 trips) and the 22 rows at the 50-trip ceiling.** Fire or hand-count the 22 ceiling rows (E3 66 → ≤ 19 needs 47 rows, 55 are already hand-counted, so promote them to `fired`), and batch the 9 trips to ≤ 7. This turns the E1/E3 reading from "unknown" into a number before any efficiency claim.
3. **Re-adopt `screen` v1.15 into the api** (`tools/adopt.cjs`; D4 → 0), and record the 3 new screens with `node e2e/screen-reads.cjs --update` (E4). Both are one command.
4. **Three one-reader helpers for the primitives (P 108 → ≤ 86):** a currency default (web `|| 'INR'` ×37), a date reader (`ymd()` ×31), a tax-ID word table (×16). The engines already hold the pieces (`CBMoney`, `locale`); widen them, do not copy.
5. **Cut the 32 dead functions to 0 (K1) and page the list GETs through one shared helper (X4 81 → ~60).** 24 of the 32 dead names are i18n keys in `app.html`, so one sweep clears most. For X4 the helper is `limit`/`total`, applied to the 25-odd list routes that are plain `SELECT … ORDER BY`.

Not on the list because it is not cheap: E5/C1/S2 (the 32 functions over 200 lines, `routes/chits.js` reaching 559 functions) need real splitting rounds, not sweeps.

**Also needed:** re-run the engines column from a checkout that has chitbridge-engines. The numbers marked ⁽ᵉ⁾ are carried over.

## Re-run notes

Scratch scripts (`jnet.cjs`, `prims.cjs`, `kg.cjs`, `e5.cjs`, `lists.cjs`) were rebuilt from the appendix text of the baseline; they are not committed. Web scan: `public/app`, `public/engine`, `public/*.html` minus `till.html`. jscpd formats and counts differ run to run, so judge by the same commands only.
