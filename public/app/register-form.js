/* register-form.js — THE REGISTER FORM: a new shop's User ID · e-mail → the code · the gov panel (reg-agree) → verify (FX-UX2, 2026-10-14).
 *
 * MOVED out of app.html (#/register) so CB Settings › New shop (settings.html#/new) mounts the SAME form — one form, one `reg-agree`, one
 * register / verify pair (api routes/entities.js registerNew · verify). A customer registering from the sign-in window never enters the
 * workshop (docs/design/INDEX-NOT-APP.md, SET3). The pattern is cap-country.js's (SET1): one renderer, two frames, never a second copy.
 *   CBRegistration.mount(host, onDone)   paint the form into host; onDone(verifyAnswer, userId) when the code is verified
 *   host null                             app.html's auth card at #root (app.html: CBRegistration.mount(null, regIn) — regIn keeps its old next step)
 * Host globals it reads (both pages have them): api · EP (register · ownerVerify · constitutions from CB_SHOP_EP) · tx · txf · esc · val ·
 * window.CBGov (app/govcontext.js). app.html's card only: onbBanner · modeRibbon · logo · STAGES · CFG.STAGE · go.
 * Flow step: R2R step 1 · country — registration is its door (docs/process/flows.json).
 */
'use strict';
var REG = {step:"form", name:"", email:"", busy:false, err:""};
var REG_AT = { host: null, onDone: null };   /* host · onDone: a small app's pane (CB Settings › New shop) — null = app.html's auth card at #root */
function regReset(){ REG={step:"form", name:"", email:"", busy:false, err:""}; renderRegister(); }
/* SCREEN: Register (#/register) · module target: auth.js
   Real flow: POST EP.register {display_name, email} -> OTP -> POST EP.ownerVerify {email, otp} -> token + active entity (signed in).
   GAPS (API-side, for CLI): STEP 2 role/blueprint carry (not stored yet) · STEP 3 schema gate (fresh entity needs a default entity_schemas, else catalogue 404s). */
/**
 * ⭐⭐ WHAT WE FILLED IN, AND WHERE EACH ANSWER CAME FROM. Five rows, one line of explanation, and a tick. The
 * shop does not type any of it; it only says whether we got it right.
 * ⚠️ AN UNKNOWN IS SHOWN AS AN UNKNOWN. Country decides tax and money, so a blank a person can see beats a
 * default they never saw. [[feedback-write-for-the-shopkeeper]]
 */
function govRows(){
  try { return (window.CBGov && CBGov.rows(govCtx())) || []; } catch (_) { return []; }
}
var _govCtx = null;
function govCtx(){
  /* ⚠️ READ ONCE. Re-deriving on every repaint would let the values move under the person while they read. */
  try { if (!_govCtx && window.CBGov) _govCtx = CBGov.read(); } catch (_) { _govCtx = null; }
  return _govCtx;
}
/**
 * ⭐⭐ GOV-SPIN (Athi, 14 Oct): A REGIONAL SPIN STATES ITS COUNTRY, AND THE REGISTRANT ACCEPTS IT. GET /entities/constitutions (fetched before
 * this step paints) now carries `installation { country, name, timezone }` (b382) and `countries[]` — the packs a registrant may choose, each
 * with what it applies (currency · year · tax · format · languages). When the installation states a country it is offered FIRST, with its
 * source in words; the browser's guess is shown beside it only when it differs; another country only from the server's list (tighten-only),
 * else the panel says why. The ONE reg-agree accepts it; verify carries the choice (country_source) and the SERVER decides what is stored.
 * This file computes nothing: every value is the server's pack row or the browser's own Intl. No spin data (an older api) → the rows above.
 * Flow step: Onboarding · Register (docs/process/flows.json).
 */
