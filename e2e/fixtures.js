// Shared helpers for the e2e specs. Kept tiny so each MODULE spec stays self-describing.
const DEV_OTP = process.env.CB_DEV_OTP || '123456';   // relies on DEV_OTP set on the API during dev (Athi's standing choice)

// a fresh identity per run so specs never collide on an existing entity/email.
function uniqueEmail(prefix) {
  return (prefix || 'e2e') + '.' + Date.now() + '.' + Math.floor(Math.random() * 1e4) + '@test.example';
}
function uniqueName(prefix) {
  return (prefix || 'E2E Co') + ' ' + Date.now().toString().slice(-6);
}

// Reusable: walk the onboarding→register→verify (mint) flow and land in the app. Returns { email, name }.
// This is the shared "arrange" step other modules (chits, catalogue) build on — and the heart of the DoD.
async function mintEntity(page, { role = 'business' } = {}) {
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
  const email = uniqueEmail(), name = uniqueName();
  await page.getByTestId('onb-getstarted').click();
  await page.getByTestId(`onb-role-${role}`).click();
  await page.locator('[data-testid^="onb-bp-"]').first().click();   // pick the first vertical/blueprint
  await page.getByTestId('onb-continue').click();
  await page.getByTestId('reg-name').fill(name);
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

// Reusable: compose + send a self-chit with a subject + one line item. The arrange step for chits/disputes/messages.
async function composeSelfChit(page, subject) {
  await page.getByTestId('nav-compose').click();
  await page.getByTestId('chit-add-self').click();
  const subj = page.locator('[data-testid="chit-field-subject"]');
  if (await subj.count()) await subj.fill(subject);
  else await page.locator('[data-testid^="chit-field-"]').first().fill(subject);
  await page.getByTestId('chit-item-name').fill('Widget');
  await page.getByTestId('chit-item-add').click();
  await page.getByTestId('chit-send').click();
  await settle(page);   // let the post-send refresh finish so the next nav click isn't intercepted
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

module.exports = { DEV_OTP, uniqueEmail, uniqueName, mintEntity, composeSelfChit, mintInContext, addRecipientByName, settle, dismissModal };
