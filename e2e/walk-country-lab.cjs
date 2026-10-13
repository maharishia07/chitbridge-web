#!/usr/bin/env node
/**
 * e2e/walk-country-lab.cjs - THE COUNTRY LAB, WALKED (CL1, 2026-10-12): what changes when a shop's country changes, shown from the packs.
 * Black box: the real page, the real adopted engines (engine/tax.js carries reg-in · reg-au · reg-ae · regulation · tax-packs · tax-slab · tax,
 * one release), no API at all - the lab reads nothing from a server. Three journeys, at 1366 px and then at 390 px:
 *   L1  the pickers list exactly the registered packs (IN · AU · AE, the registry's own list) and the setup step's other countries as pack-less
 *   L2  IN -> AU: every row is read from the packs and marked - currency INR -> AUD, April -> July, state-split GST -> one-head GST, BAS with its boxes
 *   L3  IN -> AU: the ABN check box answers from the pack (a wrong digit is said); the GSTIN box from the profile-map engine
 *   L4  IN -> AU: the cart is billed by the tax engine under both - CGST+SGST on one side, one GST head on the other, the GST-free line said in the notes
 *   L5  AU -> AE: GST -> VAT, BAS -> VAT201 with its boxes, TRN 15 digits with no check digit (said); a kind the UAE pack does not know is said by the engine
 *   L6  IN -> JP (pack-less): the TO side paints the server's sentence; the cart is NOT billed under Japan; every row says "no pack"
 *   L7  for an existing shop: before the constitution is fixed, the rows that differ are the list; after, the blocked sentence names a new entity
 *   L8  at 390 px: no sideways scroll, the rows still read one under the other, the bills stack
 *
 *   NODE_PATH=e2e/node_modules node e2e/walk-country-lab.cjs         headless, fast
 *   node e2e/walk-country-lab.cjs --show                              watch it
 */
'use strict';
const W = require('./lib/walk.cjs');
const JP_WHY = 'ChitBridge does not keep books for Japan yet — selling and the rail still work; books arrive when its pack ships.';
const text = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
const verdicts = (page) => page.evaluate(() => { const o = {}; document.querySelectorAll('#rows-body tr').forEach((t) => { o[t.dataset.row] = t.querySelector('.verdict').textContent.trim(); }); return o; });
const pick = async (page, side, code) => { await page.selectOption('[data-testid="cl-' + side + '"]', code); await page.waitForTimeout(150); };

