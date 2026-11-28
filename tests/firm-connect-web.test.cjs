'use strict';
// @type: unit
/**
 * tests/firm-connect-web.test.cjs — UX-215/216/220 (firm-connect 1138): static proof of the web half, no browser, no api, with MUTANTS.
 *
 * OWNS      the rules the Requests view, the grant edits, the visits, the bell's pinned row and the Home Network card must keep: every answer (Accept, Refuse, Cancel) asks first through CBAction;
 *           the shop asks its firm as the PARENT and the firm asks the shop by bridge id; each refusal of the handoff is a plain sentence; an invitation that was NOT sent says so; a staff seat is greyed with the server's sentence;
 *           a rise in costs sends consent and a 503 is said in words; the visit row is the server's grouping; the bell reads the badge and draws ONE pinned row; the Home card reads /api/facts/network; "network parent" is never on an owner screen
 * CALLED BY CI (ci.yml, offline guards) · by hand: node tests/firm-connect-web.test.cjs [--mutants]   (each mutant must turn at least one check red)
 * CARD      04-network/connections-and-invitations
 */
const fs = require('fs'), path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const FILES = ['app/books-grant-asks.js', 'app/books-grant-edit.js', 'app/books-grant-visits.js', 'app/books-grant-member.js', 'app/rail-bell-html.js', 'app/rail-bell-rows.js', 'app/rail-bell.js', 'app/manifest.json'];

