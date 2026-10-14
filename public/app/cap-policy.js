/* app/cap-policy.js — POLICY: the shop's business rules (per-entity policy flags, server-persisted, b130) — ONE implementation painted in two
 * places (T3-SETTINGS, 2026-10-14; the pattern of cap-shop.js, SET1).
 *
 * MOVED from cap-admin.js (never copied; the workshop's Settings › Policy and Governance call these same names):
 *   GOV_KLASS · govKlass · POLICY_FLAGS · _POL · _polVal · _polLocked · setPolFlag · loadPolicy · paintPolicy · _polControl · policyFlagsCard · policyFlagsInner
 * WIDENED (additively): _POL.may — the SERVER's who-may-change per flag (GET /api/entities/policy `may[key]` = { ok, code, why }, lib/policy's one
 *   table): a refused control is the value + a lock + the sentence, never hidden; the labels stay HERE (POLICY_FLAGS is their one copy).
 * NEW: CBPolicy.mount(host) — CB Settings › Policy & Localisation (the Localisation half is cap-locale.js, mounted under it by the page).
 * Host globals (as every cap-*.js): api · EP (policyGet · policySet — CB_SHOP_EP, accounts-shell.js) · esc · tx · txf · toast · _CARD · specNote ·
 *   pendingNote (helpers.js) · SESSION · CBShowcase (optional, the workshop's showcase card).
 * Loaded by app.html through CAP_WITH.admin (before cap-admin.js) and by settings.html directly.
 * Flow step: Onboarding · policy (docs/process/flows.json).
 */
'use strict';
/**
 * ⚠️ REWRITTEN FOR A READER, NOT A DEVELOPER. These were 9.5px Space Mono chips reading "advisory · mutable",
 * "lock · bound", "free · TBD" — below the 11px legibility floor, in the data font, and in vocabulary that only
 * means anything if you already know the model. Every row carried one, so a layer was a wall of nine-colour
 * jargon and the actual question ("can I change this?") was the hardest thing on the screen to answer.
 *
 * Now: plain words, at the floor, and only where they add something the GROUP HEADING has not already said.
 */
var GOV_KLASS = {
  advisory:  { say:'you can change this',        tone:'yours' },
  entity:    { say:'you set this',               tone:'yours' },
  bound_set: { say:'choose from a fixed list',   tone:'yours' },
  chosen:    { say:'you can only make it stricter', tone:'yours' },
  bound:     { say:'locked by the layer above',  tone:'fixed' },
  inherited: { say:'inherited, frozen',          tone:'fixed' },
  protected: { say:'set by the platform',        tone:'fixed' },
  metered:   { say:'counted for licensing',      tone:'fixed' },
  free:      { say:'not set yet',                tone:'none'  }
};
/**
 * ⚠️ PERMISSION IS NOT THE SAME AS "THERE IS A CONTROL HERE", and conflating them made this screen lie.
 *
 * The class says what the LAYER permits. Translating `advisory · mutable` to the plain "you can change this" read
 * as a promise about THIS SCREEN — and 4 of the 19 rows carrying it (Message max length, Catalogue visibility,
 * Attachment types, Attachment max size) are rendered as plain text with nothing to click. The old jargon was
 * vague enough to survive that gap; plain English is not, which is a good argument for plain English and a bad
 * argument for leaving it unchecked.
 *
 * So the wording now depends on whether the row actually offers a control. Same governance, honest sentence.
 */
