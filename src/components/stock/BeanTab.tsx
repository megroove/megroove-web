import { useState, useEffect } from 'react'
import type { Bean, Brew, RoastLevel } from '../../db'
import {
  getAllBeans, getAllBrews, putBean, deleteBean, newId, nowISO,
  ROAST_LEVEL_LABELS, daysSinceRoast, formatBeanRemaining,
  withSaveTimeout, saveErrorMessage, isBlendBean, beanLineageId, beanBagNumber,
  splitNotes, formatBrewGuide,
} from '../../db'
import { Field, TextInput, NumberInput, DateInput, ChipSelect, DeleteButton, ModalSheet, SaveButton } from './FormHelpers'
import { useToast } from '../Toast'
import OriginInput from '../OriginInput'
import PhotoField from '../PhotoField'
import { ClockIcon } from '../icons'
import EmptyState from '../EmptyState'
import LabelScanSection from './LabelScanSection'
import { applyLabelToForm, type BeanLabelResult, type LabelFieldKey } from './labelScan'
import { isLabelScanEnabled } from './labelScanClient'

// AI が下書きに入れた欄の印（確かめてから保存してもらうため）
function AiMark() {
  return (
    <span className="ml-1.5 inline-block align-middle text-[10px] leading-none px-1.5 py-0.5 rounded-full border border-[#CE9C68]/60 text-[#CE9C68]">
      AI<span className="sr-only">が読み取った値</span>
    </span>
  )
}

const ROAST_LEVELS: RoastLevel[] = ['light', 'light-medium', 'medium', 'medium-dark', 'dark']

const PROCESS_PRESETS = ['ウォッシュト', 'ナチュラル', 'ハニー', 'アナエロビック']

