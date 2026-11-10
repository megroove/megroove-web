import type { RoastLevel } from '../../db'
import type { LabelFieldKey } from './labelScan'

// 豆を追加（新規のみ）の入力途中。「閉じる」や画面遷移で消えないよう localStorage に退避し、保存できたら消す。
// 編集・買い直しは元の豆から作り直せるので対象にしない。AI の印も残す＝確かめる前に閉じても、どこが AI か分かる

const BEAN_DRAFT_KEY = 'megroove-bean-draft'

export interface BeanDraft {
  name: string
  roastLevel: RoastLevel
  roastTouched: boolean
  roastedAt: string
  purchasedAt: string
  amountG?: number
  origin: string
  blend: string[]
  farm: string
  variety: string
  process: string
  decaf: boolean
  stockNote: string
  photoDataUrl?: string
  roaster: string
  notesText: string
  guideText: string
  guideDose?: number
  guideWater?: number
  guideTemp?: number
  aiFilled: LabelFieldKey[]
}

const ROAST_LEVELS: RoastLevel[] = ['light', 'light-medium', 'medium', 'medium-dark', 'dark']
const AI_KEYS: LabelFieldKey[] = [
  'name', 'roaster', 'origin', 'farm', 'variety', 'process', 'roastLevel', 'notes', 'roastedAt', 'amountG', 'guide',
]
const MAX_TEXT = 2000

/** 何も入っていない下書き（＝残す意味がない）。焙煎度は触っていなければ空とみなす */
export function isBeanDraftEmpty(d: BeanDraft): boolean {
  const texts = [
    d.name, d.roastedAt, d.purchasedAt, d.origin, d.farm, d.variety, d.process,
    d.stockNote, d.roaster, d.notesText, d.guideText, ...d.blend,
  ]
  return texts.every(t => !t.trim()) &&
    !d.roastTouched && !d.decaf && !d.photoDataUrl &&
    [d.amountG, d.guideDose, d.guideWater, d.guideTemp].every(n => n === undefined)
}

/** 読み込んだ値を形で締める（手で書き換えられた・古い形でも壊れない）。使えなければ null */
export function parseBeanDraft(raw: string | null): BeanDraft | null {
  if (!raw) return null
  let v: unknown
  try { v = JSON.parse(raw) } catch { return null }
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const str = (x: unknown) => typeof x === 'string' ? x.slice(0, MAX_TEXT) : ''
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined
  const photo = typeof o.photoDataUrl === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(o.photoDataUrl)
    ? o.photoDataUrl : undefined
  const d: BeanDraft = {
    name: str(o.name),
    roastLevel: ROAST_LEVELS.includes(o.roastLevel as RoastLevel) ? o.roastLevel as RoastLevel : 'medium',
    roastTouched: o.roastTouched === true,
    roastedAt: str(o.roastedAt),
    purchasedAt: str(o.purchasedAt),
    amountG: num(o.amountG),
    origin: str(o.origin),
    blend: Array.isArray(o.blend) ? o.blend.map(str).slice(0, 12) : [],
    farm: str(o.farm),
    variety: str(o.variety),
    process: str(o.process),
    decaf: o.decaf === true,
    stockNote: str(o.stockNote),
    photoDataUrl: photo,
    roaster: str(o.roaster),
    notesText: str(o.notesText),
    guideText: str(o.guideText),
    guideDose: num(o.guideDose),
    guideWater: num(o.guideWater),
    guideTemp: num(o.guideTemp),
    aiFilled: Array.isArray(o.aiFilled) ? AI_KEYS.filter(k => (o.aiFilled as unknown[]).includes(k)) : [],
  }
  return isBeanDraftEmpty(d) ? null : d
}

export function loadBeanDraft(): BeanDraft | null {
  try { return parseBeanDraft(localStorage.getItem(BEAN_DRAFT_KEY)) } catch { return null }
}

/** 空なら消す。容量を超えたら写真を外してもう一度（記録画面の下書きと同じ流儀） */
export function saveBeanDraft(d: BeanDraft): void {
  try {
    if (isBeanDraftEmpty(d)) { localStorage.removeItem(BEAN_DRAFT_KEY); return }
    localStorage.setItem(BEAN_DRAFT_KEY, JSON.stringify(d))
  } catch {
    try { localStorage.setItem(BEAN_DRAFT_KEY, JSON.stringify({ ...d, photoDataUrl: undefined })) } catch { /* 諦める */ }
  }
}

export function clearBeanDraft(): void {
  try { localStorage.removeItem(BEAN_DRAFT_KEY) } catch { /* ignore */ }
}
