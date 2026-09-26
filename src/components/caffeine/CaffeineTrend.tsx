import { useMemo } from 'react'
import type { IntakePoint } from './trends'
import {
  MIN_DAYS_WITH_RECORD,
  calcCaffeineTrendSummary,
  calcDailyCaffeine,
  calcTimeOfDayShares,
} from './trends'

// 1日の目安（健康な成人・EFSA / 食品安全委員会）。摂取量に対する参考ラインとしてだけ引く
const DAILY_REFERENCE_MG = 400

interface Props {
  points: IntakePoint[]
  days?: number
  now: Date
}

// カフェイン摂取の傾向。CLAUDE.md §12 に従い、**数値の提示にとどめる**。
// 「多い」「控えましょう」などの評価・助言や、睡眠への影響の断定は書かないこと。
export default function CaffeineTrend({ points, days = 7, now }: Props) {
  const daily   = useMemo(() => calcDailyCaffeine(points, days, now), [points, days, now])
  const shares  = useMemo(() => calcTimeOfDayShares(points, days, now), [points, days, now])
  const summary = useMemo(() => calcCaffeineTrendSummary(points, days, now), [points, days, now])

  if (!summary.hasEnoughData) {
    return (
      <div className="bg-[#2E2018] rounded-xl p-5 text-center">
        <p className="text-sm text-[#6b5a4a]">
          記録が{MIN_DAYS_WITH_RECORD}日分たまると、ここに傾向が出ます
        </p>
        <p className="text-xs text-[#4a3a2a] mt-1">
          いまは{summary.daysWithRecord}日分です
        </p>
      </div>
    )
  }

  // 棒の高さの基準。目安ラインが必ず収まるようにする
  const peak = Math.max(DAILY_REFERENCE_MG, ...daily.map(d => d.mg))

  return (
    <div className="flex flex-col gap-4">
      {/* 日別の摂取量 */}
      <div className="bg-[#2E2018] rounded-xl p-4">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <p className="text-xs text-[#CE9C68]">この{days}日間の摂取量</p>
          <p className="text-xs text-[#6b5a4a]">
            記録のあった日の平均 <span className="text-[#F7EFE6] tabular-nums">{summary.avgMgPerRecordedDay}</span>mg
          </p>
        </div>

        <div className="relative">
          {/* 400mg の目安ライン */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-[#CE9C68]/40"
            style={{ bottom: `${(DAILY_REFERENCE_MG / peak) * 100}%` }}
          >
            <span className="absolute right-0 -top-4 text-[10px] text-[#CE9C68]/70 tabular-nums">
              {DAILY_REFERENCE_MG}mg
            </span>
          </div>

          <div className="flex items-end justify-between gap-1.5 h-28">
            {daily.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <span className="text-[10px] text-[#6b5a4a] tabular-nums">
                  {d.mg > 0 ? d.mg : ''}
                </span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${Math.max(d.mg > 0 ? 2 : 0, (d.mg / peak) * 100)}%`,
                    background: d.isToday ? '#993C1D' : '#5a4632',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between gap-1.5 mt-1.5">
          {daily.map(d => (
            <span
              key={d.date}
              className={`flex-1 text-center text-[10px] ${d.isToday ? 'text-[#CE9C68]' : 'text-[#6b5a4a]'}`}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>

      {/* 時間帯の内訳 */}
      <div className="bg-[#2E2018] rounded-xl p-4">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <p className="text-xs text-[#CE9C68]">飲んでいる時間帯</p>
          <p className="text-xs text-[#6b5a4a]">
            15時以降が <span className="text-[#F7EFE6] tabular-nums">{Math.round(summary.afterMiddayRatio * 100)}</span>%
          </p>
        </div>

        {/* 割合の帯 */}
        <div className="flex h-3 rounded-full overflow-hidden bg-[#1a0a05]">
          {shares.map((s, i) => (
            s.ratio > 0 && (
              <div
                key={s.id}
                style={{
                  width: `${s.ratio * 100}%`,
                  background: ['#CE9C68', '#B4794A', '#993C1D', '#5E2412'][i],
                }}
              />
            )
          ))}
        </div>

        <div className="flex flex-col gap-1.5 mt-3">
          {shares.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: ['#CE9C68', '#B4794A', '#993C1D', '#5E2412'][i] }}
              />
              <span className="text-[#F7EFE6]">{s.label}</span>
              <span className="text-[#4a3a2a] text-[10px]">{s.note}</span>
              <span className="ml-auto text-[#6b5a4a] tabular-nums">
                {Math.round(s.ratio * 100)}%
              </span>
              <span className="text-[#4a3a2a] tabular-nums w-14 text-right">{s.mg}mg</span>
            </div>
          ))}
        </div>
      </div>

      {/* 推定であることと出典（§12）。解釈や助言はしない */}
      <p className="text-[10px] text-[#4a3a2a] leading-relaxed">
        いずれも記録された摂取量の集計です。カフェイン量は粉量やドリンクの種類からの推定値で、
        実際の含有量や代謝には個人差があります。1日 400mg は健康な成人の一般的な目安（EFSA・食品安全委員会）で、
        医学的な助言ではありません。
      </p>
    </div>
  )
}
