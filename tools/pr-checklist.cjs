#!/usr/bin/env node
/* tools/pr-checklist.cjs — a PR body must carry the §6 checklist WITH NUMBERS (READ-GUARD, DISCIPLINES §6 · 15 Oct).
 *
 * OWNS      the one reading of a PR body: are the five checklist lines there, are the numbers filled, is any placeholder left;
 *           and the two skips the brief allows — a dependency bot's PR and a docs-only PR.
 * CALLED BY .github/workflows/ci.yml `pr-checklist` job in the web AND the api (the api runs this file from its web checkout:
 *           one reader, never a copy).
 * FLOW      body (PR_BODY env | --body-file) + author + changed files (git diff --name-only base...HEAD | --files-file)
 *           ──▶ skip? ──▶ findLines ──▶ missing · placeholders ──▶ exit 1 with the words, else 0
 * CARD      qa/readability-guard
 *
 *   node tools/pr-checklist.cjs --author LOGIN --base SHA|REF [--root DIR]        (PR_BODY in the environment)
 *   node tools/pr-checklist.cjs --body-file body.md --files-file files.txt --author LOGIN
 */
'use strict';
const fs = require('fs');
const { spawnSync } = require('child_process');

const DEPENDENCY_BOTS = /^(dependabot|renovate|github-actions)(\[bot\])?$/i;
const DOCS_ONLY = /^(docs\/|.*\.md$|\.github\/pull_request_template\.md$)/i;
/** the five lines, and what each must carry to count as filled */
const LINES = [
  {
    name: 'Pass 0 · seams',
    find: /pass 0[^\n]*/i,
    filled: /(`[^`<]+`|nothing exists)/i,
    hint: 'the seams word and what was reused / widened, or "nothing exists"'
  },
  {
    name: 'Pass 1 · shrink',
    find: /pass 1[^\n]*/i,
    filled: /lines\s*`?\d+\s*(→|->)\s*\d+`?[^\n]*complexity\s*`?\d+\s*(→|->)\s*\d+/i,
    hint: 'lines N → N · complexity N → N'
  },
  {
    name: 'Pass 2 · humanify',
    find: /pass 2[^\n]*/i,
    filled: /cryptic names\s*`?\d+\s*(→|->)\s*\d+`?[^\n]*empty catches\s*`?\d+\s*(→|->)\s*\d+/i,
    hint: 'cryptic names N → N · empty catches N → N'
  },
  { name: 'Pass 3 · structure', find: /pass 3[^\n]*/i, filled: /module header[^\n]*CARD/i, hint: 'module header · CARD line · TRACE row' },
  {
    name: 'Guard green',
    find: /guard green[^\n]*/i,
    filled: /readability --changed/i,
    hint: 'the guard line, from `node tools/readability.cjs --changed --ratchet --md`'
  }
];
const PLACEHOLDER = /<(before → after[^>]*|word|name|doc|file|files|n)>/i;
const EXIT_FAIL = 1;

const args = process.argv.slice(2);
function flag(name) {
  const at = args.indexOf('--' + name);
  return at < 0 ? null : args[at + 1];
}

function readBody() {
  const file = flag('body-file');
  if (file) return fs.readFileSync(file, 'utf8');
  return process.env.PR_BODY || '';
}

/** the files this PR changes: --files-file, else git diff --name-only <base>...HEAD */
function changedFiles(root) {
  const listed = flag('files-file');
  if (listed) return fs.readFileSync(listed, 'utf8').split('\n').filter(Boolean);
  const base = flag('base');
  if (!base) return null;
  const diff = spawnSync('git', ['-C', root, 'diff', '--name-only', base + '...HEAD'], { encoding: 'utf8' });
  return diff.status === 0 ? diff.stdout.split('\n').filter(Boolean) : null;
}

/** why this PR is exempt (a dependency bot · docs only), or null */
function skipReason(author, files) {
  if (author && DEPENDENCY_BOTS.test(author)) return 'a dependency bot (' + author + ')';
  if (files && files.length && files.every((file) => DOCS_ONLY.test(file))) return 'docs-only (' + files.length + ' file(s), all docs/ or *.md)';
  return null;
}

/** every checklist line that is missing, unfilled or still carries a <placeholder> */
function problems(body) {
  const found = [];
  for (const line of LINES) {
    const match = line.find.exec(body);
    if (!match) {
      found.push(line.name + ': the line is missing (' + line.hint + ')');
      continue;
    }
    const text = match[0];
    if (PLACEHOLDER.test(text)) found.push(line.name + ': a placeholder is still there — ' + PLACEHOLDER.exec(text)[0] + ' (fill it, or write n/a)');
    else if (!line.filled.test(text)) found.push(line.name + ': not filled — needs ' + line.hint);
  }
  return found;
}

/** read the body, decide the skips, print the problems; the exit code is the verdict */
function main() {
  const body = readBody(),
    author = flag('author') || process.env.PR_AUTHOR || '';
  const files = changedFiles(flag('root') || process.cwd());
  const skip = skipReason(author, files);
  if (skip) {
    console.log('  pr-checklist: skipped — ' + skip);
    return 0;
  }
  const found = problems(body);
  if (!found.length) {
    console.log('  pr-checklist: the §6 checklist is there with its numbers' + (files ? ' (' + files.length + ' file(s) changed)' : ''));
    return 0;
  }
  console.log('  ✗ pr-checklist: the PR body lacks the §6 checklist with numbers (DISCIPLINES §6; template: .github/pull_request_template.md)');
  found.forEach((problem) => console.log('    · ' + problem));
  console.log(
    '  fill it from: node tools/readability.cjs --changed --ratchet --md   (api: node ../chitbridge-web/tools/readability.cjs --changed --repo api --root . --ratchet --md)'
  );
  return EXIT_FAIL;
}

if (require.main === module) process.exit(main());
module.exports = { problems, skipReason, LINES, DEPENDENCY_BOTS, DOCS_ONLY };
