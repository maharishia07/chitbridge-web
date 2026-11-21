/**
 * public/app/preview-key.js — CBPreviewKey: the ONE hand-off from the back office to the customer's shop page, for the owner's preview
 * ID        CMP056
 * RISK      plain
 * OWNER     cb-ux-locale
 * OWNS      writing the short-lived preview key `cb_preview@<shop>` = { t, exp } that shop.html?s=<shop>&preview=1 reads (and nothing else of the staff side)
 * CALLED BY public/app.html (the product Storefront tab) · public/app/cap-showcase.js (the shop-look preview) · till.html writes the same key itself (the till loads no app/ script)
 * CARD      10-online-shop-and-storefront-orders/functions/the-online-shop-public-page
 * FLOW      hand(shopId) → the staff session's bearer is copied under the key for THIS shop, 15 minutes → the frame reads it, sends it on the one catalogue GET (?preview=1) → expired keys are dropped
 * CUSTOMER-DELINK (Athi, 21 Nov 2026): a customer page never reads the staff session (cb_sess). The staff side hands over, one way; the customer
 * page reads only this key. The key is per shop, expires, and is used on one read-only GET. LIMIT: it carries the owner's bearer until the api
 * mints a preview-only token (backlog: api POST /api/catalogue/:shop/preview-key) — swap the value here, nothing on the shop page changes.
 */
(function (root) {
  'use strict';
  var TTL_MS = 15 * 60 * 1000;
  /** a storage that refuses (private mode, full) is logged; the shop then answers the preview as it does a stranger */
  function unsaid(problem) {
    if (root.console) root.console.warn('CBPreviewKey: no key handed over', problem);
    return null;
  }
  function sessionToken() {
    try {
      var kept = JSON.parse(root.localStorage.getItem('cb_sess') || 'null');
      return (kept && kept.token) || null;
    } catch (problem) {
      return unsaid(problem);
    }
  }
  /** hand(shopId) → true when a key was written (a staff session exists), false otherwise (the shop then answers as to a stranger) */
  function hand(shopId) {
    var token = sessionToken();
    if (!shopId || !token) return false;
    try {
      root.localStorage.setItem('cb_preview@' + shopId, JSON.stringify({ t: token, exp: Date.now() + TTL_MS }));
      return true;
    } catch (problem) {
      unsaid(problem);
      return false;
    }
  }
  root.CBPreviewKey = { hand: hand, TTL_MS: TTL_MS };
})(typeof window !== 'undefined' ? window : globalThis);
