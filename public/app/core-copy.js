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
function _apiCopy(answer) {
  var made = _apiClone(answer);
  if (made !== answer && Array.isArray(answer) && Array.isArray(made))
    /* reviews11 GF-17 M5: unwrap() hangs truncated/status_counts/total/next on a list as NON-enumerable properties, which a clone drops */
    Object.getOwnPropertyNames(answer).forEach(function (field) {
      if (field !== 'length' && !Object.prototype.hasOwnProperty.call(made, field))
        Object.defineProperty(made, field, { value: _apiClone(answer[field]), enumerable: false, configurable: true, writable: true });
    });
  return made;
}
/** a structured copy of an answer; one that cannot be cloned is handed back as it is (said in the dev console record, the call itself never fails) */
function _apiClone(answer) {
  if (answer === null || typeof answer !== 'object') return answer;
  try {
    if (typeof structuredClone === 'function') return structuredClone(answer);
  } catch (failure) {
    if (typeof cbQuiet === 'function') cbQuiet('api copy: structuredClone refused the answer, the JSON copy is tried', failure);
  }
  try {
    return JSON.parse(JSON.stringify(answer));
  } catch (failure) {
    if (typeof cbQuiet === 'function') cbQuiet('api copy: the answer cannot be cloned, the original is handed back and never shared by the dedupe', failure);
  }
  /* ⚠ uncloneable (a Blob, a stream): hand back the original rather than fail the call, and never dedupe it
     again — said here because a silent share is exactly what this guard exists to prevent */
  return answer;
}
/** the call log's body: the answer as text, secrets redacted, cut at 1200 characters; null when it cannot be written as text */
function _callClean(answer) {
  try {
    return JSON.stringify(answer, function (field, value) { return /(pass|pin|otp|token|secret|auth|key|card|cvv)/i.test(field) ? '[redacted]' : value; }).slice(0, 1200);
  } catch (failure) {
    if (typeof cbQuiet === 'function') cbQuiet('call log: the answer could not be written as text, the log keeps no body', failure);
    return null;
  }
}
