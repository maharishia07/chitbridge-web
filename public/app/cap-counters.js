/* app/cap-counters.js — COUNTERS & KEYS: the shop's counters (the register), the PCs ever paired, and the keys other systems sign in with —
 * ONE implementation painted in two places (T3-SETTINGS, 2026-10-14; the pattern of cap-shop.js, SET1).
 *
 * MOVED from cap-admin.js (never copied; the workshop's Settings › Integrations › Counters and › Keys & services call these same names):
 *   _CTRS · ctrReload · ctrRegisterHTML · ctrAdd · ctrOpenHere · ctrRelease · intCountersHTML · intPairingsHTML · _keySeenAt · _keyAgo · _agentName ·
 *   _CLOSE_ARMED · intCounterClose · intCounterCloseDups · intKeyMint · intKeyRevoke · _KEYS · _KEY_SHOWN · the EP entries counters* and keys*
 * LIFTED: keysCardHTML — the "Your keys" card was inline in integrationsSettingsHTML (its inner _keyAgo copy is gone: the module's one _keyAgo serves).
 * WIDENED (additively): ctrRepaint() / ctrOnShow() — the workshop's loadSettings() / setSec()==='integrations' when the workshop painted it, the host
 *   when CB Settings did (what cap-country got in SET1: a host, never a second painter); ctrRegisterHTML greys Add WITH the server's sentence on
 *   OWNER_ONLY (routes/counters.js's one gate) — a co-assist sees the register, never a dead button or a blank.
 * NEW: CBCounters.mount(host) — CB Settings › Counters & keys. Nothing existing painted these outside the workshop's Settings pane.
 * Host globals (as every cap-*.js): api · EP · UI · SESSION · esc · tx · txf · toast · _CARD · lsGet/lsSet (helpers.js) · CBLocale (optional).
 * Loaded by app.html through CAP_WITH.admin (before cap-admin.js) and by settings.html directly.
 * Flow step: O2C · bill (the counter that bills) and Onboarding · counters (docs/process/flows.json).
 */
'use strict';
if (typeof EP !== 'undefined') { Object.assign(EP, {
  keysList:  {m:'GET',    p:'/api/keys',                    ok:'y'},   // API keys for other systems (routes/keys.js)
  keysMint:  {m:'POST',   p:'/api/keys',                    ok:'✓'},
  keysRevoke:{m:'DELETE', p:'/api/keys/:jti',               ok:'✓'},
  /* ⭐ the shop's counters as standing identities (routes/counters.js, 2026-09-17) */
  counters:       {m:'GET',  p:'/api/counters',                  ok:'✓'},
  counterAdd:     {m:'POST', p:'/api/counters',                  ok:'✓'},
  counterRename:  {m:'PATCH',p:'/api/counters/:id',              ok:'✓'},
  counterOpen:    {m:'POST', p:'/api/counters/:id/open',         ok:'✓'},
  counterRelease: {m:'POST', p:'/api/counters/:id/release',      ok:'✓'},
}); }
var _KEYS, _KEY_SHOWN = '';   /* the minted key, shown once — survives the list repaint, cleared on the next mint/revoke/leave */
/**
 * ── ⭐⭐⭐ COUNTERS — WHERE THIS SHOP IS OPEN, AND HOW MANY TIMES ─────────────────────────────────────────────
 *
 * Athi, 2026-09-16, with one PC pushing bills and another silent: *"can we build IP level information for every
 * counter app, installed, browsed, is it possible to connect with bridge id, in how many places the store is
 * opened and to close the duplicates?"*
 *
 * ⚠️⚠️ "NEVER REACHED CHITBRIDGE" IS THE LOUDEST ROW HERE, AND IT IS A DIFFERENT FAULT FROM EVERY OTHER ONE. A
 * counter we have never heard from is not being refused by us — nothing from it is arriving, which points at the
 * network in front of it rather than at anything on this side. That single distinction is the difference between
 * hunting a permissions problem for an afternoon and telephoning an office firewall.
 *
 * ⚠️ A KEY IS A COUNTER. Minting another does not replace the last, it adds a second — and each one keeps its OWN
 * copy of the bills on its machine (the counter's tillStore() is named after the key), so a pairing nobody uses is
 * a place sales can go unnoticed. This page exists so that is visible before it becomes a mystery.
 */
