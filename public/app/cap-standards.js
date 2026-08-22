/**
 * cap-standards.js — THE REGISTER OF STANDARDS, and the argument for following them.
 *
 * ⚠️ ITS OWN MODULE BECAUSE TWO SCREENS NEED IT. Settings › Standards is where a reader checks what we
 * implement; the Legend is where the case gets made to someone deciding whether to trust the platform. Athi,
 * 2026-08-18: *"bring the why bother view into legend as well."*
 *
 * ⚠️ THE PROSE BELOW IS THE ASSET, WHICH IS EXACTLY WHY IT IS NOT COPIED. Sixty lines of carefully-weighed
 * argument — including the COSTS, which are the part that makes the benefits believable — would drift the first
 * time one copy was edited, and the copy nobody remembered would be the one a buyer was reading. Data and
 * renderer live here once; both screens call in.
 *
 * ⚠️ LAZY, like every capability. Neither screen is on the daily path, so this must not ride in the initial
 * payload — loaded by ensureCap('standards') from whichever surface asks first.
 */
var STANDARDS = [
  { g:'Localisation', n:'BCP 47 (RFC 5646)',      w:'Language tags — en-IN, ar-AE, ta',                 ex:"ta-IN", exWhy:"A browser sends exactly this as <code>' + tx('Accept-Language') + '</code>. Any system on earth reads it as \"Tamil, as written in India\" — no lookup table, no mapping file.",
    s:'live',
    at:'Localisation', go:'locale', why:'A language tag nobody else parses means every counterparty re-guesses what "Tamil" meant.' },
  { g:'Localisation', n:'UTS #35 · CLDR',         w:'Locale data and the -u- extensions (nu·hc·ca·fw)',  ex:"en-IN-u-nu-latn-hc-h23", exWhy:"One tag carrying four decisions: English, Indian grouping, Western digits, 24-hour clock. Hand it to <code>' + tx('Intl') + '</code> anywhere and you get the same answer.",
    s:'live',
    at:'Localisation', go:'locale', why:'Lakh vs million, month names, which days are the weekend — facts about 200 countries we would otherwise guess. CLDR told us the UAE weekend changed in 2022 when our own comments said otherwise.' },
  { g:'Localisation', n:'RFC 4647',               w:'Language priority list and matching',               ex:"ta, en, hi", exWhy:"Your priority list. A catalogue written in <b>en</b> and <b>hi</b> shows you the <b>en</b> one — the version its author wrote, chosen not translated.",
    s:'live',
    at:'Localisation', go:'locale', why:'Decides which authored version of a catalogue a buyer is shown — without translating anything.' },
  { g:'Localisation', n:'ECMA-402 (Intl)',        w:'Number, money, date, collation, direction',         ex:"12,34,56,789.50", exWhy:"The same number is <b>123,456,789.50</b> to a US reader and <b>123.456.789,50</b> in Germany. Nobody stores three versions; the tag decides at render.",
    s:'live',
    at:'Every screen with a figure on it', go:'locale', why:'Sorting a Tamil supplier list by UTF-16 code units is byte order wearing alphabetical clothes.' },
  { g:'Localisation', n:'IANA tz database',       w:'Time zones — via the engine, not a kept table',     ex:"Asia/Dubai", exWhy:"Not <code>+04:00</code>. An offset is wrong twice a year in half the world; a ZONE stays correct because the rules travel with the name.",
    s:'live',
    at:'Every timestamp on every chit', go:'locale', why:'⭐ Turns "when did this happen" from an argument into a fact. One instant read 19:00, 20:30 and 16:00 to three parties before this.' },
  { g:'Localisation', n:'ISO 4217',               w:'Currency codes on every price',                     ex:"{ amount: 1250.00, currency: \"AED\" }", exWhy:"A price is a pair, never the string \"AED 1250\". Your ERP reads the currency field; it does not parse a symbol out of a label.",
    s:'live',
    at:'Catalogue · prices', go:'catalogue', why:'A price without a stated currency is a number, not an amount — and the party who assumes wrong pays the difference.' },
  { g:'Localisation', n:'ISO 8601',               w:'Timestamps in storage and transport',               ex:"2026-08-18T14:32:05Z", exWhy:"Unambiguous everywhere. \"18/08/2026\" is the 18th of August in Mumbai and invalid in New York — and \"08/09\" is two different days.",
    s:'part',
    note:'Display follows the reader\'s locale by design, which is not ISO form.',
    at:'Chit records · exports', go:'locale', why:'An unambiguous instant on the record, whatever the reader sees.' },
  { g:'Localisation', n:'GNU gettext',            w:'String catalogue — the English is the key',         ex:"msgid \"Save\"", exWhy:"The English IS the key, so an untranslated label shows correct English rather than a leaked <code>btn.save.label</code>.",
    s:'part',
    note:'Primitive and a 449-entry catalogue exist; the call sites are not wrapped yet.',
    at:'Localisation · language', go:'locale', why:'A translator can be handed a file instead of a codebase.' },

  { g:'Accessibility', n:'WCAG 2.2 — 1.4.3 / 1.4.6', w:'Text contrast, measured not asserted',           ex:"#494F56 on #FFFFFF = 8.11:1", exWhy:"A number, not an opinion. Anyone can recompute it from the two hex values and check our claim in a minute.",
    s:'live',
    note:'455 computed checks across 15 themes, 0 failures.',
    at:'Appearance · themes', go:'appearance', why:'⭐ It found 117 real contrast failures in themes that had shipped and that nobody had caught by eye — including body text at 2.57:1 in the smallest font.' },
  { g:'Accessibility', n:'WCAG 2.2 — 1.4.4',      w:'Resize text to 132% without loss of function',      ex:"--fs-3: 14px → 18.5px", exWhy:"The whole scale multiplies, so a heading stays bigger than a caption at 132%.",
    s:'live',
    at:'Appearance · text size', go:'appearance', why:'Someone can keep using the product as their eyes change, instead of leaving it.' },
  { g:'Accessibility', n:'WCAG 2.2 — 2.3.3',      w:'Animation from interactions can be turned off',     ex:"prefers-reduced-motion: reduce", exWhy:"Set once in Windows or iOS; every well-behaved site honours it. You never tell us separately.",
    s:'live',
    at:'Appearance · motion', go:'appearance', why:'Movement triggers migraine and vertigo. Honouring the OS setting means nobody has to ask us separately.' },
  { g:'Accessibility', n:'WCAG 2.2 — full audit', w:'Keyboard, focus order, names and roles',            ex:"—", exWhy:"Nothing to show here yet, and that is the point of the status: no independent audit has been run.",
    s:'part',
    note:'Keymap and focus states exist; no independent audit has been run.',
    at:'Whole product', go:'appearance', why:'The part we cannot honestly claim yet — which is why it says so.' },
  { g:'Accessibility', n:'Okabe–Ito',             w:'Colour-universal palette for colour blindness',     ex:"#0072B2 blue · #D55E00 vermillion", exWhy:"A published pair that stays distinguishable under deuteranopia, protanopia and tritanopia — unlike the green/red pair everyone reaches for.",
    s:'live',
    at:'Appearance · Colour Vision theme', go:'appearance', why:'Ends the argument about which colours to use — a published palette proven distinguishable under every type of colour blindness.' },
  { g:'Accessibility', n:'CSS Logical Properties', w:'Right-to-left layout without a second stylesheet', ex:"margin-inline-start: 12px", exWhy:"Mirrors automatically in Arabic. <code>margin-left</code> would have needed a second stylesheet nobody maintains.",
    s:'live',
    note:'378 physical properties converted.',
    at:'Whole product', go:'appearance', why:'Arabic became possible in one sweep instead of a parallel stylesheet nobody would maintain.' },

  { g:'Records & data', n:'RFC 7386',             w:'JSON merge-patch for catalogue golden records',     ex:"{ \"price\": { \"amount\": 1300 }, \"notes\": null }", exWhy:"Changes the price and DELETES the notes. Fields you do not mention are untouched — so two parties can edit the same record without overwriting each other.",
    s:'live',
    at:'Catalogue · golden records', go:'catalogue', why:'Two parties can update different fields of the same record without silently overwriting each other.' },
  { g:'Records & data', n:'GS1',                  w:'SKU / GTIN identity on catalogue items',            ex:"08901234567894", exWhy:"A GTIN. The last digit is computed from the other thirteen, so a typo is detectable — and both sides know it is the same product without comparing names.",
    s:'part',
    note:'Codes are carried and matched; check-digit validation is not enforced.',
    at:'Catalogue · product identity', go:'catalogue', why:'⭐ The three-way match only works if both sides agree this is the SAME product. Without a shared identifier, matching is fuzzy string comparison and a dispute has nothing to stand on.' },
  { g:'Records & data', n:'ISO 17442 (LEI)',      w:'Legal Entity Identifier',                           ex:"5493001KJTIIGC8Y1R12", exWhy:"20 characters that identify one legal entity globally. Checkable against GLEIF — which we do not yet do, hence \"partly\".",
    s:'part',
    note:'A field exists to record it; the value is not verified against GLEIF.',
    at:'Trade readiness', go:'readiness', why:'The same company recognised across registers and borders.' },
  { g:'Records & data', n:'ISO 6523',             w:'Organisation identifier SCHEME, so an id says which register it came from', ex:"0195:198912345K", exWhy:"<b>Scheme first.</b> \"198912345K\" alone is meaningless; <code>0195</code> says it is a Singapore UEN. The scheme is the half everyone drops.",
    s:'plan',
    at:'Profile · identity', go:'readiness', why:'"GSTIN 29ABC" means nothing until you know it is a GSTIN. The scheme is the half everyone drops.' },
  { g:'Records & data', n:'UN/LOCODE',            w:'Places, ports and terminals',                       ex:"INMAA", exWhy:"Chennai, India. Five characters, and no argument about whether \"Madras\", \"Chennai Port\" and \"MAA\" are the same place.",
    s:'plan',
    at:'Network · places', go:'network', why:'"Chennai" is a city, a port and three terminals. A shipment needs to know which.' },

  /**
   * ⭐ IAM STANDARDS — added after Athi asked *"can you check any specific standard should be followed as part
   * of this IAM, if so and if it is within our control"*. The last clause is the useful one: several IAM
   * standards exist and most are NOT ours to follow, because they govern federating identity between systems and
   * this platform issues its own credentials. Listing those as "planned" would be padding.
   */
  { g:'Identity & access', n:'ISO/IEC 24760', w:'The IAM vocabulary — identity · identifier · attribute',
    s:'part', note:'We use its distinctions; we do not implement its lifecycle model.',
    ex:'bridge_id = identifier · display_name = attribute · the entity = identity',
    exWhy:'⭐ This is the distinction the IAM page is built on. A Bridge ID is not an identity and a name is not an identifier — conflating them is what made "Identity" the wrong name for a page about five different kinds of party.',
    at:'IAM', go:'identity', why:'Gives us the words for the thing we kept getting wrong: an identifier is not an identity.' },
  { g:'Identity & access', n:'RBAC (ANSI INCITS 359)', w:'Role-based access — coarse, five roles',
    s:'part', note:'The hat IS role-based, but roles are fixed and not composable; there is no permission-to-role assignment.',
    ex:'view_only · act · audit · mis · manager',
    exWhy:'One role per co-assist, enforced on every write since 2026-08-18. Not fine-grained: you cannot grant "may edit catalogue but not send chits".',
    at:'IAM · Co-assists', go:'coassists', why:'⭐ An owner can answer "what can this person do" in one word, which is the whole point of roles over permission lists.' },
  { g:'Identity & access', n:'NIST SP 800-63B', w:'Authentication assurance',
    s:'part', note:'One-time code to a verified channel is roughly AAL2 single-factor; we do not claim an audited level.',
    ex:'ravi@alpha-timers + a one-time code',
    exWhy:'Possession of the channel proves identity. No password to leak, reuse or phish — which is why there is no password reset flow to attack.',
    at:'Sign-in', go:'', why:'States honestly what our sign-in does and does not prove.' },
  /* ⚠️ NOT OURS, and saying so is the point of the question. */
  { g:'Identity & access', n:'SCIM (RFC 7644)', w:'Provisioning identities from an HR system',
    s:'plan', ex:'—',
    exWhy:'Not built. It matters only when a customer wants their HR system to create and remove co-assists automatically — real for a large operator, irrelevant to a shop.',
    at:'Co-assists — where it would provision', go:'coassists',
    why:'Removes the manual add/remove step for a business that already runs an HR system.' },
  { g:'Identity & access', n:'OAuth 2 · OIDC', w:'Federated sign-in',
    s:'plan', ex:'—',
    exWhy:'⚠️ Deliberately not adopted. We ISSUE credentials rather than delegating to an identity provider — a chit is signed by a party we authenticated, and federating that would put a third party between a business and its own record.',
    at:'Sign-in — where it would replace our own', go:'',
    why:'Would let people sign in with an existing account — at the cost of who vouches for the signature on a chit.' },

  { g:'Platform',     n:'RFC 7519 (JWT)',         w:'Session tokens',                                    ex:"eyJhbGciOiJIUzI1NiJ9.…", exWhy:"Three base64 parts: header, claims, signature. Any reviewer can decode the middle one and see exactly what we assert about a session.",
    s:'live',
    at:'Sign-in', go:'', why:'A credential format every reviewer already knows how to audit.' },
  { g:'Platform',     n:'Idempotency-Key',        w:'A mutation runs at most once, even on replay',      ex:"Idempotency-Key: 9f2c…a41", exWhy:"Send the same order twice after a dropped connection and the second is recognised and ignored. Without it, offline replay would be unsafe to offer.",
    s:'live',
    at:'Every mutation · offline replay', go:'', why:'⭐ A retry after a dropped connection cannot double-send an order. Without it, offline queueing would be unsafe to offer at all.' },
  { g:'Platform',     n:'PostgreSQL RLS',         w:'Tenant isolation enforced by the database',         ex:"USING (entity_id = current_setting(...))", exWhy:"The database refuses rows from another tenant even if the query forgets to filter. Isolation that survives a mistake in application code.",
    s:'live',
    note:'FORCE RLS on the entity-data tables; identities is a documented carve-out for cross-tenant discovery.',
    at:'Every entity-scoped read', go:'', why:'Isolation that survives a mistake in application code, because the database refuses rather than trusting the query.' },

  { g:'Commercial',   n:'Incoterms 2020 (ICC)',   w:'Who bears cost and risk, and to what point',        ex:"FOB Chennai (Incoterms 2020)", exWhy:"Risk and cost pass to the buyer once the goods are on board at Chennai. Three words that decide who pays if the container is damaged mid-ocean.",
    s:'part',
    note:'Carried on instruments and forms; not yet enforced against the shipment record.',
    at:'Chits · instruments', go:'', why:'⭐ Who pays freight and where risk passes, agreed in writing BEFORE the dispute rather than argued after it.' },
  { g:'Commercial',   n:'UCP 600 · ISBP 745',     w:'Documentary credits',                               ex:"—", exWhy:"Not built. When it is, it is the ruleset a bank checks the documents against before releasing payment.",
    s:'plan',
    at:'Instruments', go:'', why:'The rules a bank will actually check the documents against.' },
  { g:'Commercial',   n:'HS codes (WCO)',         w:'Tariff classification on goods',                    ex:"0904.11", exWhy:"<b>Pepper, whole.</b> Customs charges duty on THIS, not on your product name — so a seller who states it decides the tariff instead of discovering it at the border.",
    s:'plan',
    at:'Catalogue · goods', go:'catalogue', why:'What customs charges, decided by the seller rather than discovered at the border.' },
  { g:'Commercial',   n:'ISO 20022',              w:'Financial messaging',                               ex:"—", exWhy:"Not built. It is the payment message a bank consumes without a bespoke file per customer.",
    s:'plan',
    at:'Settlement', go:'', why:'Payment instructions a bank can consume without a bespoke file.' }
];

