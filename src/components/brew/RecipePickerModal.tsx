import { useState, useEffect } from 'react'
import type { Recipe } from '../../db'
import { getAllRecipes, putRecipe, newId, nowISO } from '../../db'

interface Props {
  currentRecipeId?: string
  defaultDoseG: number
  defaultWaterG: number
  defaultGrindSize?: number
  defaultTempC: number
  onSelect: (recipe: Recipe) => void
  onClear: () => void
  onClose: () => void
}

function AddRecipeForm({
  defaultDoseG,
  defaultWaterG,
  defaultGrindSize,
  defaultTempC,
  onAdd,
  onCancel,
}: {
  defaultDoseG: number
  defaultWaterG: number
  defaultGrindSize?: number
  defaultTempC: number
  onAdd: (r: Recipe) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const recipe: Recipe = {
      id: newId(),
      name: name.trim(),
      defaultDoseG,
      defaultWaterG,
      defaultGrindSize,
      defaultTempC,
      createdAt: nowISO(),
    }
    await putRecipe(recipe)
    onAdd(recipe)
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h3 className="text-lg font-semibold text-[#F7EFE6]">レシピを保存</h3>
      <p className="text-xs text-[#CE9C68]">
        現在の設定（{defaultDoseG}g / {defaultWaterG}g / {defaultTempC}°C
        {defaultGrindSize !== undefined ? ` / 挽き目${defaultGrindSize}` : ''}）をレシピとして保存します。
      </p>

      <div>
        <label className="text-xs text-[#CE9C68] mb-1.5 block">レシピ名 *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="例: 朝の定番"
          className="w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none placeholder-[#6b5a4a]"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!name.trim() || submitting}
          className="w-full bg-[#993C1D] text-[#F7EFE6] py-4 rounded-2xl font-semibold disabled:opacity-40"
        >
          追加して、この記録で使う
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-[#CE9C68] py-3 rounded-2xl text-sm"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}

export default function RecipePickerModal({
  currentRecipeId,
  defaultDoseG,
  defaultWaterG,
  defaultGrindSize,
  defaultTempC,
  onSelect,
  onClear,
  onClose,
}: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    getAllRecipes().then(setRecipes)
  }, [])

  const handleAdd = (recipe: Recipe) => {
    onSelect(recipe)
    onClose()
  }

  if (showAdd) {
    return (
      <div className="fixed inset-0 z-50 bg-[#1a0a05] overflow-y-auto">
        <div className="sticky top-0 flex items-center px-4 py-3 bg-[#1a0a05] border-b border-[#2e2018]">
          <button type="button" onClick={() => setShowAdd(false)} className="text-[#CE9C68] text-sm">
            ← 戻る
          </button>
        </div>
        <AddRecipeForm
          defaultDoseG={defaultDoseG}
          defaultWaterG={defaultWaterG}
          defaultGrindSize={defaultGrindSize}
          defaultTempC={defaultTempC}
          onAdd={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#1a0a05] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2018]">
        <h2 className="text-lg font-semibold text-[#F7EFE6]">レシピを選ぶ</h2>
        <button type="button" onClick={onClose} className="text-[#CE9C68] text-sm">
          閉じる
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {currentRecipeId && (
          <button
            type="button"
            onClick={() => { onClear(); onClose() }}
            className="w-full px-4 py-4 text-left text-[#CE9C68] text-sm border-b border-[#2e2018]"
          >
            レシピなしで記録する
          </button>
        )}
        {recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-[#CE9C68] text-sm">まだレシピが登録されていません</p>
          </div>
        ) : (
          <ul>
            {recipes.map(r => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => { onSelect(r); onClose() }}
                  className={`w-full flex items-center justify-between px-4 py-4 text-left border-b border-[#2e2018] active:bg-[#2e1810] ${
                    r.id === currentRecipeId ? 'bg-[#2e1810]' : ''
                  }`}
                >
                  <div>
                    <p className="text-[#F7EFE6] font-medium">{r.name}</p>
                    {(r.defaultDoseG || r.defaultWaterG) && (
                      <p className="text-xs text-[#CE9C68] mt-0.5">
                        {r.defaultDoseG}g / {r.defaultWaterG}g
                        {r.defaultTempC ? ` / ${r.defaultTempC}°C` : ''}
                      </p>
                    )}
                  </div>
                  {r.id === currentRecipeId && (
                    <span className="text-[#993C1D] text-lg">✓</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center gap-2 px-4 py-4 text-[#993C1D] font-semibold text-sm border-b border-dashed border-[#993C1D]/40"
        >
          ＋ 現在の設定をレシピとして保存
        </button>
      </div>
    </div>
  )
}
