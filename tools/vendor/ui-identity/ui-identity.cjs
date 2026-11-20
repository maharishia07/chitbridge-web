'use strict';
/* OWNS: the census of popups and controls against the one screen register (SCREENS.json) -> PM/UI-IDENTITY.json (UX-137 step 1).
   CALLED BY: toolset/coverage-hourly.sh (--write), toolset/coverage/yardstick.cjs (reads the JSON, row "ui_identity"); --check is the future build guard.
   RULE (Athi 2 Nov, restated 8 Nov): every popup and control has a code ON THE ELEMENT and a row in the register; a reused mount carries its path.
   It reads source only (the web checkout from dirs.cjs, origin/main in the hourly run). It never runs the app and never assigns a code.

   THE COUNTING RULES (written down so the number means one thing):
   POPUP  = one call site that opens a dialog: modal( · ChitSheet.open( · .showModal( · openSheet( · <dialog · role="dialog", comments excluded.
            A call of the library popup, ui.dialog({ pop: 'POPnnn', ... }) (web popups swap, 13 Nov), is one site too; it names its register code as a literal
            pop: in its OWN argument object (braces matched from the open paren, dialog-pop.cjs; never a neighbour's). That code is its identity
            (IDENTIFIED when it is a live Popup row) and it is LIBRARY. A call with no pop: is a site, unidentified.
            NATIVE DIALOGS (14 Nov, reg/popups-20-1114): one more family read the same way, never a second scanner. <dialog ...> and role="dialog" are identified by
            data-pop="POPnnn" on the tag itself (the attribute ui.dialog already writes); data-pop="host" marks a container whose content popups are identified
            by their own openers (not a site). .showModal( is identified like modal(: its top-level function has a live "Popup > fn" row and opens one native
            dialog; with no top-level function (an indented helper) the file's single data-pop tag code is its code. openSheet( calls resolve to the row of
            the function openSheet. NOT SITES (prose, not an opener): an opener word inside a string, an inline block comment, or a key: 'string' literal line;
            the one library host call in app/ui.js (its popups are the ui.dialog( sites). For showModal the holding function may be async (modal() keeps the register's sync-only rule, screens.cjs popupsFromSource).
            Its identity is the top-level function holding it (screens.cjs popupsFromSource: `function X(` at column 0), because modalStamp() looks the
            running function up in CBSCREENS.byFn. A popup is IDENTIFIED when its function has a live "Popup > fn" row AND opens exactly one dialog by
            modal( (a code naming two dialogs is the failure the register exists to remove). Other openers are not in the register at all: missing.
   CONTROL = one opening tag in source: button, input (not hidden), select, textarea, role=tab|menuitem|button|switch|option, and a chip (any other
            tag with onclick= or data-act=). A control is IDENTIFIED when its tag carries data-cbsid="AAA###" and that code is a live register row.
            The register keys a control by "screen > label" from the sweep, never by an attribute, so a label match is reported separately
            (label_row: the label has a live CTL row, but nothing on the element says so) and does NOT count as identified.
   REUSED  = an element in a file that more than one page loads (app/*.js); its path is file@page,page. The register has no mount field yet, so every
            reused element is also listed as reused_no_path.
   ORPHAN  = a live register row (POP or CTL) with no element: POP whose function opens no dialog in source; CTL whose label text is in no scanned source.
   RETIRED = a retired code that still reaches the browser (public/app/screens.js rows).
   POPUPS TO GREEN (15 Nov): (1) modal(html, wide, { pop: 'POPnnn' }) is a call that names its own dialog, read like ui.dialog's pop (dialog-pop.cjs, opener 'modal'): that code is its
            identity when it is a live Popup row, whatever function holds it, so one function may open several dialogs and the loading, error and result states of ONE dialog
            share its code. The page's modal() writes the code in the header chip, so what the person quotes is what the register holds.
            (2) A live Popup row is also CLAIMED (not an orphan) by an element that carries its code in source: data-pop="POPnnn" in markup or setAttribute('data-pop', 'POPnnn')
            (an overlay or popover a script draws, read from every public page and script). The element is not a counted site; the row simply has an opener.
            (3) A block comment that opens at a line start is prose to the line that closes it (an opener word in it is not a site).
   Files scanned: public/app.html, public/till.html, the small apps (accounts finance crm tasks settings employees network operations catalogue .html), public/app/*.js. */
