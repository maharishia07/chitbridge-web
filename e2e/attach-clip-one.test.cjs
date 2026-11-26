'use strict';
/* UX-198 (1131): ONE attach control. cbAttachClip (public/app/attach-ui.js) is the only drawer of "files are attached" - outline when none, filled with a count when held.
   Guard 1: the Day book chip (cap-evidence.js) draws it through cbAttachClip - no circle glyph, no emoji clip of its own.
   Guard 2 (ratchet): no screen outside the baseline draws its own paperclip glyph; a baseline site may only shrink (e2e/attach-clip-one.baseline.json = the legacy sites to move to cbAttachClip).
   Run: node e2e/attach-clip-one.test.cjs   (--write rewrites the baseline DOWNWARD only) */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let n = 0; const ok = (m) => { n++; console.log('  ok  ' + m); };

/* 1 · the chip */
const evSrc = read('public/app/cap-evidence.js');
assert(!/sym: '[○📎]'/.test(evSrc), 'the chip states draw no circle or emoji clip'); ok('cap-evidence.js draws no circle and no emoji clip');
assert(/cbAttachClip\(/.test(evSrc), 'the chip calls cbAttachClip'); ok('the Day book chip is drawn by cbAttachClip');

/* 2 · the clip itself */
const ctx = { esc: (s) => String(s) }; vm.createContext(ctx);
const src = read('public/app/attach-ui.js'); const a = src.indexOf('function cbAttachClip(');
let d = 0, j = src.indexOf('{', a); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
vm.runInContext(src.slice(a, j + 1) + '\nthis.f = cbAttachClip;', ctx);
const none = ctx.f({ count: 0, name: 'Attach receipt' }), held = ctx.f({ count: 2, name: 'Evidence 2' });
assert(/data-clip="outline"/.test(none) && !/cb-clip-count/.test(none) && /Attach receipt/.test(none)); ok('none: outline clip named "Attach receipt", no badge');
assert(/data-clip="filled"/.test(held) && /cb-clip-count[^>]*>.*>2</.test(held) && /Evidence 2/.test(held)); ok('held: filled clip, count badge 2, the count in the name for a screen reader');

/* 3 · nobody else draws one (ratchet) */
const CLIP = /\u{1F4CE}/u, files = [];
(function walk(dir) { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p); else if (/\.(js|html)$/.test(f.name) && !/strings-.*\.js$/.test(f.name)) files.push(p); } })(path.join(root, 'public'));
const found = {};
for (const p of files) { const rel = path.relative(root, p).split(path.sep).join('/'); let c = 0; for (const line of fs.readFileSync(p, 'utf8').split('\n')) { if (CLIP.test(line) && !/^\s*(\*|\/\/)/.test(line)) c++; } if (c) found[rel] = c; }
const basePath = path.join(__dirname, 'attach-clip-one.baseline.json');
if (process.argv.includes('--write')) { fs.writeFileSync(basePath, JSON.stringify(found, null, 1) + '\n'); console.log('baseline written'); process.exit(0); }
const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
for (const [f, c] of Object.entries(found)) assert(c <= (base[f] || 0), f + ' draws its own paperclip (' + c + ' sites, baseline ' + (base[f] || 0) + ') - call cbAttachClip instead');
ok('no screen draws a paperclip beyond the baseline (' + Object.keys(base).length + ' legacy files, burn down)');
console.log('\n  ' + n + ' passed');
