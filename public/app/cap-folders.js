/* app/cap-folders.js — FOLDERS capability (lazy; loaded via ensureCap('folders')).
 * A per-entity TREE for organising ANY chit (mailing-model). foldersScreen() = tree (left, recursive/nestable) +
 * the selected folder's chits with Current/Archive (right). Any chit is redirected via 📁 Move (sets folder_id on
 * this entity's copy). Backend: routes/folders.js + b63. Self-registers its endpoints.
 * OWNS      the Folders screen: the tree, the Chits and Metrics tabs, the Move-to-folder sheet, _FLD (the panes' shared state) and the one repaint (_fldPaint).
 * PARTS     cap-folders-rules.js (the Rules tab: list, reorder, draft, save) · cap-folders-groupsum.js (the Group-sum pane). Plain globals, loaded after this file: ensureCap('folders') through CAP_WITH, and a <script> tag each beside this one on three pages.
 * FLOW      foldersScreen → loadFolders → pick a folder → loadFolderChits → _folderView → (Metrics: loadFolderMetrics · Rules: loadFolderRules in the rules part · Group sum: loadGroupSum in the group-sum part)
 * CARD      01-rail-core-the-chit/user-folders-and-auto-file-rules
 * CALLED BY public/accounts.html, public/crm.html, public/finance.html (a <script> tag each) · public/app.html (ensureCap('folders'))
 * IDS       every control carries its register code (data-cbsid, UX-137): SCR004, Folders, on whichever page draws it.
 */
if (typeof EP !== 'undefined') {
  Object.assign(EP, {
    foldersList: { m: 'GET', p: '/api/folders', ok: 'y' },
    folderCreate: { m: 'POST', p: '/api/folders', ok: 'y' },
    folderRename: { m: 'PATCH', p: '/api/folders/:id', ok: 'y' },
    folderDelete: { m: 'DELETE', p: '/api/folders/:id', ok: 'y' },
    folderMove: { m: 'POST', p: '/api/folders/move', ok: 'y' },
    folderChits: { m: 'GET', p: '/api/folders/:id/chits', ok: 'y' },
    // Metrics share select+measure with the counterparty scorecard, so a folder and a supplier can never
    // disagree about what "open" or "overdue" means.
    folderMetrics: { m: 'GET', p: '/api/folders/:id/metrics', ok: 'y' },
    folderRules: { m: 'GET', p: '/api/folders/:id/rules', ok: 'y' },
    folderRuleCreate: { m: 'POST', p: '/api/folders/:id/rules', ok: 'y' },
    folderRuleUpdate: { m: 'PATCH', p: '/api/folders/rules/:rule_id', ok: 'y' },
    folderRuleDelete: { m: 'DELETE', p: '/api/folders/rules/:rule_id', ok: 'y' },
    folderRulePreview: { m: 'POST', p: '/api/folders/rules/preview', ok: 'y' }, // what WOULD this rule have caught
    /* Track level — the SAME two panes opened from Task/Order itself rather than from inside a folder.
       ⚠️ Metrics reuses /reconcile rather than adding a track-metrics route: reconcile already measures every copy
       on the track AND proves the folders add up. A second endpoint returning the first half of that would be one
       more place for the same number to be computed differently. */
    folderReconcile: { m: 'GET', p: '/api/folders/reconcile', ok: 'y' }, // ?scope=task|order
    folderAllRules: { m: 'GET', p: '/api/folders/rules', ok: 'y' }, // every rule, across folders
    folderGroupSum: { m: 'GET', p: '/api/folders/groupsum', ok: 'y' }, // ?scope= &folder_id= — requirement + cost
    scorecardList: { m: 'GET', p: '/api/relationships/scorecard', ok: 'y' },
    scorecardOne: { m: 'GET', p: '/api/relationships/scorecard/:entity_id', ok: 'y' }
  });
}
/**
 * ⭐ THE FOLDER LIST NOW CARRIES THE SYSTEM FOLDERS TOO (API 2026-10-01: B-2100 Bills · Received, B-1300 Bills · Issued,
 * R-1400 Receipts … — each a VIEW whose contents are its rule's matches, plus a shop's own view folders). They are not
 * places: nothing is moved into them, and they are not sub-lists of Task or Order. So they are kept APART here, at the one
 * place the list arrives — UI.folders stays the filed folders every existing screen already reads (the rail under Task and
 * Order, Move, the rules panes, the tree) and UI.sysFolders holds the views for the Bills screen (designed first; not built).
 */
