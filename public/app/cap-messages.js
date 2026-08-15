/* app/cap-messages.js — REPLIES: every external message that still wants you, across every chit. Lazy.
 *
 * Athi, 2026-08-15: *"is there any way we can bring all the external messages under one tab, which are not read
 * yet … maybe we have to make an icon to retain the message in the tab. Read, reply etc should be done there
 * only."* Then: *"can we bring external new messages under rail?"*
 *
 * ⚠️ THE PER-CHIT MESSAGE ROUTE STRUCTURALLY COULD NOT ANSWER THIS. Someone with forty open orders had to open
 * forty chits to find the two that had been replied to — the counterparty's answer was reachable only by
 * guessing where it was. Same shape as the worklist: one list assembled from every chit, which is the thing a
 * per-chit API can never produce.
 *
 * ⚠️ EXTERNAL ONLY, AND NEVER MY OWN WORDS. Internal notes stay on their line (they are team-private and belong
 * beside the work); and an inbox that listed what I sent would be a sent-box wearing an unread badge, with a
 * count that never falls.
 */
/**
 * ⚠️ NOT `MSG`. app.html already owns a global `const MSG` — the copy strings every toast reads from — so
 * declaring one here threw "Identifier 'MSG' has already been declared" at load. The script tag still fired
 * onload, so CAP_LOADED said true, messagesScreen stayed undefined, and the router quietly fell through to the
 * "on the build roadmap" stub. A finished screen looked unbuilt, and nothing anywhere said why.
 */
var RPL = { data: null, busy: false, err: null, all: false, open: {}, sending: {} };

if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    msgInbox: { m: 'GET',  p: '/api/folders/messages', ok: 'y' },
    msgMark:  { m: 'POST', p: '/api/folders/messages/:id/mark', ok: 'y' },
    msgReply: { m: 'POST', p: '/api/chits/:id/messages', ok: 'y' },
  });
}

async function loadMessages(){
  RPL.busy = true; RPL.err = null; msgPaint();
  try {
    var r = await api('msgInbox', RPL.all ? { query: { all: 1 } } : {});
    RPL.data = (r && (r.messages || r.items || (Array.isArray(r) ? r : []))) || [];
  } catch (e) { RPL.err = (e && e.message) || 'Could not read your messages.'; }
  RPL.busy = false; msgPaint();
}
function msgPaint(){ var el = document.getElementById('mainbody'); if (el) el.innerHTML = messagesScreen(); }
function msgShowAll(){ RPL.all = !RPL.all; RPL.data = null; loadMessages(); }

/** The unread badge the rail shows. Counts what is genuinely NEW — kept-but-read messages are not news. */
function msgUnread(){ return (RPL.data || []).filter(function(m){ return !m.read_at; }).length; }

/**
 * ⚠️ OPENING IS READING. A separate "mark read" button means an inbox where the count only falls if you remember
 * to press something, and it stops matching what you have actually seen within a day.
 */
async function msgOpen(id){
  RPL.open[id] = !RPL.open[id];
  msgPaint();
  if (!RPL.open[id]) return;
  var m = (RPL.data || []).filter(function(x){ return x.message_id === id; })[0];
  if (!m || m.read_at) return;
  try { await api('msgMark', { params: { id: id }, body: { read: true } }); m.read_at = new Date().toISOString(); msgPaint(); }
  catch (e) { /* reading is not worth an error toast — the message is open, which is what was wanted */ }
}
/**
 * ⭐ KEEP — Athi: *"maybe we have to make an icon to retain the message in the tab."*
 *
 * ⚠️ SEPARATE FROM UNREAD, DELIBERATELY (b156). Marking something unread again to keep it would make "new" and
 * "unfinished" the same word, after which the tab cannot tell a message that just arrived from one you have been
 * sitting on for a week.
 */
