import type { CounterStore, QuotaScope } from './quota'

// テスト用の CounterStore（D1 と同じ振る舞いをメモリで）
export class MemoryCounterStore implements CounterStore {
  rows = new Map<string, { day: string; count: number }>()
  private id = (day: string, scope: QuotaScope, key: string) => `${day}|${scope}|${key}`

  async tryIncrement(day: string, scope: QuotaScope, key: string, limit: number) {
    const row = this.rows.get(this.id(day, scope, key)) ?? { day, count: 0 }
    if (row.count >= limit) return false
    this.rows.set(this.id(day, scope, key), { day, count: row.count + 1 })
    return true
  }
  async decrement(day: string, scope: QuotaScope, key: string) {
    const row = this.rows.get(this.id(day, scope, key))
    if (row && row.count > 0) row.count--
  }
  async count(day: string, scope: QuotaScope, key: string) {
    return this.rows.get(this.id(day, scope, key))?.count ?? 0
  }
  async purgeBefore(day: string) {
    for (const [k, row] of this.rows) if (row.day < day) this.rows.delete(k)
  }
}
