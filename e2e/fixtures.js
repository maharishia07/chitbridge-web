// Shared helpers for the e2e specs. Kept tiny so each MODULE spec stays self-describing.
const { expect } = require('@playwright/test');   // composeChit asserts the wizard actually advanced
const DEV_OTP = process.env.CB_DEV_OTP || '123456';   // relies on DEV_OTP set on the API during dev (Athi's standing choice)

// a fresh identity per run so specs never collide on an existing entity/email.
function uniqueEmail(prefix) {
  return (prefix || 'e2e') + '.' + Date.now() + '.' + Math.floor(Math.random() * 1e4) + '@test.example';
}
/**
 * ⭐⭐ A USER ID, NOT A DISPLAY NAME — the registration screen changed under this fixture and it took the whole
 * suite down without saying so.
 *
 * ⚠⚠ `reg-name` USED TO BE THE BUSINESS NAME AND IS NOW THE USER ID. Athi, 2026-08-19: *"the user id
 * registered cannot be changed — through IAM they can change the display name."* So the field now runs through
 * lib/handle.checkRoot: 8+ characters, lowercase letters, numbers and dashes, and no `@` or `.` because those
 * separators mean an EMPLOYEE and a NETWORK STORE. `uniqueName()` returns 'E2E Co 341383' — spaces and
 * capitals — so registration was refused, the form never advanced, and every spec in the suite failed at
 * auth.setup with "still on #/register".
 *
 * ⚠️ THE SUITE REPORTED IT AS A TIMEOUT, which is why it went undiagnosed for days: `toHaveURL(/#/app/)`
 * polled 23 times and gave up. A screen that refuses your input looks exactly like a screen that is slow.
 *
 * ⚠️ AND IT MUST BE UNIQUE PLATFORM-WIDE, not merely per run — user_id carries a UNIQUE index across ALL
 * identities and is SET ONCE, so a fixed handle works exactly once and 409s forever after.
 */
function uniqueHandle(prefix) {
  return ((prefix || 'e2eco') + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1e3))
    .toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function uniqueName(prefix) {
  return (prefix || 'E2E Co') + ' ' + Date.now().toString().slice(-6);
}

/**
 * ⭐ WHICH API THE BROWSER TALKS TO — and why the suite needs to be able to say.
 *
 * Served from localhost, app.html resolves API_BASE to `http://localhost:3000`, and vite proxies /api there too.
 * That is the right default for development, but it silently couples the whole suite to one local process: the
 * moment it is down, EVERY spec fails at registration with "You're offline", which reads like a broken app rather
 * than a missing server. app.html already honours `localStorage.cb_api_base` for exactly this; the suite just
 * never used it.
 *
 *   CB_API_BASE=https://chitbridge-api-production.up.railway.app npx playwright test …
 *
 * ⚠️ Unset, nothing changes — the local API stays the default, so this cannot quietly start pointing a developer's
 * run at production.
 */
async function useApiBase(page) {
  const base = process.env.CB_API_BASE;
  if (!base) return;
  await page.addInitScript((b) => { try { localStorage.setItem('cb_api_base', b); } catch (e) {} }, base);
}

