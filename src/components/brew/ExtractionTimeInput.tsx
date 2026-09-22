interface Props {
  valueSec: number | undefined
  onChange: (v: number | undefined) => void
}

// 総抽出時間の手入力（分・秒）。
// 計測そのものは Side A の「針を落として抽出スタート」＝抽出中画面に一本化してあるので、
// ここは「過去の一杯をあとから記録する」ための入力欄に徹する。
export default function ExtractionTimeInput({ valueSec, onChange }: Props) {
  const minVal = valueSec !== undefined ? Math.floor(valueSec / 60) : undefined
  const secVal = valueSec !== undefined ? valueSec % 60 : undefined

  const update = (m: number | undefined, s: number | undefined) => {
    if (m === undefined && s === undefined) { onChange(undefined); return }
    onChange((m ?? 0) * 60 + Math.min(59, Math.max(0, s ?? 0)))
  }

  return (
    <div className="flex items-baseline gap-1">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={minVal ?? ''}
        onChange={e => update(e.target.value ? Number(e.target.value) : undefined, secVal)}
        placeholder="—"
        aria-label="総抽出時間（分）"
        className="w-12 bg-transparent text-[#F7EFE6] text-xl font-semibold outline-none placeholder-[#4a3a2a] tabular-nums text-right"
      />
      <span className="text-xs text-[#CE9C68]">分</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={59}
        value={secVal ?? ''}
        onChange={e => update(minVal, e.target.value ? Number(e.target.value) : undefined)}
        placeholder="—"
        aria-label="総抽出時間（秒）"
        className="w-12 bg-transparent text-[#F7EFE6] text-xl font-semibold outline-none placeholder-[#4a3a2a] tabular-nums text-right"
      />
      <span className="text-xs text-[#CE9C68]">秒</span>
    </div>
  )
}
