import { DEFAULT_FLAVORS } from '../../db'

interface Props {
  selected: string[]
  onChange: (v: string[]) => void
}

export default function FlavorChips({ selected, onChange }: Props) {
  const toggle = (f: string) =>
    onChange(selected.includes(f) ? selected.filter(x => x !== f) : [...selected, f])

  return (
    <div className="flex flex-wrap gap-2">
      {DEFAULT_FLAVORS.map(f => (
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
      ))}
    </div>
  )
}
