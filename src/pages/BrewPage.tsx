import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import type { Brew, Bean, Equipment, Recipe, CuppingScores, BrewBlockId, BrewMethod } from '../db'
import {
  getAllBeans, getAllEquipment, getAllRecipes, getAllBrews, getAllCafeVisits,
  getBrew, putBrew, getBrewCount,
  newId, nowISO, calcCuppingAverage, calcRatio, estimateCaffeine, calcResidualCaffeine,
  loadSettings, loadBrewLayout, resizeImage,
  ROAST_LEVEL_LABELS, daysSinceRoast,
  toDatetimeLocal, fromDatetimeLocal, formatBeanRemaining, calcFrequentFlavors, getBedtimeDate,
  SCENE_OPTIONS, DRINK_STYLE_OPTIONS,
  saveBrewDraft, loadBrewDraft, clearBrewDraft, getBrewEquipmentIds,
  DRIP_BAG_DOSE_G, BREW_METHOD_LABELS,
} from '../db'
import type { BrewDraft } from '../db'
import StarRating from '../components/brew/StarRating'
import FlavorChips from '../components/brew/FlavorChips'
import CuppingSliders from '../components/brew/CuppingSliders'
import BeanPickerModal from '../components/brew/BeanPickerModal'
import RecipePickerModal from '../components/brew/RecipePickerModal'
import EquipmentSection from '../components/brew/EquipmentSection'
import SaveAnimation from '../components/brew/SaveAnimation'
import BloomTimer from '../components/brew/BloomTimer'
import ExtractionStopwatch from '../components/brew/ExtractionStopwatch'
import { useToast } from '../components/Toast'
import { CameraIcon, CaffeineIcon } from '../components/icons'

function Stepper({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min = 0,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  unit: string
  step?: number
  min?: number
}) {
  // 数値の直接入力（小数入力を壊さないため文字列バッファを持ち、フォーカス中は外部同期を止める）
  const [text, setText] = useState(() => String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])

  return (
    <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-2">
      <p className="text-xs text-[#CE9C68]">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(+(Math.max(min, value - step)).toFixed(1))}
          className="w-9 h-9 rounded-full bg-[#3e3020] text-[#F7EFE6] text-xl flex items-center justify-center flex-shrink-0 active:opacity-70"
        >
          −
        </button>
        <div className="flex-1 flex items-baseline justify-center">
          <input
            type="text"
            inputMode="decimal"
            value={text}
            onFocus={() => setFocused(true)}
            onChange={e => {
              setText(e.target.value)
              const n = parseFloat(e.target.value)
              if (!Number.isNaN(n)) onChange(Math.max(min, n))
            }}
            onBlur={() => {
              setFocused(false)
              const n = parseFloat(text)
              setText(String(Number.isNaN(n) ? value : Math.max(min, +n.toFixed(1))))
            }}
            className="w-14 bg-transparent text-[#F7EFE6] text-xl font-semibold outline-none tabular-nums text-right"
          />
          <span className="text-xs text-[#CE9C68] ml-1">{unit}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(+(value + step).toFixed(1))}
          className="w-9 h-9 rounded-full bg-[#3e3020] text-[#F7EFE6] text-xl flex items-center justify-center flex-shrink-0 active:opacity-70"
        >
          ＋
        </button>
      </div>
    </div>
  )
}

