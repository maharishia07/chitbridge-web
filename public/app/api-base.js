/**
 * public/app/api-base.js — CBApiBase: THE ONE reader of where this page's api is (the cb_api_base override included)
 *
 * OWNS      the api base for every page and app file; the only place that reads localStorage.cb_api_base (e2e/guard-apibase.cjs fails on a second reader)
 * CALLED BY app.html CFG.API_BASE · app/shell.js apiBase · app/assign-bar.js · app/books-clients-door.js · app/books-practice.js · accounts/crm/finance/standards.html CFG; loaded right after /config.js
 * FLOW      resolve(env) → on a production host: the built-in window.CB_API, any override ignored and removed, said in the console → on a local or SIT host (localhost, 127.0.0.1, *.sslip.io): the override, only if it points at localhost, 127.0.0.1 or *.sslip.io, said loudly in the console → else the page default
 * CARD      18-identity-sign-in-and-access/api-base
 * ID        CMP054
 * OWNER     cb-security
 * RISK      security
 *
 * Why: a stored override once honoured on production sends every later request, session token included, to whatever host was stored
 * (a shared counter PC, an XSS, a pasted "fix"). Production never reads it. (SEC, batch 1129; OWASP ASVS 5.1 / API8 misconfiguration)
 */
(function (root) {
  'use strict';
  var KEY = 'cb_api_base';
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;
  var SIT_HOST = /^[a-z0-9-]+\.sslip\.io$/;
  /** a failure here must never break the page: it is recorded when the page's cbQuiet is loaded (it is loaded after this file), else dropped */
  function noteFailure(what, failure) {
    if (typeof root.cbQuiet === 'function') root.cbQuiet('api-base: ' + what, failure);
  }
  function allowedHost(host) {
    var name = String(host || '').toLowerCase();
    return LOCAL.test(name) || SIT_HOST.test(name);
  }
  /** the override's own address: http(s) to localhost, 127.0.0.1 or a *.sslip.io SIT box, nothing else */
  function allowedTarget(value) {
    try {
      var url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && allowedHost(url.hostname);
    } catch (failure) {
      noteFailure('the stored override is not an address, it is refused', failure);
      return false;
    }
  }
  function sayInConsole(level, text) {
    try {
      if (root.console && root.console[level]) root.console[level]('[cb_api_base] ' + text);
    } catch (failure) {
      noteFailure('the console is not there, the notice is not shown', failure);
    }
  }
  /** the stored override as the page holds it (null when the browser will not say) */
  function readStored(env) {
    if (env.stored !== undefined) return env.stored;
    try {
      return root.localStorage.getItem(KEY);
    } catch (failure) {
      noteFailure('the browser would not give the stored override, none is used', failure);
      return null;
    }
  }
  /** a production host: the override is dropped (through env.remove when given) and the built-in address stands */
  function dropOverride(env, cbApi) {
    sayInConsole('warn', 'IGNORED on this host: the api base is fixed here. A stored override was removed.');
    try {
      (env.remove || function () { root.localStorage.removeItem(KEY); })();
    } catch (failure) {
      noteFailure('the stored override could not be removed, it is still ignored', failure);
    }
    return cbApi;
  }
  /** the host name this page runs on (env.host when given), lower case */
  function hostOf(env) {
    return String(env.host !== undefined ? env.host : (root.location && root.location.hostname) || '').toLowerCase();
  }
  /** a stored override is present: on a production host it is dropped, on a local or SIT host it is used only when it points at a local or SIT address */
  function applyStored(env, stored, host, page, cbApi) {
    if (!allowedHost(host)) return dropOverride(env, cbApi);
    if (stored === 'stage') return cbApi;
    if (!allowedTarget(stored)) {
      sayInConsole('error', 'IGNORED: "' + String(stored).slice(0, 60) + '" is not localhost or a *.sslip.io SIT address.');
      return page;
    }
    sayInConsole('warn', 'OVERRIDE IN USE: every request goes to ' + stored + ' (not the page default). Remove it with localStorage.removeItem("cb_api_base").');
    return stored;
  }
  /** env = { host, stored, cbApi, remove } (all optional; the page's own values are read when absent). Returns the api base. */
  function resolve(env) {
    env = env || {};
    var host = hostOf(env);
    var cbApi = env.cbApi !== undefined ? env.cbApi : root.CB_API || '';
    var stored = readStored(env);
    var page = LOCAL.test(host) ? 'http://localhost:3000' : cbApi;
    return stored ? applyStored(env, stored, host, page, cbApi) : page;
  }
  root.CBApiBase = { resolve: resolve, get: function () { return resolve(); }, allowedHost: allowedHost, allowedTarget: allowedTarget };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CBApiBase;
})(typeof window !== 'undefined' ? window : globalThis);
