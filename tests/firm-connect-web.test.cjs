'use strict';
// @type: unit
/**
 * tests/firm-connect-web.test.cjs — UX-215/216/220 (firm-connect 1138): the RULES of the web half, run as code (no browser, no api), with MUTANTS that change behaviour.
 *
 * OWNS      body() sends consent only on a RISE in costs and never invents a costs change from a row that does not say what it shows; rising(); the visit rows (one id each, an old api's looks shown as visits, hostile text escaped);
 *           askBody() (the shop asks its firm as the parent, the firm asks the shop by bridge id); every refusal code said in a plain sentence; the bell's count (badge already holds the asks, the feed does not) and what it reads while closed;
 *           the Network manifest entry stays NOT ready until the api half lands; no owner screen says "network parent"
 * CALLED BY CI (ci.yml, offline guards) · by hand: node tests/firm-connect-web.test.cjs [--mutants]   (each mutant must turn at least one rule red)
 * CARD      04-network/connections-and-invitations
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const FILES = ['app/books-grant-asks.js', 'app/books-grant-edit.js', 'app/books-grant-visits.js', 'app/books-grant-member.js', 'app/rail-bell-rows.js', 'app/manifest.json'];
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');

/** run one browser file in a bare sandbox (no DOM): the files hang their module on the global they are given */
function load(src, extra) {
  const box = Object.assign({ esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), tx: (s) => s, console }, extra || {});
  vm.createContext(box);
  vm.runInContext(src, box);
  return box;
}

