import type { Currency } from './currency';

export type Lang = 'en' | 'ko' | 'zh' | 'ja' | 'it' | 'fr' | 'de' | 'nl' | 'ru' | 'la' | 'ar';
export const langs: readonly Lang[] = ['en', 'ko', 'zh', 'ja', 'it', 'fr', 'de', 'nl', 'ru', 'la', 'ar'];
export const langLabels: Record<Lang, string> = { en: 'English', ko: '한국어', zh: '简体中文', ja: '日本語', it: 'Italiano', fr: 'Français', de: 'Deutsch', nl: 'Nederlands', ru: 'Русский', la: 'Lingua Latina', ar: 'العربية' };
export const defaultCurrency: Record<Lang, Currency> = { en: 'USD', ko: 'KRW', zh: 'CNY', ja: 'JPY', it: 'EUR', fr: 'EUR', de: 'EUR', nl: 'EUR', ru: 'RUB', la: 'EUR', ar: 'USD' };
export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (langs as readonly string[]).includes(v);

const CIS = /^(Europe\/(Moscow|Minsk|Kaliningrad|Samara|Volgograd|Kirov|Astrakhan|Saratov|Ulyanovsk)|Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Khandyga|Vladivostok|Ust-Nera|Magadan|Sakhalin|Srednekolymsk|Kamchatka|Anadyr|Almaty|Qostanay|Aqtobe|Aqtau|Atyrau|Oral|Qyzylorda|Bishkek|Tashkent|Samarkand|Dushanbe|Baku|Yerevan))$/;
const GULF = /^Asia\/(Riyadh|Dubai|Qatar|Kuwait|Bahrain|Muscat|Aden|Baghdad|Amman)$/;
/** Detects language + currency from the device's time zone and language settings. */
export function detectLocale(timeZone: string, languages: readonly string[]): { lang: Lang; currency: Currency } {
  const pick = (lang: Lang, currency: Currency = defaultCurrency[lang]) => ({ lang, currency });
  if (timeZone === 'Asia/Seoul') return pick('ko');
  if (/^Asia\/(Shanghai|Chongqing|Harbin|Urumqi|Kashgar)$/.test(timeZone)) return pick('zh');
  if (timeZone === 'Asia/Tokyo') return pick('ja');
  if (timeZone === 'Europe/Vatican') return pick('la');
  if (timeZone === 'Europe/Rome') return pick('it');
  if (timeZone === 'Europe/Paris') return pick('fr');
  if (timeZone === 'Europe/Berlin') return pick('de');
  if (timeZone === 'Europe/Amsterdam') return pick('nl');
  if (CIS.test(timeZone)) return pick('ru', timeZone.startsWith('Europe/') || /Asia\/(Yekat|Omsk|Novo|Barn|Tomsk|Kras|Irk|Chita|Yak|Khan|Vlad|Ust|Mag|Sakh|Sred|Kam|Anad)/.test(timeZone) ? 'RUB' : 'USD');
  if (GULF.test(timeZone)) return pick('ar', timeZone === 'Asia/Dubai' ? 'AED' : timeZone === 'Asia/Riyadh' ? 'SAR' : 'USD');
  const code = (languages[0] ?? '').toLowerCase().split('-')[0] ?? '';
  return isLang(code) ? pick(code) : pick('en');
}

