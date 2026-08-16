/* app/attach-ui.js — ATTACH + VIEW, as a helper any screen can reuse.  (classic script, shared global scope)
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * Attachments have worked on the chit screen since b66, but the logic lives inside public/app.html —
 * attType() (5224), mapAtt() (5229), attsVis() (5206), fileToB64() (5230), attUpload() (5231),
 * attBlobUrl() (5233), chitAttBlock() (5773). The Messages screen (app/cap-messages.js) now wants the same
 * behaviour, and the line card in app/cap-worklist.js is the likely next asker. Three copies of a base64
 * upload path is three places to get the 6 MB cap, the MIME mapping, or the audience rule wrong.
 *
 * So: ONE surface, five functions, no state the caller has to own.
 *
 *   cbAttachList(atts, opts)   → HTML for attachments that already exist (icon, name, type · size, click to open)
 *   cbAttachButton(ctx)        → HTML for an "attach a file" control; ctx = { chit_id, message_id?, line_index? }
 *   cbAttachPick(ctxJson)      → open a file picker, read to base64, POST, toast; resolves with the new attachment
 *   cbAttachOpen(id)           → fetch one attachment's bytes (auth'd) and open or download it
 *   cbAttachType(mime, name)   → the icon/type mapping — the SINGLE source, moved out of app.html
 *
 * ⚠️ THE API IS CORRECT AND IS NOT REIMPLEMENTED HERE.
 *   POST /api/attachments  { chit_id, message_id?, line_index?, name, mime, data_base64 }
 *   GET  /api/attachments/:id
 * This file is a UI skin over those two routes and nothing else.
 *
 * ⚠️⚠️ WHO CAN SEE AN ATTACHMENT — READ THIS BEFORE CHANGING ANYTHING BELOW.
 * The SERVER decides the audience, entirely, from the row the attachment is pinned to
 * (chitbridge-api/routes/attachments.js, lines 19-30):
 *   · pinned to a CHIT (or a line)      → replicated per-entity to every participant on the caller's roster;
 *   · pinned to a MESSAGE that is INTERNAL (chit_messages.visibility_entity_id is set)
 *                                       → ONE copy, for that entity ALONE.
 * AN ATTACHMENT INHERITS ITS MESSAGE'S AUDIENCE. There is no widening move, and this UI must never offer,
 * imply, or attempt one — no "share with all parties" toggle, no re-post of the same bytes against the chit
 * to reach a wider audience. If a screen needs a file the other party can see, it attaches it to something
 * the other party can see; that is a choice made when the message is composed, not afterwards here.
 * The read side is symmetric: GET is entity-scoped through RLS (storage.getBlob), so a caller only ever
 * receives its OWN copy. cbAttachList therefore renders exactly what the server handed this entity — it
 * never filters, and it never claims a wider set than it was given.
 */

/**
 * ⚠️ ONE NAMESPACE OBJECT, PREFIXED, BECAUSE A COLLIDING `var` IN A CAP FILE IS A SILENT SCREEN FAILURE.
 * app.html owns a large global surface (UI, CC, CFG, SESSION, MSG, EP, …). A cap file that redeclares one of
 * those throws at parse/eval time — the <script> tag still fires onload, the loader believes the capability
 * arrived, and the screen renders its "build roadmap" stub with no error anywhere near the cause. That bug
 * cost hours on 2026-08-15. Every name this file introduces therefore carries a cbAttach / CBATT prefix, and every
 * one of them was greped for across app.html and public/app/*.js before being written (zero hits, all ten).
 */
var CBATT = {
  /* Matches MAX_BYTES in routes/attachments.js (6 MB). Kept client-side so an oversized file is refused in the
     picker rather than base64-inflated by ~33% and pushed over the wire only to come back 413. */
  maxBytes: 6 * 1024 * 1024,
  /* id → object URL. Bytes are pulled ON DEMAND and then cached, so opening the same file twice is free.
     Deliberately never revoked: the URLs live as long as the page, and revoking one that a still-open tab is
     displaying blanks that tab. */
  urls: {},
  busy: false
};

/* ── the API row ──────────────────────────────────────────────────────────────────────────────────────────
 * app.html already registers `attUpload` on EP (app.html:693) against this exact route, so the first choice is
 * to REUSE it rather than add a second name for one endpoint. The fallback row exists only so this helper still
 * works if it is ever loaded on a page that has not registered it; the key is cbAtt-prefixed so it can never
 * shadow the host's row.  (GET needs no EP entry — api() parses JSON, and an attachment is bytes; see
 * cbAttachOpen, which fetches directly, exactly as app.html:5233 does.) */
