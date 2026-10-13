# COUNTRY COVERAGE — does every part of the product work for India, Australia and the UAE? (CX0, 2026-10-13)

Owner (2026-10-13): *"assume country specific completed, ensure that it touches all parts of the product at least for 3 countries, India, Aus and UAE."*
The ENGINES side is complete: three registered packs (reg-in · reg-au · reg-ae, engines `docs/COUNTRY-MATRIX.md` v1.41.0 — IN 72 ✅ / 15 ❌, AU 76 / 14,
AE 80 / 8, the ❌ all MAY members). This file is the PRODUCT side, from CODE FACTS: every area × IN / AU / AE, every bug with its file:line and the
fix as a pack member, a gate, or a locale helper, and the ORDER of fix rounds. What CX0 itself fixed is marked **✅ CX0**. The Country rule (DECISIONS,
13 Oct): a country is fixed once a product or transaction exists — no conversion; every fix below READS the pack (`regulation.packFor` · `CBRegulation.packFor`
· `CBTaxPacks.packFor` · web `shopReg()` in app/helpers.js · till `shopPack()`), never a second `if (country === 'IN')`.

Method: grep for India's words (`INR · ₹ · en-IN · +91 · GSTIN · CGST · SGST · IGST · HSN · Schedule III · UPI · PAN · Udyam · Tally · Asia/Kolkata · state codes`)
over web `public/` (~1,900 hits) and api `lib/ routes/` (~800); each CODE hit read in context and classed **A** (belongs in a pack), **B** (India-only,
correctly gated — the gate named), **C** (ungated India assumption). The Standard's own known Part-B breaches (`locale.js REGIONS`, `govcontext ZONES`,
`profilemap.js` India address, `jurisdiction.REGISTRATION`) are ⚠️ with the Standard's sentence, not re-reported. Lines are as of this branch.

## 0. The one structural fact every ❌ in Accounts and Finance comes back to

The api's BOOKS engines are adopted at **v1.20.0** (`lib/accounts-packs.js:1`, `posting.js`, `ledger.js`, `bookpack.js`); regulation is v1.37, gst-returns v1.39.
accounts-packs v1.20 holds `PACKS = { IN }` only (`lib/accounts-packs.js:226-240`): `packFor('AU' | 'AE')` is **India's chart with `fallback: true`**. So an
Australian or Emirati ledger today has India's groups, Schedule III lines, s.49 set-off heads and the Income-tax depreciation note — even though reg-au and reg-ae
carry their own `groups · ledgers · sch3 · presentation · depreciation · setOff · taxHeads · returns` (api `lib/reg-au.js:490-508`, `lib/reg-ae.js:701-719`).
**The fix is one engines adopt** (accounts-packs · posting · ledger · bookpack at ≥ v1.41, whose `packFor` reads the regulation registry exactly as `tax-packs.js:35`
already does) — fix round 2 below. Until then this round made the books OPEN in the shop's own country, money and year (**✅ CX0** api `lib/books.js enable`:
reads `country-setup.profile`, never `'IN'` by default) and REFUSE India's close elsewhere (**✅ CX0** `lib/books-period.js indiaOnly`), so an AU/AE shop is told,
not quietly given Indian books.

## 1. Area × country

Legend: ✅ works from the pack · ⚠️ partial (named) · ❌ wrong or India's (named). Evidence is file:line.

