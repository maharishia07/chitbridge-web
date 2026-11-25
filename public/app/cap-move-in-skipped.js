/* app/cap-move-in-skipped.js — Move in's SKIPPED ROWS: the list of rows the import held or skipped (with the reason), its download as a file, and the start-again door. Split out of cap-move-in.js (file-size ratchet, batch 1129; capability split), code moved verbatim.
 * OWNS      the after-import skipped-rows view: miSkippedColumns · miPaintSkipped · miDownload · miAgain
 * CALLED BY cap-move-in.js (miDoneHTML draws the mi_skipped box, miImport paints it; the Download and Start again buttons call miDownload / miAgain); loaded beside it by accounts.html (the movein late group)
 * FLOW      miImport → miDoneHTML → miPaintSkipped(rows) → CBList over miSkippedColumns · Download → miDownload (a .csv of the skipped rows) · Start again → miAgain
 * CARD      14-accounting/move-in-from-xero-quickbooks
 * ID        BKS024
 * OWNER     cb-accounting
 * RISK      plain
 */
'use strict';
/** the skipped-rows list's columns: line · what · held or skipped chip · why */
function miSkippedColumns() {
  return [
    {
      key: 'line',
      label: tx('Line'),
      prio: 3,
      sort: 'line',
      num: true,
      w: 80,
      cell: function (row) {
        return String(row.line);
      }
    },
    {
      key: 'what',
      label: tx('What'),
      prio: 1,
      sort: 'what',
      w: 260,
      cell: function (row) {
        return row.what || '';
      }
    },
    {
      key: 'state',
      label: tx('Action'),
      prio: 2,
      w: 110,
      html: true,
      cell: function (row) {
        var held = !!row.code;
        return (
          '<span class="step ' + (held ? 'amber' : '') + '" data-testid="mi-state-' + esc(row.line) + '">' + esc(tx(held ? 'Held' : 'Skipped')) + '</span>'
        );
      }
    },
    {
      key: 'why',
      label: tx('Why'),
      prio: 3,
      sort: 'why',
      w: 420,
      cell: function (row) {
        return row.why || '';
      }
    }
  ];
}
function miPaintSkipped() {
  var el = document.getElementById('mi_skipped');
  if (!el || !MIV.out) return;
  var rows = MIV.out.rows || [];
  if (!rows.length) {
    el.innerHTML = '<div style="color:var(--grey);font-size:var(--fs-1)">' + esc(tx('Nothing was skipped')) + '</div>';
    return;
  }
  CBList.reset('movein-skipped');
  CBList.mount(el, {
    key: 'movein-skipped',
    t: tx,
    rows: function () {
      return rows;
    },
    id: function (row) {
      return row.line;
    },
    rowTid: function (row) {
      return 'mi-skip-' + row.line;
    },
    columns: miSkippedColumns(),
    sorts: [
      {
        key: 'line',
        label: tx('File order'),
        cmp: function (left, right) {
          return left.line - right.line;
        }
      }
    ],
    search: function (row) {
      return [row.what, row.why].join(' ');
    },
    empty: { title: tx('Nothing was skipped') }
  });
}
/* the skipped rows as a .csv (line · what · why) — the same three columns the server's skippedCsv writes */
function miDownload() {
  var rows = (MIV.out && MIV.out.rows) || [],
    quoted = function (value) {
      return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
    };
  var text =
    ['line,what,why']
      .concat(
        rows.map(function (item) {
          return [item.line, item.what, item.why].map(quoted).join(',');
        })
      )
      .join('\n') + '\n';
  var node = document.createElement('a');
  node.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  node.download = 'skipped-' + (MIV.f.kind || 'rows') + '.csv';
  document.body.appendChild(node);
  node.click();
  setTimeout(function () {
    try {
      URL.revokeObjectURL(node.href);
      node.remove();
    } catch (failure) {
      // the file was already saved; only the temporary link stays, so say so and move on
      if (typeof cblog === 'function') cblog('warn', 'move-in: the skipped-rows download link was not cleaned up — ' + ((failure && failure.message) || 'no answer'));
    }
  }, 500);
}
function miAgain() {
  miFresh();
  if (MIV.st) {
    MIV.st.reset();
    MIV.st.paint();
  }
}
