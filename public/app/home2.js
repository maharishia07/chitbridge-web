/* home2.js — CBHome2: the crisp one-page Home (index2.html, UX-127, Athi 18 Nov 2026) and the switch between it and the classic Home.
 * OWNS      the layout of index2 (Fable review 18 Nov): a Do-first row, six pillar rows as an accordion (one open, at most 5 lines laptop / 6 phone, then the pillar sheet), Labs · Standards · Setup in the foot, and the switch with its per-viewer preference.
 * CALLED BY index2.html (mount) · index.html (gate + switch link only)
 * FLOW      CBShell.mount draws the frame and the cards and READS their facts as ever (one source, no second fetch path); this file only MOVES those same
 *           card nodes into the pillar panels named by manifest.json `home2`, and reads the digit off the facts the shell already painted.
 * CARD      26-reporting-mis-and-bi/home-facts
 * The preference is the viewer's own (localStorage, wrapped: a browser that refuses it just shows the classic Home). No setting key yet — listed for cb-settings.
 * Facts follow (Athi 18 Nov: "follow the leaders"; the four sources below are from memory and UNVERIFIED here — nothing was fetched):
 *   Xero dashboard, QuickBooks home, Shopify home, Stripe dashboard each lead with a few headline numbers and a to-do list, details on demand (unverified).
 */
