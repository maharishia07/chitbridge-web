#!/usr/bin/env node
/**
 * e2e/walk-employees.cjs - EMPLOYEES, WALKED: the shop's people as a small app (round P1: employees.html + app/cap-employees.js).
 * Black box: it presses what an owner presses - the list, search, a person's row, Reset code, Switch off / on, What they can do, Add a person - and reads
 * what the screen says. Which action is open is the SERVER's answer (GET /api/people, may/why), so the stand-in answers it per person: a refused action
 * must show greyed WITH its sentence, and no write may leave the page for it.
 * A FIXTURE shop ("Fixture Shop" / CBWALK0001): the site is served from this checkout, the API is a stand-in answering inside the page (state kept in memory),
 * so nothing reaches localhost:3000 or the live site and nothing is written anywhere. Not run in the round that wrote it (no Playwright) - first run is the check.
 *
 *   NODE_PATH=C:/dev/toolset/node_modules/e2e node e2e/walk-employees.cjs      headless, fast   (or: sh C:/dev/toolset/e2e.sh <checkout> e2e/walk-employees.cjs)
 *   node e2e/walk-employees.cjs --show                                           watch it: headed, a caption per step, green/red per step, a results page that stays open
 * One line per path: "ID · path · PASS/FAIL (what it saw)". Screenshots: e2e/shots/walk-employees-NN.png.
 */
'use strict';
const W = require('./lib/walk.cjs');
const J = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

