/* app/cap-worklist.js — MY WORK, across every chit. Lazy (ensureCap('worklist')).
 *
 * Athi, 2026-08-14: *"if we go to the actor id, can we able to see their own rows irrespective of the chit? how do
 * we handle this — if that is not successful, then division of labour is not useful?"*
 *
 * He is right that it was the missing half. `GET /api/folders/worklist` (assign.byPerson) has existed and been
 * RLS-safe for a while, and NOTHING in the app ever called it — so a co-assist had to open every chit in turn to
 * find the three lines that were theirs. Per-line assignment without this screen is a filing system, not a
 * division of labour.
 *
 * ── ⭐ SAME MODEL AS THE WORK TAB, HIS MODEL ────────────────────────────────────────────────────────────────────
 * One array of assigned lines, grouped by an ORDER of keys:
 *   an actor      ['date', 'chit']   my day, then which order each line belongs to
 *   the owner     ['who', 'date']    who has what, then when it is due
 * A different question is a different key order, not a different screen.
 *
 * ⚠️ THE SERVER DECIDES WHOSE ROWS THESE ARE. An actor's own id is forced onto the query in routes/folders.js —
 * this screen cannot widen it, and must never look like it can.
 */
var WL = { data: null, busy: false, err: null, due: '', view: null,
  /**
   * ⭐ GROUPING IS TWO INDEPENDENT CHOICES — Athi, 2026-08-14: *"under date, if i want to see all without who is
   * doing it, any chance of removing the name from the filter … just a checkbox option so the filter can omit
   * parameters."*
   *
   * A fixed pair of presets could not express that: dropping the second key is a different question from swapping
   * the first. So `primary` decides what the headings are, and `then` decides whether they split again — and
   * `then = null` is a legal, useful answer rather than a missing setting.
   */
  primary: null, then: undefined,
  /* Which groups are OPEN. Collapsed is the DEFAULT: the point of this screen is to see every name or every date
     at once and open the one you need. A fully expanded list is the wall it replaces. */
  open: {} };

if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    worklist: { m: 'GET', p: '/api/folders/worklist', ok: 'y' },
    /* ⭐ Everything a person does to a line, recorded from the list they did it from. Declared HERE rather than
       borrowed from cap-chit2, so opening a line never depends on another capability having been loaded first. */
    wlDeliver: { m: 'POST', p: '/api/chits/:id/deliver-lines', ok: 'y' },
    wlAssign:  { m: 'POST', p: '/api/chits/:id/assign-lines',  ok: 'y' },
    wlChit:    { m: 'GET',  p: '/api/chits/:id',               ok: 'y' },
    wlActors:  { m: 'GET',  p: '/api/actors',                  ok: 'y' },
    /* b155 — the INTERNAL thread, narrowed to one line. Same store the message centre uses; never a second one. */
    wlMsgs:    { m: 'GET',  p: '/api/chits/:id/messages',       ok: 'y' },
    wlMsgAdd:  { m: 'POST', p: '/api/chits/:id/messages',       ok: 'y' },
  });
}

async function wlLoad(){
  WL.busy = true; WL.err = null; wlPaint();
  try { WL.data = await api('worklist', WL.due ? { query: { due_on: WL.due } } : {}); }
  catch (e) { WL.err = (e && e.message) || 'Could not read the work list.'; }
  WL.busy = false; wlPaint();
}
function wlPaint(){ var el = document.getElementById('mainbody'); if (el) el.innerHTML = worklistScreen(); }
function wlDue(v){ WL.due = v || ''; wlLoad(); }
function wlPrimary(k){ WL.primary = k; if (WL.then === k) WL.then = null; WL.open = {}; wlPaint(); }
/* A checkbox, so the second key can be switched OFF entirely — "every line under its date, never mind who". */
function wlThen(k){ WL.then = (WL.then === k) ? null : k; WL.open = {}; wlPaint(); }
function wlByItem(){ WL.byItem = (WL.byItem === false); WL.open = {}; wlPaint(); }
/**
 * ⭐ OPENING A GROUP OPENS WHAT IS INSIDE IT, ALL THE WAY DOWN.
 *
 * ⚠️ The first version toggled one level, so with two keys a date opened onto a row of NAMES — another closed
 * layer — and you clicked twice to reach a line. That is not "expand the required people or the date"; that is a
 * tree to be navigated. One click, one answer: the group and its whole subtree.
 */
function wlToggle(id){
  var kids = wlAllIds().filter(function(x){ return x.indexOf(id + '␟') === 0; });
  var open = !WL.open[id];
  WL.open[id] = open;
  kids.forEach(function(x){ WL.open[x] = open; });
  wlPaint();
}
function wlAllIds(){ var d = WL.data || {}; return wlIds(wlRows(d), wlKeys(!!d.scoped_to_self)); }
/**
 * ⚠️ EXPAND-ALL WALKS THE DATA, NOT THE SCREEN. The first version collected ids as it PAINTED, which meant a
 * collapsed group never registered its children — so "expand all" opened one level, the leaves stayed hidden, and
 * the screen looked empty while holding every row. The set of groups that exist is a property of the rows and the
 * key order; it must not depend on which of them happen to be open.
 */
function wlAll(open){
  WL.open = {};
  if (open) wlAllIds().forEach(function(id){ WL.open[id] = true; });
  wlPaint();
}
function wlIds(rows, keys, path){
  if (!keys.length) return [];
  var key = keys[0], buckets = {}, out = [];
  rows.forEach(function(r){ var k = WLG[key].of(r); (buckets[k] = buckets[k] || []).push(r); });
  Object.keys(buckets).forEach(function(k){
    var id = wlId(path, key, k);
    out.push(id);
    out = out.concat(wlIds(buckets[k], keys.slice(1), (path || []).concat([key, k])));
  });
  return out;
}
/**
 * ⭐ AN ID IS THE WHOLE PATH — KEY *AND* VALUE, AT EVERY LEVEL.
 *
 * ⚠️ It carried only the key names at first (`date␟who␟Devi`), which meant Devi-under-Monday and Devi-under-Friday
 * were the SAME id: opening one opened both, and no child id began with its parent's, so opening a date could not
 * open what was inside it. Both symptoms, one cause — a path that named the levels but not which branch.
 */
function wlId(path, key, val){ return (path || []).concat([key, String(val)]).join('␟'); }
/**
 * The active key order. Defaults differ by WHO is looking — an actor's own list is short and wants the date first;
 * an owner is scanning people — and both are overridable.
 *
 * ⚠️ `then === undefined` MEANS "NOT CHOSEN", `then === null` MEANS "CHOSEN OFF". Collapsing those two into one
 * falsy value would make the checkbox unable to express the thing it exists for: turning the second key off.
 */
function wlKeys(mine){
  var p = WL.primary || (mine ? 'date' : 'who');
  var t = (WL.then === undefined) ? (p === 'who' ? 'date' : 'who') : WL.then;
  var keys = (t && t !== p) ? [p, t] : [p];
  /**
   * ⭐ THIS IS A PIVOT, NOT A NESTED LIST — Athi, 2026-08-14: *"when i remove the date, all the same item should
   * group together … if i remove the date, what my demand for that particular product?"*
   *
   * ⚠️ THE FIRST VERSION ONLY REMOVED A HEADING. Dropping a dimension left the raw rows behind, so Rice Ponni
   * Boiled sat there twice — 120 kg and 50 kg — and you added them up yourself. That is the one arithmetic the
   * screen exists to do. In a pivot, a dimension you DROP is a dimension you SUM OVER.
   *
   * ITEM IS ALWAYS THE INNERMOST DIMENSION because the quantity belongs to it: whatever you group by, the number
   * under each heading is a quantity OF SOMETHING. Then "170 kg of rice" is true at every level, and the orders
   * it came from are one click below it — the total and its constituents, never one without the other.
   */
  if (WL.byItem !== false && keys.indexOf('item') < 0) keys.push('item');
  return keys;
}

/**
 * Flatten byPerson's people[] back to rows — the grouping is this screen's job, not the API's.
 *
 * ⭐ FINISHED WORK LEAVES THE QUEUE — Athi, 2026-08-14: *"when the status is set to complete, why still in the
 * queue? Once completed it has to move out of his queue … here it has to be shown which are not complete."*
 *
 * ⚠️ I ARGUED THE OPPOSITE THIS EVENING and was wrong about the important half. My reasoning was that a done row
 * left visible tells the next person "someone already has this". True — but it was costing far more than it
 * bought: a done line stayed in the ROLL-UPS, so a finished, fully delivered line still counted as **1 overdue**
 * in red on its heading. A queue whose headline figure counts work that is finished is worse than one that hides
 * it, because the number is what people act on. His screenshot shows it exactly: "Jute Bag 50kg · 1 overdue"
 * over a struck-through line reading "all out".
 *
 * So done work is out of the list AND out of the counts by default, and `show done` brings it back — which keeps
 * the "someone already has this" answer available without letting it corrupt the arithmetic.
 */
function wlRows(d){
  var out = [];
  (d.people || []).forEach(function(p){
    (p.lines || []).forEach(function(l){
      if (!WL.showDone && l.state === 'done') return;
      out.push(Object.assign({}, l, { who: p.name || 'Unassigned', actor_id: p.actor_id || null }));
    });
  });
  return out;
}
function wlDone(){ WL.showDone = !WL.showDone; WL.open = {}; wlPaint(); }
/** How many are hidden right now — stated plainly, because silently dropping rows is its own kind of lying. */
function wlDoneCount(d){
  var n = 0;
  ((d || {}).people || []).forEach(function(p){ (p.lines || []).forEach(function(l){ if (l.state === 'done') n++; }); });
  return n;
}

