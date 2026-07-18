// AXE (reviewer §2) — keyboard operation depends on the a11y substrate: every interactive element focusable + labelled,
// a VISIBLE focus indicator, and adequate contrast. Runs axe-core on each screen and reports violations; the focus/label
// ones are the keyboard-critical ones to fix. Free, integrates with Playwright. Runs at the counter viewport (config).
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { mintEntity } = require('../fixtures');

function report(label, results) {
  const crit = results.violations.filter(v => ['critical', 'serious'].includes(v.impact));
  console.log(`AXE ${label}: ${results.violations.length} violations (${crit.length} critical/serious)`);
  results.violations.forEach(v => console.log(`  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`));
  const kbd = results.violations.filter(v => /focus|label|aria|name|tabindex|keyboard/i.test(v.id));
  if (kbd.length) console.log(`  KEYBOARD-CRITICAL (focus/label): ${kbd.map(v => v.id).join(', ')}`);
  return crit;
}

test.describe('Accessibility (axe) · the keyboard substrate', () => {
  test('[AXE-01] entry / sign-in screen — no critical a11y violations', async ({ page }) => {
    await page.goto('/app.html');
    const crit = report('entry', await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze());
    expect(crit, 'critical/serious a11y violations on the entry screen').toHaveLength(0);
  });

  test('[AXE-02] app shell (after mint) — no critical a11y violations', async ({ page }) => {
    await mintEntity(page);
    const crit = report('app-shell', await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze());
    expect(crit, 'critical/serious a11y violations in the app shell').toHaveLength(0);
  });

  test('[AXE-03] compose modal — no critical a11y violations (the counter\'s core form)', async ({ page }) => {
    await mintEntity(page);
    await page.getByTestId('nav-compose').click();
    const crit = report('compose', await new AxeBuilder({ page }).include('#modalhost').withTags(['wcag2a', 'wcag2aa']).analyze());
    expect(crit, 'critical/serious a11y violations in the compose form').toHaveLength(0);
  });
});