/**
 * ⭐⭐ WHY FOLLOW STANDARDS AT ALL — the argument, with its costs.
 *
 * Athi, 2026-08-18: *"I guess we have not spoken about what is the use of following the standards. pain vs
 * pleasure… can you think a bit."*
 *
 * ⚠️ THE ANSWER IS NOT "QUALITY" OR "COMPLIANCE". For this product it is structural. A chit CROSSES A BOUNDARY:
 * it leaves one company and lands in another that shares no system with it. Every convention we invent is one
 * the other side must be taught; every standard we adopt arrives already legible. Standards are not hygiene
 * around the rail — they are what makes a rail possible without an integration project per counterparty.
 */
var STD_WHY = {
  pleasure: [
    ['No integration project per counterparty',
     'A record in ISO 8601, ISO 4217 and GS1 lands in someone else\'s ERP already meaning what it says. A record in our own formats needs a mapping written for every partner — which is the cost that kills small platforms.'],
    ['A standard turns an argument into a fact',
     'This is the one that matters most for disputes. "When did this happen" was three different answers until every timestamp carried its zone. "Is this the same product" is unanswerable without a shared identifier. Standards are how evidence stops being contestable.'],
    ['Your data outlives us',
     'A record only this platform can read is a record you do not own. Standard formats mean you can leave — and being able to leave is the reason it is safe to start.'],
    ['Trust without a track record',
     '⭐ We are small and new. We cannot point at twenty years of customers. We CAN say exactly which standards we implement, which ones only partly, and what is missing from each — and that is a claim a buyer can check for themselves in an afternoon.']
  ],
  pain: [
    ['Slower to build',
     'Every feature begins by reading a specification instead of inventing something that would work by Friday.'],
    ['Standards are bigger than the need',
     'BCP 47 admits thousands of tags we will never use; CLDR ships data for languages we do not offer. Adopting one means accepting its whole shape, not the convenient corner.'],
    ['They move',
     'CLDR changes twice a year, Incoterms roughly every decade, and a weekend can change by decree — the UAE\'s did in 2022. Following a standard is a subscription, not a purchase.'],
    ['⚠️ They create an obligation to be honest',
     'The real cost, and the one worth paying. Once we say "WCAG AA", a failing contrast stops being a bug and becomes a broken promise. That is exactly why every row above carries a status and every partial one says what is missing.']
  ],
  /* ⚠️ EVIDENCE FROM THIS CODEBASE, not assertions. Each of these was found BY adopting the standard, and none
     of them would have been found by careful work alone — which is the honest case for the practice. */
  proof: [
    'The contrast tool found <b>' + tx('117 real failures') + '</b> in themes that had already shipped — including body text at 2.57:1 in the smallest font on screen. Nobody had caught them by eye, across months.',
    'CLDR said the <b>' + tx('UAE weekend changed to Sat–Sun in 2022') + '</b>. Four places in our own code and comments said Fri+Sat, including the label on a passing test.',
    '<b>Intl proved a region cannot carry one direction</b> — the UAE needs English (LTR) beside Arabic (RTL). The design assumed it could; the standard\'s data disproved it before a user met it.',
    'The gettext extractor showed <b>1,122 of our strings are sentence fragments</b> that cannot be translated at all. Wrapping them would have produced confident nonsense in three languages.'
  ]
};

