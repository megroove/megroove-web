import { useState, useEffect, useCallback } from 'react'
import type { SleepLog, AppSettings } from '../../db'
import {
  getAllSleepLogs, putSleepLog, deleteSleepLog,
  getAllBrews, getAllCafeVisits, getAllCaffeineIntakes,
  localDateKey, nowISO,
} from '../../db'
import { calcSleepBedtimeStats, type SleepBedtimeStats } from '../analysis/stats'
import { useToast } from '../Toast'
import { MoonIcon } from '../icons'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const RATING_BTN: { value: number; label: string }[] = [
  { value: 3, label: 'よい' },
  { value: 2, label: 'ふつう' },
  { value: 1, label: 'あまり' },
]
const DAYS_TO_SHOW = 7 // 直近7日を手動入力・遡り入力の対象に

function pad(n: number) { return n.toString().padStart(2, '0') }

export default function SleepSection({ settings }: { settings: AppSettings }) {
  const showToast = useToast()
  const [byDate, setByDate] = useState<Map<string, number>>(new Map())
  const [stats, setStats] = useState<SleepBedtimeStats | null>(null)

  const load = useCallback(() => {
    Promise.all([getAllSleepLogs(), getAllBrews(), getAllCafeVisits(), getAllCaffeineIntakes()])
      .then(([logs, brews, visits, others]) => {
        setByDate(new Map(logs.map(l => [l.date, l.rating])))
        // 全期間のカフェイン摂取（brew/cafe/other）を {caffeineAmount, brewedAt} に正規化
        const intakes = [
          ...brews.filter(b => b.caffeineAmount != null).map(b => ({ caffeineAmount: b.caffeineAmount!, brewedAt: b.brewedAt })),
          ...visits.filter(v => v.caffeineAmount != null).map(v => ({ caffeineAmount: v.caffeineAmount!, brewedAt: v.visitedAt })),
          ...others.map(o => ({ caffeineAmount: o.caffeineAmount, brewedAt: o.consumedAt })),
        ]
        setStats(calcSleepBedtimeStats(logs, intakes, {
          bedtimeHour: settings.bedtimeHour,
          bedtimeMinute: settings.bedtimeMinute,
          targetMg: settings.bedtimeTargetMg,
        }))
      })
      .catch(() => {/* 読込失敗時は空表示 */})
  }, [settings.bedtimeHour, settings.bedtimeMinute, settings.bedtimeTargetMg])

  useEffect(() => { load() }, [load])

  // 直近 DAYS_TO_SHOW 日分の日付（今日から過去へ）
  const days = Array.from({ length: DAYS_TO_SHOW }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d
  })

  const setRating = async (dateKey: string, rating: number) => {
    const current = byDate.get(dateKey)
    try {
      if (current === rating) {
        // 同じ評価を再タップ＝取り消し
        await deleteSleepLog(dateKey)
      } else {
        const log: SleepLog = { date: dateKey, rating, createdAt: nowISO() }
        await putSleepLog(log)
      }
      load()
    } catch {
      showToast('保存に失敗しました', { type: 'error' })
    }
  }

  return (
    <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-4">
      <p className="text-xs text-[#CE9C68] flex items-center gap-1.5">
        <MoonIcon size={14} /> 睡眠（眠りの記録）
      </p>

      {/* 手動入力・遡り入力（直近7日） */}
      <div className="flex flex-col">
        {days.map(d => {
          const key = localDateKey(d)
          const isToday = key === localDateKey(new Date())
          const rating = byDate.get(key)
          return (
            <div key={key} className="flex items-center gap-2 py-1.5 border-b border-[#3e3020] last:border-0">
              <span className="text-xs text-[#6b5a4a] tabular-nums w-16 shrink-0">
                {isToday ? '今朝' : `${d.getMonth() + 1}/${pad(d.getDate())}(${WEEKDAYS[d.getDay()]})`}
              </span>
              <div className="flex gap-1.5 flex-1">
                {RATING_BTN.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(key, value)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      rating === value ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#3e3020] text-[#CE9C68]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* 傾向（結果の数値のみ。§12: 解釈・助言は書かない） */}
      <div className="border-t border-[#3e3020] pt-4">
        <p className="text-xs text-[#CE9C68] mb-3">就寝時カフェインと睡眠の傾向</p>
        {stats?.enough ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#3e3020] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-[#F7EFE6] tabular-nums">{stats.high.avg.toFixed(1)}<span className="text-xs font-normal text-[#CE9C68]">/3</span></p>
                <p className="text-[10px] text-[#6b5a4a] mt-1 leading-snug">就寝時の推定残留が<br />目標（{settings.bedtimeTargetMg}mg）超の夜の翌朝<br />（{stats.high.n}日）</p>
              </div>
              <div className="bg-[#3e3020] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-[#F7EFE6] tabular-nums">{stats.low.avg.toFixed(1)}<span className="text-xs font-normal text-[#CE9C68]">/3</span></p>
                <p className="text-[10px] text-[#6b5a4a] mt-1 leading-snug">目標以下だった夜の翌朝<br />（{stats.low.n}日）</p>
              </div>
            </div>
            <p className="text-[10px] text-[#4a3a2a] mt-2 leading-relaxed">
              就寝 {pad(settings.bedtimeHour)}:{pad(settings.bedtimeMinute)}・半減期5.5時間の推定残留量で前夜を二分し、
              翌朝の睡眠評価（1〜3）の平均を並べたものです。数値の集計であり、睡眠には多くの要因があります。
              因果関係を示すものでも、医学的助言でもありません。
            </p>
          </>
        ) : (
          <p className="text-xs text-[#4a3a2a] leading-relaxed">
            記録がたまると、ここに傾向（数値）が表示されます。
            {stats && (
              <>（現在: 目標超の夜 {stats.high.n}日 / 目標以下の夜 {stats.low.n}日。各グループ最低 {stats.minPerBucket}日ずつで表示）</>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
