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
 *
 * ⭐ A THIRD READER (2026-10-03): /standards.html — the Standards page (docs/design/standards-page) — and the Standards door on
 * the index page read the SAME rows; Settings › Standards no longer lists them. The page paints; it keeps no copy.
 *
 * ⭐ THE FIELDS OF A ROW (one dictionary, here — each: what · source or derived · who writes it · who reads it):
 *   g n w ex exWhy s note at go why  — the register's own words, unchanged (written by hand, here; read by Settings, the Legend, the page)
 *   a      area of the business, one of STD_AREAS (judgement; here; the page's matrix and its Area filter)
 *   k      kind: law (you must) · std (agreed worldwide) · prac (the common way), one of STD_KINDS (here; the page)
 *   c      applies in: ISO 3166 codes and GLOBAL, one of STD_COUNTRIES — a new country is a new code here and a new matrix row, nothing else
 *   p      the plain-words line a shopkeeper reads first (here; the page's first column)
 *   m      what is missing, short — REQUIRED on every Partly and Planned row (e2e/standards-page.cjs asserts it); the long `note` stays for the opened row
 *   limit  a stated limit on an In force row, e.g. "company format only" (optional; the page shows it as Limit:)
 *   eq     the equivalent abroad, so a buyer outside India reads an Indian law in their own terms (optional; the opened row)
 *   added  the date a row joined the register, set only on rows added after the first 44 (the opened row says "New")
 */
var STANDARDS = [
  { a:'build', k:'std', c:['GLOBAL'],
    p:"Every test run is written up on a template an auditor already knows",
    m:"Judgement sections need a person; no test plan yet",
    g:'Verification', n:'ISO/IEC/IEEE 29119-3', w:'Test completion report — the template a run is written up on',
    ex:"6 · Test completion evaluation", exWhy:"The clause that asks whether the exit criteria were MET. We render the numbers under it and say plainly that the judgement is not ours to generate — a report that fills this heading with plausible prose looks signed off and is not.",
    s:'part',
    note:'The measured sections are generated from the ledger; the judgement sections (deviations, completion evaluation, residual risks, lessons, approval) are marked “needs a person” and carry the question instead of an answer. No test PLAN is declared anywhere yet, so section 5 has nothing to compare against.',
    at:'Testing › Report', go:'testing', why:'⭐ It SUPERSEDED IEEE 829 in 2013 — which is the name most people still reach for, and using the withdrawn one would have looked more familiar to more readers and been wrong. A completion report on a known template is one an auditor, a customer or a new engineer can read without being taught our format.' },
  { a:'build', k:'prac', c:['GLOBAL'],
    p:"Test results any tool can read, not locked in one screen",
    g:'Verification', n:'JUnit XML', w:'Test result interchange — what every CI writes and every tool reads',
    ex:"<testcase name=\"[CTR-05] a single click chooses\"/>", exWhy:"Playwright emits this with one config line; Kiwi TCMS, TestRail, Allure and ReportPortal all import it. The case key in brackets is what joins a run to our board.",
    s:'live',
    at:'POST /api/testing/results/junit', go:'testing', why:'A private results format would strand every automated run inside one screen, and would have to be re-implemented by anything that ever wanted to read it.' },
  { a:'build', k:'prac', c:['GLOBAL'],
    p:"Each rule and its test are written as one text",
    m:"The format is adopted; its runner deliberately is not",
    g:'Verification', n:'Gherkin', w:'The spec and the test as one text — Given / When / Then',
    ex:"Given Counter open on Sell", exWhy:"Our case shape already WAS Given/When/Then (pre / step / expected), so nothing is translated — the file is rendered and read back, and all 110 real cases round-trip unchanged.",
    s:'part',
    note:'The FORMAT is adopted; Cucumber the RUNNER is deliberately not — every “When I click the row” would need a step definition, a second codebase mapping sentences onto clicks.',
    at:'Testing — export/import .feature', go:'testing', why:'A .feature file carries the spec clause (the Feature description) and the cases against it in one text, so neither can be edited without the other in front of you.' },
  { a:'look', k:'std', c:['GLOBAL'],
    p:"Your language is named the way every system names it",
    g:'Localisation', n:'BCP 47 (RFC 5646)',      w:'Language tags — en-IN, ar-AE, ta',                 ex:"ta-IN", exWhy:"A browser sends exactly this as <code>Accept-Language</code>. Any system on earth reads it as \"Tamil, as written in India\" — no lookup table, no mapping file.",
    s:'live',
    at:'Localisation', go:'locale', why:'A language tag nobody else parses means every counterparty re-guesses what "Tamil" meant.' },
  { a:'look', k:'std', c:['GLOBAL'],
    p:"Lakh or million, month names, weekends — right for each country",
    g:'Localisation', n:'UTS #35 · CLDR',         w:'Locale data and the -u- extensions (nu·hc·ca·fw)',  ex:"en-IN-u-nu-latn-hc-h23", exWhy:"One tag carrying four decisions: English, Indian grouping, Western digits, 24-hour clock. Hand it to <code>Intl</code> anywhere and you get the same answer.",
    s:'live',
    at:'Localisation', go:'locale', why:'Lakh vs million, month names, which days are the weekend — facts about 200 countries we would otherwise guess. CLDR told us the UAE weekend changed in 2022 when our own comments said otherwise.' },
  { a:'look', k:'std', c:['GLOBAL'],
    p:"A buyer sees the catalogue in the language its author wrote",
    g:'Localisation', n:'RFC 4647',               w:'Language priority list and matching',               ex:"ta, en, hi", exWhy:"Your priority list. A catalogue written in <b>en</b> and <b>hi</b> shows you the <b>en</b> one — the version its author wrote, chosen not translated.",
    s:'live',
    at:'Localisation', go:'locale', why:'Decides which authored version of a catalogue a buyer is shown — without translating anything.' },
  { a:'look', k:'std', c:['GLOBAL'],
    p:"Numbers, money and dates shown the way your reader writes them",
    g:'Localisation', n:'ECMA-402 (Intl)',        w:'Number, money, date, collation, direction',         ex:"12,34,56,789.50", exWhy:"The same number is <b>123,456,789.50</b> to a US reader and <b>123.456.789,50</b> in Germany. Nobody stores three versions; the tag decides at render.",
    s:'live',
    at:'Every screen with a figure on it', go:'locale', why:'Sorting a Tamil supplier list by UTF-16 code units is byte order wearing alphabetical clothes.' },
  { a:'books', k:'std', c:['GLOBAL'],
    p:"Every time carries its zone, so “when” is a fact, not an argument",
    g:'Localisation', n:'IANA tz database',       w:'Time zones — via the engine, not a kept table',     ex:"Asia/Dubai", exWhy:"Not <code>+04:00</code>. An offset is wrong twice a year in half the world; a ZONE stays correct because the rules travel with the name.",
    s:'live',
    at:'Every timestamp on every chit', go:'locale', why:'⭐ Turns "when did this happen" from an argument into a fact. One instant read 19:00, 20:30 and 16:00 to three parties before this.' },
  { a:'sell', k:'std', c:['GLOBAL'],
    p:"Every price says its currency, so nobody guesses",
    g:'Localisation', n:'ISO 4217',               w:'Currency codes on every price',                     ex:"{ amount: 1250.00, currency: \"AED\" }", exWhy:"A price is a pair, never the string \"AED 1250\". Your ERP reads the currency field; it does not parse a symbol out of a label.",
    s:'live',
    at:'Catalogue · prices', go:'catalogue', why:'A price without a stated currency is a number, not an amount — and the party who assumes wrong pays the difference.' },
  { a:'books', k:'std', c:['GLOBAL'],
    p:"Every saved time is one exact, unambiguous instant",
    limit:"storage and transport; screens show your locale",
    g:'Localisation', n:'ISO 8601',               w:'Timestamps in storage and transport',               ex:"2026-08-18T14:32:05Z", exWhy:"Unambiguous everywhere. \"18/08/2026\" is the 18th of August in Mumbai and invalid in New York — and \"08/09\" is two different days.",
    s:'live',
    at:'Chit records · exports · pack · JUnit', go:'locale', why:'An unambiguous instant on the record, whatever the reader sees.' },
  { a:'look', k:'prac', c:['GLOBAL'],
    p:"The app can be translated from one file",
    m:"449 strings catalogued; the screens are not wired yet",
    g:'Localisation', n:'GNU gettext',            w:'String catalogue — the English is the key',         ex:"msgid \"Save\"", exWhy:"The English IS the key, so an untranslated label shows correct English rather than a leaked <code>btn.save.label</code>.",
    s:'part',
    note:'Primitive and a 449-entry catalogue exist; the call sites are not wrapped yet.',
    at:'Localisation · language', go:'locale', why:'A translator can be handed a file instead of a codebase.' },

  { a:'look', k:'std', c:['GLOBAL'],
    p:"Text is readable in every theme — measured, not guessed",
    g:'Accessibility', n:'WCAG 2.2 — 1.4.3 / 1.4.6', w:'Text contrast, measured not asserted',           ex:"#494F56 on #FFFFFF = 8.11:1", exWhy:"A number, not an opinion. Anyone can recompute it from the two hex values and check our claim in a minute.",
    s:'live',
    note:"All 16 themes are checked by the theme-contrast test (WCAG 2.x AA), 0 failures.",
    at:'Appearance · themes', go:'appearance', why:'⭐ It found 117 real contrast failures in themes that had shipped and that nobody had caught by eye — including body text at 2.57:1 in the smallest font.' },
  { a:'look', k:'std', c:['GLOBAL'],
    p:"Text can grow to 132% and nothing breaks",
    g:'Accessibility', n:'WCAG 2.2 — 1.4.4',      w:'Resize text to 132% without loss of function',      ex:"--fs-3: 14px → 18.5px", exWhy:"The whole scale multiplies, so a heading stays bigger than a caption at 132%.",
    s:'live',
    at:'Appearance · text size', go:'appearance', why:'Someone can keep using the product as their eyes change, instead of leaving it.' },
  { a:'look', k:'std', c:['GLOBAL'],
    p:"Animation can be switched off for those it bothers",
    g:'Accessibility', n:'WCAG 2.2 — 2.3.3',      w:'Animation from interactions can be turned off',     ex:"prefers-reduced-motion: reduce", exWhy:"Set once in Windows or iOS; every well-behaved site honours it. You never tell us separately.",
    s:'live',
    at:'Appearance · motion', go:'appearance', why:'Movement triggers migraine and vertigo. Honouring the OS setting means nobody has to ask us separately.' },
  { a:'look', k:'std', c:['GLOBAL'],
    p:"Usable by keyboard and screen reader",
    m:"No independent audit has been run",
    g:'Accessibility', n:'WCAG 2.2 — full audit', w:'Keyboard, focus order, names and roles',            ex:"—", exWhy:"Nothing to show here yet, and that is the point of the status: no independent audit has been run.",
    s:'part',
    note:'Keymap and focus states exist; no independent audit has been run.',
    at:'Whole product', go:'appearance', why:'The part we cannot honestly claim yet — which is why it says so.' },
  { a:'look', k:'prac', c:['GLOBAL'],
    p:"Colours a colour-blind reader can still tell apart",
    g:'Accessibility', n:'Okabe–Ito',             w:'Colour-universal palette for colour blindness',     ex:"#0072B2 blue · #D55E00 vermillion", exWhy:"A published pair that stays distinguishable under deuteranopia, protanopia and tritanopia — unlike the green/red pair everyone reaches for.",
    s:'live',
    at:'Appearance · Colour Vision theme', go:'appearance', why:'Ends the argument about which colours to use — a published palette proven distinguishable under every type of colour blindness.' },
  { a:'look', k:'std', c:['GLOBAL'],
    p:"Right-to-left languages such as Arabic lay out correctly",
    g:'Accessibility', n:'CSS Logical Properties', w:'Right-to-left layout without a second stylesheet', ex:"margin-inline-start: 12px", exWhy:"Mirrors automatically in Arabic. <code>margin-left</code> would have needed a second stylesheet nobody maintains.",
    s:'live',
    note:'378 physical properties converted.',
    at:'Whole product', go:'appearance', why:'Arabic became possible in one sweep instead of a parallel stylesheet nobody would maintain.' },

  { a:'build', k:'std', c:['GLOBAL'],
    p:"Product changes from many sources merge cleanly",
    g:'Records & data', n:'RFC 7386',             w:'JSON merge-patch for catalogue golden records',     ex:"{ \"price\": { \"amount\": 1300 }, \"notes\": null }", exWhy:"Changes the price and DELETES the notes. Fields you do not mention are untouched — so two parties can edit the same record without overwriting each other.",
    s:'live',
    at:'Catalogue · golden records', go:'catalogue', why:'Two parties can update different fields of the same record without silently overwriting each other.' },
  { a:'sell', k:'std', c:['GLOBAL'],
    p:"A barcode number means the same product to both sides",
    m:"Check digit not enforced yet",
    g:'Records & data', n:'GS1',                  w:'SKU / GTIN identity on catalogue items',            ex:"08901234567894", exWhy:"A GTIN. The last digit is computed from the other thirteen, so a typo is detectable — and both sides know it is the same product without comparing names.",
    s:'part',
    note:'Codes are carried and matched; check-digit validation is not enforced.',
    at:'Catalogue · product identity', go:'catalogue', why:'⭐ The three-way match only works if both sides agree this is the SAME product. Without a shared identifier, matching is fuzzy string comparison and a dispute has nothing to stand on.' },
  /**
   * ⭐⭐ THE CATALOGUE DISCIPLINES, REGISTERED RATHER THAN RESTATED (Athi, 2026-08-22: *"how do we cover the
   * standards so it is not lost and informative"*).
   *
   * ⚠️ PIM · MDM · GDSN were named only in a catalogue modal, as a sentence. RFC 7386 and GS1 were in BOTH —
   * this register and that sentence — which is a second source of truth, and the exact shape that produced
   * three bugs this week. A standard belongs in one place, with what it is, an example, and why we care.
   *
   * ⚠️ These three are DISCIPLINES, not wire formats: nobody sends you a "PIM". Their status says so, so the
   * register does not claim conformance to something that has no conformance test.
   */
  { a:'sell', k:'prac', c:['GLOBAL'],
    p:"Product details kept in one place; every channel reads it",
    g:'Records & data', n:'PIM (discipline)',     w:'One place holds product information; every channel reads it', ex:"name · unit · price · images · codes", exWhy:"The fields a buyer sees, held once instead of per storefront.",
    s:'live',
    note:'A practice, not a wire format — there is nothing to conform to.',
    at:'Catalogue', go:'catalogue', why:'A price edited in one place and stale in three others is how two parties end up quoting different numbers for the same item.' },
  { a:'sell', k:'prac', c:['GLOBAL'],
    p:"One true record per product, however many lists describe it",
    g:'Records & data', n:'MDM · golden record',  w:'One authoritative record per real product, however many sources describe it', ex:"blueprint + ERP + CSV + capture → 1 item", exWhy:"Four sources, one item, keyed by SKU.",
    s:'live',
    note:'A practice, not a wire format. The merge itself is RFC 7386 (above).',
    at:'Catalogue · golden records', go:'catalogue', why:'Without it, importing the same list twice gives you two of every product and no way to tell which one a chit cited.' },
  { a:'sell', k:'std', c:['GLOBAL'],
    p:"Your invoice can be read by systems abroad",
    m:"Mapped field for field; not produced yet",
    g:'Records & data', n:'UBL 2.1 · PEPPOL BIS Billing 3.0 (invoice abroad)', w:'The world\'s invoice document: our frozen invoice block (the GST e-invoice schema) maps to it field for field', ex:"AssVal → TaxExclusiveAmount · Unit KGS → unitCode KGM · the offer → AllowanceCharge", exWhy:"A buyer outside GST receives the same frozen numbers in the document their system already reads; nothing is recomputed on the way out.",
    s:'plan',
    note:'Mapped (C:\\dev\\catalogue\\UBL-MAPPING-2026-09-05.md), not rendered. Missing: an EndpointID per party (ISO 6523 scheme + id), a seller invoice series per GSTIN/VAT id, the tax-category table per scheme (S/Z/E/AE). Built when a counterparty outside GST asks.',
    at:'Chit · Invoice tab', go:'task', why:'One frozen invoice, two dialects: INV-01 for the GST portal, UBL for everyone else — the numbers never differ.' },
  { a:'sell', k:'law', c:['IN', 'GLOBAL'],
    p:"Units printed the way GST and the world both expect",
    g:'Records & data', n:'GST UQC + UN/ECE Rec 20 (units)', w:'One unit, three names: ours · the Rec 20 code the world uses · the GST Unit Quantity Code an Indian invoice prints', ex:"kg → KGM → KGS · bag → BG → BAG", exWhy:"The connector maps a Tally unit to ours by the code, not the spelling; the invoice and GSTR carry the UQC.",
    s:'live',
    note:'app/units.js (vendored from the API): 22 units with Rec 20 and UQC codes and their common spellings; unknown spellings are never guessed. ⚠️ This row said "live" for months while lib/tax-lines.js filed the seller\'s own word ("packet") into a GSTR HSN row as the code — the register was ahead of the code. Wired 2026-09-10: tax-lines maps through lib/units and anything unmappable stays OTH, which the portal accepts.',
    at:'Catalogue setup · Columns · Units', go:'catsetup', why:'A unit named three ways across two systems is three units until someone maps them; the code is what makes it one.' },
  /**
   * ⭐ PAYMENT IS NOT MONEY. ISO 4217 says what a figure IS; these say how a shop gets PAID, and there is no single
   * answer — which is the whole point of declaring them separately.
   */
  { a:'money', k:'std', c:['GLOBAL'],
    p:"One QR format payment apps worldwide can read",
    m:"Not built",
    g:'Commercial', n:'EMVCo QR (MPM)',        w:'Merchant-presented QR — the format PIX · PayNow · PromptPay · DuitNow · BharatQR · HKQR are all profiles of', ex:"TLV: 00 02 01 · 26 … · 54 06 140.00", exWhy:"Published in 2017 to stop every country inventing its own code. One encoder reaches six national rails.",
    s:'plan',
    note:'NOT implemented. Named here because the counter\'s QR is dispatched per SCHEME (lib/profile PAY_SCHEMES), so this is a row in that table rather than a rewrite. Today only the India scheme is encoded.',
    at:'Counter · how the bill is paid', go:'till', why:'Without it, reaching Brazil or Singapore means writing a second QR generator; with it, one.' },
  { a:'money', k:'std', c:['IN'],
    p:"Customers pay by UPI with the amount already filled in",
    g:'Commercial', n:'NPCI UPI deep link',    w:'upi://pay — the payee, amount and reference a UPI app reads',     ex:"upi://pay?pa=shop@okhdfc&am=140.00&cu=INR&tn=CB-C1-0007", exWhy:"India only, and the same string the storefront already builds — so a customer scanning at the counter and one scanning online reach the same payee with the same reference.",
    s:'live',
    note:'lib/profile PAY_SCHEMES.upi, encoded by the counter and the storefront from one shape. The money moves bank to bank; nothing passes through ChitBridge and nothing here confirms a payment.',
    at:'Counter · Storefront', go:'till', why:'A shop with no card terminal can still be paid without cash, and a QR needs no internet to draw.' },
  { a:'money', k:'std', c:['GLOBAL'],
    p:"The QR code prints and scans reliably",
    g:'Commercial', n:'ISO/IEC 18004',         w:'The QR symbology itself — how a string becomes a printable code', ex:"version 0 · error correction M", exWhy:"The symbol standard beneath every payment QR. We encode, we do not invent: qrcode-generator 1.4.4 (MIT), vendored so a till with no internet can still draw one.",
    s:'live',
    note:'app/../engine/qr.js — the one third-party file on the till, pinned in package.json so an upgrade shows in a diff.',
    at:'Counter · how the bill is paid', go:'till', why:'A hand-rolled encoder would be a wrong QR that takes money somewhere else.' },
  /* ⚠️ NOT a standards body, but an adopted CONTRACT all the same — and the reason the search box does not fight the typist */
  { a:'look', k:'std', c:['GLOBAL'],
    p:"The counter search never picks an item you did not choose",
    m:"Followed at the counter; not audited",
    g:'Accessibility', n:'WAI-ARIA APG · combobox', w:'List autocomplete with MANUAL selection',                    ex:"aria-autocomplete=\"list\"", exWhy:"\u201CThe character string the user has typed will become the value unless the user selects a value in the popup\u201D — so arrowing through the list never overwrites what was typed.",
    s:'part',
    note:'The behaviour is followed at the counter: the search box is a COMMAND box, so a chosen product goes to the cart and the query is cleared, never replaced. ⚠️ Missing: aria-activedescendant, so a screen reader is not told which row is marked.',
    at:'Counter · the search box', go:'till', why:'Filling the box on every arrow press destroys the query — arrow past your item and your typing is gone.' },
  { a:'sell', k:'std', c:['GLOBAL'],
    p:"“In stock” means the same thing outside our app",
    g:'Records & data', n:'schema.org ItemAvailability', w:'What a product\'s status MEANS outside our walls',       ex:"available → https://schema.org/InStock", exWhy:"Three of our four map directly. The human words stay the screen vocabulary — a trader says \u201Cnot available\u201D, not a URL — and the standard value travels beside them.",
    s:'live',
    note:'lib/itemstatus.js SCHEMA_ORG. ⚠️ We are deliberately FINER than the standard in one place: schema.org has a single Discontinued, which conflates \u201Cwe stopped selling it\u201D with \u201Cuse that one instead\u201D; the second carries a successor and is worth acting on, so retired and redundant stay apart and both export as Discontinued.',
    at:'Catalogue · a product\'s status', go:'catalogue', why:'A status only we understand is a status no storefront, feed or buyer can act on.' },
  { a:'buy', k:'std', c:['GLOBAL'],
    p:"Share product data with other companies on the same codes",
    m:"Not built; the GS1 codes it needs are in place",
    g:'Records & data', n:'GDSN',                 w:'Sharing product data BETWEEN companies, on GS1 identity', ex:"GS1 data pools", exWhy:"The network suppliers and retailers already use to exchange item data.",
    s:'plan',
    note:'Not implemented. The identity it needs (GS1) is carried already, which is what makes it reachable later.',
    at:'Catalogue · cross-company', go:'catalogue', why:'The same discipline as our own catalogue, one boundary further out — worth naming so it is a decision, not an oversight.' },
  { a:'people', k:'std', c:['GLOBAL'],
    p:"A company’s global ID can be recorded",
    m:"Not checked against GLEIF yet",
    g:'Records & data', n:'ISO 17442 (LEI)',      w:'Legal Entity Identifier',                         ex:"5493001KJTIIGC8Y1R12", exWhy:"20 characters that identify one legal entity globally. Checkable against GLEIF — which we do not yet do, hence \"partly\".",
    s:'part',
    note:'A field exists to record it; the value is not verified against GLEIF.',
    at:'Trade readiness', go:'readiness', why:'The same company recognised across registers and borders.' },
  { a:'people', k:'std', c:['GLOBAL'],
    p:"A company ID says which register it came from",
    m:"Not built; IDs are kept without their register",
    g:'Records & data', n:'ISO 6523',             w:'Organisation identifier SCHEME, so an id says which register it came from', ex:"0195:198912345K", exWhy:"<b>Scheme first.</b> \"198912345K\" alone is meaningless; <code>0195</code> says it is a Singapore UEN. The scheme is the half everyone drops.",
    s:'plan',
    at:'Profile · identity', go:'readiness', why:'"GSTIN 29ABC" means nothing until you know it is a GSTIN. The scheme is the half everyone drops.' },
  { a:'buy', k:'std', c:['GLOBAL'],
    p:"Places and ports named by one world code",
    m:"Not built",
    g:'Records & data', n:'UN/LOCODE',            w:'Places, ports and terminals',                       ex:"INMAA", exWhy:"Chennai, India. Five characters, and no argument about whether \"Madras\", \"Chennai Port\" and \"MAA\" are the same place.",
    s:'plan',
    at:'Network · places', go:'network', why:'"Chennai" is a city, a port and three terminals. A shipment needs to know which.' },

  /**
   * ⭐ IAM STANDARDS — added after Athi asked *"can you check any specific standard should be followed as part
   * of this IAM, if so and if it is within our control"*. The last clause is the useful one: several IAM
   * standards exist and most are NOT ours to follow, because they govern federating identity between systems and
   * this platform issues its own credentials. Listing those as "planned" would be padding.
   */
  { a:'people', k:'std', c:['GLOBAL'],
    p:"Clear words for who someone is and what they hold",
    m:"Its words are used; its lifecycle model is not",
    g:'Identity & access', n:'ISO/IEC 24760', w:'The IAM vocabulary — identity · identifier · attribute',
    s:'part', note:'We use its distinctions; we do not implement its lifecycle model.',
    ex:'bridge_id = identifier · display_name = attribute · the entity = identity',
    exWhy:'⭐ This is the distinction the IAM page is built on. A Bridge ID is not an identity and a name is not an identifier — conflating them is what made "Identity" the wrong name for a page about five different kinds of party.',
    at:'IAM', go:'identity', why:'Gives us the words for the thing we kept getting wrong: an identifier is not an identity.' },
  { a:'people', k:'std', c:['GLOBAL'],
    p:"Staff see and do only what their role allows",
    m:"Five fixed roles; no custom permissions yet",
    g:'Identity & access', n:'RBAC (ANSI INCITS 359)', w:'Role-based access — coarse, five roles',
    s:'part', note:'The hat IS role-based, but roles are fixed and not composable; there is no permission-to-role assignment.',
    ex:'view_only · act · audit · mis · manager',
    exWhy:'One role per co-assist, enforced on every write since 2026-08-18. Not fine-grained: you cannot grant "may edit catalogue but not send chits".',
    at:'IAM · Co-assists', go:'coassists', why:'⭐ An owner can answer "what can this person do" in one word, which is the whole point of roles over permission lists.' },
  { a:'people', k:'std', c:['GLOBAL'],
    p:"Sign-in with a one-time code to a verified phone or email",
    m:"About AAL2, single factor; not certified",
    g:'Identity & access', n:'NIST SP 800-63B', w:'Authentication assurance',
    s:'part', note:'One-time code to a verified channel is roughly AAL2 single-factor; we do not claim an audited level.',
    ex:'ravi@alpha-timers + a one-time code',
    exWhy:'Possession of the channel proves identity. No password to leak, reuse or phish — which is why there is no password reset flow to attack.',
    at:'Sign-in', go:'', why:'States honestly what our sign-in does and does not prove.' },
  /* ⚠️ NOT OURS, and saying so is the point of the question. */
  { a:'people', k:'std', c:['GLOBAL'],
    p:"Staff accounts could come straight from an HR system",
    m:"Not built",
    g:'Identity & access', n:'SCIM (RFC 7644)', w:'Provisioning identities from an HR system',
    s:'plan', ex:'—',
    exWhy:'Not built. It matters only when a customer wants their HR system to create and remove co-assists automatically — real for a large operator, irrelevant to a shop.',
    at:'Co-assists — where it would provision', go:'coassists',
    why:'Removes the manual add/remove step for a business that already runs an HR system.' },
  { a:'people', k:'std', c:['GLOBAL'],
    p:"Sign in with an account you already have",
    m:"Not built",
    g:'Identity & access', n:'OAuth 2 · OIDC', w:'Federated sign-in',
    s:'plan', ex:'—',
    exWhy:'⚠️ Deliberately not adopted. We ISSUE credentials rather than delegating to an identity provider — a chit is signed by a party we authenticated, and federating that would put a third party between a business and its own record.',
    at:'Sign-in — where it would replace our own', go:'',
    why:'Would let people sign in with an existing account — at the cost of who vouches for the signature on a chit.' },

  { a:'build', k:'std', c:['GLOBAL'],
    p:"Your session is a sealed, standard token",
    g:'Platform',     n:'RFC 7519 (JWT)',         w:'Session tokens',                                    ex:"eyJhbGciOiJIUzI1NiJ9.…", exWhy:"Three base64 parts: header, claims, signature. Any reviewer can decode the middle one and see exactly what we assert about a session.",
    s:'live',
    at:'Sign-in', go:'', why:'A credential format every reviewer already knows how to audit.' },
  { a:'build', k:'prac', c:['GLOBAL'],
    p:"Saving twice — or replaying after going offline — never saves twice",
    g:'Platform',     n:'Idempotency-Key',        w:'A mutation runs at most once, even on replay',      ex:"Idempotency-Key: 9f2c…a41", exWhy:"Send the same order twice after a dropped connection and the second is recognised and ignored. Without it, offline replay would be unsafe to offer.",
    s:'live',
    at:'Every mutation · offline replay', go:'', why:'⭐ A retry after a dropped connection cannot double-send an order. Without it, offline queueing would be unsafe to offer at all.' },
  { a:'people', k:'prac', c:['GLOBAL'],
    p:"Another business can never read your records",
    g:'Platform',     n:'PostgreSQL RLS',         w:'Tenant isolation enforced by the database',         ex:"USING (entity_id = current_setting(...))", exWhy:"The database refuses rows from another tenant even if the query forgets to filter. Isolation that survives a mistake in application code.",
    s:'live',
    note:'FORCE RLS on the entity-data tables; identities is a documented carve-out for cross-tenant discovery.',
    at:'Every entity-scoped read', go:'', why:'Isolation that survives a mistake in application code, because the database refuses rather than trusting the query.' },

  { a:'buy', k:'std', c:['GLOBAL'],
    p:"Who pays freight and where risk passes, agreed in writing",
    m:"Carried on forms; not checked against the shipment",
    g:'Commercial',   n:'Incoterms 2020 (ICC)',   w:'Who bears cost and risk, and to what point',        ex:"FOB Chennai (Incoterms 2020)", exWhy:"Risk and cost pass to the buyer once the goods are on board at Chennai. Three words that decide who pays if the container is damaged mid-ocean.",
    s:'part',
    note:'Carried on instruments and forms; not yet enforced against the shipment record.',
    at:'Chits · instruments', go:'', why:'⭐ Who pays freight and where risk passes, agreed in writing BEFORE the dispute rather than argued after it.' },
  { a:'buy', k:'std', c:['GLOBAL'],
    p:"Letters of credit checked by the rules banks use",
    m:"Not built",
    g:'Commercial',   n:'UCP 600 · ISBP 745',     w:'Documentary credits',                               ex:"—", exWhy:"Not built. When it is, it is the ruleset a bank checks the documents against before releasing payment.",
    s:'plan',
    at:'Instruments', go:'', why:'The rules a bank will actually check the documents against.' },
  { a:'sell', k:'std', c:['GLOBAL'],
    p:"The customs code on your goods — set by you, not at the border",
    m:"Not built",
    g:'Commercial',   n:'HS codes (WCO)',         w:'Tariff classification on goods',                    ex:"0904.11", exWhy:"<b>Pepper, whole.</b> Customs charges duty on THIS, not on your product name — so a seller who states it decides the tariff instead of discovering it at the border.",
    s:'plan',
    at:'Catalogue · goods', go:'catalogue', why:'What customs charges, decided by the seller rather than discovered at the border.' },
  { a:'money', k:'std', c:['GLOBAL'],
    p:"Payment instructions a bank reads without a custom file",
    m:"Not built",
    g:'Commercial',   n:'ISO 20022',              w:'Financial messaging',                               ex:"—", exWhy:"Not built. It is the payment message a bank consumes without a bespoke file per customer.",
    s:'plan',
    at:'Settlement', go:'', why:'Payment instructions a bank can consume without a bespoke file.' },

  /**
   * ⭐ ADOPTED 2026-10-02/03 — the laws and standards the Books and the GST engine were built to, added to the register on 2026-10-03
   * (docs/design/standards/REQUIREMENT.md). `added` marks them so a reader can see they are new; their statuses are the ones
   * stated when they were adopted, none upgraded or downgraded. The WCAG contrast addition is NOT here: it is the existing
   * WCAG 2.2 — 1.4.3 / 1.4.6 row, whose note now says all 16 themes.
   */
  { a:'books', k:'prac', c:['GLOBAL'],
    p:"Every entry’s Dr and Cr placed by rule, shown before you save",
    g:"Books", n:"Golden rules of double entry", w:"Personal · real · nominal: where each line’s Dr and Cr go",
    ex:"Personal: debit the receiver, credit the giver",
    s:"live",
    at:"＋ Entry · the preview",
    go:"entry",
    why:"A rule the CA can check line by line, instead of trusting the software.",
    added:'2026-10-03' },
  { a:'books', k:'law', c:['IN'],
    p:"Books cannot be edited quietly: fixes are reversals and every change is logged",
    g:"Books", n:"Companies Act 2013 s.128 + Rule 3(1), Accounts Rules", w:"Audit trail, from 1 Apr 2023",
    ex:"Rule 3(1) proviso: an edit log that cannot be switched off",
    s:"live",
    at:"Day book · Audit trail",
    go:"daybook",
    why:"The law since 1 April 2023 — and the reason a CA can sign off without re-checking every entry.",
    added:'2026-10-03' },
  { a:'books', k:'law', c:['IN'],
    p:"Balance sheet and P&L laid out the way the law asks",
    limit:"Company format in force; a proprietor’s statements use one Capital account",
    eq:"IAS 1 (presentation) abroad",
    g:"Books", n:"Schedule III, Companies Act (Division I)", w:"How the balance sheet and P&L are laid out",
    ex:"GST credit shown as an asset",
    s:"live",
    at:"Reports · Balance sheet",
    go:"balance",
    why:"A bank, a buyer or an auditor reads it without asking how it was arranged.",
    added:'2026-10-03' },
  { a:'books', k:'std', c:['IN'],
    p:"Closing stock valued at the lower of cost and selling value",
    limit:"Manual count today; automatic once quantities are tracked",
    eq:"IAS 2 abroad",
    g:"Books", n:"AS 2 / Ind AS 2", w:"Inventories",
    s:"live",
    at:"Month & year end · Closing stock",
    go:"closingstock",
    why:"Stops profit being overstated by stock that will not sell at cost.",
    added:'2026-10-03' },
  { a:'books', k:'law', c:['IN'],
    p:"Assets depreciated the right way for your type of business",
    eq:"IAS 16 abroad",
    g:"Books", n:"AS 10 / Ind AS 16 + Schedule II; Income-tax Act s.32 + Appendix I", w:"Assets and depreciation, by type of business; WDV and the 180-day rule",
    s:"live",
    at:"Month & year end · Assets & depreciation",
    go:"assets",
    why:"One asset, two correct numbers — the books’ and the tax return’s — kept side by side.",
    added:'2026-10-03' },
  { a:'books', k:'prac', c:['IN'],
    p:"Entries numbered by type — sales, purchase, receipt… — as your CA expects",
    g:"Books", n:"Tally voucher types", w:"Sales, Purchase, Receipt, Payment, Contra, Credit/Debit note, Journal",
    ex:"SV · PV · RV · PY · CV · CN · DN · JV · MJ",
    s:"live",
    at:"Day book",
    go:"daybook",
    why:"The series every Indian CA already reads; nothing to learn.",
    added:'2026-10-03' },
  { a:'books', k:'std', c:['IN'],
    p:"Each party’s balance confirmed with the party, month by month",
    m:"Not built; monthly agreement with each party is next",
    eq:"ISA 505 abroad",
    g:"Books", n:"SA 505 (external confirmations)", w:"Party balance confirmation; monthly mutual reconciliation",
    s:"plan",
    at:"Ledgers · a party",
    go:"ledgers",
    why:"A balance both sides have agreed is evidence; one side’s balance is a claim.",
    added:'2026-10-03' },
  { a:'books', k:'std', c:['IN'],
    p:"Hand-made entries are numbered MJ, so they are checked first",
    eq:"ISA 240 abroad",
    g:"Books", n:"SA 240 (fraud risk)", w:"Manual journals are tested first",
    s:"live",
    at:"Day book · filter MJ",
    go:"daybook",
    why:"Where an auditor looks first for fraud, the app makes the looking easy.",
    added:'2026-10-03' },
  { a:'money', k:'law', c:['IN'],
    p:"GST credit used in the legal order; CGST and SGST never cross",
    g:"Money & GST", n:"CGST Act s.49 / 49A / 49B, Rule 88A", w:"The order GST credit is used in",
    s:"live",
    at:"Month & year end · GST close & pay",
    go:"gstclose",
    why:"Using credit in the wrong order means paying cash you did not owe.",
    added:'2026-10-03' },
  { a:'money', k:'law', c:['IN'],
    p:"Reverse-charge GST worked out, and paid in cash as the law requires",
    limit:"Worked out by the engine; the screens follow",
    g:"Money & GST", n:"CGST Act s.9(3)/9(4) + notifications; s.49(4), Rule 86(2)", w:"Reverse charge, paid in cash only",
    s:"live",
    at:"Bills · Returns",
    go:"returns",
    why:"Reverse charge cannot be paid from credit; getting it wrong is interest and a notice.",
    added:'2026-10-03' },
  { a:'money', k:'law', c:['IN'],
    p:"Cess posted on its own; cess credit pays only cess",
    g:"Money & GST", n:"GST (Compensation to States) Cess Act 2017, s.11(2)", w:"Cess and cess credit",
    s:"live",
    at:"GST close & pay",
    go:"gstclose",
    why:"Cess credit spent on GST is a mismatch the department will find.",
    added:'2026-10-03' },
  { a:'money', k:'law', c:['IN'],
    p:"Returns built from your own bills and matched to the Ledger",
    m:"Built; filing through a GSP is not connected",
    g:"Money & GST", n:"GSTR-1 / GSTR-3B (GSTN schema)", w:"Monthly returns",
    s:"part",
    at:"GST · Returns",
    go:"returns",
    why:"A return that comes from the bills cannot disagree with them.",
    added:'2026-10-03' },
  { a:'money', k:'law', c:['IN'],
    p:"Input credit claimed only when your supplier has filed",
    m:"Matching built; its screen comes next",
    g:"Money & GST", n:"CGST Act s.16(2)(aa) + GSTR-2B", w:"Input credit only when the supplier filed",
    s:"part",
    at:"GST · 2B match",
    go:"twobmatch",
    why:"Credit claimed before the supplier files is credit you may have to pay back with interest.",
    added:'2026-10-03' },
  { a:'money', k:'law', c:['IN'],
    p:"e-invoices and e-way bills prepared and checked",
    m:"No GSP connection yet (decision pending)",
    eq:"PEPPOL BIS abroad (see UBL)",
    g:"Money & GST", n:"e-invoice INV-01 schema 1.1 (IRP); e-way bill, Rule 138", w:"e-invoice and e-way bill payloads",
    s:"part",
    at:"GST · e-invoice / e-way bill",
    go:"einvoice",
    why:"Above the turnover limit an invoice without an IRN is not a valid invoice.",
    added:'2026-10-03' },
  { a:'money', k:'law', c:['IN'],
    p:"Interest on late GST worked out for you",
    g:"Money & GST", n:"CGST Act s.50", w:"Interest on late GST",
    s:"live",
    at:"GST close & pay",
    go:"gstclose",
    why:"So the interest is known before the department says it.",
    added:'2026-10-03' },
  { a:'people', k:'law', c:['IN'],
    p:"Customer data used only for its purpose, with consent; people can see, correct or erase theirs",
    m:"Rules decided; consent records come with CRM phase 5",
    eq:"Like the GDPR in the EU",
    g:"People & privacy", n:"Digital Personal Data Protection Act 2023", w:"Purpose, consent, the right to see, correct and erase",
    s:"part",
    at:"Parties ↗ (CB CRM)",
    go:"crm",
    why:"No scraping, no guessing sensitive facts: the customer’s data stays theirs.",
    added:'2026-10-03' },
  { a:'money', k:'law', c:['IN'],
    p:"Bank statements fetched with your consent, not typed in",
    m:"Not built; decision pending (FIU)",
    g:"Money & GST", n:"RBI Account Aggregator (ReBIT FI schema)", w:"Bank statements by consent",
    s:"plan",
    at:"Daily · Bank (reconcile)",
    go:"bank",
    why:"Statements straight from the bank cannot be mistyped.",
    added:'2026-10-03' },
];

/* ⭐ THE VOCABULARIES the new fields draw from, and the date the register was last checked. A status word is said here once; the Settings
   card, the Legend and the page all say In force / Partly / Planned. Adding a country is one line in STD_COUNTRIES. */
var STD_AREAS = [['sell','Selling'],['buy','Buying'],['money','Money & GST'],['books','Books'],['people','People & privacy'],['look','Look & access'],['build','How we build']];
var STD_KINDS = [['law','Law','you must'],['std','Standard','agreed worldwide'],['prac','Practice','the common way'],['compat','Compatibility','works with']];   /* compat: an outside system we work with — its rows are data/compat.json (stdCompatRows), never this list */
var STD_COUNTRIES = [['IN','India'],['GLOBAL','Global']];
var STD_STATUS = [['live','In force','●'],['part','Partly','◐'],['plan','Planned','○']];
var STD_CHECKED = '2026-10-03';

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
var STD_SETTINGS_SECS = { locale:1, appearance:1, governance:1, standards:1, integrations:1 };
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
       full strength would claim something untrue. Dimmed-and-labelled is the only honest third option. Dimmed with the
       theme's muted ink (--grey), NOT with opacity: opacity cannot be measured against a ground, so a dimmed line could
       fall under AA in some theme and no check would see it (e2e/standards-page.cjs measures this one). */
    var dim = f.s === 'plan';
    /* ⭐ T4 (M41): on the page each field is a block that opens to WHAT the standard is (the register's own line) and WHY it applies here */
    var reg = compact ? null : stdRowFor(f.std);
    return (compact ? '<div style="padding:5px 0;border-block-start:1px solid var(--line)">'
        : '<details class="std-fold" data-testid="std-rec-field" style="padding:5px 0;border-block-start:1px solid var(--line)"><summary style="cursor:pointer">')
      + '<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-family:' + "'Space Mono'" + ',ui-monospace,monospace;font-size:var(--fs-1)">'
      +   '<span style="color:var(--blue-2);min-width:96px">' + esc(f.k) + '</span>'
      +   '<span style="color:' + (dim ? 'var(--grey)' : 'var(--on-card)') + ';word-break:break-all;flex:1;min-width:0">' + esc(f.v) + '</span>'
      + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:3px">'
      /* ⚠️ NOT 9px. Sub-11px text is hard for anyone and unusable for some of the readers this register is
         partly about — and being small on the ACCESSIBILITY page is the worst place to be inconsistent. --fs-1 is
         the smallest size the type scale admits, and it moves with the reader's text-size setting. */
      +   (f.std ? '<span style="font-size:var(--fs-1);font-weight:800;letter-spacing:.04em;text-transform:uppercase;background:' + b[0] + ';color:' + b[1] + ';border-radius:4px;padding:1px 6px">' + esc(f.std) + ' · ' + b[2] + '</span>' : '')
      + '</div>'
      + (compact ? '</div>' : '</summary>'
        + (reg ? '<div style="font-size:var(--fs-1);color:var(--on-card);margin-top:3px;line-height:1.5"><b>' + esc(reg.n) + '</b> — ' + esc(reg.w) + '</div>' : '')
        + (f.c ? '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:3px;line-height:1.5">' + f.c + '</div>' : '')
        + '</details>');
  }).join('');

  return '<div style="border:1px solid var(--line);border-radius:9px;padding:10px 12px;margin-bottom:9px">'
    + '<div style="font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:4px">' + tx('One chit, every standard in it') + '</div>'
    + '<div style="font-size:var(--fs-1);color:var(--grey);line-height:1.55;margin-bottom:6px">'
    +   '500 kg of pepper leaving Chennai for Dubai. Each field carries somebody else\'s standard, so the record '
    +   'arrives already legible to a system that has never heard of us. <b>' + tx('Greyed fields are not built yet') + '</b> — '
    +   'shown rather than omitted, because a demonstration that quietly includes what we have not done is worse '
    +   'than the list it was meant to make concrete.'
    + '</div>'
    + (compact ? '' : stdFoldBar())
    + rows
    + '</div>';
}
/** the register row a record field's standard names ("Incoterms · UN/LOCODE" → Incoterms; "HS (WCO)" → HS), or null */
function stdRowFor(std){
  var key = String(std || '').split(/ · | \(/)[0].trim();
  if (!key || /^—/.test(key)) return null;
  for (var i = 0; i < STANDARDS.length; i++) if (STANDARDS[i].n.indexOf(key) === 0) return STANDARDS[i];
  for (var j = 0; j < STANDARDS.length; j++) if (STANDARDS[j].n.indexOf(key) >= 0) return STANDARDS[j];
  return null;
}
/** Expand all · Collapse all for the folded blocks of the sheet it sits in (self-contained: works on any page that shows the sheet) */
function stdFoldBar(){
  var b = function(open, label, tid){
    return '<button type="button" data-testid="' + tid + '" style="font:inherit;font-size:var(--fs-1);font-weight:700;border:1px solid var(--line);background:var(--card,transparent);color:var(--on-card);border-radius:8px;padding:5px 10px;cursor:pointer;min-height:32px"'
      + ' onclick="var r=this.parentNode.parentNode;Array.prototype.forEach.call(r.querySelectorAll(&quot;details.std-fold&quot;),function(d){d.open=' + open + ';})">' + tx(label) + '</button>';
  };
  return '<div style="display:flex;gap:6px;margin:0 0 8px">' + b(true, 'Expand all', 'std-fold-all') + b(false, 'Collapse all', 'std-fold-none') + '</div>';
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
      /* ⭐ T3 (M41): the bold line is the gist, the story folds under it — Expand all / Collapse all above */
      if (!compact) return '<details class="std-fold" data-testid="std-why-fold" style="padding:6px 0;border-block-start:1px solid var(--line)"><summary style="cursor:pointer">'
        + '<b style="font-size:var(--fs-2);color:var(--on-card)">' + x[0] + '</b></summary>'
        + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px;line-height:1.55">' + x[1] + '</div></details>';
      return '<div style="padding:4px 0;border-block-start:1px solid var(--line)">'
        + '<b style="font-size:var(--fs-2);color:var(--on-card)">' + x[0] + '</b>'
        + '</div>';
    }).join(''));
  };

  return (compact ? '' : stdFoldBar()) + card('<div data-testid="std-why-short" style="font-size:var(--fs-2);line-height:1.65;color:var(--on-card)">'
      + '<div><b>' + tx('Your chit reaches another shop.') + '</b></div>'
      + '<div><b>' + tx('That shop can read it on day one.') + '</b></div>'
      + '<div><b>' + tx('No one has to be taught our way.') + '</b></div>'
      + '<details data-testid="std-why-more" style="margin-top:8px;color:var(--grey)"><summary style="cursor:pointer">' + tx('More') + '</summary>'
      + '<div style="margin-top:6px"><b>A chit crosses a boundary.</b> It leaves one company and lands in another that shares no system with '
      + 'it. Every convention we invent is one the other side has to be taught; every standard we adopt arrives '
      + 'already legible. So this is not hygiene around the rail — it is what makes '
      + 'a rail possible <b>without an integration project per counterparty</b>.</div></details></div>')
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

