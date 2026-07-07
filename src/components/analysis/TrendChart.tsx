import type { MonthlyTrend } from './stats'

// 月別の杯数（棒）と平均評価（折れ線）を重ねた軽量SVGチャート
export default function TrendChart({ months }: { months: MonthlyTrend[] }) {
  const W = 320
  const H = 150
  const padTop = 14
  const padBottom = 26
  const chartH = H - padTop - padBottom
  const maxCups = Math.max(1, ...months.map(m => m.cups))

  const slot = W / months.length
  const barW = Math.min(28, slot * 0.5)

  const barY = (cups: number) => padTop + chartH * (1 - cups / maxCups)
  const ratingY = (r: number) => padTop + chartH * (1 - (r - 1) / 4) // 1〜5 を縦軸に

  const ratingPoints = months
    .map((m, i) =>
      m.avgRating !== undefined
        ? { x: slot * i + slot / 2, y: ratingY(m.avgRating) }
        : null,
    )
    .filter((p): p is { x: number; y: number } => p !== null)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="月別の杯数と平均評価">
        {/* 棒: 杯数 */}
        {months.map((m, i) => {
          const x = slot * i + slot / 2 - barW / 2
          const y = barY(m.cups)
          return (
            <g key={m.label}>
              {m.cups > 0 && (
                <rect
                  x={x} y={y} width={barW} height={padTop + chartH - y}
                  rx={4} fill="#4a3828"
                />
              )}
              {m.cups > 0 && (
                <text x={slot * i + slot / 2} y={y - 4} textAnchor="middle"
                  fontSize="9" fill="#CE9C68"
                >
                  {m.cups}
                </text>
              )}
              <text x={slot * i + slot / 2} y={H - 8} textAnchor="middle"
                fontSize="10" fill="#6b5a4a"
              >
                {m.label}
              </text>
            </g>
          )
        })}

        {/* 折れ線: 平均評価 */}
        {ratingPoints.length >= 2 && (
          <polyline
            points={ratingPoints.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none" stroke="#993C1D" strokeWidth="2" strokeLinejoin="round"
          />
        )}
        {ratingPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#993C1D" />
        ))}
      </svg>

      <div className="flex gap-4 justify-end mt-1">
        <span className="text-[10px] text-[#6b5a4a] flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm bg-[#4a3828]" />
          杯数
        </span>
        <span className="text-[10px] text-[#6b5a4a] flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-[#993C1D]" />
          平均評価（★1〜5）
        </span>
      </div>
    </div>
  )
}
