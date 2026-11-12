/* tools/readability/headers.cjs — the HEADER TEMPLATE conformance census (read-only): which files carry the full template, a part, or none.
 *
 * OWNS      the field grammar (FIELD_LINE), the kind of a file by its path (kindOf), the required fields per kind (REQUIRED), and the census
 *           table; it judges nothing and writes nothing. The template itself is PM/HEADER-TEMPLATE.md (docs repo); this is its reader.
 * CALLED BY tools/readability.cjs (--headers); e2e/readability-guard.cjs (the grammar fixtures).
 * FLOW      collect (measure.collect + test files) ──▶ readFields(first 60 lines) ──▶ kindOf(path) ──▶ missing(kind, found) ──▶ tally ──▶ table
 * CARD      qa/readability-guard
 * KIND      tool
 * OWNER     cb-maintainability
 * RISK      plain
 */
'use strict';
const fs = require('fs');
const path = require('path');
const measure = require('./measure.cjs');

const HEAD_LINES = 60;
const FIELDS = ['ID', 'KIND', 'OWNER', 'OWNS', 'CALLED BY', 'CARD', 'FLOW', 'RISK', 'TEST LEVEL', 'RELEASE', 'COUNTRY', 'GATED BY', 'STAMP', 'UNIT'];
/** one field per line: comment decoration, the label, whitespace, a non-empty value (a continuation line is not read: only line 1 of a value counts) */
const FIELD_LINE = new RegExp('^[\\s/*#!<>-]*(' + FIELDS.join('|') + ')\\s+(\\S.*?)\\s*(?:-->|\\*/)?\\s*$');
/** the title line: `<path ending in the file name> — <one-line note>` */
const TITLE_LINE = /^[\s/*#!<>-]*(\S+\.(?:c?js|mjs|html))\s+[—–-]\s+(\S.*?)\s*(?:-->|\*\/)?\s*$/;
const TEST_FILE = /\.test\.(?:c?js|mjs)$|\.spec\.js$|^e2e\/[^/]+\.cjs$/;
const TEST_DIRS = { web: ['tests', 'e2e'], api: ['tests'], engines: ['tests'] };
const SKIP_DIR = /^(node_modules|vendor|\.git|fixtures?|out|dist|docs|migrations|seed|data)$/;
const KINDS = ['module', 'route-file', 'page', 'component', 'engine', 'test', 'tool'];
/** fields every file of the kind MUST carry (title is always required; test needs CARD or UNIT) */
const COMMON = ['KIND', 'OWNER', 'CARD'];
const ENTRY = COMMON.concat(['OWNS', 'CALLED BY', 'RISK']);
const REQUIRED = {
  module: ENTRY,
  'route-file': ENTRY,
  engine: ENTRY.concat(['RELEASE']),
  page: ENTRY.concat(['ID']),
  component: ENTRY.concat(['ID']),
  tool: COMMON.concat(['OWNS', 'CALLED BY']),
  test: ['KIND', 'OWNER']
};

/** the kind of a file, from its repo and path alone (never typed, never guessed beyond this table) */
function kindOf(repo, rel) {
  if (TEST_FILE.test(rel) && /^(tests|e2e)\//.test(rel)) return 'test';
  if (/\.html$/.test(rel)) return 'page';
  if (/^(scripts|tools)\//.test(rel)) return 'tool';
  if (repo === 'api' && /^routes\//.test(rel)) return 'route-file';
  if (repo === 'engines') return 'engine';
  if (repo === 'web' && /^public\//.test(rel)) return 'component';
  if (repo === 'api' && /^public\//.test(rel)) return 'component';
  return 'module';
}

/** what the first 60 lines say: { title: bool, fields: { LABEL: value } } */
function readFields(text, rel) {
  const found = { title: false, fields: {} };
  const lines = text.split(/\r?\n/).slice(0, HEAD_LINES);
  for (const line of lines) {
    const title = TITLE_LINE.exec(line);
    if (title && !found.title && path.basename(rel) === path.basename(title[1])) found.title = true;
    const field = FIELD_LINE.exec(line);
    if (field && !(field[1] in found.fields)) found.fields[field[1]] = field[2];
  }
  return found;
}

/** the REQUIRED fields (and the title) a file lacks, in template order */
function missing(kind, found) {
  const lacks = REQUIRED[kind].filter((label) => !(label in found.fields));
  if (kind === 'test' && !('CARD' in found.fields) && !('UNIT' in found.fields)) lacks.push('CARD|UNIT');
  if (!found.title) lacks.unshift('title');
  return lacks;
}

/** the three states: full (nothing missing) · none (no title and no field line at all) · partial */
function stateOf(kind, found) {
  const lacks = missing(kind, found);
  if (!lacks.length) return { state: 'full', lacks };
  const anything = found.title || Object.keys(found.fields).length > 0;
  return { state: anything ? 'partial' : 'none', lacks };
}

/** test files of one repo under its test folders (fixtures, vendored and data folders skipped) */
function collectTests(repo, root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIR.test(entry.name)) walk(full);
      } else if (TEST_FILE.test(path.relative(root, full).replace(/\\/g, '/'))) out.push({ abs: full, rel: path.relative(root, full).replace(/\\/g, '/') });
    }
  };
  (TEST_DIRS[repo] || []).forEach((folder) => walk(path.join(root, folder)));
  return out;
}

/** one blank row of the tally */
const blank = () => ({ files: 0, full: 0, partial: 0, none: 0, core3: 0, risk: 0, testLevel: 0, lacks: {} });

/** add one file to a row */
function tally(row, kind, found, judged) {
  row.files++;
  row[judged.state]++;
  if (found.title && 'OWNS' in found.fields && 'CALLED BY' in found.fields && ('CARD' in found.fields)) row.core3++;
  if ('RISK' in found.fields) row.risk++;
  if ('TEST LEVEL' in found.fields) row.testLevel++;
  judged.lacks.forEach((label) => (row.lacks[label] = (row.lacks[label] || 0) + 1));
}

/** { repo: { kind: row } } for the given roots { web, api, engines } */
function census(roots) {
  const out = {};
  for (const repo of Object.keys(roots)) {
    const files = measure.collect(repo, roots[repo]).files.concat(collectTests(repo, roots[repo]));
    out[repo] = {};
    for (const file of files) {
      const kind = kindOf(repo, file.rel);
      const found = readFields(fs.readFileSync(file.abs, 'utf8'), file.rel);
      const row = out[repo][kind] || (out[repo][kind] = blank());
      tally(row, kind, found, stateOf(kind, found));
    }
  }
  return out;
}

/** the census as a markdown table (one row per repo and kind, then a total per repo) */
function table(result) {
  const head = '| repo | kind | in scope | full | partial | none | title+OWNS+CALLED BY+CARD | RISK | TEST LEVEL | most-missing fields |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---|';
  const rows = [];
  for (const repo of Object.keys(result)) {
    const total = blank();
    for (const kind of KINDS.filter((name) => result[repo][name])) {
      const row = result[repo][kind];
      rows.push(line(repo, kind, row));
      Object.keys(total).filter((key) => key !== 'lacks').forEach((key) => (total[key] += row[key]));
    }
    rows.push(line(repo, '**all**', total).replace(/^\| (\S+) \| \*\*all\*\*/, '| **$1** | **all**'));
  }
  return head + '\n' + rows.join('\n');
}

/** one table row; the three most-missing fields with their counts */
function line(repo, kind, row) {
  const top = Object.entries(row.lacks)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map((pair) => pair[0] + ' ' + pair[1])
    .join(' · ');
  return `| ${repo} | ${kind} | ${row.files} | ${row.full} | ${row.partial} | ${row.none} | ${row.core3} | ${row.risk} | ${row.testLevel} | ${top} |`;
}

module.exports = { FIELD_LINE, TITLE_LINE, REQUIRED, kindOf, readFields, missing, stateOf, census, table };
