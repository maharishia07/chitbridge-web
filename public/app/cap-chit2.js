/* app/cap-chit2.js — DESIGN 2: the chit as LINE-LEVEL work (lazy; ensureCap('chit2')).
 *
 * Athi's design, 2026-08-12 (cb-two-levels.html), and his correction of my framing the same day:
 *   *"design 1 stands for the whole chit and 2 works for division of labour."*
 *
 * ── ⚠️ THIS IS NOT A SKIN OVER DESIGN 1 ─────────────────────────────────────────────────────────────────────────
 * The two differ in the ATOM OF WORK, not the look. Design 1: the chit is the unit — one status, one assignee.
 * Design 2: the LINE is the unit — Murugan has the onions, Selvam the potatoes, a co-assist is sourcing beans, all
 * at once. That cannot be rendered as a variant of the first, because it needs state Design 1 has nowhere to put.
 * So this is a separate module on its own route, reading the same endpoints. NOTHING in Design 1 is altered, and
 * the old page keeps working whatever happens here.
 *
 * ── ⭐ TWO LEVELS, AND THE SWITCH IS THE PRIVACY BOUNDARY ───────────────────────────────────────────────────────
 *   THEM — the shared record: their message, the order, what was delivered and paid. Both parties hold it.
 *   US   — ours alone: who is doing what, internal notes, cost and margin. The counterparty sees NONE of it.
 * That is not a UI convenience; it is the isolation decision made visible. Assignment and cost are private tables
 * under RLS, delivery is replicated to both copies. The switch shows a person which world they are typing into.
 *
 * Backend: b138 amendment · b142 chit_line · b143 assignment · b144 delivery · b145 cost.
 */
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    c2AssignLines: { m: 'POST', p: '/api/chits/:id/assign-lines',  ok: 'y' },
    c2DeliverLines:{ m: 'POST', p: '/api/chits/:id/deliver-lines', ok: 'y' },
    c2CostsGet:    { m: 'GET',  p: '/api/chits/:id/costs',         ok: 'y' },
    c2CostsAdd:    { m: 'POST', p: '/api/chits/:id/costs',         ok: 'y' },
    c2Reprice:     { m: 'POST', p: '/api/chits/:id/reprice',       ok: 'y' },  // preview:true computes, writes nothing
  });
}

var C2 = { id: null, side: 'them', tab: 'msg', data: null, costs: null, busy: false, err: null, open: null };

/* ── the shell ─────────────────────────────────────────────────────────────────────────────────────────────── */
var C2_TABS = {
  them: [['msg', 'Message'], ['ord', 'Order'], ['del', 'Delivered &amp; paid']],
  us:   [['work', 'Work'], ['notes', 'Notes'], ['cost', 'Cost']],
};

async function openChit2(id){
  C2.id = id; C2.side = 'them'; C2.tab = 'msg'; C2.data = null; C2.costs = null; C2.err = null; C2.open = null;
  UI.nav = 'chit2';
  renderApp();
  await loadChit2();
}
function c2Side(s){ C2.side = s; C2.tab = C2_TABS[s][0][0]; c2Paint(); }
function c2Tab(t){ C2.tab = t; c2Paint(); if (t === 'cost' && !C2.costs) loadChit2Costs(); }
function c2Back(){ UI.nav = UI.folder === 'order' ? 'order' : 'task'; C2.id = null; renderApp(); }
function c2Toggle(k){ C2.open = (C2.open === k) ? null : k; c2Paint(); }

async function loadChit2(){
  C2.busy = true; c2Paint();
  try {
    /* ⚠️ MESSAGES ARE A SEPARATE FETCH. The chit endpoint does NOT carry them, so reading d.msgs would have made
       the Notes tab say "no internal notes yet" forever — including when there were some. A wrong empty state is
       worse than an error, because nobody investigates an empty screen. */
    var both = await Promise.all([
      api('chit', { params: { id: C2.id } }),
      api('messages', { params: { id: C2.id } }).catch(function(){ return []; }),
    ]);
    C2.data = both[0];
    C2.data.msgs = (both[1] || []).map(function(m){ return (typeof mapApiMsg === 'function') ? mapApiMsg(m) : m; });
    C2.err = null;
    /* ⚠️ LOAD THE ROSTER OURSELVES. `UI.actors` is only populated by the assign/bulk-assign modals in app.html, so
       arriving here directly left the Assign dropdown EMPTY — no error, just a select with nothing in it and no
       way to guess why. Anything this screen needs, this screen fetches. */
    if (!(UI.actors || []).length) {
      try { var ac = await api('actors'); UI.actors = (ac || []).map(function(x){ return (typeof mapApiActor === 'function') ? mapApiActor(x) : x; }); }
      catch (e) { UI.actors = []; }
    }
  }
  catch (e) { C2.err = (e && e.message) || 'Could not open this chit.'; }
  C2.busy = false; c2Paint();
}
async function loadChit2Costs(){
  /* ⚠️ FETCHED ONLY WHEN THE COST TAB IS OPENED. An unpermitted reader gets their own rows and no totals at all,
     so there is nothing to hide client-side — but there is also no reason to ask for money on every chit open. */
  try { C2.costs = await api('c2CostsGet', { params: { id: C2.id } }); }
  catch (e) { C2.costs = { error: (e && e.message) || 'Could not read costs.' }; }
  c2Paint();
}
function c2Paint(){ var el = document.getElementById('mainbody'); if (el) el.innerHTML = chit2Screen(); }

/* ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────── */
var c2n = function(v){ return (v === null || v === undefined || v === '') ? null : Number(v); };
var c2q = function(l){ return [l.quantity, l.unit].filter(function(x){ return x !== null && x !== undefined && x !== ''; }).join(' '); };
function c2Money(v){ return (v === null || v === undefined) ? '—' : (typeof inr_ === 'function' ? inr_(v) : ('₹' + v)); }
function c2Head(t, s){ return '<div style="padding:11px 16px;border-bottom:1px solid var(--line)"><div style="font-weight:600;font-size:15px">' + t + '</div>' + (s ? '<div style="color:var(--grey);font-size:12px;margin-top:2px">' + s + '</div>' : '') + '</div>'; }
function c2Grp(d, s){ return '<div style="padding:13px 16px 5px;display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--grey);font-weight:600">' + d + '</span><span style="font-size:13px;color:var(--grey)">' + (s || '') + '</span></div>'; }

/* ⚠️ THE GREYING RULE. Athi asked whether the other lines are greyed — yes, and greyed beats hidden.
   Murugan packing onions needs to know potatoes are on the same Friday trip even though they are Selvam's;
   hiding them causes a second journey and a phone call. Context prevents errors, so everything stays readable
   and only the EMPHASIS moves. The narrow "just my lines, across every chit" view is /folders/worklist. */
function c2Mine(entry, assignMap){
  /* ⚠️ SESSION.actorId, NOT identity_id — the latter does not exist on SESSION (app.html:1435 sets actorId for
     actors and entityId for everyone). Reading the wrong key would have silently marked NOTHING as yours: no
     error, no empty state, just a highlight that never appears. The worst kind of bug in a display rule. */
  var me = (SESSION && SESSION.actorId) || null;
  if (!me) return false;                       // signed in as the entity — every line is "yours", so emphasise none
  var a = assignMap && assignMap[entry.line_id];
  return !!(a && a.assignee_actor_id === me);
}

/* ── THEM · the message ────────────────────────────────────────────────────────────────────────────────────── */
function c2PaneMsg(d){
  var h = d.header || {};
  var raw = (h.summary_json && h.summary_json.via) || {};
  var att = (d.attachments || []);
  /* ⚠️ WHAT THEY WROTE IS THE TOP OF THE SCREEN, VERBATIM. It is the only reason anyone can catch `pathu` read
     as 5, and the one thing that settles an argument six weeks later. */
  var text = raw.text || raw.raw_text || h.auto_subject || '';
  return c2Head(esc(h.sender_entity_display_name || 'Them'), (raw.channel ? esc(String(raw.channel).toUpperCase()) + ' · ' : '') + esc(fmtAt ? fmtAt(h.created_at) : ''))
    + '<div style="padding:16px">'
    + (text ? '<div style="font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:6px">what they wrote</div><div style="font-size:15px;line-height:1.9">' + esc(text) + '</div>' : '<div style="color:var(--grey);font-size:13px">No original message on this chit — it was composed here.</div>')
    + (raw.from ? '<div style="font-size:11.5px;color:var(--grey);margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">from ' + esc(raw.from) + (raw.from_name ? ' · ' + esc(raw.from_name) : '') + '</div>' : '')
    + '</div>'
    + (att.length ? c2Grp('Attached', String(att.length)) + '<div style="padding:0 16px 14px;font-size:12.5px;color:var(--grey)">' + att.map(function(a){ return esc(a.file_name || a.n || 'file'); }).join(' · ') + '</div>' : '');
}

