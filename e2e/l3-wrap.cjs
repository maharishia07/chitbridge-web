/**
 * l3-wrap.cjs — lift display copy OUT of HTML strings so it can be translated.
 *
 * Athi, 2026-08-19, after seeing the rail turn Arabic and nothing else: *"the menu only changed to arabic, but
 * rest of the content still in english?"*
 *
 * ⭐⭐ TRANSLATION WAS NEVER THE BOTTLENECK — EXTRACTION IS. The words on screen are baked inside markup, where
 * no lookup can reach them:
 *
 *     `<label class="fl">Assignment model</label>`        no function can see those two words
 *     `<label class="fl">${tx('Assignment model')}</label>`   now it can
 *
 * ⚠️ THE TWO QUOTING CONTEXTS NEED DIFFERENT OUTPUT, and getting it wrong breaks the file:
 *
 *     template literal    `...>TEXT<...`     ->  `...>${tx('TEXT')}<...`
 *     concatenation       '...>TEXT<...'     ->  '...>' + tx('TEXT') + '<...'
 *
 * So this does not pattern-match blindly. It WALKS each line tracking which string it is inside and which
 * delimiter opened it, and emits the form that context requires. A regex cannot know that.
 *
 * ⚠️ AND IT REFUSES EVERYTHING IT CANNOT PROVE. No interpolation in the text, no nested markup, no HTML entity,
 * must contain a letter, must not already be wrapped. Every file is re-parsed and reverted WHOLE on failure —
 * the l3-apply lesson, where "the BEFORE appears exactly once" turned out not to mean the BEFORE was a complete
 * expression, and five files broke.
 *
 * Usage:  node e2e/l3-wrap.cjs <file> [fromLine] [toLine]        (no write without --apply)
 */
const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const file = process.argv[2];
const from = Number(process.argv[3] || 1);
const to = Number(process.argv[4] || Infinity);
const APPLY = process.argv.includes('--apply');
if (!file) { console.log('usage: node e2e/l3-wrap.cjs <file> [from] [to] [--apply]'); process.exit(1); }

const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
const before = fs.readFileSync(abs, 'utf8');
const eol = before.includes('\r\n') ? '\r\n' : '\n';
const lines = before.split(/\r?\n/);

/**
 * ⚠️⚠️ NAMES OF STANDARDS ARE NOT COPY. "CLDR", "WCAG 2.2", "Accept-Language", "-u-nu-" and "Okabe–Ito" are
 * proper nouns and wire values. Translating them would be actively wrong — an Arabic reader looking for the
 * Accept-Language header needs to read "Accept-Language". The first run of this tool offered all five.
 */
const NEVER = /^(CLDR|ICU|WCAG|GS1|ISO|RFC|UTS|BCP|LEI|HS|UN\/?LOCODE|UCP|Incoterms|Okabe|gettext|Intl|ltree|Accept-Language|Content-Language|User-Agent|JSON|CSV|API|URL|OTP|RLS|SKU|PIM|MDM|ERP|IoT|AI)\b/i;
const TOKENISH = /^-u-|^[a-z]{2}(-[A-Za-z0-9]+)+$|^[A-Za-z-]+:[A-Za-z]|^\.?[a-z-]+\(\)$/;

/**
 * ⚠️⚠️ A FRAGMENT IS WORSE THAN AN UNTRANSLATED LABEL. Text inside an inline tag mid-sentence — the "actor" in
 * "…acts as an <b>actor</b> for you" — is half a sentence. Wrapping it hands a translator two pieces that
 * cannot be reassembled in a language that orders them differently, which is the precise thing txf() exists to
 * prevent. So a label must START LIKE A LABEL: a capital, a digit or an emoji. Lowercase means mid-sentence.
 *
 * An em dash opening is the same tell — "— how figures are written" is a clarifier appended to a label that
 * lives outside this element, so it is only half of the phrase a reader sees.
 */
