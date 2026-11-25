/* app/cap-period-year.js — the YEAR-CLOSE CHECKS capability: the checks of a year still open (every month locked, what else stands in the way, each with the tab that fixes it), the actions under them, the evidence of a closed year and Reopen. Split out of cap-period.js, code moved verbatim; every sentence and figure is the server's.
 * OWNS      peYearFix · peYearWhy · peYearWarnLines · peYearChecksHtml · peYearActionsHtml · peYearClosedEvidence · peYearReopenHtml
 * CALLED BY public/accounts.html (script tag, before cap-period.js, same late group); cap-period.js peYearStatus calls it at run time; its functions are global
 * FLOW      peYearStatus (cap-period.js) → peYearChecksHtml (→ peYearFix, peYearWhy, peYearWarnLines) → peYearActionsHtml (→ peYearReopenHtml) · closed: peYearClosedEvidence
 * CARD      14-accounting/README
 * ID        BKS020
 * OWNER     cb-accounting
 * RISK      money
 */
'use strict';
/** the page's fix for a failing check: where to go (the check's own sentence says what is wrong) */
function peYearFix(x) {
  const s = (x.name || '') + ' ' + (x.why || '');
  if (x.code === 'PERIOD_RETURN_OPEN' || x.name === 'return_open') return { label: txf('Open {name}', { name: peReturnName() }), tab: 'gstclose' }; /* ACC-204: the server's code first */
  if (/month|lock/i.test(s)) return { label: tx('Open Month lock'), tab: 'lock' };
  if (/suspense/i.test(s)) return { label: tx('Open the Day book'), tab: 'daybook' };
  if (/balance|trial/i.test(s)) return { label: tx('Open Trial balance'), tab: 'tb' };
  return null;
}
/** F-16: the server's year-close sentence for the owner — dates as dates (bkDate), "still open: 2026-07" as month words, the raw period keys in [brackets] dropped */
function peYearWhy(text) {
  const words = String(text == null ? '' : text)
    .replace(/\s*\[\d{4}-[A-Za-z0-9]+\]/g, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, (iso) => bkDate(iso));
  const at = words.indexOf('still open:');
  if (at < 0) return words;
  const names = monthNames('short');
  return words.slice(0, at) + words.slice(at).replace(/\b(\d{4})-(0[1-9]|1[0-2])\b/g, (_, year, month) => names[Number(month) - 1] + ' ' + year);
}
/** the checks of a year still open: every month locked, then each thing the server says stands in the way (each with the tab that fixes it), or that nothing else does */
/** YE-F-08: the server's warnings (an auditor's open query, a bank not reconciled…) in the checks, beside the ticks — named, never a gate, so a warn line and no button */
function peYearWarnLines(list) {
  return (list || []).map((w, index) => '<div class="pe-check warn" data-testid="py-warn-' + index + '"><span>⚠</span><span>' + esc(peYearWhy(w.why)) + '</span></div>').join('');
}
function peYearChecksHtml(year, months, refs) {
  const open = months.filter((item) => item.status === 'open').length;
  let html = '';
  const notLocked = open + Math.max(0, 12 - months.length);
  html +=
    '<div class="pe-check ' +
    (notLocked ? 'bad' : 'ok') +
    '" data-testid="py-months"><span>' +
    (notLocked ? '✗' : '✓') +
    '</span><span>' +
    esc(notLocked ? txf('{n} of 12 months are not locked yet', { n: notLocked }) : tx('Every month is locked')) +
    '</span>' +
    (notLocked
      ? '<button data-cbsid="BKS016-B07" type="button" class="pe-fix" data-testid="py-fix-months" onclick="show(\'lock\')">' + esc(tx('Open Month lock')) + '</button>'
      : '') +
    '</div>';
  html += refs
    .map((x, index) => {
      const f = peYearFix(x);
      return (
        '<div class="pe-check bad" data-testid="py-check-' +
        index +
        '"><span>✗</span><span>' +
        esc(peYearWhy(x.why)) +
        '</span>' +
        (f ? '<button data-cbsid="BKS016-B08" type="button" class="pe-fix" data-testid="py-fix-' + index + '" onclick="show(\'' + f.tab + '\')">' + esc(f.label) + '</button>' : '') +
        '</div>'
      );
    })
    .join('');
  html += peYearWarnLines(year && year.warnings);
  if (!refs.length) html += '<div class="pe-check ok" data-testid="py-rest"><span>✓</span><span>' + esc(tx('Nothing else stands in the way')) + '</span></div>';
  return html;
}
/** under the checks: the lodged tick (owner, when the server allows closing once lodged), Close the year (owner), or why a non-owner cannot */
function peYearActionsHtml(yearState) {
  let html = '';
  if (!yearState.closed && peOwner() && yearState.can_close_if_lodged) html += peYearLodgedTick();
  if (!yearState.closed && peOwner())
    html +=
      '<div class="supacts">' +
      '<button data-cbsid="BKS016-B09" type="button" class="supact-pri" data-testid="py-close"' +
      (yearState.can_close ? '' : ' disabled') +
      ' onclick="peYearClose(this)">' +
      esc(tx(yearState.reclosing ? 'Close the year again' : 'Close the year')) + /* ACC-380: reopened, the server says reclosing */
      '</button></div>';
  html += peYearReopenHtml(yearState);
  if (!yearState.closed && !peOwner()) html += peNote('pe-readonly', 'Only the owner can close the year');
  return html;
}
/** YE-F-06: what the closed year shows as evidence — when and by whom, the returns declared lodged outside ChitBridge, the profit carried (the server's closed_with; a line it did not send is not drawn) */
function peYearClosedEvidence(st) {
  const w = st.closed_with;
  if (!w) return '';
  const lines = [];
  if (w.at) lines.push(w.by_name ? txf('Closed on {day} by {name}', { day: bkDate(String(w.at).slice(0, 10)), name: w.by_name }) : txf('Closed on {day}', { day: bkDate(String(w.at).slice(0, 10)) }));
  if (w.how === 'declared_lodged') lines.push(tx('Returns lodged outside ChitBridge, as you said'));
  if (w.profit_minor != null) lines.push(txf('Profit carried forward: {money}', { money: peMoney(w.profit_minor, w.currency) }));
  return lines.map((line, index) => '<div class="pe-note" data-testid="py-closed-' + index + '">' + esc(line) + '</div>').join('');
}
/** Reopen year: offered to the owner, and only on the newest closed year (from the periods list the screen holds); '' otherwise */
function peYearReopenHtml(yearState) {
  if (!yearState.closed || !peOwner()) return '';
  const newest = typeof bkLastClosedYear === 'function' ? bkLastClosedYear() : '', thisYear = yearState.fiscal_year || peVal('py_fy');
  if (newest && newest !== thisYear) return '';
  return (
    '<div class="supacts"><button data-cbsid="BKS016-B12" type="button" data-testid="py-reopen" onclick="peYearReopen(this)" title="' + esc(tx('Only the latest closed year can be reopened, with a reason; it is logged.')) + '">🔓 ' + esc(tx('Reopen year')) + '</button></div>'
  );
}