| area · sub-area | IN | AU | AE | evidence |
|---|---|---|---|---|
| **Registration** · `identities.country` written at register | ✅ (the DB default) | ❌ DB default `'IN'` stays — `COALESCE(country, $2)` never writes | ❌ same | api `migrations/000_baseline.sql:577-578`, `routes/signin.js:481`, `b299_country_setup.sql:33` (⚠️ for Athi: `DROP DEFAULT`) |
| Registration · the clock names the country (M196) | ✅ | ❌ no `Australia/*` in ZONES → "unserved" | ✅ Asia/Dubai | api `lib/govcontext.browser.js:41-54` (⚠️ Standard breach: `pack.timeZones`) |
| **Country setup (CS1)** · prefill | ✅ | ⚠️ the DB default prefilled "India" — **✅ CX0** the clock's country wins before the step is done | same | web `app/cap-country.js:66-69` |
| Country setup · year · scheme · tax-id hint · currency placeholder from the pack | ✅ | ✅ CX0 (July · GST · ABN) | ✅ CX0 (January · VAT · TRN) | web `app/cap-country.js:48-53, 69-70` |
| Country setup · currencies offered | ✅ INR | ❌ no `REGIONS.AU` → only the saved code | ✅ AED | web `engine/locale.js:99-108` (⚠️ Standard breach: `pack.locale`) |
| Country setup · the tax id checked by the pack on save | ✅ checksum | ✅ CX0 `abn.check` | ✅ CX0 `trn.check` (format) | api `lib/country-setup.js:103-112` |
| Country setup · a country change refused (new entity) · books gate · 422 in words | ✅ | ✅ | ✅ | api `lib/country-setup.js:124, 166-169` |
| **Till** · tax engine reads the seller's pack | ✅ | ✅ | ✅ | till.html `billMoney` (seller `Country`), api `lib/tax.js:236-243` |
| Till · slip foot heads (one head vs CGST/SGST) | ✅ | ✅ CX0 | ✅ CX0 | till.html `taxSummaryHTML` (`bill.supply === 'domestic'`) |
| Till · screen bill · day report · shop panel words | ✅ | ✅ CX0 (`schemeWord · packSplitsByState`) | ✅ CX0 | till.html `packSplitsByState()`, day report "Tax by rate", `shopBoxPaint` |
| Till · tax-id label on paper and panel | ✅ | ✅ CX0 ABN | ✅ CX0 TRN | till.html `taxIdLabel()` |
| Till · the shop form accepts the country's tax id | ✅ | ✅ CX0 `abn.check` (was refused: "not the shape of a GSTIN") | ✅ CX0 `trn.check` | till.html `shopCheck`; api `routes/till.js:2026` |
| Till · place of supply · state clash | ✅ | ✅ CX0 (no state off an ABN) | ✅ CX0 (a PO Box no longer reads as a state) | till.html `shopStateClash`, `billMoney`; api `routes/till.js state_code` CX0 |
| Till · tax-invoice rules (full vs simplified, buyer's identity) | ✅ Rule 46 | ❌ `pack.taxInvoice(total_minor)` never read (A$1,000 / buyer ABN) | ❌ same (AED 10,000 / buyer TRN) | till.html `slipHeadHTML` titles typed; no caller of `taxInvoice` in till, tax-lines, tax-copy, invoice |
| Till · rounding | ✅ | ⚠️ no 5c cash rounding member (`cashRounding` ❌ in every pack) | ✅ | `engine/tax.js:2843` reads `invoice_round_to` |
| Till · payment ways · UPI | ✅ | ✅ CX0 (`packHasUpi`; server `jurisdiction.js:134`) | ✅ CX0 | till.html `paintPays`, `paySummaryWays`; ⚠️ no AU/AE QR scheme (`PAY_SCHEMES`) — Cash and Card only, honest |
| Till · bill-number year | ✅ `docnumber RULES.IN` | ⚠️ falls to `'*'` (calendar year, no July reset) | ⚠️ `'*'` (January — right by accident) | `engine/docnumber.js` RULES; till.html `fyOf` (April) is the no-engine fallback |
| Till · money, counts, voice | ✅ | ⚠️ counts `toLocaleString('en-IN')`; no en-AU voice | ⚠️ same; ta/hi offered, no ar | till.html `:6774, 14204, 18194` (counts); `:3756` voice list |
| Till · currency default (api) | ✅ | ✅ CX0 (the pack's money) | ✅ CX0 | api `routes/till.js` snapshot `currency`; ❌ still `routes/invoice.js:33,44`, `lib/tax-lines.js:151`, `lib/tax-copy.js:77` |
| **Print / share** · slip money · share text | ✅ | ✅ `CBLocale.money(n, cur)` | ✅ | till.html `money()`, `shareText` |
| Print / share · bill step labels (api) | ✅ | ❌ `toLocaleString('en-IN')`, `₹` | ❌ "AED 1,00,000" | api `lib/bill-privacy.js:61-63` |
| Print / share · UPI QR on a chit / the shop page | ✅ | ✅ CX0 (chit: `payHasUpi`) · ❌ shop page shows a UPI block whenever `upi_id` is set, `cu=INR` typed | same | web `app.html chitPaymentCell`; `shop.html:665-669` |
| Print / share · bill-print.html | ⚠️ a standalone printer test with India sample data (GSTIN, CGST/SGST, HSN) — not a product screen | — | — | web `bill-print.html:143-190` |
| **Shop / online showcase + cart** · price currency | ✅ | ✅ CX0 (`symOf`, `CBLocale.money`) | ✅ CX0 | `shop.html:510, 680`, `store.html:62`, `embed.html:53/83` |
| Shop · the page knows its country (so it can read a pack) | ✅ by default | ❌ the catalogue payload carries `currency_code · gstn · upi_id`, no `country` | ❌ | api `lib/catalogue-view.js:533-535` |
| Shop · "GSTIN" line · UPI block | ✅ | ❌ label typed; block gated on `upi_id` only | ❌ | `shop.html:589, 665, 669` |
| Shop · tax on items and orders (the shelf) | ✅ | ✅ `gstn` is the generic registration column — country-setup writes the ABN there | ✅ TRN | api `lib/tax-shelf.js:59` (⚠️ the column's NAME is India's) |
| Cart · tax chip and slab words | ✅ | ✅ CX0 (`t.scheme`) | ✅ CX0 "+5% VAT" | web `app/cart.js:1712, 1739, 2029-2031` |
| Cart · `\|\| 'INR'` fallbacks | ✅ | ⚠️ 10 one-liners fall to INR when the session has no currency | ⚠️ | `app/cart.js:460, 477, 492, 562, 895, 912, 1697, 1725, 1902, 2061`; `app.html:2096 myCur` |
| Orders · chit currency · subject date | ✅ | ❌ `business_json.currency \|\| 'INR'`; en-IN date | ❌ | api `routes/chits.js:598, 171`, `routes/catalogue.js:1061, 1108` |
| **Catalogue** · tax split in the product preview (state vs border) | ✅ | ✅ CX0 (`P0.supply`) | ✅ CX0 | `app.html prodInvoiceModel · prodTaxPreviewHTML` |
| Catalogue · rate menu ("slab rates" definitions) | ✅ | ✅ CX0 (`pack.tax.rates`, GST 10 %) | ✅ CX0 (VAT 5 %) | `app/cap-definitions.js` key `tax` |
| Catalogue · ready-made slabs published per country | ✅ IN-GST-* | ❌ none (no AU region row) | ❌ none | api `lib/tax-governance.js:117-138`; migrations b81/b83/b202 |
| Catalogue · HSN field, column, switch | ✅ | ⚠️ sample-invoice column says "Code" (CX0); the form label "Code / HSN", the switch row and "GST Rule 46" note remain | ⚠️ | `app.html:12749, 13007, 13648, 13928` (gate: `pack.tax.hsn_digits`, IN own) |
| Catalogue · units · CSV import tax column | ✅ | ✅ "tax rate" maps | ⚠️ no "vat" header alias | api `lib/csv-preflight.js:59-60` |
| Catalogue · an entity slab with no scheme | ✅ | ✅ | ❌ stamped "GST" (`homeScheme_` = the default country's) | api `lib/tax-slab.js:56, 102` (engines) |
| **CB Accounts** · the books open in the shop's country · money · year | ✅ | ✅ CX0 (AU · AUD · July) | ✅ CX0 (AE · AED · January) | api `lib/books.js enable`; `routes/books.js:115` |
| Accounts · chart of accounts | ✅ | ❌ India's chart (`fallback: true`) | ❌ | api `lib/accounts-packs.js:227-240` — §0 |
| Accounts · statement words (Sch III / AASB 101 / IAS 1) | ✅ `pack.sch3` | ❌ Schedule III lines (fallback pack) | ❌ | api `lib/ledger.js:214-219` reads the pack correctly — the pack is India's |
| Accounts · the return (GSTR from the rail · BAS · VAT201) | ✅ | ❌ `/returns` reads `B.packOf(s)` (accounts-packs) which has no `.returns` → RETURN_FROM_RAIL; the web then paints India's GST close | ❌ | api `lib/books-period.js:497-498`, `routes/books.js:1013`; web `app/cap-period.js:456-463` |
| Accounts · GST set-off (s.49) · challan | ✅ | ✅ CX0 refused in words (`NOT_FOR_COUNTRY`) | ✅ CX0 | api `lib/books-period.js indiaOnly` |
| Accounts · financial year on screen (months, "This FY (Apr–Mar)") | ✅ | ❌ April months | ❌ | web `app/cap-books.js:958, 984, 1317, 1712-1713`; `app/cap-period.js:458-459` |
| Accounts · depreciation note · basis words | ✅ | ❌ "Income-tax Act written-down value" | ❌ | api `lib/books-period.js:186`; web `app/cap-period.js:146` |
| Accounts · Receive / Pay currency · UPI mode | ✅ | ✅ CX0 (ledger's currency; UPI only with the pack) | ✅ CX0 | web `accounts.html:657-658`, `app/cap-books.js payOpen` |
| Accounts · bank statement import presets | ✅ five banks | ⚠️ `pack.bank` exists (`$` prefixes) but nothing reads it; proposals `currency: 'INR'` | ⚠️ | web `engine/bank-recon.js:65-67, 110, 495` (engines) |
| Accounts · Tally export · GSTR-1 in the pack | ✅ | ✅ CX0 gated (`not_for_country` + sentence) | ✅ | api `lib/books-pack.js:75-79, 101`; ⚠️ the web never shows `tally.why` |
| Accounts · Insights "Tax" band | ✅ | ✅ CX0 (told where its return is) | ✅ | web `app/cap-admin.js:388-390` |
| Accounts · `functional_currency \|\| 'INR'` · "a rupee" · zone | ✅ | ⚠️ ~15 fallbacks; "differ by more than a rupee"; AU zone → Asia/Kolkata | ⚠️ | api `routes/books.js:97`, `lib/books-period.js:102…497`, `lib/books-hooks.js:197, 205, 398, 429` |
| **CB Finance** · dues ageing buckets | ✅ Sch III | ❌ India's buckets; `presentation.ageing` (AGE_AU) unread | ❌ | api `lib/ledger.js:453-463`, `lib/books-engines.js:160-165`; web `app/cap-books.js:1579-1594` |
| Finance · MSME (interest words, 45 days, Udyam) | ✅ engine only | ✅ hidden — `pack.checks.msme` is reg-in's alone; no screen paints it | ✅ | api `lib/receivables.js:359-361`; `lib/reg-in.js:614` |
| Finance · "Interest due" | ⚠️ a fixed 1.5 %/month guide | ❌ the same guide for every country, no law or term behind it | ❌ | api `lib/books-engines.js:173, 178` |
| Finance · cash-flow tax line | ✅ | ❌ "GST by the 20th" — India's GSTR-3B date and heads | ❌ (and "GST", not VAT) | api `lib/books-cashflow.js:31-32, 124, 183`; web `app/cap-finance-cash.js:24, 116` |
| Finance · cash · terms · limits currency | ✅ | ✅ CX0 (`bkCur` → the ledger's, else the pack's) | ✅ | web `app/cap-finance*.js`, `app/cap-books.js:140` |
| Finance · party tax-id schemes · State field | ✅ | ✅ CX0 (ABN first, no State) | ✅ CX0 (TRN) | web `app/cap-books.js bkTaxSchemes`, party edit sheet |
| Finance · traceability "₹ saved" | ✅ | ✅ CX0 | ✅ | web `app/cap-traceability.js` |
| **CRM** · tax-id word on the list and record | ✅ | ✅ CX0 ABN (`taxIdWord`) | ✅ CX0 TRN | web `app/cap-crm.js:330`, `app/cap-crm-record.js:226, 274-275, 304`, `app.html:9688, 5863`; `crm.html:465` learns the country |
| CRM · a party's tax id checked with the pack | ❌ kind only | ❌ | ❌ | api `lib/party-fields.js:51-55` (the shop's own id IS checked: `country-setup.js:109`) |
| CRM · address shape (State · PIN / postcode / Emirate) | ✅ | ❌ "State code 33" asked; postcode has no shape | ❌ no Emirate (`pack.emirates` unread) | web `app/cap-crm-record.js:306`; `engine/profilemap.js:31-37` (⚠️ Standard breach; `formats.address · postalCode · phone` ❌ in every pack) |
| CRM · phones | ✅ | ✅ no +91 typed | ✅ | api `lib/channels.js:28, 34` placeholders only |
| CRM · ID documents (PAN · Aadhaar) | ✅ | ❌ the web list is fixed; the api gate trusts a client-sent country, default IN | ❌ | web `app/cap-iddocs.js:43, 129`; api `routes/identity-docs.js:99, 161` |
| **Tasks & Orders** · money · dates | ✅ | ✅ (`CBLocale.date`, `bkMoney`; ⚠️ `cur \|\| 'INR'`) | ✅ | web `app/cap-tasks.js:96, 108`; api `lib/work-rows.js:77` |
| **Connector** (Tally is India's) | ✅ | ❌ offered as if it works ("company GSTIN set to…") | ❌ | api `routes/integrations.js:29-36, 142` (no country filter); web `app/cap-admin.js:4612-4614` |
| **Employees** · payroll out of scope, SAID per country | ⚠️ silent (an HTML comment) | ⚠️ silent | ⚠️ silent | web `employees.html:10`; `pack.scope.out.payroll` sentence exists in every pack (matrix A9), unread |
| **Network / rail** · IN seller → AE buyer | — | — | ❌ taxed as an intra-state sale (CGST 9 + SGST 9, place of supply = the seller's state) — should be an export (Pos 96, IGST under LUT / zero-rated) | api `lib/tax-lines.js:119` (`tookState`), `lib/tax.js:246-247` (engines `supplyType` compares states only) |
| Network · AE / AU seller → foreign buyer | — | ✅ `cross`, no tax | ✅ | api `lib/tax.js:251-254` |
| Network · chit currency vs the seller's | ❌ none | ❌ | ❌ | only payments refuse a mismatch (`routes/books.js:520`); chits take `business_json.currency` as given |
| Chit sheet · tax summary | ✅ | ✅ CX0 one-head column | ✅ CX0 | web `app/chit-sheet.js gstHTML` (`supply === 'domestic'`) |
| Chit pane · "₹ Price from catalogue" | ✅ | ❌ ₹ typed | ❌ | web `app/cap-chit2.js:296, 438-478` |
| **Locale** · region row (format tag · langs · currencies) | ✅ en-IN | ❌ no AU row → `FALLBACK 'en-IN'` (lakh grouping, dd/mm) | ✅ ar-AE (ar · en · hi · ur · ml), RTL from the language | web `engine/locale.js:99-109, 135, 155, 523-530` (⚠️ Standard breach: `pack.locale`) |
| Locale · money grouping · decimals | ✅ | ✅ (follows the CURRENCY; decimals from Intl) | ✅ | `engine/locale.js:777, 799`; `engine/money.js:362-372` |
| Locale · `symbol(code \|\| 'INR')` | ✅ | ⚠️ a missing code shows ₹ | ⚠️ | `engine/locale.js:648, 754` |
| Locale · day boundary / zone on the server | ✅ | ❌ AU → Asia/Kolkata when `identities.timezone` is empty | ✅ Asia/Dubai | api `lib/books-hooks.js:197, 210`; `routes/chits.js:1754`; `lib/crm.js:83`, `lib/crm-followups.js:38` |
| Locale · Kural (Tamil) band · till voice | ✅ | ⚠️ no country gate (a brand decision) | ⚠️ | web `app/kural.js:34, 130`; till.html `:3756` |
| Locale · licence / compliance rules | ✅ | ❌ `RULES[c] \|\| RULES.IN` — told it lacks Indian licences | ❌ | api `lib/licence-rules.js:36`, `lib/entity-header.js:50` |
| Locale · exporter lanes (readiness) | ✅ | ⚠️ `origin \|\| 'IN'` | ⚠️ | api `lib/readiness.js:151, 163`; web `app/cap-readiness.js:31…330` |

**❌ count (cells, after CX0's fixes): IN 2 · AU 24 · AE 22.** (IN's two: a party's tax id is never checked; a chit's currency is never compared with the seller's.)

## 2. The bug rows — file:line · class · the fix (pack member · gate · locale helper)

Round = the fix round in §3. Size ≤20 = fixable without an engines change in one small edit.

| # | area | file:line | class | what fails for AU / AE | fix | round | ≤20 |
|---|---|---|---|---|---|---|---|
| T1 | till | till.html `slipHeadHTML` ('TAX INVOICE' typed; no caller of `taxInvoice`) | A | AU: A$1,000+ needs the buyer's identity/ABN; AE: full vs simplified never decided | `shopPack().taxInvoice(total_minor, { buyer_registered })` → title + required fields; the till needs a place for a buyer's ABN/TRN (beside `cust.gstin`) | 1 | no |
| T2 | till | till.html `:6774, 14204, 18194` | C | counts read "1,00,000" | `CBLocale.number(n)` | 1 | yes |
| T3 | till | till.html `:5849 fyOf`, `engine/docnumber.js` RULES (IN, `*`) | C | AU bill numbers: calendar year, no July reset | RULES read `pack.fiscalYear.startMonth / label` (engines) | 1 | engines |
| T4 | till | till.html `:3756, 17172…26473` voice list | C | AE offered ta/hi, no ar; AU no en-AU | the list from `REGIONS[country].langs` + format tag | 1 | yes |
| T5 | till/api | api `routes/invoice.js:33, 44`, `lib/tax-lines.js:151`, `lib/tax-copy.js:77` | C | a preview / frozen invoice with no currency is INR; `Country \|\| 'IN'` | `regional.currencyFor(entity)` / the seller pack's `currency`; drop `'IN'` | 1 | yes |
| T6 | print | api `lib/bill-privacy.js:61-63` | C | "AUD 1,00,000", ₹ | `lib/locale.browser` money with the currency's tag | 1 | yes |
| T7 | till | `engine/jurisdiction.js PAY_SCHEMES` (no AU/AE) | A | Cash + Card only (honest) | a pack member for a QR scheme when one exists (PayID has none); AU 5c `cashRounding` | 1 | engines |
| S1 | shop | api `lib/catalogue-view.js:533-535` | C | the shop page cannot read a pack | add `country` to the `shop` block (FIELDS entry: source `identities.country`, read by shop.html) | 4 | yes |
| S2 | shop | `shop.html:589, 665, 669` | A/C | "GSTIN" typed; UPI block for any shop with `upi_id`, `cu=INR` | gate on `pack.chart.paymentModes.upi`; label from the pack (needs S1) | 4 | yes |
| S3 | shop | `shop.html:475, 606`, `promo.html:437-451`, `app/cart.js` ×10, `app.html:2096` | C | INR when the currency is unknown | `\|\| ''` → the locale engine shows the code; `myCur()` → the pack's `currency` | 4 | yes |
| S4 | orders | api `routes/chits.js:598, 171`, `routes/catalogue.js:1061, 1108` | C | chit/order stored in INR; en-IN subject dates | `regional.currencyFor(seller)` (as `:872`), refuse a mismatch like `routes/books.js:520`; the shop's tag + zone | 4 | yes |
| C1 | catalogue | api `lib/tax-governance.js:117-138` (no AU/AE regions) | A | no ready-made slabs | publish from `pack.tax.rates` (no migration) | 4 | no |
| C2 | catalogue | `app.html:12749, 13007, 13648, 13928` | C | "Code / HSN", the HSN switch, "GST Rule 46" note | gate on `pack.tax.hsn_digits` (IN own) | 4 | yes |
| C3 | catalogue | api `lib/tax-slab.js:56, 102`, `app/tax-slab.js:330` | A | an unnamed AE slab stamped "GST"; India's rate list | `schemeFor(country)` / `ratesFor(country)` in tax-slab (engines) | 4 | engines |
| C4 | catalogue | api `lib/csv-preflight.js:60` | A | "VAT %" header does not map | add `vat · vat % · vat rate` aliases | 4 | yes |
| A1 | accounts | api `lib/accounts-packs.js:227-240`, `posting.js:493, 599, 644`, `ledger.js`, `bookpack.js` (v1.20) | A | India's chart, lines, set-off, depreciation for AU/AE | **adopt the books engines ≥ v1.41** (accounts-packs reads the registry); then `enable`, `packOf`, `taxReturn` read `regulation.packFor` | 2 | engines adopt |
| A2 | accounts | api `lib/books-period.js:497-498` | A | BAS / VAT201 unreachable (RETURN_FROM_RAIL) | `pack.returns` from the regulation pack (after A1) | 2 | yes |
| A3 | accounts | api `lib/books-store.js:34`, `routes/books.js:97`, `books-period.js` ×15, `books-manual.js:220`, `books-cashflow.js:170` | C | `\|\| 4`, `\|\| 'INR'`, `\|\| 'IN'` | one `curOf(s)` / `fyOf(s)` that refuses when empty | 2 | yes |
| A4 | accounts | web `app/cap-books.js:958, 984, 1317, 1712-1713`, `app/cap-period.js:458-459` | A | April months and "Apr–Mar" for July / January years | `fy_start_month` on `/status` → `BK_MONTHS` from it | 2 | yes |
| A5 | accounts | api `lib/books-period.js:186`; web `app/cap-period.js:146` | A | Income-tax WDV named | `pack.depreciation.entityBases` + `pack.messages` | 2 | yes |
| A6 | accounts | api `lib/books-hooks.js:197, 210`, `routes/chits.js:1754`, `lib/crm.js:83`, `lib/crm-followups.js:38`, `lib/books-pack.js:54` | C | AU day cut at IST midnight when `identities.timezone` is empty | `pack.timeZones` (engines); until then refuse / ask for the zone — never Kolkata | 2 | yes |
| A7 | accounts | api `lib/books-hooks.js:398, 429` | A | "differ by more than a rupee" | the currency's word / `pack.messages` | 2 | yes |
| A8 | accounts | web `engine/bank-recon.js:65-67, 110, 495` | A | India presets; `₹\|rs\|inr`; proposals in INR | read `pack.bank`; pass the currency in (engines) | 2 | engines |
| A9 | accounts | web (no reader of `tally.why`); api `lib/books-pack.js:123` (8-year retention) | A | the greyed Tally line never shows its sentence; AU/AE keep 8 years | paint `tally.why`; `pack.retentionYears` | 2 | yes |
| F1 | finance | api `lib/ledger.js:453-463`, `lib/books-engines.js:160-165`; web `app/cap-books.js:1579-1594` | A | India's ageing buckets | `pack.presentation.ageing` → `dues(items, asOf, side, pack)` + `bucket_keys` to the screen | 3 | yes |
| F2 | finance | api `lib/books-cashflow.js:31-32, 183`, `lib/books-period.js:270`; web `app/cap-finance-cash.js:24, 116` | A | "GST by the 20th" for BAS / VAT shops | no tax line unless `pack.returns.periods()` gives a due date; the word from `pack.tax.scheme` | 3 | yes (gate) |
| F3 | finance | api `lib/books-engines.js:173` | C | 1.5 %/month "interest due" with nothing behind it | the party's resolved terms (`interest.on / rate_pct`, `routes/books.js:151`); nothing when off | 3 | no |
| F4 | finance | api `routes/books.js:505`, `lib/posting.js:104` | C | a UPI payment accepted for an AU shop (fallback chart has a UPI ledger) | check the mode against `pack.chart.paymentModes` | 3 | yes |
| F5 | finance | web `finance.html` (loads no `booksHealth`) | C | `SESSION.country` unset → UPI offered, India's words | set it as `accounts.html:658` does, from `/status` | 3 | yes |
| R1 | crm | api `lib/party-fields.js:51-55` | A | a wrong ABN / TRN / GSTIN saved without a word | run the pack's `abn.check · trn.check · gstin` per scheme, as `country-setup.js:109` | 4 | yes |
| R2 | crm | web `app/cap-crm-record.js:306`, `engine/profilemap.js:31-37` | A | "State code" asked; no postcode shape; no Emirate | `formats.address · postalCode · phone` (engines, every pack); AE `pack.emirates` | 4 | engines |
| R3 | crm | api `routes/identity-docs.js:99, 161`; web `app/cap-iddocs.js:43, 129` | C | PAN / Aadhaar for AU/AE staff; the client's country trusted | the server reads `identities.country`; the web draws only the GET's catalogue | 4 | yes |
| R4 | crm | api `lib/profile.js:286, 294, 302` | C | an ABN "29…" → Karnataka; `missing: state · gstin` | gate as `lib/tax-lines.js:62`; the missing word from the pack's tax id | 4 | yes |
| N1 | network | api `lib/tax-lines.js:119`, `lib/tax.js:246-247` | C | IN → AE buyer taxed CGST + SGST | take the seller's state only when the buyer's country is empty or the same; `tax.determine` answers `export` (Pos 96) for a state-split pack with a foreign buyer (engines) | 5 | engines |
| N2 | network | api `routes/chits.js` (no currency check) | C | a chit in another money lands on the ledger | refuse a mismatch with the seller's `functional_currency`, as `routes/books.js:520` | 5 | yes |
| N3 | chit pane | web `app/cap-chit2.js:296, 438-478, 329` | C | "₹ Price from catalogue" | `curSym(myCur())`; `\|\| ''` | 5 | yes |
| K1 | connector | api `routes/integrations.js:29-36, 142`; web `app/cap-admin.js:4612-4614` | A | Tally offered to AU/AE | filter the catalogue on `pack.export` (reg-in only); one greyed line "Tally is India's" with `tally.why` | 6 | yes |
| E1 | employees | web `employees.html` | A | nothing said about payroll | paint `pack.scope.out.payroll` (the pack's own sentence) | 6 | yes |
| L1 | locale | web `engine/locale.js:98-109` (no AU), `:135, 155` FALLBACK en-IN, `:648, 754` INR | A/C | AU formats, currencies, voice; ₹ for a missing code | `pack.locale` (engines: AU `{ format: 'en-AU', cur: ['AUD'], langs: ['en'] }`); FALLBACK → the pack's tag; `symbol(code)` returns the code | 7 | engines |
| L2 | locale | api `lib/govcontext.browser.js:41-54` (+ web copies) | A | AU clock unrecognised | `pack.timeZones` (engines); stopgap: the AU zones | 7 | engines |
| L3 | locale | api `migrations/000_baseline.sql:577-578`, `routes/signin.js:481`, `routes/entities.js:90` | C | every registration stored IN / INR | Athi's call (b299 §⚠️): `DROP DEFAULT`, or `registerNew` writes `context.country` | 7 | migration |
| L4 | locale | api `lib/licence-rules.js:36`, `lib/entity-header.js:50`; `lib/readiness.js:151, 163`; `lib/points.js:135`; `lib/dayopen.js:57` | C | India's licences, lanes, grouping | "no rules for {country}" instead of `RULES.IN`; `origin \|\| SESSION.country`; locale money | 7 | yes |
| L5 | locale | web `app/kural.js:34, 130`; till.html voice | C | Tamil verse for AU/AE | a brand flag or `SESSION.country === 'IN'` (Athi's call) | 7 | yes |

## 3. The ORDER of fix rounds (by traffic: till/bill → accounts → finance → crm → rest)

1. **CX1 · Till and the bill** — T1 (tax-invoice rules from `pack.taxInvoice`, the buyer's ABN/TRN on a bill), T2, T4, T5, T6; engines request: T3 (`docnumber` reads `fiscalYear`), T7 (`cashRounding` for AU).
2. **CX2 · Accounts — the engines adopt** — A1 (accounts-packs · posting · ledger · bookpack ≥ v1.41; the api's adopt script; `enable · packOf · taxReturn` on `regulation.packFor`), then A2–A9. Lands AU's chart, AASB 101 lines, BAS, July months; AE's IAS 1 lines, VAT201, January. The sim-load proof goes GREEN for AU/AE purchases.
3. **CX3 · Finance** — F1 (ageing from `presentation.ageing`), F2 (the cash-flow tax line from `pack.returns.periods()`), F3, F4, F5.
4. **CX4 · CRM, shop and catalogue** — R1, R3, R4, S1–S4, C2, C4; engines request: R2 (`formats.address · postalCode · phone`), C1/C3 (`tax-slab` per country).
5. **CX5 · Network / rail — cross-border** — N1 (engines: `tax.determine` `export` for a state-split seller and a foreign buyer; `tax-lines` Pos 96), N2 (currency match on a chit), N3.
6. **CX6 · Connector and Employees** — K1 (Tally only under `pack.export`, the greyed sentence), E1 (`scope.out.payroll` painted).
7. **CX7 · Locale and registration** — L1/L2 (engines: `pack.locale`, `pack.timeZones`, AU zones), L3 (Athi: the DB default), L4, L5.
8. **CX8 · Walks** — the three simulated shops (IN · AU · AE, §5) walked by WX-<FLOW> in light and dark at 1366 and 390 px; a row here is closed only by its walk.

## 4. What CX0 fixed (≤20 lines each, no engines change) and why nothing existing served

api · `lib/books.js enable` reads `country-setup.profile` (the one home) — was `'IN'` by default · `lib/books-period.js indiaOnly` (gstClose · gstPay refused
outside India's pack) · `routes/till.js` snapshot: no state off an ABN/TRN (`tax-packs.packFor(c).supply`), the pack's currency · `lib/country-setup.js` checks an
ABN/TRN · `lib/party-fields.js` ABN · `lib/books-pack.js` Tally XML and GSTR-1 only in India's pack · `routes/identity-docs.js` no PAN/Aadhaar list for an unknown
country · `lib/tax-lines.js` State only under India · `tools/sim-load.cjs` IN · AU · AE (§5). till.html (master, vendored to the web): `shopPack · taxIdLabel ·
schemeWord · creditNoteTitle · packSplitsByState · packHasUpi`; the shop form takes an ABN/TRN through the pack's check; the state clash, the CGST/SGST grids
(slip, screen, day report) only under a state-split pack; UPI only where the pack carries it.
web · `app/helpers.js`: `shopReg · taxIdWord · packSplitsByState · payHasUpi · payModeOpts` — ONE reader of the shop's pack for every page (till.html keeps its
own: a page without helpers.js); `accounts.html · crm.html` learn `SESSION.country` from `/api/books/status`; `app/cap-books.js`: `bkTaxSchemes` (ABN · TRN first),
the State field gated, Receive/Pay UPI gated, `bkCur` → the pack's money; `app/cap-country.js`: the pack's year · scheme · hint; the clock's country beats the
database default before the step is done; `app/cart.js · cap-definitions.js`: the slab's scheme word and the pack's rate menu; `app/chit-sheet.js`: one-head
summary; `app/cap-crm*.js · app.html`: the tax-id word; `app/cap-admin.js`: the Insights tax band gated; `app/cap-finance*.js · cap-traceability.js`: the ledger's
currency; `shop.html · store.html · embed.html`: money through the locale engine. New functions are listed in the PRs with the one-line reason each.

## 5. The simulator — three shops, one per pack (api `docs/SIM-LOAD.md` "The three shops the WX walks load")

`node tools/sim-load.cjs --db … --shop simstores --country IN · simsydney --country AU · simdubai --country AE`. The loader READS currency · year · heads ·
scheme · rate menu from `regulation.packFor(country)` and types only what no pack says (`SHOPS`: a sample GSTIN / ABN / TRN that passes the pack's check, the
street, the city's clock offset and zone). No sim-plan addition was needed: the plan's 5 · 12 · 18 % draws land on a one-rate scheme's standard rate, a `upi`
sale becomes `card` where the pack has no upi mode. ⚠️ Until CX2, an AU/AE load's purchases post on India's fallback chart and the proof is RED on them — said
in the loader's own words.

## 6. Engines requests queued (this round does not own engines)

accounts-packs ≥ v1.41 adopt (A1) · `docnumber` RULES from `fiscalYear` (T3) · `cashRounding` AU (T7) · `tax.determine` `export` for a state-split seller
and a foreign buyer (N1) · `tax-slab.schemeFor / ratesFor(country)` (C3) · `formats.address · postalCode · phone` on every pack (R2) · `pack.locale` AU and
`pack.timeZones` (L1, L2) · `bank-recon` reads `pack.bank` and takes a currency (A8) · `taxId { label, check }` on reg-in so `taxIdLabel` stops saying India's
word by default · a return calendar (`returns.periods` due dates) read by the cash-flow line (F2).
