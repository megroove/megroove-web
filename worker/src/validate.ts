// リクエストの検証（純粋関数）。Claude に送る前に、形・枚数・大きさ・画像の中身を確かめる。
// 拡張子や申告された media type は信用せず、先頭のバイト列で判定する。

export const MAX_IMAGES = 3
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024 // 1枚 1.5MB（縮小前提。アプリは長辺1024pxで送る）
// base64 で約 4/3 倍＋JSON の余白。これを超える本文は読む前に断る
export const MAX_BODY_BYTES = Math.ceil(MAX_IMAGES * MAX_IMAGE_BYTES * 4 / 3) + 64 * 1024

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp'

export interface LabelImage {
  mediaType: ImageMediaType
  data: string // base64（改行なし）
}

export interface AnalyzeRequest {
  images: LabelImage[]
  turnstileToken: string
  deviceId: string
}

export type ValidationError = 'bad_request' | 'too_many_images' | 'image_too_large' | 'unsupported_image'

export type ValidationResult =
  | { ok: true; value: AnalyzeRequest }
  | { ok: false; error: ValidationError }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

/** 先頭のバイト列（マジックナンバー）から画像の種類を判定する。対象外なら null */
export function detectImageType(bytes: Uint8Array): ImageMediaType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50   // WEBP
  ) return 'image/webp'
  return null
}

/** base64 を復号したときのバイト数（復号せずに計算する） */
export function base64ByteLength(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor(b64.length * 3 / 4) - padding
}

function decodeHead(b64: string, bytes: number): Uint8Array {
  // 先頭だけ復号すれば判定には足りる（4文字 = 3バイト）
  const head = atob(b64.slice(0, Math.ceil(bytes / 3) * 4))
  return Uint8Array.from(head, c => c.charCodeAt(0))
}

export function validateAnalyzeRequest(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'bad_request' }
  const { images, turnstileToken, deviceId } = body as Record<string, unknown>

  if (typeof turnstileToken !== 'string' || turnstileToken.length === 0 || turnstileToken.length > 4096) {
    return { ok: false, error: 'bad_request' }
  }
  if (typeof deviceId !== 'string' || !UUID_RE.test(deviceId)) return { ok: false, error: 'bad_request' }
  if (!Array.isArray(images) || images.length === 0) return { ok: false, error: 'bad_request' }
  if (images.length > MAX_IMAGES) return { ok: false, error: 'too_many_images' }

  const checked: LabelImage[] = []
  for (const img of images) {
    if (typeof img !== 'object' || img === null) return { ok: false, error: 'bad_request' }
    const data = (img as Record<string, unknown>).data
    if (typeof data !== 'string' || data.length < 16 || !BASE64_RE.test(data)) {
      return { ok: false, error: 'bad_request' }
    }
    if (base64ByteLength(data) > MAX_IMAGE_BYTES) return { ok: false, error: 'image_too_large' }
    const type = detectImageType(decodeHead(data, 12))
    if (!type) return { ok: false, error: 'unsupported_image' }
    // 申告された media type は使わず、中身から判定した型を採用する
    checked.push({ mediaType: type, data })
  }

  return { ok: true, value: { images: checked, turnstileToken, deviceId } }
}
