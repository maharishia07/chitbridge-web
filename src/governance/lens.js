import { VERTICALS } from './verticals';
const LABELS = {
  counterparty: { formal:{ en:'Counterparty', ta:'எதிர் தரப்பு', hi:'प्रतिपक्ष' }, casual:{ en:"Who you're dealing with", ta:'யாருடன்', hi:'किसके साथ' } },
  amount:       { formal:{ en:'Amount', ta:'தொகை', hi:'राशि' },                     casual:{ en:'How much', ta:'எவ்வளவு', hi:'कितना' } },
  submit:       { formal:{ en:'Submit for approval', ta:'ஒப்புதலுக்கு சமர்ப்பி', hi:'अनुमोदन हेतु भेजें' }, casual:{ en:'Send it', ta:'அனுப்பு', hi:'भेजो' } },
};
export function label(key, lens) {
  const e = LABELS[key]; if (!e) return key;
  const voc = e[lens.vocabulary] || e.formal;
  return voc[lens.language] || voc.en || key;
}
export function resolveLens(constitution, sel, override = {}) {
  const fromVertical = VERTICALS[sel.vertical]?.preset_lenses || {};
  const allowed = constitution.params.allowed_languages?.set || ['en'];
  const defLang = (constitution.params.allowed_languages?.value || ['en'])[0];
  let language = override.language || fromVertical.language || defLang;
  const languageRejected = !allowed.includes(language);
  if (languageRejected) language = defLang;
  return { vocabulary: override.vocabulary || fromVertical.vocabulary || 'formal',
    navigation: override.navigation || fromVertical.navigation || 'sidebar',
    comparison: override.comparison || fromVertical.comparison || 'off',
    language, allowedLanguages: allowed, languageRejected };
}
