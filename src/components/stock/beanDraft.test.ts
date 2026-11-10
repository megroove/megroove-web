import { describe, expect, it } from 'vitest'
import { isBeanDraftEmpty, parseBeanDraft, type BeanDraft } from './beanDraft'

const empty: BeanDraft = {
  name: '', roastLevel: 'medium', roastTouched: false, roastedAt: '', purchasedAt: '', origin: '', blend: [],
  farm: '', variety: '', process: '', decaf: false, stockNote: '', roaster: '', notesText: '', guideText: '', aiFilled: [],
}

describe('isBeanDraftEmpty', () => {
  it('開いただけ（焙煎度も既定のまま）は空', () => {
    expect(isBeanDraftEmpty(empty)).toBe(true)
    expect(isBeanDraftEmpty({ ...empty, blend: ['', ' '] })).toBe(true)
  })
  it('どれか1つでも入っていれば残す', () => {
    expect(isBeanDraftEmpty({ ...empty, name: 'UMINAMIブレンド' })).toBe(false)
    expect(isBeanDraftEmpty({ ...empty, roastTouched: true })).toBe(false)
    expect(isBeanDraftEmpty({ ...empty, amountG: 100 })).toBe(false)
    expect(isBeanDraftEmpty({ ...empty, blend: ['ブラジル'] })).toBe(false)
  })
})

describe('parseBeanDraft', () => {
  it('保存した形をそのまま戻す（AI の印も）', () => {
    const d: BeanDraft = { ...empty, name: 'UMINAMIブレンド', roaster: '和珈屋', blend: ['ブラジル', 'コロンビア'], amountG: 100, aiFilled: ['name', 'roaster', 'origin', 'amountG'] }
    expect(parseBeanDraft(JSON.stringify(d))).toEqual(d)
  })
  it('壊れた・空の下書きは使わない', () => {
    expect(parseBeanDraft(null)).toBeNull()
    expect(parseBeanDraft('{')).toBeNull()
    expect(parseBeanDraft('[]')).toBeNull()
    expect(parseBeanDraft(JSON.stringify(empty))).toBeNull()
  })
  it('おかしな値は既定に寄せる', () => {
    const d = parseBeanDraft(JSON.stringify({
      name: 'X', roastLevel: 'burnt', amountG: -5, guideTemp: 'hot', aiFilled: ['name', 'evil'],
      photoDataUrl: 'javascript:alert(1)', blend: ['ブラジル', 3],
    }))
    expect(d).toMatchObject({ name: 'X', roastLevel: 'medium', amountG: undefined, guideTemp: undefined, aiFilled: ['name'], blend: ['ブラジル', ''] })
    expect(d?.photoDataUrl).toBeUndefined()
  })
})
