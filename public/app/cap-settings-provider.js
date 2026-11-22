/* public/app/cap-settings-provider.js — CB Settings › Account: "Sign in with Google", the Connect and Disconnect row (SSO-1129, SEC-112 P1a). Split out of cap-settings.js (web split 1129).
 * OWNS      the Google link row: who is connected, Connect / Disconnect with the person's PIN, the greyed sentence when it may not run, and the redirect-back result words
 * CALLED BY public/app/cap-settings.js (CBSettingsProvider.mount, in the Account section), loaded first through CAP_WITH.settings (app.html) and a script tag in settings.html
 * FLOW      mount(ctx) ──▶ GET providerLinks ──▶ the row ──▶ providerLinkStart (follow the api's address) | providerUnlink ──▶ result words from CBSignin.takeLanded (sessionStorage)
 * CARD      28-platform-and-operations/settings
 * RISK      security (the api re-proves the PIN; the page links nothing itself)
 * Host globals: api · CBAction · CBSignin (optional) · esc · tx. ctx = { H, bar, btn, load } from cap-settings.js: the section's state and its three drawing helpers.
 */
'use strict';
(function (root) {
  function T(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function $(id) {
    return root.document.getElementById(id);
  }
  /** paints the row and reads its list; the same calls the Account section made inline before the split */
  function mount(ctx) {
    var H = ctx.H, bar = ctx.bar, btn = ctx.btn, load = ctx.load;
    /* ⭐ SSO-1129 CONNECT (SEC-112 P1a): Google linked to THIS account. Connect and Disconnect each carry the person's PIN (re-proof, checked by the api); both are SHOWN and greyed with the sentence
       while the provider is not switched on here (GET /api/signin/provider/links: providers[].live) or the business does not accept it. The row says who is connected; never a subject. */
    function provRow() {
      var d = H.data.prov || {},
        r = d.r || {},
        link = (r.links || []).filter(function (item) { return item.provider === 'google'; })[0] || null,
        host = (r.providers || []).filter(function (item) { return item.key === 'google'; })[0] || null;
      return { link: link, host: host, state: d.state, reproof: r.reproof };
    }
    function provWhy(row) {
      if (row.state === 'loading') return T('Checking.');
      if (row.state === 'error') return T('Could not read this. Try again.');
      if (!row.host) return T('Google sign-in is being switched on.');
      if (row.host.live !== true) return T('Google sign-in is being switched on.');
      if (row.host.accepted !== true && !row.link) return T('This business does not accept Google sign-in.');
      /* N1 (critic round 2): the api says which re-proof this person can give; a person with no PIN has none to type here, so both buttons are shown greyed with the way out */
      if (row.reproof === 'code') return T('Set a PIN first.');
      return '';
    }
    function paintProvBar() {
      var row = provRow(),
        why = provWhy(row),
        may = why ? { ok: false, why: why } : null;
      $('sx_prov_bar').innerHTML = bar(
        '<span class="sx-count" data-testid="sx-prov-state">' +
          esc(row.link ? T('Connected') + (row.link.email ? ' · ' + row.link.email : '') : T('Not connected')) +
          '</span>' +
          (why ? '' : '<input data-cbsid="ACC002-I31" id="sx_prov_pin" data-testid="sx-prov-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="' + esc(T('Your PIN')) + '" aria-label="' + esc(T('Your PIN')) + '" style="width:6em;margin-inline-end:8px">') +
          (row.link ? btn('sx_prov_off', T('Disconnect Google'), may, '', 'ACC002-B62') : '') +
          (row.link ? '' : btn('sx_prov_on', T('Connect Google'), may, '', 'ACC002-B63'))
      );
      var pinOf = function () { return ($('sx_prov_pin') || {}).value || ''; };
      var say = function (words) { $('sx_prov_out').textContent = words; };
      if ($('sx_prov_on') && !why)
        $('sx_prov_on').onclick = function () {
          CBAction.run($('sx_prov_on'), function () {
            return api('providerLinkStart', { body: { provider: 'google', pin: pinOf(), next: '/app.html' } });
          }, {
            key: 'sx-prov-on',
            failed: T('Could not connect it. Check your PIN.'),
            out: 'sx_prov_out',
            outcome: function (reply) {
              var url = reply && (reply.url || (reply.body && reply.body.url));
              if (url) window.location.assign(url);
            }
          });
        };
      if ($('sx_prov_off') && !why)
        $('sx_prov_off').onclick = function () {
          CBAction.run($('sx_prov_off'), function () {
            return api('providerUnlink', { params: { link_id: row.link.link_id }, body: { pin: pinOf() } });
          }, {
            key: 'sx-prov-off',
            confirm: { title: T('Disconnect Google?'), body: esc(T('You will sign in with your PIN or code instead.')), yes: T('Disconnect'), danger: true },
            failed: T('Could not disconnect it. Check your PIN.'),
            out: 'sx_prov_out',
            outcome: function () {
              say(T('Disconnected.'));
              readProv();
            }
          });
        };
    }
    function readProv() {
      return load('prov', function () { return api('providerLinks'); }, null, paintProvBar);
    }
    paintProvBar();
    readProv().then(function () {
      /* the redirect back from the provider left a result word (app.html boot, CBSignin.takeLanded): said once, in words */
      var word = null;
      try { word = sessionStorage.getItem('cb_connect_result'); sessionStorage.removeItem('cb_connect_result'); } catch (_) {}
      if (word && window.CBSignin) $('sx_prov_out').textContent = T(CBSignin.WORDS.connect[word] || CBSignin.WORDS.connect.fallback);
      /* N2: the provider's redirect left a one-time confirm code (#k=); ONLY this session, which started the link, can turn it into a link (the callback alone wrote nothing) */
      var code = null;
      try { code = sessionStorage.getItem('cb_connect_code'); sessionStorage.removeItem('cb_connect_code'); } catch (_) {}
      if (code) {
        $('sx_prov_out').textContent = T('Connecting.');
        api('providerLinkFinish', { body: { code: code } }).then(
          function () {
            $('sx_prov_out').textContent = T(CBSignin.WORDS.connect.linked);
            readProv();
          },
          function (e) {
            var said = e && e.status >= 400 && e.status < 500 && e.message && !/^API \d/.test(e.message) ? e.message : CBSignin.WORDS.connect.fallback;
            $('sx_prov_out').textContent = T(said);
          }
        );
      }
    });
  }
  root.CBSettingsProvider = { mount: mount };
})(window);
