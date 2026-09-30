import type { Bean } from '../../db'

// 月ごとの記録を「1枚のアルバム」として見せるための集計。
//
// 既存の方針を踏襲する:
//  - 枚数には未評価も数える（淹れた事実だから）
//  - 平均は評価済みだけで割る（未評価は分析に混ぜない）
//  - ジャケットは「その月のベストの一杯」の写真。無ければ最も多かった産地の色に落とす

export interface MonthAlbumSource {
  /** 表示用の識別子 */
  id: string
  /** 記録日時（ISO） */
  at: string
  rating?: number
  photoDataUrl?: string
  /** 色の種（産地。無ければ豆名やカフェ名） */
  seed?: string
  /** 色の濃さ（ブリューのみ。カフェ記録は持たない） */
  roastLevel?: Bean['roastLevel']
}

export interface MonthAlbum {
  /** groupByMonth と同じラベル（例: 2026年9月） */
  label: string
  count: number
  /** 評価済みの平均。評価が無ければ null */
  avgRating: number | null
  /** ジャケットに使う写真（その月のベストの一杯） */
  photoUrl?: string
  /** 写真が無いときの色の種 */
  seed?: string
  roastLevel?: Bean['roastLevel']
}

export function monthLabelOf(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

/**
 * 月ごとの要約を作る。
 * **絞り込み後の全件**を渡すこと（段階読み込みで表示中のぶんだけ渡すと枚数がずれる）。
 */
export function calcMonthAlbums(sources: MonthAlbumSource[]): Map<string, MonthAlbum> {
  const byMonth = new Map<string, MonthAlbumSource[]>()
  for (const s of sources) {
    const label = monthLabelOf(s.at)
    const list = byMonth.get(label)
    if (list) list.push(s)
    else byMonth.set(label, [s])
  }

  const albums = new Map<string, MonthAlbum>()
  for (const [label, list] of byMonth) {
    const ratings = list
      .map(s => s.rating)
      .filter((r): r is number => typeof r === 'number' && r > 0)

    // ジャケット: 写真を持つ記録のうち最高評価のもの（同点は新しい方）
    const withPhoto = list
      .filter(s => s.photoDataUrl)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.at.localeCompare(a.at))
    // 色の種: その月で最も多かった産地（写真が無いときに使う）
    const seedCounts = new Map<string, number>()
    for (const s of list) {
      if (s.seed) seedCounts.set(s.seed, (seedCounts.get(s.seed) ?? 0) + 1)
    }
    const topSeed = [...seedCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
    const seedOwner = topSeed ? list.find(s => s.seed === topSeed) : undefined

    albums.set(label, {
      label,
      count: list.length,
      avgRating: ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null,
      photoUrl: withPhoto[0]?.photoDataUrl,
      seed: topSeed,
      roastLevel: seedOwner?.roastLevel,
    })
  }
  return albums
}
