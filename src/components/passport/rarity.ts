import type { Rarity } from '../../db'
import { COFFEE_COUNTRIES } from '../../db'

// 稀少度の見せ方。
//
// 狙いは「埋まらない穴」を「見つけたら自慢できる当たり」に変えること。
// レコードの世界にゴールドディスク/プラチナディスクという言い方があるので、
// 金属の階級はこのアプリの世界観に素直に乗る。
//
// 色だけで階級を語らない（§9）: ゴールドは輝き、プラチナは二重リングで**形でも**区別する。
// 階級名も必ずテキストで出すこと。

export interface RarityStyle {
  label: string
  /** 一言説明。進捗の行に添える */
  hint: string
  /** リングと見出しの色。カード地(#2E2018)に対して 4.5:1 以上（§9）を確認済み */
  color: string
  /** スタンプの縁に足す装飾。色以外の手がかり。無印は undefined */
  shadow?: string
}

export const RARITY_STYLE: Record<Rarity, RarityStyle> = {
  bronze: {
    label: 'ブロンズ',
    hint: '量販店でも見かける',
    color: '#C8864F', // 5.08:1
  },
  silver: {
    label: 'シルバー',
    hint: '専門店なら並んでいる',
    color: '#C8CDD2', // 9.56:1
  },
  gold: {
    label: 'ゴールド',
    hint: '扱う店を探したい',
    color: '#E3B341', // 7.86:1
    shadow: '0 0 10px -2px #E3B341',
  },
  platinum: {
    label: 'プラチナ',
    hint: 'めったに出会えない',
    color: '#D5E3EC', // 11.7:1
    // 二重リング。シルバーと色が近いぶん、形で確実に見分けられるようにする
    shadow: '0 0 0 2px #2E2018, 0 0 0 4px #D5E3EC',
  },
}

const RARITY_OF = new Map(COFFEE_COUNTRIES.map(c => [c.name, c.rarity]))

/** 産地の稀少度。マスターに無い産地は null */
export function rarityOf(country: string): Rarity | null {
  return RARITY_OF.get(country) ?? null
}