function govKlass(k, hasControl){
  var x = GOV_KLASS[k] || GOV_KLASS.free;
  var col = x.tone==='yours' ? ['var(--ok-tint)','var(--ok-2)'] : x.tone==='fixed' ? ['var(--blue-tint-bg)','var(--blue-2)'] : ['var(--warn-tint)','var(--grey-2)'];
  var say = x.say;
  /**
   * ⚠️ `=== false`, NOT `!hasControl`. Only a caller that has actually LOOKED may claim there is no control.
   * policyFlagsCard calls govKlass(def.gov) with one argument and renders its select separately, so `undefined`
   * was read as "no control" and every policy flag suddenly said "no control here yet" beside a working dropdown.
   * The same mistake as the rows this caveat was written to fix, pointing the other way: an assertion made from
   * absence of information rather than from evidence.
   */
  if (x.tone === 'yours' && hasControl === false){
    col = ['var(--warn-tint)','var(--warn-3)'];
    say = say + ' — no control here yet';
  }
  return '<span class="govtag" style="background:'+col[0]+';color:'+col[1]+'">'+say+'</span>';
}
/* ---- POLICY FLAGS — per-entity governance toggles, SERVER-PERSISTED (b130).
 *
 * Athi, 2026-08-09: *"make the policy flags real, move it to settings."*
 *
 * They were a localStorage prototype: the card said "set ✓", nothing left the browser, and the server that has to
 * ENFORCE them never heard. `self_copy_pref` was the sharpest version of that — it has a real, enforced column, and
 * this card wrote past it into localStorage, so the one flag with teeth was the one the UI had disconnected.
 *
 * The schema still lives here (the card renders from data, not from markup), but the VALUES now come from and go
 * to /api/entities/policy, which validates against its own whitelist. The server never trusts this list.
 */
