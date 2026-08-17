/* app/cap-definitions.js — DEFINITIONS · the shelf a catalogue takes things off.  (lazy capability)
 *
 * Athi, 2026-08-15: *"create another menu type next to catalogue, where we can showcase what are all can be added
 * as part of catalogue … and its rules can be set and then, the same can be called against catalogue."*
 * Then, on the plan: *"go ahead as per your suggestion"* — which was the READ-ONLY SHOWCASE first.
 *
 * ── ⭐ WHAT THIS SCREEN IS ───────────────────────────────────────────────────────────────────────────────────────
 * The DDL half, finally given a door. Catalogue is DML — mint products and sell them. This is the layer that has
 * been written down for months and never had a screen: the reusable things a catalogue ADOPTS.
 *
 * ── ⭐⭐ THE DISTINCTION THE WHOLE DESIGN TURNS ON ────────────────────────────────────────────────────────────────
 *   KIND        "a pack model exists"        CODE — a registry — changes in a release
 *   DEFINITION  "Carton of 6" / "Diwali 10%" DATA — the entity's shelf — changes any time
 *   ADOPTION    "this catalogue uses that"   a REFERENCE on the catalogue
 *
 * THIS FILE SHOWS KINDS ONLY. No definitions, no adoption, no authoring, no writes. That is deliberate: it is the
 * part that cannot break anything, it ships today, and it answers the question that actually blocks people —
 * *what can a catalogue even have?*
 *
 * ── ⚠️⚠️ IT NEVER KEEPS ITS OWN LIST ────────────────────────────────────────────────────────────────────────────
 * Every kind on this screen is read from the registry the code already publishes — CBCart.models, CBOffers.KINDS,
 * CBCatalogueModel's palette. Typing the lists here would create a second source of truth that drifts within one
 * release and then LIES on screen, which is the exact divergence cart-ui.js exists to end. A kind added to
 * offers.js next month appears here with no edit; a kind removed stops being shown. That is the whole trick.
 *
 * ⚠️ AND WHERE A REGISTRY IS ABSENT, SAY SO. If offers.js has not loaded, the row reads "not loaded" rather than
 * rendering an empty section that looks like "there are none" — an empty list and a missing source look identical
 * on screen and mean opposite things.
 */

var CBDEF = { open: {}, mine: null, loading: false, err: '' };

/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *  AUTHORING — your own named things, on top of the kinds the system knows.
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Athi decided the rule this is built on, 2026-08-16: **"frozen by value when stamped."** Loose while a catalogue
 * merely references a definition — edit it and every adopter sees the new terms. Frozen the moment a chit is
 * minted, because a chit whose terms change after they were agreed is not evidence of anything.
 *
 * ⭐ WHICH KINDS ARE AUTHORABLE, AND WHY NOT ALL OF THEM. A definition is only meaningful where its RULES have a
 * shape someone can fill in. `category` (a named list) and `ordermodel` ("Carton of 6" = pack/step 6) and `offer`
 * (a kind plus its conditions) all do. `facet` and `datatype` do not — they are vocabulary the system uses to
 * describe a catalogue, not things you name instances of. Offering a Create button against those would invite
 * someone to author a thing that can never be adopted.
 *
 * ⚠️ THE FORM IS DRIVEN BY THE REGISTRY, NOT BY A LIST HERE. `ordermodel` offers exactly the models cart-ui
 * publishes; `offer` offers exactly the kinds offers.js publishes. Add a model next month and it is offerable
 * with no edit to this file — the same discipline as the showcase above it.
 */
var CBDEF_AUTHORABLE = {
  /**
   * ⚠️ AUTHORING MOVED OUT — Athi, 2026-08-16: *"bring the category as a panel next to catalogue. keep creation
   * and updation in that panel"*. Categories are still LISTED here, because this screen is the map of every
   * definition you hold and omitting one kind would make the map lie. But the Create button is gone: two places
   * to author one thing is exactly the duplication this screen was reconciled to remove.
   *
   * `home` sends the section's action to the screen that owns it — declare once, refer everywhere.
   */
  category:   { icon: '🗃️', title: 'Categories', one: 'category',
                home: { nav: 'categories', label: 'Open Categories →' },
                blurb: 'A named list of products, and the one definition with no freeze semantics to worry '
                     + 'about — a category has no terms that could change under a chit. ⚠️ A product can sit in '
                     + 'several. Created and renamed under <b>Categories</b>, beside the Catalogue.' },
  ordermodel: { icon: '🔢', title: 'Order models', one: 'order model',
                home: { nav: 'catsetup', sec: 'ordermodels', label: 'Open Catalogue setup →' },
                blurb: 'A quantity rule with a NAME, so a product adopts “Carton of 6” rather than repeating '
                     + 'pack/step 6. ⚠️ Change it to 12 and every product that adopted it moves — which is either '
                     + 'exactly what you want or a catastrophe, and is why adoption freezes at the mint. '
                     + 'Authored under <b>Catalogue setup</b>.' },
  /* ⚠️ This blurb said "nothing evaluates these at order time yet" — true when written, false since offers were
     wired into compose. Stale copy is the same failure as the "read-only showcase" banner: someone reads it,
     believes the feature is inert, and never tries it. */
  offer:      { icon: '🏷️', title: 'Offers', one: 'offer',
                home: { nav: 'catsetup', sec: 'offers', label: 'Open Catalogue setup →' },
                blurb: 'An offer kind plus its conditions. Publish one and it applies to orders in compose — the '
                     + 'breakdown shows what came off and, when it does not fire, how far short the order is. '
                     + 'Authored under <b>Catalogue setup</b>.' },
  /**
   * ⭐⭐ BACKLOG 7 — THE BUYER'S OWN FLOOR. Athi, 2026-08-16: *"the entity should declare what minimum
   * certification he needs to have business and it has to check only those available, eventhough the supplier
   * may have n certificates"*.
   *
   * A paint supplier was being told it lacked a pharmaceutical manufacturing licence, because the supplier card
   * asked `readinessOf` with no vertical and hit the FLOOR in lib/readiness.js, which returns every active
   * standard in the system. Forty unheld certificates is not forty gaps.
   *
   * ⚠️ THIS DOES NOT NARROW THE ENGINE, AND MUST NOT. The floor is a deliberate guard and narrowing it would be
   * relaxing it. This is a SECOND, buyer-owned list that scopes what the SUPPLIER CARD reports — the two coexist,
   * and the one you cannot waive stays where it is. ⚠️ Destination and product regulatory requirements are NOT
   * this: a buyer does not get to declare away a customs rule.
   */
  requirement:{ icon: '📋', title: 'Required certificates', one: 'requirement',
                blurb: 'What YOU require of a supplier before you will trade with them — ISO 9001, FSSAI, a GST '
                     + 'registration. Declare it once and every supplier is measured against your list instead of '
                     + 'against every standard in the system. ⚠️ It scopes what you are shown; it cannot waive a '
                     + 'rule the destination or the product imposes.' }
};

/**
 * ⭐ WORKED EXAMPLES — Athi: *"a link to its webpage, for example hs code, how it is used etc, some kind of
 * usage so the users can connect the context"*.
 *
 * ⚠️ THIS IS THE ONE PLACE THIS SCREEN HOLDS CONTENT OF ITS OWN, and it is deliberate: an example is
 * EXPLANATION, not data. The kinds themselves still come from the registries — nothing here invents a scheme,
 * adds one, or changes what the system supports. If a scheme is removed from STD_SCHEMES its example simply
 * stops being reachable, because the row it hangs on is gone.
 *
 * ⚠️ LINKS POINT AT THE ISSUING AUTHORITY. Not a lookup site, not a blog: only the defining body will still be
 * correct next year, and only it can settle an argument about what a code means.
 */