/** every check on a set of sources: returns the names of the checks that FAIL */
function failures(src) {
  const bad = [], check = (ok, name) => { if (!ok) bad.push(name); };
  const asks = src['app/books-grant-asks.js'], edit = src['app/books-grant-edit.js'], visits = src['app/books-grant-visits.js'], member = src['app/books-grant-member.js'];
  const html = src['app/rail-bell-html.js'], rows = src['app/rail-bell-rows.js'], bell = src['app/rail-bell.js'];
  const manifest = JSON.parse(src['app/manifest.json']).entries.filter((e) => e.id === 'network')[0] || {};
  const answer = (asks.match(/function answer\([^]*?\n  }\n/) || [''])[0];
  check(/CBAction\.run\(/.test(answer) && /confirm: \{ title: words\(text\.title\)/.test(answer), 'asks: an answer asks first through CBAction.run (confirm)');
  check(['askAccept', 'askRefuse', 'askCancel'].every((n) => new RegExp('function ' + n + '\\(request\\) \\{\\n    answer\\(').test(asks)), 'asks: Accept, Refuse and Cancel each go through answer()');
  check(/netApprove\b[^\n]*approve/.test(asks) && /netDecline\b[^\n]*decline/.test(asks) && /netAsks\b[^\n]*\/api\/network\/asks/.test(asks) && /firm-invites/.test(asks), 'asks: the four routes of the handoff are named once');
  check(/direction === 'firm' \? \{ childBridgeId: pick\.bridge_id, type: 'agency' \} : \{ parentHandle: /.test(asks), 'asks: the shop asks its firm as the parent, the firm asks the shop by bridge id');
  const codes = ['EXISTS', 'FIRM_DIRECTION', 'ASK_LIMIT', 'ASK_COOLING_OFF', 'INVITE_LIMIT', 'OWNER_ONLY', 'CHILD_NOT_FOUND', 'PARENT_NOT_FOUND', 'SELF'];
  check(codes.every((c) => new RegExp('\\b' + c + ': \'').test(asks)), 'asks: every refusal code of the handoff has its sentence');
  check(/reply\.sent === false \? words\('Not sent\.'\)/.test(asks), 'asks: an invitation that was NOT sent says so');
  check(/function grey\(button\)[^]*?button\.title = panel\.why/.test(asks) && /aria-disabled/.test(asks), 'asks: a refused seat is greyed WITH the server\'s sentence');
  check(/group: \{ default: 'on'[^}]*order: \['me', 'them'\]/.test(asks), 'asks: the two states are groups, not a repeated label');
  check(/whoLine/.test(asks) && /request\.bridge_id/.test(asks) && /request\.country/.test(asks), 'asks: each request shows the firm, its bridge id and its country');
  check(/rising\(grant, ids\.costs\)\) out\.consent = true/.test(edit) && /!!ids\.costs !== !!grant\.can_see_costs/.test(edit), 'edit: consent only on a RISE in costs; only a moved choice is sent');
  check(/Changing what your firm sees is not switched on yet/.test(edit) && /BOOKS_GRANT_NOT_SWITCHED_ON/.test(edit), 'edit: a 503 is said as "not switched on yet"');
  check(/riseWords\(consent/.test(member) && /failSaid/.test(member), 'member: a rise in costs asks in the server\'s words, a refusal is shown');
  check(visits.includes('(visit.pages_list || [])') && /actor_name/.test(visits) && /answer\.visits/.test(visits), 'visits: one row per visit, the firm and the person, the pages in the detail');
  check(/CBBooksGrantVisits\.rows\(answer\)/.test(member) && /CBBooksGrantVisits\.config\(/.test(member), 'member: Who looked is drawn from the visits');
  check(/Connect your bookkeeper or auditor first\./.test(member) && /Find your firm/.test(member), 'member: Give access with no firm says connect first and offers Find your firm');
  check(!/network parent/i.test([asks, edit, visits].join('\n') + member.replace(/\/\*[^]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'no owner screen says "network parent"');
  check(/bell\.asks > 0/.test(html) && /data-asks="1"/.test(html), 'bell: ONE pinned row while requests wait');
  check(/'\/network\.html#asks'/.test(rows) && /data-asks/.test(rows), 'bell: the pinned row opens the requests');
  check(/count: 1/.test(rows) && /\+ \(bell\.asks \|\| 0\)/.test(rows), 'bell: closed it reads the badge; the feed count adds the waiting requests');
  check(/setCount\(bell\.asks \|\| 0\)/.test(bell), 'bell: opening (seen) never clears a waiting request');
  check(manifest.facts === '/api/facts/network' && manifest.ready === true && /^\/network\.html#asks$/.test(manifest.route || ''), 'home: the Network card reads /api/facts/network and its door is the requests');
  return bad;
}

const sources = () => Object.fromEntries(FILES.map((f) => [f, read(f)]));
/** each mutant: [name, file, from, to]; a mutant must turn at least one check red */
const MUTANTS = [
  ['Accept without a confirm', 'app/books-grant-asks.js', 'confirm: { title: words(text.title)', 'nope: { title: words(text.title)'],
  ['shop asks its firm as the child', 'app/books-grant-asks.js', "{ parentHandle: pick.user_id || pick.bridge_id, type: 'agency' }", "{ childBridgeId: pick.bridge_id, type: 'agency' }"],
  ['FIRM_DIRECTION loses its sentence', 'app/books-grant-asks.js', '    FIRM_DIRECTION:', '    FIRM_DIRECTIONX:'],
  ['not-sent invitation passes as sent', 'app/books-grant-asks.js', 'reply.sent === false ? words', 'reply.sent === true ? words'],
  ['a staff seat is not greyed with the sentence', 'app/books-grant-asks.js', 'button.title = panel.why;', ''],
  ['the two states lose their groups', 'app/books-grant-asks.js', "order: ['me', 'them']", "order: []"],
  ['the country is not shown', 'app/books-grant-asks.js', 'request.country', 'request.land'],
  ['consent is sent on every change', 'app/books-grant-edit.js', 'if (rising(grant, ids.costs)) out.consent = true;', 'out.consent = true;'],
  ['the 503 is not said', 'app/books-grant-edit.js', 'Changing what your firm sees is not switched on yet', 'try again'],
  ['the visits ignore the pages', 'app/books-grant-visits.js', '(visit.pages_list || [])', '[]'],
  ['"network parent" comes back', 'app/books-grant-member.js', "words('Connect your bookkeeper or auditor first.')", "words('You have no network parent to give access to.')"],
  ['the bell draws no pinned row', 'app/rail-bell-html.js', 'bell.asks > 0', 'false'],
  ['the pinned row opens nothing', 'app/rail-bell-rows.js', "'/network.html#asks'", "'/'"],
  ['the dot loses the waiting requests', 'app/rail-bell-rows.js', ' + (bell.asks || 0)', ''],
  ['opening the bell clears a waiting request', 'app/rail-bell.js', 'setCount(bell.asks || 0)', 'setCount(0)'],
  ['the Home card reads nothing', 'app/manifest.json', '"facts": "/api/facts/network"', '"facts": null']
];

const args = process.argv.slice(2);
const base = failures(sources());
console.log('  ' + (base.length ? 'FAIL' : 'ok  ') + ' the checks on the real sources: ' + (base.length ? base.join(' | ') : 'all pass'));
let bad = base.length;
if (args.includes('--mutants')) {
  for (const [name, file, from, to] of MUTANTS) {
    const src = sources();
    if (!src[file].includes(from)) { console.log('  FAIL mutant "' + name + '" does not apply (the text moved)'); bad++; continue; }
    src[file] = src[file].replace(from, to);
    const red = failures(src);
    console.log('  ' + (red.length ? 'ok  ' : 'FAIL') + ' mutant killed: ' + name + (red.length ? ' (' + red[0] + ')' : ' SURVIVED'));
    if (!red.length) bad++;
  }
}
process.exit(bad ? 1 : 0);