var POLICY_FLAGS = [
  /* ⚠️ AN ENTITY IS CREATED FOR A PURPOSE. Athi: *"sell and purchase never been the same entity. while testing we
     are trying to test all the possibility in the same business, so for us it seems the same entity will do
     everything, but that is not going to be the case."* Which side of the trade an entity is on does not change
     message to message — which is why this is a setting here and not the per-raise toggle I first built. */
  { key:'trade_side',        label:'This entity',           type:'enum',   options:['sell','receive'],              def:'sell', level:'entity',        gov:'entity',   help:'SELL — inbound messages are priced from your catalogue where the item matches. RECEIVE — they are not: a catalogue price is what you SELL at, and pricing goods coming IN off it puts a figure on the record nobody agreed.' },
  /* ⭐ Tally's "registration type", as a policy flag — what an invoice may CHARGE before any rate applies. Read by
     lib/tax.js on every determination (STUDY-gst-structure-2026-09-04 §6 G2). */
  { key:'gst_registration',  label:'GST registration',       type:'enum',   options:['regular','composition','unregistered','sez'], def:'regular', level:'entity', gov:'entity', help:'REGULAR — charges GST and claims credit. COMPOSITION — flat % on turnover, no GST on invoices, no credit. UNREGISTERED — no GSTIN; buys as a consumer. SEZ — supplies to you are zero-rated.' },
  /* ⭐ Athi, 2026-09-06 11:30: the chit's Summary is the cart's money and the delivery — commercial cover only where the trade needs it */
  /* ⭐ BOOKS AT (Athi, 2026-09-06: "there must be some trigger to be allowed to go to Tally, from the task") — when a connector books an order */
  { key:'books_at',          label:'Orders go to the books',  type:'enum',   options:['received','accepted','completed','manual'], def:'accepted', level:'entity', gov:'entity',   help:'When a connector (Tally · Zoho · GoFrugal) books an order as a voucher. received — the moment it arrives. accepted — once you accept it (the usual case). completed — once it is done. manual — only when you press "Send to books" on the Task. The Task always says whether and when it was written.' },
  /* ⭐ Athi, 2026-09-07: "do we have a mechanism to check if not posted before the next day?" — the window after which an order the
     trigger released, and nothing booked, is called overdue in Settings › Integrations › In the books. */
  { key:'books_overdue_hours', label:'Overdue after (hours)', type:'number', def:12, level:'entity', gov:'entity', help:'How long an order released by the trigger may go unbooked before reconciliation calls it overdue. 12 = by the next morning.' },
  /**
   * ── ⭐⭐⭐ HOW MUCH DIFFERENCE IS NOT A DISPUTE ────────────────────────────────────────────────────────────
   *
   * ⚠️⚠️ THESE THREE HAVE BEEN LIVE SINCE 2026-09-08 WITH NO WAY TO SET THEM. routes/till.js reads them on every
   * receipt and every reconciliation; nothing anywhere could change them, so every shop on the platform has been
   * running the defaults and none of them was ever asked. A policy nobody can see is a policy nobody agreed to.
   *
   * Their own note, kept: *"Loose goods do not arrive to the gram: moisture, dust and the weighbridge move a
   * lorry of rice by a few kilos, and a counter that called every one of those a shortage would teach the shop
   * to ignore the word."*
   *
   * ⚠️⚠️ NOT THE SAME THING AS Catalogue → Units of measure, and the words must keep them apart. That one asks
   * *"the scale reads 1.010 — what goes on the bill?"* and is FLAT. This one asks *"ordered 1000 kg, 998
   * arrived — is that a dispute?"* and is a PERCENTAGE, because a lorry's variance scales with the lorry.
   *
   * ⭐ STORED IN BASIS POINTS, SHOWN AS A PERCENTAGE. The flag type truncates, so half a percent had to be 50
   * rather than 0.5 — but nobody types basis points. `scale` renders the human number and stores the integer.
   */
  { key:'tol_weight_bp',     label:'Short delivery allowed (weighed goods)', type:'number', scale:100, suffix:'%', step:0.01,
    def:50, level:'entity', gov:'entity',
    help:'How much less than ordered may arrive on WEIGHED goods before the counter calls it short. 0.50% is the usual figure — moisture, dust and the weighbridge move a lorry by a few kilos. Set 0 to call every gram.' },
  { key:'tol_count_units',   label:'Short delivery allowed (counted goods)', type:'number', suffix:'units',
    def:0, level:'entity', gov:'entity',
    help:'The same question for goods that are COUNTED, in whole units rather than a percentage. 0 is right for almost every shop — a packet is a packet, and one missing is one missing.' },
  { key:'tol_rate_bp',       label:'Rate difference allowed',               type:'number', scale:100, suffix:'%', step:0.01,
    def:0, level:'entity', gov:'entity',
    help:'How far a supplier\'s billed RATE may differ from the order before it is named. ⚠️ Keep this at 0 unless you mean it: a quantity can be short by weather, a price cannot. "Close enough" on a rate is a decision somebody made, and it belongs in front of a person.' },
  { key:'trade_cover',       label:'Trade cover on chits',    type:'enum',   options:['off','on'],                    def:'off',  level:'entity', gov:'entity',   help:'ON — the Summary of a chit also shows the supplier clearances and the commercial-cover (FRM) frame. OFF — the financial summary of the cart and the delivery only (most trades).' },
  /**
   * ⚠️ `def` WAS `both` HERE TOO — A THIRD DECLARATION OF ONE DEFAULT. The engine (routes/chits.js) did
   * `received`, lib/policy.js said `both`, and so did this. Three statements of one rule, two of them wrong.
   * ⭐ Athi settled it 2026-08-16: *"mostly it is task, a billing counter, very rarely this become order… so the
   * default is task, if the user changes to order copy, then we need to honour that"* — which is exactly what the
   * engine already did. The saved column is read first; this is only the fallback, so an explicit choice stands.
   * ⚠️ Guarded by tests/policy-defaults.test.js in the API repo, which reads BOTH sides and fails if they part.
   */
  { key:'self_copy_pref',    label:'Self-chit copy',        type:'enum',   options:['received','both','sent'],
    labels:{ received:'Task only', both:'Both Task and Order', sent:'Order only' },
    def:'received', level:'entity',        gov:'entity',   help:'' },
  /**
   * ⭐⭐ WHICH DETAIL PAGE THIS BUSINESS READS ITS WORK ON. Athi, 2026-08-24: *"we have to attach design 1 or
   * design 2 per entity so we can attach only one design for a store."*
   *
   * ⭐ THE NAMES ARE ERP'S, NOT OURS — SAP, Oracle and every dealer system call this distinction the ATOM OF
   * WORK, and it is the same distinction in a workshop, a kitchen and a trading desk. "Design 1" and "design 2"
   * were our internal shorthand and meant nothing to anyone else.
   *
   * ⚠️ A DEFAULT, NOT THE RECORD. A chit is stamped with the design when it is created and keeps it for life,
   * so changing this decides how the NEXT job reads — never how an existing one does. That is the whole point:
   * *"so we avoid complication of moving from one record type to another."*
   */
  { key:'detail_design',     label:'Detail page',           type:'enum',   options:['chit','lines'],
    labels:{ chit:'Order level', lines:'Line level' },
    def:'chit', level:'entity',        gov:'entity',
    help:'Order level — the chit is the unit of work. Line level — each line has its own person, parts and cost. Applies to new chits.' },
  { key:'chit_expiry_days',  label:'Chit expiry (days)',    type:'number', def:0,  level:'work-pattern', gov:'chosen',   help:'0 = no expiry' },
  { key:'retention_days',    label:'Retention (days)',      type:'number', def:0,  level:'entity',        gov:'chosen',   help:'0 = keep' },
  { key:'dispute_scope',     label:'Dispute messages',      type:'enum',   options:['per-party','shared'],          def:'per-party', level:'platform', gov:'bound', help:'Set by the platform' },
  /* ⭐ Athi, 2026-09-18 (quick-keys handoff, decision 2): "keep it as a choice in settings". Read by the counter's
     Level-2 quick-key state since then and settable by nobody until 2026-09-28 (e2e/policy-reachable.cjs). The help
     says plainly that shift close changes nothing yet — there are no shifts to close against. */
  { key:'quick_key_reset_at', label:'Counter sold-out marks clear', type:'enum', options:['business_day','shift_close'],
    labels:{ business_day:'At the day roll', shift_close:'At shift close' }, def:'business_day', level:'entity', gov:'entity',
    help:'When a counter\'s sold-out marks on its quick keys clear themselves. At the day roll — the usual case. At shift close works like the day roll until shifts are recorded.' },
];
var _POL = { flags:null, busy:false, err:null, migrated:true, may:null };   /* may: the server's who-may-change per flag (T3-SETTINGS) */
function _polVal(def){ var o=_POL.flags||{}; return (o[def.key]!==undefined)?o[def.key]:def.def; }
function _polLocked(gov){ return gov==='bound'||gov==='protected'||gov==='inherited'; }
/* ⚠️ THE WRITE IS AWAITED AND ITS ANSWER IS SHOWN. The old version toasted "set ✓" the instant you changed a
   dropdown, whatever happened afterwards — which is the exact habit that let a dead setting look alive for months.
   The card repaints from what the SERVER returns, so what is on screen is what is stored. */
