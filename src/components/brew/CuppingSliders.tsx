import type { CuppingScores } from '../../db'

interface Props {
  value: CuppingScores
  onChange: (v: CuppingScores) => void
}

const AXES: { key: keyof CuppingScores; label: string }[] = [
  { key: 'acidity',    label: '酸味' },
  { key: 'sweetness',  label: '甘み' },
  { key: 'bitterness', label: '苦味' },
  { key: 'body',       label: 'ボディ' },
  { key: 'aftertaste', label: '後味' },
]

export default function CuppingSliders({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      {AXES.map(({ key, label }) => {
        const v = value[key]
        return (
          <div key={key}>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-[#CE9C68]">{label}</span>
              <span className="text-sm text-[#F7EFE6] font-semibold tabular-nums">
                {v !== undefined ? v.toFixed(1) : '—'}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={0.5}
              value={v ?? 3}
              onChange={e => onChange({ ...value, [key]: Number(e.target.value) })}
              className="w-full accent-[#993C1D] cursor-pointer"
            />
            <div className="flex justify-between text-xs text-[#4a3a2a] mt-1 px-0.5">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
