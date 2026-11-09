// 1日の回数制限。判定は Worker だけが行い、アプリ側の表示は参考にとどめる。
//
// 数え方（ユーザー決定 2026-11-09）:
//   device … 利用者の「1日1回」。**成功したときだけ**減る（失敗したら返す）
//   ip / global … Claude を呼んだ回数そのもの。失敗も数える＝失敗を繰り返されても費用は global で必ず止まる
// 先に枠を取ってから解析し、失敗したら device だけ返す。将来ログインを足したら scope に user を足す。

export type QuotaScope = 'device' | 'ip' | 'global'

export interface Counter {
  scope: QuotaScope
  key: string
  limit: number
}

/** 回数の置き場（本番は D1、テストはメモリ） */
export interface CounterStore {
  /** 上限未満なら1足して true。上限に達していれば何もせず false */
  tryIncrement(day: string, scope: QuotaScope, key: string, limit: number): Promise<boolean>
  decrement(day: string, scope: QuotaScope, key: string): Promise<void>
  count(day: string, scope: QuotaScope, key: string): Promise<number>
  /** この日より前の記録を消す（IP 等を長く持たない） */
  purgeBefore(day: string): Promise<void>
}

/** 日本時間の日付（YYYY-MM-DD）。0時に切り替わる */
export function jstDay(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** 前日（記録を残すのは今日と前日だけ） */
export function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export type ReserveResult = { ok: true } | { ok: false; scope: QuotaScope }

/**
 * 並んだ順に枠を取る。途中で上限に当たったら、それまでに取った枠を返して、当たった scope を伝える。
 * 並びは device → ip → global（利用者に一番近い理由から伝える）
 */
export async function reserve(store: CounterStore, day: string, counters: Counter[]): Promise<ReserveResult> {
  const taken: Counter[] = []
  for (const c of counters) {
    if (!(await store.tryIncrement(day, c.scope, c.key, c.limit))) {
      for (const t of taken) await store.decrement(day, t.scope, t.key)
      return { ok: false, scope: c.scope }
    }
    taken.push(c)
  }
  return { ok: true }
}

export interface RemainingResult {
  /** 今日あと何回使えるか（3つの上限のうち最も小さい残り） */
  remaining: number
  /** 0回のとき、どの上限によるか */
  blockedBy: QuotaScope | null
}

export async function remaining(store: CounterStore, day: string, counters: Counter[]): Promise<RemainingResult> {
  let min = Infinity
  let blockedBy: QuotaScope | null = null
  for (const c of counters) {
    const left = Math.max(0, c.limit - await store.count(day, c.scope, c.key))
    if (left < min) min = left
    if (left === 0 && !blockedBy) blockedBy = c.scope
  }
  return { remaining: Number.isFinite(min) ? min : 0, blockedBy }
}

/** 端末ID・IP は元に戻せない形にしてから置く（鍵付きなので総当たりでも戻せない） */
export async function hashKey(secret: string, scope: QuotaScope, value: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${scope}:${value}`))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface QuotaLimits { device: number; ip: number; global: number }

/** wrangler の vars（文字列）から上限を読む。壊れた値は安全側（0＝使えない）に倒す */
export function parseLimits(vars: { LIMIT_DEVICE?: string; LIMIT_IP?: string; LIMIT_GLOBAL?: string }): QuotaLimits {
  const n = (v: string | undefined) => {
    const x = Number(v)
    return Number.isInteger(x) && x >= 0 ? x : 0
  }
  return { device: n(vars.LIMIT_DEVICE), ip: n(vars.LIMIT_IP), global: n(vars.LIMIT_GLOBAL) }
}

/** 1リクエストで使う3つの数え口 */
export async function countersFor(
  secret: string, limits: QuotaLimits, deviceId: string, ip: string | null,
): Promise<Counter[]> {
  return [
    { scope: 'device', key: await hashKey(secret, 'device', deviceId), limit: limits.device },
    { scope: 'ip', key: await hashKey(secret, 'ip', ip ?? 'unknown'), limit: limits.ip },
    { scope: 'global', key: 'all', limit: limits.global },
  ]
}

// ─── D1 ───────────────────────────────────────────────────────────────────────

export class D1CounterStore implements CounterStore {
  constructor(private db: D1Database) {}

  async tryIncrement(day: string, scope: QuotaScope, key: string, limit: number): Promise<boolean> {
    if (limit <= 0) return false
    // 1文で「上限未満なら足す」。上限なら UPDATE の WHERE で何も起きず、RETURNING が空になる
    const row = await this.db.prepare(
      `INSERT INTO usage (day, scope, key, count) VALUES (?1, ?2, ?3, 1)
       ON CONFLICT (day, scope, key) DO UPDATE SET count = count + 1 WHERE count < ?4
       RETURNING count`,
    ).bind(day, scope, key, limit).first<{ count: number }>()
    return row !== null
  }

  async decrement(day: string, scope: QuotaScope, key: string): Promise<void> {
    await this.db.prepare(
      'UPDATE usage SET count = count - 1 WHERE day = ?1 AND scope = ?2 AND key = ?3 AND count > 0',
    ).bind(day, scope, key).run()
  }

  async count(day: string, scope: QuotaScope, key: string): Promise<number> {
    const row = await this.db.prepare(
      'SELECT count FROM usage WHERE day = ?1 AND scope = ?2 AND key = ?3',
    ).bind(day, scope, key).first<{ count: number }>()
    return row?.count ?? 0
  }

  async purgeBefore(day: string): Promise<void> {
    await this.db.prepare('DELETE FROM usage WHERE day < ?1').bind(day).run()
  }
}
