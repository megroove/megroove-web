import { useState, useEffect } from 'react'
import type { Recipe, Equipment } from '../../db'
import { getAllRecipes, putRecipe, deleteRecipe, getAllEquipment, newId, nowISO, calcRatio } from '../../db'
import { Field, TextInput, NumberInput, DeleteButton, ModalSheet, SaveButton } from './FormHelpers'

function RecipeForm({
  initial, equipment, onSave, onDelete, onCancel,
}: {
  initial?: Recipe
  equipment: Equipment[]
  onSave: (r: Recipe) => void
  onDelete?: () => void
  onCancel: () => void
}) {
  const [name,       setName]       = useState(initial?.name              ?? '')
  const [doseG,      setDoseG]      = useState<number | undefined>(initial?.defaultDoseG)
  const [waterG,     setWaterG]     = useState<number | undefined>(initial?.defaultWaterG)
  const [grindSize,  setGrindSize]  = useState<number | undefined>(initial?.defaultGrindSize)
  const [tempC,      setTempC]      = useState<number | undefined>(initial?.defaultTempC)
  const [equipId,    setEquipId]    = useState<string | undefined>(initial?.defaultEquipmentId)
  const [saving,     setSaving]     = useState(false)

  const ratio = doseG && waterG ? calcRatio(doseG, waterG) : '—'

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    const recipe: Recipe = {
      id:   initial?.id ?? newId(),
      name: name.trim(),
      defaultDoseG:       doseG,
      defaultWaterG:      waterG,
      defaultGrindSize:   grindSize,
      defaultTempC:       tempC,
      defaultEquipmentId: equipId,
      createdAt: initial?.createdAt ?? nowISO(),
    }
    await putRecipe(recipe)
    onSave(recipe)
  }

  return (
    <div className="flex flex-col px-4 py-4 gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#F7EFE6]">{initial ? 'レシピを編集' : 'レシピを追加'}</h3>
        <button type="button" onClick={onCancel} className="text-[#CE9C68] text-sm">閉じる</button>
      </div>

      <Field label="レシピ名 *">
        <TextInput value={name} onChange={setName} placeholder="例: 朝の定番" autoFocus />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="粉量 (g)">
          <NumberInput value={doseG} onChange={setDoseG} min={1} />
        </Field>
        <Field label="湯量 (g)">
          <NumberInput value={waterG} onChange={setWaterG} min={10} />
        </Field>
      </div>

      {doseG && waterG && (
        <p className="text-center text-sm text-[#CE9C68] -mt-2">
          比率 <span className="text-[#F7EFE6] font-semibold">{ratio}</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="挽き目">
          <NumberInput value={grindSize} onChange={setGrindSize} min={0} />
        </Field>
        <Field label="湯温 (°C)">
          <NumberInput value={tempC} onChange={setTempC} min={60} />
        </Field>
      </div>

      {equipment.length > 0 && (
        <Field label="器具">
          <div className="flex flex-wrap gap-2">
            {equipment.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEquipId(e.id === equipId ? undefined : e.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  e.id === equipId
                    ? 'bg-[#993C1D] text-[#F7EFE6]'
                    : 'bg-[#3e3020] text-[#CE9C68]'
                }`}
              >
                {e.name}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="flex flex-col gap-2 pb-6">
        <SaveButton disabled={!name.trim()} saving={saving} onClick={handleSave} />
        {onDelete && <DeleteButton label="このレシピを削除" onDelete={onDelete} />}
      </div>
    </div>
  )
}

export default function RecipeTab() {
  const [recipes,   setRecipes]   = useState<Recipe[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [editing,   setEditing]   = useState<Recipe | 'new' | null>(null)

  useEffect(() => {
    Promise.all([getAllRecipes(), getAllEquipment()]).then(([rs, eqs]) => {
      setRecipes(rs)
      setEquipment(eqs)
    })
  }, [])

  const handleSave = (recipe: Recipe) => {
    setRecipes(prev => {
      const i = prev.findIndex(r => r.id === recipe.id)
      if (i >= 0) { const n = [...prev]; n[i] = recipe; return n }
      return [...prev, recipe]
    })
    setEditing(null)
  }

  const handleDelete = async (id: string) => {
    await deleteRecipe(id)
    setRecipes(prev => prev.filter(r => r.id !== id))
    setEditing(null)
  }

  const equipMap = new Map(equipment.map(e => [e.id, e]))

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {recipes.length === 0 ? (
        <p className="text-[#6b5a4a] text-sm text-center py-8">まだレシピが登録されていません</p>
      ) : (
        <div className="flex flex-col gap-3 mb-4">
          {recipes.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setEditing(r)}
              className="w-full bg-[#2E2018] rounded-xl p-4 text-left active:opacity-80"
            >
              <p className="text-[#F7EFE6] font-medium">{r.name}</p>
              <p className="text-xs text-[#CE9C68] mt-0.5">
                {r.defaultDoseG && r.defaultWaterG
                  ? `${r.defaultDoseG}g / ${r.defaultWaterG}g (${calcRatio(r.defaultDoseG, r.defaultWaterG)})`
                  : ''}
                {r.defaultTempC ? ` · ${r.defaultTempC}°C` : ''}
                {r.defaultGrindSize !== undefined ? ` · 挽き目${r.defaultGrindSize}` : ''}
                {r.defaultEquipmentId && equipMap.get(r.defaultEquipmentId)
                  ? ` · ${equipMap.get(r.defaultEquipmentId)!.name}`
                  : ''}
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
        ＋ レシピを追加
      </button>

      <ModalSheet open={editing !== null}>
        <RecipeForm
          initial={editing === 'new' ? undefined : (editing ?? undefined)}
          equipment={equipment}
          onSave={handleSave}
          onDelete={editing !== 'new' && editing !== null ? () => handleDelete(editing.id) : undefined}
          onCancel={() => setEditing(null)}
        />
      </ModalSheet>
    </div>
  )
}