function _foldersFrom(r) {
  var all = (r && r.folders) || [];
  var view = function (f) {
    return !!(f.system || f.kind === 'view');
  };
  UI.sysFolders = all.filter(view);
  return all.filter(function (item) {
    return !view(item);
  });
}
/** fetch the folder list into UI.folders (empty on failure) and repaint in the background */
async function loadFolders() {
  try {
    var reply = await api('foldersList');
    UI.folders = _foldersFrom(reply);
  } catch (e) {
    UI.folders = [];
  }
  /* ⚠️ bgRenderApp, NOT renderApp. This runs on STARTUP as well as after a user action, and renderApp rebuilds
     the shell — including the empty #modalhost — so a folder list arriving while someone is in Compose deleted
     their draft. Measured 2026-08-18: this was the last of seven such callers. The user-initiated callers
     (folderCreate, rename, move) repaint themselves or navigate, so nothing loses a refresh it needed. */
  if (typeof bgRenderApp === 'function') bgRenderApp();
  else if (typeof renderApp === 'function') bgRenderApp();
}
/**
 * ⭐ ONE NODE OF A FOLDER TREE — the look _folderTree has always drawn (a glyph, the name, a figure at the far end, the
 * chosen one tinted), taking its words as arguments so the Ledgers tree in CB Accounts (cap-books.js bkLedgers) draws the
 * very same node: `o.depth` · `o.sel` · `o.onclick` (JS body) · `o.icon` · `o.label` (HTML) · `o.tail` (HTML, the far end) ·
 * `o.tid` (data-testid) · `o.style` (extra style, e.g. a taller tap target on a phone).
 */
function _folderNode(node) {
  return (
    '<div data-cbsid="SCR004-C01"' +
    (node.cls ? ' class="' + node.cls + '"' : '') +
    (node.tid ? ' data-testid="' + node.tid + '"' : '') +
    ' style="display:flex;align-items:center;gap:6px;padding:6px 8px;padding-inline-start:' +
    (8 + (node.depth || 0) * 15) +
    'px;border-radius:9px;cursor:pointer;font-size:var(--fs-2);' +
    (node.sel ? 'background:var(--blue-tint-bg);color:var(--blue-2);font-weight:700' : 'color:var(--ink-2)') +
    (node.style ? ';' + node.style : '') +
    '" onclick="' +
    node.onclick +
    '">' +
    node.icon +
    ' ' +
    node.label +
    '<span style="margin-inline-start:auto;font-size:var(--fs-1);color:var(--grey)">' +
    node.tail +
    '</span></div>'
  );
}
/**
 * ⭐ THE TWO-PANE LAYOUT OF A FOLDER SCREEN — tree on the left (250px), the chosen thing on the right — taking its two halves
 * as HTML. foldersScreen() and the Ledgers screen both call it; `o.cls` / `o.id` let a caller carry its own container query.
 */
