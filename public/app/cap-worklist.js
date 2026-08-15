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
    var when = t.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
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
    qty = '<b style="color:' + (r.left === 0 ? '#3d7a4e' : '#b0641c') + '">'
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
    + '<span style="flex:1;font-weight:500;font-size:13.5px;color:var(--ink-2,#41474e)' + (done ? ';text-decoration:line-through' : '') + '">'
    + (done ? '<span style="color:#3d7a4e;font-weight:800;text-decoration:none">✓ </span>' : '') + lead
    + (tail ? '<span style="color:var(--grey);font-weight:400;font-size:12.5px">' + tail + '</span>' : '') + '</span>'
    /* ⚠️ event.stopPropagation() ON BOTH — without it the row's own handler also fires and the chit opens behind
       the card, so the modal you wanted is sitting on a screen that navigated out from under it. */
    + '<span style="display:flex;gap:2px;flex:none;align-items:center">'
    /**
     * ⚠️ ONE DESTINATION, NOT THREE. These used to open their own little card, which is precisely how a delivery
     * got recorded without its history in view. They now open the SAME line card the row does — the tick is a
     * shortcut to a place, not a second place. Kept as separate affordances because they still say what the row
     * is FOR at a glance, which a bare chevron does not.
     */
    +   '<span data-testid="wl-done" title="Record a delivery — opens the line, with its history" onclick="event.stopPropagation();wlLine(&quot;' + r.line_id + '&quot;)"'
    +     ' style="cursor:pointer;font-size:13px;padding:2px 6px;border-radius:6px;color:#3d7a4e;background:#eef6f0;font-weight:800">✓</span>'
    +   '<span data-testid="wl-cost" title="Add a part, labour or a charge — opens the line" onclick="event.stopPropagation();wlLine(&quot;' + r.line_id + '&quot;)"'
    +     ' style="cursor:pointer;font-size:13px;padding:2px 6px;border-radius:6px;color:#2c5d7c;background:#eef4f8;font-weight:800">₹</span>'
    +   '<span style="color:var(--grey);font-size:12px;padding-left:3px">›</span></span></div>'
    /* ⚠️ WHICH ORDER IT CAME FROM. A line without its chit is an instruction with no context — you cannot ring the
       customer, check the rest of the order, or know who is waiting. */
    + (named || ordered ? '' : '<div style="font-size:11.5px;color:var(--grey);margin-top:3px">' + order + '</div>')
    + (bits.length ? '<div style="margin-top:4px;font-size:12px;color:#5b5340;background:#f4f1e8;border-radius:5px;padding:3px 8px;display:inline-block">◍ ' + bits.join(' · ') + '</div>' : '')
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
  if (r.overdue) text += ' · <span style="color:#c0453b;font-weight:700">' + r.overdue + ' overdue</span>';
  return text;
}
function wlHead(title, right, tone, id){
  return '<div data-testid="wl-head"' + (id ? ' onclick="wlToggle(&quot;' + esc(id) + '&quot;)"' : '')
    + ' style="' + (id ? 'cursor:pointer;' : '') + 'padding:14px 16px 6px;display:flex;justify-content:space-between;align-items:baseline;'
    + 'border-top:1px solid var(--line);background:#fbfbfa">'
    + '<span style="font-size:16px;font-weight:800;color:' + (tone || 'var(--ink,#1c2128)') + '">' + title + '</span>'
    + '<span style="font-size:12.5px;color:var(--grey)">' + (right || '') + '</span></div>';
}

