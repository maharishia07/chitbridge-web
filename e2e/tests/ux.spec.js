// MODULE: UX fine-tuning — Athi's list of 2026-09-01.
// FLOW: sign-in copy · sign-out lands on the login step · the detail action row is the reader's choice.
// LOCATORS: l_id · dact-open · dact-picker · dact-forward · dact-reset · chit-void
const { test, expect } = require('@playwright/test');
const { mintEntity, seedDemo } = require('../fixtures');

test.describe('Module · UX list 2026-09-01', () => {
  /**
   * ⚠️ LOGIN.step SURVIVES A SIGN-OUT, and renderLogin paints whatever step it holds. Leaving a session
   * mid-PIN put the next person straight on the PIN screen with no way back to User ID.
   */
  test('[UX-01] signing out lands on the User ID step, not a password screen', async ({ page }) => {
    await mintEntity(page);
    /* Put the login state on a later step, exactly as an interrupted sign-in would. */
    await page.evaluate(() => { LOGIN.step = 'pin'; LOGIN.id = 'someone'; });
    await page.evaluate(() => logoutNow());
    await page.waitForTimeout(1200);
    await expect(page.locator('#l_id')).toBeVisible({ timeout: 15000 });
    expect(await page.evaluate(() => LOGIN.step)).toBe('id');
    /* ⭐ And the copy Athi asked about is gone / moved. */
    const card = await page.locator('.auth .card').innerText();
    expect(card).not.toContain('one field, the system knows who you are');
    expect(card).toContain('User ID');
    expect(card).toContain('co-assist signs in as key@user-id');
  });

  /**
   * ⭐⭐ *"can we keep all the chips in a selection box, so whatever required can be picked up by the user and
   * can be kept as a user preference, like Fwd etc."*
   *
   * ⚠️ THE DEFAULT MUST BE EVERYTHING. An upgrade that silently hides controls is indistinguishable from a bug.
   */
  test('[UX-02] the detail actions are the reader\'s choice, and default to all', async ({ page }) => {
    await mintEntity(page);

    const shown = () => page.evaluate(() =>
      DACT.filter((d) => { try { return d.on(); } catch (e) { return false; } })
          .filter((d) => dactShows(d.id)).map((d) => d.id));

    /* Nothing stored yet → every allowed action shows. */
    expect(await page.evaluate(() => localStorage.getItem('cb_dact'))).toBeNull();
    const all = await shown();
    expect(all.length).toBeGreaterThan(4);
    expect(all).toContain('forward');

    /* Unpin one. */
    await page.evaluate(() => dactToggle('forward'));
    const after = await shown();
    expect(after).not.toContain('forward');
    expect(after.length).toBe(all.length - 1);

    /* ⚠️ Unpinned is not removed — the picker still offers it, so nothing becomes unreachable. */
    await page.evaluate(() => dactPick());
    await expect(page.getByTestId('dact-picker')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('dact-forward')).toBeVisible();
    await expect(page.getByTestId('dact-forward')).not.toBeChecked();

    /* And it is remembered on this device. */
    expect(await page.evaluate(() => localStorage.getItem('cb_dact'))).not.toBeNull();
    await page.getByTestId('dact-reset').click();
    expect(await page.evaluate(() => localStorage.getItem('cb_dact'))).toBeNull();
    expect((await shown()).length).toBe(all.length);
  });

  /**
   * ⚠️ A PREFERENCE MUST NOT SUMMON AN ACTION THE RULES FORBID. Void is entity-only and Assign is actor-only;
   * ticking them in the picker cannot make them appear for a role that may not use them.
   */
  test('[UX-03] the visibility rules still decide first', async ({ page }) => {
    await mintEntity(page);
    const allowed = await page.evaluate(() => {
      SESSION.role = 'actor';
      return DACT.filter((d) => { try { return d.on(); } catch (e) { return false; } }).map((d) => d.id);
    });
    expect(allowed).not.toContain('void');       // entity-only
    const asEntity = await page.evaluate(() => {
      SESSION.role = 'entity';
      return DACT.filter((d) => { try { return d.on(); } catch (e) { return false; } }).map((d) => d.id);
    });
    expect(asEntity).toContain('void');
    expect(asEntity).not.toContain('assign');    // actor-only
  });

  /**
   * ⭐⭐ Athi, 2026-09-01: *"design 2 page comes for the full screen, not like two page screen like design 1.
   * its mobile version is awful."*
   *
   * ⚠️ THE CAUSE WAS ONE LINE. `c2Paint()` wrote `#mainbody`, which holds the WHOLE panel — list, divider and
   * detail — so every repaint threw the list away. The shell was already correct: `renderDetail()` returns
   * `chit2Screen()` while `UI.chit2` is set. Painting `#detailpane` instead, the way every other detail
   * renderer in the app does, fixes the laptop layout AND mobile at once: `.appwrap.m .panel.showdetail` swaps
   * list for detail on a narrow screen, and that rule only ever applied to the pane this was bypassing.
   */
  test('[UX-04] design 2 renders in the detail pane, keeping the list beside it', async ({ page }) => {
    /* ⚠️ Mint + seed + two viewports does not fit the 60s default; this is a slow test on purpose, because
       an empty account cannot show that the LIST survived. */
    test.setTimeout(240000);
    await mintEntity(page);
    await seedDemo(page);
    await page.getByTestId('nav-task').click();
    await page.waitForTimeout(2500);
    await page.locator('.lrow').first().click();
    await page.waitForTimeout(1500);

    const shape = () => page.evaluate(() => ({
      chit2: !!UI.chit2,
      list: !!document.querySelector('.list'),
      detail: !!document.querySelector('.detail'),
      panel: !!document.querySelector('.panel'),
    }));

    const d1 = await shape();
    expect(d1).toMatchObject({ chit2: false, list: true, detail: true, panel: true });

    await page.getByTestId('open-design2').click();
    await page.getByTestId('c2-side-them').waitFor({ timeout: 25000 });
    await page.waitForTimeout(1000);

    /* ⭐ The whole point: design 2 is on, and the list is STILL THERE. */
    const d2 = await shape();
    expect(d2).toMatchObject({ chit2: true, list: true, detail: true, panel: true });

    /* ⚠️ And nothing writes #mainbody any more — that is what destroyed the panel. */
    const kids = await page.evaluate(() => Array.prototype.map.call(
      (document.getElementById('mainbody') || { children: [] }).children,
      (e) => String(e.className || e.tagName)).join(','));
    expect(kids).toContain('panel');

    /* Mobile: the narrow-screen rule swaps list for detail, so design 2 fills the width without overflowing. */
    await page.setViewportSize({ width: 390, height: 780 });
    await page.evaluate(() => { try { setVP('mob'); } catch (e) {} });
    await page.waitForTimeout(1500);
    await page.locator('.lrow').first().click();
    await page.waitForTimeout(1500);
    const d2m = page.getByTestId('open-design2');
    if (await d2m.count()) {
      await d2m.click();
      await page.getByTestId('c2-side-them').waitFor({ timeout: 25000 });
    }
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the page must not scroll sideways on a phone').toBeLessThanOrEqual(1);
  });
});
