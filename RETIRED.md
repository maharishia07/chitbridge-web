# Retired pages

One line per thing retired: date · what → what replaced it · why · how to get it back. Nothing here is deleted from
history — every removal carries a tag or a commit to restore from.

- 2026-10-01 · `src/` (the frozen React app, 90 files) → `index.html` (the index page at `/`) · retired from `/` the same
  day by Athi's decision; nothing imported it any more (checked: no page, build or test referred to it; `npm run build`
  green without it) · restore: `git checkout frozen-react-app-2026-10-01 -- src`.

- 2026-10-01 · `public/offer-lab.html` → `public/offer-lab-next.html` · Athi found live: "offer lab opens the previous offer lab, which we have to discontinue — the new offer lab only has to be connected, retire the existing one." · `offer-lab.html` now only forwards to `offer-lab-next.html` (carrying the query string and hash); every real link (the index tile, app.html, cap-catsetup.js, cap-legend.js, combo-lab.html, till.html, conversion-lab.html) already pointed to, or now points to, `offer-lab-next.html` — the Offer Lab built on the real offers engine.