const walk = async (w) => {
  const { page, base } = w;
  await page.goto(base + '/country-lab.html');
  await page.waitForSelector('[data-testid="cl-rows"] tr[data-row]', { timeout: 15000 });

  await w.step('L1', 'The pickers list exactly the registered packs, then the setup step\'s other countries as pack-less', async () => {
    const r = await page.evaluate(() => ({
      packs: CBRegulation.list().map((p) => p.id),
      opts: [...document.querySelectorAll('#to option')].map((o) => ({ v: o.value, t: o.textContent })),
      chip: document.getElementById('src').textContent, nofuel: document.getElementById('nofuel').hidden,
    }));
    const withPack = r.opts.filter((o) => / pack /.test(o.t)).map((o) => o.v), without = r.opts.filter((o) => /no pack/.test(o.t)).map((o) => o.v);
    const ok = r.nofuel && JSON.stringify(withPack) === JSON.stringify(r.packs) && without.includes('JP') && !without.some((c) => r.packs.includes(c));
    return { ok, saw: r.chip + ' · pack-less: ' + without.join(' ') };
  });

  await w.step('L2', 'IN -> AU: every row read from the packs and marked - INR -> AUD, April -> July, state-split GST -> one head, BAS with its boxes', async () => {
    await pick(page, 'from', 'IN'); await pick(page, 'to', 'AU');
    const v = await verdicts(page);
    const cur = await text(page, '[data-testid="cl-row-currency"]'), fy = await text(page, '[data-testid="cl-row-fy"]'), sch = await text(page, '[data-testid="cl-row-scheme"]');
    const ret = await text(page, '[data-testid="cl-row-returns"]'), led = await text(page, '[data-testid="cl-row-ledgers"]');
    const ok = Object.keys(v).length === 10 && Object.values(v).every((x) => x === 'DIFFERENT')
      && /INR/.test(cur) && /AUD/.test(cur) && /April/.test(fy) && /July/.test(fy) && /split by state/.test(sch) && /border/.test(sch) && /heads: gst/.test(sch)
      && /no returns member/.test(ret) && /BAS/.test(ret) && /8 boxes/.test(ret) && /added/.test(led) && /renamed/.test(led);
    return { ok, saw: Object.keys(v).length + ' rows · ' + Object.values(v).filter((x) => x === 'DIFFERENT').length + ' different · ' + ret.slice(0, 70) };
  });

  await w.step('L3', 'IN -> AU: the ABN box answers from the pack (a wrong digit is said); the GSTIN box from the profile-map engine', async () => {
    await page.fill('[data-testid="cl-id-to"]', '51 824 753 556');
    const good = await text(page, '[data-testid="cl-idres-to"]');
    await page.fill('[data-testid="cl-id-to"]', '51 824 753 557');
    const bad = await text(page, '[data-testid="cl-idres-to"]');
    await page.fill('[data-testid="cl-id-from"]', '33AABCK1234F1Z6');
    const gst = await text(page, '[data-testid="cl-idres-from"]');
    const ok = /valid ABN/.test(good) && /check digits do not match|wrong/.test(bad) && /valid GSTIN/.test(gst);
    return { ok, saw: good + ' | ' + bad.slice(0, 50) + ' | ' + gst };
  });

  await w.step('L4', 'IN -> AU: the cart billed under both - CGST+SGST on one side, one GST head on the other, the GST-free line said in the notes', async () => {
    const r = await page.evaluate(() => ({
      fromTotal: document.querySelector('[data-testid="cl-total-from"]').textContent, toTotal: document.querySelector('[data-testid="cl-total-to"]').textContent,
      fromHeads: document.querySelector('[data-testid="cl-heads-from"]').textContent, toHeads: document.querySelector('[data-testid="cl-heads-to"]').textContent,
      toNotes: document.querySelector('[data-testid="cl-notes-to"]').textContent, diffs: document.querySelectorAll('#bill .diff').length,
      sameAsEngine: (function () { const b = BILLS.to.money; return document.querySelector('[data-testid="cl-total-to"]').textContent === CBLocale.money(b.total, 'AUD'); })(),
    }));
    const ok = /CGST/.test(r.fromHeads) && /SGST/.test(r.fromHeads) && /GST 10%/.test(r.toHeads) && !/CGST/.test(r.toHeads) && /GST-free/.test(r.toNotes) && r.diffs > 0 && r.sameAsEngine && /₹/.test(r.fromTotal) && /A\$/.test(r.toTotal);
    return { ok, saw: r.fromTotal + ' vs ' + r.toTotal + ' · ' + r.diffs + ' cells highlighted · ' + r.toNotes.slice(0, 40) + '…' };
  });

  await w.step('L5', 'AU -> AE: GST -> VAT, BAS -> VAT201 with its boxes, TRN 15 digits with no check digit; a kind the UAE pack does not know is said', async () => {
    await pick(page, 'from', 'AU'); await pick(page, 'to', 'AE');
    const sch = await text(page, '[data-testid="cl-row-scheme"]'), ret = await text(page, '[data-testid="cl-row-returns"]'), tid = await text(page, '[data-testid="cl-row-taxid"]');
    const inv = await text(page, '[data-testid="cl-row-invoice"]');
    await page.fill('[data-testid="cl-id-to"]', '100 0000 0000 0003');
    const trn = await text(page, '[data-testid="cl-idres-to"]');
    const notes = await text(page, '[data-testid="cl-notes-to"]');
    /* the rice line names gst_free (Australia's word); the UAE pack has standard · zero_rated · exempt */
    await page.selectOption('[data-testid="cl-kind-1"]', 'zero_rated'); await page.waitForTimeout(100);
    const notes2 = await text(page, '[data-testid="cl-notes-to"]');
    const ok = /GST/.test(sch) && /VAT/.test(sch) && /BAS/.test(ret) && /VAT201/.test(ret) && /boxes/.test(ret) && /ABN/.test(tid) && /TRN/.test(tid) && /no check digit/.test(tid)
      && /valid TRN/.test(trn) && /not a supply kind this pack knows/.test(notes) && /Zero-rated/.test(notes2) && /simplified invoice/.test(inv) && /English accepted/.test(inv);
    return { ok, saw: trn + ' · ' + notes.slice(0, 60) + '… · then: ' + notes2.slice(0, 40) + '…' };
  });

  await w.step('L6', 'IN -> JP (pack-less): the server\'s sentence on the TO side, the cart NOT billed under Japan, every row says "no pack"', async () => {
    await pick(page, 'from', 'IN'); await pick(page, 'to', 'JP');
    const st = await text(page, '[data-testid="cl-status-to"]'), bill = await text(page, '[data-testid="cl-bill-to"]'), v = await verdicts(page);
    const billedFrom = !!(await page.$('[data-testid="cl-total-from"]')), billedTo = !!(await page.$('[data-testid="cl-total-to"]'));
    const ok = st.includes(JP_WHY) && bill.includes('not billed') && bill.includes(JP_WHY) && billedFrom && !billedTo && Object.values(v).every((x) => x === 'no pack');
    return { ok, saw: st.slice(0, 80) + '… · IN billed ' + billedFrom + ' · JP billed ' + billedTo };
  });

  await w.step('L7', 'For an existing shop: before the constitution is fixed the differing rows are the list; after, the blocked sentence names a new entity', async () => {
    await pick(page, 'to', 'AU');
    const before = await text(page, '[data-testid="cl-rederive"]');
    await page.click('[data-testid="cl-fixed-yes"]'); await page.waitForTimeout(100);
    const after = await text(page, '[data-testid="cl-blocked"]');
    await page.click('[data-testid="cl-fixed-no"]'); await page.waitForTimeout(100);
    const ok = /re-derive/.test(before) && /Currency/.test(before) && /Financial year/.test(before) && /Chart of accounts/.test(before)
      && /Blocked/.test(after) && /set up for India/.test(after) && /new registration/.test(after) && /new entity/.test(after) && /never a silent switch/.test(after);
    return { ok, saw: before.slice(0, 70) + '… | ' + after.slice(0, 90) + '…' };
  });

  await w.step('L8', 'At 390 px: no sideways scroll, the rows read one under the other, the bills stack', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#rows-body tr')], a = document.querySelector('[data-testid="cl-bill-from"]').getBoundingClientRect(), b = document.querySelector('[data-testid="cl-bill-to"]').getBoundingClientRect();
      const stacked = rows.every((t) => { const f = t.querySelector('td.v.from').getBoundingClientRect(), g = t.querySelector('td.v.to').getBoundingClientRect(); return g.top >= f.bottom - 1; });
      return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, stacked, billsStack: b.top >= a.bottom - 1, rows: rows.length, firstRow: rows[0].innerText.replace(/\s+/g, ' ').slice(0, 60) };
    });
    const ok = r.sw <= r.iw && r.stacked && r.billsStack && r.rows === 10;
    return { ok, saw: 'scroll ' + r.sw + ' / ' + r.iw + ' · rows stacked ' + r.stacked + ' · bills stacked ' + r.billsStack + ' · "' + r.firstRow + '"' };
  });
  await page.setViewportSize({ width: 1366, height: 900 });
};
walk.opts = { viewport: { width: 1366, height: 900 } };
W.run('country-lab', walk);
