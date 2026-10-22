#!/usr/bin/env node
/**
 * e2e/walk-offer-lab.cjs - THE OFFER LAB ON THE LAB STANDARD, WALKED (W16-W20, Athi 21-22 Oct: "pick on the left, form in the middle, the cart on the right").
 * Black box: the real page, the real offers engine; the api is answered INSIDE the browser by a small stand-in of routes/definitions.js (status without rules
 * never mints a version, a PUT of rules replaces them) and of GET /api/relationships/customers/groups - nothing leaves this machine.
 *   O1  TRIAL: before any tap the left menu lists the eight types under four headings (one thing's price, two things together, bill size, allows or blocks)
 *   O2  TRIAL: picking a type goes straight to its working step (no "What kind of offer?" screen, no step bar); the menu lights it
 *   O3  TRIAL: work it out, add it: the cart on the right ("Your offers (draft)") shows it as a draft - and not one request left the page
 *   O4  TRIAL: Make live / Only for a group say "Sign in to use this in your shop." in the row - still no request
 *   O5  SIGNED IN: add two offers; both are definitions in status draft (no bill can see them)
 *   O6  SIGNED IN: "Only for a group" reads the shop's named groups, picks one: the definition is live with rules.customer_group = group:<name> and the
 *       other rules kept; the row says so
 *   O7  SIGNED IN: "Make live" makes the other live for everyone: status live, no customer_group
 *   O8  390 px: the menu is icons only, so the middle lists the eight types in words; picking one opens the form; "All types" comes back
 *   O9  rule 13 at 1280 and 390, Cream and Dark: AA of every text, no sideways scroll, nothing covering a control, no app.html link
 *   NODE_PATH=e2e/node_modules node e2e/walk-offer-lab.cjs        headless, fast      ·   node e2e/walk-offer-lab.cjs --show   watch it
 */
'use strict';
const W = require('./lib/walk.cjs');
const { measure } = require('./lib/theme-measure.cjs');
const { audit } = require('./lib/rule13.cjs');

const GROUP_HEADINGS = ["One thing's price", 'Two things together', 'Bill size', 'Allows or blocks'];
const TYPE_IDS = ['percent', 'amount', 'qty', 'free', 'bundle', 'spend', 'ship', 'band'];
const NAMED_GROUP = 'Wholesale';

/** a stand-in of routes/definitions.js: enough of list / read / create / update to prove what the cart writes */
function definitionsApi() {
  const db = new Map();
  let seq = 0;
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const handler = async (route) => {
    const req = route.request(), url = new URL(req.url()), parts = url.pathname.split('/').filter(Boolean);
    if (url.pathname === '/api/relationships/customers/groups') return json(route, 200, { names: [NAMED_GROUP] });
    if (parts[1] !== 'definitions') return json(route, 404, {});
    const id = parts[2], body = req.postData() ? JSON.parse(req.postData()) : {};
    if (req.method() === 'GET' && !id) {
      return json(route, 200, { count: db.size, definitions: [...db.values()].map((d) => Object.assign({}, d, { rules: d.versions[0].rules })) });
    }
    if (req.method() === 'GET') return db.has(id) ? json(route, 200, { definition: db.get(id), versions: db.get(id).versions }) : json(route, 404, {});
    if (req.method() === 'POST') {
      const created = 'd' + ++seq;
      db.set(created, { definition_id: created, kind: body.kind, sub_kind: body.sub_kind, name: body.name, status: body.status || 'draft', created_at: W.nowIso(), versions: [{ version: 1, rules: body.rules || {} }] });
      return json(route, 201, { definition: db.get(created) });
    }
    if (req.method() === 'PUT' && db.has(id)) {
      const d = db.get(id);
      if (body.status) d.status = body.status;
      if (body.rules) d.versions.unshift({ version: d.versions.length + 1, rules: body.rules });
      return json(route, 200, { message: 'Saved', definition: d });
    }
    return json(route, 404, {});
  };
  return { db, handler };
}

