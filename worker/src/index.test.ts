import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LabelAnalyzer } from './analyzer'
import type { BeanLabel } from './beanLabel'
import worker, { allowedOrigin, handleAnalyze, handleQuota, type Env } from './index'
import { MemoryCounterStore } from './memoryCounterStore'

const env: Env = {
  ANTHROPIC_API_KEY: 'x', TURNSTILE_SECRET: 's', HASH_SECRET: 'h',
  ALLOWED_ORIGINS: 'https://megroove.github.io', TURNSTILE_HOSTNAME: 'megroove.github.io',
  LIMIT_DEVICE: '1', LIMIT_IP: '5', LIMIT_GLOBAL: '50',
  DB: undefined as unknown as D1Database,
}
const NOW = new Date('2026-11-09T03:00:00Z')
const ORIGIN = 'https://megroove.github.io'
const JPEG = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, ...new Array(28).fill(0)))
const DEVICE = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e'
const body = { images: [{ data: JPEG }], turnstileToken: 'tok', deviceId: DEVICE }
const post = (b: unknown = body, ip = '203.0.113.5') => new Request('https://api.example/analyze', {
  method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(b),
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
    const res = await handleAnalyze(post(), env, analyzer(spy), ORIGIN, new MemoryCounterStore(), NOW)
    expect(res.status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
  })

  it('Turnstile のホスト名が違えば断る', async () => {
    turnstile(true, 'evil.example')
    const res = await handleAnalyze(post(), env, analyzer(vi.fn()), ORIGIN, new MemoryCounterStore(), NOW)
    expect(await res.json()).toEqual({ ok: false, error: 'turnstile_failed' })
  })

  it('検証に通れば、後始末した結果を返す', async () => {
    turnstile(true)
    const res = await handleAnalyze(post(), env, analyzer(async () => ({ kind: 'ok', label: { ...label, name: ' X ' } })), ORIGIN, new MemoryCounterStore(), NOW)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, result: { name: 'X' } })
  })

  it('読み取れなければ unreadable、上流の失敗は upstream_error', async () => {
    turnstile(true)
    const r1 = await handleAnalyze(post(), env, analyzer(async () => ({ kind: 'unreadable' })), ORIGIN, new MemoryCounterStore(), NOW)
    expect(await r1.json()).toEqual({ ok: false, error: 'unreadable' })
    const r2 = await handleAnalyze(post(), env, analyzer(async () => { throw new Error('boom') }), ORIGIN, new MemoryCounterStore(), NOW)
    expect(await r2.json()).toEqual({ ok: false, error: 'upstream_error' })
  })

  it('壊れた JSON は bad_request', async () => {
    const res = await handleAnalyze(new Request('https://api.example/analyze', { method: 'POST', body: '{' }), env, analyzer(vi.fn()), ORIGIN, new MemoryCounterStore(), NOW)
    expect(await res.json()).toEqual({ ok: false, error: 'bad_request' })
  })

  it('1日1回を超えたら解析せずに device_limit', async () => {
    turnstile(true)
    const store = new MemoryCounterStore()
    const ok = analyzer(async () => ({ kind: 'ok', label }))
    const r1 = await handleAnalyze(post(), env, ok, ORIGIN, store, NOW)
    expect(await r1.json()).toMatchObject({ ok: true, remaining: 0 })
    const spy = vi.fn()
    const r2 = await handleAnalyze(post(), env, analyzer(spy), ORIGIN, store, NOW)
    expect(r2.status).toBe(429)
    expect(await r2.json()).toEqual({ ok: false, error: 'device_limit' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('失敗したら端末の回数は返すが、IP と全体は数えたまま', async () => {
    turnstile(true)
    const store = new MemoryCounterStore()
    await handleAnalyze(post(), env, analyzer(async () => ({ kind: 'unreadable' })), ORIGIN, store, NOW)
    await handleAnalyze(post(), env, analyzer(async () => { throw new Error('boom') }), ORIGIN, store, NOW)
    await handleAnalyze(post(), env, analyzer(async () => ({ kind: 'ok', label: { ...label, isCoffeeLabel: false } })), ORIGIN, store, NOW)
    const counts = [...store.rows.entries()].map(([k, r]) => [k.split('|')[1], r.count])
    expect(counts).toEqual(expect.arrayContaining([['device', 0], ['ip', 3], ['global', 3]]))
    // 端末の枠は残っているので、成功すればまだ使える
    const r = await handleAnalyze(post(), env, analyzer(async () => ({ kind: 'ok', label })), ORIGIN, store, NOW)
    expect(r.status).toBe(200)
  })

  it('Turnstile に落ちたら枠を取らない', async () => {
    turnstile(false)
    const store = new MemoryCounterStore()
    await handleAnalyze(post(), env, analyzer(vi.fn()), ORIGIN, store, NOW)
    expect(store.rows.size).toBe(0)
  })

  it('IP の上限（端末を変えても）', async () => {
    turnstile(true)
    const store = new MemoryCounterStore()
    const ok = analyzer(async () => ({ kind: 'ok', label }))
    for (let i = 0; i < 5; i++) {
      const res = await handleAnalyze(post({ ...body, deviceId: DEVICE.slice(0, -1) + i }), env, ok, ORIGIN, store, NOW)
      expect(res.status).toBe(200)
    }
    const res = await handleAnalyze(post({ ...body, deviceId: DEVICE.slice(0, -1) + '9' }), env, ok, ORIGIN, store, NOW)
    expect(await res.json()).toEqual({ ok: false, error: 'ip_limit' })
  })

  it('前日より前の記録は消す', async () => {
    turnstile(true)
    const store = new MemoryCounterStore()
    store.rows.set('2026-11-07|ip|old', { day: '2026-11-07', count: 1 })
    store.rows.set('2026-11-08|ip|old', { day: '2026-11-08', count: 1 })
    await handleAnalyze(post(), env, analyzer(async () => ({ kind: 'ok', label })), ORIGIN, store, NOW)
    expect(store.rows.has('2026-11-07|ip|old')).toBe(false)
    expect(store.rows.has('2026-11-08|ip|old')).toBe(true)
  })
})

describe('handleQuota', () => {
  const get = (id: string) => new Request(`https://api.example/quota?deviceId=${id}`, { headers: { Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.5' } })

  it('使う前は1回、使ったあとは0回と理由', async () => {
    turnstile(true)
    const store = new MemoryCounterStore()
    expect(await (await handleQuota(get(DEVICE), env, ORIGIN, store, NOW)).json()).toEqual({ ok: true, remaining: 1, blockedBy: null })
    await handleAnalyze(post(), env, analyzer(async () => ({ kind: 'ok', label })), ORIGIN, store, NOW)
    expect(await (await handleQuota(get(DEVICE), env, ORIGIN, store, NOW)).json()).toEqual({ ok: true, remaining: 0, blockedBy: 'device' })
  })

  it('端末ID の形が違えば bad_request', async () => {
    const res = await handleQuota(get('nope'), env, ORIGIN, new MemoryCounterStore(), NOW)
    expect(res.status).toBe(400)
  })
})
