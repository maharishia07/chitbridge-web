/* app/test-menu-tree.js — the product as a menu. ONE shape, two surfaces.
 *
 * ── ⭐⭐ WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"yes, give the lab its own tree as well."*
 *
 * The Report grew a menu tree an hour ago. Giving the lab one means answering the same three questions again —
 * which doors exist, what is behind each, and how much of it has ever been run — and answering them a second
 * time in a second file is the shape that produced nearly every bug of the last three days: three heading
 * readers, three tab dispatches, three canonicalisers, two verdicts, two counters. ⚠️ Each time, the copy that
 * got fixed was not the copy being read.
 *
 * ⭐ SO THE SHAPE LIVES HERE AND THE DRAWING DOES NOT. `testMenuTree()` returns groups, doors and counts; each
 * surface renders them in its own shell, because the shells genuinely differ — the Report draws a full-width
 * tree with fixed tracks, the lab draws a narrow panel beside the app. Sharing the ARITHMETIC and not the
 * markup is the line that has held for testVerdict and testCounts, and it holds here for the same reason.
 *
 * ⚠️ A classic script, no imports, no framework: app.html loads capabilities into one shared scope and
 * testing.html is a single standalone page. A plain <script> is the only thing both can agree on.
 */

/**
 * ⭐ THE MENU PATH IS WRITTEN BY THE SWEEP as `Rail › Task` — group, then door. Splitting it here rather than
 * in each renderer means the two surfaces cannot disagree about what a door IS, which is the only way the lab
 * and the Report can be compared instead of doubted.
 *
 * ⚠️ A case with no `menu` is not an error and not a gap: journey steps walk several doors and automated files
 * walk none. They are COUNTED and reported as `offMenu`, so a tree drawn from this can say so out loud rather
 * than quietly showing 266 of 889 cases as though that were the whole board.
 *
 * @param cases  every case the board holds
 * @param last   case_key → the latest result, or undefined
 * @returns {{groups: Array, offMenu: number, total: number, doors: number}}
 */
function testMenuTree(cases, last) {
  var L = last || {};
  var byGroup = {}, order = [], off = 0;

  (cases || []).forEach(function (c) {
    if (!c.menu) { off++; return; }
    var bits = String(c.menu).split('›');
    var g = (bits[0] || '').trim() || 'Elsewhere';
    var d = (bits[1] || '').trim() || g;
    if (!byGroup[g]) { byGroup[g] = { name: g, doors: {}, order: [] }; order.push(g); }
    var G = byGroup[g];
    if (!G.doors[d]) { G.doors[d] = { name: d, cases: [] }; G.order.push(d); }
    G.doors[d].cases.push(c);
  });

  /**
   * ⭐ WHAT A BRANCH HAS ACTUALLY BEEN RUN FOR, and the three numbers are deliberately separate:
   *   run    a result exists — ⚠️ NOT that it passed. [[the board's standing distinction]]
   *   bad    the latest result is a fail or a blocked
   *   gen    the case was SWEPT from the menu and carries no expectation a person decided on
   * ⚠️ `gen` is what stops a door of green ticks reading as proof. A generated pass says the control did
   * something; nobody has yet written what it should do.
   */
  function evidence(list) {
    var e = { total: list.length, run: 0, bad: 0, gen: 0 };
    list.forEach(function (c) {
      var l = L[c.case_key];
      if (l) e.run++;
      if (l && (l.status === 'fail' || l.status === 'blocked')) e.bad++;
      if (c.generated) e.gen++;
    });
    return e;
  }

  var groups = order.map(function (g) {
    var G = byGroup[g];
    var doors = G.order.map(function (d) {
      var D = G.doors[d];
      var e = evidence(D.cases);
      /* ⭐ sorted by key so a tester walking a door twice walks it in the same order both times */
      D.cases.sort(function (a, b) { return (a.case_key || '') < (b.case_key || '') ? -1 : 1; });
      return { name: D.name, cases: D.cases, total: e.total, run: e.run, bad: e.bad, gen: e.gen };
    });
    var flat = doors.reduce(function (a, d) { return a.concat(d.cases); }, []);
    var ge = evidence(flat);
    return { name: G.name, doors: doors, total: ge.total, run: ge.run, bad: ge.bad, gen: ge.gen };
  });

  var doors = groups.reduce(function (t, g) { return t + g.doors.length; }, 0);
  var total = groups.reduce(function (t, g) { return t + g.total; }, 0);
  return { groups: groups, offMenu: off, total: total, doors: doors };
}

/**
 * ⭐⭐ WHAT RETIREMENT MEANS, IN ONE SENTENCE, IN ONE PLACE. Athi: *"the same has to be updated with retired if
 * it is not going to be useful anymore."* Both surfaces print this under their tree; two wordings of one
 * mechanism is how a reader ends up believing whichever is wrong.
 *
 * ⚠️ It describes a mechanism that ALREADY RUNS. If it ever stops being true this is the most misleading
 * sentence on either page.
 */
var TEST_MENU_RETIRED_NOTE =
  'This tree is swept from the live rail and the live screens, so a door or control added tomorrow appears '
  + 'without anybody adding it — and one that is removed stops being swept, which retires its case at the '
  + 'next load. Retired is not deleted: the case and every result recorded against it stay on the record. '
  + '⚠ A load carrying less than 90% of what the board already holds retires nothing and says so.';
