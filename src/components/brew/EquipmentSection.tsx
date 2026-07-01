import { useState } from 'react'
import type { Equipment, EquipmentType } from '../../db'
import { putEquipment, newId, nowISO, EQUIPMENT_TYPE_LABELS } from '../../db'

interface Props {
  equipment: Equipment[]
  selectedId?: string
  onSelect: (id: string | undefined) => void
  onNewEquipment: (e: Equipment) => void
}

const EQUIPMENT_TYPES: EquipmentType[] = ['dripper', 'server', 'grinder', 'kettle', 'scale', 'other']

export default function EquipmentSection({ equipment, selectedId, onSelect, onNewEquipment }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<EquipmentType>('dripper')
  const [submitting, setSubmitting] = useState(false)

  const handleAdd = async () => {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const item: Equipment = { id: newId(), name: name.trim(), type, createdAt: nowISO() }
    await putEquipment(item)
    onNewEquipment(item)
    onSelect(item.id)
    setName('')
    setType('dripper')
    setShowAdd(false)
    setSubmitting(false)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {equipment.map(e => (
          <button
            key={e.id}
            type="button"
            onClick={() => onSelect(e.id === selectedId ? undefined : e.id)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              e.id === selectedId
                ? 'bg-[#993C1D] text-[#F7EFE6]'
                : 'bg-[#3e3020] text-[#CE9C68]'
            }`}
          >
            {e.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 rounded-full text-sm text-[#993C1D] border border-dashed border-[#993C1D]/50"
        >
          ＋ 追加
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end">
          <div
            className="bg-[#1a0a05] w-full rounded-t-2xl p-6 space-y-4"
            style={{ animation: 'fade-up 0.2s ease-out' }}
          >
            <h3 className="text-lg font-semibold text-[#F7EFE6]">器具を追加</h3>

            <div>
              <label className="text-xs text-[#CE9C68] mb-1.5 block">名前 *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例: ハリオ V60"
                className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none placeholder-[#6b5a4a]"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-[#CE9C68] mb-1.5 block">タイプ</label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      type === t
                        ? 'bg-[#993C1D] text-[#F7EFE6]'
                        : 'bg-[#3e3020] text-[#CE9C68]'
                    }`}
                  >
                    {EQUIPMENT_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={!name.trim() || submitting}
                className="w-full bg-[#993C1D] text-[#F7EFE6] py-4 rounded-2xl font-semibold disabled:opacity-40"
              >
                追加して、この記録で使う
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="w-full text-[#CE9C68] py-3 rounded-2xl text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