/* ── THEM · the order ──────────────────────────────────────────────────────────────────────────────────────── */
function c2PaneOrd(d){
  var lines = d.live_set || [];
  var asg = d.line_assignment || {};
  var amended = lines.filter(function(e){ return e.history && e.history.length; }).length;
  /* ⚠️ COUNTED, NOT ASSUMED. "3 lines have no price" is the reason someone would reach for the catalogue at all,
     so it is stated on the header rather than left to be discovered line by line. */
  var unpriced = lines.filter(function(e){ var l = e.live || e.original || {}; return !e.removed && (l.price === null || l.price === undefined || Number(l.price) === 0); }).length;
  var out = c2Head('The order', lines.length + ' line' + (lines.length === 1 ? '' : 's') + (amended ? ' · ' + amended + ' amended' : '')
    + (unpriced ? ' · <span style="color:#b0641c">' + unpriced + ' with no price</span>' : ''));
  out += '<div style="padding:9px 16px;border-bottom:1px solid var(--line)">'
    + '<button class="btn" onclick="c2RepricePreview()">₹ Price from catalogue</button>'
    + '<span style="font-size:11.5px;color:var(--grey);margin-left:9px">shows what would change before anything is written</span></div>';

  out += lines.map(function(e, i){
    var l = e.live || e.original || {};
    var mine = c2Mine(e, asg);
    /* ⚠️ A REMOVED LINE STAYS ON SCREEN — struck, greyed, labelled with the reason, counting in nothing. Deleting
       it would make the chit disagree with the message it came from. */
    if (e.removed) {
      var why = { misread_by_ai: 'never asked for', stock_unavailable: 'not available',
                  customer_clarified: 'customer changed it', rate_agreed: 'rate agreed' }[e.reason_code] || 'removed';
      return '<div style="padding:11px 16px;border-bottom:1px solid var(--line);opacity:.55">'
        + '<s>' + esc(l.particulars || '') + ' · ' + esc(c2q(l)) + '</s>'
        + '<span style="margin-left:8px;font-size:10.5px;font-weight:700;color:#8a5a1e;background:#faf3dd;border-radius:5px;padding:1px 6px">' + esc(why) + '</span></div>';
    }
    var was = (e.history || []).slice(0, 1).map(function(h){
      return '<s style="color:var(--grey);margin-right:6px">' + esc([h.particulars, h.quantity, h.unit].filter(Boolean).join(' ')) + '</s>';
    }).join('');
    /* Emphasis, not exclusion: mine sits at full weight, everyone else's is dimmed but perfectly readable. */
    return '<div style="padding:11px 16px;border-bottom:1px solid var(--line);' + (mine ? 'background:#f6f8fb' : 'opacity:.62') + '">'
      + '<div style="display:flex;justify-content:space-between;gap:10px">'
      + '<span style="font-weight:' + (mine ? '700' : '500') + ';font-size:14.5px">' + esc(l.particulars || 'Item') + (mine ? ' <span style="font-size:10px;color:var(--blue);font-weight:800">YOURS</span>' : '') + '</span>'
      + '<span style="font-variant-numeric:tabular-nums;font-size:14px">' + (l.price != null ? c2Money((c2n(l.quantity) || 0) * c2n(l.price)) : '') + '</span></div>'
      + '<div style="margin-top:3px;font-size:13.5px;color:var(--ink-2,#6b665e);font-variant-numeric:tabular-nums">' + was + esc(c2q(l)) + (l.price != null ? ' × ' + c2Money(l.price) : '') + '</div>'
      + (l.comment ? '<div style="margin-top:5px;font-size:12.5px;color:#2c5d7c;background:#eef4f8;border-radius:5px;padding:4px 8px;display:inline-block">' + esc(l.comment) + '</div>' : '')
      + (l.qty_unverified ? '<div style="margin-top:5px;font-size:11px;color:#8a5a1e">⚠️ this number does not appear in their message — check it</div>' : '')
      /* ⚠️ REJECTED IS LOUDER THAN UNVERIFIED, because it is a stronger claim: the quantity was compared against
         THIS line's own words and disagreed, so it was nulled rather than shown. */
      + (l.qty_rejected ? '<div style="margin-top:5px;font-size:11px;color:#c0453b">⚠️ quantity rejected — ' + esc(l.qty_rejected) + '. Fix it on the line.</div>' : '')
      /* ⭐ b141 — their own words for THIS line. The only thing on the row a machine did not produce. */
      + (l.raw_phrase ? '<div style="margin-top:5px;font-size:11.5px;color:var(--grey);font-style:italic">they wrote “' + esc(l.raw_phrase) + '”</div>'
          : (l.asked_as ? '<div style="margin-top:4px;font-size:11.5px;color:var(--grey)">they wrote “' + esc(l.asked_as) + '”</div>' : ''))
      + '</div>';
  }).join('');
  return out;
}

/* ── price from catalogue — PREVIEW, then apply ─────────────────────────────────────────────────────────────────
   Athi, 2026-08-13: *"either wholistically or for an individual item the price should be pulled in"* and
   *"always bring the entire content as an overlay box and perform the activity"*.

   ⚠️ THE PREVIEW IS NOT A COURTESY. Pricing a whole chit in one tap is the useful version and also the dangerous
   one — it can overwrite a figure the customer stated. Showing the exact list first turns a promise into a
   decision, and it costs one extra tap on an action performed rarely.
   ⚠️ AND IT IS AN OVERLAY, not an inline expansion, so the page does not jump under the reader's thumb. */
var C2R = { plan: null, busy: false, only_unpriced: false };

async function c2RepricePreview(){
  C2R.busy = true; c2RepricePaint();
  try { C2R.plan = await api('c2Reprice', { params: { id: C2.id }, body: { preview: true, only_unpriced: C2R.only_unpriced } }); }
  catch (e) { C2R.plan = { error: (e && e.message) || 'Could not read the catalogue.' }; }
  C2R.busy = false; c2RepricePaint();
}
function c2RepriceScope(v){ C2R.only_unpriced = !!v; c2RepricePreview(); }

