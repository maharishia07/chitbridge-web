/* one-person-breaks.cjs — */ // break each one-browser-one-shop guard once, run e2e/one-person.cjs, restore FROM A COPY (never git checkout)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const W = path.join(__dirname, '..');
const APP = 'public/app.html', OP = 'public/app/one-person.js', IDX = 'index.html';
/* [name, [[file, anchor, replacement], …]] — a guard that is two lines (belt and braces) is broken as one */
const BREAKS = [
  /* app.html — the gate */
  ['route lets an unchecked shop through', [[APP, `&& !gateOpen()) return gateRun();\n`, `&& false) return gateRun();\n`]]],
  ['renderApp paints before the gate', [[APP, `  if(!gateOpen()) return gateRun();\n  /**`, `  /**`]]],
  ['cb_sess written before the gate', [[APP, `if(SESSION.token && gateOpen()) localStorage.setItem('cb_sess'`, `if(SESSION.token) localStorage.setItem('cb_sess'`]]],
  ['gate opens without claiming the work', [[APP, `CBOnePerson.claim(m); sessPersist();`, `sessPersist();`]]],
  ['told to leave, the tab says nothing', [[APP, `LOGIN.gone=why || txf('Signed out — {shop} opened in another tab.', { shop: by || tx('another shop') });`, `LOGIN.gone=why || ' ';`]]],
  ['same shop signs the owner out', [[APP, `  if(next && next.ent===m.ent) return;\n`, ``]]],
  ['a sign-out elsewhere is not followed', [[APP, `try{ window.addEventListener('storage', sessFollow); }catch(_){}`, ``]]],
  ['sign-out leaves the gate open', [[APP, `GATE={ent:null,busy:false,last:null};_mePrefetch=null;_meReq=null;`, ``]]],
  /* one-person.js — the check and the clear-out */
  ['another shop\'s session not seen', [[OP, `if (s && s.ent !== ent) {`, `if (false) {`]]],
  ['another shop\'s tab not seen', [[OP, `if (m && m.ent && m.ent !== ent) {`, `if (false) {`]]],
  ['unsent drafts not seen', [[OP, `      if (drafts || outbox) {`, `      if (false) {`]]],
  ['counter paired elsewhere not seen', [[OP, `counter = (pair.paired && pair.ent && pair.ent !== ent) ? pair : null;`, `counter = null;`]]],
  ['counter read from the marker, not its own copy', [[OP, `      if (S && S.entity_id) {`, `      if (false) {`]]],
  ['reading the counter creates its database', [[OP, `      if (!names || names.indexOf(name) < 0) return null;\n`, `      if (!names) return null;\n`],
                                                 [OP, `rq.onupgradeneeded = function () { try { rq.transaction.abort(); } catch (_) {} fin(null); };`, ``]]],
  ['other tabs never told to leave', [[OP, `ask({ t: 'leave', ent: o.ent,`, `ask({ t: 'nope', ent: o.ent,`]]],
  ['drafts left behind', [[OP, `if (owned && k.indexOf(DRAFT) === 0) return lsDel(k);`, ``]]],
  ['saved settings left behind', [[OP, `if (ids[i] && k.slice(-(ids[i].length + 1)) === '@' + ids[i]) return lsDel(k);`, `if (false) return lsDel(k);`]]],
  /* start with a clean browser */
  ['clean wipes past the counter\'s unsent bills', [[OP, `      if (u[0]) return { ok: false, unsent: u[0] };\n`, ``]]],
  ['clean wipes past the Labs\' unsent saves', [[OP, `      if (u[1]) return { ok: false, labUnsent: u[1] };\n`, ``]]],
  ['a tab that did not answer is not named', [[OP, `          if (silent.length) return { ok: false, silent: silent };\n`, ``]]],
  ['clean leaves localStorage', [[OP, `              cbKeys(root.localStorage).forEach(lsDel);\n`, ``]]],
  ['clean leaves sessionStorage', [[OP, `cbKeys(root.sessionStorage).forEach(function (k) { root.sessionStorage.removeItem(k); });`, ``]]],
  ['clean leaves the databases', [[OP, `return Promise.all((names || known).map(dropDb));`, `return Promise.all([]);`]]],
  ['clean leaves the caches', [[OP, `ks.map(function (k) { return root.caches.delete(k); })`, `[]`]]],
  ['clean leaves the service workers', [[OP, `rs.map(function (r) { return r.unregister(); })`, `[]`]]],
  ['the clean load registers a worker again', [[APP, `if(!(typeof CLEAN_LOAD!=='undefined'&&CLEAN_LOAD)) CBOffline.registerSW`, `CBOffline.registerSW`]]],
  ['the clean load says nothing', [[APP, `LOGIN.gone=CBOnePerson.cleanSentence(`, `void CBOnePerson.cleanSentence(`]]],
  ['a cleaned app tab says nothing', [[APP, `onWipe: function(){ return personLeave('', tx('Signed out — this browser is being cleaned.')); }`, `onWipe: function(){ return personLeave('', ' '); }`]]],
  ['a Lab ignores the clean-up', [['public/offer-lab.html', `onWipe: function(){ location.replace('/?cleaned=1'); }`, `onWipe: function(){}`]]],
  /* index.html */
  ['index shows facts with another shop here', [[IDX, `if (r.others.length) closeFirst(r); else facts();`, `facts();`]]],
  ['index: mismatch not amber', [[IDX, `else { s.className = 'f dn';`, `else { s.className = 'f';`]]],
  ['index: same shop signs it out', [[IDX, `    if (next && next.ent === MINE.ent) return;\n`, ``]]],
  ['index: a sign-out elsewhere is not followed', [[IDX, `window.addEventListener('storage', onStore);`, ``]]],
  ['index: a late read paints the old shop', [[IDX, `  if (g !== GEN) return never();\n  if (!r.ok)`, `  if (!r.ok)`], [IDX, `  if (g !== GEN) return never();\n  return`, `  return`]]],
];
/* BREAK_ONLY=index runs just the breaks whose name contains it */
const ONLY = process.env.BREAK_ONLY || '';
let good = 0, ran = 0;
for (const [name, edits] of BREAKS) {
  if (ONLY && name.indexOf(ONLY) < 0) continue;
  ran++;
  const files = [...new Set(edits.map((e) => e[0]))];
  const orig = {};
  for (const rel of files) orig[rel] = fs.readFileSync(path.join(W, rel), 'utf8');
  /* the files mix CRLF and LF — an anchor with \n is matched against both */
  const work = Object.assign({}, orig);
  let bad = '';
  for (const [rel, a, b] of edits) {
    const s = work[rel], crlf = a.indexOf('\n') >= 0 && s.split(a).length === 1;
    const A = crlf ? a.replace(/\n/g, '\r\n') : a, B = crlf ? b.replace(/\n/g, '\r\n') : b;
    const n = s.split(A).length - 1;
    if (n !== 1) { bad = rel + ' anchor x' + n; break; }
    work[rel] = s.split(A).join(B);
  }
  if (bad) { console.log('  ??  ' + name + ': ' + bad); continue; }
  /* BREAK_DRY=1: only prove every anchor is found once — nothing is written, nothing is run */
  if (process.env.BREAK_DRY) { good++; console.log('  ok  anchor: ' + name); continue; }
  for (const rel of files) fs.copyFileSync(path.join(W, rel), path.join(W, rel) + '.bak');
  try {
    for (const rel of files) fs.writeFileSync(path.join(W, rel), work[rel]);
    const r = cp.spawnSync(process.execPath, ['e2e/one-person.cjs'], { cwd: W, encoding: 'utf8', timeout: 600000 });
    const xx = (r.stdout || '').split('\n').filter((l) => /^\s+XX/.test(l));
    const caught = r.status !== 0 && xx.length > 0;
    if (caught) good++;
    console.log((caught ? '  ok  ' : '  XX  ') + 'broken: ' + name + ' → ' + (caught ? 'caught: ' + xx[0].trim() : 'NOT caught (exit ' + r.status + ')'));
  } finally {
    for (const rel of files) { const f = path.join(W, rel); fs.copyFileSync(f + '.bak', f); fs.unlinkSync(f + '.bak'); }
  }
}
console.log('\n  ' + good + '/' + ran + (process.env.BREAK_DRY ? ' anchors found (dry — nothing run)' : ' breaks caught'));
process.exitCode = good === ran ? 0 : 1;
