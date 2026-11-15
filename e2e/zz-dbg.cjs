const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
(async () => {
  const srv = http.createServer((q, r) => { const f = path.join(PUB, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '')); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 300)));
  p.on('pageerror', (e) => console.log('pageerror', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  await p.goto('http://127.0.0.1:' + srv.address().port + '/bank-demo.html');
  await p.waitForTimeout(4000);
  console.log('msg:', await p.textContent('#bd_msg').catch(() => 'none'), '| sum:', await p.textContent('#bd_sum').catch(() => 'none'));
  await b.close(); srv.close();
})();
