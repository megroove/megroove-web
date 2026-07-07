import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Brew, Bean } from '../db'
import { getAllBrews, getAllBeans, formatBrewDateShort, ROAST_LEVEL_LABELS } from '../db'
import RadarChart, { type RadarScores } from '../components/analysis/RadarChart'
import { RankBadge, GlobeIcon } from '../components/icons'

// ─── データ計算 ───────────────────────────────────────────────────────────────

type ScoreKey = 'acidity' | 'sweetness' | 'bitterness' | 'body' | 'aftertaste'
const SCORE_KEYS: ScoreKey[] = ['acidity', 'sweetness', 'bitterness', 'body', 'aftertaste']
const SCORE_LABELS: Record<ScoreKey, string> = {
  acidity: '酸味', sweetness: '甘み', bitterness: '苦味',
  body: 'ボディ', aftertaste: '後味',
}

function calcWeightedScores(brews: Brew[]): { scores: RadarScores; count: number } {
  // 星評価がありカッピングスコアが1軸以上入っているものが対象
  const eligible = brews.filter(
    b => (b.rating ?? 0) > 0 && SCORE_KEYS.some(k => b.cupping[k] !== undefined)
  )

  const scores: RadarScores = {}
  for (const key of SCORE_KEYS) {
    let wSum = 0, wTotal = 0
    for (const brew of eligible) {
      const val    = brew.cupping[key]
      const weight = brew.rating ?? 0
      if (val !== undefined && weight > 0) {
        wSum   += val * weight
        wTotal += weight
      }
    }
    if (wTotal > 0) scores[key] = wSum / wTotal
  }

  return { scores, count: eligible.length }
}

function generateInsight(scores: RadarScores): string {
  const entries = (Object.entries(scores) as [ScoreKey, number][]).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return ''

  const avg = entries.reduce((s, [, v]) => s + v, 0) / entries.length
  if (avg >= 4.2) return 'バランスよく高スコアです。理想の一杯を安定して再現できています。'
  if (avg <= 2.5) return '好みの軸を探し中。記録を重ねるほど傾向が明確になります。'

  const topKey    = entries[0][0]
  const bottomKey = entries[entries.length - 1][0]
  const spread    = entries[0][1] - entries[entries.length - 1][1]

  if (spread < 0.5) return 'すべての軸がバランスよく取れています。'

  return `${SCORE_LABELS[topKey]}を高く評価し、${SCORE_LABELS[bottomKey]}は控えめなコーヒーが好みのようです。`
}

function isThisMonth(brew: Brew): boolean {
  const d = new Date(brew.brewedAt), now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function isThisYear(brew: Brew): boolean {
  return new Date(brew.brewedAt).getFullYear() === new Date().getFullYear()
}

function rankBrews(brews: Brew[]): Brew[] {
  return [...brews].sort((a, b) => {
    const r = (b.rating ?? 0) - (a.rating ?? 0)
    if (r !== 0) return r
    const c = (b.cuppingAverage ?? 0) - (a.cuppingAverage ?? 0)
    if (c !== 0) return c
    return new Date(b.brewedAt).getTime() - new Date(a.brewedAt).getTime()
  })
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
  const [beanMap, setBeanMap] = useState<Map<string, Bean>>(new Map())
  const [dbError, setDbError] = useState(false)

  useEffect(() => {
    Promise.all([getAllBrews(), getAllBeans()]).then(([bs, beans]) => {
      setBrews(bs)
      setBeanMap(new Map(beans.map(b => [b.id, b])))
    }).catch(() => setDbError(true))
  }, [])

  const { scores, count } = useMemo(() => calcWeightedScores(brews), [brews])
  const insight           = useMemo(() => generateInsight(scores), [scores])
  const hasEnoughData     = count >= 3

  const monthlyBrews = useMemo(() => brews.filter(isThisMonth), [brews])
  const yearlyBrews  = useMemo(() => brews.filter(isThisYear),  [brews])

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