/** the failures of rule 13 on the screen as it stands: AA of every text, clipping, inner scroll, covered controls, app.html links */
async function screenProblems(page) {
  const pairs = await page.evaluate(measure);
  const bad = pairs.filter((x) => !x.grad && x.ratio < x.need);
  const seen = await audit(page, 'labBody');
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1);
  const fails = [].concat(bad.map((x) => 'contrast ' + x.ratio + ' "' + x.text + '"'), seen.clip.map((x) => 'clipped ' + x), seen.scroll.map((x) => 'scroll ' + x),
    seen.cover.map((x) => 'covered ' + x), seen.app.map((x) => 'app.html ' + x), sideways ? ['the page scrolls sideways'] : []);
  return { fails, texts: pairs.length, lowest: Math.min.apply(null, pairs.map((x) => x.ratio)) };
}

/** type "A percentage off" with a small number into the form and add it to the cart (the page's own buttons) */
async function addOne(page, typeId, pct) {
  await page.evaluate(() => closeWork());
  await page.click('[data-testid="skel-nav-' + typeId + '"]');
  await page.waitForSelector('#s2.on');
  if (pct) await page.evaluate((v) => { S.scope = 'item'; S.itemId = 'masala'; S.pctOff = v; render(); }, pct);
  await page.click('button[onclick="apply()"]');
  await page.waitForSelector('#workScrim.on');
  await page.click('#workSave');
  await page.waitForFunction(() => !document.getElementById('workScrim').classList.contains('on'));
}

