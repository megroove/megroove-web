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
  initialAmountG?: number // 内容量 (g)。記録の粉量から残量を自動計算する
  finishedAt?: string     // 飲み切った日時 (ISO)。設定されるとアーカイブ扱い
  decaf?: boolean         // デカフェ豆。カフェイン推定を通常の10%にする
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
  caffeineAmount?: number  // ドリンク種別＋サイズから推定（デカフェは10%）
  decaf?: boolean          // デカフェドリンク
  scene?: string           // シーン（朝の一杯 / 仕事のおとも 等）
  drinkStyle?: string[]    // 飲み方（ブラック / ミルク 等、複数可）
  price?: number           // 円
  photoDataUrl?: string    // 写真（base64 JPEG）
  note?: string
  createdAt: string
}

// ─── CaffeineIntake（コーヒー以外のカフェイン飲料の摂取ログ） ─────────────────
// コーヒー記録（Brew/CafeVisit）とは独立。カフェイン管理の集計にのみ合流させ、
// ライブラリ・分析・ランキングには一切混ぜない（コーヒー記録の世界観を保つ）。

export type CaffeineCategory =
  | 'energy'      // エナジードリンク
  | 'black_tea'   // 紅茶
  | 'green_tea'   // 緑茶（せん茶）
  | 'oolong_tea'  // ウーロン茶
  | 'cola'        // コーラ
  | 'other'       // その他

export interface CaffeineIntake {
  id: string
  consumedAt: string       // ISO datetime（既定は現在時刻・編集可）
  category: CaffeineCategory
  quantity: number         // 本数/杯数（既定 1）
  caffeineAmount: number   // 推定カフェイン量 (mg) = 代表値 × quantity。参考値
  note?: string            // 任意メモ（銘柄など・自由入力）
  createdAt: string
}

// ─── Brew ───────────────────────────────────────────────────────────────────

// 抽出方法。未設定＝通常のドリップ（後方互換）。drip_bag はドリップバッグ（1杯分の粉が入ったパック）
export type BrewMethod = 'pour_over' | 'drip_bag'

export interface Brew {
  id: string
  brewedAt: string           // ISO datetime
  method?: BrewMethod        // 未設定＝pour_over（通常ドリップ）
  beanId?: string
  recipeId?: string
  doseG?: number
  waterG?: number
  grindSize?: number
  tempC?: number
  equipmentId?: string       // 旧: 単一器具。読み取り互換のため残置（新規保存は equipmentIds を使う）
  equipmentIds?: string[]    // 使用した器具（複数可）
  totalTimeSec?: number      // 総抽出時間 (秒)
  pourCount?: number         // 注湯回数
  rating?: number            // 星評価 1–5
  flavors: string[]          // フレーバーチップ
  scene?: string             // シーン（朝の一杯 / 仕事のおとも 等）
  drinkStyle?: string[]      // 飲み方（ブラック / ミルク 等、複数可）
  cupping: CuppingScores
  cuppingAverage?: number    // カッピング5軸の平均（保存時に計算）
  caffeineAmount?: number    // カフェイン量 (mg)。粉量から自動推定
  photoDataUrl?: string      // 写真（base64 JPEG）
  note?: string
  createdAt: string
}
