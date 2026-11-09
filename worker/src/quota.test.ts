import { describe, expect, it } from 'vitest'
import { MemoryCounterStore } from './memoryCounterStore'
import { countersFor, hashKey, jstDay, parseLimits, previousDay, remaining, reserve, type Counter } from './quota'

const counters: Counter[] = [
  { scope: 'device', key: 'd1', limit: 1 },
  { scope: 'ip', key: 'i1', limit: 5 },
  { scope: 'global', key: 'all', limit: 50 },
]

describe('jstDay', () => {
  it('日本時間の0時で切り替わる', () => {
    expect(jstDay(new Date('2026-11-09T14:59:59Z'))).toBe('2026-11-09') // 23:59 JST
    expect(jstDay(new Date('2026-11-09T15:00:00Z'))).toBe('2026-11-10') // 0:00 JST
  })
  it('前日は月・年をまたげる', () => {
    expect(previousDay('2027-01-01')).toBe('2026-12-31')
    expect(previousDay('2028-03-01')).toBe('2028-02-29')
  })
})

describe('reserve', () => {
  it('上限まで取れて、超えたらどの上限かを返す', async () => {
    const store = new MemoryCounterStore()
    expect(await reserve(store, '2026-11-09', counters)).toEqual({ ok: true })
    expect(await reserve(store, '2026-11-09', counters)).toEqual({ ok: false, scope: 'device' })
    // 日が変われば戻る
    expect(await reserve(store, '2026-11-10', counters)).toEqual({ ok: true })
  })

  it('途中で当たったら、先に取った枠を返す', async () => {
    const store = new MemoryCounterStore()
    const full = counters.map(c => c.scope === 'global' ? { ...c, limit: 0 } : c)
    expect(await reserve(store, 'd', full)).toEqual({ ok: false, scope: 'global' })
    expect(await store.count('d', 'device', 'd1')).toBe(0)
    expect(await store.count('d', 'ip', 'i1')).toBe(0)
  })

  it('IP の上限は端末をまたいで効く', async () => {
    const store = new MemoryCounterStore()
    for (let i = 0; i < 5; i++) {
      const cs = counters.map(c => c.scope === 'device' ? { ...c, key: `d${i}` } : c)
      expect((await reserve(store, 'd', cs)).ok).toBe(true)
    }
    const sixth = counters.map(c => c.scope === 'device' ? { ...c, key: 'd9' } : c)
    expect(await reserve(store, 'd', sixth)).toEqual({ ok: false, scope: 'ip' })
    expect(await store.count('d', 'device', 'd9')).toBe(0)
  })
})

describe('remaining', () => {
  it('3つのうち最も小さい残りと、0なら理由を返す', async () => {
    const store = new MemoryCounterStore()
    expect(await remaining(store, 'd', counters)).toEqual({ remaining: 1, blockedBy: null })
    await reserve(store, 'd', counters)
    expect(await remaining(store, 'd', counters)).toEqual({ remaining: 0, blockedBy: 'device' })
  })
})

describe('parseLimits / hashKey', () => {
  it('壊れた上限は 0（使えない）に倒す', () => {
    expect(parseLimits({ LIMIT_DEVICE: '1', LIMIT_IP: '5', LIMIT_GLOBAL: '50' })).toEqual({ device: 1, ip: 5, global: 50 })
    expect(parseLimits({ LIMIT_DEVICE: 'x', LIMIT_IP: '-1' })).toEqual({ device: 0, ip: 0, global: 0 })
  })

  it('元の値を含まず、鍵と scope で変わる', async () => {
    const a = await hashKey('s1', 'ip', '203.0.113.5')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toContain('203')
    expect(await hashKey('s2', 'ip', '203.0.113.5')).not.toBe(a)
    expect(await hashKey('s1', 'device', '203.0.113.5')).not.toBe(a)
  })

  it('IP が無ければ unknown として数える', async () => {
    const cs = await countersFor('s', { device: 1, ip: 5, global: 50 }, 'dev', null)
    expect(cs.map(c => c.scope)).toEqual(['device', 'ip', 'global'])
    expect(cs[1].key).toBe(await hashKey('s', 'ip', 'unknown'))
  })
})
