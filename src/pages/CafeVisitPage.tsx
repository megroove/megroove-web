import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { CafeVisit, CafeDrinkType, CafeDrinkSize, CuppingScores } from '../db'
import {
  getAllCafeVisits, getCafeVisit, putCafeVisit, getAllBrews,
  newId, nowISO,
  CAFE_DRINK_TYPE_LABELS, CAFE_DRINK_SIZE_LABELS, estimateCafeCaffeine,
  calcCuppingAverage, formatBrewDateShort, resizeImage,
  toDatetimeLocal, fromDatetimeLocal, calcFrequentFlavors,
  SCENE_OPTIONS, DRINK_STYLE_OPTIONS,
} from '../db'
import StarRating from '../components/brew/StarRating'
import FlavorChips from '../components/brew/FlavorChips'
import CuppingSliders from '../components/brew/CuppingSliders'
import { useToast } from '../components/Toast'
import { CameraIcon, CafeIcon, ClockIcon } from '../components/icons'
import OriginInput from '../components/OriginInput'

const DRINK_TYPES = Object.keys(CAFE_DRINK_TYPE_LABELS) as CafeDrinkType[]
const DRINK_SIZES = Object.keys(CAFE_DRINK_SIZE_LABELS) as CafeDrinkSize[]

// ─── 過去の記録ピッカー ────────────────────────────────────────────────────────

