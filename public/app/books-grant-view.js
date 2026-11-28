/**
 * books-grant-view.js — ACC-176, THE AUDITOR'S SIDE: a member's books, READ ONLY.
 *
 * OWNS      the books view a firm opens from "My network" for one member store: for an auditor the "Viewing <store> — read only" band, for an adviser the frozen "Acting for <store>, <currency>" banner (CBBooksActing) with its store switch and an "Actions" tab (the queues); the back link; six reads (Trial balance · Profit and loss · Balance sheet · Day book · Who owes whom · Closed months) as CBLists
 * CALLED BY network-app.js ("Open books" on a member row that holds a live grant)
 * FLOW      mount(host, o) → GET /api/books/<read> with the headers of CBBooksActing (the server checks the grant on every look and writes the log row) → rows + totals painted as the server sent them; a refusal is shown in the server's words
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * This screen has NO write control: nothing here adds, changes or exports a book (the adviser's writes live in books-actions-view.js, which this screen only mounts). It paints what the server answered and computes nothing. A look the server refuses (a grant that ended, a part not open to an auditor)
 * is said in its own sentence, never as an empty table.
 *   CBBooksGrantView.mount(host, { call, member: { id, name, role }, onBack, onSwitch, stores, mountList, sheet, closeSheet }) → { destroy }
 *
 * THE PERIOD (W8/W14/W15/W17/W18, Athi 16 Nov): ONE control (period-pick.js) at the right of the tabs line picks the year or a month for every read; the page opens on the year under review (the server's `under_review`) and the period rides the address (&fy= or &from=&to=). tb and bs read it as 'as at <to>', p&l and the day book as from – to.
 *
 * ACC-176c: a trial balance, profit and loss or balance sheet row opens that account's ledger; a Day book row opens its entry (books-grant-drill.js).
 *
 * REUSE (named in the PR): CBBooksGrantDrill · CBList (via mountList) · CBBooksGrantApi (endpoints) · CBBooksActing (headers, banner, figure) · CBBooksActionsView (the queues) · the page's own call (token, base, 401)
 */
