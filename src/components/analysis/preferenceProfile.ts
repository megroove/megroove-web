import type { Bean, Brew, CafeVisit, CuppingScores, RoastLevel } from '../../db'
import { toCountry } from '../passport/passportStats'
import type { RadarScores } from './RadarChart'
import { SCORE_KEYS, type ScoreKey } from './stats'

// ─── 好みプロファイル ─────────────────────────────────────────────────────────
// 全期間を単純に平均すると、好みの変化（以前は苦味好き → 最近は酸味好き）が打ち消し合って見えなくなる。
// そこで「以前」と「最近」に分けて比べ、さらに「よく飲んだ味」と「好きな味」を星で区別する。
// UI を持たない純粋関数だけを置く（テストで固定する）。

export interface PreferenceSettings {
  halfLifeDays: number    // 時間の重みが半分になる日数（currentPreference で使う）
  recentDays: number      // 「最近」とみなす直近の日数。それより前が「以前」
  changeThreshold: number // 変化とみなす軸ごとの差（1〜5 のスケール上）
  minCount: number        // 判定に必要な、各期間の最低件数
}

export const PREFERENCE_DEFAULTS: PreferenceSettings = {
  halfLifeDays: 30,
  recentDays: 30,
  changeThreshold: 0.5,
  minCount: 5,
}

const DAY_MS = 24 * 60 * 60 * 1000
const HIGH_RATING = 4 // これ以上を「好き」とみなす
const EPS = 1e-9      // しきい値ちょうどを浮動小数の誤差で取りこぼさない

// 抽出記録とカフェ記録を同じ形にそろえたもの
export interface TasteSample {
  at: number // ms
  rating: number
  cupping: CuppingScores
  roastLevel?: RoastLevel   // カフェ記録には無い
  country?: string | null
  process?: string          // カフェ記録には無い
}

const hasCupping = (c: CuppingScores | undefined): c is CuppingScores =>
  !!c && SCORE_KEYS.some(k => c[k] !== undefined)

// 星とカッピング（1軸以上）がそろった記録だけを対象にする（既存のレーダーと同じ条件）
export function collectTasteSamples(brews: Brew[], visits: CafeVisit[], beans: Bean[]): TasteSample[] {
  const beanById = new Map(beans.map(b => [b.id, b]))
  const samples: TasteSample[] = []
  for (const b of brews) {
    if (!((b.rating ?? 0) > 0) || !hasCupping(b.cupping)) continue
    const bean = b.beanId ? beanById.get(b.beanId) : undefined
    samples.push({
      at: Date.parse(b.brewedAt),
      rating: b.rating!,
      cupping: b.cupping,
      roastLevel: bean?.roastLevel,
      country: toCountry(bean?.origin),
      process: bean?.process?.trim() || undefined,
    })
  }
  for (const v of visits) {
    if (!((v.rating ?? 0) > 0) || !hasCupping(v.cupping)) continue
    samples.push({
      at: Date.parse(v.visitedAt),
      rating: v.rating!,
      cupping: v.cupping,
      country: toCountry(v.beanOrigin),
    })
  }
  return samples.filter(s => Number.isFinite(s.at))
}

// 経過日数に対する時間の重み（半減期で半分）。未来日付は 1 として扱う
export function decayWeight(ageDays: number, halfLifeDays: number): number {
  return Math.pow(0.5, Math.max(0, ageDays) / halfLifeDays)
}

function weightedAxes(samples: TasteSample[], weightOf: (s: TasteSample) => number): RadarScores {
  const scores: RadarScores = {}
  for (const key of SCORE_KEYS) {
    let sum = 0, total = 0
    for (const s of samples) {
      const val = s.cupping[key]
      const w = weightOf(s)
      if (val === undefined || !(w > 0)) continue
      sum += val * w
      total += w
    }
    if (total > 0) scores[key] = sum / total
  }
  return scores
}

// 好みの方向 = 「★4以上の平均 − 全体の平均」。正なら好きな一杯ほどその味が強い
function directionOf(samples: TasteSample[], weightOf: (s: TasteSample) => number): RadarScores {
  const all = weightedAxes(samples, weightOf)
  const liked = weightedAxes(samples.filter(s => s.rating >= HIGH_RATING), weightOf)
  const dir: RadarScores = {}
  for (const key of SCORE_KEYS) {
    const a = all[key], l = liked[key]
    if (a !== undefined && l !== undefined) dir[key] = l - a
  }
  return dir
}

// ─── 今の好み（将来の豆・カフェの提案に使う） ────────────────────────────────

export interface CurrentPreference {
  scores: RadarScores    // 時間減衰 × 星で重み付けした5軸の平均（1〜5）
  direction: RadarScores // 時間減衰つきの「★4以上の平均 − 全体の平均」
  count: number
}

