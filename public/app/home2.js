/* home2.js — CBHome2: the one-page Home (index.html, UX-127, Athi 18 and 21 Nov 2026). The old long Home is gone: one Home, no switch.
 * OWNS      the layout of the one Home (Fable review 18 Nov): a Do-first row, six pillar rows as an accordion (one open, at most 5 lines laptop / 6 phone, then the pillar sheet), Labs · Standards · Setup in the foot, and the switch with its per-viewer preference.
 * CALLED BY index.html (mount; `out` = signed out, which draws the showcase tiles, not the shop's rows)
 * FLOW      CBShell.mount draws the frame and the cards and READS their facts as ever (one source, no second fetch path); this file only MOVES those same
 *           card nodes into the pillar panels named by manifest.json `home2`, and reads the digit off the facts the shell already painted.
 * CARD      26-reporting-mis-and-bi/home-facts
 */
(function (root) {
  'use strict';
  if (root.CBHome2) return;
  var OPEN_KEY = 'cb_home2_open';
  var doc = root.document;
  var PLAIN_WORDS = { compare: 'Compare with your old books' };
  var ALIAS = { selling: 'sell', money: 'money', running: 'buy', trade: 'trade', sell: 'sell', customers: 'customers', buy: 'buy', people: 'people' };
  var ROW_SHAPE = { items: '.ix-item', key: 'data-pillar', row: '.ix-row', panel: '.ix-panel' };
  var live = null;
  var pending = null;

  /** a label through the page's string layer (English until a pack lands) */
  function sayText(label) {
    return typeof root.tx === 'function' ? root.tx(label) : label;
  }
  /** a failure that changes nothing the person sees (a browser that keeps nothing): logged quietly where the page has the one logger */
  function quiet(where, failure) { if (typeof root.cbQuiet === 'function') root.cbQuiet(where, failure); }
  /** one stored word of this viewer, '' when the browser refuses or keeps none */
  function lsGet(key) {
    try {
      return root.localStorage.getItem(key) || '';
    } catch (failure) {
      quiet('home2:read', failure);
      return '';
    }
  }
  /** store one word for this viewer; a browser that keeps nothing: the choice simply does not stick */
  function lsSet(key, value) {
    try {
      root.localStorage.setItem(key, value);
    } catch (failure) {
      quiet('home2:write', failure);
    }
  }
  /** a card's state rank: needs you 0, in use 1, anything else 2, not started 3 (UX-221: the seat's lead card, the Till for Counter staff, is never folded: not started counts as in use for it) */
  function rank(card) {
    var stateNode = card.querySelector('[data-state]'), state = stateNode ? stateNode.getAttribute('data-state') : '';
    return state === 'needs_you' ? 0 : state === 'in_use' || (state === 'not_started' && lead(card)) ? 1 : state === 'not_started' ? 3 : 2;
  }
  /** a card's first fact as the shell painted it ('' for the dash) */
  function factOf(card) {
    var fact = card.querySelector('.facts .f.dn') || card.querySelector('.facts .f:not(.trendf)');
    var text = fact ? (fact.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return text === '—' ? '' : text;
  }
  /** a card's name, the text of its heading */
  function nameOf(card) {
    var heading = card.querySelector('h4');
    return heading ? (heading.textContent || '').trim() : '';
  }
  /** the row's line when no card needs you and none in use has a fact: its first step, never a 0 */
  function firstStepHeadline(cards) {
    var first = cards[0];
    return { n: '', w: '', full: first ? sayText('Set up') + ' ' + nameOf(first) : '', tone: 'q', amber: 0 }; /* nothing started: the row says nothing (the Start here row names the steps), never the same "Set up ›" six times */
  }
  /** RW3-07: the first two words of what a figure counts, and a third when the second is only a connector (3 letters or fewer: to, of, in, on, for, and): "23 entries to fix", never "23 entries to" */
  function firstWords(text) {
    var words = String(text).split(/ +/).filter(Boolean), keep = words.slice(0, 2);
    if (words.length > 2 && keep[1].length <= 3) keep.push(words[2]);
    return keep.join(' ');
  }
  /** the figure and the words of a closed row from one fact: the leading number, then the first two words of what it counts (a 0 is never shown) */
  function figureOf(fact, pick) {
    var parts = /^(\S*\d\S*)\s*(.*)$/.exec(fact);
    var num = parts && !/^0\b/.test(parts[1]) ? parts : null;
    /* closed row = ONE figure + ONE word (Fable review §3): the figure, then the first two words of what it counts; the whole fact rides the title */
    var rest = num ? firstWords(num[2].split(' · ')[0]) : fact || nameOf(pick);
    return { n: num ? num[1] : '', w: rest };
  }
  /* a row's one figure: the first needs-you fact, else the first fact of a card in use, else its first step (never a 0) */
  function headline(panel) {
    var cards = [].slice.call(panel.querySelectorAll('.cbsh-box')), needs = cards.filter(function (card) { return rank(card) === 0; });
    var pick = needs[0] || cards.filter(function (card) { return rank(card) === 1 && factOf(card); })[0];
    if (!pick) return firstStepHeadline(cards);
    var fact = factOf(pick), figure = figureOf(fact, pick);
    return { n: figure.n, w: figure.w, full: fact, tone: needs.length ? 'dn' : '', amber: needs.length, trend: trendOf(panel) };
  }
  /** the sales change against last year, as the Till card's teaser says it ("↑ +12% vs last year") split for a closed row: the arrow and percent shown, "vs last year" in the title and the spoken label; null when the server sent none. Leader practice (Shopify, Stripe, Xero home): the change rides the headline sales figure as a small delta, never a card of its own that a closed row hides. */
  function trendOf(panel) {
    var node = panel.querySelector('[data-testid="shell-fact-trend"]'), words = node ? (node.textContent || '').replace(/\s+/g, ' ').trim() : '';
    var parts = /^(\S+\s*\S*%)\s+(.+)$/.exec(words);
    return parts ? { short: parts[1], full: words } : null;
  }

  /** the manifest's pillars and foundation as groups, and which group owns each card id */
  function groupIndex(cfg) {
    var groups = cfg.pillars.concat(cfg.foundation), owner = {}, byId = {};
    groups.forEach(function (group) {
      byId[group.id] = group;
      group.ids.forEach(function (id) { owner[id] = group; });
    });
    return { groups: groups, owner: owner, byId: byId };
  }
  /** the state every step of one mounted Home reads and moves: the shell and host, the groups, the nodes drawn, the open sheet */
  function newState(shell, host, manifest, out) {
    var index = groupIndex(manifest.home2);
    return {
      shell: shell,
      out: !!out,
      host: host,
      manifest: manifest,
      cfg: manifest.home2,
      phone: root.matchMedia ? root.matchMedia('(max-width:700px)') : { matches: false },
      groups: index.groups,
      owner: index.owner,
      byId: index.byId,
      base: manifest.rail && manifest.rail.route ? String(manifest.rail.route).split(/[?#]/)[0] : '',
      items: {},
      panels: {},
      work: { figures: null },
      sheetOwner: null,
      queued: false,
      list: null,
      df: null,
      dlg: null
    };
  }
  /** one pillar row: the closed line (glyph, name, figure, amber count, chevron) and its panel, hidden until a card lands in it */
  function pillarHTML(group, out) {
    var glyph = group.icon === '¤' ? '<span data-glyph="money">¤</span>' : esc(group.icon);
    var tile = group.line ? '<span class="ix-l">' + esc(sayText(group.line)) + '</span>' : '';
    return (
      '<div class="ix-item" data-pillar="' + group.id + '"' + (out ? '' : ' hidden') + '>' +
      '<button type="button" class="ix-row" id="ixh-' + group.id + '" aria-expanded="false" aria-controls="ixp-' + group.id + '" data-cbsid="HOM001-B06" data-testid="ix2-row-' + group.id + '">' +
      '<span class="ix-g" aria-hidden="true">' + glyph + '</span><span class="ix-n">' + esc(sayText(group.name)) + '</span>' + (out ? tile : '') +
      '<span class="ix-v" data-testid="ix2-digit-' + group.id + '"></span><b class="ix-a" hidden></b><span class="ix-c" aria-hidden="true">▾</span></button>' +
      '<div class="ix-panel" id="ixp-' + group.id + '" role="region" aria-labelledby="ixh-' + group.id + '" hidden data-cbsid="HOM001-P17" data-testid="ix2-panel-' + group.id + '"></div></div>'
    );
  }
  /** one foundation word of the foot (Labs · Standards · Setup): its press opens the pillar sheet */
  function footWordHTML(group) {
    return '<button type="button" class="ix-fw" data-pillar="' + group.id + '" data-cbsid="HOM001-B09" data-testid="ix2-foot-' + group.id + '">' + esc(sayText(group.name)) + ' ›</button>';
  }
  /** the whole Home 2: the Do-first row, the pillar rows, the foot and the one pillar sheet */
  function heroHTML() {
    return (
      '<div class="ix-hero" data-cbsid="HOM001-P20" data-testid="ix2-hero"><b>' + esc(sayText('One shop, one set of numbers')) + '</b>' +
      '<span class="ix-hd"><button type="button" class="ix-door pri" data-door="in" data-cbsid="HOM001-B24" data-testid="ix2-door-signin">' + esc(sayText('Sign in')) + '</button>' +
      '<button type="button" class="ix-door" disabled aria-disabled="true" title="' + esc(sayText('The guided tour is coming')) + '" data-cbsid="HOM001-B25" data-testid="ix2-door-tour">' + esc(sayText('See it work')) +
      ' · ' + esc(sayText('coming')) + '</button></span></div>'
    );
  }
  function hostHTML(cfg, out) {
    return (
      (out ? heroHTML() : '<div class="df" data-cbsid="HOM001-P18" data-testid="ix2-dofirst"></div>') + '<div class="ix-list">' +
      cfg.pillars.map(function (group) { return pillarHTML(group, out); }).join('') +
      '</div><div class="ix-foot" data-testid="ix2-foot">' +
      cfg.foundation.map(footWordHTML).join('') +
      '<span class="ix-fs"></span></div>' +
      '<dialog class="ix-sheet" data-pop="POP216" data-cbsid="HOM001-P19" data-testid="ix2-sheet" aria-labelledby="ix2-sheet-title"><div class="ix-sh-h"><b id="ix2-sheet-title"></b><button type="button" class="ix-x" data-cbsid="HOM001-B08" aria-label="' +
      esc(sayText('Close')) + '">✕</button></div><div class="ix-sh-b"></div></dialog>'
    );
  }
  /** draw the host, find its parts, make the foundation panels (they live detached until their foot word opens the sheet) and move the Sides buttons into the foot */
  function drawHost(home) {
    home.host.setAttribute('data-testid', 'ix2');
    home.host.className = 'ix';
    home.host.innerHTML = hostHTML(home.cfg, home.out);
    home.host.classList.toggle('out', home.out);
    home.list = home.host.querySelector('.ix-list');
    home.df = home.host.querySelector('.df');
    home.dlg = home.host.querySelector('dialog');
    [].forEach.call(home.host.querySelectorAll('.ix-item'), function (node) {
      home.items[node.getAttribute('data-pillar')] = node;
      home.panels[node.getAttribute('data-pillar')] = node.querySelector('.ix-panel');
    });
    home.cfg.foundation.forEach(function (group) {
      var panel = doc.createElement('div');
      panel.className = 'ix-panel';
      panel.setAttribute('data-testid', 'ix2-panel-' + group.id);
      home.panels[group.id] = panel;
    });
    var tools = (home.shell.el || doc).querySelector('.cbsh-tools');
    if (tools) home.host.querySelector('.ix-fs').appendChild(tools);
  }

  function lead(card) { return root.CBEdition && root.CBEdition.isLead(idOf(card)) ? 1 : 0; } /* UX-221: 1 when this card is the entry the seat works from first (the Till for Counter staff) */
  /** the id of a card node */
  function idOf(node) {
    return node.getAttribute('data-id') || (node.getAttribute('data-testid') || '').replace('shell-chip-', '');
  }
  /** the cards (boxes and short cards) now in a panel */
  function cardsOf(panel) {
    return [].slice.call(panel.children).filter(function (child) { return child.classList.contains('cbsh-box') || child.classList.contains('cbsh-sc'); });
  }
  /** the panel's own line button of that class (the fold line, the "All of" line), made on first use */
  function lineOf(panel, cls) {
    var node = panel.querySelector('.' + cls);
    if (!node) {
      node = doc.createElement('button');
      node.type = 'button';
      node.className = 'ix-ln ' + cls;
      panel.appendChild(node);
    }
    return node;
  }
  /** set a node's text only when it changed (no needless repaint) */
  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }
  /** the group's cards in order (needs you first, then in use, then the manifest's own order), moved into that order when they are not */
  function orderedCards(home, id) {
    var group = home.byId[id], panel = home.panels[id], cards = cardsOf(panel);
    var want = cards.slice().sort(function (left, right) { return lead(right) - lead(left) || rank(left) - rank(right) || group.ids.indexOf(idOf(left)) - group.ids.indexOf(idOf(right)); });
    if (want.some(function (card, index) { return card !== cards[index]; })) want.forEach(function (card) { panel.insertBefore(card, panel.querySelector('.ix-ln')); });
    return want;
  }
  /** hide what does not fit (at most 5 on a laptop, 6 on a phone; not-started cards fold into one line): the counts of the cards shown and folded */
  function hideOverflow(home, want, full) {
    var limit = full ? 1e3 : home.phone.matches ? 6 : 5, shown = 0, fold = 0;
    want.forEach(function (card) {
      var hide = !full && rank(card) === 3 ? (fold++, true) : shown >= limit;
      if (!hide) shown++;
      if (card.hidden !== hide) card.hidden = hide;
    });
    return { shown: shown, fold: fold };
  }
  /** the fold line ("n not set up yet ›") and the "All of …" line of an open row */
  function paintLines(home, id, want, counts, full) {
    var panel = home.panels[id], foldLine = lineOf(panel, 'ix-fold'), allLine = lineOf(panel, 'ix-all'), hidden = want.length - counts.shown - counts.fold;
    foldLine.hidden = !counts.fold || full;
    allLine.hidden = full || !(hidden > 0 || counts.fold);
    setText(foldLine, counts.fold + ' ' + sayText('not set up yet') + ' ›');
    setText(allLine, sayText('All of') + ' ' + sayText(home.byId[id].name) + ' (' + want.length + ') ›');
    foldLine.setAttribute('data-sheet', id);
    allLine.setAttribute('data-sheet', id);
  }
  /* what an open row shows: needs-you lines first, then in use; not-started ones fold into one line; at most 5 (laptop) or 6 (phone), then "All of …" */
  function layout(home, id, full) {
    var want = orderedCards(home, id);
    paintLines(home, id, want, hideOverflow(home, want, full), full);
    return want;
  }
  /* never scroll: if the open row does not fit, drop its last line (the fold and "All of" lines carry the rest) */
  function fitRow(home, id) {
    var panel = home.panels[id];
    if (panel.hidden || panel.parentNode === home.dlg.querySelector('.ix-sh-b')) return;
    var cards = layout(home, id, false), visible = cards.filter(function (card) { return !card.hidden; });
    while (visible.length > 1 && panel.scrollHeight > panel.clientHeight + 1) {
      visible.pop().hidden = true;
      lineOf(panel, 'ix-all').hidden = false;
      setText(lineOf(panel, 'ix-all'), sayText('All of') + ' ' + sayText(home.byId[id].name) + ' (' + cards.length + ') ›');
    }
  }
  /** a row's closed line: its one figure and word, the amber count of what needs you; the row hides while it has no card */
  function paintRow(home, group) {
    var item = home.items[group.id], count = cardsOf(home.panels[group.id]).length;
    item.hidden = !count;
    if (!count) return;
    var head = headline(home.panels[group.id]), figureNode = item.querySelector('.ix-v'), amberNode = item.querySelector('.ix-a');
    figureNode.className = 'ix-v ' + head.tone;
    if (head.full) figureNode.title = head.full; else figureNode.removeAttribute('title');
    figureNode.innerHTML = (head.n ? '<b>' + esc(head.n) + '</b> ' : '') + '<span>' + esc(head.w) + '</span>' +
      (head.trend ? ' <span class="ix-tr" data-testid="ix2-trend" title="' + esc(head.trend.full) + '" aria-label="' + esc(head.trend.full) + '">' + esc(head.trend.short) + '</span>' : '');
    amberNode.hidden = !head.amber;
    if (head.amber) {
      amberNode.textContent = String(head.amber);
      amberNode.title = sayText('need you');
    }
  }
  /** a card's heading in the plain words Home uses, once */
  function plainName(card) {
    var id = idOf(card), heading = card.querySelector('h4');
    if (PLAIN_WORDS[id] && heading && heading.getAttribute('data-say') !== PLAIN_WORDS[id]) {
      heading.textContent = sayText(PLAIN_WORDS[id]);
      heading.setAttribute('data-say', PLAIN_WORDS[id]);
    }
  }

  /** every card of the pillar rows (the foot's foundation panels are not counted) */
  function pillarCards(home) {
    var all = [];
    home.cfg.pillars.forEach(function (group) { all = all.concat(cardsOf(home.panels[group.id]).filter(function (card) { return card.classList.contains('cbsh-box'); })); });
    return all;
  }
  /** the doors of the Do-first row, in order: each card that needs you, then new orders, then tasks for you (a figure above zero only) */
  function doorsOf(home, allCards) {
    var doors = [], figures = (home.work.figures && home.work.figures.figures) || {};
    allCards.filter(function (card) { return rank(card) === 0; }).forEach(function (card) {
      doors.push({ n: 1, t: factOf(card) || nameOf(card) + ' · ' + sayText('needs you'), h: card.getAttribute('href') });
    });
    if (Number(figures.orders_new) > 0) doors.push({ n: Number(figures.orders_new), t: figures.orders_new + ' ' + sayText('new orders'), h: home.base + '?view=orders_in' });
    if (Number(figures.tasks_mine) > 0) doors.push({ n: Number(figures.tasks_mine), t: figures.tasks_mine + ' ' + sayText('tasks for you'), h: home.base + '?view=tasks' });
    return doors;
  }
  /** how many THINGS need you: a card is one, the orders door is its order count, the tasks door its task count; the big digit and the bell's dot both read this, never the number of doors (12 orders and 4 tasks are 16, not 2) */
  function needsCount(doors) {
    return doors.reduce(function (sum, door) { return sum + (door.n || 1); }, 0);
  }
  /** one door of the Do-first row as a link */
  function doorLinkHTML(door) {
    return '<a href="' + esc(door.h || '#') + '">' + esc(door.t) + ' ›</a>';
  }
  /** the first steps of a shop with nothing started */
  function firstRunHTML(home) {
    var steps = [['shop', 'Add your business'], ['catalogue', 'Add what you sell'], ['till', 'Make the first bill']].map(function (step, index) {
      var entry = (home.manifest.entries || []).filter(function (candidate) { return candidate.id === step[0]; })[0];
      return entry && entry.route ? '<a href="' + esc(home.shell.route ? home.shell.route(entry) : entry.route) + '" data-cbsid="HOM001-B23" data-testid="ix2-step-' + step[0] + '"><i>' + (index + 1) + '</i>' + esc(sayText(step[1])) + '</a>' : '';
    });
    return '<span class="df-t">' + esc(sayText('Start here')) + '</span><span class="df-i">' + steps.join('') + '</span>';
  }
  /** the needs-you count as the biggest digit, then up to 3 doors (1 on a phone), then "+n" for the rest */
  function doorsHTML(home, doors) {
    var cap = home.phone.matches ? 1 : 3, shownDoors = doors.slice(0, cap);
    return '<b class="df-n" data-testid="ix2-do-count">' + needsCount(doors) + '</b><span class="df-t">' + esc(sayText('Do first')) + '</span><span class="df-i">' +
      shownDoors.map(doorLinkHTML).join('') + '</span>' +
      (doors.length > cap ? '<button type="button" class="ix-more" data-more="1" data-cbsid="HOM001-B23">+' + (doors.length - cap) + '</button>' : '');
  }
  /* Do first: the needs-you count as the biggest digit, then up to 3 doors (verb + count + door); nothing = one quiet line; a shop with nothing started = its first steps */
  function doFirst(home) {
    if (!home.df) return; /* the host was replaced (a signed-out row over Home, ?cleaned=1): nothing to paint into */
    var allCards = pillarCards(home), doors = doorsOf(home, allCards);
    var started = allCards.some(function (card) { return rank(card) < 2; }), firstRun = home.shell.manifest && allCards.length > 0 && !started && !doors.length;
    home.host.classList.toggle('first', firstRun);
    var html = firstRun ? firstRunHTML(home) : !doors.length ? '<span class="df-t q">' + esc(sayText('Nothing needs you')) + '</span>' : doorsHTML(home, doors);
    if (home.df.getAttribute('data-sig') !== html) {
      home.df.setAttribute('data-sig', html);
      home.df.innerHTML = html;
    }
    home.df._items = doors;
    /* FW-39: the bell's dot is the Activity feed's unread count on EVERY page (what its popup lists); Home no longer swaps in the Do-first size, which made 1 here and 3 on the next page. CBBell.setNeeds stays for a page that really wants it. */
  }
  /* the shell draws (and, for a firm, redraws) its cards into .cbsh-more; every card keeps its own node, so the facts the shell paints keep landing in it */
  function adoptCards(home) {
    var more = (home.shell.el || doc).querySelector('.cbsh-more');
    if (!more) return;
    [].forEach.call(more.querySelectorAll('[data-id],[data-testid^="shell-chip-"]'), function (node) {
      var group = home.owner[idOf(node)];
      if (!group) return node.remove(); /* a `coming` chip stays: it shows grey with its word (Athi, 21 Nov: not ready = coming, still on the page) */
      var panel = home.panels[group.id], old = cardsOf(panel).filter(function (card) { return idOf(card) === idOf(node); })[0];
      if (old) old.remove();
      node.hidden = false;
      panel.insertBefore(node, panel.querySelector('.ix-ln'));
    });
  }
  /** every group's cards in plain words, every row's figure and fit, and the foot words that have a card behind them */
  function repaintGroups(home) {
    home.groups.forEach(function (group) {
      cardsOf(home.panels[group.id]).forEach(plainName);
      if (home.items[group.id]) paintRow(home, group);
      if (home.items[group.id] && !home.panels[group.id].hidden) fitRow(home, group.id);
    });
    [].forEach.call(home.host.querySelectorAll('.ix-fw'), function (button) { button.hidden = !home.out && !cardsOf(home.panels[button.getAttribute('data-pillar')]).length; });
  }
  /** take the shell's cards into their rows, then repaint the rows and the Do-first row */
  function adopt(home) {
    adoptCards(home);
    repaintGroups(home);
    doFirst(home);
  }
  /** adopt once on the next frame, however many changes ask for it */
  function later(home) {
    if (home.queued) return;
    home.queued = true;
    (root.requestAnimationFrame || root.setTimeout)(function () { home.queued = false; adopt(home); });
  }

  function open(home, id, keep) {
    root.CBShell.openRow(home.list, id, true, ROW_SHAPE); /* the shell's one way to open a row (shell.js openRow) */
    home.host.classList.toggle('has-open', !!id);
    if (!keep) lsSet(OPEN_KEY, id || '');
    if (id) fitRow(home, id);
  }
  /* the pillar sheet: ONE <dialog>; the pillar's own panel moves into it (every line, every state) and goes home on close */
  function sheet(home, id) {
    var panel = home.panels[id];
    home.sheetOwner = id;
    home.dlg.querySelector('.ix-sh-h b').textContent = sayText(home.byId[id].name);
    home.dlg.querySelector('.ix-sh-b').appendChild(panel);
    panel.hidden = false;
    layout(home, id, true);
    [].forEach.call(panel.querySelectorAll('.ix-ln'), function (button) { button.hidden = true; });
    if (home.dlg.showModal) home.dlg.showModal();
    else home.dlg.setAttribute('open', '');
  }
  /** one manifest entry as a showcase line: its name, what it does, and Live or Coming (a built, ready page is live; anything else is grey) */
  function showcaseLineHTML(entry) {
    var live = entry.ready !== false && entry.state === 'built' && !!entry.route; /* batch 1126 rule (a): Home reads the manifest's `ready`, a built-but-not-ready page is grey */
    return '<div class="ix-se' + (live ? '' : ' soon') + '" data-testid="ix2-show-' + esc(entry.id) + '"><b>' + esc(sayText(entry.name)) + '</b><i>' + esc(sayText(live ? 'Live' : 'Coming')) +
      '</i><span>' + esc(sayText(entry.what || '')) + '</span></div>';
  }
  /** a signed-out press on a tile or a foot word: the in-page panel of what that area does, every entry live or coming; no page change */
  function showcase(home, id) {
    var group = home.byId[id], entries = group.ids.map(function (key) { return (home.manifest.entries || []).filter(function (entry) { return entry.id === key; })[0]; }).filter(Boolean);
    home.sheetOwner = 'show';
    home.dlg.querySelector('.ix-sh-h b').textContent = sayText(group.name);
    home.dlg.querySelector('.ix-sh-b').innerHTML = '<p class="ix-sp">' + esc(sayText(group.line || '')) + '</p><div class="ix-sc">' + entries.map(showcaseLineHTML).join('') + '</div>';
    if (home.dlg.showModal) home.dlg.showModal();
    else home.dlg.setAttribute('open', '');
  }
  /** the Do-first doors in the sheet (the "+n" press) */
  function openDoSheet(home) {
    home.sheetOwner = 'do';
    home.dlg.querySelector('.ix-sh-h b').textContent = sayText('Do first');
    home.dlg.querySelector('.ix-sh-b').innerHTML = '<div class="ix-dl">' + (home.df._items || []).map(doorLinkHTML).join('') + '</div>';
    if (home.dlg.showModal) home.dlg.showModal();
  }
  /** the open sheet's panel goes home: back into its row (shown while the row is open), or detached again for a foot word */
  function sendPanelHome(home) {
    var id = home.sheetOwner;
    if (id && home.items[id]) {
      home.items[id].appendChild(home.panels[id]);
      home.panels[id].hidden = !home.items[id].classList.contains('open');
    } else if (id === 'do' || id === 'show') home.dlg.querySelector('.ix-sh-b').innerHTML = '';
    else if (id) home.panels[id].hidden = true;
  }
  /** close the sheet: its panel goes home, the dialog closes, the rows repaint */
  function closeSheet(home) {
    sendPanelHome(home);
    home.sheetOwner = null;
    if (home.dlg.close) {
      if (home.dlg.open) home.dlg.close();
    } else home.dlg.removeAttribute('open');
    adopt(home);
  }
  /** a press on the signed-out home: a door asks to sign in; a row or a foot word opens that pillar's showcase */
  function onSignedOutClick(home, target) {
    var tile = target.closest('.ix-row'), word = target.closest('.ix-fw'), door = target.closest('[data-door]');
    if (door) return root.dispatchEvent(new root.CustomEvent('cb-home-signin'));
    if (tile || word) return showcase(home, (tile ? tile.parentNode : word).getAttribute('data-pillar'));
  }
  /** a press in the host: a row opens or closes, a "sheet" line or a foot word opens the sheet, "+n" opens the Do-first doors */
  function onHostClick(home, event) {
    var target = event.target.closest ? event.target : null;
    if (!target) return;
    if (home.out) return onSignedOutClick(home, target);
    var row = target.closest('.ix-row'), sheetLine = target.closest('[data-sheet]'), foot = target.closest('.ix-fw'), more = target.closest('[data-more]');
    if (row && home.list.contains(row)) return open(home, row.getAttribute('aria-expanded') === 'true' ? '' : row.parentNode.getAttribute('data-pillar'));
    if (sheetLine) return sheet(home, sheetLine.getAttribute('data-sheet'));
    if (foot) return sheet(home, foot.getAttribute('data-pillar'));
    if (more) openDoSheet(home);
  }
  /** the host's listeners: the sheet's close, backdrop and X, the rows' presses, Escape, a resize */
  function wireEvents(home) {
    home.dlg.addEventListener('close', function () { if (home.sheetOwner) closeSheet(home); });
    home.dlg.querySelector('.ix-x').addEventListener('click', function () { closeSheet(home); });
    home.dlg.addEventListener('click', function (event) { if (event.target === home.dlg) closeSheet(home); });
    home.host.addEventListener('click', function (event) { onHostClick(home, event); });
    home.host.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !home.dlg.open) open(home, ''); });
    root.addEventListener('resize', function () { later(home); });
  }
  /** the first paint: adopt the cards, then open the row the address (or the last visit) names, or its sheet when it is a foundation word */
  function openFromAddress(home) {
    adopt(home);
    var hash = String(root.location.hash || '').replace('#', '');
    var start = ALIAS[hash] || lsGet(OPEN_KEY);
    if (start && home.items[start]) open(home, start, true);
    if (home.byId[hash] && !home.items[hash]) sheet(home, hash);
  }
  /** watch the shell's areas and every panel, so the facts the shell paints later are adopted too */
  function observeShell(home) {
    var observer = root.MutationObserver ? new root.MutationObserver(function () { later(home); }) : null;
    if (!observer) return;
    var areas = (home.shell.el || doc).querySelector('.cbsh-areas');
    if (areas) observer.observe(areas, { childList: true, subtree: true });
    Object.keys(home.panels).forEach(function (key) { observer.observe(home.panels[key], { childList: true, subtree: true, characterData: true }); });
  }
  /** mount Home 2 on a host: draw it, wire it, open the remembered row and keep adopting the shell's cards; null when the manifest has no `home2` or there is no host */
  function mount(shell, host, opts) {
    var manifest = shell.manifest && shell.manifest();
    if (!manifest || !manifest.home2 || !host) return null;
    var home = newState(shell, host, manifest, !!(opts && opts.out));
    drawHost(home);
    wireEvents(home);
    if (home.out) return { out: true, owner: home.owner };
    openFromAddress(home);
    observeShell(home);
    /* Your work: the same read index.html makes (one budgeted ask, the shell's); only a figure above zero is drawn, as a door in the Do-first row */
    return {
      open: function (id, keep) { return open(home, id, keep); },
      adopt: function () { return adopt(home); },
      owner: home.owner,
      setWork: function (figures) {
        home.work.figures = figures;
        doFirst(home);
      }
    };
  }
  /** mount, then hand over the figures that arrived before the mount */
  function mountAndKeep(shell, host, opts) {
    live = mount(shell, host, opts);
    if (live && live.setWork && pending) live.setWork(pending);
    return live;
  }
  /** the Your-work figures: straight to the mounted Home, or kept until it is */
  function setWork(figures) {
    if (live && live.setWork) live.setWork(figures);
    else pending = figures;
  }

  root.CBHome2 = { mount: mountAndKeep, setWork: setWork, headline: headline };
})(window);
