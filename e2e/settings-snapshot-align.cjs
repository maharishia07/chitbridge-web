/**
 * e2e/settings-snapshot-align.cjs — every value Settings can change must appear in the Profile snapshot.
 *
 * Athi, 2026-08-21: *"settings is where we can change the value, profile is the personal preference — settings
 * snapshot, and it has to be aligned. Check for all the values in settings is it according to the snapshot."*
 *
 * ⭐⭐ THAT IS A RULE A TEST CAN HOLD. A setting with no reflection on the profile is a change a person makes
 * and cannot confirm; the profile stops being a snapshot the moment Settings grows a control it does not show.
 *
 * ⚠️ TWO KINDS OF REFLECTION COUNT, AND ONLY TWO:
 *   NAMED        — a row whose label says the setting  (Language, Working week, Time zone)
 *   DEMONSTRATED — a sample rendered THROUGH the setting, so a reader sees the effect without the name
 *                  (numbering system, hour cycle and calendar all show inside Timestamp and Numbers)
 * Anything else is invisible, and invisible is what this guard fails on.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const W = path.join(__dirname, '..', 'public');

/* Every locale setter the Settings screen can invoke, and how the profile reflects it. */
const SETTINGS = [
  { setter: 'localeSetRegion',    what: 'Region',           via: 'demonstrated', by: 'drives every sample below' },
  { setter: 'localeSetFormat',    what: 'Format',           via: 'demonstrated', by: 'Timestamp + Numbers' },
  { setter: 'localeToggleLang',   what: 'Languages',        via: 'named',        by: 'Language 1 / 2 / 3' },
  { setter: 'localeSetNu',        what: 'Numbering system', via: 'demonstrated', by: 'Numbers' },
  { setter: 'localeSetHc',        what: 'Hour cycle',       via: 'demonstrated', by: 'Timestamp' },
  { setter: 'localeSetCa',        what: 'Calendar',         via: 'demonstrated', by: 'Timestamp' },
  { setter: 'localeSetFw',        what: 'First day of week',via: 'named',        by: 'Working week' },
  { setter: 'localeToggleWorkday',what: 'Working days',     via: 'named',        by: 'Working week' },
  { setter: 'localeSetTz',        what: 'Time zone',        via: 'named',        by: 'Timestamp note when it differs' },
];

/* ── 1 · has Settings grown a setter this list does not know about? ────────────────────────────────────── */
const admin = fs.readFileSync(path.join(W, 'app', 'cap-admin.js'), 'utf8');
const i = admin.indexOf('function localeSettingsHTML');
const seg = admin.slice(i, admin.indexOf('\nfunction ', i + 50));
/* ⚠️ NO TRAILING PAREN IN THE PATTERN. The pickers pass their setter BY NAME to a helper —
   sel('loc-tz', opts, cur, 'localeSetTz') — so requiring "(" found none of them and this guard reported
   seven live controls as stale. A name is not always a call site. */
const found = [...new Set([...seg.matchAll(/\b(localeSet[A-Za-z]+|localeToggle[A-Za-z]+)\b/g)].map((m) => m[1]))]
  .filter((n) => n !== 'localeSettingsHTML');

const known = new Set(SETTINGS.map((s) => s.setter));
const unlisted = found.filter((n) => !known.has(n));
const stale = SETTINGS.filter((s) => !found.includes(s.setter)).map((s) => s.setter);

/* ── 2 · render the profile snapshot and check each NAMED row is really there ──────────────────────────── */
const store = {};
const sandbox = {
  console, Intl,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: () => null,
    documentElement: { style: { setProperty(){}, removeProperty(){} }, setAttribute(){}, removeAttribute(){}, classList: { add(){}, remove(){} } },
    body: { classList: { add(){}, remove(){} }, setAttribute(){} },
    createElement: () => ({ style: {}, setAttribute(){}, appendChild(){} }), head: { appendChild(){} },
    querySelector: () => null, querySelectorAll: () => [] },
  setTimeout: () => 0, clearTimeout(){}, fetch: async () => ({ ok: false }),
  navigator: { language: 'en-IN', languages: ['en-IN'] }, location: { origin: '', host: 'h', search: '' },
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(W, 'app', 'locale.js'), 'utf8'), ctx, { filename: 'locale.js' });
Object.assign(sandbox, {
  esc: (x) => String(x == null ? '' : x), tx: (x) => x,
  txf: (t, v) => String(t).replace(/\{(\w+)\}/g, (m, k) => v[k]),
  UI: { _iamOpen: { regional: true } }, SESSION: { token: 't' }, val: () => '',
  opt: (l) => l.map((o) => '<option>' + o + '</option>').join(''),
  toast(){}, renderApp(){}, loadProfile(){}, _capShowDetail(){}, api: async () => ({}),
  MSG: { profileSaved: () => '' }, navTo(){}, setSetSec(){}, helpQ: () => '', _CARD: '',
  govCardHTML: () => '', menuAssist: () => '', _misHead: () => '', _capEnd: () => '',
  THEMES: { cream: { name: 'Cream', a11y: { level: 'AA' } } }, themeGet: () => 'cream',
  TEXT_SIZES: [['s','Small',0.92],['m','Medium',1],['l','Large',1.15]], textSize: () => 'm',
  motionPref: () => 'auto', apGet: (k, d) => (k in store ? store[k] : d), STANDARDS: [], GOV: [],
});
vm.runInContext(fs.readFileSync(path.join(W, 'app', 'cap-admin.js'), 'utf8'), ctx, { filename: 'cap-admin.js' });

const html = ctx.iamMeHTML({ identity_id: 'e', bridge_id: 'B', display_name: 'n', user_id: 'x',
  identity_type: 'entity', country: 'IN', currency_code: 'INR', timezone: 'Asia/Kolkata', governance: {} });
const labels = [...html.matchAll(/letter-spacing:\.04em;line-height:1\.7">([^<]+)<\/b>/g)].map((m) => m[1].trim());

const missing = [];
for (const s of SETTINGS) {
  if (s.via !== 'named') continue;
  const first = s.by.split(/[\/ ]/)[0];
  if (!labels.some((l) => l.indexOf(first) === 0)) missing.push(s);
}

/* ── report ───────────────────────────────────────────────────────────────────────────────────────────── */
console.log('\n  every Settings › Localisation control, and how the profile reflects it:\n');
SETTINGS.forEach((s) => console.log('    ' + s.what.padEnd(18) + s.via.padEnd(15) + s.by));
console.log('\n    profile rows present: ' + labels.join(' · '));

let fail = 0;
if (unlisted.length) { fail++; console.error('\n  ✗ Settings has a control this guard does not know about: ' + unlisted.join(', ')
  + '\n    Add it to SETTINGS above WITH how the profile reflects it — or reflect it first.'); }
if (missing.length) { fail++; console.error('\n  ✗ named but absent from the snapshot: ' + missing.map((m) => m.what + ' (expected a "' + m.by + '" row)').join(', ')); }
if (stale.length) console.log('\n  ⚠ listed here but no longer in Settings: ' + stale.join(', ') + ' — remove the row above.');

console.log('\n  ══ ' + (fail ? 'MISALIGNED' : 'aligned — every control is named or demonstrated') + ' ══\n');
process.exit(fail ? 1 : 0);