type Entry = Record<Lang, string>;
const d = (en: string, ko: string, zh: string, ja: string, it: string, fr: string, de: string, nl: string, ru: string, la: string, ar: string): Entry => ({ en, ko, zh, ja, it, fr, de, nl, ru, la, ar });
export const dict = {
  deliveryInsurance: d('Safe delivery insurance', '안전배송보험', '安全配送保险', '安全配送保険', 'Assicurazione spedizione sicura', 'Assurance livraison sécurisée', 'Versandversicherung', 'Veilige verzendverzekering', 'Страхование доставки', 'Assecuratio traditionis tutae', 'تأمين الشحن الآمن'),
  insuranceFee: d('Safe-trade insurance', '안심 거래 보험료', '安心交易保险费', '安心取引保険料', 'Assicurazione transazione sicura', 'Assurance transaction sécurisée', 'Sicherheitsversicherung', 'Veilige-handel verzekering', 'Страховка безопасной сделки', 'Assecuratio tutae mercaturae', 'تأمين التداول الآمن'),
  base10: d('base 10%', '기본 10%', '基础 10%', '基本 10%', 'base 10%', 'base 10 %', 'Basis 10 %', 'basis 10%', 'база 10%', 'basis 10%', 'أساسي 10%'),
  goldTeaser: d('With GOLD tier: {x} (50% off)', 'GOLD 등급 달성 시 {x} (50% 할인)', '达到 GOLD 等级：{x}（5折）', 'GOLDランク達成で {x}（50%オフ）', 'Con livello GOLD: {x} (-50%)', 'Avec le niveau GOLD : {x} (-50 %)', 'Mit GOLD-Stufe: {x} (-50 %)', 'Met GOLD-niveau: {x} (-50%)', 'С уровнем GOLD: {x} (-50%)', 'Gradu GOLD: {x} (-50%)', 'مع مستوى GOLD: {x} (خصم 50%)'),
  viewBenefits: d('View benefits', '혜택 보기', '查看权益', '特典を見る', 'Vedi vantaggi', 'Voir les avantages', 'Vorteile ansehen', 'Voordelen bekijken', 'Преимущества', 'Commoda vide', 'عرض المزايا'),
  productPrice: d('Product price', '상품 금액', '商品价格', '商品価格', 'Prezzo prodotto', 'Prix du produit', 'Produktpreis', 'Productprijs', 'Цена товара', 'Pretium mercis', 'سعر المنتج'),
  fullSetBox: d('Full Set Box', '풀셋 박스', '全套盒', 'フルセットボックス', 'Scatola full set', 'Coffret complet', 'Full-Set-Box', 'Full set doos', 'Полный комплект (коробка)', 'Capsa plena', 'علبة المجموعة الكاملة'),
  baseTotal: d('Base total', '기본 합계', '基础合计', '基本合計', 'Totale base', 'Total de base', 'Zwischensumme', 'Subtotaal', 'Промежуточный итог', 'Summa basis', 'المجموع الأساسي'),
  tierDiscount: d('{tier} tier discount', '{tier} 등급 할인', '{tier} 等级折扣', '{tier}ランク割引', 'Sconto livello {tier}', 'Remise niveau {tier}', '{tier}-Rabatt', '{tier}-korting', 'Скидка уровня {tier}', 'Deductio gradus {tier}', 'خصم مستوى {tier}'),
  finalFee: d('Final insurance fee', '최종 보험료', '最终保险费', '最終保険料', 'Assicurazione finale', 'Assurance finale', 'Endgültige Versicherung', 'Definitieve verzekering', 'Итоговая страховка', 'Assecuratio finalis', 'رسوم التأمين النهائية'),
  total: d('Total', '합계', '合计', '合計', 'Totale', 'Total', 'Gesamt', 'Totaal', 'Итого', 'Summa', 'الإجمالي'),
  tierTitle: d('VIP Tier & Benefits', 'VIP 등급 및 혜택', 'VIP 等级与权益', 'VIPランクと特典', 'Livelli VIP e vantaggi', 'Niveaux VIP et avantages', 'VIP-Stufen & Vorteile', 'VIP-niveaus & voordelen', 'VIP-уровни и преимущества', 'Gradus VIP et commoda', 'مستويات VIP والمزايا'),
  nextTier: d('Next tier {tier}', '다음 등급 {tier}', '下一等级 {tier}', '次のランク {tier}', 'Prossimo livello {tier}', 'Niveau suivant {tier}', 'Nächste Stufe {tier}', 'Volgend niveau {tier}', 'Следующий уровень {tier}', 'Gradus proximus {tier}', 'المستوى التالي {tier}'),
  remaining: d('{x} to go', '{x} 남음', '还差 {x}', 'あと {x}', 'mancano {x}', 'encore {x}', 'noch {x}', 'nog {x}', 'осталось {x}', 'restant {x}', 'متبقٍ {x}'),
  colTier: d('Tier', '등급', '等级', 'ランク', 'Livello', 'Niveau', 'Stufe', 'Niveau', 'Уровень', 'Gradus', 'المستوى'),
  currentTier: d('Current', '현재 등급', '当前等级', '現在のランク', 'Livello attuale', 'Niveau actuel', 'Aktuelle Stufe', 'Huidig niveau', 'Текущий уровень', 'Gradus currens', 'المستوى الحالي'),
  colReq: d('Requirement', '조건', '条件', '条件', 'Requisito', 'Condition', 'Bedingung', 'Voorwaarde', 'Условие', 'Condicio', 'الشرط'),
  colFee: d('Insurance', '보험료', '保险费', '保険料', 'Assicurazione', 'Assurance', 'Versicherung', 'Verzekering', 'Страховка', 'Assecuratio', 'التأمين'),
  colPerk: d('Benefit', '혜택', '权益', '特典', 'Vantaggio', 'Avantage', 'Vorteil', 'Voordeel', 'Преимущество', 'Commodum', 'الميزة'),
  over: d('Over {x}', '{x} 초과', '超过 {x}', '{x} 超', 'Oltre {x}', 'Plus de {x}', 'Über {x}', 'Meer dan {x}', 'Свыше {x}', 'Ultra {x}', 'أكثر من {x}'),
  basic: d('Default', '기본', '默认', '基本', 'Base', 'Par défaut', 'Standard', 'Standaard', 'Базовый', 'Initium', 'افتراضي'),
  perkBronze: d('Base tier', '기본 등급', '基础等级', '基本ランク', 'Livello base', 'Niveau de base', 'Basisstufe', 'Basisniveau', 'Базовый уровень', 'Gradus basis', 'المستوى الأساسي'),
  perkSilver: d('30% off insurance', '보험료 30% 할인', '保险费7折', '保険料30%オフ', 'Assicurazione -30%', 'Assurance -30 %', 'Versicherung -30 %', 'Verzekering -30%', 'Страховка -30%', 'Assecuratio -30%', 'خصم 30% على التأمين'),
  perkGold: d('2x free intl. shipping / mo', '월 2회 무료 국제배송', '每月2次免费国际运输', '月2回 国際送料無料', '2 spedizioni internazionali gratis / mese', '2 livraisons internationales offertes / mois', '2× gratis Auslandsversand / Monat', '2× gratis internationale verzending / mnd', '2 бесплатные межд. доставки / мес', 'Bis in mense vectura internationalis gratuita', 'شحن دولي مجاني مرتين شهريًا'),
  perkPlatinum: d('Unlimited free intl. shipping', '무제한 무료 국제배송', '无限免费国际运输', '国際送料無制限無料', 'Spedizione internazionale gratuita illimitata', 'Livraison internationale illimitée offerte', 'Unbegrenzt gratis Auslandsversand', 'Onbeperkt gratis internationale verzending', 'Безлимитная бесплатная межд. доставка', 'Vectura internationalis sine fine gratuita', 'شحن دولي مجاني غير محدود'),
  perkBlack: d('Priority sourcing & Fast-Track QC', '우선 소싱 & Fast-Track QC', '优先采购与快速质检', '優先調達＆ファストトラックQC', 'Sourcing prioritario e QC rapido', 'Sourcing prioritaire et QC accéléré', 'Bevorzugte Beschaffung & Express-QC', 'Voorrang bij sourcing & snelle QC', 'Приоритетный поиск и ускоренный QC', 'Conquisitio prior et QC celer', 'أولوية التوريد وفحص جودة سريع'),
  tierNote: d('Base 10% insurance covers 100% authenticity guarantee, loss/damage insurance and 4K QC. Tiers use verified purchase totals; payments are not connected yet, so every account is BRONZE.', '기본 보험료 10%: 100% 정품 보증, 분실·파손 보험, 4K QC 포함. 등급은 확인된 구매 금액 기준이며 현재 결제 연동 전으로 모든 계정은 BRONZE입니다.', '基础10%保险含100%正品保证、丢失/损坏保险及4K质检。等级按已确认消费计算；支付尚未接入，所有账户均为 BRONZE。', '基本保険料10%には100%正規品保証・紛失/破損保険・4K QCを含みます。ランクは確認済み購入額に基づき、決済未連携のため全アカウントがBRONZEです。', "L'assicurazione base del 10% copre garanzia di autenticità al 100%, perdita/danni e QC 4K. I livelli usano acquisti verificati; i pagamenti non sono ancora collegati, quindi ogni account è BRONZE.", "L'assurance de base de 10 % couvre la garantie d'authenticité à 100 %, la perte/les dommages et le QC 4K. Les niveaux reposent sur les achats vérifiés ; les paiements ne sont pas encore connectés, chaque compte est donc BRONZE.", 'Die Basisversicherung von 10 % umfasst 100 % Echtheitsgarantie, Verlust-/Schadensversicherung und 4K-QC. Stufen basieren auf bestätigten Käufen; Zahlungen sind noch nicht verbunden, daher ist jedes Konto BRONZE.', 'De basisverzekering van 10% dekt 100% echtheidsgarantie, verlies/schade en 4K-QC. Niveaus zijn gebaseerd op geverifieerde aankopen; betalingen zijn nog niet gekoppeld, dus elk account is BRONZE.', 'Базовая страховка 10% включает 100% гарантию подлинности, страхование от утери/повреждений и 4K QC. Уровни считаются по подтверждённым покупкам; платежи ещё не подключены, поэтому все аккаунты — BRONZE.', 'Assecuratio basis 10% praestat fidem authenticitatis plenam, damni amissionisque cautionem et QC 4K. Gradus ex emptionibus probatis computantur; solutiones nondum coniunctae sunt, ergo omnis ratio BRONZE est.', 'يشمل التأمين الأساسي 10% ضمان الأصالة 100% وتأمين الفقدان/التلف وفحص جودة 4K. تعتمد المستويات على المشتريات المؤكدة؛ المدفوعات غير مربوطة بعد، لذا كل الحسابات BRONZE.'),
  bannerStrong: d('Up to 90% off insurance!', '최대 90% 안심 보험료 할인!', '安心保险费最高减免90%！', '安心保険料が最大90%オフ！', "Fino al 90% di sconto sull'assicurazione!", "Jusqu'à 90 % de remise sur l'assurance !", 'Bis zu 90 % Rabatt auf die Versicherung!', 'Tot 90% korting op verzekering!', 'Скидка на страховку до 90%!', 'Usque ad 90% deductio assecurationis!', 'خصم يصل إلى 90% على التأمين!'),
  bannerText: d('See VELA tier benefits', 'VELA 등급별 혜택 보기', '查看 VELA 等级权益', 'VELAランク特典を見る', 'Scopri i vantaggi VELA', 'Voir les avantages VELA', 'VELA-Vorteile ansehen', 'Bekijk VELA-voordelen', 'Преимущества уровней VELA', 'Commoda graduum VELA vide', 'اطلع على مزايا مستويات VELA'),
  shippingInfo: d('Shipping info', '배송 정보', '收货信息', '配送情報', 'Dati di spedizione', 'Informations de livraison', 'Versandangaben', 'Verzendgegevens', 'Данные доставки', 'Notitia vecturae', 'معلومات الشحن'),
  autofilled: d('Filled in from your saved profile. Edit if needed.', '프로필에 저장된 배송 정보로 자동 입력되었습니다. 필요하면 수정하세요.', '已根据资料自动填写，可按需修改。', '保存済みプロフィールから自動入力しました。必要に応じて編集してください。', 'Compilato dal tuo profilo. Modifica se necessario.', 'Rempli depuis votre profil. Modifiez si besoin.', 'Aus Ihrem Profil übernommen. Bei Bedarf bearbeiten.', 'Ingevuld vanuit je profiel. Pas aan indien nodig.', 'Заполнено из профиля. При необходимости измените.', 'Ex tua descriptione impletum. Muta si opus est.', 'تمت التعبئة من ملفك الشخصي. عدّل عند الحاجة.'),
  manualEntry: d('No complete saved shipping info. Please enter it below.', '저장된 배송 정보가 없거나 불완전합니다. 직접 입력해 주세요.', '暂无完整收货信息，请在下方填写。', '保存された配送情報がないか不完全です。入力してください。', 'Nessun dato di spedizione completo. Inseriscilo qui sotto.', 'Aucune information complète enregistrée. Saisissez-la ci-dessous.', 'Keine vollständigen Versanddaten gespeichert. Bitte unten eingeben.', 'Geen volledige verzendgegevens opgeslagen. Vul ze hieronder in.', 'Нет полных данных доставки. Введите их ниже.', 'Notitia vecturae deest. Infra scribe.', 'لا توجد معلومات شحن كاملة. يرجى إدخالها أدناه.'),
  recipient: d('Recipient full name', '수령인 이름', '收件人姓名', '受取人氏名', 'Nome del destinatario', 'Nom du destinataire', 'Name des Empfängers', 'Naam ontvanger', 'ФИО получателя', 'Nomen accipientis', 'الاسم الكامل للمستلم'),
  phone: d('Phone number', '연락처', '电话号码', '電話番号', 'Telefono', 'Téléphone', 'Telefonnummer', 'Telefoonnummer', 'Телефон', 'Numerus telephonicus', 'رقم الهاتف'),
  address: d('Shipping address', '배송 주소', '收货地址', '配送先住所', 'Indirizzo di spedizione', 'Adresse de livraison', 'Lieferadresse', 'Verzendadres', 'Адрес доставки', 'Inscriptio vecturae', 'عنوان الشحن'),
  postal: d('Postal / ZIP code', '우편번호', '邮政编码', '郵便番号', 'CAP', 'Code postal', 'Postleitzahl', 'Postcode', 'Почтовый индекс', 'Codex postalis', 'الرمز البريدي'),
  destination: d('Destination country / region', '배송 국가 / 지역', '目的国家/地区', '配送先の国・地域', 'Paese / regione di destinazione', 'Pays / région de destination', 'Zielland / Region', 'Land / regio van bestemming', 'Страна / регион доставки', 'Terra / regio destinationis', 'بلد / منطقة الوجهة'),
  addBox: d('Add Full Set Box', '풀셋 박스 추가', '添加全套盒', 'フルセットボックスを追加', 'Aggiungi scatola full set', 'Ajouter le coffret complet', 'Full-Set-Box hinzufügen', 'Full set doos toevoegen', 'Добавить полный комплект', 'Capsam plenam adde', 'إضافة علبة المجموعة الكاملة'),
  shippingNote: d('Shipping and taxes require a studio quote. This form creates a sample order only.', '배송비와 세금은 셀러 견적이 필요합니다. 이 양식은 샘플 주문만 생성합니다.', '运费与税费需卖家报价。此表单仅创建示例订单。', '送料と税金は販売者の見積もりが必要です。このフォームはサンプル注文のみ作成します。', "Spedizione e tasse richiedono un preventivo. Questo modulo crea solo un ordine d'esempio.", "Livraison et taxes sur devis. Ce formulaire crée uniquement une commande d'exemple.", 'Versand und Steuern nach Angebot. Dieses Formular erstellt nur eine Beispielbestellung.', 'Verzending en belasting op offerte. Dit formulier maakt alleen een voorbeeldbestelling.', 'Доставка и налоги рассчитываются продавцом. Эта форма создаёт только пробный заказ.', 'Vectura et vectigalia aestimationem venditoris requirunt. Haec forma ordinem exemplarem tantum creat.', 'يتطلب الشحن والضرائب عرض سعر من البائع. ينشئ هذا النموذج طلبًا تجريبيًا فقط.'),
  createOrder: d('Create sample order', '샘플 주문 생성', '创建示例订单', 'サンプル注文を作成', "Crea ordine d'esempio", "Créer une commande d'exemple", 'Beispielbestellung erstellen', 'Voorbeeldbestelling maken', 'Создать пробный заказ', 'Ordinem exemplarem crea', 'إنشاء طلب تجريبي'),
  addCart: d('Add to Cart', '장바구니 담기', '加入购物车', 'カートに追加', 'Aggiungi al carrello', 'Ajouter au panier', 'In den Warenkorb', 'In winkelwagen', 'В корзину', 'In corbem adde', 'أضف إلى السلة'),
  buyNow: d('Buy Now', '바로 구매', '立即购买', '今すぐ購入', 'Compra ora', 'Acheter', 'Jetzt kaufen', 'Nu kopen', 'Купить', 'Nunc eme', 'اشترِ الآن'),
  language: d('Language', '언어', '语言', '言語', 'Lingua', 'Langue', 'Sprache', 'Taal', 'Язык', 'Lingua', 'اللغة'),
} satisfies Record<string, Entry>;
export type DictKey = keyof typeof dict;