function c2RepricePaint(){
  if (C2R.busy && !C2R.plan) return modal('<h3 style="margin:0 0 10px">₹ Price from catalogue</h3><div style="color:var(--grey);font-size:12.5px"><span class="spin"></span> checking the catalogue…</div>');
  var p = C2R.plan || {};
  if (p.error) return modal('<h3 style="margin:0 0 10px">₹ Price from catalogue</h3><div style="color:#c0453b;font-size:12.5px">' + esc(p.error) + '</div><button class="btn" style="width:100%;margin-top:12px" onclick="closeModal()">Close</button>');

  if (!p.has_catalogue) {
    return modal('<h3 style="margin:0 0 6px">₹ Price from catalogue</h3>'
      + '<div style="font-size:12.5px;color:var(--grey);margin-bottom:12px">There is no catalogue on this entity yet, so there are no prices to pull. Add items under <b>Catalogue</b> and this will fill them in.</div>'
      + '<button class="btn" style="width:100%" onclick="closeModal()">Close</button>');
  }

  var will = p.will_price || [], need = p.needs_price || [];
  var body = '<div style="display:flex;gap:6px;margin-bottom:12px">'
    + ['<span onclick="c2RepriceScope(false)" style="cursor:pointer;border:1px solid ' + (C2R.only_unpriced ? 'var(--line)' : 'var(--blue)') + ';' + (C2R.only_unpriced ? '' : 'background:var(--blue);color:#fff;font-weight:700;') + 'border-radius:8px;padding:4px 11px;font-size:12px">Every line</span>',
       '<span onclick="c2RepriceScope(true)" style="cursor:pointer;border:1px solid ' + (C2R.only_unpriced ? 'var(--blue)' : 'var(--line)') + ';' + (C2R.only_unpriced ? 'background:var(--blue);color:#fff;font-weight:700;' : '') + 'border-radius:8px;padding:4px 11px;font-size:12px">Only lines with no price</span>'].join('')
    + '</div>';

  body += will.length
    ? '<div style="font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:4px">Will change (' + will.length + ')</div>'
      + will.map(function(w){
          return '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line);font-size:13px">'
            + '<span style="flex:1;min-width:0"><b>' + esc(w.particulars || '') + '</b>'
            + '<div style="font-size:11.5px;color:var(--grey)">→ ' + esc(w.matched) + (w.matched_by_spelling ? ' <span style="color:#8a6d1f">≈ matched by spelling</span>' : '') + '</div>'
            /* ⚠️ REPLACING A STATED FIGURE IS CALLED OUT. Filling an empty price and overwriting one the customer
               wrote are different acts, and only a person can say whether the second is right. */
            + (w.replaces_stated_price ? '<div style="font-size:11px;color:#b0641c">replaces the price on the chit</div>' : '')
            + '</span><span style="text-align:right;font-variant-numeric:tabular-nums">'
            + (w.price != null ? '<s style="color:var(--grey)">' + c2Money(w.price) + '</s> ' : '') + '<b>' + c2Money(w.to) + '</b></span></div>';
        }).join('')
    : '<div style="font-size:12.5px;color:var(--grey)">Nothing to change — every line already matches the catalogue.</div>';

  /* ⚠️ WHAT CANNOT BE PRICED IS SHOWN HERE, NOT LEFT AT ZERO. Athi: "if the exact item not found, then highlight
     for the cost to be updated." A chit that looks priced while a third of it is not is the failure this avoids. */
  if (need.length) {
    body += '<div style="margin-top:14px;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#b0641c;margin-bottom:4px">⚠️ Needs a price from you (' + need.length + ')</div>'
      + need.map(function(n){
          return '<div style="padding:5px 0;border-top:1px solid var(--line);font-size:12.5px"><b>' + esc(n.particulars || '') + '</b> '
            + '<span style="color:var(--grey)">' + esc(n.reason) + '</span></div>';
        }).join('');
  }

  modal('<h3 style="margin:0 0 4px">₹ Price from catalogue</h3>'
    + '<div style="font-size:11.5px;color:var(--grey);margin-bottom:12px">Nothing is written until you confirm. Each change is recorded as an amendment — the old price stays struck through.</div>'
    + body
    + '<div style="display:flex;gap:8px;margin-top:16px">'
    + '<button class="btn" style="flex:1" onclick="closeModal()">Cancel</button>'
    + (will.length ? '<button class="btn pri" style="flex:1" onclick="c2RepriceApply()">Apply ' + will.length + '</button>' : '')
    + '</div>');
}

async function c2RepriceApply(){
  try {
    var r = await api('c2Reprice', { params: { id: C2.id }, body: { only_unpriced: C2R.only_unpriced } });
    closeModal(); C2R.plan = null;
    await loadChit2();
    toast((r && r.applied ? r.applied : 0) + ' line(s) priced — the old values are kept');
  } catch (e) { toast(MSG.fail('apply the prices', e)); }
}