if (typeof EP !== 'undefined' && EP && !EP.attUpload) {
  EP.cbAttUpload = { m: 'POST', p: '/api/attachments', ok: 'y' };
}
function cbAttachEP(){ return (typeof EP !== 'undefined' && EP && EP.attUpload) ? 'attUpload' : 'cbAttUpload'; }

/**
 * cbAttachType(mime, name) → 'image'|'video'|'pdf'|'text'|'xlsx'|'docx'|'zip'|'doc'
 *
 * Moved verbatim from app.html:5224 so there is ONE mapping. The two carried-over decisions:
 *   ⚠️ TEXT IS READABLE, SO IT IS ITS OWN TYPE. It used to fall through to 'doc', which offers a DOWNLOAD — and
 *      the commonest text attachment on the rail is the original inbound message, kept as evidence precisely so
 *      someone can check the lines against it. Making them download a file to read one sentence defeats it.
 *   ⚠️ THE FILENAME IS CONSULTED, NOT JUST THE MIME. Files arriving off a channel routinely carry
 *      application/octet-stream, so extension is the only signal left.
 */
function cbAttachType(mime, name){
  mime = String(mime || '').toLowerCase();
  name = String(name || '').toLowerCase();
  if (mime.indexOf('image/') === 0) return 'image';
  if (mime.indexOf('video/') === 0) return 'video';
  if (mime === 'application/pdf' || /\.pdf$/.test(name)) return 'pdf';
  if (mime.indexOf('text/') === 0 || /\.(txt|md|log)$/.test(name)) return 'text';
  if (/sheet|excel|csv/.test(mime) || /\.(xlsx|xls|csv)$/.test(name)) return 'xlsx';
  if (/word|document/.test(mime) || /\.(docx|doc)$/.test(name)) return 'docx';
  if (/zip|compress/.test(mime) || /\.zip$/.test(name)) return 'zip';
  return 'doc';
}

/* The glyph per type. 'text' is present ON PURPOSE — app.html once taught attType about text and forgot this
   map, so a .txt fell through to 📎 and the tile read "attachment" for the one file on the chit that was the
   customer's own words. */
function cbAttachIcon(t){
  return ({ image: '🖼️', video: '🎬', pdf: '📄', text: '📄', xlsx: '📊', csv: '📊',
            docx: '📝', doc: '📝', ppt: '📑', zip: '🗜️' })[t] || '📎';
}

