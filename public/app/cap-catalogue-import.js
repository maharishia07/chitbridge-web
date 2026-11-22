/* app/cap-catalogue-import.js — the catalogue FILE IMPORT: pick a file, check it (the dry run), import the good rows, download the rejects. Split out of cap-catalogue.js (file-size ratchet, batch 1129; capability split), code moved verbatim.
 * OWNS      the import wizard's steps: _cfPick · _cfRun · _cfImport · _cfImportRun · _cfMappingRowHtml · _cfIssuesHtml · _cfRejectsHtml · _cfDownloadRejects · _cfOutcomeHtml · _cfImportButtonState
 * CALLED BY the wizard markup in app.html (onclick="_cfPick/_cfRun/_cfImport"); loaded by the pages that load cap-catalogue.js, before it
 * FLOW      _cfPick (file → text) → _cfRun (server dry run → mapping + issues) → _cfImport → _cfImportRun (rows in, rejects listed with a download)
 * CARD      06-catalogue-pim/items
 * OWNER     cb-catalogue
 * RISK      plain
 */
'use strict';
/** a file is picked: csv → its text into #cf_text (as before); a WORKBOOK (.xlsx/.xls) → base64 on UI._cfXlsx, the route's own `xlsx` field (T3-CATALOGUE) */
function _cfPick(input) {
  var f = input && input.files && input.files[0];
  if (!f) return;
  var rd = new FileReader(),
    name = document.getElementById('cf_file_name'),
    isBook = /\.xlsx?$/i.test(f.name || '');
  UI._cfXlsx = null;
  if (isBook) {
    rd.onload = function () {
      var s = String(rd.result || '');
      UI._cfXlsx = s.slice(s.indexOf(',') + 1);
      var el = document.getElementById('cf_text');
      if (el) el.value = '';
      if (name) name.textContent = tx('Workbook') + ': ' + f.name;
    };
    rd.readAsDataURL(f);
    return;
  }
  rd.onload = function () {
    var el = document.getElementById('cf_text');
    if (el) el.value = String(rd.result || '').replace(/^﻿/, '');
    if (name) name.textContent = f.name;
  };
  rd.readAsText(f);
}
/** what the preflight and the import send: the workbook when one was picked, else the csv text — ONE place, so both halves read the same file */
function _cfBody(text) {
  return UI._cfXlsx ? { xlsx: UI._cfXlsx } : { csv: text };
}
// How each verdict reads, and what it DEFAULTS the decision to. A blocked column has no choice at all — the
// control is removed rather than merely pre-set, because a disabled dropdown still looks like a decision
// someone could change.
var _CF_HOW = {
  exact: ['✓', 'var(--ok-2)', 'matches your catalogue'],
  synonym: ['✓', 'var(--ok-2)', 'recognised under another name'],
  contains: ['?', 'var(--warn-2)', 'probably this — confirm'],
  fuzzy: ['?', 'var(--warn-2)', 'guessed — confirm this'],
  ambiguous: ['?', 'var(--warn-2)', 'could be more than one thing'],
  'not-accepted': ['—', 'var(--grey-2)', 'your catalogue does not use this'],
  unmatched: ['—', 'var(--grey-2)', 'not recognised'],
  conflict: ['!', 'var(--warn-2)', 'another column matched this better'],
  blocked: ['⨯', 'var(--disp)', 'a file may not set this'],
  empty: ['—', 'var(--grey-2)', 'this column has no heading']
};
/** one row of the column table: what the file calls it, how it was read, the choice offered and why */
function _cfMappingRowHtml(item, index, accepted) {
    var h = _CF_HOW[item.how] || ['?', 'var(--grey-2)', item.how];
    var control;
    if (item.how === 'blocked' || item.how === 'empty') {
      control = '<span style="font-size:var(--fs-1);color:' + h[1] + '">not importable</span>';
    } else {
      var opts = ['<option value="ignore">' + tx('Leave it out') + '</option>'];
      accepted.forEach(function (f) {
        var sel = item.canonical === f ? ' selected' : '';
        opts.push('<option value="map:' + esc(f) + '"' + sel + '>Use as ' + esc(f) + '</option>');
      });
      // Only offer to CREATE where nothing in the catalogue claimed it — otherwise the obvious click is the one
      // that grows a second column meaning the same thing.
      if (!item.canonical) opts.push('<option value="create" selected>' + tx('Add as a new column') + '</option>');
      control =
        '<select data-cbsid="CTG003-S01" data-cfcol="' +
        esc(item.incoming || '') +
        '" data-testid="cf-decide-' +
        index +
        '" class="inp" style="font-size:var(--fs-2);padding:3px 6px;width:100%">' +
        opts.join('') +
        '</select>';
    }
    return (
      '<tr>' +
      '<td style="padding:5px 8px;border-bottom:1px dashed var(--line);font-family:ui-monospace,monospace;font-size:var(--fs-2)">' +
      esc(item.incoming || '(blank)') +
      '</td>' +
      '<td style="padding:5px 8px;border-bottom:1px dashed var(--line);color:' +
      h[1] +
      ';font-weight:700;text-align:center">' +
      h[0] +
      '</td>' +
      '<td style="padding:5px 8px;border-bottom:1px dashed var(--line);min-width:150px">' +
      control +
      '</td>' +
      '<td style="padding:5px 8px;border-bottom:1px dashed var(--line);font-size:var(--fs-1);color:var(--grey)">' +
      esc(item.conflict || item.why || h[2]) +
      '</td>' +
      '</tr>'
    );
}
/** the first 25 row issues as a list, each in the colour of its severity, and how many more there are ('' when there are none) */
function _cfIssuesHtml(issueList) {
  var issues = (issueList || [])
    .slice(0, 25)
    .map(function (item) {
      var lineColor = item.severity === 'error' ? 'var(--disp)' : item.severity === 'info' ? 'var(--grey-2)' : 'var(--warn-2)';
      return '<li style="color:' + lineColor + '">line ' + item.row + ' · <b>' + esc(item.column) + '</b> — ' + esc(item.message) + '</li>';
    })
    .join('');
  if (!issues) return '';
  return (
    '<div style="font-size:var(--fs-1);text-transform:uppercase;color:var(--grey);margin:10px 0 4px">' +
    tx('Rows') +
    '</div><ul style="font-size:var(--fs-2);line-height:1.6;padding-inline-start:18px;margin:0">' +
    issues +
    '</ul>' +
    ((issueList || []).length > 25 ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:5px">…and ' + ((issueList || []).length - 25) + ' more.</div>' : '')
  );
}
/** the Import button is enabled only when the file itself is sound. Row errors are not a warning to click past: the server refuses them too, and offering the button anyway teaches people to ignore it */
function _cfImportButtonState(blocking, takeGood) {
  var node = document.getElementById('cf_import');
  if (!node) return;
  var stopped = blocking && !takeGood;
  node.disabled = stopped;
  node.style.opacity = stopped ? '.5' : '1';
  node.title = stopped ? 'Fix the row problems first' : takeGood ? 'Import the good rows; the problem rows are listed' : 'Apply these choices to your catalogue';
}
async function _cfRun(btn) {
  var text = (document.getElementById('cf_text') || {}).value || '';
  var out = document.getElementById('cf_out');
  if (!out) return;
  if (!text.trim() && !UI._cfXlsx) {
    out.innerHTML = '<div style="font-size:var(--fs-2);color:var(--disp)">Add file or rows</div>';
    return;
  }
  var was = btn ? btn.textContent : null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Reading…';
  }
  try {
    var res = await api('prodPreflight', { body: _cfBody(text) });
    var r = res.report;
    UI._cf = { csv: text, xlsx: UI._cfXlsx || null, accepted: res.accepted || [], optional: res.optional || [], report: r };

    var accepted = res.accepted || [];
    var rowsHtml = (r.mapping || [])
      .map(function (item, index) {
        return _cfMappingRowHtml(item, index, accepted);
      })
      .join('');

    var s = r.summary || {};
    var blocking = (s.errors || 0) > 0;
    var takeGood = blocking && (s.importable || 0) > 0; // S2-F-02: the good rows can go in; the bad ones come back listed, with a file to fix
    UI._cf.skipBad = takeGood;
    var badge = blocking
      ? '<span style="background:var(--danger-tint);color:var(--disp);border-radius:6px;padding:3px 9px;font-size:var(--fs-1);font-weight:700">' +
        s.errors +
        (takeGood
          ? ' row problem(s) — the other ' + s.importable + ' row(s) can still go in; the problem rows come back listed</span>'
          : ' row problem(s) — fix the file first</span>')
      : r.ready
        ? '<span style="background:var(--ok-tint);color:var(--disp);border-radius:6px;padding:3px 9px;font-size:var(--fs-1);font-weight:700">' +
          tx('Every column is placed') +
          '</span>'
        : '<span style="background:var(--warn-tint);color:var(--warn-3);border-radius:6px;padding:3px 9px;font-size:var(--fs-1);font-weight:700">' +
          tx('Check the choices below, then import') +
          '</span>';
    out.innerHTML =
      badge +
      '<div style="font-size:var(--fs-2);margin:9px 0 6px">' +
      s.rows +
      ' row(s) read · <b>' +
      s.importable +
      '</b> would import · ' +
      s.errors +
      ' error(s) · ' +
      s.warnings +
      ' warning(s)</div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>' +
      ['In your file', '', 'What to do with it', 'Why']
        .map(function (item) {
          return (
            '<th style="text-align:start;padding:5px 8px;font-size:var(--fs-1);text-transform:uppercase;color:var(--grey);border-bottom:1px solid var(--line)">' +
            item +
            '</th>'
          );
        })
        .join('') +
      '</tr></thead><tbody>' +
      rowsHtml +
      '</tbody></table></div>' +
      ((r.notes || []).length
        ? '<ul style="font-size:var(--fs-2);line-height:1.6;padding-inline-start:18px;margin:10px 0 0">' +
          r.notes
            .map(function (item) {
              return '<li>' + esc(item) + '</li>';
            })
            .join('') +
          '</ul>'
        : '') +
      _cfIssuesHtml(r.issues) +
      '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:11px;border-top:1px solid var(--line);padding-top:8px">' +
      txf('Reading the file changed nothing. {import} applies the choices above — it adds and updates products, and never deletes one.', {
        import: '<b>' + tx('Import') + '</b>'
      }) +
      '</div>';

    _cfImportButtonState(blocking, takeGood);
  } catch (e) {
    out.innerHTML = '<div style="font-size:var(--fs-2);color:var(--disp)">' + esc((e && e.message) || 'Could not read the file.') + '</div>';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = was;
    }
  }
}
/**
 * _cfImport — apply the per-column choices.
 *
 * The decisions come from the dropdowns, NOT from the preflight's suggestions: what the person sees on screen is
 * exactly what is sent. The server re-reads the file and re-checks every decision, so nothing here is trusted.
 */
