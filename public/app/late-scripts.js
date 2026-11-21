/**
 * public/app/late-scripts.js — CBLate: the scripts a page's first screen does not need load AFTER it is usable, in their written order
 *
 * OWNS      reading every <script type="cb-late" src> tag of the page (written where it used to be a plain tag, so the order and the
 *           comment stay readable) · fetching them all at once after the page's load event and running them in the written order
 *           (a script inserted with async=false) · ready(group) = a promise that settles when that group's last script has run
 * CALLED BY accounts.html and finance.html (loaded before the first late tag) · the views of those pages and chit-sheet.js open() wait on ready()
 * FLOW      load event → start() → one <script async=false> per tag → each tag's data-late-group resolves its group → ready(group) resolves
 * OWNER     cb-speed
 * RISK      plain
 * ID        LIB002
 * CARD      23-speed/first-open (batch 1128 fixSpeed: Accounts 111 and Finance 64 blocking scripts, 3.7 MB, before the first paint)
 *
 * Decides nothing: a screen that needs a late script waits for ready() and then runs exactly the code it ran before; it never runs without it.
 * A tag written as type="cb-late" is a tag the browser leaves alone until this file starts it, so a page without this file would not load it —
 * tests/late-scripts.test.cjs holds the pages to that.
 */
(function (root) {
  'use strict';
  var groups = {};
  var started = false;
  var tags = [];
  var allDone = null;

  function groupOf(name) {
    if (!groups[name]) {
      var group = { name: name, left: 0, failed: [], resolve: null };
      group.promise = new root.Promise(function (resolve) {
        group.resolve = resolve;
      });
      groups[name] = group;
    }
    return groups[name];
  }

  function settle(group, src, ok) {
    if (!ok) group.failed.push(src);
    group.left -= 1;
    if (group.left <= 0) group.resolve(group.failed.length ? { failed: group.failed } : { failed: [] });
  }

  /** one tag → one real script, run in the order the tags are written */
  function runTag(tag) {
    var group = groupOf(tag.getAttribute('data-late-group') || 'late');
    var node = root.document.createElement('script');
    node.async = false;
    node.src = tag.getAttribute('src');
    node.onload = function () {
      settle(group, node.src, true);
    };
    node.onerror = function () {
      settle(group, node.src, false);
      if (typeof root.cbQuiet === 'function') root.cbQuiet('late script not loaded', node.src);
    };
    root.document.head.appendChild(node);
  }

  /** begin now (idempotent): the page calls it from its load event, or a screen that cannot wait calls it through ready() */
  function start() {
    if (started) return allDone;
    started = true;
    tags = Array.prototype.slice.call(root.document.querySelectorAll('script[type="cb-late"][src]'));
    tags.forEach(function (tag) {
      groupOf(tag.getAttribute('data-late-group') || 'late').left += 1;
    });
    tags.forEach(runTag);
    allDone = root.Promise.all(
      Object.keys(groups).map(function (n) {
        return groups[n].promise;
      })
    );
    return allDone;
  }

  /** ready(group) → a promise for that group's scripts having run; ready() → all of them. A screen waits on it, never past a failed script silently. */
  function ready(name) {
    start();
    if (!name) return allDone;
    return groupOf(name).promise;
  }

  /** is everything the page deferred already running? (a screen may then paint without waiting) */
  function isReady() {
    return started && tags.every(function (tag) {
      return groupOf(tag.getAttribute('data-late-group') || 'late').left <= 0;
    });
  }

  root.CBLate = { start: start, ready: ready, isReady: isReady };
  if (root.document.readyState === 'complete') root.setTimeout(start, 0);
  else root.addEventListener('load', function () {
    root.setTimeout(start, 0);
  });
})(typeof window !== 'undefined' ? window : globalThis);
