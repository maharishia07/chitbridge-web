#!/usr/bin/env node
// @type: smoke
/**
 * e2e/walk-probe-faults.cjs — THE FAULT PROBE: every page, every screen of app.html's register, every tab and the first popups, opened on the
 * walks' fixture api, and every SWALLOWED fault written down (Athi, 17 Nov: the size split keeps leaving faults no check sees — list-ctl safe()
 * swallows a throw, so a list just paints empty).
 *
 * WHAT IT RECORDS (per screen):
 *   console    every console.error and every pageerror
 *   swallowed  every exception a try/catch swallowed. Two ways in, both test-only and no behaviour change for a user:
 *                1. the page's own flag: when window.__CB_SAFE_LOG is an array, list-ctl safe() (and every cbQuiet) pushes to it
 *                2. a serve-time transform of the JS/HTML this probe serves (never written to disk): each `catch (e) {` gets one push to
 *                   window.__CB_SAFE_LOG first, so every other swallow helper is seen too
 *   empty      a CBList that was handed rows (rows() > 0 or remote.total > 0) but drew none (empty / could-not-load state, or no row)
 *   asset      a same-origin script, style or json that did not load (404)
 * COMPARE   the faults are keyed on kind + source file + message. `--base <file>` (a JSON this probe wrote on another checkout: PROBE_ROOT=<dir>
 *   --out <file>) keeps only the NEW ones; with no --base the committed e2e/walk-probe-faults.baseline.json is the base. Exit 1 on any NEW fault.
 *   `--write` records today's faults as the baseline (it may only be done after a count went DOWN, as with the other ratchets).
 *
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-probe-faults.cjs [--out f.json] [--base f.json] [--write]   ONLY=bank,crm narrows pages
 *   PROBE_ROOT=<another checkout> probes that checkout instead of this one (the same transform, the same fixtures).
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('@playwright/test');
const TD = require('./lib/today.cjs');
const standin = require('./lib/standin.cjs');

const HERE = path.resolve(__dirname, '..');
const ROOT = path.resolve(process.env.PROBE_ROOT || HERE);
const PUB = path.join(ROOT, 'public');
const BASELINE = path.join(__dirname, 'walk-probe-faults.baseline.json');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const OUT = arg('--out'), BASEF = arg('--base'), WRITE = process.argv.includes('--write');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SHOP = 'CBWALK0001';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

/* the test-only transform: one push to window.__CB_SAFE_LOG at the top of every catch block that binds the error (served copy only) */
const CATCH = /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{/g;
function transform(text, name) {
  return text.replace(CATCH, (m, v) => m + 'try{var __l=window.__CB_SAFE_LOG;if(__l&&__l.push)__l.push({w:' + JSON.stringify(name) + ',e:' + v + '})}catch(_p){}');
}
function serve() {
  const srv = http.createServer((q, r) => {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const f = (p === '/' || p === '/index.html') ? path.join(ROOT, 'index.html') : path.join(PUB, p);
    if (f !== path.join(ROOT, 'index.html') && !f.startsWith(PUB)) { r.statusCode = 403; return r.end('no'); }
    fs.readFile(f, 'utf8', (e, d) => {
      if (e) { r.statusCode = 404; return r.end('not found'); }
      const ext = path.extname(f);
      r.setHeader('content-type', T[ext] || 'application/octet-stream'); r.setHeader('cache-control', 'no-store');
      r.end(ext === '.js' || ext === '.html' ? transform(d, path.basename(f)) : d);
    });
  });
  return new Promise((res) => srv.listen(0, '127.0.0.1', () => res({ srv, base: 'http://127.0.0.1:' + srv.address().port })));
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const TOKEN = b64({ alg: 'none' }) + '.' + b64({ identity_id: 'ent-probe', identity_type: 'entity', exp: Math.floor(TD.nowMs() / 1000) + 3600 }) + '.x';
const SESSION = JSON.stringify({ token: TOKEN, role: 'entity', name: 'Fixture Owner', entity: 'Fixture Shop', entityId: 'ent-probe', bridgeId: SHOP });

/* the pages: index + every public/*.html (till.html is vendored from the api: its round) + every built manifest route */
function pages() {
  const seen = new Map(); const add = (url) => { const k = url; if (!seen.has(k)) seen.set(k, url); };
  add('/');
  fs.readdirSync(PUB).filter((f) => /\.html$/.test(f) && f !== 'till.html').sort().forEach((f) => add('/' + f));
  try {
    JSON.parse(fs.readFileSync(path.join(PUB, 'app', 'manifest.json'), 'utf8')).entries.forEach((e) => { if (e.state === 'built' && e.route && !/^https?:/.test(e.route) && e.route.indexOf('till.html') < 0) add(e.route.replace('{bridge_id}', SHOP)); });
  } catch (_) { /* a checkout without a manifest */ }
  add('/network-shop.html?bridge=' + SHOP); add('/store.html?net=' + SHOP); add('/embed.html?bridge=' + SHOP);
  return Array.from(seen.values()).filter((u) => !ONLY.length || ONLY.some((o) => u.indexOf(o) >= 0));
}

const norm = (s) => String(s == null ? '' : s).replace(/\d+/g, '#').replace(/\s+/g, ' ').slice(0, 140);
const frameOf = (e) => { const m = /([\w.\-]+\.(?:js|html|cjs)):\d+:\d+/.exec(String(e && e.stack || '').split('\n').slice(1).join('\n')); return m ? m[1] : ''; };

async function main() {
  const { srv, base } = await serve();
  const browser = await chromium.launch();
  const faults = new Map();   /* key -> { key, kind, where, msg, screens: [] } */
  let screens = 0;
  const note = (kind, where, file, msg, screen) => {
    const key = kind + '|' + (file || '') + '|' + norm(msg);
    const f = faults.get(key) || { key, kind, file: file || '', msg: norm(msg), raw: String(msg == null ? '' : msg).slice(0, 300), where, screens: [] };
    if (f.screens.length < 6 && f.screens.indexOf(screen) < 0) f.screens.push(screen);
    faults.set(key, f);
  };
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' });
  await ctx.clock.setFixedTime(TD.now());
  const S = standin.standIn({});
  /* the fixture rows: the api's own contract examples (e2e/fixtures/web-api.contract.json, one real answer per route) answer every GET they cover, so a list has rows to draw; the walks' stand-in answers the rest */
  const CONTRACT = JSON.parse(fs.readFileSync(path.join(HERE, 'e2e', 'fixtures', 'web-api.contract.json'), 'utf8')).routes;
  const EX = Object.keys(CONTRACT).filter((k) => k.indexOf('GET /') === 0 && k.indexOf('#') < 0 && CONTRACT[k].status === 200 && CONTRACT[k].example !== undefined)
    .map((k) => ({ segs: k.slice(4).split('/'), body: JSON.stringify(CONTRACT[k].example) }));
  const same = (x, segs) => x.segs.length === segs.length && x.segs.every((s, i) => s.charAt(0) === ':' || s === segs[i]);
  await ctx.route((u) => u.hostname !== '127.0.0.1', (r) => r.abort());
  await ctx.route((u) => u.pathname.indexOf('/api/') === 0, (r) => {
    const q = r.request();
    if (q.method() === 'GET') { const p = new URL(q.url()).pathname, hit = EX.find((x) => same(x, p.split('/'))); if (hit && p !== '/api/entities/me' && p !== '/api/books/health') return r.fulfill({ status: 200, contentType: 'application/json', body: hit.body }); }
    /* a GET the stand-in has no answer for gets `{}`; PROBE_FALLBACK=array answers `[]` instead — a fault present under both is not the fixture's shape */
    const r2 = process.env.PROBE_FALLBACK === 'array' && q.method() === 'GET' ? new Proxy(r, { get: (t, k) => k === 'fulfill' ? (o) => t.fulfill(o && o.body === '{}' ? Object.assign({}, o, { body: '[]' }) : o) : (typeof t[k] === 'function' ? t[k].bind(t) : t[k]) }) : r;
    return standin.route(S, r2);
  });
  await ctx.addInitScript((s) => {
    window.__CB_SAFE_LOG = [];
    window.print = function () {};
    try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {}
    if (typeof window.cbQuiet !== 'function') window.cbQuiet = function (w, e) { window.__CB_SAFE_LOG.push({ w: 'cbQuiet:' + w, e: e }); };
  }, SESSION);
  const page = await ctx.newPage();
  let cur = 'boot';
  page.on('pageerror', (e) => note('console', 'pageerror', frameOf(e), e && e.message || e, cur));
  page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (/Failed to load resource/.test(t)) return; note('console', 'console.error', '', t, cur); } });
  page.on('response', (r) => { try { const u = new URL(r.url()); if (u.hostname === '127.0.0.1' && r.status() >= 400 && !/^\/api\//.test(u.pathname) && !/favicon/.test(u.pathname)) note('asset', 'http ' + r.status(), '', u.pathname, cur); } catch (_) {} });

  /* drain what the page recorded since the last drain */
  async function drain(screen) {
    cur = screen; screens++; if (screens % 10 === 0) console.log('… ' + screens + ' looks · ' + faults.size + ' faults · at ' + screen);
    let got = [];
    try {
      got = await page.evaluate(() => {
        const out = { swallowed: [], lists: [] };
        const log = window.__CB_SAFE_LOG || []; window.__CB_SAFE_LOG = [];
        log.forEach((x) => { const e = x.e; out.swallowed.push({ w: x.w, m: String(e && e.message || e), s: String(e && e.stack || '') }); });
        document.querySelectorAll('.cbl').forEach((el) => {
          const I = el.__cbl; if (!I || !I.o) return;
          let n = 0;
          try { const rows = typeof I.o.rows === 'function' ? I.o.rows() : I.o.rows; n = Array.isArray(rows) ? rows.length : 0; if (!n && I.o.remote && I.o.remote.total) n = Number(typeof I.o.remote.total === 'function' ? I.o.remote.total() : I.o.remote.total) || 0; } catch (_) { n = -1; }
          const drawn = el.querySelectorAll('[data-row]').length, state = !!el.querySelector('.cbl-state');
          if (n > 0 && drawn === 0 && !/Nothing matches/.test((el.querySelector('.cbl-state') || {}).innerText || '')) out.lists.push({ key: I.key, n, state: state ? (el.querySelector('.cbl-state').innerText || '').slice(0, 60) : 'none' });
        });
        return out;
      });
    } catch (_) { return; }   /* the page was navigating */
    got.swallowed.forEach((x) => { const fr = frameOf({ stack: x.s }) || x.w; note('swallowed', x.w, fr, x.m, screen); });
    got.lists.forEach((x) => note('empty', 'list ' + x.key, x.key, x.n + ' rows handed, none drawn (' + x.state + ')', screen));
  }

  async function sweep(url, label) {   /* tabs, then the first popups */
    const clicked = new Set();
    for (let round = 0; round < 3; round++) {
      const targets = await page.evaluate(() => {
        const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
        const out = [];
        document.querySelectorAll('[role=tab],.tabs button,.tab,[data-tab],.cb-tab,nav button').forEach((e, i) => { if (vis(e) && !e.disabled && out.length < 8) out.push({ i, t: (e.innerText || e.getAttribute('aria-label') || e.getAttribute('data-tab') || '').trim().slice(0, 30) }); });
        return out;
      }).catch(() => []);
      let any = false;
      for (const t of targets) {
        const k = round + '|' + t.t + '|' + t.i; if (clicked.has(k) || !t.t || /delete|remove|sign ?out|log ?out|reset|clear|close|send|pay|post|reverse/i.test(t.t)) continue;
        clicked.add(k); any = true;
        try {
          const before = page.url();
          await page.evaluate((i) => { const els = document.querySelectorAll('[role=tab],.tabs button,.tab,[data-tab],.cb-tab,nav button'); const e = els[i]; if (e) e.click(); }, t.i);
          await page.waitForTimeout(250);
          if (page.url().split('#')[0] !== before.split('#')[0]) { await page.goto(url, { waitUntil: 'load' }).catch(() => {}); await page.waitForTimeout(400); }
          await drain(label + ' › tab ' + t.t);
        } catch (_) { /* a closed page */ }
      }
      if (!any) break;
    }
    /* popups: press the first buttons that are not destructive, look, press Escape */
    const btns = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const out = [];
      document.querySelectorAll('main button, .page button, #app button, body > div button, button[data-cbsid]').forEach((e, i) => { if (out.length < 8 && vis(e) && !e.disabled && !e.closest('[role=tab],.tabs')) out.push({ t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30), id: e.getAttribute('data-cbsid') || '' }); });
      return out;
    }).catch(() => []);
    for (const b of btns) {
      if (!b.t || /delete|remove|sign ?out|log ?out|reset|clear|send|pay|post|reverse|discard|cancel|void|erase|purge/i.test(b.t)) continue;
      try {
        const before = page.url();
        await page.evaluate((t) => { const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }; const e = Array.from(document.querySelectorAll('button')).find((x) => vis(x) && !x.disabled && (x.innerText || x.getAttribute('aria-label') || '').trim().slice(0, 30) === t); if (e) e.click(); }, b.t);
        await page.waitForTimeout(220);
        if (page.url().split('#')[0] !== before.split('#')[0]) { await page.goto(url, { waitUntil: 'load' }).catch(() => {}); await page.waitForTimeout(400); }
        await drain(label + ' › press ' + b.t);
        await page.keyboard.press('Escape').catch(() => {});
      } catch (_) { /* gone */ }
    }
  }

  /* 1 · every page */
  const urls = pages();
  for (const u of urls) {
    cur = u;
    try { await page.goto(base + u, { waitUntil: 'load', timeout: 20000 }); } catch (e) { note('console', 'goto', '', 'did not load: ' + String(e.message).split('\n')[0], u); continue; }
    await page.waitForTimeout(900);
    await drain(u);
    if (!/app\.html/.test(u)) await sweep(base + u, u);
  }

  /* 2 · every screen of app.html's register, by navTo, then the tabs of the ones that have them */
  const keys = [];
  try {
    await page.goto(base + '/app.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.navTo === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(1200);
    await drain('app.html');
    keys.push.apply(keys, await page.evaluate(() => Object.keys((window.CBSCREENS && window.CBSCREENS.byNav) || {})));
  } catch (e) { note('console', 'app boot', '', 'app.html did not boot: ' + String(e.message).split('\n')[0], 'app.html'); }
  for (const k of keys) {
    if (ONLY.length && !ONLY.some((o) => k.indexOf(o) >= 0 || 'app.html'.indexOf(o) >= 0)) continue;
    cur = 'app:' + k;
    try {
      await page.evaluate((key) => { try { navTo(key); } catch (e) { (window.__CB_SAFE_LOG = window.__CB_SAFE_LOG || []).push({ w: 'navTo', e }); } }, k);
      await page.waitForTimeout(900);
      await drain('app:' + k);
      await sweep(base + '/app.html', 'app:' + k);
    } catch (e) { note('console', 'navTo', '', String(e.message).split('\n')[0], 'app:' + k); }
  }
  await browser.close(); srv.close();

  const list = Array.from(faults.values()).sort((a, b) => a.key < b.key ? -1 : 1);
  const result = { head: process.env.PROBE_LABEL || path.basename(ROOT), screens, pages: urls.length, app_screens: keys.length, faults: list };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  const baseKeys = new Set();
  const bf = BASEF || (fs.existsSync(BASELINE) ? BASELINE : null);
  if (bf) JSON.parse(fs.readFileSync(bf, 'utf8')).faults.forEach((f) => baseKeys.add(f.key));
  const fresh = list.filter((f) => !baseKeys.has(f.key));
  console.log('probe · ' + urls.length + ' pages · ' + keys.length + ' app screens · ' + screens + ' looks · ' + list.length + ' faults · ' + fresh.length + ' NEW vs ' + (bf ? path.basename(bf) : 'nothing'));
  fresh.forEach((f) => console.log('NEW · ' + f.kind + ' · ' + f.file + ' · ' + f.msg + ' · ' + f.screens.join(' | ')));
  if (WRITE) { fs.writeFileSync(BASELINE, JSON.stringify({ _: 'base faults of the fault probe (e2e/walk-probe-faults.cjs): a fault not listed here fails the walk. May only shrink.', faults: list.map((f) => ({ key: f.key, kind: f.kind, file: f.file, msg: f.msg })) }, null, 1)); console.log('baseline written: ' + list.length); }
  process.exit(fresh.length && !WRITE ? 1 : 0);
}
main().catch((e) => { console.error('probe stopped: ' + (e && e.stack || e)); process.exit(2); });