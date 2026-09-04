# THE TOUR — every implementation from 2026-09-03 → 05, shown one after the other, live

Athi, 2026-09-05: *"list down all the implementation and show me one by one in the screen … create a test script and run
one after the other live and I can watch."*

Run it on your machine (a real Chrome window opens; each step shows a caption of what to look at, then pauses):

```
cd C:\dev\chitbridge-web\e2e
set TOUR=1
npx playwright test tests/tour.spec.js --headed --project=authed
```

`set TOUR_PAUSE=8000` for a longer pause per step (default 5 s). It uses a fresh entity minted for the run, so your own
data is never touched. The same script with `TOUR=1` and no `--headed` is a regression of every step.

| # | what was built | where you see it |
|---|---|---|
| 1 | Product page = tabs (Product · Categories · Offers · Stock · Variants · Pricing & tax · Consists of · Barcode), header + tabs pinned | Catalogue › a product |
| 2 | Tax slabs from the governance layer (b201): pick GST 18% → same-state / other-state split, Before · GST · After tax | Pricing & tax tab |
| 3 | Offers on a product — the cart breakdown at qty 1 and the sample qty, tax after offers, You save | Offers tab |
| 4 | Catalogue rows show what is in effect (🏷️ the active offer, GST %), search by offer or tax | the left list |
| 5 | Setup › Tax = a register of what every product carries (tax as resolved + source, offers, HSN, categories) | Catalogue setup › Tax |
| 6 | Setup › Offers = terms · window with Scheduled/Active/Expired · where applied; the next six months; Plan several | Catalogue setup › Offers |
| 7 | A slab does not go dark: Retire a cited slab → "Pick the slab that takes over"; Reinstate on retired rows | Catalogue setup › Tax |
| 8 | Publish on a date (b203): Effective from → the change is parked and shown beside the live value | Edit › Save |
| 9 | Barcode (Code 128 of the SKU) · Consists of (BOM read-out) | the two new tabs |
| 10 | Compose: typing your product's name makes its offers fire in the cart | Compose |
| 11 | The invoice and the ledger: rated at send, frozen at completed, MIS › Tax month | MIS › Tax |
| 12 | Columns panel — Columns · Types · Usage (observation 2) | Catalogue setup › Columns |

Not in the tour (needs a second entity or your own data): the buyer's input-credit side of the ledger ([TAX-03] proves it),
other countries' VAT split (an entity with country DE), the WhatsApp/offline paths.
