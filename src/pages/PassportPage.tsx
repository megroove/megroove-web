import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllBrews, getAllBeans, getAllCafeVisits } from '../db'

interface OriginEntry {
  name: string
  count: number
  fromBrew: number
  fromCafe: number
}

function stampLevel(count: number): 'new' | 'regular' | 'familiar' {
  if (count >= 10) return 'familiar'
  if (count >= 3)  return 'regular'
  return 'new'
}

const LEVEL_STYLES = {
  new:      { border: 'border-[#3e3020]',    label: '',       badge: 'bg-[#3e3020] text-[#6b5a4a]' },
  regular:  { border: 'border-[#CE9C68]/60', label: '★',      badge: 'bg-[#CE9C68]/20 text-[#CE9C68]' },
  familiar: { border: 'border-[#993C1D]',    label: '♥',      badge: 'bg-[#993C1D] text-[#F7EFE6]' },
}

function Stamp({ origin }: { origin: OriginEntry }) {
  const level = stampLevel(origin.count)
  const style = LEVEL_STYLES[level]

  return (
    <div className={`bg-[#2E2018] border-2 ${style.border} rounded-2xl p-3 flex flex-col items-center gap-1.5 relative`}>
      {style.label && (
        <span className="absolute top-1.5 right-2.5 text-[10px] text-[#CE9C68]">{style.label}</span>
      )}
      {/* スタンプ風の丸 */}
      <div className={`w-12 h-12 rounded-full border-2 ${style.border} flex items-center justify-center`}>
        <span className="text-xl">☕</span>
      </div>
      <p className="text-[#F7EFE6] text-xs font-semibold text-center leading-tight line-clamp-2">
        {origin.name}
      </p>
      <span className={`text-[10px] px-2 py-0.5 rounded-full ${style.badge}`}>
        {origin.count}杯
      </span>
    </div>
  )
}

export default function PassportPage() {
  const navigate = useNavigate()
  const [origins, setOrigins] = useState<OriginEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(false)

  useEffect(() => {
    Promise.all([getAllBrews(), getAllBeans(), getAllCafeVisits()])
      .then(([brews, beans, visits]) => {
        const counts = new Map<string, { brew: number; cafe: number }>()

        const beanMap = new Map(beans.map(b => [b.id, b]))
        for (const brew of brews) {
          const origin = brew.beanId ? beanMap.get(brew.beanId)?.origin : undefined
          if (!origin) continue
          const cur = counts.get(origin) ?? { brew: 0, cafe: 0 }
          counts.set(origin, { ...cur, brew: cur.brew + 1 })
        }
        for (const visit of visits) {
          if (!visit.beanOrigin) continue
          const cur = counts.get(visit.beanOrigin) ?? { brew: 0, cafe: 0 }
          counts.set(visit.beanOrigin, { ...cur, cafe: cur.cafe + 1 })
        }

        const entries: OriginEntry[] = [...counts.entries()].map(([name, c]) => ({
          name,
          count: c.brew + c.cafe,
          fromBrew: c.brew,
          fromCafe: c.cafe,
        })).sort((a, b) => b.count - a.count)

        setOrigins(entries)
      })
      .catch(() => setDbError(true))
      .finally(() => setLoading(false))
  }, [])

  const totalCups = useMemo(() => origins.reduce((s, o) => s + o.count, 0), [origins])

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2018]">
        <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm">
          ← 戻る
        </button>
        <h2 className="text-lg font-semibold text-[#F7EFE6] flex-1">産地パスポート</h2>
      </div>

      <div className="px-4 py-5 flex flex-col gap-5">
        {/* 統計 */}
        {origins.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#2E2018] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[#F7EFE6]">{origins.length}</p>
              <p className="text-xs text-[#CE9C68] mt-0.5">発見した産地</p>
            </div>
            <div className="bg-[#2E2018] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[#F7EFE6]">{totalCups}</p>
              <p className="text-xs text-[#CE9C68] mt-0.5">産地記録あり</p>
            </div>
          </div>
        )}

        {/* 凡例 */}
        {origins.length > 0 && (
          <div className="flex gap-3 text-[10px] text-[#6b5a4a]">
            <span className="flex items-center gap-1"><span className="text-[#6b5a4a]">◯</span>1〜2杯</span>
            <span className="flex items-center gap-1"><span className="text-[#CE9C68]">★</span>3〜9杯</span>
            <span className="flex items-center gap-1"><span className="text-[#993C1D]">♥</span>10杯〜</span>
          </div>
        )}

        {dbError && (
          <div className="bg-[#3e1a0a] border border-[#993C1D]/40 rounded-xl px-4 py-3 text-sm text-[#CE9C68]">
            データの読み込みに失敗しました。
          </div>
        )}

        {loading ? (
          <p className="text-[#6b5a4a] text-sm text-center py-12">読み込み中...</p>
        ) : origins.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#3e3020] flex items-center justify-center">
              <span className="text-3xl">🌍</span>
            </div>
            <div>
              <p className="text-[#CE9C68] font-semibold">まだ産地の記録がありません</p>
              <p className="text-[#6b5a4a] text-sm mt-1 leading-relaxed">
                豆の産地やカフェ記録の豆の産地を<br />登録すると、ここにスタンプが押されます。
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {origins.map(o => <Stamp key={o.name} origin={o} />)}
          </div>
        )}
      </div>
    </div>
  )
}