(function (root) {
  'use strict';
  var grantKit = root.CBBooksGrantKit; /* created by books-grant-reports.js, which loads first */
  grantKit.words = words;
  grantKit.$ = $;
  grantKit.current = current;
  grantKit.onActions = onActions;
  grantKit.openMonth = openMonth;
  grantKit.paintList = paintList;
  grantKit.drill = drill;
  grantKit.alive = alive;
  grantKit.reload = reload;
  grantKit.viewState = { host: null, o: {}, report: 'dues', day: '', answer: null, why: null, period: null, range: null, choices: undefined };
  /** is k a read this view paints (or the Actions tab) */
  function viewKnown(k) {
    return k === grantKit.ACTIONS || grantKit.REPORTS.some(function (r) { return r.k === k; });
  }
  /** the read this view holds when it opens (a client's first visit goes straight to the owner's Day book: mount) */
  function homeOf(options) {
    return 'dues'; /* ONEP-2 PR7b: the Day book is the owner's screen (a door), so a client opens on it (mount) and, coming back, on the first read this view has */
  }
  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function $(id) {
    return root.document.getElementById(id);
  }
  function current() {
    return grantKit.REPORTS.filter(function (r) {
      return r.k === grantKit.viewState.report;
    })[0];
  }
  /** the firm's "Actions" tab is open: the queues, not a read */
  function onActions() {
    return grantKit.viewState.report === grantKit.ACTIONS;
  }
  function isAdviser() {
    return grantKit.viewState.o.member.role === 'adviser';
  }

  /* ── the read ── */
  /** the period in force: the one value every read takes (and the Day book's `range`, kept as {from, to} for the marks and the empty line) */
  function usePeriod(period) {
    grantKit.viewState.period = period;
    grantKit.viewState.range = period && period.from ? { from: period.from, to: period.to } : null;
  }
  /** the choices of this client, read ONCE (GET /periods?marks=1: the year under review, each year, each month with its state and checked n of m); the period opens on the year under review (current FY only when none) unless the address named one */
  /** fix1117 F3: the first screen is never an empty period. A client whose first financial year has not ended has no year under review (the api says null), and a year under review may hold no entries: either way the books open on the latest year that holds entries (the api's years, newest first), so "Checked 0 of 0 · Nothing to show" never greets a client with entries. RC walk 17 Nov: the current year with entries comes first (below) */
  function periodWithEntries(choices, review) {
    var years = (choices && choices.years) || [], busy = years.filter(function (y) { return Number(y.entries) > 0; })[0];
    var today = new Date().toISOString().slice(0, 10), now = years.filter(function (y) { return Number(y.entries) > 0 && String(y.from).slice(0, 10) <= today && today <= String(y.to).slice(0, 10); })[0];
    var held = review && years.filter(function (y) { return y.fy === review.fy; })[0];
    if (review && (!held || Number(held.entries) > 0 || !busy)) return review; /* fyreview 17 Nov: a FIRM seat opens the client on the year under review, the value Home year-end band and the practice list show (the api under_review, read once here); Xero Practice and CaseWare open the engagement period. The OWNER books are another screen and keep the current year */
    if (now) return { fy: now.fy, from: now.from, to: now.to }; /* no year under review, or it holds nothing: the CURRENT financial year, when it holds entries, as Xero and MYOB open the current period; the year under review (a closed year) is one pick away */
    return busy ? { fy: busy.fy, from: busy.from, to: busy.to } : review;
  }
  function choose() {
    if (grantKit.viewState.choices !== undefined || !alive()) return Promise.resolve();
    return root.CBBooksGrantApi.run(grantKit.viewState.o.call, 'readPeriods', { query: { marks: 1 }, headers: root.CBBooksActing.headers() }).then(function (a) {
      grantKit.viewState.choices = a || null;
      var named = root.CBPeriodPick.filled(grantKit.viewState.period, a), review = a && a.under_review;
      review = periodWithEntries(a, review);
      usePeriod(named || (review ? { kind: 'year', fy: review.fy, from: review.from, to: review.to } : null)); /* W15/W17: the year under review, never "this month" or "as at today" */
    }, function () { grantKit.viewState.choices = null; usePeriod(grantKit.viewState.period && grantKit.viewState.period.from ? grantKit.viewState.period : null); });
  }
  /** the period control mounts into the named slot of the header line (CBBooksActing.periodSlot, W19): ONE function, ONE call in paint(); moving it is changing that call. Nothing in a refused or Actions screen. */
  function fillPeriodSlot(report) {
    var slot = $('bv_period_slot');
    if (slot) slot.innerHTML = !report.k || grantKit.viewState.why || !grantKit.viewState.choices ? '' : root.CBPeriodPick.control(grantKit.viewState.choices, grantKit.viewState.period, pickPeriod, report.k === 'bas' && grantKit.viewState.answer ? grantKit.viewState.answer.periods : null); /* FW-25: the return's own quarters are in the one control, so the Day box is not the only way to change quarter */
  }
  /** a period chosen: every view follows it (the typed day is dropped), the address records it */
  function pickPeriod(period) {
    usePeriod(period);
    grantKit.viewState.day = '';
    tell();
    reload().then(function () { var box = $('bv_period'); if (box) box.focus(); });
  }
  /** a Months row opens that month's Day book: the owner's screen in this seat, the month as from= and to= */
  function openMonth(from, to) {
    openDoor('daybook', '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
  }
  /** GET /periods names no currency: a month's sales would print as a dash. The store's currency is learned once from the Day book's own answer (the period it opens on) */
  function knowCurrency() {
    var acting = root.CBBooksActing.current() || {};
    if (current().k !== 'periods' || acting.currency || !grantKit.viewState.range) return Promise.resolve();
    return root.CBBooksGrantApi.run(grantKit.viewState.o.call, 'readDaybook', { query: { from: grantKit.viewState.range.from, to: grantKit.viewState.range.to, limit: 1 }, headers: root.CBBooksActing.headers() }).then(function (a) { root.CBBooksActing.setCurrency(a && a.currency); }, function () { /* no currency learned: the figures show a dash, never a wrong symbol */ });
  }
  function load() {
    if (onActions()) return Promise.resolve();
    var report = current();
    if (report.k === 'periods') grantKit.viewState.choices = undefined; /* the Months list is read fresh each time it is opened */
    return choose().then(function () { return alive() ? knowCurrency() : null; }).then(function () { return !alive() ? null : report.k === 'periods' ? monthsOfPeriod() : readReport(report); });
  }
  /** the Months list: the months of the period's year, from the one read of the choices (no second trip) */
  function monthsOfPeriod() {
    var fy = grantKit.viewState.period && grantKit.viewState.period.fy;
    var c = grantKit.viewState.choices || {};
    /* E4: the lock line (books_start, lock_date, gaps) is the same /periods answer's: carried across, or lockLines() finds nothing to draw */
    grantKit.viewState.answer = { periods: (c.periods || []).filter(function (p) { return !fy || p.fiscal_year === fy; }), books_start: c.books_start || null, lock_date: c.lock_date || null, gaps: c.gaps || [] };
    grantKit.viewState.why = null;
    return Promise.resolve();
  }
  /** one read of the client's books through the grant (the seat's headers); a failure is kept for the frame to say */
  function readReport(report) {
    return root.CBBooksGrantApi.run(grantKit.viewState.o.call, report.ep, { query: grantKit.queryOf(report), headers: root.CBBooksActing.headers() }).then(
      function (answer) { keepAnswer(report, answer); },
      function (failure) { keepFailure(failure); }
    );
  }
  /** a read answered: the answer is kept and the shop's own clock and currency are taken from it */
  /** RW3-11: the books being read are the CLIENT's: its clock (the answer's `timezone`, the audited shop's own zone) writes every time on these screens, never the firm's or the device's; the viewer's own zone returns when the books close */
  var ownZone = null;
  function useClientZone(answer) {
    if (!answer || !answer.timezone || typeof root.shopZoneSet !== 'function') return;
    if (ownZone === null) ownZone = root.CB_SHOP_TZ || '';
    root.shopZoneSet(answer.timezone);
  }
  function backToOwnZone() {
    if (ownZone === null) return;
    root.shopZoneSet(ownZone, true);
    ownZone = null;
  }
  function keepAnswer(report, answer) {
    useClientZone(answer);
    grantKit.viewState.answer = answer;
    if (grantKit.viewState.o.onRead) grantKit.viewState.o.onRead(); /* the first books read answered 200: the seat the person chose may now be remembered */
    grantKit.viewState.why = null;
    root.CBBooksActing.setCurrency(answer && answer.currency);
  }
  /** a read failed: a 401 goes up to the page, anything else is said by the frame (never the server's raw word) */
  function keepFailure(failure) {
    if (failure.status === 401) throw failure;
    grantKit.viewState.answer = null;
    grantKit.viewState.why = true; /* the frame says it (CBShell.readFailed); the server's raw word is never printed */
    grantKit.viewState.failure = { status: failure.status || 0, detail: failure.status === 403 ? failure.message : '', code: failure.code || '' };
  }

  /* ── the screen ── */
  /** a phone (the header's 700 px rule) holds the screen pick as ONE select, not seven buttons */
  function phone() {
    return typeof root.matchMedia === 'function' && root.matchMedia('(max-width: 700px)').matches;
  }
  /** RW3-16: the return tab is named by the CLIENT's own pack. network.html loads no pack registry, so the word comes from the server: GET /periods answers `return_name` (BAS · VAT return) from the audited shop's pack, read before the first paint; Tax return only where it names none */
  function labelOf(r) {
    var own = r.k === 'bas' && grantKit.viewState.choices && grantKit.viewState.choices.return_name;
    return own || r.label;
  }
  function tabs() {
    if (phone()) return '';
    var all = [{ door: 'daybook', id: 'bv_daybook', testid: 'bv-daybook-open', label: 'Day book' }].concat(grantKit.REPORTS.map(function (r) {
      return { k: r.k, label: labelOf(r) };
    }));
    if (isAdviser()) all.push({ k: grantKit.ACTIONS, label: 'Actions' });
    if (!grantKit.viewState.why) all.push({ door: 'tb', id: 'bv_tb', testid: 'bv-tb-open', label: 'Trial balance' }, { door: 'pl', id: 'bv_pl', testid: 'bv-pl-open', label: 'Profit and loss' }, { door: 'bs', id: 'bv_bs', testid: 'bv-bs-open', label: 'Balance sheet' }); /* ONEP-2: owner screens opened in this seat, not read here */
    return all.map(tabButton).join('') + prepareButton() + bankButton();
  }
  /** ONE tab button definition: a read of this view (data-report) or a door to the owner's screen (a press opens it in the seat) */
  function tabButton(r) {
    var on = !r.door && grantKit.viewState.report === r.k;
    return '<button data-cbsid="NET005-B02" type="button" id="' + (r.door ? r.id : 'bv_tab_' + r.k) + '" class="act' + (on ? '' : ' quiet') + '"' + (r.door ? '' : ' data-report="' + r.k + '" aria-pressed="' + on + '"') + ' data-testid="' + (r.door ? r.testid : 'bv-tab-' + r.k) + '">' + esc(words(r.label)) + '</button>';
  }
  /** the phone's screen pick: the library Select (ui-select.js, as period-pick.js uses) with the same screens as the buttons, and the Bank / Prepare ways as its last lines; the address follows the pick (onView) */
  var DOORS = { _daybook: 'daybook', _tb: 'tb', _pl: 'pl', _bs: 'bs' }; /* the phone pick's lines that open the owner's screens */
  function tabSelect() {
    if (!phone() || grantKit.viewState.why || !root.ui || typeof root.ui.select !== 'function') return '';
    var options = [{ value: '_daybook', label: words('Day book') }].concat(grantKit.REPORTS.map(function (r) { return { value: r.k, label: words(labelOf(r)) }; }));
    options.push({ value: '_tb', label: words('Trial balance') }, { value: '_pl', label: words('Profit and loss') }, { value: '_bs', label: words('Balance sheet') });
    if (isAdviser()) options.push({ value: grantKit.ACTIONS, label: words('Actions') }, { value: '_prepare', label: words('Prepare a journal') });
    else options.push({ value: '_bank', label: words('Bank') });
    return '<span class="bv-tabsel" data-testid="bv-tabsel">' + root.ui.select({
      mount: 'NET005-U02', label: 'Books', bare: true, id: 'bv_tabsel', testid: 'bv-tab-select', value: grantKit.viewState.report, options: options,
      onChange: function (value) {
        if (value === '_prepare') return openPrepare();
        if (value === '_bank') return openBank();
        if (DOORS[value]) return openDoor(DOORS[value]);
        grantKit.viewState.report = value;
        tell();
        reload().then(function () { var box = $('bv_tabsel'); if (box) box.focus(); });
      }
    }) + '</span>';
  }
  /** W15-71: the auditor's way to the client's Bank (home, kept statements, a month's lines, who matched, the sign-off) and Month lock: the books page in the auditor's seat, read only */
  /** ONEP-2: the trial balance is the OWNER's screen (accounts.html, tab tb) opened in this seat: this view reads no trial balance of its own. The period rides in the address (E10 carry) */
  /** ONEP-2: the P&L is the OWNER's screen too. The window rides as from= and to= (a financial year is given by toAddress as fy= only, so its own dates ride too) */
  function openDoor(tab, window) {
    var report = grantKit.viewState.report;
    var carry = (report ? '&view=' + encodeURIComponent(report) : '') + (window || periodWords(grantKit.viewState.period)) + asked(); /* the bell's own words (a Query or a note to open) ride to the owner's Day book */
    root.location.assign(root.CBBooksActing.auditAddressOf(root.CBBooksActing.current().store, tab, carry, isAdviser() ? 'adviser' : 'auditor'));
  }
  /** the period in force as address words; a year is carried as fy= and, for the owner screen, its own dates */
  function periodWords(period) {
    if (!period) return '';
    var span = period.kind === 'year' && period.from && period.to ? '&from=' + encodeURIComponent(period.from) + '&to=' + encodeURIComponent(period.to) : '';
    return root.CBPeriodPick.toAddress(period) + span;
  }
  function bankButton() {
    return !isAdviser() && !grantKit.viewState.why ? '<button data-cbsid="NET005-B10" type="button" class="act quiet" id="bv_bank" data-testid="bv-bank">' + esc(words('Bank')) + '</button>' : '';
  }
  function openBank() {
    var report = grantKit.viewState.report, carry = (report ? '&view=' + encodeURIComponent(report) : '') + (grantKit.viewState.period ? root.CBPeriodPick.toAddress(grantKit.viewState.period) : ''); /* E10: the screen and the period ride to Bank and back */
    root.location.assign(root.CBBooksActing.auditAddressOf(root.CBBooksActing.current().store, 'bank', carry));
  }
  /** the adviser's way to prepare a journal: the owner's books page, opened to act for this store (CBBooksActing.addressOf), where Save prepares (or posts, when the owner's grant says adviser_posts) */
  function prepareButton() {
    return isAdviser() && !grantKit.viewState.why ? '<button data-cbsid="NET005-B03" type="button" class="act" id="bv_prepare" data-testid="bv-prepare">' + esc(words('Prepare a journal')) + '</button>' : '';
  }
  function openPrepare() {
    root.location.assign(root.CBBooksActing.addressOf(root.CBBooksActing.current().store, 'journal'));
  }
  /** the band: an auditor is told it is read only; an adviser gets the frozen banner naming the store and its currency, with the store switch */
  function band(report) {
    var ctx = grantKit.viewState.why ? '' : '<span class="bv-ctx" data-testid="bv-ctx">' + grantKit.asAt(report) + grantKit.dayPick(report) + '</span>' + (grantKit.viewState.why ? '' : grantKit.lockLines(report)) + tabSelect(); /* the date the figures stand at, with its Day pick: one place, the header line; the period dropdown says the period, so the Period tag is only the fallback */
    root.CBBooksActing.css(); /* the one header line's rules, for the auditor's band too (the adviser's banner draws them itself) */
    if (isAdviser()) return root.CBBooksActing.banner(grantKit.viewState.o.stores, screenName(), false, ctx);
    return (
      '<div class="bv-band" role="status" data-testid="bv-band">' + root.CBBooksActing.crumbs(screenName(), false) + '<span class="tag bv-ro" data-testid="bv-readonly">' + esc(words('read only')) + '</span>' + ctx + root.CBBooksActing.periodSlot() +
      '<button data-cbsid="NET005-B01" type="button" class="act quiet" id="bv_back" data-testid="bv-back">← ' + esc(words('Clients')) + '</button></div>'
    );
  }
  /** the name of the screen on show, for the breadcrumb */
  function screenName() {
    if (onActions()) return words('Queues');
    var r = grantKit.REPORTS.filter(function (x) { return x.k === grantKit.viewState.report; })[0];
    return r ? words(labelOf(r)) : '';
  }
  /** l16 R4-2b: a screen of the client's books is a history entry: the page is told (onView) so Back and Forward can restore it */
  function tell() {
    if (grantKit.viewState.o.onView) grantKit.viewState.o.onView(grantKit.viewState.report, grantKit.viewState.period);
  }
  function wireBand() {
    var back = function () { root.CBBooksActing.leave(); grantKit.viewState.o.onBack(); };
    if (isAdviser()) root.CBBooksActing.wireBanner(grantKit.viewState.host, { onBack: back, onSwitch: grantKit.viewState.o.onSwitch });
    else $('bv_back').onclick = back;
  }
  /** the screen pick changes form at the phone width: repaint once when the width crosses it (bound once per page) */
  var breakpointBound = false;
  function followBreakpoint() {
    if (breakpointBound || typeof root.matchMedia !== 'function') return;
    breakpointBound = true;
    var query = root.matchMedia('(max-width: 700px)'), again = function () { if (grantKit.viewState.host && grantKit.viewState.host.isConnected && grantKit.viewState.report) paint(); };
    if (query.addEventListener) query.addEventListener('change', again);
  }
  function paint() {
    followBreakpoint();
    var report = onActions() ? { day: null, facts: [] } : current();
    grantKit.viewState.host.innerHTML =
      band(report) +
      '<div class="nw-acts bv-tabrow" data-testid="bv-tabs" role="group" aria-label="' + esc(words('Books')) + '">' + tabs() +
      (grantKit.viewState.why ? '' : '<span class="bv-totals">' + grantKit.facts(report) + '</span>') + '</div>' +
      (grantKit.viewState.why ? '<div class="nw-why" id="bv_why" data-testid="bv-why"></div>' : '') +
      '<div class="nw-list" id="bv_list" data-testid="bv-list"></div>';
    wirePainted(report);
  }
  /** the failure frame: a 403 the server named by a code says why and what to do and the way back to his queue (W19); anything else is the one frame as before */
  function drawWhy(host) {
    var failure = grantKit.viewState.failure || {};
    if (failure.status === 403 && failure.code) return root.CBBooksGrantApi.closedFrame(host, words('These books'), failure.code, failure.detail);
    return root.CBShell.readFailed(host, { what: words('These books'), status: failure.status, detail: failure.detail, retry: function () { reload(); } });
  }
  /** the painted screen's controls are wired: the band, the failure frame, the period slot, the buttons, the day box and the list */
  function wirePainted(report) {
    wireBand();
    if (grantKit.viewState.why && $('bv_why')) drawWhy($('bv_why'));
    fillPeriodSlot(report);
    if ($('bv_prepare')) $('bv_prepare').onclick = openPrepare;
    if ($('bv_bank')) $('bv_bank').onclick = openBank;
    ['daybook', 'tb', 'pl', 'bs'].forEach(function (tab) { /* the buttons that open the owner's screens in this seat */
      if ($('bv_' + tab)) $('bv_' + tab).onclick = function () { openDoor(tab); };
    });
    wireTabButtons();
    if (onActions()) grantKit.mountQueues();
    else if (!grantKit.viewState.why) paintList(report);
  }
  /** a tab press opens that read and gives the tab focus */
  function wireTabButtons() {
    Array.prototype.forEach.call(grantKit.viewState.host.querySelectorAll('[data-report]'), function (button) {
      button.onclick = function () {
        grantKit.viewState.report = button.getAttribute('data-report');
        tell();
        reload().then(function () {
          $('bv_tab_' + grantKit.viewState.report).focus();
        });
      };
    });
    if ($('bv_day')) $('bv_day').onchange = pickDay;
  }
  /** the list of the read on screen */
  function paintList(report) {
    grantKit.paintRows($('bv_list'), report);
  }
  function pickDay() {
    grantKit.viewState.day = $('bv_day').value;
    reload();
  }
  /** a row opens what is behind it (ACC-176c): an account's ledger (a code on the row), or the journal entry a Day book row is; books-grant-drill.js paints both, read only */
  function drill(report, row) {
    var ctx = { mk: grantKit.viewState.mk, ev: grantKit.viewState.ev, call: grantKit.viewState.o.call, sheet: grantKit.viewState.o.sheet, mountList: grantKit.viewState.o.mountList, day: grantKit.viewState.day, period: grantKit.viewState.period /* D1 (A3C): the ledger opens on the period the trial balance was read for, not on this year to today */, currency: grantKit.viewState.answer && grantKit.viewState.answer.currency };
    if (report.drill === 'entry') root.CBBooksGrantDrill.openEntry(ctx, row, ctx.currency, null);
    else if (row.code) root.CBBooksGrantDrill.openLedger(ctx, { code: row.code, name: row.name });
  }
  /** E9: the client is still open (CBBooksActing holds its context). After "← Clients" the context is gone: a read still in flight must neither be sent without the store's header nor paint a band that names it */
  function alive() {
    return !!root.CBBooksActing.current();
  }
  function reload() {
    var mine = grantKit.viewState;
    return load().then(function () { if (alive() && grantKit.viewState === mine) paint(); }, function () {
      if (grantKit.viewState.o.onEnded) grantKit.viewState.o.onEnded();
    });
  }
  var stopForgetting = null;
  /** the answer and the day of the store that was open are forgotten when the store changes */
  function forget() {
    backToOwnZone();
    grantKit.viewState = { host: grantKit.viewState.host, o: grantKit.viewState.o, report: homeOf(grantKit.viewState.o), day: '', answer: null, why: null, period: null, range: null, choices: undefined };
  }
  /** after Open books: focus lands on the books heading (the acting band), not on a button that has gone */
  function focusHeading() {
    var head = $('ba_band');
    if (!head) return; /* E18: no heading, no focus: the whole pane took a black outline */
    head.setAttribute('tabindex', '-1');
    head.focus();
  }
  var pendingAsked = askedWords(); /* read when this script loads: the bell's words ride to the owner's Day book, which opens them once */
  /** the bell's words (a Query to open: &mark= with &mday=, a note: &note= with &nl=) as address words */
  function askedWords() {
    var out = '';
    try {
      var query = new root.URLSearchParams(root.location.search);
      ['note', 'mark', 'mday', 'nl'].forEach(function (name) { if (query.get(name)) out += '&' + name + '=' + encodeURIComponent(query.get(name)); });
    } catch (failure) {
      if (root.cbQuiet) root.cbQuiet('books-grant:note-address', failure);
    }
    return out;
  }
  /** the bell's words as the door carries them (once) */
  function asked() {
    var held = pendingAsked;
    pendingAsked = '';
    return held;
  }
  /** the state of a view just opened: the read asked for, else the first one this view has */
  function openedState(host, options, fresh) {
    return { host: host, o: options, report: fresh ? homeOf(options) : options.view, day: '', answer: null, why: null, period: options.period || null, range: null, choices: undefined };
  }
  function mount(host, options) {
    var fresh = !viewKnown(options.view);
    grantKit.viewState = openedState(host, options, fresh);
    root.CBBooksActing.enter({ id: options.member.id, name: options.member.name }, options.member.role === 'adviser' ? 'adviser' : 'auditor', options.member.posting);
    if (stopForgetting) stopForgetting();
    stopForgetting = root.CBBooksActing.onClear(forget);
    if (fresh) openDoor('daybook'); /* a client opens on the owner's Day book: the door. The way back carries view=<the first read>, so it is never opened twice */
    else Promise.resolve(reload()).then(focusHeading, focusHeading);
    return {
      /** Back or Forward to another screen of this client's books */
      setView: function (report, period) {
        var moved = period !== undefined && !root.CBPeriodPick.same(period && period.from ? period : grantKit.viewState.period, grantKit.viewState.period);
        if (!viewKnown(report) || (report === grantKit.viewState.report && !moved)) return;
        grantKit.viewState.report = report;
        if (period !== undefined) usePeriod(root.CBPeriodPick.filled(period, grantKit.viewState.choices) || period);
        reload();
      },
      destroy: function () {
        backToOwnZone();
        host.innerHTML = '';
      }
    };
  }
  root.CBBooksGrantView = { mount: mount, duesVoice: grantKit.duesVoice };
})(typeof window !== 'undefined' ? window : globalThis);
