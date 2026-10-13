**VERDICT: BUILD WITH CHANGES** (critique: chitbridge-api docs/critique/HX0.md). Twin PR: chitbridge-api, same branch. That one carries the compose stack, the proof script and the docs. **Land the api PR first.**
This PR adds the web image: `Dockerfile` (unprivileged nginx, 63 MB), `deploy/nginx.conf` (the same rewrite as vercel.json, plus `/healthz`) and `deploy/40-cb-api-base.sh`. `CB_API_BASE` replaces the Railway literal in the 28 files that carry it when the container starts; unset = unchanged.
It adds `e2e/stack-walk.cjs`, a walk against a running stack: production api, real sign-in with the code read from the proof mail sink. It is not named `walk-*`, so the cloud shards (no stack) skip it. It passed 4/4 on the runner.
`e2e/lib/walk.cjs` gets `opts.base`, which walks an already running site instead of serving the checkout (one additive option, so the walk skeleton is reused, not copied).
🔴 The web names `https://chitbridge-api-production.up.railway.app` in 33 places, including the shell's `apiBase()`, `app.html` stages, the connector/workforce installers and the till. The container swap above is a stopgap. The real fix is one config that every page reads (named as debt in api docs/HOSTING-COUPLING.md).
Flow step: none (deploy tooling). No screen, dependency or engines change.
Checks: guard-static, token-guard, dup-functions, contract, check-syntax, check-app-parses and docs-guard all pass.
🤖 Generated with [Claude Code](https://claude.com/claude-code)
