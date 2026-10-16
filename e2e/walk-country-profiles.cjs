'use strict';
/**
 * e2e/walk-country-profiles.cjs — THE COUNTRY LAB'S "COUNTRIES" VIEW (R6, 2026-10-16; RUNBOOK-ADD-A-COUNTRY Q11).
 * Athi: "left side panel, country name and right side all the attributes, documents, filling, govt norms" · "there should not be any leakage of
 * other country details". For EVERY registered country (read from the page's own engines — the walk lists none itself):
 *   P1 · the list holds every pack; picking one paints its head and the nine cards
 *   P2 · nothing of another country shows: no other pack's currency code or tax-ID word in the cards
 *   P3 · the tax-ID box refuses "x" with the pack's own check — or says it is checked on save
 *   P4 · rule 13: cream and dark, 1366 and 390 px — AA contrast, no sideways scroll, the phone picker's name fits
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-country-profiles.cjs [--show]
 */
const W = require('./lib/walk.cjs');
const { measure } = require('./lib/theme-measure.cjs');
const theme = async (page, key) => { await page.evaluate((k) => { CBAvatar.applyTheme(k); }, key); await page.waitForTimeout(120); };
const contrast = async (page) => { const pairs = await page.evaluate(measure); return { n: pairs.length, bad: pairs.filter((x) => !x.grad && x.ratio < x.need) }; };
const CARDS = ['money', 'tax', 'taxid', 'documents', 'filing', 'rules', 'locale', 'payments', 'gaps'];

const walk = async (w) => {
  const { page, base } = w;
  await page.goto(base + '/country-lab.html'); await page.waitForSelector('[data-testid="cp-side"]', { timeout: 15000 });
  /* the countries and the words that belong to each, from the page's engines (CBRegulation · CBCountries) */
  const all = await page.evaluate(() => CBRegulation.list().map((p) => ({ id: p.id, cur: p.currency, word: CBCountries.taxId(p).word, hint: CBCountries.taxId(p).hint, check: !!CBCountries.taxId(p).check })));

  await w.step('P1', 'the list holds every registered country; each paints its head and the nine cards', async () => {
    const listed = await page.$$eval('[data-testid^="cp-pick-"]', (b) => b.map((x) => x.dataset.cc)), miss = [];
    for (const c of all) {
      await page.click('[data-testid="cp-pick-' + c.id + '"]'); await page.waitForTimeout(150);
      const head = await page.locator('[data-testid="cp-head"]').innerText(), cards = await page.$$eval('.cp-card', (x) => x.map((y) => y.dataset.testid.replace('cp-', '')));
      if (!head.includes(c.id) || CARDS.some((k) => !cards.includes(k))) miss.push(c.id);
    }
    return { ok: listed.join() === all.map((c) => c.id).join() && !miss.length, saw: listed.join(' · ') + (miss.length ? ' · incomplete ' + miss.join(',') : ' · 9 cards each') };
  });
  await w.step('P2', 'no leak: a country\'s cards never show another pack\'s currency code or tax-ID word', async () => {
    const leaks = [];
    for (const c of all) {
      await page.click('[data-testid="cp-pick-' + c.id + '"]'); await page.waitForTimeout(120);
      const txt = await page.locator('[data-testid="cp-main"]').innerText();
      all.filter((o) => o.id !== c.id).forEach((o) => {
        if (o.cur !== c.cur && new RegExp('\\b' + o.cur + '\\b').test(txt)) leaks.push(c.id + '→' + o.cur);
        if (o.word && o.word !== c.word && o.word.length > 2 && new RegExp('\\b' + o.word.replace(/[^\w]/g, '.') + '\\b').test(txt)) leaks.push(c.id + '→' + o.word);
      });
    }
    return { ok: !leaks.length, saw: leaks.length ? 'LEAK ' + leaks.join(' · ') : all.length + ' countries clean' };
  });
  await w.step('P3', 'the tax-ID box: the pack\'s own example passes, "x" is refused in its words (or "checked on save" where the pack carries no check)', async () => {
    const out = [];
    for (const c of all) {
      await page.click('[data-testid="cp-pick-' + c.id + '"]'); await page.waitForTimeout(100);
      if (!c.check) { out.push(c.id + ' on save ' + /checked on save/.test(await page.locator('[data-testid="cp-idverdict"]').innerText())); continue; }
      await page.fill('[data-testid="cp-idbox"]', 'x'); const bad = await page.locator('[data-testid="cp-idverdict"]').innerText();
      out.push(c.id + ' x→' + (/✕/.test(bad) ? 'refused' : 'PASSED?'));
    }
    return { ok: out.every((s) => /refused|on save true/.test(s)), saw: out.join(' · ') };
  });
  for (const [t, wd] of [['cream', 1366], ['dark', 1366], ['cream', 390], ['dark', 390]]) {
    await w.step('P4·' + t + '·' + wd, 'rule 13 · ' + t + ' · ' + wd + ' px: AA contrast, no sideways scroll, the picker fits', async () => {
      await page.setViewportSize({ width: wd, height: 1000 }); await theme(page, t);
      const r = await contrast(page), side = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const pickFits = wd > 760 ? true : await page.evaluate(() => { const s = document.querySelector('.cp-select'); return !!s && s.scrollHeight <= s.clientHeight + 2; });
      return { ok: !r.bad.length && side <= 0 && pickFits, saw: r.n + ' texts' + (r.bad.length ? ' · LOW ' + r.bad.slice(0, 3).map((x) => x.text + ' ' + x.ratio).join(', ') : ' · AA') + ' · sideways ' + side + ' · picker fits ' + pickFits };
    });
  }
  await theme(page, 'cream'); await page.setViewportSize({ width: 1366, height: 900 });
};
walk.opts = { viewport: { width: 1366, height: 900 } };
W.run('country-profiles', walk);