/**
 * ⚠️ A LINK THAT ACTUALLY GOES SOMEWHERE. Settings sections and top-level screens are reached differently —
 * one sets UI.setSec, the other navigates — so this resolves which kind the target is rather than making every
 * row know. A "used in Catalogue" that did not open the catalogue would be worse than no link at all.
 */
var STD_SETTINGS_SECS = { locale:1, appearance:1, governance:1, standards:1 };
function stdGoto(key){
  if (!key) return;
  if (STD_SETTINGS_SECS[key]) { setSetSec(key); return; }
  if (typeof navTo === 'function') navTo(key);
}



/**
 * ⭐⭐ ONE RECORD, EVERY STANDARD VISIBLE IN IT — the answer to "so people can visualise".
 *
 * Athi, 2026-08-18: *"is there any way we can show some sample record and how that will behave… so people can
 * visualise."*
 *
 * ⚠️ A LIST OF STANDARDS IS ABSTRACT; A RECORD IS NOT. Twenty-six rows saying "we follow X" asks a reader to
 * assemble the picture themselves. One chit — pepper leaving Chennai for Dubai — with every standard-bearing
 * field labelled shows the same information as a thing they could receive, forward to their own IT person, and
 * argue with.
 *
 * ⚠️⚠️ AND IT IS HONEST ABOUT WHAT IS NOT THERE YET. Fields carrying a PLANNED standard are shown greyed and
 * marked, not quietly omitted and not quietly included. A sample record that showed ISO 6523 working today —
 * when it is only decided — would be the exact overclaim the status column exists to prevent, dressed up as a
 * demonstration. A reader who spots one invented field stops believing the other twenty-five.
 */
