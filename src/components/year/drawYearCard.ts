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

  // 背景
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)
  const glow = ctx.createRadialGradient(CARD_SIZE * 0.72, CARD_SIZE * 0.26, 40, CARD_SIZE * 0.72, CARD_SIZE * 0.26, CARD_SIZE * 0.6)
  glow.addColorStop(0, 'rgba(138,90,52,0.26)')
  glow.addColorStop(1, 'rgba(138,90,52,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)

  // 見出し
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = TAN
  ctx.font = `600 30px ${FONT}`
  ctx.letterSpacing = '6px'
  ctx.fillText('YEAR IN COFFEE', P, P + 36)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = CREAM
  ctx.font = `700 132px ${FONT}`
  ctx.fillText(String(stats.year), P - 6, P + 170)

  // 盤（右上から少しはみ出させて「盤が入っている」感じを出す）
  drawDisc(ctx, CARD_SIZE - P - 40, P + 210, 190, stats.year)

  // 数値4つ
  const statsY = 470
  const cells: [string, string][] = [
    [String(stats.cups), '杯'],
    [formatDose(stats.doseSumG), '豆'],
    [String(stats.originCount), '産地'],
    [stats.avgRating != null ? stats.avgRating.toFixed(1) : '—', '平均★'],
  ]
  const cellW = (CARD_SIZE - P * 2) / cells.length
  cells.forEach(([value, label], i) => {
    const x = P + cellW * i
    ctx.textAlign = 'left'
    ctx.fillStyle = CREAM
    ctx.font = `700 62px ${FONT}`
    ctx.fillText(value, x, statsY)
    ctx.fillStyle = TAN
    ctx.font = `400 26px ${FONT}`
    ctx.fillText(label, x, statsY + 38)
  })

  // 自宅／お店の内訳
  ctx.fillStyle = TAN
  ctx.font = `400 26px ${FONT}`
  ctx.fillText(
    `自宅 ${stats.homeCups}・お店 ${stats.cafeCups}` + (stats.spend > 0 ? `（¥${stats.spend.toLocaleString()}）` : ''),
    P, statsY + 84,
  )

  // 区切り線
  ctx.strokeStyle = LINE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(P, statsY + 118)
  ctx.lineTo(CARD_SIZE - P, statsY + 118)
  ctx.stroke()

  // トラックリスト（よく飲んだ豆 Top5 を LP の裏ジャケに見立てる）
  let y = statsY + 178
  ctx.fillStyle = TAN
  ctx.font = `600 26px ${FONT}`
  ctx.letterSpacing = '4px'
  ctx.fillText('SIDE A — MOST PLAYED', P, y - 40)
  ctx.letterSpacing = '0px'

  if (stats.tracks.length === 0) {
    ctx.fillStyle = TAN
    ctx.font = `400 30px ${FONT}`
    ctx.fillText('豆を登録すると、ここに並びます', P, y)
  } else {
    stats.tracks.forEach((t, i) => {
      ctx.fillStyle = TAN
      ctx.font = `600 30px ${FONT}`
      ctx.fillText(`A${i + 1}`, P, y)

      ctx.fillStyle = CREAM
      ctx.font = `500 34px ${FONT}`
      const countText = `${t.count}杯`
      ctx.textAlign = 'right'
      ctx.fillStyle = TAN
      ctx.font = `400 28px ${FONT}`
      ctx.fillText(countText, CARD_SIZE - P, y)

      ctx.textAlign = 'left'
      ctx.fillStyle = CREAM
      ctx.font = `500 34px ${FONT}`
      const maxW = CARD_SIZE - P * 2 - 80 - ctx.measureText(countText).width - 40
      ctx.fillText(fitText(ctx, t.name, maxW), P + 76, y)

      y += 58
    })
  }

  // ベストの一杯
  if (stats.best) {
    ctx.fillStyle = TAN
    ctx.font = `400 26px ${FONT}`
    ctx.fillText(
      `ベストの一杯: ${fitText(ctx, stats.best.name, 520)}  ${'★'.repeat(stats.best.rating)}  ${stats.best.month}月`,
      P, CARD_SIZE - P - 92,
    )
  }

  // 月別の杯数（小さなバー12本）
  const barTop = CARD_SIZE - P - 68
  const barMax = Math.max(1, ...stats.monthlyCups)
  const barW = (CARD_SIZE - P * 2) / 12
  stats.monthlyCups.forEach((n, i) => {
    const h = (n / barMax) * 44
    ctx.fillStyle = n > 0 ? CORAL : LINE
    ctx.fillRect(P + barW * i, barTop + (44 - h), barW - 10, Math.max(n > 0 ? 3 : 2, h))
  })

  // フッター
  ctx.fillStyle = TAN
  ctx.font = `400 24px ${FONT}`
  ctx.letterSpacing = '3px'
  ctx.fillText('MEGROOVE', P, CARD_SIZE - 28)
  ctx.letterSpacing = '0px'
}
