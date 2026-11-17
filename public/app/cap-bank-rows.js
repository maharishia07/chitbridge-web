/* cap-bank-rows.js — BANK on CB Accounts: the lines of the statement on screen and what a person does with one line (accept · undo · forget · note · record · ask · add).
 *
 * OWNS      the lines list of the Bank view (bkbLineRows · bkbLinePanel · bkbAnswered · bankList), a line's rail actions (bankAccept · bankUndo · bankForget · bankRecord · bankNote ·
 *           bankNoteSave · bankAsk · bankNext)
 * CALLED BY cap-bank.js (bankPaint → bankList; the view's buttons) · cap-bank-sheet.js · loaded AFTER app/cap-bank.js (it shares that file's page globals BKB, bkbLoad, bkbEl …) by public/accounts.html
 * FLOW      a statement read by cap-bank.js → bankList paints one row per line by its state → a press runs accept / record / ask here → the ledger is read again by cap-bank.js
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * Split out of cap-bank.js (shrink W2, 2026-11-17): behaviour unchanged, the same global names; no money is computed here either — the engine and the API are the numbers.
 */
'use strict';
/** the page's rows for the shared list (bank-lines.js). A statement line takes the ONE standing the Add sheet's controller gives it (bkshItemOf: Ready to add or Needs you, the same split on every page); the rail's own state stays on `raw`.
 *  A line already in the books is "In your books", one only in the books is "Not on the statement". */