var STD_RECORD = [
  { k:'chit_id',    v:'"8f3a1c94-…"',                          std:'',                    s:'live', c:'Our own id. Every OTHER field below is somebody else\'s standard.' },
  { k:'sealed_at',  v:'"2026-08-18T14:32:05Z"',                std:'ISO 8601',            s:'live', c:'Unambiguous instant. "18/08/2026" would be a different day in New York.' },
  { k:'zone',       v:'"Asia/Kolkata"',                        std:'IANA tz',             s:'live', c:'The zone, not the offset — an offset is wrong twice a year.' },
  { k:'seller.id',  v:'"0195:198912345K"',                     std:'ISO 6523',            s:'plan', c:'Scheme first. Today we store the number without saying which register it came from.' },
  { k:'seller.lei', v:'"5493001KJTIIGC8Y1R12"',                std:'ISO 17442',           s:'part', c:'We hold it; we do not yet check it against GLEIF.' },
  { k:'buyer.locale', v:'"ar-AE"',                             std:'BCP 47',              s:'live', c:'How the buyer reads figures. It does NOT change what the seller wrote.' },
  { k:'terms',      v:'"FOB INMAA (Incoterms 2020)"',          std:'Incoterms · UN/LOCODE', s:'part', c:'Carried on the record. We do not yet check the shipment against it, and UN/LOCODE is not validated.' },
  { k:'line.gtin',  v:'"08901234567894"',                      std:'GS1',                 s:'part', c:'Both sides know it is the same product. Check digit not enforced yet.' },
  { k:'line.hs_code', v:'"0904.11"',                           std:'HS (WCO)',            s:'plan', c:'Pepper, whole. Customs charges on THIS, not on the product name.' },
  { k:'line.name',  v:'"Black pepper, whole"',                 std:'— never translated —', s:'live', c:'⚠️ The author\'s words, in the author\'s language. A chit is a shared record; one that read differently to each party would not be a record.' },
  { k:'line.price', v:'{ "amount": 1250.00, "currency": "AED" }', std:'ISO 4217',          s:'live', c:'A pair, never the string "AED 1250". And never converted — converting invents a rate nobody agreed.' },
  { k:'_headers',   v:'Idempotency-Key: 9f2c…a41',             std:'Idempotency-Key',     s:'live', c:'Send it twice after a dropped connection; the second is recognised and ignored.' }
];

