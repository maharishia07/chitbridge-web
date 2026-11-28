/* app/cap-period-stock.js — CB ACCOUNTS › Month & year end › Closing stock. Split out of cap-period.js (file-size ratchet, 20 Nov), code moved verbatim.
 * OWNS      peSetupKeep (ACC-410: the owner's VAT period and Emirate kept as the shop's setup answers; here for the size ratchet); the Closing stock tab: peStockView · peStockList · peStockAdd · peStockSave; and peAssetAsk (the Add asset question, moved here for the size ratchet)
 * CALLED BY public/accounts.html (script tag, after cap-period.js); BK.views closingstock opens peStockView
 * FLOW      Closing stock tab → peStockView → peStockList (the server's lines) → peStockAdd → peStockSave (POST /closing-stock) → the list paints again
 * CARD      14-accounting/periods-month-lock-year-close
 * ID        BKS016
 * OWNER     cb-accounting
 * RISK      money
 */
'use strict';
/* ═══ 1 · CLOSING STOCK ═════════════════════════════════════════════════════════════════════════════════════════════════
   POST /closing-stock { date, value_minor, nrv_minor?, method: 'manual', client_ref } — only the DIFFERENCE from the books posts (the engine reads `book`).
   The last counts are the stock ledger's own lines (GET /ledger/stock): date · entry · what it changed · stock after. */
