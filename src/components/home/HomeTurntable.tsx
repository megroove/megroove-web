import { useId } from 'react'

// ホームの主役となるターンテーブル。
// 抽出中画面の `Turntable` とは役割が違う（あちらは計測中に回る実用UI、こちらは静止した「置かれた盤」）ため、
// 共通化せず専用に描く。ここでは**回さない**し、タップもさせない（操作は下のボタンに一本化）。
//
// 盤の色は Megroove 既定の黒で固定する。色を選べるのは抽出中と保存演出だけ（CLAUDE.md §9）。

// 盤は枠の高さを増やさずに一回り大きくする（余っていた右下・左右の余白を盤に回す）
const DISC_CX = 148
const DISC_CY = 126
const DISC_R = 122

// トーンアーム: 支点は盤の右上。実機のプレーヤーと同じく、腕は立て気味にして
// 右上から盤へ差し渡す形にする（寝かせると盤の上に横たわって見える）
const PIVOT_X = 306
const PIVOT_Y = 52
const HEAD_X = 219
const HEAD_Y = 195
// 支点→ヘッドシェルの傾き（ヘッドシェルを腕と同じ向きに倒すのに使う）
const ARM_DEG = (Math.atan2(HEAD_Y - PIVOT_Y, HEAD_X - PIVOT_X) * 180) / Math.PI + 90
// 線はヘッドシェルに少し食い込ませて止める（継ぎ目を見せない）
const ARM_LEN = Math.hypot(HEAD_X - PIVOT_X, HEAD_Y - PIVOT_Y)
const ARM_END_X = HEAD_X - ((HEAD_X - PIVOT_X) / ARM_LEN) * 14
const ARM_END_Y = HEAD_Y - ((HEAD_Y - PIVOT_Y) / ARM_LEN) * 14

interface Props {
  /** 針を上げた状態にする（まだ1件も記録が無いとき） */
  armLifted?: boolean
  /** 盤の下に置く一言 */
  caption?: string
}

export default function HomeTurntable({ armLifted = false, caption }: Props) {
  const id = useId()
  const glowId = `${id}-glow`
  const discId = `${id}-disc`

  return (
    <div
      className="rounded-3xl px-3 pt-3 pb-2 border border-[#3a2a1e]/60"
      style={{
        background:
          'radial-gradient(120% 90% at 35% 30%, #3a2519 0%, #2a1911 45%, #1f120c 100%)',
      }}
    >
      <svg viewBox="0 0 360 252" className="w-full block" aria-hidden>
        <defs>
          {/* 盤の奥から差す淡い光。世界観の落ち着きを崩さない程度に弱く */}
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8a5a34" stopOpacity="0.30" />
            <stop offset="70%" stopColor="#8a5a34" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#8a5a34" stopOpacity="0" />
          </radialGradient>
          {/* 盤面。真っ黒ではなく、わずかに温かみのある黒に */}
          <radialGradient id={discId} cx="42%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#1c1714" />
            <stop offset="100%" stopColor="#0c0907" />
          </radialGradient>
        </defs>

        <circle cx={DISC_CX} cy={DISC_CY} r={DISC_R + 34} fill={`url(#${glowId})`} />

        {/* 盤 */}
        <circle cx={DISC_CX} cy={DISC_CY} r={DISC_R} fill={`url(#${discId})`} />

        {/* 溝。外周ほど間隔を詰めて、レコードらしい密度を出す */}
        {[116, 110, 104, 98, 92, 85, 78, 70, 62, 54].map(r => (
          <circle
            key={r}
            cx={DISC_CX}
            cy={DISC_CY}
            r={r}
            fill="none"
            stroke="#2b2320"
            strokeWidth={r > 90 ? 1.6 : 1.2}
          />
        ))}

        {/* 中央レーベル。アプリ名はここに印字する（実際のレコードのレーベルと同じ考え方）。
            ヘッダーに見出しを置かなくて済むぶん、盤が上がり、下の情報が見えるようになる */}
        <circle cx={DISC_CX} cy={DISC_CY} r={54} fill="#9E4023" />
        <circle cx={DISC_CX} cy={DISC_CY} r={54} fill="none" stroke="#B0522F" strokeWidth="1" />
        <text
          x={DISC_CX}
          y={DISC_CY - 4}
          textAnchor="middle"
          fill="#F7EFE6"
          fontSize="17"
          fontFamily="system-ui"
          fontWeight="700"
          letterSpacing="0.3"
        >
          Megroove
        </text>
        <text
          x={DISC_CX}
          y={DISC_CY + 12}
          textAnchor="middle"
          fill="#F7EFE6"
          fontSize="7"
          fontFamily="system-ui"
          opacity="0.72"
          letterSpacing="1.6"
        >
          COFFEE RECORDS
        </text>
        {/* スピンドル穴 */}
        <circle cx={DISC_CX} cy={DISC_CY + 30} r={4} fill="#140b07" />

        {/* トーンアーム。針を上げているときは支点を軸に外へ逃がす */}
        <g transform={armLifted ? `rotate(-15 ${PIVOT_X} ${PIVOT_Y})` : undefined}>
          <line
            x1={PIVOT_X}
            y1={PIVOT_Y}
            x2={ARM_END_X}
            y2={ARM_END_Y}
            stroke="#C9A47A"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* ヘッドシェル（腕と同じ向きに倒す） */}
          <rect
            x={HEAD_X - 11}
            y={HEAD_Y - 14}
            width="22"
            height="30"
            rx="5"
            fill="#C9A47A"
            transform={`rotate(${ARM_DEG} ${HEAD_X} ${HEAD_Y})`}
          />
          {/* 支点 */}
          <circle cx={PIVOT_X} cy={PIVOT_Y} r={22} fill="#3a2b22" stroke="#4d3a2c" strokeWidth="1.5" />
          <circle cx={PIVOT_X} cy={PIVOT_Y} r={7} fill="#C9A47A" opacity="0.35" />
        </g>
      </svg>

      {caption && <p className="text-xs text-[#A8916F] mt-0.5 px-1">{caption}</p>}
    </div>
  )
}
