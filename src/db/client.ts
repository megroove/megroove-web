import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Bean, Equipment, Recipe, Brew, CafeVisit } from './types'

interface MegrooveDB extends DBSchema {
  beans:      { key: string; value: Bean }
  equipment:  { key: string; value: Equipment }
  recipes:    { key: string; value: Recipe }
  brews:      { key: string; value: Brew;      indexes: { byBrewedAt:  string } }
  cafeVisits: { key: string; value: CafeVisit; indexes: { byVisitedAt: string } }
}

const DB_NAME = 'megroove'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<MegrooveDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<MegrooveDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('beans',     { keyPath: 'id' })
          db.createObjectStore('equipment', { keyPath: 'id' })
          db.createObjectStore('recipes',   { keyPath: 'id' })
          db.createObjectStore('brews',     { keyPath: 'id' })
            .createIndex('byBrewedAt', 'brewedAt')
        }
        if (oldVersion < 2) {
          db.createObjectStore('cafeVisits', { keyPath: 'id' })
            .createIndex('byVisitedAt', 'visitedAt')
        }
      },
    })
  }
  return dbPromise
}

// ─── Bean ────────────────────────────────────────────────────────────────────

export async function getAllBeans(): Promise<Bean[]> {
  return (await getDB()).getAll('beans')
}
export async function getBean(id: string): Promise<Bean | undefined> {
  return (await getDB()).get('beans', id)
}
export async function putBean(bean: Bean): Promise<void> {
  await (await getDB()).put('beans', bean)
}
export async function deleteBean(id: string): Promise<void> {
  await (await getDB()).delete('beans', id)
}

// ─── Equipment ───────────────────────────────────────────────────────────────

export async function getAllEquipment(): Promise<Equipment[]> {
  return (await getDB()).getAll('equipment')
}
export async function getEquipment(id: string): Promise<Equipment | undefined> {
  return (await getDB()).get('equipment', id)
}
export async function putEquipment(item: Equipment): Promise<void> {
  await (await getDB()).put('equipment', item)
}
export async function deleteEquipment(id: string): Promise<void> {
  await (await getDB()).delete('equipment', id)
}

// ─── Recipe ──────────────────────────────────────────────────────────────────

export async function getAllRecipes(): Promise<Recipe[]> {
  return (await getDB()).getAll('recipes')
}
export async function getRecipe(id: string): Promise<Recipe | undefined> {
  return (await getDB()).get('recipes', id)
}
export async function putRecipe(recipe: Recipe): Promise<void> {
  await (await getDB()).put('recipes', recipe)
}
export async function deleteRecipe(id: string): Promise<void> {
  await (await getDB()).delete('recipes', id)
}

// ─── Brew ────────────────────────────────────────────────────────────────────

export async function getAllBrews(): Promise<Brew[]> {
  return (await getDB()).getAllFromIndex('brews', 'byBrewedAt')
}
export async function getBrew(id: string): Promise<Brew | undefined> {
  return (await getDB()).get('brews', id)
}
export async function putBrew(brew: Brew): Promise<void> {
  await (await getDB()).put('brews', brew)
}
export async function deleteBrew(id: string): Promise<void> {
  await (await getDB()).delete('brews', id)
}
export async function getBrewCount(): Promise<number> {
  return (await getDB()).count('brews')
}

// ─── CafeVisit ───────────────────────────────────────────────────────────────

export async function getAllCafeVisits(): Promise<CafeVisit[]> {
  return (await getDB()).getAllFromIndex('cafeVisits', 'byVisitedAt')
}
export async function getCafeVisit(id: string): Promise<CafeVisit | undefined> {
  return (await getDB()).get('cafeVisits', id)
}
export async function putCafeVisit(visit: CafeVisit): Promise<void> {
  await (await getDB()).put('cafeVisits', visit)
}
export async function deleteCafeVisit(id: string): Promise<void> {
  await (await getDB()).delete('cafeVisits', id)
}

// ─── Clear all ───────────────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['beans', 'equipment', 'recipes', 'brews', 'cafeVisits'],
    'readwrite',
  )
  await Promise.all([
    tx.objectStore('beans').clear(),
    tx.objectStore('equipment').clear(),
    tx.objectStore('recipes').clear(),
    tx.objectStore('brews').clear(),
    tx.objectStore('cafeVisits').clear(),
  ])
  await tx.done
}
