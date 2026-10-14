# Critique · T3-OPS — CB Operations (Stock + Suppliers) — written before any code
(a) What the brief assumes, checked:
- "the workshop's stock … screen" — FALSE. app.html and public/app/cap-*.js have NO stock-on-hand screen (grep `till/stock|onHand|stock_balance`:
  only shop.html's storefront ask). The one reader exists only server-side: api lib/stock-store.js `onHand`/`sheet` (T1-INV), served by
  GET /api/till/stock (routes/till.js:2158) — qty + avg_cost per item_id, NO name, NO unit, NO lots/expiry.
- "low-stock first" — PARTLY: no reorder level is stored anywhere (grep reorder/low_stock/min_qty: none). The only honest "low" is the
  server's own fact — below zero (stock-store.sheet `below_zero`) — then fewest on hand. No threshold is invented.
- "lots/expiry where kept" — TRUE in the store (stock_balance.lot · expires_at, sheet() reads them) but not on any route → widen the route.
- "the supplier list … loaded through page-frame" — PARTLY: suppliersScreen (app.html:7736) is the workshop's master/detail panel bound to
  UI · STORE · startDrag · crmListBase · the catalogue browser. Moving it whole is a rewrite of app.html. Its LIST rules (supName, supKindOf,
  the "How you order" reach) are small and are LIFTED into app/cap-suppliers.js; app.html points at the lifted copy (one copy).
- supplier_list routes (api routes/relationships.js GET/POST/DELETE /suppliers) and CB_PARTY_EP supAdd/supDel — TRUE, reused as is.
- page-frame (settings.html pattern) and CBList (list-ctl.js, self-contained CSS) — TRUE, reused.
- C:/dev/docs/12-… and 13-… — UNKNOWN: ../chitbridge-docs is an empty repo on this runner; built from the code and the brief's inline pack.
(b) Conflicts: a second supplier list beside CRM's party list (cap-crm.js, role=supplier) — resolved by keeping Operations to the
  supplier_list facts CRM does not show (Trade/Other kind, how you order, readiness) and linking each row's record to CRM (one record).
  Readiness = the server's on_rail (lib/istest mayTradeSql) + has_catalogue; the certificate check (OPS-S2) stays OUT this round.
(c) Simpler: no new stock route — widen GET /api/till/stock additively (`?lots=1` → items[] with name · unit · lots, below_zero) from the
  SAME onHand read; Home card = one new `operations` builder in lib/home-facts.js over that read. No migration (b505–b507 unused).
(d) Risks: cost — avg_cost stays gated by cost.canReadSafe and items[] carries NO value; twin landing (api first, web degrades to
  "could not read" words before it lands); app.html touched only to drop the two lifted functions; other rounds may edit manifest.json.
(e) VERDICT: BUILD WITH CHANGES — new cap-stock.js (nothing to reuse) · lifted cap-suppliers.js · till/stock widened · facts/operations
  added · OPS-S2 noted, not built · no migration.
