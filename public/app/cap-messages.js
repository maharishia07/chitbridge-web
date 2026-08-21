/* app/cap-messages.js — REPLIES: every external conversation that still wants you, across every chit. Lazy.
 *
 * Athi, 2026-08-15: *"bring all the external messages under one tab, which are not read yet … read, reply etc
 * should be done there only"*, then *"can we bring external new messages under rail?"*, then *"go ahead with
 * threaded by line."*
 *
 * ⚠️ THE PER-CHIT MESSAGE ROUTE STRUCTURALLY COULD NOT ANSWER THIS. Someone with forty open orders had to open
 * forty chits to find the two that had been replied to. Same shape as the worklist: one list assembled from
 * every chit, which a per-chit API can never produce.
 *
 * ── ⭐ THREADED BY LINE ─────────────────────────────────────────────────────────────────────────────────────────
 * A conversation is about a LINE — "can you split the rice into 25kg bags" and its answer belong together, and
 * four rows for one exchange is four decisions where there is one. So the inbox lists THREADS: latest message,
 * who said it, how many are unread. 📌 keeps the whole conversation, not one message of it.
 *
 * ⚠️ AND OPENING A THREAD FETCHES THE WHOLE OF IT. The inbox query returns only what is unread-or-kept, which is
 * right for a list and wrong for a conversation — you would read a reply with the question it answers missing.
 * The per-chit route already returns the full line thread; opening asks it.
 */
var RPL = { data: null, busy: false, err: null, all: false, track: '', open: {}, full: {}, sending: {} };

/**
 * ⭐ TASK OR ORDER — Athi, 2026-08-15: *"both task and order messages, is there a way to segregate?"*
 *
 * ⚠️ THEY ARE DIFFERENT WORK ARRIVING IN ONE LIST. "Did they answer MY order" is chasing; "the customer said
 * something about the job they gave me" is being chased. The server has always known which — chit_header.direction
 * — and the screen showed neither, so the two read as one undifferentiated pile.
 *
 * ⚠️ FILTERED CLIENT-SIDE, DELIBERATELY. The rows are already here; a round trip to hide some of them would make
 * a filter slower than the list it filters, and the counts on the chips could not be shown until it returned.
 */
var RPLTRACK = { order: { icon: '📤', label: 'Order', hint: 'chits you sent' },
                 task:  { icon: '📥', label: 'Task',  hint: 'chits you received' } };
function rplTrack(t){ RPL.track = (RPL.track === t) ? '' : t; RPL.open = {}; msgPaint(); }

if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    msgInbox:  { m: 'GET',  p: '/api/folders/messages', ok: 'y' },
    msgMark:   { m: 'POST', p: '/api/folders/messages/:id/mark', ok: 'y' },
    msgReply:  { m: 'POST', p: '/api/chits/:id/messages', ok: 'y' },
    msgThread: { m: 'GET',  p: '/api/chits/:id/messages', ok: 'y' },
  });
}

async function loadMessages(){
  RPL.busy = true; RPL.err = null; msgPaint();
  try {
    var r = await api('msgInbox', RPL.all ? { query: { all: 1 } } : {});
    RPL.data = (r && (r.messages || r.items || (Array.isArray(r) ? r : []))) || [];
  } catch (e) { RPL.err = (e && e.message) || 'Could not read your messages.'; }
  RPL.busy = false; msgPaint();
  if (typeof loadReplyCount === 'function') loadReplyCount();
}
function msgPaint(){ var el = document.getElementById('mainbody'); if (el) el.innerHTML = messagesScreen(); }
function msgShowAll(){ RPL.all = !RPL.all; RPL.data = null; RPL.open = {}; RPL.full = {}; loadMessages(); }
function msgUnread(){ return (RPL.data || []).filter(function(m){ return !m.read_at; }).length; }

/**
 * ⭐ ONE THREAD PER LINE — and per chit for anything that named no line.
 *
 * ⚠️ A NULL line_id IS ITS OWN THREAD, not a bucket to be merged into some other. Messages about the order as a
 * whole ("ring me before you load") are a real conversation and belong together, but they are NOT part of the
 * rice conversation and folding them in would put an answer under the wrong question.
 */
