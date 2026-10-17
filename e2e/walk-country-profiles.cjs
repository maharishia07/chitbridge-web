'use strict';
/**
 * e2e/walk-country-profiles.cjs — THE COUNTRY LAB'S "COUNTRIES" VIEW (R6, 2026-10-16; RUNBOOK-ADD-A-COUNTRY Q11).
 * Athi: "left side panel, country name and right side all the attributes, documents, filling, govt norms" · "there should not be any leakage of
 * other country details". For EVERY registered country (read from the page's own engines — the walk lists none itself):
 *   P1 · the list holds every pack; picking one paints its head and the nine cards
 *   P2 · nothing of another country shows: no other pack's currency code or tax-ID word in the cards
 *   P3 · the tax-ID box refuses "x" with the pack's own check — or says it is checked on save
 *   P4 · rule 13: cream and dark, 1366 and 390 px — AA contrast, no sideways scroll, the phone picker's name fits
 *   P5 · the Books card: a country whose books build its return shows the filled boxes, the due date and Pay/Refund; the statements balance; India says its return is read from the invoices
 *   P7 · every counted / named cell opens what it counts (chart · filled return · statements · a sample invoice · supply kinds)
 *   P6 · All countries: one table, a row per rule (CBCountries.rulesTable), a column per country; on a phone one country as two columns
 *   NODE_PATH=$PWD/e2e/node_modules node e2e/walk-country-profiles.cjs [--show]
 */
const W = require('./lib/walk.cjs');
const { measure } = require('./lib/theme-measure.cjs');
const theme = async (page, key) => { await page.evaluate((k) => { CBAvatar.applyTheme(k); }, key); await page.waitForTimeout(120); };
const contrast = async (page) => { const pairs = await page.evaluate(measure); return { n: pairs.length, bad: pairs.filter((x) => !x.grad && x.ratio < x.need) }; };
const CARDS = ['books', 'money', 'tax', 'taxid', 'documents', 'filing', 'rules', 'locale', 'payments', 'gaps'];

const walk = async (w) => {
  const { page, base } = w;
  await page.goto(base + '/country-lab.html'); await page.waitForSelector('[data-testid="cp-side"]', { timeout: 15000 });
  /* the countries and the words that belong to each, from the page's engines (CBRegulation · CBCountries) */
  const all = await page.evaluate(() => CBRegulation.list().map((p) => ({ id: p.id, cur: p.currency, word: CBCountries.taxId(p).word, hint: CBCountries.taxId(p).hint, check: !!CBCountries.taxId(p).check })));

  await w.step('P1', 'the list holds every registered country; each paints its head and the ten cards', async () => {
    const listed = await page.$$eval('[data-testid^="cp-pick-"]', (b) => b.map((x) => x.dataset.cc)), miss = [];
    for (const c of all) {
      await page.click('[data-testid="cp-pick-' + c.id + '"]'); await page.waitForTimeout(150);
      const head = await page.locator('[data-testid="cp-head"]').innerText(), cards = await page.$$eval('.cp-card', (x) => x.map((y) => y.dataset.testid.replace('cp-', '')));
      if (!head.includes(c.id) || CARDS.some((k) => !cards.includes(k))) miss.push(c.id);
    }
    return { ok: listed.join() === all.map((c) => c.id).join() && !miss.length, saw: listed.join(' · ') + (miss.length ? ' · incomplete ' + miss.join(',') : ' · 10 cards each') };
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
  await w.step('P3', 'the tax-ID box refuses "x" with the pack\'s own check (or says "checked on save" where the pack carries no check)', async () => {
    const out = [];
    for (const c of all) {
      await page.click('[data-testid="cp-pick-' + c.id + '"]'); await page.waitForTimeout(100);
      if (!c.check) { out.push(c.id + ' on save ' + /checked on save/.test(await page.locator('[data-testid="cp-idverdict"]').innerText())); continue; }
      await page.fill('[data-testid="cp-idbox"]', 'x'); const bad = await page.locator('[data-testid="cp-idverdict"]').innerText();
      out.push(c.id + ' x→' + (/✕/.test(bad) ? 'refused' : 'PASSED?'));
    }
    return { ok: out.every((s) => /refused|on save true/.test(s)), saw: out.join(' · ') };
  });
  await w.step('P5', 'the Books card: the filled return (boxes, due, pay or refund) where the books build it; the sample statements balance; India names its rail return', async () => {
    const out = [];
    for (const c of all) {
      await page.click('[data-testid="cp-pick-' + c.id + '"]'); await page.waitForSelector('[data-testid="cp-books"]', { timeout: 8000 }); await page.waitForTimeout(150);
      const card = await page.locator('[data-testid="cp-books"]').innerText(), boxes = await page.locator('[data-testid="cp-boxes"] tbody tr').count();
      const due = /Due\s+\d{4}-\d{2}-\d{2}/.test(card), settled = /(Pay|Refund)\s/.test(card), total = /Total assets = equity \+ liabilities/.test(card);
      out.push({ id: c.id, ok: total && (c.id === 'IN' ? /read from the invoices/.test(card) : boxes > 0 && due && settled), saw: c.id + ' ' + (c.id === 'IN' ? 'rail' : boxes + ' boxes') });
    }
    return { ok: out.every((x) => x.ok), saw: out.map((x) => x.saw + (x.ok ? '' : ' ✗')).join(' · ') };
  });
  await w.step('P6', 'All countries: a row per rule, a column per country (the rules table) — the currency symbol row among them', async () => {
    await page.goto(base + '/country-lab.html?view=all#/all'); await page.waitForSelector('[data-testid="cp-all-table"]', { timeout: 15000 });
    const cols = await page.$$eval('[data-testid="cp-all-table"] thead th', (t) => t.length - 1), rows = await page.$$eval('[data-testid="cp-all-table"] tbody tr', (t) => t.map((x) => x.dataset.rule));
    const want = await page.evaluate(() => CBCountries.rulesTable({ year: 2026 }).rules.length);
    return { ok: cols === all.length && rows.length === want && rows.includes('symbol'), saw: rows.length + ' rules × ' + cols + ' countries' };
  });
  await w.step('P7', 'every counted or named cell opens what it counts: the chart, the filled return, the statements, a sample invoice billed live, the supply kinds — for every country', async () => {
    const out = [];
    for (const c of all) for (const k of ['chart', 'return', 'statements', 'invoice', 'kinds']) {
      const sel = '[data-testid="cp-open-' + k + '-' + c.id + '"]'; if (!(await page.locator(sel).count())) { out.push(c.id + ' ' + k + ' (no cell)'); continue; }
      await page.click(sel); await page.waitForSelector('.cp-chartslot .cp-chart', { timeout: 5000 }); const txt = await page.locator('.cp-chartslot').innerText();
      if (txt.length < 30 || /error:/.test(txt)) out.push(c.id + ' ' + k + ' ✗');
    }
    const bad = out.filter((x) => /✗/.test(x));
    return { ok: !bad.length, saw: (all.length * 5 - out.length) + ' panels opened' + (out.length ? ' · ' + out.join(', ') : '') };
  });
  await page.goto(base + '/country-lab.html'); await page.waitForSelector('[data-testid="cp-side"]', { timeout: 15000 });
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
