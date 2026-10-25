/**
 * network-panel-app.js — THE NETWORK CONTROL PANEL, SLICE 1 (read-only). Athi, 2026-10-25: "the control panel should able to answer the number of platforms available."
 *
 * OWNS      the page's painting: the big answer ("4 installations · 3 members · 1 master"), the Installations table and the Certificates table. Decides nothing and computes nothing:
 *           the server says the counts, each status in words (from the certificate), and which actions are open (none yet, each with the command that does it).
 * CALLED BY public/network-panel.html
 * FLOW      mount → ONE call GET /api/network/installations → CBList paints the section → a refusal is shown in the server's words (a member's root is told who controls it)
 * CARD      28-platform-and-operations/network-control-panel
 *
 * REUSE (named in the PR): CBList (list-ctl.js: frozen header, adjustable columns) · the CBFrame page frame · the endpoint registry shape of network-app.js.
 * The page NEVER dials an installation: version and last seen are what the master recorded when it pulled. Nothing here acts: suspend, reinstate and revoke are shown disabled, the reason being the command.
 *
 *   CBNetworkPanel.mount(el, { token, base, onEnded }) → { go(section), reload }
 */
(function (root) {
  'use strict';
  var Panel = { data: null, section: 'installations', el: null, o: {}, list: null };
  var STALE_MS = 15 * 60 * 1000; /* the master looks every minute; fifteen minutes unseen is not a blip */
  var TONE = { master: 'green', active: 'green', expiring: 'amber', lapsed: 'red', paused: 'amber', cut_off: 'red', uncertified: 'amber' };
  var STATUS_WORDS = { active: 'Active', expiring: 'Expiring soon', lapsed: 'Lapsed', paused: 'Paused', cut_off: 'Cut off', uncertified: 'No certificate' };

  function translate(text) {
    return typeof root.tx === 'function' ? root.tx(text) : text;
  }
  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }
  function byId(id) {
    return root.document.getElementById(id);
  }

  /* ⭐ the endpoint registry — the ONE declaration shape the round-trip scanner reads (api tools/endpoint-usage.cjs) */
  var ENDPOINTS = { installations: { m: 'GET', p: '/api/network/installations' } };

  function load() {
    return root.fetch((Panel.o.base || '') + ENDPOINTS.installations.p, { method: ENDPOINTS.installations.m, cache: 'no-store', headers: { Authorization: 'Bearer ' + Panel.o.token } }).then(function (reply) {
      return reply
        .json()
        .catch(function (failure) {
          return { unreadable: String(failure) };
        })
        .then(function (body) {
          if (reply.status === 401 && Panel.o.onEnded) Panel.o.onEnded();
          if (reply.ok && body.unreadable) throw new Error(translate('The control panel answered, but we could not read it.'));
          if (!reply.ok) {
            var refusal = new Error(body.detail || body.message || body.error || translate('The control panel could not be read.'));
            refusal.status = reply.status;
            throw refusal;
          }
          return body;
        });
    });
  }

  /* ── words ── */
  function plural(count, singular, many) {
    return count + ' ' + translate(count === 1 ? singular : many);
  }
  function when(isoText) {
    return isoText ? new Date(isoText).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  }
  function dayOf(isoText) {
    return isoText ? new Date(isoText).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
  /** the big plain answer: "4 installations · 3 members · 1 master" */
  function answerLine(counts) {
    var roles = counts.by_role || {};
    var parts = [plural(counts.total, 'installation', 'installations')];
    if (roles.member) parts.push(plural(roles.member, 'member', 'members'));
    if (roles.master) parts.push(plural(roles.master, 'master', 'masters'));
    if (roles.standalone) parts.push(plural(roles.standalone, 'standalone', 'standalone'));
    return parts.join(' · ');
  }
  function statusLine(counts) {
    var byStatus = counts.by_status || {};
    return Object.keys(byStatus)
      .filter(function (code) {
        return code !== 'master';
      })
      .map(function (code) {
        return byStatus[code] + ' ' + translate(STATUS_WORDS[code] || code);
      })
      .join(' · ');
  }
  /** what the master last saw, in words: never seen, not seen since, or seen at */
  function seenWords(row) {
    if (!row.last_seen) return translate('not seen yet');
    var old = row.seen_error || Date.now() - new Date(row.last_seen).getTime() > STALE_MS;
    return old ? translate('not seen since') + ' ' + when(row.last_seen) : when(row.last_seen);
  }
  function pullWords(row) {
    if (!row.last_pull) return '—';
    if (row.last_pull.error) return translate('failed') + ': ' + row.last_pull.error;
    return row.last_pull.at ? when(row.last_pull.at) : translate('not pulled yet');
  }
  function statusTag(row) {
    return '<span class="tag ' + (TONE[row.status] || '') + '">' + escapeHtml(translate(row.status_label)) + '</span>';
  }
  function daysLeft(row) {
    if (!row.certificate || !row.certificate.expires) return '—';
    var left = Math.floor((new Date(row.certificate.expires).getTime() - Date.now()) / 86400000);
    return left < 0 ? translate('expired') : plural(left, 'day', 'days');
  }
  /** suspend / reinstate / revoke: the server's data; disabled, the reason being the command that does it */
  function actionButtons(row) {
    var actions = row.actions || {};
    return Object.keys(actions)
      .map(function (verb) {
        return (
          '<button type="button" class="np-act" disabled aria-disabled="true" title="' + escapeHtml(actions[verb].why) + '" data-testid="np-act-' + escapeHtml(row.key) + '-' + escapeHtml(verb) + '">' + escapeHtml(translate(verb.charAt(0).toUpperCase() + verb.slice(1))) + '</button>'
        );
      })
      .join(' ');
  }
  function nameCell(row) {
    return '<b>' + escapeHtml(row.key) + '</b><div class="sub">' + escapeHtml(row.domain || '—') + '</div>';
  }
  function businessesCell(row) {
    if (row.role === 'master') return '—';
    return escapeHtml(row.entities_held + (row.entities_claimed == null ? '' : ' ' + translate('of') + ' ' + row.entities_claimed + ' ' + translate('claimed')));
  }

  /* ── the two tables ── */
  function column(key, label, prio, width, cell, value) {
    return {
      key: key,
      label: translate(label),
      prio: prio,
      w: width,
      html: true,
      sort: key,
      cell: cell,
      value:
        value ||
        function (row) {
          return String(row[key] == null ? '' : row[key]);
        }
    };
  }
  function sortOn(key, label) {
    return {
      key: key,
      label: translate(label),
      cmp: function (left, right) {
        return String(left[key] == null ? '' : left[key]).localeCompare(String(right[key] == null ? '' : right[key]));
      }
    };
  }
  function installationColumns() {
    return identityColumns().concat(recordedColumns());
  }
  /** who it is and where it stands */
  function identityColumns() {
    return [
      column('key', 'Installation', 1, 200, nameCell),
      column('status', 'Status', 2, 130, statusTag, function (row) {
        return row.status_label;
      }),
      column('role', 'Role', 3, 100, function (row) {
        return escapeHtml(translate(row.role));
      }),
      column('country', 'Country', 4, 90, function (row) {
        return escapeHtml(row.country || '—');
      }),
      column(
        'listed',
        'Listed',
        5,
        120,
        function (row) {
          return escapeHtml(translate(row.listed_label));
        },
        function (row) {
          return row.listed_label;
        }
      )
    ];
  }
  /** what the master recorded: businesses held, the last pull, the version and last seen, and the (disabled) actions */
  function recordedColumns() {
    return [
      column('entities_held', 'Businesses', 6, 150, businessesCell),
      column('last_pull', 'Last pull', 7, 170, function (row) {
        return escapeHtml(pullWords(row));
      }, pullWords),
      column('version', 'Version', 8, 130, function (row) {
        return escapeHtml(row.version || translate('not seen yet'));
      }),
      column('last_seen', 'Last seen', 9, 190, function (row) {
        return escapeHtml(seenWords(row));
      }, function (row) {
        return row.last_seen || '';
      }),
      column('actions', 'Actions', 10, 250, actionButtons, function () {
        return '';
      })
    ];
  }
  function certificateColumns() {
    return [
      column('key', 'Installation', 1, 200, nameCell),
      column('status', 'Status', 2, 130, statusTag, function (row) {
        return row.status_label;
      }),
      column('expires', 'Expires', 3, 140, function (row) {
        return escapeHtml(row.certificate ? dayOf(row.certificate.expires) || '—' : '—');
      }, function (row) {
        return row.certificate ? row.certificate.expires || '' : '';
      }),
      column('left', 'Days left', 4, 110, function (row) {
        return escapeHtml(daysLeft(row));
      }, daysLeft),
      column('last_pull', 'Last pull', 5, 170, function (row) {
        return escapeHtml(pullWords(row));
      }, pullWords)
    ];
  }
  function rowsFor(section) {
    return (Panel.data.installations || []).filter(function (row) {
      return section === 'installations' || row.role !== 'master'; /* the master signs; it holds no certificate of its own here */
    });
  }
  function mountList(host, section) {
    if (Panel.list && Panel.list.destroy) Panel.list.destroy();
    root.CBList.reset && root.CBList.reset('network-panel-' + section);
    Panel.list = root.CBList.mount(host, {
      key: 'network-panel-' + section,
      t: translate,
      rows: function () {
        return rowsFor(section);
      },
      id: function (row) {
        return row.key;
      },
      rowTid: function (row) {
        return 'np-row-' + row.key;
      },
      columns: section === 'installations' ? installationColumns() : certificateColumns(),
      search: function (row) {
        return [row.key, row.domain, row.country, row.status_label].join(' ');
      },
      sorts: [sortOn('key', 'Installation'), sortOn('status', 'Status')],
      empty: { title: translate('No installations to show') }
    });
  }

  /* ── the page ── */
  function paint() {
    var counts = Panel.data.counts;
    Panel.el.innerHTML =
      '<div data-testid="np-answer"><h1 class="np-answer" id="np_answer">' +
      escapeHtml(answerLine(counts)) +
      '</h1><p class="np-sub">' +
      escapeHtml(statusLine(counts)) +
      '</p></div>' +
      '<div class="np-note" data-testid="np-note">' +
      escapeHtml(translate('Suspend, reinstate and revoke are run from the command line for now. Each button shows the command.')) +
      '</div>' +
      '<div class="nw-list" id="np_list" data-testid="np-list"></div>';
    mountList(byId('np_list'), Panel.section);
  }
  function showRefusal(err) {
    Panel.el.innerHTML =
      '<div class="empty" data-testid="np-refused"><div class="t">' + escapeHtml(translate('Not available here')) + '</div><div>' + escapeHtml(err.message) + '</div><button type="button" class="act quiet" id="np_retry">' + escapeHtml(translate('Try again')) + '</button></div>';
    byId('np_retry').onclick = reload;
  }
  function reload() {
    Panel.el.innerHTML = '<div class="loadwrap"><span class="spin"></span> ' + escapeHtml(translate('Loading')) + '</div>';
    return load().then(function (data) {
      Panel.data = data;
      paint();
    }, showRefusal);
  }
  function showSection(section) {
    Panel.section = section;
    if (Panel.data) paint();
  }

  root.CBNetworkPanel = {
    mount: function (el, opts) {
      Panel.el = el;
      Panel.o = opts || {};
      reload();
      return { go: showSection, reload: reload };
    }
  };
})(typeof window !== 'undefined' ? window : this);
