/* till-bell.cjs — A QUIET BELL IS TOLD FROM A DEAD ONE ([TILL-167], BACKLOG TILL-146)
 *
 * ⚠️⚠️⚠️ WHY THIS IS A BROWSER TEST AND NOT A SOURCE CHECK. The bug being defended against is that an SSE
 * COMMENT (': ping') fires no EventSource listener — a fact about the browser, invisible in our source. The
 * first fix listened for a named 'ping' the server never sent, which would have torn down every healthy bell
 * on a timer. Only a real EventSource against a real stream settles it. [[project-bell-was-deaf]]
 *
 * Run: node e2e/till-bell.cjs
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
            '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(34) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

(async () => {
  /** the two kinds of heartbeat, switchable — this is the whole experiment */
  let mode = 'named';           /* 'named' = event: ping · 'comment' = ': ping' only */
  let beats = 0;
  const srv = http.createServer((q, r) => {
    const url = q.url.split('?')[0];
    if (url === '/api/events/stream') {
      r.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      r.write('event: hello\ndata: {}\n\n');
      const hb = setInterval(() => {
        beats++;
        try {
          r.write(': ping\n\n');                                   /* the proxy comment, always */
          if (mode === 'named') r.write('event: ping\ndata: {"t":' + Date.now() + '}\n\n');
        } catch (_) {}
      }, 200);
      q.on('close', () => clearInterval(hb));
      return;
    }
    if (url.startsWith('/api/')) { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{"ok":true,"ticket":"t"}'); }
    const f = path.join(ROOT, decodeURIComponent(url).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto(base + '/till.html');
  await p.waitForFunction(() => typeof window.screenSet === 'function', null, { timeout: 30000 });

  /* ══ ⚠️⚠️⚠️ THE FACT THE WHOLE FIX RESTS ON ═══════════════════════════════════════════════════════════ */
  console.log('\n── what a browser can actually hear ' + '─'.repeat(24));
  const heard = await p.evaluate(async (api) => {
    const out = { comment: 0, named: 0, message: 0 };
    const es = new EventSource(api + '/api/events/stream');
    es.onmessage = () => { out.message++; };
    es.addEventListener('ping', () => { out.named++; });
    await new Promise((r) => setTimeout(r, 1200));
    es.close();
    return out;
  }, base);
  say('a NAMED ping reaches a listener', heard.named > 0, heard.named + ' heard');
  /* ⭐ and the comment reaches nothing — which is exactly why the first fix was wrong */
  say('an unnamed message is not what it sends', heard.message === 0, heard.message + ' onmessage events');

  /* ══ the counter's own judgement ═════════════════════════════════════════════════════════════════════ */
  console.log('\n── the counter, on a live stream ' + '─'.repeat(27));
  const live = await p.evaluate(async (api) => {
    CloudHost.key = 'k'; CloudHost.api = api; HOST = CloudHost;
    BELL_DEAF_MS = 700;                       /* the real threshold is 90s; this test cannot wait */
    BELL_HEARD = 0; BELL_AT = 0; BELL = null;
    await bellUp();
    await new Promise((r) => setTimeout(r, 900));
    return { open: !!BELL, live: bellLive(), heardAgo: Date.now() - BELL_HEARD };
  }, base);
  say('the bell is open', live.open, 'EventSource built');
  say('and reads as LIVE while beats arrive', live.live === true, 'last heard ' + live.heardAgo + 'ms ago');

  /* ══ ⚠️⚠️⚠️ THE OUTAGE THAT USED TO BE INVISIBLE ═════════════════════════════════════════════════════ */
  console.log('\n── the stream goes quiet, but stays open ' + '─'.repeat(19));
  mode = 'comment';                            /* proxies still fed; the client hears nothing */
  const deaf = await p.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 1200));
    return { open: !!BELL, ready: BELL ? BELL.readyState : null, live: bellLive() };
  });
  /* ⚠️ THE POINT: connected and deaf at the same time — the state nothing could see before */
  say('it is still connected', deaf.open && deaf.ready === 1, 'readyState ' + deaf.ready);
  say('⚠️⚠️⚠️ and the counter knows it is deaf', deaf.live === false, 'bellLive() says ' + deaf.live);

  const row = await p.evaluate(() => {
    const r = watchNow().filter((x) => x.id === 'bell')[0];
    return r ? { ok: r.ok, name: r.name } : null;
  });
  say('the capability row reports it', row && row.ok === false, JSON.stringify(row));

  /* ══ and it is rebuilt, not waited on ════════════════════════════════════════════════════════════════ */
  console.log('\n── it puts itself right ' + '─'.repeat(36));
  mode = 'named';
  const back = await p.evaluate(async () => {
    const was = BELL;
    bellWatch();                               /* what the 30s tick calls */
    await new Promise((r) => setTimeout(r, 900));
    return { replaced: BELL !== was, live: bellLive(), ok: watchNow().filter((x) => x.id === 'bell')[0].ok };
  });
  say('the dead stream is replaced', back.replaced, 'a new EventSource was built');
  say('and it reads live again', back.live === true && back.ok === true, 'nobody pressed anything');

  await b.close(); srv.close();
  console.log(bad ? '\n' + bad + ' failed' : '\na quiet bell is told from a dead one, and rebuilt by itself');
  process.exit(bad ? 1 : 0);
})();
