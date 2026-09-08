/* app/cap-match.js — THE THREE-WAY MATCH (lazy; ensureCap('match')).
 *
 * ⭐⭐⭐ THE SCREEN THE PRODUCT IS SOLD ON. PO ↔ GRN ↔ invoice is the oldest control in purchasing, and an ERP can only run it when
 * ONE company holds all three documents. Here the order is a chit we sent, the receipt is what our own door wrote, and the invoice is
 * either a chit they sent or the figure their paper bill carried — so the match happens ACROSS PARTIES, which is the thing no ERP can
 * do. See C:\dev\catalogue\PURCHASE-DESPATCH-SPEC-2026-09-08.md §11.
 *
 * ── ⚠️ IT NAMES A DIFFERENCE, IT NEVER RESOLVES ONE ─────────────────────────────────────────────────────────────
 * What was ordered, what was counted and what was charged are three CLAIMS. This screen puts them side by side with the reason the
 * person at the door gave, and stops. Deciding between them is a conversation between two parties — a dispute — and CB takes no side
 * in it. A screen that quietly "corrected" a receipt to match an invoice would destroy the only number the shop actually witnessed.
 *
 * Backend: GET /api/till/match (routes/till.js — deliberately outside the till key scope: a counter records what it sees and must
 * never read what the shop pays its suppliers).
 */
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    matchList:   { m: 'GET',  p: '/api/till/match',                 ok: 'y' },
    matchDispute:{ m: 'POST', p: '/api/chits/:chit_id/disputes',    ok: 'y' },
  });
}

var MATCH = { rows: null, days: 90, only: 'differs', open: null, busy: false };

/** the four states a purchase can be in, in the words a shopkeeper would use */
var MATCH_WORDS = {
  awaited: { label: 'Not arrived', colour: 'var(--grey)', why: 'Nothing has come in against this order yet.' },
  open:    { label: 'Part arrived', colour: 'var(--blue)', why: 'Some of it is here. The rest is still owed.' },
  agreed:  { label: 'Agrees', colour: 'var(--ok)', why: 'What you ordered, what you counted and what you were charged all agree.' },
  differs: { label: 'Does not agree', colour: 'var(--warn)', why: 'Something does not match. The lines below say what, and why.' },
};

async function matchLoad(force) {
  if (MATCH.rows && !force) return;
  MATCH.busy = true;
  try {
    var r = await api('matchList', { query: { days: MATCH.days } });
    MATCH.rows = (r && r.orders) || [];
  } catch (e) { MATCH.rows = []; MATCH.error = (e && e.message) || String(e); }
  MATCH.busy = false;
  if (UI.nav === 'match') renderApp();
}

function matchScreen() {
  if (!MATCH.rows && !MATCH.busy) { matchLoad(); }
  var rows = MATCH.rows || [];
  var counts = { differs: 0, open: 0, agreed: 0, awaited: 0 };
  rows.forEach(function (o) { counts[o.verdict] = (counts[o.verdict] || 0) + 1; });
  var shown = rows.filter(function (o) { return MATCH.only === 'all' || o.verdict === MATCH.only; });

  var chip = function (key, label) {
    var on = MATCH.only === key;
    return '<button class="pill' + (on ? ' on' : '') + '" data-testid="match-chip-' + key + '" onclick="MATCH.only=\'' + key + '\';renderApp()">'
      + esc(label) + (key === 'all' ? '' : ' <b>' + (counts[key] || 0) + '</b>') + '</button>';
  };

  var head = '<div class="mhd" style="padding:14px 16px 6px">'
    + '<div class="t">⚖️ ' + esc(tx('Match')) + '</div>'
    + '<div class="s">' + esc(tx('What you ordered, what actually arrived, and what you were charged — side by side.')) + '</div></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 12px">'
      + chip('differs', tx('Does not agree')) + chip('open', tx('Part arrived')) + chip('agreed', tx('Agrees'))
      + chip('awaited', tx('Not arrived')) + chip('all', tx('Everything'))
      + '<span style="flex:1"></span>'
      + '<select class="pill" data-testid="match-days" onchange="MATCH.days=Number(this.value);matchLoad(true)">'
        + [30, 90, 180, 365].map(function (d) { return '<option value="' + d + '"' + (MATCH.days === d ? ' selected' : '') + '>' + txf('last {n} days', { n: String(d) }) + '</option>'; }).join('')
      + '</select></div>';

  if (MATCH.busy && !MATCH.rows) return '<div class="panel">' + head + '<div style="padding:30px;text-align:center;color:var(--grey)"><span class="spin"></span></div></div>';
  if (MATCH.error) return '<div class="panel">' + head + '<div style="padding:22px;color:var(--warn)">' + esc(MATCH.error) + '</div></div>';

  var body = shown.length ? shown.map(matchCard).join('')
    : '<div style="padding:34px 18px;color:var(--grey);text-align:center">'
      + (rows.length
        ? esc(tx('Nothing in this state. Try another chip above.'))
        : esc(tx('No purchase orders yet. Send an order to a supplier, then receive the goods at the counter — this screen fills itself.')))
      + '</div>';

  return '<div class="panel" data-testid="match-screen">' + head + '<div style="padding:0 16px 24px">' + body + '</div></div>';
}