const fs = require('fs'), path = require('path');
const { popOf } = require('./dialog-pop.cjs');
const makePassThrough = require('./ui-identity-passthrough.cjs'); /* helper stamp pass-through + prose tags (UX-137 w4) */
const DEV = path.resolve(__dirname, '..', '..');
const WEB = process.env.UIID_WEB || require('./dirs.cjs')(DEV).WEB;
const REGP = process.env.UIID_REG || path.join(DEV, 'SCREENS.json');
const OUT = path.join(DEV, 'PM', 'UI-IDENTITY.json');
const args = process.argv.slice(2), CHECK = args.includes('--check'), WRITE = args.includes('--write');
const NL = String.fromCharCode(10), CR = String.fromCharCode(13);
const rd = (p) => fs.readFileSync(p, 'utf8').split(CR + NL).join(NL);
const PUB = path.join(WEB, 'public');
/* the headline census stays on the 11, plus every public/*.html that carries a data-cbsid (a stamped utility page must count, UX-137); toolset/web-done.cjs widens to every page */
const STAMPED = fs.readdirSync(PUB).filter((f) => /.html$/.test(f) && /data-cbsid=/.test(rd(path.join(PUB, f)))).sort();
const PAGES = process.env.UIID_PAGES === 'all'
  ? fs.readdirSync(PUB).filter((f) => /.html$/.test(f)).sort()
  : [...new Set(['app.html', 'till.html'].concat(['accounts', 'finance', 'crm', 'tasks', 'settings', 'employees', 'network', 'operations', 'catalogue'].map((a) => a + '.html')).concat(STAMPED))];
const JSF = fs.readdirSync(path.join(PUB, 'app')).filter((f) => /\.js$/.test(f)).map((f) => 'app/' + f);
const FILES = PAGES.filter((f) => fs.existsSync(path.join(PUB, f))).concat(JSF);

const reg = JSON.parse(fs.readFileSync(REGP, 'utf8')).screens;
const live = Object.entries(reg).filter(([, s]) => !s.retired);
const liveCodes = new Set(live.map(([, s]) => s.code));
const retiredCodes = new Set(Object.values(reg).filter((s) => s.retired).map((s) => s.code));
const livePop = {}; live.forEach(([k, s]) => { if (k.startsWith('Popup › ')) livePop[k.slice(8)] = s.code; });
const { helperStamps, passThrough, proseTag } = makePassThrough(liveCodes);
const liveCtlLabels = {}, stampedRows = {}; /* UX-137 step 2: a row written by toolset/ui-identity/ui-stamp.cjs (source 'ui-stamp') is found by its CODE on the element, never by its label */
live.forEach(([k, s]) => { if (!k.startsWith('Control › ')) return; if (s.source === 'ui-stamp') stampedRows[s.code] = k; else liveCtlLabels[k.split(' • ').slice(1).join(' • ').trim().toLowerCase()] = s.code; });