/**
 * ⭐ COMPATIBILITY — the 4th Kind (M41 · BACKLOG T49). Every outside system we work with is a row of the SAME register shape, so the page's
 * list, matrix, filters and Copy treat it like any standard. The rows live in ONE file, public/data/compat.json, which the Compatibility lab
 * (N04) reads too — never a second list here. This maps a compat.json row onto a register row; a row the file gets wrong is dropped, not guessed.
 *   status works → In force · partly → Partly · planned → Planned.   proof live → "Tested live <date>" · stand-in → "Proven on a stand-in" · not-yet → "Not yet".
 */
var STD_COMPAT_STATUS = { works: 'live', partly: 'part', planned: 'plan' };
var STD_COMPAT_PROOF = { live: 'Tested live', 'stand-in': 'Proven on a stand-in', 'not-yet': 'Not yet' };
var STD_COMPAT_FIT = { 'one-to-one': 'One-to-one', alongside: 'Works alongside', gap: 'Gap' };
function stdCompatRows(json){
  var rows = (json && Array.isArray(json.rows)) ? json.rows : [];
  var areas = STD_AREAS.map(function(a){ return a[0]; }), ctry = STD_COUNTRIES.map(function(c){ return c[0]; });
  return rows.filter(function(x){
    return x && x.system && x.service && x.p && STD_COMPAT_STATUS[x.status] && areas.indexOf(x.area) >= 0 && Array.isArray(x.c) && x.c.length && x.c.every(function(c){ return ctry.indexOf(c) >= 0; });
  }).map(function(x){
    var s = STD_COMPAT_STATUS[x.status];
    var proof = (STD_COMPAT_PROOF[x.proof] || 'Not yet') + (x.proof_at ? ' ' + x.proof_at : '') + (x.proof_ref ? ' — ' + x.proof_ref : '');
    return { a: x.area, k: 'compat', c: x.c.slice(), p: x.p, m: s === 'live' ? undefined : (x.m || x.roadmap || 'Not built yet'),
      g: 'Compatibility', n: x.system + ' — ' + x.service, w: (STD_COMPAT_FIT[x.fit] || x.fit || '') + ' · ' + x.service,
      ex: '—', s: s, note: x.roadmap || x.note || undefined, at: 'Settings › Integrations', go: 'integrations',
      proof: proof, fit: STD_COMPAT_FIT[x.fit] || x.fit, compat: x.id };
  });
}