function matchCard(o) {
  var w = MATCH_WORDS[o.verdict] || MATCH_WORDS.open;
  var open = MATCH.open === o.chit_id;
  var money = function (n) { return (n == null) ? '—' : inr(n); };
  return '<div style="border:1px solid var(--line);border-radius:12px;margin-bottom:10px;overflow:hidden" data-testid="match-order">'
    + '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer" onclick="MATCH.open=' + (open ? 'null' : "'" + esc(o.chit_id) + "'") + ';renderApp()">'
      + '<span style="font-weight:800;flex:1">' + esc(o.party || tx('a supplier')) + '<div class="u" style="font-weight:400;color:var(--grey);font-size:var(--fs-1)">'
        + esc(String(o.at).slice(0, 10)) + (o.subject ? ' · ' + esc(o.subject) : '') + '</div></span>'
      + '<span style="color:' + w.colour + ';font-weight:800;font-size:var(--fs-2)" data-testid="match-verdict">' + esc(w.label) + '</span>'
      + '<span style="opacity:.5">' + (open ? '▾' : '▸') + '</span></div>'
    + (open ? matchDetail(o, money) : '');
}

function matchDetail(o, money) {
  var rows = o.lines.map(function (l) {
    var bad = l.difference !== 0;
    return '<tr data-testid="match-line">'
      + '<td style="padding:6px 8px">' + esc(l.name) + '</td>'
      + '<td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums">' + l.ordered + ' ' + esc(l.unit) + '</td>'
      + '<td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums">' + l.received + '</td>'
      + '<td style="padding:6px 8px;color:' + (bad ? 'var(--warn)' : 'var(--ok)') + ';font-weight:' + (bad ? '700' : '400') + '">'
        + (bad ? (l.difference < 0 ? txf('short {n}', { n: String(-l.difference) }) : txf('excess {n}', { n: String(l.difference) })) : tx('agrees'))
        + (l.reason ? ' · ' + esc(l.reason) : '') + '</td></tr>';
  }).join('');

  /**
   * ⭐ THE THREE FIGURES, AND WHERE EACH CAME FROM. "Invoiced" is either a chit they sent or the total somebody keyed off their paper
   * bill at the door — and the screen SAYS WHICH, because a figure whose source is unknown is not evidence.
   */
  var gap = o.money_gap;
  return '<div style="border-top:1px solid var(--line);padding:12px 14px">'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">'
      + matchFig(tx('Ordered'), money(o.ordered_total), tx('what you asked for'))
      + matchFig(tx('Received'), money(o.received_total), tx('what your own door counted'))
      + matchFig(tx('Invoiced'), money(o.invoiced_total), o.invoiced_from ? esc(o.invoiced_from) : tx('no bill of theirs yet'))
    + '</div>'
    + (gap != null && gap !== 0
      ? '<div style="background:var(--warn-tint,rgba(200,120,0,.12));border-radius:8px;padding:9px 11px;margin-bottom:12px;color:var(--warn);font-weight:700" data-testid="match-gap">'
        + (gap > 0 ? txf('You counted {v} more than they billed.', { v: inr(gap) }) : txf('They billed {v} more than you counted.', { v: inr(-gap) }))
        + '</div>' : '')
    + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:var(--fs-2)">'
      + '<thead><tr style="color:var(--grey);text-align:left">'
        + '<th style="padding:4px 8px">' + esc(tx('Line')) + '</th>'
        + '<th style="padding:4px 8px;text-align:right">' + esc(tx('Ordered')) + '</th>'
        + '<th style="padding:4px 8px;text-align:right">' + esc(tx('Received')) + '</th>'
        + '<th style="padding:4px 8px">' + esc(tx('Difference')) + '</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>'
    + (o.receipts.length
      ? '<div style="color:var(--grey);font-size:var(--fs-1);margin-top:10px">' + esc(tx('Receipts:')) + ' '
        + o.receipts.map(function (r) { return esc(r.no || '') + (r.their_bill_no ? ' (' + esc(tx('their bill')) + ' ' + esc(r.their_bill_no) + ')' : ''); }).join(' · ')
        + '</div>' : '')
    + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
      + (o.verdict === 'differs'
        ? '<button class="composebtn" data-testid="match-dispute" onclick="matchDispute(\'' + esc(o.chit_id) + '\')">⚑ ' + esc(tx('Raise a dispute')) + '</button>'
        : '')
      + '<button class="pill" onclick="openChit(\'' + esc(o.chit_id) + '\')">' + esc(tx('Open the order')) + '</button>'
    + '</div>'
    + '<div style="color:var(--grey);font-size:var(--fs-1);margin-top:10px">'
      + esc(tx('What you counted is never changed to match their bill. Both figures stay, and the difference is yours to settle with them.'))
    + '</div></div>';
}

