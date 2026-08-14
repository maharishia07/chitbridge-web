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
var WL = { data: null, busy: false, err: null, due: '', view: null };

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
function wlView(v){ WL.view = v; wlPaint(); }

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
  return '<div onclick="wlOpen(&quot;' + r.chit_id + '&quot;)" style="padding:11px 16px 11px 28px;border-bottom:1px solid var(--line);cursor:pointer">'
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

function wlHead(title, right, tone){
  return '<div style="padding:14px 16px 6px;display:flex;justify-content:space-between;align-items:baseline;'
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
      /* ⭐ THE KEY ORDER IS THE VIEW — his model, reused. An actor asks "what is my day"; the owner asks "who has
         what". Same rows, different first key. */
      var keys = WL.view ? WL.view.split('>') : (mine ? ['date', 'chit'] : ['who', 'date']);
      body = wlRender(rows, keys, 0, []);
    }
  }

  var d2 = WL.data || {};
  var mine2 = !!d2.scoped_to_self;
  var opts = mine2
    ? [['date>chit', 'By date'], ['chit>date', 'By order']]
    : [['who>date', 'By person'], ['date>who', 'By date'], ['chit>who', 'By order']];
  var cur = WL.view || (mine2 ? 'date>chit' : 'who>date');

  return '<div style="flex:1;min-height:0;overflow-y:auto">'
    + '<div style="padding:13px 16px;border-bottom:1px solid var(--line)">'
    +   '<div style="font-weight:700;font-size:16px">' + (mine2 ? 'My work' : 'Everyone\'s work') + '</div>'
    +   '<div style="font-size:12px;color:var(--grey);margin-top:2px">Every line assigned to '
    +   (mine2 ? 'you' : 'your team') + ', across every chit.</div></div>'
    + '<div style="display:flex;gap:6px;padding:9px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap">'
    +   opts.map(function(o){
          var on = cur === o[0];
          return '<span onclick="wlView(&quot;' + o[0] + '&quot;)" style="cursor:pointer;font-size:12.5px;border:1px solid '
            + (on ? 'var(--blue)' : 'var(--line)') + ';' + (on ? 'background:var(--blue);color:#fff;font-weight:700;' : '')
            + 'border-radius:8px;padding:4px 11px">' + o[1] + '</span>';
        }).join('')
    +   '<input type="date" value="' + esc(WL.due || '') + '" onchange="wlDue(this.value)" '
    +     'style="margin-left:auto;font-size:12px;padding:3px 7px;border:1px solid var(--line);border-radius:8px">'
    +   (WL.due ? '<span onclick="wlDue(\'\')" style="cursor:pointer;font-size:12px;color:var(--blue);padding:4px">clear</span>' : '')
    + '</div>'
    + body + '</div>';
}

/* The same recursive grouper as the Work tab. A key order is data; a view is not code. */
function wlRender(rows, keys, depth, path){
  /* ⚠️ THE PATH IS A PARAMETER, NOT A MODULE VARIABLE. It was a shared mutable that each level pushed to and
     popped from — correct only while rendering stays perfectly synchronous and single-threaded, and silently
     wrong the first time anything re-enters. Passing it down costs nothing and cannot desynchronise. */
  path = path || [];
  if (!keys.length) return rows.map(function(r){ return wlRow(r, path); }).join('');
  var key = keys[0], rest = keys.slice(1);
  var G = {
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
  }[key];
  var buckets = {};
  rows.forEach(function(r){ var k = G.of(r); (buckets[k] = buckets[k] || []).push(r); });
  var next = path.concat([key]);
  var html = Object.keys(buckets).sort(G.sort).map(function(k){
    var rs = buckets[k], n = rs.length;
    var title = G.label(k, rs), tone = G.tone(k);
    var head = depth === 0
      ? wlHead((tone === '#c0453b' ? '⚠️ ' : '') + title, n + ' line' + (n === 1 ? '' : 's'), tone)
      : '<div style="padding:6px 16px 2px;font-size:12.5px;font-weight:700;color:var(--grey)">' + title + '</div>';
    return head + wlRender(rs, rest, depth + 1, next);
  }).join('');
  return html;
}

/* Tapping a line opens the chit it belongs to — the line is where the work is, the chit is where the context is. */
function wlOpen(chit_id){
  if (typeof openChit2 === 'function' && typeof ensureCap === 'function') {
    ensureCap('chit2').then(function(){ openChit2(chit_id); });
  } else if (typeof openChit === 'function') { openChit(chit_id); }
}