function worklistScreen(){
  var body;
  if (WL.busy && !WL.data) body = '<div style="padding:18px 16px;color:var(--grey);font-size:12.5px"><span class="spin"></span> reading your work…</div>';
  else if (WL.err) body = '<div style="padding:18px 16px;color:#c0453b;font-size:12.5px">' + esc(WL.err) + '</div>';
  else {
    var d = WL.data || {};
    var mine = !!d.scoped_to_self;
    var rows = wlRows(d);

    if (!d.migrated) {
      body = '<div style="padding:18px 16px;font-size:12.5px;color:var(--grey)">Per-line assignment is not migrated on this environment (b143), so there is nothing to list.</div>';
    } else if (!rows.length) {
      /* ⚠️ TWO DIFFERENT EMPTIES. "Nothing is assigned to you" and "nothing is assigned to anyone" send opposite
         signals — one means you are free, the other means the work has not been handed out. */
      /* ⚠️ THREE DIFFERENT EMPTIES NOW. "Nothing assigned to you", "nothing assigned to anyone", and "everything
         you had is finished" mean completely different things, and the third is the one worth saying out loud. */
      var hid = wlDoneCount(d);
      body = '<div style="padding:18px 16px;font-size:12.5px;color:var(--grey)">'
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
    return '<span data-testid="' + testid + '" onclick="' + fn + '" style="cursor:pointer;font-size:12.5px;border:1px solid '
      + (on ? 'var(--blue)' : 'var(--line)') + ';' + (on ? 'background:var(--blue);color:#fff;font-weight:700;' : '')
      + 'border-radius:8px;padding:4px 11px">' + label + '</span>';
  };
  /* ⚠️ A CHECKBOX, NOT A THIRD CHIP. "Group by date, and do not split by person" is a different act from "group by
     person" — presenting it as another radio would make the one thing Athi asked for unreachable. */
  var box = function(k, label){
    if (k === prim || k === 'item') return '';   // item has its own switch — it is a roll-up, not a split
    var on = sec === k;
    return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--ink-2,#41474e);cursor:pointer">'
      + '<input type="checkbox" data-testid="wl-then-' + k + '" ' + (on ? 'checked' : '')
      + ' onchange="wlThen(&quot;' + k + '&quot;)" style="width:15px;height:15px;accent-color:var(--blue)">' + label + '</label>';
  };

  return '<div style="flex:1;min-height:0;overflow-y:auto">'
    + '<div style="padding:13px 16px;border-bottom:1px solid var(--line)">'
    +   '<div style="font-weight:700;font-size:16px">' + (mine2 ? 'My work' : 'Everyone\'s work') + '</div>'
    +   '<div style="font-size:12px;color:var(--grey);margin-top:2px">Every line assigned to '
    +   (mine2 ? 'you' : 'your team') + ', across every chit.</div></div>'
    /* ── group by ──────────────────────────────────────────────────────────────────────────────────────────── */
    + '<div style="display:flex;gap:6px;align-items:center;padding:9px 16px;border-bottom:1px solid var(--line-soft,#eee);flex-wrap:wrap">'
    +   '<span style="font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--grey);margin-right:2px">group by</span>'
    +   KEYS.map(function(x){ return chip(x[0], x[1], prim === x[0], 'wlPrimary(&quot;' + x[0] + '&quot;)', 'wl-view-' + x[0]); }).join('')
    +   '<input type="date" value="' + esc(WL.due || '') + '" onchange="wlDue(this.value)" '
    +     'style="margin-left:auto;font-size:12px;padding:3px 7px;border:1px solid var(--line);border-radius:8px">'
    +   (WL.due ? '<span onclick="wlDue(\'\')" style="cursor:pointer;font-size:12px;color:var(--blue);padding:4px">clear</span>' : '')
    + '</div>'
    /* ── then split by · and the disclosure controls ────────────────────────────────────────────────────────── */
    + '<div style="display:flex;gap:14px;align-items:center;padding:8px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap">'
    +   '<span style="font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--grey)">then split by</span>'
    +   KEYS.map(function(x){ return box(x[0], x[1]); }).join('')
    +   (sec ? '' : '<span style="font-size:11.5px;color:var(--grey);font-style:italic">not split — every line under its ' + esc(prim === 'who' ? 'person' : prim === 'date' ? 'date' : prim === 'item' ? 'product' : 'order') + '</span>')
    /* ⭐ THE PIVOT SWITCH. Off, you get the raw lines; on, the same product merges and its quantity totals — the
       answer to "what is my demand for that product", which is a sum you should never be doing by eye. */
    +   (prim === 'item' ? '' : '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--ink-2,#41474e);cursor:pointer">'
    +     '<input type="checkbox" data-testid="wl-byitem" ' + (WL.byItem === false ? '' : 'checked')
    +     ' onchange="wlByItem()" style="width:15px;height:15px;accent-color:var(--blue)">total by product</label>')
    /* ⚠️ SAY HOW MANY ARE HIDDEN. A list that quietly drops rows is a list people stop trusting the moment they
       notice — and they always notice. The count is the honest half of the filter. */
    +   (wlDoneCount(d2) ? '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--ink-2,#41474e);cursor:pointer">'
    +     '<input type="checkbox" data-testid="wl-showdone" ' + (WL.showDone ? 'checked' : '')
    +     ' onchange="wlDone()" style="width:15px;height:15px;accent-color:var(--blue)">show ' + wlDoneCount(d2) + ' done</label>' : '')
    +   '<span style="margin-left:auto;display:flex;gap:10px">'
    +     '<span data-testid="wl-expand-all" onclick="wlAll(true)" style="cursor:pointer;font-size:12px;color:var(--blue)">expand all</span>'
    +     '<span data-testid="wl-collapse-all" onclick="wlAll(false)" style="cursor:pointer;font-size:12px;color:var(--blue)">collapse all</span>'
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
            return esc(l.text) + ' <span style="font-size:.86em;font-weight:600;color:' + (l.overdue ? '#c0453b' : 'var(--grey)') + '">· ' + l.rel + '</span>'; },
          last: function(k){ return !k; },
          tone: function(k){ return (k && wlDateLabel(k).overdue) ? '#c0453b' : null; } },
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
    var caret = '<span style="display:inline-block;width:13px;color:var(--grey);font-size:11px">' + (isOpen ? '▾' : '▸') + '</span>';
    /* Every level carries its OWN roll-up: a breakdown that only totals at the top is a total, not a breakdown. */
    var head = depth === 0
      ? wlHead(caret + (tone === '#c0453b' ? '⚠️ ' : '') + title, wlRollupText(rs), tone, id)
      : '<div onclick="wlToggle(&quot;' + esc(id) + '&quot;)" style="cursor:pointer;padding:7px ' + (ind - 2) + 'px 2px ' + ind + 'px;'
        + 'display:flex;justify-content:space-between;align-items:baseline;gap:10px">'
        + '<span style="font-size:' + lv.size + ';font-weight:' + lv.weight + ';color:' + (tone || lv.color) + '">' + caret + title + '</span>'
        + '<span style="font-size:11.5px;color:var(--grey);text-align:right;flex:none">' + wlRollupText(rs) + '</span></div>';
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
var WLL = { row: null, det: null, actors: null };
async function wlLine(line_id){
  var r = wlRows(WL.data || {}).filter(function(x){ return x.line_id === line_id; })[0];
  if (!r) return;
  WLL.row = r; WLL.det = null;
  modal(wlLineHTML(true));
  try {
    WLL.det = await api('wlChit', { params: { id: r.chit_id } });
    if (!WLL.actors) {
      var a = await api('wlActors').catch(function(){ return null; });
      WLL.actors = (a && (a.actors || a.items || (Array.isArray(a) ? a : []))) || [];
    }
  } catch (e) { /* the card still works without history — it just cannot show it */ }
  var host = document.getElementById('modalhost');
  if (host && host.innerHTML) modal(wlLineHTML(false));
}
function wlLineHTML(loading){
  var r = WLL.row || {}, d = WLL.det || {};
  var prog = ((d.line_delivery || {})[r.line_id]) || {};
  var events = prog.events || [], added = prog.added || [];
  var done = r.state === 'done';
  var lbl = function(t){ return '<div style="font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--grey);margin:14px 0 5px">' + t + '</div>'; };

  /* ── ⭐ WHAT WAS ACTUALLY ASKED FOR ──────────────────────────────────────────────────────────────────────────
     ⚠️ THE RAW PHRASE GOES FIRST, ABOVE THE TIDY NAME. The matched name is a CONCLUSION — "2 boxes of the usual
     rice" became "Rice Ponni Boiled · 24 kg" — and the person holding the sack is the last one who can catch a
     wrong conclusion. They were the one person never shown the evidence. */
  var asked = '';
  if (r.raw_phrase || r.asked_as || r.comment || r.needs_human) {
    asked = lbl('what was asked for')
      + '<div style="background:#f4f1e8;border-left:3px solid #b0641c;border-radius:0 7px 7px 0;padding:9px 12px;font-size:13.5px;line-height:1.55">'
      + (r.raw_phrase ? '<div style="font-style:italic;color:#5b5340">“' + esc(r.raw_phrase) + '”</div>' : '')
      + (r.asked_as ? '<div style="margin-top:4px;font-size:12.5px;color:var(--grey)">written as <b>' + esc(r.asked_as) + '</b> · matched to <b>' + esc(r.particulars || '') + '</b></div>' : '')
      + (r.comment ? '<div style="margin-top:6px;color:#2c5d7c">' + esc(r.comment) + '</div>' : '')
      + (r.needs_human ? '<div style="margin-top:6px;font-size:12.5px;color:#c0453b;font-weight:700">⚠️ this line was flagged for a person to check</div>' : '')
      + '</div>';
  }

  /* ── progress, and the history behind it ─────────────────────────────────────────────────────────────────── */
  /**
   * ⚠️ OVER-DELIVERY MUST SAY "OVER", NOT "0 LEFT". `left` is clamped at zero, which is right for "how much more
   * to send" and actively misleading as a headline: Athi's screenshot reads "0 kg left · 180 out of 120 kg", so
   * the one number in the largest type on the card was hiding a 60 kg excess. Excess is the thing you most need
   * told, because unlike a shortfall nobody chases it.
   */
  var ordered = r.quantity == null ? null : Number(r.quantity);
  var got = Number(r.delivered || 0);
  var over = (ordered != null && got > ordered) ? Math.round((got - ordered) * 1000) / 1000 : 0;
  var left = r.left == null ? null : r.left;
  var big = over ? String(over) : (left == null ? '—' : String(left));
  var bar = '<div style="display:flex;gap:16px;align-items:baseline;font-variant-numeric:tabular-nums">'
    + '<div><div style="font-size:22px;font-weight:800;color:' + (over ? '#c0453b' : left === 0 ? '#3d7a4e' : '#b0641c') + '">'
    +   esc(big) + '</div><div style="font-size:11px;color:' + (over ? '#c0453b' : 'var(--grey)') + ';font-weight:' + (over ? 700 : 400) + '">'
    +   esc(r.unit || '') + (over ? ' OVER' : ' left') + '</div></div>'
    + '<div style="font-size:13px;color:var(--grey)">' + esc(String(got)) + ' out of ' + esc(String(ordered == null ? '—' : ordered)) + ' ' + esc(r.unit || '') + '</div>'
    + (prog.charged ? '<div style="margin-left:auto;text-align:right"><div style="font-size:17px;font-weight:800;color:#2c5d7c">' + esc(String(prog.charged)) + '</div><div style="font-size:11px;color:var(--grey)">charged</div></div>' : '')
    + '</div>';

  var hist = '';
  if (loading) hist = '<div style="font-size:12.5px;color:var(--grey);padding:6px 0"><span class="spin"></span> reading the history…</div>';
  else if (!events.length && !added.length) hist = '<div style="font-size:12.5px;color:var(--grey);padding:4px 0">Nothing recorded against this line yet.</div>';
  else {
    hist = events.concat([]).map(function(e){
      return '<div style="display:flex;gap:10px;align-items:baseline;padding:5px 0;border-bottom:1px solid var(--line-soft,#f0efec);font-size:13px">'
        + '<span style="font-weight:700;font-variant-numeric:tabular-nums;color:' + (e.quantity < 0 ? '#c0453b' : 'var(--ink)') + '">'
        +   (e.quantity < 0 ? '' : '+') + esc(String(e.quantity)) + ' ' + esc(e.unit || '') + '</span>'
        + '<span style="color:var(--grey);font-size:12px">' + esc(e.reference || e.note || '') + '</span>'
        + '<span style="margin-left:auto;color:var(--grey);font-size:11.5px">' + esc(String(e.at || '').slice(0, 10)) + ' · ' + esc(e.by_actor || e.by || '') + '</span></div>';
    }).join('')
    + added.map(function(a){
      return '<div style="display:flex;gap:10px;align-items:baseline;padding:5px 0;border-bottom:1px solid var(--line-soft,#f0efec);font-size:13px">'
        + '<span style="color:#2c5d7c;font-weight:700">₹ ' + esc(String(a.amount == null ? '' : a.amount)) + '</span>'
        + '<span>' + esc(a.particulars || '') + (a.quantity ? ' <span style="color:var(--grey)">· ' + esc(String(a.quantity)) + ' ' + esc(a.unit || '') + '</span>' : '') + '</span>'
        + '<span style="margin-left:auto;color:var(--grey);font-size:11.5px">' + esc(String(a.at || '').slice(0, 10)) + '</span></div>';
    }).join('');
  }

  /* ── who holds it, and when it is due — both changeable, both append-only behind the scenes ──────────────── */
  var opts = '<option value="">Unassigned</option>' + (WLL.actors || []).map(function(a){
    var id = a.actor_id || a.identity_id, nm = a.display_name || a.name || '';
    return '<option value="' + esc(id) + '"' + (id === r.actor_id ? ' selected' : '') + '>' + esc(nm) + '</option>';
  }).join('');

  return '<div class="mhd"><div class="t">' + esc(r.particulars || 'Line') + (done ? ' <span style="font-size:13px;color:#3d7a4e">✓ done</span>' : '') + '</div>'
    + '<div class="s">' + esc(r.subject || 'chit') + '</div></div>'
    + '<div class="mbody">'
    +   bar
    +   asked
    +   lbl('history')
    +   hist
    /**
     * ⭐ RECORD IT HERE, UNDER THE HISTORY THAT SHOULD INFORM IT — Athi, 2026-08-15: *"the tick mark is not
     * bringing the history, so I am delivering in excess … I guess we don't need two tabs. The tick mark can
     * bring the history also, so you know the history and you should be able to part deliver and/or consider
     * closing the task. Can you see what is the union of both the window and bring the best of both?"*
     *
     * ⚠️ TWO WINDOWS CAUSED A REAL OVER-DELIVERY. The ✓ card asked for a quantity and pre-filled the ORDERED
     * figure, with no idea 120 had already gone out; the history lived in a different window nobody had open at
     * the moment of typing. 120 was entered against a line already complete and the result was 180 of 120. The
     * fix is not a warning — it is putting the number and the evidence for it in the same field of view.
     *
     * ⚠️ AND IT DEFAULTS TO WHAT IS LEFT, NOT TO WHAT WAS ORDERED. On a line with nothing delivered those are the
     * same number, which is exactly why the wrong one survived so long: it is only wrong AFTER a part delivery,
     * which is the case this whole screen exists for.
     */
    +   lbl('record a delivery')
    +   '<div style="display:flex;gap:9px;align-items:flex-end">'
    +     '<div style="flex:1"><input id="wl_qty" data-testid="wl-qty" type="number" step="any" value="' + esc(String(left == null ? '' : left)) + '"'
    +       ' style="width:100%;font-size:17px;font-weight:700;padding:9px 11px;border:1px solid var(--line);border-radius:8px">'
    +       '<div style="font-size:11px;color:var(--grey);margin-top:3px">' + esc(r.unit || '')
    +       + (left != null ? ' · pre-filled with what is left, not what was ordered' : '') + '</div></div>'
    +     '<input id="wl_ref" placeholder="docket / note" style="flex:1;font-size:14.5px;padding:9px 11px;border:1px solid var(--line);border-radius:8px">'
    +     '<button class="btn pri" data-testid="wl-record" onclick="wlActSave(&quot;done&quot;)" style="padding:9px 15px">Record</button>'
    +   '</div>'
    +   '<div style="margin-top:6px;font-size:11.5px;color:var(--grey);line-height:1.5">A negative figure corrects an earlier delivery — nothing is ever deleted.'
    +     (over ? ' <b style="color:#c0453b">This line is already ' + esc(String(over)) + ' ' + esc(r.unit || '') + ' over; a negative entry is how you put that right.</b>' : '') + '</div>'
    +   lbl('add a part, labour or a charge')
    +   '<div style="display:flex;gap:9px;align-items:flex-end">'
    +     '<input id="wl_what" data-testid="wl-what" placeholder="Brake shoe, labour, call-out…" style="flex:2;font-size:14.5px;padding:9px 11px;border:1px solid var(--line);border-radius:8px">'
    +     '<input id="wl_cqty" type="number" step="any" placeholder="qty" style="flex:.7;font-size:14.5px;padding:9px 11px;border:1px solid var(--line);border-radius:8px">'
    +     '<input id="wl_cunit" placeholder="unit" style="flex:.8;font-size:14.5px;padding:9px 11px;border:1px solid var(--line);border-radius:8px">'
    +     '<input id="wl_amt" data-testid="wl-amt" type="number" step="any" placeholder="cost" style="flex:1;font-size:14.5px;padding:9px 11px;border:1px solid var(--line);border-radius:8px">'
    +     '<button class="btn" data-testid="wl-addcost" onclick="wlActSave(&quot;cost&quot;)" style="padding:9px 15px">Add</button>'
    +   '</div>'
    +   lbl('who is doing it, and by when')
    +   '<div style="display:flex;gap:10px">'
    +     '<select id="wl_who" data-testid="wl-who-sel" style="flex:1;font-size:14.5px;padding:8px 10px;border:1px solid var(--line);border-radius:8px">' + opts + '</select>'
    +     '<input id="wl_due" data-testid="wl-due-inp" type="date" value="' + esc(String(r.due_date || '').slice(0, 10)) + '" style="font-size:14.5px;padding:8px 10px;border:1px solid var(--line);border-radius:8px">'
    +   '</div>'
    +   '<div style="margin-top:6px;font-size:11.5px;color:var(--grey);line-height:1.5">Handing it on keeps the old assignment as history — nothing is overwritten.</div>'
    + '</div>'
    + '<div class="mfoot" style="flex-wrap:wrap;gap:8px">'
    +   '<button onclick="wlOpen(&quot;' + r.chit_id + '&quot;)">Open the order</button>'
    /* ⚠️ MARK-DONE CARRIES THE ASSIGNEE AND DATE FORWARD, so pressing it is not a quiet unassignment. */
    +   '<button data-testid="wl-mark-done" onclick="wlSetState(' + (done ? '&quot;open&quot;' : '&quot;done&quot;') + ')">'
    +     (done ? 'Reopen' : 'Mark done') + '</button>'
    +   '<button class="pri" data-testid="wl-line-save" onclick="wlLineSave()">Save</button>'
    + '</div>';
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
