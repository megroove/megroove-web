import type { Bean, Brew, CafeVisit, Continent } from '../../db'
import { COFFEE_COUNTRIES, CONTINENTS } from '../../db'

// 産地パスポートの集計。
//
// 肝は「国でまとめる」こと。産地は自由入力なので「エチオピア」「エチオピア イルガチェフェ」
// 「エチオピア シダモ」が別々に溜まってしまい、スタンプが散ってコレクション感が出ない。
// 集計だけ国に寄せ、**入力された文字列はそのまま残す**（地域は内訳として見せる）。
//
// 既存の方針も踏襲する: 杯数には未評価も数え、平均は評価済みだけで割る。

/** 国名の長い順。「コンゴ民主共和国」が「コンゴ」より先に当たるようにする */
const COUNTRIES_BY_LENGTH = [...COFFEE_COUNTRIES].sort((a, b) => b.name.length - a.name.length)

/**
 * 自由入力の産地から国名を取り出す。マスターにない書き方なら null。
 * 例: 「エチオピア イルガチェフェ」→「エチオピア」／「中国 雲南」→「中国」
 */
export function toCountry(origin: string | undefined): string | null {
  const s = origin?.trim()
  if (!s) return null
  for (const c of COUNTRIES_BY_LENGTH) {
    if (s === c.name || s.startsWith(c.name)) return c.name
  }
  return null
}

export interface PassportStamp {
  country: string
  continent: Continent
  /** 杯数（未評価も数える） */
  count: number
  /** 評価済みだけの平均。無ければ null */
  avgRating: number | null
  /** 入力された地域の表記（「エチオピア イルガチェフェ」等）。重複なし */
  regions: string[]
  /** 最初に記録した日（ISO） */
  firstAt: string
}

export interface ContinentProgress {
  continent: Continent
  visited: number
  total: number
  stamps: PassportStamp[]
  /** まだ記録のない国 */
  unvisited: string[]
}

export interface PassportSummary {
  stamps: PassportStamp[]
  byContinent: ContinentProgress[]
  visitedCount: number
  totalCountries: number
  /** マスターに無い書き方で記録された産地（スタンプにはできないが、記録はある） */
  unknownOrigins: string[]
}

interface OriginRecord {
  origin: string
  at: string
  rating?: number
}

function collectOrigins(brews: Brew[], beans: Bean[], visits: CafeVisit[]): OriginRecord[] {
  const beanMap = new Map(beans.map(b => [b.id, b]))
  const out: OriginRecord[] = []
  for (const b of brews) {
    const origin = b.beanId ? beanMap.get(b.beanId)?.origin : undefined
    if (origin?.trim()) out.push({ origin: origin.trim(), at: b.brewedAt, rating: b.rating })
  }
  for (const v of visits) {
    if (v.beanOrigin?.trim()) out.push({ origin: v.beanOrigin.trim(), at: v.visitedAt, rating: v.rating })
  }
  return out
}

export function calcPassport(brews: Brew[], beans: Bean[], visits: CafeVisit[]): PassportSummary {
  const records = collectOrigins(brews, beans, visits)

  const byCountry = new Map<string, { recs: OriginRecord[]; regions: Set<string> }>()
  const unknown = new Set<string>()

  for (const r of records) {
    const country = toCountry(r.origin)
    if (!country) {
      unknown.add(r.origin)
      continue
    }
    const cur = byCountry.get(country) ?? { recs: [], regions: new Set<string>() }
    cur.recs.push(r)
    // 国名そのものだけの入力は「地域」ではないので内訳に出さない
    if (r.origin !== country) cur.regions.add(r.origin)
    byCountry.set(country, cur)
  }

  const continentOf = new Map(COFFEE_COUNTRIES.map(c => [c.name, c.continent]))

  const stamps: PassportStamp[] = [...byCountry.entries()].map(([country, { recs, regions }]) => {
    const ratings = recs.map(r => r.rating).filter((n): n is number => typeof n === 'number' && n > 0)
    return {
      country,
      continent: continentOf.get(country)!,
      count: recs.length,
      avgRating: ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null,
      regions: [...regions].sort(),
      firstAt: recs.reduce((min, r) => (r.at < min ? r.at : min), recs[0].at),
    }
  }).sort((a, b) => b.count - a.count || a.country.localeCompare(b.country))

  const byContinent: ContinentProgress[] = CONTINENTS.map(continent => {
    const all = COFFEE_COUNTRIES.filter(c => c.continent === continent).map(c => c.name)
    const mine = stamps.filter(s => s.continent === continent)
    const got = new Set(mine.map(s => s.country))
    return {
      continent,
      visited: mine.length,
      total: all.length,
      stamps: mine,
      unvisited: all.filter(n => !got.has(n)),
    }
  })

  return {
    stamps,
    byContinent,
    visitedCount: stamps.length,
    totalCountries: COFFEE_COUNTRIES.length,
    unknownOrigins: [...unknown].sort(),
  }
}

/**
 * 記録に使われているのに産地が未登録の豆。
 * パスポートが埋まらない最大の原因なので、その場で埋められるようにする。
 */
export function listBeansMissingOrigin(
  brews: Brew[],
  beans: Bean[],
): { bean: Bean; count: number }[] {
  const used = new Map<string, number>()
  for (const b of brews) {
    if (b.beanId) used.set(b.beanId, (used.get(b.beanId) ?? 0) + 1)
  }
  return beans
    .filter(b => used.has(b.id) && !b.origin?.trim())
    .map(b => ({ bean: b, count: used.get(b.id)! }))
    .sort((a, b) => b.count - a.count || a.bean.name.localeCompare(b.bean.name))
}

/**
 * これから記録しようとしている産地が「はじめての国」かどうか。
 * 保存演出に一言添えるために使う。
 */
export function isNewCountry(
  origin: string | undefined,
  brews: Brew[],
  beans: Bean[],
  visits: CafeVisit[],
): string | null {
  const country = toCountry(origin)
  if (!country) return null
  const known = new Set(
    collectOrigins(brews, beans, visits)
      .map(r => toCountry(r.origin))
      .filter((c): c is string => c !== null),
  )
  return known.has(country) ? null : country
}
