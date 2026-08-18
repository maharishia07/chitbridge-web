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
  { g:'Localisation', n:'BCP 47 (RFC 5646)',      w:'Language tags — en-IN, ar-AE, ta',                 s:'live',
    at:'Localisation', go:'locale', why:'A language tag nobody else parses means every counterparty re-guesses what "Tamil" meant.' },
  { g:'Localisation', n:'UTS #35 · CLDR',         w:'Locale data and the -u- extensions (nu·hc·ca·fw)',  s:'live',
    at:'Localisation', go:'locale', why:'Lakh vs million, month names, which days are the weekend — facts about 200 countries we would otherwise guess. CLDR told us the UAE weekend changed in 2022 when our own comments said otherwise.' },
  { g:'Localisation', n:'RFC 4647',               w:'Language priority list and matching',               s:'live',
    at:'Localisation', go:'locale', why:'Decides which authored version of a catalogue a buyer is shown — without translating anything.' },
  { g:'Localisation', n:'ECMA-402 (Intl)',        w:'Number, money, date, collation, direction',         s:'live',
    at:'Every screen with a figure on it', go:'locale', why:'Sorting a Tamil supplier list by UTF-16 code units is byte order wearing alphabetical clothes.' },
  { g:'Localisation', n:'IANA tz database',       w:'Time zones — via the engine, not a kept table',     s:'live',
    at:'Every timestamp on every chit', go:'locale', why:'⭐ Turns "when did this happen" from an argument into a fact. One instant read 19:00, 20:30 and 16:00 to three parties before this.' },
  { g:'Localisation', n:'ISO 4217',               w:'Currency codes on every price',                     s:'live',
    at:'Catalogue · prices', go:'catalogue', why:'A price without a stated currency is a number, not an amount — and the party who assumes wrong pays the difference.' },
  { g:'Localisation', n:'ISO 8601',               w:'Timestamps in storage and transport',               s:'part',
    note:'Display follows the reader\'s locale by design, which is not ISO form.',
    at:'Chit records · exports', go:'locale', why:'An unambiguous instant on the record, whatever the reader sees.' },
  { g:'Localisation', n:'GNU gettext',            w:'String catalogue — the English is the key',         s:'part',
    note:'Primitive and a 449-entry catalogue exist; the call sites are not wrapped yet.',
    at:'Localisation · language', go:'locale', why:'A translator can be handed a file instead of a codebase.' },

  { g:'Accessibility', n:'WCAG 2.2 — 1.4.3 / 1.4.6', w:'Text contrast, measured not asserted',           s:'live',
    note:'455 computed checks across 15 themes, 0 failures.',
    at:'Appearance · themes', go:'appearance', why:'⭐ It found 117 real contrast failures in themes that had shipped and that nobody had caught by eye — including body text at 2.57:1 in the smallest font.' },
  { g:'Accessibility', n:'WCAG 2.2 — 1.4.4',      w:'Resize text to 132% without loss of function',      s:'live',
    at:'Appearance · text size', go:'appearance', why:'Someone can keep using the product as their eyes change, instead of leaving it.' },
  { g:'Accessibility', n:'WCAG 2.2 — 2.3.3',      w:'Animation from interactions can be turned off',     s:'live',
    at:'Appearance · motion', go:'appearance', why:'Movement triggers migraine and vertigo. Honouring the OS setting means nobody has to ask us separately.' },
  { g:'Accessibility', n:'WCAG 2.2 — full audit', w:'Keyboard, focus order, names and roles',            s:'part',
    note:'Keymap and focus states exist; no independent audit has been run.',
    at:'Whole product', go:'appearance', why:'The part we cannot honestly claim yet — which is why it says so.' },
  { g:'Accessibility', n:'Okabe–Ito',             w:'Colour-universal palette for colour blindness',     s:'live',
    at:'Appearance · Colour Vision theme', go:'appearance', why:'Ends the argument about which colours to use — a published palette proven distinguishable under every type of colour blindness.' },
  { g:'Accessibility', n:'CSS Logical Properties', w:'Right-to-left layout without a second stylesheet', s:'live',
    note:'378 physical properties converted.',
    at:'Whole product', go:'appearance', why:'Arabic became possible in one sweep instead of a parallel stylesheet nobody would maintain.' },

  { g:'Records & data', n:'RFC 7386',             w:'JSON merge-patch for catalogue golden records',     s:'live',
    at:'Catalogue · golden records', go:'catalogue', why:'Two parties can update different fields of the same record without silently overwriting each other.' },
  { g:'Records & data', n:'GS1',                  w:'SKU / GTIN identity on catalogue items',            s:'part',
    note:'Codes are carried and matched; check-digit validation is not enforced.',
    at:'Catalogue · product identity', go:'catalogue', why:'⭐ The three-way match only works if both sides agree this is the SAME product. Without a shared identifier, matching is fuzzy string comparison and a dispute has nothing to stand on.' },
  { g:'Records & data', n:'ISO 17442 (LEI)',      w:'Legal Entity Identifier',                           s:'part',
    note:'A field exists to record it; the value is not verified against GLEIF.',
    at:'Trade readiness', go:'readiness', why:'The same company recognised across registers and borders.' },
  { g:'Records & data', n:'ISO 6523',             w:'Organisation identifier SCHEME, so an id says which register it came from', s:'plan',
    at:'Profile · identity', go:'readiness', why:'"GSTIN 29ABC" means nothing until you know it is a GSTIN. The scheme is the half everyone drops.' },
  { g:'Records & data', n:'UN/LOCODE',            w:'Places, ports and terminals',                       s:'plan',
    at:'Network · places', go:'network', why:'"Chennai" is a city, a port and three terminals. A shipment needs to know which.' },

  { g:'Platform',     n:'RFC 7519 (JWT)',         w:'Session tokens',                                    s:'live',
    at:'Sign-in', go:'', why:'A credential format every reviewer already knows how to audit.' },
  { g:'Platform',     n:'Idempotency-Key',        w:'A mutation runs at most once, even on replay',      s:'live',
    at:'Every mutation · offline replay', go:'', why:'⭐ A retry after a dropped connection cannot double-send an order. Without it, offline queueing would be unsafe to offer at all.' },
  { g:'Platform',     n:'PostgreSQL RLS',         w:'Tenant isolation enforced by the database',         s:'live',
    note:'FORCE RLS on the entity-data tables; identities is a documented carve-out for cross-tenant discovery.',
    at:'Every entity-scoped read', go:'', why:'Isolation that survives a mistake in application code, because the database refuses rather than trusting the query.' },

  { g:'Commercial',   n:'Incoterms 2020 (ICC)',   w:'Who bears cost and risk, and to what point',        s:'part',
    note:'Carried on instruments and forms; not yet enforced against the shipment record.',
    at:'Chits · instruments', go:'', why:'⭐ Who pays freight and where risk passes, agreed in writing BEFORE the dispute rather than argued after it.' },
  { g:'Commercial',   n:'UCP 600 · ISBP 745',     w:'Documentary credits',                               s:'plan',
    at:'Instruments', go:'', why:'The rules a bank will actually check the documents against.' },
  { g:'Commercial',   n:'HS codes (WCO)',         w:'Tariff classification on goods',                    s:'plan',
    at:'Catalogue · goods', go:'catalogue', why:'What customs charges, decided by the seller rather than discovered at the border.' },
  { g:'Commercial',   n:'ISO 20022',              w:'Financial messaging',                               s:'plan',
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
    'The contrast tool found <b>117 real failures</b> in themes that had already shipped — including body text at 2.57:1 in the smallest font on screen. Nobody had caught them by eye, across months.',
    'CLDR said the <b>UAE weekend changed to Sat–Sun in 2022</b>. Four places in our own code and comments said Fri+Sat, including the label on a passing test.',
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
