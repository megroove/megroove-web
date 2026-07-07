import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import type { Brew, Bean, Equipment, Recipe, CuppingScores, BrewBlockId } from '../db'
import {
  getAllBeans, getAllEquipment, getAllRecipes, getAllBrews, getAllCafeVisits,
  getBrew, putBrew, getBrewCount,
  newId, nowISO, calcCuppingAverage, calcRatio, estimateCaffeine, calcResidualCaffeine,
  loadSettings, loadBrewLayout, resizeImage,
  ROAST_LEVEL_LABELS, daysSinceRoast,
  toDatetimeLocal, fromDatetimeLocal, formatBeanRemaining,
} from '../db'
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
        <span className="flex-1 text-center text-[#F7EFE6] text-xl font-semibold tabular-nums">
          {value}{unit}
        </span>
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
  const [beanId, setBeanId] = useState<string | undefined>()
  const [recipeId, setRecipeId] = useState<string | undefined>()
  const [doseG, setDoseG] = useState(15)
  const [waterG, setWaterG] = useState(240)
  const [grindSize, setGrindSize] = useState<number | undefined>()
  const [tempC, setTempC] = useState(90)
  const [rating, setRating] = useState(0)
  const [flavors, setFlavors] = useState<string[]>([])
  const [showDetail, setShowDetail] = useState(false)
  const [cupping, setCupping] = useState<CuppingScores>({})
  const [equipmentId, setEquipmentId] = useState<string | undefined>()
  const [totalTimeSec, setTotalTimeSec] = useState<number | undefined>()
  const [pourCount, setPourCount] = useState<number | undefined>()
  const [note, setNote] = useState('')

  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>()
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [showBeanPicker, setShowBeanPicker] = useState(false)
  const [showRecipePicker, setShowRecipePicker] = useState(false)
  const [showSaveAnim, setShowSaveAnim] = useState(false)
  const [savedBrewCount, setSavedBrewCount] = useState(0)
  const [saving, setSaving] = useState(false)

  const layout = useMemo(() => loadBrewLayout(), [])

  // カフェインアラート用
  const caffeineSettings = useMemo(() => loadSettings(), [])
  const [pastIntakes, setPastIntakes] = useState<{ caffeineAmount: number; brewedAt: string }[]>([])
  const [caffeineAlert, setCaffeineAlert] = useState(false)

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

  useEffect(() => {
    if (isEditMode || !doseG) { setCaffeineAlert(false); return }
    const bt = new Date()
    bt.setHours(caffeineSettings.bedtimeHour, caffeineSettings.bedtimeMinute, 0, 0)
    if (bt <= new Date()) bt.setDate(bt.getDate() + 1)
    const allIntakes = [
      ...pastIntakes,
      { caffeineAmount: estimateCaffeine(doseG), brewedAt: new Date().toISOString() },
    ]
    setCaffeineAlert(calcResidualCaffeine(allIntakes, bt) > caffeineSettings.bedtimeTargetMg)
  }, [doseG, pastIntakes, isEditMode, caffeineSettings])

  const fillFromBrew = useCallback((b: Brew, copyEval: boolean) => {
    setBeanId(b.beanId)
    setRecipeId(b.recipeId)
    if (b.doseG !== undefined) setDoseG(b.doseG)
    if (b.waterG !== undefined) setWaterG(b.waterG)
    setGrindSize(b.grindSize)
    if (b.tempC !== undefined) setTempC(b.tempC)
    setEquipmentId(b.equipmentId)
    setTotalTimeSec(b.totalTimeSec)
    setPourCount(b.pourCount)
    setFlavors(b.flavors)
    if (copyEval) {
      setRating(b.rating ?? 0)
      setCupping(b.cupping)
      setNote(b.note ?? '')
      setPhotoDataUrl(b.photoDataUrl)
    }
  }, [])

  useEffect(() => {
    Promise.all([getAllBeans(), getAllEquipment(), getAllRecipes(), getAllBrews()])
      .then(([bs, eqs, recs, brews]) => {
        setBeans(bs)
        setEquipment(eqs)
        setRecipes(recs)
        setAllBrews(brews)
        if (!editBrewId && !fromBrewId) {
          // 通常モード: 最後の記録で初期値
          const last = brews.at(-1)
          if (last) fillFromBrew(last, false)
        }
      })
      .catch(() => {/* データ読込失敗時は空のまま続行 */})

    if (editBrewId) {
      // 編集モード: 既存記録を全フィールド（評価・日時含む）で読み込む
      getBrew(editBrewId).then(b => {
        if (b) {
          fillFromBrew(b, true)
          setBrewedAtLocal(toDatetimeLocal(b.brewedAt))
        }
      }).catch(() => {})
    } else if (fromBrewId) {
      // 再現モード: 技術パラメータのみ転写、評価はリセット
      getBrew(fromBrewId).then(b => { if (b) fillFromBrew(b, false) }).catch(() => {})
    }
  }, [editBrewId, fromBrewId, fillFromBrew])

  const selectedBean = beans.find(b => b.id === beanId)
  const selectedRecipe = recipes.find(r => r.id === recipeId)
  const ratio = calcRatio(doseG, waterG)

  const buildBrewFields = () => ({
    beanId,
    recipeId,
    doseG,
    waterG,
    grindSize,
    tempC,
    equipmentId,
    totalTimeSec,
    pourCount,
    rating: rating || undefined,
    flavors,
    cupping,
    cuppingAverage: calcCuppingAverage(cupping),
    caffeineAmount: doseG ? estimateCaffeine(doseG) : undefined,
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
      setSavedBrewCount(count + 1)
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

      case 'grind_temp':
        return (
          <div key="grind_temp" className="grid grid-cols-2 gap-3">
            <div className="bg-[#2E2018] rounded-xl p-4">
              <p className="text-xs text-[#CE9C68] mb-2">挽き目</p>
              <input
                type="number"
                value={grindSize ?? ''}
                onChange={e => setGrindSize(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="—"
                className="w-full bg-transparent text-[#F7EFE6] text-xl font-semibold outline-none placeholder-[#4a3a2a] tabular-nums"
              />
            </div>
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
          </div>
        )

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
            <FlavorChips selected={flavors} onChange={setFlavors} />
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
              selectedId={equipmentId}
              onSelect={setEquipmentId}
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
                <span className="text-xl">📷</span>
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

        {/* 豆カード（固定） */}
        <button
          type="button"
          onClick={() => setShowBeanPicker(true)}
          className="w-full bg-[#2E2018] rounded-xl p-4 text-left active:opacity-80"
        >
          <p className="text-xs text-[#CE9C68] mb-1">豆</p>
          {selectedBean ? (
            <>
              <p className="text-[#F7EFE6] font-medium">{selectedBean.name}</p>
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
          ) : (
            <p className="text-[#6b5a4a]">タップして豆を選ぶ →</p>
          )}
        </button>

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

        {/* カフェインアラート */}
        {caffeineAlert && (
          <div className="bg-amber-900/40 border border-amber-600/40 rounded-xl p-3 flex gap-2.5 items-start">
            <span className="text-amber-400 text-base leading-none mt-0.5">⚡</span>
            <div>
              <p className="text-amber-300 text-sm font-medium">就寝時の残留量が目標を超える見込みです</p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                目標 {caffeineSettings.bedtimeTargetMg}mg・就寝 {caffeineSettings.bedtimeHour.toString().padStart(2,'0')}:{caffeineSettings.bedtimeMinute.toString().padStart(2,'0')}
              </p>
            </div>
          </div>
        )}

        {/* 保存ボタン */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#993C1D] text-[#F7EFE6] py-4 rounded-2xl text-base font-semibold active:opacity-80 disabled:opacity-40 mt-2 mb-2"
        >
          {saving ? '保存中...' : isEditMode ? '変更を保存する' : 'この一杯を記録する'}
        </button>
      </div>

      {showBeanPicker && (
        <BeanPickerModal
          currentBeanId={beanId}
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
        <SaveAnimation brewCount={savedBrewCount} onDone={handleAnimDone} />
      )}
    </>
  )
}
