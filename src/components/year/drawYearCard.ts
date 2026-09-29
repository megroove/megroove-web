import type { YearStats } from './yearStats'
import { formatDose } from './yearStats'

// 1年の記録を LP ジャケット風の1枚に描く。
// html2canvas のような依存は足さず、Canvas 2D で直接描く（resizeImage() と同じ流儀）。
// 外部送信は一切しない ― 描いた PNG をどうするかは利用者が決める。

export const CARD_SIZE = 1080

const BG = '#1a0a05'
const CREAM = '#F7EFE6'
const TAN = '#A8916F'
const CORAL = '#9E4023'
const LINE = '#3a2a1e'

const FONT = 'system-ui, -apple-system, sans-serif'

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let s = text
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) {
    s = s.slice(0, -1)
  }
  return s + '…'
}

function drawDisc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, year: number) {
  ctx.save()

  // 盤
  const disc = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.1, cx, cy, r)
  disc.addColorStop(0, '#1c1714')
  disc.addColorStop(1, '#0c0907')
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // 溝
  ctx.strokeStyle = '#2b2320'
  ctx.lineWidth = Math.max(1, r * 0.012)
  for (let i = 0.92; i > 0.44; i -= 0.07) {
    ctx.beginPath()
    ctx.arc(cx, cy, r * i, 0, Math.PI * 2)
    ctx.stroke()
  }

  // レーベル（年を刷る）
  ctx.fillStyle = CORAL
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = CREAM
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(r * 0.26)}px ${FONT}`
  ctx.fillText(String(year), cx, cy - r * 0.04)
  ctx.font = `400 ${Math.round(r * 0.075)}px ${FONT}`
  ctx.fillStyle = 'rgba(247,239,230,0.75)'
  ctx.fillText('MEGROOVE', cx, cy + r * 0.16)

  // スピンドル穴
  ctx.fillStyle = '#140b07'
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.035, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

/** 統計を 1080×1080 のカードとして描く */
export function drawYearCard(canvas: HTMLCanvasElement, stats: YearStats): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = CARD_SIZE
  canvas.height = CARD_SIZE
  const P = 72
  const RIGHT = CARD_SIZE - P

  // 背景
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)
  const glow = ctx.createRadialGradient(CARD_SIZE * 0.74, CARD_SIZE * 0.22, 40, CARD_SIZE * 0.74, CARD_SIZE * 0.22, CARD_SIZE * 0.6)
  glow.addColorStop(0, 'rgba(138,90,52,0.26)')
  glow.addColorStop(1, 'rgba(138,90,52,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)

  ctx.textBaseline = 'alphabetic'

  // ── 見出し ──────────────────────────────────────────────────────────────
  ctx.textAlign = 'left'
  ctx.fillStyle = TAN
  ctx.font = `600 28px ${FONT}`
  ctx.letterSpacing = '6px'
  ctx.fillText('YEAR IN COFFEE', P, 104)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = CREAM
  ctx.font = `700 126px ${FONT}`
  ctx.fillText(String(stats.year), P - 6, 228)

  // 盤。右にわずかにはみ出させて「盤が入っている」感じを出す
  drawDisc(ctx, 960, 238, 166, stats.year)

  // ── 数値4つ ─────────────────────────────────────────────────────────────
  const cells: [string, string][] = [
    [String(stats.cups), '杯'],
    [formatDose(stats.doseSumG), '豆'],
    [String(stats.originCount), '産地'],
    [stats.avgRating != null ? stats.avgRating.toFixed(1) : '—', '平均★'],
  ]
  const cellW = (CARD_SIZE - P * 2) / cells.length
  cells.forEach(([value, label], i) => {
    const x = P + cellW * i
    ctx.fillStyle = CREAM
    ctx.font = `700 60px ${FONT}`
    ctx.fillText(value, x, 428)
    ctx.fillStyle = TAN
    ctx.font = `400 24px ${FONT}`
    ctx.fillText(label, x, 464)
  })

  // 自宅／お店の内訳
  ctx.fillStyle = TAN
  ctx.font = `400 24px ${FONT}`
  ctx.fillText(
    `自宅 ${stats.homeCups}・お店 ${stats.cafeCups}` + (stats.spend > 0 ? `（¥${stats.spend.toLocaleString()}）` : ''),
    P, 502,
  )

  // 月別の杯数。数値のかたまりの一部なので、ここに置いて下は空ける
  const barTop = 524
  const barH = 40
  const barMax = Math.max(1, ...stats.monthlyCups)
  const barW = (CARD_SIZE - P * 2) / 12
  stats.monthlyCups.forEach((n, i) => {
    const h = (n / barMax) * barH
    ctx.fillStyle = n > 0 ? CORAL : LINE
    ctx.fillRect(P + barW * i, barTop + (barH - h), barW - 10, Math.max(n > 0 ? 3 : 2, h))
  })

  ctx.strokeStyle = LINE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(P, 596)
  ctx.lineTo(RIGHT, 596)
  ctx.stroke()

  // ── トラックリスト（よく飲んだ豆 Top5 を LP の裏ジャケに見立てる） ──────
  ctx.fillStyle = TAN
  ctx.font = `600 24px ${FONT}`
  ctx.letterSpacing = '4px'
  ctx.fillText('SIDE A — MOST PLAYED', P, 638)
  ctx.letterSpacing = '0px'

  if (stats.tracks.length === 0) {
    ctx.fillStyle = TAN
    ctx.font = `400 28px ${FONT}`
    ctx.fillText('豆を登録すると、ここに並びます', P, 690)
  } else {
    stats.tracks.forEach((t, i) => {
      const y = 686 + i * 50

      ctx.textAlign = 'left'
      ctx.fillStyle = TAN
      ctx.font = `600 28px ${FONT}`
      ctx.fillText(`A${i + 1}`, P, y)

      const countText = `${t.count}杯`
      ctx.textAlign = 'right'
      ctx.font = `400 26px ${FONT}`
      const countW = ctx.measureText(countText).width
      ctx.fillText(countText, RIGHT, y)

      ctx.textAlign = 'left'
      ctx.fillStyle = CREAM
      ctx.font = `500 30px ${FONT}`
      ctx.fillText(fitText(ctx, t.name, CARD_SIZE - P * 2 - 72 - countW - 30), P + 72, y)
    })
  }

  // ── ベストの一杯（1年の主役なので、下に独立した枠として置く） ───────────
  if (stats.best) {
    ctx.textAlign = 'left'
    ctx.strokeStyle = LINE
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(P, 924)
    ctx.lineTo(RIGHT, 924)
    ctx.stroke()

    ctx.fillStyle = TAN
    ctx.font = `600 22px ${FONT}`
    ctx.letterSpacing = '3px'
    ctx.fillText('BEST OF THE YEAR', P, 962)
    ctx.letterSpacing = '0px'

    // 星と月は右に逃がし、名前に幅を譲る
    const meta = `${'★'.repeat(stats.best.rating)}  ${stats.best.month}月`
    ctx.textAlign = 'right'
    ctx.fillStyle = CORAL
    ctx.font = `500 26px ${FONT}`
    const metaW = ctx.measureText(meta).width
    ctx.fillText(meta, RIGHT, 1004)

    ctx.textAlign = 'left'
    ctx.fillStyle = CREAM
    ctx.font = `600 32px ${FONT}`
    ctx.fillText(fitText(ctx, stats.best.name, CARD_SIZE - P * 2 - metaW - 30), P, 1004)
  }

  // ── フッター ────────────────────────────────────────────────────────────
  ctx.textAlign = 'left'
  ctx.fillStyle = TAN
  ctx.font = `400 22px ${FONT}`
  ctx.letterSpacing = '3px'
  ctx.fillText('MEGROOVE', P, 1048)
  ctx.letterSpacing = '0px'
}
