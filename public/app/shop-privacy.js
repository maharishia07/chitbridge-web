/**
 * shop-privacy.js — CBShopPrivacy: the SHOPPER's own privacy sheet on the storefront (shop.html), beside My orders. T3-P3-CONSENT (2026-10-14).
 *
 * What it paints is the server's answer, GET /api/privacy/me (chitbridge-api routes/privacy.js, a storefront token only): what the shop holds
 * about this person (a null is said as "Not held"), the shop's country's law in its own words (lib/privacy.lawOf — DPDP · Privacy Act · PDPL,
 * or "no pack yet"; never a national default), consent for offers per channel (the server's code picks the chip; the button that CHANGES the
 * state is the only one drawn), the requests the law gives (`law.kinds` — the server's list, never a regex), and the requests already made.
 * A yes/no is ONE POST /me/consent (the same notePref the shop's staff write through); a copy / erasure is RECORDED (POST /me/requests) and
 * answered by the shop — erasure itself only through the platform's lifecycle path, never from this sheet.
 *
 *   CBShopPrivacy.open({ api, token, host, sheet(inner), done })   api = the api base · token = the order's session (memory only) · host = the
 *   sheet's element · sheet = shop.html's shopSheet · done = its Done button markup
 *
 * ⭐ REUSE: shop.html's sheet, tokens and classes (.sg · .meta); helpers.js esc. ⭐ NEW PATH: no storefront screen showed a shopper their data.
 * The server decides: may_consent / may_request carry { may, code, why } — a refused button is greyed WITH its sentence, never hidden.
 */
