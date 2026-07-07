import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Brew, Bean } from '../db'
import {
  getBean, getAllBrews,
  calcRatio, formatBrewDateShort, formatSecToMmSs, formatBeanRemaining,
  ROAST_LEVEL_LABELS, daysSinceRoast,
} from '../db'
import RadarChart from '../components/analysis/RadarChart'
import { calcWeightedScores, rankBrews } from '../components/analysis/stats'
import { CupIcon } from '../components/icons'

export default function BeanAnalysisPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [bean, setBean] = useState<Bean | null>(null)
  const [allBrews, setAllBrews] = useState<Brew[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([getBean(id), getAllBrews()])
      .then(([b, brews]) => {
        if (!b) { navigate('/analysis', { replace: true }); return }
        setBean(b)
        setAllBrews(brews)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, navigate])

  const beanBrews = useMemo(
    () => allBrews.filter(b => b.beanId === id),
    [allBrews, id],
  )

  const ratings = useMemo(
    () => beanBrews.map(b => b.rating).filter((r): r is number => Boolean(r)),
    [beanBrews],
  )
  const avgRating = ratings.length > 0
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : undefined

  const best = useMemo(
    () => (beanBrews.some(b => b.rating) ? rankBrews(beanBrews)[0] : undefined),
    [beanBrews],
  )

  const { scores, count: radarCount } = useMemo(
    () => calcWeightedScores(beanBrews),
    [beanBrews],
  )

  const recent = useMemo(
    () => [...beanBrews].reverse().slice(0, 10),
    [beanBrews],
  )

  if (loading || !bean) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[#6b5a4a] text-sm">読み込み中...</p>
      </div>
    )
  }

  const remaining = formatBeanRemaining(bean, allBrews)

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-4 overflow-y-auto">
      <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm self-start">
        ← 戻る
      </button>

      {/* 豆ヘッダー */}
      <div>
        <h2 className="text-2xl font-semibold text-[#F7EFE6]">{bean.name}</h2>
        <p className="text-sm text-[#CE9C68] mt-1">
          {ROAST_LEVEL_LABELS[bean.roastLevel]}
          {bean.roastedAt ? ` · 焙煎から${daysSinceRoast(bean.roastedAt)}日` : ''}
          {bean.origin ? ` · ${bean.origin}` : ''}
        </p>
        {remaining && <p className="text-xs text-[#6b5a4a] mt-0.5">{remaining}</p>}
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#2E2018] rounded-xl px-2 py-3 text-center">
          <p className="text-xl font-bold text-[#F7EFE6] tabular-nums">{beanBrews.length}</p>
          <p className="text-[10px] text-[#6b5a4a] mt-1">杯数</p>
        </div>
        <div className="bg-[#2E2018] rounded-xl px-2 py-3 text-center">
          <p className="text-xl font-bold text-[#F7EFE6] tabular-nums">
            {avgRating !== undefined ? avgRating.toFixed(1) : '—'}
          </p>
          <p className="text-[10px] text-[#6b5a4a] mt-1">平均★</p>
        </div>
        <div className="bg-[#2E2018] rounded-xl px-2 py-3 text-center">
          <p className="text-xl font-bold text-[#F7EFE6] tabular-nums">
            {best?.rating ?? '—'}
          </p>
          <p className="text-[10px] text-[#6b5a4a] mt-1">ベスト★</p>
        </div>
      </div>

      {/* この豆のレーダー */}
      {radarCount >= 3 && (
        <section className="bg-[#2E2018] rounded-xl p-5 flex flex-col items-center gap-3">
          <div className="w-full flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">
              この豆の味わい
            </h3>
            <span className="text-xs text-[#6b5a4a]">{radarCount}杯の平均</span>
          </div>
          <RadarChart scores={scores} />
        </section>
      )}

      {/* ベストの一杯 */}
      {best && (
        <section className="bg-[#2E2018] rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">
              この豆のベスト条件
            </h3>
            <span className="text-xs text-[#6b5a4a]">
              {formatBrewDateShort(best.brewedAt)}
              {best.rating ? ` · ${'★'.repeat(best.rating)}` : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {best.doseG !== undefined && best.waterG !== undefined && (
              <div className="bg-[#3e3020] rounded-xl p-3 text-center">
                <p className="text-base font-bold text-[#F7EFE6] tabular-nums">
                  {best.doseG}g / {best.waterG}g
                </p>
                <p className="text-[10px] text-[#6b5a4a] mt-0.5">粉量 / 湯量（{calcRatio(best.doseG, best.waterG)}）</p>
              </div>
            )}
            {best.tempC !== undefined && (
              <div className="bg-[#3e3020] rounded-xl p-3 text-center">
                <p className="text-base font-bold text-[#F7EFE6] tabular-nums">{best.tempC}°C</p>
                <p className="text-[10px] text-[#6b5a4a] mt-0.5">湯温</p>
              </div>
            )}
            {best.grindSize !== undefined && (
              <div className="bg-[#3e3020] rounded-xl p-3 text-center">
                <p className="text-base font-bold text-[#F7EFE6] tabular-nums">{best.grindSize}</p>
                <p className="text-[10px] text-[#6b5a4a] mt-0.5">挽き目</p>
              </div>
            )}
            {best.totalTimeSec !== undefined && (
              <div className="bg-[#3e3020] rounded-xl p-3 text-center">
                <p className="text-base font-bold text-[#F7EFE6] tabular-nums">{formatSecToMmSs(best.totalTimeSec)}</p>
                <p className="text-[10px] text-[#6b5a4a] mt-0.5">抽出時間</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate('/brew', { state: { fromBrewId: best.id } })}
            className="w-full bg-[#993C1D] text-[#F7EFE6] py-3.5 rounded-xl font-semibold text-sm active:opacity-80 flex items-center justify-center gap-2"
          >
            <CupIcon size={18} />
            この条件で淹れる
          </button>
        </section>
      )}

      {/* 記録一覧 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#CE9C68] uppercase tracking-wider">
          この豆の記録
        </h3>
        {recent.length === 0 ? (
          <div className="bg-[#2E2018] rounded-xl p-5 text-center text-[#6b5a4a] text-sm">
            まだこの豆の記録がありません
          </div>
        ) : (
          recent.map(brew => (
            <button
              key={brew.id}
              type="button"
              onClick={() => navigate(`/library/${brew.id}`)}
              className="w-full bg-[#2E2018] rounded-xl px-4 py-3 flex items-center justify-between active:opacity-80"
            >
              <div className="text-left">
                <p className="text-sm text-[#F7EFE6]">{formatBrewDateShort(brew.brewedAt)}</p>
                <p className="text-xs text-[#6b5a4a] mt-0.5">
                  {brew.doseG && brew.waterG ? `${calcRatio(brew.doseG, brew.waterG)}` : ''}
                  {brew.tempC ? ` · ${brew.tempC}°C` : ''}
                  {brew.grindSize !== undefined ? ` · 挽き目${brew.grindSize}` : ''}
                </p>
              </div>
              {brew.rating ? (
                <span className="text-[#CE9C68] text-xs tracking-tight shrink-0">
                  {'★'.repeat(brew.rating)}
                </span>
              ) : null}
            </button>
          ))
        )}
      </section>
    </div>
  )
}
