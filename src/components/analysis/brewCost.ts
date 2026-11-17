import type { Bean, Brew, CafeVisit } from '../../db'

// 1杯のコスト。保存せず、豆の「袋の値段 × 粉量 ÷ 内容量」で都度計算する（残量と同じ流儀）。
// そのため値段を後から入れても、その袋の過去の記録すべてにさかのぼって付く。
// ドリップバッグは粉量を記録しないので対象外（平均にも入れない）。

const positive = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

/** 1g あたりの値段（円）。値段と内容量の両方がそろっていなければ null */
export function beanYenPerGram(bean: Pick<Bean, 'priceYen' | 'initialAmountG'> | undefined): number | null {
  if (!bean || !positive(bean.priceYen) || !positive(bean.initialAmountG)) return null
  return bean.priceYen / bean.initialAmountG
}

/** その一杯の豆代（円・丸める前）。計算できなければ null */
export function brewCostYen(brew: Pick<Brew, 'method' | 'doseG'>, bean: Bean | undefined): number | null {
  if (brew.method === 'drip_bag' || !positive(brew.doseG)) return null
  const perGram = beanYenPerGram(bean)
  return perGram === null ? null : perGram * brew.doseG
}

export interface CostAverage {
  /** 平均（円・四捨五入）。対象が無ければ null */
  avgYen: number | null
  /** 平均に使った杯数 */
  count: number
}

const average = (values: number[]): CostAverage => ({
  avgYen: values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null,
  count: values.length,
})

/** 自宅の一杯の平均。値段・内容量・粉量がそろった記録だけで割る */
export function homeCostAverage(brews: Brew[], beanOf: (id: string) => Bean | undefined): CostAverage {
  const costs: number[] = []
  for (const b of brews) {
    const c = brewCostYen(b, b.beanId ? beanOf(b.beanId) : undefined)
    if (c !== null) costs.push(c)
  }
  return average(costs)
}

/** カフェの一杯の平均。価格を入れた記録だけで割る */
export function cafeCostAverage(visits: CafeVisit[]): CostAverage {
  return average(visits.map(v => v.price).filter(positive))
}

/** 表示用（例: 「約135円」）。1円未満は「1円未満」 */
export function formatYen(yen: number): string {
  if (yen < 1) return '1円未満'
  return `約${Math.round(yen).toLocaleString()}円`
}