const walk = async (w) => {
  const { page, base } = w;
  const api = definitionsApi();
  const apiCalls = [];
  w.ctx.on('request', (q) => { if (/\/api\//.test(q.url())) apiCalls.push(q.method() + ' ' + new URL(q.url()).pathname); });
  await w.ctx.route(/\/api\//, api.handler);
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(base + '/offer-lab-next.html?api=' + encodeURIComponent(base));
  await page.waitForSelector('[data-testid="skel-nav-percent"]');

  await w.step('O1', 'Trial: before any tap the left menu lists the eight types in four groups', async () => {
    const menu = await page.evaluate(() => ({
      ids: [...document.querySelectorAll('.side .nav-btn[data-sec]')].map((b) => b.getAttribute('data-sec')),
      heads: [...document.querySelectorAll('.side .nav-group')].map((n) => n.textContent.trim()),
      others: document.querySelectorAll('.side .lab-link, [data-testid="skel-labs"]').length,
      steps: document.querySelectorAll('#steps, .stp').length
    }));
    return { ok: menu.ids.join() === TYPE_IDS.join() && menu.heads.join('|') === GROUP_HEADINGS.join('|') && menu.others === 0 && menu.steps === 0,
      saw: menu.ids.length + ' types · headings ' + menu.heads.join(' / ') + ' · other labs in the menu ' + menu.others + ' · step bar ' + menu.steps };
  });

  await w.step('O2', 'Trial: pick "A percentage off" on the left -> its working step, the menu lights it', async () => {
    await page.click('[data-testid="skel-nav-percent"]');
    await page.waitForSelector('#s2.on');
    const got = await page.evaluate(() => ({
      title: (document.querySelector('#s2 h2') || {}).textContent,
      lit: [...document.querySelectorAll('.side .nav-btn.active')].map((b) => b.getAttribute('data-sec')),
      pickerScreen: !!document.querySelector('[data-testid="types-list"]'),
      settingsHidden: getComputedStyle(document.getElementById('s0')).display === 'none'
    }));
    return { ok: got.title === 'A percentage off' && got.lit.join() === 'percent' && !got.pickerScreen && got.settingsHidden, saw: '"' + got.title + '" · lit ' + got.lit.join() };
  });

  await w.step('O3', 'Trial: work it out, add it -> the cart on the right shows it as a draft; no request left the page', async () => {
    await addOne(page, 'percent', 10);
    const cart = await page.evaluate(() => ({
      title: (document.querySelector('[data-testid="cart-title"]') || {}).textContent,
      rows: document.querySelectorAll('[data-testid="cart-row"]').length,
      pill: ((document.querySelector('[data-testid="cart-row"] .pill') || {}).textContent || '').trim(),
      side: document.getElementById('labCart').getBoundingClientRect().left > document.getElementById('s2').getBoundingClientRect().left
    }));
    return { ok: cart.title === 'Your offers (draft)' && cart.rows === 1 && cart.pill === 'draft' && cart.side && apiCalls.length === 0,
      saw: '"' + cart.title + '" · ' + cart.rows + ' row (' + cart.pill + ') · cart is right of the form ' + cart.side + ' · api calls ' + apiCalls.length };
  });

  await w.step('O4', 'Trial: "Make live" and "Only for a group" say to sign in, in the row; still no request', async () => {
    await page.click('[data-testid="cart-live"]');
    const first = (await page.textContent('[data-testid="cart-note"]')).trim();
    await page.click('[data-testid="cart-group"]');
    const second = (await page.textContent('[data-testid="cart-note"]')).trim();
    return { ok: first === 'Sign in to use this in your shop.' && second === first && apiCalls.length === 0, saw: '"' + first + '" · api calls ' + apiCalls.length };
  });

  /* ── signed in: a second page of the same browser holds the session ─────────────────────────────────────────────── */
  const signed = await w.ctx.newPage();
  await signed.addInitScript((sess) => { localStorage.setItem('cb_sess', sess); }, W.session('Fixture Owner', 'Fixture Shop'));
  await signed.setViewportSize({ width: 1280, height: 860 });
  await signed.goto(base + '/offer-lab-next.html?api=' + encodeURIComponent(base));
  await signed.waitForSelector('[data-testid="skel-nav-percent"]');
  await signed.waitForFunction(() => typeof savedLive === 'function' && savedLive());

  await w.step('O5', 'Signed in: add two offers -> both are definitions in status draft', async () => {
    await addOne(signed, 'percent', 10);
    await addOne(signed, 'percent', 15);
    await signed.waitForFunction(() => document.querySelectorAll('[data-testid="cart-row"]').length === 2);
    const statuses = [...api.db.values()].map((d) => d.status);
    return { ok: statuses.length === 2 && statuses.every((s) => s === 'draft'), saw: statuses.length + ' definitions: ' + statuses.join(', ') };
  });

  let groupId = null;
  await w.step('O6', 'Signed in: "Only for a group" -> the shop\'s named group -> live, only for them', async () => {
    const row = signed.locator('[data-testid="cart-row"]').first();
    const id = await row.getAttribute('data-id');
    groupId = id;
    await row.locator('[data-testid="cart-group"]').click();
    await signed.waitForSelector('[data-testid="cart-group-pick"] optgroup option', { state: 'attached' });
    await signed.selectOption('[data-testid="cart-group-pick"]', 'group:' + NAMED_GROUP);
    await signed.click('[data-testid="cart-group-apply"]');
    await signed.waitForFunction((want) => [...document.querySelectorAll('[data-testid="cart-note"]')].some((n) => n.textContent === want), 'Live, only for ' + NAMED_GROUP + '.');
    const def = api.db.get(id), rules = def.versions[0].rules;
    return { ok: def.status === 'live' && rules.customer_group === 'group:' + NAMED_GROUP && rules.customer_name === NAMED_GROUP && rules.percent === 10 && def.versions.length === 2,
      saw: def.status + ' · customer_group ' + rules.customer_group + ' · percent kept ' + rules.percent + ' · versions ' + def.versions.length };
  });

  await w.step('O7', 'Signed in: "Make live" on the other -> live for everyone (no customer_group)', async () => {
    const row = signed.locator('[data-testid="cart-row"]:has(.p-draft)').first();
    const id = await row.getAttribute('data-id');
    await row.locator('[data-testid="cart-live"]').click();
    await signed.waitForFunction((want) => [...document.querySelectorAll('[data-testid="cart-note"]')].some((n) => n.textContent === want), 'Live for everyone.');
    const def = api.db.get(id);
    return { ok: def.status === 'live' && def.versions[0].rules.customer_group === undefined, saw: def.status + ' · customer_group ' + def.versions[0].rules.customer_group };
  });

  await w.step('O7b', 'Signed in: after a reload the group offer still says "only for <group>" (not "for everyone")', async () => {
    await signed.reload();
    await signed.waitForSelector('[data-testid="cart-row"][data-id="' + groupId + '"] [data-testid="cart-note"]');
    const said = (await signed.textContent('[data-testid="cart-row"][data-id="' + groupId + '"] [data-testid="cart-note"]')).trim();
    return { ok: said === 'Live, only for ' + NAMED_GROUP + '.', saw: '"' + said + '"' };
  });

  await w.step('O7c', 'Signed in: Edit the group offer and add it again -> the group is kept in its rules', async () => {
    await signed.evaluate((id) => { openSaved(id); apply(); }, groupId);
    await signed.waitForSelector('#workScrim.on');
    await signed.click('#workSave');
    await signed.waitForFunction(() => !document.getElementById('workScrim').classList.contains('on'));
    const rules = api.db.get(groupId).versions[0].rules;
    return { ok: rules.customer_group === 'group:' + NAMED_GROUP && rules.customer_name === NAMED_GROUP, saw: 'customer_group ' + rules.customer_group + ' · name ' + rules.customer_name };
  });

  await w.step('O7d', 'Signed in: "Make live" on the group offer clears the group and says so (make live = everyone)', async () => {
    const row = signed.locator('[data-testid="cart-row"][data-id="' + groupId + '"]');
    await row.locator('[data-testid="cart-live"]').click();
    const want = 'Was only for ' + NAMED_GROUP + ', now for everyone.';
    await signed.waitForFunction((t) => [...document.querySelectorAll('[data-testid="cart-note"]')].some((n) => n.textContent === t), want);
    const def = api.db.get(groupId), rules = def.versions[0].rules;
    return { ok: def.status === 'live' && rules.customer_group === undefined && rules.customer_name === undefined, saw: def.status + ' · customer_group ' + rules.customer_group };
  });

  /* ── the phone ─────────────────────────────────────────────────────────────────────────────────────────────────── */
  await w.step('O8', '390 px: the menu is icons only, so the middle lists the eight types in words; pick one -> form; "All types" -> back', async () => {
    const phone = await w.ctx.newPage();
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.goto(base + '/offer-lab-next.html?api=' + encodeURIComponent(base));
    await phone.waitForSelector('[data-testid="types-list"]');
    const first = await phone.evaluate(() => ({
      words: [...document.querySelectorAll('[data-testid="types-list"] .goal b')].map((b) => b.textContent.trim()),
      labelsHidden: [...document.querySelectorAll('.side .nav-btn[data-sec] .label')].every((l) => getComputedStyle(l).display === 'none'),
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1
    }));
    await phone.click('[data-testid="type-qty"]');
    await phone.waitForSelector('#s2.on [data-testid="all-types"]');
    const form = await phone.evaluate(() => (document.querySelector('#s2 h2') || {}).textContent);
    await phone.click('[data-testid="all-types"]');
    await phone.waitForSelector('[data-testid="types-list"]');
    await phone.close();
    return { ok: first.words.length === 8 && first.labelsHidden && !first.sideways && form === 'Cheaper when they buy more', saw: first.words.length + ' types in words · menu labels hidden ' + first.labelsHidden + ' · form "' + form + '"' };
  });

  /* ── rule 13: the working step with the cart, signed in, Cream and Dark at 1280 and 390 ──────────────────────────────── */
  for (const theme of ['cream', 'dark']) {
    for (const width of [1280, 390]) {
      await signed.setViewportSize({ width, height: width > 500 ? 860 : 844 });
      await signed.evaluate(() => pickGoal('percent'));
      await signed.evaluate((t) => { CBAvatar.applyTheme(t); }, theme);
      await signed.waitForTimeout(200);
      await w.step('O9·' + theme + '·' + width, 'Offer Lab · ' + theme + ' · ' + width + ' px -> AA contrast, no sideways scroll, nothing over a control, no app.html link', async () => {
        const got = await screenProblems(signed);
        return { ok: !got.fails.length && got.texts > 10, saw: got.texts + ' texts, lowest ' + got.lowest + (got.fails.length ? ' · ' + got.fails.slice(0, 4).join(' · ') : ' · clean') };
      });
      await signed.screenshot({ path: require('path').join(__dirname, 'shots', 'offer-lab-' + theme + '-' + width + '.png') });
    }
  }
  await w.step('O10', 'No page error on either page', async () => ({ ok: w.errs.length === 0, saw: w.errs.length ? w.errs[0].slice(0, 120) : 'none' }));
};

W.run('offer-lab', walk);
