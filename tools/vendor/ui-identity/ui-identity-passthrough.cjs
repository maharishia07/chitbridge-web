'use strict';
/* OWNS: the two small readers of toolset/coverage/ui-identity.cjs that decide whether a control tag that carries no literal data-cbsid is still stamped (UX-137 w4).
   CALLED BY: toolset/coverage/ui-identity.cjs (the census), toolset/coverage/ui-identity-passthrough.test.cjs (the self-test).
   RULE, one generic rule, no per-file list. A helper that builds a control takes its code as a parameter and writes it into the tag, so the tag has no literal data-cbsid:
     (1) the literal HEAD of a code with a computed tail: data-cbsid="CMP037-' + (side === 'prev' ? 'B06' : 'B07') + '" counts when a live code starts with that head (the head is the evidence);
     (2) the helper injects an attribute string it was given: ' + wlStamp(stampCode) + ' | ' + cbsid + ' | ' + attributes + ' | ' + data + '.
   Either one counts as stamped ONLY when the same file names a live code in a stamp position at a call site (helperStamps): stamp: 'X' | stampCode: 'X' | wlStamp('X') | data-cbsid="X" | 'data-cbsid', 'X'.
   PROSE is not a control: a tag named inside a regex literal (/<input|<button/i) or on a key: 'string' data line whose tag has no attribute but type (ex: '<button type="button">'). */
const NL = String.fromCharCode(10);
const CODE = '[A-Z]{3}[0-9]{3}(?:-[A-Z][0-9]{0,2})*';
const STAMPS = new RegExp('(?:[sS]tamp[A-Za-z]*[\'"]?\\s*[:(]\\s*|data-cbsid\\\\?[\'"]?\\s*[=,]\\s*\\\\?)[\'"](' + CODE + ')', 'g');
const HEAD = new RegExp('data-cbsid=["\'](' + CODE + '-?)["\']\\s*\\+');
const INJECT = /'\s*\+\s*(?:\w*[sS]tamp\w*\s*\([^()]*\)|cbsid|attributes|data)\s*(?:\+|$)/;

function make(liveCodes) {
  const liveHead = (h) => liveCodes.has(h) || [...liveCodes].some((x) => x.startsWith(h));
  return {
    helperStamps(text) { return [...new Set([...text.matchAll(STAMPS)].map((m) => m[1]))].filter(liveHead); },
    passThrough(attrs, stamps) {
      const head = attrs.match(HEAD);
      if (head && liveHead(head[1])) return ['', 'HELPER'];
      if (stamps.length && INJECT.test(attrs)) return ['', 'HELPER'];
      return null;
    },
    proseTag(text, m, attrs) {
      const prev = text.charAt(m.index - 1);
      if ((prev === '/' || prev === '|') && /^[|/]/.test(attrs)) return true;
      const at = text.lastIndexOf(NL, m.index) + 1, to = text.indexOf(NL, m.index), ln = text.slice(at, to < 0 ? text.length : to);
      return /^\s*[A-Za-z_$][\w$]*:\s*(['"`]).*\1,?\s*$/.test(ln) && !/data-|\son\w+=|\sid=|class=/.test(attrs);
    }
  };
}
module.exports = make;
