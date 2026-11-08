/**
 * strings-ui-standard.js — the labels of the UI standard page (ui-standard.html), in Tamil, Hindi, Arabic and French.
 * Same shape as strings-ta.js and its siblings: the English is the key; each pack is merged into CBSTR.
 * These sit in their own file so the page does not touch the four big packs (a translation PR for those trips the readability guard on old debt);
 * they move into the packs when the stable-keys PR (ux137-i18n-keys) lands. Short labels only: the explanation lines stay English until reviewed.
 * CALLED BY  public/ui-standard.html (loaded after the four packs, before ui-standard.js)
 * FLOW       load -> merge each pack into CBSTR (an existing key is never overwritten)
 * CARD       29-qa-test-tooling-ux-locale-and-design-system/ui-action-set
 * ⚠️ Written by the page's builder, not by a native speaker: Tamil first for Athi's eye, then Hindi, Arabic and French.
 */
(function () {
  if (typeof CBSTR === 'undefined') return;
  var packs = {
    ta: {
      'Bill posted': 'பில் பதிவிடப்பட்டது', 'Supplier removed': 'சப்ளையர் நீக்கப்பட்டார்', 'Supplier restored': 'சப்ளையர் மீட்கப்பட்டார்', 'Settings saved': 'அமைப்புகள் சேமிக்கப்பட்டன',
      Type: 'எழுத்து வடிவம்', 'not the product face': 'தயாரிப்பின் எழுத்துரு அல்ல',
      Font: 'எழுத்துரு', 'Text size': 'எழுத்து அளவு', Weight: 'தடிமன்', Normal: 'இயல்பான', Bold: 'தடித்த', 'Across themes': 'தீம்கள் முழுவதும்',
      'UI standard': 'UI தரநிலை', Components: 'கூறுகள்', Popups: 'பாப்-அப்கள்', Icons: 'குறியீடுகள்', Tokens: 'வடிவ மதிப்புகள்',
      'Before and after': 'முன்பும் பின்பும்', Light: 'வெளிச்சம்', Dark: 'இருள்', Language: 'மொழி', Screen: 'திரை',
      'This screen': 'இந்தத் திரை', Desktop: 'மேசைக்கணினி', Mobile: 'கைபேசி', Size: 'அளவு', Compact: 'சிறியது', Large: 'பெரியது',
      'Too small': 'மிகச் சிறியது', '24 px target': '24 px இலக்கு', Default: 'இயல்பு', Hover: 'மேலே சுட்டி', Focus: 'கவனம்',
      Pressed: 'அழுத்தியது', Disabled: 'முடக்கம்', Busy: 'வேலை நடக்கிறது', Code: 'குறியீடு', Before: 'முன்பு', After: 'பின்பு',
      'Example dialog': 'எடுத்துக்காட்டு உரையாடல்', 'Post this bill?': 'இந்த பில்லை பதிவிடவா?', 'Post bill': 'பில்லை பதிவிடு',
      'Post this bill for {amount} to {count} recipients?': 'இந்த பில்லை {count} பெறுநர்களுக்கு {amount} தொகையுடன் பதிவிடவா?',
      'Remove this supplier?': 'இந்த சப்ளையரை நீக்கவா?', 'Remove {name} from this list?': 'இந்தப் பட்டியலிலிருந்து {name} ஐ நீக்கவா?',
      Value: 'மதிப்பு', Measured: 'அளந்தது', Contrast: 'வேறுபாடு'
    },
    hi: {
      'Bill posted': 'बिल पोस्ट हो गया', 'Supplier removed': 'सप्लायर हटाया गया', 'Supplier restored': 'सप्लायर वापस जोड़ा गया', 'Settings saved': 'सेटिंग्स सहेजी गईं',
      Type: 'टाइपोग्राफ़ी', 'not the product face': 'उत्पाद का फ़ॉन्ट नहीं',
      Font: 'फ़ॉन्ट', 'Text size': 'टेक्स्ट आकार', Weight: 'मोटाई', Normal: 'सामान्य', Bold: 'बोल्ड', 'Across themes': 'सभी थीम में',
      'UI standard': 'UI मानक', Components: 'घटक', Popups: 'पॉप-अप', Icons: 'आइकन', Tokens: 'डिज़ाइन टोकन',
      'Before and after': 'पहले और बाद', Light: 'हल्का', Dark: 'गहरा', Language: 'भाषा', Screen: 'स्क्रीन',
      'This screen': 'यह स्क्रीन', Desktop: 'डेस्कटॉप', Mobile: 'मोबाइल', Size: 'आकार', Compact: 'छोटा', Large: 'बड़ा',
      'Too small': 'बहुत छोटा', '24 px target': '24 px लक्ष्य', Default: 'डिफ़ॉल्ट', Hover: 'होवर', Focus: 'फ़ोकस',
      Pressed: 'दबाया', Disabled: 'बंद', Busy: 'चालू है', Code: 'कोड', Before: 'पहले', After: 'बाद',
      'Example dialog': 'उदाहरण संवाद', 'Post this bill?': 'यह बिल पोस्ट करें?', 'Post bill': 'बिल पोस्ट करें',
      'Post this bill for {amount} to {count} recipients?': 'यह बिल {amount} के साथ {count} प्राप्तकर्ताओं को पोस्ट करें?',
      'Remove this supplier?': 'इस सप्लायर को हटाएँ?', 'Remove {name} from this list?': '{name} को इस सूची से हटाएँ?',
      Value: 'मान', Measured: 'मापा', Contrast: 'कंट्रास्ट'
    },
    ar: {
      'Bill posted': 'تم ترحيل الفاتورة', 'Supplier removed': 'تمت إزالة المورّد', 'Supplier restored': 'تمت استعادة المورّد', 'Settings saved': 'تم حفظ الإعدادات',
      Type: 'الخط والطباعة', 'not the product face': 'ليس خط المنتج',
      Font: 'الخط', 'Text size': 'حجم النص', Weight: 'السُمك', Normal: 'عادي', Bold: 'غامق', 'Across themes': 'عبر السمات',
      'UI standard': 'معيار الواجهة', Components: 'المكوّنات', Popups: 'النوافذ المنبثقة', Icons: 'الأيقونات', Tokens: 'رموز التصميم',
      'Before and after': 'قبل وبعد', Light: 'فاتح', Dark: 'داكن', Language: 'اللغة', Screen: 'الشاشة',
      'This screen': 'هذه الشاشة', Desktop: 'سطح المكتب', Mobile: 'الجوال', Size: 'الحجم', Compact: 'مضغوط', Large: 'كبير',
      'Too small': 'صغير جدًا', '24 px target': 'هدف 24 بكسل', Default: 'افتراضي', Hover: 'تمرير', Focus: 'تركيز',
      Pressed: 'مضغوط عليه', Disabled: 'معطّل', Busy: 'قيد التنفيذ', Code: 'الرمز', Before: 'قبل', After: 'بعد',
      'Example dialog': 'نافذة مثال', 'Post this bill?': 'ترحيل هذه الفاتورة؟', 'Post bill': 'ترحيل الفاتورة',
      'Post this bill for {amount} to {count} recipients?': 'هل تريد ترحيل هذه الفاتورة بمبلغ {amount} إلى {count} مستلمين؟',
      'Remove this supplier?': 'إزالة هذا المورّد؟', 'Remove {name} from this list?': 'هل تريد إزالة {name} من هذه القائمة؟',
      Value: 'القيمة', Measured: 'المقاس', Contrast: 'التباين'
    },
    fr: {
      'Bill posted': 'Facture validée', 'Supplier removed': 'Fournisseur retiré', 'Supplier restored': 'Fournisseur rétabli', 'Settings saved': 'Paramètres enregistrés',
      Type: 'Typographie', 'not the product face': 'pas la police du produit',
      Font: 'Police', 'Text size': 'Taille du texte', Weight: 'Graisse', Normal: 'Normal', Bold: 'Gras', 'Across themes': 'Selon les thèmes',
      'UI standard': 'Norme d’interface', Components: 'Composants', Popups: 'Fenêtres', Icons: 'Icônes', Tokens: 'Jetons de style',
      'Before and after': 'Avant et après', Light: 'Clair', Dark: 'Sombre', Language: 'Langue', Screen: 'Écran',
      'This screen': 'Cet écran', Desktop: 'Bureau', Mobile: 'Mobile', Size: 'Taille', Compact: 'Compact', Large: 'Grand',
      'Too small': 'Trop petit', '24 px target': 'Cible de 24 px', Default: 'Par défaut', Hover: 'Survol', Focus: 'Focus',
      Pressed: 'Appuyé', Disabled: 'Désactivé', Busy: 'En cours', Code: 'Code', Before: 'Avant', After: 'Après',
      'Example dialog': 'Fenêtre d’exemple', 'Post this bill?': 'Valider cette facture ?', 'Post bill': 'Valider la facture',
      'Post this bill for {amount} to {count} recipients?': 'Valider cette facture de {amount} pour {count} destinataires ?',
      'Remove this supplier?': 'Retirer ce fournisseur ?', 'Remove {name} from this list?': 'Retirer {name} de cette liste ?',
      Value: 'Valeur', Measured: 'Mesuré', Contrast: 'Contraste'
    }
  };
  Object.keys(packs).forEach(function (lang) {
    var target = CBSTR[lang] || (CBSTR[lang] = {});
    Object.keys(packs[lang]).forEach(function (key) {
      if (!target[key]) target[key] = packs[lang][key];
    });
  });
})();