async function setPolFlag(key, v){
  var def=POLICY_FLAGS.filter(function(d){return d.key===key;})[0];
  /**
   * ⚠️ A SCALED FIELD IS STORED IN ITS OWN UNIT, NOT THE ONE ON SCREEN. 0.50% is shown, 50 is stored — and the
   * rounding is deliberate: the flag type truncates, so 0.505% would land as 50 either way, and doing it here
   * means the number that comes back matches the number that was typed.
   */
  if(def&&def.type==='number'&&def.scale) v=(v===''?0:Math.round(Number(v)*def.scale));
  else if(def&&def.type==='number') v=(v===''?0:Number(v));
  _POL.busy=true; _POL.err=null; paintPolicy();
  try{
    var body={}; body[key]=v;
    var r=await api('policySet',{body:body});
    _POL.flags=(r&&r.flags)||_POL.flags;
    toast((def?def.label:'Flag')+' saved');
  }catch(e){
    _POL.err=(e&&e.message)||'Could not save that setting.';
    if(/not migrated|b130|503/i.test(_POL.err)) _POL.migrated=false;
  }
  _POL.busy=false; paintPolicy();
}
async function loadPolicy(){
  _POL.busy=true; _POL.err=null; paintPolicy();
  try{ var r=await api('policyGet'); _POL.flags=(r&&r.flags)||{}; _POL.may=(r&&r.may)||null; _POL.migrated=!(_POL.flags._migrated===false); }
  catch(e){ _POL.err=(e&&e.message)||'Could not read your policy flags.'; }
  _POL.busy=false; paintPolicy();
}
function paintPolicy(){ var h=document.getElementById('polflags'); if(h) h.innerHTML=policyFlagsInner(); }
function _polControl(def){ var v=_polVal(def);
  /* ⭐ T3-SETTINGS: WHO MAY CHANGE IT IS THE SERVER'S ANSWER — GET /entities/policy `may[key]` = { ok, code, why } (lib/policy, the one table the PATCH
     refuses with). ok:false → the value, a lock, and the sentence; the client branches on the code, never on the words. An older api sends no `may`:
     the flag's own governance class (bound · protected · inherited) still locks. */
  var m = _POL.may && _POL.may[def.key];
  if ((m && m.ok === false) || (!m && _polLocked(def.gov))) return '<span style="font-weight:700;font-size:var(--fs-2)">'+esc(String(v))+'</span> <span style="font-size:var(--fs-1)" title="'+esc(m && m.why ? m.why : 'locked / inherited — cannot change here')+'">🔒</span>'
    + (m && m.why ? '<div data-testid="pol-why-'+esc(def.key)+'" style="font-size:var(--fs-1);color:var(--grey);margin-top:3px">'+esc(m.why)+'</div>' : '');
  var dis=_POL.busy?' disabled':'';
  /**
   * ⚠️ THE VALUE IS THE CODE; THE LABEL IS FOR A PERSON. This rendered raw enum codes — a dropdown offering
   * "both · sent · received" against a setting about self-chits, where the words a person recognises are Task and
   * Order. `received` means "Task only" and nothing on screen said so. Athi, 2026-08-16, reasoning it out loud:
   * *"mostly it is task, a billing counter, very rarely this become order"* — that is the vocabulary, and the
   * control should have been speaking it.
   * ⚠️ `value` stays the code, so what is SENT is unchanged. Only the words move.
   */
  if(def.type==='enum') return '<select'+dis+' data-testid="pol-'+esc(def.key)+'" onchange="setPolFlag(\''+def.key+'\',this.value)" style="padding:5px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2)">'+def.options.map(function(o){ var lbl=(def.labels&&def.labels[o])||o; return '<option value="'+esc(o)+'"'+(String(v)===String(o)?' selected':'')+'>'+esc(lbl)+'</option>'; }).join('')+'</select>';
  if(def.type==='number'){
    /* ⭐ shown in the unit a person thinks in; `setPolFlag` puts it back into the unit the flag is stored in */
    var shown = def.scale ? (Number(v)/def.scale) : v;
    return '<input type="number"'+dis+(def.step?' step="'+esc(String(def.step))+'"':'')+' min="0"'
      + ' data-testid="pol-'+esc(def.key)+'" value="'+esc(String(shown))+'"'
      + ' onchange="setPolFlag(\''+def.key+'\',this.value)"'
      + ' style="width:90px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2)">'
      + (def.suffix ? '<span style="font-size:var(--fs-1);color:var(--note);margin-inline-start:5px">'+esc(def.suffix)+'</span>' : '');
  }
  return '<input'+dis+' value="'+esc(String(v))+'" onchange="setPolFlag(\''+def.key+'\',this.value)" style="padding:5px 8px;border:1px solid var(--line);border-radius:6px;font-size:var(--fs-2)">';
}

