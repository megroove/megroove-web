import { describe, expect, it } from 'vitest'
import type { Bean, Brew, CafeVisit } from '../../db'
import { calcPassport, listBeansMissingOrigin, newCountriesFor, toCountry } from './passportStats'

const bean = (id: string, name: string, origin?: string): Bean => ({
  id, name, origin, roastLevel: 'medium', createdAt: '2026-01-01T00:00:00.000Z',
})

/** ブレンド豆。origin は代表産地（先頭）、origins が構成産地 */
const blendBean = (id: string, name: string, origins: string[]): Bean => ({
  id, name, origin: origins[0], origins, roastLevel: 'medium', createdAt: '2026-01-01T00:00:00.000Z',
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

  it('スタンプに稀少度が乗る', () => {
    expect(p.stamps.find(s => s.country === 'エチオピア')!.rarity).toBe('bronze')
  })

  it('稀少度ごとの進捗を返す', () => {
    const bronze = p.byRarity.find(r => r.rarity === 'bronze')!
    expect(bronze.visited).toBe(3)          // エチオピア・ケニア・ブラジル
    expect(bronze.total).toBeGreaterThan(2)
    const platinum = p.byRarity.find(r => r.rarity === 'platinum')!
    expect(platinum.visited).toBe(0)
    expect(platinum.total).toBeGreaterThan(0)
    // 合計は全体と一致する
    expect(p.byRarity.reduce((n, r) => n + r.total, 0)).toBe(p.totalCountries)
    expect(p.byRarity.reduce((n, r) => n + r.visited, 0)).toBe(p.visitedCount)
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
    expect(empty.byRarity.every(r => r.visited === 0 && r.total > 0)).toBe(true)
  })
})

describe('calcPassport（ブレンド）', () => {
  const beans = [
    blendBean('b1', 'ハウスブレンド', ['ブラジル', 'コロンビア', 'エチオピア']),
    bean('b2', 'シングル', 'コロンビア ウイラ'),
  ]
  const brews = [
    brew({ brewedAt: '2026-03-01T09:00:00.000Z', beanId: 'b1', rating: 4 }),
    brew({ brewedAt: '2026-03-02T09:00:00.000Z', beanId: 'b2', rating: 5 }),
  ]
  const p = calcPassport(brews, beans, [])

  it('ブレンドの構成産地すべてにスタンプが付く', () => {
    expect(p.visitedCount).toBe(3) // ブラジル・コロンビア・エチオピア
    expect(p.stamps.map(s => s.country).sort()).toEqual(['エチオピア', 'コロンビア', 'ブラジル'])
  })

  it('ブレンドでだけ出会った国は single=false', () => {
    expect(p.stamps.find(s => s.country === 'ブラジル')!.single).toBe(false)
    expect(p.stamps.find(s => s.country === 'エチオピア')!.single).toBe(false)
  })

  it('シングルでも飲んだ国は single=true（ブレンドにも入っていても完成扱い）', () => {
    expect(p.stamps.find(s => s.country === 'コロンビア')!.single).toBe(true)
  })

  it('シングルで味わった国の数を内数で返す', () => {
    expect(p.singleCount).toBe(1)
    expect(p.visitedCount - p.singleCount).toBe(2)
  })

  it('1杯のブレンドは構成産地それぞれで1杯と数える', () => {
    expect(p.stamps.find(s => s.country === 'ブラジル')!.count).toBe(1)
    expect(p.stamps.find(s => s.country === 'コロンビア')!.count).toBe(2) // ブレンド＋シングル
  })

  it('カフェ記録はブレンド扱いにしない（店が構成を開示しないため）', () => {
    const r = calcPassport([], [], [visit({ visitedAt: '2026-05-01T09:00:00.000Z', beanOrigin: 'ケニア' })])
    expect(r.stamps.find(s => s.country === 'ケニア')!.single).toBe(true)
  })

  it('構成産地が1件だけならブレンド扱いしない', () => {
    const one = [blendBean('b9', 'ほぼシングル', ['ペルー'])]
    const r = calcPassport([brew({ brewedAt: '2026-01-01T00:00:00.000Z', beanId: 'b9' })], one, [])
    expect(r.stamps.find(s => s.country === 'ペルー')!.single).toBe(true)
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

describe('newCountriesFor', () => {
  const beans = [bean('b1', '豆A', 'エチオピア イルガチェフェ')]
  const brews = [brew({ brewedAt: '2026-01-01T00:00:00.000Z', beanId: 'b1' })]

  it('すでに記録のある国は返さない', () => {
    expect(newCountriesFor(['エチオピア シダモ'], brews, beans, [])).toEqual([])
  })

  it('はじめての国を返す', () => {
    expect(newCountriesFor(['ケニア ニエリ'], brews, beans, [])).toEqual(['ケニア'])
  })

  it('ブレンドでは複数の国を同時に返す', () => {
    expect(newCountriesFor(['ブラジル', 'コロンビア'], brews, beans, [])).toEqual(['ブラジル', 'コロンビア'])
  })

  it('既知の国とはじめての国が混ざっても、はじめてのぶんだけ返す', () => {
    expect(newCountriesFor(['エチオピア', 'ブラジル'], brews, beans, [])).toEqual(['ブラジル'])
  })

  it('同じ国を指す表記が重なっても1つにまとめる', () => {
    expect(newCountriesFor(['ブラジル セラード', 'ブラジル モジアナ'], brews, beans, [])).toEqual(['ブラジル'])
  })

  it('マスターに無い産地では祝わない', () => {
    expect(newCountriesFor(['謎の産地'], brews, beans, [])).toEqual([])
  })

  it('産地が無ければ空', () => {
    expect(newCountriesFor([], brews, beans, [])).toEqual([])
  })
})
