/**
 * OWNS  the labs' shared rules (UX-90, walk 21 Oct W9 / W10 / W15 / W1): the list of labs (the Labs switcher), plain words for a code, "Not set up
 *       for <country> yet", at most three items + "and N more" (the popup is a CBList), progress as a bar + "x of y ready · next: …", the
 *       Ready / Nearly / Not started grouping, and the layout classes (lab-cols, lab-cards) in /app/lab-kit.css.
 * CONFIRM  confirm(title, bodyHtml, onOk, opts): the one popup that asks before a money promise is made (the Offer Lab shelf buttons, UX-109).
 * CALLED BY app/page-frame.js (CBFrame.lab → the switcher) and every lab page; Country Lab (PR 2) and Offer Lab (PR 3) use the rest.
 * CARD 29-qa-test-tooling-ux-locale-and-design-system/lab-kit
 * FLOW  page loads → CBLabKit.LABS feeds the switcher → a lab paints rows through plain · notSetUp · reason · more · progress · groups
 *
 * NOT a second frame (the frame is CBFrame + page-skeleton.css) and NOT a second list (the popup mounts CBList, app/list-ctl.js).
 * Escaping is app/helpers.js esc, the one copy. Colour is theme tokens only: red is for a blocker, nothing else.
 */
(function (root) {
  'use strict';
  /* the labs, in menu order. Same routes as app/manifest.json's built labs (e2e/lab-frame.cjs checks they agree). */
  var LABS = [
    { id: 'product-lab', name: 'Price Lab', route: '/product-lab.html', icon: '◈' },
    { id: 'offer-lab', name: 'Offer Lab', route: '/offer-lab-next.html', icon: '%' },
    { id: 'combo-lab', name: 'Combo Lab', route: '/offer-lab-next.html?mode=combo', icon: '▣' },
    { id: 'conversion-lab', name: 'Conversion Lab', route: '/conversion-lab.html', icon: '⇅' },
    { id: 'country-lab', name: 'Country Lab', route: '/country-lab.html', icon: '§' },
    { id: 'network-lab', name: 'Network Lab', route: '/network-design.html', icon: '⌾' },
    { id: 'list-lab', name: 'List Lab', route: '/list-lab.html', icon: '☰' },
    { id: 'signin-lab', name: 'Sign-in Lab', route: '/signin-lab.html', icon: '⏎' },
    { id: 'shell-lab', name: 'Shell Lab', route: '/shell-lab.html', icon: '▭' }
  ];
  var MORE_AT = 3; /* W15: at most three inline, the rest in the popup */

  var escapeText = root.esc; /* the one escaper (app/helpers.js) */

  /* ── W4: a code is shown as plain words, the code itself only in the tooltip (for the accountant). Seed words; a lab adds its own with addWords. ── */
  var WORDS = {
    div40: 'Capital allowances (Division 40)',
    schedule_ii: 'Companies Act schedule rates',
    it_act_wdv: 'Income-tax Act written-down value',
    ias16: 'International standard rates (IAS 16)',
    straight_line: 'Same amount every year',
    '{series}/{fy}/{n:6}': 'Series / year / number, like INV/2026-27/000001'
  };
  function addWords(map) {
    Object.keys(map || {}).forEach(function (key) {
      WORDS[key] = map[key];
    });
  }
  /** a code as people read it: the plain words if known, else the code spelled out; the code stays in the tooltip */
  function plain(code) {
    var codeText = String(code == null ? '' : code);
    var words = WORDS[codeText] || codeText.replace(/[_-]+/g, ' ').replace(/^./, function (letter) { return letter.toUpperCase(); });
    return '<span class="lk-plain" title="' + escapeText(codeText) + '">' + escapeText(words) + '</span>';
  }
  /** W2: a fact we have not filled in says so in words, never "not in the pack"; willBe says what it will be, when known */
  function notSetUp(country, willBe) {
    return '<span class="lk-notset">Not set up for ' + escapeText(country) + ' yet' + (willBe ? ' · ' + escapeText(willBe) : '') + '</span>';
  }
  /** W9: no blank without a reason: a value, or the sentence saying why there is none */
  function reason(value, reasonText) {
    return value == null || value === '' ? '<span class="lk-why">' + escapeText(reasonText) + '</span>' : escapeText(value);
  }

  /* ── W10: tags. Red ONLY for a blocker; a difference between countries is neutral grey. ── */
  var TAGS = { blocker: 'lk-tag blocker', diff: 'lk-tag diff', ok: 'lk-tag ok', near: 'lk-tag near' };
  function tag(kind, text) {
    return '<span class="' + (TAGS[kind] || TAGS.diff) + '">' + escapeText(text) + '</span>';
  }
  /** a bar and "x of y ready · next: …" (next only when something is left) */
  function progress(done, total, next) {
    var percent = total ? Math.round((done / total) * 100) : 0;
    var line = done + ' of ' + total + ' ready' + (next && done < total ? ' · next: ' + next : '');
    return (
      '<div class="lk-progress" data-testid="lk-progress"><div class="lk-bar" role="img" aria-label="' + escapeText(line) + '"><i style="width:' + percent + '%"></i></div>' +
      '<div class="lk-progress-line">' + escapeText(line) + '</div></div>'
    );
  }
  /** which group an area falls in: Ready (all done) · Not started (none) · Nearly (between) */
  function groupOf(item) {
    if (item.total && item.done >= item.total) return 'Ready';
    return item.done > 0 ? 'Nearly' : 'Not started';
  }
  /** items [{ name, done, total, next, blocker }] → { Ready:[…], Nearly:[…], 'Not started':[…] } */
  function groups(items) {
    var out = { Ready: [], Nearly: [], 'Not started': [] };
    (items || []).forEach(function (item) {
      out[groupOf(item)].push(item);
    });
    return out;
  }
  /** the grouped readiness block: each group heading, then each area with its bar; a blocker is the only red */
  function readiness(items) {
    var by = groups(items);
    return Object.keys(by)
      .filter(function (name) {
        return by[name].length;
      })
      .map(function (name) {
        return (
          '<section class="lk-group" data-group="' + escapeText(name) + '"><h3>' + escapeText(name) + ' <span class="lk-count">' + by[name].length + '</span></h3>' +
          by[name]
            .map(function (item) {
              return (
                '<div class="lk-area"><div class="lk-area-name">' + escapeText(item.name) + (item.blocker ? ' ' + tag('blocker', item.blocker) : '') + '</div>' +
                progress(item.done, item.total, item.next) + '</div>'
              );
            })
            .join('') +
          '</section>'
        );
      })
      .join('');
  }

  /* ── W15: at most three inline + "and N more" opening the one list control in a popup ── */
  function popup(title, build, extraClass) {
    var back = root.document.createElement('div');
    back.className = 'lk-pop-back';
    back.innerHTML =
      '<div class="lk-pop' + (extraClass ? ' ' + extraClass : '') + '" role="dialog" aria-modal="true" aria-label="' + escapeText(title) + '" data-testid="lk-pop"><header><b>' + escapeText(title) +
      '</b><button type="button" class="lk-pop-x" aria-label="Close" data-testid="lk-pop-close">×</button></header><div class="lk-pop-body"></div></div>';
    function close() {
      root.document.removeEventListener('keydown', onKey);
      back.remove();
    }
    function onKey(event) {
      if (event.key === 'Escape') close();
    }
    back.addEventListener('click', function (event) {
      if (event.target === back || event.target.closest('.lk-pop-x')) close();
    });
    root.document.addEventListener('keydown', onKey);
    root.document.body.appendChild(back);
    build(back.querySelector('.lk-pop-body'));
    var closeBtn = back.querySelector('.lk-pop-x');
    if (closeBtn.focus) closeBtn.focus();
    return { close: close, node: back };
  }
  /**
   * UX-109 (Athi 22 Oct): an action that commits a money promise asks first, in words. `bodyHtml` is raw HTML (the caller escapes what it
   * puts in); `onOk` runs only on Confirm. Cancel, the x, Esc and a click outside change nothing. Focus starts on Cancel, never on the promise.
   * opts: { okLabel, danger }
   */
  function confirm(title, bodyHtml, onOk, opts) {
    opts = opts || {};
    var shown = popup(
      title,
      function (body) {
        body.innerHTML =
          '<div class="lk-confirm-text" data-testid="lk-confirm-text">' + bodyHtml + '</div>' +
          '<div class="lk-confirm-acts"><button type="button" class="lk-btn" data-testid="lk-confirm-cancel">Cancel</button>' +
          '<button type="button" class="lk-btn lk-btn-go' + (opts.danger ? ' lk-btn-danger' : '') + '" data-testid="lk-confirm-ok">' + escapeText(opts.okLabel || 'Confirm') + '</button></div>';
        body.querySelector('[data-testid="lk-confirm-cancel"]').onclick = function () { shown.close(); };
        body.querySelector('[data-testid="lk-confirm-ok"]').onclick = function () { shown.close(); onOk(); };
      },
      'lk-confirm'
    );
    var cancelButton = shown.node.querySelector('[data-testid="lk-confirm-cancel"]');
    if (cancelButton && cancelButton.focus) cancelButton.focus();
    return shown;
  }
  function listOptions(opts, items) {
    return {
      key: 'lab-more-' + opts.id,
      rows: function () {
        return items;
      },
      id: function (item) {
        return item[opts.columns[0].key];
      },
      search: function (item) {
        return opts.columns.map(function (column) { return item[column.key]; }).join(' ');
      },
      head: function () {
        return { title: opts.title };
      },
      columns: opts.columns.map(function (column, index) {
        return {
          key: column.key,
          label: column.label,
          prio: index + 1,
          w: index ? 180 : 260,
          sort: true,
          cell: function (item) {
            return item[column.key];
          }
        };
      })
    };
  }
  /**
   * more(host, { id, title, items, columns:[{ key, label }], line(item) → html, max })
   * paints up to `max` (3) lines; beyond that a button "and N more" whose popup is a CBList (sort · search · resize) over the same items.
   */
  function more(host, opts) {
    var items = opts.items || [],
      max = opts.max || MORE_AT,
      line = opts.line || function (item) { return escapeText(item[opts.columns[0].key]); };
    var html = '<ul class="lk-lines">' + items.slice(0, max).map(function (item) { return '<li>' + line(item) + '</li>'; }).join('') + '</ul>';
    if (items.length > max) {
      html += '<button type="button" class="lk-more" data-testid="lk-more-' + escapeText(opts.id) + '">and ' + (items.length - max) + ' more</button>';
    }
    host.innerHTML = html;
    var button = host.querySelector('.lk-more');
    if (button)
      button.onclick = function () {
        popup(opts.title, function (body) {
          if (!root.CBList) {
            body.textContent = 'The list could not open. Reload the page and try again.';
            return;
          }
          root.CBList.mount(body, listOptions(opts, items));
        });
      };
  }

  root.CBLabKit = { LABS: LABS, MORE_AT: MORE_AT, plain: plain, addWords: addWords, notSetUp: notSetUp, reason: reason, tag: tag, progress: progress, groups: groups, readiness: readiness, more: more, popup: popup, confirm: confirm };
})(typeof window !== 'undefined' ? window : globalThis);
