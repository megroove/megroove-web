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

export interface CoffeeCountry {
  name: string
  continent: Continent
  /**
   * ISO 3166-1 alpha-2 の国コード。国旗絵文字の生成に使う。
   * ハワイは国ではないため国旗が存在せず、ここだけ未設定（頭文字表示に戻る）。
   */
  code?: string
}

export const COFFEE_COUNTRIES: CoffeeCountry[] = [
  { name: 'エチオピア',       continent: 'アフリカ', code: 'ET' },
  { name: 'ケニア',           continent: 'アフリカ', code: 'KE' },
  { name: 'タンザニア',       continent: 'アフリカ', code: 'TZ' },
  { name: 'ルワンダ',         continent: 'アフリカ', code: 'RW' },
  { name: 'ブルンジ',         continent: 'アフリカ', code: 'BI' },
  { name: 'ウガンダ',         continent: 'アフリカ', code: 'UG' },
  { name: 'コンゴ民主共和国', continent: 'アフリカ', code: 'CD' },
  { name: 'マラウイ',         continent: 'アフリカ', code: 'MW' },
  { name: 'ザンビア',         continent: 'アフリカ', code: 'ZM' },
  { name: 'カメルーン',       continent: 'アフリカ', code: 'CM' },
  { name: 'イエメン',         continent: '中東', code: 'YE' },
  { name: 'コロンビア',       continent: '中南米', code: 'CO' },
  { name: 'ブラジル',         continent: '中南米', code: 'BR' },
  { name: 'グアテマラ',       continent: '中南米', code: 'GT' },
  { name: 'コスタリカ',       continent: '中南米', code: 'CR' },
  { name: 'パナマ',           continent: '中南米', code: 'PA' },
  { name: 'ホンジュラス',     continent: '中南米', code: 'HN' },
  { name: 'エルサルバドル',   continent: '中南米', code: 'SV' },
  { name: 'ニカラグア',       continent: '中南米', code: 'NI' },
  { name: 'メキシコ',         continent: '中南米', code: 'MX' },
  { name: 'ペルー',           continent: '中南米', code: 'PE' },
  { name: 'ボリビア',         continent: '中南米', code: 'BO' },
  { name: 'エクアドル',       continent: '中南米', code: 'EC' },
  { name: 'ベネズエラ',       continent: '中南米', code: 'VE' },
  { name: 'ジャマイカ',       continent: 'カリブ', code: 'JM' },
  { name: 'キューバ',         continent: 'カリブ', code: 'CU' },
  { name: 'ドミニカ共和国',   continent: 'カリブ', code: 'DO' },
  { name: 'ハイチ',           continent: 'カリブ', code: 'HT' },
  { name: 'プエルトリコ',     continent: 'カリブ', code: 'PR' },
  { name: 'ハワイ',           continent: '北米・オセアニア' },
  { name: 'パプアニューギニア', continent: '北米・オセアニア', code: 'PG' },
  { name: 'オーストラリア',   continent: '北米・オセアニア', code: 'AU' },
  { name: 'インドネシア',     continent: 'アジア', code: 'ID' },
  { name: 'ベトナム',         continent: 'アジア', code: 'VN' },
  { name: 'タイ',             continent: 'アジア', code: 'TH' },
  { name: 'ミャンマー',       continent: 'アジア', code: 'MM' },
  { name: 'ラオス',           continent: 'アジア', code: 'LA' },
  { name: 'フィリピン',       continent: 'アジア', code: 'PH' },
  { name: '中国',             continent: 'アジア', code: 'CN' },
  { name: '台湾',             continent: 'アジア', code: 'TW' },
  { name: 'インド',           continent: 'アジア', code: 'IN' },
  { name: '東ティモール',     continent: 'アジア', code: 'TL' },
  { name: 'ネパール',         continent: 'アジア', code: 'NP' },
]
