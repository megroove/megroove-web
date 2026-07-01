import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import RecordDisk from '../components/brew/RecordDisk'
import { getAllBrews, getAllBeans, getAllCafeVisits, getAllEquipment } from '../db'
import type { Brew, Bean, CafeVisit, Equipment } from '../db'
import {
  formatBrewDateShort, ROAST_LEVEL_LABELS, CAFE_DRINK_TYPE_LABELS,
  EQUIPMENT_TYPE_LABELS, daysSinceRoast,
} from '../db'

// ─── 型定義 ──────────────────────────────────────────────────────────────────

type RecentItem =
  | { kind: 'brew'; brew: Brew; bean?: Bean }
  | { kind: 'cafe'; visit: CafeVisit }

type FeaturedItem =
  | { type: 'equipment'; id: string }
  | { type: 'photo'; dataUrl: string; caption: string }

// ─── ランキング計算 ───────────────────────────────────────────────────────────

function calcBestDrink(
  brews: Brew[],
  beanMap: Map<string, Bean>,
  visits: CafeVisit[],
): { name: string; rating: number; count: number } | null {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const entries: { name: string; rating: number }[] = []

  for (const b of brews) {
    if (!b.rating || new Date(b.brewedAt) < monthStart) continue
    const name = b.beanId ? (beanMap.get(b.beanId)?.name ?? 'ホームブリュー') : 'ホームブリュー'
    entries.push({ name, rating: b.rating })
  }

  for (const v of visits) {
    if (!v.rating || new Date(v.visitedAt) < monthStart) continue
    const name = v.drinkName
      ?? (v.drinkType ? CAFE_DRINK_TYPE_LABELS[v.drinkType] : v.cafeName)
    entries.push({ name, rating: v.rating })
  }

  if (entries.length === 0) return null

  const maxRating = Math.max(...entries.map(e => e.rating))
  const counts = new Map<string, number>()
  for (const e of entries.filter(e => e.rating === maxRating)) {
    counts.set(e.name, (counts.get(e.name) ?? 0) + 1)
  }

  let bestName = ''
  let bestCount = 0
  for (const [name, count] of counts) {
    if (count > bestCount) { bestName = name; bestCount = count }
  }

  return bestName ? { name: bestName, rating: maxRating, count: bestCount } : null
}

function calcTopCafe(
  visits: CafeVisit[],
): { name: string; count: number } | null {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const counts = new Map<string, number>()
  for (const v of visits) {
    if (new Date(v.visitedAt) < monthStart) continue
    counts.set(v.cafeName, (counts.get(v.cafeName) ?? 0) + 1)
  }

  let topName = ''
  let topCount = 0
  for (const [name, count] of counts) {
    if (count > topCount) { topName = name; topCount = count }
  }

  return topName ? { name: topName, count: topCount } : null
}

// ─── 画像リサイズ ─────────────────────────────────────────────────────────────

async function resizeImage(file: File, maxPx = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('読み込み失敗')) }
    img.src = url
  })
}

// ─── localStorage ────────────────────────────────────────────────────────────

const FEATURED_BEAN_KEY = 'megroove-featured-bean-id'
const FEATURED_ITEM_KEY = 'megroove-featured-item'