/**
 * ⭐ THE GLOSSARY (M41 · BACKLOG T2): every abbreviation the Standards page shows, with its full name and one line of meaning — one list,
 * here, reused by every place that paints the register's words (stdGloss). e2e/standards-page.cjs scans every word the page can show and
 * fails on an abbreviation with no entry. STD_NOT_ABBR = capitals that are emphasis or a document name, not an abbreviation.
 *   [term, full name, what it means]
 */
var STD_GLOSSARY = [
  ['AA', 'WCAG level AA', 'The middle level of the web accessibility rules — the one most laws ask for'],
  ['AAL2', 'Authenticator Assurance Level 2', 'Sign-in with two factors, as NIST defines it'],
  ['AE', 'United Arab Emirates (country code)', 'The ISO 3166 code for the UAE'],
  ['AED', 'UAE dirham', 'The currency of the UAE (ISO 4217 code)'],
  ['ANSI', 'American National Standards Institute', 'The body that publishes US national standards'],
  ['API', 'Application programming interface', 'The door another program uses to talk to ours'],
  ['APG', 'ARIA Authoring Practices Guide', 'How to build accessible controls, by the W3C'],
  ['AS', 'Accounting Standard (India)', 'The ICAI rules for Indian businesses'],
  ['BCP', 'Best Current Practice', 'An internet standard series; BCP 47 names languages'],
  ['BIS', 'Bureau of Indian Standards', 'India\'s national standards body'],
  ['CA', 'Chartered Accountant', 'A qualified accountant who audits and files for you'],
  ['CB', 'ChitBridge', 'This platform'],
  ['CGST', 'Central GST', 'The part of GST that goes to the central government'],
  ['CI', 'Continuous integration', 'The server that runs every test on every change'],
  ['CLDR', 'Common Locale Data Repository', 'The world\'s shared data for dates, numbers and names by country'],
  ['CN', 'Credit note', 'A voucher that reduces what a buyer owes'],
  ['CRM', 'Customer relationship management', 'Your list of parties and everything said with them'],
  ['CSS', 'Cascading Style Sheets', 'The language that lays out a web page'],
  ['CSV', 'Comma-separated values', 'A plain spreadsheet file any program can open'],
  ['CV', 'Contra voucher', 'Money moved between your own cash and bank'],
  ['DN', 'Debit note', 'A voucher that increases what a buyer owes'],
  ['ECE', 'UN Economic Commission for Europe', 'Publishes trade codes, such as units (Rec 20)'],
  ['ECMA-402', 'ECMAScript Internationalization API', 'How a browser formats dates, numbers and money by country'],
  ['ERP', 'Enterprise resource planning', 'Large business software, such as SAP or NetSuite'],
  ['EU', 'European Union', 'The 27-country union in Europe'],
  ['FI', 'Financial information', 'Account data, in the Account Aggregator\'s schema'],
  ['FIU', 'Financial Information User', 'A business allowed to receive your bank data with your consent'],
  ['FOB', 'Free On Board', 'An Incoterm: the seller\'s duty ends once goods are on the ship'],
  ['GDPR', 'General Data Protection Regulation', 'The EU\'s privacy law'],
  ['GDSN', 'Global Data Synchronisation Network', 'GS1\'s network for sharing product data'],
  ['GLEIF', 'Global Legal Entity Identifier Foundation', 'Keeps the world list of LEIs'],
  ['GNU', 'GNU Project', 'Free software tools, such as gettext'],
  ['GS1', 'GS1', 'The body behind barcodes and product numbers worldwide'],
  ['GSP', 'GST Suvidha Provider', 'A licensed company that files GST for software'],
  ['GST', 'Goods and Services Tax', 'India\'s tax on sales'],
  ['GSTIN', 'GST Identification Number', 'Your 15-character GST registration number'],
  ['GSTN', 'GST Network', 'The government\'s GST computer system'],
  ['GSTR', 'GST Return', 'A GST filing'],
  ['GSTR-1', 'GST Return 1', 'Your monthly list of sales'],
  ['GSTR-2B', 'GST Return 2B', 'The input credit your suppliers have filed for you'],
  ['GSTR-3B', 'GST Return 3B', 'Your monthly GST summary and payment'],
  ['GTIN', 'Global Trade Item Number', 'The number under a barcode'],
  ['HKQR', 'Hong Kong FPS QR', 'Hong Kong\'s payment QR code'],
  ['HR', 'Human resources', 'Your staff records'],
  ['HS', 'Harmonized System', 'The world\'s customs codes for goods'],
  ['HSN', 'Harmonized System of Nomenclature', 'India\'s HS-based codes on a GST invoice'],
  ['IAM', 'Identity and access management', 'Who can sign in, and what each person may do'],
  ['IANA', 'Internet Assigned Numbers Authority', 'Keeps the world list of time zones'],
  ['IAS', 'International Accounting Standard', 'The world\'s accounting rules (IFRS family)'],
  ['ICC', 'International Chamber of Commerce', 'Publishes Incoterms and trade rules'],
  ['ID', 'Identifier', 'A number or code that names one thing'],
  ['IEC', 'International Electrotechnical Commission', 'Publishes standards with ISO'],
  ['IEEE', 'Institute of Electrical and Electronics Engineers', 'Publishes engineering standards'],
  ['II', 'Part II', 'The second part of a schedule'],
  ['III', 'Schedule III', 'The layout of a company\'s balance sheet and P&L in India'],
  ['IN', 'India (country code)', 'The ISO 3166 code for India'],
  ['INCITS', 'InterNational Committee for Information Technology Standards', 'A US standards committee'],
  ['INMAA', 'Chennai port (UN/LOCODE)', 'The world code for Chennai'],
  ['INR', 'Indian rupee', 'The currency of India (ISO 4217 code)'],
  ['INV-01', 'e-invoice schema INV-01', 'India\'s e-invoice format'],
  ['IRN', 'Invoice Reference Number', 'The number the GST portal gives an e-invoice'],
  ['IRP', 'Invoice Registration Portal', 'The GST portal that registers e-invoices'],
  ['ISA', 'International Standard on Auditing', 'The world\'s audit rules'],
  ['ISBP', 'International Standard Banking Practice', 'How banks check trade documents'],
  ['ISO', 'International Organization for Standardization', 'Publishes most world standards'],
  ['JSON', 'JavaScript Object Notation', 'A plain text data format'],
  ['JV', 'Journal voucher', 'An entry that is not a sale, purchase, receipt or payment'],
  ['JWT', 'JSON Web Token', 'A signed pass that proves who is signed in'],
  ['KGM', 'Kilogram (UN/ECE unit code)', 'The world code for a kilogram'],
  ['KGS', 'Kilograms (GST unit code)', 'The GST code for kilograms'],
  ['LEI', 'Legal Entity Identifier', 'A world-wide number for a company'],
  ['LOCODE', 'UN Location Code', 'The world code for a port or city'],
  ['LTR', 'Left to right', 'Writing direction, as in English'],
  ['MAA', 'Chennai (IATA code)', 'The airport code for Chennai'],
  ['MDM', 'Master data management', 'Keeping one true copy of product and party data'],
  ['MIT', 'MIT License', 'A free software licence'],
  ['MJ', 'Manual journal', 'An entry typed by hand, so it is checked first'],
  ['MPM', 'Merchant-presented mode', 'A QR the shop shows and the customer scans'],
  ['NIST', 'US National Institute of Standards and Technology', 'Publishes security rules such as SP 800-63'],
  ['NPCI', 'National Payments Corporation of India', 'Runs UPI'],
  ['OIDC', 'OpenID Connect', 'The standard behind "Sign in with Google"'],
  ['OS', 'Operating system', 'Windows, Android, iOS and so on'],
  ['OTH', 'Others (GST unit code)', 'The GST unit for anything without its own code'],
  ['PAY', 'Payment voucher', 'Money you paid out'],
  ['PEPPOL', 'Pan-European Public Procurement Online', 'A network for sending e-invoices between businesses'],
  ['PIM', 'Product information management', 'Keeping product details in one place'],
  ['PIX', 'Pix', 'Brazil\'s instant payment system'],
  ['POST', 'HTTP POST', 'A request that sends data to a server'],
  ['PV', 'Purchase voucher', 'A bill from a supplier'],
  ['PY', 'Payment voucher', 'Money you paid out'],
  ['QR', 'Quick Response code', 'A square barcode a phone can scan'],
  ['RBAC', 'Role-based access control', 'What you may do depends on your role'],
  ['RBI', 'Reserve Bank of India', 'India\'s central bank'],
  ['RFC', 'Request for Comments', 'An internet standard'],
  ['RLS', 'Row-level security', 'The database shows each business only its own rows'],
  ['RTL', 'Right to left', 'Writing direction, as in Arabic'],
  ['RV', 'Receipt voucher', 'Money you received'],
  ['SA', 'Standard on Auditing (India)', 'India\'s audit rules, based on ISA'],
  ['SCIM', 'System for Cross-domain Identity Management', 'How an HR system creates and removes staff accounts'],
  ['SGST', 'State GST', 'The part of GST that goes to the state'],
  ['SKU', 'Stock-keeping unit', 'Your own code for one product'],
  ['SP', 'Special Publication (NIST)', 'A NIST rule book'],
  ['SV', 'Sales voucher', 'A sale'],
  ['TCMS', 'Test case management system', 'Where test cases and results are kept'],
  ['TLV', 'Tag-length-value', 'How fields are packed inside a payment QR'],
  ['UAE', 'United Arab Emirates', 'A country in the Gulf'],
  ['UBL', 'Universal Business Language', 'A world standard for invoices and orders in XML'],
  ['UCP', 'Uniform Customs and Practice for Documentary Credits', 'The ICC rules for letters of credit'],
  ['UEN', 'Unique Entity Number', 'Singapore\'s company number'],
  ['UN', 'United Nations', 'Publishes world trade codes'],
  ['UPI', 'Unified Payments Interface', 'India\'s instant phone payments'],
  ['UQC', 'Unit Quantity Code', 'The GST code for a unit, such as KGS'],
  ['URL', 'Web address', 'Where a page lives on the internet'],
  ['US', 'United States', 'The country'],
  ['UTF-16', 'UTF-16', 'A way of storing text as numbers'],
  ['UTS', 'Unicode Technical Standard', 'UTS #35 is how locale data is written'],
  ['VAT', 'Value-added tax', 'A sales tax, as in the UAE'],
  ['WAI-ARIA', 'Web Accessibility Initiative — Accessible Rich Internet Applications', 'How a screen reader understands a control'],
  ['WCAG', 'Web Content Accessibility Guidelines', 'The world rules for accessible web pages'],
  ['WCO', 'World Customs Organization', 'Keeps the HS codes'],
  ['WDV', 'Written-down value', 'Depreciation on what is left each year'],
  ['XML', 'Extensible Markup Language', 'A text data format with tags']
];
/* REFERENCE-LEVEL entries (2026-10-09 tidy): a number after an abbreviation names ONE standard, so it gets its own tip, matched before the single words.
   ⚠️ ONLY the expansion of the name is written here — no legal reading. ADDED WORDING, for Athi to confirm. */