function bkbLineRows() {
  const rows = BKB.rows.map((raw) => {
    const item = typeof bkshItemOf === 'function' ? bkshItemOf(raw) : null,
      group = bkbGroupOf(raw.status);
    let row;
    if (item) {
      const result = BKSH.ctl.view().results[item.key];
      row = CBBankLines.rowOfItem(item, result, CBBankPreview.standing(item, result));
    } else row = { item: null, result: null, standing: '', narration: raw.narration || '', date: raw.date, out: !raw.in, amount_minor: raw.amount_minor, kind: '', gst: '', sure: '', look: false, status: raw.status === 'suggested' ? 'ready' : 'need' };
    if (group === 'matched') row.status = 'in';
    else if (group === 'bank') row.status = 'books';
    return Object.assign(row, { id: raw.id, raw });
  });
  CBBankLines.markLookAlikes(rows);
  return rows;
}
/** what opens under a line: the answers it asks (the sheet's controller, bank-preview-ui.js: what it looks like, Dr and Cr, the questions) and, under them, what the rail and the books say about it */
function bkbLinePanel(row) {
  const answers = !bkbReadOnly() && row.item && BKB.ui && (row.status === 'need' || row.status === 'ready' || row.status === 'lock') ? BKB.ui.panel(row.item, row.result) : '';
  const booked = row.item && row.status === 'in' && row.item.alreadyWhy ? '<div class="pe-note" data-testid="bank-in-why">' + bkbE(tx('In your books') + ' · ' + row.item.alreadyWhy) + '</div>' : ''; /* W15-85: a line posted in a later month says so on its own row */
  return booked + answers + bankNext(row.raw);
}
/** an answer was given under a line on this page: the band and the chips follow (the same controller), the open row and the filters stay, and after an answer the next line that needs one opens */
function bkbAnswered(key, what) {
  bkshPageFollows(); /* a "Same payment" answer moves the pairing: the page reads its engine again (a full paint) */
  const slot = bkbEl('bk_bandslot');
  if (slot) slot.innerHTML = bankFinish();
  if (typeof bkshTodo === 'function') bkshTodo();
  if (BKB.lines) {
    BKB.lines.refresh();
    if (what === 'answered') BKB.lines.openNext(key);
  }
}
/** a rail action of a row, on the page's own row: the row carries the rail's state on `raw` */
const bkbOnRaw = (item) => Object.assign({}, item, { when: item.when && ((row) => item.when(row.raw)), run: (row) => item.run(row.raw), why: item.why && ((row) => item.why(row.raw)) });
function bankList() {
  const host = bkbEl('bkl_bank');
  if (!host) return;
  const own = bkbMayAct();
  const may = (BKB.rail && BKB.rail.may && BKB.rail.may.ask) || { ok: false, say: tx('Asking starts after an update') };
  const notices = [];
  if (BKB.rail && BKB.rail.failed)
    notices.push({ cls: 'warn', tid: 'bank-rail-failed', text: tx('Could not read what parties told you. Lines are matched to your books only.') });
  BKB.ui = typeof bkshPageUi === 'function' ? bkshPageUi(host, bkbAnswered) : null; /* the answers painter, on this list's host (null until the controller has read the file) */
  BKB.lines = CBBankLines.mount(host, {
    key: 'bank',
    rows: bkbLineRows,
    panel: bkbLinePanel,
    fmt: (minor) => bkbFig(minor),
    tid: (r) => 'bank-row-' + r.id,
    extra: {
      head: () => ({ notices }),
      wrapStatus: (row, icon) => '<span data-testid="bank-chip-' + bkbE(row.id) + '" data-status="' + bkbE(row.raw.status) + '">' + icon + '</span>' /* the rail's own state (Settled by chit · Party told us · …) stays readable on the row; the icon is the line's standing */,
      columns: [
        {
          key: 'party',
          label: tx('Told by'),
          prio: 5,
          w: 170,
          html: true,
          cell: (row) => {
            const r = row.raw;
            return r.chits && r.chits.length
              ? bkbE(r.chits.map((item) => (item.party && item.party.name) || tx('A party')).filter((item, index, a) => a.indexOf(item) === index).join(', '))
              : r.asked
                ? bkbE(txf('Asked {party}', { party: (r.asked.party && r.asked.party.name) || tx('the party') }))
                : '—';
          }
        },
        {
          key: 'entry',
          label: tx('In your books'),
          prio: 6,
          sort: 'entry',
          w: 170,
          html: true,
          cell: (row) => ((row.raw.books || []).length && row.raw.status !== 'check' ? '<span class="mono">' + bkbE(row.raw.books.map((item) => item.entry_no).join(', ')) + '</span>' : '—')
        }
      ],
      actions: bkbReadOnly() ? [] : [
      {
        id: 'accept',
        icon: '✓',
        label: 'Accept',
        tid: 'bank-accept',
        when: (r) => r.status === 'settled' || r.status === 'matched',
        run: (r) => bankAccept(r)
      },
      {
        id: 'record',
        icon: bkSymbol(bkCur()) || '¤',
        label: 'Record from the chit',
        tid: 'bank-record',
        when: (r) => r.status === 'told',
        why: () => (may.ok ? '' : may.say),
        run: (r) => bankRecord(r)
      },
      {
        id: 'ask',
        icon: '✉',
        label: 'Ask the party',
        tid: 'bank-ask',
        when: (r) => r.status === 'bank-only' || r.status === 'suggested' || r.status === 'check',
        why: () =>
          !may.ok ? may.say : !((BKB.rail && BKB.rail.parties) || []).length ? tx('Nobody on the network to ask. Add it in your books instead.') : '',
        run: (r) => bankAsk(r)
      },
      {
        id: 'add',
        icon: '＋',
        label: 'Add missing',
        tid: 'bank-add',
        when: (r) => own && (r.status === 'suggested' || r.status === 'bank-only' || r.status === 'check') && !bankIsParty(r),
        run: (r) => bankAddBound(r)
      },
      {
        id: 'dues',
        icon: bkSymbol(bkCur()) || '¤',
        label: 'Record it in Dues',
        tid: 'bank-dues',
        when: (r) => peOwner() && r.status !== 'told' && bankIsParty(r),
        run: () => bkTab('dues')
      },
      { id: 'undo', icon: '↶', label: 'Undo', tid: 'bank-undo', when: (r) => r.status === 'accepted', run: (r) => bankUndo(r) },
      { id: 'note', icon: '✎', label: 'Note', tid: 'bank-note', when: (r) => !!r.key, run: (r) => bankNote(r) },
      {
        id: 'forget',
        icon: '⨯',
        label: 'Forget this rule',
        tid: 'bank-forget',
        when: (r) => !!(r.sugg && r.sugg.rule === 'learned'),
        run: (r) => bankForget(r)
      }
    ].map(bkbOnRaw)
    }
  });
}
const bankIsParty = (r) => !!(r.sugg && r.sugg.event && /^(payment_received|payment_made|cheque_dishonoured)$/.test(r.sugg.event.type));

