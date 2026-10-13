/**
 * /config.js — WHERE THIS SITE'S API IS. The ONE place (HX1, api docs/HOSTING-COUPLING.md › Web front-end).
 *
 * Every page loads this first and reads `window.CB_API` — CBShell.apiBase(), app.html's stage ladder, the stand-alone pages, the
 * counter (till.html) and the shop screen (promo.html). The value below is the production api, because Vercel serves this file as
 * it is. Any other deploy WRITES this file when it starts, from CB_API_BASE (the web image: deploy/40-cb-api-base.sh). On a shop PC
 * the counter program (till.js) serves its own /config.js from connector.json instead.
 * e2e/guard-static.cjs fails on a *.railway.app / *.vercel.app address anywhere else in the site.
 */
window.CB_API = window.CB_API || 'https://chitbridge-api-production.up.railway.app';