function msgKey(m){ return m.chit_id + '␟' + (m.line_id || ''); }
function msgThreads(){
  var by = {}, order = [];
  (RPL.data || []).forEach(function(m){
    var k = msgKey(m);
    if (!by[k]) { by[k] = { key: k, chit_id: m.chit_id, line_id: m.line_id || null, msgs: [] }; order.push(k); }
    by[k].msgs.push(m);
  });
  return order.filter(function(k){
    /* The filter applies to the THREAD, not the message — a conversation belongs to one chit and therefore to
       one track, so filtering per message could split an exchange in half. */
    return !RPL.track || (by[k].msgs[0].track === RPL.track);
  }).map(function(k){
    var t = by[k];
    /* The inbox arrives newest-first; a thread reads oldest-first, and its headline is the newest. */
    t.msgs.sort(function(a, b){ return String(a.created_at).localeCompare(String(b.created_at)); });
    t.latest = t.msgs[t.msgs.length - 1];
    t.unread = t.msgs.filter(function(m){ return !m.read_at; }).length;
    t.kept = t.msgs.some(function(m){ return m.kept; });
    return t;
  }).sort(function(a, b){ return String(b.latest.created_at).localeCompare(String(a.latest.created_at)); });
}

/**
 * ⚠️ OPENING IS READING — for every unread message in the thread, not just the newest. A separate "mark read"
 * button gives a count that only falls when someone remembers to press something, and it stops matching what has
 * actually been seen within a day.
 *
 * ⚠️ ONE REQUEST PER UNREAD MESSAGE, and that is a known cost. A thread carries two or three, so a bulk endpoint
 * would be a migration and a route to save a round trip nobody waits on. Worth revisiting if threads get long.
 */
async function msgOpen(key){
  RPL.open[key] = !RPL.open[key];
  msgPaint();
  if (!RPL.open[key]) return;
  var t = msgThreads().filter(function(x){ return x.key === key; })[0];
  if (!t) return;

  if (!RPL.full[key]) {
    try {
      var q = { thread_type: 'external' };
      if (t.line_id) q.line_id = t.line_id;
      var r = await api('msgThread', { params: { id: t.chit_id }, query: q });
      var list = (r && (r.messages || r.items || (Array.isArray(r) ? r : []))) || [];
      /* ⚠️ FILTERED AGAIN CLIENT-SIDE. Before b155 the server ignores line_id and hands back the whole chit
         thread — without this a line conversation would silently absorb every other line's messages. */
      RPL.full[key] = list.filter(function(m){ return (m.line_id || null) === (t.line_id || null); })
                          .sort(function(a, b){ return String(a.created_at).localeCompare(String(b.created_at)); });
      msgPaint();
    } catch (e) { RPL.full[key] = null; msgPaint(); }
  }

  var unread = t.msgs.filter(function(m){ return !m.read_at; });
  for (var i = 0; i < unread.length; i++) {
    try { await api('msgMark', { params: { id: unread[i].message_id }, body: { read: true } });
          unread[i].read_at = new Date().toISOString(); }
    catch (e) { /* reading is not worth an error toast — the thread is open, which is what was wanted */ }
  }
  msgPaint();
  if (typeof loadReplyCount === 'function') loadReplyCount();
}

/**
 * ⭐ 📌 KEEPS THE CONVERSATION, NOT A MESSAGE — Athi: *"an icon to retain the message in the tab."*
 *
 * ⚠️ Pinning one message of a thread would leave the thread in the list showing one line of a conversation whose
 * other half had dropped out. The unit on this screen is the thread, so the pin is too.
 */
async function msgKeep(key, ev){
  if (ev) ev.stopPropagation();
  var t = msgThreads().filter(function(x){ return x.key === key; })[0];
  if (!t) return;
  var to = !t.kept;
  try {
    for (var i = 0; i < t.msgs.length; i++) {
      await api('msgMark', { params: { id: t.msgs[i].message_id }, body: { kept: to } });
      t.msgs[i].kept = to;
    }
    msgPaint();
    toast(to ? 'Kept — this conversation stays here' : 'Released');
  } catch (e) { toast((e && e.message) || 'Could not change that'); }
}