/** every rule on a set of sources: returns the names of the rules that FAIL (a thrown error is a failure too) */
function failures(src) {
  const bad = [];
  const rule = (name, fn) => { try { if (!fn()) bad.push(name); } catch (e) { bad.push(name + ' (threw: ' + e.message + ')'); } };
  const edit = load(src['app/books-grant-edit.js']).CBBooksGrantEdit;
  const visits = load(src['app/books-grant-visits.js']).CBBooksGrantVisits;
  const asks = load(src['app/books-grant-asks.js']).CBBooksGrantAsks;
  const ids = (costs) => ({ until: '2027-01-01', posting: 'owner_approves', costs });

  rule('a rise in costs sends the choice AND consent', () => { const b = edit.body({ can_see_costs: false }, ids(true)); return b.can_see_costs === true && b.consent === true; });
  rule('a fall in costs sends the choice and NO consent', () => { const b = edit.body({ can_see_costs: true }, ids(false)); return b.can_see_costs === false && !('consent' in b); });
  rule('an unmoved choice sends no costs key (date change only)', () => { const b = edit.body({ can_see_costs: true }, ids(true)); return !('can_see_costs' in b) && !('consent' in b) && b.expires_at === '2027-01-01'; });
  rule('a row that does not say what it shows is never sent can_see_costs:false', () => { const b = edit.body({}, ids(false)); return !('can_see_costs' in b) && !('consent' in b); });
  rule('a row that does not say what it shows sends no costs change when ticked either', () => !('can_see_costs' in edit.body({}, ids(true))));
  rule('rising() is true only for hidden -> shown', () => edit.rising({ can_see_costs: false }, true) === true && edit.rising({ can_see_costs: true }, true) === false && edit.rising({}, true) === false && edit.rising({ can_see_costs: false }, false) === false);
  rule('a 503 and a missing consent are said in words, other failures keep the action sentence', () => {
    const f503 = edit.wording({ code: 'BOOKS_GRANT_NOT_SWITCHED_ON' });
    return /not switched on yet/.test(f503.message) && /costs first/.test(edit.wording({ code: 'BOOKS_GRANT_CONSENT_NEEDED' }).message) && edit.failSaid('Could not save', { code: 'X' }) === 'Could not save' && /not switched on yet/.test(edit.failSaid('Could not save', f503));
  });
  const twin = [{ grant_id: 'g', grantee_entity: 'f', from: 't', to: 't', actor_name: null, pages: 1, refused: 0, pages_list: [] }, { grant_id: 'g', grantee_entity: 'f', from: 't', to: 't', actor_name: null, pages: 2, refused: 0, pages_list: [] }];
  rule('two person-less visits that start together get different row ids', () => { const r = visits.rows({ visits: twin }); return r.length === 2 && r[0].row_id !== r[1].row_id; });
  rule('an older api that sends only looks is shown as visits of one page, a refused look counted', () => {
    const r = visits.rows({ looks: [{ grant_id: 'g', grantee_entity: 'f', at: 'a', route_pattern: 'GET /pl', outcome: 'allowed' }, { grant_id: 'g', grantee_entity: 'f', at: 'b', route_pattern: 'GET /pl', outcome: 'read_only' }] });
    return r.length === 2 && r[0].pages === 1 && r[0].refused === 0 && r[1].refused === 1;
  });
  rule('hostile visit text is escaped in the detail, the person is named after the firm', () => {
    const cfg = visits.config({ nameOf: () => 'Fallback', route: (p) => p, when: String, col: (k, l, a, b, c) => ({ key: k, cell: c }) }, []);
    const v = { actor_entity_name: 'Firm', actor_name: 'Pat', pages_list: [{ route_pattern: '<img src=x onerror=1>', count: 2 }] };
    return !/<img/.test(cfg.next(v)) && /× 2/.test(cfg.next(v)) && cfg.columns[1].cell(v) === 'Firm · Pat';
  });
  rule('the shop asks its firm as the PARENT, the firm asks the shop by bridge id', () => {
    const pick = { bridge_id: 'CB1', user_id: 'acme' }, shop = asks.askBody(pick, 'shop'), firm = asks.askBody(pick, 'firm');
    return shop.parentHandle === 'acme' && !('childBridgeId' in shop) && shop.type === 'agency' && firm.childBridgeId === 'CB1' && !('parentHandle' in firm) && firm.type === 'agency';
  });
  rule('every refusal code of the handoff is a plain sentence; an unknown code keeps the server words', () => {
    const codes = ['EXISTS', 'FIRM_DIRECTION', 'ASK_LIMIT', 'ASK_COOLING_OFF', 'INVITE_LIMIT', 'OWNER_ONLY', 'CHILD_NOT_FOUND', 'PARENT_NOT_FOUND', 'SELF'];
    return codes.every((c) => { const e = asks.refusal({ code: c, message: 'server words' }); return e.message !== 'server words' && e.message.length > 10; }) && asks.refusal({ code: 'ODD', message: 'server words' }).message === 'server words';
  });
  const bellKit = load(src['app/rail-bell-rows.js'], { CBBellKit: {} }).CBBellKit;
  rule('the badge count already holds the waiting requests; the feed count adds them', () => {
    const bell = { rows: [], asks: 2 };
    return bellKit.countOf(bell, { count: 3, asks: 2 }) === 3 && bellKit.countOf(bell, { notifications: [{}], count: 1 }) === 3;
  });
  rule('a badge answer keeps the rows and takes the asks; the feed answer takes the rows', () => {
    const bell = { rows: [{ a: 1 }], asks: 0, loading: true };
    bellKit.take(bell, { count: 4, asks: 3 });
    const kept = bell.rows.length === 1 && bell.asks === 3 && bell.loading === false;
    bellKit.take(bell, { notifications: [{}, {}], count: 0 });
    return kept && bell.rows.length === 2 && bell.asks === 3;
  });
  rule('closed the bell reads the badge, open it reads the feed', () => bellKit.readQuery({ open: false }).query.count === 1 && bellKit.readQuery({ open: true }) === undefined);
  rule('the Network entry is NOT ready until the api half lands, and keeps its ready_for', () => { const e = JSON.parse(src['app/manifest.json']).entries.filter((x) => x.id === 'network')[0]; return e.ready === false && (e.ready_for || []).length > 0 && e.facts === '/api/facts/network'; });
  rule('no owner screen says "network parent"', () => !/network parent/i.test([src['app/books-grant-asks.js'], src['app/books-grant-edit.js'], src['app/books-grant-visits.js'], src['app/books-grant-member.js'].replace(/\/\*[^]*?\*\//g, '').replace(/\/\/.*$/gm, '')].join('\n')));
  rule('the two member tabs do not read alike', () => !/words\('To accept'\)/.test(src['app/books-grant-member.js']) && /words\('Work to approve'\)/.test(src['app/books-grant-member.js']) && /words\('Requests'\)/.test(src['app/books-grant-member.js']));
  return bad;
}

const sources = () => Object.fromEntries(FILES.map((f) => [f, read(f)]));
/** each mutant changes behaviour: [name, file, from, to]; it must turn at least one rule red */
const MUTANTS = [
  ['costs change sent although the row does not say', 'app/books-grant-edit.js', 'grant.can_see_costs !== undefined && ', ''],
  ['an unmoved costs choice is sent', 'app/books-grant-edit.js', '!!ids.costs !== !!grant.can_see_costs', 'true'],
  ['consent sent on every costs change', 'app/books-grant-edit.js', 'if (rising(grant, ids.costs)) out.consent = true;', 'out.consent = true;'],
  ['a rise sends no consent', 'app/books-grant-edit.js', 'if (rising(grant, ids.costs)) out.consent = true;', ''],
  ['rising() counts a fall', 'app/books-grant-edit.js', 'return grant.can_see_costs === false && !!ticked;', 'return !!ticked;'],
  ['the 503 is not said', 'app/books-grant-edit.js', 'Changing what your firm sees is not switched on yet', 'try again'],
  ['visit row ids collide', 'app/books-grant-visits.js', ", index].join('|')", "].join('|')"],
  ['an old api loses its looks', 'app/books-grant-visits.js', "refused: look.outcome === 'allowed' ? 0 : 1", 'refused: 0'],
  ['hostile route text is not escaped', 'app/books-grant-visits.js', 'esc(route(p.route_pattern))', 'route(p.route_pattern)'],
  ['the shop asks its firm as the child', 'app/books-grant-asks.js', "{ parentHandle: pick.user_id || pick.bridge_id, type: 'agency' }", "{ childBridgeId: pick.bridge_id, type: 'agency' }"],
  ['FIRM_DIRECTION loses its sentence', 'app/books-grant-asks.js', '    FIRM_DIRECTION:', '    FIRM_DIRECTIONX:'],
  ['the dot loses the waiting requests', 'app/rail-bell-rows.js', ' + (bell.asks || 0)', ''],
  ['the badge answer wipes the rows', 'app/rail-bell-rows.js', 'if (reply && reply.notifications) bell.rows = reply.notifications;', 'bell.rows = (reply && reply.notifications) || [];'],
  ['closed the bell reads the feed', 'app/rail-bell-rows.js', 'return bell.open ? undefined : { query: { count: 1 } };', 'return undefined;'],
  ['the Network card is flipped to ready', 'app/manifest.json', '"ready": false, "ready_for": ["open="], "what": "Who is in your network', '"ready": true, "what": "Who is in your network'],
  ['both tabs read alike', 'app/books-grant-member.js', "words('Work to approve')", "words('To accept')"]
];

const base = failures(sources());
console.log('  ' + (base.length ? 'FAIL' : 'ok  ') + ' the rules on the real sources: ' + (base.length ? base.join(' | ') : 'all pass'));
let bad = base.length;
if (process.argv.includes('--mutants')) {
  for (const [name, file, from, to] of MUTANTS) {
    const src = sources();
    if (!src[file].includes(from)) { console.log('  FAIL mutant "' + name + '" does not apply (the text moved)'); bad++; continue; }
    src[file] = src[file].replace(from, () => to);
    const red = failures(src);
    console.log('  ' + (red.length ? 'ok  ' : 'FAIL') + ' mutant killed: ' + name + (red.length ? ' (' + red[0] + ')' : ' SURVIVED'));
    if (!red.length) bad++;
  }
}
process.exit(bad ? 1 : 0);
