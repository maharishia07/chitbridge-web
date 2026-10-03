/* Standards page — SAMPLE of the proposed register shape (2026-10-03).
   Built from public/app/cap-standards.js (STANDARDS, STD_WHY, STD_RECORD — their words, unchanged) plus the fields this
   design adds per row: a (area) · k (law / standard / practice) · c (applies in: country codes, GLOBAL) · p (what it does for
   you, plain words) · m (what is missing, short — every Partly and Planned row has one) · limit (a stated limit on an
   In force row) · eq (the equivalent abroad). The 17 standards adopted 2026-10-02/03 are added (src: "added 2026-10-03");
   the WCAG contrast addition updates its existing row instead of duplicating it. */
window.STD_PAGE = {
"asOf": "2026-10-03",
"asOfLabel": "3 Oct 2026",
"shop": "Chola Auto Care",
"areas": [
[
"sell",
"Selling"
],
[
"buy",
"Buying"
],
[
"money",
"Money & GST"
],
[
"books",
"Books"
],
[
"people",
"People & privacy"
],
[
"look",
"Look & access"
],
[
"build",
"How we build"
]
],
"kinds": [
[
"law",
"Law",
"you must"
],
[
"std",
"Standard",
"agreed worldwide"
],
[
"prac",
"Practice",
"the common way"
]
],
"countries": [
[
"IN",
"India"
],
[
"GLOBAL",
"Global"
]
],
"statuses": [
[
"live",
"In force",
"●"
],
[
"part",
"Partly",
"◐"
],
[
"plan",
"Planned",
"○"
]
],
"rows": [
{
"g": "Verification",
"n": "ISO/IEC/IEEE 29119-3",
"w": "Test completion report — the template a run is written up on",
"ex": "6 · Test completion evaluation",
"exWhy": "The clause that asks whether the exit criteria were MET. We render the numbers under it and say plainly that the judgement is not ours to generate — a report that fills this heading with plausible prose looks signed off and is not.",
"s": "part",
"note": "The measured sections are generated from the ledger; the judgement sections (deviations, completion evaluation, residual risks, lessons, approval) are marked “needs a person” and carry the question instead of an answer. No test PLAN is declared anywhere yet, so section 5 has nothing to compare against.",
"at": "Testing › Report",
"go": "testing",
"why": "⭐ It SUPERSEDED IEEE 829 in 2013 — which is the name most people still reach for, and using the withdrawn one would have looked more familiar to more readers and been wrong. A completion report on a known template is one an auditor, a customer or a new engineer can read without being taught our format.",
"a": "build",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Every test run is written up on a template an auditor already knows",
"m": "Judgement sections need a person; no test plan yet",
"src": "register",
"id": "s1"
},
{
"g": "Verification",
"n": "JUnit XML",
"w": "Test result interchange — what every CI writes and every tool reads",
"ex": "<testcase name=\"[CTR-05] a single click chooses\"/>",
"exWhy": "Playwright emits this with one config line; Kiwi TCMS, TestRail, Allure and ReportPortal all import it. The case key in brackets is what joins a run to our board.",
"s": "live",
"at": "POST /api/testing/results/junit",
"go": "testing",
"why": "A private results format would strand every automated run inside one screen, and would have to be re-implemented by anything that ever wanted to read it.",
"a": "build",
"k": "prac",
"c": [
"GLOBAL"
],
"p": "Test results any tool can read, not locked in one screen",
"src": "register",
"id": "s2"
},
{
"g": "Verification",
"n": "Gherkin",
"w": "The spec and the test as one text — Given / When / Then",
"ex": "Given Counter open on Sell",
"exWhy": "Our case shape already WAS Given/When/Then (pre / step / expected), so nothing is translated — the file is rendered and read back, and all 110 real cases round-trip unchanged.",
"s": "part",
"note": "The FORMAT is adopted; Cucumber the RUNNER is deliberately not — every “When I click the row” would need a step definition, a second codebase mapping sentences onto clicks.",
"at": "Testing — export/import .feature",
"go": "testing",
"why": "A .feature file carries the spec clause (the Feature description) and the cases against it in one text, so neither can be edited without the other in front of you.",
"a": "build",
"k": "prac",
"c": [
"GLOBAL"
],
"p": "Each rule and its test are written as one text",
"m": "The format is adopted; its runner deliberately is not",
"src": "register",
"id": "s3"
},
{
"g": "Localisation",
"n": "BCP 47 (RFC 5646)",
"w": "Language tags — en-IN, ar-AE, ta",
"ex": "ta-IN",
"exWhy": "A browser sends exactly this as <code>Accept-Language</code>. Any system on earth reads it as \"Tamil, as written in India\" — no lookup table, no mapping file.",
"s": "live",
"at": "Localisation",
"go": "locale",
"why": "A language tag nobody else parses means every counterparty re-guesses what \"Tamil\" meant.",
"a": "look",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Your language is named the way every system names it",
"src": "register",
"id": "s4"
},
{
"g": "Localisation",
"n": "UTS #35 · CLDR",
"w": "Locale data and the -u- extensions (nu·hc·ca·fw)",
"ex": "en-IN-u-nu-latn-hc-h23",
"exWhy": "One tag carrying four decisions: English, Indian grouping, Western digits, 24-hour clock. Hand it to <code>Intl</code> anywhere and you get the same answer.",
"s": "live",
"at": "Localisation",
"go": "locale",
"why": "Lakh vs million, month names, which days are the weekend — facts about 200 countries we would otherwise guess. CLDR told us the UAE weekend changed in 2022 when our own comments said otherwise.",
"a": "look",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Lakh or million, month names, weekends — right for each country",
"src": "register",
"id": "s5"
},
{
"g": "Localisation",
"n": "RFC 4647",
"w": "Language priority list and matching",
"ex": "ta, en, hi",
"exWhy": "Your priority list. A catalogue written in <b>en</b> and <b>hi</b> shows you the <b>en</b> one — the version its author wrote, chosen not translated.",
"s": "live",
"at": "Localisation",
"go": "locale",
"why": "Decides which authored version of a catalogue a buyer is shown — without translating anything.",
"a": "look",
"k": "std",
"c": [
"GLOBAL"
],
"p": "A buyer sees the catalogue in the language its author wrote",
"src": "register",
"id": "s6"
},
{
"g": "Localisation",
"n": "ECMA-402 (Intl)",
"w": "Number, money, date, collation, direction",
"ex": "12,34,56,789.50",
"exWhy": "The same number is <b>123,456,789.50</b> to a US reader and <b>123.456.789,50</b> in Germany. Nobody stores three versions; the tag decides at render.",
"s": "live",
"at": "Every screen with a figure on it",
"go": "locale",
"why": "Sorting a Tamil supplier list by UTF-16 code units is byte order wearing alphabetical clothes.",
"a": "look",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Numbers, money and dates shown the way your reader writes them",
"src": "register",
"id": "s7"
},
{
"g": "Localisation",
"n": "IANA tz database",
"w": "Time zones — via the engine, not a kept table",
"ex": "Asia/Dubai",
"exWhy": "Not <code>+04:00</code>. An offset is wrong twice a year in half the world; a ZONE stays correct because the rules travel with the name.",
"s": "live",
"at": "Every timestamp on every chit",
"go": "locale",
"why": "⭐ Turns \"when did this happen\" from an argument into a fact. One instant read 19:00, 20:30 and 16:00 to three parties before this.",
"a": "books",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Every time carries its zone, so “when” is a fact, not an argument",
"src": "register",
"id": "s8"
},
{
"g": "Localisation",
"n": "ISO 4217",
"w": "Currency codes on every price",
"ex": "{ amount: 1250.00, currency: \"AED\" }",
"exWhy": "A price is a pair, never the string \"AED 1250\". Your ERP reads the currency field; it does not parse a symbol out of a label.",
"s": "live",
"at": "Catalogue · prices",
"go": "catalogue",
"why": "A price without a stated currency is a number, not an amount — and the party who assumes wrong pays the difference.",
"a": "sell",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Every price says its currency, so nobody guesses",
"src": "register",
"id": "s9"
},
{
"g": "Localisation",
"n": "ISO 8601",
"w": "Timestamps in storage and transport",
"ex": "2026-08-18T14:32:05Z",
"exWhy": "Unambiguous everywhere. \"18/08/2026\" is the 18th of August in Mumbai and invalid in New York — and \"08/09\" is two different days.",
"s": "part",
"note": "Display follows the reader's locale by design, which is not ISO form.",
"at": "Chit records · exports",
"go": "locale",
"why": "An unambiguous instant on the record, whatever the reader sees.",
"a": "books",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Every saved time is one exact, unambiguous instant",
"m": "Screens show your local format by design, not ISO form",
"src": "register",
"id": "s10"
},
{
"g": "Localisation",
"n": "GNU gettext",
"w": "String catalogue — the English is the key",
"ex": "msgid \"Save\"",
"exWhy": "The English IS the key, so an untranslated label shows correct English rather than a leaked <code>btn.save.label</code>.",
"s": "part",
"note": "Primitive and a 449-entry catalogue exist; the call sites are not wrapped yet.",
"at": "Localisation · language",
"go": "locale",
"why": "A translator can be handed a file instead of a codebase.",
"a": "look",
"k": "prac",
"c": [
"GLOBAL"
],
"p": "The app can be translated from one file",
"m": "449 strings catalogued; the screens are not wired yet",
"src": "register",
"id": "s11"
},
{
"g": "Accessibility",
"n": "WCAG 2.2 — 1.4.3 / 1.4.6",
"w": "Text contrast, measured not asserted",
"ex": "#494F56 on #FFFFFF = 8.11:1",
"exWhy": "A number, not an opinion. Anyone can recompute it from the two hex values and check our claim in a minute.",
"s": "live",
"note": "All 16 themes are checked by the theme-contrast test (WCAG 2.x AA), 0 failures.",
"at": "Appearance · themes",
"go": "appearance",
"why": "⭐ It found 117 real contrast failures in themes that had shipped and that nobody had caught by eye — including body text at 2.57:1 in the smallest font.",
"a": "look",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Text is readable in every theme — measured, not guessed",
"src": "register",
"id": "s12"
},
{
"g": "Accessibility",
"n": "WCAG 2.2 — 1.4.4",
"w": "Resize text to 132% without loss of function",
"ex": "--fs-3: 14px → 18.5px",
"exWhy": "The whole scale multiplies, so a heading stays bigger than a caption at 132%.",
"s": "live",
"at": "Appearance · text size",
"go": "appearance",
"why": "Someone can keep using the product as their eyes change, instead of leaving it.",
"a": "look",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Text can grow to 132% and nothing breaks",
"src": "register",
"id": "s13"
},
{
"g": "Accessibility",
"n": "WCAG 2.2 — 2.3.3",
"w": "Animation from interactions can be turned off",
"ex": "prefers-reduced-motion: reduce",
"exWhy": "Set once in Windows or iOS; every well-behaved site honours it. You never tell us separately.",
"s": "live",
"at": "Appearance · motion",
"go": "appearance",
"why": "Movement triggers migraine and vertigo. Honouring the OS setting means nobody has to ask us separately.",
"a": "look",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Animation can be switched off for those it bothers",
"src": "register",
"id": "s14"
},
{
"g": "Accessibility",
"n": "WCAG 2.2 — full audit",
"w": "Keyboard, focus order, names and roles",
"ex": "—",
"exWhy": "Nothing to show here yet, and that is the point of the status: no independent audit has been run.",
"s": "part",
"note": "Keymap and focus states exist; no independent audit has been run.",
"at": "Whole product",
"go": "appearance",
"why": "The part we cannot honestly claim yet — which is why it says so.",
"a": "look",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Usable by keyboard and screen reader",
"m": "No independent audit has been run",
"src": "register",
"id": "s15"
},
{
"g": "Accessibility",
"n": "Okabe–Ito",
"w": "Colour-universal palette for colour blindness",
"ex": "#0072B2 blue · #D55E00 vermillion",
"exWhy": "A published pair that stays distinguishable under deuteranopia, protanopia and tritanopia — unlike the green/red pair everyone reaches for.",
"s": "live",
"at": "Appearance · Colour Vision theme",
"go": "appearance",
"why": "Ends the argument about which colours to use — a published palette proven distinguishable under every type of colour blindness.",
"a": "look",
"k": "prac",
"c": [
"GLOBAL"
],
"p": "Colours a colour-blind reader can still tell apart",
"src": "register",
"id": "s16"
},
{
"g": "Accessibility",
"n": "CSS Logical Properties",
"w": "Right-to-left layout without a second stylesheet",
"ex": "margin-inline-start: 12px",
"exWhy": "Mirrors automatically in Arabic. <code>margin-left</code> would have needed a second stylesheet nobody maintains.",
"s": "live",
"note": "378 physical properties converted.",
"at": "Whole product",
"go": "appearance",
"why": "Arabic became possible in one sweep instead of a parallel stylesheet nobody would maintain.",
"a": "look",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Right-to-left languages such as Arabic lay out correctly",
"src": "register",
"id": "s17"
},
{
"g": "Records & data",
"n": "RFC 7386",
"w": "JSON merge-patch for catalogue golden records",
"ex": "{ \"price\": { \"amount\": 1300 }, \"notes\": null }",
"exWhy": "Changes the price and DELETES the notes. Fields you do not mention are untouched — so two parties can edit the same record without overwriting each other.",
"s": "live",
"at": "Catalogue · golden records",
"go": "catalogue",
"why": "Two parties can update different fields of the same record without silently overwriting each other.",
"a": "build",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Product changes from many sources merge cleanly",
"src": "register",
"id": "s18"
},
{
"g": "Records & data",
"n": "GS1",
"w": "SKU / GTIN identity on catalogue items",
"ex": "08901234567894",
"exWhy": "A GTIN. The last digit is computed from the other thirteen, so a typo is detectable — and both sides know it is the same product without comparing names.",
"s": "part",
"note": "Codes are carried and matched; check-digit validation is not enforced.",
"at": "Catalogue · product identity",
"go": "catalogue",
"why": "⭐ The three-way match only works if both sides agree this is the SAME product. Without a shared identifier, matching is fuzzy string comparison and a dispute has nothing to stand on.",
"a": "sell",
"k": "std",
"c": [
"GLOBAL"
],
"p": "A barcode number means the same product to both sides",
"m": "Check digit not enforced yet",
"src": "register",
"id": "s19"
},
{
"g": "Records & data",
"n": "PIM (discipline)",
"w": "One place holds product information; every channel reads it",
"ex": "name · unit · price · images · codes",
"exWhy": "The fields a buyer sees, held once instead of per storefront.",
"s": "live",
"note": "A practice, not a wire format — there is nothing to conform to.",
"at": "Catalogue",
"go": "catalogue",
"why": "A price edited in one place and stale in three others is how two parties end up quoting different numbers for the same item.",
"a": "sell",
"k": "prac",
"c": [
"GLOBAL"
],
"p": "Product details kept in one place; every channel reads it",
"src": "register",
"id": "s20"
},
{
"g": "Records & data",
"n": "MDM · golden record",
"w": "One authoritative record per real product, however many sources describe it",
"ex": "blueprint + ERP + CSV + capture → 1 item",
"exWhy": "Four sources, one item, keyed by SKU.",
"s": "live",
"note": "A practice, not a wire format. The merge itself is RFC 7386 (above).",
"at": "Catalogue · golden records",
"go": "catalogue",
"why": "Without it, importing the same list twice gives you two of every product and no way to tell which one a chit cited.",
"a": "sell",
"k": "prac",
"c": [
"GLOBAL"
],
"p": "One true record per product, however many lists describe it",
"src": "register",
"id": "s21"
},
{
"g": "Records & data",
"n": "UBL 2.1 · PEPPOL BIS Billing 3.0 (invoice abroad)",
"w": "The world's invoice document: our frozen invoice block (the GST e-invoice schema) maps to it field for field",
"ex": "AssVal → TaxExclusiveAmount · Unit KGS → unitCode KGM · the offer → AllowanceCharge",
"exWhy": "A buyer outside GST receives the same frozen numbers in the document their system already reads; nothing is recomputed on the way out.",
"s": "plan",
"note": "Mapped (C:\\dev\\catalogue\\UBL-MAPPING-2026-09-05.md), not rendered. Missing: an EndpointID per party (ISO 6523 scheme + id), a seller invoice series per GSTIN/VAT id, the tax-category table per scheme (S/Z/E/AE). Built when a counterparty outside GST asks.",
"at": "Chit · Invoice tab",
"go": "task",
"why": "One frozen invoice, two dialects: INV-01 for the GST portal, UBL for everyone else — the numbers never differ.",
"a": "sell",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Your invoice can be read by systems abroad",
"m": "Mapped field for field; not produced yet",
"src": "register",
"id": "s22"
},
{
"g": "Records & data",
"n": "GST UQC + UN/ECE Rec 20 (units)",
"w": "One unit, three names: ours · the Rec 20 code the world uses · the GST Unit Quantity Code an Indian invoice prints",
"ex": "kg → KGM → KGS · bag → BG → BAG",
"exWhy": "The connector maps a Tally unit to ours by the code, not the spelling; the invoice and GSTR carry the UQC.",
"s": "live",
"note": "app/units.js (vendored from the API): 22 units with Rec 20 and UQC codes and their common spellings; unknown spellings are never guessed. ⚠️ This row said \"live\" for months while lib/tax-lines.js filed the seller's own word (\"packet\") into a GSTR HSN row as the code — the register was ahead of the code. Wired 2026-09-10: tax-lines maps through lib/units and anything unmappable stays OTH, which the portal accepts.",
"at": "Catalogue setup · Columns · Units",
"go": "catsetup",
"why": "A unit named three ways across two systems is three units until someone maps them; the code is what makes it one.",
"a": "sell",
"k": "law",
"c": [
"IN",
"GLOBAL"
],
"p": "Units printed the way GST and the world both expect",
"src": "register",
"id": "s23"
},
{
"g": "Commercial",
"n": "EMVCo QR (MPM)",
"w": "Merchant-presented QR — the format PIX · PayNow · PromptPay · DuitNow · BharatQR · HKQR are all profiles of",
"ex": "TLV: 00 02 01 · 26 … · 54 06 140.00",
"exWhy": "Published in 2017 to stop every country inventing its own code. One encoder reaches six national rails.",
"s": "plan",
"note": "NOT implemented. Named here because the counter's QR is dispatched per SCHEME (lib/profile PAY_SCHEMES), so this is a row in that table rather than a rewrite. Today only the India scheme is encoded.",
"at": "Counter · how the bill is paid",
"go": "till",
"why": "Without it, reaching Brazil or Singapore means writing a second QR generator; with it, one.",
"a": "money",
"k": "std",
"c": [
"GLOBAL"
],
"p": "One QR format payment apps worldwide can read",
"m": "Not built",
"src": "register",
"id": "s24"
},
{
"g": "Commercial",
"n": "NPCI UPI deep link",
"w": "upi://pay — the payee, amount and reference a UPI app reads",
"ex": "upi://pay?pa=shop@okhdfc&am=140.00&cu=INR&tn=CB-C1-0007",
"exWhy": "India only, and the same string the storefront already builds — so a customer scanning at the counter and one scanning online reach the same payee with the same reference.",
"s": "live",
"note": "lib/profile PAY_SCHEMES.upi, encoded by the counter and the storefront from one shape. The money moves bank to bank; nothing passes through ChitBridge and nothing here confirms a payment.",
"at": "Counter · Storefront",
"go": "till",
"why": "A shop with no card terminal can still be paid without cash, and a QR needs no internet to draw.",
"a": "money",
"k": "std",
"c": [
"IN"
],
"p": "Customers pay by UPI with the amount already filled in",
"src": "register",
"id": "s25"
},
{
"g": "Commercial",
"n": "ISO/IEC 18004",
"w": "The QR symbology itself — how a string becomes a printable code",
"ex": "version 0 · error correction M",
"exWhy": "The symbol standard beneath every payment QR. We encode, we do not invent: qrcode-generator 1.4.4 (MIT), vendored so a till with no internet can still draw one.",
"s": "live",
"note": "app/../engine/qr.js — the one third-party file on the till, pinned in package.json so an upgrade shows in a diff.",
"at": "Counter · how the bill is paid",
"go": "till",
"why": "A hand-rolled encoder would be a wrong QR that takes money somewhere else.",
"a": "money",
"k": "std",
"c": [
"GLOBAL"
],
"p": "The QR code prints and scans reliably",
"src": "register",
"id": "s26"
},
{
"g": "Accessibility",
"n": "WAI-ARIA APG · combobox",
"w": "List autocomplete with MANUAL selection",
"ex": "aria-autocomplete=\"list\"",
"exWhy": "“The character string the user has typed will become the value unless the user selects a value in the popup” — so arrowing through the list never overwrites what was typed.",
"s": "part",
"note": "The behaviour is followed at the counter: the search box is a COMMAND box, so a chosen product goes to the cart and the query is cleared, never replaced. ⚠️ Missing: aria-activedescendant, so a screen reader is not told which row is marked.",
"at": "Counter · the search box",
"go": "till",
"why": "Filling the box on every arrow press destroys the query — arrow past your item and your typing is gone.",
"a": "look",
"k": "std",
"c": [
"GLOBAL"
],
"p": "The counter search never picks an item you did not choose",
"m": "Followed at the counter; not audited",
"src": "register",
"id": "s27"
},
{
"g": "Records & data",
"n": "schema.org ItemAvailability",
"w": "What a product's status MEANS outside our walls",
"ex": "available → https://schema.org/InStock",
"exWhy": "Three of our four map directly. The human words stay the screen vocabulary — a trader says “not available”, not a URL — and the standard value travels beside them.",
"s": "live",
"note": "lib/itemstatus.js SCHEMA_ORG. ⚠️ We are deliberately FINER than the standard in one place: schema.org has a single Discontinued, which conflates “we stopped selling it” with “use that one instead”; the second carries a successor and is worth acting on, so retired and redundant stay apart and both export as Discontinued.",
"at": "Catalogue · a product's status",
"go": "catalogue",
"why": "A status only we understand is a status no storefront, feed or buyer can act on.",
"a": "sell",
"k": "std",
"c": [
"GLOBAL"
],
"p": "“In stock” means the same thing outside our app",
"src": "register",
"id": "s28"
},
{
"g": "Records & data",
"n": "GDSN",
"w": "Sharing product data BETWEEN companies, on GS1 identity",
"ex": "GS1 data pools",
"exWhy": "The network suppliers and retailers already use to exchange item data.",
"s": "plan",
"note": "Not implemented. The identity it needs (GS1) is carried already, which is what makes it reachable later.",
"at": "Catalogue · cross-company",
"go": "catalogue",
"why": "The same discipline as our own catalogue, one boundary further out — worth naming so it is a decision, not an oversight.",
"a": "buy",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Share product data with other companies on the same codes",
"m": "Not built; the GS1 codes it needs are in place",
"src": "register",
"id": "s29"
},
{
"g": "Records & data",
"n": "ISO 17442 (LEI)",
"w": "Legal Entity Identifier",
"ex": "5493001KJTIIGC8Y1R12",
"exWhy": "20 characters that identify one legal entity globally. Checkable against GLEIF — which we do not yet do, hence \"partly\".",
"s": "part",
"note": "A field exists to record it; the value is not verified against GLEIF.",
"at": "Trade readiness",
"go": "readiness",
"why": "The same company recognised across registers and borders.",
"a": "people",
"k": "std",
"c": [
"GLOBAL"
],
"p": "A company’s global ID can be recorded",
"m": "Not checked against GLEIF yet",
"src": "register",
"id": "s30"
},
{
"g": "Records & data",
"n": "ISO 6523",
"w": "Organisation identifier SCHEME, so an id says which register it came from",
"ex": "0195:198912345K",
"exWhy": "<b>Scheme first.</b> \"198912345K\" alone is meaningless; <code>0195</code> says it is a Singapore UEN. The scheme is the half everyone drops.",
"s": "plan",
"at": "Profile · identity",
"go": "readiness",
"why": "\"GSTIN 29ABC\" means nothing until you know it is a GSTIN. The scheme is the half everyone drops.",
"a": "people",
"k": "std",
"c": [
"GLOBAL"
],
"p": "A company ID says which register it came from",
"m": "Not built; IDs are kept without their register",
"src": "register",
"id": "s31"
},
{
"g": "Records & data",
"n": "UN/LOCODE",
"w": "Places, ports and terminals",
"ex": "INMAA",
"exWhy": "Chennai, India. Five characters, and no argument about whether \"Madras\", \"Chennai Port\" and \"MAA\" are the same place.",
"s": "plan",
"at": "Network · places",
"go": "network",
"why": "\"Chennai\" is a city, a port and three terminals. A shipment needs to know which.",
"a": "buy",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Places and ports named by one world code",
"m": "Not built",
"src": "register",
"id": "s32"
},
{
"g": "Identity & access",
"n": "ISO/IEC 24760",
"w": "The IAM vocabulary — identity · identifier · attribute",
"s": "part",
"note": "We use its distinctions; we do not implement its lifecycle model.",
"ex": "bridge_id = identifier · display_name = attribute · the entity = identity",
"exWhy": "⭐ This is the distinction the IAM page is built on. A Bridge ID is not an identity and a name is not an identifier — conflating them is what made \"Identity\" the wrong name for a page about five different kinds of party.",
"at": "IAM",
"go": "identity",
"why": "Gives us the words for the thing we kept getting wrong: an identifier is not an identity.",
"a": "people",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Clear words for who someone is and what they hold",
"m": "Its words are used; its lifecycle model is not",
"src": "register",
"id": "s33"
},
{
"g": "Identity & access",
"n": "RBAC (ANSI INCITS 359)",
"w": "Role-based access — coarse, five roles",
"s": "part",
"note": "The hat IS role-based, but roles are fixed and not composable; there is no permission-to-role assignment.",
"ex": "view_only · act · audit · mis · manager",
"exWhy": "One role per co-assist, enforced on every write since 2026-08-18. Not fine-grained: you cannot grant \"may edit catalogue but not send chits\".",
"at": "IAM · Co-assists",
"go": "coassists",
"why": "⭐ An owner can answer \"what can this person do\" in one word, which is the whole point of roles over permission lists.",
"a": "people",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Staff see and do only what their role allows",
"m": "Five fixed roles; no custom permissions yet",
"src": "register",
"id": "s34"
},
{
"g": "Identity & access",
"n": "NIST SP 800-63B",
"w": "Authentication assurance",
"s": "part",
"note": "One-time code to a verified channel is roughly AAL2 single-factor; we do not claim an audited level.",
"ex": "ravi@alpha-timers + a one-time code",
"exWhy": "Possession of the channel proves identity. No password to leak, reuse or phish — which is why there is no password reset flow to attack.",
"at": "Sign-in",
"go": "",
"why": "States honestly what our sign-in does and does not prove.",
"a": "people",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Sign-in with a one-time code to a verified phone or email",
"m": "About AAL2, single factor; not certified",
"src": "register",
"id": "s35"
},
{
"g": "Identity & access",
"n": "SCIM (RFC 7644)",
"w": "Provisioning identities from an HR system",
"s": "plan",
"ex": "—",
"exWhy": "Not built. It matters only when a customer wants their HR system to create and remove co-assists automatically — real for a large operator, irrelevant to a shop.",
"at": "Co-assists — where it would provision",
"go": "coassists",
"why": "Removes the manual add/remove step for a business that already runs an HR system.",
"a": "people",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Staff accounts could come straight from an HR system",
"m": "Not built",
"src": "register",
"id": "s36"
},
{
"g": "Identity & access",
"n": "OAuth 2 · OIDC",
"w": "Federated sign-in",
"s": "plan",
"ex": "—",
"exWhy": "⚠️ Deliberately not adopted. We ISSUE credentials rather than delegating to an identity provider — a chit is signed by a party we authenticated, and federating that would put a third party between a business and its own record.",
"at": "Sign-in — where it would replace our own",
"go": "",
"why": "Would let people sign in with an existing account — at the cost of who vouches for the signature on a chit.",
"a": "people",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Sign in with an account you already have",
"m": "Not built",
"src": "register",
"id": "s37"
},
{
"g": "Platform",
"n": "RFC 7519 (JWT)",
"w": "Session tokens",
"ex": "eyJhbGciOiJIUzI1NiJ9.…",
"exWhy": "Three base64 parts: header, claims, signature. Any reviewer can decode the middle one and see exactly what we assert about a session.",
"s": "live",
"at": "Sign-in",
"go": "",
"why": "A credential format every reviewer already knows how to audit.",
"a": "build",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Your session is a sealed, standard token",
"src": "register",
"id": "s38"
},
{
"g": "Platform",
"n": "Idempotency-Key",
"w": "A mutation runs at most once, even on replay",
"ex": "Idempotency-Key: 9f2c…a41",
"exWhy": "Send the same order twice after a dropped connection and the second is recognised and ignored. Without it, offline replay would be unsafe to offer.",
"s": "live",
"at": "Every mutation · offline replay",
"go": "",
"why": "⭐ A retry after a dropped connection cannot double-send an order. Without it, offline queueing would be unsafe to offer at all.",
"a": "build",
"k": "prac",
"c": [
"GLOBAL"
],
"p": "Saving twice — or replaying after going offline — never saves twice",
"src": "register",
"id": "s39"
},
{
"g": "Platform",
"n": "PostgreSQL RLS",
"w": "Tenant isolation enforced by the database",
"ex": "USING (entity_id = current_setting(...))",
"exWhy": "The database refuses rows from another tenant even if the query forgets to filter. Isolation that survives a mistake in application code.",
"s": "live",
"note": "FORCE RLS on the entity-data tables; identities is a documented carve-out for cross-tenant discovery.",
"at": "Every entity-scoped read",
"go": "",
"why": "Isolation that survives a mistake in application code, because the database refuses rather than trusting the query.",
"a": "people",
"k": "prac",
"c": [
"GLOBAL"
],
"p": "Another business can never read your records",
"src": "register",
"id": "s40"
},
{
"g": "Commercial",
"n": "Incoterms 2020 (ICC)",
"w": "Who bears cost and risk, and to what point",
"ex": "FOB Chennai (Incoterms 2020)",
"exWhy": "Risk and cost pass to the buyer once the goods are on board at Chennai. Three words that decide who pays if the container is damaged mid-ocean.",
"s": "part",
"note": "Carried on instruments and forms; not yet enforced against the shipment record.",
"at": "Chits · instruments",
"go": "",
"why": "⭐ Who pays freight and where risk passes, agreed in writing BEFORE the dispute rather than argued after it.",
"a": "buy",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Who pays freight and where risk passes, agreed in writing",
"m": "Carried on forms; not checked against the shipment",
"src": "register",
"id": "s41"
},
{
"g": "Commercial",
"n": "UCP 600 · ISBP 745",
"w": "Documentary credits",
"ex": "—",
"exWhy": "Not built. When it is, it is the ruleset a bank checks the documents against before releasing payment.",
"s": "plan",
"at": "Instruments",
"go": "",
"why": "The rules a bank will actually check the documents against.",
"a": "buy",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Letters of credit checked by the rules banks use",
"m": "Not built",
"src": "register",
"id": "s42"
},
{
"g": "Commercial",
"n": "HS codes (WCO)",
"w": "Tariff classification on goods",
"ex": "0904.11",
"exWhy": "<b>Pepper, whole.</b> Customs charges duty on THIS, not on your product name — so a seller who states it decides the tariff instead of discovering it at the border.",
"s": "plan",
"at": "Catalogue · goods",
"go": "catalogue",
"why": "What customs charges, decided by the seller rather than discovered at the border.",
"a": "sell",
"k": "std",
"c": [
"GLOBAL"
],
"p": "The customs code on your goods — set by you, not at the border",
"m": "Not built",
"src": "register",
"id": "s43"
},
{
"g": "Commercial",
"n": "ISO 20022",
"w": "Financial messaging",
"ex": "—",
"exWhy": "Not built. It is the payment message a bank consumes without a bespoke file per customer.",
"s": "plan",
"at": "Settlement",
"go": "",
"why": "Payment instructions a bank can consume without a bespoke file.",
"a": "money",
"k": "std",
"c": [
"GLOBAL"
],
"p": "Payment instructions a bank reads without a custom file",
"m": "Not built",
"src": "register",
"id": "s44"
},
{
"n": "Golden rules of double entry",
"w": "Personal · real · nominal: where each line’s Dr and Cr go",
"s": "live",
"a": "books",
"k": "prac",
"c": [
"GLOBAL"
],
"p": "Every entry’s Dr and Cr placed by rule, shown before you save",
"at": "＋ Entry · the preview",
"go": "entry",
"ex": "Personal: debit the receiver, credit the giver",
"why": "A rule the CA can check line by line, instead of trusting the software.",
"note": "",
"src": "added 2026-10-03",
"g": "Books",
"id": "s45"
},
{
"n": "Companies Act 2013 s.128 + Rule 3(1), Accounts Rules",
"w": "Audit trail, from 1 Apr 2023",
"s": "live",
"a": "books",
"k": "law",
"c": [
"IN"
],
"p": "Books cannot be edited quietly: fixes are reversals and every change is logged",
"at": "Day book · Audit trail",
"go": "daybook",
"ex": "Rule 3(1) proviso: an edit log that cannot be switched off",
"why": "The law since 1 April 2023 — and the reason a CA can sign off without re-checking every entry.",
"note": "",
"src": "added 2026-10-03",
"g": "Books",
"id": "s46"
},
{
"n": "Schedule III, Companies Act (Division I)",
"w": "How the balance sheet and P&L are laid out",
"s": "live",
"a": "books",
"k": "law",
"c": [
"IN"
],
"p": "Balance sheet and P&L laid out the way the law asks",
"limit": "Company format in force; a proprietor’s statements use one Capital account",
"at": "Reports · Balance sheet",
"go": "balance",
"ex": "GST credit shown as an asset",
"eq": "IAS 1 (presentation) abroad",
"why": "A bank, a buyer or an auditor reads it without asking how it was arranged.",
"note": "",
"src": "added 2026-10-03",
"g": "Books",
"id": "s47"
},
{
"n": "AS 2 / Ind AS 2",
"w": "Inventories",
"s": "live",
"a": "books",
"k": "std",
"c": [
"IN"
],
"p": "Closing stock valued at the lower of cost and selling value",
"limit": "Manual count today; automatic once quantities are tracked",
"at": "Month & year end · Closing stock",
"go": "closingstock",
"eq": "IAS 2 abroad",
"why": "Stops profit being overstated by stock that will not sell at cost.",
"note": "",
"src": "added 2026-10-03",
"g": "Books",
"id": "s48"
},
{
"n": "AS 10 / Ind AS 16 + Schedule II; Income-tax Act s.32 + Appendix I",
"w": "Assets and depreciation, by type of business; WDV and the 180-day rule",
"s": "live",
"a": "books",
"k": "law",
"c": [
"IN"
],
"p": "Assets depreciated the right way for your type of business",
"at": "Month & year end · Assets & depreciation",
"go": "assets",
"eq": "IAS 16 abroad",
"why": "One asset, two correct numbers — the books’ and the tax return’s — kept side by side.",
"note": "",
"src": "added 2026-10-03",
"g": "Books",
"id": "s49"
},
{
"n": "Tally voucher types",
"w": "Sales, Purchase, Receipt, Payment, Contra, Credit/Debit note, Journal",
"s": "live",
"a": "books",
"k": "prac",
"c": [
"IN"
],
"p": "Entries numbered by type — sales, purchase, receipt… — as your CA expects",
"at": "Day book",
"go": "daybook",
"ex": "SV · PV · RV · PY · CV · CN · DN · JV · MJ",
"why": "The series every Indian CA already reads; nothing to learn.",
"note": "",
"src": "added 2026-10-03",
"g": "Books",
"id": "s50"
},
{
"n": "SA 505 (external confirmations)",
"w": "Party balance confirmation; monthly mutual reconciliation",
"s": "plan",
"a": "books",
"k": "std",
"c": [
"IN"
],
"p": "Each party’s balance confirmed with the party, month by month",
"m": "Not built; monthly agreement with each party is next",
"at": "Ledgers · a party",
"go": "ledgers",
"eq": "ISA 505 abroad",
"why": "A balance both sides have agreed is evidence; one side’s balance is a claim.",
"note": "",
"src": "added 2026-10-03",
"g": "Books",
"id": "s51"
},
{
"n": "SA 240 (fraud risk)",
"w": "Manual journals are tested first",
"s": "live",
"a": "books",
"k": "std",
"c": [
"IN"
],
"p": "Hand-made entries are numbered MJ, so they are checked first",
"at": "Day book · filter MJ",
"go": "daybook",
"eq": "ISA 240 abroad",
"why": "Where an auditor looks first for fraud, the app makes the looking easy.",
"note": "",
"src": "added 2026-10-03",
"g": "Books",
"id": "s52"
},
{
"n": "CGST Act s.49 / 49A / 49B, Rule 88A",
"w": "The order GST credit is used in",
"s": "live",
"a": "money",
"k": "law",
"c": [
"IN"
],
"p": "GST credit used in the legal order; CGST and SGST never cross",
"at": "Month & year end · GST close & pay",
"go": "gstclose",
"why": "Using credit in the wrong order means paying cash you did not owe.",
"note": "",
"src": "added 2026-10-03",
"g": "Money & GST",
"id": "s53"
},
{
"n": "CGST Act s.9(3)/9(4) + notifications; s.49(4), Rule 86(2)",
"w": "Reverse charge, paid in cash only",
"s": "live",
"a": "money",
"k": "law",
"c": [
"IN"
],
"p": "Reverse-charge GST worked out, and paid in cash as the law requires",
"limit": "Worked out by the engine; the screens follow",
"at": "Bills · Returns",
"go": "returns",
"why": "Reverse charge cannot be paid from credit; getting it wrong is interest and a notice.",
"note": "",
"src": "added 2026-10-03",
"g": "Money & GST",
"id": "s54"
},
{
"n": "GST (Compensation to States) Cess Act 2017, s.11(2)",
"w": "Cess and cess credit",
"s": "live",
"a": "money",
"k": "law",
"c": [
"IN"
],
"p": "Cess posted on its own; cess credit pays only cess",
"at": "GST close & pay",
"go": "gstclose",
"why": "Cess credit spent on GST is a mismatch the department will find.",
"note": "",
"src": "added 2026-10-03",
"g": "Money & GST",
"id": "s55"
},
{
"n": "GSTR-1 / GSTR-3B (GSTN schema)",
"w": "Monthly returns",
"s": "part",
"a": "money",
"k": "law",
"c": [
"IN"
],
"p": "Returns built from your own bills and matched to the Ledger",
"m": "Built; filing through a GSP is not connected",
"at": "GST · Returns",
"go": "returns",
"why": "A return that comes from the bills cannot disagree with them.",
"note": "",
"src": "added 2026-10-03",
"g": "Money & GST",
"id": "s56"
},
{
"n": "CGST Act s.16(2)(aa) + GSTR-2B",
"w": "Input credit only when the supplier filed",
"s": "part",
"a": "money",
"k": "law",
"c": [
"IN"
],
"p": "Input credit claimed only when your supplier has filed",
"m": "Matching built; its screen comes next",
"at": "GST · 2B match",
"go": "twobmatch",
"why": "Credit claimed before the supplier files is credit you may have to pay back with interest.",
"note": "",
"src": "added 2026-10-03",
"g": "Money & GST",
"id": "s57"
},
{
"n": "e-invoice INV-01 schema 1.1 (IRP); e-way bill, Rule 138",
"w": "e-invoice and e-way bill payloads",
"s": "part",
"a": "money",
"k": "law",
"c": [
"IN"
],
"p": "e-invoices and e-way bills prepared and checked",
"m": "No GSP connection yet (decision pending)",
"at": "GST · e-invoice / e-way bill",
"go": "einvoice",
"eq": "PEPPOL BIS abroad (see UBL)",
"why": "Above the turnover limit an invoice without an IRN is not a valid invoice.",
"note": "",
"src": "added 2026-10-03",
"g": "Money & GST",
"id": "s58"
},
{
"n": "CGST Act s.50",
"w": "Interest on late GST",
"s": "live",
"a": "money",
"k": "law",
"c": [
"IN"
],
"p": "Interest on late GST worked out for you",
"at": "GST close & pay",
"go": "gstclose",
"why": "So the interest is known before the department says it.",
"note": "",
"src": "added 2026-10-03",
"g": "Money & GST",
"id": "s59"
},
{
"n": "Digital Personal Data Protection Act 2023",
"w": "Purpose, consent, the right to see, correct and erase",
"s": "part",
"a": "people",
"k": "law",
"c": [
"IN"
],
"p": "Customer data used only for its purpose, with consent; people can see, correct or erase theirs",
"m": "Rules decided; consent records come with CRM phase 5",
"at": "Parties ↗ (CB CRM)",
"go": "crm",
"eq": "Like the GDPR in the EU",
"why": "No scraping, no guessing sensitive facts: the customer’s data stays theirs.",
"note": "",
"src": "added 2026-10-03",
"g": "People & privacy",
"id": "s60"
},
{
"n": "RBI Account Aggregator (ReBIT FI schema)",
"w": "Bank statements by consent",
"s": "plan",
"a": "money",
"k": "law",
"c": [
"IN"
],
"p": "Bank statements fetched with your consent, not typed in",
"m": "Not built; decision pending (FIU)",
"at": "Daily · Bank (reconcile)",
"go": "bank",
"why": "Statements straight from the bank cannot be mistyped.",
"note": "",
"src": "added 2026-10-03",
"g": "Money & GST",
"id": "s61"
}
],
"why": {
"pleasure": [
[
"No integration project per counterparty",
"A record in ISO 8601, ISO 4217 and GS1 lands in someone else's ERP already meaning what it says. A record in our own formats needs a mapping written for every partner — which is the cost that kills small platforms."
],
[
"A standard turns an argument into a fact",
"This is the one that matters most for disputes. \"When did this happen\" was three different answers until every timestamp carried its zone. \"Is this the same product\" is unanswerable without a shared identifier. Standards are how evidence stops being contestable."
],
[
"Your data outlives us",
"A record only this platform can read is a record you do not own. Standard formats mean you can leave — and being able to leave is the reason it is safe to start."
],
[
"Trust without a track record",
"⭐ We are small and new. We cannot point at twenty years of customers. We CAN say exactly which standards we implement, which ones only partly, and what is missing from each — and that is a claim a buyer can check for themselves in an afternoon."
]
],
"pain": [
[
"Slower to build",
"Every feature begins by reading a specification instead of inventing something that would work by Friday."
],
[
"Standards are bigger than the need",
"BCP 47 admits thousands of tags we will never use; CLDR ships data for languages we do not offer. Adopting one means accepting its whole shape, not the convenient corner."
],
[
"They move",
"CLDR changes twice a year, Incoterms roughly every decade, and a weekend can change by decree — the UAE's did in 2022. Following a standard is a subscription, not a purchase."
],
[
"⚠️ They create an obligation to be honest",
"The real cost, and the one worth paying. Once we say \"WCAG AA\", a failing contrast stops being a bug and becomes a broken promise. That is exactly why every row above carries a status and every partial one says what is missing."
]
],
"proof": [
"The contrast tool found <b>117 real failures</b> in themes that had already shipped — including body text at 2.57:1 in the smallest font on screen. Nobody had caught them by eye, across months.",
"CLDR said the <b>UAE weekend changed to Sat–Sun in 2022</b>. Four places in our own code and comments said Fri+Sat, including the label on a passing test.",
"<b>Intl proved a region cannot carry one direction</b> — the UAE needs English (LTR) beside Arabic (RTL). The design assumed it could; the standard's data disproved it before a user met it.",
"The gettext extractor showed <b>1,122 of our strings are sentence fragments</b> that cannot be translated at all. Wrapping them would have produced confident nonsense in three languages."
]
},
"record": [
{
"k": "chit_id",
"v": "\"8f3a1c94-…\"",
"std": "",
"s": "live",
"c": "Our own id. Every OTHER field below is somebody else's standard."
},
{
"k": "sealed_at",
"v": "\"2026-08-18T14:32:05Z\"",
"std": "ISO 8601",
"s": "live",
"c": "Unambiguous instant. \"18/08/2026\" would be a different day in New York."
},
{
"k": "zone",
"v": "\"Asia/Kolkata\"",
"std": "IANA tz",
"s": "live",
"c": "The zone, not the offset — an offset is wrong twice a year."
},
{
"k": "seller.id",
"v": "\"0195:198912345K\"",
"std": "ISO 6523",
"s": "plan",
"c": "Scheme first. Today we store the number without saying which register it came from."
},
{
"k": "seller.lei",
"v": "\"5493001KJTIIGC8Y1R12\"",
"std": "ISO 17442",
"s": "part",
"c": "We hold it; we do not yet check it against GLEIF."
},
{
"k": "buyer.locale",
"v": "\"ar-AE\"",
"std": "BCP 47",
"s": "live",
"c": "How the buyer reads figures. It does NOT change what the seller wrote."
},
{
"k": "terms",
"v": "\"FOB INMAA (Incoterms 2020)\"",
"std": "Incoterms · UN/LOCODE",
"s": "part",
"c": "Carried on the record. We do not yet check the shipment against it, and UN/LOCODE is not validated."
},
{
"k": "line.gtin",
"v": "\"08901234567894\"",
"std": "GS1",
"s": "part",
"c": "Both sides know it is the same product. Check digit not enforced yet."
},
{
"k": "line.hs_code",
"v": "\"0904.11\"",
"std": "HS (WCO)",
"s": "plan",
"c": "Pepper, whole. Customs charges on THIS, not on the product name."
},
{
"k": "line.name",
"v": "\"Black pepper, whole\"",
"std": "— never translated —",
"s": "live",
"c": "⚠️ The author's words, in the author's language. A chit is a shared record; one that read differently to each party would not be a record."
},
{
"k": "line.price",
"v": "{ \"amount\": 1250.00, \"currency\": \"AED\" }",
"std": "ISO 4217",
"s": "live",
"c": "A pair, never the string \"AED 1250\". And never converted — converting invents a rate nobody agreed."
},
{
"k": "_headers",
"v": "Idempotency-Key: 9f2c…a41",
"std": "Idempotency-Key",
"s": "live",
"c": "Send it twice after a dropped connection; the second is recognised and ignored."
}
],
"kural": {
"no": 118,
"ta": [
"சமன்செய்து சீர்தூக்குங் கோல்போல் அமைந்தொருபால்",
"கோடாமை சான்றோர்க் கணி"
],
"en": "Like a scale that weighs evenly and leans to neither side: that is the mark of the wise."
}
};