function wlDateLabel(d){
  if (!d) return 'No date';
  try {
    var t = new Date(String(d).slice(0, 10) + 'T00:00:00');
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.round((t - today) / 86400000);
    var when = CBLocale.date(t, { weekday: 'short', day: '2-digit', month: 'short' });
    var rel = days < 0 ? 'Overdue' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days <= 7 ? 'This week' : 'Later';
    return { text: when, rel: rel, overdue: days < 0, today: days === 0 };
  } catch (e) { return { text: String(d), rel: '', overdue: false, today: false }; }
}

/* One row. It drops whatever the headings above it already said — the same rule as the Work tab, for the same
   reason: a heading that reads "Raman" over a row that says "Raman" is noise where the item should be. */
function wlRow(r, ctx, depth){
  var due = r.due_date ? wlDateLabel(r.due_date) : null;
  var named = ctx.indexOf('item') >= 0;    // an item heading above already said WHAT this is
  var ordered = ctx.indexOf('chit') >= 0;  // …and a chit heading already said which order
  var order = esc(r.subject || 'chit') + wlWho(r.counterparty);
  var done = r.state === 'done';
  /**
   * ⭐ WHAT IS LEFT, NOT WHAT WAS ORDERED — Athi, 2026-08-14: *"partial deliver, and the remaining qty to be
   * visible with history."*
   *
   * ⚠️ THE ROW SAID "30 kg" WITH 20 ALREADY OUT. That is the ordered figure, and it is the one number a person
   * working the list must not be given on its own: it is right at the start, wrong ever after, and wrong in the
   * direction that sends someone to fetch a full load twice.
   */
  var qty = esc([r.quantity, r.unit].filter(function(x){ return x != null && x !== ''; }).join(' '));
  if (r.delivered > 0 && r.left != null) {
    qty = '<b style="color:' + (r.left === 0 ? 'var(--ok-2)' : 'var(--warn-2)') + '">'
      + (r.left === 0 ? 'all out' : esc(String(r.left)) + ' ' + esc(r.unit || '') + ' left')
      + '</b> <span style="color:var(--grey)">· ' + esc(String(r.delivered)) + ' of ' + esc(String(r.quantity)) + '</span>';
  }

  /**
   * ⚠️ A ROW MUST SAY SOMETHING ITS HEADINGS DID NOT. Under "Rice Ponni Boiled · 170 kg", a row that leads with
   * "Rice Ponni Boiled" is the total repeated back at you. What the row is for there is WHICH ORDER this slice of
   * the total came from — you cannot ring a heading.
   */
  var lead = named ? (ordered ? qty : order) : esc(r.particulars || '');
  var tail = named ? (ordered ? '' : ' · ' + qty) : ' · ' + qty;

  var bits = [];
  if (ctx.indexOf('who') < 0 && r.who) bits.push(esc(r.who));
  if (ctx.indexOf('date') < 0 && due) bits.push((due.overdue ? '⚠️ ' : '') + esc(due.text));
  if (r.task) bits.push(esc(r.task));

  /* ⚠️ THE LEAF IS BODY TEXT, AND MUST BE QUIETER THAN EVERY HEADING ABOVE IT. It used to be 14.5px bold — larger
     than the two levels it sat under — so the eye landed here first and then had to climb. Regular weight is what
     separates content from heading now, not size alone. */
  var ind = 16 + (depth || 0) * 15;
  /* ⚠️ A DONE LINE STAYS ON THE LIST, GREYED — it does not vanish. Athi's reason for the state is *"so others
     should not do that"*, and a row that disappears cannot say "someone already has this". Removing it would
     make two people picking the same sack MORE likely, not less. */
  return '<div data-testid="wl-row" data-state="' + (done ? 'done' : 'open') + '" onclick="wlLine(&quot;' + r.line_id + '&quot;)"'
    + ' style="padding:9px 16px 9px ' + (ind + 13) + 'px;border-bottom:1px solid var(--line);cursor:pointer'
    + (done ? ';opacity:.5' : '') + '">'
    + '<div style="display:flex;align-items:baseline;gap:8px">'
    + '<span style="flex:1;font-weight:500;font-size:var(--fs-3);color:var(--ink-2,#41474e)' + (done ? ';text-decoration:line-through' : '') + '">'
    + (done ? '<span style="color:#3d7a4e;font-weight:800;text-decoration:none">✓ </span>' : '') + lead
    + (tail ? '<span style="color:var(--grey);font-weight:400;font-size:var(--fs-2)">' + tail + '</span>' : '') + '</span>'
    /* ⚠️ event.stopPropagation() ON BOTH — without it the row's own handler also fires and the chit opens behind
       the card, so the modal you wanted is sitting on a screen that navigated out from under it. */
    + '<span style="display:flex;gap:2px;flex:none;align-items:center">'
    /**
     * ⭐ ONE ICON — Athi, 2026-08-15: *"all in one means we don't need two icons, just one is enough."*
     *
     * ⚠️ TWO ICONS WERE LEFT OVER FROM A DESIGN THAT NO LONGER EXISTED. The tick and the rupee once opened two
     * different little cards; once both opened the same line card they were the same button drawn twice, asking
     * the reader to choose between identical outcomes. A choice that has no consequence still costs a moment to
     * make, on every row.
     */
    +   '<span data-testid="wl-done" title="Open this line — history, delivery, cost, who has it" onclick="event.stopPropagation();wlLine(&quot;' + r.line_id + '&quot;)"'
    +     ' style="cursor:pointer;font-size:var(--fs-2);padding:2px 9px;border-radius:6px;color:var(--blue-2);background:var(--blue-tint-bg);font-weight:800">⋯</span>'
    +   '<span style="color:var(--grey);font-size:var(--fs-2);padding-inline-start:3px">›</span></span></div>'
    /* ⚠️ WHICH ORDER IT CAME FROM. A line without its chit is an instruction with no context — you cannot ring the
       customer, check the rest of the order, or know who is waiting. */
    + (named || ordered ? '' : '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">' + order + '</div>')
    + (bits.length ? '<div style="margin-top:4px;font-size:var(--fs-2);color:var(--warn-2);background:var(--warn-tint);border-radius:5px;padding:3px 8px;display:inline-block">◍ ' + bits.join(' · ') + '</div>' : '')
    + '</div>';
}

/**
 * ⭐ THE WORK-BREAKDOWN ROLL-UP — Athi, 2026-08-14: *"from entity perspective can we have a summary of all the
 * tickets with work breakdown structure … from assignment perspective, date perspective and name perspective."*
 *
 * A heading that says only "3 lines" makes you add the rest up yourself. This is what a person actually wants to
 * know at a glance: how much, how late.
 *
 * ⚠️ QUANTITIES ARE NOT SUMMED ACROSS UNITS, AND THAT IS THE WHOLE CARE IN THIS FUNCTION. 25 kg + 20 கட்டு +
 * 10 லிட்டர் is not 55 of anything, and a screen that prints "55 left" is inventing a number nobody can act on.
 * So a quantity appears ONLY when every line in the group shares one unit; otherwise the group is described by
 * counts, which are always summable. Counting is the honest fallback, not the lazy one.
 */
function wlRollup(rows){
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var units = {}, overdue = 0, undated = 0;
  rows.forEach(function(r){
    var u = r.unit || '';
    var q = Number(r.quantity);
    if (isFinite(q)) units[u] = (units[u] || 0) + q;
    if (!r.due_date) { undated++; return; }
    var t = new Date(String(r.due_date).slice(0, 10) + 'T00:00:00');
    if (t < today) overdue++;
  });
  var keys = Object.keys(units);
  var qty = (keys.length === 1) ? (Math.round(units[keys[0]] * 1000) / 1000) + (keys[0] ? ' ' + keys[0] : '') : null;
  return { lines: rows.length, qty: qty, mixed: keys.length > 1, overdue: overdue, undated: undated };
}
function wlRollupText(rows){
  var r = wlRollup(rows);
  var bits = [r.lines + ' line' + (r.lines === 1 ? '' : 's')];
  if (r.qty) bits.push(r.qty);
  else if (r.mixed) bits.push('mixed units');    // said plainly rather than adding numbers that do not add
  if (r.undated) bits.push(r.undated + ' undated');
  var text = bits.join(' · ');
  if (r.overdue) text += ' · <span style="color:var(--disp);font-weight:700">' + r.overdue + ' overdue</span>';
  return text;
}
function wlHead(title, right, tone, id){
  return '<div data-testid="wl-head"' + (id ? ' onclick="wlToggle(&quot;' + esc(id) + '&quot;)"' : '')
    + ' style="' + (id ? 'cursor:pointer;' : '') + 'padding:14px 16px 6px;display:flex;justify-content:space-between;align-items:baseline;'
    + 'border-top:1px solid var(--line);background:var(--card);color:var(--on-card)">'
    + '<span style="font-size:var(--fs-4);font-weight:800;color:' + (tone || 'var(--ink,#1c2128)') + '">' + title + '</span>'
    + '<span style="font-size:var(--fs-2);color:var(--grey)">' + (right || '') + '</span></div>';
}

