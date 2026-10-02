/* list-unit-breaks.cjs — break each CBList rule once, run the proof against a COPY of public/, throw the copy away.
 * Nothing in the working tree is ever edited (never git checkout to restore). Each break must make its harness exit non-zero with an XX line.
 *
 * The rules (docs/design/list-control/PLAN.md › Proof):
 *   the unit reads nothing from its page · there is ONE chooser and ONE column resizer (the unit's) · a grid header always has a resize handle ·
 *   the column header never scrolls away with the rows · only the rows scroll · a width is remembered · storage that throws is survived · the
 *   head stays within 20% / 30% of the window · a column is never narrower than its label · phone cards come from the container · the count is the
 *   true one · Esc closes a popover · a header says how it is sorted · and a header drawn by hand anywhere (list-standard.cjs) is caught.
 * Run:  NODE_PATH=e2e/node_modules node e2e/list-unit-breaks.cjs     (BREAK_ONLY=<part of a name> to run one)                                     */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const W = path.join(__dirname, '..');
const UNIT = 'app/list-ctl.js', APP = 'app.html', BOOKS = 'app/cap-books.js';
const U = 'list-unit.cjs', S = 'list-standard.cjs';
const BREAKS = [
  ['the unit reads the host\'s UI.', U, UNIT, "    injectCss();\n    prune();\n    var key = String(o.key || el.id || 'list');", "    injectCss();\n    prune();\n    var vp = (typeof UI !== 'undefined' && UI.vp);\n    var key = String(o.key || el.id || 'list');"],
  ['the unit calls a host tx(', U, UNIT, "    var r = s;\n    if (I.o.t) {", "    var r = s;\n    if (typeof tx === 'function') r = tx(s);\n    if (I.o.t) {"],
  ['the unit borrows the host\'s esc', U, UNIT, "  function esc(s) { return", "  function esc(s) { if (typeof root.esc === 'function') return root.esc(s); return"],
  ['the unit borrows the host\'s storage prefix (uk)', U, UNIT, "  function skey(I) { return 'cblist.'", "  function skey(I) { if (typeof uk === 'function') return uk('cblist.' + I.key); return 'cblist.'"],
  ['a second chooser builder (platColMenuHTML)', U, APP, "function platTablePaint(b, opts){", "function platColMenuHTML(){ return ''; }\nfunction platTablePaint(b, opts){"],
  ['a second column resizer (*ColResize*)', U, BOOKS, "function bkLgMount(el, r) {", "function bkColResizeStart(e){ e.preventDefault(); }\nfunction bkLgMount(el, r) {"],
  ['a grid header without a resize handle', U, UNIT, 'class="cbl-rz colrz" data-rz="', 'class="cbl-rz colrz" data-xx="'],
  ['the column header scrolls away with the rows', U, UNIT, "'.cbl .cbl-hdr{position:sticky;top:0;z-index:5;", "'.cbl .cbl-hdr{position:relative;top:0;z-index:5;"],
  ['the rows do not scroll in their own area', U, UNIT, "'.cbl .cbl-list{flex:1;min-height:0;overflow:auto;", "'.cbl .cbl-list{flex:1;min-height:0;overflow:visible;"],
  ['a dragged width is not remembered', U, UNIT, "var s = I.s, v = { cols: s.cols, widths: s.widths,", "var s = I.s, v = { cols: s.cols, widths: {},"],
  ['storage that throws breaks the list', U, UNIT, "function lsSet(k, v) { MEM[k] = v; try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }", "function lsSet(k, v) { MEM[k] = v; root.localStorage.setItem(k, JSON.stringify(v)); }"],
  ['the head grows past 20% of the window', U, UNIT, "gap:6px 10px;padding:8px 20px 6px;border-bottom:1px solid var(--cl-soft)", "gap:6px 10px;padding:90px 20px 6px;border-bottom:1px solid var(--cl-soft)"],
  ['a column can be squeezed below its label', U, UNIT, "function minW(I, c) { return Math.max(64, String(c.label || c.key).length * 9 + 40); }", "function minW(I, c) { return 8; }"],
  ['phone cards stop (sideways scroll at 390 px)', U, UNIT, "@container list (max-width: 620px){", "@container list (max-width: 1px){"],
  ['the count says what is drawn, not what matched', U, UNIT, "var t = T(I, '{n} shown', { n: m.rows.length });", "var t = T(I, '{n} shown', { n: Math.min(50, m.rows.length) });"],
  ['Esc no longer closes a popover', U, UNIT, "    if (!I.pop) return; var was = I.pop;", "    if (!I.pop || refocus) return; var was = I.pop;"],
  ['a column header stops saying how it is sorted', U, UNIT, 'role="columnheader" aria-sort="', 'role="columnheader" data-sort-state="'],
  ['a hand-drawn column header (role=columnheader) in the app', S, APP, "function platTablePaint(b, opts){", "function handDrawnList(){ return '<div role=\"columnheader\">Name</div>'; }\nfunction platTablePaint(b, opts){"],
  ['a hand-drawn <thead> list in a ledger view', S, BOOKS, "function bkLgMount(el, r) {", "function bkHandTable(){ return '<table><thead><tr><th>Date</th></tr></thead></table>'; }\nfunction bkLgMount(el, r) {"],
  ['a hand-drawn .lhead in CB Accounts', S, 'accounts.html', "async function accBills(body){", "function accHandHead(){ return '<div class=\"lhead\">Who</div>'; }\nasync function accBills(body){"],
];
const ONLY = process.env.BREAK_ONLY || '';
let good = 0, ran = 0;
for (const [name, harness, rel, a, b] of BREAKS) {
  if (ONLY && name.indexOf(ONLY) < 0) continue;
  ran++;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cbl-'));
  try {
    fs.cpSync(path.join(W, 'public'), path.join(tmp, 'public'), { recursive: true });
    /* a CRLF checkout (Windows) must match the same anchors: match on LF text, write back in the file's own endings */
    const f = path.join(tmp, 'public', rel), raw = fs.readFileSync(f, 'utf8'), crlf = raw.indexOf('\r\n') >= 0, s = raw.replace(/\r\n/g, '\n'), n = s.split(a).length - 1;
    if (n !== 1) { console.log('  ??  ' + name + ': anchor x' + n + ' in ' + rel); continue; }
    const out = s.split(a).join(b);
    fs.writeFileSync(f, crlf ? out.replace(/\n/g, '\r\n') : out);
    const r = cp.spawnSync(process.execPath, ['e2e/' + harness], { cwd: W, encoding: 'utf8', timeout: 600000, env: Object.assign({}, process.env, { CBL_ROOT: path.join(tmp, 'public') }) });
    const xx = (r.stdout || '').split('\n').filter((l) => /^\s+(XX|✗)/.test(l));
    const caught = r.status !== 0;
    if (caught) good++;
    console.log((caught ? '  ok  ' : '  XX  ') + 'broken: ' + name + ' → ' + (caught ? 'caught by ' + harness + ': ' + (xx[0] || (r.stderr || '').split('\n').filter(Boolean)[0] || 'harness stopped').trim().slice(0, 150) : 'NOT caught'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
console.log('\n  ' + good + '/' + ran + ' breaks caught');
process.exitCode = good === ran ? 0 : 1;
