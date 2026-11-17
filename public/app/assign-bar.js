/**
 * assign-bar.js — ASSIGN-1 slice 1: who holds each piece of work, and the bulk actions to change it (assign, hand over, back to pool, open jobs).
 *
 * OWNS      the "Held by" cell · the list's bulk actions for a set of ticked rows · the person picker (a native dialog) · the one line that says what the server did, in the server's own sentences
 * CALLED BY books-practice.js (CBAssign.heldBy, CBAssign.bulk); any other list whose rows are subjects of a plug (the plug and the row's subject id come from the caller, nothing here names a trade)
 * FLOW      ticked rows → CBAssign.bulk(opts).run(rows) → [person picker] → POST /api/chits/assign-bulk | /api/chits/jobs/open (one call per role) → the answer's counts and skip sentences → opts.reload()
 * CARD      01-rail-core-the-chit/assign
 *
 * Decides nothing and computes nothing: who may assign, who may hold, why a client was skipped and every sentence are the server's (may/why, detail, reason). A refusal is shown as the server wrote it.
 * The bar is SHOWN only to a login the page can tell is the owner or a manager (a hint to keep the screen quiet for an assistant); the server still decides every call, and a refusal says why in its words.
 * Controls: the list's own bulk buttons (CMP037-B04), the select (CMP056-S01), the cancel/command buttons (CMP003 / CMP057), all stamped with their register codes and the HOM001 mounts U02..U04.
 */
