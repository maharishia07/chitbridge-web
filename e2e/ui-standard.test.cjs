'use strict';
// @type: unit
/**
 * ui-standard.test.cjs — the UI standard page (public/ui-standard.html, screen UIS001), offline: no browser.
 * Cases: the page is public and mock-only (no api, session, shell, storage or fetch in the page or its script; a CSP that refuses every
 * connection); every component of the action set (CMP001..CMP010) has a row; the nine action labels are in all four packs; the page's own
 * labels are in all four packs; the census rows name real components. The browser half (render, language switch, scroll) is e2e/walk-ui-standard.cjs.
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/ui-action-set
 * Run: node e2e/ui-standard.test.cjs
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
let failures = 0;
const check = (condition, message) => { console.log((condition ? '  ok ' : '  FAIL ') + message); if (!condition) failures++; };
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^[ \t]*\/\/.*$/gm, '');

console.log('public and mock-only');
const html = read('ui-standard.html'), page = strip(read('app/ui-standard.js')), pageHtml = strip(html);
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
check(scripts.every((src) => src.charAt(0) === '/' && !/^https?:/.test(src)), 'only same-origin scripts: ' + scripts.length);
/* the standard frame (CBFrame.lab, public, signin false) is loaded; nothing that holds an api address, a session or a sign-in is */
['/app/shell.js', '/app/page-frame.js', '/app/lab-kit.js', '/app/screen-id.js'].forEach((src) => check(scripts.indexOf(src) >= 0, 'wears the standard frame: loads ' + src));
['config.js', 'core.js', 'one-person.js', 'rail-bell.js', 'signin-ui.js', 'kural.js'].forEach((name) => check(scripts.indexOf('/app/' + name) < 0 && scripts.indexOf('/' + name) < 0, 'does not load ' + name));
check(/CBFrame\.lab\(\{\s*app:\s*'ui-standard'/.test(html) && /CBFrame\.lab\([\s\S]*?avatar:/.test(html), 'mounts CBFrame.lab (the Country lab way) with its own avatar options');
/* device-id.js loads first, as on every page with a session reader (e2e/device-id.cjs, 8 Nov); no script on this page calls CBDevice, so no id is made and nothing is stored */
check(scripts.indexOf('/app/device-id.js') >= 0 && scripts.indexOf('/app/device-id.js') < scripts.indexOf('/app/helpers.js'), 'loads device-id.js before any other script');
/* every script the page loads (the frame's too), bar device-id.js itself: none asks for the id, so none is made. device-id.js still wraps fetch on load; nothing is sent because the page sends nothing */
scripts.filter((src) => src !== '/app/device-id.js').forEach((src) => check(!/CBDevice/.test(fs.readFileSync(path.join(__dirname, '..', 'public', src), 'utf8')), src + ' never asks for the device id, so none is made here'));
/* the narrowest CSP the frame needs: its only request is the shell's own /app/manifest.json, so connect-src 'self' (no api, no third party); the one inline script is named by its hash */
const csp = (/Content-Security-Policy" content="([^"]*)"/.exec(html) || [])[1] || '';
check(/connect-src 'self';/.test(csp) && /default-src 'none'/.test(csp) && !/unsafe-eval|script-src[^;]*unsafe-inline|connect-src[^;]*https?:/.test(csp), "a CSP of its own: default-src 'none', connect-src 'self' only, no unsafe-eval or inline-script allowance");
{
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const hashes = [...html.matchAll(/'sha256-([^']+)'/g)].map((match) => match[1]);
  const digest = (text) => require('crypto').createHash('sha256').update(text, 'utf8').digest('base64');
  check(inline.length === 1 && hashes.length === 1 && digest(inline[0]) === hashes[0], 'the one inline script (the frame call) is named in the CSP by its sha256 (recompute it when the script changes)');
}
check((pageHtml.match(/<script(?![^>]*\ssrc=)[^>]*>/g) || []).length === 1, 'exactly one inline script: the frame call');
check(/<html[^>]*data-appearance-fixed/.test(html) && scripts.indexOf('/app/avatar.js') > 0 && scripts.indexOf('/engine/screen.js') > 0 && scripts.indexOf('/engine/screen.js') < scripts.indexOf('/app/avatar.js'), 'the avatar look is applied through avatar.js on a fixed-look page (no storage), after the theme library');
check(!/\b(fetch|XMLHttpRequest|localStorage|sessionStorage|cb_sess|cb_lang|document\.cookie|api\()/.test(page.replace(/the page's own[^\n]*/g, '')), 'the page script never fetches, stores or reads a session');
check(!/https?:\/\/(?!fonts\.(googleapis|gstatic)\.com)/.test(pageHtml.replace(/http-equiv[^>]*>/, '')), 'no external address in the page');

console.log('every component has a row');
const ctx = { console, window: {}, document: { addEventListener() {} }, esc: (s) => String(s), tx: (s) => s, txf: (s) => s, fmtMoney: String, toast() {}, CBAction: { run() {} }, CBStr: 0 };
ctx.CBSTR = { en: {}, ta: {}, hi: {}, ar: {}, fr: {} };
ctx.window = ctx;
vm.createContext(ctx);
['app/ui.js', 'app/strings-ta.js', 'app/strings-hi.js', 'app/strings-ar.js', 'app/strings-fr.js', 'app/strings-ui-standard.js', 'app/ui-standard.js'].forEach((file) => vm.runInContext(read(file), ctx, { filename: file }));
const model = vm.runInContext('CBUiStandard', ctx), components = ctx.ui.components;
const used = new Set(model.ROWS.map((row) => row.name).concat('dialog'));
check(Object.keys(components).every((name) => used.has(name)), 'rows cover all ' + Object.keys(components).length + ' components (CMP001..CMP010)');
check(model.CENSUS.every((entry) => components[entry.name]), 'every census entry names a real component');

console.log('language');
const actions = Object.keys(components).filter((name) => name !== 'dialog');
actions.forEach((name) => check(model.translatedIn(components[name].label).length === 4, name + ': label "' + components[name].label + '" is in all four packs'));
const gaps = actions.filter((name) => model.coverageOf(components[name]).missing.length).map((name) => components[name].code + ' ' + components[name].shown);
console.log('  note  not keyed or not translated today (visible text): ' + (gaps.join(', ') || 'none'));
const chrome = ['UI standard', 'Components', 'Popups', 'Icons', 'Tokens', 'Before and after', 'Light', 'Dark', 'Language', 'Screen', 'Desktop', 'Mobile', 'Size', '24 px target', 'Default', 'Hover', 'Focus', 'Pressed', 'Disabled', 'Busy', 'Example dialog', 'Post this bill?', 'Post bill', 'Post this bill for {amount} to {count} recipients?', 'Remove this supplier?'];
chrome.forEach((key) => check(model.translatedIn(key).length === 4, 'page label "' + key + '" is in ta hi ar fr'));
check(model.translatedIn('A label no pack has').length === 0 && model.coverageOf({ label: 'A label no pack has', code: 'CMP000' }).missing.length > 0, 'a label no pack could read is not shown as translated: the page fell back to the English text and the coverage note says so in words');
check(model.LANGS.map((lang) => lang[0]).join() === 'en,ta,hi,ar,fr' && model.LANGS.filter((lang) => lang[2] === 'rtl').length === 1, 'five languages, one right-to-left (ar)');
check(model.contrastRatio('rgb(0,0,0)', 'rgb(255,255,255)') > 20.9 && model.contrastRatio('rgb(22,105,63)', 'rgb(255,255,255)') >= 4.5, 'the contrast helper: black on white 21:1, the accent on white AA');
console.log('the Standards page links here');
const register = read('app/cap-standards.js'), standardsPage = read('standards.html');
check(register.indexOf("['web', 'Web design']") >= 0, "the register has the Web design subject (STD_AREAS 'web')");
const linked = register.split(/\n  \{\n/).map((block) => [/id: '([^']+)'/.exec(block), /go: '([^']*)'/.exec(block)]).filter((pair) => pair[0] && pair[1] && pair[1][1] === 'ui-standard').map((pair) => pair[0][1]);
check(linked.length >= 5 && ['wcag-1.4.3', 'wcag-1.4.11', 'wcag-2.4.7', 'ui-action-set'].every((id) => linked.indexOf(id) >= 0), 'rows that open this page (go: ui-standard): ' + linked.join(' '));
check(standardsPage.indexOf("'ui-standard': '/ui-standard.html'") >= 0, "standards.html maps the go key 'ui-standard' to /ui-standard.html");
console.log(failures ? failures + ' FAILED' : 'all ok');
process.exit(failures ? 1 : 0);