function isCopy(s) {
  if (!s || s.length < 3 || s.length > 90) return false;
  if (!/[A-Za-z]/.test(s)) return false;                 // must contain a letter
  if (/\$\{|<|>|&[a-z#]+;/.test(s)) return false;        // interpolation, nested markup, entities
  if (/^\s|\s$/.test(s)) return false;                   // leading/trailing space changes layout
  if (NEVER.test(s) || TOKENISH.test(s)) return false;
  if (/^[—–-]/.test(s)) return false;                    // a trailing clarifier, not a whole phrase
  /* ⚠️ ENDING mid-sentence is the same fault as starting mid-sentence: 'Carried is not the same as enforced,'
     continues OUTSIDE this element, so wrapping it hands over half a sentence. */
  if (/[,;:]$/.test(s)) return false;
  if (!/^[A-Z0-9À-ɏ\u{1F300}-\u{1FAFF}←-➿]/u.test(s)) return false;  // lowercase = mid-sentence
  if (/^[A-Z_]+$/.test(s) && s.length < 4) return false; // a token, not a word
  if (/^(px|em|rem|auto|none|flex|grid|block|inline|bold|solid|center|left|right|start|end)$/i.test(s)) return false;
  return true;
}

const hits = [];
let n = 0;

/**
 * ⚠️⚠️ A TEMPLATE LITERAL SPANS LINES, AND THIS FILE IS FULL OF THEM. The first version reset the string state
 * at every newline, so it never saw itself as "inside a string" on the continuation lines — and silently skipped
 * exactly the labels this run exists for:
 *
 *     return `<div class="card">
 *       <label class="fl">Assignment model</label>      <-- invisible to a line-local scanner
 *     </div>`;
 *
 * It reported 26 found and looked like it had worked. A scanner that under-reports is the worst kind, because
 * the number is plausible. Backtick state now carries ACROSS lines; ' and " cannot span a line in JS, so those
 * still reset — which is also what makes the carry safe.
 */
let carried = null;

const out = lines.map((line, idx) => {
  const ln = idx + 1;
  if (/^\s*(\*|\/\/|\/\*)/.test(line)) { return line; }  // a comment is not a screen

  let res = '';
  let i = 0;
  let quote = carried;                                    // the delimiter that opened the current string
  const inRange = ln >= from && ln <= to;

  while (i < line.length) {
    const c = line[i];

    /* escape inside a string — copy both chars, judge neither */
    if (quote && c === '\\') { res += line.slice(i, i + 2); i += 2; continue; }

    if (!quote && (c === '"' || c === "'" || c === '`')) { quote = c; res += c; i++; continue; }
    if (quote && c === quote) { quote = null; res += c; i++; continue; }

    /* inside a string, and at the end of a tag: try to take the text up to the next '<' */
    if (quote && c === '>') {
      const close = line.indexOf('<', i + 1);
      if (close > i + 1) {
        const text = line.slice(i + 1, close);
        /* the text must not run past the end of this string */
        const q = line.indexOf(quote, i + 1);
        /**
         * ⚠️ THE RANGE GATES THE REWRITE, NOT THE SCAN. The scanner must walk the WHOLE file to know whether a
         * given line sits inside an open template literal — start it at line 2009 and it has no idea what is
         * open. So every line is read; only lines in range are changed.
         */
        if (inRange && !(q !== -1 && q < close) && isCopy(text) && !/\btx\(/.test(text)) {
          const lit = "tx('" + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "')";
          res += '>' + (quote === '`' ? '${' + lit + '}' : quote + ' + ' + lit + ' + ' + quote);
          hits.push({ ln, text });
          n++;
          i = close;
          continue;
        }
      }
    }
    res += c; i++;
  }
  /* only a backtick can still be open at end of line; a stray ' or " is a scan error, not a string */
  carried = (quote === String.fromCharCode(96)) ? quote : null;
  return res;
});

console.log('\n  ' + n + ' label(s) liftable in ' + path.basename(file) + ' lines ' + from + '-' + (to === Infinity ? 'end' : to));
hits.slice(0, 60).forEach((h) => console.log('    ' + String(h.ln).padStart(5) + '  ' + h.text));
if (hits.length > 60) console.log('    … and ' + (hits.length - 60) + ' more');

if (!APPLY) { console.log('\n  (dry run — pass --apply to write)\n'); process.exit(0); }
if (!n) { console.log('\n  nothing to do\n'); process.exit(0); }

fs.writeFileSync(abs, out.join(eol));
let ok = true;
if (/\.js$/.test(abs)) {
  try { cp.execSync('node -c "' + abs + '"', { stdio: 'pipe' }); } catch (_) { ok = false; }
} else {
  const RE = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  const s = out.join(eol);
  let m;
  while ((m = RE.exec(s))) { try { new Function(m[1]); } catch (_) { ok = false; break; } }
}
if (!ok) { fs.writeFileSync(abs, before); console.log('\n  PARSE FAILED — file reverted whole, nothing changed\n'); process.exit(1); }
console.log('\n  applied and parses clean\n');
