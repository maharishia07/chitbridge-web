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
  /* ⚠️ timezone + datetime ARE REQUIRED by the Country/Currency/Time zone/Timestamp block. A stub missing them
     would let the block render two rows instead of four and still pass — the test would be measuring the stub. */
  CBLocale: { region: () => 'IN', regionInfo: () => ({ name: 'India' }),
              timezone: () => 'Asia/Calcutta', datetime: () => '20 Aug 2026, 5:45 pm',
              number: (n) => '1,23,45,678.9', locale: () => 'en-IN' },
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

/**
 * srvChannels — build the payload the SERVER actually sends, then flatten it exactly as iamLoadChannels does.
 * lib/channels.js returns { channels: [ {key, name, bindings:[…]} ] } — a catalogue of TYPES, each carrying
 * its bindings. Reading j.channels as the rows is what made this feature show nothing.
 */
function srvChannels(rows){
  const byType = { whatsapp: [], email: [], sms: [], web: [] };
  rows.forEach(r => (byType[r.channel] = byType[r.channel] || []).push(r));
  const payload = { channels: Object.keys(byType).map(k => ({ key: k, name: k, bindings: byType[k] })) };
  return payload.channels.reduce((all, t) => all.concat(t.bindings || []), []);
}

const CASES = [
  ['iamMeHTML — entity, private + open',    () => ctx.iamMeHTML(ENTITY)],
  ['iamMeHTML — public + away',             () => ctx.iamMeHTML({ ...ENTITY, catalogue_visibility: 'public', business_status: 'away' })],
  ['iamMeHTML — capped to private',         () => ctx.iamMeHTML({ ...ENTITY, visibility_cap: { max: 'private', reason: 'Set by your network.' } })],
  ['iamMeHTML — no user_id yet',            () => ctx.iamMeHTML({ ...ENTITY, user_id: null })],
  /* the Regional block — its OWN section since Athi went looking for it and found it as a footnote — two the business's, two the reader's, told apart by the message column */
  ['iamMeHTML — business timezone set',    () => { ctx.UI._iamOpen.regional = true; const h = ctx.iamMeHTML({ ...ENTITY, country: 'India', currency_code: 'INR', timezone: 'Asia/Kolkata' }); ctx.UI._iamOpen.regional = false; if (h.indexOf('Asia/Kolkata') < 0) throw new Error('entity zone not shown'); return h; }],
  ['iamMeHTML — country/currency/tz/timestamp', () => { ctx.UI._iamOpen.regional = true; const h = ctx.iamMeHTML({ ...ENTITY, country: 'India', currency_code: 'INR' }); ctx.UI._iamOpen.regional = false; if (!/Timestamp/.test(h) || !/Currency/.test(h)) throw new Error('block incomplete'); return h; }],
  /**
   * ⚠️ THE HINTS ARE THE FEATURE WHEN A SECTION IS CLOSED. Athi could not find channels or Regional because
   * both live inside sections that default to collapsed — shipped, correct, invisible. These assert the
   * answer is readable WITHOUT opening anything, which is the only state most readers ever see.
   */
  ['hints — closed sections still answer', () => { ctx.UI._chans = srvChannels([{channel:'whatsapp',address:'+91',label:'S',status:'verified'}]); ctx.UI._chansLoaded = true; ctx.UI._iamOpen = {}; const h = ctx.iamMeHTML({ ...ENTITY, country:'India', currency_code:'INR', catalogue_visibility:'public' }); if (h.indexOf('India · INR') < 0) throw new Error('Business hint missing country/currency'); if (h.indexOf('1 bound') < 0) throw new Error('Channels hint missing the count'); return h; }],
  ['channels — none yet still shows',      () => { ctx.UI._chans = []; ctx.UI._chansLoaded = true; ctx.UI._iamOpen = { channels: true }; const h = ctx.iamMeHTML({ ...ENTITY, catalogue_visibility:'public' }); if (h.indexOf('no channel yet') < 0) throw new Error('empty state hidden'); return h; }],
  ['iamSelfEmployeeHTML — commenter',       () => ctx.iamSelfEmployeeHTML(ACTOR)],
  ['iamSelfEmployeeHTML — editor + reach',  () => ctx.iamSelfEmployeeHTML({ ...ACTOR, access_level: 'editor', whole_entity: true, can_see_costs: true })],
  ['CBIdDocs.html — self, empty',           () => ctx.CBIdDocs.html([], 'self')],
  ['CBIdDocs.html — self, with rows',       () => ctx.CBIdDocs.html([{ scheme: 'PAN', value_masked: 'ABC••••34F', status: 'verified', submitted_by: 'x' }], 'self')],
  /* Trade ready — the OUTWARD answer on the profile. Every state, because the difference between "nothing
     recorded" and "could not read" is a claim about a business that a counterparty will act on. */
  ['trade — nothing recorded',            () => { ctx.UI._rdSum = {total:0,met:0,verified:0,attested:0,documented:0,pending:0,expiring:0,expired:0}; return ctx.iamTradeBody(); }],
  ['trade — all clean',                   () => { ctx.UI._rdSum = {total:7,met:7,verified:5,attested:2,documented:0,pending:0,expiring:0,expired:0}; return ctx.iamTradeBody(); }],
  ['trade — expiring and expired',        () => { ctx.UI._rdSum = {total:7,met:4,verified:2,attested:1,documented:1,pending:2,expiring:1,expired:1}; return ctx.iamTradeBody(); }],
  ['trade — read failed is not zero',     () => { ctx.UI._rdSum = null; return ctx.iamTradeBody(); }],
  /**
   * Channels on the profile. ⚠️ THE FIXTURE IS THE SERVER SHAPE, NOT A FLAT LIST. lib/channels.js returns a
   * CATALOGUE OF TYPES each carrying its own bindings — and the first version of this feature read
   * j.channels as though it were the rows, so the profile silently showed nothing. A test built on the same
   * guess would have passed on the same mistake, which is why srvChannels() mirrors the real payload and the
   * flattening is exercised rather than assumed.
   */
  /* Channels on the profile — the OTHER half of "how is this store reached". A declared channel receives
     nothing, so it must never render as a working contact route. */
  ['channels — one verified',             () => { ctx.UI._chans = srvChannels([{channel:'whatsapp',address:'+919876543210',label:'Shop',status:'verified'}]); ctx.UI._chansLoaded = true; return ctx.iamMeHTML({ ...ENTITY, catalogue_visibility:'public' }); }],
  ['channels — declared says so',         () => { ctx.UI._chans = srvChannels([{channel:'whatsapp',address:'+919876543210',label:'Shop',status:'declared'}]); ctx.UI._chansLoaded = true; return ctx.iamMeHTML({ ...ENTITY, catalogue_visibility:'public' }); }],
  ['channels — read failed is silent',    () => { ctx.UI._chans = null; ctx.UI._chansLoaded = true; return ctx.iamMeHTML(ENTITY); }],
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
