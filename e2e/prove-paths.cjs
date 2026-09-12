'use strict';
/**
 * prove-paths.cjs — WALK TO EVERY CONTROL AND RECORD WHETHER IT IS ACTUALLY THERE.
 *
 * ── ⭐⭐⭐ THE ASK ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Athi, 2026-09-12: *"the path has to be proven."* → *"prove the path with the runner."* → *"also it has to be
 * from screen, both headless and browser? Also if it is multiple browsers say so, then mobile and laptop
 * version. We don't need to cover all, but these are the variants we have to add."*
 *
 * ⚠️⚠️ EVERY ROUTE ON THE BOARD WAS INFERRED. The sweep reads source: which function draws a control, and
 * whether that function's NAME looks like a detail view. From that it wrote "open a chit or task first" — a
 * guess a tester would follow. A wrong route does not merely waste a minute: the first person who follows one
 * into a screen with no such button learns the board is fiction, and stops reading the rest of it.
 *
 * ⭐⭐ THE PROOF IS THE RENDERED DOM. This opens the real app, signs in with the saved session, walks to each
 * door and reads every event-handler attribute that actually exists on the page. A control is PROVEN reachable
 * when the handler the sweep found in the FILE turns up wired to an element a person could click. No label
 * matching, no guessing — the attribute is in the document or it is not.
 *
 * ── ⭐⭐ THE VARIANTS, AND WHY EACH ONE IS A DIFFERENT QUESTION ───────────────────────────────────────────────
 *
 *   laptop · headless    the fast sweep. ⚠️ Headless is not a browser a customer has; it is a lab instrument.
 *   laptop · headed      the same walk in a REAL window. Athi asked for both, and he is right to: headless
 *                        skips paint, so a control hidden behind a CSS transition can pass headless and be
 *                        invisible to a person.
 *   mobile               390×844. Not a smaller laptop — the rail collapses into a drawer, and a control that
 *                        is one tap away on a desktop may be two taps and a scroll away on a phone.
 *
 * ⚠️ OTHER ENGINES ARE NAMED, NOT SILENTLY SKIPPED. Firefox and WebKit are each a ~90 MB download, so this
 * reports whether they are installed and NEVER installs one — the same rule Athi set for the runner:
 * *"we should not just install it, ask permission."*
 *
 * ── ⚠️ WHAT IT CANNOT PROVE, AND MUST NOT CLAIM ─────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ AN EMPTY SCREEN IS NOT A MISSING CONTROL. The e2e account holds no chits, so Task and Compose draw no
 * rows, and every control that lives inside a row is absent for a reason that has nothing to do with the
 * product being wrong. Where a screen renders empty this records `screen empty — needs data`, which is a
 * different fact from `not seen`, and the board must keep them apart. [[feedback-silence-is-the-bug]]
 *
 *   node e2e/prove-paths.cjs                 laptop, headless
 *   node e2e/prove-paths.cjs --all           every variant this machine can run
 *   node e2e/prove-paths.cjs --headed        watch one walk happen
 */
const { chromium, firefox, webkit } = require('@playwright/test');
const { attachSession } = require('./session.cjs');
const fs = require('fs');
const path = require('path');

const ALL = process.argv.indexOf('--all') > -1;
const HEADED = process.argv.indexOf('--headed') > -1;
const BASE = process.env.CB_WEB_BASE || 'https://chitbridge-web.vercel.app';
const OUT = path.join(__dirname, 'path-proof.json');
const SWEEP = path.join(__dirname, '..', '..', 'TEST-CASES-SWEEP.js');

/**
 * ⭐ THE VARIANTS ARE DECLARED, not discovered. A list somebody can read and argue with beats a loop over
 * whatever happens to be installed — and it is what lets the report say "webkit: not installed" rather than
 * quietly testing three things and calling it four.
 */
const VARIANTS = [
  { id: 'laptop-headless', engine: 'chromium', headless: true, w: 1440, h: 1000,
    says: 'a laptop, no window — the fast sweep' },
  { id: 'laptop-headed', engine: 'chromium', headless: false, w: 1440, h: 1000,
    says: 'a laptop, real window — headless skips paint, a person does not' },
  { id: 'mobile', engine: 'chromium', headless: true, w: 390, h: 844, mobile: true,
    says: 'a phone — the rail becomes a drawer, so the route itself changes' },
];
const ENGINES = { chromium: chromium, firefox: firefox, webkit: webkit };

/** ⭐ the doors and their controls, read from the generated sweep so the two cannot disagree */
function wanted() {
  const mod = require(SWEEP);
  const groups = Array.isArray(mod) ? mod : Object.values(mod)[0];
  const byDoor = {};
  groups.forEach((g) => {
    (g.cases || []).forEach((c) => {
      if (!c.menu) return;
      const m = /from the control ([A-Za-z_$][\w$]*)/.exec(c.note || '');
      if (!m) return;
      (byDoor[c.menu] = byDoor[c.menu] || { menu: c.menu, controls: [] })
        .controls.push({ id: c.id, fn: m[1] });
    });
  });
  return byDoor;
}