export function currentPreference(
  samples: TasteSample[],
  now: Date,
  settings: Partial<PreferenceSettings> = {},
): CurrentPreference | null {
  const opt = { ...PREFERENCE_DEFAULTS, ...settings }
  if (samples.length < opt.minCount) return null
  const decay = (s: TasteSample) => decayWeight((now.getTime() - s.at) / DAY_MS, opt.halfLifeDays)
  return {
    scores: weightedAxes(samples, s => decay(s) * s.rating),
    direction: directionOf(samples, decay),
    count: samples.length,
  }
}

// ─── 以前と最近の比較 ─────────────────────────────────────────────────────────

export interface PeriodProfile {
  scores: RadarScores // 星で重み付けした5軸の平均（1〜5）。レーダーに重ねる
  count: number
}

export interface AxisChange { key: ScoreKey; diff: number } // diff = 最近 − 以前

export interface FavoriteSummary {
  roastLevel?: RoastLevel
  country?: string
  process?: string
}

export interface PreferenceProfile {
  enough: boolean          // false なら「もう少し記録すると傾向がわかります」
  total: number
  all: PeriodProfile       // 全期間（重ねる前の段階で1枚だけ見せるとき用）
  before: PeriodProfile
  recent: PeriodProfile
  changes: AxisChange[]    // しきい値以上の差がある軸（差の大きい順）。どちらかの期間が最低件数に満たなければ空
  leading: AxisChange | null
  favorites: FavoriteSummary
}

const UP_PHRASE: Record<ScoreKey, string> = {
  acidity: '酸味のある', sweetness: '甘みのある', bitterness: '苦味のある',
  body: 'ボディのしっかりした', aftertaste: '後味の長い',
}
const DOWN_PHRASE: Record<ScoreKey, string> = {
  acidity: '酸味の穏やかな', sweetness: '甘さ控えめな', bitterness: '苦味の控えめな',
  body: '軽やかな', aftertaste: '後味のすっきりした',
}

export function changeMessage(change: AxisChange): string {
  const phrase = change.diff > 0 ? UP_PHRASE[change.key] : DOWN_PHRASE[change.key]
  return `最近、${phrase}コーヒーを高く評価する傾向に変わってきています`
}

// 最も多い値（同数なら新しい記録で使われた方）。2件以上ないものは「お気に入り」と呼ばない
function modeOf<T>(samples: TasteSample[], pick: (s: TasteSample) => T | undefined | null): T | undefined {
  const acc = new Map<T, { n: number; last: number }>()
  for (const s of samples) {
    const v = pick(s)
    if (v === undefined || v === null) continue
    const cur = acc.get(v) ?? { n: 0, last: 0 }
    acc.set(v, { n: cur.n + 1, last: Math.max(cur.last, s.at) })
  }
  let best: T | undefined
  let bestN = 1, bestLast = -Infinity
  for (const [v, { n, last }] of acc) {
    if (n > bestN || (n === bestN && best !== undefined && last > bestLast)) {
      best = v; bestN = n; bestLast = last
    }
  }
  return best
}

export function calcPreferenceProfile(
  samples: TasteSample[],
  now: Date,
  settings: Partial<PreferenceSettings> = {},
): PreferenceProfile {
  const opt = { ...PREFERENCE_DEFAULTS, ...settings }
  const boundary = now.getTime() - opt.recentDays * DAY_MS
  const recentS = samples.filter(s => s.at > boundary)
  const beforeS = samples.filter(s => s.at <= boundary)
  const byRating = (s: TasteSample) => s.rating

  const before: PeriodProfile = { scores: weightedAxes(beforeS, byRating), count: beforeS.length }
  const recent: PeriodProfile = { scores: weightedAxes(recentS, byRating), count: recentS.length }

  const changes: AxisChange[] = []
  if (before.count >= opt.minCount && recent.count >= opt.minCount) {
    for (const key of SCORE_KEYS) {
      const b = before.scores[key], r = recent.scores[key]
      if (b === undefined || r === undefined) continue
      const diff = r - b
      if (Math.abs(diff) >= opt.changeThreshold - EPS) changes.push({ key, diff })
    }
    changes.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
  }
  // 文章にするのは上がった軸を優先（「◯◯を好むようになった」の方が伝わる）
  const leading = changes.find(c => c.diff > 0) ?? changes[0] ?? null

  const liked = recentS.filter(s => s.rating >= HIGH_RATING)
  const favorites: FavoriteSummary = {
    roastLevel: modeOf(liked, s => s.roastLevel),
    country: modeOf(liked, s => s.country),
    process: modeOf(liked, s => s.process),
  }

  return {
    enough: samples.length >= opt.minCount,
    total: samples.length,
    all: { scores: weightedAxes(samples, byRating), count: samples.length },
    before, recent, changes, leading, favorites,
  }
}
