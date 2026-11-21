'use strict';
/* OWNS: the register code a ui.dialog({ pop: 'POPnnn' }) call names, read from that call's own argument object only; with opener 'modal' (15 Nov, popups to green)
   the same read for modal(html, wide, { pop: 'POPnnn' }), the code the page's modal() writes in the dialog's header chip.
   CALLED BY toolset/coverage/ui-identity.cjs. `src` starts at the `ui.dialog(` of the call and may run on into later code.
   Brackets are matched from the call's open paren, string contents are skipped, and only a pop: at the top level of the first argument
   object counts, so a neighbouring call's code (or a nested object's) is never borrowed. Returns the code, or null when this call names none. */
function popOf(src, opener) {
  const at = src.search(opener === 'modal' ? /\bmodal\s*\(/ : /\bui\.dialog\s*\(/);
  if (at < 0) return null;
  const BS = String.fromCharCode(92);
  let depth = 0, q = null, top = '';
  for (let i = src.indexOf('(', at) + 1; i < src.length; i++) {
    const c = src[i];
    if (q) { top += depth === 1 ? c : ' '; if (c === BS) { i++; top += depth === 1 ? (src[i] || '') : ' '; } else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; top += depth === 1 ? c : ' '; continue; }
    if (c === '(' || c === '{' || c === '[') { depth++; top += ' '; continue; }
    if (c === ')' || c === '}' || c === ']') { if (depth === 0) break; depth--; top += ' '; continue; }
    top += depth === 1 ? c : ' ';
  }
  const m = top.match(/\bpop:\s*'(POP\d{3})'/);
  return m ? m[1] : null;
}
module.exports = { popOf };
