/* app/core-answers.js — small readers of an api answer, split out of core.js (file-size ratchet, batch 1128), code moved verbatim.
 * OWNS      three steps of core.js's answer handling: noteShopZone (the shop's zone from /me) · keepIncluded (the answer's `included` rides on the entity) · errorFacts (what a failed call's error carries)
 * CALLED BY core.js (unwrap and apiOnce call them when an answer lands, so load order is free); loaded by every page that loads core.js, after it
 * FLOW      api(key) → fetch → unwrap → noteShopZone / keepIncluded → the caller; a refused answer → errorFacts → the error the one card and toast read
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/api-client
 * ID        LIB004
 * OWNER     cb-ux-locale
 * RISK      plain
 */
'use strict';
/** the shop's own time zone from the /me answer, handed to the one owner of window.CB_SHOP_TZ (shopZoneSet) */
function noteShopZone(j, key) {
  if (key === 'me' && j.entity.timezone && typeof shopZoneSet === 'function') shopZoneSet(j.entity.timezone);
}
/** the answer's `included` rides on the flattened entity (a frozen entity just keeps going without it) */
function keepIncluded(j) {
  if (j.included && j.entity && typeof j.entity === 'object') {
    try {
      j.entity.included = j.included;
    } catch (failure) {
      if (typeof cbQuiet === 'function') cbQuiet('api: the answer is frozen, its included list is not kept on the entity', failure);
    }
  }
}
/** the facts a failed call's error carries: the status, the answer's own body (e.data), how long to wait after a 429 (M-F-07: the body's own, else the Retry-After header), then the register code, hint and request id (B7) */
function errorFacts(er, res, j, requestId) {
  er.status = res.status;
  er.data = j;
  er.retryAfter = Math.ceil(Number(j && j.params && j.params.retry_after_seconds) || Number(res.headers && res.headers.get && res.headers.get('Retry-After')) || 0);
  refusalFacts(er, j, requestId);
}