function PastVisitPicker({
  visits,
  onSelect,
  onClose,
}: {
  visits: CafeVisit[]
  onSelect: (v: CafeVisit) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')

  const filtered = query
    ? visits.filter(v =>
        v.cafeName.toLowerCase().includes(query.toLowerCase()) ||
        (v.drinkName?.toLowerCase().includes(query.toLowerCase()) ?? false),
      )
    : visits

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col justify-end">
      <div className="bg-[#1a0a05] rounded-t-2xl flex flex-col max-h-[80vh]">
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-[#F7EFE6]">過去の記録から始める</h3>
            <button type="button" onClick={onClose} className="text-[#6b5a4a] text-2xl leading-none">×</button>
          </div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="カフェ名・ドリンク名で検索..."
            autoFocus
            className="w-full bg-[#2E2018] text-[#F7EFE6] rounded-xl px-4 py-2.5 text-sm outline-none placeholder-[#4a3a2a]"
          />
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-8">
          {filtered.length === 0 ? (
            <p className="text-[#4a3a2a] text-sm text-center py-8">記録が見つかりません</p>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              {filtered.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { onSelect(v); onClose() }}
                  className="w-full bg-[#2E2018] rounded-xl px-4 py-3 text-left active:opacity-80"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-[#F7EFE6]">{v.cafeName}</span>
                    <span className="text-xs text-[#6b5a4a]">{formatBrewDateShort(v.visitedAt)}</span>
                  </div>
                  {(v.drinkName || v.drinkType) && (
                    <p className="text-xs text-[#CE9C68]">
                      {v.drinkName ?? ''}
                      {v.drinkType ? ` · ${CAFE_DRINK_TYPE_LABELS[v.drinkType]}` : ''}
                      {v.size ? ` · ${v.size}` : ''}
                    </p>
                  )}
                  {v.rating && (
                    <p className="text-xs text-[#CE9C68] mt-0.5 tracking-tight">
                      {'★'.repeat(v.rating)}{'☆'.repeat(5 - v.rating)}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CafeVisitPage ────────────────────────────────────────────────────────────

export default function CafeVisitPage() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { id: editId } = useParams<{ id?: string }>()
  const isEdit = Boolean(editId)

  const [visitedAt,      setVisitedAt]      = useState(() => toDatetimeLocal(new Date().toISOString()))
  const [cafeName,       setCafeName]       = useState('')
  const [drinkName,      setDrinkName]      = useState('')
  const [drinkType,      setDrinkType]      = useState<CafeDrinkType | undefined>()
  const [size,           setSize]           = useState<CafeDrinkSize | undefined>()
  const [beanOrigin,     setBeanOrigin]     = useState('')
  const [rating,         setRating]         = useState(0)
  const [flavors,        setFlavors]        = useState<string[]>([])
  const [decaf,          setDecaf]          = useState(false)
  const [scene,          setScene]          = useState('')
  const [drinkStyle,     setDrinkStyle]     = useState<string[]>([])
  const [cupping,        setCupping]        = useState<CuppingScores>({})
  const [price,          setPrice]          = useState<number | undefined>()
  const [note,           setNote]           = useState('')
  const [showDetail,     setShowDetail]     = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [photoDataUrl,   setPhotoDataUrl]   = useState<string | undefined>()
  const photoInputRef = useRef<HTMLInputElement>(null)

  // 過去記録
  const [pastVisits,     setPastVisits]     = useState<CafeVisit[]>([])
  const [cafeNames,      setCafeNames]      = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showPicker,     setShowPicker]     = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // 「よく使う」フレーバー（全ブリュー＋カフェ記録から集計）
  const [frequentFlavors, setFrequentFlavors] = useState<string[]>([])
  useEffect(() => {
    Promise.all([getAllBrews(), getAllCafeVisits()])
      .then(([brews, visits]) => setFrequentFlavors(calcFrequentFlavors([...brews, ...visits])))
      .catch(() => {})
  }, [])

  useEffect(() => {
    getAllCafeVisits().then(visits => {
      const sorted = [...visits].reverse() // 新しい順
      setPastVisits(sorted)
      // ユニークなカフェ名（出現順）
      const seen = new Set<string>()
      const names: string[] = []
      for (const v of sorted) {
        if (!seen.has(v.cafeName)) { seen.add(v.cafeName); names.push(v.cafeName) }
      }
      setCafeNames(names)
    })
  }, [])

  // 編集モードの初期値
  useEffect(() => {
    if (!editId) return
    getCafeVisit(editId).then(v => {
      if (!v) return
      setVisitedAt(toDatetimeLocal(v.visitedAt))
      setCafeName(v.cafeName)
      setDrinkName(v.drinkName ?? '')
      setDrinkType(v.drinkType)
      setSize(v.size)
      setBeanOrigin(v.beanOrigin ?? '')
      setRating(v.rating ?? 0)
      setFlavors(v.flavors)
      setDecaf(v.decaf ?? false)
      setScene(v.scene ?? '')
      setDrinkStyle(v.drinkStyle ?? [])
      setCupping(v.cupping ?? {})
      setPrice(v.price)
      setNote(v.note ?? '')
      setPhotoDataUrl(v.photoDataUrl)
    })
  }, [editId])

  // 過去の記録をベースに全フィールドを埋める（評価・カッピング・メモはリセット）
  const fillFromVisit = (v: CafeVisit) => {
    setCafeName(v.cafeName)
    setDrinkName(v.drinkName ?? '')
    setDrinkType(v.drinkType)
    setSize(v.size)
    setBeanOrigin(v.beanOrigin ?? '')
    setFlavors(v.flavors)
    setDecaf(v.decaf ?? false)
    setDrinkStyle(v.drinkStyle ?? [])
    setPrice(v.price)
    // 評価・カッピング・メモ・シーンはこの訪問固有のためリセット
    setRating(0)
    setCupping({})
    setNote('')
    setScene('')
  }

  // カフェ名候補（入力に一致・未選択）
  const suggestions = cafeNames.filter(n =>
    cafeName ? n.toLowerCase().includes(cafeName.toLowerCase()) && n !== cafeName : true,
  ).slice(0, 6)

  // オートコンプリートで選択
  const selectSuggestion = (name: string) => {
    setCafeName(name)
    setShowSuggestions(false)
    // その店の直近の訪問でドリンク情報を埋める
    const latest = pastVisits.find(v => v.cafeName === name)
    if (latest) fillFromVisit(latest)
  }

  const estimatedCaffeine = estimateCafeCaffeine(drinkType, size, decaf)

  const handleSave = async () => {
    if (!cafeName.trim() || saving) return
    setSaving(true)

    const fields: Partial<CafeVisit> = {
      visitedAt:      fromDatetimeLocal(visitedAt),
      cafeName:       cafeName.trim(),
      drinkName:      drinkName.trim() || undefined,
      drinkType,
      size,
      beanOrigin:     beanOrigin.trim() || undefined,
      rating:         rating || undefined,
      flavors,
      decaf:          decaf || undefined,
      scene:          scene || undefined,
      drinkStyle:     drinkStyle.length > 0 ? drinkStyle : undefined,
      cupping,
      cuppingAverage: calcCuppingAverage(cupping),
      caffeineAmount: estimateCafeCaffeine(drinkType, size, decaf),
      price,
      photoDataUrl,
      note:           note.trim() || undefined,
    }

    try {
      if (isEdit) {
        const existing = await getCafeVisit(editId!)
        if (existing) await putCafeVisit({ ...existing, ...fields })
        setSaving(false)
        navigate(`/cafe/${editId}`, { replace: true })
        showToast('変更を保存しました', { type: 'success' })
      } else {
        await putCafeVisit({ id: newId(), createdAt: nowISO(), ...fields } as CafeVisit)
        setSaving(false)
        navigate('/library', { state: { tab: 'cafe' } })
        showToast('カフェの一杯を記録しました', { type: 'success' })
      }
    } catch {
      setSaving(false)
      showToast('保存に失敗しました。ストレージの空き容量を確認してください', { type: 'error' })
    }
  }

  return (
    <>
      <div className="flex flex-col flex-1 px-4 py-5 gap-4 overflow-y-auto">
        {isEdit && (
          <button type="button" onClick={() => navigate(-1)} className="text-[#CE9C68] text-sm -mb-2">
            ← 戻る
          </button>
        )}
        <h2 className="text-xl font-semibold text-[#F7EFE6]">
          {isEdit ? 'カフェ記録を編集' : 'カフェを記録する'}
        </h2>

        {/* 過去記録ベースボタン（新規のときのみ・過去記録がある場合） */}
        {!isEdit && pastVisits.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="w-full border border-dashed border-[#CE9C68]/40 text-[#CE9C68] py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:opacity-70"
          >
            <ClockIcon size={16} />
            <span>過去の記録から始める</span>
          </button>
        )}

        {/* 訪問日時 */}
        <div className="bg-[#2E2018] rounded-xl p-4">
          <p className="text-xs text-[#CE9C68] mb-2">訪問日時</p>
          <input
            type="datetime-local"
            value={visitedAt}
            onChange={e => setVisitedAt(e.target.value)}
            className="w-full bg-transparent text-[#F7EFE6] text-sm outline-none"
          />
        </div>

        {/* カフェ名（オートコンプリート付き） */}
        <div className="bg-[#2E2018] rounded-xl p-4 relative">
          <p className="text-xs text-[#CE9C68] mb-2">カフェ名 <span className="text-[#993C1D]">*</span></p>
          <input
            ref={nameInputRef}
            type="text"
            value={cafeName}
            onChange={e => { setCafeName(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="カフェの名前を入力"
            className="w-full bg-transparent text-[#F7EFE6] outline-none placeholder-[#4a3a2a] text-base"
          />
          {/* 候補ドロップダウン */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-[#3e3020] rounded-xl overflow-hidden z-20 shadow-xl border border-[#2e2018]">
              {suggestions.map(name => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={() => selectSuggestion(name)}
                  className="w-full px-4 py-3 text-left text-sm text-[#F7EFE6] border-b border-[#2e2018] last:border-0 hover:bg-[#2e2018] active:bg-[#2e2018] flex items-center gap-2"
                >
                  <CafeIcon size={14} className="text-[#6b5a4a] shrink-0" />
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ドリンク名 */}
        <div className="bg-[#2E2018] rounded-xl p-4">
          <p className="text-xs text-[#CE9C68] mb-2">ドリンク名</p>
          <input
            type="text"
            value={drinkName}
            onChange={e => setDrinkName(e.target.value)}
            placeholder="例: エチオピア ナチュラル"
            className="w-full bg-transparent text-[#F7EFE6] outline-none placeholder-[#4a3a2a] text-base"
          />
        </div>

        {/* ドリンクの種類 */}
        <div className="bg-[#2E2018] rounded-xl p-4">
          <p className="text-xs text-[#CE9C68] mb-3">ドリンクの種類</p>
          <div className="flex flex-wrap gap-2">
            {DRINK_TYPES.map(t => (
              <button key={t} type="button"
                onClick={() => setDrinkType(drinkType === t ? undefined : t)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  drinkType === t ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#3e3020] text-[#CE9C68]'
                }`}
              >
                {CAFE_DRINK_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button type="button"
              onClick={() => setDecaf(v => !v)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                decaf ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#3e3020] text-[#CE9C68]'
              }`}
            >
              デカフェ
            </button>
            <span className="text-[10px] text-[#6b5a4a]">推定カフェインを約1/10にします</span>
          </div>
        </div>

        {/* サイズ */}
        <div className="bg-[#2E2018] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-[#CE9C68]">サイズ</p>
            {estimatedCaffeine != null && (
              <p className="text-xs text-[#CE9C68]">
                推定カフェイン: <span className="text-[#F7EFE6] font-semibold">{estimatedCaffeine}mg</span>
              </p>
            )}
          </div>
          <div className="flex gap-3">
            {DRINK_SIZES.map(s => (
              <button key={s} type="button"
                onClick={() => setSize(size === s ? undefined : s)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  size === s ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#3e3020] text-[#CE9C68]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 評価 */}
        <div className="bg-[#2E2018] rounded-xl p-4">
          <p className="text-xs text-[#CE9C68] mb-3">評価</p>
          <StarRating value={rating} onChange={setRating} />
        </div>

        {/* フレーバー */}
        <div className="bg-[#2E2018] rounded-xl p-4">
          <p className="text-xs text-[#CE9C68] mb-3">フレーバー</p>
          <FlavorChips selected={flavors} onChange={setFlavors} frequent={frequentFlavors} />
        </div>

        {/* シーン・飲み方 */}
        <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-4">
          <div>
            <p className="text-xs text-[#CE9C68] mb-3">シーン</p>
            <div className="flex flex-wrap gap-2">
              {SCENE_OPTIONS.map(s => (
                <button key={s} type="button"
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
                <button key={s} type="button"
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

        {/* 詳細 */}
        <button type="button" onClick={() => setShowDetail(v => !v)}
          className="flex items-center justify-between w-full text-[#CE9C68] py-1"
        >
          <span className="text-sm">詳細を入力</span>
          <span className="text-xs">{showDetail ? '▲ 閉じる' : '▽ 開く'}</span>
        </button>

        {showDetail && (
          <div className="flex flex-col gap-4">
            {/* カッピング */}
            <div className="bg-[#2E2018] rounded-xl p-4">
              <p className="text-xs text-[#CE9C68] mb-4">カッピング</p>
              <CuppingSliders value={cupping} onChange={setCupping} />
            </div>

            {/* 豆の産地 */}
            <div className="bg-[#2E2018] rounded-xl p-4">
              <p className="text-xs text-[#CE9C68] mb-2">豆の産地</p>
              <OriginInput
                value={beanOrigin}
                onChange={setBeanOrigin}
                variant="bare"
                recentOrigins={pastVisits.map(v => v.beanOrigin).filter((o): o is string => Boolean(o))}
              />
            </div>

            {/* 価格 */}
            <div className="bg-[#2E2018] rounded-xl p-4">
              <p className="text-xs text-[#CE9C68] mb-2">価格</p>
              <div className="flex items-center gap-2">
                <span className="text-[#CE9C68] text-sm">¥</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={price ?? ''}
                  onChange={e => setPrice(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="—"
                  className="flex-1 bg-transparent text-[#F7EFE6] outline-none placeholder-[#4a3a2a] text-lg font-semibold tabular-nums"
                />
              </div>
            </div>

            {/* 写真 */}
            <div className="bg-[#2E2018] rounded-xl p-4">
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

            {/* メモ */}
            <div className="bg-[#2E2018] rounded-xl p-4">
              <p className="text-xs text-[#CE9C68] mb-2">メモ</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="今日のカフェについて..."
                rows={3}
                className="w-full bg-transparent text-[#F7EFE6] outline-none resize-none placeholder-[#4a3a2a] text-sm"
              />
            </div>
          </div>
        )}

        {/* 保存ボタン */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!cafeName.trim() || saving}
          className="w-full bg-[#993C1D] text-[#F7EFE6] py-4 rounded-2xl text-base font-semibold active:opacity-80 disabled:opacity-40 mt-2 mb-2"
        >
          {saving ? '保存中...' : isEdit ? '変更を保存する' : 'この訪問を記録する'}
        </button>
      </div>

      {/* 過去の記録ピッカー */}
      {showPicker && (
        <PastVisitPicker
          visits={pastVisits}
          onSelect={fillFromVisit}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