var CBDEF_EG = {
  'HS': {
    label: 'HS — Harmonized System',
    who: 'World Customs Organization',
    note: 'The customs code for a physical good. Every cross-border shipment is classified with one, and the '
        + 'duty rate, the paperwork and often the licence all follow from it. India extends it to 8 digits (HSN) '
        + 'and GST rates are set against those.',
    eg: '0902.30 — black tea, in packets of 3 kg or less',
    url: 'https://www.wcotradetools.org/en/harmonized-system'
  },
  'GS1 GPC': {
    label: 'GS1 GPC — Global Product Classification',
    who: 'GS1',
    note: 'What a retailer\'s systems use to group products — the "brick" a product belongs to. Different job '
        + 'from HS: GPC is for trade and shelf, HS is for customs.',
    eg: '10000025 — Tea (ready to drink)',
    url: 'https://www.gs1.org/standards/gpc'
  },
  'Schema.org': {
    label: 'Schema.org — web vocabulary',
    who: 'Schema.org (Google, Microsoft, Yahoo, Yandex)',
    note: 'How a product is described so machines reading a web page understand it. ⚠️ Worth knowing that it '
        + 'models price on the OFFER, not on the product — the same good sells at different prices to different '
        + 'buyers. Our own model notes that as a gap.',
    eg: 'Product / Offer / priceSpecification',
    url: 'https://schema.org/Product'
  },
  'UNSPSC': {
    label: 'UNSPSC — UN Standard Products & Services Code',
    who: 'GS1 US, for the United Nations',
    note: 'The classification most procurement departments and tenders ask for. If a buyer says "give me your '
        + 'UNSPSC", this is it.',
    eg: '50201706 — Tea',
    url: 'https://www.unspsc.org/'
  },
  'custom': {
    label: 'custom — your own scheme',
    who: 'you',
    note: 'Your internal grouping, or one a particular buyer imposes. ⚠️ It travels with the catalogue but no '
        + 'outside party can resolve it — so it is a label, not a standard, and should not be used where a real '
        + 'scheme exists.',
    eg: 'GRADE-A / GRADE-B'
  }
};

/* ── the registries, read live ───────────────────────────────────────────────────────────────────────────────── */
function cbDefRegistries(){
  var out = [];

  /* Order models — the quantity rule a catalogue declares per item. cart-ui owns them. */
  out.push({
    key: 'ordermodel', icon: '🔢', title: 'Order model kinds',
    blurb: 'How a line is quantified. The catalogue declares it per item; every screen obeys.',
    source: 'app/cart-ui.js · MODELS',
    rows: (typeof CBCart !== 'undefined' && CBCart.models)
      ? Object.keys(CBCart.models).map(function (k) {
          var m = CBCart.models[k];
          return { code: k, label: m.label || k,
                   note: cbDefModelNote(k) };
        })
      : null
  });

  /* Offer kinds — offers.js. */
  out.push({
    key: 'offer', icon: '🏷️', title: 'Offer kinds',
    blurb: 'The shapes an offer can take. A definition picks a kind and sets its rules.',
    source: 'app/offers.js · KINDS',
    rows: (typeof CBOffers !== 'undefined' && CBOffers.KINDS)
      ? Object.keys(CBOffers.KINDS).map(function (k) {
          return { code: k, label: cbDefOfferLabel(k),
                   note: 'scope: ' + (CBOffers.KINDS[k].scope || '—') };
        })
      : null
  });

  /* The catalogue's own grammar — datatypes, selling methods, facets, pricing models, standards. */
  /**
   * ⚠️ `CBCatalogue`, NOT `CBCatalogueModel` — I invented the second name and five of the seven sections read
   * "not loaded" while the data was sitting right there. The registry's real global is CBCatalogue (see
   * catalogue-model.js line 18, `root.CBCatalogue = M`), which is precisely the name catalogue-ui.js was
   * clobbering an hour ago; renaming that one to CBCatUI is what freed it.
   *
   * ⭐ Worth noting the honest-empty-state rule earned its keep twice in one evening: "not loaded" is what
   * surfaced BOTH the missing offers.js script tag and this wrong name. Had the section rendered as an empty
   * list, both would have read as "there are none" and neither would have been found.
   */
  var P = (typeof CBCatalogue !== 'undefined' && CBCatalogue.PALETTE) ? CBCatalogue.PALETTE() : null;
  /**
   * ⚠️ THE BLURB USED TO SAY "not yet evaluated at order time" AND THAT IS NO LONGER TRUE — `price-resolve.js`
   * evaluates them (28/0). A screen that keeps describing a gap after the gap is filled is the same failure as
   * the "read-only showcase" banner that outlived read-only by an hour: someone reads it and stops looking.
   */
  out.push({
    key: 'pricing', icon: '💱', title: 'Pricing models',
    blurb: 'How a price is arrived at. A catalogue can declare several — a list price, a bulk tier, a regional '
         + 'or time-boxed one — and the resolver picks the MOST SPECIFIC that applies, never the cheapest.',
    source: 'app/catalogue-model.js · PRICING_MODELS',
    rows: P && P.pricingModels ? P.pricingModels.map(function (k) {
      return { code: k, label: cbDefPricingLabel(k), note: cbDefPricingNote(k) }; }) : null
  });
  /**
   * ⭐ WHERE A PRICE IS REFERRED FROM — Athi, 2026-08-16: *"can we say where prices are refered from, or accessed
   * from, example, url, website"*. `basis` said what KIND of source; this says WHERE, and that is the half that
   * makes a price checkable by the other party rather than merely asserted.
   */
  out.push({
    key: 'priceorigin', icon: '🔗', title: 'Price sources',
    blurb: 'Where a price was referred from — and when it was read. A price with a named source, a link and a '
         + 'reading date is evidence; one without is an assertion. Both are allowed; they must not look alike.',
    source: 'app/catalogue-model.js · PRICE_ORIGIN',
    rows: P && P.priceOrigin ? P.priceOrigin.map(function (o) {
      return { code: o, label: cbDefOriginLabel(o), note: cbDefOriginNote(o) }; }) : null
  });
  out.push({
    key: 'method', icon: '🧾', title: 'Selling methods',
    blurb: 'How a whole catalogue sells. One per catalogue.',
    source: 'app/catalogue-model.js · METHODS',
    rows: P && P.methods ? P.methods.map(function (m) { return { code: m.k, label: m.label }; }) : null
  });
  out.push({
    /**
     * ⭐ UNITS OF MEASURE — a declared kind as of 2026-08-16. The list used to live inside the catalogue wizard as
     * `CW_UNITS`, so the one attribute every line item carries could not be declared or referred to anywhere. It
     * is in the model now, which means this screen can publish it and Governance can point at it.
     */
    key: 'unit', icon: '⚖️', title: 'Units of measure',
    blurb: 'What a quantity is counted in — the same list the catalogue wizard offers on every item.',
    source: 'app/catalogue-model.js · UNITS',
    rows: (typeof CBCatalogue !== 'undefined' && CBCatalogue.UNITS)
      ? CBCatalogue.UNITS.map(function (u) { return { code: u, label: u }; }) : null
  });
  out.push({
    key: 'datatype', icon: '🔤', title: 'Field datatypes',
    blurb: 'What a catalogue field can hold — the palette a field set is built from.',
    source: 'app/catalogue-model.js · DATATYPES',
    /* ⚠️ The palette carries a `note` per datatype and this screen was dropping it — the note is the half that
       says what the type is FOR ("expiry, harvest", "value + unit"), which is exactly what someone reading this
       list needs. Showing the code and the label alone made the list look like jargon. */
    rows: P && P.datatypes ? P.datatypes.map(function (d) {
      return { code: d.k || d, label: d.label || d.k || d, note: d.note || '' }; }) : null
  });
  /**
   * ⭐ EXAMPLES AND LINKS — Athi, 2026-08-16: *"what we may need is an example where possible, a link to its
   * webpage, for example hs code, how it is used etc, some kind of usage so the users can connect the context"*.
   *
   * A list of scheme names teaches nobody what to do. "HS" means nothing until you see `0902.30` next to
   * "black tea, packets under 3kg" and the sentence explaining that customs reads it and duty follows from it.
   *
   * ⚠️ THE LINKS GO TO THE ISSUING AUTHORITY, not to a blog or a lookup service. A standard is only useful if
   * you can reach the body that defines it — and that is also the only source that will still be right next
   * year. Same rule the price provenance work applied to money.
   */
  out.push({
    key: 'standard', icon: '📐', title: 'Standards',
    blurb: 'Classification schemes a product can cite. ⚠️ Always BY REFERENCE — you cite the code, you never '
         + 'copy the scheme. The issuing body owns it and keeps it current.',
    source: 'app/catalogue-model.js · STD_SCHEMES',
    rows: P && P.standards ? P.standards.map(function (s) {
      var e = CBDEF_EG[s] || {};
      return { code: s, label: e.label || s, note: e.note, eg: e.eg, url: e.url, who: e.who }; }) : null
  });
  /**
   * ⭐ FACETS GET THEIR MEANING SPELLED OUT — Athi, 2026-08-16: *"under field data type, consists of, means, this
   * item consists of the following item"*.
   *
   * He was reading `bom` and asking what it means. It IS "consists of" — a bill of materials,
   * `bom:[{item, qty}]`, already in the model (catalogue-model.js line 10 and FACETS). But a screen that prints
   * the bare code `bom` is a screen only its author can read, and the question proved it: the concept was
   * present and unfindable.
   *
   * ⚠️ THE CODE STILL SHOWS. `bom` is what the data says and what anyone integrating will see; renaming it here
   * would make this screen disagree with the payload. Code AND plain words, not one or the other.
   */
  out.push({
    key: 'facet', icon: '🧩', title: 'Catalogue facets',
    blurb: 'The parts a catalogue definition is made of. A catalogue declares which of these it uses.',
    source: 'app/catalogue-model.js · FACETS',
    rows: P && P.facets ? P.facets.map(function (f) {
      return { code: f, label: cbDefFacetLabel(f), note: cbDefFacetNote(f) }; }) : null
  });

  return out;
}

