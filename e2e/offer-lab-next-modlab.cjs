/* offer-lab-next-modlab.cjs — TRY A MODIFIER, THEN APPLY IT TO THE REAL PRODUCT
 *
 * Athi: "modifiers are part of product creation / offer creation, so can we include as a facility in offer
 * lab, so people can try how the modifiers can be created and once if they are happy, we would be able to
 * save that modifier and apply it to the real product. which is apply button so it will be part of the
 * product catalogue."
 *
 * Run: node e2e/offer-lab-next-modlab.cjs
 */
'use strict';
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
let bad = 0;
const say = (l, ok, d) => { console.log('  ' + String(l).padEnd(58) + '· ' + d + '  ' + (ok ? 'OK' : (bad++, '✗ FAILED'))); };

(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
    r.writeHead(200, { 'content-type': T[path.extname(f)] || 'text/plain' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((res) => srv.listen(0, res));
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://127.0.0.1:' + srv.address().port + '/offer-lab-next.html');
  await p.waitForTimeout(200);

  console.log('\n── ⭐⭐⭐ opening the modifier lab — a product picker first ' + '─'.repeat(0));
  const opened = await p.evaluate(() => { openModLab(); return document.getElementById('modLabOverlay').classList.contains('on'); });
  say('the lab opens', opened, 'modLabOverlay is on');
  const picker = await p.evaluate(() => ({
    hasSearch: !!document.getElementById('modLabSearch'),
    rows: document.querySelectorAll('#modLabBody .ovltbl tbody tr').length,
    total: P.length,
  }));
  say('every product is listed to pick from', picker.rows === picker.total, picker.rows + ' rows for ' + picker.total + ' products');
  say('with a search box', picker.hasSearch, 'found');

  console.log('\n── ⭐⭐⭐ picking a product opens the group editor and a live preview ' + '─'.repeat(0));
  const picked = await p.evaluate(() => {
    modLabPick(P[0].id);
    return {
      backButton: /All products/.test(document.getElementById('modLabBody').innerText),
      hasAddGroup: /modLabAddGroup/.test(document.getElementById('modLabBody').innerHTML),
      name: P[0].name,
      shown: document.getElementById('modLabBody').innerText.indexOf(P[0].name) >= 0,
    };
  });
  say('a way back to the picker', picked.backButton, 'found');
  say('the real product name is shown, not a placeholder', picked.shown, picked.name);
  say('a real "add a group" control is on screen', picked.hasAddGroup, 'found');

  console.log('\n── ⭐⭐ building a group — the same CBVariant verbs app.html’s tab uses, not a second implementation ' + '─'.repeat(0));
  const built = await p.evaluate(() => {
    modLabAddGroup();
    modLabSetGroup(0, { name: 'Spice level', required: true, max: 1 });
    modLabAddOption(0);
    modLabSetOption(0, 0, { name: 'Hot', price: 0 });
    modLabAddOption(0);
    modLabSetOption(0, 1, { name: 'Mild', price: 0 });
    return { groups: P[0].modifiers, sellable: CBVariant.groupsOf({ modifiers: P[0].modifiers }).length };
  });
  say('the draft group is exactly what was built', built.groups.length === 1 && built.groups[0].name === 'Spice level', JSON.stringify(built.groups[0]));
  say('it is already sellable-shaped (name + at least one option)', built.sellable === 1, built.sellable + ' group(s)');

  console.log('\n── ⭐⭐⭐ THE PREVIEW IS THE REAL BEHAVIOUR — tap through it like a customer would ' + '─'.repeat(0));
  const preview = await p.evaluate(() => {
    const before = document.getElementById('modLabBody').innerText;
    modLabPreviewPick(0, 0);   /* Hot */
    const after = document.getElementById('modLabBody').innerText;
    return { neededBefore: /Still needs: Spice level/.test(before), readyAfter: /Ready to add/.test(after), showsHot: /✓ Hot/.test(after) };
  });
  say('a required, unanswered group is named before any tap', preview.neededBefore, 'shown');
  say('picking the option clears the warning', preview.readyAfter, '"Ready to add" shown');
  say('and the picked option renders as picked', preview.showsHot, '✓ Hot found');

  console.log('\n── ⭐⭐⭐ APPLY — on the sample books it tries locally, never calls a real API ' + '─'.repeat(0));
  const sampleApply = await p.evaluate(async () => {
    let called = false;
    window.apiFetch = async () => { called = true; };
    await modLabApply();
    return { called: called, saved: P[0].modifiers.length === 1 };
  });
  say('a sample-catalogue Apply never touches the real API', sampleApply.called === false, 'apiFetch never called');
  say('but the draft still becomes the product’s own modifiers, right there in the Lab', sampleApply.saved, 'saved locally');

  console.log('\n── ⭐⭐⭐ APPLY on a real, signed-in catalogue — the exact merge:true PATCH setCost() uses ' + '─'.repeat(0));
  const realApply = await p.evaluate(async () => {
    let call = null;
    window.apiFetch = async (method, url, body) => { call = { method, url, body }; return {}; };
    /* render() (called by modLabApply() now — see the fix this run caught) reads BIZ[S.biz].name, so a real
       'mine' entry has to exist here, the same as labUseMine()/buildBiz('mine',…) always provides for real */
    BIZ.mine = { name: 'My Shop', cats: [], prods: [], margin: 25, cap: 10, d: {} };
    S.biz = 'mine';
    window.savedLive = () => true;
    await modLabApply();
    return { call: call, expectUrl: 'https://chitbridge-api-production.up.railway.app/api/products/' + P[0].id };
  });
  say('it PATCHes the real product endpoint', realApply.call && realApply.call.method === 'PATCH' && realApply.call.url === realApply.expectUrl,
    realApply.call ? realApply.call.method + ' ' + realApply.call.url : 'not called');
  say('with merge:true — never the whole record', realApply.call && realApply.call.body.merge === true, JSON.stringify(realApply.call && realApply.call.body.merge));
  say('the PATCH body carries only modifiers', realApply.call && Object.keys(realApply.call.body.item_data).join(',') === 'modifiers',
    realApply.call ? Object.keys(realApply.call.body.item_data).join(',') : '');

  console.log('\n── going back to the picker and closing the lab both work ' + '─'.repeat(20));
  const backAndClose = await p.evaluate(() => {
    modLabBack();
    const backAtPicker = document.querySelectorAll('#modLabBody .ovltbl tbody tr').length === P.length;
    closeModLab();
    return { backAtPicker: backAtPicker, closed: !document.getElementById('modLabOverlay').classList.contains('on') };
  });
  say('"← All products" returns to the picker', backAndClose.backAtPicker, 'full list shown again');
  say('close really closes', backAndClose.closed, 'modLabOverlay.on removed');

  console.log('\n── ⭐⭐⭐ A PRODUCT THAT ALREADY HAS MODIFIERS OPENS SHOWING THEM, READY TO EDIT (Athi: "i assume we' + '─'.repeat(0));
  console.log('   already have some products with modifiers we should be able to open those... and edit as well") ' + '─'.repeat(0));
  const existing = await p.evaluate(() => {
    /* the exact shape a real, already-imported product would carry — Combo Deluxe (existing mods)'s own scenario */
    P.push({ id: 'combo1', name: 'Combo Deluxe (existing mods)', cat: 'combos', price: 110, cost: null, modifiers: [
      { name: 'Choice of tiffin', required: true, max: 1, options: [{ name: 'Idli', price: 0 }, { name: 'Dosa', price: 0 }] },
      { name: 'Extra chutney', required: false, max: 2, options: [{ name: 'Coconut', price: 5 }] },
    ] });
    modLabBack();   /* make sure the picker (not a lingering product view) is what paints next */
    modLabSearch('Combo Deluxe (existing mods)');
    const rows = [...document.querySelectorAll('#modLabBody .ovltbl tbody tr')];
    const pickerRowText = (rows.find((tr) => tr.textContent.indexOf('Combo Deluxe (existing mods)') >= 0) || {}).textContent || ('NOT FOUND among ' + rows.length + ' row(s): ' + rows.map((r) => r.textContent).join(' | '));
    modLabPick('combo1');
    const editHTML = document.getElementById('modLabBody').innerHTML;
    modLabSetOption(0, 0, { price: 8 });   /* the real onchange call, on an EXISTING option */
    return {
      countedInPicker: /2 groups/.test(pickerRowText), pickerRowText: pickerRowText,
      hasIdli: /value="Idli"/.test(editHTML), hasDosa: /value="Dosa"/.test(editHTML), hasChoiceGroup: /value="Choice of tiffin"/.test(editHTML),
      afterEdit: byId('combo1').modifiers[0].options[0],
      stillTwoGroups: byId('combo1').modifiers.length === 2,
    };
  });
  say('the picker itself already shows how many groups it has, before it is even opened', existing.countedInPicker, '"' + existing.pickerRowText + '"');
  say('Edit pre-fills the real group name', existing.hasChoiceGroup, 'found');
  say('and its real, existing options — not a blank form', existing.hasIdli && existing.hasDosa, 'both found');
  say('editing an EXISTING option really changes it, in place', existing.afterEdit.price === 8, JSON.stringify(existing.afterEdit));
  say('without disturbing the other, unrelated group', existing.stillTwoGroups, 'still 2 groups');

  console.log('\n── ⭐⭐⭐ THE SETTINGS SCREEN’S OWN "MODIFIERS" CARD IS REFRESHED, NEVER LEFT STALE ' + '─'.repeat(0));
  console.log('   (found live, on the deployed page: Apply worked, but "No product has a modifier yet" stayed on screen) ' + '─'.repeat(0));
  const cardFresh = await p.evaluate(async () => {
    let renderCalls = 0;
    const realRender = window.render;
    window.render = function () { renderCalls++; return realRender.apply(this, arguments); };
    modLabPick(P[1].id);
    modLabAddGroup();
    const beforeApply = renderCalls;
    await modLabApply();     /* the moment the count actually changes */
    const afterApply = renderCalls;
    closeModLab();            /* the moment the person actually SEES the Settings screen again */
    const afterClose = renderCalls;
    window.render = realRender;
    return { beforeApply: beforeApply, afterApply: afterApply, afterClose: afterClose };
  });
  say('Apply itself refreshes the page behind the overlay', cardFresh.afterApply > cardFresh.beforeApply,
    'render() called ' + (cardFresh.afterApply - cardFresh.beforeApply) + ' time(s) by modLabApply()');
  say('and closing the lab refreshes it again, so it is never stale by the time it is actually seen',
    cardFresh.afterClose > cardFresh.afterApply, 'render() called again by closeModLab()');

  console.log('\nconsole/page errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close(); srv.close();
  console.log(bad || errs.length ? '\n' + (bad + errs.length) + ' failed'
    : '\nthe modifier lab lets you try a modifier and only Apply ever commits it, through the same safe merge-patch shape');
  process.exit(bad || errs.length ? 1 : 0);
})();
