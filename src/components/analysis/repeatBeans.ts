import type { Bean, Brew } from '../../db'
import { beanBagsOf, beanLineageId } from '../../db'

// リピートしている豆。
//
// 「同じ豆を何度も買っている」こと自体が、星評価より正直な「本当に好きな豆」の証拠になる。
// 袋ごとに Bean があるので、系統（lineageId）単位でまとめ直してから数える。

export interface RepeatBean {
  /** 系統の代表。**最新の袋**を使う（名前や写真は今の袋のものが自然） */
  bean: Bean
  /** 買った袋の数 */
  bags: number
  /** 全袋の合計杯数（未評価も数える） */
  cups: number
  /** 評価済みだけの平均。無ければ null */
  avgRating: number | null
}

/**
 * 2袋以上買った豆を、袋数の多い順に返す。
 * 杯数は未評価も数え、平均は評価済みだけで割る（既存の集計と同じ方針）。
 */
export function calcRepeatBeans(beans: Bean[], brews: Brew[]): RepeatBean[] {
  const cupsByBean = new Map<string, Brew[]>()
  for (const b of brews) {
    if (!b.beanId) continue
    const list = cupsByBean.get(b.beanId)
    if (list) list.push(b)
    else cupsByBean.set(b.beanId, [b])
  }

  const seen = new Set<string>()
  const out: RepeatBean[] = []

  for (const bean of beans) {
    const lineage = beanLineageId(bean)
    if (seen.has(lineage)) continue
    seen.add(lineage)

    const bags = beanBagsOf(bean, beans)
    if (bags.length < 2) continue

    const cups = bags.flatMap(b => cupsByBean.get(b.id) ?? [])
    const ratings = cups
      .map(c => c.rating)
      .filter((r): r is number => typeof r === 'number' && r > 0)

    out.push({
      bean: bags[bags.length - 1], // 最新の袋を代表にする
      bags: bags.length,
      cups: cups.length,
      avgRating: ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null,
    })
  }

  return out.sort(
    (a, b) => b.bags - a.bags || b.cups - a.cups || a.bean.name.localeCompare(b.bean.name),
  )
}