function _folderPanes(treeHTML, rightHTML, o) {
  o = o || {};
  return (
    '<div' +
    (o.id ? ' id="' + o.id + '"' : '') +
    ' class="' +
    (o.cls || '') +
    '" style="display:flex;height:100%;min-height:0">' +
    '<div class="' +
    (o.treeCls || '') +
    '" style="width:var(--ftw,250px);border-inline-end:1px solid var(--line);overflow:auto;padding:12px 8px;flex:0 0 auto">' +
    treeHTML +
    '</div>' +
    '<div class="' +
    (o.paneCls || '') +
    '" style="flex:1;overflow:auto;min-width:0" id="' +
    (o.paneId || 'detailpane') +
    '">' +
    rightHTML +
    '</div></div>'
  );
}
// recursive tree render — parent_id makes it nestable (same pattern as the Network tree)
function _folderTree(parentId, depth) {
  var kids = (UI.folders || []).filter(function (item) {
    return (item.parent_id || null) === (parentId || null);
  });
  return kids
    .map(function (item) {
      return (
        _folderNode({
          depth: depth,
          sel: UI.folderSel === item.folder_id,
          onclick: "selectFolder('" + item.folder_id + "')",
          icon: '📁',
          label: esc(item.name),
          tail: String(item.count || 0)
        }) + _folderTree(item.folder_id, depth + 1)
      );
    })
    .join('');
}
/** the Folders screen: the folder tree on the left, the picked folder (or a prompt to pick one) on the right */
function foldersScreen() {
  if (UI.folders === undefined) {
    loadFolders();
    return loader('Loading folders…');
  }
  var tree = _folderTree(null, 0) || '<div style="color:var(--grey);font-size:var(--fs-2);padding:8px 6px">No folders yet</div>';
  var right = UI.folderSel ? _folderView() : emptyState('📁', 'Pick a folder', 'Or create one, then file chits into it with 📁 Move.');
  return _folderPanes(
    '<div style="font-size:var(--fs-1);font-weight:800;color:var(--grey);letter-spacing:.05em;padding:2px 8px 8px">' +
      tx('FOLDERS') +
      '</div>' +
      tree +
      '<div data-cbsid="SCR004-C02" style="font-size:var(--fs-2);color:var(--blue);padding:9px 8px 4px;cursor:pointer" onclick="newFolder()">＋ New folder</div>',
    right
  );
}
function selectFolder(id) {
  UI.folderSel = id;
  UI.folderArch = false;
  UI.folderChits = undefined;
  if (typeof renderApp === 'function') renderApp();
  loadFolderChits();
}
function setFolderArch(a) {
  UI.folderArch = a;
  UI.folderChits = undefined;
  var node = document.getElementById('detailpane');
  if (node) node.innerHTML = _folderView();
  loadFolderChits();
}
/** fetch the picked folder's chits (current or archive) into UI.folderChits and repaint the detail pane */
async function loadFolderChits() {
  var id = UI.folderSel;
  if (!id) return;
  try {
    var reply = await api('folderChits', { params: { id: id }, query: { archived: UI.folderArch ? 1 : 0 } });
    UI.folderChits = Array.isArray(reply)
      ? reply
      : (reply && (reply.chits || reply.rows || reply.data)) ||
        []; /* ⚠️ api() collapses {chits:[…]} TO the array — r.chits was undefined, so a folder showed no chits at all */
  } catch (e) {
    UI.folderChits = [];
  }
  var node = document.getElementById('detailpane');
  if (node) node.innerHTML = _folderView();
}
/** the picked folder's pane: Current/Archive tabs, the Chits · Metrics · Rules tabs, then that tab's body */
function _folderView() {
  var f = (UI.folders || []).find(function (x) {
    return x.folder_id === UI.folderSel;
  }) || { name: 'Folder' };
  var arch = !!UI.folderArch;
  var tab = function (on, label, onclick) {
    return (
      '<span data-cbsid="SCR004-C03" onclick="' +
      onclick +
      '" style="cursor:pointer;font-size:var(--fs-2);font-weight:700;padding:5px 13px;border-radius:16px;' +
      (on ? 'background:var(--blue);color:var(--on-accent)' : 'border:1px solid var(--line);color:var(--grey-2)') +
      '">' +
      label +
      '</span>'
    );
  };
  var head =
    '<div style="padding:14px 18px;border-bottom:1px solid var(--line)"><div style="font-size:var(--fs-4);font-weight:800">📁 ' +
    esc(f.name) +
    '</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">Sender → this folder</div>' +
    '<div style="display:flex;gap:6px;margin-top:11px;align-items:center">' +
    tab(!arch, 'Current', 'setFolderArch(false)') +
    tab(arch, 'Archive', 'setFolderArch(true)') +
    '<span data-cbsid="SCR004-C04" style="margin-inline-start:auto;font-size:var(--fs-1);color:var(--blue);cursor:pointer" onclick="renameFolder(\'' +
    UI.folderSel +
    '\')">' +
    tx('Rename') +
    '</span>' +
    '<span data-cbsid="CMP011" style="font-size:var(--fs-1);color:var(--disp);cursor:pointer;margin-inline-start:14px" onclick="deleteFolder(\'' +
    UI.folderSel +
    '\')">' +
    tx('Delete') +
    '</span></div>' +
    /* ⚠️ PANES, NOT A DENSER PANE. Rules and metrics are each a full job; crushed into the chit list they would be
       unreadable on a phone and barely readable anywhere. One job per tab — the shape the compose flow already uses. */
    '<div style="display:flex;gap:6px;margin-top:10px">' +
    _ftab('chits', '📄 Chits') +
    _ftab('metrics', '📊 Metrics') +
    _ftab('rules', '⚙️ Rules') +
    '</div></div>';
  var list;
  if (UI.folderChits === undefined) list = '<div style="padding:16px;color:var(--grey);font-size:var(--fs-2)">' + tx('Loading…') + '</div>';
  else if (!UI.folderChits.length)
    list =
      '<div style="padding:22px 18px;color:var(--grey);font-size:var(--fs-2)">Nothing ' +
      (arch ? 'in Archive' : 'here') +
      ' yet. From Task, use 📁 Move to file a chit into this folder.</div>';
  else
    list = UI.folderChits
      .map(function (item) {
        var bj = item.business_json;
        if (typeof bj === 'string') {
          try {
            bj = JSON.parse(bj);
          } catch (e) {
            bj = null;
          }
        }
        var isDev = !!(bj && bj.kind === 'device_signal');
        var subj = esc(item.manual_subject || item.auto_subject || '(no subject)');
        var raiser = esc(item.raiser_name || (isDev && bj.device_id) || item.sender_entity_display_name || '—');
        var line2 = isDev
          ? '🛰️ ' +
            esc(bj.sub_type || bj.signal || 'signal') +
            (bj.value != null && bj.value !== '' ? ' = ' + esc(String(bj.value)) + esc(bj.unit || '') : '') +
            ' · raised by <b>' +
            raiser +
            '</b>'
          : 'from ' + esc(item.sender_entity_display_name || raiser);
        var when = typeof fmtAt === 'function' ? esc(fmtAt(item.created_at)) : '';
        var openA = typeof openChit === 'function' ? "openChit('" + item.chit_id + "')" : '';
        return (
          '<div data-cbsid="SCR004-C05" style="display:flex;gap:11px;padding:12px 18px;border-bottom:1px solid #f0f2f4;cursor:pointer" onclick="' +
          openA +
          '"><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:var(--fs-3)">' +
          (isDev ? '🛢️ ' : '') +
          subj +
          '</div><div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">' +
          line2 +
          '</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:0 0 auto"><span style="font-size:var(--fs-1);color:var(--grey)">' +
          when +
          '</span><span data-cbsid="SCR004-C06" style="font-size:var(--fs-1);color:var(--blue);border:1px solid var(--blue-tint-line);background:var(--blue-tint-bg);border-radius:9px;padding:2px 8px" onclick="event.stopPropagation();moveChit(\'' +
          item.chit_id +
          '\')">' +
          tx('📁 Move') +
          '</span></div></div>'
        );
      })
      .join('');
  // The chit list is now ONE of three panes; metrics and rules render themselves.
  if (_FLD.tab === 'metrics') return head + _folderMetricsPane();
  if (_FLD.tab === 'rules') return head + _folderRulesPane();
  return head + '<div style="overflow:auto">' + list + '</div>';
}
/* A tab in the folder header. Same pill shape as Current/Archive above it, so the two rows read as one control. */
function _ftab(k, label) {
  var on = (_FLD.tab || 'chits') === k;
  return (
    '<span data-cbsid="SCR004-C07" data-testid="folder-tab-' +
    k +
    '" onclick="setFolderTab(\'' +
    k +
    '\')" style="cursor:pointer;font-size:var(--fs-2);font-weight:700;padding:5px 13px;border-radius:16px;' +
    (on ? 'background:var(--chrome);color:var(--chrome-on)' : 'border:1px solid var(--line);color:var(--grey-2)') +
    '">' +
    label +
    '</span>'
  );
}
/** ask for a name, create the folder, reload the list */
function newFolder() {
  promptAsk('New folder', { label: 'Folder name', placeholder: 'e.g. Awaiting payment', okLabel: 'Create' }, async function (name) {
    try {
      await api('folderCreate', { body: { name: name } });
      UI.folders = undefined;
      loadFolders();
      if (typeof toast === 'function') toast('Folder created.');
    } catch (e) {
      if (typeof toast === 'function') toast((e && e.message) || 'Create failed');
    }
  });
}
/** ask for a new name (prefilled), rename the folder, reload the list */
function renameFolder(id) {
  var f =
    (UI.folders || []).find(function (x) {
      return x.folder_id === id;
    }) || {};
  promptAsk('Rename folder', { label: 'Folder name', value: f.name || '', okLabel: 'Rename' }, async function (name) {
    try {
      await api('folderRename', { params: { id: id }, body: { name: name } });
      UI.folders = undefined;
      loadFolders();
    } catch (e) {
      if (typeof toast === 'function') toast((e && e.message) || 'Rename failed');
    }
  });
}
/** confirm, then delete the folder; its chits go back to the mailbox, not away */
function deleteFolder(id) {
  /** the delete itself, after the confirm: clear the selection and reload the list */
  var run = async function () {
    try {
      await api('folderDelete', { params: { id: id } });
      UI.folderSel = null;
      UI.folderChits = undefined;
      UI.folders = undefined;
      loadFolders();
    } catch (e) {
      if (typeof toast === 'function') toast((e && e.message) || 'Delete failed');
    }
  };
  if (typeof confirmAsk === 'function')
    confirmAsk('Delete folder', 'Delete this folder? Its chits are <b>not</b> deleted — they return to the main mailbox.', 'Delete', run, true);
  else if (window.confirm('Delete folder? Its chits return to the mailbox.')) run();
}
/** the Move-to-folder sheet for one chit: one row per folder, plus Remove from folder (loads the list first if needed) */
async function moveChit(chitId) {
  if (UI.folders === undefined) {
    try {
      var reply = await api('foldersList');
      UI.folders = _foldersFrom(reply);
    } catch (e) {
      UI.folders = [];
    }
  } /* the filed folders only — a view is not a place to move into */ // self-load so Move works from Task, not just the Folders screen
  var opts = (UI.folders || [])
    .map(function (item) {
      return (
        '<div data-cbsid="SCR004-C08" style="padding:9px 12px;border-bottom:1px solid #f0f2f4;cursor:pointer" onclick="_doMove(\'' +
        chitId +
        "','" +
        item.folder_id +
        '\')">📁 ' +
        esc(item.name) +
        '</div>'
      );
    })
    .join('');
  var body =
    '<div style="max-height:320px;overflow:auto">' +
    (opts || '<div style="padding:12px;color:var(--grey);font-size:var(--fs-2)">Create a folder first</div>') +
    '<div data-cbsid="SCR004-C09" style="padding:10px 12px;color:var(--disp);cursor:pointer;border-top:1px solid var(--line)" onclick="_doMove(\'' +
    chitId +
    '\',null)">' +
    tx('↩ Remove from folder (back to mailbox)') +
    '</div></div>';
  if (typeof modal === 'function')
    modal('<div class="mhd"><div class="t">' + tx('📁 Move to folder') + '</div></div><div class="mbody" style="padding:0">' + body + '</div>');
}
/** file the chit into a folder (null = back to the mailbox) and say which in a toast */
async function _doMove(chitId, folderId) {
  if (folderId === 'null' || folderId === '') folderId = null;
  if (typeof closeModal === 'function') closeModal();
  try {
    await api('folderMove', { body: { chit_id: chitId, folder_id: folderId } });
    if (typeof toast === 'function') toast(folderId ? 'Filed into folder.' : 'Removed from folder.');
    UI.folders = undefined;
    UI.folderChits = undefined;
    if (UI.nav === 'folders') {
      loadFolders();
    } else if (typeof loadList === 'function') {
      loadList();
    } // refresh Task (moved chit leaves the main list) or the folder view
  } catch (e) {
    if (typeof toast === 'function') toast((e && e.message) || 'Move failed');
  }
}
/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *  FOLDER PANES — Chits · Metrics · Rules.  The folder is the place these live.
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Athi, 2026-08-10: *"bring the UX on the folder itself. in the sense, when we create a folder, inside we may have
 * to have options to set the rules and whatever it is."*
 *
 * ⚠️ PANES, NOT A DENSER PANE. The rules builder and the metrics strip are each a full job; crushing them into the
 * chit list would make the folder screen unreadable on a phone and barely readable anywhere else. Tabs across the
 * top, one job each — the same shape the compose step-flow uses, and the standing rule here.
 */
