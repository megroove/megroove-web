import { DEFAULT_FLAVORS } from '../../db'

interface Props {
  selected: string[]
  onChange: (v: string[]) => void
  // 「よく使う」行（頻度順）。空なら行ごと非表示
  frequent?: string[]
}

export default function FlavorChips({ selected, onChange, frequent = [] }: Props) {
  const toggle = (f: string) =>
    onChange(selected.includes(f) ? selected.filter(x => x !== f) : [...selected, f])

  const chip = (f: string) => (
    <button
      key={f}
      type="button"
      onClick={() => toggle(f)}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        selected.includes(f)
          ? 'bg-[#993C1D] text-[#F7EFE6]'
          : 'bg-[#3e3020] text-[#CE9C68]'
      }`}
    >
      {f}
    </button>
  )

  return (
    <div className="flex flex-col gap-2.5">
      {frequent.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] text-[#6b5a4a]">よく使う</p>
          <div className="flex flex-wrap gap-2">{frequent.map(chip)}</div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">{DEFAULT_FLAVORS.map(chip)}</div>
    </div>
  )
}
