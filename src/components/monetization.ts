import config from '../config/monetization.json'
import type { RoastLevel } from '../db'
import type { RadarScores } from './analysis/RadarChart'
import { SCORE_KEYS, type ScoreKey } from './analysis/stats'

// 収益化の土台（応援の入口とアフィリエイト枠）。中身は src/config/monetization.json で管理し、コードは変えない。
// - 応援: URL が空なら入口を出さない。ポップアップやお願いは出さず、設定画面に1行だけ置く
// - アフィリエイト: enabled が false なら何も出さない。出すときは必ず「PR」を添え、文字のリンクだけにする
//   （画像やタグを読み込まない＝開いただけで外部に何も送らない・CSP も変えない）

export interface AffiliateItem {
  id: string
  title: string
  description?: string
  url: string
  /**
   * 好みと照らし合わせるタグ。書式:
   *   roast:light|light-medium|medium|medium-dark|dark ／ country:エチオピア ／ process:ナチュラル ／
   *   taste:acidity|sweetness|bitterness|body|aftertaste（最近 ★4 以上で強まっている味）
   */
  tags: string[]
}

export interface MonetizationConfig {
  support: { url: string; service: string }
  affiliate: { enabled: boolean; items: AffiliateItem[] }
}

const isHttps = (u: unknown): u is string => {
  if (typeof u !== 'string') return false
  try { return new URL(u).protocol === 'https:' } catch { return false }
}

/** 設定の形を締める（http のリンクや欠けた項目は捨てる） */
export function parseMonetizationConfig(raw: unknown): MonetizationConfig {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const support = (o.support ?? {}) as Record<string, unknown>
  const affiliate = (o.affiliate ?? {}) as Record<string, unknown>
  const items = Array.isArray(affiliate.items) ? affiliate.items : []
  return {
    support: {
      url: isHttps(support.url) ? support.url : '',
      service: typeof support.service === 'string' ? support.service : '',
    },
    affiliate: {
      enabled: affiliate.enabled === true,
      items: items.flatMap((it): AffiliateItem[] => {
        const x = (typeof it === 'object' && it !== null ? it : {}) as Record<string, unknown>
        if (typeof x.id !== 'string' || typeof x.title !== 'string' || !isHttps(x.url)) return []
        return [{
          id: x.id,
          title: x.title,
          description: typeof x.description === 'string' ? x.description : undefined,
          url: x.url,
          tags: Array.isArray(x.tags) ? x.tags.filter((t): t is string => typeof t === 'string') : [],
        }]
      }),
    },
  }
}

export const MONETIZATION = parseMonetizationConfig(config)

// ─── アフィリエイトの選び方（純粋関数） ─────────────────────────────────────────

export interface PreferenceTagsInput {
  roastLevel?: RoastLevel
  country?: string
  process?: string
  /** currentPreference().direction（★4 以上の平均 − 全体の平均） */
  direction?: RadarScores
}

const TASTE_MIN = 0.2 // これ未満の差は「好みの傾向」とみなさない

/** 今の好みをタグにする */
export function preferenceTags(p: PreferenceTagsInput): string[] {
  const tags: string[] = []
  if (p.roastLevel) tags.push(`roast:${p.roastLevel}`)
  if (p.country) tags.push(`country:${p.country}`)
  if (p.process) tags.push(`process:${p.process}`)
  if (p.direction) {
    const top = SCORE_KEYS
      .map(k => [k, p.direction![k]] as [ScoreKey, number | undefined])
      .filter((e): e is [ScoreKey, number] => e[1] !== undefined && e[1] >= TASTE_MIN)
      .sort((a, b) => b[1] - a[1])[0]
    if (top) tags.push(`taste:${top[0]}`)
  }
  return tags
}

/** タグが1つ以上重なるものを、重なりの多い順（同点は設定の順）に最大 limit 件。無効なら空 */
export function pickAffiliateItems(cfg: MonetizationConfig['affiliate'], tags: string[], limit = 2): AffiliateItem[] {
  if (!cfg.enabled || tags.length === 0) return []
  const set = new Set(tags)
  return cfg.items
    .map((item, i) => ({ item, i, score: item.tags.filter(t => set.has(t)).length }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map(e => e.item)
}
