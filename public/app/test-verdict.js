/* app/test-verdict.js — what would make this red green. ONE judgement, two surfaces.
 *
 * ── ⭐⭐ WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12, on the lab: *"this is nothing but the cases tab in the report — those information should be
 * here as well."*
 *
 * He is right, and carrying it across meant writing the verdict a second time: once in testing.html for the
 * REPORT, once in cap-testing.js for the LAB. ⚠️ That is the shape that produced every bug of the last two
 * days — three copies of a heading reader, three of a tab dispatch, two of a canonicaliser. Each time the copy
 * that got fixed was not the copy being read.
 *
 * ⭐ So the judgement lives here and both surfaces call it. A classic script with no imports and no framework,
 * because app.html loads capabilities into one shared scope and testing.html is a single standalone page —
 * the only thing both can agree on is a plain <script>.
 *
 * ── THE FOUR ANSWERS ───────────────────────────────────────────────────────────────────────────────────────
 *
 *   ⟳ re-run       the file changed AFTER this result. The red describes code that no longer exists.
 *   ⚙ environment  it needs a database, the API or a browser that the run did not have.
 *   ⏸ decision     the file declares a held decision — red because nobody has chosen yet.
 *   ✗ defect       red, unchanged since the result, needing nothing it lacked. ⭐ THE REAL ONE.
 *
 * ⚠️ DEFECT IS NEVER THE DEFAULT. It is the strongest thing this can say, and the first version let it be what
 * fell out when the others were ruled out — so seven reds were called defects using fields that were simply
 * MISSING, two of them already fixed. A case with no `changed_at` cannot rule out "re-run", so it returns
 * `unknown` and says why. Absence of evidence is not evidence.
 */
'use strict';

var TEST_TODO = {
  'never run':   { icon: '○', tone: 'dim',   say: 'nobody has run it' },
  'ok':          { icon: '✓', tone: 'ok',    say: 'nothing to do' },
  're-run':      { icon: '⟳', tone: 'warn',  say: 're-run — the file changed after this result' },
  'environment': { icon: '⚙', tone: 'warn',  say: 'needs something the run did not have' },
  'decision':    { icon: '⏸', tone: 'warn',  say: 'a decision nobody has made yet' },
  'defect':      { icon: '✗', tone: 'bad',
                   say: 'a defect — unchanged since this result, and it needs nothing it did not have' },
  'unknown':     { icon: '?',      tone: 'dim',
                   say: 'cannot tell yet — this board has not been rebuilt since the file facts were added' },
};

/**
 * @param c    the case, as the board holds it (changed_at, needs, held)
 * @param last the latest result for it, or null
 * @returns {{kind:string, why:string}}
 */
function testVerdict(c, last) {
  if (!c) return { kind: 'unknown', why: TEST_TODO.unknown.say };
  if (!last) return { kind: 'never run', why: TEST_TODO['never run'].say };
  if (last.status === 'pass') return { kind: 'ok', why: TEST_TODO.ok.say };

  /**
   * ⚠️ THIS COMPARISON COMES FIRST, and the order is the whole point: a file changed AFTER its last result
   * means the result describes code that is gone. Ruling that out before anything else is what stops a stale
   * red being called a defect.
   */
  if (c.changed_at && last.at && new Date(c.changed_at) > new Date(last.at)) {
    return { kind: 're-run', why: TEST_TODO['re-run'].say };
  }
  if (c.needs && c.needs.length) return { kind: 'environment', why: 'needs ' + c.needs.join(' and ') };
  if (c.held) return { kind: 'decision', why: 'a decision: ' + c.held };
  /* ⚠️ no facts ⇒ no claim. See the header. */
  if (!c.changed_at) return { kind: 'unknown', why: TEST_TODO.unknown.say };
  return { kind: 'defect', why: TEST_TODO.defect.say };
}

/** the short label for a row — '' when there is nothing to do, so a green row stays quiet */
function testVerdictLabel(c, last) {
  var v = testVerdict(c, last);
  if (v.kind === 'ok') return '';
  return (TEST_TODO[v.kind] || TEST_TODO.defect).icon + ' ' + v.kind;
}
