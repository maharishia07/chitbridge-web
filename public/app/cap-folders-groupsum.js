/* app/cap-folders-groupsum.js — the Group-sum pane of the FOLDERS capability. PART OF cap-folders.js: plain globals, no module, no call site changed.
 * OWNS      the Group-sum pane: loadGroupSum, the scope pills (gsScope), the per-item expand (gsToggle), the per-currency money line (_gsMoney).
 * READS     from cap-folders.js: _FLD, _fldPaint (at click time only; nothing here runs at load).
 * FLOW      loadGroupSum → _groupSumPane → gsToggle / gsScope
 * CARD      01-rail-core-the-chit/user-folders-and-auto-file-rules
 * CALLED BY public/accounts.html, public/crm.html, public/finance.html (a <script> tag each) · public/app.html (ensureCap('folders') loads it with this part through CAP_WITH)
 */
/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *  🧮 GROUP SUM — what does this pile add up to, and who asked for it?
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Athi, 2026-08-11: *"sum all the tasks and find out the total requirement… say 10 parties ordered 1000Kg, on
 * click the down below need to know who are all asked."*
 */
async function loadGroupSum() {
  _FLD.busy = true;
  _fldPaint();
  /* ⚠️ THE SCOPE IS A CHOICE, and it is stated on screen rather than assumed. Athi: *"at task level, we can ask
     for that total sum irrespective of the folders."*  Inside a folder both readings are reasonable — this pile,
     or the whole track — so the pane offers them instead of picking one silently. */
  var fid = UI.folderSel && !_FLD.gsAll ? UI.folderSel : null;
  var scope = UI.folderSel
    ? (
        (UI.folders || []).find(function (item) {
          return item.folder_id === UI.folderSel;
        }) || {}
      ).scope || 'task'
    : UI.folder === 'order'
      ? 'order'
      : 'task';
  /* ⭐ A TICKED SELECTION WINS OVER THE FOLDER (backlog 31). `_FLD.gsIds` is set only by the select bar's
     🧮 button, so the ordinary folder/track reading is untouched when nothing is ticked.
     ⚠️ The folder filter is dropped for a selection on purpose — you ticked those chits, and silently
     intersecting them with the folder you happen to be standing in would drop rows you explicitly chose. */
  var ids = _FLD.gsIds && _FLD.gsIds.length ? _FLD.gsIds : null;
  if (ids) fid = null;
  try {
    _FLD.gs = await api('folderGroupSum', { query: { scope: scope, folder_id: fid || undefined, chit_ids: ids ? ids.join(',') : undefined } });
    _FLD.err = null;
  } catch (e) {
    var m = (e && e.message) || '';
    /* ⚠️ NAME THE ACTUAL CAUSE. Unlike the Rules pane there is no older endpoint to fall back to, so a 404 here
       means the API has not shipped this route yet — not that the sum failed or that there is nothing to add up.
       "Could not add it up" would send someone hunting through their data for a problem that is not there. */
    _FLD.err = /404|not found/i.test(m)
      ? 'Group sum needs an API version that has not deployed yet. Everything else on this screen works — this one route is missing. (Nothing is wrong with your data.)'
      : m || 'Could not add it up.';
    _FLD.gs = null;
  }
  _FLD.busy = false;
  _fldPaint();
}
function gsScope(all) {
  _FLD.gsAll = !!all;
  _FLD.gs = null;
  loadGroupSum();
}
function gsToggle(i) {
  _FLD.gsOpen = _FLD.gsOpen || {};
  _FLD.gsOpen[i] = !_FLD.gsOpen[i];
  _fldPaint();
}
/* the Group sum's drill-down block: an indented block on the card colour under its row */
function _gsNext(inner) {
  return '<div style="padding:2px 0 8px 16px;background:var(--card);color:var(--on-card)">' + inner + '</div>';
}
function _gsMoney(list, mixed) {
  if (!list || !list.length) return '<span style="color:var(--grey)">—</span>';
  return cbMoneyList(
    list.map(function (x) {
      return { currency: x.currency, total: x.total };
    }),
    { quiet: !mixed }
  );
}
/** the group-sum pane: money and counts added up per folder, with the scope pills */
function _groupSumPane() {
  if (_FLD.busy && !_FLD.gs) return '<div style="padding:18px;color:var(--grey);font-size:var(--fs-2)"><span class="spin"></span> adding it up…</div>';
  if (_FLD.err) return '<div style="padding:18px;color:var(--disp);font-size:var(--fs-2)">' + esc(_FLD.err) + '</div>';
  var g = _FLD.gs;
  if (!g) return '<div style="padding:18px;color:var(--grey);font-size:var(--fs-2)">Nothing to add up</div>';
  var out = '<div style="padding:14px 18px">';

  /* ⚠️ A SELECTION MUST SAY SO, AND SAY IF IT LOST ANY. The scope toggle below is hidden here because neither
     reading applies — this is neither "this folder" nor "the whole track", it is the chits you ticked. And if
     fewer came back than were asked for, that is stated rather than absorbed: the difference is chits outside
     this track or beyond the row limit, and a pane headed "5 chits" when you ticked 7 is a quiet lie. */
  /* ⚠️ VERSION SKEW MUST NOT LOOK LIKE AN ANSWER. An API that predates `chit_ids` ignores the parameter and
     happily returns the WHOLE TRACK — 19 chits when the user ticked 2 — and every number below would be right
     for a question they did not ask. Seen live while building this. So the claim is checked against the reply:
     we asked for a selection, and if the server did not confirm one, say the selection was ignored. */
  if (_FLD.gsIds && _FLD.gsIds.length && !g.selected) {
    out +=
      '<div style="background:var(--danger-tint);border:1px solid #f0c9c6;border-radius:9px;padding:8px 11px;font-size:var(--fs-1);color:var(--disp-2);margin-bottom:10px">' +
      '' +
      txf('⚠️ {ignored} This server cannot total a ticked set yet, so the figures below cover the {whole}, not your {n} chits.', {
        ignored: '<b>' + tx('Your selection was ignored.') + '</b>',
        whole: '<b>' + tx('whole track') + '</b>',
        n: _FLD.gsIds.length
      }) +
      '</div>';
  } else if (g.selected) {
    var miss = (g.selection_requested || 0) - (g.chits || 0);
    out +=
      '<div style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:9px;padding:8px 11px;font-size:var(--fs-1);color:var(--warn-3);margin-bottom:10px">' +
      '☑ <b>' +
      (g.chits || 0) +
      ' ticked chit' +
      (g.chits === 1 ? '' : 's') +
      '</b> — not this folder or the whole track.' +
      (miss > 0 ? ' ⚠️ ' + miss + ' of the ' + g.selection_requested + ' you ticked are not on this track and were left out.' : '') +
      '</div>';
  } else if (UI.folderSel) {
    var b = function (on, lbl, arg) {
      return (
        '<span data-cbsid="SCR004-C10" onclick="gsScope(' +
        arg +
        ')" style="cursor:pointer;border:1px solid var(--line);border-radius:9px;padding:3px 10px;font-size:var(--fs-1);margin-inline-end:6px;' +
        (on ? 'background:var(--blue);color:var(--on-accent);border-color:var(--blue);font-weight:700' : 'background:var(--card)') +
        '">' +
        lbl +
        '</span>'
      );
    };
    out += '<div style="margin-bottom:10px">' + b(!_FLD.gsAll, 'This folder', 'false') + b(!!_FLD.gsAll, 'Whole track — every folder', 'true') + '</div>';
  }

  /**
   * ⭐⭐ AND IT IGNORES THE STATUS TAB — SAID OUT LOUD. Athi, 2026-08-22: *"the top icon groups irrespective of
   * the status? open, act, assign etc — is it the difference? If so it has to be spelt loud."*
   *
   * He was right. `GET /folders/groupsum` takes `scope`, `folder_id`, `archived` and an optional ticked
   * `chit_ids` — **no status filter anywhere**. So standing on "Open 6" and opening this pane gives you a
   * total that also counts Act and Close.
   *
   * ⚠️ THAT IS THE RIGHT BEHAVIOUR AND THE WRONG SILENCE. "What does this pile add up to" is a question about
   * the whole pile — filtering it by the tab you happen to be standing on would make the answer change as you
   * browsed. But a reader looking at a 6 and a total built from 19 has no way to know why, and the number is
   * more trustworthy the moment it names its own scope.
   *
   * ⚠️ NOT SHOWN FOR A TICKED SELECTION, because there the scope is exactly what the reader chose and the
   * banner above already says so. A caveat that appears when it does not apply teaches people to skip it.
   */
  if (!g.selected) {
    out +=
      '<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:8px">' +
      '⚑ Counts <b style="color:var(--ink)">every status</b> — Open, Act and Close alike, not just the tab you are on.' +
      '</div>';
  }

  /* ⚠️ SAID FIRST, NOT BURIED. A pile of 47 chits where only 9 carry line items produces a requirement built from
     9 — and without this line that total reads as though it covered all 47. */
  out +=
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:10px">' +
    '<b style="color:var(--ink)">' +
    g.chits +
    '</b> chit' +
    (g.chits === 1 ? '' : 's') +
    ' · <b style="color:var(--ink)">' +
    g.chits_with_lines +
    '</b> carry line items' +
    (g.chits_without_lines ? ' · <span style="color:var(--warn-2)">' + g.chits_without_lines + ' have none and contribute nothing</span>' : '') +
    (g.has_catalogue
      ? ''
      : '<div style="color:var(--warn-2);margin-top:3px">⚠️ Spellings count separately</div>') +
    '</div>';

  var req = g.requirement || [];
  if (req.length) {
    out +=
      '<div style="display:flex;font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);padding:0 0 4px"><span style="flex:1">' +
      tx('Item') +
      '</span><span style="width:110px;text-align:end">' +
      tx('Quantity') +
      '</span><span style="width:130px;text-align:end">' +
      tx('Cost') +
      '</span><span style="width:74px;text-align:end">' +
      tx('Parties') +
      '</span></div>';
    out += req
      .map(function (l, index) {
        var open = !!(_FLD.gsOpen || {})[index];
        var name = esc(l.item) + (l.variant ? ' <span style="color:var(--grey);font-weight:600">· ' + esc(l.variant) + '</span>' : '');
        var head =
          '<div data-cbsid="SCR004-C11" onclick="gsToggle(' +
          index +
          ')" style="display:flex;align-items:center;cursor:pointer;padding:7px 0;border-top:1px solid var(--line);font-size:var(--fs-2)">' +
          '<span style="flex:1;min-width:0">' +
          (open ? '▾' : '<span class=arw>▸</span>') +
          ' ' +
          name +
          (l.matched_by_spelling ? ' <span title="matched through a misspelling" style="font-size:var(--fs-1);color:var(--warn-2)">≈</span>' : '') +
          '</span>' +
          /**
           * ⚠️ A SPLIT TOTAL IS NOT ZERO — SHOW A DASH.
           *
           * When no conversion is defined the server correctly refuses to invent one, so `total` holds only the
           * part in the canonical unit — which is frequently 0. This rendered that 0 as the HEADLINE, so Curry
           * Leaves read **“0 bunch · INR 0”** while carrying 25 கட்டு. The warning explaining it sat in 11px red
           * text underneath, and the number a person actually reads said there was nothing there.
           *
           * ⭐ The app already states this rule on the Metrics pane — *"A dash means nothing to measure, which is
           * not the same as zero"* — and the line immediately below already honours it for an unpriced value. This
           * is the same rule applied to quantity: measured, not measurable, and zero are three different facts.
           */
          '<span style="width:110px;text-align:end;font-weight:800">' +
          (l.unit_split
            ? '<span style="color:var(--disp)" title="units that cannot be added — see the split below">—</span>'
            : esc(String(l.total)) + ' ' + esc(l.canonical_unit || '')) +
          '</span>' +
          '<span style="width:130px;text-align:end">' +
          _gsMoney(l.value, l.value_mixed) +
          '</span>' +
          '<span style="width:74px;text-align:end;color:var(--grey);font-size:var(--fs-1)">' +
          l.stores +
          '</span></div>';
        /* THE DRILLDOWN — Athi: "on click the down below need to know who are all asked". The roster comes straight
         from consolidate()'s attribution; nothing is recomputed to render it. */
        var rows = open
          ? _gsNext(
              (l.breakdown || [])
                .map(function (s) {
                  return (
                    '<div style="display:flex;align-items:center;font-size:var(--fs-2);padding:3px 0">' +
                    '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                    esc(s.store_name) +
                    /* ⚠️ WHAT THEY ACTUALLY WROTE, when it differs from the canonical name. "thakkali → Tomato" is the
                 single most useful thing to see when checking whether a total is right. */
                    (String(s.phrase || '').toLowerCase() !== String(l.item || '').toLowerCase()
                      ? ' <span style="color:var(--grey)">— asked as “' + esc(s.phrase) + '”</span>'
                      : '') +
                    '</span>' +
                    '<span style="width:110px;text-align:end">' +
                    esc(String(s.qty)) +
                    ' ' +
                    esc(s.unit || '') +
                    '</span>' +
                    '<span style="width:130px;text-align:end">' +
                    (s.value == null
                      ? '<span style="color:var(--grey)" title="no price on this line — not counted as zero">—</span>'
                      : esc((s.currency || '') + ' ' + s.value)) +
                    '</span>' +
                    '<span style="width:74px"></span></div>'
                  );
                })
                .join('')
            )
          : '';
        var partial =
          open && l.value_partial
            ? '<div style="font-size:var(--fs-1);color:var(--warn-2);padding:0 0 8px 16px">⚠️ ' +
              l.value_partial.unpriced +
              ' of ' +
              (l.value_partial.priced + l.value_partial.unpriced) +
              ' have no price yet — ' +
              txf('the cost above is the priced part only, {not} the cost of this line.', { not: '<b>' + tx('not') + '</b>' }) +
              '</div>'
            : '';
        var split = l.unit_split
          ? '<div style="font-size:var(--fs-1);color:var(--disp);padding:0 0 8px 16px">⚠️ ' +
            esc(l.flagged || 'unit split') +
            ' — ' +
            l.unit_split
              .map(function (item) {
                return esc(item.qty + ' ' + item.unit);
              })
              .join(' + ') +
            '</div>'
          : '';
        return head + rows + partial + split;
      })
      .join('');
  } else {
    out +=
      '<div style="color:var(--grey);font-size:var(--fs-2);padding:8px 0">Nothing totalled. ' +
      (g.chits_with_lines ? 'The lines here did not resolve to catalogue items — see below.' : 'None of these chits carry line items.') +
      '</div>';
  }

  /* ⚠️ THE FLAGS TRAVEL WITH THE TOTALS, never on a separate screen nobody opens. A total with a gap beside it
     gets checked; a total that quietly excluded something does not. */
  var f = g.flags || {};
  var blocks = [
    [
      'unmatched',
      '🚫 Not totalled — no catalogue match',
      f.unmatched,
      function (x) {
        return esc(x.phrase) + ' · ' + esc(x.store_name) + ' · ' + esc(String(x.qty) + ' ' + (x.unit || '')) + (x.reason ? ' — ' + esc(x.reason) : '');
      }
    ],
    [
      'variant_unspecified',
      '⚠️ Not totalled — a grade was never named',
      f.variant_unspecified,
      function (x) {
        return (
          esc(x.item) +
          ' · ' +
          esc(x.store_name) +
          ' — catalogue has ' +
          esc((x.variants || []).join(' / ')) +
          '; picking one silently would be inventing the order'
        );
      }
    ],
    [
      'unit_split',
      '⚠️ Units that cannot be added',
      f.unit_split,
      function (x) {
        return (
          esc(x.item) +
          ' — ' +
          (x.split || [])
            .map(function (item) {
              return esc(item.qty + ' ' + item.unit);
            })
            .join(' + ') +
          '; no conversion is defined, and guessing one sources the wrong quantity'
        );
      }
    ]
  ];
  blocks.forEach(function (item) {
    var arr = item[2] || [];
    if (!arr.length) return;
    out +=
      '<div style="margin-top:12px"><div style="font-size:var(--fs-1);font-weight:800;color:var(--warn-2);margin-bottom:3px">' +
      item[1] +
      ' (' +
      arr.length +
      ')</div>' +
      arr
        .slice(0, 25)
        .map(function (x) {
          return '<div style="font-size:var(--fs-1);color:var(--grey);padding:2px 0">· ' + item[3](x) + '</div>';
        })
        .join('') +
      (arr.length > 25 ? '<div style="font-size:var(--fs-1);color:var(--grey)">…and ' + (arr.length - 25) + ' more</div>' : '') +
      '</div>';
  });

  var mo = g.money || {};
  out +=
    '<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:10px">' +
    '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:4px">' +
    tx('Agreed value of these chits') +
    '</div>' +
    ((mo.by_currency || []).length
      ? (mo.by_currency || [])
          .map(function (x) {
            return (
              '<span style="display:inline-block;border:1px solid var(--line);border-radius:9px;padding:3px 9px;margin:0 6px 6px 0;font-size:var(--fs-2)"><b>' +
              esc(x.currency) +
              '</b> ' +
              esc(String(x.total)) +
              ' <span style="color:var(--grey)">· ' +
              x.chits +
              ' chit' +
              (x.chits === 1 ? '' : 's') +
              '</span></span>'
            );
          })
          .join('')
      : '<span style="font-size:var(--fs-2);color:var(--grey)">no agreed value</span>') +
    ((mo.excluded || {}).awaiting_agreement
      ? '<div style="font-size:var(--fs-1);color:var(--grey)">' +
        mo.excluded.awaiting_agreement +
        ' chit(s) have no agreed value yet and are excluded — not counted as zero.</div>'
      : '') +
    '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:4px">' +
    txf('⚠️ This is the {agreed}, which is a different question from the {cost} above — a chit can carry priced lines and no agreed total, or the reverse.', {
      agreed: '<b>' + tx('agreed value of the chits') + '</b>',
      cost: '<b>' + tx('cost of the requirement') + '</b>'
    }) +
    '</div>' +
    '</div></div>';
  return out;
}
