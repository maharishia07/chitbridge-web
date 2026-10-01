/* bills-folder-breaks.cjs — break each web guard of the folder list once, run e2e/bills-folder.cjs, restore FROM A COPY
   (never git checkout). Run: node e2e/bills-folder-breaks.cjs */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const W = path.join(__dirname, '..');
const CAP = 'public/app/cap-folders.js';
const BREAKS = [
  ['system folders fall under Task again', CAP, `  return all.filter(function(f){ return !view(f); });`, `  return all;`],
  ['a view folder (kind view, not system) falls under Task', CAP, `var view=function(f){ return !!(f.system || f.kind==='view'); };`, `var view=function(f){ return !!f.system; };`],
  ['the system folders are thrown away, not kept for the Bills screen', CAP, `  UI.sysFolders=all.filter(view);`, `  UI.sysFolders=[];`],
  ['Move reads the raw list', CAP, `UI.folders=_foldersFrom(rr); }catch(e){ UI.folders=[]; } }`, `UI.folders=(rr&&rr.folders)||[]; }catch(e){ UI.folders=[]; } }`],
];
let good = 0, ran = 0;
for (const [name, rel, a, b] of BREAKS) {
  ran++;
  const f = path.join(W, rel), bak = f + '.bak';
  const s = fs.readFileSync(f, 'utf8'); const n = s.split(a).length - 1;
  if (n !== 1) { console.log('  ??  ' + name + ': anchor x' + n); continue; }
  fs.copyFileSync(f, bak);
  try {
    fs.writeFileSync(f, s.split(a).join(b));
    const r = cp.spawnSync(process.execPath, ['e2e/bills-folder.cjs'], { cwd: W, encoding: 'utf8', timeout: 300000 });
    const xx = (r.stdout || '').split('\n').filter((l) => /^\s+XX/.test(l));
    const caught = r.status !== 0 && xx.length > 0;
    if (caught) good++;
    console.log((caught ? '  ok  ' : '  XX  ') + 'broken: ' + name + ' → ' + (caught ? 'caught: ' + xx[0].trim() : 'NOT caught (exit ' + r.status + ')'));
  } finally { fs.copyFileSync(bak, f); fs.unlinkSync(bak); }
}
console.log('\n  ' + good + '/' + ran + ' breaks caught');
process.exitCode = good === ran ? 0 : 1;
