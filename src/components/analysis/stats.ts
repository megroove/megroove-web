import type { Brew, Bean, CafeVisit } from '../../db'
import { roastAgeAtBrew } from '../../db'
import type { RadarScores } from './RadarChart'

// ─── カッピング加重平均（レーダー用） ─────────────────────────────────────────

export type ScoreKey = 'acidity' | 'sweetness' | 'bitterness' | 'body' | 'aftertaste'
export const SCORE_KEYS: ScoreKey[] = ['acidity', 'sweetness', 'bitterness', 'body', 'aftertaste']
export const SCORE_LABELS: Record<ScoreKey, string> = {
  acidity: '酸味', sweetness: '甘み', bitterness: '苦味',
  body: 'ボディ', aftertaste: '後味',
}

export function calcWeightedScores(brews: Brew[]): { scores: RadarScores; count: number } {
  // 星評価がありカッピングスコアが1軸以上入っているものが対象
  const eligible = brews.filter(
    b => (b.rating ?? 0) > 0 && SCORE_KEYS.some(k => b.cupping[k] !== undefined)
  )

  const scores: RadarScores = {}
  for (const key of SCORE_KEYS) {
    let wSum = 0, wTotal = 0
    for (const brew of eligible) {
      const val    = brew.cupping[key]
      const weight = brew.rating ?? 0
      if (val !== undefined && weight > 0) {
        wSum   += val * weight
        wTotal += weight
      }
    }
    if (wTotal > 0) scores[key] = wSum / wTotal
  }

  return { scores, count: eligible.length }
}

export function generateInsight(scores: RadarScores): string {
  const entries = (Object.entries(scores) as [ScoreKey, number][]).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return ''

  const avg = entries.reduce((s, [, v]) => s + v, 0) / entries.length
  if (avg >= 4.2) return 'バランスよく高スコアです。理想の一杯を安定して再現できています。'
  if (avg <= 2.5) return '好みの軸を探し中。記録を重ねるほど傾向が明確になります。'

  const topKey    = entries[0][0]
  const bottomKey = entries[entries.length - 1][0]
  const spread    = entries[0][1] - entries[entries.length - 1][1]

  if (spread < 0.5) return 'すべての軸がバランスよく取れています。'

  return `${SCORE_LABELS[topKey]}を高く評価し、${SCORE_LABELS[bottomKey]}は控えめなコーヒーが好みのようです。`
}

// ─── ランキング ───────────────────────────────────────────────────────────────

export function rankBrews(brews: Brew[]): Brew[] {
  return [...brews].sort((a, b) => {
    const r = (b.rating ?? 0) - (a.rating ?? 0)
    if (r !== 0) return r
    const c = (b.cuppingAverage ?? 0) - (a.cuppingAverage ?? 0)
    if (c !== 0) return c
    return new Date(b.brewedAt).getTime() - new Date(a.brewedAt).getTime()
  })
}

// ─── 月別トレンド ─────────────────────────────────────────────────────────────

export interface MonthlyTrend {
  label: string       // 「7月」
  cups: number        // ブリュー＋カフェの合計杯数
  avgRating?: number  // 星評価の平均（評価ありのみ）
}

export function calcMonthlyTrend(
  brews: Brew[],
  visits: CafeVisit[],
  monthsBack: number,
): MonthlyTrend[] {
  const now = new Date()
  const result: MonthlyTrend[] = []

  for (let i = monthsBack - 1; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const inMonth = (iso: string) => {
      const d = new Date(iso)
      return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()
    }
    const ratings = [
      ...brews.filter(b => inMonth(b.brewedAt)).map(b => b.rating),
      ...visits.filter(v => inMonth(v.visitedAt)).map(v => v.rating),
    ].filter((r): r is number => Boolean(r))

    result.push({
      label: `${month.getMonth() + 1}月`,
      cups:
        brews.filter(b => inMonth(b.brewedAt)).length +
        visits.filter(v => inMonth(v.visitedAt)).length,
      avgRating: ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : undefined,
    })
  }
  return result
}

// ─── ベスト条件（★4以上の記録が集中する抽出パラメータ） ─────────────────────────

export interface BestConditions {
  count: number
  ratio?: number     // 湯量/粉量
  tempC?: number
  grindSize?: number
  timeSec?: number
}