function worklistScreen(){
  var body;
  if (WL.busy && !WL.data) body = '<div style="padding:18px 16px;color:var(--grey);font-size:var(--fs-2)"><span class="spin"></span> reading your work…</div>';
  else if (WL.err) body = '<div style="padding:18px 16px;color:var(--disp);font-size:var(--fs-2)">' + esc(WL.err) + '</div>';
  else {
    var d = WL.data || {};
    var mine = !!d.scoped_to_self;
    var rows = wlRows(d);

    if (!d.migrated) {
      body = '<div style="padding:18px 16px;font-size:var(--fs-2);color:var(--grey)">Per-line assignment is not migrated on this environment (b143), so there is nothing to list.</div>';
    } else if (!rows.length) {
      /* ⚠️ TWO DIFFERENT EMPTIES. "Nothing is assigned to you" and "nothing is assigned to anyone" send opposite
         signals — one means you are free, the other means the work has not been handed out. */
      /* ⚠️ THREE DIFFERENT EMPTIES NOW. "Nothing assigned to you", "nothing assigned to anyone", and "everything
         you had is finished" mean completely different things, and the third is the one worth saying out loud. */
      var hid = wlDoneCount(d);
      body = '<div style="padding:18px 16px;font-size:var(--fs-2);color:var(--grey)">'
        + (hid ? 'Everything here is done — ' + hid + ' finished line' + (hid === 1 ? '' : 's') + ' hidden. Tick “show ' + hid + ' done” to see them.'
              : (mine ? 'Nothing is assigned to you right now.' : 'No lines are assigned to anyone yet — open a chit and assign its lines.'))
        + (WL.due ? ' (filtered to ' + esc(WL.due) + ')' : '') + '</div>';
    } else {
      /* ⭐ THE KEY ORDER IS THE VIEW — his model. */
      body = wlRender(rows, wlKeys(mine), 0, []);
    }
  }

  var d2 = WL.data || {};
  var mine2 = !!d2.scoped_to_self;
  var KEYS = [['who', 'person'], ['date', 'date'], ['chit', 'order'], ['item', 'product']];
  var active = wlKeys(mine2);
  var prim = active[0];
  /* `item` is appended by wlKeys, not chosen — it must not appear as the "then split by" tick. */
  var sec = (active[1] && active[1] !== 'item') ? active[1] : null;

  var chip = function(k, label, on, fn, testid){
    return '<span data-testid="' + testid + '" onclick="' + fn + '" style="cursor:pointer;font-size:var(--fs-2);border:1px solid '
      + (on ? 'var(--blue)' : 'var(--line)') + ';' + (on ? 'background:var(--blue);color:var(--on-accent);font-weight:700;' : '')
      + 'border-radius:9px;padding:4px 11px">' + label + '</span>';
  };
  /* ⚠️ A CHECKBOX, NOT A THIRD CHIP. "Group by date, and do not split by person" is a different act from "group by
     person" — presenting it as another radio would make the one thing Athi asked for unreachable. */
  var box = function(k, label){
    if (k === prim || k === 'item') return '';   // item has its own switch — it is a roll-up, not a split
    var on = sec === k;
    return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:var(--fs-2);color:var(--ink-2,#41474e);cursor:pointer">'
      + '<input type="checkbox" data-testid="wl-then-' + k + '" ' + (on ? 'checked' : '')
      + ' onchange="wlThen(&quot;' + k + '&quot;)" style="width:15px;height:15px;accent-color:var(--blue)">' + label + '</label>';
  };

  return '<div style="flex:1;min-height:0;overflow-y:auto;padding-bottom:var(--scroll-tail)">'
    + '<div style="padding:13px 16px;border-bottom:1px solid var(--line)">'
    +   '<div style="font-weight:700;font-size:var(--fs-4)">' + (mine2 ? 'My work' : 'Everyone\'s work') + '</div>'
    +   '<div style="font-size:var(--fs-2);color:var(--grey);margin-top:2px">Every line assigned to '
    +   (mine2 ? 'you' : 'your team') + ', across every chit.</div></div>'
    /* ── group by ──────────────────────────────────────────────────────────────────────────────────────────── */
    + '<div style="display:flex;gap:6px;align-items:center;padding:9px 16px;border-bottom:1px solid var(--line-soft,#eee);flex-wrap:wrap">'
    +   '<span style="font-size:var(--fs-1);font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--grey);margin-inline-end:2px">group by</span>'
    +   KEYS.map(function(x){ return chip(x[0], x[1], prim === x[0], 'wlPrimary(&quot;' + x[0] + '&quot;)', 'wl-view-' + x[0]); }).join('')
    +   '<input type="date" value="' + esc(WL.due || '') + '" onchange="wlDue(this.value)" '
    +     'style="margin-inline-start:auto;font-size:var(--fs-2);padding:3px 7px;border:1px solid var(--line);border-radius:9px">'
    +   (WL.due ? '<span onclick="wlDue(\'\')" style="cursor:pointer;font-size:var(--fs-2);color:var(--blue);padding:4px">clear</span>' : '')
    + '</div>'
    /* ── then split by · and the disclosure controls ────────────────────────────────────────────────────────── */
    + '<div style="display:flex;gap:14px;align-items:center;padding:8px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap">'
    +   '<span style="font-size:var(--fs-1);font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--grey)">then split by</span>'
    +   KEYS.map(function(x){ return box(x[0], x[1]); }).join('')
    +   (sec ? '' : '<span style="font-size:var(--fs-1);color:var(--grey);font-style:italic">not split — every line under its ' + esc(prim === 'who' ? 'person' : prim === 'date' ? 'date' : prim === 'item' ? 'product' : 'order') + '</span>')
    /* ⭐ THE PIVOT SWITCH. Off, you get the raw lines; on, the same product merges and its quantity totals — the
       answer to "what is my demand for that product", which is a sum you should never be doing by eye. */
    +   (prim === 'item' ? '' : '<label style="display:inline-flex;align-items:center;gap:5px;font-size:var(--fs-2);color:var(--ink-2,#41474e);cursor:pointer">'
    +     '<input type="checkbox" data-testid="wl-byitem" ' + (WL.byItem === false ? '' : 'checked')
    +     ' onchange="wlByItem()" style="width:15px;height:15px;accent-color:var(--blue)">total by product</label>')
    /* ⚠️ SAY HOW MANY ARE HIDDEN. A list that quietly drops rows is a list people stop trusting the moment they
       notice — and they always notice. The count is the honest half of the filter. */
    +   (wlDoneCount(d2) ? '<label style="display:inline-flex;align-items:center;gap:5px;font-size:var(--fs-2);color:var(--ink-2,#41474e);cursor:pointer">'
    +     '<input type="checkbox" data-testid="wl-showdone" ' + (WL.showDone ? 'checked' : '')
    +     ' onchange="wlDone()" style="width:15px;height:15px;accent-color:var(--blue)">show ' + wlDoneCount(d2) + ' done</label>' : '')
    +   '<span style="margin-inline-start:auto;display:flex;gap:10px">'
    +     '<span data-testid="wl-expand-all" onclick="wlAll(true)" style="cursor:pointer;font-size:var(--fs-2);color:var(--blue)">expand all</span>'
    +     '<span data-testid="wl-collapse-all" onclick="wlAll(false)" style="cursor:pointer;font-size:var(--fs-2);color:var(--blue)">collapse all</span>'
    +   '</span>'
    + '</div>'
    + body + '</div>';
}

/**
 * ⭐ THE THREE KEYS, ONCE. `of` buckets a row, `label`/`sort`/`tone` present the bucket. Two things walk this now —
 * the painter and the id-collector — so it lives in one place rather than being rebuilt per call.
 */
var WLG = {
  who:  { of: function(r){ return r.who || 'Unassigned'; }, label: function(k){ return esc(k); },
          last: function(k){ return k === 'Unassigned'; },
          tone: function(k){ return k === 'Unassigned' ? 'var(--grey)' : null; } },
  date: { of: function(r){ return r.due_date ? String(r.due_date).slice(0, 10) : ''; },
          label: function(k){ if (!k) return 'No date'; var l = wlDateLabel(k);
            return esc(l.text) + ' <span style="font-size:.86em;font-weight:600;color:' + (l.overdue ? 'var(--disp)' : 'var(--grey)') + '">· ' + l.rel + '</span>'; },
          last: function(k){ return !k; },
          tone: function(k){ return (k && wlDateLabel(k).overdue) ? 'var(--disp)' : null; } },
  /**
   * ⭐ THE PRODUCT — the dimension the quantity actually belongs to.
   *
   * ⚠️ BUCKETED ON THE NAME, NOT THE SKU, DELIBERATELY. A worklist line may have come off a WhatsApp message and
   * never matched the catalogue, so it has no sku — keying on one would scatter exactly the lines a picker still
   * needs to be pointed at. The name is what the two lines have in common today; when the catalogue match lands,
   * `of` is the one place that changes.
   */
  item: { of: function(r){ return String(r.particulars || '').trim() || '—'; },
          label: function(k){ return esc(k); }, tone: function(){ return null; } },
  chit: { of: function(r){ return r.chit_id; },
          label: function(k, rs){ return esc((rs[0] && rs[0].subject) || 'chit') + wlWho(rs[0] && rs[0].counterparty); },
          tone: function(){ return null; } },
};

/**
 * ⭐ THE OTHER PARTY — and only when there IS one.
 *
 * Athi, 2026-08-14: *"here the name of the shop is appearing as mytest, not sure why it is required."*
 *
 * ⚠️ IT WAS NEVER A COUNTERPARTY. The field is `sender_entity_display_name`, which on a chit you SENT — and on
 * every self-chit — is you. So the screen read "Order from Sri Balaji Mess · mytest" as though mytest were the
 * other side of the deal, when it is the reader. Suppressing it is not tidying: a name in that position makes a
 * claim about who you are dealing with, and the claim was false.
 */
function wlWho(name){
  if (!name) return '';
  if (typeof ccIsSelf === 'function' && ccIsSelf(name)) return '';
  return ' <span style="font-size:.86em;font-weight:600;color:var(--grey)">· ' + esc(name) + '</span>';
}

/**
 * ⭐ URGENCY ORDERS THE LIST, NOT THE ALPHABET — Athi: *"the order is alphabetically sorted, instead it has to be
 * datewise."*
 *
 * ⚠️ AND `sort` STRUCTURALLY COULD NOT EXPRESS THAT, which is why it was alphabetical rather than by choice. It
 * compared two group KEYS — two names, two product titles — and a name carries no date. The date lives in the
 * group's ROWS, so the comparator has to see the bucket, not the label. That is the whole fix: sort buckets.
 *
 * Groups holding nothing dated sink to the bottom rather than floating up on a null, and the alphabet survives
 * only as the tie-break, which is where it belongs.
 */
function wlOrder(buckets, key){
  var G = WLG[key];
  var soon = function(rows){
    var m = null;
    rows.forEach(function(r){ if (!r.due_date) return; var d = String(r.due_date).slice(0, 10); if (!m || d < m) m = d; });
    return m;
  };
  return Object.keys(buckets).map(function(k){ return { k: k, first: soon(buckets[k]) }; })
    .sort(function(a, b){
      /* "Unassigned" and "No date" are answers about absence — they belong last whatever date they hold. */
      var la = G.last ? !!G.last(a.k) : false, lb = G.last ? !!G.last(b.k) : false;
      if (la !== lb) return la ? 1 : -1;
      if (a.first !== b.first) { if (!a.first) return 1; if (!b.first) return -1; return a.first < b.first ? -1 : 1; }
      return String(a.k).localeCompare(String(b.k));
    })
    .map(function(x){ return x.k; });
}

/**
 * ⭐ FOUR LEVELS, EACH QUIETER THAN THE ONE ABOVE — Athi: *"like in a Word document, heading 1, 2, 3 … so the
 * flow is naturally known"* and *"there can be some colour of the font, otherwise not able to recognise."*
 *
 * ⚠️ THE HIERARCHY WAS INVERTED, WHICH IS WHY IT WOULD NOT READ. Depth 1 and depth 2 shared a single style, so
 * two different levels looked identical — and the ROW below them was 14.5px bold, LOUDER than either heading
 * above it. The eye follows size, so it landed on the leaf and had to climb back up to learn what the leaf was
 * about. Exactly the inversion, seen in his screenshot: "15 litre" shouting over "Groundnut Oil".
 *
 * Size, weight and colour now step down together, and each level indents — indentation being the cheapest
 * hierarchy cue there is, and the screen had none of it.
 */
var WLLVL = [
  { size: '16.5px', weight: 800, color: 'var(--ink,#1c2128)' },
  { size: '14.5px', weight: 750, color: '#2c5d7c' },
  { size: '13px',   weight: 700, color: '#5f7a52' },
  { size: '12.5px', weight: 650, color: 'var(--grey)' },
];
function wlLvl(d){ return WLLVL[Math.min(d, WLLVL.length - 1)]; }

/* The same recursive grouper as the Work tab. A key order is data; a view is not code. */
function wlRender(rows, keys, depth, path){
  /* ⚠️ THE PATH IS A PARAMETER, NOT A MODULE VARIABLE. It was a shared mutable that each level pushed to and
     popped from — correct only while rendering stays perfectly synchronous and single-threaded, and silently
     wrong the first time anything re-enters. Passing it down costs nothing and cannot desynchronise. */
  path = path || [];
  /* The path alternates key, value, key, value — so the KEYS a row already inherits from its headings are its even
     positions. wlRow drops exactly those, and reading them off the path keeps one source of truth. */
  if (!keys.length) return rows.map(function(r){
    return wlRow(r, path.filter(function(_, i){ return i % 2 === 0; }), depth || 0);
  }).join('');
  var key = keys[0], rest = keys.slice(1);
  var G = WLG[key];
  var buckets = {};
  rows.forEach(function(r){ var k = G.of(r); (buckets[k] = buckets[k] || []).push(r); });
  var html = wlOrder(buckets, key).map(function(k){
    var rs = buckets[k];
    var title = G.label(k, rs), tone = G.tone(k);
    var lv = wlLvl(depth), ind = 16 + depth * 15;
    /**
     * ⭐ EVERY GROUP IS A DISCLOSURE — Athi: *"can we make it expandable … so we can see all at once and can be
     * expanded for the required people or for the date."*
     *
     * ⚠️ THE ID IS THE PATH INCLUDING THIS BRANCH — see wlId. "Raman under Monday" and "Raman under Friday" must
     * not share an id, and a child's id must begin with its parent's or opening a parent cannot open it.
     */
    var id = wlId(path, key, k);
    var isOpen = !!WL.open[id];
    var caret = '<span style="display:inline-block;width:13px;color:var(--grey);font-size:var(--fs-1)">' + (isOpen ? '▾' : '<span class=arw>▸</span>') + '</span>';
    /* Every level carries its OWN roll-up: a breakdown that only totals at the top is a total, not a breakdown. */
    var head = depth === 0
      ? wlHead(caret + (tone === 'var(--disp)' ? '⚠️ ' : '') + title, wlRollupText(rs), tone, id)
      : '<div onclick="wlToggle(&quot;' + esc(id) + '&quot;)" style="cursor:pointer;padding:7px ' + (ind - 2) + 'px 2px ' + ind + 'px;'
        + 'display:flex;justify-content:space-between;align-items:baseline;gap:10px">'
        + '<span style="font-size:' + lv.size + ';font-weight:' + lv.weight + ';color:' + (tone || lv.color) + '">' + caret + title + '</span>'
        + '<span style="font-size:var(--fs-1);color:var(--grey);text-align:end;flex:none">' + wlRollupText(rs) + '</span></div>';
    return head + (isOpen ? wlRender(rs, rest, depth + 1, path.concat([key, k])) : '');
  }).join('');
  return html;
}

/**
 * ⭐ RECORDING THE WORK WHERE THE WORK IS LISTED.
 *
 * Athi, 2026-08-14: *"in this task list, if they serviced it, how are they going to set the status? Here itself,
 * if we do the management activity that would be good — like set the status, cost and so on."*
 *
 * ⚠️ THE LIST WAS READ-ONLY, WHICH MADE IT A REPORT RATHER THAN A WORKLIST. A co-assist could see their fifteen
 * lines and could do nothing about any of them without opening fifteen chits — which is the wall the screen was
 * built to replace, reintroduced one level down.
 *
 * ⭐ AND THIS IS THE FIRST SCREEN FOR THE OTHER DIRECTION. b152 made a line accumulate parts, labour and cost,
 * and until now the only way to record any of it was the API. "Add cost" is that, reachable.
 *
 * ⚠️ THE ROW TAP STILL OPENS THE CHIT, unchanged. These are deliberate extra affordances, not a re-purposed tap:
 * a list where tapping does something different depending on where you land is a list people stop trusting.
 */
/**
 * ⭐ THE LINE CARD — everything you can do to one subtask, in one pane.
 *
 * Athi, 2026-08-14: *"managing the line item from here, what are the possibilities … reassign it to someone else
 * … he can set the status to close … partial deliver, and the remaining qty to be visible with history … possibly
 * assign to a different date … some commercials."* And: *"how do we connect with the original requirement … see,
 * is it transparent?"*
 *
 * ⚠️ A PANE, NOT A DENSER ROW. Five affordances on every row would answer the list and ruin it. The row keeps the
 * two frequent ones (deliver · cost) and everything else lives one tap in — which is also where the ORIGINAL
 * WORDS belong, since they are what you read before deciding, not while scanning.
 *
 * ⚠️ LOADED ON OPEN, NEVER PRE-LOADED. The history and the actor list are one request each, made when the card
 * opens. Fetching them for every row of a fifty-row list to serve the one row someone taps is the habit this
 * codebase refuses.
 */
var WLL = { row: null, det: null, actors: null, loading: false, failed: false,
  /* Two threads, kept apart in state as well as on screen — see wlThreadSec. */
  msgs: null, msgErr: false, ext: null, extErr: false };

/**
 * ⭐ WHO THE OTHER PARTY IS — Athi, 2026-08-15: *"if we bring the contact details of the external party on the
 * top, I guess this is complete information around a line item."*
 *
 * ⚠️ CB DOES NOT HOLD THE COUNTERPARTY'S PHONE OR EMAIL, and it should not: those belong to your own customer
 * record, not to a chit. What the chit knows for certain is WHO the parties are and their bridge ids — which is
 * the identity you can act on, and the thing that is true regardless of how stale your address book is.
 *
 * ⚠️ SELF IS MARKED, NOT HIDDEN. On a self-chit both sides are you, and a card that quietly dropped one would
 * make a one-party document look like a two-party one — which is exactly the state where sending an "external"
 * message does nothing useful and you would have no way to tell.
 */
function wlParties(det){
  var h = (det && det.header) || {};
  var list = h.all_recipients || [];
  if (!list.length) return '';
  var seen = {}, out = [];
  list.forEach(function(p){
    var k = (p.entity_id || p.display_name) + '·' + p.role;
    if (seen[k]) return; seen[k] = 1;
    out.push(p);
  });
  var mine = function(p){ return typeof ccIsSelf === 'function' && ccIsSelf(p.display_name); };
  var everyoneIsMe = out.every(mine);
  return '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:baseline;padding:8px 0 2px;border-bottom:1px solid var(--line-soft,#f0efec);margin-bottom:8px">'
    + out.map(function(p){
        return '<div style="font-size:var(--fs-2)">'
          + '<span style="color:var(--grey);text-transform:uppercase;font-size:var(--fs-1);font-weight:800;letter-spacing:.06em">' + esc(p.role || '') + '</span> '
          + '<b>' + esc(p.display_name || '—') + '</b>'
          + (mine(p) ? ' <span style="color:var(--grey)">(you)</span>' : '')
          + (p.user_id||p.bridge_id ? ' <span style="color:var(--grey);font-family:ui-monospace,monospace;font-size:var(--fs-1)">' + esc(p.user_id||p.bridge_id) + '</span>' : '')
          + '</div>';
      }).join('')
    + (everyoneIsMe ? '<div style="font-size:var(--fs-1);color:var(--warn-2);font-weight:600">⚠️ this chit has no other party — an external message would come back to you</div>' : '')
    + '</div>';
}
/**
 * ⭐ THE ENTITY'S OWN CURRENCY, NEVER A BARE NUMBER — Athi, 2026-08-15: *"you are saying 80 charged, I am not
 * sure what that 80 means, it should be associated with the currency."*
 *
 * ⚠️ fmtMoney() AND SESSION.currency BOTH ALREADY EXISTED and this card used neither. A naked figure beside the
 * word "charged" is not a small omission: money is the one number on the screen a person may act on outside the
 * system, and it was the only one carrying no unit while every quantity beside it carried one.
 */
function wlMoney(v){
  if (v === null || v === undefined || v === '') return '';
  var code = (typeof SESSION !== 'undefined' && SESSION.currency) || 'INR';
  return (typeof fmtMoney === 'function') ? fmtMoney(v, code) : (code + ' ' + v);
}
async function wlLine(line_id){
  var r = wlRows(WL.data || {}).filter(function(x){ return x.line_id === line_id; })[0];
  if (!r) return;
  /* ⚠️ RESET THE OPEN SECTION ON EVERY OPEN. Left as module state it survived the card being closed, so the
     next line you opened had a section already expanded and tapping that heading COLLAPSED it — a toggle that
     does the opposite of what it looks like it will do, depending on what you did last. */
  WLL.row = r; WLL.det = null; WLL.tab = null; WLL.loading = true; WLL.failed = false;
  /* ⚠️ Cleared per line, or the next card opens showing the previous line's notes as its own. */
  WLL.msgs = null; WLL.msgErr = false;
  wlPaintCard(true);
  try {
    WLL.det = await api('wlChit', { params: { id: r.chit_id } });
    if (!WLL.actors) {
      var a = await api('wlActors').catch(function(){ return null; });
      WLL.actors = (a && (a.actors || a.items || (Array.isArray(a) ? a : []))) || [];
    }
  } catch (e) {
    /* ⚠️ A FAILED READ IS NOT AN EMPTY ONE. Swallowed silently, the card said "nothing recorded"
       about a line that may have a page of history — the reader is told a fact, not that the question could not
       be answered, and there is no way for them to tell the difference. */
    WLL.failed = true;
  }
  WLL.loading = false;
  var host = document.getElementById('modalhost');
  if (host && host.innerHTML) wlPaintCard(false);
}
/**
 * ⭐ FOUR SECTIONS, ONE OPEN AT A TIME — Athi, 2026-08-15: *"getting confused with the details given here … do it
 * as a sliding one, say View history, Add delivery, Add cost, set status as 3 or 4 headings and should be able to
 * check individually. Human brain cannot process too many items at one, and interpretation will take time."*
 *
 * ⚠️ I OVERCORRECTED. Merging the two windows was right — the split caused a real over-delivery — but I merged
 * them by STACKING everything, which answers "where is the history" by making the reader hold six things at once.
 * The union he asked for was of the INFORMATION, not of the screen space.
 *
 * So the numbers that decide anything stay pinned at the top, and everything else is a closed heading with a hint
 * on it. Nothing is more than one tap away and nothing is in the way.
 *
 * ⚠️ ACCORDION, NOT INDEPENDENT TOGGLES. Two open sections is the wall again, one section at a time.
 */
/**
 * ⚠️ IT PASSED loading=false UNCONDITIONALLY, and that is the whole of Athi's "you are stating no history and
 * then loading the data". Open a section while the fetch is still in flight and the card rendered as though the
 * answer were in — so an empty result set read "nothing recorded" a moment before the entries appeared. The
 * screen was not slow; it was ANSWERING A QUESTION IT HAD NOT ASKED YET, which is worse, because the reader
 * believes the wrong answer and acts on it.
 */
/**
 * ⭐ ONE INPUT-AND-BUTTON ROW, DEFINED ONCE — and the reason it kept going wrong.
 *
 * Athi, 2026-08-15: *"the record chip, add chip are much bigger but no space to type information … I mentioned
 * two times already."* He is right, and I fixed the symptom twice instead of the cause.
 *
 * ⚠️ THE CAUSE IS `.btn { width: 100% }` IN THE GLOBAL CSS. In a flex row that makes the button claim the entire
 * container as its basis, so it swallows the row and squeezes the field to nothing — and `flex:0 0 auto` does not
 * save you, because the width is still 100%. A `margin-top:16px` on the same class then knocks it out of line
 * with the input beside it. Three hand-written rows meant three chances to get it wrong, and I took two of them.
 *
 * So the row is a function now. The field gets the space, the button gets its label, and neither can drift from
 * the other two.
 */
function wlBtn(label, testid, call, primary){
  return '<button class="btn' + (primary ? ' pri' : '') + '" data-testid="' + testid + '" onclick="' + call + '"'
    /* width:auto and margin:0 are not styling — they are the two overrides that make .btn usable inside a row. */
    + ' style="width:auto;flex:0 0 auto;margin:0;padding:0 18px;white-space:nowrap">' + label + '</button>';
}
/**
 * ⚠️ IT WRAPS. Found by looking at the real card at 360px rather than reasoning about it: the who/date/Save row
 * came to ~367px in 336px of space, so Save was CLIPPED at the card edge — visible as "Sav" — and the modal grew
 * a horizontal scrollbar. Without wrapping, a row of three controls is one long translation or one wide date
 * picker away from putting its own button out of reach, on every screen narrower than the one it was built on.
 */
function wlFieldRow(fields, button){
  return '<div style="display:flex;gap:8px;align-items:stretch;flex-wrap:wrap">' + fields + button + '</div>';
}
/** A text/number input that will actually take a value: it grows, and min-width:0 lets it shrink below its
 *  intrinsic size instead of forcing the row wider than the card. */
function wlInput(id, opts){
  opts = opts || {};
  /**
   * ⭐ A NOTE IS A BOX — Athi, 2026-08-15: *"look at the message, it has to be a box, not a text in a single
   * line."*
   *
   * ⚠️ A ONE-LINE INPUT DOES NOT JUST LOOK WRONG FOR THIS, IT CHANGES WHAT PEOPLE WRITE. You cannot see what you
   * typed past about forty characters, so the note that would have said "customer rejected the first two sacks,
   * damp at the bottom — check before loading Friday" becomes "damp". The field was quietly editing the record.
   */
  if (opts.lines) {
    return '<textarea id="' + id + '"' + (opts.testid ? ' data-testid="' + opts.testid + '"' : '')
      + ' rows="' + opts.lines + '"' + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '')
      + ' style="width:100%;box-sizing:border-box;font:inherit;font-size:var(--fs-3);line-height:1.5;padding:10px 12px;'
      + 'border:1px solid var(--line);border-radius:9px;resize:vertical;min-height:' + (opts.lines * 22 + 20) + 'px"></textarea>';
  }
  return '<input id="' + id + '"' + (opts.testid ? ' data-testid="' + opts.testid + '"' : '')
    + (opts.type ? ' type="' + opts.type + '" step="any" inputmode="decimal"' : '')
    + (opts.value != null ? ' value="' + esc(String(opts.value)) + '"' : '')
    + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '')
    + ' style="flex:' + (opts.grow || 1) + ' 1 auto;min-width:0;font-size:' + (opts.big ? '19px;font-weight:800' : '14px')
    + ';padding:10px 12px;border:1px solid var(--line);border-radius:9px;font-variant-numeric:tabular-nums">';
}

