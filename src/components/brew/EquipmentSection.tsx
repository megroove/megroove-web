import { useState } from 'react'
import type { Equipment, EquipmentType } from '../../db'
import { putEquipment, newId, nowISO, EQUIPMENT_TYPE_LABELS, withSaveTimeout, saveErrorMessage } from '../../db'
import { useToast } from '../Toast'

interface Props {
  equipment: Equipment[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onNewEquipment: (e: Equipment) => void
}

const EQUIPMENT_TYPES: EquipmentType[] = ['dripper', 'server', 'grinder', 'kettle', 'scale', 'other']

export default function EquipmentSection({ equipment, selectedIds, onToggle, onNewEquipment }: Props) {
  const selected = selectedIds ?? [] // 念のため（undefined でも落ちないように）
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<EquipmentType>('dripper')
  const [submitting, setSubmitting] = useState(false)
  const showToast = useToast()

  const handleAdd = async () => {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const item: Equipment = { id: newId(), name: name.trim(), type, createdAt: nowISO() }
    // 保存が失敗／停止しても無言で固まらないよう、エラー・ハングを表面化する
    try {
      await withSaveTimeout(putEquipment(item))
    } catch (e) {
      console.error('[megroove] 器具の保存に失敗しました:', e)
      setSubmitting(false)
      showToast(saveErrorMessage(e), { type: 'error' })
      return
    }
    onNewEquipment(item)
    onToggle(item.id)
    setName('')
    setType('dripper')
    setShowAdd(false)
    setSubmitting(false)
  }

  return (
    <>
      {/* 種類ごとにグループ表示（複数選択可）。空の種類は出さない */}
      <div className="flex flex-col gap-3">
        {EQUIPMENT_TYPES.map(t => {
          const items = equipment.filter(e => e.type === t)
          if (items.length === 0) return null
          return (
            <div key={t}>
              <p className="text-[11px] text-[#6b5a4a] mb-1.5">{EQUIPMENT_TYPE_LABELS[t]}</p>
              <div className="flex flex-wrap gap-2">
                {items.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onToggle(e.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selected.includes(e.id)
                        ? 'bg-[#993C1D] text-[#F7EFE6]'
                        : 'bg-[#3e3020] text-[#CE9C68]'
                    }`}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="self-start px-3 py-1.5 rounded-full text-sm text-[#993C1D] border border-dashed border-[#993C1D]/50"
        >
          ＋ 追加
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end">
          <div
            className="bg-[#1a0a05] w-full rounded-t-2xl p-6 space-y-4"
            style={{ animation: 'fade-up 0.2s ease-out', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
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