/**
 * ── ⭐⭐⭐ THE COUNTERS THIS SHOP HAS — created once, opened and closed as often as needed, one PC at a time ─────
 * Athi, 2026-09-17: *"it has to be like a co-assist — I know the counter number, and I open and close it again and
 * again, but in only one PC."* This is that register. The pairings further down are the older way in, kept visible
 * so nothing a shop has already billed through disappears from view.
 */
var _CTRS;
function ctrReload(){ _CTRS = undefined; ctrRepaint(); }
function ctrRegisterHTML(){
  if (_CTRS === undefined) { _CTRS = null; api('counters').then(function(r){ _CTRS = r || { counters: [] }; if (ctrOnShow()) ctrRepaint(); })
    .catch(function(e){ _CTRS = { counters: [], error: (e && e.message) || true, code: (e && e.data && e.data.code) || null }; if (ctrOnShow()) ctrRepaint(); }); }
  if (_CTRS === null) return '<div style="' + _CARD + '">' + tx('reading…') + '</div>';
  var list = (_CTRS && _CTRS.counters) || [];
  /* T3-SETTINGS: the server's refusal (OWNER_ONLY, routes/counters.js's one gate) greys Add WITH its sentence — a co-assist sees the screen, never a dead button */
  var no = !!(_CTRS && _CTRS.code === 'OWNER_ONLY'), why = no ? String(_CTRS.error) : '';
  var rows = list.map(function(c){
    /* ⚠️ a counter on break is still HELD by its PC — shown as such, and still releasable only as a last resort */
    var onBreak = c.state === 'break', open = c.state === 'open' || onBreak, h = c.held_by || {};
    var where = onBreak
      ? ('☕ ' + tx('on break') + (c.break_since ? ' ' + tx('since') + ' ' + esc(new Date(c.break_since).toTimeString().slice(0, 5)) : '')
         + (c.break_by ? ' · ' + esc(c.break_by) : '') + ' · ' + esc(h.name || tx('a PC')))
      : open
      ? (tx('open on') + ' ' + esc(h.name || tx('a PC')) + (h.seen && h.seen.ip ? ' · ' + esc(h.seen.ip) : '')
         + (h.seen && h.seen.at ? ' · ' + esc(_keyAgo(h.seen.at)) : ''))
      : (c.state === 'opening' ? tx('opening…') : (c.closed_at ? tx('closed') + ' ' + esc(_keyAgo(c.closed_at)) : tx('not opened yet')));
    var armed = (_CLOSE_ARMED === 'rel:' + c.id);
    return '<div data-testid="ctr-' + esc(c.id) + '" style="display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line)">'
      + '<b class="mono" style="font-size:1.15em;min-width:2.4em">' + esc(c.id) + '</b>'
      + '<span style="flex:1;min-width:0"><span data-testid="ctr-name-' + esc(c.id) + '">' + esc(c.name) + '</span>'
      + '<div style="color:var(--grey);font-size:var(--fs-1)">'
        + (c.last_no ? tx('last bill') + ' ' + esc(c.last_no) + ' · ' : '')
        + (c.next ? tx('next') + ' ' + esc(String(c.next).padStart(4, '0')) + ' · ' : '')
        + '<span style="color:var(--' + (onBreak ? 'warn' : (open ? 'ok' : 'grey')) + ')" data-testid="ctr-state-' + esc(c.id) + '">' + where + '</span></div>'
      + (h.diag && h.diag.verdict ? '<div style="color:var(--warn);font-size:var(--fs-1)">🩺 ' + esc(h.diag.verdict) + '</div>' : '')
      + '</span>'
      + (open
          ? '<button class="warn" data-testid="ctr-release-' + esc(c.id) + '" onclick="ctrRelease(\'' + esc(c.id) + '\')" title="'
            + esc(tx('only for a PC that cannot close the counter itself')) + '">'
            + (armed ? tx('Release — unsent bills stay on that PC') : tx('Release')) + '</button>'
          : '<button class="pri" data-testid="ctr-open-' + esc(c.id) + '" onclick="ctrOpenHere(\'' + esc(c.id) + '\')"'
            + (c.state === 'opening' ? ' disabled' : '') + '>' + tx('Open on this PC') + '</button>')
      + '</div>';
  }).join('');
  return '<div style="' + _CARD + '">'
    + '<div class="sec" style="margin:0 0 6px">' + tx('Counters') + ' · ' + list.length + '</div>'
    + '<div style="font-size:var(--fs-2);color:var(--grey);margin-bottom:6px">'
    + tx('Each counter keeps its own number and its own bill series. Open it on a PC to bill; close it from that counter (☰ → Close this counter) and it can be opened again — here or on another PC — carrying on from its last bill. Only one PC can hold a counter at a time.')
    + '</div>'
    + (rows || '<div style="color:var(--grey);padding:6px 0">' + tx('No counters yet.') + '</div>')
    + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
    + '<input class="inp" id="ctr_new_name" data-testid="ctr-new-name" placeholder="' + esc(tx('Name — Front desk, Billing 2 …')) + '" style="flex:1 1 220px"' + (no ? ' disabled' : '') + '>'
    + '<button class="pri" data-testid="ctr-add"' + (no ? ' disabled aria-disabled="true" title="' + esc(why) + '"' : ' onclick="ctrAdd()"') + '>' + tx('Add a counter') + '</button></div>'
    + (_CTRS && _CTRS.error ? '<div data-testid="ctr-why" style="color:var(--warn);font-size:var(--fs-1);margin-top:6px">' + (no ? esc(why) : tx('Could not read the counters.') + (_CTRS.error !== true ? ' ' + esc(String(_CTRS.error)) : '')) + '</div>' : '')
    + '</div>';
}
async function ctrAdd(){
  var el = document.getElementById('ctr_new_name');
  try { await api('counterAdd', { body: { name: (el && el.value || '').trim() } }); if (typeof toast === 'function') toast(tx('Counter added')); ctrReload(); }
  catch (e) { if (typeof toast === 'function') toast((e && e.message) || tx('Could not add the counter'), true); }
}
/**
 * ⭐ OPEN ON THIS PC — the key is minted FOR this counter and handed to the counter page, which takes the counter's
 * number and carries on its series. The same address shape counterGo() uses, so the counter checks it is the shop
 * it was opened for.
 */
