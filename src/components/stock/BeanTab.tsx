import { useState, useEffect } from 'react'
import type { Bean, Brew, RoastLevel } from '../../db'
import {
  getAllBeans, getAllBrews, putBean, deleteBean, newId, nowISO,
  ROAST_LEVEL_LABELS, daysSinceRoast, formatBeanRemaining,
} from '../../db'
import { Field, TextInput, NumberInput, DateInput, ChipSelect, DeleteButton, ModalSheet, SaveButton } from './FormHelpers'
import { useToast } from '../Toast'

const ROAST_LEVELS: RoastLevel[] = ['light', 'light-medium', 'medium', 'medium-dark', 'dark']

function BeanForm({
  initial, onSave, onDelete, onCancel,
}: {
  initial?: Bean
  onSave: (b: Bean) => void
  onDelete?: () => void
  onCancel: () => void
}) {
  const [name,        setName]        = useState(initial?.name        ?? '')
  const [roastLevel,  setRoastLevel]  = useState<RoastLevel>(initial?.roastLevel ?? 'medium')
  const [roastedAt,   setRoastedAt]   = useState(initial?.roastedAt   ?? '')
  const [purchasedAt, setPurchasedAt] = useState(initial?.purchasedAt ?? '')
  const [amountG,     setAmountG]     = useState<number | undefined>(initial?.initialAmountG)
  const [finished,    setFinished]    = useState(Boolean(initial?.finishedAt))
  const [origin,      setOrigin]      = useState(initial?.origin      ?? '')
  const [farm,        setFarm]        = useState(initial?.farm        ?? '')
  const [variety,     setVariety]     = useState(initial?.variety     ?? '')
  const [process,     setProcess]     = useState(initial?.process     ?? '')
  const [stockNote,   setStockNote]   = useState(initial?.stockNote   ?? '')
  const [saving,      setSaving]      = useState(false)
  const showToast = useToast()

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    const bean: Bean = {
      id:         initial?.id ?? newId(),
      name:       name.trim(),
      roastLevel,
      roastedAt:   roastedAt   || undefined,
      purchasedAt: purchasedAt || undefined,
      initialAmountG: amountG,
      finishedAt:  finished ? (initial?.finishedAt ?? nowISO()) : undefined,
      origin:      origin.trim()    || undefined,
      farm:        farm.trim()      || undefined,
      variety:     variety.trim()   || undefined,
      process:     process.trim()   || undefined,
      stockNote:   stockNote.trim() || undefined,
      createdAt:  initial?.createdAt ?? nowISO(),
    }
    try {
      await putBean(bean)
    } catch {
      setSaving(false)
      showToast('保存に失敗しました', { type: 'error' })
      return
    }
    onSave(bean)
  }

  return (
    <div className="flex flex-col px-4 py-4 gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#F7EFE6]">{initial ? '豆を編集' : '豆を追加'}</h3>
        <button type="button" onClick={onCancel} className="text-[#CE9C68] text-sm">閉じる</button>
      </div>

      <Field label="名前 *">
        <TextInput value={name} onChange={setName} placeholder="例: エチオピア イルガチェフェ" autoFocus />
      </Field>

      <Field label="焙煎度">
        <ChipSelect
          options={ROAST_LEVELS.map(l => ({ value: l, label: ROAST_LEVEL_LABELS[l] }))}
          value={roastLevel}
          onChange={setRoastLevel}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="焙煎日"><DateInput value={roastedAt}   onChange={setRoastedAt}   /></Field>
        <Field label="購入日"><DateInput value={purchasedAt} onChange={setPurchasedAt} /></Field>
      </div>

      <Field label="内容量（g）— 入力すると記録から残量を自動計算">
        <NumberInput value={amountG} onChange={setAmountG} placeholder="例: 200" min={1} />
      </Field>

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

      <Field label="産地">
        <TextInput value={origin} onChange={setOrigin} placeholder="例: エチオピア" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="農園">
          <TextInput value={farm} onChange={setFarm} placeholder="任意" />
        </Field>
        <Field label="品種">
          <TextInput value={variety} onChange={setVariety} placeholder="任意" />
        </Field>
      </div>

      <Field label="精製方法">
        <TextInput value={process} onChange={setProcess} placeholder="例: ナチュラル" />
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
        {onDelete && <DeleteButton label="この豆を削除" onDelete={onDelete} />}
      </div>
    </div>
  )
}

function BeanRow({ bean, brews, onClick, muted }: {
  bean: Bean; brews: Brew[]; onClick: () => void; muted?: boolean
}) {
  const remaining = !bean.finishedAt ? formatBeanRemaining(bean, brews) : null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full bg-[#2E2018] rounded-xl p-4 text-left active:opacity-80 ${muted ? 'opacity-60' : ''}`}
    >
      <p className="text-[#F7EFE6] font-medium">{bean.name}</p>
      <p className="text-xs text-[#CE9C68] mt-0.5">
        {ROAST_LEVEL_LABELS[bean.roastLevel]}
        {bean.roastedAt ? ` · 焙煎から${daysSinceRoast(bean.roastedAt)}日` : ''}
        {bean.origin ? ` · ${bean.origin}` : ''}
      </p>
      {remaining && (
        <p className="text-xs text-[#6b5a4a] mt-0.5">{remaining}</p>
      )}
      {bean.stockNote && (
        <p className="text-xs text-[#6b5a4a] mt-1 truncate">{bean.stockNote}</p>
      )}
    </button>
  )
}

export default function BeanTab() {
  const [beans, setBeans]           = useState<Bean[]>([])
  const [brews, setBrews]           = useState<Brew[]>([])
  const [editing, setEditing]       = useState<Bean | 'new' | null>(null)
  const showToast = useToast()

  useEffect(() => {
    getAllBeans().then(setBeans).catch(() => {})
    getAllBrews().then(setBrews).catch(() => {})
  }, [])

  const handleSave = (bean: Bean) => {
    setBeans(prev => {
      const i = prev.findIndex(b => b.id === bean.id)
      if (i >= 0) { const n = [...prev]; n[i] = bean; return n }
      return [...prev, bean]
    })
    setEditing(null)
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

  const activeBeans   = beans.filter(b => !b.finishedAt)
  const finishedBeans = beans.filter(b => Boolean(b.finishedAt))

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {beans.length === 0 ? (
        <p className="text-[#6b5a4a] text-sm text-center py-8">まだ豆が登録されていません</p>
      ) : (
        <div className="flex flex-col gap-3 mb-4">
          {activeBeans.map(bean => (
            <BeanRow key={bean.id} bean={bean} brews={brews} onClick={() => setEditing(bean)} />
          ))}
          {finishedBeans.length > 0 && (
            <>
              <p className="text-xs text-[#6b5a4a] uppercase tracking-wider mt-2">飲み切った豆</p>
              {finishedBeans.map(bean => (
                <BeanRow key={bean.id} bean={bean} brews={brews} muted onClick={() => setEditing(bean)} />
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
          initial={editing === 'new' ? undefined : (editing ?? undefined)}
          onSave={handleSave}
          onDelete={editing !== 'new' && editing !== null ? () => handleDelete(editing) : undefined}
          onCancel={() => setEditing(null)}
        />
      </ModalSheet>
    </div>
  )
}
