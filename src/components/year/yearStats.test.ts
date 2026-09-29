import { describe, expect, it } from 'vitest'
import type { Bean, Brew, CafeVisit } from '../../db'
import { calcYearStats, formatDose, listRecordedYears } from './yearStats'

const bean = (id: string, name: string, origin?: string): Bean => ({
  id, name, origin, roastLevel: 'medium', createdAt: '2026-01-01T00:00:00.000Z',
})

const brew = (over: Partial<Brew> & { brewedAt: string }): Brew => ({
  id: over.brewedAt + Math.random(),
  flavors: [],
  cupping: {},
  createdAt: over.brewedAt,
  ...over,
})

const visit = (over: Partial<CafeVisit> & { visitedAt: string }): CafeVisit => ({
  id: over.visitedAt + Math.random(),
  cafeName: 'どこかのカフェ',
  flavors: [],
  createdAt: over.visitedAt,
  ...over,
})

// ローカル時刻で年・月を作る（集計もローカル基準）
const at = (y: number, m: number, d = 15) => new Date(y, m - 1, d, 10, 0, 0).toISOString()

const beans = new Map([
  ['b1', bean('b1', 'エチオピア イルガチェフェ', 'エチオピア')],
  ['b2', bean('b2', 'ケニア ニエリAA', 'ケニア')],
])

describe('listRecordedYears', () => {
  it('記録のある年を新しい順に返す', () => {
    const years = listRecordedYears(
      [{ brewedAt: at(2024, 5) }, { brewedAt: at(2026, 1) }],
      [{ visitedAt: at(2025, 8) }],
    )
    expect(years).toEqual([2026, 2025, 2024])
  })

  it('同じ年は1つにまとめる', () => {
    expect(listRecordedYears([{ brewedAt: at(2026, 1) }, { brewedAt: at(2026, 9) }], [])).toEqual([2026])
  })

  it('記録が無ければ空', () => {
    expect(listRecordedYears([], [])).toEqual([])
  })
})

describe('calcYearStats', () => {
  const brews = [
    brew({ brewedAt: at(2026, 1), beanId: 'b1', doseG: 15, rating: 5 }),
    brew({ brewedAt: at(2026, 1), beanId: 'b1', doseG: 15, rating: 3 }),
    brew({ brewedAt: at(2026, 3), beanId: 'b2', doseG: 18 }),          // 未評価
    brew({ brewedAt: at(2025, 12), beanId: 'b1', doseG: 99, rating: 5 }), // 前年
  ]
  const visits = [
    visit({ visitedAt: at(2026, 2), rating: 4, price: 600, beanOrigin: 'グアテマラ' }),
    visit({ visitedAt: at(2025, 6), rating: 5, price: 9999 }),          // 前年
  ]

  const s = calcYearStats(brews, visits, beans, 2026)

  it('その年の記録だけを数える', () => {
    expect(s.cups).toBe(4)      // ブリュー3＋カフェ1
    expect(s.homeCups).toBe(3)
    expect(s.cafeCups).toBe(1)
    expect(s.doseSumG).toBe(48) // 15+15+18（前年の99は入らない）
    expect(s.spend).toBe(600)
  })

  it('杯数には未評価も数え、平均は評価済みだけで割る', () => {
    // 評価は 5, 3, 4 の3件（未評価のブリューは平均に入らない）
    expect(s.avgRating).toBe(4)
  })

  it('産地はブリューとカフェの両方から数える', () => {
    expect(s.originCount).toBe(3) // エチオピア・ケニア・グアテマラ
  })

  it('月別の杯数を1月から並べる', () => {
    expect(s.monthlyCups).toHaveLength(12)
    expect(s.monthlyCups[0]).toBe(2) // 1月のブリュー2件
    expect(s.monthlyCups[1]).toBe(1) // 2月のカフェ1件
    expect(s.monthlyCups[2]).toBe(1) // 3月のブリュー1件
    expect(s.monthlyCups.reduce((a, b) => a + b, 0)).toBe(s.cups)
  })

  it('よく飲んだ豆を多い順に返す', () => {
    expect(s.tracks[0]).toEqual({ name: 'エチオピア イルガチェフェ', count: 2 })
    expect(s.tracks[1]).toEqual({ name: 'ケニア ニエリAA', count: 1 })
  })

  it('ベストの一杯はその年の最高評価', () => {
    expect(s.best).toEqual({ name: 'エチオピア イルガチェフェ', rating: 5, month: 1 })
  })

  it('記録が無い年でも壊れない', () => {
    const empty = calcYearStats(brews, visits, beans, 2020)
    expect(empty.cups).toBe(0)
    expect(empty.avgRating).toBeNull()
    expect(empty.best).toBeNull()
    expect(empty.tracks).toEqual([])
    expect(empty.monthlyCups).toEqual(Array(12).fill(0))
  })

  it('評価が1件も無い年は平均もベストも無し', () => {
    const only = [brew({ brewedAt: at(2023, 4), beanId: 'b1', doseG: 10 })]
    const r = calcYearStats(only, [], beans, 2023)
    expect(r.cups).toBe(1)
    expect(r.avgRating).toBeNull()
    expect(r.best).toBeNull()
  })

  it('カフェの一杯が最高評価ならそれをベストにする', () => {
    const r = calcYearStats(
      [brew({ brewedAt: at(2027, 1), beanId: 'b1', rating: 3 })],
      [visit({ visitedAt: at(2027, 2), rating: 5, drinkName: 'ゲイシャ' })],
      beans, 2027,
    )
    expect(r.best).toEqual({ name: 'ゲイシャ', rating: 5, month: 2 })
  })
})

describe('formatDose', () => {
  it('1kg未満はグラム', () => {
    expect(formatDose(480)).toBe('480g')
  })

  it('1kg以上はキログラムに丸める', () => {
    expect(formatDose(1500)).toBe('1.5kg')
    expect(formatDose(1000)).toBe('1.0kg')
  })
})