// Reusable: walk the onboarding→register→verify (mint) flow and land in the app. Returns { email, name }.
// This is the shared "arrange" step other modules (chits, catalogue) build on — and the heart of the DoD.
async function mintEntity(page, { role = 'business', email, name } = {}) {
  // A FIXED email makes this create-or-reuse: register() re-issues the OTP for an existing entity instead of erroring,
  // so the same email always lands in the SAME entity. Omit for a throwaway unique one.
  email = email || uniqueEmail();
  name = name || uniqueName();
  await useApiBase(page);
  await page.goto('/app.html');
  // SAVED SESSION: in the `authed` project a restored token boots straight into the app shell (a nav item is present) →
  // skip onboarding entirely. In `noauth` and fresh multi-party contexts there's no session → full mint below.
  const loggedIn = await page.getByTestId('nav-compose')
    .waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
  if (loggedIn) return { existing: true, email: null, name: null };
  // LOGGED OUT: /app.html now defaults to the Sign-in screen → reach onboarding via "New here? Create an entity"
  // (the welcome screen at #/welcome still carries onb-getstarted). Fall back to the hash route if the link moved.
  if (!(await page.getByTestId('onb-getstarted').isVisible().catch(() => false))) {
    const create = page.getByText('Create an entity');
    if (await create.count()) await create.first().click();
    else await page.goto('/app.html#/welcome');
  }
  await page.getByTestId('onb-getstarted').waitFor({ state: 'visible', timeout: 8000 });
  await page.getByTestId('onb-getstarted').click();
  await page.getByTestId(`onb-role-${role}`).click();
  await page.locator('[data-testid^="onb-bp-"]').first().click();   // pick the first vertical/blueprint
  await page.getByTestId('onb-continue').click();
  /* ⚠️ reg-name IS THE USER ID FIELD — see uniqueHandle. Filling it with a display name is what broke the
     whole suite: spaces and capitals fail checkRoot, the form refuses, and every spec times out on #/register. */
  const handle = uniqueHandle();
  await page.getByTestId('reg-name').fill(handle);
  await page.getByTestId('reg-email').fill(email);
  await page.getByTestId('reg-submit').click();                     // → create → verify (OTP) step
  // Verify step: pick a vertical IF offered, enter the dev OTP, submit. Tolerant — the vertical is often already
  // carried from the onb-bp pick, and dev mode can advance quickly, so skip whatever isn't present and then just
  // confirm we've actually landed in the app. (Watching it live showed a stale reg-vertical click hanging here.)
  const otp = page.getByTestId('reg-otp');
  if (await otp.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
    const vert = page.locator('[data-testid^="reg-vertical-"]');
    if (await vert.count()) await vert.first().click().catch(() => {});
    await otp.fill(DEV_OTP).catch(() => {});
    await page.getByTestId('reg-submit').click().catch(() => {});
  }
  await page.waitForURL(/#\/app/, { timeout: 15000 }).catch(() => {});   // land in the app
  return { email, name };
}

// Wait out the busy overlay (#busyhost .busyov) that covers the screen during a post-mutation full-list refresh —
// otherwise the next click is intercepted for the whole action timeout. 'hidden' also covers the detached case.
async function settle(page) {
  await page.locator('#busyhost .busyov').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
}

// Close any open modal (#modalhost) so it doesn't intercept the next sidebar/toolbar click. Modals (compose, dispute
// room, message center) are intentional, so we dismiss explicitly rather than auto-closing in settle().
async function dismissModal(page) {
  await page.evaluate(() => {
    try { if (window.closeModal) window.closeModal(); } catch (e) {}        // #modalhost (compose, dispute room)
    try { if (window.closeMsgCenter) window.closeMsgCenter(); } catch (e) {} // #lbhost (message center, notifications)
  }).catch(() => {});
  for (const host of ['#modalhost', '#lbhost']) {
    await page.locator(host).evaluate((el) => { if (el) el.innerHTML = ''; }).catch(() => {});
  }
}

// Drawer-aware nav click. On a MOBILE viewport (innerWidth<=820 → UI.vp='mob') the sidebar is a slide-out drawer:
// the nav items sit off-screen (translateX(-100%)) behind the ☰ (nav-drawer) button, so a direct nav click can't
// land. On desktop the ☰ is display:none. So: if ☰ is showing and the menu isn't open, tap it first, then click.
// Viewport-agnostic — a no-op on the counter/laptop projects, the drawer-opener on mobile.
/**
 * ⭐⭐ PROFILE AND SETTINGS ARE BEHIND THE AVATAR, NOT IN THE RAIL. They were *"the two least-visited screens
 * in the rail and were holding prime space in it"*, so they moved into the avatar menu — which means
 * `getByTestId('nav-settings')` finds nothing until the menu is open, and a spec written against the old route
 * fails as a 15-second TIMEOUT rather than as "that is not there any more".
 *
 * ⚠️ FOUR SPECS ALREADY CLICK `icon-avatar` INLINE (i18n, smoke, theme-picker ×2). This is the fifth caller,
 * which by the standing rule is where the helper gets written rather than copied again. The four are left
 * alone deliberately: they pass today, and rewriting green tests to tidy them is churn with a real chance of
 * breaking something for no behavioural gain. They are candidates, not debt.
 */
async function openAvatarItem(page, testid) {
  const item = page.getByTestId(testid);
  /* the menu may already be open from a previous step — opening it twice closes it */
  if (!(await item.isVisible().catch(() => false))) await page.getByTestId('icon-avatar').click();
  await item.click();
}

async function clickNav(page, key) {
  const ham = page.getByTestId('nav-drawer');
  if (await ham.isVisible().catch(() => false)) {                       // mobile mode — nav is behind the drawer
    if (!(await page.locator('.menu.open').count())) {
      await ham.click();
      await page.locator('.menu.open').waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
    }
  }
  await page.getByTestId('nav-' + key).click();
}

// Click a control inside the compose modal robustly. The modal is a fixed, scrollable overlay (.mover, overflow-y:auto)
// whose backdrop closes it on click. A normal Playwright click uses COORDINATES + auto-scroll + a stability wait, and on
// slower engines that misbehaves two ways (both reproduced via a step-through): on webkit the stability loop never
// settles though the button is present+topmost; on mobile the auto-scroll strays onto the backdrop and dismisses the
// modal. Dispatching the element's own handler directly (native .click()) sidesteps all of it — no scroll, no stability
// check, no backdrop mis-hit — and fires the exact onclick the button carries. The element is real; we just trigger it.
async function stableClick(page, testid) {
  const el = page.getByTestId(testid);
  await el.waitFor({ state: 'visible', timeout: 25000 });   // still assert it rendered (modal loads its catalogue async first)
  await el.evaluate((node) => node.click());
}

// Like stableClick, but VERIFY the handler's effect landed and re-dispatch if not. On slow engines (webkit/firefox) the
// modal renders late and a dispatched click can fire before the button's handler is wired, so the recipient/line-item
// silently doesn't register — which then fails compose validation with no send. Dispatch → check the effect → retry.
async function clickInModal(page, testid, verifyFn) {
  const el = page.getByTestId(testid);
  await el.waitFor({ state: 'visible', timeout: 25000 });
  for (let i = 0; i < 5; i++) {
    await el.evaluate((node) => node.click()).catch(() => {});
    if (!verifyFn) return;
    const ok = await page.waitForFunction(verifyFn, null, { timeout: 3000 }).then(() => true).catch(() => false);
    if (ok) return;
    await page.waitForTimeout(300);
  }
}
const HAS_RCPT = () => { const h = document.getElementById('cc_rcpts'); return !!h && h.children.length > 0; };            // a recipient chip rendered
const HAS_TOTAL = () => { const t = document.getElementById('cc_total'); return !!t && /\d/.test(t.textContent || ''); };  // a line-item total rendered

// Reusable: compose + send a self-chit with a subject + one line item. The arrange step for chits/disputes/messages.
/**
 * composeStepNext — advance the compose wizard one step, and refuse to move on quietly if it will not go.
 *
 * ⚠️ THE PRIMARY IS GUARDED. If the current step is unanswered the button is disabled and the flow simply does not
 * advance — so a spec that clicked and carried on would fail three lines later, on the next step's field, reading
 * like a rendering fault. Asserting the step actually CHANGED puts the failure where the cause is.
 */
async function composeStepNext(page, expectStep) {
  const btn = page.locator('[data-testid^="step-next-"]');
  // ⚠️ DO NOT read step-why-* to build this message. When the step is satisfied that element does not exist, so
  // `.textContent()` auto-waits the full action timeout before the catch — fifteen seconds of doing nothing inside
  // an open modal, on every step. It cost real time and it masked a real bug (a background renderApp wiping the
  // modal) as a locator failure. The guard's reason is on the button's title and in step-why when it applies.
  await expect(btn, 'compose could not leave this step — its guard is unsatisfied').toBeEnabled();
  await btn.click();
  await expect(page.locator(`[data-testid="step-${expectStep}"].now`),
    `compose did not advance to the ${expectStep} step`).toBeVisible();
}

/**
 * composeChit — author and send a chit through the FOUR-STEP compose wizard.
 *
 * Athi, 2026-08-08: *"once all the selection is over, then we show the rest in order one by one."*
 *
 * Compose became Items → To → Details → Review on 2026-08-09, so every driver has to walk it. This is the one
 * place that knows the walk: six specs used to inline "fill everything, press send" against a single screen, and
 * six copies of a wizard walk would drift the moment a step moved.
 *
 * `recipients` are added by name from the suggest list; `self: true` adds the Self recipient instead.
 */
async function composeChit(page, { subject, item = 'Widget', qty, price, items, recipients = [], self = false, send = true } = {}) {
  await clickNav(page, 'compose');

  // ── 1 · ITEMS. The line comes first now: the chit is about what is on it.
  /* `items: [{item, qty, price}, …]` authors a MULTI-LINE chit — the shape design 2 exists for, where each
     line is a separate piece of work with its own assignee, delivery and cost. `item/qty/price` stays as the
     one-line shorthand every older spec uses, so both go through the same wizard walk. */
  const lines = items && items.length ? items : [{ item, qty, price }];
  for (const ln of lines) {
    await page.getByTestId('chit-item-name').fill(ln.item);
    if (ln.qty !== undefined) await page.getByTestId('chit-item-qty').fill(String(ln.qty));
    if (ln.price !== undefined) await page.getByTestId('chit-item-price').fill(String(ln.price));
    await clickInModal(page, 'chit-item-add', HAS_TOTAL);     // add the line item (verify it registered)
  }
  await composeStepNext(page, 'to');

  // ── 2 · TO. Compose keeps this step precisely because the recipient is genuinely unknown here.
  if (self) await clickInModal(page, 'chit-add-self', HAS_RCPT);
  for (const name of recipients) await addRecipientByName(page, name);
  await composeStepNext(page, 'details');

  // ── 3 · DETAILS.
  const subj = page.locator('[data-testid="chit-field-subject"]');
  if (await subj.count()) await subj.fill(subject);
  else await page.locator('[data-testid^="chit-field-"]').first().fill(subject);
  await composeStepNext(page, 'review');

  // ── 4 · REVIEW → send.
  if (!send) return;
  const sent = page.waitForResponse((r) => /\/chits\/send/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
  await stableClick(page, 'chit-send');
  await sent;            // wait for the server to confirm the send before the next step (slow engine / cold API)
  await settle(page);   // let the post-send refresh finish so the next nav click isn't intercepted
}

async function composeSelfChit(page, subject) {
  await composeChit(page, { subject, self: true });
}

// ── MULTIPARTY — the real capability. Each browser CONTEXT is an isolated logged-in party. Mint N entities in N contexts,
// drive them together, assert what EACH party sees. Run headed (`npm run test:headed`) to watch 2-3 windows side by side.
async function mintInContext(browser, opts) {
  // storageState:undefined forces a CLEAN context — otherwise the authed project's saved session leaks in and
  // mintEntity short-circuits (returns null name/email), collapsing all "parties" into one entity.
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  const who = await mintEntity(page, opts);
  if (!who || !who.name) throw new Error('mintInContext: expected a fresh mint but got ' + JSON.stringify(who) + ' (session leaked into the context?)');
  return { context, page, email: who.email, name: who.name };
}

// In Compose: address a recipient by typing their name and picking the live suggestion (entity search).
async function addRecipientByName(page, name) {
  await page.getByTestId('chit-recipient').fill(name);
  await page.getByTestId('chit-recipient-suggest').filter({ hasText: name }).first().click();
}

// ── STABLE ENTITY POOL — a fixed set of reusable entities so runs don't mint fresh every time, and so flows can run in
// PARALLEL (each takes a distinct pool entity → no session collision → real concurrency). Provisioned ONCE by
// pool.setup.js (create-or-reuse via the fixed email), sessions saved to .auth/pool-NN.json and reused every run.
// Bump CB_POOL_SIZE for more concurrency (e.g. the swarm/parallel simulation).
const POOL_SIZE = Number(process.env.CB_POOL_SIZE || 10);
const POOL = Array.from({ length: POOL_SIZE }, (_, i) => {
  const nn = String(i + 1).padStart(2, '0');
  return { key: `pool${nn}`, email: `e2e.pool${nn}@test.example`, name: `E2E Pool ${nn}`, session: `.auth/pool-${nn}.json` };
});

// Open a browser context ALREADY signed in as pool entity #i (loads its saved session — zero minting). The building
// block for parallel/swarm simulation: give each concurrent actor its own poolContext.
async function poolContext(browser, i) {
  const p = POOL[i % POOL.length];
  const context = await browser.newContext({ storageState: p.session });
  const page = await context.newPage();
  await page.goto('/app.html');
  await page.getByTestId('nav-compose').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  return { context, page, email: p.email, name: p.name, key: p.key };
}

const { seedDemo } = require('./seed');
/**
 * addProduct — put one thing on our own shelf, through the Catalogue screen.
 *
 * ⭐ Extracted rather than inlined a second time: `catalogue.spec.js` already walks this form, and a second
 * copy is how two specs end up disagreeing about what "add a product" means. A driver that needs materials
 * (design 2 takes parts from the catalogue) needs exactly this walk and nothing more.
 */
async function addProduct(page, { name, price, desc } = {}) {
  await clickNav(page, 'catalogue');
  const add = page.getByTestId('cat-new-product');
  if (!(await add.isVisible().catch(() => false))) {
    // A catalogue that has never been set up offers the starter pick first.
    const setup = page.getByTestId('cat-setup');
    if (await setup.isVisible().catch(() => false)) await setup.click();
  }
  await add.waitFor({ state: 'visible', timeout: 20000 });
  await add.click();
  await page.getByTestId('cat-field-name').fill(name);
  if (price !== undefined) await page.getByTestId('cat-field-price').fill(String(price));
  const d = page.getByTestId('cat-field-desc');
  if (desc && await d.count()) await d.fill(desc);
  /**
   * ⚠️ WAIT FOR THE WRITE, NOT FOR THE CLICK. The first version returned as soon as it had pressed Add, so a
   * second call that silently did nothing was invisible until a LATER step failed for an unrelated-looking
   * reason ("no material matching AC gas kit" — three steps and a minute after the shelf failed to gain it).
   * A helper that does not confirm its own effect turns one broken thing into a mysterious other thing.
   */
  const saved = page.waitForResponse(
    (r) => /\/api\/products/.test(r.url()) && r.request().method() === 'POST' && r.status() < 400,
    { timeout: 45000 });
  await page.getByTestId('cat-add').click();
  await saved;
  await settle(page);
  await dismissModal(page);
  return { name, price };
}

/**
 * addCoassist — a person to give work to. Design 2's whole point is division of labour, and an empty roster
 * makes the Work tab say so honestly ("no co-assists yet") rather than assign to nobody.
 *
 * ⚠️ `key` is the login id, and it must be unique WITHIN the entity — the DB constraint is real
 * (uq_actor_key_per_entity), so a fixed key collides on the second run of the same suite.
 */
async function addCoassist(page, { name, key } = {}) {
  key = key || (String(name || 'mate').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + Date.now().toString().slice(-5));
  await clickNav(page, 'coassists');
  await page.getByTestId('coassist-new').click();
  await page.getByTestId('coassist-type-human').click();
  await page.getByTestId('aw_name').fill(name);
  await page.getByTestId('aw_key').fill(key);
  /**
   * ⚠️ WALK THE WIZARD, DO NOT COUNT ITS STEPS. `AW_STEPS.human` was ['who','hat'] and is now
   * ['who','hat','docs'] — a driver that clicked Next exactly twice stopped on the last step with the wizard
   * still up, and then intercepted every later click in the run. Pressing Next until it is gone survives the
   * next step being added too.
   */
  for (let i = 0; i < 6; i++) {
    const next = page.getByTestId('coassist-wiz-next');
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
    await page.waitForTimeout(150);
  }
  const done = page.getByTestId('coassist-wiz-done');
  await done.waitFor({ state: 'visible', timeout: 30000 });   // the create has answered by the time this shows
  await done.click();
  await settle(page);
  await dismissModal(page);
  return { name, key };
}

module.exports = { addProduct, addCoassist, seedDemo, DEV_OTP, useApiBase, uniqueEmail, uniqueName, uniqueHandle, openAvatarItem, mintEntity, composeSelfChit, composeChit, composeStepNext, clickNav, stableClick, clickInModal, HAS_RCPT, HAS_TOTAL, mintInContext, addRecipientByName, settle, dismissModal, POOL, poolContext };
