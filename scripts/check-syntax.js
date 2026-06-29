// check-syntax.js — validate the inline JS in public/app.html + the public/app/*.js modules.
// app.html is a monolith with one big inline <script>; node --check can't see it, so we extract + vm.Script it.
// Run:  node scripts/check-syntax.js   (exit 1 on any syntax error)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

// 1) inline <script> blocks in app.html (skip external src= ones)
const html = fs.readFileSync(path.join(root, 'public', 'app.html'), 'utf8');
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, n = 0;
while ((m = re.exec(html)) !== null) {
  if (/\bsrc\s*=/.test(m[1] || '')) continue;
  n++;
  try { new vm.Script(m[2], { filename: `app.html#inline-${n}` }); }
  catch (e) { failed++; console.log('SYNTAX FAIL  app.html inline #' + n + ': ' + e.message); }
}
console.log('app.html: ' + n + ' inline script(s) — ' + (failed ? 'FAIL' : 'OK'));

// 2) the JS modules under public/app/
const appDir = path.join(root, 'public', 'app');
if (fs.existsSync(appDir)) {
  for (const f of fs.readdirSync(appDir).filter(f => f.endsWith('.js'))) {
    try { new vm.Script(fs.readFileSync(path.join(appDir, f), 'utf8'), { filename: 'app/' + f }); console.log('public/app/' + f + ' — OK'); }
    catch (e) { failed++; console.log('SYNTAX FAIL  public/app/' + f + ': ' + e.message); }
  }
}

if (failed) { console.log('\ncheck-syntax: FAIL (' + failed + ')'); process.exit(1); }
console.log('check-syntax: PASS');
