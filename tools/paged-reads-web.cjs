#!/usr/bin/env node
'use strict';
/* tools/paged-reads-web.cjs — which web screens read a list route without asking for a page, and whether the screen can show more
 * OWNS      the web half of the paged-read check (PERF1, Athi 26 Nov 2026): which screens read a LIST route without asking for a page, and whether the screen has "show more" / lazy loading.
 * CALLED BY by hand and `npm run check:pagedreads` (--check, a ratchet: the counts may only go down, and a screen not yet in the ratchet may not read a list whole) · the PM report C:/dev/PM/PAGED-READS-*.md (--json)
 * FLOW      e2e/fixtures/paged-read-routes.json (api docs/contracts/paged-read-routes.json, a byte copy: the GET list routes and what each answers when nothing is asked) ──▶ every '/api/…' literal in public/app/*.js and public/*.html
 *           that names a list route ──▶ does the call carry limit / page / after / before ──▶ does its file carry a "more" control ──▶ per screen (a module that reads a list): lazy · whole range · first page only
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/paged-reads
 * OWNER     cb-capability
 * RISK      plain
 *
 * A "screen" here is a web module (public/app/*.js or a page's own script) that reads at least one list route; a call site is a '/api/…' string literal that names one (an upper bound: a literal in a non-GET statement is skipped by its verb, a path built from parts is read from its first literal).
 *   lazy              every list call asks for a page AND the module has a next-page control (data-cbl-more · loadMore · Show more · IntersectionObserver · onQuery · an `after` cursor)
 *   whole range       at least one list call asks for NO page and the server answers every row for it (its `unasked` fact is 'everything'; 'unknown' counts as default page), or the module reads every page (CBList.every)
 *   first page only   every list call asks for a page but the module has no next-page control: rows past the first page are never reachable
 *   default page only a list call asks for no page but the server answers one default page: bounded, and the rest is unreachable
 *
 *   node tools/paged-reads-web.cjs              the counts and the whole-range screens
 *   node tools/paged-reads-web.cjs --json       the full report
 *   node tools/paged-reads-web.cjs --check      the ratchet (tools/paged-reads-web.ratchet.json); --write-ratchet lowers it, never raises it
 */
const fs = require('fs');
const path = require('path');

const WEB_ROOT = path.join(__dirname, '..');
const RATCHET_FILE = path.join(__dirname, 'paged-reads-web.ratchet.json');

