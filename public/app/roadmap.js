/* roadmap.js — CBRoadmap: THE FRONT DOOR'S ROADMAP, drawn from public/app/manifest.json and from nothing else.
 *   CBRoadmap.mount(el, manifest)   three folds: where we are going · how it fits together · what the rail adds
 * It reads no session and no /api: a stranger who has not signed in sees the same page (Athi, 2026-10-09), so it holds no figure
 * about any shop. Every chip is the entry's `state` (built ✓ · coming ◌ · workshop ⚒): a symbol and a word, never colour alone.
 * Entry keys it reads: area · name · state · works · rows · phase · fits (the dictionary is the manifest's own "_" line).
 * Plan ids (rows · phase) are never printed: a reader cannot use "M62". They sit in the row's tooltip and in data-plan for a tester.
 * `works` = a workshop row whose function works today (Connectors): drawn built, so the roadmap and the product agree.
 * mount(el, manifest, { quiet:true }) is for a signed-in reader: the page is the working app, so the roadmap is ONE quiet fold, "Where we are going ›".
 * The rail comparison is static copy (BACKLOG 2026-10-02 INDEX PAGE); each mark is ✓ · partly · planned, never more than is built. */
(function (root) {
  'use strict';
  var STATE = { built: { sym: '✓', word: 'built' }, coming: { sym: '◌', word: 'coming' }, workshop: { sym: '⚒', word: 'being built' }, partly: { sym: '◐', word: 'part built' } };
  var AREAS = [['selling', 'Selling'], ['running', 'Running'], ['labs', 'Labs'], ['setup', 'Setup']];
  /* the diagram: which manifest rows stand at which place around the rail (a place = one row, or all rows of an area) */
  var AROUND = [['till', 'Till'], ['accounts', 'CB Accounts'], ['crm', 'CB CRM'], ['trade', 'CB Trade'], ['connectors', 'Connectors'], ['@labs', 'Labs']];
  var MARKS = { yes: ['✓', 'yes'], part: ['◐', 'partly'], planned: ['◌', 'planned'], no: ['–', 'no'] };
  var COMPARE = [
    ['Both sides hold the same bill', 'yes', 'no', 'no', 'no', 'part'],
    ['One frozen invoice both books post', 'part', 'no', 'no', 'no', 'no'],
    ['A dispute both sides can see', 'yes', 'no', 'no', 'part', 'no'],
    ['Works when the other side is not on it', 'yes', 'yes', 'yes', 'yes', 'yes'],
    ['Books and tax for your shop', 'yes', 'yes', 'yes', 'no', 'part'],
    ['Trade across borders', 'planned', 'no', 'no', 'no', 'no']
  ];
  /* each headline is a row of COMPARE (idx) so its mark is the table's mark, never a second claim; a sentence says what it means */
  var ATTRS = [
    ['Chits both parties hold', 0, 'You and the business you trade with each keep a copy of the same chit.'],
    ['One frozen invoice both books post', 1, 'The invoice is fixed when it is sent. Both sides read the same one; posting it into the other side\'s books is only partly built.'],
    ['A one-sided fallback for parties not on it', 3, 'If the other business is not on ChitBridge, you still keep your own side.'],
    ['You send what you choose; nothing is kept for others', null, 'We pass on only what you send, and hold no copy for anyone else.']
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function eff(e) { return e.works && e.state === 'workshop' ? 'built' : e.state; }
  function chip(st) { var s = STATE[st] || STATE.coming; return '<span class="rm-chip rm-' + esc(st) + '" data-state="' + esc(st) + '"><span aria-hidden="true">' + s.sym + '</span> ' + s.word + '</span>'; }
  function count(es, st) { return es.filter(function (e) { return eff(e) === st; }).length; }
  /* a place that stands for several rows is "built" only when all are; some built = part built */
  function stateOf(es) { if (!es.length) return 'coming'; var b = count(es, 'built'); return b === es.length ? 'built' : (b ? 'partly' : eff(es[0])); }

  var CSS = '.rm{margin:0 0 16px;display:grid;gap:8px;font-size:13.5px;color:var(--ink,#1D1B16)}'
    + '.rm details{border:1px solid var(--line,#DDD6C6);border-radius:12px;background:var(--card,#fff)}'
    + '.rm summary{cursor:pointer;padding:11px 14px;font-weight:700;list-style:none;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}'
    + '.rm summary::-webkit-details-marker{display:none}.rm summary::before{content:"›";color:var(--faint,#8A8374)}.rm details[open]>summary::before{content:"⌄"}'
    + '.rm summary small{font-weight:500;color:var(--muted,#5E594D)}'
    + '.rm .rm-body{padding:2px 14px 14px;overflow-x:auto}'
    + '.rm h4{margin:12px 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#5E594D)}'
    + '.rm ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}'
    + '.rm li{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:baseline;padding:6px 0;border-top:1px solid var(--hair,#F0ECE2)}'
    + '.rm li .rm-n{font-weight:600}.rm li .rm-f{grid-column:2;color:var(--muted,#5E594D);font-size:12.5px}'
    + '.rm-chip{display:inline-flex;gap:4px;align-items:center;white-space:nowrap;font-size:12px;font-weight:700;padding:1px 9px;border-radius:999px;border:1px solid var(--line,#DDD6C6);color:var(--muted,#5E594D)}'
    + '.rm-built{border-color:var(--green-b,#A9D3BC);background:var(--green-t,#E8F4ED);color:var(--green-d,#0D4A2B)}'
    + '.rm-coming{border:1px dashed var(--amber-b,#EFD39A);background:var(--amber-t,#FDF3DC);color:var(--amber-i,#7A5205)}'
    + '.rm-workshop{border:1px dashed var(--blue-b,#B9D2EF);background:var(--blue-t,#E4EEFA);color:var(--blue-i,#174A87)}'
    + '.rm-partly{border:1px dashed var(--green-b,#A9D3BC);background:var(--green-t,#E8F4ED);color:var(--green-d,#0D4A2B)}'
    + '.rm li .rm-f.rm-ph{font-family:var(--f-mono,"IBM Plex Mono",monospace);font-size:11.5px;color:var(--faint,#8A8374)}'
    + '.rm-fit{display:grid;grid-template-columns:repeat(3,1fr);grid-template-areas:"a b c" "d r o" "e f f";gap:10px;padding:12px;border:2px dashed var(--line,#DDD6C6);border-radius:18px}'
    + '.rm-nd{border:1px solid var(--line,#DDD6C6);border-radius:12px;padding:8px 10px;display:grid;gap:4px;justify-items:start;background:var(--card,#fff);min-width:0}'
    + '.rm-nd b{font-size:13.5px}.rm-nd.rm-built{background:var(--green-t,#E8F4ED);border-color:var(--green-b,#A9D3BC)}'
    + '.rm-nd.rm-coming{border-style:dashed;background:var(--amber-t,#FDF3DC)}.rm-nd.rm-workshop{border-style:dashed;background:var(--blue-t,#E4EEFA)}.rm-nd.rm-partly{border-style:dashed}'
    + '.rm-nd small{color:var(--muted,#5E594D)}'
    + '.rm-other{border:2px solid var(--blue,#2F74C9);background:var(--blue-t,#E4EEFA);border-radius:14px;padding:10px;display:grid;gap:3px;align-content:center;text-align:center;min-width:0}.rm-other b{color:var(--blue-i,#174A87)}'
    + '.rm .rm-q>details{border:0;background:none}.rm .rm-q>details>summary{font-weight:600;color:var(--muted,#5E594D);padding:6px 2px}.rm .rm-q .rm-inner{display:grid;gap:8px;padding:6px 0}'
    + '.rm-attrs li{grid-template-columns:1fr auto}.rm-attrs .rm-f{grid-column:1 / -1}'
    + '.rm-hub{grid-area:r;border:2px solid var(--green,#16693F);border-radius:14px;padding:10px;text-align:center;background:var(--green-t,#E8F4ED);display:grid;gap:3px;align-content:center;min-width:0}'
    + '.rm-hub b{font-family:"Bricolage Grotesque",sans-serif;font-size:17px}'
    + '.rm table{width:100%;border-collapse:collapse;font-size:12.5px}.rm th,.rm td{padding:6px 6px;border-top:1px solid var(--hair,#F0ECE2);text-align:center}'
    + '.rm th:first-child,.rm td:first-child{text-align:left}.rm th{font-weight:700;color:var(--muted,#5E594D)}'
    + '.rm td.rm-yes{color:var(--green-d,#0D4A2B);font-weight:700}.rm td.rm-planned{color:var(--amber-i,#7A5205)}'
    + '.rm .rm-note{color:var(--muted,#5E594D);margin:8px 0 0;font-size:12.5px}'
    + '@media(max-width:700px){.rm-fit{grid-template-columns:1fr 1fr;grid-template-areas:"r r" "o o" "a b" "c d" "e f"}.rm summary{padding:10px 12px}.rm .rm-body{padding:2px 12px 12px}}';

  function groups(es) {
    return AREAS.map(function (a) {
      var rows = es.filter(function (e) { return e.area === a[0]; });
      if (!rows.length) return '';
      return '<h4 data-testid="rm-area-' + a[0] + '">' + a[1] + '</h4><ul>' + rows.map(function (e) {
        var meta = [e.phase].concat(e.rows || []).filter(Boolean).join(' · ');
        return '<li data-testid="rm-item-' + esc(e.id) + '" data-state="' + esc(eff(e)) + '"' + (meta ? ' data-plan="' + esc(meta) + '" title="' + esc('Plan: ' + meta) + '"' : '') + '>' + chip(eff(e)) + '<span class="rm-n">' + esc(e.name) + '</span>'
          + (e.fits ? '<span class="rm-f">' + esc(e.fits) + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    }).join('');
  }
  function fit(es) {
    var places = 'abcdef'.split('');
    var nodes = AROUND.map(function (p, i) {
      var set = p[0].charAt(0) === '@' ? es.filter(function (e) { return e.area === p[0].slice(1); }) : es.filter(function (e) { return e.id === p[0]; });
      var st = stateOf(set);
      if (p[0].charAt(0) !== '@' && set.length === 1 && set[0].works) st = 'built';
      return '<div class="rm-nd rm-' + st + '" data-testid="rm-fit-' + esc(p[0].replace('@', '')) + '" data-state="' + st + '" style="grid-area:' + places[i] + '"><b>' + esc(p[1]) + '</b>' + chip(st)
        + (set.length > 1 ? '<small>' + count(set, 'built') + ' of ' + set.length + ' built</small>' : '') + '</div>';
    });
    /* the OTHER party: the picture is two businesses and one chit, not one business and its apps (the one-to-many idea) */
    var other = '<div class="rm-other" data-testid="rm-fit-other" style="grid-area:o"><b>The other business</b><small>Your supplier or your customer holds the same chit in their own books.</small><small>One chit, many businesses.</small></div>';
    return '<div class="rm-fit" data-testid="rm-fit">' + nodes.join('') + '<div class="rm-hub" data-testid="rm-fit-rail"><b>ChitBridge</b><small>the same chit, held by both sides</small></div>' + other + '</div>';
  }
  function compare() {
    var head = ['', 'ChitBridge', 'Tally', 'Zoho', 'WhatsApp', 'Paper'];
    return '<ul class="rm-attrs" data-testid="rm-attrs">' + ATTRS.map(function (a, i) {
      var m = a[1] == null ? '' : MARKS[COMPARE[a[1]][1]], mk = m ? '<span class="rm-chip rm-' + (COMPARE[a[1]][1] === 'yes' ? 'built' : 'partly') + '" data-testid="rm-attr-mark-' + i + '"><span aria-hidden="true">' + m[0] + '</span> ' + m[1] + '</span>' : '';
      return '<li data-testid="rm-attr-' + i + '"><span class="rm-n">' + esc(a[0]) + '</span>' + mk + '<span class="rm-f">' + esc(a[2]) + '</span></li>';
    }).join('') + '</ul>'
      + '<div style="overflow-x:auto"><table data-testid="rm-compare"><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>'
      + COMPARE.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td>' + r.slice(1).map(function (m) { var k = MARKS[m]; return '<td class="rm-' + m + '"><span aria-hidden="true">' + k[0] + '</span> ' + k[1] + '</td>'; }).join('') + '</tr>'; }).join('')
      + '</tbody></table></div><p class="rm-note">Partly = some of it works today. Planned = not built. Use the rail beside your books, not instead of them.</p>';
  }
  function mount(el, manifest, opts) {
    if (!el) return;
    var es = (manifest && manifest.entries) || [];
    if (!document.getElementById('rm-css')) { var s = document.createElement('style'); s.id = 'rm-css'; s.textContent = CSS; document.head.appendChild(s); }
    if (!es.length) { el.innerHTML = ''; return; }
    var q = !!(opts && opts.quiet);
    el.innerHTML = (q ? '<div class="rm" data-testid="roadmap"><div class="rm-q" data-testid="rm-quiet"><details data-testid="rm-quiet-fold"><summary>Where we are going ›</summary><div class="rm-inner">' : '<div class="rm" data-testid="roadmap">')
      + '<details data-testid="rm-going"><summary>Where we are going <small>' + count(es, 'built') + ' built · ' + count(es, 'coming') + ' coming · ' + count(es, 'workshop') + ' being built</small></summary><div class="rm-body">' + groups(es) + '</div></details>'
      + '<details data-testid="rm-fits"><summary>How it fits together</summary><div class="rm-body">' + fit(es) + '</div></details>'
      + '<details data-testid="rm-rail"><summary>What ChitBridge adds</summary><div class="rm-body">' + compare() + '</div></details>' + (q ? '</div></details></div></div>' : '</div>');
  }
  root.CBRoadmap = { mount: mount, stateOf: stateOf };
})(typeof window !== 'undefined' ? window : this);
