import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import RecordDisk from '../components/brew/RecordDisk'
import StarRating from '../components/brew/StarRating'
import SaveAnimation from '../components/brew/SaveAnimation'
import { useToast } from '../components/Toast'
import { getAllBrews, getAllBeans, getAllCafeVisits, getAllEquipment, putBrew, putCafeVisit, getBrewCount } from '../db'
import type { Brew, Bean, CafeVisit, Equipment } from '../db'
import {
  formatBrewDateShort, ROAST_LEVEL_LABELS, CAFE_DRINK_TYPE_LABELS, CAFE_DRINK_SIZE_LABELS,
  EQUIPMENT_TYPE_LABELS, daysSinceRoast,
  getBackupReminder, snoozeBackupReminder, countUnbackedRecords,
  hasSeenBackupIntro, markBackupIntroSeen, loadLastExportAt, exportBackup,
  calcResidualCaffeine, calcStreakDays, isSameLocalDay,
  newId, nowISO, estimateCaffeine, estimateCafeCaffeine, calcRatio, loadSettings, getBedtimeDate,
} from '../db'
import {
  GearIcon, CupIcon, CafeIcon, TrophyIcon, CameraIcon, DownloadIcon,
} from '../components/icons'

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

// ─── あの日の一杯（1年前の同日±3日） ─────────────────────────────────────────

type OnThisDayItem = { item: RecentItem; label: string }

function findOnThisDay(
  brews: Brew[],
  beanMap: Map<string, Bean>,
  visits: CafeVisit[],
  now: Date,
): OnThisDayItem | null {
  // 当日を最優先に、近い順で±3日まで探す
  for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
    const target = new Date(now)
    target.setFullYear(target.getFullYear() - 1)
    target.setDate(target.getDate() + offset)

    const candidates: RecentItem[] = [
      ...brews
        .filter(b => isSameLocalDay(b.brewedAt, target))
        .map(b => ({
          kind: 'brew' as const,
          brew: b,
          bean: b.beanId ? beanMap.get(b.beanId) : undefined,
        })),
      ...visits
        .filter(v => isSameLocalDay(v.visitedAt, target))
        .map(v => ({ kind: 'cafe' as const, visit: v })),
    ]
    if (candidates.length === 0) continue

    // 同日に複数あればランキングと同じ3段ソート（星 → cuppingAverage → 日時）でベストを選ぶ
    candidates.sort((a, b) => {
      const ra = a.kind === 'brew' ? a.brew : a.visit
      const rb = b.kind === 'brew' ? b.brew : b.visit
      const da = a.kind === 'brew' ? a.brew.brewedAt : a.visit.visitedAt
      const db = b.kind === 'brew' ? b.brew.brewedAt : b.visit.visitedAt
      return (rb.rating ?? 0) - (ra.rating ?? 0)
        || (rb.cuppingAverage ?? 0) - (ra.cuppingAverage ?? 0)
        || db.localeCompare(da)
    })
    return {
      item: candidates[0],
      label: offset === 0 ? '1年前の今日' : '1年前のいまごろ',
    }
  }
  return null
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

// ─── 挨拶 ────────────────────────────────────────────────────────────────────