async function msgKeep(id, ev){
  if (ev) ev.stopPropagation();
  var m = (RPL.data || []).filter(function(x){ return x.message_id === id; })[0];
  if (!m) return;
  var to = !m.kept;
  try { await api('msgMark', { params: { id: id }, body: { kept: to } }); m.kept = to; msgPaint();
        toast(to ? 'Kept — it stays in this tab' : 'Released'); }
  catch (e) { toast((e && e.message) || 'Could not change that'); }
}
async function msgSend(id){
  var m = (RPL.data || []).filter(function(x){ return x.message_id === id; })[0];
  if (!m) return;
  var el = document.getElementById('msg_reply_' + id);
  var txt = el ? String(el.value).trim() : '';
  if (!txt) { toast('Nothing to send'); return; }
  RPL.sending[id] = true; msgPaint();
  try {
    /* ⚠️ THE REPLY CARRIES line_id THROUGH. A reply that lost it would land on the chit as a loose remark while
       the question it answers sits under a line — and the line card would never show the answer. */
    await api('msgReply', { params: { id: m.chit_id },
      body: { message_text: txt, thread_type: 'external', line_id: m.line_id || undefined } });
    RPL.sending[id] = false;
    toast('Sent — they can see it on their copy');
    await loadMessages();
  } catch (e) { RPL.sending[id] = false; msgPaint(); toast((e && e.message) || 'Could not send that'); }
}