var STD_GLOSSARY_REF = [
  ['ISO 4217', 'ISO 4217', 'The international standard list of currency codes'],
  ['ISO 8601', 'ISO 8601', 'The international standard way to write dates and times'],
  ['ISO 6523', 'ISO 6523', 'The international standard for identifying organisations'],
  ['ISO 17442', 'ISO 17442', 'The international standard for the Legal Entity Identifier (LEI)'],
  ['ISO 20022', 'ISO 20022', 'The international standard for financial messages'],
  ['ISO/IEC 18004', 'ISO/IEC 18004', 'The international standard for QR codes'],
  ['BCP 47', 'BCP 47', 'The internet standard for language tags, such as en-IN'],
  ['RFC 4647', 'RFC 4647', 'The internet standard for matching language tags'],
  ['RFC 5646', 'RFC 5646', 'The internet standard for naming languages (the text of BCP 47)'],
  ['RFC 7386', 'RFC 7386', 'The internet standard for changing part of a JSON record (merge patch)'],
  ['RFC 7519', 'RFC 7519', 'The internet standard for JSON Web Tokens (JWT)'],
  ['RFC 7644', 'RFC 7644', 'The internet standard for SCIM, creating and removing staff accounts']
];
STD_GLOSSARY = STD_GLOSSARY.concat(STD_GLOSSARY_REF);
var STD_REF_RE = new RegExp('(?<![A-Za-z0-9])(?:' + STD_GLOSSARY_REF.map(function(g){ return g[0]; }).join('|') + ')(?![A-Za-z0-9])', 'g');   /* the keys hold only letters, digits, a space and a slash — nothing to escape */
var STD_NOT_ABBR = ['BEFORE', 'BETWEEN', 'CAN', 'IS', 'COMMAND', 'DELETES', 'FINER', 'FORCE', 'FORMAT', 'ISSUE', 'MANUAL', 'MEANS', 'MET', 'NOT', 'OTHER', 'PLAN',
  'RUNNER', 'SAME', 'SCHEMA', 'SCHEME', 'SUPERSEDED', 'THIS', 'WAS', 'ZONE', 'UBL-MAPPING-2026-09-05'];