/* ── the actions: device marks (accept · undo · note), the ONE books writer (record), the rail (ask) ── */
function bankAccept(r, quiet) {
  if (
    !bkbStep({
      act: 'accept',
      key: r.key,
      how: r.how,
      chits: (r.chits || []).map((item) => item.chit_id),
      ledger: (r.books || []).map((item) => item.entry_no)
    })
  )
    return;
  const c = (r.chits || [])[0];
  if (c && c.party && c.party.id) bkbLearn(r.stmt, { party: c.party.id, party_name: c.party.name });
  bankExplain();
  bankPaint();
  if (!quiet) toast(tx('Accepted. Undo keeps your notes.'));
}
function bankUndo(r) {
  if (!bkbStep({ act: 'undo', key: r.key })) return;
  bankExplain();
  bankPaint();
  toast(tx('Accept taken back. Your notes stay.'));
}
function bankForget(r) {
  const id = r.sugg && r.sugg.learned_id;
  BKB.rules = bkbRules().filter((y) => y.id !== id);
  bkbSave('rules', BKB.rules);
  bankExplain();
  bankPaint();
  toast(tx('Rule forgotten.'));
}
/** their chit says what was paid and for which bills → the pay sheet opens with it placed; the person presses Record (POST /payments) */
function bankRecord(r) {
  if (!bkbBound()) return;
  const c = (r.chits || [])[0];
  if (!c || !c.party || !c.party.id) return toast(tx('This chit names no party.'));
  if (typeof payOpen !== 'function') return toast(tx('This starts after an update'));
  bkbLearn(r.stmt, { party: c.party.id, party_name: c.party.name });
  payOpen(r.in ? 'customer' : 'supplier', c.party.id, {
    amount_minor: r.amount_minor,
    mode: bkbModeOf(BKB.accts, BKB.acct) || 'bank',
    reference: c.ref || r.ref || '',
    name: c.party.name || '',
    bills: [].concat.apply(
      [],
      (r.chits || []).map((x) => x.bills || [])
    )
  });
}
function bankNote(r) {
  ui.dialog({
    mount: 'BKS014-U01', pop: 'POP092',
    titleText: tx('Note on this line'),
    bodyStyle: 'display:flex;flex-direction:column;gap:8px',
    body: '<div class="pe-note">' +
      bkbE(bkDate(r.date) + ' · ' + tx(r.in ? 'In' : 'Out') + ' ' + bkbFig(r.amount_minor)) +
      '</div>' +
      '<textarea data-cbsid="BKS014-T01" class="inp" id="bk_note" data-testid="bank-note-text" rows="3" style="width:100%" maxlength="500"></textarea>' +
      '<div class="pe-note">' +
      bkbE(bankStoreNoteWords()) +
      '</div>',
    footerHtml: '<button data-cbsid="BKS014-B03" type="button" onclick="closeModal()">' +
      bkbE(tx('Cancel')) +
      '</button><button data-cbsid="BKS014-B04" type="button" class="pri" data-testid="bank-note-save" onclick="bankNoteSave(\'' +
      bkbE(r.id) +
      '\')">' +
      bkbE(tx('Save note')) +
      '</button>'
  });
}
function bankNoteSave(id) {
  const r = BKB.rows.filter((x) => x.id === id)[0],
    t = peVal('bk_note');
  if (!r) return closeModal();
  if (!bkbStep({ act: 'note', key: r.key, text: t })) return;
  closeModal();
  bankPaint();
  toast(tx('Note kept.'));
}
/** ✉ Ask: the engine composes the question (date · amount · reference only); CBAdvice.sendBody sends it (POST /api/chits/send); their advice answers it */
function bankAsk(r) {
  const parties = (BKB.rail && BKB.rail.parties) || [],
    pre = (r.sugg && r.sugg.event && r.sugg.event.party) || '';
  BKB.asking = r.id;
  ui.dialog({
    mount: 'BKS014-U02', pop: 'POP091', titleTestid: 'bank-ask-title',
    titleText: tx('Ask the party about this line'),
    bodyStyle: 'display:flex;flex-direction:column;gap:8px',
    body: peField(
        'bk_askto',
        'Who to ask',
        peSel(
          'bk_askto',
          [['', 'Choose a party']].concat(parties.map((item) => [item.party_id, item.name || item.party_id])),
          parties.some((item) => item.party_id === pre) ? pre : '',
          ' onchange="bankAskWords()"'
        )
      ) +
      '<div class="pe-note" data-testid="bank-ask-words" id="bk_askwords"></div>' +
      '<div class="pe-note">' +
      bkbE(tx('Only the date, the amount and the reference are sent. Their payment advice settles it in both books.')) +
      '</div><div id="bk_askout" class="pe-slot"></div>',
    footerHtml: '<button data-cbsid="BKS014-B05" type="button" onclick="closeModal()">' +
      bkbE(tx('Cancel')) +
      '</button><button data-cbsid="BKS014-B06" type="button" class="pri" data-testid="bank-ask-send" onclick="bankAskSend(this)">' +
      bkbE(tx('Send')) +
      '</button>'
  });
  bankAskWords();
}
function bankAskBody() {
  const r = BKB.rows.filter((x) => x.id === BKB.asking)[0],
    to = peVal('bk_askto'),
    p = ((BKB.rail && BKB.rail.parties) || []).filter((x) => x.party_id === to)[0];
  if (!r) return { ok: false, why: tx('That line is gone') };
  if (bkbNoCountryWords()) return { ok: false, why: bkbNoCountryWords() };
  return CBBankRecon.ask(r.stmt, {
    party: p ? { id: p.party_id, name: p.name } : null,
    currency: (BKB.rail && BKB.rail.currency) || bkCur(),
    me: BKB.rail && BKB.rail.me,
    country: bkbCountry(),
    key: r.key
  });
}
function bankAskWords() {
  const a = bankAskBody(),
    el = bkbEl('bk_askwords');
  if (el) el.textContent = a.ok ? a.words : bkbNoCountryWords() || tx('Choose who to ask.');
}
function bankAskSend(btn) {
  const a = bankAskBody(),
    r = BKB.rows.filter((x) => x.id === BKB.asking)[0];
  if (!a.ok) return peBad('bk_askout', bkbNoCountryWords() || tx('Choose who to ask.'));
  /* the rail's one send of a composed body (rail-advice.js CBAdvice.sendBody) — never a second mint */
  return CBAction.run(btn, () => CBAdvice.sendBody(a.body), {
    key: 'bankask:' + a.key,
    busy: tx('Sending…'),
    failed: tx('Not sent. Try again.'),
    outcome: (chit_id) => {
      const p = ((BKB.rail && BKB.rail.parties) || []).filter((x) => x.party_id === peVal('bk_askto'))[0] || {};
      BKB.rail.chits = (BKB.rail.chits || []).concat([
        {
          chit_id: chit_id || 'local:' + a.key,
          direction: 'sent',
          party: { id: p.party_id, name: p.name },
          created_at: new Date().toISOString(),
          business_json: a.body.business_json,
          line_items: []
        }
      ]);
      if (r) bkbStep({ act: 'note', key: r.key, text: txf('Asked {party}', { party: p.name || '' }) });
      closeModal();
      bankExplain();
      bankPaint();
      toast(txf('Asked {party}. Their payment advice will settle this line.', { party: p.name || tx('the party') }));
    },
    onFail: (words) => peBad('bk_askout', words)
  });
}

