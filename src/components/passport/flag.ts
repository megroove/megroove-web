import { COFFEE_COUNTRIES } from '../../db'

// スタンプの絵柄（国旗、および国旗を持たない産地の代替絵文字）。
//
// 国旗は画像ファイルを持たず、Unicode の「地域表示記号」のペア（'CO' → 🇨🇴）で出す。
// 43か国ぶんの SVG を抱えずに済み、CSP（img-src 'self' data: blob:）にも触れない。
//
// ただしフォントを持たない環境（Windows など）では旗にならず「CO」という文字に化ける。
// そこで **描けるかどうかを実測**し、描けない国は呼び出し側で頭文字表示に戻す。
// CLAUDE.md §9 の「UI アイコンに絵文字を使わない」は、OS 依存で見た目が崩れることを
// 避けるためのルール。ここは国旗＝国の識別子であり、崩れる環境では確実に退避するため例外とする。

const REGIONAL_A = 0x1f1e6 // 🇦
const ASCII_A = 'A'.charCodeAt(0)

/** 'CO' → '🇨🇴'。2文字の英大文字でなければ null */
export function toFlagEmoji(code: string | undefined): string | null {
  if (!code || !/^[A-Z]{2}$/.test(code)) return null
  return String.fromCodePoint(
    ...[...code].map(ch => REGIONAL_A + (ch.charCodeAt(0) - ASCII_A)),
  )
}

const COUNTRY_CODE = new Map(COFFEE_COUNTRIES.map(c => [c.name, c.code]))

/**
 * 国旗を持たない産地の代替絵柄。
 * ハワイは州であって国ではないため国旗絵文字が無い。州花のハイビスカスを当てる
 * （フラの絵文字は Unicode に存在せず、💃 は多くのフォントでフラメンコの踊り子に見えるため使わない）。
 */
const GLYPH_OVERRIDE: Record<string, string> = {
  'ハワイ': '\u{1F33A}', // 🌺 ハイビスカス
}

// 未割り当てのコードポイント。どのフォントも豆腐（□）で描くので、幅の比較の基準にする
const TOFU = '\u{10FFFF}'

// 測定用のキャンバス。undefined = 未作成、null = 使えない環境
let ctx: CanvasRenderingContext2D | null | undefined
const renderable = new Map<string, boolean>()

function measure(text: string): number {
  if (ctx === undefined) {
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
    ctx = canvas?.getContext('2d') ?? null
    if (ctx) ctx.font = '32px sans-serif'
  }
  return ctx ? ctx.measureText(text).width : 0
}

/**
 * その国旗を「1つの絵」として描けるか。
 *
 * 旗を持たない環境では地域表示記号が2文字ぶん横に並ぶので、
 * ペアの幅が1文字ずつの合計より明らかに狭ければ旗になっている、と判定できる。
 * 幅0（環境によって非表示にされる旗）も同じ式で弾ける。
 * 色のピクセル判定は使わない（Safari 等が canvas の読み出しにノイズを混ぜるため）。
 */
export function canRenderFlag(flag: string): boolean {
  const cached = renderable.get(flag)
  if (cached !== undefined) return cached
  const pair = measure(flag)
  const apart = [...flag].reduce((w, ch) => w + measure(ch), 0)
  const ok = pair > 0 && apart > 0 && pair < apart * 0.9
  renderable.set(flag, ok)
  return ok
}

/**
 * 国旗以外の単体絵文字が本当に描けるか（豆腐になっていないか）。
 * 未割り当てのコードポイントと同じ幅なら、フォントに無くて豆腐に落ちていると見なす。
 */
export function canRenderEmoji(emoji: string): boolean {
  const cached = renderable.get(emoji)
  if (cached !== undefined) return cached
  const width = measure(emoji)
  const ok = width > 0 && width !== measure(TOFU)
  renderable.set(emoji, ok)
  return ok
}

/** スタンプに出す絵柄。描けないときは null（呼び出し側は頭文字に戻す） */
export function stampGlyph(country: string): string | null {
  const override = GLYPH_OVERRIDE[country]
  if (override) return canRenderEmoji(override) ? override : null
  const flag = toFlagEmoji(COUNTRY_CODE.get(country))
  return flag && canRenderFlag(flag) ? flag : null
}
