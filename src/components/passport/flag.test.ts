import { describe, expect, it } from 'vitest'
import { COFFEE_COUNTRIES } from '../../db'
import { flagFor, toFlagEmoji } from './flag'

describe('toFlagEmoji', () => {
  it('国コードを国旗絵文字に変換する', () => {
    expect(toFlagEmoji('CO')).toBe('🇨🇴')
    expect(toFlagEmoji('CR')).toBe('🇨🇷')
    expect(toFlagEmoji('ET')).toBe('🇪🇹')
  })

  it('地域表示記号2つぶんのコードポイントになる', () => {
    expect([...toFlagEmoji('JP')!].map(c => c.codePointAt(0))).toEqual([0x1f1ef, 0x1f1f5])
  })

  it('国コードでないものは null', () => {
    expect(toFlagEmoji('co')).toBeNull()      // 小文字
    expect(toFlagEmoji('JPN')).toBeNull()     // 3文字
    expect(toFlagEmoji('J')).toBeNull()
    expect(toFlagEmoji('')).toBeNull()
    expect(toFlagEmoji(undefined)).toBeNull() // ハワイ（国旗なし）
  })
})

describe('国マスターの国コード', () => {
  const withCode = COFFEE_COUNTRIES.filter(c => c.code)

  it('ハワイ以外のすべての国にコードが付いている', () => {
    const missing = COFFEE_COUNTRIES.filter(c => !c.code).map(c => c.name)
    expect(missing).toEqual(['ハワイ'])
  })

  it('コードはすべて ISO 3166-1 alpha-2 の形', () => {
    for (const c of withCode) expect(c.code).toMatch(/^[A-Z]{2}$/)
  })

  it('コードが重複していない', () => {
    const codes = withCode.map(c => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('すべての国でコードから国旗を作れる', () => {
    for (const c of withCode) expect(toFlagEmoji(c.code)).not.toBeNull()
  })
})

describe('flagFor', () => {
  // canvas の無い環境（= このテスト）では「描けない」と判定され、頭文字表示に退避する。
  // 国旗が出ない端末でスタンプが空白にならないことの担保。
  it('描画判定ができない環境では null を返す（頭文字に戻す）', () => {
    expect(flagFor('コロンビア')).toBeNull()
    expect(flagFor('ハワイ')).toBeNull()
    expect(flagFor('知らない国')).toBeNull()
  })
})