async function ctrOpenHere(id){
  try {
    var r = await api('counterOpen', { params: { id: id } });
    if (!r || !r.key) throw new Error(tx('no key came back'));
    try { localStorage.setItem('cb_till_key', r.key); localStorage.setItem('cb_till_entity', SESSION.entityId || ''); } catch (_) {}
    var addr = '/till.html#key=' + encodeURIComponent(r.key)
             + '&shop=' + encodeURIComponent(SESSION.entityId || '')
             + '&as=' + encodeURIComponent(SESSION.entity || '');
    window.open(addr, '_blank', 'noopener');
    ctrReload();
  } catch (e) {
    /* ⚠️ held elsewhere is the ordinary refusal — say who has it, in the server's own words */
    if (typeof toast === 'function') toast((e && e.message) || tx('Could not open the counter'), true);
    ctrReload();
  }
}
async function ctrRelease(id){
  if (_CLOSE_ARMED !== 'rel:' + id) { _CLOSE_ARMED = 'rel:' + id; ctrRepaint(); return; }
  _CLOSE_ARMED = null;
  try { await api('counterRelease', { params: { id: id } }); if (typeof toast === 'function') toast(tx('Counter released')); ctrReload(); }
  catch (e) { if (typeof toast === 'function') toast((e && e.message) || tx('Could not release it'), true); }
}
function intCountersHTML(){
  return ctrRegisterHTML() + '<div style="margin-top:12px">' + intPairingsHTML() + '</div>';
}
/* ⚠️ the pairings made before the register existed — still listed, because they may still hold bills */
function intPairingsHTML(){
  if (_KEYS === undefined) { _KEYS = null; api('keysList').then(function(r){ _KEYS = r || { keys: [] }; if (ctrOnShow()) ctrRepaint(); }).catch(function(){ _KEYS = { keys: [], error: true }; if (ctrOnShow()) ctrRepaint(); }); }
  if (_KEYS === null) return '<div style="' + _CARD + '">' + tx('reading…') + '</div>';
  var tills = ((_KEYS && _KEYS.keys) || []).filter(function(k){ return k && (k.scopes || []).indexOf('till') >= 0; });
  var bridge = (typeof S !== 'undefined' && S && S.bridgeId) || (typeof SESSION !== 'undefined' && SESSION && SESSION.bridgeId) || '';   /* the workshop's S, or the small app's SESSION */
  if (!tills.length) return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Counters') + '</div>'
    + '<div style="color:var(--grey)">' + tx('No PC has been paired to this shop yet.') + '</div></div>';

  var live = tills.filter(function(k){ return _keySeenAt(k) && (Date.now() - _keySeenAt(k)) < 900000; });
  var never = tills.filter(function(k){ return !_keySeenAt(k); });
  /* ⭐ two counters reporting the same address are one PC paired twice — much the commonest duplicate */
  var byIp = {};
  tills.forEach(function(k){ var ip = k.seen && k.seen.ip; if (ip) (byIp[ip] = byIp[ip] || []).push(k); });
  var dupIps = Object.keys(byIp).filter(function(ip){ return byIp[ip].length > 1; });

  var rows = tills.slice().sort(function(a, b){ return _keySeenAt(b) - _keySeenAt(a); }).map(function(k){
    var at = _keySeenAt(k), ip = (k.seen && k.seen.ip) || null, d = k.diag || null;
    var shut = !!(k.till && k.till.closed_at);
    var state = shut ? { c: 'grey', t: tx('closed') + ' ' + _keyAgo(k.till.closed_at) + (k.till.id ? ' · ' + k.till.id : '') }
              : !at ? { c: 'warn', t: tx('never reached ChitBridge') }
              : (Date.now() - at) < 900000 ? { c: 'ok', t: tx('open now') }
              : { c: (Date.now() - at) > 86400000 ? 'warn' : 'grey', t: _keyAgo(k.seen.at) };
    var armed = (_CLOSE_ARMED === k.jti);
    return '<div data-testid="int-counter-' + esc(k.jti) + '" style="display:flex;gap:10px;align-items:baseline;padding:8px 0;border-top:1px solid var(--line)">'
      + '<span style="flex:1"><b>' + esc(k.name || 'counter') + '</b>'
      + (ip && byIp[ip].length > 1 ? ' <span style="color:var(--warn);font-size:var(--fs-1)">' + tx('same PC as another counter') + '</span>' : '')
      + '<div style="color:var(--grey);font-size:var(--fs-1)">'
        + esc(bridge || tx('no bridge id')) + ' · …' + esc(k.last4 || '')
        + ' · ' + tx('paired') + ' ' + esc(String(k.created_at || '').slice(0, 10))
        + (ip ? ' · ' + esc(ip) : '')
        + ((k.seen && k.seen.agent) ? ' · ' + esc(_agentName(k.seen.agent)) : '')
      + '</div>'
      /* ⭐ what the counter itself last said — it can see things this side never will */
      + (d && d.verdict ? '<div style="color:var(--warn);font-size:var(--fs-1)" data-testid="int-counter-said-' + esc(k.jti) + '">🩺 ' + esc(d.verdict) + '</div>' : '')
      + '</span>'
      + '<span style="color:var(--' + state.c + ');font-size:var(--fs-1);white-space:nowrap">' + esc(state.t) + '</span>'
      /* ⚠️ two presses, and the second one SAYS WHAT IT COSTS — closing strands whatever that PC has not sent */
      + '<button class="warn" data-testid="int-counter-close-' + esc(k.jti) + '" onclick="intCounterClose(\'' + esc(k.jti) + '\')">'
      + (armed ? tx('Really close — unsent bills stay on that PC') : tx('Close')) + '</button>'
      + '</div>';
  }).join('');

  var note = '';
  if (never.length) note += '<div style="color:var(--warn);font-size:var(--fs-2);margin-top:10px" data-testid="int-counter-unreached">'
    + esc(never.length + ' ' + tx('counter(s) have never reached ChitBridge. They are not being refused — nothing from them has arrived at all, so look at the network or firewall on those PCs rather than at permissions here.')) + '</div>';
  if (dupIps.length) note += '<div style="color:var(--warn);font-size:var(--fs-2);margin-top:10px" data-testid="int-counter-dups">'
    + esc(tx('The same PC is paired more than once. Each pairing keeps its own copy of the bills on that machine and only the one in use is sent from.'))
    + ' <button data-testid="int-counter-close-dups" onclick="intCounterCloseDups()">' + tx('Close the unused duplicates') + '</button></div>';

  return '<div style="' + _CARD + '">'
    + '<div class="sec" style="margin:0 0 6px">' + tx('Pairings — every PC ever paired to this shop') + ' · ' + tills.length
    + (live.length ? ' · ' + live.length + ' ' + tx('open now') : '') + '</div>'
    + '<div style="font-size:var(--fs-2);color:var(--grey);margin-bottom:6px">'
    + tx('Each pairing is one PC opening a counter. A closed pairing is kept as history; its counter can be opened again above.') + '</div>'
    + rows + note + '</div>';
}
function _keySeenAt(k){ return (k && k.seen && k.seen.at) ? new Date(k.seen.at).getTime() : 0; }
function _keyAgo(iso){
  if (!iso) return '';
  var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return tx('just now');
  if (s < 5400) return Math.round(s / 60) + ' min ago';
  if (s < 172800) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' days ago';
}
/** ⭐ a user-agent is unreadable; the shop only needs to recognise WHICH MACHINE this was */
function _agentName(ua){
  var u = String(ua || '');
  var os = /Windows/.test(u) ? 'Windows' : /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iPhone/iPad'
         : /Mac OS X/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : '';
  var br = /Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox'
         : /Safari\//.test(u) ? 'Safari' : '';
  return [os, br].filter(Boolean).join(' · ') || tx('unknown');
}
var _CLOSE_ARMED = null;
/**
 * ⚠️⚠️ CLOSING A COUNTER REVOKES ITS KEY EVERYWHERE, AND ANYTHING IT HAD NOT SENT IS STRANDED ON THAT PC. The
 * bills are not destroyed — they sit in that machine's own copy — but nothing can send them once the key is gone.
 * So the second press says that, in those words, instead of asking "are you sure?" about a cost it never names.
 */
