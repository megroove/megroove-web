import { describe, expect, it } from 'vitest'
import type { Bean, Brew, CafeVisit } from '../../db'
import { calcPassport, isNewCountry, listBeansMissingOrigin, toCountry } from './passportStats'

const bean = (id: string, name: string, origin?: string): Bean => ({
  id, name, origin, roastLevel: 'medium', createdAt: '2026-01-01T00:00:00.000Z',
})

const brew = (over: Partial<Brew> & { brewedAt: string }): Brew => ({
  id: over.brewedAt + Math.random(), flavors: [], cupping: {}, createdAt: over.brewedAt, ...over,
})

const visit = (over: Partial<CafeVisit> & { visitedAt: string }): CafeVisit => ({
  id: over.visitedAt + Math.random(), cafeName: 'どこかのカフェ', flavors: [],
  createdAt: over.visitedAt, ...over,
})

describe('toCountry', () => {
  it('国名そのものはそのまま返す', () => {
    expect(toCountry('エチオピア')).toBe('エチオピア')
  })

  it('地域付きの入力から国名を取り出す', () => {
    expect(toCountry('エチオピア イルガチェフェ')).toBe('エチオピア')
    expect(toCountry('コロンビア ウイラ')).toBe('コロンビア')
    expect(toCountry('中国 雲南')).toBe('中国')
  })

  it('長い国名を短い国名より優先する', () => {
    // 「コンゴ民主共和国」が「コンゴ」で切られないこと
    expect(toCountry('コンゴ民主共和国')).toBe('コンゴ民主共和国')
  })

  it('前後の空白を無視する', () => {
    expect(toCountry('  ケニア ニエリ  ')).toBe('ケニア')
  })

  it('マスターに無い書き方は null', () => {
    expect(toCountry('よく分からない産地')).toBeNull()
    expect(toCountry('')).toBeNull()
    expect(toCountry(undefined)).toBeNull()
  })
})

describe('calcPassport', () => {
  const beans = [
    bean('b1', '豆A', 'エチオピア イルガチェフェ'),
    bean('b2', '豆B', 'エチオピア シダモ'),
    bean('b3', '豆C', 'ケニア'),
    bean('b4', '豆D'),                  // 産地なし
    bean('b5', '豆E', '謎の産地'),       // マスター外
  ]
  const brews = [
    brew({ brewedAt: '2026-03-01T09:00:00.000Z', beanId: 'b1', rating: 5 }),
    brew({ brewedAt: '2026-02-01T09:00:00.000Z', beanId: 'b2', rating: 3 }),
    brew({ brewedAt: '2026-04-01T09:00:00.000Z', beanId: 'b3' }),        // 未評価
    brew({ brewedAt: '2026-04-02T09:00:00.000Z', beanId: 'b4' }),        // 産地なし
    brew({ brewedAt: '2026-04-03T09:00:00.000Z', beanId: 'b5' }),        // マスター外
  ]
  const visits = [visit({ visitedAt: '2026-05-01T09:00:00.000Z', beanOrigin: 'ブラジル', rating: 4 })]

  const p = calcPassport(brews, beans, visits)

  it('地域違いを同じ国のスタンプにまとめる', () => {
    const et = p.stamps.find(s => s.country === 'エチオピア')!
    expect(et.count).toBe(2)
    expect(et.regions).toEqual(['エチオピア イルガチェフェ', 'エチオピア シダモ'])
  })

  it('杯数には未評価も数え、平均は評価済みだけで割る', () => {
    expect(p.stamps.find(s => s.country === 'エチオピア')!.avgRating).toBe(4) // (5+3)/2
    expect(p.stamps.find(s => s.country === 'ケニア')!.avgRating).toBeNull()  // 未評価のみ
    expect(p.stamps.find(s => s.country === 'ケニア')!.count).toBe(1)
  })

  it('カフェ記録の産地も数える', () => {
    expect(p.stamps.find(s => s.country === 'ブラジル')!.count).toBe(1)
  })

  it('最初に記録した日を持つ', () => {
    expect(p.stamps.find(s => s.country === 'エチオピア')!.firstAt).toBe('2026-02-01T09:00:00.000Z')
  })

  it('マスターに無い産地は別枠にまとめ、スタンプにはしない', () => {
    expect(p.unknownOrigins).toEqual(['謎の産地'])
    expect(p.stamps.some(s => s.country === '謎の産地')).toBe(false)
  })

  it('大陸ごとに進捗を出し、未踏を列挙する', () => {
    const africa = p.byContinent.find(c => c.continent === 'アフリカ')!
    expect(africa.visited).toBe(2)            // エチオピア・ケニア
    expect(africa.total).toBeGreaterThan(2)
    expect(africa.unvisited).toContain('ルワンダ')
    expect(africa.unvisited).not.toContain('エチオピア')
  })

  it('出会った国の数と総数を返す', () => {
    expect(p.visitedCount).toBe(3)            // エチオピア・ケニア・ブラジル
    expect(p.totalCountries).toBeGreaterThan(40)
  })

  it('記録が無くても壊れない', () => {
    const empty = calcPassport([], [], [])
    expect(empty.visitedCount).toBe(0)
    expect(empty.stamps).toEqual([])
    expect(empty.byContinent.every(c => c.visited === 0)).toBe(true)
  })
})

describe('listBeansMissingOrigin', () => {
  it('記録に使われていて産地が未登録の豆だけを返す', () => {
    const beans = [
      bean('b1', '産地あり', 'ケニア'),
      bean('b2', '産地なし・使用あり'),
      bean('b3', '産地なし・未使用'),
    ]
    const brews = [
      brew({ brewedAt: '2026-01-01T00:00:00.000Z', beanId: 'b1' }),
      brew({ brewedAt: '2026-01-02T00:00:00.000Z', beanId: 'b2' }),
      brew({ brewedAt: '2026-01-03T00:00:00.000Z', beanId: 'b2' }),
    ]
    const r = listBeansMissingOrigin(brews, beans)
    expect(r).toHaveLength(1)
    expect(r[0].bean.id).toBe('b2')
    expect(r[0].count).toBe(2)
  })

  it('空白だけの産地は未登録として扱う', () => {
    const beans = [bean('b1', '空白', '   ')]
    const brews = [brew({ brewedAt: '2026-01-01T00:00:00.000Z', beanId: 'b1' })]
    expect(listBeansMissingOrigin(brews, beans)).toHaveLength(1)
  })
})

describe('isNewCountry', () => {
  const beans = [bean('b1', '豆A', 'エチオピア イルガチェフェ')]
  const brews = [brew({ brewedAt: '2026-01-01T00:00:00.000Z', beanId: 'b1' })]

  it('すでに記録のある国なら null', () => {
    expect(isNewCountry('エチオピア シダモ', brews, beans, [])).toBeNull()
  })

  it('はじめての国なら国名を返す', () => {
    expect(isNewCountry('ケニア ニエリ', brews, beans, [])).toBe('ケニア')
  })

  it('マスターに無い産地では祝わない', () => {
    expect(isNewCountry('謎の産地', brews, beans, [])).toBeNull()
  })

  it('産地が無ければ null', () => {
    expect(isNewCountry(undefined, brews, beans, [])).toBeNull()
  })
})
