/* app/compose-tax-choice.js - COMPOSE: the tax choice on a line the person TYPES (no catalogue item names its tax).
 *
 * ID        RAL001
 * OWNER     cb-accounting
 * RISK      money
 * OWNS      composeTaxChoices(pack) (the choices the shop's country pack offers) and composeTaxFields(pack, key) (the line fields a choice sends); no rate and no country word is typed here, both read the pack.
 * CALLED BY public/app.html ccRenderTaxChoice / ccAddManual / ccMintedLine.
 * FLOW      SESSION.country -> CBTaxPacks.packFor -> supplyKinds + standard_rate -> choices [{key,label}] -> a line's tax_kind + gst_rate 0 (zero / exempt) or nothing (standard: the api stamps the pack's standard rate, api PR #1400).
 * CARD      15-tax-and-country-packs/tax-compute-rate-invoice-tax
 * WHY       TAXLINE-1132 (27 Nov 2026): the api gives a typed line the standard rate; without a way to say "GST-free" a typed GST-free item would be taxed 10%. Default standard, choosable (Xero: "GST on Income" / "GST Free Income").
 */
/** the pack's kind ids for each choice, first one the pack has wins (AU gst_free / input_taxed, AE zero_rated / exempt, IN nil / exempt) */
var COMPOSE_TAX_KINDS = { zero: ['gst_free', 'zero_rated', 'nil'], exempt: ['exempt', 'input_taxed'] };
/** the kind of the pack that answers this choice, or null */
function composeTaxKindOf(pack, key) {
  var kinds = (pack && pack.supplyKinds) || {};
  var ids = COMPOSE_TAX_KINDS[key] || [];
  for (var at = 0; at < ids.length; at++) if (kinds[ids[at]]) return kinds[ids[at]];
  return null;
}
/** the choices this pack offers for a typed line: [{ key: 'standard'|'zero'|'exempt', label }] - standard first when the pack has ONE standard rate (default); none for no pack */
function composeTaxChoices(pack) {
  var out = [];
  if (!pack) return out;
  if (typeof pack.standard_rate === 'number') out.push({ key: 'standard', label: 'Standard (' + pack.standard_rate + '%)' });
  ['zero', 'exempt'].forEach(function (key) {
    var kind = composeTaxKindOf(pack, key);
    if (kind) out.push({ key: key, label: kind.short || kind.name || kind.id });
  });
  return out;
}
/** the fields a choice puts on a minted line: standard / nothing chosen -> {} (the api stamps the standard rate); zero / exempt -> rate 0 WITH the pack's kind (a zero must say why) */
function composeTaxFields(pack, key) {
  var kind = key === 'zero' || key === 'exempt' ? composeTaxKindOf(pack, key) : null;
  return kind ? { gst_rate: 0, tax_kind: kind.id } : {};
}