let active: Lang = 'en';
export const activeLang = () => active;
export function setActiveLang(l: Lang) { active = l; }
export function t(key: DictKey, vars: Record<string, string> = {}, lang: Lang = active) {
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), dict[key][lang] || dict[key].en);
}

const locales: Record<Lang, string> = { en: 'en-US', ko: 'ko-KR', zh: 'zh-CN', ja: 'ja-JP', it: 'it-IT', fr: 'fr-FR', de: 'de-DE', nl: 'nl-NL', ru: 'ru-RU', la: 'la', ar: 'ar' };
const loc = (l: Lang) => (l === 'la' ? 'it-IT' : locales[l]);
/** Localized calendar date, e.g. 2026. 10. 7. / 07.10.2026 / Oct 7, 2026. */
export function formatDate(value: string | number | Date, lang: Lang = active) {
  return new Intl.DateTimeFormat(loc(lang), { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}
/** Localized relative time ("3 hours ago", "3시간 전"); older than 30 days falls back to formatDate. */
export function timeAgo(value: string | number | Date, lang: Lang = active, now = Date.now()) {
  const sec = Math.round((new Date(value).getTime() - now) / 1000);
  const abs = Math.abs(sec);
  if (abs > 2_592_000) return formatDate(value, lang);
  const rtf = new Intl.RelativeTimeFormat(loc(lang), { numeric: 'auto' });
  if (abs < 60) return rtf.format(sec, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  return rtf.format(Math.round(sec / 86400), 'day');
}
