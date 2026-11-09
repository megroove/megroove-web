import Anthropic from '@anthropic-ai/sdk'
import { ClaudeLabelAnalyzer, type LabelAnalyzer } from './analyzer'
import { sanitizeLabel } from './beanLabel'
import {
  countersFor, D1CounterStore, jstDay, parseLimits, previousDay, remaining, reserve,
  type CounterStore, type QuotaScope,
} from './quota'
import { MAX_BODY_BYTES, UUID_RE, validateAnalyzeRequest } from './validate'

export interface Env {
  ANTHROPIC_API_KEY: string // secret
  TURNSTILE_SECRET: string  // secret
  HASH_SECRET: string       // secret（端末ID・IP のハッシュ用）
  ALLOWED_ORIGINS: string   // カンマ区切り・完全一致
  TURNSTILE_HOSTNAME: string // 空なら照合しない（開発用）
  LIMIT_DEVICE: string
  LIMIT_IP: string
  LIMIT_GLOBAL: string
  DB: D1Database
}

// アプリに返すエラーの種類。文言はアプリ側で出し分ける（Worker は日本語を持たない）
export type ErrorCode =
  | 'origin_not_allowed' | 'not_found' | 'method_not_allowed'
  | 'bad_request' | 'too_many_images' | 'image_too_large' | 'unsupported_image' | 'body_too_large'
  | 'turnstile_failed' | 'unreadable' | 'upstream_error'
  | 'device_limit' | 'ip_limit' | 'global_limit'

const STATUS: Record<ErrorCode, number> = {
  origin_not_allowed: 403, not_found: 404, method_not_allowed: 405,
  bad_request: 400, too_many_images: 400, image_too_large: 413, unsupported_image: 415, body_too_large: 413,
  turnstile_failed: 403, unreadable: 422, upstream_error: 502,
  device_limit: 429, ip_limit: 429, global_limit: 429,
}

const LIMIT_ERROR: Record<QuotaScope, ErrorCode> = { device: 'device_limit', ip: 'ip_limit', global: 'global_limit' }

export function allowedOrigin(origin: string | null, allowList: string): string | null {
  if (!origin) return null
  return allowList.split(',').map(s => s.trim()).filter(Boolean).includes(origin) ? origin : null
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(origin ? corsHeaders(origin) : { Vary: 'Origin' }),
    },
  })
}

const fail = (code: ErrorCode, origin: string | null) => json({ ok: false, error: code }, STATUS[code], origin)

async function verifyTurnstile(token: string, ip: string | null, env: Env): Promise<boolean> {
  const form = new FormData()
  form.append('secret', env.TURNSTILE_SECRET)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
  if (!res.ok) return false
  const data = await res.json() as { success?: boolean; hostname?: string }
  if (!data.success) return false
  return !env.TURNSTILE_HOSTNAME || data.hostname === env.TURNSTILE_HOSTNAME
}

export async function handleAnalyze(
  request: Request, env: Env, analyzer: LabelAnalyzer, origin: string, store: CounterStore, now = new Date(),
): Promise<Response> {
  // 本文を読む前に大きさで断る（Content-Length が無い・偽りの場合に備えて、読んだあとも測る）
  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (declared > MAX_BODY_BYTES) return fail('body_too_large', origin)
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return fail('body_too_large', origin)

  let body: unknown
  try { body = JSON.parse(raw) } catch { return fail('bad_request', origin) }
  const checked = validateAnalyzeRequest(body)
  if (!checked.ok) return fail(checked.error, origin)

  const ip = request.headers.get('CF-Connecting-IP')
  // Turnstile を先に通す＝ボットには回数の枠も取らせない
  if (!(await verifyTurnstile(checked.value.turnstileToken, ip, env))) return fail('turnstile_failed', origin)

  const day = jstDay(now)
  const counters = await countersFor(env.HASH_SECRET, parseLimits(env), checked.value.deviceId, ip)
  await store.purgeBefore(previousDay(day))
  const reserved = await reserve(store, day, counters)
  if (!reserved.ok) return fail(LIMIT_ERROR[reserved.scope], origin)

  // 失敗したら利用者の「1日1回」だけ返す（IP と全体は Claude を呼んだ回数なので返さない）
  const device = counters[0]
  const refund = () => store.decrement(day, device.scope, device.key)

  try {
    const outcome = await analyzer.analyze(checked.value.images)
    if (outcome.kind === 'unreadable') { await refund(); return fail('unreadable', origin) }
    const result = sanitizeLabel(outcome.label)
    if (!result.isCoffeeLabel) await refund()
    const left = await remaining(store, day, counters)
    return json({ ok: true, result, remaining: left.remaining }, 200, origin)
  } catch (e) {
    await refund()
    // 写真やラベルの内容はログに残さない。種類と状態だけ
    if (e instanceof Anthropic.APIError) console.error('[analyze] upstream', e.status)
    else console.error('[analyze] failed', e instanceof Error ? e.name : 'unknown')
    return fail('upstream_error', origin)
  }
}

/** 今日あと何回使えるか（表示用。判定は /analyze が改めて行う） */
export async function handleQuota(
  request: Request, env: Env, origin: string, store: CounterStore, now = new Date(),
): Promise<Response> {
  const deviceId = new URL(request.url).searchParams.get('deviceId')
  if (!deviceId || !UUID_RE.test(deviceId)) return fail('bad_request', origin)
  const counters = await countersFor(env.HASH_SECRET, parseLimits(env), deviceId, request.headers.get('CF-Connecting-IP'))
  const left = await remaining(store, jstDay(now), counters)
  return json({ ok: true, remaining: left.remaining, blockedBy: left.blockedBy }, 200, origin)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = allowedOrigin(request.headers.get('Origin'), env.ALLOWED_ORIGINS)
    // 許可していない送り元には CORS ヘッダーを返さない（ブラウザが結果を読めない）
    if (!origin) return fail('origin_not_allowed', null)

    const route = url.pathname === '/analyze' ? 'analyze' : url.pathname === '/quota' ? 'quota' : null
    if (!route) return fail('not_found', origin)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })

    const store = new D1CounterStore(env.DB)
    if (route === 'quota') {
      return request.method === 'GET' ? handleQuota(request, env, origin, store) : fail('method_not_allowed', origin)
    }
    if (request.method !== 'POST') return fail('method_not_allowed', origin)
    return handleAnalyze(request, env, new ClaudeLabelAnalyzer(env.ANTHROPIC_API_KEY), origin, store)
  },
}
