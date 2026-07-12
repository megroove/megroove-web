import { useState, useEffect } from 'react'
import { getAllBrews, getAllCafeVisits } from '../db'
import { calcResidualCaffeine, loadSettings, saveSettings, getBedtimeDate, isSameLocalDay } from '../db'
import CaffeineGraph from '../components/caffeine/CaffeineGraph'
import { CupIcon, CafeIcon } from '../components/icons'

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

type IntakeEntry = {
  caffeineAmount: number
  brewedAt: string
  label: string   // 表示用ラベル
  kind: 'brew' | 'cafe'
}

export default function CaffeinePage() {
  const [intakeEntries, setIntakeEntries] = useState<IntakeEntry[]>([])
  const [settings, setSettings] = useState(loadSettings)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000

    Promise.all([getAllBrews(), getAllCafeVisits()]).then(([brews, visits]) => {
      const brewEntries: IntakeEntry[] = brews
        .filter(b => b.caffeineAmount != null && new Date(b.brewedAt).getTime() > cutoff)
        .map(b => ({
          caffeineAmount: b.caffeineAmount!,
          brewedAt: b.brewedAt,
          label: 'ホームブリュー',
          kind: 'brew' as const,
        }))

      const cafeEntries: IntakeEntry[] = visits
        .filter(v => v.caffeineAmount != null && new Date(v.visitedAt).getTime() > cutoff)
        .map(v => ({
          caffeineAmount: v.caffeineAmount!,
          brewedAt: v.visitedAt,
          label: v.cafeName,
          kind: 'cafe' as const,
        }))

      const merged = [...brewEntries, ...cafeEntries]
        .sort((a, b) => b.brewedAt.localeCompare(a.brewedAt))

      setIntakeEntries(merged)
    }).catch(() => {/* カフェイン履歴の読込失敗時はグラフを空で表示 */})
  }, [])

  const intakes = intakeEntries.map(e => ({
    caffeineAmount: e.caffeineAmount,
    brewedAt: e.brewedAt,
  }))

  const current = calcResidualCaffeine(intakes, now)
  const bedtime = getBedtimeDate(settings.bedtimeHour, settings.bedtimeMinute, now)
  const atBedtime = calcResidualCaffeine(intakes, bedtime)

  const MAX_REF = 400
  const pct = Math.min(100, (current / MAX_REF) * 100)
  const barColor = current < 100 ? '#4ade80' : current < 250 ? '#CE9C68' : '#993C1D'

  // 今日（0時〜現在）の摂取合計。バーは 500mg スケールに 400mg の目安ラインを重ねる
  const todayIntake = intakeEntries
    .filter(e => isSameLocalDay(e.brewedAt, now))
    .reduce((sum, e) => sum + e.caffeineAmount, 0)
  const intakeScale = Math.max(500, todayIntake)
  const intakePct = (todayIntake / intakeScale) * 100
  const guidePct = (400 / intakeScale) * 100

  // 就寝時のステータスは、ユーザー自身が設定した目標値との比較のみで表現する
  // （睡眠への影響を断定しない。CLAUDE.md「健康情報の扱い」参照）
  const target = settings.bedtimeTargetMg
  const exceedsTarget = atBedtime > target
  const bedtimeLabel = !exceedsTarget ? '目標内' : atBedtime <= target * 2 ? '目標超え' : '目標を大きく超え'
  const bedtimeColor = !exceedsTarget ? 'text-emerald-400' : atBedtime <= target * 2 ? 'text-amber-400' : 'text-[#E07A4F]'

  const updateSettings = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-4 overflow-y-auto">
      <h2 className="text-xl font-semibold text-[#F7EFE6]">カフェイン</h2>

      {/* 現在の残留量 */}
      <div className="bg-[#2E2018] rounded-xl p-5">
        <p className="text-xs text-[#CE9C68]">現在の体内残留量（推定）</p>
        <p className="text-4xl font-bold text-[#F7EFE6] tabular-nums mt-2">
          {Math.round(current)}
          <span className="text-lg font-normal text-[#CE9C68] ml-1">mg</span>
        </p>
        <div className="mt-3 h-2 bg-[#3e3020] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>
      </div>

      {/* 今日の摂取量（1日の目安 400mg は摂取量に対する基準なのでこちらに表示） */}
      <div className="bg-[#2E2018] rounded-xl p-5">
        <p className="text-xs text-[#CE9C68]">今日の摂取量（推定）</p>
        <p className="text-4xl font-bold text-[#F7EFE6] tabular-nums mt-2">
          {Math.round(todayIntake)}
          <span className="text-lg font-normal text-[#CE9C68] ml-1">mg</span>
        </p>
        <div className="mt-3 relative h-2 bg-[#3e3020] rounded-full">
          <div
            className="h-full rounded-full bg-[#CE9C68] transition-all duration-500"
            style={{ width: `${intakePct}%` }}
          />
          {/* 400mg 目安ライン */}
          <div
            className="absolute -top-1 -bottom-1 w-px bg-[#F7EFE6]/40"
            style={{ left: `${guidePct}%` }}
          />
        </div>
        <p className="text-xs text-[#4a3a2a] mt-1.5">
          参考: 健康な成人では 1日 400mg 程度までが目安とされています（EFSA・食品安全委員会）
        </p>
        {todayIntake > 400 && (
          <p className="text-xs text-[#CE9C68] mt-1">一般的な目安を上回っています（目安には個人差があります）</p>
        )}
      </div>

      {/* 推移グラフ */}
      <div className="bg-[#2E2018] rounded-xl p-4">
        <p className="text-xs text-[#CE9C68] mb-3">体内残留量の推移</p>
        <CaffeineGraph
          intakes={intakes}
          bedtimeHour={settings.bedtimeHour}
          bedtimeMinute={settings.bedtimeMinute}
          targetMg={settings.bedtimeTargetMg}
          now={now}
        />
        <div className="flex gap-4 mt-2 justify-end">
          <span className="text-[10px] text-[#6b5a4a] flex items-center gap-1">
            <svg width="20" height="8" viewBox="0 0 20 8">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#F7EFE6" strokeWidth="2"/>
            </svg>
            実績
          </span>
          <span className="text-[10px] text-[#6b5a4a] flex items-center gap-1">
            <svg width="20" height="8" viewBox="0 0 20 8">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#F7EFE6" strokeWidth="2" strokeDasharray="5 4" opacity="0.45"/>
            </svg>
            予測
          </span>
          <span className="text-[10px] text-[#CE9C68] flex items-center gap-1">
            <svg width="20" height="8" viewBox="0 0 20 8">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#CE9C68" strokeWidth="1.5" strokeDasharray="4 3"/>
            </svg>
            目標
          </span>
          <span className="text-[10px] text-[#993C1D] flex items-center gap-1">
            <svg width="20" height="8" viewBox="0 0 20 8">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#993C1D" strokeWidth="1.5" strokeDasharray="4 3"/>
            </svg>
            就寝
          </span>
        </div>
      </div>

      {/* 就寝時予測 */}
      <div className={`rounded-xl p-5 flex items-center justify-between ${
        exceedsTarget ? 'bg-amber-900/40 border border-amber-600/40' : 'bg-[#2E2018]'
      }`}>
        <div>
          <p className="text-xs text-[#CE9C68] mb-1">
            就寝時の予測（{pad(settings.bedtimeHour)}:{pad(settings.bedtimeMinute)}）
          </p>
          <p className="text-2xl font-bold text-[#F7EFE6] tabular-nums">
            {Math.round(atBedtime)}
            <span className="text-sm font-normal text-[#CE9C68] ml-1">mg</span>
          </p>
          {exceedsTarget && (
            <p className="text-xs text-amber-400 mt-1">目標 {settings.bedtimeTargetMg}mg を上回る見込みです（推定）</p>
          )}
          <p className="text-[10px] text-[#6b5a4a] mt-1">睡眠への感じ方には個人差があります</p>
        </div>
        <span className={`text-sm font-medium ${bedtimeColor}`}>{bedtimeLabel}</span>
      </div>

      {/* 過去24時間の摂取ログ */}
      <div className="bg-[#2E2018] rounded-xl p-4">
        <p className="text-xs text-[#CE9C68] mb-3">過去24時間の摂取</p>
        {intakeEntries.length === 0 ? (
          <p className="text-[#4a3a2a] text-sm text-center py-3">記録された摂取はありません</p>
        ) : (
          <div className="flex flex-col">
            {intakeEntries.map((entry, i) => {
              const residual = calcResidualCaffeine(
                [{ caffeineAmount: entry.caffeineAmount, brewedAt: entry.brewedAt }],
                now,
              )
              const d = new Date(entry.brewedAt)
              return (
                <div key={i}
                  className="flex items-center justify-between py-2.5 border-b border-[#3e3020] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#6b5a4a] tabular-nums w-10 shrink-0">
                      {pad(d.getHours())}:{pad(d.getMinutes())}
                    </span>
                    <div>
                      <p className="text-sm text-[#F7EFE6]">{entry.caffeineAmount}mg 摂取</p>
                      <p className="text-xs text-[#6b5a4a] flex items-center gap-1">
                        {entry.kind === 'brew'
                          ? <CupIcon size={11} className="shrink-0" />
                          : <CafeIcon size={11} className="shrink-0" />}
                        {entry.label}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-[#CE9C68] tabular-nums shrink-0">
                    残 {Math.round(residual)}mg
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 設定 */}
      <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-4">
        <p className="text-xs text-[#CE9C68]">設定</p>

        {/* 就寝時刻 */}
        <div>
          <p className="text-xs text-[#6b5a4a] mb-2">就寝予定時刻</p>
          <div className="flex items-center gap-2 justify-center">
            <select value={settings.bedtimeHour}
              onChange={e => updateSettings({ bedtimeHour: Number(e.target.value) })}
              className="bg-[#3e3020] text-[#F7EFE6] rounded-lg px-3 py-2 text-lg font-semibold outline-none"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{pad(i)}</option>
              ))}
            </select>
            <span className="text-[#F7EFE6] text-xl font-semibold">:</span>
            <select value={settings.bedtimeMinute}
              onChange={e => updateSettings({ bedtimeMinute: Number(e.target.value) })}
              className="bg-[#3e3020] text-[#F7EFE6] rounded-lg px-3 py-2 text-lg font-semibold outline-none"
            >
              {[0, 15, 30, 45].map(m => (
                <option key={m} value={m}>{pad(m)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 目標残留量 */}
        <div>
          <p className="text-xs text-[#6b5a4a] mb-2">就寝時の目標残留量</p>
          <div className="flex items-center gap-2 justify-center">
            <button type="button"
              onClick={() => updateSettings({ bedtimeTargetMg: Math.max(0, settings.bedtimeTargetMg - 10) })}
              className="w-9 h-9 rounded-full bg-[#3e3020] text-[#F7EFE6] text-xl flex items-center justify-center active:opacity-70"
            >
              −
            </button>
            <span className="w-20 text-center text-[#F7EFE6] text-xl font-semibold tabular-nums">
              {settings.bedtimeTargetMg}mg
            </span>
            <button type="button"
              onClick={() => updateSettings({ bedtimeTargetMg: Math.min(200, settings.bedtimeTargetMg + 10) })}
              className="w-9 h-9 rounded-full bg-[#3e3020] text-[#F7EFE6] text-xl flex items-center justify-center active:opacity-70"
            >
              ＋
            </button>
          </div>
          <p className="text-xs text-[#4a3a2a] text-center mt-1">0〜200mg。就寝時に残したくない量を、あなたの体感に合わせて設定してください（感じ方には個人差があります）</p>
        </div>
      </div>

      <div className="text-xs text-[#4a3a2a] text-center pb-2 flex flex-col gap-1.5 leading-relaxed">
        <p>
          カフェイン量はコーヒー粉 1g あたり約 12mg、カフェドリンクは種類とサイズからの推定値です。
          残留量は半減期 5.5 時間の一般的なモデルによる概算で、実際の代謝には大きな個人差があります。
        </p>
        <p>
          本画面の数値は生活の参考情報であり、医学的な助言・診断ではありません。
          体調に不安があるときは医師などの専門家にご相談ください。
        </p>
        <p>
          参考: 食品安全委員会・欧州食品安全機関（EFSA）は、健康な成人で 1日 400mg 程度までを
          目安とする見解を公表しています。
        </p>
      </div>
    </div>
  )
}