async function intCounterClose(jti){
  if (_CLOSE_ARMED !== jti) { _CLOSE_ARMED = jti; ctrRepaint(); return; }
  _CLOSE_ARMED = null;
  try { await api('keysRevoke', { params: { jti: jti } }); _KEYS = undefined; if (typeof toast === 'function') toast(tx('Counter closed')); ctrRepaint(); }
  catch (e) { if (typeof toast === 'function') toast((e && e.message) || tx('Could not close it'), true); }
}
/**
 * ⭐ CLOSE THE UNUSED DUPLICATES — where one PC holds several pairings, keep the one that spoke most recently and
 * close the rest.
 * ⚠️⚠️ NEVER A COUNTER THAT HAS NEVER REPORTED. We cannot tell whether it is idle or simply unable to reach us,
 * and closing the one that cannot call for help is the worst guess available — it is also exactly the counter
 * somebody is most likely to be trying to fix.
 */
async function intCounterCloseDups(){
  var tills = (((_KEYS && _KEYS.keys) || []).filter(function(k){ return k && (k.scopes || []).indexOf('till') >= 0; }));
  var byIp = {};
  tills.forEach(function(k){ var ip = k.seen && k.seen.ip; if (ip) (byIp[ip] = byIp[ip] || []).push(k); });
  var kill = [];
  Object.keys(byIp).forEach(function(ip){
    byIp[ip].slice().sort(function(a, b){ return _keySeenAt(b) - _keySeenAt(a); })
      .slice(1).forEach(function(k){ if (_keySeenAt(k)) kill.push(k); });
  });
  if (!kill.length) { if (typeof toast === 'function') toast(tx('There are no duplicates that can be closed safely.')); return; }
  if (_CLOSE_ARMED !== 'dups') { _CLOSE_ARMED = 'dups'; if (typeof toast === 'function')
    toast(tx('Press again to close') + ' ' + kill.length + ' ' + tx('duplicate counter(s). The newest on each PC is kept.')); return; }
  _CLOSE_ARMED = null;
  for (var i = 0; i < kill.length; i++) { try { await api('keysRevoke', { params: { jti: kill[i].jti } }); } catch (_) {} }
  _KEYS = undefined; ctrRepaint();
}
/**
 * ⭐⭐ WHEN EACH KEY LAST SPOKE, AND FROM WHERE. Athi, 2026-09-16, with one counter pushing bills and another
 * silent: *"can we trace the ip for each counter app and see what the restrictions are?"* The list named every
 * key and said nothing about whether any of them was alive.
 * ⚠️⚠️ "NEVER REACHED" IS THE LOUD ANSWER, NOT A BLANK. A counter that has never arrived here is not being
 * refused by us — it is not getting here, which points at the network in front of it. That distinction is the
 * difference between hunting a permissions bug and telephoning an office firewall, so it is said in words.
 */
