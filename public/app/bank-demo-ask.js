/* bank-demo-ask.js — the "What is this?" panel, the confirm popup's lines and the column map of public/bank-demo.html (split from bank-demo.js).
 * OWNS      the side panel / bottom sheet that asks the one thing a line needs (step 1: what is this, from the ENGINE's closed list; step 2: the account, the tax kind, or who it is),
 *           the text of the confirm popup (each line's payee, account and the Dr and Cr lines the engine composed, each entry's own totals) and the column map for a file with a heading we do not know.
 * CALLED BY public/app/bank-demo.js (it builds this with its own page functions: CBBankDemoAsk.create(host)). Loaded before it by public/bank-demo.html.
 * FLOW      press a line that needs you → openPanel → pick an answer → Next → account / tax kind → Mark ready → controller.resolveLine → host.onResolved → the panel closes
 * ⭐ NO ANSWER IS NAMED HERE: the list is CBBankEntry.whatIsThis() (read in bank-demo.js); this file only draws what it says for the line's side. NO MONEY IS COMPUTED: amounts are the engine's, formatted.
 * CARD      16-finance/bank-reconciliation-and-bank-rail
 * CONTROLS  BKS017-B21 an answer · BKS017-B22 next · BKS017-B23 change the answer · BKS017-B07 use this payee · BKS017-B08 mark ready · BKS017-S04 payee kind · BKS017-S05 account · BKS017-S06 tax kind · BKS017-I02 payee name · BKS017-B03 an existing payee · BKS017-S07 a column
 */
