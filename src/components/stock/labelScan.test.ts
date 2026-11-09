import { describe, expect, it } from 'vitest'
import { applyLabelToForm, labelScanErrorMessage, quotaFromError, quotaNotice, toLabelScanError, type BeanLabelResult, type LabelFormValues } from './labelScan'

const empty: LabelFormValues = {
  name: '', roaster: '', origin: '', blend: [], farm: '', variety: '', process: '',
  roastLevel: 'medium', roastLevelIsDefault: true, notesText: '', roastedAt: '', amountG: undefined,
  guideText: '', guideDose: undefined, guideWater: undefined, guideTemp: undefined,
}
const result: BeanLabelResult = {
  isCoffeeLabel: true, name: 'イルガチェフェ', roaster: '山猫珈琲', origins: ['エチオピア イルガチェフェ'],
  farm: null, variety: 'エチオピア原種', process: 'ウォッシュト', roastLevel: 'light',
  flavorNotes: ['ジャスミン', 'ベルガモット'], roastedAt: '2026-10-20', amountG: 200,
  brewGuide: { text: '15g / 220ml / 90℃', doseG: 15, waterG: 220, tempC: 90 },
}

describe('applyLabelToForm', () => {
  it('空のフォームには読み取れた項目をすべて入れ、印を付ける欄を返す', () => {
    const { patch, filled } = applyLabelToForm(empty, result)
    expect(patch).toMatchObject({
      name: 'イルガチェフェ', roaster: '山猫珈琲', origin: 'エチオピア イルガチェフェ', variety: 'エチオピア原種',
      process: 'ウォッシュト', roastLevel: 'light', notesText: 'ジャスミン、ベルガモット',
      roastedAt: '2026-10-20', amountG: 200, guideDose: 15, guideWater: 220, guideTemp: 90,
    })
    expect(patch.farm).toBeUndefined() // null の項目は触らない
    expect(filled).not.toContain('farm')
    expect(filled).toContain('guide')
  })

  it('入力済みの欄は上書きしない（編集中の豆を壊さない）', () => {
    const { patch, filled } = applyLabelToForm(
      { ...empty, name: '自分で付けた名前', roastLevel: 'dark', roastLevelIsDefault: false, amountG: 100, guideText: 'メモ' },
      result,
    )
    expect(patch.name).toBeUndefined()
    expect(patch.roastLevel).toBeUndefined()
    expect(patch.amountG).toBeUndefined()
    expect(patch.guideDose).toBeUndefined() // 淹れ方は一部でも入っていれば触らない
    expect(filled).not.toContain('name')
  })

  it('産地が2つ以上ならブレンドとして入れる', () => {
    const { patch } = applyLabelToForm(empty, { ...result, origins: ['ブラジル', 'コロンビア'] })
    expect(patch.blend).toEqual(['ブラジル', 'コロンビア'])
    expect(patch.origin).toBeUndefined()
  })

  it('コーヒーのラベルでなければ何も入れない', () => {
    expect(applyLabelToForm(empty, { ...result, isCoffeeLabel: false })).toEqual({ patch: {}, filled: [] })
  })
})

describe('toLabelScanError / labelScanErrorMessage', () => {
  it('知らないコードは unknown、本文が大きすぎるのは image_too_large', () => {
    expect(toLabelScanError('turnstile_failed')).toBe('turnstile_failed')
    expect(toLabelScanError('body_too_large')).toBe('image_too_large')
    expect(toLabelScanError(undefined)).toBe('unknown')
  })

  it('どの失敗でも手入力に戻れることを添える', () => {
    expect(labelScanErrorMessage('offline')).toMatch(/手入力はそのまま続けられます$/)
  })
})

describe('quotaNotice / quotaFromError', () => {
  it('残りがあれば回数、無ければどの上限かを伝える', () => {
    expect(quotaNotice({ remaining: 1, blockedBy: null })).toBe('本日あと1回')
    expect(quotaNotice({ remaining: 0, blockedBy: 'device' })).toMatch(/^今日の読み取りは使いました/)
    expect(quotaNotice({ remaining: 0, blockedBy: 'global' })).toMatch(/受付は終了/)
    expect(quotaNotice({ remaining: 0, blockedBy: 'ip' })).toMatch(/この回線/)
  })
  it('上限のエラーだけ残り0回に変える', () => {
    expect(toLabelScanError('ip_limit')).toBe('ip_limit')
    expect(quotaFromError('global_limit')).toEqual({ remaining: 0, blockedBy: 'global' })
    expect(quotaFromError('upstream_error')).toBeNull()
  })
})
