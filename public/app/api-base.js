/**
 * public/app/api-base.js — CBApiBase: THE ONE reader of where this page's api is (the cb_api_base override included)
 *
 * OWNS      the api base for every page and app file; the only place that reads localStorage.cb_api_base (e2e/guard-apibase.cjs fails on a second reader)
 * CALLED BY app.html CFG.API_BASE · app/shell.js apiBase · app/assign-bar.js · app/books-clients-door.js · app/books-practice.js · accounts/crm/finance/standards.html CFG; loaded right after /config.js
 * FLOW      resolve(env) → on a production host: the built-in window.CB_API, any override ignored and removed, said in the console → on a local or SIT host (localhost, 127.0.0.1, *.sslip.io): the override, only if it points at localhost, 127.0.0.1 or *.sslip.io, said loudly in the console → else the page default
 * CARD      18-identity-sign-in-and-access/api-base
 *
 * Why: a stored override once honoured on production sends every later request, session token included, to whatever host was stored
 * (a shared counter PC, an XSS, a pasted "fix"). Production never reads it. (SEC, batch 1129; OWASP ASVS 5.1 / API8 misconfiguration)
 */
(function (root) {
  'use strict';
  var KEY = 'cb_api_base';
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;
  var SIT = /^[a-z0-9-]+\.sslip\.io$/;
  function allowedHost(h) {
    h = String(h || '').toLowerCase();
    return LOCAL.test(h) || SIT.test(h);
  }
  /** the override's own address: http(s) to localhost, 127.0.0.1 or a *.sslip.io SIT box, nothing else */
  function allowedTarget(value) {
    try {
      var u = new URL(value);
      return (u.protocol === 'http:' || u.protocol === 'https:') && allowedHost(u.hostname);
    } catch (_) {
      return false;
    }
  }
  function say(level, text) {
    try {
      if (root.console && root.console[level]) root.console[level]('[cb_api_base] ' + text);
    } catch (_) {}
  }
  /** env = { host, stored, cbApi, remove } (all optional; the page's own values are read when absent). Returns the api base. */
  function resolve(env) {
    env = env || {};
    var host = String(env.host !== undefined ? env.host : (root.location && root.location.hostname) || '').toLowerCase();
    var cbApi = env.cbApi !== undefined ? env.cbApi : root.CB_API || '';
    var stored = env.stored;
    if (stored === undefined) {
      try {
        stored = root.localStorage.getItem(KEY);
      } catch (_) {
        stored = null;
      }
    }
    var page = LOCAL.test(host) ? 'http://localhost:3000' : cbApi;
    if (!stored) return page;
    if (!allowedHost(host)) {
      say('warn', 'IGNORED on this host: the api base is fixed here. A stored override was removed.');
      try {
        (env.remove || function () { root.localStorage.removeItem(KEY); })();
      } catch (_) {}
      return cbApi;
    }
    if (stored === 'stage') return cbApi;
    if (!allowedTarget(stored)) {
      say('error', 'IGNORED: "' + String(stored).slice(0, 60) + '" is not localhost or a *.sslip.io SIT address.');
      return page;
    }
    say('warn', 'OVERRIDE IN USE: every request goes to ' + stored + ' (not the page default). Remove it with localStorage.removeItem("cb_api_base").');
    return stored;
  }
  root.CBApiBase = { resolve: resolve, get: function () { return resolve(); }, allowedHost: allowedHost, allowedTarget: allowedTarget };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBApiBase;
})(typeof window !== 'undefined' ? window : globalThis);