/**
 * Render the worked record. `compact` drops the per-field commentary for the Legend, where it is scanned
 * rather than studied — same record, same fields, same honesty markers.
 */
function stdRecordHTML(opts){
  var o = opts || {};
  var compact = !!o.compact;
  var BADGE = { live:['var(--ok-tint)','var(--ok-2)','in force'], part:['var(--warn-tint)','var(--warn-2)','partly'], plan:['var(--neutral-tint)','var(--grey)','planned'] };
  var rows = STD_RECORD.map(function(f){
    var b = BADGE[f.s] || BADGE.plan;
    /* ⚠️ A PLANNED FIELD IS DIMMED, NOT HIDDEN. Hiding it would make the record look complete; showing it at
       full strength would claim something untrue. Dimmed-and-labelled is the only honest third option. */
    var dim = f.s === 'plan';
    return '<div style="padding:5px 0;border-block-start:1px solid var(--line);opacity:' + (dim ? '.62' : '1') + '">'
      + '<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-family:' + "'Space Mono'" + ',ui-monospace,monospace;font-size:var(--fs-1)">'
      +   '<span style="color:var(--blue-2);min-width:96px">' + esc(f.k) + '</span>'
      +   '<span style="color:var(--on-card);word-break:break-all;flex:1;min-width:0">' + esc(f.v) + '</span>'
      + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:3px">'
      /* ⚠️ NOT 9px. Sub-11px text is hard for anyone and unusable for some of the readers this register is
         partly about — and being small on the ACCESSIBILITY page is the worst place to be inconsistent. --fs-1 is
         the smallest size the type scale admits, and it moves with the reader's text-size setting. */
      +   (f.std ? '<span style="font-size:var(--fs-1);font-weight:800;letter-spacing:.04em;text-transform:uppercase;background:' + b[0] + ';color:' + b[1] + ';border-radius:4px;padding:1px 6px">' + esc(f.std) + ' · ' + b[2] + '</span>' : '')
      + '</div>'
      + (compact || !f.c ? '' : '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px;line-height:1.5">' + f.c + '</div>')
      + '</div>';
  }).join('');

  return '<div style="border:1px solid var(--line);border-radius:9px;padding:10px 12px;margin-bottom:9px">'
    + '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:4px">' + tx('One chit, every standard in it') + '</div>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.55;margin-bottom:6px">'
    +   '500 kg of pepper leaving Chennai for Dubai. Each field carries somebody else\'s standard, so the record '
    +   'arrives already legible to a system that has never heard of us. <b>' + tx('Greyed fields are not built yet') + '</b> — '
    +   'shown rather than omitted, because a demonstration that quietly includes what we have not done is worse '
    +   'than the list it was meant to make concrete.'
    + '</div>'
    + rows
    + '</div>';
}

