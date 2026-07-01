// ─── Bean ───────────────────────────────────────────────────────────────────

export type RoastLevel =
  | 'light'
  | 'light-medium'
  | 'medium'
  | 'medium-dark'
  | 'dark'

export interface Bean {
  id: string
  name: string
  origin?: string
  farm?: string
  variety?: string
  process?: string
  roastLevel: RoastLevel
  roastedAt?: string   // ISO date string (YYYY-MM-DD)
  purchasedAt?: string // ISO date string
  stockNote?: string
  createdAt: string    // ISO datetime
}

// ─── Equipment ──────────────────────────────────────────────────────────────

export type EquipmentType =
  | 'dripper'
  | 'server'
  | 'grinder'
  | 'kettle'
  | 'scale'
  | 'other'

export interface Equipment {
  id: string
  name: string
  type: EquipmentType
  maker?: string
  sizeNote?: string
  createdAt: string
}

// ─── Recipe ─────────────────────────────────────────────────────────────────

export interface Recipe {
  id: string
  name: string
  defaultDoseG?: number      // 粉量 (g)
  defaultWaterG?: number     // 湯量 (g)
  defaultGrindSize?: number  // 挽き目
  defaultTempC?: number      // 湯温 (°C)
  defaultEquipmentId?: string
  createdAt: string
}

// ─── CuppingScores（CafeVisit でも共用） ─────────────────────────────────────

export interface CuppingScores {
  acidity?: number    // 酸味 1–5 (0.5 刻み)
  sweetness?: number  // 甘み
  bitterness?: number // 苦味
  body?: number       // ボディ
  aftertaste?: number // 後味
}

// ─── CafeVisit ───────────────────────────────────────────────────────────────

export type CafeDrinkType =
  | 'espresso'
  | 'latte'
  | 'cappuccino'
  | 'flat_white'
  | 'americano'
  | 'filter'
  | 'cold_brew'
  | 'other'

export type CafeDrinkSize = 'S' | 'M' | 'L'

export interface CafeVisit {
  id: string
  visitedAt: string        // ISO datetime
  cafeName: string
  drinkName?: string
  drinkType?: CafeDrinkType
  size?: CafeDrinkSize
  beanOrigin?: string      // 豆の産地
  rating?: number          // 1–5
  flavors: string[]
  cupping?: CuppingScores  // 既存レコードとの後方互換のため optional
  cuppingAverage?: number
  caffeineAmount?: number  // ドリンク種別＋サイズから推定
  price?: number           // 円
  photoDataUrl?: string    // 写真（base64 JPEG）
  note?: string
  createdAt: string
}

// ─── Brew ───────────────────────────────────────────────────────────────────

export interface Brew {
  id: string
  brewedAt: string           // ISO datetime
  beanId?: string
  recipeId?: string
  doseG?: number
  waterG?: number
  grindSize?: number
  tempC?: number
  equipmentId?: string
  totalTimeSec?: number      // 総抽出時間 (秒)
  pourCount?: number         // 注湯回数
  rating?: number            // 星評価 1–5
  flavors: string[]          // フレーバーチップ
  cupping: CuppingScores
  cuppingAverage?: number    // カッピング5軸の平均（保存時に計算）
  caffeineAmount?: number    // カフェイン量 (mg)。粉量から自動推定
  photoDataUrl?: string      // 写真（base64 JPEG）
  note?: string
  createdAt: string
}
