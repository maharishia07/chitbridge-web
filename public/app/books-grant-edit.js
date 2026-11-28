/**
 * books-grant-edit.js — UX-220 (firm-connect 1138): ACCESS I GAVE, every fact of a grant in its own row detail, and the costs choice changed without ending the access.
 *
 * ID        NET004
 * OWNER     cb-network
 * RISK      personal-data
 * OWNS      the detail of one grant row (who · role · until · why · costs · who posts) so nothing is hidden at 1366 px; the costs box of the Change sheet; what the change sends (PATCH only what moved); the plain-words confirm that a RISE in costs needs (the same words as giving)
 * CALLED BY books-grant-member.js (paintGiven's `next`, openChange)
 * FLOW      detail(grant, say) → the row's detail markup · costsBox(grant) → the checkbox · body(grant, ids) → the PATCH body · riseWords(consent) → the confirm body · wording(failure) → 422/503 said in words · failSaid(said, failure) → the sentence the sheet shows
 * CARD      04-network/ACC-176-AUDITOR-GRANT
 *
 * The server decides: a rise in costs without consent is a 422 BOOKS_GRANT_CONSENT_NEEDED, the column not yet opened is a 503; this file only asks the owner first and says each refusal.
 *   CBBooksGrantEdit.detail · .costsBox · .body · .riseWords · .rising · .wording
 */
(function (root) {
  'use strict';
  function words(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  /** one fact of the detail: label and value, the value already plain text */
  function fact(label, value) {
    return '<div><span class="sub">' + esc(words(label)) + '</span> <b>' + esc(value) + '</b></div>';
  }
  /** the grant row's detail: every column the list may drop at a narrow width, said once (say = { who, role, until, posting }, each already in words) */
  function detail(grant, say) {
    return (
      '<div class="bg-detail" data-testid="bg-detail">' +
      fact('Who', say.who) + fact('Role', say.role) + fact('Until', say.until) + fact('Why', grant.purpose || '—') +
      fact('Costs', grant.can_see_costs ? words('Seen') : words('Hidden')) + (say.posting ? fact('Who posts', say.posting) : '') +
      '</div>'
    );
  }
  /** the costs choice on the Change sheet, as it stands now */
  function costsBox(grant) {
    return '<label class="bg-tick"><input data-cbsid="NET004-I11" id="bg_costs2" type="checkbox"' + (grant.can_see_costs ? ' checked' : '') + ' data-testid="bg-costs2"> ' + esc(words('They can see my costs and margins')) + '</label>';
  }
  /** a rise: costs were hidden and the box is now ticked */
  function rising(grant, ticked) {
    return grant.can_see_costs === false && !!ticked;
  }
  /** the PATCH body: the end date and posting as before, the costs choice only when it moved; a rise carries consent (asked first) */
  function body(grant, ids) {
    var out = { expires_at: ids.until, posting: ids.posting || undefined };
    if (grant.can_see_costs !== undefined && !!ids.costs !== !!grant.can_see_costs) { /* a row that does not say what it shows never has costs hidden by an unticked box */
      out.can_see_costs = !!ids.costs;
      if (rising(grant, ids.costs)) out.consent = true;
    }
    return out;
  }
  /** the confirm of a rise in costs: the server's own words of giving them, then the question */
  function riseWords(consent, who) {
    var said = consent ? [consent.headline, consent.costs].filter(Boolean).map(function (line) { return '<div>' + esc(line) + '</div>'; }).join('') : '';
    return '<b>' + esc(who) + '</b> ' + esc(words('can see your costs and margins.')) + said + '<div>' + esc(words('Every look is recorded. You can hide costs again.')) + '</div>';
  }
  /** a refusal of the change in words: the costs column not switched on yet, or consent missing */
  function wording(failure) {
    if (failure && failure.code === 'BOOKS_GRANT_NOT_SWITCHED_ON') failure.message = words('Changing what your firm sees is not switched on yet. Nothing was changed.');
    else if (failure && failure.code === 'BOOKS_GRANT_CONSENT_NEEDED') failure.message = words('Say yes to showing your costs first. Nothing was changed.');
    return failure;
  }
  /** what to say when the change failed: the server's refusals above are said as they are (a 503 never shows its words by itself), anything else keeps the action's own sentence */
  function failSaid(said, failure) {
    return failure && /^BOOKS_GRANT_(NOT_SWITCHED_ON|CONSENT_NEEDED)$/.test(failure.code) ? failure.message : said;
  }
  root.CBBooksGrantEdit = { failSaid: failSaid, detail: detail, costsBox: costsBox, rising: rising, body: body, riseWords: riseWords, wording: wording };
})(typeof window !== 'undefined' ? window : globalThis);
