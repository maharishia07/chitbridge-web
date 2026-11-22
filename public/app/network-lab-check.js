/* app/network-lab-check.js — the Network Lab's CHECK: post the sketch to the server's validate and show what would break or be made. Split out of network-design.html (file-size ratchet, batch 1129; capability split), code moved verbatim.
 * OWNS      labCheck: the one call the lab makes (POST /api/network-design/validate with sample: true; nothing real is ever made or saved)
 * CALLED BY public/network-design.html (the "See what it would" button, onclick="labCheck()"); loaded by that page after the sketch rows (LAB) and before the click
 * FLOW      labCheck → the signed-in token (or a sign-in sentence) → POST validate { sample: true, draft } → says · breaks · would-make lines
 * CARD      04-network/network-design-builder
 * ID        CMP072
 * OWNER     cb-network
 * RISK      plain
 */
'use strict';
/** the signed-in person's token from this browser's session, '' when there is none or it cannot be read */
function labToken() {
  try {
    var parsed = JSON.parse(localStorage.getItem('cb_sess') || 'null');
    return (parsed && parsed.token) || '';
  } catch (failure) {
    if (typeof cbQuiet === 'function') cbQuiet('network lab: the saved sign-in could not be read, the person is asked to sign in', failure);
    return '';
  }
}
/** the sample draft the lab posts: a root and one node per sketch row (LAB), each holding the catalogue */
function labSampleNodes() {
  return [{ key: 'r', name: 'Sample', root: true, owned: true, parent_key: null, holds: [] }].concat(
    LAB.map(function (item, index) {
      return { key: 'n' + index, name: item.name, owned: item.owned, partner_ref: item.ref, parent_key: 'r', holds: ['catalogue'] };
    })
  );
}
/** the "Would make" line of an answer, '' when nothing would be made */
function labWouldHtml(reply) {
  if (!reply.would || !reply.would.create.length) return '';
  var handles = reply.would.create
    .map(function (item) {
      return esc(item.handle);
    })
    .join(', ');
  return '<div class="s" style="font-size:12.5px;color:var(--grey)">Would make: ' + handles + '</div>';
}
/** the list of things that would break, '' when none */
function labBreaksHtml(reply) {
  if (!reply.breaks || !reply.breaks.length) return '';
  var rows = reply.breaks
    .map(function (item) {
      return '<li><b>' + esc(item.name) + '</b> — ' + esc(item.reason) + '</li>';
    })
    .join('');
  return '<ul>' + rows + '</ul>';
}
/** the whole answer as the lab shows it: the server's sentence, what would break, what would be made */
function labReplyHtml(reply) {
  return '<div class="says ' + (reply.ok ? 'good' : 'bad') + '" data-testid="lab-says">' + esc(reply.says) + '</div>' + labBreaksHtml(reply) + labWouldHtml(reply);
}
/** the one call the lab makes: post the sketch to the server's validate and show the answer in words */
function labCheck() {
  var out = document.getElementById('labOut'),
    btn = document.getElementById('labGo');
  var token = labToken();
  if (!token) {
    out.innerHTML = '<div class="says bad">Sign in to the app first — the check runs on the server. Nothing is made either way.</div>';
    return;
  }
  var api = cbApiParam(new URLSearchParams(location.search).get('api')) || window.CB_API;
  btn.disabled = true;
  out.innerHTML = '<div class="s" style="color:var(--grey)">Checking…</div>';
  fetch(api + '/api/network-design/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ sample: true, draft: { nodes: labSampleNodes() } })
  })
    .then(function (reply) {
      return reply.json().then(function (body) {
        if (!reply.ok) throw new Error(body.message || 'No answer');
        return body;
      });
    })
    .then(function (reply) {
      out.innerHTML = labReplyHtml(reply);
    })
    .catch(function (e) {
      out.innerHTML = '<div class="says bad">' + esc(e.message || 'Could not check — try again.') + '</div>';
    })
    .then(function () {
      btn.disabled = false;
    });
}