(function (root) {
  'use strict';
  if (root.CBHome2) return;
  var KEY = 'cb_home_layout'; /* 'new' | 'classic' — the viewer's own choice */
  var doc = root.document;

  function X(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pref() {
    try {
      return root.localStorage.getItem(KEY) || '';
    } catch (e) {
      return '';
    }
  }
  function setPref(v) {
    try {
      root.localStorage.setItem(KEY, v);
    } catch (e) {
      /* a browser that keeps nothing: the switch simply does not stick */
    }
  }
  /* classic Home: a viewer who chose the new one is taken there; true = going */
  function gate() {
    if (pref() !== 'new') return false;
    root.location.replace('/index2.html');
    return true;
  }
  /* the one small link, either way round: 'classic' draws "Try the new Home" (on index.html), 'new' draws "Back to classic" (on index2.html) */
  function switchHTML(from) {
    var toNew = from === 'classic';
    return (
      '<div class="ix-sw"><a data-cbsid="HOM001-B07" data-testid="home-switch" data-to="' + (toNew ? 'new' : 'classic') + '" href="' + (toNew ? '/index2.html' : '/') + '">' +
      esc(X(toNew ? 'Try the new Home' : 'Back to classic')) +
      '</a></div>'
    );
  }
  function wireSwitch(host) {
    var a = host.querySelector('[data-testid="home-switch"]');
    if (a)
      a.addEventListener('click', function () {
        setPref(a.getAttribute('data-to'));
      });
  }

  /* plain words for Home only (Fable review, 18 Nov: our words out of the top); the page behind keeps its own name */
  var SAY = { compare: 'Compare with your old books' };
  var ALIAS = { selling: 'sell', money: 'money', running: 'buy', trade: 'trade', sell: 'sell', customers: 'customers', buy: 'buy', people: 'people' };
  var OPEN_KEY = 'cb_home2_open';
  function lsGet(k) {
    try {
      return root.localStorage.getItem(k) || '';
    } catch (e) {
      return '';
    }
  }
  function lsSet(k, v) {
    try {
      root.localStorage.setItem(k, v);
    } catch (e) {
      /* kept nothing: the row simply is not remembered */
    }
  }
  function rank(card) {
    var st = card.querySelector('[data-state]'), s = st ? st.getAttribute('data-state') : '';
    return s === 'needs_you' ? 0 : s === 'in_use' ? 1 : s === 'not_started' ? 3 : 2;
  }
  function factOf(card) {
    var f = card.querySelector('.facts .f.dn') || card.querySelector('.facts .f:not(.trendf)');
    var t = f ? (f.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return t === '—' ? '' : t;
  }
  function nameOf(card) {
    var h = card.querySelector('h4');
    return h ? (h.textContent || '').trim() : '';
  }
  /* a row's one figure: the first needs-you fact, else the first fact of a card in use, else its first step (never a 0) */
  function headline(panel) {
    var cards = [].slice.call(panel.querySelectorAll('.cbsh-box')), needs = cards.filter(function (c) { return rank(c) === 0; });
    var pick = needs[0] || cards.filter(function (c) { return rank(c) === 1 && factOf(c); })[0];
    if (!pick) {
      var first = cards[0];
      return { n: '', w: first ? X('Set up') + ' ' + nameOf(first) : '', tone: 'q', amber: 0 };
    }
    var t = factOf(pick), m = /^(\S*\d\S*)\s*(.*)$/.exec(t);
    var num = m && !/^0\b/.test(m[1]) ? m : null;
    return { n: num ? num[1] : '', w: num ? num[2] : t || nameOf(pick), tone: needs.length ? 'dn' : '', amber: needs.length };
  }

  function mount(shell, host) {
    var m = shell.manifest && shell.manifest();
    var cfg = m && m.home2;
    if (!cfg || !host) return null;
    var phone = root.matchMedia ? root.matchMedia('(max-width:700px)') : { matches: false };
    var groups = cfg.pillars.concat(cfg.foundation), owner = {}, byId = {};
    groups.forEach(function (g) {
      byId[g.id] = g;
      g.ids.forEach(function (id) { owner[id] = g; });
    });
    var base = m.rail && m.rail.route ? String(m.rail.route).split(/[?#]/)[0] : '';
    host.setAttribute('data-testid', 'ix2');
    host.className = 'ix';
    host.innerHTML =
      '<div class="df" data-cbsid="HOM001-P18" data-testid="ix2-dofirst"></div><div class="ix-list">' +
      cfg.pillars
        .map(function (g) {
          var glyph = g.icon === '¤' ? '<span data-glyph="money">¤</span>' : esc(g.icon);
          return (
            '<div class="ix-item" data-pillar="' + g.id + '" hidden>' +
            '<button type="button" class="ix-row" id="ixh-' + g.id + '" aria-expanded="false" aria-controls="ixp-' + g.id + '" data-cbsid="HOM001-B06" data-testid="ix2-row-' + g.id + '">' +
            '<span class="ix-g" aria-hidden="true">' + glyph + '</span><span class="ix-n">' + esc(X(g.name)) + '</span>' +
            '<span class="ix-v" data-testid="ix2-digit-' + g.id + '"></span><b class="ix-a" hidden></b><span class="ix-c" aria-hidden="true">▾</span></button>' +
            '<div class="ix-panel" id="ixp-' + g.id + '" role="region" aria-labelledby="ixh-' + g.id + '" hidden data-cbsid="HOM001-P17" data-testid="ix2-panel-' + g.id + '"></div></div>'
          );
        })
        .join('') +
      '</div><div class="ix-foot" data-testid="ix2-foot">' +
      cfg.foundation
        .map(function (g) {
          return '<button type="button" class="ix-fw" data-pillar="' + g.id + '" data-cbsid="HOM001-B09" data-testid="ix2-foot-' + g.id + '">' + esc(X(g.name)) + ' ›</button>';
        })
        .join('') +
      '<span class="ix-fs"></span>' + switchHTML('new') + '</div>' +
      '<dialog class="ix-sheet" data-cbsid="HOM001-P19" data-testid="ix2-sheet"><div class="ix-sh-h"><b></b><button type="button" class="ix-x" data-cbsid="HOM001-B08" aria-label="' + esc(X('Close')) + '">✕</button></div><div class="ix-sh-b"></div></dialog>';
    wireSwitch(host);
    var list = host.querySelector('.ix-list'), df = host.querySelector('.df'), dlg = host.querySelector('dialog');
    var items = {}, panels = {};
    [].forEach.call(host.querySelectorAll('.ix-item'), function (n) {
      items[n.getAttribute('data-pillar')] = n;
      panels[n.getAttribute('data-pillar')] = n.querySelector('.ix-panel');
    });
    /* foundation panels live detached until their foot word opens the sheet */
    cfg.foundation.forEach(function (g) {
      var p = doc.createElement('div');
      p.className = 'ix-panel';
      p.setAttribute('data-testid', 'ix2-panel-' + g.id);
      panels[g.id] = p;
    });
    /* the two Sides buttons (We lean on / Leans on us) leave the top: they stand in the foot (INDEX-2 §4) */
    var tools = (shell.el || doc).querySelector('.cbsh-tools');
    if (tools) host.querySelector('.ix-fs').appendChild(tools);

    var work = { fig: null }, sheetOwner = null;
    function idOf(node) {
      return node.getAttribute('data-id') || (node.getAttribute('data-testid') || '').replace('shell-chip-', '');
    }
    function cardsOf(p) {
      return [].slice.call(p.children).filter(function (c) { return c.classList.contains('cbsh-box') || c.classList.contains('cbsh-sc'); });
    }
    function line(p, cls) {
      var el = p.querySelector('.' + cls);
      if (!el) {
        el = doc.createElement('button');
        el.type = 'button';
        el.className = 'ix-ln ' + cls;
        p.appendChild(el);
      }
      return el;
    }
    function setText(el, t) {
      if (el.textContent !== t) el.textContent = t;
    }
    /* what an open row shows: needs-you lines first, then in use; not-started ones fold into one line; at most 5 (laptop) or 6 (phone), then "All of …" */
    function layout(id, full) {
      var g = byId[id], p = panels[id], cards = cardsOf(p);
      var want = cards.slice().sort(function (a, b) { return rank(a) - rank(b) || g.ids.indexOf(idOf(a)) - g.ids.indexOf(idOf(b)); });
      if (want.some(function (c, i) { return c !== cards[i]; })) want.forEach(function (c) { p.insertBefore(c, p.querySelector('.ix-ln')); });
      var limit = full ? 1e3 : phone.matches ? 6 : 5, shown = 0, fold = 0;
      want.forEach(function (c) {
        var hide = !full && rank(c) === 3 ? (fold++, true) : shown >= limit;
        if (!hide) shown++;
        if (c.hidden !== hide) c.hidden = hide;
      });
      var foldEl = line(p, 'ix-fold'), allEl = line(p, 'ix-all'), hidden = want.length - shown - fold;
      foldEl.hidden = !fold || full;
      allEl.hidden = full || !(hidden > 0 || fold);
      setText(foldEl, fold + ' ' + X('not set up yet') + ' ›');
      setText(allEl, X('All of') + ' ' + X(g.name) + ' (' + want.length + ') ›');
      foldEl.setAttribute('data-sheet', id);
      allEl.setAttribute('data-sheet', id);
      return want;
    }
    /* never scroll: if the open row does not fit, drop its last line (the fold and "All of" lines carry the rest) */
    function fit(id) {
      var p = panels[id], vis;
      if (p.hidden || p.parentNode === dlg.querySelector('.ix-sh-b')) return;
      var cards = layout(id, false);
      vis = cards.filter(function (c) { return !c.hidden; });
      while (vis.length > 1 && p.scrollHeight > p.clientHeight + 1) {
        vis.pop().hidden = true;
        line(p, 'ix-all').hidden = false;
        setText(line(p, 'ix-all'), X('All of') + ' ' + X(byId[id].name) + ' (' + cards.length + ') ›');
      }
    }
    function paintRow(g) {
      var item = items[g.id], p = panels[g.id];
      var count = cardsOf(p).length;
      item.hidden = !count;
      if (!count) return;
      var h = headline(p), v = item.querySelector('.ix-v'), a = item.querySelector('.ix-a');
      v.className = 'ix-v ' + h.tone;
      v.innerHTML = (h.n ? '<b>' + esc(h.n) + '</b> ' : '') + '<span>' + esc(h.w) + '</span>';
      a.hidden = !h.amber;
      if (h.amber) {
        a.textContent = String(h.amber);
        a.title = X('need you');
      }
    }
    function plainName(card) {
      var id = idOf(card), h = card.querySelector('h4');
      if (SAY[id] && h && h.getAttribute('data-say') !== SAY[id]) {
        h.textContent = X(SAY[id]);
        h.setAttribute('data-say', SAY[id]);
      }
    }
    /* Do first: the needs-you count as the biggest digit, then up to 3 doors (verb + count + door); nothing = one quiet line; a shop with nothing started = its first steps */
    function doFirst() {
      var allCards = [];
      cfg.pillars.forEach(function (g) { allCards = allCards.concat(cardsOf(panels[g.id]).filter(function (c) { return c.classList.contains('cbsh-box'); })); });
      var itemsList = [], fig = (work.fig && work.fig.figures) || {};
      allCards.filter(function (c) { return rank(c) === 0; }).forEach(function (c) {
        itemsList.push({ t: factOf(c) || nameOf(c) + ' · ' + X('needs you'), h: c.getAttribute('href') });
      });
      if (Number(fig.orders_new) > 0) itemsList.push({ t: fig.orders_new + ' ' + X('new orders'), h: base + '?view=orders_in' });
      if (Number(fig.tasks_mine) > 0) itemsList.push({ t: fig.tasks_mine + ' ' + X('tasks for you'), h: base + '?view=tasks' });
      var started = allCards.some(function (c) { return rank(c) < 2; }), firstRun = shell.manifest && allCards.length > 0 && !started && !itemsList.length;
      host.classList.toggle('first', firstRun);
      var html;
      if (firstRun) {
        var steps = [['shop', 'Add your business'], ['catalogue', 'Add what you sell'], ['till', 'Make the first bill']].map(function (s, i) {
          var e = (m.entries || []).filter(function (x) { return x.id === s[0]; })[0];
          return e && e.route ? '<a href="' + esc(shell.route ? shell.route(e) : e.route) + '" data-testid="ix2-step-' + s[0] + '"><i>' + (i + 1) + '</i>' + esc(X(s[1])) + '</a>' : '';
        });
        html = '<span class="df-t">' + esc(X('Start here')) + '</span><span class="df-i">' + steps.join('') + '</span>';
      } else if (!itemsList.length) {
        html = '<span class="df-t q">' + esc(X('Nothing needs you')) + '</span>';
      } else {
        var shownItems = itemsList.slice(0, 3);
        html = '<b class="df-n" data-testid="ix2-do-count">' + itemsList.length + '</b><span class="df-t">' + esc(X('Do first')) + '</span><span class="df-i">' +
          shownItems.map(function (i) { return '<a href="' + esc(i.h || '#') + '">' + esc(i.t) + ' ›</a>'; }).join('') + '</span>' +
          (itemsList.length > 3 ? '<button type="button" class="ix-more" data-more="1">+' + (itemsList.length - 3) + '</button>' : '');
      }
      if (df.getAttribute('data-sig') !== html) {
        df.setAttribute('data-sig', html);
        df.innerHTML = html;
      }
      df._items = itemsList;
    }
    /* the shell draws (and, for a firm, redraws) its cards into .cbsh-more; every card keeps its own node, so the facts the shell paints keep landing in it */
    function adopt() {
      var more = (shell.el || doc).querySelector('.cbsh-more');
      if (more)
        [].forEach.call(more.querySelectorAll('[data-id],[data-testid^="shell-chip-"]'), function (node) {
          var g = owner[idOf(node)];
          if (!g || node.getAttribute('data-state') === 'coming') return node.remove(); /* `coming` is not drawn (Athi, 26 Oct) */
          var p = panels[g.id], old = cardsOf(p).filter(function (c) { return idOf(c) === idOf(node); })[0];
          if (old) old.remove();
          node.hidden = false;
          p.insertBefore(node, p.querySelector('.ix-ln'));
        });
      groups.forEach(function (g) {
        cardsOf(panels[g.id]).forEach(plainName);
        if (items[g.id]) paintRow(g);
        if (items[g.id] && !panels[g.id].hidden) fit(g.id);
      });
      var foot = host.querySelectorAll('.ix-fw');
      [].forEach.call(foot, function (b) { b.hidden = !cardsOf(panels[b.getAttribute('data-pillar')]).length; });
      doFirst();
    }
    var queued = false;
    function later() {
      if (queued) return;
      queued = true;
      (root.requestAnimationFrame || root.setTimeout)(function () { queued = false; adopt(); });
    }
    /* one open at a time (a second press closes it); the open row is remembered for this viewer */
    function open(id, keep) {
      cfg.pillars.forEach(function (g) {
        var item = items[g.id], on = g.id === id;
        item.classList.toggle('open', on);
        item.querySelector('.ix-row').setAttribute('aria-expanded', on ? 'true' : 'false');
        item.querySelector('.ix-panel').hidden = !on;
      });
      host.classList.toggle('has-open', !!id);
      if (!keep) lsSet(OPEN_KEY, id || '');
      if (id) fit(id);
    }
    /* the pillar sheet: ONE <dialog>; the pillar's own panel moves into it (every line, every state) and goes home on close */
    function sheet(id) {
      var p = panels[id], g = byId[id];
      sheetOwner = id;
      dlg.querySelector('.ix-sh-h b').textContent = X(g.name);
      dlg.querySelector('.ix-sh-b').appendChild(p);
      p.hidden = false;
      layout(id, true);
      [].forEach.call(p.querySelectorAll('.ix-ln'), function (b) { b.hidden = true; });
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute('open', '');
    }
    function closeSheet() {
      if (sheetOwner && items[sheetOwner]) {
        var it = items[sheetOwner];
        it.appendChild(panels[sheetOwner]);
        panels[sheetOwner].hidden = !it.classList.contains('open');
      } else if (sheetOwner === 'do') dlg.querySelector('.ix-sh-b').innerHTML = '';
      else if (sheetOwner) panels[sheetOwner].hidden = true;
      sheetOwner = null;
      if (dlg.close) {
        if (dlg.open) dlg.close();
      } else dlg.removeAttribute('open');
      adopt();
    }
    dlg.addEventListener('close', function () { if (sheetOwner) closeSheet(); });
    dlg.querySelector('.ix-x').addEventListener('click', closeSheet);
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) closeSheet();
    });
    host.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : null;
      if (!t) return;
      var row = t.closest('.ix-row'), sh = t.closest('[data-sheet]'), fw = t.closest('.ix-fw'), more = t.closest('[data-more]');
      if (row && list.contains(row)) {
        var id = row.parentNode.getAttribute('data-pillar');
        return open(row.getAttribute('aria-expanded') === 'true' ? '' : id);
      }
      if (sh) return sheet(sh.getAttribute('data-sheet'));
      if (fw) return sheet(fw.getAttribute('data-pillar'));
      if (more) {
        sheetOwner = 'do';
        dlg.querySelector('.ix-sh-h b').textContent = X('Do first');
        dlg.querySelector('.ix-sh-b').innerHTML = '<div class="ix-dl">' + (df._items || []).map(function (i) { return '<a href="' + esc(i.h || '#') + '">' + esc(i.t) + ' ›</a>'; }).join('') + '</div>';
        if (dlg.showModal) dlg.showModal();
      }
    });
    host.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !dlg.open) open('');
    });
    root.addEventListener('resize', later);
    adopt();
    var hash = String(root.location.hash || '').replace('#', '');
    var start = ALIAS[hash] || lsGet(OPEN_KEY);
    if (start && items[start]) open(start, true);
    if (byId[hash] && !items[hash]) sheet(hash);
    var obs = root.MutationObserver ? new root.MutationObserver(later) : null;
    if (obs) {
      var areas = (shell.el || doc).querySelector('.cbsh-areas');
      if (areas) obs.observe(areas, { childList: true, subtree: true });
      Object.keys(panels).forEach(function (k) { obs.observe(panels[k], { childList: true, subtree: true, characterData: true }); });
    }
    /* Your work: the same read index.html makes (one budgeted ask, the shell's); only a figure above zero is drawn, as a door in the Do-first row */
    return { open: open, adopt: adopt, owner: owner, setWork: function (r) { work.fig = r; doFirst(); } };
  }
  var live = null;
  function mountAndKeep(shell, host) {
    live = mount(shell, host);
    if (live && pending) live.setWork(pending);
    return live;
  }
  function setWork(r) {
    if (live) live.setWork(r);
    else pending = r;
  }
  var pending = null;

  root.CBHome2 = { pref: pref, setPref: setPref, gate: gate, switchHTML: switchHTML, wireSwitch: wireSwitch, mount: mountAndKeep, setWork: setWork, headline: headline };
})(window);
