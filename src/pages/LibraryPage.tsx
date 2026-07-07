import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Brew, Bean, CafeVisit } from '../db'
import {
  getAllBrews, getAllBeans, getAllCafeVisits,
  calcRatio, ROAST_LEVEL_LABELS, CAFE_DRINK_TYPE_LABELS,
  formatBrewDateShort,
} from '../db'
import { DATA_RESTORED_EVENT } from '../components/Toast'

// ─── 表示モード ────────────────────────────────────────────────────────────────

type DisplayMode = 'list' | 'card' | 'record'
const DISPLAY_MODE_KEY = 'megroove-library-view'

function loadDisplayMode(): DisplayMode {
  const v = localStorage.getItem(DISPLAY_MODE_KEY)
  if (v === 'card' || v === 'record') return v
  return 'list'
}

// ─── 共通コンポーネント ────────────────────────────────────────────────────────

function StarDisplay({ rating }: { rating?: number }) {
  if (!rating) return null
  return (
    <span className="text-[#CE9C68] text-sm tracking-tight">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

// カードグリッド（写真トップ・縦長長方形）
function PhotoGridCard({
  photoUrl, name, sub, date, rating, onClick,
}: {
  photoUrl?: string; name: string; sub?: string; date: string; rating?: number; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col bg-[#2E2018] rounded-xl overflow-hidden w-full text-left active:opacity-80"
    >
      {/* 写真エリア（3:4 縦長） */}
      <div className="w-full aspect-[3/4] bg-[#1a0a05] relative overflow-hidden">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[#2e1a0a] text-5xl">☕</span>
          </div>
        )}
      </div>
      {/* テキストエリア */}
      <div className="p-2.5">
        <p className="text-[10px] text-[#6b5a4a] truncate">{date}</p>
        <p className="text-sm text-[#F7EFE6] font-medium truncate leading-tight mt-0.5">{name}</p>
        {sub && <p className="text-[10px] text-[#CE9C68] truncate mt-0.5">{sub}</p>}
        {rating ? (
          <p className="text-[10px] text-[#CE9C68] tracking-tight mt-1">{'★'.repeat(rating)}</p>
        ) : null}
      </div>
    </button>
  )
}

// レコードグリッド（アナログレコード型）
function VinylCard({
  photoUrl, name, sub, rating, onClick,
}: {
  photoUrl?: string; name: string; sub?: string; rating?: number; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 w-full active:opacity-80"
    >
      {/* レコード盤 */}
      <div className="relative w-full aspect-square">
        <div className="w-full h-full rounded-full overflow-hidden relative">
          {/* 写真 or プレースホルダーを盤面全体に敷く */}
          {photoUrl ? (
            <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[#0d0603]" />
          )}

          {/* 溝（写真の上に薄く重ねる） */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden
          >
            {[47, 43, 39, 35, 31, 27, 23, 19, 15, 11].map(r => (
              <circle
                key={r}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={photoUrl ? 'rgba(0,0,0,0.28)' : '#1e1208'}
                strokeWidth={photoUrl ? '0.9' : '0.7'}
              />
            ))}
            {/* 写真なし時の中央ラベル色 */}
            {!photoUrl && (
              <circle cx="50" cy="50" r="19" fill="#993C1D" />
            )}
            {/* 写真なし時のアイコン代替（円） */}
            {!photoUrl && (
              <circle cx="50" cy="50" r="4" fill="#F7EFE6" opacity="0.6" />
            )}
          </svg>

          {/* スピンドル穴 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-2 h-2 rounded-full ${photoUrl ? 'bg-black/50' : 'bg-[#0d0603]'}`} />
          </div>
        </div>
      </div>
      {/* テキスト */}
      <div className="w-full text-center px-1">
        <p className="text-xs text-[#F7EFE6] font-medium truncate leading-snug">{name}</p>
        {sub && <p className="text-[10px] text-[#6b5a4a] truncate mt-0.5">{sub}</p>}
        {rating ? (
          <p className="text-[10px] text-[#CE9C68] tracking-tight">{'★'.repeat(rating)}</p>
        ) : null}
      </div>
    </button>
  )
}

// ─── ブリューカード（リスト） ──────────────────────────────────────────────────

function BrewCard({ brew, bean, onClick }: { brew: Brew; bean?: Bean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-[#2E2018] rounded-xl p-4 text-left active:opacity-80"
    >
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs text-[#6b5a4a]">{formatBrewDateShort(brew.brewedAt)}</span>
        <StarDisplay rating={brew.rating} />
      </div>
      <p className="text-[#F7EFE6] font-medium mb-1">
        {bean?.name ?? <span className="text-[#6b5a4a]">豆の記録なし</span>}
      </p>
      <p className="text-xs text-[#CE9C68] mb-2">
        {bean ? ROAST_LEVEL_LABELS[bean.roastLevel] : ''}
        {brew.doseG && brew.waterG ? ` · ${calcRatio(brew.doseG, brew.waterG)}` : ''}
        {brew.tempC ? ` · ${brew.tempC}°C` : ''}
        {brew.grindSize !== undefined ? ` · 挽き目${brew.grindSize}` : ''}
      </p>
      {brew.flavors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {brew.flavors.slice(0, 3).map(f => (
            <span key={f} className="text-xs bg-[#3e3020] text-[#CE9C68] px-2 py-0.5 rounded-full">{f}</span>
          ))}
          {brew.flavors.length > 3 && (
            <span className="text-xs text-[#6b5a4a] py-0.5">+{brew.flavors.length - 3}</span>
          )}
        </div>
      )}
    </button>
  )
}

// ─── カフェカード（リスト） ────────────────────────────────────────────────────

function CafeCard({ visit, onClick }: { visit: CafeVisit; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-[#2E2018] rounded-xl p-4 text-left active:opacity-80"
    >
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs text-[#6b5a4a]">{formatBrewDateShort(visit.visitedAt)}</span>
        <StarDisplay rating={visit.rating} />
      </div>
      <p className="text-[#F7EFE6] font-medium mb-1">{visit.cafeName}</p>
      {(visit.drinkName || visit.drinkType) && (
        <p className="text-xs text-[#CE9C68] mb-2">
          {visit.drinkName ?? ''}
          {visit.drinkType ? ` · ${CAFE_DRINK_TYPE_LABELS[visit.drinkType]}` : ''}
          {visit.beanOrigin ? ` · ${visit.beanOrigin}` : ''}
        </p>
      )}
      {visit.flavors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visit.flavors.slice(0, 3).map(f => (
            <span key={f} className="text-xs bg-[#3e3020] text-[#CE9C68] px-2 py-0.5 rounded-full">{f}</span>
          ))}
          {visit.flavors.length > 3 && (
            <span className="text-xs text-[#6b5a4a] py-0.5">+{visit.flavors.length - 3}</span>
          )}
        </div>
      )}
    </button>
  )
}

// ─── フィルタータイプ ──────────────────────────────────────────────────────────

type RatingFilter = 'all' | '3+' | '4+' | '5'
const RATING_FILTER_LABELS: Record<RatingFilter, string> = {
  all: 'すべて', '3+': '★3以上', '4+': '★4以上', '5': '★5のみ',
}

// ─── ブリュータブ ──────────────────────────────────────────────────────────────

function BrewTab({ displayMode }: { displayMode: DisplayMode }) {
  const navigate = useNavigate()
  const [brews, setBrews] = useState<Brew[]>([])
  const [beanMap, setBeanMap] = useState<Map<string, Bean>>(new Map())
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all')
  const [beanFilter, setBeanFilter] = useState('all')
  const [dbError, setDbError] = useState(false)

  const load = useCallback(() => {
    Promise.all([getAllBrews(), getAllBeans()]).then(([bs, beans]) => {
      setBrews([...bs].reverse())
      setBeanMap(new Map(beans.map(b => [b.id, b])))
    }).catch(() => setDbError(true))
  }, [])

  useEffect(() => {
    load()
    // 削除アンドゥで復元されたら一覧を再読込
    window.addEventListener(DATA_RESTORED_EVENT, load)
    return () => window.removeEventListener(DATA_RESTORED_EVENT, load)
  }, [load])

  const usedBeans = useMemo(() => {
    const ids = new Set(brews.map(b => b.beanId).filter(Boolean) as string[])
    return [...ids].map(id => beanMap.get(id)).filter(Boolean) as Bean[]
  }, [brews, beanMap])

  const filtered = useMemo(() => brews.filter(b => {
    if (ratingFilter === '3+' && (b.rating ?? 0) < 3) return false
    if (ratingFilter === '4+' && (b.rating ?? 0) < 4) return false
    if (ratingFilter === '5'  && b.rating !== 5)       return false
    if (beanFilter !== 'all' && b.beanId !== beanFilter) return false
    return true
  }), [brews, ratingFilter, beanFilter])

  return (
    <>
      {dbError && (
        <div className="mx-4 mt-3 bg-[#3e1a0a] border border-[#993C1D]/40 rounded-xl px-4 py-3 text-sm text-[#CE9C68]">
          データの読み込みに失敗しました。ブラウザを再読み込みしてください。
        </div>
      )}
      {/* 評価フィルタ */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
        {(Object.keys(RATING_FILTER_LABELS) as RatingFilter[]).map(key => (
          <button key={key} type="button" onClick={() => setRatingFilter(key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors ${
              ratingFilter === key ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#2E2018] text-[#CE9C68]'
            }`}
          >
            {RATING_FILTER_LABELS[key]}
          </button>
        ))}
      </div>

      {/* 豆フィルタ */}
      {usedBeans.length >= 2 && (
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          <button type="button" onClick={() => setBeanFilter('all')}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${
              beanFilter === 'all' ? 'bg-[#3e3020] text-[#F7EFE6]' : 'bg-transparent text-[#6b5a4a]'
            }`}
          >
            すべての豆
          </button>
          {usedBeans.map(bean => (
            <button key={bean.id} type="button"
              onClick={() => setBeanFilter(bean.id === beanFilter ? 'all' : bean.id)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${
                beanFilter === bean.id ? 'bg-[#3e3020] text-[#F7EFE6]' : 'bg-transparent text-[#6b5a4a]'
              }`}
            >
              {bean.name}
            </button>
          ))}
        </div>
      )}

      {/* 一覧 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {brews.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-[#CE9C68] text-sm">まだ記録がありません</p>
            <button type="button" onClick={() => navigate('/brew')}
              className="text-[#993C1D] font-semibold text-sm">
              最初の一杯を記録する →
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#6b5a4a] text-sm">条件に一致する記録がありません</div>
        ) : displayMode === 'list' ? (
          <div className="flex flex-col gap-3">
            {filtered.map(brew => (
              <BrewCard key={brew.id} brew={brew}
                bean={brew.beanId ? beanMap.get(brew.beanId) : undefined}
                onClick={() => navigate(`/library/${brew.id}`)}
              />
            ))}
          </div>
        ) : displayMode === 'card' ? (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(brew => {
              const bean = brew.beanId ? beanMap.get(brew.beanId) : undefined
              const sub = bean ? ROAST_LEVEL_LABELS[bean.roastLevel] : undefined
              return (
                <PhotoGridCard
                  key={brew.id}
                  photoUrl={brew.photoDataUrl}
                  name={bean?.name ?? '豆なし'}
                  sub={sub}
                  date={formatBrewDateShort(brew.brewedAt)}
                  rating={brew.rating}
                  onClick={() => navigate(`/library/${brew.id}`)}
                />
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map(brew => {
              const bean = brew.beanId ? beanMap.get(brew.beanId) : undefined
              const sub = formatBrewDateShort(brew.brewedAt)
              return (
                <VinylCard
                  key={brew.id}
                  photoUrl={brew.photoDataUrl}
                  name={bean?.name ?? '豆なし'}
                  sub={sub}
                  rating={brew.rating}
                  onClick={() => navigate(`/library/${brew.id}`)}
                />
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ─── カフェタブ ────────────────────────────────────────────────────────────────

function CafeTab({ displayMode }: { displayMode: DisplayMode }) {
  const navigate = useNavigate()
  const [visits, setVisits] = useState<CafeVisit[]>([])
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all')

  const load = useCallback(() => {
    getAllCafeVisits().then(vs => setVisits([...vs].reverse())).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    window.addEventListener(DATA_RESTORED_EVENT, load)
    return () => window.removeEventListener(DATA_RESTORED_EVENT, load)
  }, [load])

  const filtered = useMemo(() => visits.filter(v => {
    if (ratingFilter === '3+' && (v.rating ?? 0) < 3) return false
    if (ratingFilter === '4+' && (v.rating ?? 0) < 4) return false
    if (ratingFilter === '5'  && v.rating !== 5)       return false
    return true
  }), [visits, ratingFilter])

  return (
    <>
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
        {(Object.keys(RATING_FILTER_LABELS) as RatingFilter[]).map(key => (
          <button key={key} type="button" onClick={() => setRatingFilter(key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors ${
              ratingFilter === key ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#2E2018] text-[#CE9C68]'
            }`}
          >
            {RATING_FILTER_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-[#CE9C68] text-sm">まだカフェの記録がありません</p>
            <button type="button" onClick={() => navigate('/cafe')}
              className="text-[#993C1D] font-semibold text-sm">
              カフェ訪問を記録する →
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#6b5a4a] text-sm">条件に一致する記録がありません</div>
        ) : displayMode === 'list' ? (
          <div className="flex flex-col gap-3">
            {filtered.map(visit => (
              <CafeCard key={visit.id} visit={visit}
                onClick={() => navigate(`/cafe/${visit.id}`)}
              />
            ))}
          </div>
        ) : displayMode === 'card' ? (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(visit => {
              const sub = visit.drinkName
                ?? (visit.drinkType ? CAFE_DRINK_TYPE_LABELS[visit.drinkType] : undefined)
              return (
                <PhotoGridCard
                  key={visit.id}
                  photoUrl={visit.photoDataUrl}
                  name={visit.cafeName}
                  sub={sub}
                  date={formatBrewDateShort(visit.visitedAt)}
                  rating={visit.rating}
                  onClick={() => navigate(`/cafe/${visit.id}`)}
                />
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map(visit => {
              const sub = visit.drinkName
                ?? (visit.drinkType ? CAFE_DRINK_TYPE_LABELS[visit.drinkType] : undefined)
              return (
                <VinylCard
                  key={visit.id}
                  photoUrl={visit.photoDataUrl}
                  name={visit.cafeName}
                  sub={sub}
                  rating={visit.rating}
                  onClick={() => navigate(`/cafe/${visit.id}`)}
                />
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ─── LibraryPage ──────────────────────────────────────────────────────────────

type LibTab = 'brew' | 'cafe'

export default function LibraryPage() {
  const location = useLocation()
  const initTab: LibTab = (location.state as { tab?: LibTab } | null)?.tab ?? 'brew'
  const [tab, setTab] = useState<LibTab>(initTab)
  const [displayMode, setDisplayMode] = useState<DisplayMode>(loadDisplayMode)

  const changeMode = (m: DisplayMode) => {
    setDisplayMode(m)
    localStorage.setItem(DISPLAY_MODE_KEY, m)
  }

  return (
    <div className="flex flex-col flex-1">
      {/* ヘッダー */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#F7EFE6]">ライブラリ</h2>
        {/* 表示モード切り替え */}
        <div className="flex gap-0.5 bg-[#2e2018] rounded-xl p-1">
          {(['list', 'card', 'record'] as DisplayMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => changeMode(m)}
              className={`w-9 h-7 flex items-center justify-center rounded-lg text-base transition-colors ${
                displayMode === m ? 'bg-[#993C1D] text-[#F7EFE6]' : 'text-[#6b5a4a]'
              }`}
              aria-label={m === 'list' ? 'リスト表示' : m === 'card' ? 'カード表示' : 'レコード表示'}
            >
              {m === 'list' ? '≡' : m === 'card' ? '⊞' : '◉'}
            </button>
          ))}
        </div>
      </div>

      {/* タブバー */}
      <div className="flex border-b border-[#2e2018] mb-1">
        {(['brew', 'cafe'] as LibTab[]).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`w-1/2 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === t
                ? 'text-[#CE9C68] border-[#993C1D]'
                : 'text-[#6b5a4a] border-transparent'
            }`}
          >
            {t === 'brew' ? '☕ ブリュー' : '🏪 カフェ'}
          </button>
        ))}
      </div>

      {tab === 'brew'
        ? <BrewTab displayMode={displayMode} />
        : <CafeTab displayMode={displayMode} />
      }
    </div>
  )
}
