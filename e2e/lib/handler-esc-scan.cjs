// e2e/lib/handler-esc-scan.cjs - reviews7: find esc() inside a quoted JS argument of an inline on*= handler, in EVERY concatenation form.
// The old regex needed "(" or "," before the quote, so  ontoggle="X[\'' + esc(k)  and  ="_ARMED=\'rm:' + esc(id)  slipped through. This re-builds
// the HTML the string concatenation produces, follows the single quotes of the handler's own JS, and reports an esc( expression that lands inside one.
// CALLED BY e2e/guard-xss-handlers.cjs.
'use strict';

/** read one expression from i (just after a "+") up to the next top-level "+ string", or a top-level ; , ) */
function readExpr(src, i) {
  let depth = 0, j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') { const q = c; j++; while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; } continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
    else if (depth === 0 && (c === ';' || c === ',')) break;
    else if (depth === 0 && c === '+') {
      let k = j + 1; while (/\s/.test(src[k])) k++;
      if (/['"`]/.test(src[k])) break;
    }
  }
  return { text: src.slice(i, j).trim(), end: j };
}

/** the pieces ({lit} or {expr}) the concatenation yields from start (just after the attribute's opening quote) to the attribute's closing quote */
function simulate(src, start, d) {
  const out = []; let i = start; let lit = '';
  const push = () => { if (lit) out.push({ lit }); lit = ''; };
  let inStr = true, closed = false;
  while (i < src.length && !closed) {
    if (inStr) {
      const c = src[i];
      if (c === '\\') { if (src[i + 1] === '"') { push(); closed = true; break; } lit += src[i + 1]; i += 2; continue; }
      if (d === '`' && c === '$' && src[i + 1] === '{') {
        push(); let depth = 1, j = i + 2;
        while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
        out.push({ expr: src.slice(i + 2, j - 1).trim() }); i = j; continue;
      }
      if (c === d) { inStr = false; i++; continue; }
      if (c === '"') { push(); closed = true; break; }
      if (c === '\n' && d !== '`') break;
      lit += c; i++;
    } else {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] !== '+') break;
      i++; while (/\s/.test(src[i])) i++;
      if (src[i] === d) { i++; inStr = true; continue; }
      const e = readExpr(src, i); push(); out.push({ expr: e.text }); i = e.end;
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === '+') {
        i++; while (/\s/.test(src[i])) i++;
        if (src[i] === d) { i++; inStr = true; continue; }
        const e2 = readExpr(src, i); out.push({ expr: e2.text }); i = e2.end; continue;
      }
      break;
    }
  }
  push();
  return { out, closed };
}

/** every inline on*= handler in src with an esc( inside a single-quoted JS string of the handler: [{ line, expr }] */
function scanHandlerEsc(src) {
  const found = [];
  const re = /\bon[a-z]+=(\\?)"/g;
  let m;
  while ((m = re.exec(src))) {
    const ls = src.lastIndexOf('\n', m.index) + 1;
    const before = src.slice(ls, m.index);
    let d = null;
    for (let k = before.length - 1; k >= 0; k--) {
      const c = before[k];
      if ((c === "'" || c === '`') && before[k - 1] !== '\\') { d = c; break; }
    }
    if (!d) continue;
    const { out } = simulate(src, m.index + m[0].length, d);
    let inQ = false, hit = null;
    for (const p of out) {
      if (p.lit !== undefined) {
        /* the handler's own JS quote is ' or the entity &quot; / &#39; (the browser decodes it before the JS runs) */
        const lit = p.lit.replace(/&quot;|&#34;|&#39;|&apos;/g, "'");
        for (let k = 0; k < lit.length; k++) { const c = lit[k]; if (c === '\\') { k++; continue; } if (c === "'") inQ = !inQ; }
      } else if (inQ && /^esc\(/.test(p.expr)) hit = p.expr;
    }
    if (hit) found.push({ line: src.slice(0, m.index).split('\n').length, expr: hit });
  }
  return found;
}
module.exports = { scanHandlerEsc };
