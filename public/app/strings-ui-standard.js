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
      Section: 'பிரிவு', View: 'பார்வை', Home: 'முகப்பு', Standards: 'தரநிலைகள்', 'Below the floor': 'குறைந்தபட்சத்திற்கும் கீழ்', 'as it is': 'உள்ளபடி', '24 px targets': '24 px இலக்குகள்',
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
      'Supplier deleted': 'சப்ளையர் அழிக்கப்பட்டார்', 'Delete this supplier?': 'இந்த சப்ளையரை அழிக்கவா?', 'Delete {name} for good? This cannot be undone.': '{name} ஐ நிரந்தரமாக அழிக்கவா? இதைத் திரும்பப் பெற முடியாது.',
      'Remove this supplier?': 'இந்த சப்ளையரை நீக்கவா?', 'Remove {name} from this list?': 'இந்தப் பட்டியலிலிருந்து {name} ஐ நீக்கவா?',
      Value: 'மதிப்பு', Measured: 'அளந்தது', Contrast: 'வேறுபாடு',
      'Quick: nothing shows': 'வேகம்: எதுவும் தெரியாது',
      'Slow: the button goes busy': 'மெதுவாக: பொத்தான் வேலை நிலைக்குச் செல்லும்',
      'Long: a panel with steps': 'நீண்டது: படிகளுடன் ஒரு பலகம்',
      'Importing your file': 'உங்கள் கோப்பை இறக்குகிறோம்',
      'Reading the file': 'கோப்பைப் படிக்கிறோம்',
      'Checking each row': 'ஒவ்வொரு வரியையும் சரிபார்க்கிறோம்',
      'Saving the rows': 'வரிகளைச் சேமிக்கிறோம்',
      'Almost done': 'கிட்டத்தட்ட முடிந்தது'
    },
    hi: {
      Section: 'अनुभाग', View: 'दृश्य', Home: 'होम', Standards: 'मानक', 'Below the floor': 'न्यूनतम से नीचे', 'as it is': 'जैसा है', '24 px targets': '24 px लक्ष्य',
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
      'Supplier deleted': 'सप्लायर मिटाया गया', 'Delete this supplier?': 'इस सप्लायर को मिटाएँ?', 'Delete {name} for good? This cannot be undone.': '{name} को हमेशा के लिए मिटाएँ? इसे वापस नहीं किया जा सकता।',
      'Remove this supplier?': 'इस सप्लायर को हटाएँ?', 'Remove {name} from this list?': '{name} को इस सूची से हटाएँ?',
      Value: 'मान', Measured: 'मापा', Contrast: 'कंट्रास्ट',
      'Quick: nothing shows': 'तेज़: कुछ नहीं दिखता',
      'Slow: the button goes busy': 'धीमा: बटन व्यस्त हो जाता है',
      'Long: a panel with steps': 'लंबा: चरणों वाला पैनल',
      'Importing your file': 'आपकी फ़ाइल जोड़ी जा रही है',
      'Reading the file': 'फ़ाइल पढ़ी जा रही है',
      'Checking each row': 'हर पंक्ति जाँची जा रही है',
      'Saving the rows': 'पंक्तियाँ सहेजी जा रही हैं',
      'Almost done': 'लगभग पूरा'
    },
    ar: {
      Section: 'القسم', View: 'العرض', Home: 'الرئيسية', Standards: 'المعايير', 'Below the floor': 'أقل من الحد الأدنى', 'as it is': 'كما هي', '24 px targets': 'أهداف 24 بكسل',
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
      'Supplier deleted': 'تم حذف المورّد', 'Delete this supplier?': 'حذف هذا المورّد؟', 'Delete {name} for good? This cannot be undone.': 'حذف {name} نهائيًا؟ لا يمكن التراجع عن ذلك.',
      'Remove this supplier?': 'إزالة هذا المورّد؟', 'Remove {name} from this list?': 'هل تريد إزالة {name} من هذه القائمة؟',
      Value: 'القيمة', Measured: 'المقاس', Contrast: 'التباين',
      'Quick: nothing shows': 'سريع: لا يظهر شيء',
      'Slow: the button goes busy': 'بطيء: يصبح الزر مشغولًا',
      'Long: a panel with steps': 'طويل: لوحة بخطوات',
      'Importing your file': 'جارٍ استيراد ملفك',
      'Reading the file': 'جارٍ قراءة الملف',
      'Checking each row': 'جارٍ فحص كل صف',
      'Saving the rows': 'جارٍ حفظ الصفوف',
      'Almost done': 'اكتمل تقريبًا'
    },
    fr: {
      Section: 'Section', View: 'Vue', Home: 'Accueil', Standards: 'Normes', 'Below the floor': 'Sous le minimum', 'as it is': 'tel quel', '24 px targets': 'Cibles de 24 px',
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
      'Supplier deleted': 'Fournisseur supprimé', 'Delete this supplier?': 'Supprimer ce fournisseur ?', 'Delete {name} for good? This cannot be undone.': 'Supprimer {name} définitivement ? Cette action est irréversible.',
      'Remove this supplier?': 'Retirer ce fournisseur ?', 'Remove {name} from this list?': 'Retirer {name} de cette liste ?',
      Value: 'Valeur', Measured: 'Mesuré', Contrast: 'Contraste',
      'Quick: nothing shows': 'Rapide : rien ne s’affiche',
      'Slow: the button goes busy': 'Lent : le bouton devient occupé',
      'Long: a panel with steps': 'Long : un panneau avec des étapes',
      'Importing your file': 'Importation de votre fichier',
      'Reading the file': 'Lecture du fichier',
      'Checking each row': 'Vérification de chaque ligne',
      'Saving the rows': 'Enregistrement des lignes',
      'Almost done': 'Presque terminé'
    }
  };
  Object.keys(packs).forEach(function (lang) {
    var target = CBSTR[lang] || (CBSTR[lang] = {});
    Object.keys(packs[lang]).forEach(function (key) {
      if (!target[key]) target[key] = packs[lang][key];
    });
  });
})();
