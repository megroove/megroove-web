import type { Bean, Equipment, Recipe, Brew } from './types'
import {
  getAllBeans, getAllEquipment, getAllRecipes, getAllBrews,
  putBean, putEquipment, putRecipe, putBrew,
  clearAllData,
} from './client'

interface BackupData {
  version: number
  exportedAt: string
  beans: Bean[]
  equipment: Equipment[]
  recipes: Recipe[]
  brews: Brew[]
}

export async function exportBackup(): Promise<void> {
  const [beans, equipment, recipes, brews] = await Promise.all([
    getAllBeans(), getAllEquipment(), getAllRecipes(), getAllBrews(),
  ])
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    beans, equipment, recipes, brews,
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
}

export interface ImportResult {
  beans: number
  equipment: number
  recipes: number
  brews: number
}

export async function parseBackupFile(file: File): Promise<BackupData> {
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
    beans:     data.beans?.length ?? 0,
    equipment: data.equipment?.length ?? 0,
    recipes:   data.recipes?.length ?? 0,
    brews:     data.brews?.length ?? 0,
  }
}

export async function importBackup(
  data: BackupData,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  if (mode === 'replace') await clearAllData()

  await Promise.all([
    ...(data.beans     ?? []).map(putBean),
    ...(data.equipment ?? []).map(putEquipment),
    ...(data.recipes   ?? []).map(putRecipe),
    ...(data.brews     ?? []).map(putBrew),
  ])

  return summarizeBackup(data)
}
