// コーヒー産地のマスター候補（国名＋代表的な地域名）。
// 産地入力のオートコンプリートに使用する。ユーザーの過去入力を優先し、その後にこのリストを提示する。

export const COFFEE_ORIGINS: string[] = [
  // アフリカ
  'エチオピア',
  'エチオピア イルガチェフェ',
  'エチオピア シダモ',
  'エチオピア グジ',
  'エチオピア ハラー',
  'エチオピア リム',
  'ケニア',
  'ケニア ニエリ',
  'ケニア キリニャガ',
  'タンザニア',
  'タンザニア キリマンジャロ',
  'ルワンダ',
  'ブルンジ',
  'ウガンダ',
  'コンゴ民主共和国',
  'マラウイ',
  'ザンビア',
  'カメルーン',
  // 中東
  'イエメン',
  'イエメン モカマタリ',
  // 中南米
  'コロンビア',
  'コロンビア ウイラ',
  'コロンビア ナリーニョ',
  'コロンビア カウカ',
  'コロンビア トリマ',
  'ブラジル',
  'ブラジル セラード',
  'ブラジル ミナスジェライス',
  'ブラジル モジアナ',
  'ブラジル スルデミナス',
  'グアテマラ',
  'グアテマラ アンティグア',
  'グアテマラ ウエウエテナンゴ',
  'グアテマラ アティトラン',
  'コスタリカ',
  'コスタリカ タラス',
  'パナマ',
  'パナマ ボケテ',
  'ホンジュラス',
  'エルサルバドル',
  'ニカラグア',
  'メキシコ',
  'メキシコ オアハカ',
  'メキシコ チアパス',
  'ペルー',
  'ボリビア',
  'エクアドル',
  'ベネズエラ',
  // カリブ
  'ジャマイカ',
  'ジャマイカ ブルーマウンテン',
  'キューバ',
  'ドミニカ共和国',
  'ハイチ',
  'プエルトリコ',
  // 北米・オセアニア
  'ハワイ',
  'ハワイ コナ',
  'パプアニューギニア',
  'オーストラリア',
  // アジア
  'インドネシア',
  'インドネシア スマトラ',
  'インドネシア マンデリン',
  'インドネシア ジャワ',
  'インドネシア トラジャ',
  'インドネシア バリ',
  'ベトナム',
  'タイ',
  'ミャンマー',
  'ラオス',
  'フィリピン',
  '中国 雲南',
  '台湾',
  '台湾 阿里山',
  'インド',
  'インド モンスーン',
  '東ティモール',
  'ネパール',
]

// ─── 産地パスポート用の国マスター ─────────────────────────────────────────
// 上の COFFEE_ORIGINS は「国＋地域」の入力候補。パスポートでは**国の単位**で集める
// （「エチオピア イルガチェフェ」も「エチオピア シダモ」も、同じ国のスタンプにまとめたい）。

export const CONTINENTS = ['アフリカ', '中東', '中南米', 'カリブ', '北米・オセアニア', 'アジア'] as const
export type Continent = typeof CONTINENTS[number]

/**
 * 産地の稀少度。**日本で豆を入手できる難しさ**の目安で、生産量の多寡そのものではない。
 * bronze = 量販店でも見かける … platinum = 日本の店頭ではめったに出会えない。
 * 市場は動くので、流通が変わったら見直してよい（表示も集計も全てこの値から導く）。
 */
export const RARITIES = ['bronze', 'silver', 'gold', 'platinum'] as const
export type Rarity = typeof RARITIES[number]

export interface CoffeeCountry {
  name: string
  continent: Continent
  /**
   * ISO 3166-1 alpha-2 の国コード。国旗絵文字の生成に使う。
   * ハワイは国ではないため国旗が存在せず、ここだけ未設定（頭文字表示に戻る）。
   */
  code?: string
  /** 入手のしやすさ（日本の市場基準）。パスポートの稀少度表示に使う */
  rarity: Rarity
}