async function msgSend(key){
  var t = msgThreads().filter(function(x){ return x.key === key; })[0];
  if (!t) return;
  var el = document.getElementById('msg_reply_' + key.replace(/[^a-z0-9]/gi, ''));
  var txt = el ? String(el.value).trim() : '';
  if (!txt) { toast('Nothing to send'); return; }
  RPL.sending[key] = true; msgPaint();
  try {
    /* ⚠️ THE REPLY CARRIES line_id. Losing it would land the answer on the chit as a loose remark while the
       question it answers sits under a line — and this very screen would then file it as a separate thread. */
    await api('msgReply', { params: { id: t.chit_id },
      body: { message_text: txt, thread_type: 'external', line_id: t.line_id || undefined } });
    RPL.sending[key] = false;
    RPL.full[key] = null;                 // the thread has changed; fetch it fresh when next opened
    toast('Sent — they can see it on their copy');
    await loadMessages();
    RPL.open[key] = true; await msgOpen(key);
  } catch (e) { RPL.sending[key] = false; msgPaint(); toast((e && e.message) || 'Could not send that'); }
}

function msgWhen(s){
  if (!s) return '';
  try {
    var d = new Date(s), mins = Math.round((new Date() - d) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    if (mins < 60 * 24) return Math.round(mins / 60) + 'h ago';
    return CBLocale.date(d, { day: '2-digit', month: 'short' });
  } catch (e) { return String(s).slice(0, 10); }
}
function msgIsMine(m){
  return typeof ccIsSelf === 'function' && ccIsSelf(m.sender_display_name);
}

function messagesScreen(){
  var body;
  if (RPL.busy && !RPL.data) body = '<div style="padding:18px 16px;color:var(--grey);font-size:var(--fs-2)"><span class="spin"></span> checking for replies…</div>';
  else if (RPL.err) body = '<div style="padding:18px 16px;color:var(--disp);font-size:var(--fs-2)">' + esc(RPL.err) + '</div>';
  else {
    var threads = msgThreads();
    if (!threads.length) {
      body = '<div style="padding:22px 16px;color:var(--grey);font-size:var(--fs-2);line-height:1.6">'
        + (RPL.all ? 'No conversations yet. When a counterparty replies on a chit, it lands here.'
                   : 'Nothing new. Replies from the other party appear here — tick “everything” to see the ones you have already dealt with.')
        + '</div>';
    } else {
      body = threads.map(function(t){
        var m = t.latest, open = !!RPL.open[t.key], isNew = t.unread > 0;
        var closed = ['completed', 'cancelled', 'rejected'].indexOf(m.chit_status) >= 0;
        var what = m.particulars ? esc(m.particulars) : esc(m.manual_subject || m.auto_subject || 'this order');
        var sub  = m.particulars ? esc(m.manual_subject || m.auto_subject || 'chit') : 'the order as a whole';
        var full = RPL.full[t.key];
        var rid  = t.key.replace(/[^a-z0-9]/gi, '');
        return '<div data-testid="msg-thread" style="border-bottom:1px solid var(--line);' + (isNew ? 'background:var(--blue-tint-bg);' : '') + ';color:var(--on-card)">'
          + '<div onclick="msgOpen(&quot;' + t.key + '&quot;)" style="cursor:pointer;padding:11px 14px;display:flex;gap:10px;align-items:baseline">'
          +   '<span style="width:8px;flex:none">' + (isNew ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--blue-2);color:var(--on-accent)"></span>' : '') + '</span>'
          +   '<div style="flex:1;min-width:0">'
          +     '<div style="display:flex;gap:8px;align-items:baseline">'
          /* The track rides on every row, not just when filtering — a list you have to filter to understand is a
             list that has not told you anything yet. */
          +       '<span title="' + esc((RPLTRACK[m.track] || {}).hint || '') + '" style="flex:none;font-size:var(--fs-1);color:var(--grey)">'
          +         esc((RPLTRACK[m.track] || {}).icon || '') + '</span>'
          +       '<b style="font-size:var(--fs-3)' + (isNew ? ';font-weight:800' : '') + '">' + what + '</b>'
          /* ⚠️ A CLOSED CHIT IS MARKED, NEVER HIDDEN — a complaint about a closed order arrives exactly here. */
          +       (closed ? '<span style="font-size:var(--fs-1);font-weight:700;color:var(--warn-2);background:var(--warn-tint);border-radius:4px;padding:1px 5px">' + esc(m.chit_status) + '</span>' : '')
          +       '<span style="font-size:var(--fs-1);color:var(--grey);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sub + '</span>'
          /* ⚠️ THE FULL COUNT ONCE IT IS KNOWN. The inbox only returns unread-or-kept, so this said "3 msgs" over
             a conversation that turned out to hold 5 — a number that disagreed with the thread it labelled the
             moment you opened it. Once the thread is fetched, its own length is the truthful one. */
          +       (function(){ var n = (RPL.full[t.key] || t.msgs).length;
                    return n > 1 ? '<span style="font-size:var(--fs-1);color:var(--grey);flex:none">' + n + ' msgs</span>' : ''; })()
          +       '<span style="font-size:var(--fs-1);color:var(--grey);flex:none">' + esc(msgWhen(m.created_at)) + '</span>'
          +     '</div>'
          +     '<div style="font-size:var(--fs-2);color:var(--ink-2,#41474e);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
          +       '<b style="font-weight:600">' + esc(m.sender_display_name || '—') + ':</b> ' + esc(m.message_text || '') + '</div>'
          +   '</div>'
          +   '<span data-testid="msg-keep" onclick="msgKeep(&quot;' + t.key + '&quot;,event)" title="' + (t.kept ? 'Kept here — click to release' : 'Keep this conversation in the tab') + '"'
          +     ' style="flex:none;cursor:pointer;font-size:var(--fs-3);opacity:' + (t.kept ? '1' : '.35') + '">📌</span>'
          + '</div>'
          + (open ? '<div style="padding:0 14px 13px 32px">'
              /**
               * ⭐ THE JUMPS GO AT THE TOP — Athi, 2026-08-15: *"open order / task in the top."*
               *
               * ⚠️ THEY WERE BELOW THE CONVERSATION, so on a long thread you scrolled past everything to reach
               * the two links that answer "what is this actually about" — the question you have BEFORE reading,
               * not after. And with newest-first they sat below the oldest message, which is the furthest point
               * on the screen from where the eye starts.
               */
              + '<div style="display:flex;gap:10px;align-items:center;padding:2px 0 8px;border-bottom:1px solid var(--line-soft,#f0efec);margin-bottom:6px">'
              +   (t.line_id ? '<span data-testid="msg-open-line" onclick="rplOpenLine(&quot;' + t.chit_id + '&quot;,&quot;' + t.line_id + '&quot;)"'
                    + ' style="cursor:pointer;font-size:var(--fs-2);color:var(--blue);font-weight:700">' + tx('↗ Open the line') + '</span>' : '')
              +   '<span data-testid="msg-open-chit" onclick="rplOpenChit(&quot;' + t.chit_id + '&quot;)" style="cursor:pointer;font-size:var(--fs-2);color:var(--blue)">↗ Open the '
              +     ((RPLTRACK[m.track] || {}).label || 'order').toLowerCase() + '</span>'
              /* ⚠️ NO SECOND COUNT HERE. This said "2 in this conversation" beside a row reading "3 msgs" — two
                 numbers for one fact, from two different sources, disagreeing in plain sight. The row already
                 carries it, and it now carries the truthful one. */
              + '</div>'
              /**
               * ⭐ THE REPLY BOX SITS ABOVE THE CONVERSATION — Athi, 2026-08-15: *"reply message also on top,
               * otherwise you have to scroll to find the order, message box and so on."*
               *
               * ⚠️ EVERY ACTION IS NOW WITHIN ONE SCREEN OF THE ROW YOU TAPPED. With the box at the bottom, a
               * long conversation put the two things you came to do — jump to the work, or answer — at the far
               * end of a scroll, past messages you had already read. Reading is browsing; replying is the task.
               * The task goes first.
               */
              + '<textarea id="msg_reply_' + rid + '" data-testid="msg-reply" rows="2" placeholder="Reply to ' + esc(m.sender_display_name || 'them') + '…"'
              +   ' style="width:100%;box-sizing:border-box;font:inherit;font-size:var(--fs-3);line-height:1.5;padding:9px 11px;border:1px solid var(--line);border-radius:9px;resize:vertical"></textarea>'
              + '<div style="display:flex;gap:10px;align-items:center;margin-top:7px">'
              +   '<span style="font-size:var(--fs-1);color:var(--warn-2)">📤 The other party sees this, on their own copy.</span>'
              +   '<button class="btn pri" data-testid="msg-send" onclick="msgSend(&quot;' + t.key + '&quot;)"'
              +     ' style="width:auto;flex:0 0 auto;margin:0 0 0 auto;padding:8px 16px">' + (RPL.sending[t.key] ? 'Sending…' : 'Reply') + '</button>'
              + '</div>'
              /* ── the conversation, newest first, each side shaded differently ─────────────────────────────── */
              + '<div style="border-top:1px solid var(--line-soft,#f0efec);margin-top:11px;padding-top:5px"></div>'
              + (full === undefined ? '<div style="font-size:var(--fs-2);color:var(--grey);padding:4px 0"><span class="spin"></span> reading the conversation…</div>'
                 : full === null ? '<div style="font-size:var(--fs-2);color:var(--disp);padding:4px 0">Could not read the rest of this conversation — the newest message is above.</div>'
                 /**
                  * ⭐ NEWEST FIRST — Athi, 2026-08-15: *"latest message on top, reverse order."*
                  *
                  * ⚠️ AND IT MATCHES THE LIST ABOVE IT. The inbox is newest-first; a thread that opened
                  * oldest-first made the eye travel to the bottom to find the thing the row had just previewed —
                  * two reading directions on one screen, and the reply box is at the bottom anyway.
                  */
                 : full.slice().reverse().map(function(x){
                     var mine = msgIsMine(x);
                     return '<div style="margin:6px 0;padding:8px 11px;border-radius:9px;font-size:var(--fs-2);line-height:1.5;'
                       + (mine ? 'background:var(--blue-tint-bg);margin-inline-start:28px' : 'background:var(--warn-tint);margin-inline-end:28px') + ';color:var(--on-card)">'
                       + '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:2px">'
                       +   '<b style="font-size:var(--fs-1);color:' + (mine ? 'var(--blue-2)' : 'var(--warn-2)') + '">' + esc(mine ? 'You' : (x.sender_display_name || '—')) + '</b>'
                       +   '<span style="margin-inline-start:auto;font-size:var(--fs-1);color:var(--grey)">' + esc(msgWhen(x.created_at)) + '</span></div>'
                       + '<div style="white-space:pre-wrap">' + esc(x.message_text || '') + '</div></div>';
                   }).join(''))
              + '</div>' : '')
          + '</div>';
      }).join('');
    }
  }

  var n = msgUnread();
  return '<div style="flex:1;min-height:0;overflow-y:auto;padding-bottom:var(--scroll-tail)">'
    + '<div style="padding:13px 16px;border-bottom:1px solid var(--line)">'
    +   '<div style="font-weight:700;font-size:var(--fs-4)">Messages' + (n ? ' <span style="font-size:var(--fs-2);color:var(--blue-2)">· ' + n + ' new</span>' : '') + '</div>'
    +   '<div style="font-size:var(--fs-2);color:var(--grey);margin-top:2px">One conversation per line, across every chit. Read and reply here.</div>'
    + '</div>'
    /* ── segregate by track ─────────────────────────────────────────────────────────────────────────────────
       ⚠️ THE COUNTS ARE ON THE CHIPS. A filter that does not say how much is behind it makes you click it to find
       out, and clicking to discover there is nothing there is the interaction people remember. */
    + '<div style="display:flex;gap:7px;align-items:center;padding:8px 16px;border-bottom:1px solid var(--line-soft,#eee);flex-wrap:wrap">'
    +   ['', 'order', 'task'].map(function(k){
          var on = RPL.track === k;
          var n = k ? (RPL.data || []).filter(function(m){ return m.track === k; }).length : (RPL.data || []).length;
          var lbl = k ? ((RPLTRACK[k].icon) + ' ' + RPLTRACK[k].label) : 'All';
          return '<span data-testid="msg-track-' + (k || 'all') + '" onclick="rplTrack(&quot;' + k + '&quot;)"'
            + ' title="' + esc(k ? RPLTRACK[k].hint : 'every conversation') + '"'
            + ' style="cursor:pointer;font-size:var(--fs-2);border:1px solid ' + (on ? 'var(--blue)' : 'var(--line)') + ';'
            + (on ? 'background:var(--blue);color:var(--on-accent);font-weight:700;' : '') + 'border-radius:9px;padding:3px 10px">'
            + lbl + (n ? ' <span style="opacity:.7">' + n + '</span>' : '') + '</span>';
        }).join('')
    +   '<span style="margin-inline-start:auto;font-size:var(--fs-1);color:var(--grey)">📌 keeps a conversation here after you read it</span>'
    + '</div>'
    + '<div style="display:flex;gap:14px;align-items:center;padding:8px 16px;border-bottom:1px solid var(--line)">'
    +   '<label style="display:inline-flex;align-items:center;gap:5px;font-size:var(--fs-2);cursor:pointer">'
    +     '<input type="checkbox" data-testid="msg-all" ' + (RPL.all ? 'checked' : '')
    +     ' onchange="msgShowAll()" style="width:15px;height:15px;accent-color:var(--blue)">everything, including dealt with</label>'
    + '</div>'
    + body + '</div>';
}

/**
 * ⭐ OPEN THE LINE CARD THIS CONVERSATION IS ABOUT.
 *
 * ⚠️ THE WORKLIST MAY NOT BE LOADED, AND THE LINE MAY NOT BE IN IT. wlLine() looks the row up in WL.data, which
 * is the worklist's own list — and that list deliberately excludes finished work and closed chits. A message
 * about a line you already marked done would find nothing and silently do nothing, which is the worst outcome:
 * the link looks broken rather than inapplicable.
 *
 * So: load the capability, load the worklist if it has never been fetched, look for the line — and if it is not
 * there (done, unassigned, closed), fall back to opening the ORDER rather than failing quietly.
 */
async function rplOpenLine(chit_id, line_id){
  try {
    /* ⚠️ THE FIRST CLICK IS SLOW AND MUST NOT LOOK DEAD. It loads a capability and then the whole worklist before
       it can find the row — several seconds on the cloud link, during which nothing on screen changes and the
       only reasonable conclusion is that the link is broken. Subsequent clicks are instant (WL.data is cached),
       which is exactly the pattern that makes this easy to miss in testing. */
    if (typeof WL === 'undefined' || WL.data === null) toast('Opening the line…');
    if (typeof ensureCap === 'function') await ensureCap('worklist');
    if (typeof WL !== 'undefined' && WL.data === null && typeof wlLoad === 'function') await wlLoad();
    var found = (typeof wlRows === 'function' && typeof WL !== 'undefined')
      ? wlRows(WL.data || {}).filter(function(r){ return r.line_id === line_id; })[0] : null;
    if (found && typeof wlLine === 'function') { await wlLine(line_id); return; }
    toast('That line is not on the work list any more — opening the order');
  } catch (e) { /* fall through to the order */ }
  rplOpenChit(chit_id);
}

/* Opening the order reuses the chit opener when it is loaded, and falls back to plain nav. */
function rplOpenChit(chit_id){
  if (typeof openChit2 === 'function' && typeof ensureCap === 'function') {
    ensureCap('chit2').then(function(){ openChit2(chit_id); });
  } else if (typeof openChit === 'function') { openChit(chit_id); }
}