/* ── THEM · delivered & paid ───────────────────────────────────────────────────────────────────────────────── */
function c2PaneDel(d){
  var prog = d.line_delivery || {};
  var sum = d.delivery_summary || null;
  var lines = (d.live_set || []).filter(function(e){ return !e.removed; });
  if (!sum) return c2Head('Delivered & paid') + '<div style="padding:16px;color:var(--grey);font-size:13px">Nothing delivered yet.</div>';

  var out = c2Head('Delivered & paid', sum.complete + ' of ' + sum.lines + ' complete'
    + (sum.divergent ? ' · <span style="color:#b0641c">' + sum.divergent + ' disagreed</span>' : ''));

  out += lines.map(function(e){
    var p = prog[e.line_id] || {};
    var l = e.live || e.original || {};
    var pct = (p.ordered ? Math.min(100, Math.round((p.delivered || 0) / p.ordered * 100)) : 0);
    var state = p.complete ? '<span style="color:#2f6b4f;font-size:12.5px">complete</span>'
      : (p.delivered ? '<span style="color:#b0641c;font-size:12.5px">part</span>'
      : '<span style="color:var(--grey);font-size:12.5px">not started</span>');
    return '<div style="padding:11px 16px;border-bottom:1px solid var(--line)">'
      + '<div style="display:flex;justify-content:space-between"><span style="font-weight:500">' + esc(l.particulars || '') + '</span>' + state + '</div>'
      + '<div style="margin-top:4px;font-size:12.5px;color:var(--grey);font-variant-numeric:tabular-nums"><b style="color:var(--ink)">' + (p.delivered || 0) + '</b> of ' + (p.ordered == null ? '—' : p.ordered) + ' ' + esc(l.unit || '')
      + (p.pending ? ' · ' + p.pending + ' pending' : '') + (p.over ? ' · <span style="color:#b0641c">' + p.over + ' over</span>' : '') + '</div>'
      + '<div style="margin-top:6px;height:4px;background:var(--line);border-radius:2px;overflow:hidden"><i style="display:block;height:100%;width:' + pct + '%;background:#2f6b4f"></i></div>'
      /* ⚠️ THE THREE STATES ARE KEPT APART. "They have not confirmed yet" is the NORMAL case and must not wear the
         same badge as a real disagreement, or the badge stops being read. */
      + (p.both_agree ? '<div style="margin-top:6px;font-size:11.5px;color:#2f6b4f">✓ both of you recorded the same</div>' : '')
      + (p.divergent ? '<div style="margin-top:6px;font-size:11.5px;color:#b0641c">⚠️ you recorded ' + p.delivered + ', they recorded ' + p.theirs + ' — both are shown, neither is corrected</div>' : '')
      + (p.unacknowledged ? '<div style="margin-top:6px;font-size:11.5px;color:var(--grey)">they have not confirmed this yet</div>' : '')
      + ((p.events || []).length ? '<div style="margin-top:7px;font-size:11.5px;color:var(--grey)">' + p.events.map(function(v){
            return (v.quantity > 0 ? '+' : '') + v.quantity + ' ' + esc(v.unit || '') + ' · ' + esc(v.mine ? 'you' : (v.by || 'them')) + (v.reference ? ' · ' + esc(v.reference) : '');
          }).join('<br>') + '</div>' : '')
      /* ⚠️ RECORDING LIVES ON THE LINE ITSELF. The first version of this pane was read-only — you could watch a
         delivery but never make one, which meant the whole tab was a demo. Recording is the point; it is the
         action he performs twenty times a day, so it is one tap from the line rather than behind a menu. */
      + '<div style="margin-top:9px;display:flex;gap:7px;align-items:center;flex-wrap:wrap">'
      + '<input id="c2dq_' + e.line_id + '" inputmode="decimal" placeholder="' + (p.pending ? String(p.pending) : 'qty') + '" style="width:74px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:13px">'
      + '<span style="font-size:12.5px;color:var(--grey)">' + esc(l.unit || '') + '</span>'
      + '<input id="c2dr_' + e.line_id + '" placeholder="reference (optional)" style="flex:1;min-width:110px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:13px">'
      + '<button class="btn pri" onclick="c2Deliver(\'' + e.line_id + '\',\'' + esc(l.unit || '') + '\')">Delivered</button>'
      + (p.delivered ? '<button class="btn" title="Record a correcting entry — the original claim stays on the record" onclick="c2Deliver(\'' + e.line_id + '\',\'' + esc(l.unit || '') + '\',true)">Take back</button>' : '')
      + '</div>'
      + '</div>';
  }).join('');
  return out;
}
/**
 * c2Deliver(line_id, unit, back) — claim a delivery, or correct one.
 *
 * ⚠️ "TAKE BACK" SENDS A NEGATIVE QUANTITY, it does not delete anything. Both rows stay on the record, because
 * what was claimed on the day has to remain legible after somebody changes their mind — and because the other
 * party already holds a copy of the original claim.
 * ⚠️ EXCESS IS NOT BLOCKED HERE either. Delivering 11 against an order of 10 is normal; the API records it and
 * shows the excess. Refusing it in the browser would make the record disagree with the lorry.
 */
async function c2Deliver(line_id, unit, back){
  var el = document.getElementById('c2dq_' + line_id);
  var q = Number(el ? el.value.trim() : '');
  if (!Number.isFinite(q) || q === 0) return toast('How many? (a number, and not zero)');
  var ref = (document.getElementById('c2dr_' + line_id) || {}).value || null;
  try {
    await api('c2DeliverLines', { params: { id: C2.id }, body: { rows: [
      { line_id: line_id, quantity: back ? -Math.abs(q) : Math.abs(q), unit: unit || null, reference: ref } ] } });
    await loadChit2();
    toast(back ? 'Taken back — the original claim stays on the record' : 'Recorded');
  } catch (e) { toast(MSG.fail('record the delivery', e)); }
}

