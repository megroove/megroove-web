import { useState, useMemo } from 'react'
import { COFFEE_ORIGINS } from '../db/origins'
import { GlobeIcon } from './icons'

// ひらがな入力でもカタカナ候補にマッチさせる（「えちお」→「エチオ」）
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

const MAX_SUGGESTIONS = 8

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  // ユーザーが過去に入力した産地（新しい順）。マスター候補より優先して表示する
  recentOrigins?: string[]
  // 入力欄の見た目。filled: フォーム用の塗り / bare: カード内の透明入力
  variant?: 'filled' | 'bare'
}

export default function OriginInput({
  value, onChange, placeholder = '例: エチオピア イルガチェフェ',
  recentOrigins = [], variant = 'filled',
}: Props) {
  const [open, setOpen] = useState(false)

  const candidates = useMemo(() => {
    const seen = new Set<string>()
    const list: { name: string; recent: boolean }[] = []
    for (const o of recentOrigins) {
      if (o && !seen.has(o)) { seen.add(o); list.push({ name: o, recent: true }) }
    }
    for (const o of COFFEE_ORIGINS) {
      if (!seen.has(o)) { seen.add(o); list.push({ name: o, recent: false }) }
    }
    return list
  }, [recentOrigins])

  const suggestions = useMemo(() => {
    const q = normalize(value)
    return candidates
      .filter(c => c.name !== value && (!q || normalize(c.name).includes(q)))
      .slice(0, MAX_SUGGESTIONS)
  }, [candidates, value])

  const inputClass = variant === 'filled'
    ? 'w-full bg-[#3e3020] text-[#F7EFE6] rounded-xl px-4 py-3 outline-none placeholder-[#6b5a4a] text-sm'
    : 'w-full bg-transparent text-[#F7EFE6] outline-none placeholder-[#4a3a2a] text-sm'

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={inputClass}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#3e3020] rounded-xl overflow-hidden z-30 shadow-xl border border-[#2e2018] max-h-52 overflow-y-auto">
          {suggestions.map(s => (
            <button
              key={s.name}
              type="button"
              onMouseDown={() => { onChange(s.name); setOpen(false) }}
              className="w-full px-4 py-2.5 text-left text-sm text-[#F7EFE6] border-b border-[#2e2018] last:border-0 hover:bg-[#2e2018] active:bg-[#2e2018] flex items-center gap-2"
            >
              <span className={`shrink-0 ${s.recent ? 'text-[#993C1D]' : 'text-[#6b5a4a]'}`}>
                <GlobeIcon size={13} />
              </span>
              <span className="truncate">{s.name}</span>
              {s.recent && <span className="ml-auto text-[10px] text-[#6b5a4a] shrink-0">履歴</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
