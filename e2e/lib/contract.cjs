/**
 * e2e/lib/contract.cjs — HOLD A STAND-IN'S ANSWER TO WHAT THE API REALLY SENDS (e2e/fixtures/web-api.contract.json).
 *
 * Why (2026-10-03): the CRM list failed live because the API sends `roles` as an OBJECT { customer, supplier } while this repo's e2e stand-in served a LIST
 * — the page was written to the stand-in, the stand-in to the page, and nothing met the API. The contract is the API's own answers (chitbridge-api
 * docs/contracts/web-api.json, kept true by its tests/web-api-contract.test.cjs). Every harness that answers a /api/books or /api/crm call from the page
 * wraps its route in C.wrap(route): each answer it serves for a route in the contract is checked, and the harness ends with C.finish(ok).
 *
 * ⚠️ THE API'S COPY IS THE MASTER. This is the same file; e2e/contract.cjs fails when the two differ and both repos are side by side.
 * ⚠️ The matcher is the same as chitbridge-api tests/support/contract-shape.cjs; the file's `_selftest` cases keep the two honest.
 *
 *   const C = require('./lib/contract.cjs');
 *   await ctx.route('**\/api/**', (r) => route(S, C.wrap(r)));        // every r.fulfill({ status, body }) is checked
 *   ...  ok(...C.finish())                                              // [true|false, 'message'] - one check at the end
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'fixtures', 'web-api.contract.json');
const kind = (v) => (v === null || v === undefined ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const word = (k) => (k === 'array' ? 'a list' : k === 'object' ? 'an object' : 'a ' + k);

/** → a list of plain problems; empty = the answer conforms to the example (rules: see the API's tests/support/contract-shape.cjs) */
function problems(example, actual, optional, path0, free) {
  const opt = optional instanceof Set ? optional : new Set(optional || []);
  const fre = free instanceof Set ? free : new Set(free || []);
  function collect(ex, ac, p) {
    const ke = kind(ex), ka = kind(ac);
    if (ke === 'null' || ka === 'null') return [];
    if (ke !== ka) return [(p || '(the answer)') + ': the contract has ' + word(ke) + ', the answer has ' + word(ka)];
    if (ke === 'array') {
      if (!ex.length) return [];
      const out = [];
      ac.forEach((el) => {
        const tries = ex.map((x) => collect(x, el, (p || '') + '[]'));
        if (tries.some((t) => !t.length)) return;
        tries.sort((x, y) => x.length - y.length)[0].forEach((m) => out.push(m));
      });
      return out;
    }
    if (ke === 'object') {
      if (fre.has(p)) return [];                       /* a free-form object (a template's event): it must be an object, nothing more */
      const out = [];
      Object.keys(ac).forEach((k) => { if (!(k in ex)) out.push((p ? p + '.' : '') + k + ': the answer sends it, the contract does not list it'); });
      Object.keys(ex).forEach((k) => {
        const kp = (p ? p + '.' : '') + k;
        if (!(k in ac)) { if (!opt.has(kp)) out.push(kp + ': the contract lists it, the answer does not send it'); return; }
        collect(ex[k], ac[k], kp).forEach((m) => out.push(m));
      });
      return out;
    }
    return [];
  }
  return Array.from(new Set(collect(example, actual, path0 || '')));
}

let CACHE = null;
function load(file) {
  if (CACHE && !file) return CACHE;
  const c = JSON.parse(fs.readFileSync(file || FILE, 'utf8'));
  const routes = Object.keys(c.routes).map((k) => {
    const m = /^([A-Z]+) (\S+?)(?: #(\S+))?$/.exec(k);
    return { key: k, method: m[1], pattern: m[2], tag: m[3] || null, status: c.routes[k].status, example: c.routes[k].example, optional: new Set((c.routes[k].optional || []).concat(c.routes[k].also_optional || [])), free: new Set(c.routes[k].free || []) };
  });
  routes.forEach((r) => { r.re = new RegExp('^' + r.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z_]+/g, '[^/]+') + '$'); });
  const out = { raw: c, routes };
  if (!file) CACHE = out;
  return out;
}

/** every contract entry for this request (method + path), most literal pattern first */
function entriesFor(method, pathname, C) {
  const hit = (C || load()).routes.filter((r) => r.method === method && r.re.test(pathname));
  const lit = (r) => r.pattern.split('/').filter((s) => s[0] !== ':').length;
  const best = hit.reduce((m, r) => Math.max(m, lit(r)), -1);
  return hit.filter((r) => lit(r) === best);
}

const STATE = { checked: 0, routes: new Set(), bad: [] };
/** check ONE answer a stand-in served; returns the list of problems (also kept for finish()) */
function check(method, pathname, status, body, who) {
  const es = entriesFor(method, pathname);
  if (process.env.CONTRACT_DEBUG) console.log('  [contract] ' + method + ' ' + pathname + ' ' + status + ' → ' + (es.length ? es.map((e) => e.key).join(' | ') : 'not in the contract'));
  if (!es.length) return [];
  const same = es.filter((e) => e.status === status);
  if (!same.length) {
    if (status >= 400) return [];                       /* an error: the page reads only its status and message */
    const m = method + ' ' + pathname + ' → ' + status + ': the contract has ' + es.map((e) => e.status).join('/') + ' for this route';
    STATE.bad.push({ where: (who || '') + m, problems: [m] }); return [m];
  }
  STATE.checked++; STATE.routes.add(es[0].method + ' ' + es[0].pattern);
  let best = null;
  for (const e of same) { const p = problems(e.example, body, e.optional, '', e.free); if (!p.length) return []; if (!best || p.length < best.length) best = p; }
  STATE.bad.push({ where: (who || '') + method + ' ' + pathname + ' → ' + status, problems: best });
  return best;
}

/** a Playwright Route whose fulfill() is checked on the way out */
function wrap(route, who) {
  const req = route.request();
  return new Proxy(route, {
    get(t, k) {
      if (k === 'fulfill') return (o) => {
        try { const u = new URL(req.url()); const b = o && o.body != null ? JSON.parse(o.body) : null; if (b !== null && /^\/api\/(books|crm)\//.test(u.pathname)) check(req.method(), u.pathname, (o && o.status) || 200, b, who); } catch (_) {}
        return t.fulfill(o);
      };
      const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}

/** the harnesses' J(): serve a JSON answer - checked against the contract on the way out, then fulfilled exactly as before */
function json(r, status, o) {
  try { const q = r.request(), u = new URL(q.url()); if (/^\/api\/(books|crm)\//.test(u.pathname)) check(q.method(), u.pathname, status, JSON.parse(JSON.stringify(o)), ''); } catch (_) {}
  return r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
}

/** [ok, message] for the harness's last check */
function finish() {
  /* the same fault served twice is one fault (route names with an id in them count once per route pattern) */
  const seen = {}, bad = STATE.bad.filter((b) => { const k = b.where.replace(/\/[^\/ ]*\d[^\/ ]*/g, '/:x') + '|' + b.problems.join(';'); return seen[k] ? false : (seen[k] = true); });
  return [bad.length === 0, 'every answer the stand-in served for a route in the API contract has the API\'s keys, nesting and types (' + STATE.checked + ' answers over ' + STATE.routes.size + ' routes)'
    + (bad.length ? ' - ' + bad.slice(0, process.env.CONTRACT_ALL ? 99 : 4).map((b) => b.where + ': ' + b.problems.slice(0, 3).join('; ')).join(' | ') : '')];
}
module.exports = { FILE, load, problems, entriesFor, check, wrap, json, finish, STATE };