/* ── US · work ─────────────────────────────────────────────────────────────────────────────────────────────── */
function c2PaneWork(d){
  var asg = d.line_assignment || {};
  var lines = (d.live_set || []).filter(function(e){ return !e.removed; });
  var out = '<div style="padding:9px 16px;background:#f4f1e8;color:#5b5340;font-size:12.5px;border-bottom:1px solid var(--line)">◍ Only your side sees this. The other party sees none of it.</div>';

  /* Who has what — the roll-up for THIS chit. The cross-chit version is /folders/worklist. */
  var people = {};
  lines.forEach(function(e){
    var a = asg[e.line_id];
    var key = (a && a.assignee_name) || 'Unassigned';
    (people[key] = people[key] || []).push(e);
  });
  out += c2Grp('Who has what', Object.keys(people).length + ' ' + (Object.keys(people).length === 1 ? 'person' : 'people'));
  out += Object.keys(people).map(function(k){
    return '<div style="padding:9px 16px;border-bottom:1px solid var(--line)"><div style="font-weight:500">' + esc(k) + '</div>'
      + '<div style="font-size:12.5px;color:var(--grey);margin-top:2px">' + people[k].map(function(e){ return esc((e.live || e.original || {}).particulars || ''); }).join(' · ') + '</div></div>';
  }).join('');

  /**
   * ⭐ THE OPERATIONAL SUMMARY — Athi, 2026-08-13: *"we should be able to see the summary of what is given, what
   * is left, which date it is assigned."*
   *
   * ⚠️ IT BELONGS ON **US**, not THEM, and that is not a layout choice. It mixes a SHARED fact (what has been
   * delivered) with a PRIVATE one (who is doing it). The same table on the shared side would hand the customer
   * your roster and your capacity.
   *
   * ⚠️ AND IT IS ALL DERIVED. Ordered comes from the live line, delivered is summed from the delivery rows, left
   * is the difference, and the assignee is the latest row of the chain. Nothing here is stored, so nothing here
   * can disagree with the tabs it summarises.
   */
  var prog = d.line_delivery || {};
  var totOrd = 0, totLeft = 0, anyVal = false;
  lines.forEach(function(e){
    var l = e.live || e.original || {}; var p = prog[e.line_id] || {};
    if (l.price != null && l.quantity != null) {
      anyVal = true;
      totOrd += c2n(l.quantity) * c2n(l.price);
      totLeft += Math.max(0, (c2n(l.quantity) - (p.delivered || 0))) * c2n(l.price);
    }
  });
  out += c2Grp('What is left', anyVal ? (c2Money(totLeft) + ' of ' + c2Money(totOrd)) : '');
  out += '<div style="display:flex;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--grey);padding:0 16px 4px;font-weight:600">'
    + '<span style="flex:1">Item</span><span style="width:62px;text-align:right">Given</span><span style="width:62px;text-align:right">Left</span></div>';

  out += lines.map(function(e){
    var a = asg[e.line_id] || {};
    var l = e.live || e.original || {};
    var p = prog[e.line_id] || {};
    var ord = c2n(l.quantity), got = p.delivered || 0;
    var left = (ord == null) ? null : Math.max(0, Math.round((ord - got) * 1000) / 1000);
    var open = C2.open === ('w' + e.line_id);
    var done = (left === 0 && ord != null);
    return '<div onclick="c2Toggle(\'w' + e.line_id + '\')" style="padding:11px 16px;border-bottom:1px solid var(--line);cursor:pointer">'
      + '<div style="display:flex;align-items:baseline;gap:8px">'
      + '<span style="flex:1;font-weight:500">' + esc(l.particulars || '') + '<span style="color:var(--grey);font-weight:400;font-size:12.5px"> · ' + esc(c2q(l)) + '</span></span>'
      + '<span style="width:62px;text-align:right;font-variant-numeric:tabular-nums;font-size:13.5px">' + got + '</span>'
      + '<span style="width:62px;text-align:right;font-variant-numeric:tabular-nums;font-size:13.5px;font-weight:' + (done ? '400' : '700') + ';color:' + (done ? '#2f6b4f' : 'var(--ink)') + '">' + (left === null ? '—' : (done ? '✓' : left)) + '</span>'
      + '<span style="color:var(--grey);width:12px;text-align:right">' + (open ? '▾' : '▸') + '</span></div>'
      /* Who has it and when it is due — the two things that turn "what is left" into "who do I chase". */
      + (a.assignee_name ? '<div style="margin-top:5px;font-size:12px;color:#5b5340;background:#f4f1e8;border-radius:5px;padding:3px 8px;display:inline-block">◍ ' + esc(a.assignee_name) + (a.task ? ' · ' + esc(a.task) : '') + (a.due_date ? ' · due ' + esc(String(a.due_date).slice(0, 10)) : '') + '</div>'
          : '<div style="margin-top:5px;font-size:12px;color:var(--grey)">unassigned' + (left ? ' · nobody is doing this' : '') + '</div>')
      + ((a.history || []).length ? '<div style="margin-top:4px;font-size:11px;color:var(--grey)">was ' + esc(a.history.map(function(h){ return h.assignee_name || 'unassigned'; }).join(' → ')) + '</div>' : '')
      /* ⚠️ SURFACED HERE TOO. A line the two parties disagree about is a line you cannot call finished, and this
         is the screen where someone decides what still needs doing. */
      + (p.divergent ? '<div style="margin-top:4px;font-size:11px;color:#b0641c">⚠️ they say ' + p.theirs + ', you say ' + p.delivered + '</div>' : '')
      + '</div>'
      + (open ? c2AssignForm(e.line_id, a) : '');
  }).join('');
  return out;
}
function c2AssignForm(line_id, a){
  var roster = UI.actors || [];
  /* ⚠️ SAY SO WHEN THERE IS NOBODY TO ASSIGN TO. An empty dropdown is indistinguishable from a broken one, and
     the honest answer — "you have not added any co-assists" — is also the instruction. */
  if (!roster.length) {
    return '<div style="padding:11px 16px 14px;background:#fbfaf8;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--grey)">'
      + 'No co-assists yet — add someone under <b>Co-assists</b> and they will appear here.</div>';
  }
  var opts = roster.map(function(x){ return '<option value="' + esc(x.id) + '"' + (a.assignee_actor_id === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('');
  return '<div style="padding:11px 16px 14px;background:#fbfaf8;border-bottom:1px solid var(--line)">'
    + '<div style="display:flex;gap:9px;flex-wrap:wrap;align-items:flex-end">'
    + '<div><label style="display:block;font-size:11px;color:var(--grey);margin-bottom:3px">ASSIGN TO</label>'
    + '<select id="c2a_' + line_id + '" style="padding:7px 9px;border:1px solid var(--line);border-radius:6px;font-size:13px"><option value="">Unassigned</option>' + opts + '</select></div>'
    + '<div><label style="display:block;font-size:11px;color:var(--grey);margin-bottom:3px">TASK</label>'
    + '<input id="c2t_' + line_id + '" value="' + esc(a.task || '') + '" placeholder="packing" style="width:110px;padding:7px 9px;border:1px solid var(--line);border-radius:6px;font-size:13px"></div>'
    + '<div><label style="display:block;font-size:11px;color:var(--grey);margin-bottom:3px">DUE</label>'
    + '<input id="c2d_' + line_id + '" type="date" value="' + esc(a.due_date ? String(a.due_date).slice(0, 10) : '') + '" style="padding:7px 9px;border:1px solid var(--line);border-radius:6px;font-size:13px"></div>'
    + '<button class="btn pri" onclick="event.stopPropagation();c2Assign(\'' + line_id + '\')">Assign</button></div></div>';
}
async function c2Assign(line_id){
  var sel = document.getElementById('c2a_' + line_id);
  var actor = sel ? sel.value : '';
  var name = (sel && sel.selectedIndex > 0) ? sel.options[sel.selectedIndex].text : null;
  var task = (document.getElementById('c2t_' + line_id) || {}).value || null;
  var due = (document.getElementById('c2d_' + line_id) || {}).value || null;
  try {
    /* ⚠️ assignee_actor_id IS SENT EXPLICITLY, null included — the API refuses an omitted key, because
       "unassign" and "never assigned" are different facts and it will not guess which was meant. */
    await api('c2AssignLines', { params: { id: C2.id }, body: { edits: [
      { line_id: line_id, assignee_actor_id: actor || null, assignee_name: name, assignee_type: 'human',
        task: task, due_date: due } ] } });
    C2.open = null;
    await loadChit2();
    toast(actor ? ('Assigned to ' + name) : 'Unassigned');
  } catch (e) { toast(MSG.fail('assign the line', e)); }
}

/* ── US · notes ────────────────────────────────────────────────────────────────────────────────────────────── */
function c2PaneNotes(d){
  /* ⚠️ INTERNAL ONLY. The counterparty thread lives on THEM; this one never crosses. Both read from the same
     chit_messages table and are separated by scope, so a note cannot leak by being posted to the wrong screen. */
  var msgs = (d.msgs || []).filter(function(m){ return (m.scope || 'internal') === 'internal'; });
  return '<div style="padding:9px 16px;background:#f4f1e8;color:#5b5340;font-size:12.5px;border-bottom:1px solid var(--line)">◍ Internal notes — never shared with the other party.</div>'
    + (msgs.length ? msgs.map(function(m){
        return '<div style="padding:10px 16px;border-bottom:1px solid var(--line)"><div style="font-size:11.5px;color:var(--grey)">' + esc(m.author || '') + ' · ' + esc(m.at || '') + '</div><div style="font-size:13.5px;margin-top:2px">' + esc(m.body || '') + '</div></div>';
      }).join('')
      : '<div style="padding:16px;color:var(--grey);font-size:13px">No internal notes yet.</div>');
}

/* ── US · cost ─────────────────────────────────────────────────────────────────────────────────────────────── */
function c2PaneCost(d){
  var c = C2.costs;
  var out = '<div style="padding:9px 16px;background:#f4f1e8;color:#5b5340;font-size:12.5px;border-bottom:1px solid var(--line)">◍ Your numbers. The other party sees only the price they were quoted.</div>';
  if (!c) return out + '<div style="padding:18px;color:var(--grey);font-size:12.5px"><span class="spin"></span> reading…</div>';
  if (c.error) return out + '<div style="padding:16px;color:#c0453b;font-size:12.5px">' + esc(c.error) + '</div>';

  /* ⚠️ WRITE-WITHOUT-READ, RENDERED HONESTLY. An unpermitted reader is TOLD they cannot see the totals rather
     than shown a zero — a masked or empty figure still says a figure exists and roughly when it moved. */
  if (!c.can_see_totals) {
    out += '<div style="padding:14px 16px;font-size:12.5px;color:var(--grey);border-bottom:1px solid var(--line)">'
      + 'You can record what you spend, and see what you recorded. Totals and margin are not shown to you.</div>';
  } else {
    out += '<div style="padding:13px 16px;border-bottom:1px solid var(--line);background:var(--wash,#f6f4f0);font-variant-numeric:tabular-nums">'
      + c2Row('Invoiced', c2Money(c.invoiced))
      + Object.keys(c.by_kind || {}).map(function(k){ return c2Row(k.charAt(0).toUpperCase() + k.slice(1), c2Money(c.by_kind[k])); }).join('')
      + '<div style="display:flex;justify-content:space-between;padding-top:7px;margin-top:4px;border-top:1px solid var(--line);font-weight:600">'
      + '<span>Margin</span><span style="color:' + ((c.margin || 0) < 0 ? '#c0453b' : '#2f6b4f') + '">' + c2Money(c.margin)
      + (c.margin_pct == null ? '' : ' · ' + c.margin_pct + '%') + '</span></div>'
      + (c.mixed_currency ? '<div style="font-size:11px;color:#8a5a1e;margin-top:4px">⚠️ more than one currency — these are not added together</div>' : '')
      + '</div>';
  }

  out += c2Grp(c.can_see_totals ? 'Every cost' : 'What you recorded', String((c.costs || []).length));
  out += (c.costs || []).length ? c.costs.map(function(x){
    return '<div style="padding:9px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;font-size:13px">'
      + '<span>' + esc(x.kind) + (x.note ? ' <span style="color:var(--grey)">· ' + esc(x.note) + '</span>' : '')
      + (x.minutes ? '<div style="font-size:11.5px;color:var(--grey)">' + x.minutes + ' min × ' + c2Money(x.rate_per_hour) + '/hr</div>' : '')
      + (x.recorded_by_actor_name ? '<div style="font-size:11px;color:var(--grey)">' + esc(x.recorded_by_actor_name) + '</div>' : '')
      + '</span><span style="font-variant-numeric:tabular-nums">' + c2Money(Number(x.amount)) + '</span></div>';
  }).join('') : '<div style="padding:14px 16px;color:var(--grey);font-size:12.5px">Nothing recorded yet.</div>';

  out += '<div style="padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">'
    + '<select id="c2ck" style="padding:7px 9px;border:1px solid var(--line);border-radius:6px;font-size:13px"><option value="labour">labour</option><option value="goods">goods</option><option value="transport">transport</option><option value="other">other</option></select>'
    + '<input id="c2cm" placeholder="minutes" style="width:80px;padding:7px 9px;border:1px solid var(--line);border-radius:6px;font-size:13px">'
    + '<input id="c2cr" placeholder="₹/hr" style="width:70px;padding:7px 9px;border:1px solid var(--line);border-radius:6px;font-size:13px">'
    + '<input id="c2ca" placeholder="or amount" style="width:90px;padding:7px 9px;border:1px solid var(--line);border-radius:6px;font-size:13px">'
    + '<input id="c2cn" placeholder="note" style="flex:1;min-width:110px;padding:7px 9px;border:1px solid var(--line);border-radius:6px;font-size:13px">'
    + '<button class="btn pri" onclick="c2AddCost()">Add</button></div>';
  return out;
}
function c2Row(k, v){ return '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px"><span>' + esc(k) + '</span><span>' + v + '</span></div>'; }
async function c2AddCost(){
  var g = function(i){ var e = document.getElementById(i); return e ? e.value.trim() : ''; };
  var body = { kind: g('c2ck'), note: g('c2cn') || null };
  if (g('c2cm') && g('c2cr')) { body.minutes = Number(g('c2cm')); body.rate_per_hour = Number(g('c2cr')); }
  else if (g('c2ca')) { body.amount = Number(g('c2ca')); }
  else return toast('Give minutes + rate, or an amount');
  try { await api('c2CostsAdd', { params: { id: C2.id }, body: { rows: [body] } }); C2.costs = null; await loadChit2Costs(); toast('Recorded'); }
  catch (e) { toast(MSG.fail('record the cost', e)); }
}

/* ── the screen ────────────────────────────────────────────────────────────────────────────────────────────── */
function chit2Screen(){
  if (C2.busy && !C2.data) return '<div style="flex:1;min-height:0;overflow-y:auto"><div style="padding:26px;color:var(--grey)"><span class="spin"></span> opening…</div></div>';
  if (C2.err) return '<div style="flex:1;min-height:0;overflow-y:auto"><div style="padding:26px;color:#c0453b">' + esc(C2.err) + '</div></div>';
  var d = C2.data; if (!d) return '<div style="flex:1;min-height:0;overflow-y:auto"><div style="padding:26px;color:var(--grey)">Nothing open.</div></div>';
  var h = d.header || {};
  var sum = d.delivery_summary;

  var side = ['them', 'us'].map(function(s){
    var on = C2.side === s;
    return '<button onclick="c2Side(\'' + s + '\')" style="flex:1;border:1px solid ' + (on ? 'var(--ink,#1c1a17)' : 'var(--line)') + ';background:' + (on ? 'var(--ink,#1c1a17)' : 'transparent') + ';color:' + (on ? '#fff' : 'var(--grey)') + ';font:inherit;font-size:13.5px;padding:9px 0;cursor:pointer;font-weight:' + (on ? '600' : '400') + ';border-radius:' + (s === 'them' ? '8px 0 0 8px' : '0 8px 8px 0') + '">'
      + (s === 'them' ? 'Them' : 'Us') + '<span style="display:block;font-size:11px;opacity:.72;font-weight:400">' + (s === 'them' ? 'the shared record' : 'our side only') + '</span></button>';
  }).join('');

  var tabs = C2_TABS[C2.side].map(function(t){
    var on = C2.tab === t[0];
    return '<button onclick="c2Tab(\'' + t[0] + '\')" style="flex:1;background:none;border:0;border-bottom:2px solid ' + (on ? 'var(--ink,#1c1a17)' : 'transparent') + ';font:inherit;font-size:13px;color:' + (on ? 'var(--ink)' : 'var(--grey)') + ';padding:10px 4px;cursor:pointer;font-weight:' + (on ? '600' : '400') + '">' + t[1] + '</button>';
  }).join('');

  var pane = { msg: c2PaneMsg, ord: c2PaneOrd, del: c2PaneDel, work: c2PaneWork, notes: c2PaneNotes, cost: c2PaneCost }[C2.tab];

  /* ⚠️ THE WRAPPER IS NOT OPTIONAL. Any screen returned into #mainbody must carry flex:1;min-height:0;overflow-y:auto
     or .main{overflow:hidden} clips everything below the first viewport and the page silently cannot scroll. */
  return '<div style="flex:1;min-height:0;overflow-y:auto;background:#fff">'
    + '<div style="padding:10px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px">'
    + '<span onclick="c2Back()" style="cursor:pointer;color:var(--blue);font-size:13px">‹ Back</span>'
    + '<span style="font-weight:600;font-size:15px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(h.manual_subject || h.auto_subject || 'Chit') + '</span>'
    + '<span style="font-size:11px;color:var(--grey)">design 2</span></div>'
    + '<div style="padding:10px 16px 0;display:flex">' + side + '</div>'
    + '<div style="padding:7px 16px 0;font-size:11.5px;color:var(--grey);text-align:center">'
    + (C2.side === 'them' ? 'Both parties hold everything on this side' : 'Assignment, notes and cost — they never see this') + '</div>'
    + (sum ? '<div style="padding:6px 16px 0;font-size:12px;color:var(--grey);text-align:center">' + sum.complete + ' of ' + sum.lines + ' lines delivered</div>' : '')
    + '<div style="display:flex;border-bottom:1px solid var(--line);margin-top:10px">' + tabs + '</div>'
    + pane(d)
    + '</div>';
}
