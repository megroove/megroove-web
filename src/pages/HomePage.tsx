import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import RecordDisk from '../components/brew/RecordDisk'
import StarRating from '../components/brew/StarRating'
import CuppingSliders from '../components/brew/CuppingSliders'
import FlavorChips from '../components/brew/FlavorChips'
import SaveAnimation from '../components/brew/SaveAnimation'
import QuickBrewSheet from '../components/brew/QuickBrewSheet'
import type { QuickPreset, QuickSaveInput } from '../components/brew/QuickBrewSheet'
import { useToast } from '../components/Toast'
import { getAllBrews, getAllBeans, getAllCafeVisits, getAllEquipment, getAllCaffeineIntakes, getAllRecipes, putBrew, putCafeVisit, deleteBrew, getBrewCount, getSleepLog, putSleepLog } from '../db'
import type { Brew, Bean, CafeVisit, Equipment, Recipe, CuppingScores, RoastLevel } from '../db'
import {
  formatBrewDateShort, ROAST_LEVEL_LABELS, CAFE_DRINK_TYPE_LABELS, CAFE_DRINK_SIZE_LABELS,
  EQUIPMENT_TYPE_LABELS, daysSinceRoast, getBrewEquipmentIds,
  getBackupReminder, snoozeBackupReminder, countUnbackedRecords,
  hasSeenBackupIntro, markBackupIntroSeen, loadLastExportAt, exportBackup,
  calcResidualCaffeine, calcStreakDays, isSameLocalDay, calcCuppingAverage, calcFrequentFlavors,
  newId, nowISO, estimateCaffeine, estimateCafeCaffeine, calcRatio, loadSettings, localDateKey,
  calcFrequentRecipes, predictBedtimeResidual, DRIP_BAG_DOSE_G,
  withSaveTimeout, saveErrorMessage,
} from '../db'
import {
  GearIcon, CupIcon, CafeIcon, TrophyIcon, CameraIcon, DownloadIcon, MoonIcon,
} from '../components/icons'

// ─── 型定義 ──────────────────────────────────────────────────────────────────

type RecentItem =
  | { kind: 'brew'; brew: Brew; bean?: Bean }
  | { kind: 'cafe'; visit: CafeVisit }

type FeaturedItem =
  | { type: 'equipment'; id: string }
  | { type: 'photo'; dataUrl: string; caption: string }

// ─── クイック記録のプリセット ─────────────────────────────────────────────────

