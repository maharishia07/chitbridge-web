/* app/cap-worklist-raida.js — the RAIDA register on a work line (risks · actions · issues · decisions · assumptions): load, open, close, the rows and the section. Split out of cap-worklist.js (file-size ratchet, batch 1129; capability split), code moved verbatim.
 * OWNS      the register block of a line card: WLRK · wlRaidaLoad · wlRaidaOpen · wlRaidaAfterSave · wlRaidaClosing · wlRaidaDisp · wlRaidaClose · wlRaidaRow · wlRaidaSec
 * CALLED BY cap-worklist.js (wlLineHTML calls wlRaidaSec; the card buttons call the wlRaida* handlers); loaded with it by ensureCap('worklist') through CAP_WITH in app.html
 * FLOW      wlLine opens a card → wlRaidaLoad (the line's entries) → wlRaidaSec (the section) → wlRaidaRow per entry → wlRaidaOpen / wlRaidaClose write through the api
 * CARD      05-orders-and-workflow/worklist
 * OWNER     cb-orders
 * RISK      plain
 */
'use strict';
/* ═══ b182 · THE REGISTER ON THIS LINE ═════════════════════════════════════════════════════════════════════════
 *
 * Athi, 2026-08-30, at this very card: *"in this screen we have to bring the RAIDDA and commercial cover details
 * if required."* The card already opens per line, already holds the line_id, and already reads the four other
 * per-line tables together — so the register is a fifth read against the same key, not a new screen.
 *
 * ⚠️ "IF REQUIRED" IS DOING REAL WORK IN THAT SENTENCE. On a brake-pad line this section should stay empty and
 * quiet; on a transformer line it carries three open entries. The heading says the count and nothing else, so an
 * empty register costs one line of screen — and WHICH lines are empty is itself a description of the trade.
 */
/* ⭐ ONE REGISTRY, IN THE SHELL. This was a second copy of the six kinds; the report read THIS one, which is
   lazily loaded, so opening Insight → Register before the worklist printed raw keys. A list of labels defined
   twice is two lists the day one of them gains a seventh. */
var WLRK = typeof RAIDA_KINDS !== 'undefined' ? RAIDA_KINDS : {};

async function wlRaidaLoad() {
  var r = WLL.row;
  if (!r) return;
  WLL.raidaErr = false;
  try {
    var out = await api('wlRaida', { params: { id: r.chit_id }, query: { line_id: r.line_id } });
    /* ⚠️ migrated:false is NOT an error and must not read like one. Before b182 is run the API answers with an
       empty register on purpose; saying "could not read" there would send someone looking for a fault. */
    WLL.raida = out || { entries: [], migrated: false };
  } catch (e) {
    /* RAIL-90: an off register is a switch, not a fault. */
    if (registerOffWords(e)) WLL.raidaOff = true;
    else WLL.raidaErr = true;
  }
  wlPaintCard(WLL.loading);
}

/**
 * ⭐⭐ OPEN THE REGISTER'S OWN FORM, WITH THIS LINE IN SCOPE. The capability is lazy, so it is loaded on demand
 * — a co-assist who never records a risk downloads none of it.
 *
 * ⚠️ `onSaved` is a NAME, not a function. The register is a separate lazily-loaded capability and this is a
 * classic-script app; a name is the only handle that survives the boundary.
 */
async function wlRaidaOpen() {
  var r = WLL.row;
  if (!r) return;
  try {
    if (typeof ensureCap === 'function') await ensureCap('register');
    if (typeof rgQuickAdd !== 'function') {
      toast('Could not open the risk form.');
      return;
    }
    rgQuickAdd({
      chit_id: r.chit_id,
      line_id: r.line_id,
      chit_label: r.subject || r.code || null,
      line_label: r.particulars || null,
      kind: 'risk',
      onSaved: 'wlRaidaAfterSave'
    });
  } catch (e) {
    toast((e && e.message) || 'Could not open the risk form.');
  }
}

/* Re-read rather than splice: the server computes open/closed, and this list is the same read the panel does. */
async function wlRaidaAfterSave() {
  WLL.raida = null;
  try {
    await wlRaidaLoad();
  } catch (_) { /* best effort: failing here changes nothing the user sees */ }
}

/**
 * ⭐⭐ CLOSING ASKS WHY, AND THAT IS THE DESIGN, NOT A COURTESY. The close is an appended row carrying its own
 * words — "we booked the slot" and "the customer withdrew it" are different endings, and a flag cannot tell them
 * apart. An empty answer still closes it; the question is an invitation, never a gate.
 *
 * ⚠️⚠️ AND IT IS AN INLINE FIELD, NOT window.prompt(). My first version used prompt() — a blocking native dialog
 * in a product that has had its own modal() for a year. It cannot be styled, cannot be translated, cannot be
 * reached by the e2e driver, and on some hosts it freezes the page until it is dismissed. A control nobody can
 * test is a control nobody should ship.
 */