function matchFig(label, value, note) {
  return '<div style="border:1px solid var(--line);border-radius:10px;padding:10px">'
    + '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(label) + '</div>'
    + '<div style="font-weight:800;font-size:var(--fs-4);font-variant-numeric:tabular-nums">' + value + '</div>'
    + '<div style="color:var(--grey);font-size:var(--fs-1)">' + note + '</div></div>';
}

/**
 * ⭐ A DISPUTE IS RAISED WITH THE EVIDENCE ALREADY IN IT. The reason field is filled from what the screen can see — which lines, by
 * how much, and the reason the person at the door gave — so the supplier is answering a specific claim rather than "there is a
 * problem". A dispute nobody can act on is worse than a phone call.
 */
function matchDispute(chit_id) {
  var o = (MATCH.rows || []).filter(function (x) { return x.chit_id === chit_id; })[0];
  if (!o) return;
  var bad = o.lines.filter(function (l) { return l.difference !== 0; });
  var draft = bad.map(function (l) {
    return l.name + ': ordered ' + l.ordered + ' ' + l.unit + ', received ' + l.received
         + (l.difference < 0 ? ' (short ' + (-l.difference) + ')' : ' (excess ' + l.difference + ')')
         + (l.reason ? ' — ' + l.reason : '');
  }).join('\n');
  if (o.money_gap) draft += '\n' + (o.money_gap > 0 ? 'We counted ' + inr(o.money_gap) + ' more than billed.' : 'Billed ' + inr(-o.money_gap) + ' more than we counted.');

  modal('<div class="mhd"><div class="t">⚑ ' + esc(tx('Raise a dispute')) + '</div><div class="s">'
      + esc(o.party || '') + ' · ' + esc(tx('they see this, and both figures stay as they are')) + '</div></div>'
    + '<div class="mbody">'
      + '<label>' + esc(tx('What is wrong')) + '</label>'
      + '<textarea id="match_reason" rows="6" style="width:100%" data-testid="match-dispute-reason">' + esc(draft) + '</textarea>'
      + '<div style="color:var(--grey);font-size:var(--fs-1);margin-top:8px">'
        + esc(tx('This goes to them as a quantity dispute against this order. Nothing you counted is changed by raising it.')) + '</div>'
      + '<div class="mfoot"><button class="pill" onclick="closeModal()">' + esc(tx('Cancel')) + '</button>'
      + '<button class="composebtn" data-testid="match-dispute-send" onclick="matchDisputeSend(\'' + esc(chit_id) + '\')">' + esc(tx('Raise it')) + '</button></div>'
    + '</div>');
}

async function matchDisputeSend(chit_id) {
  var t = document.getElementById('match_reason');
  var reason = (t && t.value || '').trim();
  if (reason.length < 10) { toast(tx('Say a little more about what is wrong.')); return; }
  var o = (MATCH.rows || []).filter(function (x) { return x.chit_id === chit_id; })[0];
  try {
    await api('matchDispute', { params: { chit_id: chit_id }, body: { category: 'quantity', reason: reason,
      target_entity_id: (o && o.party_id) || null } });
    closeModal();
    toast(tx('Raised. It is on the order, and they can see it.'));
    matchLoad(true);
  } catch (e) { toast(tx('Could not raise it') + ': ' + ((e && e.message) || e)); }
}
