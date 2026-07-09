// データ提供パッケージ（megroove-provision/v1）の型定義。
// 設計の詳細は docs/data-rewards-design.md を参照。

export type DataScope =
  | 'brew.params'   // 抽出パラメータ（粉量・湯量・比率・挽き目・湯温・時間・注湯・器具タイプ）
  | 'brew.rating'   // 評価（星・カッピング5軸・フレーバーチップ）
  | 'bean.master'   // 豆情報（産地・品種・精製方法・焙煎度・焙煎からの日数）※豆の名前は含まない
  | 'cafe.visits'   // カフェ記録（ドリンク種別・サイズ・評価・価格帯）※カフェ名は含まない
  | 'stats.monthly' // 月次集計のみ（杯数・平均評価）

export const ALL_SCOPES: DataScope[] = [
  'brew.params', 'brew.rating', 'bean.master', 'cafe.visits', 'stats.monthly',
]

export const SCOPE_LABELS: Record<DataScope, string> = {
  'brew.params':   '抽出パラメータ',
  'brew.rating':   '評価・カッピング',
  'bean.master':   '豆の情報',
  'cafe.visits':   'カフェ記録',
  'stats.monthly': '月次集計のみ',
}

export const SCOPE_DESCRIPTIONS: Record<DataScope, string> = {
  'brew.params':   '粉量・湯量・比率・挽き目・湯温・抽出時間・注湯回数・器具タイプ',
  'brew.rating':   '星評価・カッピング5軸・フレーバーチップ',
  'bean.master':   '産地・品種・精製方法・焙煎度・焙煎からの日数（豆の名前は含みません）',
  'cafe.visits':   'ドリンク種別・サイズ・評価・価格帯（カフェ名は含みません）',
  'stats.monthly': '月ごとの杯数と平均評価だけの最小データ',
}

// ─── レコード ─────────────────────────────────────────────────────────────────

export interface ProvisionBrewRecord {
  type: 'brew'
  date: string // YYYY-MM-DD（時刻は丸める）
  params?: {
    doseG?: number
    waterG?: number
    ratio?: number       // 湯量 / 粉量
    grindSize?: number
    tempC?: number
    totalTimeSec?: number
    pourCount?: number
    equipmentType?: string // dripper 等のタイプのみ。名前・メーカーは含まない
  }
  rating?: {
    stars?: number
    cupping?: Record<string, number>
    flavors?: string[]
  }
  bean?: {
    origin?: string
    variety?: string
    process?: string
    roastLevel?: string
    daysSinceRoast?: number // 抽出時点の経過日数
  }
}

export interface ProvisionCafeRecord {
  type: 'cafe'
  date: string
  drinkType?: string
  size?: string
  stars?: number
  cupping?: Record<string, number>
  flavors?: string[]
  priceBand?: number // 100円単位に丸めた価格
  beanOrigin?: string
}

export type ProvisionRecord = ProvisionBrewRecord | ProvisionCafeRecord

export interface MonthlyStat {
  month: string // YYYY-MM
  brewCups: number
  cafeCups: number
  avgRating?: number
}

// ─── パッケージ ───────────────────────────────────────────────────────────────

export const PROVISION_FORMAT = 'megroove-provision/v1' as const

export interface ProvisionPackage {
  format: typeof PROVISION_FORMAT
  schemaVersion: 1
  generatedAt: string // YYYY-MM-DD
  pseudoId: string    // パートナーごとに異なる仮名ID（HMAC-SHA256）
  partnerId: string
  consentScopes: DataScope[]
  period: { from: string; to: string } // YYYY-MM-DD
  records: ProvisionRecord[]
  monthlyStats?: MonthlyStat[]
}
