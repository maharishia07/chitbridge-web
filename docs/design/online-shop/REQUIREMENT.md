# Your online shop — a SHOWCASE, redesigned (requirement for the designer)

Decision (Athi, 2026-10-10, DECISIONS.md bottom): the page is not mostly for selling — it SHOWCASES the shop
to the outside world. Whoever can sell directly is already online somewhere; the audience is the millions who
are not. The wedding-card designer with hundreds of designs who today shares a few photos on WhatsApp is the
person this page is for: here the WHOLE range is presented. If an order comes through it, well and good.

## What the page is
1. **The shop's window, and usually its first website.** Name, what the shop does in one line, where it is,
   when it is open, how to reach it (call · WhatsApp) — then the range, large and browsable. The design leads
   with the WORK (photos first — memory: assume they cannot read), not with price/cart.
2. **The whole range, organised.** Hundreds of items must feel light: categories the shop already has, a
   search, big pictures, tap for the item's page (photos · sizes/variants · price where the shop chooses to
   show one · "Ask about this"). A shop may mark items "showcase only — price on asking".
3. **Selling is a bonus, not the spine.** Where ordering is on (the existing storefront flow), the button sits
   on the item quietly ("Order"); where it is off, the page still works fully as a window. Never an empty-cart
   feeling on a showcase shop.
4. **Share, everywhere.** A share icon on the page (and per item): the device share sheet, else copy — to
   WhatsApp status, Instagram, Facebook, anywhere. The owner's view adds the QR (exists) and
   "Share your shop link" (exists; PROVISIONAL name).
5. **Found through Google and Facebook, not through us.** The page must read well to a stranger AND to a
   crawler: real <title> ("<Shop name> — <what they do>, <place>"), meta description, one h1, schema.org
   Product/LocalBusiness markup, each item's page at its own URL, fast first paint on a phone.
   The owner's view gets a small "Be found" card: your link · copy · the two guides in plain words
   ("Google › your Business Profile › Website — paste this link" · "Facebook page › About › Website").
   We do not call any Google/Facebook API in this round — the owner pastes.

## Constraints (standing rules)
- Phone first (390 px, no sideways scroll); the frozen design tokens; text budget; icons not words where a
  picture is unambiguous; cost never reaches this page (automated test exists); CB core principle — only what
  the shop chose to publish is shown.
- The kural footer stays (every page).
- One frame style does NOT apply here as-is: this page faces the PUBLIC, so the shell header (bell, avatar)
  is absent for visitors; the owner preview may carry the shell.
- Catalogue is the one source (PIM-on-MDM); no second product store. Exposure per item ("Shown to customers")
  decides what appears.

## Out of scope this round
Google/Facebook API connections (the owner pastes the link); payments changes; the order queue (built, stays);
multi-language beyond what the string layer gives.

## The cart wears the business type (Athi, same day)
One cart engine (the chit IS the cart) — but its FACE follows the business type: **Enquiry/shortlist** (collect
designs, "Ask about these" — no prices needed) · **Order** (restaurant, grocery — today's flow) · **Quote
request** (bulk/hardware) · **Booking** (a date and a service). The designer shows the same bar/sheet wearing
each face; the words and the finishing action change ("Send your enquiry" · "Place the order" · "Ask for a
price" · "Ask for the date"), the machinery does not. Each face mints its chit kind and lands in Tasks & Orders.

## Not one design — a template collection (Athi, same day, on seeing the mock)
The mock is SEED #1, not the design. One data contract (catalogue + shop profile + exposure), many registered
faces (kind.vertical.face@version): the shop CHOOSES its template and may mix sections. Round S2 builds the
MECHANISM (template registry · the data contract a template receives · the chooser in the owner view · preview
with the shop's own data) plus 3–4 seeds: gallery-first (designer/cards) · menu (food) · spec wall
(paint/hardware) · booking (services). A template is sections, so mix-and-match is assembly, not forking.
A couple of iterations are expected on this piece before it is called right.
