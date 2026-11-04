import type { RoastLevel } from '../../db'

// 豆ラベルの AI 解析（Worker `megroove-api` の /analyze）の結果と、豆フォームへの当てはめ。
// 当てはめは純粋関数にしてテストで固定する。**入力済みの欄は上書きしない**（編集中の豆を壊さない）。

export interface BeanLabelResult {
  isCoffeeLabel: boolean
  name: string | null
  roaster: string | null
  origins: string[]
  farm: string | null
  variety: string | null
  process: string | null
  roastLevel: RoastLevel | null
  flavorNotes: string[]
  roastedAt: string | null
  amountG: number | null
  brewGuide: { text: string | null; doseG: number | null; waterG: number | null; tempC: number | null } | null
}

// 豆フォームのうち、解析で埋められる欄の今の値
export interface LabelFormValues {
  name: string
  roaster: string
  origin: string
  blend: string[]
  farm: string
  variety: string
  process: string
  /** 焙煎度は常に何か選ばれているので、「まだ既定のまま」かどうかで空とみなす */
  roastLevel: RoastLevel
  roastLevelIsDefault: boolean
  notesText: string
  roastedAt: string
  amountG: number | undefined
  guideText: string
  guideDose: number | undefined
  guideWater: number | undefined
  guideTemp: number | undefined
}

export type LabelFieldKey =
  | 'name' | 'roaster' | 'origin' | 'farm' | 'variety' | 'process' | 'roastLevel'
  | 'notes' | 'roastedAt' | 'amountG' | 'guide'

export interface LabelApplyResult {
  patch: Partial<LabelFormValues>
  /** AI が入れた欄（フォームに印を付ける） */
  filled: LabelFieldKey[]
}

export function applyLabelToForm(current: LabelFormValues, r: BeanLabelResult): LabelApplyResult {
  const patch: Partial<LabelFormValues> = {}
  const filled: LabelFieldKey[] = []
  if (!r.isCoffeeLabel) return { patch, filled }

  const text = (key: 'name' | 'roaster' | 'farm' | 'variety' | 'process' | 'roastedAt', value: string | null) => {
    if (value && !current[key].trim()) { patch[key] = value; filled.push(key) }
  }
  text('name', r.name)
  text('roaster', r.roaster)

  const origins = r.origins.filter(o => o.trim())
  const originEmpty = !current.origin.trim() && current.blend.every(o => !o.trim())
  if (originEmpty && origins.length === 1) { patch.origin = origins[0]; filled.push('origin') }
  if (originEmpty && origins.length >= 2) { patch.blend = origins; filled.push('origin') }

  text('farm', r.farm)
  text('variety', r.variety)
  text('process', r.process)

  if (r.roastLevel && current.roastLevelIsDefault) {
    patch.roastLevel = r.roastLevel
    patch.roastLevelIsDefault = false
    filled.push('roastLevel')
  }
  if (r.flavorNotes.length > 0 && !current.notesText.trim()) {
    patch.notesText = r.flavorNotes.join('、')
    filled.push('notes')
  }
  text('roastedAt', r.roastedAt)
  if (r.amountG !== null && current.amountG === undefined) { patch.amountG = r.amountG; filled.push('amountG') }

  // 淹れ方は「どれも空」のときだけ、まとめて入れる（一部だけ混ざると読み違いに気づきにくい）
  const g = r.brewGuide
  const guideEmpty = !current.guideText.trim() &&
    current.guideDose === undefined && current.guideWater === undefined && current.guideTemp === undefined
  if (g && guideEmpty) {
    patch.guideText  = g.text ?? ''
    patch.guideDose  = g.doseG ?? undefined
    patch.guideWater = g.waterG ?? undefined
    patch.guideTemp  = g.tempC ?? undefined
    filled.push('guide')
  }
  return { patch, filled }
}

// ─── 通信のエラー（Worker の error コード → 利用者向けの文言） ─────────────────

export type LabelScanError =
  | 'offline' | 'network' | 'timeout' | 'turnstile_failed' | 'unreadable' | 'not_coffee'
  | 'image_too_large' | 'unsupported_image' | 'too_many_images' | 'upstream_error' | 'unknown'

const MESSAGES: Record<LabelScanError, string> = {
  offline: 'オフラインのため読み取れません。通信できる場所でもう一度お試しください',
  network: '通信に失敗しました。少し時間をおいてお試しください',
  timeout: '読み取りに時間がかかりすぎました。写真を減らすか、もう一度お試しください',
  turnstile_failed: '確認に失敗しました。画面を開き直してもう一度お試しください',
  unreadable: 'ラベルを読み取れませんでした。文字がはっきり写った写真でお試しください',
  not_coffee: 'コーヒー豆のラベルが見つかりませんでした',
  image_too_large: '写真が大きすぎます',
  unsupported_image: 'この形式の写真は読み取れません（JPEG・PNG・WebP のみ）',
  too_many_images: '写真は3枚までです',
  upstream_error: '読み取りサービスが混み合っています。少し時間をおいてお試しください',
  unknown: '読み取りに失敗しました',
}

export function labelScanErrorMessage(e: LabelScanError): string {
  return `${MESSAGES[e]}。手入力はそのまま続けられます`
}

/** Worker が返す error コードを、アプリで扱う種類に寄せる */
export function toLabelScanError(code: unknown): LabelScanError {
  switch (code) {
    case 'turnstile_failed': case 'unreadable': case 'image_too_large': case 'unsupported_image':
    case 'too_many_images': case 'upstream_error':
      return code
    case 'body_too_large': return 'image_too_large'
    default: return 'unknown'
  }
}
