import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Brew, Bean, Recipe, CuppingScores } from '../db'
import {
  getBrew, getBean, getAllEquipment, getRecipe, deleteBrew, putBrew,
  getAllBrews, getAllCafeVisits, calcCuppingAverage, calcFrequentFlavors,
  calcRatio, formatBrewDate, ROAST_LEVEL_LABELS, daysSinceRoast, getBrewEquipmentIds,
  BREW_METHOD_LABELS,
  withSaveTimeout, saveErrorMessage,
} from '../db'
import PhotoLightbox from '../components/PhotoLightbox'
import StarRating from '../components/brew/StarRating'
import CuppingSliders from '../components/brew/CuppingSliders'
import FlavorChips from '../components/brew/FlavorChips'
import SaveAnimation from '../components/brew/SaveAnimation'
import RecordDisk from '../components/brew/RecordDisk'
import { useToast, notifyDataRestored } from '../components/Toast'
import { CupIcon, MusicIcon } from '../components/icons'
import DetailJacket from '../components/library/DetailJacket'
import { jacketColor } from '../components/library/jacketColor'

// 見出しは日本語を主に、英字は小さく添えるだけ（ライナーノーツらしさは出すが、
// 何の欄かは日本語が受け持つ。A面/B面 と同じ作法）
function Section({ title, en, children }: { title: string; en?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#2E2018] rounded-xl p-4">
      <p className="text-xs text-[#CE9C68] mb-3 flex items-baseline gap-2">
        <span className="font-semibold tracking-wider">{title}</span>
        {en && <span className="text-[10px] text-[#A8916F] tracking-[0.2em]">{en}</span>}
      </p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1.5 border-b border-[#3e3020] last:border-0">
      <span className="text-xs text-[#A8916F] shrink-0">{label}</span>
      <span className="text-sm text-[#F7EFE6] font-medium tabular-nums text-right">{value}</span>
    </div>
  )
}

const CUPPING_LABELS = {
  acidity: '酸味', sweetness: '甘み', bitterness: '苦味',
  body: 'ボディ', aftertaste: '後味',
} as const

export default function BrewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const showToast = useToast()

  const [brew, setBrew] = useState<Brew | null>(null)
  const [bean, setBean] = useState<Bean | undefined>()
  const [equipmentNames, setEquipmentNames] = useState<string[]>([])
  const [recipe, setRecipe] = useState<Recipe | undefined>()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  // 後から評価を足す（未評価＝まだ針を落としていない盤）
  const [rateValue, setRateValue] = useState(0)
  const [savingRate, setSavingRate] = useState(false)
  const [showRateAnim, setShowRateAnim] = useState(false)
  // 星だけでさっと付けたい人のため、フレーバー・カッピングは折りたたみ（既定は閉じ）
  const [showRateDetail, setShowRateDetail] = useState(false)
  const [rateFlavors, setRateFlavors] = useState<string[]>([])
  const [rateCupping, setRateCupping] = useState<CuppingScores>({})
  const [frequentFlavors, setFrequentFlavors] = useState<string[]>([])

  useEffect(() => {
    if (!id) return
    getBrew(id).then(b => {
      if (!b) { navigate('/library', { replace: true }); return }
      setBrew(b)
      // 後付け評価の初期値は既存の値（条件のみ保存なら空）を引き継ぐ。上書きで失わない
      setRateFlavors(b.flavors ?? [])
      setRateCupping(b.cupping ?? {})
      if (b.beanId) getBean(b.beanId).then(setBean)
      const eqIds = getBrewEquipmentIds(b)
      if (eqIds.length > 0) {
        getAllEquipment().then(all => {
          const byId = new Map(all.map(e => [e.id, e]))
          setEquipmentNames(eqIds.map(x => byId.get(x)?.name).filter((n): n is string => Boolean(n)))
        })
      }
      if (b.recipeId) getRecipe(b.recipeId).then(setRecipe)
    })
  }, [id, navigate])

  // 後付け評価のフレーバー候補（記録画面と同じ頻度順の「よく使う」行）
  useEffect(() => {
    Promise.all([getAllBrews(), getAllCafeVisits()])
      .then(([bs, vs]) => setFrequentFlavors(calcFrequentFlavors([...bs, ...vs])))
      .catch(() => {})
  }, [])

  if (!brew) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[#6b5a4a] text-sm">読み込み中...</p>
      </div>
    )
  }

  const hasCupping = Object.values(brew.cupping).some(v => v !== undefined)

  const handleDelete = async () => {
    const snapshot = brew
    try {
      await deleteBrew(brew.id)
    } catch {
      showToast('削除に失敗しました', { type: 'error' })
      return
    }
    navigate('/library', { replace: true })
    showToast('記録を削除しました', {
      action: {
        label: '取り消す',
        onClick: () => {
          putBrew(snapshot)
            .then(() => { notifyDataRestored(); showToast('削除を取り消しました', { type: 'success' }) })
            .catch(() => showToast('復元に失敗しました', { type: 'error' }))
        },
      },
    })
  }

  const handleReproduce = () => {
    navigate('/brew', { state: { fromBrewId: brew.id } })
  }

  const handleEdit = () => {
    navigate(`/brew/edit/${brew.id}`)
  }

  // 未評価の一杯に星を付ける = 針を落として再生する。集計は自動で反映される（未評価は元々除外）
  const handleAddRating = async () => {
    if (!brew || !rateValue) return
    setSavingRate(true)
    try {
      const updated = {
        ...brew,
        rating: rateValue,
        flavors: rateFlavors,
        cupping: rateCupping,
        cuppingAverage: calcCuppingAverage(rateCupping),
      }
      await withSaveTimeout(putBrew(updated))
      setBrew(updated)
      setSavingRate(false)
      setShowRateAnim(true) // 針を落とすフル演出
    } catch (e) {
      console.error('[megroove] 評価の保存に失敗しました:', e)
      setSavingRate(false)
      showToast(saveErrorMessage(e), { type: 'error' })
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2018]">
        <button
          type="button"
          onClick={() => navigate('/library')}
          className="text-[#CE9C68] text-sm"
        >
          ← ライブラリ
        </button>
        <button
          type="button"
          onClick={handleEdit}
          className="text-[#CE9C68] text-sm font-medium"
        >
          編集
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
        {/* ジャケット。1杯の記録を「1枚のレコード」として提示する */}
        <DetailJacket
          photoUrl={brew.photoDataUrl}
          color={jacketColor(bean?.origin || bean?.name, bean?.roastLevel)}
          title={bean?.name ?? (brew.method === 'drip_bag' ? '銘柄なし' : 'ホームブリュー')}
          subtitle={bean && brew.method !== 'drip_bag'
            ? [
                bean.origin,
                ROAST_LEVEL_LABELS[bean.roastLevel],
                bean.roastedAt ? `焙煎から${daysSinceRoast(bean.roastedAt)}日` : null,
              ].filter(Boolean).join(' · ')
            : undefined}
          dateLabel={formatBrewDate(brew.brewedAt)}
          rating={brew.rating}
          onOpenPhoto={brew.photoDataUrl ? () => setLightboxOpen(true) : undefined}
        />
        {lightboxOpen && brew.photoDataUrl && (
          <PhotoLightbox src={brew.photoDataUrl} onClose={() => setLightboxOpen(false)} />
        )}

        {/* 未評価＝まだ針を落としていない盤。ここで星をつけると「再生」される（急かさず、楽しみとして） */}
        {!brew.rating && (
          <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-[#CE9C68] text-sm font-medium">
              <RecordDisk size={26} />
              <span>まだ針を落としていない一杯</span>
            </div>
            <p className="text-xs text-[#A8916F] text-center leading-relaxed">
              飲んでみて、どうでしたか？<br />星をつけると、この盤に針が落ちます
            </p>
            <StarRating value={rateValue} onChange={setRateValue} />

            {/* 詳しく評価する（フレーバー＋カッピング）。既定は閉じ＝星だけでも完了できる */}
            <button
              type="button"
              onClick={() => setShowRateDetail(v => !v)}
              className="text-xs text-[#A8916F] min-h-11 px-2 active:opacity-70"
            >
              {showRateDetail ? '▲ 閉じる' : '▽ 詳しく評価する'}
            </button>

            {showRateDetail && (
              <div className="w-full flex flex-col gap-4 pt-1">
                <div>
                  <p className="text-xs text-[#CE9C68] mb-2">フレーバー</p>
                  <FlavorChips selected={rateFlavors} onChange={setRateFlavors} frequent={frequentFlavors} />
                </div>
                <div>
                  <p className="text-xs text-[#CE9C68] mb-2">カッピング</p>
                  <CuppingSliders value={rateCupping} onChange={setRateCupping} />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddRating}
              disabled={!rateValue || savingRate}
              className="w-full bg-[#993C1D] text-[#F7EFE6] py-3 rounded-xl text-sm font-semibold active:opacity-80 disabled:opacity-40"
            >
              {savingRate ? '保存中...' : '針を落とす'}
            </button>
          </div>
        )}

        {/* ── クレジット: 何を使って淹れたか ─────────────────────────────── */}
        <Section title="素材と道具" en="CREDITS">
          {bean && brew.method !== 'drip_bag' && (
            <>
              {bean.origin && <Row label="産地" value={bean.origin} />}
              {bean.farm && <Row label="農園" value={bean.farm} />}
              {bean.variety && <Row label="品種" value={bean.variety} />}
              {bean.process && <Row label="精製" value={bean.process} />}
            </>
          )}
          {recipe && <Row label="レシピ" value={recipe.name} />}
          {equipmentNames.length > 0 && <Row label="器具" value={equipmentNames.join('・')} />}
          {brew.method === 'drip_bag' && <Row label="抽出方法" value={BREW_METHOD_LABELS.drip_bag} />}
          {!bean && !recipe && equipmentNames.length === 0 && brew.method !== 'drip_bag' && (
            <p className="text-sm text-[#A8916F]">記録されていません</p>
          )}
        </Section>

        {/* ── 録音データ: どう淹れたか ──────────────────────────────────── */}
        <Section title="抽出データ" en="RECORDING">
          {brew.doseG !== undefined && brew.waterG !== undefined ? (
            <Row
              label="粉量 / 湯量 / 比率"
              value={`${brew.doseG}g / ${brew.waterG}g / ${calcRatio(brew.doseG, brew.waterG)}`}
            />
          ) : (
            brew.waterG !== undefined && <Row label="湯量" value={`${brew.waterG}g`} />
          )}
          {brew.grindSize !== undefined && <Row label="挽き目" value={brew.grindSize} />}
          {brew.tempC !== undefined && <Row label="湯温" value={`${brew.tempC}°C`} />}
          {brew.totalTimeSec !== undefined && (
            <Row
              label="総抽出時間"
              value={`${Math.floor(brew.totalTimeSec / 60)}:${String(brew.totalTimeSec % 60).padStart(2, '0')}`}
            />
          )}
          {brew.pourCount !== undefined && <Row label="注湯回数" value={`${brew.pourCount}回`} />}
        </Section>

        {/* ── レビュー: どう感じたか ────────────────────────────────────── */}
        {(brew.flavors.length > 0 || hasCupping || brew.scene || (brew.drinkStyle?.length ?? 0) > 0) && (
          <Section title="味わいの記録" en="REVIEW">
            {brew.flavors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {brew.flavors.map(f => (
                  <span key={f} className="bg-[#3e3020] text-[#CE9C68] text-sm px-3 py-1 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            )}

            {(brew.scene || (brew.drinkStyle?.length ?? 0) > 0) && (
              <div className={`flex flex-wrap gap-2 ${brew.flavors.length > 0 ? 'mt-2' : ''}`}>
                {brew.scene && (
                  <span className="bg-[#993C1D]/25 text-[#CE9C68] text-sm px-3 py-1 rounded-full">
                    {brew.scene}
                  </span>
                )}
                {brew.drinkStyle?.map(st => (
                  <span key={st} className="bg-[#3e3020] text-[#CE9C68] text-sm px-3 py-1 rounded-full">
                    {st}
                  </span>
                ))}
              </div>
            )}

            {hasCupping && (
              <div className={brew.flavors.length > 0 || brew.scene ? 'mt-3 pt-1' : ''}>
                {(Object.entries(CUPPING_LABELS) as [keyof typeof CUPPING_LABELS, string][]).map(
                  ([key, label]) =>
                    brew.cupping[key] !== undefined ? (
                      <Row key={key} label={label} value={brew.cupping[key]!.toFixed(1)} />
                    ) : null
                )}
                {brew.cuppingAverage !== undefined && (
                  <div className="mt-2 pt-2 border-t border-[#3e3020] flex justify-between">
                    <span className="text-xs text-[#CE9C68]">平均</span>
                    <span className="text-sm text-[#993C1D] font-semibold">
                      {brew.cuppingAverage.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {/* ── ライナーノーツ: その日の言葉と音楽 ────────────────────────── */}
        {(brew.note || brew.musicTitle || brew.musicArtist) && (
          <Section title="その日のこと" en="LINER NOTES">
            {brew.note && (
              <p className="text-sm text-[#F7EFE6] whitespace-pre-wrap leading-relaxed">{brew.note}</p>
            )}
            {(brew.musicTitle || brew.musicArtist) && (
              <div className={`flex items-start gap-2 ${brew.note ? 'mt-3 pt-3 border-t border-[#3e3020]' : ''}`}>
                <span className="text-[#CE9C68] mt-0.5 shrink-0"><MusicIcon size={15} /></span>
                <div className="min-w-0">
                  {brew.musicTitle && (
                    <p className="text-sm text-[#F7EFE6] break-words">{brew.musicTitle}</p>
                  )}
                  {brew.musicArtist && (
                    <p className="text-xs text-[#CE9C68] mt-0.5 break-words">{brew.musicArtist}</p>
                  )}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* アクションボタン */}
        <div className="flex flex-col gap-3 mt-2 mb-2">
          <button
            type="button"
            onClick={handleReproduce}
            className="w-full bg-[#993C1D] text-[#F7EFE6] py-4 rounded-2xl font-semibold active:opacity-80 flex items-center justify-center gap-2"
          >
            <CupIcon size={20} />
            この条件で淹れる
          </button>

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-[#6b5a4a] text-sm py-2"
            >
              この記録を削除
            </button>
          ) : (
            <div className="bg-[#2E2018] rounded-xl p-4 flex flex-col gap-3">
              <p className="text-sm text-[#F7EFE6] text-center">この記録を削除しますか？</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-[#3e3020] text-[#CE9C68] text-sm"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 py-3 rounded-xl bg-red-900 text-white text-sm font-semibold"
                >
                  削除する
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showRateAnim && (
        <SaveAnimation brewCount={0} rated message="針を落としました" onDone={() => setShowRateAnim(false)} />
      )}
    </div>
  )
}
