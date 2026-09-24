import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SaveTimeoutError,
  calcFrequentRecipes,
  calcResidualCaffeine,
  clampTweakValue,
  estimateCaffeine,
  predictBedtimeResidual,
  resolveVinyl,
  saveErrorMessage,
  toVinylColorId,
  VINYL_COLORS,
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

describe('saveErrorMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // 安全なコンテキストかどうかを差し替える（既定の jsdom/node 環境に依存させない）
  const withSecureContext = (secure: boolean) => {
    vi.stubGlobal('window', { isSecureContext: secure })
  }

  it('タイムアウトは他のタブ／PWA を閉じる案内にする', () => {
    withSecureContext(true)
    expect(saveErrorMessage(new SaveTimeoutError())).toContain('他に開いている Megroove')
  })

  it('容量不足はバックアップと整理の案内にする', () => {
    withSecureContext(true)
    const e = new DOMException('quota', 'QuotaExceededError')
    expect(saveErrorMessage(e)).toContain('ストレージの空き容量')
  })

  it('安全でないコンテキスト（http）では、その原因を名指しで案内する', () => {
    withSecureContext(false)
    // crypto.randomUUID が無いために起きる TypeError を想定
    const e = new TypeError('crypto.randomUUID is not a function')
    expect(saveErrorMessage(e)).toContain('この接続（http）では保存できません')
  })

  it('安全なコンテキストでの想定外エラーは汎用の案内にする', () => {
    withSecureContext(true)
    expect(saveErrorMessage(new TypeError('boom'))).toBe(
      '保存に失敗しました。ページを再読み込みしてからお試しください',
    )
  })

  it('タイムアウト・容量不足は、安全でないコンテキストでも本来の案内を優先する', () => {
    withSecureContext(false)
    expect(saveErrorMessage(new SaveTimeoutError())).toContain('他に開いている Megroove')
    expect(saveErrorMessage(new DOMException('quota', 'QuotaExceededError')))
      .toContain('ストレージの空き容量')
  })
})

describe('toVinylColorId', () => {
  it('既知の色はそのまま通す', () => {
    expect(toVinylColorId('mint')).toBe('mint')
    expect(toVinylColorId('bean')).toBe('bean')
  })

  it('未知の値・壊れた値は既定（豆に合わせる）に落とす', () => {
    expect(toVinylColorId('rainbow')).toBe('bean')
    expect(toVinylColorId(undefined)).toBe('bean')
    expect(toVinylColorId(null)).toBe('bean')
    expect(toVinylColorId(42)).toBe('bean')
    expect(toVinylColorId({ id: 'mint' })).toBe('bean')
  })
})

describe('resolveVinyl', () => {
  it('固定色は焙煎度に影響されない', () => {
    expect(resolveVinyl('cobalt', 'light')).toEqual(resolveVinyl('cobalt', 'dark'))
  })

  it('「豆に合わせる」は焙煎度で色が変わる', () => {
    expect(resolveVinyl('bean', 'light').disk).not.toBe(resolveVinyl('bean', 'dark').disk)
  })

  it('焙煎度が不明なら中煎り相当にする', () => {
    expect(resolveVinyl('bean')).toEqual(resolveVinyl('bean', 'medium'))
  })

  it('レーベルは全色ともコーラル固定（明るい盤でも文字のコントラストを保つ）', () => {
    for (const { id } of VINYL_COLORS) {
      const p = resolveVinyl(id)
      expect(p.label).toBe('#993C1D')
      expect(p.labelText).toBe('#F7EFE6')
    }
  })

  it('どの色も縁取りを持つ（背景と区別をつけるため）', () => {
    for (const { id } of VINYL_COLORS) {
      expect(resolveVinyl(id).rim).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})
