import { useState } from 'react'
import BeanTab from '../components/stock/BeanTab'
import EquipmentTab from '../components/stock/EquipmentTab'
import RecipeTab from '../components/stock/RecipeTab'

type Tab = 'beans' | 'equipment' | 'recipes'

const TABS: { key: Tab; label: string }[] = [
  { key: 'beans',     label: '豆' },
  { key: 'equipment', label: '器具' },
  { key: 'recipes',   label: 'レシピ' },
]

export default function StockPage() {
  const [tab, setTab] = useState<Tab>('beans')

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-5 pb-3">
        <h2 className="text-xl font-semibold text-[#F7EFE6]">ストック</h2>
      </div>

      <div className="flex border-b border-[#2e2018]">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === t.key
                ? 'text-[#CE9C68] border-[#993C1D]'
                : 'text-[#6b5a4a] border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'beans'     && <BeanTab />}
      {tab === 'equipment' && <EquipmentTab />}
      {tab === 'recipes'   && <RecipeTab />}
    </div>
  )
}
