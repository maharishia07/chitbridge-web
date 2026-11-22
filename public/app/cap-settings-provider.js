/* public/app/cap-settings-provider.js — CB Settings › Account: "Sign in with Google", the Connect and Disconnect row (SSO-1129, SEC-112 P1a). Split out of cap-settings.js (web split 1129).
 * ID        ACC002
 * OWNER     cb-settings
 * OWNS      the Google link row: who is connected, Connect / Disconnect with the person's PIN, the greyed sentence when it may not run, and the redirect-back result words
 * CALLED BY public/app/cap-settings.js (CBSettingsProvider.mount, in the Account section), loaded first through CAP_WITH.settings (app.html) and a script tag in settings.html
 * FLOW      mount(ctx) ──▶ GET providerLinks ──▶ the row ──▶ providerLinkStart (follow the api's address) | providerUnlink ──▶ result words from CBSignin.takeLanded (sessionStorage)
 * CARD      28-platform-and-operations/settings
 * RISK      security (the api re-proves the PIN; the page links nothing itself)
 * Host globals: api · CBAction · CBSignin (optional) · esc · tx. ctx = { H, bar, btn, load } from cap-settings.js: the section's state and its three drawing helpers.
 */
'use strict';
(function (root) {
  /** the string layer: the words through tx when the page has it */
  function inWords(text) {
    return typeof root.tx === 'function' ? root.tx(text) : text;
  }
  /** the element of this page with that id */
  function byId(id) {
    return root.document.getElementById(id);
  }
  /** what the row tells the person under the buttons */
  function sayOut(words) {
    byId('sx_prov_out').textContent = words;
  }
  /** a storage read that fails is recorded, and the person simply has no waiting word */
  function takeStored(key) {
    var value = null;
    try {
      value = root.sessionStorage.getItem(key);
      root.sessionStorage.removeItem(key);
    } catch (failure) {
      if (root.cbQuiet) root.cbQuiet('settings-provider:' + key, failure);
    }
    return value;
  }
  /** the redirect back from the provider left a result word (app.html boot, CBSignin.takeLanded): said once, in words */
  function sayLandedWord() {
    var word = takeStored('cb_connect_result');
    if (word && root.CBSignin) sayOut(inWords(root.CBSignin.WORDS.connect[word] || root.CBSignin.WORDS.connect.fallback));
  }
  /** N2: the provider's redirect left a one-time confirm code (#k=); ONLY this session, which started the link, can turn it into a link (the callback alone wrote nothing) */
  function spendLandedCode(ctx) {
    var code = takeStored('cb_connect_code');
    if (!code) return;
    sayOut(inWords('Connecting.'));
    root.api('providerLinkFinish', { body: { code: code } }).then(
      function () {
        sayOut(inWords(root.CBSignin.WORDS.connect.linked));
        readProv(ctx);
      },
      function (refusal) {
        var said = refusal && refusal.status >= 400 && refusal.status < 500 && refusal.message && !/^API \d/.test(refusal.message) ? refusal.message : root.CBSignin.WORDS.connect.fallback;
        sayOut(inWords(said));
      }
    );
  }
  /** ⭐ SSO-1129 CONNECT (SEC-112 P1a): Google linked to THIS account. Connect and Disconnect each carry the person's PIN (re-proof, checked by the api); both are SHOWN and greyed with the sentence
     while the provider is not switched on here (GET /api/signin/provider/links: providers[].live) or the business does not accept it. The row says who is connected; never a subject. */
  function provRow(ctx) {
    var data = ctx.H.data.prov || {},
      reply = data.r || {},
      link = (reply.links || []).filter(function (item) { return item.provider === 'google'; })[0] || null,
      host = (reply.providers || []).filter(function (item) { return item.key === 'google'; })[0] || null;
    return { link: link, host: host, state: data.state, reproof: reply.reproof };
  }
  /** the sentence that greys both buttons while the row may not run, or an empty string when it may */
  function provWhy(row) {
    if (row.state === 'loading') return inWords('Checking.');
    if (row.state === 'error') return inWords('Could not read this. Try again.');
    if (!row.host) return inWords('Google sign-in is being switched on.');
    if (row.host.live !== true) return inWords('Google sign-in is being switched on.');
    if (row.host.accepted !== true && !row.link) return inWords('This business does not accept Google sign-in.');
    /* N1 (critic round 2): the api says which re-proof this person can give; a person with no PIN has none to type here, so both buttons are shown greyed with the way out */
    if (row.reproof === 'code') return inWords('Set a PIN first.');
    return '';
  }
  /** the PIN the person typed in the row, or an empty string */
  function pinOf() {
    return (byId('sx_prov_pin') || {}).value || '';
  }
  /** the row: who is connected, the PIN box and the one button that fits (Connect or Disconnect), greyed with the sentence when it may not run */
  function provBarHtml(ctx, row, whyNot) {
    var mayRun = whyNot ? { ok: false, why: whyNot } : null;
    return ctx.bar(
      '<span class="sx-count" data-testid="sx-prov-state">' +
        esc(row.link ? inWords('Connected') + (row.link.email ? ' · ' + row.link.email : '') : inWords('Not connected')) +
        '</span>' +
        (whyNot ? '' : '<input data-cbsid="ACC002-I31" id="sx_prov_pin" data-testid="sx-prov-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="' + esc(inWords('Your PIN')) + '" aria-label="' + esc(inWords('Your PIN')) + '" style="width:6em;margin-inline-end:8px">') +
        (row.link ? ctx.btn('sx_prov_off', inWords('Disconnect Google'), mayRun, '', 'ACC002-B62') : '') +
        (row.link ? '' : ctx.btn('sx_prov_on', inWords('Connect Google'), mayRun, '', 'ACC002-B63'))
    );
  }
  /** Connect: the api gives the provider address (with the PIN as re-proof) and the page follows it */
  function wireConnect() {
    /* the click: one CBAction run (busy state, the failure sentence under the row), then the page follows the address the api returned */
    byId('sx_prov_on').onclick = function () {
      CBAction.run(byId('sx_prov_on'), function () {
        return api('providerLinkStart', { body: { provider: 'google', pin: pinOf(), next: '/app.html' } });
      }, {
        key: 'sx-prov-on',
        failed: inWords('Could not connect it. Check your PIN.'),
        out: 'sx_prov_out',
        outcome: function (reply) {
          var url = reply && (reply.url || (reply.body && reply.body.url));
          if (url) window.location.assign(url);
        }
      });
    };
  }
  /** Disconnect: asks first, then the api unlinks with the PIN as re-proof and the row reads again */
  function wireDisconnect(ctx, row) {
    /* the click: one CBAction run behind a confirm, then the words and a fresh read of the links */
    byId('sx_prov_off').onclick = function () {
      CBAction.run(byId('sx_prov_off'), function () {
        return api('providerUnlink', { params: { link_id: row.link.link_id }, body: { pin: pinOf() } });
      }, {
        key: 'sx-prov-off',
        confirm: { title: inWords('Disconnect Google?'), body: esc(inWords('You will sign in with your PIN or code instead.')), yes: inWords('Disconnect'), danger: true },
        failed: inWords('Could not disconnect it. Check your PIN.'),
        out: 'sx_prov_out',
        outcome: function () {
          sayOut(inWords('Disconnected.'));
          readProv(ctx);
        }
      });
    };
  }
  /** draws the row and wires the button that is not greyed */
  function paintProvBar(ctx) {
    var row = provRow(ctx),
      whyNot = provWhy(row);
    byId('sx_prov_bar').innerHTML = provBarHtml(ctx, row, whyNot);
    if (byId('sx_prov_on') && !whyNot) wireConnect();
    if (byId('sx_prov_off') && !whyNot) wireDisconnect(ctx, row);
  }
  /** reads the links again and repaints the row when the answer comes */
  function readProv(ctx) {
    return ctx.load('prov', function () { return api('providerLinks'); }, null, function () { paintProvBar(ctx); });
  }
  /** paints the row and reads its list; the same calls the Account section made inline before the split */
  function mount(ctx) {
    paintProvBar(ctx);
    readProv(ctx).then(function () {
      sayLandedWord();
      spendLandedCode(ctx);
    });
  }
  root.CBSettingsProvider = { mount: mount };
})(window);
