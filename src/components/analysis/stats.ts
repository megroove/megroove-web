import type { Brew, CafeVisit } from '../../db'
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