function loadFeaturedBeanId(): string | null {
  return localStorage.getItem(FEATURED_BEAN_KEY)
}
function saveFeaturedBeanIdToLS(id: string | null) {
  if (id) localStorage.setItem(FEATURED_BEAN_KEY, id)
  else localStorage.removeItem(FEATURED_BEAN_KEY)
}
function loadFeaturedItem(): FeaturedItem | null {
  try {
    const raw = localStorage.getItem(FEATURED_ITEM_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function saveFeaturedItemToLS(item: FeaturedItem | null) {
  if (item) localStorage.setItem(FEATURED_ITEM_KEY, JSON.stringify(item))
  else localStorage.removeItem(FEATURED_ITEM_KEY)
}

// ─── サブコンポーネント ───────────────────────────────────────────────────────

function StarDisplay({ rating }: { rating?: number }) {
  if (!rating) return null
  return (
    <span className="text-[#CE9C68] text-xs tracking-tight">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

// ─── ページ本体 ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()

  const [recent, setRecent] = useState<RecentItem[]>([])
  const [beans, setBeans] = useState<Bean[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [bestDrink, setBestDrink] = useState<{ name: string; rating: number; count: number } | null>(null)
  const [topCafe, setTopCafe] = useState<{ name: string; count: number } | null>(null)
  const [dbError, setDbError] = useState(false)

  // Featured 選択（localStorage から復元）
  const [featuredBeanId, setFeaturedBeanId] = useState<string | null>(loadFeaturedBeanId)
  const [featuredItem, setFeaturedItem] = useState<FeaturedItem | null>(loadFeaturedItem)

  // モーダル状態
  const [showBeanPicker, setShowBeanPicker] = useState(false)
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [itemPickerTab, setItemPickerTab] = useState<'equipment' | 'photo'>('equipment')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const updateFeaturedBeanId = (id: string | null) => {
    saveFeaturedBeanIdToLS(id)
    setFeaturedBeanId(id)
  }

  const updateFeaturedItem = (item: FeaturedItem | null) => {
    saveFeaturedItemToLS(item)
    setFeaturedItem(item)
  }

  useEffect(() => {
    Promise.all([getAllBrews(), getAllBeans(), getAllCafeVisits(), getAllEquipment()]).then(
      ([brews, beansList, visits, eqs]) => {
        setBeans(beansList)
        setEquipment(eqs)

        const beanMap = new Map(beansList.map(b => [b.id, b]))

        // 最近の記録（ブリュー＋カフェ混合、新しい順5件）
        const brewItems: RecentItem[] = [...brews].reverse().slice(0, 5).map(b => ({
          kind: 'brew' as const,
          brew: b,
          bean: b.beanId ? beanMap.get(b.beanId) : undefined,
        }))
        const cafeItems: RecentItem[] = [...visits].reverse().slice(0, 5).map(v => ({
          kind: 'cafe' as const,
          visit: v,
        }))
        const merged = [...brewItems, ...cafeItems].sort((a, b) => {
          const ta = a.kind === 'brew' ? a.brew.brewedAt : a.visit.visitedAt
          const tb = b.kind === 'brew' ? b.brew.brewedAt : b.visit.visitedAt
          return tb.localeCompare(ta)
        })
        setRecent(merged.slice(0, 5))

        // ランキング計算
        setBestDrink(calcBestDrink(brews, beanMap, visits))
        setTopCafe(calcTopCafe(visits))
      },
    ).catch(() => setDbError(true))
  }, [])

  const featuredBean = beans.find(b => b.id === featuredBeanId)
  const featuredEquipment =
    featuredItem?.type === 'equipment' ? equipment.find(e => e.id === featuredItem.id) : null

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const dataUrl = await resizeImage(file)
      setPhotoPreview(dataUrl)
    } catch { /* ignore */ }
  }

  const handleSavePhoto = () => {
    if (!photoPreview) return
    updateFeaturedItem({ type: 'photo', dataUrl: photoPreview, caption: photoCaption.trim() })
    setShowItemPicker(false)
    setPhotoPreview(null)
    setPhotoCaption('')
  }

  const openItemPicker = () => {
    setItemPickerTab('equipment')
    setPhotoPreview(null)
    setPhotoCaption(featuredItem?.type === 'photo' ? featuredItem.caption : '')
    setShowItemPicker(true)
  }

  const hasRanking = bestDrink !== null || topCafe !== null

  return (
    <div className="flex flex-col flex-1 px-4 py-6 gap-6 overflow-y-auto">

      {dbError && (
        <div className="bg-[#3e1a0a] border border-[#993C1D]/40 rounded-xl px-4 py-3 text-sm text-[#CE9C68]">
          データの読み込みに失敗しました。ブラウザを再読み込みしてください。
        </div>
      )}

      {/* ロゴ＋設定アイコン */}
      <div className="relative flex flex-col items-center gap-3 pt-2">
        <RecordDisk size={96} />
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#F7EFE6]">Megroove</h1>
          <p className="text-[#CE9C68] text-sm mt-0.5">今日の一杯を記録しよう</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label="設定"
          className="absolute top-2 right-0 w-10 h-10 flex items-center justify-center text-[#6b5a4a] text-2xl active:opacity-60 rounded-full"
        >
          ⚙
        </button>
      </div>

      {/* アクションボタン */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/brew')}
          className="bg-[#993C1D] text-[#F7EFE6] rounded-xl py-3.5 flex items-center justify-center gap-2 active:opacity-80"
        >
          <span className="text-xl leading-none">☕</span>
          <span className="text-sm font-semibold">淹れる</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/cafe')}
          className="bg-[#4a3828] text-[#F7EFE6] rounded-xl py-3.5 flex items-center justify-center gap-2 active:opacity-80"
        >
          <span className="text-xl leading-none">🏪</span>
          <span className="text-sm font-semibold">カフェを記録</span>
        </button>
      </div>

      {/* 今月のランキング */}
      {hasRanking && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#CE9C68] uppercase tracking-wider">今月のランキング</p>
          <div className="grid grid-cols-2 gap-3">
            {bestDrink && (
              <div className="bg-[#2E2018] rounded-xl p-3 flex flex-col">
                <p className="text-[10px] text-[#CE9C68] mb-1.5">🏆 ベストドリンク</p>
                <p className="text-sm text-[#F7EFE6] font-semibold leading-snug line-clamp-2 flex-1">
                  {bestDrink.name}
                </p>
                <div className="mt-2">
                  <p className="text-xs text-[#CE9C68] tracking-tight">{'★'.repeat(bestDrink.rating)}</p>
                  {bestDrink.count > 1 && (
                    <p className="text-[10px] text-[#6b5a4a] mt-0.5">{bestDrink.count}回記録</p>
                  )}
                </div>
              </div>
            )}
            {topCafe && (
              <div className="bg-[#2E2018] rounded-xl p-3 flex flex-col">
                <p className="text-[10px] text-[#CE9C68] mb-1.5">🏪 よく行くカフェ</p>
                <p className="text-sm text-[#F7EFE6] font-semibold leading-snug line-clamp-2 flex-1">
                  {topCafe.name}
                </p>
                <p className="text-[10px] text-[#6b5a4a] mt-2">今月{topCafe.count}回</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 推しの豆 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#CE9C68] uppercase tracking-wider">推しの豆</p>
          {featuredBean && (
            <button type="button" onClick={() => setShowBeanPicker(true)}
              className="text-xs text-[#6b5a4a] active:opacity-60"
            >
              変更
            </button>
          )}
        </div>
        {featuredBean ? (
          <div className="bg-[#2E2018] rounded-xl p-4">
            <p className="text-[#F7EFE6] font-semibold">{featuredBean.name}</p>
            <p className="text-xs text-[#CE9C68] mt-1">
              {ROAST_LEVEL_LABELS[featuredBean.roastLevel]}
              {featuredBean.origin ? ` · ${featuredBean.origin}` : ''}
              {featuredBean.farm ? ` / ${featuredBean.farm}` : ''}
            </p>
            {featuredBean.roastedAt && (
              <p className="text-xs text-[#6b5a4a] mt-0.5">
                焙煎から {daysSinceRoast(featuredBean.roastedAt)} 日
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowBeanPicker(true)}
            className="w-full border border-dashed border-[#3e3020] rounded-xl p-5 flex flex-col items-center gap-1.5 text-[#4a3a2a] active:opacity-70"
          >
            <span className="text-2xl leading-none">＋</span>
            <span className="text-sm">推しの豆を飾る</span>
          </button>
        )}
      </div>

      {/* お気に入り */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#CE9C68] uppercase tracking-wider">お気に入り</p>
          {featuredItem && (
            <button type="button" onClick={openItemPicker}
              className="text-xs text-[#6b5a4a] active:opacity-60"
            >
              変更
            </button>
          )}
        </div>
        {featuredItem?.type === 'photo' ? (
          <div className="rounded-xl overflow-hidden relative">
            <img
              src={featuredItem.dataUrl}
              alt="お気に入り"
              className="w-full object-cover"
              style={{ maxHeight: '200px' }}
            />
            {featuredItem.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-2">
                <p className="text-xs text-[#F7EFE6]">{featuredItem.caption}</p>
              </div>
            )}
          </div>
        ) : featuredItem?.type === 'equipment' && featuredEquipment ? (
          <div className="bg-[#2E2018] rounded-xl p-4">
            <p className="text-[#F7EFE6] font-semibold">{featuredEquipment.name}</p>
            <p className="text-xs text-[#CE9C68] mt-1">
              {EQUIPMENT_TYPE_LABELS[featuredEquipment.type]}
              {featuredEquipment.maker ? ` · ${featuredEquipment.maker}` : ''}
            </p>
            {featuredEquipment.sizeNote && (
              <p className="text-xs text-[#6b5a4a] mt-0.5">{featuredEquipment.sizeNote}</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={openItemPicker}
            className="w-full border border-dashed border-[#3e3020] rounded-xl p-5 flex flex-col items-center gap-1.5 text-[#4a3a2a] active:opacity-70"
          >
            <span className="text-2xl leading-none">＋</span>
            <span className="text-sm">お気に入りの器具・写真を飾る</span>
          </button>
        )}
      </div>

      {/* 最近の記録 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[#CE9C68] uppercase tracking-wider">最近の記録</p>
        {recent.length === 0 ? (
          <div className="bg-[#2E2018] rounded-xl p-4 text-center text-[#6b5a4a] text-sm">
            まだ記録がありません
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map(item =>
              item.kind === 'brew' ? (
                <button
                  key={item.brew.id}
                  type="button"
                  onClick={() => navigate(`/library/${item.brew.id}`)}
                  className="w-full bg-[#2E2018] rounded-xl px-4 py-3 text-left active:opacity-80 flex items-center justify-between"
                >
                  <div>
                    <p className="text-[#F7EFE6] text-sm font-medium">
                      {item.bean?.name ?? <span className="text-[#6b5a4a]">豆の記録なし</span>}
                    </p>
                    <p className="text-xs text-[#6b5a4a] mt-0.5">
                      ☕ {item.bean ? ROAST_LEVEL_LABELS[item.bean.roastLevel] : ''}
                      {' · '}{formatBrewDateShort(item.brew.brewedAt)}
                    </p>
                  </div>
                  <StarDisplay rating={item.brew.rating} />
                </button>
              ) : (
                <button
                  key={item.visit.id}
                  type="button"
                  onClick={() => navigate(`/cafe/${item.visit.id}`)}
                  className="w-full bg-[#2E2018] rounded-xl px-4 py-3 text-left active:opacity-80 flex items-center justify-between"
                >
                  <div>
                    <p className="text-[#F7EFE6] text-sm font-medium">{item.visit.cafeName}</p>
                    <p className="text-xs text-[#6b5a4a] mt-0.5">
                      🏪 {item.visit.drinkName
                        ? `${item.visit.drinkName}${item.visit.drinkType ? ` · ${CAFE_DRINK_TYPE_LABELS[item.visit.drinkType]}` : ''}`
                        : 'カフェ訪問'
                      }
                      {' · '}{formatBrewDateShort(item.visit.visitedAt)}
                    </p>
                  </div>
                  <StarDisplay rating={item.visit.rating} />
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {/* ─── 豆ピッカーモーダル ─── */}
      {showBeanPicker && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 px-0">
          <div className="bg-[#2E2018] rounded-t-2xl w-full max-w-lg max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-[#3e3020] shrink-0">
              <p className="text-[#F7EFE6] font-semibold">推しの豆を選ぶ</p>
              <button type="button" onClick={() => setShowBeanPicker(false)}
                className="text-[#6b5a4a] text-xl w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex flex-col gap-2">
              {beans.length === 0 ? (
                <p className="text-[#4a3a2a] text-sm text-center py-6">
                  豆が登録されていません。ストックから追加してください。
                </p>
              ) : (
                beans.map(bean => (
                  <button
                    key={bean.id}
                    type="button"
                    onClick={() => { updateFeaturedBeanId(bean.id); setShowBeanPicker(false) }}
                    className={`w-full text-left p-4 rounded-xl active:opacity-80 ${
                      bean.id === featuredBeanId ? 'bg-[#993C1D]' : 'bg-[#3e3020]'
                    }`}
                  >
                    <p className="text-[#F7EFE6] font-medium">{bean.name}</p>
                    <p className="text-xs text-[#CE9C68] mt-0.5">
                      {ROAST_LEVEL_LABELS[bean.roastLevel]}
                      {bean.origin ? ` · ${bean.origin}` : ''}
                    </p>
                  </button>
                ))
              )}
              {featuredBeanId && (
                <button
                  type="button"
                  onClick={() => { updateFeaturedBeanId(null); setShowBeanPicker(false) }}
                  className="text-xs text-[#6b5a4a] py-3 text-center"
                >
                  選択を解除する
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── お気に入りピッカーモーダル ─── */}
      {showItemPicker && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 px-0">
          <div className="bg-[#2E2018] rounded-t-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-[#3e3020] shrink-0">
              <p className="text-[#F7EFE6] font-semibold">お気に入りを選ぶ</p>
              <button type="button"
                onClick={() => { setShowItemPicker(false); setPhotoPreview(null) }}
                className="text-[#6b5a4a] text-xl w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* タブ */}
            <div className="flex border-b border-[#3e3020] shrink-0">
              {(['equipment', 'photo'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setItemPickerTab(tab); setPhotoPreview(null) }}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                    itemPickerTab === tab
                      ? 'text-[#CE9C68] border-[#993C1D]'
                      : 'text-[#6b5a4a] border-transparent'
                  }`}
                >
                  {tab === 'equipment' ? '器具' : '写真'}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-4 flex flex-col gap-3">
              {itemPickerTab === 'equipment' ? (
                equipment.length === 0 ? (
                  <p className="text-[#4a3a2a] text-sm text-center py-6">
                    器具が登録されていません。ストックから追加してください。
                  </p>
                ) : (
                  <>
                    {equipment.map(eq => (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => {
                          updateFeaturedItem({ type: 'equipment', id: eq.id })
                          setShowItemPicker(false)
                        }}
                        className={`w-full text-left p-4 rounded-xl active:opacity-80 ${
                          featuredItem?.type === 'equipment' && featuredItem.id === eq.id
                            ? 'bg-[#993C1D]'
                            : 'bg-[#3e3020]'
                        }`}
                      >
                        <p className="text-[#F7EFE6] font-medium">{eq.name}</p>
                        <p className="text-xs text-[#CE9C68] mt-0.5">
                          {EQUIPMENT_TYPE_LABELS[eq.type]}
                          {eq.maker ? ` · ${eq.maker}` : ''}
                        </p>
                      </button>
                    ))}
                    {featuredItem && (
                      <button
                        type="button"
                        onClick={() => { updateFeaturedItem(null); setShowItemPicker(false) }}
                        className="text-xs text-[#6b5a4a] py-2 text-center"
                      >
                        選択を解除する
                      </button>
                    )}
                  </>
                )
              ) : (
                /* 写真タブ */
                photoPreview ? (
                  <div className="flex flex-col gap-4">
                    <img src={photoPreview} alt="プレビュー"
                      className="w-full rounded-xl object-cover"
                      style={{ maxHeight: '200px' }}
                    />
                    <input
                      type="text"
                      value={photoCaption}
                      onChange={e => setPhotoCaption(e.target.value)}
                      placeholder="キャプション（任意）"
                      className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 text-sm outline-none placeholder-[#4a3a2a]"
                    />
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setPhotoPreview(null)}
                        className="flex-1 py-3 rounded-xl bg-[#3e3020] text-[#CE9C68] text-sm"
                      >
                        やり直す
                      </button>
                      <button type="button" onClick={handleSavePhoto}
                        className="flex-1 py-3 rounded-xl bg-[#993C1D] text-[#F7EFE6] text-sm font-semibold"
                      >
                        この写真を飾る
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full border border-dashed border-[#3e3020] rounded-xl p-8 flex flex-col items-center gap-2 text-[#4a3a2a] active:opacity-70"
                    >
                      <span className="text-3xl leading-none">📷</span>
                      <span className="text-sm">写真を選ぶ</span>
                      <span className="text-xs">器具・カップ・淹れている風景など</span>
                    </button>
                    {featuredItem && (
                      <button
                        type="button"
                        onClick={() => { updateFeaturedItem(null); setShowItemPicker(false) }}
                        className="text-xs text-[#6b5a4a] py-2 text-center"
                      >
                        選択を解除する
                      </button>
                    )}
                  </div>
                )
              )}

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoFile}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
