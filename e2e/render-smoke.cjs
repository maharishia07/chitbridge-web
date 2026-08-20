/**
 * e2e/render-smoke.cjs — actually CALL the profile renderers and see whether they throw.
 *
 * ⚠️⚠️ WHY THIS EXISTS. `node --check` proves a file PARSES. It cannot see that a function reads a variable
 * belonging to a different function — that is a ReferenceError at render time, and today I shipped three of
 * that class in one session: SESSION.identity_type (never assigned), PURPOSE.profile (computed at parse time),
 * and `capped`/`cap` borrowed from storefrontCardHTML into iamMeHTML. All three parsed. All three ran. All
 * three were wrong, and only one was noticed by a person looking at a screen.
 *
 * ⭐ CALLING THE FUNCTION IS THE ONLY CHECK THAT FINDS THEM. A grep cannot tell a variable from a word in a
 * comment — my first attempt at this returned "before, it, input, loose, id…" from prose. So: stub the
 * browser thinly, run the renderer, and fail if it throws or returns nothing.
 *
 * The stubs are deliberately DUMB. Anything that has to be faked cleverly to make a render pass is a renderer
 * doing too much, and the test would then be testing the stub.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'public');

/* A thin browser. Every stub returns something inert and truthful about its own emptiness. */
const el = () => ({ value: '', checked: false, disabled: false, innerHTML: '', style: {}, textContent: '',
                    remove(){}, appendChild(){}, addEventListener(){} });
const sandbox = {
  console,
  document: { getElementById: () => null, createElement: el, head: el(), body: el(), querySelector: () => null },
  window: {}, localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  location: { origin: 'http://localhost:5173', host: 'localhost:5173', hostname: 'localhost' },
  setTimeout: () => 0, fetch: async () => ({ ok: false, json: async () => ({}) }),
  /* app globals the renderers lean on */
  SESSION: { token: null, role: null, name: 'Test', actorId: null, entityId: 'ent-1' },
  UI: { _iamOpen: {}, _idocs: [], _me: null },
  CFG: { API_BASE: '' },
  esc: (s) => String(s == null ? '' : s),
  tx: (s) => s, txf: (s) => s,
  val: () => '',
  opt: (list, sel) => list.map(o => '<option' + (o === sel ? ' selected' : '') + '>' + o + '</option>').join(''),
  toast(){}, renderApp(){}, loadProfile(){}, loadVault(){}, ensureCap: async () => {}, api: async () => ({}),
  _capShowDetail(){}, _capEnd: () => '', menuAssist: () => '', navTo(){}, setSetSec(){}, profSetSec(){},
  jwtPayload: () => ({}), MSG: { profileSaved: () => 'saved' },
  CBLocale: { region: () => 'IN', regionInfo: () => ({ name: 'India' }) },
  ACCESS_LABEL: { viewer: 'Viewer', commenter: 'Commenter', editor: 'Editor' },
  ACCESS_CHOICES: [['editor', 'Editor'], ['commenter', 'Commenter'], ['viewer', 'Viewer']],
  accessLevelOf: () => 'editor', hatLabel: () => 'Editor', hatAssignable: () => true,
  govCardHTML: () => '<div>rights</div>', _CARD: '', _misHead: () => '', scrErr: () => '',
  MIS_BANDS: [], PLAN: { chitsPerDay: 1 }, GOV: {}, ACTOR_TYPES: {}, AC_TYPE: {},
  inr: (n) => String(n), CAP_LOADED: {},
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

const ctx = vm.createContext(sandbox);
/* Load the capability the same way the browser does: a classic script into shared global scope. */
try {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'app', 'cap-admin.js'), 'utf8'), ctx, { filename: 'cap-admin.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'app', 'cap-iddocs.js'), 'utf8'), ctx, { filename: 'cap-iddocs.js' });
} catch (e) {
  console.error('✗ a capability failed to LOAD: ' + e.message);
  process.exit(1);
}

const ENTITY = {
  identity_id: 'ent-1', bridge_id: 'CBTEST0001', display_name: 'mystorex', user_id: 'mystorex',
  gstn: null, address: null, business_status: 'open', catalogue_visibility: 'private',
  identity_type: 'entity', governance: {},
};
const ACTOR = {
  identity_id: 'act-1', bridge_id: 'CBTEST0002', display_name: 'Raman', actor_key: 'raman',
  parent_user_id: 'mystorex', identity_type: 'actor', access_level: 'commenter', whole_entity: false,
};

const CASES = [
  ['iamMeHTML — entity, private + open',    () => ctx.iamMeHTML(ENTITY)],
  ['iamMeHTML — public + away',             () => ctx.iamMeHTML({ ...ENTITY, catalogue_visibility: 'public', business_status: 'away' })],
  ['iamMeHTML — capped to private',         () => ctx.iamMeHTML({ ...ENTITY, visibility_cap: { max: 'private', reason: 'Set by your network.' } })],
  ['iamMeHTML — no user_id yet',            () => ctx.iamMeHTML({ ...ENTITY, user_id: null })],
  ['iamSelfEmployeeHTML — commenter',       () => ctx.iamSelfEmployeeHTML(ACTOR)],
  ['iamSelfEmployeeHTML — editor + reach',  () => ctx.iamSelfEmployeeHTML({ ...ACTOR, access_level: 'editor', whole_entity: true, can_see_costs: true })],
  ['CBIdDocs.html — self, empty',           () => ctx.CBIdDocs.html([], 'self')],
  ['CBIdDocs.html — self, with rows',       () => ctx.CBIdDocs.html([{ scheme: 'PAN', value_masked: 'ABC••••34F', status: 'verified', submitted_by: 'x' }], 'self')],
  ['CBIdDocs.html — owner',                 () => ctx.CBIdDocs.html([], 'owner', { subject: 'act-1' })],
];

let pass = 0, fail = 0;
for (const [name, fn] of CASES) {
  try {
    const out = fn();
    if (typeof out !== 'string' || out.length < 20) { fail++; console.error('  ✗ ' + name + '  → returned ' + JSON.stringify(String(out).slice(0, 40))); }
    else { pass++; console.log('  ✓ ' + name + '  (' + out.length + ' chars)'); }
  } catch (e) {
    fail++;
    console.error('  ✗ ' + name + '\n      ' + e.name + ': ' + e.message);
  }
}

console.log(`\n══ render smoke · ${pass} passed · ${fail} failed ══\n`);
process.exit(fail ? 1 : 0);
