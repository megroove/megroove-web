import type { Bean, Equipment, Recipe, Brew, CafeVisit } from './types'
import {
  getAllBeans, getAllEquipment, getAllRecipes, getAllBrews, getAllCafeVisits,
  putBean, putEquipment, putRecipe, putBrew, putCafeVisit,
  clearAllData, getMeta, setMeta, getOrCreateUserSecret,
} from './client'
import { saveLastExportAt } from './helpers'

interface BackupData {
  version: number
  exportedAt: string
  beans: Bean[]
  equipment: Equipment[]
  recipes: Recipe[]
  brews: Brew[]
  cafeVisits?: CafeVisit[]  // version 1 のファイルには存在しない（後方互換）
  userSecret?: string       // version 3 から。データ提供の仮名ID継続用（機種変更対応）
}

const MAX_IMPORT_FILE_SIZE = 100 * 1024 * 1024 // 100MB

// data: URL が JPEG / PNG / WebP / GIF / AVIF のいずれかに限定する
function isSafePhotoDataUrl(url: unknown): boolean {
  if (url === undefined || url === null) return true
  if (typeof url !== 'string') return false
  return /^data:image\/(jpeg|png|webp|gif|avif);base64,/.test(url)
}

export async function exportBackup(): Promise<void> {
  const [beans, equipment, recipes, brews, cafeVisits, userSecret] = await Promise.all([
    getAllBeans(), getAllEquipment(), getAllRecipes(), getAllBrews(), getAllCafeVisits(),
    getOrCreateUserSecret(),
  ])
  const data: BackupData = {
    version: 3,
    exportedAt: new Date().toISOString(),
    beans, equipment, recipes, brews, cafeVisits, userSecret,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `megroove-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  saveLastExportAt()
}

export interface ImportResult {
  beans: number
  equipment: number
  recipes: number
  brews: number
  cafeVisits: number
}

export async function parseBackupFile(file: File): Promise<BackupData> {
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    throw new Error('ファイルサイズが大きすぎます（最大100MB）')
  }
  const text = await file.text()
  let data: BackupData
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('JSONの解析に失敗しました')
  }
  if (typeof data.version !== 'number' || !Array.isArray(data.brews)) {
    throw new Error('バックアップファイルの形式が正しくありません')
  }
  return data
}

export function summarizeBackup(data: BackupData): ImportResult {
  return {
    beans:      data.beans?.length ?? 0,
    equipment:  data.equipment?.length ?? 0,
    recipes:    data.recipes?.length ?? 0,
    brews:      data.brews?.length ?? 0,
    cafeVisits: data.cafeVisits?.length ?? 0,
  }
}

export async function importBackup(
  data: BackupData,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  if (mode === 'replace') await clearAllData()

  const safeBrew = (b: Brew): Brew => ({
    ...b,
    photoDataUrl: isSafePhotoDataUrl(b.photoDataUrl) ? b.photoDataUrl : undefined,
  })
  const safeVisit = (v: CafeVisit): CafeVisit => ({
    ...v,
    photoDataUrl: isSafePhotoDataUrl(v.photoDataUrl) ? v.photoDataUrl : undefined,
  })

  await Promise.all([
    ...(data.beans      ?? []).map(putBean),
    ...(data.equipment  ?? []).map(putEquipment),
    ...(data.recipes    ?? []).map(putRecipe),
    ...(data.brews      ?? []).map(b => putBrew(safeBrew(b))),
    ...(data.cafeVisits ?? []).map(v => putCafeVisit(safeVisit(v))),
  ])

  // userSecret の復元: 完全置換はバックアップ側を採用、追加インポートは既存を優先
  if (typeof data.userSecret === 'string' && /^[0-9a-f]{64}$/.test(data.userSecret)) {
    if (mode === 'replace' || !(await getMeta('userSecret'))) {
      await setMeta('userSecret', data.userSecret)
    }
  }

  return summarizeBackup(data)
}
