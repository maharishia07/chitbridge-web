# ❄️ FROZEN — read-only reference (do not maintain)

As of 2026-06-25, **this React app (`src/`) is frozen**. The **canonical frontend is the
single-page Task Panel at `public/app.html`** (live at `https://chitbridge-web.vercel.app/app.html`),
built on one shared client (`public/app/core.js`) + the `{ok,data,error}` envelope.

## Rules
- **Do NOT add features here.** Build them in `app.html` / `public/app/*` instead.
- **Do NOT delete this `src/` tree.** It holds earlier conceptual work (the `/simulator`, `/tour`,
  NET `/network` + `/catalogue` pages, API clients in `src/api/*`) worth **mining** while carrying
  panels (Supplier, Network, …) into `app.html`.
- Treat it as **reference only**. Once a concept here is carried into the Task Panel, it can be
  retired from `src/` — but not before.

## What's still served from this React app
The SPA at `/` (and its routes `/simulator`, `/tour`, `/network`, `/catalogue`) still deploys from
`src/`. Leave it running; just stop developing on it. The Task Panel at `/app.html` is independent
and is where new work goes.