(function (root) {
  'use strict';
  var kit = (root.CBAssign = root.CBAssign || {});
  var ASSIGN_PATH = '/api/chits/assign-bulk', OPEN_PATH = '/api/chits/jobs/open', ACTORS_PATH = '/api/actors';
  function tr(s) { return typeof root.tx === 'function' ? root.tx(s) : s; }
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
  /** the signed token's own payload (a co-assist's hat rides in it); '' when unreadable */
  function hatOfToken(token) {
    try {
      var payload = JSON.parse(root.atob(String(token || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return String(payload.hat || payload.actor_hat || '');
    } catch (failure) { if (root.cbQuiet) root.cbQuiet('assign:hat', failure); return ''; }
  }
  /** SHOW only: the owner's own login, or a person whose hat is manager. `said` (a server verdict, when the answer carries one) wins. Never a permission: the api refuses a call that is not allowed. */
  kit.showsBar = function (said) {
    if (typeof said === 'boolean') return said;
    var s = session();
    return s.role === 'entity' || (s.role === 'actor' && hatOfToken(s.token).toLowerCase() === 'manager');
  };
  /** the holder column: the names the server sent, or "Unassigned" (an empty list); a row with no `holders` key at all (the firm's switch is off) shows nothing */
  kit.heldBy = function (row) {
    if (!row || !Array.isArray(row.holders)) return '';
    return row.holders.length ? root.esc(row.holders.map(function (h) { return h.name || ''; }).join(', ')) : '<span class="as-none">' + root.esc(tr('Unassigned')) + '</span>';
  };
  kit.heldByText = function (row) {
    return !row || !Array.isArray(row.holders) ? '' : row.holders.length ? row.holders.map(function (h) { return h.name || ''; }).join(', ') : tr('Unassigned');
  };
  kit.hasHolders = function (rows) { return (rows || []).some(function (r) { return Array.isArray(r.holders); }); };

  function call(method, path, body) {
    return root.fetch(base() + path, { method: method, headers: { Authorization: 'Bearer ' + session().token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, body: j || {} }; });
    });
  }
  /** the server's own sentence for a refusal: the Problem's detail, or the older may/why/message keys (never the page's words) */
  function sentenceOf(j) {
    return String(j.detail || j.why || j.message || j.error || j.title || '');
  }
  function plural(n, one, many) { return n + ' ' + tr(n === 1 ? one : many); }

  /* ── the line that says what happened ─────────────────────────────────────────────────────── */
  /* the last outcome is kept, because a reload redraws the list's section: the slot is drawn by the page's section (CBAssign.slotHTML) and filled from this */
  var last = null;
  function slotInner() {
    return last ? '<b>' + root.esc(last.headline) + '</b>' + last.lines.map(function (l) { return '<div class="as-line">' + root.esc(l) + '</div>'; }).join('') : '';
  }
  /** the always-present slot above the list: role=status so the outcome is read out; empty until something was done */
  kit.slotHTML = function () {
    css();
    return '<div id="as_result" class="as-result' + (last ? ' as-' + last.tone : '') + '" role="status" aria-live="polite" data-testid="assign-result" data-cbsid="HOM001-D05"' + (last ? '' : ' hidden') + '>' + slotInner() + '</div>';
  };
  function say(opts, tone, headline, lines) {
    last = { tone: tone, headline: headline, lines: lines || [] };
    var host = root.document.getElementById('as_result');
    if (host) { host.className = 'as-result as-' + tone; host.hidden = false; host.innerHTML = slotInner(); }
  }
  /** skip items grouped by the server's sentence: "3 · No job is open for this client and role." */
  function skipLines(skipped) {
    var by = {}, order = [];
    (skipped || []).forEach(function (s) { var k = String(s.reason || s.code || ''); if (!(k in by)) { by[k] = 0; order.push(k); } by[k]++; });
    return order.map(function (k) { return by[k] + ' · ' + k; });
  }

  /* ── the person picker ────────────────────────────────────────────────────────────────────── */
  var CSS_ID = 'as_css';
  function css() {
    if (root.document.getElementById(CSS_ID)) return;
    var node = root.document.createElement('style');
    node.id = CSS_ID;
    node.textContent =
      '.as-result{margin:6px 0;padding:8px 12px;border:1px solid var(--line,#DDD6C6);border-radius:10px;background:var(--card,#fff);color:var(--ink,#1B1B1B);font-size:14px}' +
      '.as-result.as-bad{border-color:var(--rp-bad,#B42318)}.as-result.as-good{border-color:var(--rp-good,#067647)}.as-line{margin-top:2px}.as-none{color:var(--grey,#5B5B5B)}' +
      'dialog.as-sheet{border:1px solid var(--line,#DDD6C6);border-radius:14px;padding:0;width:min(420px,calc(100vw - 24px));max-height:calc(100vh - 24px);background:var(--card,#fff);color:var(--ink,#1B1B1B)}' +
      'dialog.as-sheet::backdrop{background:var(--scrim,rgba(0,0,0,.4))}.as-hd{padding:12px 16px;font-weight:700;border-bottom:1px solid var(--line,#DDD6C6)}.as-body{padding:12px 16px;display:flex;flex-direction:column;gap:10px}' +
      '.as-body label{display:flex;flex-direction:column;gap:4px;font-size:13px}.as-body select,.as-body input{min-height:44px;font:inherit;padding:6px 8px;border:1px solid var(--line,#DDD6C6);border-radius:8px;background:var(--card,#fff);color:inherit}' +
      '.as-ft{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid var(--line,#DDD6C6)}.as-ft button{min-height:44px;padding:0 14px;border-radius:8px;border:1px solid var(--line,#DDD6C6);background:var(--card,#fff);color:inherit;font:inherit;cursor:pointer}' +
      '.as-ft button.pri{background:var(--accent,#1F4E8C);color:var(--on-accent,#fff);border-color:transparent}.as-err{color:var(--rp-bad,#B42318);font-size:13px}';
    root.document.head.appendChild(node);
  }
  /** the people who may hold this kind of work, as the server flags them (job_assignable); the page filters on the flag and never on a hat */
  function people() {
    return call('GET', ACTORS_PATH).then(function (r) {
      if (!r.ok) return { error: sentenceOf(r.body) || tr('People did not load.'), list: [] };
      var list = (r.body.actors || r.body.items || []).filter(function (a) { return a.job_assignable === true; }).map(function (a) { return { id: a.actor_id || a.identity_id || a.id, name: a.display_name || a.name || '' }; });
      return { list: list };
    });
  }
  /** pick → opens the dialog; resolves { id, note } or null (cancelled). opts: { title, confirmLabel, withNote, exclude } */
  function pick(opts) {
    css();
    return people().then(function (got) {
      return new root.Promise(function (done) {
        var doc = root.document, opener = doc.activeElement, dlg = doc.createElement('dialog'), answered = false;
        dlg.className = 'as-sheet';
        dlg.setAttribute('data-testid', 'assign-picker');
        dlg.setAttribute('data-cbmount', 'HOM001-U02');
        dlg.setAttribute('aria-label', tr(opts.title));
        var options = got.list.map(function (p) { return '<option value="' + root.esc(p.id) + '">' + root.esc(p.name) + '</option>'; }).join('');
        dlg.innerHTML =
          '<div class="as-hd">' + root.esc(tr(opts.title)) + '</div><div class="as-body">' +
          (got.error ? '<div class="as-err" data-testid="assign-picker-err">' + root.esc(got.error) + '</div>' : '') +
          '<label>' + root.esc(tr('Person')) + '<select data-cbsid="CMP056-S01" data-cbname="select" data-cbmount="HOM001-U02" data-testid="assign-person" aria-label="' + root.esc(tr('Person')) + '">' + options + '</select></label>' +
          (opts.withNote ? '<label>' + root.esc(tr('Note (optional)')) + '<input data-cbsid="CMP055-I01" data-cbmount="HOM001-U02" data-testid="assign-note" maxlength="200" type="text"></label>' : '') +
          '</div><div class="as-ft"><button type="button" data-cbsid="CMP003-B01" data-cbname="cancel" data-cbmount="HOM001-U02" data-testid="assign-cancel">' + root.esc(tr('Cancel')) + '</button>' +
          '<button type="button" class="pri" data-cbsid="CMP057-B01" data-cbname="command" data-cbmount="HOM001-U02" data-testid="assign-go"' + (got.list.length ? '' : ' disabled') + '>' + root.esc(tr(opts.confirmLabel)) + '</button></div>';
        function finish(value) { if (answered) return; answered = true; done(value); if (dlg.open) dlg.close(); }
        dlg.addEventListener('click', function (ev) {
          var b = ev.target.closest && ev.target.closest('button');
          if (!b) return;
          if (b.getAttribute('data-testid') === 'assign-cancel') return finish(null);
          if (b.getAttribute('data-testid') === 'assign-go') { var note = dlg.querySelector('[data-testid="assign-note"]'); finish({ id: dlg.querySelector('select').value, note: note ? note.value.trim() : '' }); }
        });
        dlg.addEventListener('close', function () { if (opener && opener.focus) opener.focus(); dlg.remove(); finish(null); });
        doc.body.appendChild(dlg);
        dlg.showModal();
        var first = dlg.querySelector('select');
        if (first && first.focus) first.focus();
      });
    });
  }

  /* ── the calls ────────────────────────────────────────────────────────────────────────────── */
  function byRole(rows, roleOf) {
    var out = {}, order = [];
    rows.forEach(function (r) { var k = roleOf(r); if (!(k in out)) { out[k] = []; order.push(k); } out[k].push(r); });
    return order.map(function (k) { return { role: k, rows: out[k] }; });
  }
  /** one call per role (the api takes one role per call); the counts and skip sentences are added; the first refusal stops the run and its sentence is shown */
  function runCalls(opts, rows, make, wordsFor) {
    var groups = byRole(rows, opts.roleOf), sum = { done: 0, skipped: [], refused: null };
    return groups.reduce(function (chain, g) {
      return chain.then(function () {
        if (sum.refused) return null;
        var spec = make(g);
        return call('POST', spec.path, spec.body).then(function (r) {
          if (!r.ok) { sum.refused = sentenceOf(r.body) || tr('Not done.'); return null; }
          sum.done += Number(spec.count(r.body)) || 0;
          sum.skipped = sum.skipped.concat(r.body.skipped || []);
        });
      });
    }, root.Promise.resolve()).then(function () {
      if (sum.refused) say(opts, 'bad', sum.refused, []);
      else say(opts, sum.skipped.length && !sum.done ? 'bad' : 'good', wordsFor(sum.done), skipLines(sum.skipped));
      return opts.reload ? opts.reload() : null;
    });
  }
  function subjects(rows, opts) { return rows.map(function (r) { return opts.subjectOf(r); }); }
  function assignBody(opts, g, target, note) {
    var body = { plug: opts.plug, role: g.role, subject_ids: subjects(g.rows, opts), target_actor_id: target };
    if (note) body.note = note;
    return { path: ASSIGN_PATH, body: body, count: function (a) { return a.assigned; } };
  }

  /**
   * CBAssign.bulk(opts) → the list's `bulk` array (the CMP037-B04 buttons), or [] when the bar is not shown to this person.
   * opts: { plug, subjectOf(row), roleOf(row), reload(), said? (a server verdict), heldOf? (row → bool: has a holder) }
   */
  kit.bulk = function (opts) {
    if (!kit.showsBar(opts.said)) return [];
    var heldOf = opts.heldOf || function (r) { return Array.isArray(r.holders) && r.holders.length > 0; };
    return [
      { id: 'assign', label: tr('Assign to…'), run: function (rows) {
        pick({ title: 'Assign to', confirmLabel: 'Assign' }).then(function (who) {
          if (who) runCalls(opts, rows, function (g) { return assignBody(opts, g, who.id); }, function (n) { return plural(n, 'client assigned.', 'clients assigned.'); });
        });
      } },
      { id: 'handover', label: tr('Hand over'), run: function (rows) {
        var held = rows.filter(heldOf);
        if (!held.length) return say(opts, 'bad', tr('No ticked client has a holder.'), []);
        pick({ title: 'Hand over to', confirmLabel: 'Hand over', withNote: true }).then(function (who) {
          if (who) runCalls(opts, held, function (g) { return assignBody(opts, g, who.id, who.note); }, function (n) { return plural(n, 'client handed over.', 'clients handed over.'); });
        });
      } },
      { id: 'pool', label: tr('Back to pool'), run: function (rows) {
        runCalls(opts, rows.filter(heldOf), function (g) { return assignBody(opts, g, null); }, function (n) { return plural(n, 'client back in pool.', 'clients back in pool.'); });
      } },
      { id: 'open', label: tr('Open jobs'), run: function (rows) {
        var none = rows.filter(function (r) { return !heldOf(r); });
        runCalls(opts, none, function (g) {
          return { path: OPEN_PATH, body: { plug: opts.plug, role: g.role, period: 'standing', subject_ids: subjects(g.rows, opts) }, count: function (a) { return Number(a.opened || 0) + Number(a.existing || 0); } };
        }, function (n) { return plural(n, 'job open.', 'jobs open.'); });
      } }
    ];
  };
})(typeof window !== 'undefined' ? window : globalThis);
