/* lab-kit-promise.cjs - ONE PROMISE SENTENCE (Offer Lab v2 PR-a0)
 *
 * The text a lab shows before a commit and the text the confirm popup shows must be the same words, because both come from CBLabKit.promise.
 * For each act (make live, only for a group, approve, go live, pause, resume, retire, delete) this opens the REAL askPromise popup on the real page
 * and checks: the popup body equals CBLabKit.promise(...).text, its title and button are the act's, and it names the offer, what it reaches with the count,
 * for whom and from when. The sheet's draft line comes from the same function. Nothing reaches a server. Run: node e2e/lab-kit-promise.cjs */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let bad = 0;
const say = (label, ok, detail) => { console.log('  ' + String(label).padEnd(40) + '· ' + detail + '  ' + (ok ? 'OK' : (bad++, 'FAILED'))); };

/* the acts and what each must say: title, button, for whom, from when (written here, not read back from the kit) */
const ACTS = [
  { label: 'Make live', kind: 'live', title: 'Make this offer live?', ok: 'Make live', who: 'every customer', from: 'now, on the very next bill' },
  { label: 'Only for a group', kind: 'group', title: 'Make this offer live for a group?', ok: 'Make live for them', who: 'Regulars', from: 'now, on the very next bill', patch: { customer_group: 'group:Regulars' } },
  { label: 'Approve', kind: 'approve', title: 'Approve this offer?', ok: 'Approve', who: 'nobody yet', from: 'not live. Going live is the next step' },
  { label: 'Go live', kind: 'golive', title: 'Go live with this offer?', ok: 'Go live', who: 'every customer', from: 'now, on the very next bill' },
  { label: 'Pause', kind: 'pause', title: 'Pause this offer?', ok: 'Pause', who: 'nobody while it is paused', from: 'now' },
  { label: 'Resume', kind: 'resume', title: 'Resume this offer?', ok: 'Resume', who: 'every customer', from: 'now, on the very next bill' },
  { label: 'Retire', kind: 'retire', title: 'Retire this offer?', ok: 'Retire', who: 'nobody from now on', from: 'now' },
  { label: 'Delete', kind: 'delete', title: 'Delete this offer?', ok: 'Delete', who: 'nobody', from: 'now' }
];
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();

(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'text/plain' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((res) => srv.listen(0, res));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:' + srv.address().port + '/offer-lab-next.html');
  await page.waitForTimeout(300);

  for (const act of ACTS) {
    const seen = await page.evaluate((a) => {
      const item = { id: 'x1', title: 'Spend and save', detail: '10% off', snap: { goal: 'spend', spendAt: 50000 } };
      askPromise(item, a.kind, a.patch || null, function () {});
      const body = document.querySelector('[data-testid="lk-confirm-text"]');
      const shown = CBLabKit.promise(promiseParts(item, a.kind, a.patch || null));
      const popup = { text: body.innerText, title: document.querySelector('.lk-pop header b').textContent, ok: document.querySelector('[data-testid="lk-confirm-ok"]').textContent, on: document.querySelector('[data-testid="promise-on"]').textContent };
      document.querySelector('[data-testid="lk-confirm-cancel"]').click();
      return { popup, shown };
    }, act);
    const same = squash(seen.popup.text) === squash(seen.shown.text);
    say(act.label + ': text before saving = popup', same, same ? 'identical' : 'popup "' + squash(seen.popup.text) + '" vs "' + squash(seen.shown.text) + '"');
    const says = [seen.popup.title === act.title, seen.popup.ok === act.ok, /Spend and save/.test(seen.popup.text), /every bill of/.test(seen.popup.on), squash(seen.popup.text).includes('For: ' + act.who), squash(seen.popup.text).includes('From: ' + act.from)];
    say(act.label + ': title, button, what, on what, whom, when', says.every(Boolean), says.join(','));
  }

  /* v2: the right-hand pane (an open saved offer) says exactly what the popup of its next step says */
  for (const status of ['draft', 'approved', 'live', 'paused']) {
    const seen = await page.evaluate((st) => {
      const item = { id: 'p1', title: 'Spend and save', detail: '₹50 back', status: st, n: '—', k: 'saved', snap: { goal: 'spend', spendAt: 500 } };
      SAVED = [item]; openOffer('p1');
      const pane = document.querySelector('[data-testid="promise-text"]').innerText;
      askPromise(item, NEXT_ACT[st], null, function () {});
      const popup = document.querySelector('[data-testid="lk-confirm-text"]').innerText;
      document.querySelector('[data-testid="lk-confirm-cancel"]').click();
      return { pane, popup };
    }, status);
    say('a ' + status + ' offer: the pane text = the popup text', squash(seen.pane) === squash(seen.popup) && seen.pane.length > 40, squash(seen.pane).slice(0, 80));
  }
  /* a group offer: Go live and Resume keep the group, so the pane and the popup both NAME it (never "every customer") */
  for (const [status, words] of [['approved', /For: Wholesale .*only/], ['paused', /For: Wholesale .*only/], ['live', /it is for Wholesale .*only/], ['draft', /it was only for Wholesale/]]) {
    const seen = await page.evaluate((st) => {
      const item = { id: 'g1', title: 'Spend and save', detail: '₹50 back', status: st, group: 'group:Wholesale', groupName: 'Wholesale', n: '—', k: 'saved', snap: { goal: 'spend', spendAt: 500 } };
      SAVED = [item]; openOffer('g1');
      const pane = document.querySelector('[data-testid="promise-text"]').innerText;
      askPromise(item, NEXT_ACT[st], null, function () {});
      const popup = document.querySelector('[data-testid="lk-confirm-text"]').innerText;
      document.querySelector('[data-testid="lk-confirm-cancel"]').click();
      return { pane, popup };
    }, status);
    say('a ' + status + ' group offer: pane = popup and names the group', squash(seen.pane) === squash(seen.popup) && words.test(squash(seen.pane)) , squash(seen.pane).slice(0, 110));
  }
  const grouped = await page.evaluate(() => {
    const by = CBLabKit.groupBy([{ s: 'b' }, { s: 'a' }, { s: 'b' }, { s: 'z' }], (x) => x.s, ['a', 'b', 'c']);
    return Object.keys(by).join() + '|' + Object.values(by).map((v) => v.length).join();
  });
  say('groupBy keeps the given order, empty groups and extra keys', grouped === 'a,b,c,z|1,2,0,1', grouped);

  const draft = await page.evaluate(() => {
    const shown = { title: 'A percentage off', detail: '10% off' };
    S.scope = 'item'; S.itemIds = ['masala']; render();
    return { line: draftPromise(shown), kit: CBLabKit.promise(Object.assign(promiseParts({ title: shown.title, detail: shown.detail, snap: snapshot() }, 'draft'), { note: takenOffNote().trim() })).text };
  });
  say('the draft line is the kit sentence', draft.line === draft.kit && /^Saves a draft: A percentage off · 10% off, on /.test(draft.line) && /Nothing is live until you make it live\./.test(draft.line), '"' + draft.line + '"');
  say('no page error', errors.length === 0, errors.join(' | ') || 'none');
  await browser.close();
  srv.close();
  console.log(bad ? '\n' + bad + ' check(s) failed' : '\nall promise checks passed');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