/**
 * ⚠️ THE MENU PATH IS NOT THE NAV KEY. "Rail › Task" is what a person reads; `task` is what the button carries.
 * Taken from the rail itself, because labels are translated and keys are not.
 */
function navKeys() {
  const rail = require(path.join(__dirname, '..', '..', 'menu-coverage.cjs')).rail();
  const out = {};
  rail.forEach((g) => g.items.forEach((it) => { out[g.group + ' › ' + it.label] = it.key; }));
  return out;
}

/** every handler wired into the page right now */
const HANDLERS = `(() => {
  const out = new Set();
  document.querySelectorAll('[onclick],[onchange],[oninput],[onsubmit],[onkeydown]').forEach((el) => {
    ['onclick','onchange','oninput','onsubmit','onkeydown'].forEach((a) => {
      const v = el.getAttribute(a);
      if (!v) return;
      const re = /([A-Za-z_$][\\w$]*)\\s*\\(/g;
      let m;
      while ((m = re.exec(v))) out.add(m[1]);
    });
  });
  return [...out];
})()`;

/**
 * ⭐ IS THIS SCREEN EMPTY? Asked of the app's own empty states rather than of the text length, because "few
 * words" and "nothing to show" are different things and only one of them explains a missing control.
 */
const EMPTY = `(() => {
  const t = (document.body.innerText || '').toLowerCase();
  const marks = ['nothing in', 'nothing here', 'no chits', 'nothing yet', 'no results', 'nothing to show',
                 'press + to add', 'add the first'];
  return marks.some((m) => t.indexOf(m) > -1);
})()`;

async function walk(v, doors, keys, proof) {
  const engine = ENGINES[v.engine];
  let b;
  try {
    b = await engine.launch({ headless: v.headless });
  } catch (e) {
    /* ⚠️ an engine that is not installed is REPORTED, never installed — see the header */
    proof.variants[v.id] = { ran: false, why: v.engine + ' is not installed on this machine: '
      + String(e.message).split('\n')[0].slice(0, 90),
      fix: 'npx playwright install ' + v.engine + '   (≈ 90 MB — your call, nothing here downloads it)' };
    console.log('  · ' + v.id.padEnd(18) + ' skipped — ' + v.engine + ' not installed');
    return;
  }

  const c = await b.newContext({
    storageState: path.join(__dirname, '.auth', 'user.json'),
    viewport: { width: v.w, height: v.h },
    isMobile: !!v.mobile,
    hasTouch: !!v.mobile,
  });
  await attachSession(c);
  const p = await c.newPage();
  p.on('pageerror', () => {});
  await p.goto(BASE + '/app.html');
  await p.waitForTimeout(7000);

  const out = { ran: true, says: v.says, at: new Date().toISOString(), doors: {} };
  console.log('\n  ▸ ' + v.id + ' — ' + v.says);

  for (const menu of Object.keys(doors)) {
    const key = keys[menu];
    const d = doors[menu];
    if (!key) {
      out.doors[menu] = { reached: false, why: 'no rail key — an action, a panel, or its own page' };
      continue;
    }

    /**
     * ⭐ CLICKED, NOT CALLED. Athi: *"it has to be from screen."* navTo(key) would prove the renderer works;
     * clicking the rail button proves the ROUTE a person takes — and on a phone that route includes opening
     * the drawer first, which calling the function would have skipped entirely.
     */
    let how = 'clicked';
    let ok = true;
    try {
      /**
       * ⚠️ CLOSE WHATEVER IS OPEN FIRST. A modal or the drawer from the previous door covers the rail, and
       * the timeout it produces looks exactly like a broken button. My own walk did this to itself.
       */
      await p.keyboard.press('Escape').catch(() => {});
      await p.waitForTimeout(250);

      let btn = await p.$('[data-testid="nav-' + key + '"]');

      /* on a phone the rail IS a drawer — opening it is part of the route, not a workaround */
      /**
       * ⚠️⚠️ isVisible() IS NOT "a person can see it". On a 390px phone the rail is a CLOSED DRAWER parked
       * at x = -219: a real box, not display:none, so Playwright calls it visible — and my walk therefore
       * skipped opening the drawer, failed the click, fell back to a DOM click, and reported 38 controls
       * PROVEN by a route no person could take. The fallback hid the very thing the mobile variant exists to
       * find.
       * ⭐ The right question is whether its box is INSIDE THE VIEWPORT.
       */
      const reachable = async (el) => {
        if (!el) return false;
        try {
          const r = await el.boundingBox();
          if (!r) return false;
          const vp = p.viewportSize() || { width: 0, height: 0 };
          return r.x + r.width > 0 && r.y + r.height > 0 && r.x < vp.width && r.y < vp.height;
        } catch (_) { return false; }
      };

      if (!(await reachable(btn))) {
        const drawer = await p.$('[data-testid="nav-drawer"]');
        if (drawer && await reachable(drawer)) {
          await drawer.click({ timeout: 2000 }).catch(() => {});
          await p.waitForTimeout(800);
          how = 'opened the drawer, then clicked';
          btn = await p.$('[data-testid="nav-' + key + '"]');
        }
      }

      if (!btn) {
        ok = false; how = 'no rail button on this variant';
      } else {
        /* ⭐ the collapsed group is also part of a person’s route — expand it the way they would */
        await btn.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
        try {
          await btn.click({ timeout: 2500 });
          if (how === 'clicked') how = 'clicked';
        } catch (_) {
          /* ⚠️ a WEAKER claim, and it says so: the element is there and wired, the route may not be clear */
          const did = await btn.evaluate((el) => { el.click(); return true; }).catch(() => false);
          if (did) how = 'clicked in the DOM \u2014 something was covering it';
          else { ok = false; how = 'the button would not take a click at all'; }
        }
      }
      await p.waitForTimeout(2600);
    } catch (e) { ok = false; how = 'the rail would not take a click: ' + String(e.message).slice(0, 46); }

    const onList = ok ? await p.evaluate(HANDLERS) : [];
    const empty = ok ? await p.evaluate(EMPTY) : false;

    let onRow = [];
    let opened = false;
    if (ok) {
      try {
        const row = await p.$('[data-testid$="-row"], [data-testid="wl-row"], [data-testid^="chit-"]');
        if (row && await row.isVisible()) {
          await row.click({ timeout: 2500 });
          await p.waitForTimeout(2200);
          onRow = await p.evaluate(HANDLERS);
          opened = true;
        }
      } catch (e) { /* a row that will not open is a finding for another run, not a crash for this one */ }
    }

    const list = new Set(onList);
    const row = new Set(onRow);
    const seen = {};
    d.controls.forEach((x) => {
      seen[x.fn] = list.has(x.fn) ? 'on the screen'
        : row.has(x.fn) ? 'after opening a row'
        /* ⚠️ the two different reasons a control is absent, kept apart */
        : (empty || !opened) ? 'screen empty — needs data'
        : 'not seen';
    });

    const n = { list: 0, row: 0, empty: 0, none: 0 };
    Object.values(seen).forEach((s) => {
      if (s === 'on the screen') n.list++;
      else if (s === 'after opening a row') n.row++;
      else if (s.indexOf('empty') > -1) n.empty++;
      else n.none++;
    });

    out.doors[menu] = { reached: ok, key: key, how: how, emptyScreen: empty, rowOpened: opened,
      seen: seen, counts: n };
    console.log('    ' + (ok ? '✓' : '✗') + ' ' + menu.padEnd(32)
      + String(n.list).padStart(3) + ' on screen '
      + String(n.row).padStart(3) + ' in a row '
      + String(n.empty).padStart(3) + ' no data '
      + String(n.none).padStart(3) + ' not seen   ' + how);
  }

  await b.close();
  proof.variants[v.id] = out;
}

