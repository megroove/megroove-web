import { calcResidualCaffeine } from '../../db'

const SVG_W = 320
const SVG_H = 160
const PL = 38, PR = 10, PT = 12, PB = 24
const IW = SVG_W - PL - PR
const IH = SVG_H - PT - PB

interface Intake {
  caffeineAmount: number
  brewedAt: string
}

interface Props {
  intakes: Intake[]
  bedtimeHour: number
  bedtimeMinute: number
  targetMg: number
  now: Date
}

function p2(n: number) {
  return n.toString().padStart(2, '0')
}

export default function CaffeineGraph({ intakes, bedtimeHour, bedtimeMinute, targetMg, now }: Props) {
  // 表示範囲: 今日06:00 〜 就寝+2h
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0)

  // 06:00より前のintakeがあれば起点を伸ばす
  if (intakes.length > 0) {
    const earliest = new Date(
      Math.min(...intakes.map(i => new Date(i.brewedAt).getTime())),
    )
    const cushion = new Date(earliest.getTime() - 30 * 60 * 1000)
    if (cushion < start) start.setTime(cushion.getTime())
  }

  const bedtime = new Date(now)
  bedtime.setHours(bedtimeHour, bedtimeMinute, 0, 0)
  if (bedtime <= now) bedtime.setDate(bedtime.getDate() + 1)

  const end = new Date(bedtime.getTime() + 2 * 60 * 60 * 1000)
  if (end.getTime() <= start.getTime()) return null

  // 10分ごとにサンプリング
  const STEP = 10 * 60 * 1000
  const samples: Array<{ t: number; mg: number }> = []
  for (let t = start.getTime(); t <= end.getTime(); t += STEP) {
    samples.push({ t, mg: calcResidualCaffeine(intakes, new Date(t)) })
  }

  // Y軸最大値 (50の倍数に切り上げ)
  const peakMg = samples.reduce((m, s) => Math.max(m, s.mg), 0)
  const rawMax = Math.max(peakMg * 1.15, targetMg * 1.8, 60)
  const maxY = Math.ceil(rawMax / 50) * 50

  const startMs = start.getTime()
  const spanMs = end.getTime() - startMs
  const tx = (ms: number) => PL + ((ms - startMs) / spanMs) * IW
  const ty = (mg: number) => PT + IH * (1 - Math.min(mg, maxY) / maxY)

  const nowMs = now.getTime()
  const past = samples.filter(s => s.t <= nowMs)
  const future = samples.filter(s => s.t >= nowMs)

  const toPts = (arr: typeof samples) =>
    arr.map(s => `${tx(s.t).toFixed(1)},${ty(s.mg).toFixed(1)}`).join(' ')

  const nowX = tx(nowMs)
  const nowY = ty(calcResidualCaffeine(intakes, now))
  const bedtimeX = tx(bedtime.getTime())
  const targetY = ty(targetMg)

  // X軸ラベル (3時間ごと)
  type XLabel = { x: number; label: string; key: number }
  const xLabels: XLabel[] = []
  {
    const cursor = new Date(start)
    cursor.setMinutes(0, 0, 0)
    const h = cursor.getHours()
    const nextH = h % 3 === 0 ? h : h + (3 - (h % 3))
    cursor.setHours(nextH)
    while (cursor.getTime() <= end.getTime()) {
      if (cursor.getTime() >= startMs) {
        xLabels.push({ x: tx(cursor.getTime()), label: p2(cursor.getHours()), key: cursor.getTime() })
      }
      cursor.setTime(cursor.getTime() + 3 * 60 * 60 * 1000)
    }
  }

  const showTarget = targetMg > 0 && targetY > PT + 10 && targetY < PT + IH - 4
  const showBedtime = bedtimeX >= PL && bedtimeX <= PL + IW

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full"
      style={{ height: SVG_H }}
    >
      {/* 背景 */}
      <rect x={PL} y={PT} width={IW} height={IH} fill="#3e3020" rx="3" />

      {/* 目標ライン (アンバー破線) */}
      {showTarget && (
        <line
          x1={PL} y1={targetY} x2={PL + IW} y2={targetY}
          stroke="#CE9C68" strokeWidth="1.2" strokeDasharray="5 4" opacity={0.85}
        />
      )}

      {/* 就寝ライン (コーラル破線) */}
      {showBedtime && (
        <line
          x1={bedtimeX} y1={PT} x2={bedtimeX} y2={PT + IH}
          stroke="#993C1D" strokeWidth="1.5" strokeDasharray="4 3"
        />
      )}

      {/* 過去ライン (実線) */}
      {past.length > 1 && (
        <polyline
          points={toPts(past)}
          fill="none" stroke="#F7EFE6" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round"
        />
      )}

      {/* 予測ライン (破線・薄く) */}
      {future.length > 1 && (
        <polyline
          points={toPts(future)}
          fill="none" stroke="#F7EFE6" strokeWidth="2"
          strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round"
          opacity={0.4}
        />
      )}

      {/* 現在地ドット */}
      {nowX >= PL && nowX <= PL + IW && (
        <circle cx={nowX} cy={nowY} r="3.5" fill="#F7EFE6" />
      )}

      {/* 就寝ラベル */}
      {showBedtime && (
        <text
          x={Math.min(bedtimeX + 3, PL + IW - 20)}
          y={PT + 10}
          fill="#993C1D" fontSize="8.5" fontWeight="600"
        >
          就寝
        </text>
      )}

      {/* 目標ラベル */}
      {showTarget && (
        <text x={PL + IW - 3} y={targetY - 3} textAnchor="end" fill="#CE9C68" fontSize="8.5">
          目標
        </text>
      )}

      {/* Y軸ラベル */}
      <text x={PL - 4} y={PT + IH + 1} textAnchor="end" dominantBaseline="auto" fill="#6b5a4a" fontSize="8.5">0</text>
      <text x={PL - 4} y={PT + 1} textAnchor="end" dominantBaseline="auto" fill="#6b5a4a" fontSize="8.5">{maxY}</text>
      {showTarget && (
        <text x={PL - 4} y={targetY} textAnchor="end" dominantBaseline="middle" fill="#CE9C68" fontSize="8.5">
          {targetMg}
        </text>
      )}

      {/* X軸ラベル */}
      {xLabels.map(({ x, label, key }) => (
        <text key={key} x={x} y={SVG_H - 2} textAnchor="middle" fill="#6b5a4a" fontSize="8.5">
          {label}
        </text>
      ))}
    </svg>
  )
}
