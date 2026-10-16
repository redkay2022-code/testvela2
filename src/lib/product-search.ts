import type { LuxuryPost } from './luxury-market';

/**
 * Product search that looks at EVERYTHING a buyer can see on a listing (title, description, seller, factory, brand, model,
 * every spec, category, price …) and understands the same word in other languages: "watch", "시계", "手表", "時計",
 * "Uhr", "montre", "часы", "ساعة" … all find watches; "劳力士", "ロレックス", "롤렉스" all find Rolex.
 * The listing text itself is never translated: instead each search word is widened to its equivalents in the 11 site languages.
 */

/** Each line is one meaning, written in every site language (ko en zh ja de fr it ru ar nl la), separated by "|". */
const CONCEPTS = [
  // product types
  'watch|watches|timepiece|wristwatch|시계|손목시계|手表|腕表|腕錶|手錶|時計|腕時計|ウォッチ|uhr|armbanduhr|uhren|montre|montres|orologio|orologi|часы|часов|наручные часы|ساعة|ساعات|horloge|polshorloge|horologium',
  'bag|bags|handbag|tote|backpack|purse|가방|핸드백|토트|백팩|包|包包|手提包|背包|バッグ|鞄|かばん|tasche|handtasche|rucksack|sac|sac à main|borsa|borse|сумка|сумки|рюкзак|حقيبة|حقائب|tas|handtas|saccus',
  'clothes|clothing|apparel|jacket|shirt|hoodie|의류|옷|자켓|셔츠|후드|衣服|服装|服饰|夹克|外套|ジャケット|衣類|服|kleidung|jacke|vêtements|veste|abbigliamento|giacca|одежда|куртка|ملابس|kleding|jas|vestis',
  'accessory|accessories|jewelry|jewellery|악세사리|액세서리|주얼리|쥬얼리|配饰|饰品|首饰|珠宝|アクセサリー|ジュエリー|schmuck|zubehör|accessoire|accessoires|bijoux|accessori|gioielli|аксессуары|украшения|إكسسوارات|مجوهرات|sieraden',
  'necklace|pendant|목걸이|펜던트|项链|吊坠|ネックレス|kette|halskette|collier|collana|ожерелье|колье|قلادة|ketting',
  'ring|반지|戒指|指环|リング|指輪|ring|bague|anello|кольцо|خاتم',
  'bracelet|bangle|팔찌|手链|手镯|ブレスレット|armband|bracelet|braccialetto|браслет|سوار|armband',
  'earring|earrings|귀걸이|耳环|ピアス|イヤリング|ohrring|boucle d\'oreille|orecchino|серьги|قرط|oorbel',
  'news|뉴스|新闻|新聞|ニュース|nachrichten|actualités|notizie|новости|أخبار|nieuws|nuntii',
  'story|making|제작 과정|스토리|故事|制作过程|ストーリー|geschichte|histoire|storia|история|قصة|verhaal|fabula',
  'custom|customizing|customization|customisation|커스텀|커스터마이징|定制|订制|カスタム|individuell|personnalisé|personalizzato|на заказ|مخصص|maatwerk',
  'ready to ship|ready|바로발송|바로 발송|즉시 발송|现货|即发|即納|sofort lieferbar|prêt à expédier|pronta consegna|в наличии|جاهز للشحن|direct leverbaar',
  // materials & features
  'gold|solid gold|18k|골드|금|18k 금|黄金|金|18k金|纯金|ゴールド|金色|gold|or|oro|золото|ذهب|aurum',
  'steel|stainless|stainless steel|스틸|스테인리스|钢|不锈钢|精钢|スチール|ステンレス|stahl|edelstahl|acier|acciaio|сталь|فولاذ|staal',
  'diamond|diamonds|다이아|다이아몬드|钻石|鑽石|钻|ダイヤ|ダイヤモンド|diamant|diamante|бриллиант|алмаз|ألماس|الماس|adamas',
  'ceramic|세라믹|陶瓷|セラミック|keramik|céramique|ceramica|керамика|سيراميك|keramiek',
  'titanium|티타늄|钛|钛金属|チタン|titan|titane|titanio|титан|تيتانيوم',
  'leather|가죽|皮革|真皮|皮|レザー|革|leder|cuir|pelle|кожа|جلد|leer',
  'rubber|러버|고무|橡胶|橡膠|ラバー|ゴム|kautschuk|gummi|caoutchouc|gomma|резина|مطاط',
  'sapphire|사파이어|蓝宝石|藍寶石|サファイア|saphir|zaffiro|сапфир|ياقوت أزرق|saffier',
  'automatic|오토매틱|자동|自动|自動|自動巻き|automatik|automatique|automatico|автоматический|أوتوماتيكي|automatisch',
  'chronograph|크로노그래프|크로노|计时|计时码表|クロノグラフ|chronographe|cronografo|хронограф|كرونوغراف|chronograaf',
  'moon phase|moonphase|문페이즈|月相|ムーンフェイズ|mondphase|phase de lune|fasi lunari|лунная фаза|طور القمر|maanfase',
  'tourbillon|투르비옹|陀飞轮|陀飛輪|トゥールビヨン|турбийон|توربيون',
  'skeleton|스켈레톤|镂空|鏤空|スケルトン|squelette|scheletro|скелетон|هيكلي|skelet',
  'waterproof|water resistant|water resistance|방수|防水|防水性|waterdicht|wasserdicht|étanche|impermeabile|водонепроницаемый|مقاوم للماء',
  'box|full set|박스|풀셋|풀 셋|盒子|全套|ボックス|フルセット|schachtel|boîte|scatola|коробка|علبة|doos',
  // colours
  'black|블랙|검정|검은|黑|黑色|黒|ブラック|schwarz|noir|nero|черный|чёрный|أسود|zwart',
  'white|화이트|흰|하양|白|白色|ホワイト|weiß|weiss|blanc|bianco|белый|أبيض|wit',
  'blue|블루|파랑|파란|蓝|蓝色|青|ブルー|青色|blau|bleu|blu|синий|голубой|أزرق|blauw',
  'green|그린|초록|녹색|绿|绿色|緑|グリーン|grün|gruen|vert|verde|зеленый|зелёный|أخضر|groen',
  'red|레드|빨강|빨간|红|红色|赤|レッド|rot|rouge|rosso|красный|أحمر|rood',
  'pink|핑크|분홍|粉|粉色|粉红|ピンク|rosa|rose|розовый|وردي|roze',
  'brown|브라운|갈색|棕|棕色|茶|ブラウン|茶色|braun|marron|marrone|коричневый|بني|bruin',
  'grey|gray|그레이|회색|灰|灰色|グレー|grau|gris|grigio|серый|رمادي|grijs',
  'silver|실버|은|은색|银|银色|シルバー|silber|argent|argento|серебро|серебряный|فضي|zilver',
  'yellow|옐로우|노랑|노란|黄|黄色|イエロー|gelb|jaune|giallo|желтый|жёлтый|أصفر|geel',
  'turquoise|터콰이즈|청록|绿松石|青绿|ターコイズ|türkis|turquoise|turchese|бирюзовый|فيروزي|turkoois',
  'olive|올리브|橄榄|橄榄绿|オリーブ|oliv|olive|oliva|оливковый|زيتوني',
  'purple|violet|퍼플|보라|紫|紫色|パープル|lila|violett|violet|viola|фиолетовый|بنفسجي|paars',
  'orange|오렌지|주황|橙|橙色|オレンジ|orange|arancione|оранжевый|برتقالي|oranje',
  // brands
  'rolex|롤렉스|劳力士|勞力士|ロレックス|ролекс|رولكس',
  'cartier|까르띠에|카르티에|卡地亚|卡地亞|カルティエ|картье|كارتييه',
  'audemars piguet|audemars|오데마 피게|오데마피게|爱彼|愛彼|オーデマ ピゲ|オーデマピゲ|одемар пиге|أوديمار بيغيه|ap',
  'patek philippe|patek|파텍 필립|파텍필립|百达翡丽|百達翡麗|パテック フィリップ|パテックフィリップ|патек филип|باتيك فيليب',
  'richard mille|리차드 밀|리차드밀|理查德米勒|リシャール・ミル|リシャールミル|ришар милль|ريتشارد ميل',
  'omega|오메가|欧米茄|歐米茄|オメガ|омега|أوميغا',
  'panerai|파네라이|沛纳海|沛納海|パネライ|панераи|بانيراي',
  'iwc|아이더블유씨|万国|萬國|万国表|ＩＷＣ|ай даблью си',
  'chrome hearts|크롬하츠|克罗心|克羅心|クロムハーツ|хром хартс',
  'van cleef|van cleef & arpels|반클리프 앤 아펠|반클리프|梵克雅宝|梵克雅寶|ヴァンクリーフ|ван клиф|فان كليف',
  'boucheron|부쉐론|宝诗龙|寶詩龍|ブシュロン|бушерон',
  'bvlgari|bulgari|불가리|宝格丽|寶格麗|ブルガリ|булгари|بولغري',
  'tiffany|티파니|蒂芙尼|ティファニー|тиффани|تيفاني',
  'hermes|hermès|에르메스|爱马仕|愛馬仕|エルメス|гермес|هيرميس',
  'chanel|샤넬|香奈儿|香奈兒|シャネル|шанель|شانيل',
  'louis vuitton|lv|루이비통|루이 비통|路易威登|ルイ・ヴィトン|ルイヴィトン|луи виттон|لويس فيتون',
  'gucci|구찌|古驰|古馳|グッチ|гуччи|غوتشي',
  'prada|프라다|普拉达|普拉達|プラダ|прада|برادا',
  'dior|디올|迪奥|迪奧|ディオール|диор|ديور',
  'hublot|위블로|宇舶|ウブロ|юбло|هوبلو',
  'tag heuer|태그호이어|泰格豪雅|タグ・ホイヤー|тег хойер',
  'breitling|브라이틀링|百年灵|百年靈|ブライトリング|брайтлинг',
  'vacheron constantin|바쉐론 콘스탄틴|바쉐론|江诗丹顿|江詩丹頓|ヴァシュロン・コンスタンタン|вашерон констанин',
  'jaeger lecoultre|jaeger-lecoultre|예거 르쿨트르|积家|積家|ジャガー・ルクルト|жегер лекультр',
  // popular models
  'submariner|서브마리너|潜航者|潛航者|水鬼|サブマリーナ|сабмаринер',
  'daytona|데이토나|迪通拿|デイトナ|дейтона',
  'datejust|데이저스트|日志型|蠔式日志|デイトジャスト|датджаст',
  'day-date|daydate|데이데이트|星期日历型|デイデイト',
  'gmt master|gmt-master|gmt|지엠티|格林尼治|ジーエムティー',
  'yacht master|yacht-master|요트마스터|游艇名仕|ヨットマスター',
  'oyster perpetual|오이스터 퍼페츄얼|蚝式恒动|蠔式恆動|オイスターパーペチュアル',
  'nautilus|노틸러스|鹦鹉螺|鸚鵡螺|ノーチラス|наутилус|نوتيلوس',
  'aquanaut|아쿠아넛|手雷|アクアノート|аквануат',
  'royal oak|로얄오크|로열 오크|皇家橡树|皇家橡樹|ロイヤルオーク|роял оук|رويال أوك',
  'santos|산토스|山度士|サントス',
  'tank|탱크|坦克|タンク',
  'ballon bleu|발롱 블루|蓝气球|藍氣球|バロンブルー',
  'speedmaster|스피드마스터|超霸|スピードマスター',
  'seamaster|씨마스터|海马|海馬|シーマスター',
] as const;

