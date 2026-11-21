/**
 * public/app/preview-key.js — CBPreviewKey: the ONE hand-off from the back office to the customer's shop page, for the owner's preview
 * ID        CMP056
 * RISK      plain
 * OWNER     cb-ux-locale
 * OWNS      writing the short-lived preview key `cb_preview@<shop>` = { t, exp } that shop.html?s=<shop>&preview=1 reads: t is the api's PREVIEW-ONLY token, never the staff session
 * CALLED BY public/app.html (the product Storefront tab) · public/app/cap-showcase.js (the shop-look preview) · till.html writes the same key itself (the till loads no app/ script)
 * CARD      10-online-shop-and-storefront-orders/functions/the-online-shop-public-page
 * FLOW      hand(shopId) → the staff session asks POST /api/entities/me/preview-token → ONLY the token it answers (aud cb-shop-preview, this shop, 15 min, reads the preview and no other door) is kept under the key → the frame sends it on the one catalogue GET (?preview=1) → expired keys are dropped
 * CUSTOMER-DELINK (Athi, 21 Nov 2026): a customer page never reads the staff session (cb_sess). The staff side hands over, one way; the customer
 * page reads only this key. The staff bearer is used here once, as the Authorization of the mint call, and is never stored under cb_preview
 * (e2e/customer-delink.cjs fails if it is). hand() answers a promise: callers that open the frame wait for it.
 */
(function (root) {
  'use strict';
  var TTL_MS = 15 * 60 * 1000,
    MIN_LEFT_MS = 60 * 1000; /* a key with a minute or more left is reused, not minted again */
  /** a failure is logged; the shop then answers the preview as it does a stranger */
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
  /** held(shopId) → true when a key for this shop is stored with MIN_LEFT_MS to run */
  function held(shopId) {
    try {
      var kept = JSON.parse(root.localStorage.getItem('cb_preview@' + shopId) || 'null');
      return !!(kept && kept.t && kept.exp - Date.now() > MIN_LEFT_MS);
    } catch (problem) {
      unsaid(problem);
      return false;
    }
  }
  /** hand(shopId) → Promise<true> once a key is stored (the api's preview-only token), Promise<false> otherwise (no staff session, a refusal, no network: the shop then answers as to a stranger) */
  function hand(shopId) {
    var token = sessionToken();
    if (!shopId || !token || typeof root.fetch !== 'function') return Promise.resolve(false);
    if (held(shopId)) return Promise.resolve(true);
    return root
      .fetch((root.CB_API || '') + '/api/entities/me/preview-token', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (reply) {
        return reply.ok ? reply.json() : null;
      })
      .then(function (minted) {
        if (!minted || !minted.token) return false;
        root.localStorage.setItem('cb_preview@' + shopId, JSON.stringify({ t: minted.token, exp: Date.now() + Math.min(TTL_MS, (minted.expires_in || 0) * 1000) }));
        return true;
      })
      .catch(function (problem) {
        unsaid(problem);
        return false;
      });
  }
  root.CBPreviewKey = { hand: hand, TTL_MS: TTL_MS };
})(typeof window !== 'undefined' ? window : globalThis);
