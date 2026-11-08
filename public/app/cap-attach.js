/**
 * OWNS attaching a capability to a page without the app's globals · CALLED BY any page: <script src="/app/cap-attach.js" data-cap data-area data-token>
 * FLOW  tag → define what the host lacks (api tx esc ensureCap) → load the capability → open it
 * CARD 29-qa-test-tooling-ux-locale-and-design-system/test-board
 * CAP-5 · SEC-29 · SEC-30: the token is the only session input; the path addresses; a write carries client_ref.
 * The doors copy app.html's EP rows for this capability (e2e/capability-bare-page.cjs fails on drift); weight is gzip-measured there.
 */
(function () {
  var win = window;
  var tag = (document.currentScript && document.currentScript.dataset) || {};
  var capability = tag.cap || 'testing';
  var doors = {};
  ('testCases GET cases,testResults GET results,testRecord POST results,testStale GET stale,testCoverage GET coverage,testCaseAdd POST cases/import,' +
    'testCaseWrite POST cases/import,testSeed POST cases/seed,testCaseClose POST cases/close,testReqList GET requirements,testReqRaise POST requirements,' +
    'testReqSet PATCH requirements/:id,testIncList GET incidents,testIncNew POST incidents,testIncSet PATCH incidents/:id,testTraceGet GET trace,' +
    'testTraceSet POST trace,testShot POST evidence')
    .split(',')
    .forEach(function (row) {
      var part = row.split(' ');
      doors[part[0]] = { method: part[1], path: part[2] };
    });
  var openers = {
    testing: function () {
      if (tag.area) win.CBTEST.area = tag.area;
      win.testLabOpen();
    }
  };

  function loadScript(address) {
    return new Promise(function (resolve, reject) {
      var node = document.createElement('script');
      node.src = address;
      node.onload = resolve;
      node.onerror = function () {
        reject(new Error(address));
      };
      document.head.appendChild(node);
    });
  }

  /* the same body in the same attempt carries the same ref, so a double tap is one row */
  function refOf(text) {
    for (var index = 0, hash = 5381; index < text.length; index++) hash = (hash * 33 + text.charCodeAt(index)) | 0;
    return 'a' + (hash >>> 0).toString(36);
  }

  function callDoor(name, opts) {
    var door = doors[name];
    if (!door) return Promise.reject(new Error(name));
    if (!tag.token) return Promise.reject(new Error('Sign in again to record results'));
    opts = opts || {};
    var path = door.path.replace(/:(\w+)/g, function (_, key) {
      return encodeURIComponent((opts.params || {})[key]);
    });
    var query = Object.keys(opts.query || {})
      .map(function (key) {
        return key + '=' + encodeURIComponent(opts.query[key]);
      })
      .join('&');
    var headers = { Authorization: 'Bearer ' + tag.token };
    var body;
    if (door.method !== 'GET') {
      var payload = Object.assign({}, opts.body);
      if (door.method === 'POST' && !payload.client_ref) payload.client_ref = refOf(name + JSON.stringify(payload));
      body = JSON.stringify(payload);
      headers['Content-Type'] = 'application/json';
    }
    return fetch((win.CB_API || '') + '/api/testing/' + path + (query ? '?' + query : ''), { method: door.method, headers: headers, body: body, credentials: 'omit' }).then(
      function (reply) {
        if (reply.status === 401) throw new Error('Sign in again to record results');
        return reply.json().then(function (json) {
          if (!reply.ok) throw new Error(json.error || 'Failed');
          return json && 'data' in json ? json.data : json;
        });
      }
    );
  }

  if (typeof win.api !== 'function') win.api = callDoor;
  if (typeof win.tx !== 'function') win.tx = function (words) { return words; };
  if (typeof win.esc !== 'function') {
    win.esc = function (value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) { return '&#' + char.charCodeAt(0) + ';'; });
    };
  }
  if (typeof win.ensureCap !== 'function') win.ensureCap = function (name) { return loadScript('/app/cap-' + name + '.js'); };

  (win.CBList ? Promise.resolve() : loadScript('/app/list-ctl.js'))
    .then(function () { return win.ensureCap(capability); })
    .then(function () { if (openers[capability]) openers[capability](); });
})();
