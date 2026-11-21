'use strict';
/**
 * ready-manifest.cjs - every walk sees the Home manifest with each entry READY (preloaded by e2e/run-shard.cjs through NODE_OPTIONS).
 * OWNS      why: 1128's greyready rule (public/app/manifest.json "ready": false -> the Home card draws grey and a typed address to that page shows the
 *           "being finished" cover) is a product decision about what a CUSTOMER may open; a walk drives the page itself, so the cover hid every
 *           page.click on catalogue, employees, operations, standards and the rest (red1128walks, ~45 walks). The behaviour itself is proved by
 *           tests/grey-ready.test.cjs (no browser). CB_REAL_READY=1 turns this off for a walk that must see the real flags.
 * HOW       any read of app/manifest.json through fs (the walks' own static servers, 180 of them) gets `"ready": false` -> `"ready": true ` (same byte length,
 *           so a Content-Length from a stat stays right). Nothing is written; the file on disk is untouched.
 * CALLED BY e2e/run-shard.cjs   node -r ./e2e/lib/ready-manifest.cjs <walk>
 */
const fs = require('fs'), { Readable } = require('stream');
if (!process.env.CB_REAL_READY) {
  const isManifest = (p) => typeof p === 'string' && /[\/]app[\/]manifest\.json$/.test(p);
  const ready = (d) => (Buffer.isBuffer(d) ? Buffer.from(d.toString('utf8').replace(/"ready": ?false/g, (m) => m.replace('false', 'true ')), 'utf8') : String(d).replace(/"ready": ?false/g, (m) => m.replace('false', 'true ')));
  const same = (d) => (Buffer.isBuffer(d) ? d : Buffer.from(d));
  const readFile = fs.readFile, readFileSync = fs.readFileSync, createReadStream = fs.createReadStream;
  fs.readFileSync = function (p, o) { const d = readFileSync.apply(fs, arguments); return isManifest(String(p)) ? (o ? ready(String(d)) : ready(d)) : d; };
  fs.readFile = function (p, o, cb) { const done = typeof o === 'function' ? o : cb; const args = Array.prototype.slice.call(arguments, 0, -1);
    return readFile.apply(fs, args.concat(function (e, d) { done(e, !e && isManifest(String(p)) ? ready(d) : d); })); };
  fs.createReadStream = function (p) { if (!isManifest(String(p))) return createReadStream.apply(fs, arguments); return Readable.from([same(ready(readFileSync(p)))]); };
}
