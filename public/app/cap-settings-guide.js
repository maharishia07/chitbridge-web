/* public/app/cap-settings-guide.js — CB Settings › Connectors: the "Get it" column (Download · Guide) and the Guide row action (WALK-REG R32). Split out of cap-settings.js (web split 1129).
 * ID        ACC002
 * OWNER     cb-settings
 * OWNS      where a connector's printable guide lives (guideOf), the two buttons drawn ON the row, and the Guide action; the kit download itself stays cap-settings.js (kitDownload)
 * CALLED BY public/app/cap-settings.js (CBSettingsGuide.make in connectors()), loaded first through CAP_WITH.settings (app.html) and a script tag in settings.html
 * FLOW      make({ T, grey }) ──▶ { getItColumn, guideAction } ──▶ CBList column and action; CBList dispatches data-act kit | guide from any button in the list
 * CARD      28-platform-and-operations/settings
 * RISK      plain
 * Host globals: CFG · esc. The two functions the parent passes: T (words) and grey (a may verdict to its reason).
 */
'use strict';
(function (root) {
  /* WALK-REG R32: the printable guide a connector has (public/guides/<id>.pdf, copied from docs/23-connectors-and-integrations/guides); else the server's docs page */
  var GUIDES = { tally: '/guides/tally.pdf' };
  /** the address of a connector's printable guide, or '' when it has none */
  function guideOf(connector) {
    var base = (typeof CFG !== 'undefined' && CFG.API_BASE) || '';
    return GUIDES[connector.id] || (connector.docs ? base + connector.docs : '');
  }
  /** a row action drawn ON the row (CBList runs it by data-act/data-actrow, as it runs the opened row's buttons); greyed with the reason, never hidden */
  function rowBtn(action, connector, label, reason, stampCode) {
    return (
      '<button data-cbsid="' + stampCode + '" type="button" class="cbl-btn" data-act="' +
      action +
      '" data-actrow="' +
      esc(connector.id) +
      '" data-testid="sx-con-' +
      action +
      '-' +
      esc(connector.id) +
      '"' +
      (reason ? ' disabled aria-disabled="true" title="' + esc(reason) + '"' : '') +
      '>' +
      esc(label) +
      '</button>'
    );
  }
  /** FW-46: why the Guide is grey — a connector the platform says is not built (or not for this country) has no guide to read, so it says the same sentence as Download; else no guide yet; else live */
  function guideWhy(connector, ctx) {
    var code = (connector.may && connector.may.code) || '';
    var verdict = /^NOT_(YET|FOR_COUNTRY)/.test(code) ? ctx.grey(connector.may) : '';
    if (verdict) return verdict;
    return guideOf(connector) ? '' : ctx.T('No guide yet');
  }
  /** the two buttons of the "Get it" cell: Download (greyed with the kit's reason) and Guide (greyed when the connector has none) */
  function getItCell(connector, ctx) {
    var inWords = ctx.T;
    return (
      rowBtn('kit', connector, inWords('Download'), ctx.grey(connector.may), 'ACC002-B17') +
      ' ' +
      rowBtn('guide', connector, inWords('Guide'), guideWhy(connector, ctx), 'ACC002-B18')
    );
  }
  /** WALK-REG R32: Download and Guide on the row itself, not only inside it — the same row actions (kit · guide), drawn here (CBList dispatches data-act from any button in the list) */
  function getItColumn(ctx) {
    return {
      key: 'get',
      label: ctx.T('Get it'),
      prio: 1,
      w: 200,
      html: true,
      value: function () {
        return '';
      },
      cell: function (connector) {
        return getItCell(connector, ctx);
      }
    };
  }
  /** the Guide action — drawn on the row (the 'get' column); when:false keeps it out of the opened row so it is not shown twice (the Download action the same) */
  function guideAction(ctx) {
    return {
      id: 'guide',
      label: ctx.T('Guide'),
      tid: 'sx-con-guide',
      when: function () {
        return false;
      },
      why: function (connector) {
        return guideWhy(connector, ctx);
      },
      run: function (connector) {
        var guideLink = guideOf(connector);
        if (guideLink) root.open(guideLink, '_blank', 'noopener');
      }
    };
  }
  /** hands the parent its two pieces, bound to the parent's words (T) and may-to-reason (grey) functions */
  function make(ctx) {
    return {
      getItColumn: function () { return getItColumn(ctx); },
      guideAction: function () { return guideAction(ctx); }
    };
  }
  root.CBSettingsGuide = { make: make };
})(window);