/* The one-line reason each order model exists. ⚠️ Kept as PROSE about a rule that lives in cart-ui — not a second
   copy of the rule. If these ever disagree, cart-ui is right and this text is stale. */
function cbDefModelNote(k){
  return ({
    count:   'Whole units. A tin, a bag, a licence.',
    measure: 'A decimal amount — 2.5 kg is a real order, 2.5 tins is not.',
    pack:    'Sold in multiples. The multiple IS the unit of sale, so 13 rounds to a legal pack.',
    range:   '⚠️ A declared min/max. Below the minimum is REFUSED, never rounded up — ordering more than someone asked for costs them money.',
    pick:    'One or none. No quantity control at all; a second press must not make it two.',
    offer:   'A quantity AND your price, inside the seller’s band. Two facts about one line.'
  })[k] || '';
}
/**
 * What each facet MEANS, in the words a person would use. ⚠️ Prose about the model, not a second copy of it —
 * `catalogue-model.js` owns what a facet does; if these ever disagree, it is right and this is stale.
 */
function cbDefFacetLabel(f){
  return ({
    identity: 'Identity — what it is',
    variants: 'Variants — sizes, grades, finishes',
    units:    'Units — base unit and conversions',
    standards:'Standards — HS, GS1, cited by reference',
    media:    'Media — images and video',
    bom:      'Consists of — what it is made from',
    pricing:  'Pricing — how the price is arrived at',
    loop:     'Loop — what comes back (returns, empties)',
    feedback: 'Feedback — what buyers said'
  })[f] || f;
}
function cbDefFacetNote(f){
  return ({
    /* ⭐ Athi's own words for it: "this item consists of the following item". */
    bom:      'A bill of materials — this item consists of these items, each with a quantity. It is what makes a finished good traceable back to what went into it, and what mass-balance reconciles across parties.',
    variants: 'One product, several purchasable lines. The variant is what distinguishes them — 1L / 4L / 10L.',
    units:    'The base unit and the factors to convert into it. ⚠️ This is what delivery matching compares; a line with no unit cannot be matched against a delivery.',
    loop:     'The returnable half of a trade — crates, drums, pallets that come back.',
    pricing:  'Declared today; ⚠️ not yet evaluated at order time.'
  })[f] || '';
}
function cbDefPricingLabel(k){
  return ({
    fixed:        'Fixed — one declared amount',
    range:        'Range — a band, not a number',
    tiered:       'Tiered — the price changes with quantity',
    'market-ref': 'Market reference — read from a published source',
    negotiated:   'Negotiated — agreed per counterparty'
  })[k] || k;
}
function cbDefPricingNote(k){
  return ({
    fixed:        'What you charge, full stop. Most prices are this, and that is fine.',
    range:        '⚠️ A band is a CONSTRAINT, not a discount — a price outside it is reported as a violation, never quietly clamped to fit.',
    tiered:       'A qualifying tier RE-PRICES the line; it is not a discount off the list price. ⚠️ Tiers are per line — 30 of one product does not earn the 30-tier on another.',
    'market-ref': 'A published figure, with WHERE it was read and WHEN. ⚠️ Recorded, never fetched live at seal — a chit whose total depends on someone else\'s page being up is a chit two parties can compute differently.',
    negotiated:   'What you and one counterparty agreed. ⚠️ Frozen onto the chit at the mint, so it survives the shelf changing afterwards.'
  })[k] || '';
}
function cbDefOriginLabel(o){
  return ({
    url:       'A web page',
    publisher: 'A named publisher',
    exchange:  'An exchange or index',
    system:    'An ERP or price list',
    contract:  'A signed contract',
    manual:    'Set by hand'
  })[o] || o;
}
function cbDefOriginNote(o){
  return ({
    url:       'A link anyone can open. ⚠️ Recorded, never fetched at seal — a chit whose total depends on a third-party page being up is a chit two parties can compute differently.',
    publisher: 'A mandi board, a trade journal, an association circular. Carries the publisher and the date read.',
    exchange:  'A traded reference — a symbol and a reading date. Without the date a market price cannot be checked against anything.',
    system:    'Your own ERP or a price-list id. The ref is the identifier there.',
    contract:  'A number you agreed. The ref is the contract number, which is what makes it findable later.',
    manual:    'You set it. Honest and unverifiable — which is fine, as long as it does not look like the others.'
  })[o] || '';
}
function cbDefOfferLabel(k){
  return ({
    percent_off: 'Percentage off',
    amount_off:  'Flat amount off',
    tier_price:  'Quantity tier — a RE-PRICE, not a discount',
    threshold:   'Spend or quantity threshold — reports the shortfall when it does not fire',
    buy_x_get_y: 'Buy X get Y — cheapest qualifying units are the free ones',
    shipping:    'Shipping — free, flat or a percentage',
    price_range: '⚠️ A declared band — reports a violation, never clamps a negotiated price'
  })[k] || k;
}

/* ── my definitions: load, author, edit, retire ──────────────────────────────────────────────────────────────── */

/**
 * ⚠️ ONE LOAD, NOT ONE PER SECTION. Three authorable kinds could mean three round trips on every paint; the
 * route already filters by kind, but the SHELF is one thing and reads as one thing. `?all=1` so retired
 * definitions are in hand — they are hidden by default in the UI, but a retired item you cannot see is how
 * someone re-creates a definition they already retired.
 */
async function cbDefLoad(force){
  if (CBDEF.mine && !force) return;
  if (CBDEF.loading) return;
  CBDEF.loading = true; CBDEF.err = '';
  try {
    /* ⚠️ `defListAll`, not defList with params — api() substitutes PATH tokens and silently drops leftover
       params, so `{all:1}` never reached the server. The shelf was therefore hiding retired definitions by
       accident rather than by request, which happened to look right. */
    var r = await api('defListAll');
    CBDEF.mine = (r && r.definitions) || [];
  } catch (e) {
    /* ⚠️ A LOAD FAILURE IS SAID, NOT SWALLOWED INTO AN EMPTY SHELF. "you have none" and "we could not ask" look
       identical as an empty list and mean opposite things — the same rule the "not loaded" registry rows follow.
       503 is the honest, expected case before b160 has run anywhere. */
    CBDEF.mine = [];
    CBDEF.err = (e && e.message) || 'Could not read your definitions.';
  }
  CBDEF.loading = false;
  /* Same reason as cbDefToggle — this lands AFTER the screen is up, so a full render would yank a reader who has
     already scrolled back to the top. cbDefRepaint falls back to renderApp when the wrap is not present. */
  cbDefRepaint();
}

function cbDefMineOf(kind){
  return (CBDEF.mine || []).filter(function (d) { return d.kind === kind && d.status !== 'retired'; });
}
function cbDefRetiredOf(kind){
  return (CBDEF.mine || []).filter(function (d) { return d.kind === kind && d.status === 'retired'; });
}

