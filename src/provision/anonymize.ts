// 匿名化エンジン: 記録データからスコープに応じた提供レコードを生成する純関数群。
//
// 常に除外されるもの（スコープに関わらず送信不可能）:
//   写真（photoDataUrl）・自由記述メモ・正確な時刻（日付単位に丸め）・
//   豆の名前・カフェ名・器具の名前/メーカー・カフェイン/就寝設定

import type { Brew, Bean, Equipment, CafeVisit, CuppingScores } from '../db'
import type {
  DataScope, ProvisionRecord, ProvisionBrewRecord, ProvisionCafeRecord, MonthlyStat,
} from './types'

function toDateOnly(iso: string): string {
  const d = new Date(iso)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function toMonth(iso: string): string {
  return toDateOnly(iso).slice(0, 7)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// カッピングから値の入っている軸だけを抽出
function pickCupping(cupping: CuppingScores | undefined): Record<string, number> | undefined {
  if (!cupping) return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(cupping)) {
    if (typeof v === 'number') out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export interface SourceData {
  brews: Brew[]
  beans: Bean[]
  equipment: Equipment[]
  visits: CafeVisit[]
}

export function anonymizeBrew(
  brew: Brew,
  scopes: DataScope[],
  beanMap: Map<string, Bean>,
  equipmentMap: Map<string, Equipment>,
): ProvisionBrewRecord {
  const record: ProvisionBrewRecord = {
    type: 'brew',
    date: toDateOnly(brew.brewedAt),
  }

  if (scopes.includes('brew.params')) {
    record.params = {
      doseG: brew.doseG,
      waterG: brew.waterG,
      ratio: brew.doseG && brew.waterG ? round1(brew.waterG / brew.doseG) : undefined,
      grindSize: brew.grindSize,
      tempC: brew.tempC,
      totalTimeSec: brew.totalTimeSec,
      pourCount: brew.pourCount,
      equipmentType: brew.equipmentId ? equipmentMap.get(brew.equipmentId)?.type : undefined,
    }
  }

  if (scopes.includes('brew.rating')) {
    record.rating = {
      stars: brew.rating,
      cupping: pickCupping(brew.cupping),
      flavors: brew.flavors.length > 0 ? brew.flavors : undefined,
    }
  }

  if (scopes.includes('bean.master') && brew.beanId) {
    const bean = beanMap.get(brew.beanId)
    if (bean) {
      record.bean = {
        origin: bean.origin,
        variety: bean.variety,
        process: bean.process,
        roastLevel: bean.roastLevel,
        daysSinceRoast: bean.roastedAt
          ? Math.max(0, Math.floor(
              (new Date(brew.brewedAt).getTime() - new Date(bean.roastedAt).getTime()) / 86_400_000,
            ))
          : undefined,
      }
    }
  }

  return record
}

export function anonymizeCafeVisit(visit: CafeVisit): ProvisionCafeRecord {
  return {
    type: 'cafe',
    date: toDateOnly(visit.visitedAt),
    drinkType: visit.drinkType,
    size: visit.size,
    stars: visit.rating,
    cupping: pickCupping(visit.cupping),
    flavors: visit.flavors.length > 0 ? visit.flavors : undefined,
    priceBand: visit.price !== undefined ? Math.round(visit.price / 100) * 100 : undefined,
    beanOrigin: visit.beanOrigin,
  }
}

export function buildMonthlyStats(brews: Brew[], visits: CafeVisit[]): MonthlyStat[] {
  const map = new Map<string, { brew: number; cafe: number; ratings: number[] }>()

  for (const b of brews) {
    const m = toMonth(b.brewedAt)
    const cur = map.get(m) ?? { brew: 0, cafe: 0, ratings: [] }
    cur.brew++
    if (b.rating) cur.ratings.push(b.rating)
    map.set(m, cur)
  }
  for (const v of visits) {
    const m = toMonth(v.visitedAt)
    const cur = map.get(m) ?? { brew: 0, cafe: 0, ratings: [] }
    cur.cafe++
    if (v.rating) cur.ratings.push(v.rating)
    map.set(m, cur)
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { brew, cafe, ratings }]) => ({
      month,
      brewCups: brew,
      cafeCups: cafe,
      avgRating: ratings.length > 0
        ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length)
        : undefined,
    }))
}

// スコープと期間から提供レコード一式を生成する
export function buildProvisionRecords(
  scopes: DataScope[],
  data: SourceData,
  period: { from: string; to: string },
): { records: ProvisionRecord[]; monthlyStats?: MonthlyStat[] } {
  const inPeriod = (iso: string) => {
    const d = toDateOnly(iso)
    return d >= period.from && d <= period.to
  }

  const brews  = data.brews.filter(b => inPeriod(b.brewedAt))
  const visits = data.visits.filter(v => inPeriod(v.visitedAt))

  const records: ProvisionRecord[] = []

  const includeBrews = scopes.some(s => s === 'brew.params' || s === 'brew.rating' || s === 'bean.master')
  if (includeBrews) {
    const beanMap = new Map(data.beans.map(b => [b.id, b]))
    const equipmentMap = new Map(data.equipment.map(e => [e.id, e]))
    for (const brew of brews) {
      records.push(anonymizeBrew(brew, scopes, beanMap, equipmentMap))
    }
  }

  if (scopes.includes('cafe.visits')) {
    for (const visit of visits) {
      records.push(anonymizeCafeVisit(visit))
    }
  }

  return {
    records,
    monthlyStats: scopes.includes('stats.monthly')
      ? buildMonthlyStats(brews, visits)
      : undefined,
  }
}
