import { useEffect, useRef, useState } from 'react'
import { formatSecToMmSs } from '../../db'
import BloomTimer from './BloomTimer'
import Turntable from './Turntable'

interface Props {
  /** 「抽出完了」で確定した総抽出時間（秒）。Side B へ進む */
  onDone: (sec: number) => void
  /** 時間を記録せずに閉じる */
  onCancel: () => void
  /** 何を淹れているかの一行（豆・粉量/湯量など） */
  summary?: string
}

// 抽出中の全画面。ターンテーブル計測が主役で、蒸らしのカウントダウンを重ねる。
// 手順（1投目/2投目…）の指示は出さない ― Megroove は注湯スケジュールを持たないため、
// 固定秒数の指示はユーザーの淹れ方と食い違う。
export default function BrewingOverlay({ onDone, onCancel, summary }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
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
  }, [])

  const finish = () => {
    const sec = Math.max(1, Math.floor((Date.now() - startRef.current) / 1000))
    if (navigator.vibrate) navigator.vibrate(100)
    onDone(sec)
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#1a0a05] flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="dialog"
      aria-label="抽出中"
    >
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <p className="text-sm text-[#CE9C68]">抽出中</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="時間を記録せずに戻る"
          className="w-11 h-11 flex items-center justify-center text-[#6b5a4a] text-lg active:opacity-70"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 flex flex-col items-center justify-center gap-7">
        {summary && (
          <p className="text-xs text-[#6b5a4a] text-center max-w-xs">{summary}</p>
        )}

        <Turntable elapsedSec={elapsed} size={180} />

        <span className="text-5xl font-mono font-bold text-[#F7EFE6] tabular-nums">
          {formatSecToMmSs(elapsed)}
        </span>

        {/* 蒸らしのカウントダウン（記録画面カスタマイズの秒数をそのまま使う） */}
        <div className="w-full max-w-xs bg-[#2E2018] rounded-xl p-4">
          <p className="text-xs text-[#CE9C68] mb-3">蒸らし</p>
          <BloomTimer autoStart />
        </div>
      </div>

      <div className="px-6 pb-6 pt-4 flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={finish}
          className="w-full bg-[#993C1D] text-[#F7EFE6] py-4 rounded-2xl text-base font-semibold active:opacity-80"
        >
          抽出完了、味わいを記録する
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[#6b5a4a] py-2 active:opacity-70"
        >
          時間を記録せずに戻る
        </button>
      </div>
    </div>
  )
}
