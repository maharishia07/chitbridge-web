/* device-id.js — CBDevice: THIS BROWSER'S DEVICE ID, AND X-Device-Id ON EVERY CALL TO THE API (K-SEC PR A, 2026-10-21).
 *
 * WHY. A sign-in that names its device gets a LISTED session (api lib/person-session.js, M05): it can be logged out, renewed and
 * revoked, and a lifted token is useless on another device. The api binds that token to the device, so EVERY later request must
 * carry `X-Device-Id` equal to it, or it answers 401 DEVICE_MISMATCH. Only the till did that, so every other page kept getting
 * the old unlisted 7-day token (no jti) — the one the api will refuse once Athi sets LEGACY_TOKEN_REFUSE. cb_sess is shared by
 * every page, so a session made on one page reaches all of them: the header has to ride on every page's calls, not just the
 * sign-in. 51 call sites set `Authorization` by hand; ONE fetch wrapper here stamps the header instead of editing each of them.
 *
 * THE ID. `cb_device_id` in localStorage: made once per BROWSER, device-wide, never per shop — the same key and the same shape
 * as the till's own maker (till.html deviceId, M08) and the api's deviceIdOf (8–80 of [A-Za-z0-9_.:-]), so the till and the
 * pages name one browser the same. It is a name, not a secret: knowing it grants nothing without the session.
 * ⚠️ NO STORAGE, NO ID. If this browser cannot keep the id (private mode, storage blocked), id() answers null and nothing is
 * stamped — the page signs in exactly as before (legacy token). An id that changed between two page loads would turn every call
 * into a 401; no id at all is always safe.
 *
 *   CBDevice.id()           → the id (made and kept on first use), or null when storage cannot keep it
 *   CBDevice.stamp(url, init) → init with X-Device-Id added when url is the api and the header is not already set
 *   the wrapper              installed once: window.fetch stamps every call to the api (relative /api/… or window.CB_API)
 *
 * OWNS    the device id of a web page and the X-Device-Id header on its api calls
 * CALLED BY every page that holds a session (loaded before any other script), public/app/signin-ui.js (the sign-in doors)
 * FLOW    page load → wrapper installed → sign-in sends the id (body + header) → api lists the session → every call carries it
 * CARD 18-identity-sign-in-and-access/sessions-and-devices
 * Hand-off: till.html still has its own deviceId() with the same rule; the counter area moves it onto CBDevice (the PC kit must
 * then ship this file). Until then e2e/device-id.cjs fails if the two rules ever differ.
 */
(function (root) {
  'use strict';
  if (root.CBDevice) return;
  var KEY = 'cb_device_id';
  var SHAPE = /^[A-Za-z0-9_.:-]{8,80}$/; /* the api's own shape (lib/person-session deviceIdOf) */
  var HEADER = 'X-Device-Id';
  var PROBLEMS_KEPT = 20;
  var problems = []; /* what went wrong, newest last — CBDevice.problems; the page itself carries on unstamped (a legacy sign-in) */

  /** note(where, problem) — every fallback here is recorded, never silent: the page's own recorder (cbQuiet) when it has one */
  function note(where, problem) {
    var line = 'device-id ' + where + ': ' + String((problem && (problem.name || problem.message)) || problem);
    problems.push(line);
    if (problems.length > PROBLEMS_KEPT) problems.shift();
    if (typeof root.cbQuiet === 'function') root.cbQuiet(line, problem);
  }

  /** read(key) → the stored string, or '' when storage is unreadable */
  function read(key) {
    try {
      return root.localStorage.getItem(key) || '';
    } catch (problem) {
      note('read', problem);
      return '';
    }
  }
  /** fresh() → a new random id in the api's shape */
  function fresh() {
    var made = null;
    try {
      made = root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : null;
    } catch (problem) {
      note('randomUUID', problem); /* the fallback below is just as good for a name */
    }
    return made || 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  }
  /** id() → this browser's device id, made once and KEPT; null when storage cannot keep it (then nothing is ever stamped) */
  function id() {
    var held = read(KEY);
    if (SHAPE.test(held)) return held;
    var made = fresh();
    try {
      root.localStorage.setItem(KEY, made);
    } catch (problem) {
      note('keep', problem); /* storage refused the write: no id is safer than an id that changes on the next page */
      return null;
    }
    return read(KEY) === made ? made : null;
  }
  /** apiOrigin() → the origin of window.CB_API (public/config.js), or '' when the page has none */
  function apiOrigin() {
    var base = root.CB_API;
    if (!base) return '';
    try {
      return new URL(String(base), root.location.href).origin;
    } catch (problem) {
      note('CB_API', problem);
      return '';
    }
  }
  /** isApi(url) → true for a call this site's api answers: same origin under /api/, or the CB_API origin */
  function isApi(url) {
    if (!url) return false;
    var where;
    try {
      where = new URL(String(url), root.location.href);
    } catch (problem) {
      note('url', problem);
      return false;
    }
    if (where.origin === root.location.origin && where.pathname.indexOf('/api/') === 0) return true;
    return !!apiOrigin() && where.origin === apiOrigin();
  }
  /** stamp(url, init, request) → init carrying X-Device-Id when url is the api and no header of that name is set */
  function stamp(url, init, request) {
    if (!isApi(url)) return init;
    var device = id();
    if (!device) return init;
    var given = init && init.headers ? init.headers : request ? request.headers : undefined;
    var headers = new root.Headers(given);
    if (headers.has(HEADER)) return init;
    headers.set(HEADER, device);
    return Object.assign({}, init || {}, { headers: headers });
  }

  root.CBDevice = { id: id, stamp: stamp, isApi: isApi, KEY: KEY, HEADER: HEADER, problems: problems };

  /* the ONE wrapper: every fetch to the api carries the device id. Installed once; a page that has no fetch gets nothing. */
  if (typeof root.fetch === 'function' && typeof root.Headers === 'function') {
    var plain = root.fetch;
    root.fetch = function (input, init) {
      var request = typeof root.Request === 'function' && input instanceof root.Request ? input : null;
      var url = request ? request.url : input;
      return plain.call(root, input, stamp(url, init, request));
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
