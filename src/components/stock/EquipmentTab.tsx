import { useState, useEffect } from 'react'
import type { Equipment, EquipmentType } from '../../db'
import { getAllEquipment, putEquipment, deleteEquipment, newId, nowISO, EQUIPMENT_TYPE_LABELS } from '../../db'
import { Field, TextInput, ChipSelect, DeleteButton, ModalSheet, SaveButton } from './FormHelpers'

const EQUIPMENT_TYPES: EquipmentType[] = ['dripper', 'server', 'grinder', 'kettle', 'scale', 'other']

function EquipmentForm({
  initial, onSave, onDelete, onCancel,
}: {
  initial?: Equipment
  onSave: (e: Equipment) => void
  onDelete?: () => void
  onCancel: () => void
}) {
  const [name,     setName]     = useState(initial?.name     ?? '')
  const [type,     setType]     = useState<EquipmentType>(initial?.type ?? 'dripper')
  const [maker,    setMaker]    = useState(initial?.maker    ?? '')
  const [sizeNote, setSizeNote] = useState(initial?.sizeNote ?? '')
  const [saving,   setSaving]   = useState(false)

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    const item: Equipment = {
      id:       initial?.id ?? newId(),
      name:     name.trim(),
      type,
      maker:    maker.trim()    || undefined,
      sizeNote: sizeNote.trim() || undefined,
      createdAt: initial?.createdAt ?? nowISO(),
    }
    await putEquipment(item)
    onSave(item)
  }

  return (
    <div className="flex flex-col px-4 py-4 gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#F7EFE6]">{initial ? '器具を編集' : '器具を追加'}</h3>
        <button type="button" onClick={onCancel} className="text-[#CE9C68] text-sm">閉じる</button>
      </div>

      <Field label="名前 *">
        <TextInput value={name} onChange={setName} placeholder="例: ハリオ V60" autoFocus />
      </Field>

      <Field label="タイプ">
        <ChipSelect
          options={EQUIPMENT_TYPES.map(t => ({ value: t, label: EQUIPMENT_TYPE_LABELS[t] }))}
          value={type}
          onChange={setType}
        />
      </Field>

      <Field label="メーカー">
        <TextInput value={maker} onChange={setMaker} placeholder="例: HARIO" />
      </Field>

      <Field label="サイズメモ">
        <TextInput value={sizeNote} onChange={setSizeNote} placeholder="例: 02サイズ" />
      </Field>

      <div className="flex flex-col gap-2 pb-6">
        <SaveButton disabled={!name.trim()} saving={saving} onClick={handleSave} />
        {onDelete && <DeleteButton label="この器具を削除" onDelete={onDelete} />}
      </div>
    </div>
  )
}

export default function EquipmentTab() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [editing,   setEditing]   = useState<Equipment | 'new' | null>(null)

  useEffect(() => { getAllEquipment().then(setEquipment) }, [])

  const handleSave = (item: Equipment) => {
    setEquipment(prev => {
      const i = prev.findIndex(e => e.id === item.id)
      if (i >= 0) { const n = [...prev]; n[i] = item; return n }
      return [...prev, item]
    })
    setEditing(null)
  }

  const handleDelete = async (id: string) => {
    await deleteEquipment(id)
    setEquipment(prev => prev.filter(e => e.id !== id))
    setEditing(null)
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {equipment.length === 0 ? (
        <p className="text-[#6b5a4a] text-sm text-center py-8">まだ器具が登録されていません</p>
      ) : (
        <div className="flex flex-col gap-3 mb-4">
          {equipment.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setEditing(item)}
              className="w-full bg-[#2E2018] rounded-xl p-4 text-left active:opacity-80"
            >
              <p className="text-[#F7EFE6] font-medium">{item.name}</p>
              <p className="text-xs text-[#CE9C68] mt-0.5">
                {EQUIPMENT_TYPE_LABELS[item.type]}
                {item.maker ? ` · ${item.maker}` : ''}
                {item.sizeNote ? ` · ${item.sizeNote}` : ''}
              </p>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setEditing('new')}
        className="w-full border border-dashed border-[#993C1D]/50 text-[#993C1D] py-3 rounded-xl text-sm font-semibold"
      >
        ＋ 器具を追加
      </button>

      <ModalSheet open={editing !== null}>
        <EquipmentForm
          initial={editing === 'new' ? undefined : (editing ?? undefined)}
          onSave={handleSave}
          onDelete={editing !== 'new' && editing !== null ? () => handleDelete(editing.id) : undefined}
          onCancel={() => setEditing(null)}
        />
      </ModalSheet>
    </div>
  )
}