/** Lower-case, strip accents / full-width forms / punctuation so "Zürich", "ＩＷＣ" and "5712/1A-001" compare equally. */
export function normalizeSearchText(s: string): string {
  return s
    .normalize('NFKD').replace(/[̀-ًͯ-ٟ]/g, '').normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const groups: string[][] = CONCEPTS.map(line => [...new Set(line.split('|').map(normalizeSearchText).filter(Boolean))]);
const termIndex = new Map<string, number[]>();
groups.forEach((terms, id) => terms.forEach(t => { const list = termIndex.get(t); if (list) list.push(id); else termIndex.set(t, [id]); }));
const termsByLength = [...termIndex.keys()].filter(t => t.length >= 2).sort((a, b) => b.length - a.length);

/** Splits an unspaced CJK word ("劳力士手表", "롤렉스시계") into known words when it contains them. */
function segment(word: string): string[] {
  if (!CJK.test(word) || word.length < 4) return [word];
  const out: string[] = [];
  let rest = '';
  for (let i = 0; i < word.length;) {
    const hit = termsByLength.find(t => word.startsWith(t, i));
    if (hit) { if (rest) { out.push(rest); rest = ''; } out.push(hit); i += hit.length; }
    else { rest += word[i]; i++; }
  }
  if (rest) out.push(rest);
  return out.length > 1 ? out : [word];
}

/** All spellings of one search word: the word itself plus every equivalent in the other languages. */
function alternatives(word: string): string[] {
  const out = new Set<string>([word]);
  const ids = new Set<number>(termIndex.get(word) ?? []);
  const minPrefix = CJK.test(word) ? 2 : 3;
  if (word.length >= minPrefix) for (const [term, list] of termIndex) if (term !== word && term.startsWith(word)) list.forEach(id => ids.add(id));
  ids.forEach(id => groups[id]?.forEach(t => { if (t === word) return; out.add(guard(t)); }));
  return [...out];
}
/** Short or Latin/Cyrillic equivalents must match a whole word / word start, so "or" (gold) or "ring" do not hit "factory" or "during". */
const WORDY = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{N} ]+$/u;
function guard(term: string): string {
  if (!WORDY.test(term)) return term;
  return term.length <= 3 ? '\u0001' + term : '\u0002' + term;
}
const hasOption = (text: string, option: string): boolean =>
  option.charCodeAt(0) === 1 ? (' ' + text + ' ').includes(' ' + option.slice(1) + ' ')
    : option.charCodeAt(0) === 2 ? (' ' + text).includes(' ' + option.slice(1))
      : text.includes(option);