(function (root) {
  'use strict';
  if (root.CBShopPrivacy) return;
  var S = { o: null, d: null, busy: false };
  var CH = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'E-mail', phone: 'Phone', chitbridge: 'ChitBridge' };
  var ORDER = ['whatsapp', 'sms', 'email', 'phone', 'chitbridge'];
  var KIND = { access: 'A copy of my data', correct: 'Correct my data', erase: 'Erase my data', withdraw: 'Withdraw consent', nominate: 'Name a nominee', grievance: 'Raise a grievance' };
  var OUT = { done: 'Done', partly: 'Partly done', refused: 'Refused' };
  var WORD = { CONSENT: ['Yes', 'ok'], NO_CONSENT: ['Not asked', ''], CONSENT_WITHDRAWN: ['Withdrawn', 'no'], SAID_NO: ['No', 'no'], OPTED_OUT: ['Stopped', 'no'], LEGITIMATE_USE: ['Allowed', ''] };
  var e_ = function (s) { return typeof root.esc === 'function' ? root.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var day = function (iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
  var BTN = 'border:1px solid var(--accent,#3F66A6);border-radius:9px;padding:7px 12px;background:var(--card,#fff);color:var(--accent,#3F66A6);font-weight:700;font-size:13px;cursor:pointer';
  var OFF = 'border:1px solid var(--line,#e7e3d8);border-radius:9px;padding:7px 12px;background:var(--card,#fff);color:var(--ink-3,#8A8374);font-weight:700;font-size:13px;cursor:not-allowed';
  var CHIP = { '': 'background:var(--panel,#F3EFE6);color:var(--ink-2,#3a4048)', ok: 'background:var(--ok-soft,#E8F4ED);color:var(--ok-2,#0D4A2B)', no: 'background:var(--disp-soft,#FBEAE3);color:var(--disp,#8E3517)' };

  function req(method, path, body) {
    var o = S.o;
    return fetch(o.api + path, { method: method, headers: Object.assign({ Authorization: 'Bearer ' + o.token }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j || {} }; }); });
  }
  var head = function (t) { return '<div class="sg" style="font-weight:800;font-size:17px;margin-bottom:6px" data-testid="shop-priv-title">' + e_(t) + '</div>'; };
  var sec = function (t, inner, tid) { return '<div style="margin-top:14px" data-testid="' + tid + '"><div style="font-weight:700;font-size:13.5px;margin-bottom:4px">' + e_(t) + '</div>' + inner + '</div>'; };
  var chip = function (v, tid) { var w = WORD[(v || {}).code] || ['Unknown', '']; return '<span style="display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:700;' + CHIP[w[1]] + '" title="' + e_((v || {}).why || '') + '" data-testid="' + tid + '" data-code="' + e_((v || {}).code || '') + '">' + e_(w[0]) + '</span>'; };
  var btn = function (label, data, tid, why) { return '<button type="button" ' + data + ' data-testid="' + tid + '" style="' + (why ? OFF : BTN) + '"' + (why ? ' disabled aria-disabled="true" title="' + e_(why) + '"' : '') + '>' + e_(label) + '</button>'; };
  var paintErr = function (msg) { var o = S.o; o.host.innerHTML = o.sheet(head('Your privacy') + '<div class="meta" data-testid="shop-priv-err" style="color:var(--disp,#b4453f)">' + e_(msg) + '</div><div style="display:flex;gap:8px;margin-top:14px"><button type="button" onclick="CBShopPrivacy.reload()" style="' + BTN + ';flex:1">Try again</button>' + o.done + '</div>'); };

  function paint() {
    var o = S.o, d = S.d, law = d.law || {}, shop = (d.shop && d.shop.name) || 'this shop';
    var lawLine = law.known ? '<b>' + e_(law.short || law.law) + '</b> · ' + e_(law.consent || '') : e_(law.note || '');
    var held = (d.held || []).map(function (h) { return '<div style="display:flex;gap:10px;font-size:13px;padding:3px 0;border-top:1px dashed var(--line,#e7e3d8)" data-testid="shop-priv-held-' + e_(h.key) + '"><span style="flex:0 0 42%;color:var(--ink-2,#3a4048)">' + e_(h.label) + '</span><span style="flex:1' + (h.value ? '' : ';color:var(--ink-3,#8A8374)') + '">' + e_(h.value || 'Not held') + '</span></div>'; }).join('');
    var mc = d.may_consent || { may: true }, whyC = mc.may ? '' : (mc.why || 'Not available yet.');
    var may = (d.consent && d.consent.may) || {};
    var offers = ORDER.map(function (c) {
      var v = (may[c] || {}).marketing || { code: 'NO_CONSENT' };
      var b = v.may ? btn('No', 'data-priv="consent" data-ch="' + c + '" data-v="0"', 'shop-priv-no-' + c, whyC) : btn('Yes', 'data-priv="consent" data-ch="' + c + '" data-v="1"', 'shop-priv-yes-' + c, whyC);
      return '<div style="display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0;border-top:1px dashed var(--line,#e7e3d8)" data-testid="shop-priv-ch-' + c + '"><span style="flex:1">' + e_(CH[c]) + '</span>' + chip(v, 'shop-priv-chip-' + c) + b + '</div>';
    }).join('');
    var mr = d.may_request || { may: true }, whyR = mr.may ? '' : (mr.why || 'Not available yet.');
    var kinds = (law.kinds || Object.keys(KIND)).filter(function (k) { return KIND[k]; });
    var ask = '<div style="display:flex;flex-wrap:wrap;gap:6px">' + kinds.map(function (k) { return btn(KIND[k], 'data-priv="request" data-kind="' + k + '"', 'shop-priv-ask-' + k, whyR); }).join('') + '</div>'
      + (whyR ? '<div class="meta" data-testid="shop-priv-ask-why">' + e_(whyR) + '</div>' : '')
      + '<div class="meta" style="margin-top:6px">' + e_('The shop answers within ' + (law.due_days || 30) + ' days. Erasure runs through ChitBridge’s lifecycle path.') + '</div>';
    var reqs = ((d.requests && d.requests.requests) || []);
    var made = reqs.length ? reqs.map(function (r) { return '<div style="display:flex;gap:8px;font-size:13px;padding:3px 0;border-top:1px dashed var(--line,#e7e3d8)" data-testid="shop-priv-req"><span style="flex:1">' + e_(KIND[r.kind] || r.kind) + '</span><span style="color:var(--ink-2,#3a4048)">' + e_(r.answered_at ? (OUT[r.outcome] || 'Answered') + ' · ' + day(r.answered_at) : 'Due ' + day(r.due_at)) + '</span></div>'; }).join('') : '';
    var msg = '<div class="meta" id="shop_priv_msg" role="status" data-testid="shop-priv-msg" style="min-height:1em"></div>';
    o.host.innerHTML = o.sheet(head('Your privacy') + '<div class="meta" data-testid="shop-priv-law">' + lawLine + '</div>'
      + sec('What ' + shop + ' holds', held, 'shop-priv-held')
      + sec('Offers from ' + shop, offers + (whyC ? '<div class="meta" data-testid="shop-priv-consent-why">' + e_(whyC) + '</div>' : ''), 'shop-priv-offers')
      + sec('Ask the shop', ask, 'shop-priv-ask')
      + (made ? sec('Your requests', made, 'shop-priv-made') : '')
      + msg + '<div style="display:flex;margin-top:14px">' + o.done + '</div>');
    o.host.onclick = onClick;
  }
  function onClick(ev) {
    var t = ev.target.closest && ev.target.closest('[data-priv]'); if (!t || t.disabled || S.busy) return;
    var a = t.getAttribute('data-priv'), msg = function (s) { var m = root.document.getElementById('shop_priv_msg'); if (m) m.textContent = s; };
    S.busy = true;
    var p = a === 'consent' ? req('POST', '/api/privacy/me/consent', { channel: t.getAttribute('data-ch'), purpose: 'marketing', allowed: t.getAttribute('data-v') === '1' })
      : req('POST', '/api/privacy/me/requests', { kind: t.getAttribute('data-kind') });
    p.then(function (r) {
      S.busy = false;
      if (r.status === 201) { return load(a === 'consent' ? 'Noted.' : 'Recorded. The shop will answer.'); }
      msg((r.j && (r.j.why || r.j.message)) || 'Could not save that. Try again.');
    }).catch(function () { S.busy = false; msg('Network problem. Try again.'); });
  }
  function load(note) {
    var o = S.o;
    o.host.innerHTML = o.sheet(head('Your privacy') + '<div class="meta" data-testid="shop-priv-loading">Loading…</div>');
    return req('GET', '/api/privacy/me').then(function (r) {
      if (r.status !== 200) return paintErr((r.j && r.j.message) || 'Could not read your privacy page.');
      S.d = r.j; paint();
      if (note) { var m = root.document.getElementById('shop_priv_msg'); if (m) m.textContent = note; }
    }).catch(function () { paintErr('Network problem. Try again.'); });
  }
  function open(o) { S.o = o; return load(); }
  root.CBShopPrivacy = { open: open, reload: function () { return load(); } };
})(typeof window !== 'undefined' ? window : globalThis);
