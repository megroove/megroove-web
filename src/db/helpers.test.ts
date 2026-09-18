import { describe, expect, it } from 'vitest'
import {
  calcFrequentRecipes,
  calcResidualCaffeine,
  clampTweakValue,
  estimateCaffeine,
  predictBedtimeResidual,
} from './helpers'

// クイック記録（ホームのシート）で使う純粋なロジックのテスト。
// UI ではなく「不正値を保存しない」「同じ計算を使い回す」ことを守るためのもの。

describe('clampTweakValue', () => {
  it('範囲内の値はそのまま返す', () => {
    expect(clampTweakValue('doseG', 15.5, 15)).toBe(15.5)
    expect(clampTweakValue('tempC', 92, 90)).toBe(92)
  })

  it('下限・上限を超える値は丸める', () => {
    expect(clampTweakValue('doseG', 0, 15)).toBe(1)        // min 1g
    expect(clampTweakValue('doseG', 1000, 15)).toBe(100)   // max 100g
    expect(clampTweakValue('waterG', 5, 240)).toBe(10)     // min 10g
    expect(clampTweakValue('tempC', 120, 90)).toBe(100)    // max 100°C
    expect(clampTweakValue('grindSize', 0, 22)).toBe(1)
  })

  it('NaN・非有限値は基準値へ戻す（不正値を保存しない）', () => {
    expect(clampTweakValue('doseG', NaN, 15)).toBe(15)
    expect(clampTweakValue('waterG', Infinity, 240)).toBe(240)
    expect(clampTweakValue('tempC', -Infinity, 90)).toBe(90)
  })

  it('0.5 刻みの粉量で浮動小数の誤差を残さない', () => {
    expect(clampTweakValue('doseG', 15 + 0.5, 15)).toBe(15.5)
    expect(clampTweakValue('doseG', 15.5 - 0.5, 15.5)).toBe(15)
  })
})

describe('calcFrequentRecipes', () => {
  const brew = (recipeId: string | undefined, brewedAt: string) => ({ recipeId, brewedAt })

  it('使用回数の多い順に返す', () => {
    const result = calcFrequentRecipes([
      brew('a', '2026-09-01T09:00:00.000Z'),
      brew('a', '2026-09-02T09:00:00.000Z'),
      brew('b', '2026-09-03T09:00:00.000Z'),
      brew('b', '2026-09-04T09:00:00.000Z'),
      brew('b', '2026-09-05T09:00:00.000Z'),
    ])
    expect(result).toEqual([
      { recipeId: 'b', count: 3 },
      { recipeId: 'a', count: 2 },
    ])
  })

  it('1回しか使っていないレシピは「よく使う」に含めない', () => {
    const result = calcFrequentRecipes([
      brew('a', '2026-09-01T09:00:00.000Z'),
      brew('b', '2026-09-02T09:00:00.000Z'),
      brew('b', '2026-09-03T09:00:00.000Z'),
    ])
    expect(result).toEqual([{ recipeId: 'b', count: 2 }])
  })

  it('同数なら直近に使ったレシピを優先する', () => {
    const result = calcFrequentRecipes([
      brew('old', '2026-08-01T09:00:00.000Z'),
      brew('old', '2026-08-02T09:00:00.000Z'),
      brew('new', '2026-09-01T09:00:00.000Z'),
      brew('new', '2026-09-02T09:00:00.000Z'),
    ])
    expect(result.map(r => r.recipeId)).toEqual(['new', 'old'])
  })

  it('レシピ未設定の記録は無視し、最大件数で切る', () => {
    const result = calcFrequentRecipes([
      brew(undefined, '2026-09-01T09:00:00.000Z'),
      brew(undefined, '2026-09-02T09:00:00.000Z'),
      brew('a', '2026-09-03T09:00:00.000Z'),
      brew('a', '2026-09-04T09:00:00.000Z'),
      brew('b', '2026-09-05T09:00:00.000Z'),
      brew('b', '2026-09-06T09:00:00.000Z'),
      brew('c', '2026-09-07T09:00:00.000Z'),
      brew('c', '2026-09-08T09:00:00.000Z'),
    ], 2)
    expect(result).toHaveLength(2)
    expect(result.every(r => r.recipeId !== undefined)).toBe(true)
  })

  it('記録が無ければ空配列', () => {
    expect(calcFrequentRecipes([])).toEqual([])
  })
})

describe('predictBedtimeResidual', () => {
  const settings = { bedtimeHour: 23, bedtimeMinute: 0 }

  it('これから飲む一杯が無ければ予測しない', () => {
    expect(predictBedtimeResidual([], null, settings, new Date('2026-09-18T12:00:00'))).toBeNull()
  })

  it('半減期5.5時間で就寝時刻まで減衰させる', () => {
    // 17:30 に 100mg → 23:00（5.5時間後）はちょうど半分
    const now = new Date('2026-09-18T17:30:00')
    const p = predictBedtimeResidual([], 100, settings, now)
    expect(p).not.toBeNull()
    expect(p!.mg).toBeCloseTo(50, 5)
    expect(p!.hour).toBe(23)
    expect(p!.minute).toBe(0)
  })

  it('既存の摂取分を合算する', () => {
    const now = new Date('2026-09-18T17:30:00')
    const past = [{ caffeineAmount: 100, brewedAt: new Date('2026-09-18T12:00:00').toISOString() }]
    const p = predictBedtimeResidual(past, 100, settings, now)
    // 12:00 の 100mg は 23:00（11時間後）に 25mg、17:30 の 100mg は 50mg
    expect(p!.mg).toBeCloseTo(75, 5)
  })

  it('就寝時刻を過ぎていれば翌日の就寝時刻で計算する', () => {
    const now = new Date('2026-09-18T23:30:00')
    const p = predictBedtimeResidual([], 100, settings, now)
    // 23:30 → 翌23:00（23.5時間後）はほぼ残らない
    expect(p!.mg).toBeLessThan(6)
  })
})

describe('estimateCaffeine', () => {
  it('粉量1gあたり約12mgで推定する', () => {
    expect(estimateCaffeine(15)).toBe(180)
  })

  it('デカフェは10%で推定する', () => {
    expect(estimateCaffeine(15, true)).toBe(18)
  })
})

describe('calcResidualCaffeine', () => {
  it('未来の摂取は加算しない', () => {
    const at = new Date('2026-09-18T12:00:00')
    const total = calcResidualCaffeine(
      [{ caffeineAmount: 100, brewedAt: new Date('2026-09-18T18:00:00').toISOString() }],
      at,
    )
    expect(total).toBe(0)
  })
})
