/* tools/readability/noise.cjs — is a file's change only NOISE: comments and data-cbsid attributes? (MNT, 2026-11-13)
 *
 * OWNS      sameCode(file, headText, baseText): true when the head and the base carry the same code once comments and data-cbsid
 *           attributes are removed from both (the token streams are compared, so a one-character code change is never noise).
 * CALLED BY tools/readability/guard.cjs (judgeFile: a comment-only or id-only diff warns on the test-layer rules, it does not fail them),
 *           e2e/readability-guard.cjs (the fixtures).
 * FLOW      text ──▶ .js/.cjs/.mjs: acorn tokens (comments are never tokens) · .html: comments cut, script bodies tokenised, style
 *           comments cut ──▶ data-cbsid attributes cut ──▶ one string per version ──▶ equal?   Anything it cannot read is NOT noise.
 * CARD      qa/readability-guard
 */
'use strict';
const path = require('path');

function loadAcorn() {
  try {
    return require('acorn');
  } catch (_) {
    return require(path.join(__dirname, '..', 'vendor', 'acorn.cjs'));
  }
}
const acorn = loadAcorn();

/** ` data-cbsid="X"` in any form it takes in markup or inside a JS string (plain, single-quoted, backslash-escaped quotes, bare) */
const CBSID_ATTRIBUTE = /\s*data-cbsid=(?:\\?"[^"\\]*\\?"|\\?'[^'\\]*\\?'|[^\s>"'\\]+)/g;
const withoutIds = (text) => text.replace(CBSID_ATTRIBUTE, '');
const collapse = (text) => text.replace(/\s+/g, ' ').trim();

/** the tokens of JS code (comments are not tokens), each as its own text with ids removed from strings and templates */
function codeStream(code) {
  const tokens = [];
  for (const token of acorn.tokenizer(code, { ecmaVersion: 'latest', allowHashBang: true }))
    tokens.push(token.type.label + '\u0001' + withoutIds(code.slice(token.start, token.end)));
  return tokens.join('\u0002');
}

const SCRIPT = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi;
const STYLE = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/** a page: script bodies as token streams, style comments and html comments cut, the rest compared as text */
function pageStream(html) {
  const bodies = [];
  const holder = (body) => {
    bodies.push(body);
    return '<script-body ' + (bodies.length - 1) + '>';
  };
  const shell = html
    .replace(SCRIPT, (_all, open, body, close) => open + holder(body) + close)
    .replace(STYLE, (_all, open, body, close) => open + body.replace(CSS_COMMENT, '') + close)
    .replace(HTML_COMMENT, '');
  const scripts = bodies.map(safeCode);
  return collapse(withoutIds(shell)) + '\u0003' + scripts.join('\u0003');
}

/** a script body's token stream; a body acorn cannot read stays as its own whitespace-collapsed text (so its comments count) */
function safeCode(body) {
  try {
    return codeStream(body);
  } catch (_) {
    return 'RAW' + collapse(withoutIds(body));
  }
}

/** a file acorn cannot read is never noise: the finding stays as it was (null = no comparable form) */
const unreadable = (_error) => null;

/** the comparable form of one version of a file, or null when it cannot be read */
function streamOf(file, text) {
  try {
    if (/\.html?$/i.test(file)) return pageStream(text);
    if (/\.(c|m)?js$/i.test(file)) return codeStream(text);
  } catch (error) {
    return unreadable(error);
  }
  return null;
}

/** true when head and base differ only in comments and data-cbsid attributes (and at least one version could be read) */
function sameCode(file, headText, baseText) {
  if (headText == null || baseText == null) return false;
  const head = streamOf(file, headText),
    base = streamOf(file, baseText);
  return head !== null && base !== null && head === base;
}

module.exports = { sameCode, streamOf };