/**
 * ⭐ ONE PAINT, SO THE WINDOW BEHAVES THE SAME EVERY TIME — Athi, 2026-08-15: *"can we increase the size of the
 * total window, also can we add an adjustable size, drag at the bottom, the window should be able to move
 * anywhere, minimize icon — all required."*
 *
 * ⚠️ ALL OF THAT ALREADY EXISTED as makeMovable(), used by the assistant panel. It was switched OFF for modals
 * with the note *"the movable A−/A+/grip bar overlapped titles & close"* — a placement problem recorded as a
 * capability decision. opts.barAt:'right' clears the title and the ✕, so the card gets drag, resize, zoom and
 * persisted geometry without any of it being rebuilt here.
 *
 * ⚠️ AND IT MUST BE RE-APPLIED ON EVERY PAINT. modal() replaces innerHTML, so each section toggle creates a NEW
 * panel element — one that has never been made movable. Four separate call sites each remembering to do that is
 * three chances to forget, which is why this is a function.
 */
/**
 * ⭐⭐ WHAT YOU TYPED SURVIVES A REPAINT — Athi, 2026-08-15: *"I change the date to 24th and save. It is not
 * getting saved and moved to the new date."*
 *
 * ⚠️ HE WAS NOT MISREADING THE SCREEN — THE SCREEN WAS LYING. Reproduced live: the field showed 2026-08-24 and
 * the save sent 2026-08-21. A background fetch (the message threads load when their section is opened) finishes,
 * calls wlPaintCard, and modal() replaces innerHTML — so every field is rebuilt from the STALE row object while
 * the person is still looking at what they typed. The value they can see is not the value that exists.
 *
 * ⚠️ AND IT IS NOT A DATE BUG. The same repaint eats a delivery quantity, a cost, a half-written note — anything
 * entered in the seconds after opening the card, which is all of them. It silently discards work and then saves
 * the old value, which is the worst of the three possible outcomes: it looks like it worked.
 *
 * So a repaint carries the live field values across. `skip` lets a deliberate action (sending a note) clear its
 * own box, because there restoring the text would be just as wrong.
 */
