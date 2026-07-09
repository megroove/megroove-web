// データ提供パッケージの生成（端末内で完結。ネットワーク送信は一切行わない）

import {
  getAllBrews, getAllBeans, getAllEquipment, getAllCafeVisits,
  getOrCreateUserSecret,
} from '../db'
import type { DataScope, ProvisionPackage } from './types'
import { PROVISION_FORMAT } from './types'
import { buildProvisionRecords } from './anonymize'

export * from './types'
export * from './anonymize'

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

// パートナーごとに異なる仮名IDを導出する。
// HMAC なので同じパートナーには常に同じID（ポイント継続）、
// パートナーが異なればIDも異なる（企業間の突合を防止）。
export async function derivePseudoId(userSecretHex: string, partnerId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBytes(userSecretHex).buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(partnerId))
  return bytesToHex(new Uint8Array(sig))
}

function localDateOnly(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export interface BuildOptions {
  scopes: DataScope[]
  periodMonths: number | null // null = 全期間
  partnerId?: string          // パートナー未定の間は 'preview'
}

export async function buildProvisionPackage(options: BuildOptions): Promise<ProvisionPackage> {
  const { scopes, periodMonths, partnerId = 'preview' } = options

  const [brews, beans, equipment, visits, userSecret] = await Promise.all([
    getAllBrews(), getAllBeans(), getAllEquipment(), getAllCafeVisits(),
    getOrCreateUserSecret(),
  ])

  const now = new Date()
  const to = localDateOnly(now)
  let from: string
  if (periodMonths === null) {
    const firstDates = [
      ...brews.map(b => b.brewedAt),
      ...visits.map(v => v.visitedAt),
    ].sort()
    from = firstDates.length > 0 ? localDateOnly(new Date(firstDates[0])) : to
  } else {
    const d = new Date(now.getFullYear(), now.getMonth() - periodMonths, now.getDate())
    from = localDateOnly(d)
  }

  const period = { from, to }
  const { records, monthlyStats } = buildProvisionRecords(
    scopes,
    { brews, beans, equipment, visits },
    period,
  )

  return {
    format: PROVISION_FORMAT,
    schemaVersion: 1,
    generatedAt: to,
    pseudoId: await derivePseudoId(userSecret, partnerId),
    partnerId,
    consentScopes: scopes,
    period,
    records,
    monthlyStats,
  }
}
