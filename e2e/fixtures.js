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
  await page.getByTestId('reg-submit').click();                     // → create → OTP step
  await page.getByTestId('reg-otp').waitFor();
  await page.locator('[data-testid^="reg-vertical-"]').first().click();
  await page.getByTestId('reg-otp').fill(DEV_OTP);
  await page.getByTestId('reg-submit').click();                     // → verify → mint → app
  return { email, name };
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
}

// ── MULTIPARTY — the real capability. Each browser CONTEXT is an isolated logged-in party. Mint N entities in N contexts,
// drive them together, assert what EACH party sees. Run headed (`npm run test:headed`) to watch 2-3 windows side by side.
async function mintInContext(browser, opts) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const who = await mintEntity(page, opts);
  return { context, page, email: who.email, name: who.name };
}

// In Compose: address a recipient by typing their name and picking the live suggestion (entity search).
async function addRecipientByName(page, name) {
  await page.getByTestId('chit-recipient').fill(name);
  await page.getByTestId('chit-recipient-suggest').filter({ hasText: name }).first().click();
}

module.exports = { DEV_OTP, uniqueEmail, uniqueName, mintEntity, composeSelfChit, mintInContext, addRecipientByName };