function wlRaidaClosing(rid) {
  WLL.raidaClosing = WLL.raidaClosing === rid ? null : rid;
  wlPaintCard(WLL.loading);
}
/**
 * ⭐⭐ AN ENDING NEEDS A DISPOSITION, AND THAT IS THE WHOLE POINT OF b185. "Resolved" and "accepted" are both
 * closed and are not the same fact: one is fixed, the other is a residual risk somebody is carrying. At the end
 * of a campaign the difference between them IS the audit.
 *
 * ⚠️ AND THE TWO SILENT ONES ARE WHY THIS CANNOT DEFAULT. `accepted` and `constraint` produce nothing that will
 * ever nag anybody again — a default would quietly file them as "resolved" and the register would report a
 * campaign as clean when it shipped carrying four things nobody fixed.
 */
function wlRaidaDisp(d) {
  WLL.raidaDisp = d;
  wlPaintCard(WLL.loading);
}
async function wlRaidaClose(rid) {
  var r = WLL.row;
  if (!r) return;
  var box = document.getElementById('wl_raida_why');
  var why = box ? String(box.value || '').trim() : '';
  var disp = WLL.raidaDisp || 'resolved';
  WLL.raidaClosing = null;
  WLL.raidaDisp = null;
  try {
    await api('wlRaidaEnd', { params: { id: r.chit_id, rid: rid }, body: { body: why, disposition: disp } });
    WLL.raida = null;
    await wlRaidaLoad();
    toast('Closed');
  } catch (e) {
    toast(registerOffWords(e) || (e && e.message) || 'Could not close it.');
  }
}

/** One entry. */
function wlRaidaRow(e) {
  var k = WLRK[e.kind] || { icon: '•', label: e.kind };
  var dim = e.open ? '' : ';opacity:.55';
  return (
    '<div data-testid="wl-raida-row" style="display:flex;gap:9px;align-items:baseline;padding:8px 0;border-top:1px solid var(--line)' +
    dim +
    '">' +
    '<span style="flex:none;font-size:var(--fs-2)" title="' +
    esc(k.hint || '') +
    '">' +
    k.icon +
    '</span>' +
    '<div style="flex:1;min-width:0">' +
    '<div style="font-size:var(--fs-2);color:var(--on-card);line-height:1.5' +
    (e.open ? '' : ';text-decoration:line-through') +
    '">' +
    esc(e.body) +
    '</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">' +
    esc(k.label) +
    /* ⚠️ An INHERITED entry is the same entry read from a line that does not own it — say so, and do not offer
       to close it from here. Closing an order-level fact from one line would surprise every other line. */
    (e.inherited ? ' · <span title="Recorded against the whole order">' + tx('from the order') + '</span>' : '') +
    (e.visibility === 'shared' ? ' · <span style="color:var(--blue-2)">' + tx('shared') + '</span>' : '') +
    (e.by ? ' · ' + esc(e.by) : '') +
    (e.open ? '' : ' · ' + esc(tx((RAIDA_ENDINGS[e.disposition] || { label: 'closed' }).label)) + (e.closed_note ? ' — ' + esc(e.closed_note) : '')) +
    '</div>' +
    '</div>' +
    (e.open && !e.inherited
      ? '<span data-cbsid="RAL002-C09" data-testid="wl-raida-close" onclick="wlRaidaClosing(&quot;' +
        escJs(e.raida_id) +
        '&quot;)" title="Close this entry"' +
        ' style="flex:none;cursor:pointer;font-size:var(--fs-1);color:var(--blue-2);background:var(--blue-tint-bg);border-radius:6px;padding:2px 8px">' +
        tx('close') +
        '</span>'
      : '') +
    '</div>' +
    /* The field appears under the entry it closes, so there is never a question about which one is ending. */
    (WLL.raidaClosing === e.raida_id
      ? '<div style="padding:0 0 9px 30px">' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">' +
        Object.keys(RAIDA_ENDINGS)
          .map(function (item) {
            var on = (WLL.raidaDisp || 'resolved') === item;
            return (
              '<button data-cbsid="RAL002-B01" type="button" data-testid="wl-raida-disp-' +
              item +
              '" onclick="wlRaidaDisp(&quot;' +
              escJs(item) +
              '&quot;)"' +
              ' title="' +
              esc(RAIDA_ENDINGS[item].hint) +
              '" aria-pressed="' +
              (on ? 'true' : 'false') +
              '"' +
              ' style="cursor:pointer;font:inherit;font-size:var(--fs-1);font-weight:' +
              (on ? 800 : 500) +
              ';' +
              'border:' +
              (on ? '2px solid var(--blue)' : '1px solid var(--line)') +
              ';border-radius:8px;' +
              'padding:3px 8px;background:' +
              (on ? 'var(--blue-tint-bg)' : 'var(--card)') +
              ';color:var(--on-card)">' +
              esc(tx(RAIDA_ENDINGS[item].label)) +
              '</button>'
            );
          })
          .join('') +
        '</div><div style="display:flex;gap:7px">' +
        '<input data-cbsid="RAL002-I05" id="wl_raida_why" data-testid="wl-raida-why" placeholder="' +
        esc(tx('What happened? (optional)')) +
        '"' +
        ' style="flex:1;border:1px solid var(--line);border-radius:8px;padding:6px 9px;font:inherit;font-size:var(--fs-2)">' +
        '<button data-cbsid="RAL002-B02" data-testid="wl-raida-close-go" onclick="wlRaidaClose(&quot;' +
        escJs(e.raida_id) +
        '&quot;)"' +
        ' style="cursor:pointer;font:inherit;font-size:var(--fs-2);font-weight:700;border:1px solid var(--blue);background:var(--blue);color:var(--on-accent);border-radius:8px;padding:5px 12px">' +
        tx('Close it') +
        '</button></div></div>'
      : '')
  );
}

