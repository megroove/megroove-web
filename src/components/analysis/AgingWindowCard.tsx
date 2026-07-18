import { AGING_MIN_TOTAL, bucketLabel } from './stats'
import type { AgingWindow } from './stats'

// 飲み頃分析カード（焙煎日齢 × 評価）。/analysis（全体）と /analysis/bean/:id（豆単位）で共用。
// context='global' は閾値未満でも案内カードを出す。'bean' は閾値未満なら何も描画しない。

export default function AgingWindowCard({
  result,
  context,
}: {
  result: AgingWindow
  context: 'global' | 'bean'
}) {
  // 閾値に満たない場合
  if (result.total < AGING_MIN_TOTAL) {
    if (context === 'bean') return null
    return (
      <section className="bg-[#2E2018] rounded-xl p-5 flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">
          飲み頃の傾向
        </h3>
        <p className="text-sm text-[#6b5a4a] leading-relaxed">
          {result.total === 0
            ? '豆に焙煎日を登録して記録を重ねると、あなたの高評価が集まる焙煎後の日数が見えてきます。'
            : `焙煎日つきの記録が${AGING_MIN_TOTAL}杯たまると、あなたの飲み頃の傾向が現れます（いま ${result.total}杯）。`}
        </p>
      </section>
    )
  }

  const { buckets, total, peak } = result
  const maxBar = 5 // 星の満点

  return (
    <section className="bg-[#2E2018] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">
          飲み頃の傾向
        </h3>
        <span className="text-xs text-[#6b5a4a]">焙煎日つき {total}杯</span>
      </div>

      <p className="text-base text-[#F7EFE6] leading-relaxed">
        {peak ? (
          <>
            あなたは <span className="font-semibold text-[#CE9C68]">焙煎後 {bucketLabel(peak)}</span> の一杯を高く評価しています
          </>
        ) : (
          '焙煎後の日齢ごとの評価はこちら。記録が増えると、集中する帯が見えてきます。'
        )}
      </p>

      <div className="flex flex-col gap-2">
        {buckets.map(b => {
          const isPeak = peak != null && b.min === peak.min
          return (
            <div key={b.min} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-[#F7EFE6] tabular-nums">
                {bucketLabel(b)}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-[#1a0a05] overflow-hidden">
                <div
                  className={`h-full rounded-full ${isPeak ? 'bg-[#993C1D]' : 'bg-[#5a4632]'}`}
                  style={{ width: `${(b.avgRating / maxBar) * 100}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-xs tabular-nums">
                <span className={isPeak ? 'text-[#CE9C68]' : 'text-[#6b5a4a]'}>
                  ★{b.avgRating.toFixed(1)}
                </span>
                <span className="text-[#6b5a4a]"> · {b.count}</span>
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-[#6b5a4a] leading-relaxed">
        淹れた時点の焙煎からの経過日数と星評価の集計です。あなたの記録上の傾向であり、味の良し悪しを断定するものではありません。
      </p>
    </section>
  )
}
