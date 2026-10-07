import { describe, expect, it } from 'vitest'
import type { Bean, Brew, Recipe } from '../../db'
import { buildQuickPresets } from './quickPresets'

const bag = (id: string, purchasedAt: string, lineageId?: string, finishedAt?: string): Bean => ({
  id, name: 'イルガチェフェ', purchasedAt, lineageId, finishedAt, roastLevel: 'medium',
  createdAt: `${purchasedAt}T00:00:00.000Z`,
})

const brew = (id: string, beanId: string, day: string, recipeId?: string): Brew => ({
  id, beanId, recipeId,
  brewedAt: `2026-05-${day}T00:00:00.000Z`, createdAt: `2026-05-${day}T00:00:00.000Z`,
  doseG: 15, waterG: 240, flavors: [], cupping: {},
})

const recipe = (id: string, name: string): Recipe => ({ id, name, createdAt: '2026-01-01T00:00:00.000Z' })

describe('buildQuickPresets', () => {
  it('記録が無ければプリセットを作らない', () => {
    expect(buildQuickPresets([], [recipe('r1', '朝の一杯')], [bag('b1', '2026-01-10')])).toEqual([])
  })

  it('前回と同じ1枚を作り、豆の実体を添える', () => {
    const b1 = bag('b1', '2026-01-10')
    const presets = buildQuickPresets([brew('x1', 'b1', '01')], [], [b1])
    expect(presets).toHaveLength(1)
    expect(presets[0].name).toBe('前回と同じ')
    expect(presets[0].beanId).toBe('b1')
    expect(presets[0].bean).toBe(b1)
  })

  // ここが本題: 買い直した直後にクイック記録すると、前の袋に残量と焙煎日数が積まれていた
  it('コピー元が飲み切った袋なら、開封中の新しい袋に付け替える', () => {
    const b1 = bag('b1', '2026-01-10', undefined, '2026-04-01T00:00:00.000Z')
    const b2 = bag('b2', '2026-04-02', 'b1')
    const presets = buildQuickPresets([brew('x1', 'b1', '01')], [], [b1, b2])
    expect(presets[0].beanId).toBe('b2')
    expect(presets[0].bean).toBe(b2)
    // コピー元の記録自体は書き換えない（その記録が実際に使った袋を保つ）
    expect(presets[0].brew.beanId).toBe('b1')
  })

  it('開封中の袋はそのまま使う（二袋並行で勝手に乗り換えない）', () => {
    const b1 = bag('b1', '2026-01-10')
    const b2 = bag('b2', '2026-04-02', 'b1')
    const presets = buildQuickPresets([brew('x1', 'b1', '01')], [], [b1, b2])
    expect(presets[0].beanId).toBe('b1')
  })

  it('よく使うレシピを足して3枚にする（新しく使った順）', () => {
    const b1 = bag('b1', '2026-01-10')
    const brews = [
      brew('x1', 'b1', '01', 'r3'), brew('x2', 'b1', '02', 'r3'), brew('x3', 'b1', '03', 'r3'),
      brew('x4', 'b1', '04', 'r2'), brew('x5', 'b1', '05', 'r2'), brew('x6', 'b1', '06', 'r2'),
      brew('x7', 'b1', '07', 'r1'), // 最後の記録 = r1
    ]
    const recipes = [recipe('r1', '朝の一杯'), recipe('r2', '深煎り'), recipe('r3', '浅煎り')]
    const presets = buildQuickPresets(brews, recipes, [b1])
    expect(presets.map(p => p.name)).toEqual(['前回と同じ', '深煎り', '浅煎り'])
  })

  // calcFrequentRecipes は上位2件を**先に**切るので、そこに「前回と同じ」のレシピが
  // 入っていると残りは1件になり、プリセットは2枚になる（従来からの振る舞い）
  it('よく使うレシピの上位に「前回と同じ」が含まれると2枚になる', () => {
    const b1 = bag('b1', '2026-01-10')
    const brews = [
      brew('x1', 'b1', '01', 'r2'), brew('x2', 'b1', '02', 'r2'),
      brew('x3', 'b1', '03', 'r3'), brew('x4', 'b1', '04', 'r3'),
      brew('x5', 'b1', '05', 'r1'), brew('x6', 'b1', '06', 'r1'),
    ]
    const recipes = [recipe('r1', '朝の一杯'), recipe('r2', '深煎り'), recipe('r3', '浅煎り')]
    expect(buildQuickPresets(brews, recipes, [b1]).map(p => p.name))
      .toEqual(['前回と同じ', '浅煎り'])
  })

  it('レシピがマスターから消えていても落ちない', () => {
    const b1 = bag('b1', '2026-01-10')
    const brews = [brew('x1', 'b1', '01', 'gone'), brew('x2', 'b1', '02', 'gone')]
    expect(buildQuickPresets(brews, [], [b1]).map(p => p.name)).toEqual(['前回と同じ'])
  })

  it('豆なし（ドリップバッグ等）の記録でも作れる', () => {
    const noBean: Brew = { ...brew('x1', '', '01'), beanId: undefined }
    const presets = buildQuickPresets([noBean], [], [])
    expect(presets).toHaveLength(1)
    expect(presets[0].beanId).toBeUndefined()
    expect(presets[0].bean).toBeUndefined()
  })
})
