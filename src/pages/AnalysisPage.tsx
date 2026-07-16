import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Brew, Bean, CafeVisit } from '../db'
import {
  getAllBrews, getAllBeans, getAllCafeVisits,
  formatBrewDateShort, formatSecToMmSs, ROAST_LEVEL_LABELS,
} from '../db'
import RadarChart from '../components/analysis/RadarChart'
import TrendChart from '../components/analysis/TrendChart'
import {
  calcWeightedScores, generateInsight, rankBrews,
  calcMonthlyTrend, calcBestConditions, calcBeanStats,
} from '../components/analysis/stats'
import { RankBadge, GlobeIcon, CupIcon } from '../components/icons'

function isThisMonth(brew: Brew): boolean {
  const d = new Date(brew.brewedAt), now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function isThisYear(brew: Brew): boolean {
  return new Date(brew.brewedAt).getFullYear() === new Date().getFullYear()
}

// ─── RankCard ────────────────────────────────────────────────────────────────

function RankCard({
  rank, brew, bean,
}: {
  rank: number
  brew: Brew
  bean?: Bean
}) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(`/library/${brew.id}`)}
      className="w-full flex items-center gap-3 bg-[#2E2018] rounded-xl p-4 text-left active:opacity-80"
    >
      <RankBadge rank={rank} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[#F7EFE6] font-medium truncate">
            {bean?.name ?? '豆の記録なし'}
          </p>
          {brew.rating !== undefined && (
            <span className="text-[#CE9C68] text-sm flex-shrink-0">
              {'★'.repeat(brew.rating)}{'☆'.repeat(5 - brew.rating)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-[#6b5a4a]">{formatBrewDateShort(brew.brewedAt)}</span>
          {bean && (
            <span className="text-xs text-[#6b5a4a]">
              · {ROAST_LEVEL_LABELS[bean.roastLevel]}
            </span>
          )}
          {brew.cuppingAverage !== undefined && (
            <span className="text-xs text-[#CE9C68]">
              · カッピング {brew.cuppingAverage.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── RankingSection ──────────────────────────────────────────────────────────

function RankingSection({
  title, brews, beanMap, emptyMessage,
}: {
  title: string
  brews: Brew[]
  beanMap: Map<string, Bean>
  emptyMessage: string
}) {
  const top3 = useMemo(() => rankBrews(brews).slice(0, 3), [brews])

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">{title}</h3>
      {top3.length === 0 ? (
        <div className="bg-[#2E2018] rounded-xl p-5 text-center text-[#6b5a4a] text-sm">
          {emptyMessage}
        </div>
      ) : (
        top3.map((brew, i) => (
          <RankCard
            key={brew.id}
            rank={i + 1}
            brew={brew}
            bean={brew.beanId ? beanMap.get(brew.beanId) : undefined}
          />
        ))
      )}
    </section>
  )
}

// ─── AnalysisPage ────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const navigate = useNavigate()
  const [brews, setBrews]     = useState<Brew[]>([])
  const [visits, setVisits]   = useState<CafeVisit[]>([])
  const [beanMap, setBeanMap] = useState<Map<string, Bean>>(new Map())
  const [trendMonths, setTrendMonths] = useState<6 | 12>(6)
  const [dbError, setDbError] = useState(false)

  useEffect(() => {
    Promise.all([getAllBrews(), getAllBeans(), getAllCafeVisits()]).then(([bs, beans, vs]) => {
      setBrews(bs)
      setVisits(vs)
      setBeanMap(new Map(beans.map(b => [b.id, b])))
    }).catch(() => setDbError(true))
  }, [])

  const { scores, count } = useMemo(() => calcWeightedScores(brews), [brews])
  const insight           = useMemo(() => generateInsight(scores), [scores])
  const hasEnoughData     = count >= 3

  const bestConditions = useMemo(() => calcBestConditions(brews), [brews])
  // ゴールデンレシピ = 生涯ベストの一杯（★4以上が3杯以上あるときのみ）
  // bestConditions ≠ null なら ★4以上が3杯以上あるので、rankBrews の先頭は必ず ★4以上
  const goldenBrew = useMemo(
    () => (bestConditions ? rankBrews(brews)[0] : null),
    [brews, bestConditions],
  )
  const highRatedCount = useMemo(
    () => brews.filter(b => (b.rating ?? 0) >= 4).length,
    [brews],
  )
  const trend          = useMemo(() => calcMonthlyTrend(brews, visits, trendMonths), [brews, visits, trendMonths])
  const hasTrendData   = useMemo(() => trend.some(m => m.cups > 0), [trend])
  const beanStats      = useMemo(() => calcBeanStats(brews).slice(0, 5), [brews])

  const monthlyBrews = useMemo(() => brews.filter(isThisMonth), [brews])
  const yearlyBrews  = useMemo(() => brews.filter(isThisYear),  [brews])

  // 累計統計
  const totals = useMemo(() => {
    const doseSum = brews.reduce((s, b) => s + (b.doseG ?? 0), 0)
    const spend   = visits.reduce((s, v) => s + (v.price ?? 0), 0)
    const origins = new Set<string>()
    for (const b of brews) {
      const origin = b.beanId ? beanMap.get(b.beanId)?.origin : undefined
      if (origin) origins.add(origin)
    }
    for (const v of visits) {
      if (v.beanOrigin) origins.add(v.beanOrigin)
    }
    return {
      cups: brews.length + visits.length,
      doseSum,
      spend,
      originCount: origins.size,
    }
  }, [brews, visits, beanMap])

  const now          = new Date()
  const monthLabel   = `${now.getMonth() + 1}月のトップ3`
  const yearLabel    = `${now.getFullYear()}年のトップ3`

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-6 overflow-y-auto">
      <h2 className="text-xl font-semibold text-[#F7EFE6]">分析</h2>

      {dbError && (
        <div className="bg-[#3e1a0a] border border-[#993C1D]/40 rounded-xl px-4 py-3 text-sm text-[#CE9C68]">
          データの読み込みに失敗しました。ブラウザを再読み込みしてください。
        </div>
      )}

      {/* レーダーチャート */}
      <section className="bg-[#2E2018] rounded-xl p-5 flex flex-col items-center gap-4">
        <div className="w-full flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">
            好みのレーダーチャート
          </h3>
          {hasEnoughData && (
            <span className="text-xs text-[#6b5a4a]">{count}杯の平均</span>
          )}
        </div>

        {hasEnoughData ? (
          <>
            <RadarChart scores={scores} />
            {insight && (
              <p className="text-sm text-[#CE9C68] text-center leading-relaxed px-2">
                {insight}
              </p>
            )}
          </>
        ) : (
          <div className="py-8 flex flex-col items-center gap-2 text-center">
            {/* 仮のグレーアウト五角形 */}
            <svg width="140" height="140" viewBox="0 0 240 240" className="opacity-20">
              {[1, 2, 3, 4, 5].map(lvl => (
                <polygon
                  key={lvl}
                  points={[0,1,2,3,4].map(i => {
                    const a = (-Math.PI / 2) + (2 * Math.PI * i) / 5
                    const r = (lvl / 5) * 78
                    return `${120 + r * Math.cos(a)},${118 + r * Math.sin(a)}`
                  }).join(' ')}
                  fill="none"
                  stroke="#CE9C68"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
            <p className="text-sm text-[#6b5a4a]">
              星評価＋カッピングスコア入りの記録が
              <br />
              3杯以上で表示されます
            </p>
            {count > 0 && (
              <p className="text-xs text-[#4a3a2a]">現在 {count} 杯</p>
            )}
          </div>
        )}
      </section>

      {/* あなたのゴールデンレシピ（生涯ベストの一杯 + ★4以上の傾向） */}
      {goldenBrew && bestConditions ? (
        <section className="bg-[#2E2018] rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">
              あなたのゴールデンレシピ
            </h3>
            <span className="text-xs text-[#6b5a4a]">{formatBrewDateShort(goldenBrew.brewedAt)}</span>
          </div>

          {/* 生涯ベストの一杯 */}
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-base text-[#F7EFE6] font-semibold truncate">
              {(goldenBrew.beanId && beanMap.get(goldenBrew.beanId)?.name) ?? 'ホームブリュー'}
            </p>
            <span className="text-sm text-[#CE9C68] tracking-tight shrink-0">
              {'★'.repeat(goldenBrew.rating ?? 0)}
              {goldenBrew.doseG != null && goldenBrew.waterG != null && (
                <span className="text-xs text-[#6b5a4a] ml-2">{goldenBrew.doseG}g / {goldenBrew.waterG}g</span>
              )}
            </span>
          </div>

          {/* その一杯の実条件（未記録の項目は出さない） */}
          <div className="grid grid-cols-2 gap-3">
            {goldenBrew.doseG != null && goldenBrew.waterG != null && goldenBrew.doseG > 0 && (
              <div className="bg-[#3e3020] rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-[#F7EFE6] tabular-nums">
                  1:{(goldenBrew.waterG / goldenBrew.doseG).toFixed(1)}
                </p>
                <p className="text-[10px] text-[#6b5a4a] mt-0.5">比率</p>
              </div>
            )}
            {goldenBrew.tempC != null && (
              <div className="bg-[#3e3020] rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-[#F7EFE6] tabular-nums">{goldenBrew.tempC}°C</p>
                <p className="text-[10px] text-[#6b5a4a] mt-0.5">湯温</p>
              </div>
            )}
            {goldenBrew.grindSize != null && (
              <div className="bg-[#3e3020] rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-[#F7EFE6] tabular-nums">{goldenBrew.grindSize}</p>
                <p className="text-[10px] text-[#6b5a4a] mt-0.5">挽き目</p>
              </div>
            )}
            {goldenBrew.totalTimeSec != null && (
              <div className="bg-[#3e3020] rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-[#F7EFE6] tabular-nums">
                  {formatSecToMmSs(goldenBrew.totalTimeSec)}
                </p>
                <p className="text-[10px] text-[#6b5a4a] mt-0.5">抽出時間</p>
              </div>
            )}
          </div>

          {/* ★4以上の傾向（集計平均。副次表示） */}
          <p className="text-xs text-[#6b5a4a] leading-relaxed">
            ★4以上 {bestConditions.count}杯の傾向 —{' '}
            {[
              bestConditions.ratio !== undefined && `1:${bestConditions.ratio.toFixed(1)}`,
              bestConditions.tempC !== undefined && `${Math.round(bestConditions.tempC)}°C`,
              bestConditions.grindSize !== undefined && `挽き目 ${bestConditions.grindSize.toFixed(1)}`,
              bestConditions.timeSec !== undefined && formatSecToMmSs(Math.round(bestConditions.timeSec)),
            ].filter(Boolean).join('・')}
          </p>

          <button
            type="button"
            onClick={() => navigate('/brew', { state: { fromBrewId: goldenBrew.id } })}
            className="w-full bg-[#993C1D] text-[#F7EFE6] py-3.5 rounded-xl font-semibold text-sm active:opacity-80 flex items-center justify-center gap-2"
          >
            <CupIcon size={18} />
            この条件で淹れる
          </button>
        </section>
      ) : brews.length > 0 ? (
        // 空状態: 記録はあるが ★4以上が3杯未満
        <section className="bg-[#2E2018] rounded-xl p-5 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">
            あなたのゴールデンレシピ
          </h3>
          <p className="text-sm text-[#6b5a4a] leading-relaxed">
            ★4以上の記録が3杯たまると、あなたのゴールデンレシピが現れます（いま {highRatedCount}杯）
          </p>
        </section>
      ) : null}

      {/* トレンド */}
      {hasTrendData && (
        <section className="bg-[#2E2018] rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">トレンド</h3>
            <div className="flex gap-0.5 bg-[#1a0a05] rounded-lg p-0.5">
              {([6, 12] as const).map(m => (
                <button key={m} type="button" onClick={() => setTrendMonths(m)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    trendMonths === m ? 'bg-[#993C1D] text-[#F7EFE6]' : 'text-[#6b5a4a]'
                  }`}
                >
                  {m}ヶ月
                </button>
              ))}
            </div>
          </div>
          <TrendChart months={trend} />
        </section>
      )}

      {/* 豆ごとの分析 */}
      {beanStats.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">豆ごとの分析</h3>
          {beanStats.map(stat => {
            const bean = beanMap.get(stat.beanId)
            if (!bean) return null
            return (
              <button
                key={stat.beanId}
                type="button"
                onClick={() => navigate(`/analysis/bean/${stat.beanId}`)}
                className="w-full bg-[#2E2018] rounded-xl p-4 flex items-center justify-between active:opacity-80"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[#CE9C68]"><CupIcon size={18} /></span>
                  <div className="text-left min-w-0">
                    <p className="text-[#F7EFE6] text-sm font-medium truncate">{bean.name}</p>
                    <p className="text-xs text-[#6b5a4a] mt-0.5">
                      {stat.count}杯
                      {stat.avgRating !== undefined ? ` · 平均★${stat.avgRating.toFixed(1)}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-[#6b5a4a] text-sm shrink-0 ml-2">→</span>
              </button>
            )
          })}
        </section>
      )}

      {/* 月間ランキング */}
      <RankingSection
        title={monthLabel}
        brews={monthlyBrews}
        beanMap={beanMap}
        emptyMessage="今月の記録がありません"
      />

      {/* 年間ランキング */}
      <RankingSection
        title={yearLabel}
        brews={yearlyBrews}
        beanMap={beanMap}
        emptyMessage="今年の記録がありません"
      />

      {/* 累計 */}
      {totals.cups > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">これまでの記録</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#2E2018] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[#F7EFE6] tabular-nums">{totals.cups}</p>
              <p className="text-xs text-[#CE9C68] mt-0.5">総杯数</p>
            </div>
            <div className="bg-[#2E2018] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[#F7EFE6] tabular-nums">
                {totals.doseSum >= 1000 ? `${(totals.doseSum / 1000).toFixed(1)}kg` : `${Math.round(totals.doseSum)}g`}
              </p>
              <p className="text-xs text-[#CE9C68] mt-0.5">豆の消費量</p>
            </div>
            <div className="bg-[#2E2018] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[#F7EFE6] tabular-nums">¥{totals.spend.toLocaleString()}</p>
              <p className="text-xs text-[#CE9C68] mt-0.5">カフェ支出</p>
            </div>
            <div className="bg-[#2E2018] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[#F7EFE6] tabular-nums">{totals.originCount}</p>
              <p className="text-xs text-[#CE9C68] mt-0.5">出会った産地</p>
            </div>
          </div>
        </section>
      )}

      {/* 産地パスポートへ */}
      <button
        type="button"
        onClick={() => navigate('/passport')}
        className="w-full bg-[#2E2018] rounded-xl p-4 flex items-center justify-between active:opacity-80"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#CE9C68]"><GlobeIcon size={24} /></span>
          <div className="text-left">
            <p className="text-[#F7EFE6] text-sm font-semibold">産地パスポート</p>
            <p className="text-xs text-[#6b5a4a] mt-0.5">記録した豆の産地を一覧で確認</p>
          </div>
        </div>
        <span className="text-[#6b5a4a] text-sm">→</span>
      </button>
    </div>
  )
}