/* which pages load which script: a script loaded by more than one page is a reused mount */
const mounts = {};
for (const p of PAGES) {
  if (!fs.existsSync(path.join(PUB, p))) continue;
  for (const m of rd(path.join(PUB, p)).matchAll(/<script[^>]+src="[^"]*?\/?(app\/[^"?]+\.js)/g)) (mounts[m[1]] = mounts[m[1]] || new Set()).add(p);
}
const mountOf = (f) => (mounts[f] && mounts[f].size > 1 ? [...mounts[f]].sort() : null);

/* the text of a file without prose: comment-only lines and HTML comments go (a comment that says modal( is not a dialog) */
function code(src) {
  const lines = src.replace(/<!--[\s\S]*?-->/g, (m) => m.split(NL).map(() => '').join(NL)).split(NL);
  let inBlock = false; /* a block comment that opens at a line start runs, blank, to the line that holds its */
  return lines.map((L) => {
    const t = L.trim();
    if (inBlock) { if (L.includes('*/')) inBlock = false; return ''; }
    if (t.slice(0, 2) === '/*' && t.indexOf('*/', 2) < 0) { inBlock = true; return ''; }
    return t.charAt(0) === '*' || t.slice(0, 2) === '//' || t.slice(0, 2) === '/*' ? '' : L;
  });
}

/* the opener word is prose, not an opener: inside a string literal (modal), or on a key: 'string' data line (a tag or role named in a table of text) */
const LIB_HOST = { 'app/ui.js': /^\s*modal\(dialogHead\(/ }; /* ui.dialog's own host call: its popups are counted at the ui.dialog( sites */
function inString(pre) { let q = null; for (let k = 0; k < pre.length; k++) { const c = pre[k]; if (q) { if (c === String.fromCharCode(92)) k++; else if (c === q) q = null; } else if (c === "'" || c === '"' || c === '`') q = c; } return q !== null; }
function proseOpener(kind, L, at) {
  if (kind === 'modal') return inString(L.slice(0, at));
  if (kind === 'dialog-tag' || kind === 'role-dialog') return /^\s*[A-Za-z_$][\w$]*:\s*(['"`]).*\1,?\s*$/.test(L) && !/<dialog\s+[a-z]/.test(L);
  return false;
}
/* data-pop on the opening tag that holds the match: from the last < before it to the first > after it (up to 8 lines on) */
function tagPop(lines, i, at) {
  let from = lines[i].slice(0, at + 1).lastIndexOf('<'), k = i;
  while (from < 0 && k > i - 3 && k > 0) { k--; from = lines[k].lastIndexOf('<'); }
  if (from < 0) return null;
  const txt = lines[k].slice(from) + ' ' + lines.slice(k + 1, i + 8).join(' ');
  const tag = txt.slice(0, txt.indexOf('>') < 0 ? txt.length : txt.indexOf('>'));
  const m = tag.match(/data-pop=\\?["'](POP\d{3}|host)\\?["']/);
  return m ? m[1] : null;
}
/* element codes (14 Nov, popups r4): a data-pop on a <dialog> tag, or set on a dialog a script creates, el.setAttribute('data-pop','POPnnn'); each is kept with the top-level function (async too) that holds it, so a showModal() reads its element's code, not its holder's name */
const elemPops = [], SETPOP = /setAttribute\(\s*['"]data-pop['"]\s*,\s*['"](POP\d{3})['"]/;
/* the dialog a showModal() opens, by id: node.showModal() where node = el('id') or document.getElementById('id') within the 70 lines above */
function idOfVar(lines, from, name) {
  const asg = new RegExp('\\b' + name.replace(/\$/g, '\\$') + '\\s*=\\s*(?:el|document\\.getElementById)\\(\\s*[\'"]([\\w-]+)[\'"]');
  for (let k = from; k >= 0 && k > from - 70; k--) { const m = lines[k].match(asg); if (m) return m[1]; }
  return null;
}
/* three shapes (till, 14 Nov): the variable above; getElementById('id').showModal() in one chain; a first parameter, whose id is the one its ONE caller passes, fn(x) with x from getElementById */
function openedId(lines, i, L) {
  const chain = L.match(/(?:el|document\.getElementById)\(\s*['"]([\w-]+)['"]\s*\)\s*\.showModal\s*\(/); if (chain) return chain[1];
  const v = L.match(/([A-Za-z_$][\w$]*)\.showModal\s*\(/); if (!v) return null;
  const own = idOfVar(lines, i, v[1]); if (own) return own;
  let k = i; while (k >= 0 && !/^(?:async\s+)?function\s/.test(lines[k])) k--;
  const sig = k >= 0 && lines[k].match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/);
  if (!sig || sig[2].split(',')[0].trim() !== v[1]) return null;
  const calls = [];
  lines.forEach((C, j) => { const at = j === k ? -1 : C.indexOf(sig[1] + '('), arg = at < 0 ? null : C.slice(at + sig[1].length + 1).match(/^\s*([A-Za-z_$][\w$]*)\s*\)/); if (arg) calls.push([j, arg[1]]); });
  return calls.length === 1 ? idOfVar(lines, calls[0][0], calls[0][1]) : null;
}
/* the code a dialog's own variable was stamped with: node.setAttribute('data-pop','POPnnn') within the 70 lines above the node.showModal() */
function openedPop(lines, i, L) {
  const v = L.match(/([A-Za-z_$][\w$]*)\.showModal\s*\(/); if (!v) return null;
  const set = new RegExp('\\b' + v[1].replace(/\$/g, '\\$') + '\\.setAttribute\\(\\s*[\'"]data-pop[\'"]\\s*,\\s*[\'"](POP\\d{3})[\'"]');
  for (let k = i; k >= 0 && k > i - 70; k--) { const m = lines[k].match(set); if (m) return m[1]; }
  return null;
}
const idPops = {}; /* file:id -> POP code, from a <dialog ... id="x" data-pop="POPnnn"> tag */
const popups = [], elements = [], ctl = { found: 0, identified: 0, label_row: 0, kinds: {}, byFile: {}, reused: 0 };
const CTLRE = /<(button|input|select|textarea|a|div|span|li|label|td|i|b|p)\b([^>]*)>([^<]{0,80})/g;
const OPEN = [['modal', /\bmodal\s*\(/], ['ChitSheet', /\bChitSheet\s*\.\s*open\s*\(/], ['showModal', /\.showModal\s*\(/], ['openSheet', /\bopenSheet\s*\(/], ['dialog-tag', /<dialog\b/], ['role-dialog', /role=["']dialog["']/]];
let corpus = '';
for (const f of FILES) {
  const lines = code(rd(path.join(PUB, f)));
  corpus += lines.join(NL) + NL;
  let cur = null, curAny = null;
  lines.forEach((L, i) => {
    const d = L.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/), da = L.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (da) curAny = da[1];
    if (d) cur = d[1];
    const Lc = L.replace(/\/\*(?:(?!\*\/).)*\*\//g, ''); /* an inline block comment is prose */
    for (const [kind, re] of OPEN) {
      const hit = re.exec(Lc);
      if (!hit || /^\s*(?:async\s+)?function\s+(modal|openSheet)\s*\(/.test(L) || proseOpener(kind, Lc, hit.index) || (LIB_HOST[f] && LIB_HOST[f].test(L))) continue;
      const p = { file: f, line: i + 1, fn: kind === 'showModal' ? curAny : cur, kind, mount: mountOf(f) };
      if (kind === 'modal') p.optPop = popOf(lines.slice(i, i + 400).join(NL), 'modal'); /* modal(html, wide, { pop: 'POPnnn' }): the call names its own dialog */
      if (kind === 'showModal') { p.openId = openedId(lines, i, Lc); p.openPop = openedPop(lines, i, Lc); }
      if (kind === 'dialog-tag' || kind === 'role-dialog') { p.tagPop = tagPop(lines, i, hit.index); if (p.tagPop && p.tagPop !== 'host') elemPops.push({ file: f, fn: curAny, code: p.tagPop }); }
      popups.push(p);
    }
    /* the call's own argument object only (dialog-pop.cjs); a call with no pop: is still a site, unidentified */
    const sp = L.match(SETPOP); if (sp) elemPops.push({ file: f, fn: curAny, code: sp[1] });
    const ud = /\bui\.dialog\s*\(/.exec(Lc); /* ui.dialog( inside a string literal is text (a gallery caption), or in an inline block comment (UX-137 w4), not a call */
    if (ud && !inString(L.slice(0, ud.index))) popups.push({ file: f, line: i + 1, fn: cur, kind: 'ui-dialog', pop: popOf(lines.slice(i, i + 400).join(NL)), mount: mountOf(f) });
  });
  const text = lines.join(NL);
  for (const m of text.matchAll(/<dialog\b[^>]*>/g)) { const id = m[0].match(/\bid=\\?["']([\w-]+)/), dp = m[0].match(/data-pop=\\?["'](POP\d{3})/); if (id && dp) idPops[f + ':' + id[1]] = dp[1]; }
  const fileStamps = helperStamps(text);
  const bf = (ctl.byFile[f] = { found: 0, identified: 0, label_row: 0, reused: !!mountOf(f) });
  let m;
  CTLRE.lastIndex = 0;
  while ((m = CTLRE.exec(text))) {
    const tag = m[1], attrs = m[2] || '';
    let kind = null;
    if (tag === 'button') kind = 'button';
    else if (tag === 'input') kind = /type=["']hidden["']/.test(attrs) ? null : 'input';
    else if (tag === 'select' || tag === 'textarea') kind = tag;
    else if (/role=["']tab["']/.test(attrs)) kind = 'tab';
    else if (/role=["']menuitem["']/.test(attrs)) kind = 'menuitem';
    else if (/role=["'](button|switch|option)["']/.test(attrs)) kind = 'button';
    else if (/\sonclick=|\sdata-act=/.test(' ' + attrs)) kind = 'chip';
    if (!kind) continue;
    if (proseTag(text, m, attrs)) continue; /* a tag named in a regex literal or a key: 'string' data line is prose, not a control */
    ctl.found++; bf.found++; ctl.kinds[kind] = (ctl.kinds[kind] || 0) + 1;
    if (bf.reused) ctl.reused++;
    /* the code is AAA### (a screen, a component, an old flat row) optionally followed by -K## parts (SAP-style, UX-137); a helper that takes its code as a parameter writes data-cbsid="' + sid + '" and counts as stamped, its call sites are checked by toolset/ui-identity/ui-cmdb.cjs */
    let c = attrs.match(/data-cbsid=\\?["']([A-Z]{3}\d{3}(?:-[A-Z]\d{2})*)\\?["']/);
    if (!c && /data-cbsid=["']["']?\s*\+/.test(attrs)) c = ['', 'PARAM'];
    if (!c) c = passThrough(attrs, fileStamps); /* a helper writes the code its caller gave it: see ui-identity-passthrough.cjs */
    const tagged = !!(c && (c[1] === 'PARAM' || c[1] === 'HELPER' || liveCodes.has(c[1])));
    if (tagged) { ctl.identified++; bf.identified++; }
    const lab = ((attrs.match(/aria-label=["']([^"'+]{1,60})["']/) || [])[1] || (m[3] || '').replace(/\s+/g, ' ').trim()).toLowerCase();
    if (lab && liveCtlLabels[lab] && !tagged) { ctl.label_row++; bf.label_row++; }
    /* one record per element, for toolset/web-done.cjs (per-page done); not written to the JSON */
    elements.push({ file: f, line: text.slice(0, m.index).split(NL).length, kind, tag, tagged, code: c ? c[1] : null, label: lab, attrs });
  }
}

/* popups: per function, how many dialogs it opens by modal( (the register's own ambiguity rule) */
const perFn = {}, fileTagCodes = {};
popups.forEach((p) => { if ((p.kind === 'modal' || p.kind === 'showModal') && p.fn) { const k = pfKey(p); perFn[k] = (perFn[k] || 0) + 1; } });
const fnTagCodes = {};
elemPops.forEach((e) => { (fileTagCodes[e.file] = fileTagCodes[e.file] || new Set()).add(e.code); (fnTagCodes[e.file + ':' + e.fn] = fnTagCodes[e.file + ':' + e.fn] || new Set()).add(e.code); });
/* modal( is counted by function name across the whole web (the register's rule: byFn is global); showModal by file and function (a native dialog carries its own code, no global lookup) */
function pfKey(p) { return (p.kind === 'showModal' ? 'showModal:' + p.file + ':' : 'modal:') + p.fn; }
const hosts = popups.filter((p) => p.tagPop === 'host').length;
for (let k = popups.length - 1; k >= 0; k--) if (popups[k].tagPop === 'host') popups.splice(k, 1);
let pIdent = 0, pAmb = 0, pNoFn = 0, pOther = 0;
const livePopCode = Object.values(livePop);
popups.forEach((p) => {
  p.code = null;
  if (p.kind === 'ui-dialog') { if (!p.pop) { p.why = 'ui.dialog call names no pop code'; return; } if (!Object.values(livePop).includes(p.pop)) { p.why = 'pop code ' + p.pop + ' is not a live Popup row'; return; } p.code = p.pop; pIdent++; return; }
  if (p.kind === 'dialog-tag' || p.kind === 'role-dialog') {
    if (!p.tagPop) { p.why = 'opener not in the register (' + p.kind + ' with no data-pop)'; pOther++; return; }
    if (!livePopCode.includes(p.tagPop)) { p.why = 'data-pop ' + p.tagPop + ' is not a live Popup row'; return; }
    p.code = p.tagPop; pIdent++; return;
  }
  if (p.kind === 'openSheet') { if (!livePop.openSheet) { p.why = 'opener not in the register (openSheet: no Popup row for function openSheet)'; pOther++; return; } p.code = livePop.openSheet; pIdent++; return; }
  if (p.kind !== 'modal' && p.kind !== 'showModal') { p.why = 'opener not in the register (' + p.kind + ')'; pOther++; return; }
  /* a showModal() with no row of its own reads its element: the one data-pop in its holding function, or, with no function, the file's one data-pop */
  const one = (set) => (set && set.size === 1 && livePopCode.includes([...set][0]) ? [...set][0] : null);
  const elemCode = () => (p.kind !== 'showModal' ? null : (p.openPop && livePopCode.includes(p.openPop) ? p.openPop : p.openId && idPops[p.file + ':' + p.openId] && livePopCode.includes(idPops[p.file + ':' + p.openId]) ? idPops[p.file + ':' + p.openId] : p.fn ? one(fnTagCodes[p.file + ':' + p.fn]) : one(fileTagCodes[p.file])));
  if (p.kind === 'modal' && p.optPop) { if (!livePopCode.includes(p.optPop)) { p.why = 'pop code ' + p.optPop + ' is not a live Popup row'; return; } p.code = p.optPop; pIdent++; return; }
  if (!p.fn) {
    const ec = elemCode();
    if (ec) { p.code = ec; pIdent++; return; }
    p.why = 'no top-level function to hold a code'; pNoFn++; return;
  }
  if (!livePop[p.fn]) { const ec = elemCode(); if (ec) { p.code = ec; pIdent++; return; } p.why = 'function has no live Popup row'; return; }
  if (perFn[pfKey(p)] > 1) { const ec = elemCode(); if (ec) { p.code = ec; pIdent++; return; } p.why = 'function opens ' + perFn[pfKey(p)] + ' dialogs, one code'; pAmb++; return; }
  p.code = livePop[p.fn]; pIdent++;
});
const popFound = popups.length, popMissing = popFound - pIdent;
const reusedPop = popups.filter((p) => p.mount).length;

/* orphans: live rows with no element */
const fnsOpening = new Set(popups.filter((p) => (p.kind === 'modal' || p.kind === 'showModal') && p.fn).map((p) => p.fn).concat(popups.some((p) => p.kind === 'openSheet') ? ['openSheet'] : []));
/* a row is also claimed by an element that carries its code in source: data-pop="POPnnn" in markup, or setAttribute('data-pop','POPnnn') (a popover or overlay a script draws, 15 Nov), read from every page and script */
const elementPops = new Set();
for (const g of fs.readdirSync(PUB).filter((n) => /\.html$/.test(n)).concat(JSF)) for (const m of rd(path.join(PUB, g)).matchAll(/data-pop\s*(?:=\s*\\?["']|["']\s*,\s*["'])(POP\d{3})/g)) elementPops.add(m[1]);
const claimedPop = new Set(popups.filter((p) => p.kind === 'ui-dialog').map((p) => p.pop).concat(popups.filter((p) => p.code).map((p) => p.code), [...elementPops]));
const orphanPop = Object.keys(livePop).filter((f) => !fnsOpening.has(f) && !claimedPop.has(livePop[f])).map((f) => livePop[f] + ' ' + f);
const low = corpus.toLowerCase();
/* a library element whose code is built from a literal head, 'CMP055-' + shape.el, is claimed by the head (UX-137 w4) */
const headBuilt = (c) => corpus.includes("'" + c.replace(/-[^-]*$/, '') + "-' +");
const orphanCtl = Object.keys(liveCtlLabels).filter((l) => l && !low.includes(l) && !corpus.includes(liveCtlLabels[l])) /* UX-137 w4: a flat row whose code sits on an element in source is claimed even when its label is built at run time */.map((l) => liveCtlLabels[l] + ' ' + l)
  .concat(Object.keys(stampedRows).filter((c) => !corpus.includes(c) && !headBuilt(c)).map((c) => c + ' ' + stampedRows[c]));

/* retired codes still reaching the browser, and drift between the two copies */
let leak = [], copyRows = null;
const sjs = path.join(PUB, 'app', 'screens.js');
if (fs.existsSync(sjs)) {
  const sb = { window: {} };
  try { new Function('window', fs.readFileSync(sjs, 'utf8'))(sb.window); } catch (e) { /* reported as drift below */ }
  const rows = (sb.window.CBSCREENS && sb.window.CBSCREENS.rows) || [];
  copyRows = rows.length;
  const shown = new Set(rows.map((r) => r.code));
  leak = [...retiredCodes].filter((c) => shown.has(c));
}

const total = popFound + ctl.found, done = pIdent + ctl.identified;
const doc = {
  _what: 'UI identity census (UX-137 step 1): popups and controls in web source against SCREENS.json. GENERATED by toolset/coverage/ui-identity.cjs --write; do not edit. Rules are in that file header.',
  generated: new Date().toISOString().slice(0, 10),
  web_head: process.env.UIID_HEAD || null,
  register: { rows: Object.keys(reg).length, live: live.length, popups_live: Object.keys(livePop).length, controls_live: live.filter(([k]) => k.startsWith('Control › ')).length },
  metric: { done, of: total, pct: total ? Math.round((1000 * done) / total) / 10 : null, orphans: orphanPop.length + orphanCtl.length },
  popups: { hosts, found: popFound, identified: pIdent, missing: popMissing, ambiguous_one_code: pAmb, no_function: pNoFn, other_openers_unregistered: pOther, reused_mounts: reusedPop, orphans: orphanPop.length },
  controls: { found: ctl.found, identified: ctl.identified, missing: ctl.found - ctl.identified, label_row_no_stamp: ctl.label_row, kinds: ctl.kinds, reused_mounts: ctl.reused, reused_no_path: ctl.reused, orphans: orphanCtl.length },
  retired_reaching_browser: leak,
  browser_copy_rows: copyRows,
  files_scanned: FILES.length,
  popup_sites: popups.map((p) => [p.file, p.line, p.kind, p.fn, p.code, p.why || null, p.mount ? p.mount.join('+') : null]),
  orphans: { popups: orphanPop, controls: orphanCtl },
  controls_by_file: ctl.byFile,
  mounts: Object.fromEntries(Object.entries(mounts).filter(([, s]) => s.size > 1).map(([k, s]) => [k, [...s].sort()]))
};
const bad = (doc.metric.of - doc.metric.done) + doc.metric.orphans + leak.length;
if (WRITE && require.main === module) { fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + NL); }
const line = 'UI identity: ' + done + ' of ' + total + ' (' + doc.metric.pct + '%) popups ' + pIdent + '/' + popFound + ' controls ' + ctl.identified + '/' + ctl.found
  + ' | label-only ' + ctl.label_row + ' | orphans ' + doc.metric.orphans + ' (POP ' + orphanPop.length + ', CTL ' + orphanCtl.length + ') | retired in browser ' + leak.length;
if (require.main === module) console.log(line);
if (CHECK && require.main === module) { if (bad) { console.error('FAIL: ' + bad + ' open (missing code or row, orphan, or retired code in the browser)'); process.exit(1); } console.log('PASS'); }
module.exports = doc;
Object.defineProperty(doc, '_elements', { value: { elements, popups, mounts: Object.fromEntries(Object.entries(mounts).map(([k, v]) => [k, [...v].sort()])), pages: PAGES, files: FILES }, enumerable: false });