function regPackOf(code){
  var l = (REG.spin && Array.isArray(REG.spin.countries)) ? REG.spin.countries : [];
  for (var i = 0; i < l.length; i++) if (l[i] && l[i].code === code) return l[i];
  return null;
}
function regInstCountry(){ return (REG.spin && REG.spin.installation && REG.spin.installation.country) || ''; }
function regBrowserCountry(){ var g = govCtx(); return (g && g.country && g.country.value) || ''; }
function regCountryName(code){
  if (!code) return '';
  var pk = regPackOf(code); if (pk && pk.name) return pk.name;
  try { var R = window.CBLocale && CBLocale.REGIONS; if (R && R[code] && R[code].name) return R[code].name; } catch (_) {}
  try { var n = new Intl.DisplayNames(['en'], { type: 'region' }).of(code); if (n && n !== code) return n; } catch (_) {}
  return code;
}
/** where the country on the panel came from — the same three codes the server records (it re-decides them from the facts) */
function regSourceOf(code){ return code && code === regInstCountry() ? 'installation' : code && code === regBrowserCountry() ? 'browser' : 'chosen'; }
/** the first country offered: the installation's, else the browser's when the server may serve it, else none (the panel says so) */
function regFirstCountry(){
  var inst = regInstCountry(), br = regBrowserCountry();
  if (inst) return inst;
  if (br && (!REG.spin || !REG.spin.countries || regPackOf(br))) return br;
  return '';
}
/** a language's English name, and for a right-to-left one its own name too, isolated so it never flips the row ([[project-arabic-rtl]]) */
function regLangHTML(code){
  var en = code, own = '';
  try { en = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code; } catch (_) {}
  if (/^(ar|ur|fa|he)$/.test(code)) { try { own = new Intl.DisplayNames([code], { type: 'language' }).of(code) || ''; } catch (_) {} }
  return esc(en) + (own && own !== en ? ' <bdi dir="rtl" lang="' + esc(code) + '">' + esc(own) + '</bdi>' : '');
}
/** how numbers and dates print in the pack's format — the browser's own Intl, one fixed sample */
function regFormatSample(locale){
  try {
    var n = new Intl.NumberFormat(locale).format(1234.5), d = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(2026, 9, 14));
    return '<bdi dir="auto">' + esc(n) + '</bdi> · <bdi dir="auto">' + esc(d) + '</bdi>';
  } catch (_) { return esc(locale); }
}
/** the zone the server will store (country-setup.offerOf): the device's when it is the pack's, else its one zone, else the installation's */
function regZoneFor(pk){
  var dev = (govCtx() && govCtx().timezone && govCtx().timezone.value) || '', z = (pk && pk.zones) || [], inst = REG.spin && REG.spin.installation && REG.spin.installation.timezone;
  if (dev && z.indexOf(dev) >= 0) return { value: dev, from: tx('your device clock') };
  if (z.length === 1) return { value: z[0], from: txf('the {c} pack', { c: pk.name }) };
  if (inst && z.indexOf(inst) >= 0) return { value: inst, from: tx('this ChitBridge') };
  return { value: '', from: tx('you pick it after signing in') };
}
/** the rows when the server sent its countries: the country (with its source), then what that country's pack applies */
function regSpinRows(){
  var c = REG.country, inst = regInstCountry(), pk = regPackOf(c), name = regCountryName(c), out = [];
  var g = govCtx(), from = !c ? tx('you set this after signing in') : c === inst ? txf('This ChitBridge runs in {c}', { c: name })
    : c === regBrowserCountry() ? ((g && g.country && g.country.from) || tx('your browser')) : tx('you chose it');
  out.push({ key: 'country', what: tx('Country'), value: esc(name), from: from, known: !!c });
  if (pk) {
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var tax = [pk.tax && pk.tax.scheme, pk.tax && pk.tax.id].filter(Boolean).join(' · ');
    var zone = regZoneFor(pk);
    out.push({ key: 'currency', what: tx('Money'), value: esc(pk.currency || ''), from: txf('the usual currency in {c}', { c: name }), known: !!pk.currency });
    out.push({ key: 'year', what: tx('Year starts'), value: esc(pk.fy_start_month ? tx(months[pk.fy_start_month - 1]) : ''), from: txf('the {c} pack', { c: name }), known: !!pk.fy_start_month });
    out.push({ key: 'tax', what: tx('Tax'), value: esc(tax), from: (pk.tax && pk.tax.return) ? txf('returns: {r}', { r: pk.tax.return }) : txf('the {c} pack', { c: name }), known: !!tax });
    out.push({ key: 'format', what: tx('Format'), value: pk.locale ? regFormatSample(pk.locale) : '', from: txf('how {c} writes numbers and dates', { c: name }), known: !!pk.locale });
    out.push({ key: 'language', what: tx('Language'), value: (pk.languages || []).slice(0, 2).map(regLangHTML).join(' · '), from: txf('the {c} pack', { c: name }), known: !!(pk.languages && pk.languages.length) });
    out.push({ key: 'timezone', what: tx('Time zone'), value: esc(zone.value), from: zone.from, known: !!zone.value });
  }
  /* the device row as the browser reads it (CBGov.rows) — the rest above replace its guesses */
  govRows().forEach(function (r) { if (r.key === 'device') out.push({ key: r.key, what: r.what, value: esc(r.value), from: r.from, known: r.known }); });
  return out;
}
/** the line beside the country: the browser's differing guess, the choice the server allows, or why there is none */
function regCountryChoice(){
  var inst = regInstCountry(), br = regBrowserCountry(), list = (REG.spin && REG.spin.countries) || [], h = '';
  if (inst && br && br !== inst) h += '<div data-testid="reg-gov-browser">' + esc(txf('Your browser says {c}', { c: regCountryName(br) })) + '</div>';
  if (list.length > 1) {
    h += '<label style="display:block;margin-top:4px">' + esc(tx('Another country')) + ' <select class="inp" data-testid="reg-country" style="width:auto;max-width:100%;display:inline-block;padding:4px 8px" onchange="REG.country=this.value;REG.agreed=false;renderRegister()">'
      + (REG.country ? '' : '<option value="" selected>' + esc(tx('Pick one')) + '</option>')
      + list.map(function (c) { return '<option value="' + esc(c.code) + '"' + (c.code === REG.country ? ' selected' : '') + '>' + esc(c.name || c.code) + '</option>'; }).join('')
      + '</select></label>';
  } else if (inst && br && br !== inst) {
    h += '<div data-testid="reg-gov-why">' + esc(txf('This ChitBridge serves {c} only.', { c: regCountryName(inst) })) + '</div>';
  }
  return h;
}
function govPanel(){
  var spin = !!(REG.spin && Array.isArray(REG.spin.countries) && REG.spin.countries.length);
  var rows = spin ? regSpinRows() : govRows().map(function (r) { return { key: r.key, what: r.what, value: esc(r.value), from: r.from, known: r.known }; });
  if (!rows.length) return '';
  var hd = regInstCountry() ? tx('Check these. They set your tax and money.') : tx('We filled these in from your browser. Change any of them after you sign in.');
  return '<div class="govbox" data-testid="reg-gov">'
    + '<div class="govhd">' + esc(hd) + '</div>'
    + rows.map(function(r){
        return '<div class="govrow' + (r.known ? '' : ' unknown') + '" data-testid="reg-gov-' + r.key + '">'
          + '<span class="gw">' + esc(r.what) + '</span>'
          + '<span class="gv">' + (r.known ? r.value : esc(tx('not known'))) + '</span>'
          + '<span class="gf">' + esc(r.known ? r.from : tx('you can set this after signing in')) + '</span>'
          + (spin && r.key === 'country' ? '<div class="gf">' + regCountryChoice() + '</div>' : '')
          + '</div>';
      }).join('')
    + '</div>'
    /* ⚠️⚠️ THE GATE. Not a notice — a question about the country that decides their tax. GOV-SPIN: the same one control accepts the country. */
    + '<label class="govagree"><input type="checkbox" id="r_agree" data-testid="reg-agree"'
    + (REG.agreed ? ' checked' : '') + ' onchange="REG.agreed=this.checked;renderRegister()">'
    + '<span>These are right, and I accept the terms of use.</span></label>';
}
/** what verify sends: the browser's context, with the country the person ACCEPTED and where it came from (the server re-decides the source) */
function regPayload(){
  if (!window.CBGov) return undefined;
  var p = CBGov.payload(govCtx());
  if (REG.spin && REG.country) {
    var pk = regPackOf(REG.country);
    p.country = REG.country; p.country_source = regSourceOf(REG.country);
    if (pk && pk.currency) p.currency_code = pk.currency;
  }
  return p;
}
function renderRegister(){
  const R=REG; const who='style="font-size:var(--fs-2);color:var(--grey);margin-bottom:8px"'; const muted='style="color:var(--grey);font-weight:400"';
  let form="";
  if(R.step==="form"){
    /* ⭐⭐ THE REGISTRATION SCREEN ASKS FOR THE USER ID, NOT A NAME. Athi, 2026-08-19: *"generally what we say
       is the id created is userid, and the name is any name"* — and *"once registered, through IAM screen they can
       change the display name. The display name can be anything and any format. No restriction."*

       So this field is the one thing that is permanent, and the only place it is ever chosen. The two banned
       characters are the grammar of the namespace, which is why the hint names them rather than just refusing:
           acmetraders            an ENTITY      — what you register here
           ravi@acmetraders       an EMPLOYEE    — @ binds a person to their business
           acmetraders.clothing   a NETWORK node — . binds a store to its network
       Only the entity ever registers. Employees are created by the business, network stores are minted by their
       parent, and customers register at a storefront automatically. */
    form = `${typeof onbBanner === 'function' ? onbBanner() : ''}<label class="fl">User ID</label><input class="inp" id="r_name" data-testid="reg-name" placeholder="acmetraders" autocapitalize="off" spellcheck="false" value="${esc(R.name)}">
       <div style="font-size:var(--fs-1);color:var(--grey);margin:-2px 0 8px;line-height:1.5">${txf('8 characters or more · lowercase letters, numbers and dashes — nothing else.{br}No spaces, and no punctuation: {at} {dot} {tilde} each already mean something here — they make an employee, a network store, and a supplier you write down yourself — so they are kept for that.{br}{fixed} Your business name can be anything you like, spaces and all, and you set it after signing in.', {
        at: '<b>@</b>', dot: '<b>.</b>', tilde: '<b>~</b>', br: '<br>',
        fixed: '<b>' + tx('This cannot be changed later.') + '</b>' })}</div>
       <label class="fl">Email</label><input class="inp" id="r_email" data-testid="reg-email" placeholder="you@business.in" value="${esc(R.email)}">
       ${R.err?`<div class="err">${R.err}</div>`:""}
       <button class="btn gold" id="r_go" data-testid="reg-submit" ${R.busy?"disabled":""}>${R.busy?'<span class="spin"></span> Creating…':"Create entity <span class=arw>→</span>"}</button>`;
  } else {
    form = `<div ${who}>Entity <b>${esc(R.name)}</b> — verify to enter · <a onclick="regReset()">change</a></div>
       ${regVerticalChooser()}
       ${govPanel()}
       <label class="fl">OTP sent to ${esc(R.email)}</label><input class="inp" id="r_otp" data-testid="reg-otp" placeholder="6-digit code" autocomplete="one-time-code" inputmode="numeric">
       ${R.err?`<div class="err">${R.err}</div>`:""}
       <button class="btn gold" id="r_go" data-testid="reg-submit" ${(R.busy||!R.agreed)?"disabled":""}>${R.busy?'<span class="spin"></span> Verifying…':"Verify &amp; enter <span class=arw>→</span>"}</button>`;
  }
  /* ⭐ FX-UX2: a small app's pane — the same form, under the page's own heading; "Sign in" is Home's one sign-in window (never #/login) */
  if (REG_AT.host) {
    REG_AT.host.innerHTML = '<div class="cs" data-testid="reg-screen"><h2 class="shop-h" data-testid="reg-title">' + esc(tx('Create your entity')) + '</h2>'
      + '<p class="sub">' + esc(tx('Register your business on Chit & Bridge')) + '</p><div class="body">' + form
      + '<div class="swap" style="margin-top:14px">' + esc(tx('Already registered?')) + ' <a href="/" data-testid="reg-signin">' + esc(tx('Sign in')) + '</a></div></div></div>';
  } else
  document.getElementById("root").innerHTML = modeRibbon() + `
  <div class="auth"><div class="card">
    <div class="top">${logo()}<h1>Create your entity</h1><p class="sub">Register your business on Chit &amp; Bridge</p></div>
    <div class="body">
      ${form}
      <div class="hint"><b>${STAGES[CFG.STAGE].label}</b> — real OTP to your email via <span class="mono">${EP.register.p}</span>.</div>
      <div class="swap">Already registered? <a onclick="go('#/login')">${tx('Sign in')}</a></div>
    </div>
  </div></div>`;
  const b=document.getElementById("r_go"); if(b) b.onclick=doRegister;
}
async function doRegister(){
  const R=REG;
  const v_name=val("r_name"), v_email=val("r_email"), v_otp=val("r_otp");
  if(R.step==="form"){
    if(!v_name || !v_email){ R.err="A User ID and an email address are required."; return renderRegister(); }
    /* ⚠️ THE SAME RULE AS THE SERVER, SAID BEFORE THE ROUND TRIP — not INSTEAD of it. handleLib.checkRoot is the
       authority (routes/entities.js refuses on its own); this only spares someone a wasted OTP request. It is
       deliberately the same three sentences, so a person never sees two different explanations of one rule. */
    const uid=v_name.trim().toLowerCase();
    if(uid.indexOf("@")>=0){ R.err='A User ID cannot contain "@". That separator makes an employee sign-in — ravi@yourbusiness.'; return renderRegister(); }
    if(uid.indexOf(".")>=0){ R.err='A User ID cannot contain ".". That separator makes a network store — yourbusiness.clothing.'; return renderRegister(); }
    if(uid.length<8){ R.err='A User ID is at least 8 characters. "'+uid+'" is '+uid.length+'.'; return renderRegister(); }
    if(!/^[a-z0-9][a-z0-9-]*$/.test(uid)||/-$/.test(uid)){
      /* ⚠ SAY WHICH CHARACTER. "letters, numbers and dashes" makes the person re-read their own typing to find
         what offended; the first bad character is something we already know. */
      var badch=(uid.match(/[^a-z0-9-]/)||[])[0];
      R.err = badch
        ? (badch===' ' ? 'A User ID cannot contain a space. Use a dash instead — corner-hardware.'
                       : 'A User ID cannot contain "'+badch+'". Letters, numbers and dashes only — the rest are kept for internal use.')
        : 'A User ID starts and ends with a letter or number — not a dash.';
      return renderRegister(); }
    R.name=uid; R.email=v_email.trim();
  }
  R.err=""; R.busy=true; renderRegister();
  try{
    if(R.step==="form"){
      /* user_id is the permanent one; display_name simply STARTS as it and is free to change in IAM after. */
      /* ⭐ FX-AU1: the guess the governance panel SHOWED travels with the registration — the server names it in the write that creates the
         shop (routes/entities.registerNew), so the column default never decides a Sydney shop is Indian. Verify still sends it (COALESCE). */
      const r=await api("register",{body:{user_id:R.name, display_name:R.name, email:R.email,
        context:(window.CBGov?CBGov.payload(govCtx()):undefined)}});
      R.email=(r&&r.email)||R.email; R.busy=false; R.step="otp";
      try{ const c=await api("constitutions"); REG.verticals=(c&&c.constitutions)||[]; const dv=(REG.verticals.find(function(x){return x.is_default;})||REG.verticals[0]); REG.constitution=dv?dv.key:null;
        /* GOV-SPIN: the installation's country and the packs a registrant may choose — the panel's first country is the installation's */
        REG.spin=(c&&Array.isArray(c.countries))?{installation:c.installation||null, allowed:c.allowed_countries||null, countries:c.countries}:null; REG.country=regFirstCountry(); }catch(_){ REG.verticals=[]; REG.spin=null; }
      return renderRegister();
    }
    /**
     * ⭐⭐ THE GOVERNANCE LAYER TRAVELS WITH THE VERIFICATION — one round trip, and it arrives at the moment the
     * identity becomes real rather than as a second call that can fail on its own.
     * ⚠️ `agreed_at` IS THE EVIDENCE, not the tick. A boolean says somebody ticked a box; a timestamp says when.
     */
    const r=await api("ownerVerify",{body:{email:R.email, otp:v_otp, constitution:R.constitution||undefined,
      context:regPayload(), agreed_at:new Date().toISOString()}});
    R.busy=false;
    /* the host's next step: app.html's regIn (the session · a paired counter · #/country) or CB Settings' (keep the session, open Home) */
    if(REG_AT.onDone) return REG_AT.onDone(r, R.name);
  }catch(e){ R.busy=false; R.err="Could not register: "+e.message+" (check endpoint / stage)"; renderRegister(); }
}
/* The vertical/blueprint chooser at sign-up — showcases the available constitutions (verticals) so the registrant
   picks one; their entity is minted onto it (verify → entity_governance). "None fits" → tailor / contact the team. */