var _FLD = { tab: 'chits', metrics: null, recon: null, rules: null, rulesNote: null, busy: false, err: null, draft: null, preview: null };
function setFolderTab(t) {
  _FLD.tab = t;
  _FLD.err = null;
  var node = document.getElementById('detailpane');
  if (node) node.innerHTML = _folderView();
  if (t === 'metrics' && !_FLD.metrics) loadFolderMetrics();
  if (t === 'rules' && !_FLD.rules) loadFolderRules();
}
/* ⚠️ THE PANES RENDER WHEREVER THEY WERE OPENED. Metrics/Rules now open as a MODAL over the Task list (a folder
   is that list filtered, not a separate screen), so paint into the modal body when it is there and fall back to
   the detail pane for the legacy standalone Folders screen. */
function _fldPaint() {
  var host = document.getElementById('fld_pane');
  if (host) {
    host.innerHTML = _FLD.tab === 'rules' ? _folderRulesPane() : _FLD.tab === 'groupsum' ? _groupSumPane() : _folderMetricsPane();
    return;
  }
  var node = document.getElementById('detailpane');
  if (node) node.innerHTML = _folderView();
}
/* The track (Task / Order) is the folder you are always in. `_FLD.track` is set when the panes were opened from
   the track rather than from a folder — everything below reads it instead of asking twice. */
