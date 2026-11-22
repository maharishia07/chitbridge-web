/* app/network-lab-check.js — the Network Lab's CHECK: post the sketch to the server's validate and show what would break or be made. Split out of network-design.html (file-size ratchet, batch 1129; capability split), code moved verbatim.
 * OWNS      labCheck: the one call the lab makes (POST /api/network-design/validate with sample: true; nothing real is ever made or saved)
 * CALLED BY public/network-design.html (the "See what it would" button, onclick="labCheck()"); loaded by that page after the sketch rows (LAB) and before the click
 * FLOW      labCheck → the signed-in token (or a sign-in sentence) → POST validate { sample: true, draft } → says · breaks · would-make lines
 * CARD      04-network/network-design-builder
 * OWNER     cb-network
 * RISK      plain
 */
'use strict';
function labCheck() {
  var out = document.getElementById('labOut'),
    btn = document.getElementById('labGo');
  var q = new URLSearchParams(location.search),
    tok = '';
  try {
    var parsed = JSON.parse(localStorage.getItem('cb_sess') || 'null');
    tok = (parsed && parsed.token) || '';
  } catch (_) {}
  if (!tok) {
    out.innerHTML = '<div class="says bad">Sign in to the app first — the check runs on the server. Nothing is made either way.</div>';
    return;
  }
  var api = cbApiParam(q.get('api')) || window.CB_API;
  var nodes = [{ key: 'r', name: 'Sample', root: true, owned: true, parent_key: null, holds: [] }].concat(
    LAB.map(function (item, index) {
      return { key: 'n' + index, name: item.name, owned: item.owned, partner_ref: item.ref, parent_key: 'r', holds: ['catalogue'] };
    })
  );
  btn.disabled = true;
  out.innerHTML = '<div class="s" style="color:var(--grey)">Checking…</div>';
  fetch(api + '/api/network-design/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: JSON.stringify({ sample: true, draft: { nodes: nodes } })
  })
    .then(function (reply) {
      return reply.json().then(function (j) {
        if (!reply.ok) throw new Error(j.message || 'No answer');
        return j;
      });
    })
    .then(function (reply) {
      out.innerHTML =
        '<div class="says ' +
        (reply.ok ? 'good' : 'bad') +
        '" data-testid="lab-says">' +
        esc(reply.says) +
        '</div>' +
        (reply.breaks && reply.breaks.length
          ? '<ul>' +
            reply.breaks
              .map(function (item) {
                return '<li><b>' + esc(item.name) + '</b> — ' + esc(item.reason) + '</li>';
              })
              .join('') +
            '</ul>'
          : '') +
        (reply.would && reply.would.create.length
          ? '<div class="s" style="font-size:12.5px;color:var(--grey)">Would make: ' +
            reply.would.create
              .map(function (item) {
                return esc(item.handle);
              })
              .join(', ') +
            '</div>'
          : '');
    })
    .catch(function (e) {
      out.innerHTML = '<div class="says bad">' + esc(e.message || 'Could not check — try again.') + '</div>';
    })
    .then(function () {
      btn.disabled = false;
    });
}
