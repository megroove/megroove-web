import { describe, expect, it } from 'vitest'
import type { Bean, Brew } from '../../db'
import { beanBagNumber, beanBagsOf, beanLineageId, currentBagId } from '../../db'
import { calcRepeatBeans } from './repeatBeans'

const bag = (id: string, name: string, purchasedAt: string, lineageId?: string): Bean => ({
  id, name, purchasedAt, lineageId, roastLevel: 'medium',
  createdAt: `${purchasedAt}T00:00:00.000Z`,
})

const brew = (beanId: string, rating?: number): Brew => ({
  id: beanId + Math.random(), beanId, rating,
  brewedAt: '2026-05-01T00:00:00.000Z', createdAt: '2026-05-01T00:00:00.000Z',
  flavors: [], cupping: {},
})

describe('beanLineageId', () => {
  it('lineageId が無ければ自分の id が系統ID（既存データは1袋目として成立する）', () => {
    expect(beanLineageId({ id: 'b1' })).toBe('b1')
  })

  it('lineageId があればそれを使う', () => {
    expect(beanLineageId({ id: 'b2', lineageId: 'b1' })).toBe('b1')
  })
})

describe('beanBagsOf / beanBagNumber', () => {
  const b1 = bag('b1', 'イルガチェフェ', '2026-01-10')
  const b2 = bag('b2', 'イルガチェフェ', '2026-03-01', 'b1')
  const b3 = bag('b3', 'イルガチェフェ', '2026-05-20', 'b1')
  const other = bag('x1', '別の豆', '2026-02-01')
  const beans = [b3, other, b1, b2] // 順不同で渡す

  it('同じ系統の袋を買った順に並べる', () => {
    expect(beanBagsOf(b2, beans).map(b => b.id)).toEqual(['b1', 'b2', 'b3'])
  })

  it('別の系統は混ざらない', () => {
    expect(beanBagsOf(other, beans).map(b => b.id)).toEqual(['x1'])
  })

  it('何袋目かを返す', () => {
    expect(beanBagNumber(b1, beans)).toBe(1)
    expect(beanBagNumber(b2, beans)).toBe(2)
    expect(beanBagNumber(b3, beans)).toBe(3)
    expect(beanBagNumber(other, beans)).toBe(1)
  })

  it('購入日が無い袋は登録日で並ぶ', () => {
    const noDate: Bean = {
      id: 'n1', name: 'イルガチェフェ', lineageId: 'b1', roastLevel: 'medium',
      createdAt: '2026-02-15T00:00:00.000Z',
    }
    expect(beanBagsOf(noDate, [b1, b2, noDate]).map(b => b.id)).toEqual(['b1', 'n1', 'b2'])
  })
})

describe('currentBagId', () => {
  const finished = (b: Bean): Bean => ({ ...b, finishedAt: '2026-04-01T00:00:00.000Z' })
  const b1 = bag('b1', 'イルガチェフェ', '2026-01-10')
  const b2 = bag('b2', 'イルガチェフェ', '2026-03-01', 'b1')

  it('飲み切った袋は、開いている最新の袋に付け替える', () => {
    expect(currentBagId('b1', [finished(b1), b2])).toBe('b2')
  })

  it('まだ開いている袋はそのまま（二袋並行で勝手に乗り換えない）', () => {
    expect(currentBagId('b1', [b1, b2])).toBe('b1')
  })

  it('全部飲み切っていたらそのまま（記録は残す）', () => {
    expect(currentBagId('b1', [finished(b1), finished(b2)])).toBe('b1')
  })

  it('買い直していない豆はそのまま', () => {
    const only = bag('s1', '一度だけの豆', '2026-02-10')
    expect(currentBagId('s1', [finished(only)])).toBe('s1')
  })

  it('豆が見つからない・未指定なら触らない', () => {
    expect(currentBagId('unknown', [b1])).toBe('unknown')
    expect(currentBagId(undefined, [b1])).toBeUndefined()
  })
})

describe('calcRepeatBeans', () => {
  const b1 = bag('b1', 'イルガチェフェ', '2026-01-10')
  const b2 = bag('b2', 'イルガチェフェ', '2026-03-01', 'b1')
  const b3 = bag('b3', 'イルガチェフェ', '2026-05-20', 'b1')
  const c1 = bag('c1', 'ブラジル', '2026-02-01')
  const c2 = bag('c2', 'ブラジル', '2026-04-01', 'c1')
  const single = bag('s1', '一度だけの豆', '2026-02-10')
  const beans = [b1, b2, b3, c1, c2, single]
  const brews = [
    brew('b1', 5), brew('b1', 4), brew('b2', 3), brew('b3'),
    brew('c1', 4), brew('c2', 4),
    brew('s1', 5), brew('s1', 5),
  ]
  const r = calcRepeatBeans(beans, brews)

  it('2袋以上の豆だけを返す', () => {
    expect(r.map(x => x.bean.name)).toEqual(['イルガチェフェ', 'ブラジル'])
  })

  it('袋数の多い順に並ぶ', () => {
    expect(r[0].bags).toBe(3)
    expect(r[1].bags).toBe(2)
  })

  it('代表は最新の袋', () => {
    expect(r[0].bean.id).toBe('b3')
    expect(r[1].bean.id).toBe('c2')
  })

  it('杯数は全袋の合計（未評価も数える）', () => {
    expect(r[0].cups).toBe(4) // b1×2 + b2 + b3(未評価)
    expect(r[1].cups).toBe(2)
  })

  it('平均は評価済みだけで割る', () => {
    expect(r[0].avgRating).toBe(4) // (5+4+3)/3
    expect(r[1].avgRating).toBe(4)
  })

  it('系統を重複して数えない（どの袋から見ても1件）', () => {
    expect(r).toHaveLength(2)
  })

  it('評価が無ければ平均は null', () => {
    const only = calcRepeatBeans([b1, b2], [brew('b1'), brew('b2')])
    expect(only[0].avgRating).toBeNull()
    expect(only[0].cups).toBe(2)
  })

  it('記録も豆も無くても壊れない', () => {
    expect(calcRepeatBeans([], [])).toEqual([])
    expect(calcRepeatBeans([single], [])).toEqual([])
  })
})
