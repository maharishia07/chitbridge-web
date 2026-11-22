/* app/core-copy.js — copies and redaction for core.js's api client, split out of core.js (web split 1129), code moved verbatim.
 * OWNS      _apiCopy / _apiClone (an independent copy of an answer, so a joined read never shares state; the non-enumerable list facts survive the copy) · _callClean (the call log's body, with secrets redacted)
 * CALLED BY core.js (api() hands a joined read _apiCopy; apiOnce() logs _callClean); loaded by every page that loads core.js, after it, so load order is free (read when called)
 * FLOW      api(key) joins an in-flight GET ──▶ _apiCopy(answer) · apiOnce(key) logs a call ──▶ _callClean(answer) ──▶ CBCALLS
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/api-client
 * ID        LIB005
 * OWNER     cb-ux-locale
 * RISK      plain
 */
'use strict';
/** an independent copy, so a joiner can never share mutable state with the caller it joined */
function _apiCopy(v) {
  var made = _apiClone(v);
  if (made !== v && Array.isArray(v) && Array.isArray(made))
    /* reviews11 GF-17 M5: unwrap() hangs truncated/status_counts/total/next on a list as NON-enumerable properties, which a clone drops */
    Object.getOwnPropertyNames(v).forEach(function (k) {
      if (k !== 'length' && !Object.prototype.hasOwnProperty.call(made, k))
        Object.defineProperty(made, k, { value: _apiClone(v[k]), enumerable: false, configurable: true, writable: true });
    });
  return made;
}
function _apiClone(v) {
  if (v === null || typeof v !== 'object') return v;
  try {
    if (typeof structuredClone === 'function') return structuredClone(v);
  } catch (_) {}
  try {
    return JSON.parse(JSON.stringify(v));
  } catch (_) {}
  /* ⚠ uncloneable (a Blob, a stream): hand back the original rather than fail the call, and never dedupe it
     again — said here because a silent share is exactly what this guard exists to prevent */
  return v;
}
function _callClean(v) {
  try {
    return JSON.stringify(v, function (k, x) { return /(pass|pin|otp|token|secret|auth|key|card|cvv)/i.test(k) ? '[redacted]' : x; }).slice(0, 1200);
  } catch (_) {
    return null;
  }
}