/* an abbreviation: two or more capitals or digits from a word start, joined by hyphens (GSTR-2B · ECMA-402 · WAI-ARIA); mixed case (JUnit, OAuth) is a name */
var STD_ABBR_RE = /\b[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)*\b/g;
var _stdGl = null;
function stdGlossary(term){
  if (!_stdGl){ _stdGl = {}; STD_GLOSSARY.forEach(function(g){ _stdGl[g[0]] = g; }); }
  return _stdGl[term] || null;
}
/** every abbreviation in a text that is not an emphasis word (e2e/standards-page.cjs reads this) */
function stdAbbrs(text){
  var out = [];
  String(text == null ? '' : text).replace(/<[^>]+>/g, ' ').replace(STD_ABBR_RE, function(m){ if (STD_NOT_ABBR.indexOf(m) < 0) out.push(m); return m; });
  return out;
}
/**
 * Wrap each known abbreviation in already-escaped HTML in <abbr class="gl" tabindex="0"> with its full name as the title. Text inside a tag,
 * inside <code> and inside an existing <abbr> is left alone. The page shows the meaning on a tap or Enter (a phone has no hover).
 */
function stdGloss(html, o){
  var inCode = 0, tab = !(o && o.focus === false) ? ' tabindex="0"' : '';   /* {focus:false}: a list cell — one tab stop per row, not per term */
  return String(html == null ? '' : html).split(/(<[^>]+>)/).map(function(seg){
    if (seg.charAt(0) === '<'){ if (/^<(code|abbr)\b/i.test(seg)) inCode++; else if (/^<\/(code|abbr)>/i.test(seg)) inCode = Math.max(0, inCode - 1); return seg; }
    if (inCode) return seg;
    function one(m){
      var g = stdGlossary(m); if (!g) return m;
      var t = g[1] + (g[2] ? ' — ' + g[2] : '');
      return '<abbr class="gl"' + tab + ' data-gl="' + m + '" title="' + String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' + m + '</abbr>';
    }
    /* a numbered reference (ISO 4217) first, then the single words in what is left */
    var parts = seg.split(STD_REF_RE), refs = seg.match(STD_REF_RE) || [];
    return parts.map(function(p, i){ return p.replace(STD_ABBR_RE, one) + (i < refs.length ? one(refs[i]) : ''); }).join('');
  }).join('');
}