/** The rule fields a kind offers — read from the registries, never listed here. */
function cbDefRuleFields(kind, sub){
  /**
   * ⚠️ `category` HAS NO RULE FIELDS, AND THAT IS THE FIX (Athi's call, 2026-08-16).
   *
   * It used to offer `members` — "products in this category, one name per line". That was the old way of saying
   * the relationship, by TYPED NAME, and it now competes with products that cite the category by definition_id.
   * Two ways to say one thing, and the typed one matched nothing: nobody reads `members`, so a name typed there
   * classified no product at all. A field that looks like it works and does nothing is worse than no field.
   *
   * Membership is set from the Catalogue — tick products, press Categorise — and is stored on the PRODUCT, which
   * is the only side that can carry it across an entity boundary (catgSetOn in core.js).
   */
  if (kind === 'category') return [];
  if (kind === 'requirement') {
    /* ⚠️ STANDARD KEYS, NOT FREE TEXT — the whole point is that these match what a supplier's readiness record
       is keyed by, so "ISO 9001" typed by hand would match nothing. The form renders the real, available keys as
       chips to tap (cbDefStdChips), so the list is authored from the system's own vocabulary. */
    return [{ k: 'standards', label: 'Certificates you require', ph: 'one standard key per line', area: true }];
  }
  if (kind === 'ordermodel') {
    /* The shape each model actually uses. ⚠️ cart-ui's MODELS decide behaviour; these are the inputs those
       models read (`o.step`, `o.min`, `o.max`), so the names must match what coerce/next look for. */
    var f = [];
    if (sub === 'pack' || sub === 'measure' || sub === 'range') f.push({ k: 'step', label: 'Step', ph: '6', num: true });
    if (sub === 'range') { f.push({ k: 'min', label: 'Minimum', ph: '5', num: true });
                           f.push({ k: 'max', label: 'Maximum', ph: '500', num: true }); }
    if (sub === 'offer') { f.push({ k: 'price_min', label: 'Lowest price you will accept', num: true });
                           f.push({ k: 'price_max', label: 'Highest', num: true }); }
    return f;
  }
  if (kind === 'offer') {
    var g = [];
    if (sub === 'percent_off' || sub === 'threshold') g.push({ k: 'percent', label: 'Percent off', ph: '10', num: true });
    if (sub === 'amount_off' || sub === 'threshold')  g.push({ k: 'amount', label: 'Amount off', num: true });
    if (sub === 'threshold') { g.push({ k: 'min_amount', label: 'Spend at least', num: true });
                               g.push({ k: 'min_qty', label: '…or this many items', num: true }); }
    if (sub === 'buy_x_get_y') { g.push({ k: 'buy', label: 'Buy', ph: '1', num: true });
                                 g.push({ k: 'get', label: 'Get', ph: '1', num: true });
                                 g.push({ k: 'get_percent', label: '% off the free ones (100 = free)', num: true }); }
    if (sub === 'price_range') { g.push({ k: 'min', label: 'Band minimum', num: true });
                                 g.push({ k: 'max', label: 'Band maximum', num: true }); }
    if (sub === 'shipping') g.push({ k: 'percent', label: '% off shipping (blank = free)', num: true });
    /* ⭐ TARGETING — "10% off Paints" (backlog 20). The engine has read `applies_to.category` all along; nothing
       ever SET it, and no cart line carried a category to match against, so the field was dead on both sides. */
    g.push({ k: 'applies_to.category', label: 'Applies to', pick: 'category' });
    /* Conditions every offer kind shares — the ones offers.js evaluates in within(). */
    g.push({ k: 'valid_from', label: 'Valid from', ph: 'YYYY-MM-DD' });
    g.push({ k: 'valid_to',   label: 'Valid to',   ph: 'YYYY-MM-DD' });
    g.push({ k: 'region',     label: 'Region', ph: 'blank = everywhere' });
    return g;
  }
  return [];
}

/** The sub-kinds a kind offers — READ FROM THE REGISTRY, so this file never holds the list. */
function cbDefSubKinds(kind){
  if (kind === 'ordermodel') {
    var all = (typeof CBCart !== 'undefined' && CBCart.models) ? Object.keys(CBCart.models) : [];
    /**
     * ⭐ NARROWED BY WHAT THE CATALOGUE CAN ACTUALLY SELL (backlog 18). Athi: *"so a catalogue choose what it
     * wants to display, if you have not chosen range, your catalogue will not work for range?"* — it did not
     * refuse, it did not warn, and the two disagreed at ORDER TIME, which is to say the customer found out.
     * A `text` catalogue is a payload catalogue: it sells no quantities, so it offers no order models.
     *
     * ⚠️ FAILS OPEN, DELIBERATELY. If the catalogue's method is not loaded here we offer EVERYTHING, because the
     * damage is asymmetric: hiding a model the catalogue genuinely supports silently removes a capability the
     * owner already relies on and gives them no way to ask for it back, while offering one it does not support
     * is caught downstream by the orphan check. Never narrow on a guess.
     */
    var method = (typeof UI !== 'undefined' && UI.catf && UI.catf.method) || null;
    if (!method || typeof CBCatalogue === 'undefined' || !CBCatalogue.modelsForMethod) return all;
    var ok = CBCatalogue.modelsForMethod(method);
    var narrowed = all.filter(function(m){ return ok.indexOf(m) >= 0; });
    /* ⚠️ A method that supports NOTHING still returns nothing — that is the point for `text`/`form`, and the
       caller shows why rather than rendering an empty picker with no explanation. */
    return narrowed;
  }
  if (kind === 'offer')      return (typeof CBOffers !== 'undefined' && CBOffers.kinds) ? CBOffers.kinds : [];
  return [];
}

var CBDEF_FORM = null;   // { kind, sub, name, note, rules, id, version }

function cbDefNew(kind){
  var subs = cbDefSubKinds(kind);
  /* ⚠️ AN EMPTY PICKER MUST EXPLAIN ITSELF. A `text`/`form` catalogue supports no order models at all, and a
     form offering nothing with no reason reads as broken rather than as correct. Say which setting caused it
     and where to change it — the alternative is the owner concluding the feature is missing. */
  if (kind === 'ordermodel' && !subs.length) {
    var meth = (typeof UI !== 'undefined' && UI.catf && UI.catf.method) || 'this';
    toast('A ' + meth + ' catalogue does not sell quantities, so it has no order models. Change the selling method in Catalogue setup first.');
    return;
  }
  CBDEF_FORM = { kind: kind, sub: subs[0] || '', name: '', note: '', rules: {}, id: null };
  cbDefPaintForm();
}
async function cbDefEdit(id){
  var d = (CBDEF.mine || []).filter(function (x) { return x.definition_id === id; })[0];
  if (!d) return;
  CBDEF_FORM = { kind: d.kind, sub: d.sub_kind || '', name: d.name || '', note: d.note || '',
                 rules: JSON.parse(JSON.stringify(d.rules || {})), id: id, version: d.current_version };
  cbDefPaintForm();
}
function cbDefSetSub(v){ CBDEF_FORM.sub = v; cbDefPaintForm(); }
function cbDefSetField(k, v){ CBDEF_FORM[k] = v; }
/**
 * ⚠️ DOTTED KEYS WRITE NESTED, so a field can address `applies_to.category` without this form growing a
 * translation layer between what it shows and what it stores. The alternative — a flat `applies_to_category` key
 * remapped at save time — puts the offer's real shape in two places, and the engine only ever reads one of them.
 * Clearing the last key of a branch removes the empty parent too: `applies_to:{}` is not the same as no
 * `applies_to`, and offers.js treats a present-but-empty scope as a filter that matches nothing.
 */
function cbDefSetRule(k, v, num){
  var R = CBDEF_FORM.rules, parts = String(k).split('.');
  if (parts.length === 1) {
    if (v === '' || v == null) delete R[k];
    else R[k] = num ? Number(v) : v;
    return;
  }
  var head = parts[0], tail = parts.slice(1).join('.');
  if (v === '' || v == null) {
    if (R[head]) { delete R[head][tail]; if (!Object.keys(R[head]).length) delete R[head]; }
    return;
  }
  if (!R[head] || typeof R[head] !== 'object') R[head] = {};
  R[head][tail] = num ? Number(v) : v;
}
function cbDefGetRule(k){
  var R = CBDEF_FORM.rules, parts = String(k).split('.');
  if (parts.length === 1) return R[k];
  var head = R[parts[0]];
  return (head && typeof head === 'object') ? head[parts.slice(1).join('.')] : undefined;
}

/**
 * ⭐ A PICKER FIELD — currently only categories, which is what makes "10% off Grains" expressible at all.
 *
 * ⚠️ IT STORES THE definition_id, NOT THE NAME. An offer that said `applies_to.category = "Grains"` would stop
 * matching the moment the category was renamed — and renaming is the one thing categories are designed to make
 * safe. Same rule as a product's membership.
 *
 * ⚠️ IF THE SHELF IS EMPTY THE FIELD SAYS SO rather than rendering an empty select. A dropdown with one blank
 * option reads as "this offer cannot be targeted", when the truth is "you have no categories yet".
 */