function wlKeepFields(skip){
  var out = {};
  try {
    var host = document.getElementById('modalhost');
    if (!host) return out;
    [].forEach.call(host.querySelectorAll('input[id],select[id],textarea[id]'), function(e){
      if (skip && e.id === skip) return;
      if (e.type === 'checkbox' || e.type === 'radio') return;
      out[e.id] = e.value;
    });
  } catch (e) {}
  return out;
}
function wlRestoreFields(vals){
  try {
    Object.keys(vals || {}).forEach(function(id){
      var e = document.getElementById(id);
      /* ⚠️ Only when the field still exists AND the repaint did not already carry a value — a section that was
         closed and reopened should show what the server says, not a ghost of a previous edit. */
      if (e && vals[id] !== undefined && vals[id] !== '') e.value = vals[id];
    });
  } catch (e) {}
}

function wlPaintCard(loading){
  /**
   * ⚠️ THE CARD IS SIZED AGAINST THE PHONE, NOT THE BROWSER — Athi, 2026-08-15: *"mobile window is much larger
   * than the mobile size, it should not exceed the window which is underneath."*
   *
   * `.modal.wide` is `width:820px; max-width:94vw`, and in the build preview `vw` is the REAL browser width while
   * the phone frame (`.shell`) is 440px. So on a wide monitor an 820px card floated over a 440px device — a
   * layout nobody using the app on a phone could ever hit, sitting on the screen we are supposed to be judging.
   * Measuring the shell and capping to it means the preview shows what the phone shows.
   */
  var keep = wlKeepFields(WLL._clearBox); WLL._clearBox = null;
  var shell = document.querySelector('.shell');
  var cap = shell ? Math.round(shell.getBoundingClientRect().width) : 0;
  var mob = (typeof UI !== 'undefined' && UI.vp === 'mob');
  modal(wlLineHTML(loading), !mob);   // `wide` on a laptop — 360px is what folded "0 kg left" in two
  try {
    var p = document.querySelector('#modalhost .modal');
    if (p && cap) p.style.maxWidth = cap + 'px';
    if (p && typeof makeMovable === 'function') {
      makeMovable(p, { key: 'cb_wl_line', minW: 320, minH: 240, barAt: 'right', minimise: true });
      /* ⚠️ A SAVED WIDTH CAN OUTLIVE THE VIEWPORT IT WAS SET IN. Drag it wide on a laptop, switch to the phone
         preview, and makeMovable restores 820px inside a 440px frame. The cap has to apply AFTER the restore. */
      if (p && cap && parseFloat(p.style.width) > cap) p.style.width = cap + 'px';
    }
  } catch (e) { /* best-effort — a card that will not drag is still a usable card */ }
  /* ⚠️ AFTER everything else. makeMovable can restore geometry and re-lay the panel out; putting values back
     before that runs risks them being wiped by the very repaint they were saved from. */
  wlRestoreFields(keep);
}