export function calcBestConditions(brews: Brew[]): BestConditions | null {
  const top = brews.filter(b => (b.rating ?? 0) >= 4)
  if (top.length < 3) return null

  const avg = (vals: number[]) =>
    vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined

  return {
    count: top.length,
    ratio: avg(top.filter(b => b.doseG && b.waterG).map(b => b.waterG! / b.doseG!)),
    tempC: avg(top.map(b => b.tempC).filter((v): v is number => v !== undefined)),
    grindSize: avg(top.map(b => b.grindSize).filter((v): v is number => v !== undefined)),
    timeSec: avg(top.map(b => b.totalTimeSec).filter((v): v is number => v !== undefined)),
  }
}

// ─── 豆ごとの集計 ─────────────────────────────────────────────────────────────

export interface BeanStat {
  beanId: string
  count: number
  avgRating?: number
}

export function calcBeanStats(brews: Brew[]): BeanStat[] {
  const map = new Map<string, { count: number; ratings: number[] }>()
  for (const b of brews) {
    if (!b.beanId) continue
    const cur = map.get(b.beanId) ?? { count: 0, ratings: [] }
    cur.count++
    if (b.rating) cur.ratings.push(b.rating)
    map.set(b.beanId, cur)
  }
  return [...map.entries()]
    .map(([beanId, { count, ratings }]) => ({
      beanId,
      count,
      avgRating: ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : undefined,
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── 飲み頃分析（焙煎日齢 × 評価） ─────────────────────────────────────────────
// 1データ点 = 1杯（Brew）。淹れた時点の焙煎日齢を帯に振り分け、帯ごとの平均評価を集計する。
// 対象は beanId + 豆の roastedAt + rating がそろった Brew のみ（roastedAt 未登録は分析対象外）。

export const AGING_MIN_TOTAL = 5   // 帯全体でこの杯数以上たまるとカードを出す
const AGING_MIN_PEAK = 2           // ピーク帯として名指しするのに必要な杯数

const AGING_BUCKET_DEFS: { min: number; max: number }[] = [
  { min: 0,  max: 3 },
  { min: 4,  max: 6 },
  { min: 7,  max: 13 },
  { min: 14, max: 20 },
  { min: 21, max: 29 },
  { min: 30, max: Infinity },
]

export interface AgingBucket {
  min: number
  max: number          // Infinity = 上限なし（30日〜）
  count: number
  avgRating: number
}

export interface AgingWindow {
  buckets: AgingBucket[]  // count>0 の帯のみ、日齢の昇順
  total: number           // 有効データ点の総数
  peak?: AgingBucket      // 高評価が集中する帯（該当なしなら undefined）
}

export function bucketLabel(b: { min: number; max: number }): string {
  return b.max === Infinity ? `${b.min}日〜` : `${b.min}〜${b.max}日`
}

export function calcAgingWindow(brews: Brew[], beans: Bean[]): AgingWindow {
  const roastMap = new Map(beans.map(b => [b.id, b.roastedAt]))
  const acc = AGING_BUCKET_DEFS.map(d => ({ ...d, ratings: [] as number[] }))

  for (const brew of brews) {
    if (!brew.beanId || !brew.rating) continue
    const roastedAt = roastMap.get(brew.beanId)
    if (!roastedAt) continue
    const age = roastAgeAtBrew(roastedAt, brew.brewedAt)
    if (age < 0) continue
    const bucket = acc.find(d => age >= d.min && age <= d.max)
    if (bucket) bucket.ratings.push(brew.rating)
  }

  const buckets: AgingBucket[] = acc
    .filter(d => d.ratings.length > 0)
    .map(d => ({
      min: d.min,
      max: d.max,
      count: d.ratings.length,
      avgRating: d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length,
    }))

  const total = buckets.reduce((s, b) => s + b.count, 0)

  const candidates = buckets.filter(b => b.count >= AGING_MIN_PEAK)
  const peak = candidates.reduce<AgingBucket | undefined>((best, b) => {
    if (!best) return b
    if (b.avgRating > best.avgRating) return b
    if (b.avgRating === best.avgRating && b.count > best.count) return b
    return best
  }, undefined)

  return { buckets, total, peak }
}