function cbDefPickHTML(x, v){
  var list = (typeof _CATG !== 'undefined' && _CATG) ? _CATG : null;
  if (list === null) {
    if (typeof cbCatgLive === 'function') cbCatgLive().then(function(){ if (CBDEF_FORM) cbDefPaintForm(); });
    return '<div class="cbdef-hint">reading your categories…</div>';
  }
  if (!list.length) {
    return '<div class="cbdef-hint">No categories yet, so this offer applies to <b>everything</b>. '
      + 'Make one under <b>Categories</b> to target it.</div>';
  }
  return '<select class="inp" data-testid="cbdef-pick-' + cbDefEsc(x.k) + '"'
    + ' onchange="cbDefSetRule(\'' + x.k + '\',this.value)">'
    + '<option value="">— everything —</option>'
    + list.map(function (c) {
        return '<option value="' + cbDefEsc(c.id) + '"' + (String(v) === String(c.id) ? ' selected' : '') + '>'
          + cbDefEsc(c.name) + '</option>'; }).join('')
    + '</select>';
}
function cbDefFormHTML(){
  var f = CBDEF_FORM; if (!f) return '';
  var A = CBDEF_AUTHORABLE[f.kind] || {};
  var subs = cbDefSubKinds(f.kind);
  var fields = cbDefRuleFields(f.kind, f.sub);
  var editing = !!f.id;

  return '<h3 style="margin:0 0 4px">' + (editing ? 'Edit' : 'New') + ' ' + cbDefEsc(A.one || f.kind) + '</h3>'
    /**
     * ⭐ THE FREEZE RULE IS SAID ON THE EDIT FORM, WHERE IT MATTERS. Someone changing "Carton of 6" to 12 needs
     * to know, at that moment, that chits already stamped keep the 6 — otherwise the safe behaviour reads as a
     * bug ("I changed it and the old order still says 6") and someone 'fixes' it.
     */
    + (editing
        ? '<div class="cbdef-freeze">Editing the rules saves a <b>new version</b>. Chits already stamped keep the '
          + 'version they froze — they do not move. Currently at v' + cbDefEsc(f.version || 1) + '.</div>'
        : '')
    + (subs.length
        ? '<label class="fl">Kind</label><select class="inp" onchange="cbDefSetSub(this.value)">'
          + subs.map(function (s) {
              return '<option value="' + cbDefEsc(s) + '"' + (s === f.sub ? ' selected' : '') + '>'
                + cbDefEsc(s) + '</option>'; }).join('') + '</select>'
        : '')
    + '<label class="fl">Name</label>'
    + '<input class="inp" data-testid="cbdef-name" value="' + cbDefEsc(f.name) + '"'
    /* ⚠️ Per KIND. The fallthrough used to hand `requirement` the category placeholder — a form headed "New
       requirement" asking for a name and suggesting "Spices". A placeholder is an instruction; a wrong one
       teaches the wrong thing. */
    + ' placeholder="' + (f.kind === 'ordermodel' ? 'Carton of 6'
                        : f.kind === 'offer'      ? 'Diwali 10%'
                        : f.kind === 'requirement'? 'Minimum for food suppliers'
                        :                           'Spices') + '"'
    + ' oninput="cbDefSetField(\'name\',this.value)">'
    + (fields.length ? '<div class="cbdef-rules">' + fields.map(function (x) {
        var v = cbDefGetRule(x.k); v = (v == null ? '' : v);
        if (x.pick) return '<label class="fl">' + cbDefEsc(x.label) + '</label>' + cbDefPickHTML(x, v);
        return '<label class="fl">' + cbDefEsc(x.label) + '</label>'
          + (x.area
              ? '<textarea class="inp" rows="4" placeholder="' + cbDefEsc(x.ph || '') + '"'
                + ' oninput="cbDefSetRule(\'' + x.k + '\',this.value.split(\'\\n\').filter(Boolean))">'
                + cbDefEsc(Array.isArray(v) ? v.join('\n') : v) + '</textarea>'
              : '<input class="inp" value="' + cbDefEsc(v) + '" placeholder="' + cbDefEsc(x.ph || '') + '"'
                + ' oninput="cbDefSetRule(\'' + x.k + '\',this.value,' + (x.num ? 'true' : 'false') + ')">');
      }).join('') + cbDefStdChipsHTML() + '</div>' : '')
    + '<label class="fl">Note</label>'
    + '<input class="inp" value="' + cbDefEsc(f.note) + '" placeholder="optional"'
    + ' oninput="cbDefSetField(\'note\',this.value)">'
    + '<div class="err" id="cbdef_err"></div>'
    + '<div style="display:flex;gap:8px;margin-top:14px">'
    +   '<button class="composebtn" style="flex:1" onclick="closeModal()">Cancel</button>'
    +   '<button class="composebtn pri" style="flex:1" data-testid="cbdef-save" onclick="cbDefSave()">'
    +   (editing ? 'Save' : 'Create') + '</button>'
    + '</div>';
}
/**
 * ⭐ THE STANDARDS A BUYER CAN REQUIRE — read from the system, never typed.
 *
 * ⚠️ SOURCED FROM YOUR OWN readiness call, and that is not a workaround. `/api/governance/readiness` with no
 * vertical returns THE FLOOR — every active standard, with titles. That unscoped list is the exact complaint
 * behind backlog 7 when it is used to judge a supplier, and it is exactly the right thing to use as a MENU: the
 * full vocabulary is what you want to choose from, and precisely not what you want to be measured against.
 *
 * Cached, and failure is silent: the textarea still works, you just have to know the keys.
 */
var _CBDEF_STDS = null, _cbdefStdReq = null;
function cbDefStdsLoad(){
  if (_CBDEF_STDS) return Promise.resolve(_CBDEF_STDS);
  if (_cbdefStdReq) return _cbdefStdReq;
  /* ⚠️ ensureCap FIRST. `readinessOwn` is registered by cap-readiness.js, which is LAZY — calling api() without
     it throws "no endpoint readinessOwn". Registering a second copy of the alias here would satisfy the call and
     break the guard's one-global-one-owner rule, which is the wrong trade. */
  _cbdefStdReq = ensureCap('readiness').then(function(){ return api('readinessOwn'); }).then(function(d){
    var seen = {}, out = [];
    ((d && d.clearances) || []).forEach(function(c){
      if (!c.standard || seen[c.standard]) return;
      seen[c.standard] = 1; out.push({ key: c.standard, title: c.title || c.standard });
    });
    out.sort(function(a,b){ return a.key.localeCompare(b.key); });
    _CBDEF_STDS = out; _cbdefStdReq = null; return out;
  }).catch(function(){ _cbdefStdReq = null; return (_CBDEF_STDS = []); });
  return _cbdefStdReq;
}
function cbDefStdChipsHTML(){
  var f = CBDEF_FORM; if (!f || f.kind !== 'requirement') return '';
  var list = _CBDEF_STDS;
  if (list === null) return '<div class="cbdef-stdhint">Reading the standards list…</div>';
  if (!list.length) return '<div class="cbdef-stdhint">Could not read the standards list — type the keys directly, '
    + 'one per line.</div>';
  var chosen = {}; (f.rules.standards || []).forEach(function(s){ chosen[String(s).trim()] = 1; });
  return '<div class="cbdef-stdhint">Tap to add or remove. ' + list.length + ' available.</div>'
    + '<div class="cbdef-stds">' + list.map(function(s){
        var on = !!chosen[s.key];
        return '<button type="button" class="cbdef-stdchip' + (on ? ' on' : '') + '"'
          + ' title="' + cbDefEsc(s.title) + '"'
          + ' onclick="cbDefToggleStd(\'' + cbDefEsc(s.key) + '\')">' + (on ? '✓ ' : '') + cbDefEsc(s.key) + '</button>';
      }).join('') + '</div>';
}
function cbDefToggleStd(key){
  var f = CBDEF_FORM; if (!f) return;
  var cur = (f.rules.standards || []).map(function(s){ return String(s).trim(); }).filter(Boolean);
  var i = cur.indexOf(key);
  if (i >= 0) cur.splice(i, 1); else cur.push(key);
  f.rules.standards = cur;
  cbDefPaintForm();
}
function cbDefPaintForm(){
  modal(cbDefFormHTML());
  /* Load once, then repaint — the chips cannot render before the list exists, and the form must not wait for it. */
  if (CBDEF_FORM && CBDEF_FORM.kind === 'requirement' && _CBDEF_STDS === null) {
    cbDefStdsLoad().then(function(){ if (CBDEF_FORM && CBDEF_FORM.kind === 'requirement') cbDefPaintForm(); });
  }
}

async function cbDefSave(){
  var f = CBDEF_FORM; if (!f) return;
  var err = document.getElementById('cbdef_err');
  if (!f.name || !f.name.trim()) { if (err) err.textContent = 'A name is needed — it is how this gets cited.'; return; }
  try {
    if (f.id) {
      /**
       * ⚠️ THE RULES ARE ALWAYS SENT ON AN EDIT, and the server decides whether that is a new version. Deciding
       * "did the rules change" here would mean the client owns the versioning rule — and two clients would
       * eventually disagree about whether something was a change.
       */
      await api('defSave', { params: { id: f.id },
        body: { name: f.name.trim(), note: f.note, rules: f.rules } });
      toast('Saved — a new version if the rules changed.');
    } else {
      await api('defAdd', { body: { kind: f.kind, sub_kind: f.sub || null,
                                    name: f.name.trim(), note: f.note, rules: f.rules } });
      toast('Created as a draft.');
    }
    closeModal(); CBDEF_FORM = null;
    await cbDefLoad(true);
  } catch (e) {
    if (err) err.textContent = (e && e.message) || 'Could not save that.';
  }
}

