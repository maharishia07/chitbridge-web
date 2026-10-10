/**
 * embed-host.js — CBEmbed: open one of the small apps INSIDE another page, in a dialog, and hear what happened there.
 * P1 (2026-10-10). Tasks & Orders will use the same helper for its own embeds; nothing here knows about employees.
 *
 *   var h = CBEmbed.open({ app: 'employees', view: 'add', title: 'Add a person',
 *                          onMessage: function (m) { ... }, onClose: function () { ... } });   h.close()
 *
 * The embed page is /<app>.html?embed=1&view=<view>. It tells its host with window.parent.postMessage({ cb: <app>, event, person? }, origin).
 * Only a message from THIS iframe, from this page's own origin, with cb === app is heard; `event: 'close'` closes the dialog.
 * Same origin only: the sign-in is the browser's own saved session, so nothing is passed in the address.
 */
(function (root) {
  'use strict';
  function open(o) {
    var doc = root.document, d = doc.createElement('dialog'), f = doc.createElement('iframe'), x = doc.createElement('button');
    var src = '/' + o.app + '.html?embed=1' + (o.view ? '&view=' + encodeURIComponent(o.view) : '');
    d.setAttribute('data-testid', 'embed-' + o.app);
    d.style.cssText = 'border:1px solid var(--line,#DDD6C6);border-radius:14px;padding:0;width:min(560px,96vw);height:min(640px,90vh);background:var(--card,#fff);overflow:hidden';
    f.src = src; f.title = o.title || o.app; f.setAttribute('data-testid', 'embed-frame');
    f.style.cssText = 'border:0;width:100%;height:100%;display:block';
    x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', 'Close'); x.title = 'Close';
    x.style.cssText = 'position:absolute;right:8px;top:8px;z-index:2;border:0;background:transparent;font-size:18px;cursor:pointer;color:inherit';
    d.appendChild(f); d.appendChild(x); doc.body.appendChild(d);
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      root.removeEventListener('message', heard);
      try { d.close(); } catch (_) {}
      d.remove();
      if (o.onClose) o.onClose();
    }
    function heard(e) {
      if (e.source !== f.contentWindow || e.origin !== root.location.origin) return;
      var m = e.data; if (!m || m.cb !== o.app) return;
      if (m.event === 'close') return close();
      if (o.onMessage) o.onMessage(m);
    }
    root.addEventListener('message', heard);
    x.onclick = close;
    d.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    try { d.showModal(); } catch (_) { d.setAttribute('open', ''); }
    return { close: close };
  }
  root.CBEmbed = { open: open };
})(typeof window !== 'undefined' ? window : globalThis);