function wlSec(k){
  WLL.tab = (WLL.tab === k) ? null : k;
  wlPaintCard(WLL.loading);
  /* ⚠️ FETCHED WHEN THE SECTION IS OPENED, not when the card is. Notes are the least-read thing on this card;
     loading them for every line someone glances at would be one request per glance for data almost nobody asks
     for. Same rule as the actor list and the history. */
  if (WLL.tab === 'msg' && WLL.msgs === null && !WLL.msgErr) wlMsgLoad('msg');
  if (WLL.tab === 'ext' && WLL.ext  === null && !WLL.extErr) wlMsgLoad('ext');
}
/**
 * A section heading: caret · name · a hint of what is inside, so you can choose without opening.
 *
 * ⚠️ AT MODULE SCOPE, NOT A CLOSURE. It began as a local inside wlLineHTML, which was fine until the thread
 * renderer — a separate function — needed to emit the same heading. A heading drawn two ways is two sections
 * that stop looking like siblings the first time one of them is touched.
 */
function wlSecHead(k, name, hint, tone){
  var on = WLL.tab === k;
  return '<div data-testid="wl-sec-' + k + '" onclick="wlSec(&quot;' + k + '&quot;)" style="cursor:pointer;display:flex;gap:9px;align-items:baseline;'
    + 'padding:11px 2px;border-top:1px solid var(--line)">'
    + '<span style="width:12px;color:var(--grey);font-size:var(--fs-1)">' + (on ? '▾' : '<span class=arw>▸</span>') + '</span>'
    + '<span style="font-weight:700;font-size:var(--fs-3);color:' + (on ? 'var(--ink,#1c2128)' : 'var(--ink-2,#41474e)') + '">' + name + '</span>'
    + '<span style="margin-inline-start:auto;font-size:var(--fs-2);color:' + (tone || 'var(--grey)') + '">' + (hint || '') + '</span></div>';
}

/** ⚠️ THE ONE PLACE THE TWO THREADS DIFFER. Everything else about them is shared, deliberately. */
var WLTHREAD = { msg: { type: 'internal', box: 'wl_msg' }, ext: { type: 'external', box: 'wl_ext' } };

/**
 * ⭐ ONE RENDERER, TWO THREADS — because the ONLY thing that differs is who can read it, and that is exactly the
 * difference a reader must never have to work out. A second copy of this function for the external panel would
 * mean two places to change a label, and the day they disagreed about which one is private is the day someone
 * types a price complaint into the wrong box.
 */
function wlThreadSec(k, title, list, err, o){
  var n = list ? list.length : 0;
  var loading = (list === null && !err);
  var out = wlSecHead(k, title,
    loading ? (WLL.tab === k ? 'checking…' : o.hint)
      : err ? 'could not read' : (n ? n + (n === 1 ? ' message' : ' messages') : 'none yet'),
    err ? 'var(--disp)' : o.tone);
  if (WLL.tab !== k) return out;
  out += '<div style="padding:2px 0 12px">';
  if (loading) out += '<div style="font-size:var(--fs-2);color:var(--grey)"><span class="spin"></span> checking…</div>';
  else if (err) out += '<div style="font-size:var(--fs-2);color:var(--disp)">Could not read these just now — this does NOT mean there are none.</div>';
  else if (!n) out += '<div style="font-size:var(--fs-2);color:var(--grey)">Checked — ' + esc(o.empty) + '.</div>';
  else out += list.map(function(m){
    return '<div style="padding:6px 0;border-bottom:1px solid var(--line-soft,#f0efec);font-size:var(--fs-2)">'
      + '<div style="display:flex;gap:8px;align-items:baseline">'
      +   '<b style="font-size:var(--fs-2)">' + esc(m.sender_display_name || '—') + '</b>'
      +   '<span style="margin-inline-start:auto;color:var(--grey);font-size:var(--fs-1)">' + esc(String(m.created_at || '').slice(0, 10)) + '</span></div>'
      /* pre-wrap, because the box is three lines tall now and people use them. */
      + '<div style="margin-top:2px;line-height:1.5;white-space:pre-wrap">' + esc(m.message_text || '') + '</div></div>';
  }).join('');
  out += '<div style="margin-top:10px">'
    + wlInput(WLTHREAD[k].box, { testid: 'wl-' + k + '-box', lines: 3, placeholder: o.placeholder })
    + '<div style="display:flex;justify-content:flex-end;margin-top:8px">'
    +   wlBtn(o.verb, 'wl-' + k + '-add', 'wlMsgSave(&quot;' + k + '&quot;)', true) + '</div></div>'
    /* ⚠️ SAID PLAINLY, EVERY TIME, IN BOTH PANELS. A person deciding whether to write "customer is difficult, do
       not promise Friday" must not have to remember which box they are in. */
    + '<div style="margin-top:7px;font-size:var(--fs-1);color:' + (o.tone || 'var(--grey)') + ';line-height:1.5">' + o.foot + '</div>'
    + '</div>';
  return out;
}

async function wlMsgLoad(k){
  var r = WLL.row, t = WLTHREAD[k]; if (!r || !t) return;
  var key = (k === 'msg') ? 'msgs' : 'ext', errKey = (k === 'msg') ? 'msgErr' : 'extErr';
  try {
    var out = await api('wlMsgs', { params: { id: r.chit_id }, query: { thread_type: t.type, line_id: r.line_id } });
    var list = (out && (out.messages || out.items || (Array.isArray(out) ? out : []))) || [];
    /* ⚠️ FILTERED AGAIN CLIENT-SIDE. Before b155 the server ignores line_id and returns the whole thread, so
       without this the card would show the CHIT's messages as though they belonged to this line. */
    WLL[key] = list.filter(function(m){ return !m.line_id || m.line_id === r.line_id; });
  } catch (e) { WLL[errKey] = true; }
  if (document.getElementById('modalhost')) wlPaintCard(WLL.loading);
}
async function wlMsgSave(k){
  var r = WLL.row, t = WLTHREAD[k]; if (!r || !t) return;
  var el = document.getElementById(t.box);
  var txt = el ? String(el.value).trim() : '';
  if (!txt) { toast('Nothing to send'); return; }
  try {
    await api('wlMsgAdd', { params: { id: r.chit_id },
      body: { message_text: txt, thread_type: t.type, line_id: r.line_id } });
    /* ⚠️ The box it was sent from is the one field that must NOT be restored, or the note reappears as though
       it had failed to send and gets sent twice. */
    WLL._clearBox = t.box;
    if (k === 'msg') { WLL.msgs = null; WLL.msgErr = false; } else { WLL.ext = null; WLL.extErr = false; }
    await wlMsgLoad(k);
    toast(k === 'msg' ? 'Note added — team only' : 'Sent — the other party can see it');
  } catch (e) { toast((e && e.message) || 'Could not send that'); }
}

