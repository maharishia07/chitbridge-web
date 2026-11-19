/**
 * assign-bar.js — CBAssign v2 (ASSIGN-W2, 18 Nov): who holds each piece of work and how to change it, the ONE assign pattern for every list that has a holder.
 *
 * OWNS      the Held-by chip (the cell IS the control: press it, pick a person, two presses) · always-on ticks with a persistent bulk bar (Assign to… · Hand over · Back to pool) ·
 *           the person popover (the library popup, ui.dialog CMP002: search, Me, people with their load, optional note) · Undo (the answer's `previous` holders) · keys A (open) and I (take it) ·
 *           the one vocabulary (Held by · Unassigned · Assign to… · Hand over · Back to pool · Mine · Everyone) · the quick views and the filter by person · the one line that says what the server did
 * CALLED BY books-practice.js (CBAssign.mount, chip, bulk, quickViews, heldFilter, slotHTML); any other list whose rows are subjects of a plug (the plug, the row's subject id and the noun come from the caller, nothing here names a trade)
 * FLOW      press a chip, a tick-bar button, or A / I on a row → CBAssign popover → POST /api/chits/assign-bulk (one call per role) → the answer's counts, skip sentences and `previous` → opts.reload() → result line with Undo
 * CARD      01-rail-core-the-chit/assign
 *
 * Decides nothing and computes nothing: who may assign, who may hold, why a client was skipped and every sentence are the server's (may/why, detail, reason). A refusal is shown as the server wrote it.
 * The chip and the bar are SHOWN on the server's verdict only (`may_assign === true`, passed in as opts.said): no token, no role is read. The server still decides every call.
 * No style sheet and no dialog of its own: colours are theme tokens inline, the popover is ui.dialog. Controls: chip HOM001-B20, undo HOM001-B21, person row HOM001-B22, note and search CMP055-I01, popup HOM001-U02 (POP212), result line HOM001-D05.
 */