export const COFFEE_COUNTRIES: CoffeeCountry[] = [
  { name: 'エチオピア',       continent: 'アフリカ', code: 'ET', rarity: 'bronze' },
  { name: 'ケニア',           continent: 'アフリカ', code: 'KE', rarity: 'bronze' },
  { name: 'タンザニア',       continent: 'アフリカ', code: 'TZ', rarity: 'bronze' },
  { name: 'ルワンダ',         continent: 'アフリカ', code: 'RW', rarity: 'silver' },
  { name: 'ブルンジ',         continent: 'アフリカ', code: 'BI', rarity: 'silver' },
  { name: 'ウガンダ',         continent: 'アフリカ', code: 'UG', rarity: 'gold' },
  { name: 'コンゴ民主共和国', continent: 'アフリカ', code: 'CD', rarity: 'gold' },
  { name: 'マラウイ',         continent: 'アフリカ', code: 'MW', rarity: 'platinum' },
  { name: 'ザンビア',         continent: 'アフリカ', code: 'ZM', rarity: 'platinum' },
  { name: 'カメルーン',       continent: 'アフリカ', code: 'CM', rarity: 'platinum' },
  { name: 'イエメン',         continent: '中東', code: 'YE', rarity: 'silver' },
  { name: 'コロンビア',       continent: '中南米', code: 'CO', rarity: 'bronze' },
  { name: 'ブラジル',         continent: '中南米', code: 'BR', rarity: 'bronze' },
  { name: 'グアテマラ',       continent: '中南米', code: 'GT', rarity: 'bronze' },
  { name: 'コスタリカ',       continent: '中南米', code: 'CR', rarity: 'bronze' },
  { name: 'パナマ',           continent: '中南米', code: 'PA', rarity: 'silver' },
  { name: 'ホンジュラス',     continent: '中南米', code: 'HN', rarity: 'silver' },
  { name: 'エルサルバドル',   continent: '中南米', code: 'SV', rarity: 'silver' },
  { name: 'ニカラグア',       continent: '中南米', code: 'NI', rarity: 'silver' },
  { name: 'メキシコ',         continent: '中南米', code: 'MX', rarity: 'silver' },
  { name: 'ペルー',           continent: '中南米', code: 'PE', rarity: 'silver' },
  { name: 'ボリビア',         continent: '中南米', code: 'BO', rarity: 'gold' },
  { name: 'エクアドル',       continent: '中南米', code: 'EC', rarity: 'gold' },
  { name: 'ベネズエラ',       continent: '中南米', code: 'VE', rarity: 'platinum' },
  { name: 'ジャマイカ',       continent: 'カリブ', code: 'JM', rarity: 'silver' },
  { name: 'キューバ',         continent: 'カリブ', code: 'CU', rarity: 'gold' },
  { name: 'ドミニカ共和国',   continent: 'カリブ', code: 'DO', rarity: 'gold' },
  { name: 'ハイチ',           continent: 'カリブ', code: 'HT', rarity: 'platinum' },
  { name: 'プエルトリコ',     continent: 'カリブ', code: 'PR', rarity: 'platinum' },
  { name: 'ハワイ',           continent: '北米・オセアニア', rarity: 'silver' },
  { name: 'パプアニューギニア', continent: '北米・オセアニア', code: 'PG', rarity: 'silver' },
  { name: 'オーストラリア',   continent: '北米・オセアニア', code: 'AU', rarity: 'platinum' },
  { name: 'インドネシア',     continent: 'アジア', code: 'ID', rarity: 'bronze' },
  { name: 'ベトナム',         continent: 'アジア', code: 'VN', rarity: 'bronze' },
  { name: 'タイ',             continent: 'アジア', code: 'TH', rarity: 'gold' },
  { name: 'ミャンマー',       continent: 'アジア', code: 'MM', rarity: 'gold' },
  { name: 'ラオス',           continent: 'アジア', code: 'LA', rarity: 'gold' },
  { name: 'フィリピン',       continent: 'アジア', code: 'PH', rarity: 'gold' },
  { name: '中国',             continent: 'アジア', code: 'CN', rarity: 'silver' },
  { name: '台湾',             continent: 'アジア', code: 'TW', rarity: 'gold' },
  { name: 'インド',           continent: 'アジア', code: 'IN', rarity: 'silver' },
  { name: '東ティモール',     continent: 'アジア', code: 'TL', rarity: 'silver' },
  { name: 'ネパール',         continent: 'アジア', code: 'NP', rarity: 'gold' },
]
