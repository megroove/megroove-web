import { getOrCreateDeviceId, resizeImage } from '../../db'
import { toLabelScanError, type BeanLabelResult, type LabelQuota, type LabelScanError } from './labelScan'

// 豆ラベルの AI 解析を呼ぶ側。設定はビルド時の環境変数で渡す（.env.*.local。リポジトリには入れない）:
//   VITE_AI_SCAN_ENABLED   … 'true' のときだけ入口を出す（回数制限と法務がそろうまで本番では出さない）
//   VITE_LABEL_API_URL     … Worker の URL（例: https://megroove-api.xxx.workers.dev）
//   VITE_TURNSTILE_SITE_KEY … Turnstile のサイトキー（公開値）

const API_URL = import.meta.env.VITE_LABEL_API_URL as string | undefined
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export function isLabelScanEnabled(): boolean {
  return import.meta.env.VITE_AI_SCAN_ENABLED === 'true' && Boolean(API_URL) && Boolean(TURNSTILE_SITE_KEY)
}

// 初回だけ「写真が外部（Anthropic）に送られる」ことに同意してもらう
const CONSENT_KEY = 'megroove-ai-scan-consent'
export function hasLabelScanConsent(): boolean {
  try { return Boolean(localStorage.getItem(CONSENT_KEY)) } catch { return false }
}
export function saveLabelScanConsent(): void {
  try { localStorage.setItem(CONSENT_KEY, new Date().toISOString()) } catch { /* ignore */ }
}

const SCAN_MAX_PX = 1024
const TIMEOUT_MS = 60_000

/** data URL を Worker に送る形にする（media type は Worker が中身から判定し直す） */
function toImagePayload(dataUrl: string): { data: string } {
  return { data: dataUrl.slice(dataUrl.indexOf(',') + 1) }
}

export type LabelScanOutcome =
  | { ok: true; result: BeanLabelResult; remaining: number | null }
  | { ok: false; error: LabelScanError }

/**
 * 写真を長辺1024pxに縮めて送る。写真はここで使うだけで、どこにも保存しない。
 * listImageDataUrl はすでに縮小済みのリスト画像（「リスト画像も解析に使う」）
 */
export async function analyzeLabel(
  files: File[], listImageDataUrl: string | undefined, turnstileToken: string,
): Promise<LabelScanOutcome> {
  if (!API_URL) return { ok: false, error: 'unknown' }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: 'offline' }

  let images: { data: string }[]
  try {
    const resized = await Promise.all(files.map(f => resizeImage(f, SCAN_MAX_PX, 'jpeg')))
    images = [...(listImageDataUrl ? [listImageDataUrl] : []), ...resized].map(toImagePayload)
  } catch {
    return { ok: false, error: 'unsupported_image' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_URL.replace(/\/$/, '')}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, turnstileToken, deviceId: await getOrCreateDeviceId() }),
      signal: controller.signal,
    })
    const body = await res.json().catch(() => null) as
      { ok?: boolean; result?: BeanLabelResult; remaining?: number; error?: string } | null
    if (res.ok && body?.ok && body.result) {
      if (!body.result.isCoffeeLabel) return { ok: false, error: 'not_coffee' }
      return { ok: true, result: body.result, remaining: typeof body.remaining === 'number' ? body.remaining : null }
    }
    return { ok: false, error: toLabelScanError(body?.error) }
  } catch (e) {
    return { ok: false, error: e instanceof DOMException && e.name === 'AbortError' ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
  }
}

/** 今日あと何回使えるか。取れなければ null（表示を出さないだけで、読み取りは妨げない） */
export async function fetchLabelQuota(): Promise<LabelQuota | null> {
  if (!API_URL) return null
  try {
    const deviceId = await getOrCreateDeviceId()
    const res = await fetch(`${API_URL.replace(/\/$/, '')}/quota?deviceId=${encodeURIComponent(deviceId)}`)
    const body = await res.json() as { ok?: boolean; remaining?: number; blockedBy?: LabelQuota['blockedBy'] }
    if (!res.ok || !body.ok || typeof body.remaining !== 'number') return null
    return { remaining: body.remaining, blockedBy: body.blockedBy ?? null }
  } catch {
    return null
  }
}