function BeanForm({
  initial, repurchaseOf, recentOrigins, recentFarms, recentVarieties, recentRoasters,
  onSave, onDelete, onCancel, onRepurchase,
}: {
  initial?: Bean
  /**
   * 買い直し。これが入っていると「同じ商品の新しい袋」を作る。
   * 商品の属性（名前・産地・品種・精製・焙煎度・内容量・ロースター・フレーバー・おすすめの淹れ方）は引き継ぎ、
   * 袋の属性（焙煎日・在庫メモ）は空にする。
   */
  repurchaseOf?: Bean
  recentOrigins: string[]
  recentFarms: string[]
  recentVarieties: string[]
  recentRoasters: string[]
  /** 第2引数は「前の袋を飲み切りにした」場合のその袋 */
  onSave: (b: Bean, finishedPrevious?: Bean) => void
  onDelete?: () => void
  onCancel: () => void
  onRepurchase?: () => void
}) {
  // 買い直しは「新しい袋」なので、引き継ぐ値は商品の属性だけ
  const base = initial ?? repurchaseOf
  const todayISO = new Date().toISOString().slice(0, 10)
  const [name,        setName]        = useState(base?.name          ?? '')
  const [roastLevel,  setRoastLevel]  = useState<RoastLevel>(base?.roastLevel ?? 'medium')
  const [roastedAt,   setRoastedAt]   = useState(initial?.roastedAt   ?? '')
  const [purchasedAt, setPurchasedAt] = useState(
    initial?.purchasedAt ?? (repurchaseOf ? todayISO : ''),
  )
  const [amountG,     setAmountG]     = useState<number | undefined>(base?.initialAmountG)
  const [finished,    setFinished]    = useState(Boolean(initial?.finishedAt))
  const [origin,      setOrigin]      = useState(base?.origin        ?? '')
  // ブレンドの構成産地。空配列＝シングル（既定）。比率は持たない（§5）
  const [blend,       setBlend]       = useState<string[]>(base?.origins ?? [])
  const [farm,        setFarm]        = useState(base?.farm          ?? '')
  const [variety,     setVariety]     = useState(base?.variety       ?? '')
  const [process,     setProcess]     = useState(base?.process       ?? '')
  const [decaf,       setDecaf]       = useState(base?.decaf         ?? false)
  const [stockNote,   setStockNote]   = useState(initial?.stockNote   ?? '')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(base?.photoDataUrl)
  const [roaster,     setRoaster]     = useState(base?.roaster       ?? '')
  const [notesText,   setNotesText]   = useState((base?.flavorNotes ?? []).join('、'))
  const [guideText,   setGuideText]   = useState(base?.brewGuide?.text ?? '')
  const [guideDose,   setGuideDose]   = useState<number | undefined>(base?.brewGuide?.doseG)
  const [guideWater,  setGuideWater]  = useState<number | undefined>(base?.brewGuide?.waterG)
  const [guideTemp,   setGuideTemp]   = useState<number | undefined>(base?.brewGuide?.tempC)
  // 焙煎度は常に何か選ばれているので、新規でまだ触っていないあいだだけ「空」とみなす（AI の当てはめ用）
  const [roastTouched, setRoastTouched] = useState(Boolean(base))
  const [aiFilled,    setAiFilled]    = useState<Set<LabelFieldKey>>(new Set())
  const ai = (key: LabelFieldKey, label: string) => <>{label}{aiFilled.has(key) && <AiMark />}</>
  // 買い直したら前の袋は終わっている方が多いので既定 ON。並行して開けている人は外せる
  const [finishPrev,  setFinishPrev]  = useState(true)
  const [saving,      setSaving]      = useState(false)
  const showToast = useToast()

  // ラベルの解析結果を、空いている欄にだけ下書きとして入れる。入れた欄の数を返す
  const handleLabelResult = (result: BeanLabelResult): number => {
    const { patch, filled } = applyLabelToForm({
      name, roaster, origin, blend, farm, variety, process, roastLevel,
      roastLevelIsDefault: !roastTouched, notesText, roastedAt, amountG,
      guideText, guideDose, guideWater, guideTemp,
    }, result)
    if (patch.name !== undefined) setName(patch.name)
    if (patch.roaster !== undefined) setRoaster(patch.roaster)
    if (patch.origin !== undefined) setOrigin(patch.origin)
    if (patch.blend !== undefined) setBlend(patch.blend)
    if (patch.farm !== undefined) setFarm(patch.farm)
    if (patch.variety !== undefined) setVariety(patch.variety)
    if (patch.process !== undefined) setProcess(patch.process)
    if (patch.roastLevel !== undefined) { setRoastLevel(patch.roastLevel); setRoastTouched(true) }
    if (patch.notesText !== undefined) setNotesText(patch.notesText)
    if (patch.roastedAt !== undefined) setRoastedAt(patch.roastedAt)
    if (patch.amountG !== undefined) setAmountG(patch.amountG)
    if (filled.includes('guide')) {
      setGuideText(patch.guideText ?? '')
      setGuideDose(patch.guideDose)
      setGuideWater(patch.guideWater)
      setGuideTemp(patch.guideTemp)
    }
    setAiFilled(prev => new Set([...prev, ...filled]))
    return filled.length
  }

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    // ID生成（crypto.randomUUID）も try の内側に入れる。安全でないコンテキスト（http）では
    // ここで例外になり、外に出すとボタンが「保存中...」のまま無言で固まる
    const blendClean = blend.map(o => o.trim()).filter(Boolean)
    let saved: Bean | null = null
    let archived: Bean | null = null
    try {
      const bean: Bean = {
        id:         initial?.id ?? newId(),
        name:       name.trim(),
        roastLevel,
        roastedAt:   roastedAt   || undefined,
        purchasedAt: purchasedAt || undefined,
        initialAmountG: amountG,
        finishedAt:  finished ? (initial?.finishedAt ?? nowISO()) : undefined,
        // ブレンドなら代表産地（先頭）を origin に、構成産地を origins に入れる。
        // こうすると表示系（ジャケットの色・一覧の見出し）は従来どおり動く
        origin:      (blendClean[0] ?? origin.trim()) || undefined,
        origins:     blendClean.length >= 2 ? blendClean : undefined,
        farm:        farm.trim()      || undefined,
        variety:     variety.trim()   || undefined,
        process:     process.trim()   || undefined,
        decaf:       decaf            || undefined,
        stockNote:   stockNote.trim() || undefined,
        photoDataUrl: photoDataUrl    || undefined,
        roaster:     roaster.trim()   || undefined,
        flavorNotes: splitNotes(notesText).length > 0 ? splitNotes(notesText) : undefined,
        brewGuide:   (() => {
          const g = { text: guideText.trim() || undefined, doseG: guideDose, waterG: guideWater, tempC: guideTemp }
          return formatBrewGuide(g) ? g : undefined
        })(),
        createdAt:  initial?.createdAt ?? nowISO(),
        // 買い直しなら前の袋と同じ系統に紐づける（前の袋は書き換えない）
        lineageId:  repurchaseOf ? beanLineageId(repurchaseOf) : initial?.lineageId,
      }
      await withSaveTimeout(putBean(bean))
      saved = bean
    } catch (e) {
      console.error('[megroove] 豆の保存に失敗しました:', e)
      showToast(saveErrorMessage(e), { type: 'error' })
    }

    // 前の袋を畳むのは別の try にする。ここで失敗しても
    // 新しい袋は保存できているので、それを失わせない
    if (saved && repurchaseOf && finishPrev && !repurchaseOf.finishedAt) {
      try {
        const prev = { ...repurchaseOf, finishedAt: nowISO() }
        await withSaveTimeout(putBean(prev))
        archived = prev
      } catch (e) {
        console.error('[megroove] 前の袋の飲み切りに失敗しました:', e)
        showToast('新しい袋は保存しました。前の袋の飲み切りはストックから設定してください', { type: 'error' })
      }
    }

    setSaving(false)
    if (saved) onSave(saved, archived ?? undefined)
  }

  return (
    <div className="flex flex-col px-4 py-4 gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#F7EFE6]">
          {repurchaseOf ? '同じ豆を買い直す' : initial ? '豆を編集' : '豆を追加'}
        </h3>
        <button type="button" onClick={onCancel} className="text-[#CE9C68] text-sm">閉じる</button>
      </div>

      {repurchaseOf && (
        <div className="bg-[#2E2018] rounded-xl p-3.5 flex flex-col gap-3">
          <p className="text-xs text-[#A8916F] leading-relaxed">
            新しい袋として登録します。焙煎日だけ入れ直してください。
            前の袋の記録と残量はそのまま残ります。
          </p>
          {!repurchaseOf.finishedAt && (
            <label className="flex items-center gap-2.5 min-h-11 cursor-pointer">
              <input
                type="checkbox"
                checked={finishPrev}
                onChange={e => setFinishPrev(e.target.checked)}
                className="w-5 h-5 accent-[#993C1D] shrink-0"
              />
              <span className="text-sm text-[#F7EFE6]">前の袋を飲み切りにする</span>
            </label>
          )}
        </div>
      )}

      {isLabelScanEnabled() && <LabelScanSection listImage={photoDataUrl} onResult={handleLabelResult} />}

      <Field label={ai('name', '名前 *')}>
        <TextInput value={name} onChange={setName} placeholder="例: エチオピア イルガチェフェ" autoFocus />
      </Field>

      <Field label={ai('roaster', 'ロースター')}>
        <OriginInput
          value={roaster} onChange={setRoaster} placeholder="任意（例: ◯◯珈琲焙煎所）"
          recentOrigins={recentRoasters} master={[]} suggestionIcon={<ClockIcon size={13} />}
        />
      </Field>

      <Field label="リスト画像（任意・袋の表面など。一覧のサムネイルになります）">
        <PhotoField
          value={photoDataUrl}
          onChange={setPhotoDataUrl}
          onError={m => showToast(m, { type: 'error' })}
          format="webp"
          emptyLabel="撮影する"
          allowLibrary
        />
      </Field>

      <Field label={ai('roastLevel', '焙煎度')}>
        <ChipSelect
          options={ROAST_LEVELS.map(l => ({ value: l, label: ROAST_LEVEL_LABELS[l] }))}
          value={roastLevel}
          onChange={v => { setRoastLevel(v); setRoastTouched(true) }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={ai('roastedAt', '焙煎日')}><DateInput value={roastedAt}   onChange={setRoastedAt}   /></Field>
        <Field label="購入日"><DateInput value={purchasedAt} onChange={setPurchasedAt} /></Field>
      </div>

      <Field label={ai('amountG', '内容量（g）— 入力すると記録から残量を自動計算')}>
        <NumberInput value={amountG} onChange={setAmountG} placeholder="例: 200" min={1} />
      </Field>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDecaf(v => !v)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            decaf ? 'bg-[#993C1D] text-[#F7EFE6]' : 'bg-[#3e3020] text-[#CE9C68]'
          }`}
        >
          デカフェ
        </button>
        <span className="text-[10px] text-[#6b5a4a]">カフェイン推定を約1/10にします</span>
      </div>

      {initial && (
        <button
          type="button"
          onClick={() => setFinished(v => !v)}
          className={`w-full py-3 rounded-xl text-sm transition-colors ${
            finished
              ? 'bg-[#993C1D] text-[#F7EFE6] font-semibold'
              : 'bg-[#3e3020] text-[#CE9C68]'
          }`}
        >
          {finished ? '✓ 飲み切った（記録画面に表示されません）' : '飲み切りにする'}
        </button>
      )}

      <Field label={ai('origin', blend.length > 0 ? 'ブレンドの産地' : '産地')}>
        {blend.length > 0 ? (
          <div className="flex flex-col gap-2">
            {blend.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <OriginInput
                    value={o}
                    onChange={v => setBlend(b => b.map((x, j) => (j === i ? v : x)))}
                    recentOrigins={recentOrigins}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setBlend(b => b.filter((_, j) => j !== i))}
                  aria-label={`${i + 1}つ目の産地を削除`}
                  className="min-h-11 min-w-11 rounded-lg text-[#A8916F] active:opacity-70"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBlend(b => [...b, ''])}
                className="min-h-11 px-3 rounded-full border border-dashed border-[#CE9C68]/60 text-xs text-[#CE9C68] active:opacity-70"
              >
                + 産地を追加
              </button>
              <button
                type="button"
                onClick={() => { setOrigin(blend.find(o => o.trim())?.trim() ?? origin); setBlend([]) }}
                className="min-h-11 px-3 rounded-full text-xs text-[#A8916F] active:opacity-70"
              >
                シングルに戻す
              </button>
            </div>
            <p className="text-[11px] text-[#A8916F] leading-relaxed">
              分かる範囲で構いません。産地パスポートには「ブレンドで出会った」として記録され、
              あとでシングルで味わうとスタンプが完成します。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <OriginInput value={origin} onChange={setOrigin} recentOrigins={recentOrigins} />
            <button
              type="button"
              onClick={() => setBlend(origin.trim() ? [origin.trim(), ''] : ['', ''])}
              className="self-start min-h-11 text-xs text-[#CE9C68] active:opacity-70"
            >
              + ブレンド（複数の産地）として入力
            </button>
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={ai('farm', '農園')}>
          <OriginInput
            value={farm} onChange={setFarm} placeholder="任意"
            recentOrigins={recentFarms} master={[]} suggestionIcon={<ClockIcon size={13} />}
          />
        </Field>
        <Field label={ai('variety', '品種')}>
          <OriginInput
            value={variety} onChange={setVariety} placeholder="任意"
            recentOrigins={recentVarieties} master={[]} suggestionIcon={<ClockIcon size={13} />}
          />
        </Field>
      </div>

      <Field label={ai('process', '精製方法')}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {PROCESS_PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setProcess(process === p ? '' : p)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  process === p
                    ? 'bg-[#993C1D] text-[#F7EFE6]'
                    : 'bg-[#3e3020] text-[#CE9C68]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <TextInput value={process} onChange={setProcess} placeholder="その他の精製方法は自由入力" />
        </div>
      </Field>

      <Field label={ai('notes', 'フレーバーノート（袋の記載）')}>
        <TextInput value={notesText} onChange={setNotesText} placeholder="任意（例: ジャスミン、ベルガモット）" />
      </Field>

      <Field label={ai('guide', 'おすすめの淹れ方（袋の記載）')}>
        <div className="flex flex-col gap-2">
          <TextInput value={guideText} onChange={setGuideText} placeholder="任意（例: 15g / 220ml / 90℃・中細挽き）" />
          {/* 値が入るとプレースホルダーが消えるので、小さな見出しを常に出す */}
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#A8916F]">粉量（g）</span>
              <NumberInput value={guideDose}  onChange={setGuideDose}  placeholder="任意" min={1} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#A8916F]">湯量（g）</span>
              <NumberInput value={guideWater} onChange={setGuideWater} placeholder="任意" min={1} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#A8916F]">湯温（℃）</span>
              <NumberInput value={guideTemp}  onChange={setGuideTemp}  placeholder="任意" min={1} />
            </label>
          </div>
          <p className="text-[11px] text-[#A8916F] leading-relaxed">
            数値を入れておくと、記録画面からこの条件のレシピを作れます
          </p>
        </div>
      </Field>

      <Field label="在庫メモ">
        <textarea
          value={stockNote}
          onChange={e => setStockNote(e.target.value)}
          placeholder="任意"
          rows={2}
          className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none resize-none placeholder-[#6b5a4a] text-sm"
        />
      </Field>

      <div className="flex flex-col gap-2 pb-6">
        <SaveButton disabled={!name.trim()} saving={saving} onClick={handleSave} />
        {onRepurchase && (
          <button
            type="button"
            onClick={onRepurchase}
            className="min-h-11 rounded-xl border border-[#CE9C68]/50 text-[#CE9C68] text-sm font-medium active:opacity-70"
          >
            同じ豆を買い直す
          </button>
        )}
        {onDelete && <DeleteButton label="この豆を削除" onDelete={onDelete} />}
      </div>
    </div>
  )
}

function BeanRow({ bean, brews, bagNumber, onClick, onFinish, muted }: {
  bean: Bean; brews: Brew[]; bagNumber: number; onClick: () => void
  /** 編集を開かずに飲み切りにする（開封中の豆だけ） */
  onFinish?: () => void
  muted?: boolean
}) {
  const remaining = !bean.finishedAt ? formatBeanRemaining(bean, brews) : null
  return (
    <div className="relative">
    <button
      type="button"
      onClick={onClick}
      className={`w-full bg-[#2E2018] rounded-xl p-4 text-left active:opacity-80 ${muted ? 'opacity-60' : ''} ${onFinish ? 'pr-24' : ''}`}
    >
      <div className="flex gap-3 items-start">
        {bean.photoDataUrl && (
          <img src={bean.photoDataUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-[#3e3020]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-[#F7EFE6] font-medium truncate">{bean.name}</p>
            {/* 何袋目か。リピートしていることが一目で分かる */}
            {bagNumber > 1 && (
              <span className="text-[10px] text-[#CE9C68] border border-[#CE9C68]/40 rounded-full px-1.5 py-0.5 shrink-0">
                {bagNumber}袋目
              </span>
            )}
          </div>
          <p className="text-xs text-[#CE9C68] mt-0.5">
            {ROAST_LEVEL_LABELS[bean.roastLevel]}
            {bean.roastedAt ? ` · 焙煎から${daysSinceRoast(bean.roastedAt)}日` : ''}
            {bean.origin ? ` · ${bean.origin}${isBlendBean(bean) ? ' ほか' : ''}` : ''}
          </p>
          {remaining && (
            <p className="text-xs text-[#6b5a4a] mt-0.5">{remaining}</p>
          )}
          {bean.stockNote && (
            <p className="text-xs text-[#6b5a4a] mt-1 truncate">{bean.stockNote}</p>
          )}
        </div>
      </div>
    </button>
    {onFinish && (
      <button
        type="button"
        onClick={onFinish}
        aria-label={`「${bean.name}」を飲み切りにする`}
        className="absolute right-3 top-1/2 -translate-y-1/2 min-h-11 px-3 rounded-full border border-[#CE9C68]/40 text-xs text-[#CE9C68] active:opacity-70"
      >
        飲み切り
      </button>
    )}
    </div>
  )
}

export default function BeanTab() {
  const [beans, setBeans]           = useState<Bean[]>([])
  const [brews, setBrews]           = useState<Brew[]>([])
  const [editing, setEditing]       = useState<Bean | 'new' | null>(null)
  // 買い直し中の「前の袋」。editing とは別に持つ（編集 → 買い直しへ切り替わる）
  const [repurchasing, setRepurchasing] = useState<Bean | null>(null)
  const showToast = useToast()

  useEffect(() => {
    getAllBeans().then(setBeans).catch(() => {})
    getAllBrews().then(setBrews).catch(() => {})
  }, [])

  const upsert = (list: Bean[], bean: Bean) => {
    const i = list.findIndex(b => b.id === bean.id)
    if (i >= 0) { const n = [...list]; n[i] = bean; return n }
    return [...list, bean]
  }

  const handleSave = (bean: Bean, finishedPrevious?: Bean) => {
    setBeans(prev => {
      let next = upsert(prev, bean)
      if (finishedPrevious) next = upsert(next, finishedPrevious)
      return next
    })
    const wasRepurchase = Boolean(repurchasing)
    setEditing(null)
    setRepurchasing(null)
    if (wasRepurchase) {
      const n = beanBagNumber(bean, upsert(beans, bean))
      showToast(`「${bean.name}」の${n}袋目を登録しました`, { type: 'success' })
    }
  }

  const handleDelete = async (bean: Bean) => {
    try {
      await deleteBean(bean.id)
    } catch {
      showToast('削除に失敗しました', { type: 'error' })
      return
    }
    setBeans(prev => prev.filter(b => b.id !== bean.id))
    setEditing(null)
    showToast(`「${bean.name}」を削除しました`, {
      action: {
        label: '取り消す',
        onClick: () => {
          putBean(bean)
            .then(() => setBeans(prev => [...prev, bean]))
            .catch(() => showToast('復元に失敗しました', { type: 'error' }))
        },
      },
    })
  }

  // 編集を開かずに飲み切りにする。押し間違いに備えて取り消しを付ける
  const handleFinish = async (bean: Bean) => {
    const finished = { ...bean, finishedAt: nowISO() }
    try {
      await withSaveTimeout(putBean(finished))
    } catch (e) {
      showToast(saveErrorMessage(e), { type: 'error' })
      return
    }
    setBeans(prev => upsert(prev, finished))
    showToast(`「${bean.name}」を飲み切りにしました`, {
      action: {
        label: '取り消す',
        onClick: () => {
          putBean(bean)
            .then(() => setBeans(prev => upsert(prev, bean)))
            .catch(() => showToast('取り消しに失敗しました', { type: 'error' }))
        },
      },
    })
  }

  const activeBeans   = beans.filter(b => !b.finishedAt)
  const finishedBeans = beans.filter(b => Boolean(b.finishedAt))
  // 産地・農園・品種のユーザー履歴（新しく登録した豆を優先）
  const newestFirst = [...beans].reverse()
  const pick = (get: (b: Bean) => string | undefined) =>
    newestFirst.map(get).filter((v): v is string => Boolean(v))
  const recentOrigins   = pick(b => b.origin)
  const recentFarms     = pick(b => b.farm)
  const recentVarieties = pick(b => b.variety)
  const recentRoasters  = pick(b => b.roaster)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {beans.length === 0 ? (
        <EmptyState
          title="豆を登録すると、記録が一段早くなります"
          description="焙煎日からの経過日数と、残りのグラム数が自動で追えます"
        />
      ) : (
        <div className="flex flex-col gap-3 mb-4">
          {activeBeans.map(bean => (
            <BeanRow
              key={bean.id}
              bean={bean}
              brews={brews}
              bagNumber={beanBagNumber(bean, beans)}
              onClick={() => setEditing(bean)}
              onFinish={() => handleFinish(bean)}
            />
          ))}
          {finishedBeans.length > 0 && (
            <>
              <p className="text-xs text-[#6b5a4a] uppercase tracking-wider mt-2">飲み切った豆</p>
              {finishedBeans.map(bean => (
                <BeanRow
                  key={bean.id}
                  bean={bean}
                  brews={brews}
                  bagNumber={beanBagNumber(bean, beans)}
                  muted
                  onClick={() => setEditing(bean)}
                />
              ))}
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setEditing('new')}
        className="w-full border border-dashed border-[#993C1D]/50 text-[#993C1D] py-3 rounded-xl text-sm font-semibold"
      >
        ＋ 豆を追加
      </button>

      <ModalSheet open={editing !== null}>
        <BeanForm
          // 買い直し中は initial を渡さない（新しい袋を作るため）
          key={repurchasing ? `repurchase-${repurchasing.id}` : editing === 'new' ? 'new' : editing?.id}
          initial={repurchasing || editing === 'new' ? undefined : (editing ?? undefined)}
          repurchaseOf={repurchasing ?? undefined}
          recentOrigins={recentOrigins}
          recentFarms={recentFarms}
          recentVarieties={recentVarieties}
          recentRoasters={recentRoasters}
          onSave={handleSave}
          onDelete={
            !repurchasing && editing !== 'new' && editing !== null
              ? () => handleDelete(editing)
              : undefined
          }
          onRepurchase={
            !repurchasing && editing !== 'new' && editing !== null
              ? () => setRepurchasing(editing)
              : undefined
          }
          onCancel={() => { setEditing(null); setRepurchasing(null) }}
        />
      </ModalSheet>
    </div>
  )
}