function msgWhen(s){
  if (!s) return '';
  try {
    var d = new Date(s), now = new Date();
    var mins = Math.round((now - d) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    if (mins < 60 * 24) return Math.round(mins / 60) + 'h ago';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch (e) { return String(s).slice(0, 10); }
}

function messagesScreen(){
  var body;
  if (RPL.busy && !RPL.data) body = '<div style="padding:18px 16px;color:var(--grey);font-size:12.5px"><span class="spin"></span> checking for replies…</div>';
  else if (RPL.err) body = '<div style="padding:18px 16px;color:#c0453b;font-size:12.5px">' + esc(RPL.err) + '</div>';
  else {
    var rows = RPL.data || [];
    if (!rows.length) {
      /* ⚠️ TWO DIFFERENT EMPTIES. "Nothing new" and "nothing at all, ever" are different states and the second
         is worth saying plainly, or a first-time user reads an empty screen as a failure. */
      body = '<div style="padding:22px 16px;color:var(--grey);font-size:13px;line-height:1.6">'
        + (RPL.all ? 'No messages from anyone yet. When a counterparty replies on a chit, it lands here.'
                   : 'Nothing new. Replies from the other party appear here — tick “everything” to see the ones you have already dealt with.')
        + '</div>';
    } else {
      body = rows.map(function(m){
        var open = !!RPL.open[m.message_id];
        var isNew = !m.read_at;
        /**
         * ⭐ A CLOSED CHIT IS MARKED, NOT HIDDEN. A message arriving on a completed or cancelled order is often
         * the most important one in the inbox — "you marked it complete but the dal never came" arrives exactly
         * then. Hiding it would hide the one that needed answering; showing the state tells you what you are
         * walking into before you reply.
         */
        var closed = ['completed', 'cancelled', 'rejected'].indexOf(m.chit_status) >= 0;
        var where = esc(m.manual_subject || m.auto_subject || 'chit')
          + (closed ? ' <span style="font-size:10.5px;font-weight:700;color:#b0641c;background:#fdf4e9;border-radius:4px;padding:1px 5px">' + esc(m.chit_status) + '</span>' : '')
          + (m.particulars ? ' · <b>' + esc(m.particulars) + '</b>' : '');
        return '<div data-testid="msg-row" style="border-bottom:1px solid var(--line);' + (isNew ? 'background:#f7fbff;' : '') + '">'
          + '<div onclick="msgOpen(&quot;' + m.message_id + '&quot;)" style="cursor:pointer;padding:11px 14px;display:flex;gap:10px;align-items:baseline">'
          +   '<span style="width:8px;flex:none">' + (isNew ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2c5aa0"></span>' : '') + '</span>'
          +   '<div style="flex:1;min-width:0">'
          +     '<div style="display:flex;gap:8px;align-items:baseline">'
          +       '<b style="font-size:13.5px' + (isNew ? ';font-weight:800' : '') + '">' + esc(m.sender_display_name || '—') + '</b>'
          +       '<span style="font-size:11.5px;color:var(--grey);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + where + '</span>'
          +       '<span style="font-size:11.5px;color:var(--grey);flex:none">' + esc(msgWhen(m.created_at)) + '</span>'
          +     '</div>'
          /* Closed, one line of it — enough to know whether to open, never enough to skip opening. */
          +     '<div style="font-size:13px;color:var(--ink-2,#41474e);margin-top:3px;' + (open ? 'white-space:pre-wrap' : 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap') + '">'
          +       esc(m.message_text || '') + '</div>'
          +   '</div>'
          +   '<span data-testid="msg-keep" onclick="msgKeep(&quot;' + m.message_id + '&quot;,event)" title="' + (m.kept ? 'Kept in this tab — click to release' : 'Keep this in the tab after reading') + '"'
          +     ' style="flex:none;cursor:pointer;font-size:14px;opacity:' + (m.kept ? '1' : '.35') + '">📌</span>'
          + '</div>'
          + (open ? '<div style="padding:0 14px 13px 32px">'
              + '<textarea id="msg_reply_' + m.message_id + '" data-testid="msg-reply" rows="2" placeholder="Reply to ' + esc(m.sender_display_name || 'them') + '…"'
              +   ' style="width:100%;box-sizing:border-box;font:inherit;font-size:14px;line-height:1.5;padding:9px 11px;border:1px solid var(--line);border-radius:8px;resize:vertical"></textarea>'
              + '<div style="display:flex;gap:8px;align-items:center;margin-top:7px">'
              +   '<span onclick="wlOpenChit(&quot;' + m.chit_id + '&quot;)" style="cursor:pointer;font-size:12px;color:var(--blue)">Open the order</span>'
              +   '<button class="btn pri" data-testid="msg-send" onclick="msgSend(&quot;' + m.message_id + '&quot;)"'
              +     ' style="width:auto;flex:0 0 auto;margin:0 0 0 auto;padding:8px 16px">' + (RPL.sending[m.message_id] ? 'Sending…' : 'Reply') + '</button>'
              + '</div>'
              /* Said every time, in the same words as the line card — one sentence, two screens, no ambiguity. */
              + '<div style="margin-top:6px;font-size:11.5px;color:#b0641c">📤 The other party sees this, on their own copy.</div>'
              + '</div>' : '')
          + '</div>';
      }).join('');
    }
  }

  var n = msgUnread();
  return '<div style="flex:1;min-height:0;overflow-y:auto">'
    + '<div style="padding:13px 16px;border-bottom:1px solid var(--line)">'
    +   '<div style="font-weight:700;font-size:16px">Replies' + (n ? ' <span style="font-size:12.5px;color:#2c5aa0">· ' + n + ' new</span>' : '') + '</div>'
    +   '<div style="font-size:12px;color:var(--grey);margin-top:2px">What the other party said, across every chit. Read and reply here.</div>'
    + '</div>'
    + '<div style="display:flex;gap:14px;align-items:center;padding:8px 16px;border-bottom:1px solid var(--line)">'
    +   '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;cursor:pointer">'
    +     '<input type="checkbox" data-testid="msg-all" ' + (RPL.all ? 'checked' : '')
    +     ' onchange="msgShowAll()" style="width:15px;height:15px;accent-color:var(--blue)">everything, including dealt with</label>'
    +   '<span style="margin-left:auto;font-size:11.5px;color:var(--grey)">📌 keeps a message here after you read it</span>'
    + '</div>'
    + body + '</div>';
}

/* Opening the order from here reuses the worklist's opener when it is loaded, and falls back to plain nav. */
function wlOpenChit(chit_id){
  if (typeof openChit2 === 'function' && typeof ensureCap === 'function') {
    ensureCap('chit2').then(function(){ openChit2(chit_id); });
  } else if (typeof openChit === 'function') { openChit(chit_id); }
}