function regVerticalChooser(){
  const vs=(REG.verticals)||[];
  if(!vs.length) return '';
  return '<div style="margin:10px 0 4px"><div class="fl">Choose your setup <span style="font-weight:400;color:var(--grey)">(you can change later)</span></div>'
    + vs.map(function(v){ const sel=(REG.constitution||'')===v.key; const caps=(v.capabilities||[]).join(' · ');
        return '<div data-testid="reg-vertical-'+esc(v.key)+'" onclick="REG.constitution=\''+esc(v.key)+'\';renderRegister()" style="border:1px solid '+(sel?'var(--blue)':'var(--line)')+';background:'+(sel?'var(--blue-tint)':'var(--card)')+';color:' + (sel ? 'var(--on-card)' : 'var(--on-card)') + ';border-radius:9px;padding:9px 11px;margin-bottom:7px;cursor:pointer"><div style="font-weight:700;font-size:var(--fs-2);color:var(--ink)">'+(sel?'● ':'○ ')+esc(v.label||v.key)+(v.is_default?' <span style="font-size:var(--fs-1);color:var(--grey);font-weight:400">· default</span>':'')+'</div><div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">'+(v.vertical?('vertical: '+esc(v.vertical)+' · '):'')+'includes '+esc(caps||'core')+'</div></div>';
      }).join('')
    + '<div style="font-size:var(--fs-1);color:var(--grey);margin:2px 0 4px">' + txf('None fits? {tailor} — or {contact} to wire it quickly.', {
        tailor:  '<a onclick="regTailor();return false" style="color:var(--blue);cursor:pointer;font-weight:600">' + tx('Tailor one') + '</a>',
        contact: '<a onclick="regContact();return false" style="color:var(--blue);cursor:pointer;font-weight:600">' + tx('contact the team') + '</a>' }) + '</div>'
    + '</div>';
}
function regTailor(){ if(typeof toast==='function') toast("Tailoring — we'll wire a custom setup with you. For now, pick the closest and refine later."); }
function regContact(){ try{ window.location.href='mailto:team@chitandbridge.com?subject='+encodeURIComponent('Tailor a setup for '+(REG.name||'my business')); }catch(_){ if(typeof toast==='function')toast('Email team@chitandbridge.com to wire a custom setup.'); } }


var CBRegistration = { mount: function (host, onDone) { REG_AT.host = host || null; REG_AT.onDone = onDone || null; renderRegister(); } };
try { window.CBRegistration = CBRegistration; } catch (_) {}
