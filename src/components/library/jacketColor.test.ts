import { describe, expect, it } from 'vitest'
import type { RoastLevel } from '../../db'
import { JACKET_TEXT, contrastRatio, jacketColor } from './jacketColor'

const ROASTS: RoastLevel[] = ['light', 'light-medium', 'medium', 'medium-dark', 'dark']

describe('jacketColor', () => {
  it('同じ産地からは必ず同じ色になる（棚で見分けられる前提）', () => {
    expect(jacketColor('エチオピア', 'medium')).toEqual(jacketColor('エチオピア', 'medium'))
  })

  it('産地が違えば色が変わる', () => {
    const origins = ['エチオピア', 'ケニア', 'グアテマラ', 'コロンビア', 'ブラジル', 'インドネシア']
    const colors = new Set(origins.map(o => jacketColor(o, 'medium').bg))
    expect(colors.size).toBe(origins.length)
  })

  it('同じ産地でも焙煎が深いほど暗くなる', () => {
    const light = jacketColor('エチオピア', 'light').bg
    const dark  = jacketColor('エチオピア', 'dark').bg
    expect(light).not.toBe(dark)
    // 明るさの比較はコントラスト比で代用できる（クリーム文字との比が大きい＝暗い）
    expect(contrastRatio(dark, JACKET_TEXT)).toBeGreaterThan(contrastRatio(light, JACKET_TEXT))
  })

  it('前後の空白を無視して同じ色にする', () => {
    expect(jacketColor('  ケニア  ', 'medium')).toEqual(jacketColor('ケニア', 'medium'))
  })

  it('産地が無ければ既定色に落ちる', () => {
    expect(jacketColor(undefined).bg).toBe(jacketColor('').bg)
    expect(jacketColor('   ').bg).toBe(jacketColor(undefined).bg)
  })

  it('焙煎度が分からなくても色を返す（カフェ記録用）', () => {
    expect(jacketColor('スターバックス').bg).toMatch(/^#[0-9a-f]{6}$/)
  })

  // ここが G-3 の肝。自動生成の色は放っておくと読めない組み合わせが出る
  it('どんな産地・焙煎度でも、文字とのコントラストが 4.5:1 以上になる', () => {
    const seeds = [
      'エチオピア', 'ケニア', 'グアテマラ', 'コロンビア', 'ブラジル', 'ルワンダ',
      'イエメン', 'ジャマイカ', 'ハワイ', 'ペルー', 'タンザニア', 'インド',
      'スターバックス', 'ドトール', '猿田彦珈琲', 'a', 'z', '1', 'ー',
    ]
    for (const seed of seeds) {
      for (const roast of [...ROASTS, undefined]) {
        const { bg, text } = jacketColor(seed, roast)
        expect(contrastRatio(bg, text)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('既定色も 4.5:1 を満たす', () => {
    const { bg, text } = jacketColor(undefined)
    expect(contrastRatio(bg, text)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('contrastRatio', () => {
  it('同じ色なら 1:1', () => {
    expect(contrastRatio('#2E2018', '#2E2018')).toBeCloseTo(1, 5)
  })

  it('黒と白なら 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('順番を入れ替えても同じ値', () => {
    expect(contrastRatio('#993C1D', '#F7EFE6')).toBeCloseTo(contrastRatio('#F7EFE6', '#993C1D'), 10)
  })
})