async function cbDefSetStatus(id, status){
  try { await api('defSave', { params: { id: id }, body: { status: status } });
        toast(status === 'live' ? 'Live — it can be adopted now.' : 'Back to draft.');
        await cbDefLoad(true); }
  catch (e) { toast((e && e.message) || 'Could not change that.'); }
}
/* ⚠️ In-app dialog, not `confirm()` — Athi, on the supplier panel: *"the message appears from the browser it has
   to be system message"*. `confirmAsk` (app.html) is the one replacement; this was one of the 8 stragglers.
   ⚠️ The wording says what actually happens. "Delete?" would be a lie — the row survives so that chits which
   cited it stay explainable, and someone who believes they erased something is owed the truth. */
/**
 * Go to the screen that OWNS a kind, and land on the right section of it.
 * ⚠️ The section is set BEFORE navigating AND again after the capability loads — the target screen reads
 * `CATSET.sec` as it renders, and on a cold load it renders before this file's `then` would have run.
 */
function cbDefGoHome(nav, sec){
  if (sec && nav === 'catsetup') { if (typeof CATSET === 'undefined') window.CATSET = { sec: sec }; else CATSET.sec = sec; }
  navTo(nav);
  if (sec && nav === 'catsetup') ensureCap('catsetup').then(function(){ CATSET.sec = sec; if (typeof catsetPaint === 'function') catsetPaint(); });
}
function cbDefRetire(id, name){
  confirmAsk('Retire “' + cbDefEsc(name) + '”?',
    'It leaves the shelf and <b>cannot be adopted again</b>.'
    + '<div style="margin-top:7px">It is <b>not deleted</b> — chits that already cite it stay explainable.</div>',
    'Retire', function(){ _cbDefRetire(id); }, true);
}
async function _cbDefRetire(id){
  try { await api('defRetire', { params: { id: id } }); toast('Retired.'); await cbDefLoad(true); }
  catch (e) { toast((e && e.message) || 'Could not retire that.'); }
}

/* ── render ──────────────────────────────────────────────────────────────────────────────────────────────────── */
function cbDefEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ⚠️ renderApp(), not a local paint — this screen returns HTML to the router like every other
   capability, so the router is the only thing that owns the frame. */
/**
 * ⚠️ REPAINT IN PLACE, KEEPING THE SCROLL (Athi, 2026-08-16: *"when I click the below items in defn screen, it
 * jumps to the top"*).
 *
 * It called renderApp(), which rebuilds the whole screen — and a fresh DOM starts at scrollTop 0. So opening the
 * ninth section threw you back to the first, and you had to scroll down again to see what you had just opened.
 * The further down the page a section is, the worse it gets, which is exactly backwards.
 *
 * Swapping only the definitions block and restoring the offset keeps the section you clicked under your cursor.
 * ⚠️ Read scrollTop BEFORE the innerHTML swap — after it the element has been rebuilt and reports 0.
 */
function cbDefScroller(){
  var w = document.querySelector('.cbdef-wrap');
  /* The scroller may be the wrap or an ancestor, depending on the shell — walk up to whichever actually scrolls. */
  var n = w;
  while (n && n !== document.body){ if (n.scrollHeight > n.clientHeight + 1) return n; n = n.parentElement; }
  return document.scrollingElement || document.documentElement;
}
function cbDefRepaint(){
  var host = document.querySelector('.cbdef-wrap');
  if (!host){ renderApp(); return; }                       // not on the screen — fall back
  var y = (cbDefScroller() || {}).scrollTop || 0;
  host.outerHTML = cbDefHTML();
  /**
   * ⚠️ RE-QUERY THE SCROLLER AFTER THE SWAP. My first version held a REFERENCE across `outerHTML =`, which
   * destroys the element — so it dutifully restored the offset onto a node no longer in the document, and the
   * page still jumped to the top. Measured: 574 → 0. The scroller here IS `.cbdef-wrap` (or an ancestor of it),
   * which is precisely the node being replaced, so the reference can never survive.
   */
  var sc = cbDefScroller();
  if (sc) sc.scrollTop = y;
}
function cbDefToggle(k){ CBDEF.open[k] = !CBDEF.open[k]; cbDefRepaint(); }

