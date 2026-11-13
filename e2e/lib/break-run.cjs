/* e2e/lib/break-run.cjs — the ONE way a *-breaks harness runs its paired check (2026-11-13, QA red-60 groups D/E).
 *
 * Why it exists. A *-breaks harness damages the product once per break and runs the paired check to see it go red. Two things went wrong:
 *   1  every break paid for the paired check's FULL run (crm.cjs 72 s x 22 breaks, one-person.cjs 69 s, ...): no verdict inside the
 *      150 s a runner gave it. A break needs only the FIRST red line, so this runner stops the check (whole process tree) the moment it
 *      prints an XX line the unbroken check does not already print, and reports it.
 *   2  when the paired check is ALREADY red on main, "exit != 0 and some XX" proves nothing: the break is "caught" by the old red.
 *      So a break counts only for an XX line that is NEW against the baseline (or a crash when the baseline ran clean).
 * It never weakens a check: a break that adds no new red line is NOT caught, and the harness exits non-zero.
 *
 * API   baseline(script, opts)       full unbroken run  → { status, xx: [normalised XX lines], secs }
 *       verdict(script, base, opts)  broken run, stops at the first new XX → { status, xx: [new lines], early, secs, stderr }
 *       caught(v, base)              true when the break added a red line (or crashed a clean check)
 *       opts: { cwd, env, timeout (ms, default 600000), re (the red-line pattern, default /^\s+XX/) }
 * CLI   node e2e/lib/break-run.cjs <script> — used by the two functions above (they spawn this file), prints one BREAKRUN {json} line. */
'use strict';
const cp = require('child_process'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
/* a red line without the parts that move between runs (the list of routes it names) */
const norm = (l) => l.replace(/\s+—\s+not:.*$/, '').trim();

function child(script, opts) {
  const re = opts.re || /^\s+XX/, base = opts.base ? new Set(opts.base) : null, t0 = Date.now(), seen = [];
  let summed = false;   /* the check printed its "N passed" summary: it ran to the end */
  const p = cp.spawn(process.execPath, [script], { cwd: opts.cwd || ROOT, env: opts.env || process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let buf = '', err = '', early = false, done = false;
  const killTree = () => { try { if (process.platform === 'win32') cp.spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); else p.kill('SIGKILL'); } catch (_) {} };
  const finish = (status) => { if (done) return; done = true; clearTimeout(timer); console.log('BREAKRUN ' + JSON.stringify({ status, summed, xx: seen, early, secs: Math.round((Date.now() - t0) / 1000), stderr: err.split('\n').filter(Boolean).slice(0, 3).join(' | ').slice(0, 300) })); process.exit(0); };
  const timer = setTimeout(() => { killTree(); finish(-1); }, opts.timeout || 600000);
  p.stdout.on('data', (d) => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (/[0-9]+ passed/.test(line)) summed = true;
      if (re.test(line)) { const n = norm(line); if (!base || !base.has(n)) { seen.push(n); if (base) { early = true; killTree(); finish(null); } } }
    }
  });
  p.stderr.on('data', (d) => { err += d; });
  p.on('exit', (code) => finish(code));
}

function spawnSelf(script, opts) {
  const env = Object.assign({}, opts.env || process.env, { BREAKRUN_OPTS: JSON.stringify({ base: opts.base || null, timeout: opts.timeout, cwd: opts.cwd, re: opts.re && opts.re.source }) });
  const r = cp.spawnSync(process.execPath, [__filename, script], { cwd: opts.cwd || ROOT, encoding: 'utf8', env, timeout: (opts.timeout || 600000) + 30000, maxBuffer: 1 << 26 });
  const m = /^BREAKRUN (.*)$/m.exec(r.stdout || '');
  return m ? JSON.parse(m[1]) : { status: -1, xx: [], early: false, secs: 0, stderr: 'break-run produced no verdict: ' + (r.stderr || '').slice(0, 200) };
}
/* a check that is red on main can be red in a different place on a loaded machine (one-person.cjs printed 2 red lines in one run and 4 in the next),
   so a red baseline is run twice and the red lines are the UNION; a green one is run once. */
const baseline = (script, opts) => {
  const a = spawnSelf(script, Object.assign({}, opts, { base: null }));
  if (!a.xx.length && a.status === 0) return a;
  const b = spawnSelf(script, Object.assign({}, opts, { base: null }));
  return { status: a.status === 0 ? b.status : a.status, summed: a.summed && b.summed, xx: [...new Set(a.xx.concat(b.xx))], early: false, secs: a.secs + b.secs, stderr: a.stderr };
};
const verdict = (script, base, opts) => spawnSelf(script, Object.assign({}, opts, { base: base.xx }));
const caught = (v, base) => v.xx.length > 0 || (v.status !== -1 && v.status !== 0 && (base.status === 0 || (base.summed && !v.summed)));   /* a crash caught the break when the unbroken check ran to its summary and this one did not */   /* -1 = no verdict in time: a hang is reported, not counted */
module.exports = { baseline, verdict, caught };

if (require.main === module) {
  const o = JSON.parse(process.env.BREAKRUN_OPTS || '{}'); if (o.re) o.re = new RegExp(o.re);
  child(process.argv[2], o);
}

/* locate(src, a) — find an anchor even when a formatter (prettier) has moved its spaces, line breaks and quote marks: exact text first, else the same
   TOKENS in the same order with any whitespace between them and either quote mark around a string. n = how many places match; apply(b) swaps the
   one match for b. A changed word, name or number still fails to match, so a break never lands on code that really changed. */
function locate(src, a) {
  let n = src.split(a).length - 1;
  if (n >= 1) { const i = src.indexOf(a); return { n, apply: (b) => (n === 1 ? src.split(a).join(b) : null), start: i, end: i + a.length }; }
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\\/]/g, (m) => '\\' + m);
  const toks = a.match(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[A-Za-z_$][\w$]*|\d+|\s+|[^\sA-Za-z_$\d'"]/g) || [];
  const real = toks.filter((t) => !/^\s+$/.test(t));
  let re = '';
  real.forEach((t, k) => {
    if (k > 0) re += (/[\w$]$/.test(real[k - 1]) && /^[\w$]/.test(t)) ? '\\s+' : '\\s*';
    if (/^['"]/.test(t) && !/['"]/.test(t.slice(1, -1))) { const body = esc(t.slice(1, -1)); re += '(?:\'' + body + '\'|"' + body + '")'; } else re += esc(t);
  });
  const all = [...src.matchAll(new RegExp(re, 'g'))];
  return { n: all.length, apply: (b) => (all.length === 1 ? src.slice(0, all[0].index) + b + src.slice(all[0].index + all[0][0].length) : null), start: all[0] && all[0].index, end: all[0] && all[0].index + all[0][0].length };
}
module.exports.locate = locate;
