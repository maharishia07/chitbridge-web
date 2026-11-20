/* tests/static-404.test.cjs: ERR-3 - a missing static file answers a real 404; only extension-less app-shell routes keep the HTML fallback.
 * Proves both hosts' config: deploy/nginx.conf (the box) and vercel.json (the hosted site). No server needed. Run: node tests/static-404.test.cjs */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
let pass = 0;
const it = (what, run) => { try { run(); pass++; console.log('  ok  ' + what); } catch (e) { process.exitCode = 1; console.log('  FAIL ' + what + '\n      ' + e.message); } };
const nginx = fs.readFileSync(path.join(ROOT, 'deploy', 'nginx.conf'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

/* what nginx does for a path that is not a file: the regex locations first (an extension -> 404), else the prefix / (-> index.html) */
const extLoc = /location\s+~\s+(\S+)\s*\{\s*try_files \$uri =404;\s*\}/.exec(nginx);
const nginxAnswer = (p) => (/^\/\.well-known\//.test(p) ? 404 : extLoc && new RegExp(extLoc[1]).test(p) ? 404 : 200);
const shell = (re, p) => new RegExp('^/' + re + '$').test(p);
const rule = vercel.rewrites[0].source.replace(/^\//, '');

it('nginx: a missing file with an extension is a 404, an app-shell route still gets index.html', () => {
  assert.ok(extLoc, 'deploy/nginx.conf has the extension location');
  assert.ok(nginx.indexOf(extLoc[0]) < nginx.indexOf('location / {'), 'the extension rule is declared before the catch-all');
  for (const p of ['/app/x.js', '/js/missing.css', '/app.html', '/logo.png', '/a/b/c.map']) assert.strictEqual(nginxAnswer(p), 404, p);
  for (const p of ['/', '/accounts', '/shop/12/open', '/app']) assert.strictEqual(nginxAnswer(p), 200, p);
  assert.ok(/location \/ \{ try_files \$uri \/index\.html; \}/.test(nginx), 'the app-shell fallback is kept');
});

it('vercel: the rewrite to index.html matches app-shell routes only, never a path with an extension or /.well-known/', () => {
  for (const p of ['/', '/accounts', '/shop/12/open']) assert.ok(shell(rule, p), p + ' keeps the fallback');
  for (const p of ['/app/x.js', '/app.html', '/logo.png', '/.well-known/ctp.json', '/a/b/c.map']) assert.ok(!shell(rule, p), p + ' must not be rewritten');
});

console.log(pass + ' checks');
