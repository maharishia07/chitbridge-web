/* app/cap-folders-metrics.js — the METRICS pane of a folder: the clock, the disputes, the money by currency and the reconciliation strip. Split out of cap-folders.js (file-size ratchet, batch 1129; capability split), code moved verbatim.
 * OWNS      the folder metrics view: _mBox · _reconStrip · _folderMetricsPane
 * CALLED BY cap-folders.js (the Folders screen paints _folderMetricsPane on its Metrics tab; loadFolderMetrics there fills _FLD.metrics); loaded by accounts, crm and finance beside it, and by ensureCap('folders') through CAP_WITH in app.html
 * FLOW      loadFolderMetrics (cap-folders.js) → _FLD.metrics → _folderMetricsPane → _mBox tiles + _reconStrip
 * CARD      01-rail-core-the-chit/user-folders-and-auto-file-rules
 * ID        SCR004
 * OWNER     cb-rail
 * RISK      plain
 */
'use strict';
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
/** a measure or a dash: a missing figure is "nothing to measure", never zero */
function _metricOrDash(value, suffix) {
  return value === null || value === undefined ? '—' : value + (suffix || '');
}
/** the money by currency, one chip each ("no agreed value" when there is none) */
function _folderMoneyChipsHtml(moneyBlock) {
  if (!(moneyBlock.by_currency || []).length) return '<span style="font-size:var(--fs-2);color:var(--grey)">no agreed value</span>';
  return moneyBlock.by_currency
    .map(function (item) {
      return (
        '<span style="display:inline-block;border:1px solid var(--line);border-radius:9px;padding:3px 9px;margin:0 6px 6px 0;font-size:var(--fs-2)"><b>' +
        esc(item.currency) +
        '</b> ' +
        fmtMoney(item.total, item.currency) +
        ' <span style="color:var(--grey)">· ' +
        item.chits +
        ' chit' +
        (item.chits === 1 ? '' : 's') +
        '</span></span>'
      );
    })
    .join('');
}
/* ⚠️ NEVER ONE TOTAL ACROSS CURRENCIES, and the reason is said on screen rather than left as a design note. */
function _folderMoneyNoteHtml(moneyBlock) {
  return (
    (moneyBlock.mixed
      ? '<div style="font-size:var(--fs-1);color:var(--warn-2);margin-top:2px">' +
        txf('⚠️ More than one currency — these are {not} added together. A single total across currencies is a number that means nothing.', {
          not: '<b>' + tx('not') + '</b>'
        }) +
        '</div>'
      : '') +
    ((moneyBlock.excluded || {}).awaiting_agreement
      ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">' +
        moneyBlock.excluded.awaiting_agreement +
        ' chit(s) have no agreed value yet and are excluded — they are not counted as zero.</div>'
      : '')
  );
}
/** the first row of tiles: the counts (how many, unread, overdue, the oldest) */
function _folderCountTilesHtml(metrics) {
  var clock = metrics.clock || {};
  return (
    '<div style="display:flex;gap:9px;flex-wrap:wrap">' +
    _mBox(_FLD.recon ? 'On this track' : 'In this folder', metrics.count, (metrics.open || 0) + ' open · ' + (metrics.closed || 0) + ' closed') +
    _mBox('Unread', metrics.unread, metrics.unread ? 'nobody has opened these' : 'all seen', metrics.unread ? 'warn' : null) +
    _mBox('Overdue', metrics.overdue, txf('open for {days}+ days', { days: metrics.overdue_days }), metrics.overdue ? 'bad' : null) +
    _mBox('Oldest', _metricOrDash(clock.oldest_age_days, 'd'), 'the one nobody is working', clock.oldest_age_days > (metrics.overdue_days || 7) * 3 ? 'warn' : null) +
    '</div>'
  );
}
/** the second row of tiles: the clock and the disputes */
function _folderClockTilesHtml(metrics) {
  var clock = metrics.clock || {},
    disputes = metrics.disputes || {};
  return (
    /* ⚠️ RESPONSE and RESOLUTION side by side, never merged. Together they show "we answer fast and finish never",
       which is the commonest way a team looks fine and is not. */
    '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:9px">' +
    _mBox('Typical age', _metricOrDash(clock.median_age_days, 'd'), 'median, not average') +
    _mBox('First touch', _metricOrDash(clock.median_first_touch_days, 'd'), 'time to being read') +
    _mBox('To close', _metricOrDash(clock.median_to_close_days, 'd'), 'time to finished') +
    _mBox('Disputed', _metricOrDash(disputes.rate_pct, '%'), (disputes.open || 0) + ' open now', disputes.open ? 'bad' : null) +
    '</div>'
  );
}
/** the Metrics tab body: this folder's clock, disputes and other measures, or a spinner while they load */
function _folderMetricsPane() {
  if (_FLD.busy && !_FLD.metrics) return '<div style="padding:18px;color:var(--grey);font-size:var(--fs-2)"><span class="spin"></span> measuring…</div>';
  var metrics = _FLD.metrics;
  if (!metrics) return '<div style="padding:18px;color:var(--grey);font-size:var(--fs-2)">No metrics yet</div>';
  var moneyBlock = metrics.money || {};
  return (
    '<div style="padding:14px 18px">' +
    _reconStrip() +
    _folderCountTilesHtml(metrics) +
    _folderClockTilesHtml(metrics) +
    '<div style="margin-top:14px"><div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:5px">' +
    tx('Value') +
    '</div>' +
    _folderMoneyChipsHtml(moneyBlock) +
    _folderMoneyNoteHtml(moneyBlock) +
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
