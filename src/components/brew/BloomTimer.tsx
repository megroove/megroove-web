import { useState, useEffect, useRef, useCallback } from 'react'
import { loadBrewLayout } from '../../db'

const FIXED_PRESETS = [20, 30, 40, 45]

function buildPresets(customSec: number): number[] {
  return [customSec, ...FIXED_PRESETS.filter(s => s !== customSec).slice(0, 3)]
}

export default function BloomTimer() {
  const customSec = loadBrewLayout().bloomTimeSec ?? 30
  const presets   = buildPresets(customSec)
  const [targetSec, setTargetSec] = useState(customSec)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const remaining = Math.max(0, targetSec - elapsed)
  const progress = Math.min(1, elapsed / targetSec)
  const circumference = 2 * Math.PI * 28

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }, [])

  const reset = useCallback(() => {
    stop()
    setRunning(false)
    setElapsed(0)
    setDone(false)
  }, [stop])

  useEffect(() => {
    if (!running) { stop(); return }

    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(wl => { wakeLockRef.current = wl })
        .catch(() => {})
    }

    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        if (next >= targetSec) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          setRunning(false)
          setDone(true)
          if (navigator.vibrate) navigator.vibrate([200, 100, 200])
          return targetSec
        }
        return next
      })
    }, 1000)

    return stop
  }, [running, targetSec, stop])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <div className="flex flex-col gap-3">
      {/* プリセット（アイドル時のみ） */}
      {!running && elapsed === 0 && (
        <div className="flex gap-2">
          {presets.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setTargetSec(s)}
              className={`flex-1 py-1.5 rounded-xl text-sm transition-colors ${
                targetSec === s ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#3e3020] text-[#CE9C68]'
              }`}
            >
              {s}秒
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* 円形プログレス */}
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#3e3020" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="28" fill="none"
              stroke={done ? '#4ade80' : '#993C1D'}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              style={{ transition: running ? 'stroke-dashoffset 0.9s linear' : 'none' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono font-bold text-[#F7EFE6] text-sm">
            {done ? '✓' : `${mm}:${ss}`}
          </span>
        </div>

        {/* コントロール */}
        <div className="flex gap-2 flex-1">
          {done ? (
            <button type="button" onClick={reset}
              className="flex-1 py-2.5 rounded-xl bg-[#3e3020] text-[#CE9C68] text-sm"
            >
              リセット
            </button>
          ) : running ? (
            <>
              <button type="button" onClick={() => setRunning(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#3e3020] text-[#CE9C68] text-sm"
              >
                一時停止
              </button>
              <button type="button" onClick={reset}
                className="flex-1 py-2.5 rounded-xl bg-[#3e3020] text-[#6b5a4a] text-sm"
              >
                リセット
              </button>
            </>
          ) : elapsed > 0 ? (
            <>
              <button type="button" onClick={() => setRunning(true)}
                className="flex-1 py-2.5 rounded-xl bg-[#993C1D] text-[#F7EFE6] text-sm font-semibold"
              >
                再開
              </button>
              <button type="button" onClick={reset}
                className="flex-1 py-2.5 rounded-xl bg-[#3e3020] text-[#CE9C68] text-sm"
              >
                リセット
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setRunning(true)}
              className="flex-1 py-2.5 rounded-xl bg-[#993C1D] text-[#F7EFE6] text-sm font-semibold"
            >
              スタート
            </button>
          )}
        </div>
      </div>

      {done && (
        <p className="text-xs text-emerald-400 text-center">蒸らし完了！注湯を始めましょう</p>
      )}
    </div>
  )
}
