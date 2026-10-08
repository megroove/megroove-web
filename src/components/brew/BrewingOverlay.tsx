import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RoastLevel, VinylColorId } from '../../db'
import { formatSecToMmSs, loadSettings, resolveVinyl, saveSettings, VINYL_COLORS } from '../../db'
import BloomTimer from './BloomTimer'
import Turntable from './Turntable'
import VinylPicker from './VinylPicker'

interface Props {
  /** 「抽出完了」で確定した総抽出時間（秒）と、数えた注湯回数（0＝数えなかった）。Side B へ進む */
  onDone: (sec: number, pours: number) => void
  /** 時間を記録せずに閉じる */
  onCancel: () => void
  /** 何を淹れているかの一行（豆・粉量/湯量など） */
  summary?: string
  /** 「豆に合わせる」で盤の色を導くための焙煎度 */
  roastLevel?: RoastLevel
}

// 盤より下（概要・経過時間）に要る高さ。盤はこれを引いた残りに収める
const STAGE_RESERVE = 88
const DISC_MAX = 180
const DISC_MIN = 96

// 抽出中の全画面。ターンテーブル計測が主役で、蒸らしのカウントダウンを重ねる。
// 手順（1投目/2投目…）の指示は出さない ― Megroove は注湯スケジュールを持たないため、
// 固定秒数の指示はユーザーの淹れ方と食い違う。
// 注湯回数は「数える」だけ ― 目標回数も次を促す表示も持たない（指示ではなく計測）。
//
// **淹れている最中はスクロールさせない。** 蒸らし・注湯・完了は常に画面内に置き、
// 伸縮するのは盤の領域だけ（狭ければ盤が縮み、それでも足りなければ盤を引っ込めて数字を残す）。
export default function BrewingOverlay({ onDone, onCancel, summary, roastLevel }: Props) {
  const [elapsed, setElapsed] = useState(0)
  // 注湯回数。0 から始め、蒸らしも自動では数えない（何を1回と数えるかはユーザーの流儀）
  const [pours, setPours] = useState(0)
  // 盤の色はここでも変えられる（設定画面と同じ値を読み書きする）
  const [vinylColor, setVinylColor] = useState<VinylColorId>(() => loadSettings().vinylColor)
  const [showVinylPicker, setShowVinylPicker] = useState(false)
  const [stage, setStage] = useState({ w: 320, h: 300 })
  const stageRef = useRef<HTMLDivElement>(null)
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

  // 盤の大きさは、残った高さから決める。枠は overflow-hidden なので中身は枠の高さに影響せず、
  // 測り直し → 縮める → また測る のループにはならない
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const discFit  = Math.min(stage.w - 48, stage.h - STAGE_RESERVE)
  const showDisc = discFit >= DISC_MIN
  const discSize = Math.min(DISC_MAX, Math.max(DISC_MIN, discFit))
  // 盤を引っ込めるほど狭いとき（横向き等）は、時間の文字も段に収まるまで縮める。
  // 針は装飾で、正確な時間は常に数字が主表示なので、ここだけは切らさない
  const timePx   = Math.max(20, Math.min(48, stage.h - 12))

  const pickVinyl = (id: VinylColorId) => {
    setVinylColor(id)
    saveSettings({ ...loadSettings(), vinylColor: id })
  }

  const vinyl = resolveVinyl(vinylColor, roastLevel)
  const vinylName = VINYL_COLORS.find(v => v.id === vinylColor)?.name ?? ''

  const countPour = () => {
    setPours(n => n + 1)
    if (navigator.vibrate) navigator.vibrate(15) // 注ぎながらでも分かるよう、ごく短く
  }

  const finish = () => {
    const sec = Math.max(1, Math.floor((Date.now() - startRef.current) / 1000))
    if (navigator.vibrate) navigator.vibrate(100)
    onDone(sec, pours)
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
      {/* ヘッダー。盤の色はここに逃がす（本体のレイアウトを押し広げないため） */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 gap-2">
        <p className="text-sm text-[#CE9C68] pl-1">抽出中</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowVinylPicker(v => !v)}
            aria-expanded={showVinylPicker}
            aria-label={`レコードの色：${vinylName}。変更する`}
            className="min-h-11 px-2 flex items-center gap-1.5 text-xs text-[#A8916F] active:opacity-70"
          >
            <span
              className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
              style={{ background: vinyl.disk, border: `1px solid ${vinyl.rim}` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: vinyl.label }} />
            </span>
            盤の色
          </button>
          <button
            type="button"
            onClick={onCancel}
            aria-label="時間を記録せずに戻る"
            className="w-11 h-11 flex items-center justify-center text-[#A8916F] text-lg active:opacity-70"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 伸縮する領域はここだけ。狭い端末では盤が縮み、極端に狭ければ盤を出さない */}
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 overflow-hidden px-6 flex flex-col items-center justify-center gap-3"
      >
        {summary && showDisc && (
          <p className="text-xs text-[#A8916F] text-center max-w-xs line-clamp-2">{summary}</p>
        )}

        {showDisc && (
          <Turntable elapsedSec={elapsed} size={discSize} vinyl={vinyl} />
        )}

        <span
          className="font-mono font-bold text-[#F7EFE6] tabular-nums"
          style={{ fontSize: timePx, lineHeight: 1 }}
        >
          {formatSecToMmSs(elapsed)}
        </span>

        {/* 色の選択は盤の上に重ねる（開いても蒸らし・注湯が押し出されない） */}
        {showVinylPicker && (
          <div className="absolute inset-0 bg-[#1a0a05]/95 px-6 flex flex-col items-center justify-center gap-3">
            <p className="text-xs text-[#CE9C68]">レコードの色</p>
            <VinylPicker value={vinylColor} onChange={pickVinyl} roastLevel={roastLevel} />
            <button
              type="button"
              onClick={() => setShowVinylPicker(false)}
              className="min-h-11 px-4 text-xs text-[#A8916F] active:opacity-70"
            >
              閉じる
            </button>
          </div>
        )}
      </div>

      {/* 淹れている最中に触るもの。常に画面内に置く */}
      <div className="px-6 shrink-0 flex flex-col items-center gap-2">
        <div className="w-full max-w-xs bg-[#2E2018] rounded-xl px-4 py-3">
          <BloomTimer autoStart />
        </div>

        {/* 注湯の回数。注いだぶんだけ数えるだけで、何回注ぐべきかは言わない */}
        <div className="w-full max-w-xs bg-[#2E2018] rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="shrink-0">
            <p className="text-[11px] text-[#CE9C68] leading-none mb-1.5">注湯</p>
            <p className="text-xs text-[#A8916F] tabular-nums leading-none">
              <span
                key={pours}
                className="inline-block text-2xl font-semibold text-[#F7EFE6] mr-0.5 align-middle"
                style={pours > 0 ? { animation: 'pour-bump 0.28s ease-out' } : undefined}
              >
                {pours}
              </span>
              回
            </p>
          </div>
          <button
            type="button"
            onClick={countPour}
            className="flex-1 min-h-12 rounded-xl bg-[#3e3020] text-[#F7EFE6] text-base font-semibold active:opacity-80"
          >
            ＋ 注いだ
          </button>
          {pours > 0 && (
            <button
              type="button"
              onClick={() => setPours(n => Math.max(0, n - 1))}
              aria-label="注湯回数を1つ戻す"
              className="w-12 min-h-12 rounded-xl border border-[#3e3020] text-[#A8916F] text-base active:opacity-70"
            >
              −1
            </button>
          )}
        </div>
      </div>

      <div className="px-6 pb-3 pt-2 flex flex-col gap-1 shrink-0">
        <button
          type="button"
          onClick={finish}
          className="w-full bg-[#993C1D] text-[#F7EFE6] py-3.5 rounded-2xl text-base font-semibold active:opacity-80"
        >
          抽出完了、味わいを記録する
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[#A8916F] min-h-11 active:opacity-70"
        >
          時間を記録せずに戻る
        </button>
      </div>
    </div>
  )
}