(function (root) {
  'use strict';
  var host = null /* the page's own functions (el, doc, paint, itemOf, standing, controller …), given by create() */,
    panel = null /* the open panel: { key, step, choice, refused, focusSel, shown, next } */;
  var MAP_FIELDS = [['date', 'Date'], ['narration', 'What the bank says'], ['debit', 'Money out'], ['credit', 'Money in'], ['amount', 'One amount column (minus = out)'], ['balance', 'Balance']];

  function choicesFor(item) {
    var said = host.whatIsThis(),
      out = item.line.debit_minor > 0;
    var list = said ? said.items.filter(function (one) { return one.side === 'both' || one.side === (out ? 'out' : 'in'); }) : [];
    return { items: list, later: said ? said.later : [], said: !!said };
  }

  function selectHtml(label, name, options, value) {
    return '<label>' + esc(label) + '<select class="bd-inp" data-cbsid="BKS017-S05" data-field="' + name + '"><option value="">Choose</option>' +
      options.map(function (one) { return '<option value="' + esc(one[0]) + '"' + (value === one[0] ? ' selected' : '') + '>' + esc(one[1]) + '</option>'; }).join('') + '</select></label>';
  }

  function panelStep1(item, choices) {
    var out = item.line.debit_minor > 0,
      all = [];
    if (item.party) all.push(['payee', 'Someone I deal with', 'A customer or a supplier: say who']);
    choices.items.forEach(function (one) { all.push([one.id, one.words, '']); });
    var rows = all.map(function (one) {
      return '<button type="button" role="radio" aria-checked="' + (panel.choice === one[0]) + '" data-act="pick" data-kind="' + esc(one[0]) + '" data-cbsid="BKS017-B21">' + esc(one[1]) + (one[2] ? '<small>' + esc(one[2]) + '</small>' : '') + '</button>';
    }).join('');
    var later = choices.later.map(function (one) {
      return '<button type="button" role="radio" aria-checked="false" disabled>' + esc(one.words) + '<small>Later: not in this demo yet</small></button>';
    }).join('');
    return '<p class="bd-step">Step 1 of 2</p><p class="bd-q"><b>What is this?</b> Money ' + (out ? 'out' : 'in') + '. Nothing on the line says.</p>' +
      '<div class="bd-choices" role="radiogroup" aria-label="What is this?">' + rows + later + '</div>' +
      '<button type="button" class="lk-btn lk-btn-go" data-act="next" data-cbsid="BKS017-B22"' + (panel.choice ? '' : ' disabled') + '>Next</button>';
  }

  function partyPanel(item) {
    var party = item.party;
    if (!party) return '<p class="bd-q">Say who this is.</p>';
    var meant = (item.didYouMean || []).map(function (one) {
      return '<button data-cbsid="BKS017-B03" type="button" class="bd-btn" data-act="meant" data-key="' + esc(item.key) + '" data-id="' + esc(one.id) + '" data-name="' + esc(one.name) + '">' + esc(one.name) + '</button>';
    }).join('');
    return '<label>Payee<input data-cbsid="BKS017-I02" class="bd-inp" type="text" maxlength="120" aria-label="Payee name" data-act="pname" data-key="' + esc(item.key) + '" value="' + esc(party.name) + '"></label>' +
      '<label>Payee kind<select data-cbsid="BKS017-S04" class="bd-inp" aria-label="Payee kind" data-act="pkind" data-key="' + esc(item.key) + '">' +
      ['supplier', 'customer'].map(function (kind) { return '<option value="' + kind + '"' + (party.kind === kind ? ' selected' : '') + '>' + kind + '</option>'; }).join('') + '</select></label>' +
      (meant ? '<div class="bd-dym"><span>Did you mean</span> ' + meant + '</div>' : '') +
      '<button type="button" class="lk-btn lk-btn-go" data-act="resolve" data-key="' + esc(item.key) + '" data-cbsid="BKS017-B07">Mark ready</button>';
  }

  function panelStep2(item, choices) {
    var back = '<p class="bd-step">Step 2 of 2</p><button type="button" class="bd-back" data-act="back" data-cbsid="BKS017-B23">‹ Change the answer</button>';
    if (panel.choice === 'payee') return back + partyPanel(item);
    var answer = choices.items.filter(function (entry) { return entry.id === panel.choice; })[0];
    if (!answer) return back + '<p class="bd-q">Pick an answer first.</p>';
    var out = item.line.debit_minor > 0,
      body = '<p class="bd-q"><b>' + esc(answer.words) + '</b></p>';
    if (answer.ask === 'account') body += selectHtml('Account', 'account', answer.accounts.map(function (acct) { return [acct.role, acct.name]; }), '');
    else if (answer.fixed) body += '<p class="bd-why">Between the bank and ' + esc(host.nameOf(answer.fixed)) + '. No payee and no tax are asked.</p>';
    else body += '<p class="bd-why">Paid to the tax office. No account and no tax kind are asked.</p>';
    if (answer.event === 'expense' || answer.event === 'other_income') body += selectHtml('Tax on this line', 'taxkind', host.chartOf().taxKinds.map(function (kind) { return [kind.id, kind.name]; }), '');
    return back + body + (panel.refused ? '<p class="bd-refused" role="alert">' + esc(panel.refused) + '</p>' : '') +
      '<button type="button" class="lk-btn lk-btn-go" data-act="resolve2" data-key="' + esc(item.key) + '" data-cbsid="BKS017-B08">Mark ready</button>';
  }

  /** no "What is this?" list from the engine yet: the old single step, an account from the pack's chart (and the tax kind on money out), or who it is */
  function panelPlain(item) {
    var out = item.line.debit_minor > 0,
      chart = host.chartOf(),
      list = (out ? chart.expense : chart.income).map(function (acct) { return [acct.role, acct.name]; });
    return '<p class="bd-q"><b>What is this?</b> Pick an account, or say who it is.</p>' + selectHtml('Account', 'account', list, '') +
      (out ? selectHtml('Tax on this line', 'taxkind', chart.taxKinds.map(function (kind) { return [kind.id, kind.name]; }), '') : '') +
      (panel.refused ? '<p class="bd-refused" role="alert">' + esc(panel.refused) + '</p>' : '') +
      '<button type="button" class="lk-btn lk-btn-go" data-act="resolve2" data-key="' + esc(item.key) + '" data-cbsid="BKS017-B08">Mark ready</button>' + (item.party ? '<p class="bd-step">Or a payee</p>' + partyPanel(item) : '');
  }

  function paintPanel() {
    if (!panel || !panel.shown) return;
    var item = host.itemOf(panel.key);
    var body = panel.shown.node.querySelector('.lk-pop-body');
    if (!item) return void panel.shown.close();
    var choices = choicesFor(item);
    body.innerHTML = '<div class="bd-panel">' + (!choices.said ? panelPlain(item) : panel.step === 2 ? panelStep2(item, choices) : panelStep1(item, choices)) + '</div>';
    var first = (panel.focusSel && body.querySelector(panel.focusSel)) || body.querySelector('[aria-checked="true"],[data-act="pick"],select,input,button');
    if (first && first.focus) first.focus();
  }

  function openPanel(key) {
    var item = host.itemOf(key);
    if (!item) return;
    panel = { key: key, step: 1, choice: null, refused: '', focusSel: '', shown: null };
    var title = host.payeeOf(item) + ' · ' + host.preview.dateText(item.line.date) + ' · ' + host.amountText(item.line.debit_minor ? { amount_minor: item.line.debit_minor, currency: host.CURRENCY } : { amount_minor: item.line.credit_minor, currency: host.CURRENCY });
    panel.shown = host.labKit.popup(title, function () {}, 'lk-side', function () {
      var after = panel && panel.next;
      panel = null;
      return (after && host.doc.querySelector('[data-key="' + after + '"]')) || host.el('bd_add');
    });
    paintPanel();
  }

  function closePanel(nextKey) {
    if (!panel || !panel.shown) return;
    panel.next = nextKey || null;
    panel.shown.close();
  }

  function firstNeedKey() {
    var model = host.controller().view();
    var found = model.items.filter(function (item) { return host.standing(item, model.results[item.key]) === 'need'; })[0];
    return found ? found.key : null;
  }

  /** the select a button reads: the panel's own fields, by data-field */
  function fieldOf(name) {
    var node = panel && panel.shown && panel.shown.node.querySelector('select[data-field="' + name + '"]');
    return node ? node.value : '';
  }

  function resolvePanel(key, plain) {
    var said = null;
    if (plain === 'party') said = host.controller().resolveLine(key);
    else said = host.controller().resolveLine(key, { kind: panel.choice && panel.choice !== 'payee' ? panel.choice : undefined, account: fieldOf('account') || undefined, tax_kind: fieldOf('taxkind') || undefined });
    if (!said.ok) {
      panel.refused = said.why;
      panel.focusSel = '.bd-refused,[data-act^="resolve"]';
      host.paint();
      return paintPanel();
    }
    host.onResolved();
    closePanel(firstNeedKey());
  }

  /** the confirm popup: the reach first, then each line with its payee, account and the Dr and Cr lines the engine composed, each entry's own balanced flag */
  function confirmBody(text) {
    var model = host.controller().view(),
      ready = model.items.filter(function (item) { return host.standing(item, model.results[item.key]) === 'ready'; });
    var money = function (minor) { return esc(host.amountText({ amount_minor: minor, currency: host.CURRENCY })); };
    var cards = ready.map(function (item) {
      var entry = item.entry || { lines: [] };
      var legs = (entry.lines || []).map(function (leg) {
        var dr = (leg.dr_minor || 0) > 0;
        return '<tr><td>' + (dr ? 'Dr' : 'Cr') + '</td><td>' + esc(host.nameOf(leg.account)) + '</td><td class="bd-r">' + money(dr ? leg.dr_minor : leg.cr_minor) + '</td></tr>';
      }).join('');
      return '<li><div class="bd-lp-top"><span>' + esc(host.payeeOf(item)) + '</span><span>' + esc(host.preview.dateText(item.line.date)) + '</span></div><div class="bd-lp-sub">' + esc(host.accountOf(item)) + (item.party && item.party.status === 'new' ? ' · new payee made first' : '') + '</div><table class="bd-jt"><tbody>' + legs + '</tbody></table>' +
        (entry.balanced ? '<div class="bd-lp-sub">Dr = Cr ✓</div>' : '') + '</li>';
    }).join('');
    var facts = text.lines.map(function (words) { return esc(words.replace(/new part(y|ies)/g, function (_, tail) { return tail === 'y' ? 'new payee' : 'new payees'; })); });
    return '<p class="lk-reach">' + facts.slice(0, 2).join(' · ') + '</p><p>' + facts.slice(2).join('</p><p>') + '</p><ul class="bd-lines-pop">' + cards + '</ul><p class="bd-note">Demo: only the books on this page change. Nothing is sent or saved.</p>';
  }

  function headCells(text) {
    var first = String(text || '').split(/\r?\n/).filter(function (row) { return row.trim(); })[0] || '';
    return first.split(',').map(function (cell) { return cell.replace(/^"|"$/g, '').trim(); }).filter(Boolean);
  }

  function mapCard(text) {
    var cells = headCells(text);
    if (!cells.length) return '';
    return '<div class="bd-map" data-cbsid="BKS017-M01"><h2>Which column is which?</h2><p class="bd-why">Tell us once and we read the rest of the file. Nothing is guessed.</p><div class="bd-map-grid">' +
      MAP_FIELDS.map(function (field) {
        return '<label>' + esc(field[1]) + '<select class="bd-inp" data-cbsid="BKS017-S07" data-map="' + field[0] + '"><option value="">Not in this file</option>' + cells.map(function (cell) { return '<option value="' + esc(cell) + '">' + esc(cell) + '</option>'; }).join('') + '</select></label>';
      }).join('') + '</div><button type="button" class="bd-btn bd-go" data-act="readmap" data-cbsid="BKS017-B26">Read the file</button></div>';
  }


  /** the column map's choices as the engine's mapping: { field: 'Heading' } for every field the visitor named */
  function mapping() {
    var named = {};
    Array.prototype.forEach.call(host.doc.querySelectorAll('select[data-map]'), function (node) {
      if (node.value) named[node.getAttribute('data-map')] = node.value;
    });
    return named;
  }
  /** a payee name or kind edited inside the panel */
  function editPayee(field) {
    var item = host.itemOf(field.getAttribute('data-key'));
    if (!item || !item.party) return;
    var action = field.getAttribute('data-act'),
      said = host.controller().editParty(item.key, { name: action === 'pname' ? field.value : item.party.name, kind: action === 'pkind' ? field.value : item.party.kind });
    if (!said.ok && panel) panel.refused = said.why;
    host.paint();
    paintPanel();
  }
  /** the page's data-act handlers for the panel: each takes the pressed control and its data-key and returns true (nothing more to paint) */
  var actions = {
    open: function (target, key) { openPanel(key); return true; },
    pick: function (target) {
      panel.choice = target.getAttribute('data-kind');
      panel.focusSel = '[data-kind="' + panel.choice + '"]';
      paintPanel();
      return true;
    },
    next: function () {
      panel.step = 2;
      panel.focusSel = 'select,input';
      paintPanel();
      return true;
    },
    back: function () {
      panel.step = 1;
      panel.refused = '';
      panel.focusSel = '[aria-checked="true"]';
      paintPanel();
      return true;
    },
    resolve: function (target, key) { resolvePanel(key, 'party'); return true; },
    resolve2: function (target, key) { resolvePanel(key, 'kind'); return true; },
    meant: function (target, key) {
      host.controller().editParty(key, { status: 'existing', id: target.getAttribute('data-id'), name: target.getAttribute('data-name') });
      panel.focusSel = '[data-act="resolve"]';
      host.paint();
      paintPanel();
      return true;
    }
  };
  /** create(host) → { actions, openPanel, firstNeedKey, confirmBody, mapCard, mapping, editPayee }: host is the page's own functions */
  function create(pageHost) {
    host = pageHost;
    return { actions: actions, openPanel: openPanel, firstNeedKey: firstNeedKey, confirmBody: confirmBody, mapCard: mapCard, mapping: mapping, editPayee: editPayee };
  }
  root.CBBankDemoAsk = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
