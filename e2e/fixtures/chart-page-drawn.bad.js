/* e2e/fixtures/chart-page-drawn.bad.js — A PAGE THAT DRAWS ITS OWN CHART. It is the hostile fixture of e2e/chart-smoke.cjs and is never loaded by a page:
   the guard must flag every one of the three shapes below, or the guard is broken. Do not "fix" this file. */
function badBars(rows) {
  var out = '<svg viewBox="0 0 300 100" role="img" aria-label="Sales">';
  rows.forEach(function (row, i) {
    out += '<rect x="' + i * 20 + '" y="' + (100 - row.v) + '" width="14" height="' + row.v + '"/>';
  });
  return out + '</svg>';
}
function badLine(values) {
  return '<svg viewBox="0 0 300 56"><polyline points="' + values.join(' ') + '" fill="none" stroke="var(--blue)"/></svg>';
}
function badPie(share) {
  return '<div style="border-radius:50%;background:conic-gradient(var(--blue) 0 ' + share + '%, var(--grey) 0)"></div>';
}