export default function BrewPage() {
  const navigate = useNavigate()
  const { id: editBrewId } = useParams<{ id?: string }>()
  const location = useLocation()
  const fromBrewId = (location.state as { fromBrewId?: string } | null)?.fromBrewId
  const isEditMode = Boolean(editBrewId)

  const showToast = useToast()

  const [beans, setBeans] = useState<Bean[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [allBrews, setAllBrews] = useState<Brew[]>([])

  const [brewedAtLocal, setBrewedAtLocal] = useState(() => toDatetimeLocal(nowISO()))
  const [method, setMethod] = useState<BrewMethod>('pour_over')
  const [beanId, setBeanId] = useState<string | undefined>()
  const [recipeId, setRecipeId] = useState<string | undefined>()
  const [doseG, setDoseG] = useState(15)
  const [waterG, setWaterG] = useState(240)
  const [grindSize, setGrindSize] = useState<number | undefined>()
  const [tempC, setTempC] = useState(90)
  const [rating, setRating] = useState(0)
  const [flavors, setFlavors] = useState<string[]>([])
  const [scene, setScene] = useState('')
  const [drinkStyle, setDrinkStyle] = useState<string[]>([])
  const [showDetail, setShowDetail] = useState(false)
  const [cupping, setCupping] = useState<CuppingScores>({})
  const [equipmentIds, setEquipmentIds] = useState<string[]>([])
  const [totalTimeSec, setTotalTimeSec] = useState<number | undefined>()
  const [pourCount, setPourCount] = useState<number | undefined>()
  const [note, setNote] = useState('')

  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>()
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [showBeanPicker, setShowBeanPicker] = useState(false)
  const [showRecipePicker, setShowRecipePicker] = useState(false)
  const [showSaveAnim, setShowSaveAnim] = useState(false)
  const [savedBrewCount, setSavedBrewCount] = useState(0)
  const [savedRated, setSavedRated] = useState(true) // 保存時に評価が付いていたか（演出の出し分け用）
  const [saving, setSaving] = useState(false)

  // 入力途中の下書き（新規記録のみ）。復元表示のフラグと自動保存の基準
  const [draftRestored, setDraftRestored] = useState(false)
  const draftLoadedRef = useRef(false)
  const draftBaselineRef = useRef<string | null>(null)

  const layout = useMemo(() => loadBrewLayout(), [])

  // カフェインの就寝時予測用
  const caffeineSettings = useMemo(() => loadSettings(), [])
  const [pastIntakes, setPastIntakes] = useState<{ caffeineAmount: number; brewedAt: string }[]>([])
  const [bedtimePrediction, setBedtimePrediction] = useState<number | null>(null)

  useEffect(() => {
    if (isEditMode) return
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    Promise.all([getAllBrews(), getAllCafeVisits()]).then(([brews, visits]) => {
      const brewIntakes = brews
        .filter(b => b.caffeineAmount != null && new Date(b.brewedAt).getTime() > cutoff)
        .map(b => ({ caffeineAmount: b.caffeineAmount!, brewedAt: b.brewedAt }))
      const cafeIntakes = visits
        .filter(v => v.caffeineAmount != null && new Date(v.visitedAt).getTime() > cutoff)
        .map(v => ({ caffeineAmount: v.caffeineAmount!, brewedAt: v.visitedAt }))
      setPastIntakes([...brewIntakes, ...cafeIntakes])
    }).catch(() => {})
  }, [isEditMode])

  // 「よく使う」フレーバー（全ブリュー＋カフェ記録から集計）
  const [frequentFlavors, setFrequentFlavors] = useState<string[]>([])
  useEffect(() => {
    Promise.all([getAllBrews(), getAllCafeVisits()])
      .then(([brews, visits]) => setFrequentFlavors(calcFrequentFlavors([...brews, ...visits])))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const decaf = beans.find(b => b.id === beanId)?.decaf
    // ドリップバッグは代表量で、通常は粉量で推定。どちらも無ければ予測しない
    const mg = method === 'drip_bag'
      ? estimateCaffeine(DRIP_BAG_DOSE_G, decaf)
      : doseG ? estimateCaffeine(doseG, decaf) : null
    if (isEditMode || mg === null) { setBedtimePrediction(null); return }
    const now = new Date()
    const bt = getBedtimeDate(caffeineSettings.bedtimeHour, caffeineSettings.bedtimeMinute, now)
    const allIntakes = [
      ...pastIntakes,
      { caffeineAmount: mg, brewedAt: now.toISOString() },
    ]
    setBedtimePrediction(calcResidualCaffeine(allIntakes, bt))
  }, [method, doseG, pastIntakes, isEditMode, caffeineSettings, beanId, beans])

  const fillFromBrew = useCallback((b: Brew, copyEval: boolean) => {
    setBeanId(b.beanId)
    setRecipeId(b.recipeId)
    if (b.doseG !== undefined) setDoseG(b.doseG)
    if (b.waterG !== undefined) setWaterG(b.waterG)
    setGrindSize(b.grindSize)
    if (b.tempC !== undefined) setTempC(b.tempC)
    setEquipmentIds(getBrewEquipmentIds(b))
    setTotalTimeSec(b.totalTimeSec)
    setPourCount(b.pourCount)
    setFlavors(b.flavors)
    // 飲み方は習慣なので引き継ぐ。シーンはその瞬間の文脈なのでコピーしない
    setDrinkStyle(b.drinkStyle ?? [])
    if (copyEval) {
      setRating(b.rating ?? 0)
      setCupping(b.cupping)
      setNote(b.note ?? '')
      setPhotoDataUrl(b.photoDataUrl)
      setScene(b.scene ?? '')
    }
  }, [])

  // 下書き（BrewDraft）から入力欄を復元する
  const applyDraft = useCallback((d: BrewDraft) => {
    setBrewedAtLocal(d.brewedAtLocal)
    setMethod(d.method ?? 'pour_over')
    setBeanId(d.beanId)
    setRecipeId(d.recipeId)
    setDoseG(d.doseG)
    setWaterG(d.waterG)
    setGrindSize(d.grindSize)
    setTempC(d.tempC)
    setRating(d.rating)
    // 配列・オブジェクト系は、旧バージョンの下書き（フィールド欠落）でも壊れないよう既定値で補う
    setFlavors(d.flavors ?? [])
    setScene(d.scene ?? '')
    setDrinkStyle(d.drinkStyle ?? [])
    setCupping(d.cupping ?? {})
    setEquipmentIds(getBrewEquipmentIds(d)) // 旧下書きの equipmentId も吸収し、常に配列にする
    setTotalTimeSec(d.totalTimeSec)
    setPourCount(d.pourCount)
    setNote(d.note)
    setPhotoDataUrl(d.photoDataUrl)
    setShowDetail(d.showDetail)
  }, [])

  useEffect(() => {
    Promise.all([getAllBeans(), getAllEquipment(), getAllRecipes(), getAllBrews()])
      .then(([bs, eqs, recs, brews]) => {
        setBeans(bs)
        setEquipment(eqs)
        setRecipes(recs)
        setAllBrews(brews)
        if (!editBrewId && !fromBrewId) {
          // 通常モード: 下書きがあれば最優先で復元、なければ最後の記録で初期値
          const draft = loadBrewDraft()
          if (draft) {
            applyDraft(draft)
            setDraftRestored(true)
            showToast('入力中だった内容を復元しました', { type: 'success' })
          } else {
            const last = brews.at(-1)
            if (last) fillFromBrew(last, false)
          }
          // 初期化完了。以後の変更を自動保存の対象にする
          draftLoadedRef.current = true
        }
      })
      .catch(() => {/* データ読込失敗時は空のまま続行 */})

    if (editBrewId) {
      // 編集モード: 既存記録を全フィールド（評価・日時・抽出方法含む）で読み込む
      getBrew(editBrewId).then(b => {
        if (b) {
          fillFromBrew(b, true)
          setMethod(b.method ?? 'pour_over')
          setBrewedAtLocal(toDatetimeLocal(b.brewedAt))
        }
      }).catch(() => {})
    } else if (fromBrewId) {
      // 再現モード: 技術パラメータ＋抽出方法を転写、評価はリセット
      getBrew(fromBrewId).then(b => { if (b) { fillFromBrew(b, false); setMethod(b.method ?? 'pour_over') } }).catch(() => {})
    }
    // 通常の新規（素の /brew）は method を引き継がず常に pour_over のまま
  }, [editBrewId, fromBrewId, fillFromBrew, applyDraft, showToast])

  // 現在の入力を下書きスナップショットにまとめる
  const buildDraft = useCallback((): BrewDraft => ({
    brewedAtLocal, method, beanId, recipeId, doseG, waterG, grindSize, tempC, rating,
    flavors, scene, drinkStyle, cupping, equipmentIds, totalTimeSec, pourCount,
    note, photoDataUrl, showDetail,
  }), [
    brewedAtLocal, method, beanId, recipeId, doseG, waterG, grindSize, tempC, rating,
    flavors, scene, drinkStyle, cupping, equipmentIds, totalTimeSec, pourCount,
    note, photoDataUrl, showDetail,
  ])

  // 入力途中の自動保存（新規記録のみ）。初期化直後の値を基準にし、変化があったら退避する
  useEffect(() => {
    if (editBrewId || fromBrewId) return
    if (!draftLoadedRef.current) return
    const str = JSON.stringify(buildDraft())
    if (draftBaselineRef.current === null) {
      // 初期化後の最初の1回は基準として記録するだけ（保存しない）
      draftBaselineRef.current = str
      return
    }
    if (str === draftBaselineRef.current) return
    saveBrewDraft(buildDraft())
  }, [editBrewId, fromBrewId, buildDraft])

  // 復元した下書きを破棄して、通常の初期状態（前回値）に戻す
  const discardDraft = () => {
    clearBrewDraft()
    draftBaselineRef.current = null // reset 後の状態を新しい基準として捉え直す（保存しない）
    setDraftRestored(false)
    // 既定値へリセット
    setBrewedAtLocal(toDatetimeLocal(nowISO()))
    setMethod('pour_over')
    setBeanId(undefined); setRecipeId(undefined)
    setDoseG(15); setWaterG(240); setGrindSize(undefined); setTempC(90)
    setRating(0); setFlavors([]); setScene(''); setDrinkStyle([])
    setCupping({}); setEquipmentIds([]); setTotalTimeSec(undefined)
    setPourCount(undefined); setNote(''); setPhotoDataUrl(undefined); setShowDetail(false)
    const last = allBrews.at(-1)
    if (last) fillFromBrew(last, false)
  }

  const selectedBean = beans.find(b => b.id === beanId)
  const selectedRecipe = recipes.find(r => r.id === recipeId)
  const ratio = calcRatio(doseG, waterG)
  const isDripBag = method === 'drip_bag'
  const beanLabel = isDripBag ? '銘柄' : '豆' // ドリップバッグは実態が「豆」でなく銘柄・商品名

  // 推定カフェイン量。ドリップバッグは粉量を持たないため代表量で推定する（参考値）
  const estimatedCaffeine =
    isDripBag ? estimateCaffeine(DRIP_BAG_DOSE_G, selectedBean?.decaf)
    : doseG ? estimateCaffeine(doseG, selectedBean?.decaf)
    : undefined

  const buildBrewFields = () => ({
    method: isDripBag ? 'drip_bag' as const : undefined, // 通常ドリップは未設定のまま（後方互換）
    beanId,
    // ドリップバッグは粉量・挽き目・レシピを自分で決めないため保存しない（豆残量にも加算されない）
    recipeId:  isDripBag ? undefined : recipeId,
    doseG:     isDripBag ? undefined : doseG,
    waterG,
    grindSize: isDripBag ? undefined : grindSize,
    tempC,
    equipmentIds: equipmentIds.length > 0 ? equipmentIds : undefined,
    equipmentId: undefined, // 新規保存は equipmentIds を使う（旧フィールドは残さない）
    totalTimeSec,
    pourCount,
    rating: rating || undefined,
    flavors,
    scene: scene || undefined,
    drinkStyle: drinkStyle.length > 0 ? drinkStyle : undefined,
    cupping,
    cuppingAverage: calcCuppingAverage(cupping),
    caffeineAmount: estimatedCaffeine,
    photoDataUrl,
    note: note.trim() || undefined,
  })

  const handleSave = async () => {
    if (saving) return
    setSaving(true)

    try {
      if (isEditMode && editBrewId) {
        const existing = await getBrew(editBrewId)
        if (existing) {
          await putBrew({ ...existing, ...buildBrewFields(), brewedAt: fromDatetimeLocal(brewedAtLocal) })
        }
        setSaving(false)
        navigate(`/library/${editBrewId}`, { replace: true })
        showToast('変更を保存しました', { type: 'success' })
        return
      }

      const count = await getBrewCount()
      const brew: Brew = {
        id: newId(),
        createdAt: nowISO(),
        ...buildBrewFields(),
        brewedAt: fromDatetimeLocal(brewedAtLocal),
      }
      await putBrew(brew)
      clearBrewDraft() // 保存できたので下書きは不要
      setSavedBrewCount(count + 1)
      setSavedRated((brew.rating ?? 0) > 0) // 星があればフル演出、無ければ静かに盤を置くだけ
      setSaving(false)
      setShowSaveAnim(true)
    } catch {
      setSaving(false)
      showToast('保存に失敗しました。ストレージの空き容量を確認してください', { type: 'error' })
    }
  }

  const handleAnimDone = useCallback(() => {
    setShowSaveAnim(false)
    navigate('/')
  }, [navigate])

  const handleBeanSelect = (bean: Bean) => {
    setBeanId(bean.id)
    setBeans(prev => (prev.find(b => b.id === bean.id) ? prev : [...prev, bean]))
  }

  const handleRecipeSelect = (recipe: Recipe) => {
    setRecipeId(recipe.id)
    setRecipes(prev => (prev.find(r => r.id === recipe.id) ? prev : [...prev, recipe]))
    if (recipe.defaultDoseG !== undefined) setDoseG(recipe.defaultDoseG)
    if (recipe.defaultWaterG !== undefined) setWaterG(recipe.defaultWaterG)
    if (recipe.defaultGrindSize !== undefined) setGrindSize(recipe.defaultGrindSize)
    if (recipe.defaultTempC !== undefined) setTempC(recipe.defaultTempC)
  }

  const renderBlock = (id: BrewBlockId): React.ReactNode => {
    switch (id) {
      case 'recipe':
        // ドリップバッグは粉量・挽き目を決めないため、レシピ（それらの雛形）は出さない
        if (isDripBag) return null
        return (
          <button
            key="recipe"
            type="button"
            onClick={() => setShowRecipePicker(true)}
            className="w-full bg-[#2E2018] rounded-xl p-4 text-left active:opacity-80 flex items-center justify-between"
          >
            <div>
              <p className="text-xs text-[#CE9C68] mb-1">レシピ</p>
              <p className="text-[#F7EFE6]">{selectedRecipe ? selectedRecipe.name : '前回と同じ'}</p>
            </div>
            <span className="text-[#6b5a4a] text-sm">変更 →</span>
          </button>
        )

      case 'dose_water':
        // ドリップバッグは粉量を持たないので湯量のみ（比率も出さない）
        if (isDripBag) {
          return (
            <div key="dose_water">
              <Stepper label="湯量" value={waterG} onChange={setWaterG} unit="g" step={5} min={10} />
            </div>
          )
        }
        return (
          <div key="dose_water" className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <Stepper label="粉量" value={doseG} onChange={setDoseG} unit="g" step={0.5} min={1} />
              <Stepper label="湯量" value={waterG} onChange={setWaterG} unit="g" step={5} min={10} />
            </div>
            <div className="text-center">
              <span className="text-xs text-[#CE9C68]">比率 </span>
              <span className="text-[#F7EFE6] font-semibold tabular-nums">{ratio}</span>
            </div>
          </div>
        )

      case 'grind_temp': {
        // ドリップバッグは挽き目を決めないので湯温のみ
        const tempBox = (
          <div className="bg-[#2E2018] rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <p className="text-xs text-[#CE9C68]">湯温</p>
              <p className="text-xs text-[#F7EFE6] font-semibold tabular-nums">{tempC}°C</p>
            </div>
            <input
              type="range"
              min={70}
              max={100}
              step={1}
              value={tempC}
              onChange={e => setTempC(Number(e.target.value))}
              className="w-full accent-[#993C1D] mt-1"
            />
          </div>
        )
        if (isDripBag) return <div key="grind_temp">{tempBox}</div>
        return (
          <div key="grind_temp" className="grid grid-cols-2 gap-3">
            <div className="bg-[#2E2018] rounded-xl p-4">
              <p className="text-xs text-[#CE9C68] mb-2">挽き目</p>
              <input
                type="number"
                inputMode="decimal"
                value={grindSize ?? ''}
                onChange={e => setGrindSize(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="—"
                className="w-full bg-transparent text-[#F7EFE6] text-xl font-semibold outline-none placeholder-[#4a3a2a] tabular-nums"
              />
            </div>
            {tempBox}
          </div>
        )
      }

      case 'rating':
        return (
          <div key="rating" className="bg-[#2E2018] rounded-xl p-4">
            <p className="text-xs text-[#CE9C68] mb-3">評価</p>
            <StarRating value={rating} onChange={setRating} />
          </div>
        )

      case 'flavors':
        return (
          <div key="flavors" className="bg-[#2E2018] rounded-xl p-4">
            <p className="text-xs text-[#CE9C68] mb-3">フレーバー</p>
            <FlavorChips selected={flavors} onChange={setFlavors} frequent={frequentFlavors} />
          </div>
        )

      case 'scene':
        return (
          <div key="scene" className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-4">
            <div>
              <p className="text-xs text-[#CE9C68] mb-3">シーン</p>
              <div className="flex flex-wrap gap-2">
                {SCENE_OPTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScene(scene === s ? '' : s)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      scene === s ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#3e3020] text-[#CE9C68]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[#CE9C68] mb-3">飲み方</p>
              <div className="flex flex-wrap gap-2">
                {DRINK_STYLE_OPTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDrinkStyle(
                      drinkStyle.includes(s) ? drinkStyle.filter(x => x !== s) : [...drinkStyle, s],
                    )}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      drinkStyle.includes(s) ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#3e3020] text-[#CE9C68]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case 'cupping':
        return (
          <div key="cupping" className="bg-[#2E2018] rounded-xl p-4">
            <p className="text-xs text-[#CE9C68] mb-4">カッピング</p>
            <CuppingSliders value={cupping} onChange={setCupping} />
          </div>
        )

      case 'equipment':
        return (
          <div key="equipment" className="bg-[#2E2018] rounded-xl p-4">
            <p className="text-xs text-[#CE9C68] mb-3">器具</p>
            <EquipmentSection
              equipment={equipment}
              selectedIds={equipmentIds}
              onToggle={id => setEquipmentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              onNewEquipment={e => setEquipment(prev => [...prev, e])}
            />
          </div>
        )

      case 'extraction':
        return (
          <div key="extraction" className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-4">
            <div>
              <p className="text-xs text-[#CE9C68] mb-2">総抽出時間</p>
              <ExtractionStopwatch valueSec={totalTimeSec} onChange={setTotalTimeSec} />
            </div>
            <div className="border-t border-[#3e3020] pt-4">
              <p className="text-xs text-[#CE9C68] mb-2">注湯回数</p>
              <input
                type="number"
                inputMode="numeric"
                value={pourCount ?? ''}
                onChange={e => setPourCount(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="—"
                className="w-full bg-transparent text-[#F7EFE6] text-xl font-semibold outline-none placeholder-[#4a3a2a] tabular-nums"
              />
            </div>
            <div className="border-t border-[#3e3020] pt-4">
              <p className="text-xs text-[#CE9C68] mb-3">蒸らしタイマー</p>
              <BloomTimer />
            </div>
          </div>
        )

      case 'note':
        return (
          <div key="note" className="bg-[#2E2018] rounded-xl p-4">
            <p className="text-xs text-[#CE9C68] mb-2">メモ</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="今日の一杯について..."
              rows={3}
              className="w-full bg-transparent text-[#F7EFE6] outline-none resize-none placeholder-[#4a3a2a] text-sm"
            />
          </div>
        )

      case 'photo':
        return (
          <div key="photo" className="bg-[#2E2018] rounded-xl p-4">
            <p className="text-xs text-[#CE9C68] mb-3">写真</p>
            {photoDataUrl ? (
              <div className="relative">
                <img
                  src={photoDataUrl}
                  alt="記録の写真"
                  className="w-full rounded-lg object-cover max-h-64"
                />
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(undefined)}
                  className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full"
                >
                  削除
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-full border border-dashed border-[#CE9C68]/40 text-[#CE9C68] py-7 rounded-xl text-sm flex items-center justify-center gap-2 active:opacity-70"
              >
                <CameraIcon size={20} />
                <span>写真を追加</span>
              </button>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  setPhotoDataUrl(await resizeImage(file, 800))
                } catch (err) {
                  showToast(err instanceof Error ? err.message : '写真の読み込みに失敗しました', { type: 'error' })
                }
              }}
            />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
      <div className="flex flex-col flex-1 px-4 py-5 gap-4 overflow-y-auto">
        {isEditMode && (
          <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm -mb-2">
            ← 戻る
          </button>
        )}
        <h2 className="text-xl font-semibold text-[#F7EFE6]">
          {isEditMode ? '記録を編集' : 'この一杯を記録する'}
        </h2>

        {/* 入力途中の復元通知（新規記録のみ） */}
        {draftRestored && (
          <div className="w-full bg-[#3e3020] border border-[#CE9C68]/25 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
            <p className="text-xs text-[#CE9C68]">入力中だった内容を復元しました</p>
            <button
              type="button"
              onClick={discardDraft}
              className="text-xs text-[#6b5a4a] shrink-0 active:opacity-60 px-1"
            >
              破棄して最初から
            </button>
          </div>
        )}

        {/* 日時（既定は今。過去の一杯もあとから記録できる） */}
        <div className="w-full bg-[#2E2018] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[#CE9C68] shrink-0">日時</p>
          <input
            type="datetime-local"
            value={brewedAtLocal}
            onChange={e => setBrewedAtLocal(e.target.value)}
            className="bg-transparent text-[#F7EFE6] text-sm outline-none text-right"
          />
        </div>

        {/* 豆カード（固定）。ドリップバッグでは「銘柄」ラベルに切替。本体タップで選び直し、✕で未選択に戻す */}
        <div className="relative w-full bg-[#2E2018] rounded-xl">
          <button
            type="button"
            onClick={() => setShowBeanPicker(true)}
            className="w-full p-4 text-left active:opacity-80"
          >
            <p className="text-xs text-[#CE9C68] mb-1">{beanLabel}</p>
            {selectedBean ? (
              <>
                <p className="text-[#F7EFE6] font-medium pr-8">{selectedBean.name}</p>
                {/* 銘柄（ドリップバッグ）は焙煎度・産地・残量が実態に合わないため名前のみ */}
                {!isDripBag && (
                  <>
                    <p className="text-xs text-[#CE9C68] mt-0.5">
                      {ROAST_LEVEL_LABELS[selectedBean.roastLevel]}
                      {selectedBean.roastedAt ? ` · 焙煎から${daysSinceRoast(selectedBean.roastedAt)}日` : ''}
                      {selectedBean.origin ? ` · ${selectedBean.origin}` : ''}
                    </p>
                    {formatBeanRemaining(selectedBean, allBrews) && (
                      <p className="text-xs text-[#6b5a4a] mt-0.5">
                        {formatBeanRemaining(selectedBean, allBrews)}
                      </p>
                    )}
                  </>
                )}
              </>
            ) : (
              <p className="text-[#6b5a4a]">タップして{beanLabel}を選ぶ{isDripBag ? '（任意）' : ''} →</p>
            )}
          </button>
          {selectedBean && (
            <button
              type="button"
              onClick={() => setBeanId(undefined)}
              aria-label={`${beanLabel}を未選択にする`}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-[#3e3020] text-[#CE9C68] flex items-center justify-center text-sm active:opacity-70"
            >
              ✕
            </button>
          )}
        </div>

        {/* 抽出方法（スリムトグル）。ドリップバッグでは粉量・挽き目などを出し分ける */}
        <div className="w-full bg-[#2E2018] rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-[#CE9C68] shrink-0">抽出方法</p>
          <div className="flex gap-0.5 bg-[#1a0a05] rounded-lg p-0.5">
            {(['pour_over', 'drip_bag'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  method === m ? 'bg-[#993C1D] text-[#F7EFE6]' : 'text-[#6b5a4a]'
                }`}
              >
                {BREW_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* メインゾーンのブロック */}
        {layout.main.map(id => renderBlock(id))}

        {/* 詳細トグル（詳細ゾーンにブロックがある場合のみ表示） */}
        {layout.detail.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDetail(v => !v)}
            className="flex items-center justify-between w-full text-[#CE9C68] py-1"
          >
            <span className="text-sm">詳細を入力</span>
            <span className="text-xs">{showDetail ? '▲ 閉じる' : '▽ 開く'}</span>
          </button>
        )}

        {/* 詳細ゾーンのブロック */}
        {showDetail && layout.detail.length > 0 && (
          <div className="flex flex-col gap-4">
            {layout.detail.map(id => renderBlock(id))}
          </div>
        )}

        {/* 就寝時の残留予測（推定・目安。5mg 未満は表示しない） */}
        {bedtimePrediction !== null && bedtimePrediction >= 5 && (
          bedtimePrediction > caffeineSettings.bedtimeTargetMg ? (
            <div className="bg-amber-900/40 border border-amber-600/40 rounded-xl p-3 flex gap-2.5 items-start">
              <span className="text-amber-400 mt-0.5"><CaffeineIcon size={16} /></span>
              <div>
                <p className="text-amber-300 text-sm font-medium">就寝時の推定残留量が目標を超える見込みです</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  約{Math.round(bedtimePrediction)}mg・目標 {caffeineSettings.bedtimeTargetMg}mg・就寝 {caffeineSettings.bedtimeHour.toString().padStart(2,'0')}:{caffeineSettings.bedtimeMinute.toString().padStart(2,'0')}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#6b5a4a] text-center">
              いま保存すると、就寝時（{caffeineSettings.bedtimeHour.toString().padStart(2,'0')}:{caffeineSettings.bedtimeMinute.toString().padStart(2,'0')}）の推定残留量は約{Math.round(bedtimePrediction)}mg（個人差があります）
            </p>
          )
        )}

        {/* 保存ボタン。通常ドリップは豆必須。ドリップバッグは銘柄なしでも保存可 */}
        {!isDripBag && !beanId ? (
          <p className="text-xs text-[#6b5a4a] text-center -mb-1">豆を選んでください</p>
        ) : rating === 0 && !isEditMode ? (
          // 保存可能だが星が未入力のとき: 評価は後回しにできることを控えめに伝える（急かさない）
          <p className="text-xs text-[#6b5a4a] text-center -mb-1">飲んでから、あとで評価を足せます</p>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (!isDripBag && !beanId)}
          className="w-full bg-[#993C1D] text-[#F7EFE6] py-4 rounded-2xl text-base font-semibold active:opacity-80 disabled:opacity-40 mt-2 mb-2"
        >
          {saving ? '保存中...' : isEditMode ? '変更を保存する' : 'この一杯を記録する'}
        </button>
      </div>

      {showBeanPicker && (
        <BeanPickerModal
          currentBeanId={beanId}
          mode={isDripBag ? 'brand' : 'bean'}
          onSelect={handleBeanSelect}
          onClose={() => setShowBeanPicker(false)}
        />
      )}

      {showRecipePicker && (
        <RecipePickerModal
          currentRecipeId={recipeId}
          defaultDoseG={doseG}
          defaultWaterG={waterG}
          defaultGrindSize={grindSize}
          defaultTempC={tempC}
          onSelect={handleRecipeSelect}
          onClear={() => setRecipeId(undefined)}
          onClose={() => setShowRecipePicker(false)}
        />
      )}

      {showSaveAnim && (
        <SaveAnimation brewCount={savedBrewCount} rated={savedRated} onDone={handleAnimDone} />
      )}
    </>
  )
}