function policyFlagsCard(){ loadPolicy(); return '<div style="'+_CARD+';margin-top:10px" id="polflags">'+policyFlagsInner()+'</div>'; }
function policyFlagsInner(){
  var rows=POLICY_FLAGS.map(function(def){ return '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)">'
    +'<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-weight:600;font-size:var(--fs-2)">'+esc(def.label)+'</span>'+govKlass(def.gov)+'<span style="font-size:var(--fs-1);font-family:\'Space Mono\';background:var(--neutral-tint);color:var(--grey-2);border-radius:5px;padding:1px 6px">'+esc(def.level)+'</span></div>'
    /* ⚠️ AN EMPTY help RENDERS NOTHING, NOT AN EMPTY DIV. Four of these were trimmed to direction today and
       one removed outright; without this each would leave a 2px-margined empty element under its control —
       a gap that reads as a rendering fault. Same fix as _misHead when its subtitle went. */
    +(def.help ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px;line-height:1.45">'+esc(def.help)+'</div>' : '')+'</div>'
    +'<div style="flex:none;text-align:end;min-width:120px">'+_polControl(def)+'</div></div>'; }).join('');
  /* A setting that cannot be stored must SAY so rather than accept a change it will lose — that is the whole
     failure this card is being rebuilt out of. */
  var warn = !_POL.migrated ? pendingNote('not available on this environment — changes will not save')+'<div style="height:7px"></div>' : '';
  var err = _POL.err ? '<div style="color:var(--disp);font-size:var(--fs-1);margin-top:6px">'+esc(_POL.err)+'</div>' : '';
  return '<div class="sec" style="margin:0 0 4px">🚩 Business rules <span style="font-size:var(--fs-1);font-family:\'Space Mono\';background:var(--ok-tint);color:var(--ok-2);border-radius:5px;padding:1px 6px">saved to your entity</span></div>'
    /* ⭐ GOVERNANCE GRAMMAR → SPEC. "class + level", "platform-bound", "tighten-only" is our vocabulary for
       our mechanism. The person here is deciding one toggle; the grammar behind it is what a reviewer wants. */
    + specNote('settings.policy-flags.grammar',
        'Per-entity toggles cover what the 7-layer block does not yet carry — same governance grammar '
      + '(<b>class</b> + <b>level</b>): 🔒 <b>platform-bound</b> cannot be relaxed · <b>tighten-only</b> may be '
      + 'made stricter · <b>entity</b> is set freely.')
    +warn+rows+err
    +'<div style="font-size:var(--fs-1);color:var(--grey);font-style:italic;margin-top:8px">'
    + txf('Stored on your business, not on this device. {enforced} whether you keep a copy, and whether you buy or sell. Expiry and retention: ⏳ {pending}.', {
        enforced: '<b>' + tx('Working today:') + '</b>', pending: tx('pending') }) + '</div>';
}

/* ── CB SETTINGS › POLICY — the page's host mounts the business-rules card here (T3-SETTINGS) ─────────────────────────────────────────────── */
var CBPolicy = (function () {
  var H = { el: null };
  function active(){ return !!(H.el && H.el.isConnected); }
  function paint(){
    if (!active()) return;
    H.el.innerHTML = '<h2 class="shop-h" data-testid="pol-title">' + esc(tx('Policy & Localisation')) + '</h2>'
      + '<div class="sub" data-testid="pol-sub">' + esc(tx('The rules your records follow. The server says which ones you may change.')) + '</div>'
      + policyFlagsCard();
  }
  function mount(host){ H.el = document.createElement('div'); H.el.setAttribute('data-testid', 'pol-screen'); host.appendChild(H.el); paint(); }
  return { mount: mount, paint: paint, active: active };
})();