function greetingByHour(hour: number): string {
  if (hour >= 5 && hour < 11) return 'おはようございます。今日の一杯を記録しよう'
  if (hour >= 11 && hour < 17) return 'こんにちは。午後の一杯を記録しよう'
  return 'こんばんは。今日の一杯を振り返ろう'
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
  const [loading, setLoading] = useState(true)
  const [backupReminder, setBackupReminder] = useState<string | null>(null)
  const [showBackupIntro, setShowBackupIntro] = useState(false)
  const [quickExporting, setQuickExporting] = useState(false)
  const [todayStats, setTodayStats] = useState<{ cups: number; residualMg: number; streak: number } | null>(null)
  const [onThisDay, setOnThisDay] = useState<OnThisDayItem | null>(null)

  // 「前回と同じ一杯」クイック記録
  const showToast = useToast()
  const [lastBrew, setLastBrew] = useState<{ brew: Brew; bean?: Bean } | null>(null)
  const [showQuickSheet, setShowQuickSheet] = useState(false)
  const [quickRating, setQuickRating] = useState(0)
  const [quickSaving, setQuickSaving] = useState(false)
  const [showQuickAnim, setShowQuickAnim] = useState(false)
  const [savedBrewCount, setSavedBrewCount] = useState(0)
  const [recentIntakes, setRecentIntakes] = useState<{ caffeineAmount: number; brewedAt: string }[]>([])

  // 「また、あのカフェの一杯」クイック記録（カフェ版）
  const [lastVisit, setLastVisit] = useState<CafeVisit | null>(null)
  const [showCafeQuickSheet, setShowCafeQuickSheet] = useState(false)
  const [cafeQuickRating, setCafeQuickRating] = useState(0)
  const [cafeQuickSaving, setCafeQuickSaving] = useState(false)

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

  const loadHome = useCallback(() => {
    Promise.all([getAllBrews(), getAllBeans(), getAllCafeVisits(), getAllEquipment()]).then(
      ([brews, beansList, visits, eqs]) => {
        setBeans(beansList)
        setEquipment(eqs)

        const beanMap = new Map(beansList.map(b => [b.id, b]))

        // クイック記録用の前回ブリュー
        const last = brews.at(-1)
        setLastBrew(last
          ? { brew: last, bean: last.beanId ? beanMap.get(last.beanId) : undefined }
          : null)

        // カフェ版クイック記録用の前回来店（ブリュー版と同じ「最後の1件」）
        setLastVisit(visits.at(-1) ?? null)

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

        // あの日の一杯
        setOnThisDay(findOnThisDay(brews, beanMap, visits, new Date()))

        // バックアップリマインダー（記録10件以上・未エクスポート or 30日超過 or 未バックアップ20件以上）
        const totalCount = brews.length + visits.length
        const unbacked = countUnbackedRecords([...brews, ...visits])
        const reminder = getBackupReminder(totalCount, unbacked)
        setBackupReminder(reminder)

        // バックアップの仕組み周知カード（最初の記録〜9件の間に一度だけ。
        // リマインダーが出るときは重ねない。エクスポート済みの人は仕組みを知っている）
        setShowBackupIntro(
          !reminder && totalCount >= 1 && totalCount < 10 &&
          !loadLastExportAt() && !hasSeenBackupIntro()
        )

        // 今日のサマリ（杯数・カフェイン残留量・連続記録日数）
        const now = new Date()
        const cutoff = now.getTime() - 24 * 60 * 60 * 1000
        const intakes = [
          ...brews
            .filter(b => b.caffeineAmount != null && new Date(b.brewedAt).getTime() > cutoff)
            .map(b => ({ caffeineAmount: b.caffeineAmount!, brewedAt: b.brewedAt })),
          ...visits
            .filter(v => v.caffeineAmount != null && new Date(v.visitedAt).getTime() > cutoff)
            .map(v => ({ caffeineAmount: v.caffeineAmount!, brewedAt: v.visitedAt })),
        ]
        setRecentIntakes(intakes)
        setTodayStats({
          cups:
            brews.filter(b => isSameLocalDay(b.brewedAt, now)).length +
            visits.filter(v => isSameLocalDay(v.visitedAt, now)).length,
          residualMg: Math.round(calcResidualCaffeine(intakes, now)),
          streak: calcStreakDays([
            ...brews.map(b => b.brewedAt),
            ...visits.map(v => v.visitedAt),
          ]),
        })
        setLoading(false)
      },
    ).catch(() => { setDbError(true); setLoading(false) })
  }, [])

  useEffect(() => { loadHome() }, [loadHome])

  // クイック記録の保存: /brew の前回値プリフィル（fillFromBrew）と同じ範囲をコピーする
  const handleQuickSave = async () => {
    if (!lastBrew || quickSaving) return
    setQuickSaving(true)
    try {
      const b = lastBrew.brew
      const count = await getBrewCount()
      await putBrew({
        id: newId(),
        createdAt: nowISO(),
        brewedAt: nowISO(),
        beanId: b.beanId,
        recipeId: b.recipeId,
        doseG: b.doseG,
        waterG: b.waterG,
        grindSize: b.grindSize,
        tempC: b.tempC,
        equipmentId: b.equipmentId,
        totalTimeSec: b.totalTimeSec,
        pourCount: b.pourCount,
        rating: quickRating || undefined,
        flavors: b.flavors,
        drinkStyle: b.drinkStyle,
        cupping: {},
        caffeineAmount: b.doseG ? estimateCaffeine(b.doseG, lastBrew.bean?.decaf) : undefined,
      })
      setSavedBrewCount(count + 1)
      setQuickSaving(false)
      setShowQuickSheet(false)
      setShowQuickAnim(true)
    } catch {
      setQuickSaving(false)
      showToast('保存に失敗しました。ストレージの空き容量を確認してください', { type: 'error' })
    }
  }

  const handleQuickAnimDone = useCallback(() => {
    setShowQuickAnim(false)
    loadHome()
  }, [loadHome])

  // カフェ版クイック保存: 「過去の記録から始める」（fillFromVisit）と同じ範囲をコピーする
  // （評価・カッピング・メモ・シーン・写真はこの一杯固有のためコピーしない）
  const handleCafeQuickSave = async () => {
    if (!lastVisit || cafeQuickSaving) return
    setCafeQuickSaving(true)
    try {
      const v = lastVisit
      await putCafeVisit({
        id: newId(),
        createdAt: nowISO(),
        visitedAt: nowISO(),
        cafeName: v.cafeName,
        drinkName: v.drinkName,
        drinkType: v.drinkType,
        size: v.size,
        beanOrigin: v.beanOrigin,
        rating: cafeQuickRating || undefined,
        flavors: v.flavors,
        decaf: v.decaf,
        drinkStyle: v.drinkStyle,
        cupping: {},
        caffeineAmount: estimateCafeCaffeine(v.drinkType, v.size, v.decaf),
        price: v.price,
      })
      setCafeQuickSaving(false)
      setShowCafeQuickSheet(false)
      showToast('カフェの一杯を記録しました', { type: 'success' })
      loadHome()
    } catch {
      setCafeQuickSaving(false)
      showToast('保存に失敗しました。ストレージの空き容量を確認してください', { type: 'error' })
    }
  }

  // 「いま飲むと就寝時に約◯mg」の事前提示（推定・目安）
  const quickPrediction = useMemo(() => {
    if (!showQuickSheet || !lastBrew?.brew.doseG) return null
    const s = loadSettings()
    const now = new Date()
    const bt = getBedtimeDate(s.bedtimeHour, s.bedtimeMinute, now)
    const mg = calcResidualCaffeine(
      [...recentIntakes, { caffeineAmount: estimateCaffeine(lastBrew.brew.doseG, lastBrew.bean?.decaf), brewedAt: now.toISOString() }],
      bt,
    )
    return { mg, hour: s.bedtimeHour, minute: s.bedtimeMinute }
  }, [showQuickSheet, lastBrew, recentIntakes])

  // カフェ版の就寝時予測（ドリンク種別×サイズの推定カフェインで計算）
  const cafeQuickPrediction = useMemo(() => {
    if (!showCafeQuickSheet || !lastVisit) return null
    const mg0 = estimateCafeCaffeine(lastVisit.drinkType, lastVisit.size, lastVisit.decaf)
    if (mg0 == null) return null
    const s = loadSettings()
    const now = new Date()
    const bt = getBedtimeDate(s.bedtimeHour, s.bedtimeMinute, now)
    const mg = calcResidualCaffeine(
      [...recentIntakes, { caffeineAmount: mg0, brewedAt: now.toISOString() }],
      bt,
    )
    return { mg, hour: s.bedtimeHour, minute: s.bedtimeMinute }
  }, [showCafeQuickSheet, lastVisit, recentIntakes])

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
          <p className="text-[#CE9C68] text-sm mt-0.5">{greetingByHour(new Date().getHours())}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label="設定"
          className="absolute top-2 right-0 w-10 h-10 flex items-center justify-center text-[#6b5a4a] active:opacity-60 rounded-full"
        >
          <GearIcon size={22} />
        </button>
      </div>

      {/* アクションボタン */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/brew')}
          className="bg-[#993C1D] text-[#F7EFE6] rounded-xl py-3.5 flex items-center justify-center gap-2 active:opacity-80"
        >
          <CupIcon size={20} />
          <span className="text-sm font-semibold">淹れる</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/cafe')}
          className="bg-[#4a3828] text-[#F7EFE6] rounded-xl py-3.5 flex items-center justify-center gap-2 active:opacity-80"
        >
          <CafeIcon size={20} />
          <span className="text-sm font-semibold">カフェを記録</span>
        </button>
      </div>

      {/* 前回と同じ一杯（クイック記録） */}
      {lastBrew && (
        <button
          type="button"
          onClick={() => { setQuickRating(0); setShowQuickSheet(true) }}
          className="-mt-3 w-full bg-[#2E2018] rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 active:opacity-80"
        >
          <span className="text-sm text-[#CE9C68] font-medium shrink-0">前回と同じ一杯</span>
          <span className="text-xs text-[#6b5a4a] truncate">
            {lastBrew.bean?.name ?? 'ホームブリュー'}
            {lastBrew.brew.doseG != null && lastBrew.brew.waterG != null
              ? ` · ${lastBrew.brew.doseG}g / ${lastBrew.brew.waterG}g`
              : ''}
          </span>
        </button>
      )}

      {/* また、あのカフェの一杯（カフェ版クイック記録） */}
      {lastVisit && (
        <button
          type="button"
          onClick={() => { setCafeQuickRating(0); setShowCafeQuickSheet(true) }}
          className={`${lastBrew ? '-mt-4' : '-mt-3'} w-full bg-[#2E2018] rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 active:opacity-80`}
        >
          <span className="text-sm text-[#CE9C68] font-medium shrink-0">また、あのカフェの一杯</span>
          <span className="text-xs text-[#6b5a4a] truncate">
            {lastVisit.cafeName}
            {lastVisit.drinkName
              ? ` · ${lastVisit.drinkName}`
              : lastVisit.drinkType
                ? ` · ${CAFE_DRINK_TYPE_LABELS[lastVisit.drinkType]}`
                : ''}
          </span>
        </button>
      )}

      {/* 今日のサマリ */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="skeleton h-[72px]" />
          <div className="skeleton h-[72px]" />
          <div className="skeleton h-[72px]" />
        </div>
      ) : todayStats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#2E2018] rounded-xl px-2 py-3 text-center">
            <p className="text-xl font-bold text-[#F7EFE6] tabular-nums">{todayStats.cups}<span className="text-xs font-normal text-[#CE9C68] ml-0.5">杯</span></p>
            <p className="text-[10px] text-[#6b5a4a] mt-1">今日の一杯</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/caffeine')}
            className="bg-[#2E2018] rounded-xl px-2 py-3 text-center active:opacity-80"
          >
            <p className="text-xl font-bold text-[#F7EFE6] tabular-nums">{todayStats.residualMg}<span className="text-xs font-normal text-[#CE9C68] ml-0.5">mg</span></p>
            <p className="text-[10px] text-[#6b5a4a] mt-1">カフェイン残(推定)</p>
          </button>
          <div className="bg-[#2E2018] rounded-xl px-2 py-3 text-center">
            <p className="text-xl font-bold text-[#F7EFE6] tabular-nums">{todayStats.streak}<span className="text-xs font-normal text-[#CE9C68] ml-0.5">日</span></p>
            <p className="text-[10px] text-[#6b5a4a] mt-1">連続記録</p>
          </div>
        </div>
      )}

      {/* バックアップリマインダー */}
      {backupReminder && (
        <div className="bg-[#2E2018] border border-[#CE9C68]/30 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm text-[#CE9C68] leading-relaxed flex items-start gap-2">
            <DownloadIcon size={16} className="shrink-0 mt-0.5" />
            <span>{backupReminder}</span>
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={quickExporting}
              onClick={async () => {
                // その場で即エクスポート（設定へ遷移しない。バックアップを1タップで完了させる）
                setQuickExporting(true)
                try {
                  await exportBackup()
                  setBackupReminder(null)
                  showToast('バックアップを書き出しました', { type: 'success' })
                } catch {
                  showToast('エクスポートに失敗しました', { type: 'error' })
                } finally {
                  setQuickExporting(false)
                }
              }}
              className="flex-1 py-2 rounded-xl bg-[#993C1D] text-[#F7EFE6] text-sm font-semibold active:opacity-80 disabled:opacity-40"
            >
              {quickExporting ? '書き出し中...' : 'エクスポートする'}
            </button>
            <button
              type="button"
              onClick={() => { snoozeBackupReminder(); setBackupReminder(null) }}
              className="flex-1 py-2 rounded-xl bg-[#3e3020] text-[#6b5a4a] text-sm active:opacity-80"
            >
              あとで（7日間非表示）
            </button>
          </div>
        </div>
      )}

      {/* バックアップの仕組み周知（最初の記録後に一度だけ。「わかった」で二度と出ない） */}
      {showBackupIntro && (
        <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-2">
          <p className="text-sm text-[#CE9C68] leading-relaxed flex items-start gap-2">
            <DownloadIcon size={16} className="shrink-0 mt-0.5" />
            <span>記録はこの端末のブラウザ内だけに保存されます</span>
          </p>
          <p className="text-xs text-[#6b5a4a] leading-relaxed">
            ブラウザのデータ消去や端末の変更で記録が失われることがあります。
            設定の「データ管理」から、いつでもJSONファイルにバックアップできます。
          </p>
          <button
            type="button"
            onClick={() => { markBackupIntroSeen(); setShowBackupIntro(false) }}
            className="self-end px-4 py-1.5 rounded-xl bg-[#3e3020] text-[#CE9C68] text-sm active:opacity-80"
          >
            わかった
          </button>
        </div>
      )}

      {/* あの日の一杯（1年前の同日±3日に記録があるときだけ表示） */}
      {onThisDay && (() => {
        const it = onThisDay.item
        const record = it.kind === 'brew'
          ? {
              id: it.brew.id,
              to: `/library/${it.brew.id}`,
              name: it.bean?.name ?? 'ホームブリュー',
              sub: it.bean ? ROAST_LEVEL_LABELS[it.bean.roastLevel] : null,
              date: it.brew.brewedAt,
              rating: it.brew.rating,
              photo: it.brew.photoDataUrl,
              Icon: CupIcon,
            }
          : {
              id: it.visit.id,
              to: `/cafe/${it.visit.id}`,
              name: it.visit.cafeName,
              sub: it.visit.drinkName
                ?? (it.visit.drinkType ? CAFE_DRINK_TYPE_LABELS[it.visit.drinkType] : null),
              date: it.visit.visitedAt,
              rating: it.visit.rating,
              photo: it.visit.photoDataUrl,
              Icon: CafeIcon,
            }
        return (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[#CE9C68] uppercase tracking-wider">{onThisDay.label}</p>
            <button
              type="button"
              onClick={() => navigate(record.to)}
              className="w-full bg-[#2E2018] rounded-xl p-3 text-left active:opacity-80 flex items-center gap-3"
            >
              {record.photo ? (
                <img src={record.photo} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-[#3e3020] flex items-center justify-center text-[#CE9C68] shrink-0">
                  <record.Icon size={22} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[#F7EFE6] text-sm font-medium truncate">{record.name}</p>
                <p className="text-xs text-[#6b5a4a] mt-0.5 flex items-center gap-1">
                  <record.Icon size={12} className="shrink-0" />
                  {record.sub ? `${record.sub} · ` : ''}
                  {formatBrewDateShort(record.date)}
                </p>
              </div>
              <StarDisplay rating={record.rating} />
            </button>
          </div>
        )
      })()}

      {/* 今月のランキング */}
      {hasRanking && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#CE9C68] uppercase tracking-wider">今月のランキング</p>
          <div className="grid grid-cols-2 gap-3">
            {bestDrink && (
              <div className="bg-[#2E2018] rounded-xl p-3 flex flex-col">
                <p className="text-[10px] text-[#CE9C68] mb-1.5 flex items-center gap-1">
                  <TrophyIcon size={12} /> ベストドリンク
                </p>
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
                <p className="text-[10px] text-[#CE9C68] mb-1.5 flex items-center gap-1">
                  <CafeIcon size={12} /> よく行くカフェ
                </p>
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
                    <p className="text-xs text-[#6b5a4a] mt-0.5 flex items-center gap-1">
                      <CupIcon size={12} className="shrink-0" />
                      {item.bean ? `${ROAST_LEVEL_LABELS[item.bean.roastLevel]} · ` : ''}
                      {formatBrewDateShort(item.brew.brewedAt)}
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
                    <p className="text-xs text-[#6b5a4a] mt-0.5 flex items-center gap-1">
                      <CafeIcon size={12} className="shrink-0" />
                      {item.visit.drinkName
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

      {/* ─── クイック記録シート ─── */}
      {showQuickSheet && lastBrew && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end justify-center z-50"
          onClick={() => setShowQuickSheet(false)}
        >
          <div
            className="bg-[#2E2018] rounded-t-2xl w-full max-w-lg p-5 pb-8 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-[#F7EFE6] font-semibold">前回と同じ一杯</h3>

            {/* 前回条件のサマリ（読み取り専用） */}
            <div className="bg-[#3e3020] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm text-[#F7EFE6] font-medium truncate">
                  {lastBrew.bean?.name ?? 'ホームブリュー'}
                </p>
                {lastBrew.bean && (
                  <span className="text-[10px] text-[#CE9C68] shrink-0">
                    {ROAST_LEVEL_LABELS[lastBrew.bean.roastLevel]}
                    {lastBrew.bean.finishedAt ? ' · 飲み切り済み' : ''}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#CE9C68]">
                {lastBrew.brew.doseG != null && lastBrew.brew.waterG != null && (
                  <span>
                    {lastBrew.brew.doseG}g / {lastBrew.brew.waterG}g
                    （{calcRatio(lastBrew.brew.doseG, lastBrew.brew.waterG)}）
                  </span>
                )}
                {lastBrew.brew.grindSize != null && <span>挽き目 {lastBrew.brew.grindSize}</span>}
                {lastBrew.brew.tempC != null && <span>{lastBrew.brew.tempC}°C</span>}
              </div>
            </div>

            {quickPrediction && quickPrediction.mg >= 5 && (
              <p className="text-[11px] text-[#6b5a4a] text-center">
                いま飲むと、就寝時（{quickPrediction.hour.toString().padStart(2, '0')}:{quickPrediction.minute.toString().padStart(2, '0')}）の推定残留量は約{Math.round(quickPrediction.mg)}mg（個人差があります）
              </p>
            )}

            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-[#CE9C68]">今日の一杯はどうでしたか？</p>
              <StarRating value={quickRating} onChange={setQuickRating} />
            </div>

            <button
              type="button"
              onClick={handleQuickSave}
              disabled={quickRating === 0 || quickSaving}
              className="w-full bg-[#993C1D] text-[#F7EFE6] py-3.5 rounded-2xl text-base font-semibold active:opacity-80 disabled:opacity-40"
            >
              {quickSaving ? '保存中...' : 'この一杯を記録する'}
            </button>
            <button
              type="button"
              onClick={() => { setShowQuickSheet(false); navigate('/brew') }}
              className="text-sm text-[#CE9C68] text-center active:opacity-70"
            >
              詳しく記録する →
            </button>
          </div>
        </div>
      )}

      {/* ─── カフェ版クイック記録シート ─── */}
      {showCafeQuickSheet && lastVisit && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end justify-center z-50"
          onClick={() => setShowCafeQuickSheet(false)}
        >
          <div
            className="bg-[#2E2018] rounded-t-2xl w-full max-w-lg p-5 pb-8 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-[#F7EFE6] font-semibold">また、あのカフェの一杯</h3>

            {/* 前回の一杯のサマリ（読み取り専用） */}
            <div className="bg-[#3e3020] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm text-[#F7EFE6] font-medium truncate">{lastVisit.cafeName}</p>
                {lastVisit.decaf && (
                  <span className="text-[10px] text-[#CE9C68] shrink-0">デカフェ</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#CE9C68]">
                {(lastVisit.drinkName || lastVisit.drinkType) && (
                  <span>
                    {lastVisit.drinkName ?? CAFE_DRINK_TYPE_LABELS[lastVisit.drinkType!]}
                    {lastVisit.size ? `（${CAFE_DRINK_SIZE_LABELS[lastVisit.size]}）` : ''}
                  </span>
                )}
                {lastVisit.price != null && <span>¥{lastVisit.price.toLocaleString()}</span>}
              </div>
            </div>

            {cafeQuickPrediction && cafeQuickPrediction.mg >= 5 && (
              <p className="text-[11px] text-[#6b5a4a] text-center">
                いま飲むと、就寝時（{cafeQuickPrediction.hour.toString().padStart(2, '0')}:{cafeQuickPrediction.minute.toString().padStart(2, '0')}）の推定残留量は約{Math.round(cafeQuickPrediction.mg)}mg（個人差があります）
              </p>
            )}

            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-[#CE9C68]">今日の一杯はどうでしたか？</p>
              <StarRating value={cafeQuickRating} onChange={setCafeQuickRating} />
            </div>

            <button
              type="button"
              onClick={handleCafeQuickSave}
              disabled={cafeQuickRating === 0 || cafeQuickSaving}
              className="w-full bg-[#993C1D] text-[#F7EFE6] py-3.5 rounded-2xl text-base font-semibold active:opacity-80 disabled:opacity-40"
            >
              {cafeQuickSaving ? '保存中...' : 'この一杯を記録する'}
            </button>
            <button
              type="button"
              onClick={() => { setShowCafeQuickSheet(false); navigate('/cafe') }}
              className="text-sm text-[#CE9C68] text-center active:opacity-70"
            >
              詳しく記録する →
            </button>
          </div>
        </div>
      )}

      {/* クイック記録の保存アニメーション（節目演出も共通） */}
      {showQuickAnim && <SaveAnimation brewCount={savedBrewCount} onDone={handleQuickAnimDone} />}

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
                      <CameraIcon size={32} />
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
