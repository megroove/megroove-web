import type { Bean, Brew, CuppingScores } from './types'

export function newId(): string {
  return crypto.randomUUID()
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function calcCuppingAverage(cupping: CuppingScores): number | undefined {
  const vals = [
    cupping.acidity,
    cupping.sweetness,
    cupping.bitterness,
    cupping.body,
    cupping.aftertaste,
  ].filter((v): v is number => v !== undefined)

  if (vals.length === 0) return undefined
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function calcRatio(doseG: number, waterG: number): string {
  if (doseG === 0) return '—'
  const ratio = waterG / doseG
  return `1:${ratio.toFixed(1)}`
}

export function daysSinceRoast(roastedAt: string): number {
  const roasted = new Date(roastedAt)
  const now = new Date()
  return Math.floor((now.getTime() - roasted.getTime()) / (1000 * 60 * 60 * 24))
}

// 淹れた時点の焙煎日齢（飲み頃分析用）。daysSinceRoast と違い「今」ではなく brewedAt 基準
export function roastAgeAtBrew(roastedAt: string, brewedAt: string): number {
  const roasted = new Date(roastedAt).getTime()
  const brewed = new Date(brewedAt).getTime()
  return Math.floor((brewed - roasted) / (1000 * 60 * 60 * 24))
}

export const ROAST_LEVEL_LABELS: Record<string, string> = {
  light: '浅煎り',
  'light-medium': '浅〜中煎り',
  medium: '中煎り',
  'medium-dark': '中〜深煎り',
  dark: '深煎り',
}

export const CAFE_DRINK_SIZE_LABELS: Record<string, string> = {
  S: 'S',
  M: 'M',
  L: 'L',
}

// ドリンク種別×サイズのカフェイン推定値 (mg)
const CAFE_CAFFEINE_TABLE: Record<string, Record<string, number>> = {
  espresso:   { S: 63,  M: 126, L: 189 },  // ~63mg/shot
  latte:      { S: 63,  M: 126, L: 126 },
  cappuccino: { S: 63,  M: 126, L: 126 },
  flat_white: { S: 130, M: 130, L: 195 },  // ristretto 2shots
  americano:  { S: 63,  M: 126, L: 189 },
  filter:     { S: 95,  M: 150, L: 220 },
  cold_brew:  { S: 150, M: 200, L: 285 },  // 濃縮抽出のため高め
  other:      { S: 80,  M: 120, L: 160 },
}

export function estimateCafeCaffeine(
  drinkType: string | undefined,
  size: string | undefined,
  decaf = false,
): number | undefined {
  if (!drinkType) return undefined
  const table = CAFE_CAFFEINE_TABLE[drinkType]
  if (!table) return undefined
  const mg = table[size ?? 'M'] ?? table['M']
  return decaf ? Math.round(mg * DECAF_FACTOR) : mg
}

export const CAFE_DRINK_TYPE_LABELS: Record<string, string> = {
  espresso:   'エスプレッソ',
  latte:      'ラテ',
  cappuccino: 'カプチーノ',
  flat_white: 'フラットホワイト',
  americano:  'アメリカーノ',
  filter:     'フィルター',
  cold_brew:  'コールドブリュー',
  other:      'その他',
}

export const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  dripper: 'ドリッパー',
  server: 'サーバー',
  grinder: 'グラインダー',
  kettle: 'ケトル',
  scale: 'スケール',
  other: 'その他',
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function formatBrewDate(isoString: string): string {
  const d = new Date(isoString)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekday = WEEKDAYS[d.getDay()]
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${month}月${day}日（${weekday}） ${hh}:${mm}`
}

export function formatBrewDateShort(isoString: string): string {
  const d = new Date(isoString)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekday = WEEKDAYS[d.getDay()]
  return `${month}/${day}（${weekday}）`
}

// ISO datetime → <input type="datetime-local"> 用のローカル時刻文字列
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-') + 'T' + [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join(':')
}

// datetime-local の値 → ISO datetime。不正値は現在時刻にフォールバック
export function fromDatetimeLocal(value: string): string {
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? nowISO() : new Date(t).toISOString()
}

export function formatSecToMmSs(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

// ─── Bean remaining ──────────────────────────────────────────────────────────

// 内容量が未入力の豆は null（残量管理の対象外）
export function calcBeanRemainingG(bean: Bean, brews: Brew[]): number | null {
  if (bean.initialAmountG === undefined) return null
  const used = brews.reduce(
    (sum, b) => (b.beanId === bean.id ? sum + (b.doseG ?? 0) : sum),
    0,
  )
  return Math.max(0, Math.round((bean.initialAmountG - used) * 10) / 10)
}

// 残量から「あと約何杯か」を推定（その豆の平均粉量、なければ15g）
export function estimateRemainingCups(remainingG: number, bean: Bean, brews: Brew[]): number {
  const doses = brews.filter(b => b.beanId === bean.id && b.doseG).map(b => b.doseG!)
  const avgDose = doses.length > 0 ? doses.reduce((a, b) => a + b, 0) / doses.length : 15
  return Math.floor(remainingG / avgDose)
}

export function formatBeanRemaining(bean: Bean, brews: Brew[]): string | null {
  const remaining = calcBeanRemainingG(bean, brews)
  if (remaining === null) return null
  if (remaining <= 0) return '残りわずか'
  const cups = estimateRemainingCups(remaining, bean, brews)
  return cups > 0 ? `残り約${remaining}g（約${cups}杯）` : `残り約${remaining}g`
}

// ─── Streak ──────────────────────────────────────────────────────────────────

function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// 連続記録日数。今日が未記録でも昨日まで続いていればその日数を返す（0時リセットにしない）
export function calcStreakDays(recordISOs: string[]): number {
  const days = new Set(recordISOs.map(iso => toLocalDateKey(new Date(iso))))
  if (days.size === 0) return 0

  const cursor = new Date()
  if (!days.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(toLocalDateKey(cursor))) return 0
  }

  let streak = 0
  while (days.has(toLocalDateKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function isSameLocalDay(iso: string, base: Date = new Date()): boolean {
  return toLocalDateKey(new Date(iso)) === toLocalDateKey(base)
}

// ─── Backup reminder (localStorage) ──────────────────────────────────────────

const LAST_EXPORT_KEY   = 'megroove-last-export'
const BACKUP_SNOOZE_KEY = 'megroove-backup-snooze'

export function loadLastExportAt(): string | null {
  return localStorage.getItem(LAST_EXPORT_KEY)
}

export function saveLastExportAt(): void {
  localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString())
}

export function daysSinceLastExport(): number | null {
  const last = loadLastExportAt()
  if (!last) return null
  return Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24))
}

// リマインダーを7日間非表示にする
export function snoozeBackupReminder(): void {
  const until = new Date()
  until.setDate(until.getDate() + 7)
  localStorage.setItem(BACKUP_SNOOZE_KEY, until.toISOString())
}

// 前回エクスポート以降に増えた記録数（未エクスポートなら全件）。
// createdAt 基準 = 「バックアップに含まれていない記録」の数
export function countUnbackedRecords(records: { createdAt: string }[]): number {
  const last = loadLastExportAt()
  if (!last) return records.length
  return records.filter(r => r.createdAt > last).length
}

// 記録が10件以上あり、未エクスポート or 30日超過 or 未バックアップ20件以上ならリマインド文言を返す。
// 発火条件に応じた文言にする（何が失われ得るかが具体的に伝わるように。急かす表現はしない）
export function getBackupReminder(recordCount: number, unbackedCount: number): string | null {
  if (recordCount < 10) return null
  const snooze = localStorage.getItem(BACKUP_SNOOZE_KEY)
  if (snooze && new Date(snooze).getTime() > Date.now()) return null
  const days = daysSinceLastExport()
  if (days === null) return 'まだバックアップがありません。ブラウザのデータ消去に備えてエクスポートを推奨します。'
  if (unbackedCount === 0) return null // 前回から記録が増えていなければ促す意味がない
  if (unbackedCount >= 20) return `バックアップされていない記録が${unbackedCount}件あります。エクスポートを推奨します。`
  if (days > 30) return `最後のバックアップから${days}日経過しています（未バックアップ${unbackedCount}件）。エクスポートを推奨します。`
  return null
}

// ─── Backup intro card（初回の仕組み周知。一度閉じたら二度と出さない） ────────────

const BACKUP_INTRO_KEY = 'megroove-backup-intro'

export function hasSeenBackupIntro(): boolean {
  return localStorage.getItem(BACKUP_INTRO_KEY) === '1'
}

export function markBackupIntroSeen(): void {
  localStorage.setItem(BACKUP_INTRO_KEY, '1')
}

// ─── Caffeine ────────────────────────────────────────────────────────────────

// コーヒー粉 1g あたり約12mg (ドリップの一般的な推定値)
// デカフェは「カフェイン90%以上除去」の表示基準に基づき、控えめな上限として10%で推定
const DECAF_FACTOR = 0.1

export function estimateCaffeine(doseG: number, decaf = false): number {
  return Math.round(doseG * 12 * (decaf ? DECAF_FACTOR : 1))
}

// 半減期モデル: 5.5時間で半分になる
export function calcResidualCaffeine(
  intakes: { caffeineAmount: number; brewedAt: string }[],
  atTime: Date = new Date(),
): number {
  return intakes.reduce((total, { caffeineAmount, brewedAt }) => {
    const hoursElapsed = (atTime.getTime() - new Date(brewedAt).getTime()) / (1000 * 60 * 60)
    if (hoursElapsed < 0) return total
    return total + caffeineAmount * Math.pow(0.5, hoursElapsed / 5.5)
  }, 0)
}

// ─── Settings (localStorage) ─────────────────────────────────────────────────

export interface AppSettings {
  bedtimeHour: number
  bedtimeMinute: number
  bedtimeTargetMg: number  // 就寝時に残したいカフェイン量の上限 (mg)
}

const SETTINGS_KEY = 'megroove-settings'
const DEFAULT_SETTINGS: AppSettings = { bedtimeHour: 23, bedtimeMinute: 0, bedtimeTargetMg: 50 }

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

// ─── Flavors ─────────────────────────────────────────────────────────────────

export const DEFAULT_FLAVORS = [
  'フルーティ', 'チョコレート', 'ナッツ', 'キャラメル', 'フローラル',
  'シトラス', 'ベリー', 'アップル', 'スパイシー', 'アーシー',
  'スモーキー', 'クリーン', 'ワイニー', 'ハーブ', 'バニラ',
]

// 次の就寝時刻（今日の就寝時刻を過ぎていれば翌日）
export function getBedtimeDate(hour: number, minute: number, now: Date): Date {
  const bt = new Date(now)
  bt.setHours(hour, minute, 0, 0)
  if (bt <= now) bt.setDate(bt.getDate() + 1)
  return bt
}

// 「よく使う」フレーバー候補: 3回以上使ったチップを頻度順に最大5件
export function calcFrequentFlavors(
  records: { flavors: string[] }[],
  minCount = 3,
  max = 5,
): string[] {
  const counts = new Map<string, number>()
  for (const r of records) {
    for (const f of r.flavors) counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([f]) => f)
}

// ─── Brew Layout Settings (localStorage) ─────────────────────────────────────

export type BrewBlockId =
  | 'recipe'
  | 'dose_water'
  | 'grind_temp'
  | 'rating'
  | 'flavors'
  | 'scene'
  | 'cupping'
  | 'equipment'
  | 'extraction'
  | 'note'
  | 'photo'

export const BREW_BLOCK_LABELS: Record<BrewBlockId, string> = {
  recipe:     'レシピ',
  dose_water: '粉量 / 湯量',
  grind_temp: '挽き目 / 湯温',
  rating:     '評価（星）',
  flavors:    'フレーバー',
  scene:      'シーン・飲み方',
  cupping:    'カッピング',
  equipment:  '器具',
  extraction: '抽出',
  note:       'メモ',
  photo:      '写真',
}

// シーン（単一選択）と飲み方（複数選択）の定番チップ
export const SCENE_OPTIONS = ['朝の一杯', '仕事のおとも', '食後', 'リラックス', '来客', '外で']
export const DRINK_STYLE_OPTIONS = ['ブラック', 'ミルク', '砂糖', 'アイス']

export interface BrewLayoutSettings {
  main:          BrewBlockId[]
  detail:        BrewBlockId[]
  hidden:        BrewBlockId[]
  bloomTimeSec?: number  // 蒸らしタイマーのカスタム時間（秒）
}

export const DEFAULT_BREW_LAYOUT: BrewLayoutSettings = {
  main:   ['recipe', 'dose_water', 'grind_temp', 'rating', 'flavors'],
  detail: ['cupping', 'equipment', 'extraction', 'note', 'photo'],
  hidden: [],
}

const ALL_BREW_BLOCKS: BrewBlockId[] = [
  'recipe', 'dose_water', 'grind_temp', 'rating', 'flavors', 'scene',
  'cupping', 'equipment', 'extraction', 'note', 'photo',
]

const BREW_LAYOUT_KEY = 'megroove-brew-layout'

export function loadBrewLayout(): BrewLayoutSettings {
  try {
    const raw = localStorage.getItem(BREW_LAYOUT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as BrewLayoutSettings
      const presentIds = new Set([...parsed.main, ...parsed.detail, ...parsed.hidden])
      const missing = ALL_BREW_BLOCKS.filter(id => !presentIds.has(id))
      if (missing.length > 0) {
        return { ...parsed, detail: [...parsed.detail, ...missing] }
      }
      return parsed
    }
  } catch { /* ignore */ }
  return {
    main:   [...DEFAULT_BREW_LAYOUT.main],
    detail: [...DEFAULT_BREW_LAYOUT.detail],
    hidden: [],
  }
}

export function saveBrewLayout(layout: BrewLayoutSettings): void {
  localStorage.setItem(BREW_LAYOUT_KEY, JSON.stringify(layout))
}

// ─── Image resize ─────────────────────────────────────────────────────────────

const MAX_PHOTO_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export function resizeImage(file: File, maxPx = 800): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('画像ファイルを選択してください'))
  }
  if (file.size > MAX_PHOTO_FILE_SIZE) {
    return Promise.reject(new Error('ファイルサイズが大きすぎます（最大20MB）'))
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像の読み込みに失敗しました')) }
    img.src = url
  })
}
