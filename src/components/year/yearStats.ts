import type { Bean, Brew, CafeVisit } from '../../db'
import { beanOrigins } from '../../db'

// 「Year in Coffee」＝1年の記録を1枚にまとめるための集計。
//
// 既存の方針に合わせる:
//  - 杯数には未評価も数える（淹れた事実だから）
//  - 平均評価は評価済みだけで割る（未評価は分析に混ぜない）
//  - コーヒー以外のカフェイン飲料は混ぜない（カフェイン管理にだけ合流させるもの）

export interface YearTrack {
  /** 豆名（レコードのトラック名に見立てる） */
  name: string
  count: number
}

export interface YearStats {
  year: number
  /** 総杯数（自宅＋お店） */
  cups: number
  homeCups: number
  cafeCups: number
  /** 豆の消費量 (g) */
  doseSumG: number
  /** 記録した産地の数 */
  originCount: number
  /** カフェでの支出 (円) */
  spend: number
  /** 評価済みだけの平均（評価が無ければ null） */
  avgRating: number | null
  /** 1月〜12月の杯数 */
  monthlyCups: number[]
  /** よく飲んだ豆 Top5 */
  tracks: YearTrack[]
  /** その年のベストの一杯 */
  best: { name: string; rating: number; month: number } | null
}

function yearOf(iso: string): number {
  return new Date(iso).getFullYear()
}

function monthOf(iso: string): number {
  return new Date(iso).getMonth()
}

/** 記録のある年を新しい順に返す */
export function listRecordedYears(
  brews: { brewedAt: string }[],
  visits: { visitedAt: string }[],
): number[] {
  const years = new Set<number>()
  for (const b of brews) years.add(yearOf(b.brewedAt))
  for (const v of visits) years.add(yearOf(v.visitedAt))
  return [...years].sort((a, b) => b - a)
}

export function calcYearStats(
  brews: Brew[],
  visits: CafeVisit[],
  beanMap: Map<string, Bean>,
  year: number,
): YearStats {
  const yb = brews.filter(b => yearOf(b.brewedAt) === year)
  const yv = visits.filter(v => yearOf(v.visitedAt) === year)

  const monthlyCups = Array<number>(12).fill(0)
  for (const b of yb) monthlyCups[monthOf(b.brewedAt)]++
  for (const v of yv) monthlyCups[monthOf(v.visitedAt)]++

  const origins = new Set<string>()
  for (const b of yb) {
    // ブレンドは構成産地ぶんを数える（代表産地だけだと取りこぼす）
    for (const o of beanOrigins(b.beanId ? beanMap.get(b.beanId) : undefined)) origins.add(o)
  }
  for (const v of yv) {
    if (v.beanOrigin) origins.add(v.beanOrigin)
  }

  // よく飲んだ豆（豆の登録がある記録だけ。ドリップバッグの銘柄も Bean なので入る）
  const beanCounts = new Map<string, number>()
  for (const b of yb) {
    const name = b.beanId ? beanMap.get(b.beanId)?.name : undefined
    if (name) beanCounts.set(name, (beanCounts.get(name) ?? 0) + 1)
  }
  const tracks: YearTrack[] = [...beanCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // 平均は評価済みのみ
  const ratings = [
    ...yb.map(b => b.rating),
    ...yv.map(v => v.rating),
  ].filter((r): r is number => typeof r === 'number' && r > 0)

  // ベストの一杯: 星 → カッピング平均 → 新しい順（ランキングと同じ考え方）
  const bestBrew = [...yb]
    .filter(b => (b.rating ?? 0) > 0)
    .sort((a, b) =>
      (b.rating ?? 0) - (a.rating ?? 0) ||
      (b.cuppingAverage ?? 0) - (a.cuppingAverage ?? 0) ||
      b.brewedAt.localeCompare(a.brewedAt),
    )[0]
  const bestVisit = [...yv]
    .filter(v => (v.rating ?? 0) > 0)
    .sort((a, b) =>
      (b.rating ?? 0) - (a.rating ?? 0) ||
      (b.cuppingAverage ?? 0) - (a.cuppingAverage ?? 0) ||
      b.visitedAt.localeCompare(a.visitedAt),
    )[0]

  let best: YearStats['best'] = null
  const brewRating = bestBrew?.rating ?? 0
  const visitRating = bestVisit?.rating ?? 0
  if (brewRating > 0 && brewRating >= visitRating) {
    best = {
      name: (bestBrew.beanId ? beanMap.get(bestBrew.beanId)?.name : undefined)
        ?? (bestBrew.method === 'drip_bag' ? '銘柄なし' : 'ホームブリュー'),
      rating: brewRating,
      month: monthOf(bestBrew.brewedAt) + 1,
    }
  } else if (visitRating > 0) {
    best = {
      name: bestVisit.drinkName ?? bestVisit.cafeName,
      rating: visitRating,
      month: monthOf(bestVisit.visitedAt) + 1,
    }
  }

  return {
    year,
    cups: yb.length + yv.length,
    homeCups: yb.length,
    cafeCups: yv.length,
    doseSumG: Math.round(yb.reduce((s, b) => s + (b.doseG ?? 0), 0)),
    originCount: origins.size,
    spend: yv.reduce((s, v) => s + (v.price ?? 0), 0),
    avgRating: ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
    monthlyCups,
    tracks,
    best,
  }
}

/** 豆の消費量の表示（1kg以上は kg に丸める） */
export function formatDose(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(1)}kg` : `${g}g`
}
