// 5軸レーダーチャート（星評価加重平均値を受け取り SVG で描画）

const AXES = [
  { key: 'acidity' as const,    label: '酸味' },
  { key: 'sweetness' as const,  label: '甘み' },
  { key: 'bitterness' as const, label: '苦味' },
  { key: 'body' as const,       label: 'ボディ' },
  { key: 'aftertaste' as const, label: '後味' },
]

const N   = 5
const CX  = 120
const CY  = 118
const MAX_R = 78
const LABEL_R = MAX_R + 22

function angleDeg(i: number) { return -90 + (360 / N) * i }
function toRad(deg: number)  { return (deg * Math.PI) / 180 }

function axisPoint(i: number, value: number): [number, number] {
  const a = toRad(angleDeg(i))
  const r = (Math.max(0, Math.min(5, value)) / 5) * MAX_R
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

function gridPoints(level: number): string {
  return Array.from({ length: N }, (_, i) => axisPoint(i, level).join(',')).join(' ')
}

function dataPoints(values: number[]): string {
  return values.map((v, i) => axisPoint(i, v).join(',')).join(' ')
}

function labelPos(i: number): [number, number] {
  const a = toRad(angleDeg(i))
  return [CX + LABEL_R * Math.cos(a), CY + LABEL_R * Math.sin(a)]
}

function textAnchor(i: number): 'end' | 'start' | 'middle' {
  const [lx] = labelPos(i)
  if (lx < CX - 8) return 'end'
  if (lx > CX + 8) return 'start'
  return 'middle'
}

export interface RadarScores {
  acidity?:    number
  sweetness?:  number
  bitterness?: number
  body?:       number
  aftertaste?: number
}

interface Props { scores: RadarScores }

export default function RadarChart({ scores }: Props) {
  const values = AXES.map(a => scores[a.key] ?? 0)

  return (
    <svg width="100%" viewBox="0 0 240 240" className="mx-auto" style={{ maxWidth: 280 }}>
      {/* 背景塗り（最大域） */}
      <polygon points={gridPoints(5)} fill="#1e0f05" />

      {/* グリッド（5段階） */}
      {[1, 2, 3, 4, 5].map(lvl => (
        <polygon key={lvl} points={gridPoints(lvl)} fill="none" stroke="#2e1a0e" strokeWidth="1" />
      ))}

      {/* 軸線 */}
      {AXES.map((_, i) => {
        const [x, y] = axisPoint(i, 5)
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="#2e1a0e" strokeWidth="1" />
      })}

      {/* データポリゴン */}
      <polygon
        points={dataPoints(values)}
        fill="rgba(153, 60, 29, 0.28)"
        stroke="#993C1D"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* データ点 */}
      {values.map((v, i) =>
        v > 0 ? (
          <circle key={i} cx={axisPoint(i, v)[0]} cy={axisPoint(i, v)[1]} r="4" fill="#993C1D" />
        ) : null
      )}

      {/* 軸ラベル */}
      {AXES.map((axis, i) => {
        const [lx, ly] = labelPos(i)
        return (
          <text
            key={i}
            x={lx}
            y={ly}
            textAnchor={textAnchor(i)}
            dominantBaseline="middle"
            fill="#CE9C68"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
          >
            {axis.label}
          </text>
        )
      })}

      {/* スコア値（データ点の近く） */}
      {values.map((v, i) => {
        if (v === 0) return null
        const [px, py] = axisPoint(i, v)
        const [lx]     = labelPos(i)
        const anchor   = lx < CX - 8 ? 'end' : lx > CX + 8 ? 'start' : 'middle'
        // 値ラベルはデータ点から軸方向に少しオフセット
        const a = toRad(angleDeg(i))
        const ox = 10 * Math.cos(a)
        const oy = 10 * Math.sin(a)
        return (
          <text
            key={i}
            x={px + ox}
            y={py + oy}
            textAnchor={anchor}
            dominantBaseline="middle"
            fill="#F7EFE6"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
          >
            {v.toFixed(1)}
          </text>
        )
      })}
    </svg>
  )
}