function wlRaidaSec() {
  var R = WLL.raida;
  var hint = WLL.raidaOff ? tx('The register is off for your shop.') : WLL.raidaErr ? 'could not read' : R === null ? (WLL.tab === 'raida' ? 'reading…' : '') : R.open ? R.open + ' open' : 'none';
  var out = wlSecHead('raida', tx('Register'), hint, WLL.raidaErr ? 'var(--disp)' : R && R.open ? 'var(--warn-2)' : null);
  if (WLL.tab !== 'raida') return out;

  out += '<div style="padding:0 0 12px">';
  if (WLL.raidaOff) {
    out += '<div style="font-size:var(--fs-2);color:var(--grey)">' + esc(tx('The register is off for your shop.')) + '</div>';
  } else if (WLL.raidaErr) {
    out +=
      '<div style="font-size:var(--fs-2);color:var(--disp)">Could not read the register just now — this does NOT mean there is nothing on it. Close and reopen to try again.</div>';
  } else if (R === null) {
    out += '<div style="font-size:var(--fs-2);color:var(--grey)"><span class="spin"></span> reading…</div>';
  } else if (R.migrated === false) {
    /* ⚠️ Deploy-before-migration is normal here, and it is not a fault. Say what is true. */
    out += '<div style="font-size:var(--fs-2);color:var(--grey)">The register is not switched on for this environment yet (b182).</div>';
  } else {
    out += R.entries.length
      ? R.entries.map(wlRaidaRow).join('')
      : '<div style="font-size:var(--fs-2);color:var(--grey);padding:6px 0">Nothing recorded against this line — which is usually the right answer.</div>';

    /**
     * ⭐⭐ RECORD THROUGH THE REGISTER CAPABILITY, NOT A SECOND FORM — Athi, 2026-08-31: *"instead, change the
     * name to Risk and call the module there, so a risk can be registered against a line item and the same
     * should be visible here."*
     *
     * ⚠️ THIS USED TO BE ITS OWN FORM: kind chips, a textarea and an "against the whole order" checkbox — a
     * second way to record a finding, which could only ever carry kind + body. So a risk raised here arrived in
     * the register with no rating, no owner, no treatment and no response, and the only way to fill them was to
     * raise it again somewhere else. One form now, opened from here with this line already in scope.
     */
    out +=
      '<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px">' +
      '<button data-cbsid="RAL002-B03" data-testid="wl-raida-add" onclick="wlRaidaOpen()"' +
      ' style="cursor:pointer;font:inherit;font-size:var(--fs-2);font-weight:700;' +
      'border:1px solid var(--blue);background:var(--blue);color:var(--on-accent);border-radius:9px;padding:6px 14px">' +
      '＋ ' +
      tx('Record something') +
      '</button>' +
      '<div style="font-size:var(--fs-1);color:var(--grey);padding-top:6px">' +
      tx('Rating, owner, treatment and response are on the form — and it rolls up into the Register.') +
      '</div>' +
      '</div>';
  }
  out += '</div>';
  return out;
}
