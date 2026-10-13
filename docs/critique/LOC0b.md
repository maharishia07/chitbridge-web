# Critique · LOC0b (the locale walk's baseline on today's main) — written before any code

**VERDICT: BUILD WITH CHANGES** (one correction, no blocker).

## (a) What the brief assumes, checked
- "finance 11 → 12 from the new Cash tab (F3, merged after the baseline)" — TRUE: `e2e/locale-baseline.json` finance@1366 = 11 (strings Age · CB Finance · Collapse …); main's finance.html gained a tab after the baseline was taken (merge `9ebe2394`). An honest rise: it is re-measured, not excluded.
- "hitting http://127.0.0.1:NNNNN · override is a DEV banner with a RANDOM PORT" — TRUE: `modeRibbon()` `public/app.html:17551-17578` paints `"hitting " + CFG.API_BASE` into `[data-testid="ribbon-api"]`; the walk serves the checkout on `listen(0)` (`e2e/lib/walk.cjs:34`), so the port differs per run. The old baseline ALREADY held `hitting http://127.0.0.1:41153 · override` (country-lab strings) — the COUNT was stable (chrome() strips URLs, walk-locale.cjs:150) but the `strings` list was not, so every run named it as "new".
- "💬 Assistant (the floating button)" — TRUE that it is product copy through `tx()` (`app.html:2973`), and TRUE that it reads English in qps: `mountAssist()` runs at boot (`app.html:3351`) before the pack lands, and the FAB is never re-painted (the pack's `renderApp()` rebuilds #root, not #assistfab). Not a dev banner: it COUNTS, honestly, and is a real finding for the Home conversion round (LOC7) — nothing is translated here.
- "exclude by a data attribute, not by text" — TRUE that no such attribute exists today (grep: `[translate=no]`, `#__walkbanner` are the only skips, walk-locale.cjs:144). `data-dev` is already a click-target attribute in signin-lab.html:312 with another meaning, so the new attribute must not reuse that name.

## (b) Conflicts with DECISIONS-level rules and existing constructs
- One place per thing: the ribbon is one function (`modeRibbon`) rendered by four screens — ONE attribute on its root element covers all four; the walk's SKIP list is the one place that says what is never counted; the standard's § 4 says the same in words (widened by one clause).
- No translation this round (the brief): the Assistant stays English in the baseline; `tx()` callers are untouched.

## (c) Simpler way
None simpler than one attribute + one selector. Skipping `[data-testid="ribbon-api"]` would be by test-id (text-adjacent) and would leave the stage buttons (Dev · Live · 🧪 Log) counted — the ribbon is dev chrome as a whole.

## (d) Risks
- Stability: with the ribbon skipped, the remaining strings are deterministic (fixture data, static labels). Verified by running the walk twice after `--write`.
- Other rounds: K1 touched docs only; TO1b/F3 touched finance/tasks screens — their words are re-measured into the baseline, so a later rise still names new words. The attribute is additive; no CSS or behaviour change.
- No api, engines, migration or dependency. The Playwright install is the e2e package's own lockfile (`e2e/npm ci`).

## (e) Changes to the brief
1. The attribute is `data-dev-only` (not `data-dev`, taken in signin-lab.html). 2. The Assistant button is NOT excluded: it is a product string and counts; named in the report as the LOC7 item.
