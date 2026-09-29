import type { RoastLevel } from '../../db'

// ライブラリの「棚」に並ぶジャケットの色。
//
// 産地（カフェ記録はカフェ名）から色相を、焙煎度から明度を決める。
// データモデルは増やさない＝**既存の全記録に遡って色が付く**のが狙い（入力も増やさない）。
//
// 重要: 生成した色の上にクリーム色の文字を載せるので、**必ずコントラスト比 4.5:1 以上に収める**。
// 自動生成の色は放っておくと読めない組み合わせが出るため、最後に明度を落として担保する。

export const JACKET_TEXT = '#F7EFE6'

export interface JacketColor {
  /** ジャケットの地色 */
  bg: string
  /** 地色の上に置く文字色（コントラスト担保済み） */
  text: string
}

/** 種が無い（産地もカフェ名も豆名も分からない）ときの色 */
const FALLBACK_BG = '#3a2a1e'

// 彩度は低めに固定する。世界観（落ち着いた上品さ・CLAUDE.md §9）から浮かせないため
const SATURATION = 0.34

// 焙煎度 → 明度の目安。浅いほど明るく、深いほど暗く
const ROAST_LIGHTNESS: Record<RoastLevel, number> = {
  'light': 0.46,
  'light-medium': 0.42,
  'medium': 0.38,
  'medium-dark': 0.32,
  'dark': 0.26,
}
const DEFAULT_LIGHTNESS = 0.36

function hashHue(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % 360
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] :
    hp < 2 ? [x, c, 0] :
    hp < 3 ? [0, c, x] :
    hp < 4 ? [0, x, c] :
    hp < 5 ? [x, 0, c] :
             [c, 0, x]
  const m = l - c / 2
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ]
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function channelLuminance(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

export function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ]
}

/** 2色のコントラスト比（1〜21）。WCAG の定義どおり */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a))
  const lb = relativeLuminance(hexToRgb(b))
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const MIN_CONTRAST = 4.5

/**
 * 産地・焙煎度からジャケットの色を導く。
 * seed が無ければ既定色。文字とのコントラストは必ず 4.5:1 以上になるよう明度を詰める。
 */
export function jacketColor(seed: string | undefined, roastLevel?: RoastLevel): JacketColor {
  const key = seed?.trim()
  if (!key) return { bg: FALLBACK_BG, text: JACKET_TEXT }

  const hue = hashHue(key)
  let lightness = roastLevel ? ROAST_LIGHTNESS[roastLevel] : DEFAULT_LIGHTNESS

  // 色相によっては同じ明度でも明るく見える（黄緑など）。文字が読めるまで落とす
  let bg = toHex(hslToRgb(hue, SATURATION, lightness))
  while (contrastRatio(bg, JACKET_TEXT) < MIN_CONTRAST && lightness > 0.08) {
    lightness -= 0.02
    bg = toHex(hslToRgb(hue, SATURATION, lightness))
  }

  return { bg, text: JACKET_TEXT }
}
