/* app/compose-catalogue-fill.js - COMPOSE, ONCE ITS MODAL IS OPEN: fill the product picker in place.
 *
 * OWNS      composeFillCatalogue() - reads YOUR products through ensureCatalogue (never a supplier's own catalogue), sets UI._catState, re-points the cart and repaints the picker.
 * CALLED BY public/app.html compose() (after the modal is open).
 * FLOW      ensureCatalogue(true) -> ready, or error only when the read failed and nothing is cached -> ccCartSync() -> ccRenderCatPick().
 * CARD      01-rail-core-the-chit/chit-design-2
 */
/** compose, once its modal is open: fetch YOUR products (never for a supplier's own catalogue) and fill the picker in place. Keeps any cached list on failure; the error state only when there was nothing. ccRenderCatPick is a no-op if the modal was closed. */
async function composeFillCatalogue() {
  try {
    /* ⭐ Through the SHARED loader — the mapping below moved into ensureCatalogue() so the worklist picker
       and compose fill STORE.catalogue the same way. Two mappings of one record is how the same product
       obeyed different rules on different screens, which the note below records happening once already. */
    await ensureCatalogue(true);
    /**
     * ⚠️⚠️ CARRY THE WHOLE RECORD. THIS LINE USED TO ENUMERATE THREE FIELDS AND THROW THE REST AWAY.
     *
     * Athi, 2026-08-15: *"product should be able to carry million parameters if required, what we have is
     * sample"*. He is right, and the backend already agrees — `item_data` is jsonb and stores whatever is put
     * in it. Measured with a real Pochampally silk record: 16 fields in (sku, gtin, hsn, gi_certificate,
     * handloom_mark, tier pricing, incoterm, lead_time_days, moq, care, notes_for_buyer, nested origin and
     * attributes) and THREE fields out. Everything a trade document actually needs was discarded here, before
     * any screen could see it.
     *
     * ⚠️ AND IT SILENTLY DISABLED THE ORDER MODELS. `order:{model:'pack',step:6}` died on this line, so a
     * product sold in sixes became a loose count in compose — while Suppliers and Network, which pass the
     * catalogue payload through untouched, enforced it correctly. The same product obeying two different rules
     * depending on which screen you opened.
     *
     * The rule now: SPREAD, never enumerate. `particulars` is added as the display alias the flat shape uses;
     * nothing is removed. A field added to the catalogue next month arrives here without anyone editing this.
     */
    /* ⚠️ The map that stood here is now inside ensureCatalogue(), called above. It is deliberately NOT left
       duplicated here: two mappings of one record is precisely how the quantity models died on this line
       once before, with Suppliers and Network enforcing a rule compose had quietly dropped. */
    /* WALK-N N-F-01: an EMPTY catalogue is "No items yet" with the add action, not a fault; the error words only when the read FAILED */
    UI._catState = (STORE.catalogue || []).length || !_catFailed ? 'ready' : 'error';
  } catch (e) {
    UI._catState = (STORE.catalogue || []).length ? 'ready' : 'error';
  }
  ccCartSync(); // the products just arrived — point the cart at them before painting it
  ccRenderCatPick();
}