const LITERAL = /(['"`])(\/api\/[^'"`\s]*)/g;
const PAGE_ASKED = /[?&](?:limit|page|after|before|offset|per_page)=|\b(?:limit|page|after|before|offset|per_page)\s*:|\bpageArgs\b/;
const NOT_A_READ = /['"](?:POST|PUT|PATCH|DELETE)['"]\s*,\s*$|(?:\bpost|\bput|\bpatch|\bdelete|tillPost|tillPut)\s*\(\s*$|method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]|\bm\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]\s*,\s*p\s*:\s*$/i;
const MORE_CONTROL = /data-cbl-more|cbl-more|loadMore|load more|Load more|Show more|show more|IntersectionObserver|\bonQuery\b|next_after|nextCursor|\bafter\s*:/;
/* a registry row { m: 'GET', p: '/api/…' } under a key, or a plain table entry key: '/api/…' (books-grant-api READS) */
const REGISTRY_ROW = /\b(\w+)\s*:\s*(?:\{\s*m\s*:\s*'GET'\s*,\s*p\s*:\s*)?'(\/api\/[^'\s]*)'/g;
const READS_EVERY_PAGE = /CBList\.every\s*\(|\btestEvery\s*\(/;

/** an api path from a literal: ${...} and a trailing slash become :p, the query goes */
const pathOf = (literal) => literal.split('?')[0].replace(/\$\{[^}]*\}/g, ':p').replace(/\/+$/, '/:p');

const ESCAPE = /[.*+?^${}()|[\]\\]/g;
const routePatterns = (routes) => routes.map((route) => ({ route, pattern: new RegExp('^' + route.path.replace(ESCAPE, '\\$&').replace(/:[A-Za-z_]+/g, '[^/]+') + '$') }));

/** the source with its comments blanked (same length, same lines): a path named in a comment is not a call */
const blank = (match) => match.replace(/[^\n]/g, ' ');
const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/<!--[\s\S]*?-->/g, blank).replace(/(^|[^:'"`\\])(\/\/[^\n]*)/g, (match, lead, comment) => lead + blank(comment));

const filesOf = (base) => [].concat(
  fs.readdirSync(path.join(base, 'public', 'app')).filter((name) => name.endsWith('.js')).map((name) => 'public/app/' + name),
  fs.readdirSync(path.join(base, 'public')).filter((name) => name.endsWith('.html')).map((name) => 'public/' + name)
);

/** the registry rows that name a list route: Map key -> route (a key shorter than 5 characters is a common word, not a name) */
function listKeysOf(sources, patterns) {
  const keys = new Map();
  for (const source of sources) {
    for (const match of source.text.matchAll(REGISTRY_ROW)) {
      const found = patterns.find((item) => item.pattern.test(pathOf(match[2])));
      if (found && match[1].length >= 5) keys.set(match[1], found.route);
    }
  }
  return keys;
}

/** a key is USED as api('key' …) · call('key' …) · EP.key · or, when it is camelCase (not a common word), as any quoted argument or ep: 'key' */
function keyUseOf(keys) {
  const names = [...keys.keys()];
  if (!names.length) return null;
  const camel = names.filter((name) => /[A-Z]/.test(name));
  const camelUse = camel.length ? '|(?:\\(|,|\\bep\\s*:)\\s*[\'"](' + camel.join('|') + ')[\'"]' : '';
  return new RegExp('\\b(?:api|call|apiGet|get)\\(\\s*[\'"](' + names.join('|') + ')[\'"]|\\bEP\\.(' + names.join('|') + ')\\b(?!\\s*[:=])' + camelUse, 'g');
}

/** one call site: its line, the route it reads, what the server answers when nothing is asked, and whether the next 420 characters ask for a page */
function callAt(text, index, route) {
  const window = text.slice(index, index + 420);
  return { line: text.slice(0, index).split('\n').length, route: route.key, unasked: route.unasked, asks_page: PAGE_ASKED.test(window) };
}

/** a registry or table row's own path is not a call, and a write is not a read */
function isRowOrWrite(text, index) {
  const before = text.slice(Math.max(0, index - 80), index);
  return /\b\w+\s*:\s*(?:\{\s*m\s*:\s*'\w+'\s*,\s*p\s*:\s*)?$/.test(before) || NOT_A_READ.test(before.split('\n').pop());
}

/** the list calls of one file: '/api/…' literals that name a list route, and the registry keys that do */
function callsOf(text, patterns, keys, keyUse) {
  const calls = [];
  for (const match of text.matchAll(LITERAL)) {
    if (isRowOrWrite(text, match.index)) continue;
    const found = patterns.find((item) => item.pattern.test(pathOf(match[2])));
    if (found) calls.push(callAt(text, match.index, found.route));
  }
  for (const match of keyUse ? text.matchAll(keyUse) : []) {
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 3);
    if (/^\s*:/.test(after) || /m\s*:\s*['"]/.test(text.slice(match.index, match.index + 40))) continue; /* the registry row itself */
    calls.push(callAt(text, match.index, keys.get(match[1] || match[2] || match[3])));
  }
  return calls;
}

/** the class of one screen from its calls and whether its file reads every page / carries a next-page control */
function classOf(calls, readsEveryPage, hasMoreControl) {
  const unpaged = calls.filter((call) => !call.asks_page);
  if (readsEveryPage || unpaged.some((call) => call.unasked === 'everything')) return 'whole range';
  if (unpaged.length === 0 && !hasMoreControl) return 'first page only';
  return unpaged.length ? 'default page only' : 'lazy';
}

/** the whole scan: { routes, screens: [{ file, calls: [{ line, route, unasked, asks_page }], class }] } */
function scan(root) {
  const base = root || WEB_ROOT;
  const routes = JSON.parse(fs.readFileSync(path.join(base, 'e2e', 'fixtures', 'paged-read-routes.json'), 'utf8')).routes;
  const patterns = routePatterns(routes);
  const sources = filesOf(base).map((file) => ({ file, text: withoutComments(fs.readFileSync(path.join(base, file), 'utf8')) }));
  /* the web names most reads once, in a registry row { m: 'GET', p: '/api/…' } under a key, and asks for them by key: api('key', { query }) */
  const keys = listKeysOf(sources, patterns);
  const keyUse = keyUseOf(keys);
  const screens = [];
  for (const { file, text } of sources) {
    const calls = callsOf(text, patterns, keys, keyUse);
    if (!calls.length) continue;
    const every = READS_EVERY_PAGE.test(text);
    const more = MORE_CONTROL.test(text);
    screens.push({ file, calls, reads_every_page: every, has_more_control: more, class: classOf(calls, every, more) });
  }
  return { routes, screens };
}

/** the counts the PM report and the ratchet use */
function countsOf(found) {
  const by = (name) => found.screens.filter((screen) => screen.class === name);
  const wholeCalls = found.screens.reduce((sum, screen) => sum + screen.calls.filter((call) => !call.asks_page && call.unasked === 'everything').length, 0);
  return { list_routes: found.routes.length, screens: found.screens.length, lazy: by('lazy').length, whole_range: by('whole range').length, first_page_only: by('first page only').length, default_page_only: by('default page only').length, lazy_somewhere: found.screens.filter((screen) => screen.has_more_control && screen.calls.some((call) => call.asks_page)).length, whole_range_calls: wholeCalls, whole_range_files: by('whole range').map((screen) => screen.file).sort() };
}

function checkRatchet(counts) {
  const ratchet = JSON.parse(fs.readFileSync(RATCHET_FILE, 'utf8'));
  const problems = [];
  if (counts.whole_range > ratchet.whole_range) problems.push('screens that read a list whole rose to ' + counts.whole_range + ' (ratchet ' + ratchet.whole_range + ')');
  if (counts.whole_range_calls > ratchet.whole_range_calls) problems.push('list calls with no page asked rose to ' + counts.whole_range_calls + ' (ratchet ' + ratchet.whole_range_calls + ')');
  counts.whole_range_files.filter((file) => !ratchet.whole_range_files.includes(file)).forEach((file) => problems.push(file + ' reads a list route with no limit/page/after: ask for a page and give the screen a "show more" (CBList onQuery), or the server answers every row'));
  return problems;
}

if (require.main === module) {
  const found = scan();
  const counts = countsOf(found);
  const flagGiven = (flag) => process.argv.includes(flag);
  if (flagGiven('--write-ratchet')) {
    const old = fs.existsSync(RATCHET_FILE) ? JSON.parse(fs.readFileSync(RATCHET_FILE, 'utf8')) : null;
    if (old && (counts.whole_range > old.whole_range || counts.whole_range_calls > old.whole_range_calls)) throw new Error('refusing to raise the ratchet');
    fs.writeFileSync(RATCHET_FILE, JSON.stringify({ whole_range: counts.whole_range, whole_range_calls: counts.whole_range_calls, whole_range_files: counts.whole_range_files }, null, 1) + '\n');
    console.log('wrote tools/paged-reads-web.ratchet.json: ' + counts.whole_range + ' screens, ' + counts.whole_range_calls + ' calls');
  } else if (flagGiven('--check')) {
    const problems = checkRatchet(counts);
    console.log('paged reads (web): ' + counts.screens + ' screens read a list · ' + counts.lazy + ' lazy · ' + counts.whole_range + ' whole range · ' + counts.first_page_only + ' first page only · ' + counts.default_page_only + ' default page only');
    problems.forEach((problem) => console.log('FAIL ' + problem));
    process.exit(problems.length ? 1 : 0);
  } else if (flagGiven('--json')) {
    console.log(JSON.stringify({ counts, screens: found.screens }, null, 1));
  } else {
    console.log(JSON.stringify(counts, null, 1));
    found.screens.filter((screen) => screen.class === 'whole range').forEach((screen) => console.log('whole  ' + screen.file + ' · ' + screen.calls.filter((call) => !call.asks_page).map((call) => call.route.replace('GET ', '') + ':' + call.line).join(' ') + (screen.reads_every_page ? ' · reads every page' : '')));
  }
}
module.exports = { scan, countsOf, checkRatchet, pathOf };
