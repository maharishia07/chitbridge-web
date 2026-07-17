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
  const email = uniqueEmail(), name = uniqueName();
  await page.goto('/app.html');
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

module.exports = { DEV_OTP, uniqueEmail, uniqueName, mintEntity, composeSelfChit };