function keysCardHTML(){
  if (_KEYS === undefined) { _KEYS = null; api('keysList').then(function(r){ _KEYS = r || { keys: [] }; if (ctrOnShow()) ctrRepaint(); }).catch(function(){ _KEYS = { keys: [], error: true }; if (ctrOnShow()) ctrRepaint(); }); }
  var keys = (_KEYS && _KEYS.keys) || [];
  var _keySeen = function(k){
    var sn = k && k.seen;
    if (!sn || !sn.at) return '<span data-testid="int-key-seen-' + esc(k.jti) + '" style="color:var(--warn)">'
      + tx('never reached ChitBridge') + '</span>';
    var quiet = (Date.now() - new Date(sn.at).getTime()) > 86400000;
    return '<span data-testid="int-key-seen-' + esc(k.jti) + '" style="color:var(--' + (quiet ? 'warn' : 'ok') + ')">'
      + esc(_keyAgo(sn.at)) + (sn.ip ? ' · ' + esc(sn.ip) : '') + '</span>';
  };
  var rows = keys.length ? keys.map(function(k){ return '<div class="row" data-testid="int-key-' + esc(k.jti) + '" style="display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--line)"><b style="flex:1">' + esc(k.name) + '</b><span style="color:var(--grey);font-size:var(--fs-1)">' + esc((k.scopes||[]).join(', ')) + ' · …' + esc(k.last4||'') + ' · ' + esc(String(k.created_at||'').slice(0,10)) + ' · ' + _keySeen(k) + '</span><button class="warn" data-testid="int-key-revoke-' + esc(k.jti) + '" onclick="intKeyRevoke(\'' + esc(k.jti) + '\')">' + tx('Revoke') + '</button></div>'; }).join('') : '<div style="color:var(--grey)">' + tx(_KEYS === null ? 'reading…' : 'No keys yet.') + '</div>';
  return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Your keys') + '</div>' + rows
    + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><input class="inp" id="int_key_name" data-testid="int-key-name" placeholder="' + esc(tx('Name — which system')) + '" style="flex:1 1 200px"><select class="inp" id="int_key_scope" data-testid="int-key-scope" style="flex:0 0 220px"><option value="services">' + esc(tx('services — offers, pricing, tax, invoice')) + '</option><option value="offers">' + esc(tx('offers only')) + '</option><option value="pricing">' + esc(tx('pricing only')) + '</option><option value="tax">' + esc(tx('tax only')) + '</option><option value="invoice">' + esc(tx('invoice only')) + '</option><option value="till">' + esc(tx('till — the counter: bill on this device, offline too')) + '</option><option value="connector">' + esc(tx('connector — products, orders, the bell, and the services')) + '</option><option value="testing">' + esc(tx('testing — a build posts test results to the board')) + '</option></select><button class="pri" data-testid="int-key-mint" onclick="intKeyMint()">' + tx('Mint a key') + '</button></div>'
    + '<div id="int_key_out">' + (_KEY_SHOWN || '') + '</div></div>';
}
async function intKeyMint(){
  var nm = (document.getElementById('int_key_name') || {}).value || '';
  var sc = (document.getElementById('int_key_scope') || {}).value || 'offers';
  /* a connector key also evaluates offers — the scope names the larger surface (routes/keys.js · middleware/auth.js KEY_ROUTES) */
  try { var r = await api('keysMint', { body: { name: nm || 'key', scopes: sc === 'connector' ? ['connector', 'services'] : [sc] } });
    _KEY_SHOWN = '<div data-testid="int-key-shown" style="margin-top:10px;padding:10px;border:1px dashed var(--warn-3);border-radius:9px;font-size:var(--fs-1)"><b>' + tx('Copy it now — it is shown once.') + '</b><div style="word-break:break-all;font-family:monospace;margin-top:6px" data-testid="int-key-value">' + esc(r.key) + '</div><div style="color:var(--grey);margin-top:6px">' + tx('Send it as') + ' <code>X-Api-Key: …</code> ' + tx('or') + ' <code>Authorization: Bearer …</code></div></div>';
    _KEYS = undefined; if (typeof toast === 'function') toast(tx('Key minted ✓'));
    ctrRepaint();   /* the list repaints; the shown key rides _KEY_SHOWN into the repaint */
  } catch (e) { if (typeof toast === 'function') toast((e && e.message) || tx('Could not mint'), true); }
}
async function intKeyRevoke(jti){
  try { await api('keysRevoke', { params: { jti: jti } }); _KEYS = undefined; _KEY_SHOWN = ''; if (typeof toast === 'function') toast(tx('Key revoked')); ctrRepaint(); }
  catch (e) { if (typeof toast === 'function') toast((e && e.message) || tx('Could not revoke'), true); }
}

