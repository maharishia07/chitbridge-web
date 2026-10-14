/* app/cap-plan.js — PLAN & USAGE: the shop's plan as the SERVER records it (identities.plan · the constitution's plan_menu limits · chits today —
 * GET /api/facts/plan, the same read Home's card draws) and what the ledger has billed (GET /api/entities/usage) — T3-SETTINGS, 2026-10-14.
 *
 * MOVED from cap-admin.js (never copied): _usageMoney (the Profile's Usage section calls it) · planMeterHTML (was misPlan's inner `meter`; misPlan calls it).
 * NOT CARRIED: the workshop's client stub PLAN (cap-admin.js: Free · 5 entities · 10 chits a day, "validFrom/validTo null because NOTHING SUPPLIES
 *   THEM") — this screen paints the server's answer only; a limit the constitution does not declare is SAID, never 0 or ∞ (custodian finding: the
 *   workshop's Governance › Constitution card still shows the stub — flagged to the coordinator).
 * NEW: CBPlan.mount(host) — CB Settings › Plan & usage. Nothing existing painted the server's plan anywhere.
 * Host globals (as every cap-*.js): api · EP (factsPlan here; entityUsage — CB_SHOP_EP) · esc · tx · txf · _CARD · CBLocale (optional).
 * Loaded by app.html through CAP_WITH.admin (before cap-admin.js) and by settings.html directly.
 * Flow step: Onboarding · plan (docs/process/flows.json).
 */
'use strict';
if (typeof EP !== 'undefined') { Object.assign(EP, {
  factsPlan: {m:'GET', p:'/api/facts/plan', ok:'y'},   /* the Plan & usage Home card's own read (lib/home-facts plan) — figures: plan · limits · used */
}); }
function _usageMoney(n){
  var v = Number(n || 0);
  return '$' + (Math.round(v * 10000) / 10000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '.00');
}
function planMeterHTML(label, used, limit, note){
    if (limit == null) return '<div class="govrow"><span class="govrow-k">'+esc(label)+'</span>'
      + '<span class="govrow-v" style="color:var(--grey)">'+esc(note||'not counted here')+'</span></div>';
    var pct = Math.min(100, Math.round((used / limit) * 100));
    var tone = pct >= 100 ? 'var(--disp)' : pct >= 80 ? 'var(--prog)' : 'var(--blue)';
    return '<div class="misplanrow"><div class="misplanhead"><span>'+esc(label)+'</span>'
      + '<span class="misplanv">'+used+' <span style="color:var(--grey);font-weight:600">of '+limit+'</span></span></div>'
      + '<div class="misplanbar"><i style="width:'+pct+'%;background:'+tone+'"></i></div></div>';
}

/* ── CB SETTINGS › PLAN & USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────── */
var CBPlan = (function () {
  var H = { el: null, plan: undefined, usage: undefined };
  function active(){ return !!(H.el && H.el.isConnected); }
  function read(){
    H.plan = null; H.usage = null;
    api('factsPlan').then(function (r) { H.plan = r || {}; }).catch(function (e) { H.plan = { error: (e && e.message) || tx('Could not read your plan.') }; }).then(paint);
    api('entityUsage').then(function (r) { H.usage = r || {}; }).catch(function (e) { H.usage = { error: (e && e.message) || tx('Could not read your usage.') }; }).then(paint);
  }
  /** a limit row: the constitution's number beside what is used, or the words for "not declared" */
  function row(label, used, limit, note){ return planMeterHTML(label, used, limit, note); }
  function planCard(){
    var p = H.plan, f = (p && p.figures) || {};
    if (p === null) return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Your plan') + '</div><div class="loadwrap"><span class="spin"></span> ' + tx('reading…') + '</div></div>';
    if (p && p.error) return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Your plan') + '</div><div class="err" data-testid="plan-err">' + esc(p.error) + '</div></div>';
    var lines = (p && p.lines) || [], lim = f.limits || null, used = f.used || {};
    var head = lines.length ? esc(String(lines[0].text)) : esc(tx('No plan recorded'));
    var body = !lim
      ? '<div class="misnote" data-testid="plan-nolimits">' + esc(tx('Limits not declared for this plan — nothing is counted against a number nobody set.')) + '</div>'
      : row(tx('Chits today'), Number(used.chits_today || 0), lim.chits_per_day == null ? null : Number(lim.chits_per_day), tx('no daily limit'))
        + row(tx('Entities'), 1, lim.max_entities == null ? null : Number(lim.max_entities), tx('no limit'))
        + row(tx('Networks'), 0, lim.max_networks == null ? null : Number(lim.max_networks), tx('not counted here'))
        + '<div class="misnote" style="margin-top:8px">' + esc(tx('Public shop page')) + ': <b>' + esc(lim.public_facing ? tx('allowed') : tx('not on this plan')) + '</b>'
        + (lim.mode ? ' · ' + esc(String(lim.mode).replace(/_/g, ' ')) : '') + '</div>';
    return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Your plan') + '</div>'
      + '<div style="font-size:var(--fs-3);font-weight:700" data-testid="plan-name">' + head + '</div>'
      + '<div class="misnote" style="margin-bottom:8px">' + esc(tx('What your plan allows, from the platform\'s constitution. The numbers are the server\'s.')) + '</div>' + body + '</div>';
  }
  function usageCard(){
    var u = H.usage;
    if (u === null) return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Usage billed') + '</div><div class="loadwrap"><span class="spin"></span> ' + tx('reading…') + '</div></div>';
    if (u && u.error) return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Usage billed') + '</div><div class="err" data-testid="usage-err">' + esc(u.error) + '</div></div>';
    if (u && u.not_enabled) return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Usage billed') + '</div><div class="misnote" data-testid="usage-off">' + esc(tx('Usage recording is not switched on for this deployment yet.')) + '</div></div>';
    var n = (u && u.counts && u.counts.billed) || 0, days = (u && u.window_days) || 30;
    /* ⚠️ BILLED, never "sent": a meter is best-effort, so this can sit below the chits in the mailbox — the gap is a finding, not a number to reconcile away */
    return '<div style="' + _CARD + '"><div class="sec" style="margin:0 0 6px">' + tx('Usage billed') + '</div>'
      + '<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:baseline">'
      + '<div><div style="font-size:var(--fs-3);font-weight:700" data-testid="usage-cost">' + esc(_usageMoney(u && u.total_cost_usd)) + '</div><div class="misnote">' + esc(txf('billed over {n} days', { n: String(days) })) + '</div></div>'
      + '<div><div style="font-size:var(--fs-3);font-weight:700" data-testid="usage-events">' + esc(String(n)) + '</div><div class="misnote">' + esc(tx('events billed')) + '</div></div>'
      + '</div></div>';
  }
  function paint(){
    if (!active()) return;
    H.el.innerHTML = '<h2 class="shop-h" data-testid="plan-title">' + esc(tx('Plan & usage')) + '</h2>' + planCard() + '<div style="margin-top:12px">' + usageCard() + '</div>';
  }
  function mount(host){ H.el = document.createElement('div'); H.el.setAttribute('data-testid', 'plan-screen'); host.appendChild(H.el); read(); paint(); }
  return { mount: mount, paint: paint, active: active };
})();
