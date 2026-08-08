/**
 * picker.test.mjs — the shared catalogue picker (app/catalogue-lines.js).
 *
 * Athi, 2026-08-08: *"in supplier and network, the same pattern. with check box, and search… like normal cart."*
 *
 * The picker is now the single control behind both the Suppliers screen and the Network's store catalogues, so a
 * mistake here is a mistake in both at once. Two of these cases are for bugs this file actually had:
 *
 *   · a heading's "select all" walked forward until the next heading, which SWALLOWED the ungrouped products that
 *     cbLineRows appends after every group (rule 3). Ticking one group quietly added an unrelated item to the cart.
 *   · re-initialising on a repaint emptied the cart. Repaints happen for reasons unrelated to the catalogue, so a
 *     basket could vanish between two clicks with nothing on screen to say it had.
 *
 * Run:  node scripts/picker.test.mjs
 *
 * ⚠️ ESM, and it imports for SIDE EFFECTS. catalogue-lines.js is a browser file that attaches to `window`; under
 * this package's "type": "module" it lands on globalThis instead, which is what the browser would give it too.
 */
await import('../public/app/catalogue-lines.js');
const P = globalThis;

let failed = 0;
const ok = (name, cond) => {
  if (cond) console.log('  ok   ' + name);
  else { failed++; console.log('  FAIL ' + name); }
};

/* One product with two sizes, plus a product that belongs to no group — the shape that broke it. */
const cat = {
  shop: { bridge_id: 'B1' },
  items: [
    { item_id: 'a', item_data: { name: 'Tussar Emulsion', unit: 'L', price: 950 } },
    { item_id: 'b', item_data: { name: 'Tussar Emulsion', unit: 'L', price: 3400 } },
    { item_id: 'c', item_data: { name: 'Primer Base', unit: 'L', price: 650 } },
  ],
  groups: [{ label: 'Tussar Emulsion', lines: [{ item_id: 'a', variant: '1L' }, { item_id: 'b', variant: '4L' }] }],
};

console.log('\npicker · the rows');
P.cbPickInit('t', cat);
ok('a heading, its two variants, and the ungrouped product = 4 rows', P.cbPickRows('t').length === 4);

console.log('\npicker · the cart');
P.cbPickToggle('t', 'a'); P.cbPickToggle('t', 'c');
ok('two ticked, two in the cart', P.cbPickCount('t') === 2);
const sel = P.cbPickSelected('t');
ok('★ a variant carries its parent name — "4L" alone is not an order line',
   sel.some((s) => s.name === 'Tussar Emulsion 1L'));
ok('an ungrouped product keeps its own name', sel.some((s) => s.name === 'Primer Base'));

console.log('\npicker · search');
P.cbPickSearch('t', 'primer');
ok('the view narrows', P.cbPickRows('t').filter((r) => r.type === 'line').length === 1);
ok('★★ filtering does NOT unpick what it hides', P.cbPickCount('t') === 2);
P.cbPickSearch('t', 'zzz');
ok('a search matching nothing returns nothing (the screen says so)', P.cbPickRows('t').length === 0);
P.cbPickSearch('t', '4l');
ok('a matched variant keeps its heading, so it is not shown without context',
   P.cbPickRows('t').filter((r) => r.type === 'product').length === 1);
P.cbPickSearch('t', '');

console.log('\npicker · the cart survives a repaint, and only a repaint');
P.cbPickInit('t', cat);
ok('★★ re-initialising on the SAME catalogue keeps the cart', P.cbPickCount('t') === 2);
P.cbPickInit('t', { shop: { bridge_id: 'B2' }, items: [] });
ok('★ a different store starts an empty cart', P.cbPickCount('t') === 0);

console.log('\npicker · select-all on a heading');
P.cbPickInit('t', cat);
P.cbPickGroup('t', 0);
ok('★★ it picks ONLY its own group — not the ungrouped product that follows', P.cbPickCount('t') === 2);
ok('   and it picked the right two', P.cbPickSelected('t').every((s) => s.name.startsWith('Tussar')));
P.cbPickGroup('t', 0);
ok('pressing it again clears the group', P.cbPickCount('t') === 0);

console.log('\n  ' + (failed ? failed + ' FAILED' : 'all passed') + '\n');
process.exit(failed ? 1 : 0);
