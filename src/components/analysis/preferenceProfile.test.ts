import { describe, expect, it } from 'vitest'
import type { Bean, Brew, CafeVisit, CuppingScores } from '../../db'
import {
  calcPreferenceProfile, changeMessage, collectTasteSamples, currentPreference, decayWeight,
  type TasteSample,
} from './preferenceProfile'

const NOW = new Date('2026-10-27T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const daysAgo = (d: number) => NOW.getTime() - d * DAY

const BITTER: CuppingScores = { acidity: 1.5, bitterness: 4.5, body: 3 }
const ACIDIC: CuppingScores = { acidity: 4.5, bitterness: 1.5, body: 3 }

const sample = (ageDays: number, rating: number, cupping: CuppingScores, extra: Partial<TasteSample> = {}): TasteSample =>
  ({ at: daysAgo(ageDays), rating, cupping, ...extra })

// 以前（40〜60日前）は苦い一杯を高く・酸っぱい一杯を低く評価し、最近（1〜10日前）はその逆
const shiftingData: TasteSample[] = [
  ...[40, 45, 50, 55, 60].map(d => sample(d, 5, BITTER)),
  ...[42, 47, 52, 57, 62].map(d => sample(d, 2, ACIDIC)),
  ...[1, 3, 5, 7, 9].map(d => sample(d, 5, ACIDIC)),
  ...[2, 4, 6, 8, 10].map(d => sample(d, 2, BITTER)),
]

describe('collectTasteSamples', () => {
  const bean: Bean = { id: 'b1', name: 'イルガ', origin: 'エチオピア イルガチェフェ', process: 'ウォッシュト', roastLevel: 'light', createdAt: '' }
  const brew = (rating: number | undefined, cupping: CuppingScores): Brew => ({
    id: Math.random().toString(), beanId: 'b1', rating, cupping, flavors: [],
    brewedAt: '2026-10-20T00:00:00.000Z', createdAt: '',
  })
  const visit = (rating: number | undefined, cupping?: CuppingScores): CafeVisit => ({
    id: Math.random().toString(), cafeName: 'X', rating, cupping, flavors: [],
    beanOrigin: 'ケニア', visitedAt: '2026-10-21T00:00:00.000Z', createdAt: '',
  })

  it('星とカッピングがそろった記録だけを、抽出・カフェの両方から集める', () => {
    const samples = collectTasteSamples(
      [brew(4, { acidity: 4 }), brew(undefined, { acidity: 4 }), brew(5, {})],
      [visit(3, { body: 2 }), visit(5), visit(undefined, { body: 2 })],
      [bean],
    )
    expect(samples).toHaveLength(2)
  })

  it('抽出記録は豆から焙煎度・国・精製を、カフェ記録は産地から国だけを取る', () => {
    const [b, v] = collectTasteSamples([brew(4, { acidity: 4 })], [visit(4, { body: 3 })], [bean])
    expect(b).toMatchObject({ roastLevel: 'light', country: 'エチオピア', process: 'ウォッシュト' })
    expect(v.country).toBe('ケニア')
    expect(v.roastLevel).toBeUndefined()
  })
})

describe('decayWeight', () => {
  it('半減期で重みが半分になる', () => {
    expect(decayWeight(0, 30)).toBe(1)
    expect(decayWeight(30, 30)).toBeCloseTo(0.5)
    expect(decayWeight(60, 30)).toBeCloseTo(0.25)
  })

  it('未来の日付は 1 として扱う', () => {
    expect(decayWeight(-5, 30)).toBe(1)
  })
})

describe('calcPreferenceProfile', () => {
  it('苦味の高評価 → 酸味の高評価への変化を検出する', () => {
    const p = calcPreferenceProfile(shiftingData, NOW)
    expect(p.enough).toBe(true)
    expect(p.before.count).toBe(10)
    expect(p.recent.count).toBe(10)
    expect(p.recent.scores.acidity!).toBeGreaterThan(p.before.scores.acidity!)
    expect(p.leading?.key).toBe('acidity')
    expect(p.changes.map(c => c.key).sort()).toEqual(['acidity', 'bitterness'])
    expect(changeMessage(p.leading!)).toBe('最近、酸味のあるコーヒーを高く評価する傾向に変わってきています')
  })

  it('同じ傾向が続いていれば変化と判定しない', () => {
    const beforeOnly = shiftingData.filter(s => s.at <= daysAgo(30))
    // 以前の記録を 35 日ずらして「最近」にも同じ傾向を作る
    const stable = beforeOnly.concat(beforeOnly.map(s => ({ ...s, at: s.at + 35 * DAY })))
    const p = calcPreferenceProfile(stable, NOW)
    expect(p.changes).toEqual([])
    expect(p.leading).toBeNull()
  })

  it('どちらかの期間が最低件数に満たなければ判定しない', () => {
    const fewRecent = shiftingData.filter(s => s.at <= daysAgo(30)).concat(shiftingData.filter(s => s.at > daysAgo(30)).slice(0, 4))
    const p = calcPreferenceProfile(fewRecent, NOW)
    expect(p.recent.count).toBe(4)
    expect(p.changes).toEqual([])
  })

  it('全体が最低件数に満たなければ enough=false', () => {
    const p = calcPreferenceProfile(shiftingData.slice(0, 4), NOW)
    expect(p.enough).toBe(false)
  })

  it('差がしきい値ちょうどなら変化とみなす', () => {
    const data = [
      ...[40, 41, 42, 43, 44].map(d => sample(d, 4, { acidity: 3 })),
      ...[1, 2, 3, 4, 5].map(d => sample(d, 4, { acidity: 3.5 })),
    ]
    expect(calcPreferenceProfile(data, NOW).changes).toEqual([{ key: 'acidity', diff: 0.5 }])
    expect(calcPreferenceProfile(data, NOW, { changeThreshold: 0.6 }).changes).toEqual([])
  })

  it('下がった軸しかなければ、控えめな方向の文章にする', () => {
    const data = [
      ...[40, 41, 42, 43, 44].map(d => sample(d, 4, { bitterness: 4 })),
      ...[1, 2, 3, 4, 5].map(d => sample(d, 4, { bitterness: 2 })),
    ]
    const p = calcPreferenceProfile(data, NOW)
    expect(p.leading).toEqual({ key: 'bitterness', diff: -2 })
    expect(changeMessage(p.leading!)).toBe('最近、苦味の控えめなコーヒーを高く評価する傾向に変わってきています')
  })

  it('お気に入りの要約は最近の★4以上から、2件以上ある値だけを出す', () => {
    const data = [
      sample(1, 5, ACIDIC, { roastLevel: 'light', country: 'エチオピア', process: 'ウォッシュト' }),
      sample(2, 4, ACIDIC, { roastLevel: 'light', country: 'エチオピア', process: 'ナチュラル' }),
      sample(3, 4, ACIDIC, { roastLevel: 'medium', country: 'ケニア' }),
      sample(4, 2, BITTER, { roastLevel: 'dark', country: 'ブラジル' }),
      sample(5, 2, BITTER, { roastLevel: 'dark', country: 'ブラジル' }),
      sample(50, 5, BITTER, { roastLevel: 'dark', country: 'ブラジル' }), // 以前の記録は使わない
    ]
    expect(calcPreferenceProfile(data, NOW).favorites).toEqual({
      roastLevel: 'light', country: 'エチオピア', process: undefined,
    })
  })
})

describe('currentPreference', () => {
  it('よく飲んだ味と好きな味を区別する（低評価の酸っぱい一杯が多くても、好みの方向は苦味）', () => {
    const data = [
      ...[1, 2, 3, 4, 5, 6, 7, 8].map(d => sample(d, 2, ACIDIC)),
      ...[1, 2].map(d => sample(d, 5, BITTER)),
    ]
    const cur = currentPreference(data, NOW)!
    expect(cur.direction.bitterness!).toBeGreaterThan(0)
    expect(cur.direction.acidity!).toBeLessThan(0)
  })

  it('新しい記録ほど強く効く', () => {
    const data = [
      ...[0, 0, 0, 0, 0].map(d => sample(d, 4, { acidity: 5 })),
      ...[90, 90, 90, 90, 90].map(d => sample(d, 4, { acidity: 1 })),
    ]
    // 90日前は重み 1/8。単純平均なら 3 になるところ、新しい側に寄る
    expect(currentPreference(data, NOW)!.scores.acidity!).toBeCloseTo((5 * 1 + 1 * 0.125) / 1.125)
  })

  it('最低件数に満たなければ null', () => {
    expect(currentPreference(shiftingData.slice(0, 4), NOW)).toBeNull()
  })
})