function cbAttachSize(b){
  b = +b || 0;
  if (b < 1024) return b + ' B';
  if (b < 1048576) return Math.round(b / 1024) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

/**
 * Normalise one row to a single internal shape, so a caller may pass EITHER
 *   the raw server row  { id, name, mime, size, message_id, line_index }   (routes/chits.js:2060, storage.listFor*)
 *   or app.html's mapped form { id, n, t, mime, size }                     (mapAtt, app.html:5229)
 * without having to know which one it is holding. Nothing is invented: a row with no id is dropped, because a
 * tile that cannot be opened is worse than no tile.
 */
function cbAttachNorm(a){
  if (!a || a.id == null) return null;
  var name = a.n || a.name || 'file';
  return { id: a.id, name: name, mime: a.mime || '', size: a.size || 0,
           t: a.t || cbAttachType(a.mime, name) };
}

/**
 * ⚠️ IDS GO INTO AN HTML ATTRIBUTE AND THEN INTO A JS STRING, SO THEY ARE WHITELISTED, NOT ESCAPED.
 * esc() (app/helpers.js:9) escapes < > " & — it does NOT escape the single quote, and the inline handlers this
 * file emits use single quotes for the JS string literal inside a double-quoted attribute. Rather than reason
 * about two layers of quoting on server-supplied text, the only values that reach a handler are ids, which are
 * uuids/integers: anything outside [A-Za-z0-9_.:-] is stripped. A malformed id then produces a dead control
 * instead of an injection, which is the correct direction to fail in.
 */
function cbAttachSafe(v){ return String(v == null ? '' : v).replace(/[^A-Za-z0-9_.:-]/g, ''); }

/**
 * cbAttachList(atts, opts) → HTML string. Returns '' when there is nothing (and no opts.empty), so a caller can
 * concatenate it unconditionally.
 *
 * opts = {
 *   title  : string  — a small heading above the row, e.g. '📎 Attached'. Omit for a bare row.
 *   empty  : string  — what to say when the list is empty. Default: render nothing at all.
 *   note   : string  — one line under the row. Use it to state the AUDIENCE in the caller's own words.
 *   compact: bool    — chips (default, right for a message) vs. slightly roomier rows.
 * }
 *
 * ⚠️ THIS RENDERS WHAT THE SERVER GAVE THIS ENTITY AND NOTHING MORE. The GET is RLS-scoped to the caller's own
 * copy, so an attachment that is not in `atts` is not "hidden" by the UI — it does not exist for this entity.
 * There is deliberately no control here to widen, re-share or re-post an attachment; see the audience note at
 * the top of this file.
 */
function cbAttachList(atts, opts){
  opts = opts || {};
  var rows = (atts || []).map(cbAttachNorm).filter(Boolean);
  if (!rows.length) {
    return opts.empty
      ? '<div style="font-size:11.5px;color:var(--grey);padding:2px 0">' + esc(opts.empty) + '</div>'
      : '';
  }
  var pad = opts.compact === false ? '5px 10px' : '3px 8px';
  var html = rows.map(function(a){
    /* The name is truncated for the row but kept whole in the tooltip — a filename is often the only thing that
       distinguishes two invoices, and an ellipsis that eats the distinguishing half is a list that lies. */
    var short = a.name.length > 26 ? a.name.slice(0, 26) + '…' : a.name;
    var meta  = (a.t || 'file').toUpperCase() + (a.size ? (' · ' + cbAttachSize(a.size)) : '');
    return '<span data-testid="cb-attach-item" onclick="cbAttachOpen(\'' + cbAttachSafe(a.id) + '\')"'
      + ' title="' + esc(a.name + ' — ' + meta) + '"'
      + ' style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;border:1px solid var(--line);'
      + 'border-radius:6px;padding:' + pad + ';margin:0 5px 5px 0;font-size:11.5px;background:#fff;max-width:100%">'
      +   '<span style="font-size:12px;flex:none">' + cbAttachIcon(a.t) + '</span>'
      +   '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(short) + '</span>'
      +   '<span style="font-size:11px;color:var(--grey);flex:none">' + esc(meta) + '</span>'
      + '</span>';
  }).join('');

  return (opts.title ? '<div style="font-size:11.5px;color:var(--grey);margin:6px 0 4px">' + esc(opts.title)
                       + ' · ' + rows.length + '</div>' : '')
    + '<div data-testid="cb-attach-list" style="display:flex;flex-wrap:wrap;align-items:center">' + html + '</div>'
    + (opts.note ? '<div style="font-size:11px;color:#b0641c;margin-top:2px">' + esc(opts.note) + '</div>' : '');
}

/**
 * cbAttachButton(ctx) → HTML for one "attach a file" control.
 * ctx = { chit_id (required), message_id?, line_index?, label?, note?, after? }
 *   after — the NAME of a global function to call once the upload lands (e.g. 'msgPaint'). Screens here render
 *           HTML strings rather than holding element handles, so a name is the only callback that survives the
 *           trip through an attribute. Optional; the DOM event below covers listeners that prefer one.
 *
 * ⚠️ chit_id IS MANDATORY EVEN WHEN A MESSAGE IS NAMED. The server reads the roster off chit_header for the
 * caller's own copy before it will accept anything (attachments.js:20-22); a message_id alone is refused.
 *
 * ⚠️ width:auto AND margin:0 ARE NOT COSMETIC. The global rule is `.btn { width:100%; margin-top:16px }`
 * (app.html:82) — dropped into a flex row unqualified, that button eats the row and pushes everything below it
 * down by 16px. Every button this file emits overrides both.
 */
function cbAttachButton(ctx){
  ctx = ctx || {};
  if (!ctx.chit_id) return '';                     // nothing to pin to — render no control rather than a dead one
  var payload = { chit_id: cbAttachSafe(ctx.chit_id) };
  if (ctx.message_id != null && ctx.message_id !== '') payload.message_id = cbAttachSafe(ctx.message_id);
  if (ctx.line_index != null && ctx.line_index !== '') payload.line_index = cbAttachSafe(ctx.line_index);
  if (ctx.after) payload.after = cbAttachSafe(ctx.after);
  /* Whitelisted above, so the JSON holds no quote or backslash of its own; esc() then makes it attribute-safe
     and it is carried inside a single-quoted JS literal. */
  var arg = esc(JSON.stringify(payload));

  return '<button type="button" class="btn" data-testid="cb-attach-btn"'
    + ' onclick="cbAttachPick(\'' + arg + '\')"'
    + ' title="' + esc(ctx.title || 'Attach a file (max 6 MB)') + '"'
    + ' style="width:auto;flex:0 0 auto;margin:0;padding:6px 12px;font-size:11.5px;font-weight:700;'
    + 'border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);cursor:pointer">'
    + esc(ctx.label || '📎 Attach a file') + '</button>'
    + (ctx.note ? '<span style="font-size:11px;color:#b0641c;margin-left:8px">' + esc(ctx.note) + '</span>' : '');
}

/* Read one File to bare base64 (the data: prefix stripped — the server strips it too, but sending it doubles
   nothing and costs bytes). Moved from app.html:5230. */
function cbAttachB64(file){
  return new Promise(function(resolve, reject){
    var r = new FileReader();
    r.onload  = function(){ resolve(String(r.result).replace(/^data:[^;]+;base64,/, '')); };
    r.onerror = function(){ reject(new Error('Could not read that file')); };
    r.readAsDataURL(file);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *  DEFERRED MODE — attach a picture to something that does not exist yet.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Athi, 2026-08-15: *"on the cart data we can add message, picture, attachment etc"* → *"go ahead with the
 * deferred mode"*.
 *
 * `cbAttachPick` posts immediately against an existing `chit_id`. A CART LINE HAS NO CHIT — that is the whole
 * point of a cart, and it is why the sweep of compose stalled: three upload sites in app.html (2461, 2464, 5146)
 * all collect files first and upload after the chit is created, because before that there is nothing to attach
 * to. Asking someone to attach a file to a chit that does not exist yet is not a call-site change, it is a
 * different shape.
 *
 *   stage(bucket, {line_index})   pick a file and HOLD it — validated now, uploaded later
 *   staged(bucket)                what is held, for rendering chips
 *   unstage(bucket, key)          remove one before it is ever sent
 *   flush(bucket, chit_id)        upload everything held, against the chit that now exists
 *
 * ⚠️⚠️ A STAGED FILE HAS NO AUDIENCE YET, AND THAT IS THE HONEST STATE — not a gap to paper over. The server
 * derives who gets a copy from the row the attachment is pinned to, and until the chit exists there is no row.
 * So nothing here may promise, display, or imply an audience. It is a file on your machine that you INTEND to
 * attach; the audience is decided at flush, by what it is pinned to, exactly as for an immediate upload.
 *
 * ⚠️⚠️ VALIDATION HAPPENS AT STAGE TIME, NOT AT FLUSH. Refusing a 9 MB photo the moment it is chosen is the
 * whole reason the size check lives client-side. Discovering it at flush would mean the chit has ALREADY BEEN
 * SENT and the evidence silently did not go with it — the worst possible moment to find out.
 */
CBATT.stage = {};      /* bucket -> [{ key, file, line_index, name, size, mime }] */
CBATT.stageSeq = 0;

function cbAttachStaged(bucket){ return (CBATT.stage[bucket] || []).slice(); }
function cbAttachClearStage(bucket){ delete CBATT.stage[bucket]; }
function cbAttachUnstage(bucket, key){
  var list = CBATT.stage[bucket] || [];
  CBATT.stage[bucket] = list.filter(function (s) { return String(s.key) !== String(key); });
  try { document.dispatchEvent(new CustomEvent('cb-attach-staged', { detail: { bucket: bucket } })); } catch (_) {}
}

/**
 * stage — choose a file now, send it later. Returns the staged entry, or null if cancelled/refused.
 *
 * ⚠️ THE SAME LIMITS AS AN IMMEDIATE UPLOAD, APPLIED HERE. A staged file that is too large is refused at the
 * picker; it must never be discovered at flush, when the chit is already gone.
 */
async function cbAttachStage(bucket, opts){
  opts = opts || {};
  var file = await cbAttachChoose();
  if (!file) return null;                                  // cancelled — silent, cancelling is not an error
  if (file.size > CBATT.maxBytes) {
    toast('"' + file.name + '" is ' + cbAttachSize(file.size) + ' — the limit is ' + cbAttachSize(CBATT.maxBytes) + '. Send a smaller copy.');
    return null;
  }
  if (!file.size) { toast('"' + file.name + '" is empty'); return null; }

  var entry = { key: 'stg' + (++CBATT.stageSeq), file: file, name: file.name, size: file.size,
                mime: file.type || 'application/octet-stream',
                line_index: (opts.line_index == null || opts.line_index === '' || isNaN(+opts.line_index))
                  ? null : +opts.line_index };
  (CBATT.stage[bucket] = CBATT.stage[bucket] || []).push(entry);
  /* ⚠️ The File object is held, NOT its base64. Encoding several photos up front would put three times their
     size in memory for as long as the compose modal is open, for bytes that may never be sent. Encode at flush,
     one at a time. */
  try { document.dispatchEvent(new CustomEvent('cb-attach-staged', { detail: { bucket: bucket, entry: entry } })); } catch (_) {}
  return entry;
}

/**
 * ⭐ flush — the chit now exists; send what was held.
 *
 * Returns { uploaded: [att], failed: [{name, why}] } and NEVER THROWS, because the chit has already been sent by
 * the time this runs and an exception here would surface as "your chit failed" when it did not.
 *
 * ⚠️⚠️ FAILURES ARE REPORTED AND THE FILES ARE KEPT STAGED. The tempting shortcut is to clear the bucket at the
 * end regardless — but a chit that exists while its evidence does not is precisely the broken promise this
 * codebase keeps refusing (see storage-object.js: an attachment row whose bytes never landed). Keeping the
 * failures staged means a retry is possible; clearing them means the photo is gone and nobody knows.
 *
 * ⚠️ SEQUENTIAL, NOT Promise.all. Each file is a base64 body up to 6 MB; firing five at once on a phone
 * connection is how one of them times out and takes an unrelated one with it. Slower and finishable beats
 * parallel and partly lost.
 */
async function cbAttachFlush(bucket, chit_id, opts){
  opts = opts || {};
  var list = CBATT.stage[bucket] || [];
  if (!list.length) return { uploaded: [], failed: [] };
  if (!chit_id) return { uploaded: [], failed: list.map(function (s) { return { name: s.name, why: 'no chit to attach to' }; }) };

  var uploaded = [], failed = [], kept = [];
  for (var i = 0; i < list.length; i++) {
    var s = list[i];
    try {
      var body = { chit_id: chit_id, name: s.name, mime: s.mime, data_base64: await cbAttachB64(s.file) };
      if (s.line_index != null) body.line_index = s.line_index;
      if (opts.message_id != null) body.message_id = opts.message_id;
      uploaded.push(await api(cbAttachEP(), { body: body }));
    } catch (e) {
      failed.push({ name: s.name, why: (e && e.message) || 'upload failed' });
      kept.push(s);                                   /* keep it — a retry must still be possible */
    }
  }
  if (kept.length) CBATT.stage[bucket] = kept; else delete CBATT.stage[bucket];

  /* ⚠️ SAID OUT LOUD. A partial failure that only appears in a return value is a partial failure nobody sees. */
  if (failed.length) {
    toast(failed.length + ' of ' + list.length + ' file(s) did not attach — they are still here, try again.');
  }
  try { document.dispatchEvent(new CustomEvent('cb-attach-flushed', { detail: { bucket: bucket, chit_id: chit_id, uploaded: uploaded, failed: failed } })); } catch (_) {}
  return { uploaded: uploaded, failed: failed };
}

/** Chips for what is staged — the same shape cbAttachList renders, but for files that have no id yet. */
function cbAttachStagedChips(bucket, opts){
  opts = opts || {};
  cbAttachCss();
  var list = CBATT.stage[bucket] || [];
  if (!list.length) return '';
  return list.filter(function (s) {
    return opts.line_index == null ? true : String(s.line_index) === String(opts.line_index);
  }).map(function (s) {
    return '<span class="cbatt-chip" data-testid="cbatt-staged">'
      + cbAttachIcon(cbAttachType(s.mime, s.name)) + ' ' + cbAttachSafeText(s.name)
      + ' <span style="color:#6a707a">' + cbAttachSize(s.size) + '</span>'
      /* ⚠️ "not sent yet" is said on the chip, not implied by its position. A staged file looks exactly like an
         attached one otherwise, and the difference matters: one is evidence, the other is an intention. */
      + ' <span style="font-size:11px;color:#8a5a1e">not sent yet</span>'
      + ' <span onclick="cbAttachUnstage(\'' + cbAttachSafe(bucket) + '\',\'' + cbAttachSafe(s.key) + '\')"'
      + ' style="cursor:pointer;color:#9aa3a7;font-weight:800" title="Remove">✕</span></span>';
  }).join('');
}
/* ⚠️ NOT cbAttachSafe. That one strips to [A-Za-z0-9_.:-] and is for values going into an ATTRIBUTE or an inline
   handler; using it on a filename would silently mangle "வெங்காயம் bill.pdf" into something unrecognisable. Text
   in the document body needs escaping, not stripping — two different jobs, two different functions. */
function cbAttachSafeText(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* One style tag, injected once — attach-ui had none because every previous caller styled its own chips. */
function cbAttachCss(){
  if (typeof document === 'undefined' || document.getElementById('cbatt_css')) return;
  var s = document.createElement('style');
  s.id = 'cbatt_css';
  s.textContent = '.cbatt-chip{display:inline-flex;align-items:center;gap:5px;border:1px dashed #c9a86a;'
    + 'border-radius:9px;padding:3px 8px;margin:2px 5px 2px 0;font-size:11.5px;background:#fdfaf3;'
    + 'color:var(--ink,#0F2E3D);max-width:100%}'
    + '.cbatt-chip.sent{border-style:solid;border-color:#e3e6ea;background:#fff}';
  (document.head || document.documentElement).appendChild(s);
}

/**
 * cbAttachPick(ctxJson) → Promise resolving to the new attachment { id, name, mime, size }, or null if the
 * person cancelled or the upload failed (failures toast; the caller does not have to catch).
 *
 * ctxJson is the JSON string cbAttachButton emitted; an object is accepted too, for callers wiring this in JS.
 *
 * ⚠️ THE AUDIENCE IS NOT A PARAMETER. Whatever ctx names — chit, line, or message — the server derives who gets
 * a copy, and an attachment on an internal message stays with that entity alone. Nothing here can change that
 * and nothing here should try; see the top of the file.
 */
async function cbAttachPick(ctxJson){
  var ctx;
  try { ctx = (typeof ctxJson === 'string') ? JSON.parse(ctxJson) : (ctxJson || {}); }
  catch (e) { toast('Could not start the upload'); return null; }
  if (!ctx.chit_id) { toast('Nothing to attach this to'); return null; }

  /* ⚠️ ONE UPLOAD AT A TIME. Two pickers open at once produce two toasts racing over one screen repaint, and the
     second overwrites the first's "done" with its own "uploading…". */
  if (CBATT.busy) { toast('One file is still uploading — one moment'); return null; }

  var file = await cbAttachChoose();
  if (!file) return null;                       // cancelled — silent, because cancelling is not an error

  /* ⚠️ REFUSED HERE, NOT AT THE SERVER. base64 inflates by about a third, so a 9 MB file becomes a 12 MB request
     that is read, encoded, and posted in full before the 413 comes back — on a phone connection that is a long
     wait for a rejection that was knowable before the first byte moved. Same 6 MB ceiling as MAX_BYTES. */
  if (file.size > CBATT.maxBytes) {
    toast('"' + file.name + '" is ' + cbAttachSize(file.size) + ' — the limit is ' + cbAttachSize(CBATT.maxBytes) + '. Send a smaller copy.');
    return null;
  }
  if (!file.size) { toast('"' + file.name + '" is empty'); return null; }

  CBATT.busy = true;
  toast('Attaching "' + file.name + '"…');
  try {
    var body = { chit_id: ctx.chit_id, name: file.name,
                 mime: file.type || 'application/octet-stream',
                 data_base64: await cbAttachB64(file) };
    if (ctx.message_id != null) body.message_id = ctx.message_id;
    /* line_index arrives as a string through the attribute; the route parseInt's it, but a NaN would silently
       become null and detach the file from its line, so it is checked here. */
    if (ctx.line_index != null && ctx.line_index !== '' && !isNaN(+ctx.line_index)) body.line_index = +ctx.line_index;

    var att = await api(cbAttachEP(), { body: body });
    CBATT.busy = false;
    toast('Attached "' + file.name + '"');

    /* Two ways to hear about it, because the two consumers differ: screens that render HTML strings pass a
       function NAME through the attribute, and anything holding real elements can listen for the event. */
    try { document.dispatchEvent(new CustomEvent('cb-attach-added', { detail: { ctx: ctx, attachment: att } })); } catch (_) {}
    if (ctx.after && typeof window[ctx.after] === 'function') { try { window[ctx.after](); } catch (_) {} }
    return att;
  } catch (e) {
    CBATT.busy = false;
    toast((e && e.message) || 'Could not attach that file');
    return null;
  }
}

/**
 * Open a native file picker and resolve with the chosen File (or null).
 *
 * ⚠️ CREATED, CLICKED, AND THROWN AWAY rather than rendered as a hidden <input> beside the button. These screens
 * repaint by replacing innerHTML wholesale; an input living in that markup is destroyed mid-dialogue on any
 * repaint that happens while the picker is open, and its change event never arrives.
 *
 * ⚠️ SINGLE FILE, ON PURPOSE — see "deliberately skipped" in the handover. The 'cancel' event resolves null so
 * the caller is not left holding a promise that never settles; browsers without it simply leave the promise
 * pending, which is harmless (the closure is collected with the page).
 */
function cbAttachChoose(){
  return new Promise(function(resolve){
    var input = document.createElement('input');
    input.type = 'file';
    input.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px';
    var done = false;
    function finish(f){ if (done) return; done = true; try { input.remove(); } catch (_) {} resolve(f || null); }
    input.addEventListener('change', function(){ finish(input.files && input.files[0]); });
    input.addEventListener('cancel', function(){ finish(null); });
    (document.body || document.documentElement).appendChild(input);
    input.click();     // inside the button's click handler, so this counts as a user gesture
  });
}

/**
 * cbAttachOpen(id) — pull the bytes on demand and show them.
 *
 * ⚠️ IT CANNOT BE A PLAIN <a href>. GET /api/attachments/:id is authenticated (Bearer), so the browser's own
 * navigation would arrive without the token and 401. Hence fetch → Blob → object URL, cached per id.
 *
 * ⚠️ ONLY IMAGES AND PDF ARE OPENED FOR VIEWING; everything else DOWNLOADS. That mirrors the server, which
 * already forces a non-renderable type down to application/octet-stream with Content-Disposition: attachment
 * and X-Content-Type-Options: nosniff (attachments.js:55-66) — the stored-XSS defence from the 2026-07-13
 * review. SVG is excluded from "renderable" on both sides, because image/svg+xml can carry inline <script>.
 * This function must never widen that set: the blob URL runs on this origin.
 */
async function cbAttachOpen(id){
  if (!id) return;
  try {
    var url = CBATT.urls[id];
    var mime = '';
    if (!url) {
      var res = await fetch(CFG.API_BASE + '/api/attachments/' + encodeURIComponent(id),
                            { headers: SESSION.token ? { Authorization: 'Bearer ' + SESSION.token } : {} });
      if (!res.ok) throw new Error(res.status === 404 ? 'That file is not on your copy of this chit' : ('Could not fetch that file (' + res.status + ')'));
      var blob = await res.blob();
      mime = String(blob.type || '').toLowerCase();
      url = URL.createObjectURL(blob);
      CBATT.urls[id] = url;
      CBATT.urls[id + ':mime'] = mime;
    } else { mime = CBATT.urls[id + ':mime'] || ''; }

    var renderable = /^image\/(png|jpe?g|gif|webp|bmp)$/.test(mime) || mime === 'application/pdf';
    if (renderable) {
      /* ⚠️ THE AWAIT ABOVE HAS ALREADY SPENT THE USER GESTURE, so window.open may be blocked. When it is, fall
         back to a download rather than doing nothing — a control that appears to be broken is worse than one
         that does the less convenient thing. */
      var w = window.open(url, '_blank', 'noopener');
      if (w) return;
    }
    var a = document.createElement('a');
    a.href = url;
    a.download = '';           // the server's Content-Disposition filename does not survive a blob URL; the
                               // browser falls back to a generic name, which is the accepted cost of auth'd bytes
    a.rel = 'noopener';
    (document.body || document.documentElement).appendChild(a);
    a.click();
    try { a.remove(); } catch (_) {}
  } catch (e) {
    toast((e && e.message) || 'Could not open that file');
  }
}
