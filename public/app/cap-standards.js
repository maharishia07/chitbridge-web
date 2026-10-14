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
 *   id     the row's stable key, kebab-case, never reused (by hand, here; read by app/catalogue-model.js standards() and e2e/standards-one-list.cjs) — STDREG1
 *   pa     the PRODUCT area the row lives in, one of STD_PRODUCT_AREAS (judgement; here; the page's Product area filter and group) — STDREG1
 *   matrix 'country' on the ONE row whose opened view paints the country matrix (derived: data/country-matrix.json, the engines' generated file; written by
 *          the engines' tools/country-matrix.cjs --web; read by standards.html nextOf) — CPS1, 2026-10-13
 */
var STANDARDS = [
  { id:'iso-29119-3', pa:'testing', a:'build', k:'std', c:['GLOBAL'],
    p:"Every test run is written up on a template an auditor already knows",
    m:"Judgement sections need a person; no test plan yet",
    g:'Verification', n:'ISO/IEC/IEEE 29119-3', w:'Test completion report — the template a run is written up on',
    ex:"6 · Test completion evaluation", exWhy:"The clause that asks whether the exit criteria were MET. We render the numbers under it and say plainly that the judgement is not ours to generate — a report that fills this heading with plausible prose looks signed off and is not.",
    s:'part',
    note:'The measured sections are generated from the ledger; the judgement sections (deviations, completion evaluation, residual risks, lessons, approval) are marked “needs a person” and carry the question instead of an answer. No test PLAN is declared anywhere yet, so section 5 has nothing to compare against.',
    at:'Testing › Report', go:'testing', why:'⭐ It SUPERSEDED IEEE 829 in 2013 — which is the name most people still reach for, and using the withdrawn one would have looked more familiar to more readers and been wrong. A completion report on a known template is one an auditor, a customer or a new engineer can read without being taught our format.' },
  { id:'junit-xml', pa:'testing', a:'build', k:'prac', c:['GLOBAL'],
    p:"Test results any tool can read, not locked in one screen",
    g:'Verification', n:'JUnit XML', w:'Test result interchange — what every CI writes and every tool reads',
    ex:"<testcase name=\"[CTR-05] a single click chooses\"/>", exWhy:"Playwright emits this with one config line; Kiwi TCMS, TestRail, Allure and ReportPortal all import it. The case key in brackets is what joins a run to our board.",
    s:'live',
    at:'POST /api/testing/results/junit', go:'testing', why:'A private results format would strand every automated run inside one screen, and would have to be re-implemented by anything that ever wanted to read it.' },
  { id:'gherkin', pa:'testing', a:'build', k:'prac', c:['GLOBAL'],
    p:"Each rule and its test are written as one text",
    m:"The format is adopted; its runner deliberately is not",
    g:'Verification', n:'Gherkin', w:'The spec and the test as one text — Given / When / Then',
    ex:"Given Counter open on Sell", exWhy:"Our case shape already WAS Given/When/Then (pre / step / expected), so nothing is translated — the file is rendered and read back, and all 110 real cases round-trip unchanged.",
    s:'part',
    note:'The FORMAT is adopted; Cucumber the RUNNER is deliberately not — every “When I click the row” would need a step definition, a second codebase mapping sentences onto clicks.',
    at:'Testing — export/import .feature', go:'testing', why:'A .feature file carries the spec clause (the Feature description) and the cases against it in one text, so neither can be edited without the other in front of you.' },
  { id:'bcp47', pa:'locale', a:'look', k:'std', c:['GLOBAL'],
    p:"Your language is named the way every system names it",
    g:'Localisation', n:'BCP 47 (RFC 5646)',      w:'Language tags — en-IN, ar-AE, ta',                 ex:"ta-IN", exWhy:"A browser sends exactly this as <code>Accept-Language</code>. Any system on earth reads it as \"Tamil, as written in India\" — no lookup table, no mapping file.",
    s:'live',
    at:'Localisation', go:'locale', why:'A language tag nobody else parses means every counterparty re-guesses what "Tamil" meant.' },
  { id:'cldr', pa:'locale', a:'look', k:'std', c:['GLOBAL'],
    p:"Lakh or million, month names, weekends — right for each country",
    g:'Localisation', n:'UTS #35 · CLDR',         w:'Locale data and the -u- extensions (nu·hc·ca·fw)',  ex:"en-IN-u-nu-latn-hc-h23", exWhy:"One tag carrying four decisions: English, Indian grouping, Western digits, 24-hour clock. Hand it to <code>Intl</code> anywhere and you get the same answer.",
    s:'live',
    at:'Localisation', go:'locale', why:'Lakh vs million, month names, which days are the weekend — facts about 200 countries we would otherwise guess. CLDR told us the UAE weekend changed in 2022 when our own comments said otherwise.' },
  { id:'rfc4647', pa:'locale', a:'look', k:'std', c:['GLOBAL'],
    p:"A buyer sees the catalogue in the language its author wrote",
    g:'Localisation', n:'RFC 4647',               w:'Language priority list and matching',               ex:"ta, en, hi", exWhy:"Your priority list. A catalogue written in <b>en</b> and <b>hi</b> shows you the <b>en</b> one — the version its author wrote, chosen not translated.",
    s:'live',
    at:'Localisation', go:'locale', why:'Decides which authored version of a catalogue a buyer is shown — without translating anything.' },
  { id:'ecma-402', pa:'locale', a:'look', k:'std', c:['GLOBAL'],
    p:"Numbers, money and dates shown the way your reader writes them",
    g:'Localisation', n:'ECMA-402 (Intl)',        w:'Number, money, date, collation, direction',         ex:"12,34,56,789.50", exWhy:"The same number is <b>123,456,789.50</b> to a US reader and <b>123.456.789,50</b> in Germany. Nobody stores three versions; the tag decides at render.",
    s:'live',
    at:'Every screen with a figure on it', go:'locale', why:'Sorting a Tamil supplier list by UTF-16 code units is byte order wearing alphabetical clothes.' },
  { id:'iana-tz', pa:'locale', a:'books', k:'std', c:['GLOBAL'],
    p:"Every time carries its zone, so “when” is a fact, not an argument",
    g:'Localisation', n:'IANA tz database',       w:'Time zones — via the engine, not a kept table',     ex:"Asia/Dubai", exWhy:"Not <code>+04:00</code>. An offset is wrong twice a year in half the world; a ZONE stays correct because the rules travel with the name.",
    s:'live',
    at:'Every timestamp on every chit', go:'locale', why:'⭐ Turns "when did this happen" from an argument into a fact. One instant read 19:00, 20:30 and 16:00 to three parties before this.' },
  { id:'iso4217', pa:'catalogue', a:'sell', k:'std', c:['GLOBAL'],
    p:"Every price says its currency, so nobody guesses",
    g:'Localisation', n:'ISO 4217',               w:'Currency codes on every price',                     ex:"{ amount: 1250.00, currency: \"AED\" }", exWhy:"A price is a pair, never the string \"AED 1250\". Your ERP reads the currency field; it does not parse a symbol out of a label.",
    s:'live',
    at:'Catalogue · prices', go:'catalogue', why:'A price without a stated currency is a number, not an amount — and the party who assumes wrong pays the difference.' },
  { id:'iso8601', pa:'api', a:'books', k:'std', c:['GLOBAL'],
    p:"Every saved time is one exact, unambiguous instant",
    limit:"storage and transport; screens show your locale",
    g:'Localisation', n:'ISO 8601',               w:'Timestamps in storage and transport',               ex:"2026-08-18T14:32:05Z", exWhy:"Unambiguous everywhere. \"18/08/2026\" is the 18th of August in Mumbai and invalid in New York — and \"08/09\" is two different days.",
    s:'live',
    at:'Chit records · exports · pack · JUnit', go:'locale', why:'An unambiguous instant on the record, whatever the reader sees.' },
  { id:'gettext', pa:'locale', a:'look', k:'prac', c:['GLOBAL'],
    p:"The app can be translated from one file",
    m:"449 strings catalogued; the screens are not wired yet",
    g:'Localisation', n:'GNU gettext',            w:'String catalogue — the English is the key',         ex:"msgid \"Save\"", exWhy:"The English IS the key, so an untranslated label shows correct English rather than a leaked <code>btn.save.label</code>.",
    s:'part',
    note:'Primitive and a 449-entry catalogue exist; the call sites are not wrapped yet.',
    at:'Localisation · language', go:'locale', why:'A translator can be handed a file instead of a codebase.' },

  { id:'wcag-1.4.3', pa:'settings', a:'look', k:'std', c:['GLOBAL'],
    p:"Text is readable in every theme — measured, not guessed",
    g:'Accessibility', n:'WCAG 2.2 — 1.4.3', w:'Text contrast, measured not asserted',           ex:"#494F56 on #FFFFFF = 8.11:1", exWhy:"A number, not an opinion. Anyone can recompute it from the two hex values and check our claim in a minute.",
    s:'live',
    note:"All 16 themes are checked by the theme-contrast test (WCAG 2.x AA, 4.5:1), 0 failures. Until 14 Oct 2026 this row also claimed 1.4.6; the test measures AA only, so 1.4.6 is its own row below.",
    at:'Appearance · themes', go:'appearance', why:'⭐ It found 117 real contrast failures in themes that had shipped and that nobody had caught by eye — including body text at 2.57:1 in the smallest font.' },
  /* STDREG1 (14 Oct 2026): 1.4.6 (enhanced contrast, 7:1) split out of the 1.4.3 row — nothing measures it, so it is not In force */
  { id:'wcag-1.4.6', pa:'settings', a:'look', k:'std', c:['GLOBAL'],
    p:"Extra-strong contrast for readers with low vision",
    m:"Not tested; our check stops at 4.5:1",
    g:'Accessibility', n:'WCAG 2.2 — 1.4.6', w:'Enhanced text contrast, 7:1 (level AAA)',
    ex:"7:1 or more (AA asks 4.5:1)", exWhy:"The 1.4.3 example above would pass 7:1, but no test measures every theme against it — so we do not claim it.",
    s:'plan',
    note:"The theme-contrast test measures the AA level (4.5:1). Some themes may already reach 7:1; none is checked. Missing: the same measurement at 7:1, and a theme that promises it.",
    at:'Appearance · themes', go:'appearance', why:'A claim the test does not measure is a guess; this row stays Planned until the test says otherwise.',
    added:'2026-10-14' },
  { id:'wcag-1.4.4', pa:'settings', a:'look', k:'std', c:['GLOBAL'],
    p:"Text can grow and nothing breaks",
    m:"Our 132% setting is tested; 200% is not",
    g:'Accessibility', n:'WCAG 2.2 — 1.4.4',      w:'Resize text to 200% without loss of function',      ex:"--fs-3: 14px → 18.5px", exWhy:"The whole scale multiplies, so a heading stays bigger than a caption at our largest setting, 132%.",
    s:'part',
    note:"What we test: the Extra large text size (132%) applies across the scale (e2e/tests/ux.spec.js, the text-size test). The rule asks for 200% — the browser's zoom — and no walk checks the screens at 200% yet.",
    at:'Appearance · text size', go:'appearance', why:'Someone can keep using the product as their eyes change, instead of leaving it.' },
  { id:'wcag-2.3.3', pa:'settings', a:'look', k:'std', c:['GLOBAL'],
    p:"Animation can be switched off for those it bothers",
    g:'Accessibility', n:'WCAG 2.2 — 2.3.3',      w:'Animation from interactions can be turned off',     ex:"prefers-reduced-motion: reduce", exWhy:"Set once in Windows or iOS; every well-behaved site honours it. You never tell us separately.",
    s:'live',
    at:'Appearance · motion', go:'appearance', why:'Movement triggers migraine and vertigo. Honouring the OS setting means nobody has to ask us separately.' },
  { id:'wcag-audit', pa:'settings', a:'look', k:'std', c:['GLOBAL'],
    p:"Usable by keyboard and screen reader",
    m:"No independent audit has been run",
    g:'Accessibility', n:'WCAG 2.2 — full audit', w:'Keyboard, focus order, names and roles',            ex:"—", exWhy:"Nothing to show here yet, and that is the point of the status: no independent audit has been run.",
    s:'part',
    note:'Keymap and focus states exist; no independent audit has been run.',
    at:'Whole product', go:'appearance', why:'The part we cannot honestly claim yet — which is why it says so.' },
  { id:'okabe-ito', pa:'settings', a:'look', k:'prac', c:['GLOBAL'],
    p:"Colours a colour-blind reader can still tell apart",
    g:'Accessibility', n:'Okabe–Ito',             w:'Colour-universal palette for colour blindness',     ex:"#0072B2 blue · #D55E00 vermillion", exWhy:"A published pair that stays distinguishable under deuteranopia, protanopia and tritanopia — unlike the green/red pair everyone reaches for.",
    s:'live',
    at:'Appearance · Colour Vision theme', go:'appearance', why:'Ends the argument about which colours to use — a published palette proven distinguishable under every type of colour blindness.' },
  { id:'css-logical', pa:'locale', a:'look', k:'std', c:['GLOBAL'],
    p:"Right-to-left languages such as Arabic lay out correctly",
    g:'Accessibility', n:'CSS Logical Properties', w:'Right-to-left layout without a second stylesheet', ex:"margin-inline-start: 12px", exWhy:"Mirrors automatically in Arabic. <code>margin-left</code> would have needed a second stylesheet nobody maintains.",
    s:'live',
    note:'378 physical properties converted.',
    at:'Whole product', go:'appearance', why:'Arabic became possible in one sweep instead of a parallel stylesheet nobody would maintain.' },

  { id:'rfc7386', pa:'catalogue', a:'build', k:'std', c:['GLOBAL'],
    p:"Product changes from many sources merge cleanly",
    g:'Records & data', n:'RFC 7386',             w:'JSON merge-patch for catalogue golden records',     ex:"{ \"price\": { \"amount\": 1300 }, \"notes\": null }", exWhy:"Changes the price and DELETES the notes. Fields you do not mention are untouched — so two parties can edit the same record without overwriting each other.",
    s:'live',
    at:'Catalogue · golden records', go:'catalogue', why:'Two parties can update different fields of the same record without silently overwriting each other.' },
  { id:'gs1-gtin', pa:'catalogue', a:'sell', k:'std', c:['GLOBAL'],
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
  { id:'pim', pa:'catalogue', a:'sell', k:'prac', c:['GLOBAL'],
    p:"Product details kept in one place; every channel reads it",
    g:'Records & data', n:'PIM (discipline)',     w:'One place holds product information; every channel reads it', ex:"name · unit · price · images · codes", exWhy:"The fields a buyer sees, held once instead of per storefront.",
    s:'live',
    note:'A practice, not a wire format — there is nothing to conform to.',
    at:'Catalogue', go:'catalogue', why:'A price edited in one place and stale in three others is how two parties end up quoting different numbers for the same item.' },
  { id:'mdm-golden-record', pa:'catalogue', a:'sell', k:'prac', c:['GLOBAL'],
    p:"One true record per product, however many lists describe it",
    g:'Records & data', n:'MDM · golden record',  w:'One authoritative record per real product, however many sources describe it', ex:"blueprint + ERP + CSV + capture → 1 item", exWhy:"Four sources, one item, keyed by SKU.",
    s:'live',
    note:'A practice, not a wire format. The merge itself is RFC 7386 (above).',
    at:'Catalogue · golden records', go:'catalogue', why:'Without it, importing the same list twice gives you two of every product and no way to tell which one a chit cited.' },
  { id:'ubl-peppol', pa:'tasks', a:'sell', k:'std', c:['GLOBAL'],
    p:"Your invoice can be read by systems abroad",
    m:"Mapped field for field; not produced yet",
    g:'Records & data', n:'UBL 2.1 · PEPPOL BIS Billing 3.0 (invoice abroad)', w:'The world\'s invoice document: our frozen invoice block (the GST e-invoice schema) maps to it field for field', ex:"AssVal → TaxExclusiveAmount · Unit KGS → unitCode KGM · the offer → AllowanceCharge", exWhy:"A buyer outside GST receives the same frozen numbers in the document their system already reads; nothing is recomputed on the way out.",
    s:'plan',
    note:'Mapped (C:\\dev\\catalogue\\UBL-MAPPING-2026-09-05.md), not rendered. Missing: an EndpointID per party (ISO 6523 scheme + id), a seller invoice series per GSTIN/VAT id, the tax-category table per scheme (S/Z/E/AE). Built when a counterparty outside GST asks.',
    at:'Chit · Invoice tab', go:'task', why:'One frozen invoice, two dialects: INV-01 for the GST portal, UBL for everyone else — the numbers never differ.' },
  { id:'unece-rec20', pa:'catalogue', a:'sell', k:'law', c:['IN', 'GLOBAL'],
    p:"Units printed the way GST and the world both expect",
    g:'Records & data', n:'GST UQC + UN/ECE Rec 20 (units)', w:'One unit, three names: ours · the Rec 20 code the world uses · the GST Unit Quantity Code an Indian invoice prints', ex:"kg → KGM → KGS · bag → BG → BAG", exWhy:"The connector maps a Tally unit to ours by the code, not the spelling; the invoice and GSTR carry the UQC.",
    s:'live',
    note:'app/units.js (vendored from the API): 22 units with Rec 20 and UQC codes and their common spellings; unknown spellings are never guessed. ⚠️ This row said "live" for months while lib/tax-lines.js filed the seller\'s own word ("packet") into a GSTR HSN row as the code — the register was ahead of the code. Wired 2026-09-10: tax-lines maps through lib/units and anything unmappable stays OTH, which the portal accepts.',
    at:'Catalogue setup · Columns · Units', go:'catsetup', why:'A unit named three ways across two systems is three units until someone maps them; the code is what makes it one.' },
  /**
   * ⭐ PAYMENT IS NOT MONEY. ISO 4217 says what a figure IS; these say how a shop gets PAID, and there is no single
   * answer — which is the whole point of declaring them separately.
   */
  { id:'emvco-qr', pa:'till', a:'money', k:'std', c:['GLOBAL'],
    p:"One QR format payment apps worldwide can read",
    m:"Not built",
    g:'Commercial', n:'EMVCo QR (MPM)',        w:'Merchant-presented QR — the format PIX · PayNow · PromptPay · DuitNow · BharatQR · HKQR are all profiles of', ex:"TLV: 00 02 01 · 26 … · 54 06 140.00", exWhy:"Published in 2017 to stop every country inventing its own code. One encoder reaches six national rails.",
    s:'plan',
    note:'NOT implemented. Named here because the counter\'s QR is dispatched per SCHEME (lib/profile PAY_SCHEMES), so this is a row in that table rather than a rewrite. Today only the India scheme is encoded.',
    at:'Counter · how the bill is paid', go:'till', why:'Without it, reaching Brazil or Singapore means writing a second QR generator; with it, one.' },
  { id:'upi-deeplink', pa:'till', a:'money', k:'std', c:['IN'],
    p:"Customers pay by UPI with the amount already filled in",
    g:'Commercial', n:'NPCI UPI deep link',    w:'upi://pay — the payee, amount and reference a UPI app reads',     ex:"upi://pay?pa=shop@okhdfc&am=140.00&cu=INR&tn=CB-C1-0007", exWhy:"India only, and the same string the storefront already builds — so a customer scanning at the counter and one scanning online reach the same payee with the same reference.",
    s:'live',
    note:'lib/profile PAY_SCHEMES.upi, encoded by the counter and the storefront from one shape. The money moves bank to bank; nothing passes through ChitBridge and nothing here confirms a payment.',
    at:'Counter · Storefront', go:'till', why:'A shop with no card terminal can still be paid without cash, and a QR needs no internet to draw.' },
  { id:'iso18004-qr', pa:'till', a:'money', k:'std', c:['GLOBAL'],
    p:"The QR code prints and scans reliably",
    g:'Commercial', n:'ISO/IEC 18004',         w:'The QR symbology itself — how a string becomes a printable code', ex:"version 0 · error correction M", exWhy:"The symbol standard beneath every payment QR. We encode, we do not invent: qrcode-generator 1.4.4 (MIT), vendored so a till with no internet can still draw one.",
    s:'live',
    note:'app/../engine/qr.js — the one third-party file on the till, pinned in package.json so an upgrade shows in a diff.',
    at:'Counter · how the bill is paid', go:'till', why:'A hand-rolled encoder would be a wrong QR that takes money somewhere else.' },
  /* ⚠️ NOT a standards body, but an adopted CONTRACT all the same — and the reason the search box does not fight the typist */
  { id:'aria-combobox', pa:'till', a:'look', k:'std', c:['GLOBAL'],
    p:"The counter search never picks an item you did not choose",
    m:"Followed at the counter; not audited",
    g:'Accessibility', n:'WAI-ARIA APG · combobox', w:'List autocomplete with MANUAL selection',                    ex:"aria-autocomplete=\"list\"", exWhy:"\u201CThe character string the user has typed will become the value unless the user selects a value in the popup\u201D — so arrowing through the list never overwrites what was typed.",
    s:'part',
    note:'The behaviour is followed at the counter: the search box is a COMMAND box, so a chosen product goes to the cart and the query is cleared, never replaced. ⚠️ Missing: aria-activedescendant, so a screen reader is not told which row is marked.',
    at:'Counter · the search box', go:'till', why:'Filling the box on every arrow press destroys the query — arrow past your item and your typing is gone.' },
  { id:'schema-org-availability', pa:'catalogue', a:'sell', k:'std', c:['GLOBAL'],
    p:"“In stock” means the same thing outside our app",
    g:'Records & data', n:'schema.org ItemAvailability', w:'What a product\'s status MEANS outside our walls',       ex:"available → https://schema.org/InStock", exWhy:"Three of our four map directly. The human words stay the screen vocabulary — a trader says \u201Cnot available\u201D, not a URL — and the standard value travels beside them.",
    s:'live',
    note:'lib/itemstatus.js SCHEMA_ORG. ⚠️ We are deliberately FINER than the standard in one place: schema.org has a single Discontinued, which conflates \u201Cwe stopped selling it\u201D with \u201Cuse that one instead\u201D; the second carries a successor and is worth acting on, so retired and redundant stay apart and both export as Discontinued.',
    at:'Catalogue · a product\'s status', go:'catalogue', why:'A status only we understand is a status no storefront, feed or buyer can act on.' },
  { id:'gs1-gdsn', pa:'catalogue', a:'buy', k:'std', c:['GLOBAL'],
    p:"Share product data with other companies on the same codes",
    m:"Not built; the GS1 codes it needs are in place",
    g:'Records & data', n:'GDSN',                 w:'Sharing product data BETWEEN companies, on GS1 identity', ex:"GS1 data pools", exWhy:"The network suppliers and retailers already use to exchange item data.",
    s:'plan',
    note:'Not implemented. The identity it needs (GS1) is carried already, which is what makes it reachable later.',
    at:'Catalogue · cross-company', go:'catalogue', why:'The same discipline as our own catalogue, one boundary further out — worth naming so it is a decision, not an oversight.' },
  { id:'lei', pa:'registration', a:'people', k:'std', c:['GLOBAL'],
    p:"A company’s global ID can be recorded",
    m:"Not checked against GLEIF yet",
    g:'Records & data', n:'ISO 17442 (LEI)',      w:'Legal Entity Identifier',                         ex:"5493001KJTIIGC8Y1R12", exWhy:"20 characters that identify one legal entity globally. Checkable against GLEIF — which we do not yet do, hence \"partly\".",
    s:'part',
    note:'A field exists to record it; the value is not verified against GLEIF.',
    at:'Trade readiness', go:'readiness', why:'The same company recognised across registers and borders.' },
  { id:'iso6523', pa:'registration', a:'people', k:'std', c:['GLOBAL'],
    p:"A company ID says which register it came from",
    m:"Not built; IDs are kept without their register",
    g:'Records & data', n:'ISO 6523',             w:'Organisation identifier SCHEME, so an id says which register it came from', ex:"0195:198912345K", exWhy:"<b>Scheme first.</b> \"198912345K\" alone is meaningless; <code>0195</code> says it is a Singapore UEN. The scheme is the half everyone drops.",
    s:'plan',
    at:'Profile · identity', go:'readiness', why:'"GSTIN 29ABC" means nothing until you know it is a GSTIN. The scheme is the half everyone drops.' },
  { id:'un-locode', pa:'network', a:'buy', k:'std', c:['GLOBAL'],
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
  { id:'iso24760', pa:'signin', a:'people', k:'std', c:['GLOBAL'],
    p:"Clear words for who someone is and what they hold",
    m:"Its words are used; its lifecycle model is not",
    g:'Identity & access', n:'ISO/IEC 24760', w:'The IAM vocabulary — identity · identifier · attribute',
    s:'part', note:'We use its distinctions; we do not implement its lifecycle model.',
    ex:'bridge_id = identifier · display_name = attribute · the entity = identity',
    exWhy:'⭐ This is the distinction the IAM page is built on. A Bridge ID is not an identity and a name is not an identifier — conflating them is what made "Identity" the wrong name for a page about five different kinds of party.',
    at:'IAM', go:'identity', why:'Gives us the words for the thing we kept getting wrong: an identifier is not an identity.' },
  { id:'rbac', pa:'signin', a:'people', k:'std', c:['GLOBAL'],
    p:"Staff see and do only what their role allows",
    m:"Five fixed roles; no custom permissions yet",
    g:'Identity & access', n:'RBAC (ANSI INCITS 359)', w:'Role-based access — coarse, five roles',
    s:'part', note:'The hat IS role-based, but roles are fixed and not composable; there is no permission-to-role assignment.',
    ex:'view_only · act · audit · mis · manager',
    exWhy:'One role per co-assist, enforced on every write since 2026-08-18. Not fine-grained: you cannot grant "may edit catalogue but not send chits".',
    at:'IAM · Co-assists', go:'coassists', why:'⭐ An owner can answer "what can this person do" in one word, which is the whole point of roles over permission lists.' },
  { id:'nist-800-63b', pa:'signin', a:'people', k:'std', c:['GLOBAL'],
    p:"Sign-in with a one-time code to a verified phone or email",
    m:"AAL1: one factor; a second step for owners is planned",
    g:'Identity & access', n:'NIST SP 800-63B', w:'Authentication assurance',
    s:'part', note:'A one-time code to a verified channel is one factor, which NIST calls AAL1 (this row said "about AAL2" until 14 Oct 2026). AAL2 needs a second factor — the owners\' second step (the ISO/IEC 27001 A.8.5 row). We do not claim an audited level.',
    ex:'ravi@alpha-timers + a one-time code',
    exWhy:'Possession of the channel proves identity. No password to leak, reuse or phish — which is why there is no password reset flow to attack.',
    at:'Sign-in', go:'', why:'States honestly what our sign-in does and does not prove.' },
  /* ⚠️ NOT OURS, and saying so is the point of the question. */
  { id:'scim', pa:'signin', a:'people', k:'std', c:['GLOBAL'],
    p:"Staff accounts could come straight from an HR system",
    m:"Not built",
    g:'Identity & access', n:'SCIM (RFC 7644)', w:'Provisioning identities from an HR system',
    s:'plan', ex:'—',
    exWhy:'Not built. It matters only when a customer wants their HR system to create and remove co-assists automatically — real for a large operator, irrelevant to a shop.',
    at:'Co-assists — where it would provision', go:'coassists',
    why:'Removes the manual add/remove step for a business that already runs an HR system.' },
  { id:'oauth2-oidc', pa:'signin', a:'people', k:'std', c:['GLOBAL'],
    p:"Your connector reaches Zoho Books with Zoho's own sign-in; ours stays our own",
    m:"Used to reach Zoho; sign-in to us is not federated, on purpose",
    g:'Identity & access', n:'OAuth 2 · OIDC', w:'Delegated access to another system; federated sign-in',
    s:'part', ex:'Authorization: Zoho-oauthtoken …',
    note:'In use: the connector reaches Zoho Books with an OAuth 2 access token and refreshes it (chitbridge-api tools/tally-connector/adapters/zoho.js, proven on a stand-in by tests against fake-zoho). Not adopted: OpenID Connect sign-in to ChitBridge — see below.',
    exWhy:'⚠️ Deliberately not adopted. We ISSUE credentials rather than delegating to an identity provider — a chit is signed by a party we authenticated, and federating that would put a third party between a business and its own record.',
    at:'Sign-in — where it would replace our own', go:'',
    why:'Would let people sign in with an existing account — at the cost of who vouches for the signature on a chit.' },

  { id:'jwt', pa:'signin', a:'build', k:'std', c:['GLOBAL'],
    p:"Your session is a sealed, standard token",
    g:'Platform',     n:'RFC 7519 (JWT)',         w:'Session tokens',                                    ex:"eyJhbGciOiJIUzI1NiJ9.…", exWhy:"Three base64 parts: header, claims, signature. Any reviewer can decode the middle one and see exactly what we assert about a session.",
    s:'live',
    at:'Sign-in', go:'', why:'A credential format every reviewer already knows how to audit.' },
  { id:'idempotency-key', pa:'api', a:'build', k:'prac', c:['GLOBAL'],
    p:"Saving twice — or replaying after going offline — never saves twice",
    g:'Platform',     n:'Idempotency-Key',        w:'A mutation runs at most once, even on replay',      ex:"Idempotency-Key: 9f2c…a41", exWhy:"Send the same order twice after a dropped connection and the second is recognised and ignored. Without it, offline replay would be unsafe to offer.",
    s:'live',
    at:'Every mutation · offline replay', go:'', why:'⭐ A retry after a dropped connection cannot double-send an order. Without it, offline queueing would be unsafe to offer at all.' },
  { id:'postgres-rls', pa:'compliance', a:'people', k:'prac', c:['GLOBAL'],
    p:"Another business can never read your records",
    g:'Platform',     n:'PostgreSQL RLS',         w:'Tenant isolation enforced by the database',         ex:"USING (entity_id = current_setting(...))", exWhy:"The database refuses rows from another tenant even if the query forgets to filter. Isolation that survives a mistake in application code.",
    s:'live',
    note:'FORCE RLS on the entity-data tables; identities is a documented carve-out for cross-tenant discovery.',
    at:'Every entity-scoped read', go:'', why:'Isolation that survives a mistake in application code, because the database refuses rather than trusting the query.' },

  { id:'incoterms', pa:'tasks', a:'buy', k:'std', c:['GLOBAL'],
    p:"Who pays freight and where risk passes, agreed in writing",
    m:"Carried on forms; not checked against the shipment",
    g:'Commercial',   n:'Incoterms 2020 (ICC)',   w:'Who bears cost and risk, and to what point',        ex:"FOB Chennai (Incoterms 2020)", exWhy:"Risk and cost pass to the buyer once the goods are on board at Chennai. Three words that decide who pays if the container is damaged mid-ocean.",
    s:'part',
    note:'Carried on instruments and forms; not yet enforced against the shipment record.',
    at:'Chits · instruments', go:'', why:'⭐ Who pays freight and where risk passes, agreed in writing BEFORE the dispute rather than argued after it.' },
  { id:'ucp600', pa:'finance', a:'buy', k:'std', c:['GLOBAL'],
    p:"Letters of credit checked by the rules banks use",
    m:"Not built",
    g:'Commercial',   n:'UCP 600 · ISBP 745',     w:'Documentary credits',                               ex:"—", exWhy:"Not built. When it is, it is the ruleset a bank checks the documents against before releasing payment.",
    s:'plan',
    at:'Instruments', go:'', why:'The rules a bank will actually check the documents against.' },
  { id:'wco-hs', pa:'catalogue', a:'sell', k:'std', c:['GLOBAL'],
    p:"The customs code on your goods — set by you, not at the border",
    m:"India's HSN is carried and filed; export HS not checked",
    g:'Commercial',   n:'HS codes (WCO)',         w:'Tariff classification on goods',                    ex:"0904.11", exWhy:"<b>Pepper, whole.</b> Customs charges duty on THIS, not on your product name — so a seller who states it decides the tariff instead of discovering it at the border.",
    s:'part',
    note:"In force for India: the HSN (India's reading of HS) rides on every chit line from the catalogue and is filed in the GSTR-1 HSN summary (chitbridge-api lib/tax-lines.js decorate). Missing: the code is not checked against the WCO list, and nothing asks for the 6-digit HS an export needs. The HSN / SAC row says what India's invoice rule asks.",
    at:'Catalogue · goods', go:'catalogue', why:'What customs charges, decided by the seller rather than discovered at the border.' },
  { id:'iso20022', pa:'finance', a:'money', k:'std', c:['GLOBAL'],
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
  { id:'double-entry', pa:'accounts', a:'books', k:'prac', c:['GLOBAL'],
    p:"Every entry’s Dr and Cr placed by rule, shown before you save",
    g:"Books", n:"Golden rules of double entry", w:"Personal · real · nominal: where each line’s Dr and Cr go",
    ex:"Personal: debit the receiver, credit the giver",
    s:"live",
    at:"＋ Entry · the preview",
    go:"entry",
    why:"A rule the CA can check line by line, instead of trusting the software.",
    added:'2026-10-03' },
  { id:'in-audit-trail', pa:'accounts', a:'books', k:'law', c:['IN'],
    p:"Books cannot be edited quietly: fixes are reversals and every change is logged",
    g:"Books", n:"Companies Act 2013 s.128 + Rule 3(1), Accounts Rules", w:"Audit trail, from 1 Apr 2023",
    ex:"Rule 3(1) proviso: an edit log that cannot be switched off",
    s:"live",
    at:"Day book · Audit trail",
    go:"daybook",
    why:"The law since 1 April 2023 — and the reason a CA can sign off without re-checking every entry.",
    added:'2026-10-03' },
  { id:'schedule-iii', pa:'accounts', a:'books', k:'law', c:['IN'],
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
  { id:'as2-inventories', pa:'accounts', a:'books', k:'std', c:['IN'],
    p:"Closing stock valued at the lower of cost and selling value",
    limit:"Manual count today; automatic once quantities are tracked",
    eq:"IAS 2 abroad",
    g:"Books", n:"AS 2 / Ind AS 2", w:"Inventories",
    s:"live",
    at:"Month & year end · Closing stock",
    go:"closingstock",
    why:"Stops profit being overstated by stock that will not sell at cost.",
    added:'2026-10-03' },
  { id:'in-depreciation', pa:'accounts', a:'books', k:'law', c:['IN'],
    p:"Assets depreciated the right way for your type of business",
    eq:"IAS 16 abroad",
    g:"Books", n:"AS 10 / Ind AS 16 + Schedule II; Income-tax Act s.32 + Appendix I", w:"Assets and depreciation, by type of business; WDV and the 180-day rule",
    s:"live",
    at:"Month & year end · Assets & depreciation",
    go:"assets",
    why:"One asset, two correct numbers — the books’ and the tax return’s — kept side by side.",
    added:'2026-10-03' },
  { id:'tally-voucher-types', pa:'accounts', a:'books', k:'prac', c:['IN'],
    p:"Entries numbered by type — sales, purchase, receipt… — as your CA expects",
    g:"Books", n:"Tally voucher types", w:"Sales, Purchase, Receipt, Payment, Contra, Credit/Debit note, Journal",
    ex:"SV · PV · RV · PY · CV · CN · DN · JV · MJ",
    s:"live",
    at:"Day book",
    go:"daybook",
    why:"The series every Indian CA already reads; nothing to learn.",
    added:'2026-10-03' },
  { id:'sa505', pa:'accounts', a:'books', k:'std', c:['IN'],
    p:"Each party’s balance confirmed with the party, month by month",
    m:"Not built; monthly agreement with each party is next",
    eq:"ISA 505 abroad",
    g:"Books", n:"SA 505 (external confirmations)", w:"Party balance confirmation; monthly mutual reconciliation",
    s:"plan",
    at:"Ledgers · a party",
    go:"ledgers",
    why:"A balance both sides have agreed is evidence; one side’s balance is a claim.",
    added:'2026-10-03' },
  { id:'sa240', pa:'accounts', a:'books', k:'std', c:['IN'],
    p:"Hand-made entries are numbered MJ, so they are checked first",
    eq:"ISA 240 abroad",
    g:"Books", n:"SA 240 (fraud risk)", w:"Manual journals are tested first",
    s:"live",
    at:"Day book · filter MJ",
    go:"daybook",
    why:"Where an auditor looks first for fraud, the app makes the looking easy.",
    added:'2026-10-03' },
  { id:'cgst-s49', pa:'accounts', a:'money', k:'law', c:['IN'],
    p:"GST credit used in the legal order; CGST and SGST never cross",
    g:"Money & GST", n:"CGST Act s.49 / 49A / 49B, Rule 88A", w:"The order GST credit is used in",
    s:"live",
    at:"Month & year end · GST close & pay",
    go:"gstclose",
    why:"Using credit in the wrong order means paying cash you did not owe.",
    added:'2026-10-03' },
  { id:'gst-rcm', pa:'accounts', a:'money', k:'law', c:['IN'],
    p:"Reverse-charge GST worked out, and paid in cash as the law requires",
    limit:"Worked out by the engine; the screens follow",
    g:"Money & GST", n:"CGST Act s.9(3)/9(4) + notifications; s.49(4), Rule 86(2)", w:"Reverse charge, paid in cash only",
    s:"live",
    at:"Bills · Returns",
    go:"returns",
    why:"Reverse charge cannot be paid from credit; getting it wrong is interest and a notice.",
    added:'2026-10-03' },
  { id:'gst-cess', pa:'accounts', a:'money', k:'law', c:['IN'],
    p:"Cess posted on its own; cess credit pays only cess",
    g:"Money & GST", n:"GST (Compensation to States) Cess Act 2017, s.11(2)", w:"Cess and cess credit",
    s:"live",
    at:"GST close & pay",
    go:"gstclose",
    why:"Cess credit spent on GST is a mismatch the department will find.",
    added:'2026-10-03' },
  { id:'gstr-1-3b', pa:'accounts', a:'money', k:'law', c:['IN'],
    p:"Returns built from your own bills and matched to the Ledger",
    m:"Built; filing through a GSP is not connected",
    g:"Money & GST", n:"GSTR-1 / GSTR-3B (GSTN schema)", w:"Monthly returns",
    s:"part",
    at:"GST · Returns",
    go:"returns",
    why:"A return that comes from the bills cannot disagree with them.",
    added:'2026-10-03' },
  { id:'gstr-2b', pa:'accounts', a:'money', k:'law', c:['IN'],
    p:"Input credit claimed only when your supplier has filed",
    m:"Matching built; its screen comes next",
    g:"Money & GST", n:"CGST Act s.16(2)(aa) + GSTR-2B", w:"Input credit only when the supplier filed",
    s:"part",
    at:"GST · 2B match",
    go:"twobmatch",
    why:"Credit claimed before the supplier files is credit you may have to pay back with interest.",
    added:'2026-10-03' },
  { id:'einvoice-ewaybill', pa:'accounts', a:'money', k:'law', c:['IN'],
    p:"e-invoices and e-way bills prepared and checked",
    m:"No GSP connection yet (decision pending)",
    eq:"PEPPOL BIS abroad (see UBL)",
    g:"Money & GST", n:"e-invoice INV-01 schema 1.1 (IRP); e-way bill, Rule 138", w:"e-invoice and e-way bill payloads",
    s:"part",
    at:"GST · e-invoice / e-way bill",
    go:"einvoice",
    why:"Above the turnover limit an invoice without an IRN is not a valid invoice.",
    added:'2026-10-03' },
  { id:'cgst-s50', pa:'accounts', a:'money', k:'law', c:['IN'],
    p:"Interest on late GST worked out for you",
    g:"Money & GST", n:"CGST Act s.50", w:"Interest on late GST",
    s:"live",
    at:"GST close & pay",
    go:"gstclose",
    why:"So the interest is known before the department says it.",
    added:'2026-10-03' },
  { id:'dpdp-2023', pa:'crm', a:'people', k:'law', c:['IN'],
    p:"Customer data used only for its purpose, with consent; people can see, correct or erase theirs",
    m:"Consent and request records built, not yet switched on; no notice yet",
    eq:"Like the GDPR in the EU",
    g:"People & privacy", n:"Digital Personal Data Protection Act 2023", w:"Purpose, consent, the right to see, correct and erase",
    s:"part",
    note:"Since 13 Oct 2026: consent per channel and purpose is kept as rows that are never edited (s.6(10): the proof is ours to give), and every request to see, correct or erase gets the date the law sets. Both need migrations b306 and b307, which the owner runs. The privacy notice itself is the owner's to publish. Most operative duties start 13 May 2027 (DPDP Rules 2025).",
    at:"CB CRM · a party › consent; privacy requests",
    go:"crm",
    why:"No scraping, no guessing sensitive facts: the customer’s data stays theirs.",
    added:'2026-10-03' },
  { id:'rbi-aa', pa:'finance', a:'money', k:'law', c:['IN'],
    p:"Bank statements fetched with your consent, not typed in",
    m:"Not built; decision pending (FIU)",
    g:"Money & GST", n:"RBI Account Aggregator (ReBIT FI schema)", w:"Bank statements by consent",
    s:"plan",
    at:"Daily · Bank (reconcile)",
    go:"bank",
    why:"Statements straight from the bank cannot be mistyped.",
    added:'2026-10-03' },
  /* CPS1 (2026-10-13): OUR standard for what a country pack carries — the matrix the opened row shows is READ from data/country-matrix.json, the vendored copy of
     chitbridge-engines docs/COUNTRY-MATRIX.json (generated by node tools/country-matrix.cjs --web <web dir>); the page keeps no copy and paints what the engines computed */
  { id:'country-standard', pa:'country', a:'books', k:'prac', c:['IN', 'AU', 'AE'],
    p:"What is a country's own and what is core is written down once; every country pack is checked against it",
    limit:"three packs today — India, Australia, the Emirates; the matrix shows what each still lacks",
    g:'Books', n:'Country Standard (chitbridge-engines docs/COUNTRY-STANDARD.md)', w:'What “country-specific” means — identity · money · time · tax · returns · books · formats · e-invoicing · payroll — and what is core and never country-specific',
    ex:"node tools/country-matrix.cjs", exWhy:"The matrix in the opened row is GENERATED from the packs by this command, never typed: a cell is ✅ present, ⚠️ partly (the pack's own sentence), ❌ missing or — out of scope (the pack's own reason). A test in the engines fails when the matrix is stale or a pack carries a member the standard does not name.",
    s:'live',
    at:'Country setup (after registration) · Books',
    why:'A country rule that lands in core code is copied into every country, and each copy drifts. Writing down what is country-specific, and checking every pack against it, is how a new country stays one file.',
    matrix:'country',
    added:'2026-10-13' },
  /* LOC0 (2026-10-13): the locale standard and its guard — docs/design/standards/LOCALE-STANDARD.md */
  { id:'pseudo-locale', pa:'locale', a:'look', k:'prac', c:['GLOBAL'],
    p:"Every word on the screen can change language — and a test says which cannot yet",
    m:"Screens convert by the plan (till and bill first); server sentences carry no key yet",
    g:'Localisation', n:'Pseudo-localisation (Microsoft qps-ploc · Unicode)', w:'The locale standard (docs/design/standards/LOCALE-STANDARD.md) and its guard',
    ex:"[!! Ŝàļéš !!]", exWhy:"What a label becomes in the pseudo-locale: accented, 40 % longer, bracketed. On one screen it shows which words did NOT go through the catalogue, and which boxes clip when German or Tamil arrives.",
    s:'part',
    note:'e2e/walk-locale.cjs opens every customer screen in qps at 1366 and 390 and holds a per-screen count of untranslated and clipped text (e2e/locale-baseline.json); the build fails when a count rises. The standard fixes the rules: whole sentences with placeholders and Intl plural rules, never concatenation; icons universal, only directional ones mirrored; the fallback chain to English, never blank; server sentences keyed; names, amounts and user data never translated.',
    at:'docs/design/standards/LOCALE-STANDARD.md · e2e/walk-locale.cjs', go:'locale', why:'A translator can only translate what reaches the catalogue; a pseudo-locale shows the rest before a customer in Dubai or Coimbatore does.',
    added:'2026-10-13' },
  /* ⭐ CO3 (2026-10-13) — record-keeping, from docs/research/COMPLIANCE-OBLIGATIONS-2026-10.md K3 · K8. Evidence: api docs/compliance/RECORD-KEEPING.md.
     Appended AFTER the 61 rows the design snapshot holds and the rows adopted since (CPS1 · LOC0); e2e/standards-page.cjs names these four as CO3. */
  { id:'in-records-retention', pa:'compliance', a:'books', k:'law', c:['IN'],
    p:"Every bill and entry kept at least nine years, whatever a setting says",
    m:"Older copies lengthen when the owner runs b305",
    g:"Books", n:"Companies Act 2013 s.128(5) · CGST Act s.36, Rules 56–57", w:"Keep the books 8 years; GST records 72 months",
    ex:"A copy made today is kept until 2035",
    s:"part",
    note:"The 9-year floor is applied to every new copy and no setting lowers it; nothing is ever deleted inside it. Proof: tests/records-keeping.test.cjs (api).",
    at:"Day book · Audit trail",
    go:"daybook",
    why:"An officer may ask for a bill from years ago; it must still be there.",
    added:'2026-10-13' },
  { id:'in-books-in-india', pa:'compliance', a:'books', k:'law', c:['IN'],
    p:"Your books are held in India, with a daily backup there too",
    m:"Backup schedule and a restore test not yet shown",
    g:"Books", n:"Companies (Accounts) Rules r.3(5)–(6)", w:"Books in electronic form: daily backup on servers in India",
    s:"part",
    note:"The database runs in Mumbai, India (ap-south-1). A company files the provider's name and server location each year; ours are written up in the api's docs/compliance.",
    at:"The record-keeping note (api docs)",
    go:"",
    why:"A company must name where its books are kept, every year.",
    added:'2026-10-13' },
  { id:'au-records-retention', pa:'compliance', a:'books', k:'law', c:['AU'],
    p:"Tax and company records kept the years the law asks",
    m:"Records are held in India, not Australia",
    g:"Books", n:"TAA 1953 Sch 1 s.382-5 · Corporations Act 2001 s.286", w:"Keep tax records 5 years; company records 7",
    s:"part",
    note:"Every copy is kept at least 9 years, longer than both. The data sits in India; an Australian region is the hosting track's.",
    at:"Day book · Audit trail",
    go:"daybook",
    why:"Records the tax office can ask for must outlive the question.",
    added:'2026-10-13' },
  { id:'ae-records-retention', pa:'compliance', a:'books', k:'law', c:['AE'],
    p:"Tax records kept the years the law asks",
    m:"Arabic copies on request not built yet",
    g:"Books", n:"Tax Procedures Decree-Law 28/2022 · Corporate Tax Decree-Law 47/2022 Art. 56", w:"Keep tax records 5 years; corporate tax records 7",
    s:"part",
    note:"Every copy is kept at least 9 years, longer than both. The data sits in India; a UAE region is the hosting track's.",
    at:"Day book · Audit trail",
    go:"daybook",
    why:"Records the tax authority can ask for must outlive the question.",
    added:'2026-10-13' },
  /* ⭐ CO1 · PRIVACY (13 Oct 2026, web docs/research/COMPLIANCE-OBLIGATIONS-2026-10.md §7). One row per law; the evidence is the public
     GET /api/privacy/facts (who holds the data, where), chitbridge-api tests/privacy.test.cjs, and docs/compliance/ (RoPA, DPIA, owner
     actions). Nothing an owner must do (publish a notice, name a contact, sign a contract) is counted as done here. Citations are ◐ in
     the research: a person opens the official text once before any of these says In force. */
  { id:'privacy-processors', pa:'compliance', a:'people', k:'law', c:['IN','AU','AE'],
    p:"You can see who holds your data for us, and in which country",
    m:"List published; contracts with each provider not signed yet",
    eq:"GDPR Art.28 abroad",
    g:"People & privacy", n:"DPDP Act 2023 s.8(2), s.16 · Privacy Act 1988 APP 8 · UAE PDPL Art.22–23", w:"Who processes the data, where it sits, and transfers abroad",
    ex:"Supabase · database · ap-south-1 (Mumbai, India)",
    s:"part",
    note:"The list lives once, in chitbridge-api lib/privacy.js, and /api/privacy/facts answers it to anyone, signed in or not. A region the repo does not state says so, never a guess. All data sits in India today: for a shop in Australia or the UAE that is a transfer abroad, which their notice must say.",
    at:"Privacy facts · /api/privacy/facts",
    why:"A buyer, an auditor or a regulator asks this first; one answer, from the code, cannot drift from what runs.",
    added:'2026-10-13' },
  { id:'it-act-43a', pa:'crm', a:'people', k:'law', c:['IN'],
    p:"A privacy policy and a named person to complain to, answered within a month",
    m:"Policy text and the named officer are the owner's to publish",
    g:"People & privacy", n:"IT Act 2000 s.43A + SPDI Rules 2011, r.4 and r.5(9)", w:"Privacy policy on the website; grievance officer, one month",
    s:"part",
    note:"In force now, until the DPDP Rules replace them. The request register gives every grievance its due date from this rule; the policy and the officer's name are on the owner's action list in docs/compliance.",
    at:"CB CRM · privacy requests",
    go:"crm",
    why:"The duty applies today, not in 2027 — and an unanswered complaint is the first thing a regulator asks about.",
    added:'2026-10-13' },
  { id:'it-intermediary-rules', pa:'crm', a:'people', k:'law', c:['IN'],
    p:"A complaint is answered within 15 days",
    m:"24-hour acknowledgement not tracked; whether it applies is a legal question",
    g:"People & privacy", n:"IT (Intermediary Guidelines) Rules 2021, r.3(2)", w:"Grievance: acknowledge in 24 hours, resolve in 15 days",
    s:"part",
    note:"We may count as an intermediary because we carry records between businesses. Until a lawyer says otherwise the register uses this rule's 15 days for a grievance, the shorter clock.",
    at:"CB CRM · privacy requests",
    go:"crm",
    why:"The stricter clock is safe either way; the looser one is a breach if the law applies.",
    added:'2026-10-13' },
  { id:'dpdp-children', pa:'shop', a:'people', k:'law', c:['IN'],
    p:"No tracking or targeted offers aimed at children",
    m:"No age line at the online store yet",
    g:"People & privacy", n:"DPDP Act 2023 s.9", w:"Children's data: a parent's consent, no tracking",
    s:"plan",
    at:"Online store",
    why:"The store is the one door where a consumer, perhaps a child, reaches us directly.",
    added:'2026-10-13' },
  { id:'au-privacy-apps', pa:'crm', a:'people', k:'law', c:['AU'],
    p:"Customers' data used only for its purpose; offers only with consent; they can see and correct it",
    m:"Consent and requests built, not switched on; no Australian policy yet",
    eq:"Like the GDPR in the EU",
    g:"People & privacy", n:"Privacy Act 1988 (Cth), APPs 1, 5, 6, 7, 12, 13 + Spam Act 2003 s.16", w:"Policy, collection notice, direct marketing, access and correction",
    s:"part",
    note:"A business under A$3M turnover is usually exempt, but every larger shop must hold us to these by contract, so we comply as if covered. Requests get 30 days (the OAIC's usual reading of APP 12).",
    at:"CB CRM · a party › consent; privacy requests",
    go:"crm",
    why:"Our larger Australian shops cannot use a system that would make them break this.",
    added:'2026-10-13' },
  { id:'ae-pdpl-rights', pa:'crm', a:'people', k:'law', c:['AE'],
    p:"Personal data used with consent, and people can see, correct or erase theirs",
    m:"Consent and requests built, not switched on; its regulation not issued",
    eq:"Like the GDPR in the EU",
    g:"People & privacy", n:"UAE PDPL, Federal Decree-Law 45/2021, Art.4–6, 13–18", w:"Consent, the data subject's rights",
    s:"part",
    note:"The Executive Regulation that sets the reply period is not issued, so the register uses 30 days as our own rule and says so. Shops in DIFC or ADGM fall under those free zones' own laws, not covered yet.",
    at:"CB CRM · a party › consent; privacy requests",
    go:"crm",
    why:"Consent we can prove is the lawful basis the law starts from.",
    added:'2026-10-13' },
  { id:'ae-pdpl-ropa', pa:'compliance', a:'people', k:'law', c:['AE'],
    p:"What we process, why, and the risks, written down",
    m:"Drafts written; the owner and a lawyer sign them",
    eq:"GDPR Art.30 and Art.35 abroad",
    g:"People & privacy", n:"UAE PDPL Art.7, Art.20–21", w:"Records of processing; impact assessment",
    s:"part",
    note:"Both are in docs/compliance, one of each for the whole platform. The list of who processes what is read from the code, not copied.",
    at:"docs/compliance",
    why:"The first document any privacy auditor asks for, in every country.",
    added:'2026-10-13' },

  /**
   * ⭐ ROUND CO2 (2026-10-13) — security controls + evidence, from docs/research/COMPLIANCE-OBLIGATIONS-2026-10.md (K5 · K6 · K10) for
   * India, Australia and the UAE. Each row says what is IN FORCE in the product, what is not, and where a reviewer sees the proof
   * (docs/compliance/ · chitbridge-api tests/co2-controls.test.cjs · b315 · vercel.json). An organisational act (registering a
   * contact, a lawyer's wording) is never claimed here — it is a line in docs/compliance/OWNER-ACTIONS.md. Kept AFTER the 61 rows the
   * design data holds, so e2e/standards-page.cjs compares those 61 unchanged and counts these by their `added` date.
   */
  { id:'cert-in', pa:'compliance', a:'build', k:'law', c:['IN'],
    p:"A cyber incident is reported to India’s CERT-In within six hours",
    m:"Contact not registered; logs not yet kept in India",
    g:'Security', n:'CERT-In Directions 2022 (Information Technology Act s.70B(6))', w:'Report in six hours · logs 180 days in India · synced clocks',
    s:'part',
    note:"In force: reporting to CERT-In within six hours is the first clock in the incident runbook, and a critical log line now reaches the on-call channel at once (a webhook, proven by chitbridge-api tests/co2-controls.test.cjs). Not yet: our point of contact is not registered with CERT-In; request logs live in the hosting provider’s console (Singapore, short keeping), not 180 days in India; the server clock is the host’s, not India’s official time. Those three are on the owner’s checklist.",
    at:'Incident runbook · owner’s checklist (docs/compliance)', go:'',
    why:"The directions apply to every service provider in India, ours included; a six-hour clock cannot be met by someone reading logs next week.",
    added:'2026-10-13' },
  { id:'dpdp-breach', pa:'compliance', a:'people', k:'law', c:['IN'],
    p:"Your data is guarded, and a breach is told to you and the Board",
    m:"One-year log keeping and notice wording not done",
    g:'People & privacy', n:'Digital Personal Data Protection Act s.8(5)–(6), Rules 2025 r.6–7', w:'Security safeguards · breach told at once, full report in 72 hours',
    s:'part',
    note:"In force: the database shows each business only its own rows; the bank vault and identity documents are encrypted; sign-ins and access grants are insert-only logs; the incident runbook carries the 72-hour report to the Data Protection Board and the notice to each person. Not yet: logs kept one year, a second sign-in step for owners, and a lawyer’s wording for the notices. Rules 6–7 apply from 13 May 2027; until then the 2011 sensitive-data rules under Information Technology Act s.43A apply.",
    at:'Incident runbook (docs/compliance)', go:'',
    why:"A breach told late is a second breach: the law fixes the clock so nobody has to decide it in the moment.",
    added:'2026-10-13' },
  { id:'au-ndb', pa:'compliance', a:'people', k:'law', c:['AU'],
    p:"A breach likely to harm someone is assessed within 30 days, then notified",
    m:"Notice wording needs an Australian lawyer",
    g:'People & privacy', n:'Privacy Act 1988 (Cth) s.26WE–26WL, Australian Privacy Principle 11', w:'Notifiable data breaches · security of personal information',
    s:'part',
    note:"In force: the runbook’s 30-day assessment and notice steps (Privacy Commissioner and each person; one notice when the data is held jointly), the incident register, and the same security controls India needs. Not yet: lawyer-checked notice wording. We are probably under the A$3M turnover line (s.6D) and comply as if covered; an Australian shop over it must hold its software to this by contract. Australian data is held in India today — an overseas disclosure the privacy round lists.",
    at:'Incident runbook (docs/compliance)', go:'',
    why:"Every Australian shop over A$3M must hold its software to this; meeting it removes a question from each sale.",
    added:'2026-10-13' },
  { id:'ae-pdpl-breach', pa:'compliance', a:'people', k:'law', c:['AE'],
    p:"A breach is reported to the UAE Data Office and to each person affected",
    m:"Deadline waits on the Executive Regulation",
    g:'People & privacy', n:'Federal Decree-Law 45/2021 (Personal Data Protection) Art.9 and Art.20', w:'Breach notification · security of processing',
    s:'part',
    note:"In force: the runbook’s UAE step (the Data Office and each person; as processor we tell the shop, the controller, first), the incident register and the shared security controls. Not yet: the deadline — the Executive Regulation that sets it was not confirmed when this was written. Shops in the Dubai and Abu Dhabi financial free zones fall under those zones’ own laws, not researched yet.",
    at:'Incident runbook (docs/compliance)', go:'',
    why:"The law reaches anyone processing UAE residents’ data, wherever the server sits.",
    added:'2026-10-13' },
  { id:'iso27001-a8-15', pa:'compliance', a:'build', k:'std', c:['GLOBAL'],
    p:"A chit’s history can be added to, never rewritten",
    m:"Database guard written; in force once b315 runs",
    g:'Security', n:'ISO/IEC 27001:2022 A.8.15 (Logging)', w:'Logs protected from change and deletion',
    s:'part',
    note:"Already insert-only for the app: the sign-in log (b282), the access-grant log (b172) and the books’ journal (b273). b315 adds the chit history (state_log): the app may no longer change a line, and may delete only a draft’s own lines — the draft-purge rule, now held by the database. Proof: chitbridge-api tests/co2-controls.test.cjs, and b315’s last query (update grant 0, delete guard 1).",
    at:'chitbridge-api b315 · tests/co2-controls', go:'',
    why:"A history a program can rewrite proves nothing; one the database refuses to rewrite proves itself.",
    added:'2026-10-13' },
  { id:'csp3', pa:'compliance', a:'build', k:'std', c:['GLOBAL'],
    p:"The browser is told where this app may load code from",
    m:"Watching only; enforced once inline code moves out",
    g:'Security', n:'Content Security Policy Level 3 (W3C)', w:'Where scripts, styles and frames may come from',
    s:'part',
    note:"Enforced now on every page: no plugins (object-src 'none') and the page’s base address cannot be rewritten (base-uri 'self'). The full policy runs report-only: the browser names each breach in its console and blocks nothing. It still allows inline scripts, because the pages carry them; enforcing it is an open item in the API’s threat model, after inline code moves to files.",
    at:'vercel.json (headers)', go:'',
    why:"The second wall against an injected script stealing a signed-in session.",
    added:'2026-10-13' },
  { id:'iso27001-a8-5', pa:'signin', a:'people', k:'std', c:['GLOBAL'],
    p:"An owner signs in with a second step, not one code alone",
    m:"Not built",
    g:'Identity & access', n:'ISO/IEC 27001:2022 A.8.5 (Secure authentication)', w:'A second factor for owners',
    s:'plan',
    note:"Sign-in today is one code to a verified phone or e-mail (the NIST SP 800-63B row). A second step for owners is planned: the Australian Tax Office requires it of software that lodges returns for a shop, and India’s data rules expect it as a reasonable safeguard.",
    at:'Sign-in', go:'',
    why:"The owner’s sign-in opens the books, the bank vault and every chit; one stolen code should not be enough.",
    added:'2026-10-13' },
  /**
   * ⭐ STDREG1 (14 Oct 2026) — WHAT WAS MISSING (Athi: "many of them are partial, we have not included beckn, ONDC … include what is missing").
   * Every row below was checked against the code it names: In force only where a test proves it (named in `note`); Partly and Planned say what is
   * missing. The catalogue rows that catalogue-model.js used to keep as its own list are HERE now; that file names them by `id` (CBCatalogue.standards()).
   */
  /* ── the open network: Beckn, and ONDC (the recorded decision: Beckn-compatible, not ONDC-registered) ── */
  { id:'beckn-core', pa:'network', a:'sell', k:'std', c:['GLOBAL'],
    p:"An order from an open-network app can be read as a chit",
    m:"Mapping written and tested; no route answers a Beckn call yet",
    g:'Open network', n:'Beckn protocol (core order flow)', w:'The open wire for search, order, fulfilment — mapped onto the chit, never into it',
    ex:"on_confirm → chit Accepted", exWhy:"A Beckn order state maps IN to a chit state; a chit-only state (sealed, held by both) never maps out.",
    s:'part',
    note:"chitbridge-api lib/beckn-map.js is the mapping as a table (tests/beckn-map.test.js); 19 of its fields were seen in a live Beckn 1.1.0 capture, the rest are read from the specification. Not wired: no endpoint takes or sends a Beckn message. The decision on record: ChitBridge is Beckn-compatible, not ONDC-registered.",
    at:'chitbridge-api lib/beckn-map.js', go:'',
    why:"A buyer on any open-network app could reach a shop without that shop joining a platform; the chit stays the record both hold.",
    added:'2026-10-14' },
  { id:'ondc-registry', pa:'network', a:'sell', k:'std', c:['IN'],
    p:"Listed on India's open commerce network, with every message signed",
    m:"Not registered — the recorded decision, for now",
    g:'Open network', n:'ONDC registry and message signing', w:'A network participant is registered and signs every message it sends',
    s:'plan',
    note:"Joining ONDC means an entry in its registry and every message signed and checked against it. Decided against for now: ChitBridge stays Beckn-compatible, not ONDC-registered (chitbridge-api lib/beckn-map.js, the network-membership rule). Revisited when a shop asks to sell on ONDC.",
    at:'—', go:'',
    why:"Registering makes us a network participant with its duties; saying no on purpose is a decision, not an oversight.",
    added:'2026-10-14' },
  { id:'ondc-igm', pa:'network', a:'sell', k:'std', c:['IN'],
    p:"A complaint from an ONDC buyer reaches the shop the network's way",
    m:"Not built; a dispute stays on the chit",
    g:'Open network', n:'ONDC IGM (issue and grievance management)', w:'How a complaint travels between the buyer app, the seller app and the network',
    s:'plan',
    note:"Not built. Our own dispute is raised on the chit both parties hold. IGM matters only once a shop sells on ONDC (see the registry row).",
    at:'—', go:'',
    why:"A network complaint must arrive where the shop already handles disputes, not in a second inbox.",
    added:'2026-10-14' },
  { id:'ondc-rsf', pa:'network', a:'money', k:'std', c:['IN'],
    p:"Money from an ONDC sale settled and agreed the network's way",
    m:"Not built; payment stays bank to bank",
    g:'Open network', n:'ONDC RSF (reconciliation and settlement framework)', w:'Who pays whom, when, and how both sides agree the figures',
    s:'plan',
    note:"Not built. Nothing passes through ChitBridge today: a payment moves bank to bank and the chit records it.",
    at:'—', go:'',
    why:"Settlement agreed by both sides is the money half of the record; it waits on the registry decision.",
    added:'2026-10-14' },
  { id:'ondc-taxonomy', pa:'catalogue', a:'sell', k:'std', c:['IN'],
    p:"Product categories named the way ONDC buyer apps expect",
    m:"Not mapped; categories are the shop's own",
    g:'Open network', n:'ONDC retail categories and attributes', w:'The shared category tree and the attributes each category asks for',
    s:'plan',
    note:"Not mapped. A shop's categories are its own (Categories). A mapping table, like the Beckn one, is the way in if the registry decision changes.",
    at:'Categories', go:'catalogue',
    why:"A buyer app filters by the network's categories; a product outside them is not found.",
    added:'2026-10-14' },
  /* ── Australia ── */
  { id:'au-gst-bas', pa:'accounts', a:'money', k:'law', c:['AU'],
    p:"Your BAS figures come from your own books",
    m:"Prepared from the books; lodging with the tax office is not connected",
    g:'Money & tax', n:'GST Act 1999 (Cth) · BAS labels G1, 1A, 1B', w:'Goods and services tax and the business activity statement',
    ex:"1A − 1B = the GST ledgers' net movement", exWhy:"Every label is a read of the posted books for the quarter, so the statement cannot disagree with them.",
    s:'part',
    note:"In force: the BAS is prepared from the posted books — Simpler BAS by default, the full labels on request (chitbridge-api lib/gst-returns.js returnFor → the AU pack; tests/books-returns.test.cjs; engines tests/reg-au.test.js). Missing: lodging through the tax office's online services.",
    at:'CB Accounts · Returns', go:'returns',
    why:"A return built from the books is the one figure the shop and its accountant do not have to reconcile by hand.",
    added:'2026-10-14' },
  { id:'aasb-101', pa:'accounts', a:'books', k:'std', c:['AU'],
    p:"Balance sheet and profit and loss laid out the Australian way",
    eq:"IAS 1 abroad; Schedule III in India",
    g:'Books', n:'AASB 101 Presentation of Financial Statements', w:'The lines of the balance sheet and the profit and loss, by nature',
    s:'live',
    note:"The AU pack's statement lines (chitbridge-api lib/reg-au.js, paras 54 and 82/102) are what an Australian shop's statements are laid out by. Proof: tests/books-country.test.cjs.",
    at:'CB Accounts · Reports', go:'balance',
    why:"An Australian bank or accountant reads the statements without asking how they were arranged.",
    added:'2026-10-14' },
  { id:'aasb-102', pa:'accounts', a:'books', k:'std', c:['AU'],
    p:"Closing stock at the lower of cost and selling value, Australian rule",
    eq:"IAS 2 abroad; AS 2 in India",
    g:'Books', n:'AASB 102 Inventories', w:'Cost formulas (FIFO, weighted average) and the lower of cost and net realisable value',
    s:'live',
    note:"A closing stock above cost or above its selling value is refused in words that cite the rule (chitbridge-api lib/posting.js, the pack's AASB 102 paras 9 and 25). Proof: tests/std2-one-reading.test.cjs.",
    at:'Month & year end · Closing stock', go:'closingstock',
    why:"Stops profit being overstated by stock that will not sell at cost.",
    added:'2026-10-14' },
  { id:'au-div40', pa:'accounts', a:'books', k:'law', c:['AU'],
    p:"Assets depreciated by the Australian tax office's effective lives",
    g:'Books', n:'Income Tax Assessment Act 1997 Division 40', w:'Depreciating assets: effective life, diminishing value 200 ÷ life',
    s:'live',
    note:"The AU pack holds the effective lives and the method as data (chitbridge-engines src/reg-au.js); the depreciation note uses them for an Australian shop. Proof: engines tests/reg-au.test.js.",
    at:'Month & year end · Assets & depreciation', go:'assets',
    why:"The tax figure for an asset follows the tax office's own table, not a guess.",
    added:'2026-10-14' },
  { id:'au-abn', pa:'registration', a:'people', k:'law', c:['AU'],
    p:"An Australian Business Number is checked when it is typed",
    limit:"format and check digits; not looked up on the ABN register",
    g:'Records & data', n:'ABN — A New Tax System (Australian Business Number) Act 1999', w:'The 11-digit business number and its checksum',
    ex:"51 824 753 556", exWhy:"Eleven digits whose weighted sum must divide by 89 — a typo is caught before it is printed on an invoice.",
    s:'live',
    note:"One check (the AU pack's abn.check) for the shop's own ABN at country setup and a party's in CRM. Proof: chitbridge-api tests/country-setup.test.cjs and tests/country-crm-shop.test.cjs.",
    at:'Country setup · CRM', go:'',
    why:"A tax invoice over A$1,000 must show the buyer's ABN; a wrong one is caught at the counter, not at the audit.",
    added:'2026-10-14' },
  /* ── the UAE ── */
  { id:'ae-vat-201', pa:'accounts', a:'money', k:'law', c:['AE'],
    p:"Your VAT return figures come from your own books",
    m:"Prepared from the books; filing with the tax authority is not connected",
    g:'Money & tax', n:'Federal Decree-Law 8/2017 (VAT) · VAT 201 return', w:'Value added tax and its return, box by box',
    s:'part',
    note:"In force: the VAT 201 boxes are read from the posted books, by emirate where the form asks (chitbridge-api lib/gst-returns.js returnFor → the AE pack; tests/books-returns.test.cjs; engines tests/reg-ae.test.js). Missing: filing through the tax authority's portal.",
    at:'CB Accounts · Returns', go:'returns',
    why:"A return built from the books cannot disagree with them.",
    added:'2026-10-14' },
  { id:'pint-ae', pa:'accounts', a:'money', k:'law', c:['AE'],
    p:"UAE e-invoices in the network format the law will ask for",
    m:"The mandate's dates and scope are recorded; the e-invoice is not produced",
    eq:"PEPPOL BIS abroad (see UBL); INV-01 in India",
    g:'Money & tax', n:'Peppol PINT-AE (UAE e-invoicing)', w:'The UAE profile of the Peppol invoice, sent through an accredited provider',
    s:'plan',
    note:"The mandate (dates, scope, the 0235 identifier scheme) is data in the AE pack (chitbridge-api lib/reg-ae.js). Generating and sending the invoice is a later round.",
    at:'—', go:'',
    why:"Once the mandate starts, an invoice outside the network is not a valid invoice.",
    added:'2026-10-14' },
  { id:'ae-trn', pa:'registration', a:'people', k:'law', c:['AE'],
    p:"A UAE tax registration number is checked when it is typed",
    limit:"15-digit format only; no check digit is published",
    g:'Records & data', n:'UAE TRN (tax registration number)', w:'The 15-digit number the tax authority issues',
    s:'live',
    note:"One check (the AE pack's trn.check) for the shop's own number at country setup and a party's in CRM. Proof: chitbridge-api tests/country-crm-shop.test.cjs.",
    at:'Country setup · CRM', go:'',
    why:"A tax invoice must carry it; a wrong one is caught before it is printed.",
    added:'2026-10-14' },
  /* ── India ── */
  { id:'hsn-sac', pa:'accounts', a:'money', k:'law', c:['IN'],
    p:"Every line of a GST invoice carries its HSN or SAC code",
    m:"Carried and filed; the digits your turnover asks for are not checked",
    g:'Money & GST', n:'HSN / SAC on invoices — CGST Rule 46 · GSTR-1 HSN summary', w:'The goods or service code on each line, and its summary in the return',
    ex:"0904 · 4 digits up to ₹5 crore turnover", exWhy:"The number of digits depends on the shop's turnover; the code decides the rate.",
    s:'part',
    note:"In force: the code rides on every line from the catalogue and is filed in the GSTR-1 HSN summary (chitbridge-api lib/tax-lines.js decorate). Missing: a check that the code has the digits the shop's turnover requires.",
    at:'Catalogue · GST · Returns', go:'returns',
    why:"A wrong or short code is a mismatch the department's systems flag on their own.",
    added:'2026-10-14' },
  { id:'gstin-check', pa:'registration', a:'people', k:'law', c:['IN'],
    p:"A GSTIN is checked when it is typed",
    limit:"format and check character; not looked up on the GST portal",
    g:'Money & GST', n:'GSTIN — 15 characters with a check character', w:'State code · PAN · entity number · Z · check character',
    ex:"33AAAAA0000A1Z5", exWhy:"The last character is computed from the other fourteen, so one wrong character is caught.",
    s:'live',
    note:"One check (chitbridge-api lib/profile-map.js gstinChecksum) for the shop's own GSTIN at country setup, a party's in CRM, and an imported party (move in). Proof: tests/country-crm-shop.test.cjs.",
    at:'Country setup · CRM', go:'crm',
    why:"A wrong GSTIN on an invoice costs the buyer their input credit.",
    added:'2026-10-14' },
  /* ── foreign currency (FX1) ── */
  { id:'fx-ias21', pa:'accounts', a:'books', k:'std', c:['IN', 'AU', 'AE'],
    p:"Foreign-currency bills booked at the day's rate, and revalued at month end",
    m:"In force once the owner runs b391 and b392",
    eq:"IAS 21 abroad",
    g:'Books', n:'IAS 21 · Ind AS 21 · AASB 121 (foreign exchange)', w:'A foreign transaction at its day\'s rate; open balances at the closing rate; the difference to profit or loss',
    s:'part',
    note:"Built: a foreign bill posts at the rate of its day (one the shop typed or imported, never fetched), a payment settles at its own day's rate with the gain or loss on its own ledger, and the month end revalues open foreign balances (chitbridge-api lib/fx-rates.js; tests/fx-rates.test.cjs; engines tests/fx.test.js). Missing: migrations b391 and b392, which the owner runs.",
    at:'CB Accounts · Exchange rates', go:'',
    why:"A bill in dollars paid a month later is never the same rupees; the difference must land somewhere a CA can see.",
    added:'2026-10-14' },
  /* ── the platform ── */
  { id:'openapi', pa:'api', a:'build', k:'std', c:['GLOBAL'],
    p:"Another program can read what our services accept and return",
    m:"Six service routes described; no test checks them",
    g:'Platform', n:'OpenAPI 3.0', w:'A machine-readable description of the service routes',
    ex:"GET /api/openapi.json", exWhy:"Any developer's tool reads it and shows the routes, the fields and the answers.",
    s:'part',
    note:"chitbridge-api routes/openapi.js assembles /api/openapi.json from each service route's own fragment (offers · pricing · tax · invoice · keys · integrations). Missing: the app's own routes, and a test that the description matches what the routes answer.",
    at:'/api/openapi.json', go:'',
    why:"An integration starts from a description, not from reading our code.",
    added:'2026-10-14' },
  /* ── the catalogue's standards, once kept as catalogue-model.js's own list (now: CBCatalogue.standards() reads these by id) ── */
  { id:'json-schema-2020-12', pa:'catalogue', a:'sell', k:'std', c:['GLOBAL'],
    p:"A catalogue's shape is a schema any tool can read",
    m:"Emitted by the model; no test checks the output",
    g:'Records & data', n:'JSON Schema (draft 2020-12)', w:'The catalogue and item shape, as a standard schema',
    s:'part',
    note:"app/catalogue-model.js toJSONSchema() emits it, with our own x-cb-* keywords for what is ours. Missing: a test that the output validates.",
    at:'Catalogue setup', go:'catsetup',
    why:"A schema another system can read is a catalogue it can take without a mapping.",
    added:'2026-10-14' },
  { id:'rfc6902', pa:'catalogue', a:'build', k:'std', c:['GLOBAL'],
    p:"Every edit to a record could be replayed step by step",
    m:"Not built; merge-patch is used instead",
    g:'Records & data', n:'RFC 6902 (JSON Patch)', w:'Ordered edit operations',
    s:'plan',
    note:"Not built. Records change by merge-patch (RFC 7386); ordered operations matter only when a history must be replayed.",
    at:'—', go:'',
    why:"Named so that choosing merge-patch is a decision, not an oversight.",
    added:'2026-10-14' },
  { id:'gs1-gpc', pa:'catalogue', a:'sell', k:'std', c:['GLOBAL'],
    p:"A product's GS1 category can be recorded",
    m:"Held by reference; not checked against the list",
    g:'Records & data', n:'GS1 GPC (product classification)', w:'The GS1 category a product belongs to',
    s:'part',
    note:"Held by reference on the item (standards[]: scheme and code), never mirrored. Missing: a check against the published classification.",
    at:'Catalogue · standards', go:'catalogue',
    why:"Retail systems file a product by its GS1 category, not by the shop's own words.",
    added:'2026-10-14' },
  { id:'schema-org-product', pa:'catalogue', a:'sell', k:'std', c:['GLOBAL'],
    p:"Product fields named the way the web names them",
    m:"Names followed; no product feed is published",
    g:'Records & data', n:'schema.org Product', w:'The web vocabulary for a product',
    s:'part',
    note:"Our field names follow it (app/catalogue-model.js FIELD_STANDARDS). Missing: a published feed in it.",
    at:'Catalogue', go:'catalogue',
    why:"Search engines and storefronts read this vocabulary.",
    added:'2026-10-14' },
  { id:'schema-org-offer', pa:'catalogue', a:'sell', k:'std', c:['GLOBAL'],
    p:"A price belongs to an offer, so it can differ by buyer and date",
    m:"Price and its dates still sit on the item",
    g:'Records & data', n:'schema.org Offer', w:'Price, currency, quantity and price validity on the offer, not the product',
    s:'part',
    note:"The vocabulary is followed; the placement is not yet: price validity lives on the item (app/catalogue-model.js FIELD_GAPS names it the gap to close first).",
    at:'Catalogue · prices', go:'catalogue',
    why:"The same good sells at different prices to different buyers; the offer is where that lives.",
    added:'2026-10-14' },
  { id:'iso3166', pa:'country', a:'people', k:'std', c:['GLOBAL'],
    p:"Countries named by the world's two-letter codes",
    g:'Records & data', n:'ISO 3166-1 alpha-2', w:'Country codes — IN, AU, AE',
    ex:"AU", exWhy:"The code a country pack, a shop and a product's origin all use.",
    s:'live',
    note:"A shop's country, its pack and a product's origin are ISO 3166 codes. Proof: chitbridge-api tests/country-setup.test.cjs.",
    at:'Country setup', go:'',
    why:"One code per country, so a pack, a shop and a customs form agree.",
    added:'2026-10-14' },
  { id:'gs1-ai', pa:'catalogue', a:'sell', k:'std', c:['GLOBAL'],
    p:"Batch, expiry and serial travel with the goods, not the catalogue",
    limit:"on the chit line; a scanned GS1 barcode string is not read yet",
    g:'Records & data', n:'GS1 Application Identifiers — (10) batch · (17) expiry · (21) serial', w:'The instance of a product, as distinct from the product',
    ex:"(01)08901234567894(10)L42(17)270331", exWhy:"One product, one lot, one expiry — the lot is on the movement, never a new catalogue item.",
    s:'live',
    note:"chitbridge-api lib/gs1.js lotOf · lotKey · toElementString; a captured line keeps its lot (lib/capture.js). Proof: tests/lotfields.test.js.",
    at:'Chit · a line\'s lot', go:'',
    why:"Two lots of the same SKU are one product with two lots; a recall needs to know which.",
    added:'2026-10-14' },
  { id:'gs1-epcis', pa:'catalogue', a:'buy', k:'std', c:['GLOBAL'],
    p:"What happened to a lot can be shared with other companies",
    m:"Trace walk uses our own names; no export",
    g:'Records & data', n:'GS1 EPCIS 2.0', w:'Events on a lot — what, when, where, why',
    s:'plan',
    note:"Not built. The trace walk and mass balance already hold these facts under our own names; the export is what is missing.",
    at:'Traceability', go:'',
    why:"A recall crosses companies; a shared event format is how it gets traced.",
    added:'2026-10-14' },
  { id:'medusa-model', pa:'catalogue', a:'sell', k:'prac', c:['GLOBAL'],
    p:"Product fields checked against a widely used open model",
    m:"Read for naming; nothing tests it",
    g:'Records & data', n:'Medusa product model (read, not adopted)', w:'An open commerce model read field by field to name ours',
    s:'part',
    note:"Read, not adopted: it confirmed hs_code, origin_country, sku, barcode, material and weight; variant-as-a-record was not taken (a trader writes a flat price list). No Medusa code is used (app/catalogue-model.js FIELD_STANDARDS).",
    at:'Catalogue', go:'catalogue',
    why:"Better, not copied: we take its names where they fit and say where we differ.",
    added:'2026-10-14' },
  { id:'odoo-tracking', pa:'catalogue', a:'sell', k:'prac', c:['GLOBAL'],
    p:"A lot belongs to a product; the product says if it is tracked",
    m:"Model followed; first-expiry-first-out not enforced",
    g:'Records & data', n:'Lot and serial tracking (Odoo model)', w:'Tracked by none · lot · serial; removal by first expiry',
    s:'part',
    note:"The model is followed: a lot is a record linked to one product, never a new product (the pharma starter's tracking field). Missing: picking by first expiry is shown, not enforced. No Odoo code is used.",
    at:'Catalogue setup', go:'catsetup',
    why:"A catalogue row per lot turns the catalogue into a lot ledger.",
    added:'2026-10-14' },
];

/* ⭐ THE VOCABULARIES the new fields draw from, and the date the register was last checked. A status word is said here once; the Settings
   card, the Legend and the page all say In force / Partly / Planned. Adding a country is one line in STD_COUNTRIES. */
var STD_AREAS = [['sell','Selling'],['buy','Buying'],['money','Money & GST'],['books','Books'],['people','People & privacy'],['look','Look & access'],['build','How we build']];
var STD_KINDS = [['law','Law','you must'],['std','Standard','agreed worldwide'],['prac','Practice','the common way'],['compat','Compatibility','works with']];   /* compat: an outside system we work with — its rows are data/compat.json (stdCompatRows), never this list */
var STD_COUNTRIES = [['IN','India'],['AU','Australia'],['AE','UAE'],['GLOBAL','Global']];   /* CPS1: AU · AE — the packs the engines register (regulation.list()); the Country Standard row applies in all three */
var STD_STATUS = [['live','In force','●'],['part','Partly','◐'],['plan','Planned','○']];
/* STDREG1 (14 Oct 2026): the PRODUCT area a row lives in (`pa`), so the page can filter by the part of the product a reader owns. The first fifteen are the
   product areas of docs/design/standards/COUNTRY-COVERAGE.md §1 (the ones data/country-ready.json reports per country), in that order; the last five are the
   platform areas the area packs own (sign-in, compliance, settings, testing, the API). The 29-area product map (docs/planning/PRODUCT-AREA-MAP-2026-10-14.md)
   was not on hand when this was written: when it lands, it WIDENS this one array, and a row moves by its `pa` alone. `a` (STD_AREAS) stays the business view. */
var STD_PRODUCT_AREAS = [['registration','Registration'],['country','Country setup'],['till','Till'],['print','Print / share'],['shop','Shop / online showcase'],
  ['catalogue','Catalogue'],['accounts','CB Accounts'],['finance','CB Finance'],['crm','CRM'],['tasks','Tasks & Orders'],['connector','Connector'],
  ['employees','Employees'],['network','Network / rail'],['locale','Locale'],['payroll','Payroll'],
  ['signin','Sign-in & access'],['compliance','Compliance & security'],['settings','Settings & look'],['testing','Testing'],['api','Platform & API']];
var STD_CHECKED = '2026-10-14';

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
  { k:'line.hs_code', v:'"0904.11"',                           std:'HS (WCO)',            s:'part', c:'Pepper, whole. Customs charges on THIS, not on the product name. India\'s HSN rides on the line today; the export HS is not checked.' },
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
  var areas = STD_AREAS.map(function(a){ return a[0]; }), ctry = STD_COUNTRIES.map(function(c){ return c[0]; }), pas = STD_PRODUCT_AREAS.map(function(a){ return a[0]; });
  return rows.filter(function(x){
    return x && x.system && x.service && x.p && STD_COMPAT_STATUS[x.status] && areas.indexOf(x.area) >= 0 && pas.indexOf(x.pa) >= 0 && Array.isArray(x.c) && x.c.length && x.c.every(function(c){ return ctry.indexOf(c) >= 0; });
  }).map(function(x){
    var s = STD_COMPAT_STATUS[x.status];
    var proof = (STD_COMPAT_PROOF[x.proof] || 'Not yet') + (x.proof_at ? ' ' + x.proof_at : '') + (x.proof_ref ? ' — ' + x.proof_ref : '');
    return { a: x.area, pa: x.pa, k: 'compat', c: x.c.slice(), p: x.p, m: s === 'live' ? undefined : (x.m || x.roadmap || 'Not built yet'),
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
  ['AAA', 'WCAG level AAA', 'The highest level of the web accessibility rules — 7:1 text contrast among them'],
  ['AAL1', 'Authenticator Assurance Level 1', 'Sign-in with one factor, as NIST defines it'],
  ['AAL2', 'Authenticator Assurance Level 2', 'Sign-in with two factors, as NIST defines it'],
  ['AASB', 'Australian Accounting Standards Board', 'The body that sets Australia\'s accounting standards (AASB 101, 102, 121)'],
  ['ABN', 'Australian Business Number', 'The 11-digit number every Australian business uses with the tax office'],
  ['ADGM', 'Abu Dhabi Global Market', 'A UAE free zone with its own data protection law'],
  ['AE', 'United Arab Emirates (country code)', 'The ISO 3166 code for the UAE'],
  ['AED', 'UAE dirham', 'The currency of the UAE (ISO 4217 code)'],
  ['ANSI', 'American National Standards Institute', 'The body that publishes US national standards'],
  ['API', 'Application programming interface', 'The door another program uses to talk to ours'],
  ['APG', 'ARIA Authoring Practices Guide', 'How to build accessible controls, by the W3C'],
  ['APP', 'Australian Privacy Principle', 'One of the 13 rules in Australia\'s Privacy Act 1988'],
  ['APPs', 'Australian Privacy Principles', 'The 13 rules in Australia\'s Privacy Act 1988'],
  ['AS', 'Accounting Standard (India)', 'The ICAI rules for Indian businesses'],
  ['AU', 'Australia (country code)', 'The ISO 3166 code for Australia'],
  ['BAS', 'Business activity statement', 'The form an Australian business reports its GST on'],
  ['BCP', 'Best Current Practice', 'An internet standard series; BCP 47 names languages'],
  ['BIS', 'Bureau of Indian Standards', 'India\'s national standards body'],
  ['CA', 'Chartered Accountant', 'A qualified accountant who audits and files for you'],
  ['CB', 'ChitBridge', 'This platform'],
  ['CERT', 'Computer Emergency Response Team', 'CERT-In is India\'s, and takes cyber incident reports'],
  ['CGST', 'Central GST', 'The part of GST that goes to the central government'],
  ['CI', 'Continuous integration', 'The server that runs every test on every change'],
  ['CLDR', 'Common Locale Data Repository', 'The world\'s shared data for dates, numbers and names by country'],
  ['CN', 'Credit note', 'A voucher that reduces what a buyer owes'],
  ['CRM', 'Customer relationship management', 'Your list of parties and everything said with them'],
  ['CSS', 'Cascading Style Sheets', 'The language that lays out a web page'],
  ['CSV', 'Comma-separated values', 'A plain spreadsheet file any program can open'],
  ['CV', 'Contra voucher', 'Money moved between your own cash and bank'],
  ['DIFC', 'Dubai International Financial Centre', 'A UAE free zone with its own data protection law'],
  ['DN', 'Debit note', 'A voucher that increases what a buyer owes'],
  ['DPDP', 'Digital Personal Data Protection', 'India\'s privacy law of 2023'],
  ['DPIA', 'Data protection impact assessment', 'A written check of the privacy risks of a system, and what lowers them'],
  ['ECE', 'UN Economic Commission for Europe', 'Publishes trade codes, such as units (Rec 20)'],
  ['ECMA-402', 'ECMAScript Internationalization API', 'How a browser formats dates, numbers and money by country'],
  ['EPCIS', 'Electronic Product Code Information Services', 'GS1\'s standard for sharing what happened to goods — what, when, where, why'],
  ['ERP', 'Enterprise resource planning', 'Large business software, such as SAP or NetSuite'],
  ['EU', 'European Union', 'The 27-country union in Europe'],
  ['FI', 'Financial information', 'Account data, in the Account Aggregator\'s schema'],
  ['FIFO', 'First in, first out', 'A cost formula: the oldest stock is taken as sold first'],
  ['FIU', 'Financial Information User', 'A business allowed to receive your bank data with your consent'],
  ['FOB', 'Free On Board', 'An Incoterm: the seller\'s duty ends once goods are on the ship'],
  ['G1', 'BAS label G1', 'Total sales, the first figure on an Australian BAS'],
  ['GDPR', 'General Data Protection Regulation', 'The EU\'s privacy law'],
  ['GDSN', 'Global Data Synchronisation Network', 'GS1\'s network for sharing product data'],
  ['GLEIF', 'Global Legal Entity Identifier Foundation', 'Keeps the world list of LEIs'],
  ['GNU', 'GNU Project', 'Free software tools, such as gettext'],
  ['GPC', 'Global Product Classification', 'GS1\'s category tree for products'],
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
  ['IGM', 'Issue and Grievance Management', 'How a complaint travels on India\'s open commerce network'],
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
  ['IT', 'Information Technology (Act)', 'India\'s Information Technology Act 2000'],
  ['JSON', 'JavaScript Object Notation', 'A plain text data format'],
  ['JV', 'Journal voucher', 'An entry that is not a sale, purchase, receipt or payment'],
  ['JWT', 'JSON Web Token', 'A signed pass that proves who is signed in'],
  ['KGM', 'Kilogram (UN/ECE unit code)', 'The world code for a kilogram'],
  ['KGS', 'Kilograms (GST unit code)', 'The GST code for kilograms'],
  ['LEI', 'Legal Entity Identifier', 'A world-wide number for a company'],
  ['LOCALE-STANDARD', 'The locale standard', 'docs/design/standards/LOCALE-STANDARD.md — the rules every screen follows for words, figures and direction; its guard is e2e/walk-locale.cjs'],
  ['LOCODE', 'UN Location Code', 'The world code for a port or city'],
  ['LTR', 'Left to right', 'Writing direction, as in English'],
  ['MAA', 'Chennai (IATA code)', 'The airport code for Chennai'],
  ['MDM', 'Master data management', 'Keeping one true copy of product and party data'],
  ['MIT', 'MIT License', 'A free software licence'],
  ['MJ', 'Manual journal', 'An entry typed by hand, so it is checked first'],
  ['MPM', 'Merchant-presented mode', 'A QR the shop shows and the customer scans'],
  ['NIST', 'US National Institute of Standards and Technology', 'Publishes security rules such as SP 800-63'],
  ['NPCI', 'National Payments Corporation of India', 'Runs UPI'],
  ['OAIC', 'Office of the Australian Information Commissioner', 'Australia\'s privacy regulator'],
  ['OIDC', 'OpenID Connect', 'The standard behind "Sign in with Google"'],
  ['ONDC', 'Open Network for Digital Commerce', 'India\'s open commerce network, built on the Beckn protocol'],
  ['OS', 'Operating system', 'Windows, Android, iOS and so on'],
  ['OTH', 'Others (GST unit code)', 'The GST unit for anything without its own code'],
  ['PAN', 'Permanent Account Number', 'India\'s 10-character income-tax number; it sits inside a GSTIN'],
  ['PAY', 'Payment voucher', 'Money you paid out'],
  ['PDPL', 'Personal Data Protection Law', 'The UAE\'s federal privacy law (Decree-Law 45 of 2021)'],
  ['PEPPOL', 'Pan-European Public Procurement Online', 'A network for sending e-invoices between businesses'],
  ['PIM', 'Product information management', 'Keeping product details in one place'],
  ['PINT-AE', 'Peppol International invoice, UAE profile', 'The format UAE e-invoices are sent in'],
  ['PIX', 'Pix', 'Brazil\'s instant payment system'],
  ['POST', 'HTTP POST', 'A request that sends data to a server'],
  ['PV', 'Purchase voucher', 'A bill from a supplier'],
  ['PY', 'Payment voucher', 'Money you paid out'],
  ['QR', 'Quick Response code', 'A square barcode a phone can scan'],
  ['RBAC', 'Role-based access control', 'What you may do depends on your role'],
  ['RBI', 'Reserve Bank of India', 'India\'s central bank'],
  ['RFC', 'Request for Comments', 'An internet standard'],
  ['RLS', 'Row-level security', 'The database shows each business only its own rows'],
  ['RSF', 'Reconciliation and Settlement Framework', 'How money from an open-network sale is settled and agreed'],
  ['RTL', 'Right to left', 'Writing direction, as in Arabic'],
  ['RV', 'Receipt voucher', 'Money you received'],
  ['SA', 'Standard on Auditing (India)', 'India\'s audit rules, based on ISA'],
  ['SAC', 'Services Accounting Code', 'India\'s code for a service on a GST invoice, as HSN is for goods'],
  ['SCIM', 'System for Cross-domain Identity Management', 'How an HR system creates and removes staff accounts'],
  ['SGST', 'State GST', 'The part of GST that goes to the state'],
  ['SKU', 'Stock-keeping unit', 'Your own code for one product'],
  ['SP', 'Special Publication (NIST)', 'A NIST rule book'],
  ['SPDI', 'Sensitive personal data or information', 'India\'s 2011 rules on protecting personal data, in force until the DPDP Rules replace them'],
  ['SV', 'Sales voucher', 'A sale'],
  ['TAA', 'Taxation Administration Act 1953 (Australia)', 'The Australian law on keeping and showing tax records'],
  ['TCMS', 'Test case management system', 'Where test cases and results are kept'],
  ['TLV', 'Tag-length-value', 'How fields are packed inside a payment QR'],
  ['TRN', 'Tax Registration Number', 'The UAE\'s 15-digit VAT number'],
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
  ['W3C', 'World Wide Web Consortium', 'Writes the web standards browsers follow'],
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
var STD_NOT_ABBR = ['COUNTRY-STANDARD', 'GENERATED', 'BEFORE', 'BETWEEN', 'CAN', 'IS', 'COMMAND', 'DELETES', 'FINER', 'FORCE', 'FORMAT', 'ISSUE', 'MANUAL', 'MEANS', 'MET', 'NOT', 'OTHER', 'PLAN',
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
      return '<abbr class="gl"' + tab + ' data-gl="' + m + '" title="' + esc(t) + '">' + m + '</abbr>';
    }
    /* a numbered reference (ISO 4217) first, then the single words in what is left */
    var parts = seg.split(STD_REF_RE), refs = seg.match(STD_REF_RE) || [];
    return parts.map(function(p, i){ return p.replace(STD_ABBR_RE, one) + (i < refs.length ? one(refs[i]) : ''); }).join('');
  }).join('');
}
