import { useState, useEffect, useRef } from 'react'
import { formatSecToMmSs } from '../../db'
import RecordDisk from './RecordDisk'

// トーンアームの進行: 外周着地から4分（240秒）かけて最内周へ（超過後は留まる）。
// 針は装飾で、正確な時間は常に数字が主表示
const ARM_FULL_SEC = 240
const ARM_FULL_DEG = 18

interface Props {
  valueSec: number | undefined
  onChange: (v: number | undefined) => void
}

// 総抽出時間の入力: ストップウォッチ計測 or 分・秒の手入力
export default function ExtractionStopwatch({ valueSec, onChange }: Props) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(0)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!running) return

    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(wl => { wakeLockRef.current = wl })
        .catch(() => {})
    }
    // バックグラウンドでの setInterval 間引きに備え、開始時刻から経過を算出する
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 250)

    return () => {
      clearInterval(interval)
      wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [running])

  const start = () => {
    startRef.current = Date.now()
    setElapsed(0)
    setRunning(true)
  }

  const stopAndCommit = () => {
    const sec = Math.max(1, Math.floor((Date.now() - startRef.current) / 1000))
    setRunning(false)
    onChange(sec)
    if (navigator.vibrate) navigator.vibrate(100)
  }

  const minVal = valueSec !== undefined ? Math.floor(valueSec / 60) : undefined
  const secVal = valueSec !== undefined ? valueSec % 60 : undefined

  const update = (m: number | undefined, s: number | undefined) => {
    if (m === undefined && s === undefined) { onChange(undefined); return }
    onChange((m ?? 0) * 60 + Math.min(59, Math.max(0, s ?? 0)))
  }

  if (running) {
    // 抽出中＝レコード再生。盤が回り、針が経過に応じて外周→内周へ進む
    const armDeg = Math.min(elapsed / ARM_FULL_SEC, 1) * ARM_FULL_DEG
    return (
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div style={{ animation: 'disk-spin 1.8s linear infinite' }}>
            <RecordDisk size={120} />
          </div>
          {/* トーンアーム: 外側=着地アニメ（arm-drop は fill:both のため進行 rotate とは要素を分ける） */}
          <div
            className="absolute -top-3 -right-8 w-16 h-[88px]"
            style={{ animation: 'arm-drop 0.35s ease-in both', transformOrigin: '44px 12px' }}
          >
            {/* 内側=経過に応じて外周→内周へ回り込む */}
            <svg
              width="64"
              height="88"
              viewBox="0 0 64 88"
              style={{
                transform: `rotate(${armDeg}deg)`,
                transformOrigin: '44px 12px',
                transition: 'transform 0.3s linear',
              }}
            >
              <circle cx="44" cy="12" r="9" fill="#2E2018" stroke="#CE9C68" strokeWidth="1.5" />
              <circle cx="44" cy="12" r="3" fill="#CE9C68" />
              <line x1="44" y1="12" x2="26" y2="58" stroke="#CE9C68" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="26" y1="58" x2="18" y2="72" stroke="#CE9C68" strokeWidth="4.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 flex-1 min-w-0">
          <span className="text-3xl font-mono font-bold text-[#F7EFE6] tabular-nums">
            {formatSecToMmSs(elapsed)}
          </span>
          <button
            type="button"
            onClick={stopAndCommit}
            className="px-5 py-2.5 rounded-xl bg-[#993C1D] text-[#F7EFE6] text-sm font-semibold active:opacity-80"
          >
            ⏹ 停止して記録
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-baseline gap-1 flex-1">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={minVal ?? ''}
          onChange={e => update(e.target.value ? Number(e.target.value) : undefined, secVal)}
          placeholder="—"
          className="w-12 bg-transparent text-[#F7EFE6] text-xl font-semibold outline-none placeholder-[#4a3a2a] tabular-nums text-right"
        />
        <span className="text-xs text-[#CE9C68]">分</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          value={secVal ?? ''}
          onChange={e => update(minVal, e.target.value ? Number(e.target.value) : undefined)}
          placeholder="—"
          className="w-12 bg-transparent text-[#F7EFE6] text-xl font-semibold outline-none placeholder-[#4a3a2a] tabular-nums text-right"
        />
        <span className="text-xs text-[#CE9C68]">秒</span>
      </div>
      <button
        type="button"
        onClick={start}
        className="px-4 py-2.5 rounded-xl bg-[#3e3020] text-[#CE9C68] text-sm font-semibold active:opacity-80"
      >
        ▶ 計測する
      </button>
    </div>
  )
}
