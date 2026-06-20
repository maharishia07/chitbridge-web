# Layer Simulator — in-repo guide  →  save as `src/sim/README.md`
_This file is meant to live INSIDE the chitbridge-web repo (commit it at `src/sim/README.md`). It is the canonical guide so the simulator grows and ships as a permanent part of the application. The CLI should create this file, commit it, and follow it for every future layer._

---

## What this is
The **Layer Simulator** is a permanent feature of **chitbridge-web**, deployed with the app on **Vercel at `/simulator`**. It does three jobs at once:
1. **Teaching tool** — walk the six governance layers, one screen each.
2. **Investor-pitch instrument** — Without-CB (pain) ↔ With-CB (pleasure) per layer.
3. **Reference oracle / test harness** — each layer's scenario buttons are self-tests that prove the governance rules hold.

It grows **one layer at a time** and **must never fork the production governance logic**.

## What it is NOT
- Not a throwaway prototype, not a separate app, not production business logic, not wired to any real writes. It reads the same rules production reads; it never mutates real data.

## Where it lives (folder map)
```
src/
  governance/        # PURE logic — no React, no network. The shared source of truth.
    resolver.js      # atomic layer resolve(): Class A/B/C, bound/chosen/advisory, mint/drift/re-attest, entitlements
    constitutions.js # constitution versions (v0.1, v0.2, …)
    verticals.js     # industry profiles
    cascade.js       # left-fold: layers one layer onto the previous result, with provenance
    <layer>.js       # each new layer's data/profiles land here
  sim/               # UI ONLY — imports from governance/
    simStore.jsx     # provider + reducer (shared state)
    SimulatorTab.jsx # layer rail + screen switch + route entry
    ModeToggle.jsx
    ScenarioRunner.jsx
    <Layer>Screen.jsx   # one screen per layer
    <layer>Scenarios.js # one self-test set per layer
    simulator.css
    README.md           # this file
```

## How it deploys (so it lives with the app)
- Mounted as a **lazy route `/simulator`** in the app router (see `SimulatorTab.jsx`). Because it's part of the chitbridge-web SPA, **every Vercel build ships it automatically** — no separate deploy, no extra config.
- Flow for each change: work on a `simulator` (or `sim/<layer>`) branch → push → **Vercel preview URL** → click-test → all scenarios green → **merge to main → it's in production.**

## THE ANTI-DRIFT RULE (most important)
- `governance/resolver.js` is the **single source of truth** for governance semantics.
- The production GOV-01 resolver must converge to the **same interface**: `resolve(constitution, override) → {effective, exceptions, rejections}`, plus `mint`, `viewEntity`, `reattest`.
- Once they match, move the module to a shared **`packages/governance`** and have BOTH the API and the simulator import it. **Never copy or fork the logic** — a forked simulator can lie, and then it stops being a trustworthy oracle.

## Recipe — adding a new layer (repeat for each)
For layer **X** (next up: Jurisdiction, then Standards, Content, ERP, then Payoff):
1. **`governance/<x>.js`** — the layer's data/profiles: what it offers and what it `contributes`, each with its conformance class (bound / bound_set / chosen / advisory).
2. **`governance/cascade.js`** — extend the fold so X composes in **precedence order** (Constitution → Jurisdiction → Vertical → Standards → Content → ERP), recording provenance and enforcing bound-floor + tighten-only.
3. **`sim/<X>Screen.jsx`** — inputs · live resolved output · **Without ↔ With** toggle · a provenance view where layers interact.
4. **`sim/<x>Scenarios.js`** — 3+ self-tests asserting the layer's rule. These ARE the test harness; all must be green before merge.
5. **Register X** in `SimulatorTab.jsx`: add it to `LAYERS` (the rail) and to `ScreenSwitch`.
6. Branch → preview → click-test → green → merge.

Keep every layer **client-side only**: no backend, no secrets, **no new dependencies beyond React**.

## Roadmap (update this list as it grows)
- [x] Constitution  _(live on Vercel — proven 20 Jun 2026)_
- [x] Vertical
- [x] Jurisdiction
- [x] Standards
- [x] Content
- [x] ERP
- [x] Payoff — stacks all six ("spin a compliant business in minutes")
- [x] Blueprint (template → instance)
- [ ] Movement 2 — Operate (entity → supplier → network → completion → MIS)
- [ ] Model presets (Amazon-style marketplace / closed distributor / manufacturer chain / service network)
- [ ] "Price being paid today" meter (deferred; hook = `painLog`)

## Guardrails
- Teaching / QA / pitch only — never connected to production writes.
- Any figures or prices: illustrative, labelled, and configurable (no invented precision).
- Must stay **parallel to and never block GOV-01** (Linear ATH-93).

## Source of each layer's starter code
Drive → **Chit & Bridge Library / 04-build-and-runbooks**: "Layer Simulator — <layer> slice (starter code)". Linear hub: **ATH-99**.
