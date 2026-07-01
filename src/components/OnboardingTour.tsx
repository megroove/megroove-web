import { useState } from 'react'
import RecordDisk from './brew/RecordDisk'

const ONBOARDING_KEY = 'megroove-onboarded'

export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === '1'
}

function markOnboarded() {
  localStorage.setItem(ONBOARDING_KEY, '1')
}

const STEPS = [
  {
    visual: <RecordDisk size={88} />,
    title: 'Megroove へようこそ',
    body: 'こだわりの一杯を、ずっと記録しよう。\nコーヒーとレコードの世界観で、あなただけのログを残せます。',
  },
  {
    visual: <span className="text-6xl leading-none">☕</span>,
    title: '前回値からそのまま始まる',
    body: '「淹れる」を押すと、前回の記録がそのまま入力済みで表示されます。変えたところだけ直すだけで、記録が完成します。',
  },
  {
    visual: <span className="text-6xl leading-none">🏪</span>,
    title: 'カフェの一杯も記録できる',
    body: 'お気に入りのカフェで飲んだドリンクも同じように記録。フレーバーや評価を残せます。',
  },
  {
    visual: <span className="text-6xl leading-none">📊</span>,
    title: '記録が積み重なるほど深まる',
    body: '分析画面では、あなたの好みをレーダーチャートで可視化。今月の一杯ランキングも確認できます。',
  },
]

export default function OnboardingTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)

  const finish = () => {
    markOnboarded()
    onDone()
  }

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      finish()
    }
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-5">
      <div className="bg-[#2E2018] rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl">

        {/* スキップボタン */}
        <div className="flex justify-end px-4 pt-4">
          <button
            type="button"
            onClick={finish}
            className="text-xs text-[#6b5a4a] px-3 py-1 rounded-full active:opacity-60"
          >
            スキップ
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex flex-col items-center px-6 pt-4 pb-6 gap-6 text-center min-h-[280px] justify-center">
          <div className="flex items-center justify-center h-24">
            {current.visual}
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-[#F7EFE6] text-lg font-semibold leading-snug">
              {current.title}
            </h2>
            <p className="text-[#CE9C68] text-sm leading-relaxed whitespace-pre-line">
              {current.body}
            </p>
          </div>
        </div>

        {/* フッター */}
        <div className="flex flex-col items-center gap-4 px-6 pb-7">
          {/* ドット */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-200 ${
                  i === step
                    ? 'w-5 h-1.5 bg-[#993C1D]'
                    : 'w-1.5 h-1.5 bg-[#3e3020]'
                }`}
              />
            ))}
          </div>

          {/* 次へ / 始めるボタン */}
          <button
            type="button"
            onClick={next}
            className="w-full py-3.5 rounded-xl bg-[#993C1D] text-[#F7EFE6] font-semibold text-sm active:opacity-80"
          >
            {isLast ? 'さっそく始める' : '次へ'}
          </button>
        </div>
      </div>
    </div>
  )
}