function cbDefSectionHTML(s){
  var open = !!CBDEF.open[s.key];
  var count = s.rows ? s.rows.length : 0;
  var head = '<div class="cbdef-head" data-testid="cbdef-' + cbDefEsc(s.key) + '"'
    + ' onclick="cbDefToggle(\'' + cbDefEsc(s.key) + '\')">'
    + '<span class="cbdef-ico">' + s.icon + '</span>'
    + '<span class="cbdef-t">' + cbDefEsc(s.title) + '</span>'
    /* ⚠️ "not loaded" is NOT "0". An empty list and a missing source look identical on screen and mean opposite
       things — one says the catalogue may have none of these, the other says this screen cannot tell you. */
    + '<span class="cbdef-n">' + (s.rows ? count + ' kind' + (count === 1 ? '' : 's') : 'not loaded') + '</span>'
    + '<span class="cbdef-caret">' + (open ? '▾' : '▸') + '</span></div>';
  if (!open) return '<div class="cbdef-sec">' + head + '</div>';

  var body = '<div class="cbdef-blurb">' + cbDefEsc(s.blurb) + '</div>';
  if (!s.rows) {
    body += '<div class="cbdef-empty">This registry has not loaded on this page, so its kinds cannot be listed. '
          + 'It is not that there are none.</div>';
  } else {
    body += s.rows.map(function (r) {
      return '<div class="cbdef-row">'
        + '<code class="cbdef-code">' + cbDefEsc(r.code) + '</code>'
        + '<span class="cbdef-lab">' + cbDefEsc(r.label) + '</span>'
        + (r.who ? '<span class="cbdef-who">' + cbDefEsc(r.who) + '</span>' : '')
        + (r.note ? '<div class="cbdef-note">' + cbDefEsc(r.note) + '</div>' : '')
        /* ⭐ A worked example is what turns a scheme name into something someone can act on. */
        + (r.eg ? '<div class="cbdef-eg"><span class="cbdef-eglab">e.g.</span> ' + cbDefEsc(r.eg) + '</div>' : '')
        /* ⚠️ rel="noopener" — a target=_blank link without it hands the opened page a handle on ours. */
        + (r.url ? '<div class="cbdef-link"><a href="' + cbDefEsc(r.url) + '" target="_blank" rel="noopener noreferrer">'
                 + cbDefEsc(r.url.replace(/^https?:\/\//, '')) + ' ↗</a></div>' : '')
        + '</div>';
    }).join('');
  }
  /* ⭐ THE SOURCE IS ON SCREEN. This screen's whole claim is that it does not keep its own list; saying WHERE
     each list comes from is what makes that checkable rather than a promise in a comment. */
  body += '<div class="cbdef-src">read from <code>' + cbDefEsc(s.source) + '</code></div>';
  return '<div class="cbdef-sec">' + head + '<div class="cbdef-body">' + body + '</div></div>';
}

/**
 * ⭐ YOUR OWN DEFINITIONS — rendered ABOVE the registry showcase, because what you made matters more to you
 * than what the system knows. The showcase becomes reference material once you have your own shelf.
 */
/**
 * The registry rows for one authorable kind, rendered INSIDE that kind's section. Reads `cbDefRegistries()` — the
 * same source the standalone sections used — so merging the two sections did not create a second list.
 *
 * ⚠️ Returns nothing when the registry has not loaded, rather than an empty "kinds" heading with nothing under it.
 * An empty list and a missing source look identical and mean opposite things; the standalone section says "not
 * loaded" in its count, and here the honest move is to show no heading at all.
 */
function cbDefKindsInline(kind){
  var s = cbDefRegistries().filter(function (x) { return x.key === kind; })[0];
  if (!s || !s.rows || !s.rows.length) return '';
  return '<div class="cbdef-kindsin">'
    + '<div class="cbdef-kindshd">Built from — ' + s.rows.length + ' kind' + (s.rows.length === 1 ? '' : 's') + '</div>'
    + s.rows.map(function (r) {
        return '<div class="cbdef-kindrow"><code class="cbdef-code">' + cbDefEsc(r.code) + '</code>'
          + '<span class="cbdef-kindlbl">' + cbDefEsc(r.label) + '</span>'
          + (r.note ? '<span class="cbdef-kindnote">' + cbDefEsc(r.note) + '</span>' : '') + '</div>';
      }).join('')
    + '</div>';
}
function cbDefMineHTML(){
  if (CBDEF.mine === null) { cbDefLoad(); return '<div class="cbdef-loading">Reading your shelf…</div>'; }

  var out = Object.keys(CBDEF_AUTHORABLE).map(function (kind) {
    var A = CBDEF_AUTHORABLE[kind];
    var mine = cbDefMineOf(kind), retired = cbDefRetiredOf(kind);
    var rows = mine.map(function (d) {
      var live = d.status === 'live';
      /**
       * ⚠️ THREE STATES, NOT TWO (backlog 19; Athi: *"if the offer are retired then that has to be shown as
       * retired as well"*). This was `live ? 'live' : 'draft'` — a boolean for a column with THREE values, so a
       * RETIRED definition rendered as **draft**. Worse than hiding it: "draft" reads as *not finished, you might
       * publish it*, when the truth is *withdrawn, and it can never be adopted again* — so someone reads the badge
       * and tries to publish it.
       */
      var st = d.status === 'live' ? 'live' : d.status === 'retired' ? 'retired' : 'draft';
      return '<div class="cbdef-mine-row' + (st === 'retired' ? ' is-retired' : '') + '" data-testid="cbdef-mine-' + cbDefEsc(d.definition_id) + '">'
        + '<span class="cbdef-mine-n">' + cbDefEsc(d.name) + '</span>'
        + (d.sub_kind ? '<code class="cbdef-code">' + cbDefEsc(d.sub_kind) + '</code>' : '')
        + '<span class="cbdef-badge ' + st + '">' + st + '</span>'
        /* ⭐ THE VERSION IS ON SCREEN. It is the thing a stamped chit points at, so hiding it would make the
           freeze rule invisible in the one place someone might need to check it. */
        + '<span class="cbdef-ver">v' + cbDefEsc(d.current_version) + '</span>'
        + '<span class="cbdef-acts">'
        +   '<span onclick="cbDefEdit(\'' + cbDefEsc(d.definition_id) + '\')">Edit</span>'
        +   '<span onclick="cbDefSetStatus(\'' + cbDefEsc(d.definition_id) + '\',\'' + (live ? 'draft' : 'live') + '\')">'
        +   (live ? 'Unpublish' : 'Publish') + '</span>'
        +   '<span onclick="cbDefRetire(\'' + cbDefEsc(d.definition_id) + '\',\'' + cbDefEsc(d.name) + '\')">Retire</span>'
        + '</span></div>';
    }).join('');

    /**
     * ⭐ THE SAME SHELL AS THE REGISTRY SECTIONS (Athi, 2026-08-16: *"also the categories, order models and offers
     * also the same way if it look and feel it will be good … otherwise they look different"*).
     *
     * They already shared `cbdef-sec` and `cbdef-head`, but had NO CARET and NO TOGGLE — always open, while every
     * other section on the page collapsed. One page, two behaviours for the same-looking row, which is exactly
     * what made them read as a different kind of thing.
     *
     * ⚠️ They DEFAULT OPEN, unlike the registries. That is a difference in default, not in form — these are your
     * own definitions and there are few of them, so hiding them behind a click on arrival would be worse. The
     * affordance is identical either way.
     */
    var mkey = 'mine:' + kind;
    if (CBDEF.open[mkey] === undefined) CBDEF.open[mkey] = true;
    var mopen = !!CBDEF.open[mkey];
    return '<div class="cbdef-sec">'
      + '<div class="cbdef-head cbdef-head-mine" data-testid="cbdef-mine-head-' + kind + '"'
      +   ' onclick="cbDefToggle(\'' + mkey + '\')">'
      +   '<span class="cbdef-ico">' + A.icon + '</span>'
      +   '<span class="cbdef-t">' + cbDefEsc(A.title) + '</span>'
      +   '<span class="cbdef-n">' + mine.length + (retired.length ? ' · ' + retired.length + ' retired' : '') + '</span>'
      /* stopPropagation — otherwise the button also collapses the section it is about to act on.
         ⚠️ A kind with a `home` is authored on ITS OWN SCREEN, so this offers the door rather than a second
         Create form. Two places to author one thing is the duplication this screen exists to have removed. */
      +   (A.home
            ? '<button class="cbdef-new" data-testid="cbdef-home-' + kind + '" onclick="event.stopPropagation();cbDefGoHome(\'' + A.home.nav + '\',\'' + (A.home.sec || '') + '\')">' + cbDefEsc(A.home.label) + '</button>'
            : '<button class="cbdef-new" data-testid="cbdef-new-' + kind + '" onclick="event.stopPropagation();cbDefNew(\'' + kind + '\')">+ New</button>')
      +   '<span class="cbdef-caret">' + (mopen ? '▾' : '▸') + '</span>'
      + '</div>'
      + (mopen ? ('<div class="cbdef-body">'
      +   '<div class="cbdef-blurb">' + cbDefEsc(A.blurb) + '</div>'
      /* ⚠️ An empty shelf says what to do, not "0 results". Nobody arrives here knowing what a definition is for. */
      +   (rows || '<div class="cbdef-none">None yet. <b>+ New</b> to name one — then a catalogue can adopt it.</div>')
      /* The vocabulary this kind is built from, in the same section rather than a second one further down. Still
         read STRAIGHT from the registry — folding the sections together must not fold in a copy of the list. */
      +   cbDefKindsInline(kind)
      + '</div>') : '')
      + '</div>';
  }).join('');

  return '<div class="cbdef-mine">'
    + (CBDEF.err ? '<div class="cbdef-err">' + cbDefEsc(CBDEF.err) + '</div>' : '')
    + out + '</div>';
}

function cbDefHTML(){
  var secs = cbDefRegistries();
  return '<div class="cbdef-wrap" data-testid="definitions">'
    + '<div class="cbdef-hd">'
    +   '<span style="font-family:\'Space Grotesk\';font-weight:700;font-size:var(--fs-3)">🧱 Definitions</span>'
    +   '<button onclick="openAssist(\'definitions\')" title="Ask the assistant about this screen"'
    +   ' style="border:1px solid var(--line);background:var(--card);color:var(--blue);border-radius:50%;width:20px;'
    +   'height:20px;font-weight:800;cursor:pointer;font-size:12px;line-height:1;flex:none">?</button>'
    + '</div>'
    + '<div class="cbdef-lede">Everything a catalogue can be built from. These are the <b>kinds</b> the system '
    + 'knows — the shapes available to you. Naming your own (a category list, an offer, “Carton of 6”) and '
    + 'attaching them to a catalogue comes next.</div>'
    /**
     * ⚠️ SAYING WHAT IS NOT HERE, IN THE PRODUCT, NOT ONLY IN A SPEC. A showcase that looks like a finished
     * feature invites someone to hunt for the Create button and conclude the screen is broken. The honest
     * version of "read-only first" says so out loud.
     */
    /**
     * ⚠️ THIS BANNER SAID "read-only showcase" FOR ABOUT AN HOUR AFTER IT STOPPED BEING TRUE. A screen that
     * describes itself wrongly is worse than one that says nothing: someone reads it, believes the Create button
     * is decorative, and stops looking. Copy is part of the build, not a label applied afterwards.
     */
    + '<div class="cbdef-note-box">Name your own below — a category, an order model, an offer. '
    + 'A definition stays <b>loose while a catalogue references it</b>: edit it and every catalogue that adopted '
    + 'it sees the new terms. It is <b>frozen by value the moment a chit is stamped</b>, so a chit keeps the '
    + 'version it agreed even after you change the shelf. '
    + '<span style="opacity:.8">Adoption — attaching one to a catalogue — comes next.</span></div>'
    /**
     * ⭐ ONE SECTION PER SUBJECT (Athi, 2026-08-16: *"order model and order model kinds looks similar if so, one
     * has to be removed. and should bring it together"*).
     *
     * "Order models" (yours) and "Order model kinds" (the vocabulary) were two sections with the SAME key and the
     * SAME icon, one above the other — so the page asked you to hold a distinction it never explained. Same for
     * Offers / Offer kinds. They are now folded into one section each: your named ones, then the kinds they are
     * built from. The registry list still comes from the registry — nothing is copied.
     *
     * ⚠️ Renaming one of them would not have fixed it. Two rows about one subject is the problem; a better label
     * only makes the split easier to describe.
     */
    + cbDefMineHTML()
    + (function(){
        var rest = secs.filter(function(s){ return !CBDEF_AUTHORABLE[s.key]; });
        if (!rest.length) return '';
        return '<div class="cbdef-shelfhd">What the system knows — the shapes available to you</div>'
             + rest.map(cbDefSectionHTML).join('');
      })()
    + '</div>';
}

/**
 * definitionsScreen — the entry point the router calls. RETURNS HTML; it does not paint. Every other
 * capability in this app works that way (traceabilityScreen, readinessScreen, disputesScreen) and a screen that
 * painted itself would be the one that behaves differently for no reason.
 */
function definitionsScreen(){ cbDefCss(); return cbDefHTML(); }

function cbDefCss(){
  if (document.getElementById('cbdef_css')) return;
  var s = document.createElement('style');
  s.id = 'cbdef_css';
  s.textContent = [
    /**
     * ⚠️⚠️ THE SCREEN MUST OWN ITS OWN SCROLLING. `#mainbody` is `flex:1; display:flex; flex-direction:column;
     * min-height:0` — a flex COLUMN that does not scroll. A screen that just returns tall HTML gets clipped in
     * silence: measured here at 2,071px of content in a 799px viewport with `overflow-y: visible`, so 1,272px —
     * every section below Offer kinds — was simply unreachable. Nothing errors, the page just ends.
     *
     * Peer screens (cap-readiness and friends) each wrap their body in an `overflow:auto` pane for exactly this
     * reason. `flex:1` so it takes the remaining height rather than its content's height, and `min-height:0`
     * because a flex item's default `min-height:auto` refuses to shrink below its content and would put the
     * overflow back where it started.
     */
    '.cbdef-wrap{flex:1;min-height:0;overflow-y:auto;padding:14px 16px 40px;max-width:820px}',
    '.cbdef-hd{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
    '.cbdef-lede{font-size:13px;color:var(--grey);line-height:1.55;margin-bottom:10px;max-width:66ch}',
    '.cbdef-note-box{font-size:var(--fs-2);line-height:1.55;color:#6b5a36;background:var(--gold-soft);',
    'border:1px solid var(--gold-line);border-radius:9px;padding:10px 12px;margin-bottom:14px;max-width:66ch}',
    '.cbdef-sec{border:1px solid var(--line);border-radius:12px;margin-bottom:9px;background:var(--card);overflow:hidden}',
    '.cbdef-head{display:flex;align-items:center;gap:9px;padding:11px 13px;cursor:pointer;user-select:none}',
    '.cbdef-head:hover{background:#fafafa}',
    '.cbdef-ico{font-size:var(--fs-4);line-height:1}',
    '.cbdef-t{font-weight:700;font-size:13.5px}',
    '.cbdef-n{margin-left:auto;font-size:11.5px;color:var(--grey);font-variant-numeric:tabular-nums}',
    '.cbdef-caret{color:var(--grey);font-size:12px;width:12px;text-align:center}',
    '.cbdef-body{padding:0 13px 12px;border-top:1px solid var(--line)}',
    '.cbdef-blurb{font-size:var(--fs-2);color:var(--grey);line-height:1.5;margin:10px 0 8px;max-width:66ch}',
    '.cbdef-row{padding:7px 0;border-bottom:1px dashed #eee9e0}',
    '.cbdef-row:last-of-type{border-bottom:0}',
    '.cbdef-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;',
    'background:#f4f2ec;border-radius:5px;padding:1px 6px;margin-right:8px;color:#5a5245}',
    '.cbdef-lab{font-size:13px;font-weight:600}',
    '.cbdef-note{font-size:12px;color:var(--grey);margin-top:3px;line-height:1.5;max-width:66ch}',
    '.cbdef-who{font-size:var(--fs-1);color:#9aa3a7;margin-left:8px}',
    '.cbdef-eg{font-size:12px;margin-top:4px;background:var(--gold-soft,var(--gold-soft));border:1px solid var(--gold-line,var(--gold-line));',
    'border-radius:6px;padding:4px 9px;display:inline-block;max-width:66ch;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}',
    '.cbdef-eglab{font-weight:700;color:#8a6d1e;font-family:inherit}',
    '.cbdef-link{margin-top:4px}',
    '.cbdef-link a{font-size:11.5px;color:var(--blue,var(--blue));text-decoration:none}',
    '.cbdef-link a:hover{text-decoration:underline}',
    '.cbdef-empty{font-size:var(--fs-2);color:var(--disp);padding:6px 0 2px;max-width:66ch}',
    '.cbdef-src{margin-top:10px;font-size:var(--fs-1);color:#9aa3a7}',
    '.cbdef-src code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1)}',
    '.cbdef-mine{margin-bottom:22px}',
    '.cbdef-shelfhd{font-size:var(--fs-1);text-transform:uppercase;letter-spacing:.06em;color:var(--grey);margin:18px 0 8px;font-weight:700}',
    '.cbdef-head-mine{cursor:default}',
    '.cbdef-head-mine:hover{background:transparent}',
    '.cbdef-new{margin-left:10px;border:1px solid var(--blue,var(--blue));background:var(--blue,var(--blue));color:#fff;border-radius:9px;padding:4px 11px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;flex:none}',
    '.cbdef-mine-row{display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px dashed #eee9e0;flex-wrap:wrap}',
    '.cbdef-mine-row:last-child{border-bottom:0}',
    '.cbdef-mine-n{font-size:13.5px;font-weight:700}',
    '.cbdef-badge{font-size:var(--fs-1);font-weight:700;border-radius:6px;padding:1px 7px;text-transform:uppercase;letter-spacing:.04em}',
    '.cbdef-badge.live{background:#e6f4ec;color:#2c7a43}',
    '.cbdef-badge.draft{background:#f4f2ec;color:#8a6d1e}',
    /* Retired is visually SPENT — struck name, grey badge — so it can never be mistaken for a draft awaiting publish. */
    '.cbdef-badge.retired{background:#eceaea;color:#6f6a6a}',
    '.cbdef-kindsin{margin-top:12px;border-top:1px dashed var(--line);padding-top:9px}',
    '.cbdef-kindshd{font-size:var(--fs-1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--grey);margin-bottom:5px}',
    '.cbdef-kindrow{display:flex;gap:9px;align-items:baseline;padding:3px 0;font-size:var(--fs-2);flex-wrap:wrap}',
    '.cbdef-kindlbl{color:var(--ink)}',
    '.cbdef-kindnote{color:var(--grey);font-size:11.5px;flex:1;min-width:0}',
    '.cbdef-mine-row.is-retired .cbdef-mine-n{text-decoration:line-through;color:var(--grey)}',
    '.cbdef-mine-row.is-retired{opacity:.82}',
    '.cbdef-ver{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:var(--fs-1);color:#9aa3a7}',
    '.cbdef-acts{margin-left:auto;display:flex;gap:12px}',
    '.cbdef-acts span{font-size:11.5px;color:var(--blue,var(--blue));cursor:pointer;font-weight:600}',
    '.cbdef-acts span:hover{text-decoration:underline}',
    '.cbdef-none{font-size:var(--fs-2);color:var(--grey);padding:4px 0}',
    '.cbdef-loading{padding:14px 0;font-size:var(--fs-2);color:var(--grey)}',
    '.cbdef-err{font-size:var(--fs-2);color:var(--disp);background:#fbeceb;border:1px solid #f0c9c6;border-radius:9px;padding:8px 11px;margin-bottom:10px}',
    '.cbdef-freeze{font-size:12px;line-height:1.5;color:#6b5a36;background:var(--gold-soft,var(--gold-soft));border:1px solid var(--gold-line,var(--gold-line));border-radius:9px;padding:8px 11px;margin:8px 0 10px}',
    '.cbdef-rules{border-left:2px solid var(--gold-line,var(--gold-line));padding-left:11px;margin:10px 0}',
    /* The standards menu. Scrolls rather than wraps to twelve rows — the textarea above it is the record; this is
       a way of filling it without knowing the keys by heart. */
    '.cbdef-stdhint{font-size:11.5px;color:var(--grey);margin:8px 0 5px}',
    '.cbdef-stds{display:flex;flex-wrap:wrap;gap:5px;max-height:132px;overflow-y:auto;padding:2px 1px}',
    '.cbdef-stdchip{border:1px solid var(--line);background:var(--card);border-radius:20px;height:26px;padding:0 10px;'
      + 'font:inherit;font-size:11.5px;color:var(--ink);cursor:pointer;white-space:nowrap}',
    '.cbdef-stdchip:hover{border-color:#c6ccd4}',
    '.cbdef-stdchip.on{background:#EDF2F9;border-color:var(--blue,var(--blue));color:var(--blue,var(--blue));font-weight:700}'
  ].join('');
  (document.head || document.documentElement).appendChild(s);
}