function wlLineHTML(loading){
  var r = WLL.row || {}, d = WLL.det || {};
  var prog = ((d.line_delivery || {})[r.line_id]) || {};
  var events = prog.events || [], added = prog.added || [];
  var done = r.state === 'done';

  /**
   * ⚠️ OVER-DELIVERY MUST SAY "OVER", NOT "0 LEFT". `left` is clamped at zero — right for "how much more to send",
   * misleading as a headline: the card once read "0 kg left · 180 out of 120 kg", so the biggest number on it was
   * hiding a 60 kg excess. Excess is the thing you most need told, because unlike a shortfall nobody chases it.
   */
  var ordered = r.quantity == null ? null : Number(r.quantity);
  var got = Number(r.delivered || 0);
  var over = (ordered != null && got > ordered) ? Math.round((got - ordered) * 1000) / 1000 : 0;
  var left = r.left == null ? null : r.left;
  var big = over ? String(over) : (left == null ? '—' : String(left));

  /* ── the summary, always visible: the three figures anything else is decided against ─────────────────────── */
  /* ⚠️ nowrap ON THE HEADLINE FIGURE. At 360px "0 kg left" folded onto two lines — the number on one, "left" on
     the next — which reads as two separate facts for a moment. A figure and its unit are one token. */
  var bar = '<div style="display:flex;gap:18px;align-items:baseline;font-variant-numeric:tabular-nums;padding-bottom:4px;flex-wrap:wrap">'
    + '<div style="white-space:nowrap"><span style="font-size:var(--fs-6);font-weight:800;color:' + (over ? 'var(--disp)' : left === 0 ? 'var(--ok-2)' : 'var(--warn-2)') + '">' + esc(big) + '</span>'
    +   '<span style="font-size:var(--fs-2);font-weight:700;color:' + (over ? 'var(--disp)' : 'var(--grey)') + ';margin-inline-start:4px">' + esc(r.unit || '') + (over ? ' over' : ' left') + '</span></div>'
    + '<div style="font-size:var(--fs-2);color:var(--grey);white-space:nowrap">' + esc(String(got)) + ' delivered of ' + esc(String(ordered == null ? '—' : ordered)) + ' ' + esc(r.unit || '') + '</div>'
    + (prog.charged ? '<div style="margin-inline-start:auto;font-size:var(--fs-2);color:#2c5d7c;font-weight:700">' + esc(wlMoney(prog.charged)) + ' <span style="font-weight:400;color:var(--grey)">charged</span></div>' : '')
    + '</div>';

  /* ── a heading: caret · name · a hint of what is inside, so you can choose without opening ───────────────── */
  var sec = wlSecHead;
  var body = '';

  // ── ① HISTORY ────────────────────────────────────────────────────────────────────────────────────────────
  var nEv = events.length + added.length;
  body += sec('hist', 'History',
    loading ? 'checking…' : WLL.failed ? 'could not read' : (nEv ? nEv + (nEv === 1 ? ' entry' : ' entries') : 'none yet'),
    WLL.failed ? 'var(--disp)' : null);
  if (WLL.tab === 'hist') {
    body += '<div style="padding:0 0 10px">';
    if (loading) body += '<div style="font-size:var(--fs-2);color:var(--grey)"><span class="spin"></span> checking for earlier entries…</div>';
    else if (WLL.failed) body += '<div style="font-size:var(--fs-2);color:var(--disp)">Could not read the history just now — this does NOT mean there is none. Close and reopen to try again.</div>';
    else if (!nEv) body += '<div style="font-size:var(--fs-2);color:var(--grey)">Checked — nothing has been recorded against this line yet.</div>';
    else {
      body += events.map(function(e){
        return '<div style="display:flex;gap:10px;align-items:baseline;padding:5px 0;border-bottom:1px solid var(--line-soft,#f0efec);font-size:var(--fs-2)">'
          + '<span style="font-weight:700;font-variant-numeric:tabular-nums;min-width:72px;color:' + (e.quantity < 0 ? 'var(--disp)' : 'var(--ink)') + '">'
          +   (e.quantity < 0 ? '' : '+') + esc(String(e.quantity)) + ' ' + esc(e.unit || '') + '</span>'
          + '<span style="color:var(--grey);font-size:var(--fs-2);flex:1">' + esc(e.reference || e.note || '') + '</span>'
          + '<span style="color:var(--grey);font-size:var(--fs-1)">' + esc(String(e.at || '').slice(0, 10)) + ' · ' + esc(e.by_actor || e.by || '') + '</span></div>';
      }).join('')
      + added.map(function(a){
        return '<div style="display:flex;gap:10px;align-items:baseline;padding:5px 0;border-bottom:1px solid var(--line-soft,#f0efec);font-size:var(--fs-2)">'
          + '<span style="color:#2c5d7c;font-weight:700;min-width:82px">' + esc(wlMoney(a.amount)) + '</span>'
          + '<span style="flex:1">' + esc(a.particulars || '') + (a.quantity ? ' <span style="color:var(--grey)">· ' + esc(String(a.quantity)) + ' ' + esc(a.unit || '') + '</span>' : '') + '</span>'
          + '<span style="color:var(--grey);font-size:var(--fs-1)">' + esc(String(a.at || '').slice(0, 10)) + '</span></div>';
      }).join('');
    }
    body += '</div>';
  }

  // ── ② RECORD A DELIVERY ──────────────────────────────────────────────────────────────────────────────────
  body += sec('del', 'Add a delivery', over ? esc(String(over)) + ' ' + esc(r.unit || '') + ' over' : (left == null ? '' : esc(String(left)) + ' ' + esc(r.unit || '') + ' left'), over ? 'var(--disp)' : null);
  if (WLL.tab === 'del') {
    /**
     * ⚠️ ONE BIG FIELD, AND THE UNIT INSIDE IT. The previous version squeezed the number box to a third of the
     * row with its unit on a line beneath — where a stray "+" turned that caption into "kgNaN", and the box was
     * too narrow to read what you had typed. The figure being entered is the most important thing on this
     * section; it gets the width.
     *
     * ⚠️ AND IT DEFAULTS TO WHAT IS LEFT, NEVER WHAT WAS ORDERED. On an untouched line those are the same number,
     * which is exactly why the wrong one survived — it is only wrong AFTER a part delivery, the case this screen
     * exists for, and it is what put 180 against a 120 kg line.
     */
    body += '<div style="padding:2px 0 12px">'
      /* The unit is a label BESIDE the field, not padding inside it. Reserving 46px of the box for a suffix is
         what left no room to see the number on a narrow card. */
      + wlFieldRow(
          wlInput('wl_qty', { testid: 'wl-qty', type: 'number', big: true, grow: 2,
                              value: over ? -over : (left == null ? '' : left) })
          + '<span style="flex:0 0 auto;align-self:center;font-size:var(--fs-2);color:var(--grey);font-weight:700">' + esc(r.unit || '') + '</span>',
          wlBtn('Record', 'wl-record', 'wlActSave(&quot;done&quot;)', true))
      + '<div style="margin-top:8px">' + wlInput('wl_ref', { placeholder: 'docket number, or a note' }) + '</div>'
      + '<div style="margin-top:7px;font-size:var(--fs-1);color:var(--grey);line-height:1.5">'
      +   (over ? '<b style="color:var(--disp)">Already ' + esc(String(over)) + ' ' + esc(r.unit || '') + ' over — the negative figure above returns it.</b>'
             : 'Pre-filled with what is left. A negative figure corrects an earlier delivery; nothing is deleted.')
      + '</div></div>';
  }

  // ── ③ ADD A COST ─────────────────────────────────────────────────────────────────────────────────────────
  body += sec('cost', 'Add a cost', added.length ? added.length + ' added' : 'part, labour, charge');
  if (WLL.tab === 'cost') {
    body += '<div style="padding:2px 0 12px">'
      + wlInput('wl_what', { testid: 'wl-what', placeholder: 'What was it for — brake shoe, labour, call-out' })
      /* ⚠️ FOUR FIELDS AND A BUTTON DO NOT FIT ONE ROW ON A PHONE. The quantity pair goes on its own line so each
         box stays wide enough to read, rather than four slivers and a button that ate them. */
      + '<div style="display:flex;gap:8px;margin-top:8px">'
      +   wlInput('wl_cqty', { type: 'number', placeholder: 'how many' })
      +   wlInput('wl_cunit', { placeholder: 'unit' })
      + '</div>'
      + '<div style="margin-top:8px">'
      +   wlFieldRow(wlInput('wl_amt', { testid: 'wl-amt', type: 'number', grow: 2,
              placeholder: 'cost in ' + ((typeof SESSION !== 'undefined' && SESSION.currency) || 'INR') }),
            wlBtn('Add', 'wl-addcost', 'wlActSave(&quot;cost&quot;)'))
      + '</div>'
      /* ⚠️ Its own quantity field, never the delivery one: 2 hours of labour typed into the goods box is exactly
         the confusion merging the windows was meant to end. */
      + '<div style="margin-top:7px;font-size:var(--fs-1);color:var(--grey);line-height:1.5">This adds to the line, it does not deliver it. Units are never added together — only the money totals.</div>'
      + '</div>';
  }

  // ── ④ WHO, WHEN, AND WHETHER IT IS DONE ──────────────────────────────────────────────────────────────────
  /* ⚠️ ONE DATE FORMAT PER SCREEN. This hint printed a raw 2026-08-11 while every heading and row beside it reads
     'Tue, 11 Aug' — two formats for one fact makes a reader stop and check whether they mean the same thing. */
  var whoHint = esc((r.who && r.who !== 'Unassigned') ? r.who : 'unassigned')
    + (r.due_date ? ' · ' + esc(wlDateLabel(r.due_date).text) : '');
  body += sec('who', 'Who and when', done ? '✓ done' : whoHint, done ? 'var(--ok-2)' : null);
  if (WLL.tab === 'who') {
    /**
     * ⚠️ THE CURRENT HOLDER IS ALWAYS AN OPTION, even if the actor list did not load. Without this the select
     * fell back to just 'Unassigned' — and pressing Save then UNASSIGNED the line, quietly, as a side effect of a
     * failed background request the reader never saw. A dropdown that cannot show the current value must not be
     * able to change it by accident.
     */
    var known = (WLL.actors || []).some(function(a){ return (a.actor_id || a.identity_id) === r.actor_id; });
    var extra = (!known && r.actor_id) ? [{ actor_id: r.actor_id, display_name: r.who }] : [];
    var opts = '<option value="">' + tx('Unassigned') + '</option>' + extra.concat(WLL.actors || []).map(function(a){
      var id = a.actor_id || a.identity_id, nm = a.display_name || a.name || '';
      return '<option value="' + esc(id) + '"' + (id === r.actor_id ? ' selected' : '') + '>' + esc(nm) + '</option>';
    }).join('');
    body += '<div style="padding:2px 0 12px">'
      + '<div style="display:flex;gap:8px">'
      /* ⚠️ min-width:0 ON BOTH. A <select> and a date <input> both refuse to shrink below their content by
         default, which is what pushed Save past the card edge — the row could not give way, so the button went
         over the side. With wrapping above and this here, the pair shrinks first and Save drops to its own line
         only when it genuinely cannot fit. */
      +   '<select id="wl_who" data-testid="wl-who-sel" style="flex:1 1 40%;min-width:0;font-size:var(--fs-3);padding:9px 11px;border:1px solid var(--line);border-radius:9px">' + opts + '</select>'
      /* ⚠️ A DATE FIELD HAS A FLOOR, unlike the name beside it. Shrunk to 125px it rendered "11-08-202" — the
         YEAR cut off, which is the one part of a due date you cannot guess from context. min-width holds it at a
         readable size and the row wraps instead; a truncated date is worse than a second line. */
      +   '<input id="wl_due" data-testid="wl-due-inp" type="date" value="' + esc(String(r.due_date || '').slice(0, 10)) + '" style="flex:1 1 145px;min-width:145px;font-size:var(--fs-3);padding:9px 8px;border:1px solid var(--line);border-radius:9px">'
      +   wlBtn('Save', 'wl-line-save', 'wlLineSave()', true)
      + '</div>'
      /* ⚠️ THIS ONE IS DELIBERATELY FULL WIDTH — it is the section's own verb, not a field's companion, so .btn's
         width:100% is right here. Kept explicit so it reads as a choice rather than the bug the others had. */
      + '<div style="margin-top:8px"><button class="btn" data-testid="wl-mark-done" onclick="wlSetState(' + (done ? '&quot;open&quot;' : '&quot;done&quot;') + ')" style="width:100%;margin:0;padding:11px">'
      +   (done ? '↩ Reopen this subtask' : '✓ Mark this subtask done') + '</button></div>'
      + '<div style="margin-top:7px;font-size:var(--fs-1);color:var(--grey);line-height:1.5">Handing it on keeps the old assignment as history. Marking it done takes it off the work list — it does not mean the goods went out.</div>'
      + '</div>';
  }

  // ── ⑤ ⑥ THE TWO THREADS ──────────────────────────────────────────────────────────────────────────────────
  /**
   * ⭐ Athi, 2026-08-15: *"can we add the external message tab as well … I guess this is complete information
   * around a line item."*
   *
   * ⚠️ ONE IMPLEMENTATION, TWO THREADS — because the ONLY thing that differs is who can read it, and that is
   * exactly the difference a reader must never have to work out. Writing the external panel as a second copy of
   * the internal one would mean two places to change a label, and the day they disagreed about which is private
   * would be the day someone typed a price complaint into the wrong box.
   *
   * ⚠️ THE SAME STORE THE MESSAGE CENTRE USES, never a second one. b155 gave chit_messages the one thing it
   * lacked — which line a message is about. A thread in chit_line_assignment.note would have cost no migration
   * and been a parallel messaging system with no attachments and no per-copy replication.
   */
  body += wlThreadSec('msg', 'Internal notes', WLL.msgs, WLL.msgErr, {
    hint: 'team only', empty: 'no notes on this line yet', verb: 'Add note',
    placeholder: 'A note for your team about this line — what happened, what to watch for',
    foot: '🔒 Team only — the other party never sees these.', tone: null,
  });
  body += wlThreadSec('ext', 'Message the other party', WLL.ext, WLL.extErr, {
    hint: 'they see this', empty: 'nothing sent on this line yet', verb: 'Send',
    placeholder: 'A message about this line that the other party will see',
    /* ⚠️ STATED AS A CONSEQUENCE, NOT A CATEGORY. "External" is a word about our data model; "they will see
       this" is the thing the person is actually deciding. */
    foot: '📤 The other party sees this, on their own copy. It cannot be unsent — a correction is another message.',
    tone: 'var(--warn-2)',
  });

  /* ── what was asked for: always shown when it exists, never behind a heading ─────────────────────────────
     ⚠️ THIS ONE IS NOT COLLAPSED, deliberately. It is the evidence for everything above it — what the customer
     actually wrote before anything matched it to a catalogue item — and a person who has to go looking for it
     will not. It is short, so it costs almost nothing to leave in view. */
  var asked = '';
  if (r.raw_phrase || r.asked_as || r.comment || r.needs_human) {
    asked = '<div style="margin-top:12px;background:var(--warn-tint);border-inline-start:3px solid #b0641c;border-radius:0 7px 7px 0;padding:9px 12px;font-size:var(--fs-2);line-height:1.55;color:var(--on-card)">'
      + (r.raw_phrase ? '<div style="font-style:italic;color:var(--warn-3)">“' + esc(r.raw_phrase) + '”</div>' : '')
      + (r.asked_as ? '<div style="font-size:var(--fs-2);color:var(--grey)">asked as <b>' + esc(r.asked_as) + '</b></div>' : '')
      + (r.comment ? '<div style="color:#2c5d7c">' + esc(r.comment) + '</div>' : '')
      + (r.needs_human ? '<div style="font-size:var(--fs-2);color:var(--disp);font-weight:700">' + tx('⚠️ flagged for a person to check') + '</div>' : '')
      + '</div>';
  }

  return '<div class="mhd"><div class="t">' + esc(r.particulars || 'Line') + (done ? ' <span style="font-size:var(--fs-2);color:#3d7a4e">' + tx('✓ done') + '</span>' : '') + '</div>'
    + '<div class="s">' + esc(r.subject || 'chit') + '</div></div>'
    + '<div class="mbody">' + bar + wlParties(WLL.det) + asked + body + '</div>'
    + '<div class="mfoot"><button onclick="closeModal()">' + tx('Close') + '</button>'
    + '<button data-testid="wl-open-order" onclick="wlOpen(&quot;' + r.chit_id + '&quot;)">' + tx('Open the order') + '</button></div>';
}
/**
 * ⭐ ONE WINDOW — Athi, 2026-08-15: *"we don't need two tabs, the tick mark can bring the history also, so you
 * know the history and you should be able to part deliver and/or consider closing the task. Can you see what is
 * the union of both the window and bring the best of both?"*
 *
 * ⚠️ THE TWO WINDOWS CAUSED A REAL OVER-DELIVERY, and it is worth being precise about how. The old ✓ card asked
 * for a quantity and pre-filled the ORDERED figure, knowing nothing about what had already gone out; the history
 * lived in a different window nobody had open while typing. So 120 was entered against a line already complete,
 * and the record now reads 180 out of 120. Not a slip — the screen supplied the wrong number and hid the evidence
 * that would have corrected it.
 */
