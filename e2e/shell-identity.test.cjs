'use strict';
// @type: unit
/**
 * shell-identity.test.cjs — the shared customer-page top bar carries identity codes (UX-137, Wave 2 shell).
 *
 * OWNS      the proof that every control the shell's top bar draws (shop menu, area menu and its items, licence and edition chips,
 *           the sheet's links) and the bell and avatar it hosts (button, panel rows, every menu item and option, Sign in) wears
 *           data-cbsid with a code from the one list below, so the 19 customer pages lift at once.
 * CALLED BY ci.yml (QA gate, beside ui-action-set); by hand: node e2e/shell-identity.test.cjs
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/design-system
 * Cases     the avatar menu is drawn for real (every button and link carries a code); the bar, bell and sheet markup is read from
 *           source by testid (those builders need a live page); a control with no code, or a code outside the list, fails.
 * NOTE      CMP046-CMP052 are the rows asked of the register (cb-capability); CMP014, CMP010, CMP030 exist or are in flight.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', file), 'utf8');
let failures = 0;
const check = (condition, message) => { console.log((condition ? '  ok ' : '  FAIL ') + message); if (!condition) failures++; };

/** the codes the shell may wear, and what each is */
const CODES = {
  'CMP046-B01': 'shop menu', 'CMP047-B01': 'area menu', 'CMP048-B01': 'account menu (avatar)', 'CMP049-B01': 'menu item',
  'CMP050-B01': 'option', 'CMP051-B01': 'status chip', 'CMP052-B01': 'sign in', 'CMP030-B01': 'activity (bell)',
  'CMP014-B01': 'clear', 'CMP010-B01': 'open', 'CMP023-B01': 'home'
};
const CODE_ATTR = /data-cbsid="([A-Z]{3}\d{3}(?:-[A-Z]\d{2})*)"/;

/** every testid in a source file: the opening tag that carries it must carry a listed code */
function testidsCarryCodes(file, testids) {
  const text = read(file);
  testids.forEach((id) => {
    const at = text.indexOf('data-testid="' + id);
    check(at > 0, file + ' draws ' + id);
    if (at < 0) return;
    const open = text.lastIndexOf('<', at), close = text.indexOf('>', at);
    const code = (text.slice(open, close).match(CODE_ATTR) || [])[1];
    check(!!code && !!CODES[code], file + ' ' + id + ' wears ' + code);
  });
}

console.log('the avatar menu, drawn for real');
const box = () => ({ style: {}, setAttribute() {}, getAttribute() { return null; }, classList: { add() {}, remove() {}, contains() { return false; } }, appendChild() {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } });
const sandbox = { console, window: {}, setTimeout, clearTimeout, esc: (text) => String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])) };
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
sandbox.addEventListener = () => {};
sandbox.matchMedia = () => ({ matches: false, addEventListener() {} });
sandbox.getComputedStyle = () => ({ getPropertyValue: () => '' });
sandbox.document = Object.assign(box(), { documentElement: box(), head: box(), body: box(), createElement: box, getElementById: () => null, cookie: '' });
vm.createContext(sandbox);
vm.runInContext(read('avatar.js'), sandbox, { filename: 'avatar.js' });
const draw = (extra) => sandbox.CBAvatar.menuHtml(Object.assign({ person: { name: 'A', owner: true }, items: ['profile', 'settings', 'support', 'signout'], supportHref: '/support', languages: { list: { en: 'English', ta: 'Tamil' }, current: 'en' } }, extra));
[draw({}), draw({ onProfile() {}, onSettings() {}, onSupport() {}, items: ['profile', 'settings', 'support'] })].forEach((html, index) => {
  const tags = html.match(/<(button|a)\b[^>]*>/g) || [];
  const bare = tags.filter((tag) => !CODE_ATTR.test(tag) || !CODES[tag.match(CODE_ATTR)[1]]);
  check(tags.length > 20, 'menu ' + (index + 1) + ' draws its ' + tags.length + ' controls');
  check(bare.length === 0, 'menu ' + (index + 1) + ': none without a listed code' + (bare.length ? ' (' + bare[0] + ')' : ''));
});

console.log('the avatar button and the Sign in door');
const avatarSource = read('avatar.js');
check((avatarSource.match(/class="cbav-btn" data-cbsid="CMP048-B01"/g) || []).length === 1, 'the avatar button is the account menu');
check((avatarSource.match(/class="cbav-signin" data-cbsid="CMP052-B01"/g) || []).length === 2, 'both Sign in doors (button, link) carry the code');

console.log('the bell and its panel');
testidsCarryCodes('rail-bell.js', ['bell-btn', 'bell-row', 'bell-clear']);

console.log('the bar, the area menu, the chips and the sheet');
testidsCarryCodes('shell.js', ['shell-shop', 'shell-switcher', 'shell-switch-', 'shell-licence-chip', 'shell-edition-chip', 'shell-edition-off', 'shell-renew', 'shell-finish']);
check(/root\.ui\.action\('home'/.test(read('shell.js')), 'Home is the standard component CMP023');

console.log(failures ? failures + ' FAILED' : 'all ok');
process.exit(failures ? 1 : 0);
