import { describe, expect, it } from 'vitest'
import { COFFEE_COUNTRIES, RARITIES } from '../../db'
import { RARITY_STYLE, rarityOf } from './rarity'

// カード地（#2E2018）とのコントラスト比。§9 の 4.5:1 を稀少度の色でも守る
const CARD_BG = '#2E2018'

function luminance(hex: string): number {
  const ch = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = ch.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('稀少度のマスター', () => {
  it('43か国すべてに稀少度が付いている', () => {
    expect(COFFEE_COUNTRIES).toHaveLength(43)
    for (const c of COFFEE_COUNTRIES) expect(RARITIES).toContain(c.rarity)
  })

  it('どの階級も空にならない（空の階級があると進捗が 0/0 になる）', () => {
    for (const r of RARITIES) {
      expect(COFFEE_COUNTRIES.filter(c => c.rarity === r).length).toBeGreaterThan(0)
    }
  })

  it('定番の産地はブロンズ、入手が難しい産地はプラチナ', () => {
    expect(rarityOf('ブラジル')).toBe('bronze')
    expect(rarityOf('エチオピア')).toBe('bronze')
    expect(rarityOf('ベネズエラ')).toBe('platinum')
    expect(rarityOf('オーストラリア')).toBe('platinum')
  })

  it('マスターに無い産地は null', () => {
    expect(rarityOf('謎の産地')).toBeNull()
  })
})

describe('稀少度の見た目', () => {
  it('すべての階級に見た目が定義されている', () => {
    for (const r of RARITIES) expect(RARITY_STYLE[r]).toBeDefined()
  })

  it('階級名は色だけでなくテキストでも分かる（§9）', () => {
    for (const r of RARITIES) expect(RARITY_STYLE[r].label.length).toBeGreaterThan(0)
  })

  it('どの階級の色もカード上でコントラスト 4.5:1 以上（§9）', () => {
    for (const r of RARITIES) {
      expect(contrast(RARITY_STYLE[r].color, CARD_BG)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('色が近いシルバーとプラチナは、形（二重リング）でも区別できる', () => {
    expect(RARITY_STYLE.platinum.shadow).toBeDefined()
    expect(RARITY_STYLE.silver.shadow).toBeUndefined()
  })
})