function _fldTrack() {
  return UI.folderSel ? null : UI.folder === 'order' ? 'order' : 'task';
}
/** the Metrics tab: reconcile the filed counts, then fetch this folder's metrics */
async function loadFolderMetrics() {
  _FLD.busy = true;
  _FLD.recon = null;
  _fldPaint();
  var track = _fldTrack();
  try {
    if (track) {
      /* ⚠️ ONE CALL, TWO ANSWERS. reconcile returns `overall` — the same measure shape a folder's metrics returns,
         so the whole pane below renders unchanged — plus the per-folder split and the assertion that they add up.
         Asking a metrics endpoint and a reconcile endpoint separately would let the two disagree, which is exactly
         the failure the reconciliation exists to catch. */
      var reply = await api('folderReconcile', { query: { scope: track } });
      /* `overall` is measured over every row on the track, so overall.count IS the total. Used as-is rather than
         overwritten with r.total: if those two ever disagree it is a bug worth seeing, not one worth papering. */
      _FLD.metrics = (reply && reply.overall) || null;
      _FLD.recon = reply;
    } else {
      _FLD.metrics = await api('folderMetrics', { params: { id: UI.folderSel } });
    }
  } catch (e) {
    _FLD.err = (e && e.message) || 'Could not read the metrics.';
  }
  _FLD.busy = false;
  _fldPaint();
}
/* ── metrics ──────────────────────────────────────────────────────────────────────────────────────────────────── */
function _mBox(label, value, hint, tone) {
  var col = tone === 'bad' ? 'var(--disp)' : tone === 'warn' ? 'var(--warn-2)' : 'var(--ink)';
  return (
    '<div style="flex:1;min-width:104px;border:1px solid var(--line);border-radius:9px;padding:10px 12px;background:var(--card);color:var(--on-card)">' +
    '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey)">' +
    esc(label) +
    '</div>' +
    '<div style="font-size:var(--fs-5);font-weight:800;margin-top:3px;color:' +
    col +
    '">' +
    esc(String(value)) +
    '</div>' +
    (hint ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">' + esc(hint) + '</div>' : '') +
    '</div>'
  );
}
/**
 * ⭐ THE RECONCILIATION — Athi, 2026-08-10: *"total number of tasks in the database should be the sum of all the
 * tasks under the folder, according to its status."*
 *
 * ⚠️ WHY THIS IS ON SCREEN AND NOT JUST IN THE API. The moment folders exist, the Task header stops being the whole
 * truth: filing moves a chit OUT of the unfiled list and INTO a folder, so Task can read 34 while 180 more sit in
 * folders. Anyone glancing at it would conclude the work had shrunk. The invariant
 *
 *        TOTAL  =  unfiled  +  Σ(every folder)
 *
 * is shown as an arithmetic sentence you can read left to right, and it is ASSERTED, not assumed — if one chit is
 * unaccounted for the strip goes red and names the gap. A total that balances by luck is one that will one day not.
 */
function _reconStrip() {
  var r = _FLD.recon;
  if (!r) return '';
  var fs = (r.folders || [])
    .filter(function (item) {
      return item.own || item.tree;
    })
    .sort(function (first, second) {
      return (second.tree || second.own) - (first.tree || first.own);
    });
  var sums = '<b>' + r.total + '</b> total &nbsp;=&nbsp; <b>' + r.unfiled + '</b> unfiled &nbsp;+&nbsp; <b>' + r.filed + '</b> in folders';
  var verdict = r.reconciles
    ? '<span style="color:var(--ok-3);font-weight:800">' + tx('✓ adds up') + '</span>'
    : '<span style="color:var(--disp);font-weight:800">✗ ' + Math.abs((r.discrepancy || {}).missing || 0) + ' unaccounted for</span>';
  /* ⚠️ `own` AND `tree` BOTH, never one. A parent showing only its own rows makes the tree look smaller than its
     branches; showing only the roll-up makes a parent look full when everything is actually one level down. */
  var rows = fs.length
    ? fs
        .map(function (item) {
          var s = item.segments || {};
          return (
            '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-top:1px solid var(--line);font-size:var(--fs-2)">' +
            '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📁 ' +
            esc(item.name) +
            '</span>' +
            '<span style="color:var(--grey);font-size:var(--fs-1)">' +
            (s.open || 0) +
            ' open · ' +
            (s.unassigned || 0) +
            ' unassigned</span>' +
            '<span style="font-weight:800;min-width:34px;text-align:end">' +
            item.own +
            '</span>' +
            (item.tree !== item.own
              ? '<span style="color:var(--grey);font-size:var(--fs-1);min-width:52px;text-align:end">' + item.tree + ' w/ sub</span>'
              : '<span style="min-width:52px"></span>') +
            '</div>'
          );
        })
        .join('')
    : '<div style="font-size:var(--fs-1);color:var(--grey);padding:5px 0">No folders, all unfiled</div>';

  return (
    '<div style="border:1px solid var(--line);border-radius:9px;padding:11px 13px;margin-bottom:12px;background:var(--card);color:var(--on-card)">' +
    '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey)">Do totals match</div>' +
    '<div style="font-size:var(--fs-2);margin-top:3px">' +
    sums +
    ' &nbsp; ' +
    verdict +
    '</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">' +
    (r.overall || {}).assigned +
    ' assigned · ' +
    (r.overall || {}).unassigned +
    ' unassigned — a chit can be open and unassigned, and that is the pile worth seeing.</div>' +
    '<div style="margin-top:8px">' +
    rows +
    '</div>' +
    (r.reconciles
      ? ''
      : '<div style="font-size:var(--fs-1);color:var(--disp);margin-top:7px">⚠️ Totals differ<br>Folder hidden from you</div>') +
    '</div>'
  );
}
/** the Metrics tab body: this folder's clock, disputes and other measures, or a spinner while they load */
function _folderMetricsPane() {
  if (_FLD.busy && !_FLD.metrics) return '<div style="padding:18px;color:var(--grey);font-size:var(--fs-2)"><span class="spin"></span> measuring…</div>';
  var m = _FLD.metrics;
  if (!m) return '<div style="padding:18px;color:var(--grey);font-size:var(--fs-2)">No metrics yet</div>';
  var c = m.clock || {},
    d = m.disputes || {},
    mo = m.money || {};
  var dash = function (v, suffix) {
    return v === null || v === undefined ? '—' : v + (suffix || '');
  };

  var money = (mo.by_currency || []).length
    ? (mo.by_currency || [])
        .map(function (item) {
          return (
            '<span style="display:inline-block;border:1px solid var(--line);border-radius:9px;padding:3px 9px;margin:0 6px 6px 0;font-size:var(--fs-2)"><b>' +
            esc(item.currency) +
            '</b> ' +
            esc(String(item.total)) +
            ' <span style="color:var(--grey)">· ' +
            item.chits +
            ' chit' +
            (item.chits === 1 ? '' : 's') +
            '</span></span>'
          );
        })
        .join('')
    : '<span style="font-size:var(--fs-2);color:var(--grey)">no agreed value</span>';
  /* ⚠️ NEVER ONE TOTAL ACROSS CURRENCIES, and the reason is said on screen rather than left as a design note. */
  var moneyNote =
    (mo.mixed
      ? '<div style="font-size:var(--fs-1);color:var(--warn-2);margin-top:2px">' +
        txf('⚠️ More than one currency — these are {not} added together. A single total across currencies is a number that means nothing.', {
          not: '<b>' + tx('not') + '</b>'
        }) +
        '</div>'
      : '') +
    ((mo.excluded || {}).awaiting_agreement
      ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">' +
        mo.excluded.awaiting_agreement +
        ' chit(s) have no agreed value yet and are excluded — they are not counted as zero.</div>'
      : '');

  return (
    '<div style="padding:14px 18px">' +
    _reconStrip() +
    '<div style="display:flex;gap:9px;flex-wrap:wrap">' +
    _mBox(_FLD.recon ? 'On this track' : 'In this folder', m.count, (m.open || 0) + ' open · ' + (m.closed || 0) + ' closed') +
    _mBox('Unread', m.unread, m.unread ? 'nobody has opened these' : 'all seen', m.unread ? 'warn' : null) +
    _mBox('Overdue', m.overdue, txf('open for {days}+ days', { days: m.overdue_days }), m.overdue ? 'bad' : null) +
    _mBox('Oldest', dash(c.oldest_age_days, 'd'), 'the one nobody is working', c.oldest_age_days > (m.overdue_days || 7) * 3 ? 'warn' : null) +
    '</div>' +
    /* ⚠️ RESPONSE and RESOLUTION side by side, never merged. Together they show "we answer fast and finish never",
       which is the commonest way a team looks fine and is not. */
    '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:9px">' +
    _mBox('Typical age', dash(c.median_age_days, 'd'), 'median, not average') +
    _mBox('First touch', dash(c.median_first_touch_days, 'd'), 'time to being read') +
    _mBox('To close', dash(c.median_to_close_days, 'd'), 'time to finished') +
    _mBox('Disputed', dash(d.rate_pct, '%'), (d.open || 0) + ' open now', d.open ? 'bad' : null) +
    '</div>' +
    '<div style="margin-top:14px"><div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:5px">' +
    tx('Value') +
    '</div>' +
    money +
    moneyNote +
    '</div>' +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:14px;line-height:1.5">A dash means <b>nothing to measure</b>, which is not the same as zero. ' +
    '' +
    txf('“Overdue” is {your} setting — change it in Settings {arrow} Business rules, and every folder and scorecard follows.', {
      your: '<b>' + tx('your') + '</b>',
      arrow: '<span class=arw>→</span>'
    }) +
    '</div>' +
    '</div>'
  );
}