// 「前回と同じ」＋よく使うレシピ上位2の最大3枚。レシピは既定値だけでは豆・器具が分からないため、
// 「そのレシピを直近で使った記録」を実体にして条件をまるごと引き継ぐ
function buildQuickPresets(
  brews: Brew[],
  recipes: Recipe[],
  beanMap: Map<string, Bean>,
): QuickPreset[] {
  const last = brews.at(-1)
  if (!last) return []
  const presets: QuickPreset[] = [
    { id: 'last', name: '前回と同じ', brew: last, bean: last.beanId ? beanMap.get(last.beanId) : undefined },
  ]
  for (const { recipeId } of calcFrequentRecipes(brews)) {
    if (recipeId === last.recipeId) continue // 「前回と同じ」と同じ条件は並べない
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) continue
    const base = [...brews].reverse().find(b => b.recipeId === recipeId)
    if (!base) continue
    presets.push({
      id: recipe.id,
      name: recipe.name,
      brew: base,
      bean: base.beanId ? beanMap.get(base.beanId) : undefined,
    })
  }
  return presets.slice(0, 3)
}

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
const SLEEP_PROMPT_KEY = 'megroove-sleep-prompt-date' // 朝ポップアップを当日出したか
const SLEEP_SNOOZE_KEY = 'megroove-sleep-snooze-date' // ポップアップで「あとで」を選んだ日（その日はカードを残す）
const SLEEP_CHOICES = [{ v: 3, l: 'よく眠れた' }, { v: 2, l: 'ふつう' }, { v: 1, l: 'あまり' }]

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
  const [hasRecords, setHasRecords] = useState(true) // 初期は true（新規CTAの一瞬のちらつき防止）。読込後に確定
  const [backupReminder, setBackupReminder] = useState<string | null>(null)
  const [showBackupIntro, setShowBackupIntro] = useState(false)
  const [quickExporting, setQuickExporting] = useState(false)
  const [todayStats, setTodayStats] = useState<{ cups: number; residualMg: number; streak: number } | null>(null)
  const [onThisDay, setOnThisDay] = useState<OnThisDayItem | null>(null)

  // 「前回と同じ一杯」クイック記録
  const showToast = useToast()
  const [lastBrew, setLastBrew] = useState<{ brew: Brew; bean?: Bean } | null>(null)
  const [showQuickSheet, setShowQuickSheet] = useState(false)
  const [quickPresets, setQuickPresets] = useState<QuickPreset[]>([])
  const [quickSaving, setQuickSaving] = useState(false)
  const [showQuickAnim, setShowQuickAnim] = useState(false)
  const [quickSavedRated, setQuickSavedRated] = useState(true) // 演出の出し分け（星ありはフル）
  // 直前に保存した1件（トーストの「取り消す」対象）。取り消し済みの id は二重実行しない
  const [lastQuickSaved, setLastQuickSaved] = useState<
    { id: string; label: string; roastLevel?: RoastLevel } | null
  >(null)
  const undoneRef = useRef<Set<string>>(new Set())
  const [savedBrewCount, setSavedBrewCount] = useState(0)
  const [recentIntakes, setRecentIntakes] = useState<{ caffeineAmount: number; brewedAt: string }[]>([])

  // 「針を落とす一杯」= 評価待ち（未評価のブリュー）に後から星をつける
  const [pendingBrews, setPendingBrews] = useState<{ brew: Brew; bean?: Bean }[]>([])
  const [showRateSheet, setShowRateSheet] = useState(false)
  const [rateValue, setRateValue] = useState(0)
  const [rateSaving, setRateSaving] = useState(false)
  const [showRateAnim, setShowRateAnim] = useState(false)
  // 星だけでさっと付けたい人のため、フレーバー・カッピングは折りたたみ（既定は閉じ）
  const [showRateDetail, setShowRateDetail] = useState(false)
  const [rateFlavors, setRateFlavors] = useState<string[]>([])
  const [rateCupping, setRateCupping] = useState<CuppingScores>({})
  const [frequentFlavors, setFrequentFlavors] = useState<string[]>([])

  // 睡眠の朝プロンプト。ポップアップ（午前・1日1回）＋「あとで」後のホームカード（その日は残す）
  const [showSleepModal, setShowSleepModal] = useState(false)
  const [showSleepCard, setShowSleepCard] = useState(false)

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
    Promise.all([getAllBrews(), getAllBeans(), getAllCafeVisits(), getAllEquipment(), getAllCaffeineIntakes(), getAllRecipes()]).then(
      ([brews, beansList, visits, eqs, otherIntakes, recipesList]) => {
        setBeans(beansList)
        setEquipment(eqs)

        const beanMap = new Map(beansList.map(b => [b.id, b]))

        // クイック記録用の前回ブリュー
        const last = brews.at(-1)
        setLastBrew(last
          ? { brew: last, bean: last.beanId ? beanMap.get(last.beanId) : undefined }
          : null)

        // クイック記録のプリセット（前回と同じ ＋ よく使うレシピ上位2）
        setQuickPresets(buildQuickPresets(brews, recipesList, beanMap))

        // カフェ版クイック記録用の前回来店（ブリュー版と同じ「最後の1件」）
        setLastVisit(visits.at(-1) ?? null)

        // 評価待ち（未評価）のブリュー。新しい順。針を落とすと集計へ自動反映（未評価は元々除外済み）
        setPendingBrews(
          [...brews].reverse()
            .filter(b => !b.rating)
            .map(b => ({ brew: b, bean: b.beanId ? beanMap.get(b.beanId) : undefined })),
        )
        // 後付け評価のフレーバー候補（記録画面と同じ頻度順の「よく使う」行）
        setFrequentFlavors(calcFrequentFlavors([...brews, ...visits]))

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
          // コーヒー以外のカフェイン飲料も残留量・就寝時予測に合算（杯数・連続記録には含めない）
          ...otherIntakes
            .filter(o => new Date(o.consumedAt).getTime() > cutoff)
            .map(o => ({ caffeineAmount: o.caffeineAmount, brewedAt: o.consumedAt })),
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
        setHasRecords(brews.length > 0 || visits.length > 0)
        setLoading(false)
      },
    ).catch(() => { setDbError(true); setLoading(false) })
  }, [])

  useEffect(() => { loadHome() }, [loadHome])

  // 睡眠の朝プロンプト。機能ON・今朝未記録が前提。
  //  - 「あとで」を選んだ日は、その日ホームに静かなカードを残す（時間帯問わず・リロードでも表示）。
  //  - それ以外は、午前中(5〜11時台) × 当日ポップアップ未表示 のとき1回だけポップアップを出す。
  useEffect(() => {
    const s = loadSettings()
    if (!s.sleepTrackingEnabled) return
    const nowD = new Date()
    const today = localDateKey(nowD)
    getSleepLog(today).then(existing => {
      if (existing) return // 今朝は記録済み → 何も出さない
      if (localStorage.getItem(SLEEP_SNOOZE_KEY) === today) {
        setShowSleepCard(true) // 「あとで」済み → その日はカードで受ける
        return
      }
      const hour = nowD.getHours()
      if (hour < 5 || hour >= 12) return          // ポップアップは午前中のみ
      if (localStorage.getItem(SLEEP_PROMPT_KEY) === today) return // 1日1回（2回目起動では出さない）
      setShowSleepModal(true)
      localStorage.setItem(SLEEP_PROMPT_KEY, today)
    }).catch(() => {})
  }, [])

  const handleSleepRate = async (rating: number) => {
    try {
      await withSaveTimeout(putSleepLog({ date: localDateKey(new Date()), rating, createdAt: nowISO() }))
      setShowSleepModal(false)
      setShowSleepCard(false)
      showToast('睡眠を記録しました', { type: 'success' })
    } catch (e) {
      console.error('[megroove] 睡眠の記録に失敗しました:', e)
      showToast(saveErrorMessage(e), { type: 'error' })
    }
  }

  // ポップアップで「あとで」: ポップアップは閉じ、その日はホームにカードを残す
  const handleSleepLater = () => {
    localStorage.setItem(SLEEP_SNOOZE_KEY, localDateKey(new Date()))
    setShowSleepModal(false)
    setShowSleepCard(true)
  }

  // クイック記録の保存: プリセット（= 過去の記録）の条件をコピーし、
  // 「今日だけ変えたところ」だけ差し替える。評価は任意（未入力なら評価待ちに入る）
  const handleQuickSave = async (input: QuickSaveInput) => {
    if (quickSaving) return
    setQuickSaving(true)
    try {
      const b = input.preset.brew
      const bean = input.preset.bean
      const isDripBag = b.method === 'drip_bag'
      // 不正値を保存しない: シート側でクランプ済みの値だけを採用する
      const doseG  = isDripBag ? undefined : input.doseG
      const grind  = isDripBag ? undefined : input.grindSize
      // カフェインは変更後の粉量で推定し直す（ドリップバッグは代表量）
      const caffeineAmount = isDripBag
        ? estimateCaffeine(DRIP_BAG_DOSE_G, bean?.decaf)
        : doseG != null
          ? estimateCaffeine(doseG, bean?.decaf)
          : b.caffeineAmount
      const count = await getBrewCount()
      const id = newId()
      await withSaveTimeout(putBrew({
        id,
        createdAt: nowISO(),
        brewedAt: nowISO(),
        method: b.method,
        beanId: b.beanId,
        recipeId: b.recipeId,
        doseG,
        waterG: input.waterG,
        grindSize: grind,
        tempC: input.tempC,
        equipmentIds: getBrewEquipmentIds(b),
        totalTimeSec: b.totalTimeSec,
        pourCount: b.pourCount,
        rating: input.rating || undefined,
        flavors: b.flavors,
        drinkStyle: b.drinkStyle,
        cupping: {},
        caffeineAmount,
      }))
      const amounts = [doseG != null ? `${doseG}g` : null, input.waterG != null ? `${input.waterG}g` : null]
        .filter(Boolean).join('／')
      setLastQuickSaved({
        id,
        label: [bean?.name ?? (isDripBag ? '銘柄なし' : 'ホームブリュー'), amounts].filter(Boolean).join('、'),
        roastLevel: bean?.roastLevel,
      })
      setSavedBrewCount(count + 1)
      setQuickSavedRated(input.rating > 0)
      setQuickSaving(false)
      setShowQuickSheet(false)
      setShowQuickAnim(true)
    } catch (e) {
      console.error('[megroove] クイック記録の保存に失敗しました:', e)
      setQuickSaving(false)
      showToast(saveErrorMessage(e), { type: 'error' })
    }
  }

  // 直前のクイック記録を取り消す。自分が保存した1件だけを対象にし、二重実行しない
  const handleQuickUndo = useCallback(async (id: string) => {
    if (undoneRef.current.has(id)) return
    undoneRef.current.add(id)
    try {
      await deleteBrew(id)
      setLastQuickSaved(null)
      loadHome()
      showToast('記録を取り消しました', { type: 'info' })
    } catch {
      undoneRef.current.delete(id)
      showToast('取り消しに失敗しました', { type: 'error' })
    }
  }, [loadHome, showToast])

  // 演出が終わってから「記録しました・取り消す」を出す（演出と重ねて騒がしくしない）
  const handleQuickAnimDone = useCallback(() => {
    setShowQuickAnim(false)
    loadHome()
    if (!lastQuickSaved) return
    const { id, label } = lastQuickSaved
    showToast(`記録しました · ${label}`, {
      type: 'success',
      action: { label: '取り消す', onClick: () => { void handleQuickUndo(id) } },
    })
  }, [loadHome, lastQuickSaved, showToast, handleQuickUndo])

  // 針を落とす: 評価待ちの一杯（最新）に星をつけて再生する
  const latestPending = pendingBrews[0]

  const handleRateSave = async () => {
    if (!latestPending || !rateValue || rateSaving) return
    setRateSaving(true)
    try {
      await withSaveTimeout(putBrew({
        ...latestPending.brew,
        rating: rateValue,
        flavors: rateFlavors,
        cupping: rateCupping,
        cuppingAverage: calcCuppingAverage(rateCupping),
      }))
      setRateSaving(false)
      setShowRateSheet(false)
      setShowRateAnim(true) // 針を落とすフル演出
    } catch (e) {
      console.error('[megroove] 評価の保存に失敗しました:', e)
      setRateSaving(false)
      showToast(saveErrorMessage(e), { type: 'error' })
    }
  }

  const handleRateAnimDone = useCallback(() => {
    setShowRateAnim(false)
    loadHome()
  }, [loadHome])

  // カフェ版クイック保存: 「過去の記録から始める」（fillFromVisit）と同じ範囲をコピーする
  // （評価・カッピング・メモ・シーン・写真はこの一杯固有のためコピーしない）
  const handleCafeQuickSave = async () => {
    if (!lastVisit || cafeQuickSaving) return
    setCafeQuickSaving(true)
    try {
      const v = lastVisit
      await withSaveTimeout(putCafeVisit({
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
      }))
      setCafeQuickSaving(false)
      setShowCafeQuickSheet(false)
      showToast('カフェの一杯を記録しました', { type: 'success' })
      loadHome()
    } catch (e) {
      console.error('[megroove] カフェのクイック記録に失敗しました:', e)
      setCafeQuickSaving(false)
      showToast(saveErrorMessage(e), { type: 'error' })
    }
  }

  // カフェ版の就寝時予測（ドリンク種別×サイズの推定カフェインで計算）。
  // ブリューのクイック記録側はシート内で同じ関数を使う（計算を重複させない）
  const cafeQuickPrediction = useMemo(() => {
    if (!showCafeQuickSheet || !lastVisit) return null
    const mg0 = estimateCafeCaffeine(lastVisit.drinkType, lastVisit.size, lastVisit.decaf)
    return predictBedtimeResidual(recentIntakes, mg0 ?? null, loadSettings())
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

      {/* 初回（記録ゼロ）だけの導入。記録が付いたら自動で消える（常設しない） */}
      {!loading && !hasRecords && (
        <p className="text-center text-sm text-[#CE9C68] -mb-1">
          ようこそ。下のボタンから、最初の一杯を記録できます ↓
        </p>
      )}

      {/* アクションボタン（記録開始の主動線。大きく＋用途をサブ文言で明示） */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/brew')}
          className="bg-[#993C1D] text-[#F7EFE6] rounded-2xl py-5 flex flex-col items-center justify-center gap-1.5 active:opacity-80"
        >
          <CupIcon size={28} />
          <span className="text-base font-semibold">淹れる</span>
          <span className="text-[11px] text-[#F7EFE6]/70">自宅の一杯</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/cafe')}
          className="bg-[#4a3828] text-[#F7EFE6] rounded-2xl py-5 flex flex-col items-center justify-center gap-1.5 active:opacity-80"
        >
          <CafeIcon size={28} />
          <span className="text-base font-semibold">カフェを記録</span>
          <span className="text-[11px] text-[#F7EFE6]/70">お店の一杯</span>
        </button>
      </div>

      {/* いつもの一杯（クイック記録） */}
      {quickPresets.length > 0 && lastBrew && (
        <button
          type="button"
          onClick={() => setShowQuickSheet(true)}
          className="-mt-3 w-full bg-[#2E2018] rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 active:opacity-80"
        >
          <span className="text-sm text-[#CE9C68] font-medium shrink-0">いつもの一杯</span>
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

      {/* 針を落とす一杯（評価待ちのブリューに後から星をつける。あるときだけ・件数バッジや赤丸は使わない） */}
      {latestPending && (
        <button
          type="button"
          onClick={() => {
            // 既存値（条件のみ保存なら空）を引き継いで開く。フォールドは既定で閉じる
            setRateValue(0)
            setShowRateDetail(false)
            setRateFlavors(latestPending.brew.flavors ?? [])
            setRateCupping(latestPending.brew.cupping ?? {})
            setShowRateSheet(true)
          }}
          className={`${lastBrew || lastVisit ? '-mt-4' : '-mt-3'} w-full bg-[#2E2018] rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 active:opacity-80`}
        >
          <span className="text-sm text-[#CE9C68] font-medium shrink-0">針を落とす一杯</span>
          <span className="text-xs text-[#6b5a4a] truncate">
            {latestPending.bean?.name ?? 'ホームブリュー'} · {formatBrewDateShort(latestPending.brew.brewedAt)}
          </span>
        </button>
      )}

      {/* 睡眠の朝カード（ポップアップで「あとで」を選んだ日の受け皿。その日ホームに残る・静かな見せ方） */}
      {showSleepCard && (
        <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm text-[#CE9C68] font-medium flex items-center gap-1.5">
            <MoonIcon size={15} /> 昨夜の眠りは？
          </p>
          <div className="flex gap-2">
            {SLEEP_CHOICES.map(({ v, l }) => (
              <button key={v} type="button" onClick={() => handleSleepRate(v)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[#3e3020] text-[#CE9C68] active:opacity-80"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 睡眠の朝ポップアップ（アプリ内ダイアログ。午前1回・「あとで」で閉じてカードに委ねる） */}
      {showSleepModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6"
          onClick={handleSleepLater}
        >
          <div
            className="bg-[#2E2018] rounded-2xl w-full max-w-sm p-6 flex flex-col gap-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-[#CE9C68]"><MoonIcon size={32} strokeWidth={1.4} /></span>
              <p className="text-[#F7EFE6] text-lg font-semibold">昨夜の眠りは？</p>
              <p className="text-xs text-[#6b5a4a]">朝のワンタップで、カフェインとの傾向を見られます</p>
            </div>
            <div className="flex flex-col gap-2">
              {SLEEP_CHOICES.map(({ v, l }) => (
                <button key={v} type="button" onClick={() => handleSleepRate(v)}
                  className="w-full py-3 rounded-xl text-sm font-medium bg-[#3e3020] text-[#F7EFE6] active:opacity-80"
                >
                  {l}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleSleepLater}
              className="text-sm text-[#6b5a4a] text-center active:opacity-70"
            >
              あとで
            </button>
          </div>
        </div>
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

      {/* 推しの豆（記録があるか、推しを設定済みのときだけ表示。初回は畳む） */}
      {(hasRecords || featuredBean) && (
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
          <div className="bg-[#2E2018] rounded-xl p-4 flex gap-3 items-center">
            {featuredBean.photoDataUrl && (
              <img src={featuredBean.photoDataUrl} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0 border border-[#3e3020] shadow-md" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[#F7EFE6] font-semibold truncate">{featuredBean.name}</p>
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
      )}

      {/* お気に入り（記録があるか、お気に入りを設定済みのときだけ表示。初回は畳む） */}
      {(hasRecords || featuredItem) && (
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
          <div className="bg-[#2E2018] rounded-xl p-4 flex gap-3 items-center">
            {featuredEquipment.photoDataUrl && (
              <img src={featuredEquipment.photoDataUrl} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0 border border-[#3e3020] shadow-md" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[#F7EFE6] font-semibold truncate">{featuredEquipment.name}</p>
              <p className="text-xs text-[#CE9C68] mt-1">
                {EQUIPMENT_TYPE_LABELS[featuredEquipment.type]}
                {featuredEquipment.maker ? ` · ${featuredEquipment.maker}` : ''}
              </p>
              {featuredEquipment.sizeNote && (
                <p className="text-xs text-[#6b5a4a] mt-0.5">{featuredEquipment.sizeNote}</p>
              )}
            </div>
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
      )}

      {/* 最近の記録（記録があるときだけ表示。初回は畳む） */}
      {hasRecords && (
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
                      {item.bean?.name ?? <span className="text-[#6b5a4a]">{item.brew.method === 'drip_bag' ? '銘柄なし' : '豆の記録なし'}</span>}
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
      )}

      {/* ─── クイック記録シート（いつもの一杯） ─── */}
      {showQuickSheet && quickPresets.length > 0 && (
        <QuickBrewSheet
          presets={quickPresets}
          recentIntakes={recentIntakes}
          saving={quickSaving}
          onSave={handleQuickSave}
          onDetail={() => { setShowQuickSheet(false); navigate('/brew') }}
          onClose={() => setShowQuickSheet(false)}
        />
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

      {/* ─── 針を落とす（評価待ち）シート ─── */}
      {showRateSheet && latestPending && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end justify-center z-50"
          onClick={() => setShowRateSheet(false)}
        >
          <div
            className="bg-[#2E2018] rounded-t-2xl w-full max-w-lg p-5 pb-8 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-[#F7EFE6] font-semibold flex items-center gap-2">
              <RecordDisk size={22} /> 針を落とす一杯
            </h3>

            {/* 評価待ちの条件サマリ（読み取り専用） */}
            <div className="bg-[#3e3020] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm text-[#F7EFE6] font-medium truncate">
                  {latestPending.bean?.name ?? 'ホームブリュー'}
                </p>
                <span className="text-[10px] text-[#6b5a4a] shrink-0">
                  {formatBrewDateShort(latestPending.brew.brewedAt)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#CE9C68]">
                {latestPending.brew.doseG != null && latestPending.brew.waterG != null && (
                  <span>
                    {latestPending.brew.doseG}g / {latestPending.brew.waterG}g
                    （{calcRatio(latestPending.brew.doseG, latestPending.brew.waterG)}）
                  </span>
                )}
                {latestPending.brew.tempC != null && <span>{latestPending.brew.tempC}°C</span>}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-[#CE9C68]">飲んでみて、どうでしたか？</p>
              <StarRating value={rateValue} onChange={setRateValue} />
            </div>

            {/* 詳しく評価する（フレーバー＋カッピング）。既定は閉じ＝星だけでも完了できる */}
            <button
              type="button"
              onClick={() => setShowRateDetail(v => !v)}
              className="flex items-center justify-between w-full text-[#CE9C68] py-1"
            >
              <span className="text-sm">詳しく評価する</span>
              <span className="text-xs">{showRateDetail ? '▲ 閉じる' : '▽ 開く'}</span>
            </button>
            {showRateDetail && (
              <div className="w-full flex flex-col gap-5">
                <div>
                  <p className="text-xs text-[#CE9C68] mb-3">フレーバー</p>
                  <FlavorChips selected={rateFlavors} onChange={setRateFlavors} frequent={frequentFlavors} />
                </div>
                <div>
                  <p className="text-xs text-[#CE9C68] mb-4">カッピング</p>
                  <CuppingSliders value={rateCupping} onChange={setRateCupping} />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleRateSave}
              disabled={rateValue === 0 || rateSaving}
              className="w-full bg-[#993C1D] text-[#F7EFE6] py-3.5 rounded-2xl text-base font-semibold active:opacity-80 disabled:opacity-40"
            >
              {rateSaving ? '保存中...' : '評価する'}
            </button>
            <button
              type="button"
              onClick={() => { setShowRateSheet(false); navigate(`/library/${latestPending.brew.id}`) }}
              className="text-sm text-[#CE9C68] text-center active:opacity-70"
            >
              詳しく見る →
            </button>
          </div>
        </div>
      )}

      {/* クイック記録の保存アニメーション（節目演出も共通） */}
      {showQuickAnim && (
        <SaveAnimation
          brewCount={savedBrewCount}
          rated={quickSavedRated}
          roastLevel={lastQuickSaved?.roastLevel}
          onDone={handleQuickAnimDone}
        />
      )}

      {/* 針を落とすフル演出（後から評価を足したとき） */}
      {showRateAnim && (
        <SaveAnimation
          brewCount={0}
          rated
          message="針を落としました"
          roastLevel={latestPending?.bean?.roastLevel}
          onDone={handleRateAnimDone}
        />
      )}

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
