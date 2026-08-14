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
  return (t && t !== p) ? [p, t] : [p];
}

/** Flatten byPerson's people[] back to rows — the grouping is this screen's job, not the API's. */
function wlRows(d){
  var out = [];
  (d.people || []).forEach(function(p){
    (p.lines || []).forEach(function(l){
      out.push(Object.assign({}, l, { who: p.name || 'Unassigned', actor_id: p.actor_id || null }));
    });
  });
  return out;
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
function wlRow(r, ctx){
  var due = r.due_date ? wlDateLabel(r.due_date) : null;
  var bits = [];
  if (ctx.indexOf('who') < 0 && r.who) bits.push(esc(r.who));
  if (ctx.indexOf('date') < 0 && due) bits.push((due.overdue ? '⚠️ ' : '') + esc(due.text));
  if (r.task) bits.push(esc(r.task));
  return '<div data-testid="wl-row" onclick="wlOpen(&quot;' + r.chit_id + '&quot;)" style="padding:11px 16px 11px 28px;border-bottom:1px solid var(--line);cursor:pointer">'
    + '<div style="display:flex;align-items:baseline;gap:8px">'
    + '<span style="flex:1;font-weight:600;font-size:14.5px">' + esc(r.particulars || '')
    + '<span style="color:var(--grey);font-weight:400;font-size:12.5px"> · '
    + esc([r.quantity, r.unit].filter(function(x){ return x != null && x !== ''; }).join(' ')) + '</span></span>'
    + '<span style="color:var(--grey);font-size:12px">›</span></div>'
    /* ⚠️ WHICH ORDER IT CAME FROM. A line without its chit is an instruction with no context — you cannot ring the
       customer, check the rest of the order, or know who is waiting. */
    + '<div style="font-size:11.5px;color:var(--grey);margin-top:3px">' + esc(r.subject || 'chit')
    + (r.counterparty ? ' · ' + esc(r.counterparty) : '') + '</div>'
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
      body = '<div style="padding:18px 16px;font-size:12.5px;color:var(--grey)">'
        + (mine ? 'Nothing is assigned to you right now.' : 'No lines are assigned to anyone yet — open a chit and assign its lines.')
        + (WL.due ? ' (filtered to ' + esc(WL.due) + ')' : '') + '</div>';
    } else {
      /* ⭐ THE KEY ORDER IS THE VIEW — his model. */
      body = wlRender(rows, wlKeys(mine), 0, []);
    }
  }

  var d2 = WL.data || {};
  var mine2 = !!d2.scoped_to_self;
  var KEYS = [['who', 'person'], ['date', 'date'], ['chit', 'order']];
  var active = wlKeys(mine2);
  var prim = active[0], sec = active[1] || null;

  var chip = function(k, label, on, fn, testid){
    return '<span data-testid="' + testid + '" onclick="' + fn + '" style="cursor:pointer;font-size:12.5px;border:1px solid '
      + (on ? 'var(--blue)' : 'var(--line)') + ';' + (on ? 'background:var(--blue);color:#fff;font-weight:700;' : '')
      + 'border-radius:8px;padding:4px 11px">' + label + '</span>';
  };
  /* ⚠️ A CHECKBOX, NOT A THIRD CHIP. "Group by date, and do not split by person" is a different act from "group by
     person" — presenting it as another radio would make the one thing Athi asked for unreachable. */
  var box = function(k, label){
    if (k === prim) return '';
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
    +   (sec ? '' : '<span style="font-size:11.5px;color:var(--grey);font-style:italic">not split — every line under its ' + esc(prim === 'who' ? 'person' : prim === 'date' ? 'date' : 'order') + '</span>')
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
          sort: function(a, b){ if (a === 'Unassigned') return 1; if (b === 'Unassigned') return -1; return a.localeCompare(b); },
          tone: function(k){ return k === 'Unassigned' ? 'var(--grey)' : null; } },
  date: { of: function(r){ return r.due_date ? String(r.due_date).slice(0, 10) : ''; },
          label: function(k){ if (!k) return 'No date'; var l = wlDateLabel(k);
            return esc(l.text) + ' <span style="font-size:12px;font-weight:600;color:' + (l.overdue ? '#c0453b' : 'var(--grey)') + '">· ' + l.rel + '</span>'; },
          sort: function(a, b){ if (!a) return 1; if (!b) return -1; return a.localeCompare(b); },
          tone: function(k){ return (k && wlDateLabel(k).overdue) ? '#c0453b' : null; } },
  chit: { of: function(r){ return r.chit_id; },
          label: function(k, rs){ return esc((rs[0] && rs[0].subject) || 'chit') + (rs[0] && rs[0].counterparty ? ' <span style="font-size:12px;font-weight:600;color:var(--grey)">· ' + esc(rs[0].counterparty) + '</span>' : ''); },
          sort: function(){ return 0; }, tone: function(){ return null; } },
};

/* The same recursive grouper as the Work tab. A key order is data; a view is not code. */
function wlRender(rows, keys, depth, path){
  /* ⚠️ THE PATH IS A PARAMETER, NOT A MODULE VARIABLE. It was a shared mutable that each level pushed to and
     popped from — correct only while rendering stays perfectly synchronous and single-threaded, and silently
     wrong the first time anything re-enters. Passing it down costs nothing and cannot desynchronise. */
  path = path || [];
  /* The path alternates key, value, key, value — so the KEYS a row already inherits from its headings are its even
     positions. wlRow drops exactly those, and reading them off the path keeps one source of truth. */
  if (!keys.length) return rows.map(function(r){
    return wlRow(r, path.filter(function(_, i){ return i % 2 === 0; }));
  }).join('');
  var key = keys[0], rest = keys.slice(1);
  var G = WLG[key];
  var buckets = {};
  rows.forEach(function(r){ var k = G.of(r); (buckets[k] = buckets[k] || []).push(r); });
  var html = Object.keys(buckets).sort(G.sort).map(function(k){
    var rs = buckets[k];
    var title = G.label(k, rs), tone = G.tone(k);
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
    var head = depth === 0
      ? wlHead(caret + (tone === '#c0453b' ? '⚠️ ' : '') + title, wlRollupText(rs), tone, id)
      /* The sub-heading carries its own roll-up: a breakdown that only totals at the top is a total, not a
         breakdown. It is quieter than the level above, or the two compete and neither reads as the grouping. */
      : '<div onclick="wlToggle(&quot;' + esc(id) + '&quot;)" style="cursor:pointer;padding:6px 16px 2px;display:flex;justify-content:space-between;align-items:baseline">'
        + '<span style="font-size:12.5px;font-weight:700;color:var(--grey)">' + caret + title + '</span>'
        + '<span style="font-size:11.5px;color:var(--grey)">' + wlRollupText(rs) + '</span></div>';
    return head + (isOpen ? wlRender(rs, rest, depth + 1, path.concat([key, k])) : '');
  }).join('');
  return html;
}

/* Tapping a line opens the chit it belongs to — the line is where the work is, the chit is where the context is. */
function wlOpen(chit_id){
  if (typeof openChit2 === 'function' && typeof ensureCap === 'function') {
    ensureCap('chit2').then(function(){ openChit2(chit_id); });
  } else if (typeof openChit === 'function') { openChit(chit_id); }
}
