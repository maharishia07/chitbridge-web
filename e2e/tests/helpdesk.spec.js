// MODULE: Helpdesk — the reviewer's FIRST Playwright flow (clean, deterministic; needs none of the open-source pieces).
// FLOW: a helpdesk publishes a Q&A (KB) → a user asks → the deterministic library-floor answer shows (no LLM needed).
// STATUS: skeleton — needs the helpdesk-entity login + KB data-testids (kb-question/kb-answer/kb-publish) and the
// assistant ask box testid. This is the module to complete FIRST on Saturday (Step 3).
const { test, expect } = require('@playwright/test');

test.describe('Module · Helpdesk', () => {
  test.skip('publish a Q&A, then the assistant answers it (deterministic)', async ({ page }) => {
    // TODO(per-module, Step 3):
    //   1. sign in as the helpdesk entity (nav-signin → login-id → login-otp → login-submit).
    //   2. open 🧠 Assistant KB (needs a nav testid), fill kb-question + kb-answer, click kb-publish.
    //   3. open the assistant widget, ask the same question (assist-input → assist-ask).
    //   4. expect the published answer text to appear (library floor — the stubbed LLM is not needed).
    await page.goto('/app.html');
  });
});