function _cfImport(btn) {
  if (!UI._cf) {
    if (typeof toast === 'function') toast('Check a file first.');
    return;
  }
  var out = document.getElementById('cf_out');
  var sels = Array.prototype.slice.call(document.querySelectorAll('[data-cfcol]'));
  var decisions = sels.map(function (el) {
    var v = el.value || 'ignore';
    if (v === 'create') return { incoming: el.getAttribute('data-cfcol'), action: 'create' };
    if (v.indexOf('map:') === 0) return { incoming: el.getAttribute('data-cfcol'), action: 'map', field: v.slice(4) };
    return { incoming: el.getAttribute('data-cfcol'), action: 'ignore' };
  });
  var creating = decisions.filter(function (item) {
    return item.action === 'create';
  }).length;
  var using = decisions.filter(function (item) {
    return item.action !== 'ignore';
  }).length;
  if (!using) {
    if (typeof toast === 'function') toast('Every column is set to be left out.');
    return;
  }
  confirmAsk(
    'Import using ' + using + ' column' + (using === 1 ? '' : 's') + '?',
    (creating ? 'It also adds <b>' + creating + ' new column' + (creating === 1 ? '' : 's') + '</b> to your catalogue<div style="margin-top:7px">' : '<div>') +
      txf('Products are {au}. Nothing is deleted.', { au: '<b>' + tx('added or updated') + '</b>' }) +
      '</div>',
    'Import',
    function () {
      _cfImportRun(btn, decisions, out);
    }
  );
}
/** S2-F-02: the rows an import left out, each with its line, field and reason, and the button for the file to fix and send again (the answer's rejects / rejects_csv) */
function _cfRejectsHtml(reply) {
  var rejected = reply.rejects || [];
  if (!rejected.length) return '';
  return (
    '<div style="font-size:var(--fs-1);text-transform:uppercase;color:var(--disp);margin:12px 0 4px">' + rejected.length + ' row(s) not imported</div>' +
    '<ul data-testid="cf-rejects" style="font-size:var(--fs-2);line-height:1.6;padding-inline-start:18px;margin:0">' +
    rejected.slice(0, 40).map(function (item) {
      return '<li style="color:var(--disp)">line ' + item.line + ' · <b>' + esc(item.field) + '</b> — ' + esc(item.message) + '</li>';
    }).join('') +
    '</ul><button id="cf_rejects_dl" data-cbsid="CTG003-B04" data-testid="cf-rejects-download" type="button" class="act quiet" style="margin-top:8px">Download the rows to fix</button>'
  );
}
/** the rejected rows as a .csv the person fixes and imports again (BOM: Excel keeps accents without it) */
function _cfDownloadRejects(text) {
  var url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  var node = document.createElement('a');
  node.href = url;
  node.download = 'rows-to-fix.csv';
  document.body.appendChild(node);
  node.click();
  node.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
/** the import's answer line by line (the first 40, each in the colour of its outcome) and how many more there are */
function _cfOutcomeHtml(outcome) {
  var rows = outcome
    .slice(0, 40)
    .map(function (item) {
      var lineColor = item.action === 'failed' ? 'var(--disp)' : 'var(--ink)';
      return (
        '<li style="color:' + lineColor + '">line ' + item.line + ' · ' + esc(item.name || '') + ' — ' + esc(item.action) + (item.message ? ': ' + esc(item.message) : '') + '</li>'
      );
    })
    .join('');
  return (
    '<ul style="font-size:var(--fs-2);line-height:1.6;padding-inline-start:18px;margin:10px 0 0">' +
    rows +
    '</ul>' +
    (outcome.length > 40 ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:5px">…and ' + (outcome.length - 40) + ' more.</div>' : '')
  );
}
async function _cfImportRun(btn, decisions, out) {
  var was = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Importing…';
  try {
    var reply = await api('prodImport', {
      body: Object.assign(UI._cf.xlsx ? { xlsx: UI._cf.xlsx } : { csv: UI._cf.csv }, { decisions: decisions, confirm: true }, UI._cf.skipBad ? { skip_bad_rows: true } : {})
    }); /* the SAME file the preflight read */
    out.innerHTML =
      '<div style="background:var(--ok-tint);color:var(--ok-2);border-radius:6px;padding:8px 10px;font-size:var(--fs-2);font-weight:700">' +
      esc(reply.message || 'Imported') +
      '</div>' +
      ((reply.created_columns || []).length
        ? '<div style="font-size:var(--fs-2);color:var(--grey);margin-top:8px">Your catalogue now also has: ' +
          reply.created_columns.map(esc).join(', ') +
          '. The next template you download will include them.</div>'
        : '') +
      _cfOutcomeHtml(reply.outcome || []) +
      _cfRejectsHtml(reply);
    var again = document.getElementById('cf_rejects_dl');
    if (again) again.onclick = function () { _cfDownloadRejects(reply.rejects_csv); };
    btn.disabled = true;
    btn.style.opacity = '.5';
    if (typeof loadProducts === 'function') loadProducts(); /* the workshop's list */
    if (typeof CBCatalogueApp !== 'undefined' && CBCatalogueApp.changed) CBCatalogueApp.changed(); /* the small app's list and the live shelf */
  } catch (e) {
    out.innerHTML = '<div style="font-size:var(--fs-2);color:var(--disp)">' + esc((e && e.message) || 'Could not import.') + ' Nothing was changed.</div>';
    btn.disabled = false;
  } finally {
    btn.textContent = was;
  }
}
