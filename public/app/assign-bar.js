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
  var ASSIGN_PATH = '/api/chits/assign-bulk', ACTORS_PATH = '/api/actors', UNDO_MS = 30000, MOUNT = 'HOM001-U02';
  var mounts = {}, bound = false, last = null, undoTimer = null, nameById = {};
  function tr(s) { return typeof root.tx === 'function' ? root.tx(s) : s; }
  /** a whole sentence with {placeholders}: never built by joining words */
  function say(sentence, vars) {
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
  /** the people who may hold this kind of work, as the server flags them (job_assignable) with their open load when it sends one; the page filters on the flag and never on a hat */
  function people() {
    return call('GET', ACTORS_PATH).then(function (r) {
      if (!r.ok) return { error: sentenceOf(r.body) || tr('People did not load.'), list: [] };
      var mine = assignApi.meId();
      var list = (r.body.actors || r.body.items || []).filter(function (a) { return a.job_assignable === true; }).map(function (a) {
        var person = { id: a.actor_id || a.identity_id || a.id, name: a.display_name || a.name || '', holds: typeof a.holds === 'number' ? a.holds : null };
        person.me = a.is_me === true || a.self === true || (!!mine && String(person.id) === mine);
        nameById[person.id] = person.name;
        return person;
      });
      return { list: list };
    });
  }
  function personRow(p, label) {
    return '<button type="button" data-as-pick="' + root.esc(p.id) + '" data-as-name="' + root.esc(p.name) + '" data-cbsid="HOM001-B22" data-cbmount="' + MOUNT + '" data-testid="assign-person-' + root.esc(p.id) + '" style="display:flex;justify-content:space-between;gap:8px;width:100%;min-height:44px;align-items:center;text-align:start;padding:6px 10px;margin:0 0 4px;border:1px solid var(--line,#DDD6C6);border-radius:8px;background:var(--card,#fff);color:inherit;font:inherit;cursor:pointer"><span>' +
      root.esc(label || p.name) + '</span>' + (p.holds == null ? '' : '<span style="color:var(--grey,#5B5B5B)">' + root.esc(say('holds {n}', { n: p.holds })) + '</span>') + '</button>';
  }
  /** the popover body: search · Me · the people (with their load) · Back to pool · the optional note */
  function popoverBody(roster, spec) {
    var me = roster.list.filter(function (p) { return p.me; })[0];
    var head = (roster.error ? '<div style="color:var(--bad,#B42318);font-size:13px" data-testid="assign-picker-err">' + root.esc(roster.error) + '</div>' : '') +
      '<input type="search" data-cbsid="CMP055-I01" data-cbmount="' + MOUNT + '" data-testid="assign-search" aria-label="' + root.esc(tr('Search people')) + '" placeholder="' + root.esc(tr('Search people')) + '" style="width:100%;min-height:44px;font:inherit;padding:6px 8px;border:1px solid var(--line,#DDD6C6);border-radius:8px;background:var(--card,#fff);color:inherit">';
    var list = '<div data-as-people style="display:flex;flex-direction:column;margin-top:8px">' + (me ? personRow(me, tr('Me') + ' · ' + me.name) : '') + roster.list.filter(function (p) { return !p.me; }).map(function (p) { return personRow(p); }).join('') + '</div>';
    var pool = spec.held ? '<button type="button" data-as-pool data-cbsid="HOM001-B22" data-cbmount="' + MOUNT + '" data-testid="assign-pool" style="width:100%;min-height:44px;padding:6px 10px;border:1px solid var(--line,#DDD6C6);border-radius:8px;background:var(--card,#fff);color:inherit;font:inherit;cursor:pointer">' + root.esc(tr('Back to pool')) + '</button>' : '';
    var note = '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;margin-top:8px">' + root.esc(tr('Note (optional)')) + '<input data-cbsid="CMP055-I01" data-cbmount="' + MOUNT + '" data-testid="assign-note" maxlength="200" type="text" style="min-height:44px;font:inherit;padding:6px 8px;border:1px solid var(--line,#DDD6C6);border-radius:8px;background:var(--card,#fff);color:inherit"></label>';
    return head + list + pool + note;
  }
  /** wire the opened popup: the search narrows the people in place; a person (or Back to pool) is the whole answer */
  function wirePopover(done) {
    var body = root.document.querySelector('#modalhost .mbody, dialog[open] .mbody');
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
      if (typeof root.closeModal === 'function') root.closeModal();
      done(value);
    });
  }
  /** open the person popover (ui.dialog, the library popup) → done({ id|null, note }) on a press; nothing when it is cancelled. spec: { title, held (some row has a holder) } */
  function pick(spec, done) {
    if (!root.ui || typeof root.ui.dialog !== 'function' || typeof root.modal !== 'function') return showOutcome('bad', tr('The list of people cannot open on this page.'), []);
    people().then(function (roster) {
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
  function undoOf(plug, role, previous) {
    var by = {}, order = [];
    (previous || []).forEach(function (p) {
      if (!p.subject_id) return;
      var k = String(p.actor_id || '');
      if (!(k in by)) { by[k] = { plug: plug, role: role, actor_id: p.actor_id || null, subject_ids: [] }; order.push(k); }
      by[k].subject_ids.push(p.subject_id);
    });
    return order.map(function (k) { return by[k]; });
  }
  /** "Was held by Ben Ortiz.": a replace says so */
  function replacedLine(names) {
    var named = names.filter(function (n, i) { return n && names.indexOf(n) === i; });
    return named.length ? [say('Was held by {names}.', { names: named.join(', ') })] : [];
  }
  /** one call per role (the api takes one role per call); counts, skip sentences and previous holders are added; the first refusal stops the run and its sentence is shown */
  function runCalls(opts, rows, target, note, wordsFor) {
    var sum = { done: 0, skipped: [], refused: null, undo: [], before: [] };
    return byRole(rows, opts.roleOf).reduce(function (chain, group) {
      return chain.then(function () {
        if (sum.refused) return null;
        var body = { plug: opts.plug, role: group.role, subject_ids: group.rows.map(function (r) { return opts.subjectOf(r); }), target_actor_id: target };
        if (note) body.note = note;
        return call('POST', ASSIGN_PATH, body).then(function (r) {
          if (!r.ok) { sum.refused = sentenceOf(r.body) || tr('Not done.'); return null; }
          sum.done += Number(r.body.assigned) || 0;
          sum.skipped = sum.skipped.concat(r.body.skipped || []);
          sum.undo = sum.undo.concat(undoOf(opts.plug, group.role, r.body.previous));
          (r.body.previous || []).forEach(function (p) { if (p.actor_id && p.actor_id !== target) sum.before.push(nameById[p.actor_id] || ''); });
        });
      });
    }, root.Promise.resolve()).then(function () {
      if (sum.refused) showOutcome('bad', sum.refused, []);
      else showOutcome(sum.skipped.length && !sum.done ? 'bad' : 'good', wordsFor(sum.done), skipLines(sum.skipped).concat(replacedLine(sum.before)), sum.undo);
      if (last) last.reload = opts.reload;
      return opts.reload ? opts.reload() : null;
    });
  }
  /** Undo: one more assign-bulk call per (role, previous holder), using the holders the server returned */
  function undo() {
    var groups = last && last.undo ? last.undo : [], reload = last && last.reload;
    if (!groups.length) return null;
    var refused = null;
    return groups.reduce(function (chain, g) {
      return chain.then(function () {
        if (refused) return null;
        return call('POST', ASSIGN_PATH, { plug: g.plug, role: g.role, subject_ids: g.subject_ids, target_actor_id: g.actor_id }).then(function (r) { if (!r.ok) refused = sentenceOf(r.body) || tr('Not done.'); });
      });
    }, root.Promise.resolve()).then(function () {
      showOutcome(refused ? 'bad' : 'good', refused || tr('Undone.'), []);
      return reload ? reload() : null;
    });
  }
  /** assign these rows to `who` ({ id|null, note }), through the one verb: a person, or the pool when id is null */
  function apply(opts, rows, who) {
    var name = who.id ? nameById[who.id] || '' : '';
    var words = who.id
      ? function (n) { return say('{n} {noun} assigned to {who}.', { n: n, noun: nounOf(opts, n), who: name }); }
      : function (n) { return say('{n} {noun} back in the pool.', { n: n, noun: nounOf(opts, n) }); };
    return runCalls(opts, rows, who.id, who.note, words);
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
      { id: 'assign', label: tr('Assign to…'), run: function (rows) {
        pick({ title: 'Assign to…', held: rows.some(held) }, function (who) { apply(opts, rows, who); });
      } },
      { id: 'handover', label: tr('Hand over'), run: function (rows) {
        var holding = rows.filter(held);
        if (!holding.length) return showOutcome('bad', tr('Nothing ticked has a holder to hand over from.'), []);
        pick({ title: 'Hand over to', held: true }, function (who) { apply(opts, holding, who); });
      } },
      { id: 'pool', label: tr('Back to pool'), run: function (rows) {
        var holding = rows.filter(held);
        if (!holding.length) return showOutcome('bad', tr('Nothing ticked has a holder to take back.'), []);
        return apply(opts, holding, { id: null, note: '' });
      } }
    ];
  };

  /* ── the Held-by chip: the cell is the control ────────────────────────────────────────────── */
  /** the Held-by cell: a button (the name, or "+ Assign to…" when nobody holds it) when the server says this person may assign; the plain words otherwise. opts as for bulk */
  assignApi.chip = function (row, opts) {
    if (!row || !Array.isArray(row.holders)) return '';
    if (!assignApi.showsBar(opts && opts.said)) return assignApi.heldBy(row);
    assignApi.mount(opts);
    var empty = !row.holders.length, who = row.holders.map(function (h) { return h.name || ''; }).join(', ');
    var label = empty ? tr('Unassigned') + '. ' + tr('Assign to…') : tr('Held by') + ' ' + who + '. ' + tr('Assign to…');
    return '<button type="button" data-as-chip data-nolist data-as-plug="' + root.esc(opts.plug) + '" data-as-sub="' + root.esc(opts.subjectOf(row)) + '" data-as-role="' + root.esc(opts.roleOf(row)) + '" data-as-held="' + (empty ? '0' : '1') + '"' +
      ' data-cbsid="HOM001-B20" data-cbmount="HOM001-D05" data-testid="assign-chip" aria-haspopup="dialog" aria-label="' + root.esc(label) + '"' +
      ' style="max-width:100%;min-height:32px;padding:2px 10px;border:1px ' + (empty ? 'dashed' : 'solid') + ' var(--line,#DDD6C6);border-radius:999px;background:var(--card,#fff);color:' + (empty ? 'var(--grey,#5B5B5B)' : 'inherit') + ';font:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer">' +
      root.esc(empty ? '+ ' + tr('Assign to…') : who + ' ▾') + '</button>';
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
    pick({ title: 'Assign to…', held: row.held }, function (who) { apply(oneRowOpts(opts), [row], who); });
  }
  /** the I key: take it, when the person is among the people the server lets hold this work */
  function takeChip(chip) {
    var opts = mounts[chip.getAttribute('data-as-plug')], row = chipRow(chip);
    if (!opts) return;
    people().then(function (roster) {
      var me = roster.list.filter(function (p) { return p.me; })[0];
      if (!me) return showOutcome('bad', tr('You cannot take this one.'), []);
      return apply(oneRowOpts(opts), [row], { id: me.id, note: '' });
    });
  }
  function typingIn(node) { return !!(node && node.closest && node.closest('input,select,textarea,[contenteditable],#modalhost,dialog')); }
  function onKey(ev) {
    var key = String(ev.key || '').toLowerCase();
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || (key !== 'a' && key !== 'i') || typingIn(ev.target)) return;
    var row = ev.target && ev.target.closest && ev.target.closest('[data-row]'), chip = row && row.querySelector('[data-as-chip]');
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