async function wlActSave(kind){
  var r = WLL.row; if (!r) return;
  var g = function(id){ var e = document.getElementById(id); return e ? String(e.value).trim() : ''; };
  var row = { line_id: r.line_id };
  if (kind === 'cost') {
    row.kind = 'add';
    row.particulars = g('wl_what');
    row.quantity = g('wl_cqty') === '' ? 0 : Number(g('wl_cqty'));
    row.unit = g('wl_cunit') || null;
    row.amount = g('wl_amt') === '' ? null : Number(g('wl_amt'));
    if (!row.particulars) { toast('Say what the cost was for'); return; }
    if (!row.quantity && !row.amount) { toast('Give a quantity or an amount'); return; }
  } else {
    row.quantity = Number(g('wl_qty'));
    row.unit = r.unit || null;
    row.reference = g('wl_ref') || null;
    if (!isFinite(row.quantity) || row.quantity === 0) { toast('A delivery needs a quantity'); return; }
  }
  try {
    await api('wlDeliver', { params: { id: r.chit_id }, body: { rows: [row] } });
    closeModal();
    toast(kind === 'cost' ? 'Added to the line' : 'Delivery recorded');
    /* ⚠️ RELOAD RATHER THAN PATCH THE ROW. The roll-ups above it are derived from every row in the group, so a
       local edit would leave the headings stating a total that no longer matches what is under them. */
    await wlLoad();
  } catch (e) { toast((e && e.message) || 'Could not record that'); }
}
async function wlSetState(state){
  var r = WLL.row; if (!r) return;
  await wlAssignSave({ state: state,
    assignee_actor_id: r.actor_id || null, assignee_name: r.who === 'Unassigned' ? null : r.who,
    due_date: r.due_date || null }, state === 'done' ? 'Marked done' : 'Reopened');
}
async function wlLineSave(){
  var r = WLL.row; if (!r) return;
  var sel = document.getElementById('wl_who'), due = document.getElementById('wl_due');
  var id = sel ? sel.value : '';
  var nm = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : null;
  await wlAssignSave({ state: r.state || 'open', assignee_actor_id: id || null,
    assignee_name: id ? nm : null, due_date: (due && due.value) || null }, 'Updated');
}
async function wlAssignSave(edit, msg){
  var r = WLL.row; if (!r) return;
  try {
    await api('wlAssign', { params: { id: r.chit_id }, body: { edits: [Object.assign({ line_id: r.line_id }, edit)] } });
    closeModal();
    toast(msg);
    await wlLoad();
  } catch (e) { toast((e && e.message) || 'Could not save that'); }
}

/* Tapping a line opens the chit it belongs to — the line is where the work is, the chit is where the context is. */
function wlOpen(chit_id){
  if (typeof openChit2 === 'function' && typeof ensureCap === 'function') {
    ensureCap('chit2').then(function(){ openChit2(chit_id); });
  } else if (typeof openChit === 'function') { openChit(chit_id); }
}
