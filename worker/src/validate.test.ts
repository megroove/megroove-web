import { describe, expect, it } from 'vitest'
import { base64ByteLength, detectImageType, MAX_IMAGE_BYTES, validateAnalyzeRequest } from './validate'

const b64 = (bytes: number[], padTo = 32) =>
  btoa(String.fromCharCode(...bytes, ...new Array(Math.max(0, padTo - bytes.length)).fill(0)))
const JPEG = b64([0xff, 0xd8, 0xff, 0xe0])
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const WEBP = b64([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
const GIF = b64([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
const DEVICE = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e'

const req = (images: unknown[], extra: Record<string, unknown> = {}) =>
  ({ images, turnstileToken: 'tok', deviceId: DEVICE, ...extra })

describe('detectImageType', () => {
  it('先頭のバイト列で JPEG / PNG / WebP を見分け、それ以外は null', () => {
    const dec = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
    expect(detectImageType(dec(JPEG))).toBe('image/jpeg')
    expect(detectImageType(dec(PNG))).toBe('image/png')
    expect(detectImageType(dec(WEBP))).toBe('image/webp')
    expect(detectImageType(dec(GIF))).toBeNull()
  })
})

describe('base64ByteLength', () => {
  it('復号後のバイト数をパディング込みで数える', () => {
    expect(base64ByteLength(btoa('abc'))).toBe(3)
    expect(base64ByteLength(btoa('ab'))).toBe(2)
    expect(base64ByteLength(btoa('a'))).toBe(1)
  })
})

describe('validateAnalyzeRequest', () => {
  it('正しいリクエストを通し、型は申告ではなく中身から決める', () => {
    const r = validateAnalyzeRequest(req([{ mediaType: 'image/png', data: JPEG }, { data: WEBP }]))
    expect(r.ok && r.value.images.map(i => i.mediaType)).toEqual(['image/jpeg', 'image/webp'])
  })

  it('4枚以上は断る', () => {
    expect(validateAnalyzeRequest(req([{ data: JPEG }, { data: JPEG }, { data: JPEG }, { data: JPEG }])))
      .toEqual({ ok: false, error: 'too_many_images' })
  })

  it('1枚 1.5MB を超える画像は断る', () => {
    const big = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES + 3) / 3) * 4)
    expect(validateAnalyzeRequest(req([{ data: '/9j/' + big.slice(4) }])))
      .toEqual({ ok: false, error: 'image_too_large' })
  })

  it('画像でないもの（GIF を含む）は断る', () => {
    expect(validateAnalyzeRequest(req([{ data: GIF }]))).toEqual({ ok: false, error: 'unsupported_image' })
  })

  it('形の崩れたリクエストは bad_request', () => {
    expect(validateAnalyzeRequest(null).ok).toBe(false)
    expect(validateAnalyzeRequest(req([])).ok).toBe(false)
    expect(validateAnalyzeRequest(req([{ data: 'not base64!!' }])).ok).toBe(false)
    expect(validateAnalyzeRequest(req([{ data: JPEG }], { deviceId: 'abc' })).ok).toBe(false)
    expect(validateAnalyzeRequest(req([{ data: JPEG }], { turnstileToken: '' })).ok).toBe(false)
  })
})