function bankNext(r) {
  const row = (k, v) =>
    '<div style="display:flex;flex-wrap:wrap;gap:4px 10px;padding:2px 0"><span style="color:var(--muted);min-width:110px">' +
    bkbE(tx(k)) +
    '</span><span style="min-width:0;overflow-wrap:anywhere">' +
    v +
    '</span></div>';
  const HOW = {
    ref: 'the same reference',
    'amount+date': 'the same amount and date',
    'one-to-many': 'several together',
    'many-to-one': 'several lines together'
  };
  const books = () =>
    (r.books || [])
      .map((item) =>
        row(
          'In your books',
          '<span class="mono">' +
            bkbE(item.entry_no) +
            '</span> · ' +
            bkbE(bkDate(item.date)) +
            ' · ' +
            bkbE(bkbFig(item.dr_minor || item.cr_minor)) +
            ' · ' +
            bkbE(item.narration)
        )
      )
      .join('');
  /* the party's own chit: who, what they said, the bills it settles — the chit opens in the one popup */
  const told = () =>
    (r.chits || [])
      .map(
        (item) =>
          row(
            'Told by',
            bkbE((item.party && item.party.name) || tx('A party')) +
              (item.words ? ' · ' + bkbE(item.words) : '') +
              ' <button data-cbsid="BKS014-B07" type="button" class="cbl-btn" data-testid="bank-open-chit-' +
              bkbE(item.chit_id) +
              '" onclick="openChitSheet(\'' +
              bkbE(item.chit_id) +
              '\')">' +
              bkbE(tx('Open the chit')) +
              '</button>'
          ) +
          ((item.bills || []).length
            ? row(
                'Bills',
                (item.bills || [])
                  .map(
                    (entry) =>
                      '<span class="mono">' +
                      bkbE(bkBillNo(entry.bill_no, entry.ref_chit_id, entry.date)) +
                      '</span>' +
                      (entry.applied_minor != null ? ' ' + bkbE(bkbFig(entry.applied_minor)) : '')
                  )
                  .join(' · ')
              )
            : '')
      )
      .join('');
  let h = '<div data-testid="bank-next-' + bkbE(r.id) + '">';
  if (r.status === 'settled' || (r.status === 'accepted' && r.was === 'settled'))
    h += told() + books() + row('Next', bkbE(tx('Their chit and your books agree. Accept it.')));
  else if (r.status === 'told') h += told() + row('Next', bkbE(tx('Not in your books yet. Record from the chit fills in their amount and bills.')));
  else if (r.status === 'told-only') h += told() + row('Why', bkbE(tx('Their chit says it was paid, but it is not on this statement yet.')));
  else if (r.status === 'matched' || r.status === 'accepted')
    h += books() + row('Matched by', bkbE(tx(HOW[r.how] || 'a rule'))) + row('Told by', bkbE(tx('Nobody sent a chit for it')));
  else if (r.status === 'asked')
    h += row(
      'Asked',
      bkbE(
        txf('{party} on {d}. Their payment advice will settle it.', {
          party: (r.asked.party && r.asked.party.name) || tx('The party'),
          d: bkDate(String(r.asked.at || '').slice(0, 10))
        })
      )
    );
  else if (r.status === 'suggested')
    h +=
      row('Looks like', bkbE(bkbEventWord(r.sugg.event))) +
      row('Why', bkbE(r.sugg.why || '')) +
      (r.sugg.rule === 'learned' && r.sugg.source
        ? row('Learned from', bkbE(txf('{n} on {d}', { n: r.sugg.source.narration || '', d: bkDate(r.sugg.source.date) })))
        : '') +
      (bankIsParty(r)
        ? row('Next', bkbE(tx('Record it as a payment in Dues, or ask the party which bill.')))
        : row('Next', bkbE(tx('Add missing opens the entry for you to check.'))));
  else if (r.status === 'check')
    h +=
      row('Why', bkbE(tx('More than one entry fits this line'))) +
      (r.books || [])
        .map((item) => row('Could be', '<span class="mono">' + bkbE(item.entry_no) + '</span> · ' + bkbE(bkbFig(item.dr_minor || item.cr_minor))))
        .join('');
  else if (r.status === 'missing') h += row('Why', bkbE(tx('In your books but not on this statement yet — a cheque not presented, or a later date')));
  else
    h +=
      row('Why', bkbE(r.sugg && r.sugg.why ? tx(r.sugg.why) : tx('Nobody told you about it and nothing in your books matches it'))) +
      row('Next', bkbE(tx('Ask the party which bill, or add it in your books.')));
  if (r.accepted && r.accepted.by) h += row('Accepted by', bkbE(txf('{who} · {date}', { who: r.accepted.by, date: bkDate(String(r.accepted.at || '').slice(0, 10)) }))); /* W15-71: who matched it and when, whatever its state before */
  const notes = r.key ? (bkbRec().notes || {})[r.key] || [] : [];
  if (notes.length)
    h +=
      '<div data-testid="bank-notes-' +
      bkbE(r.id) +
      '">' +
      notes.map((item) => row('Note', bkbE(item.text) + (item.at ? ' · ' + bkbE(bkDate(String(item.at).slice(0, 10))) : ''))).join('') +
      '</div>';
  return h + '</div>';
}
