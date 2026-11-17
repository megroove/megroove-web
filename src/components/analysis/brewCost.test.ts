import { describe, expect, it } from 'vitest'
import type { Bean, Brew, CafeVisit } from '../../db'
import { beanYenPerGram, brewCostYen, cafeCostAverage, formatYen, homeCostAverage } from './brewCost'

const bean = (o: Partial<Bean> = {}): Bean =>
  ({ id: 'b1', name: '豆', roastLevel: 'medium', createdAt: '2026-11-01T00:00:00Z', priceYen: 1800, initialAmountG: 200, ...o })
const brew = (o: Partial<Brew> = {}): Brew =>
  ({ id: 'r1', brewedAt: '2026-11-02T08:00:00Z', beanId: 'b1', doseG: 15, ...o } as Brew)

describe('brewCostYen', () => {
  it('袋の値段 × 粉量 ÷ 内容量', () => {
    expect(beanYenPerGram(bean())).toBe(9)
    expect(brewCostYen(brew(), bean())).toBe(135)
  })
  it('値段・内容量・粉量のどれかが無い、または不正なら出さない', () => {
    expect(brewCostYen(brew(), bean({ priceYen: undefined }))).toBeNull()
    expect(brewCostYen(brew(), bean({ initialAmountG: 0 }))).toBeNull()
    expect(brewCostYen(brew(), bean({ priceYen: -100 }))).toBeNull()
    expect(brewCostYen(brew(), bean({ priceYen: Number.NaN }))).toBeNull()
    expect(brewCostYen(brew({ doseG: undefined }), bean())).toBeNull()
    expect(brewCostYen(brew(), undefined)).toBeNull()
  })
  it('ドリップバッグは対象外', () => {
    expect(brewCostYen(brew({ method: 'drip_bag' }), bean())).toBeNull()
  })
})

describe('homeCostAverage', () => {
  it('計算できる記録だけで割る', () => {
    const beans = new Map([['b1', bean()], ['b2', bean({ id: 'b2', priceYen: undefined })]])
    const r = homeCostAverage(
      [brew(), brew({ id: 'r2', doseG: 20 }), brew({ id: 'r3', beanId: 'b2' }), brew({ id: 'r4', method: 'drip_bag' })],
      id => beans.get(id),
    )
    expect(r).toEqual({ avgYen: Math.round((135 + 180) / 2), count: 2 })
  })
  it('1件も無ければ null', () => {
    expect(homeCostAverage([], () => undefined)).toEqual({ avgYen: null, count: 0 })
  })
})

describe('cafeCostAverage', () => {
  it('価格を入れた記録だけで割る', () => {
    const v = (price?: number) => ({ id: String(price), visitedAt: '', cafeName: 'x', price } as CafeVisit)
    expect(cafeCostAverage([v(500), v(600), v(undefined), v(0)])).toEqual({ avgYen: 550, count: 2 })
  })
})

describe('formatYen', () => {
  it('四捨五入して桁区切り、1円未満は別の言い方', () => {
    expect(formatYen(134.6)).toBe('約135円')
    expect(formatYen(1234)).toBe('約1,234円')
    expect(formatYen(0.4)).toBe('1円未満')
  })
})