export type CompiledQuery = string[][];
let lastQuery = '';
let lastCompiled: CompiledQuery = [];
/** Query → for every word, the list of spellings of which at least one must appear in the listing. */
export function compileProductQuery(query: string): CompiledQuery {
  if (query === lastQuery) return lastCompiled;
  const raw = normalizeSearchText(query).split(' ').filter(Boolean);
  /* Multi-word names ("파텍 필립", "royal oak") are kept together so each language's spelling is found as one unit. */
  const phrases: string[] = [];
  for (let i = 0; i < raw.length;) {
    let took = 1;
    for (let n = Math.min(4, raw.length - i); n >= 2; n--) if (termIndex.has(raw.slice(i, i + n).join(' '))) { took = n; break; }
    phrases.push(raw.slice(i, i + took).join(' ')); i += took;
  }
  const words = phrases.flatMap(segment);
  lastQuery = query;
  lastCompiled = words.map(alternatives);
  return lastCompiled;
}

const SKIP_KEYS = new Set(['cardImage', 'sourceType', 'menuCategory']);
function collect(value: unknown, out: string[], depth = 0): void {
  if (value == null || depth > 3) return;
  if (typeof value === 'string') { if (!/^(https?:|seed:|blob:|data:)/.test(value)) out.push(value); }
  else if (typeof value === 'number') out.push(String(value));
  else if (Array.isArray(value)) value.forEach(v => collect(v, out, depth + 1));
  else if (typeof value === 'object') for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (!SKIP_KEYS.has(k)) collect(v, out, depth + 1);
}

