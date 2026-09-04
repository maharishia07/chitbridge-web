// TEMPORARY PROBE — deleted after use. Does an entity with country explicitly 'IN' get the governed slabs?
const { test, expect } = require('@playwright/test');
const { mintEntity } = require('../fixtures');
test('probe governed slabs with explicit country', async ({ page }) => {
  test.setTimeout(120000);
  await mintEntity(page);
  const out = await page.evaluate(async () => {
    const before = await api('defList', { query: { kind: 'tax' } });
    const me0 = await api('me').catch(() => null);
    await api('saveProfile', { body: { country: 'IN' } }).catch((e) => ({ err: String(e && e.message) }));
    const after = await api('defList', { query: { kind: 'tax' } });
    const me1 = await api('me').catch(() => null);
    const ids = (r) => ((r && r.definitions) || []).map((d) => d.definition_id);
    return { before: ids(before), after: ids(after), country0: me0 && (me0.country || (me0.entity && me0.entity.country)), country1: me1 && (me1.country || (me1.entity && me1.entity.country)), meKeys: me1 ? Object.keys(me1).slice(0, 12) : null };
  });
  console.log('PROBE ' + JSON.stringify(out));
  expect(out).toBeTruthy();
});
