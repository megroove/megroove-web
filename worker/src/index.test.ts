import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LabelAnalyzer } from './analyzer'
import type { BeanLabel } from './beanLabel'
import worker, { allowedOrigin, handleAnalyze, type Env } from './index'

const env: Env = {
  ANTHROPIC_API_KEY: 'x', TURNSTILE_SECRET: 's',
  ALLOWED_ORIGINS: 'https://megroove.github.io', TURNSTILE_HOSTNAME: 'megroove.github.io',
}
const ORIGIN = 'https://megroove.github.io'
const JPEG = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, ...new Array(28).fill(0)))
const body = { images: [{ data: JPEG }], turnstileToken: 'tok', deviceId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e' }
const post = (b: unknown = body) => new Request('https://api.example/analyze', {
  method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(b),
})
const label: BeanLabel = {
  isCoffeeLabel: true, name: 'X', roaster: null, origins: [], farm: null, variety: null, process: null,
  roastLevel: null, flavorNotes: [], roastedAt: null, amountG: null, brewGuide: null,
}
const analyzer = (impl: LabelAnalyzer['analyze']): LabelAnalyzer => ({ analyze: impl })
const turnstile = (success: boolean, hostname = 'megroove.github.io') =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success, hostname }))))

afterEach(() => vi.unstubAllGlobals())

describe('allowedOrigin', () => {
  it('完全一致だけ許可する', () => {
    expect(allowedOrigin(ORIGIN, env.ALLOWED_ORIGINS)).toBe(ORIGIN)
    expect(allowedOrigin('https://megroove.github.io.evil.example', env.ALLOWED_ORIGINS)).toBeNull()
    expect(allowedOrigin(null, env.ALLOWED_ORIGINS)).toBeNull()
  })
})

describe('fetch（入口）', () => {
  it('許可していない送り元には CORS ヘッダーを付けずに 403', async () => {
    const res = await worker.fetch(new Request('https://api.example/analyze', { method: 'POST', headers: { Origin: 'https://evil.example' } }), env)
    expect(res.status).toBe(403)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('preflight に答える', async () => {
    const res = await worker.fetch(new Request('https://api.example/analyze', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
  })
})

describe('handleAnalyze', () => {
  it('Turnstile に失敗したら解析しない', async () => {
    turnstile(false)
    const spy = vi.fn()
    const res = await handleAnalyze(post(), env, analyzer(spy), ORIGIN)
    expect(res.status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
  })

  it('Turnstile のホスト名が違えば断る', async () => {
    turnstile(true, 'evil.example')
    const res = await handleAnalyze(post(), env, analyzer(vi.fn()), ORIGIN)
    expect(await res.json()).toEqual({ ok: false, error: 'turnstile_failed' })
  })

  it('検証に通れば、後始末した結果を返す', async () => {
    turnstile(true)
    const res = await handleAnalyze(post(), env, analyzer(async () => ({ kind: 'ok', label: { ...label, name: ' X ' } })), ORIGIN)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, result: { name: 'X' } })
  })

  it('読み取れなければ unreadable、上流の失敗は upstream_error', async () => {
    turnstile(true)
    const r1 = await handleAnalyze(post(), env, analyzer(async () => ({ kind: 'unreadable' })), ORIGIN)
    expect(await r1.json()).toEqual({ ok: false, error: 'unreadable' })
    const r2 = await handleAnalyze(post(), env, analyzer(async () => { throw new Error('boom') }), ORIGIN)
    expect(await r2.json()).toEqual({ ok: false, error: 'upstream_error' })
  })

  it('壊れた JSON は bad_request', async () => {
    const res = await handleAnalyze(new Request('https://api.example/analyze', { method: 'POST', body: '{' }), env, analyzer(vi.fn()), ORIGIN)
    expect(await res.json()).toEqual({ ok: false, error: 'bad_request' })
  })
})