const haystacks = new WeakMap<LuxuryPost, string>();
/** Everything searchable about a listing, as one normalized string (cached per listing). */
export function productSearchText(post: LuxuryPost): string {
  const hit = haystacks.get(post);
  if (hit !== undefined) return hit;
  const parts: string[] = [post.title, post.description, post.creator, post.factory, post.category, post.menuCategory ?? ''];
  const src = post.source as unknown as Record<string, unknown> | undefined;
  if (src) {
    for (const key of ['title', 'description', 'category', 'creator', 'brand', 'model', 'reference', 'dispatch_time', 'source_lang']) collect(src[key], parts);
    collect(src['specs'], parts);
    collect(src['video_tags'], parts);
  }
  if (post.price != null) parts.push(String(post.price), `$${post.price}`);
  if (post.boxPrice != null) parts.push(String(post.boxPrice));
  if (post.outOfStock) parts.push('sold out', '판매 완료', '품절');
  if (post.short) parts.push('shorts', 'video', '숏츠', '영상');
  const text = normalizeSearchText(parts.join(' '));
  haystacks.set(post, text);
  return text;
}

/** True when every word of the query (in any site language) is found somewhere on the listing. */
export function matchesProductQuery(post: LuxuryPost, query: string | undefined | null): boolean {
  if (!query || !query.trim()) return true;
  const compiled = compileProductQuery(query);
  if (!compiled.length) return true;
  const text = productSearchText(post);
  return compiled.every(options => options.some(option => hasOption(text, option)));
}

/** Same word matching for plain text (used by the older explore page). */
export function matchesTextQuery(text: string, query: string | undefined | null): boolean {
  if (!query || !query.trim()) return true;
  const compiled = compileProductQuery(query);
  if (!compiled.length) return true;
  const normalized = normalizeSearchText(text);
  return compiled.every(options => options.some(option => hasOption(normalized, option)));
}
