/* app/cap-finance-tabs.js — CB Finance: which tab loads and mounts, and the wait for the late scripts. Split out of cap-finance.js (file-size ratchet, batch 1128), code moved verbatim.
 * OWNS      the tab dispatch of the Finance page: finLeftWhileLate · finTabLoader · finMountWhenReady · finTabMounter
 * CALLED BY public/finance.html (script tag, after cap-finance.js); finLoad and finMount in cap-finance.js call these when they run, so load order is free
 * FLOW      finLoad / finMount → finTabLoader / finTabMounter (the tab's own file) → that tab's load or mount; a late tab first waits for CBLate
 * CARD      16-finance/cb-finance
 * OWNER     cb-finance
 * RISK      money
 */
'use strict';
/** waits for the late scripts of a late tab (called only when one is late); true when the person left that tab while it waited (the load is then dropped) */
async function finLeftWhileLate() {
  var startTab = finTab();
  await window.CBLate.ready();
  return finTab() !== startTab;
}
/** the loader of the open tab when it is a tab of its own file (looked up when called, so a file not loaded yet breaks only its own tab), else null: the dues tab loads here */
function finTabLoader() {
  var loaders = {
    terms: function (quiet) { return ftLoad(quiet); }, /* the Terms tab (cap-finance-terms.js) */
    cash: function (quiet) { return fcLoad(quiet); }, /* the Cash tab (cap-finance-cash.js, F3) */
    repeat: function (quiet) { return rpLoad(quiet); }, /* the Repeat supply tab (cap-repeat.js, RI1) */
    pay: function (quiet) { return fpLoad(quiet); }, /* the Payables tab (cap-finance-pay.js, F4) */
    cheques: function (quiet) { return fqLoad(quiet); }, /* the Cheques tab (cap-finance-cheques.js, T3-P1-MONEY) */
    returns: function (quiet) { return frLoad(quiet); }, /* the Returns tab (cap-finance-returns.js, T3-P1-MONEY) */
    reports: function (quiet) { return fmLoad(quiet); } /* the Reports tab (cap-mis.js, T3-P4-ACCOUNT) */
  };
  return loaders[finTab()] || null;
}
/** a late tab mounts once its late scripts have landed, if the person is still on it */
function finMountWhenReady(frame) {
  var late = finTab();
  return window.CBLate.ready().then(function () {
    if (finTab() === late) finMount(frame);
  });
}
/** the mounter of the open tab when it is a tab of its own file (looked up when called), else null: the dues tab mounts here */
function finTabMounter() {
  var mounters = {
    terms: function (frame) { return ftMount(frame); }, /* the Terms tab (cap-finance-terms.js) */
    cash: function (frame) { return fcMount(frame); }, /* the Cash tab (cap-finance-cash.js, F3) */
    repeat: function (frame) { return rpMount(frame); }, /* the Repeat supply tab (cap-repeat.js, RI1) */
    pay: function (frame) { return fpMount(frame); }, /* the Payables tab (cap-finance-pay.js, F4) */
    cheques: function (frame) { return fqMount(frame); }, /* the Cheques tab (cap-finance-cheques.js, T3-P1-MONEY) */
    returns: function (frame) { return frMount(frame); }, /* the Returns tab (cap-finance-returns.js, T3-P1-MONEY) */
    reports: function (frame) { return fmMount(frame); } /* the Reports tab (cap-mis.js, T3-P4-ACCOUNT) */
  };
  return mounters[finTab()] || null;
}