async function peStockView(body) {
  const own = peOwner();
  body.innerHTML =
    (own
      ? '<div class="pe-card" data-testid="ps-form"><div class="pe-form">' +
        peField('ps_date', 'Month end', peInput('ps_date', peMonthEnd(1), '', 'date')) +
        peField('ps_val', 'Stock on hand, at cost', peAmt('ps_val')) +
        peField('ps_nrv', 'Worth less now? (only if lower)', peAmt('ps_nrv', '', tx('Leave empty if not'))) +
        '</div><div class="supacts">' +
        peBtn('ps-save', 'Save closing stock', 'peStockSave(this)') +
        '</div><div id="ps_out" class="pe-slot"></div></div>'
      : peNoOwner('Only the owner enters the closing stock')) + '<div id="bkl_stock" data-testid="stock-list"></div>';
  await peStockList();
}
/* the counts the list shows - one array, so a count just saved is added here and painted at once (M173) */
var PE_STOCK = { lines: [], api: null };
async function peStockList() {
  const host = peEl('bkl_stock');
  if (!host) return;
  let lines = [];
  try {
    const reply = await api('booksLedger', { params: { account: 'stock' }, query: { from: peDaysAgo(400), to: peYmd(new Date()) } });
    lines = ((reply && reply.lines) || [])
      .filter((item) => /closing stock/i.test(String(item.what || '')))
      .map((item, index) => Object.assign({ i: index }, item))
      .reverse();
  } catch (e) {
    if (!(e && e.status === 404)) {
      host.innerHTML = '<div class="pe-bad">' + bkErr(e) + '</div>';
      return;
    }
  }
  CBList.reset && CBList.reset('stock');
  PE_STOCK.lines = lines;
  if (PE_STOCK.api) {
    try {
      PE_STOCK.api.destroy();
    } catch (failure) { if (typeof cbQuiet === 'function') cbQuiet('stock:destroy', failure); } /* best effort: the person sees nothing change */
  }
  PE_STOCK.api = CBList.mount(host, {
    key: 'stock',
    t: tx,
    rows: () => PE_STOCK.lines,
    id: (l) => String(l.ref) + '#' + l.i,
    rowTid: (l) => 'stock-' + l.i,
    columns: [
      { key: 'date', label: tx('Month end'), prio: 1, sort: 'date', w: 150, html: true, cell: (l) => esc(bkDate(l.date)) },
      { key: 'entry', label: tx('Entry'), prio: 3, sort: 'entry', w: 150, html: true, cell: (l) => '<span class="mono">' + esc(l.ref || '') + '</span>' },
      {
        key: 'change',
        label: tx('Changed the stock by'),
        prio: 2,
        sort: 'change',
        num: true,
        w: 200,
        html: true,
        cell: (l) => esc(l.dr_minor ? peMoney(l.dr_minor) + ' ' + tx('Dr') : peMoney(l.cr_minor) + ' ' + tx('Cr'))
      },
      { key: 'after', label: tx('Stock after'), prio: 4, sort: 'after', num: true, w: 190, html: true, cell: (l) => esc(bkDrCr(l.running_minor)) }
    ],
    search: (l) => [l.date, l.ref, l.what].join(' '),
    sorts: [{ key: 'date', label: tx('Newest first'), cmp: (a, b) => String(b.date).localeCompare(String(a.date)) }],
    empty: { title: tx('No counts yet') }
  });
}
/** M173: the count just saved goes into the list below at once, from the server's answer (only the difference posted: book_minor is what the ledger held) - no second read */
function peStockAdd(body, v, r) {
  const now = body.nrv_minor != null ? Math.min(v, body.nrv_minor) : v,
    book = Number(r && r.book_minor) || 0,
    diff = now - book;
  const i = PE_STOCK.lines.reduce((total, item) => Math.max(total, item.i), -1) + 1;
  PE_STOCK.lines = [
    {
      i,
      date: body.date,
      ref: (r && r.entry_no) || '',
      what: 'Closing stock ' + body.date,
      dr_minor: diff > 0 ? diff : 0,
      cr_minor: diff < 0 ? -diff : 0,
      running_minor: now
    }
  ].concat(PE_STOCK.lines);
  if (PE_STOCK.api) PE_STOCK.api.refresh();
  else peStockList();
}
async function peStockSave(btn) {
  const date = peVal('ps_date'),
    v = bkMoneyMinor(peVal('ps_val'));
  if (!date || isNaN(v)) return peBad('ps_out', tx('Enter the month end and the value of the stock on hand.'));
  const body = { date, value_minor: v, method: 'manual', client_ref: peRef('stock') };
  if (peVal('ps_nrv')) {
    const n = bkMoneyMinor(peVal('ps_nrv'));
    if (isNaN(n)) return peBad('ps_out', tx('The lower value must be an amount.'));
    body.nrv_minor = n;
  }
  await bkOnce('pe-stock', btn, async () => {
    try {
      const reply = await api('perStock', { body });
      PE.ref.stock = null;
      peOk('ps_out', reply && reply.entry_no ? esc(txf('Saved · {no}', { no: reply.entry_no })) : esc(tx((reply && reply.why) || 'Saved')));
      peStockAdd(body, v, reply);
    } catch (e) {
      peBad('ps_out', e);
    }
  });
}
/** the question Add asset asks first: what it is, what it cost, the day and where the money came from (the sheet's own words, nothing added up here) */
function peAssetAsk(body, paidBox) {
  const from = paidBox && paidBox.selectedOptions && paidBox.selectedOptions[0] ? paidBox.selectedOptions[0].text : body.how;
  return {
    title: txf('Add {name}?', { name: body.name }),
    body: esc(txf('It cost {amt}, bought {date}, paid from {from}. It goes into the books now.', { amt: bkMoney(body.cost_minor), date: body.date, from })),
    yes: tx('Add asset')
  };
}
/** ACC-410: the owner's VAT period and Emirate are kept as the shop's setup answers (PUT country-setup particulars, the one home: asked.period · asked.region), so the return reads them for the owner, the adviser and the auditor alike.
 *  `stagger` is the pack's stagger key ('monthly' maps to the key that is monthly); '' leaves it unchanged. → the reloaded return, or null when the save was refused (not the owner) */
async function peSetupKeep(returnAnswer, stagger, emirate) {
  if (!peOwner()) return null; /* ONEP-1: a seat reading the owner's return never writes the shop's setup (a firm's device picks are not the client's answers) */
  const table = (returnAnswer && returnAnswer.staggers) || {},
    key = Object.keys(table).find((item) => item === String(stagger) || (stagger === 'monthly' && table[item].monthly)),
    particulars = {};
  if (key) particulars.period = key;
  if (emirate) particulars.region = emirate;
  if (!Object.keys(particulars).length) return returnAnswer;
  try {
    const held = (await api('countrySetup')) || {};
    await api('countrySetupSave', { body: { country: held.country && held.country.code, currency: held.currency, fy_start_month: held.fy_start_month, particulars } });
    return await peReturnLoad();
  } catch (failure) {
    bkQuiet('setup-keep', failure, null);
    return null;
  }
}