/* ── CB SETTINGS › COUNTERS & KEYS — the page's host mounts the register, the pairings and the keys here (T3-SETTINGS) ──────────────────── */
var CBCounters = (function () {
  var H = { el: null };
  function active(){ return !!(H.el && H.el.isConnected); }   /* the section on show; a late read paints nothing over another section */
  function paint(){
    if (!active()) return;
    H.el.innerHTML = '<h2 class="shop-h" data-testid="ctr-title">' + esc(tx('Counters & keys')) + '</h2>'
      + ctrRegisterHTML() + '<div style="margin-top:12px">' + intPairingsHTML() + '</div>'
      + '<div style="margin-top:12px">' + keysCardHTML() + '</div>';
  }
  function mount(host){ H.el = document.createElement('div'); H.el.setAttribute('data-testid', 'ctr-screen'); host.appendChild(H.el); _CTRS = undefined; _KEYS = undefined; _KEY_SHOWN = ''; paint(); }
  return { mount: mount, paint: paint, active: active };
})();
/** the pane this module paints: CB Settings' host when mounted, else the workshop's setbody (loadSettings) */
function ctrRepaint(){ if (CBCounters.active()) CBCounters.paint(); else if (typeof loadSettings === 'function') loadSettings(); }
/** is this module's screen on show — a read that lands paints only then */
function ctrOnShow(){ return CBCounters.active() || (typeof setSec === 'function' && setSec() === 'integrations'); }