W.run('employees', async (w) => {
  const { page, ctx, base } = w;

  /* ── the stand-in server: three people, three presets; the owner may do everything except reset a manager's code ── */
  const CHOICES = [
    { key: 'counter', label: 'Counter only', why: 'Bills and sells. Cannot see costs.', level: 'editor', whole_entity: false, can_see_costs: false },
    { key: 'manager', label: 'Manager', why: 'Sees the whole shop. Cannot see costs.', level: 'editor', whole_entity: true, can_see_costs: false },
    { key: 'books', label: 'Books and costs', why: 'Sees the whole shop and what it costs.', level: 'commenter', whole_entity: true, can_see_costs: true },
  ];
  const S = { calls: [], addRefused: false, listDenied: false, nextId: 4, people: [] };
  const may = (o) => Object.assign({ access: { ok: true }, reset_pin: { ok: true }, switch: { ok: true, to: 'off' }, cover: { ok: true } }, o || {});
  S.people = [
    { id: 'p1', name: 'Asha Kumar', user_id: 'asha01@walk-shop.br', role: 'Cashier', phone: '9840000001', state: 'on', jobs: 0, last_at: new Date().toISOString(), access: CHOICES[0], may: may(), cover: null, cover_options: [{ id: 'p2', name: 'Ravi Nair' }] },
    { id: 'p2', name: 'Ravi Nair', user_id: 'ravi02@walk-shop.br', role: 'Manager', phone: '9840000002', state: 'on', jobs: 2, last_at: null, access: CHOICES[1],
      may: may({ reset_pin: { ok: false, why: "Only the owner can reset a manager's code." } }), cover: null, cover_options: [{ id: 'p1', name: 'Asha Kumar' }] },
    { id: 'p3', name: 'Meena Iyer', user_id: 'meena03@walk-shop.br', role: 'Helper', phone: '', state: 'off', jobs: 0, last_at: null, access: CHOICES[0], may: may({ switch: { ok: true, to: 'on' } }), cover: null, cover_options: [] },
  ];
  const counts = () => ({ on: S.people.filter((p) => p.state !== 'off').length, off: S.people.filter((p) => p.state === 'off').length });
  const find = (id) => S.people.find((p) => p.id === id);

  await ctx.route('**/api/**', async (r) => {
    const q = r.request(), u = new URL(q.url()), m = q.method(), p = u.pathname;
    let body = null; try { body = q.postData() ? JSON.parse(q.postData()) : null; } catch (_) {}
    if (m !== 'GET') S.calls.push(m + ' ' + p + (body ? ' ' + JSON.stringify(body) : ''));
    if (p === '/api/entities/me') return J(r, 200, { entity: { display_name: 'Fixture Shop', currency_code: 'INR' } });
    if (p === '/api/facts/rail') return J(r, 200, { suppliers: 0, customers: 0, in: 0, out: 0, stuck: 0 });
    if (p === '/api/people' && m === 'GET') {
      if (S.listDenied) return J(r, 403, { message: 'This sign-in cannot open this.' });
      return J(r, 200, { people: S.people, may: { add: S.addRefused ? { ok: false, why: 'Only the owner can add people.' } : { ok: true } }, access_choices: CHOICES, counts: counts() });
    }
    if (p === '/api/actors/suggest-key' && m === 'POST') {
      const k = String(body && body.display_name || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 6) + '04';
      return J(r, 200, { suggested_key: k, login_format: k + '@walk-shop.br' });
    }
    if (p === '/api/actors' && m === 'POST') {
      const id = 'p' + (S.nextId++), key = body.actor_key;
      const c = CHOICES.find((x) => x.level === body.access_level && !!x.whole_entity === !!body.whole_entity) || CHOICES[0];
      S.people.push({ id, name: body.display_name, user_id: key + '@walk-shop.br', role: body.actor_role || '', phone: body.phone || '', state: 'on', jobs: 0, last_at: null, access: c, may: may(), cover: null, cover_options: [] });
      return J(r, 200, { actor: { identity_id: id, display_name: body.display_name, login_format: key + '@walk-shop.br' }, otp: '482913' });
    }
    let mm = /^\/api\/actors\/([^/]+)\/pin$/.exec(p);
    if (mm && m === 'DELETE') return J(r, 200, { otp: '735190' });
    mm = /^\/api\/actors\/([^/]+)\/status$/.exec(p);
    if (mm && m === 'PUT') { const x = find(mm[1]); x.state = body.action === 'deactivate' ? 'off' : 'on'; x.may.switch = { ok: true, to: x.state === 'off' ? 'on' : 'off' }; return J(r, 200, body.action === 'reactivate' ? { otp: '246810' } : { ok: true }); }
    mm = /^\/api\/actors\/([^/]+)\/delegate$/.exec(p);
    if (mm && m === 'PUT') { const x = find(mm[1]); x.cover = body.delegate_actor_id ? { id: body.delegate_actor_id, name: (find(body.delegate_actor_id) || {}).name } : null; return J(r, 200, { ok: true }); }
    mm = /^\/api\/actors\/([^/]+)$/.exec(p);
    if (mm && m === 'PATCH') { const x = find(mm[1]); x.access = CHOICES.find((c) => c.level === body.access_level && !!c.whole_entity === !!body.whole_entity && !!c.can_see_costs === !!body.can_see_costs) || x.access; return J(r, 200, { ok: true }); }
    return J(r, 404, { error: 'not found' });
  });
  await ctx.addInitScript((s) => { try { localStorage.setItem('cb_api_base', location.origin); localStorage.setItem('cb_sess', s); } catch (_) {} }, W.session('Fixture Owner', 'Fixture Shop'));

  const txt = (sel) => page.locator(sel).first().innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '');
  const open = async () => { await page.goto(base + '/employees.html'); await page.waitForSelector('[data-testid="emp-bar"], [data-testid="emp-fail"]', { timeout: 20000 }); await page.waitForTimeout(300); };
  const rows = () => page.locator('[data-testid^="emp-row-"]').count();
  const closeSheet = async () => { await page.click('#emp_x').catch(() => {}); await page.waitForTimeout(200); };
  const confirmYes = async () => { await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: 5000 }); await page.click('[data-testid="confirm-ok"]'); await page.waitForTimeout(500); };
  const wrote = (re) => S.calls.filter((c) => re.test(c)).length;

  await open();

  await w.step('E1', 'Employees -> the list has one line per person, the count says 2 on · 1 off, and the sign-in name is the short one', async () => {
    const n = await rows(), cnt = await txt('[data-testid="emp-count"]'), list = await txt('[data-testid="emp-list"]');
    return { ok: n === 3 && /2\s*on/.test(cnt) && /1\s*off/.test(cnt) && /asha01\b/.test(list) && !/@walk-shop/.test(list), saw: n + ' rows; "' + cnt + '"; ' + (/@walk-shop/.test(list) ? 'the long sign-in form is showing' : 'short sign-in names only') };
  });
  await w.step('E2', 'Employees -> type "ravi" in the search box -> only Ravi Nair is left', async () => {
    await page.fill('[data-testid="listctl-search-employees"]', 'ravi'); await page.waitForTimeout(400);
    const n = await rows(), t = await txt('[data-testid="emp-list"]');
    await page.fill('[data-testid="listctl-search-employees"]', ''); await page.waitForTimeout(300);
    return { ok: n === 1 && /Ravi Nair/.test(t), saw: n + ' row(s): ' + t.slice(0, 80) };
  });
  await w.step('E3', 'Employees -> click Asha -> her sheet shows the four actions, all open (the server said yes to each)', async () => {
    await page.click('[data-testid="emp-row-p1"]'); await page.waitForSelector('[data-testid="emp-name"]', { timeout: 6000 });
    const name = await txt('[data-testid="emp-name"]');
    const dis = await page.$$eval('#emp_access, #emp_pin, #emp_switch, #emp_cover', (bs) => bs.map((b) => b.id + (b.disabled ? ':greyed' : ':open')));
    return { ok: /Asha Kumar/.test(name) && dis.length === 4 && dis.every((d) => /:open/.test(d)), saw: name + ' - ' + dis.join(' ') };
  });
  await w.step('E4', 'Asha -> Reset code -> it asks first; Cancel sends nothing', async () => {
    await page.click('#emp_pin'); await page.waitForSelector('[data-testid="confirm-cancel"]', { timeout: 5000 });
    const asked = await txt('[data-testid="confirm"]');
    await page.click('[data-testid="confirm-cancel"]'); await page.waitForTimeout(400);
    return { ok: /Reset code\?/.test(asked) && wrote(/\/pin$/) === 0, saw: 'asked "' + asked.slice(0, 60) + '"; reset calls after Cancel: ' + wrote(/\/pin$/) };
  });
  await w.step('E5', 'Asha -> Reset code -> Reset -> the sheet says her new first code, in words', async () => {
    await page.click('#emp_pin'); await confirmYes();
    const out = await txt('[data-testid="emp-out"]');
    return { ok: /735190/.test(out) && wrote(/DELETE \/api\/actors\/p1\/pin/) === 1, saw: '"' + out + '" - one reset call' };
  });
  await w.step('E6', 'Asha -> What they can do -> Manager -> Save -> "Saved." and her line now says Manager', async () => {
    await page.click('#emp_access'); await page.click('[data-testid="emp-level-manager"]'); await page.click('[data-testid="emp-access-go"]'); await page.waitForTimeout(600);
    const out = await txt('[data-testid="emp-out"]'), list = await txt('[data-testid="emp-row-p1"]');
    return { ok: /Saved/.test(out) && /Manager/.test(list), saw: '"' + out + '"; her row: ' + list.slice(0, 80) };
  });
  await w.step('E7', 'Asha -> Who stands in -> Ravi -> Save -> the sheet says who stands in', async () => {
    await page.click('#emp_cover'); await page.selectOption('[data-testid="emp-cover-sel"]', 'p2'); await page.click('[data-testid="emp-cover-go"]'); await page.waitForTimeout(600);
    const s = await txt('#emp_sheet');
    return { ok: /Stands in: Ravi Nair/.test(s), saw: s.slice(0, 120) };
  });
  await w.step('E8', 'Asha -> Switch off -> it asks (she can no longer sign in) -> Switch off -> her line says Off, the count says 1 on · 2 off', async () => {
    await page.click('#emp_switch'); await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: 5000 });
    const asked = await txt('[data-testid="confirm"]'); await page.click('[data-testid="confirm-ok"]'); await page.waitForTimeout(700);
    const tag = await txt('[data-testid="emp-state-p1"]'), cnt = await txt('[data-testid="emp-count"]');
    return { ok: /can no longer sign in/.test(asked) && /Off/.test(tag) && /1\s*on/.test(cnt) && /2\s*off/.test(cnt), saw: 'asked "' + asked.slice(0, 70) + '"; tag ' + tag + '; "' + cnt + '"' };
  });
  await closeSheet();
  await w.step('E9', 'Meena (off) -> Switch on -> no question asked (it is reversible) -> she is On with a first code', async () => {
    await page.click('[data-testid="emp-row-p3"]'); await page.waitForSelector('#emp_switch', { timeout: 6000 });
    await page.click('#emp_switch'); await page.waitForTimeout(700);
    const asked = await page.locator('[data-testid="confirm-ok"]').count(), out = await txt('[data-testid="emp-out"]'), tag = await txt('[data-testid="emp-state-p3"]');
    return { ok: asked === 0 && /246810/.test(out) && /On/.test(tag), saw: (asked ? 'it asked first; ' : 'no question; ') + '"' + out + '"; tag ' + tag };
  });
  await closeSheet();
  await w.step('E10', 'Ravi (a manager) -> Reset code is greyed WITH its sentence, and pressing it sends nothing', async () => {
    await page.click('[data-testid="emp-row-p2"]'); await page.waitForSelector('#emp_pin', { timeout: 6000 });
    const dis = await page.$eval('#emp_pin', (b) => b.disabled), why = await txt('[data-testid="emp_pin-why"]');
    await page.click('#emp_pin', { force: true, timeout: 2000 }).catch(() => {}); await page.waitForTimeout(300);
    return { ok: dis && /Only the owner/.test(why) && wrote(/actors\/p2\/pin/) === 0, saw: (dis ? 'greyed' : 'NOT greyed') + ': "' + why + '"; reset calls for Ravi: ' + wrote(/actors\/p2\/pin/) };
  });
  await closeSheet();
  await w.step('E11', 'Employees -> Add a person -> type a name -> a sign-in name is suggested and the way they sign in is shown', async () => {
    await page.click('#emp_add'); await page.waitForSelector('[data-testid="emp-add-name"]', { timeout: 6000 });
    await page.fill('[data-testid="emp-add-name"]', 'Kavya Rao'); await page.waitForTimeout(900);
    const key = await page.inputValue('[data-testid="emp-add-key"]'), note = await txt('[data-testid="emp-add-keynote"]');
    return { ok: /^kavya/.test(key) && /They sign in as/.test(note), saw: 'suggested "' + key + '"; "' + note + '"' };
  });
  await w.step('E12', 'Add a person -> a sign-in name that is too short -> told in words, nothing sent', async () => {
    await page.fill('[data-testid="emp-add-key"]', 'kr'); await page.click('[data-testid="emp-add-go"]'); await page.waitForTimeout(300);
    const out = await txt('[data-testid="emp-out"]');
    return { ok: /4 to 12 letters or numbers/.test(out) && wrote(/POST \/api\/actors \{/) === 0, saw: '"' + out + '"; add calls: ' + wrote(/POST \/api\/actors \{/) };
  });
  await w.step('E13', 'Add a person -> a good sign-in name -> Add -> "Added" with the sign-in name and a first code, and the list has 4 people', async () => {
    await page.fill('[data-testid="emp-add-key"]', 'kavya04'); await page.click('[data-testid="emp-add-go"]'); await page.waitForSelector('[data-testid="emp-added"]', { timeout: 6000 });
    const id = await txt('[data-testid="emp-added-id"]'), code = await txt('[data-testid="emp-added-code"]');
    await page.click('[data-testid="emp-done"]'); await page.waitForTimeout(400);
    const n = await rows();
    return { ok: id === 'kavya04' && /482913/.test(code) && n === 4 && wrote(/POST \/api\/actors \{/) === 1, saw: 'sign-in "' + id + '"; "' + code + '"; ' + n + ' rows; one add call' };
  });
  await w.step('E14', 'Employees (this login may not add) -> "Add a person" is shown greyed with the server\'s sentence', async () => {
    S.addRefused = true; await open();
    const dis = await page.$eval('#emp_add', (b) => b.disabled).catch(() => null), why = await txt('[data-testid="emp_add-why"]');
    S.addRefused = false;
    return { ok: dis === true && /Only the owner can add people/.test(why), saw: (dis ? 'greyed' : 'NOT greyed') + ': "' + why + '"' };
  });
  await w.step('E15', 'Employees (the server refuses the list) -> a plain sentence and Try again, never a raw error', async () => {
    S.listDenied = true; await open();
    const t = await txt('[data-testid="emp-fail"]'); S.listDenied = false;
    await page.click('[data-testid="emp-retry"]'); await page.waitForSelector('[data-testid="emp-bar"]', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(300);
    const back = await rows();
    return { ok: /This sign-in cannot open this/.test(t) && /Try again/.test(t) && back >= 3, saw: '"' + t.slice(0, 80) + '"; after Try again: ' + back + ' rows' };
  });
  w.note('E16', 'Embedded form (?embed=1&view=add) and "who is on duty" (?view=onduty), opened from the till', 'they wait for a host page\'s session over postMessage - walked in the till pack (walk-bill), not here');
});
