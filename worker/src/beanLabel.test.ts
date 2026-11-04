import { describe, expect, it } from 'vitest'
import { sanitizeLabel, type BeanLabel } from './beanLabel'

const base: BeanLabel = {
  isCoffeeLabel: true, name: ' イルガチェフェ ', roaster: null, origins: ['エチオピア イルガチェフェ', ' '],
  farm: null, variety: null, process: 'ウォッシュト', roastLevel: 'light', flavorNotes: ['ジャスミン', ''],
  roastedAt: '2026-10-20', amountG: 200, brewGuide: { text: null, doseG: 15, waterG: 220, tempC: 90 },
}

describe('sanitizeLabel', () => {
  it('前後の空白と空要素を落とす', () => {
    const s = sanitizeLabel(base)
    expect(s.name).toBe('イルガチェフェ')
    expect(s.origins).toEqual(['エチオピア イルガチェフェ'])
    expect(s.flavorNotes).toEqual(['ジャスミン'])
  })

  it('ありえない日付・範囲外の数値は null にする', () => {
    const s = sanitizeLabel({
      ...base, roastedAt: '2026-02-30', amountG: -5,
      brewGuide: { text: null, doseG: 500, waterG: 220, tempC: 300 },
    })
    expect(s.roastedAt).toBeNull()
    expect(s.amountG).toBeNull()
    expect(s.brewGuide).toEqual({ text: null, doseG: null, waterG: 220, tempC: null })
  })

  it('淹れ方が全部空なら brewGuide ごと null', () => {
    expect(sanitizeLabel({ ...base, brewGuide: { text: ' ', doseG: null, waterG: null, tempC: null } }).brewGuide).toBeNull()
  })

  it('コーヒーのラベルでなければ中身をすべて空にする', () => {
    const s = sanitizeLabel({ ...base, isCoffeeLabel: false })
    expect(s.name).toBeNull()
    expect(s.origins).toEqual([])
    expect(s.brewGuide).toBeNull()
  })
})