/**
 * ⭐ THE ARGUMENT, RENDERED ONCE FOR BOTH SURFACES.
 *
 * ⚠️ TWO DENSITIES, NOT TWO TEXTS. `compact` drops the per-item detail lines and keeps the headings — the
 * Legend is read standing up, in a lightbox, by someone forming a first impression; Settings is read by someone
 * checking a claim. Writing a shorter SECOND version for the Legend is how the two would end up saying subtly
 * different things about the same commitment.
 */
function stdWhyHTML(opts){
  var o = opts || {};
  var compact = !!o.compact;
  var card = function(inner, tint){
    return '<div style="border:1px solid var(--line);border-radius:9px;padding:10px 12px;margin-bottom:9px'
      + (tint ? ';background:' + tint : '') + '">' + inner + '</div>';
  };
  var head = function(t, ink){
    return '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:'
      + (ink || 'var(--grey)') + ';margin-bottom:6px">' + t + '</div>';
  };
  var col = function(title, items, ink){
    return card(head(title, ink) + items.map(function(x){
      return '<div style="padding:' + (compact ? '4px' : '6px') + ' 0;border-block-start:1px solid var(--line)">'
        + '<b style="font-size:var(--fs-2);color:var(--on-card)">' + x[0] + '</b>'
        + (compact ? '' : '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px;line-height:1.55">' + x[1] + '</div>')
        + '</div>';
    }).join(''));
  };

  return card('<div style="font-size:var(--fs-2);line-height:1.65;color:var(--on-card)">'
      + '<b>A chit crosses a boundary.</b> It leaves one company and lands in another that shares no system with '
      + 'it. Every convention we invent is one the other side has to be taught; every standard we adopt arrives '
      + 'already legible.'
      + '<div style="margin-top:8px;color:var(--grey)">So this is not hygiene around the rail — it is what makes '
      + 'a rail possible <b>without an integration project per counterparty</b>.</div></div>')
    + col('What it buys', STD_WHY.pleasure, 'var(--ok-2)')
    + col('What it costs', STD_WHY.pain, 'var(--warn-2)')
    /* ⚠️ EVIDENCE FROM THIS CODEBASE, never assertions — each found BY adopting the standard, and none of them
       findable by careful work alone. In the Legend this is the part that does the persuading, so it survives
       the compact mode intact while the columns above lose their detail lines. */
    + card(head('What it has actually caught here')
      + '<div data-testid="std-proof">' + STD_WHY.proof.map(function(x){
          return '<div style="font-size:var(--fs-2);color:var(--on-card);line-height:1.6;padding:6px 0;border-block-start:1px solid var(--line)">• ' + x + '</div>';
        }).join('') + '</div>');
}

/** A one-line count for surfaces that only have room for the shape of it. */
function stdCounts(){
  var n = { live:0, part:0, plan:0 };
  STANDARDS.forEach(function(x){ n[x.s]++; });
  return n;
}