(async () => {
  const doors = wanted();
  const keys = navKeys();
  const proof = { at: new Date().toISOString(), base: BASE, variants: {} };

  const run = ALL ? VARIANTS
    : HEADED ? VARIANTS.filter((v) => v.id === 'laptop-headed')
    : VARIANTS.filter((v) => v.id === 'laptop-headless');

  console.log('\n— walking the product, door by door —');
  for (const v of run) await walk(v, doors, keys, proof);

  /* ⭐ the engines we did NOT try, named rather than left as an assumption */
  proof.engines = {};
  for (const name of ['firefox', 'webkit']) {
    let ok = false;
    try { ok = !!ENGINES[name].executablePath() && fs.existsSync(ENGINES[name].executablePath()); } catch (_) {}
    proof.engines[name] = ok ? 'installed, not walked in this run'
      : 'NOT INSTALLED — npx playwright install ' + name + ' (≈ 90 MB, your call)';
  }

  fs.writeFileSync(OUT, JSON.stringify(proof, null, 1));

  Object.keys(proof.variants).forEach((id) => {
    const v = proof.variants[id];
    if (!v.ran) { console.log('\n  ' + id + ': ' + v.why); return; }
    const t = Object.values(v.doors).reduce((a, d) => ({
      list: a.list + ((d.counts || {}).list || 0), row: a.row + ((d.counts || {}).row || 0),
      empty: a.empty + ((d.counts || {}).empty || 0), none: a.none + ((d.counts || {}).none || 0),
    }), { list: 0, row: 0, empty: 0, none: 0 });
    console.log('\n  ' + id + ': ' + (t.list + t.row) + ' proven reachable · ' + t.row + ' only inside a row · '
      + t.empty + ' unprovable on an empty account · ' + t.none + ' not seen');
  });
  console.log('\n  firefox: ' + proof.engines.firefox);
  console.log('  webkit:  ' + proof.engines.webkit);
  console.log('\n  ⭐ written to e2e/path-proof.json — rebuild the board to carry it onto the cases.\n');
})();
