# Critique · T3-COMPAT — "Works with" on the Standards page (written before any code, 14 Oct 2026)

(a) What the brief assumes, checked
- compat.json is the one data file — TRUE: public/data/compat.json (12 rows); its own `about` says "read by the Standards page (Kind = Compatibility)".
- The register already holds compat rows — TRUE: cap-standards.js:1229 `stdCompatRows` maps them onto the register shape (k:'compat'); standards.html:210 `addCompat`; STD_KINDS has `compat` "works with" (cap-standards.js:995). So a "Works with" TAB already exists as a FILTER: Kind = Compatibility.
- Rows carry direction and code — FALSE: compat.json has `service`, `fit`, `proof_ref` (a test or a run), no direction and no code file.
- Beckn is in compat.json — FALSE: Beckn is a register row (`beckn-core`, k:'std', cap-standards.js:733), not a compat row.
- Home door "Compatibility" is `coming` — TRUE: public/app/manifest.json:46 (route null, facts null).
- A server fact exists for it — FALSE: routes/facts.js cards are till · accounts · labs · orders · rail; nothing the server holds is about this register (it is product data, not the shop's data — the Standards card is built with facts null too, manifest.json:42).
- A workshop door to a compat screen in app.html — FALSE: app.html has no Compatibility pane (grep "compatib"/N04: none). Nothing to keep reachable or to lift.
- The area homes (../chitbridge-docs/docs/…) — MISSING on the runner (the checkout is empty); the brief's inline DISCIPLINES were used.

(b) Conflicts with the rules
- A separate tab with its own rows/table would be a second list and a new style (CLAUDE.md rule 5; the page's own "one value, one control"). So "Works with" = the register's own Kind filter, opened by `#works-with` and by one button in the matrix pane (the existing `.tbtn`), the URL following the filter.
- New keys in compat.json (`dir`, `code`) need their dictionary line: the file's `about` is its dictionary — written there in the same change.
- Two Beckn rows? The register's `beckn-core` is the PROTOCOL (a standard); the compat row is "works with Beckn-compatible apps". Same status (Partly), same evidence, and each names the other — not two answers.

(c) Simpler
- No tab component, no new table, no API change: a hash, one button, two fields per row, a direction symbol in the row's first cell, Moves/Code lines in the opened row.
- Home card: `facts: null` (like Standards) rather than a server widening that would invent a fact. The card's `what` line says what it is.

(d) Risks
- e2e/standards-page.cjs counts every compat row; a new row moves its counts — it reads them from the file, so it follows.
- compat.json unreadable + Works with open → CBList would say "These filters match nothing here" (a lie). Use CBList's own error state with Try again.
- No migration (b508–b510 unused) · no engines · no api twin · no money · no secrets. Other rounds touching standards.html/cap-standards.js may conflict (STDREG*): additive edits only.

(e) VERDICT: BUILD WITH CHANGES — Works with = the Kind filter (no second list); compat.json widened with `dir` + `code` + a Beckn row; Home door built with facts null (no server fact exists); no api change.