(function (root) {
  'use strict';
  var assignApi = (root.CBAssign = root.CBAssign || {});
  var ASSIGN_PATH = '/api/chits/assign-bulk', ACTORS_PATH = '/api/actors', HANDOVER_PATH = '/api/chits/hand-over-all', HOLDS_PATH = '/api/chits/holds', MYWORK_PATH = '/api/chits/my-work', UNDO_MS = 30000, MOUNT = 'HOM001-U02';
  var mounts = {}, bound = false, last = null, undoTimer = null, nameById = {};
  function tr(s) { return typeof root.tx === 'function' ? root.tx(s) : s; }
  /** a whole sentence with {placeholders}: never built by joining words */
  function sayText(sentence, vars) {
    var text = tr(sentence);
    Object.keys(vars || {}).forEach(function (name) { text = text.split('{' + name + '}').join(vars[name]); });
    return text;
  }
  function base() {
    try {
      var f = root.localStorage.getItem('cb_api_base');
      if (f) return f === 'stage' ? root.CB_API || '' : f;
    } catch (failure) { if (root.cbQuiet) root.cbQuiet('assign:base', failure); }
    return /^(localhost|127\.0\.0\.1)$/.test(root.location.hostname) ? 'http://localhost:3000' : root.CB_API || '';
  }
  function session() {
    try { return JSON.parse(root.localStorage.getItem('cb_sess') || 'null') || {}; } catch (failure) { if (root.cbQuiet) root.cbQuiet('assign:sess', failure); return {}; }
  }
  /** SHOW only, on the SERVER's verdict (`may_assign` on the practice answer and on GET /api/actors): no token is read. Not a permission: the api refuses a call that is not allowed. Nothing said yet = not shown. */
  assignApi.showsBar = function (said) { return said === true; };
  /** the signed-in person's id as the sign-in stored it (for the Mine view and the I key); '' when the session does not carry one */
  assignApi.meId = function () {
    var s = session();
    return String(s.actor_id || s.identity_id || s.user_id || '');
  };
  /** the holder column as plain markup: the names the server sent, or "Unassigned"; a row with no `holders` key at all (the firm's switch is off) shows nothing */
  assignApi.heldBy = function (row) {
    if (!row || !Array.isArray(row.holders)) return '';
    return row.holders.length ? root.esc(row.holders.map(function (h) { return h.name || ''; }).join(', ')) : '<span style="color:var(--grey,#5B5B5B)">' + root.esc(tr('Unassigned')) + '</span>';
  };
  assignApi.heldByText = function (row) {
    return !row || !Array.isArray(row.holders) ? '' : row.holders.length ? row.holders.map(function (h) { return h.name || ''; }).join(', ') : tr('Unassigned');
  };
  assignApi.hasHolders = function (rows) { return (rows || []).some(function (r) { return Array.isArray(r.holders); }); };

  /* ── the one vocabulary, quick views and the filter by person (L12) ───────────────────────── */
  /** Mine · Unassigned · Everyone: three views over the one `held` filter (list-ctl `views`, merge on) */
  assignApi.quickViews = function () {
    return { merge: true, tid: 'assign-views', items: [
      { key: 'held-mine', label: tr('Mine'), filt: { held: 'mine' } },
      { key: 'held-none', label: tr('Unassigned'), filt: { held: 'none' } },
      { key: 'held-all', label: tr('Everyone'), filt: {} }
    ] };
  };
  /** the `held` filter: Unassigned · Mine · each person who holds something in these rows (the server's holder ids), so "what does Ben hold?" can be asked */
  assignApi.heldFilter = function (rows) {
    var seen = {}, people = [];
    (rows || []).forEach(function (r) { (r.holders || []).forEach(function (h) { if (h.actor_id && !seen[h.actor_id]) { seen[h.actor_id] = 1; people.push([String(h.actor_id), h.name || '']); } }); });
    people.sort(function (a, b) { return a[1].localeCompare(b[1]); });
    return {
      options: [['none', 'Unassigned'], ['mine', 'Mine']].concat(people),
      match: function (r, v) {
        var held = Array.isArray(r.holders) ? r.holders : [];
        if (v === 'none') return Array.isArray(r.holders) && !held.length;
        if (v === 'mine') return !!assignApi.meId() && held.some(function (h) { return String(h.actor_id) === assignApi.meId(); });
        return held.some(function (h) { return String(h.actor_id) === v; });
      }
    };
  };

  function call(method, path, body) {
    return root.fetch(base() + path, { method: method, headers: { Authorization: 'Bearer ' + session().token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
      return r.json().catch(function (failure) { if (root.cbQuiet) root.cbQuiet('assign:json', failure); return {}; }).then(function (j) { return { ok: r.ok, status: r.status, body: j || {} }; });
    });
  }
  /** the server's own sentence for a refusal: the Problem's detail, or the older may/why/message keys (never the page's words) */
  function sentenceOf(j) { return String(j.detail || j.why || j.message || j.error || j.title || ''); }
  function nounOf(opts, n) { return tr(n === 1 ? opts.noun || 'client' : opts.nounMany || (opts.noun || 'client') + 's'); }

  /* ── the line that says what happened, with Undo ──────────────────────────────────────────── */
  function resultStyle(tone) {
    return 'margin:6px 0;padding:8px 12px;border:1px solid ' + (tone === 'bad' ? 'var(--bad,#B42318)' : 'var(--line,#DDD6C6)') + ';border-radius:10px;background:var(--card,#fff);color:var(--ink,#1B1B1B);font-size:14px';
  }
  function slotInner() {
    if (!last) return '';
    var undoButton = last.undo && last.undo.length && Date.now() - last.at < UNDO_MS
      ? ' <button type="button" data-as-undo data-nolist data-cbsid="HOM001-B21" data-cbmount="HOM001-D05" data-testid="assign-undo" style="min-height:44px;padding:0 12px;border:1px solid var(--line,#DDD6C6);border-radius:8px;background:var(--card,#fff);color:inherit;font:inherit;cursor:pointer">' + root.esc(tr('Undo')) + '</button>' : '';
    return '<b>' + root.esc(last.headline) + '</b>' + undoButton + last.lines.map(function (l) { return '<div style="margin-top:2px">' + root.esc(l) + '</div>'; }).join('');
  }
  /** the always-present slot above the list: role=status so the outcome is read out; empty until something was done */
  assignApi.slotHTML = function () {
    return '<div id="as_result" class="as-result" role="status" aria-live="polite" data-testid="assign-result" data-cbsid="HOM001-D05" style="' + resultStyle(last && last.tone) + '"' + (last ? '' : ' hidden') + '>' + slotInner() + '</div>';
  };
  function paintOutcome() {
    var host = root.document.getElementById('as_result');
    if (host) { host.setAttribute('style', resultStyle(last && last.tone)); host.hidden = !last; host.innerHTML = slotInner(); }
  }
  function showOutcome(tone, headline, lines, undoGroups) {
    last = { tone: tone, headline: headline, lines: lines || [], undo: undoGroups || [], at: Date.now() };
    paintOutcome();
    if (undoGroups && undoGroups.length) {
      if (undoTimer) root.clearTimeout(undoTimer);
      undoTimer = root.setTimeout(paintOutcome, UNDO_MS + 50); /* the Undo button goes after 30 seconds */
    }
  }
  /** skip items grouped by the server's sentence: "3 · No job is open for this client and role." */
  function skipLines(skipped) {
    var by = {}, order = [];
    (skipped || []).forEach(function (s) { var k = String(s.reason || s.code || ''); if (!(k in by)) { by[k] = 0; order.push(k); } by[k]++; });
    return order.map(function (k) { return by[k] + ' · ' + k; });
  }

  /* ── the people ───────────────────────────────────────────────────────────────────────────── */
  /** the id of one api actor row */
  function actorIdOf(a) { return a.actor_id || a.identity_id || a.id; }
  /** whether the signed-in person is this api actor row */
  function isMeActor(a, id, mine) { return a.is_me === true || a.self === true || (!!mine && String(id) === mine); }
  /** one api actor row as the popover lists it ({ id, name, holds, suggested, me }); the name is remembered for the result lines */
  function personOf(a, body, mine) {
    var person = { id: actorIdOf(a), name: a.display_name || a.name || '', holds: typeof a.open_load === 'number' ? a.open_load : null, suggested: a.suggested === true || (!!body.suggested && body.suggested === actorIdOf(a)) };
    person.me = isMeActor(a, person.id, mine);
    nameById[person.id] = person.name;
    return person;
  }
  /** the people who may hold this kind of work, as the server flags them (job_assignable), with `open_load` and the ONE `suggested` person (GET /api/actors?for=plug:subject, one client only: a mixed bulk asks for no suggestion and pre-picks nobody, A5); the page filters on the flag and never on a hat */
  function people(forWord, flag) {
    return call('GET', ACTORS_PATH + (forWord ? '?for=' + encodeURIComponent(forWord) : '')).then(function (reply) {
      if (!reply.ok) return { error: sentenceOf(reply.body) || tr('People did not load.'), list: [] };
      var mine = assignApi.meId();
      var rows = reply.body.actors || reply.body.items || [], key = flag || 'job_assignable';
      var list = rows.filter(function (a) { return a[key] === true; }).map(function (a) { return personOf(a, reply.body, mine); });
      /* W7: a view-only person holds nothing (rule A5, the server's flag stays false); they are NAMED, never silently missing. Words only: the server's reason (assign_blocked: 'view_only', api #1378) picks the sentence, it decides nothing. */
      var viewOnly = rows.filter(function (a) { return a[key] !== true && a.assign_blocked === 'view_only'; }).map(function (a) { return a.display_name || a.name || ''; }).filter(Boolean);
      return { list: list, viewOnly: viewOnly };
    });
  }
  function personRow(p, label) {
    return '<button type="button" data-as-pick="' + root.esc(p.id) + '" data-as-name="' + root.esc(p.name) + '" data-cbsid="HOM001-B22" data-cbmount="' + MOUNT + '" data-testid="assign-person-' + root.esc(p.id) + '" style="display:flex;justify-content:space-between;gap:8px;width:100%;min-height:44px;align-items:center;text-align:start;padding:6px 10px;margin:0 0 4px;border:1px solid var(--line,#DDD6C6);border-radius:8px;background:var(--card,#fff);color:inherit;font:inherit;cursor:pointer"><span>' +
      root.esc(label || p.name) + '</span>' + (p.holds != null ? '<span style="color:var(--grey,#5B5B5B)">' + root.esc((p.suggested ? tr('Suggested') + ' · ' : '') + sayText('holds {n}', { n: p.holds })) + '</span>' : (p.suggested ? '<span style="color:var(--grey,#5B5B5B)">' + root.esc(tr('Suggested')) + '</span>' : '')) + '</button>';
  }
  /** the popover body: search · Me · the people (with their load) · Back to pool · the optional note */
  function popoverBody(roster, spec) {
    var me = roster.list.filter(function (p) { return p.me; })[0];
    var head = (roster.error ? '<div style="color:var(--bad,#B42318);font-size:13px" data-testid="assign-picker-err">' + root.esc(roster.error) + '</div>' : '') +
      '<input type="search" data-cbsid="CMP055-I01" data-cbmount="' + MOUNT + '" data-testid="assign-search" aria-label="' + root.esc(tr('Search people')) + '" placeholder="' + root.esc(tr('Search people')) + '" style="width:100%;min-height:44px;font:inherit;padding:6px 8px;border:1px solid var(--line,#DDD6C6);border-radius:8px;background:var(--card,#fff);color:inherit">';
    var list = '<div data-as-people style="display:flex;flex-direction:column;margin-top:8px">' + (me && !me.suggested ? personRow(me, tr('Me') + ' · ' + me.name) : '') + roster.list.filter(function (p) { return !p.me || p.suggested; }).sort(function (a, b) { return (b.suggested ? 1 : 0) - (a.suggested ? 1 : 0); }).map(function (p) { return personRow(p); }).join('') + '</div>';
    var pool = spec.held ? '<button type="button" data-as-pool data-cbsid="HOM001-B22" data-cbmount="' + MOUNT + '" data-testid="assign-pool" style="width:100%;min-height:44px;padding:6px 10px;border:1px solid var(--line,#DDD6C6);border-radius:8px;background:var(--card,#fff);color:inherit;font:inherit;cursor:pointer">' + root.esc(tr('Back to pool')) + '</button>' : '';
    var note = '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;margin-top:8px">' + root.esc(tr('Note (optional)')) + '<input data-cbsid="CMP055-I01" data-cbmount="' + MOUNT + '" data-testid="assign-note" maxlength="200" type="text" style="min-height:44px;font:inherit;padding:6px 8px;border:1px solid var(--line,#DDD6C6);border-radius:8px;background:var(--card,#fff);color:inherit"></label>';
    return head + list + whyNot(roster) + pool + note;
  }
  /** W3 · W7: what the list does not show, in words: no one at all (with the way to add a person), and each view-only person with what to change */
  function whyNot(roster) {
    if (roster.error) return '';
    var out = '';
    if (!roster.list.length) {
      var where = root.CBPractice && typeof root.CBPractice.isFirm === 'function' && root.CBPractice.isFirm() ? 'No one in your practice yet' : 'No one in your team yet';
      out += '<div data-testid="assign-empty" style="margin-top:8px;font-size:14px">' + root.esc(tr(where)) + ' — <a href="/employees.html" data-cbsid="HOM001-C01" data-cbmount="' + MOUNT + '" data-testid="assign-add-person" style="color:var(--accent,#1F5F5B);font-weight:600">' + root.esc(tr('Add a person')) + '</a></div>';
    }
    (roster.viewOnly || []).forEach(function (name) {
      out += '<div data-testid="assign-viewonly" style="margin-top:6px;font-size:13px;color:var(--grey,#5B5B5B)">' + root.esc(sayText('{name} is view-only — change what they can do to assign', { name: name })) + '</div>';
    });
    return out;
  }
  /** wire the opened popup: the search narrows the people in place; a person (or Back to pool) is the whole answer */
  function wirePopover(done) {
    /* W8: the body that HOLDS this list, found from the list itself: the first .mbody on the page can be another open sheet's, and a click handler left on that one never hears a person pressed */
    var mine = root.document.querySelector('[data-as-people]');
    var body = (mine && mine.closest && mine.closest('.mbody')) || (mine && mine.parentNode) || root.document.querySelector('#modalhost .mbody, dialog[open] .mbody');
    if (!body) return;
    var search = body.querySelector('[data-testid="assign-search"]'), note = body.querySelector('[data-testid="assign-note"]');
    if (search) search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      [].forEach.call(body.querySelectorAll('[data-as-pick]'), function (b) { b.hidden = !!q && (b.getAttribute('data-as-name') || '').toLowerCase().indexOf(q) < 0; });
    });
    body.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-as-pick],[data-as-pool]');
      if (!b) return;
      var value = { id: b.hasAttribute('data-as-pool') ? null : b.getAttribute('data-as-pick'), note: note ? note.value.trim() : '' };
      try { if (typeof root.closeModal === 'function') root.closeModal(); done(value); } catch (failure) { /* an error here left the popup open and said nothing (W8): say it */
        if (root.cbQuiet) root.cbQuiet('assign:pick', failure);
        showOutcome('bad', tr('Not done.'), []);
      }
    });
  }
  /** open the person popover (ui.dialog, the library popup) → done({ id|null, note }) on a press; nothing when it is cancelled. spec: { title, held (some row has a holder) } */
  function pick(spec, done) {
    if (!root.ui || typeof root.ui.dialog !== 'function' || typeof root.modal !== 'function') return showOutcome('bad', tr('The list of people cannot open on this page.'), []);
    if (typeof spec.before === 'function') spec.before(); /* opts.beforePick: a page whose record sits in a modal <dialog> closes it first (a popup cannot open over it) */
    people(spec.forWord, spec.flag).then(function (roster) {
      root.ui.dialog({
        mount: MOUNT, pop: 'POP212', titleText: tr(spec.title), testid: 'assign-picker',
        body: popoverBody(roster, spec),
        actions: [{ name: 'cancel', options: { mount: 'HOM001-U03' } }]
      });
      wirePopover(done);
    });
  }

  /* ── the calls ────────────────────────────────────────────────────────────────────────────── */
  function byRole(rows, roleOf) {
    var out = {}, order = [];
    rows.forEach(function (r) { var k = roleOf(r); if (!(k in out)) { out[k] = []; order.push(k); } out[k].push(r); });
    return order.map(function (k) { return { role: k, rows: out[k] }; });
  }
  /** what an Undo puts back: the holders the server says were there before, grouped by (role, previous holder) */
  function undoOf(plug, role, previous, write) {
    var by = {}, order = [];
    (previous || []).forEach(function (p) {
      if (!p.subject_id) return;
      var k = String(p.actor_id || '');
      if (!(k in by)) { by[k] = { plug: plug, role: role, actor_id: p.actor_id || null, subject_ids: [], write: write }; order.push(k); }
      by[k].subject_ids.push(p.subject_id);
    });
    return order.map(function (k) { return by[k]; });
  }
  /** "Was held by Ben Ortiz.": a replace says so */
  function replacedLine(names) {
    var named = names.filter(function (n, i) { return n && names.indexOf(n) === i; });
    return named.length ? [sayText('Was held by {names}.', { names: named.join(', ') })] : [];
  }
  /** one call per role (the api takes one role per call); counts, skip sentences and previous holders are added; the first refusal stops the run and its sentence is shown */
  function runCalls(opts, rows, target, note, wordsFor) {
    var sum = { done: 0, skipped: [], refused: null, undo: [], before: [] };
    return byRole(rows, opts.roleOf).reduce(function (chain, group) {
      return chain.then(function () {
        if (sum.refused) return null;
        var body = { plug: opts.plug, role: group.role, subject_ids: group.rows.map(function (r) { return opts.subjectOf(r); }), target_actor_id: target };
        if (note) body.note = note;
        /* opts.write: a plug whose rows are not chits (CRM follow-ups) is written by its own route; it answers like assign-bulk: { ok, sentence?, assigned, skipped, previous[{subject_id, actor_id}] } */
        return (opts.write ? opts.write(body.subject_ids, target, note) : call('POST', ASSIGN_PATH, body)).then(function (r) {
          if (opts.write) r = { ok: r.ok !== false, body: { assigned: r.assigned, skipped: r.skipped, previous: r.previous, detail: r.sentence } };
          if (!r.ok) { sum.refused = sentenceOf(r.body) || tr('Not done.'); return null; }
          sum.done += Number(r.body.assigned) || 0;
          sum.skipped = sum.skipped.concat(r.body.skipped || []);
          sum.undo = sum.undo.concat(undoOf(opts.plug, group.role, r.body.previous, opts.write));
          (r.body.previous || []).forEach(function (p) { if (p.actor_id && p.actor_id !== target) sum.before.push(nameById[p.actor_id] || ''); });
        });
      });
    }, root.Promise.resolve()).then(function () {
      if (sum.refused) showOutcome('bad', sum.refused, []);
      else showOutcome(sum.skipped.length && !sum.done ? 'bad' : 'good', wordsFor(sum.done), skipLines(sum.skipped).concat(replacedLine(sum.before)), sum.undo);
      if (opts.listKey && root.CBList && root.CBList.reset) root.CBList.reset(opts.listKey, true); /* W11: the ticks go after every assign; the search and filters stay */
      if (last) last.reload = opts.reload;
      return opts.reload ? opts.reload() : null;
    });
  }
  /**
   * CBAssign.queue(q) → the options a list merges into its CBList.mount: THE WORK-QUEUE CAPABILITY (Athi 19 Nov: "the capability, so we can use it anywhere"). q = the assign options (plug · noun · nounMany · subjectOf · roleOf · said · reload · write? · heldOf? · flag?)
   * + { key: the list's key (its ticks are cleared after every assign, hand-over or back to pool: W11), rows (each with `holders`), everyone: the server's verdict that this seat sees every row (the owner, a manager) }.
   * → { views (Mine · Unassigned · Everyone), bulk (Assign to me · Assign to… · Hand over · Back to pool), bulkAlways, preset (the opening view: Mine for a seat that holds work or may not assign, Everyone otherwise), filter (the Held by filter, list shape) }; {} when no row carries holders.
   * Nothing here names a trade: the noun, the door (plug / write) and the rows come from the screen. */
  assignApi.queue = function (q) {
    var rows = q.rows || [], me = assignApi.meId(), held = assignApi.heldFilter(rows);
    if (!assignApi.hasHolders(rows)) return {};
    var holds = !!me && rows.some(function (r) { return held.match(r, 'mine'); });
    return { views: assignApi.quickViews(), bulk: assignApi.bulk(Object.assign({ listKey: q.key }, q)), bulkAlways: assignApi.showsBar(q.said), preset: { filt: me && (holds || !q.everyone) ? { held: 'mine' } : {} },
      filter: { key: 'held', label: tr('Held by'), all: tr('Anyone'), options: held.options.map(function (o) { return { v: o[0], label: tr(o[1]) }; }), match: held.match } };
  };
  /** Undo: one more assign-bulk call per (role, previous holder), using the holders the server returned */
  function undo() {
    var groups = last && last.undo ? last.undo : [], reload = last && last.reload;
    if (!groups.length) return null;
    var refused = null;
    return groups.reduce(function (chain, g) {
      return chain.then(function () {
        if (refused) return null;
        var put = g.write ? g.write(g.subject_ids, g.actor_id, '').then(function (r) { return { ok: r.ok !== false, body: { detail: r.sentence } }; }) : call('POST', ASSIGN_PATH, { plug: g.plug, role: g.role, subject_ids: g.subject_ids, target_actor_id: g.actor_id });
        return put.then(function (r) { if (!r.ok) refused = sentenceOf(r.body) || tr('Not done.'); });
      });
    }, root.Promise.resolve()).then(function () {
      showOutcome(refused ? 'bad' : 'good', refused || tr('Undone.'), []);
      return reload ? reload() : null;
    });
  }
  /** assign these rows to `who` ({ id|null, note }), through the one verb: a person, or the pool when id is null */
  function apply(opts, rows, holder) {
    var name = holder.id ? nameById[holder.id] || '' : '';
    var words = holder.id
      ? function (n) { return sayText('{n} {noun} assigned to {who}.', { n: n, noun: nounOf(opts, n), who: name }); }
      : function (n) { return sayText('{n} {noun} back in the pool.', { n: n, noun: nounOf(opts, n) }); };
    return runCalls(opts, rows, holder.id, holder.note, words);
  }
  function heldOf(opts) { return opts.heldOf || function (r) { return Array.isArray(r.holders) && r.holders.length > 0; }; }

  /**
   * CBAssign.bulk(opts) → the list's `bulk` array (the CMP037-B04 buttons), or [] when the bar is not shown to this person.
   * opts: { plug, noun, nounMany?, subjectOf(row), roleOf(row), reload(), said (a server verdict), heldOf? (row → bool: has a holder) }
   */
  assignApi.bulk = function (opts) {
    if (!assignApi.showsBar(opts.said)) return [];
    assignApi.mount(opts);
    var held = heldOf(opts);
    return [
      { id: 'me', label: tr('Assign to me'), run: function (rows) { takeFor(opts, rows); } },
      { id: 'assign', label: tr('Assign to…'), run: function (rows) {
        pick({ title: 'Assign to…', held: rows.some(held), flag: opts.flag }, function (holder) { apply(opts, rows, holder); });
      } },
      { id: 'handover', label: tr('Hand over'), run: function (rows) {
        var holding = rows.filter(held);
        if (!holding.length) return showOutcome('bad', tr('Nothing ticked has a holder to hand over from.'), []);
        pick({ title: 'Hand over to', held: true, flag: opts.flag }, function (holder) { apply(opts, holding, holder); });
      } },
      { id: 'pool', label: tr('Back to pool'), run: function (rows) {
        var holding = rows.filter(held);
        if (!holding.length) return showOutcome('bad', tr('Nothing ticked has a holder to take back.'), []);
        return apply(opts, holding, { id: null, note: '' });
      } }
    ];
  };

  /* ── Hand over all (L11): everything one person holds, to another person or back to the pool ───────────── */
  /** the Undo groups of a hand-over-all answer: only chit entries can be put back through assign-bulk; ONE follow-up entry (no undo route yet) means no Undo at all */
  function handOverUndo(previous) {
    var list = previous || [];
    if (!list.length || list.some(function (p) { return !p.chit_id; })) return [];
    var by = {}, order = [];
    list.forEach(function (p) {
      var k = (p.plug || '') + '|' + (p.role || '') + '|' + (p.actor_id || '');
      if (!(k in by)) { by[k] = { plug: p.plug, role: p.role || '', actor_id: p.actor_id || null, subject_ids: [] }; order.push(k); }
      by[k].subject_ids.push(p.subject_id || p.chit_id);
    });
    return order.map(function (k) { return by[k]; });
  }
  /**
   * CBAssign.handOverAll({ fromId, reload }) → the person popover, then POST /api/chits/hand-over-all { from_actor_id, to_actor_id|null, note }; the one result line says what moved,
   * names every skip with the server's sentence, and offers Undo only when every previous entry is a chit. Nothing is decided here: the server answers who may.
   */
  /** one line per skipped entry: its name and the server's reason */
  function handOverLines(skipped) { return skipped.map(function (s) { return (s.name ? s.name + ' · ' : '') + String(s.reason || s.code || ''); }); }
  /** the headline of a hand-over: how many moved, to whom or back to the pool */
  function handOverHead(holder, moved) {
    return holder.id ? sayText('{n} moved to {who}.', { n: moved, who: nameById[holder.id] || '' }) : sayText('{n} back in the pool.', { n: moved });
  }
  /** the result line of a hand-over: what moved, every skip in the server's words, Undo when it can; then the page reloads */
  function handOverResult(r, holder, opts) {
    if (!r.ok) return showOutcome('bad', sentenceOf(r.body) || tr('Not done.'), []);
    var moved = Number(r.body.moved) || 0, skipped = r.body.skipped || [];
    showOutcome(skipped.length && !moved ? 'bad' : 'good', handOverHead(holder, moved), handOverLines(skipped), handOverUndo(r.body.previous));
    if (last) last.reload = opts.reload;
    return opts.reload ? opts.reload() : null;
  }
  assignApi.handOverAll = function (opts) {
    if (!opts || !opts.fromId) return null;
    pick({ title: 'Hand over all to', held: true }, function (holder) {
      call('POST', HANDOVER_PATH, { from_actor_id: opts.fromId, to_actor_id: holder.id || null, note: holder.note || undefined }).then(function (r) { return handOverResult(r, holder, opts); });
    });
    return true;
  };
  /** the people who may hold this kind of work, as the popover lists them: [{ id, name, holds, suggested, me }] (flag: the server's flag to filter on, default job_assignable) */
  assignApi.roster = function (flag) { return people(undefined, flag).then(function (r) { return r.list; }); };
  /** GET /api/chits/my-work → { total, plugs[{plug,count}], rows[] }, or null when it cannot be read (the caller says so in words) */
  assignApi.myWork = function (limit) {
    return call('GET', MYWORK_PATH + (limit ? '?limit=' + encodeURIComponent(limit) : '')).then(function (r) { return r.ok ? r.body : null; });
  };
  /** GET /api/chits/holds → { people: [{actor_id,name,total,followups,plugs[]}] } for the Holds column, or { people: null, why } with the server's sentence when this person may not read it */
  assignApi.holds = function () {
    return call('GET', HOLDS_PATH).then(function (r) { return r.ok && Array.isArray(r.body.people) ? { people: r.body.people, why: '' } : { people: null, why: sentenceOf(r.body) }; });
  };

  /**
   * CBAssign.assign(opts, rows) → the person popover for these rows, from a page that has its own row buttons (the workshop's 👤): opts as for bulk (plug, noun, subjectOf, roleOf, reload),
   * the server answers who may (no `said` is read here: the press is the person's own). One row = that subject's suggestion and load; several = no suggestion.
   */
  assignApi.assign = function (opts, rows) {
    if (!opts || !opts.plug || !rows || !rows.length) return null;
    assignApi.mount(opts);
    var held = heldOf(opts);
    pick({ title: 'Assign to…', held: rows.some(held), forWord: rows.length === 1 ? opts.plug + ':' + opts.subjectOf(rows[0]) : undefined, before: opts.beforePick, flag: opts.flag }, function (holder) { apply(opts, rows, holder); });
    return true;
  };

  /* ── the Held-by chip: the cell is the control ────────────────────────────────────────────── */
  /** the Held-by cell: a button (the name, or "+ Assign to…" when nobody holds it) when the server says this person may assign; the plain words otherwise. opts as for bulk */
  assignApi.chip = function (row, opts) {
    if (!row || !Array.isArray(row.holders)) return '';
    if (!assignApi.showsBar(opts && opts.said)) return assignApi.heldBy(row);
    assignApi.mount(opts);
    var empty = !row.holders.length, holderNames = row.holders.map(function (h) { return h.name || ''; }).join(', ');
    var label = empty ? tr('Unassigned') + '. ' + tr('Assign to…') : tr('Held by') + ' ' + holderNames + '. ' + tr('Assign to…');
    return '<button type="button" data-as-chip data-nolist data-as-plug="' + root.esc(opts.plug) + '" data-as-sub="' + root.esc(opts.subjectOf(row)) + '" data-as-role="' + root.esc(opts.roleOf(row)) + '" data-as-held="' + (empty ? '0' : '1') + '"' +
      ' data-cbsid="HOM001-B20" data-cbmount="HOM001-D05" data-testid="assign-chip" aria-haspopup="dialog" aria-label="' + root.esc(label) + '"' +
      ' style="max-width:100%;min-height:32px;padding:2px 10px;border:1px ' + (empty ? 'dashed' : 'solid') + ' var(--line,#DDD6C6);border-radius:999px;background:var(--card,#fff);color:' + (empty ? 'var(--grey,#5B5B5B)' : 'inherit') + ';font:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer">' +
      root.esc(empty ? '+ ' + tr('Assign to…') : holderNames + ' ▾') + '</button>';
  };
  /**
   * the Held-by cell as PLAIN TEXT (Athi 19 Nov: no button on every row): the holder's name, or a quiet dash when nobody holds it. Assigning is the tick-bar's one "Assign to…"; the A and I keys still
   * find the row through the data-as-* facts this cell carries (shown only on the server's verdict, like the chip). opts as for bulk
   */
  assignApi.heldCell = function (row, opts) {
    if (!row || !Array.isArray(row.holders)) return '';
    var names = row.holders.map(function (h) { return h.name || ''; }).join(', ');
    var text = names ? root.esc(names) : '<span style="color:var(--grey,#5B5B5B)" aria-label="' + root.esc(tr('Unassigned')) + '">—</span>';
    if (!assignApi.showsBar(opts && opts.said)) return text;
    assignApi.mount(opts);
    return '<span data-as-cell data-as-plug="' + root.esc(opts.plug) + '" data-as-sub="' + root.esc(opts.subjectOf(row)) + '" data-as-role="' + root.esc(opts.roleOf(row)) + '" data-as-held="' + (names ? '1' : '0') + '" data-testid="assign-held">' + text + '</span>';
  };
  /** the row a chip stands for, in the shape the calls read (subject, role, whether it has a holder) */
  function chipRow(chip) {
    var held = chip.getAttribute('data-as-held') === '1';
    return { sid: chip.getAttribute('data-as-sub'), role: chip.getAttribute('data-as-role'), held: held, holders: held ? [{}] : [] };
  }
  function oneRowOpts(opts) { return Object.assign({}, opts, { subjectOf: function (r) { return r.sid; }, roleOf: function (r) { return r.role; } }); }
  function openChip(chip) {
    var opts = mounts[chip.getAttribute('data-as-plug')], row = chipRow(chip);
    if (!opts) return;
    pick({ title: 'Assign to…', held: row.held, forWord: opts.write ? undefined : opts.plug + ':' + row.sid, before: opts.beforePick, flag: opts.flag }, function (holder) { apply(oneRowOpts(opts), [row], holder); });
  }
  /** Assign to me (the bar) and the I key (a row): take these rows, when the person is among the people the server lets hold this work; the server still says yes or why not */
  function takeFor(opts, rows) {
    return people(undefined, opts.flag).then(function (roster) {
      var me = roster.list.filter(function (p) { return p.me; })[0];
      if (!me) return showOutcome('bad', tr('You cannot take this one.'), []);
      return apply(opts, rows, { id: me.id, note: '' });
    });
  }
  function takeChip(chip) {
    var opts = mounts[chip.getAttribute('data-as-plug')];
    if (opts) takeFor(oneRowOpts(opts), [chipRow(chip)]);
  }
  function typingIn(node) { return !!(node && node.closest && node.closest('input,select,textarea,[contenteditable],#modalhost,dialog')); }
  /** whether a key press is not the assign shortcut (a modifier is held, another key, or the person is typing) */
  function notShortcut(ev, key) { return ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || (key !== 'a' && key !== 'i') || typingIn(ev.target); }
  function onKey(ev) {
    var key = String(ev.key || '').toLowerCase();
    if (notShortcut(ev, key)) return;
    var row = ev.target && ev.target.closest && ev.target.closest('[data-row]'), chip = row && row.querySelector('[data-as-chip],[data-as-cell]');
    if (!chip) return;
    ev.preventDefault();
    if (key === 'a') openChip(chip); else takeChip(chip);
  }
  function onClick(ev) {
    var node = ev.target && ev.target.closest ? ev.target : null;
    var chip = node && node.closest('[data-as-chip]');
    if (chip) { ev.stopPropagation(); return openChip(chip); }
    if (node && node.closest('[data-as-undo]')) undo();
  }
  /** register a list's plug (the chip and the keys find their options by it) and bind the page-level listeners once */
  assignApi.mount = function (opts) {
    if (!opts || !opts.plug) return;
    mounts[opts.plug] = opts;
    if (bound || !root.document || !root.document.addEventListener) return;
    bound = true;
    root.document.addEventListener('click', onClick, true);
    root.document.addEventListener('keydown', onKey);
  };
})(typeof window !== 'undefined' ? window : globalThis);
