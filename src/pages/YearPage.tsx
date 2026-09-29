import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Bean, Brew, CafeVisit } from '../db'
import { getAllBeans, getAllBrews, getAllCafeVisits } from '../db'
import { CARD_SIZE, drawYearCard } from '../components/year/drawYearCard'
import { calcYearStats, listRecordedYears } from '../components/year/yearStats'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'

export default function YearPage() {
  const navigate = useNavigate()
  const showToast = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [brews, setBrews] = useState<Brew[]>([])
  const [visits, setVisits] = useState<CafeVisit[]>([])
  const [beanMap, setBeanMap] = useState<Map<string, Bean>>(new Map())
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<number | null>(null)
  const [pngUrl, setPngUrl] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getAllBrews(), getAllCafeVisits(), getAllBeans()])
      .then(([bs, vs, beans]) => {
        setBrews(bs)
        setVisits(vs)
        setBeanMap(new Map(beans.map(b => [b.id, b])))
        const years = listRecordedYears(bs, vs)
        setYear(years[0] ?? new Date().getFullYear())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const years = useMemo(() => listRecordedYears(brews, visits), [brews, visits])
  const stats = useMemo(
    () => (year == null ? null : calcYearStats(brews, visits, beanMap, year)),
    [brews, visits, beanMap, year],
  )

  // 画像は毎回描き直す。長押しで保存できるよう <img> として出す
  useEffect(() => {
    if (!stats || !canvasRef.current) return
    drawYearCard(canvasRef.current, stats)
    setPngUrl(canvasRef.current.toDataURL('image/png'))
  }, [stats])

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !stats) return

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) {
      showToast('画像を作れませんでした', { type: 'error' })
      return
    }
    const file = new File([blob], `megroove-${stats.year}.png`, { type: 'image/png' })

    // 共有シートが使えるなら、そこから「写真に保存」できる（送信先は利用者が決める）
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch {
        return // 利用者がキャンセルした場合も含め、ここでは何も出さない
      }
    }

    // 使えない環境はダウンロードにフォールバック
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [stats, showToast])

  return (
    <div className="flex flex-col flex-1 px-4 py-5 gap-4 overflow-y-auto">
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm self-start">
          ← 戻る
        </button>
        <h2 className="text-xl font-semibold text-[#F7EFE6]">Year in Coffee</h2>
      </div>

      {/* 年の切り替え（記録のある年だけ） */}
      {years.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {years.map(y => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              aria-pressed={y === year}
              className={`shrink-0 min-h-11 px-4 rounded-full text-sm transition-colors ${
                y === year ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#2E2018] text-[#CE9C68]'
              }`}
            >
              {y}年
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="skeleton w-full aspect-square rounded-xl" />
      ) : !stats || stats.cups === 0 ? (
        <EmptyState
          title="まだこの年の記録がありません"
          description="一杯記録すると、その年のまとめが作れます"
          action={{ label: '淹れる', onClick: () => navigate('/brew') }}
        />
      ) : (
        <>
          {/* 描画用（画面には出さない）。表示は長押しで保存できる <img> で行う */}
          <canvas ref={canvasRef} width={CARD_SIZE} height={CARD_SIZE} className="hidden" />
          {pngUrl && (
            <img
              src={pngUrl}
              alt={`${stats.year}年のまとめ`}
              className="w-full rounded-xl border border-[#3e3020]"
            />
          )}

          <button
            type="button"
            onClick={handleSave}
            className="w-full bg-[#993C1D] text-[#F7EFE6] py-4 rounded-2xl text-base font-semibold active:opacity-80"
          >
            保存・共有する
          </button>
          <p className="text-xs text-[#A8916F] text-center leading-relaxed">
            画像を長押ししても保存できます。<br />
            この画像は端末の中だけで作られ、どこにも送信されません。
          </p>
        </>
      )}
    </div>
  )
}
