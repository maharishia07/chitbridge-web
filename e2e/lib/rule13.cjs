/**
 * e2e/lib/rule13.cjs — RULE 13, THE ONE AUDIT EVERY NEW SCREEN'S WALK RUNS (owner's Country-lab screenshot, 13 Oct; lifted out of
 * walk-settings.cjs on 2026-10-14 when walk-settings-ops.cjs became its second caller — one helper, two walks).
 *
 * In light AND dark, at 1366 and 390 px: AA contrast of every text element (lib/theme-measure.cjs, the same eyes as crm-themes), no clipped or
 * truncated text in the pane, no inner sideways scroll, no fixed/sticky control covering a control, no link to app.html, and the copy within the
 * text budget — no doc defines one yet: a hint or line of copy is at most 140 characters and two sentences (said here, so the number is visible).
 *
 *   const R13 = require('./lib/rule13.cjs');
 *   const a = await R13.audit(page, 'set');                 // → { clip, frameClip, scroll, cover, app, budget }  (the pane = #set)
 *   const fails = R13.fails(pairs, a);                      // pairs = await page.evaluate(measure) — the contrast pairs
 *   await R13.sweep(w, page, measure, { host: 'set', sections: { shop: open, country: open }, from: 7 });   // the 2 × 2 × sections steps
 */
'use strict';

function audit(page, hostId) {
  return page.evaluate((hid) => {
    const host = document.getElementById(hid), out = { clip: [], frameClip: [], scroll: [], cover: [], app: [], budget: [] };
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    document.querySelectorAll('body *').forEach((el) => {
      if (!vis(el) || el.closest('#cb-avatar,#toast,script,style')) return;
      const cs = getComputedStyle(el), hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (/auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && el !== document.documentElement && el !== document.body) out.scroll.push(el.tagName + '.' + el.className + ' ' + el.scrollWidth + '>' + el.clientWidth);
      if (hasText && (cs.textOverflow === 'ellipsis' || /hidden|clip/.test(cs.overflowX)) && el.scrollWidth > el.clientWidth + 1) (host.contains(el) ? out.clip : out.frameClip).push(el.textContent.trim().slice(0, 40));
      const href = (el.getAttribute('href') || '') + ' ' + (el.getAttribute('onclick') || '');
      if (/app\.html/.test(href)) out.app.push(el.outerHTML.slice(0, 80));
    });
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.scroll.push('page ' + document.documentElement.scrollWidth + '>' + window.innerWidth);
    /* a fixed/sticky control over content: the centre of every control in the pane must hit the control itself */
    host.querySelectorAll('button,input,select,textarea,a').forEach((c) => {
      if (!vis(c)) return; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && hit !== c && !c.contains(hit) && !hit.contains(c) && !hit.closest('#toast')) out.cover.push((c.dataset.testid || c.id || c.tagName) + ' under ' + (hit.id || hit.className || hit.tagName));
    });
    host.querySelectorAll('p,.hint,.sub,.err').forEach((n) => {
      const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t) return;
      const sentences = t.split(/[.!?](\s|$)/).filter((s) => s && s.trim()).length;
      if (t.length > 140 || sentences > 2) out.budget.push(t.length + ' chars / ' + sentences + ' sentences: "' + t.slice(0, 50) + '…"');
    });
    window.scrollTo(0, 0);
    return out;
  }, hostId);
}

/** the failures, in words — contrast first, then what the audit found */
function fails(pairs, a) {
  const bad = pairs.filter((x) => !x.grad && x.ratio < x.need);
  return [].concat(bad.map((x) => 'contrast ' + x.ratio + ' "' + x.text + '"'), a.clip.map((x) => 'clipped "' + x + '"'), a.scroll.map((x) => 'scroll ' + x),
    a.cover.map((x) => 'covered ' + x), a.app.map((x) => 'app.html ' + x), a.budget.map((x) => 'budget ' + x));
}

/**
 * the sweep: two themes × two widths × every section — one walk step each ("T7 · shop · dark · 390 px -> …").
 * opts: { host: the pane's id, sections: { key: async () => open it }, from: the first step number, prefix: 'T', frameClip: Set (the frame's own ellipses, reported once) }
 */
async function sweep(w, page, measure, opts) {
  let k = opts.from || 1; const frameClip = opts.frameClip || new Set(); const prefix = opts.prefix || 'T';
  for (const theme of ['cream', 'dark']) {
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: width > 500 ? 900 : 844 });
      for (const sec of Object.keys(opts.sections)) {
        const n = k++;
        await w.step(prefix + n, sec + ' · ' + theme + ' · ' + width + ' px -> AA contrast, no clipping, no inner sideways scroll, nothing floating over a control, no app.html link, copy in budget', async () => {
          await opts.sections[sec]();
          await page.evaluate((t) => { CBAvatar.applyTheme(t); }, theme); await page.waitForTimeout(150);
          const pairs = await page.evaluate(measure), a = await audit(page, opts.host), f = fails(pairs, a);
          a.frameClip.forEach((x) => frameClip.add(x));
          return { ok: !f.length && pairs.length > 10, saw: pairs.length + ' texts measured, lowest ' + Math.min.apply(null, pairs.map((x) => x.ratio)) + (f.length ? ' · ' + f.slice(0, 4).join(' · ') : ' · clean') };
        });
      }
    }
  }
  await page.evaluate(() => { CBAvatar.applyTheme('cream'); }).catch(() => {});
  return frameClip;
}

module.exports = { audit, fails, sweep };
